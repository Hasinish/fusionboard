import { useEffect, useRef, useState } from "react";
import * as Y from "yjs";
import { WebsocketProvider } from "y-websocket";

export default function useYjsBoard({ boardId, token, enabled = true }) {
    const yDocRef = useRef(null);
    const providerRef = useRef(null);
    const yElementsRef = useRef(null);
    const yMetaRef = useRef(null);
    const [connected, setConnected] = useState(false);
    const [synced, setSynced] = useState(false);
    // yElements and yMeta as STATE so consumers re-render when Yjs connects.
    const [yElements, setYElements] = useState(null);
    const [yMeta, setYMeta] = useState(null);

    useEffect(() => {
        if (!boardId || !token || !enabled) return;

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
        yElementsRef.current = doc.getMap("elements");
        yMetaRef.current = doc.getMap("meta");
        setYElements(yElementsRef.current);
        setYMeta(yMetaRef.current);

        provider.on("status", ({ status }) => {
            setConnected(status === "connected");
        });
        provider.on("synced", (isSynced) => {
            setSynced(isSynced);
        });

        return () => {
            provider.destroy();
            doc.destroy();
            yDocRef.current = null;
            providerRef.current = null;
            yElementsRef.current = null;
            yMetaRef.current = null;
            setConnected(false);
            setSynced(false);
            setYElements(null);
            setYMeta(null);
        };
    }, [boardId, token, enabled]);

    return {
        yDocRef,
        yElementsRef,
        yMetaRef,
        providerRef,
        yElements,
        yMeta,
        connected,
        synced,
    };
}
