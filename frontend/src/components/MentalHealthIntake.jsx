// frontend/src/components/MentalHealthIntake.jsx
// First-run intake: identifies user profile for personalization.
//
// Uses validated screening language for question framing:
//   GAD-2 style → Anxiety profile
//   PHQ-2 style → Depression / Low Mood profile
//   ASRS-lite   → ADHD / Focus profile
//   Maslach CBI → Burnout / Overwhelm profile
//
// This is NOT a diagnostic tool — it personalizes UX only.
// The profile is stored in localStorage and Zustand.
// Users can retake at any time by clicking the profile badge in the nav.

import { useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowRight, Check, ChevronRight, SkipForward } from 'lucide-react';
import useStore from '../store/useStore.js';

/* ── Profile definitions ─────────────────────────────────────────────── */
export const PROFILES = {
  anxiety: {
    id:          'anxiety',
    label:       'Anxiety & Worry',
    emoji:       '😰',
    color:       '#00e5ff',
    glow:        'rgba(0,229,255,0.3)',
    bg:          'rgba(0,229,255,0.07)',
    border:      'rgba(0,229,255,0.22)',
    description: 'Racing thoughts, worry spirals, physical tension',
    tagline:     "Aura reads the acoustic signature of your anxiety — not just your words. Let's start by lowering the nervous system's baseline.",
    primaryTab:  'voice',
    recommendedFeatures: [
      { label: 'Aura Voice',      detail: 'Emotion-adaptive AI that meets you mid-panic' },
      { label: 'Breathe Flow',    detail: '4-2-4 guided breathing to lower cortisol' },
      { label: 'Squeeze Release', detail: 'Somatic tension release — no talking required' },
    ],
    // GAD-2 inspired
    questions: [
      'How often do you find it difficult to stop or control your worrying?',
      'How often does anxiety interfere with things you need to do?',
      'When anxious thoughts start, how quickly do they tend to escalate?',
    ],
  },

  depression: {
    id:          'depression',
    label:       'Low Mood & Energy',
    emoji:       '😔',
    color:       '#c4b5fd',
    glow:        'rgba(196,181,253,0.3)',
    bg:          'rgba(196,181,253,0.07)',
    border:      'rgba(196,181,253,0.22)',
    description: 'Feeling flat, low motivation, withdrawing from life',
    tagline:     'Tiny wins rebuild momentum. Aura breaks every goal into 2-minute steps so the first one is almost effortless.',
    primaryTab:  'shatter',
    recommendedFeatures: [
      { label: 'Task Shatterer', detail: 'Micro-wins that rebuild dopamine incrementally' },
      { label: 'Word Smash',     detail: 'Physically destroy the negative self-talk' },
      { label: 'Cognitive Forge',detail: 'Offload mental weight into something you can burn' },
    ],
    // PHQ-2 inspired
    questions: [
      'How often have you felt little interest or pleasure in doing things you used to enjoy?',
      'How often have you felt down, hopeless, or emotionally flat?',
      'How hard is it to start tasks that you know actually matter to you?',
    ],
  },

  adhd: {
    id:          'adhd',
    label:       'Focus & ADHD',
    emoji:       '⚡',
    color:       '#ffb300',
    glow:        'rgba(255,179,0,0.3)',
    bg:          'rgba(255,179,0,0.07)',
    border:      'rgba(255,179,0,0.22)',
    description: 'Difficulty focusing, task-switching, executive dysfunction',
    tagline:     "AuraOS was built for your brain. Task Shatter eliminates the 'where do I even start' freeze — one micro-step at a time.",
    primaryTab:  'shatter',
    recommendedFeatures: [
      { label: 'Task Shatterer', detail: 'Blocker-aware ADHD coach with body-double mode' },
      { label: 'Number Dash',    detail: 'Schulte table — trains directed attention in 30-second rounds' },
      { label: 'Brown Noise',    detail: 'Scientifically-backed ADHD focus aid, built in' },
    ],
    // ASRS-lite inspired
    questions: [
      'How often do you start tasks but struggle to see them through to completion?',
      'How much does background noise or environmental clutter affect your ability to work?',
      'How often does your brain feel "on" even when you want to slow down or rest?',
    ],
  },

  burnout: {
    id:          'burnout',
    label:       'Overwhelm & Burnout',
    emoji:       '🔥',
    color:       '#ff6b8a',
    glow:        'rgba(255,107,138,0.3)',
    bg:          'rgba(255,107,138,0.07)',
    border:      'rgba(255,107,138,0.22)',
    description: 'Too much on your plate, running on empty, task paralysis',
    tagline:     'Drag your worries into the fire. Literally. The Forge converts abstract overwhelm into physics objects you can destroy.',
    primaryTab:  'forge',
    recommendedFeatures: [
      { label: 'Cognitive Forge',  detail: 'AI extracts worries from your stream-of-consciousness text' },
      { label: 'Breathe Flow',     detail: 'Parasympathetic reset between heavy tasks' },
      { label: 'Guardian Alerts',  detail: 'Auto-notify your support network during stress spikes' },
    ],
    // Maslach CBI inspired
    questions: [
      'How often do you feel like your responsibilities are piling up beyond what you can manage?',
      'How well are you managing to mentally switch off between work and rest?',
      'How often do you feel like you are running on fumes — even after sleeping?',
    ],
  },
};

