import { ItemMetadata, Rarity } from './SkyBridgeManager';
import { useGameStore } from '../store/gameStore';

export enum ItemType {
  AIR = 0,
  DIRT = 1,
  GRASS = 2,
  STONE = 3,
  WOOD = 4,
  LEAVES = 5,
  SAND = 6,
  WATER = 7,
  GLASS = 8,
  BLUE_STONE = 9,
  RED_STONE = 10,
  PLANKS = 11,
  BRICK = 12,
  STICK = 13,
  SNOW = 14,
  SLAB_STONE = 15,
  SLAB_BLUE_STONE = 16,
  SLAB_RED_STONE = 17,
  SLAB_WOOD = 18,
  WATER_1 = 19,
  WATER_2 = 20,
  WATER_3 = 21,
  WATER_4 = 22,
  WATER_5 = 23,
  WATER_6 = 24,
  WATER_7 = 25,
  TALL_GRASS = 26,
  FLOWER_RED = 27,
  FLOWER_YELLOW = 28,
  WHEAT = 29,
  BIRCH_LOG = 30,
  BIRCH_LEAVES = 31,
  SPRUCE_LOG = 32,
  SPRUCE_LEAVES = 33,
  CACTUS = 34,
  DEAD_BUSH = 35,
  ICE = 36,
  SANDSTONE = 37,
  MUD = 38,
  RED_SAND = 39,
  TERRACOTTA = 40,
  OBSIDIAN = 41,
  LAVA = 42,
  MUSHROOM_RED = 43,
  MUSHROOM_BROWN = 44,
  MUSHROOM_STEM = 45,
  MYCELIUM = 46,
  MUSHROOM_BLOCK_RED = 47,
  MUSHROOM_BLOCK_BROWN = 48,
  CHERRY_LOG = 49,
  CHERRY_LEAVES = 50,
  DARK_OAK_LOG = 51,
  DARK_OAK_LEAVES = 52,
  GLOWSTONE = 53,
  ASPECT_OF_THE_END = 54,
  COAL_ORE = 55,
  IRON_ORE = 56,
  GOLD_ORE = 57,
  LAPIS_ORE = 58,
  REDSTONE_ORE = 59,
  DIAMOND_ORE = 60,
  EMERALD_ORE = 61,
  CONCRETE_WHITE = 62,
  CONCRETE_ORANGE = 63,
  CONCRETE_MAGENTA = 64,
  CONCRETE_LIGHT_BLUE = 65,
  CONCRETE_YELLOW = 66,
  CONCRETE_LIME = 67,
  CONCRETE_PINK = 68,
  CONCRETE_GRAY = 69,
  CONCRETE_LIGHT_GRAY = 70,
  CONCRETE_CYAN = 71,
  CONCRETE_PURPLE = 72,
  CONCRETE_BLUE = 73,
  CONCRETE_BROWN = 74,
  CONCRETE_GREEN = 75,
  CONCRETE_RED = 76,
  CONCRETE_BLACK = 77,
  WOOL_WHITE = 78,
  WOOL_ORANGE = 79,
  WOOL_MAGENTA = 80,
  WOOL_LIGHT_BLUE = 81,
  WOOL_YELLOW = 82,
  WOOL_LIME = 83,
  WOOL_PINK = 84,
  WOOL_GRAY = 85,
  WOOL_LIGHT_GRAY = 86,
  WOOL_CYAN = 87,
  WOOL_PURPLE = 88,
  WOOL_BLUE = 89,
  WOOL_BROWN = 90,
  WOOL_GREEN = 91,
  WOOL_RED = 92,
  WOOL_BLACK = 93,
  GLASS_WHITE = 94,
  GLASS_ORANGE = 95,
  GLASS_MAGENTA = 96,
  GLASS_LIGHT_BLUE = 97,
  GLASS_YELLOW = 98,
  GLASS_LIME = 99,
  GLASS_PINK = 100,
  GLASS_GRAY = 101,
  GLASS_LIGHT_GRAY = 102,
  GLASS_CYAN = 103,
  GLASS_PURPLE = 104,
  GLASS_BLUE = 105,
  GLASS_BROWN = 106,
  GLASS_GREEN = 107,
  GLASS_RED = 108,
  GLASS_BLACK = 109,
  GRANITE = 110,
  POLISHED_GRANITE = 111,
  DIORITE = 112,
  POLISHED_DIORITE = 113,
  ANDESITE = 114,
  POLISHED_ANDESITE = 115,
  DEEPSLATE = 116,
  COBBLED_DEEPSLATE = 117,
  NETHERRACK = 118,
  SOUL_SAND = 119,
  SOUL_SOIL = 120,
  MAGMA_BLOCK = 121,
  BONE_BLOCK = 122,
  QUARTZ_BLOCK = 123,
  NETHER_BRICKS = 124,
  RED_NETHER_BRICKS = 125,
  BOOKSHELF = 126,
  CRAFTING_TABLE = 127,
  FURNACE = 128,
  JUKEBOX = 129,
  MELON = 130,
  PUMPKIN = 131,
  JACK_O_LANTERN = 132,
  HAY_BALE = 133,
  SPONGE = 134,
  WET_SPONGE = 135,
  SLIME_BLOCK = 136,
  HONEY_BLOCK = 137,
  SEA_LANTERN = 138,
  PRISMARINE = 139,
  PRISMARINE_BRICKS = 140,
  DARK_PRISMARINE = 141,
  TERRACOTTA_WHITE = 142,
  TERRACOTTA_ORANGE = 143,
  TERRACOTTA_MAGENTA = 144,
  TERRACOTTA_LIGHT_BLUE = 145,
  TERRACOTTA_YELLOW = 146,
  TERRACOTTA_LIME = 147,
  TERRACOTTA_PINK = 148,
  TERRACOTTA_GRAY = 149,
  TERRACOTTA_LIGHT_GRAY = 150,
  TERRACOTTA_CYAN = 151,
  TERRACOTTA_PURPLE = 152,
  TERRACOTTA_BLUE = 153,
  TERRACOTTA_BROWN = 154,
  TERRACOTTA_GREEN = 155,
  TERRACOTTA_RED = 156,
  TERRACOTTA_BLACK = 157,
  ACACIA_LOG = 158,
  ACACIA_PLANKS = 159,
  ACACIA_LEAVES = 160,
  JUNGLE_LOG = 161,
  JUNGLE_PLANKS = 162,
  JUNGLE_LEAVES = 163,
  CALCITE = 164,
  TUFF = 165,
  DRIPSTONE_BLOCK = 166,
  BASALT = 167,
  POLISHED_BASALT = 168,
  BLACKSTONE = 169,
  POLISHED_BLACKSTONE = 170,
  END_STONE = 171,
  PURPUR_BLOCK = 172,
  MANGROVE_LOG = 173,
  MANGROVE_PLANKS = 174,
  MANGROVE_LEAVES = 175,
  CRIMSON_STEM = 176,
  CRIMSON_PLANKS = 177,
  NETHER_WART_BLOCK = 178,
  WARPED_STEM = 179,
  WARPED_PLANKS = 180,
  WARPED_WART_BLOCK = 181,
  COBBLESTONE = 182,
  MOSSY_COBBLESTONE = 183,
  SMOOTH_STONE = 184,
  STONE_BRICKS = 185,
  MOSSY_STONE_BRICKS = 186,
  CRACKED_STONE_BRICKS = 187,
  CHISELED_STONE_BRICKS = 188,
  IRON_BLOCK = 189,
  GOLD_BLOCK = 190,
  DIAMOND_BLOCK = 191,
  EMERALD_BLOCK = 192,
  LAPIS_BLOCK = 193,
  REDSTONE_BLOCK = 194,
  COAL_BLOCK = 195,
  COPPER_BLOCK = 196,
  EXPOSED_COPPER = 197,
  WEATHERED_COPPER = 198,
  OXIDIZED_COPPER = 199,
  RAW_IRON_BLOCK = 200,
  RAW_GOLD_BLOCK = 201,
  RAW_COPPER_BLOCK = 202,
  AMETHYST_BLOCK = 203,
  BEACON = 204,
  LODESTONE = 205,
  CRYING_OBSIDIAN = 206,
  GILDED_BLACKSTONE = 207,
  DIRT_PATH = 208,
  NOTE_BLOCK = 209,
  OBSERVER = 210,
  TARGET = 211,
  DISPENSER = 212,
  DROPPER = 213,
  BRICKS = 214,
  NETHER_QUARTZ_ORE = 215,
  ANCIENT_DEBRIS = 216,
  SPRUCE_PLANKS = 217,
  BIRCH_PLANKS = 218,
  DARK_OAK_PLANKS = 219,
  CHERRY_PLANKS = 220,
  BAMBOO_BLOCK = 221,
  BAMBOO_PLANKS = 222,
  BAMBOO_MOSAIC = 223,
  CHISELED_SANDSTONE = 224,
  SMOOTH_SANDSTONE = 225,
  CUT_SANDSTONE = 226,
  RED_SANDSTONE = 227,
  CHISELED_RED_SANDSTONE = 228,
  SMOOTH_RED_SANDSTONE = 229,
  CUT_RED_SANDSTONE = 230,
  CHISELED_QUARTZ_BLOCK = 231,
  QUARTZ_PILLAR = 232,
  SMOOTH_QUARTZ = 233,
  QUARTZ_BRICKS = 234,
  CONCRETE_POWDER_WHITE = 235,
  CONCRETE_POWDER_ORANGE = 236,
  CONCRETE_POWDER_MAGENTA = 237,
  CONCRETE_POWDER_LIGHT_BLUE = 238,
  CONCRETE_POWDER_YELLOW = 239,
  CONCRETE_POWDER_LIME = 240,
  CONCRETE_POWDER_PINK = 241,
  CONCRETE_POWDER_GRAY = 242,
  CONCRETE_POWDER_LIGHT_GRAY = 243,
  CONCRETE_POWDER_CYAN = 244,
  CONCRETE_POWDER_PURPLE = 245,
  CONCRETE_POWDER_BLUE = 246,
  CONCRETE_POWDER_BROWN = 247,
  CONCRETE_POWDER_GREEN = 248,
  CONCRETE_POWDER_RED = 249,
  CONCRETE_POWDER_BLACK = 250,
  POLISHED_DEEPSLATE = 251,
  DEEPSLATE_BRICKS = 252,
  CRACKED_DEEPSLATE_BRICKS = 253,
  DEEPSLATE_TILES = 254,
  CRACKED_DEEPSLATE_TILES = 255,
  CHISELED_DEEPSLATE = 256,
  POLISHED_BLACKSTONE_BRICKS = 257,
  CRACKED_POLISHED_BLACKSTONE_BRICKS = 258,
  CHISELED_POLISHED_BLACKSTONE = 259,
  MUD_BRICKS = 260,
  PACKED_MUD = 261,
  SCULK = 262,
  SCULK_CATALYST = 263,
  SCULK_SHRIEKER = 264,
  SCULK_SENSOR = 265,
  OCHRE_FROGLIGHT = 266,
  VERDANT_FROGLIGHT = 267,
  PEARLESCENT_FROGLIGHT = 268,
  REINFORCED_DEEPSLATE = 269,
  TUBE_CORAL_BLOCK = 270,
  BRAIN_CORAL_BLOCK = 271,
  BUBBLE_CORAL_BLOCK = 272,
  FIRE_CORAL_BLOCK = 273,
  HORN_CORAL_BLOCK = 274,
  DEAD_TUBE_CORAL_BLOCK = 275,
  DEAD_BRAIN_CORAL_BLOCK = 276,
  DEAD_BUBBLE_CORAL_BLOCK = 277,
  DEAD_FIRE_CORAL_BLOCK = 278,
  DEAD_HORN_CORAL_BLOCK = 279,
  MOSS_BLOCK = 280,
  MOSS_CARPET = 281,
  AZALEA = 282,
  FLOWERING_AZALEA = 283,
  SPORE_BLOSSOM = 284,
  CAVE_VINES = 285,
  POINTED_DRIPSTONE = 286,
  COPPER_ORE = 287,
  DEEPSLATE_COPPER_ORE = 288,
  AMETHYST_CLUSTER = 289,
  LARGE_AMETHYST_BUD = 290,
  MEDIUM_AMETHYST_BUD = 291,
  SMALL_AMETHYST_BUD = 292,
  TINTED_GLASS = 293,
  LIGHTNING_ROD = 294,
  CANDLE = 295,
  POTTED_AZALEA = 296,
  TORCH = 297,
  LILY_PAD = 300,
  VINE = 301,
  GLOW_LICHEN = 302,
  SUGAR_CANE = 303,
  KELP = 304,
  SEAGRASS = 305,
  SEA_PICKLE = 306,
  SHROOMLIGHT = 307,
  CRIMSON_NYLIUM = 308,
  WARPED_NYLIUM = 309,
  CRIMSON_FUNGUS = 310,
  WARPED_FUNGUS = 311,
  WARPED_ROOTS = 312,
  CRIMSON_ROOTS = 313,
  NETHER_SPROUTS = 314,
  WEEPING_VINES = 315,
  TWISTING_VINES = 316,
  IRON_BARS = 317,
  CHAIN = 318,
  LANTERN = 319,
  SOUL_LANTERN = 320,
  CAMPFIRE = 321,
  SOUL_CAMPFIRE = 322,
  REDSTONE_LAMP = 323,
  SMOOTH_BASALT = 324,
  COBWEB = 325,
  FARMLAND = 326,
  PODZOL = 327,
  DAYLIGHT_DETECTOR = 328,
  HOPPER = 329,
  CAULDRON = 330,
  ANVIL = 331,
  GRINDSTONE = 332,
  SMITHING_TABLE = 333,
  FLETCHING_TABLE = 334,
  CARTOGRAPHY_TABLE = 335,
  LOOM = 336,
  BARREL = 337,
  SMOKER = 338,
  BLAST_FURNACE = 339,
  COMPOSTER = 340,
  STONECUTTER = 341,
  BELL = 342,
  BEEHIVE = 343,
  BEE_NEST = 344,
  HONEYCOMB_BLOCK = 345,
  RESPAWN_ANCHOR = 346,
  CANDLE_CAKE = 347,
  COARSE_DIRT = 348,
  ROOTED_DIRT = 349,
  MUDDY_MANGROVE_ROOTS = 350,
  CHORUS_PLANT = 351,
  CHORUS_FLOWER = 352,
  TURTLE_EGG = 353,
  SNIFFER_EGG = 354,
  PITCHER_PLANT = 355,
  TORCHFLOWER = 356,
  SWEET_BERRY_BUSH = 357,
  END_PORTAL_FRAME = 358,
  END_PORTAL = 359,
  NETHER_PORTAL = 360,
  ENDER_CHEST = 361,
  ENCHANTING_TABLE = 362,
  CHISELED_BOOKSHELF = 363,
  COMMAND_BLOCK = 364,
  REPEATING_COMMAND_BLOCK = 365,
  CHAIN_COMMAND_BLOCK = 366,
  STRUCTURE_BLOCK = 367,
  BARRIER = 368,
  LIGHT_BLOCK = 369,
  SPAWNER = 370,
  DRAGON_EGG = 371,
  DEEPSLATE_COAL_ORE = 372,
  DEEPSLATE_IRON_ORE = 373,
  DEEPSLATE_GOLD_ORE = 374,
  DEEPSLATE_REDSTONE_ORE = 375,
  DEEPSLATE_EMERALD_ORE = 376,
  DEEPSLATE_LAPIS_ORE = 377,
  DEEPSLATE_DIAMOND_ORE = 378,
  NETHER_GOLD_ORE = 379,
  BLOCK_OF_NETHERITE = 380,
  STRIPPED_OAK_LOG = 381,
  STRIPPED_SPRUCE_LOG = 382,
  STRIPPED_BIRCH_LOG = 383,
  STRIPPED_JUNGLE_LOG = 384,
  STRIPPED_ACACIA_LOG = 385,
  STRIPPED_DARK_OAK_LOG = 386,
  STRIPPED_MANGROVE_LOG = 387,
  STRIPPED_CHERRY_LOG = 388,
  OAK_WOOD = 389,
  SPRUCE_WOOD = 390,
  BIRCH_WOOD = 391,
  JUNGLE_WOOD = 392,
  ACACIA_WOOD = 393,
  DARK_OAK_WOOD = 394,
  MANGROVE_WOOD = 395,
  CHERRY_WOOD = 396,
  END_STONE_BRICKS = 397,
  PURPUR_PILLAR = 398,
  PACKED_ICE = 399,
  BLUE_ICE = 400,
  SHULKER_BOX_WHITE = 401,
  SHULKER_BOX_ORANGE = 402,
  SHULKER_BOX_MAGENTA = 403,
  SHULKER_BOX_LIGHT_BLUE = 404,
  SHULKER_BOX_YELLOW = 405,
  SHULKER_BOX_LIME = 406,
  SHULKER_BOX_PINK = 407,
  SHULKER_BOX_GRAY = 408,
  SHULKER_BOX_LIGHT_GRAY = 409,
  SHULKER_BOX_CYAN = 410,
  SHULKER_BOX_PURPLE = 411,
  SHULKER_BOX_BLUE = 412,
  SHULKER_BOX_BROWN = 413,
  SHULKER_BOX_GREEN = 414,
  SHULKER_BOX_RED = 415,
  SHULKER_BOX_BLACK = 416,
  GLAZED_TERRACOTTA_WHITE = 417,
  GLAZED_TERRACOTTA_ORANGE = 418,
  GLAZED_TERRACOTTA_MAGENTA = 419,
  GLAZED_TERRACOTTA_LIGHT_BLUE = 420,
  GLAZED_TERRACOTTA_YELLOW = 421,
  GLAZED_TERRACOTTA_LIME = 422,
  GLAZED_TERRACOTTA_PINK = 423,
  GLAZED_TERRACOTTA_GRAY = 424,
  GLAZED_TERRACOTTA_LIGHT_GRAY = 425,
  GLAZED_TERRACOTTA_CYAN = 426,
  GLAZED_TERRACOTTA_PURPLE = 427,
  GLAZED_TERRACOTTA_BLUE = 428,
  GLAZED_TERRACOTTA_BROWN = 429,
  GLAZED_TERRACOTTA_GREEN = 430,
  GLAZED_TERRACOTTA_RED = 431,
  GLAZED_TERRACOTTA_BLACK = 432,
  HAY_BLOCK = 433,
  DRIED_KELP_BLOCK = 434,
  SPONGEY_HONEY = 435,
  WOODEN_PICKAXE = 436,
  STONE_PICKAXE = 437,
  IRON_PICKAXE = 438,
  GOLDEN_PICKAXE = 439,
  DIAMOND_PICKAXE = 440,
  WOODEN_SWORD = 441,
  STONE_SWORD = 442,
  IRON_SWORD = 443,
  GOLDEN_SWORD = 444,
  DIAMOND_SWORD = 445,
  WOODEN_SHOVEL = 446,
  STONE_SHOVEL = 447,
  IRON_SHOVEL = 448,
  GOLDEN_SHOVEL = 449,
  DIAMOND_SHOVEL = 450,
  WOODEN_AXE = 451,
  STONE_AXE = 452,
  IRON_AXE = 453,
  GOLDEN_AXE = 454,
  DIAMOND_AXE = 455,
  APPLE = 456,
  GOLDEN_APPLE = 457,
  COOKED_BEEF = 458,
  RAW_BEEF = 459,
  FISHING_ROD = 460,
  BOW = 461,
  ARROW = 462,
  BUCKET = 463,
  WATER_BUCKET = 464,
  LAVA_BUCKET = 465,
  ENDER_PEARL = 466,
  BONE = 467,
  GUNPOWDER = 468,
  STRING = 469,
  FEATHER = 470,
  BREAD = 471,
  SEEDS = 472,
  SKYCOIN = 501,
  IRON_INGOT = 502,
  GOLD_INGOT = 503,
  DIAMOND = 504,
  COAL = 505,
  EMERALD = 506,
  REDSTONE = 507,
  LAPIS_LAZULI = 508,
  COPPER_INGOT = 509,
  TORCH_WALL_X_POS = 510,
  TORCH_WALL_X_NEG = 511,
  TORCH_WALL_Z_POS = 512,
  TORCH_WALL_Z_NEG = 513,
  MINION = 500,
};

