import express from 'express';
import { createServer } from 'http';
import {dirname, join} from 'path';
import { Server } from 'socket.io';
import { fileURLToPath } from 'url';

// Import server modules
import { setupSocketHandlers } from './modules/network/socketHandlers.js';
import { initializeAdEngine } from './modules/ads/adEngine.js';
import { GameStateManager, initializeGameState } from './modules/game/gameState.js';

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Create Express app
const app = express();
const server = createServer(app);

// Create Socket.io server
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

// Set port
const PORT = process.env.PORT || 5000;

// Serve static files from dist directory
app.use(express.static(join(__dirname, '../../client/dist')));

// Serve index.html for all routes
app.get('*', (req, res) => {
  res.sendFile(join(__dirname, '../../client/dist/index.html'));
});

// Initialize game state
const gameState: GameStateManager = initializeGameState();

// Initialize ad engine
const adEngine = initializeAdEngine(gameState);

// Setup socket handlers
setupSocketHandlers(io, gameState);

// Game update loop
const TICK_RATE = 15; // Reduced from 20 to 15 updates per second for better performance
const TICK_INTERVAL = 1000 / TICK_RATE;

let lastUpdateTime = Date.now();

function gameLoop(): void {
  const now = Date.now();
  const deltaTime = (now - lastUpdateTime) / 1000;
  lastUpdateTime = now;
  
  // Update game state
  gameState.update(deltaTime);
  
  // Update ad engine
  adEngine.update(deltaTime);
  
  // Broadcast game state to all clients
  io.emit('game:state', {
    timestamp: now,
    players: gameState.getPlayersData(),
    ads: adEngine.getActiveAds()
  });
  
  // Schedule next update
  setTimeout(gameLoop, TICK_INTERVAL);
}

// Start server
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Game client available at http://localhost:${PORT}`);
  
  // Start game loop
  gameLoop();
});

// Handle server shutdown
process.on('SIGINT', () => {
  console.log('Server shutting down...');
  
  // Close Socket.io connections
  io.close();
  
  // Close server
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
}); 