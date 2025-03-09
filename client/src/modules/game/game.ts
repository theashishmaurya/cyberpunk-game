import { updateBillboard } from '../rendering/billboard';
import { checkCollisions, setDebugMode } from './collisionSystem';
import { initSoundManager, playSound, playMusic, startEngineSound, updateEngineSound } from '../audio/soundManager';
import { Scene, Vector3 } from '@babylonjs/core';
import { AppState, RendererInstance, NetworkManager, GameModule } from '../../types';


// Game state
let appState: AppState;
let renderer: RendererInstance;
let networkManager: NetworkManager | null = null;
let gameLoop: number | null = null;
let lastUpdateTime = 0;
let laserCooldown = 0;
let cityManager: any;
let soundManager: any;
let isFireButtonHeld = false; // Track if fire button is being held

/**
 * Initialize the game logic
 * @param {AppState} state - The application state
 * @param {RendererInstance} rendererModule - The renderer module
 * @returns {GameModule} - The game module
 */
export async function initializeGameLogic(state: AppState, rendererModule: RendererInstance): Promise<GameModule> {
  appState = state;
  renderer = rendererModule;
  
  // Store the city manager reference
  if (renderer.cityManager) {
    cityManager = renderer.cityManager;
  }
  
  // Initialize sound system
  soundManager = initSoundManager(appState.gameOptions.soundEnabled);
  
  // Setup debug mode if requested
  if (appState.gameOptions.debug) {
    setDebugMode(true, renderer.scene);
  }
  
  // Set up game loop
  setupGameLoop();
  
  // Start with ambient sounds
  playMusic('bg_music', 0.2);
  startEngineSound(0.3);
  playSound('city_ambient', { volume: 0.1, loop: true });
  
  // Return game module
  return {
    start,
    stop,
    update,
    updatePlayerVelocity,
    updatePlayerRotation,
    fireLaser,
    resetPlayer,
    setNetworkManager: (nm: NetworkManager) => {
      networkManager = nm;
    },
    showHitEffect,
    showRespawnEffect,
    setFireButtonState,
    toggleSound: () => {
      if (soundManager) {
        const newState = !appState.gameOptions.soundEnabled;
        appState.gameOptions.soundEnabled = newState;
        soundManager.setEnabled(newState);
        return newState;
      }
      return appState.gameOptions.soundEnabled;
    },
    toggleDebug: () => {
      const newState = !appState.gameOptions.debug;
      appState.gameOptions.debug = newState;
      setDebugMode(newState, renderer.scene);
      return newState;
    }
  };
}

/**
 * Set up the game loop
 */
function setupGameLoop(): void {
  let lastTimestamp = 0;
  
  gameLoop = requestAnimationFrame(function animate(timestamp) {
    // Calculate delta time in seconds
    const deltaTime = (timestamp - lastTimestamp) / 1000;
    lastTimestamp = timestamp;
    
    // Update game state
    if (appState.gameRunning) {
      update(deltaTime);
    }
    
    // Continue loop
    gameLoop = requestAnimationFrame(animate);
  });
}

/**
 * Start the game
 */
function start(): void {
  appState.gameRunning = true;
  
  // Restart engine sound
  if (soundManager && soundManager.getSoundEnabled()) {
    startEngineSound(0.3);
  }
}

/**
 * Stop the game
 */
function stop(): void {
  appState.gameRunning = false;
  
  // Cancel game loop if needed
  if (gameLoop !== null) {
    cancelAnimationFrame(gameLoop);
    gameLoop = null;
  }
}

/**
 * Update game state
 * @param {number} deltaTime - Time since last update in seconds
 */
