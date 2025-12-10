import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import NavBar from "../components/NavBar";
import api from "../lib/api";
import { isLoggedIn } from "../lib/auth";

function CreateWorkspacePage() {
  const navigate = useNavigate();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [memberEmailsText, setMemberEmailsText] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  // Redirect if not logged in
  useEffect(() => {
    if (!isLoggedIn()) {
      navigate("/login");
    }
  }, [navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setMessage("");

    const token = localStorage.getItem("token");
    if (!token) {
      setError("Not authenticated.");
      return;
    }

    const memberEmails = memberEmailsText
      .split(",")
      .map((e) => e.trim())
      .filter((e) => e.length > 0);

    setLoading(true);
    try {
      await api.post(
        "/workspaces",
        { name, description, memberEmails },
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      setMessage(
        "Workspace created and invitations sent to registered users (by email)."
      );
      setTimeout(() => {
        navigate("/dashboard");
      }, 800);
    } catch (err) {
      const msg =
        err?.response?.data?.message || "Failed to create workspace.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-base-200 flex flex-col">
      <NavBar />

      <main className="flex-1">
        <div className="max-w-xl mx-auto px-4 py-6">
          <h1 className="text-2xl font-bold mb-2">Create Workspace</h1>
          <p className="text-sm text-neutral-500 mb-4">
            Enter a name, description, and the emails of members you want to
            invite.
          </p>

          {error && (
            <div className="alert alert-error py-2 text-sm mb-3">
              <span>{error}</span>
            </div>
          )}
          {message && (
            <div className="alert alert-success py-2 text-sm mb-3">
              <span>{message}</span>
            </div>
          )}

          <div className="card bg-base-100 shadow-md">
            <div className="card-body">
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="label">
                    <span className="label-text font-semibold">Name</span>
                  </label>
                  <input
                    type="text"
                    className="input input-bordered w-full"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    placeholder="Team Design Board"
                  />
                </div>

                <div>
                  <label className="label">
                    <span className="label-text font-semibold">
                      Description
                    </span>
                  </label>
                  <textarea
                    className="textarea textarea-bordered w-full"
                    rows={3}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Short description of this workspace..."
                  />
                </div>

                <div>
                  <label className="label">
                    <span className="label-text font-semibold">
                      Member emails
                    </span>
                  </label>
                  <textarea
                    className="textarea textarea-bordered w-full"
                    rows={3}
                    value={memberEmailsText}
                    onChange={(e) => setMemberEmailsText(e.target.value)}
                    placeholder="example1@mail.com, example2@mail.com"
                  />
                  <p className="text-xs text-neutral-500 mt-1">
                    Separate emails with commas. Invitations are only sent to
                    users who already registered in the system.
                  </p>
                </div>

                <div className="pt-2">
                  <button
                    type="submit"
                    className={`btn btn-primary w-full ${
                      loading ? "btn-disabled" : ""
                    }`}
                    disabled={loading}
                  >
                    {loading ? "Creating..." : "Create workspace"}
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

export default CreateWorkspacePage;
