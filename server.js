const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

const sons = ['chien', 'chat', 'oiseau'];
const rooms = {};
const publicRooms = [];

function generateRoomCode() {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
}

app.use(express.static('public'));

io.on('connection', (socket) => {
    // ✅ FIX PRINCIPAL : Envoi IMMÉDIAT de la liste des rooms publiques à CHAQUE client
    socket.emit('public-rooms-update', publicRooms);
    console.log('📡 Liste rooms envoyée au client, nb:', publicRooms.length);

    // CRÉATION ROOM PUBLIQUE/PRIVÉE
    socket.on('create-room', (data) => {
        const { playerName, roomName, isPublic = true, maxPlayers = 8 } = data;
        const roomId = generateRoomCode();
        rooms[roomId] = {
            players: {},
            scores: {},
            currentSound: null,
            admin: socket.id,
            maxPlayers,
            isPublic,
            roomName
        };
        rooms[roomId].players[socket.id] = playerName;
        socket.join(roomId);

        if (isPublic) {
            const publicRoom = {
                id: roomId,
                code: roomId,
                name: rooms[roomId].roomName || `Room ${roomId}`,
                adminName: playerName,
                playerCount: 1,
                maxPlayers
            };
            publicRooms.push(publicRoom);
            console.log('🆕 Room publique créée:', publicRoom.name);
            io.emit('public-rooms-update', publicRooms); // À TOUS les clients
        }

        socket.emit('room-created', { roomId, code: roomId, isPublic });
        socket.emit('init-room', {
            roomId,
            myId: socket.id,
            players: rooms[roomId].players,
            scores: {},
            isAdmin: true
        });
    });

    // Rejoindre room
    socket.on('join-room', (data) => {
        const { roomId, playerName } = data;
        const room = rooms[roomId];
        if (!room) {
            socket.emit('error', 'Room inexistante');
            return;
        }
        if (Object.keys(room.players).length >= room.maxPlayers) {
            socket.emit('error', 'Room pleine');
            return;
        }
        if (Object.values(room.players).includes(playerName)) {
            socket.emit('error', 'Pseudo déjà pris');
            return;
        }
        room.players[socket.id] = playerName;
        socket.join(roomId);
        socket.emit('init-room', {
            roomId,
            myId: socket.id,
            players: room.players,
            scores: room.scores,
            isAdmin: false
        });
        io.to(roomId).emit('player-joined', { players: room.players, scores: room.scores });

        if (room.isPublic) {
            const publicRoom = publicRooms.find(r => r.id === roomId);
            if (publicRoom) {
                publicRoom.playerCount = Object.keys(room.players).length;
                io.emit('public-rooms-update', publicRooms);
            }
        }
    });

    socket.on('play-sound', (roomId) => {
        const room = rooms[roomId];
        if (room) {
            room.currentSound = sons[Math.floor(Math.random() * sons.length)];
            io.to(roomId).emit('sound-played', room.currentSound);
        }
    });

    socket.on('start-game', (roomId) => {
        const room = rooms[roomId];
        if (room && room.admin === socket.id && Object.keys(room.players).length >= 1) {
            room.currentSound = sons[Math.floor(Math.random() * sons.length)];
            io.to(roomId).emit('game-started', room.currentSound);
        }
    });

    socket.on('answer', (data) => {
        const { roomId, guess } = data;
        const room = rooms[roomId];
        if (!room || !room.currentSound) return;
        if (room.currentSound === guess) {
            room.scores[socket.id] = (room.scores[socket.id] || 0) + 1;
            io.to(roomId).emit('scores-update', { players: room.players, scores: room.scores });
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
                io.to(roomId).emit('player-left', { players: room.players, scores: room.scores });

                if (room.isPublic) {
                    const publicRoom = publicRooms.find(r => r.id === roomId);
                    if (publicRoom) {
                        publicRoom.playerCount = Object.keys(room.players).length;
                        io.emit('public-rooms-update', publicRooms);
                        if (publicRoom.playerCount === 0) {
                            publicRooms.splice(publicRooms.indexOf(publicRoom), 1);
                            io.emit('public-rooms-update', publicRooms);
                        }
                    }
                }

                if (Object.keys(room.players).length === 0) {
                    delete rooms[roomId];
                }
            }
        });
    });
});

server.listen(3000, () => {
    console.log('🚀 Serveur sur http://localhost:3000');
});
