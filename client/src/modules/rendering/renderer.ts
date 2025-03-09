import * as BABYLON from '@babylonjs/core';
import { AdvancedDynamicTexture, TextBlock } from '@babylonjs/gui';
import { generateCityscape } from './cityscape';
import { createCarModel } from './car';
import { createLaser } from './effects';
import { AppState, RendererInstance, PlayerData, Vector3 } from '../../types';

// Renderer state
let scene: BABYLON.Scene;
let engine: BABYLON.Engine;
let camera: BABYLON.FreeCamera;
let playerCar: BABYLON.Mesh;
let cityMeshes: BABYLON.AbstractMesh[] = [];
let playerMeshes: Record<string, BABYLON.AbstractMesh> = {};
let playerLabels: Record<string, TextBlock> = {};
let canvas: HTMLCanvasElement;

// Progress tracking
let loadingCallback: (progress: number, message: string) => void;

/**
 * Initialize the Babylon.js renderer, scene, camera, and controls
 * @param {AppState} appState - The application state
 * @returns {RendererInstance} - The renderer instance
 */
export async function initializeRenderer(appState: AppState): Promise<RendererInstance> {
  // Create canvas element
  canvas = document.createElement('canvas');
  canvas.id = 'renderCanvas';
  document.body.appendChild(canvas);
  
  // Setup progress callback
  loadingCallback = (progress: number, message: string) => {
    // Track loading progress
    console.log(`[Renderer Loading] ${progress}%: ${message}`);
  };
  
  // Setup Babylon engine with options suited for performance
  const engineOptions: BABYLON.EngineOptions = { 
    preserveDrawingBuffer: true, 
    stencil: true,
    disableWebGL2Support: false,
    doNotHandleContextLost: false,
    powerPreference: "high-performance",
    failIfMajorPerformanceCaveat: false
  };
  
  engine = new BABYLON.Engine(canvas, true, engineOptions);
  
  // Set hardware scaling based on performance level
  const performanceLevel = appState.gameOptions.performanceLevel || 'medium';
  applyHardwareScaling(performanceLevel);
  
  // Create the scene
  scene = new BABYLON.Scene(engine);
  
  // Apply scene optimization options
  optimizeScene(scene, performanceLevel);
  
  // Set scene background color to dark blue cyberpunk sky
  scene.clearColor = new BABYLON.Color4(0.02, 0.02, 0.05, 1);
  
  // Setup fog - disable for low performance
  if (performanceLevel !== 'low') {
    scene.fogMode = BABYLON.Scene.FOGMODE_EXP2;
    scene.fogDensity = 0.002;
    scene.fogColor = new BABYLON.Color3(0.02, 0.02, 0.05);
  }
  
  // Setup camera
  camera = new BABYLON.FreeCamera('camera', new BABYLON.Vector3(100, 200, 100), scene);
  camera.setTarget(new BABYLON.Vector3(0, 0, 0));
  camera.attachControl(canvas, true);
  
  // Configure camera settings
  camera.minZ = 10;
  camera.maxZ = performanceLevel === 'low' ? 3000 : 10000; // Reduce view distance on low performance
  camera.fov = 0.8;
  camera.inertia = 0.7;
  
  loadingCallback(30, "Setting up environment...");
  
  // Generate cityscape
  // Use a reduced number of buildings for better performance
  let buildingCount = 500;
  if (performanceLevel === 'low') {
    buildingCount = 100;
  } else if (performanceLevel === 'medium' || appState.gameOptions.isMobile) {
    buildingCount = 250;
  }
  
  // Generate cityscape with reduced complexity based on performance level
  await generateCityscape(scene, appState.gameOptions.isMobile, buildingCount);
  
  loadingCallback(60, "Creating player model...");
  
  // Create player's car
  playerCar = await createCarModel(scene, 'player');
  playerCar.position = new BABYLON.Vector3(
    appState.playerStats.position.x,
    appState.playerStats.position.y, 
    appState.playerStats.position.z
  );
  
  loadingCallback(80, "Setting up lighting...");
  
  // Setup lights after playerCar is created
  setupLights(appState.gameOptions.isMobile, performanceLevel);
  
  // Add quality toggle button
  addQualityToggleButton();
  
  // Setup performance monitor if in debug mode
  if (appState.gameOptions.debug) {
    scene.debugLayer.show();
  }
  
  // Handle window resize
  window.addEventListener('resize', () => {
    engine.resize();
  });
  
  loadingCallback(90, "Starting render loop...");
  
  // Start rendering loop
  startRenderingLoop(appState);
  
  loadingCallback(100, "Renderer ready");
  
  // Return renderer components
  return {
    scene,
    engine,
    camera,
    canvas,
    update: (deltaTime: number) => updateRenderer(deltaTime, appState),
    addPlayer: (id: string, data: PlayerData) => addOtherPlayer(id, data),
    updatePlayer: (id: string, data: PlayerData) => updateOtherPlayer(id, data),
    removePlayer: (id: string) => removeOtherPlayer(id)
  };
}

