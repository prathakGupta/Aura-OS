import mongoose from 'mongoose';

const ReportWorrySchema = new mongoose.Schema(
  {
    id: { type: String, default: '' },
    text: { type: String, default: '', maxlength: 500 },
    weight: { type: Number, min: 1, max: 10, default: 5 },
    status: { type: String, enum: ['active', 'destroyed', 'vaulted'], default: 'active' },
  },
  { _id: false }
);

const ReportQuestSchema = new mongoose.Schema(
  {
    order: { type: Number, min: 1, default: 1 },
    id: { type: String, default: '' },
    action: { type: String, default: '', maxlength: 400 },
    tip: { type: String, default: '', maxlength: 300 },
    duration_minutes: { type: Number, min: 1, max: 30, default: 2 },
    completed: { type: Boolean, default: false },
  },
  { _id: false }
);

const DeliveryStatusSchema = new mongoose.Schema(
  {
    attempted: { type: Boolean, default: false },
    status: { type: String, enum: ['sent', 'failed', 'mock', 'skipped'], default: 'skipped' },
    sid: { type: String, default: null },
    error: { type: String, default: null },
  },
  { _id: false }
);

const ClinicalReportSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true, index: true },
    source: { type: String, enum: ['panic', 'manual', 'auto'], default: 'manual' },

    currentTask: { type: String, default: '', maxlength: 500 },
    selectedBlocker: { type: String, default: '', maxlength: 200 },
    vocalArousalScore: { type: Number, min: 1, max: 10, default: 5 },

    initialAnxietyQuery: { type: String, default: '', maxlength: 3000 },
    aiStressSummary: { type: String, default: '', maxlength: 2500 },
    riskLevel: {
      type: String,
      enum: ['watch', 'pre-burnout', 'acute-distress'],
      default: 'watch',
    },

    shatteredWorryBlocks: { type: [ReportWorrySchema], default: [] },
    timelineMicroquests: { type: [ReportQuestSchema], default: [] },

    guardian: {
      name: { type: String, default: '' },
      email: { type: String, default: '' },
      phone: { type: String, default: '' },
      relation: { type: String, default: '' },
    },

    delivery: {
      whatsapp: { type: DeliveryStatusSchema, default: () => ({}) },
      email: { type: DeliveryStatusSchema, default: () => ({}) },
    },

    meta: {
      notes: { type: String, default: '', maxlength: 1000 },
      generatedAt: { type: Date, default: Date.now },
      pdfDownloads: { type: Number, default: 0 },
    },
  },
  { timestamps: true }
);

ClinicalReportSchema.index({ userId: 1, createdAt: -1 });

const ClinicalReport = mongoose.model('ClinicalReport', ClinicalReportSchema);
export default ClinicalReport;

