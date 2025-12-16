import { useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { io } from "socket.io-client";
import NavBar from "../components/NavBar";
import { getUser, isLoggedIn } from "../lib/auth";

const SIGNAL_URL = "http://localhost:5001";

const RTC_CONFIG = {
  iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
};

function VoiceChatRoomPage() {
  const { id: roomId } = useParams();
  const navigate = useNavigate();
  const me = getUser();

  const [status, setStatus] = useState("idle");
  const [error, setError] = useState("");
  const [isMuted, setIsMuted] = useState(false);
  const [participants, setParticipants] = useState([]); // [{ peerId, name }]

  const socket = useRef(null);
  const localStream = useRef(null);
  const pcs = useRef(new Map()); // peerId -> RTCPeerConnection
  const pendingIce = useRef(new Map()); // peerId -> RTCIceCandidate[]
  const makingOffer = useRef(new Map()); // peerId -> boolean

  const token = useMemo(() => {
    if (typeof window === "undefined") return null;
    return localStorage.getItem("token");
  }, []);

  const ensurePendingIceList = (peerId) => {
    if (!pendingIce.current.has(peerId)) pendingIce.current.set(peerId, []);
    return pendingIce.current.get(peerId);
  };

  const setMakingOffer = (peerId, v) => {
    makingOffer.current.set(peerId, v);
  };

  const getMakingOffer = (peerId) => {
    return makingOffer.current.get(peerId) === true;
  };

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
    pendingIce.current.delete(peerId);
    makingOffer.current.delete(peerId);

    const audioEl = document.getElementById(`audio-${peerId}`);
    if (audioEl) audioEl.remove();
  };

  const createPeerConnection = (peerId) => {
    const pc = new RTCPeerConnection(RTC_CONFIG);

    // Add local audio tracks
    const stream = localStream.current;
    if (stream) {
      for (const track of stream.getTracks()) pc.addTrack(track, stream);
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
        audioEl.controls = true;
        audioEl.className = "w-full mt-2";
        document.getElementById("remote-audio-container")?.appendChild(audioEl);
      }

      audioEl.srcObject = remoteStream;
      audioEl.play().catch(() => {});
    };

    // ICE out
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
      } catch {}
    }
  };

  // Deterministic offerer: only one side offers (prevents "glare")
  const iShouldOffer = (peerId) => {
    const myId = socket.current?.id;
    if (!myId) return false;
    return myId < peerId; // stable ordering
  };

  const makeOfferTo = async (peerId) => {
    const pc = ensurePC(peerId);

    if (!iShouldOffer(peerId)) return;
    if (pc.signalingState !== "stable") return;
    if (pc.localDescription || pc.remoteDescription) return;

    try {
      setMakingOffer(peerId, true);

      const offer = await pc.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: false,
      });
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
      // get mic
      localStream.current = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
        video: false,
      });

      // ✅ IMPORTANT FIX:
      // Do NOT force websocket only. Allow polling fallback.
      socket.current = io(SIGNAL_URL, {
        auth: { token },
        transports: ["websocket", "polling"],
        reconnection: true,
        reconnectionAttempts: 10,
        reconnectionDelay: 300,
      });

      socket.current.on("connect_error", (e) => {
        setStatus("error");
        setError(e?.message || "Socket connection failed");
      });

      socket.current.on("disconnect", (reason) => {
        // show reason if it disconnects after connecting
        if (status !== "idle") {
          setStatus("error");
          setError(reason ? `Disconnected: ${reason}` : "Disconnected");
        }
      });

      socket.current.on("connect", () => {
        socket.current.emit("voice:join", { roomId });
      });

      // Server sends full list
      socket.current.on("voice:participants:update", async ({ participants }) => {
        const list = Array.isArray(participants) ? participants : [];
        setParticipants(list);

        const myId = socket.current?.id;
        const others = myId ? list.filter((p) => p.peerId !== myId) : list;

        for (const p of others) ensurePC(p.peerId);

        setStatus("connected");

        for (const p of others) {
          await makeOfferTo(p.peerId);
        }
      });

      socket.current.on("voice:peer-left", ({ peerId }) => {
        cleanupPeer(peerId);
      });

      socket.current.on("voice:signal", async ({ from, data }) => {
        const pc = ensurePC(from);

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
            if (!pc.remoteDescription) {
              ensurePendingIceList(from).push(data.candidate);
            } else {
              await pc.addIceCandidate(data.candidate);
            }
          }
        } catch {
          // keep silent
        }
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
  };

  const myLabel = (peerId) => {
    if (!socket.current?.id) return "";
    return peerId === socket.current.id ? " (you)" : "";
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
            {me?.name && (
              <p className="text-xs text-neutral-500">
                Logged in as: <span className="font-semibold">{me.name}</span>
              </p>
            )}
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
                  People in call: <span className="font-semibold">{participants.length}</span>
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
                <h2 className="font-semibold mb-2">Participants</h2>
                {participants.length === 0 ? (
                  <p className="text-sm text-neutral-500">No one in the call yet.</p>
                ) : (
                  <ul className="text-sm space-y-1">
                    {participants.map((p) => (
                      <li key={p.peerId} className="flex items-center justify-between">
                        <span className="font-medium">
                          {p.name || "Unknown"}
                          <span className="text-neutral-500">{myLabel(p.peerId)}</span>
                        </span>
                        <span className="text-xs font-mono text-neutral-500">
                          {p.peerId.slice(0, 6)}...
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="divider" />

              <div>
                <h2 className="font-semibold mb-2">Remote Audio</h2>
                <div id="remote-audio-container" className="space-y-2" />
                <p className="text-xs text-neutral-500 mt-2">
                  If autoplay is blocked, click Play on the audio controls above.
                </p>
              </div>
            </div>
          </div>

          <div className="mt-3 text-xs text-neutral-500">
            Same PC tip: use headphones to avoid echo/feedback.
          </div>
        </div>
      </main>
    </div>
  );
}

export default VoiceChatRoomPage;
