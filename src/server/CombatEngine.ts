import itemsData from "../../data/items.json";

export class CombatEngine {
  static calculateDamage(
    attacker: any
  ): { damage: number; isCrit: boolean } {
    let baseDamage = 5;
    let strength = 0;
    let critChance = 30;
    let critDamage = 50;

    const heldItem = attacker.heldItem || 0;
    const itemStats = (
      itemsData as Record<string, { baseDamage: number; strength: number }>
    )[heldItem.toString()];

    if (itemStats) {
      baseDamage += itemStats.baseDamage || 0;
      strength += itemStats.strength || 0;
    }

    const combatLevel = attacker.skills?.["Combat"]?.level || 0;
    const additiveMultiplier = 1 + combatLevel * 0.04;
    const strengthMultiplier = 1 + strength / 100;

    const isCrit = Math.random() < critChance / 100;
    const critMultiplier = isCrit ? 1 + critDamage / 100 : 1;

    let damage = Math.floor(
      baseDamage * strengthMultiplier * critMultiplier * additiveMultiplier
    );

    return { damage, isCrit };
  }

  static calculateKnockback(
    attacker: any,
    isSprinting?: boolean,
    isProjectile?: boolean,
    knockbackDir?: { x: number; y?: number; z: number }
  ) {
    const attackerYaw = attacker.rotation?.y || 0;
    const kbForce = isSprinting ? 12 : 8;

    let serverKnockbackDir = {
      x: -Math.sin(attackerYaw) * kbForce,
      y: 12.0,
      z: -Math.cos(attackerYaw) * kbForce,
    };

    if (
      knockbackDir &&
      typeof knockbackDir.x === "number" &&
      typeof knockbackDir.z === "number"
    ) {
      if (isProjectile) {
        serverKnockbackDir = {
          x: knockbackDir.x * kbForce,
          y: (knockbackDir.y || 0) * kbForce,
          z: knockbackDir.z * kbForce,
        };
      } else {
        serverKnockbackDir = {
          x: knockbackDir.x,
          y: knockbackDir.y || 0,
          z: knockbackDir.z,
        };
      }
    }

    return serverKnockbackDir;
  }
}
