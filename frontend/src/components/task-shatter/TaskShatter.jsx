// TaskShatter.jsx — Optimized v2.0
// Research-backed improvements:
// • Streamlined coaching: single-click blocker selection (no nested steps)
// • Visual time-blindness aid: Pomodoro-style focus timer
// • Streak tracker: consecutive quests = dopamine boost
// • Better canvas: simplified drag-to-slot with snap preview
// • Report generation: step-by-step loading overlay
// • Reduced cognitive friction throughout
// • EndeavorOTC/Tiimo-inspired visual progress feedback

import { useState, useCallback, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Zap, Trash2, Edit2, Check, Trophy, ArrowRight,
  RotateCcw, Music, VolumeX, Play, Brain, Volume2, Mountain,
  Clock, FileText, AlertTriangle, ChevronRight, Sparkles,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import useStore from '../../store/useStore.js';
import { shatterApi } from '../../services/api.js';
import { clinicalApi } from '../../services/portalApi.js';
import BodyDouble from './BodyDouble.jsx';
import SymptomInterruption from './SymptomInterruption.jsx';
import useFocusTimer from '../../hooks/useFocusTimer.js';
import useTelemetry from '../../hooks/useTelemetry.js';

/* ── Constants ──────────────────────────────────────────────────────── */
const COLORS = [
  { id:'cyan',   border:'#00e5ff', glow:'rgba(0,229,255,0.4)',   bg:'rgba(0,229,255,0.06)'   },
  { id:'purple', border:'#c4b5fd', glow:'rgba(196,181,253,0.4)', bg:'rgba(196,181,253,0.06)' },
  { id:'coral',  border:'#ff6b8a', glow:'rgba(255,107,138,0.4)', bg:'rgba(255,107,138,0.06)' },
  { id:'amber',  border:'#ffb300', glow:'rgba(255,179,0,0.4)',   bg:'rgba(255,179,0,0.06)'   },
  { id:'green',  border:'#00e676', glow:'rgba(0,230,118,0.4)',   bg:'rgba(0,230,118,0.06)'   },
];

// Research-backed blocker categories with env hints
const BLOCKERS = [
  {
    id: 'too_noisy',
    label: 'Too noisy / Distracted',
    icon: Volume2,
    color: '#00e5ff',
    desc: "Environment is loud and I can't focus",
    envHint: 'brown_noise',
    tip: 'Brown noise will activate',
  },
  {
    id: 'brain_fog',
    label: 'Brain fog / Exhaustion',
    icon: Brain,
    color: '#c4b5fd',
    desc: 'My mind feels slow and heavy today',
    envHint: 'deep_focus_dark',
    tip: 'Screen dims for focus',
  },
  {
    id: 'too_overwhelming',
    label: 'Too big / Frozen',
    icon: Mountain,
    color: '#ff6b8a',
    desc: "Task feels massive and I don't know where to start",
    envHint: 'meditation_first',
    tip: 'Breathing reset + guardian alert',
  },
];

/* ── Confetti helpers ───────────────────────────────────────────────── */
const slotConfetti = (x, y) => confetti({
  particleCount: 22, spread: 45,
  origin: { x: x / window.innerWidth, y: y / window.innerHeight },
  colors: ['#00e5ff', '#c4b5fd', '#00e676', '#ffb300'],
  ticks: 55, gravity: 0.6, scalar: 0.7, startVelocity: 12,
});

const bigConfetti = () => {
  const end = Date.now() + 2000;
  const burst = () => {
    confetti({ particleCount: 30, angle: 60, spread: 50, origin: { x: 0 }, colors: ['#7c3aed', '#00e5ff'] });
    confetti({ particleCount: 30, angle: 120, spread: 50, origin: { x: 1 }, colors: ['#c4b5fd', '#00e676'] });
    if (Date.now() < end) requestAnimationFrame(burst);
  };
  burst();
};

/* ── Random fragment scatter positions ──────────────────────────────── */
const randomPos = (i, total) => {
  const angle = (i / total) * 2 * Math.PI + (Math.random() - 0.5) * 0.9;
  const r = 160 + Math.random() * 120;
  return {
    x: Math.cos(angle) * r + (Math.random() - 0.5) * 50,
    y: Math.sin(angle) * r * 0.6 + (Math.random() - 0.5) * 35,
  };
};

const MAX_SLOTS = 8;

/* ── Pomodoro-style focus timer ─────────────────────────────────────── */
function FocusTimer({ isActive, durationMinutes = 2, onComplete }) {
  const [secondsLeft, setSecondsLeft] = useState(durationMinutes * 60);
  const [started, setStarted] = useState(false);
  const totalSeconds = durationMinutes * 60;
  const progress = ((totalSeconds - secondsLeft) / totalSeconds) * 100;

  useEffect(() => {
    if (!isActive) return;
    setStarted(true);
    const interval = setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) { clearInterval(interval); onComplete?.(); return 0; }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [isActive]); // eslint-disable-line

  const mins = Math.floor(secondsLeft / 60);
  const secs = secondsLeft % 60;
  const color = secondsLeft < 30 ? '#ff6b8a' : '#00e5ff';

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <div style={{ position: 'relative', width: 44, height: 44 }}>
        <svg width="44" height="44" viewBox="0 0 44 44" style={{ transform: 'rotate(-90deg)' }}>
          <circle cx="22" cy="22" r="18" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="3" />
          <circle cx="22" cy="22" r="18" fill="none" stroke={color}
            strokeWidth="3" strokeLinecap="round"
            strokeDasharray={`${2 * Math.PI * 18}`}
            strokeDashoffset={`${2 * Math.PI * 18 * (1 - progress / 100)}`}
            style={{ transition: 'stroke-dashoffset 0.9s ease, stroke 0.3s' }}
          />
        </svg>
        <div style={{
          position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 10, fontWeight: 800, color,
        }}>
          {started ? `${mins}:${String(secs).padStart(2, '0')}` : <Clock size={13} color="rgba(139,175,194,0.5)" />}
        </div>
      </div>
    </div>
  );
}

