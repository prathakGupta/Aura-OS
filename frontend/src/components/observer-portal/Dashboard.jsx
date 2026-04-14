// Dashboard.jsx  🌟 NEW — Observer Portal for therapists/parents
// Accessed at /portal?uid=<userId>
// Clean white-accented design (contrast with dark user app) using recharts.

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Activity, Brain, Zap, Shield, FileText, RefreshCw, User, Link } from 'lucide-react';
import VsiChart  from './VsiChart.jsx';
import TriageLog from './TriageLog.jsx';
import { clinicalApi } from '../../services/portalApi.js';

const STAT_CARDS = [
  { key:'tasksCompleted', label:'Tasks Completed', icon:Zap,      color:'#00e676' },
  { key:'tasksAbandoned', label:'Tasks Abandoned', icon:Activity,  color:'#ff6b8a' },
  { key:'forgeSessions',  label:'Forge Sessions',  icon:Brain,     color:'#c4b5fd' },
  { key:'stressSpikes',   label:'Stress Spikes',   icon:Shield,    color:'#ffb300' },
];

export default function Dashboard() {
  const [userId,   setUserId]   = useState('');
  const [inputUid, setInputUid] = useState('');
  const [data,     setData]     = useState(null);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState(null);
  const [days,     setDays]     = useState(7);
  const [generating, setGen]    = useState(false);
  const [brief,    setBrief]    = useState(null);

  // Auto-load from URL param
  useEffect(() => {
    const uid = new URLSearchParams(window.location.search).get('uid');
    if (uid) { setUserId(uid); setInputUid(uid); }
  }, []);

  const fetchData = async (uid) => {
    if (!uid) return;
    setLoading(true); setError(null); setData(null);
    try {
      const res = await clinicalApi.getDashboard(uid, days);
      setData(res);
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  };

  useEffect(() => { if (userId) fetchData(userId); }, [userId, days]); // eslint-disable-line

  const handleGenerateBrief = async () => {
    setGen(true); setBrief(null);
    try {
      const res = await clinicalApi.therapyBrief(userId);
      setBrief(res.brief);
    } catch (e) { setError(e.message); }
    finally { setGen(false); }
  };

  return (
    <div style={{
      minHeight:'100dvh', background:'#f0f4f8',
      fontFamily:'var(--font,system-ui,sans-serif)', color:'#1a2633',
    }}>
      {/* Header */}
      <div style={{ background:'white', borderBottom:'1px solid #e2e8f0', padding:'0 28px', height:64, display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <div style={{ width:32, height:32, borderRadius:'50%', background:'conic-gradient(from 180deg,#7c3aed,#00e5ff,#00bfa5,#7c3aed)' }}/>
          <div>
            <p style={{ fontSize:15, fontWeight:800, color:'#1a2633', letterSpacing:'-0.03em' }}>AuraOS Observer Portal</p>
            <p style={{ fontSize:11, color:'#64748b' }}>Clinical Telemetry Dashboard</p>
          </div>
        </div>
        {userId && (
          <div style={{ display:'flex', gap:8 }}>
            {[7,14,30].map(d => (
              <button key={d} onClick={()=>setDays(d)}
                style={{ padding:'5px 14px', borderRadius:99, fontSize:12, fontWeight:600, border:'1px solid',
                  borderColor:days===d?'#7c3aed':'#e2e8f0', background:days===d?'#7c3aed':'white',
                  color:days===d?'white':'#64748b', cursor:'pointer' }}>
                {d}d
              </button>
            ))}
            <button onClick={()=>fetchData(userId)} style={{ padding:'5px 12px', borderRadius:99, border:'1px solid #e2e8f0', background:'white', cursor:'pointer', display:'flex', alignItems:'center', gap:5, fontSize:12, color:'#64748b' }}>
              <RefreshCw size={12}/> Refresh
            </button>
          </div>
        )}
      </div>

      <div style={{ maxWidth:960, margin:'0 auto', padding:'32px 24px' }}>
        {/* UID input */}
        {!userId && (
          <motion.div initial={{opacity:0,y:16}} animate={{opacity:1,y:0}}
            style={{ background:'white', borderRadius:20, padding:'32px', boxShadow:'0 4px 24px rgba(0,0,0,0.06)', marginBottom:28, textAlign:'center' }}>
            <User size={32} color="#7c3aed" style={{ margin:'0 auto 16px' }}/>
            <h2 style={{ fontSize:18, fontWeight:700, marginBottom:8, color:'#1a2633' }}>Enter Patient ID</h2>
            <p style={{ fontSize:13, color:'#64748b', marginBottom:20 }}>Enter the AuraOS user ID to view their clinical telemetry.</p>
            <div style={{ display:'flex', gap:10, maxWidth:420, margin:'0 auto' }}>
              <input value={inputUid} onChange={e=>setInputUid(e.target.value)}
                onKeyDown={e=>{ if(e.key==='Enter'&&inputUid.trim()) setUserId(inputUid.trim()); }}
                placeholder="e.g. local-1234567890"
                style={{ flex:1, padding:'12px 16px', border:'1px solid #e2e8f0', borderRadius:12, fontSize:14, outline:'none', fontFamily:'inherit' }}/>
              <button onClick={()=>setUserId(inputUid.trim())} disabled={!inputUid.trim()}
                style={{ padding:'12px 22px', background:'#7c3aed', color:'white', border:'none', borderRadius:12, fontWeight:700, fontSize:14, cursor:'pointer', display:'flex', alignItems:'center', gap:6 }}>
                <Link size={14}/> Connect
              </button>
            </div>
          </motion.div>
        )}

        {/* Error */}
        {error && (
          <div style={{ background:'#fff5f5', border:'1px solid #fecaca', borderRadius:14, padding:'14px 18px', marginBottom:20, color:'#ef4444', fontSize:14 }}>
            {error}
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div style={{ textAlign:'center', padding:60 }}>
            <div style={{ width:40, height:40, border:'3px solid #e2e8f0', borderTopColor:'#7c3aed', borderRadius:'50%', animation:'spin 0.7s linear infinite', margin:'0 auto 16px' }}/>
            <p style={{ color:'#64748b', fontSize:14 }}>Loading telemetry…</p>
          </div>
        )}

        {/* Dashboard content */}
        {data && !loading && (
          <motion.div initial={{opacity:0}} animate={{opacity:1}}>
            {/* Patient info bar */}
            <div style={{ background:'white', borderRadius:16, padding:'16px 22px', marginBottom:20, boxShadow:'0 2px 12px rgba(0,0,0,0.04)', display:'flex', justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:12 }}>
              <div>
                <p style={{ fontSize:11, color:'#94a3b8', fontWeight:600, textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:3 }}>Patient ID</p>
                <p style={{ fontSize:15, fontWeight:700, color:'#1a2633' }}>{data.userId}</p>
              </div>
              {data.guardian?.name && (
                <div>
                  <p style={{ fontSize:11, color:'#94a3b8', fontWeight:600, textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:3 }}>Guardian</p>
                  <p style={{ fontSize:15, fontWeight:700, color:'#1a2633' }}>{data.guardian.name} · {data.guardian.relation}</p>
                </div>
              )}
              <div>
                <p style={{ fontSize:11, color:'#94a3b8', fontWeight:600, textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:3 }}>Avg Vocal Arousal</p>
                <p style={{ fontSize:15, fontWeight:700, color: data.stats?.avgVocalArousal >= 7 ? '#ef4444' : data.stats?.avgVocalArousal >= 5 ? '#f59e0b' : '#22c55e' }}>
                  {data.stats?.avgVocalArousal || 'N/A'} / 10
                </p>
              </div>
              <button onClick={handleGenerateBrief} disabled={generating}
                style={{ padding:'10px 20px', background:'#7c3aed', color:'white', border:'none', borderRadius:12, fontWeight:700, fontSize:13, cursor:'pointer', display:'flex', alignItems:'center', gap:6, opacity:generating?0.7:1 }}>
                <FileText size={14}/> {generating ? 'Generating…' : 'Generate Therapy Brief'}
              </button>
            </div>

            {/* Stat cards */}
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(180px,1fr))', gap:12, marginBottom:20 }}>
              {STAT_CARDS.map(sc=>{
                const Icon=sc.icon;
                return (
                  <motion.div key={sc.key} initial={{opacity:0,scale:0.95}} animate={{opacity:1,scale:1}}
                    style={{ background:'white', borderRadius:16, padding:'18px 20px', boxShadow:'0 2px 12px rgba(0,0,0,0.04)' }}>
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
                      <p style={{ fontSize:12, color:'#94a3b8', fontWeight:600, textTransform:'uppercase', letterSpacing:'0.07em' }}>{sc.label}</p>
                      <div style={{ width:30, height:30, borderRadius:8, background:`${sc.color}18`, display:'flex', alignItems:'center', justifyContent:'center' }}>
                        <Icon size={14} color={sc.color}/>
                      </div>
                    </div>
                    <p style={{ fontSize:28, fontWeight:800, color:'#1a2633', marginTop:8 }}>
                      {data.stats?.[sc.key] ?? '—'}
                    </p>
                  </motion.div>
                );
              })}
            </div>

            {/* Charts row */}
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16, marginBottom:20 }}>
              {/* VSI Chart */}
              <div style={{ background:'white', borderRadius:16, padding:'22px', boxShadow:'0 2px 12px rgba(0,0,0,0.04)' }}>
                <p style={{ fontSize:13, fontWeight:700, color:'#1a2633', marginBottom:4 }}>Vocal Stress Index</p>
                <p style={{ fontSize:11, color:'#94a3b8', marginBottom:16 }}>Daily average arousal score (1–10)</p>
                <VsiChart data={data.charts?.vsiByDay}/>
              </div>

              {/* Executive Function */}
              <div style={{ background:'white', borderRadius:16, padding:'22px', boxShadow:'0 2px 12px rgba(0,0,0,0.04)' }}>
                <p style={{ fontSize:13, fontWeight:700, color:'#1a2633', marginBottom:4 }}>Executive Function Score</p>
                <p style={{ fontSize:11, color:'#94a3b8', marginBottom:16 }}>Daily task completion rate (%)</p>
                {data.charts?.execByDay?.length ? (
                  <ResponsiveContainer width="100%" height={180}>
                    <BarChart data={data.charts.execByDay} margin={{top:10,right:10,left:-10,bottom:0}}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.04)"/>
                      <XAxis dataKey="day" tick={{fontSize:11,fill:'#94a3b8'}} tickLine={false} axisLine={false} tickFormatter={d=>d.slice(5)}/>
                      <YAxis domain={[0,100]} tick={{fontSize:11,fill:'#94a3b8'}} tickLine={false} axisLine={false}/>
                      <Tooltip formatter={v=>[`${v}%`,'Completion']} contentStyle={{borderRadius:10,border:'1px solid #e2e8f0',fontSize:12}}/>
                      <Bar dataKey="efScore" fill="#7c3aed" radius={[4,4,0,0]}/>
                    </BarChart>
                  </ResponsiveContainer>
                ) : <p style={{fontSize:13,color:'#94a3b8',textAlign:'center',padding:'40px 0'}}>No task data yet</p>}
              </div>
            </div>

            {/* Triage Log */}
            <div style={{ background:'white', borderRadius:16, padding:'22px', boxShadow:'0 2px 12px rgba(0,0,0,0.04)', marginBottom:20 }}>
              <p style={{ fontSize:13, fontWeight:700, color:'#1a2633', marginBottom:4 }}>Clinical Alert Log</p>
              <p style={{ fontSize:11, color:'#94a3b8', marginBottom:16 }}>Recent guardian notifications sent by AuraOS</p>
              <TriageLog alerts={data.recentAlerts}/>
            </div>

            {/* Therapy Brief */}
            <AnimatePresence>
              {brief && (
                <motion.div initial={{opacity:0,y:16}} animate={{opacity:1,y:0}} exit={{opacity:0}}
                  style={{ background:'white', borderRadius:16, padding:'28px', boxShadow:'0 2px 12px rgba(0,0,0,0.04)' }}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
                    <div>
                      <p style={{ fontSize:13, fontWeight:700, color:'#1a2633' }}>14-Day Therapy Brief</p>
                      <p style={{ fontSize:11, color:'#94a3b8' }}>AI-generated · {new Date().toLocaleDateString()}</p>
                    </div>
                    <span style={{ padding:'4px 12px', background:`${brief.risk_level==='acute-distress'?'#fef2f2':brief.risk_level==='pre-burnout'?'#fff7ed':'#f0fdf4'}`, borderRadius:99, fontSize:11, fontWeight:700, color:brief.risk_level==='acute-distress'?'#ef4444':brief.risk_level==='pre-burnout'?'#f59e0b':'#22c55e', textTransform:'uppercase', letterSpacing:'0.06em' }}>
                      {brief.risk_level?.replace('-',' ')}
                    </span>
                  </div>
                  {[
                    { label:'Clinical Analogy',           value:brief.analogy },
                    { label:'Vocal Analysis',             value:brief.vocal_analysis },
                    { label:'Observed Pattern',           value:brief.observed_pattern },
                    { label:'Support System Actions',     value:brief.aura_action_taken },
                    { label:'Recommended Parent Action',  value:brief.parent_action },
                  ].map(row=>(
                    <div key={row.label} style={{ borderTop:'1px solid #f1f5f9', paddingTop:14, paddingBottom:14 }}>
                      <p style={{ fontSize:10.5, color:'#94a3b8', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:5 }}>{row.label}</p>
                      <p style={{ fontSize:14, color:'#374151', lineHeight:1.7 }}>{row.value}</p>
                    </div>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Recent Alerts */}
            {data.recentAlerts?.length > 0 && (
              <div style={{ marginBottom: 20 }}>
                <h3 style={{ fontSize: 14, fontWeight: 700, color: '#1a2633', marginBottom: 10 }}>Recent Alerts</h3>
                <ul style={{ listStyle: 'none', padding: 0 }}>
                  {data.recentAlerts.map((alert, index) => (
                    <li key={index} style={{ background: '#fff', padding: '10px 15px', borderRadius: 8, marginBottom: 8, boxShadow: '0 1px 4px rgba(0,0,0,0.1)' }}>
                      <p style={{ fontSize: 12, color: '#64748b', marginBottom: 4 }}>{new Date(alert.sentAt).toLocaleString()}</p>
                      <p style={{ fontSize: 14, color: '#1a2633' }}>{alert.message}</p>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Charts */}
            <div style={{ marginBottom: 20 }}>
              <h3 style={{ fontSize: 14, fontWeight: 700, color: '#1a2633', marginBottom: 10 }}>Clinical Charts</h3>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={data.charts?.vsiByDay || []}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="vsi" fill="#7c3aed" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}