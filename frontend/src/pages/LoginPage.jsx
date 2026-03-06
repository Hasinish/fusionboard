import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import api from "../lib/api";
import { saveAuth, isLoggedIn } from "../lib/auth";
import { GoogleLogin } from "@react-oauth/google";
import { Loader2, Sparkles } from "lucide-react";

function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

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
    try {
      const res = await api.post("/auth/google", {
        credential: credentialResponse.credential,
      });
      saveAuth(res.data.token, res.data.user);
      navigate("/dashboard");
    } catch (err) {
      console.error(err);
      setError("Google Login failed.");
    }
  };

  return (
    <div className="min-h-screen w-screen bg-[#F3E9D5] flex flex-col md:flex-row overflow-y-auto md:overflow-hidden font-sans">

      {/* Left Side: Illustration */}
      <div className="w-full md:w-[63%] flex items-center justify-center p-8 md:p-12 lg:p-20 transition-all duration-300">
        <img
          src="/assets/login.jpg"
          alt="Collaboration Illustration"
          className="w-full max-w-[750px] h-auto object-contain"
        />
      </div>

      {/* Right Side: Form */}
      <div className="w-full md:w-[37%] flex flex-col justify-center p-8 md:p-12 lg:pr-20 lg:pl-0">
        <div className="max-w-[400px] mx-auto w-full">
          {/* Header Section */}
          <div className="w-full text-center mb-10">
            <div className="flex items-center justify-center gap-2 mb-8">
              <Sparkles size={32} className="text-[#244E8A]" />
              <h1 className="text-[34px] font-black text-[#1A1A2E] tracking-tighter font-display">
                Fusion<span className="text-[#244E8A]">Board</span>
              </h1>
            </div>
            <h2 className="text-[28px] font-bold text-[#1A1A2E] leading-tight mb-8 tracking-tight font-display">Welcome back!</h2>
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
                {/* Fixed Google button - removed custom container to let library handle it */}
                <GoogleLogin
                  onSuccess={handleGoogleSuccess}
                  onError={() => setError("Google Login Failed")}
                  theme="outline"
                  size="large"
                  width="400"
                  shape="circle"
                  text="continue_with"
                />
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