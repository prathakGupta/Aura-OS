import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { HeartPulse, FileText, Check, AlertTriangle, ArrowRight, Play, Loader, ShieldCheck, Zap, Salad, Activity } from 'lucide-react';
import { clinicalApi } from '../../services/api.js';

export default function ClinicalRecovery({ userProfile }) {
  const [loading, setLoading] = useState(false);
  const [protocol, setProtocol] = useState(null);
  const [error, setError] = useState(null);

  const fetchProtocol = useCallback(async () => {
    if (!userProfile) return;
    setLoading(true);
    setError(null);
    try {
      const result = await clinicalApi.generateRecoveryProtocol(
        userProfile.userId || 'demo-user',
        userProfile
      );
      if (result.success && result.protocol) {
        setProtocol(result.protocol);
      } else {
        throw new Error('Failed to generate protocol');
      }
    } catch (e) {
      setError(e.message || 'An error occurred while fetching the protocol.');
    } finally {
      setLoading(false);
    }
  }, [userProfile]);

  const canvasBg = {
    background: 'var(--bg-root)',
    transition: 'background 0.5s ease',
  };

  const glassStyle = {
    background: 'var(--bg-glass-deep)',
    backdropFilter: 'blur(24px) saturate(180%)',
    WebkitBackdropFilter: 'blur(24px) saturate(180%)',
    border: '1px solid var(--border)',
    boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.25)',
    transition: 'background 0.3s ease, border-color 0.3s ease',
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: { 
      opacity: 1,
      transition: { staggerChildren: 0.12 }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 15 },
    visible: { opacity: 1, y: 0 }
  };

  if (!userProfile) {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', ...canvasBg }}>
        <div style={{ textAlign: 'center', padding: 40, ...glassStyle, borderRadius: 24, maxWidth: 400 }}>
           <AlertTriangle size={48} color="#f59e0b" style={{ marginBottom: 16 }} />
           <p style={{ color: 'var(--text-2)', fontSize: 16, lineHeight: 1.6 }}>
             Intake profile missing. Please complete the professional assessment to unlock your clinical protocol.
           </p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ position: 'relative', flex: 1, display: 'flex', flexDirection: 'column', ...canvasBg, overflowY: 'auto' }}>
      <div style={{ maxWidth: 840, margin: '0 auto', width: '100%', padding: '60px 24px', zIndex: 1, position: 'relative' }}>
        
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} style={{ textAlign: 'center', marginBottom: 56 }}>
           <div style={{ display: 'inline-block', position: 'relative' }}>
              <motion.div 
                animate={{ scale: [1, 1.1, 1], opacity: [0.3, 0.6, 0.3] }} 
                transition={{ duration: 4, repeat: Infinity }}
                style={{ 
                  position: 'absolute', inset: -10, borderRadius: '50%', 
                  background: 'radial-gradient(circle, #38bdf8 0%, transparent 70%)', zIndex: -1 
                }} 
              />
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                width: 64, height: 64, borderRadius: 20, marginBottom: 24,
                background: 'linear-gradient(135deg, #0ea5e9, #6366f1)',
                boxShadow: '0 12px 24px rgba(14, 165, 233, 0.3)',
              }}>
                <HeartPulse size={32} color="white" />
              </div>
           </div>
           
           <h1 style={{ 
             fontSize: 'clamp(32px, 6vw, 48px)', fontWeight: 850, letterSpacing: '-0.05em', 
             color: 'var(--text-1)', lineHeight: 1.1, marginBottom: 16 
           }}>
             Precision <span style={{ color: 'var(--cyan)' }}>Recovery</span>
           </h1>
           <p style={{ fontSize: 17, color: 'var(--text-2)', lineHeight: 1.6, maxWidth: 600, margin: '0 auto' }}>
             Neurologically-tailored interventions derived from cross-verified clinical telemetry and your unique {userProfile.profileId || 'ADHD'} profile.
           </p>
        </motion.div>

        {!protocol && !loading && (
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} style={{ textAlign: 'center' }}>
             <button 
                onClick={fetchProtocol} 
                disabled={loading}
                style={{
                  padding: '20px 48px', 
                  background: 'linear-gradient(135deg, #0ea5e9, #3b82f6)',
                  border: 'none', borderRadius: 20, color: 'white', fontFamily: 'inherit',
                  fontSize: 18, fontWeight: 750, cursor: 'pointer',
                  display: 'inline-flex', alignItems: 'center', gap: 14,
                  boxShadow: '0 10px 40px -10px rgba(14, 165, 233, 0.5)',
                  transition: 'all 0.2s ease',
                }}
                onMouseOver={(e) => e.currentTarget.style.transform = 'translateY(-2px)'}
                onMouseOut={(e) => e.currentTarget.style.transform = 'translateY(0)'}
             >
                <Zap size={22} fill="white" /> Synthesize Protocol
             </button>
             {error && (
               <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ 
                 marginTop: 32, padding: '16px 24px', borderRadius: 16, 
                 background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)',
                 color: '#fca5a5', display: 'flex', alignItems: 'center', gap: 10, justifyContent: 'center'
               }}>
                 <AlertTriangle size={18} /> {error}
               </motion.div>
             )}
          </motion.div>
        )}

        {loading && (
          <div style={{ textAlign: 'center', padding: '60px 0' }}>
            <div style={{ position: 'relative', display: 'inline-block' }}>
               <motion.div 
                 animate={{ rotate: 360 }} 
                 transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }} 
                 style={{ 
                   width: 50, height: 50, borderRadius: '50%', 
                   border: '3px solid rgba(56, 189, 248, 0.1)', borderTopColor: '#38bdf8' 
                 }} 
               />
            </div>
            <motion.p 
              animate={{ opacity: [0.5, 1, 0.5] }}
              transition={{ duration: 2, repeat: Infinity }}
              style={{ color: '#38bdf8', marginTop: 24, fontSize: 16, fontWeight: 600, letterSpacing: '0.05em' }}
            >
              RUNNING CLINICAL RAG ENGINE...
            </motion.p>
          </div>
        )}

        <AnimatePresence>
          {protocol && (
            <motion.div 
              variants={containerVariants}
              initial="hidden"
              animate="visible"
              exit="hidden"
              style={{
                ...glassStyle,
                borderRadius: 32, padding: '48px',
              }}
            >
              <motion.div variants={itemVariants} style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 40 }}>
                <div style={{ padding: 10, background: 'rgba(56, 189, 248, 0.1)', borderRadius: 12 }}>
                  <ShieldCheck size={28} color="#38bdf8" />
                </div>
                <div>
                  <h2 style={{ color: '#f8fafc', fontSize: 24, fontWeight: 800, marginBottom: 4 }}>Verified Protocol</h2>
                  <p style={{ color: '#64748b', fontSize: 14 }}>Last updated: {new Date().toLocaleDateString()}</p>
                </div>
              </motion.div>
              
              <div style={{ display: 'grid', gap: 32 }}>
                {/* Diagnosis Section */}
                <motion.div variants={itemVariants} style={{ 
                  padding: 24, background: 'rgba(255, 255, 255, 0.02)', 
                  borderRadius: 20, borderLeft: '4px solid #38bdf8' 
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                    <Activity size={18} color="#38bdf8" />
                    <span style={{ color: '#38bdf8', fontSize: 13, fontWeight: 800, letterSpacing: '0.05em' }}>DIAGNOSTIC SNAPSHOT</span>
                  </div>
                  <p style={{ color: '#e2e8f0', fontSize: 18, fontWeight: 500, lineHeight: 1.5 }}>
                    {protocol.diagnosis_baseline}
                  </p>
                </motion.div>

                {/* Diet Section */}
                <motion.div variants={itemVariants}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
                    <Salad size={22} color="#10b981" />
                    <h3 style={{ color: '#f8fafc', fontSize: 20, fontWeight: 750 }}>Neuro-Chemical Nutrition</h3>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16 }}>
                    {protocol.neuro_diet_plan?.map((diet, i) => (
                      <motion.div 
                        key={i} 
                        whileHover={{ scale: 1.02, background: 'rgba(255, 255, 255, 0.05)' }}
                        style={{ 
                          padding: '16px 20px', background: 'rgba(255, 255, 255, 0.03)', 
                          borderRadius: 16, display: 'flex', alignItems: 'flex-start', gap: 12,
                          border: '1px solid rgba(255, 255, 255, 0.05)'
                        }}
                      >
                         <div style={{ marginTop: 4, width: 8, height: 8, borderRadius: '50%', background: '#10b981', flexShrink: 0 }} />
                         <span style={{ color: '#cbd5e1', fontSize: 15, lineHeight: 1.4 }}>{diet}</span>
                      </motion.div>
                    ))}
                  </div>
                </motion.div>

                {/* Exercise Section */}
                <motion.div variants={itemVariants}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
                    <Activity size={22} color="#f59e0b" />
                    <h3 style={{ color: '#f8fafc', fontSize: 20, fontWeight: 750 }}>Somatic Physiology</h3>
                  </div>
                  <div style={{ 
                    padding: 24, background: 'rgba(245, 158, 11, 0.05)', 
                    borderRadius: 20, borderTop: '1px solid rgba(245, 158, 11, 0.1)'
                  }}>
                    <p style={{ color: '#fde68a', fontSize: 16, lineHeight: 1.7, margin: 0 }}>
                      {protocol.somatic_exercise_plan}
                    </p>
                  </div>
                </motion.div>

                {/* Confidence Section */}
                <motion.div variants={itemVariants} style={{ 
                  marginTop: 16, padding: 32, background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.1), rgba(168, 85, 247, 0.1))',
                  borderRadius: 24, textAlign: 'center', position: 'relative', overflow: 'hidden'
                }}>
                  <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: 4, background: 'linear-gradient(90deg, #6366f1, #a855f7)' }} />
                  <p style={{ color: '#94a3b8', fontSize: 13, fontWeight: 700, letterSpacing: '0.1em', marginBottom: 12 }}>PSYCHOLOGICAL ANCHOR</p>
                  <p style={{ color: '#e0e7ff', fontSize: 22, fontWeight: 700, fontStyle: 'italic', margin: 0 }}>
                    "{protocol.confidence_anchor}"
                  </p>
                </motion.div>

                {/* Footer */}
                <motion.div variants={itemVariants} style={{ 
                  marginTop: 8, padding: 20, borderRadius: 16, background: 'rgba(0, 0, 0, 0.2)',
                  fontSize: 12, color: '#475569', textAlign: 'center', lineHeight: 1.6
                }}>
                   {protocol.medical_disclaimer}
                </motion.div>
              </div>

              <motion.div variants={itemVariants} style={{ marginTop: 48, textAlign: 'center' }}>
                <button 
                  onClick={() => setProtocol(null)} 
                  style={{ 
                    background: 'transparent', color: '#64748b', border: '1px solid rgba(100, 116, 139, 0.3)', 
                    padding: '12px 32px', borderRadius: 14, cursor: 'pointer', fontSize: 14, fontWeight: 600,
                    transition: 'all 0.2s ease'
                  }}
                  onMouseOver={(e) => { e.currentTarget.style.borderColor = '#94a3b8'; e.currentTarget.style.color = '#94a3b8'; }}
                  onMouseOut={(e) => { e.currentTarget.style.borderColor = 'rgba(100, 116, 139, 0.3)'; e.currentTarget.style.color = '#64748b'; }}
                >
                  Generate New Analysis
                </button>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

      </div>
    </div>
  );
}
