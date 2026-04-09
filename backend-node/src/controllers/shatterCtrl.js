// src/controllers/shatterCtrl.js  🌟 UPDATED — accepts blocker, logs telemetry
import { v4 as uuidv4 } from 'uuid';
import { breakdownTask, coachBreakdown } from '../services/langchain.js';
import UserState from '../models/UserState.js';
import { AppError } from '../middleware/errorHandler.js';

// ── POST /api/shatter/breakdown ──────────────────────────────────────────────
// Accepts optional `blocker` field. If present, uses the Coach AI persona.
export const breakdownTaskHandler = async (req, res) => {
  const { task, userId, blocker } = req.body;

  if (!task || typeof task !== 'string' || task.trim().length < 3)
    throw new AppError('Please describe the task you want to break down.', 400);
  if (task.trim().length > 500)
    throw new AppError('Task description too long (max 500 chars).', 400);

  let microquests, coachMessage, envStrategy;

  if (blocker) {
    // 🌟 Coach-aware breakdown
    const coachResult = await coachBreakdown(task.trim(), blocker);
    microquests   = coachResult.microquests.map((q, i) => ({
      id:               i + 1,
      action:           q.text,
      tip:              q.tip,
      duration_minutes: q.duration_minutes,
      completed:        false,
    }));
    coachMessage = coachResult.coach_message;
    envStrategy  = coachResult.environment_strategy;
  } else {
    // Standard breakdown
    microquests = await breakdownTask(task.trim());
  }

  const taskId     = uuidv4();
  const taskRecord = {
    id:          taskId,
    originalTask:task.trim(),
    blocker:     blocker || null,
    coachMessage:coachMessage || null,
    envStrategy: envStrategy || null,
    microquests,
    status:      'active',
    questsCompleted: 0,
    totalQuests: microquests.length,
    createdAt:   new Date(),
  };

  if (userId) {
    try {
      const user = await UserState.findOrCreate(userId);
      user.taskHistory.forEach(t => { if (t.status === 'active') t.status = 'abandoned'; });
      user.taskHistory.push(taskRecord);
      await user.save();
    } catch (dbErr) {
      console.warn('[ShatterCtrl] DB save failed (non-fatal):', dbErr.message);
    }
  }

  res.status(201).json({
    success:      true,
    taskId,
    originalTask: task.trim(),
    totalQuests:  microquests.length,
    microquests,
    firstQuest:   microquests[0],
    // 🌟 NEW: Coach fields returned to frontend
    coachMessage: coachMessage || null,
    envStrategy:  envStrategy || null,
  });
};

// ── POST /api/shatter/complete ───────────────────────────────────────────────
export const completeQuestHandler = async (req, res) => {
  const { userId, taskId, questId } = req.body;
  if (!userId || !taskId || questId === undefined)
    throw new AppError('userId, taskId, and questId are required.', 400);

  const user = await UserState.findOne({ userId });
  if (!user) throw new AppError('User not found.', 404);

  const task = user.taskHistory.find(t => t.id === taskId);
  if (!task) throw new AppError('Task not found.', 404);

  const quest = task.microquests.find(q => q.id === questId);
  if (!quest) throw new AppError(`Quest ${questId} not found.`, 404);
  if (quest.completed) throw new AppError('Quest already completed.', 409);

  quest.completed  = true;
  quest.completedAt= new Date();
  task.questsCompleted = task.microquests.filter(q => q.completed).length;

  const allDone = task.questsCompleted === task.totalQuests;
  if (allDone) { task.status = 'completed'; task.completedAt = new Date(); }

  // 🌟 Log executive function event
  user.clinicalTelemetry.executiveFunction.push({
    taskId,
    taskSummary: task.originalTask.slice(0, 100),
    status:      'completed',
    blocker:     task.blocker,
  });

  await user.save();

  const nextQuest = task.microquests.find(q => !q.completed) || null;
  res.json({
    success:         true,
    questId,
    taskComplete:    allDone,
    questsCompleted: task.questsCompleted,
    totalQuests:     task.totalQuests,
    progress:        Math.round((task.questsCompleted / task.totalQuests) * 100),
    nextQuest,
    message:         allDone ? '🎉 Task fully shattered!' : `Quest ${questId} done.`,
  });
};

