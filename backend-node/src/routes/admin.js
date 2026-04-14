import express from "express";
import {
  getStats,
  getAllUsers,
  toggleSuspend,
} from "../controllers/adminCtrl.js";
import verifyToken from "../middleware/verifyToken.js";
import requireRole from "../middleware/requireRole.js";

const router = express.Router();

// All admin routes require valid token + admin role
router.use(verifyToken);
router.use(requireRole("admin"));

router.get("/stats",                getStats);
router.get("/users",                getAllUsers);
router.patch("/users/:id/suspend",  toggleSuspend);

export default router;