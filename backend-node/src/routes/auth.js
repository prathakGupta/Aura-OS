import express from "express";
import { asyncHandler } from "../middleware/errorHandler.js";
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
router.post("/register", asyncHandler(register));
router.post("/login", asyncHandler(login));
router.post("/invite/verify", asyncHandler(verifyInvite));
router.post("/invite/complete", asyncHandler(completeGuardianSetup));

// Protected routes
router.get("/me", verifyToken, asyncHandler(getMe));
router.post("/guardian", verifyToken, asyncHandler(saveGuardian));
router.patch("/profile", verifyToken, asyncHandler(updateProfile));
router.delete("/account", verifyToken, asyncHandler(deleteAccount));

export default router;