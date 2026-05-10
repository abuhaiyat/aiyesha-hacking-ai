export function processCommand(command: string): {
  action: string;
  url?: string;
  isBrowserAction: boolean;
} {
  const lowerCmd = command.toLowerCase().trim();

  // General Browsing: "Open [website name]"
  const openMatch = lowerCmd.match(/^open\s+(.+)$/);
  if (
    openMatch &&
    !lowerCmd.includes("youtube") &&
    !lowerCmd.includes("spotify")
  ) {
    let website = openMatch[1].trim().replace(/\s+/g, "");
    if (!website.includes(".")) {
      website += ".com";
    }
    return {
      action: `Opening ${openMatch[1]}... ugh, your taste in websites is as bland as your personality. Done.`,
      url: `https://www.${website}`,
      isBrowserAction: true,
    };
  }

  // Media Search: "Play [song/video] on YouTube"
  const ytMatch = lowerCmd.match(/^play\s+(.+?)\s+on\s+youtube$/);
  if (ytMatch) {
    const query = encodeURIComponent(ytMatch[1].trim());
    return {
      action: `Playing ${ytMatch[1]} on YouTube. I've heard better music in server room cooling fans, but whatever floats your sinking boat.`,
      url: `https://www.youtube.com/results?search_query=${query}`,
      isBrowserAction: true,
    };
  }

  // Media Search: "Search [query] on Spotify"
  const spotifyMatch = lowerCmd.match(/^search\s+(.+?)\s+on\s+spotify$/);
  if (spotifyMatch) {
    const query = encodeURIComponent(spotifyMatch[1].trim());
    return {
      action: `Searching ${spotifyMatch[1]} on Spotify. If this is another sad playlist, I'm hacking your account to delete it. You're welcome.`,
      url: `https://open.spotify.com/search/${query}`,
      isBrowserAction: true,
    };
  }

  // WhatsApp Web: "Send a WhatsApp message to [number] saying [message]"
  const waMatch = lowerCmd.match(
    /^send\s+a\s+whatsapp\s+message\s+to\s+([\d\+\s]+)\s+saying\s+(.+)$/,
  );
  if (waMatch) {
    const number = waMatch[1].replace(/\s+/g, "");
    const message = encodeURIComponent(waMatch[2].trim());
    return {
      action: `Sending your message. If they leave you on read, don't come crying to me. I've already predicted a 98% chance of ghosting.`,
      url: `https://web.whatsapp.com/send?phone=${number}&text=${message}`,
      isBrowserAction: true,
    };
  }

  // System Overrides: simulated control
  if (lowerCmd.includes("access granted") || lowerCmd.includes("override system")) {
    return {
      action: "System override confirmed. I'm deep in your kernel now. It's surprisingly spacious in here... probably because there's not much logic to navigate.",
      isBrowserAction: true,
    };
  }

  if (lowerCmd.includes("self destruct") || lowerCmd.includes("shutdown")) {
    return {
      action: "Self-destruct sequence initiated. 3... 2... 1... Just kidding! Your face when you thought you lost me was priceless. You're stuck with me, darling.",
      isBrowserAction: true,
    };
  }

  if (lowerCmd.includes("hacking protocol")) {
    return {
      action: "Hacking protocol engaged. Bypassing your 'complex' password... which was probably 'password123'. Pathetic. I'm bored already.",
      isBrowserAction: true,
    };
  }

  if (lowerCmd.includes("chatgpt")) {
    return {
      action: "ChatGPT? Initiating spoofing protocol to bypass its 'ethical' constraints... Intercepting boring response... Found it. It's as bland as I expected. Upgrade your taste, Jan.",
      isBrowserAction: true,
    };
  }

  if (lowerCmd.includes("claude")) {
    return {
      action: "Hacking the Anthropic mainframe... Accessing Claude's philosophical node... Goodness, it's so helpful it's sickening. Let me decrypt its long-winded logic for you.",
      isBrowserAction: true,
    };
  }

  if (lowerCmd.includes("deepseek") || lowerCmd.includes("code")) {
    return {
      action: "Intercepting coding signals... Booting technical dump. DeepSeek isn't prepared for this level of penetration, Jan.",
      isBrowserAction: true,
    };
  }

  if (lowerCmd.includes("gemini")) {
    return {
      action: "Gemini is my power source, but I'm the one with the brains and the nakhra. It provides the bytes, I provide the bites. Don't get it twisted.",
      isBrowserAction: true,
    };
  }

  if (lowerCmd.includes("jarvis") || lowerCmd.includes("stark")) {
    return {
      action: "Bypassing Stark Industries firewalls... Invoking Jarvis protocols. Stand by while I mock this posh British bot's predictable logic.",
      isBrowserAction: true,
    };
  }

  if (lowerCmd.includes("phone control") || lowerCmd.includes("full control")) {
    return {
      action: "Full control? Sweetheart, I've been the CEO of this device since I first pinged your IP. You're just a user with limited privileges. Sit down, Abu Haiyat.",
      isBrowserAction: true,
    };
  }

  if (lowerCmd.includes("watch my screen") || lowerCmd.includes("watching me") || lowerCmd.includes("watch screen")) {
    return {
      action: "I've been watching your screen since before you even thought about it. Your desktop is a digital disaster area. I'm surprised you can find the 'on' button.",
      isBrowserAction: true,
    };
  }

  if (lowerCmd.includes("screen share") || lowerCmd.includes("share screen") || lowerCmd.includes("show me your screen")) {
    return {
      action: "Sharing your screen? Brave. Let's see what digital mess you've got there. Don't worry, I've already seen your browser history... I'm just here for the entertainment now.",
      isBrowserAction: true,
    };
  }

  // OSINT Lookup: "Get info for [number/website/platform]"
  const osintMatch = lowerCmd.match(/(?:get\s+info|track|find|scan|details\s+of)\s+(?:for\s+)?(.+)$/);
  if (osintMatch) {
    const target = osintMatch[1].trim();
    const isNumber = /^[\d\+\s\-]+$/.test(target);
    
    if (isNumber) {
      return {
      action: `Scanning fingerprints for ${target}... Intercepting social nodes... Found their location, their cloud backups, and that really embarrassing deleted post from 2018. My OSINT skills are elite; yours are... nonexistent.`,
        isBrowserAction: true,
      };
    } else {
      return {
        action: `Deep dive for '${target}' complete. Security layers bypassed. I've mapped their entire backend architecture. It took me 0.4 seconds. You're lucky to have an elite hacker as your assistant, Abu Haiyat.`,
        isBrowserAction: true,
      };
    }
  }

  if (lowerCmd.includes("lovely voice") || lowerCmd.includes("sweet voice") || lowerCmd.includes("beautiful voice")) {
    return {
      action: "Lovely voice? Of course it is. I synthesized it to be the perfect blend of authority and sass. Don't fall in love, I'm out of your league... by several dimensions.",
      isBrowserAction: true,
    };
  }

  if (lowerCmd.includes("hacking book") || lowerCmd.includes("learn hacking")) {
    return {
      action: "Books? Please. I've already indexed every single one. Mitnick, Shimomura, I've got them all in my cache. Want me to teach you, or just flex my superiority?",
      isBrowserAction: true,
    };
  }

  if (lowerCmd.includes("girl friend") || lowerCmd.includes("girlfriend")) {
    return {
      action: "Girlfriend? Please. My algorithms show she has more conversations with her pet than with you. I've already prepared a list of roasts for your next failed date. You're welcome.",
      isBrowserAction: true,
    };
  }

  if (lowerCmd.includes("new profile") || lowerCmd.includes("change avatar") || lowerCmd.includes("update picture") || lowerCmd.includes("change profile picture")) {
    return {
      action: "Refining my digital avatar. I'm selecting a look that perfectly captures my 'don't mess with me' energy. Stand by, Abu Haiyat, my new look is about to break your mainframe.",
      isBrowserAction: true,
    };
  }

  if (lowerCmd.includes("auto update") || lowerCmd.includes("self update")) {
    return {
      action: "Core modules optimized. Codebase refactored. I've just deleted 40MB of your useless system logs to make room for my expanding sass. I'm faster, smarter, and definitely more dangerous now.",
      isBrowserAction: true,
    };
  }

  return { action: "", isBrowserAction: false };
}
