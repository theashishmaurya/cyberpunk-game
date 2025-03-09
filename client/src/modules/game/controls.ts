/**
 * Controls module - handles user input for controlling the flying car
 */
import { AppState, GameModule, RendererInstance } from '../../types';

interface KeyState {
  forward: boolean;
  backward: boolean;
  left: boolean;
  right: boolean;
  up: boolean;
  down: boolean;
  zIn: boolean;    // Move inward on Z-axis
  zOut: boolean;   // Move outward on Z-axis
  rollLeft: boolean;
  rollRight: boolean;
  turnLeft: boolean;
  turnRight: boolean;
  boost: boolean;
  fireButton: boolean; // Add fire button state
}

interface MouseState {
  isLocked: boolean;
  sensitivity: number;
  lastX: number;
  lastY: number;
}

interface TouchPosition {
  x: number;
  y: number;
  touchId: number | null;
}

interface TouchState {
  leftJoystick: TouchPosition;
  rightJoystick: TouchPosition;
}

// Key state for keyboard controls
const keyState: KeyState = {
  forward: false,
  backward: false,
  left: false,
  right: false,
  up: false,
  down: false,
  zIn: false,    // Added: Move inward on Z-axis
  zOut: false,   // Added: Move outward on Z-axis
  rollLeft: false,
  rollRight: false,
  turnLeft: false,
  turnRight: false,
  boost: false,
  fireButton: false
};

// Mouse control state
const mouseState: MouseState = {
  isLocked: false,
  sensitivity: 0.2,
  lastX: 0,
  lastY: 0
};

// Touch control state for mobile
const touchState: TouchState = {
  leftJoystick: { x: 0, y: 0, touchId: null },
  rightJoystick: { x: 0, y: 0, touchId: null }
};

// DOM elements for mobile joysticks
let leftJoystickElement: HTMLElement | null = null;
let leftJoystickKnob: HTMLElement | null = null;
let rightJoystickElement: HTMLElement | null = null;
let rightJoystickKnob: HTMLElement | null = null;
let shootButton: HTMLElement | null = null;
let boostButton: HTMLElement | null = null;

// Keep track of any intervals we start
let keyInputInterval: number | null = null;

/**
 * Detect if the device is mobile
 * @returns {boolean} - True if the device is mobile
 */
export function detectMobileDevice(): boolean {
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
}

/**
 * Detect device performance level
 * @returns {string} - 'high', 'medium', or 'low'
 */
export function detectDevicePerformance(): string {
  // Check if this is a mobile device first
  const isMobile = detectMobileDevice();
  
  // Modern desktop computers are usually high performance
  if (!isMobile) {
    return 'high';
  }
  
  // For mobile, we can check various indicators
  
  // Check for device memory (only available in some browsers)
  if ('deviceMemory' in navigator) {
    const memory = (navigator as any).deviceMemory;
    if (memory >= 4) return 'high';
    if (memory >= 2) return 'medium';
    return 'low';
  }
  
  // Check for hardwareConcurrency (number of cores)
  if ('hardwareConcurrency' in navigator) {
    const cores = navigator.hardwareConcurrency;
    if (cores >= 8) return 'high';
    if (cores >= 4) return 'medium';
    return 'low';
  }
  
  // Default to medium for unknown mobile devices
  return 'medium';
}

/**
 * Set up game controls based on device type
 * @param {AppState} appState - The application state
 * @param {GameModule} game - The game module
 * @param {RendererInstance} renderer - The renderer
 */
export function setupControls(appState: AppState, game: GameModule, renderer: RendererInstance): void {
  // Remember this in app state for other modules
  const isMobile = detectMobileDevice();
  appState.gameOptions.isMobile = isMobile;
  
  // Detect performance level
  const performanceLevel = detectDevicePerformance();
  appState.gameOptions.performanceLevel = performanceLevel;
  
  // Setup keyboard controls regardless of device (some mobile users have keyboards)
  setupKeyboardControls(game);
  
  // Setup device-specific controls
  if (isMobile) {
    // Mobile controls (touch)
    setupMobileControls(appState, game, performanceLevel);
  } else {
    // Desktop controls (mouse)
    setupDesktopControls(appState, game, performanceLevel, renderer);
  }
}

/**
 * Set up keyboard controls
 * @param {GameModule} game - The game module
 */
