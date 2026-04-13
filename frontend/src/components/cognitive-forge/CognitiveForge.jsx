// CognitiveForge.jsx — v5.0
// FIXES:
//  • Squeeze Release: complete SVG rewrite using stroke-dasharray gauge (reliable)
//    blob face rendered inside same SVG via foreignObject — no more misaligned overlay
//  • Color Sort: proper position:relative container + corrected drag/drop
//  • In-app Session Report panel with live computed behavioral health profile
//  • Larger modal with per-game dynamic sizing
//  • Higher contrast game backgrounds

import { useRef, useState, useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Wind, Sparkles, RotateCcw, Trash2, Zap, Trophy, Flame,
  Star, X, FileText, AlertTriangle, Activity, Brain, Heart,
  TrendingUp, TrendingDown, Minus, ChevronDown, ChevronUp,
} from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import confetti from 'canvas-confetti';
import Matter from 'matter-js';
import useStore from '../../store/useStore.js';
import { forgeApi } from '../../services/api.js';
import PerceptionProbe from '../PerceptionProbe.jsx';

const { Engine, Render, Runner, World, Bodies, Body, Composite, Events, Mouse, MouseConstraint } = Matter;

const PHYSICS_H = 440;
const MIN_W     = 280;
const MAX_W     = 760;

// ── Audio utils ──────────────────────────────────────────────────────────────
const playTone = (freq = 440, type = 'sine', dur = 0.18, gain = 0.12) => {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator(), g = ctx.createGain();
    osc.connect(g); g.connect(ctx.destination);
    osc.type = type; osc.frequency.setValueAtTime(freq, ctx.currentTime);
    g.gain.setValueAtTime(gain, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
    osc.start(); osc.stop(ctx.currentTime + dur);
    setTimeout(() => ctx.close(), dur * 1000 + 300);
  } catch (_) {}
};
const playSmash   = () => { playTone(150,'square',0.06,0.2); setTimeout(()=>playTone(80,'sine',0.25,0.1),50); };
const playCorrect = () => { playTone(659,'triangle',0.12,0.14); setTimeout(()=>playTone(784,'triangle',0.14,0.12),100); };
const playWrong   = () => playTone(200,'sawtooth',0.15,0.18);
const playClick   = () => playTone(440+Math.random()*120,'triangle',0.1,0.12);
const playRelease = (q) => { playTone(200+q*6,'sine',0.3,0.18); if(q>60)setTimeout(()=>playTone((200+q*6)*1.5,'triangle',0.2,0.1),120); };
const playSort    = (c) => playTone([523,659,784,880,1047,1175][c%6],'triangle',0.15,0.13);
const playBreathe = (isIn) => playTone(isIn?440:330,'sine',0.4,0.07);

// ── Telemetry engine ─────────────────────────────────────────────────────────
const derivePredictedEffects = (gameId, metrics) => {
  const { interactions, durationSeconds, avgReactionMs, accuracy, extraData = {} } = metrics;
  const ipm = interactions / Math.max(durationSeconds / 60, 0.1);
  const eff = { stressReduction:0, dopamineActivation:0, focusScore:0, arousalLevel:'moderate', clinicalNote:'' };
  switch (gameId) {
    case 'squeeze_release': {
      const avgQ = extraData.avgQuality || 50;
      eff.stressReduction    = Math.min(10, Math.round(interactions * 0.5 + 2));
      eff.dopamineActivation = Math.min(10, Math.round(avgQ * 0.07 + 2));
      eff.focusScore         = Math.min(10, Math.round(avgQ * 0.06 + 2));
      eff.arousalLevel       = avgQ < 40 ? 'high' : avgQ < 70 ? 'moderate' : 'low';
      eff.clinicalNote = `Squeeze Release: ${interactions} cycles, avg precision ${avgQ}%. `
        + (avgQ < 40 ? 'Difficulty regulating release timing — elevated tension; impulse control challenges present.'
          : avgQ > 70 ? 'Good timing control; cortical inhibition intact — low acute stress.'
          : 'Moderate tension management; some arousal regulation difficulty observed.');
      break;
    }
    case 'color_sort': {
      const mistakes = extraData.mistakes || 0;
      eff.stressReduction    = 4;
      eff.dopamineActivation = Math.min(10, Math.round(accuracy * 0.08 + 2));
      eff.focusScore         = Math.min(10, Math.round(accuracy * 0.09 + 1));
      eff.arousalLevel       = mistakes > 8 ? 'high' : mistakes > 3 ? 'moderate' : 'low';
      eff.clinicalNote = `Color Sort: ${interactions} balls sorted, ${mistakes} errors (${accuracy}% accuracy). `
        + (mistakes > 8 ? 'High error rate indicates impulsive sorting; possible executive dysfunction.'
          : mistakes < 3 ? 'High spatial accuracy; strong cognitive flexibility and working memory.'
          : 'Moderate performance; some cognitive fatigue or distractibility present.');
      break;
    }
    case 'word_smash': {
      eff.stressReduction    = Math.min(10, Math.round(interactions * 0.6 + 1));
      eff.dopamineActivation = Math.min(10, Math.round(interactions * 0.5 + 2));
      eff.focusScore         = 5; eff.arousalLevel = ipm > 25 ? 'high' : 'moderate';
      eff.clinicalNote = `Word Smash: ${interactions} negative words destroyed in ${durationSeconds}s. Cognitive reframing activity observed.`;
      break;
    }
    case 'memory_pulse': {
      const maxLevel = extraData.maxLevel || 1;
      eff.stressReduction    = 3;
      eff.dopamineActivation = Math.min(10, Math.round(maxLevel * 0.9 + 2));
      eff.focusScore         = Math.min(10, Math.round(accuracy * 0.09 + maxLevel * 0.3));
      eff.arousalLevel       = accuracy < 50 ? 'high' : accuracy < 75 ? 'moderate' : 'low';
      eff.clinicalNote = `Memory Pulse: reached level ${maxLevel}, ${accuracy}% accuracy. `
        + (maxLevel >= 6 ? 'Strong working memory — low ADHD impact.'
          : maxLevel >= 4 ? 'Moderate retention; some working memory challenges.'
          : 'Difficulty retaining sequences — significant working memory deficit; ADHD marker.');
      break;
    }
    case 'number_dash': {
      const bestTime = extraData.bestTime || durationSeconds;
      eff.stressReduction    = 4;
      eff.dopamineActivation = Math.min(10, Math.round(interactions * 0.4 + 3));
      eff.focusScore         = bestTime < 30 ? 9 : bestTime < 45 ? 7 : bestTime < 60 ? 5 : 3;
      eff.arousalLevel       = avgReactionMs < 600 ? 'high' : avgReactionMs < 1200 ? 'moderate' : 'low';
      eff.clinicalNote = `Number Dash (Schulte): best ${bestTime}s, avg tap ${avgReactionMs}ms. `
        + (bestTime < 30 ? 'Excellent visual scanning; strong directed attention.'
          : bestTime < 45 ? 'Good tracking with minor lapses.'
          : bestTime < 60 ? 'Moderate visual search; fatigue or distractibility present.'
          : 'Slow scanning — significant attention deficit; clinical follow-up recommended.');
      break;
    }
    case 'perception_probe': {
      eff.stressReduction    = 2;
      eff.dopamineActivation = 3;
      eff.focusScore         = accuracy === 100 ? 8 : 4;
      eff.arousalLevel       = accuracy === 100 ? 'low' : 'high';
      eff.clinicalNote = `Perception Probe: Latency ${avgReactionMs}ms. `
        + (accuracy === 100 ? 'Demonstrated cognitive flexibility; perspective switch achieved quickly.' : 'High cognitive rigidity detected; unable to switch perspective context (perceptual locking observed).');
      break;
    }
    default: eff.clinicalNote = `${gameId}: ${interactions} interactions in ${durationSeconds}s.`;
  }
  return eff;
};

// ── Compute behavioral health profile from all telemetry ─────────────────────
const computeHealthProfile = (gameSessions, worries, destroyedCount) => {
  if (gameSessions.length === 0 && worries.length === 0) return null;

  const getGame = (id) => gameSessions.find(g => g.gameId === id);
  const squeeze    = getGame('squeeze_release');
  const colorSort  = getGame('color_sort');
  const memory     = getGame('memory_pulse');
  const numDash    = getGame('number_dash');
  const perception = getGame('perception_probe');
  const wordSmash  = getGame('word_smash');

  // Stress Score (0-10, higher = more stress)
  const avgWorryWeight = worries.length
    ? worries.reduce((s,w) => s + (w.weight||5), 0) / worries.length : 5;
  const worryStress = (avgWorryWeight / 10) * 4;
  const squeezeStress = squeeze ? (100 - (squeeze.extraData?.avgQuality||50)) / 25 : 0;
  const perceptionRigid = perception ? (perception.accuracy === 100 ? 0 : 4) : 0;
  const wordStress    = wordSmash ? Math.min(2, wordSmash.score / 5) : 0;
  const stressScore   = Math.min(10, Math.round((worryStress + squeezeStress + perceptionRigid + wordStress) * 10) / 10);

  // ADHD Signal (0-10, higher = more ADHD indicators)
  const memLevel     = memory?.extraData?.maxLevel || 0;
  const numTime      = numDash?.extraData?.bestTime || 999;
  const colorErr     = colorSort?.extraData?.mistakes || 0;
  const adhdSignal   = Math.min(10, Math.round((
    (memLevel < 4 ? 3 : memLevel < 6 ? 1.5 : 0) +
    (numTime > 60 ? 3 : numTime > 45 ? 1.5 : 0) +
    (colorErr > 8 ? 2 : colorErr > 4 ? 1 : 0) +
    (worries.filter(w => w.weight >= 7).length > 3 ? 2 : 0)
  ) * 10) / 10);

  // Anxiety Level (0-10)
  const squeezeQ   = squeeze?.extraData?.avgQuality || 100;
  const rigidAnx   = perception ? (perception.accuracy === 100 ? 0 : 4) : 0;
  const anxietyLevel = Math.min(10, Math.round((
    ((100 - squeezeQ) / 20) +
    rigidAnx +
    (avgWorryWeight > 7 ? 2 : avgWorryWeight > 5 ? 1 : 0)
  ) * 10) / 10);

  // Focus Quality (0-10)
  const focusScore = Math.min(10, Math.round(
    gameSessions.length > 0
      ? gameSessions.reduce((s,g) => s + (g.predictedEffects?.focusScore||0), 0) / gameSessions.length
      : 5
  , 1));

  // Emotional Regulation (0-10, higher = better)
  const emotionalReg = Math.min(10, Math.round((
    (squeeze ? (squeeze.extraData?.avgQuality||50) / 20 : 2.5) +
    (perception ? (perception.accuracy === 100 ? 5 : 1) : 2.5)
  ) * 10) / 10);

  // Overall wellbeing (0-100)
  const wellbeing = Math.max(0, Math.min(100, Math.round(
    50 + (emotionalReg - anxietyLevel) * 4 + (focusScore - adhdSignal) * 2 + destroyedCount * 3
  )));

  // Risk level
  const riskLevel = stressScore > 7 || adhdSignal > 6 || anxietyLevel > 7
    ? 'acute-distress'
    : stressScore > 5 || adhdSignal > 4 || anxietyLevel > 5
    ? 'pre-burnout'
    : 'watch';

  // Clinical insights
  const insights = [];
  if (adhdSignal > 5) insights.push({ type:'adhd', text:'Working memory and attention patterns suggest ADHD-related executive challenges', severity:'warn' });
  if (anxietyLevel > 6) insights.push({ type:'anxiety', text:'High anxiety markers detected across breathing regulation and tension release', severity:'alert' });
  if (stressScore > 7) insights.push({ type:'stress', text:'Elevated stress load — cognitive and emotional resources appear depleted', severity:'alert' });
  if (emotionalReg > 7) insights.push({ type:'positive', text:'Strong emotional regulation capacity — good resilience markers present', severity:'good' });
  if (focusScore > 7) insights.push({ type:'focus', text:'Excellent sustained attention and visual scanning speed observed', severity:'good' });
  if (destroyedCount >= 3) insights.push({ type:'catharsis', text:`${destroyedCount} worry blocks incinerated — cathartic processing engaged`, severity:'good' });
  if (insights.length === 0) insights.push({ type:'neutral', text:'Complete more activities to generate a detailed health profile', severity:'neutral' });

  return { stressScore, adhdSignal, anxietyLevel, focusScore, emotionalReg, wellbeing, riskLevel, insights };
};

