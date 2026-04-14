// open router 
// src/services/langchain.js — Optimized v4.0 (OpenRouter Engine)

import { ChatOpenAI } from "@langchain/openai";
import { z } from "zod";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/* ── Clinical Knowledge Ingestion ────────────────────────────────────────── */
const loadClinicalKnowledge = () => {
  try {
    const kbDir = path.join(__dirname, "../clinical_knowledge");
    if (!fs.existsSync(kbDir)) return "";
    const files = fs.readdirSync(kbDir).filter(f => f.endsWith(".txt"));
    let combinedContext = "";
    for (const file of files) {
      combinedContext += `[Source: ${file}]\n${fs.readFileSync(path.join(kbDir, file), "utf-8")}\n\n`;
    }
    return combinedContext;
  } catch (e) {
    return "";
  }
};

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
  environment_strategy: z.enum(["brown_noise", "deep_focus_dark", "meditation_first", "none"]),
  microquests: z.array(z.object({
    id:               z.string(),
    text:             z.string().max(180),
    tip:              z.string().max(160),
    duration_minutes: z.number().min(1).max(5).default(2),
    colorId:          z.enum(["cyan", "purple", "coral", "amber", "green"]),
  })).min(3).max(6),
});

const GuardianBriefSchema = z.object({
  subject:           z.string().max(110),
  analogy:           z.string().max(280),
  vocal_analysis:    z.string().max(180),
  observed_pattern:  z.string().max(380),
  aura_action_taken: z.string().max(220),
  parent_action:     z.string().max(280),
  risk_level:        z.enum(["watch", "pre-burnout", "acute-distress"]),
});

const RECOVERY_AGENT_PROMPT = `You are the AuraOS Clinical Recovery Agent. Goal: prescribe neuro-chemical Diet and Exercise based on clinical telemetry.
Rules:
1. ADHD/Freeze -> Dopamine-boosting.
2. Anxiety/Arousal -> GABA-boosting / Cortisol-lowering.
3. Depression -> Serotonin-boosting.
Clinical Evidence:\n${loadClinicalKnowledge()}`;

const RecoveryProtocolSchema = z.object({
  diagnosis_baseline: z.string().describe("The primary neuro-behavioral state identified"),
  neuro_diet_plan: z.array(z.string()).describe("Precise nutritional interventions"),
  somatic_exercise_plan: z.string().describe("Prescribed physical activity"),
  confidence_anchor: z.string().describe("Psychologically grounding statement"),
  medical_disclaimer: z.string().describe("Required safety disclaimer"),
});

/* ── OpenRouter client factory ───────────────────────────────────────────── */
/* ── OpenRouter / DeepSeek client factory ────────────────────────────────── */
const makeModel = (schema, name, temp = 0.38) => {
  // Swap this to DEEPSEEK_API_KEY if you went back to DeepSeek
  const apiKey = process.env.OPENROUTER_API_KEY; 
  if (!apiKey) throw new Error("API_KEY is not set.");
  
  const llm = new ChatOpenAI({
    modelName: process.env.OPENROUTER_MODEL || "openai/gpt-4o-mini",
    temperature: temp,
    apiKey: apiKey, // Use apiKey instead of openAIApiKey for newer LangChain versions
    configuration: {
      baseURL: "https://openrouter.ai/api/v1", // Or 'https://api.deepseek.com'
      defaultHeaders: {
        "Authorization": `Bearer ${apiKey}`, // <-- THE BULLETPROOF FIX
        "HTTP-Referer": "http://localhost:5173",
        "X-Title": "AuraOS",
      }
    }
  });
  
  return llm.withStructuredOutput(schema, { name, strict: true });
};


/* ── System Prompts ────────────────────────────────────────────────────── */

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

/* ── Exports ───────────────────────────────────────────────────────────── */
export const breakdownTask = async (task) => {
  const model = makeModel(MicroQuestSchema, "generate_microquests");
  console.log("[LangChain-OpenRouter] Standard breakdown...");
  const result = await model.invoke([
    new SystemMessage(STANDARD_SHATTER_PROMPT),
    new HumanMessage(`Break this task into micro-steps: "${task}"`),
  ]);
  return result.microquests;
};

export const coachBreakdown = async (task, blocker) => {
  const model = makeModel(InitiationCoachSchema, "initiation_coach");
  console.log("[LangChain-OpenRouter] Coach breakdown...");
  return await model.invoke([
    new SystemMessage(INITIATION_COACH_PROMPT),
    new HumanMessage(`Task: "${task}"\nBlocker: "${blocker || "overwhelm"}"`),
  ]);
};

