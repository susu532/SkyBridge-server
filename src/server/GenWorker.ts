import { getBattleRoyaleBlock } from '../game/generation/BattleRoyaleGenerator';
import { generateHubTerrain } from '../game/generation/HubGenerator';
import { CHUNK_SIZE, CHUNK_HEIGHT, WORLD_Y_OFFSET } from './constants';

export default async function generateChunk(msg: { cx: number; cz: number; worldName: string; modeName: string }) {
  const { cx, cz, worldName, modeName } = msg;
  const chunkData = new Uint16Array(CHUNK_SIZE * CHUNK_HEIGHT * CHUNK_SIZE);
  chunkData.fill(65535);

  if (modeName === '/battleroyale') {
    for (let ly = 0; ly < CHUNK_HEIGHT; ly++) {
      for (let lz = 0; lz < CHUNK_SIZE; lz++) {
        for (let lx = 0; lx < CHUNK_SIZE; lx++) {
          const y = ly + WORLD_Y_OFFSET;
          const x = cx * CHUNK_SIZE + lx;
          const z = cz * CHUNK_SIZE + lz;
          const block = getBattleRoyaleBlock(x, y, z);
          if (block !== 0) {
            chunkData[lx | (lz << 4) | (ly << 8)] = block;
          }
        }
      }
    }
  } else if (modeName === '/hub') {
    const mockChunk = {
      setBlockFast: (x: number, y: number, z: number, type: number) => {
        if (y >= 0 && y < CHUNK_HEIGHT) {
          chunkData[x | (z << 4) | (y << 8)] = type;
        }
      }
    };
      
    for (let lz = 0; lz < CHUNK_SIZE; lz++) {
      for (let lx = 0; lx < CHUNK_SIZE; lx++) {
        const wx = cx * CHUNK_SIZE + lx;
        const wz = cz * CHUNK_SIZE + lz;
        generateHubTerrain(mockChunk as any, lx, lz, wx, wz);
      }
    }
  }

  return {
    cx, cz, worldName, data: chunkData.buffer
  };
}