// ── GameShell ────────────────────────────────────────────────────────────────
function GameShell({ title, color, score, unit, onEnd, instruction, children }) {
  const [secs, setSecs] = useState(0);
  useEffect(() => { const t = setInterval(()=>setSecs(s=>s+1),1000); return()=>clearInterval(t); }, []);
  const m = Math.floor(secs/60), s = secs%60;
  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100%' }}>
      <div style={{ padding:'12px 16px 8px', flexShrink:0 }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
          <div>
            <p style={{ fontSize:13, fontWeight:800, color, letterSpacing:'-0.02em' }}>{title}</p>
            <p style={{ fontSize:9.5, color:'var(--text-3)', marginTop:2, lineHeight:1.35 }}>{instruction}</p>
          </div>
          <div style={{ textAlign:'right' }}>
            <p style={{ fontSize:22, fontWeight:900, color, letterSpacing:'-0.05em', lineHeight:1 }}>{score}</p>
            <p style={{ fontSize:8.5, color:'var(--text-3)', textTransform:'uppercase', letterSpacing:'0.08em' }}>{unit}</p>
          </div>
        </div>
      </div>
      <div style={{ flex:1, margin:'0 12px', borderRadius:14, overflow:'hidden', border:`1px solid ${color}25`, position:'relative' }}>
        {children}
      </div>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'8px 16px 12px' }}>
        <span style={{ fontSize:10, color:'var(--text-3)', fontFamily:'monospace' }}>
          {String(m).padStart(2,'0')}:{String(s).padStart(2,'0')}
        </span>
        <button onClick={onEnd}
          style={{ fontSize:11, padding:'5px 16px', borderRadius:999, background:`${color}12`, border:`1px solid ${color}30`, color, fontWeight:700, cursor:'pointer', letterSpacing:'-0.01em' }}>
          End + Log
        </button>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════════
// GAME 1 — SQUEEZE RELEASE  v6 — Pure CSS tension bar (zero SVG math)
//
// Layout (top→bottom inside game canvas):
//   ① Horizontal tension meter bar  — always visible, fills left→right
//      └─ Grey track + coloured fill + green "sweet zone" overlay
//   ② Large centered blob emoji     — scales 1× → 1.5× while holding
//   ③ Feedback / instruction text   — below the blob
//
// Clinical: arousal regulation, impulse control, tension timing
// ════════════════════════════════════════════════════════════════════════════════
function SqueezeRelease({ onSessionEnd }) {
  const [pressure,  setPressure]  = useState(0);
  const [holding,   setHolding]   = useState(false);
  const [score,     setScore]     = useState(0);
  const [feedback,  setFeedback]  = useState(null);   // { text, color }
  const [qualities, setQualities] = useState([]);
  const [rings,     setRings]     = useState([]);
  const startRef  = useRef(Date.now());
  const holdRef   = useRef(null);
  const ringIdRef = useRef(0);

  // Build pressure while holding (0 → 100 in ~1.7s at max)
  useEffect(() => {
    if (!holding) return;
    holdRef.current = setInterval(() => setPressure(p => Math.min(100, p + 1.8)), 30);
    return () => clearInterval(holdRef.current);
  }, [holding]);

  const handleRelease = useCallback(() => {
    if (!holding) return;
    setHolding(false);
    clearInterval(holdRef.current);
    const p = pressure;
    setPressure(0);

    let quality, text, color;
    if      (p < 20)       { quality = 10;  text = 'Too light…';      color = '#4a6275'; }
    else if (p < 45)       { quality = 42;  text = 'Getting there';   color = '#ffb300'; }
    else if (p <= 80)      { quality = 96;  text = '🔥 Perfect!';     color = '#00e676'; }
    else if (p < 95)       { quality = 68;  text = 'Strong release!'; color = '#c4b5fd'; }
    else                   { quality = 22;  text = 'Over-tensed!';    color = '#ff6b8a'; }

    playRelease(quality);
    setScore(s => s + Math.round(quality / 10));
    setQualities(prev => [...prev, quality]);
    setFeedback({ text, color });
    setTimeout(() => setFeedback(null), 1600);

    // Ripple rings
    const id = ringIdRef.current++;
    setRings(prev => [...prev, { id, color }]);
    setTimeout(() => setRings(prev => prev.filter(r => r.id !== id)), 900);

    if (quality > 80) {
      confetti({ particleCount:22, spread:55, origin:{x:0.5,y:0.6},
        colors:['#00e676','#ffb300','#c4b5fd'], ticks:60, gravity:0.8, scalar:0.75 });
    }
  }, [holding, pressure]);

  const handleEnd = () => {
    const dur  = Math.round((Date.now() - startRef.current) / 1000);
    const avgQ = qualities.length ? Math.round(qualities.reduce((a,b)=>a+b,0) / qualities.length) : 0;
    onSessionEnd({ gameId:'squeeze_release', gameName:'Squeeze Release',
      durationSeconds:dur, interactions:score, avgReactionMs:600, accuracy:avgQ, score,
      extraData:{ avgQuality:avgQ } });
  };

  // ── Derived display values (pure arithmetic, no trig) ──────────────────
  const pct          = pressure;                   // 0–100
  const inSweet      = pct >= 45 && pct <= 80;
  const fillColor    = pct < 20  ? '#4a6275'
                     : pct < 45  ? '#ffb300'
                     : pct <= 80 ? '#00e676'
                     : pct < 95  ? '#c4b5fd'
                     : '#ff6b8a';
  const blobScale    = 1 + pct * 0.006;
  const blobFace     = holding
    ? (pct > 80 ? '🤯' : pct > 60 ? '😤' : pct > 35 ? '😬' : '😶')
    : score === 0 ? '😮‍💨' : '😌';
  const blobGlow     = `0 0 ${20 + pct * 0.7}px ${fillColor}80, 0 0 ${50 + pct}px ${fillColor}22`;

  return (
    <GameShell title="Squeeze Release" color="#ff6b8a" score={score} unit="pts" onEnd={handleEnd}
      instruction="Hold anywhere · release inside the green zone">
      {/* Outer container: catches all pointer events */}
      <div
        onMouseDown={() => setHolding(true)}
        onMouseUp={handleRelease}
        onMouseLeave={handleRelease}
        onTouchStart={e => { e.preventDefault(); setHolding(true); }}
        onTouchEnd={e   => { e.preventDefault(); handleRelease(); }}
        style={{
          width:'100%', height:'100%',
          cursor: holding ? 'grabbing' : 'grab',
          background: `radial-gradient(ellipse at 50% 60%, ${fillColor}12, transparent 65%), #0d0208`,
          display:'flex', flexDirection:'column',
          alignItems:'center', justifyContent:'space-between',
          userSelect:'none', WebkitUserSelect:'none',
          position:'relative', overflow:'hidden',
          padding:'22px 20px 16px',
          transition:'background 0.3s',
        }}
      >
        {/* ── ① TENSION METER BAR ─────────────────────────────────────── */}
        <div style={{ width:'100%', flexShrink:0 }}>

          {/* Labels row */}
          <div style={{ display:'flex', justifyContent:'space-between', marginBottom:6 }}>
            <span style={{ fontSize:10, color:'rgba(255,255,255,0.2)', fontWeight:600 }}>EMPTY</span>
            <span style={{ fontSize:10, fontWeight:800, color:'rgba(0,230,118,0.85)', letterSpacing:'0.06em' }}>
              ↑ SWEET ZONE (45–80%)
            </span>
            <span style={{ fontSize:10, color:'rgba(255,255,255,0.2)', fontWeight:600 }}>MAX</span>
          </div>

          {/* Bar track */}
          <div style={{
            width:'100%', height:22, borderRadius:11,
            background:'rgba(255,255,255,0.05)',
            border:'1px solid rgba(255,255,255,0.08)',
            position:'relative', overflow:'hidden',
          }}>
            {/* Sweet zone overlay */}
            <div style={{
              position:'absolute', top:0, bottom:0,
              left:'45%', width:'35%',                    /* 45–80% of bar */
              background:'rgba(0,230,118,0.15)',
              borderLeft:'2px solid rgba(0,230,118,0.5)',
              borderRight:'2px solid rgba(0,230,118,0.5)',
              pointerEvents:'none',
            }} />

            {/* Pressure fill */}
            <motion.div
              animate={{ width:`${pct}%` }}
              transition={{ duration:0.04 }}
              style={{
                position:'absolute', top:0, left:0, bottom:0,
                background: pct < 45
                  ? `linear-gradient(90deg, #4a6275, ${fillColor})`
                  : pct <= 80
                  ? `linear-gradient(90deg, #4a6275 20%, #ffb300 44%, #00e676)`
                  : `linear-gradient(90deg, #4a6275 20%, #ffb300 44%, #00e676 78%, ${fillColor})`,
                borderRadius:10,
                boxShadow: pct > 20 ? `0 0 12px ${fillColor}80` : 'none',
                transition:'background 0.2s',
              }}
            />

            {/* Percentage label inside bar */}
            {pct > 8 && (
              <div style={{
                position:'absolute', top:0, left:0, right:0, bottom:0,
                display:'flex', alignItems:'center',
                paddingLeft: Math.min(pct, 85) + '%',
                pointerEvents:'none',
              }}>
                <span style={{ fontSize:10, fontWeight:800, color:'rgba(255,255,255,0.9)', marginLeft:4, whiteSpace:'nowrap' }}>
                  {Math.round(pct)}%
                </span>
              </div>
            )}
          </div>

          {/* Tick marks under bar */}
          <div style={{ display:'flex', justifyContent:'space-between', marginTop:4, paddingLeft:'1%', paddingRight:'1%' }}>
            {[0,25,50,75,100].map(t => (
              <span key={t} style={{ fontSize:8.5, color:'rgba(255,255,255,0.15)', fontWeight:600 }}>{t}</span>
            ))}
          </div>
        </div>

        {/* ── ② BLOB ──────────────────────────────────────────────────── */}
        <div style={{ position:'relative', display:'flex', alignItems:'center', justifyContent:'center', flex:1 }}>
          {/* Ripple rings (absolutely positioned, centred on blob) */}
          {rings.map(ring => (
            <motion.div key={ring.id}
              initial={{ width:60, height:60, opacity:0.85 }}
              animate={{ width:240, height:240, opacity:0 }}
              transition={{ duration:0.85, ease:'easeOut' }}
              style={{
                position:'absolute',
                borderRadius:'50%',
                border:`2px solid ${ring.color}`,
                pointerEvents:'none',
              }}
            />
          ))}

          <motion.div
            animate={{
              scale:     blobScale,
              boxShadow: holding ? blobGlow : `0 0 20px ${fillColor}30`,
            }}
            transition={{ duration:0.05 }}
            style={{
              width:80, height:80, borderRadius:'50%',
              background:`radial-gradient(circle at 38% 36%, ${fillColor}dd, ${fillColor}55)`,
              border:`2.5px solid ${fillColor}99`,
              display:'flex', alignItems:'center', justifyContent:'center',
              fontSize:34, lineHeight:1,
              transition:'background 0.2s, border-color 0.2s',
              zIndex:2,
            }}
          >
            {blobFace}
          </motion.div>

          {/* In-sweet-zone glow ring */}
          {inSweet && (
            <motion.div
              initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }}
              style={{
                position:'absolute', width:110, height:110, borderRadius:'50%',
                border:'2px dashed rgba(0,230,118,0.55)',
                boxShadow:'0 0 20px rgba(0,230,118,0.2)',
                pointerEvents:'none',
                animation:'sweetPulse 1s ease-in-out infinite',
              }}
            />
          )}
        </div>

        {/* ── ③ FEEDBACK / INSTRUCTION ─────────────────────────────────── */}
        <div style={{ flexShrink:0, height:36, display:'flex', alignItems:'center', justifyContent:'center' }}>
          <AnimatePresence mode="wait">
            {feedback ? (
              <motion.p key="fb"
                initial={{ opacity:0, y:6, scale:0.9 }}
                animate={{ opacity:1, y:0, scale:1 }}
                exit={{ opacity:0, y:-8 }}
                style={{ fontSize:15, fontWeight:800, color:feedback.color,
                  textShadow:`0 0 18px ${feedback.color}88`, letterSpacing:'-0.02em' }}>
                {feedback.text}
              </motion.p>
            ) : (
              <motion.p key="hint"
                initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }}
                style={{ fontSize:11, color:`rgba(255,107,138,${score === 0 ? '0.55' : '0.3'})`, fontWeight:600, textAlign:'center' }}>
                {holding
                  ? (inSweet ? '✓ In sweet zone — release now!' : pct < 45 ? 'Keep holding…' : 'Ease off slightly')
                  : score === 0 ? 'Press & hold anywhere → release in the green zone'
                  : `${score} pts · hold again`}
              </motion.p>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* CSS for sweet-zone pulse animation */}
      <style>{`
        @keyframes sweetPulse {
          0%,100% { transform:scale(1); opacity:0.55; }
          50%      { transform:scale(1.06); opacity:0.9; }
        }
      `}</style>
    </GameShell>
  );
}

