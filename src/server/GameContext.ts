
import { IServerPlayer, ITickMob, IDroppedItemState, IMinionState } from '../types/shared';

export interface GameContext {
  ioNamespace: any;
  chunkManager: any;
  worldName: string;
  isSkyCastlesMode: boolean;
  isHubMode: boolean;
  db: any;
  mode: any;
  
  bakedBlocks: Map<string, number>;
  npcs: any[];
  players: Record<string, IServerPlayer>;
  morvaneDead: Record<string, boolean>;
  droppedItems: Record<string, IDroppedItemState>;
  mobs: Record<string, ITickMob>;
  minions: Record<string, IMinionState>;
  
  pendingPlayerUpdates: Set<string>;
  pendingHits: any[];
  pendingMobHits: any[];
  pendingRespawns: any[];
  
  playerBuffers: Map<string, Buffer>;
  mobBuffers: Map<string, Buffer>;
  
  spatialHash: Map<number, ITickMob[]>;
  playerHash: Map<number, IServerPlayer[]>;

  state: {
    dayTime: number;
    gameState: string;
    winningTeam: string | null;
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
  broadcastToNearby: <T = any>(eventName: string, data: T, x: number, z: number, rangeSq: number, excludeId?: string | null) => void;
  spawnMob: (type: string, x: number, y: number, z: number, level?: number, team?: string) => void;
  isIndestructible: (x: number, y: number, z: number) => boolean;
  getBlockAt: (x: number, y: number, z: number) => number | undefined;
  resetRoom: () => void;
  handleMorvaneDeath: () => void;
  releaseMobToPool: (mob: ITickMob) => void;
}
