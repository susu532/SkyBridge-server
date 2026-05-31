import { create, StateCreator } from 'zustand';
import { PlayerStats } from '../game/SkyBridgeManager';
import { CrazyGamesManager } from '../game/CrazyGamesManager';

export interface InventorySlice {
  inventoryVersion: number;
  incrementInventoryVersion: () => void;
  hotbarIndex: number;
  setHotbarIndex: (index: number) => void;
  inventoryIsOpen: boolean;
  setInventoryIsOpen: (isOpen: boolean) => void;
}

export interface ChatSlice {
  messages: { id: number; text: string; color: string }[];
  addMessage: (text: string, color?: string) => void;
  removeMessage: (id: number) => void;
  chatMessages: { id: number; sender: string; message: string; team?: string }[];
  addChatMessage: (sender: string, message: string, team?: string) => void;
  clearChatMessages: () => void;
}

export interface PopupSlice {
  xpPopups: { id: number; skill: string; amount: number }[];
  addXpPopup: (skill: string, amount: number) => void;
  removeXpPopup: (id: number) => void;
  levelUpPopups: { id: number; skill: string; level: number }[];
  addLevelUpPopup: (skill: string, level: number) => void;
  removeLevelUpPopup: (id: number) => void;
}

export interface CoreGameSlice {
  currentMode: string;
  setCurrentMode: (mode: string) => void;
  serverId: string;
  setServerId: (id: string) => void;
  gameStartTime: number;
  setGameStartTime: (time: number) => void;
  isMapLoading: boolean;
  loadingProgress: number;
  loadingMessage: string;
  playerTeam: string | null;
  setPlayerTeam: (team: string | null) => void;
  setIsMapLoading: (isLoading: boolean) => void;
  setLoadingProgress: (progress: number, message: string) => void;
  targetInfo: { type: 'block' | 'npc' | null, name: string | null, id?: string };
  setTargetInfo: (info: { type: 'block' | 'npc' | null, name: string | null, id?: string }) => void;
}

export interface StatsSlice {
  skycoins: Record<string, number>;
  getSkycoins: () => number;
  setSkycoins: (amount: number) => void;
  addSkycoins: (amount: number) => void;
  playerStats: PlayerStats | null;
  setPlayerStats: (stats: PlayerStats) => void;
  playerSkills: Record<string, any>;
  setPlayerSkills: (skills: Record<string, any>) => void;
  leaderboard: Record<string, { id: string, name: string, team?: string, kills: number, deaths: number }>;
  showLeaderboard: boolean;
  setShowLeaderboard: (show: boolean) => void;
  setLeaderboardPlayer: (id: string, name: string, team: string | undefined, kills: number, deaths: number) => void;
  updateLeaderboardStats: (id: string, kills: number, deaths: number) => void;
  removeLeaderboardPlayer: (id: string) => void;
  clearLeaderboard: () => void;
}

export interface EnvironmentSlice {
  isUnderwater: boolean;
  setIsUnderwater: (val: boolean) => void;
  isUnderLava: boolean;
  setIsUnderLava: (val: boolean) => void;
}

export interface KillCelebration {
  id: number;
  victimName: string;
  isPlayer: boolean;
  isBot: boolean;
  coinsRewarded?: number;
}

export interface KillCelebrationSlice {
  killCelebrations: KillCelebration[];
  addKillCelebration: (victimName: string, isPlayer: boolean, isBot: boolean, coinsRewarded?: number) => void;
  removeKillCelebration: (id: number) => void;
}

export interface SocialSlice {
  friendRequests: { sourceId: string; sourceName: string }[];
  partyInvites: { sourceId: string; sourceName: string; server: string }[];
  addFriendRequest: (sourceId: string, sourceName: string) => void;
  removeFriendRequest: (sourceId: string) => void;
  addPartyInvite: (sourceId: string, sourceName: string, server: string) => void;
  removePartyInvite: (sourceId: string) => void;
}

export type GameState = InventorySlice & ChatSlice & PopupSlice & CoreGameSlice & StatsSlice & EnvironmentSlice & KillCelebrationSlice & SocialSlice;

let messageIdCounter = 0;

const createKillCelebrationSlice: StateCreator<GameState, [], [], KillCelebrationSlice> = (set) => ({
  killCelebrations: [],
  addKillCelebration: (victimName, isPlayer, isBot, coinsRewarded) => {
    const id = messageIdCounter++;
    set((state) => ({
      killCelebrations: [...state.killCelebrations, { id, victimName, isPlayer, isBot, coinsRewarded }]
    }));
    setTimeout(() => {
      set((state) => ({
        killCelebrations: state.killCelebrations.filter((c) => c.id !== id)
      }));
    }, 4000); // 4 seconds total screen presence
  },
  removeKillCelebration: (id) => set((state) => ({
    killCelebrations: state.killCelebrations.filter((c) => c.id !== id)
  })),
});

const createInventorySlice: StateCreator<GameState, [], [], InventorySlice> = (set) => ({
  inventoryVersion: 0,
  incrementInventoryVersion: () => set((state) => ({ inventoryVersion: state.inventoryVersion + 1 })),
  hotbarIndex: 0,
  setHotbarIndex: (index) => set({ hotbarIndex: index }),
  inventoryIsOpen: false,
  setInventoryIsOpen: (isOpen) => set({ inventoryIsOpen: isOpen }),
});

