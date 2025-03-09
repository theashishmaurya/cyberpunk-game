/**
 * Collision System - Handles collision detection and response
 */

import { buildingCollisions } from '../rendering/cityscape.js';
import { playSound } from '../audio/soundManager.js';

// Collision state tracking
let lastCollisionTime = 0;
const COLLISION_COOLDOWN = 800; // ms between collision sounds

// Debug variables (for visualizing collisions)
let debugEnabled = false;
let debugMarkers = [];

/**
 * Check for collisions between player and environment
 * @param {Object} playerStats - Player stats with position, etc.
 * @param {Object} gameState - Game state
 * @param {Function} collisionCallback - Callback for collision handling
 * @returns {boolean} - Whether a collision occurred
 */
export function checkCollisions(playerStats, gameState, collisionCallback) {
  // Player collision box
  const playerBox = {
    position: { ...playerStats.position },
    size: { x: 8, y: 3, z: 16 } // Size of the flying car
  };
  
  let collisionDetected = false;
  let verticalCollision = false;
  
  // Check collisions with buildings
  for (const building of buildingCollisions) {
    // Skip collision if player is clearly above the building
    // First check if player is completely above the building top
    const playerBottom = playerBox.position.y - playerBox.size.y/2;
    const buildingTop = building.position.y + building.size.y/2;
    
    // Add a small clearance (1 unit) to avoid collisions when just slightly above
    if (playerBottom > buildingTop + 1) {
      // Player is above the building, skip collision check
      continue;
    }
    
    // Now check for actual collision
    if (boxCollision(playerBox, building)) {
      // Determine if this is a vertical collision (top of building)
      // Check if player is just above the building (within a small margin)
      const isLandingOnBuilding = playerBottom >= buildingTop - 3 && 
                              playerBottom <= buildingTop + 3;
      
      const horizontalOverlapX = 
        Math.abs(playerBox.position.x - building.position.x) < 
        (playerBox.size.x / 2 + building.size.x / 2);
      
      const horizontalOverlapZ = 
        Math.abs(playerBox.position.z - building.position.z) < 
        (playerBox.size.z / 2 + building.size.z / 2);
      
      if (isLandingOnBuilding && horizontalOverlapX && horizontalOverlapZ) {
        // Handle landing on top of building
        handleVerticalCollision(playerStats, building, true);
        verticalCollision = true;
      } else {
        // Handle regular collision with building sides
        handleBuildingCollision(playerStats, building);
      }
      
      collisionDetected = true;
      
      // Call the collision callback if provided
      if (collisionCallback) {
        collisionCallback(building);
      }
      
      // We can handle more than one collision if they're of different types
      if (verticalCollision) continue;
      
      // For regular collisions, we only need to handle one at a time
      break;
    }
  }
  
  // Check boundaries of the world (don't let the player go too far)
  const worldBounds = {
    minX: -10000,
    maxX: 10000,
    minY: 5, // Don't go below this height
    maxY: 2000,
    minZ: -10000,
    maxZ: 10000
  };
  
  // Check if player is outside world bounds
  if (playerStats.position.x < worldBounds.minX) {
    playerStats.position.x = worldBounds.minX;
    playerStats.velocity.x = 0;
    collisionDetected = true;
  } else if (playerStats.position.x > worldBounds.maxX) {
    playerStats.position.x = worldBounds.maxX;
    playerStats.velocity.x = 0;
    collisionDetected = true;
  }
  
  if (playerStats.position.y < worldBounds.minY) {
    playerStats.position.y = worldBounds.minY;
    playerStats.velocity.y = 0;
    collisionDetected = true;
  } else if (playerStats.position.y > worldBounds.maxY) {
    playerStats.position.y = worldBounds.maxY;
    playerStats.velocity.y = 0;
    collisionDetected = true;
  }
  
  if (playerStats.position.z < worldBounds.minZ) {
    playerStats.position.z = worldBounds.minZ;
    playerStats.velocity.z = 0;
    collisionDetected = true;
  } else if (playerStats.position.z > worldBounds.maxZ) {
    playerStats.position.z = worldBounds.maxZ;
    playerStats.velocity.z = 0;
    collisionDetected = true;
  }
  
  return collisionDetected;
}

/**
 * Handle vertical collision (landing on top of a building)
 * @param {Object} playerStats - Player stats with position, etc.
 * @param {Object} building - Building object
 * @param {boolean} isTop - Whether collision is with top of building
 */
function handleVerticalCollision(playerStats, building, isTop) {
  if (isTop) {
    // Position the player precisely on top of the building
    const buildingTop = building.position.y + building.size.y/2;
    const playerHalfHeight = 1.5; // Half height of player collision box
    
    playerStats.position.y = buildingTop + playerHalfHeight;
    
    // Stop downward velocity
    if (playerStats.velocity.y < 0) {
      playerStats.velocity.y = 0;
    }
    
    // Apply some friction to horizontal movement
    const friction = 0.95;
    playerStats.velocity.x *= friction;
    playerStats.velocity.z *= friction;
    
    // Play landing sound if velocity was significant
    const landingSpeed = Math.abs(playerStats.velocity.y);
    if (landingSpeed > 10) {
      const now = Date.now();
      if (now - lastCollisionTime > COLLISION_COOLDOWN) {
        playSound('collision', { 
          volume: Math.min(0.7, landingSpeed * 0.02),
          playbackRate: 0.6 + Math.random() * 0.2
        });
        lastCollisionTime = now;
      }
    }
  }
}