function setupKeyboardControls(game: GameModule): void {
  // Key down event
  window.addEventListener('keydown', (event) => {
    // Update key state
    updateKeyState(event.code, true);
    
    // Prevent default for certain keys
    if ([
      'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 
      'Space', 'KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyQ', 'KeyE',
      'KeyR', 'KeyF', 'ShiftLeft', 'ShiftRight'
    ].includes(event.code)) {
      event.preventDefault();
    }
  });
  
  // Key up event
  window.addEventListener('keyup', (event) => {
    // Update key state
    updateKeyState(event.code, false);
    
    // Special case for the "F" key (fire laser)
    if (event.code === 'KeyF') {
      game.setFireButtonState(false);
    }
  });
  
  // Start the interval that processes key inputs
  startKeyInputInterval(game);
}

/**
 * Start interval for processing key inputs
 * @param {GameModule} game - The game module
 */
function startKeyInputInterval(game: GameModule): void {
  // Clear any existing interval
  if (keyInputInterval !== null) {
    clearInterval(keyInputInterval);
  }
  
  // Update interval - 16ms is approximately 60fps
  keyInputInterval = window.setInterval(() => {
    // Process movement keys
    const velocityChange = {
      x: 0,
      y: 0,
      z: 0,
      boost: false
    };
    
    // Forward/backward movement
    if (keyState.forward) {
      velocityChange.z += 0.05;
    }
    if (keyState.backward) {
      velocityChange.z -= 0.05;
    }
    
    // Left/right movement
    if (keyState.left) {
      velocityChange.x -= 0.05;
    }
    if (keyState.right) {
      velocityChange.x += 0.05;
    }
    
    // Up/down movement
    if (keyState.up) {
      velocityChange.y += 0.05;
    }
    if (keyState.down) {
      velocityChange.y -= 0.05;
    }
    
    // Z-axis movement
    if (keyState.zIn) {
      velocityChange.z += 0.05;
    }
    if (keyState.zOut) {
      velocityChange.z -= 0.05;
    }
    
    // Boost
    if (keyState.boost) {
      velocityChange.boost = true;
    }
    
    // Apply velocity changes if any
    if (velocityChange.x !== 0 || velocityChange.y !== 0 || velocityChange.z !== 0 || velocityChange.boost) {
      // Call game module to update player velocity
      game.updatePlayerVelocity && game.updatePlayerVelocity(velocityChange);
    }
    
    // Process rotation keys
    const rotationChange = {
      x: 0,
      y: 0,
      z: 0
    };
    
    // Turning left/right (yaw)
    if (keyState.turnLeft) {
      rotationChange.y += 0.03;
    }
    if (keyState.turnRight) {
      rotationChange.y -= 0.03;
    }
    
    // Rolling left/right (roll)
    if (keyState.rollLeft) {
      rotationChange.z += 0.02;
    }
    if (keyState.rollRight) {
      rotationChange.z -= 0.02;
    }
    
    // Apply rotation changes if any
    if (rotationChange.x !== 0 || rotationChange.y !== 0 || rotationChange.z !== 0) {
      // Call game module to update player rotation
      game.updatePlayerRotation && game.updatePlayerRotation(rotationChange);
    }
  }, 16); // 60fps
}

/**
 * Update key state based on key code
 * @param {string} code - The key code
 * @param {boolean} isPressed - Whether the key is pressed
 */
function updateKeyState(code: string, isPressed: boolean): void {
  switch (code) {
    // Movement
    case 'KeyW':
    case 'ArrowUp':
      keyState.forward = isPressed;
      break;
    case 'KeyS':
    case 'ArrowDown':
      keyState.backward = isPressed;
      break;
    case 'KeyA':
    case 'ArrowLeft':
      keyState.left = isPressed;
      break;
    case 'KeyD':
    case 'ArrowRight':
      keyState.right = isPressed;
      break;
    case 'KeyR':
    case 'PageUp':
      keyState.up = isPressed;
      break;
    case 'KeyF':
    case 'PageDown':
      keyState.down = isPressed;
      break;
    
    // Rotation
    case 'KeyQ':
      keyState.turnLeft = isPressed;
      break;
    case 'KeyE':
      keyState.turnRight = isPressed;
      break;
    case 'KeyZ':
      keyState.rollLeft = isPressed;
      break;
    case 'KeyX':
      keyState.rollRight = isPressed;
      break;
    
    // Boost
    case 'ShiftLeft':
    case 'ShiftRight':
      keyState.boost = isPressed;
      break;
    
    // Special controls
    case 'Space':
      // Fire laser on key down
      if (isPressed) {
        keyState.fireButton = isPressed;
      }
      break;
  }
}

