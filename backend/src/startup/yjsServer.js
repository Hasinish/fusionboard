import { WebSocketServer } from "ws";
import * as Y from "yjs";
import * as syncProtocol from "y-protocols/sync";
import * as awarenessProtocol from "y-protocols/awareness";
import * as encoding from "lib0/encoding";
import * as decoding from "lib0/decoding";
import { LeveldbPersistence } from "y-leveldb";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import Board from "../models/Board.js";
import Workspace from "../models/Workspace.js";

const MSG_SYNC = 0;
const MSG_AWARENESS = 1;

const BOARD_SCHEMA_VERSION = 2;
const BOARD_BOOTSTRAP_ORIGIN = "fusionboard:server-bootstrap";
const MONGO_MIRROR_DEBOUNCE_MS = 1000;

const persistence = new LeveldbPersistence("./data/yjs");

// Cache promises so a board doc is created + bootstrapped only once at a time.
const docCache = new Map();
const docConns = new Map();
const docAwareness = new Map();
const mongoMirrorTimers = new Map();

process.on("unhandledRejection", (reason, promise) => {
  console.error("[Yjs] Unhandled Rejection at:", promise, "reason:", reason);
});

function cloneValue(value) {
  if (value == null) return value;
  if (typeof structuredClone === "function") {
    return structuredClone(value);
  }
  return JSON.parse(JSON.stringify(value));
}

function repairElementOrder(elementsById, elementOrder) {
  const seen = new Set();
  const nextOrder = [];

  elementOrder.toArray().forEach((id) => {
    if (!id || seen.has(id) || !elementsById.has(id)) return;
    seen.add(id);
    nextOrder.push(id);
  });

  elementsById.forEach((_, id) => {
    if (!seen.has(id)) {
      seen.add(id);
      nextOrder.push(id);
    }
  });

  const currentOrder = elementOrder.toArray();
  const needsRepair =
    currentOrder.length !== nextOrder.length ||
    currentOrder.some((id, index) => id !== nextOrder[index]);

  if (needsRepair) {
    if (elementOrder.length > 0) {
      elementOrder.delete(0, elementOrder.length);
    }
    if (nextOrder.length > 0) {
      elementOrder.insert(0, nextOrder);
    }
  }

  return nextOrder;
}

function ensureBoardSchema(ydoc) {
  const elementsById = ydoc.getMap("elementsById");
  const elementOrder = ydoc.getArray("elementOrder");
  const elementContents = ydoc.getMap("elementContents");
  const meta = ydoc.getMap("meta");
  const legacyElements = ydoc.getMap("elements");

  const needsLegacyMigration =
    elementsById.size === 0 &&
    elementOrder.length === 0 &&
    legacyElements.size > 0;

  if (needsLegacyMigration) {
    ydoc.transact(() => {
      legacyElements.forEach((value, id) => {
        if (!value?.id) return;
        elementsById.set(id, cloneValue(value));
      });
      repairElementOrder(elementsById, elementOrder);
      legacyElements.clear();
      meta.set("schemaVersion", BOARD_SCHEMA_VERSION);
      meta.set("bootstrappedAt", Date.now());
    }, BOARD_BOOTSTRAP_ORIGIN);
  } else if (elementOrder.length === 0 && elementsById.size > 0) {
    ydoc.transact(() => {
      repairElementOrder(elementsById, elementOrder);
      if (!meta.has("schemaVersion")) {
        meta.set("schemaVersion", BOARD_SCHEMA_VERSION);
      }
    }, BOARD_BOOTSTRAP_ORIGIN);
  } else if (!meta.has("schemaVersion")) {
    ydoc.transact(() => {
      meta.set("schemaVersion", BOARD_SCHEMA_VERSION);
    }, BOARD_BOOTSTRAP_ORIGIN);
  }

  // Backfill mission: Ensure every interactive element has character-sync content
  const INTERACTIVE_TYPES = new Set(["text", "code", "video", "graph", "sticky"]);
  ydoc.transact(() => {
    elementsById.forEach((el, id) => {
      if (el && INTERACTIVE_TYPES.has(el.type) && !elementContents.has(id)) {
        const initialContent = el.code || el.text || "";
        elementContents.set(id, new Y.Text(initialContent));
      }
    });
  }, BOARD_BOOTSTRAP_ORIGIN);

  return {
    elementsById,
    elementOrder,
    elementContents,
    meta,
  };
}

