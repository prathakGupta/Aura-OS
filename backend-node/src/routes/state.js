import express from 'express';
import { asyncHandler } from '../middleware/errorHandler.js';
import {
  initSessionHandler,
  getStateHandler,
  wipeStateHandler,
  patchIntakeHandler,
} from '../controllers/stateCtrl.js';

const router = express.Router();

router.post('/init', asyncHandler(initSessionHandler));
router.patch('/:userId/intake', asyncHandler(patchIntakeHandler));  // must be before /:userId GET
router.get('/:userId', asyncHandler(getStateHandler));
router.delete('/:userId', asyncHandler(wipeStateHandler));

export default router;
