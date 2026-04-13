import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { HeartPulse, FileText, Check, AlertTriangle, ArrowRight, Play, Loader } from 'lucide-react';
import { pythonApi } from '../../services/api.js';

export default function ClinicalRecovery({ userProfile }) {
  const [loading, setLoading] = useState(false);
  const [protocol, setProtocol] = useState(null);
  const [error, setError] = useState(null);

  const fetchProtocol = useCallback(async () => {
    if (!userProfile) return;
    setLoading(true);
    setError(null);
    try {
      const result = await pythonApi.ragProtocol(
        userProfile.profileId || 'anxiety',
        userProfile.severity || 'moderate',
        userProfile.baselineArousalScore || 5,
        userProfile.userId || 'demo-user'
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
    background: '#020915',
    backgroundImage: `
      radial-gradient(ellipse 80% 50% at 50% 0%, rgba(0,60,110,0.55) 0%, transparent 55%),
      radial-gradient(ellipse 50% 50% at 10% 80%, rgba(124,58,237,0.07) 0%, transparent 55%),
      radial-gradient(ellipse 50% 50% at 90% 75%, rgba(0,191,165,0.05) 0%, transparent 55%)
    `,
  };
  const dotGrid = { position: 'absolute', inset: 0, pointerEvents: 'none', backgroundImage: 'radial-gradient(rgba(0,229,255,0.08) 1px, transparent 1px)', backgroundSize: '36px 36px', opacity: 0.25 };

  if (!userProfile) {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', ...canvasBg }}>
        <p style={{ color: '#8bafc2' }}>Please complete the intake to see your personalized recovery protocol.</p>
      </div>
    );
  }

  return (
    <div style={{ position: 'relative', flex: 1, display: 'flex', flexDirection: 'column', ...canvasBg, overflowY: 'auto' }}>
      <div style={{ ...dotGrid }} />
      <div style={{ maxWidth: 800, margin: '0 auto', width: '100%', padding: '40px 24px', zIndex: 1, position: 'relative' }}>
        
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
           <motion.div animate={{ scale: [1, 1.08, 1], opacity: [0.7, 1, 0.7] }} transition={{ duration: 3.5, repeat: Infinity, ease: 'easeInOut' }}
            style={{
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              width: 56, height: 56, borderRadius: '50%', marginBottom: 18,
              background: 'conic-gradient(from 180deg,#ff6b8a,#ffb300,#00e5ff,#ff6b8a)',
              boxShadow: '0 0 28px rgba(255,107,138,0.35),0 0 60px rgba(255,179,0,0.2)',
            }}>
            <HeartPulse size={24} color="white" />
          </motion.div>
          <h1 style={{ fontSize: 'clamp(26px,5vw,36px)', fontWeight: 800, letterSpacing: '-0.045em', color: '#e8f4fb', lineHeight: 1.15, marginBottom: 10 }}>
            Clinical Recovery Protocol
          </h1>
          <p style={{ fontSize: 14.5, color: '#8bafc2', lineHeight: 1.65 }}>
            Evidence-based nutritional and physiological recommendations tailored for your {userProfile.profileId} profile.
          </p>
        </div>

        {!protocol && !loading && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} style={{ textAlign: 'center' }}>
             <button onClick={fetchProtocol} style={{
                padding: '17px 32px', background: 'linear-gradient(135deg,#ff6b8a,#ffb300)',
                border: 'none', borderRadius: 16, color: 'white', fontFamily: 'inherit',
                fontSize: 16, fontWeight: 800, cursor: 'pointer',
                display: 'inline-flex', alignItems: 'center', gap: 10,
                boxShadow: '0 12px 40px rgba(255,107,138,0.45)'
              }}>
                <Play size={18} /> Generate My Protocol
             </button>
             {error && <p style={{ marginTop: 20, color: '#ff6b8a' }}><AlertTriangle size={14} style={{ marginRight: 4 }}/> {error}</p>}
          </motion.div>
        )}

        {loading && (
          <div style={{ textAlign: 'center', padding: '40px 0' }}>
            <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }} style={{ display: 'inline-block' }}>
              <Loader size={32} color="#00e5ff" />
            </motion.div>
            <p style={{ color: '#8bafc2', marginTop: 16 }}>Synthesizing clinical knowledge base...</p>
          </div>
        )}

        {protocol && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} style={{
            background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(0,229,255,0.2)',
            borderRadius: 24, padding: '32px', backdropFilter: 'blur(10px)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24, borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: 16 }}>
              <FileText color="#00e5ff" /> 
              <h2 style={{ color: '#e8f4fb', fontSize: 20, fontWeight: 700 }}>Your Personalized Plan</h2>
            </div>
            
            <div className="protocol-content" style={{ color: '#e8f4fb', lineHeight: 1.8, fontSize: 15 }}>
              {typeof protocol === 'string' ? (
                 <div dangerouslySetInnerHTML={{ __html: protocol.replace(/\n/g, '<br/>') }} />
              ) : (
                 <div>
                    <h3 style={{ color: '#00e5ff', marginTop: 0, marginBottom: 12, fontSize: 18 }}>🥑 Dietary Recommendations</h3>
                    {protocol.diet_recommendations?.map((diet, i) => (
                        <div key={i} style={{ marginBottom: 16, padding: 16, background: 'rgba(0,0,0,0.2)', borderRadius: 12 }}>
                            <strong style={{ color: '#fff', fontSize: 16 }}>{diet.category || 'General'}</strong> <span style={{ opacity: 0.6, fontSize: 13 }}>(Priority: {diet.priority})</span><br/>
                            <em>Frequency:</em> {diet.frequency}<br/>
                            <em>Items:</em> {diet.items?.join(', ')}<br/>
                            <em>Rationale:</em> {diet.rationale}
                        </div>
                    ))}

                    <h3 style={{ color: '#ffb300', marginTop: 24, marginBottom: 12, fontSize: 18 }}>🏃‍♂️ Exercise Protocol</h3>
                    {protocol.exercise_protocol?.map((ex, i) => (
                        <div key={i} style={{ marginBottom: 16, padding: 16, background: 'rgba(0,0,0,0.2)', borderRadius: 12 }}>
                            <strong style={{ color: '#fff', fontSize: 16 }}>{ex.type}</strong> <span style={{ opacity: 0.6, fontSize: 13 }}>({ex.intensity} intensity)</span><br/>
                            <em>Duration:</em> {ex.duration}<br/>
                            <em>Rationale:</em> {ex.rationale}
                        </div>
                    ))}

                    <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', marginTop: 24 }}>
                      <div style={{ flex: '1 1 250px' }}>
                        <h3 style={{ color: '#ff6b8a', marginBottom: 8, fontSize: 18 }}>🚫 Avoid</h3>
                        <ul style={{ paddingLeft: 20 }}>
                            {protocol.foods_to_avoid?.map((item, i) => <li key={i}>{item}</li>)}
                        </ul>
                      </div>
                      <div style={{ flex: '1 1 250px' }}>
                        <h3 style={{ color: '#c4b5fd', marginBottom: 8, fontSize: 18 }}>💡 Lifestyle Tips</h3>
                        <ul style={{ paddingLeft: 20 }}>
                            {protocol.lifestyle_tips?.map((tip, i) => <li key={i}>{tip}</li>)}
                        </ul>
                      </div>
                    </div>

                    <div style={{ marginTop: 24, padding: 16, background: 'rgba(255,255,255,0.05)', borderRadius: 12, borderLeft: '4px solid #00e5ff' }}>
                        <strong style={{ color: '#e8f4fb' }}>Clinical Rationale:</strong> {protocol.clinical_rationale}
                    </div>

                    <div style={{ marginTop: 16, fontSize: 13, color: 'rgba(255,255,255,0.4)', textAlign: 'right' }}>
                        <em>Sources: {protocol.sources?.join(', ')}</em>
                    </div>
                 </div>
              )}
            </div>

            <div style={{ marginTop: 32, paddingTop: 24, borderTop: '1px solid rgba(255,255,255,0.1)', textAlign: 'center' }}>
              <button onClick={() => setProtocol(null)} style={{ background: 'transparent', color: '#8bafc2', border: '1px solid #8bafc2', padding: '10px 24px', borderRadius: 12, cursor: 'pointer' }}>
                Start Over
              </button>
            </div>
          </motion.div>
        )}

      </div>
    </div>
  );
}
