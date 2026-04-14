import express from "express";
import {
  getMe,
  createProfile,
  saveGuardian,
  verifyInvite,
  completeGuardianSetup,
  updateProfile,
  deleteAccount,
} from "../controllers/authCtrl.js";
import verifyToken from "../middleware/verifyToken.js";

const router = express.Router();

// Public routes
router.post("/invite/verify", verifyInvite);
router.post("/invite/complete", completeGuardianSetup);

// Protected routes
router.get("/me", verifyToken, getMe);
router.post("/profile", verifyToken, createProfile);
router.post("/guardian", verifyToken, saveGuardian);
router.patch("/profile", verifyToken, updateProfile);
router.delete("/account", verifyToken, deleteAccount);

export default router;