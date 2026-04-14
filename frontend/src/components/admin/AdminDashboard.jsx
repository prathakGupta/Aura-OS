import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";
import { getAdminStats, getAdminUsers, toggleSuspendUser } from "../../services/authApi";
import { motion } from "framer-motion";
import { Users, Shield, Link, Clock, AlertTriangle, RefreshCw } from "lucide-react";

const ROLE_COLORS = {
  user:     { bg: "#eff6ff", color: "#3b82f6", label: "User" },
  guardian: { bg: "#f5f3ff", color: "#7c3aed", label: "Guardian" },
  admin:    { bg: "#fef9c3", color: "#ca8a04", label: "Admin" },
};

const StatCard = ({ label, value, icon: Icon, color }) => (
  <div style={{
    background: "white", borderRadius: 16, padding: "20px 24px",
    boxShadow: "0 2px 12px rgba(0,0,0,0.04)",
    display: "flex", flexDirection: "column", gap: 8,
  }}>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
      <p style={{ fontSize: 12, color: "#94a3b8", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.07em" }}>
        {label}
      </p>
      <div style={{
        width: 32, height: 32, borderRadius: 8,
        background: `${color}18`,
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        <Icon size={15} color={color} />
      </div>
    </div>
    <p style={{ fontSize: 32, fontWeight: 800, color: "#1a2633" }}>{value ?? "—"}</p>
  </div>
);

export default function AdminDashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const [stats,   setStats]   = useState(null);
  const [users,   setUsers]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);
  const [suspendingId, setSuspendingId] = useState(null);
  const [search,  setSearch]  = useState("");
  const [roleFilter, setRoleFilter] = useState("all");

  const fetchAll = async () => {
    setLoading(true);
    setError(null);
    try {
      const token = await user.getIdToken(true);
      const [statsRes, usersRes] = await Promise.all([
        getAdminStats(token),
        getAdminUsers(token),
      ]);
      setStats(statsRes.stats);
      setUsers(usersRes.users);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchAll(); }, []);

  const handleSuspend = async (userId) => {
    setSuspendingId(userId);
    try {
      const token = await user.getIdToken(true);
      const res = await toggleSuspendUser(token, userId);
      setUsers(prev =>
        prev.map(u => u._id === userId ? { ...u, isActive: res.isActive } : u)
      );
    } catch (err) {
      setError(err.message);
    } finally {
      setSuspendingId(null);
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate("/auth/logout", { replace: true });
  };

  const filtered = users.filter(u => {
    const matchesSearch =
      u.fullName?.toLowerCase().includes(search.toLowerCase()) ||
      u.email?.toLowerCase().includes(search.toLowerCase());
    const matchesRole = roleFilter === "all" || u.role === roleFilter;
    return matchesSearch && matchesRole;
  });

  return (
    <div style={{
      minHeight: "100dvh",
      background: "#f0f4f8",
      fontFamily: "system-ui, sans-serif",
      color: "#1a2633",
    }}>
      {/* Header */}
      <div style={{
        background: "white",
        borderBottom: "1px solid #e2e8f0",
        padding: "0 28px", height: 64,
        display: "flex", alignItems: "center",
        justifyContent: "space-between",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{
            width: 32, height: 32, borderRadius: "50%",
            background: "conic-gradient(from 180deg,#7c3aed,#00e5ff,#00bfa5,#7c3aed)",
          }} />
          <div>
            <p style={{ fontSize: 15, fontWeight: 800, color: "#1a2633", letterSpacing: "-0.03em" }}>
              AuraOS Admin
            </p>
            <p style={{ fontSize: 11, color: "#64748b" }}>System Management Dashboard</p>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <button onClick={fetchAll}
            style={{
              padding: "7px 14px", borderRadius: 99,
              border: "1px solid #e2e8f0", background: "white",
              cursor: "pointer", display: "flex", alignItems: "center",
              gap: 5, fontSize: 12, color: "#64748b",
            }}>
            <RefreshCw size={12} /> Refresh
          </button>
          <button onClick={handleLogout}
            style={{
              padding: "7px 16px", background: "white", color: "#64748b",
              border: "1px solid #e2e8f0", borderRadius: 99,
              fontSize: 12, fontWeight: 600, cursor: "pointer",
            }}>
            Sign out
          </button>
        </div>
      </div>

      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "32px 24px" }}>

        {error && (
          <div style={{
            background: "#fff5f5", border: "1px solid #fecaca",
            borderRadius: 14, padding: "14px 18px",
            marginBottom: 20, color: "#ef4444", fontSize: 14,
          }}>
            {error}
          </div>
        )}

        {loading ? (
          <div style={{ textAlign: "center", padding: 60 }}>
            <div style={{
              width: 40, height: 40,
              border: "3px solid #e2e8f0",
              borderTopColor: "#7c3aed",
              borderRadius: "50%",
              animation: "spin 0.7s linear infinite",
              margin: "0 auto 16px",
            }} />
            <p style={{ color: "#64748b", fontSize: 14 }}>Loading dashboard…</p>
          </div>
        ) : (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>

            {/* Stat cards */}
            {stats && (
              <div style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
                gap: 12, marginBottom: 28,
              }}>
                <StatCard label="Total Users"      value={stats.totalUsers}      icon={Users}         color="#3b82f6" />
                <StatCard label="Guardians"        value={stats.totalGuardians}  icon={Shield}        color="#7c3aed" />
                <StatCard label="Guardian Links"   value={stats.guardianLinks}   icon={Link}          color="#00bfa5" />
                <StatCard label="Pending Invites"  value={stats.pendingInvites}  icon={Clock}         color="#f59e0b" />
                <StatCard label="Suspended"        value={stats.suspended}       icon={AlertTriangle} color="#ef4444" />
              </div>
            )}

            {/* Filters */}
            <div style={{
              display: "flex", gap: 10, marginBottom: 16,
              flexWrap: "wrap", alignItems: "center",
            }}>
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search by name or email..."
                style={{
                  flex: 1, minWidth: 200,
                  padding: "10px 14px",
                  border: "1px solid #e2e8f0",
                  borderRadius: 12, fontSize: 14,
                  outline: "none", background: "white",
                  color: "#1a2633",
                }}
              />
              {["all", "user", "guardian", "admin"].map(r => (
                <button key={r} onClick={() => setRoleFilter(r)}
                  style={{
                    padding: "8px 16px", borderRadius: 99,
                    border: "1px solid",
                    borderColor: roleFilter === r ? "#7c3aed" : "#e2e8f0",
                    background: roleFilter === r ? "#7c3aed" : "white",
                    color: roleFilter === r ? "white" : "#64748b",
                    fontSize: 12, fontWeight: 600, cursor: "pointer",
                    textTransform: "capitalize",
                  }}>
                  {r === "all" ? "All roles" : r}
                </button>
              ))}
            </div>

            {/* Users table */}
            <div style={{
              background: "white", borderRadius: 16,
              boxShadow: "0 2px 12px rgba(0,0,0,0.04)",
              overflow: "hidden",
            }}>
              {/* Table header */}
              <div style={{
                display: "grid",
                gridTemplateColumns: "2fr 2fr 1fr 1.5fr 1fr",
                padding: "12px 20px",
                borderBottom: "1px solid #f1f5f9",
                fontSize: 11, fontWeight: 700,
                color: "#94a3b8", textTransform: "uppercase",
                letterSpacing: "0.07em",
              }}>
                <span>Name</span>
                <span>Email</span>
                <span>Role</span>
                <span>Guardian</span>
                <span>Action</span>
              </div>

              {/* Rows */}
              {filtered.length === 0 ? (
                <div style={{ padding: "32px", textAlign: "center", color: "#94a3b8", fontSize: 14 }}>
                  No users found
                </div>
              ) : (
                filtered.map((u, i) => {
                  const roleStyle = ROLE_COLORS[u.role] || ROLE_COLORS.user;
                  const isCurrentUser = u.firebaseUid === user?.uid;
                  return (
                    <motion.div
                      key={u._id}
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.03 }}
                      style={{
                        display: "grid",
                        gridTemplateColumns: "2fr 2fr 1fr 1.5fr 1fr",
                        padding: "14px 20px",
                        borderBottom: "1px solid #f8fafc",
                        alignItems: "center",
                        background: !u.isActive ? "rgba(239,68,68,0.03)" : "white",
                        opacity: !u.isActive ? 0.7 : 1,
                      }}>

                      {/* Name */}
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <div style={{
                          width: 32, height: 32, borderRadius: "50%",
                          background: "linear-gradient(135deg, #00C9FF, #7B2FBE)",
                          display: "flex", alignItems: "center", justifyContent: "center",
                          fontSize: 12, fontWeight: 700, color: "white", flexShrink: 0,
                        }}>
                          {(u.fullName || u.email || "?").split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2)}
                        </div>
                        <div>
                          <p style={{ fontSize: 13, fontWeight: 600, color: "#1a2633" }}>
                            {u.fullName || "—"}
                            {isCurrentUser && (
                              <span style={{ fontSize: 10, color: "#7c3aed", marginLeft: 6 }}>(you)</span>
                            )}
                          </p>
                          {!u.isActive && (
                            <p style={{ fontSize: 10, color: "#ef4444" }}>Suspended</p>
                          )}
                        </div>
                      </div>

                      {/* Email */}
                      <p style={{ fontSize: 13, color: "#64748b", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {u.email}
                      </p>

                      {/* Role badge */}
                      <span style={{
                        display: "inline-block",
                        padding: "3px 10px", borderRadius: 99,
                        background: roleStyle.bg, color: roleStyle.color,
                        fontSize: 11, fontWeight: 700,
                        textTransform: "capitalize",
                      }}>
                        {roleStyle.label}
                      </span>

                      {/* Guardian info */}
                      <div style={{ fontSize: 12, color: "#64748b" }}>
                        {u.role === "user" && u.guardian ? (
                          <div>
                            <p style={{ fontWeight: 600, color: "#374151" }}>{u.guardian.fullName}</p>
                            <p style={{ fontSize: 11 }}>
                              {u.guardian.relationship} · {u.guardian.inviteAccepted ? "✓ Active" : "⏳ Pending"}
                            </p>
                          </div>
                        ) : u.role === "guardian" && u.guardianRecord ? (
                          <p style={{ fontSize: 11 }}>
                            Linked to user
                          </p>
                        ) : (
                          <span style={{ color: "#cbd5e1" }}>—</span>
                        )}
                      </div>

                      {/* Suspend action */}
                      <div>
                        {isCurrentUser || u.role === "admin" ? (
                          <span style={{ fontSize: 11, color: "#cbd5e1" }}>—</span>
                        ) : (
                          <button
                            onClick={() => handleSuspend(u._id)}
                            disabled={suspendingId === u._id}
                            style={{
                              padding: "6px 14px", borderRadius: 8,
                              border: "1px solid",
                              borderColor: u.isActive ? "#fecaca" : "#bbf7d0",
                              background: u.isActive ? "#fff5f5" : "#f0fdf4",
                              color: u.isActive ? "#ef4444" : "#22c55e",
                              fontSize: 11, fontWeight: 600,
                              cursor: suspendingId === u._id ? "not-allowed" : "pointer",
                              opacity: suspendingId === u._id ? 0.6 : 1,
                            }}>
                            {suspendingId === u._id
                              ? "..."
                              : u.isActive ? "Suspend" : "Activate"}
                          </button>
                        )}
                      </div>
                    </motion.div>
                  );
                })
              )}
            </div>

          </motion.div>
        )}
      </div>
    </div>
  );
}