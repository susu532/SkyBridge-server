import React, { createContext, useContext, useState, useEffect } from 'react';
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
  setHUDVisible: (visible: boolean) => void;
  setCurrentNPC: (npc: NPC | null) => void;
}

const UIContext = createContext<UIState | null>(null);

export const UIProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isInventoryOpen, setInventoryOpen] = useState(false);
  const [isShopOpen, setShopOpen] = useState(false);
  const [isSettingsOpen, setSettingsOpen] = useState(false);
  const [isPauseMenuOpen, setPauseMenuOpen] = useState(false);
  const [isTyping, setTyping] = useState(false);
  const [isLocked, setLocked] = useState(false);
  const [isServerJoinOpen, setServerJoinOpen] = useState(false);
  const [isLaunchMenuOpen, setLaunchMenuOpen] = useState(false);
  const [isHUDVisible, setHUDVisible] = useState(true);
  const [currentNPC, setCurrentNPC] = useState<NPC | null>(null);

  return (
    <UIContext.Provider value={{
      isInventoryOpen, setInventoryOpen,
      isShopOpen, setShopOpen,
      isSettingsOpen, setSettingsOpen,
      isPauseMenuOpen, setPauseMenuOpen,
      isTyping, setTyping,
      isLocked, setLocked,
      isServerJoinOpen, setServerJoinOpen,
      isLaunchMenuOpen, setLaunchMenuOpen,
      isHUDVisible, setHUDVisible,
      currentNPC, setCurrentNPC
    }}>
      {children}
    </UIContext.Provider>
  );
};

export const useUI = () => {
  const context = useContext(UIContext);
  if (!context) throw new Error('useUI must be used within a UIProvider');
  return context;
};
