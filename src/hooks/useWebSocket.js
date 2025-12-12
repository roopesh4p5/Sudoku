import { useState, useEffect, useCallback, useRef } from 'react';

// WebSocket server URL
const WS_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:8080';

export const useWebSocket = () => {
    const [isConnected, setIsConnected] = useState(false);
    const [roomId, setRoomId] = useState(null);
    const [players, setPlayers] = useState([]);
    const [onlinePlayers, setOnlinePlayers] = useState(0);
    const [waitingPlayers, setWaitingPlayers] = useState(0);
    const [waitingPlayersList, setWaitingPlayersList] = useState([]);
    const [gameState, setGameState] = useState(null);
    const [messages, setMessages] = useState([]);
    const [playerId, setPlayerId] = useState(null);
    const [pendingInvite, setPendingInvite] = useState(null);
    const wsRef = useRef(null);
    const reconnectTimeoutRef = useRef(null);
    const messageHandlersRef = useRef({});

    const connect = useCallback(() => {
        if (wsRef.current?.readyState === WebSocket.OPEN) return;

        try {
            wsRef.current = new WebSocket(WS_URL);

            wsRef.current.onopen = () => {
                setIsConnected(true);
                console.log('WebSocket connected');
            };

            wsRef.current.onclose = () => {
                setIsConnected(false);
                setOnlinePlayers(0);
                setWaitingPlayers(0);
                setWaitingPlayersList([]);
                console.log('WebSocket disconnected');

                reconnectTimeoutRef.current = setTimeout(() => {
                    connect();
                }, 3000);
            };

            wsRef.current.onerror = (error) => {
                console.error('WebSocket error:', error);
            };

            wsRef.current.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    handleMessage(data);
                } catch (e) {
                    console.error('Failed to parse message:', e);
                }
            };
        } catch (e) {
            console.error('Failed to connect:', e);
        }
    }, []);

    const handleMessage = useCallback((data) => {
        switch (data.type) {
            case 'connected':
                setPlayerId(data.playerId);
                setOnlinePlayers(data.onlinePlayers || 0);
                setWaitingPlayers(data.waitingPlayers || 0);
                setWaitingPlayersList(data.waitingPlayersList || []);
                break;
            case 'stats_update':
                setOnlinePlayers(data.onlinePlayers || 0);
                setWaitingPlayers(data.waitingPlayers || 0);
                setWaitingPlayersList(data.waitingPlayersList || []);
                break;
            case 'lobby_joined':
                setWaitingPlayersList(data.waitingPlayersList || []);
                if (messageHandlersRef.current.onLobbyJoined) {
                    messageHandlersRef.current.onLobbyJoined(data);
                }
                break;
            case 'invite_received':
                setPendingInvite({
                    fromPlayerId: data.fromPlayerId,
                    fromPlayerName: data.fromPlayerName
                });
                if (messageHandlersRef.current.onInviteReceived) {
                    messageHandlersRef.current.onInviteReceived(data);
                }
                break;
            case 'invite_sent':
                if (messageHandlersRef.current.onInviteSent) {
                    messageHandlersRef.current.onInviteSent(data);
                }
                break;
            case 'invite_accepted':
                if (messageHandlersRef.current.onInviteAccepted) {
                    messageHandlersRef.current.onInviteAccepted(data);
                }
                break;
            case 'invite_declined':
                if (messageHandlersRef.current.onInviteDeclined) {
                    messageHandlersRef.current.onInviteDeclined(data);
                }
                break;
            case 'invite_error':
                if (messageHandlersRef.current.onInviteError) {
                    messageHandlersRef.current.onInviteError(data);
                }
                break;
            case 'room_joined':
                setRoomId(data.roomId);
                setPlayers(data.players);
                break;
            case 'player_joined':
                setPlayers(data.players);
                if (messageHandlersRef.current.onPlayerJoined) {
                    messageHandlersRef.current.onPlayerJoined(data);
                }
                break;
            case 'player_left':
                setPlayers(data.players);
                break;
            case 'game_start':
                setGameState(data.gameState);
                if (data.players) {
                    setPlayers(data.players);
                }
                if (messageHandlersRef.current.onGameStart) {
                    messageHandlersRef.current.onGameStart(data);
                }
                break;
            case 'game_update':
                setGameState(data.gameState);
                break;
            case 'move_made':
                if (messageHandlersRef.current.onMoveMade) {
                    messageHandlersRef.current.onMoveMade(data);
                }
                break;
            case 'chat_message':
                if (messageHandlersRef.current.onChatMessage) {
                    messageHandlersRef.current.onChatMessage(data.message);
                }
                break;
            case 'voice_message':
                if (messageHandlersRef.current.onChatMessage) {
                    messageHandlersRef.current.onChatMessage({ ...data.message, isVoice: true });
                }
                break;
            case 'game_over':
                if (messageHandlersRef.current.onGameOver) {
                    messageHandlersRef.current.onGameOver(data);
                }
                break;
            case 'voice_offer':
                if (messageHandlersRef.current.onVoiceOffer) {
                    messageHandlersRef.current.onVoiceOffer(data);
                }
                break;
            case 'voice_answer':
                if (messageHandlersRef.current.onVoiceAnswer) {
                    messageHandlersRef.current.onVoiceAnswer(data);
                }
                break;
            case 'voice_ice_candidate':
                if (messageHandlersRef.current.onVoiceIceCandidate) {
                    messageHandlersRef.current.onVoiceIceCandidate(data);
                }
                break;
            case 'voice_start':
                if (messageHandlersRef.current.onVoiceStart) {
                    messageHandlersRef.current.onVoiceStart(data);
                }
                break;
            case 'voice_stop':
                if (messageHandlersRef.current.onVoiceStop) {
                    messageHandlersRef.current.onVoiceStop(data);
                }
                break;
            case 'voice_data':
                if (messageHandlersRef.current.onVoiceData) {
                    messageHandlersRef.current.onVoiceData(data);
                }
                break;
            default:
                break;
        }
    }, []);

    const disconnect = useCallback(() => {
        if (reconnectTimeoutRef.current) {
            clearTimeout(reconnectTimeoutRef.current);
        }
        if (wsRef.current) {
            wsRef.current.close();
            wsRef.current = null;
        }
        setIsConnected(false);
        setRoomId(null);
        setPlayers([]);
        setGameState(null);
        setMessages([]);
        setOnlinePlayers(0);
        setWaitingPlayers(0);
        setWaitingPlayersList([]);
        setPendingInvite(null);
    }, []);

    const send = useCallback((data) => {
        if (wsRef.current?.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify(data));
        }
    }, []);

    const getStats = useCallback(() => {
        send({ type: 'get_stats' });
    }, [send]);

    const joinLobby = useCallback((playerName) => {
        send({ type: 'join_lobby', playerName });
    }, [send]);

    const leaveLobby = useCallback(() => {
        send({ type: 'leave_lobby' });
    }, [send]);

    const invitePlayer = useCallback((targetPlayerId) => {
        send({ type: 'invite_player', targetPlayerId });
    }, [send]);

    const acceptInvite = useCallback((fromPlayerId) => {
        send({ type: 'accept_invite', fromPlayerId });
        setPendingInvite(null);
    }, [send]);

    const declineInvite = useCallback((fromPlayerId) => {
        send({ type: 'decline_invite', fromPlayerId });
        setPendingInvite(null);
    }, [send]);

    const joinRoom = useCallback((playerName) => {
        send({ type: 'join_room', playerName });
    }, [send]);

    const leaveRoom = useCallback(() => {
        send({ type: 'leave_room' });
        setRoomId(null);
        setPlayers([]);
        setGameState(null);
        setMessages([]);
    }, [send]);

    const makeMove = useCallback((row, col, value) => {
        send({
            type: 'move',
            row,
            col,
            value
        });
    }, [send]);

    const sendChatMessage = useCallback((content) => {
        send({ type: 'chat', content });
    }, [send]);

    const sendVoiceMessage = useCallback((audioData) => {
        send({ type: 'voice', audioData });
    }, [send]);

    const setMessageHandler = useCallback((event, handler) => {
        messageHandlersRef.current[event] = handler;
    }, []);

    useEffect(() => {
        return () => {
            disconnect();
        };
    }, [disconnect]);

    return {
        isConnected,
        roomId,
        players,
        onlinePlayers,
        waitingPlayers,
        waitingPlayersList,
        pendingInvite,
        gameState,
        messages,
        playerId,
        connect,
        disconnect,
        send,
        getStats,
        joinLobby,
        leaveLobby,
        invitePlayer,
        acceptInvite,
        declineInvite,
        joinRoom,
        leaveRoom,
        makeMove,
        sendChatMessage,
        sendVoiceMessage,
        setMessageHandler
    };
};
