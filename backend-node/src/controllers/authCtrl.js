import User from "../models/User.js";
import Guardian from "../models/Guardian.js";
import admin from "../config/firebase.js";
import {
  generateInviteToken,
  sendGuardianInviteEmail,
} from "../services/guardianInvite.js";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";

dotenv.config();

// GET /api/auth/me
export const getMe = async (req, res) => {
  try {
    if (!req.user) {
      return res.status(404).json({
        success: false,
        message: "Profile not found",
      });
    }

    let linkedUserId = null;

    // If this is a guardian, find the user they are linked to
    if (req.user.role === "guardian") {
      const guardianRecord = await Guardian.findOne({
        firebaseUid: req.firebaseUser.uid,
      });
      if (guardianRecord) {
        linkedUserId = guardianRecord.linkedUserId.toString();
      }
    }

    return res.status(200).json({
      success: true,
      profile: {
        ...req.user.toObject(),
        linkedUserId,
      },
    });
  } catch (err) {
    console.error("getMe error:", err);
    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

// POST /api/auth/profile
export const createProfile = async (req, res) => {
  try {
    const { fullName, authProvider } = req.body;
    const { uid, email } = req.firebaseUser;

    // Use findOneAndUpdate with upsert — atomic, never duplicates
    const user = await User.findOneAndUpdate(
      { firebaseUid: uid },
      {
        $setOnInsert: {
          firebaseUid: uid,
          email,
          fullName,
          authProvider: authProvider || "email",
          role: "user",
          onboardingComplete: false,
        },
      },
      {
        upsert: true,
        new: true,
        runValidators: true,
      }
    );

    return res.status(200).json({
      success: true,
      profile: user,
    });
  } catch (err) {
    console.error("createProfile error:", err);
    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

// POST /api/auth/guardian
export const saveGuardian = async (req, res) => {
  try {
    const { fullName, relationship, email, phone, consentGiven } = req.body;
    const userId = req.user._id;
    const userName = req.user.fullName;

    if (!consentGiven) {
      return res.status(400).json({
        success: false,
        message: "Guardian consent is required",
      });
    }

    const inviteToken = generateInviteToken(userId.toString());
    const inviteTokenExpiry = new Date(Date.now() + 48 * 60 * 60 * 1000);

    const guardian = await Guardian.create({
      linkedUserId: userId,
      fullName,
      relationship,
      email,
      phone,
      consentGiven,
      inviteToken,
      inviteTokenExpiry,
    });

    await User.findByIdAndUpdate(userId, {
      guardianId: guardian._id,
      onboardingComplete: true,
    });

    await sendGuardianInviteEmail({
      guardianEmail: email,
      guardianName: fullName,
      userName,
      inviteToken,
    });

    return res.status(201).json({
      success: true,
      message: "Guardian saved and invite sent",
      guardian,
    });
  } catch (err) {
    console.error("saveGuardian error:", err);
    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

// POST /api/auth/invite/verify
export const verifyInvite = async (req, res) => {
  try {
    const { token } = req.body;

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const guardian = await Guardian.findOne({
      linkedUserId: decoded.guardianId,
      inviteToken: token,
      inviteAccepted: false,
    });

    if (!guardian) {
      return res.status(400).json({
        success: false,
        message: "Invalid or already used invite token",
      });
    }

    if (new Date() > guardian.inviteTokenExpiry) {
      return res.status(400).json({
        success: false,
        message: "Invite token has expired",
      });
    }

    return res.status(200).json({
      success: true,
      guardian: {
        fullName: guardian.fullName,
        email: guardian.email,
        relationship: guardian.relationship,
      },
    });
  } catch (err) {
    console.error("verifyInvite error:", err);
    return res.status(400).json({
      success: false,
      message: "Invalid or expired invite token",
    });
  }
};

// POST /api/auth/invite/complete
export const completeGuardianSetup = async (req, res) => {
  try {
    const { token, firebaseUid } = req.body;

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const guardian = await Guardian.findOne({
      linkedUserId: decoded.guardianId,
      inviteToken: token,
      inviteAccepted: false,
    });

    if (!guardian) {
      return res.status(400).json({
        success: false,
        message: "Invalid or already used invite token",
      });
    }

    if (new Date() > guardian.inviteTokenExpiry) {
      return res.status(400).json({
        success: false,
        message: "Invite token has expired",
      });
    }

    await Guardian.findByIdAndUpdate(guardian._id, {
      inviteAccepted: true,
      firebaseUid,
      inviteToken: null,
      inviteTokenExpiry: null,
    });

    const existingUser = await User.findOne({ firebaseUid });
    if (!existingUser) {
      await User.create({
        firebaseUid,
        email: guardian.email,
        fullName: guardian.fullName,
        role: "guardian",
        onboardingComplete: true,
        authProvider: "email",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Guardian account setup complete",
    });
  } catch (err) {
    console.error("completeGuardianSetup error:", err);
    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

// PATCH /api/auth/profile
export const updateProfile = async (req, res) => {
  try {
    const { fullName } = req.body;
    const userId = req.user._id;

    const updated = await User.findByIdAndUpdate(
      userId,
      { fullName },
      { new: true }
    );

    await admin.auth().updateUser(req.firebaseUser.uid, {
      displayName: fullName,
    });

    return res.status(200).json({
      success: true,
      profile: updated,
    });
  } catch (err) {
    console.error("updateProfile error:", err);
    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

// DELETE /api/auth/account
export const deleteAccount = async (req, res) => {
  try {
    const userId = req.user._id;
    const firebaseUid = req.firebaseUser.uid;

    // Find guardian record linked to this user
    const guardian = await Guardian.findOne({ linkedUserId: userId });

    // If guardian has accepted invite, delete their Firebase account too
    if (guardian && guardian.firebaseUid) {
      try {
        await admin.auth().deleteUser(guardian.firebaseUid);
      } catch (err) {
        console.error("Guardian Firebase delete failed:", err.message);
        // Non-fatal — continue with rest of deletion
      }
    }

    // Find and delete guardian's User document in MongoDB
    if (guardian && guardian.firebaseUid) {
      await User.findOneAndDelete({ firebaseUid: guardian.firebaseUid });
    }

    // Delete the guardian record itself
    await Guardian.findOneAndDelete({ linkedUserId: userId });

    // Delete the main user
    await User.findByIdAndDelete(userId);

    // Delete main user Firebase account
    await admin.auth().deleteUser(firebaseUid);

    return res.status(200).json({
      success: true,
      message: "Account deleted successfully",
    });
  } catch (err) {
    console.error("deleteAccount error:", err);
    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};