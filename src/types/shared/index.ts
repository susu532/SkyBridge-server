export interface IMobState {
  id: string;
  type: string;
  position: { x: number; y: number; z: number };
  level?: number;
  team?: string;
  health?: number;
  maxHealth?: number;
  scale?: number;
  isPassive?: boolean;
}

export interface ITickMob extends IMobState {
  velocity: { x: number; y: number; z: number };
  rotation: { x: number; y: number };
  onGround: boolean;
  state: 'idle' | 'chase' | 'attack' | 'flee' | 'jump' | 'roam' | 'follow' | 'casting';
  stateTimer: number;
  homePosition?: { x: number; y: number; z: number };
  targetId?: string | null;
  targetPos?: { x: number; y: number; z: number };
  lastAttackTime?: number;
  damageMultiplier?: number;
  defense?: number;
  speedMultiplier?: number;
  lastPos?: { x: number; y: number; z: number };
  stuckTicks?: number;
  experienceReward?: number;
  dropRateMultiplier?: number;
  aiTickShift?: number;
  walkSpeed?: number;
  followDistance?: number;
  attackRange?: number;
  attackDamage?: number;
  attackSpeed?: number;
  attackCooldown?: number;
  jumpForce?: number;
  roamRadius?: number;
  knockbackResistance?: number;
  bossPhase?: number;
  inCombatWith?: Set<string>;
  threatTable?: Map<string, number>;
  charge?: { active: boolean; dirX: number; dirZ: number; speed: number; timer: number; };
  spin?: { active: boolean; timer: number; radius: number; };
  lastCastTime?: number;
  castCooldown?: number;
}

export interface IPlayerUpdate {
  id: string;
  name?: string;
  position?: { x: number; y: number; z: number };
  team?: string;
  isDead?: boolean;
  isSpectator?: boolean;
  health?: number;
  skinSeed?: string;
  skills?: any;
}

export interface IServerPlayer extends IPlayerUpdate {
  position: { x: number; y: number; z: number };
  velocity?: { x: number; y: number; z: number };
  rotation: { x: number; y: number };
  health: number;
  maxHealth?: number;
  isGrounded?: boolean;
  isFlying?: boolean;
  isSwimming?: boolean;
  isCrouching?: boolean;
  isSprinting?: boolean;
  isSwinging?: boolean;
  isBlocking?: boolean;
  isGliding?: boolean;
  swingSpeed?: number;
  heldItem?: number;
  offHandItem?: number;
  defense?: number;
  lastDamageTime?: number;
  lastRespawnTime?: number;
  packedData?: Float32Array;
  joinTime?: number;
  level?: number;
  experience?: number;
  currency?: number;
  inventory?: any[];
  equipment?: Record<string, any>;
  socket?: any;
  latency?: number;
}

export interface ISpawnParams {
  x: number;
  y: number;
  z: number;
  type?: string;
  level?: number;
  team?: string;
}

export interface IDroppedItemState {
  id: string;
  type: number;
  position: { x: number; y: number; z: number };
  velocity?: { x: number; y: number; z: number };
  timestamp: number;
  count?: number;
  metadata?: any;
}

export interface IMinionState {
  id: string;
  type: number;
  position: { x: number; y: number; z: number };
  storage: number;
  maxStorage: number;
  lastActionTime: number;
  ownerId?: string;
}

export interface IGameStateData {
  players: Record<string, IPlayerUpdate>;
  mobs?: Record<string, IMobState>;
  minions?: Record<string, IMinionState>;
  droppedItems?: Record<string, IDroppedItemState>;
  npcs?: any[];
  dayTime?: number;
}
