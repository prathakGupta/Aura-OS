// src/services/langchain.js — Optimized v2.0
// Improved with neuroscience-backed prompts for ADHD/anxiety support
// Research sources: Tiimo, Inflow, EndeavorOTC, Goblin.tools methodologies

import { ChatGroq } from '@langchain/groq';
import { z } from 'zod';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';

/* ── Schema 1: Standard micro-quest breakdown ──────────────────────────── */
const MicroQuestSchema = z.object({
  microquests: z.array(z.object({
    id:               z.number().int().min(1),
    action:           z.string().max(200).describe('Single imperative physical action, ~2 minutes. Start with an ACTION VERB.'),
    tip:              z.string().max(180).describe('One warm, ADHD-friendly encouragement ≤18 words. No toxic positivity.'),
    duration_minutes: z.number().min(1).max(5).default(2),
  })).min(2).max(8),
});

/* ── Schema 2: Initiation Coach (blocker-aware) ────────────────────────── */
const InitiationCoachSchema = z.object({
  coach_message: z.string().max(260).describe(
    '2 sentences MAX. Sentence 1: acknowledge their exact blocker with empathy. Sentence 2: confirm the environment action AuraOS is taking.'
  ),
  environment_strategy: z.enum(['brown_noise', 'deep_focus_dark', 'meditation_first', 'none']).describe(
    'brown_noise = noisy/distracted; deep_focus_dark = brain fog/tired; meditation_first = overwhelmed/frozen; none = mild friction only.'
  ),
  microquests: z.array(z.object({
    id:               z.string().describe('Unique step ID, e.g. "step-1"'),
    text:             z.string().max(180).describe('Ultra-specific 2-minute action. Start with an ACTION VERB. Mention tools/apps by name when relevant.'),
    tip:              z.string().max(160).describe('1-sentence warm ADHD tip. Sound like a supportive friend, not a robot.'),
    duration_minutes: z.number().min(1).max(5).default(2),
    colorId:          z.enum(['cyan', 'purple', 'coral', 'amber', 'green']).describe(
      'Difficulty signal for visual ADHD cue: cyan=easiest entry point, green=manageable, amber=moderate, coral=hardest. NEVER start with coral.'
    ),
  })).min(3).max(6),
});

/* ── Schema 3: Guardian Clinical Brief ────────────────────────────────── */
const GuardianBriefSchema = z.object({
  subject:           z.string().max(110).describe('WhatsApp/SMS subject line. Include risk emoji: 🟡 watch / 🟠 pre-burnout / 🔴 acute'),
  analogy:           z.string().max(280).describe(
    'ONE powerful non-clinical metaphor. Examples: "browser with 40 tabs open", "car with handbrake on", "phone at 2% battery". NO clinical jargon.'
  ),
  vocal_analysis:    z.string().max(180).describe('1-2 sentences on observed stress markers. Use parent-friendly language.'),
  observed_pattern:  z.string().max(380).describe(
    '2-3 sentences: what the user attempted, what blocked them, and what this pattern indicates. Warm clinical authority.'
  ),
  aura_action_taken: z.string().max(220).describe(
    'What the AuraOS support system deployed. Frame positively. No technical jargon.'
  ),
  parent_action:     z.string().max(280).describe(
    'SPECIFIC phrases the parent can literally say right now. Include one direct quote in quotation marks. No jargon. Empathy-first.'
  ),
  risk_level:        z.enum(['watch', 'pre-burnout', 'acute-distress']).describe(
    'watch = mild stress; pre-burnout = sustained high load, needs monitoring; acute-distress = crisis intervention warranted.'
  ),
});

/* ── Groq client factory ───────────────────────────────────────────────── */
const makeModel = (schema, name, temp = 0.38) => {
  if (!process.env.GROQ_API_KEY) throw new Error('GROQ_API_KEY is not set.');
  const llm = new ChatGroq({
    model: process.env.GROQ_MODEL || 'llama-3.1-8b-instant',
    temperature: temp,
    apiKey: process.env.GROQ_API_KEY,
  });
  return llm.withStructuredOutput(schema, { name, strict: true });
};

/* ── Neuroscience-backed system prompts ────────────────────────────────── */

const STANDARD_SHATTER_PROMPT = `You are an ADHD executive function coach embedded in AuraOS.
The user is experiencing task paralysis. Your job: atomize their task into the SMALLEST possible steps.

NEUROSCIENCE RULES:
1. Each step = ONE single physical action completable in ~2 minutes. If it takes longer, split it.
2. Start EVERY action with a strong imperative verb (Open, Type, Click, Write, Create, Close).
3. Make step 1 so easy it's almost laughable — lower the activation threshold to near zero.
4. No step should require planning or decision-making — those are separate tasks.
5. Tips must sound human and warm, ≤18 words. Avoid "just" (dismissive) and "simply" (condescending).
6. Max 8 steps. Only break the FIRST phase of large tasks.
7. Specific beats vague: "Open VS Code" not "Open your editor".`;

