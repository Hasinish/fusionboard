import { useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { io } from "socket.io-client";
import NavBar from "../components/NavBar";
import { isLoggedIn } from "../lib/auth";

const SIGNAL_URL = "http://localhost:5001";

// STUN only (simple)
const RTC_CONFIG = {
  iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
};

function VoiceChatRoomPage() {
  const { id: roomId } = useParams();
  const navigate = useNavigate();

  const [status, setStatus] = useState("idle"); // idle | connecting | connected | error
  const [error, setError] = useState("");
  const [isMuted, setIsMuted] = useState(false);
  const [peerIds, setPeerIds] = useState([]);

  const socket = useRef(null);
  const localStream = useRef(null);
  const pcs = useRef(new Map()); // peerId -> RTCPeerConnection

  const token = useMemo(() => {
    if (typeof window === "undefined") return null;
    return localStorage.getItem("token");
  }, []);

  const cleanupPeer = (peerId) => {
    const pc = pcs.current.get(peerId);
    if (pc) {
      try {
        pc.onicecandidate = null;
        pc.ontrack = null;
        pc.onconnectionstatechange = null;
        pc.close();
      } catch {}
      pcs.current.delete(peerId);
    }

    const audioEl = document.getElementById(`audio-${peerId}`);
    if (audioEl) audioEl.remove();

    setPeerIds((prev) => prev.filter((x) => x !== peerId));
  };

  const createPeerConnection = (peerId) => {
    const pc = new RTCPeerConnection(RTC_CONFIG);

    // Send our audio to the peer
    const stream = localStream.current;
    if (stream) {
      for (const track of stream.getTracks()) {
        pc.addTrack(track, stream);
      }
    }

    // Receive remote audio
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
        audioEl.controls = true; // show controls so user can hit play if autoplay blocked
        audioEl.className = "w-full mt-2";
        document.getElementById("remote-audio-container")?.appendChild(audioEl);
      }

      audioEl.srcObject = remoteStream;

      // Try to force playback (some browsers need this)
      audioEl.play().catch(() => {});
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
    setPeerIds((prev) => (prev.includes(peerId) ? prev : [...prev, peerId]));
    return pc;
  };

  const ensurePC = (peerId) => pcs.current.get(peerId) || createPeerConnection(peerId);

  const makeOfferTo = async (peerId) => {
    const pc = ensurePC(peerId);
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);

    socket.current.emit("voice:signal", {
      to: peerId,
      data: { type: "offer", sdp: pc.localDescription },
    });
  };

  const joinRoom = async () => {
    setError("");

    if (!isLoggedIn() || !token) {
      navigate("/login");
      return;
    }

    setStatus("connecting");

    try {
      // 1) Must be triggered by user click to avoid autoplay/mic blocks
      localStream.current = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: false,
      });

      // 2) connect socket
      socket.current = io(SIGNAL_URL, {
        auth: { token },
        transports: ["websocket"],
      });

      socket.current.on("connect_error", (e) => {
        setStatus("error");
        setError(e?.message || "Socket connection failed");
      });

      socket.current.on("connect", () => {
        socket.current.emit("voice:join", { roomId });
      });

      // We joined; server sends list of existing peers -> we offer to them
      socket.current.on("voice:peers", async ({ peers }) => {
        setStatus("connected");
        for (const peerId of peers || []) {
          await makeOfferTo(peerId);
        }
      });

      // A peer joined after us -> they will offer to us
      socket.current.on("voice:peer-joined", ({ peerId }) => {
        ensurePC(peerId);
      });

      socket.current.on("voice:peer-left", ({ peerId }) => {
        cleanupPeer(peerId);
      });

      socket.current.on("voice:signal", async ({ from, data }) => {
        try {
          const pc = ensurePC(from);

          if (data?.type === "offer") {
            await pc.setRemoteDescription(data.sdp);
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);

            socket.current.emit("voice:signal", {
              to: from,
              data: { type: "answer", sdp: pc.localDescription },
            });
          } else if (data?.type === "answer") {
            await pc.setRemoteDescription(data.sdp);
          } else if (data?.type === "ice" && data?.candidate) {
            await pc.addIceCandidate(data.candidate);
          }
        } catch {}
      });
    } catch (e) {
      setStatus("error");
      setError(e?.message || "Could not start voice chat. Check mic permission.");
    }
  };

  const leaveRoom = () => {
    setError("");

    try {
      if (socket.current) {
        socket.current.emit("voice:leave", { roomId });
        socket.current.disconnect();
      }
    } catch {}
    socket.current = null;

    for (const [peerId, pc] of pcs.current.entries()) {
      try {
        pc.close();
      } catch {}
      pcs.current.delete(peerId);

      const audioEl = document.getElementById(`audio-${peerId}`);
      if (audioEl) audioEl.remove();
    }
    setPeerIds([]);

    if (localStream.current) {
      for (const t of localStream.current.getTracks()) t.stop();
      localStream.current = null;
    }

    setIsMuted(false);
    setStatus("idle");
  };

  const toggleMute = () => {
    const stream = localStream.current;
    if (!stream) return;
    const audioTrack = stream.getAudioTracks()[0];
    if (!audioTrack) return;

    const next = !isMuted;
    audioTrack.enabled = !next;
    setIsMuted(next);
  };

  return (
    <div className="min-h-screen bg-base-200 flex flex-col">
      <NavBar />

      <main className="flex-1">
        <div className="max-w-3xl mx-auto px-4 py-6">
          <div className="mb-5">
            <h1 className="text-2xl font-bold">Voice Chat Room</h1>
            <p className="text-sm text-neutral-500">
              Room ID: <span className="font-mono">{roomId}</span>
            </p>
          </div>

          {error && (
            <div className="alert alert-error py-2 text-sm mb-3">
              <span>{error}</span>
            </div>
          )}

          <div className="card bg-base-100 shadow-md">
            <div className="card-body space-y-3">
              <div className="flex items-center justify-between">
                <div className="text-sm">
                  Status: <span className="font-semibold">{status}</span>
                </div>
                <div className="text-sm">
                  Peers: <span className="font-semibold">{peerIds.length}</span>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                {status === "idle" || status === "error" ? (
                  <button className="btn btn-primary btn-sm" onClick={joinRoom}>
                    Join Voice Room
                  </button>
                ) : (
                  <button className="btn btn-ghost btn-sm" onClick={leaveRoom}>
                    Leave Room
                  </button>
                )}

                <button
                  className={`btn btn-sm ${isMuted ? "btn-warning" : "btn-outline"}`}
                  onClick={toggleMute}
                  disabled={status !== "connected"}
                >
                  {isMuted ? "Unmute" : "Mute"}
                </button>

                <button
                  className="btn btn-sm btn-outline"
                  onClick={() => navigate(`/workspaces/${roomId}`)}
                >
                  Back to Workspace
                </button>
              </div>

              <div className="divider" />

              <div>
                <h2 className="font-semibold mb-2">Remote Audio</h2>
                <div id="remote-audio-container" className="space-y-2" />
                <p className="text-xs text-neutral-500 mt-2">
                  If you don’t hear anything, press Play on the audio controls above (autoplay may be blocked).
                </p>
              </div>
            </div>
          </div>

          <div className="mt-3 text-xs text-neutral-500">
            Tip: test with headphones to avoid echo on same computer.
          </div>
        </div>
      </main>
    </div>
  );
}

export default VoiceChatRoomPage;
