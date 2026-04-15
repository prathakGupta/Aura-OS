import { Navigate } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";
import { motion } from "framer-motion";

// Animated full-screen loader shown while auth is being restored from token
function AuthLoader() {
  return (
    <div style={{
      minHeight: "100dvh",
      background: "var(--bg-root)",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      gap: 24,
      fontFamily: "var(--font)",
    }}>
      {/* Spinning conic orb */}
      <motion.div
        animate={{ rotate: 360 }}
        transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
        style={{
          width: 56, height: 56, borderRadius: "50%",
          background: "conic-gradient(from 0deg, #7c3aed, #00e5ff, #00bfa5, transparent)",
          filter: "blur(0.5px)",
        }}
      />
      <motion.p
        animate={{ opacity: [0.4, 1, 0.4] }}
        transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
        style={{ color: "var(--text-3)", fontSize: 13, fontWeight: 600, letterSpacing: "0.06em" }}
      >
        Authenticating…
      </motion.p>
    </div>
  );
}

const ProtectedRoute = ({ children, allowedRoles }) => {
  const { user, role, onboardingComplete, loading } = useAuth();

  // Auth is still being restored from token — show animated loader
  if (loading) return <AuthLoader />;

  // Not logged in — send to auth page
  if (!user) return <Navigate to="/auth" replace />;

  // Logged in but onboarding not complete (only for regular users)
  if (
    role === "user" &&
    !onboardingComplete &&
    window.location.pathname !== "/auth/guardian"
  ) {
    return <Navigate to="/auth/guardian" replace />;
  }

  // Wrong role — redirect to the correct home for this user
  if (allowedRoles && !allowedRoles.includes(role)) {
    if (role === "guardian") return <Navigate to="/observer" replace />;
    if (role === "admin")    return <Navigate to="/admin"    replace />;
    return <Navigate to="/app" replace />;
  }

  return children;
};

export default ProtectedRoute;