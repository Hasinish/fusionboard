import { useState, useEffect, useRef, useCallback } from "react";

/**
 * useReplayClock
 * Manages the timeline for replay.
 */
export default function useReplayClock({ duration = 0, onSeek }) {
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  
  const lastTickRef = useRef(null);
  const rafRef = useRef(null);

  const tick = useCallback(() => {
    if (!isPlaying) return;

    const now = performance.now();
    if (lastTickRef.current === null) {
      lastTickRef.current = now;
      rafRef.current = requestAnimationFrame(tick);
      return;
    }

    const delta = (now - lastTickRef.current) * playbackRate;
    lastTickRef.current = now;

    setCurrentTime(prev => {
      const next = prev + delta;
      if (next >= duration) {
        setIsPlaying(false);
        return duration;
      }
      return next;
    });

    rafRef.current = requestAnimationFrame(tick);
  }, [isPlaying, playbackRate, duration]);

  useEffect(() => {
    if (isPlaying) {
      lastTickRef.current = performance.now();
      rafRef.current = requestAnimationFrame(tick);
    } else {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      lastTickRef.current = null;
    }
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [isPlaying, tick]);

  const play = () => setIsPlaying(true);
  const pause = () => setIsPlaying(false);
  const togglePlay = () => setIsPlaying(p => !p);

  const seek = (time) => {
    const clamped = Math.max(0, Math.min(time, duration));
    setCurrentTime(clamped);
    if (onSeek) onSeek(clamped);
  };

  return {
    currentTime,
    isPlaying,
    playbackRate,
    setPlaybackRate,
    play,
    pause,
    togglePlay,
    seek
  };
}
