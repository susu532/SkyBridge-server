import { audioManager } from './AudioManager';

export class CrazyGamesManager {
  private static initialized = false;

  static async init() {
    if (this.initialized) return;
    try {
      if (typeof window !== 'undefined' && (window as any).CrazyGames) {
        const cg = (window as any).CrazyGames.SDK;
        if (cg && typeof cg.init === 'function') { await cg.init(); }
        this.initialized = true;
        console.log("CrazyGames SDK initialized");
      }
    } catch (e) {
      console.warn("CrazyGames SDK integration skipped or error", e);
    }
  }

  static loadingStart() {
    if (this.initialized) {
      try { (window as any).CrazyGames.SDK.game.loadingStart(); } catch(e){}
    }
  }

  static loadingStop() {
    if (this.initialized) {
      try { (window as any).CrazyGames.SDK.game.loadingStop(); } catch(e){}
    }
  }

  static gameplayStart() {
    if (this.initialized) {
      try { (window as any).CrazyGames.SDK.game.gameplayStart(); } catch(e){}
    }
  }

  static gameplayStop() {
    if (this.initialized) {
      try { (window as any).CrazyGames.SDK.game.gameplayStop(); } catch(e){}
    }
  }

  static happyTime() {
    if (this.initialized) {
      try { (window as any).CrazyGames.SDK.game.happyTime(); } catch(e){}
    }
  }

  static requestAd(type: 'midgame' | 'rewarded' = 'midgame', callbacks?: { adStarted?: () => void, adFinished?: () => void, adError?: (error: string) => void }) {
    if (!this.initialized) {
       callbacks?.adFinished?.();
       return;
    }
    
    // Auto-detect if audio should be muted etc...
    try {
       const cg = (window as any).CrazyGames.SDK;
       const wasMutedBeforeAd = audioManager.getMuted();
       cg.ad.requestAd(type, {
         adStarted: () => {
           console.log("Ad started");
           audioManager.setMuted(true);
           callbacks?.adStarted?.();
         },
         adFinished: () => {
           console.log("Ad finished");
           if (!wasMutedBeforeAd) audioManager.setMuted(false);
           callbacks?.adFinished?.();
         },
         adError: (error: string) => {
            console.log("Ad Error", error);
            if (!wasMutedBeforeAd) audioManager.setMuted(false);
            callbacks?.adError?.(error);
            if (callbacks?.adFinished && !callbacks?.adError) {
              callbacks.adFinished(); // Fallback if no error handler
            }
         }
       });
    } catch (e) {
       console.warn("CrazyGames ad Error", e);
       callbacks?.adFinished?.(); // Make sure gameplay resumes
    }
  }

  static inviteLink(params: Record<string, string>): string {
    if (this.initialized) {
      try {
        const cg = (window as any).CrazyGames.SDK;
        if (cg && cg.game && cg.game.inviteLink) {
          return cg.game.inviteLink(params);
        }
      } catch (e) {
        console.warn("CrazyGames SDK inviteLink error", e);
      }
    }
    // Fallback native url
    const url = new URL(window.location.href);
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
    return url.toString();
  }

  static updateRoom(data: { roomId?: string; isJoinable?: boolean; inviteParams?: Record<string, string>; minPlayers?: number; maxPlayers?: number }) {
    if (this.initialized) {
      try { (window as any).CrazyGames.SDK.game.updateRoom(data); } catch(e) {}
    }
  }

  static leftRoom() {
    if (this.initialized) {
      try { (window as any).CrazyGames.SDK.game.leftRoom(); } catch(e) {}
    }
  }

  static addJoinRoomListener(listener: (inviteParams: Record<string, string>) => void) {
    if (this.initialized) {
      try { (window as any).CrazyGames.SDK.game.addJoinRoomListener(listener); } catch(e) {}
    }
  }

  static removeJoinRoomListener(listener: (inviteParams: Record<string, string>) => void) {
    if (this.initialized) {
      try { (window as any).CrazyGames.SDK.game.removeJoinRoomListener(listener); } catch(e) {}
    }
  }

  static showInviteButton(params: Record<string, string>) {
    try { (window as any).CrazyGames.SDK.game.showInviteButton(params); } catch(e) {}
  }

  static hideInviteButton() {
    try { (window as any).CrazyGames.SDK.game.hideInviteButton(); } catch(e) {}
  }

  static requestBanner(options: { id: string, width: number, height: number, x: number, y: number }) {
    if (this.initialized) {
      try {
        const cg = (window as any).CrazyGames.SDK;
        if (cg && cg.banner && cg.banner.requestBanner) {
          cg.banner.requestBanner(options);
        }
      } catch(e) {}
    }
  }

  static clearAllBanners() {
    if (this.initialized) {
      try {
        const cg = (window as any).CrazyGames.SDK;
        if (cg && cg.banner && cg.banner.clearAllBanners) {
          cg.banner.clearAllBanners();
        }
      } catch(e) {}
    }
  }

  static get isInstantMultiplayer(): boolean {
    try { return !!(window as any).CrazyGames.SDK.game.isInstantMultiplayer; } catch(e) { return false; }
  }

  static get inviteParams(): Record<string, string> | null {
    try { return (window as any).CrazyGames.SDK.game.inviteParams || null; } catch(e) { return null; }
  }
}
