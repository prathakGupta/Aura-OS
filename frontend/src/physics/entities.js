// src/physics/entities.js
// Factory functions for Matter.js physics bodies used in Cognitive Forge.
// v2.0 — Per-word splitting + heavier physics + brutalist styling

import Matter from 'matter-js';
import { weightToWidth, weightToColor } from './engine.js';

const { Bodies, World } = Matter;

const BLOCK_HEIGHT = 48;

/**
 * Spawns a single word block into the Matter.js world.
 *
 * @param {object} world   - Matter.js world
 * @param {string} word    - Single word to display
 * @param {string} uuid    - Parent worry UUID
 * @param {number} weight  - Worry weight (1-10)
 * @param {number} canvasW - Canvas width
 * @param {number} spawnX  - Optional x position
 */
export const spawnWordBlock = (world, word, uuid, weight, canvasW, spawnX) => {
  // Size based on word length (min 60, max from weight)
  const blockW = Math.max(60, Math.min(weightToWidth(weight), word.length * 14 + 30));
  const color = weightToColor(weight);

  // Spawn position: use provided X or random in middle third
  const minX = blockW / 2 + 40;
  const maxX = canvasW - blockW / 2 - 40;
  const x = spawnX != null
    ? Math.max(minX, Math.min(maxX, spawnX))
    : minX + Math.random() * (maxX - minX);
  const y = -BLOCK_HEIGHT - Math.random() * 40; // spawn just above canvas

  const body = Bodies.rectangle(x, y, blockW, BLOCK_HEIGHT, {
    label: `worry-${uuid}-${word}`,
    restitution: 0.15,       // low bounce — heavy feel
    friction: 0.85,          // high friction — stays on shelf
    frictionAir: 0.03,
    density: 0.004,          // heavier blocks
    render: {
      fillStyle: '#1a1a2e',  // brutalist dark fill
      strokeStyle: color,
      lineWidth: 2.5,        // thick aggressive border
    },
  });

  // Attach custom metadata so the afterRender hook can draw the label
  body.worryUuid  = uuid;
  body.worryText  = word;
  body.worryWidth = blockW;
  body.weight     = weight;

  // Tiny random torque for natural tumbling
  Matter.Body.setAngularVelocity(body, (Math.random() - 0.5) * 0.04);

  World.add(world, body);
  return body;
};

/**
 * Spawns a single worry — split into individual word blocks.
 *
 * @param {object} world
 * @param {object} worry   - { uuid, worry, weight }
 * @param {number} canvasW
 */
export const spawnWorryBlock = (world, worry, canvasW) => {
  const words = (worry.worry || '').trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return;

  const spacing = Math.min(120, (canvasW - 160) / words.length);
  const startX = (canvasW - spacing * (words.length - 1)) / 2;

  words.forEach((word, i) => {
    const x = startX + i * spacing;
    setTimeout(() => {
      spawnWordBlock(world, word, worry.uuid, worry.weight, canvasW, x);
    }, i * 120); // staggered for dramatic effect
  });
};

/**
 * Spawns all worries from an array with staggered timing (visual drama).
 *
 * @param {object} world
 * @param {Array}  worries
 * @param {number} canvasW
 * @param {number} delayMs - Stagger delay between each worry group (ms)
 */
export const spawnAllWorries = (world, worries, canvasW, delayMs = 400) => {
  worries.forEach((worry, idx) => {
    setTimeout(() => {
      spawnWorryBlock(world, worry, canvasW);
    }, idx * delayMs);
  });
};

/**
 * Removes all worry blocks from the world (panic "destroy all" button).
 */
export const clearAllBlocks = (world) => {
  const toRemove = world.bodies.filter(
    (b) => b.label !== 'wall' && b.label !== 'fireplace' && b.label !== 'shelf'
  );
  World.remove(world, toRemove);
};