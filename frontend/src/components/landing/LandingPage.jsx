import React, { useEffect, useRef } from 'react';
import './LandingPage.css';

export default function LandingPage({ onLaunch }) {
  const containerRef = useRef(null);

  useEffect(() => {
    const revealEls = containerRef.current.querySelectorAll('.reveal');
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(e => { 
        if (e.isIntersecting) { 
          e.target.classList.add('visible'); 
          observer.unobserve(e.target); 
        } 
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
    revealEls.forEach(el => observer.observe(el));

    const links = containerRef.current.querySelectorAll('a[href^="#"]');
    links.forEach(a => {
      a.addEventListener('click', e => {
        const href = a.getAttribute('href');
        if(href === '#' || href === '#launch') return;
        e.preventDefault();
        const target = containerRef.current.querySelector(href);
        if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    });

    const handleMouseMove = (e) => {
      const x = (e.clientX / window.innerWidth - 0.5) * 20;
      const y = (e.clientY / window.innerHeight - 0.5) * 20;
      containerRef.current.querySelectorAll('.orb').forEach((orb, i) => {
        const speed = (i + 1) * 0.4;
        orb.style.transform = `translate(${x * speed}px, ${y * speed}px)`;
      });
    };
    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  return (
    <div className="landing-page-wrapper" ref={containerRef}>
      
<div className="page">
  {/*  ── Navbar ────────────────────────────────────────  */}
  <nav>
    <div className="nav-logo">
      <div className="orb-icon"></div>
      <span>AuraOS</span>
    </div>
    <div className="nav-links">
      <a href="#features">Features</a>
      <a href="#architecture">Architecture</a>
      <a href="#impact">Impact</a>
      <a href="#team">Team</a>
      <a onClick={(e) => { e.preventDefault(); onLaunch(); }} href="#" className="nav-cta">Launch App →</a>
    </div>
  </nav>

  {/*  ── Hero ───────────────────────────────────────────  */}
  <section className="hero" id="hero">
    <div className="hero-inner">
      <div className="hero-badge">
        <span className="pill">AURAOS BETA</span>
        Mental Health × AI × Real-Time Intervention
      </div>
      <h1>Your Mental Safety Net</h1>
      <p>When panic hits, you can't navigate complex UIs. AuraOS catches you exactly where you are — with voice AI, physics-based cognitive offloading, and ADHD micro-quest therapy.</p>
      <div className="hero-actions">
        <a onClick={(e) => { e.preventDefault(); onLaunch(); }} href="#" className="btn-primary">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polygon points="5 3 19 12 5 21 5 3"/></svg>
          Try AuraOS
        </a>
        <a href="#features" className="btn-secondary">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><polyline points="19 12 12 19 5 12"/></svg>
          Explore Features
        </a>
      </div>
      <div className="hero-stats">
        <div className="hero-stat"><div className="num">3</div><div className="label">Intervention Modes</div></div>
        <div className="hero-stat"><div className="num">12+</div><div className="label">API Endpoints</div></div>
        <div className="hero-stat"><div className="num">2</div><div className="label">AI Backends</div></div>
        <div className="hero-stat"><div className="num">6</div><div className="label">Therapeutic Games</div></div>
      </div>
    </div>
  </section>

  {/*  ── Problem ────────────────────────────────────────  */}
  <section className="problem" id="problem">
    <div className="container reveal">
      <div className="problem-grid">
        <div>
          <span className="section-label"><span className="dot"></span> The Problem</span>
          <h2>Current apps fail<br/><span className="highlight">when you need them most</span></h2>
          <p>Mental health apps are overwhelmingly passive. They ask you to fill out forms, track symptoms, and read dashboards — precisely when you're least capable of doing any of that.</p>
          <p>There is no <strong>"digital safety net."</strong> Until now.</p>
        </div>
        <div className="problem-visual">
          <div className="problem-item">
            <span className="problem-icon">😵‍💫</span>
            <div>
              <h4>Panic Attack in Progress</h4>
              <p>User can't type, can't read, can't navigate menus. Every existing app requires all three.</p>
            </div>
          </div>
          <div className="problem-item">
            <span className="problem-icon">🧊</span>
            <div>
              <h4>ADHD Executive Freeze</h4>
              <p>"Write my assignment" feels like climbing Everest. The brain physically cannot decompose it alone.</p>
            </div>
          </div>
          <div className="problem-item">
            <span className="problem-icon">🌀</span>
            <div>
              <h4>Anxiety Spiral</h4>
              <p>Worries are abstract and infinite. Without externalizing them, the loop never breaks.</p>
            </div>
          </div>
          <div className="problem-item">
            <span className="problem-icon">📊</span>
            <div>
              <h4>Post-Hoc Dashboards</h4>
              <p>Tracking mood after the fact doesn't help during the crisis. Action is needed <em>in the moment</em>.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>

  {/*  ── Features ───────────────────────────────────────  */}
  <section className="features" id="features">
    <div className="container">
      <div className="section-header reveal">
        <span className="section-label"><span className="dot"></span> Core Features</span>
        <h2>Three modes. Three <span className="gradient">failure states</span>.</h2>
        <p className="subtitle">Each feature targets a specific mental health crisis point — no generic meditation timers.</p>
      </div>

      {/*  Feature 1: Aura Voice  */}
      <div className="feature-card reveal">
        <div className="feature-content">
          <div className="feature-number">01</div>
          <span className="feature-tag tag-cyan">Aura Voice</span>
          <h3>Conversational Emotion AI</h3>
          <p>When you can't type, just speak. Aura reads the <strong>acoustic character</strong> of your anxiety — not just your words — and adapts its response in real-time.</p>
          <ul className="feature-bullets">
            <li>Web Audio API → WebSocket to Python ML pipeline</li>
            <li>librosa/wav2vec pitch & cadence extraction detects stress</li>
            <li>Three emotion modes: calm · mild anxiety · high anxiety</li>
            <li>Each mode triggers different UI glow, response length & grounding prompts</li>
            <li>ElevenLabs TTS for emotionally nuanced voice responses</li>
          </ul>
        </div>
        <div className="feature-visual">
          <div className="glow" style={{background:'var(--cyan)', top:'20%', left:'20%'}}></div>
          <div className="mockup">🎙️</div>
        </div>
      </div>

      {/*  Feature 2: Cognitive Forge  */}
      <div className="feature-card reveal">
        <div className="feature-content">
          <div className="feature-number">02</div>
          <span className="feature-tag tag-amber">Cognitive Forge</span>
          <h3>Physics-Based Worry Destruction</h3>
          <p>Turn the abstract chaos of anxiety into <strong>physical objects you can destroy</strong>. Type your worries, watch them become physics blocks, drag them into fire.</p>
          <ul className="feature-bullets">
            <li>Gemini Flash AI extracts discrete worries from raw text</li>
            <li>Each worry's weight (1–10) maps to block width in Matter.js</li>
            <li>Blocks spawn with random torque and fall under real gravity</li>
            <li>Drag to fireplace → particle burst + destroyed in MongoDB</li>
            <li>6 therapeutic ADHD mini-games for regulation</li>
          </ul>
        </div>
        <div className="feature-visual">
          <div className="glow" style={{background:'var(--amber)', top:'30%', right:'20%'}}></div>
          <div className="mockup">🔥</div>
        </div>
      </div>

      {/*  Feature 3: Task Shatterer  */}
      <div className="feature-card reveal">
        <div className="feature-content">
          <div className="feature-number">03</div>
          <span className="feature-tag tag-purple">Task Shatterer</span>
          <h3>Executive Function Engine</h3>
          <p>ADHD task paralysis solved. Type a scary task, and AI <strong>atomizes it into 2-minute micro-quests</strong> — shown one at a time with dopamine reward mechanics.</p>
          <ul className="feature-bullets">
            <li>LangChain + Groq with Zod schema-enforced structured output</li>
            <li>Initiation Coach detects blockers and adapts environment</li>
            <li>Brown noise audio loop during focus (neuroscience-backed)</li>
            <li>Body Double: detects tab-switching and gently redirects</li>
            <li>Panic button → auto-generates triage report for guardian</li>
          </ul>
        </div>
        <div className="feature-visual">
          <div className="glow" style={{background:'var(--purple)', bottom:'20%', left:'30%'}}></div>
          <div className="mockup">⚡</div>
        </div>
      </div>
    </div>
  </section>

  {/*  ── Tech Stack ────────────────────────────────────  */}
  <section className="tech" id="tech">
    <div className="container reveal">
      <span className="section-label" style={{display:'flex', justifyContent:'center'}}><span className="dot"></span> Technology</span>
      <h2>Built with precision</h2>
      <div className="tech-grid">
        <div className="tech-item"><div className="icon">⚛️</div><h4>React 18 + Vite</h4><p>Fast HMR, production builds in under 5s</p></div>
        <div className="tech-item"><div className="icon">🧲</div><h4>Matter.js</h4><p>2D rigid body physics for worry blocks</p></div>
        <div className="tech-item"><div className="icon">🧠</div><h4>LangChain + Groq</h4><p>Schema-validated AI with Zod types</p></div>
        <div className="tech-item"><div className="icon">✨</div><h4>Google Gemini</h4><p>Flash model for worry extraction</p></div>
        <div className="tech-item"><div className="icon">🐍</div><h4>FastAPI + Whisper</h4><p>Low-latency Python audio pipeline</p></div>
        <div className="tech-item"><div className="icon">🗄️</div><h4>MongoDB Atlas</h4><p>Flexible document store for telemetry</p></div>
        <div className="tech-item"><div className="icon">🔊</div><h4>ElevenLabs TTS</h4><p>Emotionally nuanced voice output</p></div>
        <div className="tech-item"><div className="icon">📊</div><h4>Zustand + Recharts</h4><p>Lightweight state + clinical dashboards</p></div>
      </div>
    </div>
  </section>

  {/*  ── Architecture ──────────────────────────────────  */}
  <section className="arch" id="architecture">
    <div className="container reveal">
      <span className="section-label" style={{display:'flex', justifyContent:'center'}}><span className="dot"></span> Architecture</span>
      <h2>Microservices by design</h2>
      <p className="subtitle">The Python backend runs real-time ML audio — isolated from Node so a slow LLM call never blocks the physics canvas.</p>
      <div className="arch-diagram">
        <div className="arch-row single">
          <div className="arch-box" style={{borderColor:'rgba(0,229,255,0.2)'}}>
            <h4>🖥️ Frontend</h4>
            <p>React 18 · Matter.js · Zustand · Framer Motion · Recharts</p>
            <span className="tech-label" style={{background:'rgba(0,229,255,0.1)', color:'var(--cyan)'}}>http://localhost:5173</span>
          </div>
        </div>
        <div className="arch-connector">↕ ↕ ↕</div>
        <div className="arch-row">
          <div className="arch-box" style={{borderColor:'rgba(196,181,253,0.2)'}}>
            <h4>🟢 Backend Node</h4>
            <p>Express · LangChain · Gemini · Twilio · PDFKit · Mongoose</p>
            <span className="tech-label" style={{background:'rgba(196,181,253,0.1)', color:'var(--lavender)'}}>:5001 REST API</span>
          </div>
          <div className="arch-box" style={{borderColor:'rgba(255,179,0,0.2)'}}>
            <h4>🐍 Backend Python</h4>
            <p>FastAPI · Whisper · librosa · Groq · ElevenLabs</p>
            <span className="tech-label" style={{background:'rgba(255,179,0,0.1)', color:'var(--amber)'}}>:8000 WebSocket</span>
          </div>
          <div className="arch-box" style={{borderColor:'rgba(0,191,165,0.2)'}}>
            <h4>🗄️ MongoDB Atlas</h4>
            <p>UserState · AlertLog · ClinicalReport · TaskHistory</p>
            <span className="tech-label" style={{background:'rgba(0,191,165,0.1)', color:'var(--teal)'}}>Cloud Database</span>
          </div>
        </div>
      </div>
    </div>
  </section>

  {/*  ── Impact ────────────────────────────────────────  */}
  <section className="impact" id="impact">
    <div className="container reveal">
      <span className="section-label" style={{display:'flex', justifyContent:'center'}}><span className="dot"></span> Impact</span>
      <h2>Why this matters</h2>
      <div className="impact-grid">
        <div className="impact-card">
          <div className="big-num" style={{background:'linear-gradient(135deg,var(--cyan),var(--teal))', WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent'}}>1 in 5</div>
          <h4>People Affected</h4>
          <p>1 in 5 people experience anxiety disorders. Current tools fail them during the moments they need help most.</p>
        </div>
        <div className="impact-card">
          <div className="big-num" style={{background:'linear-gradient(135deg,var(--purple),var(--lavender))', WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent'}}>4%</div>
          <h4>Adults with ADHD</h4>
          <p>2.5–4% of adults have ADHD. Task paralysis isn't laziness — it's a neurological freeze that needs external scaffolding.</p>
        </div>
        <div className="impact-card">
          <div className="big-num" style={{background:'linear-gradient(135deg,var(--amber),var(--coral))', WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent'}}>0 sec</div>
          <h4>Time to Intervention</h4>
          <p>No forms, no onboarding, no navigation. Speak, type, or tap — help arrives at the speed of crisis.</p>
        </div>
      </div>
      <div className="impact-quote">
        When someone is in crisis, they cannot navigate. So we made navigation unnecessary.
      </div>
    </div>
  </section>

  {/*  ── Clinical Intelligence ──────────────────────────  */}
  <section className="tech" id="clinical">
    <div className="container reveal">
      <span className="section-label" style={{display:'flex', justifyContent:'center'}}><span className="dot"></span> Clinical Intelligence</span>
      <h2>Guardian Triage System</h2>
      <div className="tech-grid" style={{gridTemplateColumns:'repeat(3,1fr)'}}>
        <div className="tech-item"><div className="icon">🚨</div><h4>Panic Detection</h4><p>Automatic stress spike triage with risk-level classification: watch → pre-burnout → acute distress</p></div>
        <div className="tech-item"><div className="icon">📱</div><h4>Guardian Alerts</h4><p>WhatsApp / SMS / Email alerts to parents with AI-generated metaphorical briefs, not clinical jargon</p></div>
        <div className="tech-item"><div className="icon">📄</div><h4>Clinical PDF Reports</h4><p>One-page A4 triage reports with worry blocks, timeline, vocal arousal, game telemetry & guardian actions</p></div>
        <div className="tech-item"><div className="icon">🎮</div><h4>Therapeutic Games</h4><p>6 ADHD-friendly micro-games (Squeeze Release, Color Sort, Memory Pulse, etc.) with predictive health analysis</p></div>
        <div className="tech-item"><div className="icon">📊</div><h4>Observer Portal</h4><p>Recharts-powered dashboard for therapists with vocal stress index, executive function scores & forge density</p></div>
        <div className="tech-item"><div className="icon">🔒</div><h4>Privacy First</h4><p>All data stays between user and guardian. Reports are supportive and informational — never a medical diagnosis.</p></div>
      </div>
    </div>
  </section>

  {/*  ── Team ───────────────────────────────────────────  */}
  <section className="team" id="team">
    <div className="container reveal">
      <span className="section-label" style={{display:'flex', justifyContent:'center'}}><span className="dot"></span> Team</span>
      <h2>Built by</h2>
      <div className="team-grid">
        <div className="team-card">
          <div className="team-avatar" style={{background:'linear-gradient(135deg,var(--purple),var(--cyan))'}}>M</div>
          <h4>Mayank</h4>
          <p className="role">Full-Stack · AI Pipeline · System Architecture</p>
          <div className="tags">
            <span>React</span><span>Node.js</span><span>LangChain</span><span>Gemini</span><span>Matter.js</span>
          </div>
        </div>
        <div className="team-card">
          <div className="team-avatar" style={{background:'linear-gradient(135deg,var(--amber),var(--teal))'}}>D</div>
          <h4>Deepanshu</h4>
          <p className="role">Audio ML · Speech Emotion · Python Backend</p>
          <div className="tags">
            <span>FastAPI</span><span>Whisper</span><span>librosa</span><span>Groq</span><span>ElevenLabs</span>
          </div>
        </div>
      </div>
    </div>
  </section>

  {/*  ── Footer CTA ────────────────────────────────────  */}
  <section className="footer-cta" id="launch">
    <div className="glow-ring"></div>
    <div className="container" style={{position:'relative'}}>
      <span className="section-label"><span className="dot"></span> Ready?</span>
      <h2>Experience AuraOS</h2>
      <p>Open the app and feel the difference between tracking your mental health and being caught by it.</p>
      <a onClick={(e) => { e.preventDefault(); onLaunch(); }} href="#" className="btn-primary" style={{fontSize:'17px', padding:'16px 40px'}}>
        Launch AuraOS →
      </a>
    </div>
  </section>

  <footer>
    <p>AuraOS · Built with 🧠 and ❤️ · <a href="#hero">Back to top</a></p>
  </footer>
</div>


    </div>
  );
}
