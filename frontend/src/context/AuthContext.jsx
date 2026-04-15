import { createContext, useContext, useEffect, useState } from "react";
import { getUserProfile, loginUser, registerUser } from "../services/authApi";

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [role, setRole] = useState(null);
  const [onboardingComplete, setOnboardingComplete] = useState(false);
  const [loading, setLoading] = useState(true);

  // ── Shared helper: apply a full profile (from /me) to all state slices ──
  const applyProfile = (p) => {
    setProfile(p);
    setRole(p?.role || null);
    setOnboardingComplete(p?.onboardingComplete || false);
    setUser({ id: p._id, email: p.email });
  };

  // ── On mount: restore session from stored token ──────────────────────────
  useEffect(() => {
    const initAuth = async () => {
      const token = localStorage.getItem("token");
      if (token) {
        try {
          // /api/auth/me is the ONLY endpoint that returns linkedUserId for guardians
          const data = await getUserProfile(token);
          applyProfile(data.profile);
        } catch (err) {
          console.error("Failed to restore session:", err);
          localStorage.removeItem("token");
          setProfile(null);
          setRole(null);
          setOnboardingComplete(false);
          setUser(null);
        }
      } else {
        setUser(null);
        setProfile(null);
        setRole(null);
        setOnboardingComplete(false);
      }
      setLoading(false);
    };

    initAuth();
  }, []);

  // ── Sign in ───────────────────────────────────────────────────────────────
  // CRITICAL FIX: After login, always call /me to get the full profile
  // (including linkedUserId for guardians — the login endpoint doesn't return it)
  const signIn = async (email, password) => {
    const data = await loginUser({ email, password });
    if (data.success) {
      localStorage.setItem("token", data.token);

      // Start with what the login endpoint gave us (fast)
      let fullProfile = data.profile;
      try {
        // Fetch complete profile — includes linkedUserId for guardians
        const meData = await getUserProfile(data.token);
        if (meData?.profile) fullProfile = meData.profile;
      } catch (err) {
        // Non-fatal: fall back to the basic login profile
        console.warn("signIn: /me fetch failed, using basic profile", err.message);
      }

      applyProfile(fullProfile);
      return data;
    }
  };

  // ── Sign up ───────────────────────────────────────────────────────────────
  const signUp = async (fullName, email, password) => {
    const data = await registerUser({ fullName, email, password });
    if (data.success) {
      localStorage.setItem("token", data.token);

      let fullProfile = data.profile;
      try {
        const meData = await getUserProfile(data.token);
        if (meData?.profile) fullProfile = meData.profile;
      } catch {
        // Non-fatal
      }

      applyProfile(fullProfile);
      return data;
    }
  };

  // ── Unsupported auth methods ──────────────────────────────────────────────
  const signInWithGoogle = () => {
    alert("Sign In with Google is currently unsupported.");
    return Promise.reject(new Error("Feature unsupported"));
  };

  // ── Logout ────────────────────────────────────────────────────────────────
  const logout = () => {
    localStorage.removeItem("token");
    setUser(null);
    setProfile(null);
    setRole(null);
    setOnboardingComplete(false);
  };

  // ── Reset password (placeholder) ─────────────────────────────────────────
  const resetPassword = () => {
    alert("Reset password is not supported yet.");
    return Promise.reject(new Error("Feature unsupported"));
  };

  // ── Refresh profile (e.g. after onboarding completes) ────────────────────
  const refreshProfile = async () => {
    const token = localStorage.getItem("token");
    if (token) {
      try {
        const data = await getUserProfile(token);
        if (data?.profile) applyProfile(data.profile);
      } catch (err) {
        console.error("refreshProfile failed:", err);
      }
    }
  };

  const value = {
    user,
    profile,
    role,
    onboardingComplete,
    loading,
    signIn,
    signUp,
    signInWithGoogle,
    logout,
    resetPassword,
    refreshProfile,
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider");
  }
  return context;
};