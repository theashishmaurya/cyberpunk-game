// Server-side type definitions

export interface Player {
  id: string;
  username: string;
  position: Vector3;
  rotation: Vector3;
  velocity: Vector3;
  health: number;
  score: number;
  lastUpdate: number;
  boost: boolean;
  connected: boolean;
}

export interface Vector3 {
  x: number;
  y: number;
  z: number;
}

export interface GameState {
  players: Record<string, Player>;
  update: (deltaTime: number) => void;
  getPlayersData: () => Record<string, PlayerData>;
  addPlayer: (id: string, username: string) => Player;
  removePlayer: (id: string) => void;
  updatePlayer: (id: string, data: Partial<Player>) => void;
  handleCollisions: () => void;
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

export interface AdEngine {
  update: (deltaTime: number) => void;
  getActiveAds: () => Ad[];
  createAd: (adData: Partial<Ad>) => Ad;
  removeAd: (id: string) => void;
} 