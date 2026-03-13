import { useState, useEffect, useRef, useMemo } from "react";
import { buildReplayStateAtTime } from "../lib/replay/buildReplayStateAtTime";

/**
 * useBoardReplay
 * Refactored to use modular library functions.
 */
export default function useBoardReplay({ 
  events = [], 
  initialSnapshot = null, 
  checkpoints = [], 
  currentTime = 0,
  onThemeChange 
}) {
  const [elements, setElements] = useState(initialSnapshot?.elements || []);
  const [camera, setCamera] = useState(initialSnapshot?.camera || { x: 0, y: 0, z: 1 });
  const [isDark, setIsDark] = useState(initialSnapshot?.isDark || false);
  const [bgMode, setBgMode] = useState(initialSnapshot?.bgMode || "dots");
  const [cursors, setCursors] = useState({});
  
  const lastProcessedTimeRef = useRef(-1);
  const elementsRef = useRef(initialSnapshot?.elements || []);
  const prevIsDarkRef = useRef(initialSnapshot?.isDark || false);

  useEffect(() => {
    // If we've jumped significant amount or gone backwards
    const isSeeking = currentTime < lastProcessedTimeRef.current || Math.abs(currentTime - lastProcessedTimeRef.current) > 1000;

    const newState = buildReplayStateAtTime({
      currentTime,
      initialSnapshot,
      events,
      checkpoints
    });

    setElements(newState.elements); // eslint-disable-line react-hooks/set-state-in-effect
    setCamera(newState.camera);
    setIsDark(newState.isDark);
    setBgMode(newState.bgMode || "dots");
    setCursors(newState.cursors || {});

    if (onThemeChange && newState.isDark !== prevIsDarkRef.current) {
      onThemeChange(newState.isDark);
      prevIsDarkRef.current = newState.isDark;
    }

    lastProcessedTimeRef.current = currentTime;
  }, [currentTime, events, initialSnapshot, checkpoints, onThemeChange]);

  return {
    elements,
    camera,
    isDark,
    bgMode,
    cursors
  };
}
