import { updateBillboard } from '../rendering/billboard.js';
import { checkCollisions, setDebugMode } from './collisionSystem.js';
import { initSoundManager, playSound, playMusic, startEngineSound, updateEngineSound } from '../audio/soundManager.js';

// Game state
let appState;
let renderer;
let networkManager;
let gameLoop;
let lastUpdateTime = 0;
let laserCooldown = 0;
let cityManager;
let soundManager;
let isFireButtonHeld = false; // Track if fire button is being held

/**
 * Initialize the game logic
 * @param {Object} state - The application state
 * @param {Object} rendererModule - The renderer module
 * @returns {Object} - The game module
 */
export async function initializeGameLogic(state, rendererModule) {
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
    fireLaser,
    setFireButtonState,
    updatePlayerVelocity,
    updatePlayerRotation,
    showHitEffect,
    showRespawnEffect,
    setNetworkManager: (manager) => { networkManager = manager; },
    toggleSound: () => {
      appState.gameOptions.soundEnabled = soundManager.toggleSound();
      return appState.gameOptions.soundEnabled;
    },
    toggleDebug: () => {
      appState.gameOptions.debug = !appState.gameOptions.debug;
      setDebugMode(appState.gameOptions.debug, renderer.scene);
      // Enable or disable orbit controls in debug mode
      if (renderer.controls) {
        renderer.controls.enabled = appState.gameOptions.debug;
      }
      return appState.gameOptions.debug;
    },
    renderer: rendererModule
  };
}

/**
 * Set up the game loop
 */
function setupGameLoop() {
  lastUpdateTime = Date.now();
  
  // Create game loop function
  gameLoop = () => {
    const now = Date.now();
    const deltaTime = (now - lastUpdateTime) / 1000;
    lastUpdateTime = now;
    
    // Update game state
    update(deltaTime);
    
    // Request next frame
    requestAnimationFrame(gameLoop);
  };
}

/**
 * Start the game loop
 */
function start() {
  if (!gameLoop) {
    setupGameLoop();
  }
  
  // Start the loop
  requestAnimationFrame(gameLoop);
}

/**
 * Stop the game loop
 */
function stop() {
  gameLoop = null;
}

/**
 * Update the game state
 * @param {number} deltaTime - Time since last update in seconds
 */
function update(deltaTime) {
  // Decrease laser cooldown
  if (laserCooldown > 0) {
    laserCooldown -= deltaTime;
  }
  
  // Auto-fire if button is held down and cooldown is ready
  if (isFireButtonHeld && laserCooldown <= 0) {
    fireLaser();
  }
  
  // Update player position based on velocity
  updatePlayerPosition(deltaTime);
  
  // Check for collisions
  checkCollisions(appState.playerStats, appState, handleCollision);
  
  // Update billboards in the scene
  updateBillboards(deltaTime);
  
  // Update city chunks based on player position
  if (cityManager && cityManager.updateChunks) {
    cityManager.updateChunks(appState.playerStats.position);
  }
  
  // Update engine sound based on player velocity
  const speed = Math.sqrt(
    appState.playerStats.velocity.x * appState.playerStats.velocity.x +
    appState.playerStats.velocity.y * appState.playerStats.velocity.y +
    appState.playerStats.velocity.z * appState.playerStats.velocity.z
  );
  
  // Normalize speed to a 0-1 range for engine sound
  const normalizedSpeed = Math.min(1.0, speed / 100);
  updateEngineSound(normalizedSpeed, appState.playerStats.boost);
  
  // Send player update to server
  if (networkManager) {
    networkManager.sendPlayerUpdate(appState.playerStats);
  }
}

/**
 * Handle collision events
 * @param {Object} collisionObject - Object that was collided with
 */
function handleCollision(collisionObject) {
  // Handle collision damage
  if (appState.playerStats.health > 0) {
    // Reduce health based on impact velocity
    const impactSpeed = Math.sqrt(
      appState.playerStats.velocity.x * appState.playerStats.velocity.x +
      appState.playerStats.velocity.y * appState.playerStats.velocity.y +
      appState.playerStats.velocity.z * appState.playerStats.velocity.z
    );
    
    // Only apply damage for significant collisions
    if (impactSpeed > 20) {
      const damage = Math.min(20, impactSpeed * 0.2);
      appState.playerStats.health -= damage;
      
      // Show hit effect if significant collision
      if (damage > 5) {
        showHitEffect();
      }
      
      // Check for death
      if (appState.playerStats.health <= 0) {
        appState.playerStats.health = 0;
        setTimeout(() => {
          // Respawn after a delay
          appState.playerStats.health = 100;
          appState.playerStats.position = { x: 100, y: 200, z: 100 };
          appState.playerStats.velocity = { x: 0, y: 0, z: 0 };
          showRespawnEffect();
        }, 3000);
      }
    }
  }
}

