// Sudoku puzzle generator and solver
export const generateSudoku = (difficulty = 'medium') => {
    const solution = generateSolution();
    const puzzle = createPuzzle(solution, difficulty);
    return { puzzle, solution };
};

const generateSolution = () => {
    const board = Array(9).fill(null).map(() => Array(9).fill(0));
    fillBoard(board);
    return board;
};

const fillBoard = (board) => {
    const findEmpty = () => {
        for (let i = 0; i < 9; i++) {
            for (let j = 0; j < 9; j++) {
                if (board[i][j] === 0) return [i, j];
            }
        }
        return null;
    };

    const isValid = (num, row, col) => {
        // Check row
        for (let i = 0; i < 9; i++) {
            if (board[row][i] === num) return false;
        }
        // Check column
        for (let i = 0; i < 9; i++) {
            if (board[i][col] === num) return false;
        }
        // Check 3x3 box
        const boxRow = Math.floor(row / 3) * 3;
        const boxCol = Math.floor(col / 3) * 3;
        for (let i = 0; i < 3; i++) {
            for (let j = 0; j < 3; j++) {
                if (board[boxRow + i][boxCol + j] === num) return false;
            }
        }
        return true;
    };

    const empty = findEmpty();
    if (!empty) return true;

    const [row, col] = empty;
    const nums = shuffleArray([1, 2, 3, 4, 5, 6, 7, 8, 9]);

    for (const num of nums) {
        if (isValid(num, row, col)) {
            board[row][col] = num;
            if (fillBoard(board)) return true;
            board[row][col] = 0;
        }
    }

    return false;
};

const createPuzzle = (solution, difficulty) => {
    const puzzle = solution.map(row => [...row]);
    const cellsToRemove = {
        easy: 35,
        medium: 45,
        hard: 55
    }[difficulty] || 45;

    const positions = [];
    for (let i = 0; i < 9; i++) {
        for (let j = 0; j < 9; j++) {
            positions.push([i, j]);
        }
    }

    const shuffledPositions = shuffleArray(positions);

    for (let i = 0; i < cellsToRemove; i++) {
        const [row, col] = shuffledPositions[i];
        puzzle[row][col] = 0;
    }

    return puzzle;
};

const shuffleArray = (array) => {
    const newArray = [...array];
    for (let i = newArray.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
    }
    return newArray;
};

export const isValidMove = (board, row, col, num, solution) => {
    return solution[row][col] === num;
};

export const isBoardComplete = (board) => {
    for (let i = 0; i < 9; i++) {
        for (let j = 0; j < 9; j++) {
            if (board[i][j] === 0) return false;
        }
    }
    return true;
};
