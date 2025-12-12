# Sudoku Duel

A multiplayer Progressive Web App (PWA) Sudoku game with real-time gameplay, chat, and voice messaging.

## Features

- **Single Player Mode**: Play solo against the clock
- **Multiplayer Mode**: Challenge friends in real-time
- **Same Board**: Both players solve the same puzzle
- **Scoring System**: Earn points for correct answers
- **Lives System**: 2 lives - wrong answer costs 1 life, second wrong = game over
- **Real-time Chat**: Text messaging between players
- **Voice Messages**: Hold to record and send voice messages
- **Toast Notifications**: Incoming messages appear as small toasts
- **PWA Installable**: Install on your device for offline access
- **Mobile Friendly**: Responsive design with on-screen number pad
- **Monochrome UI**: Clean, distraction-free design
- **Local Storage**: Game state persists on reload

## Tech Stack

- React + Vite
- WebSocket for real-time communication
- Service Worker for PWA functionality
- LocalStorage for persistence

## Getting Started

### Frontend

```bash
# Install dependencies
npm install

# Run development server
npm run dev
```

The app will be available at `http://localhost:3000`

### WebSocket Server (for Multiplayer)

```bash
# Navigate to server directory
cd server

# Install dependencies
npm install

# Run server
npm start
```

The WebSocket server runs on port 8080 by default.

## Configuration

Edit `.env` file to configure:

```
VITE_WS_URL=ws://localhost:8080
```

For production, update this to your deployed WebSocket server URL.

## Deployment

### Frontend

Build for production:

```bash
npm run build
```

Deploy the `dist` folder to any static hosting (Vercel, Netlify, etc.)

### WebSocket Server

Deploy the `server` folder to a Node.js hosting platform (Render, Railway, Heroku, etc.)

## How to Play

1. **Single Player**: Start a game and solve the 9x9 Sudoku puzzle
2. **Multiplayer**: 
   - Enter your name in the lobby
   - Wait for another player to join
   - Both players solve the same puzzle
   - Earn more points for correct answers
   - Wrong answers cost lives
   - Chat with your opponent using text or voice

## PWA Installation

On mobile or desktop, you can install the app:
- Chrome: Click "Install" in the address bar or use the install prompt
- iOS Safari: Tap Share > Add to Home Screen

## License

MIT
