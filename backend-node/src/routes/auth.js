import express from "express";
import {
  getMe,
  register,
  login,
  saveGuardian,
  verifyInvite,
  completeGuardianSetup,
  updateProfile,
  deleteAccount,
} from "../controllers/authCtrl.js";
import verifyToken from "../middleware/verifyToken.js";

const router = express.Router();

// Public routes
router.post("/register", register);
router.post("/login", login);
router.post("/invite/verify", verifyInvite);
router.post("/invite/complete", completeGuardianSetup);

// Protected routes
router.get("/me", verifyToken, getMe);
router.post("/guardian", verifyToken, saveGuardian);
router.patch("/profile", verifyToken, updateProfile);
router.delete("/account", verifyToken, deleteAccount);

export default router;