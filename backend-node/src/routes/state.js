import express from 'express';
import { asyncHandler } from '../middleware/errorHandler.js';
import {
  initSessionHandler,
  getStateHandler,
  wipeStateHandler,
} from '../controllers/stateCtrl.js';

const router = express.Router();

router.post('/init', asyncHandler(initSessionHandler));
router.get('/:userId', asyncHandler(getStateHandler));
router.delete('/:userId', asyncHandler(wipeStateHandler));

export default router;
