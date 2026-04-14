import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";
import { updateUserProfile, deleteUserAccount } from "../../services/authApi";

const ProfilePage = () => {
  const { user, profile, logout, resetPassword, refreshProfile } = useAuth();
  const navigate = useNavigate();

  const [editingName, setEditingName] = useState(false);
  const [newName, setNewName] = useState(profile?.fullName || "");
  const [nameLoading, setNameLoading] = useState(false);
  const [nameSuccess, setNameSuccess] = useState(false);

  const [resetSent, setResetSent] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);

  const [deleteStep, setDeleteStep] = useState(0);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");

  const [error, setError] = useState("");

  const initials = (profile?.fullName || user?.email || "?")
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  const handleUpdateName = async () => {
    if (!newName.trim()) return;
    setNameLoading(true);
    setError("");
    try {
      const token = localStorage.getItem("token");
      await updateUserProfile(token, { fullName: newName.trim() });
      await refreshProfile();
      setEditingName(false);
      setNameSuccess(true);
      setTimeout(() => setNameSuccess(false), 3000);
    } catch (err) {
      setError("Failed to update name. Please try again.");
    } finally {
      setNameLoading(false);
    }
  };

  const handlePasswordReset = async () => {
    setResetLoading(true);
    try {
      await resetPassword(user.email);
      setResetSent(true);
    } catch (err) {
      setError("Failed to send reset email. Please try again.");
    } finally {
      setResetLoading(false);
    }
  };

  const handleLogout = async () => {
  await logout();
  navigate("/auth/logout", { replace: true });
};

  const handleDeleteAccount = async () => {
    if (deleteConfirmText !== "DELETE") return;
    setDeleteLoading(true);
    try {
      const token = localStorage.getItem("token");
      await deleteUserAccount(token);
      await logout();
      navigate("/goodbye", { replace: true });
    } catch (err) {
      setError("Failed to delete account. Please try again.");
      setDeleteLoading(false);
    }
  };

  return (
    <div className="profile-page">
      <div className="orb orb-cyan" />
      <div className="orb orb-purple" />

      <div className="profile-card">

        {/* Header */}
        <div className="profile-header">
          <button
            className="profile-back"
            onClick={() => navigate("/app")}
          >
            ← Back
          </button>
          <div className="profile-avatar">
            {initials}
          </div>
          <div className="profile-header-info">
            <h2>{profile?.fullName || "Your Account"}</h2>
            <span>{user?.email}</span>
          </div>
        </div>

        {error && (
          <div className="auth-error" style={{ marginBottom: 8 }}>
            {error}
          </div>
        )}

        {/* Display name */}
        <div className="profile-section">
          <div className="profile-section-label">Display name</div>
          {editingName ? (
            <div className="profile-edit-row">
              <input
                className="profile-input"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                autoFocus
              />
              <button
                className="auth-btn-primary"
                style={{ width: "auto", padding: "0 20px", height: 40 }}
                onClick={handleUpdateName}
                disabled={nameLoading}
              >
                {nameLoading ? "Saving..." : "Save"}
              </button>
              <button
                className="auth-btn-ghost"
                style={{ height: 40, padding: "0 16px" }}
                onClick={() => {
                  setEditingName(false);
                  setNewName(profile?.fullName || "");
                }}
              >
                Cancel
              </button>
            </div>
          ) : (
            <div className="profile-value-row">
              <span>{profile?.fullName}</span>
              <button
                className="profile-edit-btn"
                onClick={() => setEditingName(true)}
              >
                Edit
              </button>
            </div>
          )}
          {nameSuccess && (
            <span className="profile-success-msg">Name updated successfully.</span>
          )}
        </div>

        {/* Email */}
        <div className="profile-section">
          <div className="profile-section-label">Email address</div>
          <div className="profile-value-row">
            <span>{user?.email}</span>
            <span className="profile-readonly-tag">Read only</span>
          </div>
        </div>

        {/* Password */}
        <div className="profile-section">
          <div className="profile-section-label">Password</div>
          {profile?.authProvider === "google" ? (
            <p className="profile-muted">
              You signed in with Google. Password is managed by Google.
            </p>
          ) : resetSent ? (
            <p className="profile-success-msg">
              Reset link sent to your email.
            </p>
          ) : (
            <button
              className="auth-btn-ghost"
              style={{ width: "auto", padding: "0 20px", height: 40 }}
              onClick={handlePasswordReset}
              disabled={resetLoading}
            >
              {resetLoading ? "Sending..." : "Send password reset email"}
            </button>
          )}
        </div>

        {/* Logout */}
        <div className="profile-section">
          <div className="profile-section-label">Session</div>
          <button
            className="auth-btn-ghost"
            style={{ width: "auto", padding: "0 20px", height: 40 }}
            onClick={handleLogout}
          >
            Sign out
          </button>
        </div>

        {/* Delete account */}
        <div className="profile-section profile-danger-zone">
          <div className="profile-section-label danger">Danger zone</div>

          {deleteStep === 0 && (
            <button
              className="profile-delete-btn"
              onClick={() => setDeleteStep(1)}
            >
              Delete my account
            </button>
          )}

          {deleteStep === 1 && (
            <div className="profile-delete-confirm">
              <p>
                This will permanently delete your account, all your data,
                and notify your guardian. This cannot be undone.
              </p>
              <p>Type <strong>DELETE</strong> to confirm:</p>
              <input
                className="profile-input"
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
                placeholder="Type DELETE here"
              />
              <div className="profile-edit-row" style={{ marginTop: 8 }}>
                <button
                  className="profile-delete-btn"
                  onClick={handleDeleteAccount}
                  disabled={deleteConfirmText !== "DELETE" || deleteLoading}
                >
                  {deleteLoading ? "Deleting..." : "Confirm delete"}
                </button>
                <button
                  className="auth-btn-ghost"
                  style={{ height: 40, padding: "0 16px" }}
                  onClick={() => {
                    setDeleteStep(0);
                    setDeleteConfirmText("");
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>

      </div>
    </div>
  );
};

export default ProfilePage;