/**
 * Apply hardware scaling based on performance level
 * @param {string} performanceLevel - Performance level (low, medium, high)
 */
function applyHardwareScaling(performanceLevel: string): void {
  switch (performanceLevel) {
    case 'low':
      engine.setHardwareScalingLevel(2.0); // Render at half resolution
      break;
    case 'medium':
      engine.setHardwareScalingLevel(1.5); // Render at 2/3 resolution
      break;
    case 'high':
      engine.setHardwareScalingLevel(1.0); // Full resolution
      break;
    default:
      engine.setHardwareScalingLevel(1.5);
  }
}

/**
 * Apply scene optimization options
 * @param {BABYLON.Scene} scene - Babylon scene
 * @param {string} performanceLevel - Performance level
 */
function optimizeScene(scene: BABYLON.Scene, performanceLevel: string): void {
  // Always enable these optimizations
  scene.skipPointerMovePicking = true;
  scene.autoClearDepthAndStencil = false;
  scene.blockMaterialDirtyMechanism = true;
  
  // Performance level specific optimizations
  switch (performanceLevel) {
    case 'low':
      scene.postProcessesEnabled = false;
      scene.fogEnabled = false;
      scene.shadowsEnabled = false;
      scene.particlesEnabled = false;
      scene.probesEnabled = false;
      scene.collisionsEnabled = true; // We still need collisions
      break;
    case 'medium':
      scene.postProcessesEnabled = true;
      scene.fogEnabled = true;
      scene.shadowsEnabled = false;
      scene.particlesEnabled = true;
      scene.probesEnabled = false;
      break;
    case 'high':
      // All features enabled by default
      break;
  }
}

/**
 * Add quality toggle button
 */
function addQualityToggleButton(): void {
  const qualityBtn = document.createElement('div');
  qualityBtn.style.position = 'absolute';
  qualityBtn.style.bottom = '20px';
  qualityBtn.style.right = '20px';
  qualityBtn.style.padding = '8px 12px';
  qualityBtn.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
  qualityBtn.style.border = '1px solid #0ff';
  qualityBtn.style.borderRadius = '4px';
  qualityBtn.style.color = '#0ff';
  qualityBtn.style.cursor = 'pointer';
  qualityBtn.style.fontFamily = 'monospace';
  qualityBtn.style.zIndex = '1000';
  qualityBtn.textContent = 'Quality: High';
  
  qualityBtn.addEventListener('click', () => {
    const currentPerformanceLevel = qualityBtn.textContent?.includes('High') ? 'high' : 'low';
    const newLevel = currentPerformanceLevel === 'high' ? 'low' : 'high';
    
    applyHardwareScaling(newLevel);
    optimizeScene(scene, newLevel);
    
    qualityBtn.textContent = `Quality: ${newLevel === 'low' ? 'Low' : 'High'}`;
  });
  
  document.body.appendChild(qualityBtn);
}

/**
 * Setup scene lighting
 * @param {boolean} isMobile - Whether the device is mobile
 * @param {string} performanceLevel - Performance level (low, medium, high)
 */
function setupLights(isMobile: boolean, performanceLevel: string): void {
  // Create main directional light for shadows
  const sunLight = new BABYLON.DirectionalLight(
    'sunLight',
    new BABYLON.Vector3(-1, -2, 1),
    scene
  );
  sunLight.intensity = 1.8;
  sunLight.diffuse = new BABYLON.Color3(0.9, 0.85, 1);
  
  // Add some ambient light
  const ambientLight = new BABYLON.HemisphericLight(
    'ambientLight',
    new BABYLON.Vector3(0, 1, 0),
    scene
  );
  ambientLight.intensity = 0.5;
  ambientLight.diffuse = new BABYLON.Color3(0.1, 0.2, 0.3);
  ambientLight.groundColor = new BABYLON.Color3(0.1, 0.1, 0.2);
  
  // Setup shadows (disable on mobile or low performance for performance)
  if (!isMobile && performanceLevel === 'high') {
    const shadowGenerator = new BABYLON.ShadowGenerator(1024, sunLight);
    shadowGenerator.useBlurExponentialShadowMap = true;
    shadowGenerator.blurScale = 2;
    shadowGenerator.setDarkness(0.3);
    
    // Add player car to shadow casters
    shadowGenerator.addShadowCaster(playerCar);
    
    // Add shadow casters from cityscape (limit for performance)
    let shadowCasterCount = 0;
    const MAX_SHADOW_CASTERS = 50;
    
    cityMeshes.forEach(mesh => {
      if (shadowCasterCount < MAX_SHADOW_CASTERS) {
        shadowGenerator.addShadowCaster(mesh);
        shadowCasterCount++;
      }
    });
  }
}