function update(deltaTime: number): void {
  // Limit delta time to avoid large jumps
  const limitedDelta = Math.min(deltaTime, 0.1);
  
  // Update player position and physics
  updatePlayerPosition(limitedDelta);
  
  // Check for collisions
  if (renderer.scene && renderer.playerCar) {
    const collisionObject = checkCollisions(
      renderer.playerCar,
      renderer.scene,
      appState.playerStats.velocity
    );
    
    if (collisionObject) {
      handleCollision(collisionObject);
    }
  }
  
  // Update billboards
  updateBillboards(limitedDelta);
  
  // Update engine sound based on speed
  const speed = Math.sqrt(
    appState.playerStats.velocity.x * appState.playerStats.velocity.x +
    appState.playerStats.velocity.z * appState.playerStats.velocity.z
  );
  
  updateEngineSound(speed / 10, appState.playerStats.boosting);
  
  // Decrement laser cooldown
  if (laserCooldown > 0) {
    laserCooldown -= limitedDelta;
  }
  
  // Auto-fire laser if button held
  if (isFireButtonHeld && laserCooldown <= 0) {
    fireLaser();
  }
  
  // Send updates to server if connected
  if (networkManager && lastUpdateTime + 0.05 < Date.now() / 1000) {
    networkManager.sendPlayerUpdate(appState.playerStats);
    lastUpdateTime = Date.now() / 1000;
  }
}

/**
 * Handle collision with an object
 * @param {any} collisionObject - The object collided with
 */
function handleCollision(collisionObject: any): void {
  // Get collision velocity magnitude
  const velocityMagnitude = Math.sqrt(
    appState.playerStats.velocity.x * appState.playerStats.velocity.x +
    appState.playerStats.velocity.y * appState.playerStats.velocity.y +
    appState.playerStats.velocity.z * appState.playerStats.velocity.z
  );
  
  // Only process significant collisions
  if (velocityMagnitude < 0.5) return;
  
  // Calculate collision response
  appState.playerStats.velocity.x *= -0.5;
  appState.playerStats.velocity.z *= -0.5;
  
  // Apply damage based on collision velocity
  const damage = Math.floor(velocityMagnitude * 5);
  
  if (damage > 0) {
    appState.playerStats.health -= damage;
    
    // Play collision sound
    playSound('collision', {
      volume: Math.min(1.0, velocityMagnitude / 10),
      playbackRate: 0.8 + Math.random() * 0.4
    });
    
    // Show hit effect
    if (renderer.createExplosion) {
      renderer.createExplosion({
        x: appState.playerStats.position.x,
        y: appState.playerStats.position.y,
        z: appState.playerStats.position.z
      }, 0.5);
    }
    
    // Check for death
    if (appState.playerStats.health <= 0) {
      // Reset player
      resetPlayer();
    }
  }
}

/**
 * Update player position based on physics
 * @param {number} deltaTime - Time since last update in seconds
 */
function updatePlayerPosition(deltaTime: number): void {
  // Apply gravity
  appState.playerStats.velocity.y -= 9.8 * deltaTime;
  
  // Apply drag/air resistance
  const drag = 0.95;
  appState.playerStats.velocity.x *= drag;
  appState.playerStats.velocity.z *= drag;
  
  // Apply velocity to position
  appState.playerStats.position.x += appState.playerStats.velocity.x * deltaTime;
  appState.playerStats.position.y += appState.playerStats.velocity.y * deltaTime;
  appState.playerStats.position.z += appState.playerStats.velocity.z * deltaTime;
  
  // Minimum height above ground
  const MIN_HEIGHT = 5;
  if (appState.playerStats.position.y < MIN_HEIGHT) {
    appState.playerStats.position.y = MIN_HEIGHT;
    appState.playerStats.velocity.y = 0;
  }
  
  // Update renderer with new position
  if (renderer.updatePlayerPosition) {
    renderer.updatePlayerPosition(appState.playerStats);
  }
}

/**
 * Update billboards in the scene
 * @param {number} deltaTime - Time since last update in seconds
 */
function updateBillboards(deltaTime: number): void {
  if (!renderer.scene) return;
  
  // Get billboards from city manager
  const billboards = renderer.cityManager?.getBillboards();
  
  if (billboards) {
    // Update each billboard
    billboards.forEach((billboard: any) => {
      updateBillboard(billboard, deltaTime, renderer.scene);
    });
  }
}

/**
 * Update the player's velocity
 * @param {Object} velocityChange - The velocity change object
 * @param {number} [velocityChange.x] - X velocity change
 * @param {number} [velocityChange.y] - Y velocity change
 * @param {number} [velocityChange.z] - Z velocity change
 * @param {boolean} [velocityChange.boost] - Boost flag
 */
