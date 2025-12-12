// Simple WebSocket server for Sudoku Duel with invites
// Run with: node server/wsServer.js

import { WebSocketServer } from 'ws';
import { createServer } from 'http';

const PORT = process.env.PORT || 8080;

const server = createServer();
const wss = new WebSocketServer({ server });

// Game rooms
const rooms = new Map();
const playerToRoom = new Map();
const allPlayers = new Map(); // Track all connected players
const waitingPlayers = new Map(); // Players waiting in lobby with names

// Generate unique IDs
const generateId = () => Math.random().toString(36).substr(2, 9);

// ============ SUDOKU GENERATOR ============
const shuffleArray = (array) => {
    const newArray = [...array];
    for (let i = newArray.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
    }
    return newArray;
};

const generateSolution = () => {
    const board = Array(9).fill(null).map(() => Array(9).fill(0));

    const isValid = (num, row, col) => {
        for (let i = 0; i < 9; i++) {
            if (board[row][i] === num) return false;
        }
        for (let i = 0; i < 9; i++) {
            if (board[i][col] === num) return false;
        }
        const boxRow = Math.floor(row / 3) * 3;
        const boxCol = Math.floor(col / 3) * 3;
        for (let i = 0; i < 3; i++) {
            for (let j = 0; j < 3; j++) {
                if (board[boxRow + i][boxCol + j] === num) return false;
            }
        }
        return true;
    };

    const fillBoard = () => {
        for (let i = 0; i < 9; i++) {
            for (let j = 0; j < 9; j++) {
                if (board[i][j] === 0) {
                    const nums = shuffleArray([1, 2, 3, 4, 5, 6, 7, 8, 9]);
                    for (const num of nums) {
                        if (isValid(num, i, j)) {
                            board[i][j] = num;
                            if (fillBoard()) return true;
                            board[i][j] = 0;
                        }
                    }
                    return false;
                }
            }
        }
        return true;
    };

    fillBoard();
    return board;
};

const generateSudoku = () => {
    const solution = generateSolution();
    const puzzle = solution.map(row => [...row]);

    const positions = [];
    for (let i = 0; i < 9; i++) {
        for (let j = 0; j < 9; j++) {
            positions.push([i, j]);
        }
    }

    const shuffledPositions = shuffleArray(positions);
    for (let i = 0; i < 45; i++) {
        const [row, col] = shuffledPositions[i];
        puzzle[row][col] = 0;
    }

    return { puzzle, solution };
};
// ============ END SUDOKU GENERATOR ============

// Get stats and waiting players list
const getStats = () => {
    const waitingList = [];
    for (const [id, player] of waitingPlayers.entries()) {
        waitingList.push({
            id,
            name: player.name
        });
    }

    return {
        onlinePlayers: allPlayers.size,
        waitingPlayers: waitingList.length,
        waitingPlayersList: waitingList
    };
};

// Broadcast stats to all connected players
const broadcastStats = () => {
    const stats = getStats();
    const message = JSON.stringify({
        type: 'stats_update',
        ...stats
    });

    for (const [, ws] of allPlayers.entries()) {
        try {
            ws.send(message);
        } catch (e) {
            // Ignore send errors
        }
    }
};

wss.on('connection', (ws) => {
    const playerId = generateId();
    ws.playerId = playerId;
    allPlayers.set(playerId, ws);

    console.log(`Player connected: ${playerId}`);

    const stats = getStats();

    ws.send(JSON.stringify({
        type: 'connected',
        playerId,
        ...stats
    }));

    broadcastStats();

    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message);
            handleMessage(ws, data);
        } catch (e) {
            console.error('Failed to parse message:', e);
        }
    });

    ws.on('close', () => {
        console.log(`Player disconnected: ${playerId}`);
        allPlayers.delete(playerId);
        waitingPlayers.delete(playerId);
        handlePlayerDisconnect(ws);
        broadcastStats();
    });
});

