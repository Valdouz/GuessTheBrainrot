const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

const sons = ['chien', 'chat', 'oiseau']; // Noms des sons (doit matcher client)

const rooms = {}; // { roomId: { players: {socketId: 'pseudo'}, currentSound: null, scores: {socketId: score} } }

app.use(express.static('public')); // Serve public/

io.on('connection', (socket) => {
    socket.on('join-room', (data) => {
        const { roomId, playerName } = data;
        if (!rooms[roomId]) {
            rooms[roomId] = {
                players: {},
                currentSound: null,
                scores: {}
            };
        }

        // Vérif pseudo unique simple (optionnel)
        if (Object.values(rooms[roomId].players).includes(playerName)) {
            socket.emit('error', 'Pseudo déjà pris !');
            return;
        }

        rooms[roomId].players[socket.id] = playerName;
        socket.join(roomId);

        // Init pour nouveau joueur
        socket.emit('init-room', {
            roomId,
            myId: socket.id,
            players: rooms[roomId].players,
            scores: rooms[roomId].scores
        });

        // Broadcast à tous (inclut nouveau)
        io.to(roomId).emit('player-joined', {
            players: rooms[roomId].players,
            scores: rooms[roomId].scores
        });
    });

    socket.on('play-sound', (roomId) => {
        const room = rooms[roomId];
        if (room) {
            room.currentSound = sons[Math.floor(Math.random() * sons.length)];
            io.to(roomId).emit('sound-played', room.currentSound);
        }
    });

    socket.on('answer', (data) => {
        const { roomId, guess } = data;
        const room = rooms[roomId];
        if (!room || !room.currentSound) return;

        if (room.currentSound === guess) {
            room.scores[socket.id] = (room.scores[socket.id] || 0) + 1;
            io.to(roomId).emit('scores-update', {
                players: room.players,
                scores: room.scores
            });
            io.to(roomId).emit('correct-answer', { player: socket.id });
        } else {
            io.to(roomId).emit('wrong-answer', { player: socket.id });
        }
    });

    socket.on('disconnect', () => {
        Object.keys(rooms).forEach(roomId => {
            const room = rooms[roomId];
            if (room.players[socket.id]) {
                delete room.players[socket.id];
                delete room.scores[socket.id];
                io.to(roomId).emit('player-left', {
                    players: room.players,
                    scores: room.scores
                });
                if (Object.keys(room.players).length === 0) {
                    delete rooms[roomId];
                }
            }
        });
    });
});

server.listen(3000, () => {
    console.log('Serveur multijoueur sur http://localhost:3000');
    console.log('Utilisation: ?room=abc123');
});
