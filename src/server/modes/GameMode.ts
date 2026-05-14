import { ChunkManager } from '../ChunkManager';
import { GameContext } from '../GameContext';

export interface GameModeInfo {
  name: string;
  allowPvP: boolean;
  allowMobSpawns: boolean; // natural
  allowPlayerMobSpawns: boolean; // from client, except bosses
  
  isIndestructible(x: number, y: number, z: number, bakedBlocks: Map<string, number>, currentBlock?: number): boolean;
  getBlockAt(x: number, y: number, z: number, chunkManager: ChunkManager, bakedBlocks: Map<string, number>): number;
  getRespawnPosition(playerId: string, playerState?: any, chunkManager?: ChunkManager, bakedBlocks?: Map<string, number>): {x: number, y: number, z: number, yaw?: number};
  onInit?(server: { setBlock: (x: number, y: number, z: number, type: number) => void, spawnMob: (type: string, x: number, y: number, z: number, level?: number, team?: string) => void }): void;
  onSlowTick?(ctx: GameContext): void;
  onTick?(ctx: GameContext, delta: number, now: number): void;
  onResetRoom?(ctx: GameContext): void;
}
