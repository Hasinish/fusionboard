import { applyReplayEvent } from "./applyReplayEvent";

/**
 * buildReplayStateAtTime.js
 * Reconstructs the whiteboard state at a specific timestamp.
 */
export function buildReplayStateAtTime({ 
  currentTime, 
  initialSnapshot, 
  events, 
  checkpoints = [] 
}) {
  // 1. Initialize from snapshot
  let state = {
    elements: JSON.parse(JSON.stringify(initialSnapshot?.elements || [])),
    camera: initialSnapshot?.camera || { x: 0, y: 0, z: 1 },
    isDark: initialSnapshot?.isDark !== undefined ? initialSnapshot.isDark : false,
    bgMode: initialSnapshot?.bgMode || "dots",
    cursors: {}
  };

  // 2. Find the best starting point (checkpoint)
  const sortedCheckpoints = [...checkpoints].sort((a, b) => b.timestampMs - a.timestampMs);
  const bestCheckpoint = sortedCheckpoints.find(c => c.timestampMs <= currentTime);

  let eventStartIndex = 0;
  if (bestCheckpoint) {
    state = {
      elements: JSON.parse(JSON.stringify(bestCheckpoint.elementsSnapshot)),
      camera: bestCheckpoint.cameraSnapshot || bestCheckpoint.camera || state.camera,
      isDark: bestCheckpoint.isDark !== undefined ? bestCheckpoint.isDark : state.isDark,
      bgMode: bestCheckpoint.bgMode !== undefined ? bestCheckpoint.bgMode : state.bgMode,
      cursors: {}
    };
    // Optimization: find where to start applying events
    eventStartIndex = events.findIndex(e => e.timestampMs > bestCheckpoint.timestampMs);
    if (eventStartIndex === -1) eventStartIndex = events.length;
  }

  // 3. Apply events up to currentTime
  const sortedEvents = [...events].sort((a, b) => a.timestampMs - b.timestampMs || a.seq - b.seq);
  
  for (let i = eventStartIndex; i < sortedEvents.length; i++) {
    const event = sortedEvents[i];
    if (event.timestampMs > currentTime) break;
    state = applyReplayEvent(state, event);
  }

  return state;
}
