import express from 'express';
import { asyncHandler } from '../middleware/errorHandler.js';
import {
  breakdownTaskHandler,
  completeQuestHandler,
  abandonTaskHandler,
  getActiveTaskHandler,
  getTaskHistoryHandler,
  syncTimelineHandler,
} from '../controllers/shatterCtrl.js';

const router = express.Router();

router.post('/breakdown', asyncHandler(breakdownTaskHandler));
router.post('/complete', asyncHandler(completeQuestHandler));
router.post('/abandon', asyncHandler(abandonTaskHandler));
router.post('/sync-timeline', asyncHandler(syncTimelineHandler));
router.get('/active/:userId', asyncHandler(getActiveTaskHandler));
router.get('/history/:userId', asyncHandler(getTaskHistoryHandler));

export default router;
