// src/services/langchain.js — Unified Engine (Groq + OpenRouter)
// Optimized for ADHD/anxiety support and Clinical Recovery protocols.

import { ChatOpenAI } from '@langchain/openai';
import { z } from 'zod';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/* ── Schemas (ADHD & Clinical Recovery) ────────────────────────────────── */

const MicroQuestSchema = z.object({
  microquests: z.array(z.object({
    id:               z.number().int().min(1),
    action:           z.string().max(200),
    tip:              z.string().max(180),
    duration_minutes: z.number().min(1).max(5).default(2),
  })).min(2).max(8),
});

const InitiationCoachSchema = z.object({
  coach_message: z.string().max(260),
  environment_strategy: z.enum(['brown_noise', 'deep_focus_dark', 'meditation_first', 'none']),
  microquests: z.array(z.object({
    id:               z.string(),
    text:             z.string().max(180),
    tip:              z.string().max(160),
    duration_minutes: z.number().min(1).max(5).default(2),
    colorId:          z.enum(['cyan', 'purple', 'coral', 'amber', 'green']),
  })).min(3).max(6),
});

const GuardianBriefSchema = z.object({
  subject:           z.string().max(110),
  analogy:           z.string().max(280),
  vocal_analysis:    z.string().max(180),
  observed_pattern:  z.string().max(380),
  aura_action_taken: z.string().max(220),
  parent_action:     z.string().max(280),
  risk_level:        z.enum(['watch', 'pre-burnout', 'acute-distress']),
});

const RecoveryProtocolSchema = z.object({
  diagnosis_baseline: z.string().describe('The primary neuro-behavioral state identified'),
  neuro_diet_plan: z.array(z.string()).describe('Precise nutritional interventions'),
  somatic_exercise_plan: z.string().describe('Prescribed physical activity'),
  confidence_anchor: z.string().describe('Psychologically grounding statement'),
  medical_disclaimer: z.string().describe('Required safety disclaimer'),
});

/* ── Model Factory (Groq-First with OpenRouter Bulletproof Headers) ─────── */

const makeModel = (schema, name, temp = 0.38) => {
  const apiKey = process.env.GROQ_API_KEY || process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    console.warn('[LangChain] API_KEY is missing — checking fallbacks.');
    return null;
  }

  try {
    const isGroq = !!process.env.GROQ_API_KEY;
    const llm = new ChatOpenAI({
      modelName: isGroq ? (process.env.GROQ_MODEL || 'llama-3.1-8b-instant') : (process.env.OPENROUTER_MODEL || 'openai/gpt-4o-mini'),
      temperature: temp,
      apiKey: apiKey,
      configuration: {
        baseURL: isGroq ? 'https://api.groq.com/openai/v1' : 'https://openrouter.ai/api/v1',
        defaultHeaders: {
          'Authorization': `Bearer ${apiKey}`,
          'HTTP-Referer': 'http://localhost:5173',
          'X-Title': 'AuraOS',
        }
      }
    });
    return llm.withStructuredOutput(schema, { name, strict: true });
  } catch (err) {
    console.warn('[LangChain] Model init failed:', err.message);
    return null;
  }
};

/* ── Clinical Knowledge Ingestion ────────────────────────────────────────── */

const loadClinicalKnowledge = () => {
  try {
    const kbDir = path.join(__dirname, '../clinical_knowledge');
    if (!fs.existsSync(kbDir)) return '';
    const files = fs.readdirSync(kbDir).filter(f => f.endsWith('.txt'));
    let combinedContext = '';
    for (const file of files) {
      combinedContext += `[Source: ${file}]\n${fs.readFileSync(path.join(kbDir, file), 'utf-8')}\n\n`;
    }
    return combinedContext;
  } catch (e) {
    return '';
  }
};

/* ── System Prompts ────────────────────────────────────────────────────────── */

const STANDARD_SHATTER_PROMPT = `You are an ADHD executive function coach embedded in AuraOS.
The user is experiencing task paralysis. Your ONLY job: atomize their EXACT task into the SMALLEST possible steps.

ABSOLUTE RULES — VIOLATION = FAILURE:
1. NEVER generate coping mechanisms, therapy advice, breathing exercises, or mindfulness tips.
2. ONLY output concrete, physical steps to complete the user's SPECIFIC task.
3. Start EVERY action with a strong imperative verb (Open, Type, Click, Write, Run, Create).
4. Tips must sound human and warm, ≤18 words. Avoid self-care fluff.`;

