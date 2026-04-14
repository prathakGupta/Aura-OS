import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";
import { saveGuardianDetails } from "../../services/authApi";

const GuardianDetails = ({ signupData, onBack }) => {
  const { refreshProfile, user } = useAuth();
  const navigate = useNavigate();

  const [fullName, setFullName] = useState("");
  const [relationship, setRelationship] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [consent, setConsent] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!consent) {
      setError("Please confirm that the guardian details are accurate.");
      return;
    }

    setLoading(true);
    try {
      const token = signupData?.token || localStorage.getItem("token");
      await saveGuardianDetails(token, {
        fullName,
        relationship,
        email,
        phone,
        consentGiven: consent,
      });
      await refreshProfile();
      navigate("/app");
    } catch (err) {
      setError("Something went wrong saving guardian details. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-form">
      <div className="auth-heading">
        <h1>Guardian details</h1>
        <p>This helps us support you more safely when needed.</p>
      </div>

      <div className="auth-step-indicator">
        <span className="auth-step-label">Step 2 of 2 — Guardian details</span>
        <div className="auth-progress">
          <div className="auth-progress-fill" style={{ width: "100%" }} />
        </div>
      </div>

      {error && <div className="auth-error">{error}</div>}

      <form onSubmit={handleSubmit}>
        <div className="auth-field">
          <label>Guardian full name</label>
          <input
            type="text"
            placeholder="Their full name"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            required
          />
        </div>

        <div className="auth-field">
          <label>Relationship to you</label>
          <input
            type="text"
            placeholder="e.g. Parent, Therapist, Sibling"
            value={relationship}
            onChange={(e) => setRelationship(e.target.value)}
            required
          />
        </div>

        <div className="auth-field">
          <label>Guardian email</label>
          <input
            type="email"
            placeholder="their@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>

        <div className="auth-field">
          <label>Guardian phone number</label>
          <input
            type="tel"
            placeholder="+91 00000 00000"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            required
          />
        </div>

        <div className="auth-consent">
          <input
            type="checkbox"
            id="consent"
            checked={consent}
            onChange={(e) => setConsent(e.target.checked)}
          />
          <label htmlFor="consent">
            I confirm these guardian details are accurate.
          </label>
        </div>

        <div className="auth-btn-row">
          <button
            type="button"
            className="auth-btn-ghost"
            onClick={onBack}
            disabled={loading}
          >
            Back
          </button>
          <button
            type="submit"
            className="auth-btn-primary"
            disabled={loading || !consent}
          >
            {loading ? "Creating account..." : "Create account"}
          </button>
        </div>
      </form>
    </div>
  );
};

export default GuardianDetails;