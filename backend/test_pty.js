import pty from 'node-pty';
console.log('Spawning cmd...');
const child = pty.spawn('cmd.exe', ['/c', 'python', '-u', 'test.py'], {cols:80, rows:25});
child.onData(data => console.log('PTY DATA:', JSON.stringify(data)));
setTimeout(() => { 
    console.log("Writing string to PTY...");
    child.write('123\r'); 
    child.write('1\r'); 
}, 1000);
setTimeout(() => process.exit(0), 4000);
