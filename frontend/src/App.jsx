// src/App.jsx — Calm, vibrant, healing shell

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mic, Wind, Zap, Sun, Moon } from 'lucide-react';
import useStore from './store/useStore.js';
import { shatterApi } from './services/api.js';
import ErrorBoundary  from './components/ErrorBoundary.jsx';
import AuraVoice      from './components/aura-voice/AuraVoice.jsx';
import CognitiveForge from './components/cognitive-forge/CognitiveForge.jsx';
import TaskShatter    from './components/task-shatter/TaskShatter.jsx';
import Dashboard      from './components/observer-portal/Dashboard.jsx';

const TABS = [
  { id:'voice',   label:'Aura',    Icon:Mic,  color:'#00e5ff' },
  { id:'forge',   label:'Forge',   Icon:Wind, color:'#ffb300' },
  { id:'shatter', label:'Shatter', Icon:Zap,  color:'#c4b5fd' },
];

export default function App() {
  const { activeTab, setTab, initSession, isInitialized, userId, setActiveTask } = useStore();
  const isPortalView = typeof window !== 'undefined' && window.location.pathname.startsWith('/portal');
  const [initError, setInitError] = useState(false);
  const [resumeBanner, setResumeBanner] = useState(null);
  const [isDark, setIsDark] = useState(true);

  useEffect(() => {
    document.documentElement.style.colorScheme = isDark ? 'dark' : 'light';
  }, [isDark]);

  useEffect(() => {
    if (isPortalView) return;
    const runInit = async () => {
      try {
        await initSession();
      } catch (err) {
        setInitError(true);
      }
    };
    runInit();
  }, [initSession, isPortalView]);

  useEffect(() => {
    if (isPortalView) return;
    if (!userId || !isInitialized) return;
    const restore = async () => {
      try {
        const data = await shatterApi.getActive(userId);
        if (data.activeTask) {
          setActiveTask(data.activeTask);
          setResumeBanner(data.activeTask.originalTask);
          setTab('shatter');
          setTimeout(() => setResumeBanner(null), 5000);
        }
      } catch { /* non-fatal */ }
    };
    restore();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, isInitialized, isPortalView]);

  if (isPortalView) {
    return (
      <ErrorBoundary label="Observer Portal">
        <Dashboard />
      </ErrorBoundary>
    );
  }

  return (
    <div className="app">
      {/* Resume banner */}
      <AnimatePresence>
        {resumeBanner && (
          <motion.div initial={{y:-48,opacity:0}} animate={{y:0,opacity:1}} exit={{y:-48,opacity:0}}
            style={{
              position:'fixed',top:0,left:0,right:0,zIndex:200,
              background:'linear-gradient(90deg,rgba(92,33,237,0.96),rgba(0,191,165,0.96))',
              backdropFilter:'blur(16px)',
              padding:'10px 24px',
              display:'flex',alignItems:'center',justifyContent:'center',gap:10,
              fontSize:13,color:'rgba(255,255,255,0.92)',fontWeight:600,
            }}>
            <Zap size={13}/>
            Resumed: {resumeBanner}
            <button onClick={() => setResumeBanner(null)} style={{marginLeft:8,opacity:0.65,fontSize:20}}>×</button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Nav */}
      <nav className="topnav" style={{top: resumeBanner ? 40 : 0}}>
        <div className="topnav-logo">
          <div className="logo-orb"/>
          <span style={{background:'linear-gradient(135deg,#00e5ff,#c4b5fd)',WebkitBackgroundClip:'text',WebkitTextFillColor:'transparent'}}>
            AuraOS
          </span>
        </div>

        <div className="topnav-tabs">
          {TABS.map(({id,label,Icon,color}) => (
            <motion.button key={id}
              className={`nav-tab ${activeTab===id?'active':''}`}
              onClick={() => setTab(id)}
              whileTap={{scale:0.92}}
              style={activeTab===id ? {color,boxShadow:`inset 0 0 0 1px ${color}40`,background:`${color}12`} : {}}
            >
              <Icon size={13}/>
              {label}
            </motion.button>
          ))}
        </div>

        <motion.button
          onClick={() => setIsDark(v => !v)}
          whileTap={{scale:0.88,rotate:22}}
          style={{
            width:36,height:36,borderRadius:'50%',
            background:'var(--bg-glass)',border:'1px solid var(--border)',
            display:'flex',alignItems:'center',justifyContent:'center',
            color:'var(--text-3)',
          }}
          aria-label="Toggle theme"
        >
          {isDark ? <Sun size={15}/> : <Moon size={15}/>}
        </motion.button>
      </nav>

      {/* Loading */}
      {!isInitialized && (
        <div style={{flex:1,display:'flex',alignItems:'center',justifyContent:'center',flexDirection:'column',gap:20}}>
          {initError ? (
            <div style={{textAlign:'center'}}>
              <p style={{color:'var(--text-2)',fontSize:14,marginBottom:8}}>Could not reach the backend.</p>
              <p style={{color:'var(--text-3)',fontSize:12}}>
                Run <code style={{color:'var(--cyan-soft)'}}>npm run dev:node</code> in backend-node/
              </p>
            </div>
          ) : (
            <>
              {/* Breathing loader orb */}
              <motion.div
                animate={{scale:[1,1.15,1],opacity:[0.6,1,0.6]}}
                transition={{duration:2.5,repeat:Infinity,ease:'easeInOut'}}
                style={{
                  width:60,height:60,borderRadius:'50%',
                  background:'conic-gradient(from 0deg,#7c3aed,#00e5ff,#00bfa5,#7c3aed)',
                  filter:'blur(2px)',
                  boxShadow:'0 0 30px rgba(0,229,255,0.4)',
                }}
              />
              <p style={{color:'var(--text-3)',fontSize:13,letterSpacing:'0.04em'}}>Initializing Aura…</p>
            </>
          )}
        </div>
      )}

      {/* Pages with smooth cross-fade */}
      {isInitialized && (
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{opacity:0,y:10}}
            animate={{opacity:1,y:0}}
            exit={{opacity:0,y:-10}}
            transition={{duration:0.2}}
            style={{flex:1,display:'flex',flexDirection:'column'}}
          >
            {activeTab==='voice'   && <ErrorBoundary label="Aura Voice">    <AuraVoice />      </ErrorBoundary>}
            {activeTab==='forge'   && <ErrorBoundary label="Cognitive Forge"><CognitiveForge /></ErrorBoundary>}
            {activeTab==='shatter' && <ErrorBoundary label="Task Shatterer"><TaskShatter />    </ErrorBoundary>}
          </motion.div>
        </AnimatePresence>
      )}
    </div>
  );
}
