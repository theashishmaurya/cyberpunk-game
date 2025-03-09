// Main entry point for the client-side application

import { initializeRenderer } from './modules/rendering/renderer.js';
import { initializeGameLogic } from './modules/game/game.js';
import { setupNetworking } from './modules/network/network.js';
import { initializeAdEngine } from './modules/ads/adEngine.js';
import { detectMobileDevice, setupControls } from './modules/game/controls.js';

// Application state
let appState = {
  loading: true,
  playerStats: {
    health: 100,
    position: { x: 100, y: 200, z: 100 }, // Changed starting position for better view
    rotation: { x: 0, y: 0, z: 0 },
    velocity: { x: 0, y: 0, z: 0 },
    boost: false
  },
  otherPlayers: {},
  gameOptions: {
    isMobile: detectMobileDevice(),
    debug: false,
    soundEnabled: true,
    gravity: false // Disable gravity initially for easier flying
  }
};

// DOM elements
const loadingElement = document.getElementById('loading');
const progressBar = document.getElementById('progress-bar');
const hudElement = document.getElementById('hud');
const healthBar = document.getElementById('health');
const mobileControls = document.querySelector('.mobile-controls');

// Sound toggle button
let soundToggleBtn;
// Debug toggle button
let debugToggleBtn;

// Initialize the game
async function initializeGame() {
  updateLoadingProgress(10, 'Initializing renderer...');
  
  // Initialize Three.js renderer, scene, camera
  const renderer = await initializeRenderer(appState);
  
  // Save renderer in appState for controls to access
  appState.renderer = renderer;
  
  updateLoadingProgress(30, 'Setting up game logic...');
  
  // Initialize game logic
  const game = await initializeGameLogic(appState, renderer);
  updateLoadingProgress(50, 'Connecting to server...');
  
  // Setup WebSocket connection
  const networkManager = await setupNetworking(appState, game);
  game.setNetworkManager(networkManager);
  updateLoadingProgress(70, 'Initializing ad engine...');
  
  // Initialize billboard ad engine
  const adEngine = await initializeAdEngine(renderer.scene);
  updateLoadingProgress(90, 'Setting up controls...');
  
  // Setup controls based on device
  const controls = setupControls(appState, game, renderer);
  
  // Show appropriate UI for device type
  if (appState.gameOptions.isMobile) {
    mobileControls.style.display = 'block';
  }
  
  // Create sound toggle button
  createSoundToggleButton(game);
  
  // Create debug toggle button
  createDebugToggleButton(game);
  
  // Complete loading and show game
  updateLoadingProgress(100, 'Ready!');
  setTimeout(() => {
    loadingElement.style.display = 'none';
    hudElement.style.display = 'block';
    
    // Start the game loop
    game.start();
  }, 500);
  
  // Update health bar when player health changes
  setInterval(() => {
    healthBar.style.width = `${appState.playerStats.health}%`;
  }, 100);
}

/**
 * Create sound toggle button
 * @param {Object} game - Game module
 */
function createSoundToggleButton(game) {
  // Create sound toggle button
  soundToggleBtn = document.createElement('div');
  soundToggleBtn.style.position = 'absolute';
  soundToggleBtn.style.top = '20px';
  soundToggleBtn.style.right = '20px';
  soundToggleBtn.style.width = '40px';
  soundToggleBtn.style.height = '40px';
  soundToggleBtn.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
  soundToggleBtn.style.border = '2px solid #0ff';
  soundToggleBtn.style.borderRadius = '50%';
  soundToggleBtn.style.cursor = 'pointer';
  soundToggleBtn.style.zIndex = '1001';
  soundToggleBtn.style.display = 'flex';
  soundToggleBtn.style.justifyContent = 'center';
  soundToggleBtn.style.alignItems = 'center';
  soundToggleBtn.innerHTML = '<span style="color:#0ff;font-size:20px;">♪</span>';
  
  // Add click event
  soundToggleBtn.addEventListener('click', () => {
    const soundEnabled = game.toggleSound();
    soundToggleBtn.innerHTML = soundEnabled ? 
      '<span style="color:#0ff;font-size:20px;">♪</span>' : 
      '<span style="color:#0ff;font-size:20px;">♪̸</span>';
  });
  
  document.body.appendChild(soundToggleBtn);
}

/**
 * Create debug toggle button
 * @param {Object} game - Game module
 */
function createDebugToggleButton(game) {
  // Create debug toggle button
  debugToggleBtn = document.createElement('div');
  debugToggleBtn.style.position = 'absolute';
  debugToggleBtn.style.top = '20px';
  debugToggleBtn.style.right = '80px'; // Position next to sound button
  debugToggleBtn.style.width = '40px';
  debugToggleBtn.style.height = '40px';
  debugToggleBtn.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
  debugToggleBtn.style.border = '2px solid #0ff';
  debugToggleBtn.style.borderRadius = '50%';
  debugToggleBtn.style.cursor = 'pointer';
  debugToggleBtn.style.zIndex = '1001';
  debugToggleBtn.style.display = 'flex';
  debugToggleBtn.style.justifyContent = 'center';
  debugToggleBtn.style.alignItems = 'center';
  debugToggleBtn.style.fontFamily = 'monospace';
  debugToggleBtn.innerHTML = '<span style="color:#0ff;font-size:16px;">DBG</span>';
  
  // Add click event
  debugToggleBtn.addEventListener('click', () => {
    const debugEnabled = game.toggleDebug();
    debugToggleBtn.style.backgroundColor = debugEnabled ? 
      'rgba(255, 0, 0, 0.3)' : 'rgba(0, 0, 0, 0.5)';
  });
  
  document.body.appendChild(debugToggleBtn);
}

// Update loading progress bar
function updateLoadingProgress(percentage, message) {
  progressBar.style.width = `${percentage}%`;
  const loadingText = document.querySelector('#loading p');
  if (loadingText) {
    loadingText.textContent = message || 'Loading...';
  }
}

// Handle errors
window.addEventListener('error', (error) => {
  console.error('Game error:', error);
  updateLoadingProgress(0, `Error: ${error.message}`);
});

// Start game when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  initializeGame().catch(error => {
    console.error('Failed to initialize game:', error);
    updateLoadingProgress(0, `Failed to start: ${error.message}`);
  });
});

// Export for debugging
window.gameState = appState; 