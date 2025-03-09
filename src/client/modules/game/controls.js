/**
 * Controls module - handles user input for controlling the flying car
 */

// Key state for keyboard controls
const keyState = {
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
  boost: false
};

// Mouse control state
const mouseState = {
  isLocked: false,
  sensitivity: 0.2,
  lastX: 0,
  lastY: 0
};

// Touch control state for mobile
const touchState = {
  leftJoystick: { x: 0, y: 0, touchId: null },
  rightJoystick: { x: 0, y: 0, touchId: null }
};

// DOM elements for mobile joysticks
let leftJoystickElement;
let leftJoystickKnob;
let rightJoystickElement;
let rightJoystickKnob;
let shootButton;
let boostButton;

/**
 * Detect if the device is mobile
 * @returns {boolean} - True if the device is mobile
 */
export function detectMobileDevice() {
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
}

/**
 * Detect device performance capability
 * @returns {string} - 'low', 'medium', or 'high'
 */
export function detectDevicePerformance() {
  // Check if mobile first
  const isMobile = detectMobileDevice();
  
  // Get rough estimate of device capability
  const hardwareConcurrency = navigator.hardwareConcurrency || 2;
  const memory = navigator.deviceMemory || 4; // Default to 4GB if not available
  
  // Low-end devices
  if (isMobile && (hardwareConcurrency <= 4 || memory <= 4)) {
    return 'low';
  }
  
  // Mid-range devices
  if (isMobile || hardwareConcurrency <= 8 || memory <= 8) {
    return 'medium';
  }
  
  // High-end devices
  return 'high';
}

/**
 * Set up player controls
 * @param {Object} appState - The application state
 * @param {Object} game - The game module
 * @param {Object} renderer - The renderer module
 * @returns {Object} - The controls module
 */
export function setupControls(appState, game, renderer) {
  // Detect device performance capability
  const performanceLevel = detectDevicePerformance();
  
  // Auto-adjust quality settings based on device capability
  if (performanceLevel === 'low') {
    console.log('Detected low-performance device, using low quality settings');
    if (renderer.setQuality) {
      renderer.setQuality(true); // Set to low quality mode
    }
  }
  
  // Setup appropriate controls based on device type
  if (appState.gameOptions.isMobile) {
    return setupMobileControls(appState, game, performanceLevel);
  } else {
    return setupDesktopControls(appState, game, performanceLevel);
  }
}

/**
 * Set up keyboard controls
 * @param {Object} game - The game module
 */
