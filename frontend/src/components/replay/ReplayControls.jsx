import React from "react";
import { Play, Pause, RotateCcw, FastForward, Rewind, Settings } from "lucide-react";

export default function ReplayControls({ 
  currentTime, 
  duration, 
  isPlaying, 
  playbackRate,
  onTogglePlay, 
  onSeek, 
  onRateChange,
  isDark
}) {
  const formatTime = (ms) => {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  };

  const progress = (currentTime / duration) * 100;

  return (
    <div className={`flex flex-col w-full max-w-4xl ${isDark ? "bg-slate-900" : "bg-white"} border-2 ${isDark ? "border-white/20" : "border-black/15"} rounded-2xl shadow-[0_25px_60px_rgba(0,0,0,0.6)] p-5 gap-4 pointer-events-auto overflow-hidden`}>
      {/* Timeline with Draggable Slider */}
      <div className="relative w-full h-2 flex items-center group">
        <input 
          type="range"
          min="0"
          max={duration || 0}
          value={currentTime || 0}
          onChange={(e) => onSeek(Number(e.target.value))}
          className="w-full h-1.5 bg-white/20 rounded-full appearance-none cursor-pointer accent-blue-600 focus:outline-none"
          style={{
            backgroundImage: `linear-gradient(to right, #2563eb ${progress}%, rgba(255,255,255,0.2) ${progress}%)`
          }}
        />
        <style jsx>{`
          input[type='range']::-webkit-slider-thumb {
            appearance: none;
            width: 16px;
            height: 16px;
            background: white;
            border-radius: 50%;
            box-shadow: 0 0 10px rgba(0,0,0,0.5);
            transition: transform 0.1s ease;
          }
          input[type='range']:active::-webkit-slider-thumb {
            transform: scale(1.3);
          }
        `}</style>
      </div>

      <div className="flex items-center justify-between gap-6">
        {/* Left: Time Display */}
        <div className="flex items-center gap-2 min-w-[120px]">
          <span className={`${isDark ? "text-white" : "text-black"} font-mono text-sm font-black tabular-nums`}>
            {formatTime(currentTime)}
          </span>
          <span className={`${isDark ? "text-white/40" : "text-black/40"} text-sm font-bold`}>/</span>
          <span className={`${isDark ? "text-white/60" : "text-black/60"} font-mono text-sm font-bold tabular-nums`}>
            {formatTime(duration)}
          </span>
        </div>

        {/* Center: Playback Controls */}
        <div className="flex items-center gap-8">
          <button 
            onClick={() => onSeek(currentTime - 10000)}
            className={`${isDark ? "text-white/70 hover:text-white" : "text-black/70 hover:text-black"} transition-all active:scale-90`}
            title="Rewind 10s"
          >
            <Rewind size={22} fill="currentColor" />
          </button>
          
          <button 
            onClick={onTogglePlay}
            className={`w-14 h-14 flex items-center justify-center ${isDark ? "bg-white text-black" : "bg-black text-white"} rounded-full hover:scale-110 active:scale-90 transition-all shadow-2xl`}
            title={isPlaying ? "Pause" : "Play"}
          >
            {isPlaying ? <Pause size={28} fill="currentColor" /> : <Play size={28} fill="currentColor" className="ml-1" />}
          </button>

          <button 
             onClick={() => onSeek(currentTime + 10000)}
            className={`${isDark ? "text-white/70 hover:text-white" : "text-black/70 hover:text-black"} transition-all active:scale-90`}
            title="Fast Forward 10s"
          >
            <FastForward size={22} fill="currentColor" />
          </button>
        </div>

        {/* Right: Speed & Settings */}
        <div className="flex items-center gap-4 min-w-[120px] justify-end">
          <div className="dropdown dropdown-top dropdown-end">
            <button tabIndex={0} className={`${isDark ? "text-white bg-white/10 border-white/20 hover:bg-white/20" : "text-black bg-black/5 border-black/10 hover:bg-black/10"} text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-lg border transition-all`}>
              {playbackRate}x
            </button>
            <ul tabIndex={0} className={`dropdown-content z-[1] menu p-2 shadow-2xl ${isDark ? "bg-[#1f2937] border-white/10" : "bg-white border-black/10"} rounded-xl w-20 mb-3 border`}>
              {[0.5, 1, 1.5, 2, 4].map(rate => (
                <li key={rate}>
                  <button 
                    className={`text-xs font-bold ${playbackRate === rate ? "bg-blue-600 text-white" : (isDark ? "text-white/70 hover:bg-white/10" : "text-black/70 hover:bg-black/5")}`}
                    onClick={() => onRateChange(rate)}
                  >
                    {rate}x
                  </button>
                </li>
              ))}
            </ul>
          </div>
          <button className={`${isDark ? "text-white/70 hover:text-white" : "text-black/70 hover:text-black"} transition-all active:rotate-45`}>
            <Settings size={22} />
          </button>
        </div>
      </div>
    </div>
  );
}
