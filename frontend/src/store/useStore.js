// src/store/useStore.js
// Zustand global store. Deliberately flat – hackathon pace.
// Each feature slice is a section in the same store (no need for separate files).

import { create } from 'zustand';
import { stateApi } from '../services/api.js';

const useStore = create((set, get) => ({
  // ── Session ───────────────────────────────────────────────
  userId: null,
  isInitialized: false,

  initSession: async () => {
    // Persist userId in localStorage so user picks up their session on refresh
    const stored = localStorage.getItem('aura-userId') || undefined;
    try {
      const data = await stateApi.init(stored);
      localStorage.setItem('aura-userId', data.userId);
      set({ userId: data.userId, isInitialized: true });
      return data;
    } catch {
      // If backend is down during demo, still let the app run
      const fallbackId = stored || `local-${Date.now()}`;
      localStorage.setItem('aura-userId', fallbackId);
      set({ userId: fallbackId, isInitialized: true });
    }
  },

  // ── Navigation ────────────────────────────────────────────
  activeTab: 'forge',   // 'voice' | 'forge' | 'shatter'
  setTab: (tab) => set({ activeTab: tab }),

  // ── Cognitive Forge state ─────────────────────────────────
  worries: [],          // [{uuid, id, worry, weight, status}] – live physics objects
  isExtracting: false,
  extractError: null,

  setWorries: (worries) => set({ worries }),

  addWorry: (worry) =>
    set((s) => ({ worries: [...s.worries, worry] })),

  markWorryDestroyed: (uuid) =>
    set((s) => ({
      worries: s.worries.map((w) =>
        w.uuid === uuid ? { ...w, status: 'destroyed' } : w
      ),
    })),

  setExtracting: (v) => set({ isExtracting: v }),
  setExtractError: (e) => set({ extractError: e }),

  // ── Task Shatterer state ──────────────────────────────────
  activeTask: null,       // full task object from backend
  currentQuestIndex: 0,   // index into microquests array
  isBreakingDown: false,
  taskComplete: false,

  setActiveTask: (task) =>
    set({
      activeTask: task,
      // Resume from the first INCOMPLETE quest
      currentQuestIndex: task
        ? task.microquests.findIndex((q) => !q.completed)
        : 0,
      taskComplete: false,
    }),

  advanceQuest: (nextQuest) => {
    const { activeTask, currentQuestIndex } = get();
    if (!activeTask) return;
    if (!nextQuest) {
      set({ taskComplete: true });
      return;
    }
    const nextIdx = activeTask.microquests.findIndex((q) => q.id === nextQuest.id);
    set({ currentQuestIndex: nextIdx >= 0 ? nextIdx : currentQuestIndex + 1 });
  },

  // Single atomic action used by TaskShatter's handleDone.
  // Marks the quest complete in the local copy AND advances the index
  // in one set() call — eliminates the double-write flicker.
  completeQuestLocally: (completedQuestId, nextQuest) => {
    const { activeTask } = get();
    if (!activeTask) return;

    const updatedMicroquests = activeTask.microquests.map((q) =>
      q.id === completedQuestId ? { ...q, completed: true } : q
    );
    const questsCompleted = updatedMicroquests.filter((q) => q.completed).length;

    if (!nextQuest) {
      set({
        activeTask: { ...activeTask, microquests: updatedMicroquests, questsCompleted },
        taskComplete: true,
      });
      return;
    }

    const nextIdx = updatedMicroquests.findIndex((q) => q.id === nextQuest.id);
    set({
      activeTask: { ...activeTask, microquests: updatedMicroquests, questsCompleted },
      currentQuestIndex: nextIdx >= 0 ? nextIdx : 0,
      taskComplete: false,
    });
  },

  setBreakingDown: (v) => set({ isBreakingDown: v }),
  clearTask: () => set({ activeTask: null, currentQuestIndex: 0, taskComplete: false }),

  // ── Aura Voice state ──────────────────────────────────────
  isListening: false,
  auraEmotion: 'calm',        // 'calm' | 'mild_anxiety' | 'high_anxiety'
  auraTranscript: '',
  auraResponse: '',
  audioMuted: false,
  isAuraSpeaking: false,

  setListening: (v) => set({ isListening: v }),
  setAuraEmotion: (e) => set({ auraEmotion: e }),
  setAuraTranscript: (t) => set({ auraTranscript: t }),
  setAuraResponse: (r) => set({ auraResponse: r }),
  setAudioMuted: (v) => set({ audioMuted: v }),
  setAuraSpeaking: (v) => set({ isAuraSpeaking: v }),
}));

export default useStore;