export interface ItemStack {
  type: ItemType;
  count: number;
  metadata?: ItemMetadata;
}

export interface Recipe {
  input: (ItemType | null)[]; // 2x2 or 3x3 grid
  output: ItemStack;
  is3x3: boolean;
  shapeless?: boolean;
}

import recipesData from '../../data/recipes.json';

export const RECIPES: Recipe[] = recipesData.map((r: any) => ({
  input: r.input.map((typeStr: string | null) => typeStr ? (ItemType as any)[typeStr] ?? null : null),
  output: {
    ...r.output,
    type: (ItemType as any)[r.output.type] ?? r.output.type
  },
  is3x3: r.is3x3,
  shapeless: r.shapeless
}));

export function checkRecipe(grid: (ItemType | null)[], is3x3: boolean): ItemStack | null {
  const size = is3x3 ? 3 : 2;
  
  // Shapeless check first
  const gridCounts = new Map<ItemType, number>();
  let gridTotal = 0;
  for (const item of grid) {
    if (item !== null) {
      gridCounts.set(item, (gridCounts.get(item) || 0) + 1);
      gridTotal++;
    }
  }

  for (const recipe of RECIPES) {
    if (recipe.is3x3 && !is3x3) continue;

    if (recipe.shapeless) {
      const recipeCounts = new Map<ItemType, number>();
      let recipeTotal = 0;
      for (const item of recipe.input) {
        if (item !== null) {
          recipeCounts.set(item, (recipeCounts.get(item) || 0) + 1);
          recipeTotal++;
        }
      }

      if (gridTotal !== recipeTotal) continue;

      let match = true;
      for (const [type, count] of recipeCounts.entries()) {
        if (gridCounts.get(type) !== count) {
          match = false;
          break;
        }
      }
      if (match) return recipe.output;
      continue;
    }

    // Shaped logic
    // Find the bounding box of the items in the grid
    let minX = size, minY = size, maxX = -1, maxY = -1;
    let itemCount = 0;

    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        if (grid[y * size + x] !== null) {
          minX = Math.min(minX, x);
          minY = Math.min(minY, y);
          maxX = Math.max(maxX, x);
          maxY = Math.max(maxY, y);
          itemCount++;
        }
      }
    }

    if (itemCount === 0) continue;

    const width = maxX - minX + 1;
    const height = maxY - minY + 1;
    
    // Extract the normalized pattern
    const pattern: (ItemType | null)[] = [];
    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        pattern.push(grid[y * size + x]);
      }
    }
    
    // Check if dimensions match
    const rSize = Math.sqrt(recipe.input.length);
    let rMinX = rSize, rMinY = rSize, rMaxX = -1, rMaxY = -1;
    let rItemCount = 0;

    for (let y = 0; y < rSize; y++) {
      for (let x = 0; x < rSize; x++) {
        if (recipe.input[y * rSize + x] !== null) {
          rMinX = Math.min(rMinX, x);
          rMinY = Math.min(rMinY, y);
          rMaxX = Math.max(rMaxX, x);
          rMaxY = Math.max(rMaxY, y);
          rItemCount++;
        }
      }
    }

    if (itemCount !== rItemCount) continue;

    const rWidth = rMaxX - rMinX + 1;
    const rHeight = rMaxY - rMinY + 1;

    if (width !== rWidth || height !== rHeight) continue;

    // Compare normalized patterns
    let match = true;
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const gridType = pattern[y * width + x];
        const recipeType = recipe.input[(rMinY + y) * rSize + (rMinX + x)];
        if (gridType !== recipeType) {
          match = false;
          break;
        }
      }
      if (!match) break;
    }

    if (match) return recipe.output;
  }
  return null;
}

