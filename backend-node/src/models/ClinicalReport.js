// src/models/ClinicalReport.js — v2.0
// Added GameSession sub-schema to capture therapeutic activity telemetry.

import mongoose from 'mongoose';

const ReportWorrySchema = new mongoose.Schema(
  { id:{type:String,default:''}, text:{type:String,default:'',maxlength:500}, weight:{type:Number,min:1,max:10,default:5}, status:{type:String,enum:['active','destroyed','vaulted'],default:'active'} },
  { _id:false }
);

const ReportQuestSchema = new mongoose.Schema(
  { order:{type:Number,min:1,default:1}, id:{type:String,default:''}, action:{type:String,default:'',maxlength:400}, tip:{type:String,default:'',maxlength:300}, duration_minutes:{type:Number,min:1,max:30,default:2}, completed:{type:Boolean,default:false} },
  { _id:false }
);

// ── NEW: Predicted effects from game interaction analysis ──────────────────
const PredictedEffectsSchema = new mongoose.Schema(
  {
    stressReduction:    { type:Number, min:0, max:10, default:0 },
    dopamineActivation: { type:Number, min:0, max:10, default:0 },
    focusScore:         { type:Number, min:0, max:10, default:0 },
    arousalLevel:       { type:String, enum:['low','moderate','high'], default:'moderate' },
    clinicalNote:       { type:String, maxlength:600, default:'' },
  },
  { _id:false }
);

// ── NEW: Per-game session telemetry ────────────────────────────────────────
const GameSessionSchema = new mongoose.Schema(
  {
    gameId:           { type:String, maxlength:60, required:true },
    gameName:         { type:String, maxlength:80, default:'' },
    durationSeconds:  { type:Number, min:0, default:0 },
    interactions:     { type:Number, min:0, default:0 },
    avgReactionMs:    { type:Number, min:0, default:0 },
    accuracy:         { type:Number, min:0, max:100, default:100 },
    score:            { type:Number, min:0, default:0 },
    completedAt:      { type:Date, default:Date.now },
    predictedEffects: { type:PredictedEffectsSchema, default:() => ({}) },
  },
  { _id:false }
);

const DeliveryStatusSchema = new mongoose.Schema(
  { attempted:{type:Boolean,default:false}, status:{type:String,enum:['sent','failed','mock','skipped'],default:'skipped'}, sid:{type:String,default:null}, error:{type:String,default:null} },
  { _id:false }
);

const ClinicalReportSchema = new mongoose.Schema(
  {
    userId:              { type:String, required:true, index:true },
    source:              { type:String, enum:['panic','manual','auto'], default:'manual' },
    currentTask:         { type:String, default:'', maxlength:500 },
    selectedBlocker:     { type:String, default:'', maxlength:200 },
    vocalArousalScore:   { type:Number, min:1, max:10, default:5 },
    initialAnxietyQuery: { type:String, default:'', maxlength:3000 },
    aiStressSummary:     { type:String, default:'', maxlength:2500 },
    riskLevel:           { type:String, enum:['watch','pre-burnout','acute-distress'], default:'watch' },
    shatteredWorryBlocks:{ type:[ReportWorrySchema],  default:[] },
    timelineMicroquests: { type:[ReportQuestSchema],  default:[] },
    gameSessions:        { type:[GameSessionSchema],  default:[] },   // 🆕 game telemetry
    guardian:            {
      name:     { type:String, default:'' },
      email:    { type:String, default:'' },
      phone:    { type:String, default:'' },
      relation: { type:String, default:'' },
    },
    delivery: {
      whatsapp: { type:DeliveryStatusSchema, default:() => ({}) },
      email:    { type:DeliveryStatusSchema, default:() => ({}) },
    },
    meta: {
      notes:       { type:String, default:'', maxlength:1000 },
      generatedAt: { type:Date, default:Date.now },
      pdfDownloads:{ type:Number, default:0 },
      gameSessions:{ type:[GameSessionSchema], default:[] },  // backup copy
    },
  },
  { timestamps:true }
);

ClinicalReportSchema.index({ userId:1, createdAt:-1 });

const ClinicalReport = mongoose.model('ClinicalReport', ClinicalReportSchema);
export default ClinicalReport;