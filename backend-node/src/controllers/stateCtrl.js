// src/controllers/stateCtrl.js
// General user state management.
//
// Routes handled:
//   POST /api/state/init       → Initialize or refresh a user session
//   GET  /api/state/:userId    → Get full user state (dashboard data)
//   DELETE /api/state/:userId  → Wipe user data (GDPR / reset)

import { v4 as uuidv4 } from 'uuid';
import UserState from '../models/UserState.js';
import { AppError } from '../middleware/errorHandler.js';

// ── POST /api/state/init ─────────────────────────────────────────────────────
//
// Frontend calls this on first load.
// If no userId in localStorage → generates a new one.
// If userId exists → refreshes session counter + lastActive.
// Returns the userId so frontend can persist it.

export const initSessionHandler = async (req, res) => {
  const { userId: providedId } = req.body;

  // Generate a new userId if none provided
  const userId = providedId && typeof providedId === 'string'
    ? providedId.trim()
    : uuidv4();

  const user = await UserState.findOrCreate(userId);

  res.json({
    success: true,
    userId,
    sessionsCount: user.sessionsCount,
    isReturning: user.sessionsCount > 1,
    lastActive: user.lastActive,
  });
};

// ── GET /api/state/:userId ───────────────────────────────────────────────────
//
// Returns a summary of the user's overall state.
// Used by the frontend dashboard / home screen.

export const getStateHandler = async (req, res) => {
  const { userId } = req.params;

  if (!userId) {
    throw new AppError('userId is required.', 400);
  }

  const user = await UserState.findOne({ userId }).lean();

  if (!user) {
    return res.json({
      success: true,
      exists: false,
      stats: { worriesDestroyed: 0, tasksCompleted: 0, totalSessions: 0 },
    });
  }

  const worriesDestroyed = (user.vaultedWorries || []).filter(
    (w) => w.status === 'destroyed'
  ).length;

  const tasksCompleted = (user.taskHistory || []).filter(
    (t) => t.status === 'completed'
  ).length;

  const activeTask = (user.taskHistory || []).find((t) => t.status === 'active');

  res.json({
    success: true,
    exists: true,
    userId,
    lastActive: user.lastActive,
    stats: {
      worriesDestroyed,
      tasksCompleted,
      totalSessions: user.sessionsCount,
    },
    activeTask: activeTask
      ? {
          id: activeTask.id,
          originalTask: activeTask.originalTask,
          progress: Math.round(
            (activeTask.questsCompleted / activeTask.totalQuests) * 100
          ),
          currentQuest: activeTask.microquests.find((q) => !q.completed) || null,
        }
      : null,
  });
};

// ── DELETE /api/state/:userId ────────────────────────────────────────────────
//
// Full data wipe. For the hackathon demo reset button.

export const wipeStateHandler = async (req, res) => {
  const { userId } = req.params;

  if (!userId) {
    throw new AppError('userId is required.', 400);
  }

  await UserState.deleteOne({ userId });

  res.json({
    success: true,
    message: 'User state wiped. Fresh start.',
  });
};

// ── PATCH /api/state/:userId/intake ─────────────────────────────────────────
//
// Called by the frontend immediately after the MentalHealthIntake completes.
// Persists `baselineArousalScore` (1-10) to clinicalTelemetry so the
// LangChain Guardian Clinical Report service can read it at report generation time.

export const patchIntakeHandler = async (req, res) => {
  const { userId } = req.params;
  const { baselineArousalScore } = req.body;

  if (!userId) throw new AppError('userId is required.', 400);

  const score = Number(baselineArousalScore);
  if (!Number.isFinite(score) || score < 1 || score > 10) {
    throw new AppError('baselineArousalScore must be a number between 1 and 10.', 400);
  }

  await UserState.findOneAndUpdate(
    { userId },
    {
      $set: {
        'clinicalTelemetry.baselineArousalScore': score,
        'clinicalTelemetry.baselineArousalSetAt': new Date(),
      },
    },
    { upsert: true, new: true }
  );

  res.json({ success: true, baselineArousalScore: score });
};