export function getDefaultMetadata(type: ItemType): ItemMetadata | undefined {
  // Find a recipe that produces this item type and has metadata
  const recipe = RECIPES.find(r => r.output.type === type && r.output.metadata);
  if (recipe) return JSON.parse(JSON.stringify(recipe.output.metadata));

  // Hardcoded defaults for special items if not in recipes
  if (type === ItemType.ASPECT_OF_THE_END) {
    return {
      rarity: Rarity.RARE,
      stats: { damage: 80, strength: 60 },
      description: "Teleport 8 blocks ahead of you and gain +50 Speed for 3 seconds.",
      ability: {
        name: "Instant Transmission",
        description: "Teleport 8 blocks ahead of you and gain +50 Speed for 3 seconds.",
        manaCost: 50
      }
    };
  }

  return undefined;
}

export function getMaxStack(type: ItemType): number {
  if (type === ItemType.SKYCOIN) return 999999999;
  const unstackable = [
    ItemType.WOODEN_PICKAXE, ItemType.STONE_PICKAXE, ItemType.IRON_PICKAXE, ItemType.GOLDEN_PICKAXE, ItemType.DIAMOND_PICKAXE,
    ItemType.WOODEN_SWORD, ItemType.STONE_SWORD, ItemType.IRON_SWORD, ItemType.GOLDEN_SWORD, ItemType.DIAMOND_SWORD,
    ItemType.WOODEN_SHOVEL, ItemType.STONE_SHOVEL, ItemType.IRON_SHOVEL, ItemType.GOLDEN_SHOVEL, ItemType.DIAMOND_SHOVEL,
    ItemType.WOODEN_AXE, ItemType.STONE_AXE, ItemType.IRON_AXE, ItemType.GOLDEN_AXE, ItemType.DIAMOND_AXE,
    ItemType.ASPECT_OF_THE_END, ItemType.MINION, ItemType.BOW, ItemType.FISHING_ROD, ItemType.BUCKET, ItemType.WATER_BUCKET, ItemType.LAVA_BUCKET
  ];
  return unstackable.includes(type) ? 1 : 64;
}

