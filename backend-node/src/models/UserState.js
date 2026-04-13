// src/models/UserState.js
// Mongoose schema — extended with Guardian link + Clinical Telemetry
// All new clinical fields are ADDITIVE — existing fields untouched.

import mongoose from 'mongoose';

/* ── Sub-schemas ───────────────────────────────────────────── */

const WorrySchema = new mongoose.Schema({
  id:        { type: String, required: true },
  worry:     { type: String, required: true, maxlength: 500 },
  weight:    { type: Number, min: 1, max: 10, default: 5 },
  status:    { type: String, enum: ['active', 'destroyed', 'vaulted'], default: 'active' },
  createdAt: { type: Date, default: Date.now },
  resolvedAt:{ type: Date, default: null },
});

const MicroQuestSchema = new mongoose.Schema({
  id:                { type: Number, required: true },
  action:            { type: String, required: true, maxlength: 300 },
  tip:               { type: String, maxlength: 300 },
  duration_minutes:  { type: Number, default: 2 },
  completed:         { type: Boolean, default: false },
  completedAt:       { type: Date, default: null },
});

const TaskSchema = new mongoose.Schema({
  id:              { type: String, required: true },
  originalTask:    { type: String, required: true, maxlength: 500 },
  blocker:         { type: String, maxlength: 200 },           // 🌟 NEW: coach blocker
  coachMessage:    { type: String, maxlength: 600 },           // 🌟 NEW: AI coach message
  envStrategy:     { type: String, maxlength: 50 },            // 🌟 NEW: brown_noise etc.
  microquests:     [MicroQuestSchema],
  status:          { type: String, enum: ['active', 'completed', 'abandoned'], default: 'active' },
  questsCompleted: { type: Number, default: 0 },
  totalQuests:     { type: Number, default: 0 },
  createdAt:       { type: Date, default: Date.now },
  completedAt:     { type: Date, default: null },
});

/* ── 🌟 NEW: Guardian schema ───────────────────────────────── */
const GuardianSchema = new mongoose.Schema({
  name:              { type: String, maxlength: 120 },
  email:             { type: String, maxlength: 200 },
  phone:             { type: String, maxlength: 20 },   // E.164 format: +919876543210
  relation:          { type: String, maxlength: 60 },   // "parent", "therapist", "counselor"
  alertPreference:   { type: String, enum: ['whatsapp', 'sms', 'email', 'none'], default: 'whatsapp' },
  reportFrequency:   { type: String, enum: ['instant', 'daily', 'weekly'], default: 'instant' },
  linkedAt:          { type: Date, default: Date.now },
}, { _id: false });

/* ── 🌟 NEW: Clinical Telemetry sub-schemas ────────────────── */

const VocalStressEventSchema = new mongoose.Schema({
  timestamp:     { type: Date, default: Date.now },
  emotion:       { type: String, enum: ['calm', 'mild_anxiety', 'high_anxiety'], default: 'calm' },
  arousalScore:  { type: Number, min: 1, max: 10, default: 5 }, // 1 = calm, 10 = acute distress
  taskContext:   { type: String, maxlength: 200 },               // what was the user doing
}, { _id: false });

const ForgeSessionSchema = new mongoose.Schema({
  timestamp:     { type: Date, default: Date.now },
  wordCount:     { type: Number, default: 0 },
  worryDensity:  { type: Number, min: 1, max: 10, default: 5 },  // avg weight of extracted worries
  worryCount:    { type: Number, default: 0 },
}, { _id: false });

const ExecutiveFunctionEventSchema = new mongoose.Schema({
  timestamp:     { type: Date, default: Date.now },
  taskId:        { type: String },
  taskSummary:   { type: String, maxlength: 200 },
  status:        { type: String, enum: ['completed', 'abandoned'], default: 'completed' },
  blocker:       { type: String, maxlength: 200 },
}, { _id: false });

