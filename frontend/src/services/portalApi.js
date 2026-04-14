const BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:5001";
const CLINICAL = `${BASE}/api/clinical`;
const AI_TIMEOUT = 30_000;
const API_TIMEOUT = 8_000;

const req = async (method, path, body, timeoutMs = API_TIMEOUT, token = null) => {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);

  const headers = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  try {
    const res = await fetch(`${CLINICAL}${path}`, {
      method,
      headers,
      signal: ctrl.signal,
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    const json = await res.json();
    if (!res.ok || !json.success)
      throw new Error(json.error || `Request failed (${res.status})`);
    return json;
  } catch (err) {
    if (err.name === "AbortError")
      throw new Error("Request timed out — the AI is generating your report.");
    throw err;
  } finally {
    clearTimeout(timer);
  }
};

export const clinicalApi = {
  triggerAlert: (body, token) =>
    req("POST", "/trigger-alert", body, AI_TIMEOUT, token),

  sessionReport: (body, token) =>
    req("POST", "/session-report", body, AI_TIMEOUT, token),

  reportPdfUrl: (reportId) => `${CLINICAL}/session-report/${reportId}/pdf`,

  setGuardian: (body, token) =>
    req("POST", "/guardian", body, API_TIMEOUT, token),

  getDashboard: (userId, days = 7, token = null) =>
    req("GET", `/dashboard/${userId}?days=${days}`, null, API_TIMEOUT, token),

  therapyBrief: (userId, token = null) =>
    req("POST", "/therapy-brief", { userId }, AI_TIMEOUT, token),
};