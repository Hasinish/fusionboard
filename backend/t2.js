import pty from 'node-pty';
const child = pty.spawn('python.exe', ['-u', 'test.py'], { cols: 80, rows: 25 });
child.onData(data => console.log('DATA:', JSON.stringify(data)));
setTimeout(() => child.write('1\r'), 1000); // Only sending \r
setTimeout(() => process.exit(0), 3000);
