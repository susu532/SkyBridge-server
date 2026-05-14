import { GameModeInfo } from "./modes/GameMode";
import { ChunkManager } from "./ChunkManager";
import { IPlayerUpdate, IMobState, IDroppedItemState, IMinionState } from "../types/shared";

export class GameServerContext {
  ioNamespace: any;
  chunkManager: ChunkManager;
  worldName: string;
  isSkyCastlesMode: boolean;
  isHubMode: boolean;

  npcs: any[] = [];
  players: Record<string, IPlayerUpdate & { 
    lastPos?: {x:number, y:number, z:number}, 
    yaw?: number, 
    lastRespawnTime?: number,
    disconnectTimeout?: NodeJS.Timeout,
    skills?: any,
    inventory?: Record<number, any>,
    hotbar?: (any | null)[],
    maxHealth?: number,
    kills?: number,
    deaths?: number,
    stats?: any
  }> = {};
  morvaneDead: Record<string, boolean> = { red: false, blue: false };
  droppedItems: Record<string, IDroppedItemState> = {};
  mobs: Record<string, IMobState & { vx?: number, vy?: number, vz?: number, isBoss?: boolean, lastTargetUpdate?: number, targetId?: string, lastAttack?: number, currentCell?: number }> = {};
  minions: Record<string, IMinionState & { ownerId?: string, team?: string, targetId?: string, lastAttack?: number, vx?: number, vy?: number, vz?: number }> = {};
  
  pendingPlayerUpdates: Set<string> = new Set();
  pendingHits: any[] = [];
  pendingMobHits: any[] = [];
  pendingRespawns: any[] = [];
  
  playerBuffers: Map<string, Buffer> = new Map();
  mobBuffers: Map<string, Buffer> = new Map();

  spatialHash: Map<number, any[]> = new Map();
  playerHash: Map<number, any[]> = new Map();

  tick10sCount: number = 0;
  dayTime: number = 0;
  dayCycleSpeed: number = 0.0008;

  gameState: string = "playing";
  winningTeam: string | null = null;
  resetCountdown: number | null = null;
  emptyRoomSince: number | null = null;
  hasSetEndgameMessage: boolean = false;
  hasBeenReset: boolean = false;
  gameStartTime: number = Date.now();
  lastOvertimeDamageTick: number = 0;
  lastSkyCastlesSyncJSON: string = "";

  intervals: NodeJS.Timeout[] = [];
  spawnInterval: number = 1000;
  spawnTimeout: NodeJS.Timeout | null = null;
  isDestroyed: boolean = false;

  CELL_SIZE: number = 16;
  PLAYER_CELL_SIZE: number = 25;

  constructor(
    public io: any,
    public db: any,
    public mode: GameModeInfo,
    public namespacePrefix: string,
    public bakedBlocks: Map<string, number>
  ) {
    this.ioNamespace = io.of(mode.name);
    this.worldName = namespacePrefix.replace("/", "");
    this.isSkyCastlesMode = mode.name.startsWith("/skycastles");
    this.isHubMode = mode.name.startsWith("/hub");
    this.chunkManager = new ChunkManager(this.worldName, db);
  }

  getCellKey(cx: number, cz: number) {
    return (cx & 0x7fff) | ((cz & 0x7fff) << 15);
  }
}

