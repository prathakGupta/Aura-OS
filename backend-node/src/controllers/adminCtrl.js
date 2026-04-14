import User from "../models/User.js";
import Guardian from "../models/Guardian.js";
import admin from "../config/firebase.js";
import dotenv from "dotenv";

dotenv.config();

// GET /api/admin/stats
export const getStats = async (req, res) => {
  try {
    const totalUsers     = await User.countDocuments({ role: "user" });
    const totalGuardians = await User.countDocuments({ role: "guardian" });
    const totalAdmins    = await User.countDocuments({ role: "admin" });
    const suspended      = await User.countDocuments({ isActive: false });
    const totalAccounts  = await User.countDocuments();

    const guardianLinks  = await Guardian.countDocuments({ inviteAccepted: true });
    const pendingInvites = await Guardian.countDocuments({ inviteAccepted: false });

    return res.status(200).json({
      success: true,
      stats: {
        totalUsers,
        totalGuardians,
        totalAdmins,
        totalAccounts,
        suspended,
        guardianLinks,
        pendingInvites,
      },
    });
  } catch (err) {
    console.error("getStats error:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

// GET /api/admin/users
export const getAllUsers = async (req, res) => {
  try {
    const users = await User.find()
      .sort({ createdAt: -1 })
      .select("-__v")
      .lean();

    // For each user, attach their guardian info if they have one
    const enriched = await Promise.all(
      users.map(async (user) => {
        if (user.role === "user" && user.guardianId) {
          const guardian = await Guardian.findById(user.guardianId)
            .select("fullName relationship email phone inviteAccepted")
            .lean();
          return { ...user, guardian };
        }
        if (user.role === "guardian") {
          const guardianRecord = await Guardian.findOne({
            firebaseUid: user.firebaseUid,
          })
            .select("linkedUserId fullName relationship inviteAccepted")
            .lean();
          return { ...user, guardianRecord };
        }
        return user;
      })
    );

    return res.status(200).json({
      success: true,
      users: enriched,
    });
  } catch (err) {
    console.error("getAllUsers error:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

// PATCH /api/admin/users/:id/suspend
export const toggleSuspend = async (req, res) => {
  try {
    const { id } = req.params;

    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Prevent admin from suspending themselves
    if (user.firebaseUid === req.firebaseUser.uid) {
      return res.status(400).json({
        success: false,
        message: "You cannot suspend your own account",
      });
    }

    const newStatus = !user.isActive;

    // Disable or enable in Firebase
    await admin.auth().updateUser(user.firebaseUid, {
      disabled: !newStatus,
    });

    // Update MongoDB
    await User.findByIdAndUpdate(id, { isActive: newStatus });

    return res.status(200).json({
      success: true,
      message: newStatus ? "Account activated" : "Account suspended",
      isActive: newStatus,
    });
  } catch (err) {
    console.error("toggleSuspend error:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};