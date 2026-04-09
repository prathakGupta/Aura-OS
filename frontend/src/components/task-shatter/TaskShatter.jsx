// TaskShatter.jsx — Shattered Canvas + Aura Initiation Coach  🌟 FULLY UPDATED
// Phase machine: input → coaching → intervention (optional) → loading → canvas → focus → done

import { useState, useCallback, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Zap, Trash2, Edit2, Check, Trophy, ArrowRight,
  RotateCcw, Music, VolumeX, Play, Brain, Volume2, Mountain,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import useStore from '../../store/useStore.js';
import { shatterApi } from '../../services/api.js';
import { clinicalApi } from '../../services/portalApi.js';
import BodyDouble from './BodyDouble.jsx';
import SymptomInterruption from './SymptomInterruption.jsx';
import useFocusTimer from '../../hooks/useFocusTimer.js';
import useTelemetry from '../../hooks/useTelemetry.js';

/* ── Constants ──────────────────────────────────────────────── */
const COLORS = [
  { id:'cyan',   border:'#00e5ff', glow:'rgba(0,229,255,0.4)',   bg:'rgba(0,229,255,0.06)'   },
  { id:'purple', border:'#c4b5fd', glow:'rgba(196,181,253,0.4)', bg:'rgba(196,181,253,0.06)' },
  { id:'coral',  border:'#ff6b8a', glow:'rgba(255,107,138,0.4)', bg:'rgba(255,107,138,0.06)' },
  { id:'amber',  border:'#ffb300', glow:'rgba(255,179,0,0.4)',   bg:'rgba(255,179,0,0.06)'   },
  { id:'green',  border:'#00e676', glow:'rgba(0,230,118,0.4)',   bg:'rgba(0,230,118,0.06)'   },
];

const BLOCKERS = [
  { id:'too_noisy',        label:'Too noisy / Distracted',    icon:Volume2,  envHint:'brown_noise',   desc:'House is loud, can\'t focus' },
  { id:'brain_fog',        label:'Brain fog / Exhaustion',    icon:Brain,    envHint:'deep_focus_dark',desc:'Mind feels slow, tired' },
  { id:'too_overwhelming', label:'Task feels too big / Scary',icon:Mountain, envHint:'meditation_first',desc:'Frozen, don\'t know where to start' },
];

/* ── Confetti ────────────────────────────────────────────────── */
const slotConfetti   = (x, y) => confetti({ particleCount:28, spread:50, origin:{ x:x/window.innerWidth, y:y/window.innerHeight }, colors:['#00e5ff','#c4b5fd','#00e676','#ffb300'], ticks:60, gravity:0.6, scalar:0.75, startVelocity:14 });
const bigConfetti    = () => { const end=Date.now()+2200; const b=()=>{ confetti({particleCount:35,angle:60,spread:50,origin:{x:0},colors:['#7c3aed','#00e5ff']}); confetti({particleCount:35,angle:120,spread:50,origin:{x:1},colors:['#c4b5fd','#00e676']}); if(Date.now()<end) requestAnimationFrame(b); }; b(); };

/* ── Random spawn position (polar coords, avoids centre) ─────── */
const randomPos = (i, total) => {
  const angle = ((i/total)*2*Math.PI)+(Math.random()-0.5)*0.8;
  const r     = 180+Math.random()*130;
  return { x:Math.cos(angle)*r+(Math.random()-0.5)*60, y:Math.sin(angle)*r*0.65+(Math.random()-0.5)*40 };
};

const MAX_SLOTS = 8;

/* ════════════════════════════════════════════════════════════════
   FRAGMENT CARD
 ════════════════════════════════════════════════════════════════ */
function FragmentCard({ frag, onPositionChange, onDelete, onTextChange, onColorChange, onDropToSlot, constraintsRef, isDocked, onDragVelocity }) {
  const [editing,  setEditing]  = useState(false);
  const [editVal,  setEditVal]  = useState(frag.text);
  const [hovered,  setHovered]  = useState(false);
  const [dragging, setDragging] = useState(false);
  const color = COLORS.find(c=>c.id===frag.colorId) || COLORS[0];

  const commitEdit = () => { onTextChange(frag.id, editVal.trim()||frag.text); setEditing(false); };
  if (isDocked) return null;

  return (
    <motion.div
      drag dragMomentum={false} dragConstraints={constraintsRef} dragElastic={0.08}
      initial={{ x:0, y:0, opacity:0, scale:0.4 }}
      animate={{ x:frag.x, y:frag.y, opacity:1, scale:1 }}
      transition={{ type:'spring', stiffness:180, damping:18, opacity:{duration:0.3} }}
      whileDrag={{ scale:1.07, zIndex:100 }}
      onDragStart={() => setDragging(true)}
      onDragEnd={(e, info) => {
        setDragging(false);
        onDragVelocity?.(Math.abs(info.velocity.x), Math.abs(info.velocity.y));
        onPositionChange(frag.id, info.point.x-window.innerWidth/2, info.point.y-window.innerHeight/2);
        onDropToSlot(frag.id, info.point.x, info.point.y);
      }}
      onHoverStart={() => setHovered(true)}
      onHoverEnd={() => !dragging && setHovered(false)}
      style={{ position:'absolute', top:'50%', left:'50%', marginTop:-52, marginLeft:-110, width:220, zIndex:hovered||dragging?90:10, cursor:dragging?'grabbing':'grab' }}
    >
      <div style={{
        background: dragging ? 'rgba(10,20,40,0.97)' : 'rgba(6,14,30,0.88)',
        backdropFilter:'blur(20px)', borderRadius:18,
        border:`1px solid ${color.border}`,
        boxShadow: dragging
          ? `0 24px 60px ${color.glow},0 0 0 1px ${color.border},inset 0 1px 0 rgba(255,255,255,0.06)`
          : `0 8px 28px ${color.glow.replace('0.4','0.2')},0 0 0 0.5px ${color.border}40,inset 0 1px 0 rgba(255,255,255,0.04)`,
        padding:'14px 16px', transition:'box-shadow 0.2s,background 0.2s',
      }}>
        {/* Color picker + actions */}
        <div style={{display:'flex',gap:5,marginBottom:10,alignItems:'center'}}>
          {COLORS.map(c=>(
            <button key={c.id} onClick={e=>{e.stopPropagation();onColorChange(frag.id,c.id);}} style={{ width:frag.colorId===c.id?12:8, height:frag.colorId===c.id?12:8, borderRadius:'50%', background:c.border, border:frag.colorId===c.id?'2px solid white':'none', boxShadow:frag.colorId===c.id?`0 0 8px ${c.border}`:'none', cursor:'pointer', transition:'all 0.15s', flexShrink:0 }}/>
          ))}
          <div style={{flex:1}}/>
          <AnimatePresence>
            {(hovered||dragging) && (
              <motion.div initial={{opacity:0,scale:0.8}} animate={{opacity:1,scale:1}} exit={{opacity:0,scale:0.8}} transition={{duration:0.12}} style={{display:'flex',gap:4}}>
                <button onClick={e=>{e.stopPropagation();setEditing(true);setEditVal(frag.text);}} style={{padding:3,borderRadius:6,background:'rgba(255,255,255,0.06)',color:'rgba(255,255,255,0.5)',display:'flex',alignItems:'center'}}><Edit2 size={11}/></button>
                <button onClick={e=>{e.stopPropagation();onDelete(frag.id);}} style={{padding:3,borderRadius:6,background:'rgba(255,107,138,0.1)',color:'#ff6b8a',display:'flex',alignItems:'center'}}><Trash2 size={11}/></button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        {editing ? (
          <div style={{display:'flex',gap:6,alignItems:'center'}}>
            <input autoFocus value={editVal} onChange={e=>setEditVal(e.target.value)}
              onKeyDown={e=>{if(e.key==='Enter')commitEdit();if(e.key==='Escape')setEditing(false);}}
              onClick={e=>e.stopPropagation()}
              style={{flex:1,background:'rgba(255,255,255,0.06)',border:`1px solid ${color.border}`,borderRadius:8,padding:'6px 8px',color:'#e8f4fb',fontSize:13,fontFamily:'inherit',outline:'none'}}
            />
            <button onClick={commitEdit} style={{color:color.border,display:'flex'}}><Check size={14}/></button>
          </div>
        ) : (
          <p onDoubleClick={()=>{setEditing(true);setEditVal(frag.text);}}
            style={{fontSize:13.5,fontWeight:700,color:'#e8f4fb',lineHeight:1.4,letterSpacing:'-0.01em',userSelect:'none',minHeight:36}}>
            {frag.text}
          </p>
        )}
        <p style={{fontSize:10,color:color.border,marginTop:8,opacity:0.75,letterSpacing:'0.06em',textTransform:'uppercase',fontWeight:600}}>
          ~{frag.duration_minutes||2} min
        </p>
      </div>
    </motion.div>
  );
}

/* ════════════════════════════════════════════════════════════════
   MAIN COMPONENT
 ════════════════════════════════════════════════════════════════ */
export default function TaskShatter() {
  const {
    userId,
    activeTask,
    setActiveTask,
    completeQuestLocally,
    clearTask,
    taskComplete,
    currentQuestIndex,
    worries,
  } = useStore();

  // ── Phase state machine ──────────────────────────────────────────────────
  // 'input' | 'coaching' | 'intervention' | 'loading' | 'canvas' | 'focus' | 'done'
  const [phase,        setPhase]        = useState('input');
  const [taskText,     setTaskText]     = useState('');
  const [selectedBlocker, setBlocker]   = useState(null);
  const [coachData,    setCoachData]    = useState(null);   // AI response
  const [fragments,    setFragments]    = useState([]);
  const [slots,        setSlots]        = useState(Array(MAX_SLOTS).fill(null));
  const [error,        setError]        = useState(null);
  const [completing,   setCompleting]   = useState(false);
  const [showBodyDouble, setBodyDouble] = useState(false);
  const [apiTaskId,    setApiTaskId]    = useState(null);
  const [originalTask, setOriginalTask] = useState('');
  const [alertResult,  setAlertResult]  = useState(null);  // clinical alert feedback
  const [reportBusy,   setReportBusy]   = useState(false);
  const [reportInfo,   setReportInfo]   = useState(null);

  const constraintsRef = useRef(null);
  const dockRef        = useRef(null);
  const apiCallRef     = useRef(null);  // tracks in-flight API call during intervention

  const { noiseEnabled, toggleNoise } = useFocusTimer({
    isTaskActive: phase === 'focus',
    onDistracted: () => setBodyDouble(true),
    onReturned:   () => setBodyDouble(false),
  });
  const { recordDragEvent } = useTelemetry();

  // ── Focus quests state ────────────────────────────────────────────────────
  const focusQuests = activeTask?.microquests || [];
  const focusQuest  = focusQuests[currentQuestIndex] || null;
  const completedN  = focusQuests.filter(q=>q.completed).length;
  const progress    = focusQuests.length ? Math.round((completedN/focusQuests.length)*100) : 0;

  // ── Auto-apply environment strategy from AI ───────────────────────────────
  useEffect(() => {
    if (phase !== 'canvas' || !coachData) return;
    const strategy = coachData.envStrategy || coachData.environment_strategy;
    if (strategy === 'brown_noise' && !noiseEnabled)     toggleNoise();
    if (strategy === 'deep_focus_dark')
      document.body.style.filter = 'brightness(0.82)';
    return () => { document.body.style.filter = ''; };
  }, [phase, coachData]); // eslint-disable-line

  // ── Phase 1 → 2: Show coach question ─────────────────────────────────────
  const handleShowCoach = () => {
    if (!taskText.trim()) return;
    setOriginalTask(taskText.trim());
    setPhase('coaching');
  };

  // ── Phase 2 → API: Blocker selected ──────────────────────────────────────
  const handleBlockerSelected = async (blocker) => {
    setBlocker(blocker);
    setError(null);

    if (blocker.id === 'too_overwhelming') {
      // Show breathing ring AND fire clinical alert + AI in parallel
      setPhase('intervention');

      // Kick off both API calls concurrently
      apiCallRef.current = Promise.all([
        shatterApi.coachBreakdown(taskText.trim(), blocker.id, userId).catch(()=>null),
        clinicalApi.sessionReport({
          userId,
          source: 'panic',
          currentTask: taskText.trim(),
          selectedBlocker: blocker.label,
          vocalArousalScore: 8,
          sendToGuardian: true,
          channels: { whatsapp: true, email: true },
          sessionSnapshot: {
            initialAnxietyQuery: taskText.trim(),
            shatteredWorryBlocks: worries.map((w) => ({
              id: w.uuid || String(w.id || ''),
              text: w.worry,
              weight: w.weight,
              status: w.status || 'active',
            })),
            notes: 'Triggered from intervention flow in TaskShatter.',
          },
        }).catch(()=>null),
      ]);
    } else {
      // No intervention needed — straight to AI + canvas
      setPhase('loading');
      try {
        const result = await shatterApi.coachBreakdown(taskText.trim(), blocker.id, userId);
        await _processAiResult(result);
      } catch {
        // Fallback to standard breakdown
        try {
          const result2 = await shatterApi.breakdown(taskText.trim(), userId);
          await _processAiResult({ microquests: result2.microquests, coachMessage: null, envStrategy: null });
        } catch (e2) { setError(e2.message); setPhase('coaching'); }
      }
    }
  };

  // Called when SymptomInterruption onComplete fires
  const handleInterventionComplete = async () => {
    setPhase('loading');
    try {
      const [shatterResult, alertRes] = await (apiCallRef.current || Promise.resolve([null, null]));
      if (alertRes) {
        setAlertResult(alertRes);
        if (alertRes.reportId || alertRes.downloadUrl) setReportInfo(alertRes);
      }
      if (shatterResult) {
        await _processAiResult(shatterResult);
      } else {
        const fallback = await shatterApi.breakdown(taskText.trim(), userId);
        await _processAiResult({ microquests: fallback.microquests, coachMessage: null, envStrategy: null });
      }
    } catch (e) { setError(e.message); setPhase('coaching'); }
  };

  const _processAiResult = async (result) => {
    const rawQuests = result.microquests || [];
    setApiTaskId(result.taskId || null);
    setCoachData({ coachMessage: result.coachMessage, envStrategy: result.envStrategy });

    const frags = rawQuests.map((q, i, arr) => {
      const { x, y } = randomPos(i, arr.length);
      return {
        id:               String(q.id || i+1),
        text:             q.action || q.text || `Step ${i+1}`,
        tip:              q.tip   || "You've got this.",
        duration_minutes: q.duration_minutes || 2,
        colorId:          q.colorId || ['cyan','purple','amber','green','coral'][i%5],
        x, y, slotIndex: null,
      };
    });
    setFragments(frags);
    setSlots(Array(Math.max(MAX_SLOTS, frags.length)).fill(null));
    setPhase('canvas');
  };

  // ── Fragment CRUD ─────────────────────────────────────────────────────────
  const handleDelete        = useCallback((id)       => { setFragments(p=>p.filter(f=>f.id!==id)); setSlots(p=>p.map(s=>s===id?null:s)); }, []);
  const handleTextChange    = useCallback((id, text)  => setFragments(p=>p.map(f=>f.id===id?{...f,text}:f)), []);
  const handleColorChange   = useCallback((id, colorId)=>setFragments(p=>p.map(f=>f.id===id?{...f,colorId}:f)), []);
  const handlePositionChange= useCallback((id, x, y) => setFragments(p=>p.map(f=>f.id===id?{...f,x,y}:f)), []);

  // ── Snap-to-slot ──────────────────────────────────────────────────────────
  const handleDropToSlot = useCallback((fragId, absX, absY) => {
    if (!dockRef.current) return;
    const dock = dockRef.current.getBoundingClientRect();
    if (absX<dock.left||absX>dock.right) return;
    if (absY<dock.top-40||absY>dock.bottom) return;
    const slotEls = dockRef.current.querySelectorAll('[data-slot]');
    let closestSlot=null, closestDist=Infinity;
    slotEls.forEach(el=>{
      const r=el.getBoundingClientRect();
      const dist=Math.abs(absX-(r.left+r.right)/2);
      if(dist<closestDist){closestDist=dist;closestSlot=parseInt(el.getAttribute('data-slot'),10);}
    });
    if(closestSlot===null) return;
    setSlots(prev=>{
      const next=[...prev];
      const existing=next.indexOf(fragId);
      if(existing!==-1) next[existing]=null;
      if(next[closestSlot]!==null) return prev;
      next[closestSlot]=fragId;
      return next;
    });
    setFragments(prev=>prev.map(f=>f.id===fragId?{...f,slotIndex:closestSlot}:f));
    const slotEl=dockRef.current.querySelector(`[data-slot="${closestSlot}"]`);
    if(slotEl){const r=slotEl.getBoundingClientRect();slotConfetti((r.left+r.right)/2,(r.top+r.bottom)/2);}
  }, []);

  const ejectFromSlot = useCallback((fragId, slotIndex) => {
    setSlots(prev=>{const n=[...prev];n[slotIndex]=null;return n;});
    setFragments(prev=>prev.map(f=>f.id===fragId?{...f,slotIndex:null,x:(Math.random()-0.5)*260,y:-80}:f));
  }, []);

  // ── Launch focus mode ─────────────────────────────────────────────────────
  const handleLaunchFocus = async () => {
    const ordered = slots.filter(Boolean).map((fragId,i)=>{
      const f=fragments.find(fr=>fr.id===fragId);
      return f ? { id:i+1, action:f.text, tip:f.tip||"You've got this.", duration_minutes:f.duration_minutes||2, completed:false } : null;
    }).filter(Boolean);

    if (apiTaskId) {
      try {
        await shatterApi.syncTimeline(userId, apiTaskId, ordered);
      } catch (e) {
        setError(e.message || 'Failed to sync timeline order.');
      }
    }

    setActiveTask({ id:apiTaskId||`local-${Date.now()}`, originalTask, microquests:ordered, totalQuests:ordered.length, questsCompleted:0 });
    setPhase('focus');
    bigConfetti();
  };

  // ── Complete quest in focus mode ──────────────────────────────────────────
  const handleDone = useCallback(async () => {
    if(!focusQuest||completing) return;
    setCompleting(true);
    try {
      if(apiTaskId){
        const data=await shatterApi.complete(userId,activeTask.id,focusQuest.id);
        if(data.taskComplete){bigConfetti();completeQuestLocally(focusQuest.id,null);}
        else{slotConfetti(window.innerWidth/2,window.innerHeight*0.65);completeQuestLocally(focusQuest.id,data.nextQuest);}
      } else {
        const rem=focusQuests.filter(q=>!q.completed&&q.id!==focusQuest.id);
        if(!rem.length){bigConfetti();completeQuestLocally(focusQuest.id,null);}
        else{slotConfetti(window.innerWidth/2,window.innerHeight*0.65);completeQuestLocally(focusQuest.id,rem[0]);}
      }
    } catch(e){setError(e.message);}
    finally{setCompleting(false);}
  },[focusQuest,completing,userId,activeTask,focusQuests,apiTaskId,completeQuestLocally]);

  const handleGenerateSessionReport = useCallback(async (sendToGuardian = false) => {
    if (!userId) return;

    const timelineMicroquests = (activeTask?.microquests || slots.filter(Boolean).map((fragId, i) => {
      const f = fragments.find((fr) => fr.id === fragId);
      if (!f) return null;
      return {
        order: i + 1,
        id: String(f.id || i + 1),
        action: f.text,
        tip: f.tip || "You've got this.",
        duration_minutes: f.duration_minutes || 2,
        completed: false,
      };
    }).filter(Boolean)).map((q, idx) => ({
      order: idx + 1,
      id: String(q.id || idx + 1),
      action: q.action || q.text || '',
      tip: q.tip || '',
      duration_minutes: q.duration_minutes || 2,
      completed: Boolean(q.completed),
    }));

    try {
      setReportBusy(true);
      setError(null);

      const res = await clinicalApi.sessionReport({
        userId,
        source: sendToGuardian ? 'panic' : 'manual',
        taskId: apiTaskId || activeTask?.id || undefined,
        currentTask: originalTask || taskText,
        selectedBlocker: selectedBlocker?.label || selectedBlocker?.id || null,
        vocalArousalScore: selectedBlocker?.id === 'too_overwhelming' ? 8 : 5,
        sendToGuardian,
        channels: { whatsapp: true, email: true },
        sessionSnapshot: {
          initialAnxietyQuery: taskText || originalTask,
          shatteredWorryBlocks: worries.map((w) => ({
            id: w.uuid || String(w.id || ''),
            text: w.worry,
            weight: w.weight,
            status: w.status || 'active',
          })),
          timelineMicroquests,
          notes: 'Generated from TaskShatter UI.',
        },
      });

      setReportInfo(res);
      if (res.downloadUrl) window.open(res.downloadUrl, '_blank', 'noopener,noreferrer');
    } catch (e) {
      setError(e.message || 'Failed to generate session report.');
    } finally {
      setReportBusy(false);
    }
  }, [userId, activeTask, slots, fragments, apiTaskId, originalTask, taskText, selectedBlocker, worries]);

  const handleReset = () => {
    if(activeTask) shatterApi.abandon(userId,activeTask?.id).catch(()=>{});
    clearTask();
    setPhase('input'); setFragments([]); setSlots(Array(MAX_SLOTS).fill(null));
    setTaskText(''); setApiTaskId(null); setError(null); setCoachData(null);
    setBlocker(null); setAlertResult(null); setReportInfo(null); setReportBusy(false);
    document.body.style.filter='';
  };

  const activeFreeFrags = fragments.filter(f=>f.slotIndex===null);
  const dockedCount     = fragments.filter(f=>f.slotIndex!==null).length;
  const allDocked       = fragments.length>0 && activeFreeFrags.length===0;

  /* ── CANVAS BACKGROUND (shared) ─────────────────────────── */
  const canvasBg = {
    background: '#020915',
    backgroundImage: `
      radial-gradient(ellipse 80% 50% at 50% 0%, rgba(0,60,110,0.55) 0%, transparent 55%),
      radial-gradient(ellipse 50% 50% at 10% 80%, rgba(124,58,237,0.07) 0%, transparent 55%),
      radial-gradient(ellipse 50% 50% at 90% 75%, rgba(0,191,165,0.05) 0%, transparent 55%)
    `,
  };
  const dotGrid = { position:'absolute', inset:0, pointerEvents:'none', backgroundImage:'radial-gradient(rgba(0,229,255,0.1) 1px, transparent 1px)', backgroundSize:'36px 36px', opacity:0.3 };

  /* ══════════════════════════════════════════════════════════════
     PHASE: INPUT
   ══════════════════════════════════════════════════════════════ */
  if(phase==='input') return (
    <div style={{position:'fixed',inset:0,display:'flex',alignItems:'center',justifyContent:'center',overflow:'hidden',...canvasBg}}>
      <div style={{...dotGrid}}/>
      <motion.div initial={{opacity:0,y:30,scale:0.96}} animate={{opacity:1,y:0,scale:1}} transition={{type:'spring',stiffness:160,damping:18}}
        style={{width:'100%',maxWidth:580,padding:'0 22px',position:'relative',zIndex:1}}>
        <div style={{textAlign:'center',marginBottom:36}}>
          <motion.div animate={{scale:[1,1.08,1],opacity:[0.7,1,0.7]}} transition={{duration:3.5,repeat:Infinity,ease:'easeInOut'}}
            style={{display:'inline-flex',alignItems:'center',justifyContent:'center',width:56,height:56,borderRadius:'50%',marginBottom:18,
              background:'conic-gradient(from 180deg,#7c3aed,#00e5ff,#00bfa5,#7c3aed)',
              boxShadow:'0 0 28px rgba(0,229,255,0.35),0 0 60px rgba(124,58,237,0.2)'}}>
            <Zap size={24} color="white"/>
          </motion.div>
          <h1 style={{fontSize:'clamp(26px,5vw,38px)',fontWeight:800,letterSpacing:'-0.045em',color:'#e8f4fb',lineHeight:1.15,marginBottom:10}}>
            What's holding you{' '}
            <span style={{background:'linear-gradient(135deg,#00e5ff,#c4b5fd)',WebkitBackgroundClip:'text',WebkitTextFillColor:'transparent'}}>still?</span>
          </h1>
          <p style={{fontSize:15,color:'#8bafc2',lineHeight:1.65}}>
            Dump your most overwhelming project. Aura's Coach will tailor the approach to your exact state.
          </p>
        </div>
        <div style={{position:'relative',marginBottom:20}}>
          <textarea value={taskText} onChange={e=>setTaskText(e.target.value)}
            onKeyDown={e=>{if(e.key==='Enter'&&e.metaKey)handleShowCoach();}}
            rows={5} placeholder="Dump your overwhelming project here..."
            style={{width:'100%',background:'rgba(255,255,255,0.025)',border:'1px solid rgba(0,229,255,0.2)',borderRadius:18,padding:'20px 22px',color:'#e8f4fb',fontFamily:'inherit',fontSize:16,lineHeight:1.7,resize:'none',outline:'none',boxShadow:'inset 0 1px 0 rgba(255,255,255,0.04)',transition:'border-color 0.2s,box-shadow 0.2s'}}
            onFocus={e=>{e.target.style.borderColor='rgba(0,229,255,0.5)';e.target.style.boxShadow='0 0 0 3px rgba(0,229,255,0.1)';}}
            onBlur={e=>{e.target.style.borderColor='rgba(0,229,255,0.2)';e.target.style.boxShadow='none';}}
          />
          <div style={{position:'absolute',bottom:14,right:16,fontSize:11,color:'rgba(139,175,194,0.5)',fontWeight:500}}>⌘↵</div>
        </div>
        <motion.button onClick={handleShowCoach} disabled={taskText.trim().length<3}
          whileHover={{scale:1.02,boxShadow:'0 12px 40px rgba(124,58,237,0.45)'}} whileTap={{scale:0.97}}
          style={{width:'100%',padding:'18px',background:'linear-gradient(135deg,#5b21b6,#7c3aed,#00b4d8)',backgroundSize:'200% 200%',animation:'gradSpin 6s ease infinite',border:'none',borderRadius:18,color:'white',fontFamily:'inherit',fontSize:17,fontWeight:800,letterSpacing:'-0.025em',cursor:taskText.trim().length<3?'not-allowed':'pointer',opacity:taskText.trim().length<3?0.45:1,boxShadow:'0 6px 32px rgba(124,58,237,0.35)',display:'flex',alignItems:'center',justifyContent:'center',gap:10}}>
          <Zap size={20}/>Talk to Aura Coach<ArrowRight size={18}/>
        </motion.button>
        {error && <p style={{marginTop:14,fontSize:13,color:'#ffb3c1',textAlign:'center'}}>{error}</p>}
      </motion.div>
    </div>
  );

  /* ══════════════════════════════════════════════════════════════
     PHASE: COACHING — "What is blocking you?"
   ══════════════════════════════════════════════════════════════ */
  if(phase==='coaching') return (
    <div style={{position:'fixed',inset:0,display:'flex',alignItems:'center',justifyContent:'center',overflow:'hidden',...canvasBg}}>
      <div style={{...dotGrid}}/>
      <motion.div initial={{opacity:0,scale:0.94,y:20}} animate={{opacity:1,scale:1,y:0}} transition={{type:'spring',stiffness:200,damping:20}}
        style={{width:'100%',maxWidth:520,padding:'0 22px',position:'relative',zIndex:1}}>
        <div style={{background:'rgba(6,14,30,0.88)',backdropFilter:'blur(24px)',border:'1px solid rgba(0,229,255,0.18)',borderRadius:28,padding:'36px 32px'}}>
          {/* Orb */}
          <div style={{textAlign:'center',marginBottom:28}}>
            <motion.div animate={{scale:[1,1.06,1],opacity:[0.8,1,0.8]}} transition={{duration:2.5,repeat:Infinity}}
              style={{display:'inline-flex',width:52,height:52,borderRadius:'50%',alignItems:'center',justifyContent:'center',marginBottom:16,background:'linear-gradient(135deg,#7c3aed,#00e5ff)',boxShadow:'0 0 24px rgba(0,229,255,0.3)'}}>
              <Brain size={22} color="white"/>
            </motion.div>
            <h2 style={{fontSize:20,fontWeight:800,letterSpacing:'-0.04em',color:'#e8f4fb',marginBottom:8}}>Aura Coach</h2>
            <p style={{fontSize:14,color:'#8bafc2',lineHeight:1.6}}>
              I've got <em style={{color:'#c4b5fd'}}>"{taskText.slice(0,42)}{taskText.length>42?'…':''}"</em>.<br/>
              What's the main thing stopping you right now?
            </p>
          </div>

          {/* Blocker options */}
          <div style={{display:'flex',flexDirection:'column',gap:10}}>
            {BLOCKERS.map(b=>{
              const Icon=b.icon;
              return (
                <motion.button key={b.id} onClick={()=>handleBlockerSelected(b)}
                  whileHover={{scale:1.02,borderColor:'rgba(0,229,255,0.4)'}} whileTap={{scale:0.97}}
                  style={{display:'flex',alignItems:'center',gap:14,padding:'16px 20px',background:'rgba(255,255,255,0.03)',border:'1px solid rgba(255,255,255,0.08)',borderRadius:16,cursor:'pointer',textAlign:'left',transition:'border-color 0.2s'}}>
                  <div style={{width:40,height:40,borderRadius:12,background:'rgba(0,229,255,0.08)',border:'1px solid rgba(0,229,255,0.15)',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                    <Icon size={18} color="#00e5ff"/>
                  </div>
                  <div>
                    <p style={{fontSize:14,fontWeight:700,color:'#e8f4fb',letterSpacing:'-0.01em',marginBottom:2}}>{b.label}</p>
                    <p style={{fontSize:12,color:'#4a6275'}}>{b.desc}</p>
                  </div>
                  <ArrowRight size={16} color="rgba(139,175,194,0.35)" style={{marginLeft:'auto',flexShrink:0}}/>
                </motion.button>
              );
            })}
          </div>

          <button onClick={()=>setPhase('input')} style={{display:'block',margin:'20px auto 0',fontSize:12,color:'#4a6275',background:'none',border:'none',cursor:'pointer'}}>← Back</button>
        </div>
      </motion.div>
    </div>
  );

  /* ══════════════════════════════════════════════════════════════
     PHASE: INTERVENTION — Breathing ring while API runs in background
   ══════════════════════════════════════════════════════════════ */
  if(phase==='intervention') return (
    <>
      {/* Dark canvas behind ring */}
      <div style={{position:'fixed',inset:0,...canvasBg}}/>
      <SymptomInterruption
        onComplete={handleInterventionComplete}
        coachMessage={`I hear you. "${taskText.slice(0,48)}…" is a heavy lift. I've notified your support network and I'm building your game plan right now. Let's reset first.`}
      />
      {/* Clinical alert toast */}
      <AnimatePresence>
        {alertResult && (
          <motion.div initial={{opacity:0,y:20}} animate={{opacity:1,y:0}} exit={{opacity:0}}
            style={{position:'fixed',bottom:100,left:'50%',transform:'translateX(-50%)',zIndex:600,
              background:'rgba(0,229,255,0.08)',border:'1px solid rgba(0,229,255,0.25)',
              borderRadius:14,padding:'10px 20px',display:'flex',alignItems:'center',gap:10,
              backdropFilter:'blur(16px)'}}>
            <div style={{width:8,height:8,borderRadius:'50%',background:'#00e676',boxShadow:'0 0 8px #00e676'}}/>
            <p style={{fontSize:12,color:'#80deea',fontWeight:600}}>
              {alertResult?.delivery?.whatsapp?.status === 'failed' && alertResult?.delivery?.email?.status === 'failed'
                ? 'Guardian delivery failed (report still saved).'
                : `Guardian triage update sent | Risk: ${alertResult.riskLevel || 'watch'}`}
            </p>
            {alertResult?.downloadUrl && (
              <button
                onClick={() => window.open(alertResult.downloadUrl, '_blank', 'noopener,noreferrer')}
                style={{
                  marginLeft: 6,
                  border: '1px solid rgba(0,229,255,0.35)',
                  background: 'rgba(0,229,255,0.08)',
                  color: '#b8f5ff',
                  borderRadius: 999,
                  padding: '4px 10px',
                  fontSize: 11,
                  cursor: 'pointer',
                }}
              >
                Open PDF
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );

  /* ══════════════════════════════════════════════════════════════
     PHASE: LOADING — Shattering animation
   ══════════════════════════════════════════════════════════════ */
  if(phase==='loading') return (
    <div style={{position:'fixed',inset:0,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:28,...canvasBg}}>
      <div style={{...dotGrid}}/>
      <div style={{position:'relative',width:120,height:120}}>
        {[0,1,2,3,4,5].map(i=>(
          <motion.div key={i}
            style={{position:'absolute',top:'50%',left:'50%',width:14,height:14,borderRadius:'30% 70% 70% 30% / 30% 30% 70% 70%',
              background:COLORS[i%COLORS.length].border,boxShadow:`0 0 12px ${COLORS[i%COLORS.length].glow}`,marginLeft:-7,marginTop:-7}}
            animate={{x:Math.cos((i/6)*Math.PI*2)*(30+Math.sin(i)*10),y:Math.sin((i/6)*Math.PI*2)*(30+Math.cos(i)*10),rotate:[0,360],scale:[0.8,1.3,0.8]}}
            transition={{duration:1.2+i*0.15,repeat:Infinity,ease:'easeInOut',delay:i*0.1}}
          />
        ))}
        <motion.div animate={{scale:[1,1.2,1],opacity:[0.6,1,0.6]}} transition={{duration:1.5,repeat:Infinity}}
          style={{position:'absolute',top:'50%',left:'50%',width:28,height:28,borderRadius:'50%',marginLeft:-14,marginTop:-14,
            background:'radial-gradient(circle,#00e5ff,#7c3aed)',boxShadow:'0 0 20px rgba(0,229,255,0.6)'}}/>
      </div>
      <div style={{textAlign:'center',position:'relative',zIndex:1}}>
        <p style={{fontSize:18,fontWeight:700,color:'#e8f4fb',letterSpacing:'-0.03em',marginBottom:8}}>
          {selectedBlocker ? 'Aura Coach is calibrating…' : 'Shattering the task…'}
        </p>
        <p style={{fontSize:13,color:'#8bafc2'}}>
          Building steps tailored to{' '}
          <span style={{color:'#c4b5fd'}}>{selectedBlocker?.desc || 'your current state'}</span>
        </p>
      </div>
    </div>
  );

  /* ══════════════════════════════════════════════════════════════
     PHASE: FOCUS — Quest-by-quest execution
   ══════════════════════════════════════════════════════════════ */
  if(phase==='focus'){
    if(taskComplete||!focusQuest) return (
      <div style={{position:'fixed',inset:0,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:22,...canvasBg}}>
        <motion.div initial={{scale:0.3,opacity:0}} animate={{scale:1,opacity:1}} transition={{type:'spring',stiffness:200,damping:15}}>
          <Trophy size={72} color="#ffb300" style={{filter:'drop-shadow(0 0 20px rgba(255,179,0,0.5))'}}/>
        </motion.div>
        <div style={{textAlign:'center'}}>
          <h1 style={{fontSize:34,fontWeight:800,color:'#e8f4fb',letterSpacing:'-0.04em',marginBottom:8}}>Completely shattered. ✦</h1>
          <p style={{color:'#8bafc2',fontSize:15}}>{originalTask}</p>
        </div>
        <motion.button className="btn btn-primary" onClick={handleReset} whileHover={{scale:1.03}} whileTap={{scale:0.97}} style={{padding:'15px 36px',fontSize:15}}>
          <Zap size={15}/> Shatter another
        </motion.button>
        <div style={{ display:'flex', gap:10 }}>
          <motion.button
            className="btn btn-secondary"
            onClick={() => handleGenerateSessionReport(false)}
            disabled={reportBusy}
            whileTap={{scale:0.97}}
          >
            {reportBusy ? 'Generating...' : 'Download Session Report'}
          </motion.button>
          <motion.button
            className="btn btn-ghost"
            onClick={() => handleGenerateSessionReport(true)}
            disabled={reportBusy}
            whileTap={{scale:0.97}}
          >
            {reportBusy ? 'Sending...' : 'Send To Guardian'}
          </motion.button>
        </div>
        {reportInfo?.downloadUrl && (
          <button
            onClick={() => window.open(reportInfo.downloadUrl, '_blank', 'noopener,noreferrer')}
            style={{ background:'none', border:'none', color:'#80deea', fontSize:12, cursor:'pointer' }}
          >
            Open latest report
          </button>
        )}
      </div>
    );

    return (
      <>
        {showBodyDouble && <BodyDouble taskAction={focusQuest?.action} onDismiss={()=>setBodyDouble(false)} isFullscreen/>}
        <div style={{position:'fixed',inset:0,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',padding:'0 22px',...canvasBg}}>
          <div style={{width:'100%',maxWidth:620}}>
            {/* Coach message banner */}
            <AnimatePresence>
              {coachData?.coachMessage && (
                <motion.div initial={{opacity:0,height:0}} animate={{opacity:1,height:'auto'}} exit={{opacity:0}}
                  style={{background:'rgba(0,229,255,0.06)',border:'1px solid rgba(0,229,255,0.2)',borderRadius:16,padding:'14px 18px',marginBottom:20}}>
                  <p style={{fontSize:10.5,color:'#00e5ff',fontWeight:700,textTransform:'uppercase',letterSpacing:'0.1em',marginBottom:5}}>Aura Coach</p>
                  <p style={{fontSize:14,color:'#e8f4fb',lineHeight:1.65}}>{coachData.coachMessage}</p>
                </motion.div>
              )}
            </AnimatePresence>

            <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:20}}>
              <div style={{flex:1,paddingRight:16}}>
                <span className="badge badge-purple" style={{marginBottom:8}}><Zap size={10}/> Focus block</span>
                <p style={{fontSize:12,color:'#4a6275',lineHeight:1.5,marginTop:4}}>{originalTask}</p>
              </div>
              <motion.button className="btn btn-ghost" onClick={handleReset} whileTap={{scale:0.94}} style={{flexShrink:0,display:'flex',alignItems:'center',gap:5}}>
                <RotateCcw size={13}/> Reset
              </motion.button>
            </div>

            <div style={{display:'flex',alignItems:'center',gap:14,marginBottom:32}}>
              <div className="progress-track" style={{flex:1}}>
                <div className="progress-fill" style={{width:`${progress}%`}}/>
              </div>
              <span style={{fontSize:12,color:'#4a6275',fontWeight:600,whiteSpace:'nowrap'}}>{completedN}/{focusQuests.length}</span>
            </div>

            <div style={{position:'relative',marginBottom:22}}>
              {/* Focus ring */}
              <div style={{position:'absolute',inset:-1.5,borderRadius:28,background:'linear-gradient(135deg,#7c3aed,#00e5ff,#5eead4,#7c3aed)',backgroundSize:'300% 300%',animation:'focusBorderSpin 5s linear infinite,focusPulse 4s ease-in-out infinite',WebkitMask:'linear-gradient(#fff 0 0) content-box,linear-gradient(#fff 0 0)',WebkitMaskComposite:'xor',maskComposite:'exclude',padding:1.5,pointerEvents:'none'}}/>
              <div style={{background:'linear-gradient(145deg,rgba(10,20,40,0.92),rgba(4,12,28,0.96))',borderRadius:26,padding:'38px 34px',backdropFilter:'blur(20px)'}}>
                <div style={{display:'flex',justifyContent:'space-between',marginBottom:20}}>
                  <span style={{fontSize:11,fontWeight:700,letterSpacing:'0.1em',textTransform:'uppercase',color:'#c4b5fd'}}>Step {(currentQuestIndex||0)+1} of {focusQuests.length}</span>
                  <span style={{fontSize:11,color:'#4a6275',fontWeight:600}}>~{focusQuest.duration_minutes||2} min</span>
                </div>
                <p style={{fontSize:'clamp(18px,3vw,25px)',fontWeight:800,lineHeight:1.38,letterSpacing:'-0.03em',color:'#e8f4fb',marginBottom:22}}>{focusQuest.action}</p>
                {focusQuest.tip&&(
                  <div style={{borderTop:'1px solid rgba(255,255,255,0.06)',paddingTop:16,display:'flex',gap:10}}>
                    <span style={{fontSize:16}}>💡</span>
                    <p style={{fontSize:14,color:'#80deea',lineHeight:1.65}}>{focusQuest.tip}</p>
                  </div>
                )}
              </div>
            </div>

            <motion.button onClick={handleDone} disabled={completing}
              whileHover={{scale:1.015,boxShadow:'0 10px 44px rgba(124,58,237,0.45)'}} whileTap={{scale:0.955}}
              style={{width:'100%',padding:'22px',borderRadius:18,border:'none',background:'linear-gradient(135deg,#5b21b6,#7c3aed,#00b4d8)',backgroundSize:'200% 200%',animation:'gradSpin 6s ease infinite',color:'white',fontFamily:'inherit',fontSize:17,fontWeight:800,letterSpacing:'-0.025em',boxShadow:'0 6px 36px rgba(124,58,237,0.35)',marginBottom:14,cursor:completing?'not-allowed':'pointer',display:'flex',alignItems:'center',justifyContent:'center',gap:10}}>
              {completing?<div className="spinner"/>:<Check size={20}/>}
              {completing?'Saving…':'Done — next fragment'}
              {!completing&&<ArrowRight size={18}/>}
            </motion.button>

            <div style={{display:'flex',justifyContent:'center',gap:10,flexWrap:'wrap'}}>
              <motion.button className="btn btn-secondary" onClick={toggleNoise} whileTap={{scale:0.95}} style={{fontSize:12,padding:'8px 18px',gap:7,display:'flex',alignItems:'center'}}>
                {noiseEnabled?<Music size={13}/>:<VolumeX size={13}/>}
                {noiseEnabled?'Brown noise on':'Brown noise off'}
              </motion.button>
              <motion.button
                className="btn btn-ghost"
                onClick={() => handleGenerateSessionReport(false)}
                whileTap={{scale:0.95}}
                disabled={reportBusy}
                style={{fontSize:12,padding:'8px 16px'}}
              >
                {reportBusy ? 'Generating...' : 'Download report'}
              </motion.button>
            </div>
            {error&&<p style={{marginTop:14,fontSize:13,color:'#ffb3c1',textAlign:'center'}}>{error}</p>}
          </div>
        </div>
      </>
    );
  }

  /* ══════════════════════════════════════════════════════════════
     PHASE: CANVAS — The Shattered Canvas
   ══════════════════════════════════════════════════════════════ */
  return (
    <div ref={constraintsRef} style={{position:'fixed',inset:0,overflow:'hidden',...canvasBg}}>
      <div style={{...dotGrid}}/>

      {/* Top bar */}
      <div style={{position:'absolute',top:0,left:0,right:0,zIndex:200,display:'flex',alignItems:'center',justifyContent:'space-between',padding:'14px 22px',background:'rgba(2,9,21,0.88)',backdropFilter:'blur(20px)',borderBottom:'1px solid rgba(255,255,255,0.05)'}}>
        <span className="badge badge-cyan"><Zap size={10}/> Shattered Canvas</span>
        <p style={{fontSize:12.5,color:'#4a6275',fontWeight:500,textAlign:'center',flex:1,margin:'0 16px'}}>Drag fragments into the timeline — then launch focus mode</p>
        <motion.button className="btn btn-ghost" onClick={handleReset} whileTap={{scale:0.92}} style={{fontSize:12,display:'flex',alignItems:'center',gap:5}}>
          <RotateCcw size={12}/> Restart
        </motion.button>
      </div>

      {/* Coach message ribbon */}
      <AnimatePresence>
        {coachData?.coachMessage && (
          <motion.div initial={{opacity:0,y:-20}} animate={{opacity:1,y:0}} exit={{opacity:0}}
            style={{position:'absolute',top:68,left:'50%',transform:'translateX(-50%)',zIndex:190,
              background:'rgba(0,229,255,0.07)',backdropFilter:'blur(16px)',
              border:'1px solid rgba(0,229,255,0.18)',borderRadius:14,
              padding:'10px 20px',maxWidth:520,textAlign:'center'}}>
            <p style={{fontSize:13,color:'#80deea',lineHeight:1.55}}>{coachData.coachMessage}</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Fragment cards */}
      {fragments.map(frag=>(
        <FragmentCard key={frag.id} frag={frag} isDocked={frag.slotIndex!==null}
          onPositionChange={handlePositionChange} onDelete={handleDelete}
          onTextChange={handleTextChange} onColorChange={handleColorChange}
          onDropToSlot={handleDropToSlot} constraintsRef={constraintsRef}
          onDragVelocity={recordDragEvent}
        />
      ))}

      {/* Empty canvas hint */}
      {activeFreeFrags.length>0 && (
        <motion.div initial={{opacity:0}} animate={{opacity:1}} transition={{delay:1.2}}
          style={{position:'absolute',top:'50%',left:'50%',transform:'translate(-50%,-50%)',pointerEvents:'none',textAlign:'center',zIndex:1}}>
          <p style={{fontSize:12,color:'rgba(139,175,194,0.3)',letterSpacing:'0.08em',fontWeight:600,textTransform:'uppercase'}}>
            {activeFreeFrags.length} fragment{activeFreeFrags.length!==1?'s':''} free · drag into timeline
          </p>
        </motion.div>
      )}

      {/* Launch button */}
      <AnimatePresence>
        {allDocked && (
          <motion.div initial={{opacity:0,y:20,scale:0.9}} animate={{opacity:1,y:0,scale:1}} exit={{opacity:0,y:20}}
            style={{position:'absolute',bottom:148,left:'50%',transform:'translateX(-50%)',zIndex:300}}>
            <motion.button onClick={handleLaunchFocus}
              whileHover={{scale:1.04,boxShadow:'0 14px 50px rgba(0,229,255,0.4)'}} whileTap={{scale:0.96}}
              animate={{boxShadow:['0 6px 30px rgba(0,229,255,0.2)','0 10px 50px rgba(0,229,255,0.45)','0 6px 30px rgba(0,229,255,0.2)']}}
              transition={{duration:2.5,repeat:Infinity,ease:'easeInOut'}}
              style={{padding:'16px 40px',borderRadius:999,border:'none',background:'linear-gradient(135deg,#00b4d8,#00e5ff)',color:'#020915',fontFamily:'inherit',fontSize:16,fontWeight:800,letterSpacing:'-0.025em',cursor:'pointer',display:'flex',alignItems:'center',gap:10,boxShadow:'0 6px 30px rgba(0,229,255,0.3)'}}>
              <Play size={18} fill="#020915"/>Launch Focus Mode<ArrowRight size={16}/>
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Assembly Line dock */}
      <div ref={dockRef} style={{position:'absolute',bottom:0,left:0,right:0,zIndex:200,background:'rgba(2,9,21,0.92)',backdropFilter:'blur(28px)',borderTop:'1px solid rgba(0,229,255,0.15)',boxShadow:'0 -8px 40px rgba(0,229,255,0.08)',padding:'14px 20px'}}>
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:10}}>
          <p style={{fontSize:10.5,color:'rgba(0,229,255,0.6)',fontWeight:700,letterSpacing:'0.12em',textTransform:'uppercase'}}>⟵ Assembly Timeline ⟶</p>
          <p style={{fontSize:10.5,color:'#4a6275',fontWeight:500}}>{dockedCount} / {fragments.length} placed</p>
        </div>
        <div style={{display:'flex',gap:10,overflowX:'auto',paddingBottom:4,scrollbarWidth:'none'}}>
          {Array.from({length:Math.max(MAX_SLOTS,fragments.length)},(_,i)=>{
            const fragId=slots[i];
            const frag=fragId?fragments.find(f=>f.id===fragId):null;
            const color=frag?(COLORS.find(c=>c.id===frag.colorId)||COLORS[0]):null;
            return (
              <motion.div key={i} data-slot={i} layout initial={{opacity:0,y:10}} animate={{opacity:1,y:0}} transition={{delay:i*0.04}}
                style={{flexShrink:0,width:160,minHeight:72,borderRadius:14,
                  border:frag?`1px solid ${color.border}`:'1px dashed rgba(0,229,255,0.18)',
                  background:frag?`linear-gradient(135deg,${color.bg},rgba(6,14,30,0.9))`:'rgba(255,255,255,0.015)',
                  boxShadow:frag?`0 4px 20px ${color.glow.replace('0.4','0.2')}`:'none',
                  display:'flex',flexDirection:'column',alignItems:frag?'flex-start':'center',justifyContent:frag?'flex-start':'center',
                  padding:frag?'10px 12px':'0',position:'relative',transition:'all 0.2s'}}>
                <span style={{position:'absolute',top:7,left:9,fontSize:9.5,fontWeight:700,letterSpacing:'0.08em',color:frag?color.border:'rgba(0,229,255,0.25)',textTransform:'uppercase'}}>{i+1}</span>
                {frag?(
                  <>
                    <div style={{height:16}}/>
                    <p style={{fontSize:12,fontWeight:700,color:'#e8f4fb',lineHeight:1.35,marginBottom:6}}>{frag.text.slice(0,55)}{frag.text.length>55?'…':''}</p>
                    <div style={{display:'flex',justifyContent:'space-between',width:'100%',alignItems:'center'}}>
                      <span style={{fontSize:9.5,color:color.border,fontWeight:600,opacity:0.8}}>~{frag.duration_minutes||2}m</span>
                      <button onClick={()=>ejectFromSlot(frag.id,i)} style={{fontSize:10,color:'rgba(255,255,255,0.25)',background:'none',border:'none',cursor:'pointer',padding:'2px 4px',borderRadius:4}} title="Return to canvas">×</button>
                    </div>
                  </>
                ):(
                  <p style={{fontSize:10.5,color:'rgba(0,229,255,0.2)',fontWeight:500}}>Drop here</p>
                )}
              </motion.div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

