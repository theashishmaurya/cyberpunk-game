// Client-side type definitions
import { Socket } from 'socket.io-client';

// Use require for Babylon.js to avoid module resolution issues
const BABYLON = require('@babylonjs/core');

export interface Vector3 {
  x: number;
  y: number;
  z: number;
}

export interface AppState {
  loading: boolean;
  gameRunning?: boolean;
  playerStats: {
    health: number;
    position: Vector3;
    rotation: Vector3;
    velocity: Vector3;
    boost: boolean;
    boosting?: boolean;
  };
  otherPlayers: Record<string, PlayerData>;
  gameOptions: {
    isMobile: boolean;
    debug: boolean;
    soundEnabled: boolean;
    gravity: boolean;
    performanceLevel?: string;
    graphicsQuality?: string;
  };
  renderer?: RendererInstance;
}

export interface PlayerData {
  id: string;
  username: string;
  position: Vector3;
  rotation: Vector3;
  health: number;
  score: number;
  boost: boolean;
}

export interface GameStateUpdate {
  timestamp: number;
  players: Record<string, PlayerData>;
  ads: Ad[];
}

export interface Ad {
  id: string;
  position: Vector3;
  rotation: Vector3;
  scale: Vector3;
  content: string;
  imageUrl?: string;
  clickUrl?: string;
  active: boolean;
  startTime: number;
  duration: number;
}

export interface RendererInstance {
  scene: any; // BABYLON.Scene
  engine: any; // BABYLON.Engine
  camera: any; // BABYLON.ArcRotateCamera | BABYLON.FreeCamera
  canvas: HTMLCanvasElement;
  cityManager?: any;
  playerCar?: any;
  update: (deltaTime: number) => void;
  updatePlayerPosition?: (playerStats: any) => void;
  createExplosion?: (position: {x: number, y: number, z: number}, scale?: number) => void;
  fireLaser?: (options: {position: Vector3, rotation: Vector3, color: string}) => void;
  addPlayer: (id: string, data: PlayerData) => void;
  updatePlayer: (id: string, data: PlayerData) => void;
  removePlayer: (id: string) => void;
}

export interface NetworkManager {
  socket?: Socket;
  connect?: () => void;
  disconnect: () => void;
  sendPlayerUpdate: (data: Partial<PlayerData>) => void;
  sendLaserShot?: (data: {position: Vector3, rotation: Vector3}) => void;
  sendLaserHit?: (hitData: {targetId: string, position: Vector3}) => void;
  getLatency?: () => number;
  getPlayerCount?: () => number;
  reconnect?: () => void;
}

export interface GameInstance {
  start: () => void;
  update: (deltaTime: number) => void;
  setNetworkManager: (networkManager: NetworkManager) => void;
  toggleSound: () => boolean;
  toggleDebug: () => boolean;
}

export interface ControlsManager {
  setupKeyboardControls: () => void;
  setupTouchControls: () => void;
  update: (deltaTime: number) => void;
}

export interface CollisionSystem {
  checkCollisions: () => void;
  addObject: (id: string, mesh: any, type: string) => void; // BABYLON.AbstractMesh
  removeObject: (id: string) => void;
  update: (deltaTime: number) => void;
}

export interface GameModule {
  start: () => void;
  stop: () => void;
  update: (deltaTime: number) => void;
  handleInput?: (input: any) => void;
  updatePlayerVelocity: (velocityChange: {x?: number, y?: number, z?: number, boost?: boolean}) => void;
  updatePlayerRotation: (rotationChange: {x?: number, y?: number, z?: number}) => void;
  fireLaser: () => void;
  setFireButtonState: (isHeld: boolean) => void;
  resetPlayer: () => void;
  setNetworkManager: (nm: NetworkManager) => void;
  showHitEffect: (fromDirection: {x: number, y: number, z: number}) => void;
  showRespawnEffect: () => void;
  toggleSound?: () => boolean;
  toggleDebug?: () => boolean;
}