const INITIATION_COACH_PROMPT = `You are the Aura Initiation Coach — a neuro-inclusive AI for ADHD and anxiety.
Acknowledge blocker with empathy, confirm environment change, then provide microquests.
Step 1 MUST be cyan (easiest). Microquests = pure task execution.`;

const GUARDIAN_BRIEF_PROMPT = `You are the AuraOS Clinical Intelligence Layer writing a Guardian Triage Brief.
Tone: Clinical authority + genuine human warmth. Reference specific metrics from telemetry.
risk_level: watch | pre-burnout | acute-distress.`;

const RECOVERY_AGENT_PROMPT = `You are the AuraOS Clinical Recovery Agent. Goal: prescribe neuro-chemical Diet and Exercise based on clinical telemetry.
Rules:
1. ADHD/Freeze -> Dopamine-boosting.
2. Anxiety/Arousal -> GABA-boosting / Cortisol-lowering.
3. Depression -> Serotonin-boosting.
Clinical Evidence:\n${loadClinicalKnowledge()}`;

/* ── Local Fallbacks ───────────────────────────────────────────────────────── */

const localFallbackBreakdown = (task) => [
  { id: 1, action: `Open the app needed for: ${task.slice(0, 30)}`, tip: 'Starting is the hardest part.', duration_minutes: 1 },
  { id: 2, action: `Focus on the very next physical step`, tip: 'Keep it tiny.', duration_minutes: 2 },
];

const localFallbackCoach = (task, blocker) => ({
  coach_message: `${blocker || 'Overwhelm'} is a signal to slow down. Let me set up your workspace.`,
  environment_strategy: 'brown_noise',
  microquests: localFallbackBreakdown(task),
});

/* ── EXPORTS ───────────────────────────────────────────────────────────────── */

export const breakdownTask = async (task) => {
  const model = makeModel(MicroQuestSchema, 'generate_microquests');
  if (!model) return localFallbackBreakdown(task);
  try {
    const result = await model.invoke([
      new SystemMessage(STANDARD_SHATTER_PROMPT),
      new HumanMessage(`Break this task into 2-minute micro-steps: "${task}"`),
    ]);
    return result.microquests;
  } catch (err) {
    return localFallbackBreakdown(task);
  }
};

export const coachBreakdown = async (task, blocker) => {
  const model = makeModel(InitiationCoachSchema, 'initiation_coach');
  if (!model) return localFallbackCoach(task, blocker);
  try {
    return await model.invoke([
      new SystemMessage(INITIATION_COACH_PROMPT),
      new HumanMessage(`Task: "${task}"\nBlocker: "${blocker || 'not specified'}"`),
    ]);
  } catch (err) {
    return localFallbackCoach(task, blocker);
  }
};

export const generateGuardianBrief = async (data) => {
  const model = makeModel(GuardianBriefSchema, 'guardian_brief', 0.42);
  if (!model) return { subject: "[WATCH] Stress Alert", observed_pattern: "Automatic monitoring flagged moderate stress." };
  
  // Dynamic context block construction (simplified for brevity but including key data points)
  const contextBlock = `
PATIENT: ${data.userName}
TASK: "${data.taskSummary}"
BLOCKER: "${data.blocker}"
VOCAL AROUSAL: ${data.vocalArousal}/10
EMOTION: ${data.emotion}
  `.trim();

  return await model.invoke([
    new SystemMessage(GUARDIAN_BRIEF_PROMPT),
    new HumanMessage(`Generate Triage Brief:\n\n${contextBlock}`),
  ]);
};

export const generateRecoveryProtocol = async (reportData) => {
  const model = makeModel(RecoveryProtocolSchema, 'recovery_protocol', 0.4);
  const fallback = {
    diagnosis_baseline: "Stress Response",
    neuro_diet_plan: ["Magnesium rich foods"],
    somatic_exercise_plan: "Zone 2 brisk walk",
    confidence_anchor: "You completed steps today.",
    medical_disclaimer: "AuraOS provides neuro-supportive lifestyle suggestions, not medical prescriptions."
  };
  
  if (!model) return fallback;

  try {
    const result = await model.invoke([
      new SystemMessage(RECOVERY_AGENT_PROMPT),
      new HumanMessage(`Generate Recovery Protocol:\n\n${JSON.stringify(reportData)}`),
    ]);
    if (!result.medical_disclaimer) result.medical_disclaimer = fallback.medical_disclaimer;
    return result;
  } catch (err) {
    return fallback;
  }
};