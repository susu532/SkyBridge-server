
import { audioManager } from './AudioManager';
import { useGameStore } from '../store/gameStore';

export enum Rarity {
  COMMON = 'COMMON',
  UNCOMMON = 'UNCOMMON',
  RARE = 'RARE',
  EPIC = 'EPIC',
  LEGENDARY = 'LEGENDARY',
  MYTHIC = 'MYTHIC',
  DIVINE = 'DIVINE',
  SPECIAL = 'SPECIAL',
  VERY_SPECIAL = 'VERY_SPECIAL',
}

export const RARITY_COLORS: Record<Rarity, string> = {
  [Rarity.COMMON]: '#FFFFFF',
  [Rarity.UNCOMMON]: '#55FF55',
  [Rarity.RARE]: '#5555FF',
  [Rarity.EPIC]: '#AA00AA',
  [Rarity.LEGENDARY]: '#FFAA00',
  [Rarity.MYTHIC]: '#FF55FF',
  [Rarity.DIVINE]: '#55FFFF',
  [Rarity.SPECIAL]: '#FF5555',
  [Rarity.VERY_SPECIAL]: '#FF5555',
};

export interface PlayerStats {
  health: number;
  maxHealth: number;
  defense: number;
  strength: number;
  speed: number;
  critChance: number;
  critDamage: number;
  intelligence: number;
  maxIntelligence: number;
  miningSpeed: number;
  miningFortune: number;
  damage?: number;
}

export interface SkillProgress {
  level: number;
  xp: number;
  nextLevelXp: number;
}

export enum SkillType {
  COMBAT = 'Combat',
  MINING = 'Mining',
  FORAGING = 'Foraging',
  FARMING = 'Farming',
  FISHING = 'Fishing',
  ENCHANTING = 'Enchanting',
  ALCHEMY = 'Alchemy',
}

export interface ItemMetadata {
  rarity: Rarity;
  stats?: Partial<PlayerStats>;
  description?: string;
  ability?: {
    name: string;
    description: string;
    manaCost?: number;
    cooldown?: number;
  };
  durability?: number;
  maxDurability?: number;
}

class SkyBridgeManager {
  stats: PlayerStats = {
    health: 100,
    maxHealth: 100,
    defense: 0,
    strength: 0,
    speed: 100,
    critChance: 30,
    critDamage: 50,
    intelligence: 100,
    maxIntelligence: 100,
    miningSpeed: 0,
    miningFortune: 0,
    damage: 0,
  };

  skills: Record<SkillType, SkillProgress> = {
    [SkillType.COMBAT]: { level: 0, xp: 0, nextLevelXp: 100 },
    [SkillType.MINING]: { level: 0, xp: 0, nextLevelXp: 100 },
    [SkillType.FORAGING]: { level: 0, xp: 0, nextLevelXp: 100 },
    [SkillType.FARMING]: { level: 0, xp: 0, nextLevelXp: 100 },
    [SkillType.FISHING]: { level: 0, xp: 0, nextLevelXp: 100 },
    [SkillType.ENCHANTING]: { level: 0, xp: 0, nextLevelXp: 100 },
    [SkillType.ALCHEMY]: { level: 0, xp: 0, nextLevelXp: 100 },
  };

  onSkillChange?: (skill: SkillType, progress: SkillProgress) => void;

  resetHandlers() {
    this.onSkillChange = undefined;
  }

  effectiveStats: PlayerStats = { ...this.stats };

  setSkills(skills: Record<SkillType, SkillProgress>) {
    this.skills = skills;
    // Recalculate stats based on all levels
    this.stats.defense = 0;
    this.stats.strength = 0;
    this.stats.critChance = 30;
    this.stats.maxHealth = 100;
    this.stats.health = Math.min(this.stats.health, this.stats.maxHealth);
    this.stats.miningSpeed = 0;

    for (const skill in this.skills) {
      const progress = this.skills[skill as SkillType];
      for (let i = 1; i <= progress.level; i++) {
        this.applyLevelStats(skill as SkillType, i, false);
      }
    }
    useGameStore.getState().setPlayerSkills({ ...this.skills });
  }

