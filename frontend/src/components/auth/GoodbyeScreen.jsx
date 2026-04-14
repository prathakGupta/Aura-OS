import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

const GoodbyeScreen = () => {
  const navigate = useNavigate();

  useEffect(() => {
    const timer = setTimeout(() => {
      navigate("/auth", { replace: true });
    }, 3000);
    return () => clearTimeout(timer);
  }, [navigate]);

  return (
    <div className="auth-page">
      <div className="orb orb-cyan" />
      <div className="orb orb-purple" />
      <div className="goodbye-card">
        <span className="auth-logo-icon" style={{ fontSize: 36 }}>◎</span>
        <h2>Your account has been deleted.</h2>
        <p>Take care of yourself.</p>
        <div className="goodbye-bar">
          <div className="goodbye-bar-fill" />
        </div>
      </div>
    </div>
  );
};

export default GoodbyeScreen;