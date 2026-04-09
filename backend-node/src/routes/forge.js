import express from 'express';
import { asyncHandler } from '../middleware/errorHandler.js';
import {
  extractWorriesHandler,
  destroyWorryHandler,
  vaultWorryHandler,
  getVaultHandler,
  deleteVaultedWorryHandler,
} from '../controllers/forgeCtrl.js';

const router = express.Router();

router.post('/extract', asyncHandler(extractWorriesHandler));
router.post('/destroy', asyncHandler(destroyWorryHandler));
router.post('/vault', asyncHandler(vaultWorryHandler));
router.get('/vault/:userId', asyncHandler(getVaultHandler));
router.delete('/vault/:userId/:worryId', asyncHandler(deleteVaultedWorryHandler));

export default router;
