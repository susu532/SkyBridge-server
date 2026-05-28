import { ItemType } from '../game/Inventory';

export const CHUNK_SIZE = 16;
export const CHUNK_HEIGHT = 256; // -60 to 195 bounds
export const WORLD_Y_OFFSET = -60;

export const BLOCK = ItemType as any;

export function isWaterBlock(type: number) {
  return type === BLOCK.WATER || (type >= 19 && type <= 25);
}

export { isSolidBlock } from '../game/Categories';