function setupKeyboardControls(game) {
  // Variable to track key input interval ID
  let keyInputIntervalId = null;
  
  // Variable to track last key activity time
  let lastKeyActivity = Date.now();
  
  // Set up key down event
  document.addEventListener('keydown', (event) => {
    // Update the last activity time
    lastKeyActivity = Date.now();
    
    updateKeyState(event.code, true);
    
    // Handle boost key
    if (event.code === 'ShiftLeft' || event.code === 'ShiftRight') {
      keyState.boost = true;
    }
    
    // Handle space key for firing
    if (event.code === 'Space') {
      // Set fire button as held to enable continuous firing
      game.setFireButtonState(true);
    }
  });
  
  // Key up event
  document.addEventListener('keyup', (event) => {
    // Update the last activity time
    lastKeyActivity = Date.now();
    
    updateKeyState(event.code, false);
    
    // Handle boost key
    if (event.code === 'ShiftLeft' || event.code === 'ShiftRight') {
      keyState.boost = false;
    }
    
    // Handle space key release - stop continuous firing
    if (event.code === 'Space') {
      game.setFireButtonState(false);
    }
  });
  
  // Start the keyboard input processing interval
  function startKeyInputInterval() {
    // Clear any existing interval
    if (keyInputIntervalId) {
      clearInterval(keyInputIntervalId);
    }
    
    // Create a new interval
    keyInputIntervalId = setInterval(() => {
      const velocityChange = { x: 0, y: 0, z: 0, boost: keyState.boost };
      const rotationChange = { x: 0, y: 0, z: 0 };
      
      // Forward/backward movement
      if (keyState.up) velocityChange.z = 1;
      if (keyState.down) velocityChange.z = -1;
      
      // Left/right strafing
      if (keyState.left) velocityChange.x = -1;
      if (keyState.right) velocityChange.x = 1;
      
      // Up/down movement
      if (keyState.zIn) velocityChange.y = 1;
      if (keyState.zOut) velocityChange.y = -1;
      
      // Rotation (roll)
      if (keyState.rollLeft) rotationChange.z = 1;
      if (keyState.rollRight) rotationChange.z = -1;
      
      // Rotation (yaw)
      if (keyState.turnLeft) rotationChange.y = 3;
      if (keyState.turnRight) rotationChange.y = -3;
      
      // Apply velocity changes
      if (velocityChange.x !== 0 || velocityChange.y !== 0 || velocityChange.z !== 0 || velocityChange.boost) {
        game.updatePlayerVelocity(velocityChange);
      }
      
      // Apply rotation changes
      if (rotationChange.x !== 0 || rotationChange.y !== 0 || rotationChange.z !== 0) {
        game.updatePlayerRotation(rotationChange);
      }
    }, 16); // ~60fps
  }
  
  // Start the initial interval
  startKeyInputInterval();
  
  // Set up a recovery check at a longer interval
  setInterval(() => {
    // If it's been more than 30 seconds since last key activity
    // and there are active key states, something might be wrong
    const activeKeys = Object.values(keyState).some(state => state === true);
    const timeSinceLastActivity = Date.now() - lastKeyActivity;
    
    // If it's been over 60 seconds with no activity but keys are still pressed
    // or the key input interval has somehow stopped
    if ((timeSinceLastActivity > 60000 && activeKeys) || !keyInputIntervalId) {
      console.log('Recovering keyboard controls...');
      
      // Reset all key states
      Object.keys(keyState).forEach(key => {
        keyState[key] = false;
      });
      
      // Restart the key input interval
      startKeyInputInterval();
    }
  }, 10000); // Check every 10 seconds
}

/**
 * Update key state based on key event
 * @param {string} code - The key code
 * @param {boolean} isPressed - Is key pressed or released
 */
function updateKeyState(code, isPressed) {
  switch (code) {
    case 'KeyW':
      keyState.up = isPressed; // Forward movement (moving Z+)
      break;
    case 'KeyS':
      keyState.down = isPressed; // Backward movement (moving Z-)
      break;
    case 'KeyA':
      keyState.right = isPressed; // Strafe left (moving X-)
      break;
    case 'KeyD':
      keyState.left = isPressed; // Strafe right (moving X+)
      break;
    case 'KeyQ':
      keyState.rollLeft = isPressed; // Roll left
      break;
    case 'KeyE':
      keyState.rollRight = isPressed; // Roll right
      break;
    case 'KeyR':
      keyState.zIn = isPressed; // Move up (Y+)
      break;
    case 'KeyF':
      keyState.zOut = isPressed; // Move down (Y-)
      break;
    case 'ArrowUp':
      keyState.up = isPressed; // Alternative forward
      break;
    case 'ArrowDown':
      keyState.down = isPressed; // Alternative backward
      break;
    case 'ArrowLeft':
      keyState.turnLeft = isPressed; // Turn left (rotate Y+)
      break;
    case 'ArrowRight':
      keyState.turnRight = isPressed; // Turn right (rotate Y-)
      break;
    case 'ShiftLeft':
    case 'ShiftRight':
      keyState.boost = isPressed; // Boost speed
      break;
  }
}

/**
 * Set up mouse controls for camera rotation
 * @param {Object} game - The game module
 * @param {Object} renderer - The renderer module
 */
