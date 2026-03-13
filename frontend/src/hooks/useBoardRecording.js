import { useState, useEffect, useRef, useCallback } from "react";
import api from "../lib/api";

/**
 * useBoardRecording
 * Manages the whiteboard recording lifecycle: audio + semantic events.
 * USES REFS for elements and camera to avoid excessive re-renders during recording.
 */
export default function useBoardRecording({ boardId, workspaceId, elements, camera, userId, isDark, bgMode }) {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingStatus, setRecordingStatus] = useState("idle"); // idle, recording, saving
  const [recordingSession, setRecordingSession] = useState(null);
  const [duration, setDuration] = useState(0);

  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const eventQueueRef = useRef([]);
  const startTimeRef = useRef(null);
  const seqRef = useRef(0);
  const timerRef = useRef(null);
  const sessionRef = useRef(null);

  // Keep refs up to date for capturing latest state without re-triggering effects
  const elementsRef = useRef(elements);
  const cameraRef = useRef(camera);
  const isDarkRef = useRef(isDark);
  const bgModeRef = useRef(bgMode);

  const flushEvents = useCallback(async (sessionId) => {
    if (!sessionId || eventQueueRef.current.length === 0) return;

    const events = [...eventQueueRef.current];
    eventQueueRef.current = [];
    const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;

    try {
      await api.post(`/recordings/${sessionId}/events`, { events }, {
        headers: { Authorization: `Bearer ${token}` }
      });
    } catch (error) {
      console.error("Failed to flush recording events", error);
      // Put back in queue to try again
      eventQueueRef.current = [...events, ...eventQueueRef.current];
    }
  }, []);

  const recordEvent = useCallback((type, targetElementId, payload) => {
    // Check ref instead of state to avoid dependency on isRecording
    if (!startTimeRef.current) return;

    const timestampMs = Date.now() - startTimeRef.current;
    const event = {
      type,
      targetElementId,
      payload,
      timestampMs,
      seq: seqRef.current++,
      actorUserId: userId,
    };

    eventQueueRef.current.push(event);

    if (eventQueueRef.current.length >= 20) {
      flushEvents(sessionRef.current?._id || sessionRef.current?.id);
    }
  }, [userId, flushEvents]);

  useEffect(() => { elementsRef.current = elements; }, [elements]);
  useEffect(() => { cameraRef.current = camera; }, [camera]);
  
  useEffect(() => { 
    if (isRecording && isDark !== isDarkRef.current) {
      recordEvent("theme.changed", null, { isDark });
    }
    isDarkRef.current = isDark; 
  }, [isDark, isRecording, recordEvent]);

  useEffect(() => {
    if (isRecording && bgMode !== bgModeRef.current) {
      recordEvent("bgMode.changed", null, { bgMode });
    }
    bgModeRef.current = bgMode;
  }, [bgMode, isRecording, recordEvent]);

  // Record camera movement with throttling
  const lastCameraEmitRef = useRef(0);
  useEffect(() => {
    if (!isRecording) {
      cameraRef.current = camera;
      return;
    }

    const now = Date.now();
    // Emit at most every 100ms
    if (now - lastCameraEmitRef.current > 100) {
      recordEvent("camera.moved", null, { camera });
      lastCameraEmitRef.current = now;
      cameraRef.current = camera;
    }
  }, [camera, isRecording, recordEvent]);

  const startRecording = useCallback(async (title) => {
    const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
    let session = null;
    try {
      // 1. Create session first - use RENDER state for initial snapshot
      const initialSnapshot = {
        elements: JSON.parse(JSON.stringify(elementsRef.current)),
        camera: { ...cameraRef.current },
        isDark: isDarkRef.current,
        bgMode: bgModeRef.current || "dots",
      };

      const res = await api.post(`/recordings`, {
        boardId,
        workspaceId,
        title,
        initialSnapshot
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      session = res.data;
      sessionRef.current = session;
      setRecordingSession(session);
    } catch (error) {
      console.error("Failed to create recording session:", error);
      alert("Failed to reach server. Please check your connection.");
      return;
    }

    try {
      // 2. Access microphone
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        setRecordingStatus("saving");
        const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        const formData = new FormData();
        formData.append("audio", audioBlob, "recording.webm");

        try {
          await api.post(`/recordings/${session._id}/audio`, formData, {
            headers: { 
              "Content-Type": "multipart/form-data" ,
              "Authorization": `Bearer ${token}`
            }
          });
          setRecordingStatus("idle");
          setRecordingSession(null);
          sessionRef.current = null;
        } catch (error) {
          console.error("Failed to upload audio", error);
          setRecordingStatus("idle");
        }
      };

      mediaRecorder.start();
      startTimeRef.current = Date.now();
      seqRef.current = 0;
      setIsRecording(true);
      setRecordingStatus("recording");
      setDuration(0);

      timerRef.current = setInterval(() => {
        setDuration(Date.now() - startTimeRef.current);
      }, 1000);

      // recordEvent relies on startTimeRef.current being set
      recordEvent("recording.started", null, { title });

    } catch (error) {
      console.error("Failed to start audio recording:", error);
      alert("Microphone access is required for recording. Please allow access in your browser settings.");
      
      // Cleanup the session if mic failed
      if (session) {
         api.delete(`/recordings/${session._id}`, {
           headers: { Authorization: `Bearer ${token}` }
         }).catch(() => {});
         setRecordingSession(null);
         sessionRef.current = null;
      }
    }
  }, [boardId, workspaceId, recordEvent]);

  const stopRecording = useCallback(async () => {
    if (!startTimeRef.current) return;
    const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;

    recordEvent("recording.stopped", null, {});

    setIsRecording(false);
    clearInterval(timerRef.current);

    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
    }

    const sessionId = sessionRef.current?._id || sessionRef.current?.id;
    await flushEvents(sessionId);

    try {
      await api.post(`/recordings/${sessionId}/end`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
    } catch (error) {
      console.error("Failed to end recording session on backend", error);
    }
    
    if (checkpointTimerRef.current) {
      clearInterval(checkpointTimerRef.current);
      checkpointTimerRef.current = null;
    }

    // Final cleanup of refs
    startTimeRef.current = null;
  }, [recordEvent, flushEvents]);

  // Periodic Checkpoints
  const checkpointTimerRef = useRef(null);
  const handleCreateCheckpoint = useCallback(async () => {
    const sessionId = sessionRef.current?._id || sessionRef.current?.id;
    if (!sessionId || !startTimeRef.current) return;

    try {
      const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
      await api.post(`/recordings/${sessionId}/checkpoints`, {
        timestampMs: Date.now() - startTimeRef.current,
        elementsSnapshot: elementsRef.current,
        cameraSnapshot: cameraRef.current,
        isDark: isDarkRef.current,
        bgMode: bgModeRef.current
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      console.log("[Recording] Checkpoint created");
    } catch (err) {
      console.error("[Recording] Failed to create periodic checkpoint", err);
    }
  }, []);

  useEffect(() => {
    if (isRecording) {
      // Create a checkpoint every 30 seconds
      checkpointTimerRef.current = setInterval(handleCreateCheckpoint, 30000);
    } else {
      if (checkpointTimerRef.current) {
        clearInterval(checkpointTimerRef.current);
        checkpointTimerRef.current = null;
      }
    }
    return () => {
      if (checkpointTimerRef.current) clearInterval(checkpointTimerRef.current);
    };
  }, [isRecording, handleCreateCheckpoint]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  return {
    isRecording,
    recordingStatus,
    duration,
    startRecording,
    stopRecording,
    recordEvent
  };
}
