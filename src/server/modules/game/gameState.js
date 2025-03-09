/**
 * Game state module - maintains the authoritative game state on the server
 */

// Game physics constants
const GRAVITY = 9.8; // Gravity acceleration (m/s^2)
const DRAG_COEFFICIENT = 0.1; // Air resistance
const MAX_VELOCITY = 200; // Maximum velocity (m/s)
const COLLISION_DAMAGE = 20; // Damage from collisions
const LASER_DAMAGE = 10; // Damage from laser hits
const CITY_BOUNDS = {
  minX: -1000,
  maxX: 1000,
  minY: 0,
  maxY: 1000,
  minZ: -1000,
  maxZ: 1000
};

// Game state
let players = {};
let lasers = [];
let cityLayout = generateCityLayout();

/**
 * Initialize the game state
 * @returns {Object} - The game state manager
 */
function initializeGameState() {
  return {
    addPlayer,
    removePlayer,
    updatePlayer,
    firePlayerLaser,
    playerHit,
    update,
    getPlayerById,
    getAllPlayers,
    getPlayersData,
    getLasers,
    getCityLayout,
    CITY_BOUNDS
  };
}

/**
 * Add a new player to the game
 * @param {string} playerId - The player's ID
 * @param {Object} initialData - The player's initial data
 * @returns {Object} - The created player
 */
function addPlayer(playerId, initialData) {
  const spawnPoint = getRandomSpawnPoint();
  
  players[playerId] = {
    id: playerId,
    position: initialData.position || spawnPoint,
    rotation: initialData.rotation || { x: 0, y: 0, z: 0 },
    velocity: initialData.velocity || { x: 0, y: 0, z: 0 },
    health: 100,
    score: 0,
    lastUpdate: Date.now(),
    isAlive: true,
    respawnTime: 0,
    lastShotTime: 0
  };
  
  return players[playerId];
}

/**
 * Remove a player from the game
 * @param {string} playerId - The player's ID
 */
function removePlayer(playerId) {
  delete players[playerId];
}

/**
 * Update a player's data
 * @param {string} playerId - The player's ID
 * @param {Object} updateData - The player's updated data
 * @returns {Object} - The updated player
 */
function updatePlayer(playerId, updateData) {
  const player = players[playerId];
  if (!player) return null;
  
  // Update player data
  if (updateData.position) player.position = updateData.position;
  if (updateData.rotation) player.rotation = updateData.rotation;
  if (updateData.velocity) player.velocity = updateData.velocity;
  
  player.lastUpdate = Date.now();
  
  return player;
}

/**
 * Fire a laser from a player
 * @param {string} playerId - The player's ID
 * @param {Object} laserData - The laser data
 * @returns {Object|null} - The created laser or null
 */
function firePlayerLaser(playerId, laserData) {
  const player = players[playerId];
  if (!player || !player.isAlive) return null;
  
  // Check if player can fire (cooldown)
  const now = Date.now();
  if (now - player.lastShotTime < 1000) return null;
  
  player.lastShotTime = now;
  
  // Create laser
  const laser = {
    id: `laser_${playerId}_${now}`,
    playerId,
    position: { ...player.position },
    rotation: { ...player.rotation },
    velocity: {
      x: -Math.sin(player.rotation.y * Math.PI / 180) * 500,
      y: Math.sin(player.rotation.x * Math.PI / 180) * 500,
      z: -Math.cos(player.rotation.y * Math.PI / 180) * 500
    },
    createdAt: now,
    timeToLive: 2000 // milliseconds
  };
  
  lasers.push(laser);
  return laser;
}

/**
 * Register a player hit by a laser or collision
 * @param {string} playerId - The player's ID
 * @param {number} damage - The amount of damage
 * @param {string} sourceId - The ID of the damage source (player or "collision")
 * @returns {Object} - Hit result information
 */
function playerHit(playerId, damage, sourceId) {
  const player = players[playerId];
  if (!player || !player.isAlive) return { success: false };
  
  // Apply damage
  player.health -= damage;
  
  // Check if player died
  if (player.health <= 0) {
    player.health = 0;
    player.isAlive = false;
    player.respawnTime = Date.now() + 3000; // 3 seconds respawn time
    
    // Award point to player who caused the damage
    if (sourceId !== "collision" && players[sourceId]) {
      players[sourceId].score += 1;
    }
    
    return {
      success: true,
      killed: true,
      health: player.health,
      sourceId
    };
  }
  
  return {
    success: true,
    killed: false,
    health: player.health,
    sourceId
  };
}

