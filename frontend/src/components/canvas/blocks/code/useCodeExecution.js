import { useState, useCallback, useRef } from 'react';
import { LANGUAGE_IDS } from './codeExecutionUtils';

export function useCodeExecution(code, language, onOutputChange) {
    const [isRunning, setIsRunning] = useState(false);
    const abortControllerRef = useRef(null);

    const execute = useCallback(async () => {
        if (!code) return;
        setIsRunning(true);
        onOutputChange("Executing...");

        try {
            if (language === "javascript") {
                let logs = [];
                const originalLog = console.log;
                // Capture console.log
                console.log = (...args) => {
                    logs.push(args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' '));
                    originalLog(...args); // Optional: keep logging to devtools
                };
                
                try {
                    // eslint-disable-next-line no-eval
                    const result = eval(code);
                    if (result !== undefined && logs.length === 0) logs.push(String(result));
                    onOutputChange(logs.join('\n') || "Executed without output.");
                } catch (err) {
                    onOutputChange(`Error: ${err.message}`);
                } finally {
                    console.log = originalLog;
                }
            } else if (language === "python") {
                if (!window.pyodide) {
                    onOutputChange("Downloading Python (WASM Engine)... This only happens once.");
                    try {
                        await new Promise((resolve, reject) => {
                            if (document.getElementById('pyodide-script')) {
                                resolve(); // Already loading
                                return;
                            }
                            const script = document.createElement("script");
                            script.id = 'pyodide-script';
                            script.src = "https://cdn.jsdelivr.net/pyodide/v0.25.0/full/pyodide.js";
                            script.onload = resolve;
                            script.onerror = reject;
                            document.body.appendChild(script);
                        });
                        // Wait for loadPyodide to be available
                        while (!window.loadPyodide) {
                            await new Promise(r => setTimeout(r, 100));
                        }
                        window.pyodide = await window.loadPyodide();
                    } catch (err) {
                        onOutputChange(`Failed to load Python engine: ${err.message}`);
                        return;
                    }
                }

                let pyLogs = [];
                window.pyodide.setStdout({ batched: (str) => pyLogs.push(str) });
                window.pyodide.setStderr({ batched: (str) => pyLogs.push(str) });
                
                try {
                    await window.pyodide.runPythonAsync(code);
                    onOutputChange(pyLogs.join('\n') || "Executed without output.");
                } catch (err) {
                    onOutputChange(String(err));
                }
            } else if (["java", "cpp", "go", "rust"].includes(language)) {
                // Judge0 CE API integration
                const languageId = LANGUAGE_IDS[language];

                try {
                    const response = await fetch("https://ce.judge0.com/submissions?base64_encoded=false&wait=true", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                            source_code: code,
                            language_id: languageId
                        })
                    });

                    const data = await response.json();

                    if (data.status?.id === 6) { // Compilation Error
                        onOutputChange(`Compilation Error:\n${data.compile_output || "No details available."}`);
                    } else if (data.status?.id > 3) { // Other Errors
                        onOutputChange(`Error (${data.status.description}):\n${data.stderr || data.stdout || "No details available."}`);
                    } else {
                        onOutputChange(data.stdout || "Executed without output.");
                    }
                } catch (err) {
                    onOutputChange(`API Error: ${err.message}`);
                }
            } else {
                onOutputChange(`Execution for ${language} is not yet implemented.`);
            }
        } catch (err) {
            onOutputChange(`System Error: ${err.message}`);
        } finally {
            setIsRunning(false);
        }
    }, [code, language, onOutputChange]);

    return { isRunning, execute };
}