/**
 * Handle building collision with improved anti-stick mechanics
 * @param {Object} playerStats - Player stats with position, etc.
 * @param {Object} building - Building object
 */
function handleBuildingCollision(playerStats, building) {
  // Calculate collision response
  const collisionVector = {
    x: playerStats.position.x - building.position.x,
    y: playerStats.position.y - building.position.y,
    z: playerStats.position.z - building.position.z
  };
  
  // Calculate distance between centers
  const distanceSquared = 
    collisionVector.x * collisionVector.x + 
    collisionVector.z * collisionVector.z;
    
  // Normalize collision vector
  const length = Math.sqrt(
    collisionVector.x * collisionVector.x +
    collisionVector.y * collisionVector.y +
    collisionVector.z * collisionVector.z
  );
  
  if (length > 0) {
    collisionVector.x /= length;
    collisionVector.y /= length;
    collisionVector.z /= length;
  }
  
  // Determine collision strength based on player's velocity relative to collision direction
  const velocityAlongCollision = 
    playerStats.velocity.x * collisionVector.x +
    playerStats.velocity.y * collisionVector.y +
    playerStats.velocity.z * collisionVector.z;
  
  // Higher bump distance if moving fast toward the obstacle
  const minBumpDistance = 3;
  const velocityFactor = Math.abs(velocityAlongCollision) * 0.1;
  const bumpDistance = minBumpDistance + velocityFactor;
  
  // Apply bump force, with higher priority to horizontal movement to prevent getting stuck
  playerStats.position.x += collisionVector.x * bumpDistance * 1.2;
  playerStats.position.y += collisionVector.y * bumpDistance * 0.8;
  playerStats.position.z += collisionVector.z * bumpDistance * 1.2;
  
  // Adjust velocity - cancel out velocity toward the obstacle
  if (velocityAlongCollision < 0) {
    // Bouncing - only if moving toward the obstacle
    const damping = 0.3; // Reduced bounce effect
    const repulsionStrength = -velocityAlongCollision * damping;
    
    playerStats.velocity.x += collisionVector.x * repulsionStrength;
    playerStats.velocity.y += collisionVector.y * repulsionStrength;
    playerStats.velocity.z += collisionVector.z * repulsionStrength;
  } else {
    // Sliding along the surface - no bounce needed
    // Keep some of the velocity component parallel to the surface
    const parallelFactor = 0.8;
    const vx = playerStats.velocity.x;
    const vy = playerStats.velocity.y;
    const vz = playerStats.velocity.z;
    
    // Remove velocity component toward the obstacle
    playerStats.velocity.x -= velocityAlongCollision * collisionVector.x;
    playerStats.velocity.y -= velocityAlongCollision * collisionVector.y;
    playerStats.velocity.z -= velocityAlongCollision * collisionVector.z;
    
    // Scale the remaining velocity
    playerStats.velocity.x *= parallelFactor;
    playerStats.velocity.y *= parallelFactor;
    playerStats.velocity.z *= parallelFactor;
  }
  
  // Play collision sound (with cooldown to prevent sound spam)
  const now = Date.now();
  if (now - lastCollisionTime > COLLISION_COOLDOWN) {
    playSound('collision', { 
      volume: Math.min(1.0, getCollisionIntensity(playerStats) * 0.1),
      playbackRate: 0.8 + Math.random() * 0.4
    });
    lastCollisionTime = now;
  }
}

/**
 * Calculate collision intensity based on player velocity
 * @param {Object} playerStats - Player stats with velocity
 * @returns {number} - Collision intensity
 */
function getCollisionIntensity(playerStats) {
  // Calculate the magnitude of velocity
  return Math.sqrt(
    playerStats.velocity.x * playerStats.velocity.x +
    playerStats.velocity.y * playerStats.velocity.y +
    playerStats.velocity.z * playerStats.velocity.z
  );
}

/**
 * Check for collision between two boxes
 * @param {Object} box1 - First box with position and size
 * @param {Object} box2 - Second box with position and size
 * @returns {boolean} - Whether the boxes collide
 */
function boxCollision(box1, box2) {
  return (
    Math.abs(box1.position.x - box2.position.x) < (box1.size.x / 2 + box2.size.x / 2) &&
    Math.abs(box1.position.y - box2.position.y) < (box1.size.y / 2 + box2.size.y / 2) &&
    Math.abs(box1.position.z - box2.position.z) < (box1.size.z / 2 + box2.size.z / 2)
  );
}

/**
 * Enable or disable collision debugging
 * @param {boolean} enabled - Whether debug is enabled
 * @param {THREE.Scene} scene - The scene for debug markers
 */
export function setDebugMode(enabled, scene) {
  debugEnabled = enabled;
  
  // Clear any existing debug markers
  if (scene) {
    debugMarkers.forEach(marker => scene.remove(marker));
    debugMarkers = [];
  }
} 