import pty from 'node-pty';
const child = pty.spawn('python.exe', ['-u', 'test.py'], { cols: 80, rows: 25 });
child.onData(data => console.log('DATA:', JSON.stringify(data)));
setTimeout(() => child.write('Hello\r'), 1000);
setTimeout(() => process.exit(0), 3000);
