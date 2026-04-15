import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { verifyInviteToken, completeGuardianSetup } from "../../services/authApi";

const GuardianInvite = () => {
  const { token } = useParams();
  const navigate = useNavigate();

  const [step, setStep] = useState("verifying"); 
  const [guardianInfo, setGuardianInfo] = useState(null);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const verify = async () => {
      try {
        const data = await verifyInviteToken(token);
        setGuardianInfo(data.guardian);
        setStep("verified");
      } catch (err) {
        setStep("error");
      }
    };
    verify();
  }, [token]);

  const handleSetup = async (e) => {
    e.preventDefault();
    setError("");

    if (password !== confirmPassword) {
      setError("Your passwords don't match. Please try again.");
      return;
    }

    if (password.length < 8) {
      setError("Please use at least 8 characters for your password.");
      return;
    }

    setLoading(true);
    try {
      const data = await completeGuardianSetup({
        token,
        password: password
      });
      localStorage.setItem("token", data.token);
      setStep("complete");
    } catch (err) {
      setError("Something went wrong. Please try again in a moment.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="orb orb-cyan" />
      <div className="orb orb-purple" />

      <div className="aura-card">
        {/* Logo */}
        <div className="auth-logo">
          <span className="auth-logo-icon">◎</span>
          <span className="auth-logo-text">AuraOS</span>
        </div>

        {/* Verifying state */}
        {step === "verifying" && (
          <div className="auth-form">
            <div className="auth-heading">
              <h1 className="aura-heading-gradient">Verifying your invite</h1>
              <p>Just a moment while we check your link.</p>
            </div>
            <div className="invite-spinner" />
          </div>
        )}

        {/* Error state */}
        {step === "error" && (
          <div className="auth-form">
            <div className="auth-heading">
              <h1>This link isn't valid</h1>
              <p>It may have expired or already been used.</p>
            </div>
            <div className="auth-error">
              Guardian invite links expire after 48 hours and can only be used once.
              Please ask the person who invited you to send a new link.
            </div>
          </div>
        )}

        {/* Verified — show setup form */}
        {step === "verified" && (
          <div className="auth-form">
            <div className="auth-heading">
              <h1>Set up your account</h1>
              <p>
                You've been added as a guardian on AuraOS.
                Create a password to access your portal.
              </p>
            </div>

            {guardianInfo && (
              <div className="invite-info">
                <span className="invite-info-label">Signing up as</span>
                <span className="invite-info-value">{guardianInfo.email}</span>
              </div>
            )}

            {error && <div className="auth-error">{error}</div>}

            <form onSubmit={handleSetup}>
              <div className="auth-field">
                <label>Create a password</label>
                <div className="auth-input-wrapper">
                  <input
                    type={showPassword ? "text" : "password"}
                    className="aura-input-unified"
                    placeholder="At least 8 characters"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    className="auth-show-password"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? "Hide" : "Show"}
                  </button>
                </div>
              </div>

              <div className="auth-field">
                <label>Confirm password</label>
                <input
                  type="password"
                  className="aura-input-unified"
                  placeholder="Repeat your password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  autoComplete="new-password"
                />
              </div>

              <button
                type="submit"
                className="auth-btn-primary"
                disabled={loading}
                style={{ marginTop: "8px" }}
              >
                {loading ? "Setting up..." : "Create my guardian account"}
              </button>
            </form>
          </div>
        )}

        {/* Complete state */}
        {step === "complete" && (
          <div className="auth-form">
            <div className="auth-heading">
              <h1 className="aura-heading-gradient">You're all set</h1>
              <p>Your guardian account has been created successfully.</p>
            </div>
            <div className="auth-success">
              <p>
                You can now sign in to your guardian portal to support
                {guardianInfo?.email ? ` the person who invited you` : " them"}.
              </p>
            </div>
            <button
              className="auth-btn-primary"
              onClick={() => { window.location.href = "/auth" }}
              style={{ marginTop: "8px" }}
            >
              Go to portal
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default GuardianInvite;