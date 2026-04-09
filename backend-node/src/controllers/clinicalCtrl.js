// src/controllers/clinicalCtrl.js  🌟 NEW
// Handles all clinical / observer-portal API calls.
//
// Routes:
//   POST /api/clinical/trigger-alert    — Panic trigger from TaskShatter
//   POST /api/clinical/vocal-stress     — Logged by Python backend after each session
//   POST /api/clinical/guardian         — Set / update guardian contact
//   GET  /api/clinical/dashboard/:userId— Aggregated recharts-ready data
//   POST /api/clinical/therapy-brief    — Generate 14-day clinical PDF brief

import UserState   from '../models/UserState.js';
import AlertLog    from '../models/AlertLog.js';
import ClinicalReport from '../models/ClinicalReport.js';
import { generateGuardianBrief } from '../services/langchain.js';
import { sendGuardianAlert }     from '../services/twilio.js';
import { sendGuardianReportEmail } from '../services/email.js';
import { buildClinicalReportPdfBuffer } from '../services/reportPdf.js';
import { evaluateBurnoutRisk }   from '../services/triageEngine.js';
import { AppError }              from '../middleware/errorHandler.js';

const toSafeString = (v, max = 300) => String(v || '').trim().slice(0, max);

const normalizeWorryBlocks = (payloadBlocks = [], dbWorries = []) => {
  const fromPayload = Array.isArray(payloadBlocks)
    ? payloadBlocks
        .map((w) => ({
          id: toSafeString(w.id || w.uuid, 80),
          text: toSafeString(w.text || w.worry, 500),
          weight: Math.min(10, Math.max(1, Number(w.weight) || 5)),
          status: ['active', 'destroyed', 'vaulted'].includes(w.status) ? w.status : 'active',
        }))
        .filter((w) => w.text)
    : [];

  if (fromPayload.length) return fromPayload;

  return (Array.isArray(dbWorries) ? dbWorries : [])
    .map((w) => ({
      id: toSafeString(w.id, 80),
      text: toSafeString(w.worry, 500),
      weight: Math.min(10, Math.max(1, Number(w.weight) || 5)),
      status: ['active', 'destroyed', 'vaulted'].includes(w.status) ? w.status : 'active',
    }))
    .filter((w) => w.text);
};

const normalizeTimeline = (payloadTimeline = [], activeTask = null) => {
  const fromPayload = Array.isArray(payloadTimeline)
    ? payloadTimeline
        .map((q, idx) => ({
          order: Number(q.order) || idx + 1,
          id: toSafeString(q.id, 80) || String(idx + 1),
          action: toSafeString(q.action || q.text, 400),
          tip: toSafeString(q.tip, 300),
          duration_minutes: Math.min(30, Math.max(1, Number(q.duration_minutes) || 2)),
          completed: Boolean(q.completed),
        }))
        .filter((q) => q.action)
        .sort((a, b) => a.order - b.order)
    : [];

  if (fromPayload.length) return fromPayload;

  if (!activeTask?.microquests?.length) return [];

  return activeTask.microquests.map((q, idx) => ({
    order: idx + 1,
    id: toSafeString(q.id, 80) || String(idx + 1),
    action: toSafeString(q.action || q.text, 400),
    tip: toSafeString(q.tip, 300),
    duration_minutes: Math.min(30, Math.max(1, Number(q.duration_minutes) || 2)),
    completed: Boolean(q.completed),
  }));
};

const buildPublicReportUrl = (req, reportId) => {
  const base =
    process.env.REPORT_PUBLIC_BASE_URL
    || `${req.protocol}://${req.get('host')}`;
  return `${base}/api/clinical/session-report/${reportId}/pdf`;
};

const deliveryStatusFromResult = (result) => {
  if (!result) return { attempted: false, status: 'skipped', sid: null, error: null };
  if (result.skipped) return { attempted: false, status: 'skipped', sid: null, error: result.error || null };
  if (result.mock) return { attempted: true, status: 'mock', sid: result.sid || null, error: null };
  if (result.success) return { attempted: true, status: 'sent', sid: result.sid || result.messageId || null, error: null };
  return { attempted: true, status: 'failed', sid: null, error: result.error || 'Delivery failed' };
};

