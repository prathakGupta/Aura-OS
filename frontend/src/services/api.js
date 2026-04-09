// src/services/api.js
// Centralised API layer for all calls to backend-node.
// • Timeout: 25s for AI endpoints (Gemini/Groq can be slow on first call)
// • AbortController: prevents ghost fetches after component unmount
// • All functions throw Error with the server's human-readable message

const BASE        = '/api';       // Vite proxy → http://localhost:5001
const AI_TIMEOUT  = 25_000;       // 25s — Gemini/Groq cold-start allowance
const API_TIMEOUT = 8_000;        // 8s  — DB + health endpoints

const req = async (method, path, body, timeoutMs = API_TIMEOUT) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(`${BASE}${path}`, {
      method,
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      ...(body ? { body: JSON.stringify(body) } : {}),
    });

    const json = await res.json();
    if (!res.ok || !json.success) {
      throw new Error(json.error || `Request failed (${res.status})`);
    }
    return json;
  } catch (err) {
    if (err.name === 'AbortError') {
      throw new Error('Request timed out. The AI is busy — please try again.');
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
};

const get    = (path)       => req('GET',    path);
const post   = (path, body) => req('POST',   path, body);
const postAI = (path, body) => req('POST',   path, body, AI_TIMEOUT);
const del    = (path)       => req('DELETE', path);

// ── State ─────────────────────────────────────────────────────────────────────
export const stateApi = {
  init: (userId) => post('/state/init', { userId }),
  get:  (userId) => get(`/state/${userId}`),
  wipe: (userId) => del(`/state/${userId}`),
};

// ── Cognitive Forge ───────────────────────────────────────────────────────────
export const forgeApi = {
  extract:       (text, userId)              => postAI('/forge/extract', { text, userId }),
  destroy:       (userId, worryId)           => post('/forge/destroy', { userId, worryId }),
  vault:         (userId, worryId, worry, weight) =>
                   post('/forge/vault', { userId, worryId, worry, weight }),
  getVault:      (userId)                    => get(`/forge/vault/${userId}`),
  deleteVaulted: (userId, worryId)           => del(`/forge/vault/${userId}/${worryId}`),
};

// ── Task Shatterer ────────────────────────────────────────────────────────────
export const shatterApi = {
  coachBreakdown: (task, blocker, userId)   => postAI('/shatter/breakdown', { task, userId, blocker }),
  breakdown: (task, userId)            => postAI('/shatter/breakdown', { task, userId }),
  syncTimeline: (userId, taskId, timeline)  => post('/shatter/sync-timeline', { userId, taskId, timeline }),
  complete:  (userId, taskId, questId) => post('/shatter/complete', { userId, taskId, questId }),
  abandon:   (userId, taskId)          => post('/shatter/abandon', { userId, taskId }),
  getActive: (userId)                  => get(`/shatter/active/${userId}`),
  getHistory:(userId)                  => get(`/shatter/history/${userId}`),
};