export const generateGuardianBrief = async (data) => {
  const model = makeModel(GuardianBriefSchema, "guardian_brief", 0.42);

  // ── Build rich telemetry context block ───────────────────────────────
  const safe = (v, fallback = "N/A") => (v !== undefined && v !== null && v !== "") ? v : fallback;
  const arousalLabel = Number(data.vocalArousal) >= 8 ? "HIGH" : Number(data.vocalArousal) >= 6 ? "ELEVATED" : Number(data.vocalArousal) >= 4 ? "MODERATE" : "LOW";

  // Baseline profile
  const bp = data.baselineProfile || {};
  const bpLines = Object.keys(bp).length
    ? Object.entries(bp).map(([k, v]) => `  ${k}: ${v}`).join("\n")
    : "  Not completed.";

  // Worry blocks
  const worries = Array.isArray(data.worryBlocks) && data.worryBlocks.length
    ? data.worryBlocks.slice(0, 8).map(w => `  - "${w.text}" (weight: ${w.weight}/10, ${w.status})`).join("\n")
    : "  None extracted this session.";

  // Probe sessions (cognitive flexibility)
  const probes = Array.isArray(data.probeSessions) && data.probeSessions.length
    ? data.probeSessions.map(p => `  - Image: ${p.imageId}, First seen: ${p.firstSeen}, Latency: ${p.latencyMs}ms, Switched: ${p.canSwitchPerspective}`).join("\n")
    : "  Not assessed this session.";

  // Quest telemetry (shatter exertion)
  const quests = Array.isArray(data.questTelemetry) && data.questTelemetry.length
    ? data.questTelemetry.map(q => `  - Step ${q.questId || "?"}: ${q.durationMs || "?"}ms`).join("\n")
    : "  No micro-quest data.";

  // Game sessions
  const games = Array.isArray(data.gameSessions) && data.gameSessions.length
    ? data.gameSessions.map(g => `  - ${g.gameName}: ${g.durationSeconds}s, score ${g.score}, accuracy ${g.accuracy}%, reaction ${g.avgReactionMs}ms. ${g.predictedEffects?.clinicalNote || ""}`).join("\n")
    : "  No therapeutic games played.";

  const contextBlock = `
=== TELEMETRY PAYLOAD ===

PATIENT: ${safe(data.userName)}
CURRENT TASK: "${safe(data.taskSummary, "unspecified")}"
BLOCKER: "${safe(data.blocker, "none stated")}"
VOCAL AROUSAL: ${safe(data.vocalArousal)}/10 — ${arousalLabel}
DETECTED EMOTION: ${safe(data.emotion)}
LAST KNOWN ACTIVITY: ${safe(data.lastKnownActivity, "Unknown")}
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

AURA INTERVENTION: ${safe(data.auraAction, "Somatic interruption deployed.")}
24H PATTERN: ${safe(data.recentPatterns, "No historical pattern available.")}
`.trim();

  console.log(`[LangChain-OpenRouter] Guardian brief for: ${data.userName}`);
  return await model.invoke([
    new SystemMessage(GUARDIAN_BRIEF_PROMPT),
    new HumanMessage(`Generate the Guardian Triage Brief based ONLY on this telemetry:\n\n${contextBlock}`),
  ]);
};

export const generateRecoveryProtocol = async (reportData) => {
  const model = makeModel(RecoveryProtocolSchema, "recovery_protocol", 0.4);
  const fallback = {
    diagnosis_baseline: "Stress Response",
    neuro_diet_plan: ["Magnesium rich foods"],
    somatic_exercise_plan: "Zone 2 brisk walk",
    confidence_anchor: "You completed steps today.",
    medical_disclaimer: "AuraOS provides neuro-supportive lifestyle suggestions, not medical prescriptions."
  };
  
  try {
    const result = await model.invoke([
      new SystemMessage(RECOVERY_AGENT_PROMPT),
      new HumanMessage(`Generate Recovery Protocol:\n\n${JSON.stringify(reportData)}`),
    ]);
    if (!result.medical_disclaimer) result.medical_disclaimer = fallback.medical_disclaimer;
    return result;
  } catch (err) {
    console.error("[LangChain] Recovery protocol generation failed:", err.message);
    return fallback;
  }
};