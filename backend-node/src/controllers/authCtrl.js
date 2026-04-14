import User from "../models/User.js";
import Guardian from "../models/Guardian.js";
import {
  generateInviteToken,
  sendGuardianInviteEmail,
} from "../services/guardianInvite.js";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";

dotenv.config();

const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: "30d",
  });
};

// POST /api/auth/register
export const register = async (req, res) => {
  try {
    const { fullName, email, password, authProvider } = req.body;

    const userExists = await User.findOne({ email: email.toLowerCase() });
    if (userExists) {
      return res.status(400).json({ success: false, message: "User already exists" });
    }

    const user = await User.create({
      fullName,
      email: email.toLowerCase(),
      password,
      authProvider: authProvider || "email",
      role: "user",
      onboardingComplete: false,
    });

    res.status(201).json({
      success: true,
      profile: {
        _id: user._id,
        fullName: user.fullName,
        email: user.email,
        role: user.role,
        onboardingComplete: user.onboardingComplete,
      },
      token: generateToken(user._id),
    });
  } catch (error) {
    console.error("Register error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// POST /api/auth/login
export const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email: email.toLowerCase() }).select("+password");

    if (user && (await user.matchPassword(password))) {
      res.json({
        success: true,
        profile: {
          _id: user._id,
          fullName: user.fullName,
          email: user.email,
          role: user.role,
          onboardingComplete: user.onboardingComplete,
        },
        token: generateToken(user._id),
      });
    } else {
      res.status(401).json({ success: false, message: "Invalid email or password" });
    }
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// GET /api/auth/me
export const getMe = async (req, res) => {
  try {
    if (!req.user) {
      return res.status(200).json({
        success: true,
        exists: false,
        message: "Profile not found in MongoDB",
      });
    }

    let linkedUserId = null;

    if (req.user.role === "guardian") {
      const guardianRecord = await Guardian.findOne({
        email: req.user.email,
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
    const { token, password } = req.body;

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
      inviteToken: null,
      inviteTokenExpiry: null,
    });

    const existingUser = await User.findOne({ email: guardian.email });
    let authUser;
    if (!existingUser) {
      authUser = await User.create({
        email: guardian.email,
        password: password,
        fullName: guardian.fullName,
        role: "guardian",
        onboardingComplete: true,
        authProvider: "email",
      });
    } else {
      authUser = existingUser;
    }

    return res.status(200).json({
      success: true,
      message: "Guardian account setup complete",
      token: generateToken(authUser._id.toString())
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

    const guardian = await Guardian.findOne({ linkedUserId: userId });

    if (guardian && guardian.email) {
      await User.findOneAndDelete({ email: guardian.email });
    }

    await Guardian.findOneAndDelete({ linkedUserId: userId });

    await User.findByIdAndDelete(userId);

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