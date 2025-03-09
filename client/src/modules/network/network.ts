import { io, Socket } from 'socket.io-client';

// Define types
interface PlayerStats {
  position: {
    x: number;
    y: number;
    z: number;
  };
  rotation: {
    x: number;
    y: number;
    z: number;
    w?: number;
  };
  velocity: {
    x: number;
    y: number;
    z: number;
  };
  health: number;
}

interface Player {
  id: string;
  position: {
    x: number;
    y: number;
    z: number;
  };
  rotation: {
    x: number;
    y: number;
    z: number;
    w?: number;
  };
  velocity?: {
    x: number;
    y: number;
    z: number;
  };
  health: number;
}

interface AppState {
  playerStats: PlayerStats;
  otherPlayers: Record<string, Player>;
}

interface Game {
  renderer?: {
    updateOtherPlayers: (players: Record<string, Player>) => void;
    fireLaser?: (data: LaserData) => void;
    createExplosion?: (position: {x: number, y: number, z: number}, size: number) => void;
  };
  showHitEffect?: (fromDirection: {x: number, y: number, z: number}) => void;
  showRespawnEffect?: () => void;
}

interface LaserData {
  position: {
    x: number;
    y: number;
    z: number;
  };
  rotation: {
    x: number;
    y: number;
    z: number;
    w?: number;
  };
  isRemoteLaser?: boolean;
  playerId?: string;
}

interface HitData {
  targetId: string;
  position: {
    x: number;
    y: number;
    z: number;
  };
}

interface NetworkManager {
  sendPlayerUpdate: (playerData: PlayerStats) => void;
  sendLaserShot: (laserData: LaserData) => void;
  sendLaserHit: (hitData: HitData) => void;
  getLatency: () => number;
  getPlayerCount: () => number;
  disconnect: () => void;
  reconnect: () => void;
}

// WebSocket connection
let socket: Socket | null = null;

// Network state
let pingInterval: NodeJS.Timeout | null = null;
let lastPingTime = 0;
let latency = 0;

/**
 * Set up networking with WebSockets for real-time multiplayer
 * @param {AppState} appState - The application state
 * @param {Game} game - The game module
 * @returns {NetworkManager} - The network manager
 */
export async function setupNetworking(appState: AppState, game: Game): Promise<NetworkManager> {
  // Create a WebSocket connection to the server
  // Use proper port handling - use 5000 for server
  const wsPort = process.env.NODE_ENV === 'production' ? window.location.port : '5000';
  const wsUrl = `${window.location.protocol}//${window.location.hostname}:${wsPort}`;
  
  console.log('Connecting to WebSocket server at:', wsUrl);
  
  // Configure Socket.IO with proper options
  socket = io(wsUrl, {
    reconnection: true,
    reconnectionAttempts: 5,
    reconnectionDelay: 1000,
    transports: ['websocket', 'polling']
  });
  
  // Setup event listeners
  setupSocketListeners(appState, game);
  
  // Create network manager
  const networkManager: NetworkManager = {
    sendPlayerUpdate,
    sendLaserShot,
    sendLaserHit,
    getLatency: () => latency,
    getPlayerCount: () => Object.keys(appState.otherPlayers).length + 1,
    disconnect: () => socket?.disconnect(),
    reconnect: () => {
      if (socket?.disconnected) {
        console.log('Attempting to reconnect...');
        socket.connect();
      }
    }
  };
  
  return networkManager;
}

/**
 * Set up WebSocket event listeners
 * @param {AppState} appState - The application state
 * @param {Game} game - The game module
 */
