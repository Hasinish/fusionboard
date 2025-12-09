// frontend/src/pages/ProfilePage.jsx
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import NavBar from "../components/NavBar";
import api from "../lib/api";
import { getUser, isLoggedIn, saveAuth, clearAuth } from "../lib/auth";

function ProfilePage() {
  const navigate = useNavigate();
  const storedUser = getUser();

  const [name, setName] = useState(storedUser?.name || "");
  const [email, setEmail] = useState(storedUser?.email || "");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  // Redirect if not logged in
  useEffect(() => {
    if (!isLoggedIn()) {
      navigate("/login");
    }
  }, [navigate]);

  const handleLogout = () => {
    clearAuth();
    navigate("/login");
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
    setError("");
    setMessage("");

    try {
      const token = localStorage.getItem("token");
      if (!token) {
        setError("Not authenticated.");
        return;
      }

      const res = await api.put(
        "/auth/me",
        { name, email },
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      // Update localStorage user with new data
      saveAuth(token, res.data.user);
      setMessage("Profile updated successfully.");
    } catch (err) {
      const msg =
        err?.response?.data?.message || "Failed to update profile.";
      setError(msg);
    }
  };

  const idText = storedUser?.id || "N/A";

  return (
    <div className="min-h-screen bg-base-200 flex flex-col">
      <NavBar />

      <main className="flex-1">
        <div className="max-w-3xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-bold">Profile</h1>
              <p className="text-sm text-neutral-500">
                View and update your account details.
              </p>
            </div>

            <button
              onClick={handleLogout}
              className="btn btn-ghost btn-sm"
            >
              Logout
            </button>
          </div>

          <div className="card bg-base-100 shadow-xl">
            <div className="card-body">
              {/* Status messages */}
              {error && (
                <div className="alert alert-error py-2 text-sm mb-2">
                  <span>{error}</span>
                </div>
              )}
              {message && (
                <div className="alert alert-success py-2 text-sm mb-2">
                  <span>{message}</span>
                </div>
              )}

              {/* Details */}
              <form onSubmit={handleUpdate} className="space-y-4">
                <div>
                  <label className="label">
                    <span className="label-text font-semibold">
                      User ID
                    </span>
                  </label>
                  <input
                    type="text"
                    value={idText}
                    disabled
                    className="input input-bordered w-full bg-base-200"
                  />
                </div>

                <div>
                  <label className="label">
                    <span className="label-text font-semibold">
                      Name
                    </span>
                  </label>
                  <input
                    type="text"
                    className="input input-bordered w-full"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                  />
                </div>

                <div>
                  <label className="label">
                    <span className="label-text font-semibold">
                      Email
                    </span>
                  </label>
                  <input
                    type="email"
                    className="input input-bordered w-full"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>

                <div className="pt-2">
                  <button type="submit" className="btn btn-primary">
                    Save changes
                  </button>
                </div>
              </form>
            </div>
          </div>

        </div>
      </main>
    </div>
  );
}

export default ProfilePage;
