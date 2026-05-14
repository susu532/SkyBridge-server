import { ItemType } from './Inventory';
import colorsData from '../../data/colors.json';
import namesData from '../../data/names.json';

export enum MobTypes {
  ZOMBIE = "Zombie",
  CREEPER = "Creeper",
  SKELETON = "Skeleton",
  SLIME = "Slime",
  MORVANE = "Morvane",
  CHICKEN = "Chicken",
  COW = "Cow",
  PIG = "Pig",
  SHEEP = "Sheep",
}

export const ITEM_COLORS: Partial<Record<ItemType, string>> = {};
for (const [key, value] of Object.entries(colorsData)) {
  const itemType = (ItemType as any)[key];
  if (itemType !== undefined) {
    ITEM_COLORS[itemType as ItemType] = value as string;
  }
}

export const ITEM_NAMES: Partial<Record<ItemType, string>> = {};
for (const [key, value] of Object.entries(namesData)) {
  const itemType = (ItemType as any)[key];
  if (itemType !== undefined) {
    ITEM_NAMES[itemType as ItemType] = value as string;
  }
}