/**
 * Start the main rendering loop
 * @param {AppState} appState - The application state
 */
function startRenderingLoop(appState: AppState): void {
  // Register a render loop to repeatedly render the scene
  engine.runRenderLoop(() => {
    scene.render();
  });
}

/**
 * Update the renderer
 * @param {number} deltaTime - Time since last update
 * @param {AppState} appState - The application state
 */
function updateRenderer(deltaTime: number, appState: AppState): void {
  // Update player position
  updatePlayerPosition(appState.playerStats);
}

/**
 * Update player position and camera
 * @param {Object} playerStats - Player stats
 */
function updatePlayerPosition(playerStats: AppState['playerStats']): void {
  if (!playerCar) return;
  
  // Update car position and rotation
  playerCar.position = new BABYLON.Vector3(
    playerStats.position.x,
    playerStats.position.y,
    playerStats.position.z
  );
  
  playerCar.rotation = new BABYLON.Vector3(
    playerStats.rotation.x,
    playerStats.rotation.y,
    playerStats.rotation.z
  );
  
  // Update camera position to follow player
  const cameraOffset = new BABYLON.Vector3(0, 10, -30);
  
  // Create rotation matrix based on car's rotation
  const rotationMatrix = BABYLON.Matrix.RotationYawPitchRoll(
    playerStats.rotation.y,
    playerStats.rotation.x,
    playerStats.rotation.z
  );
  
  // Apply rotation to offset
  const transformedOffset = BABYLON.Vector3.TransformCoordinates(cameraOffset, rotationMatrix);
  
  // Calculate new camera position
  const newCameraPosition = playerCar.position.add(transformedOffset);
  
  // Smooth camera movement
  camera.position = BABYLON.Vector3.Lerp(camera.position, newCameraPosition, 0.05);
  
  // Make camera look at car
  camera.setTarget(playerCar.position);
}

/**
 * Add another player to the scene
 * @param {string} id - Player ID
 * @param {PlayerData} data - Player data
 */
function addOtherPlayer(id: string, data: PlayerData): void {
  if (playerMeshes[id]) {
    return;
  }
  
  createCarModel(scene, id).then(carMesh => {
    playerMeshes[id] = carMesh;
    
    // Set initial position
    carMesh.position = new BABYLON.Vector3(
      data.position.x,
      data.position.y,
      data.position.z
    );
    
    // Set initial rotation
    carMesh.rotation = new BABYLON.Vector3(
      data.rotation.x,
      data.rotation.y,
      data.rotation.z
    );
    
    // Add player name label
    addPlayerNameLabel(carMesh, data.username);
  });
}

/**
 * Update another player in the scene
 * @param {string} id - Player ID
 * @param {PlayerData} data - Player data
 */
function updateOtherPlayer(id: string, data: PlayerData): void {
  if (!playerMeshes[id]) {
    addOtherPlayer(id, data);
    return;
  }
  
  const playerMesh = playerMeshes[id];
  
  // Smoothly interpolate to new position and rotation
  const targetPosition = new BABYLON.Vector3(data.position.x, data.position.y, data.position.z);
  const targetRotation = new BABYLON.Vector3(data.rotation.x, data.rotation.y, data.rotation.z);
  
  // Interpolate position and rotation (smoother movement)
  playerMesh.position = BABYLON.Vector3.Lerp(playerMesh.position, targetPosition, 0.3);
  
  // Smoothly interpolate rotation (use slerp for rotations)
  const currentRotationQuat = BABYLON.Quaternion.FromEulerAngles(
    playerMesh.rotation.x,
    playerMesh.rotation.y,
    playerMesh.rotation.z
  );
  
  const targetRotationQuat = BABYLON.Quaternion.FromEulerAngles(
    targetRotation.x,
    targetRotation.y,
    targetRotation.z
  );
  
  const resultQuat = BABYLON.Quaternion.Slerp(currentRotationQuat, targetRotationQuat, 0.3);
  
  const resultEuler = resultQuat.toEulerAngles();
  playerMesh.rotation.x = resultEuler.x;
  playerMesh.rotation.y = resultEuler.y;
  playerMesh.rotation.z = resultEuler.z;
  
  // Update player label position
  if (playerLabels[id]) {
    const labelPosition = playerMesh.position.clone();
    labelPosition.y += 5; // Position above the car
    playerLabels[id].linkWithMesh(playerMesh);
  }
}

/**
 * Remove another player from the scene
 * @param {string} id - Player ID
 */
