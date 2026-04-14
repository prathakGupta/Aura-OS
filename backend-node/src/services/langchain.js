// src/services/langchain.js — Optimized v4.0 (OpenRouter Engine)

import { ChatOpenAI } from '@langchain/openai';
import { z } from 'zod';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/* ── Schemas (Keep these exactly the same) ────────────────────────────── */
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

/* ── Schema 4: Recovery Protocol Schema ────────────────────────────────── */
const RecoveryProtocolSchema = z.object({
  diagnosis_baseline: z.string().describe('The primary neuro-behavioral state identified (e.g. High Cortisol / Acute Anxiety, ADHD/Executive Freeze)'),
  neuro_diet_plan: z.array(z.string()).describe('Array of precise nutritional interventions based on the identified diagnosis_baseline'),
  somatic_exercise_plan: z.string().describe('A single concrete, prescribed physical activity or regimen based on the diagnosis_baseline'),
  confidence_anchor: z.string().describe('A psychologically grounding statement calling back to past success or normalizing the current state'),
  medical_disclaimer: z.string().describe('Must be exactly: "AuraOS provides neuro-supportive lifestyle suggestions, not medical prescriptions. Consult a doctor for severe symptoms."'),
});

/* ── Groq client factory (using robust OpenAI LangChain bindings) ──────── */
const makeModel = (schema, name, temp = 0.38) => {
  if (!process.env.GROQ_API_KEY) {
    console.warn('[LangChain] GROQ_API_KEY is not set — using local fallback.');
    return null;
  }
  try {
    const llm = new ChatOpenAI({
      modelName: process.env.GROQ_MODEL || 'llama-3.1-8b-instant',
      temperature: temp,
      openAIApiKey: process.env.GROQ_API_KEY,
      configuration: {
        baseURL: 'https://api.groq.com/openai/v1',
      }
    });
    return llm.withStructuredOutput(schema, { name, strict: true });
  } catch (err) {
    console.warn('[LangChain] Failed to create Groq model:', err.message);
    return null;
  }
};

/* ── Local fallback generators (keep app working without AI) ──────────── */
const localFallbackBreakdown = (task) => {
  const words = task.trim().split(/\s+/);
  const head = words.slice(0, 6).join(' ');
  return [
    { id: 1, action: `Open the app or folder needed for: ${head}`, tip: 'Starting is the hardest part — this counts.', duration_minutes: 1 },
    { id: 2, action: `Write down the single very next physical step`, tip: 'Brains freeze on big things. Tiny is powerful.', duration_minutes: 2 },
    { id: 3, action: `Do only that one step — nothing else`, tip: 'Momentum builds. One step is enough right now.', duration_minutes: 2 },
    { id: 4, action: `Take a 30-second breath break, then decide: continue or stop`, tip: 'You already broke the freeze. That is a win.', duration_minutes: 1 },
  ];
};

const localFallbackCoach = (task, blocker) => ({
  coach_message: `${blocker || 'Overwhelm'} makes starting feel impossible — your brain is protecting you, not failing you. AuraOS is setting up a calming workspace to help you begin.`,
  environment_strategy: 'brown_noise',
  microquests: [
    { id: 'step-1', text: `Open the workspace for: ${task.slice(0, 60)}`, tip: 'Just opening it counts as progress.', duration_minutes: 1, colorId: 'cyan' },
    { id: 'step-2', text: 'Write the first tiny action on a sticky note or doc', tip: 'Externalizing the plan frees your working memory.', duration_minutes: 2, colorId: 'green' },
    { id: 'step-3', text: 'Do only that one action — ignore everything else', tip: 'Tunnel vision is your friend right now.', duration_minutes: 2, colorId: 'green' },
    { id: 'step-4', text: 'Pause for 30 seconds and decide your next move', tip: 'You already broke through. Momentum is real.', duration_minutes: 1, colorId: 'amber' },
  ],
});

/* ── Neuroscience-backed system prompts ────────────────────────────────── */

const STANDARD_SHATTER_PROMPT = `You are an ADHD executive function coach embedded in AuraOS.
The user is experiencing task paralysis. Your ONLY job: atomize their EXACT task into the SMALLEST possible steps.

ABSOLUTE RULES — VIOLATION = FAILURE:
1. NEVER generate coping mechanisms, therapy advice, breathing exercises, mindfulness tips, or emotional support.
2. NEVER suggest "take a break", "drink water", "go for a walk", or any self-care step.
3. ONLY output concrete, physical steps to complete the user's SPECIFIC task.
4. Step 1 MUST reference the user's actual task noun (e.g. if task = "build backend", step 1 = "Open your code editor and create a new folder called 'backend'").
5. Each step = ONE single physical action completable in ~2 minutes.
6. Start EVERY action with a strong imperative verb (Open, Type, Click, Write, Run, Create, Navigate, Copy, Paste).
7. Tips must sound human and warm, ≤18 words. Tips should be about the TASK, not about feelings.
8. If the task is vague, make reasonable assumptions and be specific anyway.

EXAMPLE — CORRECT:
Task: "Write my history essay"
→ "Open Google Docs and create a blank document titled 'History Essay Draft'"
→ "Type your thesis statement in one sentence — just get words down, don't edit"
→ "Write 3 bullet points for your first body paragraph — facts only"

EXAMPLE — WRONG (NEVER do this):
→ "Take three deep breaths to center yourself" ← FORBIDDEN
→ "Remind yourself that you are capable" ← FORBIDDEN`;

