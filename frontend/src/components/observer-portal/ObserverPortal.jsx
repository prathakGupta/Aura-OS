import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";
import { clinicalApi } from "../../services/portalApi";
import { motion, AnimatePresence } from "framer-motion";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { Activity, Brain, Zap, Shield, FileText, RefreshCw } from "lucide-react";
import VsiChart from "./VsiChart";
import TriageLog from "./TriageLog";

const STAT_CARDS = [
  { key: "tasksCompleted", label: "Tasks Completed", icon: Zap,      color: "#00e676" },
  { key: "tasksAbandoned", label: "Tasks Abandoned", icon: Activity,  color: "#ff6b8a" },
  { key: "forgeSessions",  label: "Forge Sessions",  icon: Brain,     color: "#c4b5fd" },
  { key: "stressSpikes",   label: "Stress Spikes",   icon: Shield,    color: "#ffb300" },
];

export default function ObserverPortal() {
  const { user, profile, logout } = useAuth();
  const navigate = useNavigate();

  const [data,      setData]      = useState(null);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState(null);
  const [days,      setDays]      = useState(7);
  const [generating, setGen]      = useState(false);
  const [brief,     setBrief]     = useState(null);

  const linkedUserId = profile?.linkedUserId;

  const fetchData = async () => {
    if (!linkedUserId || !user) return;
    setLoading(true);
    setError(null);
    try {
      const token = localStorage.getItem("token");
      const res = await clinicalApi.getDashboard(linkedUserId, days, token);
      setData(res);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (linkedUserId) fetchData();
  }, [linkedUserId, days]);

  const handleGenerateBrief = async () => {
    setGen(true);
    setBrief(null);
    try {
      const token = localStorage.getItem("token");
      const res = await clinicalApi.therapyBrief(linkedUserId, token);
      setBrief(res.brief);
    } catch (e) {
      setError(e.message);
    } finally {
      setGen(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate("/auth/logout", { replace: true });
  };

  return (
    <div style={{
      minHeight: "100dvh",
      background: "var(--bg-root)",
      fontFamily: "var(--font)",
      color: "var(--text-1)",
    }}>
      {/* Header */}
      <div style={{
        background: "var(--bg-glass-deep)",
        backdropFilter: "blur(24px)",
        borderBottom: "1px solid var(--border)",
        padding: "0 28px",
        height: 64,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        position: "sticky",
        top: 0,
        zIndex: 100,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{
            width: 32, height: 32, borderRadius: "50%",
            background: "conic-gradient(from 180deg,#7c3aed,#00e5ff,#00bfa5,#7c3aed)",
            boxShadow: "0 0 15px var(--cyan-glow)",
          }} />
          <div>
            <p style={{ fontSize: 16, fontWeight: 800, color: "var(--text-1)", letterSpacing: "-0.04em" }}>
              AuraOS Observer Portal
            </p>
            <p style={{ fontSize: 11, color: "var(--text-3)", fontWeight: 500 }}>Clinical Telemetry Dashboard</p>
          </div>
        </div>

        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <div style={{ display: "flex", background: "var(--bg-glass)", padding: 4, borderRadius: 99, border: "1px solid var(--border)" }}>
            {[7, 14, 30].map(d => (
              <button key={d} onClick={() => setDays(d)}
                style={{
                  padding: "5px 14px", borderRadius: 99, fontSize: 12, fontWeight: 700,
                  background: days === d ? "var(--purple)" : "transparent",
                  color: days === d ? "white" : "var(--text-3)",
                  cursor: "pointer",
                  transition: "all 0.2s ease",
                }}>
                {d}d
              </button>
            ))}
          </div>
          <button onClick={fetchData}
            style={{
              padding: "8px 14px", borderRadius: 12, border: "1px solid var(--border)",
              background: "var(--bg-glass)", cursor: "pointer",
              display: "flex", alignItems: "center", gap: 6,
              fontSize: 12, color: "var(--text-2)", fontWeight: 600,
              transition: "all 0.2s ease",
            }}>
            <RefreshCw size={14} /> Refresh
          </button>
          <button onClick={handleLogout}
            style={{
              padding: "8px 16px", background: "var(--bg-surface)", color: "var(--text-2)",
              border: "1px solid var(--border)", borderRadius: 12,
              fontSize: 12, fontWeight: 700, cursor: "pointer",
              transition: "all 0.2s ease",
            }}>
            Sign out
          </button>
        </div>
      </div>

      <div style={{ maxWidth: 960, margin: "0 auto", padding: "32px 24px" }}>

        {/* No linked user */}
        {!linkedUserId && !loading && (
          <div style={{
            background: "var(--bg-surface)", borderRadius: 24, padding: 48,
            textAlign: "center", color: "var(--text-3)", fontSize: 14,
            border: "1px solid var(--border)", boxShadow: "0 10px 30px rgba(0,0,0,0.05)",
          }}>
            No linked user found for this guardian account.
          </div>
        )}

        {/* Error */}
        {error && (
          <div style={{
            background: "#fff5f5", border: "1px solid #fecaca",
            borderRadius: 14, padding: "14px 18px",
            marginBottom: 20, color: "#ef4444", fontSize: 14,
          }}>
            {error}
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div style={{ textAlign: "center", padding: 60 }}>
            <div style={{
              width: 40, height: 40,
              border: "3px solid #e2e8f0",
              borderTopColor: "#7c3aed",
              borderRadius: "50%",
              animation: "spin 0.7s linear infinite",
              margin: "0 auto 16px",
            }} />
            <p style={{ color: "#64748b", fontSize: 14 }}>Loading telemetry…</p>
          </div>
        )}

        {/* Dashboard content */}
        {data && !loading && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>

            {/* Patient info bar */}
            <div style={{
              background: "var(--bg-surface)", borderRadius: 24, padding: "24px 32px",
              marginBottom: 24, boxShadow: "var(--shadow)",
              border: "1px solid var(--border)",
              display: "flex", justifyContent: "space-between",
              alignItems: "center", flexWrap: "wrap", gap: 16,
            }}>
              <div>
                <p style={{ fontSize: 10, color: "var(--text-3)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 4 }}>Patient ID</p>
                <p style={{ fontSize: 15, fontWeight: 700, color: "var(--text-1)" }}>{data.userId}</p>
              </div>
              {data.guardian?.name && (
                <div>
                  <p style={{ fontSize: 10, color: "var(--text-3)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 4 }}>Guardian</p>
                  <p style={{ fontSize: 15, fontWeight: 700, color: "var(--text-1)" }}>{data.guardian.name} · {data.guardian.relation}</p>
                </div>
              )}
              <div>
                <p style={{ fontSize: 10, color: "var(--text-3)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 4 }}>Avg Vocal Arousal</p>
                <p style={{
                  fontSize: 20, fontWeight: 800,
                  color: data.stats?.avgVocalArousal >= 7 ? "var(--coral)" : data.stats?.avgVocalArousal >= 5 ? "var(--amber)" : "var(--green)",
                }}>
                  {data.stats?.avgVocalArousal || "N/A"} <span style={{ fontSize: 12, opacity: 0.6, fontWeight: 600 }}>/ 10</span>
                </p>
              </div>
              <button onClick={handleGenerateBrief} disabled={generating}
                style={{
                  padding: "12px 24px", background: "var(--purple)", color: "white",
                  border: "none", borderRadius: 14, fontWeight: 800, fontSize: 13,
                  cursor: "pointer", display: "flex", alignItems: "center", gap: 8,
                  opacity: generating ? 0.7 : 1,
                  boxShadow: "0 4px 15px var(--purple-glow)",
                  transition: "all 0.2s ease",
                }}>
                <FileText size={16} /> {generating ? "Generating…" : "Generate Therapy Brief"}
              </button>
            </div>

            {/* Stat cards */}
            <div style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
              gap: 16, marginBottom: 24,
            }}>
              {STAT_CARDS.map(sc => {
                const Icon = sc.icon;
                return (
                    <motion.div key={sc.key}
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      style={{
                        background: "var(--bg-surface)", borderRadius: 24,
                        padding: "24px",
                        border: "1px solid var(--border)",
                        boxShadow: "var(--shadow-sm)",
                      }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
                        <p style={{ fontSize: 11, color: "var(--text-3)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em" }}>{sc.label}</p>
                        <div style={{
                          width: 40, height: 40, borderRadius: 12,
                          background: `${sc.color}15`,
                          display: "flex", alignItems: "center", justifyContent: "center",
                        }}>
                          <Icon size={20} color={sc.color} />
                        </div>
                      </div>
                      <p style={{ fontSize: 32, fontWeight: 900, color: "var(--text-1)", marginTop: 12, letterSpacing: "-0.03em" }}>
                        {data.stats?.[sc.key] ?? "—"}
                      </p>
                    </motion.div>
                );
              })}
            </div>

            {/* Charts row */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(400px, 1fr))", gap: 24, marginBottom: 24 }}>
              <div style={{ background: "var(--bg-surface)", borderRadius: 24, padding: "28px 32px", border: "1px solid var(--border)", boxShadow: "var(--shadow)" }}>
                <p style={{ fontSize: 15, fontWeight: 800, color: "var(--text-1)", marginBottom: 4, letterSpacing: "-0.02em" }}>Vocal Stress Index</p>
                <p style={{ fontSize: 12, color: "var(--text-3)", marginBottom: 24, fontWeight: 500 }}>Daily average arousal score (1–10)</p>
                <div style={{ height: 260 }}>
                  <VsiChart data={data.charts?.vsiByDay} />
                </div>
              </div>
              <div style={{ background: "var(--bg-surface)", borderRadius: 24, padding: "28px 32px", border: "1px solid var(--border)", boxShadow: "var(--shadow)" }}>
                <p style={{ fontSize: 15, fontWeight: 800, color: "var(--text-1)", marginBottom: 4, letterSpacing: "-0.02em" }}>Executive Function Score</p>
                <p style={{ fontSize: 12, color: "var(--text-3)", marginBottom: 24, fontWeight: 500 }}>Daily task completion rate (%)</p>
                <div style={{ height: 260 }}>
                  {data.charts?.execByDay?.length ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={data.charts.execByDay}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                        <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: "var(--text-3)", fontWeight: 600 }} tickFormatter={d => d.slice(5)} />
                        <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: "var(--text-3)", fontWeight: 600 }} domain={[0, 100]} />
                        <Tooltip 
                          contentStyle={{ background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: 12, boxShadow: "var(--shadow-lg)" }}
                          itemStyle={{ fontSize: 12, fontWeight: 700 }}
                          formatter={v => [`${v}%`, "Completion"]}
                        />
                        <Bar dataKey="efScore" fill="var(--purple)" radius={[4, 4, 0, 0]} barSize={34} />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-3)", fontSize: 12 }}>
                      No executive data yet
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Triage Log */}
            <div style={{ background: "var(--bg-surface)", borderRadius: 24, padding: "32px", border: "1px solid var(--border)", boxShadow: "var(--shadow)", marginBottom: 24 }}>
              <p style={{ fontSize: 16, fontWeight: 800, color: "var(--text-1)", marginBottom: 4, letterSpacing: "-0.02em" }}>Clinical Alert Log</p>
              <p style={{ fontSize: 13, color: "var(--text-3)", marginBottom: 24, fontWeight: 500 }}>Recent guardian notifications sent by AuraOS</p>
              <TriageLog alerts={data.recentAlerts} />
            </div>

            <AnimatePresence>
              {brief && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  style={{ 
                    background: "var(--bg-surface)", borderRadius: 28, padding: 36, 
                    border: "1px solid var(--border)", boxShadow: "0 10px 40px rgba(0,0,0,0.08)" 
                  }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 28 }}>
                    <div>
                      <p style={{ fontSize: 15, fontWeight: 800, color: "var(--text-1)", letterSpacing: "-0.02em" }}>14-Day Therapy Brief</p>
                      <p style={{ fontSize: 12, color: "var(--text-3)", fontWeight: 500 }}>AI-generated clinical analysis · {new Date().toLocaleDateString()}</p>
                    </div>
                    <span style={{
                      padding: "6px 16px",
                      background: brief.risk_level === "acute-distress" ? "rgba(239, 68, 68, 0.1)" : brief.risk_level === "pre-burnout" ? "rgba(245, 158, 11, 0.1)" : "rgba(34, 197, 94, 0.1)",
                      borderRadius: 99, fontSize: 11, fontWeight: 800,
                      color: brief.risk_level === "acute-distress" ? "var(--coral)" : brief.risk_level === "pre-burnout" ? "var(--amber)" : "var(--green)",
                      textTransform: "uppercase", letterSpacing: "0.08em",
                      border: "1px solid currentColor",
                    }}>
                      {brief.risk_level?.replace("-", " ")}
                    </span>
                  </div>
                  {[
                    { label: "Clinical Analogy",          value: brief.analogy },
                    { label: "Vocal Analysis",            value: brief.vocal_analysis },
                    { label: "Observed Pattern",          value: brief.observed_pattern },
                    { label: "Support System Actions",    value: brief.aura_action_taken },
                    { label: "Recommended Parent Action", value: brief.parent_action },
                  ].map(row => (
                    <div key={row.label} style={{ borderTop: "1px solid var(--border)", paddingTop: 18, paddingBottom: 18 }}>
                      <p style={{ fontSize: 10, color: "var(--text-3)", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 8 }}>{row.label}</p>
                      <p style={{ fontSize: 14, color: "var(--text-2)", lineHeight: 1.75, fontWeight: 500 }}>{row.value}</p>
                    </div>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>

          </motion.div>
        )}
      </div>
    </div>
  );
}