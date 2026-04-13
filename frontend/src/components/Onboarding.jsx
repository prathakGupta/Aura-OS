import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import useStore from '../store/useStore.js';

const ONBOARDING_QUESTIONS = [
  {
    id: 'sleep_quality',
    title: 'How would you describe your sleep recently?',
    options: [
      { label: 'Deep and restful', value: 10 },
      { label: 'Okay, but could be better', value: 7 },
      { label: 'Restless, frequent waking', value: 4 },
      { label: 'I barely sleep / insomnia', value: 1 },
    ],
  },
  {
    id: 'hydration_diet',
    title: 'How consistsent is your hydration and diet?',
    options: [
      { label: 'Very consistent', value: 10 },
      { label: 'Somewhat consistent', value: 7 },
      { label: 'Often forget to eat/drink', value: 4 },
      { label: 'Very irregular / poor diet', value: 1 },
    ],
  },
  {
    id: 'relationship_support',
    title: 'Do you feel supported by your relationships right now?',
    options: [
      { label: 'Strongly supported', value: 10 },
      { label: 'Adequately supported', value: 7 },
      { label: 'Feeling somewhat isolated', value: 4 },
      { label: 'Completely isolated', value: 1 },
    ],
  },
  {
    id: 'focus_duration',
    title: 'How long can you typically focus on a single task?',
    options: [
      { label: 'An hour or more', value: 10 },
      { label: 'Around 30 minutes', value: 7 },
      { label: '10-15 minutes max', value: 4 },
      { label: 'Constantly distracted', value: 1 },
    ],
  },
  {
    id: 'physical_anxiety',
    title: 'How often do you feel physical anxiety (tight chest, racing heart)?',
    options: [
      { label: 'Rarely or never', value: 10 },
      { label: 'Occasionally', value: 7 },
      { label: 'Often', value: 4 },
      { label: 'Almost constantly', value: 1 },
    ],
  },
  {
    id: 'energy_levels',
    title: 'Describe your daily energy levels.',
    options: [
      { label: 'High & sustained', value: 10 },
      { label: 'Variable', value: 7 },
      { label: 'Frequent crashes', value: 4 },
      { label: 'Constantly exhausted', value: 1 },
    ],
  },
  {
    id: 'overwhelm_frequency',
    title: 'How often do daily tasks feel completely overwhelming?',
    options: [
      { label: 'Rarely', value: 10 },
      { label: 'Sometimes', value: 7 },
      { label: 'Often', value: 4 },
      { label: 'Every single day', value: 1 },
    ],
  },
  {
    id: 'sensory_sensitivity',
    title: 'How sensitive are you currently to noise or bright lights?',
    options: [
      { label: 'Not sensitive', value: 10 },
      { label: 'Slightly sensitive', value: 7 },
      { label: 'Easily overstimulated', value: 4 },
      { label: 'Extremely overstimulated', value: 1 },
    ],
  },
  {
    id: 'movement_activity',
    title: 'How much physical movement/activity do you get?',
    options: [
      { label: 'Daily exercise', value: 10 },
      { label: 'Light movement often', value: 7 },
      { label: 'Mostly sedentary', value: 4 },
      { label: 'Completely inactive', value: 1 },
    ],
  },
  {
    id: 'emotional_regulation',
    title: 'How difficult is it to regulate your emotions right now?',
    options: [
      { label: 'Easy to stay calm', value: 10 },
      { label: 'Minor difficulties', value: 7 },
      { label: 'Frequent mood swings', value: 4 },
      { label: 'Highly reactive / volatile', value: 1 },
    ],
  }
];

export default function Onboarding({ onComplete }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const setBaselineAnswer = useStore((state) => state.setBaselineAnswer);

  const handleSelect = (questionId, value) => {
    // Save to global zustand store
    setBaselineAnswer(questionId, value);

    // Proceed to next question or complete
    if (currentIndex < ONBOARDING_QUESTIONS.length - 1) {
      setCurrentIndex((prev) => prev + 1);
    } else {
      onComplete?.();
    }
  };

  const currentQ = ONBOARDING_QUESTIONS[currentIndex];

  return (
    <div style={{ position: 'fixed', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#020915', color: '#e8f4fb', padding: 22 }}>
      
      {/* Progress tracking */}
      <div style={{ position: 'absolute', top: 40, width: '100%', maxWidth: 600, display: 'flex', gap: 6, padding: '0 20px' }}>
        {ONBOARDING_QUESTIONS.map((_, i) => (
          <div key={i} style={{ flex: 1, height: 4, borderRadius: 2, background: i <= currentIndex ? '#00e5ff' : 'rgba(255,255,255,0.1)', transition: 'background 0.3s ease' }} />
        ))}
      </div>

      <div style={{ width: '100%', maxWidth: 500, position: 'relative', minHeight: 400 }}>
        <AnimatePresence mode="wait">
          <motion.div
            key={currentQ.id}
            initial={{ opacity: 0, x: 40 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -40 }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
            style={{ width: '100%' }}
          >
            <h2 style={{ fontSize: 'clamp(24px, 4vw, 32px)', fontWeight: 800, marginBottom: 32, lineHeight: 1.3 }}>
              {currentQ.title}
            </h2>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {currentQ.options.map((opt, i) => (
                <motion.button
                  key={i}
                  onClick={() => handleSelect(currentQ.id, opt.value)}
                  whileHover={{ scale: 1.02, backgroundColor: 'rgba(0, 229, 255, 0.1)' }}
                  whileTap={{ scale: 0.98 }}
                  style={{
                    padding: '20px 24px',
                    borderRadius: 16,
                    border: '1px solid rgba(0, 229, 255, 0.2)',
                    background: 'rgba(2, 9, 21, 0.6)',
                    color: '#e8f4fb',
                    fontSize: 16,
                    fontWeight: 600,
                    textAlign: 'left',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    boxShadow: '0 4px 20px rgba(0, 0, 0, 0.2)',
                  }}
                >
                  {opt.label}
                </motion.button>
              ))}
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
