import React, { useState, useEffect } from 'react';
import { Sparkles, Key, Loader2, Send } from 'lucide-react';
import { uid } from '../BoardElement';
import { getBaseSchema } from './ai/aiTools';
import { processToolCall } from './ai/aiHandlers';

export default function AIAssistant({ boardActions, camera, screenToWorld, isDark, selectedItems }) {
    const [isOpen, setIsOpen] = useState(false);
    const [provider, setProvider] = useState("gemini");
    const [apiKey, setApiKey] = useState("");
    const [hasKey, setHasKey] = useState(false);
    const [prompt, setPrompt] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    useEffect(() => {
        const storedKey = localStorage.getItem(`${provider}ApiKey`);
        if (storedKey) {
            setApiKey(storedKey);
            setHasKey(true);
        } else {
            setApiKey("");
            setHasKey(false);
        }
    }, [provider]);

    const saveKey = () => {
        if (!apiKey.trim()) return;
        localStorage.setItem(`${provider}ApiKey`, apiKey);
        setHasKey(true);
    };

    const removeKey = () => {
        localStorage.removeItem(`${provider}ApiKey`);
        setApiKey("");
        setHasKey(false);
        setIsOpen(false);
    };

    const handleGenerate = async (e) => {
        if (e) e.preventDefault();
        if (!prompt.trim() || !hasKey) return;

        setLoading(true);
        setError("");

        try {
            const centerScreenX = window.innerWidth / 2;
            const centerScreenY = window.innerHeight / 2;
            const worldPos = screenToWorld(centerScreenX, centerScreenY);

            let selectedContext = "";
            if (selectedItems && selectedItems.length > 0) {
                const safeItems = selectedItems.map(item => ({ 
                    id: item.id, 
                    type: item.type, 
                    x: Math.round(item.x), 
                    y: Math.round(item.y), 
                    w: Math.round(item.w), 
                    h: Math.round(item.h), 
                    text: item.text, 
                    stroke: item.stroke, 
                    fill: item.fill,
                    expressions: item.expressions, 
                    language: item.language 
                }));
                selectedContext = `\n\nThe user currently has the following elements selected:\n${JSON.stringify(safeItems)}\n\nYou can use 'update_elements' or 'delete_elements' on these IDs. When updating a graph's expressions, provide the FULL 'expressions' array including unmodified ones.`;
            }

            const systemInstruction = `You are a whiteboard AI assistant. 
User Viewport Center: x: ${Math.round(worldPos.x)}, y: ${Math.round(worldPos.y)}.
User Theme: ${isDark ? "Dark Mode" : "Light Mode"}.

Capabilities:
- Create shapes (rect, ellipse, triangle), stickies, text, arrows, and lines.
- Create multi-function mathematical plots (y=x^2, sin(x), etc.).
- Create diagrams using Mermaid.js.
- Embed videos and interactive code terminals.
- Update/Delete existing elements.

Rules:
1. SPATIAL AWARENESS: DO NOT stack elements. Use a grid-like layout. 
    - HORIZONTAL ROW: Increment 'x' by 300 for each element. 
    - MIND MAPS: Center element at (x,y), then place children at (+/- 300, +/- 300).
2. COLORS & THEMES: 
    - If a user asks for a "color shape", set that color as the 'stroke'. Keep 'fill' transparent/pastel.
    - BRAINSTORMING: Use green (#86efac) for "Pros/Positive" stickies and red (#fca5a5) for "Cons/Negative" stickies.
3. MATHEMATICS: Use 'create_graph' for all math. Pass an array of function strings like ["sin(x)", "x^2", "sqrt(x)"].
4. CODE TERMINALS: Default to 'javascript' or 'python'. Use 'create_code' and provide clean, commented snippets.
5. MERMAID DIAGRAMS (CRITICAL): Use 'create_mermaid'.
    - SUPPORTED TYPES: Flowcharts (graph TD/LR), Sequence Diagrams (sequenceDiagram), Gantt, Pie, Entity Relationship.
    - ALWAYS use double quotes for nodes and labels: A["Start Process"].
    - ARROW LABELS: Use 'A -->|Success| B'. NEVER use '-->|label|>'.
    - SEQUENCE DIAGRAMS: Use 'sequenceDiagram' header. Example: 'sequenceDiagram; Alice->>Bob: Hello; Bob-->>Alice: Hi!'.
    - Keep it compact and logical. DO NOT include markdown backticks.
6. LAYERING: Shapes/Pen/Text are ALWAYS on top of images/diagrams. If creating a background, create it FIRST.

User Prompt: "${prompt}"
${selectedContext}`;

            const baseSchema = getBaseSchema();

            let endpoint = "";
            let headers = { "Content-Type": "application/json" };
            let body = {};

            if (provider === "gemini") {
                endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
                body = {
                    contents: [{ parts: [{ text: systemInstruction }] }],
                    tools: [{ functionDeclarations: baseSchema }],
                    toolConfig: { functionCallingConfig: { mode: "ANY" } }
                };
            } else {
                endpoint = provider === "openai" 
                    ? "https://api.openai.com/v1/chat/completions" 
                    : "https://api.groq.com/openai/v1/chat/completions";
                
                headers["Authorization"] = `Bearer ${apiKey}`;
                body = {
                    model: provider === "openai" ? "gpt-4o" : "llama-3.3-70b-versatile",
                    messages: [{ role: "system", content: systemInstruction }, { role: "user", content: prompt }],
                    tools: baseSchema.map(s => ({ type: "function", function: s })),
                    tool_choice: "auto"
                };
            }

            const response = await fetch(endpoint, {
                method: "POST",
                headers,
                body: JSON.stringify(body)
            });

            if (!response.ok) {
                const err = await response.json();
                throw new Error(err.error?.message || "Failed to call AI");
            }

            const data = await response.json();
            
            let calls = [];
            if (provider === "gemini") {
                calls = data.candidates?.[0]?.content?.parts?.filter(p => p.functionCall)?.map(p => ({
                    name: p.functionCall.name,
                    args: p.functionCall.args
                })) || [];
            } else {
                const toolCalls = data.choices?.[0]?.message?.tool_calls || [];
                calls = toolCalls.map(tc => {
                    let parsedArgs = {};
                    try { parsedArgs = JSON.parse(tc.function.arguments); } catch(e) {}
                    return { name: tc.function.name, args: parsedArgs };
                });
            }
            
            if (calls.length === 0) {
                setError("I couldn't figure out what to draw from that prompt.");
                setLoading(false);
                return;
            }

            let offset = 0;
            for (const call of calls) {
                const element = processToolCall(call, worldPos, isDark, offset, boardActions);
                if (element && boardActions) {
                    boardActions.createElement(element);
                    offset += 50;
                }
            }
            
            setPrompt("");
            setIsOpen(false);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div 
            className="fixed bottom-4 left-4 z-50 flex flex-col items-start gap-2 pointer-events-auto"
            onPointerDown={(e) => e.stopPropagation()}
            onWheel={(e) => e.stopPropagation()}
        >
            {isOpen && (
                <div className="bg-white dark:bg-[#1A1A1A] border border-black/10 dark:border-white/10 shadow-2xl rounded-2xl p-4 w-80 transform transition-all">
                    {!hasKey ? (
                        <div className="flex flex-col gap-3">
                            <div className="flex items-center gap-2 text-blue-500 font-semibold mb-1">
                                <Key className="w-5 h-5" />
                                <h3>Setup AI Assistant</h3>
                            </div>
                            <div className="flex flex-col gap-1 mb-2">
                                <label className="text-[10px] font-bold uppercase text-black/50 dark:text-white/50 tracking-wider">AI Model Provider</label>
                                <select 
                                    value={provider}
                                    onChange={(e) => setProvider(e.target.value)}
                                    className="w-full bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-lg px-2 py-1.5 text-xs text-black dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
                                >
                                    <option value="gemini" className="text-black bg-white">Google Gemini 2.5</option>
                                    <option value="openai" className="text-black bg-white">OpenAI (ChatGPT)</option>
                                    <option value="groq" className="text-black bg-white">Groq (Llama 3)</option>
                                </select>
                            </div>
                            <p className="text-xs text-black/60 dark:text-white/60 leading-relaxed">
                                {provider === "gemini" && <>Get your free key from <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer" className="text-blue-500 hover:underline">Google AI Studio</a>. (15 requests per minute limit)</>}
                                {provider === "openai" && <>Get your key from <a href="https://platform.openai.com/api-keys" target="_blank" rel="noreferrer" className="text-blue-500 hover:underline">OpenAI Platform</a>.</>}
                                {provider === "groq" && <>Get your free key from <a href="https://console.groq.com/keys" target="_blank" rel="noreferrer" className="text-blue-500 hover:underline">Groq Console</a>. (Unlimited ultra-fast generation)</>}
                            </p>
                            <input 
                                type="password" 
                                value={apiKey}
                                onChange={(e) => setApiKey(e.target.value)}
                                placeholder="Paste your API key..." 
                                className="w-full bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-lg px-3 py-2 text-sm text-black dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                            <button onClick={saveKey} className="w-full bg-blue-500 hover:bg-blue-600 text-white font-medium py-2 rounded-lg text-sm transition-colors">
                                Save Key
                            </button>
                        </div>
                    ) : (
                        <form onSubmit={handleGenerate} className="flex flex-col gap-3">
                            <div className="flex items-center justify-between mb-1">
                                <div className="flex items-center gap-2 text-blue-500 font-semibold">
                                    <Sparkles className="w-5 h-5" />
                                    <h3>Ask AI ({provider.charAt(0).toUpperCase() + provider.slice(1)})</h3>
                                </div>
                                <button type="button" onClick={removeKey} className="text-[10px] text-black/40 dark:text-white/40 hover:underline">
                                    Change Provider
                                </button>
                            </div>
                            
                            <textarea 
                                value={prompt}
                                onChange={(e) => setPrompt(e.target.value)}
                                placeholder="Draw a red circle and a mermaid graph..." 
                                className="w-full bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-lg px-3 py-2 text-sm text-black dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none h-20"
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' && !e.shiftKey) {
                                        e.preventDefault();
                                        handleGenerate(e);
                                    }
                                }}
                            />
                            
                            {error && <p className="text-xs text-red-500">{error}</p>}
                            
                            <button 
                                type="submit" 
                                disabled={loading || !prompt.trim()}
                                className="w-full bg-blue-500 hover:bg-blue-600 text-white font-medium py-2 rounded-lg text-sm transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                                {loading ? "Generating..." : "Generate"}
                            </button>
                        </form>
                    )}
                </div>
            )}

            <button 
                onClick={(e) => { e.stopPropagation(); setIsOpen(!isOpen); }}
                className={`flex items-center justify-center w-12 h-12 rounded-full shadow-xl transition-all ${
                    isOpen 
                        ? 'bg-blue-500 text-white rotate-12 scale-110' 
                        : 'bg-gradient-to-tr from-purple-600 to-blue-500 text-white hover:scale-110 hover:shadow-2xl'
                }`}
            >
                <Sparkles className="w-6 h-6" />
            </button>
        </div>
    );
}
