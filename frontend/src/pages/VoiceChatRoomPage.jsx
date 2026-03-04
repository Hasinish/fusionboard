import { useMemo, useRef, useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { io } from "socket.io-client";
import NavBar from "../components/NavBar";
import { getUser, isLoggedIn } from "../lib/auth";
import { API_URL } from "../lib/api";

const SIGNAL_URL = API_URL.replace("/api", "");

// connection settings for voice chat
const RTC_CONFIG = {
  iceServers: [
    // 1. fast connection helper
    { urls: "stun:stun.l.google.com:19302" },

    // 2. heavy duty connection helper
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

function VoiceChatRoomPage() {
  const { id: roomId } = useParams();
  const navigate = useNavigate();
  const me = getUser();

  const [status, setStatus] = useState("idle");
  const [error, setError] = useState("");
  const [isMuted, setIsMuted] = useState(false);
  const [participants, setParticipants] = useState([]);

  // keep track of who is connecting, failed, etc.
  const [peerStates, setPeerStates] = useState({});

  const socket = useRef(null);
  const localStream = useRef(null);
  const pcs = useRef(new Map());
  const pendingIce = useRef(new Map());
  const makingOffer = useRef(new Map());

  const token = useMemo(() => {
    if (typeof window === "undefined") return null;
    return localStorage.getItem("token");
  }, []);

  const updatePeerState = (peerId, state) => {
    setPeerStates(prev => ({ ...prev, [peerId]: state }));
  };

  const ensurePendingIceList = (peerId) => {
    if (!pendingIce.current.has(peerId)) pendingIce.current.set(peerId, []);
    return pendingIce.current.get(peerId);
  };

  const cleanupPeer = (peerId) => {
    const pc = pcs.current.get(peerId);
    if (pc) {
      pc.close();
      pcs.current.delete(peerId);
    }
    pendingIce.current.delete(peerId);
    makingOffer.current.delete(peerId);

    // get rid of their audio player
    const audioEl = document.getElementById(`audio-${peerId}`);
    if (audioEl) audioEl.remove();

    // clear them out of our state
    setPeerStates(prev => {
      const copy = { ...prev };
      delete copy[peerId];
      return copy;
    });
  };

  const createPeerConnection = (peerId) => {
    try {
      const pc = new RTCPeerConnection(RTC_CONFIG);
      updatePeerState(peerId, "connecting");

      // plug my mic into the connection
      const stream = localStream.current;
      if (stream) {
        for (const track of stream.getTracks()) pc.addTrack(track, stream);
      }

      // when the other person's audio comes through
      pc.ontrack = (event) => {
        console.log("Receiver track received from:", peerId);
        const [remoteStream] = event.streams;
        if (!remoteStream) return;

        const elId = `audio-${peerId}`;
        let audioEl = document.getElementById(elId);
        if (!audioEl) {
          audioEl = document.createElement("audio");
          audioEl.id = elId;
          audioEl.autoplay = true;
          audioEl.playsInline = true;
          audioEl.controls = true; // Show controls so you can verify it exists
          audioEl.className = "w-full mt-1 h-8";
          document.getElementById("remote-audio-container")?.appendChild(audioEl);
        }
        audioEl.srcObject = remoteStream;

        // make it play automatically
        audioEl.play().catch(err => {
          console.error("Autoplay failed:", err);
          setError("Click the play button on the audio controls to hear sound.");
        });
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
        console.log(`PC ${peerId} state:`, pc.connectionState);
        updatePeerState(peerId, pc.connectionState);
        if (pc.connectionState === "failed" || pc.connectionState === "closed") {
          cleanupPeer(peerId);
        }
      };

      pcs.current.set(peerId, pc);
      return pc;
    } catch (err) {
      console.error("Failed to create PeerConnection:", err);
      setError("RTC Config Error: " + err.message);
      return null;
    }
  };

  const ensurePC = (peerId) => pcs.current.get(peerId) || createPeerConnection(peerId);

  // ... (Standard WebRTC logic helpers remain same)
  const setMakingOffer = (peerId, v) => makingOffer.current.set(peerId, v);
  const getMakingOffer = (peerId) => makingOffer.current.get(peerId) === true;
  const iShouldOffer = (peerId) => (socket.current?.id || "") < peerId;

  const flushPendingIce = async (peerId) => {
    const pc = pcs.current.get(peerId);
    if (!pc || !pc.remoteDescription) return;
    const list = pendingIce.current.get(peerId);
    while (list && list.length) {
      const cand = list.shift();
      try { await pc.addIceCandidate(cand); } catch { }
    }
  };

  const makeOfferTo = async (peerId) => {
    const pc = ensurePC(peerId);
    if (!pc || !iShouldOffer(peerId)) return;
    if (pc.signalingState !== "stable") return;

    try {
      setMakingOffer(peerId, true);
      const offer = await pc.createOffer();
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
    if (!isLoggedIn() || !token) {
      navigate("/login");
      return;
    }
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

      socket.current.on("connect", () => {
        socket.current.emit("voice:join", { roomId });
      });

      socket.current.on("voice:participants:update", async ({ participants }) => {
        setParticipants(participants || []);
        const myId = socket.current?.id;
        if (!myId) return;

        const others = participants.filter((p) => p.peerId !== myId);
        for (const p of others) ensurePC(p.peerId);
        setStatus("connected");
        for (const p of others) await makeOfferTo(p.peerId);
      });

      socket.current.on("voice:peer-left", ({ peerId }) => cleanupPeer(peerId));

      socket.current.on("voice:signal", async ({ from, data }) => {
        const pc = ensurePC(from);
        if (!pc) return;

        try {
          if (data.type === "offer") {
            if (getMakingOffer(from) && iShouldOffer(from)) return;
            await pc.setRemoteDescription(data.sdp);
            await flushPendingIce(from);
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            socket.current.emit("voice:signal", { to: from, data: { type: "answer", sdp: pc.localDescription } });
          } else if (data.type === "answer") {
            await pc.setRemoteDescription(data.sdp);
            await flushPendingIce(from);
          } else if (data.type === "ice") {
            if (pc.remoteDescription) await pc.addIceCandidate(data.candidate);
            else ensurePendingIceList(from).push(data.candidate);
          }
        } catch (e) { console.error("Signal error", e); }
      });

    } catch (e) {
      setStatus("error");
      setError("Mic Access Denied: " + e.message);
    }
  };

  const leaveRoom = () => {
    socket.current?.disconnect();
    localStream.current?.getTracks().forEach(t => t.stop());
    pcs.current.forEach(pc => pc.close());
    pcs.current.clear();
    setParticipants([]);
    setPeerStates({});
    setStatus("idle");
  };

  const toggleMute = () => {
    const track = localStream.current?.getAudioTracks()[0];
    if (track) {
      track.enabled = !track.enabled;
      setIsMuted(!track.enabled);
      socket.current?.emit("voice:mute-change", { roomId, isMuted: !track.enabled });
    }
  };

  // color code the connection status
  const getStateColor = (s) => {
    if (s === "connected") return "text-success";
    if (s === "failed") return "text-error";
    if (s === "connecting" || s === "checking") return "text-warning";
    return "text-neutral-400";
  };

  useEffect(() => {
    return () => leaveRoom();
  }, []);

  return (
    <div className="min-h-screen bg-base-200 flex flex-col">
      <NavBar />
      <main className="flex-1 max-w-3xl mx-auto px-4 py-6 w-full">
        <div className="mb-5">
          <h1 className="text-2xl font-bold">Voice Chat</h1>
          <p className="text-sm text-neutral-500">Room: {roomId}</p>
        </div>

        {error && <div className="alert alert-warning text-sm mb-3">{error}</div>}

        <div className="card bg-base-100 shadow-md">
          <div className="card-body">
            <div className="flex justify-between items-center mb-4">
              <div className="font-semibold text-lg">
                Status: <span className={status === "connected" ? "text-success" : "text-neutral-500"}>{status}</span>
              </div>
              <div className="flex gap-2">
                {status === "idle" || status === "error" ? (
                  <button className="btn btn-primary btn-sm" onClick={joinRoom}>Join Voice</button>
                ) : (
                  <>
                    <button className={`btn btn-sm ${isMuted ? "btn-error" : "btn-outline"}`} onClick={toggleMute}>
                      {isMuted ? "Unmute" : "Mute Mic"}
                    </button>
                    <button className="btn btn-neutral btn-sm" onClick={leaveRoom}>Leave</button>
                  </>
                )}
              </div>
            </div>

            <div className="divider">Participants</div>

            {participants.length === 0 ? (
              <div className="text-center text-neutral-400 py-4">No one else is here.</div>
            ) : (
              <ul className="space-y-3">
                {participants.map(p => {
                  const isMe = p.peerId === socket.current?.id;
                  const connState = peerStates[p.peerId] || "new";

                  return (
                    <li key={p.peerId} className="flex flex-col bg-base-50 p-3 rounded-lg border border-base-200">
                      <div className="flex justify-between items-center">
                        <span className="font-bold flex items-center gap-2">
                          {p.name} {isMe && "(You)"}
                          {p.isMuted && <span className="badge badge-error badge-xs">Muted</span>}
                        </span>
                        {!isMe && (
                          <span className={`text-xs uppercase font-mono ${getStateColor(connState)}`}>
                            {connState}
                          </span>
                        )}
                      </div>
                      {/* where their audio element lives */}
                      {!isMe && (
                        <div id={`audio-${p.peerId}-container`} className="mt-1">
                          {/* Audio element will be appended here by JS */}
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}

            <div id="remote-audio-container" className="hidden" />
            {/* fallback container */}
          </div>
        </div>
      </main>
    </div>
  );
}

export default VoiceChatRoomPage;