// Main entry point for the client-side application

import { initializeRenderer } from './modules/rendering/renderer';
import { initializeGameLogic } from './modules/game/game';
import { setupNetworking } from './modules/network/network';
import { initializeAdEngine } from './modules/ads/adEngine';
import { detectMobileDevice, setupControls } from './modules/game/controls';
import { AppState, RendererInstance, NetworkManager, GameModule } from './types';

// Performance debugging
const debugPerformance = true;
let debugStartTime = Date.now();
function debugTime(label: string) {
  if (debugPerformance) {
    const now = Date.now();
    const elapsed = now - debugStartTime;
    console.log(`[PERF] ${label}: ${elapsed}ms`);
    debugStartTime = now; // Reset for next timing
  }
}

// Application state
let appState: AppState = {
  loading: true,
  playerStats: {
    health: 100,
    position: { x: 100, y: 200, z: 100 }, // Starting position
    rotation: { x: 0, y: 0, z: 0 },
    velocity: { x: 0, y: 0, z: 0 },
    boost: false
  },
  otherPlayers: {},
  gameOptions: {
    isMobile: detectMobileDevice(),
    debug: false,
    soundEnabled: true,
    gravity: false, // Disable gravity initially for easier flying
    performanceLevel: 'medium' // Add default performance level
  }
};

// DOM elements
const loadingElement = document.getElementById('loading') as HTMLDivElement;
const progressBar = document.getElementById('progress-bar') as HTMLDivElement;
const hudElement = document.getElementById('hud') as HTMLDivElement;
const healthBar = document.getElementById('health') as HTMLDivElement;
const mobileControls = document.querySelector('.mobile-controls') as HTMLDivElement;

// Sound toggle button
let soundToggleBtn: HTMLDivElement;
// Debug toggle button
let debugToggleBtn: HTMLDivElement;

// Initialize the game
async function initializeGame(): Promise<void> {
  try {
    debugTime('Starting game initialization');
    updateLoadingProgress(10, 'Initializing Babylon.js engine...');
    
    // Initialize Babylon.js renderer, scene, camera
    debugTime('Before renderer initialization');
    const renderer: RendererInstance = await initializeRenderer(appState);
    debugTime('After renderer initialization');
    
    // Save renderer in appState for controls to access
    appState.renderer = renderer;
    
    updateLoadingProgress(30, 'Setting up game logic...');
    
    // Initialize game logic
    debugTime('Before game logic initialization');
    const game = await initializeGameLogic(appState, renderer);
    debugTime('After game logic initialization');
    updateLoadingProgress(50, 'Connecting to server...');
    
    // Setup WebSocket connection
    debugTime('Before network setup');
    const networkManager = await setupNetworking(appState, game) as NetworkManager;
    debugTime('After network setup');
    game.setNetworkManager(networkManager);
    updateLoadingProgress(70, 'Initializing ad engine...');
    
    // Initialize billboard ad engine
    debugTime('Before ad engine initialization');
    const adEngine = await initializeAdEngine(renderer.scene);
    debugTime('After ad engine initialization');
    updateLoadingProgress(90, 'Setting up controls...');
    
    // Setup controls based on device
    debugTime('Before controls setup');
    const controls = setupControls(appState, game, renderer);
    debugTime('After controls setup');
    
    // Show appropriate UI for device type
    if (appState.gameOptions.isMobile) {
      mobileControls.style.display = 'block';
    }
    
    // Create sound toggle button
    createSoundToggleButton(game);
    
    // Create debug toggle button
    createDebugToggleButton(game);
    
    // Create performance settings button
    createPerformanceButton(game);
    
    // Complete loading and show game
    updateLoadingProgress(100, 'Ready!');
    debugTime('Game fully initialized');
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
  } catch (error:any) {
    console.error('Error during game initialization:', error);
    updateLoadingProgress(0, `Error: ${error.message || 'Unknown error'}`);
  }
}

/**
 * Create sound toggle button
 * @param {GameModule} game - Game module
 */
function createSoundToggleButton(game: GameModule): void {
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
    const soundEnabled = game.toggleSound?.() ?? false;
    soundToggleBtn.innerHTML = soundEnabled ? 
      '<span style="color:#0ff;font-size:20px;">♪</span>' : 
      '<span style="color:#0ff;font-size:20px;">♪̸</span>';
  });
  
  document.body.appendChild(soundToggleBtn);
}