function setupMouseControls(game, renderer) {
  // Request pointer lock on canvas click
  renderer.renderer.domElement.addEventListener('click', () => {
    if (!mouseState.isLocked) {
      requestPointerLock();
    }
  });
  
  // Handle pointer lock change
  document.addEventListener('pointerlockchange', () => {
    if (document.pointerLockElement === renderer.renderer.domElement) {
      mouseState.isLocked = true;
      console.log('Pointer lock acquired');
    } else {
      mouseState.isLocked = false;
      console.log('Pointer lock released');
      
      // Make sure firing stops if pointer lock is lost
      game.setFireButtonState(false);
    }
  });
  
  // Handle pointer lock error
  document.addEventListener('pointerlockerror', () => {
    console.error('Pointer lock error');
    mouseState.isLocked = false;
    // Try to recover in 1 second
    setTimeout(() => {
      if (!mouseState.isLocked) {
        requestPointerLock();
      }
    }, 1000);
  });
  
  // Automatically attempt to reacquire pointer lock if game is in focus and lock is lost
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && !mouseState.isLocked && document.activeElement === document.body) {
      requestPointerLock();
    }
  });
  
  // Function to request pointer lock with error handling
  function requestPointerLock() {
    try {
      renderer.renderer.domElement.requestPointerLock();
    } catch (e) {
      console.error('Error requesting pointer lock:', e);
    }
  }
  
  // Handle mouse movement - smoothed rotation
  document.addEventListener('mousemove', (event) => {
    if (!mouseState.isLocked) return;
    
    // Check for invalid movement values (can happen in some browsers)
    if (!isFinite(event.movementX) || !isFinite(event.movementY) || 
        Math.abs(event.movementX) > 100 || Math.abs(event.movementY) > 100) {
      return;
    }
    
    // Calculate smooth rotation based on mouse movement
    const rotationChange = {
      x: -event.movementY * mouseState.sensitivity, // Pitch (look up/down)
      y: -event.movementX * mouseState.sensitivity, // Yaw (look left/right)
      z: 0
    };
    
    // Apply rotation change to player
    game.updatePlayerRotation(rotationChange);
  });
  
  // Handle mouse button events for shooting
  renderer.renderer.domElement.addEventListener('mousedown', (event) => {
    if (event.button === 0) { // Left click
      // Enable continuous firing while button is held
      game.setFireButtonState(true);
    }
  });
  
  renderer.renderer.domElement.addEventListener('mouseup', (event) => {
    if (event.button === 0) { // Left click release
      // Disable continuous firing when button is released
      game.setFireButtonState(false);
    }
  });
  
  // Also stop firing if mouse leaves the canvas
  renderer.renderer.domElement.addEventListener('mouseleave', () => {
    game.setFireButtonState(false);
  });
  
  // Add scroll wheel for roll control
  renderer.renderer.domElement.addEventListener('wheel', (event) => {
    if (!mouseState.isLocked) return;
    
    const rollChange = {
      x: 0,
      y: 0,
      z: Math.sign(event.deltaY) * 2 // Roll based on scroll direction
    };
    
    game.updatePlayerRotation(rollChange);
    event.preventDefault();
  }, { passive: false });
  
  // Add keyboard shortcut to regain pointer lock (Escape to exit, Enter to regain)
  document.addEventListener('keydown', (event) => {
    if (event.code === 'Enter' && !mouseState.isLocked) {
      requestPointerLock();
    }
  });
  
  // Set up an interval to check if controls are responsive and try to fix if not
  setInterval(() => {
    // If we expect to be locked but something went wrong with the browser state
    if (mouseState.isLocked && document.pointerLockElement !== renderer.renderer.domElement) {
      console.log('Pointer lock state mismatch, resetting');
      mouseState.isLocked = false;
      
      // Try to reacquire if the page is visible
      if (!document.hidden) {
        requestPointerLock();
      }
    }
  }, 3000); // Check every 3 seconds
}

/**
 * Set up mobile touch controls
 * @param {Object} appState - Application state
 * @param {Object} game - Game module
 * @param {string} performanceLevel - Device performance level
 * @returns {Object} - Mobile controls object
 */
