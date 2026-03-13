import { useEffect, useRef } from "react";

/**
 * useReplayAudio
 * Handles audio playback and sync with the replay clock.
 */
export default function useReplayAudio({ audioUrl, currentTime, isPlaying, playbackRate, onSync }) {
  const audioRef = useRef(null);

  useEffect(() => {
    if (!audioUrl) return;
    audioRef.current = new Audio(audioUrl);
    
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, [audioUrl]);

  useEffect(() => {
    if (!audioRef.current) return;
    audioRef.current.playbackRate = playbackRate;
  }, [playbackRate]);

  useEffect(() => {
    if (!audioRef.current) return;
    if (isPlaying) {
      // Sync before play
      if (Math.abs(audioRef.current.currentTime - (currentTime / 1000)) > 0.2) {
        audioRef.current.currentTime = currentTime / 1000;
      }
      audioRef.current.play().catch(e => console.error("Audio play failed", e));
    } else {
      audioRef.current.pause();
    }
  }, [isPlaying]);

  // Handle seeking
  useEffect(() => {
    if (!audioRef.current) return;
    // If not playing, or if drift is significant
    const audioTime = audioRef.current.currentTime * 1000;
    if (Math.abs(audioTime - currentTime) > 300) {
      audioRef.current.currentTime = currentTime / 1000;
    }
  }, [currentTime]);

  return audioRef;
}
