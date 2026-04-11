// CognitiveForge.jsx — v4.0 — Therapeutic Activity Suite (Fully Differentiated)
//
// 6 games, each with a unique mechanic, visual language, and clinical signal:
// ─────────────────────────────────────────────────────────────────────────────
// LEFT COLUMN  (stress / catharsis / logic)
//   1. Squeeze Release  — Hold-timing stress ball (catharsis + arousal regulation)
//   2. Color Sort       — Drag falling balls to matching tubes (spatial logic)
//   3. Word Smash       — Click drifting negative words (cognitive reframe)  ← UNCHANGED
//
// RIGHT COLUMN (focus / memory / calm)
//   4. Memory Pulse     — Simon-style sequence grid (working memory)
//   5. Number Dash      — Schulte table 4×4 grid (clinical attention training)
//   6. Breathe Flow     — Guided breathing orb hold/release (biofeedback calm)
// ─────────────────────────────────────────────────────────────────────────────
// Every game generates telemetry → clinical report PDF section.

import { useRef, useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Wind, Sparkles, RotateCcw, Trash2, Zap, Trophy, Flame,
  Star, X, FileText, Grid,
} from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import confetti from 'canvas-confetti';
import Matter from 'matter-js';
import useStore from '../../store/useStore.js';
import { forgeApi } from '../../services/api.js';

const { Engine, Render, Runner, World, Bodies, Body, Composite, Events, Mouse, MouseConstraint } = Matter;

const PHYSICS_H = 440;
const MIN_W     = 280;
const MAX_W     = 760;

// ── Shared audio utils ───────────────────────────────────────────────────────
const playTone = (freq = 440, type = 'sine', dur = 0.18, gain = 0.12) => {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const g   = ctx.createGain();
    osc.connect(g); g.connect(ctx.destination);
    osc.type = type;
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    g.gain.setValueAtTime(gain, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
    osc.start(); osc.stop(ctx.currentTime + dur);
    setTimeout(() => ctx.close(), dur * 1000 + 300);
  } catch (_) {}
};

const playSmash   = () => { playTone(150, 'square', 0.06, 0.2); setTimeout(() => playTone(80, 'sine', 0.25, 0.1), 50); };
const playCorrect = () => { playTone(659, 'triangle', 0.12, 0.14); setTimeout(() => playTone(784, 'triangle', 0.14, 0.12), 100); };
const playWrong   = () => { playTone(200, 'sawtooth', 0.15, 0.18); };
const playClick   = () => playTone(440 + Math.random() * 120, 'triangle', 0.1, 0.12);
const playRelease = (quality) => {
  const freq = 200 + quality * 6;
  playTone(freq, 'sine', 0.3, 0.18);
  if (quality > 60) setTimeout(() => playTone(freq * 1.5, 'triangle', 0.2, 0.1), 120);
};
const playBreathe = (isIn) => playTone(isIn ? 440 : 330, 'sine', 0.4, 0.07);
const playSort    = (col)  => playTone([523,659,784,880,1047,1175][col % 6], 'triangle', 0.15, 0.13);

// ── Telemetry engine ─────────────────────────────────────────────────────────
const derivePredictedEffects = (gameId, metrics) => {
  const { interactions, durationSeconds, avgReactionMs, accuracy, extraData = {} } = metrics;
  const ipm = interactions / Math.max(durationSeconds / 60, 0.1);
  const eff = { stressReduction: 0, dopamineActivation: 0, focusScore: 0, arousalLevel: 'moderate', clinicalNote: '' };

  switch (gameId) {
    case 'squeeze_release': {
      const avgQ = extraData.avgQuality || 50;
      eff.stressReduction    = Math.min(10, Math.round(interactions * 0.5 + 2));
      eff.dopamineActivation = Math.min(10, Math.round(avgQ * 0.07 + 2));
      eff.focusScore         = Math.min(10, Math.round(avgQ * 0.06 + 2));
      eff.arousalLevel       = avgQ < 40 ? 'high' : avgQ < 70 ? 'moderate' : 'low';
      eff.clinicalNote       = `Squeeze Release: ${interactions} cycles, avg precision ${avgQ}%. `
        + (avgQ < 40 ? 'Difficulty regulating release timing suggests elevated tension; poor impulse control present.'
          : avgQ > 70 ? 'Good timing control; cortical inhibition intact — low acute stress.'
          : 'Moderate tension management; some difficulty with arousal regulation observed.');
      break;
    }
    case 'color_sort': {
      const mistakes = extraData.mistakes || 0;
      eff.stressReduction    = 4;
      eff.dopamineActivation = Math.min(10, Math.round(accuracy * 0.08 + 2));
      eff.focusScore         = Math.min(10, Math.round(accuracy * 0.09 + 1));
      eff.arousalLevel       = mistakes > 8 ? 'high' : mistakes > 3 ? 'moderate' : 'low';
      eff.clinicalNote       = `Color Sort: ${interactions} balls sorted, ${mistakes} errors (${accuracy}% accuracy). `
        + (mistakes > 8 ? 'High error rate indicates impulsive sorting; possible executive dysfunction or cognitive overload.'
          : mistakes < 3 ? 'High spatial accuracy; strong cognitive flexibility and working memory.'
          : 'Moderate spatial performance; some cognitive fatigue or distractibility present.');
      break;
    }
    case 'word_smash': {
      eff.stressReduction    = Math.min(10, Math.round(interactions * 0.6 + 1));
      eff.dopamineActivation = Math.min(10, Math.round(interactions * 0.5 + 2));
      eff.focusScore         = 5;
      eff.arousalLevel       = ipm > 25 ? 'high' : 'moderate';
      eff.clinicalNote       = `Word Smash: ${interactions} negative words destroyed in ${durationSeconds}s. `
        + `High engagement suggests active stress seeking cathartic discharge; cognitive reframing activation observed.`;
      break;
    }
    case 'memory_pulse': {
      const maxLevel = extraData.maxLevel || 1;
      eff.stressReduction    = 3;
      eff.dopamineActivation = Math.min(10, Math.round(maxLevel * 0.9 + 2));
      eff.focusScore         = Math.min(10, Math.round(accuracy * 0.09 + maxLevel * 0.3));
      eff.arousalLevel       = accuracy < 50 ? 'high' : accuracy < 75 ? 'moderate' : 'low';
      eff.clinicalNote       = `Memory Pulse: reached level ${maxLevel}, ${accuracy}% sequence accuracy. `
        + (maxLevel >= 6 ? 'Strong working memory — low ADHD working-memory impact.'
          : maxLevel >= 4 ? 'Moderate sequence retention; some working memory challenges present.'
          : 'Difficulty retaining sequences beyond 3 items — significant working memory deficit; ADHD marker.');
      break;
    }
    case 'number_dash': {
      const bestTime = extraData.bestTime || durationSeconds;
      eff.stressReduction    = 4;
      eff.dopamineActivation = Math.min(10, Math.round(interactions * 0.4 + 3));
      eff.focusScore         = bestTime < 30 ? 9 : bestTime < 45 ? 7 : bestTime < 60 ? 5 : 3;
      eff.arousalLevel       = avgReactionMs < 600 ? 'high' : avgReactionMs < 1200 ? 'moderate' : 'low';
      eff.clinicalNote       = `Number Dash (Schulte Table): best time ${bestTime}s, avg tap ${avgReactionMs}ms. `
        + (bestTime < 30 ? 'Excellent visual scanning speed; strong directed attention.'
          : bestTime < 45 ? 'Good attention tracking with minor lapses.'
          : bestTime < 60 ? 'Moderate visual search speed; attention fatigue or distractibility present.'
          : 'Slow visual scanning — significant attention deficit indicator; clinical follow-up recommended.');
      break;
    }
    case 'breathe_flow': {
      const avgDeviation = extraData.avgDeviation || 50;
      const cycles = extraData.cycles || 0;
      eff.stressReduction    = Math.min(10, Math.round(cycles * 0.8 + 3));
      eff.dopamineActivation = 4;
      eff.focusScore         = Math.min(10, Math.round((100 - avgDeviation) * 0.08 + 2));
      eff.arousalLevel       = avgDeviation > 40 ? 'high' : avgDeviation > 20 ? 'moderate' : 'low';
      eff.clinicalNote       = `Breathe Flow: ${cycles} full cycles, avg deviation ${avgDeviation}% from guide. `
        + (avgDeviation < 20 ? 'Excellent parasympathetic activation; HRV improvement likely; high calm capacity.'
          : avgDeviation < 40 ? 'Moderate breathing synchrony; partial relaxation response achieved.'
          : 'Difficulty matching breathing guide — elevated sympathetic tone; likely anxiety or panic state.');
      break;
    }
    default: {
      eff.clinicalNote = `${gameId}: ${interactions} interactions in ${durationSeconds}s.`;
    }
  }
  return eff;
};

