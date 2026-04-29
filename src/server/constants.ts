import { ItemType } from '../game/Inventory';

export const CHUNK_SIZE = 16;
export const CHUNK_HEIGHT = 256; // -60 to 195 bounds
export const WORLD_Y_OFFSET = -60;

export const BLOCK = ItemType as any;

export function isSolidBlock(type: number) {
  return type !== BLOCK.AIR && 
         type !== BLOCK.WATER && 
         !(type >= 19 && type <= 25) && // WATER_1 through WATER_7
         type !== BLOCK.TALL_GRASS &&
         type !== BLOCK.FLOWER_RED &&
         type !== BLOCK.FLOWER_YELLOW &&
         type !== BLOCK.WHEAT &&
         type !== BLOCK.DEAD_BUSH &&
         type !== BLOCK.LAVA &&
         type !== BLOCK.MUSHROOM_RED &&
         type !== BLOCK.MUSHROOM_BROWN &&
         type !== BLOCK.SCULK_SENSOR &&
         type !== BLOCK.SCULK_SHRIEKER &&
         type !== BLOCK.MOSS_CARPET &&
         type !== BLOCK.AZALEA &&
         type !== BLOCK.FLOWERING_AZALEA &&
         type !== BLOCK.SPORE_BLOSSOM &&
         type !== BLOCK.CAVE_VINES &&
         type !== BLOCK.POINTED_DRIPSTONE &&
         type !== BLOCK.AMETHYST_CLUSTER &&
         type !== BLOCK.LARGE_AMETHYST_BUD &&
         type !== BLOCK.MEDIUM_AMETHYST_BUD &&
         type !== BLOCK.SMALL_AMETHYST_BUD &&
         type !== BLOCK.CANDLE &&
         type !== BLOCK.GLOW_LICHEN &&
         type !== BLOCK.TORCH &&
         type !== BLOCK.TORCH_WALL_X_POS &&
         type !== BLOCK.TORCH_WALL_X_NEG &&
         type !== BLOCK.TORCH_WALL_Z_POS &&
         type !== BLOCK.TORCH_WALL_Z_NEG &&
         type !== BLOCK.TORCHFLOWER;
}