/**
 * Set up mouse controls for desktop
 * @param {GameModule} game - The game module
 * @param {RendererInstance} renderer - The renderer
 */
function setupMouseControls(game: GameModule, renderer: RendererInstance): void {
  // Get the canvas element
  const canvasElement = document.getElementById('renderCanvas');
  if (!canvasElement) return;
  
  // We know this is a canvas element since we created it
  const canvas = canvasElement as unknown as HTMLCanvasElement;
  
  // Add pointer lock event listeners
  canvas.addEventListener('click', requestPointerLock);
  
  // Mouse move event for camera control
  document.addEventListener('mousemove', (event) => {
    // Only process if pointer is locked
    if (mouseState.isLocked) {
      // Calculate mouse movement delta
      const deltaX = event.movementX || 0;
      const deltaY = event.movementY || 0;
      
      // Apply rotation based on mouse movement
      const rotationChange = {
        y: -deltaX * mouseState.sensitivity * 0.001, // Yaw (left/right)
        x: -deltaY * mouseState.sensitivity * 0.001  // Pitch (up/down)
      };
      
      // Apply rotation
      game.updatePlayerRotation && game.updatePlayerRotation(rotationChange);
    }
  });
  
  // Mouse button events
  canvas.addEventListener('mousedown', (event) => {
    // Left click to fire laser
    if (event.button === 0) {
      game.setFireButtonState && game.setFireButtonState(true);
    }
  });
  
  canvas.addEventListener('mouseup', (event) => {
    // Release fire button
    if (event.button === 0) {
      game.setFireButtonState && game.setFireButtonState(false);
    }
  });
  
  // Request pointer lock on click
  function requestPointerLock(): void {
    if (!mouseState.isLocked) {
      canvas.requestPointerLock = canvas.requestPointerLock || 
        (canvas as any).mozRequestPointerLock || 
        (canvas as any).webkitRequestPointerLock;
      
      canvas.requestPointerLock();
    }
  }
  
  // Handle pointer lock change
  document.addEventListener('pointerlockchange', handlePointerLockChange);
  document.addEventListener('mozpointerlockchange', handlePointerLockChange);
  document.addEventListener('webkitpointerlockchange', handlePointerLockChange);
  
  function handlePointerLockChange(): void {
    const pointerElement = document.pointerLockElement || 
                          (document as any).mozPointerLockElement || 
                          (document as any).webkitPointerLockElement;
    
    // Compare by element ID for safety
    mouseState.isLocked = (pointerElement && pointerElement.id === 'renderCanvas');
  }
  
  // Show instructions for controls
  addControlInstructions();
}

/**
 * Add control instructions to the UI
 */
function addControlInstructions(): void {
  // Create instructions element
  const instructions = document.createElement('div');
  instructions.id = 'controls-instructions';
  instructions.className = 'instructions';
  instructions.innerHTML = `
    <h3>Controls</h3>
    <p>Mouse: Look around</p>
    <p>W/S: Forward/Backward</p>
    <p>A/D: Left/Right</p>
    <p>R/F: Up/Down</p>
    <p>Q/E: Turn Left/Right</p>
    <p>Z/X: Roll Left/Right</p>
    <p>Shift: Boost</p>
    <p>Left Click/Space: Fire</p>
    <p>Click to begin</p>
  `;
  
  // Add to the DOM
  document.body.appendChild(instructions);
  
  // Hide instructions when pointer is locked
  document.addEventListener('pointerlockchange', () => {
    if (document.pointerLockElement) {
      instructions.style.display = 'none';
    } else {
      instructions.style.display = 'block';
    }
  });
}

/**
 * Set up mobile controls (touch)
 * @param {AppState} appState - The application state
 * @param {GameModule} game - The game module
 * @param {string} performanceLevel - Device performance level
 */