// ════════════════════════════════════════════════════════════════════════════════
// GAME 2 — COLOR SORT (Fixed drag-and-drop)
// ════════════════════════════════════════════════════════════════════════════════
const SORT_COLORS = [
  { id:'red',    hex:'#ff6b8a', dark:'rgba(127,29,29,0.7)' },
  { id:'blue',   hex:'#00e5ff', dark:'rgba(14,74,110,0.7)' },
  { id:'purple', hex:'#c4b5fd', dark:'rgba(59,7,100,0.7)'  },
  { id:'green',  hex:'#00e676', dark:'rgba(6,78,59,0.7)'   },
];

function ColorSort({ onSessionEnd }) {
  const [queue,    setQueue]    = useState(() => Array.from({length:14},()=>SORT_COLORS[Math.floor(Math.random()*4)]));
  const [tubes,    setTubes]    = useState([0,0,0,0]);
  const [correct,  setCorrect]  = useState(0);
  const [mistakes, setMistakes] = useState(0);
  const [lastDrop, setLastDrop] = useState(null);
  const [dragging, setDragging] = useState(false);
  const [dragPos,  setDragPos]  = useState({x:0,y:0});
  const containerRef = useRef(null);
  const tubeRefs     = useRef([null,null,null,null]);
  const startRef     = useRef(Date.now());
  const currentBall  = queue[0] || null;

  const getEventPos = (e) => {
    const src = e.touches?.[0] || e.changedTouches?.[0] || e;
    return { x: src.clientX, y: src.clientY };
  };

  const startDrag = (e) => {
    e.preventDefault();
    if (!currentBall) return;
    setDragging(true);
    setDragPos(getEventPos(e));
  };

  const moveDrag = (e) => {
    if (!dragging) return;
    e.preventDefault();
    setDragPos(getEventPos(e));
  };

  const endDrag = (e) => {
    if (!dragging || !currentBall) { setDragging(false); return; }
    const pos = getEventPos(e);
    let droppedTube = null;
    tubeRefs.current.forEach((ref, idx) => {
      if (!ref) return;
      const rect = ref.getBoundingClientRect();
      if (pos.x >= rect.left && pos.x <= rect.right && pos.y >= rect.top - 30 && pos.y <= rect.bottom) {
        droppedTube = idx;
      }
    });
    setDragging(false);
    if (droppedTube !== null) {
      if (SORT_COLORS[droppedTube].id === currentBall.id) {
        playSort(droppedTube);
        setCorrect(c => c + 1);
        setTubes(prev => { const n=[...prev]; n[droppedTube] = Math.min(n[droppedTube]+1,5); return n; });
        setLastDrop({ tubeIdx:droppedTube, ok:true });
        setQueue(prev => {
          const next = prev.slice(1);
          return next.length === 0 ? Array.from({length:14},()=>SORT_COLORS[Math.floor(Math.random()*4)]) : next;
        });
      } else {
        playWrong();
        setMistakes(m => m + 1);
        setLastDrop({ tubeIdx:droppedTube, ok:false });
        setQueue(prev => [...prev.slice(1), prev[0]]);
      }
      setTimeout(() => setLastDrop(null), 500);
    }
  };

  const accuracy = correct+mistakes > 0 ? Math.round(correct/(correct+mistakes)*100) : 100;
  const handleEnd = () => {
    const dur = Math.round((Date.now()-startRef.current)/1000);
    onSessionEnd({ gameId:'color_sort', gameName:'Color Sort', durationSeconds:dur, interactions:correct+mistakes, avgReactionMs:800, accuracy, score:correct, extraData:{ mistakes } });
  };

  const containerRect = containerRef.current?.getBoundingClientRect();

  return (
    <GameShell title="Color Sort" color="#00e5ff" score={correct} unit="sorted" onEnd={handleEnd}
      instruction="Drag each ball to its matching colour tube">
      <div
        ref={containerRef}
        onMouseMove={moveDrag} onMouseUp={endDrag}
        onTouchMove={moveDrag} onTouchEnd={endDrag}
        style={{ width:'100%', height:'100%', position:'relative',
          background:'radial-gradient(ellipse at 50% 20%, rgba(0,229,255,0.09), transparent 60%), #020c14',
          userSelect:'none', WebkitUserSelect:'none', borderRadius:14,
        }}
      >
        {/* Stats */}
        <div style={{ position:'absolute', top:10, right:12, fontSize:10, color:'rgba(0,229,255,0.5)', fontWeight:700, textAlign:'right' }}>
          <div>{accuracy}% acc</div>
          <div style={{ color:'#ff6b8a' }}>{mistakes} err</div>
        </div>

        {/* Queue preview */}
        {queue.length > 1 && (
          <div style={{ position:'absolute', top:12, left:12, display:'flex', gap:5, alignItems:'center' }}>
            <span style={{ fontSize:9.5, color:'var(--text-3)' }}>next:</span>
            {queue.slice(1,5).map((b,i) => (
              <div key={i} style={{ width:10+4*(3-i), height:10+4*(3-i), borderRadius:'50%', background:b.hex, opacity:0.5-i*0.08, boxShadow:`0 0 5px ${b.hex}40` }} />
            ))}
          </div>
        )}

        {/* Floating draggable ball */}
        {currentBall && !dragging && (
          <motion.div
            onMouseDown={startDrag} onTouchStart={startDrag}
            animate={{ y:[0,-8,0] }} transition={{ repeat:Infinity, duration:1.4, ease:'easeInOut' }}
            style={{
              position:'absolute', top:'38%', left:'50%', transform:'translate(-50%,-50%)',
              width:50, height:50, borderRadius:'50%', cursor:'grab',
              background:`radial-gradient(circle at 35% 32%, ${currentBall.hex}ee, ${currentBall.hex}66)`,
              boxShadow:`0 0 22px ${currentBall.hex}70, 0 6px 18px rgba(0,0,0,0.5)`,
              border:`2px solid ${currentBall.hex}bb`,
            }}
          />
        )}

        {/* Dragging ghost ball — follows cursor absolutely on page */}
        {dragging && currentBall && (
          <div style={{
            position:'fixed',
            left: dragPos.x - 25,
            top:  dragPos.y - 25,
            width:50, height:50, borderRadius:'50%',
            background:`radial-gradient(circle at 35% 32%, ${currentBall.hex}ee, ${currentBall.hex}66)`,
            boxShadow:`0 0 28px ${currentBall.hex}90`,
            border:`2px solid ${currentBall.hex}cc`,
            pointerEvents:'none', zIndex:9999,
          }} />
        )}

        {/* Tubes at bottom */}
        <div style={{ position:'absolute', bottom:0, left:0, right:0, display:'flex', justifyContent:'space-around', padding:'0 16px 10px', alignItems:'flex-end' }}>
          {SORT_COLORS.map((col, idx) => {
            const fill  = tubes[idx];
            const flash = lastDrop?.tubeIdx === idx;
            const isOk  = flash && lastDrop.ok;
            return (
              <div key={col.id} ref={el => tubeRefs.current[idx] = el}
                style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:4 }}>
                {/* Fill count dots */}
                <div style={{ display:'flex', flexDirection:'column-reverse', gap:2, height:60, justifyContent:'flex-start' }}>
                  {Array.from({length:5},(_,i) => (
                    <motion.div key={i}
                      animate={{ scale: i < fill ? 1 : 0.3, opacity: i < fill ? 1 : 0.12 }}
                      transition={{ type:'spring', stiffness:200, damping:14 }}
                      style={{ width:10, height:10, borderRadius:'50%', background:col.hex, boxShadow:i<fill?`0 0 6px ${col.hex}`:'' }}
                    />
                  ))}
                </div>
                {/* Tube vessel */}
                <div style={{
                  width:44, height:64, borderRadius:'0 0 14px 14px',
                  border:`2px solid ${col.hex}${flash?'ff':'50'}`,
                  borderTop:'none',
                  background: flash ? (isOk?`${col.hex}28`:'rgba(255,107,138,0.2)') : col.dark,
                  boxShadow: flash ? `0 0 20px ${isOk?col.hex:'#ff6b8a'}80, inset 0 0 10px ${isOk?col.hex:'#ff6b8a'}18` : `inset 0 0 8px rgba(0,0,0,0.5)`,
                  transition:'all 0.2s',
                  overflow:'hidden', position:'relative',
                }}>
                  {flash && (
                    <motion.div initial={{ opacity:1 }} animate={{ opacity:0 }} transition={{ duration:0.4 }}
                      style={{ position:'absolute', inset:0, background:isOk?`${col.hex}40`:'rgba(255,107,138,0.3)' }} />
                  )}
                </div>
                {/* Colour dot label */}
                <div style={{ width:9, height:9, borderRadius:'50%', background:col.hex, boxShadow:`0 0 7px ${col.hex}` }} />
              </div>
            );
          })}
        </div>
      </div>
    </GameShell>
  );
}

// ════════════════════════════════════════════════════════════════════════════════
// GAME 3 — WORD SMASH (unchanged)
// ════════════════════════════════════════════════════════════════════════════════
const NEG_WORDS = ['STRESS','WORRY','FEAR','DOUBT','PANIC','DREAD','FAIL','STUCK','LOST','NUMB','TIRED','SHAME'];
const POS_WORDS = ['FREE','BRAVE','PEACE','STRONG','RISE','CALM','BRIGHT','ALIVE','SAFE'];