/**
 * Update the player position based on velocity
 * @param {number} deltaTime - Time since last update in seconds
 */
function updatePlayerPosition(deltaTime) {
  const { position, velocity, rotation } = appState.playerStats;
  
  // Apply rotation to calculate forward direction
  const forwardX = -Math.sin(rotation.y * Math.PI / 180);
  const forwardZ = -Math.cos(rotation.y * Math.PI / 180);
  
  // Update position based on velocity
  position.x += velocity.x * deltaTime;
  position.y += velocity.y * deltaTime;
  position.z += velocity.z * deltaTime;
  
  // Apply some damping to velocity (air resistance)
  const damping = 0.95;
  velocity.x *= Math.pow(damping, deltaTime * 60);
  velocity.y *= Math.pow(damping, deltaTime * 60);
  velocity.z *= Math.pow(damping, deltaTime * 60);
  
  // Apply gravity if it's enabled
  if (appState.gameOptions.gravity) {
    velocity.y -= 9.8 * deltaTime;
  }
  
  // Check for minimum height
  if (position.y < 1) {
    position.y = 1;
    velocity.y = 0;
  }
}

/**
 * Update all billboards in the scene
 * @param {number} deltaTime - Time since last update in seconds
 */
function updateBillboards(deltaTime) {
  if (!renderer || !renderer.scene) return;
  
  // Find all billboard objects in the scene
  renderer.scene.traverse((object) => {
    if (object.userData && object.userData.lastAdChange !== undefined) {
      updateBillboard(object, deltaTime);
    }
  });
}

/**
 * Update the player's velocity
 * @param {Object} velocityChange - The velocity change to apply
 */
function updatePlayerVelocity(velocityChange) {
  const { velocity, rotation } = appState.playerStats;
  
  // Convert rotation from degrees to radians
  const pitchRad = rotation.x * Math.PI / 180;
  const yawRad = rotation.y * Math.PI / 180;
  const rollRad = rotation.z * Math.PI / 180;
  
  // Calculate forward direction including pitch (for vertical movement)
  const forwardX = -Math.sin(yawRad) * Math.cos(pitchRad);
  const forwardY = Math.sin(pitchRad); // Add vertical component based on pitch
  const forwardZ = -Math.cos(yawRad) * Math.cos(pitchRad);
  
  // Calculate right direction (perpendicular to forward)
  const rightX = -Math.sin(yawRad + Math.PI/2);
  const rightZ = -Math.cos(yawRad + Math.PI/2);
  
  // Apply velocity changes based on input
  const speed = 50; // Base speed
  
  // Forward/backward - now includes vertical movement based on pitch
  if (velocityChange.z !== 0) {
    velocity.x += forwardX * velocityChange.z * speed;
    velocity.y += forwardY * velocityChange.z * speed; // Add vertical movement based on pitch
    velocity.z += forwardZ * velocityChange.z * speed;
  }
  
  // Left/right strafing
  if (velocityChange.x !== 0) {
    velocity.x += rightX * velocityChange.x * speed;
    velocity.z += rightZ * velocityChange.x * speed;
  }
  
  // Direct up/down movement (independent of orientation)
  if (velocityChange.y !== 0) {
    velocity.y += velocityChange.y * speed;
  }
  
  // Check if boost is active
  appState.playerStats.boost = velocityChange.boost || false;
  
  // Apply boost if active
  if (appState.playerStats.boost) {
    velocity.x *= 1.5;
    velocity.y *= 1.5;
    velocity.z *= 1.5;
  }
  
  // Limit maximum speed
  const currentSpeed = Math.sqrt(
    velocity.x * velocity.x +
    velocity.y * velocity.y +
    velocity.z * velocity.z
  );
  
  const maxSpeed = appState.playerStats.boost ? 300 : 200;
  
  if (currentSpeed > maxSpeed) {
    const speedRatio = maxSpeed / currentSpeed;
    velocity.x *= speedRatio;
    velocity.y *= speedRatio;
    velocity.z *= speedRatio;
  }
}

/**
 * Update the player's rotation
 * @param {Object} rotationChange - The rotation change to apply
 */