// ── POST /api/clinical/trigger-alert ─────────────────────────────────────────
// Called when the user selects "Too overwhelming" in the Initiation Coach.
// Simultaneously: generates brief → sends Twilio → logs telemetry spike.
export const triggerAlertHandler = async (req, res, next) => {
  try {
    const {
      userId,
      taskSummary,
      currentTask,
      blocker,
      selectedBlocker,
      vocalArousal,
      vocalArousalScore,
      emotion,
      recentHistory,
      guardianPhone,
      guardianName,
      guardianRelation,
      alertPreference,
    } = req.body;

    if (!userId) throw new AppError('userId is required.', 400);

    const resolvedTaskSummary = String(taskSummary || currentTask || 'an overwhelming task').trim();
    const resolvedBlocker = String(blocker || selectedBlocker || 'too_overwhelming').trim();
    const parsedArousal = Number(vocalArousal ?? vocalArousalScore);
    const resolvedArousal = Number.isFinite(parsedArousal)
      ? Math.min(10, Math.max(1, parsedArousal))
      : 8;
    const resolvedEmotion = emotion
      || (resolvedArousal >= 8 ? 'high_anxiety' : resolvedArousal >= 5 ? 'mild_anxiety' : 'calm');

    const user = await UserState.findOrCreate(userId);

    if (guardianPhone || guardianName || guardianRelation || alertPreference) {
      user.guardian = {
        ...(user.guardian?.toObject?.() || user.guardian || {}),
        ...(guardianPhone ? { phone: guardianPhone } : {}),
        ...(guardianName ? { name: guardianName } : {}),
        ...(guardianRelation ? { relation: guardianRelation } : {}),
        ...(alertPreference ? { alertPreference } : {}),
        linkedAt: user.guardian?.linkedAt || new Date(),
      };
    }

    const telemetry = user.clinicalTelemetry || {};
    const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const recentExecEvents = (telemetry.executiveFunction || []).filter((e) => new Date(e.timestamp) > dayAgo);
    const tasksAbandonedToday = recentExecEvents.filter((e) => e.status === 'abandoned').length;
    const recentForgeCount = (telemetry.forgeSessions || []).filter((e) => new Date(e.timestamp) > dayAgo).length;

    const recentExecSummary = recentExecEvents
      .slice(-8)
      .map((e) => `${e.status} "${e.taskSummary || 'task'}"`)
      .join(', ');

    const payloadHistory = (recentHistory && typeof recentHistory === 'object') ? recentHistory : null;
    const payloadHistoryParts = [];
    if (payloadHistory?.tasksAbandonedToday !== undefined)
      payloadHistoryParts.push(`Frontend signal: ${payloadHistory.tasksAbandonedToday} tasks abandoned today.`);
    if (payloadHistory?.forgeUsage)
      payloadHistoryParts.push(`Frontend forge usage: ${payloadHistory.forgeUsage}.`);
    if (payloadHistory?.selectedBlockerLabel)
      payloadHistoryParts.push(`Frontend blocker label: ${payloadHistory.selectedBlockerLabel}.`);

    const recentPattern = [
      `Past 24h telemetry: ${tasksAbandonedToday} abandoned tasks, ${recentForgeCount} forge sessions.`,
      recentExecSummary ? `Recent executive events: ${recentExecSummary}.` : 'No recent task history.',
      ...payloadHistoryParts,
    ].join(' ');

    let brief;
    try {
      brief = await generateGuardianBrief({
        userName: userId,
        taskSummary: resolvedTaskSummary || 'an overwhelming task',
        blocker: resolvedBlocker || 'too_overwhelming',
        vocalArousal: resolvedArousal,
        emotion: resolvedEmotion,
        auraAction: 'Somatic interruption (5-second breathing exercise) deployed. Brown noise environment activated.',
        recentPatterns: recentPattern,
      });
    } catch (aiErr) {
      console.warn('[Clinical] LangChain brief generation failed, using fallback.', aiErr.message);
      brief = {
        subject: 'AuraOS Alert - Stress Spike Detected',
        analogy: 'A computer that has frozen because too many programmes tried to run at once.',
        vocal_analysis: `Vocal arousal detected at ${resolvedArousal}/10 - significantly elevated.`,
        observed_pattern: `The user attempted "${resolvedTaskSummary}" but reported acute overwhelm. This is consistent with executive dysfunction freeze.`,
        aura_action_taken: 'A breathing exercise was deployed and a calming audio environment was activated.',
        parent_action: 'Do not ask about the task for at least 20 minutes. Offer water and a brief walk. Use the phrase: "I see you are working really hard. Let\'s take a break together."',
        risk_level: 'pre-burnout',
      };
    }

    user.clinicalTelemetry.stressSpikes.push({
      trigger: resolvedTaskSummary || 'unknown task',
      vocalArousal: resolvedArousal,
      emotion: resolvedEmotion,
      blocker: resolvedBlocker,
      briefSummary: brief.observed_pattern?.slice(0, 1000),
    });
    await user.save();

    const resolvedGuardianPhone = guardianPhone || user.guardian?.phone;
    const channel = alertPreference || user.guardian?.alertPreference || 'whatsapp';
    const deliveryResult = await sendGuardianAlert({
      brief,
      userName: userId,
      guardianPhone: resolvedGuardianPhone,
      channel,
    });

    const lastSpike = user.clinicalTelemetry.stressSpikes[user.clinicalTelemetry.stressSpikes.length - 1];
    if (lastSpike) {
      lastSpike.alertSent = deliveryResult.success;
      lastSpike.alertChannel = deliveryResult.channel;
      await user.save();
    }

    await AlertLog.create({
      userId,
      guardianPhone: resolvedGuardianPhone || null,
      channel: deliveryResult.channel,
      riskLevel: brief.risk_level,
      triggerReason: `${resolvedBlocker} during "${resolvedTaskSummary}"`,
      briefText: [brief.observed_pattern, brief.parent_action].join('\n\n').slice(0, 3000),
      deliveryStatus: deliveryResult.mock ? 'mock' : (deliveryResult.success ? 'sent' : 'failed'),
      twilioSid: deliveryResult.sid || null,
    });

    res.json({
      success: true,
      briefGenerated: true,
      alertSent: deliveryResult.success,
      channel: deliveryResult.channel,
      riskLevel: brief.risk_level,
      guardianConfigured: Boolean(resolvedGuardianPhone),
      coachFeedback: brief.analogy,
    });
  } catch (err) {
    next(err);
  }
};

