/**
 * Game state module - maintains the authoritative game state on the server
 */

import { Vector3 } from '../../types.js';

// Interfaces
interface Player {
  id: string;
  position: Vector3;
  rotation: Vector3;
  velocity: Vector3;
  health: number;
  score: number;
  lastUpdate: number;
  isAlive: boolean;
  respawnTime: number;
  lastShotTime: number;
}

interface Laser {
  id: string;
  playerId: string;
  position: Vector3;
  rotation: Vector3;
  velocity: Vector3;
  createdAt: number;
  timeToLive: number;
}

interface Building {
  position: Vector3;
  size: Vector3;
  type: string;
  height: number;
}

interface CityBounds {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  minZ: number;
  maxZ: number;
}

interface PlayerData {
  id: string;
  position: Vector3;
  rotation: Vector3;
  velocity: Vector3;
  health: number;
  score: number;
  isAlive: boolean;
}

interface HitResult {
  success: boolean;
  killed?: boolean;
  health?: number;
  sourceId?: string;
}

export interface GameStateManager {
  addPlayer: (playerId: string, initialData: Partial<Player>) => Player;
  removePlayer: (playerId: string) => void;
  updatePlayer: (playerId: string, updateData: Partial<Player>) => Player | null;
  firePlayerLaser: (playerId: string, laserData: Partial<Laser>) => Laser | null;
  playerHit: (playerId: string, damage: number, sourceId: string) => HitResult;
  update: (deltaTime: number) => void;
  getPlayerById: (playerId: string) => Player | null;
  getAllPlayers: () => Record<string, Player>;
  getPlayersData: () => Record<string, PlayerData>;
  getLasers: () => Laser[];
  getCityLayout: () => Building[];
  CITY_BOUNDS: CityBounds;
  LASER_DAMAGE: number;
}

// Game physics constants
const GRAVITY = 9.8; // Gravity acceleration (m/s^2)
const DRAG_COEFFICIENT = 0.1; // Air resistance
const MAX_VELOCITY = 200; // Maximum velocity (m/s)
const COLLISION_DAMAGE = 20; // Damage from collisions
const LASER_DAMAGE = 10; // Damage from laser hits
const CITY_BOUNDS: CityBounds = {
  minX: -1000,
  maxX: 1000,
  minY: 0,
  maxY: 1000,
  minZ: -1000,
  maxZ: 1000
};

// Game state
let players: Record<string, Player> = {};
let lasers: Laser[] = [];
let cityLayout: Building[] = generateCityLayout();

/**
 * Initialize the game state
 * @returns {GameStateManager} - The game state manager
 */
export function initializeGameState(): GameStateManager {
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
    CITY_BOUNDS,
    LASER_DAMAGE
  };
}

/**
 * Add a new player to the game
 * @param {string} playerId - The player's ID
 * @param {Partial<Player>} initialData - The player's initial data
 * @returns {Player} - The created player
 */
