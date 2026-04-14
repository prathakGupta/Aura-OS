import { createContext, useContext, useEffect, useState } from "react";
import { getUserProfile, loginUser, registerUser } from "../services/authApi";

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [role, setRole] = useState(null);
  const [onboardingComplete, setOnboardingComplete] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const initAuth = async () => {
      const token = localStorage.getItem("token");
      if (token) {
        try {
          const data = await getUserProfile(token);
          setProfile(data.profile);
          setRole(data.profile?.role || null);
          setOnboardingComplete(data.profile?.onboardingComplete || false);
          setUser({ id: data.profile._id, email: data.profile.email }); // mock user object
        } catch (err) {
          console.error("Failed to fetch profile:", err);
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

  const signIn = async (email, password) => {
    const data = await loginUser({ email, password });
    if (data.success) {
      localStorage.setItem("token", data.token);
      setProfile(data.profile);
      setRole(data.profile?.role || null);
      setOnboardingComplete(data.profile?.onboardingComplete || false);
      setUser({ id: data.profile._id, email: data.profile.email });
      return data;
    }
  };

  const signUp = async (fullName, email, password) => {
    const data = await registerUser({ fullName, email, password });
    if (data.success) {
      localStorage.setItem("token", data.token);
      setProfile(data.profile);
      setRole(data.profile?.role || null);
      setOnboardingComplete(data.profile?.onboardingComplete || false);
      setUser({ id: data.profile._id, email: data.profile.email });
      return data;
    }
  };

  const signInWithGoogle = () => {
    alert("Sign In with Google is currently unsupported.");
    return Promise.reject(new Error("Feature unsupported"));
  };

  const logout = () => {
    localStorage.removeItem("token");
    setUser(null);
    setProfile(null);
    setRole(null);
    setOnboardingComplete(false);
  };

  const resetPassword = (email) => {
    alert("Reset password is not supported yet.");
    return Promise.reject(new Error("Feature unsupported"));
  };

  const refreshProfile = async () => {
    const token = localStorage.getItem("token");
    if (token) {
      try {
        const data = await getUserProfile(token);
        setProfile(data.profile);
        setRole(data.profile?.role || null);
        setOnboardingComplete(data.profile?.onboardingComplete || false);
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