function updatePlayerRotation(rotationChange) {
  const { rotation } = appState.playerStats;
  
  // Apply rotation changes
  rotation.x += rotationChange.x;
  rotation.y += rotationChange.y;
  rotation.z += rotationChange.z;
  
  // Clamp pitch (x rotation)
  rotation.x = Math.max(-45, Math.min(45, rotation.x));
  
  // Normalize yaw (y rotation)
  rotation.y = rotation.y % 360;
  if (rotation.y < 0) rotation.y += 360;
  
  // Clamp roll (z rotation)
  rotation.z = Math.max(-30, Math.min(30, rotation.z));
}

/**
 * Fire a laser from the player's car
 */
function fireLaser() {
  if (laserCooldown > 0) return null;
  
  // Set cooldown - reduced from 1s to 0.2s for faster firing
  laserCooldown = 0.2;
  
  // Play laser sound
  playSound('laser_shot', { volume: 0.4 });
  
  // Create laser
  if (renderer && renderer.fireLaser) {
    const laser = renderer.fireLaser();
    
    // Send laser event to server
    if (networkManager) {
      networkManager.sendLaserShot({
        position: { ...appState.playerStats.position },
        rotation: { ...appState.playerStats.rotation }
      });
    }
    
    return laser;
  }
  
  return null;
}

/**
 * Show an effect when player is hit
 * @param {Object} fromDirection - Direction from which the hit came
 */
function showHitEffect(fromDirection) {
  // Play explosion sound
  playSound('explosion', { volume: 0.5 });
  
  // Flash the screen red
  const flashElement = document.createElement('div');
  flashElement.style.position = 'absolute';
  flashElement.style.top = '0';
  flashElement.style.left = '0';
  flashElement.style.width = '100%';
  flashElement.style.height = '100%';
  flashElement.style.backgroundColor = 'rgba(255, 0, 0, 0.3)';
  flashElement.style.pointerEvents = 'none';
  flashElement.style.zIndex = '1000';
  flashElement.style.opacity = '0.8';
  
  document.body.appendChild(flashElement);
  
  // Fade out and remove
  setTimeout(() => {
    flashElement.style.transition = 'opacity 0.5s ease-out';
    flashElement.style.opacity = '0';
    
    // Remove after animation
    setTimeout(() => {
      document.body.removeChild(flashElement);
    }, 500);
  }, 100);
  
  // Camera shake effect
  if (renderer && renderer.camera) {
    const originalPosition = renderer.camera.position.clone();
    
    // Shake for 500ms
    let shakeTime = 0.5;
    const shakeIntensity = 1;
    
    const shakeInterval = setInterval(() => {
      renderer.camera.position.x = originalPosition.x + (Math.random() - 0.5) * shakeIntensity;
      renderer.camera.position.y = originalPosition.y + (Math.random() - 0.5) * shakeIntensity;
      renderer.camera.position.z = originalPosition.z + (Math.random() - 0.5) * shakeIntensity;
      
      shakeTime -= 0.05;
      
      if (shakeTime <= 0) {
        clearInterval(shakeInterval);
        renderer.camera.position.copy(originalPosition);
      }
    }, 50);
  }
}

/**
 * Show an effect when player respawns
 */
function showRespawnEffect() {
  // Play respawn sound
  playSound('select', { volume: 0.7 });
  
  // Fade in from white
  const fadeElement = document.createElement('div');
  fadeElement.style.position = 'absolute';
  fadeElement.style.top = '0';
  fadeElement.style.left = '0';
  fadeElement.style.width = '100%';
  fadeElement.style.height = '100%';
  fadeElement.style.backgroundColor = 'rgba(255, 255, 255, 1.0)';
  fadeElement.style.pointerEvents = 'none';
  fadeElement.style.zIndex = '1000';
  fadeElement.style.opacity = '1.0';
  
  document.body.appendChild(fadeElement);
  
  // Fade out and remove
  setTimeout(() => {
    fadeElement.style.transition = 'opacity 1.5s ease-out';
    fadeElement.style.opacity = '0';
    
    // Remove after animation
    setTimeout(() => {
      document.body.removeChild(fadeElement);
    }, 1500);
  }, 100);
}

/**
 * Set the fire button state for continuous firing
 * @param {boolean} isHeld - Whether the fire button is being held
 */
function setFireButtonState(isHeld) {
  isFireButtonHeld = isHeld;
  
  // If button was just pressed, fire immediately
  if (isHeld && laserCooldown <= 0) {
    fireLaser();
  }
} 