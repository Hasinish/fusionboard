import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import api from "../lib/api";
import { saveAuth, isLoggedIn } from "../lib/auth";
import { GoogleLogin } from "@react-oauth/google"; // pull in the google login button

function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  // boot them to the dashboard if they're already signed in
  useEffect(() => {
    if (isLoggedIn()) {
      navigate("/dashboard");
    }
  }, [navigate]);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");
    try {
      const res = await api.post("/auth/login", { email, password });
      saveAuth(res.data.token, res.data.user);
      navigate("/dashboard");
    } catch (err) {
      setError(err?.response?.data?.message || "Login failed. Check email or password.");
    }
  };

  // what to do when google login works
  const handleGoogleSuccess = async (credentialResponse) => {
    try {
      // pass the google token to our server
      const res = await api.post("/auth/google", {
        credential: credentialResponse.credential,
      });
      // store our shiny new login token
      saveAuth(res.data.token, res.data.user);
      navigate("/dashboard");
    } catch (err) {
      console.error(err);
      setError("Google Login failed.");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-base-200">
      <div className="card w-full max-w-sm bg-base-100 shadow-xl">
        <div className="card-body">
          <h2 className="card-title justify-center mb-4">Login</h2>

          {error && (
            <div className="alert alert-error py-1 text-sm mb-2">
              <span>{error}</span>
            </div>
          )}


          <div className="w-full flex justify-center mb-4">
            <GoogleLogin
              onSuccess={handleGoogleSuccess}
              onError={() => setError("Google Login Failed")}
              theme="outline"
              width="320"
            />
          </div>

          <div className="divider text-xs text-neutral-400">OR EMAIL</div>

          <form onSubmit={handleLogin} className="space-y-3">
            <div className="form-control">
              <label className="label">
                <span className="label-text">Email</span>
              </label>
              <input
                type="email"
                className="input input-bordered"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="you@example.com"
              />
            </div>

            <div className="form-control">
              <label className="label">
                <span className="label-text">Password</span>
              </label>
              <input
                type="password"
                className="input input-bordered"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder="••••••••"
              />
            </div>

            <button type="submit" className="btn btn-primary w-full mt-2">
              Login
            </button>
          </form>

          <p className="text-center text-sm mt-4">
            New here?{" "}
            <Link to="/register" className="link link-primary">
              Register
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

export default LoginPage;