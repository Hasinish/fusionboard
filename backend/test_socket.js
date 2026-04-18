const { Server } = require('socket.io');
const io = new Server(5002, { cors: { origin: '*' } });
io.on('connection', socket => {
    socket.on('terminal:spawn', () => {
        console.log('Spawn received!');
        socket.emit('terminal:data', '\r\nTest payload\r\n');
    });
    socket.on('terminal:data', data => {
        console.log('RECV:', JSON.stringify(data));
        socket.emit('terminal:data', data);
    });
});
console.log('Test Socket running on 5002...');
