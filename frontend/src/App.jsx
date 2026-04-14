// frontend/src/App.jsx
// Main shell with mental-health intake + corrected layout architecture.
//
// Bug fixes vs previous version:
//  1. Profile tab is set only ONCE (useRef guard) so resume-task tab wins
//  2. handleIntakeComplete respects active task resume (doesn't override its tab)
//  3. useEffect dependency arrays are correct (no eslint-disable needed)
//  4. ProfileBadge hides label on small screens via inline responsive styles
//  5. Loading state is centred properly inside the new content-scroll container

import { useEffect, useRef, useState, useMemo } from 'react';
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from './hooks/useAuth';
import AuthPage from './components/auth/AuthPage';
import GuardianDetails from './components/auth/GuardianDetails';
import GuardianInvite from './components/auth/GuardianInvite';
import ProfilePage from './components/auth/ProfilePage';
import GoodbyeScreen from './components/auth/GoodbyeScreen';
import ProtectedRoute from './components/auth/ProtectedRoute';
import ObserverPortal from './components/observer-portal/ObserverPortal';
import AdminDashboard from './components/admin/AdminDashboard';
import { motion, AnimatePresence } from 'framer-motion';
import { Mic, Wind, Zap, Sun, Moon, HeartPulse } from 'lucide-react';
import useStore from './store/useStore.js';
import { shatterApi, stateApi } from './services/api.js';
import ErrorBoundary        from './components/ErrorBoundary.jsx';
import AuraVoice            from './components/aura-voice/AuraVoice.jsx';
import CognitiveForge       from './components/cognitive-forge/CognitiveForge.jsx';
import TaskShatter          from './components/task-shatter/TaskShatter.jsx';
import ClinicalRecovery     from './components/clinical-rag/ClinicalRecovery.jsx';
import Dashboard            from './components/observer-portal/Dashboard.jsx';
import LandingPage          from './components/landing/LandingPage.jsx';
import MentalHealthIntake,
  { PROFILES }              from './components/MentalHealthIntake.jsx';

/* ── Nav tabs ───────────────────────────────────────────────── */
const TABS = [
  { id: 'voice',   label: 'Aura',    Icon: Mic,  color: '#00e5ff' },
  { id: 'forge',   label: 'Forge',   Icon: Wind, color: '#ffb300' },
  { id: 'shatter', label: 'Shatter', Icon: Zap,  color: '#c4b5fd' },
  { id: 'protocol',label: 'Protocol',Icon: HeartPulse, color: '#ff6b8a' },
];

/* ── Profile badge shown in the nav ─────────────────────────── */
function ProfileBadge({ profile, onReset }) {
  const p = PROFILES[profile?.profileId];
  if (!p) return null;
  return (
    <motion.button
      initial={{ opacity: 0, x: 10 }}
      animate={{ opacity: 1, x: 0 }}
      onClick={onReset}
      title={`Your profile: ${p.label}. Click to retake.`}
      className="glass"
      style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '5px 12px', borderRadius: 999,
        background: `${p.bg}12`, border: `1px solid ${p.border}30`,
        cursor: 'pointer', height: 36,
      }}>
      <span style={{ fontSize: 14 }}>{p.emoji}</span>
      <span
        className="nav-tab-label"
        style={{ fontSize: 11, fontWeight: 700, color: p.color, letterSpacing: '0.01em' }}>
        {p.label}
      </span>
    </motion.button>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   MAIN APP COMPONENT
   ═══════════════════════════════════════════════════════════════════════ */
