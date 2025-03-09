/**
 * Sound Manager - Handles all game audio
 */

// Sound cache
const audioCache = {};
let backgroundMusic = null;
let engineSound = null;
let masterVolume = 0.5;
let soundEnabled = true;

/**
 * Initialize the sound manager
 * @param {boolean} enabled - Whether sound is enabled initially
 * @returns {Object} - Sound manager interface
 */
export function initSoundManager(enabled = true) {
  soundEnabled = enabled;
  preloadSounds();
  
  return {
    playSound,
    playMusic,
    stopMusic,
    startEngineSound,
    updateEngineSound,
    stopEngineSound,
    toggleSound: () => {
      soundEnabled = !soundEnabled;
      if (!soundEnabled) {
        stopAllSounds();
      } else {
        // Restart engine sound if it was playing
        if (engineSound) {
          startEngineSound();
        }
        // Restart music if it was playing
        if (backgroundMusic) {
          playMusic();
        }
      }
      return soundEnabled;
    },
    setMasterVolume: (volume) => {
      masterVolume = Math.max(0, Math.min(1, volume));
      updateAllVolumes();
      return masterVolume;
    },
    getSoundEnabled: () => soundEnabled,
    getMasterVolume: () => masterVolume
  };
}

/**
 * Preload common sounds
 */
function preloadSounds() {
  // Engine sounds
  loadSound('engine_idle', 'https://freesound.org/data/previews/607/607563_1648170-lq.mp3');
  loadSound('engine_boost', 'https://freesound.org/data/previews/197/197899_3633963-lq.mp3');
  
  // Laser sounds
  loadSound('laser_shot', 'https://freesound.org/data/previews/495/495005_9498953-lq.mp3');
  
  // Explosion/impact sounds
  loadSound('explosion', 'https://freesound.org/data/previews/107/107788_1853582-lq.mp3');
  loadSound('collision', 'https://freesound.org/data/previews/331/331912_5121236-lq.mp3');
  
  // UI/feedback sounds
  loadSound('hover', 'https://freesound.org/data/previews/142/142608_1840739-lq.mp3');
  loadSound('select', 'https://freesound.org/data/previews/249/249300_4486188-lq.mp3');
  
  // Ambient city sounds
  loadSound('city_ambient', 'https://freesound.org/data/previews/338/338674_2480403-lq.mp3');
  
  // Background music (cyberpunk style)
  loadSound('bg_music', 'https://freesound.org/data/previews/476/476173_9358551-lq.mp3');
}

/**
 * Load a sound file
 * @param {string} id - Sound identifier
 * @param {string} url - Sound file URL
 */
function loadSound(id, url) {
  const audio = new Audio();
  audio.src = url;
  audio.volume = masterVolume;
  audio.preload = 'auto';
  
  // Store in cache
  audioCache[id] = {
    element: audio,
    baseVolume: 1.0 // Default base volume multiplier
  };
  
  // Add load listener
  audio.addEventListener('canplaythrough', () => {
    console.log(`Sound loaded: ${id}`);
  });
  
  // Add error listener
  audio.addEventListener('error', (e) => {
    console.error(`Error loading sound ${id}:`, e);
  });
}

/**
 * Play a sound effect
 * @param {string} id - Sound identifier
 * @param {Object} options - Playback options
 * @returns {HTMLAudioElement|null} - The audio element or null if sound disabled
 */
export function playSound(id, options = {}) {
  if (!soundEnabled) return null;
  
  const { volume = 1.0, loop = false, playbackRate = 1.0 } = options;
  
  // Get sound from cache
  const soundData = audioCache[id];
  if (!soundData) {
    console.warn(`Sound not found: ${id}`);
    return null;
  }
  
  // Create a new audio element (clone) for overlapping sounds
  const soundElement = soundData.element.cloneNode();
  soundElement.volume = Math.min(1, volume * soundData.baseVolume * masterVolume);
  soundElement.loop = loop;
  soundElement.playbackRate = playbackRate;
  
  // Play the sound
  const playPromise = soundElement.play();
  
  // Handle autoplay restrictions in browsers
  if (playPromise !== undefined) {
    playPromise.catch(error => {
      console.warn('Sound autoplay prevented:', error);
    });
  }
  
  return soundElement;
}

