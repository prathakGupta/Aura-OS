// src/hooks/usePhysics.js
import { useRef, useCallback, useEffect } from 'react';
import Matter from 'matter-js';
import confetti from 'canvas-confetti';

export default function usePhysics(canvasRef, onBlockDestroyed) {
  const engineRef = useRef(null);
  const renderRef = useRef(null);
  const runnerRef = useRef(null);
  const boundaryRef = useRef([]);

  const init = useCallback(() => {
    if (!canvasRef.current || engineRef.current) return;

    const engine = Matter.Engine.create({ gravity: { x: 0, y: 1.2 } });
    const { world } = engine;
    const container = canvasRef.current;
    
    // Initial size
    let width = container.clientWidth || 800;
    const height = 440; // Default physics height mapping

    const render = Matter.Render.create({
      element: container,
      engine: engine,
      options: {
        width,
        height,
        wireframes: false,
        background: 'transparent',
        pixelRatio: Math.min(window.devicePixelRatio || 1, 2)
      }
    });

    const runner = Matter.Runner.create();

    const rebuildBoundaries = (w, h) => {
      if (boundaryRef.current.length > 0) {
        Matter.Composite.remove(world, boundaryRef.current);
      }
      
      const shelf = Matter.Bodies.rectangle(w / 2, h - 110, w * 0.7, 20, {
        isStatic: true,
        label: 'boundary',
        render: { fillStyle: 'rgba(255, 255, 255, 0.05)', strokeStyle: 'rgba(255, 255, 255, 0.1)', lineWidth: 1 },
        chamfer: { radius: 10 }
      });

      const firePit = Matter.Bodies.rectangle(w / 2, h - 20, w * 1.5, 60, {
        isStatic: true,
        isSensor: true,
        label: 'incinerator',
        render: { visible: false }
      });

      const leftWall = Matter.Bodies.rectangle(-25, h / 2, 50, h * 2, { isStatic: true, label: 'boundary' });
      const rightWall = Matter.Bodies.rectangle(w + 25, h / 2, 50, h * 2, { isStatic: true, label: 'boundary' });
      const ceiling = Matter.Bodies.rectangle(w / 2, -200, w * 2, 50, { isStatic: true, label: 'boundary' });
      
      boundaryRef.current = [shelf, firePit, leftWall, rightWall, ceiling];
      Matter.World.add(world, boundaryRef.current);
    };

    rebuildBoundaries(width, height);

    // Active Dragging configuration
    const mouse = Matter.Mouse.create(render.canvas);
    
    // IMPORTANT: Sync mouse object with retina pixelRatio!
    mouse.pixelRatio = render.options.pixelRatio;

    const mouseConstraint = Matter.MouseConstraint.create(engine, {
      mouse: mouse,
      constraint: {
        stiffness: 0.18,
        damping: 0.22,
        render: { visible: true, lineWidth: 1, strokeStyle: 'rgba(251,191,36,0.3)' }
      }
    });

    render.mouse = mouse;
    Matter.World.add(world, mouseConstraint);

    // Collision Detection
    Matter.Events.on(engine, 'collisionStart', (event) => {
      event.pairs.forEach(({ bodyA, bodyB }) => {
        const isIncType = bodyA.label === 'incinerator' || bodyB.label === 'incinerator';
        if (!isIncType) return;
        
        const block = bodyA.label === 'worry_block' ? bodyA : bodyB.label === 'worry_block' ? bodyB : null;
        if (block && !block.plugin?.consumed) {
          if (!block.plugin) block.plugin = {};
          block.plugin.consumed = true;
          
          Matter.Composite.remove(world, block);
          
          if (render.canvas) {
            const rect = render.canvas.getBoundingClientRect();
            const sx = rect.left + block.position.x * (rect.width / render.options.width);
            const sy = rect.top + block.position.y * (rect.height / render.options.height);
            
            confetti({
              particleCount: 25,
              spread: 60,
              origin: { x: sx / window.innerWidth, y: sy / window.innerHeight },
              colors: ['#f97316', '#f59e0b', '#67e8f9', '#c4b5fd'],
              ticks: 85,
              gravity: 0.5,
              scalar: 0.8,
              startVelocity: 18
            });
          }

          if (onBlockDestroyed) onBlockDestroyed(block.plugin.uuid);
        }
      });
    });

    // Label Rendering
    Matter.Events.on(render, 'afterRender', () => {
      const ctx = render.context;
      Matter.Composite.allBodies(world).forEach((body) => {
        if (body.label === 'worry_block' && body.plugin?.text) {
          ctx.save();
          ctx.translate(body.position.x, body.position.y);
          ctx.rotate(body.angle);
          ctx.font = '600 15px "Plus Jakarta Sans", system-ui, sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillStyle = body.plugin.labelColor || 'rgba(255,241,242,0.95)';
          ctx.shadowColor = 'rgba(0,0,0,0.5)';
          ctx.shadowBlur = 6;
          ctx.fillText(body.plugin.text, 0, 0);
          ctx.restore();
        }
      });
    });

    // Sync Size logic so pointer hits are perfectly aligned
    const syncSize = () => {
      const cw = container.clientWidth || 800;
      if (render.options.width === cw) return;
      
      render.options.width = cw;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      render.canvas.width = cw * dpr;
      render.canvas.height = height * dpr;
      render.canvas.style.width = '100%';
      render.canvas.style.height = `${height}px`;
      
      // Update the mouse mapping coordinates directly to the new canvas size
      Matter.Mouse.setElement(mouse, render.canvas);
      
      rebuildBoundaries(cw, height);
    };

    syncSize();

    let resizeObserver = null;
    if (typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(syncSize);
      resizeObserver.observe(container);
    } else {
      window.addEventListener('resize', syncSize);
    }

    // Attach observer to render object for cleanup
    render.resizeObserver = resizeObserver;

    Matter.Render.run(render);
    Matter.Runner.run(runner, engine);

    engineRef.current = engine;
    renderRef.current = render;
    runnerRef.current = runner;
  }, [canvasRef, onBlockDestroyed]);

  const spawnWords = useCallback((wordsArray) => {
    if (!engineRef.current || !renderRef.current) return;
    const world = engineRef.current.world;
    const width = renderRef.current.options.width;

    wordsArray.forEach((word, index) => {
      setTimeout(() => {
        // Spawn slightly offset from center
        const x = (width / 2) + ((Math.random() - 0.5) * (width * 0.4));
        const y = -60 - Math.random() * 40;
        const blockW = Math.max(70, word.length * 15 + 20);
        const weight = Math.floor(Math.random() * 4) + 4; 
        
        const block = Matter.Bodies.rectangle(x, y, blockW, 46, {
          label: 'worry_block',
          restitution: 0.12,
          frictionAir: 0.04,
          friction: 0.85,
          density: 0.006 + weight * 0.0003,
          chamfer: { radius: 10 },
          render: {
            fillStyle: '#1e3a5f',
            strokeStyle: 'rgba(103,232,249,0.3)',
            lineWidth: 1.5
          }
        });
        
        block.plugin = {
          kind: 'worry_block',
          text: word,
          labelColor: '#cffafe',
          uuid: `word-${Date.now()}-${index}`,
          consumed: false
        };
        
        Matter.Body.setAngularVelocity(block, (Math.random() - 0.5) * 0.06);
        Matter.World.add(world, block);
      }, index * 180);
    });
  }, []);

  const clearAll = useCallback(() => {
    if (!engineRef.current) return;
    const world = engineRef.current.world;
    const bodies = Matter.Composite.allBodies(world).filter(b => b.label === 'worry_block');
    bodies.forEach(b => Matter.Composite.remove(world, b));
  }, []);

  useEffect(() => {
    return () => {
      if (renderRef.current) {
        if (renderRef.current.resizeObserver) {
          renderRef.current.resizeObserver.disconnect();
        } else {
          window.removeEventListener('resize', () => {});
        }
        Matter.Render.stop(renderRef.current);
        if (renderRef.current.canvas && renderRef.current.canvas.parentNode) {
          renderRef.current.canvas.parentNode.removeChild(renderRef.current.canvas);
        }
      }
      if (runnerRef.current) Matter.Runner.stop(runnerRef.current);
      if (engineRef.current) Matter.World.clear(engineRef.current.world, false);
      if (engineRef.current) Matter.Engine.clear(engineRef.current);
      
      engineRef.current = null;
      renderRef.current = null;
      runnerRef.current = null;
    };
  }, []);

  return { init, spawnWords, clearAll };
}