function removeOtherPlayer(id: string): void {
  if (playerMeshes[id]) {
    // Dispose of the mesh
    playerMeshes[id].dispose();
    delete playerMeshes[id];
    
    // Dispose of the label
    if (playerLabels[id]) {
      playerLabels[id].dispose();
      delete playerLabels[id];
    }
  }
}

/**
 * Add player name label
 * @param {BABYLON.AbstractMesh} carMesh - Car mesh
 * @param {string} playerName - Player name
 */
function addPlayerNameLabel(carMesh: BABYLON.AbstractMesh, playerName: string): void {
  // Create GUI for player name
  const advancedTexture = AdvancedDynamicTexture.CreateFullscreenUI("UI");
  
  // Create text block for player name
  const nameLabel = new TextBlock();
  nameLabel.text = playerName;
  nameLabel.color = "white";
  nameLabel.fontSize = 14;
  nameLabel.outlineWidth = 2;
  nameLabel.outlineColor = "black";
  
  // Link the text with the mesh
  nameLabel.linkWithMesh(carMesh);
  nameLabel.linkOffsetY = -30;
  
  // Store the label
  if (carMesh.id !== 'player') {
    playerLabels[carMesh.id] = nameLabel;
  }
}

/**
 * Fire a laser from player position
 * @param {Object} options - Laser options
 */
export function fireLaser(options: {
  startPosition?: Vector3,
  direction?: Vector3,
  color?: string,
  speed?: number,
  duration?: number
} = {}): void {
  const startPos = options.startPosition || {
    x: playerCar.position.x,
    y: playerCar.position.y,
    z: playerCar.position.z
  };
  
  const direction = options.direction || {
    x: Math.sin(playerCar.rotation.y),
    y: Math.sin(-playerCar.rotation.x),
    z: Math.cos(playerCar.rotation.y)
  };
  
  const laserMesh = createLaser(scene, {
    position: new BABYLON.Vector3(startPos.x, startPos.y, startPos.z),
    direction: new BABYLON.Vector3(direction.x, direction.y, direction.z),
    color: options.color || '#0ff',
    speed: options.speed || 500,
    duration: options.duration || 1.5
  });
}

/**
 * Create explosion effect
 * @param {Vector3} position - Position
 * @param {number} scale - Scale
 */
export function createExplosion(position: Vector3, scale: number = 1): void {
  // Create particle system for explosion
  const explosionSystem = new BABYLON.ParticleSystem("explosion", 1000, scene);
  
  // Set emitter and particles texture
  explosionSystem.emitter = new BABYLON.Vector3(position.x, position.y, position.z);
  explosionSystem.particleTexture = new BABYLON.Texture("/assets/textures/particle.png", scene);
  
  // Colors
  explosionSystem.color1 = new BABYLON.Color4(1, 0.5, 0.1, 1.0);
  explosionSystem.color2 = new BABYLON.Color4(1, 0.2, 0.1, 1.0);
  explosionSystem.colorDead = new BABYLON.Color4(0, 0, 0, 0.0);
  
  // Size and lifetime
  explosionSystem.minSize = 0.5 * scale;
  explosionSystem.maxSize = 5 * scale;
  explosionSystem.minLifeTime = 0.3;
  explosionSystem.maxLifeTime = 1.5;
  
  // Emission
  explosionSystem.emitRate = 1000;
  explosionSystem.minEmitPower = 10;
  explosionSystem.maxEmitPower = 30;
  explosionSystem.updateSpeed = 0.02;
  
  // Start and stop
  explosionSystem.start();
  setTimeout(() => {
    explosionSystem.stop();
    setTimeout(() => {
      explosionSystem.dispose();
    }, 2000);
  }, 300);
  
  // Create point light for explosion
  const light = new BABYLON.PointLight("explosionLight", 
    new BABYLON.Vector3(position.x, position.y, position.z), scene);
  light.intensity = 20 * scale;
  light.diffuse = new BABYLON.Color3(1, 0.7, 0.3);
  light.specular = new BABYLON.Color3(1, 0.6, 0.2);
  
  // Animate light intensity
  const frameRate = 30;
  const lightAnim = new BABYLON.Animation(
    "lightIntensity", 
    "intensity", 
    frameRate, 
    BABYLON.Animation.ANIMATIONTYPE_FLOAT, 
    BABYLON.Animation.ANIMATIONLOOPMODE_CONSTANT
  );
  
  const keyFrames = [];
  keyFrames.push({ frame: 0, value: 20 * scale });
  keyFrames.push({ frame: frameRate * 0.5, value: 10 * scale });
  keyFrames.push({ frame: frameRate, value: 0 });
  
  lightAnim.setKeys(keyFrames);
  light.animations.push(lightAnim);
  
  scene.beginAnimation(light, 0, frameRate, false, 1, () => {
    light.dispose();
  });
} 