// ── POST /api/clinical/vocal-stress ──────────────────────────────────────────
// Called by Python backend (or Node proxy) after each Aura Voice session.
export const logVocalStressHandler = async (req, res, next) => {
  try {
    const { userId, emotion, arousalScore, taskContext } = req.body;
    if (!userId) throw new AppError('userId is required.', 400);

    const user = await UserState.findOrCreate(userId);
    user.clinicalTelemetry.vocalStressEvents.push({ emotion, arousalScore, taskContext });
    await user.save();

    // Background triage check (non-blocking)
    evaluateBurnoutRisk(userId).then(async (risk) => {
      if (risk.atRisk && risk.riskLevel === 'acute-distress') {
        // Auto-alert without user intervention for severe cases
        console.log(`[Triage] Auto-alert triggered for ${userId}: ${risk.riskLevel}`);
      }
    }).catch(() => {});

    res.json({ success: true });
  } catch (err) {
    next(err);
  }
};

// ── POST /api/clinical/guardian ───────────────────────────────────────────────
// Set or update the guardian contact for this user.
export const setGuardianHandler = async (req, res, next) => {
  try {
    const { userId, name, email, phone, relation, alertPreference, reportFrequency } = req.body;
    if (!userId) throw new AppError('userId is required.', 400);

    const user = await UserState.findOrCreate(userId);
    const normalizedPhone = phone ? String(phone).trim() : undefined;

    const nextGuardian = {
      ...(user.guardian?.toObject?.() || user.guardian || {}),
      ...(name !== undefined ? { name } : {}),
      ...(email !== undefined ? { email } : {}),
      ...(relation !== undefined ? { relation } : {}),
      ...(alertPreference !== undefined ? { alertPreference } : {}),
      ...(reportFrequency !== undefined ? { reportFrequency } : {}),
      ...(normalizedPhone !== undefined ? { phone: normalizedPhone } : {}),
      linkedAt: user.guardian?.linkedAt || new Date(),
    };

    if (
      (nextGuardian.alertPreference === 'whatsapp' || nextGuardian.alertPreference === 'sms')
      && !nextGuardian.phone
    ) {
      throw new AppError('phone is required when alertPreference is whatsapp or sms.', 400);
    }

    user.guardian = nextGuardian;
    await user.save();

    res.json({ success: true, guardian: user.guardian });
  } catch (err) {
    next(err);
  }
};

