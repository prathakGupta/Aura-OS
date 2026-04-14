// src/models/AlertLog.js  🌟 NEW
// Tracks every clinical alert sent to a guardian.
// Used by the Observer Portal to display the triage history log.

import mongoose from "mongoose";

const AlertLogSchema = new mongoose.Schema(
  {
    userId:       { type: String, required: true, index: true },
    guardianPhone:{ type: String },
    guardianEmail:{ type: String },
    channel:      { type: String, enum: ["whatsapp", "sms", "email", "mock"], default: "mock" },
    riskLevel:    { type: String, enum: ["pre-burnout", "acute-distress", "watch"], default: "pre-burnout" },
    triggerReason:{ type: String, maxlength: 400 },  // human-readable reason
    briefText:    { type: String, maxlength: 3000 },  // the full medical brief sent
    deliveryStatus:{ type: String, enum: ["sent", "failed", "mock"], default: "mock" },
    twilioSid:    { type: String },                   // Twilio message SID for tracking
    sentAt:       { type: Date, default: Date.now },
  },
  { timestamps: true }
);

AlertLogSchema.index({ userId: 1, sentAt: -1 });

const AlertLog = mongoose.model("AlertLog", AlertLogSchema);
export default AlertLog;