function WordSmash({ onSessionEnd }) {
  const [words, setWords] = useState(() => Array.from({length:6},(_,i)=>({
    id:i, word:NEG_WORDS[i%NEG_WORDS.length], x:8+(i*14)%78, y:90+i*14,
    speed:0.35+Math.random()*0.3, smashed:false, rotation:(Math.random()-0.5)*20, repl:null, replTimer:0,
  })));
  const [score, setScore] = useState(0);
  const startRef = useRef(Date.now()), rafRef = useRef(null);
  useEffect(() => {
    const tick = () => {
      setWords(prev => prev.map(w => {
        if (w.smashed) { if(w.replTimer>0)return{...w,replTimer:w.replTimer-1}; return{...w,smashed:false,repl:null,word:NEG_WORDS[Math.floor(Math.random()*NEG_WORDS.length)],y:108,x:8+Math.random()*78}; }
        const ny=w.y-w.speed; if(ny<-12)return{...w,y:108,x:8+Math.random()*78}; return{...w,y:ny};
      }));
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, []);
  const smashWord = id => { playSmash(); setScore(s=>s+1); setWords(prev=>prev.map(w=>w.id===id?{...w,smashed:true,repl:POS_WORDS[Math.floor(Math.random()*POS_WORDS.length)],replTimer:55}:w)); };
  return (
    <GameShell title="Word Smash" color="#ff6b8a" score={score} unit="crushed" onEnd={() => onSessionEnd({ gameId:'word_smash', gameName:'Word Smash', durationSeconds:Math.round((Date.now()-startRef.current)/1000), interactions:score, avgReactionMs:700, accuracy:100, score })}
      instruction="Smash the negative words before they escape!">
      <div style={{ position:'relative', width:'100%', height:'100%', overflow:'hidden', background:'radial-gradient(ellipse at 50% 60%, rgba(255,107,138,0.08), transparent 65%), #0a0310', borderRadius:14 }}>
        {words.map(w => (
          <motion.div key={w.id} style={{ position:'absolute', left:`${w.x}%`, top:`${w.y}%`, transform:`translate(-50%,-50%) rotate(${w.rotation}deg)` }}>
            {w.smashed ? (
              <motion.div initial={{opacity:1,scale:1}} animate={{opacity:0,scale:2.2,y:-30}} transition={{duration:0.8}}
                style={{fontSize:13,fontWeight:900,color:'#00e676',letterSpacing:'0.15em',whiteSpace:'nowrap',textShadow:'0 0 12px rgba(0,230,118,0.7)'}}>
                {w.repl}
              </motion.div>
            ) : (
              <motion.div whileHover={{scale:1.15}} whileTap={{scale:0.7}} onClick={()=>smashWord(w.id)}
                style={{fontSize:13,fontWeight:900,color:'#ff6b8a',cursor:'pointer',padding:'5px 10px',background:'rgba(255,107,138,0.09)',border:'1px solid rgba(255,107,138,0.28)',borderRadius:8,whiteSpace:'nowrap',textShadow:'0 0 8px rgba(255,107,138,0.5)',userSelect:'none'}}>
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
// ════════════════════════════════════════════════════════════════════════════════
const GRID_COLORS = ['#00e5ff','#ff6b8a','#c4b5fd','#ffb300','#00e676','#5eead4','#fb7185','#a78bfa','#fbbf24'];

function MemoryPulse({ onSessionEnd }) {
  const [phase,    setPhase]    = useState('waiting');
  const [level,    setLevel]    = useState(1);
  const [sequence, setSequence] = useState([]);
  const [showing,  setShowing]  = useState(-1);
  const [input,    setInput]    = useState([]);
  const [flashed,  setFlashed]  = useState(null);
  const [score,    setScore]    = useState(0);
  const [maxLevel, setMaxLevel] = useState(1);
  const [attempts, setAttempts] = useState({c:0,w:0});
  const startRef = useRef(Date.now());

  const showSequence = useCallback((seq, lvl) => {
    setPhase('showing'); setInput([]);
    const speed = Math.max(380, 900 - lvl * 55);
    let i = 0;
    const tick = () => {
      if (i < seq.length) {
        setShowing(seq[i]);
        playTone(300 + seq[i]*50,'triangle',speed/1000*0.7,0.12);
        setTimeout(() => { setShowing(-1); i++; setTimeout(tick, speed*0.28); }, speed*0.72);
      } else { setShowing(-1); setPhase('input'); }
    };
    setTimeout(tick, 600);
  }, []);

  const startLevel = useCallback((lvl) => {
    const seq = Array.from({length:lvl+2},()=>Math.floor(Math.random()*9));
    setSequence(seq);
    showSequence(seq, lvl);
  }, [showSequence]);

  const handleCellClick = (idx) => {
    if (phase !== 'input') return;
    playTone(300+idx*50,'triangle',0.1,0.12);
    setFlashed(idx); setTimeout(()=>setFlashed(null),220);
    const newInput = [...input, idx];
    if (idx !== sequence[newInput.length-1]) {
      playWrong();
      setAttempts(p=>({c:p.c,w:p.w+1}));
      setPhase('wrong');
      setTimeout(() => { setInput([]); showSequence(sequence, level); }, 900);
      return;
    }
    if (newInput.length === sequence.length) {
      playCorrect();
      setAttempts(p=>({c:p.c+1,w:p.w}));
      setScore(s=>s+level*5);
      const nl = level+1;
      setLevel(nl); setMaxLevel(m=>Math.max(m,nl));
      setPhase('correct');
      setTimeout(()=>startLevel(nl), 800);
    } else { setInput(newInput); }
  };

  const accuracy = attempts.c+attempts.w > 0 ? Math.round(attempts.c/(attempts.c+attempts.w)*100) : 100;
  return (
    <GameShell title="Memory Pulse" color="#c4b5fd" score={score} unit="pts" onEnd={()=>{ const dur=Math.round((Date.now()-startRef.current)/1000); onSessionEnd({gameId:'memory_pulse',gameName:'Memory Pulse',durationSeconds:dur,interactions:attempts.c+attempts.w,avgReactionMs:700,accuracy,score,extraData:{maxLevel}}); }}
      instruction={phase==='input'?'Your turn — repeat the sequence!':'Watch the flashing pattern…'}>
      <div style={{ width:'100%', height:'100%', background:'radial-gradient(ellipse at 50% 40%, rgba(196,181,253,0.1), transparent 65%), #060212', borderRadius:14, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:14 }}>
        {phase === 'waiting' ? (
          <div style={{textAlign:'center'}}>
            <div style={{fontSize:38,marginBottom:12}}>🧠</div>
            <p style={{fontSize:12,color:'rgba(196,181,253,0.7)',fontWeight:600,marginBottom:16}}>Watch the flash pattern · repeat in order</p>
            <button onClick={()=>startLevel(1)} style={{padding:'9px 24px',borderRadius:999,background:'rgba(196,181,253,0.12)',border:'1px solid rgba(196,181,253,0.35)',color:'#c4b5fd',fontWeight:700,fontSize:13,cursor:'pointer'}}>Start</button>
          </div>
        ) : (
          <>
            <div style={{display:'flex',gap:16,alignItems:'center'}}>
              <span style={{fontSize:11,color:'rgba(196,181,253,0.6)',fontWeight:700}}>LVL {level}</span>
              <span style={{fontSize:11,color:phase==='input'?'#c4b5fd':phase==='correct'?'#00e676':phase==='wrong'?'#ff6b8a':'rgba(196,181,253,0.4)',fontWeight:700}}>
                {phase==='input'?`${input.length}/${sequence.length}`:phase==='correct'?'✓ CORRECT!':phase==='wrong'?'✗ RETRY':'Watching…'}
              </span>
              <span style={{fontSize:10,color:'rgba(196,181,253,0.5)'}}>{accuracy}%</span>
            </div>
            <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:8}}>
              {Array.from({length:9},(_,idx)=>{
                const isLit=showing===idx, isFlashed=flashed===idx;
                return (
                  <motion.div key={idx} onClick={()=>handleCellClick(idx)}
                    animate={{ scale:isLit||isFlashed?1.1:1, boxShadow:isLit?`0 0 24px ${GRID_COLORS[idx]}cc`:isFlashed?`0 0 16px ${GRID_COLORS[idx]}88`:`0 0 4px ${GRID_COLORS[idx]}22` }}
                    transition={{duration:0.1}}
                    style={{ width:58,height:58,borderRadius:14,background:isLit||isFlashed?GRID_COLORS[idx]:`${GRID_COLORS[idx]}18`,border:`2.5px solid ${GRID_COLORS[idx]}${isLit||isFlashed?'ff':'40'}`,cursor:phase==='input'?'pointer':'default',transition:'background 0.1s' }}
                  />
                );
              })}
            </div>
            <div style={{display:'flex',gap:6}}>
              {sequence.map((_,i)=><div key={i} style={{width:8,height:8,borderRadius:'50%',background:i<input.length?'#c4b5fd':'rgba(196,181,253,0.18)',boxShadow:i<input.length?'0 0 7px #c4b5fd':'none',transition:'all 0.15s'}}/>)}
            </div>
          </>
        )}
      </div>
    </GameShell>
  );
}

// ════════════════════════════════════════════════════════════════════════════════
// GAME 5 — NUMBER DASH (Schulte Table)
// ════════════════════════════════════════════════════════════════════════════════
function NumberDash({ onSessionEnd }) {
  const [phase,     setPhase]     = useState('waiting');
  const [grid,      setGrid]      = useState([]);
  const [next,      setNext]      = useState(1);
  const [startTime, setStartTime] = useState(null);
  const [elapsed,   setElapsed]   = useState(0);
  const [flashCell, setFlashCell] = useState(null);
  const [flashOk,   setFlashOk]   = useState(true);
  const [attempts,  setAttempts]  = useState([]);
  const [mistakes,  setMistakes]  = useState(0);
  const rafRef = useRef(null), startRef = useRef(Date.now());
  const buildGrid = () => { const n=Array.from({length:16},(_,i)=>i+1); for(let i=n.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[n[i],n[j]]=[n[j],n[i]];} return n; };
  useEffect(() => {
    if (phase!=='running') return;
    const tick=()=>{ setElapsed(Math.round((Date.now()-startTime)/100)/10); rafRef.current=requestAnimationFrame(tick); };
    rafRef.current=requestAnimationFrame(tick);
    return()=>cancelAnimationFrame(rafRef.current);
  }, [phase,startTime]);
  const startRound=()=>{ setGrid(buildGrid()); setNext(1); setElapsed(0); const now=Date.now(); setStartTime(now); setPhase('running'); };
  const handleCell=(num)=>{
    if(phase!=='running')return;
    if(num===next){
      playClick(); setFlashCell(num); setFlashOk(true); setTimeout(()=>setFlashCell(null),250);
      if(next+1>16){ cancelAnimationFrame(rafRef.current); const rt=Math.round((Date.now()-startTime)/100)/10; setElapsed(rt); setAttempts(p=>[...p,rt]); setPhase('done'); }
      else setNext(n=>n+1);
    } else { playWrong(); setFlashCell(num); setFlashOk(false); setMistakes(m=>m+1); setTimeout(()=>setFlashCell(null),300); }
  };
  const bestTime = attempts.length?Math.min(...attempts):null;
  return (
    <GameShell title="Number Dash" color="#ffb300" score={attempts.length} unit="rounds" onEnd={()=>{ const dur=Math.round((Date.now()-startRef.current)/1000); const bt=bestTime||dur; onSessionEnd({gameId:'number_dash',gameName:'Number Dash',durationSeconds:dur,interactions:attempts.length*16+next-1,avgReactionMs:bt?Math.round((bt/16)*1000):1000,accuracy:100,score:attempts.length,extraData:{bestTime:bt,avgTime:attempts.length?Math.round(attempts.reduce((a,b)=>a+b,0)/attempts.length*10)/10:null}}); }}
      instruction="Click 1 → 16 in order, as fast as possible">
      <div style={{width:'100%',height:'100%',background:'radial-gradient(ellipse at 50% 30%, rgba(255,179,0,0.1), transparent 60%), #080500',borderRadius:14,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:10,padding:'8px 0'}}>
        {phase==='waiting'||phase==='done'?(
          <div style={{textAlign:'center'}}>
            {phase==='done'&&<div style={{marginBottom:12}}><p style={{fontSize:22,fontWeight:900,color:'#ffb300'}}>{elapsed}s</p>{bestTime&&<p style={{fontSize:10,color:'rgba(255,179,0,0.55)'}}>best: {bestTime}s</p>}</div>}
            {phase==='waiting'&&<div style={{fontSize:36,marginBottom:12}}>🔢</div>}
            <p style={{fontSize:11,color:'rgba(255,179,0,0.6)',fontWeight:600,marginBottom:14}}>{phase==='waiting'?'Find & click 1→16 in order, fastest time wins':'Round complete!'}</p>
            <button onClick={startRound} style={{padding:'8px 22px',borderRadius:999,background:'rgba(255,179,0,0.12)',border:'1px solid rgba(255,179,0,0.35)',color:'#ffb300',fontWeight:700,fontSize:13,cursor:'pointer'}}>{phase==='done'?'Again →':'Start'}</button>
          </div>
        ):(
          <>
            <div style={{display:'flex',gap:16,alignItems:'center'}}>
              <span style={{fontSize:10,color:'rgba(255,179,0,0.5)',fontFamily:'monospace'}}>{elapsed}s</span>
              <div style={{display:'flex',alignItems:'center',gap:6}}>
                <span style={{fontSize:11,color:'rgba(255,179,0,0.5)',fontWeight:600}}>find:</span>
                <motion.span key={next} initial={{scale:1.5,opacity:0}} animate={{scale:1,opacity:1}} style={{fontSize:22,fontWeight:900,color:'#ffb300',lineHeight:1}}>{next}</motion.span>
              </div>
              <span style={{fontSize:10,color:'rgba(255,107,138,0.5)'}}>{mistakes} err</span>
            </div>
            <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:5,padding:'0 10px'}}>
              {grid.map(num=>{
                const isPast=num<next,isNext=num===next,isFlash=flashCell===num;
                return(
                  <motion.div key={num} onClick={()=>handleCell(num)} animate={{scale:isFlash?1.12:1}} transition={{duration:0.1}}
                    style={{width:50,height:50,borderRadius:11,display:'flex',alignItems:'center',justifyContent:'center',fontSize:isPast?11:16,fontWeight:900,cursor:isPast?'default':'pointer',
                      background:isPast?'rgba(255,179,0,0.04)':isFlash&&flashOk?'rgba(255,179,0,0.45)':isFlash&&!flashOk?'rgba(255,107,138,0.35)':isNext?'rgba(255,179,0,0.14)':'rgba(255,255,255,0.04)',
                      border:`2px solid ${isPast?'rgba(255,179,0,0.1)':isNext?'rgba(255,179,0,0.7)':isFlash&&!flashOk?'rgba(255,107,138,0.7)':'rgba(255,255,255,0.07)'}`,
                      color:isPast?'rgba(255,179,0,0.18)':isNext?'#ffb300':'rgba(255,255,255,0.55)',
                      boxShadow:isNext?'0 0 12px rgba(255,179,0,0.35)':'none',transition:'background 0.1s,border 0.1s',userSelect:'none'}}>
                    {isPast?'✓':num}
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
// ════════════════════════════════════════════════════════════════════════════════
function BreatheFlow({ onSessionEnd }) {
  const [phase,      setPhase]      = useState('waiting');
  const [guideSize,  setGuideSize]  = useState(0);
  const [playerSize, setPlayerSize] = useState(0);
  const [holding,    setHolding]    = useState(false);
  const [calmScore,  setCalmScore]  = useState(0);
  const [cycle,      setCycle]      = useState(0);
  const [deviations, setDeviations] = useState([]);
  const [breathLabel,setBreathLabel]= useState('');
  const startRef = useRef(Date.now());
  const guideRef = useRef(0);
  const rafRef   = useRef(null);
  const INHALE=4000,HOLD=2000,EXHALE=4000,TOTAL=INHALE+HOLD+EXHALE;

  useEffect(()=>{
    if(phase!=='running')return;
    const startT=Date.now(); let lastCyc=-1;
    const tick=()=>{
      const el=(Date.now()-startT)%TOTAL; let guide=0,label='';
      if(el<INHALE){guide=el/INHALE*100;label='↑ Breathe In';}
      else if(el<INHALE+HOLD){guide=100;label='— Hold';}
      else{guide=100-(el-INHALE-HOLD)/EXHALE*100;label='↓ Breathe Out';}
      const cyc=Math.floor((Date.now()-startT)/TOTAL);
      if(cyc>lastCyc){lastCyc=cyc;setCycle(cyc);if(cyc>0)playBreathe(false);}
      guideRef.current=guide; setGuideSize(guide); setBreathLabel(label);
      rafRef.current=requestAnimationFrame(tick);
    };
    rafRef.current=requestAnimationFrame(tick);
    return()=>cancelAnimationFrame(rafRef.current);
  },[phase]);

  useEffect(()=>{
    if(phase!=='running')return;
    const t=setInterval(()=>{ const dev=Math.abs(playerSize-guideRef.current); setDeviations(p=>[...p.slice(-60),dev]); setCalmScore(p=>Math.min(100,p+(dev<20?1:dev<40?0:-1))); },250);
    return()=>clearInterval(t);
  },[phase,playerSize]);

  useEffect(()=>{
    if(phase!=='running')return;
    let r2;
    const upd=()=>{ setPlayerSize(p=>{const t=holding?100:0,s=holding?3.5:4.5; return Math.abs(p-t)<2?t:p+(t>p?s:-s);}); r2=requestAnimationFrame(upd); };
    r2=requestAnimationFrame(upd); return()=>cancelAnimationFrame(r2);
  },[holding,phase]);

  const avgDev=deviations.length?Math.round(deviations.reduce((a,b)=>a+b,0)/deviations.length):0;
  const syncPct=Math.max(0,100-avgDev);
  const syncColor=syncPct>75?'#00e676':syncPct>50?'#5eead4':syncPct>30?'#ffb300':'#ff6b8a';
  const guideR=44+guideSize*0.5, playerR=44+playerSize*0.5;

  return (
    <GameShell title="Breathe Flow" color="#5eead4" score={Math.round(calmScore)} unit="calm" onEnd={()=>{ cancelAnimationFrame(rafRef.current); const dur=Math.round((Date.now()-startRef.current)/1000); onSessionEnd({gameId:'breathe_flow',gameName:'Breathe Flow',durationSeconds:dur,interactions:Math.max(1,cycle),avgReactionMs:1000,accuracy:syncPct,score:Math.round(calmScore),extraData:{avgDeviation:avgDev,cycles:Math.max(1,cycle)}}); }}
      instruction="Hold to inhale · release to exhale · match the guide orb">
      <div
        onMouseDown={()=>{if(phase==='running'){setHolding(true);playBreathe(true);}}}
        onMouseUp={()=>setHolding(false)} onMouseLeave={()=>setHolding(false)}
        onTouchStart={e=>{e.preventDefault();if(phase==='running'){setHolding(true);playBreathe(true);}}}
        onTouchEnd={e=>{e.preventDefault();setHolding(false);}}
        style={{width:'100%',height:'100%',background:'radial-gradient(ellipse at 50% 50%, rgba(94,234,212,0.09), transparent 65%), #020f0e',borderRadius:14,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',cursor:phase==='running'?'pointer':'default',userSelect:'none',WebkitUserSelect:'none',position:'relative'}}>
        {phase==='waiting'?(
          <div style={{textAlign:'center'}}>
            <div style={{fontSize:36,marginBottom:10}}>🌬️</div>
            <p style={{fontSize:11.5,color:'rgba(94,234,212,0.65)',fontWeight:600,marginBottom:6}}>Match your breathing to the guide orb</p>
            <p style={{fontSize:10,color:'var(--text-3)',marginBottom:16,lineHeight:1.7}}>Hold anywhere to inhale<br/>Release to exhale<br/>Stay in sync for calm score</p>
            <button onClick={()=>setPhase('running')} style={{padding:'9px 24px',borderRadius:999,background:'rgba(94,234,212,0.1)',border:'1px solid rgba(94,234,212,0.3)',color:'#5eead4',fontWeight:700,fontSize:13,cursor:'pointer'}}>Begin</button>
          </div>
        ):(
          <>
            <div style={{fontSize:11,fontWeight:700,color:'rgba(94,234,212,0.7)',letterSpacing:'0.1em',marginBottom:10,textTransform:'uppercase'}}>{breathLabel}</div>
            <div style={{position:'relative',width:220,height:220,display:'flex',alignItems:'center',justifyContent:'center'}}>
              {/* Guide orb */}
              <motion.div animate={{width:guideR*2,height:guideR*2}} transition={{duration:0.2}}
                style={{position:'absolute',borderRadius:'50%',border:'2px dashed rgba(94,234,212,0.3)',background:`radial-gradient(circle, rgba(94,234,212,0.04), transparent 70%)`}}/>
              {/* Player orb */}
              <motion.div animate={{width:playerR*2,height:playerR*2}} transition={{duration:0.08}}
                style={{position:'absolute',borderRadius:'50%',background:`radial-gradient(circle at 38% 38%, ${syncColor}44, ${syncColor}11)`,border:`2px solid ${syncColor}80`,boxShadow:`0 0 ${20+playerSize*0.4}px ${syncColor}44`,transition:'border-color 0.3s'}}/>
              <div style={{width:14,height:14,borderRadius:'50%',background:syncColor,boxShadow:`0 0 10px ${syncColor}`,zIndex:5,position:'relative',transition:'background 0.3s'}}/>
            </div>
            <div style={{display:'flex',alignItems:'center',gap:10,marginTop:8}}>
              <div style={{width:90,height:3,borderRadius:999,background:'rgba(255,255,255,0.06)'}}>
                <div style={{height:'100%',width:`${syncPct}%`,background:syncColor,borderRadius:999,transition:'width 0.25s,background 0.3s'}}/>
              </div>
              <span style={{fontSize:10,color:syncColor,fontWeight:700}}>{syncPct}% sync</span>
            </div>
            <div style={{marginTop:6,fontSize:9.5,color:'var(--text-3)'}}>cycle {cycle} · hold to inhale</div>
          </>
        )}
      </div>
    </GameShell>
  );
}

// ════════════════════════════════════════════════════════════════════════════════
// SESSION REPORT PANEL (in-app, no download required)
// ════════════════════════════════════════════════════════════════════════════════
function SessionReportPanel({ gameSessions, worries, destroyedCount, onDownloadReport, reportBusy }) {
  const [expanded, setExpanded] = useState(true);
  const profile = computeHealthProfile(gameSessions, worries, destroyedCount);

  if (!profile) return (
    <motion.div initial={{opacity:0}} animate={{opacity:1}}
      style={{ marginTop:20, padding:'18px 22px', background:'rgba(255,255,255,0.018)', border:'1px solid var(--border)', borderRadius:18 }}>
      <p style={{ fontSize:12.5, color:'var(--text-3)', textAlign:'center' }}>
        🧬 Complete at least one game or forge session to generate your behavioral health profile
      </p>
    </motion.div>
  );

  const riskConfig = {
    'watch':          { color:'#00e676', bg:'rgba(0,230,118,0.08)', label:'LOW RISK', icon:'🟢' },
    'pre-burnout':    { color:'#ffb300', bg:'rgba(255,179,0,0.08)',  label:'MONITOR',  icon:'🟡' },
    'acute-distress': { color:'#ff6b8a', bg:'rgba(255,107,138,0.1)',label:'ELEVATED', icon:'🔴' },
  };
  const rc = riskConfig[profile.riskLevel];

  const Metric = ({ label, value, max=10, color, icon }) => (
    <div style={{ marginBottom:10 }}>
      <div style={{ display:'flex', justifyContent:'space-between', marginBottom:4 }}>
        <span style={{ fontSize:11, color:'var(--text-2)', fontWeight:600 }}>{icon} {label}</span>
        <span style={{ fontSize:11, fontWeight:800, color }}>{value}/{max}</span>
      </div>
      <div style={{ height:5, background:'rgba(255,255,255,0.06)', borderRadius:999, overflow:'hidden' }}>
        <motion.div initial={{width:0}} animate={{width:`${(value/max)*100}%`}} transition={{duration:0.8,ease:'easeOut'}}
          style={{ height:'100%', background:color, borderRadius:999 }} />
      </div>
    </div>
  );

  const InsightRow = ({ insight }) => {
    const conf = { alert:{icon:'⚠️',color:'#ff6b8a'}, warn:{icon:'🔶',color:'#ffb300'}, good:{icon:'✓',color:'#00e676'}, neutral:{icon:'ℹ️',color:'#4a6275'} };
    const c = conf[insight.severity] || conf.neutral;
    return (
      <div style={{ display:'flex', alignItems:'flex-start', gap:8, padding:'8px 0', borderBottom:'1px solid rgba(255,255,255,0.04)' }}>
        <span style={{ fontSize:13, flexShrink:0, marginTop:1 }}>{c.icon}</span>
        <p style={{ fontSize:11.5, color:'var(--text-2)', lineHeight:1.55 }}>{insight.text}</p>
      </div>
    );
  };

  return (
    <motion.div initial={{opacity:0,y:12}} animate={{opacity:1,y:0}} style={{ marginTop:22, background:'rgba(255,255,255,0.02)', border:'1px solid rgba(255,255,255,0.07)', borderRadius:20, overflow:'hidden' }}>
      {/* Header */}
      <button onClick={() => setExpanded(e=>!e)}
        style={{ width:'100%', padding:'16px 20px', display:'flex', justifyContent:'space-between', alignItems:'center', background:'none', border:'none', cursor:'pointer', textAlign:'left' }}>
        <div style={{ display:'flex', alignItems:'center', gap:12 }}>
          <span style={{ fontSize:15, fontWeight:800, color:'var(--text-1)', letterSpacing:'-0.03em' }}>🧬 Behavioral Health Profile</span>
          <span style={{ padding:'3px 10px', borderRadius:999, background:rc.bg, border:`1px solid ${rc.color}30`, fontSize:10, fontWeight:800, color:rc.color }}>
            {rc.icon} {rc.label}
          </span>
          <span style={{ fontSize:11, color:'var(--text-3)' }}>Wellbeing: {profile.wellbeing}/100</span>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          {onDownloadReport && (
            <button onClick={e=>{e.stopPropagation();onDownloadReport();}} disabled={reportBusy}
              style={{ fontSize:11, padding:'5px 14px', borderRadius:999, background:'rgba(0,229,255,0.08)', border:'1px solid rgba(0,229,255,0.2)', color:'#80deea', fontWeight:700, cursor:'pointer' }}>
              <FileText size={11} style={{verticalAlign:'middle',marginRight:4}}/>{reportBusy?'Generating…':'PDF Report'}
            </button>
          )}
          {expanded ? <ChevronUp size={15} color="var(--text-3)"/> : <ChevronDown size={15} color="var(--text-3)"/>}
        </div>
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div initial={{height:0,opacity:0}} animate={{height:'auto',opacity:1}} exit={{height:0,opacity:0}} transition={{duration:0.3}}>
            <div style={{ padding:'0 20px 20px' }}>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:24 }}>
                {/* Left: metrics */}
                <div>
                  <p style={{ fontSize:10, color:'var(--text-3)', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.1em', marginBottom:14 }}>Predictive Metrics</p>
                  <Metric label="Stress Load"             value={profile.stressScore}   color={profile.stressScore>6?'#ff6b8a':profile.stressScore>4?'#ffb300':'#00e676'} icon="🌡" />
                  <Metric label="ADHD Signal"             value={profile.adhdSignal}    color={profile.adhdSignal>6?'#ff6b8a':profile.adhdSignal>4?'#ffb300':'#c4b5fd'}  icon="⚡" />
                  <Metric label="Anxiety Level"           value={profile.anxietyLevel}  color={profile.anxietyLevel>6?'#ff6b8a':profile.anxietyLevel>4?'#ffb300':'#5eead4'} icon="😰" />
                  <Metric label="Focus Quality"           value={profile.focusScore}    color={profile.focusScore>7?'#00e5ff':profile.focusScore>4?'#c4b5fd':'#4a6275'}   icon="🎯" />
                  <Metric label="Emotional Regulation"   value={profile.emotionalReg}  color={profile.emotionalReg>7?'#00e676':profile.emotionalReg>4?'#5eead4':'#ffb300'} icon="🫁" />
                </div>

                {/* Right: insights */}
                <div>
                  <p style={{ fontSize:10, color:'var(--text-3)', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.1em', marginBottom:14 }}>Clinical Insights</p>
                  {profile.insights.map((ins,i) => <InsightRow key={i} insight={ins} />)}

                  <div style={{ marginTop:14, padding:'10px 14px', background:rc.bg, border:`1px solid ${rc.color}25`, borderRadius:12 }}>
                    <p style={{ fontSize:10, fontWeight:700, color:rc.color, textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:5 }}>Overall Assessment</p>
                    <p style={{ fontSize:11, color:'var(--text-2)', lineHeight:1.6 }}>
                      {profile.riskLevel === 'acute-distress'
                        ? 'Significant distress indicators present. Encourage rest, reduce demands, and consider professional consultation.'
                        : profile.riskLevel === 'pre-burnout'
                        ? 'Moderate stress load detected. Regular breaks, structured routines, and continued use of therapeutic activities recommended.'
                        : 'Behavioral patterns within manageable range. Continue with regular therapeutic check-ins to maintain wellbeing.'}
                    </p>
                  </div>

                  {/* Data source note */}
                  <p style={{ fontSize:9.5, color:'var(--text-3)', marginTop:10, lineHeight:1.55 }}>
                    ℹ️ Predictions derived from interaction timing, accuracy, and behavioral patterns across {gameSessions.length} game session{gameSessions.length!==1?'s':''} and {worries.length} identified worry{worries.length!==1?'ies':'y'}. Not a clinical diagnosis.
                  </p>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ════════════════════════════════════════════════════════════════════════════════
// Game card + definitions + physics helpers
// ════════════════════════════════════════════════════════════════════════════════
function GameCard({ game, onClick }) {
  return (
    <motion.button onClick={onClick} whileHover={{scale:1.04}} whileTap={{scale:0.94}}
      style={{ width:'100%', display:'flex', flexDirection:'column', alignItems:'center', gap:7, padding:'12px 8px',
        borderRadius:16, cursor:'pointer', background:`${game.color}06`, border:`1px solid ${game.color}20`,
        textAlign:'center', transition:'border-color 0.2s, background 0.2s',
      }}
      onMouseEnter={e=>{e.currentTarget.style.borderColor=`${game.color}45`;e.currentTarget.style.background=`${game.color}0e`;}}
      onMouseLeave={e=>{e.currentTarget.style.borderColor=`${game.color}20`;e.currentTarget.style.background=`${game.color}06`;}}>
      <div style={{fontSize:28,lineHeight:1,filter:`drop-shadow(0 0 6px ${game.color}55)`}}>{game.emoji}</div>
      <div>
        <p style={{fontSize:10.5,fontWeight:800,color:game.color,letterSpacing:'-0.01em',marginBottom:2}}>{game.name}</p>
        <p style={{fontSize:8.5,color:'var(--text-3)',lineHeight:1.4}}>{game.tagline}</p>
      </div>
      <p style={{fontSize:8,color:game.color,opacity:0.55,fontWeight:600,letterSpacing:'0.05em',textTransform:'uppercase'}}>{game.mechanic}</p>
    </motion.button>
  );
}

const GAME_DEFS = [
  { id:'squeeze_release', name:'Squeeze Release', emoji:'🫳', color:'#ff6b8a', tagline:'Release built-up tension', mechanic:'Hold & release', side:'left',  Component:SqueezeRelease },
  { id:'color_sort',      name:'Color Sort',      emoji:'🎨', color:'#00e5ff', tagline:'Sort by colour logic',   mechanic:'Drag & match',  side:'left',  Component:ColorSort      },
  { id:'word_smash',      name:'Word Smash',      emoji:'💥', color:'#c4b5fd', tagline:'Crush negativity',       mechanic:'Click to smash', side:'left', Component:WordSmash      },
  { id:'memory_pulse',    name:'Memory Pulse',    emoji:'🧠', color:'#a78bfa', tagline:'Test working memory',    mechanic:'Sequence repeat',side:'right', Component:MemoryPulse    },
  { id:'number_dash',     name:'Number Dash',     emoji:'🔢', color:'#ffb300', tagline:'Schulte attention test', mechanic:'Order 1→16',    side:'right', Component:NumberDash     },
  { id:'perception_probe',name:'Perspective',     emoji:'👁️', color:'#5eead4', tagline:'Cognitive rigidity test', mechanic:'Illusion switch', side:'right', Component:PerceptionProbe    },
];

// Physics helpers
const drawWrappedText = (ctx, text, maxWidth, lh=14) => {
  const words=text.split(' ');const lines=[];let line='';
  words.forEach(w=>{const c=line?`${line} ${w}`:w;if(ctx.measureText(c).width>maxWidth-16&&line){lines.push(line);line=w;}else line=c;});
  if(line)lines.push(line);const capped=lines.slice(0,3);
  const off=((capped.length-1)*lh)/2;capped.forEach((l,i)=>ctx.fillText(l,0,i*lh-off));
};
const getGridSpawnPositions=(count,canvasWidth)=>{
  const positions=[];const cols=Math.min(count,Math.ceil(Math.sqrt(count*1.5)));const colWidth=(canvasWidth-100)/cols;
  for(let i=0;i<count;i++){const col=i%cols,row=Math.floor(i/cols);
    const x=50+col*colWidth+colWidth*0.5+(Math.random()-0.5)*(colWidth*0.28);const y=-55-row*85-Math.random()*25;
    positions.push({x:Math.max(70,Math.min(canvasWidth-70,x)),y});}return positions;
};
const weightToStyle=w=>{
  if(w>=8)return{fill:'#7f1d1d',stroke:'rgba(248,113,113,0.5)',label:'#fee2e2'};
  if(w>=6)return{fill:'#78350f',stroke:'rgba(251,146,60,0.4)',label:'#fed7aa'};
  if(w>=4)return{fill:'#3f3f46',stroke:'rgba(196,181,253,0.35)',label:'#e9d5ff'};
  return{fill:'#1e3a5f',stroke:'rgba(103,232,249,0.3)',label:'#cffafe'};
};

// ════════════════════════════════════════════════════════════════════════════════
// MAIN CognitiveForge component
// ════════════════════════════════════════════════════════════════════════════════
export default function CognitiveForge() {
  const sceneRef    = useRef(null);const engineRef=useRef(null);const worldRef=useRef(null);
  const renderRef   = useRef(null);const runnerRef=useRef(null);const mcRef=useRef(null);
  const incRef      = useRef(null);const boundaryRef=useRef([]);const resizeRafRef=useRef(null);
  const timersRef   = useRef([]);const dimsRef=useRef({width:MAX_W,height:PHYSICS_H});
  const reframeRef  = useRef('I release this. I am stronger than my worries.');
  const lastDestroyRef=useRef(0);const comboRef=useRef(0);const comboTimerRef=useRef(null);

  const [text,         setText]        = useState('');
  const [reframeText,  setReframeText] = useState('I release this. I am stronger than my worries.');
  const [isLoading,    setLoading]     = useState(false);
  const [error,        setError]       = useState(null);
  const [hasBlocks,    setHasBlocks]   = useState(false);
  const [destroyedN,   setDestroyedN]  = useState(0);
  const [comboDisplay, setComboDisplay]= useState(0);
  const [showCombo,    setShowCombo]   = useState(false);
  const [showInput,    setShowInput]   = useState(true);
  const [phoenixTexts, setPhoenixTexts]= useState([]);
  const [activeGame,   setActiveGame]  = useState(null);
  const [gameSessions, setGameSessions]= useState([]);
  const [reportBusy,   setReportBusy] = useState(false);
  const [reportMsg,    setReportMsg]  = useState(null);

  const { userId, worries, setWorries, markWorryDestroyed } = useStore();
  useEffect(()=>{reframeRef.current=reframeText;},[reframeText]);
  const rememberTimer=useCallback(id=>{timersRef.current.push(id);},[]);
  const clearTimers=useCallback(()=>{timersRef.current.forEach(clearTimeout);timersRef.current=[];},[]);

  const triggerCombo=useCallback(n=>{
    setComboDisplay(n);setShowCombo(true);
    playTone([523,659,784,1047,1319][Math.min(n-1,4)],'triangle',0.25,0.15);
    if(comboTimerRef.current)clearTimeout(comboTimerRef.current);
    comboTimerRef.current=setTimeout(()=>{setShowCombo(false);comboRef.current=0;},2000);
  },[]);

  const onWorryDestroyed=useCallback((uuid,bx,by)=>{
    markWorryDestroyed(uuid);
    const now=Date.now();
    if(now-lastDestroyRef.current<2000)comboRef.current+=1;else comboRef.current=1;
    lastDestroyRef.current=now;setDestroyedN(n=>n+1);
    playTone(280,'sawtooth',0.09,0.15);
    const canvas=renderRef.current?.canvas;const rect=canvas?.getBoundingClientRect?.();
    const sx=rect?rect.left+bx*(rect.width/dimsRef.current.width):window.innerWidth/2;
    const sy=rect?rect.top+by*(rect.height/dimsRef.current.height):window.innerHeight*0.8;
    confetti({particleCount:18+comboRef.current*7,spread:55,origin:{x:sx/window.innerWidth,y:sy/window.innerHeight},colors:['#fb7185','#f97316','#f59e0b','#67e8f9','#c4b5fd'],ticks:85,gravity:0.5,scalar:0.8,startVelocity:18});
    if(comboRef.current>=2)triggerCombo(comboRef.current);
    const pid=`px-${Date.now()}`;
    setPhoenixTexts(p=>[...p.slice(-2),{id:pid,text:reframeRef.current?.trim()||'I am free.'}]);
    setTimeout(()=>setPhoenixTexts(p=>p.filter(x=>x.id!==pid)),3500);
    if(userId)forgeApi.destroy(userId,uuid).catch(()=>{});
  },[markWorryDestroyed,triggerCombo,userId]);

  const addWorryBlock=useCallback((worryText,options={})=>{
    const world=worldRef.current;if(!world)return null;
    const{width}=dimsRef.current;const weight=Math.max(1,Math.min(10,Number(options.weight)||5));
    const blockW=Math.max(140,100+weight*18);const style=weightToStyle(weight);
    const x=options.x??(80+Math.random()*Math.max(1,width-160));const y=options.y??(-55-Math.random()*50);
    const body=Bodies.rectangle(x,y,blockW,58,{label:'worry_block',density:0.006+weight*0.0003,restitution:0.12,friction:0.85,frictionAir:0.04,chamfer:{radius:10},render:{fillStyle:style.fill,strokeStyle:style.stroke,lineWidth:1.5}});
    body.plugin={kind:'worry_block',text:String(worryText||'worry').slice(0,60),labelColor:style.label,uuid:options.uuid||uuidv4(),weight,consumed:false};
    Body.setAngularVelocity(body,(Math.random()-0.5)*0.06);World.add(world,body);return body;
  },[]);

  const shatterWorryBlock=useCallback(b=>{
    const world=worldRef.current;if(!world||!b||b.plugin?.consumed)return;
    b.plugin.consumed=true;const{x,y}=b.position;const uuid=b.plugin?.uuid;
    Composite.remove(world,b);if(uuid)onWorryDestroyed(uuid,x,y);
  },[onWorryDestroyed]);

  const spawnWorryBatch=useCallback(worryItems=>{
    requestAnimationFrame(()=>{
      const{width}=dimsRef.current;const positions=getGridSpawnPositions(worryItems.length,width);
      worryItems.forEach((worry,idx)=>{ const t=setTimeout(()=>{ addWorryBlock(worry.worry,{uuid:worry.uuid||uuidv4(),weight:worry.weight,x:positions[idx]?.x,y:positions[idx]?.y}); },100+idx*150); rememberTimer(t); });
    });
  },[addWorryBlock,rememberTimer]);

  const clearWorldBodies=useCallback(()=>{
    const world=worldRef.current;if(!world)return;
    Composite.allBodies(world).filter(b=>b.label!=='boundary'&&b.label!=='incinerator').forEach(b=>Composite.remove(world,b));
    clearTimers();
  },[clearTimers]);

  useEffect(()=>{
    const host=sceneRef.current;if(!host||engineRef.current)return;
    host.innerHTML='';
    const engine=Engine.create({gravity:{x:0,y:0.9},positionIterations:8,velocityIterations:6});
    const render=Render.create({element:host,engine,options:{width:MAX_W,height:PHYSICS_H,wireframes:false,background:'transparent',pixelRatio:Math.min(window.devicePixelRatio||1,2)}});
    render.canvas.style.width='100%';render.canvas.style.height=`${PHYSICS_H}px`;render.canvas.style.display='block';
    const runner=Runner.create();const world=engine.world;
    engineRef.current=engine;renderRef.current=render;runnerRef.current=runner;worldRef.current=world;
    const makeBoundaries=(w,h)=>{
      const opts={isStatic:true,label:'boundary',render:{visible:false}};
      const inc=Bodies.rectangle(w/2,h-20,w-60,40,{isStatic:true,isSensor:true,label:'incinerator',render:{visible:false}});
      return{bodies:[Bodies.rectangle(w/2,h+30,w+100,60,opts),Bodies.rectangle(-30,h/2,60,h+100,opts),Bodies.rectangle(w+30,h/2,60,h+100,opts),Bodies.rectangle(w/2,-30,w+100,60,opts),inc],inc};
    };
    const syncSize=()=>{
      const nw=Math.min(MAX_W,Math.max(MIN_W,Math.floor(host.clientWidth||MAX_W)));const nh=PHYSICS_H;
      const{width:pw,height:ph}=dimsRef.current;if(nw===pw&&nh===ph)return;
      dimsRef.current={width:nw,height:nh};render.options.width=nw;render.options.height=nh;
      const dpr=Math.min(window.devicePixelRatio||1,2);render.canvas.width=nw*dpr;render.canvas.height=nh*dpr;
      render.canvas.style.width='100%';render.canvas.style.height=`${nh}px`;
      if(boundaryRef.current.length)boundaryRef.current.forEach(b=>Composite.remove(world,b));
      const{bodies,inc}=makeBoundaries(nw,nh);boundaryRef.current=bodies;incRef.current=inc;World.add(world,bodies);
    };
    requestAnimationFrame(syncSize);
    const scheduleResize=()=>{if(resizeRafRef.current)cancelAnimationFrame(resizeRafRef.current);resizeRafRef.current=requestAnimationFrame(syncSize);};
    let ro=null;if(typeof ResizeObserver!=='undefined'){ro=new ResizeObserver(scheduleResize);ro.observe(host);}else window.addEventListener('resize',scheduleResize);
    const mouse=Mouse.create(render.canvas);
    const mc=MouseConstraint.create(engine,{mouse,constraint:{stiffness:0.18,damping:0.22,render:{visible:true,lineWidth:1,strokeStyle:'rgba(251,191,36,0.3)'}}});
    render.mouse=mouse;mcRef.current=mc;World.add(world,mc);
    const onCollision=({pairs})=>{pairs.forEach(({bodyA,bodyB})=>{const isInc=bodyA.label==='incinerator'||bodyB.label==='incinerator';if(!isInc)return;const block=bodyA.label==='worry_block'?bodyA:bodyB.label==='worry_block'?bodyB:null;if(block)shatterWorryBlock(block);});};
    const onAfterRender=()=>{const ctx=render.context;Composite.allBodies(world).forEach(body=>{if(body.label!=='worry_block'||!body.plugin?.text)return;ctx.save();ctx.translate(body.position.x,body.position.y);ctx.rotate(body.angle);ctx.font='600 12.5px "Plus Jakarta Sans",system-ui,sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillStyle=body.plugin.labelColor||'rgba(255,241,242,0.95)';ctx.shadowColor='rgba(0,0,0,0.5)';ctx.shadowBlur=6;drawWrappedText(ctx,body.plugin.text,body.bounds.max.x-body.bounds.min.x);ctx.restore();});};
    Events.on(engine,'collisionStart',onCollision);Events.on(render,'afterRender',onAfterRender);
    Render.run(render);Runner.run(runner,engine);
    return()=>{
      if(ro)ro.disconnect();else window.removeEventListener('resize',scheduleResize);
      if(resizeRafRef.current)cancelAnimationFrame(resizeRafRef.current);clearTimers();
      Events.off(engine,'collisionStart',onCollision);Events.off(render,'afterRender',onAfterRender);
      if(mcRef.current)World.remove(world,mcRef.current);
      Render.stop(render);Runner.stop(runner);World.clear(world,false);Engine.clear(engine);
      if(render.canvas?.parentNode)render.canvas.parentNode.removeChild(render.canvas);render.textures={};
      engineRef.current=null;renderRef.current=null;runnerRef.current=null;worldRef.current=null;
    };
  },[clearTimers,shatterWorryBlock]);

  const handleGameSessionEnd=useCallback(rawMetrics=>{
    const predictedEffects=derivePredictedEffects(rawMetrics.gameId,rawMetrics);
    setGameSessions(prev=>[...prev,{...rawMetrics,predictedEffects,completedAt:new Date().toISOString()}]);
    setActiveGame(null);
    setReportMsg(`${rawMetrics.gameName} logged · ${rawMetrics.durationSeconds}s`);
    setTimeout(()=>setReportMsg(null),3000);
  },[]);

  const handleExtract=async()=>{
    if(!text.trim()||isLoading)return;
    setError(null);setLoading(true);
    try{
      const data=await forgeApi.extract(text.trim(),userId);
      const nextWorries=(data.worries||[]).map((w,idx)=>({...w,id:w.id??idx+1,uuid:w.uuid||uuidv4(),status:w.status||'active'}));
      setWorries(nextWorries);clearWorldBodies();spawnWorryBatch(nextWorries);
      setHasBlocks(nextWorries.length>0);setShowInput(false);setDestroyedN(0);comboRef.current=0;
    }catch(err){setError(err.message||'Could not extract worries.');}
    finally{setLoading(false);}
  };

  const handleGenerateReport=async()=>{
    if(!userId||reportBusy)return;
    setReportBusy(true);
    try{
      const{clinicalApi}=await import('../../services/portalApi.js');
      const res=await clinicalApi.sessionReport({userId,source:'manual',currentTask:'Cognitive Forge session',vocalArousalScore:5,sendToGuardian:false,sessionSnapshot:{initialAnxietyQuery:text,shatteredWorryBlocks:worries.map(w=>({id:w.uuid||String(w.id),text:w.worry,weight:w.weight,status:w.status||'active'})),gameSessions,notes:gameSessions.length?`${gameSessions.map(s=>`${s.gameName}(${s.durationSeconds}s,score:${s.score})`).join(', ')}.`:'No games played.'}});
      if(res.downloadUrl)window.open(res.downloadUrl,'_blank','noopener,noreferrer');
      setReportMsg(`PDF ready · Risk: ${res.riskLevel}`);setTimeout(()=>setReportMsg(null),5000);
    }catch(e){setReportMsg(`PDF failed: ${e.message}`);setTimeout(()=>setReportMsg(null),4000);}
    finally{setReportBusy(false);}
  };

  const handleReset=()=>{clearWorldBodies();setWorries([]);setHasBlocks(false);setDestroyedN(0);setShowInput(true);setText('');setPhoenixTexts([]);comboRef.current=0;setShowCombo(false);};

  const activeCount=worries.filter(w=>w.status!=='destroyed').length;
  const allCleared=hasBlocks&&activeCount===0;
  const leftGames=GAME_DEFS.filter(g=>g.side==='left');
  const rightGames=GAME_DEFS.filter(g=>g.side==='right');
  const ActiveGameComponent=activeGame?GAME_DEFS.find(g=>g.id===activeGame)?.Component:null;
  const activeGameDef=activeGame?GAME_DEFS.find(g=>g.id===activeGame):null;

  return(
    <div className="page fade-up" style={{maxWidth:1200,paddingBottom:48}}>
      {/* Header */}
      <motion.div initial={{opacity:0,y:14}} animate={{opacity:1,y:0}} style={{marginBottom:24}}>
        <span className="badge badge-amber" style={{marginBottom:12}}><Flame size={10}/> Cognitive Forge</span>
        <h1 className="section-title">Burn What Blocks You</h1>
        <p className="section-sub">Extract worries as physics blocks · drag to the fire · play therapeutic games · see your behavioral health profile below</p>
      </motion.div>

      {/* 3-column */}
      <div style={{display:'flex',gap:12,alignItems:'flex-start'}}>
        {/* LEFT games */}
        <div style={{width:160,flexShrink:0,display:'flex',flexDirection:'column',gap:9,paddingTop:6}}>
          <p style={{fontSize:9,color:'var(--text-3)',fontWeight:700,textTransform:'uppercase',letterSpacing:'0.1em',textAlign:'center',marginBottom:2}}>RELEASE</p>
          {leftGames.map(g=><GameCard key={g.id} game={g} onClick={()=>setActiveGame(g.id)}/>)}
        </div>

        {/* CENTER forge */}
        <div style={{flex:1,minWidth:0}}>
          <AnimatePresence>
            {showInput&&(
              <motion.div initial={{opacity:0,y:12}} animate={{opacity:1,y:0}} exit={{opacity:0,scale:0.97}} className="glass" style={{padding:20,marginBottom:16}}>
                <textarea className="textarea" rows={4} placeholder="Type your worries here — raw, messy, unfiltered..." value={text} onChange={e=>setText(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'&&e.metaKey)handleExtract();}}/>
                {!text&&(
                  <div style={{display:'flex',gap:6,flexWrap:'wrap',margin:'8px 0'}}>
                    {["I'm behind on deadlines","my relationship feels distant","money is tight"].map(ex=>(
                      <button key={ex} onClick={()=>setText(p=>p?`${p}, ${ex}`:ex)} style={{fontSize:10.5,padding:'3px 10px',borderRadius:999,background:'rgba(255,179,0,0.08)',border:'1px solid rgba(255,179,0,0.2)',color:'#ffe082',cursor:'pointer'}}>+ {ex}</button>
                    ))}
                  </div>
                )}
                <div style={{marginTop:8}}>
                  <label style={{fontSize:9.5,color:'var(--text-3)',fontWeight:700,textTransform:'uppercase',letterSpacing:'0.08em',display:'block',marginBottom:5}}>Phoenix Reframe</label>
                  <input value={reframeText} onChange={e=>setReframeText(e.target.value)} style={{width:'100%',background:'rgba(3,7,18,0.72)',border:'1px solid rgba(103,232,249,0.2)',color:'var(--text-1)',borderRadius:12,padding:'9px 14px',outline:'none',fontFamily:'inherit',fontSize:12.5}}/>
                </div>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginTop:13}}>
                  <span style={{fontSize:11,color:'var(--text-3)'}}>{text.length} chars</span>
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
          <div style={{position:'relative',borderRadius:20,overflow:'hidden',border:'1px solid rgba(125,211,252,0.12)',background:'radial-gradient(ellipse at 50% 5%,rgba(34,211,238,0.18) 0%,transparent 50%),radial-gradient(ellipse at 50% 100%,rgba(251,146,60,0.2) 0%,transparent 40%),linear-gradient(180deg,#030712 0%,#020617 60%,#0b1120 100%)',minHeight:PHYSICS_H}}>
            <div style={{position:'absolute',inset:0,pointerEvents:'none',zIndex:0,backgroundImage:'radial-gradient(rgba(103,232,249,0.07) 1px,transparent 1px)',backgroundSize:'28px 28px'}}/>
            <div ref={sceneRef} style={{position:'relative',zIndex:1,minHeight:PHYSICS_H}}/>
            <AnimatePresence>
              {showCombo&&comboDisplay>=2&&(
                <motion.div initial={{opacity:0,scale:0.4,y:-20}} animate={{opacity:1,scale:1,y:0}} exit={{opacity:0,scale:1.5,y:-40}}
                  style={{position:'absolute',top:70,left:'50%',transform:'translateX(-50%)',zIndex:100,pointerEvents:'none',textAlign:'center'}}>
                  <p style={{fontSize:26,fontWeight:900,background:'linear-gradient(135deg,#ffb300,#ff6b8a)',WebkitBackgroundClip:'text',WebkitTextFillColor:'transparent'}}>{comboDisplay}x COMBO!</p>
                </motion.div>
              )}
            </AnimatePresence>
            <AnimatePresence>
              {phoenixTexts.map(({id,text:txt})=>(
                <motion.div key={id} initial={{opacity:0,y:0}} animate={{opacity:[0,1,1,0],y:-110}} transition={{duration:3.2,ease:'easeOut'}}
                  style={{position:'absolute',bottom:76,left:'50%',transform:'translateX(-50%)',zIndex:50,pointerEvents:'none',textAlign:'center',width:'82%'}}>
                  <p style={{display:'inline-block',padding:'8px 18px',background:'linear-gradient(135deg,rgba(0,229,255,0.12),rgba(124,58,237,0.12))',border:'1px solid rgba(0,229,255,0.3)',borderRadius:999,fontSize:13,fontWeight:700,color:'#67e8f9',backdropFilter:'blur(12px)'}}>✦ {txt}</p>
                </motion.div>
              ))}
            </AnimatePresence>
            <AnimatePresence>
              {!hasBlocks&&(
                <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}
                  style={{position:'absolute',inset:0,zIndex:2,pointerEvents:'none',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:10}}>
                  <motion.div animate={{scale:[1,1.08,1],opacity:[0.4,0.7,0.4]}} transition={{duration:3.5,repeat:Infinity,ease:'easeInOut'}}
                    style={{width:64,height:64,borderRadius:'50%',background:'radial-gradient(circle,rgba(34,211,238,0.14),transparent 70%)',border:'1px solid rgba(103,232,249,0.16)',display:'flex',alignItems:'center',justifyContent:'center'}}>
                    <Wind size={24} color="rgba(103,232,249,0.5)"/>
                  </motion.div>
                  <p style={{color:'var(--text-3)',fontSize:13.5,fontWeight:600}}>Worry blocks appear here</p>
                  <p style={{color:'var(--text-3)',fontSize:11,opacity:0.65}}>Play a game on either side to start your health profile →</p>
                </motion.div>
              )}
            </AnimatePresence>
            {/* Flame incinerator */}
            <div style={{position:'absolute',bottom:0,left:0,right:0,height:68,zIndex:3,pointerEvents:'none',overflow:'hidden'}}>
              <div style={{position:'absolute',inset:0,background:'linear-gradient(to top,rgba(251,146,60,0.28) 0%,rgba(251,146,60,0.1) 60%,transparent 100%)',borderTop:'1px solid rgba(251,191,36,0.42)',boxShadow:'0 -16px 52px rgba(251,146,60,0.22)'}}/>
              {Array.from({length:9},(_,i)=><div key={i} style={{position:'absolute',bottom:0,left:`${6+i*10}%`,width:15,height:26,background:'linear-gradient(to top,rgba(251,146,60,0.85),rgba(251,191,36,0.42),transparent)',borderRadius:'50% 50% 30% 30%',animation:`flameFlicker ${0.72+i*0.12}s ${i*0.09}s ease-in-out infinite alternate`,filter:'blur(2.5px)',transformOrigin:'bottom center'}}/>)}
              <div style={{position:'absolute',bottom:0,left:0,right:0,display:'flex',alignItems:'center',justifyContent:'center',paddingBottom:7,gap:5}}>
                <Flame size={11} color="rgba(254,240,138,0.85)"/>
                <span style={{fontSize:9.5,fontWeight:800,letterSpacing:'0.12em',textTransform:'uppercase',color:'rgba(254,240,138,0.8)'}}>Incinerator · Drop to release</span>
                <Flame size={11} color="rgba(254,240,138,0.85)"/>
              </div>
            </div>
          </div>

          {/* Stats bar */}
          {hasBlocks&&(
            <motion.div initial={{opacity:0,y:8}} animate={{opacity:1,y:0}} style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginTop:10,flexWrap:'wrap',gap:7}}>
              <div style={{display:'flex',gap:7}}>
                {destroyedN>0&&<span className="badge badge-green"><Zap size={9}/> {destroyedN} released</span>}
                {activeCount>0&&<span className="badge badge-amber">{activeCount} remaining</span>}
                {allCleared&&<motion.span initial={{scale:0.8}} animate={{scale:1}} className="badge badge-cyan"><Trophy size={9}/> All cleared! ✦</motion.span>}
              </div>
              <div style={{display:'flex',gap:6}}>
                {!showInput&&<motion.button className="btn btn-secondary" onClick={()=>setShowInput(true)} whileTap={{scale:0.96}} style={{fontSize:11,padding:'6px 12px'}}><Sparkles size={11}/> More</motion.button>}
                {allCleared&&<motion.button className="btn btn-primary" onClick={handleReset} whileTap={{scale:0.96}} style={{fontSize:11,padding:'6px 12px'}}><RotateCcw size={11}/> New</motion.button>}
                <motion.button className="btn btn-ghost" onClick={handleReset} whileTap={{scale:0.95}}><Trash2 size={11}/></motion.button>
              </div>
            </motion.div>
          )}
        </div>

        {/* RIGHT games */}
        <div style={{width:160,flexShrink:0,display:'flex',flexDirection:'column',gap:9,paddingTop:6}}>
          <p style={{fontSize:9,color:'var(--text-3)',fontWeight:700,textTransform:'uppercase',letterSpacing:'0.1em',textAlign:'center',marginBottom:2}}>FOCUS</p>
          {rightGames.map(g=><GameCard key={g.id} game={g} onClick={()=>setActiveGame(g.id)}/>)}
        </div>
      </div>

      {/* ── Section divider — draws the eye downward to the report ──── */}
      <div style={{ marginTop:32, marginBottom:6, display:'flex', alignItems:'center', gap:12 }}>
        <div style={{ flex:1, height:1, background:'linear-gradient(90deg, transparent, rgba(0,229,255,0.18), transparent)' }}/>
        <span style={{ fontSize:10, color:'var(--text-3)', fontWeight:700, letterSpacing:'0.12em', textTransform:'uppercase', whiteSpace:'nowrap' }}>
          🧬 Behavioral Health Profile
        </span>
        <div style={{ flex:1, height:1, background:'linear-gradient(90deg, transparent, rgba(0,229,255,0.18), transparent)' }}/>
      </div>

      {/* ── Session Report Panel — always visible, updates live ──────── */}
      <SessionReportPanel
        gameSessions={gameSessions}
        worries={worries}
        destroyedCount={destroyedN}
        onDownloadReport={handleGenerateReport}
        reportBusy={reportBusy}
      />

      {/* ── Game activity log ─────────────────────────────────────────── */}
      {gameSessions.length>0&&(
        <motion.div initial={{opacity:0}} animate={{opacity:1}} style={{marginTop:16}}>
          <p style={{fontSize:10,color:'var(--text-3)',fontWeight:700,textTransform:'uppercase',letterSpacing:'0.1em',marginBottom:10}}>Activity Log</p>
          <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(200px,1fr))',gap:9}}>
            {gameSessions.map((s,i)=>{
              const gd=GAME_DEFS.find(g=>g.id===s.gameId);const eff=s.predictedEffects||{};
              return(
                <motion.div key={i} initial={{opacity:0,scale:0.95}} animate={{opacity:1,scale:1}} transition={{delay:i*0.05}}
                  style={{background:'rgba(255,255,255,0.02)',border:`1px solid ${gd?.color||'var(--border)'}18`,borderRadius:14,padding:'11px 13px'}}>
                  <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:6}}>
                    <div style={{display:'flex',alignItems:'center',gap:7}}>
                      <span style={{fontSize:18}}>{gd?.emoji||'🎮'}</span>
                      <div><p style={{fontSize:11.5,fontWeight:700,color:'var(--text-1)'}}>{s.gameName}</p><p style={{fontSize:9,color:'var(--text-3)'}}>{s.durationSeconds}s · {s.score} score</p></div>
                    </div>
                    <span style={{fontSize:8.5,fontWeight:700,color:eff?.arousalLevel==='high'?'#ff6b8a':eff?.arousalLevel==='low'?'#00e676':'#ffb300',background:'rgba(255,255,255,0.04)',padding:'2px 7px',borderRadius:999,border:'1px solid rgba(255,255,255,0.07)'}}>{eff?.arousalLevel}</span>
                  </div>
                  <div style={{display:'flex',gap:6,marginBottom:6}}>
                    {[{l:'Stress↓',v:eff?.stressReduction,c:'#00e676'},{l:'Dopamine',v:eff?.dopamineActivation,c:'#c4b5fd'},{l:'Focus',v:eff?.focusScore,c:'#00e5ff'}].map(({l,v,c})=>(
                      <div key={l} style={{flex:1,textAlign:'center'}}>
                        <div style={{height:3,borderRadius:999,background:'rgba(255,255,255,0.06)',marginBottom:2}}>
                          <div style={{height:'100%',width:`${(v||0)*10}%`,background:c,borderRadius:999}}/>
                        </div>
                        <p style={{fontSize:7.5,color:'var(--text-3)',fontWeight:600}}>{l}</p>
                      </div>
                    ))}
                  </div>
                </motion.div>
              );
            })}
          </div>
        </motion.div>
      )}

      {/* Game modal — fixed overlay, decoupled from document flow via Portal */}
      {typeof document !== 'undefined' && createPortal(
        <AnimatePresence>
          {activeGame&&ActiveGameComponent&&(
            <motion.div
              initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}
              className="fixed inset-0 z-[500] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
            >
              <motion.div
                initial={{scale:0.9,y:24}} animate={{scale:1,y:0}} exit={{scale:0.88,opacity:0}}
                className="relative z-10 w-full"
                style={{
                  maxWidth: activeGame==='number_dash'?480:activeGame==='memory_pulse'?460:activeGame==='perception_probe'?600:530,
                  maxHeight:'88dvh', minHeight:460,
                  background:'rgba(7,16,32,0.98)',
                  border:`1px solid ${activeGameDef?.color||'rgba(255,255,255,0.1)'}30`,
                  borderRadius:24, overflow:'hidden', display:'flex', flexDirection:'column',
                  boxShadow:`0 40px 90px rgba(0,0,0,0.8), 0 0 0 1px rgba(255,255,255,0.04)`
                }}>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'12px 18px 0',flexShrink:0}}>
                  <div style={{display:'flex',alignItems:'center',gap:9}}>
                    <span style={{fontSize:22}}>{activeGameDef?.emoji}</span>
                    <div>
                      <p style={{fontSize:14,fontWeight:800,color:'var(--text-1)',letterSpacing:'-0.02em'}}>{activeGameDef?.name}</p>
                      <p style={{fontSize:9.5,color:'var(--text-3)'}}>Interaction data feeds your behavioral health profile</p>
                    </div>
                  </div>
                  <button onClick={()=>setActiveGame(null)} style={{width:30,height:30,borderRadius:'50%',background:'rgba(255,255,255,0.06)',border:'1px solid var(--border)',display:'flex',alignItems:'center',justifyContent:'center',color:'var(--text-3)',cursor:'pointer'}}>
                    <X size={13}/>
                  </button>
                </div>
                <div style={{flex:1,overflow:'hidden',display:'flex',flexDirection:'column',minHeight:0}}>
                  <ActiveGameComponent onSessionEnd={handleGameSessionEnd}/>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body
      )}

      {/* Toast */}
      <AnimatePresence>
        {reportMsg&&(
          <motion.div initial={{opacity:0,y:20}} animate={{opacity:1,y:0}} exit={{opacity:0,y:20}}
            style={{position:'fixed',bottom:22,left:'50%',transform:'translateX(-50%)',zIndex:600,
              background:'rgba(6,14,30,0.97)',backdropFilter:'blur(20px)',border:'1px solid rgba(0,229,255,0.22)',
              borderRadius:13,padding:'10px 20px',fontSize:12.5,color:'#80deea',fontWeight:600,boxShadow:'0 8px 32px rgba(0,0,0,0.5)'}}>
            {reportMsg}
          </motion.div>
        )}
      </AnimatePresence>
      <style>{`@keyframes flameFlicker{0%{height:20px;opacity:0.62;transform:scaleX(0.78) skewX(-4deg);}50%{height:36px;opacity:1;transform:scaleX(1.12) skewX(3deg);}100%{height:17px;opacity:0.52;transform:scaleX(0.85) skewX(-6deg);}}`}</style>
    </div>
  );
}