// frontend/src/store/useStore.js
// Zustand global store — single flat store for hackathon pace.
// Extended with userProfile for mental-health personalization.

import { create } from 'zustand';
import { stateApi } from '../services/api.js';

// ── Safely load persisted profile from localStorage ──────────
// Runs once at module init; errors silently so a corrupted
// localStorage entry never crashes the whole app.
const loadPersistedProfile = () => {
  try {
    const raw = localStorage.getItem('aura-profile');
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    // Validate shape — must have at least profileId and primaryTab
    if (parsed && typeof parsed.profileId === 'string' && typeof parsed.primaryTab === 'string') {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
};

const useStore = create((set, get) => ({
  // ── Session ────────────────────────────────────────────────
  userId:        null,
  isInitialized: false,

  initSession: async () => {
    const stored = localStorage.getItem('aura-userId') || undefined;
    try {
      const data = await stateApi.init(stored);
      localStorage.setItem('aura-userId', data.userId);
      set({ userId: data.userId, isInitialized: true });
      return data;
    } catch {
      // If backend is down during demo, fall back gracefully
      const fallbackId = stored || `local-${Date.now()}`;
      localStorage.setItem('aura-userId', fallbackId);
      set({ userId: fallbackId, isInitialized: true });
    }
  },

  // ── Mental health profile ──────────────────────────────────
  // Shape: { profileId, severity, avgScore, primaryTab }
  // Loaded synchronously from localStorage on store creation.
  userProfile: loadPersistedProfile(),

  setUserProfile: (profile) => {
    try {
      localStorage.setItem('aura-profile', JSON.stringify(profile));
    } catch {
      // localStorage unavailable (private browsing, storage full, etc.) — non-fatal
    }
    set({ userProfile: profile });
  },

  clearUserProfile: () => {
    try {
      localStorage.removeItem('aura-profile');
    } catch { /* non-fatal */ }
    set({ userProfile: null });
  },

  // ── Clinical intake state ───────────────────────────────────
  // baselineArousalScore: 1–10 derived from intake answers.
  // isHighAnxietyMode:    true when score > 7 → dims UI, surfaces somatic tools.
  baselineArousalScore: null,
  isHighAnxietyMode:    false,

  // Maps the intake avgScore (1–4 frequency scale) to a 1–10 arousal score,
  // then atomically updates both fields. Triggers high-anxiety mode if > 7.
  setBaselineArousalScore: (intakeAvgScore) => {
    // intakeAvgScore is 1–4; scale to 1–10 linearly: score = (avg - 1) / 3 * 9 + 1
    const arousalScore = Math.round(((intakeAvgScore - 1) / 3) * 9 + 1);
    const clamped = Math.max(1, Math.min(10, arousalScore));
    set({
      baselineArousalScore: clamped,
      isHighAnxietyMode:    clamped > 7,
    });
    return clamped;
  },

  // ── Navigation ─────────────────────────────────────────────
  activeTab: 'forge',   // 'voice' | 'forge' | 'shatter'
  setTab: (tab) => set({ activeTab: tab }),

  // ── Cognitive Forge state ──────────────────────────────────
  worries:       [],    // [{ uuid, id, worry, weight, status }]
  isExtracting:  false,
  extractError:  null,

  setWorries:    (worries) => set({ worries }),
  addWorry:      (worry)   => set((s) => ({ worries: [...s.worries, worry] })),
  markWorryDestroyed: (uuid) =>
    set((s) => ({
      worries: s.worries.map((w) =>
        w.uuid === uuid ? { ...w, status: 'destroyed' } : w
      ),
    })),
  setExtracting: (v) => set({ isExtracting: v }),
  setExtractError:(e) => set({ extractError: e }),

  // ── Task Shatterer state ────────────────────────────────────
  activeTask:        null,
  currentQuestIndex: 0,
  isBreakingDown:    false,
  taskComplete:      false,

  // Clinical tracking
  lastKnownActivity: null,
  questTelemetry:    [],
  baselineProfile:   {},
  probeSessions:     [],
  
  setLastKnownActivity: (activity) => set({ lastKnownActivity: activity }),
  addQuestTelemetry: (telemetry) => set((s) => ({ questTelemetry: [...s.questTelemetry, telemetry] })),
  clearQuestTelemetry: () => set({ questTelemetry: [] }),
  setBaselineAnswer: (key, value) => set((s) => ({ baselineProfile: { ...s.baselineProfile, [key]: value } })),
  addProbeSession: (session) => set((s) => ({ probeSessions: [...s.probeSessions, session] })),

  // ── Master Session Aggregator ─────────────────────────────────
  // Snapshots ALL telemetry into one JSON blob for the clinical API.
  // Called by CognitiveForge / TaskShatter before dispatching to backend.
  generateSessionPayload: (overrides = {}) => {
    const s = get();
    const emotionToArousal = { calm: 3, mild_anxiety: 6, high_anxiety: 9 };
    const task = s.activeTask;
    return {
      userId:              s.userId,
      baselineArousalScore: s.baselineArousalScore,
      vocalArousalScore:   emotionToArousal[s.auraEmotion] || 5,
      baselineProfile:     s.baselineProfile,
      lastKnownActivity:   s.lastKnownActivity,
      worryBlocks:         s.worries.map(w => ({
        id: w.uuid || String(w.id), text: w.worry, weight: w.weight, status: w.status || 'active',
      })),
      probeSessions:       s.probeSessions.map(p => ({
        imageId: p.imageId, firstSeen: p.firstSeen, latencyMs: p.latencyMs,
        canSwitchPerspective: p.canSwitchPerspective,
      })),
      questTelemetry:      s.questTelemetry,
      activeTask:          task ? {
        task: task.originalTask, blocker: task.blocker,
        totalQuests: task.totalQuests, questsCompleted: task.questsCompleted,
      } : null,
      ...overrides,
    };
  },

  setActiveTask: (task) =>
    set({
      activeTask: task,
      // Resume from the first incomplete quest
      currentQuestIndex: task
        ? Math.max(0, task.microquests.findIndex((q) => !q.completed))
        : 0,
      taskComplete: false,
    }),

  advanceQuest: (nextQuest) => {
    const { activeTask, currentQuestIndex } = get();
    if (!activeTask) return;
    if (!nextQuest) { set({ taskComplete: true }); return; }
    const nextIdx = activeTask.microquests.findIndex((q) => q.id === nextQuest.id);
    set({ currentQuestIndex: nextIdx >= 0 ? nextIdx : currentQuestIndex + 1 });
  },

  // Atomic update: marks quest complete + advances index in ONE set() call.
  // Prevents the double-render flicker that occurred with two separate set() calls.
  completeQuestLocally: (completedQuestId, nextQuest) => {
    const { activeTask } = get();
    if (!activeTask) return;

    const updatedMicroquests = activeTask.microquests.map((q) =>
      q.id === completedQuestId ? { ...q, completed: true, completedAt: new Date() } : q
    );
    const questsCompleted = updatedMicroquests.filter((q) => q.completed).length;

    if (!nextQuest) {
      set({
        activeTask:   { ...activeTask, microquests: updatedMicroquests, questsCompleted },
        taskComplete: true,
      });
      return;
    }

    const nextIdx = updatedMicroquests.findIndex((q) => q.id === nextQuest.id);
    set({
      activeTask:        { ...activeTask, microquests: updatedMicroquests, questsCompleted },
      currentQuestIndex: nextIdx >= 0 ? nextIdx : 0,
      taskComplete:      false,
    });
  },

  setBreakingDown: (v) => set({ isBreakingDown: v }),
  clearTask:       ()  => set({ activeTask: null, currentQuestIndex: 0, taskComplete: false, questTelemetry: [], lastKnownActivity: null }),

  // ── Aura Voice state ────────────────────────────────────────
  isListening:    false,
  auraEmotion:    'calm',   // 'calm' | 'mild_anxiety' | 'high_anxiety'
  auraTranscript: '',
  auraResponse:   '',
  audioMuted:     false,
  isAuraSpeaking: false,

  setListening:    (v) => set({ isListening: v }),
  setAuraEmotion:  (e) => set({ auraEmotion: e }),
  setAuraTranscript:(t) => set({ auraTranscript: t }),
  setAuraResponse: (r) => set({ auraResponse: r }),
  setAudioMuted:   (v) => set({ audioMuted: v }),
  setAuraSpeaking: (v) => set({ isAuraSpeaking: v }),
}));

export default useStore;