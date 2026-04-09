// AuraVoice.jsx — Living circuit-board orb, always in motion

import { useRef, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mic, MicOff, Wind, Activity, Zap, Volume2, VolumeX } from 'lucide-react';
import useStore from '../../store/useStore.js';
import useAudioStream from '../../hooks/useAudioStream.js';

const EMOTIONS = {
  calm:         { color:'#00e5ff', glow:'rgba(0,229,255,0.5)',   badge:'badge-cyan',   label:'Calm',         tip:"I'm here with you. You're safe.",           Icon:Wind },
  mild_anxiety: { color:'#c4b5fd', glow:'rgba(196,181,253,0.5)', badge:'badge-purple', label:'Mild anxiety', tip:'One slow breath. In through the nose.',      Icon:Activity },
  high_anxiety: { color:'#ff6b8a', glow:'rgba(255,107,138,0.5)', badge:'badge-coral',  label:'High anxiety', tip:'Five fingers. Press them on something solid.', Icon:Zap },
};

// PCB traces radiating from ring border (viewBox 0 0 380 380, ring r≈135)
const TRACES = [
  "M190 55 L190 0","M164 58 L164 42 L148 42 L148 26 L116 26",
  "M216 58 L216 42 L232 42 L232 26 L264 26",
  "M144 61 L144 48 L122 48 L122 30 L94 30 L94 12 L68 12",
  "M236 61 L236 48 L258 48 L258 30 L286 30 L286 12 L312 12",
  "M116 66 L116 50 L90 50 L90 30 L62 30 L62 8 L36 8",
  "M264 66 L264 50 L290 50 L290 30 L318 30 L318 8 L344 8",
  "M68 12 L68 0","M312 12 L312 0","M36 8 L36 0","M344 8 L344 0",
  "M0 42 L36 42","M344 42 L380 42","M116 26 L96 26 L96 0","M264 26 L284 26 L284 0",
  "M190 325 L190 380","M164 322 L164 338 L148 338 L148 354 L116 354",
  "M216 322 L216 338 L232 338 L232 354 L264 354",
  "M144 319 L144 332 L122 332 L122 350 L94 350 L94 368 L68 368",
  "M236 319 L236 332 L258 332 L258 350 L286 350 L286 368 L312 368",
  "M68 368 L68 380","M312 368 L312 380","M0 338 L36 338","M344 338 L380 338",
  "M116 354 L96 354 L96 380","M264 354 L284 354 L284 380",
  "M55 190 L0 190","M60 164 L44 164 L44 148 L28 148 L28 116",
  "M60 216 L44 216 L44 232 L28 232 L28 264",
  "M63 144 L50 144 L50 122 L32 122 L32 94 L14 94 L14 68",
  "M63 236 L50 236 L50 258 L32 258 L32 286 L14 286 L14 312",
  "M14 68 L0 68","M14 312 L0 312","M44 36 L44 0","M44 344 L44 380",
  "M28 116 L10 116 L10 96 L0 96","M28 264 L10 264 L10 284 L0 284",
  "M325 190 L380 190","M320 164 L336 164 L336 148 L352 148 L352 116",
  "M320 216 L336 216 L336 232 L352 232 L352 264",
  "M317 144 L330 144 L330 122 L348 122 L348 94 L366 94 L366 68",
  "M317 236 L330 236 L330 258 L348 258 L348 286 L366 286 L366 312",
  "M366 68 L380 68","M366 312 L380 312","M336 36 L336 0","M336 344 L336 380",
  "M352 116 L370 116 L370 96 L380 96","M352 264 L370 264 L370 284 L380 284",
];

const PADS = [
  [162,40],[218,40],[148,24],[232,24],[94,28],[286,28],[68,10],[312,10],
  [162,340],[218,340],[148,356],[232,356],[94,352],[286,352],[68,370],[312,370],
  [42,162],[42,218],[26,148],[26,232],[12,92],[12,288],[12,66],[12,314],
  [338,162],[338,218],[354,148],[354,232],[368,92],[368,288],[368,66],[368,314],
  [68,68],[312,68],[68,312],[312,312],[94,26],[284,26],[26,94],[26,284],[354,94],[354,284],
];

const CARDINAL_NODES = [[190,55],[325,190],[190,325],[55,190]];

