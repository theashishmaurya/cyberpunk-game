/**
 * Server-side ad engine - manages billboard advertisements
 */
import { Vector3 } from '../../types.js';

interface AdSize {
  width: number;
  height: number;
}

interface AdData {
  id: string;
  name: string;
  content: string;
  color: string;
  duration: number;
}

interface Billboard {
  id: string;
  position: Vector3;
  size: AdSize;
}

interface ActiveAd {
  id: string;
  billboardId: string;
  name: string;
  content: string;
  color: string;
  startTime: number;
  endTime: number;
  position: Vector3;
  size: AdSize;
}

interface GameStateInterface {
  getAllPlayers: () => Record<string, Player>;
}

interface Player {
  isAlive: boolean;
  position: Vector3;
}

interface AdEngineInterface {
  update: (deltaTime: number) => void;
  getActiveAds: () => Record<string, ActiveAd>;
  getAdById: (adId: string) => AdData | null;
  getAllAds: () => AdData[];
  getBillboardLocations: () => Billboard[];
}

// Ad content data
const ADS: AdData[] = [
  {
    id: 'ad1',
    name: 'Cyber Implants',
    content: 'UPGRADE YOUR BODY - CYBER IMPLANTS ON SALE NOW!',
    color: '#ff00ff',
    duration: 15000, // 15 seconds
  },
  {
    id: 'ad2',
    name: 'Neural Link',
    content: 'NEURAL LINK - CONNECT YOUR MIND TO THE NETWORK',
    color: '#00ffff',
    duration: 12000, // 12 seconds
  },
  {
    id: 'ad3',
    name: 'Night City Tours',
    content: 'EXPLORE NIGHT CITY - GUIDED FLYING TOURS DAILY',
    color: '#ffff00',
    duration: 10000, // 10 seconds
  },
  {
    id: 'ad4',
    name: 'Flying Car Mods',
    content: 'TURBOCHARGE YOUR FLYING CAR - VISIT MECHANIC JOE',
    color: '#ff5500',
    duration: 18000, // 18 seconds
  },
  {
    id: 'ad5',
    name: 'Cyber Cafe',
    content: 'CYBER CAFE - BEST NEURAL DRINKS IN TOWN',
    color: '#00ff99',
    duration: 14000, // 14 seconds
  }
];

// Billboard locations
const BILLBOARD_LOCATIONS: Billboard[] = [
  { id: 'billboard1', position: { x: 100, y: 200, z: 100 }, size: { width: 50, height: 30 } },
  { id: 'billboard2', position: { x: -150, y: 180, z: 50 }, size: { width: 40, height: 25 } },
  { id: 'billboard3', position: { x: 80, y: 220, z: -120 }, size: { width: 60, height: 35 } },
  { id: 'billboard4', position: { x: -100, y: 150, z: -80 }, size: { width: 45, height: 28 } },
  { id: 'billboard5', position: { x: 200, y: 250, z: 0 }, size: { width: 70, height: 40 } },
  { id: 'billboard6', position: { x: 0, y: 300, z: 150 }, size: { width: 80, height: 45 } },
  { id: 'billboard7', position: { x: -200, y: 200, z: -150 }, size: { width: 55, height: 32 } },
  { id: 'billboard8', position: { x: 120, y: 180, z: -70 }, size: { width: 48, height: 30 } }
];

// Active ads state
let activeAds: Record<string, ActiveAd> = {};

// Game state reference
let gameState: GameStateInterface | null = null;

/**
 * Initialize the ad engine
 * @param {GameStateInterface} state - The game state
 * @returns {AdEngineInterface} - The ad engine
 */
export function initializeAdEngine(state: GameStateInterface): AdEngineInterface {
  gameState = state;
  
  // Create initial ad assignments
  BILLBOARD_LOCATIONS.forEach(billboard => {
    assignAdToBillboard(billboard.id);
  });
  
  return {
    update,
    getActiveAds,
    getAdById,
    getAllAds: () => ADS,
    getBillboardLocations: () => BILLBOARD_LOCATIONS
  };
}

/**
 * Assign an ad to a billboard
 * @param {string} billboardId - The billboard ID
 */
function assignAdToBillboard(billboardId: string): void {
  // Choose a random ad
  const adIndex = Math.floor(Math.random() * ADS.length);
  const ad = ADS[adIndex];
  
  // Find the billboard
  const billboard = BILLBOARD_LOCATIONS.find(b => b.id === billboardId);
  
  if (!billboard) return;
  
  // Create active ad
  activeAds[billboardId] = {
    id: ad.id,
    billboardId,
    name: ad.name,
    content: ad.content,
    color: ad.color,
    startTime: Date.now(),
    endTime: Date.now() + ad.duration,
    position: billboard.position,
    size: billboard.size
  };
}

/**
 * Update the ad engine
 * @param {number} deltaTime - Time since last update in seconds
 */
function update(deltaTime: number): void {
  const now = Date.now();
  
  // Check for expired ads
  Object.keys(activeAds).forEach(billboardId => {
    const ad = activeAds[billboardId];
    
    if (now > ad.endTime) {
      // Assign a new ad
      assignAdToBillboard(billboardId);
    }
  });
  
  // Check for player proximity to adjust ads
  if (gameState) {
    const players = gameState.getAllPlayers();
    
    // For each player
    Object.values(players).forEach(player => {
      if (!player.isAlive) return;
      
      // Check distance to each billboard
      BILLBOARD_LOCATIONS.forEach(billboard => {
        const dx = player.position.x - billboard.position.x;
        const dy = player.position.y - billboard.position.y;
        const dz = player.position.z - billboard.position.z;
        const distance = Math.sqrt(dx*dx + dy*dy + dz*dz);
        
        // If player is close to a billboard, potentially change the ad
        if (distance < 100 && Math.random() < 0.001) {
          // 0.1% chance per frame to change ad when player is nearby
          assignAdToBillboard(billboard.id);
        }
      });
    });
  }
}

/**
 * Get all active ads
 * @returns {Record<string, ActiveAd>} - Active ads by billboard ID
 */
function getActiveAds(): Record<string, ActiveAd> {
  return activeAds;
}

/**
 * Get ad by ID
 * @param {string} adId - The ad ID
 * @returns {AdData|null} - The ad or null
 */
function getAdById(adId: string): AdData | null {
  return ADS.find(ad => ad.id === adId) || null;
} 