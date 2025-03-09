const express = require('express');
const http = require('http');
const path = require('path');
const { Server } = require('socket.io');

// Import server modules
const { initializeGameState } = require('./modules/game/gameState');
const { setupSocketHandlers } = require('./modules/network/socketHandlers');
const { initializeAdEngine } = require('./modules/ads/adEngine');

// Create Express app
const app = express();
const server = http.createServer(app);

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
app.use(express.static(path.join(__dirname, '../../dist')));

// Serve index.html for all routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../../dist/index.html'));
});

// Initialize game state
const gameState = initializeGameState();

// Initialize ad engine
const adEngine = initializeAdEngine(gameState);

// Setup socket handlers
setupSocketHandlers(io, gameState);

// Game update loop
const TICK_RATE = 15; // Reduced from 20 to 15 updates per second for better performance
const TICK_INTERVAL = 1000 / TICK_RATE;

let lastUpdateTime = Date.now();

function gameLoop() {
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