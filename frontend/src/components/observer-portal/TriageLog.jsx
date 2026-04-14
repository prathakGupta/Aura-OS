// TriageLog.jsx  🌟 NEW — Recent clinical alerts list
import { motion } from 'framer-motion';
import { AlertTriangle, CheckCircle2, Eye } from 'lucide-react';

const RISK_CONFIG = {
  'watch':          { color:'#ffb300', icon:Eye,           label:'Watch' },
  'pre-burnout':    { color:'#ff6b8a', icon:AlertTriangle, label:'Pre-Burnout' },
  'acute-distress': { color:'#ff3860', icon:AlertTriangle, label:'Acute Distress' },
};

export default function TriageLog({ alerts }) {
  if (!alerts?.length) return (
    <div style={{ padding: '32px', textAlign: 'center' }}>
      <p style={{ fontSize: 13, color: 'var(--text-3)', fontWeight: 500 }}>No alerts sent yet — all clear.</p>
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {alerts.map((alert, i) => {
        const cfg = RISK_CONFIG[alert.riskLevel] || RISK_CONFIG['watch'];
        const Icon = cfg.icon;
        return (
          <motion.div key={alert._id || i}
            initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }}
            style={{
              display: 'flex', alignItems: 'flex-start', gap: 14, padding: '16px',
              background: `var(--bg-surface)`, border: `1px solid var(--border)`,
              boxShadow: 'var(--shadow-sm)',
              borderRadius: 18,
            }}>
            <div style={{ 
              width: 36, height: 36, borderRadius: 12, 
              background: `${cfg.color}15`, 
              display: 'flex', alignItems: 'center', justifyContent: 'center', 
              flexShrink: 0 
            }}>
              <Icon size={18} color={cfg.color} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                <span style={{ fontSize: 10, fontWeight: 800, color: cfg.color, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                  {cfg.label}
                </span>
                <span style={{ fontSize: 10, color: 'var(--text-3)', fontWeight: 600 }}>
                  {new Date(alert.sentAt).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' })}
                </span>
              </div>
              <p style={{ 
                fontSize: 13, color: 'var(--text-2)', lineHeight: 1.5, fontWeight: 500,
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' 
              }}>
                {alert.triggerReason || 'Stress spike detected'}
              </p>
              <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                <span style={{ 
                  fontSize: 10, color: 'var(--text-3)', fontWeight: 700,
                  background: 'var(--bg-glass)', padding: '3px 10px', borderRadius: 99,
                  border: '1px solid var(--border)'
                }}>
                  via {alert.channel || 'system'}
                </span>
                {alert.deliveryStatus === 'sent' && (
                  <span style={{ fontSize: 10, color: 'var(--green)', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4 }}>
                    <CheckCircle2 size={12}/> DELIVERED
                  </span>
                )}
              </div>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}