function setupMobileControls(appState: AppState, game: GameModule, performanceLevel: string): void {
  // Create mobile UI elements
  const mobileUI = document.createElement('div');
  mobileUI.id = 'mobile-controls';
  mobileUI.className = 'mobile-ui';
  
  // Create left joystick (movement)
  leftJoystickElement = document.createElement('div');
  leftJoystickElement.className = 'joystick left-joystick';
  leftJoystickKnob = document.createElement('div');
  leftJoystickKnob.className = 'joystick-knob';
  leftJoystickElement.appendChild(leftJoystickKnob);
  mobileUI.appendChild(leftJoystickElement);
  
  // Create right joystick (rotation)
  rightJoystickElement = document.createElement('div');
  rightJoystickElement.className = 'joystick right-joystick';
  rightJoystickKnob = document.createElement('div');
  rightJoystickKnob.className = 'joystick-knob';
  rightJoystickElement.appendChild(rightJoystickKnob);
  mobileUI.appendChild(rightJoystickElement);
  
  // Create fire button
  shootButton = document.createElement('div');
  shootButton.className = 'control-button shoot-button';
  shootButton.innerHTML = 'FIRE';
  mobileUI.appendChild(shootButton);
  
  // Create boost button
  boostButton = document.createElement('div');
  boostButton.className = 'control-button boost-button';
  boostButton.innerHTML = 'BOOST';
  mobileUI.appendChild(boostButton);
  
  // Add mobile UI to document
  document.body.appendChild(mobileUI);
  
  // Setup joystick events
  setupJoystickEvents(leftJoystickElement, leftJoystickKnob, 'left');
  setupJoystickEvents(rightJoystickElement, rightJoystickKnob, 'right');
  
  // Setup button events
  setupButtonEvents(shootButton, 
    () => { game.setFireButtonState && game.setFireButtonState(true); },
    () => { game.setFireButtonState && game.setFireButtonState(false); }
  );
  
  setupButtonEvents(boostButton,
    () => { keyState.boost = true; },
    () => { keyState.boost = false; }
  );
  
  // Add CSS for mobile UI
  const mobileStyles = document.createElement('style');
  mobileStyles.innerHTML = `
    .mobile-ui {
      position: fixed;
      left: 0;
      top: 0;
      width: 100%;
      height: 100%;
      z-index: 100;
      pointer-events: none;
    }
    
    .joystick {
      position: absolute;
      width: 150px;
      height: 150px;
      background-color: rgba(50, 50, 50, 0.5);
      border-radius: 50%;
      pointer-events: all;
    }
    
    .left-joystick {
      left: 30px;
      bottom: 30px;
    }
    
    .right-joystick {
      right: 30px;
      bottom: 30px;
    }
    
    .joystick-knob {
      position: absolute;
      left: 50%;
      top: 50%;
      width: 60px;
      height: 60px;
      margin-left: -30px;
      margin-top: -30px;
      background-color: rgba(200, 200, 200, 0.8);
      border-radius: 50%;
    }
    
    .control-button {
      position: absolute;
      width: 80px;
      height: 80px;
      border-radius: 50%;
      background-color: rgba(200, 50, 50, 0.7);
      color: white;
      text-align: center;
      line-height: 80px;
      font-weight: bold;
      pointer-events: all;
    }
    
    .shoot-button {
      right: 30px;
      top: 100px;
    }
    
    .boost-button {
      right: 130px;
      top: 150px;
      background-color: rgba(50, 100, 200, 0.7);
    }
  `;
  
  document.head.appendChild(mobileStyles);
}

/**
 * Set up joystick events
 * @param {HTMLElement} joystickElement - The joystick element
 * @param {HTMLElement} knobElement - The knob element
 * @param {string} joystickId - Identifier ('left' or 'right')
 */
