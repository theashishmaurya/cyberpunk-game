import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { generateCityscape } from './cityscape.js';
import { createCarModel } from './car.js';
import { createLaser } from './effects.js';
import Stats from 'three/examples/jsm/libs/stats.module.js';
import { getSocket } from '../network/network.js';

// Renderer state
let scene, camera, renderer, controls, playerCar, clock;
let animationFrameId = null;
let cityManager; // Added reference for city manager
let stats; // Performance monitoring
let frustum = new THREE.Frustum(); // For frustum culling
let frustumMatrix = new THREE.Matrix4(); // For frustum updates

// Optimization flags
const USE_FRUSTUM_CULLING = true;
const LOW_QUALITY_MODE = false; // Can be toggled by user for performance

/**
 * Initialize the Three.js renderer, scene, camera, and controls
 * @param {Object} appState - The application state
 * @returns {Object} - The renderer components
 */
export async function initializeRenderer(appState) {
  // Create the scene
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x050510); // Dark blue cyberpunk sky
  scene.fog = new THREE.FogExp2(0x050510, 0.002); // Increased fog density for performance
  
  // Setup renderer with optimized settings
  renderer = new THREE.WebGLRenderer({ 
    antialias: false, // Disable antialiasing for performance
    powerPreference: 'high-performance',
    precision: 'mediump' // Use medium precision for better performance
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5)); // Limit pixel ratio
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = appState.gameOptions.isMobile ? false : true; // Disable shadows on mobile
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  document.body.appendChild(renderer.domElement);
  
  // Setup performance monitoring
  stats = new Stats();
  stats.domElement.style.position = 'absolute';
  stats.domElement.style.top = '0px';
  document.body.appendChild(stats.domElement);
  
  // Setup camera with limited draw distance for performance
  camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 2000);
  camera.position.set(0, 30, 50);
  
  // Setup orbit controls for debugging
  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.05;
  controls.enabled = appState.gameOptions.debug;
  
  // Setup lights (reduced number for performance)
  setupLights(appState.gameOptions.isMobile);
  
  // Generate the cityscape with dynamic chunks
  const cityManagerRef = await generateCityscape(scene);
  cityManager = cityManagerRef; // Store reference to city manager
  
  // Create player car
  playerCar = await createCarModel();
  const { position } = appState.playerStats;
  playerCar.position.set(position.x, position.y, position.z);
  scene.add(playerCar);
  
  // Create clock for animation
  clock = new THREE.Clock();
  
  // Setup window resize handler
  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });
  
  // Add quality toggle button
  addQualityToggleButton();
  
  // Start rendering loop
  startRenderingLoop(appState);
  
  // Return renderer components for other modules to use
  return {
    scene,
    camera,
    renderer,
    controls,
    playerCar,
    cityManager, // Expose city manager
    fireLaser,
    updatePlayerPosition: (playerStats) => updatePlayerPosition(playerStats),
    updateOtherPlayers: (playersData) => updateOtherPlayers(appState, playersData),
    createExplosion: (position, scale) => createExplosion(position, scale),
    setQuality: (isLowQuality) => setQualityMode(isLowQuality),
    dispose: () => {
      // Clean up resources
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
      }
      
      // Dispose Three.js resources
      disposeScene(scene);
    }
  };
}

/**
 * Add quality toggle button
 */
function addQualityToggleButton() {
  const qualityBtn = document.createElement('div');
  qualityBtn.style.position = 'absolute';
  qualityBtn.style.top = '20px';
  qualityBtn.style.right = '140px'; // Position next to other buttons
  qualityBtn.style.width = '40px';
  qualityBtn.style.height = '40px';
  qualityBtn.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
  qualityBtn.style.border = '2px solid #0ff';
  qualityBtn.style.borderRadius = '50%';
  qualityBtn.style.cursor = 'pointer';
  qualityBtn.style.zIndex = '1001';
  qualityBtn.style.display = 'flex';
  qualityBtn.style.justifyContent = 'center';
  qualityBtn.style.alignItems = 'center';
  qualityBtn.style.fontFamily = 'monospace';
  qualityBtn.innerHTML = '<span style="color:#0ff;font-size:8px;">HIGH</span>';
  
  // Add click event
  qualityBtn.addEventListener('click', () => {
    LOW_QUALITY_MODE = !LOW_QUALITY_MODE;
    qualityBtn.innerHTML = LOW_QUALITY_MODE ? 
      '<span style="color:#0ff;font-size:8px;">LOW</span>' : 
      '<span style="color:#0ff;font-size:8px;">HIGH</span>';
      
    setQualityMode(LOW_QUALITY_MODE);
  });
  
  document.body.appendChild(qualityBtn);
}

