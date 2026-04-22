import React, { useEffect, useRef, useState } from "react";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { io } from "socket.io-client";
import "@xterm/xterm/css/xterm.css";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5001";

const stripAnsi = (str) =>
    str
        .replace(/\x1b\[[0-9;]*[a-zA-Z]/g, "")
        .replace(/\x1b\][^\x07]*\x07/g, "")
        .replace(/\x1b\[\?[0-9;]*[a-zA-Z]/g, "")
        .trim();

export function CodeTerminal({ code, language, onStop, isViewer, camera, terminalSessionKey }) {
    const terminalRef = useRef(null);
    const xtermRef = useRef(null);
    const socketRef = useRef(null);
    const fitAddonRef = useRef(null);
    const inputRef = useRef(null);
    const [inputValue, setInputValue] = useState("");
    const lastSentRef = useRef([]);
    const readyRef = useRef(false);
    const preReadyBufferRef = useRef("");

    useEffect(() => {
        if (!terminalRef.current) return;

        const term = new Terminal({
            cursorBlink: true,
            convertEol: true,
            theme: {
                background: "#11111b",
                foreground: "#cdd6f4",
                cursor: "#f5e0dc",
                black: "#45475a",
                red: "#f38ba8",
                green: "#a6e3a1",
                yellow: "#f9e2af",
                blue: "#89b4fa",
                magenta: "#f5c2e7",
                cyan: "#94e2d5",
                white: "#bac2de",
            },
            fontSize: 12 * (camera?.z || 1),
            fontFamily: "monospace",
        });

        const fitAddon = new FitAddon();
        term.loadAddon(fitAddon);
        term.open(terminalRef.current);
        fitAddon.fit();

        xtermRef.current = term;
        fitAddonRef.current = fitAddon;
        readyRef.current = false;
        lastSentRef.current = [];
        preReadyBufferRef.current = "";

        const token = localStorage.getItem('token') || sessionStorage.getItem('token') || "";
        const socket = io(API_URL, {
            withCredentials: true,
            transports: ["websocket"],
            auth: { token }
        });
        socketRef.current = socket;

        let dataBuffer = "";
        let bufferTimeout = null;

        const processBuffer = () => {
            if (!xtermRef.current || !dataBuffer) return;
            const rawData = dataBuffer;
            dataBuffer = "";

            if (!readyRef.current) {
                // Pre-ready filtering for startup noise
                const lines = rawData.split(/\r\n|\n|\r/);
                lines.forEach(line => {
                    const cleaned = stripAnsi(line);
                    if (cleaned && !cleaned.includes("@echo off") && !cleaned.includes("python -u") && !cleaned.includes("prompt $S")) {
                        preReadyBufferRef.current += line + "\r\n";
                    }
                });
                return;
            }

            // NATIVE STREAMING: Once ready, let xterm handle the raw ANSI stream.
            // This is critical for handling shell re-draws during resize without duplication.
            xtermRef.current.write(rawData);
            
            // Ensure we stay at the bottom
            setTimeout(() => xtermRef.current?.scrollToBottom(), 10);
        };

        socket.on("terminal:data", (data) => {
            dataBuffer += data;
            if (bufferTimeout) clearTimeout(bufferTimeout);
            bufferTimeout = setTimeout(processBuffer, 30);
        });

        socket.on("connect", () => {
            if (term.cols === 0 || term.rows === 0) term.resize(80, 24);
            term.writeln("\x1b[38;5;12m[System] Launching Terminal...\x1b[0m");
            socket.emit("terminal:spawn", { language, code, cols: term.cols, rows: term.rows });
        });

        socket.on("terminal:ready", () => {
            readyRef.current = true;
            term.writeln("\x1b[38;5;10m[System] Ready.\x1b[0m");
            if (preReadyBufferRef.current) {
                term.write(preReadyBufferRef.current);
                preReadyBufferRef.current = "";
            }
            if (inputRef.current) inputRef.current.focus();
        });

        term.onData((data) => {
            if (!isViewer) socket.emit("terminal:data", data);
        });

        const containerEl = terminalRef.current;
        const wheelHandler = (e) => {
            if (e.ctrlKey || e.metaKey) return;
            e.preventDefault();
            term.scrollLines(e.deltaY > 0 ? 3 : -3);
        };
        containerEl.addEventListener("wheel", wheelHandler, { passive: false });

        let resizeTimeout = null;
        const handleResize = () => {
            if (fitAddonRef.current && xtermRef.current) {
                try {
                    // Update visual layout immediately
                    fitAddonRef.current.fit();
                    
                    // DEBOUNCE the backend resize. 
                    // Only tell the shell to re-draw once the user has finished/paused the resize interaction.
                    if (resizeTimeout) clearTimeout(resizeTimeout);
                    resizeTimeout = setTimeout(() => {
                        if (xtermRef.current && socketRef.current?.connected) {
                            socketRef.current.emit("terminal:resize", { 
                                cols: xtermRef.current.cols, 
                                rows: xtermRef.current.rows 
                            });
                        }
                    }, 250);
                } catch (e) {
                    // fit might fail if element is not in DOM or invisible
                }
            }
        };

        const resizeObserver = new ResizeObserver(() => {
            handleResize();
        });
        resizeObserver.observe(containerEl);

        setTimeout(handleResize, 100);

        return () => {
            if (bufferTimeout) clearTimeout(bufferTimeout);
            if (resizeTimeout) clearTimeout(resizeTimeout);
            containerEl.removeEventListener("wheel", wheelHandler);
            resizeObserver.disconnect();
            socket.disconnect();
            term.dispose();
        };
    }, []);

    useEffect(() => {
        if (xtermRef.current && camera) {
            xtermRef.current.options.fontSize = 12 * camera.z;
            fitAddonRef.current?.fit();
        }
    }, [camera?.z]);

    useEffect(() => {
        if (inputRef.current) inputRef.current.focus();
    }, [terminalSessionKey]);

    const handleInputSubmit = (e) => {
        if (e.key === "Enter") {
            e.preventDefault();
            const socket = socketRef.current;
            if (socket && !isViewer && inputValue) {
                xtermRef.current?.writeln(`\x1b[38;5;14m> ${inputValue}\x1b[0m`);
                lastSentRef.current.push(inputValue.trim());
                socket.emit("terminal:data", inputValue + "\r");
            }
            setInputValue("");
        }
    };

    const handleInputChange = (e) => setInputValue(e.target.value);
    const sendCtrlC = () => socketRef.current?.emit("terminal:data", "\x03");

    const zs = camera?.z || 1;

    return (
        <div
            className="relative w-full h-full bg-[#11111b] flex flex-col border-t border-[#313244]"
            onPointerDown={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.stopPropagation()}
            onKeyUp={(e) => e.stopPropagation()}
        >
            <div className="flex justify-between items-center px-2 shrink-0" style={{ height: 20 * zs }}>
                <span className="text-[#6c7086] font-bold" style={{ fontSize: 11 * zs }}>Interactive Terminal ({language})</span>
                <button onClick={(e) => { e.stopPropagation(); onStop(); }} className="text-[#f38ba8] bg-[#313244] rounded font-bold cursor-pointer hover:bg-[#45475a]" style={{ fontSize: 10 * zs, padding: `${2 * zs}px ${6 * zs}px` }}>KILL</button>
            </div>
            <div ref={terminalRef} className="flex-1 overflow-hidden px-1" />
            <div className="flex items-center gap-1 px-1 shrink-0 border-t border-[#313244]" style={{ padding: `${3 * zs}px ${4 * zs}px` }}>
                <span className="text-[#a6e3a1] font-bold select-none" style={{ fontSize: 12 * zs }}>❯</span>
                <input ref={inputRef} type="text" className="flex-1 bg-[#1e1e2e] text-[#cdd6f4] outline-none border border-[#313244] rounded font-mono" style={{ fontSize: 12 * zs, padding: `${2 * zs}px ${6 * zs}px` }} placeholder="Type here..." value={inputValue} onChange={handleInputChange} onKeyDown={(e) => { e.stopPropagation(); handleInputSubmit(e); }} spellCheck={false} autoComplete="off" />
                <button onClick={(e) => { e.stopPropagation(); sendCtrlC(); }} className="text-[#f38ba8] bg-[#313244] rounded font-bold cursor-pointer hover:bg-[#45475a] select-none" style={{ fontSize: 10 * zs, padding: `${2 * zs}px ${6 * zs}px` }}>Ctrl+C</button>
            </div>
        </div>
    );
}
