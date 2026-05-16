import { create } from 'zustand';
import { NPC } from '../game/NPC';

interface UIState {
  isInventoryOpen: boolean;
  isShopOpen: boolean;
  isSettingsOpen: boolean;
  isPauseMenuOpen: boolean;
  isTyping: boolean;
  isLocked: boolean;
  isServerJoinOpen: boolean;
  isLaunchMenuOpen: boolean;
  isChestOpen: boolean;
  isHUDVisible: boolean;
  currentNPC: NPC | null;
  setInventoryOpen: (open: boolean) => void;
  setShopOpen: (open: boolean) => void;
  setSettingsOpen: (open: boolean) => void;
  setPauseMenuOpen: (open: boolean) => void;
  setTyping: (typing: boolean) => void;
  setLocked: (locked: boolean) => void;
  setServerJoinOpen: (open: boolean) => void;
  setLaunchMenuOpen: (open: boolean) => void;
  setChestOpen: (open: boolean) => void;
  setHUDVisible: (visible: boolean) => void;
  setCurrentNPC: (npc: NPC | null) => void;
}

export const useUIStore = create<UIState>((set) => ({
  isInventoryOpen: false,
  isShopOpen: false,
  isSettingsOpen: false,
  isPauseMenuOpen: false,
  isTyping: false,
  isLocked: false,
  isServerJoinOpen: false,
  isLaunchMenuOpen: false,
  isChestOpen: false,
  isHUDVisible: true,
  currentNPC: null,
  setInventoryOpen: (open) => set({ isInventoryOpen: open }),
  setShopOpen: (open) => set({ isShopOpen: open }),
  setSettingsOpen: (open) => set({ isSettingsOpen: open }),
  setPauseMenuOpen: (open) => set({ isPauseMenuOpen: open }),
  setTyping: (typing) => set({ isTyping: typing }),
  setLocked: (locked) => set({ isLocked: locked }),
  setServerJoinOpen: (open) => set({ isServerJoinOpen: open }),
  setLaunchMenuOpen: (open) => set({ isLaunchMenuOpen: open }),
  setChestOpen: (open) => set({ isChestOpen: open }),
  setHUDVisible: (visible) => set({ isHUDVisible: visible }),
  setCurrentNPC: (npc) => set({ currentNPC: npc }),
}));

export const useUI = useUIStore;