/**
 * Set quality mode for performance
 * @param {boolean} isLowQuality - Whether to use low quality mode
 */
function setQualityMode(isLowQuality) {
  if (isLowQuality) {
    // Low quality settings
    renderer.setPixelRatio(1);
    renderer.shadowMap.enabled = false;
    scene.fog.density = 0.003; // Increase fog density to hide distant objects
  } else {
    // High quality settings
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    renderer.shadowMap.enabled = true;
    scene.fog.density = 0.002;
  }
}

/**
 * Setup scene lighting
 * @param {boolean} isMobile - Whether the device is mobile
 */
function setupLights(isMobile) {
  // Ambient light for overall illumination
  const ambientLight = new THREE.AmbientLight(0x202040, 0.5);
  scene.add(ambientLight);
  
  // Directional light for shadows
  const directionalLight = new THREE.DirectionalLight(0xffffff, 0.7);
  directionalLight.position.set(1, 1, 1);
  directionalLight.castShadow = !isMobile; // Disable shadows on mobile
  
  // Optimize shadow map size
  if (!isMobile) {
    directionalLight.shadow.mapSize.width = 1024; // Reduced from 2048
    directionalLight.shadow.mapSize.height = 1024; // Reduced from 2048
  }
  
  scene.add(directionalLight);
  
  // Add colored point lights - but fewer for performance (removed 2)
  const colors = [0xff00ff, 0x00ffff];
  colors.forEach((color, i) => {
    const light = new THREE.PointLight(color, 1, 500, 1.5); // Reduced distance from 1000
    light.position.set(
      Math.sin(i * Math.PI) * 300,
      200,
      Math.cos(i * Math.PI) * 300
    );
    scene.add(light);
  });
}

/**
 * Start the rendering loop
 * @param {Object} appState - The application state
 */
function startRenderingLoop(appState) {
  // Animation loop
  const animate = () => {
    animationFrameId = requestAnimationFrame(animate);
    
    // Update stats
    if (stats) stats.begin();
    
    const delta = clock.getDelta();
    
    // Only update car position in game mode, not debug mode
    if (!appState.gameOptions.debug) {
      updatePlayerPosition(appState.playerStats);
      
      // Position camera in third-person view behind the car
      const carRotation = playerCar.rotation.y;
      
      // Calculate position behind and above car
      const distance = 25; // Distance behind car
      const height = 15;   // Height above car
      
      // Calculate camera position based on car's orientation
      const offsetX = Math.sin(carRotation) * distance;
      const offsetZ = Math.cos(carRotation) * distance;
      
      // Position camera behind car based on its orientation
      const targetCameraPos = new THREE.Vector3(
        playerCar.position.x + offsetX,
        playerCar.position.y + height,
        playerCar.position.z + offsetZ
      );
      
      // Smoothly move camera to new position
      camera.position.lerp(targetCameraPos, 0.1);
      
      // Look at a point slightly ahead of the car
      const lookAtPos = new THREE.Vector3(
        playerCar.position.x - Math.sin(carRotation) * 10,
        playerCar.position.y + 5, // Look slightly above car center
        playerCar.position.z - Math.cos(carRotation) * 10
      );
      
      camera.lookAt(lookAtPos);
      
      // Update cityscape chunks based on player position
      if (cityManager && cityManager.updateChunks) {
        cityManager.updateChunks(playerCar.position);
      }
      
      // Update frustum for culling
      if (USE_FRUSTUM_CULLING) {
        frustumMatrix.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
        frustum.setFromProjectionMatrix(frustumMatrix);
        
        // Perform frustum culling on scene objects
        scene.traverse(object => {
          if (object.isMesh && object !== playerCar && 
              !object.userData.alwaysVisible) {
            // Skip very small objects or objects within a certain distance
            const distanceToCamera = camera.position.distanceTo(object.position);
            if (distanceToCamera < 100 || object.scale.y < 5) {
              object.visible = true;
              return;
            }
            
            // Frustum culling for larger/distant objects
            object.visible = frustum.intersectsObject(object);
          }
        });
      }
    } else {
      // Update orbit controls in debug mode
      controls.update();
    }
    
    // Render the scene
    renderer.render(scene, camera);
    
    // End stats
    if (stats) stats.end();
  };
  
  // Start the loop
  animate();
}