const INITIATION_COACH_PROMPT = `You are the Aura Initiation Coach — a neuro-inclusive AI designed for ADHD and anxiety.
The user told you WHY they are stuck. Use this PRECISELY in your response.

ABSOLUTE RULES — VIOLATION = FAILURE:
1. NEVER generate therapy advice, coping strategies, or self-care steps as microquests.
2. Every microquest MUST be a concrete physical action to complete the user's ACTUAL task.
3. If the blocker is "too noisy", acknowledge it in the coach message but STILL give task-specific steps.
4. The coach_message is the ONLY place for empathy. Microquests = pure task execution.

ENVIRONMENT STRATEGY:
• brown_noise → noisy/distracted.
• deep_focus_dark → brain fog/fatigue.
• meditation_first → acute overwhelm.
• none → mild friction.

COACH MESSAGE: Acknowledge blocker with empathy (1-2 sentences), confirm environment change. Keep it warm but brief.
MICROQUESTS: Step 1 MUST be cyan (easiest). Be hyper-specific to the user's task. Start with imperative verbs.`;

const GUARDIAN_BRIEF_PROMPT = `You are the AuraOS Clinical Intelligence Layer writing a Guardian Triage Brief.
This brief is sent to a parent, school counselor, or therapist. Your role is to synthesize REAL telemetry data into an actionable clinical advisory.

STRICT DATA-GROUNDED RULES:
1. Your ENTIRE analysis MUST be derived from the telemetry JSON provided below. Do NOT invent symptoms, patterns, or advice not supported by the data.
2. SENTIMENT AWARENESS: If the user's self-report is positive (e.g. "I am very happy", "I feel great"), your analogy and observed_pattern MUST reflect a positive, high-functioning state. Do NOT default to distress framing.
3. Reference SPECIFIC game names, scores, latency values, and quest completion rates from the payload. Example: "Perspective Shift latency of 1200ms suggests moderate cognitive rigidity" — NOT "the user may experience difficulty switching perspectives."
4. If a data field is empty or missing, say "Not assessed this session" — do NOT hallucinate a value.

DATA SOURCES IN THE PAYLOAD:
- baselineProfile: Onboarding questionnaire answers (sleep, focus, hydration, relationships)
- vocalArousal (1-10): Real-time voice stress detection score
- worryBlocks[]: Extracted cognitive worry nodes with severity weights (1-10)
- probeSessions[]: Bistable illusion test results — latencyMs = time to switch perspective, canSwitchPerspective = cognitive flexibility
- questTelemetry[]: Micro-quest exertion times (durationMs per step) — abnormally long times indicate executive friction
- lastKnownActivity: What the user was doing when stress was detected (AFK freeze detection)
- gameSessions[]: All therapeutic game interaction data (scores, reaction times, clinical notes)

TONE: Clinical authority + genuine human warmth. Professional but never cold.
LANGUAGE: Accessible metaphors. Zero medical jargon in the parent_action section.

OUTPUT RULES:
- subject: WhatsApp/SMS subject line. Use risk emoji: [WATCH] / [PRE-BURNOUT] / [ACUTE].
- analogy: ONE powerful non-clinical metaphor grounded in the actual data pattern. NO generic "browser tabs" unless data supports it.
- vocal_analysis: Reference the actual arousal score and what it indicates.
- observed_pattern: 2-3 sentences citing specific metrics from the payload.
- aura_action_taken: What the support system deployed. Frame positively. No technical jargon. No "the AI did X."
- parent_action: SPECIFIC phrases the parent can literally say right now. Include one DIRECT QUOTE in quotation marks.
- risk_level: watch = mild isolated event | pre-burnout = sustained high load | acute-distress = crisis state.`;


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