function updatePlayerVelocity(velocityChange: {x?: number, y?: number, z?: number, boost?: boolean}): void {
  // Get forward direction based on rotation
  const forwardX = Math.sin(appState.playerStats.rotation.y);
  const forwardZ = Math.cos(appState.playerStats.rotation.y);
  
  // Get right direction (perpendicular to forward)
  const rightX = Math.sin(appState.playerStats.rotation.y + Math.PI / 2);
  const rightZ = Math.cos(appState.playerStats.rotation.y + Math.PI / 2);
  
  // Default acceleration
  let acceleration = 20;
  
  // Check if boosting
  if (velocityChange.boost) {
    acceleration *= 2;
    appState.playerStats.boosting = true;
  } else {
    appState.playerStats.boosting = false;
  }
  
  // Apply forward/backward movement (Z axis)
  if (velocityChange.z !== undefined) {
    appState.playerStats.velocity.x += forwardX * velocityChange.z * acceleration;
    appState.playerStats.velocity.z += forwardZ * velocityChange.z * acceleration;
  }
  
  // Apply left/right movement (X axis)
  if (velocityChange.x !== undefined) {
    appState.playerStats.velocity.x += rightX * velocityChange.x * acceleration;
    appState.playerStats.velocity.z += rightZ * velocityChange.x * acceleration;
  }
  
  // Apply up/down movement (Y axis)
  if (velocityChange.y !== undefined) {
    // Vertical movement is direct
    appState.playerStats.velocity.y += velocityChange.y * acceleration;
  }
  
  // Limit maximum velocity
  const maxSpeed = appState.playerStats.boosting ? 100 : 50;
  const currentSpeed = Math.sqrt(
    appState.playerStats.velocity.x * appState.playerStats.velocity.x +
    appState.playerStats.velocity.z * appState.playerStats.velocity.z
  );
  
  if (currentSpeed > maxSpeed) {
    const scale = maxSpeed / currentSpeed;
    appState.playerStats.velocity.x *= scale;
    appState.playerStats.velocity.z *= scale;
  }
}

/**
 * Update player rotation
 * @param {Object} rotationChange - Changes to apply to rotation
 */
function updatePlayerRotation(rotationChange: {x?: number, y?: number, z?: number}): void {
  // Apply rotation changes
  if (rotationChange.y !== undefined) {
    appState.playerStats.rotation.y += rotationChange.y;
  }
  
  if (rotationChange.x !== undefined) {
    appState.playerStats.rotation.x += rotationChange.x;
    
    // Limit pitch rotation
    const MAX_PITCH = 0.4;
    appState.playerStats.rotation.x = Math.max(-MAX_PITCH, Math.min(MAX_PITCH, appState.playerStats.rotation.x));
  }
  
  if (rotationChange.z !== undefined) {
    appState.playerStats.rotation.z += rotationChange.z;
    
    // Limit roll rotation
    const MAX_ROLL = 0.3;
    appState.playerStats.rotation.z = Math.max(-MAX_ROLL, Math.min(MAX_ROLL, appState.playerStats.rotation.z));
    
    // Auto-return to level flight
    if (Math.abs(rotationChange.z) < 0.01) {
      appState.playerStats.rotation.z *= 0.9;
    }
  }
}

/**
 * Fire laser from player vehicle
 */
function fireLaser(): void {
  // Check cooldown
  if (laserCooldown > 0) return;
  
  // Get player position and rotation
  const position = {
    x: appState.playerStats.position.x,
    y: appState.playerStats.position.y,
    z: appState.playerStats.position.z
  };
  
  const rotation = {
    x: appState.playerStats.rotation.x,
    y: appState.playerStats.rotation.y,
    z: appState.playerStats.rotation.z
  };
  
  // Create laser effect
  if (renderer.fireLaser) {
    renderer.fireLaser({
      position,
      rotation,
      color: '#ff0000'
    });
  }
  
  // Play laser sound
  playSound('laser_shot', {
    volume: 0.4,
    playbackRate: 1 + Math.random() * 0.2
  });
  
  // Set cooldown (0.2 seconds)
  laserCooldown = 0.2;
  
  // Send to server if connected
  if (networkManager && networkManager.sendLaserShot) {
    networkManager.sendLaserShot({
      position,
      rotation
    });
  }
}