export class Inventory {
  static OFF_HAND_SLOT = 36;
  slots: (ItemStack | null)[] = new Array(37).fill(null);
  hotbarSize = 9;

  damageItem(slotIndex: number, amount: number = 1): boolean {
    const item = this.slots[slotIndex];
    if (!item || !item.metadata || item.metadata.durability === undefined) return false;
    
    const newDurability = item.metadata.durability - amount;
    if (newDurability <= 0) {
       this.slots[slotIndex] = null;
       useGameStore.getState().incrementInventoryVersion();
       return true; // Item broke
    }
    
    this.slots[slotIndex] = {
      ...item,
      metadata: {
        ...item.metadata,
        durability: newDurability
      }
    };
    useGameStore.getState().incrementInventoryVersion();
    return false; // Did not break
  }

  constructor() {
    // Start with some basic items for testing
    this.addItem(ItemType.WOOD, 4);
    this.addItem(ItemType.STONE, 8);
    this.addItem(ItemType.TORCH, 64);
    
    // Add some SkyBridge items
    this.addItem(ItemType.ASPECT_OF_THE_END, 1, {
      rarity: Rarity.RARE,
      stats: { damage: 80, strength: 60 },
      description: "Teleport 8 blocks ahead of you and gain +50 Speed for 3 seconds.",
      ability: {
        name: "Instant Transmission",
        description: "Teleport 8 blocks ahead of you and gain +50 Speed for 3 seconds.",
        manaCost: 50
      }
    });

    this.addItem(ItemType.BLUE_STONE, 1, {
      rarity: Rarity.RARE,
      stats: { strength: 10, critChance: 5, miningFortune: 150, miningSpeed: 100 },
      description: "A powerful stone from the deep caverns.",
      ability: {
        name: "Deep Strike",
        description: "Dash forward with extreme speed.",
        manaCost: 40
      }
    });

    this.addItem(ItemType.RED_STONE, 1, {
      rarity: Rarity.LEGENDARY,
      stats: { health: 50, defense: 20 },
      description: "Infused with the essence of a dragon.",
      ability: {
        name: "Dragon's Breath",
        description: "Creates a blast of fire around the player.",
        manaCost: 100,
        cooldown: 10
      }
    });

    this.addItem(ItemType.MINION, 1, {
      rarity: Rarity.RARE,
      description: "Places a minion that generates cobblestone.",
      ability: {
        name: "Automate",
        description: "Generates 1 cobblestone every 10 seconds."
      }
    });
  }

