
export interface GameContext {
  ioNamespace: import("socket.io").Namespace;
  chunkManager: any;
  worldName: string;
  isSkyCastlesMode: boolean;
  isHubMode: boolean;
  db: any;
  mode: any;
  
  bakedBlocks: Map<string, number>;
  npcs: any[];
  players: Record<string, any>;
  morvaneDead: Record<string, boolean>;
  droppedItems: Record<string, any>;
  mobs: Record<string, any>;
  minions: Record<string, any>;
  
  pendingPlayerUpdates: Set<string>;
  pendingHits: any[];
  pendingMobHits: any[];
  pendingRespawns: any[];
  
  playerBuffers: Map<string, Buffer>;
  mobBuffers: Map<string, Buffer>;
  
  spatialHash: Map<number, any[]>;
  playerHash: Map<number, any[]>;

  state: {
    dayTime: number;
    gameState: string;
    gameStartTime: number;
    resetCountdown: number | null;
    emptyRoomSince: number | null;
    hasSetEndgameMessage: boolean;
    hasBeenReset: boolean;
    lastOvertimeDamageTick: number;
    lastSkyCastlesSyncJSON: string;
    tick10sCount: number;
    spawnInterval: number;
    spawnTimeout: NodeJS.Timeout | null;
    isDestroyed: boolean;
  };

  CELL_SIZE: number;
  PLAYER_CELL_SIZE: number;
  dayCycleSpeed: number;
  hostileMobTypes: string[];

  // Functions
  getCellKey: (cx: number, cz: number) => number;
  broadcastToNearby: (eventName: string, data: any, x: number, z: number, rangeSq: number, excludeId?: string | null) => void;
  spawnMob: (type: string, x: number, y: number, z: number, level?: number, team?: string) => void;
  isIndestructible: (x: number, y: number, z: number) => boolean;
  getBlockAt: (x: number, y: number, z: number) => number | undefined;
  resetRoom: () => void;
  handleMorvaneDeath: (deadTeam: string) => void;
}
