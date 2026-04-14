const BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:5001";

const authHeaders = (token) => ({
  "Content-Type": "application/json",
  Authorization: `Bearer ${token}`,
});

export const getUserProfile = async (token) => {
  const res = await fetch(`${BASE_URL}/api/auth/me`, {
    headers: authHeaders(token),
  });
  if (!res.ok) throw new Error("Failed to fetch profile");
  return res.json();
};

export const registerUser = async (data) => {
  const res = await fetch(`${BASE_URL}/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
     const errMsgs = await res.json();
     throw new Error(errMsgs.message || "Failed to register");
  }
  return res.json();
};

export const loginUser = async (credentials) => {
  const res = await fetch(`${BASE_URL}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(credentials),
  });
  if (!res.ok) {
     const errMsgs = await res.json();
     throw new Error(errMsgs.message || "Failed to login");
  }
  return res.json();
};

export const saveGuardianDetails = async (token, data) => {
  const res = await fetch(`${BASE_URL}/api/auth/guardian`, {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Failed to save guardian details");
  return res.json();
};

export const verifyInviteToken = async (token) => {
  const res = await fetch(`${BASE_URL}/api/auth/invite/verify`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token }),
  });
  if (!res.ok) throw new Error("Invalid or expired invite token");
  return res.json();
};

export const completeGuardianSetup = async (data) => {
  const res = await fetch(`${BASE_URL}/api/auth/invite/complete`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Failed to complete guardian setup");
  return res.json();
};

export const updateUserProfile = async (token, data) => {
  const res = await fetch(`${BASE_URL}/api/auth/profile`, {
    method: "PATCH",
    headers: authHeaders(token),
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Failed to update profile");
  return res.json();
};

export const deleteUserAccount = async (token) => {
  const res = await fetch(`${BASE_URL}/api/auth/account`, {
    method: "DELETE",
    headers: authHeaders(token),
  });
  if (!res.ok) throw new Error("Failed to delete account");
  return res.json();
};

export const getAdminStats = async (token) => {
  const res = await fetch(`${BASE_URL}/api/admin/stats`, {
    headers: authHeaders(token),
  });
  if (!res.ok) throw new Error("Failed to fetch stats");
  return res.json();
};

export const getAdminUsers = async (token) => {
  const res = await fetch(`${BASE_URL}/api/admin/users`, {
    headers: authHeaders(token),
  });
  if (!res.ok) throw new Error("Failed to fetch users");
  return res.json();
};

export const toggleSuspendUser = async (token, userId) => {
  const res = await fetch(`${BASE_URL}/api/admin/users/${userId}/suspend`, {
    method: "PATCH",
    headers: authHeaders(token),
  });
  if (!res.ok) throw new Error("Failed to update user");
  return res.json();
};