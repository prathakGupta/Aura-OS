import { useEffect, useState, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";
import { clinicalApi } from "../../services/portalApi";
import { motion, AnimatePresence } from "framer-motion";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
} from "recharts";
import {
  Activity, Brain, Zap, Shield, RefreshCw, LogOut,
  AlertCircle, Clock, TrendingUp, Sparkles, X,
  ShieldAlert, CheckCircle2,
} from "lucide-react";
import VsiChart from "./VsiChart";
import TriageLog from "./TriageLog";

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────
const AUTO_REFRESH_S = 60;

const STAT_CONFIGS = [
  { key: "tasksCompleted", label: "Tasks Completed", icon: Zap,      color: "#00e676", suffix: "completed" },
  { key: "tasksAbandoned", label: "Tasks Abandoned", icon: Activity,  color: "#ff6b8a", suffix: "abandoned" },
  { key: "forgeSessions",  label: "Forge Sessions",  icon: Brain,     color: "#c4b5fd", suffix: "sessions"  },
  { key: "stressSpikes",   label: "Stress Spikes",   icon: Shield,    color: "#ffb300", suffix: "detected"  },
];

const RISK_MAP = {
  "acute-distress": { label: "Acute Risk",   color: "#ef4444", bg: "rgba(239,68,68,0.12)",   border: "rgba(239,68,68,0.35)"   },
  "pre-burnout":    { label: "Pre-Burnout",  color: "#f59e0b", bg: "rgba(245,158,11,0.12)",  border: "rgba(245,158,11,0.35)"  },
  "watch":          { label: "Watchlist",    color: "#3b82f6", bg: "rgba(59,130,246,0.12)",  border: "rgba(59,130,246,0.35)"  },
  "stable":         { label: "Stable",       color: "#22c55e", bg: "rgba(34,197,94,0.12)",   border: "rgba(34,197,94,0.35)"   },
};

const BRIEF_ROWS = [
  { key: "analogy",           label: "Clinical Analogy",           icon: "💡" },
  { key: "vocal_analysis",    label: "Vocal Analysis",             icon: "🎙️" },
  { key: "observed_pattern",  label: "Observed Pattern",           icon: "📊" },
  { key: "aura_action_taken", label: "AuraOS Actions Taken",       icon: "🛡️" },
  { key: "parent_action",     label: "Recommended Guardian Action",icon: "💚" },
];

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────
const getRiskLevel = (arousal) => {
  if (!arousal || arousal === 0) return "stable";
  if (arousal >= 7) return "acute-distress";
  if (arousal >= 5) return "pre-burnout";
  if (arousal >= 3) return "watch";
  return "stable";
};

const initials = (name) =>
  name ? name.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2) : "??";

// ─────────────────────────────────────────────────────────────────────────────
// Shimmer skeleton
// ─────────────────────────────────────────────────────────────────────────────
const Shimmer = ({ w = "100%", h = 18, br = 8, style = {} }) => (
  <div
    style={{
      width: w, height: h, borderRadius: br, flexShrink: 0,
      background: "linear-gradient(90deg,var(--bg-glass) 25%,var(--border) 50%,var(--bg-glass) 75%)",
      backgroundSize: "300% 100%",
      animation: "shimmer 2s ease-in-out infinite",
      ...style,
    }}
  />
);