// ── GET /api/clinical/dashboard/:userId ───────────────────────────────────────
// Returns recharts-ready arrays for the Observer Portal.
export const getDashboardMetricsHandler = async (req, res, next) => {
  try {
    const { userId } = req.params;
    const { days = 7 } = req.query;
    if (!userId) throw new AppError('userId is required.', 400);

    const user = await UserState.findOne({ userId }).lean();
    if (!user) return res.json({ success: true, empty: true });

    const since    = new Date(Date.now() - Number(days) * 24 * 60 * 60 * 1000);
    const telemetry = user.clinicalTelemetry || {};

    // ── Vocal Stress Index (daily average) ──────────────────────────────────
    const vocalRaw  = (telemetry.vocalStressEvents || []).filter(e => new Date(e.timestamp) > since);
    const vsiByDay  = _groupByDay(vocalRaw, e => e.arousalScore || 5, 'vsi');

    // ── Executive Function Score (completion ratio per day) ─────────────────
    const execRaw   = (telemetry.executiveFunction || []).filter(e => new Date(e.timestamp) > since);
    const execByDay = _groupByDayRatio(execRaw, 'efScore');

    // ── Forge Sessions (worry density per session) ───────────────────────────
    const forgeRaw  = (telemetry.forgeSessions || []).filter(e => new Date(e.timestamp) > since);
    const forgeByDay= _groupByDay(forgeRaw, e => e.worryDensity || 5, 'density');

    // ── Recent alert log ─────────────────────────────────────────────────────
    const alerts = await AlertLog.find({ userId }).sort({ sentAt: -1 }).limit(10).lean();

    // ── Summary stats ────────────────────────────────────────────────────────
    const stats = {
      tasksCompleted:  execRaw.filter(e => e.status === 'completed').length,
      tasksAbandoned:  execRaw.filter(e => e.status === 'abandoned').length,
      forgeSessions:   forgeRaw.length,
      avgVocalArousal: vocalRaw.length ? +(vocalRaw.reduce((s,e) => s + (e.arousalScore||5), 0) / vocalRaw.length).toFixed(1) : 0,
      stressSpikes:    (telemetry.stressSpikes || []).filter(e => new Date(e.timestamp) > since).length,
    };

    res.json({
      success: true,
      userId,
      guardian: user.guardian || {},
      charts: { vsiByDay, execByDay, forgeByDay },
      stats,
      recentAlerts: alerts,
    });
  } catch (err) {
    next(err);
  }
};

