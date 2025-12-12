import { useState, useEffect, useCallback, useRef } from 'react';
import SudokuGrid from './components/SudokuGrid';
import NumberPad from './components/NumberPad';
import ChatPanel from './components/ChatPanel';
import ToastContainer from './components/Toast';
import GameOverModal from './components/GameOverModal';
import InstallPrompt from './components/InstallPrompt';
import {
  MessageIcon,
  BackIcon,
  UserIcon,
  UsersIcon
} from './components/Icons';
import { generateSudoku, isValidMove, isBoardComplete } from './utils/sudoku';
import {
  saveGameState,
  loadGameState,
  clearGameState,
  savePlayerName,
  loadPlayerName
} from './utils/storage';
import { useWebSocket } from './hooks/useWebSocket';

const SCREENS = {
  MENU: 'menu',
  LOBBY: 'lobby',
  GAME: 'game'
};

const LOBBY_TIMEOUT = 30; // seconds

function App() {
  // Screen state
  const [currentScreen, setCurrentScreen] = useState(SCREENS.MENU);
  const [gameMode, setGameMode] = useState(null);

  // Player state
  const [playerName, setPlayerName] = useState('');
  const [lives, setLives] = useState(2);
  const [score, setScore] = useState(0);
  const [isEliminated, setIsEliminated] = useState(false);

  // Game state
  const [puzzle, setPuzzle] = useState(null);
  const [solution, setSolution] = useState(null);
  const [board, setBoard] = useState(null);
  const [prefilled, setPrefilled] = useState(null);
  const [selectedCell, setSelectedCell] = useState(null);
  const [lastMove, setLastMove] = useState(null);
  const [cellOwners, setCellOwners] = useState({});

  // UI state
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [toasts, setToasts] = useState([]);
  const [unreadMessages, setUnreadMessages] = useState(0);
  const [isGameOver, setIsGameOver] = useState(false);
  const [winner, setWinner] = useState(null);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteSentTo, setInviteSentTo] = useState(null);
  const [showNameModal, setShowNameModal] = useState(false);
  const [tempPlayerName, setTempPlayerName] = useState('');
  const [isEditingName, setIsEditingName] = useState(false);
  const [showEliminatedBanner, setShowEliminatedBanner] = useState(false);

  // Lobby state
  const [lobbyCountdown, setLobbyCountdown] = useState(LOBBY_TIMEOUT);
  const [isInLobby, setIsInLobby] = useState(false);
  const lobbyTimerRef = useRef(null);

  // Chat state
  const [localMessages, setLocalMessages] = useState([]);

  // Multiplayer state
  const [multiplayerPlayers, setMultiplayerPlayers] = useState([]);

  // WebSocket
  const ws = useWebSocket();

  // Prevent page reload during game
  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (currentScreen === SCREENS.GAME && gameMode === 'multi') {
        e.preventDefault();
        e.returnValue = 'You are in a match! Are you sure you want to leave?';
        return e.returnValue;
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [currentScreen, gameMode]);

  // Connect to WebSocket on mount
  useEffect(() => {
    ws.connect();
    return () => {
      if (lobbyTimerRef.current) {
        clearInterval(lobbyTimerRef.current);
      }
    };
  }, []);

  // Load saved player name
  useEffect(() => {
    const savedName = loadPlayerName();
    if (savedName) {
      setPlayerName(savedName);
    }
  }, []);

  // Try to restore game state on mount (only for single player)
  useEffect(() => {
    const savedState = loadGameState();
    if (savedState && savedState.board && savedState.gameMode === 'single') {
      setPuzzle(savedState.puzzle);
      setSolution(savedState.solution);
      setBoard(savedState.board);
      setPrefilled(savedState.prefilled);
      setScore(savedState.score || 0);
      setLives(savedState.lives || 2);
      setGameMode(savedState.gameMode);
      setCurrentScreen(SCREENS.GAME);
    }
  }, []);

  // Save game state periodically (only for single player)
  useEffect(() => {
    if (board && currentScreen === SCREENS.GAME && gameMode === 'single') {
      saveGameState({
        puzzle,
        solution,
        board,
        prefilled,
        score,
        lives,
        gameMode,
        timestamp: Date.now()
      });
    }
  }, [board, puzzle, solution, prefilled, score, lives, gameMode, currentScreen]);

  // Lobby countdown timer
  useEffect(() => {
    if (isInLobby && currentScreen === SCREENS.LOBBY) {
      lobbyTimerRef.current = setInterval(() => {
        setLobbyCountdown(prev => {
          if (prev <= 1) {
            clearInterval(lobbyTimerRef.current);
            ws.leaveLobby();
            setIsInLobby(false);
            setCurrentScreen(SCREENS.MENU);
            return LOBBY_TIMEOUT;
          }
          return prev - 1;
        });
      }, 1000);

      return () => {
        if (lobbyTimerRef.current) {
          clearInterval(lobbyTimerRef.current);
        }
      };
    }
  }, [isInLobby, currentScreen, ws]);

  // Auto-hide eliminated banner after 10 seconds
  useEffect(() => {
    if (isEliminated && !isGameOver) {
      setShowEliminatedBanner(true);
      const timer = setTimeout(() => {
        setShowEliminatedBanner(false);
      }, 10000); // 10 seconds
      return () => clearTimeout(timer);
    } else {
      setShowEliminatedBanner(false);
    }
  }, [isEliminated, isGameOver]);

  // WebSocket message handlers
  useEffect(() => {
    ws.setMessageHandler('onPlayerJoined', (data) => {
      setMultiplayerPlayers(data.players);
    });

    ws.setMessageHandler('onInviteReceived', (data) => {
      setShowInviteModal(true);
    });

    ws.setMessageHandler('onInviteSent', (data) => {
      setInviteSentTo(data.toPlayerName);
    });

    ws.setMessageHandler('onInviteDeclined', () => {
      setInviteSentTo(null);
      setToasts(prev => [...prev, {
        senderName: 'System',
        content: 'Invite was declined',
        timestamp: Date.now()
      }]);
    });

    ws.setMessageHandler('onGameStart', (data) => {
      if (lobbyTimerRef.current) {
        clearInterval(lobbyTimerRef.current);
      }
      setIsInLobby(false);
      setShowInviteModal(false);
      setInviteSentTo(null);

      const { puzzle: serverPuzzle, solution: serverSolution, board: serverBoard, cellOwners: serverCellOwners } = data.gameState;

      setPuzzle(serverPuzzle);
      setSolution(serverSolution);
      setBoard(serverBoard.map(row => [...row]));
      setPrefilled(serverPuzzle.map(row => row.map(cell => cell !== 0)));
      setCellOwners(serverCellOwners || {});
      setScore(0);
      setLives(2);
      setIsEliminated(false);
      setIsGameOver(false);
      setWinner(null);
      setSelectedCell(null);
      setLocalMessages([]);
      setGameMode('multi');
      setCurrentScreen(SCREENS.GAME);

      if (data.players) {
        setMultiplayerPlayers(data.players);
      }
    });

    ws.setMessageHandler('onMoveMade', (data) => {
      if (data.board) {
        setBoard(data.board.map(row => [...row]));
      }

      if (data.cellOwners) {
        setCellOwners(data.cellOwners);
      }

      setLastMove({
        row: data.row,
        col: data.col,
        playerId: data.playerId,
        playerName: data.playerName,
        isCorrect: data.isCorrect
      });

      setTimeout(() => setLastMove(null), 500);

      if (data.players) {
        setMultiplayerPlayers(data.players);

        const me = data.players.find(p => p.id === ws.playerId);
        if (me) {
          setScore(me.score);
          setLives(me.lives);
          setIsEliminated(me.eliminated);
        }
      }

      if (data.playerId === ws.playerId) {
        setSelectedCell(null);
      }
    });

    ws.setMessageHandler('onChatMessage', (message) => {
      setLocalMessages(prev => [...prev, message]);
      if (message.senderId !== ws.playerId) {
        if (!isChatOpen) {
          setToasts(prev => [...prev, message]);
          setUnreadMessages(prev => prev + 1);
        }
      }
    });

    ws.setMessageHandler('onGameOver', (data) => {
      setIsGameOver(true);
      setWinner(data.winner);
      setMultiplayerPlayers(data.players);
    });
  }, [ws, isChatOpen]);

  // Handle multiplayer players update
  useEffect(() => {
    if (ws.players.length > 0) {
      setMultiplayerPlayers(ws.players);
    }
  }, [ws.players]);

  const initializeSinglePlayerGame = useCallback(() => {
    const { puzzle: newPuzzle, solution: newSolution } = generateSudoku('medium');
    setPuzzle(newPuzzle);
    setSolution(newSolution);
    setBoard(newPuzzle.map(row => [...row]));
    setPrefilled(newPuzzle.map(row => row.map(cell => cell !== 0)));
    setCellOwners({});
    setScore(0);
    setLives(2);
    setIsEliminated(false);
    setIsGameOver(false);
    setWinner(null);
    setSelectedCell(null);
    setLocalMessages([]);
    setGameMode('single');
  }, []);

  const startSinglePlayer = () => {
    initializeSinglePlayerGame();
    setCurrentScreen(SCREENS.GAME);
  };

  const startMultiplayerLobby = () => {
    if (!playerName.trim()) {
      // Generate a random player name
      const randomNum = Math.floor(Math.random() * 9000) + 1000;
      setTempPlayerName(`Player${randomNum}`);
      setIsEditingName(false);
      setShowNameModal(true);
      return;
    }
    proceedToLobby(playerName.trim());
  };

  const proceedToLobby = (name) => {
    setPlayerName(name);
    savePlayerName(name);
    setGameMode('multi');
    setCurrentScreen(SCREENS.LOBBY);
    setLobbyCountdown(LOBBY_TIMEOUT);
    setIsInLobby(true);
    setInviteSentTo(null);
    ws.joinLobby(name);
  };

  const handleNameModalConfirm = () => {
    const nameToUse = tempPlayerName.trim() || `Player${Math.floor(Math.random() * 9000) + 1000}`;
    setShowNameModal(false);
    setPlayerName(nameToUse);
    savePlayerName(nameToUse);

    // Only proceed to lobby if we're not just editing
    if (!isEditingName) {
      proceedToLobby(nameToUse);
    }
    setIsEditingName(false);
  };

  const handleNameModalCancel = () => {
    setShowNameModal(false);
    setTempPlayerName('');
    setIsEditingName(false);
  };

  const handleInvitePlayer = (targetPlayerId) => {
    ws.invitePlayer(targetPlayerId);
  };

  const handleAcceptInvite = () => {
    if (ws.pendingInvite) {
      ws.acceptInvite(ws.pendingInvite.fromPlayerId);
      setShowInviteModal(false);
    }
  };

  const handleDeclineInvite = () => {
    if (ws.pendingInvite) {
      ws.declineInvite(ws.pendingInvite.fromPlayerId);
      setShowInviteModal(false);
    }
  };

  const handleNumberSelect = (num) => {
    if (!selectedCell || isEliminated) return;

    const { row, col } = selectedCell;
    if (prefilled[row][col]) return;
    if (board[row][col] !== 0) return;

    if (gameMode === 'multi') {
      ws.makeMove(row, col, num);
    } else {
      const isCorrect = isValidMove(board, row, col, num, solution);

      if (isCorrect) {
        const newBoard = board.map(r => [...r]);
        newBoard[row][col] = num;
        setBoard(newBoard);
        setScore(prev => prev + 10);

        setCellOwners(prev => ({ ...prev, [`${row}-${col}`]: 'local' }));

        if (isBoardComplete(newBoard)) {
          setIsGameOver(true);
          setWinner({ name: 'You', score: score + 10 });
          clearGameState();
        }

        setSelectedCell(null);
      } else {
        const newLives = lives - 1;
        setLives(newLives);

        if (newLives <= 0) {
          setIsEliminated(true);
          setIsGameOver(true);
          setWinner(null);
          clearGameState();
        }
      }
    }
  };

  const handleClear = () => {
    if (!selectedCell || isEliminated) return;

    const { row, col } = selectedCell;
    if (prefilled[row][col]) return;

    if (gameMode === 'single') {
      const newBoard = board.map(r => [...r]);
      newBoard[row][col] = 0;
      setBoard(newBoard);
    }
  };

  const handleSendMessage = (content) => {
    if (gameMode === 'multi') {
      ws.sendChatMessage(content);
    }
  };

  const handleSendVoice = (audioData) => {
    if (gameMode === 'multi') {
      ws.sendVoiceMessage(audioData);
    }
  };

  const handleOpenChat = () => {
    setIsChatOpen(true);
    setUnreadMessages(0);
  };

  const handleRemoveToast = (index) => {
    setToasts(prev => prev.filter((_, i) => i !== index));
  };

  const goToMenu = () => {
    // Only show confirmation if game is in progress (not game over)
    if (currentScreen === SCREENS.GAME && gameMode === 'multi' && !isGameOver) {
      if (!window.confirm('Are you sure you want to leave the match?')) {
        return;
      }
    }

    if (lobbyTimerRef.current) {
      clearInterval(lobbyTimerRef.current);
    }
    ws.leaveRoom();
    ws.leaveLobby();
    setIsInLobby(false);
    setCurrentScreen(SCREENS.MENU);
    setGameMode(null);
    setInviteSentTo(null);
    setIsGameOver(false);
    setWinner(null);
    clearGameState();
  };

  const handlePlayAgain = () => {
    if (gameMode === 'single') {
      startSinglePlayer();
    } else {
      goToMenu();
    }
  };

  const getUsedNumbers = () => {
    if (!board) return {};
    const counts = {};
    for (let i = 1; i <= 9; i++) counts[i] = 0;

    for (let row of board) {
      for (let cell of row) {
        if (cell !== 0) counts[cell]++;
      }
    }
    return counts;
  };

  const allMessages = localMessages.sort((a, b) => a.timestamp - b.timestamp);

  // Filter waiting players to exclude self
  const otherWaitingPlayers = ws.waitingPlayersList.filter(p => p.id !== ws.playerId);

  return (
    <div className="app">
      {/* Menu Screen */}
      {currentScreen === SCREENS.MENU && (
        <div className="screen screen-center">
          <div className="content-center">
            <div>
              <h1 className="menu-logo">SUDOKU</h1>
              <p className="menu-tagline">Challenge your mind</p>
            </div>

            {/* Show player name if exists */}
            {playerName && (
              <div className="player-name-display">
                <span>Playing as <strong>{playerName}</strong></span>
                <button
                  className="btn-edit-name"
                  onClick={() => {
                    setTempPlayerName(playerName);
                    setIsEditingName(true);
                    setShowNameModal(true);
                  }}
                >
                  Edit
                </button>
              </div>
            )}

            <div className="online-stats">
              <div className="online-stat">
                <span className="online-dot"></span>
                <span>{ws.onlinePlayers} online</span>
              </div>
              {ws.waitingPlayers > 0 && (
                <div className="online-stat waiting">
                  <span>{ws.waitingPlayers} waiting for match</span>
                </div>
              )}
            </div>

            <div className="menu-buttons">
              <button className="btn btn-primary" onClick={startSinglePlayer}>
                <UserIcon />
                Single Player
              </button>

              <button
                className="btn btn-secondary"
                onClick={startMultiplayerLobby}
              >
                <UsersIcon />
                Join Multiplayer
              </button>
            </div>


            {!ws.isConnected && (
              <p className="connection-status">Connecting to server...</p>
            )}
          </div>
        </div>
      )}

      {/* Lobby Screen */}
      {currentScreen === SCREENS.LOBBY && (
        <div className="screen screen-center">
          <div className="content-center">
            <h2>Multiplayer Lobby</h2>

            <div className="lobby-timer">
              <div className="timer-circle">
                <svg viewBox="0 0 100 100">
                  <circle
                    cx="50"
                    cy="50"
                    r="45"
                    fill="none"
                    stroke="var(--border-subtle)"
                    strokeWidth="4"
                  />
                  <circle
                    cx="50"
                    cy="50"
                    r="45"
                    fill="none"
                    stroke="var(--text-primary)"
                    strokeWidth="4"
                    strokeLinecap="round"
                    strokeDasharray={`${(lobbyCountdown / LOBBY_TIMEOUT) * 283} 283`}
                    transform="rotate(-90 50 50)"
                  />
                </svg>
                <span className="timer-text">{lobbyCountdown}</span>
              </div>
            </div>

            {inviteSentTo ? (
              <p className="lobby-status">
                Invite sent to {inviteSentTo}
                <span className="lobby-dots">...</span>
              </p>
            ) : (
              <p className="lobby-status">
                {otherWaitingPlayers.length > 0 ? 'Players online - invite them!' : 'Waiting for players'}
                <span className="lobby-dots">...</span>
              </p>
            )}

            {/* Online Players List */}
            {otherWaitingPlayers.length > 0 && (
              <div className="waiting-players-list">
                <h3>Players Online</h3>
                {otherWaitingPlayers.map(player => (
                  <div key={player.id} className="waiting-player-item">
                    <span className="waiting-player-name">{player.name}</span>
                    <button
                      className="btn btn-invite"
                      onClick={() => handleInvitePlayer(player.id)}
                      disabled={inviteSentTo !== null}
                    >
                      Invite
                    </button>
                  </div>
                ))}
              </div>
            )}

            {otherWaitingPlayers.length === 0 && (
              <div className="empty-lobby">
                <p>No other players in lobby</p>
                <p className="empty-lobby-hint">Share the link to invite friends!</p>
              </div>
            )}

            <button className="btn btn-ghost lobby-cancel" onClick={goToMenu}>
              <BackIcon />
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Invite Modal */}
      {showInviteModal && ws.pendingInvite && (
        <div className="modal-overlay">
          <div className="modal invite-modal">
            <h2 className="modal-title">Game Invite</h2>
            <p className="modal-subtitle">
              {ws.pendingInvite.fromPlayerName} wants to play with you!
            </p>
            <div className="modal-actions">
              <button className="btn btn-primary" onClick={handleAcceptInvite}>
                Accept
              </button>
              <button className="btn btn-secondary" onClick={handleDeclineInvite}>
                Decline
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Name Confirmation Modal */}
      {showNameModal && (
        <div className="modal-overlay">
          <div className="modal name-modal">
            <h2 className="modal-title">Enter Your Name</h2>
            <p className="modal-subtitle">
              You're about to join as:
            </p>
            <input
              type="text"
              className="name-modal-input"
              value={tempPlayerName}
              onChange={(e) => setTempPlayerName(e.target.value)}
              maxLength={15}
              placeholder="Enter your name"
              autoFocus
            />
            <p className="modal-hint">
              Edit the name above or continue with the default
            </p>
            <div className="modal-actions">
              <button className="btn btn-primary" onClick={handleNameModalConfirm}>
                Continue
              </button>
              <button className="btn btn-secondary" onClick={handleNameModalCancel}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Game Screen */}
      {currentScreen === SCREENS.GAME && board && (
        <div className="screen">
          <div className="game-header">
            <button className="btn-icon btn-ghost" onClick={goToMenu}>
              <BackIcon />
            </button>

            {/* Only show stats in single player mode */}
            {gameMode === 'single' && (
              <div className="game-stats">
                <div className="stat">
                  <span className="stat-label">Score</span>
                  <span className="stat-value">{score}</span>
                </div>
                <div className="stat">
                  <span className="stat-label">Lives</span>
                  <div className="lives">
                    {[0, 1].map(i => (
                      <div
                        key={i}
                        className={`life ${i >= lives ? 'lost' : ''}`}
                      />
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Chat button in header for multiplayer */}
            {gameMode === 'multi' && (
              <button className="btn-icon btn-ghost header-chat" onClick={handleOpenChat}>
                <MessageIcon />
                {unreadMessages > 0 && (
                  <span className="header-chat-badge">{unreadMessages}</span>
                )}
              </button>
            )}
          </div>

          {gameMode === 'multi' && multiplayerPlayers.length > 0 && (
            <div className="players-bar">
              {multiplayerPlayers.map(player => (
                <div
                  key={player.id}
                  className={`player-chip ${player.id === ws.playerId ? 'you' : ''} ${player.eliminated ? 'eliminated' : ''}`}
                >
                  <span>{player.name}</span>
                  <span className="player-score">{player.score || 0}</span>
                  <div className="player-lives">
                    {[0, 1].map(i => (
                      <div
                        key={i}
                        className={`player-life ${i >= (player.lives || 0) ? 'lost' : ''}`}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {showEliminatedBanner && (
            <div className="eliminated-banner">
              You are out! You can still help your teammate through chat.
            </div>
          )}

          <SudokuGrid
            board={board}
            solution={solution}
            selectedCell={selectedCell}
            onCellSelect={setSelectedCell}
            prefilled={prefilled}
            lastMove={lastMove}
            isEliminated={isEliminated}
            myPlayerId={ws.playerId || 'local'}
            cellOwners={cellOwners}
            players={multiplayerPlayers}
          />

          <NumberPad
            onNumberSelect={handleNumberSelect}
            onClear={handleClear}
            disabled={isEliminated || !selectedCell}
            usedNumbers={getUsedNumbers()}
            hideClear={gameMode === 'multi'}
            showVoice={gameMode === 'multi'}
            ws={ws}
          />
        </div>
      )}

      {gameMode === 'multi' && (
        <ChatPanel
          isOpen={isChatOpen}
          onClose={() => setIsChatOpen(false)}
          messages={allMessages}
          onSendMessage={handleSendMessage}
          onSendVoice={handleSendVoice}
          playerId={ws.playerId || 'local'}
          playerName={playerName}
          ws={ws}
        />
      )}

      <ToastContainer
        toasts={toasts}
        onRemoveToast={handleRemoveToast}
      />

      <GameOverModal
        isOpen={isGameOver}
        winner={winner}
        players={multiplayerPlayers}
        onPlayAgain={handlePlayAgain}
        onGoHome={goToMenu}
        isSinglePlayer={gameMode === 'single'}
        finalScore={score}
      />

      <InstallPrompt />
    </div>
  );
}

export default App;