async function bootstrapDocFromMongo(docName, ydoc) {
  const schema = ensureBoardSchema(ydoc);

  if (!mongoose.isValidObjectId(docName)) {
    return schema;
  }

  const board = await Board.findById(docName)
    .select("+elements title")
    .lean();

  if (!board) {
    return schema;
  }

  const needsElementBootstrap =
    schema.elementsById.size === 0 &&
    schema.elementOrder.length === 0 &&
    Array.isArray(board.elements) &&
    board.elements.length > 0;

  const needsTitleBootstrap =
    !schema.meta.has("title") &&
    typeof board.title === "string" &&
    board.title.trim().length > 0;

  if (!needsElementBootstrap && !needsTitleBootstrap) {
    return schema;
  }

  ydoc.transact(() => {
    if (needsElementBootstrap) {
      board.elements.forEach((element) => {
        if (!element?.id) return;
        schema.elementsById.set(element.id, cloneValue(element));
      });
      repairElementOrder(schema.elementsById, schema.elementOrder);
      schema.meta.set("bootstrappedFromMongoAt", Date.now());
    }

    if (needsTitleBootstrap) {
      schema.meta.set("title", board.title.trim());
    }

    if (!schema.meta.has("schemaVersion")) {
      schema.meta.set("schemaVersion", BOARD_SCHEMA_VERSION);
    }
  }, BOARD_BOOTSTRAP_ORIGIN);

  return schema;
}

async function mirrorDocToMongo(docName, ydoc) {
  if (!mongoose.isValidObjectId(docName)) {
    return;
  }

  const title = ydoc.getMap("meta").get("title");
  const update = {
    $currentDate: { updatedAt: true },
  };

  if (typeof title === "string" && title.trim()) {
    update.$set = { title: title.trim() };
  }

  await Board.updateOne({ _id: docName }, update);
}

function scheduleMongoMirror(docName, ydoc) {
  const existingTimer = mongoMirrorTimers.get(docName);
  if (existingTimer) {
    clearTimeout(existingTimer);
  }

  const timer = setTimeout(() => {
    mongoMirrorTimers.delete(docName);
    mirrorDocToMongo(docName, ydoc).catch((error) => {
      console.error(`[Yjs] Failed to mirror board ${docName} into Mongo:`, error);
    });
  }, MONGO_MIRROR_DEBOUNCE_MS);

  mongoMirrorTimers.set(docName, timer);
}

async function getOrCreateDoc(docName) {
  if (docCache.has(docName)) {
    return docCache.get(docName);
  }

  const docPromise = (async () => {
    const ydoc = await persistence.getYDoc(docName);
    ensureBoardSchema(ydoc);

    ydoc.on("update", (update) => {
      persistence.storeUpdate(docName, update).catch((error) => {
        console.error(`[Yjs] Persistence error for ${docName}:`, error);
      });
    });

    await bootstrapDocFromMongo(docName, ydoc);
    return ydoc;
  })();

  docCache.set(docName, docPromise);

  try {
    return await docPromise;
  } catch (error) {
    docCache.delete(docName);
    throw error;
  }
}

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

