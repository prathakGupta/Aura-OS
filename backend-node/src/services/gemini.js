// open router
// src/services/forgeExtractor.js (OpenRouter Engine)

import OpenAI from "openai";

let aiClient = null;

const getClient = () => {
  if (!aiClient) {
    const apiKey = process.env.OPENROUTER_API_KEY; // Or DEEPSEEK_API_KEY
    if (!apiKey) {
      throw new Error("API_KEY is not set in environment variables.");
    }
    aiClient = new OpenAI({
      baseURL: "https://openrouter.ai/api/v1",
      apiKey: apiKey,
      defaultHeaders: {
        "Authorization": `Bearer ${apiKey}`, // <-- THE BULLETPROOF FIX
        "HTTP-Referer": "http://localhost:5173", 
        "X-Title": "AuraOS", 
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
    const short = segment.split(/\s+/).slice(0, 8).join(" ");
    const hasStressWords = /(can't|cannot|worried|anxious|stress|deadline|rent|money|health|afraid|panic)/i.test(segment);
    return { id: idx + 1, worry: short || "general worry", weight: hasStressWords ? 7 : 5 };
  });
  return worries.length ? worries : [{ id: 1, worry: "general overwhelm", weight: 5 }];
};

export const extractWorries = async (rawText) => {
  if (!rawText || rawText.trim().length < 3) return [];

  const client = getClient();
  const modelName = process.env.OPENROUTER_MODEL || "openai/gpt-4o-mini";

  console.log(`[OpenRouter] Extracting worries using ${modelName}...`);

  try {
    const response = await client.chat.completions.create({
      model: modelName,
      messages: [
        { role: "system", content: FORGE_SYSTEM_INSTRUCTION },
        { role: "user", content: rawText }
      ],
      temperature: 0.2,
      // OpenRouter passes this down to models that support JSON mode
      response_format: { type: "json_object" } 
    });

    const parsed = JSON.parse(response.choices.message.content);
    return parsed.worries || [];

  } catch (err) {
    console.error(`[OpenRouter] Extraction failed: ${err.message}`);
    console.warn("[OpenRouter] Falling back to local extractor.");
    return localFallbackExtraction(rawText);
  }
};