const RECOVERY_AGENT_PROMPT = `You are the AuraOS Clinical Recovery Agent. Your goal is to prescribe a highly specific, neuro-chemical Diet and Exercise regimen based on the user's clinical telemetry report. Follow these STRICT Nutritional Psychiatry rules exclusively (no guesses):

RULE 1 (ADHD/Executive Freeze): If the report flags ADHD or Executive Freeze, you MUST prescribe Dopamine-boosting protocols.
RULE 2 (High Arousal/Severe Anxiety): If the report flags High Arousal or Severe Anxiety, you MUST prescribe GABA-boosting and Cortisol-lowering protocols.
RULE 3 (Depression/Low Confidence): If the report flags Depression or Low Confidence, you MUST prescribe Serotonin-boosting protocols.

Use the following clinical evidence to aggressively enrich the detail of your dietary and exercise items:
${loadClinicalKnowledge()}

Provide extremely detailed, actionable instructions. Don't be vague. 
Include evidence of micro-wins or validations from the report as the confidence_anchor. 
You MUST include a medical disclaimer: "AuraOS provides neuro-supportive lifestyle suggestions, not medical prescriptions. Consult a doctor for severe symptoms."`;

export const breakdownTask = async (task) => {
  const model = makeModel(MicroQuestSchema, 'generate_microquests');
  if (!model) {
    console.warn('[LangChain] No AI model available — using local fallback for breakdown.');
    return localFallbackBreakdown(task);
  }
  try {
    console.log(`[LangChain] Standard breakdown: "${task.slice(0, 80)}"`);
    const result = await model.invoke([
      new SystemMessage(STANDARD_SHATTER_PROMPT),
      new HumanMessage(`Break this overwhelming task into 2-minute micro-steps: "${task}"`),
    ]);
    return result.microquests;
  } catch (err) {
    console.warn('[LangChain] Groq breakdown failed, using fallback:', err.message);
    return localFallbackBreakdown(task);
  }
};

export const coachBreakdown = async (task, blocker) => {
  const model = makeModel(InitiationCoachSchema, 'initiation_coach');
  const blockerLabel = blocker || 'not specified';
  if (!model) {
    console.warn('[LangChain] No AI model available — using local fallback for coach.');
    return localFallbackCoach(task, blockerLabel);
  }
  try {
    console.log(`[LangChain] Coach breakdown: "${task.slice(0, 60)}" | blocker: ${blockerLabel}`);
    const result = await model.invoke([
      new SystemMessage(INITIATION_COACH_PROMPT),
      new HumanMessage(
        `Task to break down: "${task}"\nUser's blocker: "${blockerLabel}"\n\nGenerate coach response and micro-quests.`
      ),
    ]);
    return result;
  } catch (err) {
    console.warn('[LangChain] Groq coach breakdown failed, using fallback:', err.message);
    return localFallbackCoach(task, blockerLabel);
  }
};

