// Save token + user info
export function saveAuth(token, user) {
  localStorage.setItem("token", token);
  localStorage.setItem("user", JSON.stringify(user));
}

// Get current user object or null
export function getUser() {
  const raw = localStorage.getItem("user");
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

// Simple logged-in check
export function isLoggedIn() {
  return !!localStorage.getItem("token");
}

// Clear auth on logout
export function clearAuth() {
  localStorage.removeItem("token");
  localStorage.removeItem("user");
}
