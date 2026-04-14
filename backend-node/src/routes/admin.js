import express from "express";
import {
  getStats,
  getAllUsers,
  toggleSuspend,
} from "../controllers/adminCtrl.js";
import verifyToken from "../middleware/verifyToken.js";
import requireRole from "../middleware/requireRole.js";

import { asyncHandler } from "../middleware/errorHandler.js";

const router = express.Router();

// All admin routes require valid token + admin role
router.use(verifyToken);
router.use(requireRole("admin"));

router.get("/stats",                asyncHandler(getStats));
router.get("/users",                asyncHandler(getAllUsers));
router.patch("/users/:id/suspend",  asyncHandler(toggleSuspend));

export default router;