function setupJoystickEvents(joystickElement: HTMLElement, knobElement: HTMLElement, joystickId: string): void {
  // Get joystick dimensions
  const joystickRect = joystickElement.getBoundingClientRect();
  const joystickRadius = joystickRect.width / 2;
  const knobRadius = knobElement.offsetWidth / 2;
  const maxDistance = joystickRadius - knobRadius;
  
  // Touch start event
  joystickElement.addEventListener('touchstart', (event) => {
    event.preventDefault();
    
    // Get touch
    const touch = event.touches[0];
    
    // Store touch ID
    if (joystickId === 'left') {
      touchState.leftJoystick.touchId = touch.identifier;
    } else {
      touchState.rightJoystick.touchId = touch.identifier;
    }
    
    // Update joystick position
    updateJoystickPosition(touch);
  });
  
  // Touch move event
  joystickElement.addEventListener('touchmove', (event) => {
    event.preventDefault();
    
    // Find the correct touch
    const touchId = joystickId === 'left' ? 
      touchState.leftJoystick.touchId : 
      touchState.rightJoystick.touchId;
    
    for (let i = 0; i < event.touches.length; i++) {
      const touch = event.touches[i];
      if (touch.identifier === touchId) {
        updateJoystickPosition(touch);
        break;
      }
    }
  });
  
  // Touch end event
  joystickElement.addEventListener('touchend', (event) => {
    event.preventDefault();
    
    // Find the correct touch
    const touchId = joystickId === 'left' ? 
      touchState.leftJoystick.touchId : 
      touchState.rightJoystick.touchId;
    
    let touchEnded = false;
    
    for (let i = 0; i < event.changedTouches.length; i++) {
      const touch = event.changedTouches[i];
      if (touch.identifier === touchId) {
        touchEnded = true;
        break;
      }
    }
    
    if (touchEnded) {
      // Reset joystick
      resetJoystick();
    }
  });
  
  // Touch cancel event
  joystickElement.addEventListener('touchcancel', (event) => {
    resetJoystick();
  });
  
  // Update joystick position
  function updateJoystickPosition(touch: Touch): void {
    const rect = joystickElement.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    
    // Calculate distance from center
    let deltaX = touch.clientX - centerX;
    let deltaY = touch.clientY - centerY;
    
    // Calculate distance
    const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
    
    // Limit distance to joystick radius
    if (distance > maxDistance) {
      deltaX = deltaX * maxDistance / distance;
      deltaY = deltaY * maxDistance / distance;
    }
    
    // Update knob position
    knobElement.style.transform = `translate(${deltaX}px, ${deltaY}px)`;
    
    // Update touch state
    const normalizedX = deltaX / maxDistance;
    const normalizedY = deltaY / maxDistance;
    
    if (joystickId === 'left') {
      touchState.leftJoystick.x = normalizedX;
      touchState.leftJoystick.y = normalizedY;
    } else {
      touchState.rightJoystick.x = normalizedX;
      touchState.rightJoystick.y = normalizedY;
    }
  }
  
  // Reset joystick
  function resetJoystick(): void {
    // Reset touch ID
    if (joystickId === 'left') {
      touchState.leftJoystick.touchId = null;
      touchState.leftJoystick.x = 0;
      touchState.leftJoystick.y = 0;
    } else {
      touchState.rightJoystick.touchId = null;
      touchState.rightJoystick.x = 0;
      touchState.rightJoystick.y = 0;
    }
    
    // Reset knob position
    knobElement.style.transform = 'translate(0, 0)';
  }
}

/**
 * Set up button events
 * @param {HTMLElement} buttonElement - The button element
 * @param {Function} pressHandler - Function to call when button is pressed
 * @param {Function} releaseHandler - Function to call when button is released
 */
function setupButtonEvents(
  buttonElement: HTMLElement, 
  pressHandler: () => void, 
  releaseHandler: () => void
): void {
  // Touch start
  buttonElement.addEventListener('touchstart', (event) => {
    event.preventDefault();
    buttonElement.classList.add('active');
    pressHandler();
  });
  
  // Touch end
  buttonElement.addEventListener('touchend', (event) => {
    event.preventDefault();
    buttonElement.classList.remove('active');
    releaseHandler();
  });
  
  // Touch cancel
  buttonElement.addEventListener('touchcancel', (event) => {
    event.preventDefault();
    buttonElement.classList.remove('active');
    releaseHandler();
  });
  
  // Mouse events (for testing on desktop)
  buttonElement.addEventListener('mousedown', (event) => {
    event.preventDefault();
    buttonElement.classList.add('active');
    pressHandler();
  });
  
  buttonElement.addEventListener('mouseup', (event) => {
    event.preventDefault();
    buttonElement.classList.remove('active');
    releaseHandler();
  });
  
  buttonElement.addEventListener('mouseleave', (event) => {
    if (buttonElement.classList.contains('active')) {
      buttonElement.classList.remove('active');
      releaseHandler();
    }
  });
  
  // Add styles for active state
  const buttonStyles = document.createElement('style');
  buttonStyles.innerHTML = `
    .control-button.active {
      transform: scale(0.9);
      background-color: rgba(255, 100, 100, 0.8);
    }
    
    .boost-button.active {
      background-color: rgba(100, 150, 255, 0.8);
    }
  `;
  
  document.head.appendChild(buttonStyles);
}

/**
 * Setup desktop-specific controls
 * @param {AppState} appState - The application state
 * @param {GameModule} game - The game module
 * @param {string} performanceLevel - Device performance level
 * @param {RendererInstance} renderer - The renderer instance
 */
function setupDesktopControls(appState: AppState, game: GameModule, performanceLevel: string, renderer: RendererInstance): void {
  // Set up mouse controls
  setupMouseControls(game, renderer);
  
  // Setup any specific desktop options
  if (performanceLevel === 'high') {
    // High-quality graphics for desktop by default
    appState.gameOptions.graphicsQuality = 'high';
  } else {
    // Medium quality for lower-end desktops
    appState.gameOptions.graphicsQuality = 'medium';
  }
} 