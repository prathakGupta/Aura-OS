import { GoogleGenerativeAI } from '@google/generative-ai';

// Lazily initialise so missing API keys don't crash import at startup.
let genAI = null;

const getClient = () => {
  if (!genAI) {
    if (!process.env.GEMINI_API_KEY) {
      throw new Error('GEMINI_API_KEY is not set in environment variables.');
    }
    genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  }
  return genAI;
};

const DEFAULT_MODEL_CANDIDATES = [
  'gemini-2.0-flash',
  'gemini-2.0-flash-lite',
  'gemini-1.5-flash',
];

const FORGE_SYSTEM_INSTRUCTION = `You are a cognitive extraction engine embedded in a mental health app called AuraOS.
Your sole job is to read messy, anxious, stream-of-consciousness text and extract each distinct worry.

RULES - follow these exactly:
1. Return ONLY a valid JSON array. No markdown fences, no explanation, no preamble.
2. Each item: {"id": <1-based integer>, "worry": "<concise 3-8 word label>", "weight": <1-10>}
3. weight = emotional urgency/distress level (10 = most overwhelming, 1 = minor).
4. Combine duplicate or very similar worries into one entry.
5. Maximum 10 items. If there are more, surface the highest-weight ones.
6. Do not invent worries that are not implied by the text.
7. Keep "worry" labels short enough to fit on a physics block - max 8 words.
8. If the text contains no worries, return an empty array: []

Example input: "I'm so behind on my project and also my mom is sick and I forgot to pay rent again and honestly I don't even know if I'm good enough for this job"
Example output: [{"id":1,"worry":"project deadline slipping","weight":8},{"id":2,"worry":"mom's health","weight":9},{"id":3,"worry":"missed rent payment","weight":6},{"id":4,"worry":"job competence doubts","weight":7}]`;

const buildModelCandidates = () => {
  const envModel = (process.env.GEMINI_MODEL || '').trim();
  const candidates = envModel
    ? [envModel, ...DEFAULT_MODEL_CANDIDATES]
    : [...DEFAULT_MODEL_CANDIDATES];
  return [...new Set(candidates)];
};

const isModelNotFoundError = (err) => {
  const message = String(err?.message || '');
  return err?.status === 404
    || message.includes('[404')
    || message.includes('is not found for API version')
    || message.includes('not supported for generateContent');
};

const localFallbackExtraction = (rawText) => {
  // Temporary resilience path for demos/testing when model availability is flaky.
  const segments = rawText
    .split(/[,.!?;\n]+/)
    .map((s) => s.trim())
    .filter(Boolean);

  const worries = segments.slice(0, 6).map((segment, idx) => {
    const short = segment.split(/\s+/).slice(0, 8).join(' ');
    const hasStressWords = /(can't|cannot|worried|anxious|stress|deadline|rent|money|health|afraid|panic)/i.test(segment);
    return {
      id: idx + 1,
      worry: short || 'general worry',
      weight: hasStressWords ? 7 : 5,
    };
  });

  if (!worries.length) {
    return [{ id: 1, worry: 'general overwhelm', weight: 5 }];
  }

  return worries;
};

const parseWorries = (responseText) => {
  const cleaned = responseText
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/```\s*$/i, '')
    .trim();

  let worries;
  try {
    worries = JSON.parse(cleaned);
  } catch {
    console.error('[Gemini] Failed to parse response as JSON:', cleaned);
    throw new Error('AI returned malformed JSON. Please try again.');
  }

  if (!Array.isArray(worries)) {
    throw new Error('AI returned unexpected data shape (expected array).');
  }

  return worries.map((item, idx) => ({
    id: item.id ?? idx + 1,
    worry: String(item.worry || 'unnamed worry').slice(0, 100),
    weight: Math.min(10, Math.max(1, Number(item.weight) || 5)),
  }));
};

/**
 * Extracts worries from a free-form text input.
 * @param {string} rawText - The user's unstructured worry paragraph.
 * @returns {Promise<Array<{id: number, worry: string, weight: number}>>}
 */
export const extractWorries = async (rawText) => {
  if (!rawText || rawText.trim().length < 3) {
    return [];
  }

  const client = getClient();
  const modelCandidates = buildModelCandidates();

  console.log(`[Gemini] Extracting worries from text (${rawText.length} chars)...`);

  let lastError = null;

  for (const modelName of modelCandidates) {
    try {
      console.log(`[Gemini] Trying model: ${modelName}`);
      const model = client.getGenerativeModel({
        model: modelName,
        systemInstruction: FORGE_SYSTEM_INSTRUCTION,
        generationConfig: {
          temperature: 0.2,
          topP: 0.8,
          maxOutputTokens: 1024,
        },
      });

      const result = await model.generateContent(rawText);
      const responseText = result.response.text().trim();
      console.log(`[Gemini] Raw response (${modelName}): ${responseText.substring(0, 200)}`);

      return parseWorries(responseText);
    } catch (err) {
      lastError = err;
      if (isModelNotFoundError(err)) {
        console.warn(`[Gemini] Model unavailable: ${modelName}. Trying next candidate...`);
        continue;
      }
      throw err;
    }
  }

  console.warn('[Gemini] All configured models failed. Using local fallback extractor for continuity.');
  if (lastError) {
    console.warn(`[Gemini] Last model error: ${lastError.message}`);
  }

  return localFallbackExtraction(rawText);
};
