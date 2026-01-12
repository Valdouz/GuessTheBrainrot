const socket = io();
let roomId, playerName, myPlayerId;
const sons = ['chien', 'chat', 'oiseau'];

const lobbyScreen = document.getElementById('lobbyScreen');
const gameScreen = document.getElementById('gameScreen');
const playerNameInput = document.getElementById('playerNameInput');
const roomIdInput = document.getElementById('roomIdInput');
const joinBtn = document.getElementById('joinBtn');

joinBtn.onclick = () => {
    playerName = playerNameInput.value.trim() || 'Anonyme';
    roomId = roomIdInput.value.trim().toLowerCase() || 'general';
    if (playerName && roomId) {
        socket.emit('join-room', { roomId, playerName });
    }
};

socket.on('init-room', (data) => {
    myPlayerId = data.myId;
    lobbyScreen.style.display = 'none';
    gameScreen.style.display = 'block';
    document.getElementById('tour').textContent = `Room: ${data.roomId}`;
    updatePlayers(data.players, data.scores);
});

socket.on('error', (msg) => alert('Erreur: ' + msg));

socket.on('sound-played', (sound) => {
    document.getElementById('audioPlayer').src = `sounds/${sound}.mp3`;
    document.getElementById('audioPlayer').play();
    genererImages(sound);
});

socket.on('correct-answer', (data) => alert(`${data.players[data.player] || data.player} a trouvé !`));
socket.on('wrong-answer', (data) => alert(`${data.players[data.player] || data.player} s'est trompé.`));

document.getElementById('playSound').onclick = () => socket.emit('play-sound', roomId);

function genererImages(correctSound = null) {
    const imagesDiv = document.getElementById('images');
    imagesDiv.innerHTML = '';
    sons.forEach(nom => {
        const btn = document.createElement('img');
        btn.src = `images/${nom}.jpg`;
        btn.classList.add('image-btn');
        btn.alt = nom;
        btn.onclick = () => {
            socket.emit('answer', { roomId, guess: nom });
            document.querySelectorAll('.image-btn').forEach(img => img.style.pointerEvents = 'none');
            setTimeout(() => location.reload(), 2000); // Reset images
        };
        imagesDiv.appendChild(btn);
    });
}

function updatePlayers(players, scores = {}) {
    const ul = document.getElementById('playersUl');
    const countEl = document.getElementById('playerCount');
    ul.innerHTML = '';
    let count = 0;
    Object.keys(players).forEach(id => {
        const li = document.createElement('li');
        const score = scores[id] || 0;
        li.textContent = `${players[id]} (${score} pts)`;
        if (id === myPlayerId) li.classList.add('you');
        ul.appendChild(li);
        count++;
    });
    countEl.textContent = count;
    document.getElementById('score').textContent = `Room ${roomId} | ${count} joueurs`;
}

// Événements liste
socket.on('player-joined', (data) => updatePlayers(data.players, data.scores));
socket.on('player-left', (data) => updatePlayers(data.players, data.scores));
socket.on('scores-update', (data) => updatePlayers(data.players, data.scores));