/**
 * Show hit effect when player is hit
 * @param {Object} fromDirection - Direction of the hit
 */
function showHitEffect(fromDirection: {x: number, y: number, z: number}): void {
  // Calculate impact direction relative to player
  const playerRotationY = appState.playerStats.rotation.y;
  
  // Normalize the incoming direction
  const dirLength = Math.sqrt(
    fromDirection.x * fromDirection.x + 
    fromDirection.z * fromDirection.z
  );
  
  const normalizedDir = {
    x: fromDirection.x / dirLength,
    z: fromDirection.z / dirLength
  };
  
  // Get player's forward vector
  const playerForward = {
    x: Math.sin(playerRotationY),
    z: Math.cos(playerRotationY)
  };
  
  // Calculate dot product to determine if hit from front or back
  const dotProduct = normalizedDir.x * playerForward.x + normalizedDir.z * playerForward.z;
  
  // Calculate cross product to determine if hit from left or right
  const crossProduct = normalizedDir.x * playerForward.z - normalizedDir.z * playerForward.x;
  
  // Create a hit marker in the UI
  let hitDirection = "";
  if (dotProduct > 0.5) {
    hitDirection = "front";
  } else if (dotProduct < -0.5) {
    hitDirection = "back";
  } else if (crossProduct > 0) {
    hitDirection = "right";
  } else {
    hitDirection = "left";
  }
  
  // Create an HTML element for the hit indicator
  const hitIndicator = document.createElement('div');
  hitIndicator.className = `hit-indicator hit-${hitDirection}`;
  document.body.appendChild(hitIndicator);
  
  // Remove after animation
  setTimeout(() => {
    hitIndicator.remove();
  }, 1000);
  
  // Red flash effect on screen
  const flashOverlay = document.createElement('div');
  flashOverlay.className = 'damage-flash';
  document.body.appendChild(flashOverlay);
  
  // Fade out and remove
  setTimeout(() => {
    flashOverlay.style.opacity = '0';
    setTimeout(() => {
      flashOverlay.remove();
    }, 500);
  }, 50);
  
  // Play hit sound
  playSound('collision', { volume: 0.3 });
}

/**
 * Reset player after death
 */
function resetPlayer(): void {
  // Set health back to full
  appState.playerStats.health = 100;
  
  // Reset velocity
  appState.playerStats.velocity = { x: 0, y: 0, z: 0 };
  
  // Choose a random spawn point (or a fixed point if no spawn points)
  const spawnPoint = {
    x: 0, 
    y: 50, 
    z: 0
  };
  
  // Set position to spawn point
  appState.playerStats.position = { ...spawnPoint };
  
  // Reset rotation
  appState.playerStats.rotation = { x: 0, y: 0, z: 0 };
  
  // Play respawn effect
  showRespawnEffect();
}

/**
 * Show respawn effect
 */
function showRespawnEffect(): void {
  // Play respawn sound
  playSound('select', { volume: 0.5 });
  
  // Create respawn visual effect
  if (renderer.createExplosion) {
    renderer.createExplosion({
      x: appState.playerStats.position.x,
      y: appState.playerStats.position.y,
      z: appState.playerStats.position.z
    }, 2.0);
  }
  
  // Add respawn message
  const respawnMessage = document.createElement('div');
  respawnMessage.className = 'respawn-message';
  respawnMessage.textContent = 'RESPAWNED';
  document.body.appendChild(respawnMessage);
  
  // Fade out and remove
  setTimeout(() => {
    respawnMessage.style.opacity = '0';
    setTimeout(() => {
      respawnMessage.remove();
    }, 500);
  }, 2000);
}

/**
 * Set fire button state
 * @param {boolean} isHeld - Whether the fire button is being held
 */
function setFireButtonState(isHeld: boolean): void {
  isFireButtonHeld = isHeld;
} 