  clear() {
    this.slots = new Array(37).fill(null);
    useGameStore.getState().incrementInventoryVersion();
  }

  addItem(type: ItemType, count: number, metadata?: ItemMetadata): number {
    if (type === ItemType.SKYCOIN) {
      useGameStore.getState().addSkycoins(count);
      return 0;
    }

    let remaining = count;
    const maxStack = getMaxStack(type);
    
    // Auto-apply default metadata if missing
    const finalMetadata = metadata || getDefaultMetadata(type);
    
    // Try to stack
    for (let i = 0; i < this.slots.length; i++) {
      const slot = this.slots[i];
      if (slot && slot.type === type && slot.count < maxStack) {
        // Check if metadata matches
        const metadataMatch = (!slot.metadata && !finalMetadata) || 
                             (JSON.stringify(slot.metadata) === JSON.stringify(finalMetadata));
        
        if (metadataMatch) {
          const canAdd = Math.min(remaining, maxStack - slot.count);
          if (canAdd > 0) {
            this.slots[i] = { ...slot, count: slot.count + canAdd };
            remaining -= canAdd;
            useGameStore.getState().incrementInventoryVersion();
          }
        }
      }
      if (remaining <= 0) return 0;
    }

    // Try empty slots
    for (let i = 0; i < this.slots.length; i++) {
      if (!this.slots[i]) {
        const countToAdd = Math.min(remaining, maxStack);
        this.slots[i] = { type, count: countToAdd, metadata: finalMetadata };
        remaining -= countToAdd;
        useGameStore.getState().incrementInventoryVersion();
      }
      if (remaining <= 0) return 0;
    }

    if (remaining < count) {
      useGameStore.getState().incrementInventoryVersion();
    }
    return remaining;
  }

