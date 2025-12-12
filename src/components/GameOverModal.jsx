import { HomeIcon, RefreshIcon } from './Icons';

const GameOverModal = ({
    isOpen,
    winner,
    players,
    onPlayAgain,
    onGoHome,
    isSinglePlayer,
    finalScore
}) => {
    if (!isOpen) return null;

    return (
        <div className="modal-overlay">
            <div className="modal">
                <h2 className="modal-title">
                    {isSinglePlayer
                        ? (winner ? 'Puzzle Complete!' : 'Game Over')
                        : (winner ? `${winner.name} Wins!` : 'Game Over')
                    }
                </h2>
                <p className="modal-subtitle">
                    {isSinglePlayer
                        ? (winner ? `Final Score: ${finalScore}` : 'Better luck next time!')
                        : 'Great game!'
                    }
                </p>

                {!isSinglePlayer && players && players.length > 0 && (
                    <div className="modal-scores">
                        {players
                            .sort((a, b) => b.score - a.score)
                            .map((player, index) => (
                                <div
                                    key={player.id}
                                    className={`modal-score ${index === 0 ? 'winner' : ''}`}
                                >
                                    <span className="modal-score-name">
                                        {player.name} {player.eliminated ? '(Out)' : ''}
                                    </span>
                                    <span className="modal-score-value">{player.score}</span>
                                </div>
                            ))
                        }
                    </div>
                )}

                <div className="modal-actions">
                    <button className="btn btn-primary" onClick={onPlayAgain}>
                        <RefreshIcon />
                        Play Again
                    </button>
                    <button className="btn btn-secondary" onClick={onGoHome}>
                        <HomeIcon />
                        Home
                    </button>
                </div>
            </div>
        </div>
    );
};

export default GameOverModal;
