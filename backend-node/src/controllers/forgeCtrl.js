// src/controllers/forgeCtrl.js
// Feature 2: Cognitive Forge – all worry-related business logic.
//
// Routes handled:
//   POST /api/forge/extract    → AI worry extraction (main feature)
//   POST /api/forge/destroy    → Mark a worry as destroyed (user dragged to fireplace)
//   POST /api/forge/vault      → Save a worry to persistent vault
//   GET  /api/forge/vault/:userId → Retrieve vaulted worries
//   DELETE /api/forge/vault/:userId/:worryId → Remove from vault

import { v4 as uuidv4 } from 'uuid';
import { extractWorries } from '../services/gemini.js';
import UserState from '../models/UserState.js';
import { AppError } from '../middleware/errorHandler.js';

// ── POST /api/forge/extract ──────────────────────────────────────────────────
//
// The core Cognitive Forge endpoint.
// Takes raw messy text, sends to Gemini, returns structured worry blocks.
// The frontend then spawns these as Matter.js physics bodies.

export const extractWorriesHandler = async (req, res) => {
  const { text, userId } = req.body;

  if (!text || typeof text !== 'string' || text.trim().length < 5) {
    throw new AppError('Please provide at least a sentence describing your worries.', 400);
  }

  // Extract worries via Gemini
  const worries = await extractWorries(text.trim());

  if (worries.length === 0) {
    return res.json({
      success: true,
      message: "Couldn't identify distinct worries. Try being more specific.",
      worries: [],
    });
  }

  // Attach UUIDs for Matter.js body tracking and future DB lookups
  const taggedWorries = worries.map((w) => ({
    ...w,
    uuid: uuidv4(),  // stable ID for physics body → DB linking
    status: 'active',
  }));

  // If userId provided, save the session's active worries to DB
  if (userId) {
    try {
      const user = await UserState.findOrCreate(userId);
      user.ensureClinicalTelemetry?.();
      user.vaultedWorries.push(
        ...taggedWorries.map((w) => ({
          id: w.uuid,
          worry: w.worry,
          weight: w.weight,
          status: 'active',
        }))
      );

      const avgWeight = taggedWorries.length
        ? taggedWorries.reduce((sum, w) => sum + (Number(w.weight) || 5), 0) / taggedWorries.length
        : 5;
      user.clinicalTelemetry.forgeSessions.push({
        wordCount: text.trim().split(/\s+/).filter(Boolean).length,
        worryDensity: Math.min(10, Math.max(1, Number(avgWeight.toFixed(1)) || 5)),
        worryCount: taggedWorries.length,
      });
      await user.save();
    } catch (dbErr) {
      // DB errors are non-fatal here – the AI result is still valid
      console.warn('[ForgeCtrl] DB save failed (non-fatal):', dbErr.message);
    }
  }

  res.json({
    success: true,
    count: taggedWorries.length,
    worries: taggedWorries,
  });
};

// ── POST /api/forge/destroy ──────────────────────────────────────────────────
//
// Called when user drags a worry block into the Fireplace sensor.
// Updates the worry status in DB to 'destroyed'.
// This is the primary cathartic UX action – fire effect is on frontend.

export const destroyWorryHandler = async (req, res) => {
  const { userId, worryId } = req.body;

  if (!userId || !worryId) {
    throw new AppError('userId and worryId are required.', 400);
  }

  const user = await UserState.findOne({ userId });
  if (!user) {
    // Not a hard error – user may not have been persisted (no-auth guest mode)
    return res.json({ success: true, message: 'Worry destroyed (no record found).' });
  }

  const worry = user.vaultedWorries.id(worryId) ||
    user.vaultedWorries.find((w) => w.id === worryId);

  if (worry) {
    worry.status = 'destroyed';
    worry.resolvedAt = new Date();
    await user.save();
  }

  res.json({
    success: true,
    message: 'Worry destroyed. Let it go.',
    worryId,
  });
};

// ── POST /api/forge/vault ────────────────────────────────────────────────────
//
// Called when user SAVES a worry for later (alternative to destroying).
// Updates the worry status to 'vaulted'.

export const vaultWorryHandler = async (req, res) => {
  const { userId, worryId, worry, weight } = req.body;

  if (!userId) {
    throw new AppError('userId is required.', 400);
  }

  const user = await UserState.findOrCreate(userId);

  // If the worry already exists (from extract step), update it
  const existing = user.vaultedWorries.find((w) => w.id === worryId);
  if (existing) {
    existing.status = 'vaulted';
  } else if (worry) {
    // Fresh vault (user typed a worry directly without extracting)
    user.vaultedWorries.push({
      id: worryId || uuidv4(),
      worry: worry.slice(0, 500),
      weight: Math.min(10, Math.max(1, Number(weight) || 5)),
      status: 'vaulted',
    });
  }

  await user.save();

  res.json({
    success: true,
    message: 'Worry saved to your vault.',
  });
};

// ── GET /api/forge/vault/:userId ─────────────────────────────────────────────
//
// Returns all vaulted (saved) worries for a user.
// Frontend can display these in a "reflection" view.

export const getVaultHandler = async (req, res) => {
  const { userId } = req.params;

  if (!userId) {
    throw new AppError('userId param is required.', 400);
  }

  const user = await UserState.findOne({ userId }).lean();

  if (!user) {
    return res.json({ success: true, vault: [] });
  }

  const vault = (user.vaultedWorries || [])
    .filter((w) => w.status === 'vaulted')
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  res.json({
    success: true,
    count: vault.length,
    vault,
  });
};

// ── DELETE /api/forge/vault/:userId/:worryId ─────────────────────────────────

export const deleteVaultedWorryHandler = async (req, res) => {
  const { userId, worryId } = req.params;

  const user = await UserState.findOne({ userId });
  if (!user) {
    throw new AppError('User not found.', 404);
  }

  user.vaultedWorries = user.vaultedWorries.filter((w) => w.id !== worryId);
  await user.save();

  res.json({ success: true, message: 'Removed from vault.' });
};