const createChatSlice: StateCreator<GameState, [], [], ChatSlice> = (set) => ({
  messages: [],
  addMessage: (text, color = '#FFFFFF') => {
    const id = messageIdCounter++;
    set((state) => ({ messages: [...state.messages, { id, text, color }] }));
    setTimeout(() => {
      set((state) => ({ messages: state.messages.filter((m) => m.id !== id) }));
    }, 3000);
  },
  removeMessage: (id) => set((state) => ({ messages: state.messages.filter((m) => m.id !== id) })),
  chatMessages: [],
  addChatMessage: (sender, message, team) => {
    const id = messageIdCounter++;
    set((state) => ({
      chatMessages: [...state.chatMessages.slice(-49), { id, sender, message, team }]
    }));
  },
  clearChatMessages: () => set({ chatMessages: [] }),
});

const createPopupSlice: StateCreator<GameState, [], [], PopupSlice> = (set) => ({
  xpPopups: [],
  addXpPopup: (skill, amount) => {
    const id = messageIdCounter++;
    set((state) => ({ xpPopups: [...state.xpPopups, { id, skill, amount }] }));
    setTimeout(() => {
      set((state) => ({ xpPopups: state.xpPopups.filter(p => p.id !== id) }));
    }, 2000);
  },
  removeXpPopup: (id) => set((state) => ({ xpPopups: state.xpPopups.filter(p => p.id !== id) })),
  levelUpPopups: [],
  addLevelUpPopup: (skill, level) => {
    const id = messageIdCounter++;
    CrazyGamesManager.happyTime();
    set((state) => ({ levelUpPopups: [...state.levelUpPopups, { id, skill, level }] }));
    setTimeout(() => {
      set((state) => ({ levelUpPopups: state.levelUpPopups.filter(p => p.id !== id) }));
    }, 5000);
  },
  removeLevelUpPopup: (id) => set((state) => ({ levelUpPopups: state.levelUpPopups.filter(p => p.id !== id) })),
});

const createCoreGameSlice: StateCreator<GameState, [], [], CoreGameSlice> = (set) => ({
  currentMode: 'dungeondelver',
  setCurrentMode: (mode) => set({ currentMode: mode }),
  serverId: '',
  setServerId: (id) => set({ serverId: id }),
  playerTeam: null,
  setPlayerTeam: (team) => set({ playerTeam: team }),
  gameStartTime: 0,
  setGameStartTime: (time) => set({ gameStartTime: time }),
  isMapLoading: true,
  setIsMapLoading: (isLoading) => set({ isMapLoading: isLoading }),
  loadingProgress: 0,
  loadingMessage: "Connecting to Server...",
  setLoadingProgress: (progress, message) => set({ loadingProgress: progress, loadingMessage: message }),
  targetInfo: { type: null, name: null },
  setTargetInfo: (info) => set({ targetInfo: info }),
});

const createStatsSlice: StateCreator<GameState, [], [], StatsSlice> = (set, get) => ({
  skycoins: {}, 
  getSkycoins: () => get().skycoins[get().currentMode] ?? 500,
  setSkycoins: (amount) => set((state) => ({ skycoins: { ...state.skycoins, [state.currentMode]: amount } })),
  addSkycoins: (amount) => set((state) => {
    const current = state.skycoins[state.currentMode] ?? 500;
    return { skycoins: { ...state.skycoins, [state.currentMode]: current + amount } };
  }),
  playerStats: null,
  setPlayerStats: (stats) => set({ playerStats: stats }),
  playerSkills: {},
  setPlayerSkills: (skills) => set({ playerSkills: skills }),
  leaderboard: {},
  showLeaderboard: false,
  setShowLeaderboard: (show) => set({ showLeaderboard: show }),
  setLeaderboardPlayer: (id, name, team, kills, deaths) => set((state) => ({
    leaderboard: { ...state.leaderboard, [id]: { id, name, team, kills, deaths } }
  })),
  updateLeaderboardStats: (id, kills, deaths) => set((state) => {
    const p = state.leaderboard[id];
    if (!p) return state;
    return { leaderboard: { ...state.leaderboard, [id]: { ...p, kills, deaths } } };
  }),
  removeLeaderboardPlayer: (id) => set((state) => {
    const newLb = { ...state.leaderboard };
    delete newLb[id];
    return { leaderboard: newLb };
  }),
  clearLeaderboard: () => set({ leaderboard: {} }),
});

const createEnvironmentSlice: StateCreator<GameState, [], [], EnvironmentSlice> = (set) => ({
  isUnderwater: false,
  setIsUnderwater: (val) => set({ isUnderwater: val }),
  isUnderLava: false,
  setIsUnderLava: (val) => set({ isUnderLava: val }),
});

const createSocialSlice: StateCreator<GameState, [], [], SocialSlice> = (set) => ({
  friendRequests: [],
  partyInvites: [],
  addFriendRequest: (sourceId, sourceName) => set((state) => {
    if (state.friendRequests.find(r => r.sourceId === sourceId)) return state;
    return { friendRequests: [...state.friendRequests, { sourceId, sourceName }] };
  }),
  removeFriendRequest: (sourceId) => set((state) => ({
    friendRequests: state.friendRequests.filter(r => r.sourceId !== sourceId)
  })),
  addPartyInvite: (sourceId, sourceName, server) => set((state) => {
    if (state.partyInvites.find(r => r.sourceId === sourceId)) return state;
    return { partyInvites: [...state.partyInvites, { sourceId, sourceName, server }] };
  }),
  removePartyInvite: (sourceId) => set((state) => ({
    partyInvites: state.partyInvites.filter(r => r.sourceId !== sourceId)
  })),
});

export const useGameStore = create<GameState>()((...a) => ({
  ...createInventorySlice(...a),
  ...createChatSlice(...a),
  ...createPopupSlice(...a),
  ...createCoreGameSlice(...a),
  ...createStatsSlice(...a),
  ...createEnvironmentSlice(...a),
  ...createKillCelebrationSlice(...a),
  ...createSocialSlice(...a),
}));