function handleMessage(ws, data) {
    switch (data.type) {
        case 'get_stats':
            ws.send(JSON.stringify({
                type: 'stats_update',
                ...getStats()
            }));
            break;
        case 'join_lobby':
            handleJoinLobby(ws, data.playerName);
            break;
        case 'leave_lobby':
            handleLeaveLobby(ws);
            break;
        case 'invite_player':
            handleInvitePlayer(ws, data.targetPlayerId);
            break;
        case 'accept_invite':
            handleAcceptInvite(ws, data.fromPlayerId);
            break;
        case 'decline_invite':
            handleDeclineInvite(ws, data.fromPlayerId);
            break;
        case 'join_room':
            handleJoinRoom(ws, data.playerName);
            break;
        case 'leave_room':
            handleLeaveRoom(ws);
            break;
        case 'move':
            handleMove(ws, data);
            break;
        case 'chat':
            handleChat(ws, data.content);
            break;
        case 'voice':
            handleVoice(ws, data.audioData);
            break;
        case 'voice_data':
            handleVoiceData(ws, data.audioData);
            break;
        case 'voice_offer':
        case 'voice_answer':
        case 'voice_ice_candidate':
        case 'voice_start':
        case 'voice_stop':
            handleWebRTCSignaling(ws, data);
            break;
    }
}

function handleJoinLobby(ws, playerName) {
    // Add player to waiting list
    waitingPlayers.set(ws.playerId, {
        name: playerName || 'Player',
        ws
    });

    // Notify the player they joined the lobby
    ws.send(JSON.stringify({
        type: 'lobby_joined',
        ...getStats()
    }));

    // Broadcast updated stats to everyone
    broadcastStats();
}

function handleLeaveLobby(ws) {
    waitingPlayers.delete(ws.playerId);
    broadcastStats();
}

function handleInvitePlayer(ws, targetPlayerId) {
    const targetPlayer = waitingPlayers.get(targetPlayerId);
    const senderPlayer = waitingPlayers.get(ws.playerId);

    if (!targetPlayer || !senderPlayer) {
        ws.send(JSON.stringify({
            type: 'invite_error',
            message: 'Player not found or not available'
        }));
        return;
    }

    // Send invite to target player
    targetPlayer.ws.send(JSON.stringify({
        type: 'invite_received',
        fromPlayerId: ws.playerId,
        fromPlayerName: senderPlayer.name
    }));

    // Confirm to sender
    ws.send(JSON.stringify({
        type: 'invite_sent',
        toPlayerId: targetPlayerId,
        toPlayerName: targetPlayer.name
    }));
}

function handleAcceptInvite(ws, fromPlayerId) {
    const inviterPlayer = waitingPlayers.get(fromPlayerId);
    const accepterPlayer = waitingPlayers.get(ws.playerId);

    if (!inviterPlayer || !accepterPlayer) {
        ws.send(JSON.stringify({
            type: 'invite_error',
            message: 'Player not found or not available'
        }));
        return;
    }

    // Remove both from waiting list
    waitingPlayers.delete(fromPlayerId);
    waitingPlayers.delete(ws.playerId);

    // Create a new room for both
    const roomId = generateId();
    const room = {
        id: roomId,
        players: [],
        gameStarted: true,
        puzzle: null,
        solution: null,
        board: null,
        cellOwners: {}
    };
    rooms.set(roomId, room);

    // Add both players to room
    const player1 = {
        id: fromPlayerId,
        name: inviterPlayer.name,
        ws: inviterPlayer.ws,
        score: 0,
        lives: 2,
        eliminated: false
    };

    const player2 = {
        id: ws.playerId,
        name: accepterPlayer.name,
        ws,
        score: 0,
        lives: 2,
        eliminated: false
    };

    room.players.push(player1, player2);
    playerToRoom.set(fromPlayerId, roomId);
    playerToRoom.set(ws.playerId, roomId);

    // Generate puzzle
    const { puzzle, solution } = generateSudoku();
    room.puzzle = puzzle;
    room.solution = solution;
    room.board = puzzle.map(row => [...row]);
    room.cellOwners = {};

    // Notify both players
    const gameStartMessage = {
        type: 'game_start',
        gameState: {
            puzzle: room.puzzle,
            solution: room.solution,
            board: room.board,
            cellOwners: room.cellOwners,
            startTime: Date.now()
        },
        players: room.players.map(p => ({
            id: p.id,
            name: p.name,
            score: p.score,
            lives: p.lives,
            eliminated: p.eliminated
        }))
    };

    inviterPlayer.ws.send(JSON.stringify({
        type: 'invite_accepted',
        byPlayerName: accepterPlayer.name
    }));

    // Send game start to both
    inviterPlayer.ws.send(JSON.stringify(gameStartMessage));
    ws.send(JSON.stringify(gameStartMessage));

    broadcastStats();
}

