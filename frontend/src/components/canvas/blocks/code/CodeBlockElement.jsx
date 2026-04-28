import React, { useRef, useState, useEffect } from "react";
import { Play, Loader2, RefreshCw, Terminal, Keyboard, Trash2 } from "lucide-react";
import { useCodeEditorIndentation } from "./useCodeEditorIndentation";
import { useCodeExecution } from "./useCodeExecution";
import { LANGUAGES, BOILERPLATES } from "./codeExecutionUtils";

export function CodeBlockElement({ 
    el, 
    camera, 
    onChange, 
    isEditing, 
    onStartEdit, 
    onEndEdit,
    handlePointerDown 
}) {
    const [activeTab, setActiveTab] = useState("output"); // "output" | "input"
    const [stdin, setStdin] = useState(""); 
    const textareaRef = useRef(null);

    // Update local output when execution happens
    const handleOutputChange = (newOutput) => {
        onChange({ ...el, output: newOutput });
        setActiveTab("output");
    };

    const { isRunning, execute } = useCodeExecution(el.code, el.language, handleOutputChange, stdin);
    const { handleKeyDown } = useCodeEditorIndentation({ 
        code: el.code || "", 
        onChange: (val) => onChange({ ...el, code: val }), 
        textareaRef 
    });

    const sw = el.w * camera.z;
    // const sh = el.h * camera.z; // Not using fixed height for inner content, allowing flex
    
    // Font size scaling
    const fontSize = (el.fontSize || 14) * (sw / el.w);

    return (
        <div 
            className="absolute inset-0 rounded-lg overflow-hidden flex flex-col shadow-xl bg-[#1e1e2e]"
            style={{ 
                border: `${el.strokeWidth || 1}px solid ${el.stroke}`,
                // Prevent selecting text when not editing, but allow pointer events for buttons
                userSelect: isEditing ? "text" : "none" 
            }}
            onPointerDown={handlePointerDown}
            onDoubleClick={(e) => {
                e.stopPropagation();
                onStartEdit(el.id);
            }}
        >
            {/* Header */}
            <div 
                className="flex items-center justify-between border-b border-[#313244] bg-[#181825]"
                style={{ padding: `${8 * camera.z}px ${12 * camera.z}px` }}
                onPointerDown={handlePointerDown} // Ensure drag works on header
            >
                <div className="flex items-center" style={{ gap: `${8 * camera.z}px` }}>
                    {/* Window Controls Decoration */}
                    <div className="flex" style={{ gap: `${6 * camera.z}px` }}>
                        <div style={{ width: 10 * camera.z, height: 10 * camera.z, borderRadius: '50%', backgroundColor: '#f87171' }} />
                        <div style={{ width: 10 * camera.z, height: 10 * camera.z, borderRadius: '50%', backgroundColor: '#facc15' }} />
                        <div style={{ width: 10 * camera.z, height: 10 * camera.z, borderRadius: '50%', backgroundColor: '#4ade80' }} />
                    </div>

                    {/* Language Selector */}
                    <select
                        className="bg-[#1e1e2e] text-[#cdd6f4] rounded border border-[#313244] outline-none cursor-pointer hover:border-[#45475a] transition-colors"
                        value={el.language}
                        style={{
                            marginLeft: 8 * camera.z,
                            fontSize: 12 * camera.z,
                            padding: `${2 * camera.z}px ${6 * camera.z}px`
                        }}
                        onChange={(e) => {
                            const newLang = e.target.value;
                            const currentCode = (el.code || "").trim();
                            const isBoilerplate = Object.values(BOILERPLATES).some(b => b.trim() === currentCode);
                            
                            if (!currentCode || isBoilerplate) {
                                onChange({ ...el, language: newLang, code: BOILERPLATES[newLang] || "" });
                            } else {
                                onChange({ ...el, language: newLang });
                            }
                        }}
                        onPointerDown={(e) => e.stopPropagation()} // Allow interaction
                    >
                        {LANGUAGES.map(lang => (
                            <option key={lang.id} value={lang.id}>{lang.name}</option>
                        ))}
                    </select>

                    {/* Reset Button */}
                    <button
                        className="bg-[#313244] hover:bg-[#45475a] text-[#cdd6f4] border-none flex items-center justify-center rounded cursor-pointer transition-colors"
                        title="Reset to boilerplate"
                        onPointerDown={(e) => e.stopPropagation()}
                        onClick={() => {
                            if (window.confirm("Reset code to boilerplate? This will lose your changes.")) {
                                onChange({ ...el, code: BOILERPLATES[el.language] });
                            }
                        }}
                        style={{ width: 24 * camera.z, height: 24 * camera.z, marginLeft: 4 * camera.z }}
                    >
                        <RefreshCw size={12 * camera.z} />
                    </button>

                    {/* Clear Button */}
                    <button
                        className="bg-[#313244] hover:bg-red-500/20 text-[#f87171] border-none flex items-center justify-center rounded cursor-pointer transition-colors"
                        title="Clear all code"
                        onPointerDown={(e) => e.stopPropagation()}
                        onClick={() => {
                            if (window.confirm("Clear all code?")) {
                                onChange({ ...el, code: "" });
                            }
                        }}
                        style={{ width: 24 * camera.z, height: 24 * camera.z, marginLeft: 4 * camera.z }}
                    >
                        <Trash2 size={12 * camera.z} />
                    </button>
                </div>

                {/* Run Button */}
                <button
                    className="bg-green-600 hover:bg-green-500 text-white border-none flex items-center font-semibold rounded cursor-pointer transition-colors"
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={execute}
                    disabled={isRunning}
                    style={{
                        padding: `${4 * camera.z}px ${10 * camera.z}px`,
                        fontSize: 12 * camera.z,
                        gap: 4 * camera.z,
                        opacity: isRunning ? 0.7 : 1
                    }}
                >
                    {isRunning ? <Loader2 size={12 * camera.z} className="animate-spin" /> : <Play size={12 * camera.z} fill="currentColor" />}
                    Run
                </button>
            </div>

            {/* Code Editor */}
            <div className="flex-1 relative bg-[#1e1e2e]">
                <textarea
                    ref={textareaRef}
                    className="absolute inset-0 w-full h-full bg-transparent resize-none outline-none font-mono"
                    style={{
                        color: el.textColor || "#cdd6f4",
                        fontSize: `${fontSize}px`,
                        padding: 12 * camera.z,
                        lineHeight: 1.5,
                        pointerEvents: isEditing ? 'auto' : 'none'
                    }}
                    value={el.code || ""}
                    onChange={(e) => onChange({ ...el, code: e.target.value })}
                    onKeyDown={handleKeyDown}
                    onPointerDown={(e) => {
                        if (isEditing) e.stopPropagation();
                    }}
                    onWheel={(e) => {
                        // Allow zooming (Ctrl/Meta) but trap scrolling
                        if (e.ctrlKey || e.metaKey) return;
                        e.stopPropagation();
                    }}
                    spellCheck="false"
                    placeholder="// Write your code here..."
                />
            </div>

            {/* Bottom Panel (Input/Output) */}
            <div className="h-1/3 flex flex-col bg-[#11111b] border-t border-[#313244]">
                {/* Tabs */}
                <div className="flex border-b border-[#313244] bg-[#181825]">
                    <button
                        className={`px-3 py-1 text-xs font-medium flex items-center gap-2 transition-colors ${activeTab === 'output' ? 'text-white bg-[#11111b] border-t-2 border-blue-500' : 'text-gray-500 hover:text-gray-300'}`}
                        onClick={() => setActiveTab('output')}
                        onPointerDown={(e) => e.stopPropagation()}
                        style={{ fontSize: 11 * camera.z, padding: `${6 * camera.z}px ${12 * camera.z}px` }}
                    >
                        <Terminal size={12 * camera.z} /> Output
                    </button>
                    <button
                        className={`px-3 py-1 text-xs font-medium flex items-center gap-2 transition-colors ${activeTab === 'input' ? 'text-white bg-[#11111b] border-t-2 border-blue-500' : 'text-gray-500 hover:text-gray-300'}`}
                        onClick={() => setActiveTab('input')}
                        onPointerDown={(e) => e.stopPropagation()}
                        style={{ fontSize: 11 * camera.z, padding: `${6 * camera.z}px ${12 * camera.z}px` }}
                    >
                        <Keyboard size={12 * camera.z} /> Input (stdin)
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 relative overflow-hidden">
                    {activeTab === 'output' ? (
                        <div 
                            className="absolute inset-0 overflow-auto p-2 font-mono"
                            style={{ fontSize: 12 * camera.z, color: '#a6adc8' }}
                            onWheel={(e) => { if (!e.ctrlKey && !e.metaKey) e.stopPropagation(); }}
                            onPointerDown={(e) => isEditing && e.stopPropagation()}
                        >
                            <pre className="whitespace-pre-wrap m-0 font-mono">{el.output || "No output yet."}</pre>
                        </div>
                    ) : (
                        <textarea
                            className="absolute inset-0 w-full h-full bg-[#11111b] text-[#a6adc8] resize-none outline-none p-2 font-mono border-none"
                            style={{ fontSize: 12 * camera.z }}
                            value={stdin}
                            onChange={(e) => setStdin(e.target.value)}
                            placeholder="Enter input here (will be provided to the program)..."
                            onPointerDown={(e) => e.stopPropagation()}
                            onKeyDown={(e) => e.stopPropagation()} // Allow typing in input even if not "editing" code? Maybe.
                        />
                    )}
                </div>
            </div>
        </div>
    );
}
