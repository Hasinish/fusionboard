import { useEffect, useRef, useState } from "react";
import * as Y from "yjs";
import { WebsocketProvider } from "y-websocket";
import {
    createBoardActions,
    createBoardStore,
    ensureBoardSchema,
} from "../lib/yjsBoard";
import {
    BOARD_CLEAR_ORIGIN,
    BOARD_COMMIT_ORIGIN,
    BOARD_META_ORIGIN,
} from "../lib/yjsConstants";

export default function useYjsBoard({ boardId, token, enabled = true }) {
    const yDocRef = useRef(null);
    const providerRef = useRef(null);
    const yElementsRef = useRef(null);
    const yElementOrderRef = useRef(null);
    const yMetaRef = useRef(null);
    const awarenessRef = useRef(null);
    const boardStoreRef = useRef(null);
    const boardActionsRef = useRef(null);
    const undoManagerRef = useRef(null);
    const [connected, setConnected] = useState(false);
    const [synced, setSynced] = useState(false);
    const [boardApi, setBoardApi] = useState({
        yElements: null,
        yElementOrder: null,
        yElementContents: null,
        yMeta: null,
        awareness: null,
        boardStore: null,
        boardActions: null,
        undoManager: null,
    });

    useEffect(() => {
        if (!boardId || !token || !enabled) return;
        let disposed = false;

        // Build WebSocket URL from VITE_API_URL
        const apiBase = (import.meta.env.VITE_API_URL || "http://localhost:5001/api")
            .replace(/\/api$/, "");
        const wsBase = apiBase.replace(/^https/, "wss").replace(/^http/, "ws");

        const doc = new Y.Doc();
        const provider = new WebsocketProvider(
            wsBase + "/yjs",
            boardId,
            doc,
            {
                params: { token },
                connect: true,
                resyncInterval: 5000,
            }
        );

        yDocRef.current = doc;
        providerRef.current = provider;
        const schema = ensureBoardSchema(doc);
        const { elementsById, elementOrder, elementContents, meta } = schema;
        
        const boardStore = createBoardStore({ doc, elementsById, elementOrder, elementContents, meta });
        const boardActions = createBoardActions({ doc, elementsById, elementOrder, elementContents, meta });
        const undoManager = new Y.UndoManager([elementsById, elementOrder, elementContents, meta], {
            trackedOrigins: new Set([
                BOARD_COMMIT_ORIGIN,
                BOARD_META_ORIGIN,
                BOARD_CLEAR_ORIGIN,
            ]),
            captureTimeout: 500,
        });

        yElementsRef.current = elementsById;
        yElementOrderRef.current = elementOrder;
        yMetaRef.current = meta;
        awarenessRef.current = provider.awareness;
        boardStoreRef.current = boardStore;
        boardActionsRef.current = boardActions;
        undoManagerRef.current = undoManager;

        queueMicrotask(() => {
            if (disposed) return;
            setBoardApi({
                yElements: elementsById,
                yElementOrder: elementOrder,
                yElementContents: elementContents,
                yMeta: meta,
                awareness: provider.awareness,
                boardStore,
                boardActions,
                undoManager,
            });
        });

        provider.on("status", ({ status }) => {
            setConnected(status === "connected");
        });
        provider.on("synced", (isSynced) => {
            setSynced(isSynced);
        });

        return () => {
            disposed = true;
            undoManager.destroy();
            boardStore.destroy();
            provider.destroy();
            doc.destroy();
            yDocRef.current = null;
            providerRef.current = null;
            yElementsRef.current = null;
            yElementOrderRef.current = null;
            yMetaRef.current = null;
            awarenessRef.current = null;
            boardStoreRef.current = null;
            boardActionsRef.current = null;
            undoManagerRef.current = null;
            setConnected(false);
            setSynced(false);
            queueMicrotask(() => {
                setBoardApi({
                    yElements: null,
                    yElementOrder: null,
                    yMeta: null,
                    awareness: null,
                    boardStore: null,
                    boardActions: null,
                    undoManager: null,
                });
            });
        };
    }, [boardId, token, enabled]);

    return {
        yDocRef,
        yElementsRef,
        yElementOrderRef,
        yMetaRef,
        providerRef,
        awarenessRef,
        boardStoreRef,
        boardActionsRef,
        undoManagerRef,
        yElements: boardApi.yElements,
        yElementOrder: boardApi.yElementOrder,
        yMeta: boardApi.yMeta,
        awareness: boardApi.awareness,
        boardStore: boardApi.boardStore,
        boardActions: boardApi.boardActions,
        undoManager: boardApi.undoManager,
        connected,
        synced,
    };
}
