/**
 * Socket.io handlers for WebSocket communication
 */

/**
 * Set up Socket.io handlers
 * @param {Object} io - The Socket.io server instance
 * @param {Object} gameState - The game state manager
 */
function setupSocketHandlers(io, gameState) {
  // Connection event
  io.on('connection', (socket) => {
    console.log(`Player connected: ${socket.id}`);
    
    // Set up event handlers for this client
    setupPlayerHandlers(socket, io, gameState);
    
    // Disconnect event
    socket.on('disconnect', () => {
      console.log(`Player disconnected: ${socket.id}`);
      
      // Remove player from game state
      gameState.removePlayer(socket.id);
      
      // Notify all clients about disconnect
      socket.broadcast.emit('player:left', { id: socket.id });
    });
    
    // Error handling
    socket.on('error', (error) => {
      console.error(`Socket error for ${socket.id}:`, error);
    });
  });
}

/**
 * Set up player-specific event handlers
 * @param {Object} socket - The Socket.io socket for this player
 * @param {Object} io - The Socket.io server instance
 * @param {Object} gameState - The game state manager
 */
function setupPlayerHandlers(socket, io, gameState) {
  // Player joins the game
  socket.on('player:join', (initialData) => {
    console.log(`Player ${socket.id} joined the game`);
    
    // Add player to game state
    const player = gameState.addPlayer(socket.id, initialData);
    
    // Send current game state to the new player
    socket.emit('game:state', {
      timestamp: Date.now(),
      players: gameState.getPlayersData(),
      cityLayout: gameState.getCityLayout()
    });
    
    // Notify other players about the new player
    socket.broadcast.emit('player:joined', {
      id: socket.id,
      ...player
    });
  });
  
  // Player updates position
  socket.on('player:update', (updateData) => {
    // Update player in game state
    gameState.updatePlayer(socket.id, updateData);
  });
  
  // Player fires laser
  socket.on('laser:fire', (laserData) => {
    // Create laser in game state
    const laser = gameState.firePlayerLaser(socket.id, laserData);
    
    // If laser was created, notify all clients
    if (laser) {
      io.emit('laser:shot', {
        id: laser.id,
        playerId: socket.id,
        position: laser.position,
        rotation: laser.rotation
      });
    }
  });
  
  // Player reports a laser hit - give this high priority
  socket.on('laser:hit', (hitData) => {
    console.log('Player hit detected:', socket.id, 'hit', hitData.targetId);
    
    // Get target player
    const targetPlayer = gameState.getPlayerById(hitData.targetId);
    
    if (targetPlayer && targetPlayer.isAlive) {
      // Register the hit
      const hitResult = gameState.playerHit(hitData.targetId, gameState.LASER_DAMAGE, socket.id);
      
      // Notify the hit player immediately
      io.to(hitData.targetId).emit('player:hit', {
        health: targetPlayer.health,
        fromPlayer: socket.id,
        fromDirection: hitData.position
      });
      
      // Notify all players of explosion/impact immediately
      io.emit('laser:impact', {
        position: hitData.position,
        targetId: hitData.targetId
      });
      
      // If player died from this hit
      if (hitResult && hitResult.died) {
        // Broadcast death message
        io.emit('player:died', {
          playerId: hitData.targetId,
          killedBy: socket.id
        });
        
        // Update killer's score
        const killer = gameState.getPlayerById(socket.id);
        if (killer) {
          killer.score += 1; // Increment score
          
          io.emit('score:update', {
            playerId: socket.id,
            score: killer.score
          });
        }
      }
      
      return true; // Return success to client
    }
    
    return false; // Return failure to client
  });
  
  // Player sends chat message
  socket.on('chat:message', (message) => {
    // Get player data
    const player = gameState.getPlayerById(socket.id);
    if (!player) return;
    
    // Broadcast message to all players
    io.emit('chat:message', {
      timestamp: Date.now(),
      playerId: socket.id,
      playerName: player.name || `Player ${socket.id.substr(0, 5)}`,
      message: message
    });
  });
  
  // Player pings server
  socket.on('ping', () => {
    socket.emit('pong');
  });
}

module.exports = {
  setupSocketHandlers
}; 