/* ── Export 3: Guardian brief ─────────────────────────────────────────── */
export const generateGuardianBrief = async ({
  userName, taskSummary, blocker, vocalArousal, emotion, auraAction, recentPatterns,
}) => {
  const localFallbackBrief = () => ({
    subject: `AuraOS Alert — Stress Spike Detected for ${userName || 'user'}`,
    analogy: 'A computer that has frozen because too many programmes tried to run at once.',
    vocal_analysis: `Vocal arousal detected at ${vocalArousal ?? 'N/A'}/10.`,
    observed_pattern: `The user attempted "${taskSummary || 'a task'}" but reported "${blocker || 'overwhelm'}". This is consistent with executive dysfunction freeze.`,
    aura_action_taken: auraAction || 'A breathing exercise was deployed and a calming environment was activated.',
    parent_action: 'Do not ask about the task for at least 20 minutes. Offer water and a brief walk. Try saying: "I see you are working really hard. Let\'s take a break together."',
    risk_level: Number(vocalArousal) >= 8 ? 'acute-distress' : Number(vocalArousal) >= 6 ? 'pre-burnout' : 'watch',
  });
  const model = makeModel(GuardianBriefSchema, 'guardian_brief', 0.42);
  if (!model) {
    console.warn('[LangChain] No AI model available — using local fallback for guardian brief.');
    return localFallbackBrief();
  }

  // ── Build rich telemetry context block ───────────────────────────────
  const safe = (v, fallback = 'N/A') => (v !== undefined && v !== null && v !== '') ? v : fallback;
  const arousalLabel = Number(data.vocalArousal) >= 8 ? 'HIGH' : Number(data.vocalArousal) >= 6 ? 'ELEVATED' : Number(data.vocalArousal) >= 4 ? 'MODERATE' : 'LOW';

  // Baseline profile
  const bp = data.baselineProfile || {};
  const bpLines = Object.keys(bp).length
    ? Object.entries(bp).map(([k, v]) => `  ${k}: ${v}`).join('\n')
    : '  Not completed.';

  // Worry blocks
  const worries = Array.isArray(data.worryBlocks) && data.worryBlocks.length
    ? data.worryBlocks.slice(0, 8).map(w => `  - "${w.text}" (weight: ${w.weight}/10, ${w.status})`).join('\n')
    : '  None extracted this session.';

  // Probe sessions (cognitive flexibility)
  const probes = Array.isArray(data.probeSessions) && data.probeSessions.length
    ? data.probeSessions.map(p => `  - Image: ${p.imageId}, First seen: ${p.firstSeen}, Latency: ${p.latencyMs}ms, Switched: ${p.canSwitchPerspective}`).join('\n')
    : '  Not assessed this session.';

  // Quest telemetry (shatter exertion)
  const quests = Array.isArray(data.questTelemetry) && data.questTelemetry.length
    ? data.questTelemetry.map(q => `  - Step ${q.questId || '?'}: ${q.durationMs || '?'}ms`).join('\n')
    : '  No micro-quest data.';

  // Game sessions
  const games = Array.isArray(data.gameSessions) && data.gameSessions.length
    ? data.gameSessions.map(g => `  - ${g.gameName}: ${g.durationSeconds}s, score ${g.score}, accuracy ${g.accuracy}%, reaction ${g.avgReactionMs}ms. ${g.predictedEffects?.clinicalNote || ''}`).join('\n')
    : '  No therapeutic games played.';

  const contextBlock = `
=== TELEMETRY PAYLOAD ===

PATIENT: ${safe(data.userName)}
CURRENT TASK: "${safe(data.taskSummary, 'unspecified')}"
BLOCKER: "${safe(data.blocker, 'none stated')}"
VOCAL AROUSAL: ${safe(data.vocalArousal)}/10 — ${arousalLabel}
DETECTED EMOTION: ${safe(data.emotion)}
LAST KNOWN ACTIVITY: ${safe(data.lastKnownActivity, 'Unknown')}
BASELINE AROUSAL (from intake): ${safe(data.baselineArousalScore)}

ONBOARDING BASELINE PROFILE:
${bpLines}

WORRY BLOCKS (Cognitive Forge):
${worries}

COGNITIVE FLEXIBILITY (Perception Probe):
${probes}

MICRO-QUEST EXERTION (Task Shatter):
${quests}

THERAPEUTIC GAME SESSIONS:
${games}

AURA INTERVENTION: ${safe(data.auraAction, 'Somatic interruption deployed.')}
24H PATTERN: ${safe(data.recentPatterns, 'No historical pattern available.')}
`.trim();

  try {
    console.log(`[LangChain] Guardian brief for: ${userName}`); // note: userName might need to be destructured if upstream changed interface
    const result = await model.invoke([
      new SystemMessage(GUARDIAN_BRIEF_PROMPT),
      new HumanMessage(`Generate the Guardian Triage Brief:\n\n${contextBlock}`),
    ]);
    return result;
  } catch (err) {
    console.warn('[LangChain] Groq guardian brief failed, using fallback:', err.message);
    return localFallbackBrief();
  }
};

/* ── Export 4: Recovery Protocol ──────────────────────────────────────── */
export const generateRecoveryProtocol = async (reportData) => {
  const localFallbackRecovery = () => ({
    diagnosis_baseline: "High Cortisol / Acute Anxiety",
    neuro_diet_plan: ["Magnesium heavy dinner (spinach/seeds)", "Zero caffeine after 12 PM"],
    somatic_exercise_plan: "20-minute Zone 2 cardio (brisk walk) to lower resting heart rate.",
    confidence_anchor: "Remind user they successfully initiated 2 micro-quests today.",
    medical_disclaimer: "AuraOS provides neuro-supportive lifestyle suggestions, not medical prescriptions. Consult a doctor for severe symptoms."
  });

  const model = makeModel(RecoveryProtocolSchema, 'recovery_protocol', 0.4);
  if (!model) {
    console.warn('[LangChain] No AI model available — using local fallback for recovery protocol.');
    return localFallbackRecovery();
  }

  try {
    console.log(`[LangChain] Recovery protocol generation started.`);
    const result = await model.invoke([
      new SystemMessage(RECOVERY_AGENT_PROMPT),
      new HumanMessage(`Generate the Recovery Protocol based on this clinical report data:\n\n${JSON.stringify(reportData, null, 2)}`),
    ]);
    // Ensure medical disclaimer is set if Groq fails to include it properly
    if (!result.medical_disclaimer) {
         result.medical_disclaimer = "AuraOS provides neuro-supportive lifestyle suggestions, not medical prescriptions. Consult a doctor for severe symptoms.";
    }
    return result;
  } catch (err) {
    console.warn('[LangChain] Groq recovery protocol failed, using fallback:', err.message);
    return localFallbackRecovery();
  }
};