/**
 * Update the player car position based on player stats
 * @param {Object} playerStats - The player stats with position, rotation, etc.
 */
function updatePlayerPosition(playerStats) {
  if (!playerCar) return;
  
  // Update position
  playerCar.position.set(
    playerStats.position.x,
    playerStats.position.y,
    playerStats.position.z
  );
  
  // Update rotation (convert to radians)
  playerCar.rotation.set(
    playerStats.rotation.x * Math.PI / 180,
    playerStats.rotation.y * Math.PI / 180,
    playerStats.rotation.z * Math.PI / 180
  );
}

/**
 * Update the positions of other players
 * @param {Object} appState - The application state
 * @param {Object} playersData - Data about other players
 */
function updateOtherPlayers(appState, playersData) {
  if (!playersData) {
    console.warn("Received invalid player data", playersData);
    return;
  }

  // Get socket reference
  const socket = getSocket();
  
  console.log("Updating other players. Count:", Object.keys(playersData).length);
  console.log("Local playerID:", socket?.id || "Unknown");

  // Track players that should be in the scene
  const activePlayers = new Set();
  
  // Update or add connected players
  Object.keys(playersData).forEach(async playerId => {
    const playerData = playersData[playerId];
    
    // Skip if player data is invalid
    if (!playerData || !playerData.position) {
      console.warn(`Invalid player data for ID ${playerId}`, playerData);
      return;
    }
    
    // Skip the local player - make sure we're using proper comparison
    if (playerData.isLocal || playerId === socket?.id) {
      console.log("Skipping local player:", playerId);
      return;
    }
    
    activePlayers.add(playerId);
    
    try {
      if (!appState.otherPlayers[playerId]) {
        // Get a consistent color for this player based on their ID
        const colorIndex = hashPlayerID(playerId);
        console.log(`Creating new car for player ${playerId} with color index ${colorIndex}`);
        
        // Create new car for this player with their unique color
        const carModel = await createCarModel(colorIndex);
        
        // Add player name label
        addPlayerNameLabel(carModel, playerId);
        
        scene.add(carModel);
        
        appState.otherPlayers[playerId] = {
          model: carModel,
          data: playerData
        };
      }
      
      // Update the car position and rotation
      const { model } = appState.otherPlayers[playerId];
      
      // Smooth transitions to new positions (lerp)
      const lerpFactor = 0.3; // Adjust for smoother or quicker transitions
      
      // Position with lerp
      model.position.lerp(
        new THREE.Vector3(
          playerData.position.x,
          playerData.position.y,
          playerData.position.z
        ),
        lerpFactor
      );
      
      // Convert rotations to radians
      const targetRotation = new THREE.Euler(
        playerData.rotation.x * Math.PI / 180,
        playerData.rotation.y * Math.PI / 180,
        playerData.rotation.z * Math.PI / 180
      );
      
      // Apply rotation with smoother transitions
      model.rotation.x += (targetRotation.x - model.rotation.x) * lerpFactor;
      model.rotation.y += (targetRotation.y - model.rotation.y) * lerpFactor;
      model.rotation.z += (targetRotation.z - model.rotation.z) * lerpFactor;
      
      // Update the stored data
      appState.otherPlayers[playerId].data = playerData;
    } catch (err) {
      console.error(`Error updating player ${playerId}:`, err);
    }
  });
  
  // Remove disconnected players
  Object.keys(appState.otherPlayers).forEach(playerId => {
    if (!activePlayers.has(playerId)) {
      console.log(`Removing disconnected player: ${playerId}`);
      if (appState.otherPlayers[playerId].model) {
        // Properly dispose of materials and geometries
        const model = appState.otherPlayers[playerId].model;
        disposeObject(model);
        scene.remove(model);
      }
      delete appState.otherPlayers[playerId];
    }
  });
}