function setupMobileControls(appState, game, performanceLevel) {
  // Mobile-specific optimizations based on performance level
  if (performanceLevel === 'low') {
    // Further reduce view distance for very low-end devices
    appState.gameOptions.viewDistance = 500;
  } else if (performanceLevel === 'medium') {
    appState.gameOptions.viewDistance = 1000;
  }
  
  // Initialize mobile controls
  // Get joystick elements
  leftJoystickElement = document.getElementById('left-joystick');
  leftJoystickKnob = document.getElementById('left-joystick-knob');
  rightJoystickElement = document.getElementById('right-joystick');
  rightJoystickKnob = document.getElementById('right-joystick-knob');
  shootButton = document.getElementById('shoot-button');
  boostButton = document.getElementById('boost-button');
  
  // Make mobile controls visible
  document.querySelector('.mobile-controls').style.display = 'block';
  
  // Set up joystick events
  setupJoystickEvents(leftJoystickElement, leftJoystickKnob, 'left');
  setupJoystickEvents(rightJoystickElement, rightJoystickKnob, 'right');
  
  // Set up button events
  setupButtonEvents(shootButton, 
    () => {
      // Enable continuous firing when button is pressed
      game.setFireButtonState(true);
    }, 
    () => {
      // Disable continuous firing when button is released
      game.setFireButtonState(false);
    }
  );
  
  setupButtonEvents(boostButton, 
    () => {
      keyState.boost = true;
      boostButton.classList.add('active');
    }, 
    () => {
      keyState.boost = false;
      boostButton.classList.remove('active');
    }
  );
  
  // Update game state based on joystick positions
  setInterval(() => {
    // Left joystick controls movement (forward/backward and strafing)
    const velocityChange = {
      x: touchState.leftJoystick.x,     // Strafe left/right
      y: 0,                            // No direct vertical control
      z: -touchState.leftJoystick.y,   // Forward/backward
      boost: keyState.boost
    };
    
    // Right joystick controls rotation (pitch and yaw)
    const rotationChange = {
      x: touchState.rightJoystick.y * 2,  // Pitch (up/down)
      y: -touchState.rightJoystick.x * 2, // Yaw (left/right)
      z: 0                              // No roll from joystick
    };
    
    // Apply velocity changes (this will now respect car's orientation)
    if (velocityChange.x !== 0 || velocityChange.y !== 0 || velocityChange.z !== 0 || velocityChange.boost) {
      game.updatePlayerVelocity(velocityChange);
    }
    
    // Apply rotation changes
    if (rotationChange.x !== 0 || rotationChange.y !== 0 || rotationChange.z !== 0) {
      game.updatePlayerRotation(rotationChange);
    }
  }, 16);
  
  // Prevent scrolling when touching the game area
  document.body.addEventListener('touchmove', (event) => {
    if (event.target.closest('#game-container')) {
      event.preventDefault();
    }
  }, { passive: false });
  
  // Handle orientation change
  window.addEventListener('orientationchange', () => {
    setTimeout(() => {
      // Reset joystick positions after orientation change
      if (leftJoystickKnob) leftJoystickKnob.style.transform = 'translate(0px, 0px)';
      if (rightJoystickKnob) rightJoystickKnob.style.transform = 'translate(0px, 0px)';
      touchState.leftJoystick = { x: 0, y: 0, touchId: null };
      touchState.rightJoystick = { x: 0, y: 0, touchId: null };
    }, 500);
  });
  
  // Prevent default browser behavior for some gestures
  document.addEventListener('gesturestart', (event) => {
    event.preventDefault();
  });
  
  return {
    keyState,
    mouseState,
    touchState,
    setMouseSensitivity: (sensitivity) => {
      mouseState.sensitivity = sensitivity;
    }
  };
}

/**
 * Set up joystick touch events
 * @param {HTMLElement} joystickElement - The joystick element
 * @param {HTMLElement} knobElement - The joystick knob element
 * @param {string} joystickId - 'left' or 'right'
 */
