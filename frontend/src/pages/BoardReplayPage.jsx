import { useEffect, useState, useCallback } from "react";
import { useParams } from "react-router-dom";
import { Loader2, AlertCircle } from "lucide-react";
import api, { API_URL } from "../lib/api";

import ReplayShell from "../components/replay/ReplayShell";
import ReplayCanvasView from "../components/replay/ReplayCanvasView";
import ReplayControls from "../components/replay/ReplayControls";

import useReplayClock from "../hooks/useReplayClock";
import useReplayAudio from "../hooks/useReplayAudio";
import useBoardReplay from "../hooks/useBoardReplay";

export default function BoardReplayPage() {
  const { recordingId } = useParams();
  
  const [recording, setRecording] = useState(null);
  const [events, setEvents] = useState([]);
  const [checkpoints] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isDark, setIsDark] = useState(false); // Default to Light Mode

  useEffect(() => {
    async function fetchData() {
      const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
      try {
        const [resRec, resEvents] = await Promise.all([
          api.get(`/recordings/${recordingId}`, {
            headers: { Authorization: `Bearer ${token}` }
          }),
          api.get(`/recordings/${recordingId}/events`, {
            headers: { Authorization: `Bearer ${token}` }
          })
        ]);
        
        setRecording(resRec.data);
        setEvents(resEvents.data);
        
        // Resolve initial theme
        if (resRec.data.initialSnapshot?.isDark !== undefined) {
          setIsDark(resRec.data.initialSnapshot.isDark);
        } else {
          setIsDark(false); // Force Light Mode default
        }
        
        setIsLoading(false);
      } catch (err) {
        console.error("Failed to fetch recording data", err);
        setError("Recording session not found or failed to load. Please try again later.");
        setIsLoading(false);
      }
    }
    fetchData();
  }, [recordingId]);

  const {
    currentTime,
    isPlaying,
    playbackRate,
    setPlaybackRate,
    togglePlay,
    seek
  } = useReplayClock({ 
    duration: recording?.durationMs || 0 
  });

  const audioUrl = recording?.audioUrl ? `${API_URL.replace("/api", "")}${recording.audioUrl}` : null;
  useReplayAudio({ 
    audioUrl, 
    currentTime, 
    isPlaying, 
    playbackRate 
  });

  const handleThemeChange = useCallback((val) => {
    setIsDark(val);
  }, []);

  const { elements, camera, cursors, liveStrokes, bgMode } = useBoardReplay({
    events,
    initialSnapshot: recording?.initialSnapshot,
    checkpoints,
    currentTime,
    onThemeChange: handleThemeChange
  });

  if (isLoading) {
    return (
      <div className="w-screen h-screen flex flex-col items-center justify-center bg-[#181818] gap-6">
        <Loader2 className="w-16 h-16 animate-spin text-blue-500" />
        <div className="text-center">
          <p className="text-white text-xl font-black uppercase tracking-widest">Reconstructing Board</p>
          <p className="text-white/40 text-xs font-bold uppercase tracking-widest mt-1">Processing chronological events...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-screen h-screen flex flex-col items-center justify-center bg-[#181818] px-6 text-center">
        <AlertCircle className="w-20 h-20 text-red-500 mb-6" />
        <h1 className="text-3xl font-black text-white uppercase tracking-tighter mb-2">Oops! Replay Failed</h1>
        <p className="text-white/60 font-medium max-w-md mb-8">{error}</p>
        <button 
          onClick={() => window.history.back()} 
          className="px-10 py-4 bg-white text-black font-black uppercase tracking-widest rounded-full hover:scale-105 active:scale-95 transition-all shadow-2xl"
        >
          Go Back
        </button>
      </div>
    );
  }

  return (
    <ReplayShell
      title={recording.title}
      date={new Date(recording.createdAt).toLocaleDateString(undefined, { dateStyle: 'long' })}
      duration={recording.durationMs ? (recording.durationMs / 1000).toFixed(1) + "s" : "0s"}
      isDark={isDark}
      controls={
        <ReplayControls 
          currentTime={currentTime}
          duration={recording.durationMs || 0}
          isPlaying={isPlaying}
          playbackRate={playbackRate}
          onTogglePlay={togglePlay}
          onSeek={seek}
          onRateChange={setPlaybackRate}
          isDark={isDark}
        />
      }
    >
      <ReplayCanvasView
        elements={elements}
        camera={camera}
        cursors={cursors}
        liveStrokes={liveStrokes}
        isDark={isDark}
        bgMode={bgMode}
      />
    </ReplayShell>
  );
}