  removeItem(type: ItemType, count: number): boolean {
    if (type === ItemType.SKYCOIN) {
      const current = useGameStore.getState().skycoins;
      if (current < count) return false;
      useGameStore.getState().setSkycoins(current - count);
      return true;
    }

    // Check if we have enough
    let total = 0;
    for (const slot of this.slots) {
      if (slot && slot.type === type) total += slot.count;
    }
    if (total < count) return false;

    let toRemove = count;
    for (let i = this.slots.length - 1; i >= 0; i--) {
      const slot = this.slots[i];
      if (slot && slot.type === type) {
        const canRemove = Math.min(toRemove, slot.count);
        const newCount = slot.count - canRemove;
        this.slots[i] = newCount > 0 ? { ...slot, count: newCount } : null;
        toRemove -= canRemove;
      }
      if (toRemove <= 0) break;
    }
    useGameStore.getState().incrementInventoryVersion();
    return true;
  }

  removeItemFromSlot(index: number, count: number): boolean {
    const slot = this.slots[index];
    if (!slot || slot.count < count) return false;
    const newCount = slot.count - count;
    this.slots[index] = newCount > 0 ? { ...slot, count: newCount } : null;
    useGameStore.getState().incrementInventoryVersion();
    return true;
  }

  getStackInSlot(index: number): ItemStack | null {
    return this.slots[index];
  }
}
