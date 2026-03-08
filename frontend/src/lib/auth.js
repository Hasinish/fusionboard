// stash the token and user profile in local storage
export function saveAuth(token, user) {
  localStorage.setItem("token", token);
  localStorage.setItem("user", JSON.stringify(user));
}

// grab the user's profile if they have one
export function getUser() {
  const raw = localStorage.getItem("user");
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

// quick check if they're logged in
export function isLoggedIn() {
  return !!localStorage.getItem("token");
}

// wipe everything when they log out
export function clearAuth() {
  localStorage.removeItem("token");
  localStorage.removeItem("user");
}