function SkeletonDashboard() {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      {/* patient card */}
      <div style={{ background: "var(--bg-surface)", borderRadius: 24, padding: "28px 32px", marginBottom: 24, border: "1px solid var(--border)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <Shimmer w={60} h={60} br="50%" />
          <div style={{ flex: 1,display:"flex",flexDirection:"column",gap:10 }}>
            <Shimmer w="38%" h={22} br={10} />
            <Shimmer w="22%" h={14} br={8} />
          </div>
          <Shimmer w={160} h={44} br={14} />
        </div>
      </div>
      {/* stat cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))", gap: 16, marginBottom: 24 }}>
        {[0,1,2,3].map((i) => (
          <div key={i} style={{ background: "var(--bg-surface)", borderRadius: 24, padding: "28px 24px", border: "1px solid var(--border)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 20 }}>
              <Shimmer w="52%" h={12} br={6} />
              <Shimmer w={44} h={44} br={14} />
            </div>
            <Shimmer w="36%" h={44} br={8} />
            <Shimmer w="28%" h={11} br={6} style={{ marginTop: 10 }} />
          </div>
        ))}
      </div>
      {/* charts */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(400px,1fr))", gap: 24, marginBottom: 24 }}>
        {[0,1].map((i) => (
          <div key={i} style={{ background: "var(--bg-surface)", borderRadius: 24, padding: "28px 32px", border: "1px solid var(--border)" }}>
            <Shimmer w="48%" h={18} br={8} style={{ marginBottom: 10 }} />
            <Shimmer w="65%" h={13} br={6} style={{ marginBottom: 28 }} />
            <Shimmer w="100%" h={220} br={14} />
          </div>
        ))}
      </div>
      {/* triage */}
      <div style={{ background: "var(--bg-surface)", borderRadius: 24, padding: "28px 32px", border: "1px solid var(--border)" }}>
        <Shimmer w="36%" h={18} br={8} style={{ marginBottom: 10 }} />
        <Shimmer w="55%" h={13} br={6} style={{ marginBottom: 24 }} />
        {[0,1,2].map((i) => <Shimmer key={i} w="100%" h={68} br={14} style={{ marginBottom: 10 }} />)}
      </div>
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Animated number counter
// ─────────────────────────────────────────────────────────────────────────────
function useAnimatedCount(target, durationMs = 900) {
  const [val, setVal] = useState(0);
  const prevRef = useRef(0);
  useEffect(() => {
    const num = Number(target) || 0;
    const start = prevRef.current;
    const t0 = performance.now();
    const step = (now) => {
      const p = Math.min((now - t0) / durationMs, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      setVal(Math.round(start + (num - start) * eased));
      if (p < 1) requestAnimationFrame(step);
      else prevRef.current = num;
    };
    requestAnimationFrame(step);
  }, [target, durationMs]);
  return val;
}

// ─────────────────────────────────────────────────────────────────────────────
// Stat Card
// ─────────────────────────────────────────────────────────────────────────────
function StatCard({ cfg, value, delay }) {
  const count = useAnimatedCount(value);
  const Icon  = cfg.icon;
  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ delay, duration: 0.45, ease: [0.23, 1, 0.32, 1] }}
      style={{
        background: "var(--bg-surface)", borderRadius: 24,
        padding: "26px 24px", border: "1px solid var(--border)",
        boxShadow: "var(--shadow-sm)", position: "relative", overflow: "hidden",
      }}
    >
      {/* subtle radial glow top-right */}
      <div style={{
        position: "absolute", top: -24, right: -24, width: 90, height: 90,
        borderRadius: "50%", background: `${cfg.color}10`, filter: "blur(24px)",
        pointerEvents: "none",
      }} />

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 18 }}>
        <p style={{ fontSize: 11, color: "var(--text-3)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", lineHeight: 1.4 }}>
          {cfg.label}
        </p>
        <div style={{
          width: 44, height: 44, borderRadius: 14, flexShrink: 0,
          background: `${cfg.color}14`, border: `1px solid ${cfg.color}25`,
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <Icon size={20} color={cfg.color} />
        </div>
      </div>

      <p style={{ fontSize: 42, fontWeight: 900, color: "var(--text-1)", letterSpacing: "-0.05em", lineHeight: 1 }}>
        {count}
      </p>
      <p style={{ fontSize: 11, color: "var(--text-3)", fontWeight: 600, marginTop: 8, letterSpacing: "0.02em" }}>
        {cfg.suffix}
      </p>

      {/* coloured bottom accent */}
      <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 3, borderRadius: "0 0 24px 24px", background: `${cfg.color}50` }} />
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Refresh ring
// ─────────────────────────────────────────────────────────────────────────────
function RefreshRing({ seconds, total = AUTO_REFRESH_S, onClick, disabled = false }) {
  const r = 13, circ = 2 * Math.PI * r;
  const pct = seconds / total;
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={`Auto-refresh in ${seconds}s — click to refresh now`}
      style={{
        background: "none",
        border: "none",
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.55 : 1,
        padding: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        width: 40,
        height: 40,
      }}
    >
      <svg width="40" height="40" style={{ transform: "rotate(-90deg)" }}>
        <circle cx="20" cy="20" r={r} fill="none" stroke="var(--border)" strokeWidth="2.5" />
        <circle cx="20" cy="20" r={r} fill="none" stroke="var(--cyan)" strokeWidth="2.5"
          strokeDasharray={circ} strokeDashoffset={circ * (1 - pct)}
          style={{ transition: "stroke-dashoffset 1s linear" }} />
      </svg>
      <RefreshCw size={12} color="var(--text-3)"
        style={{ position: "absolute" }} />
    </button>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Toast
// ─────────────────────────────────────────────────────────────────────────────
function Toast({ msg, type }) {
  const ok = type === "success";
  return (
    <motion.div
      initial={{ opacity: 0, y: -40, x: "-50%" }}
      animate={{ opacity: 1, y: 20,  x: "-50%" }}
      exit={{    opacity: 0, y: -40, x: "-50%" }}
      transition={{ type: "spring", stiffness: 300, damping: 28 }}
      style={{
        position: "fixed", top: 64, left: "50%", zIndex: 9999,
        background: ok ? "rgba(34,197,94,0.12)" : "rgba(239,68,68,0.12)",
        border: `1px solid ${ok ? "rgba(34,197,94,0.4)" : "rgba(239,68,68,0.4)"}`,
        backdropFilter: "blur(16px)",
        borderRadius: 14, padding: "11px 22px",
        display: "flex", alignItems: "center", gap: 8,
        color: ok ? "#22c55e" : "#ef4444",
        fontSize: 13, fontWeight: 700,
        boxShadow: "0 8px 32px rgba(0,0,0,0.15)",
      }}
    >
      {ok ? <CheckCircle2 size={15} /> : <AlertCircle size={15} />}
      {msg}
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────────────────────
export default function ObserverPortal() {
  const { user, profile, logout } = useAuth();
  const navigate = useNavigate();

  const [data,       setData]      = useState(null);
  const [loading,    setLoading]   = useState(true);
  const [error,      setError]     = useState(null);
  const [days,       setDays]      = useState(7);
  const [generating, setGenerating]= useState(false);
  const [brief,      setBrief]     = useState(null);
  const [lastAt,     setLastAt]    = useState(null);
  const [countdown,  setCountdown] = useState(AUTO_REFRESH_S);
  const [refreshing, setRefreshing]= useState(false);
  const [toast,      setToast]     = useState(null);

  const linkedUserId  = profile?.linkedUserId;
  const guardianName  = profile?.fullName || user?.email || "Guardian";
  const toastTimerRef = useRef(null);
  const inFlightRef   = useRef(false);

  // ── Show toast ──────────────────────────────────────────────────────────────
  const pushToast = useCallback((msg, type = "success") => {
    setToast({ msg, type });
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setToast(null), 3200);
  }, []);

  useEffect(() => () => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
  }, []);

  // ── Fetch dashboard data ────────────────────────────────────────────────────
  const fetchData = useCallback(async ({ silent = false, notify = false } = {}) => {
    if (!linkedUserId || !user) return;
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    if (!silent) setLoading(true);
    if (silent) setRefreshing(true);
    setError(null);
    try {
      const token = localStorage.getItem("token");
      const res   = await clinicalApi.getDashboard(linkedUserId, days, token);
      setData(res);
      setLastAt(new Date());
      setCountdown(AUTO_REFRESH_S);
      if (notify) pushToast("Dashboard refreshed");
    } catch (e) {
      const msg = e.message || "Unable to load telemetry. Check your connection.";
      setError(msg);
      if (notify) pushToast(msg, "error");
    } finally {
      inFlightRef.current = false;
      if (silent) setRefreshing(false);
      setLoading(false);
    }
  }, [linkedUserId, user, days, pushToast]);

  // ── Initial fetch / refetch on days change ──────────────────────────────────
  useEffect(() => {
    if (linkedUserId) {
      fetchData();
    } else {
      // No linked patient — still stop the auth loading spinner
      setLoading(false);
    }
  }, [linkedUserId, fetchData]);

  // ── Auto-refresh countdown ──────────────────────────────────────────────────
  useEffect(() => {
    if (!linkedUserId || loading) return;
    const tick = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) { fetchData({ silent: true }); return AUTO_REFRESH_S; }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(tick);
  }, [linkedUserId, loading, fetchData]);

  // ── Generate therapy brief ──────────────────────────────────────────────────
  const handleGenerateBrief = async () => {
    if (!linkedUserId) return;
    setGenerating(true);
    setBrief(null);
    try {
      const token = localStorage.getItem("token");
      const res   = await clinicalApi.therapyBrief(linkedUserId, token);
      setBrief(res.brief);
    } catch (e) {
      pushToast(e.message || "Failed to generate brief", "error");
    } finally {
      setGenerating(false);
    }
  };

  // ── Logout ──────────────────────────────────────────────────────────────────
  const handleLogout = async () => {
    await logout();
    navigate("/auth/logout", { replace: true });
  };

  // ── Derived ─────────────────────────────────────────────────────────────────
  const riskLevel  = getRiskLevel(data?.stats?.avgVocalArousal);
  const riskCfg    = RISK_MAP[riskLevel];
  const patientName    = data?.patientName || null;
  const patientInitials = patientName
    ? initials(patientName)
    : linkedUserId ? linkedUserId.slice(-4).toUpperCase() : "??";

  const briefRiskCfg = brief ? (RISK_MAP[brief.risk_level] || RISK_MAP.stable) : null;

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div style={{ minHeight: "100dvh", background: "var(--bg-root)", fontFamily: "var(--font)", color: "var(--text-1)" }}>

      {/* ── Global keyframes ──────────────────────────────────────────────────── */}
      <style>{`
        @keyframes shimmer {
          0%   { background-position: 300% 0; }
          100% { background-position: -300% 0; }
        }
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes live-pulse {
          0%,100% { opacity: 1;   transform: scale(1);   }
          50%     { opacity: 0.45; transform: scale(0.78); }
        }
        @keyframes fade-in-up {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0);  }
        }
      `}</style>

      {/* ── Toast ─────────────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {toast && <Toast key="toast" msg={toast.msg} type={toast.type} />}
      </AnimatePresence>

      {/* ═══════════════════════════════════════════════════════════════════════
          STICKY HEADER
         ═══════════════════════════════════════════════════════════════════════ */}
      <header style={{
        position: "sticky", top: 0, zIndex: 100,
        height: 64,
        background: "var(--bg-glass-deep)",
        backdropFilter: "blur(24px)",
        WebkitBackdropFilter: "blur(24px)",
        borderBottom: "1px solid var(--border)",
        display: "flex", alignItems: "center",
        justifyContent: "space-between",
        padding: "0 24px",
        gap: 12,
      }}>

        {/* Left: brand + live pill */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
          <div style={{
            width: 34, height: 34, borderRadius: "50%", flexShrink: 0,
            background: "conic-gradient(from 180deg,#7c3aed,#00e5ff,#00bfa5,#7c3aed)",
            boxShadow: "0 0 16px rgba(0,229,255,0.28)",
          }} />
          <div style={{ minWidth: 0 }}>
            <p style={{ fontSize: 15, fontWeight: 800, color: "var(--text-1)", letterSpacing: "-0.03em", whiteSpace: "nowrap" }}>
              Observer Portal
            </p>
            <p style={{ fontSize: 11, color: "var(--text-3)", fontWeight: 500 }}>Clinical Telemetry · AuraOS</p>
          </div>

          {/* Live badge — only when data is present */}
          <AnimatePresence>
            {data && !loading && (
              <motion.div
                key="live-badge"
                initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }}
                style={{
                  display: "flex", alignItems: "center", gap: 5,
                  padding: "3px 10px", borderRadius: 99, flexShrink: 0,
                  background: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.3)",
                }}
              >
                <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#22c55e", animation: "live-pulse 2s ease infinite" }} />
                <span style={{ fontSize: 10, fontWeight: 800, color: "#22c55e", letterSpacing: "0.07em" }}>LIVE</span>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Right: controls */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>

          {/* Days toggle */}
          <div style={{ display: "flex", background: "var(--bg-glass)", padding: 3, borderRadius: 99, border: "1px solid var(--border)" }}>
            {[7, 14, 30].map((d) => (
              <button key={d} onClick={() => setDays(d)} style={{
                padding: "5px 14px", borderRadius: 99, fontSize: 12, fontWeight: 700,
                background: days === d ? "var(--purple)" : "transparent",
                color: days === d ? "white" : "var(--text-3)",
                border: "none", cursor: "pointer", transition: "all 0.2s ease",
              }}>
                {d}d
              </button>
            ))}
          </div>

          {/* Auto-refresh ring */}
          {data && !loading && (
            <div style={{ position: "relative", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <RefreshRing
                seconds={countdown}
                disabled={refreshing}
                onClick={() => fetchData({ silent: true, notify: true })}
              />
            </div>
          )}

          {/* Guardian badge */}
          <div style={{
            display: "flex", alignItems: "center", gap: 8,
            padding: "6px 12px 6px 6px", borderRadius: 14,
            background: "var(--bg-glass)", border: "1px solid var(--border)",
          }}>
            <div style={{
              width: 30, height: 30, borderRadius: "50%",
              background: "linear-gradient(135deg,#7c3aed,#00e5ff)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 10, fontWeight: 800, color: "white", flexShrink: 0,
            }}>
              {initials(guardianName)}
            </div>
            <div>
              <p style={{ fontSize: 11, fontWeight: 700, color: "var(--text-1)", lineHeight: 1.2 }}>{guardianName}</p>
              <p style={{ fontSize: 9, color: "var(--text-3)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em" }}>Guardian</p>
            </div>
          </div>

          {/* Sign out */}
          <button onClick={handleLogout} style={{
            display: "flex", alignItems: "center", gap: 6,
            padding: "8px 14px", borderRadius: 12,
            background: "var(--bg-glass)", border: "1px solid var(--border)",
            color: "var(--text-2)", fontSize: 12, fontWeight: 700, cursor: "pointer",
            transition: "all 0.2s ease",
          }}>
            <LogOut size={13} /> Sign out
          </button>
        </div>
      </header>

      {/* ═══════════════════════════════════════════════════════════════════════
          MAIN CONTENT
         ═══════════════════════════════════════════════════════════════════════ */}
      <main style={{ maxWidth: 1060, margin: "0 auto", padding: "32px 24px 80px" }}>

        {/* ── No linked patient state ─────────────────────────────────────── */}
        {!linkedUserId && !loading && (
          <motion.div
            initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }}
            style={{
              background: "var(--bg-surface)", borderRadius: 28, padding: "64px 48px",
              textAlign: "center", border: "1px solid var(--border)", boxShadow: "var(--shadow)",
            }}
          >
            <div style={{
              width: 80, height: 80, borderRadius: "50%", margin: "0 auto 28px",
              background: "linear-gradient(135deg,rgba(124,58,237,0.15),rgba(0,229,255,0.1))",
              border: "1px solid var(--border)",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <ShieldAlert size={30} color="var(--purple)" />
            </div>
            <h2 style={{ fontSize: 24, fontWeight: 800, color: "var(--text-1)", marginBottom: 12, letterSpacing: "-0.04em" }}>
              No patient linked yet
            </h2>
            <p style={{ fontSize: 14, color: "var(--text-3)", lineHeight: 1.75, maxWidth: 400, margin: "0 auto 32px" }}>
              Your guardian account is active but hasn't been linked to a patient's AuraOS profile.
              The patient needs to invite you through their app settings.
            </p>
            <button onClick={handleLogout} style={{
              padding: "12px 28px", background: "var(--bg-glass)",
              border: "1px solid var(--border)", borderRadius: 14,
              fontSize: 13, fontWeight: 700, color: "var(--text-2)", cursor: "pointer",
            }}>
              Sign out
            </button>
          </motion.div>
        )}

        {/* ── Error banner ────────────────────────────────────────────────── */}
        <AnimatePresence>
          {error && (
            <motion.div
              key="error-banner"
              initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
              style={{
                background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.28)",
                borderRadius: 16, padding: "15px 20px", marginBottom: 20,
                display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <AlertCircle size={16} color="#ef4444" />
                <span style={{ fontSize: 13, color: "#ef4444", fontWeight: 600 }}>{error}</span>
              </div>
              <button onClick={() => fetchData({ notify: true })} style={{
                fontSize: 12, fontWeight: 800, color: "var(--purple)",
                background: "transparent", border: "none", cursor: "pointer", whiteSpace: "nowrap",
              }}>
                Retry ↻
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Last-updated bar ─────────────────────────────────────────────── */}
        {lastAt && !loading && (
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 20, justifyContent: "flex-end" }}>
            <Clock size={11} color="var(--text-3)" />
            <span style={{ fontSize: 11, color: "var(--text-3)", fontWeight: 600 }}>
              Last updated {lastAt.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
            </span>
          </div>
        )}

        {/* ── Skeleton ─────────────────────────────────────────────────────── */}
        <AnimatePresence>
          {loading && linkedUserId && <SkeletonDashboard key="skel" />}
        </AnimatePresence>

        {/* ════════════════════════════════════════════════════════════════════
            FULL DASHBOARD (shown once data is loaded)
           ════════════════════════════════════════════════════════════════════ */}
        <AnimatePresence>
          {data && !loading && (
            <motion.div key="dashboard" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>

              {/* ── Patient info card ───────────────────────────────────────── */}
              <motion.div
                initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.42, ease: [0.23, 1, 0.32, 1] }}
                style={{
                  background: "var(--bg-surface)", borderRadius: 24, padding: "28px 32px",
                  marginBottom: 24, boxShadow: "var(--shadow)",
                  border: "1px solid var(--border)",
                  display: "flex", alignItems: "center",
                  justifyContent: "space-between", flexWrap: "wrap", gap: 20,
                }}
              >
                {/* Avatar + name */}
                <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
                  <div style={{
                    width: 60, height: 60, borderRadius: "50%", flexShrink: 0,
                    background: "conic-gradient(from 180deg,#7c3aed,#00e5ff,#00bfa5,#7c3aed)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 18, fontWeight: 900, color: "white",
                    boxShadow: "0 0 24px rgba(0,229,255,0.2)",
                  }}>
                    {patientInitials}
                  </div>
                  <div>
                    <p style={{ fontSize: 20, fontWeight: 800, color: "var(--text-1)", letterSpacing: "-0.04em", marginBottom: 4 }}>
                      {patientName ?? "Patient"}
                    </p>
                    <p style={{ fontSize: 11, color: "var(--text-3)", fontWeight: 600, fontFamily: "monospace" }}>
                      ID: …{data.userId?.slice(-10) ?? "—"}
                    </p>
                  </div>
                </div>

                {/* Stats pills */}
                <div style={{ display: "flex", gap: 28, alignItems: "center", flexWrap: "wrap" }}>
                  {/* Arousal */}
                  <div style={{ textAlign: "center" }}>
                    <p style={{ fontSize: 10, color: "var(--text-3)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 5 }}>
                      Avg Vocal Arousal
                    </p>
                    <p style={{
                      fontSize: 24, fontWeight: 900, letterSpacing: "-0.05em",
                      color: data.stats?.avgVocalArousal >= 7 ? "#ef4444"
                           : data.stats?.avgVocalArousal >= 5 ? "#f59e0b" : "#22c55e",
                    }}>
                      {data.stats?.avgVocalArousal || 0}
                      <span style={{ fontSize: 13, opacity: 0.5, fontWeight: 600 }}> / 10</span>
                    </p>
                  </div>

                  {/* Risk badge */}
                  <div style={{ textAlign: "center" }}>
                    <p style={{ fontSize: 10, color: "var(--text-3)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 5 }}>
                      Risk Level
                    </p>
                    <span style={{
                      display: "inline-block",
                      padding: "6px 16px", borderRadius: 99, fontSize: 11, fontWeight: 800,
                      background: riskCfg.bg, color: riskCfg.color,
                      border: `1px solid ${riskCfg.border}`,
                      textTransform: "uppercase", letterSpacing: "0.08em",
                    }}>
                      {riskCfg.label}
                    </span>
                  </div>

                  {/* Guardian */}
                  {data.guardian?.name && (
                    <div style={{ textAlign: "center" }}>
                      <p style={{ fontSize: 10, color: "var(--text-3)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 5 }}>
                        Linked Guardian
                      </p>
                      <p style={{ fontSize: 14, fontWeight: 700, color: "var(--text-1)" }}>
                        {data.guardian.name}
                        {data.guardian.relation && (
                          <span style={{ opacity: 0.5, fontWeight: 500 }}> · {data.guardian.relation}</span>
                        )}
                      </p>
                    </div>
                  )}
                </div>

                {/* CTA */}
                <button onClick={handleGenerateBrief} disabled={generating} style={{
                  padding: "14px 26px", borderRadius: 16, fontWeight: 800, fontSize: 13,
                  cursor: generating ? "not-allowed" : "pointer",
                  display: "flex", alignItems: "center", gap: 8,
                  transition: "all 0.25s ease",
                  ...(generating
                    ? { background: "var(--bg-glass)", color: "var(--text-3)", border: "1px solid var(--border)", boxShadow: "none" }
                    : { background: "var(--purple)", color: "white", border: "none", boxShadow: "0 4px 18px rgba(124,58,237,0.38)" }
                  ),
                }}>
                  {generating ? (
                    <>
                      <div style={{ width: 14, height: 14, border: "2.5px solid rgba(255,255,255,0.25)", borderTopColor: "var(--purple)", borderRadius: "50%", animation: "spin 0.7s linear infinite" }} />
                      Generating…
                    </>
                  ) : (
                    <>
                      <Sparkles size={15} />
                      Generate Therapy Brief
                    </>
                  )}
                </button>
              </motion.div>

              {/* ── Stat Cards ──────────────────────────────────────────────── */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(210px,1fr))", gap: 16, marginBottom: 24 }}>
                {STAT_CONFIGS.map((cfg, i) => (
                  <StatCard key={cfg.key} cfg={cfg} value={data.stats?.[cfg.key] ?? 0} delay={i * 0.07} />
                ))}
              </div>

              {/* ── Charts Row ──────────────────────────────────────────────── */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(420px,1fr))", gap: 24, marginBottom: 24 }}>

                {/* VSI */}
                <motion.div
                  initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.28 }}
                  style={{ background: "var(--bg-surface)", borderRadius: 24, padding: "28px 32px", border: "1px solid var(--border)", boxShadow: "var(--shadow)" }}
                >
                  <p style={{ fontSize: 15, fontWeight: 800, color: "var(--text-1)", marginBottom: 4, letterSpacing: "-0.02em" }}>
                    Vocal Stress Index
                  </p>
                  <p style={{ fontSize: 12, color: "var(--text-3)", marginBottom: 22, fontWeight: 500 }}>
                    Daily average arousal score (1–10) · {days}-day window
                  </p>
                  <div style={{ height: 210 }}>
                    <VsiChart data={data.charts?.vsiByDay} />
                  </div>
                </motion.div>

                {/* Executive Function */}
                <motion.div
                  initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.36 }}
                  style={{ background: "var(--bg-surface)", borderRadius: 24, padding: "28px 32px", border: "1px solid var(--border)", boxShadow: "var(--shadow)" }}
                >
                  <p style={{ fontSize: 15, fontWeight: 800, color: "var(--text-1)", marginBottom: 4, letterSpacing: "-0.02em" }}>
                    Executive Function
                  </p>
                  <p style={{ fontSize: 12, color: "var(--text-3)", marginBottom: 22, fontWeight: 500 }}>
                    Daily task completion rate (%) · {days}-day window
                  </p>
                  <div style={{ height: 210 }}>
                    {data.charts?.execByDay?.length ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={data.charts.execByDay} margin={{ top: 8, right: 8, left: -14, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                          <XAxis dataKey="day" axisLine={false} tickLine={false}
                            tick={{ fontSize: 10, fill: "var(--text-3)", fontWeight: 600 }}
                            tickFormatter={(d) => d.slice(5)} />
                          <YAxis axisLine={false} tickLine={false}
                            tick={{ fontSize: 10, fill: "var(--text-3)", fontWeight: 600 }}
                            domain={[0, 100]} />
                          <Tooltip
                            contentStyle={{ background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: 12, boxShadow: "var(--shadow-lg)" }}
                            itemStyle={{ fontSize: 12, fontWeight: 700 }}
                            formatter={(v) => [`${v}%`, "Completion"]}
                          />
                          <Bar dataKey="efScore" fill="var(--purple)" radius={[6, 6, 0, 0]} barSize={28} />
                        </BarChart>
                      </ResponsiveContainer>
                    ) : (
                      <div style={{ height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12 }}>
                        <TrendingUp size={32} color="var(--border)" />
                        <p style={{ fontSize: 13, color: "var(--text-3)", fontWeight: 500 }}>No task data in this window</p>
                      </div>
                    )}
                  </div>
                </motion.div>
              </div>

              {/* ── Clinical Alert Log ──────────────────────────────────────── */}
              <motion.div
                initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.44 }}
                style={{ background: "var(--bg-surface)", borderRadius: 24, padding: "28px 32px", border: "1px solid var(--border)", boxShadow: "var(--shadow)", marginBottom: 24 }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 22 }}>
                  <div>
                    <p style={{ fontSize: 15, fontWeight: 800, color: "var(--text-1)", marginBottom: 4, letterSpacing: "-0.02em" }}>
                      Clinical Alert Log
                    </p>
                    <p style={{ fontSize: 12, color: "var(--text-3)", fontWeight: 500 }}>
                      Guardian notifications dispatched by AuraOS
                    </p>
                  </div>
                  {data.recentAlerts?.length > 0 && (
                    <span style={{
                      padding: "4px 14px", borderRadius: 99,
                      background: "rgba(255,107,138,0.1)", border: "1px solid rgba(255,107,138,0.3)",
                      fontSize: 11, fontWeight: 800, color: "#ff6b8a",
                    }}>
                      {data.recentAlerts.length} alerts
                    </span>
                  )}
                </div>
                <TriageLog alerts={data.recentAlerts} />
              </motion.div>

              {/* ── Therapy Brief panel ─────────────────────────────────────── */}
              <AnimatePresence>
                {brief && (
                  <motion.div
                    key="therapy-brief"
                    initial={{ opacity: 0, y: 28, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{   opacity: 0, y: 16, scale: 0.97 }}
                    transition={{ duration: 0.5, ease: [0.23, 1, 0.32, 1] }}
                    style={{
                      background: "var(--bg-surface)", borderRadius: 28, padding: "36px",
                      border: "1px solid var(--border)", boxShadow: "var(--shadow)",
                      position: "relative", overflow: "hidden", marginBottom: 24,
                    }}
                  >
                    {/* Top risk stripe */}
                    <div style={{
                      position: "absolute", top: 0, left: 0, right: 0, height: 4,
                      background: brief.risk_level === "acute-distress"
                        ? "linear-gradient(90deg,#ef4444,#f97316)"
                        : brief.risk_level === "pre-burnout"
                        ? "linear-gradient(90deg,#f59e0b,#fde047)"
                        : "linear-gradient(90deg,#7c3aed,#00e5ff)",
                    }} />

                    {/* Header */}
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 28 }}>
                      <div>
                        <p style={{ fontSize: 16, fontWeight: 800, color: "var(--text-1)", letterSpacing: "-0.03em" }}>
                          14-Day Therapy Brief
                        </p>
                        <p style={{ fontSize: 11, color: "var(--text-3)", fontWeight: 500, marginTop: 4 }}>
                          AI-generated clinical summary · {new Date().toLocaleDateString("en-IN", { dateStyle: "medium" })}
                        </p>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        {briefRiskCfg && (
                          <span style={{
                            padding: "6px 16px", borderRadius: 99, fontSize: 11, fontWeight: 800,
                            background: briefRiskCfg.bg, color: briefRiskCfg.color,
                            border: `1px solid ${briefRiskCfg.border}`,
                            textTransform: "uppercase", letterSpacing: "0.08em",
                          }}>
                            {brief.risk_level?.replace(/-/g, " ")}
                          </span>
                        )}
                        <button onClick={() => setBrief(null)} title="Dismiss brief" style={{
                          width: 32, height: 32, borderRadius: "50%",
                          background: "var(--bg-glass)", border: "1px solid var(--border)",
                          cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
                          color: "var(--text-3)",
                        }}>
                          <X size={14} />
                        </button>
                      </div>
                    </div>

                    {/* Brief rows */}
                    {BRIEF_ROWS.map((row, i) => (
                      <motion.div
                        key={row.key}
                        initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.07 }}
                        style={{ borderTop: "1px solid var(--border)", paddingTop: 20, paddingBottom: 20 }}
                      >
                        <p style={{ fontSize: 10, color: "var(--text-3)", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 9 }}>
                          {row.icon} {row.label}
                        </p>
                        <p style={{ fontSize: 14, color: "var(--text-2)", lineHeight: 1.85, fontWeight: 500 }}>
                          {brief[row.key] || "—"}
                        </p>
                      </motion.div>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>

            </motion.div>
          )}
        </AnimatePresence>

      </main>
    </div>
  );
}
