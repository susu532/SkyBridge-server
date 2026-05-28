import { ItemType } from './Inventory';
import { ITEM_NAMES } from './Constants';

export enum ItemCategory {
  ALL = 'All',
  BLOCKS = 'Building',
  TOOLS = 'Tools',
  COMBAT = 'Combat',
  FOOD = 'Food',
  REDSTONE = 'Redstone',
  MISC = 'Misc',
}

export function getItemCategory(type: ItemType): ItemCategory {
  const name = ITEM_NAMES[type] || '';
  const nameUpper = name.toUpperCase();

  if (nameUpper.includes('PICKAXE') || nameUpper.includes('SHOVEL') || nameUpper.includes('AXE') || nameUpper.includes('ROD')) {
    if (!nameUpper.includes('BLOCK')) return ItemCategory.TOOLS;
  }

  if (nameUpper.includes('SWORD') || nameUpper.includes('BOW') || nameUpper.includes('ARROW')) {
    return ItemCategory.COMBAT;
  }

  if (nameUpper.includes('APPLE') || nameUpper.includes('BEEF') || nameUpper.includes('BREAD') || nameUpper.includes('WHEAT') || nameUpper.includes('STEAK') || nameUpper.includes('CAKE') || nameUpper.includes('MELON') || nameUpper.includes('PUMPKIN')) {
    return ItemCategory.FOOD;
  }

  if (nameUpper.includes('REDSTONE') || nameUpper.includes('OBSERVER') || nameUpper.includes('TARGET') || nameUpper.includes('DISPENSER') || nameUpper.includes('DROPPER') || nameUpper.includes('DETECTOR') || nameUpper.includes('HOPPER') || nameUpper.includes('LAMP')) {
    return ItemCategory.REDSTONE;
  }

  // Common block keywords
  if (
    nameUpper.includes('LOG') || 
    nameUpper.includes('PLANKS') || 
    nameUpper.includes('LEAVES') || 
    nameUpper.includes('STONE') || 
    nameUpper.includes('DIRT') || 
    nameUpper.includes('GRASS') || 
    nameUpper.includes('SAND') || 
    nameUpper.includes('GLASS') || 
    nameUpper.includes('CONCRETE') || 
    nameUpper.includes('WOOL') || 
    nameUpper.includes('TERRACOTTA') || 
    nameUpper.includes('BRICK') || 
    nameUpper.includes('BLOCK') || 
    nameUpper.includes('ORE') || 
    nameUpper.includes('SLAB') ||
    nameUpper.includes('STAIRS') ||
    nameUpper.includes('OBSIDIAN') ||
    nameUpper.includes('NETHERRACK') ||
    nameUpper.includes('QUARTZ') ||
    nameUpper.includes('ICE') ||
    nameUpper.includes('SNOW') ||
    nameUpper.includes('MUD') ||
    nameUpper.includes('PRISMARINE')
  ) {
    return ItemCategory.BLOCKS;
  }

  return ItemCategory.MISC;
}

const BLOCK = ItemType as any;

const IS_SOLID: boolean[] = new Array(600).fill(true);
IS_SOLID[BLOCK.AIR] = false;
IS_SOLID[BLOCK.WATER] = false;
IS_SOLID[BLOCK.WATER_1] = false;
IS_SOLID[BLOCK.WATER_2] = false;
IS_SOLID[BLOCK.WATER_3] = false;
IS_SOLID[BLOCK.WATER_4] = false;
IS_SOLID[BLOCK.WATER_5] = false;
IS_SOLID[BLOCK.WATER_6] = false;
IS_SOLID[BLOCK.WATER_7] = false;
IS_SOLID[BLOCK.GLASS] = true;
IS_SOLID[BLOCK.TALL_GRASS] = false;
IS_SOLID[BLOCK.FLOWER_RED] = false;
IS_SOLID[BLOCK.FLOWER_YELLOW] = false;
IS_SOLID[BLOCK.WHEAT] = false;
IS_SOLID[BLOCK.DEAD_BUSH] = false;
IS_SOLID[BLOCK.LAVA] = false;
IS_SOLID[BLOCK.MUSHROOM_RED] = false;
IS_SOLID[BLOCK.MUSHROOM_BROWN] = false;
IS_SOLID[BLOCK.SCULK_SENSOR] = false;
IS_SOLID[BLOCK.SCULK_SHRIEKER] = false;
IS_SOLID[BLOCK.GLOWSTONE] = true;
IS_SOLID[BLOCK.MOSS_CARPET] = false;
IS_SOLID[BLOCK.TORCH] = false;
IS_SOLID[BLOCK.TORCH_WALL_X_POS] = false;
IS_SOLID[BLOCK.TORCH_WALL_X_NEG] = false;
IS_SOLID[BLOCK.TORCH_WALL_Z_POS] = false;
IS_SOLID[BLOCK.TORCH_WALL_Z_NEG] = false;
IS_SOLID[BLOCK.LAUNCHER] = false;
IS_SOLID[BLOCK.LAUNCHER_WALL_X_POS] = false;
IS_SOLID[BLOCK.LAUNCHER_WALL_X_NEG] = false;
IS_SOLID[BLOCK.LAUNCHER_WALL_Z_POS] = false;
IS_SOLID[BLOCK.LAUNCHER_WALL_Z_NEG] = false;
IS_SOLID[BLOCK.AZALEA] = false;
IS_SOLID[BLOCK.FLOWERING_AZALEA] = false;
IS_SOLID[BLOCK.SPORE_BLOSSOM] = false;
IS_SOLID[BLOCK.CAVE_VINES] = false;
IS_SOLID[BLOCK.POINTED_DRIPSTONE] = false;
IS_SOLID[BLOCK.AMETHYST_CLUSTER] = false;
IS_SOLID[BLOCK.LARGE_AMETHYST_BUD] = false;
IS_SOLID[BLOCK.MEDIUM_AMETHYST_BUD] = false;
IS_SOLID[BLOCK.SMALL_AMETHYST_BUD] = false;
IS_SOLID[BLOCK.CANDLE] = false;
IS_SOLID[BLOCK.GLOW_LICHEN] = false;
IS_SOLID[BLOCK.TORCHFLOWER] = false;

export const isSolidBlock = (blockType: number) => {
  return IS_SOLID[blockType] ?? true;
};
