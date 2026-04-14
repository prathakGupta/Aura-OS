import { useState } from "react";
import { useAuth } from "../../hooks/useAuth";

const SignUp = ({ onComplete }) => {
  const { signUp, signInWithGoogle } = useAuth();

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
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
      const data = await signUp(fullName, email, password);
      onComplete({ token: data.token, fullName: data.profile.fullName, email: data.profile.email });
    } catch (err) {
      setError(err.message || "Something went wrong. Please try again in a moment.");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = async () => {
    try {
      await signInWithGoogle();
    } catch(err) {
       // feature unsupported, caught by authContext
    }
  };

  return (
    <div className="auth-form">
      <div className="auth-heading">
        <h1>Create your space</h1>
        <p>A calm setup, just a few steps.</p>
      </div>

      <div className="auth-step-indicator">
        <span className="auth-step-label">Step 1 of 2 — Your details</span>
        <div className="auth-progress">
          <div className="auth-progress-fill" style={{ width: "50%" }} />
        </div>
      </div>

      {error && <div className="auth-error">{error}</div>}

      <form onSubmit={handleSubmit}>
        <div className="auth-field">
          <label>Full name</label>
          <input
            type="text"
            className="aura-input-unified"
            placeholder="Your name"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            required
            autoComplete="name"
          />
        </div>

        <div className="auth-field">
          <label>Email address</label>
          <input
            type="email"
            className="aura-input-unified"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
          />
        </div>

        <div className="auth-field">
          <label>Password</label>
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
        >
          {loading ? "Setting up..." : "Continue"}
        </button>
      </form>

      <div className="auth-divider">
        <span>or</span>
      </div>

      <button
        type="button"
        className="auth-btn-google"
        onClick={handleGoogle}
        disabled={loading}
      >
        <svg width="18" height="18" viewBox="0 0 18 18">
          <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z"/>
          <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332C2.438 15.983 5.482 18 9 18z"/>
          <path fill="#FBBC05" d="M3.964 10.707c-.18-.54-.282-1.117-.282-1.707s.102-1.167.282-1.707V4.961H.957C.347 6.175 0 7.55 0 9s.348 2.825.957 4.039l3.007-2.332z"/>
          <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0 5.482 0 2.438 2.017.957 4.961L3.964 7.293C4.672 5.166 6.656 3.58 9 3.58z"/>
        </svg>
        Continue with Google
      </button>
    </div>
  );
};

export default SignUp;