/* ── Fragment card ──────────────────────────────────────────────────── */
function FragmentCard({ frag, onPositionChange, onDelete, onTextChange, onColorChange, onDropToSlot, constraintsRef, isDocked, onDragVelocity }) {
  const [editing, setEditing] = useState(false);
  const [editVal, setEditVal] = useState(frag.text);
  const [hovered, setHovered] = useState(false);
  const [dragging, setDragging] = useState(false);
  const color = COLORS.find((c) => c.id === frag.colorId) || COLORS[0];
  if (isDocked) return null;

  const commitEdit = () => { onTextChange(frag.id, editVal.trim() || frag.text); setEditing(false); };

  return (
    <motion.div
      drag dragMomentum={false} dragConstraints={constraintsRef} dragElastic={0.06}
      initial={{ x: 0, y: 0, opacity: 0, scale: 0.3 }}
      animate={{ x: frag.x, y: frag.y, opacity: 1, scale: 1 }}
      transition={{ type: 'spring', stiffness: 200, damping: 20, opacity: { duration: 0.25 } }}
      whileDrag={{ scale: 1.08, zIndex: 100 }}
      onDragStart={() => setDragging(true)}
      onDragEnd={(e, info) => {
        setDragging(false);
        onDragVelocity?.(Math.abs(info.velocity.x), Math.abs(info.velocity.y));
        onPositionChange(frag.id, info.point.x - window.innerWidth / 2, info.point.y - window.innerHeight / 2);
        onDropToSlot(frag.id, info.point.x, info.point.y);
      }}
      onHoverStart={() => setHovered(true)}
      onHoverEnd={() => !dragging && setHovered(false)}
      style={{
        position: 'absolute', top: '50%', left: '50%',
        marginTop: -50, marginLeft: -108,
        width: 216, zIndex: hovered || dragging ? 90 : 10,
        cursor: dragging ? 'grabbing' : 'grab',
      }}
    >
      <div style={{
        background: dragging ? 'rgba(10,20,42,0.98)' : 'rgba(6,14,30,0.9)',
        backdropFilter: 'blur(20px)', borderRadius: 18,
        border: `1px solid ${color.border}`,
        boxShadow: dragging
          ? `0 24px 60px ${color.glow}, 0 0 0 1px ${color.border}, inset 0 1px 0 rgba(255,255,255,0.06)`
          : `0 6px 24px ${color.glow.replace('0.4', '0.15')}, 0 0 0 0.5px ${color.border}40`,
        padding: '13px 15px',
        transition: 'box-shadow 0.2s, background 0.2s',
      }}>
        {/* Color dots + actions */}
        <div style={{ display: 'flex', gap: 4, marginBottom: 9, alignItems: 'center' }}>
          {COLORS.map((c) => (
            <button key={c.id} onClick={(e) => { e.stopPropagation(); onColorChange(frag.id, c.id); }}
              style={{
                width: frag.colorId === c.id ? 11 : 7, height: frag.colorId === c.id ? 11 : 7,
                borderRadius: '50%', background: c.border,
                border: frag.colorId === c.id ? '2px solid white' : 'none',
                boxShadow: frag.colorId === c.id ? `0 0 7px ${c.border}` : 'none',
                cursor: 'pointer', transition: 'all 0.15s', flexShrink: 0,
              }}
            />
          ))}
          <div style={{ flex: 1 }} />
          <AnimatePresence>
            {(hovered || dragging) && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                style={{ display: 'flex', gap: 3 }}>
                <button onClick={(e) => { e.stopPropagation(); setEditing(true); setEditVal(frag.text); }}
                  style={{ padding: 3, borderRadius: 6, background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.5)', display: 'flex' }}>
                  <Edit2 size={10} />
                </button>
                <button onClick={(e) => { e.stopPropagation(); onDelete(frag.id); }}
                  style={{ padding: 3, borderRadius: 6, background: 'rgba(255,107,138,0.1)', color: '#ff6b8a', display: 'flex' }}>
                  <Trash2 size={10} />
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {editing ? (
          <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
            <input autoFocus value={editVal} onChange={(e) => setEditVal(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') commitEdit(); if (e.key === 'Escape') setEditing(false); }}
              onClick={(e) => e.stopPropagation()}
              style={{ flex: 1, background: 'rgba(255,255,255,0.06)', border: `1px solid ${color.border}`, borderRadius: 8, padding: '6px 8px', color: '#e8f4fb', fontSize: 13, fontFamily: 'inherit', outline: 'none' }}
            />
            <button onClick={commitEdit} style={{ color: color.border, display: 'flex' }}><Check size={13} /></button>
          </div>
        ) : (
          <p onDoubleClick={() => { setEditing(true); setEditVal(frag.text); }}
            style={{ fontSize: 13, fontWeight: 700, color: '#e8f4fb', lineHeight: 1.4, letterSpacing: '-0.01em', userSelect: 'none', minHeight: 34 }}>
            {frag.text}
          </p>
        )}
        <p style={{ fontSize: 10, color: color.border, marginTop: 7, opacity: 0.75, letterSpacing: '0.06em', textTransform: 'uppercase', fontWeight: 600 }}>
          ~{frag.duration_minutes || 2} min
        </p>
      </div>
    </motion.div>
  );
}

/* ── Report generation overlay ──────────────────────────────────────── */
function ReportOverlay({ onClose, reportInfo, error }) {
  const steps = ['Compiling session data', 'Generating AI summary', 'Building PDF', 'Dispatching to guardian'];
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (reportInfo || error) return;
    const t = setInterval(() => setStep((s) => Math.min(s + 1, steps.length - 1)), 1800);
    return () => clearInterval(t);
  }, [reportInfo, error]); // eslint-disable-line

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      style={{
        position: 'fixed', inset: 0, zIndex: 600,
        background: 'rgba(2,9,21,0.92)', backdropFilter: 'blur(24px)',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 24,
      }}
    >
      {!reportInfo && !error ? (
        <>
          <div style={{ width: 56, height: 56, border: '3px solid rgba(0,229,255,0.15)', borderTopColor: '#00e5ff', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
          <div style={{ textAlign: 'center' }}>
            <p style={{ fontSize: 18, fontWeight: 700, color: '#e8f4fb', marginBottom: 20 }}>Generating your report…</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxWidth: 320 }}>
              {steps.map((s, i) => (
                <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{
                    width: 20, height: 20, borderRadius: '50%', flexShrink: 0,
                    background: i < step ? '#00e676' : i === step ? 'rgba(0,229,255,0.3)' : 'rgba(255,255,255,0.06)',
                    border: i === step ? '2px solid #00e5ff' : 'none',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    transition: 'all 0.4s',
                  }}>
                    {i < step && <Check size={11} color="#020915" strokeWidth={3} />}
                  </div>
                  <span style={{ fontSize: 13, color: i <= step ? 'var(--text-1)' : 'var(--text-3)', transition: 'color 0.4s' }}>{s}</span>
                </div>
              ))}
            </div>
          </div>
        </>
      ) : error ? (
        <div style={{ textAlign: 'center', maxWidth: 400 }}>
          <AlertTriangle size={40} color="#ff6b8a" style={{ margin: '0 auto 16px' }} />
          <p style={{ fontSize: 16, fontWeight: 700, color: '#ff6b8a', marginBottom: 8 }}>Report generation failed</p>
          <p style={{ fontSize: 13, color: 'var(--text-3)', marginBottom: 20 }}>{error}</p>
          <button className="btn btn-secondary" onClick={onClose}>Close</button>
        </div>
      ) : (
        <div style={{ textAlign: 'center', maxWidth: 420 }}>
          <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 200 }}>
            <div style={{ width: 70, height: 70, borderRadius: '50%', background: 'rgba(0,230,118,0.12)', border: '2px solid #00e676', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
              <Check size={32} color="#00e676" strokeWidth={2.5} />
            </div>
          </motion.div>
          <p style={{ fontSize: 18, fontWeight: 800, color: '#e8f4fb', marginBottom: 8 }}>Report ready!</p>
          <p style={{ fontSize: 13, color: 'var(--text-3)', marginBottom: 20 }}>
            Risk level: <span style={{ color: reportInfo.riskLevel === 'acute-distress' ? '#ff6b8a' : '#ffb300', fontWeight: 700 }}>{reportInfo.riskLevel}</span>
            {reportInfo.delivery?.whatsapp?.status === 'sent' && ' · Guardian notified via WhatsApp'}
            {reportInfo.delivery?.email?.status === 'sent' && ' · Email dispatched'}
          </p>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
            {reportInfo.downloadUrl && (
              <button className="btn btn-primary"
                onClick={() => window.open(reportInfo.downloadUrl, '_blank', 'noopener,noreferrer')} style={{ fontSize: 13 }}>
                <FileText size={13} /> Open PDF
              </button>
            )}
            <button className="btn btn-secondary" onClick={onClose} style={{ fontSize: 13 }}>Done</button>
          </div>
        </div>
      )}
    </motion.div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   MAIN COMPONENT
 ═══════════════════════════════════════════════════════════════════ */
export default function TaskShatter() {
  const {
    userId, activeTask, setActiveTask, completeQuestLocally,
    clearTask, taskComplete, currentQuestIndex, worries,
  } = useStore();

  // Phase: 'input' | 'coaching' | 'intervention' | 'loading' | 'canvas' | 'focus' | 'done'
  const [phase, setPhase] = useState('input');
  const [taskText, setTaskText] = useState('');
  const [selectedBlocker, setBlocker] = useState(null);
  const [coachData, setCoachData] = useState(null);
  const [fragments, setFragments] = useState([]);
  const [slots, setSlots] = useState(Array(MAX_SLOTS).fill(null));
  const [error, setError] = useState(null);
  const [completing, setCompleting] = useState(false);
  const [showBodyDouble, setBodyDouble] = useState(false);
  const [apiTaskId, setApiTaskId] = useState(null);
  const [originalTask, setOriginalTask] = useState('');
  const [reportOverlay, setReportOverlay] = useState(null); // null | 'loading' | { info } | { error }
  const [questStreak, setQuestStreak] = useState(0);
  const [focusTimerActive, setFocusTimerActive] = useState(false);

  const constraintsRef = useRef(null);
  const dockRef = useRef(null);
  const apiCallRef = useRef(null);

  const { noiseEnabled, toggleNoise } = useFocusTimer({
    isTaskActive: phase === 'focus',
    onDistracted: () => setBodyDouble(true),
    onReturned: () => setBodyDouble(false),
  });
  const { recordDragEvent } = useTelemetry();

  const focusQuests = activeTask?.microquests || [];
  const focusQuest = focusQuests[currentQuestIndex] || null;
  const completedN = focusQuests.filter((q) => q.completed).length;
  const progress = focusQuests.length ? Math.round((completedN / focusQuests.length) * 100) : 0;

  // Auto-apply env strategy from coach AI
  useEffect(() => {
    if (phase !== 'canvas' && phase !== 'focus') return;
    const strategy = coachData?.envStrategy || coachData?.environment_strategy;
    if (strategy === 'brown_noise' && !noiseEnabled) toggleNoise();
    if (strategy === 'deep_focus_dark') document.body.style.filter = 'brightness(0.78)';
    return () => { document.body.style.filter = ''; };
  }, [phase, coachData]); // eslint-disable-line

  // Start focus timer when entering focus phase
  useEffect(() => {
    if (phase === 'focus') setFocusTimerActive(true);
    else setFocusTimerActive(false);
  }, [phase, currentQuestIndex]);

  // ── Phase transitions ────────────────────────────────────────────────────
  const handleShowCoach = () => {
    if (!taskText.trim()) return;
    setOriginalTask(taskText.trim());
    setPhase('coaching');
  };

  const handleBlockerSelected = async (blocker) => {
    setBlocker(blocker);
    setError(null);

    if (blocker.id === 'too_overwhelming') {
      setPhase('intervention');
      apiCallRef.current = Promise.all([
        shatterApi.coachBreakdown(taskText.trim(), blocker.id, userId).catch(() => null),
        clinicalApi.sessionReport({
          userId, source: 'panic',
          currentTask: taskText.trim(),
          selectedBlocker: blocker.label,
          vocalArousalScore: 8,
          sendToGuardian: true,
          channels: { whatsapp: true, email: true },
          sessionSnapshot: {
            initialAnxietyQuery: taskText.trim(),
            shatteredWorryBlocks: worries.map((w) => ({ id: w.uuid || String(w.id), text: w.worry, weight: w.weight, status: w.status || 'active' })),
          },
        }).catch(() => null),
      ]);
    } else {
      setPhase('loading');
      try {
        const result = await shatterApi.coachBreakdown(taskText.trim(), blocker.id, userId);
        await _processAiResult(result);
      } catch {
        try {
          const result2 = await shatterApi.breakdown(taskText.trim(), userId);
          await _processAiResult({ microquests: result2.microquests, coachMessage: null, envStrategy: null });
        } catch (e2) { setError(e2.message); setPhase('coaching'); }
      }
    }
  };

  const handleInterventionComplete = async () => {
    setPhase('loading');
    try {
      const [shatterResult, alertRes] = await (apiCallRef.current || Promise.resolve([null, null]));
      if (shatterResult) await _processAiResult(shatterResult);
      else {
        const fallback = await shatterApi.breakdown(taskText.trim(), userId);
        await _processAiResult({ microquests: fallback.microquests, coachMessage: null, envStrategy: null });
      }
      // Show subtle alert result if available
      if (alertRes?.riskLevel) {
        // Non-blocking notification — just log
        console.log('[AuraOS] Guardian triage:', alertRes.riskLevel);
      }
    } catch (e) { setError(e.message); setPhase('coaching'); }
  };

  const _processAiResult = async (result) => {
    const rawQuests = result.microquests || [];
    setApiTaskId(result.taskId || null);
    setCoachData({ coachMessage: result.coachMessage, envStrategy: result.envStrategy });
    const frags = rawQuests.map((q, i, arr) => {
      const { x, y } = randomPos(i, arr.length);
      return {
        id: String(q.id || i + 1),
        text: q.action || q.text || `Step ${i + 1}`,
        tip: q.tip || "You've got this.",
        duration_minutes: q.duration_minutes || 2,
        colorId: q.colorId || ['cyan', 'purple', 'amber', 'green', 'coral'][i % 5],
        x, y, slotIndex: null,
      };
    });
    setFragments(frags);
    setSlots(Array(Math.max(MAX_SLOTS, frags.length)).fill(null));
    setPhase('canvas');
  };

  // ── Fragment CRUD ────────────────────────────────────────────────────────
  const handleDelete = useCallback((id) => {
    setFragments((p) => p.filter((f) => f.id !== id));
    setSlots((p) => p.map((s) => s === id ? null : s));
  }, []);
  const handleTextChange = useCallback((id, text) => setFragments((p) => p.map((f) => f.id === id ? { ...f, text } : f)), []);
  const handleColorChange = useCallback((id, colorId) => setFragments((p) => p.map((f) => f.id === id ? { ...f, colorId } : f)), []);
  const handlePositionChange = useCallback((id, x, y) => setFragments((p) => p.map((f) => f.id === id ? { ...f, x, y } : f)), []);

  const handleDropToSlot = useCallback((fragId, absX, absY) => {
    if (!dockRef.current) return;
    const dock = dockRef.current.getBoundingClientRect();
    if (absX < dock.left || absX > dock.right) return;
    if (absY < dock.top - 50 || absY > dock.bottom) return;
    const slotEls = dockRef.current.querySelectorAll('[data-slot]');
    let closestSlot = null, closestDist = Infinity;
    slotEls.forEach((el) => {
      const r = el.getBoundingClientRect();
      const dist = Math.abs(absX - (r.left + r.right) / 2);
      if (dist < closestDist) { closestDist = dist; closestSlot = parseInt(el.getAttribute('data-slot'), 10); }
    });
    if (closestSlot === null) return;
    setSlots((prev) => {
      const next = [...prev];
      const existing = next.indexOf(fragId);
      if (existing !== -1) next[existing] = null;
      if (next[closestSlot] !== null) return prev;
      next[closestSlot] = fragId;
      return next;
    });
    setFragments((prev) => prev.map((f) => f.id === fragId ? { ...f, slotIndex: closestSlot } : f));
    const slotEl = dockRef.current.querySelector(`[data-slot="${closestSlot}"]`);
    if (slotEl) { const r = slotEl.getBoundingClientRect(); slotConfetti((r.left + r.right) / 2, (r.top + r.bottom) / 2); }
  }, []);

  const ejectFromSlot = useCallback((fragId, slotIndex) => {
    setSlots((prev) => { const n = [...prev]; n[slotIndex] = null; return n; });
    setFragments((prev) => prev.map((f) => f.id === fragId ? { ...f, slotIndex: null, x: (Math.random() - 0.5) * 240, y: -80 } : f));
  }, []);

  const handleLaunchFocus = async () => {
    const ordered = slots.filter(Boolean).map((fragId, i) => {
      const f = fragments.find((fr) => fr.id === fragId);
      return f ? { id: i + 1, action: f.text, tip: f.tip || "You've got this.", duration_minutes: f.duration_minutes || 2, completed: false } : null;
    }).filter(Boolean);
    if (apiTaskId) {
      try { await shatterApi.syncTimeline(userId, apiTaskId, ordered); } catch { /* non-fatal */ }
    }
    setActiveTask({ id: apiTaskId || `local-${Date.now()}`, originalTask, microquests: ordered, totalQuests: ordered.length, questsCompleted: 0 });
    setPhase('focus');
    setQuestStreak(0);
    bigConfetti();
  };

  const handleDone = useCallback(async () => {
    if (!focusQuest || completing) return;
    setCompleting(true);
    try {
      const newStreak = questStreak + 1;
      setQuestStreak(newStreak);
      setFocusTimerActive(false);

      if (apiTaskId) {
        const data = await shatterApi.complete(userId, activeTask.id, focusQuest.id);
        if (data.taskComplete) { bigConfetti(); completeQuestLocally(focusQuest.id, null); }
        else { slotConfetti(window.innerWidth / 2, window.innerHeight * 0.65); completeQuestLocally(focusQuest.id, data.nextQuest); }
      } else {
        const rem = focusQuests.filter((q) => !q.completed && q.id !== focusQuest.id);
        if (!rem.length) { bigConfetti(); completeQuestLocally(focusQuest.id, null); }
        else { slotConfetti(window.innerWidth / 2, window.innerHeight * 0.65); completeQuestLocally(focusQuest.id, rem[0]); }
      }
      // Streak milestone feedback
      if (newStreak >= 3) {
        setTimeout(() => confetti({ particleCount: 60, spread: 80, origin: { y: 0.5 }, colors: ['#ffb300', '#c4b5fd'] }), 100);
      }
    } catch (e) { setError(e.message); }
    finally { setCompleting(false); }
  }, [focusQuest, completing, userId, activeTask, focusQuests, apiTaskId, completeQuestLocally, questStreak]);

  const handleGenerateReport = useCallback(async (sendToGuardian = false) => {
    if (!userId) return;
    setReportOverlay('loading');
    setError(null);
    try {
      const timelineMicroquests = (activeTask?.microquests || []).map((q, idx) => ({
        order: idx + 1, id: String(q.id || idx + 1), action: q.action || '',
        tip: q.tip || '', duration_minutes: q.duration_minutes || 2, completed: Boolean(q.completed),
      }));
      const res = await clinicalApi.sessionReport({
        userId,
        source: sendToGuardian ? 'panic' : 'manual',
        taskId: apiTaskId || activeTask?.id,
        currentTask: originalTask || taskText,
        selectedBlocker: selectedBlocker?.label || null,
        vocalArousalScore: selectedBlocker?.id === 'too_overwhelming' ? 8 : 5,
        sendToGuardian,
        channels: { whatsapp: true, email: true },
        sessionSnapshot: {
          initialAnxietyQuery: taskText || originalTask,
          shatteredWorryBlocks: worries.map((w) => ({ id: w.uuid || String(w.id), text: w.worry, weight: w.weight, status: w.status || 'active' })),
          timelineMicroquests,
        },
      });
      setReportOverlay({ info: res });
    } catch (e) {
      setReportOverlay({ error: e.message || 'Report generation failed.' });
    }
  }, [userId, activeTask, apiTaskId, originalTask, taskText, selectedBlocker, worries]);

  const handleReset = () => {
    if (activeTask) shatterApi.abandon(userId, activeTask?.id).catch(() => {});
    clearTask();
    setPhase('input'); setFragments([]); setSlots(Array(MAX_SLOTS).fill(null));
    setTaskText(''); setApiTaskId(null); setError(null); setCoachData(null);
    setBlocker(null); setReportOverlay(null); setQuestStreak(0);
    document.body.style.filter = '';
  };

  const activeFreeFrags = fragments.filter((f) => f.slotIndex === null);
  const dockedCount = fragments.filter((f) => f.slotIndex !== null).length;
  const allDocked = fragments.length > 0 && activeFreeFrags.length === 0;

  const canvasBg = {
    background: '#020915',
    backgroundImage: `
      radial-gradient(ellipse 80% 50% at 50% 0%, rgba(0,60,110,0.55) 0%, transparent 55%),
      radial-gradient(ellipse 50% 50% at 10% 80%, rgba(124,58,237,0.07) 0%, transparent 55%),
      radial-gradient(ellipse 50% 50% at 90% 75%, rgba(0,191,165,0.05) 0%, transparent 55%)
    `,
  };
  const dotGrid = { position: 'absolute', inset: 0, pointerEvents: 'none', backgroundImage: 'radial-gradient(rgba(0,229,255,0.08) 1px, transparent 1px)', backgroundSize: '36px 36px', opacity: 0.25 };

  /* ── PHASE: INPUT ─────────────────────────────────────────────────────── */
  if (phase === 'input') return (
    <div style={{ position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', ...canvasBg }}>
      <div style={{ ...dotGrid }} />
      <motion.div initial={{ opacity: 0, y: 30, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ type: 'spring', stiffness: 160, damping: 18 }}
        style={{ width: '100%', maxWidth: 560, padding: '0 22px', position: 'relative', zIndex: 1 }}>
        <div style={{ textAlign: 'center', marginBottom: 36 }}>
          <motion.div animate={{ scale: [1, 1.08, 1], opacity: [0.7, 1, 0.7] }} transition={{ duration: 3.5, repeat: Infinity, ease: 'easeInOut' }}
            style={{
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              width: 56, height: 56, borderRadius: '50%', marginBottom: 18,
              background: 'conic-gradient(from 180deg,#7c3aed,#00e5ff,#00bfa5,#7c3aed)',
              boxShadow: '0 0 28px rgba(0,229,255,0.35),0 0 60px rgba(124,58,237,0.2)',
            }}>
            <Zap size={24} color="white" />
          </motion.div>
          <h1 style={{ fontSize: 'clamp(26px,5vw,36px)', fontWeight: 800, letterSpacing: '-0.045em', color: '#e8f4fb', lineHeight: 1.15, marginBottom: 10 }}>
            What's{' '}
            <span style={{ background: 'linear-gradient(135deg,#00e5ff,#c4b5fd)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              stopping you?
            </span>
          </h1>
          <p style={{ fontSize: 14.5, color: '#8bafc2', lineHeight: 1.65 }}>
            Describe the task that's paralysing you. Aura's Coach will break it into 2-minute steps tailored to how you feel right now.
          </p>
        </div>

        <div style={{ position: 'relative', marginBottom: 16 }}>
          <textarea value={taskText} onChange={(e) => setTaskText(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && e.metaKey) handleShowCoach(); }}
            rows={4} placeholder="e.g. Build the backend for my project..."
            style={{
              width: '100%', background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(0,229,255,0.2)',
              borderRadius: 18, padding: '18px 22px', color: '#e8f4fb', fontFamily: 'inherit',
              fontSize: 15.5, lineHeight: 1.7, resize: 'none', outline: 'none',
              boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04)', transition: 'border-color 0.2s, box-shadow 0.2s',
            }}
            onFocus={(e) => { e.target.style.borderColor = 'rgba(0,229,255,0.5)'; e.target.style.boxShadow = '0 0 0 3px rgba(0,229,255,0.1)'; }}
            onBlur={(e) => { e.target.style.borderColor = 'rgba(0,229,255,0.2)'; e.target.style.boxShadow = 'none'; }}
          />
          <div style={{ position: 'absolute', bottom: 13, right: 16, fontSize: 11, color: 'rgba(139,175,194,0.4)', fontWeight: 500 }}>⌘↵</div>
        </div>

        <motion.button onClick={handleShowCoach} disabled={taskText.trim().length < 3}
          whileHover={{ scale: 1.02, boxShadow: '0 12px 40px rgba(124,58,237,0.45)' }} whileTap={{ scale: 0.97 }}
          style={{
            width: '100%', padding: '17px', background: 'linear-gradient(135deg,#5b21b6,#7c3aed,#00b4d8)',
            backgroundSize: '200% 200%', animation: 'gradSpin 6s ease infinite',
            border: 'none', borderRadius: 16, color: 'white', fontFamily: 'inherit',
            fontSize: 16, fontWeight: 800, letterSpacing: '-0.025em',
            cursor: taskText.trim().length < 3 ? 'not-allowed' : 'pointer',
            opacity: taskText.trim().length < 3 ? 0.45 : 1,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
          }}>
          <Brain size={18} /> Talk to Aura Coach <ArrowRight size={16} />
        </motion.button>
        {error && <p style={{ marginTop: 14, fontSize: 13, color: '#ffb3c1', textAlign: 'center' }}>{error}</p>}
      </motion.div>
    </div>
  );

  /* ── PHASE: COACHING — streamlined single-screen blocker selection ──── */
  if (phase === 'coaching') return (
    <div style={{ position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', ...canvasBg }}>
      <div style={{ ...dotGrid }} />
      <motion.div initial={{ opacity: 0, scale: 0.93, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} transition={{ type: 'spring', stiffness: 220, damping: 22 }}
        style={{ width: '100%', maxWidth: 500, padding: '0 22px', position: 'relative', zIndex: 1 }}>
        <div style={{ background: 'rgba(6,14,30,0.9)', backdropFilter: 'blur(24px)', border: '1px solid rgba(0,229,255,0.15)', borderRadius: 28, padding: '34px 30px' }}>
          {/* Task preview */}
          <div style={{ background: 'rgba(0,229,255,0.04)', border: '1px solid rgba(0,229,255,0.12)', borderRadius: 14, padding: '12px 16px', marginBottom: 24 }}>
            <p style={{ fontSize: 10.5, color: '#00e5ff', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 4 }}>Breaking down</p>
            <p style={{ fontSize: 14, color: '#e8f4fb', fontWeight: 600, lineHeight: 1.4 }}>
              {taskText.length > 60 ? taskText.slice(0, 60) + '…' : taskText}
            </p>
          </div>

          <p style={{ fontSize: 14, color: '#8bafc2', lineHeight: 1.6, marginBottom: 20, textAlign: 'center' }}>
            One quick question — what's the main thing holding you back right now?
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {BLOCKERS.map((b) => {
              const Icon = b.icon;
              return (
                <motion.button key={b.id} onClick={() => handleBlockerSelected(b)}
                  whileHover={{ scale: 1.015, borderColor: `${b.color}60` }}
                  whileTap={{ scale: 0.975 }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 14, padding: '15px 18px',
                    background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.07)',
                    borderRadius: 16, cursor: 'pointer', textAlign: 'left',
                    transition: 'border-color 0.2s, background 0.2s',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = `${b.color}08`; e.currentTarget.style.borderColor = `${b.color}30`; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.025)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.07)'; }}
                >
                  <div style={{
                    width: 44, height: 44, borderRadius: 13,
                    background: `${b.color}10`, border: `1px solid ${b.color}25`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                  }}>
                    <Icon size={20} color={b.color} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontSize: 14, fontWeight: 700, color: '#e8f4fb', marginBottom: 3 }}>{b.label}</p>
                    <p style={{ fontSize: 12, color: '#4a6275' }}>{b.desc}</p>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 3, flexShrink: 0 }}>
                    <ChevronRight size={14} color="rgba(139,175,194,0.3)" />
                    <span style={{ fontSize: 9.5, color: b.color, opacity: 0.7, whiteSpace: 'nowrap' }}>{b.tip}</span>
                  </div>
                </motion.button>
              );
            })}
          </div>

          <button onClick={() => setPhase('input')} style={{ display: 'block', margin: '18px auto 0', fontSize: 12, color: '#4a6275', background: 'none', border: 'none', cursor: 'pointer' }}>
            ← Change task
          </button>
        </div>
      </motion.div>
    </div>
  );

  /* ── PHASE: INTERVENTION ───────────────────────────────────────────────── */
  if (phase === 'intervention') return (
    <>
      <div style={{ position: 'fixed', inset: 0, ...canvasBg }} />
      <SymptomInterruption
        onComplete={handleInterventionComplete}
        coachMessage={`I hear you. "${taskText.slice(0, 50)}…" feels overwhelming right now. Your support network has been notified. Let's reset first — just breathe.`}
      />
    </>
  );

  /* ── PHASE: LOADING ────────────────────────────────────────────────────── */
  if (phase === 'loading') return (
    <div style={{ position: 'fixed', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 28, ...canvasBg }}>
      <div style={{ ...dotGrid }} />
      <div style={{ position: 'relative', width: 100, height: 100, flexShrink: 0 }}>
        {[0, 1, 2, 3, 4].map((i) => (
          <motion.div key={i}
            style={{
              position: 'absolute', top: '50%', left: '50%', width: 12, height: 12,
              borderRadius: '30% 70% 70% 30% / 30% 30% 70% 70%',
              background: COLORS[i % COLORS.length].border,
              boxShadow: `0 0 10px ${COLORS[i % COLORS.length].glow}`,
              marginLeft: -6, marginTop: -6,
            }}
            animate={{ x: Math.cos((i / 5) * Math.PI * 2) * 35, y: Math.sin((i / 5) * Math.PI * 2) * 35, rotate: [0, 360], scale: [0.8, 1.3, 0.8] }}
            transition={{ duration: 1.1 + i * 0.12, repeat: Infinity, ease: 'easeInOut', delay: i * 0.1 }}
          />
        ))}
        <motion.div animate={{ scale: [1, 1.25, 1], opacity: [0.6, 1, 0.6] }} transition={{ duration: 1.4, repeat: Infinity }}
          style={{ position: 'absolute', top: '50%', left: '50%', width: 26, height: 26, borderRadius: '50%', marginLeft: -13, marginTop: -13, background: 'radial-gradient(circle,#00e5ff,#7c3aed)', boxShadow: '0 0 18px rgba(0,229,255,0.6)' }} />
      </div>
      <div style={{ textAlign: 'center', position: 'relative', zIndex: 1 }}>
        <p style={{ fontSize: 17, fontWeight: 700, color: '#e8f4fb', letterSpacing: '-0.03em', marginBottom: 8 }}>
          {selectedBlocker ? `Calibrating for "${selectedBlocker.label.toLowerCase()}"…` : 'Shattering the task…'}
        </p>
        <p style={{ fontSize: 13, color: '#8bafc2' }}>Generating 2-minute micro-steps just for you</p>
      </div>
    </div>
  );

  /* ── PHASE: FOCUS ──────────────────────────────────────────────────────── */
  if (phase === 'focus') {
    if (taskComplete || !focusQuest) return (
      <>
        {reportOverlay && (
          <AnimatePresence>
            <ReportOverlay
              onClose={() => setReportOverlay(null)}
              reportInfo={reportOverlay?.info || null}
              error={reportOverlay?.error || null}
            />
          </AnimatePresence>
        )}
        <div style={{ position: 'fixed', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 22, ...canvasBg }}>
          <motion.div initial={{ scale: 0.3, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: 'spring', stiffness: 200, damping: 15 }}>
            <Trophy size={68} color="#ffb300" style={{ filter: 'drop-shadow(0 0 20px rgba(255,179,0,0.5))' }} />
          </motion.div>
          <div style={{ textAlign: 'center' }}>
            <h1 style={{ fontSize: 32, fontWeight: 800, color: '#e8f4fb', letterSpacing: '-0.04em', marginBottom: 8 }}>Completely shattered. ✦</h1>
            <p style={{ color: '#8bafc2', fontSize: 14 }}>{originalTask}</p>
            {questStreak >= 3 && (
              <div style={{ marginTop: 12, fontSize: 13, color: '#ffb300', fontWeight: 700 }}>
                🔥 {questStreak}-quest streak — incredible focus!
              </div>
            )}
          </div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center' }}>
            <motion.button className="btn btn-primary" onClick={handleReset} whileHover={{ scale: 1.03 }} style={{ padding: '14px 32px', fontSize: 15 }}>
              <Zap size={15} /> Shatter another
            </motion.button>
            <motion.button className="btn btn-secondary" onClick={() => handleGenerateReport(false)} whileTap={{ scale: 0.97 }}>
              <FileText size={13} /> Session Report
            </motion.button>
            <motion.button className="btn btn-ghost" onClick={() => handleGenerateReport(true)} whileTap={{ scale: 0.97 }}>
              Send to Guardian
            </motion.button>
          </div>
        </div>
      </>
    );

    return (
      <>
        {showBodyDouble && <BodyDouble taskAction={focusQuest?.action} onDismiss={() => setBodyDouble(false)} isFullscreen />}

        <AnimatePresence>
          {reportOverlay && (
            <ReportOverlay
              onClose={() => setReportOverlay(null)}
              reportInfo={reportOverlay?.info || null}
              error={reportOverlay?.error || null}
            />
          )}
        </AnimatePresence>

        <div style={{ position: 'fixed', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '0 22px', ...canvasBg }}>
          <div style={{ width: '100%', maxWidth: 600 }}>
            {/* Coach message */}
            <AnimatePresence>
              {coachData?.coachMessage && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0 }}
                  style={{ background: 'rgba(0,229,255,0.05)', border: '1px solid rgba(0,229,255,0.18)', borderRadius: 14, padding: '13px 18px', marginBottom: 18 }}>
                  <p style={{ fontSize: 10.5, color: '#00e5ff', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 4 }}>Aura Coach</p>
                  <p style={{ fontSize: 13.5, color: '#e8f4fb', lineHeight: 1.65 }}>{coachData.coachMessage}</p>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Progress header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <div>
                <span className="badge badge-purple" style={{ marginBottom: 6 }}><Zap size={9} /> Focus block</span>
                <p style={{ fontSize: 11.5, color: '#4a6275', marginTop: 4, maxWidth: 280 }}>{originalTask}</p>
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                {questStreak >= 2 && (
                  <span style={{ fontSize: 11, color: '#ffb300', fontWeight: 700 }}>🔥 {questStreak}</span>
                )}
                <FocusTimer
                  key={`${currentQuestIndex}-${phase}`}
                  isActive={focusTimerActive}
                  durationMinutes={focusQuest.duration_minutes || 2}
                  onComplete={() => { /* gentle nudge */ }}
                />
                <motion.button className="btn btn-ghost" onClick={handleReset} whileTap={{ scale: 0.94 }} style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 4 }}>
                  <RotateCcw size={12} />
                </motion.button>
              </div>
            </div>

            {/* Progress bar with step count */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 26 }}>
              <div className="progress-track" style={{ flex: 1 }}>
                <div className="progress-fill" style={{ width: `${progress}%` }} />
              </div>
              <span style={{ fontSize: 11.5, color: '#4a6275', fontWeight: 700, whiteSpace: 'nowrap' }}>{completedN}/{focusQuests.length}</span>
            </div>

            {/* Quest card with animated border */}
            <div style={{ position: 'relative', marginBottom: 18 }}>
              <div style={{
                position: 'absolute', inset: -1.5, borderRadius: 28,
                background: 'linear-gradient(135deg,#7c3aed,#00e5ff,#5eead4,#7c3aed)',
                backgroundSize: '300% 300%',
                animation: 'focusBorderSpin 5s linear infinite, focusPulse 4s ease-in-out infinite',
                WebkitMask: 'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)',
                WebkitMaskComposite: 'xor', maskComposite: 'exclude', padding: 1.5, pointerEvents: 'none',
              }} />
              <div style={{ background: 'linear-gradient(145deg,rgba(10,20,40,0.93),rgba(4,12,28,0.96))', borderRadius: 26, padding: '34px 32px', backdropFilter: 'blur(20px)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 18 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#c4b5fd' }}>
                    Step {(currentQuestIndex || 0) + 1} of {focusQuests.length}
                  </span>
                  <span style={{ fontSize: 11, color: '#4a6275', fontWeight: 600 }}>~{focusQuest.duration_minutes || 2} min</span>
                </div>
                <p style={{ fontSize: 'clamp(17px,3vw,24px)', fontWeight: 800, lineHeight: 1.38, letterSpacing: '-0.03em', color: '#e8f4fb', marginBottom: 20 }}>
                  {focusQuest.action}
                </p>
                {focusQuest.tip && (
                  <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 14, display: 'flex', gap: 10 }}>
                    <span style={{ fontSize: 16 }}>💡</span>
                    <p style={{ fontSize: 13.5, color: '#80deea', lineHeight: 1.65 }}>{focusQuest.tip}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Done button */}
            <motion.button onClick={handleDone} disabled={completing}
              whileHover={{ scale: 1.015, boxShadow: '0 10px 44px rgba(124,58,237,0.45)' }} whileTap={{ scale: 0.955 }}
              style={{
                width: '100%', padding: '20px', borderRadius: 16, border: 'none',
                background: 'linear-gradient(135deg,#5b21b6,#7c3aed,#00b4d8)',
                backgroundSize: '200% 200%', animation: 'gradSpin 6s ease infinite',
                color: 'white', fontFamily: 'inherit', fontSize: 16, fontWeight: 800,
                letterSpacing: '-0.025em', marginBottom: 12, cursor: completing ? 'not-allowed' : 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
              }}>
              {completing ? <div className="spinner" /> : <Check size={20} />}
              {completing ? 'Saving…' : 'Done — next step'}
              {!completing && <ArrowRight size={18} />}
            </motion.button>

            {/* Secondary actions */}
            <div style={{ display: 'flex', justifyContent: 'center', gap: 8, flexWrap: 'wrap' }}>
              <motion.button className="btn btn-secondary" onClick={toggleNoise} whileTap={{ scale: 0.95 }} style={{ fontSize: 12, padding: '8px 16px' }}>
                {noiseEnabled ? <Music size={12} /> : <VolumeX size={12} />}
                {noiseEnabled ? 'Brown noise on' : 'Brown noise'}
              </motion.button>
              <motion.button className="btn btn-ghost" onClick={() => handleGenerateReport(false)} whileTap={{ scale: 0.95 }} style={{ fontSize: 12, padding: '8px 14px' }}>
                <FileText size={12} /> Report
              </motion.button>
            </div>
            {error && <p style={{ marginTop: 12, fontSize: 13, color: '#ffb3c1', textAlign: 'center' }}>{error}</p>}
          </div>
        </div>
      </>
    );
  }

  /* ── PHASE: CANVAS ─────────────────────────────────────────────────────── */
  return (
    <>
      <AnimatePresence>
        {reportOverlay && (
          <ReportOverlay
            onClose={() => setReportOverlay(null)}
            reportInfo={reportOverlay?.info || null}
            error={reportOverlay?.error || null}
          />
        )}
      </AnimatePresence>

      <div ref={constraintsRef} style={{ position: 'fixed', inset: 0, overflow: 'hidden', ...canvasBg }}>
        <div style={{ ...dotGrid }} />

        {/* Top bar */}
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, zIndex: 200,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '13px 22px',
          background: 'rgba(2,9,21,0.9)', backdropFilter: 'blur(20px)',
          borderBottom: '1px solid rgba(255,255,255,0.05)',
        }}>
          <span className="badge badge-cyan"><Zap size={10} /> Shattered Canvas</span>
          <p style={{ fontSize: 12, color: '#4a6275', fontWeight: 500, textAlign: 'center', flex: 1, margin: '0 16px' }}>
            Drag steps into the timeline below, then launch
          </p>
          <div style={{ display: 'flex', gap: 8 }}>
            <span style={{ fontSize: 12, color: '#4a6275', fontWeight: 600, alignSelf: 'center' }}>
              {dockedCount}/{fragments.length}
            </span>
            <motion.button className="btn btn-ghost" onClick={handleReset} whileTap={{ scale: 0.92 }} style={{ fontSize: 12 }}>
              <RotateCcw size={12} />
            </motion.button>
          </div>
        </div>

        {/* Coach ribbon */}
        <AnimatePresence>
          {coachData?.coachMessage && (
            <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              style={{
                position: 'absolute', top: 58, left: '50%', transform: 'translateX(-50%)', zIndex: 190,
                background: 'rgba(0,229,255,0.06)', backdropFilter: 'blur(16px)',
                border: '1px solid rgba(0,229,255,0.16)', borderRadius: 14,
                padding: '9px 18px', maxWidth: 500, textAlign: 'center',
              }}>
              <p style={{ fontSize: 12.5, color: '#80deea', lineHeight: 1.55 }}>{coachData.coachMessage}</p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Fragment cards */}
        {fragments.map((frag) => (
          <FragmentCard key={frag.id} frag={frag} isDocked={frag.slotIndex !== null}
            onPositionChange={handlePositionChange} onDelete={handleDelete}
            onTextChange={handleTextChange} onColorChange={handleColorChange}
            onDropToSlot={handleDropToSlot} constraintsRef={constraintsRef}
            onDragVelocity={recordDragEvent}
          />
        ))}

        {/* Empty canvas hint */}
        {activeFreeFrags.length > 0 && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.5 }}
            style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', pointerEvents: 'none', textAlign: 'center', zIndex: 1 }}>
            <p style={{ fontSize: 12, color: 'rgba(139,175,194,0.25)', letterSpacing: '0.08em', fontWeight: 600, textTransform: 'uppercase' }}>
              {activeFreeFrags.length} step{activeFreeFrags.length !== 1 ? 's' : ''} · drag into timeline
            </p>
          </motion.div>
        )}

        {/* Launch button */}
        <AnimatePresence>
          {allDocked && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              style={{ position: 'absolute', bottom: 148, left: '50%', transform: 'translateX(-50%)', zIndex: 300 }}>
              <motion.button onClick={handleLaunchFocus}
                whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }}
                animate={{ boxShadow: ['0 6px 30px rgba(0,229,255,0.2)', '0 10px 50px rgba(0,229,255,0.45)', '0 6px 30px rgba(0,229,255,0.2)'] }}
                transition={{ duration: 2.5, repeat: Infinity }}
                style={{
                  padding: '15px 38px', borderRadius: 999, border: 'none',
                  background: 'linear-gradient(135deg,#00b4d8,#00e5ff)',
                  color: '#020915', fontFamily: 'inherit', fontSize: 16, fontWeight: 800,
                  letterSpacing: '-0.025em', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: 10,
                }}>
                <Play size={17} fill="#020915" /> Launch Focus Mode <ArrowRight size={15} />
              </motion.button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Timeline dock */}
        <div ref={dockRef} style={{
          position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 200,
          background: 'rgba(2,9,21,0.93)', backdropFilter: 'blur(28px)',
          borderTop: '1px solid rgba(0,229,255,0.12)',
          boxShadow: '0 -8px 40px rgba(0,229,255,0.06)',
          padding: '12px 18px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <p style={{ fontSize: 10.5, color: 'rgba(0,229,255,0.55)', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase' }}>⟵ Timeline ⟶</p>
            <p style={{ fontSize: 10.5, color: '#4a6275', fontWeight: 500 }}>{dockedCount} placed · drag here to order</p>
          </div>
          <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 2, scrollbarWidth: 'none' }}>
            {Array.from({ length: Math.max(MAX_SLOTS, fragments.length) }, (_, i) => {
              const fragId = slots[i];
              const frag = fragId ? fragments.find((f) => f.id === fragId) : null;
              const color = frag ? (COLORS.find((c) => c.id === frag.colorId) || COLORS[0]) : null;
              return (
                <motion.div key={i} data-slot={i} layout
                  initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}
                  style={{
                    flexShrink: 0, width: 152, minHeight: 68, borderRadius: 12,
                    border: frag ? `1px solid ${color.border}` : '1px dashed rgba(0,229,255,0.15)',
                    background: frag ? `linear-gradient(135deg,${color.bg},rgba(6,14,30,0.9))` : 'rgba(255,255,255,0.012)',
                    boxShadow: frag ? `0 3px 16px ${color.glow.replace('0.4', '0.15')}` : 'none',
                    display: 'flex', flexDirection: 'column', alignItems: frag ? 'flex-start' : 'center', justifyContent: frag ? 'flex-start' : 'center',
                    padding: frag ? '8px 11px' : '0', position: 'relative', transition: 'all 0.2s',
                  }}>
                  <span style={{ position: 'absolute', top: 5, left: 8, fontSize: 9, fontWeight: 800, letterSpacing: '0.08em', color: frag ? color.border : 'rgba(0,229,255,0.2)', textTransform: 'uppercase' }}>{i + 1}</span>
                  {frag ? (
                    <>
                      <div style={{ height: 14 }} />
                      <p style={{ fontSize: 11.5, fontWeight: 700, color: '#e8f4fb', lineHeight: 1.35, marginBottom: 5 }}>
                        {frag.text.slice(0, 52)}{frag.text.length > 52 ? '…' : ''}
                      </p>
                      <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
                        <span style={{ fontSize: 9, color: color.border, fontWeight: 600, opacity: 0.8 }}>~{frag.duration_minutes || 2}m</span>
                        <button onClick={() => ejectFromSlot(frag.id, i)}
                          style={{ fontSize: 10, color: 'rgba(255,255,255,0.25)', background: 'none', border: 'none', cursor: 'pointer', padding: '2px 4px' }}>×</button>
                      </div>
                    </>
                  ) : (
                    <p style={{ fontSize: 10, color: 'rgba(0,229,255,0.18)', fontWeight: 500 }}>Drop here</p>
                  )}
                </motion.div>
              );
            })}
          </div>
        </div>
      </div>
    </>
  );
}