// ════════════════════════════════════════════════════════════════════════════════
// SHARED: GameShell wrapper
// ════════════════════════════════════════════════════════════════════════════════
function GameShell({ title, color, score, unit, onEnd, instruction, children, hideTimer }) {
  const [secs, setSecs] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setSecs((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, []);
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '11px 14px 7px', flexShrink: 0 }}>
        <div>
          <p style={{ fontSize: 12.5, fontWeight: 800, color, letterSpacing: '-0.02em', lineHeight: 1.2 }}>{title}</p>
          <p style={{ fontSize: 9.5, color: 'var(--text-3)', marginTop: 2, lineHeight: 1.3 }}>{instruction}</p>
        </div>
        <div style={{ textAlign: 'right' }}>
          <p style={{ fontSize: 17, fontWeight: 900, color, letterSpacing: '-0.04em', lineHeight: 1 }}>{score}</p>
          <p style={{ fontSize: 8.5, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{unit}</p>
        </div>
      </div>
      <div style={{ flex: 1, margin: '0 10px', borderRadius: 13, overflow: 'hidden', border: `1px solid ${color}22` }}>
        {children}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 14px 10px', flexShrink: 0 }}>
        {!hideTimer ? (
          <span style={{ fontSize: 9.5, color: 'var(--text-3)', fontFamily: 'monospace' }}>
            {String(m).padStart(2,'0')}:{String(s).padStart(2,'0')}
          </span>
        ) : <span />}
        <button onClick={onEnd}
          style={{ fontSize: 10.5, padding: '4px 13px', borderRadius: 999, background: `${color}10`, border: `1px solid ${color}28`, color, fontWeight: 700, cursor: 'pointer' }}>
          End + Log
        </button>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════════
// GAME 1 — SQUEEZE RELEASE
// Completely different mechanic: hold mouse/space to build pressure in a stress
// ball. A waveform ring shows tension building. Release at the "sweet spot" 
// (green zone on a radial gauge) for maximum catharsis.
// Clinical: arousal regulation, impulse control, tension management.
// ════════════════════════════════════════════════════════════════════════════════
function SqueezeRelease({ onSessionEnd }) {
  const [pressure,   setPressure]   = useState(0);     // 0-100
  const [holding,    setHolding]    = useState(false);
  const [score,      setScore]      = useState(0);
  const [feedback,   setFeedback]   = useState(null);  // { text, color, quality }
  const [qualities,  setQualities]  = useState([]);
  const [pulseSize,  setPulseSize]  = useState(1);
  const [rings,      setRings]      = useState([]);
  const startRef  = useRef(Date.now());
  const holdRef   = useRef(null);
  const rafRef    = useRef(null);
  const ringIdRef = useRef(0);

  // Build pressure while holding
  useEffect(() => {
    if (!holding) return;
    holdRef.current = setInterval(() => {
      setPressure((p) => {
        const np = Math.min(100, p + 2.2);
        setPulseSize(1 + np * 0.004);
        return np;
      });
    }, 30);
    return () => clearInterval(holdRef.current);
  }, [holding]);

  const handleRelease = useCallback(() => {
    if (!holding) return;
    setHolding(false);
    clearInterval(holdRef.current);
    const p = pressure;
    setPressure(0);
    setPulseSize(1);

    // Sweet spot: 55–80 = perfect
    let quality, text, color;
    if (p < 25) { quality = 20; text = 'Too gentle…'; color = '#8bafc2'; }
    else if (p < 45) { quality = 45; text = 'Getting there'; color = '#ffb300'; }
    else if (p >= 55 && p <= 80) { quality = 95; text = '🔥 Perfect release!'; color = '#00e676'; }
    else if (p > 80 && p < 95) { quality = 70; text = 'Strong!'; color = '#c4b5fd'; }
    else { quality = 30; text = 'Over-tensed'; color = '#ff6b8a'; }

    playRelease(quality);
    setScore((s) => s + Math.round(quality / 10));
    setQualities((prev) => [...prev, quality]);
    setFeedback({ text, color, quality });
    setTimeout(() => setFeedback(null), 1400);

    // Emit ripple rings
    const id = ringIdRef.current++;
    setRings((prev) => [...prev, { id, color }]);
    setTimeout(() => setRings((prev) => prev.filter((r) => r.id !== id)), 1000);

    if (quality > 80) {
      confetti({ particleCount: 18, spread: 50, origin: { x: 0.5, y: 0.5 }, colors: ['#00e676','#ffb300','#c4b5fd'], ticks: 60, gravity: 0.8, scalar: 0.7 });
    }
  }, [holding, pressure]);

  const handleEnd = () => {
    const dur  = Math.round((Date.now() - startRef.current) / 1000);
    const avgQ = qualities.length ? Math.round(qualities.reduce((a,b)=>a+b,0)/qualities.length) : 0;
    onSessionEnd({ gameId:'squeeze_release', gameName:'Squeeze Release', durationSeconds:dur, interactions:score, avgReactionMs:600, accuracy:avgQ, score, extraData:{ avgQuality: avgQ } });
  };

  // Gauge arc (SVG): 0-100 → 0-240 degrees
  const gaugeAngle = (pressure / 100) * 240 - 120; // -120 to +120
  const cx = 100, cy = 108, r = 72;
  const toRad = (deg) => (deg - 90) * (Math.PI / 180);
  const arcX  = (deg) => cx + r * Math.cos(toRad(deg));
  const arcY  = (deg) => cy + r * Math.sin(toRad(deg));

  const startDeg = -120; // bottom-left
  const endDeg   = gaugeAngle;
  const largeArc = endDeg - startDeg > 180 ? 1 : 0;

  const pressureColor = pressure < 25 ? '#4a6275' : pressure < 55 ? '#ffb300' : pressure <= 80 ? '#00e676' : pressure < 95 ? '#c4b5fd' : '#ff6b8a';

  return (
    <GameShell title="Squeeze Release" color="#ff6b8a" score={score} unit="pts" onEnd={handleEnd}
      instruction="Hold to build pressure · release in the green zone">
      <div
        onMouseDown={() => setHolding(true)} onMouseUp={handleRelease}
        onMouseLeave={handleRelease}
        onTouchStart={(e) => { e.preventDefault(); setHolding(true); }}
        onTouchEnd={(e) => { e.preventDefault(); handleRelease(); }}
        style={{
          width: '100%', height: '100%', cursor: holding ? 'grabbing' : 'grab',
          background: 'radial-gradient(ellipse at 50% 60%, rgba(255,107,138,0.08), transparent 65%), #0d0308',
          borderRadius: 13, display: 'flex', alignItems: 'center', justifyContent: 'center',
          userSelect: 'none', WebkitUserSelect: 'none', position: 'relative',
        }}
      >
        {/* Ripple rings on release */}
        {rings.map((ring) => (
          <motion.div key={ring.id}
            initial={{ width: 80, height: 80, opacity: 0.8 }}
            animate={{ width: 240, height: 240, opacity: 0 }}
            transition={{ duration: 0.9, ease: 'easeOut' }}
            style={{ position: 'absolute', borderRadius: '50%', border: `2px solid ${ring.color}`, pointerEvents: 'none', zIndex: 10 }}
          />
        ))}

        {/* SVG gauge + ball */}
        <svg width="200" height="190" viewBox="0 0 200 190" style={{ pointerEvents: 'none' }}>
          {/* Sweet spot arc (55-80) */}
          <path
            d={`M${arcX(-120 + 55*2.4)},${arcY(-120 + 55*2.4)} A${r},${r} 0 0,1 ${arcX(-120 + 80*2.4)},${arcY(-120 + 80*2.4)}`}
            fill="none" stroke="rgba(0,230,118,0.35)" strokeWidth="12" strokeLinecap="round"
          />

          {/* Track */}
          <path d={`M${arcX(-120)},${arcY(-120)} A${r},${r} 0 1,1 ${arcX(120)},${arcY(120)}`}
            fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="6" strokeLinecap="round" />

          {/* Pressure fill */}
          {pressure > 0 && (
            <path d={`M${arcX(-120)},${arcY(-120)} A${r},${r} 0 ${largeArc},1 ${arcX(Math.min(120, endDeg))},${arcY(Math.min(120, endDeg))}`}
              fill="none" stroke={pressureColor} strokeWidth="6" strokeLinecap="round"
              style={{ transition: 'stroke 0.15s' }} />
          )}

          {/* Gauge needle */}
          <line
            x1={cx} y1={cy}
            x2={cx + (r - 18) * Math.cos(toRad(Math.min(120, gaugeAngle)))}
            y2={cy + (r - 18) * Math.sin(toRad(Math.min(120, gaugeAngle)))}
            stroke={pressureColor} strokeWidth="2.5" strokeLinecap="round"
            style={{ transition: 'all 0.04s' }}
          />

          {/* Center pivot */}
          <circle cx={cx} cy={cy} r={5} fill={pressureColor} style={{ transition: 'fill 0.15s' }} />

          {/* Labels */}
          <text x="30" y="145" textAnchor="middle" fontSize="9" fill="rgba(255,255,255,0.2)">empty</text>
          <text x="170" y="145" textAnchor="middle" fontSize="9" fill="rgba(255,255,255,0.2)">max</text>
          <text x={cx} y="86" textAnchor="middle" fontSize="9" fill="rgba(0,230,118,0.7)" fontWeight="700">sweet</text>
          <text x={cx} y="96" textAnchor="middle" fontSize="9" fill="rgba(0,230,118,0.7)" fontWeight="700">zone</text>
        </svg>

        {/* Central ball */}
        <motion.div
          animate={{
            scale: holding ? 1 + pressure * 0.006 : 1,
            boxShadow: holding
              ? `0 0 ${20 + pressure * 0.5}px ${pressureColor}80, 0 0 ${50 + pressure}px ${pressureColor}20`
              : `0 0 20px rgba(255,107,138,0.3)`,
          }}
          transition={{ duration: 0.04 }}
          style={{
            position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
            width: 70, height: 70, borderRadius: '50%',
            background: `radial-gradient(circle at 35% 35%, ${pressureColor}dd, ${pressureColor}66)`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 26, zIndex: 5,
            border: `2px solid ${pressureColor}80`,
          }}
        >
          {holding ? (pressure > 70 ? '😤' : pressure > 40 ? '😬' : '😶') : '😮‍💨'}
        </motion.div>

        {/* Feedback toast */}
        <AnimatePresence>
          {feedback && (
            <motion.div initial={{ opacity:0, y:-8, scale:0.85 }} animate={{ opacity:1, y:0, scale:1 }} exit={{ opacity:0, y:-20 }}
              style={{ position:'absolute', top:'12%', left:'50%', transform:'translateX(-50%)', zIndex:20,
                fontSize:14, fontWeight:800, color:feedback.color, whiteSpace:'nowrap',
                textShadow:`0 0 16px ${feedback.color}88`, letterSpacing:'-0.02em' }}>
              {feedback.text}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Hold prompt */}
        {!holding && pressure === 0 && score === 0 && (
          <div style={{ position:'absolute', bottom:'14%', fontSize:10.5, color:'rgba(255,107,138,0.45)', fontWeight:600 }}>
            press &amp; hold anywhere
          </div>
        )}
      </div>
    </GameShell>
  );
}

// ════════════════════════════════════════════════════════════════════════════════
// GAME 2 — COLOR SORT
// Colored balls fall in a column at the top. Player drags each to one of 4
// color-coded tubes at the bottom. Spatial logic + impulse control.
// Clinical: cognitive flexibility, spatial reasoning, impulsivity measurement.
// ════════════════════════════════════════════════════════════════════════════════
const SORT_COLORS = [
  { id:'red',    hex:'#ff6b8a', dark:'#7f1d1d' },
  { id:'blue',   hex:'#00e5ff', dark:'#0e4a6e' },
  { id:'purple', hex:'#c4b5fd', dark:'#3b0764' },
  { id:'green',  hex:'#00e676', dark:'#064e3b' },
];

function ColorSort({ onSessionEnd }) {
  const [queue,    setQueue]    = useState(() => Array.from({length:12},()=>SORT_COLORS[Math.floor(Math.random()*4)]));
  const [tubes,    setTubes]    = useState([0,0,0,0]);       // fill count per tube
  const [correct,  setCorrect]  = useState(0);
  const [mistakes, setMistakes] = useState(0);
  const [dragging, setDragging] = useState(null);            // index of ball being dragged
  const [dragPos,  setDragPos]  = useState({x:0,y:0});
  const [lastDrop, setLastDrop] = useState(null);            // {tubeIdx, ok}
  const [phase,    setPhase]    = useState('playing');       // playing | cleared
  const containerRef = useRef(null);
  const startRef     = useRef(Date.now());
  const tubeRefs     = useRef([null,null,null,null]);

  const currentBall = queue[0] || null;

  const startDrag = (e) => {
    e.preventDefault();
    if (!currentBall) return;
    const pos = e.touches ? e.touches[0] : e;
    setDragging(0);
    setDragPos({ x: pos.clientX, y: pos.clientY });
  };

  const moveDrag = (e) => {
    if (dragging === null) return;
    const pos = e.touches ? e.touches[0] : e;
    setDragPos({ x: pos.clientX, y: pos.clientY });
  };

  const endDrag = (e) => {
    if (dragging === null || !currentBall) { setDragging(null); return; }
    // Detect which tube we're over
    let droppedTube = null;
    tubeRefs.current.forEach((ref, idx) => {
      if (!ref) return;
      const rect = ref.getBoundingClientRect();
      const pos  = e.changedTouches ? e.changedTouches[0] : e;
      if (pos.clientX >= rect.left && pos.clientX <= rect.right
        && pos.clientY >= rect.top  && pos.clientY <= rect.bottom) {
        droppedTube = idx;
      }
    });

    if (droppedTube !== null) {
      const isCorrect = SORT_COLORS[droppedTube].id === currentBall.id;
      if (isCorrect) {
        playSort(droppedTube);
        setCorrect((c) => c + 1);
        setTubes((prev) => { const n=[...prev]; n[droppedTube]++; return n; });
        setLastDrop({ tubeIdx: droppedTube, ok: true });
        setTimeout(() => setLastDrop(null), 600);
        setQueue((prev) => {
          const next = prev.slice(1);
          if (next.length === 0) setPhase('cleared');
          return next.length === 0
            ? Array.from({length:12},()=>SORT_COLORS[Math.floor(Math.random()*4)])
            : next;
        });
      } else {
        playWrong();
        setMistakes((m) => m + 1);
        setLastDrop({ tubeIdx: droppedTube, ok: false });
        setTimeout(() => setLastDrop(null), 500);
        // Put ball at back of queue
        setQueue((prev) => [...prev.slice(1), prev[0]]);
      }
    }
    setDragging(null);
  };

  const accuracy = correct + mistakes > 0 ? Math.round((correct / (correct + mistakes)) * 100) : 100;

  const handleEnd = () => {
    const dur = Math.round((Date.now() - startRef.current) / 1000);
    onSessionEnd({ gameId:'color_sort', gameName:'Color Sort', durationSeconds:dur, interactions:correct+mistakes, avgReactionMs:800, accuracy, score:correct, extraData:{ mistakes } });
  };

  return (
    <GameShell title="Color Sort" color="#00e5ff" score={correct} unit="sorted" onEnd={handleEnd}
      instruction="Drag each ball to its matching tube below">
      <div ref={containerRef}
        onMouseMove={moveDrag} onMouseUp={endDrag}
        onTouchMove={moveDrag} onTouchEnd={endDrag}
        style={{ width:'100%', height:'100%', background:'radial-gradient(ellipse at 50% 20%,rgba(0,229,255,0.07),transparent 60%), #020c12',
          borderRadius:13, position:'relative', userSelect:'none', WebkitUserSelect:'none', overflow:'hidden' }}>

        {/* Accuracy badge */}
        <div style={{ position:'absolute', top:8, right:10, fontSize:10, color:'rgba(0,229,255,0.5)', fontWeight:700 }}>
          {accuracy}% acc · {mistakes} err
        </div>

        {/* Queue preview — next 3 balls */}
        <div style={{ position:'absolute', top:14, left:'50%', transform:'translateX(-50%)', display:'flex', gap:8, alignItems:'center' }}>
          {queue.slice(1, 4).map((ball, i) => (
            <div key={i} style={{ width:14+4*(2-i), height:14+4*(2-i), borderRadius:'50%', background:ball.hex, opacity:0.4-i*0.08, transition:'all 0.2s', boxShadow:`0 0 6px ${ball.hex}50` }} />
          ))}
          {queue.length > 4 && <span style={{ fontSize:9, color:'var(--text-3)' }}>+{queue.length-4}</span>}
        </div>

        {/* Current ball — draggable */}
        {currentBall && (
          <motion.div
            onMouseDown={startDrag} onTouchStart={startDrag}
            animate={dragging === null ? { y: [0, -6, 0] } : {}}
            transition={{ repeat: Infinity, duration: 1.5, ease: 'easeInOut' }}
            style={{
              position: 'absolute',
              ...(dragging !== null
                ? { left: dragPos.x - (containerRef.current?.getBoundingClientRect().left || 0) - 22,
                    top:  dragPos.y - (containerRef.current?.getBoundingClientRect().top  || 0) - 22,
                    zIndex: 50, cursor: 'grabbing' }
                : { left: '50%', top: '38%', transform: 'translate(-50%,-50%)', cursor: 'grab' }),
              width: 44, height: 44, borderRadius: '50%',
              background: `radial-gradient(circle at 35% 35%, ${currentBall.hex}ee, ${currentBall.hex}77)`,
              boxShadow: `0 0 20px ${currentBall.hex}80, 0 4px 16px rgba(0,0,0,0.5)`,
              border: `2px solid ${currentBall.hex}cc`,
            }}
          />
        )}

        {/* Tubes at bottom */}
        <div style={{ position:'absolute', bottom:0, left:0, right:0, display:'flex', justifyContent:'space-around', padding:'0 8px 6px' }}>
          {SORT_COLORS.map((col, idx) => {
            const fill  = tubes[idx];
            const flash = lastDrop?.tubeIdx === idx;
            return (
              <div key={col.id} ref={(el) => tubeRefs.current[idx] = el}
                style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:4, width:48 }}>
                {/* Fill indicator */}
                <div style={{ fontSize:11 }}>
                  {'●'.repeat(Math.min(fill,5))}
                </div>
                {/* Tube body */}
                <div style={{
                  width: 40, height: 60, borderRadius: '0 0 12px 12px',
                  border: `2px solid ${col.hex}`,
                  borderTop: 'none',
                  background: flash
                    ? (lastDrop.ok ? `${col.hex}30` : 'rgba(255,107,138,0.2)')
                    : `${col.dark}`,
                  boxShadow: flash ? `0 0 18px ${lastDrop.ok ? col.hex : '#ff6b8a'}80` : `0 0 8px ${col.hex}20`,
                  transition: 'all 0.2s',
                  display: 'flex', alignItems: 'flex-end', justifyContent: 'center', paddingBottom: 5,
                }}>
                  {/* Fill level visual */}
                  <motion.div
                    animate={{ height: `${Math.min(fill * 10, 90)}%` }}
                    transition={{ type:'spring', stiffness:120 }}
                    style={{ width: '70%', background: col.hex, borderRadius: '0 0 6px 6px', opacity: 0.6 }}
                  />
                </div>
                {/* Color dot label */}
                <div style={{ width:10, height:10, borderRadius:'50%', background:col.hex, boxShadow:`0 0 6px ${col.hex}` }} />
              </div>
            );
          })}
        </div>

        {phase === 'cleared' && (
          <div style={{ position:'absolute',inset:0,display:'flex',alignItems:'center',justifyContent:'center',background:'rgba(2,9,21,0.7)',borderRadius:13 }}>
            <div style={{ textAlign:'center' }}>
              <div style={{ fontSize:28,marginBottom:4 }}>🎉</div>
              <p style={{ fontSize:12,fontWeight:700,color:'#00e5ff' }}>Round cleared!</p>
              <p style={{ fontSize:10,color:'var(--text-3)' }}>Keep going…</p>
            </div>
          </div>
        )}
      </div>
    </GameShell>
  );
}

// ════════════════════════════════════════════════════════════════════════════════
// GAME 3 — WORD SMASH  (UNCHANGED — preserved exactly)
// ════════════════════════════════════════════════════════════════════════════════
const NEG_WORDS = ['STRESS','WORRY','FEAR','DOUBT','PANIC','DREAD','FAIL','STUCK','LOST','NUMB','TIRED','SHAME'];
const POS_WORDS = ['FREE','BRAVE','PEACE','STRONG','RISE','CALM','BRIGHT','ALIVE','SAFE'];

function WordSmash({ onSessionEnd }) {
  const [words, setWords] = useState(() =>
    Array.from({ length: 6 }, (_, i) => ({
      id: i, word: NEG_WORDS[i % NEG_WORDS.length],
      x: 8 + (i * 14) % 78, y: 90 + i * 14,
      speed: 0.35 + Math.random() * 0.3, smashed: false,
      rotation: (Math.random() - 0.5) * 20,
      repl: null, replTimer: 0,
    }))
  );
  const [score, setScore] = useState(0);
  const startRef = useRef(Date.now());
  const rafRef   = useRef(null);

  useEffect(() => {
    const tick = () => {
      setWords((prev) => prev.map((w) => {
        if (w.smashed) {
          if (w.replTimer > 0) return { ...w, replTimer: w.replTimer - 1 };
          return { ...w, smashed:false, repl:null, word:NEG_WORDS[Math.floor(Math.random()*NEG_WORDS.length)], y:108, x:8+Math.random()*78 };
        }
        const ny = w.y - w.speed;
        if (ny < -12) return { ...w, y:108, x:8+Math.random()*78 };
        return { ...w, y:ny };
      }));
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, []);

  const smashWord = (id) => {
    playSmash();
    const pos = POS_WORDS[Math.floor(Math.random() * POS_WORDS.length)];
    setScore((s) => s + 1);
    setWords((prev) => prev.map((w) => w.id === id ? { ...w, smashed:true, repl:pos, replTimer:55 } : w));
  };

  const handleEnd = () => {
    const dur = Math.round((Date.now() - startRef.current) / 1000);
    onSessionEnd({ gameId:'word_smash', gameName:'Word Smash', durationSeconds:dur, interactions:score, avgReactionMs:700, accuracy:100, score });
  };

  return (
    <GameShell title="Word Smash" color="#ff6b8a" score={score} unit="crushed" onEnd={handleEnd}
      instruction="Smash the negative words before they escape!">
      <div style={{ position:'relative', width:'100%', height:'100%', overflow:'hidden',
        background:'radial-gradient(ellipse at 50% 60%,rgba(255,107,138,0.07),transparent 65%), #0a0310',
        borderRadius:13 }}>
        {words.map((w) => (
          <motion.div key={w.id}
            style={{ position:'absolute', left:`${w.x}%`, top:`${w.y}%`, transform:`translate(-50%,-50%) rotate(${w.rotation}deg)` }}>
            {w.smashed ? (
              <motion.div initial={{ opacity:1,scale:1 }} animate={{ opacity:0,scale:2.2,y:-30 }} transition={{ duration:0.8 }}
                style={{ fontSize:13,fontWeight:900,color:'#00e676',letterSpacing:'0.15em',whiteSpace:'nowrap',textShadow:'0 0 12px rgba(0,230,118,0.7)' }}>
                {w.repl}
              </motion.div>
            ) : (
              <motion.div whileHover={{ scale:1.15 }} whileTap={{ scale:0.7 }} onClick={() => smashWord(w.id)}
                style={{ fontSize:13,fontWeight:900,color:'#ff6b8a',letterSpacing:'0.08em',cursor:'pointer',
                  padding:'5px 10px',background:'rgba(255,107,138,0.08)',border:'1px solid rgba(255,107,138,0.25)',
                  borderRadius:8,whiteSpace:'nowrap',textShadow:'0 0 8px rgba(255,107,138,0.5)',userSelect:'none' }}>
                {w.word}
              </motion.div>
            )}
          </motion.div>
        ))}
      </div>
    </GameShell>
  );
}

// ════════════════════════════════════════════════════════════════════════════════
// GAME 4 — MEMORY PULSE
// Simon-style sequence game. A 3×3 grid flashes a colour pattern — player
// must repeat it in the same order. Tests working memory (core ADHD deficit).
// Each level adds +1 to sequence length.
// Clinical: working memory capacity, sequence processing, ADHD marker.
// ════════════════════════════════════════════════════════════════════════════════
const GRID_COLORS = ['#00e5ff','#ff6b8a','#c4b5fd','#ffb300','#00e676','#5eead4','#fb7185','#a78bfa','#fbbf24'];

function MemoryPulse({ onSessionEnd }) {
  const [phase,    setPhase]    = useState('waiting');   // waiting|showing|input|correct|wrong|levelup
  const [level,    setLevel]    = useState(1);
  const [sequence, setSequence] = useState([]);
  const [showing,  setShowing]  = useState(-1);          // index currently lit
  const [input,    setInput]    = useState([]);
  const [flashed,  setFlashed]  = useState(null);
  const [score,    setScore]    = useState(0);
  const [maxLevel, setMaxLevel] = useState(1);
  const [accuracy, setAccuracy] = useState(100);
  const [attempts, setAttempts] = useState({c:0,w:0});
  const startRef = useRef(Date.now());

  const generateSequence = useCallback((len) => {
    return Array.from({length:len},()=>Math.floor(Math.random()*9));
  }, []);

  const showSequence = useCallback((seq) => {
    setPhase('showing');
    setInput([]);
    const speed = Math.max(400, 900 - level * 50);
    let i = 0;
    const tick = () => {
      if (i < seq.length) {
        setShowing(seq[i]);
        playTone(300 + seq[i] * 50, 'triangle', speed/1000 * 0.7, 0.12);
        setTimeout(() => {
          setShowing(-1);
          i++;
          setTimeout(tick, speed * 0.3);
        }, speed * 0.7);
      } else {
        setShowing(-1);
        setPhase('input');
      }
    };
    setTimeout(tick, 500);
  }, [level]);

  const startLevel = useCallback((lvl) => {
    const seq = generateSequence(lvl + 2);
    setSequence(seq);
    showSequence(seq);
  }, [generateSequence, showSequence]);

  useEffect(() => {
    if (phase === 'waiting') return;
  }, [phase]);

  const handleCellClick = (idx) => {
    if (phase !== 'input') return;
    playTone(300 + idx * 50, 'triangle', 0.1, 0.12);
    setFlashed(idx);
    setTimeout(() => setFlashed(null), 200);

    const newInput = [...input, idx];
    const expected = sequence[newInput.length - 1];

    if (idx !== expected) {
      // Wrong
      playWrong();
      setAttempts((p)=>({c:p.c,w:p.w+1}));
      setPhase('wrong');
      const acc = Math.round(((attempts.c)/(attempts.c+attempts.w+1))*100);
      setAccuracy(acc);
      setTimeout(() => {
        setInput([]);
        showSequence(sequence); // replay same sequence
      }, 900);
      return;
    }

    if (newInput.length === sequence.length) {
      // Correct!
      playCorrect();
      setAttempts((p)=>({c:p.c+1,w:p.w}));
      setScore((s) => s + level * 5);
      setPhase('correct');
      const nextLevel = level + 1;
      setLevel(nextLevel);
      setMaxLevel((m) => Math.max(m, nextLevel));
      const acc = Math.round(((attempts.c+1)/(attempts.c+attempts.w+1))*100);
      setAccuracy(acc);
      setTimeout(() => startLevel(nextLevel), 800);
    } else {
      setInput(newInput);
    }
  };

  return (
    <GameShell title="Memory Pulse" color="#c4b5fd" score={score} unit="pts" onEnd={() => {
      const dur = Math.round((Date.now() - startRef.current)/1000);
      onSessionEnd({ gameId:'memory_pulse', gameName:'Memory Pulse', durationSeconds:dur, interactions:attempts.c+attempts.w, avgReactionMs:700, accuracy, score, extraData:{ maxLevel } });
    }} instruction={phase==='input' ? 'Your turn — repeat the sequence!' : 'Watch the pattern…'}>
      <div style={{ width:'100%', height:'100%', background:'radial-gradient(ellipse at 50% 40%,rgba(196,181,253,0.1),transparent 65%), #060212',
        borderRadius:13, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:12 }}>

        {phase === 'waiting' ? (
          <div style={{ textAlign:'center' }}>
            <div style={{ fontSize:36, marginBottom:10 }}>🧠</div>
            <p style={{ fontSize:12, color:'rgba(196,181,253,0.7)', fontWeight:600, marginBottom:14 }}>
              Watch the flash pattern,<br/>then repeat it in order
            </p>
            <button onClick={() => startLevel(1)}
              style={{ padding:'9px 24px', borderRadius:999, background:'rgba(196,181,253,0.12)', border:'1px solid rgba(196,181,253,0.35)', color:'#c4b5fd', fontWeight:700, fontSize:13, cursor:'pointer' }}>
              Start
            </button>
          </div>
        ) : (
          <>
            {/* Status bar */}
            <div style={{ display:'flex', gap:14, alignItems:'center', marginBottom:4 }}>
              <span style={{ fontSize:10, color:'rgba(196,181,253,0.6)', fontWeight:700 }}>LVL {level}</span>
              <span style={{ fontSize:10, color: phase==='input'?'#c4b5fd':'rgba(196,181,253,0.4)', fontWeight:700 }}>
                {phase==='input' ? `${input.length}/${sequence.length}` : phase==='correct'?'✓ CORRECT!':phase==='wrong'?'✗ WRONG':'Watching…'}
              </span>
              <span style={{ fontSize:10, color:'rgba(196,181,253,0.5)' }}>{accuracy}%</span>
            </div>

            {/* 3×3 Grid */}
            <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:6, padding:'0 20px' }}>
              {Array.from({length:9},(_,idx) => {
                const isLit = showing === idx;
                const isFlashed = flashed === idx;
                const color = GRID_COLORS[idx];
                return (
                  <motion.div key={idx}
                    onClick={() => handleCellClick(idx)}
                    animate={{
                      scale: isLit || isFlashed ? 1.08 : 1,
                      boxShadow: isLit ? `0 0 22px ${color}cc, 0 0 6px ${color}` : isFlashed ? `0 0 16px ${color}88` : `0 0 4px ${color}22`,
                    }}
                    transition={{ duration: 0.1 }}
                    style={{
                      width: 52, height: 52, borderRadius: 12,
                      background: isLit || isFlashed ? color : `${color}16`,
                      border: `2px solid ${color}${isLit||isFlashed?'ff':'44'}`,
                      cursor: phase==='input' ? 'pointer' : 'default',
                      transition: 'background 0.12s',
                    }}
                  />
                );
              })}
            </div>

            {/* Sequence dots */}
            <div style={{ display:'flex', gap:5, marginTop:4 }}>
              {sequence.map((_, i) => (
                <div key={i} style={{
                  width:7, height:7, borderRadius:'50%',
                  background: i < input.length ? '#c4b5fd' : 'rgba(196,181,253,0.2)',
                  boxShadow: i < input.length ? '0 0 6px #c4b5fd' : 'none',
                  transition: 'all 0.15s',
                }} />
              ))}
            </div>
          </>
        )}
      </div>
    </GameShell>
  );
}

// ════════════════════════════════════════════════════════════════════════════════
// GAME 5 — NUMBER DASH (Schulte Table)
// 16 numbers (1-16) scattered randomly in a 4×4 grid. Click them in order
// 1 → 16 as fast as possible. Gold standard clinical attention test.
// Clinical: directed visual attention, processing speed, ADHD marker.
// ════════════════════════════════════════════════════════════════════════════════
function NumberDash({ onSessionEnd }) {
  const [phase,     setPhase]     = useState('waiting');
  const [grid,      setGrid]      = useState([]);
  const [next,      setNext]      = useState(1);
  const [startTime, setStartTime] = useState(null);
  const [elapsed,   setElapsed]   = useState(0);
  const [flashCell, setFlashCell] = useState(null);
  const [flashOk,   setFlashOk]   = useState(true);
  const [attempts,  setAttempts]  = useState([]);  // times per round
  const [mistakes,  setMistakes]  = useState(0);
  const rafRef   = useRef(null);
  const startRef = useRef(Date.now());

  const buildGrid = () => {
    const nums = Array.from({length:16},(_,i)=>i+1);
    for (let i=nums.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [nums[i],nums[j]]=[nums[j],nums[i]]; }
    return nums;
  };

  useEffect(() => {
    if (phase !== 'running') return;
    const tick = () => {
      setElapsed(Math.round((Date.now() - startTime) / 100) / 10);
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [phase, startTime]);

  const startRound = () => {
    setGrid(buildGrid());
    setNext(1);
    setElapsed(0);
    const now = Date.now();
    setStartTime(now);
    setPhase('running');
  };

  const handleCellClick = (num) => {
    if (phase !== 'running') return;
    if (num === next) {
      playClick();
      setFlashCell(num); setFlashOk(true);
      setTimeout(() => setFlashCell(null), 250);
      const newNext = next + 1;
      if (newNext > 16) {
        // Round complete
        cancelAnimationFrame(rafRef.current);
        const roundTime = Math.round((Date.now() - startTime) / 100) / 10;
        setElapsed(roundTime);
        setAttempts((p) => [...p, roundTime]);
        setPhase('done');
      } else {
        setNext(newNext);
      }
    } else {
      playWrong();
      setFlashCell(num); setFlashOk(false);
      setMistakes((m) => m + 1);
      setTimeout(() => setFlashCell(null), 300);
    }
  };

  const bestTime = attempts.length ? Math.min(...attempts) : null;
  const avgTime  = attempts.length ? Math.round(attempts.reduce((a,b)=>a+b,0)/attempts.length*10)/10 : null;

  const handleEnd = () => {
    const dur = Math.round((Date.now() - startRef.current)/1000);
    const bt  = bestTime || dur;
    onSessionEnd({ gameId:'number_dash', gameName:'Number Dash', durationSeconds:dur, interactions:attempts.length*16+next-1, avgReactionMs: bt ? Math.round((bt/16)*1000) : 1000, accuracy: Math.round((((attempts.length*16)/(attempts.length*16+mistakes))||1)*100), score:attempts.length, extraData:{ bestTime:bt, avgTime } });
  };

  return (
    <GameShell title="Number Dash" color="#ffb300" score={attempts.length} unit="rounds" onEnd={handleEnd}
      instruction="Click 1 → 16 in order, as fast as you can">
      <div style={{ width:'100%', height:'100%', background:'radial-gradient(ellipse at 50% 30%,rgba(255,179,0,0.09),transparent 60%), #080500',
        borderRadius:13, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:10, padding:'8px 0' }}>

        {phase === 'waiting' || phase === 'done' ? (
          <div style={{ textAlign:'center' }}>
            {phase === 'done' && (
              <div style={{ marginBottom:12 }}>
                <div style={{ fontSize:22,marginBottom:4 }}>⚡</div>
                <p style={{ fontSize:13,fontWeight:800,color:'#ffb300' }}>{elapsed}s</p>
                {bestTime && <p style={{ fontSize:10,color:'rgba(255,179,0,0.6)' }}>best: {bestTime}s</p>}
              </div>
            )}
            {phase === 'waiting' && <div style={{ fontSize:32,marginBottom:10 }}>🔢</div>}
            <p style={{ fontSize:11,color:'rgba(255,179,0,0.65)',fontWeight:600,marginBottom:12 }}>
              {phase==='waiting' ? 'Find and click numbers 1→16 in order' : 'Round complete! Play again?'}
            </p>
            <button onClick={startRound}
              style={{ padding:'8px 22px',borderRadius:999,background:'rgba(255,179,0,0.12)',border:'1px solid rgba(255,179,0,0.35)',color:'#ffb300',fontWeight:700,fontSize:13,cursor:'pointer' }}>
              {phase==='done'?'Again':'Start'}
            </button>
          </div>
        ) : (
          <>
            {/* Timer + next target */}
            <div style={{ display:'flex',gap:16,alignItems:'center' }}>
              <span style={{ fontSize:10,color:'rgba(255,179,0,0.5)',fontFamily:'monospace' }}>{elapsed}s</span>
              <div style={{ display:'flex',alignItems:'center',gap:6 }}>
                <span style={{ fontSize:11,color:'rgba(255,179,0,0.5)',fontWeight:600 }}>find:</span>
                <motion.div
                  key={next}
                  initial={{ scale:1.5,opacity:0 }} animate={{ scale:1,opacity:1 }}
                  style={{ fontSize:20,fontWeight:900,color:'#ffb300',lineHeight:1 }}>
                  {next}
                </motion.div>
              </div>
              <span style={{ fontSize:10,color:'rgba(255,179,0,0.4)' }}>{mistakes} err</span>
            </div>

            {/* 4×4 grid */}
            <div style={{ display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:5,padding:'0 12px' }}>
              {grid.map((num) => {
                const isPast  = num < next;
                const isNext  = num === next;
                const isFlash = flashCell === num;
                return (
                  <motion.div key={num}
                    onClick={() => handleCellClick(num)}
                    animate={{ scale: isFlash ? 1.1 : 1 }}
                    transition={{ duration:0.1 }}
                    style={{
                      width:46, height:46, borderRadius:10,
                      display:'flex', alignItems:'center', justifyContent:'center',
                      fontSize:isPast?11:15, fontWeight:900,
                      cursor: isPast ? 'default' : 'pointer',
                      background: isPast ? 'rgba(255,179,0,0.04)' : isFlash && flashOk ? 'rgba(255,179,0,0.4)' : isFlash && !flashOk ? 'rgba(255,107,138,0.3)' : isNext ? 'rgba(255,179,0,0.12)' : 'rgba(255,255,255,0.04)',
                      border: `2px solid ${isPast?'rgba(255,179,0,0.1)':isNext?'rgba(255,179,0,0.6)':isFlash&&!flashOk?'rgba(255,107,138,0.6)':'rgba(255,255,255,0.08)'}`,
                      color: isPast ? 'rgba(255,179,0,0.2)' : isNext ? '#ffb300' : 'rgba(255,255,255,0.6)',
                      boxShadow: isNext ? '0 0 10px rgba(255,179,0,0.3)' : 'none',
                      transition: 'background 0.1s,border 0.1s,color 0.1s',
                      userSelect:'none',
                    }}>
                    {isPast ? '✓' : num}
                  </motion.div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </GameShell>
  );
}

// ════════════════════════════════════════════════════════════════════════════════
// GAME 6 — BREATHE FLOW
// An orb expands/contracts on a guide arc. Player holds mouse (inhale) and
// releases (exhale) in sync with the guide rhythm. Deviation from guide = score.
// Completely different: no clicking, no speed — pure rhythm + regulation.
// Clinical: parasympathetic activation, HRV proxy, anxiety/stress regulation.
// ════════════════════════════════════════════════════════════════════════════════
function BreatheFlow({ onSessionEnd }) {
  const [phase,       setPhase]       = useState('waiting');   // waiting|running|done
  const [guideSize,   setGuideSize]   = useState(0);           // 0-100 guide orb %
  const [playerSize,  setPlayerSize]  = useState(0);           // 0-100 player hold %
  const [holding,     setHolding]     = useState(false);
  const [calmScore,   setCalmScore]   = useState(0);
  const [cycle,       setCycle]       = useState(0);           // breathing cycles
  const [deviations,  setDeviations]  = useState([]);
  const [breathLabel, setBreathLabel] = useState('');
  const startRef   = useRef(Date.now());
  const guideRef   = useRef(0);
  const guidePhase = useRef(0); // 0=inhale,1=hold,2=exhale
  const phaseTimer = useRef(0);
  const rafRef     = useRef(null);

  const INHALE_DUR = 4000;
  const HOLD_DUR   = 2000;
  const EXHALE_DUR = 4000;
  const TOTAL_CYC  = INHALE_DUR + HOLD_DUR + EXHALE_DUR;

  // Guide oscillator
  useEffect(() => {
    if (phase !== 'running') return;
    let startT = Date.now();
    let lastCycle = -1;

    const tick = () => {
      const elapsed = (Date.now() - startT) % TOTAL_CYC;
      let guide = 0;
      let label = '';

      if (elapsed < INHALE_DUR) {
        guide = (elapsed / INHALE_DUR) * 100;
        label = '↑ Breathe In';
      } else if (elapsed < INHALE_DUR + HOLD_DUR) {
        guide = 100;
        label = '— Hold';
      } else {
        guide = 100 - ((elapsed - INHALE_DUR - HOLD_DUR) / EXHALE_DUR) * 100;
        label = '↓ Breathe Out';
      }

      const cycleN = Math.floor((Date.now() - startT) / TOTAL_CYC);
      if (cycleN > lastCycle) {
        lastCycle = cycleN;
        setCycle(cycleN);
        if (cycleN > 0) playBreathe(false);
      }

      guideRef.current = guide;
      setGuideSize(guide);
      setBreathLabel(label);
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [phase]);

  // Track player vs guide deviation
  useEffect(() => {
    if (phase !== 'running') return;
    const t = setInterval(() => {
      const dev = Math.abs(playerSize - guideRef.current);
      setDeviations((p) => [...p.slice(-60), dev]);
      const score = Math.max(0, Math.round((100 - dev) / 10));
      setCalmScore((p) => Math.min(100, p + (dev < 20 ? 1 : dev < 40 ? 0 : -1)));
    }, 250);
    return () => clearInterval(t);
  }, [phase, playerSize]);

  const handleHoldStart = () => {
    if (phase !== 'running') return;
    setHolding(true);
    playBreathe(true);
  };
  const handleHoldEnd = () => {
    setHolding(false);
  };

  // Player size follows hold state
  useEffect(() => {
    if (phase !== 'running') return;
    let raf2;
    const update = () => {
      setPlayerSize((prev) => {
        const target = holding ? 100 : 0;
        const speed  = holding ? 3.5 : 4.5;
        return Math.abs(prev - target) < 2 ? target : prev + (target > prev ? speed : -speed);
      });
      raf2 = requestAnimationFrame(update);
    };
    raf2 = requestAnimationFrame(update);
    return () => cancelAnimationFrame(raf2);
  }, [holding, phase]);

  const avgDeviation = deviations.length ? Math.round(deviations.reduce((a,b)=>a+b,0)/deviations.length) : 0;
  const syncPercent  = Math.max(0, 100 - avgDeviation);

  const handleEnd = () => {
    cancelAnimationFrame(rafRef.current);
    const dur = Math.round((Date.now() - startRef.current)/1000);
    onSessionEnd({ gameId:'breathe_flow', gameName:'Breathe Flow', durationSeconds:dur, interactions:Math.max(1,cycle), avgReactionMs:1000, accuracy:syncPercent, score:Math.round(calmScore), extraData:{ avgDeviation, cycles:Math.max(1,cycle) } });
  };

  const guideRad = 50 + guideSize * 0.55;  // px 50-105
  const playerRad= 50 + playerSize * 0.55;
  const syncColor = syncPercent > 75 ? '#00e676' : syncPercent > 50 ? '#5eead4' : syncPercent > 30 ? '#ffb300' : '#ff6b8a';

  return (
    <GameShell title="Breathe Flow" color="#5eead4" score={Math.round(calmScore)} unit="calm" onEnd={handleEnd}
      instruction="Hold to inhale · release to exhale · match the guide">
      <div
        onMouseDown={handleHoldStart} onMouseUp={handleHoldEnd} onMouseLeave={handleHoldEnd}
        onTouchStart={(e)=>{e.preventDefault();handleHoldStart();}} onTouchEnd={(e)=>{e.preventDefault();handleHoldEnd();}}
        style={{ width:'100%', height:'100%',
          background:'radial-gradient(ellipse at 50% 50%,rgba(94,234,212,0.07),transparent 65%), #020f0e',
          borderRadius:13, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center',
          cursor: phase==='running'?'pointer':'default', userSelect:'none', WebkitUserSelect:'none', position:'relative' }}>

        {phase === 'waiting' ? (
          <div style={{ textAlign:'center' }}>
            <div style={{ fontSize:32,marginBottom:10 }}>🌬️</div>
            <p style={{ fontSize:11,color:'rgba(94,234,212,0.65)',fontWeight:600,marginBottom:6 }}>
              Match your breathing to the guide orb
            </p>
            <p style={{ fontSize:10,color:'var(--text-3)',marginBottom:14,lineHeight:1.6 }}>
              Hold anywhere to inhale<br/>Release to exhale
            </p>
            <button onClick={() => setPhase('running')}
              style={{ padding:'8px 22px',borderRadius:999,background:'rgba(94,234,212,0.1)',border:'1px solid rgba(94,234,212,0.3)',color:'#5eead4',fontWeight:700,fontSize:13,cursor:'pointer' }}>
              Begin
            </button>
          </div>
        ) : (
          <>
            {/* Breath label */}
            <div style={{ fontSize:11,fontWeight:700,color:'rgba(94,234,212,0.7)',letterSpacing:'0.08em',marginBottom:8,textTransform:'uppercase' }}>
              {breathLabel}
            </div>

            {/* Concentric breathing orbs */}
            <div style={{ position:'relative',width:220,height:220,display:'flex',alignItems:'center',justifyContent:'center' }}>
              {/* Guide orb (ghost) */}
              <motion.div
                animate={{ width: guideRad*2, height: guideRad*2 }}
                transition={{ duration:0.2 }}
                style={{ position:'absolute', borderRadius:'50%', border:'2px dashed rgba(94,234,212,0.35)', background:`radial-gradient(circle,rgba(94,234,212,0.04),transparent 70%)` }}
              />

              {/* Player orb */}
              <motion.div
                animate={{ width: playerRad*2, height: playerRad*2 }}
                transition={{ duration:0.08 }}
                style={{ position:'absolute', borderRadius:'50%',
                  background:`radial-gradient(circle at 38% 38%, ${syncColor}44, ${syncColor}11)`,
                  border:`2px solid ${syncColor}80`,
                  boxShadow:`0 0 ${20 + playerSize*0.4}px ${syncColor}44`,
                  transition:'border-color 0.3s, box-shadow 0.2s',
                }}
              />

              {/* Center dot */}
              <div style={{ width:14,height:14,borderRadius:'50%',background:syncColor,boxShadow:`0 0 10px ${syncColor}`,zIndex:5,position:'relative',transition:'background 0.3s' }} />
            </div>

            {/* Sync bar */}
            <div style={{ display:'flex',alignItems:'center',gap:8,marginTop:8 }}>
              <div style={{ width:80,height:3,borderRadius:999,background:'rgba(255,255,255,0.06)' }}>
                <div style={{ height:'100%',width:`${syncPercent}%`,background:syncColor,borderRadius:999,transition:'width 0.2s,background 0.3s' }} />
              </div>
              <span style={{ fontSize:9.5,color:syncColor,fontWeight:700 }}>{syncPercent}% sync</span>
            </div>

            {/* Cycle count */}
            <div style={{ marginTop:6,fontSize:9,color:'var(--text-3)' }}>
              cycle {cycle} · hold anywhere to inhale
            </div>
          </>
        )}
      </div>
    </GameShell>
  );
}

// ════════════════════════════════════════════════════════════════════════════════
// Game card + definitions
// ════════════════════════════════════════════════════════════════════════════════
function GameCard({ game, onClick }) {
  return (
    <motion.button onClick={onClick}
      whileHover={{ scale:1.03 }} whileTap={{ scale:0.95 }}
      style={{ width:'100%', display:'flex', flexDirection:'column', alignItems:'center', gap:7, padding:'12px 8px',
        borderRadius:16, cursor:'pointer', background:`${game.color}06`, border:`1px solid ${game.color}20`,
        backdropFilter:'blur(10px)', textAlign:'center', transition:'border-color 0.2s',
      }}
      onMouseEnter={(e) => { e.currentTarget.style.borderColor=`${game.color}45`; e.currentTarget.style.background=`${game.color}0e`; }}
      onMouseLeave={(e) => { e.currentTarget.style.borderColor=`${game.color}20`; e.currentTarget.style.background=`${game.color}06`; }}
    >
      <div style={{ fontSize:26,lineHeight:1,filter:`drop-shadow(0 0 6px ${game.color}55)` }}>{game.emoji}</div>
      <div>
        <p style={{ fontSize:10.5,fontWeight:800,color:game.color,letterSpacing:'-0.01em',marginBottom:2 }}>{game.name}</p>
        <p style={{ fontSize:9,color:'var(--text-3)',lineHeight:1.4 }}>{game.tagline}</p>
      </div>
      <div style={{ fontSize:8.5,color:game.color,opacity:0.55,fontWeight:600,letterSpacing:'0.06em',textTransform:'uppercase' }}>
        {game.mechanic}
      </div>
    </motion.button>
  );
}

const GAME_DEFS = [
  { id:'squeeze_release', name:'Squeeze Release', emoji:'🫳', color:'#ff6b8a', tagline:'Release built-up tension', mechanic:'Hold & release', side:'left',  Component:SqueezeRelease },
  { id:'color_sort',      name:'Color Sort',      emoji:'🎨', color:'#00e5ff', tagline:'Sort by colour logic',   mechanic:'Drag & match',  side:'left',  Component:ColorSort      },
  { id:'word_smash',      name:'Word Smash',      emoji:'💥', color:'#c4b5fd', tagline:'Crush negativity',       mechanic:'Click to smash', side:'left', Component:WordSmash      },
  { id:'memory_pulse',    name:'Memory Pulse',    emoji:'🧠', color:'#a78bfa', tagline:'Test working memory',    mechanic:'Sequence repeat',side:'right', Component:MemoryPulse    },
  { id:'number_dash',     name:'Number Dash',     emoji:'🔢', color:'#ffb300', tagline:'Schulte attention test', mechanic:'Order 1→16',    side:'right', Component:NumberDash     },
  { id:'breathe_flow',    name:'Breathe Flow',    emoji:'🌬️', color:'#5eead4', tagline:'Guided breathing calm',  mechanic:'Hold to inhale', side:'right', Component:BreatheFlow    },
];

// ════════════════════════════════════════════════════════════════════════════════
// Physics helpers (unchanged from v3)
// ════════════════════════════════════════════════════════════════════════════════
const drawWrappedText = (ctx, text, maxWidth, lh=14) => {
  const words=text.split(' '); const lines=[]; let line='';
  words.forEach((w)=>{ const c=line?`${line} ${w}`:w; if(ctx.measureText(c).width>maxWidth-16&&line){lines.push(line);line=w;}else line=c; });
  if(line)lines.push(line); const capped=lines.slice(0,3);
  const off=((capped.length-1)*lh)/2; capped.forEach((l,i)=>ctx.fillText(l,0,i*lh-off));
};

const getGridSpawnPositions = (count, canvasWidth) => {
  const positions=[];
  const cols=Math.min(count,Math.ceil(Math.sqrt(count*1.5)));
  const colWidth=(canvasWidth-100)/cols;
  for(let i=0;i<count;i++){
    const col=i%cols; const row=Math.floor(i/cols);
    const x=50+col*colWidth+colWidth*0.5+(Math.random()-0.5)*(colWidth*0.28);
    const y=-55-row*85-Math.random()*25;
    positions.push({x:Math.max(70,Math.min(canvasWidth-70,x)),y});
  }
  return positions;
};

const weightToStyle = (w) => {
  if(w>=8) return {fill:'#7f1d1d',stroke:'rgba(248,113,113,0.5)',label:'#fee2e2'};
  if(w>=6) return {fill:'#78350f',stroke:'rgba(251,146,60,0.4)',label:'#fed7aa'};
  if(w>=4) return {fill:'#3f3f46',stroke:'rgba(196,181,253,0.35)',label:'#e9d5ff'};
  return {fill:'#1e3a5f',stroke:'rgba(103,232,249,0.3)',label:'#cffafe'};
};

// ════════════════════════════════════════════════════════════════════════════════
// MAIN CognitiveForge
// ════════════════════════════════════════════════════════════════════════════════
export default function CognitiveForge() {
  const sceneRef    = useRef(null);
  const engineRef   = useRef(null);
  const worldRef    = useRef(null);
  const renderRef   = useRef(null);
  const runnerRef   = useRef(null);
  const mcRef       = useRef(null);
  const incRef      = useRef(null);
  const boundaryRef = useRef([]);
  const resizeRafRef= useRef(null);
  const timersRef   = useRef([]);
  const dimsRef     = useRef({width:MAX_W,height:PHYSICS_H});
  const reframeRef  = useRef('I release this. I am stronger than my worries.');
  const lastDestroyRef = useRef(0);
  const comboRef       = useRef(0);
  const comboTimerRef  = useRef(null);

  const [text,         setText]         = useState('');
  const [reframeText,  setReframeText]  = useState('I release this. I am stronger than my worries.');
  const [isLoading,    setLoading]      = useState(false);
  const [error,        setError]        = useState(null);
  const [hasBlocks,    setHasBlocks]    = useState(false);
  const [destroyedN,   setDestroyedN]   = useState(0);
  const [comboDisplay, setComboDisplay] = useState(0);
  const [showCombo,    setShowCombo]    = useState(false);
  const [showInput,    setShowInput]    = useState(true);
  const [phoenixTexts, setPhoenixTexts] = useState([]);
  const [activeGame,   setActiveGame]   = useState(null);
  const [gameSessions, setGameSessions] = useState([]);
  const [reportBusy,   setReportBusy]   = useState(false);
  const [reportMsg,    setReportMsg]    = useState(null);

  const { userId, worries, setWorries, markWorryDestroyed } = useStore();

  useEffect(()=>{ reframeRef.current=reframeText; },[reframeText]);

  const rememberTimer = useCallback((id)=>{ timersRef.current.push(id); },[]);
  const clearTimers   = useCallback(()=>{ timersRef.current.forEach(clearTimeout); timersRef.current=[]; },[]);

  const triggerCombo = useCallback((n)=>{
    setComboDisplay(n); setShowCombo(true);
    playTone([523,659,784,1047,1319][Math.min(n-1,4)],'triangle',0.25,0.15);
    if(comboTimerRef.current)clearTimeout(comboTimerRef.current);
    comboTimerRef.current=setTimeout(()=>{setShowCombo(false);comboRef.current=0;},2000);
  },[]);

  const onWorryDestroyed = useCallback((uuid,bx,by)=>{
    markWorryDestroyed(uuid);
    const now=Date.now();
    if(now-lastDestroyRef.current<2000)comboRef.current+=1; else comboRef.current=1;
    lastDestroyRef.current=now;
    setDestroyedN((n)=>n+1);
    playTone(280,'sawtooth',0.09,0.15);
    const canvas=renderRef.current?.canvas;
    const rect=canvas?.getBoundingClientRect?.();
    const sx=rect?rect.left+bx*(rect.width/dimsRef.current.width):window.innerWidth/2;
    const sy=rect?rect.top+by*(rect.height/dimsRef.current.height):window.innerHeight*0.8;
    confetti({particleCount:18+comboRef.current*7,spread:55,origin:{x:sx/window.innerWidth,y:sy/window.innerHeight},colors:['#fb7185','#f97316','#f59e0b','#67e8f9','#c4b5fd'],ticks:85,gravity:0.5,scalar:0.8,startVelocity:18});
    if(comboRef.current>=2)triggerCombo(comboRef.current);
    const pid=`px-${Date.now()}`;
    setPhoenixTexts((p)=>[...p.slice(-2),{id:pid,text:reframeRef.current?.trim()||'I am free.'}]);
    setTimeout(()=>setPhoenixTexts((p)=>p.filter((x)=>x.id!==pid)),3500);
    if(userId)forgeApi.destroy(userId,uuid).catch(()=>{});
  },[markWorryDestroyed,triggerCombo,userId]);

  const addWorryBlock = useCallback((worryText,options={})=>{
    const world=worldRef.current; if(!world)return null;
    const {width}=dimsRef.current;
    const weight=Math.max(1,Math.min(10,Number(options.weight)||5));
    const blockW=Math.max(140,100+weight*18);
    const style=weightToStyle(weight);
    const x=options.x??(80+Math.random()*Math.max(1,width-160));
    const y=options.y??(-55-Math.random()*50);
    const body=Bodies.rectangle(x,y,blockW,58,{label:'worry_block',density:0.006+weight*0.0003,restitution:0.12,friction:0.85,frictionAir:0.04,chamfer:{radius:10},render:{fillStyle:style.fill,strokeStyle:style.stroke,lineWidth:1.5}});
    body.plugin={kind:'worry_block',text:String(worryText||'worry').slice(0,60),labelColor:style.label,uuid:options.uuid||uuidv4(),weight,consumed:false};
    Body.setAngularVelocity(body,(Math.random()-0.5)*0.06);
    World.add(world,body); return body;
  },[]);

  const shatterWorryBlock = useCallback((b)=>{
    const world=worldRef.current;
    if(!world||!b||b.plugin?.consumed)return;
    b.plugin.consumed=true;
    const {x,y}=b.position;
    const uuid=b.plugin?.uuid;
    Composite.remove(world,b);
    if(uuid)onWorryDestroyed(uuid,x,y);
  },[onWorryDestroyed]);

  const spawnWorryBatch = useCallback((worryItems)=>{
    requestAnimationFrame(()=>{
      const {width}=dimsRef.current;
      const positions=getGridSpawnPositions(worryItems.length,width);
      worryItems.forEach((worry,idx)=>{
        const t=setTimeout(()=>{ addWorryBlock(worry.worry,{uuid:worry.uuid||uuidv4(),weight:worry.weight,x:positions[idx]?.x,y:positions[idx]?.y}); },100+idx*150);
        rememberTimer(t);
      });
    });
  },[addWorryBlock,rememberTimer]);

  const clearWorldBodies = useCallback(()=>{
    const world=worldRef.current; if(!world)return;
    Composite.allBodies(world).filter((b)=>b.label!=='boundary'&&b.label!=='incinerator').forEach((b)=>Composite.remove(world,b));
    clearTimers();
  },[clearTimers]);

  useEffect(()=>{
    const host=sceneRef.current;
    if(!host||engineRef.current)return;
    host.innerHTML='';
    const engine=Engine.create({gravity:{x:0,y:0.9},positionIterations:8,velocityIterations:6});
    const render=Render.create({element:host,engine,options:{width:MAX_W,height:PHYSICS_H,wireframes:false,background:'transparent',pixelRatio:Math.min(window.devicePixelRatio||1,2)}});
    render.canvas.style.width='100%'; render.canvas.style.height=`${PHYSICS_H}px`; render.canvas.style.display='block';
    const runner=Runner.create(); const world=engine.world;
    engineRef.current=engine; renderRef.current=render; runnerRef.current=runner; worldRef.current=world;

    const makeBoundaries=(w,h)=>{
      const opts={isStatic:true,label:'boundary',render:{visible:false}};
      const inc=Bodies.rectangle(w/2,h-20,w-60,40,{isStatic:true,isSensor:true,label:'incinerator',render:{visible:false}});
      return{bodies:[Bodies.rectangle(w/2,h+30,w+100,60,opts),Bodies.rectangle(-30,h/2,60,h+100,opts),Bodies.rectangle(w+30,h/2,60,h+100,opts),Bodies.rectangle(w/2,-30,w+100,60,opts),inc],inc};
    };
    const syncSize=()=>{
      const nw=Math.min(MAX_W,Math.max(MIN_W,Math.floor(host.clientWidth||MAX_W))); const nh=PHYSICS_H;
      const{width:pw,height:ph}=dimsRef.current; if(nw===pw&&nh===ph)return;
      dimsRef.current={width:nw,height:nh};
      render.options.width=nw; render.options.height=nh;
      const dpr=Math.min(window.devicePixelRatio||1,2);
      render.canvas.width=nw*dpr; render.canvas.height=nh*dpr;
      render.canvas.style.width='100%'; render.canvas.style.height=`${nh}px`;
      if(boundaryRef.current.length)boundaryRef.current.forEach((b)=>Composite.remove(world,b));
      const{bodies,inc}=makeBoundaries(nw,nh);
      boundaryRef.current=bodies; incRef.current=inc; World.add(world,bodies);
    };
    requestAnimationFrame(syncSize);
    const scheduleResize=()=>{if(resizeRafRef.current)cancelAnimationFrame(resizeRafRef.current);resizeRafRef.current=requestAnimationFrame(syncSize);};
    let ro=null;
    if(typeof ResizeObserver!=='undefined'){ro=new ResizeObserver(scheduleResize);ro.observe(host);}else window.addEventListener('resize',scheduleResize);
    const mouse=Mouse.create(render.canvas);
    const mc=MouseConstraint.create(engine,{mouse,constraint:{stiffness:0.18,damping:0.22,render:{visible:true,lineWidth:1,strokeStyle:'rgba(251,191,36,0.3)'}}});
    render.mouse=mouse; mcRef.current=mc; World.add(world,mc);
    const onCollision=({pairs})=>{ pairs.forEach(({bodyA,bodyB})=>{ const isInc=bodyA.label==='incinerator'||bodyB.label==='incinerator'; if(!isInc)return; const block=bodyA.label==='worry_block'?bodyA:bodyB.label==='worry_block'?bodyB:null; if(block)shatterWorryBlock(block); }); };
    const onAfterRender=()=>{ const ctx=render.context; Composite.allBodies(world).forEach((body)=>{ if(body.label!=='worry_block'||!body.plugin?.text)return; ctx.save(); ctx.translate(body.position.x,body.position.y); ctx.rotate(body.angle); ctx.font='600 12.5px "Plus Jakarta Sans",system-ui,sans-serif'; ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillStyle=body.plugin.labelColor||'rgba(255,241,242,0.95)'; ctx.shadowColor='rgba(0,0,0,0.5)'; ctx.shadowBlur=6; drawWrappedText(ctx,body.plugin.text,body.bounds.max.x-body.bounds.min.x); ctx.restore(); }); };
    Events.on(engine,'collisionStart',onCollision);
    Events.on(render,'afterRender',onAfterRender);
    Render.run(render); Runner.run(runner,engine);
    return()=>{
      if(ro)ro.disconnect();else window.removeEventListener('resize',scheduleResize);
      if(resizeRafRef.current)cancelAnimationFrame(resizeRafRef.current);
      clearTimers();
      Events.off(engine,'collisionStart',onCollision); Events.off(render,'afterRender',onAfterRender);
      if(mcRef.current)World.remove(world,mcRef.current);
      Render.stop(render); Runner.stop(runner); World.clear(world,false); Engine.clear(engine);
      if(render.canvas?.parentNode)render.canvas.parentNode.removeChild(render.canvas);
      render.textures={};
      engineRef.current=null; renderRef.current=null; runnerRef.current=null; worldRef.current=null;
    };
  },[clearTimers,shatterWorryBlock]);

  const handleGameSessionEnd = useCallback((rawMetrics)=>{
    const predictedEffects=derivePredictedEffects(rawMetrics.gameId,rawMetrics);
    const session={...rawMetrics,predictedEffects,completedAt:new Date().toISOString()};
    setGameSessions((prev)=>[...prev,session]);
    setActiveGame(null);
    setReportMsg(`${rawMetrics.gameName} logged · score ${rawMetrics.score} · ${rawMetrics.durationSeconds}s`);
    setTimeout(()=>setReportMsg(null),3500);
  },[]);

  const handleExtract=async()=>{
    if(!text.trim()||isLoading)return;
    setError(null); setLoading(true);
    try{
      const data=await forgeApi.extract(text.trim(),userId);
      const nextWorries=(data.worries||[]).map((w,idx)=>({...w,id:w.id??idx+1,uuid:w.uuid||uuidv4(),status:w.status||'active'}));
      setWorries(nextWorries); clearWorldBodies(); spawnWorryBatch(nextWorries);
      setHasBlocks(nextWorries.length>0); setShowInput(false); setDestroyedN(0); comboRef.current=0;
    }catch(err){ setError(err.message||'Could not extract worries.'); }
    finally{ setLoading(false); }
  };

  const handleGenerateReport=async()=>{
    if(!userId||reportBusy)return;
    setReportBusy(true);
    try{
      const{clinicalApi}=await import('../../services/portalApi.js');
      const res=await clinicalApi.sessionReport({userId,source:'manual',currentTask:'Cognitive Forge session',vocalArousalScore:5,sendToGuardian:false,sessionSnapshot:{initialAnxietyQuery:text,shatteredWorryBlocks:worries.map((w)=>({id:w.uuid||String(w.id),text:w.worry,weight:w.weight,status:w.status||'active'})),gameSessions,notes:gameSessions.length?`Therapeutic activity suite: ${gameSessions.map(s=>`${s.gameName}(${s.durationSeconds}s,score:${s.score})`).join(', ')}.`:'No therapeutic games played.'}});
      if(res.downloadUrl)window.open(res.downloadUrl,'_blank','noopener,noreferrer');
      setReportMsg(`Report ready · Risk: ${res.riskLevel}`); setTimeout(()=>setReportMsg(null),5000);
    }catch(e){ setReportMsg(`Report failed: ${e.message}`); setTimeout(()=>setReportMsg(null),5000); }
    finally{ setReportBusy(false); }
  };

  const handleReset=()=>{ clearWorldBodies(); setWorries([]); setHasBlocks(false); setDestroyedN(0); setShowInput(true); setText(''); setPhoenixTexts([]); comboRef.current=0; setShowCombo(false); };

  const activeCount = worries.filter((w)=>w.status!=='destroyed').length;
  const allCleared  = hasBlocks && activeCount===0;
  const leftGames   = GAME_DEFS.filter((g)=>g.side==='left');
  const rightGames  = GAME_DEFS.filter((g)=>g.side==='right');
  const totalGameTime=gameSessions.reduce((s,g)=>s+g.durationSeconds,0);
  const ActiveGameComponent=activeGame?GAME_DEFS.find((g)=>g.id===activeGame)?.Component:null;

  return(
    <div className="page fade-up" style={{maxWidth:1200,paddingBottom:40}}>
      {/* Header */}
      <motion.div initial={{opacity:0,y:14}} animate={{opacity:1,y:0}} style={{marginBottom:24}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',flexWrap:'wrap',gap:12}}>
          <div>
            <span className="badge badge-amber" style={{marginBottom:10}}><Flame size={10}/> Cognitive Forge</span>
            <h1 className="section-title">Burn What Blocks You</h1>
            <p className="section-sub">Extract worries as physics blocks · drag to the fire · play therapeutic games to measure &amp; release</p>
          </div>
          {gameSessions.length>0&&(
            <div style={{display:'flex',gap:10,alignItems:'center',flexWrap:'wrap'}}>
              <span className="badge badge-teal"><Star size={9}/> {gameSessions.length} sessions · {totalGameTime}s</span>
              <motion.button className="btn btn-secondary" onClick={handleGenerateReport} disabled={reportBusy} whileTap={{scale:0.97}} style={{fontSize:12,padding:'8px 16px'}}>
                <FileText size={12}/> {reportBusy?'Generating…':'Full Report'}
              </motion.button>
            </div>
          )}
        </div>
      </motion.div>

      {/* 3-column layout */}
      <div style={{display:'flex',gap:12,alignItems:'flex-start'}}>

        {/* LEFT */}
        <div style={{width:158,flexShrink:0,display:'flex',flexDirection:'column',gap:9,paddingTop:6}}>
          <p style={{fontSize:9,color:'var(--text-3)',fontWeight:700,textTransform:'uppercase',letterSpacing:'0.1em',textAlign:'center',marginBottom:2}}>RELEASE</p>
          {leftGames.map((g)=><GameCard key={g.id} game={g} onClick={()=>setActiveGame(g.id)}/>)}
        </div>

        {/* CENTER — Forge */}
        <div style={{flex:1,minWidth:0}}>
          <AnimatePresence>
            {showInput&&(
              <motion.div initial={{opacity:0,y:12}} animate={{opacity:1,y:0}} exit={{opacity:0,scale:0.97}} className="glass" style={{padding:20,marginBottom:16}}>
                <textarea className="textarea" rows={4} placeholder="Type your worries here — raw, messy, unfiltered..." value={text} onChange={(e)=>setText(e.target.value)} onKeyDown={(e)=>{if(e.key==='Enter'&&e.metaKey)handleExtract();}}/>
                {!text&&(
                  <div style={{display:'flex',gap:6,flexWrap:'wrap',margin:'8px 0'}}>
                    {["I'm behind on deadlines","my relationship feels distant","money is tight"].map((ex)=>(
                      <button key={ex} onClick={()=>setText((p)=>p?`${p}, ${ex}`:ex)} style={{fontSize:10.5,padding:'3px 10px',borderRadius:999,background:'rgba(255,179,0,0.08)',border:'1px solid rgba(255,179,0,0.2)',color:'#ffe082',cursor:'pointer'}}>+ {ex}</button>
                    ))}
                  </div>
                )}
                <div style={{position:'relative',marginTop:8}}>
                  <label style={{fontSize:9.5,color:'var(--text-3)',fontWeight:700,textTransform:'uppercase',letterSpacing:'0.08em',display:'block',marginBottom:5}}>Phoenix Reframe</label>
                  <input value={reframeText} onChange={(e)=>setReframeText(e.target.value)} style={{width:'100%',background:'rgba(3,7,18,0.72)',border:'1px solid rgba(103,232,249,0.2)',color:'var(--text-1)',borderRadius:12,padding:'9px 14px',outline:'none',fontFamily:'inherit',fontSize:12.5}}/>
                </div>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginTop:13}}>
                  <span style={{fontSize:11,color:'var(--text-3)'}}>{text.length} chars · ⌘↵</span>
                  <motion.button className="btn btn-primary" onClick={handleExtract} disabled={isLoading||text.trim().length<5} whileHover={{scale:1.02}} whileTap={{scale:0.97}}>
                    {isLoading?<span className="spinner"/>:<Sparkles size={13}/>}
                    {isLoading?'Extracting…':'Forge the blocks'}
                  </motion.button>
                </div>
                {error&&<p style={{marginTop:9,fontSize:12.5,color:'#fca5a5'}}>{error}</p>}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Physics canvas */}
          <div style={{position:'relative',borderRadius:20,overflow:'hidden',border:'1px solid rgba(125,211,252,0.12)',background:'radial-gradient(ellipse at 50% 5%,rgba(34,211,238,0.18) 0%,transparent 50%),radial-gradient(ellipse at 50% 100%,rgba(251,146,60,0.2) 0%,transparent 40%),linear-gradient(180deg,#030712 0%,#020617 60%,#0b1120 100%)',boxShadow:'0 20px 60px rgba(2,6,23,0.8)',minHeight:PHYSICS_H}}>
            <div style={{position:'absolute',inset:0,pointerEvents:'none',zIndex:0,backgroundImage:'radial-gradient(rgba(103,232,249,0.07) 1px,transparent 1px)',backgroundSize:'28px 28px'}}/>
            <div ref={sceneRef} style={{position:'relative',zIndex:1,minHeight:PHYSICS_H}}/>
            <AnimatePresence>
              {showCombo&&comboDisplay>=2&&(
                <motion.div initial={{opacity:0,scale:0.4,y:-20}} animate={{opacity:1,scale:1,y:0}} exit={{opacity:0,scale:1.4,y:-40}}
                  style={{position:'absolute',top:70,left:'50%',transform:'translateX(-50%)',zIndex:100,pointerEvents:'none',textAlign:'center'}}>
                  <div style={{fontSize:26,fontWeight:900,background:'linear-gradient(135deg,#ffb300,#ff6b8a)',WebkitBackgroundClip:'text',WebkitTextFillColor:'transparent',filter:'drop-shadow(0 0 10px rgba(255,179,0,0.6))'}}>
                    {comboDisplay}x COMBO!
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
            <AnimatePresence>
              {phoenixTexts.map(({id,text:txt})=>(
                <motion.div key={id} initial={{opacity:0,y:0,scale:0.8}} animate={{opacity:[0,1,1,0],y:-110,scale:1}} transition={{duration:3.2,ease:'easeOut'}}
                  style={{position:'absolute',bottom:76,left:'50%',transform:'translateX(-50%)',zIndex:50,pointerEvents:'none',textAlign:'center',width:'80%'}}>
                  <div style={{display:'inline-block',padding:'8px 18px',background:'linear-gradient(135deg,rgba(0,229,255,0.12),rgba(124,58,237,0.12))',border:'1px solid rgba(0,229,255,0.3)',borderRadius:999,fontSize:12.5,fontWeight:700,color:'#67e8f9',backdropFilter:'blur(12px)'}}>✦ {txt}</div>
                </motion.div>
              ))}
            </AnimatePresence>
            <AnimatePresence>
              {!hasBlocks&&(
                <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}
                  style={{position:'absolute',inset:0,zIndex:2,pointerEvents:'none',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:10}}>
                  <motion.div animate={{scale:[1,1.08,1],opacity:[0.4,0.7,0.4]}} transition={{duration:3.5,repeat:Infinity,ease:'easeInOut'}}
                    style={{width:66,height:66,borderRadius:'50%',background:'radial-gradient(circle,rgba(34,211,238,0.14),transparent 70%)',border:'1px solid rgba(103,232,249,0.16)',display:'flex',alignItems:'center',justifyContent:'center'}}>
                    <Wind size={24} color="rgba(103,232,249,0.5)"/>
                  </motion.div>
                  <p style={{color:'var(--text-3)',fontSize:13.5,fontWeight:600}}>Worry blocks appear here</p>
                  <p style={{color:'var(--text-3)',fontSize:11,opacity:0.65}}>Try a game on either side →</p>
                </motion.div>
              )}
            </AnimatePresence>
            {/* Flame incinerator */}
            <div style={{position:'absolute',bottom:0,left:0,right:0,height:68,zIndex:3,pointerEvents:'none',overflow:'hidden'}}>
              <div style={{position:'absolute',inset:0,background:'linear-gradient(to top,rgba(251,146,60,0.28) 0%,rgba(251,146,60,0.1) 60%,transparent 100%)',borderTop:'1px solid rgba(251,191,36,0.42)',boxShadow:'0 -16px 52px rgba(251,146,60,0.22)'}}/>
              {Array.from({length:9},(_,i)=>(
                <div key={i} style={{position:'absolute',bottom:0,left:`${6+i*10}%`,width:15,height:26,background:`linear-gradient(to top,rgba(251,146,60,0.85),rgba(251,191,36,0.42),transparent)`,borderRadius:'50% 50% 30% 30%',animation:`flameFlicker ${0.72+i*0.12}s ${i*0.09}s ease-in-out infinite alternate`,filter:'blur(2.5px)',transformOrigin:'bottom center'}}/>
              ))}
              <div style={{position:'absolute',bottom:0,left:0,right:0,display:'flex',alignItems:'center',justifyContent:'center',paddingBottom:7,gap:5}}>
                <Flame size={11} color="rgba(254,240,138,0.85)"/>
                <span style={{fontSize:9.5,fontWeight:800,letterSpacing:'0.12em',textTransform:'uppercase',color:'rgba(254,240,138,0.8)'}}>Incinerator · Drop to release</span>
                <Flame size={11} color="rgba(254,240,138,0.85)"/>
              </div>
            </div>
          </div>

          {/* Stats bar */}
          {hasBlocks&&(
            <motion.div initial={{opacity:0,y:8}} animate={{opacity:1,y:0}}
              style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginTop:10,flexWrap:'wrap',gap:7}}>
              <div style={{display:'flex',gap:7}}>
                {destroyedN>0&&<span className="badge badge-green"><Zap size={9}/> {destroyedN} released</span>}
                {activeCount>0&&<span className="badge badge-amber">{activeCount} remaining</span>}
                {allCleared&&<motion.span initial={{scale:0.8}} animate={{scale:1}} className="badge badge-cyan"><Trophy size={9}/> All cleared! ✦</motion.span>}
              </div>
              <div style={{display:'flex',gap:6}}>
                {!showInput&&<motion.button className="btn btn-secondary" onClick={()=>setShowInput(true)} whileTap={{scale:0.96}} style={{fontSize:11,padding:'6px 12px'}}><Sparkles size={11}/> Add more</motion.button>}
                {allCleared&&<motion.button className="btn btn-primary" onClick={handleReset} whileTap={{scale:0.96}} style={{fontSize:11,padding:'6px 12px'}}><RotateCcw size={11}/> New session</motion.button>}
                <motion.button className="btn btn-ghost" onClick={handleReset} whileTap={{scale:0.95}}><Trash2 size={11}/></motion.button>
              </div>
            </motion.div>
          )}
        </div>

        {/* RIGHT */}
        <div style={{width:158,flexShrink:0,display:'flex',flexDirection:'column',gap:9,paddingTop:6}}>
          <p style={{fontSize:9,color:'var(--text-3)',fontWeight:700,textTransform:'uppercase',letterSpacing:'0.1em',textAlign:'center',marginBottom:2}}>FOCUS</p>
          {rightGames.map((g)=><GameCard key={g.id} game={g} onClick={()=>setActiveGame(g.id)}/>)}
        </div>
      </div>

      {/* Game sessions log */}
      {gameSessions.length>0&&(
        <motion.div initial={{opacity:0}} animate={{opacity:1}} style={{marginTop:18}}>
          <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:9}}>
            <span className="badge badge-cyan"><Star size={9}/> Activity Log</span>
            <span style={{fontSize:11,color:'var(--text-3)'}}>Each game feeds your clinical report</span>
          </div>
          <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(210px,1fr))',gap:9}}>
            {gameSessions.map((s,i)=>{
              const gameDef=GAME_DEFS.find((g)=>g.id===s.gameId);
              const eff=s.predictedEffects||{};
              return(
                <motion.div key={i} initial={{opacity:0,scale:0.95}} animate={{opacity:1,scale:1}} transition={{delay:i*0.05}}
                  style={{background:'rgba(255,255,255,0.022)',border:`1px solid ${gameDef?.color||'var(--border)'}1a`,borderRadius:15,padding:'12px 14px'}}>
                  <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:7}}>
                    <div style={{display:'flex',alignItems:'center',gap:7}}>
                      <span style={{fontSize:18}}>{gameDef?.emoji||'🎮'}</span>
                      <div>
                        <p style={{fontSize:11.5,fontWeight:700,color:'var(--text-1)',letterSpacing:'-0.01em'}}>{s.gameName}</p>
                        <p style={{fontSize:9.5,color:'var(--text-3)'}}>{s.durationSeconds}s · score {s.score}</p>
                      </div>
                    </div>
                    <span style={{fontSize:9,fontWeight:700,color:eff?.arousalLevel==='high'?'#ff6b8a':eff?.arousalLevel==='low'?'#00e676':'#ffb300',background:'rgba(255,255,255,0.04)',padding:'2px 7px',borderRadius:999,border:'1px solid rgba(255,255,255,0.07)',whiteSpace:'nowrap'}}>
                      {eff?.arousalLevel}
                    </span>
                  </div>
                  <div style={{display:'flex',gap:7,marginBottom:7}}>
                    {[{label:'Stress ↓',val:eff?.stressReduction,color:'#00e676'},{label:'Dopamine',val:eff?.dopamineActivation,color:'#c4b5fd'},{label:'Focus',val:eff?.focusScore,color:'#00e5ff'}].map(({label,val,color})=>(
                      <div key={label} style={{flex:1,textAlign:'center'}}>
                        <div style={{height:3,borderRadius:999,background:'rgba(255,255,255,0.06)',marginBottom:3}}>
                          <div style={{height:'100%',width:`${(val||0)*10}%`,background:color,borderRadius:999}}/>
                        </div>
                        <p style={{fontSize:8,color:'var(--text-3)',fontWeight:600}}>{label}</p>
                      </div>
                    ))}
                  </div>
                  <p style={{fontSize:9,color:'var(--text-3)',lineHeight:1.5,borderTop:'1px solid rgba(255,255,255,0.05)',paddingTop:6}}>
                    {eff?.clinicalNote?.slice(0,90)}…
                  </p>
                </motion.div>
              );
            })}
          </div>
        </motion.div>
      )}

      {/* Game modal */}
      <AnimatePresence>
        {activeGame&&ActiveGameComponent&&(
          <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}
            style={{position:'fixed',inset:0,zIndex:500,background:'rgba(2,9,21,0.93)',backdropFilter:'blur(24px)',display:'flex',alignItems:'center',justifyContent:'center',padding:24}}>
            <motion.div initial={{scale:0.9,y:20}} animate={{scale:1,y:0}} exit={{scale:0.88,opacity:0}}
              style={{width:'100%',maxWidth:500,height:500,background:'rgba(6,14,30,0.96)',border:`1px solid ${GAME_DEFS.find(g=>g.id===activeGame)?.color||'var(--border)'}28`,borderRadius:22,overflow:'hidden',display:'flex',flexDirection:'column',boxShadow:'0 32px 80px rgba(0,0,0,0.75)'}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'10px 16px 0',flexShrink:0}}>
                <div style={{display:'flex',alignItems:'center',gap:8}}>
                  <span style={{fontSize:20}}>{GAME_DEFS.find(g=>g.id===activeGame)?.emoji}</span>
                  <div>
                    <p style={{fontSize:13.5,fontWeight:800,color:'var(--text-1)',letterSpacing:'-0.02em'}}>{GAME_DEFS.find(g=>g.id===activeGame)?.name}</p>
                    <p style={{fontSize:9.5,color:'var(--text-3)'}}>Results feed your clinical report</p>
                  </div>
                </div>
                <button onClick={()=>setActiveGame(null)} style={{width:28,height:28,borderRadius:'50%',background:'rgba(255,255,255,0.05)',border:'1px solid var(--border)',display:'flex',alignItems:'center',justifyContent:'center',color:'var(--text-3)',cursor:'pointer'}}>
                  <X size={13}/>
                </button>
              </div>
              <div style={{flex:1,overflow:'hidden',display:'flex',flexDirection:'column'}}>
                <ActiveGameComponent onSessionEnd={handleGameSessionEnd}/>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Toast */}
      <AnimatePresence>
        {reportMsg&&(
          <motion.div initial={{opacity:0,y:20}} animate={{opacity:1,y:0}} exit={{opacity:0,y:20}}
            style={{position:'fixed',bottom:22,left:'50%',transform:'translateX(-50%)',zIndex:600,background:'rgba(6,14,30,0.96)',backdropFilter:'blur(20px)',border:'1px solid rgba(0,229,255,0.22)',borderRadius:13,padding:'10px 20px',fontSize:12.5,color:'#80deea',fontWeight:600,boxShadow:'0 8px 32px rgba(0,0,0,0.5)'}}>
            {reportMsg}
          </motion.div>
        )}
      </AnimatePresence>

      <style>{`@keyframes flameFlicker{0%{height:20px;opacity:0.62;transform:scaleX(0.78) skewX(-4deg);}50%{height:36px;opacity:1;transform:scaleX(1.12) skewX(3deg);}100%{height:17px;opacity:0.52;transform:scaleX(0.85) skewX(-6deg);}}`}</style>
    </div>
  );
}