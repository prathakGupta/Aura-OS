import { useRef, useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Wind, Sparkles, RotateCcw, Trash2 } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import confetti from 'canvas-confetti';
import Matter from 'matter-js';
import useStore from '../../store/useStore.js';
import { forgeApi } from '../../services/api.js';

const {
  Engine,
  Render,
  Runner,
  World,
  Bodies,
  Body,
  Composite,
  Events,
  Mouse,
  MouseConstraint,
} = Matter;

const PHYSICS_H = 440;
const MIN_W = 320;
const MAX_W = 760;

const releaseConfetti = () => {
  confetti({
    particleCount: 42,
    spread: 56,
    origin: { x: 0.5, y: 0.94 },
    colors: ['#fb7185', '#f97316', '#f59e0b', '#facc15', '#67e8f9'],
    ticks: 100,
    gravity: 0.45,
    scalar: 0.72,
    startVelocity: 18,
  });
};

const drawWrappedText = (ctx, text, maxWidth, lineHeight = 15) => {
  const words = text.split(' ');
  const lines = [];
  let line = '';

  words.forEach((word) => {
    const candidate = line ? `${line} ${word}` : word;
    if (ctx.measureText(candidate).width > maxWidth && line) {
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
  const reframeRef = useRef('I am capable and prepared.');

  const [text, setText] = useState('');
  const [reframeText, setReframeText] = useState('I am capable and prepared.');
  const [isLoading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [hasBlocks, setHasBlocks] = useState(false);
  const [destroyedCount, setDestroyedCount] = useState(0);
  const [showInput, setShowInput] = useState(true);

  const { userId, worries, setWorries, markWorryDestroyed } = useStore();

  useEffect(() => {
    reframeRef.current = reframeText;
  }, [reframeText]);

  const rememberTimer = useCallback((timerId) => {
    timersRef.current.push(timerId);
  }, []);

  const clearTimers = useCallback(() => {
    timersRef.current.forEach((timerId) => clearTimeout(timerId));
    timersRef.current = [];
  }, []);

  const onWorryDestroyed = useCallback((uuid) => {
    markWorryDestroyed(uuid);
    setDestroyedCount((n) => n + 1);
    releaseConfetti();
    if (userId) forgeApi.destroy(userId, uuid).catch(() => {});
  }, [markWorryDestroyed, userId]);

  const addWorryBlock = useCallback((worryText, options = {}) => {
    const world = worldRef.current;
    if (!world) return null;

    const { width } = dimensionsRef.current;
    const weight = Math.max(1, Math.min(10, Number(options.weight) || 6));
    const blockW = Math.max(140, 96 + weight * 20);
    const blockH = 60;

    const minX = blockW / 2 + 26;
    const maxX = width - blockW / 2 - 26;
    const x = minX + Math.random() * Math.max(8, maxX - minX);
    const y = -40 - Math.random() * 70;

    const fill = weight >= 8 ? '#7f1d1d' : weight >= 5 ? '#78350f' : '#3f3f46';

    const body = Bodies.rectangle(x, y, blockW, blockH, {
      label: 'worry_block',
      density: 0.005 + weight * 0.00035,
      restitution: 0.08,
      friction: 0.88,
      frictionStatic: 1,
      frictionAir: 0.045,
      chamfer: { radius: 10 },
      render: {
        fillStyle: fill,
        strokeStyle: 'rgba(252,165,165,0.35)',
        lineWidth: 1.5,
      },
    });

    body.plugin = {
      ...(body.plugin || {}),
      kind: 'worry_block',
      text: String(worryText || 'untitled worry'),
      uuid: options.uuid || uuidv4(),
      weight,
      consumed: false,
    };

    Body.setAngularVelocity(body, (Math.random() - 0.5) * 0.05);
    World.add(world, body);
    return body;
  }, []);

  const spawnLetterParticles = useCallback(({ sourceText, x, y, type, groupId, spread = 1 }) => {
    const world = worldRef.current;
    if (!world) return [];

    const letters = [...String(sourceText || '')];
    const created = [];

    letters.forEach((char) => {
      if (char === ' ') return;

      const radius = type === 'negative_letter'
        ? 6 + Math.random() * 2
        : 5 + Math.random() * 1.8;

      const body = Bodies.circle(
        x + (Math.random() - 0.5) * 18,
        y + (Math.random() - 0.5) * 12,
        radius,
        {
          label: type,
          restitution: type === 'negative_letter' ? 0.72 : 0.28,
          friction: 0.2,
          frictionAir: type === 'negative_letter' ? 0.03 : 0.12,
          density: type === 'negative_letter' ? 0.0018 : 0.0007,
          render: {
            fillStyle: type === 'negative_letter' ? '#7f1d1d' : '#083344',
            strokeStyle: type === 'negative_letter' ? '#fca5a5' : '#fef08a',
            lineWidth: 1,
          },
        }
      );

      body.plugin = {
        ...(body.plugin || {}),
        kind: type,
        char,
        groupId,
      };

      const velocity = type === 'negative_letter'
        ? {
            x: (Math.random() - 0.5) * 9 * spread,
            y: -(3 + Math.random() * 5),
          }
        : {
            x: (Math.random() - 0.5) * 2.4,
            y: -(0.8 + Math.random() * 1.6),
          };

      Body.setVelocity(body, velocity);
      Body.setAngularVelocity(body, (Math.random() - 0.5) * (type === 'negative_letter' ? 0.34 : 0.08));
      created.push(body);
    });

    if (created.length) World.add(world, created);
    return created;
  }, []);

  const spawnPhoenixLetters = useCallback(() => {
    const world = worldRef.current;
    if (!world) return;

    const positiveText = (reframeRef.current || '').trim() || 'I can handle this moment.';
    const { width, height } = dimensionsRef.current;
    const groupId = `phoenix-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

    const letters = spawnLetterParticles({
      sourceText: positiveText,
      x: width / 2,
      y: height - 52,
      type: 'positive_letter',
      groupId,
      spread: 0.5,
    });

    const cleanup = setTimeout(() => {
      const latestWorld = worldRef.current;
      if (!latestWorld) return;
      letters.forEach((body) => Composite.remove(latestWorld, body));
    }, 5000);

    rememberTimer(cleanup);
  }, [rememberTimer, spawnLetterParticles]);

  const shatterWorryBlock = useCallback((worryBody) => {
    const world = worldRef.current;
    if (!world || !worryBody || worryBody.plugin?.consumed) return;

    worryBody.plugin.consumed = true;

    const { x, y } = worryBody.position;
    const worryText = worryBody.plugin?.text || 'stress';
    const uuid = worryBody.plugin?.uuid;

    Composite.remove(world, worryBody);
    if (uuid) onWorryDestroyed(uuid);

    const groupId = `ash-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

    spawnLetterParticles({
      sourceText: worryText,
      x,
      y,
      type: 'negative_letter',
      groupId,
      spread: 1,
    });

    const negativeCleanup = setTimeout(() => {
      const latestWorld = worldRef.current;
      if (!latestWorld) return;

      const negatives = Composite.allBodies(latestWorld).filter(
        (body) => body.label === 'negative_letter' && body.plugin?.groupId === groupId
      );

      negatives.forEach((body) => Composite.remove(latestWorld, body));
      spawnPhoenixLetters();
    }, 2500);

    rememberTimer(negativeCleanup);
  }, [onWorryDestroyed, rememberTimer, spawnLetterParticles, spawnPhoenixLetters]);

  const spawnWorryBatch = useCallback((worryItems) => {
    worryItems.forEach((worry, idx) => {
      const timer = setTimeout(() => {
        addWorryBlock(worry.worry, {
          uuid: worry.uuid || uuidv4(),
          weight: worry.weight,
        });
      }, idx * 180);
      rememberTimer(timer);
    });
  }, [addWorryBlock, rememberTimer]);

  const clearWorldBodies = useCallback(() => {
    const world = worldRef.current;
    if (!world) return;

    const removable = Composite.allBodies(world).filter(
      (body) => body.label !== 'boundary' && body.label !== 'incinerator'
    );

    removable.forEach((body) => Composite.remove(world, body));
    clearTimers();
  }, [clearTimers]);

  useEffect(() => {
    const host = sceneRef.current;
    if (!host || engineRef.current) return;

    host.innerHTML = '';

    const engine = Engine.create({
      gravity: { x: 0, y: 0.86 },
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
        pixelRatio: window.devicePixelRatio || 1,
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

    const createBoundaries = (width, height) => {
      const boundaryOpts = {
        isStatic: true,
        label: 'boundary',
        render: { visible: false },
      };

      const incineratorBody = Bodies.rectangle(width / 2, height - 16, width - 70, 34, {
        isStatic: true,
        isSensor: true,
        label: 'incinerator',
        render: { visible: false },
      });

      const all = [
        Bodies.rectangle(width / 2, height + 26, width + 80, 52, boundaryOpts),
        Bodies.rectangle(-26, height / 2, 52, height + 60, boundaryOpts),
        Bodies.rectangle(width + 26, height / 2, 52, height + 60, boundaryOpts),
        Bodies.rectangle(width / 2, -26, width + 80, 52, boundaryOpts),
        incineratorBody,
      ];

      return { all, incineratorBody };
    };

    const syncWorldSize = () => {
      const nextWidth = Math.min(MAX_W, Math.max(MIN_W, Math.floor(host.clientWidth || MAX_W)));
      const nextHeight = Math.max(320, Math.min(PHYSICS_H, Math.round(nextWidth * 0.62)));
      const { width: prevW, height: prevH } = dimensionsRef.current;
      if (nextWidth === prevW && nextHeight === prevH) return;

      dimensionsRef.current = { width: nextWidth, height: nextHeight };

      render.options.width = nextWidth;
      render.options.height = nextHeight;
      render.canvas.width = nextWidth * (window.devicePixelRatio || 1);
      render.canvas.height = nextHeight * (window.devicePixelRatio || 1);
      render.canvas.style.width = '100%';
      render.canvas.style.height = `${nextHeight}px`;

      if (boundaryBodiesRef.current.length) {
        boundaryBodiesRef.current.forEach((body) => Composite.remove(world, body));
      }

      const { all, incineratorBody } = createBoundaries(nextWidth, nextHeight);
      boundaryBodiesRef.current = all;
      incineratorRef.current = incineratorBody;
      World.add(world, all);
    };

    syncWorldSize();

    const scheduleResize = () => {
      if (resizeRafRef.current) cancelAnimationFrame(resizeRafRef.current);
      resizeRafRef.current = requestAnimationFrame(syncWorldSize);
    };

    let resizeObserver = null;
    if (typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(scheduleResize);
      resizeObserver.observe(host);
    } else {
      window.addEventListener('resize', scheduleResize);
    }

    const mouse = Mouse.create(render.canvas);
    const mouseConstraint = MouseConstraint.create(engine, {
      mouse,
      constraint: {
        stiffness: 0.16,
        damping: 0.2,
        render: {
          visible: true,
          lineWidth: 1.2,
          strokeStyle: 'rgba(250,204,21,0.35)',
        },
      },
    });

    render.mouse = mouse;
    mouseConstraintRef.current = mouseConstraint;
    World.add(world, mouseConstraint);

    const collisionHandler = ({ pairs }) => {
      pairs.forEach(({ bodyA, bodyB }) => {
        const hitIncinerator =
          bodyA.label === 'incinerator' || bodyB.label === 'incinerator';
        if (!hitIncinerator) return;

        const worryBody = bodyA.label === 'worry_block'
          ? bodyA
          : bodyB.label === 'worry_block'
            ? bodyB
            : null;

        if (!worryBody) return;
        shatterWorryBlock(worryBody);
      });
    };

    const beforeUpdateHandler = () => {
      const positiveLetters = Composite.allBodies(world).filter(
        (body) => body.label === 'positive_letter'
      );

      positiveLetters.forEach((body) => {
        Body.applyForce(body, body.position, {
          x: (Math.random() - 0.5) * 0.000012,
          y: -0.00016,
        });

        if (body.velocity.y > -0.24) {
          Body.setVelocity(body, {
            x: body.velocity.x * 0.95,
            y: Math.min(body.velocity.y, -0.28),
          });
        }
      });
    };

    const afterRenderHandler = () => {
      const ctx = render.context;
      const bodies = Composite.allBodies(world);

      bodies.forEach((body) => {
        if (body.label === 'worry_block' && body.plugin?.text) {
          ctx.save();
          ctx.translate(body.position.x, body.position.y);
          ctx.rotate(body.angle);

          ctx.font = '600 13px "Trebuchet MS", "Segoe UI", sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillStyle = 'rgba(255,241,242,0.95)';
          ctx.shadowColor = 'rgba(244,63,94,0.35)';
          ctx.shadowBlur = 10;

          drawWrappedText(ctx, body.plugin.text, body.bounds.max.x - body.bounds.min.x - 20);
          ctx.restore();
          return;
        }

        if ((body.label === 'negative_letter' || body.label === 'positive_letter') && body.plugin?.char) {
          ctx.save();
          ctx.translate(body.position.x, body.position.y);
          ctx.rotate(body.angle);
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.font = '700 14px "Trebuchet MS", "Segoe UI", sans-serif';

          if (body.label === 'negative_letter') {
            ctx.fillStyle = '#fecaca';
            ctx.shadowColor = 'rgba(239,68,68,0.5)';
            ctx.shadowBlur = 8;
          } else {
            ctx.fillStyle = '#67e8f9';
            ctx.shadowColor = 'rgba(34,211,238,0.65)';
            ctx.shadowBlur = 11;
            ctx.strokeStyle = 'rgba(253,224,71,0.8)';
            ctx.lineWidth = 0.6;
            ctx.strokeText(body.plugin.char, 0, 0);
          }

          ctx.fillText(body.plugin.char, 0, 0);
          ctx.restore();
        }
      });
    };

    Events.on(engine, 'collisionStart', collisionHandler);
    Events.on(engine, 'beforeUpdate', beforeUpdateHandler);
    Events.on(render, 'afterRender', afterRenderHandler);

    Render.run(render);
    Runner.run(runner, engine);

    return () => {
      if (resizeObserver) resizeObserver.disconnect();
      else window.removeEventListener('resize', scheduleResize);
      if (resizeRafRef.current) {
        cancelAnimationFrame(resizeRafRef.current);
        resizeRafRef.current = null;
      }
      clearTimers();

      Events.off(engine, 'collisionStart', collisionHandler);
      Events.off(engine, 'beforeUpdate', beforeUpdateHandler);
      Events.off(render, 'afterRender', afterRenderHandler);

      if (mouseConstraintRef.current) {
        World.remove(world, mouseConstraintRef.current);
        mouseConstraintRef.current = null;
      }

      Render.stop(render);
      Runner.stop(runner);
      World.clear(world, false);
      Engine.clear(engine);

      if (render.canvas && render.canvas.parentNode) {
        render.canvas.parentNode.removeChild(render.canvas);
      }
      render.textures = {};

      incineratorRef.current = null;
      boundaryBodiesRef.current = [];
      worldRef.current = null;
      engineRef.current = null;
      renderRef.current = null;
      runnerRef.current = null;
    };
  }, [clearTimers, shatterWorryBlock]);

  const handleExtract = async () => {
    if (!text.trim() || isLoading) return;

    setError(null);
    setLoading(true);

    try {
      const data = await forgeApi.extract(text.trim(), userId);
      const nextWorries = (data.worries || []).map((worry, idx) => ({
        ...worry,
        id: worry.id ?? idx + 1,
        uuid: worry.uuid || uuidv4(),
        status: worry.status || 'active',
      }));

      setWorries(nextWorries);
      clearWorldBodies();
      spawnWorryBatch(nextWorries);

      setHasBlocks(nextWorries.length > 0);
      setShowInput(false);
    } catch (err) {
      setError(err.message || 'Failed to extract worries.');
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
  };

  const activeCount = worries.filter((w) => w.status !== 'destroyed').length;

  return (
    <div className="page fade-up" style={{ maxWidth: 900 }}>
      <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} style={{ marginBottom: 28 }}>
        <span className="badge badge-amber" style={{ marginBottom: 14 }}>
          <Wind size={10} />
          Cognitive Forge
        </span>
        <h1 className="section-title">Shatter and Rise</h1>
        <p className="section-sub">
          Cast anxieties into heavy blocks, burn them down to letters, then watch a Phoenix reframe rise from the ash.
        </p>
      </motion.div>

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
              rows={5}
              placeholder="Write the thought stream you want to transform."
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && e.metaKey) handleExtract(); }}
            />

            <input
              className="input"
              value={reframeText}
              onChange={(e) => setReframeText(e.target.value)}
              placeholder="Phoenix reframe text"
              style={{
                marginTop: 12,
                width: '100%',
                background: 'rgba(3, 7, 18, 0.72)',
                border: '1px solid rgba(103, 232, 249, 0.22)',
                color: 'var(--text-1)',
                borderRadius: 12,
                padding: '10px 12px',
                outline: 'none',
              }}
            />

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 14 }}>
              <span style={{ fontSize: 12.5, color: 'var(--text-3)', fontWeight: 500 }}>
                {text.length} chars | Cmd/Ctrl+Enter to forge
              </span>
              <motion.button
                className="btn btn-primary"
                onClick={handleExtract}
                disabled={isLoading || text.trim().length < 5}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.97 }}
              >
                {isLoading ? <span className="spinner" /> : <Sparkles size={14} />}
                {isLoading ? 'Forging...' : 'Extract and launch'}
              </motion.button>
            </div>

            {error && (
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                style={{ marginTop: 12, fontSize: 13, color: '#fca5a5', lineHeight: 1.5 }}
              >
                {error}
              </motion.p>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <div
        style={{
          position: 'relative',
          borderRadius: 22,
          overflow: 'hidden',
          border: '1px solid rgba(125, 211, 252, 0.15)',
          background: `
            radial-gradient(ellipse at 50% 18%, rgba(34, 211, 238, 0.2) 0%, transparent 54%),
            radial-gradient(ellipse at 50% 100%, rgba(251, 146, 60, 0.16) 0%, transparent 42%),
            linear-gradient(180deg, #030712 0%, #020617 58%, #0b1120 100%)
          `,
          boxShadow: '0 26px 60px rgba(2, 6, 23, 0.72), inset 0 1px 0 rgba(125,211,252,0.12)',
        }}
      >
        <div
          style={{
            position: 'absolute',
            inset: 0,
            pointerEvents: 'none',
            opacity: 0.08,
            backgroundImage: 'radial-gradient(rgba(103,232,249,1) 1px, transparent 1px)',
            backgroundSize: '26px 26px',
          }}
        />

        <div ref={sceneRef} style={{ position: 'relative', zIndex: 1, minHeight: PHYSICS_H }} />

        <AnimatePresence>
          {!hasBlocks && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              style={{
                position: 'absolute',
                inset: 0,
                zIndex: 2,
                pointerEvents: 'none',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 10,
              }}
            >
              <motion.div
                animate={{ scale: [1, 1.06, 1], opacity: [0.35, 0.55, 0.35] }}
                transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
                style={{
                  width: 64,
                  height: 64,
                  borderRadius: '50%',
                  background: 'radial-gradient(circle, rgba(34,211,238,0.2), transparent 72%)',
                  border: '1px solid rgba(103,232,249,0.22)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Wind size={22} color="rgba(103,232,249,0.7)" />
              </motion.div>
              <p style={{ color: 'var(--text-3)', fontSize: 14, fontWeight: 500 }}>Worry blocks appear here</p>
              <p style={{ color: 'var(--text-3)', fontSize: 12, opacity: 0.78 }}>Throw them into the incinerator</p>
            </motion.div>
          )}
        </AnimatePresence>

        <div
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            height: 66,
            zIndex: 3,
            pointerEvents: 'none',
            background: 'linear-gradient(to top, rgba(251,146,60,0.26) 0%, rgba(251,146,60,0.1) 56%, transparent 100%)',
            borderTop: '1px solid rgba(251,191,36,0.45)',
            boxShadow: '0 -18px 50px rgba(251,146,60,0.25)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            letterSpacing: '0.08em',
            color: 'rgba(254, 240, 138, 0.82)',
            fontSize: 11,
            textTransform: 'uppercase',
            fontWeight: 700,
          }}
        >
          Incinerator | Shatter then rise
        </div>
      </div>

      {hasBlocks && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 16 }}
        >
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            {destroyedCount > 0 && <span className="badge badge-green">{destroyedCount} reframed</span>}
            {activeCount > 0 && <span className="badge badge-cyan">{activeCount} active</span>}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {activeCount === 0 && (
              <motion.button
                className="btn btn-secondary"
                onClick={handleReset}
                whileTap={{ scale: 0.96 }}
                style={{ fontSize: 13 }}
              >
                <RotateCcw size={13} /> New session
              </motion.button>
            )}
            <motion.button className="btn btn-ghost" onClick={handleReset} whileTap={{ scale: 0.95 }}>
              <Trash2 size={13} /> Clear
            </motion.button>
          </div>
        </motion.div>
      )}
    </div>
  );
}