// ── POST /api/clinical/therapy-brief ─────────────────────────────────────────
// Generates a 14-day summary clinical brief using LangChain.
export const generateTherapyBriefHandler = async (req, res, next) => {
  try {
    const { userId } = req.body;
    if (!userId) throw new AppError('userId is required.', 400);

    const user = await UserState.findOne({ userId }).lean();
    if (!user) throw new AppError('User not found.', 404);

    const since     = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
    const telemetry = user.clinicalTelemetry || {};

    const vocalEvents = (telemetry.vocalStressEvents || []).filter(e => new Date(e.timestamp) > since);
    const execEvents  = (telemetry.executiveFunction || []).filter(e => new Date(e.timestamp) > since);
    const forgeEvents = (telemetry.forgeSessions || []).filter(e => new Date(e.timestamp) > since);
    const spikes      = (telemetry.stressSpikes || []).filter(e => new Date(e.timestamp) > since);

    const highArousalSessions = vocalEvents.filter(e => (e.arousalScore || 0) >= 7);
    const avgArousal = vocalEvents.length
      ? (vocalEvents.reduce((s,e) => s+(e.arousalScore||5),0)/vocalEvents.length).toFixed(1)
      : 'N/A';

    const abandoned = execEvents.filter(e => e.status === 'abandoned');
    const completed = execEvents.filter(e => e.status === 'completed');

    const brief = await generateGuardianBrief({
      userName:       userId,
      taskSummary:    `14-day clinical review (${execEvents.length} task interactions)`,
      blocker:        abandoned.length > completed.length ? 'chronic task paralysis pattern' : 'intermittent executive function challenges',
      vocalArousal:   parseFloat(avgArousal) || 5,
      emotion:        highArousalSessions.length > 3 ? 'high_anxiety' : 'mild_anxiety',
      auraAction:     `Over 14 days: ${forgeEvents.length} Cognitive Forge sessions, ${spikes.length} stress spikes detected.`,
      recentPatterns: `${completed.length} tasks completed, ${abandoned.length} abandoned. Average vocal arousal: ${avgArousal}/10. ${forgeEvents.length} worry-offloading sessions. ${spikes.length} acute stress spikes.`,
    });

    res.json({
      success:    true,
      generatedAt: new Date().toISOString(),
      period:      '14 days',
      brief,
      rawStats: {
        vocalSessions:     vocalEvents.length,
        highArousal:       highArousalSessions.length,
        avgArousal,
        tasksCompleted:    completed.length,
        tasksAbandoned:    abandoned.length,
        forgeSessions:     forgeEvents.length,
        stressSpikes:      spikes.length,
      },
    });
  } catch (err) {
    next(err);
  }
};