/**
 * Update game state
 * @param {number} deltaTime - Time since last update in seconds
 */
function update(deltaTime) {
  const now = Date.now();
  
  // Update players
  Object.keys(players).forEach(playerId => {
    const player = players[playerId];
    
    // Check for respawn
    if (!player.isAlive && player.respawnTime <= now) {
      respawnPlayer(playerId);
    }
    
    // Skip physics for dead players
    if (!player.isAlive) return;
    
    // Apply physics to the player
    updatePlayerPhysics(player, deltaTime);
    
    // Check for collisions with city
    checkPlayerCityCollisions(player);
    
    // Check for collisions with other players
    checkPlayerCollisions(player);
  });
  
  // Update lasers
  updateLasers(deltaTime);
}

/**
 * Update the physics for a player
 * @param {Object} player - The player object
 * @param {number} deltaTime - Time since last update in seconds
 */
function updatePlayerPhysics(player, deltaTime) {
  // Apply gravity
  player.velocity.y -= GRAVITY * deltaTime;
  
  // Apply drag
  player.velocity.x *= (1 - DRAG_COEFFICIENT * deltaTime);
  player.velocity.y *= (1 - DRAG_COEFFICIENT * deltaTime);
  player.velocity.z *= (1 - DRAG_COEFFICIENT * deltaTime);
  
  // Clamp velocity
  const speed = Math.sqrt(
    player.velocity.x * player.velocity.x +
    player.velocity.y * player.velocity.y +
    player.velocity.z * player.velocity.z
  );
  
  if (speed > MAX_VELOCITY) {
    const scale = MAX_VELOCITY / speed;
    player.velocity.x *= scale;
    player.velocity.y *= scale;
    player.velocity.z *= scale;
  }
  
  // Update position
  player.position.x += player.velocity.x * deltaTime;
  player.position.y += player.velocity.y * deltaTime;
  player.position.z += player.velocity.z * deltaTime;
  
  // Keep player within city bounds
  if (player.position.x < CITY_BOUNDS.minX) {
    player.position.x = CITY_BOUNDS.minX;
    player.velocity.x = 0;
  } else if (player.position.x > CITY_BOUNDS.maxX) {
    player.position.x = CITY_BOUNDS.maxX;
    player.velocity.x = 0;
  }
  
  if (player.position.y < CITY_BOUNDS.minY) {
    player.position.y = CITY_BOUNDS.minY;
    player.velocity.y = 0;
  } else if (player.position.y > CITY_BOUNDS.maxY) {
    player.position.y = CITY_BOUNDS.maxY;
    player.velocity.y = 0;
  }
  
  if (player.position.z < CITY_BOUNDS.minZ) {
    player.position.z = CITY_BOUNDS.minZ;
    player.velocity.z = 0;
  } else if (player.position.z > CITY_BOUNDS.maxZ) {
    player.position.z = CITY_BOUNDS.maxZ;
    player.velocity.z = 0;
  }
}

/**
 * Check for player collisions with city buildings
 * @param {Object} player - The player object
 */
function checkPlayerCityCollisions(player) {
  // Simple collision check with buildings
  for (const building of cityLayout.buildings) {
    if (checkBoxCollision(
      player.position,
      { x: 10, y: 5, z: 10 }, // Player size
      building.position,
      building.size
    )) {
      // Handle collision
      playerHit(player.id, COLLISION_DAMAGE, "collision");
      
      // Push player away from building
      const pushDirection = {
        x: player.position.x - building.position.x,
        y: player.position.y - building.position.y,
        z: player.position.z - building.position.z
      };
      
      // Normalize direction
      const length = Math.sqrt(
        pushDirection.x * pushDirection.x +
        pushDirection.y * pushDirection.y +
        pushDirection.z * pushDirection.z
      );
      
      if (length > 0) {
        pushDirection.x /= length;
        pushDirection.y /= length;
        pushDirection.z /= length;
        
        // Move player away from building
        player.position.x += pushDirection.x * 15;
        player.position.y += pushDirection.y * 15;
        player.position.z += pushDirection.z * 15;
        
        // Reverse velocity
        player.velocity.x = pushDirection.x * Math.abs(player.velocity.x) * 0.5;
        player.velocity.y = pushDirection.y * Math.abs(player.velocity.y) * 0.5;
        player.velocity.z = pushDirection.z * Math.abs(player.velocity.z) * 0.5;
      }
    }
  }
}