function handleDeclineInvite(ws, fromPlayerId) {
    const inviterPlayer = waitingPlayers.get(fromPlayerId);

    if (inviterPlayer) {
        inviterPlayer.ws.send(JSON.stringify({
            type: 'invite_declined',
            byPlayerId: ws.playerId
        }));
    }
}

function handleJoinRoom(ws, playerName) {
    let roomId = null;
    let room = null;

    for (const [id, r] of rooms.entries()) {
        if (r.players.length < 2 && !r.gameStarted) {
            roomId = id;
            room = r;
            break;
        }
    }

    if (!room) {
        roomId = generateId();
        room = {
            id: roomId,
            players: [],
            gameStarted: false,
            puzzle: null,
            solution: null,
            board: null,
            cellOwners: {}
        };
        rooms.set(roomId, room);
    }

    const player = {
        id: ws.playerId,
        name: playerName || 'Player',
        ws,
        score: 0,
        lives: 2,
        eliminated: false
    };

    room.players.push(player);
    playerToRoom.set(ws.playerId, roomId);

    // Remove from waiting list if was there
    waitingPlayers.delete(ws.playerId);

    ws.send(JSON.stringify({
        type: 'room_joined',
        roomId,
        players: room.players.map(p => ({
            id: p.id,
            name: p.name,
            score: p.score,
            lives: p.lives,
            eliminated: p.eliminated
        }))
    }));

    broadcastToRoom(roomId, {
        type: 'player_joined',
        players: room.players.map(p => ({
            id: p.id,
            name: p.name,
            score: p.score,
            lives: p.lives,
            eliminated: p.eliminated
        }))
    }, ws.playerId);

    broadcastStats();

    if (room.players.length >= 2) {
        room.gameStarted = true;

        const { puzzle, solution } = generateSudoku();
        room.puzzle = puzzle;
        room.solution = solution;
        room.board = puzzle.map(row => [...row]);
        room.cellOwners = {};

        broadcastToRoom(roomId, {
            type: 'game_start',
            gameState: {
                puzzle: room.puzzle,
                solution: room.solution,
                board: room.board,
                cellOwners: room.cellOwners,
                startTime: Date.now()
            }
        });

        broadcastStats();
    }
}

function handleLeaveRoom(ws) {
    handlePlayerDisconnect(ws);
    waitingPlayers.delete(ws.playerId);
    broadcastStats();
}

function handlePlayerDisconnect(ws) {
    const roomId = playerToRoom.get(ws.playerId);
    if (!roomId) return;

    const room = rooms.get(roomId);
    if (!room) return;

    room.players = room.players.filter(p => p.id !== ws.playerId);
    playerToRoom.delete(ws.playerId);

    if (room.players.length === 0) {
        rooms.delete(roomId);
    } else {
        broadcastToRoom(roomId, {
            type: 'player_left',
            playerId: ws.playerId,
            players: room.players.map(p => ({
                id: p.id,
                name: p.name,
                score: p.score,
                lives: p.lives,
                eliminated: p.eliminated
            }))
        });
    }
}

