import React from "react";
import { Link, useNavigate } from "react-router-dom";
import { isLoggedIn } from "../lib/auth";

/**
 * Pixel-Perfect Landing Page for FusionBoard
 * Matches the provided design screenshot using local assets.
 */
/**
 * Pixel-Perfect Landing Page for FusionBoard
 * Matches the provided design screenshot using local assets and super cool scroll animations.
 */
const LandingPage = () => {
  const navigate = useNavigate();

  // Redirect to dashboard if already logged in
  React.useEffect(() => {
    if (isLoggedIn()) {
      navigate("/dashboard");
    }
  }, [navigate]);

  // Reveal on scroll logic
  React.useEffect(() => {
    const observerOptions = {
      threshold: 0.15,
      rootMargin: '0px 0px -50px 0px'
    };

    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('active');
        } else {
          entry.target.classList.remove('active');
        }
      });
    }, observerOptions);

    const revealElements = document.querySelectorAll('.reveal');
    revealElements.forEach(el => observer.observe(el));

    return () => revealElements.forEach(el => observer.unobserve(el));
  }, []);

  return (
    <div className="bg-[#F5F0E6] text-[#1A1A2E] font-sans antialiased overflow-x-hidden selection:bg-orange-200">
      <style>{`
        @keyframes bounce-slow {
          0%, 100% { transform: translateY(-10%); animation-timing-function: cubic-bezier(0.8,0,1,1); }
          50% { transform: none; animation-timing-function: cubic-bezier(0,0,0.2,1); }
        }
        .animate-bounce-slow {
          animation: bounce-slow 2s infinite;
        }
        .doodle-font {
          font-family: 'Comic Sans MS', 'Chalkboard SE', cursive;
        }
        
        /* Reveal Animations */
        .reveal {
          opacity: 0;
          transition: all 1s cubic-bezier(0.22, 1, 0.36, 1);
        }
        
        .reveal-up { transform: translateY(40px); }
        .reveal-left { transform: translateX(-40px); }
        .reveal-right { transform: translateX(40px); }
        .reveal-zoom { transform: scale(0.95); }
        
        .reveal.active {
          opacity: 1;
          transform: none;
        }
        
        .delay-100 { transition-delay: 100ms; }
        .delay-200 { transition-delay: 200ms; }
        .delay-300 { transition-delay: 300ms; }
        .delay-500 { transition-delay: 500ms; }

        .feature-card {
          transition: transform 0.5s cubic-bezier(0.34, 1.56, 0.64, 1);
        }
        .feature-card:hover {
          transform: translateY(-8px) scale(1.01);
        }
      `}</style>
      
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 px-6 py-4 md:px-12 flex justify-between items-center bg-[#F5F0E6]/80 backdrop-blur-md">
        <div className="flex items-center">
          <span className="text-xl font-bold tracking-tight text-[#1A1A2E]">FusionBoard</span>
        </div>
        <div className="flex items-center space-x-6">
          <Link to="/login" className="text-xs font-semibold text-slate-700 hover:text-orange-600 transition-colors">
            Sign In
          </Link>
          <Link to="/register" className="px-4 py-2 bg-white text-[#1A1A2E] text-xs font-bold rounded-lg border border-slate-200 hover:bg-slate-50 transition-all shadow-sm">
            Get Started
          </Link>
        </div>
      </nav>

      {/* Hero Section */}
      <header className="relative min-h-screen flex flex-col items-center justify-center pt-32 pb-20 overflow-hidden" id="hero">
        <div className="relative z-10 max-w-5xl mx-auto px-6 text-center flex flex-col items-center">
          <h1 className="text-6xl md:text-7xl font-bold tracking-tight mb-4 text-[#1A1A2E] reveal reveal-up">
            FusionBoard
          </h1>
          <p className="text-lg md:text-xl max-w-2xl mb-12 text-[#1A1A2E]/60 font-medium leading-relaxed reveal reveal-up delay-100">
            The real-time collaborative whiteboard where teams think,<br />build, and create together.
          </p>
          
          {/* App Preview Mockup */}
          <div className="w-full max-w-5xl mx-auto rounded-xl shadow-[0_32px_64px_-12px_rgba(0,0,0,0.15)] border border-slate-200 overflow-hidden bg-white reveal reveal-zoom delay-300">
            <div className="bg-slate-50 border-b border-slate-200 px-4 py-3 flex items-center space-x-2">
              <div className="flex space-x-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-[#FF5F57]"></div>
                <div className="w-2.5 h-2.5 rounded-full bg-[#FFBD2E]"></div>
                <div className="w-2.5 h-2.5 rounded-full bg-[#27C93F]"></div>
              </div>
              <div className="flex-1 text-center">
                <div className="inline-block px-3 py-1 bg-white border border-slate-100 rounded text-[9px] text-slate-400">
                  app.fusionboard.io/workboard-main
                </div>
              </div>
            </div>
            <div className="bg-[#F8F9FA] overflow-hidden">
              <img 
                src="/assets/fullwhiteboard.png" 
                alt="FusionBoard Interface" 
                className="w-full h-auto hover:scale-[1.02] transition-transform duration-700 shadow-inner"
              />
            </div>
          </div>
          
          {/* Scroll arrow */}
          <div className="mt-16 text-slate-300 animate-bounce-slow">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path d="M19 14l-7 7m0 0l-7-7m7 7V3" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5"></path>
            </svg>
          </div>
        </div>
      </header>

      {/* Tagline Section */}
      <section className="py-32 px-6 bg-white overflow-hidden" id="tagline">
        <div className="max-w-4xl mx-auto text-center space-y-6 reveal reveal-up">
          <h2 className="text-5xl md:text-6xl font-bold tracking-tight leading-tight text-[#1A1A2E]">
            Where teams think, build, and <br />
            <span className="text-[#F97316]">create — together.</span>
          </h2>
          <p className="text-xl leading-relaxed font-medium text-[#1A1A2E]/40 max-w-2xl mx-auto">
            FusionBoard is a real-time collaborative whiteboard with powerful tools for modern teams.
          </p>
        </div>
      </section>

      {/* Features Grid */}
      <section className="bg-[#F5F0E6] space-y-0 relative">
        
        {/* Follow Mode */}
        <div className="max-w-6xl mx-auto px-6 py-24 flex flex-col md:flex-row items-center gap-20 overflow-hidden">
          <div className="flex-1 relative reveal reveal-left feature-card">
            <img 
              src="/assets/follow.png" 
              alt="Follow Mode" 
              className="w-full rounded-xl shadow-2xl border border-white/50"
            />
            {/* Doodle */}
            <div className="absolute top-[-40px] right-[-20px] doodle-font text-[#1A1A2E] flex flex-col items-center">
               <svg className="w-16 h-16 transform -rotate-12 translate-y-4" fill="none" viewBox="0 0 100 100">
                  <path d="M10 80 Q 50 20 90 60" stroke="currentColor" strokeWidth="2" fill="none" />
                  <path d="M82 50 L 90 60 L 78 68" stroke="currentColor" strokeWidth="2" fill="none" />
               </svg>
               <span className="text-xl font-bold italic -rotate-12 translate-x-4 animate-pulse">Follow!</span>
            </div>
          </div>
          <div className="flex-1 space-y-4 max-w-md reveal reveal-right delay-200">
            <div className="text-[10px] font-bold uppercase tracking-widest text-[#F97316]">Collaboration</div>
            <h3 className="text-3xl font-bold">Follow Mode</h3>
            <p className="text-sm text-[#1A1A2E]/70 leading-relaxed font-medium">
              Jump into anyone's view instantly. Whether you're presenting or just catching up, see exactly what your colleagues see without moving a muscle. Perfect for smooth handovers and design reviews.
            </p>
          </div>
        </div>

        {/* Graph Editor */}
        <div className="max-w-6xl mx-auto px-6 py-24 flex flex-col md:flex-row-reverse items-center gap-20 overflow-hidden text-right md:text-left">
          <div className="flex-1 relative reveal reveal-right feature-card">
            <img 
              src="/assets/graph.png" 
              alt="Graph Editor" 
              className="w-full rounded-xl shadow-2xl border border-white/50"
            />
            {/* Doodle */}
            <div className="absolute bottom-[-30px] left-[-20px] doodle-font text-[#1A1A2E] flex flex-col items-center">
               <span className="text-xl font-bold italic rotate-12 -translate-y-4">Plot it!</span>
               <svg className="w-16 h-16 transform rotate-12 -translate-y-8" fill="none" viewBox="0 0 100 100">
                  <path d="M10 20 Q 20 80 80 50" stroke="currentColor" strokeWidth="2" fill="none" />
                  <path d="M68 45 L 80 50 L 75 62" stroke="currentColor" strokeWidth="2" fill="none" />
               </svg>
            </div>
          </div>
          <div className="flex-1 space-y-4 max-w-md reveal reveal-left delay-200">
            <div className="text-[10px] font-bold uppercase tracking-widest text-[#F97316]">Powerful Tools</div>
            <h3 className="text-3xl font-bold">Graph Editor</h3>
            <p className="text-sm text-[#1A1A2E]/70 leading-relaxed font-medium">
              Visualize any math function right on your board. From simple parabolas to complex data sets, our built-in graphing engine turns abstract equations into shared understanding.
            </p>
          </div>
        </div>

        {/* Voice Chat */}
        <div className="max-w-6xl mx-auto px-6 py-24 flex flex-col md:flex-row items-center gap-20 overflow-hidden">
          <div className="flex-1 relative reveal reveal-left feature-card">
            <img 
              src="/assets/voice.png" 
              alt="Voice Chat" 
              className="w-full rounded-xl shadow-2xl border border-white/50"
            />
            {/* Doodle */}
            <div className="absolute top-[-60px] left-1/2 -translate-x-1/2 doodle-font text-[#1A1A2E] flex flex-col items-center">
               <svg className="w-12 h-12 mb-1 animate-bounce" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
                  <path d="M19 10v2a7 7 0 0 1-14 0v-2M12 19v4M8 23h8"/>
               </svg>
               <span className="text-xl font-bold italic">Talk live!</span>
            </div>
          </div>
          <div className="flex-1 space-y-4 max-w-md reveal reveal-right delay-200">
            <div className="text-[10px] font-bold uppercase tracking-widest text-[#F97316]">Communication</div>
            <h3 className="text-3xl font-bold">Voice Chat</h3>
            <p className="text-sm text-[#1A1A2E]/70 leading-relaxed font-medium">
              Built-in voice chat keeps your team in sync without switching tabs. High-fidelity audio and crystal-clear noise reduction mean you spend less time repeating yourself and more time building.
            </p>
          </div>
        </div>

        {/* Code Editor */}
        <div className="max-w-6xl mx-auto px-6 py-24 flex flex-col md:flex-row-reverse items-center gap-20 overflow-hidden">
          <div className="flex-1 relative reveal reveal-right feature-card">
            <img 
              src="/assets/code.png" 
              alt="Code Editor" 
              className="w-full rounded-xl shadow-2xl border border-white/50"
            />
            {/* Doodle */}
            <div className="absolute bottom-[-40px] right-[-20px] doodle-font text-[#1A1A2E] flex flex-col items-center">
               <span className="text-xl font-bold italic -rotate-12 translate-y-2">Run it! ⚡</span>
               <svg className="w-16 h-16 transform -rotate-12 -translate-y-4" fill="none" viewBox="0 0 100 100">
                  <path d="M10 20 Q 50 80 90 20" stroke="currentColor" strokeWidth="2" fill="none" />
                  <path d="M78 25 L 90 20 L 85 32" stroke="currentColor" strokeWidth="2" fill="none" />
               </svg>
            </div>
          </div>
          <div className="flex-1 space-y-4 max-w-md reveal reveal-left delay-200">
            <div className="text-[10px] font-bold uppercase tracking-widest text-[#F97316]">Development</div>
            <h3 className="text-3xl font-bold">Code Editor</h3>
            <p className="text-sm text-[#1A1A2E]/70 leading-relaxed font-medium">
              Write and run code directly on your whiteboard. Perfect for technical interviews, architectural planning and pair programming. Supports multiple languages with live output.
            </p>
          </div>
        </div>

        {/* Screen Record */}
        <div className="max-w-6xl mx-auto px-6 py-24 flex flex-col md:flex-row items-center gap-20 pb-40 overflow-hidden">
          <div className="flex-1 relative reveal reveal-left feature-card">
            <img 
              src="/assets/record.png" 
              alt="Screen Record" 
              className="w-full rounded-xl shadow-2xl border border-white/50"
            />
            {/* Doodle */}
            <div className="absolute top-[-50px] right-[20px] doodle-font text-[#1A1A2E] flex flex-col items-center -rotate-6">
               <span className="text-lg font-bold italic text-center leading-tight">Don't miss a <br/>thing!</span>
               <svg className="w-12 h-12" fill="none" viewBox="0 0 100 100">
                  <path d="M50 0 Q 50 50 10 50" stroke="currentColor" strokeWidth="2" fill="none" />
                  <path d="M18 42 L 10 50 L 18 58" stroke="currentColor" strokeWidth="2" fill="none" />
               </svg>
            </div>
          </div>
          <div className="flex-1 space-y-4 max-w-md reveal reveal-right delay-200">
            <div className="text-[10px] font-bold uppercase tracking-widest text-[#F97316]">Documentation</div>
            <h3 className="text-3xl font-bold">Screen Record</h3>
            <p className="text-sm text-[#1A1A2E]/70 leading-relaxed font-medium">
              Capture your workflow as it happens. Record your whiteboard sessions with one click to share with the team later.
            </p>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-32 bg-[#1A1A2E] text-white text-center overflow-hidden">
        <div className="max-w-3xl mx-auto px-6 space-y-8 reveal reveal-up">
          <h2 className="text-4xl md:text-5xl font-bold tracking-tight">Ready to build something <br/>great?</h2>
          <p className="text-lg text-slate-400 font-medium">Start collaborating with your team in seconds. Free for small teams, forever.</p>
          <div className="pt-4">
            <Link to="/register" className="inline-block px-10 py-4 bg-[#F97316] text-white font-bold rounded-xl hover:bg-orange-600 transition-all shadow-xl active:scale-95 text-sm uppercase tracking-wider transform hover:scale-110 duration-300">
              Get Started
            </Link>
          </div>
        </div>
      </section>

      {/* Footer (Simplified for brevity, but has elements like the design) */}
      <footer className="py-20 bg-[#1A1A2E] text-white border-t border-white/5">
        <div className="max-w-7xl mx-auto px-6 grid grid-cols-2 md:grid-cols-4 gap-12 text-sm">
          <div className="col-span-2 md:col-span-1 space-y-6 reveal reveal-up">
            <div className="text-2xl font-bold">FusionBoard</div>
            <p className="text-slate-400 leading-relaxed max-w-[200px]">
              The ultimate workspace for creative minds and modern engineering teams to ship faster and better.
            </p>
          </div>
          <div className="space-y-4 reveal reveal-up delay-100">
            <div className="font-bold text-slate-500 uppercase tracking-widest text-[10px]">Product</div>
            <ul className="space-y-2 text-slate-400">
              <li><a href="#" className="hover:text-white transition-colors">Features</a></li>
              <li><a href="#" className="hover:text-white transition-colors">Integrations</a></li>
              <li><a href="#" className="hover:text-white transition-colors">Pricing</a></li>
              <li><a href="#" className="hover:text-white transition-colors">Changelog</a></li>
            </ul>
          </div>
          <div className="space-y-4 reveal reveal-up delay-200">
            <div className="font-bold text-slate-500 uppercase tracking-widest text-[10px]">Resources</div>
            <ul className="space-y-2 text-slate-400">
              <li><a href="#" className="hover:text-white transition-colors">Documentation</a></li>
              <li><a href="#" className="hover:text-white transition-colors">Help Center</a></li>
              <li><a href="#" className="hover:text-white transition-colors">API Reference</a></li>
              <li><a href="#" className="hover:text-white transition-colors">Blog</a></li>
            </ul>
          </div>
          <div className="space-y-4 reveal reveal-up delay-300">
            <div className="font-bold text-slate-500 uppercase tracking-widest text-[10px]">Company</div>
            <ul className="space-y-2 text-slate-400">
              <li><a href="#" className="hover:text-white transition-colors">About Us</a></li>
              <li><a href="#" className="hover:text-white transition-colors">Careers</a></li>
              <li><a href="#" className="hover:text-white transition-colors">Privacy Policy</a></li>
              <li><a href="#" className="hover:text-white transition-colors">Terms of Service</a></li>
            </ul>
          </div>
        </div>
        
        <div className="max-w-7xl mx-auto px-6 mt-32 pt-8 border-t border-white/5 flex flex-col md:flex-row justify-between items-center gap-6 text-[10px] text-slate-500 uppercase tracking-widest font-bold">
          <div>© 2026 FusionBoard Inc. All rights reserved.</div>
          <div className="flex space-x-8">
            <Link to="/login" className="hover:text-white transition-colors">Sign In</Link>
            <Link to="/register" className="hover:text-white transition-colors">Register</Link>
            <a href="#" className="hover:text-white transition-colors">Status</a>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