function setupJoystickEvents(joystickElement, knobElement, joystickId) {
  const joystick = joystickId === 'left' ? touchState.leftJoystick : touchState.rightJoystick;
  const joystickRect = joystickElement.getBoundingClientRect();
  const centerX = joystickRect.width / 2;
  const centerY = joystickRect.height / 2;
  const maxDistance = joystickRect.width / 3;
  
  // Touch start
  joystickElement.addEventListener('touchstart', (event) => {
    const touch = event.touches[0];
    joystick.touchId = touch.identifier;
    
    const touchX = touch.clientX - joystickRect.left;
    const touchY = touch.clientY - joystickRect.top;
    
    const dx = touchX - centerX;
    const dy = touchY - centerY;
    const distance = Math.min(Math.sqrt(dx * dx + dy * dy), maxDistance);
    const angle = Math.atan2(dy, dx);
    
    joystick.x = (distance / maxDistance) * Math.cos(angle);
    joystick.y = (distance / maxDistance) * Math.sin(angle);
    
    knobElement.style.transform = `translate(${dx}px, ${dy}px)`;
    
    event.preventDefault();
  });
  
  // Touch move
  joystickElement.addEventListener('touchmove', (event) => {
    for (let i = 0; i < event.touches.length; i++) {
      const touch = event.touches[i];
      
      if (touch.identifier === joystick.touchId) {
        const touchX = touch.clientX - joystickRect.left;
        const touchY = touch.clientY - joystickRect.top;
        
        const dx = touchX - centerX;
        const dy = touchY - centerY;
        const distance = Math.min(Math.sqrt(dx * dx + dy * dy), maxDistance);
        const angle = Math.atan2(dy, dx);
        
        joystick.x = (distance / maxDistance) * Math.cos(angle);
        joystick.y = (distance / maxDistance) * Math.sin(angle);
        
        knobElement.style.transform = `translate(${dx}px, ${dy}px)`;
        break;
      }
    }
    
    event.preventDefault();
  });
  
  // Touch end
  joystickElement.addEventListener('touchend', (event) => {
    for (let i = 0; i < event.changedTouches.length; i++) {
      const touch = event.changedTouches[i];
      
      if (touch.identifier === joystick.touchId) {
        joystick.touchId = null;
        joystick.x = 0;
        joystick.y = 0;
        
        knobElement.style.transform = 'translate(0px, 0px)';
        break;
      }
    }
    
    event.preventDefault();
  });
  
  // Touch cancel
  joystickElement.addEventListener('touchcancel', (event) => {
    for (let i = 0; i < event.changedTouches.length; i++) {
      const touch = event.changedTouches[i];
      
      if (touch.identifier === joystick.touchId) {
        joystick.touchId = null;
        joystick.x = 0;
        joystick.y = 0;
        
        knobElement.style.transform = 'translate(0px, 0px)';
        break;
      }
    }
    
    event.preventDefault();
  });
}

/**
 * Set up button touch events
 * @param {HTMLElement} buttonElement - The button element
 * @param {Function} pressHandler - Function to call when button is pressed
 * @param {Function} releaseHandler - Function to call when button is released
 */
function setupButtonEvents(buttonElement, pressHandler, releaseHandler) {
  let touchId = null;
  
  // Touch start
  buttonElement.addEventListener('touchstart', (event) => {
    if (touchId === null) {
      touchId = event.touches[0].identifier;
      buttonElement.style.transform = 'scale(0.9)';
      
      if (pressHandler) {
        pressHandler();
      }
    }
    
    event.preventDefault();
  });
  
  // Touch end
  buttonElement.addEventListener('touchend', (event) => {
    for (let i = 0; i < event.changedTouches.length; i++) {
      const touch = event.changedTouches[i];
      
      if (touch.identifier === touchId) {
        touchId = null;
        buttonElement.style.transform = 'scale(1.0)';
        
        if (releaseHandler) {
          releaseHandler();
        }
        
        break;
      }
    }
    
    event.preventDefault();
  });
  
  // Touch cancel
  buttonElement.addEventListener('touchcancel', (event) => {
    for (let i = 0; i < event.changedTouches.length; i++) {
      const touch = event.changedTouches[i];
      
      if (touch.identifier === touchId) {
        touchId = null;
        buttonElement.style.transform = 'scale(1.0)';
        
        if (releaseHandler) {
          releaseHandler();
        }
        
        break;
      }
    }
    
    event.preventDefault();
  });
}

/**
 * Setup desktop controls
 * @param {Object} appState - Application state
 * @param {Object} game - Game module
 * @param {string} performanceLevel - Device performance level
 * @returns {Object} - Desktop controls object
 */
function setupDesktopControls(appState, game, performanceLevel) {
  // Desktop-specific optimizations based on performance level
  if (performanceLevel === 'medium') {
    // Reduce some settings for medium-spec desktops
    appState.gameOptions.viewDistance = 1500;
  }
  
  // Initialize desktop controls
  setupKeyboardControls(game);
  setupMouseControls(game, appState.renderer);
  
  return {
    keyState,
    mouseState,
    touchState,
    setMouseSensitivity: (sensitivity) => {
      mouseState.sensitivity = sensitivity;
    }
  };
} 