/**
 * Check for collisions between players
 * @param {Object} player - The player object
 */
function checkPlayerCollisions(player) {
  Object.keys(players).forEach(otherPlayerId => {
    if (player.id === otherPlayerId) return;
    
    const otherPlayer = players[otherPlayerId];
    if (!otherPlayer.isAlive) return;
    
    // Check collision between players
    if (checkSphereCollision(
      player.position,
      10, // Player radius
      otherPlayer.position,
      10  // Other player radius
    )) {
      // Handle collision
      playerHit(player.id, COLLISION_DAMAGE / 2, otherPlayer.id);
      playerHit(otherPlayer.id, COLLISION_DAMAGE / 2, player.id);
      
      // Calculate collision response
      const dx = player.position.x - otherPlayer.position.x;
      const dy = player.position.y - otherPlayer.position.y;
      const dz = player.position.z - otherPlayer.position.z;
      
      // Normalize direction
      const length = Math.sqrt(dx * dx + dy * dy + dz * dz);
      if (length > 0) {
        const nx = dx / length;
        const ny = dy / length;
        const nz = dz / length;
        
        // Separate players
        player.position.x += nx * 5;
        player.position.y += ny * 5;
        player.position.z += nz * 5;
        
        otherPlayer.position.x -= nx * 5;
        otherPlayer.position.y -= ny * 5;
        otherPlayer.position.z -= nz * 5;
        
        // Exchange velocity (simplified)
        const tempVx = player.velocity.x;
        const tempVy = player.velocity.y;
        const tempVz = player.velocity.z;
        
        player.velocity.x = otherPlayer.velocity.x * 0.8;
        player.velocity.y = otherPlayer.velocity.y * 0.8;
        player.velocity.z = otherPlayer.velocity.z * 0.8;
        
        otherPlayer.velocity.x = tempVx * 0.8;
        otherPlayer.velocity.y = tempVy * 0.8;
        otherPlayer.velocity.z = tempVz * 0.8;
      }
    }
  });
}

/**
 * Update all lasers
 * @param {number} deltaTime - Time since last update in seconds
 */
function updateLasers(deltaTime) {
  const now = Date.now();
  
  // Update each laser
  for (let i = lasers.length - 1; i >= 0; i--) {
    const laser = lasers[i];
    
    // Check if laser has expired
    if (now - laser.createdAt > laser.timeToLive) {
      lasers.splice(i, 1);
      continue;
    }
    
    // Update laser position
    laser.position.x += laser.velocity.x * deltaTime;
    laser.position.y += laser.velocity.y * deltaTime;
    laser.position.z += laser.velocity.z * deltaTime;
    
    // Check for collisions with players
    for (const playerId in players) {
      const player = players[playerId];
      
      // Skip collision with shooter and dead players
      if (playerId === laser.playerId || !player.isAlive) continue;
      
      // Check collision with player
      if (checkSphereCollision(
        laser.position,
        1, // Laser radius
        player.position,
        8  // Player radius
      )) {
        // Player hit by laser
        const hitResult = playerHit(playerId, LASER_DAMAGE, laser.playerId);
        
        // Remove the laser
        lasers.splice(i, 1);
        break;
      }
    }
    
    // Check for collisions with buildings (simplified)
    for (const building of cityLayout.buildings) {
      if (checkBoxCollision(
        laser.position,
        { x: 1, y: 1, z: 1 }, // Laser size
        building.position,
        building.size
      )) {
        // Remove the laser
        lasers.splice(i, 1);
        break;
      }
    }
  }
}

/**
 * Respawn a player
 * @param {string} playerId - The player's ID
 */
function respawnPlayer(playerId) {
  const player = players[playerId];
  if (!player) return;
  
  const spawnPoint = getRandomSpawnPoint();
  
  player.position = spawnPoint;
  player.velocity = { x: 0, y: 0, z: 0 };
  player.health = 100;
  player.isAlive = true;
  player.respawnTime = 0;
}

/**
 * Get a random spawn point
 * @returns {Object} - The spawn point position
 */
