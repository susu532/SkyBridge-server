export class ChatModerator {
  private static readonly SEVERE_WORDS = [
    "nigger", "nigga", "faggot", "pedophile"
  ];

  private static readonly BAD_WORDS = [
    "fuck", "shit", "bitch", "asshole", "cunt", "dick", "pussy", "cock", 
    "slut", "whore", "fag", "bastard", "retard", "kys", "rape", "nazi", "terrorist"
  ];

  private static readonly SCAM_WORDS = [
    "free skins", "currency generator", "free robux", "free coins", "hack",
    "account trade", "sell account", "cheap gold", "free gold", "dupe"
  ];

  private static readonly LEET_MAP: Record<string, string> = {
    '@': 'a', '4': 'a',
    '8': 'b',
    '3': 'e',
    '1': 'i', '!': 'i',
    '0': 'o',
    '$': 's', '5': 's',
    '7': 't',
    'v': 'u',
    '\\/': 'v'
  };

  private playerStates: Map<string, { lastMessage: string; lastMessageTime: number; messageCount: number }> = new Map();

  // Create boundary-aware regexes for regular bad words to avoid Scunthorpe problems
  private badWordRegexes: RegExp[] = [];
  
  // Severe words are checked purely by substring even with spaces removed
  private severeWordRegexes: RegExp[] = [];

  constructor() {
    this.badWordRegexes = ChatModerator.BAD_WORDS.map(word => new RegExp(`\\b${word}\\b`, 'i'));
    this.severeWordRegexes = ChatModerator.SEVERE_WORDS.map(word => new RegExp(word, 'i'));
  }

  // Normalize text to defeat Leetspeak and basic punctuation evasion
  private normalizeText(text: string): string {
    let normalized = text.toLowerCase();
    
    // Replace leet speak
    for (const [leet, char] of Object.entries(ChatModerator.LEET_MAP)) {
      normalized = normalized.split(leet).join(char);
    }
    
    return normalized;
  }

  // A more aggressive normalization that removes all non-alphabetical chars to catch "f u c k"
  // but should only be used carefully to avoid false positives (e.g. "this hit" -> "thishit" -> "shit")
  private aggressiveNormalize(text: string): string {
    return this.normalizeText(text).replace(/[^a-z]/g, '');
  }

  private hasPII(text: string): boolean {
    // Basic Email Regex
    const emailRegex = /[\w.-]+@[\w.-]+\.[a-zA-Z]{2,}/;
    // Phone Number Regex (catches 10+ digits with optional formatting)
    const phoneRegex = /(?:\+?\d{1,3}[\s-]?)?\(?\d{3}\)?[\s-]?\d{3}[\s-]?\d{4}/;
    
    // Check for IP addresses
    const ipRegex = /\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/;
    
    return emailRegex.test(text) || phoneRegex.test(text) || ipRegex.test(text);
  }

  private hasLinks(text: string): boolean {
    // Basic URL Regex
    const urlRegex = /(https?:\/\/[^\s]+)|(www\.[^\s]+)|([a-zA-Z0-9.-]+\.[a-zA-Z]{2,}\b)/i;
    // Prevent discord.gg links specifically
    const discordRegex = /discord\.gg\/[a-zA-Z0-9]+/i;
    return urlRegex.test(text) || discordRegex.test(text);
  }

  public checkSpam(playerId: string, message: string): boolean {
    const now = Date.now();
    const state = this.playerStates.get(playerId) || { lastMessage: "", lastMessageTime: 0, messageCount: 0 };

    // Spam rule 1: Repeated exactly same message within 10 seconds
    if (state.lastMessage === message && (now - state.lastMessageTime) < 10000) {
      state.messageCount++;
      this.playerStates.set(playerId, state);
      return true;
    }

    // Spam rule 2: Too many messages in short time (flooding - e.g. 5 messages in 3 seconds)
    if ((now - state.lastMessageTime) < 1000) {
      state.messageCount++;
      if (state.messageCount > 4) {
        this.playerStates.set(playerId, state);
        return true;
      }
    } else {
      // Reset if enough time passed
      if ((now - state.lastMessageTime) > 3000) {
        state.messageCount = 0;
      }
    }

    state.lastMessage = message;
    state.lastMessageTime = now;
    this.playerStates.set(playerId, state);
    return false;
  }

  public moderateMessage(playerId: string, message: string, options?: { skipSpamCheck?: boolean; skipLinks?: boolean }): { isAllowed: boolean; reason?: string } {
    // 1. Check Spam & Flooding
    if (!options?.skipSpamCheck && this.checkSpam(playerId, message)) {
      return { isAllowed: false, reason: "Please slow down and do not spam." };
    }

    // 2. Check PII
    if (this.hasPII(message)) {
      return { isAllowed: false, reason: "Sharing personal information or IPs is not allowed." };
    }

    // 3. Check Links
    if (!options?.skipLinks && this.hasLinks(message)) {
      return { isAllowed: false, reason: "External links and invites are not allowed." };
    }

    // 4. Check Scams
    const lowerMsg = message.toLowerCase();
    for (const scam of ChatModerator.SCAM_WORDS) {
      if (lowerMsg.includes(scam)) {
        return { isAllowed: false, reason: "Scam-related messages are prohibited." };
      }
    }

    // 5. Zero Tolerance & Profanity Check
    const normalizedMessage = this.normalizeText(message);
    const aggressiveMessage = this.aggressiveNormalize(message);

    // First check severe words (n-word, etc.) against aggressive normalization 
    // Example: "n i g g e r" -> "nigger"
    for (const regex of this.severeWordRegexes) {
      if (regex.test(aggressiveMessage)) {
        return { isAllowed: false, reason: "Your message violates the community guidelines for severe profanity/hate speech." };
      }
    }

    // Then check regular bad words against normal text with word boundaries
    // This catches "fuck", but allows "button" (not blocked by "butt" if "butt" was in list)
    for (const regex of this.badWordRegexes) {
      if (regex.test(normalizedMessage)) {
        return { isAllowed: false, reason: "Your message contains inappropriate language." };
      }
    }

    // Custom check for spaced out bad words e.g. "f u c k"
    // Only check if length is small to avoid big Scunthorpe problems
    const spacedWords = normalizedMessage.split(/\s+/);
    if (spacedWords.length > 0) {
       // Rejoin single characters to catch "f u c k" -> "fuck"
       const collapsedSingles = spacedWords.filter(w => w.length === 1).join('');
       for (const word of ChatModerator.BAD_WORDS) {
          if (collapsedSingles.includes(word)) {
              return { isAllowed: false, reason: "Your message contains inappropriate language." };
          }
       }
    }

    return { isAllowed: true };
  }
}

export const chatModerator = new ChatModerator();