/* ── Frequency scale (shared across all profiles) ─────────────────────── */
const FREQUENCY = [
  { label: 'Rarely',        value: 1 },
  { label: 'Sometimes',     value: 2 },
  { label: 'Often',         value: 3 },
  { label: 'Almost always', value: 4 },
];

/* ── Severity from average score ──────────────────────────────────────── */
const getSeverity = (avg) => {
  if (avg >= 3.5) return { label: 'High',     color: '#ff6b8a' };
  if (avg >= 2.5) return { label: 'Moderate', color: '#ffb300' };
  return               { label: 'Mild',      color: '#00e676' };
};

/* ── Slide animation variants ─────────────────────────────────────────── */
// Uses `direction` from AnimatePresence custom prop so forward/back
// slides come from the correct side.
const slideVariants = {
  enter:  (dir) => ({ opacity: 0, x: dir > 0 ? 40 : -40 }),
  center: { opacity: 1, x: 0 },
  exit:   (dir) => ({ opacity: 0, x: dir > 0 ? -40 : 40 }),
};
const slideTransition = { duration: 0.28, ease: [0.4, 0, 0.2, 1] };

/* ═══════════════════════════════════════════════════════════════════════════
   MAIN COMPONENT
═══════════════════════════════════════════════════════════════════════════ */
export default function MentalHealthIntake({ onComplete }) {
  // step: 0 = select concern, 1 = 3 questions, 2 = profile reveal
  const [step,      setStep]      = useState(0);
  const [profileId, setProfileId] = useState(null);
  const [answers,   setAnswers]   = useState([]);
  const [qIndex,    setQIndex]    = useState(0);
  const [direction, setDirection] = useState(1);  // 1=forward, -1=backward

  const setBaselineArousalScore = useStore((s) => s.setBaselineArousalScore);

  const profile  = profileId ? PROFILES[profileId] : null;
  const avgScore = answers.length ? answers.reduce((a, b) => a + b, 0) / answers.length : 0;
  const severity = getSeverity(avgScore);

  // Support keyboard navigation on the answer buttons
  useEffect(() => {
    if (step !== 1) return;
    const handler = (e) => {
      const idx = ['1', '2', '3', '4'].indexOf(e.key);
      if (idx !== -1) handleAnswer(FREQUENCY[idx].value);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [step, qIndex]); // eslint-disable-line react-hooks/exhaustive-deps

  const selectProfile = useCallback((id) => {
    setProfileId(id);
    setAnswers([]);
    setQIndex(0);
    setDirection(1);
    setStep(1);
  }, []);

  const handleAnswer = useCallback((value) => {
    const next = [...answers, value];
    setAnswers(next);
    if (qIndex < 2) {
      setDirection(1);
      setQIndex((q) => q + 1);
    } else {
      setDirection(1);
      setStep(2);
    }
  }, [answers, qIndex]);

  const goBack = useCallback(() => {
    setDirection(-1);
    setProfileId(null);
    setAnswers([]);
    setQIndex(0);
    setStep(0);
  }, []);

  const finish = useCallback(() => {
    // Compute baseline arousal score (1–10) from intake answers and push to store.
    // setBaselineArousalScore also auto-sets isHighAnxietyMode: true when score > 7.
    const baselineArousalScore = setBaselineArousalScore(avgScore);

    onComplete({
      profileId:            profile.id,
      severity:             severity.label.toLowerCase(),
      avgScore,
      primaryTab:           profile.primaryTab,
      baselineArousalScore, // consumed by LangChain clinical report service
    });
  }, [profile, severity, avgScore, onComplete, setBaselineArousalScore]);

  const skip = useCallback(() => {
    // Default to burnout/forge so the app is immediately usable
    onComplete({ profileId: 'burnout', severity: 'mild', avgScore: 2, primaryTab: 'forge' });
  }, [onComplete]);

  return (
    /* Full-screen overlay — position:fixed is correct here because this
       renders in the real React DOM (not Claude's artifact sandbox).
       The z-index of 2000 sits above all other UI (nav: 100, modals: 500). */
    <div style={{
      position: 'fixed', inset: 0, zIndex: 2000,
      background: profileId
        ? `radial-gradient(ellipse 120% 60% at 50% 0%, ${PROFILES[profileId].glow.replace('0.3', '0.5')} 0%, transparent 60%), #020915`
        : 'radial-gradient(ellipse 120% 60% at 50% 0%, rgba(0,60,110,0.8) 0%, transparent 60%), #020915',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      /* Allow internal scroll on very short screens / small mobile */
      overflowY: 'auto',
      padding: '60px 16px 40px',
      transition: 'background 0.6s ease',
    }}>

      {/* ── Progress bar (top edge) ── */}
      <div style={{ position: 'fixed', top: 0, left: 0, right: 0, height: 3, background: 'rgba(255,255,255,0.05)', zIndex: 1 }}>
        <motion.div
          animate={{ width: `${(step / 2) * 100}%` }}
          transition={{ duration: 0.5, ease: 'easeInOut' }}
          style={{ height: '100%', background: profile?.color || '#00e5ff', borderRadius: '0 2px 2px 0', transition: 'background 0.4s' }}
        />
      </div>

      {/* ── Step dots ── */}
      <div style={{ position: 'fixed', top: 16, left: '50%', transform: 'translateX(-50%)', display: 'flex', gap: 8, zIndex: 2 }}>
        {[0, 1, 2].map((i) => (
          <div key={i} style={{
            height: 8,
            width:  i === step ? 22 : 8,
            borderRadius: 999,
            background: i <= step ? (profile?.color || '#00e5ff') : 'rgba(255,255,255,0.1)',
            transition: 'all 0.35s ease',
          }} />
        ))}
      </div>

      {/* ── Skip button (top right) ── */}
      <button
        onClick={skip}
        style={{
          position: 'fixed', top: 12, right: 16, zIndex: 3,
          display: 'flex', alignItems: 'center', gap: 5,
          fontSize: 12, color: '#4a6275',
          background: 'none', border: 'none', cursor: 'pointer',
          fontFamily: 'inherit', padding: '4px 8px',
        }}>
        <SkipForward size={12} /> Skip
      </button>

      {/* ── Animated step content ── */}
      <AnimatePresence mode="wait" custom={direction}>

        {/* ─ STEP 0: Select your primary concern ─────────────────── */}
        {step === 0 && (
          <motion.div
            key="step-0"
            custom={direction} variants={slideVariants}
            initial="enter" animate="center" exit="exit"
            transition={slideTransition}
            style={{ width: '100%', maxWidth: 600, textAlign: 'center' }}>

            <motion.span
              animate={{ scale: [1, 1.07, 1] }}
              transition={{ duration: 3.5, repeat: Infinity, ease: 'easeInOut' }}
              style={{ display: 'inline-block', fontSize: 48, marginBottom: 20 }}>
              🧠
            </motion.span>

            <h1 style={{
              fontSize: 'clamp(22px, 4vw, 30px)', fontWeight: 800,
              letterSpacing: '-0.04em', color: '#e8f4fb', marginBottom: 10,
            }}>
              What brings you to AuraOS?
            </h1>
            <p style={{
              fontSize: 14, color: '#8bafc2', lineHeight: 1.7,
              marginBottom: 28, maxWidth: 420, marginLeft: 'auto', marginRight: 'auto',
            }}>
              Two minutes. No right answers. This helps us tailor features,
              language, and exercises to your actual experience.
            </p>

            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
              gap: 12, textAlign: 'left',
            }}>
              {Object.values(PROFILES).map((p) => (
                <motion.button
                  key={p.id}
                  onClick={() => selectProfile(p.id)}
                  whileHover={{ scale: 1.02, borderColor: p.color }}
                  whileTap={{ scale: 0.97 }}
                  style={{
                    padding: '18px 16px', borderRadius: 18,
                    border: `1px solid ${p.border}`,
                    background: p.bg, cursor: 'pointer',
                    display: 'flex', alignItems: 'flex-start', gap: 14,
                    fontFamily: 'inherit', textAlign: 'left',
                    transition: 'border-color 0.2s, background 0.2s',
                  }}>
                  <span style={{ fontSize: 30, lineHeight: 1, flexShrink: 0, marginTop: 2 }}>
                    {p.emoji}
                  </span>
                  <div style={{ minWidth: 0 }}>
                    <p style={{ fontSize: 14, fontWeight: 800, color: p.color, marginBottom: 4, letterSpacing: '-0.02em' }}>
                      {p.label}
                    </p>
                    <p style={{ fontSize: 12, color: '#4a6275', lineHeight: 1.5 }}>
                      {p.description}
                    </p>
                  </div>
                </motion.button>
              ))}
            </div>

            <p style={{ marginTop: 22, fontSize: 11, color: '#4a6275', lineHeight: 1.6 }}>
              For personalization only — not a medical assessment.
              AuraOS supports; it does not diagnose.
            </p>
          </motion.div>
        )}

        {/* ─ STEP 1: 3 quick frequency questions ─────────────────── */}
        {step === 1 && profile && (
          <motion.div
            key={`step-1-q${qIndex}`}
            custom={direction} variants={slideVariants}
            initial="enter" animate="center" exit="exit"
            transition={slideTransition}
            style={{ width: '100%', maxWidth: 480, textAlign: 'center' }}>

            <span style={{ fontSize: 40, display: 'block', marginBottom: 14 }}>
              {profile.emoji}
            </span>

            <p style={{
              fontSize: 11, color: profile.color, fontWeight: 700,
              textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 22,
            }}>
              Question {qIndex + 1} of 3
            </p>

            <h2 style={{
              fontSize: 'clamp(17px, 3.5vw, 22px)',
              fontWeight: 800, color: '#e8f4fb',
              letterSpacing: '-0.03em', lineHeight: 1.4,
              marginBottom: 30,
            }}>
              {profile.questions[qIndex]}
            </h2>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {FREQUENCY.map((opt) => (
                <motion.button
                  key={opt.value}
                  onClick={() => handleAnswer(opt.value)}
                  whileHover={{ scale: 1.015, background: profile.bg, borderColor: profile.color }}
                  whileTap={{ scale: 0.97 }}
                  style={{
                    padding: '14px 20px', borderRadius: 14,
                    border: `1px solid ${profile.border}`,
                    background: 'rgba(255,255,255,0.025)',
                    cursor: 'pointer',
                    color: '#e8f4fb', fontSize: 14.5, fontWeight: 600,
                    fontFamily: 'inherit',
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    transition: 'all 0.15s',
                    textAlign: 'left',
                  }}>
                  <span>{opt.label}</span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 11, color: '#4a6275', fontWeight: 500 }}>
                      Press {opt.value}
                    </span>
                    <ChevronRight size={14} color={profile.color} />
                  </span>
                </motion.button>
              ))}
            </div>

            <button
              onClick={goBack}
              style={{
                marginTop: 22, fontSize: 12, color: '#4a6275',
                background: 'none', border: 'none', cursor: 'pointer',
                fontFamily: 'inherit',
              }}>
              ← Back
            </button>
          </motion.div>
        )}

        {/* ─ STEP 2: Profile reveal ───────────────────────────────── */}
        {step === 2 && profile && (
          <motion.div
            key="step-2"
            custom={1} variants={slideVariants}
            initial="enter" animate="center"
            transition={slideTransition}
            style={{ width: '100%', maxWidth: 520, textAlign: 'center' }}>

            <motion.span
              initial={{ scale: 0.4, opacity: 0 }}
              animate={{ scale: 1,   opacity: 1 }}
              transition={{ type: 'spring', stiffness: 220, damping: 16, delay: 0.1 }}
              style={{ display: 'inline-block', fontSize: 54, marginBottom: 18 }}>
              {profile.emoji}
            </motion.span>

            {/* Severity + profile badge */}
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.22 }}>
              <span style={{
                display: 'inline-block',
                padding: '5px 16px', borderRadius: 999,
                background: profile.bg, border: `1px solid ${profile.border}`,
                fontSize: 11, fontWeight: 700,
                color: profile.color, textTransform: 'uppercase',
                letterSpacing: '0.1em', marginBottom: 18,
              }}>
                {severity.label} · {profile.label}
              </span>
            </motion.div>

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3 }}>
              <h2 style={{
                fontSize: 'clamp(19px, 3.5vw, 25px)',
                fontWeight: 800, color: '#e8f4fb',
                letterSpacing: '-0.04em', lineHeight: 1.25, marginBottom: 12,
              }}>
                AuraOS is now personalised for you.
              </h2>
              <p style={{
                fontSize: 14, color: '#8bafc2', lineHeight: 1.75,
                maxWidth: 400, margin: '0 auto 24px',
              }}>
                {profile.tagline}
              </p>
            </motion.div>

            {/* Recommended features */}
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.38 }}
              style={{
                background: 'rgba(255,255,255,0.025)',
                border: `1px solid ${profile.border}`,
                borderRadius: 20, padding: '18px 22px',
                marginBottom: 22, textAlign: 'left',
              }}>
              <p style={{
                fontSize: 10.5, color: profile.color,
                fontWeight: 700, textTransform: 'uppercase',
                letterSpacing: '0.1em', marginBottom: 16,
              }}>
                Recommended for your profile
              </p>
              {profile.recommendedFeatures.map((f, i) => (
                <div key={i} style={{
                  display: 'flex', gap: 12,
                  marginBottom: i < profile.recommendedFeatures.length - 1 ? 13 : 0,
                }}>
                  <div style={{
                    width: 24, height: 24, borderRadius: '50%', flexShrink: 0,
                    background: profile.bg, border: `1px solid ${profile.border}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <Check size={12} color={profile.color} />
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <p style={{ fontSize: 13, fontWeight: 700, color: '#e8f4fb', marginBottom: 2 }}>
                      {f.label}
                    </p>
                    <p style={{ fontSize: 11.5, color: '#4a6275', lineHeight: 1.45 }}>
                      {f.detail}
                    </p>
                  </div>
                </div>
              ))}
            </motion.div>

            {/* Disclaimer */}
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.46 }}
              style={{ fontSize: 11.5, color: '#4a6275', marginBottom: 22, lineHeight: 1.65 }}>
              This personalization is based on self-reported preferences, not a clinical
              diagnosis. You can retake this anytime by clicking your profile badge in the nav.
              If you are experiencing a crisis, please reach out to a mental health professional.
            </motion.p>

            {/* CTA button */}
            <motion.button
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.52, type: 'spring', stiffness: 200, damping: 16 }}
              onClick={finish}
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              style={{
                width: '100%', padding: '18px', borderRadius: 16,
                border: 'none',
                background: `linear-gradient(135deg, ${profile.color}bb, ${profile.color})`,
                color: '#020915', fontFamily: 'inherit',
                fontSize: 16, fontWeight: 800,
                letterSpacing: '-0.025em', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
                boxShadow: `0 8px 32px ${profile.glow}`,
              }}>
              Enter AuraOS <ArrowRight size={18} />
            </motion.button>
          </motion.div>
        )}

      </AnimatePresence>
    </div>
  );
}