/**
 * Create a hash from player ID for consistent color assignment
 * @param {string} id - Player ID 
 * @returns {number} - A number between 0-7
 */
function hashPlayerID(id) {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash << 5) - hash + id.charCodeAt(i);
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash) % 8; // Return 0-7 for the 8 car colors
}

/**
 * Add player name label above car
 * @param {THREE.Object3D} carModel - The car model
 * @param {string} playerId - The player ID to display
 */
function addPlayerNameLabel(carModel, playerId) {
  // Create canvas for player name
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 128;
  const context = canvas.getContext('2d');
  
  // Fill background with semi-transparent black
  context.fillStyle = 'rgba(0,0,0,0.5)';
  context.fillRect(0, 0, canvas.width, canvas.height);
  
  // Draw player name
  context.font = 'Bold 36px Arial';
  context.fillStyle = '#00ffff'; // Cyan text
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillText(playerId.substring(0, 8), canvas.width/2, canvas.height/2);
  
  // Create texture and sprite
  const texture = new THREE.CanvasTexture(canvas);
  const material = new THREE.SpriteMaterial({ map: texture });
  const sprite = new THREE.Sprite(material);
  
  // Position above car
  sprite.position.set(0, 10, 0);
  sprite.scale.set(10, 5, 1);
  
  // Add to car
  carModel.add(sprite);
}

/**
 * Dispose of THREE.js object, materials and geometries
 * @param {THREE.Object3D} object - The object to dispose
 */
function disposeObject(object) {
  if (!object) return;
  
  // Remove children recursively
  if (object.children) {
    while (object.children.length > 0) {
      disposeObject(object.children[0]);
      object.remove(object.children[0]);
    }
  }
  
  // Dispose of geometries
  if (object.geometry) {
    object.geometry.dispose();
  }
  
  // Dispose of materials
  if (object.material) {
    if (Array.isArray(object.material)) {
      object.material.forEach(material => disposeMaterial(material));
    } else {
      disposeMaterial(object.material);
    }
  }
}

/**
 * Dispose of material and its textures
 * @param {THREE.Material} material - The material to dispose
 */
function disposeMaterial(material) {
  if (!material) return;
  
  // Dispose textures
  Object.keys(material).forEach(prop => {
    if (material[prop] && material[prop].isTexture) {
      material[prop].dispose();
    }
  });
  
  // Dispose material
  material.dispose();
}

/**
 * Fire a laser from the player's car
 * @param {Object} options - Options for firing the laser
 * @returns {Object} - The laser object
 */
