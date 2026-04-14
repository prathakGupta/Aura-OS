// src/services/triageEngine.js  🌟 NEW
// Background risk evaluator.
// Called after every forge session and task abandonment.
// Returns a risk object — the caller decides whether to trigger an alert.

import UserState from "../models/UserState.js";

const LOOKBACK_MS = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Evaluates a user's telemetry from the last 24 hours.
 * @returns {{ atRisk: boolean, riskLevel: string, reasons: string[], pattern: string }}
 */
export const evaluateBurnoutRisk = async (userId) => {
  const user = await UserState.findOne({ userId }).lean();
  if (!user) return { atRisk: false, riskLevel: "watch", reasons: [], pattern: "No user data found." };

  const since    = new Date(Date.now() - LOOKBACK_MS);
  const telemetry = user.clinicalTelemetry || {};

  // ── Executive function analysis ──────────────────────────────────────────
  const recentExec = (telemetry.executiveFunction || []).filter(e => new Date(e.timestamp) > since);
  const abandoned  = recentExec.filter(e => e.status === "abandoned").length;
  const completed  = recentExec.filter(e => e.status === "completed").length;

  // ── Vocal stress analysis ─────────────────────────────────────────────────
  const recentVocal = (telemetry.vocalStressEvents || []).filter(e => new Date(e.timestamp) > since);
  const avgArousal  = recentVocal.length
    ? recentVocal.reduce((s, e) => s + (e.arousalScore || 5), 0) / recentVocal.length
    : 0;
  const highArousalCount = recentVocal.filter(e => (e.arousalScore || 0) >= 7).length;

  // ── Forge / worry analysis ────────────────────────────────────────────────
  const recentForge  = (telemetry.forgeSessions || []).filter(e => new Date(e.timestamp) > since);
  const avgDensity   = recentForge.length
    ? recentForge.reduce((s, e) => s + (e.worryDensity || 5), 0) / recentForge.length
    : 0;

  // ── Spike history ─────────────────────────────────────────────────────────
  const recentSpikes = (telemetry.stressSpikes || []).filter(e => new Date(e.timestamp) > since);

  // ── Rule evaluation ───────────────────────────────────────────────────────
  const reasons = [];
  let score     = 0;

  if (abandoned >= 3) { reasons.push(`${abandoned} tasks abandoned in the last 24h`); score += 3; }
  else if (abandoned >= 2) { reasons.push(`${abandoned} tasks abandoned in the last 24h`); score += 2; }

  if (avgArousal >= 7)    { reasons.push(`Average vocal arousal ${avgArousal.toFixed(1)}/10 — elevated distress`); score += 3; }
  if (highArousalCount >= 2) { reasons.push(`${highArousalCount} high-arousal vocal events detected`); score += 2; }

  if (avgDensity >= 7)    { reasons.push(`Forge worry density averaging ${avgDensity.toFixed(1)}/10`); score += 2; }

  if (recentSpikes.length >= 2) { reasons.push(`${recentSpikes.length} stress spikes in the last 24h`); score += 2; }

  if (completed === 0 && abandoned >= 2) { reasons.push("No tasks completed vs multiple abandoned"); score += 1; }

  // ── Risk level ────────────────────────────────────────────────────────────
  let riskLevel = "watch";
  if (score >= 7)       riskLevel = "acute-distress";
  else if (score >= 4)  riskLevel = "pre-burnout";

  const atRisk = score >= 4;

  // ── Build human-readable pattern for the brief ───────────────────────────
  const pattern = atRisk
    ? `Over the last 24 hours, ${abandoned > 0 ? `the user abandoned ${abandoned} task${abandoned > 1 ? "s" : ""}, ` : ""}${highArousalCount > 0 ? `showed elevated vocal stress on ${highArousalCount} occasion${highArousalCount > 1 ? "s" : ""}, ` : ""}${recentForge.length > 0 ? `used the Cognitive Forge ${recentForge.length} time${recentForge.length > 1 ? "s" : ""} with high worry density` : ""}. This pattern is consistent with executive function fatigue.`.replace(/, $/, ".")
    : "Activity looks within normal range over the last 24 hours.";

  return { atRisk, riskLevel, score, reasons, pattern };
};