  addXp(skill: SkillType, amount: number) {
    const progress = this.skills[skill];
    progress.xp += amount;
    
    // Dispatch event for UI popup
    useGameStore.getState().addXpPopup(skill, amount);

    if (this.onSkillChange) this.onSkillChange(skill, progress);

    while (progress.xp >= progress.nextLevelXp) {
      progress.xp -= progress.nextLevelXp;
      progress.level++;
      progress.nextLevelXp = Math.floor(progress.nextLevelXp * 1.5);
      // Level up logic (e.g. increase stats)
      this.onLevelUp(skill, progress.level);
      if (this.onSkillChange) this.onSkillChange(skill, progress);
    }
    useGameStore.getState().setPlayerSkills({ ...this.skills });
  }

  private onLevelUp(skill: SkillType, level: number) {
    console.log(`Leveled up ${skill} to ${level}!`);
    audioManager.play('level_up', 0.8, 1.0);
    
    // Dispatch event for UI celebration
    useGameStore.getState().addLevelUpPopup(skill, level);

    this.applyLevelStats(skill, level, true);
  }

  private applyLevelStats(skill: SkillType, level: number, announce: boolean) {
    switch (skill) {
      case SkillType.MINING:
        this.stats.defense += 2;
        this.stats.miningSpeed += 10;
        break;
      case SkillType.COMBAT:
        this.stats.strength += 1;
        this.stats.critChance += 0.5;
        break;
      case SkillType.FORAGING:
        this.stats.strength += 2;
        break;
      case SkillType.FARMING:
        this.stats.maxHealth += 4;
        this.stats.health += 4;
        break;
    }
  }

  getEffectiveStats(inventory: any, hotbarIndex: number): PlayerStats {
    const effectiveStats = { ...this.stats };
    
    // Add stats from held item
    const heldItem = inventory.slots[hotbarIndex];
    if (heldItem?.metadata?.stats) {
      for (const [stat, value] of Object.entries(heldItem.metadata.stats)) {
        if (stat in effectiveStats) {
          (effectiveStats as any)[stat] += value;
        }
      }
    }

    return effectiveStats;
  }

  useMana(amount: number): boolean {
    if (this.stats.intelligence >= amount) {
      this.stats.intelligence -= amount;
      return true;
    }
    return false;
  }

  reset() {
    this.stats = {
      health: 100,
      maxHealth: 100,
      defense: 0,
      strength: 0,
      speed: 100,
      critChance: 30,
      critDamage: 50,
      intelligence: 100,
      maxIntelligence: 100,
      miningSpeed: 0,
      miningFortune: 0,
      damage: 0,
    };
    this.effectiveStats = { ...this.stats };
    this.skills = {
      [SkillType.COMBAT]: { level: 0, xp: 0, nextLevelXp: 100 },
      [SkillType.MINING]: { level: 0, xp: 0, nextLevelXp: 100 },
      [SkillType.FORAGING]: { level: 0, xp: 0, nextLevelXp: 100 },
      [SkillType.FARMING]: { level: 0, xp: 0, nextLevelXp: 100 },
      [SkillType.FISHING]: { level: 0, xp: 0, nextLevelXp: 100 },
      [SkillType.ENCHANTING]: { level: 0, xp: 0, nextLevelXp: 100 },
      [SkillType.ALCHEMY]: { level: 0, xp: 0, nextLevelXp: 100 },
    };
  }

  private lastStatsPushTime: number = 0;

  tick(delta: number, inventory: any, hotbarIndex: number) {
    this.effectiveStats = this.getEffectiveStats(inventory, hotbarIndex);
    const effectiveStats = this.effectiveStats;
    
    // Mana Regeneration (2% of max per second + base 2)
    const manaRegen = (effectiveStats.maxIntelligence * 0.02 + 2) * delta;
    this.stats.intelligence = Math.min(effectiveStats.maxIntelligence, this.stats.intelligence + manaRegen);

    // Health Regeneration (1% of max per second + base 1)
    if (this.stats.health < effectiveStats.maxHealth) {
      const healthRegen = (effectiveStats.maxHealth * 0.01 + 1) * delta;
      this.stats.health = Math.min(effectiveStats.maxHealth, this.stats.health + healthRegen);
    }

    const now = performance.now();
    if (now - this.lastStatsPushTime > 200) { // 5Hz UI update rate
      useGameStore.getState().setPlayerStats({ ...this.effectiveStats, health: this.stats.health, intelligence: this.stats.intelligence });
      this.lastStatsPushTime = now;
    }
  }
}

export const skyBridgeManager = new SkyBridgeManager();