function handleMessage(ws, ydoc, message, awareness) {
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

function broadcastToDoc(conns, message, excludeWs) {
  const data = message instanceof Uint8Array ? message : new Uint8Array(message);
  for (const conn of conns) {
    if (conn !== excludeWs && conn.readyState === conn.OPEN) {
      conn.send(data);
    }
  }
}

async function cleanupDoc(docName, ydoc, awareness) {
  const pendingMirror = mongoMirrorTimers.get(docName);
  if (pendingMirror) {
    clearTimeout(pendingMirror);
    mongoMirrorTimers.delete(docName);
    try {
      await mirrorDocToMongo(docName, ydoc);
    } catch (error) {
      console.error(`[Yjs] Failed to flush board ${docName} on close:`, error);
    }
  }

  if (awareness) {
    awarenessProtocol.removeAwarenessStates(
      awareness,
      Array.from(awareness.getStates().keys()),
      null
    );
  }

  docAwareness.delete(docName);
  docCache.delete(docName);
  ydoc.destroy();
}

export async function deleteYjsBoardDoc(boardId) {
  const docName = String(boardId);
  const pendingMirror = mongoMirrorTimers.get(docName);
  if (pendingMirror) {
    clearTimeout(pendingMirror);
    mongoMirrorTimers.delete(docName);
  }

  const docPromise = docCache.get(docName);
  docCache.delete(docName);
  docConns.delete(docName);
  docAwareness.delete(docName);

  if (docPromise) {
    try {
      const doc = await docPromise;
      doc?.destroy?.();
    } catch {
      // Ignore in-memory cleanup failures.
    }
  }

  await persistence.clearDocument(docName);
}

export function startYjsServer(httpServer) {
  const wss = new WebSocketServer({ noServer: true });

  wss.on("error", (err) => {
    console.error("[Yjs] WebSocketServer error:", err);
  });

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

    ws.on("error", (err) => {
      console.error("[Yjs] ws error:", err.message);
    });

    (async () => {
      try {
        const pathParts = parsedUrl.pathname.split("/").filter(Boolean);
        const boardId = pathParts[1] || parsedUrl.searchParams.get("boardId");
        const token = parsedUrl.searchParams.get("token");

        if (!boardId || !token) {
          try { ws.close(4001, "Missing boardId or token"); } catch { /* ignore */ }
          return;
        }

        let decoded;
        try {
          decoded = jwt.verify(token, process.env.JWT_SECRET);
        } catch {
          try { ws.close(4001, "Invalid token"); } catch { /* ignore */ }
          return;
        }

        let role = "viewer";
        try {
          const board = await Board.findById(boardId).select("workspace").lean();
          if (board?.workspace) {
            const workspace = await Workspace.findById(board.workspace)
              .select("members")
              .lean();
            if (workspace?.members) {
              const member = workspace.members.find(
                (entry) => String(entry.user) === String(decoded.id)
              );
              if (member) role = member.role || "viewer";
            }
          }
        } catch {
          // Boards like the test room won't exist in Mongo; keep viewer fallback.
        }

        const docName = String(boardId);
        const ydoc = await getOrCreateDoc(docName);

        if (!docAwareness.has(docName)) {
          docAwareness.set(docName, new awarenessProtocol.Awareness(ydoc));
        }
        const awareness = docAwareness.get(docName);

        if (!docConns.has(docName)) {
          docConns.set(docName, new Set());
        }
        const conns = docConns.get(docName);
        conns.add(ws);

        if (!ydoc._yjsBroadcastBound) {
          ydoc._yjsBroadcastBound = true;

          ydoc.on("update", (update, origin) => {
            try {
              scheduleMongoMirror(docName, ydoc);
              const encoder = encoding.createEncoder();
              encoding.writeVarUint(encoder, MSG_SYNC);
              encoding.writeVarUint(encoder, syncProtocol.messageYjsUpdate ?? 2);
              encoding.writeVarUint8Array(encoder, update);
              const msg = encoding.toUint8Array(encoder);
              const currentConns = docConns.get(docName);
              if (currentConns) {
                broadcastToDoc(currentConns, msg, origin);
              }
            } catch (error) {
              console.error(`[Yjs] Broadcast error for ${docName}:`, error);
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

        sendSyncStep1(ws, ydoc);

        if (role === "viewer") {
          ws.isReadOnly = true;

          ws.on("message", (message) => {
            try {
              const buf = message instanceof Buffer
                ? new Uint8Array(message)
                : new Uint8Array(message);
              const decoder = decoding.createDecoder(buf);
              const msgType = decoding.readVarUint(decoder);

              if (msgType === MSG_AWARENESS) {
                const update = decoding.readVarUint8Array(decoder);
                awarenessProtocol.applyAwarenessUpdate(awareness, update, ws);
                return;
              }

              if (msgType === MSG_SYNC) {
                const syncMsgType = decoding.readVarUint(decoder);
                if (syncMsgType === syncProtocol.messageYjsSyncStep1) {
                  const encoder = encoding.createEncoder();
                  encoding.writeVarUint(encoder, MSG_SYNC);
                  const fullDecoder = decoding.createDecoder(buf);
                  decoding.readVarUint(fullDecoder);
                  syncProtocol.readSyncMessage(fullDecoder, encoder, ydoc, ws);
                  if (encoding.length(encoder) > 1) {
                    ws.send(encoding.toUint8Array(encoder));
                  }
                }
              }
            } catch {
              // Ignore malformed messages.
            }
          });
        } else {
          ws.on("message", (message) => {
            try {
              handleMessage(ws, ydoc, message, awareness);
            } catch {
              // Ignore malformed messages.
            }
          });
        }

        ws.on("close", () => {
          conns.delete(ws);
          if (conns.size === 0) {
            docConns.delete(docName);
            cleanupDoc(docName, ydoc, awareness).catch((error) => {
              console.error(`[Yjs] Cleanup error for ${docName}:`, error);
            });
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
