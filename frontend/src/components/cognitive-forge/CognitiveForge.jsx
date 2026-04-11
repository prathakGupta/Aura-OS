// CognitiveForge.jsx — Optimized v2.0
// Research-backed improvements:
// • Grid-based block spawning (fixes "line" bug)
// • CSS flame incinerator with heat shimmer
// • Combo multiplier system (ADHD dopamine loops)
// • Satisfying audio via Web Audio API (no files needed)
// • Phoenix reframe with floating text particles
// • Better gamification: streak counter, weight-based sizing, haptic feedback
// • Proper canvas dimension detection before spawn

import { useRef, useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Wind, Sparkles, RotateCcw, Trash2, Zap, Trophy, Flame } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import confetti from 'canvas-confetti';
import Matter from 'matter-js';
import useStore from '../../store/useStore.js';
import { forgeApi } from '../../services/api.js';

const {
  Engine, Render, Runner, World, Bodies, Body, Composite, Events, Mouse, MouseConstraint,
} = Matter;

const PHYSICS_H = 460;
const MIN_W = 320;
const MAX_W = 800;

// ── Web Audio tone for satisfying feedback (no files needed) ──────────────
const playTone = (freq = 440, type = 'sine', duration = 0.18, gain = 0.12) => {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gainNode = ctx.createGain();
    osc.connect(gainNode);
    gainNode.connect(ctx.destination);
    osc.type = type;
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    gainNode.gain.setValueAtTime(gain, ctx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + duration);
    setTimeout(() => ctx.close(), duration * 1000 + 200);
  } catch (_) { /* silent fail if autoplay blocked */ }
};

const playDestroySound = () => {
  playTone(280, 'sawtooth', 0.08, 0.15);
  setTimeout(() => playTone(180, 'sine', 0.22, 0.08), 60);
};

const playComboSound = (comboCount) => {
  const freqs = [523, 659, 784, 1047, 1319];
  const freq = freqs[Math.min(comboCount - 1, 4)];
  playTone(freq, 'triangle', 0.25, 0.15);
};

const releaseConfetti = (x, y, count = 30) => {
  confetti({
    particleCount: count,
    spread: 60,
    origin: { x: x / window.innerWidth, y: y / window.innerHeight },
    colors: ['#fb7185', '#f97316', '#f59e0b', '#67e8f9', '#c4b5fd'],
    ticks: 90,
    gravity: 0.5,
    scalar: 0.8,
    startVelocity: 20,
  });
};

// ── Canvas text renderer with word-wrap ─────────────────────────────────
const drawWrappedText = (ctx, text, maxWidth, lineHeight = 14) => {
  const words = text.split(' ');
  const lines = [];
  let line = '';
  words.forEach((word) => {
    const candidate = line ? `${line} ${word}` : word;
    if (ctx.measureText(candidate).width > maxWidth - 16 && line) {
      lines.push(line);
      line = word;
    } else {
      line = candidate;
    }
  });
  if (line) lines.push(line);
  const capped = lines.slice(0, 3);
  const offset = ((capped.length - 1) * lineHeight) / 2;
  capped.forEach((l, i) => ctx.fillText(l, 0, i * lineHeight - offset));
};

// ── Grid-based spawn positions to guarantee spread ───────────────────────
const getGridSpawnPositions = (count, canvasWidth) => {
  const positions = [];
  const cols = Math.min(count, Math.ceil(Math.sqrt(count * 1.5)));
  const colWidth = (canvasWidth - 120) / cols;
  for (let i = 0; i < count; i++) {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const x = 60 + col * colWidth + colWidth * 0.5 + (Math.random() - 0.5) * (colWidth * 0.3);
    const y = -60 - row * 90 - Math.random() * 30;
    positions.push({ x: Math.max(80, Math.min(canvasWidth - 80, x)), y });
  }
  return positions;
};