const StressSpikeSchema = new mongoose.Schema({
  timestamp:     { type: Date, default: Date.now },
  trigger:       { type: String, maxlength: 300 },  // what caused the spike
  vocalArousal:  { type: Number, min: 1, max: 10 },
  emotion:       { type: String, maxlength: 50 },
  blocker:       { type: String, maxlength: 200 },
  alertSent:     { type: Boolean, default: false },
  alertChannel:  { type: String, maxlength: 20 },   // 'whatsapp', 'sms', 'email'
  briefSummary:  { type: String, maxlength: 1000 }, // first 1000 chars of generated brief
}, { _id: false });

const ClinicalTelemetrySchema = new mongoose.Schema({
  vocalStressEvents:      { type: [VocalStressEventSchema],       default: [] },
  forgeSessions:          { type: [ForgeSessionSchema],           default: [] },
  executiveFunction:      { type: [ExecutiveFunctionEventSchema], default: [] },
  stressSpikes:           { type: [StressSpikeSchema],            default: [] },
  // 🌟 NEW: Set once from MentalHealthIntake; consumed by LangChain Guardian Clinical Report.
  // Scale: 1 = calm baseline, 10 = acute distress.
  baselineArousalScore:   { type: Number, min: 1, max: 10, default: null },
  baselineArousalSetAt:   { type: Date,   default: null },
  baselineProfile:        { type: mongoose.Schema.Types.Mixed, default: {} },
  // PerceptionProbe bistable illusion sessions — measures cognitive flexibility
  // Each entry: { imageId, firstSeen, latencyMs, canSwitchPerspective, recordedAt }
  probeData:              [{ type: mongoose.Schema.Types.Mixed, default: {} }],
}, { _id: false });

/* ── Root schema ───────────────────────────────────────────── */

const UserStateSchema = new mongoose.Schema(
  {
    userId:           { type: String, required: true, unique: true, index: true },
    vaultedWorries:   [WorrySchema],
    taskHistory:      [TaskSchema],
    sessionsCount:    { type: Number, default: 0 },
    lastActive:       { type: Date, default: Date.now },
    // 🌟 NEW: Guardian & Clinical layers
    guardian:         { type: GuardianSchema, default: () => ({}) },
    clinicalTelemetry:{ type: ClinicalTelemetrySchema, default: () => ({}) },
  },
  { timestamps: true }
);

/* ── Middleware & Statics ──────────────────────────────────── */

UserStateSchema.pre('save', function (next) {
  this.lastActive = new Date();
  next();
});

UserStateSchema.statics.findOrCreate = async function (userId) {
  let user = await this.findOne({ userId });
  if (!user) {
    user = await this.create({ userId, sessionsCount: 1 });
  } else {
    user.sessionsCount += 1;
    user.lastActive = new Date();
    await user.save();
  }
  return user;
};

// 🌟 NEW: Convenience helper — push a vocal stress event
UserStateSchema.methods.logVocalStress = async function ({ emotion, arousalScore, taskContext }) {
  this.clinicalTelemetry.vocalStressEvents.push({ emotion, arousalScore, taskContext });
  // Keep rolling 90-day window
  const cutoff = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
  this.clinicalTelemetry.vocalStressEvents =
    this.clinicalTelemetry.vocalStressEvents.filter(e => e.timestamp > cutoff);
  return this.save();
};

// 🌟 NEW: Push a forge session event
UserStateSchema.methods.logForgeSession = async function ({ wordCount, worryDensity, worryCount }) {
  this.clinicalTelemetry.forgeSessions.push({ wordCount, worryDensity, worryCount });
  return this.save();
};

// 🌟 NEW: Push an executive function event
UserStateSchema.methods.logExecFunction = async function ({ taskId, taskSummary, status, blocker }) {
  this.clinicalTelemetry.executiveFunction.push({ taskId, taskSummary, status, blocker });
  return this.save();
};

const UserState = mongoose.model('UserState', UserStateSchema);
export default UserState;