const socket = io();
let roomId, myPlayerId, isAdmin = false, myPseudo = '', isPublicRoom = true;

const sons = ['chien', 'chat', 'oiseau'];
const pseudoScreen = document.getElementById('pseudoScreen');
const lobbyScreen = document.getElementById('lobbyScreen');
const gameScreen = document.getElementById('gameScreen');
const playerCountEl = document.getElementById('playerCount');

// FIX URL Rejoindre direct
function initFromUrl() {
    const urlParams = new URLSearchParams(window.location.search);
    const roomFromUrl = urlParams.get('room');
    if (roomFromUrl && myPseudo) {
        document.getElementById('joinRoomCode').value = roomFromUrl.toUpperCase();
        document.getElementById('joinByCodeBtn').click();
    }
}

// Écran pseudo
document.getElementById('setPseudoBtn').onclick = () => {
    myPseudo = document.getElementById('globalPseudoInput').value.trim();
    if (myPseudo) {
        pseudoScreen.style.display = 'none';
        lobbyScreen.style.display = 'flex';
        setTimeout(initFromUrl, 500);
    } else {
        alert('Entre un pseudo !');
    }
};

// Toggle publique/privée
document.getElementById('roomTypeToggle').onchange = (e) => {
    isPublicRoom = !e.target.checked;
    const label = document.getElementById('roomTypeLabel');
    const privateCode = document.getElementById('privateCode');
    if (isPublicRoom) {
        label.textContent = 'Publique';
        label.className = 'publique';
        privateCode.style.display = 'none';
    } else {
        label.textContent = 'Privée';
        label.className = 'privee';
        privateCode.style.display = 'block';
        privateCode.textContent = 'Code privé généré après création';
    }
};

// Créer room
document.getElementById('createRoomBtn').onclick = () => {
    const roomName = document.getElementById('roomNameInput').value.trim();
    const data = { playerName: myPseudo, roomName, isPublic: isPublicRoom };
    socket.emit('create-room', data);
};

// Récupère vrai code
socket.on('room-created', (data) => {
    const privateCode = document.getElementById('privateCode');
    if (!data.isPublic) {
        privateCode.innerHTML = `<strong>${data.code}</strong><br><small>Copie ce code pour tes amis !</small>`;
        privateCode.style.color = '#2196F3';
        privateCode.style.fontSize = '20px';
    }
});

// Rejoindre
document.getElementById('joinByCodeBtn').onclick = () => {
    const code = document.getElementById('joinRoomCode').value.trim().toUpperCase();
    if (code && myPseudo) {
        socket.emit('join-room', { roomId: code, playerName: myPseudo });
    } else {
        alert('Code ou pseudo manquant !');
    }
};

// Liste des rooms publiques - CORRIGÉ
socket.on('public-rooms-update', (roomsList) => {
    const listDiv = document.getElementById('publicRoomsList');
    if (roomsList.length === 0) {
        listDiv.innerHTML = '<p>Aucune room publique</p>';
        return;
    }
    listDiv.innerHTML = '';
    roomsList.forEach(room => {
        const btn = document.createElement('button');
        btn.className = 'room-btn';
        if (room.playerCount >= room.maxPlayers) {
            btn.classList.add('full');
        }
        btn.innerHTML = `
      <strong>${room.name}</strong><br>
      <small>Admin: ${room.adminName}</small><br>
      <small>${room.playerCount}/${room.maxPlayers} joueurs</small><br>
      <small>Code: ${room.code}</small>
    `;
        btn.onclick = () => {
            if (myPseudo) {
                socket.emit('join-room', { roomId: room.code, playerName: myPseudo });
            }
        };
        listDiv.appendChild(btn);
    });
});

// initFromUrl Check URL après refresh rooms

// Update joueurs temps réel
function updatePlayers(players, scores) {
    const ul = document.getElementById('playersUl');
    const countEl = document.getElementById('playerCount');
    ul.innerHTML = '';
    let count = 0;
    Object.keys(players).forEach(id => {
        const li = document.createElement('li');
        li.textContent = `${players[id]} (${scores[id] || 0} pts)`;
        if (id === myPlayerId) {
            li.classList.add('you');
        }
        ul.appendChild(li);
        count++;
    });
    countEl.textContent = count;
}

socket.on('player-joined', (data) => updatePlayers(data.players, data.scores));
socket.on('player-left', (data) => updatePlayers(data.players, data.scores));
socket.on('scores-update', (data) => updatePlayers(data.players, data.scores));

socket.on('init-room', (data) => {
    roomId = data.roomId;
    myPlayerId = data.myId;
    isAdmin = data.isAdmin;
    lobbyScreen.style.display = 'none';
    gameScreen.style.display = 'flex';
    document.getElementById('roomTitle').textContent = `Room ${roomId}`;
    updatePlayers(data.players, data.scores);
    // Nettoie URL
    window.history.replaceState({}, document.title, window.location.pathname);
});

socket.on('error', (msg) => alert(msg));

document.getElementById('playSound').onclick = () => socket.emit('play-sound', roomId);
document.getElementById('startGameBtn').onclick = () => {
    if (isAdmin) socket.emit('start-game', roomId);
};

socket.on('sound-played', (sound) => {
    document.getElementById('audioPlayer').src = `sons/${sound}.mp3`;
    document.getElementById('audioPlayer').play();
    document.getElementById('playSound').style.display = 'none';
    genererImages(sound);
});

socket.on('game-started', (sound) => {
    document.getElementById('audioPlayer').src = `sons/${sound}.mp3`;
    document.getElementById('audioPlayer').play();
    genererImages(sound);
});

document.getElementById('images').onclick = (e) => {
    if (e.target.classList.contains('image-btn')) {
        const guess = e.target.alt;
        socket.emit('answer', { roomId, guess });
        document.querySelectorAll('.image-btn').forEach(img => img.style.pointerEvents = 'none');
    }
};

function genererImages(sound) {
    const imagesDiv = document.getElementById('images');
    imagesDiv.innerHTML = '';
    sons.forEach(nom => {
        const img = document.createElement('img');
        img.src = `images/${nom}.jpg`;
        img.classList.add('image-btn');
        img.alt = nom;
        img.title = nom;
        imagesDiv.appendChild(img);
    });
}

socket.on('correct-answer', (data) => alert('Correct !'));
socket.on('wrong-answer', (data) => alert('Faux !'));
