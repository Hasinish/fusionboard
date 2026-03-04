import { useMemo, useRef, useState, useEffect } from "react";
import { io } from "socket.io-client";
import { Mic, MicOff, Phone, PhoneOff, Users } from "lucide-react";
import { getUser } from "../lib/auth";
import { API_URL } from "../lib/api";

// grab the right url for the signaling server
const SIGNAL_URL = API_URL.replace("/api", "");

// setup the peer-to-peer connection settings
const RTC_CONFIG = {
  iceServers: [
    // 1. basic connection helper
    { urls: "stun:stun.l.google.com:19302" },

    // 2. heavy duty connection helpers for strict firewalls
    {
      urls: "turn:global.turn.metered.ca:80",
      username: "b5933385af82516fbc3ecd1d",
      credential: "CcalWZ0DmKgr2cbF",
    },
    {
      urls: "turn:global.turn.metered.ca:443",
      username: "b5933385af82516fbc3ecd1d",
      credential: "CcalWZ0DmKgr2cbF",
    },
    {
      urls: "turn:global.turn.metered.ca:443?transport=tcp",
      username: "b5933385af82516fbc3ecd1d",
      credential: "CcalWZ0DmKgr2cbF",
    }
  ],
};

export default function VoiceChat({ roomId }) {
  const me = getUser();
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState("");
  const [isMuted, setIsMuted] = useState(false);
  const [participants, setParticipants] = useState([]);
  const [isExpanded, setIsExpanded] = useState(false);

  const socket = useRef(null);
  const localStream = useRef(null);
  const pcs = useRef(new Map());
  const pendingIce = useRef(new Map());
  const makingOffer = useRef(new Map());

  const token = useMemo(() => {
    return localStorage.getItem("token");
  }, []);

  // --- the scary peer-to-peer stuff ---
  const ensurePendingIceList = (peerId) => {
    if (!pendingIce.current.has(peerId)) pendingIce.current.set(peerId, []);
    return pendingIce.current.get(peerId);
  };

  const setMakingOffer = (peerId, v) => makingOffer.current.set(peerId, v);
  const getMakingOffer = (peerId) => makingOffer.current.get(peerId) === true;

  const cleanupPeer = (peerId) => {
    const pc = pcs.current.get(peerId);
    if (pc) {
      try {
        pc.onicecandidate = null;
        pc.ontrack = null;
        pc.close();
      } catch (e) { /* ignore */ }
      pcs.current.delete(peerId);
    }
    pendingIce.current.delete(peerId);
    makingOffer.current.delete(peerId);

    const audioEl = document.getElementById(`audio-${peerId}`);
    if (audioEl) audioEl.remove();
  };

  const createPeerConnection = (peerId) => {
    try {
      const pc = new RTCPeerConnection(RTC_CONFIG);

      const stream = localStream.current;
      if (stream) {
        for (const track of stream.getTracks()) pc.addTrack(track, stream);
      }

      pc.ontrack = (event) => {
        const [remoteStream] = event.streams;
        if (!remoteStream) return;

        const elId = `audio-${peerId}`;
        let audioEl = document.getElementById(elId);
        if (!audioEl) {
          audioEl = document.createElement("audio");
          audioEl.id = elId;
          audioEl.autoplay = true;
          audioEl.playsInline = true;
          document.getElementById("voice-audio-container")?.appendChild(audioEl);
        }
        audioEl.srcObject = remoteStream;
        audioEl.play().catch((e) => console.error("Autoplay blocked", e));
      };

      pc.onicecandidate = (event) => {
        if (event.candidate && socket.current) {
          socket.current.emit("voice:signal", {
            to: peerId,
            data: { type: "ice", candidate: event.candidate },
          });
        }
      };

      pc.onconnectionstatechange = () => {
        const st = pc.connectionState;
        if (st === "failed" || st === "disconnected" || st === "closed") {
          cleanupPeer(peerId);
        }
      };

      pcs.current.set(peerId, pc);
      return pc;
    } catch (e) {
      console.error("RTC Create Error", e);
      return null;
    }
  };

  const ensurePC = (peerId) => pcs.current.get(peerId) || createPeerConnection(peerId);

  const flushPendingIce = async (peerId) => {
    const pc = pcs.current.get(peerId);
    if (!pc || !pc.remoteDescription) return;
    const list = pendingIce.current.get(peerId);
    if (!list || list.length === 0) return;
    while (list.length) {
      const cand = list.shift();
      try {
        await pc.addIceCandidate(cand);
      } catch (e) { /* ignore */ }
    }
  };

  const iShouldOffer = (peerId) => {
    const myId = socket.current?.id;
    if (!myId) return false;
    return myId < peerId;
  };

  const makeOfferTo = async (peerId) => {
    const pc = ensurePC(peerId);
    if (!pc || !iShouldOffer(peerId)) return;
    if (pc.signalingState !== "stable") return;

    try {
      setMakingOffer(peerId, true);
      const offer = await pc.createOffer({ offerToReceiveAudio: true, offerToReceiveVideo: false });
      await pc.setLocalDescription(offer);
      socket.current.emit("voice:signal", {
        to: peerId,
        data: { type: "offer", sdp: pc.localDescription },
      });
    } finally {
      setMakingOffer(peerId, false);
    }
  };

  const joinRoom = async () => {
    setError("");
    if (!token) return;

    setStatus("connecting");
    try {
      localStream.current = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
        video: false,
      });

      socket.current = io(SIGNAL_URL, {
        auth: { token },
        transports: ["websocket"],
      });

      socket.current.on("connect_error", (e) => {
        setStatus("error");
        setError(e?.message || "Connection failed");
      });

      socket.current.on("connect", () => {
        socket.current.emit("voice:join", { roomId });
      });

      socket.current.on("voice:participants:update", async ({ participants }) => {
        const list = Array.isArray(participants) ? participants : [];
        setParticipants(list);

        const myId = socket.current?.id;
        const others = myId ? list.filter((p) => p.peerId !== myId) : list;

        for (const p of others) ensurePC(p.peerId);

        setStatus("connected");
        setIsExpanded(true);

        for (const p of others) {
          await makeOfferTo(p.peerId);
        }
      });

      socket.current.on("voice:peer-left", ({ peerId }) => cleanupPeer(peerId));

      socket.current.on("voice:signal", async ({ from, data }) => {
        const pc = ensurePC(from);
        if (!pc) return;

        try {
          if (data?.type === "offer") {
            if (getMakingOffer(from) && iShouldOffer(from)) return;
            await pc.setRemoteDescription(data.sdp);
            await flushPendingIce(from);
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            socket.current.emit("voice:signal", {
              to: from,
              data: { type: "answer", sdp: pc.localDescription },
            });
          } else if (data?.type === "answer") {
            await pc.setRemoteDescription(data.sdp);
            await flushPendingIce(from);
          } else if (data?.type === "ice" && data?.candidate) {
            if (!pc.remoteDescription) ensurePendingIceList(from).push(data.candidate);
            else await pc.addIceCandidate(data.candidate);
          }
        } catch (e) { /* ignore */ }
      });
    } catch (e) {
      setStatus("error");
      setError(e?.message || "Check mic permission.");
    }
  };

  const leaveRoom = () => {
    try {
      if (socket.current) {
        socket.current.emit("voice:leave", { roomId });
        socket.current.disconnect();
      }
    } catch (e) { /* ignore */ }
    socket.current = null;

    for (const [peerId, pc] of pcs.current.entries()) {
      try {
        pc.close();
      } catch (e) { /* ignore */ }
      pcs.current.delete(peerId);
      const audioEl = document.getElementById(`audio-${peerId}`);
      if (audioEl) audioEl.remove();
    }

    pendingIce.current.clear();
    makingOffer.current.clear();

    if (localStream.current) {
      for (const t of localStream.current.getTracks()) t.stop();
      localStream.current = null;
    }

    setParticipants([]);
    setIsMuted(false);
    setStatus("idle");
  };

  const toggleMute = () => {
    const stream = localStream.current;
    if (!stream) return;
    const track = stream.getAudioTracks()[0];
    if (!track) return;

    const next = !isMuted;
    track.enabled = !next;
    setIsMuted(next);
    if (socket.current) {
      socket.current.emit("voice:mute-change", { roomId, isMuted: next });
    }
  };

  useEffect(() => {
    return () => leaveRoom();
  }, []);

  if (status === "idle" || status === "error") {
    return (
      <div className="fixed bottom-4 right-4 z-50">
        {error && (
          <div className="absolute bottom-12 right-0 alert alert-error text-xs w-48 shadow-lg mb-2">
            <span>{error}</span>
          </div>
        )}
        <button
          className="btn btn-circle btn-primary shadow-xl"
          onClick={joinRoom}
          title="Join Voice Chat"
        >
          <Phone size={24} />
        </button>
      </div>
    );
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col items-end gap-2">
      <div id="voice-audio-container" className="hidden" />

      {isExpanded && (
        <div className="card bg-base-100 shadow-xl border border-base-300 w-64 mb-2">
          <div className="card-body p-3">
            <div className="flex justify-between items-center border-b border-base-200 pb-2 mb-2">
              <h3 className="font-bold text-sm flex items-center gap-2">
                <Users size={16} /> Participants ({participants.length})
              </h3>
              <button className="btn btn-xs btn-ghost" onClick={() => setIsExpanded(false)}>Hide</button>
            </div>
            <ul className="max-h-40 overflow-y-auto space-y-2">
              {participants.map(p => (
                <li key={p.peerId} className="text-xs flex items-center gap-2">
                  {p.isMuted ? (
                    <MicOff size={14} className="text-error" />
                  ) : (
                    <Mic size={14} className="text-success" />
                  )}
                  <span className="truncate max-w-[150px]">
                    {p.name} {p.peerId === socket.current?.id ? "(You)" : ""}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      <div className="flex items-center gap-2 bg-base-100 p-2 rounded-full shadow-xl border border-base-200">
        <button
          className="btn btn-circle btn-sm btn-ghost"
          onClick={() => setIsExpanded(!isExpanded)}
          title="Toggle List"
        >
          <Users size={18} />
        </button>

        <button
          className={`btn btn-circle btn-sm ${isMuted ? 'btn-warning' : 'btn-ghost'}`}
          onClick={toggleMute}
          title={isMuted ? "Unmute" : "Mute"}
        >
          {isMuted ? <MicOff size={18} /> : <Mic size={18} />}
        </button>

        <button
          className="btn btn-circle btn-sm btn-error text-white"
          onClick={leaveRoom}
          title="Leave Call"
        >
          <PhoneOff size={18} />
        </button>
      </div>
    </div>
  );
}