import pty from 'node-pty';
import os from 'os';
import fs from 'fs';
import path from 'path';

// Test 1: Direct python with -c flag
console.log("=== Test 1: python.exe -c ===");
const child1 = pty.spawn('python.exe', ['-u', '-c', 'print("hello world")'], {
    name: 'xterm-color',
    cols: 80,
    rows: 24,
    env: process.env
});
child1.onData(data => console.log('Test1 OUTPUT:', JSON.stringify(data)));
child1.onExit(({ exitCode }) => console.log('Test1 EXIT:', exitCode));

// Test 2: cmd.exe /c python 
setTimeout(() => {
    console.log("\n=== Test 2: cmd.exe /c python ===");
    const tempDir = path.join(process.cwd(), 'temp', 'test-run');
    fs.mkdirSync(tempDir, { recursive: true });
    fs.writeFileSync(path.join(tempDir, 'main.py'), 'print("hello from file")\na = input("Enter: ")\nprint("Got:", a)\n');

    const child2 = pty.spawn('cmd.exe', ['/c', 'python -u main.py'], {
        name: 'xterm-color',
        cols: 80,
        rows: 24,
        cwd: tempDir,
        env: process.env
    });
    child2.onData(data => console.log('Test2 OUTPUT:', JSON.stringify(data)));
    child2.onExit(({ exitCode }) => console.log('Test2 EXIT:', exitCode));
    
    setTimeout(() => {
        console.log('--- Sending "test\\r" ---');
        child2.write('test\r');
    }, 2000);
}, 1000);

setTimeout(() => process.exit(0), 8000);