// Stars: [x%, y%, size, delay, duration]
const STARS = [
  [4,5,2.8,0,3.2],[96,8,2.2,0.7,2.9],[5,73,3.1,1.4,3.7],[94,68,2.4,0.3,3.0],
  [50,2,2.1,2.2,3.4],[50,97,1.8,1.6,2.8],[2,50,2.5,2.7,3.9],[98,50,2.5,0.8,3.1],
  [17,17,1.6,1.9,4.0],[83,83,1.6,0.4,3.3],[79,17,2.1,3.2,2.7],[21,83,2.1,2.1,3.5],
  [31,7,1.2,2.5,3.1],[69,93,1.2,1.0,2.6],[7,37,1.6,3.5,3.8],[93,62,1.6,1.1,2.5],
  [14,56,1.1,0.1,3.6],[86,43,1.1,2.9,3.2],[44,4,1.8,1.7,2.4],[56,96,1.8,0.6,3.7],
  [22,45,1.0,3.0,3.0],[78,55,1.0,2.3,2.8],[60,12,1.5,1.3,3.5],[40,88,1.5,0.2,2.9],
  [35,25,1.2,1.0,2.5],[65,75,1.2,2.0,3.0],[10,65,1.0,0.5,4.0],[90,35,1.0,1.5,3.5],
];

const PULSE_A = [0,3,8,14,17,22,27,30,37];
const PULSE_B = [1,4,9,15,18,23,28,31,38];
const PULSE_C = [2,5,6,16,19,24,25,32,35];
const PULSE_DELAYS = [0,0.4,0.8,1.2,1.6,2.0,0.3,0.9,1.5,0.6,1.8,2.4,0.2,1.1,2.1,0.7,2.3,0.1,1.9,2.7,0.5,1.4,2.2,0.8];

