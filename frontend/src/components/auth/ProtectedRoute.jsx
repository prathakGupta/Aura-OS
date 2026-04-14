import { Navigate } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";

const ProtectedRoute = ({ children, allowedRoles }) => {
  const { user, role, onboardingComplete, loading } = useAuth();

  if (loading) {
    return (
      <div className="auth-page">
        <div className="orb orb-cyan" />
        <div className="orb orb-purple" />
        <div style={{
          color: "#8B82A7",
          fontSize: "14px",
          position: "relative",
          zIndex: 10
        }}>
          Loading...
        </div>
      </div>
    );
  }

  // Not logged in — always allow access to /auth
  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  // Logged in but onboarding not complete (only for 'user' role)
  if (role === "user" && !onboardingComplete && window.location.pathname !== "/auth/guardian") {
    return <Navigate to="/auth/guardian" replace />;
  }

  // Role check — redirect to correct home if wrong role
  if (allowedRoles && !allowedRoles.includes(role)) {
    if (role === "guardian") return <Navigate to="/observer" replace />;
    if (role === "admin") return <Navigate to="/admin" replace />;
    return <Navigate to="/app" replace />;
  }

  return children;
};

export default ProtectedRoute;