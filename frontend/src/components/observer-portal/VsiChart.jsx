// VsiChart.jsx  🌟 NEW — Vocal Stress Index line chart (recharts)
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  const val = payload[0]?.value;
  const color = val >= 7 ? 'var(--coral)' : val >= 5 ? 'var(--amber)' : 'var(--green)';
  return (
    <div style={{ 
      background: 'var(--bg-glass-deep)', 
      backdropFilter: 'blur(16px)',
      border: `1px solid ${color}40`, 
      borderRadius: 12, 
      padding: '10px 14px',
      boxShadow: '0 8px 24px rgba(0,0,0,0.1)'
    }}>
      <p style={{ fontSize: 11, color: 'var(--text-3)', marginBottom: 4, fontWeight: 600 }}>{label}</p>
      <p style={{ fontSize: 16, fontWeight: 800, color }}>{val?.toFixed(1)} <span style={{ fontSize: 11, opacity: 0.6 }}>/ 10</span></p>
    </div>
  );
};

export default function VsiChart({ data }) {
  if (!data?.length) return (
    <div style={{ height: "100%", display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <p style={{ fontSize: 13, color: 'var(--text-3)', fontWeight: 500 }}>No vocal data yet</p>
    </div>
  );
  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
        <XAxis dataKey="day" tick={{ fontSize: 11, fill: 'var(--text-3)', fontWeight: 600 }} tickLine={false} axisLine={false}
          tickFormatter={d => d.slice(5)} />
        <YAxis domain={[0, 10]} tick={{ fontSize: 11, fill: 'var(--text-3)', fontWeight: 600 }} tickLine={false} axisLine={false} />
        <ReferenceLine y={7} stroke="var(--coral)" strokeDasharray="4 4" opacity={0.3} label={{ value: 'Risk Threshold', fill: 'var(--coral)', fontSize: 10, fontWeight: 700, position: 'insideTopLeft' }} />
        <Tooltip content={<CustomTooltip />} cursor={{ stroke: 'var(--border)', strokeWidth: 1 }} />
        <Line type="monotone" dataKey="vsi" stroke="var(--cyan)" strokeWidth={3}
          dot={{ fill: 'var(--cyan)', r: 4, strokeWidth: 0 }}
          activeDot={{ r: 6, fill: 'var(--cyan)', stroke: 'var(--cyan-glow)', strokeWidth: 6 }} />
      </LineChart>
    </ResponsiveContainer>
  );
}