export default function AuraVoice() {
  const canvasRef = useRef(null);
  const [error, setError] = useState(null);
  const {
    isListening,
    auraEmotion,
    auraTranscript,
    auraResponse,
    audioMuted,
    isAuraSpeaking,
    setAudioMuted,
  } = useStore();
  const { start, stop } = useAudioStream();

  const em = EMOTIONS[auraEmotion] || EMOTIONS.calm;
  const { color: C, glow: G } = em;

  const neonShadow = [
    `0 0 0 1.5px ${C}`,
    `0 0 10px 4px ${C}`,
    `0 0 26px 10px ${G}`,
    `0 0 55px 22px ${G.replace(/[\d.]+\)$/,'0.22)')}`,
    `0 0 100px 40px ${G.replace(/[\d.]+\)$/,'0.10)')}`,
    `inset 0 0 28px ${G.replace(/[\d.]+\)$/,'0.14)')}`,
  ].join(',');

  const toggleListening = useCallback(async () => {
    setError(null);
    if (isListening) { stop(); return; }
    try { await start(canvasRef.current); }
    catch (e) {
      setError(
        e.message?.includes('Permission')
          ? 'Microphone access denied. Allow it in browser settings.'
          : e.message || 'Cannot connect to voice backend.'
      );
    }
  }, [isListening, start, stop]);

  const cometClass  = isListening ? 'ring-comet-fast'   : 'ring-comet';
  const comet2Class = isListening ? 'ring-comet-2-fast' : 'ring-comet-2';
  const pulseMult   = isListening ? 0.5 : 1;

  return (
    <div className="page fade-up"
      style={{maxWidth:680,display:'flex',flexDirection:'column',alignItems:'center',paddingTop:20}}>

      {/* Header */}
      <div style={{textAlign:'center',marginBottom:40}}>
        <AnimatePresence mode="wait">
          {isListening
            ? <motion.span key="em" initial={{opacity:0,y:-6}} animate={{opacity:1,y:0}} exit={{opacity:0}}
                className={`badge ${em.badge}`} style={{marginBottom:14,display:'inline-flex'}}>
                <span style={{width:6,height:6,borderRadius:'50%',background:C,display:'inline-block',boxShadow:`0 0 6px ${C}`}}/>
                {em.label} detected
              </motion.span>
            : <motion.span key="idle" initial={{opacity:0}} animate={{opacity:1}}
                className="badge badge-cyan" style={{marginBottom:14}}>
                <span style={{width:6,height:6,borderRadius:'50%',background:'#00e5ff',display:'inline-block'}}/>
                Voice AI
              </motion.span>
          }
        </AnimatePresence>
        <h1 className="section-title">Talk to Aura</h1>
        <p className="section-sub" style={{margin:'0 auto',textAlign:'center'}}>
          Aura reads the sound of your voice — not just your words.<br/>
          It meets you exactly where you are.
        </p>
        <div style={{marginTop:14,display:'flex',justifyContent:'center'}}>
          <button
            onClick={() => setAudioMuted(!audioMuted)}
            style={{
              display:'inline-flex',
              alignItems:'center',
              gap:8,
              border:'1px solid rgba(0,229,255,0.28)',
              background: audioMuted ? 'rgba(255,107,138,0.12)' : 'rgba(0,229,255,0.08)',
              color: audioMuted ? '#ffb3c1' : '#80deea',
              borderRadius:999,
              padding:'9px 14px',
              fontSize:12,
              fontWeight:700,
              letterSpacing:'0.03em',
              cursor:'pointer',
            }}
          >
            {audioMuted ? <VolumeX size={14} /> : <Volume2 size={14} />}
            {audioMuted ? 'Voice muted' : 'Voice enabled'}
          </button>
        </div>
      </div>

      {/* ═══════════════ LIVING CIRCUIT ORB ═══════════════ */}
      <div style={{
        position:'relative',
        width:'min(360px,88vw)', height:'min(360px,88vw)',
        flexShrink:0, marginBottom:36,
        borderRadius:20, overflow:'hidden',
        background:'radial-gradient(ellipse at 45% 42%, #001e33 0%, #000d1c 42%, #00060f 100%)',
      }}>
        {/* Layer 1: Static PCB traces */}
        <svg viewBox="0 0 380 380" aria-hidden="true"
          style={{position:'absolute',inset:0,width:'100%',height:'100%',pointerEvents:'none'}}>
          {TRACES.map((d,i) => <path key={`s${i}`} d={d} stroke="#0088aa" strokeWidth="0.8" fill="none" opacity="0.35"/>)}
          {PADS.map(([x,y],i) => <rect key={`p${i}`} x={x-2} y={y-2} width="4" height="4" rx="0.5" fill="#00ccee" opacity="0.5"/>)}
          {CARDINAL_NODES.map(([cx,cy],i) => <circle key={`n${i}`} cx={cx} cy={cy} r="4.5" fill="none" stroke="#00e5ff" strokeWidth="1.3" opacity="0.65"/>)}
        </svg>

        {/* Layer 2: Electric pulses racing along traces */}
        <svg viewBox="0 0 380 380" aria-hidden="true"
          style={{position:'absolute',inset:0,width:'100%',height:'100%',pointerEvents:'none'}}>
          {TRACES.map((d,i) => {
            const cls = PULSE_A.includes(i)?'trace-pulse':PULSE_B.includes(i)?'trace-pulse-b':PULSE_C.includes(i)?'trace-pulse-c':null;
            if (!cls) return null;
            const delay = (PULSE_DELAYS[i%PULSE_DELAYS.length]*pulseMult).toFixed(2);
            return <path key={`el${i}`} d={d} stroke={C} strokeWidth="1.6" fill="none" className={cls} style={{animationDelay:`${delay}s`}}/>;
          })}
        </svg>

        {/* Layer 3: Starfield */}
        {STARS.map(([x,y,s,delay,dur],i) => (
          <div key={`st${i}`} style={{
            position:'absolute',left:`${x}%`,top:`${y}%`,
            width:s,height:s,borderRadius:'50%',background:'#b2f0ff',
            boxShadow:`0 0 ${s*2.5}px rgba(0,229,255,0.9)`,
            animation:`starPulse ${dur}s ${delay}s ease-in-out infinite`,
          }}/>
        ))}

        {/* Layer 4: Dual counter-rotating atmosphere halos */}
        <div style={{
          position:'absolute',left:'50%',top:'50%',
          width:'114%',height:'114%',marginLeft:'-57%',marginTop:'-57%',
          borderRadius:'50%',pointerEvents:'none',
          background:`conic-gradient(transparent 0%,transparent 58%,${G.replace(/[\d.]+\)$/,'0.22)')} 72%,${G.replace(/[\d.]+\)$/,'0.08)')} 80%,transparent 90%,${G.replace(/[\d.]+\)$/,'0.04)')} 96%,transparent 100%)`,
          animation:'haloSpin 16s linear infinite',transition:'background 0.6s',
        }}/>
        <div style={{
          position:'absolute',left:'50%',top:'50%',
          width:'108%',height:'108%',marginLeft:'-54%',marginTop:'-54%',
          borderRadius:'50%',pointerEvents:'none',
          background:`conic-gradient(transparent 0%,transparent 68%,${G.replace(/[\d.]+\)$/,'0.14)')} 78%,transparent 90%,${G.replace(/[\d.]+\)$/,'0.07)')} 95%,transparent 100%)`,
          animation:'haloSpinR 24s linear infinite',
        }}/>

        {/* Layer 5: Outer faint decorative ring */}
        <div style={{position:'absolute',inset:'8%',borderRadius:'50%',border:'1px solid rgba(0,229,255,0.07)',pointerEvents:'none'}}/>

        {/* Layer 6: MAIN NEON RING — THE HERO */}
        <motion.div
          style={{
            position:'absolute',inset:'14%',borderRadius:'50%',
            border:`2.5px solid ${C}`,
            boxShadow:neonShadow,
            transition:'border-color 0.5s, box-shadow 0.5s',
          }}
          animate={{scale: isListening ? [1,1.042,1] : [1,1.018,1]}}
          transition={{duration:isListening ? 0.9 : 4.5, repeat:Infinity, ease:'easeInOut'}}
        />

        {/* Layer 7: Animated comets on the ring circle */}
        <svg viewBox="0 0 380 380" aria-hidden="true"
          style={{position:'absolute',inset:0,width:'100%',height:'100%',pointerEvents:'none'}}>
          <circle cx="190" cy="190" r="135" fill="none" stroke={C} strokeWidth="4"
            className={cometClass} style={{filter:`drop-shadow(0 0 7px ${C}) drop-shadow(0 0 14px ${C})`}}/>
          <circle cx="190" cy="190" r="135" fill="none" stroke={C} strokeWidth="1.5" opacity="0.4"
            className={comet2Class}/>
        </svg>

        {/* Layer 8: Expanding pulse rings when listening */}
        {isListening && [0,0.5,1.0,1.5].map((delay) => (
          <motion.div key={delay}
            style={{position:'absolute',inset:'14%',borderRadius:'50%',border:`1px solid ${C}`,pointerEvents:'none'}}
            animate={{scale:[1,1.75],opacity:[0.65,0]}}
            transition={{duration:2.6,delay,repeat:Infinity,ease:'easeOut'}}
          />
        ))}

        {/* Layer 9: Inner decorative rings */}
        <div style={{position:'absolute',inset:'23%',borderRadius:'50%',border:`0.7px solid ${C}30`,pointerEvents:'none'}}/>
        <div style={{position:'absolute',inset:'31%',borderRadius:'50%',border:`0.5px solid ${C}18`,pointerEvents:'none'}}/>

        {/* Layer 10: Cardinal glow nodes */}
        {[
          {top:'13.5%',left:'50%',transform:'translateX(-50%)'},
          {bottom:'13.5%',left:'50%',transform:'translateX(-50%)'},
          {top:'50%',left:'13.5%',transform:'translateY(-50%)'},
          {top:'50%',right:'13.5%',transform:'translateY(-50%)'},
        ].map((s,i) => (
          <div key={i} style={{
            position:'absolute',...s,
            width:7,height:7,borderRadius:'50%',
            background:C,
            boxShadow:`0 0 10px ${C},0 0 22px ${C},0 0 40px ${C}`,
          }}/>
        ))}

        {/* Layer 11: Center void + mic button */}
        <div style={{
          position:'absolute',inset:'33%',borderRadius:'50%',
          background:'radial-gradient(circle at 42% 40%, #001929, #00060e)',
          boxShadow:'inset 0 0 36px rgba(0,0,0,0.97), inset 0 0 14px rgba(0,20,40,0.9)',
          animation:'voidBreathe 4s ease-in-out infinite',
          display:'flex',alignItems:'center',justifyContent:'center',overflow:'hidden',
        }}>
          <div style={{position:'absolute',inset:0,borderRadius:'50%',
            background:`radial-gradient(circle at 38% 36%, ${C}1a, transparent 62%)`}}/>
          <motion.button
            onClick={toggleListening}
            style={{position:'relative',border:'none',background:'transparent',cursor:'pointer',
              display:'flex',alignItems:'center',justifyContent:'center',
              width:'100%',height:'100%',borderRadius:'50%'}}
            whileHover={{scale:1.12}}
            whileTap={{scale:0.86}}
            aria-label={isListening ? 'Stop' : 'Start listening'}
          >
            {isListening
              ? <MicOff size={22} color={C} strokeWidth={1.5} style={{filter:`drop-shadow(0 0 10px ${C})`}}/>
              : <Mic    size={22} color="#00e5ff" strokeWidth={1.5} style={{filter:'drop-shadow(0 0 10px #00e5ff)'}}/>
            }
          </motion.button>
        </div>
      </div>
      {/* ═════════════ END ORB ═════════════ */}

      {/* Status */}
      <motion.p key={String(isListening)} initial={{opacity:0}} animate={{opacity:1}}
        style={{fontSize:13,color:'var(--text-3)',fontWeight:500,letterSpacing:'0.04em',marginBottom:28}}>
        {isListening
          ? <><span style={{color:C,marginRight:5,fontSize:10}}>●</span>Listening — tap to stop</>
          : 'Tap the orb to speak with Aura'
        }
      </motion.p>
      {isAuraSpeaking && !audioMuted && (
        <p style={{ fontSize: 12, color: '#80deea', marginTop: -16, marginBottom: 18 }}>
          Aura is speaking...
        </p>
      )}

      <canvas ref={canvasRef} width={0} height={0} style={{display:'none'}}/>

      {/* Error */}
      <AnimatePresence>
        {error && (
          <motion.div initial={{opacity:0,y:8}} animate={{opacity:1,y:0}} exit={{opacity:0}}
            style={{width:'100%',maxWidth:460,padding:'12px 16px',marginBottom:14,textAlign:'center',
              background:'rgba(255,107,138,0.1)',border:'1px solid rgba(255,107,138,0.28)',
              borderRadius:14,color:'#ffb3c1',fontSize:13}}>
            {error}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Grounding tip */}
      <AnimatePresence>
        {isListening && auraEmotion !== 'calm' && (
          <motion.div initial={{opacity:0,y:10}} animate={{opacity:1,y:0}} exit={{opacity:0,y:-8}}
            style={{width:'100%',maxWidth:460,padding:'18px 22px',marginBottom:12,
              background:'rgba(255,255,255,0.03)',backdropFilter:'blur(16px)',
              border:'1px solid var(--border)',borderRadius:18}}>
            <p style={{fontSize:10.5,color:'var(--text-3)',marginBottom:6,textTransform:'uppercase',letterSpacing:'0.1em',fontWeight:700}}>Grounding tip</p>
            <p style={{fontSize:15,color:'var(--text-1)',lineHeight:1.68}}>{em.tip}</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Transcript */}
      <AnimatePresence>
        {auraTranscript && (
          <motion.div initial={{opacity:0,y:10}} animate={{opacity:1,y:0}}
            style={{width:'100%',maxWidth:460,padding:'14px 18px',marginBottom:10,
              background:'rgba(255,255,255,0.025)',border:'1px solid var(--border)',borderRadius:14}}>
            <p style={{fontSize:10.5,color:'var(--text-3)',marginBottom:5,textTransform:'uppercase',letterSpacing:'0.1em',fontWeight:700}}>You said</p>
            <p style={{fontSize:15,color:'var(--text-2)',lineHeight:1.68}}>{auraTranscript}</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Aura response */}
      <AnimatePresence>
        {auraResponse && (
          <motion.div initial={{opacity:0,y:12}} animate={{opacity:1,y:0}}
            style={{width:'100%',maxWidth:460,padding:'18px 22px',
              background:'linear-gradient(135deg,rgba(0,140,190,0.12),rgba(0,80,130,0.06))',
              border:'1px solid rgba(0,229,255,0.2)',borderRadius:18}}>
            <p style={{fontSize:10.5,color:'#00e5ff',marginBottom:8,textTransform:'uppercase',letterSpacing:'0.1em',fontWeight:700}}>Aura</p>
            <p style={{fontSize:16,color:'var(--text-1)',lineHeight:1.75}}>{auraResponse}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}


