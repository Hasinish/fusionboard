import pty from "node-pty";
import os from "os";
import fs from "fs";
import path from "path";
import crypto from "crypto";

// For tracking active PTY processes
const activeTerminals = new Map();

export const handleTerminalConnection = (socket) => {
    socket.on("terminal:spawn", async ({ language, code, cols = 80, rows = 24 }) => {
        const id = crypto.randomUUID();
        const tempDir = path.join(process.cwd(), "temp", id);
        
        try {
            if (!fs.existsSync(tempDir)) {
                fs.mkdirSync(tempDir, { recursive: true });
            }

            let filename = "";
            let commandString = "";

            const trimmedCode = code.trim();

            if (language === "python") {
                filename = "main.py";
                fs.writeFileSync(path.join(tempDir, filename), trimmedCode);
                commandString = `python -u main.py`;
            } else if (language === "javascript") {
                filename = "main.js";
                fs.writeFileSync(path.join(tempDir, filename), trimmedCode);
                commandString = `node main.js`;
            } else if (language === "cpp") {
                filename = "main.cpp";
                fs.writeFileSync(path.join(tempDir, filename), trimmedCode);
                commandString = os.platform() === 'win32' ? `g++ main.cpp -o main.exe && ./main.exe` : `g++ main.cpp -o main && ./main`;
            } else if (language === "java") {
                filename = "Main.java";
                fs.writeFileSync(path.join(tempDir, filename), trimmedCode);
                commandString = `javac Main.java && java Main`;
            } else if (language === "go") {
                filename = "main.go";
                fs.writeFileSync(path.join(tempDir, filename), trimmedCode);
                commandString = `go run main.go`;
            } else if (language === "rust") {
                filename = "main.rs";
                fs.writeFileSync(path.join(tempDir, filename), trimmedCode);
                commandString = os.platform() === 'win32' ? `rustc main.rs && ./main.exe` : `rustc main.rs && ./main`;
            }

            const env = { ...process.env, PYTHONUNBUFFERED: "1" };
            
            // On Windows, if javac isn't in PATH, try to find the standard Microsoft OpenJDK path
            if (os.platform() === 'win32' && language === 'java') {
                const msJdkPath = "C:\\Program Files\\Microsoft";
                if (fs.existsSync(msJdkPath)) {
                    const dirs = fs.readdirSync(msJdkPath);
                    const jdkDir = dirs.find(d => d.startsWith('jdk-'));
                    if (jdkDir) {
                        const binPath = path.join(msJdkPath, jdkDir, 'bin');
                        if (fs.existsSync(binPath)) {
                            // Append to PATH
                            env.PATH = `${binPath}${path.delimiter}${env.PATH || ''}`;
                        }
                    }
                }
            }

            const isWin = os.platform() === 'win32';
            const shell = isWin ? 'cmd.exe' : 'bash';

            // Use python3 on Linux
            let finalCommand = commandString;
            if (language === 'python' && !isWin) {
                finalCommand = commandString.replace(/^python/, 'python3');
            }

            // Run command directly — no interactive shell, no prompt noise
            const shellArgs = isWin ? ['/Q', '/C', finalCommand] : ['-c', finalCommand];

            const ptyProcess = pty.spawn(shell, shellArgs, {
                name: "xterm-color",
                cols: cols,
                rows: rows,
                cwd: tempDir,
                env
            });

            activeTerminals.set(socket.id, ptyProcess);

            ptyProcess.onData((data) => {
                socket.emit("terminal:data", data);
            });

            // Emit ready quickly — no startup noise with -c / /C
            setTimeout(() => {
                if (socket.connected) {
                    socket.emit("terminal:ready");
                }
            }, 100);

            ptyProcess.onExit(({ exitCode }) => {
                // Send styled exit message through the DATA stream (guarantees ordering)
                const msg = exitCode === 0
                    ? `\r\n\x1b[38;5;10m✔ Execution ended successfully.\x1b[0m\r\n`
                    : `\r\n\x1b[38;5;9m✘ Execution ended with exit code ${exitCode}.\x1b[0m\r\n`;
                socket.emit("terminal:data", msg);
                activeTerminals.delete(socket.id);
                setTimeout(() => {
                    fs.rm(tempDir, { recursive: true, force: true }, () => {});
                }, 2000);
            });

        } catch (err) {
            console.error("Failed to spawn terminal:", err);
            socket.emit("terminal:data", `\x1b[31m[Error] Failed to spawn: ${err.message}\x1b[0m\r\n`);
        }
    });

    socket.on("terminal:data", (data) => {
        const ptyProcess = activeTerminals.get(socket.id);
        if (ptyProcess) {
            ptyProcess.write(data);
        }
    });

    socket.on("terminal:resize", ({ cols, rows }) => {
        const ptyProcess = activeTerminals.get(socket.id);
        if (ptyProcess) {
            try { ptyProcess.resize(cols, rows); } catch(e) {}
        }
    });

    socket.on("disconnect", () => {
        const ptyProcess = activeTerminals.get(socket.id);
        if (ptyProcess) {
            ptyProcess.kill();
            activeTerminals.delete(socket.id);
        }
    });
};