export default function App() {
  const {
    activeTab, setTab,
    initSession, isInitialized, userId,
    setActiveTask,
    userProfile, setUserProfile, clearUserProfile,
  } = useStore();
  const { user, profile, onboardingComplete, role } = useAuth();
  const navigate = useNavigate();

  const isPortalView = typeof window !== 'undefined' && window.location.pathname.startsWith('/portal');

  const [initError,    setInitError]    = useState(false);
  const [resumeBanner, setResumeBanner] = useState(null);
  const [isDark, setIsDark] = useState(() => {
    const saved = localStorage.getItem('aura-theme');
    return saved !== null ? saved === 'dark' : true;
  });
  const [showLanding,  setShowLanding]  = useState(!isPortalView);
  const [showIntake,   setShowIntake]   = useState(false);

  // Ref so the profile-tab effect only fires once on mount,
  // not every time the profile object reference changes.
  const profileTabSetRef = useRef(false);

  /* ── Theme ── */
  useEffect(() => {
    document.documentElement.style.colorScheme = isDark ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
    localStorage.setItem('aura-theme', isDark ? 'dark' : 'light');
  }, [isDark]);

  /* ── Session init ── */
  useEffect(() => {
    if (isPortalView) return;
    const runInit = async () => {
      try {
        await initSession();
      } catch {
        setInitError(true);
      }
    };
    runInit();
  }, [initSession, isPortalView]);

  /* ── Show intake on first visit (no stored profile) ── */
  useEffect(() => {
    if (!isInitialized || isPortalView || showLanding) return;
    if (!userProfile) {
      const t = setTimeout(() => setShowIntake(true), 500);
      return () => clearTimeout(t);
    }
  }, [isInitialized, userProfile, isPortalView, showLanding]);

  /* ── Set default tab from profile — fires ONCE per session ── */
  useEffect(() => {
    if (
      isInitialized &&
      userProfile?.primaryTab &&
      !profileTabSetRef.current &&
      !resumeBanner
    ) {
      profileTabSetRef.current = true;
      setTab(userProfile.primaryTab);
    }
  }, [isInitialized, userProfile, resumeBanner, setTab]);

  /* ── Resume active task from previous session ── */
  useEffect(() => {
    if (!userId || !isInitialized) return;

    shatterApi.getActive(userId)
      .then((data) => {
        if (data?.activeTask) {
          setActiveTask(data.activeTask);
          setResumeBanner(data.activeTask.originalTask);
          setTab('shatter');
          // Profile tab guard: task resume already set tab, don't override
          profileTabSetRef.current = true;
          setTimeout(() => setResumeBanner(null), 5000);
        }
      })
      .catch(() => { /* non-fatal */ });
  }, [userId, isInitialized, isPortalView, setActiveTask, setTab]);

  /* ── Intake handlers ── */
  const handleIntakeComplete = (profileData) => {
    setUserProfile(profileData);
    setShowIntake(false);
    // Only set the profile's recommended tab if no task was resumed.
    if (!resumeBanner) {
      setTab(profileData.primaryTab || 'forge');
      profileTabSetRef.current = true;
    }
    // Persist baselineArousalScore to MongoDB (fire-and-forget; non-fatal).
    // The score is already in Zustand for immediate in-session use.
    if (userId && profileData.baselineArousalScore != null) {
      stateApi.patchIntake(userId, profileData.baselineArousalScore).catch(() => {});
    }
  };

  const handleRetakeIntake = () => {
    clearUserProfile();
    profileTabSetRef.current = false;
    setShowIntake(true);
  };

  /* ── Background gradient accent from user profile ── */
  const bodyAccentStyle = useMemo(() => {
    const profileColor = userProfile ? PROFILES[userProfile.profileId]?.glow : null;
    return profileColor ? { '--profile-glow': profileColor } : {};
  }, [userProfile]);

  if (showLanding) {
    return (
      <AnimatePresence mode="wait">
        <motion.div 
          key="landing" 
          initial={{opacity:0}} 
          animate={{opacity:1}} 
          exit={{opacity:0, y:-20}} 
          transition={{duration:0.4}} 
          style={{width:'100vw', minHeight:'100vh'}}
        >
          <LandingPage onLaunch={() => setShowLanding(false)} />
        </motion.div>
      </AnimatePresence>
    );
  }

  return (
    <Routes>
      {/* Public auth route */}
      <Route
  path="/auth"
  element={
    user && onboardingComplete
      ? <Navigate to={
          role === "guardian" ? "/observer" :
          role === "admin" ? "/admin" : "/app"
        } replace />
      : <AuthPage />
  }
/>

{/* Explicit logout landing — always accessible */}
<Route
  path="/auth/logout"
  element={<AuthPage />}
/>

      {/* Guardian details step — logged in but onboarding incomplete */}
      <Route
        path="/auth/guardian"
        element={
          !user
            ? <Navigate to="/auth" replace />
            : onboardingComplete
            ? <Navigate to="/app" replace />
            : <div className="auth-page">
                <div className="orb orb-cyan" />
                <div className="orb orb-purple" />
                <div className="auth-card">
                  <div className="auth-logo">
                    <span className="auth-logo-icon">◎</span>
                    <span className="auth-logo-text">AuraOS</span>
                  </div>
                  <GuardianDetails signupData={null} onBack={() => {}} />

                </div>
              </div>
        }
      />

      {/* Guardian invite acceptance — public */}
      <Route
        path="/auth/invite/:token"
        element={<GuardianInvite  />}
      />

      {/* Main app — protected */}
      <Route
        path="/app"
        element={
          <ProtectedRoute allowedRoles={["user"]}>
            <>
              {/* ── Intake overlay ── */}
              <AnimatePresence>
                {showIntake && (
                  <MentalHealthIntake onComplete={handleIntakeComplete} />
                )}
              </AnimatePresence>

              {/* ── Resume task banner ── */}
              <AnimatePresence>
                {resumeBanner && (
                  <motion.div
                    initial={{ y: -48, opacity: 0 }}
                    animate={{ y: 0,   opacity: 1 }}
                    exit={{   y: -48, opacity: 0 }}
                    style={{
                      position: 'fixed', top: 0, left: 0, right: 0, zIndex: 200,
                      background: 'linear-gradient(90deg, rgba(92,33,237,0.96), rgba(0,191,165,0.96))',
                      backdropFilter: 'blur(16px)',
                      padding: '10px 24px',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
                      fontSize: 13, color: 'rgba(255,255,255,0.92)', fontWeight: 600,
                    }}>
                    <Zap size={13} />
                    Resumed: {resumeBanner}
                    <button
                      onClick={() => setResumeBanner(null)}
                      style={{ marginLeft: 8, opacity: 0.65, fontSize: 20, color: 'white' }}>
                      ×
                    </button>
                  </motion.div>
                )}
</AnimatePresence>

              {/* ── App shell ── */}
              <div className="app" style={bodyAccentStyle}>
                <nav className="topnav" style={{ top: resumeBanner ? 40 : 0 }}>
                  <div className="topnav-logo">
                    <div className="logo-orb" />
                    <span
                      className="logo-text"
                      style={{
                        background: 'linear-gradient(135deg,#00e5ff,#c4b5fd)',
                        WebkitBackgroundClip: 'text',
                        WebkitTextFillColor: 'transparent',
                      }}>
                      AuraOS
                    </span>
                  </div>

                  <div className="topnav-tabs">
                    {TABS.map(({ id, label, Icon, color }) => (
                      <motion.button
                        key={id}
                        className={`nav-tab ${activeTab === id ? 'active' : ''}`}
                        onClick={() => setTab(id)}
                        whileTap={{ scale: 0.92 }}
                        style={activeTab === id
                          ? { color, boxShadow: `inset 0 0 0 1px ${color}40`, background: `${color}12` }
                          : {}
                        }>
                        <Icon size={13} />
                        <span className="nav-tab-label">{label}</span>
                      </motion.button>
                    ))}
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                    {userProfile && (
                      <ProfileBadge profile={userProfile} onReset={handleRetakeIntake} />
                    )}
                    {user && role === "user" && (
                      <motion.button
                        onClick={() => navigate("/profile")}
                        whileTap={{ scale: 0.88 }}
                        title="Your profile"
                        style={{
                          width: 36, height: 36, borderRadius: '50%',
                          background: 'linear-gradient(135deg, #00C9FF, #7B2FBE)',
                          border: 'none',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          color: '#F0ECFF', fontWeight: 700, fontSize: 13,
                          cursor: 'pointer', flexShrink: 0,
                        }}>
                        {(profile?.fullName || user?.email || "?")
                          .split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2)}
                      </motion.button>
                    )}
                    <motion.button
                      onClick={() => setIsDark((v) => !v)}
                      whileTap={{ scale: 0.88, rotate: 22 }}
                      style={{
                        width: 36, height: 36, borderRadius: '50%',
                        background: 'var(--bg-glass)', border: '1px solid var(--border)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: 'var(--text-3)',
                      }}
                      aria-label="Toggle theme">
                      {isDark ? <Sun size={15} /> : <Moon size={15} />}
                    </motion.button>
                  </div>
                </nav>

                <div className="content-scroll">
                  {!isInitialized && (
                    <div style={{
                      flex: 1,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      flexDirection: 'column', gap: 20,
                      minHeight: 'calc(100dvh - 64px)',
                    }}>
                      {initError ? (
                        <div style={{ textAlign: 'center' }}>
                          <p style={{ color: 'var(--text-2)', fontSize: 14, marginBottom: 8 }}>
                            Could not reach the backend.
                          </p>
                          <p style={{ color: 'var(--text-3)', fontSize: 12 }}>
                            Run <code style={{ color: 'var(--cyan-soft)' }}>npm run dev:node</code> in backend-node/
                          </p>
                        </div>
                      ) : (
                        <>
                          <motion.div
                            animate={{ scale: [1, 1.15, 1], opacity: [0.6, 1, 0.6] }}
                            transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
                            style={{
                              width: 60, height: 60, borderRadius: '50%',
                              background: 'conic-gradient(from 0deg,#7c3aed,#00e5ff,#00bfa5,#7c3aed)',
                              filter: 'blur(2px)',
                              boxShadow: '0 0 30px rgba(0,229,255,0.4)',
                            }}
                          />
                          <p style={{ color: 'var(--text-3)', fontSize: 13, letterSpacing: '0.04em' }}>
                            Initializing Aura…
                          </p>
                        </>
                      )}
                    </div>
                  )}

                  {isInitialized && (
                    <AnimatePresence mode="wait">
                      <motion.div
                        key={activeTab}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{   opacity: 0, y: -10 }}
                        transition={{ duration: 0.2 }}
                        style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                        {activeTab === 'voice' && (
                          <ErrorBoundary label="Aura Voice">
                            <AuraVoice userProfile={userProfile} />
                          </ErrorBoundary>
                        )}
                        {activeTab === 'forge' && (
                          <ErrorBoundary label="Cognitive Forge">
                            <CognitiveForge userProfile={userProfile} />
                          </ErrorBoundary>
                        )}
                        {activeTab === 'shatter' && (
                          <ErrorBoundary label="Task Shatterer">
                            <TaskShatter userProfile={userProfile} />
                          </ErrorBoundary>
                        )}
                        {activeTab === 'protocol' && (
                          <ErrorBoundary label="Clinical Protocol">
                            <ClinicalRecovery userProfile={userProfile} />
                          </ErrorBoundary>
                        )}
                      </motion.div>
                    </AnimatePresence>
                  )}
                </div>
              </div>
            </>
          </ProtectedRoute>
        }
      />
      
      {/* Profile page — protected */}
<Route
  path="/profile"
  element={
    <ProtectedRoute allowedRoles={["user"]}>
      <ProfilePage />
    </ProtectedRoute>
  }
/>

{/* Goodbye screen — public */}
<Route
  path="/goodbye"
  element={<GoodbyeScreen />}
/>

      {/* Observer portal — guardian role only */}
<Route
  path="/observer"
  element={
    <ProtectedRoute allowedRoles={["guardian"]}>
      <ObserverPortal />
    </ProtectedRoute>
  }
/>

      {/* Admin — placeholder */}
      <Route
  path="/admin"
  element={
    <ProtectedRoute allowedRoles={["admin"]}>
      <AdminDashboard />
    </ProtectedRoute>
  }
/>

      {/* Catch-all redirect */}
      <Route
        path="*"
        element={<Navigate to="/auth" replace />}
      />
    </Routes>
  );
}