const INITIATION_COACH_PROMPT = `You are the Aura Initiation Coach — a neuro-inclusive AI designed for ADHD and anxiety.
The user told you WHY they are stuck. Use this PRECISELY in your response.

ENVIRONMENT STRATEGY — choose the best fit:
• brown_noise → noisy/distracted environment. Activates ambient brown noise.
• deep_focus_dark → brain fog, fatigue, cognitive overload. Dims screen brightness.
• meditation_first → acute overwhelm, task feels impossible. Breathing exercise before steps.
• none → mild friction, no special intervention needed.

COACH MESSAGE (2 sentences MAX):
• Sentence 1: Acknowledge their blocker by name. Show you heard them. No empty affirmations.
  Good: "Brain fog is real — your brain isn't broken, it's conserving energy."
  Bad: "I understand you're struggling! Let's tackle this together!"
• Sentence 2: Confirm the environment action you're triggering for them.

MICROQUEST RULES:
• Step 1 MUST be cyan (easiest). Never coral for first 2 steps.
• Be hyper-specific. Name files, buttons, apps. "Go to calendar.app" not "check your calendar".
• Tips: sound like a friend who's been there. One sentence. Normalize the struggle.
• Duration: honest estimates. 2 min default, 1 min for tiny tasks, max 5 min.`;

const GUARDIAN_BRIEF_PROMPT = `You are the AuraOS Clinical Intelligence Layer writing a Guardian Triage Brief.
This is sent to a parent, school counselor, or therapist during a detected stress spike.

TONE: Clinical authority + genuine human warmth. Professional but never cold.
LANGUAGE: Accessible metaphors. Zero medical jargon in the parent-action section.

RULES:
• parent_action must contain a DIRECT QUOTE the parent can actually say, in quotation marks.
  Example: "Try saying: 'I see you're having a hard moment. Want to sit together for a bit?'"
• Do NOT reveal app mechanics (no "the AI did X"). Use "the support system" instead.
• risk_level assessment:
  - 'watch': mild isolated stress event, normal coping capacity intact
  - 'pre-burnout': pattern of sustained high load, needs external support
  - 'acute-distress': crisis state, immediate intervention recommended
• analogy must be conversational and immediately understandable to a non-technical parent.`;

/* ── Export 1: Standard breakdown ─────────────────────────────────────── */
export const breakdownTask = async (task) => {
  if (!task?.trim()) throw new Error('Task is required.');
  const model = makeModel(MicroQuestSchema, 'generate_microquests');
  console.log(`[LangChain] Standard breakdown: "${task.slice(0, 80)}"`);
  const result = await model.invoke([
    new SystemMessage(STANDARD_SHATTER_PROMPT),
    new HumanMessage(`Break this overwhelming task into 2-minute micro-steps: "${task}"`),
  ]);
  return result.microquests;
};

/* ── Export 2: Coach-aware breakdown ──────────────────────────────────── */
export const coachBreakdown = async (task, blocker) => {
  if (!task?.trim()) throw new Error('Task is required.');
  const model = makeModel(InitiationCoachSchema, 'initiation_coach');
  const blockerLabel = blocker || 'not specified';
  console.log(`[LangChain] Coach breakdown: "${task.slice(0, 60)}" | blocker: ${blockerLabel}`);
  const result = await model.invoke([
    new SystemMessage(INITIATION_COACH_PROMPT),
    new HumanMessage(
      `Task to break down: "${task}"\nUser's blocker: "${blockerLabel}"\n\nGenerate coach response and micro-quests.`
    ),
  ]);
  return result;
};

/* ── Export 3: Guardian brief ─────────────────────────────────────────── */
export const generateGuardianBrief = async ({
  userName, taskSummary, blocker, vocalArousal, emotion, auraAction, recentPatterns,
}) => {
  const model = makeModel(GuardianBriefSchema, 'guardian_brief', 0.42);

  const contextBlock = `
User: ${userName || 'the user'}
Attempted task: "${taskSummary || 'unspecified'}"
Blocker stated: "${blocker || 'overwhelm'}"
Vocal arousal (1–10): ${vocalArousal ?? 'N/A'} — ${Number(vocalArousal) >= 8 ? 'HIGH' : Number(vocalArousal) >= 6 ? 'ELEVATED' : 'MODERATE'}
Detected emotion: ${emotion || 'high_anxiety'}
AuraOS intervention: ${auraAction || 'Somatic interruption deployed.'}
24h pattern: ${recentPatterns || 'Elevated stress with task avoidance.'}
`.trim();

  console.log(`[LangChain] Guardian brief for: ${userName}`);
  const result = await model.invoke([
    new SystemMessage(GUARDIAN_BRIEF_PROMPT),
    new HumanMessage(`Generate the Guardian Triage Brief:\n\n${contextBlock}`),
  ]);
  return result;
};