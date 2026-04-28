import React, { useEffect, useRef, useState } from "react";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { io } from "socket.io-client";
import "@xterm/xterm/css/xterm.css";

let baseApi = import.meta.env.VITE_API_URL;
if (!baseApi) {
    const isProd = typeof window !== "undefined" && (window.location.hostname.includes("vercel.app") || window.location.hostname.includes("fusionboard"));
    baseApi = isProd ? "https://fusionboard-backend-docker.onrender.com" : "http://localhost:5001";
}
const API_URL = baseApi.replace(/\/api$/, "");

const stripAnsi = (str) =>
    str
        .replace(/\x1b\[[0-9;]*[a-zA-Z]/g, "")
        .replace(/\x1b\][^\x07]*\x07/g, "")
        .replace(/\x1b\[\?[0-9;]*[a-zA-Z]/g, "");

const serializeTerminalScreen = (term) => {
    const buffer = term?.buffer?.active;
    if (!term || !buffer) return "";

    const rows = term.rows || 24;
    const start = buffer.baseY || 0;
    const lines = [];

    for (let row = 0; row < rows; row += 1) {
        const line = buffer.getLine(start + row);
        lines.push(line ? line.translateToString(true) : "");
    }

    return lines.join("\n").replace(/\n+$/, "");
};

export function CodeTerminal({ code, language, onStop, isViewer, camera, terminalSessionKey, onTranscriptChange }) {
    const terminalRef = useRef(null);
    const xtermRef = useRef(null);
    const socketRef = useRef(null);
    const fitAddonRef = useRef(null);
    const inputRef = useRef(null);
    const [inputValue, setInputValue] = useState("");
    const lastSentRef = useRef([]);
    const readyRef = useRef(false);
    const preReadyBufferRef = useRef("");
    const transcriptRef = useRef("");
    const directInputRef = useRef("");
    const terminalEventsRef = useRef([]);
    const inputDraftRef = useRef("");

    const publishTerminalState = () => {
        if (!onTranscriptChange) return;
        onTranscriptChange({
            transcript: transcriptRef.current,
            screen: serializeTerminalScreen(xtermRef.current),
            events: terminalEventsRef.current,
            inputDraft: inputDraftRef.current,
        });
    };

    const appendTerminalEvent = (kind, text, publish = true) => {
        if (!text && kind !== "input") return;
        const cleanText = stripAnsi(String(text)).replace(/\r\n|\r/g, "\n");
        if (!cleanText && kind !== "input") return;

        // Simple deduplication for output: if the last event was also output and had same text, skip
        const lastEvent = terminalEventsRef.current[terminalEventsRef.current.length - 1];
        if (lastEvent && lastEvent.kind === kind && lastEvent.text === cleanText && kind === "output") {
            return cleanText;
        }

        terminalEventsRef.current = [
            ...terminalEventsRef.current,
            { kind, text: cleanText, ts: Date.now() },
        ].slice(-300);
        return cleanText;
    };

    const appendTranscript = (data, publish = true, kind = "output") => {
        if (!data || !onTranscriptChange) return;
        const cleanText = appendTerminalEvent(kind, data, false);
        if (!cleanText && kind !== "input") return; // If deduplicated or empty
        transcriptRef.current += cleanText;
        if (publish) publishTerminalState();
    };

    const recordTerminalInput = (input, { submitted = true } = {}) => {
        if (!input && submitted) return;
        inputDraftRef.current = "";

        // When submitting input, we append it to events.
        // We also add it to lastSentRef to filter out the subsequent PTY echo.
        const cleanInput = `${input}\n`;
        appendTerminalEvent("input", cleanInput, false);
        transcriptRef.current += `> ${cleanInput}`;

        // Also add to lastSentRef for filtering
        lastSentRef.current.push(input.trim());

        requestAnimationFrame(() => publishTerminalState());
    };

    const recordDirectTerminalInput = (data) => {
        if (!data) return;

        if (data === "\x03") {
            directInputRef.current = "";
            recordTerminalInput("^C");
            return;
        }

        if (data === "\r" || data === "\n") {
            recordTerminalInput(directInputRef.current);
            directInputRef.current = "";
            return;
        }

        if (data === "\u007f" || data === "\b") {
            directInputRef.current = directInputRef.current.slice(0, -1);
            inputDraftRef.current = directInputRef.current;
            publishTerminalState();
            return;
        }

        if (data.length === 1 && data >= " " && data !== "\x7f") {
            directInputRef.current += data;
            inputDraftRef.current = directInputRef.current;
            onTranscriptChange?.({
                transcript: `${transcriptRef.current}> ${directInputRef.current}`,
                screen: serializeTerminalScreen(xtermRef.current),
                events: terminalEventsRef.current,
                inputDraft: inputDraftRef.current,
            });
        }
    };

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
            rightClickSelectsWord: true,
        });

        // Allow Ctrl+C to copy when text is selected, otherwise send as terminal input
        term.attachCustomKeyEventHandler((ev) => {
            if (ev.type === 'keydown' && ev.ctrlKey && ev.key === 'c') {
                const selection = term.getSelection();
                if (selection) {
                    navigator.clipboard.writeText(selection);
                    term.clearSelection();
                    return false; // Prevent xterm from handling it
                }
                // No selection → let it pass through as SIGINT
                return true;
            }
            if (ev.type === 'keydown' && ev.ctrlKey && ev.key === 'v') {
                // Allow browser paste
                return false;
            }
            return true;
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
        transcriptRef.current = "";
        directInputRef.current = "";
        terminalEventsRef.current = [];
        inputDraftRef.current = "";

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
                // Buffer all data until ready (no filtering needed with bash -c / cmd /C)
                preReadyBufferRef.current += rawData;
                return;
            }

            // NATIVE STREAMING: Once ready, let xterm handle the raw ANSI stream.
            // Filter out PTY echo of user input (we already display it locally as "> input")
            let filtered = rawData;
            if (lastSentRef.current.length > 0) {
                const lines = filtered.split(/\r\n|\n|\r/);
                const result = [];
                for (const line of lines) {
                    const cleaned = stripAnsi(line).trim();
                    const echoIdx = lastSentRef.current.indexOf(cleaned);
                    if (echoIdx !== -1) {
                        // This line is an echo of sent input — skip it and remove from tracking
                        lastSentRef.current.splice(echoIdx, 1);
                    } else {
                        result.push(line);
                    }
                }
                filtered = result.join("\r\n");
            }
            if (filtered) {
                xtermRef.current.write(filtered, () => {
                    appendTranscript(filtered, false, "output");
                    publishTerminalState();
                });
            }

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
            const line = "[System] Launching Terminal...\n";
            term.writeln("\x1b[38;5;12m[System] Launching Terminal...\x1b[0m");
            appendTranscript(line, true, "system");
            socket.emit("terminal:spawn", { language, code, cols: term.cols, rows: term.rows });
        });

        socket.on("terminal:ready", () => {
            readyRef.current = true;
            const line = "[System] Ready.\n";
            term.writeln("\x1b[38;5;10m[System] Ready.\x1b[0m");
            appendTranscript(line, true, "system");
            if (preReadyBufferRef.current) {
                const bufferedData = preReadyBufferRef.current;
                term.write(bufferedData, () => {
                    appendTranscript(bufferedData, false, "output");
                    publishTerminalState();
                });
                preReadyBufferRef.current = "";
            }
            if (inputRef.current) inputRef.current.focus();
        });



        term.onData((data) => {
            if (!isViewer) {
                recordDirectTerminalInput(data);
                socket.emit("terminal:data", data);
            }
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
                xtermRef.current?.writeln(`\x1b[38;5;14m${inputValue}\x1b[0m`);
                recordTerminalInput(inputValue);
                socket.emit("terminal:data", inputValue + "\r");
            }
            setInputValue("");
        }
    };

    const handleInputChange = (e) => {
        const value = e.target.value;
        setInputValue(value);
        inputDraftRef.current = value;
        publishTerminalState();
    };
    const sendCtrlC = () => {
        recordTerminalInput("^C");
        socketRef.current?.emit("terminal:data", "\x03");
    };

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
                <input ref={inputRef} type="text" className="flex-1 bg-[#1e1e2e] text-[#89b4fa] outline-none border border-[#313244] rounded font-mono" style={{ fontSize: 12 * zs, padding: `${2 * zs}px ${6 * zs}px` }} placeholder="Type input..." value={inputValue} onChange={handleInputChange} onKeyDown={(e) => { e.stopPropagation(); handleInputSubmit(e); }} spellCheck={false} autoComplete="off" />
                <button onClick={(e) => { e.stopPropagation(); sendCtrlC(); }} className="text-[#f38ba8] bg-[#313244] rounded font-bold cursor-pointer hover:bg-[#45475a] select-none" style={{ fontSize: 10 * zs, padding: `${2 * zs}px ${6 * zs}px` }}>Ctrl+C</button>
            </div>
        </div>
    );
}
