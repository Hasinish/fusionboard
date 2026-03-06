import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import api from "../lib/api";
import { getUser, isLoggedIn, saveAuth, clearAuth } from "../lib/auth";
import {
  User,
  Mail,
  Phone,
  FileText,
  ArrowLeft,
  LogOut,
  Camera,
  Save,
  Loader2,
  Sparkles
} from "lucide-react";

function ProfilePage() {
  const navigate = useNavigate();
  const storedUser = getUser();

  const [name, setName] = useState(storedUser?.name || "");
  const [email, setEmail] = useState(storedUser?.email || "");
  const [contact, setContact] = useState(storedUser?.contact || "");
  const [bio, setBio] = useState(storedUser?.bio || "");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

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
    setLoading(true);

    try {
      const token = localStorage.getItem("token");
      if (!token) {
        setError("Not authenticated.");
        return;
      }

      const res = await api.put(
        "/auth/me",
        { name, email, contact, bio },
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      saveAuth(token, res.data.user);
      setMessage("Profile updated successfully!");
      setTimeout(() => setMessage(""), 3000);
    } catch (err) {
      setError(err?.response?.data?.message || "Failed to update profile.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F5EAD8] font-sans flex flex-col">
      {/* Top Header */}
      <header className="bg-white border-b border-[#E8DDD0] px-8 py-4 flex items-center justify-between sticky top-0 z-20">
        <div className="flex items-center gap-6">
          <button
            onClick={() => navigate("/dashboard")}
            className="w-10 h-10 rounded-full bg-[#F5EAD8] flex items-center justify-center text-[#1A1A2E] hover:bg-white hover:border border-[#E8DDD0] transition-all"
          >
            <ArrowLeft size={20} />
          </button>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-[#244e8a] rounded-lg flex items-center justify-center">
              <Sparkles size={16} className="text-white" />
            </div>
            <span className="font-black text-[#1A1A2E] text-lg tracking-tight font-display">FusionBoard</span>
          </div>
        </div>

        <button
          onClick={handleLogout}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-[#6B6560] hover:bg-red-50 hover:text-red-500 transition-colors font-bold text-sm"
        >
          <LogOut size={18} />
          Logout
        </button>
      </header>

      <main className="flex-1 p-6 md:p-10 lg:p-16 overflow-y-auto">
        <div className="max-w-7xl mx-auto">
          <div className="mb-10">
            <h1 className="text-4xl font-black text-[#1A1A2E] tracking-tight font-display">Your Profile</h1>
            <p className="text-[#6B6560] mt-2 font-medium">Manage your personal information and preferences.</p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Left Col: Avatar & Identity */}
            <div className="lg:col-span-1 space-y-6">
              <div className="bg-white border border-[#E8DDD0] rounded-[32px] p-8 flex flex-col items-center text-center shadow-sm">
                <div className="relative group">
                  <div className="w-32 h-32 rounded-full bg-[#E8DDD0] flex items-center justify-center overflow-hidden border-4 border-white shadow-lg">
                    {storedUser?.avatar ? (
                      <img src={storedUser.avatar} alt={name} className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-4xl font-black text-[#1A1A2E]">{name.charAt(0).toUpperCase()}</span>
                    )}
                  </div>
                  <button className="absolute bottom-1 right-1 w-10 h-10 bg-[#244e8a] text-white rounded-full flex items-center justify-center shadow-lg hover:scale-110 transition-transform cursor-pointer border-2 border-white">
                    <Camera size={18} />
                  </button>
                </div>

                <h3 className="mt-6 text-xl font-bold text-[#1A1A2E] font-display">{name}</h3>
                <p className="text-[#6B6560] text-sm font-medium">{email}</p>
                <div className="mt-4 px-3 py-1 bg-[#F5EAD8] rounded-full text-[10px] font-black uppercase tracking-widest text-[#1A1A2E]">
                  Personal Account
                </div>
              </div>

              <div className="bg-white border border-[#E8DDD0] rounded-2xl p-6 italic text-sm text-[#6B6560] leading-relaxed">
                "Customize your workspace presence by filling out your bio and contact details so teammates can reach you easily."
              </div>
            </div>

            {/* Right Col: Details Form */}
            <div className="lg:col-span-2">
              <div className="bg-white border border-[#E8DDD0] rounded-[32px] p-8 md:p-10 shadow-sm transition-all">
                {message && (
                  <div className="mb-6 p-4 bg-green-50 border border-green-100 text-green-700 rounded-2xl flex items-center gap-3 animate-in fade-in slide-in-from-top-2">
                    <div className="w-2 h-2 rounded-full bg-green-500" />
                    <span className="font-bold text-sm tracking-tight">{message}</span>
                  </div>
                )}

                {error && (
                  <div className="mb-6 p-4 bg-red-50 border border-red-100 text-red-700 rounded-2xl flex items-center gap-3">
                    <div className="w-2 h-2 rounded-full bg-red-500" />
                    <span className="font-bold text-sm tracking-tight">{error}</span>
                  </div>
                )}

                <form onSubmit={handleUpdate} className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-xs font-black text-[#1A1A2E] uppercase tracking-widest ml-1">Full Name</label>
                      <div className="relative">
                        <User size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#6B6560]" />
                        <input
                          type="text"
                          className="w-full bg-[#F5EAD8]/30 border border-[#E8DDD0] rounded-2xl pl-12 pr-4 py-4 text-[#1A1A2E] font-bold outline-none focus:ring-2 focus:ring-[#244e8a]/20 focus:border-[#244e8a] transition-all"
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                          required
                          placeholder="Your Name"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-xs font-black text-[#1A1A2E] uppercase tracking-widest ml-1">Email Address</label>
                      <div className="relative">
                        <Mail size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#6B6560]" />
                        <input
                          type="email"
                          className="w-full bg-[#F5EAD8]/30 border border-[#E8DDD0] rounded-2xl pl-12 pr-4 py-4 text-[#1A1A2E] font-bold outline-none focus:ring-2 focus:ring-[#244e8a]/20 focus:border-[#244e8a] transition-all"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          required
                          placeholder="Email"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-black text-[#1A1A2E] uppercase tracking-widest ml-1">Contact Number</label>
                    <div className="relative">
                      <Phone size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#6B6560]" />
                      <input
                        type="text"
                        className="w-full bg-[#F5EAD8]/30 border border-[#E8DDD0] rounded-2xl pl-12 pr-4 py-4 text-[#1A1A2E] font-bold outline-none focus:ring-2 focus:ring-[#244e8a]/20 focus:border-[#244e8a] transition-all"
                        value={contact}
                        onChange={(e) => setContact(e.target.value)}
                        placeholder="+1 234 567 890"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-black text-[#1A1A2E] uppercase tracking-widest ml-1">Bio</label>
                    <div className="relative">
                      <FileText size={18} className="absolute left-4 top-4 text-[#6B6560]" />
                      <textarea
                        className="w-full bg-[#F5EAD8]/30 border border-[#E8DDD0] rounded-2xl pl-12 pr-4 py-4 text-[#1A1A2E] font-bold outline-none focus:ring-2 focus:ring-[#244e8a]/20 focus:border-[#244e8a] transition-all min-h-[140px] resize-none"
                        value={bio}
                        onChange={(e) => setBio(e.target.value)}
                        placeholder="Tell us a bit about yourself..."
                      />
                    </div>
                  </div>

                  <div className="pt-4 flex justify-end">
                    <button
                      type="submit"
                      disabled={loading}
                      className="bg-[#244e8a] text-white px-8 py-4 rounded-2xl font-black text-lg hover:bg-[#1d3f70] active:scale-[0.98] transition-all flex items-center gap-3 shadow-xl shadow-[#244e8a]/20"
                    >
                      {loading ? (
                        <Loader2 className="animate-spin" size={24} />
                      ) : (
                        <>
                          <Save size={20} />
                          Save Changes
                        </>
                      )}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

export default ProfilePage;