/**
 * Create debug toggle button
 * @param {GameModule} game - Game module
 */
function createDebugToggleButton(game: GameModule): void {
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
    const debugEnabled = game.toggleDebug?.() ?? false;
    debugToggleBtn.style.backgroundColor = debugEnabled ? 
      'rgba(255, 0, 0, 0.3)' : 'rgba(0, 0, 0, 0.5)';
  });
  
  document.body.appendChild(debugToggleBtn);
}

/**
 * Create performance settings button
 * @param {GameModule} game - Game module
 */
function createPerformanceButton(game: GameModule): void {
  const perfBtn = document.createElement('div');
  perfBtn.style.position = 'absolute';
  perfBtn.style.top = '20px';
  perfBtn.style.right = '140px'; // Position next to debug button
  perfBtn.style.padding = '5px 10px';
  perfBtn.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
  perfBtn.style.border = '2px solid #0ff';
  perfBtn.style.borderRadius = '4px';
  perfBtn.style.color = '#0ff';
  perfBtn.style.cursor = 'pointer';
  perfBtn.style.zIndex = '1001';
  perfBtn.style.fontFamily = 'monospace';
  perfBtn.style.fontSize = '12px';
  perfBtn.textContent = `PERF: ${appState.gameOptions.performanceLevel || 'medium'}`;
  
  // Add click event
  perfBtn.addEventListener('click', () => {
    // Cycle through performance levels
    const levels = ['low', 'medium', 'high'];
    const currentIndex = levels.indexOf(appState.gameOptions.performanceLevel || 'medium');
    const nextIndex = (currentIndex + 1) % levels.length;
    appState.gameOptions.performanceLevel = levels[nextIndex];
    
    // Update button text
    perfBtn.textContent = `PERF: ${appState.gameOptions.performanceLevel}`;
    
    // Apply performance settings
    applyPerformanceSettings(levels[nextIndex]);
  });
  
  document.body.appendChild(perfBtn);
}

/**
 * Apply performance settings
 * @param {string} level - Performance level (low, medium, high)
 */
function applyPerformanceSettings(level: string): void {
  if (!appState.renderer?.engine) return;
  
  const engine = appState.renderer.engine;
  const scene = appState.renderer.scene;
  
  switch (level) {
    case 'low':
      engine.setHardwareScalingLevel(2.0); // Render at half resolution
      scene.postProcessesEnabled = false;
      scene.fogEnabled = false;
      scene.shadowsEnabled = false;
      scene.particlesEnabled = false;
      break;
    case 'medium':
      engine.setHardwareScalingLevel(1.5); 
      scene.postProcessesEnabled = true;
      scene.fogEnabled = true;
      scene.shadowsEnabled = false; // Still disable shadows for medium
      scene.particlesEnabled = true;
      break;
    case 'high':
      engine.setHardwareScalingLevel(1.0); // Full resolution
      scene.postProcessesEnabled = true;
      scene.fogEnabled = true;
      scene.shadowsEnabled = true;
      scene.particlesEnabled = true;
      break;
  }
}

// Update loading progress bar
function updateLoadingProgress(percentage: number, message?: string): void {
  progressBar.style.width = `${percentage}%`;
  const loadingText = document.querySelector('#loading p');
  if (loadingText) {
    loadingText.textContent = message || 'Loading...';
  }
  
  // Force browser to repaint
  void loadingElement.offsetWidth;
}

// Handle errors
window.addEventListener('error', (error) => {
  console.error('Game error:', error);
  updateLoadingProgress(0, `Error: ${error.message}`);
});

// Start game when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  // Apply low performance settings immediately to prevent freezing
  appState.gameOptions.performanceLevel = 'low';
  
  // Try catch to ensure user can see error
  try {
    initializeGame().catch(error => {
      console.error('Failed to initialize game:', error);
      updateLoadingProgress(0, `Failed to start: ${error.message}`);
    });
  } catch (error) {
    console.error('Critical error starting game:', error);
    updateLoadingProgress(0, `Critical error: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
});

// Export for debugging
(window as any).gameState = appState; 
(window as any).forceLowPerformance = function() {
  applyPerformanceSettings('low');
  return "Performance set to low";
}; 