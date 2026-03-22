import { WebSocketServer } from "ws";
import * as syncProtocol from "y-protocols/sync";
import * as awarenessProtocol from "y-protocols/awareness";
import * as encoding from "lib0/encoding";
import * as decoding from "lib0/decoding";
import { LeveldbPersistence } from "y-leveldb";
import jwt from "jsonwebtoken";
import Board from "../models/Board.js";
import Workspace from "../models/Workspace.js";

// ── Message type constants (verified from y-websocket v3 source) ──────────
const MSG_SYNC = 0;
const MSG_AWARENESS = 1;

// ── Module-level persistence (instantiated ONCE, never inside handlers) ───
const persistence = new LeveldbPersistence("./data/yjs");

// Cache of active Y.Doc instances by docName.
// Prevents race condition where two simultaneous connections for the same
// board call getYDoc twice, creating two separate Y.Doc instances.
const docCache = new Map();

// Log unhandled rejections to prevent silent crashes
process.on("unhandledRejection", (reason, promise) => {
  console.error("[Yjs] Unhandled Rejection at:", promise, "reason:", reason);
});

/**
 * Get or create a persisted Y.Doc for. Uses docCache to ensure only
 * one Y.Doc exists per docName. Binds persistence via update listener.
 */
async function getOrCreateDoc(docName) {
  if (docCache.has(docName)) {
    return docCache.get(docName);
  }
  const ydoc = await persistence.getYDoc(docName);
  docCache.set(docName, ydoc);

  // "bindState" — persist every update automatically
  ydoc.on("update", (update) => {
    persistence.storeUpdate(docName, update).catch(err => {
      console.error(`[Yjs] Persistence error for ${docName}:`, err);
    });
  });

  return ydoc;
}

/**
 * Send a Y.Doc's full state to a newly connected WebSocket client
 * (sync step 1 + step 2 + awareness).
 */
function sendSyncStep1(ws, ydoc) {
  const encoder = encoding.createEncoder();
  encoding.writeVarUint(encoder, MSG_SYNC);
  syncProtocol.writeSyncStep1(encoder, ydoc);
  ws.send(encoding.toUint8Array(encoder));

  const encoder2 = encoding.createEncoder();
  encoding.writeVarUint(encoder2, MSG_SYNC);
  syncProtocol.writeSyncStep2(encoder2, ydoc);
  ws.send(encoding.toUint8Array(encoder2));
}

/**
 * Handle an incoming binary message from a client.
 * Routes to sync or awareness protocol handlers.
 */
function handleMessage(ws, ydoc, message, awareness, conns) {
  const buf = message instanceof Buffer ? new Uint8Array(message) : new Uint8Array(message);
  const decoder = decoding.createDecoder(buf);
  const msgType = decoding.readVarUint(decoder);
  const encoder = encoding.createEncoder();

  if (msgType === MSG_SYNC) {
    encoding.writeVarUint(encoder, MSG_SYNC);
    syncProtocol.readSyncMessage(decoder, encoder, ydoc, ws);
    if (encoding.length(encoder) > 1) {
      ws.send(encoding.toUint8Array(encoder));
    }
  } else if (msgType === MSG_AWARENESS) {
    const update = decoding.readVarUint8Array(decoder);
    awarenessProtocol.applyAwarenessUpdate(awareness, update, ws);
  }
}

/**
 * Broadcast a message to all connected clients for a doc, optionally
 * excluding the sender.
 */
function broadcastToDoc(conns, message, excludeWs) {
  const data = message instanceof Uint8Array ? message : new Uint8Array(message);
  for (const conn of conns) {
    if (conn !== excludeWs && conn.readyState === conn.OPEN) {
      conn.send(data);
    }
  }
}

// Track connections per doc: Map<docName, Set<ws>>
const docConns = new Map();
// Track awareness per doc: Map<docName, awarenessProtocol.Awareness>
const docAwareness = new Map();

