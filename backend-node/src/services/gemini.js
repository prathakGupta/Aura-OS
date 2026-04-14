// src/services/gemini.js (Unified AI Engine)
// Consolidated Groq and OpenRouter integration with bulletproof headers.

import OpenAI from 'openai';

let aiClient = null;

const getClient = () => {
  if (!aiClient) {
    // Priority 1: Groq, Priority 2: OpenRouter
    const apiKey = process.env.GROQ_API_KEY || process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      throw new Error('API_KEY (GROQ or OPENROUTER) is not set in environment variables.');
    }

    aiClient = new OpenAI({
      baseURL: process.env.GROQ_API_KEY 
        ? 'https://api.groq.com/openai/v1' 
        : 'https://openrouter.ai/api/v1',
      apiKey: apiKey,
      defaultHeaders: {
        'Authorization': `Bearer ${apiKey}`,
        'HTTP-Referer': 'http://localhost:5173', 
        'X-Title': 'AuraOS', 
      },
    });
  }
  return aiClient;
};

const FORGE_SYSTEM_INSTRUCTION = `You are a cognitive extraction engine embedded in a mental health app called AuraOS.
Your sole job is to read messy, anxious, stream-of-consciousness text and extract each distinct worry.

RULES - follow these exactly:
1. Return ONLY valid JSON in this exact format: { "worries": [ { "id": 1, "worry": "short string", "weight": 5 } ] }
2. weight = emotional urgency/distress level (10 = most overwhelming, 1 = minor).
3. Combine duplicate or very similar worries into one entry.
4. Maximum 10 items.
5. Keep "worry" labels short enough to fit on a physics block - max 8 words.
6. If the text contains no worries, return { "worries": [] }`;

const localFallbackExtraction = (rawText) => {
  const segments = rawText.split(/[,.!?;\n]+/).map((s) => s.trim()).filter(Boolean);
  const worries = segments.slice(0, 6).map((segment, idx) => {
    const short = segment.split(/\s+/).slice(0, 8).join(' ');
    const hasStressWords = /(can't|cannot|worried|anxious|stress|deadline|rent|money|health|afraid|panic)/i.test(segment);
    return { id: idx + 1, worry: short || 'general worry', weight: hasStressWords ? 7 : 5 };
  });
  return worries.length ? worries : [{ id: 1, worry: 'general overwhelm', weight: 5 }];
};

/**
 * Extracts worries from text using the configured AI engine (Groq or OpenRouter).
 */
export const extractWorries = async (rawText) => {
  if (!rawText || rawText.trim().length < 3) return [];

  let client;
  try {
    client = getClient();
  } catch (err) {
    console.error(`[ForgeExtractor] Client init failed: ${err.message}`);
    console.warn('[ForgeExtractor] Falling back to local extractor.');
    return localFallbackExtraction(rawText);
  }

  const modelName = process.env.GROQ_API_KEY 
    ? (process.env.GROQ_MODEL || 'llama-3.1-8b-instant')
    : (process.env.OPENROUTER_MODEL || 'openai/gpt-4o-mini');

  console.log(`[ForgeExtractor] Extracting worries using ${modelName}...`);

  try {
    const response = await client.chat.completions.create({
      model: modelName,
      messages: [
        { role: "system", content: FORGE_SYSTEM_INSTRUCTION },
        { role: "user", content: rawText }
      ],
      temperature: 0.2,
      response_format: { type: 'json_object' } 
    });

    const parsed = JSON.parse(response.choices.message.content);
    return parsed.worries || [];

  } catch (err) {
    console.error(`[ForgeExtractor] Extraction failed: ${err.message}`);
    console.warn('[ForgeExtractor] Falling back to local extractor.');
    return localFallbackExtraction(rawText);
  }
};