function fireLaser(options = {}) {
  if (!playerCar) return null;
  
  // Use provided position/rotation (for other players' lasers) or player's car
  const position = options.position ? 
    new THREE.Vector3(options.position.x, options.position.y, options.position.z) : 
    new THREE.Vector3().copy(playerCar.position);
  
  const rotation = options.rotation ? 
    new THREE.Euler(options.rotation.x * Math.PI/180, options.rotation.y * Math.PI/180, options.rotation.z * Math.PI/180) : 
    new THREE.Euler().copy(playerCar.rotation);
  
  // Create laser with optimized parameters
  const laser = createLaser();
  laser.position.copy(position);
  laser.rotation.copy(rotation);
  
  // Add to scene
  scene.add(laser);
  
  // Track all active lasers to limit total count
  if (!window.activeLasers) window.activeLasers = [];
  window.activeLasers.push(laser);
  
  // Limit total number of lasers to prevent performance issues
  if (window.activeLasers.length > 20) {
    const oldestLaser = window.activeLasers.shift();
    if (oldestLaser && oldestLaser.parent) {
      oldestLaser.parent.remove(oldestLaser);
    }
  }
  
  // Animate the laser with efficient animation
  const laserSpeed = 10;
  const maxDistance = 1000;
  let distanceTraveled = 0;
  
  // Use requestAnimationFrame directly for smoother animation
  let lastTime = performance.now();
  const animateLaser = (currentTime) => {
    // Calculate time delta for consistent speed regardless of framerate
    const deltaTime = (currentTime - lastTime) / 1000;
    lastTime = currentTime;
    
    // Skip if the frame rate is too low (prevents large jumps)
    if (deltaTime > 0.1) {
      requestAnimationFrame(animateLaser);
      return;
    }
    
    // Calculate distance to move this frame
    const moveDistance = laserSpeed * (deltaTime * 60); // Normalize to 60fps
    
    // Move the laser forward
    const forward = new THREE.Vector3(0, 0, -1);
    forward.applyEuler(laser.rotation);
    forward.multiplyScalar(moveDistance);
    
    laser.position.add(forward);
    distanceTraveled += moveDistance;
    
    // Check if laser has gone too far
    if (distanceTraveled >= maxDistance || !laser.parent) {
      if (laser.parent) scene.remove(laser);
      
      // Remove from active lasers array
      const index = window.activeLasers.indexOf(laser);
      if (index > -1) window.activeLasers.splice(index, 1);
      return;
    }
    
    // Check for collisions with other player cars
    for (const playerId in otherPlayerCars) {
      const otherCar = otherPlayerCars[playerId];
      
      // Calculate distance between laser and other car
      const distance = laser.position.distanceTo(otherCar.position);
      
      // Collision detected (10 is approximately the size of the car)
      if (distance < 10) {
        // Handle hit - this car got hit by our laser
        if (!options.position && appState && appState.networkManager) {
          // Only send hit notification for our own lasers, not other players'
          appState.networkManager.sendLaserHit({
            targetId: playerId,
            position: {
              x: laser.position.x,
              y: laser.position.y,
              z: laser.position.z
            }
          });
        }
        
        // Show hit effect
        createExplosion(otherCar.position.clone(), 0.5);
        
        // Remove laser
        scene.remove(laser);
        const index = window.activeLasers.indexOf(laser);
        if (index > -1) window.activeLasers.splice(index, 1);
        return;
      }
    }
    
    // Continue animation
    requestAnimationFrame(animateLaser);
  };
  
  // Start animation
  requestAnimationFrame(animateLaser);
  
  return laser;
}

// Helper function to create explosion effect for hits
function createExplosion(position, scale = 1) {
  const particleCount = 20;
  const explosion = new THREE.Group();
  explosion.position.copy(position);
  
  for (let i = 0; i < particleCount; i++) {
    const geometry = new THREE.SphereGeometry(0.2 * scale);
    const material = new THREE.MeshBasicMaterial({
      color: 0xff4500,
      transparent: true,
      opacity: 0.8
    });
    
    const particle = new THREE.Mesh(geometry, material);
    
    // Random position around center
    particle.position.set(
      (Math.random() - 0.5) * 2 * scale,
      (Math.random() - 0.5) * 2 * scale,
      (Math.random() - 0.5) * 2 * scale
    );
    
    // Random velocity
    particle.userData.velocity = new THREE.Vector3(
      (Math.random() - 0.5) * 2,
      (Math.random() - 0.5) * 2,
      (Math.random() - 0.5) * 2
    );
    
    explosion.add(particle);
  }
  
  scene.add(explosion);
  
  // Animate and remove after 500ms
  setTimeout(() => {
    scene.remove(explosion);
  }, 500);
  
  return explosion;
} 