import { useState, useEffect } from 'react';

const SudokuGrid = ({
    board,
    solution,
    selectedCell,
    onCellSelect,
    prefilled,
    lastMove = null,
    isEliminated,
    myPlayerId,
    cellOwners = {},
    players = []
}) => {
    const [animatingCell, setAnimatingCell] = useState(null);

    useEffect(() => {
        if (lastMove) {
            setAnimatingCell({
                row: lastMove.row,
                col: lastMove.col,
                correct: lastMove.isCorrect,
                isOther: lastMove.playerId !== myPlayerId
            });
            const timer = setTimeout(() => setAnimatingCell(null), 500);
            return () => clearTimeout(timer);
        }
    }, [lastMove, myPlayerId]);

    // Get the selected number (if any cell with a number is selected)
    const getSelectedNumber = () => {
        if (!selectedCell) return null;
        const { row, col } = selectedCell;
        const value = board[row][col];
        return value !== 0 ? value : null;
    };

    const selectedNumber = getSelectedNumber();

    // Get player index for color coding (0 = you, 1 = opponent)
    const getPlayerIndex = (playerId) => {
        if (playerId === myPlayerId) return 0;
        const otherPlayers = players.filter(p => p.id !== myPlayerId);
        return otherPlayers.findIndex(p => p.id === playerId) + 1;
    };

    const getCellClass = (row, col) => {
        const classes = ['sudoku-cell'];
        const cellKey = `${row}-${col}`;
        const ownerId = cellOwners[cellKey];
        const cellValue = board[row][col];

        if (selectedCell && selectedCell.row === row && selectedCell.col === col) {
            classes.push('selected');
        }

        if (prefilled[row][col]) {
            classes.push('prefilled');
        } else if (cellValue !== 0) {
            classes.push('user-input');

            // Add owner class for color coding
            if (ownerId) {
                const playerIndex = getPlayerIndex(ownerId);
                if (playerIndex === 0) {
                    classes.push('my-input');
                } else {
                    classes.push('opponent-input');
                }
            }
        }

        // Highlight same number across the board
        if (selectedNumber && cellValue === selectedNumber) {
            classes.push('same-number');
        }

        // Highlight same row/col/box as selected (only for empty cells or if no number selected)
        if (selectedCell && !selectedNumber) {
            const { row: selRow, col: selCol } = selectedCell;

            // Highlight row and column
            if (row === selRow || col === selCol) {
                classes.push('highlighted');
            }

            // Same 3x3 box
            const boxRow = Math.floor(row / 3);
            const boxCol = Math.floor(col / 3);
            const selBoxRow = Math.floor(selRow / 3);
            const selBoxCol = Math.floor(selCol / 3);
            if (boxRow === selBoxRow && boxCol === selBoxCol) {
                classes.push('highlighted');
            }
        }

        // Animation for moves
        if (animatingCell && animatingCell.row === row && animatingCell.col === col) {
            if (animatingCell.correct) {
                classes.push('correct');
                if (animatingCell.isOther) {
                    classes.push('other-player-move');
                }
            } else {
                classes.push('error');
            }
        }

        return classes.join(' ');
    };

    const handleCellClick = (row, col) => {
        if (isEliminated) return;

        const cellValue = board[row][col];

        // If clicking on a cell with a number, select it to highlight all same numbers
        if (cellValue !== 0) {
            // If already selected, deselect
            if (selectedCell && selectedCell.row === row && selectedCell.col === col) {
                onCellSelect(null);
            } else {
                onCellSelect({ row, col });
            }
            return;
        }

        // Allow selecting any non-prefilled, empty cell for input
        if (!prefilled[row][col] && cellValue === 0) {
            onCellSelect({ row, col });
        }
    };

    return (
        <div className="sudoku-container">
            <div className="sudoku-grid">
                {board.map((row, rowIndex) =>
                    row.map((cell, colIndex) => (
                        <div
                            key={`${rowIndex}-${colIndex}`}
                            className={getCellClass(rowIndex, colIndex)}
                            data-row={rowIndex}
                            data-col={colIndex}
                            onClick={() => handleCellClick(rowIndex, colIndex)}
                        >
                            {cell !== 0 ? cell : ''}
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};

export default SudokuGrid;
