// frontend/src/components/PerceptionProbe.jsx
// Bistable illusion test measuring cognitive flexibility.
// Replaces the static "Breathe Flow" component.
//
// Correct latency logic:
//   - startTime is reset when user clicks FIRST interpretation
//   - latencyMs = time between 1st click and 2nd click (perspective switch)
//   - "I see both" immediately = high flexibility, latencyMs = 0

import { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import useStore from '../store/useStore.js';

const IMAGES = [
  {
    id: 'duck-rabbit',
    src: 'https://upload.wikimedia.org/wikipedia/commons/4/45/Duck-Rabbit_illusion.jpg',
    choices: ['Duck', 'Rabbit'],
    prompt: 'What do you see first?',
    hint: (seen) => `You saw the ${seen}. Can you find the ${seen === 'Duck' ? 'Rabbit' : 'Duck'}?`,
  },
  {
    id: 'old-young',
    src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/79/My_Wife_and_my_Mother-in-Law_%28Hill%29.svg/640px-My_Wife_and_my_Mother-in-Law_%28Hill%29.svg.png',
    choices: ['Young woman', 'Old woman'],
    prompt: 'Who do you see first?',
    hint: (seen) => `You saw the ${seen}. Can you now find the ${seen === 'Young woman' ? 'Old woman' : 'Young woman'}?`,
  },
  {
    id: 'vase-faces',
    src: 'https://upload.wikimedia.org/wikipedia/commons/thumb/e/e2/Rubins_vase.svg/640px-Rubins_vase.svg.png',
    choices: ['Faces', 'Vase'],
    prompt: 'What stands out to you first?',
    hint: (seen) => `You noticed the ${seen}. Can you see the ${seen === 'Faces' ? 'Vase' : 'Faces'} now?`,
  },
];

export default function PerceptionProbe({ onSessionEnd }) {
  const [currentIdx, setCurrentIdx] = useState(0);
  const [firstSeen, setFirstSeen] = useState(null);
  const switchStartRef = useRef(null); // timer starts when FIRST choice is made
  const gameStartRef = useRef(Date.now());

  const addProbeSession = useStore((s) => s.addProbeSession);

  const current = IMAGES[currentIdx];

  const logAndAdvance = (session) => {
    addProbeSession(session);
    const isLast = currentIdx >= IMAGES.length - 1;
    if (isLast) {
      const durationSeconds = Math.round((Date.now() - gameStartRef.current) / 1000);
      onSessionEnd?.({
        gameId: 'perception_probe',
        gameName: 'Perspective Shift',
        durationSeconds,
        interactions: IMAGES.length,
        avgReactionMs: session.latencyMs,
        accuracy: session.canSwitchPerspective ? 100 : 0,
        score: session.canSwitchPerspective ? 100 : 0
      });
    } else {
      setCurrentIdx((i) => i + 1);
      setFirstSeen(null);
      switchStartRef.current = null;
    }
  };

  const handleChoice = (choice) => {
    if (choice === 'both') {
      // Immediate "both" = maximum flexibility
      logAndAdvance({
        imageId: current.id,
        firstSeen: 'both',
        latencyMs: 0,
        canSwitchPerspective: true,
      });
      return;
    }

    if (!firstSeen) {
      // First click: register choice, start the switch timer
      setFirstSeen(choice);
      switchStartRef.current = Date.now();
    } else {
      // Second click: stop timer, compute latency
      const latencyMs = switchStartRef.current ? Date.now() - switchStartRef.current : 0;
      logAndAdvance({
        imageId: current.id,
        firstSeen,
        latencyMs,
        canSwitchPerspective: true, // they made the switch
      });
    }
  };

  const handleStuck = () => {
    // User can't switch — rigidity marker
    const latencyMs = switchStartRef.current ? Date.now() - switchStartRef.current : 0;
    logAndAdvance({
      imageId: current.id,
      firstSeen,
      latencyMs: latencyMs + 20000, // penalize — treat as 20s+ rigidity
      canSwitchPerspective: false,
    });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', width: '100%', maxWidth: 560, margin: '0 auto', padding: '16px 20px', gap: 16, height: '100%', overflowY: 'auto' }}>
      {/* Step indicator */}
      <div style={{ display: 'flex', gap: 6, width: '100%', flexShrink: 0 }}>
        {IMAGES.map((_, i) => (
          <div key={i} style={{ flex: 1, height: 3, borderRadius: 2, background: i <= currentIdx ? 'var(--cyan)' : 'var(--border)', transition: 'background 0.3s ease' }} />
        ))}
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={current.id}
          initial={{ opacity: 0, x: 32 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -32 }}
          transition={{ duration: 0.28, ease: 'easeOut' }}
          style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 16, flex: 1, minHeight: 0 }}
        >
          <p style={{ fontSize: 20, fontWeight: 800, color: 'var(--text-1)', textAlign: 'center', lineHeight: 1.3, flexShrink: 0, margin: 0 }}>
            {!firstSeen ? current.prompt : current.hint(firstSeen)}
          </p>

          {/* Image — responsive, no overflow */}
          <div style={{ width: '100%', borderRadius: 16, overflow: 'hidden', background: 'rgba(255,255,255,0.95)', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1, minHeight: 0 }}>
            <img
              src={current.src}
              alt="Bistable illusion"
              style={{ width: '100%', height: '100%', maxHeight: 280, objectFit: 'contain', display: 'block' }}
            />
          </div>

          {/* Buttons */}
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center', flexShrink: 0 }}>
            {!firstSeen ? (
              <>
                {current.choices.map((c) => (
                  <motion.button key={c} onClick={() => handleChoice(c)} whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }}
                    style={{ flex: 1, minWidth: 110, padding: '16px 20px', borderRadius: 14, border: '1px solid var(--border-h)', background: 'var(--bg-glass)', color: 'var(--text-1)', fontSize: 15, fontWeight: 700, cursor: 'pointer' }}>
                    {c}
                  </motion.button>
                ))}
                <motion.button onClick={() => handleChoice('both')} whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }}
                  style={{ width: '100%', padding: '14px 20px', borderRadius: 14, border: '1px solid rgba(0,229,255,0.3)', background: 'rgba(0,229,255,0.08)', color: 'var(--cyan)', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
                  ✦ I see both immediately
                </motion.button>
              </>
            ) : (
              <>
                {current.choices.filter((c) => c !== firstSeen).map((c) => (
                  <motion.button key={c} onClick={() => handleChoice(c)} whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
                    style={{ flex: 1, padding: '16px 20px', borderRadius: 14, border: '1px solid rgba(0,229,255,0.35)', background: 'rgba(0,229,255,0.09)', color: 'var(--cyan)', fontSize: 15, fontWeight: 700, cursor: 'pointer' }}>
                    I see the {c} now!
                  </motion.button>
                ))}
                <motion.button onClick={handleStuck} whileTap={{ scale: 0.97 }}
                  style={{ width: '100%', padding: '12px 20px', borderRadius: 12, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-3)', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                  I can't see the other one — skip
                </motion.button>
              </>
            )}
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
