import { useState } from "react";
import SignIn from "./SignIn";
import SignUp from "./SignUp";
import GuardianDetails from "./GuardianDetails";

const AuthPage = () => {
  const [activeTab, setActiveTab] = useState("signin");
  const [signupStep, setSignupStep] = useState(1);
  const [signupData, setSignupData] = useState(null);

  const handleSignupStep1Complete = (data) => {
    setSignupData(data);
    setSignupStep(2);
  };

  const handleBack = () => {
    setSignupStep(1);
  };

  return (
    <div className="auth-page">
      {/* Ambient background orbs */}
      <div className="orb orb-cyan" />
      <div className="orb orb-purple" />

      <div className="aura-card" style={{ width: '100%', maxWidth: 448 }}>
        {/* Logo */}
        <div className="auth-logo">
          <span className="auth-logo-icon">◎</span>
          <span className="auth-logo-text">AuraOS</span>
        </div>

        {/* Tab toggle — only show on step 1 */}
        {!(activeTab === "signup" && signupStep === 2) && (
          <div className="auth-tabs">
            <button
              className={`auth-tab ${activeTab === "signin" ? "active" : ""}`}
              onClick={() => {
                setActiveTab("signin");
                setSignupStep(1);
              }}
            >
              Sign in
            </button>
            <button
              className={`auth-tab ${activeTab === "signup" ? "active" : ""}`}
              onClick={() => {
                setActiveTab("signup");
                setSignupStep(1);
              }}
            >
              Create account
            </button>
          </div>
        )}

        {/* Content */}
        {activeTab === "signin" && <SignIn />}

        {activeTab === "signup" && signupStep === 1 && (
          <SignUp onComplete={handleSignupStep1Complete} />
        )}

        {activeTab === "signup" && signupStep === 2 && (
          <GuardianDetails
            signupData={signupData}
            onBack={handleBack}
          />
        )}
      </div>
    </div>
  );
};

export default AuthPage;