function setupSocketListeners(appState: AppState, game: Game): void {
  if (!socket) return;

  // Connection established
  socket.on('connect', () => {
    console.log('Connected to server with ID:', socket?.id);
    
    // Send initial player data
    const initialData = {
      position: appState.playerStats.position,
      rotation: appState.playerStats.rotation,
      velocity: appState.playerStats.velocity,
      health: appState.playerStats.health
    };
    
    socket?.emit('player:join', initialData);
    
    // Start ping interval to measure latency
    startPingInterval();
  });
  
  // Disconnection
  socket.on('disconnect', () => {
    console.log('Disconnected from server');
    if (pingInterval) {
      clearInterval(pingInterval);
      pingInterval = null;
    }
  });
  
  // Error handling
  socket.on('connect_error', (error) => {
    console.error('Connection error:', error);
  });
  
  // Game state update from server
  socket.on('game:state', (gameState: {players: Record<string, Player>}) => {
    // Update other players
    if (game.renderer) {
      game.renderer.updateOtherPlayers(gameState.players);
    }
  });
  
  // Player hit by laser
  socket.on('player:hit', (data: {health: number, fromDirection: {x: number, y: number, z: number}}) => {
    // Update player health
    appState.playerStats.health = data.health;
    
    // Show hit effect
    if (game.showHitEffect) {
      game.showHitEffect(data.fromDirection);
    }
  });
  
  // Respawn player
  socket.on('player:respawn', (data: {position: {x: number, y: number, z: number}}) => {
    // Update player position and health
    appState.playerStats.position = data.position;
    appState.playerStats.health = 100;
    
    // Show respawn effect
    if (game.showRespawnEffect) {
      game.showRespawnEffect();
    }
  });
  
  // Laser shot from another player
  socket.on('laser:shot', (data: LaserData & {playerId: string}) => {
    // Show laser effect from another player
    if (game.renderer && game.renderer.fireLaser) {
      // Enhanced logging to debug multiplayer laser issues
      console.log(`Received laser from player ${data.playerId}`, data);
      
      // Create the laser with the correct position and rotation
      game.renderer.fireLaser({
        position: data.position,
        rotation: data.rotation,
        isRemoteLaser: true // Flag to identify this as another player's laser
      });
    }
  });
  
  // Laser impact/hit notification
  socket.on('laser:impact', (data: {position: {x: number, y: number, z: number}}) => {
    console.log('Laser impact received:', data);
    
    // Create explosion effect at impact position
    if (game.renderer && game.renderer.createExplosion) {
      const { position } = data;
      
      // Make sure position is valid
      if (position && typeof position.x === 'number') {
        game.renderer.createExplosion({
          x: position.x, 
          y: position.y, 
          z: position.z
        }, 1.0); // Larger explosion
      }
    }
  });
  
  // Player died notification
  socket.on('player:died', (data: {playerId: string}) => {
    // Show death effect for the player who died
    if (game.renderer && game.renderer.createExplosion && appState.otherPlayers[data.playerId]) {
      const pos = appState.otherPlayers[data.playerId].position;
      game.renderer.createExplosion({
        x: pos.x,
        y: pos.y,
        z: pos.z
      }, 2.0); // Even larger explosion for death
    }
  });
  
  // Ping response for latency calculation
  socket.on('pong', () => {
    latency = Date.now() - lastPingTime;
  });
}

/**
 * Send player position update to server
 * @param {PlayerStats} playerData - The player position data
 */
function sendPlayerUpdate(playerData: PlayerStats): void {
  if (!socket || !socket.connected) return;
  
  socket.emit('player:update', {
    position: playerData.position,
    rotation: playerData.rotation,
    velocity: playerData.velocity,
    health: playerData.health
  });
}

/**
 * Send laser shot information to server
 * @param {LaserData} laserData - The laser data (position, direction)
 */
function sendLaserShot(laserData: LaserData): void {
  if (!socket || !socket.connected) return;
  
  socket.emit('laser:fire', laserData);
}

/**
 * Send laser hit information to server
 * @param {HitData} hitData - The hit data (target player, position)
 */
function sendLaserHit(hitData: HitData): void {
  if (!socket || !socket.connected) return;
  
  console.log('Sending laser hit:', hitData);
  socket.emit('laser:hit', hitData);
}

/**
 * Start ping interval for latency measurement
 */
function startPingInterval(): void {
  // Clear any existing interval
  if (pingInterval) {
    clearInterval(pingInterval);
  }
  
  // Send ping every 2 seconds
  pingInterval = setInterval(() => {
    lastPingTime = Date.now();
    socket?.emit('ping');
  }, 2000);
}

/**
 * Get WebSocket instance
 * @returns {Socket|null} - The socket.io instance
 */
export function getSocket(): Socket | null {
  return socket;
} 