function handleMove(ws, data) {
    const roomId = playerToRoom.get(ws.playerId);
    if (!roomId) return;

    const room = rooms.get(roomId);
    if (!room) return;

    const player = room.players.find(p => p.id === ws.playerId);
    if (!player) return;

    if (player.eliminated) return;

    const { row, col, value } = data;

    if (room.board[row][col] !== 0) return;

    const isCorrect = room.solution[row][col] === value;

    if (isCorrect) {
        room.board[row][col] = value;
        room.cellOwners[`${row}-${col}`] = ws.playerId;
        player.score += 10;

        let isComplete = true;
        for (let i = 0; i < 9 && isComplete; i++) {
            for (let j = 0; j < 9 && isComplete; j++) {
                if (room.board[i][j] === 0) isComplete = false;
            }
        }

        if (isComplete) {
            const winner = [...room.players].sort((a, b) => b.score - a.score)[0];
            broadcastToRoom(roomId, {
                type: 'game_over',
                reason: 'complete',
                winner: { name: winner.name, score: winner.score },
                players: room.players.map(p => ({
                    id: p.id,
                    name: p.name,
                    score: p.score,
                    lives: p.lives,
                    eliminated: p.eliminated
                }))
            });
            return;
        }
    } else {
        player.lives--;
        if (player.lives <= 0) {
            player.eliminated = true;

            const activePlayers = room.players.filter(p => !p.eliminated);
            if (activePlayers.length === 0) {
                const winner = [...room.players].sort((a, b) => b.score - a.score)[0];
                broadcastToRoom(roomId, {
                    type: 'game_over',
                    reason: 'all_eliminated',
                    winner: { name: winner.name, score: winner.score },
                    players: room.players.map(p => ({
                        id: p.id,
                        name: p.name,
                        score: p.score,
                        lives: p.lives,
                        eliminated: p.eliminated
                    }))
                });
                return;
            }
        }
    }

    broadcastToRoom(roomId, {
        type: 'move_made',
        playerId: ws.playerId,
        playerName: player.name,
        row,
        col,
        value,
        isCorrect,
        board: room.board,
        cellOwners: room.cellOwners,
        players: room.players.map(p => ({
            id: p.id,
            name: p.name,
            score: p.score,
            lives: p.lives,
            eliminated: p.eliminated
        }))
    });
}

function handleChat(ws, content) {
    const roomId = playerToRoom.get(ws.playerId);
    if (!roomId) return;

    const room = rooms.get(roomId);
    if (!room) return;

    const player = room.players.find(p => p.id === ws.playerId);
    if (!player) return;

    broadcastToRoom(roomId, {
        type: 'chat_message',
        message: {
            senderId: ws.playerId,
            senderName: player.name,
            content,
            timestamp: Date.now()
        }
    });
}

function handleVoice(ws, audioData) {
    const roomId = playerToRoom.get(ws.playerId);
    if (!roomId) return;

    const room = rooms.get(roomId);
    if (!room) return;

    const player = room.players.find(p => p.id === ws.playerId);
    if (!player) return;

    broadcastToRoom(roomId, {
        type: 'voice_message',
        message: {
            senderId: ws.playerId,
            senderName: player.name,
            audioData,
            timestamp: Date.now()
        }
    });
}

function handleVoiceData(ws, audioData) {
    const roomId = playerToRoom.get(ws.playerId);
    if (!roomId) return;

    const room = rooms.get(roomId);
    if (!room) return;

    const player = room.players.find(p => p.id === ws.playerId);
    if (!player) return;

    // Broadcast the voice data to other players in the room
    broadcastToRoom(roomId, {
        type: 'voice_data',
        senderId: ws.playerId,
        senderName: player.name,
        audioData,
        timestamp: Date.now()
    }, ws.playerId); // Exclude sender
}

function handleWebRTCSignaling(ws, data) {
    const roomId = playerToRoom.get(ws.playerId);
    if (!roomId) return;

    const room = rooms.get(roomId);
    if (!room) return;

    broadcastToRoom(roomId, {
        type: data.type,
        senderId: ws.playerId,
        ...data
    }, ws.playerId);
}

function broadcastToRoom(roomId, message, excludePlayerId = null) {
    const room = rooms.get(roomId);
    if (!room) return;

    const messageStr = JSON.stringify(message);

    room.players.forEach(player => {
        if (player.id !== excludePlayerId) {
            try {
                player.ws.send(messageStr);
            } catch (e) {
                console.error(`Failed to send to player ${player.id}:`, e);
            }
        }
    });
}

server.listen(PORT, () => {
    console.log(`WebSocket server running on port ${PORT}`);
});