// ── POST /api/shatter/abandon ────────────────────────────────────────────────
export const abandonTaskHandler = async (req, res) => {
  const { userId, taskId } = req.body;
  if (!userId || !taskId) throw new AppError('userId and taskId are required.', 400);

  const user = await UserState.findOne({ userId });
  if (!user) return res.json({ success: true });

  const task = user.taskHistory.find(t => t.id === taskId);
  if (task && task.status === 'active') {
    task.status = 'abandoned';
    // 🌟 Log executive function abandonment
    user.clinicalTelemetry.executiveFunction.push({
      taskId,
      taskSummary: task.originalTask.slice(0, 100),
      status:      'abandoned',
      blocker:     task.blocker,
    });
    await user.save();
  }

  res.json({ success: true, message: "Task set aside. Come back when you're ready." });
};

// ── GET /api/shatter/active/:userId ─────────────────────────────────────────
export const getActiveTaskHandler = async (req, res) => {
  const { userId } = req.params;
  const user = await UserState.findOne({ userId }).lean();
  if (!user) return res.json({ success: true, activeTask: null });
  const activeTask = user.taskHistory.find(t => t.status === 'active') || null;
  res.json({ success: true, activeTask, currentQuest: activeTask?.microquests?.find(q => !q.completed) || null });
};

// ── GET /api/shatter/history/:userId ────────────────────────────────────────
export const getTaskHistoryHandler = async (req, res) => {
  const { userId } = req.params;
  const user = await UserState.findOne({ userId }).lean();
  if (!user) return res.json({ success: true, history: [], completedCount: 0 });
  const history = (user.taskHistory || []).filter(t => t.status !== 'active').sort((a,b) => new Date(b.createdAt)-new Date(a.createdAt)).slice(0,20);
  res.json({ success: true, completedCount: history.filter(t=>t.status==='completed').length, history });
};

// ── POST /api/shatter/sync-timeline ─────────────────────────────────────────
// Persists the exact user-arranged timeline order for reporting and continuity.
export const syncTimelineHandler = async (req, res) => {
  const { userId, taskId, timeline } = req.body;

  if (!userId || !taskId) {
    throw new AppError('userId and taskId are required.', 400);
  }
  if (!Array.isArray(timeline) || timeline.length === 0) {
    throw new AppError('timeline must be a non-empty array.', 400);
  }

  const user = await UserState.findOne({ userId });
  if (!user) throw new AppError('User not found.', 404);

  const task = user.taskHistory.find((t) => t.id === taskId);
  if (!task) throw new AppError('Task not found.', 404);

  const existingById = new Map(
    (task.microquests || []).map((q) => [String(q.id), q])
  );

  const normalized = timeline
    .map((q, idx) => {
      const existing = existingById.get(String(q.id)) || null;
      return {
        id: idx + 1,
        action: String(q.action || q.text || '').trim().slice(0, 300),
        tip: String(q.tip || existing?.tip || '').trim().slice(0, 300),
        duration_minutes: Math.min(10, Math.max(1, Number(q.duration_minutes || existing?.duration_minutes || 2))),
        completed: Boolean(existing?.completed),
        completedAt: existing?.completed ? existing.completedAt || new Date() : null,
      };
    })
    .filter((q) => q.action.length > 0);

  if (!normalized.length) {
    throw new AppError('timeline does not contain valid quest actions.', 400);
  }

  task.microquests = normalized;
  task.totalQuests = normalized.length;
  task.questsCompleted = normalized.filter((q) => q.completed).length;

  await user.save();

  res.json({
    success: true,
    taskId,
    totalQuests: task.totalQuests,
    questsCompleted: task.questsCompleted,
  });
};