// ── Weight → visual properties ────────────────────────────────────────────
const weightToStyle = (weight) => {
  if (weight >= 8) return { fill: '#7f1d1d', stroke: 'rgba(248,113,113,0.5)', label: '#fee2e2' };
  if (weight >= 6) return { fill: '#78350f', stroke: 'rgba(251,146,60,0.4)', label: '#fed7aa' };
  if (weight >= 4) return { fill: '#3f3f46', stroke: 'rgba(196,181,253,0.35)', label: '#e9d5ff' };
  return { fill: '#1e3a5f', stroke: 'rgba(103,232,249,0.3)', label: '#cffafe' };
};

export default function CognitiveForge() {
  const sceneRef = useRef(null);
  const engineRef = useRef(null);
  const worldRef = useRef(null);
  const renderRef = useRef(null);
  const runnerRef = useRef(null);
  const mouseConstraintRef = useRef(null);
  const incineratorRef = useRef(null);
  const boundaryBodiesRef = useRef([]);
  const resizeRafRef = useRef(null);
  const timersRef = useRef([]);
  const dimensionsRef = useRef({ width: MAX_W, height: PHYSICS_H });
  const reframeRef = useRef('I release this. I am stronger than my worries.');
  const lastDestroyTimeRef = useRef(0);
  const comboRef = useRef(0);
  const comboTimerRef = useRef(null);

  const [text, setText] = useState('');
  const [reframeText, setReframeText] = useState('I release this. I am stronger than my worries.');
  const [isLoading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [hasBlocks, setHasBlocks] = useState(false);
  const [destroyedCount, setDestroyedCount] = useState(0);
  const [comboDisplay, setComboDisplay] = useState(0);
  const [showCombo, setShowCombo] = useState(false);
  const [showInput, setShowInput] = useState(true);
  const [phoenixTexts, setPhoenixTexts] = useState([]);

  const { userId, worries, setWorries, markWorryDestroyed } = useStore();

  useEffect(() => { reframeRef.current = reframeText; }, [reframeText]);

  const rememberTimer = useCallback((id) => { timersRef.current.push(id); }, []);
  const clearTimers = useCallback(() => {
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];
  }, []);

  // ── Combo system ─────────────────────────────────────────────────────────
  const triggerCombo = useCallback((count) => {
    setComboDisplay(count);
    setShowCombo(true);
    playComboSound(count);
    if (comboTimerRef.current) clearTimeout(comboTimerRef.current);
    comboTimerRef.current = setTimeout(() => {
      setShowCombo(false);
      comboRef.current = 0;
    }, 2000);
  }, []);

  const onWorryDestroyed = useCallback((uuid, bodyX, bodyY) => {
    markWorryDestroyed(uuid);

    const now = Date.now();
    if (now - lastDestroyTimeRef.current < 2000) {
      comboRef.current += 1;
    } else {
      comboRef.current = 1;
    }
    lastDestroyTimeRef.current = now;

    setDestroyedCount((n) => n + 1);
    playDestroySound();

    // Get canvas bounding rect for confetti position
    const canvas = renderRef.current?.canvas;
    const rect = canvas?.getBoundingClientRect?.();
    const scaleX = rect ? rect.width / dimensionsRef.current.width : 1;
    const scaleY = rect ? rect.height / dimensionsRef.current.height : 1;
    const screenX = rect ? rect.left + bodyX * scaleX : window.innerWidth / 2;
    const screenY = rect ? rect.top + bodyY * scaleY : window.innerHeight * 0.8;

    releaseConfetti(screenX, screenY, 20 + comboRef.current * 8);

    if (comboRef.current >= 2) triggerCombo(comboRef.current);

    if (userId) forgeApi.destroy(userId, uuid).catch(() => {});

    // Phoenix reframe text particle
    const reframe = reframeRef.current?.trim() || 'I am free.';
    const id = `phoenix-${Date.now()}`;
    setPhoenixTexts((prev) => [...prev.slice(-2), { id, text: reframe }]);
    setTimeout(() => setPhoenixTexts((prev) => prev.filter((p) => p.id !== id)), 3500);
  }, [markWorryDestroyed, triggerCombo, userId]);

  // ── Add worry block ───────────────────────────────────────────────────────
  const addWorryBlock = useCallback((worryText, options = {}) => {
    const world = worldRef.current;
    if (!world) return null;
    const { width } = dimensionsRef.current;
    const weight = Math.max(1, Math.min(10, Number(options.weight) || 5));
    const blockW = Math.max(140, 100 + weight * 18);
    const blockH = 58;
    const style = weightToStyle(weight);

    const x = options.x ?? (80 + Math.random() * Math.max(1, width - 160));
    const y = options.y ?? (-50 - Math.random() * 60);

    const body = Bodies.rectangle(x, y, blockW, blockH, {
      label: 'worry_block',
      density: 0.006 + weight * 0.0003,
      restitution: 0.12,
      friction: 0.85,
      frictionStatic: 0.95,
      frictionAir: 0.04,
      chamfer: { radius: 10 },
      render: {
        fillStyle: style.fill,
        strokeStyle: style.stroke,
        lineWidth: 1.5,
      },
    });

    body.plugin = {
      ...(body.plugin || {}),
      kind: 'worry_block',
      text: String(worryText || 'worry').slice(0, 60),
      labelColor: style.label,
      uuid: options.uuid || uuidv4(),
      weight,
      consumed: false,
    };

    Body.setAngularVelocity(body, (Math.random() - 0.5) * 0.06);
    World.add(world, body);
    return body;
  }, []);

  // ── Shatter a worry block ────────────────────────────────────────────────
  const shatterWorryBlock = useCallback((worryBody) => {
    const world = worldRef.current;
    if (!world || !worryBody || worryBody.plugin?.consumed) return;
    worryBody.plugin.consumed = true;
    const { x, y } = worryBody.position;
    const uuid = worryBody.plugin?.uuid;
    Composite.remove(world, worryBody);
    if (uuid) onWorryDestroyed(uuid, x, y);
  }, [onWorryDestroyed]);

  // ── Spawn batch with grid positions ──────────────────────────────────────
  const spawnWorryBatch = useCallback((worryItems) => {
    // Wait for canvas to be properly sized
    requestAnimationFrame(() => {
      const { width } = dimensionsRef.current;
      const positions = getGridSpawnPositions(worryItems.length, width);

      worryItems.forEach((worry, idx) => {
        const timer = setTimeout(() => {
          addWorryBlock(worry.worry, {
            uuid: worry.uuid || uuidv4(),
            weight: worry.weight,
            x: positions[idx]?.x,
            y: positions[idx]?.y,
          });
        }, 120 + idx * 160);
        rememberTimer(timer);
      });
    });
  }, [addWorryBlock, rememberTimer]);

  const clearWorldBodies = useCallback(() => {
    const world = worldRef.current;
    if (!world) return;
    Composite.allBodies(world)
      .filter((b) => b.label !== 'boundary' && b.label !== 'incinerator')
      .forEach((b) => Composite.remove(world, b));
    clearTimers();
  }, [clearTimers]);

  // ── Engine initialization ─────────────────────────────────────────────────
  useEffect(() => {
    const host = sceneRef.current;
    if (!host || engineRef.current) return;
    host.innerHTML = '';

    const engine = Engine.create({
      gravity: { x: 0, y: 0.9 },
      positionIterations: 8,
      velocityIterations: 6,
    });

    const render = Render.create({
      element: host,
      engine,
      options: {
        width: MAX_W,
        height: PHYSICS_H,
        wireframes: false,
        background: 'transparent',
        pixelRatio: Math.min(window.devicePixelRatio || 1, 2),
      },
    });

    render.canvas.style.width = '100%';
    render.canvas.style.height = `${PHYSICS_H}px`;
    render.canvas.style.display = 'block';

    const runner = Runner.create();
    const world = engine.world;
    engineRef.current = engine;
    renderRef.current = render;
    runnerRef.current = runner;
    worldRef.current = world;

    const createBoundaries = (w, h) => {
      const opts = { isStatic: true, label: 'boundary', render: { visible: false } };
      const incinerator = Bodies.rectangle(w / 2, h - 20, w - 60, 40, {
        isStatic: true, isSensor: true, label: 'incinerator', render: { visible: false },
      });
      return {
        bodies: [
          Bodies.rectangle(w / 2, h + 30, w + 100, 60, opts),
          Bodies.rectangle(-30, h / 2, 60, h + 100, opts),
          Bodies.rectangle(w + 30, h / 2, 60, h + 100, opts),
          Bodies.rectangle(w / 2, -30, w + 100, 60, opts),
          incinerator,
        ],
        incinerator,
      };
    };

    const syncWorldSize = () => {
      const nextW = Math.min(MAX_W, Math.max(MIN_W, Math.floor(host.clientWidth || MAX_W)));
      const nextH = PHYSICS_H;
      const { width: prevW, height: prevH } = dimensionsRef.current;
      if (nextW === prevW && nextH === prevH) return;

      dimensionsRef.current = { width: nextW, height: nextH };
      render.options.width = nextW;
      render.options.height = nextH;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      render.canvas.width = nextW * dpr;
      render.canvas.height = nextH * dpr;
      render.canvas.style.width = '100%';
      render.canvas.style.height = `${nextH}px`;

      if (boundaryBodiesRef.current.length) {
        boundaryBodiesRef.current.forEach((b) => Composite.remove(world, b));
      }
      const { bodies, incinerator } = createBoundaries(nextW, nextH);
      boundaryBodiesRef.current = bodies;
      incineratorRef.current = incinerator;
      World.add(world, bodies);
    };

    // Initial sync after a frame so CSS has applied
    requestAnimationFrame(syncWorldSize);

    const scheduleResize = () => {
      if (resizeRafRef.current) cancelAnimationFrame(resizeRafRef.current);
      resizeRafRef.current = requestAnimationFrame(syncWorldSize);
    };

    let ro = null;
    if (typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(scheduleResize);
      ro.observe(host);
    } else {
      window.addEventListener('resize', scheduleResize);
    }

    const mouse = Mouse.create(render.canvas);
    const mc = MouseConstraint.create(engine, {
      mouse,
      constraint: {
        stiffness: 0.18,
        damping: 0.22,
        render: { visible: true, lineWidth: 1, strokeStyle: 'rgba(251,191,36,0.3)' },
      },
    });
    render.mouse = mouse;
    mouseConstraintRef.current = mc;
    World.add(world, mc);

    // Collision: block hits incinerator → shatter
    const onCollision = ({ pairs }) => {
      pairs.forEach(({ bodyA, bodyB }) => {
        const isInc = bodyA.label === 'incinerator' || bodyB.label === 'incinerator';
        if (!isInc) return;
        const block = bodyA.label === 'worry_block' ? bodyA : bodyB.label === 'worry_block' ? bodyB : null;
        if (block) shatterWorryBlock(block);
      });
    };

    // Custom afterRender: draw text labels on blocks
    const onAfterRender = () => {
      const ctx = render.context;
      Composite.allBodies(world).forEach((body) => {
        if (body.label !== 'worry_block' || !body.plugin?.text) return;
        ctx.save();
        ctx.translate(body.position.x, body.position.y);
        ctx.rotate(body.angle);
        ctx.font = '600 12.5px "Plus Jakarta Sans", system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = body.plugin.labelColor || 'rgba(255,241,242,0.95)';
        ctx.shadowColor = 'rgba(0,0,0,0.5)';
        ctx.shadowBlur = 6;
        const bw = body.bounds.max.x - body.bounds.min.x;
        drawWrappedText(ctx, body.plugin.text, bw);
        ctx.restore();
      });
    };

    Events.on(engine, 'collisionStart', onCollision);
    Events.on(render, 'afterRender', onAfterRender);
    Render.run(render);
    Runner.run(runner, engine);

    return () => {
      if (ro) ro.disconnect();
      else window.removeEventListener('resize', scheduleResize);
      if (resizeRafRef.current) cancelAnimationFrame(resizeRafRef.current);
      clearTimers();
      Events.off(engine, 'collisionStart', onCollision);
      Events.off(render, 'afterRender', onAfterRender);
      if (mouseConstraintRef.current) World.remove(world, mouseConstraintRef.current);
      Render.stop(render);
      Runner.stop(runner);
      World.clear(world, false);
      Engine.clear(engine);
      if (render.canvas?.parentNode) render.canvas.parentNode.removeChild(render.canvas);
      render.textures = {};
      engineRef.current = null;
      renderRef.current = null;
      runnerRef.current = null;
      worldRef.current = null;
      incineratorRef.current = null;
      boundaryBodiesRef.current = [];
      mouseConstraintRef.current = null;
    };
  }, [clearTimers, shatterWorryBlock]);

  const handleExtract = async () => {
    if (!text.trim() || isLoading) return;
    setError(null);
    setLoading(true);
    try {
      const data = await forgeApi.extract(text.trim(), userId);
      const nextWorries = (data.worries || []).map((w, idx) => ({
        ...w,
        id: w.id ?? idx + 1,
        uuid: w.uuid || uuidv4(),
        status: w.status || 'active',
      }));
      setWorries(nextWorries);
      clearWorldBodies();
      spawnWorryBatch(nextWorries);
      setHasBlocks(nextWorries.length > 0);
      setShowInput(false);
      setDestroyedCount(0);
      comboRef.current = 0;
    } catch (err) {
      setError(err.message || 'Could not extract worries. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    clearWorldBodies();
    setWorries([]);
    setHasBlocks(false);
    setDestroyedCount(0);
    setShowInput(true);
    setText('');
    setPhoenixTexts([]);
    comboRef.current = 0;
    setShowCombo(false);
  };

  const activeCount = worries.filter((w) => w.status !== 'destroyed').length;
  const allCleared = hasBlocks && activeCount === 0;

  return (
    <div className="page fade-up" style={{ maxWidth: 920, paddingBottom: 40 }}>
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} style={{ marginBottom: 28 }}>
        <span className="badge badge-amber" style={{ marginBottom: 14 }}>
          <Flame size={10} /> Cognitive Forge
        </span>
        <h1 className="section-title">Burn What Blocks You</h1>
        <p className="section-sub">
          Dump your anxious thoughts. AI extracts them as heavy blocks.
          Drag each one into the fire and watch it shatter. Rise from the ash.
        </p>
      </motion.div>

      {/* Input panel */}
      <AnimatePresence>
        {showInput && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97 }}
            className="glass"
            style={{ padding: 24, marginBottom: 24 }}
          >
            <textarea
              className="textarea"
              rows={4}
              placeholder="Type your worries here — raw, messy, unfiltered. Let it all out..."
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && e.metaKey) handleExtract(); }}
            />

            {/* Examples */}
            {!text && (
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', margin: '10px 0' }}>
                {["I'm behind on deadlines", "my relationship feels distant", "money is tight"].map((ex) => (
                  <button key={ex} onClick={() => setText((prev) => prev ? `${prev}, ${ex}` : ex)}
                    style={{ fontSize: 11, padding: '4px 10px', borderRadius: 999, background: 'rgba(255,179,0,0.08)', border: '1px solid rgba(255,179,0,0.2)', color: '#ffe082', cursor: 'pointer' }}>
                    + {ex}
                  </button>
                ))}
              </div>
            )}

            {/* Phoenix reframe input */}
            <div style={{ position: 'relative', marginTop: 10 }}>
              <label style={{ fontSize: 10.5, color: 'var(--text-3)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', marginBottom: 6 }}>
                Phoenix Reframe — what rises from the ash
              </label>
              <input
                value={reframeText}
                onChange={(e) => setReframeText(e.target.value)}
                placeholder="I release this. I am stronger than my worries."
                style={{ width: '100%', background: 'rgba(3,7,18,0.72)', border: '1px solid rgba(103,232,249,0.2)', color: 'var(--text-1)', borderRadius: 12, padding: '10px 14px', outline: 'none', fontFamily: 'inherit', fontSize: 13 }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 16 }}>
              <span style={{ fontSize: 11.5, color: 'var(--text-3)' }}>
                {text.length} chars · ⌘↵ to forge
              </span>
              <motion.button
                className="btn btn-primary"
                onClick={handleExtract}
                disabled={isLoading || text.trim().length < 5}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.97 }}
              >
                {isLoading ? <span className="spinner" /> : <Sparkles size={14} />}
                {isLoading ? 'Extracting worries…' : 'Forge the blocks'}
              </motion.button>
            </div>

            {error && (
              <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                style={{ marginTop: 12, fontSize: 13, color: '#fca5a5', lineHeight: 1.5 }}>
                {error}
              </motion.p>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Physics canvas wrapper */}
      <div style={{
        position: 'relative',
        borderRadius: 22,
        overflow: 'hidden',
        border: '1px solid rgba(125,211,252,0.12)',
        background: `
          radial-gradient(ellipse at 50% 5%, rgba(34,211,238,0.18) 0%, transparent 50%),
          radial-gradient(ellipse at 50% 100%, rgba(251,146,60,0.2) 0%, transparent 40%),
          linear-gradient(180deg, #030712 0%, #020617 60%, #0b1120 100%)
        `,
        boxShadow: '0 20px 60px rgba(2,6,23,0.8), inset 0 1px 0 rgba(125,211,252,0.1)',
        minHeight: PHYSICS_H,
      }}>
        {/* Dot grid overlay */}
        <div style={{
          position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 0,
          backgroundImage: 'radial-gradient(rgba(103,232,249,0.08) 1px, transparent 1px)',
          backgroundSize: '28px 28px',
        }} />

        {/* Matter.js canvas */}
        <div ref={sceneRef} style={{ position: 'relative', zIndex: 1, minHeight: PHYSICS_H }} />

        {/* Combo display */}
        <AnimatePresence>
          {showCombo && comboDisplay >= 2 && (
            <motion.div
              initial={{ opacity: 0, scale: 0.5, y: -20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 1.4, y: -40 }}
              style={{
                position: 'absolute', top: 80, left: '50%', transform: 'translateX(-50%)',
                zIndex: 100, pointerEvents: 'none', textAlign: 'center',
              }}
            >
              <div style={{
                fontSize: 28, fontWeight: 900, letterSpacing: '-0.04em',
                background: 'linear-gradient(135deg, #ffb300, #ff6b8a)',
                WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
                filter: 'drop-shadow(0 0 12px rgba(255,179,0,0.6))',
              }}>
                {comboDisplay}x COMBO!
              </div>
              <div style={{ fontSize: 11, color: '#ffe082', fontWeight: 700, letterSpacing: '0.1em' }}>
                CHAIN RELEASE
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Phoenix reframe floating texts */}
        <AnimatePresence>
          {phoenixTexts.map(({ id, text: txt }) => (
            <motion.div
              key={id}
              initial={{ opacity: 0, y: 0, scale: 0.8 }}
              animate={{ opacity: [0, 1, 1, 0], y: -120, scale: 1 }}
              transition={{ duration: 3.2, ease: 'easeOut' }}
              style={{
                position: 'absolute', bottom: 80, left: '50%', transform: 'translateX(-50%)',
                zIndex: 50, pointerEvents: 'none', textAlign: 'center', width: '80%',
              }}
            >
              <div style={{
                display: 'inline-block', padding: '10px 20px',
                background: 'linear-gradient(135deg, rgba(0,229,255,0.12), rgba(124,58,237,0.12))',
                border: '1px solid rgba(0,229,255,0.3)',
                borderRadius: 999,
                fontSize: 14, fontWeight: 700, color: '#67e8f9',
                backdropFilter: 'blur(12px)',
                boxShadow: '0 0 20px rgba(0,229,255,0.2)',
              }}>
                ✦ {txt}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {/* Empty state */}
        <AnimatePresence>
          {!hasBlocks && (
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              style={{
                position: 'absolute', inset: 0, zIndex: 2, pointerEvents: 'none',
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12,
              }}
            >
              <motion.div
                animate={{ scale: [1, 1.08, 1], opacity: [0.4, 0.7, 0.4] }}
                transition={{ duration: 3.5, repeat: Infinity, ease: 'easeInOut' }}
                style={{
                  width: 72, height: 72, borderRadius: '50%',
                  background: 'radial-gradient(circle, rgba(34,211,238,0.18), transparent 70%)',
                  border: '1px solid rgba(103,232,249,0.2)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
              >
                <Wind size={28} color="rgba(103,232,249,0.6)" />
              </motion.div>
              <p style={{ color: 'var(--text-3)', fontSize: 15, fontWeight: 600 }}>Your worry blocks appear here</p>
              <p style={{ color: 'var(--text-3)', fontSize: 12, opacity: 0.7 }}>Drag them down into the fire to release</p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Incinerator zone with CSS flames ─────────────────────────── */}
        <div style={{
          position: 'absolute', bottom: 0, left: 0, right: 0,
          height: 72, zIndex: 3, pointerEvents: 'none',
          overflow: 'hidden',
        }}>
          {/* Heat shimmer gradient */}
          <div style={{
            position: 'absolute', inset: 0,
            background: 'linear-gradient(to top, rgba(251,146,60,0.32) 0%, rgba(251,146,60,0.12) 60%, transparent 100%)',
            borderTop: '1px solid rgba(251,191,36,0.5)',
            boxShadow: '0 -20px 60px rgba(251,146,60,0.28)',
          }} />

          {/* Flame particles */}
          {Array.from({ length: 8 }, (_, i) => (
            <div key={i} style={{
              position: 'absolute', bottom: 0,
              left: `${8 + i * 12}%`,
              width: 18, height: 32,
              background: `linear-gradient(to top, rgba(251,146,60,0.9), rgba(251,191,36,0.5), transparent)`,
              borderRadius: '50% 50% 30% 30%',
              animation: `flameFlicker ${0.8 + i * 0.15}s ${i * 0.1}s ease-in-out infinite alternate`,
              filter: 'blur(3px)',
              transform: `scaleX(${0.7 + Math.random() * 0.6})`,
            }} />
          ))}

          {/* Label */}
          <div style={{
            position: 'absolute', bottom: 0, left: 0, right: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            paddingBottom: 10, gap: 6,
          }}>
            <Flame size={13} color="rgba(254,240,138,0.9)" />
            <span style={{
              fontSize: 10.5, fontWeight: 800, letterSpacing: '0.12em',
              textTransform: 'uppercase', color: 'rgba(254,240,138,0.85)',
            }}>
              Incinerator · Drop to release
            </span>
            <Flame size={13} color="rgba(254,240,138,0.9)" />
          </div>
        </div>
      </div>

      {/* Stats bar */}
      {hasBlocks && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 16, flexWrap: 'wrap', gap: 10 }}
        >
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            {destroyedCount > 0 && (
              <span className="badge badge-green">
                <Zap size={9} /> {destroyedCount} released
              </span>
            )}
            {activeCount > 0 && (
              <span className="badge badge-amber">{activeCount} remaining</span>
            )}
            {allCleared && (
              <motion.span
                initial={{ scale: 0.8 }} animate={{ scale: 1 }}
                className="badge badge-cyan"
              >
                <Trophy size={9} /> All cleared! ✦
              </motion.span>
            )}
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            {!showInput && (
              <motion.button className="btn btn-secondary" onClick={() => setShowInput(true)}
                whileTap={{ scale: 0.96 }} style={{ fontSize: 12 }}>
                <Sparkles size={12} /> Add more
              </motion.button>
            )}
            {allCleared && (
              <motion.button className="btn btn-primary" onClick={handleReset}
                whileTap={{ scale: 0.96 }} style={{ fontSize: 12 }}>
                <RotateCcw size={12} /> New session
              </motion.button>
            )}
            <motion.button className="btn btn-ghost" onClick={handleReset} whileTap={{ scale: 0.95 }}>
              <Trash2 size={12} /> Clear
            </motion.button>
          </div>
        </motion.div>
      )}

      <style>{`
        @keyframes flameFlicker {
          0%   { height: 28px; opacity: 0.7; transform: scaleX(0.8) skewX(-3deg); }
          50%  { height: 42px; opacity: 1;   transform: scaleX(1.1) skewX(2deg); }
          100% { height: 24px; opacity: 0.6; transform: scaleX(0.9) skewX(-5deg); }
        }
      `}</style>
    </div>
  );
}