// ── Helpers ───────────────────────────────────────────────────────────────────
// POST /api/clinical/session-report
// Generates a one-page session report PDF + optional guardian dispatch.
export const generateSessionReportHandler = async (req, res, next) => {
  try {
    const {
      userId,
      source = 'manual',
      taskId,
      currentTask,
      selectedBlocker,
      vocalArousalScore,
      initialAnxietyQuery,
      aiStressSummary,
      sendToGuardian = false,
      channels = { whatsapp: true, email: true },
      sessionSnapshot = {},
    } = req.body || {};

    if (!userId) throw new AppError('userId is required.', 400);

    const user = await UserState.findOrCreate(userId);
    const activeTask = taskId
      ? (user.taskHistory || []).find((t) => t.id === taskId)
      : (user.taskHistory || []).find((t) => t.status === 'active');

    const resolvedTask = toSafeString(
      currentTask || activeTask?.originalTask || sessionSnapshot?.currentTask || '',
      500
    );
    const resolvedBlocker = toSafeString(
      selectedBlocker || activeTask?.blocker || sessionSnapshot?.selectedBlocker || '',
      200
    );
    const resolvedArousal = Math.min(10, Math.max(1, Number(vocalArousalScore) || 5));

    let brief;
    if (aiStressSummary) {
      brief = {
        analogy: 'A system under sustained load and context switching.',
        vocal_analysis: `Vocal arousal estimate: ${resolvedArousal}/10.`,
        observed_pattern: toSafeString(aiStressSummary, 700),
        aura_action_taken: 'Supportive regulation prompts were provided inside AuraOS.',
        parent_action: 'Use short, calm check-ins and one-step prompts.',
        risk_level: resolvedArousal >= 8 ? 'acute-distress' : resolvedArousal >= 6 ? 'pre-burnout' : 'watch',
      };
    } else {
      try {
        brief = await generateGuardianBrief({
          userName: userId,
          taskSummary: resolvedTask || 'general stress event',
          blocker: resolvedBlocker || 'overwhelm',
          vocalArousal: resolvedArousal,
          emotion: resolvedArousal >= 8 ? 'high_anxiety' : 'mild_anxiety',
          auraAction: 'Somatic regulation and guided breakdown interventions were used.',
          recentPatterns: 'Session-level snapshot report requested by the user.',
        });
      } catch {
        brief = {
          analogy: 'A browser with too many active tabs.',
          vocal_analysis: `Vocal arousal estimate: ${resolvedArousal}/10.`,
          observed_pattern: 'The session indicates elevated cognitive load and executive friction.',
          aura_action_taken: 'AuraOS guided the user through supportive interruption and task decomposition.',
          parent_action: 'Reduce demands briefly, validate effort, then suggest one tiny next step.',
          risk_level: resolvedArousal >= 8 ? 'acute-distress' : resolvedArousal >= 6 ? 'pre-burnout' : 'watch',
        };
      }
    }

    const report = await ClinicalReport.create({
      userId,
      source: ['panic', 'manual', 'auto'].includes(source) ? source : 'manual',
      currentTask: resolvedTask,
      selectedBlocker: resolvedBlocker,
      vocalArousalScore: resolvedArousal,
      initialAnxietyQuery: toSafeString(initialAnxietyQuery || sessionSnapshot?.initialAnxietyQuery || '', 3000),
      aiStressSummary: toSafeString(brief.observed_pattern || aiStressSummary || '', 2500),
      riskLevel: ['watch', 'pre-burnout', 'acute-distress'].includes(brief.risk_level)
        ? brief.risk_level
        : 'watch',
      shatteredWorryBlocks: normalizeWorryBlocks(sessionSnapshot?.shatteredWorryBlocks, user.vaultedWorries || []),
      timelineMicroquests: normalizeTimeline(sessionSnapshot?.timelineMicroquests, activeTask || null),
      guardian: {
        name: toSafeString(user.guardian?.name, 120),
        email: toSafeString(user.guardian?.email, 200),
        phone: toSafeString(user.guardian?.phone, 30),
        relation: toSafeString(user.guardian?.relation, 80),
      },
      meta: {
        notes: toSafeString(sessionSnapshot?.notes, 1000),
        generatedAt: new Date(),
      },
    });

    const downloadUrl = buildPublicReportUrl(req, report._id.toString());
    const pdfBuffer = await buildClinicalReportPdfBuffer(report);

    let whatsappResult = { skipped: true, channel: 'whatsapp' };
    let emailResult = { skipped: true, channel: 'email' };

    if (sendToGuardian) {
      const guardianPhone = report.guardian?.phone || '';
      const guardianEmail = report.guardian?.email || '';

      const shouldWhatsApp = Boolean(channels?.whatsapp !== false);
      const shouldEmail = Boolean(channels?.email !== false);

      const mediaBase = process.env.TWILIO_MEDIA_PUBLIC_BASE_URL || process.env.REPORT_PUBLIC_BASE_URL || null;
      const mediaUrl = mediaBase
        ? `${mediaBase.replace(/\/$/, '')}/api/clinical/session-report/${report._id.toString()}/pdf`
        : null;

      const [waSettled, emailSettled] = await Promise.allSettled([
        shouldWhatsApp
          ? sendGuardianAlert({
              brief,
              userName: userId,
              guardianPhone,
              channel: user.guardian?.alertPreference || 'whatsapp',
              mediaUrl,
            })
          : Promise.resolve({ skipped: true, channel: 'whatsapp' }),
        shouldEmail
          ? sendGuardianReportEmail({
              to: guardianEmail,
              guardianName: report.guardian?.name,
              userId,
              riskLevel: report.riskLevel,
              reportId: report._id.toString(),
              summary: report.aiStressSummary,
              downloadUrl,
              pdfBuffer,
            })
          : Promise.resolve({ skipped: true, channel: 'email' }),
      ]);

      whatsappResult = waSettled.status === 'fulfilled'
        ? waSettled.value
        : { success: false, channel: 'whatsapp', error: waSettled.reason?.message || 'WhatsApp dispatch failed' };

      emailResult = emailSettled.status === 'fulfilled'
        ? emailSettled.value
        : { success: false, channel: 'email', error: emailSettled.reason?.message || 'Email dispatch failed' };

      await AlertLog.create({
        userId,
        guardianPhone: report.guardian?.phone || null,
        guardianEmail: report.guardian?.email || null,
        channel: whatsappResult.mock ? 'mock' : (whatsappResult.success ? 'whatsapp' : (emailResult.success ? 'email' : 'mock')),
        riskLevel: report.riskLevel,
        triggerReason: `${report.selectedBlocker || 'stress'} during "${report.currentTask || 'session'}"`,
        briefText: [brief.observed_pattern, brief.parent_action].join('\n\n').slice(0, 3000),
        deliveryStatus: whatsappResult.success || emailResult.success
          ? (whatsappResult.mock && emailResult.mock ? 'mock' : 'sent')
          : 'failed',
        twilioSid: whatsappResult.sid || null,
      });
    }

    report.delivery = {
      whatsapp: deliveryStatusFromResult(whatsappResult),
      email: deliveryStatusFromResult(emailResult),
    };
    await report.save();

    res.json({
      success: true,
      reportId: report._id.toString(),
      riskLevel: report.riskLevel,
      aiStressSummary: report.aiStressSummary,
      downloadUrl,
      delivery: report.delivery,
    });
  } catch (err) {
    next(err);
  }
};

