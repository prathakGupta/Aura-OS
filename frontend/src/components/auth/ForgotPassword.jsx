import { useState } from "react";
import { useAuth } from "../../hooks/useAuth";

const ForgotPassword = ({ onBack }) => {
  const { resetPassword } = useAuth();

  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await resetPassword(email);
      setSent(true);
    } catch (err) {
      setError("We couldn't find an account with that email.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-form">
      <div className="auth-heading">
        <h1>Reset your password</h1>
        <p>We'll send a reset link to your email.</p>
      </div>

      {sent ? (
        <div className="auth-success">
          <p>Check your inbox. A reset link is on its way.</p>
          <button
            type="button"
            className="auth-btn-ghost"
            onClick={onBack}
          >
            Back to sign in
          </button>
        </div>
      ) : (
        <form onSubmit={handleSubmit}>
          {error && <div className="auth-error">{error}</div>}

          <div className="auth-field">
            <label>Email address</label>
            <input
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
          </div>

          <button
            type="submit"
            className="auth-btn-primary"
            disabled={loading}
          >
            {loading ? "Sending..." : "Send reset link"}
          </button>

          <button
            type="button"
            className="auth-btn-ghost"
            onClick={onBack}
          >
            Back to sign in
          </button>
        </form>
      )}
    </div>
  );
};

export default ForgotPassword;