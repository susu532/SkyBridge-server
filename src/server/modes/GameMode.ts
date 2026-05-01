import { ChunkManager } from '../ChunkManager';

export interface GameModeInfo {
  name: string;
  allowPvP: boolean;
  allowMobSpawns: boolean; // natural
  allowPlayerMobSpawns: boolean; // from client, except bosses
  
  isIndestructible(x: number, y: number, z: number, bakedBlocks: Map<string, number>): boolean;
  getBlockAt(x: number, y: number, z: number, chunkManager: ChunkManager, bakedBlocks: Map<string, number>): number;
  getRespawnPosition(playerId: string, playerState?: any): {x: number, y: number, z: number};
}