function getRandomSpawnPoint() {
  // Create several spawn points at different locations in the city
  const spawnPoints = [
    { x: 0, y: 100, z: 0 },
    { x: 200, y: 150, z: 200 },
    { x: -200, y: 150, z: -200 },
    { x: -200, y: 150, z: 200 },
    { x: 200, y: 150, z: -200 }
  ];
  
  return spawnPoints[Math.floor(Math.random() * spawnPoints.length)];
}

/**
 * Get a player by ID
 * @param {string} playerId - The player's ID
 * @returns {Object|null} - The player or null
 */
function getPlayerById(playerId) {
  return players[playerId] || null;
}

/**
 * Get all players
 * @returns {Object} - All players
 */
function getAllPlayers() {
  return players;
}

/**
 * Get players data for client transmission
 * @returns {Object} - Player data for clients
 */
function getPlayersData() {
  const playersData = {};
  
  Object.keys(players).forEach(playerId => {
    const player = players[playerId];
    
    playersData[playerId] = {
      id: player.id,
      position: player.position,
      rotation: player.rotation,
      health: player.health,
      score: player.score,
      isAlive: player.isAlive
    };
  });
  
  return playersData;
}

/**
 * Get all active lasers
 * @returns {Array} - All lasers
 */
function getLasers() {
  return lasers;
}

/**
 * Get the city layout
 * @returns {Object} - The city layout
 */
function getCityLayout() {
  return cityLayout;
}

/**
 * Generate a simplified city layout for collision detection
 * @returns {Object} - The city layout
 */
function generateCityLayout() {
  const buildings = [];
  const citySize = 1000;
  const blockSize = 100;
  const numBlocks = Math.floor(citySize / blockSize);
  
  // Create seed for pseudo-random generation
  const seed = 12345;
  let randomSeed = seed;
  
  // Simple random function with seed
  const random = () => {
    randomSeed = (randomSeed * 9301 + 49297) % 233280;
    return randomSeed / 233280;
  };
  
  // Generate buildings in a grid pattern
  for (let x = -numBlocks / 2; x < numBlocks / 2; x++) {
    for (let z = -numBlocks / 2; z < numBlocks / 2; z++) {
      const blockX = x * blockSize;
      const blockZ = z * blockSize;
      
      // Add 1-3 buildings per block
      const buildingsPerBlock = 1 + Math.floor(random() * 3);
      
      for (let i = 0; i < buildingsPerBlock; i++) {
        // Determine building size and position
        const width = 10 + random() * 30;
        const height = 50 + random() * 250;
        const depth = 10 + random() * 30;
        
        const offsetX = (random() - 0.5) * (blockSize - width);
        const offsetZ = (random() - 0.5) * (blockSize - depth);
        
        buildings.push({
          position: {
            x: blockX + offsetX,
            y: height / 2,
            z: blockZ + offsetZ
          },
          size: {
            x: width,
            y: height,
            z: depth
          }
        });
      }
    }
  }
  
  return {
    seed,
    buildings
  };
}

/**
 * Check collision between two boxes
 * @param {Object} pos1 - Position of first box
 * @param {Object} size1 - Size of first box
 * @param {Object} pos2 - Position of second box
 * @param {Object} size2 - Size of second box
 * @returns {boolean} - True if collision
 */
function checkBoxCollision(pos1, size1, pos2, size2) {
  return (
    Math.abs(pos1.x - pos2.x) < (size1.x / 2 + size2.x / 2) &&
    Math.abs(pos1.y - pos2.y) < (size1.y / 2 + size2.y / 2) &&
    Math.abs(pos1.z - pos2.z) < (size1.z / 2 + size2.z / 2)
  );
}

/**
 * Check collision between two spheres
 * @param {Object} pos1 - Position of first sphere
 * @param {number} radius1 - Radius of first sphere
 * @param {Object} pos2 - Position of second sphere
 * @param {number} radius2 - Radius of second sphere
 * @returns {boolean} - True if collision
 */
function checkSphereCollision(pos1, radius1, pos2, radius2) {
  const dx = pos1.x - pos2.x;
  const dy = pos1.y - pos2.y;
  const dz = pos1.z - pos2.z;
  const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
  
  return distance < (radius1 + radius2);
}

module.exports = {
  initializeGameState
}; 