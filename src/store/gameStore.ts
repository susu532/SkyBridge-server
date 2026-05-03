import { create } from 'zustand';
import { ItemType, ItemStack } from '../game/Inventory';
import { PlayerStats } from '../game/SkyBridgeManager';

interface GameState {
  inventoryVersion: number;
  incrementInventoryVersion: () => void;
  
  hotbarIndex: number;
  setHotbarIndex: (index: number) => void;

  inventoryIsOpen: boolean;
  setInventoryIsOpen: (isOpen: boolean) => void;
  
  currentMode: string;
  setCurrentMode: (mode: string) => void;

  skycoins: Record<string, number>;
  getSkycoins: () => number;
  setSkycoins: (amount: number) => void;
  addSkycoins: (amount: number) => void;
  
  // Game Messages (toast notifications)
  messages: { id: number; text: string; color: string }[];
  addMessage: (text: string, color?: string) => void;
  removeMessage: (id: number) => void;

  // SkyBridge Stats
  playerStats: PlayerStats | null;
  setPlayerStats: (stats: PlayerStats) => void;

  // SkyBridge Skills
  playerSkills: Record<string, any>;
  setPlayerSkills: (skills: Record<string, any>) => void;
  
  // Chat
  chatMessages: { sender: string; message: string }[];
  addChatMessage: (sender: string, message: string) => void;
  
  // Popups
  xpPopups: { id: number; skill: string; amount: number }[];
  addXpPopup: (skill: string, amount: number) => void;
  removeXpPopup: (id: number) => void;
  
  levelUpPopups: { id: number; skill: string; level: number }[];
  addLevelUpPopup: (skill: string, level: number) => void;
  removeLevelUpPopup: (id: number) => void;
}

let messageIdCounter = 0;

export const useGameStore = create<GameState>((set, get) => ({
  inventoryVersion: 0,
  incrementInventoryVersion: () => set((state) => ({ inventoryVersion: state.inventoryVersion + 1 })),
  
  hotbarIndex: 0,
  setHotbarIndex: (index) => set({ hotbarIndex: index }),

  inventoryIsOpen: false,
  setInventoryIsOpen: (isOpen) => set({ inventoryIsOpen: isOpen }),

  currentMode: 'hub',
  setCurrentMode: (mode) => set({ currentMode: mode }),

  skycoins: {}, 
  getSkycoins: () => {
    return get().skycoins[get().currentMode] ?? 500;
  },
  setSkycoins: (amount) => set((state) => {
    return { skycoins: { ...state.skycoins, [state.currentMode]: amount } };
  }),
  addSkycoins: (amount) => set((state) => {
    const current = state.skycoins[state.currentMode] ?? 500;
    return { skycoins: { ...state.skycoins, [state.currentMode]: current + amount } };
  }),

  messages: [],
  addMessage: (text, color = '#FFFFFF') => {
    const id = messageIdCounter++;
    set((state) => ({
      messages: [...state.messages, { id, text, color }]
    }));
    // Auto-remove after 3 seconds
    setTimeout(() => {
      set((state) => ({
        messages: state.messages.filter((m) => m.id !== id)
      }));
    }, 3000);
  },
  removeMessage: (id) => set((state) => ({
    messages: state.messages.filter((m) => m.id !== id)
  })),

  playerStats: null,
  setPlayerStats: (stats: PlayerStats) => set({ playerStats: stats }),
  
  playerSkills: {},
  setPlayerSkills: (skills: Record<string, any>) => set({ playerSkills: skills }),
  
  chatMessages: [],
  addChatMessage: (sender, message) => set((state) => ({
    chatMessages: [...state.chatMessages.slice(-49), { sender, message }]
  })),
  
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
    set((state) => ({ levelUpPopups: [...state.levelUpPopups, { id, skill, level }] }));
    setTimeout(() => {
      set((state) => ({ levelUpPopups: state.levelUpPopups.filter(p => p.id !== id) }));
    }, 5000);
  },
  removeLevelUpPopup: (id) => set((state) => ({ levelUpPopups: state.levelUpPopups.filter(p => p.id !== id) })),
}));
