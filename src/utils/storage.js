const STORAGE_KEY = 'sudoku_game_state';

export const saveGameState = (state) => {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) {
        console.error('Failed to save game state:', e);
    }
};

export const loadGameState = () => {
    try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
            const state = JSON.parse(saved);
            // Check if state is still valid (not too old)
            const hourAgo = Date.now() - (60 * 60 * 1000);
            if (state.timestamp && state.timestamp > hourAgo) {
                return state;
            }
        }
    } catch (e) {
        console.error('Failed to load game state:', e);
    }
    return null;
};

export const clearGameState = () => {
    try {
        localStorage.removeItem(STORAGE_KEY);
    } catch (e) {
        console.error('Failed to clear game state:', e);
    }
};

export const savePlayerName = (name) => {
    try {
        localStorage.setItem('sudoku_player_name', name);
    } catch (e) {
        console.error('Failed to save player name:', e);
    }
};

export const loadPlayerName = () => {
    try {
        return localStorage.getItem('sudoku_player_name') || '';
    } catch (e) {
        return '';
    }
};
