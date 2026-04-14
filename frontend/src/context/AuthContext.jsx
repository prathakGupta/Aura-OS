import { createContext, useContext, useEffect, useState } from "react";
import { auth } from "../firebase";
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  signOut,
  sendPasswordResetEmail,
} from "firebase/auth";
import { googleProvider } from "../firebase";
import { getUserProfile } from "../services/authApi";

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [role, setRole] = useState(null);
  const [onboardingComplete, setOnboardingComplete] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        setUser(firebaseUser);
        try {
          const token = await firebaseUser.getIdToken();
          const data = await getUserProfile(token);
          setProfile(data.profile);
          setRole(data.profile?.role || null);
          setOnboardingComplete(data.profile?.onboardingComplete || false);
        } catch (err) {
          console.error("Failed to fetch profile:", err);
          setProfile(null);
          setRole(null);
          setOnboardingComplete(false);
        }
      } else {
        setUser(null);
        setProfile(null);
        setRole(null);
        setOnboardingComplete(false);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const signIn = (email, password) => {
    return signInWithEmailAndPassword(auth, email, password);
  };

  const signUp = (email, password) => {
    return createUserWithEmailAndPassword(auth, email, password);
  };

  const signInWithGoogle = () => {
    return signInWithPopup(auth, googleProvider);
  };

  const logout = () => {
    return signOut(auth);
  };

  const resetPassword = (email) => {
    return sendPasswordResetEmail(auth, email);
  };

  const refreshProfile = async () => {
  if (user) {
    try {
      const token = await user.getIdToken(true);
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