/**
 * Play background music
 * @param {string} id - Music identifier (default: 'bg_music')
 * @param {number} volume - Music volume (0-1)
 * @returns {HTMLAudioElement|null} - The audio element or null if sound disabled
 */
export function playMusic(id = 'bg_music', volume = 0.3) {
  if (!soundEnabled) return null;
  
  // Stop any currently playing music
  stopMusic();
  
  // Get music from cache
  const musicData = audioCache[id];
  if (!musicData) {
    console.warn(`Music not found: ${id}`);
    return null;
  }
  
  // Set up the music
  backgroundMusic = musicData.element;
  backgroundMusic.volume = volume * masterVolume;
  backgroundMusic.loop = true;
  
  // Play the music
  const playPromise = backgroundMusic.play();
  
  // Handle autoplay restrictions
  if (playPromise !== undefined) {
    playPromise.catch(error => {
      console.warn('Music autoplay prevented:', error);
      backgroundMusic = null;
    });
  }
  
  return backgroundMusic;
}

/**
 * Stop background music
 */
export function stopMusic() {
  if (backgroundMusic) {
    backgroundMusic.pause();
    backgroundMusic.currentTime = 0;
    backgroundMusic = null;
  }
}

/**
 * Start engine sound loop
 * @param {number} volume - Engine sound volume
 * @returns {HTMLAudioElement|null} - The audio element or null if sound disabled
 */
export function startEngineSound(volume = 0.4) {
  if (!soundEnabled) return null;
  
  // Stop any current engine sound
  stopEngineSound();
  
  // Get engine sound from cache
  const engineSoundData = audioCache['engine_idle'];
  if (!engineSoundData) {
    console.warn('Engine sound not found');
    return null;
  }
  
  // Setup engine sound
  engineSound = engineSoundData.element.cloneNode();
  engineSound.volume = volume * masterVolume;
  engineSound.loop = true;
  
  // Play the engine sound
  const playPromise = engineSound.play();
  
  // Handle autoplay restrictions
  if (playPromise !== undefined) {
    playPromise.catch(error => {
      console.warn('Engine sound autoplay prevented:', error);
      engineSound = null;
    });
  }
  
  return engineSound;
}

/**
 * Update engine sound based on vehicle speed/state
 * @param {number} throttle - Current throttle value (0-1)
 * @param {boolean} boosting - Whether boost is active
 */
export function updateEngineSound(throttle = 0.5, boosting = false) {
  if (!soundEnabled || !engineSound) return;
  
  // Adjust playback rate based on throttle
  engineSound.playbackRate = 0.5 + throttle;
  
  // Adjust volume based on throttle
  engineSound.volume = (0.2 + throttle * 0.3) * masterVolume;
  
  // Play boost sound if activated
  if (boosting) {
    playSound('engine_boost', { volume: 0.3, playbackRate: 0.8 });
  }
}

/**
 * Stop engine sound
 */
export function stopEngineSound() {
  if (engineSound) {
    engineSound.pause();
    engineSound.currentTime = 0;
    engineSound = null;
  }
}

/**
 * Stop all active sounds
 */
function stopAllSounds() {
  // Stop background music
  stopMusic();
  
  // Stop engine sound
  stopEngineSound();
  
  // Stop any playing sound effects
  Object.values(audioCache).forEach(soundData => {
    if (soundData.element) {
      soundData.element.pause();
      soundData.element.currentTime = 0;
    }
  });
}

/**
 * Update all sound volumes when master volume changes
 */
function updateAllVolumes() {
  // Update background music volume
  if (backgroundMusic) {
    backgroundMusic.volume = 0.3 * masterVolume;
  }
  
  // Update engine sound volume
  if (engineSound) {
    engineSound.volume = 0.4 * masterVolume;
  }
} 