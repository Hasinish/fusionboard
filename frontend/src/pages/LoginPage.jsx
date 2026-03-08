import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import api from "../lib/api";
import { saveAuth, isLoggedIn } from "../lib/auth";
import { useGoogleLogin } from "@react-oauth/google";
import { Loader2, Sparkles } from "lucide-react";

function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  useEffect(() => {
    if (isLoggedIn()) {
      navigate("/dashboard");
    }
  }, [navigate]);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await api.post("/auth/login", { email, password });
      saveAuth(res.data.token, res.data.user);
      navigate("/dashboard");
    } catch (err) {
      setError(err?.response?.data?.message || "Login failed.");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSuccess = async (credentialResponse) => {
    setError("");
    setGoogleLoading(true);
    try {
      const res = await api.post("/auth/google", {
        access_token: credentialResponse.access_token,
      });
      saveAuth(res.data.token, res.data.user);
      navigate("/dashboard");
    } catch (err) {
      console.error("Google login error:", err);
      setError(err?.response?.data?.message || err?.message || "Google Login failed.");
    } finally {
      setGoogleLoading(false);
    }
  };

  const googleLogin = useGoogleLogin({
    onSuccess: handleGoogleSuccess,
    onError: (err) => {
      console.error("Google OAuth error:", err);
      setError(err?.message || "Google Login Failed");
    },
  });

  function GoogleButton({ onClick }) {
    return (
      <button
        onClick={onClick}
        type="button"
        disabled={googleLoading}
        className="w-full h-[54px] bg-white border border-[#D1D5DB] flex items-center justify-center gap-3 px-6 text-lg text-[#1A1A2E] font-bold rounded-full hover:bg-gray-50 active:scale-[0.98] transition-all relative overflow-hidden"
      >
        <span className="flex items-center justify-center">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 533.5 544.3" className="w-5 h-5">
            <path fill="#4285f4" d="M533.5 278.4c0-18.7-1.5-37.4-4.7-55.4H272v104.9h147.1c-6.4 34.6-25 63.9-53.4 83.6v69.6h86.2c50.4-46.5 81.6-114.8 81.6-202.7z" />
            <path fill="#34a853" d="M272 544.3c72.6 0 133.5-24 178-65.5l-86.2-69.6c-24 16.1-54.8 25.6-91.8 25.6-70.5 0-130.3-47.6-151.7-111.6H33.8v70.2C78.2 483.6 167 544.3 272 544.3z" />
            <path fill="#fbbc04" d="M120.3 323.2c-10.9-32.4-10.9-67.3 0-99.7V153.4H33.8c-39.8 78.7-39.8 171.5 0 250.2l86.5-80.4z" />
            <path fill="#ea4335" d="M272 107.9c39.6-.6 78 14 107 40.4l80.2-80.2C405.2 23.6 344.4 0 272 0 167 0 78.2 60.7 33.8 153.4l86.5 70.1C141.7 155.5 201.5 107.9 272 107.9z" />
          </svg>
        </span>
        <span>{googleLoading ? "Signing in..." : "Continue with Google"}</span>
      </button>
    );
  }

  return (
    <div className="min-h-screen w-screen bg-[#F3E9D5] flex flex-col md:flex-row overflow-y-auto md:overflow-hidden font-sans">

      {/* Left Side: Illustration */}
      <div className="w-full md:w-[63%] flex items-center justify-center p-6 md:p-12 lg:p-20 transition-all duration-300">
        <img
          src="/assets/login.jpg"
          alt="Collaboration Illustration"
          className="w-full max-w-[750px] h-auto md:max-h-[60vh] max-h-[30vh] object-contain"
        />
      </div>

      {/* Right Side: Form */}
      <div className="w-full md:w-[37%] flex flex-col justify-center p-8 md:p-12 lg:pr-20 lg:pl-0">
        <div className="max-w-[400px] mx-auto w-full">
          {/* Header Section */}
          <div className="w-full text-center mb-6">
            <div className="flex items-center justify-center gap-2 mb-4">
              <Sparkles size={28} className="text-[#244E8A]" />
              <h1 className="text-2xl md:text-[34px] font-black text-[#1A1A2E] tracking-tighter font-display">
                Fusion<span className="text-[#244E8A]">Board</span>
              </h1>
            </div>
            <h2 className="text-xl md:text-[28px] font-bold text-[#1A1A2E] leading-tight mb-4 tracking-tight font-display">Welcome back!</h2>
          </div>

          {/* Form Section */}
          <div className="w-full">
            {error && (
              <div className="bg-red-50 border border-red-100 text-red-600 px-4 py-2 rounded-xl text-sm mb-4 text-center">
                {error}
              </div>
            )}

            <form onSubmit={handleLogin} className="space-y-4">
              <input
                type="email"
                className="w-full bg-[#E8EEF5] border border-[#D1D5DB] rounded-full px-6 text-[#1A1A2E] placeholder-[#94A3B8] outline-none focus:ring-2 focus:ring-[#244E8A]/20 focus:bg-white focus:border-[#244E8A] transition-all text-base h-[54px]"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="Email address"
              />

              <div className="space-y-2">
                <input
                  type="password"
                  className="w-full bg-[#E8EEF5] border border-[#D1D5DB] rounded-full px-6 text-[#1A1A2E] placeholder-[#94A3B8] outline-none focus:ring-2 focus:ring-[#244E8A]/20 focus:bg-white focus:border-[#244E8A] transition-all text-base h-[54px]"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  placeholder="Password"
                />
                <div className="flex justify-end pt-1">
                  <a href="#" className="text-[13px] font-bold text-[#1A1A2E] hover:underline opacity-80">Forgot Password?</a>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-[#244E8A] text-white rounded-full font-bold text-lg hover:bg-[#1d3f70] active:scale-[0.98] transition-all flex items-center justify-center gap-2 mt-2 h-[54px]"
              >
                {loading ? <Loader2 className="animate-spin" size={24} /> : "Log In"}
              </button>
            </form>

            {/* Social and Footer */}
            <div className="mt-4 flex flex-col gap-5">
              <div className="w-full flex justify-center">
                <GoogleButton onClick={() => googleLogin()} />
              </div>

              <p className="text-center text-[#1A1A2E] text-sm font-medium pt-2">
                Don't have an account?{" "}
                <Link to="/register" className="font-bold hover:underline">
                  Sign up
                </Link>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default LoginPage;