export function startYjsServer(httpServer) {
  const wss = new WebSocketServer({ noServer: true });

  wss.on("error", (err) => {
    console.error("[Yjs] WebSocketServer error:", err);
  });

  // Intercept HTTP upgrade requests for /yjs/* only
  httpServer.on("upgrade", (req, socket, head) => {
    const handleUpgradeError = (err) => {
      console.error("[Yjs] Upgrade socket error:", err.message);
      socket.destroy();
    };
    socket.on("error", handleUpgradeError);

    const pathname = new URL(req.url, "http://localhost").pathname;
    if (pathname.startsWith("/yjs")) {
      wss.handleUpgrade(req, socket, head, (ws) => {
        socket.removeListener("error", handleUpgradeError);
        wss.emit("connection", ws, req);
      });
    } else {
      socket.removeListener("error", handleUpgradeError);
    }
  });

  wss.on("connection", (ws, req) => {
    const parsedUrl = new URL(req.url, "http://localhost");

    // Prevent unhandled 'error' from crashing the process
    ws.on("error", (err) => {
      console.error("[Yjs] ws error:", err.message);
    });

    ;(async () => {
      try {
        // STEP A — Parse query params
        const url = parsedUrl;
        const pathParts = parsedUrl.pathname.split("/").filter(Boolean);
        const boardId = pathParts[1] || url.searchParams.get("boardId");
        const token = url.searchParams.get("token");

        if (!boardId || !token) {
          try { ws.close(4001, "Missing boardId or token"); } catch { /* ignore */ }
          return;
        }

        // STEP B — Verify JWT
        let decoded;
        try {
          decoded = jwt.verify(token, process.env.JWT_SECRET);
        } catch {
          try { ws.close(4001, "Invalid token"); } catch { /* ignore */ }
          return;
        }

        // STEP C — Look up user role (default to viewer if anything fails)
        let role = "viewer";
        try {
          const board = await Board.findById(boardId).select("workspace").lean();
          if (board?.workspace) {
            const workspace = await Workspace.findById(board.workspace)
              .select("members")
              .lean();
            if (workspace?.members) {
              const member = workspace.members.find(
                (m) => String(m.user) === String(decoded.id)
              );
              if (member) role = member.role || "viewer";
            }
          }
        } catch {
          // board may not exist (e.g. test room) — keep role = viewer
        }

        // STEP D — Get or create the persisted Y.Doc
        const docName = String(boardId);
        const ydoc = await getOrCreateDoc(docName);

        // Get or create awareness for this doc
        if (!docAwareness.has(docName)) {
          docAwareness.set(docName, new awarenessProtocol.Awareness(ydoc));
        }
        const awareness = docAwareness.get(docName);

        // Track connections for this doc
        if (!docConns.has(docName)) {
          docConns.set(docName, new Set());
        }
        const conns = docConns.get(docName);
        conns.add(ws);

        // Set up doc update broadcasting (only once per doc)
        if (!ydoc._yjsBroadcastBound) {
          ydoc._yjsBroadcastBound = true;
          ydoc.on("update", (update, origin) => {
            try {
              const encoder = encoding.createEncoder();
              encoding.writeVarUint(encoder, MSG_SYNC);
              encoding.writeVarUint(encoder, syncProtocol.messageYjsUpdate ?? 2);
              encoding.writeVarUint8Array(encoder, update);
              const msg = encoding.toUint8Array(encoder);
              const currentConns = docConns.get(docName);
              if (currentConns) {
                broadcastToDoc(currentConns, msg, origin);
              }
            } catch (err) {
              console.error(`[Yjs] Broadcast error for ${docName}:`, err);
            }
          });

          awareness.on("update", ({ added, updated, removed }) => {
            const changedClients = added.concat(updated).concat(removed);
            const encoder = encoding.createEncoder();
            encoding.writeVarUint(encoder, MSG_AWARENESS);
            encoding.writeVarUint8Array(
              encoder,
              awarenessProtocol.encodeAwarenessUpdate(awareness, changedClients)
            );
            const msg = encoding.toUint8Array(encoder);
            const currentConns = docConns.get(docName);
            if (currentConns) {
              broadcastToDoc(currentConns, msg);
            }
          });
        }

        // STEP E — Connect the socket
        // Send sync step 1 + 2 so the client gets full doc state
        sendSyncStep1(ws, ydoc);

        if (role === "viewer") {
          ws.isReadOnly = true;

          // Viewers can receive sync & awareness but cannot send writes.
          // Allow MSG_SYNC (sync step 1 = read requests) and MSG_AWARENESS.
          // Block everything else (sync step 2, updates = writes).
          ws.on("message", (message) => {
            try {
              const buf = message instanceof Buffer
                ? new Uint8Array(message)
                : new Uint8Array(message);
              const decoder = decoding.createDecoder(buf);
              const msgType = decoding.readVarUint(decoder);

              if (msgType === MSG_AWARENESS) {
                // Allow awareness messages (cursor/presence)
                const update = decoding.readVarUint8Array(decoder);
                awarenessProtocol.applyAwarenessUpdate(awareness, update, ws);
                return;
              }

              if (msgType === MSG_SYNC) {
                // Read the sync message type to determine if it's a read or write
                const syncMsgType = decoding.readVarUint(decoder);
                // syncProtocol.messageYjsSyncStep1 = 0 (read request — allowed)
                // syncProtocol.messageYjsSyncStep2 = 1 (full state — write)
                // syncProtocol.messageYjsUpdate = 2 (incremental update — write)
                if (syncMsgType === syncProtocol.messageYjsSyncStep1) {
                  // This is a sync step 1 (read) — respond with sync step 2
                  const encoder = encoding.createEncoder();
                  encoding.writeVarUint(encoder, MSG_SYNC);
                  // Re-create decoder for the full message to pass to readSyncMessage
                  const fullDecoder = decoding.createDecoder(buf);
                  decoding.readVarUint(fullDecoder); // skip msg type
                  syncProtocol.readSyncMessage(fullDecoder, encoder, ydoc, ws);
                  if (encoding.length(encoder) > 1) {
                    ws.send(encoding.toUint8Array(encoder));
                  }
                  return;
                }
                // Block sync step 2 and update messages (writes) from viewers
                return;
              }

              // Block all other message types from viewers
            } catch {
              // ignore malformed messages
            }
          });
        } else {
          // Editors and owners get full read/write access
          ws.on("message", (message) => {
            try {
              handleMessage(ws, ydoc, message, awareness, conns);
            } catch {
              // ignore malformed messages
            }
          });
        }

        // STEP F — Handle disconnect: clean up connection tracking
        ws.on("close", () => {
          conns.delete(ws);
          if (conns.size === 0) {
            docConns.delete(docName);
            // Clean up awareness when no connections remain
            awarenessProtocol.removeAwarenessStates(
              awareness,
              Array.from(awareness.getStates().keys()),
              null
            );
          }
        });

        console.log(
          `[Yjs] connected boardId=${boardId} role=${role} userId=${decoded.id}`
        );

      } catch (err) {
        console.error("[Yjs] connection error:", err);
        try { ws.close(4002, "Server error"); } catch { /* ignore */ }
      }
    })();
  });
}
