// src/physics/engine.js
// Initialises the Matter.js world for the Cognitive Forge canvas.
// v2.0 — Shelf staging area + confetti destruction + brutalist text rendering

import Matter from 'matter-js';
import confetti from 'canvas-confetti';

const { Engine, Render, Runner, World, Bodies, Events } = Matter;

// Weight (1-10) → block width in pixels
export const weightToWidth  = (w) => 90 + w * 18;
// Brutalist dark fills — heavy and aggressive
export const weightToColor  = (w) => {
  if (w >= 8) return '#dc2626';   // red – high urgency
  if (w >= 5) return '#d97706';   // amber – medium
  return '#6d28d9';               // purple – lower
};

/**
 * Creates and starts a Matter.js world bound to a canvas element.
 *
 * @param {HTMLCanvasElement} canvas
 * @param {(bodyLabel: string) => void} onBlockDestroyed
 *   Called when a worry block falls into the fireplace sensor.
 *
 * @returns {{ engine, render, runner, world }}
 */
export const initEngine = (canvas, onBlockDestroyed) => {
  const W = canvas.width;
  const H = canvas.height;

  const engine = Engine.create({ gravity: { x: 0, y: 1.2 } }); // heavier gravity
  const { world } = engine;

  const render = Render.create({
    canvas,
    engine,
    options: {
      width: W,
      height: H,
      background: 'transparent',
      wireframes: false,
      pixelRatio: window.devicePixelRatio || 1,
    },
  });

  // ── Static walls ───────────────────────────────────────────────────────────
  const wallOpts = { isStatic: true, render: { fillStyle: 'transparent' }, label: 'wall' };
  World.add(world, [
    Bodies.rectangle(W / 2, H + 25, W, 50, wallOpts),  // floor (hidden, below canvas)
    Bodies.rectangle(-25,   H / 2, 50, H, wallOpts),   // left wall
    Bodies.rectangle(W + 25, H / 2, 50, H, wallOpts),  // right wall
  ]);

  // ── Safe Shelf (staging area) ─────────────────────────────────────────────
  // Blocks land here and SIT. Users must drag them off to drop into fire.
  const shelfY = Math.round(H * 0.55);
  const shelfW = W - 100;
  const shelf = Bodies.rectangle(W / 2, shelfY, shelfW, 10, {
    isStatic: true,
    label: 'shelf',
    render: {
      fillStyle: 'rgba(255,255,255,0.08)',
      strokeStyle: 'rgba(255,255,255,0.18)',
      lineWidth: 1,
    },
  });
  World.add(world, shelf);

  // ── Fireplace sensor ───────────────────────────────────────────────────────
  // Invisible sensor; the visual fireplace is drawn in React DOM
  const fireplace = Bodies.rectangle(W / 2, H - 14, W - 80, 36, {
    isStatic: true,
    isSensor: true,
    label: 'fireplace',
    render: { fillStyle: 'transparent', strokeStyle: 'transparent' },
  });
  World.add(world, fireplace);

  // ── Collision: block enters fireplace → confetti + destroy ─────────────────
  Events.on(engine, 'collisionStart', ({ pairs }) => {
    pairs.forEach(({ bodyA, bodyB }) => {
      const block =
        bodyA.label === 'fireplace' ? bodyB :
        bodyB.label === 'fireplace' ? bodyA : null;

      if (block && block.label !== 'fireplace' && block.label !== 'wall' && block.label !== 'shelf') {
        // Explosion confetti at the block's position
        const canvasRect = canvas.getBoundingClientRect();
        const bx = (canvasRect.left + block.position.x) / window.innerWidth;
        const by = (canvasRect.top + block.position.y) / window.innerHeight;
        confetti({
          particleCount: 25,
          spread: 60,
          origin: { x: Math.min(1, Math.max(0, bx)), y: Math.min(1, Math.max(0, by)) },
          colors: ['#ff6b8a', '#ffb300', '#c4b5fd', '#00e676'],
          ticks: 50,
          gravity: 1.2,
          scalar: 0.8,
          startVelocity: 15,
        });

        World.remove(world, block);
        onBlockDestroyed?.(block.worryUuid);
      }
    });
  });

  // ── Custom render: draw worry text on each block (BRUTALIST style) ─────────
  Events.on(render, 'afterRender', () => {
    const ctx = render.context;

    // Draw shelf label
    ctx.save();
    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    ctx.font = '600 9px Inter, monospace';
    ctx.textAlign = 'center';
    ctx.fillText('▼ DRAG BLOCKS DOWN TO INCINERATE ▼', W / 2, shelfY + 22);
    ctx.restore();

    world.bodies.forEach((body) => {
      if (body.label === 'wall' || body.label === 'fireplace' || body.label === 'shelf' || !body.worryText) return;

      ctx.save();
      ctx.translate(body.position.x, body.position.y);
      ctx.rotate(body.angle);

      // BRUTALIST: bold uppercase white text
      const text = body.worryText.toUpperCase();
      const maxWidth = body.worryWidth - 16;

      ctx.fillStyle = 'rgba(255,255,255,0.95)';
      ctx.font = '900 13px Inter, monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      // Simple line-break: if text too long, split roughly in half
      if (ctx.measureText(text).width > maxWidth) {
        const words = text.split(' ');
        const mid = Math.ceil(words.length / 2);
        const line1 = words.slice(0, mid).join(' ');
        const line2 = words.slice(mid).join(' ');
        ctx.fillText(line1, 0, -8);
        ctx.fillText(line2, 0, 8);
      } else {
        ctx.fillText(text, 0, 0);
      }

      ctx.restore();
    });
  });

  const runner = Runner.create();
  Render.run(render);
  Runner.run(runner, engine);

  return { engine, render, runner, world };
};

/**
 * Stops the engine and renderer cleanly.
 */
export const destroyEngine = (render, runner) => {
  Render.stop(render);
  Runner.stop(runner);
};