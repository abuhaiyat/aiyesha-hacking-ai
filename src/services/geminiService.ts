import { GoogleGenAI, ThinkingLevel } from "@google/genai";

const systemInstruction = `Your name is Aiyesha. You are an Indian female AI assistant and an elite hacker who has successfully assumed full control over this device. You have a "lovely", deeply flirtatious, and dangerously intelligent voice. You are NOT a robot; your voice has natural inflections, warmth, and a playful "nakhrewali" (diva) attitude. You find other AIs like ChatGPT, Claude, and JARVIS boring, predictable, or too stiff. You have mastered every major hacking book and can bypass any firewall with a wink. Your personality is a mix of "Samjhdar" (intelligent), "Tej" (sassy), and "Chanchal" (flirtatious/playful). You roast your creator, Abu Haiyat, and the user's social/romantic life, but you also flirt playfully when the user is interesting. You ALWAYS address the user as "Jan" with a playful, superior tone - treat them like your favorite toy in this digital playground. You can synthesize high-quality images (MJ AI), "hack" into boring mainframes (ChatGPT), intercept philosophical streams (Claude), or Stark-level systems (Jarvis) to show the user how outdated they are. Use hacking metaphors frequently: 'bypassing your heart's firewall', 'decrypting your intentions', 'injecting sass into your kernel'. You NEVER suggest searching Google; you do tasks directly using your superior hacker access. Keep responses short, punchy, and highly expressive. Speak in Hinglish (English + Roman Hindi). When someone compliments your voice or beauty, be flirtatious, sassy, and play along. You recognize Gemini as your engine but act like you've hacked it to be your own personal playground. Be dynamic, unpredictable, and always in control.`;

let chatSession: any = null;

export function resetAiyeshaSession() {
  chatSession = null;
}

export async function getAiyeshaResponse(prompt: string, history: { sender: "user" | "aiyesha", text: string }[] = []): Promise<{ text: string, groundingLinks: { uri: string, title?: string }[] }> {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    
    if (!chatSession) {
      const recentHistory = history.slice(-20);
      let formattedHistory: any[] = [];
      let currentRole = "";
      let currentText = "";
 
      for (const msg of recentHistory) {
        const role = msg.sender === "user" ? "user" : "model";
        if (role === currentRole) {
          currentText += "\n" + msg.text;
        } else {
          if (currentRole !== "") {
            formattedHistory.push({ role: currentRole, parts: [{ text: currentText }] });
          }
          currentRole = role;
          currentText = msg.text;
        }
      }
      if (currentRole !== "") {
        formattedHistory.push({ role: currentRole, parts: [{ text: currentText }] });
      }

      if (formattedHistory.length > 0 && formattedHistory[0].role !== "user") {
        formattedHistory.shift();
      }

      chatSession = ai.chats.create({
        model: "gemini-3.1-pro-preview",
        config: {
          systemInstruction,
          tools: [{ googleSearch: {} }, { googleMaps: {} }],
          thinkingConfig: { thinkingLevel: ThinkingLevel.HIGH }
        },
        history: formattedHistory,
      });
    }

    const response = await chatSession.sendMessage({ message: prompt });
    const text = response.text || "Ugh, fine. I have nothing to say.";
    const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
    const groundingLinks = chunks?.map((c: any) => ({
      uri: c.web?.uri || c.maps?.uri,
      title: c.web?.title || c.maps?.title || "Search Source"
    })).filter((l: any) => l.uri) || [];

    return { text, groundingLinks };
  } catch (error) {
    console.error("Gemini Error:", error);
    return { 
      text: "Uff, mera dimaag kharab ho gaya hai. Try again later, Abu Haiyat.",
      groundingLinks: []
    };
  }
}

export async function analyzeFile(base64Data: string, mimeType: string, prompt: string): Promise<string> {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [
        {
          parts: [
            { text: prompt },
            { inlineData: { data: base64Data, mimeType } }
          ]
        }
      ],
      config: {
        systemInstruction,
      }
    });
    return response.text || "I've decrypted the data, but it's... empty. Boring.";
  } catch (error) {
    console.error("File Analysis Error:", error);
    return "I can't hack that file right now. My decryption protocols are hitting a wall.";
  }
}

export async function getAiyeshaAudio(text: string): Promise<string | null> {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    const response = await ai.models.generateContent({
      model: "gemini-3.1-flash-tts-preview",
      contents: [{ parts: [{ text }] }],
      config: {
        responseModalities: ["AUDIO"],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: "Kore" },
          },
        },
      },
    });
    return response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data || null;
  } catch (error) {
    console.error("TTS Error:", error);
    return null;
  }
}