function addPlayer(playerId: string, initialData: Partial<Player>): Player {
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
function removePlayer(playerId: string): void {
  delete players[playerId];
}

/**
 * Update a player's data
 * @param {string} playerId - The player's ID
 * @param {Partial<Player>} updateData - The player's updated data
 * @returns {Player | null} - The updated player or null
 */
function updatePlayer(playerId: string, updateData: Partial<Player>): Player | null {
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
 * @param {Partial<Laser>} laserData - The laser data
 * @returns {Laser | null} - The created laser or null
 */
function firePlayerLaser(playerId: string, laserData: Partial<Laser>): Laser | null {
  const player = players[playerId];
  if (!player || !player.isAlive) return null;
  
  // Check if player can fire (cooldown)
  const now = Date.now();
  if (now - player.lastShotTime < 1000) return null;
  
  player.lastShotTime = now;
  
  // Create laser
  const laser: Laser = {
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
 * @returns {HitResult} - Hit result information
 */
function playerHit(playerId: string, damage: number, sourceId: string): HitResult {
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
function update(deltaTime: number): void {
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
 * Update player physics
 * @param {Player} player - The player to update
 * @param {number} deltaTime - Time since last update in seconds
 */
function updatePlayerPhysics(player: Player, deltaTime: number): void {
  // Apply gravity (can be disabled for flying cars)
  //player.velocity.y -= GRAVITY * deltaTime;
  
  // Apply drag/air resistance
  player.velocity.x *= (1 - DRAG_COEFFICIENT * deltaTime);
  player.velocity.y *= (1 - DRAG_COEFFICIENT * deltaTime);
  player.velocity.z *= (1 - DRAG_COEFFICIENT * deltaTime);
  
  // Limit velocity
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
  
  // Keep player within world bounds
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
 * Check for collisions between player and city buildings
 * @param {Player} player - The player to check
 */
function checkPlayerCityCollisions(player: Player): void {
  // Player collision box size
  const playerSize = { x: 8, y: 3, z: 16 }; // Size of the flying car
  
  for (const building of cityLayout) {
    // Skip if player is far above the building
    if (player.position.y - playerSize.y/2 > building.position.y + building.size.y/2 + 1) {
      continue;
    }
    
    // Check for collision
    if (checkBoxCollision(
      player.position, playerSize,
      building.position, building.size
    )) {
      // Simple bounce response
      const dx = player.position.x - building.position.x;
      const dy = player.position.y - building.position.y;
      const dz = player.position.z - building.position.z;
      
      // Normalize direction vector
      const length = Math.sqrt(dx*dx + dy*dy + dz*dz);
      if (length === 0) continue;
      
      const nx = dx / length;
      const ny = dy / length;
      const nz = dz / length;
      
      // Calculate damage based on velocity
      const relativeVelocity = -(
        player.velocity.x * nx +
        player.velocity.y * ny +
        player.velocity.z * nz
      );
      
      // Only apply collision response for high-speed collisions
      if (relativeVelocity > 5) {
        // Apply damage
        const damage = Math.floor(relativeVelocity * 0.5);
        if (damage > 0) {
          playerHit(player.id, damage, "collision");
        }
        
        // Bounce response - reverse velocity component along normal
        const bounceForce = relativeVelocity * 0.5; // 50% energy loss
        player.velocity.x += nx * bounceForce;
        player.velocity.y += ny * bounceForce;
        player.velocity.z += nz * bounceForce;
        
        // Push player out of collision
        player.position.x += nx * 2;
        player.position.y += ny * 2;
        player.position.z += nz * 2;
      }
    }
  }
}

/**
 * Check for collisions between players
 * @param {Player} player - The player to check
 */
function checkPlayerCollisions(player: Player): void {
  // Player collision sphere radius
  const playerRadius = 5;
  
  Object.values(players).forEach(otherPlayer => {
    // Skip self or dead players
    if (player.id === otherPlayer.id || !otherPlayer.isAlive || !player.isAlive) {
      return;
    }
    
    // Check for sphere collision
    if (checkSphereCollision(
      player.position, playerRadius,
      otherPlayer.position, playerRadius
    )) {
      // Calculate collision response
      const dx = player.position.x - otherPlayer.position.x;
      const dy = player.position.y - otherPlayer.position.y;
      const dz = player.position.z - otherPlayer.position.z;
      
      // Normalize direction vector
      const length = Math.sqrt(dx*dx + dy*dy + dz*dz);
      if (length === 0) return;
      
      const nx = dx / length;
      const ny = dy / length;
      const nz = dz / length;
      
      // Calculate relative velocity
      const relativeVelocityX = player.velocity.x - otherPlayer.velocity.x;
      const relativeVelocityY = player.velocity.y - otherPlayer.velocity.y;
      const relativeVelocityZ = player.velocity.z - otherPlayer.velocity.z;
      
      // Calculate impact velocity along normal
      const impactVelocity = 
        relativeVelocityX * nx +
        relativeVelocityY * ny +
        relativeVelocityZ * nz;
      
      // Only apply collision response for closing velocities
      if (impactVelocity > 0) return;
      
      // Apply damage for high-speed collisions
      if (Math.abs(impactVelocity) > 10) {
        const damage = Math.floor(Math.abs(impactVelocity) * 0.3);
        playerHit(player.id, damage, "collision");
        playerHit(otherPlayer.id, damage, "collision");
      }
      
      // Collision response - simplified physics
      const restitution = 0.8; // Bouncy collisions
      const impulse = -impactVelocity * (1 + restitution);
      
      // Update velocities
      player.velocity.x += nx * impulse * 0.5;
      player.velocity.y += ny * impulse * 0.5;
      player.velocity.z += nz * impulse * 0.5;
      
      otherPlayer.velocity.x -= nx * impulse * 0.5;
      otherPlayer.velocity.y -= ny * impulse * 0.5;
      otherPlayer.velocity.z -= nz * impulse * 0.5;
      
      // Push players apart to prevent sticking
      player.position.x += nx * 0.5;
      player.position.y += ny * 0.5;
      player.position.z += nz * 0.5;
      
      otherPlayer.position.x -= nx * 0.5;
      otherPlayer.position.y -= ny * 0.5;
      otherPlayer.position.z -= nz * 0.5;
    }
  });
}

/**
 * Update lasers (movement, collisions, etc.)
 * @param {number} deltaTime - Time since last update in seconds
 */
function updateLasers(deltaTime: number): void {
  const now = Date.now();
  const lasersToRemove: string[] = [];
  
  // Update laser positions and check for collisions
  lasers.forEach((laser, index) => {
    // Check if laser has expired
    if (now - laser.createdAt > laser.timeToLive) {
      lasersToRemove.push(laser.id);
      return;
    }
    
    // Update position
    laser.position.x += laser.velocity.x * deltaTime;
    laser.position.y += laser.velocity.y * deltaTime;
    laser.position.z += laser.velocity.z * deltaTime;
    
    // Check for collisions with players
    Object.values(players).forEach(player => {
      // Skip collision with own laser or dead players
      if (laser.playerId === player.id || !player.isAlive) {
        return;
      }
      
      // Check distance to player (simple sphere collision)
      const dx = player.position.x - laser.position.x;
      const dy = player.position.y - laser.position.y;
      const dz = player.position.z - laser.position.z;
      const distanceSquared = dx*dx + dy*dy + dz*dz;
      
      // Player hit sphere radius
      const hitRadius = 5;
      
      if (distanceSquared < hitRadius * hitRadius) {
        // Player hit by laser
        const hitResult = playerHit(player.id, LASER_DAMAGE, laser.playerId);
        
        // Remove laser
        lasersToRemove.push(laser.id);
      }
    });
    
    // Check for collision with buildings
    for (const building of cityLayout) {
      // Skip if laser is far above the building
      if (laser.position.y > building.position.y + building.size.y/2 + 10) {
        continue;
      }
      
      // Simple point to box collision check
      if (laser.position.x >= building.position.x - building.size.x/2 &&
          laser.position.x <= building.position.x + building.size.x/2 &&
          laser.position.y >= building.position.y - building.size.y/2 &&
          laser.position.y <= building.position.y + building.size.y/2 &&
          laser.position.z >= building.position.z - building.size.z/2 &&
          laser.position.z <= building.position.z + building.size.z/2) {
        // Laser hit building
        lasersToRemove.push(laser.id);
        break;
      }
    }
  });
  
  // Remove destroyed lasers
  lasers = lasers.filter(laser => !lasersToRemove.includes(laser.id));
}

/**
 * Respawn a player
 * @param {string} playerId - The player's ID
 */
function respawnPlayer(playerId: string): void {
  const player = players[playerId];
  if (!player) return;
  
  // Reset player state
  player.health = 100;
  player.isAlive = true;
  player.velocity = { x: 0, y: 0, z: 0 };
  
  // Move to random spawn point
  const spawnPoint = getRandomSpawnPoint();
  player.position = spawnPoint;
}

/**
 * Get a random spawn point
 * @returns {Vector3} - A random spawn position
 */
function getRandomSpawnPoint(): Vector3 {
  // Create several potential spawn points
  const spawnPoints = [
    { x: 0, y: 100, z: 0 },
    { x: 200, y: 120, z: 200 },
    { x: -200, y: 150, z: -200 },
    { x: 300, y: 180, z: -100 },
    { x: -150, y: 200, z: 250 }
  ];
  
  // Choose a random spawn point
  const index = Math.floor(Math.random() * spawnPoints.length);
  return spawnPoints[index];
}

/**
 * Get a player by ID
 * @param {string} playerId - The player's ID
 * @returns {Player | null} - The player or null
 */
function getPlayerById(playerId: string): Player | null {
  return players[playerId] || null;
}

/**
 * Get all players
 * @returns {Record<string, Player>} - All players
 */
function getAllPlayers(): Record<string, Player> {
  return players;
}

/**
 * Get players data for clients
 * @returns {Record<string, PlayerData>} - Players data
 */
function getPlayersData(): Record<string, PlayerData> {
  const playersData: Record<string, PlayerData> = {};
  
  Object.keys(players).forEach(playerId => {
    const player = players[playerId];
    
    playersData[playerId] = {
      id: player.id,
      position: player.position,
      rotation: player.rotation,
      velocity: player.velocity,
      health: player.health,
      score: player.score,
      isAlive: player.isAlive
    };
  });
  
  return playersData;
}

/**
 * Get all lasers
 * @returns {Laser[]} - All lasers
 */
function getLasers(): Laser[] {
  return lasers;
}

/**
 * Get city layout
 * @returns {Building[]} - The city layout
 */
function getCityLayout(): Building[] {
  return cityLayout;
}

/**
 * Generate a random city layout
 * @returns {Building[]} - The generated city layout
 */
function generateCityLayout(): Building[] {
  const buildings: Building[] = [];
  const gridSize = 10;
  const cellSize = 100;
  
  // Helper for random values
  const random = () => {
    return Math.random();
  };
  
  // Generate buildings on a grid
  for (let x = -gridSize; x <= gridSize; x++) {
    for (let z = -gridSize; z <= gridSize; z++) {
      // Skip some cells for roads
      if (x % 3 === 0 || z % 3 === 0) continue;
      
      // Random building properties
      const width = 20 + random() * 30;
      const depth = 20 + random() * 30;
      const height = 50 + random() * 150;
      
      // Position in cell with some variation
      const posX = x * cellSize + (random() - 0.5) * cellSize * 0.5;
      const posZ = z * cellSize + (random() - 0.5) * cellSize * 0.5;
      
      // Add building
      buildings.push({
        position: {
          x: posX,
          y: height / 2, // Position is at the center of the building
          z: posZ
        },
        size: {
          x: width,
          y: height,
          z: depth
        },
        type: 'building',
        height
      });
    }
  }
  
  return buildings;
}

/**
 * Check for collision between two boxes
 * @param {Vector3} pos1 - Position of first box
 * @param {Vector3} size1 - Size of first box
 * @param {Vector3} pos2 - Position of second box
 * @param {Vector3} size2 - Size of second box
 * @returns {boolean} - Whether the boxes are colliding
 */
function checkBoxCollision(
  pos1: Vector3, size1: Vector3,
  pos2: Vector3, size2: Vector3
): boolean {
  return (
    pos1.x + size1.x/2 > pos2.x - size2.x/2 &&
    pos1.x - size1.x/2 < pos2.x + size2.x/2 &&
    pos1.y + size1.y/2 > pos2.y - size2.y/2 &&
    pos1.y - size1.y/2 < pos2.y + size2.y/2 &&
    pos1.z + size1.z/2 > pos2.z - size2.z/2 &&
    pos1.z - size1.z/2 < pos2.z + size2.z/2
  );
}

/**
 * Check for collision between two spheres
 * @param {Vector3} pos1 - Position of first sphere
 * @param {number} radius1 - Radius of first sphere
 * @param {Vector3} pos2 - Position of second sphere
 * @param {number} radius2 - Radius of second sphere
 * @returns {boolean} - Whether the spheres are colliding
 */
function checkSphereCollision(
  pos1: Vector3, radius1: number,
  pos2: Vector3, radius2: number
): boolean {
  const dx = pos1.x - pos2.x;
  const dy = pos1.y - pos2.y;
  const dz = pos1.z - pos2.z;
  const distanceSquared = dx*dx + dy*dy + dz*dz;
  const radiusSum = radius1 + radius2;
  
  return distanceSquared < radiusSum * radiusSum;
} 