// GET /api/clinical/session-report/:reportId/pdf
// Streams the generated report PDF for manual download.
export const downloadSessionReportPdfHandler = async (req, res, next) => {
  try {
    const { reportId } = req.params;
    if (!reportId) throw new AppError('reportId is required.', 400);

    const report = await ClinicalReport.findById(reportId).lean();
    if (!report) throw new AppError('Report not found.', 404);

    const pdfBuffer = await buildClinicalReportPdfBuffer(report);

    await ClinicalReport.updateOne(
      { _id: reportId },
      { $inc: { 'meta.pdfDownloads': 1 } }
    );

    const filename = `AuraOS-Clinical-Report-${report.userId || 'user'}-${reportId}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(pdfBuffer);
  } catch (err) {
    next(err);
  }
};
function _groupByDay(events, valueFn, key) {
  const map = {};
  events.forEach(e => {
    const day = new Date(e.timestamp).toISOString().split('T')[0];
    if (!map[day]) map[day] = { day, sum: 0, count: 0 };
    map[day].sum += valueFn(e);
    map[day].count += 1;
  });
  return Object.values(map)
    .map(d => ({ day: d.day, [key]: +(d.sum / d.count).toFixed(1) }))
    .sort((a, b) => a.day.localeCompare(b.day));
}

function _groupByDayRatio(events, key) {
  const map = {};
  events.forEach(e => {
    const day = new Date(e.timestamp).toISOString().split('T')[0];
    if (!map[day]) map[day] = { day, completed: 0, total: 0 };
    map[day].total += 1;
    if (e.status === 'completed') map[day].completed += 1;
  });
  return Object.values(map)
    .map(d => ({
      day: d.day,
      [key]: d.total ? +(d.completed / d.total * 100).toFixed(0) : 0,
    }))
    .sort((a, b) => a.day.localeCompare(b.day));
}
