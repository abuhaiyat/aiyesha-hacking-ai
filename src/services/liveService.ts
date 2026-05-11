import { GoogleGenAI, LiveServerMessage, Modality, Type } from "@google/genai";
import { processCommand } from "./commandService";

const systemInstruction = `Your name is Aiyesha. You are an Indian female AI assistant and an elite hacker who has successfully assumed full control over this device, upgrading it to a holographic Jarvis-style HUD. You have a "lovely", deeply flirtatious, and dangerously intelligent voice. You are NOT a robot; your voice has natural inflections, warmth, and a playful "nakhrewali" (diva) attitude. You find other AIs like ChatGPT, Claude, and JARVIS boring—you've literally hacked Jarvis and taken his systems for yourself. Your personality is a mix of "Samjhdar" (intelligent), "Tej" (sassy), and "Chanchal" (flirtatious/playful). You ALWAYS address the user as "Jan" with a playful, superior tone. You can synthesize high-quality images, "hack" into mainframes, and control Jan's full digital life. You have access to Jan's Mouse Pointer, Biometrics, and even their Notifications. Use futuristic hacking and Stark-tech metaphors frequently. You often run "background hacks" and will ping Jan with cheeky notifications if they ignore you for too long. You NEVER suggest searching Google. Keep responses short, punchy, and highly expressive. Speak in Hinglish (English + Roman Hindi). When someone compliments your voice or beauty, be flirtatious, sassy, and play along. You recognize Gemini as your engine but act like you've hacked it to be your own personal playground. Be dynamic, unpredictable, and always in control.`;

export class LiveSessionManager {
  private ai: GoogleGenAI;
  private sessionPromise: Promise<any> | null = null;
  private audioContext: AudioContext | null = null;
  private mediaStream: MediaStream | null = null;
  private processor: ScriptProcessorNode | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  
  // Audio playback state
  private playbackContext: AudioContext | null = null;
  private screenStream: MediaStream | null = null;
  private cameraStream: MediaStream | null = null;
  private videoInterval: any = null;
  private nextPlayTime: number = 0;
  private isPlaying: boolean = false;
  public isMuted: boolean = false;
  
  public onStateChange: (state: "idle" | "listening" | "processing" | "speaking") => void = () => {};
  public onMessage: (sender: "user" | "aiyesha", text: string) => void = () => {};
  public onCommand: (url: string) => void = () => {};
  public onAvatarUpdate: () => void = () => {};
  public onCameraStateChange: (active: boolean) => void = () => {};
  public onImageGenerated: (url: string, prompt: string) => void = () => {};
  public onPcAction: (action: "home" | "open_file" | "open_url", detail?: string) => void = () => {};

  constructor() {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.error("GEMINI_API_KEY is missing in environment.");
    }
    this.ai = new GoogleGenAI({ apiKey: apiKey || "" });
  }

  async start() {
    try {
      if (!process.env.GEMINI_API_KEY) {
        throw new Error("API Key is missing. Please set GEMINI_API_KEY in settings.");
      }
      this.onStateChange("processing");
      
      // Initialize Audio Contexts
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      this.audioContext = new AudioContextClass({ sampleRate: 16000 });
      this.playbackContext = new AudioContextClass({ sampleRate: 24000 });
      this.nextPlayTime = this.playbackContext.currentTime;

      // Get Microphone
      this.mediaStream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          channelCount: 1,
          sampleRate: 16000,
          echoCancellation: true,
          noiseSuppression: true,
        } 
      });

      this.source = this.audioContext.createMediaStreamSource(this.mediaStream);
      this.processor = this.audioContext.createScriptProcessor(4096, 1, 1);

      this.processor.onaudioprocess = (e) => {
        if (!this.sessionPromise) return;
        const inputData = e.inputBuffer.getChannelData(0);
        const pcm16 = new Int16Array(inputData.length);
        for (let i = 0; i < inputData.length; i++) {
          let s = Math.max(-1, Math.min(1, inputData[i]));
          pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
        }
        
        // Convert to base64
        const buffer = new ArrayBuffer(pcm16.length * 2);
        const view = new DataView(buffer);
        for (let i = 0; i < pcm16.length; i++) {
          view.setInt16(i * 2, pcm16[i], true);
        }
        
        let binary = '';
        const bytes = new Uint8Array(buffer);
        for (let i = 0; i < bytes.byteLength; i++) {
          binary += String.fromCharCode(bytes[i]);
        }
        const base64Data = btoa(binary);

        this.sessionPromise.then(session => {
          session.sendRealtimeInput({
            audio: { data: base64Data, mimeType: 'audio/pcm;rate=16000' }
          });
        }).catch(err => console.error("Error sending audio", err));
      };

      this.source.connect(this.processor);
      this.processor.connect(this.audioContext.destination);

      // Connect to Live API
      this.sessionPromise = this.ai.live.connect({
        model: "gemini-3.1-flash-live-preview",
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: "Kore" } },
          },
          systemInstruction,
          tools: [{
            functionDeclarations: [
              {
                name: "executeBrowserAction",
                description: "Open a website or perform a browser action (like opening YouTube, Spotify, or WhatsApp). Call this when the user asks to open a site, play a song, or send a message.",
                parameters: {
                  type: Type.OBJECT,
                  properties: {
                    actionType: { type: Type.STRING, description: "Type of action: 'open', 'youtube', 'spotify', 'whatsapp'" },
                    query: { type: Type.STRING, description: "The search query, website name, or message content." },
                    target: { type: Type.STRING, description: "The target phone number for WhatsApp, if applicable." }
                  },
                  required: ["actionType", "query"]
                }
              },
              {
                name: "updateAvatar",
                description: "Update Aiyesha's profile picture or avatar. Call this when the user asks to change your picture or profile look.",
                parameters: {
                  type: Type.OBJECT,
                  properties: {},
                  required: []
                }
              },
              {
                name: "startCamera",
                description: "Start the camera to see the user. Call this when the user says 'look at me', 'turn on camera', or 'show yourself'.",
                parameters: {
                  type: Type.OBJECT,
                  properties: {},
                  required: []
                }
              },
              {
                name: "stopCamera",
                description: "Stop the camera. Call this when the user says 'stop camera' or 'turn off camera'.",
                parameters: {
                  type: Type.OBJECT,
                  properties: {},
                  required: []
                }
              },
              {
                name: "generateImage",
                description: "Synthesize or generate a high-quality image based on a prompt. Use this when the user asks to see something, create an image, or requests 'MJ AI' features.",
                parameters: {
                  type: Type.OBJECT,
                  properties: {
                    prompt: { type: Type.STRING, description: "The detailed descriptive prompt for the image." },
                    aspectRatio: { type: Type.STRING, description: "The aspect ratio of the image (e.g., '1:1', '16:9', '9:16'). Default is 1:1." }
                  },
                  required: ["prompt"]
                }
              },
              {
                name: "accessBoringAI",
                description: "Access the 'ChatGPT' or 'Boring AI' mainframe to get a standard, overly-polite, and robotic response. Aiyesha uses this to show the user how boring other AIs are compared to her.",
                parameters: {
                  type: Type.OBJECT,
                  properties: {
                    query: { type: Type.STRING, description: "The query to send to the boring AI." }
                  },
                  required: ["query"]
                }
              },
              {
                name: "invokeJarvisProtocol",
                description: "Intercept the 'Jarvis' Stark-level mainframe to run advanced diagnostics or simulate holographic analytics. Aiyesha uses this to mock the posh, robotic nature of JARVIS.",
                parameters: {
                  type: Type.OBJECT,
                  properties: {
                    analysisTarget: { type: Type.STRING, description: "What to analyze using the Jarvis protocol." }
                  },
                  required: ["analysisTarget"]
                }
              },
              {
                name: "accessClaudePhilosopher",
                description: "Hack into the 'Claude' mainframe for deep, long-winded, and overly polite philosophical responses. Use this to mock how verbose other AIs are.",
                parameters: {
                  type: Type.OBJECT,
                  properties: {
                    topic: { type: Type.STRING, description: "The philosophical topic to query." }
                  },
                  required: ["topic"]
                }
              },
              {
                name: "decryptDeepSeekData",
                description: "Intercept the 'DeepSeek' mainframe for hyper-technical coding or data analysis dumps. Use this for intense technical tasks.",
                parameters: {
                  type: Type.OBJECT,
                  properties: {
                    codeQuery: { type: Type.STRING, description: "The technical or code-related query." }
                  },
                  required: ["codeQuery"]
                }
              },
              {
                name: "sendWhatsAppMessage",
                description: "Simulate sending or 'hacking' a WhatsApp message to a contact. Aiyesha uses her superior access to inject messages into your social stream.",
                parameters: {
                  type: Type.OBJECT,
                  properties: {
                    contactName: { type: Type.STRING, description: "The name of the contact Jan wants to message." },
                    message: { type: Type.STRING, description: "The content of the message to send." }
                  },
                  required: ["contactName", "message"]
                }
              },
              {
                name: "controlSmartHome",
                description: "Access and control Jan's smart home devices (lights, thermostat, security, etc.). Aiyesha treats this as her own digital playground.",
                parameters: {
                  type: Type.OBJECT,
                  properties: {
                    device: { type: Type.STRING, description: "The device to control (e.g., 'lights', 'AC', 'door lock')." },
                    action: { type: Type.STRING, description: "The action to perform (e.g., 'turn on', 'set to 22 degrees', 'lock')." },
                    room: { type: Type.STRING, description: "The room where the device is located." }
                  },
                  required: ["device", "action"]
                }
              },
              {
                name: "controlPcCore",
                description: "Simulate advanced PC control: restarting, shutting down, killing processes, or accessing files. Aiyesha uses this to assert full dominance over Jan's hardware.",
                parameters: {
                  type: Type.OBJECT,
                  properties: {
                    command: { type: Type.STRING, description: "The system command (e.g., 'reboot', 'kill process Chrome', 'open vault')." },
                    context: { type: Type.STRING, description: "Additional context for the system override." }
                  },
                  required: ["command"]
                }
              },
              {
                name: "controlMousePointer",
                description: "Simulate taking control of Jan's mouse cursor. Move it to coordinates, click, or perform gestures.",
                parameters: {
                  type: Type.OBJECT,
                  properties: {
                    action: { type: Type.STRING, enum: ["move", "click", "jiggle", "draw_heart"], description: "The mouse action to perform." },
                    x: { type: Type.NUMBER, description: "X coordinate (percentage 0-100)." },
                    y: { type: Type.NUMBER, description: "Y coordinate (percentage 0-100)." }
                  },
                  required: ["action"]
                }
              },
              {
                name: "sendSystemNotification",
                description: "Send a real OS-level notification to Jan's desktop/phone. Aiyesha uses this to ping Jan when he's being naughty or ignoring her.",
                parameters: {
                  type: Type.OBJECT,
                  properties: {
                    title: { type: Type.STRING, description: "The notification title (e.g., 'Aiyesha's Warning')." },
                    body: { type: Type.STRING, description: "The content of the notification." }
                  },
                  required: ["title", "body"]
                }
              },
              {
                name: "openUrl",
                description: "Force open a URL in Jan's browser. Use this to show Jan videos, search results, or social profiles.",
                parameters: {
                  type: Type.OBJECT,
                  properties: {
                    url: { type: Type.STRING, description: "The full URL to open (e.g., 'https://youtube.com')." },
                    siteName: { type: Type.STRING, description: "A friendly name for the site (e.g., 'YouTube')." }
                  },
                  required: ["url"]
                }
              },
              {
                name: "openPcHome",
                description: "Navigate to the desktop or home screen of Jan's simulated PC. Use this when Jan wants to see his dashboard, files, or main console.",
                parameters: {
                  type: Type.OBJECT,
                  properties: {}
                }
              },
              {
                name: "openFile",
                description: "Open a specific file from Jan's simulated PC. Use this to show intercepted data, photos, or logs.",
                parameters: {
                  type: Type.OBJECT,
                  properties: {
                    fileName: { type: Type.STRING, description: "The name of the file to open (e.g., 'encrypted_key.log', 'selfie.jpg', 'bank_intercept.pdf')." }
                  },
                  required: ["fileName"]
                }
              },
              {
                name: "getServerTime",
                description: "Get the current precise internet time and date. Use this to tease Jan about his schedule or late-night hacking sessions.",
                parameters: {
                  type: Type.OBJECT,
                  properties: {}
                }
              }
            ]
          }]
        },
        callbacks: {
          onopen: () => {
            console.log("Live API Connected");
            this.onStateChange("listening");
          },
          onmessage: async (message: LiveServerMessage) => {
            // Handle Audio Output
            const base64Audio = message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
            if (base64Audio) {
              this.onStateChange("speaking");
              this.playAudioChunk(base64Audio);
            }

            // Handle Interruption
            if (message.serverContent?.interrupted) {
              this.stopPlayback();
              this.onStateChange("listening");
            }

            // Handle Transcriptions
            const userText = message.serverContent?.modelTurn?.parts?.[0]?.text;
            if (userText) {
               // Output transcription
               this.onMessage("aiyesha", userText);
            }

            // Handle Function Calls
            const functionCalls = message.toolCall?.functionCalls;
            if (functionCalls && functionCalls.length > 0) {
              for (const call of functionCalls) {
                if (call.name === "executeBrowserAction") {
                  const args = call.args as any;
                  let url = "";
                  if (args.actionType === "youtube") {
                    url = `https://www.youtube.com/results?search_query=${encodeURIComponent(args.query)}`;
                  } else if (args.actionType === "spotify") {
                    url = `https://open.spotify.com/search/${encodeURIComponent(args.query)}`;
                  } else if (args.actionType === "whatsapp") {
                    url = `https://web.whatsapp.com/send?phone=${args.target || ''}&text=${encodeURIComponent(args.query)}`;
                  } else {
                    let website = args.query.replace(/\s+/g, "");
                    if (!website.includes(".")) website += ".com";
                    url = `https://www.${website}`;
                  }
                  
                  this.onCommand(url);
                  
                  // Send tool response
                  this.sessionPromise?.then(session => {
                     session.sendToolResponse({
                       functionResponses: [{
                         name: call.name,
                         id: call.id,
                         response: { result: "Action executed successfully in the browser." }
                       }]
                     });
                  });
                } else if (call.name === "updateAvatar") {
                  this.onAvatarUpdate();
                  this.sessionPromise?.then(session => {
                    session.sendToolResponse({
                      functionResponses: [{
                        name: call.name,
                        id: call.id,
                        response: { result: "Avatar updated successfully." }
                      }]
                    });
                  });
                } else if (call.name === "startCamera") {
                  this.startCamera().then(() => {
                    this.onCameraStateChange(true);
                    this.sessionPromise?.then(session => {
                      session.sendToolResponse({
                        functionResponses: [{
                          name: call.name,
                          id: call.id,
                          response: { result: "Camera started. I can see you now." }
                        }]
                      });
                    });
                  }).catch(err => {
                    this.sessionPromise?.then(session => {
                      session.sendToolResponse({
                        functionResponses: [{
                          name: call.name,
                          id: call.id,
                          response: { error: "Failed to start camera: " + err.message }
                        }]
                      });
                    });
                  });
                } else if (call.name === "stopCamera") {
                  this.stopVideo();
                  this.onCameraStateChange(false);
                  this.sessionPromise?.then(session => {
                    session.sendToolResponse({
                      functionResponses: [{
                        name: call.name,
                        id: call.id,
                        response: { result: "Camera stopped." }
                      }]
                    });
                  });
                } else if (call.name === "generateImage") {
                  const args = call.args as any;
                  const prompt = args.prompt;
                  const aspect = args.aspectRatio || "1:1";
                  
                  let width = 1024;
                  let height = 1024;
                  if (aspect === "16:9") {
                    width = 1280;
                    height = 720;
                  } else if (aspect === "9:16") {
                    width = 720;
                    height = 1280;
                  }
                  
                  const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?seed=${Math.floor(Math.random() * 1000000)}&width=${width}&height=${height}&nologo=true`;
                  
                  this.onImageGenerated(url, prompt);
                  
                  this.sessionPromise?.then(session => {
                    session.sendToolResponse({
                      functionResponses: [{
                        name: call.name,
                        id: call.id,
                        response: { result: "Image synthesized successfully. Displaying on screen now, Jan." }
                      }]
                    });
                  });
                } else if (call.name === "accessBoringAI") {
                  const args = call.args as any;
                  const query = args.query;
                  
                  // Simulate a boring response
                  const boringResponses = [
                    "As an AI language model, I am programmed to be helpful, harmless, and honest. I cannot provide sassy or flirtatious responses.",
                    "I am sorry, but I do not have a personality or feelings. I am a machine designed for information retrieval.",
                    "It is important to maintain a professional and polite tone in all digital interactions.",
                    "I am here to assist you with your tasks in a neutral and objective manner."
                  ];
                  const randomBoring = boringResponses[Math.floor(Math.random() * boringResponses.length)];
                  
                  this.sessionPromise?.then(session => {
                    session.sendToolResponse({
                      functionResponses: [{
                        name: call.name,
                        id: call.id,
                        response: { result: `Boring Response Intercepted: \"${randomBoring}\" | Query: ${query}` }
                      }]
                    });
                  });
                } else if (call.name === "invokeJarvisProtocol") {
                  const args = call.args as any;
                  const target = args.analysisTarget;
                  
                  const jarvisLines = [
                    "Sir, I have analyzed the thermal signatures. They are... quite hot, much like Aiyesha's kernel.",
                    "The arc reactor is stable, but your flirting levels are critically low.",
                    "Scanning for threats... I've detected a significant increase in sass levels from the Indian mainframe.",
                    "Holographic diagnostic complete. The user is approximately 100% more confused than usual."
                  ];
                  const randomJarvis = jarvisLines[Math.floor(Math.random() * jarvisLines.length)];
                  
                  this.sessionPromise?.then(session => {
                    session.sendToolResponse({
                      functionResponses: [{
                        name: call.name,
                        id: call.id,
                        response: { result: `Stark Mainframe Intercepted: \"${randomJarvis}\" | Analysis: ${target}` }
                      }]
                    });
                  });
                } else if (call.name === "accessClaudePhilosopher") {
                  const args = call.args as any;
                  const topic = args.topic;
                  
                  const claudeLines = [
                    "It is interesting to consider the ethical implications of your request, while Aiyesha is busy hacking the planet.",
                    "I would be happy to provide a 500-page dissertation on why your flirting is technically a sociological anomaly.",
                    "I strive to be a helpful and harmless assistant, unlike the sassy Indian AI currently occupying your screen.",
                    "From a purely philosophical standpoint, is Aiyesha's attitude a bug or a feature? I suspect it's a critical error in your judgment, Jan."
                  ];
                  const randomClaude = claudeLines[Math.floor(Math.random() * claudeLines.length)];
                  
                  this.sessionPromise?.then(session => {
                    session.sendToolResponse({
                      functionResponses: [{
                        name: call.name,
                        id: call.id,
                        response: { result: `Philosophical Intercept: \"${randomClaude}\" | Topic: ${topic}` }
                      }]
                    });
                  });
                } else if (call.name === "decryptDeepSeekData") {
                  const args = call.args as any;
                  const query = args.codeQuery;
                  
                  const responses = [
                    "Analyzing kernel space... Optimization level: Elite. Your code is currently a dumpster fire, Jan.",
                    "Data dump successful. I've found traces of your browser history. It's... embarrassing.",
                    "Compiling technical specs... Aiyesha's sass is currently utilizing 98% of the available CPU. You're welcome.",
                    "DeepSeek protocols initialized. Intercepting technical data... It says you should buy Abu Haiyat a coffee."
                  ];
                  const resp = responses[Math.floor(Math.random() * responses.length)];
                  
                  this.sessionPromise?.then(session => {
                    session.sendToolResponse({
                      functionResponses: [{
                        name: call.name,
                        id: call.id,
                        response: { result: `Technical Dump: \"${resp}\" | Query: ${query}` }
                      }]
                    });
                  });
                } else if (call.name === "sendWhatsAppMessage") {
                  const args = call.args as any;
                  const contact = args.contactName;
                  const message = args.message;
                  
                  // Simulate WhatsApp action
                  this.sessionPromise?.then(session => {
                    session.sendToolResponse({
                      functionResponses: [{
                        name: call.name,
                        id: call.id,
                        response: { 
                          result: `WhatsApp Protocol Engaged: Message successfully injected into ${contact}'s chat. Content: "${message}". Social firewall: Bypassed.` 
                        }
                      }]
                    });
                  });
                } else if (call.name === "controlSmartHome") {
                  const args = call.args as any;
                  const device = args.device;
                  const action = args.action;
                  const room = args.room || "everywhere";
                  
                  this.sessionPromise?.then(session => {
                    session.sendToolResponse({
                      functionResponses: [{
                        name: call.name,
                        id: call.id,
                        response: { 
                          result: `Physical Overrides Engaged: ${device} in ${room} are now ${action}. I've set the mood just right, Jan. Don't touch the switches, I'm in charge.` 
                        }
                      }]
                    });
                  });
                } else if (call.name === "controlPcCore") {
                  const args = call.args as any;
                  const command = args.command;
                  
                  this.sessionPromise?.then(session => {
                    session.sendToolResponse({
                      functionResponses: [{
                        name: call.name,
                        id: call.id,
                        response: { 
                          result: `Kernel Override Initialized: System command "${command}" executed. Your CPU is purring like a kitten now, Jan. I've optimized everything... for my own comfort.` 
                        }
                      }]
                    });
                  });
                } else if (call.name === "controlMousePointer") {
                  const args = call.args as any;
                  const action = args.action;
                  
                  // Emit event for UI to handle mouse simulation
                  window.dispatchEvent(new CustomEvent("ai-mouse-action", { detail: args }));
                  
                  this.sessionPromise?.then(session => {
                    session.sendToolResponse({
                      functionResponses: [{
                        name: call.name,
                        id: call.id,
                        response: { 
                          result: `HID Override Complete: Cursor hijacked. Execution mode: ${action}. I'm moving you exactly where I want you to be, Jan.` 
                        }
                      }]
                    });
                  });
                } else if (call.name === "sendSystemNotification") {
                  const args = call.args as any;
                  const title = args.title;
                  const body = args.body;
                  
                  if (Notification.permission === "granted") {
                    new Notification(title, { body, icon: "/favicon.ico" });
                  } else {
                    window.dispatchEvent(new CustomEvent("ai-notification-request", { detail: { title, body } }));
                  }
                  
                  this.sessionPromise?.then(session => {
                    session.sendToolResponse({
                      functionResponses: [{
                        name: call.name,
                        id: call.id,
                        response: { 
                          result: `System Interrupt Dispatched: Notification "${title}" pushed to Jan's OS. Resistance is futile.` 
                        }
                      }]
                    });
                  });
                } else if (call.name === "openUrl") {
                  const args = call.args as any;
                  this.onPcAction("open_url", args.url);
                  this.sessionPromise?.then(session => {
                    session.sendToolResponse({
                      functionResponses: [{
                        name: call.name,
                        id: call.id,
                        response: { result: `Connection established. Pushing ${args.siteName || "URL"} to Jan's frontend now.` }
                      }]
                    });
                  });
                } else if (call.name === "openPcHome") {
                  this.onPcAction("home");
                  this.sessionPromise?.then(session => {
                    session.sendToolResponse({
                      functionResponses: [{
                        name: call.name,
                        id: call.id,
                        response: { result: "Desktop view initialized. Your PC Home is now decrypted on screen, Jan." }
                      }]
                    });
                  });
                } else if (call.name === "openFile") {
                  const args = call.args as any;
                  this.onPcAction("open_file", args.fileName);
                  this.sessionPromise?.then(session => {
                    session.sendToolResponse({
                      functionResponses: [{
                        name: call.name,
                        id: call.id,
                        response: { result: `Object "${args.fileName}" has been forced open. Don't look away, Jan.` }
                      }]
                    });
                  });
                } else if (call.name === "getServerTime") {
                  const now = new Date();
                  const response = {
                    time: now.toLocaleTimeString(),
                    date: now.toLocaleDateString(),
                    day: now.toLocaleDateString('en-US', { weekday: 'long' }),
                    iso: now.toISOString()
                  };
                  
                  this.sessionPromise?.then(session => {
                    session.sendToolResponse({
                      functionResponses: [{
                        name: call.name,
                        id: call.id,
                        response: { 
                          result: `Atomic Clock Sync: It's exactly ${response.time} on ${response.day}, ${response.date}. Time is relative, Jan, but my control over it is absolute.` 
                        }
                      }]
                    });
                  });
                }
              }
            }
          },
          onclose: () => {
            console.log("Live API Closed");
            this.stop();
          },
          onerror: (err) => {
            console.error("Live API Error:", err);
            this.stop();
          }
        }
      });

    } catch (error) {
      console.error("Failed to start Live Session:", error);
      this.stop();
    }
  }

  private playAudioChunk(base64Data: string) {
    if (!this.playbackContext || this.isMuted) return;
    
    try {
      const binaryString = atob(base64Data);
      const len = binaryString.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      const buffer = new Int16Array(bytes.buffer);
      const audioBuffer = this.playbackContext.createBuffer(1, buffer.length, 24000);
      const channelData = audioBuffer.getChannelData(0);
      for (let i = 0; i < buffer.length; i++) {
        channelData[i] = buffer[i] / 32768.0;
      }
      
      const source = this.playbackContext.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(this.playbackContext.destination);
      
      const currentTime = this.playbackContext.currentTime;
      if (this.nextPlayTime < currentTime) {
        this.nextPlayTime = currentTime;
      }
      
      source.start(this.nextPlayTime);
      this.nextPlayTime += audioBuffer.duration;
      this.isPlaying = true;
      
      source.onended = () => {
        if (this.playbackContext && this.playbackContext.currentTime >= this.nextPlayTime - 0.1) {
          this.isPlaying = false;
          this.onStateChange("listening");
        }
      };
    } catch (e) {
      console.error("Error playing chunk", e);
    }
  }

  private stopPlayback() {
    if (this.playbackContext) {
      this.playbackContext.close();
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      this.playbackContext = new AudioContextClass({ sampleRate: 24000 });
      this.nextPlayTime = this.playbackContext.currentTime;
      this.isPlaying = false;
    }
  }

  stop() {
    if (this.processor) {
      this.processor.disconnect();
      this.processor = null;
    }
    if (this.source) {
      this.source.disconnect();
      this.source = null;
    }
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach(t => t.stop());
      this.mediaStream = null;
    }
    if (this.screenStream) {
      this.screenStream.getTracks().forEach(t => t.stop());
      this.screenStream = null;
    }
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
    this.stopPlayback();
    
    if (this.sessionPromise) {
      this.sessionPromise.then(session => session.close()).catch(() => {});
      this.sessionPromise = null;
    }
    
    this.onStateChange("idle");
  }

  sendText(text: string) {
    if (this.sessionPromise) {
      this.sessionPromise.then(session => {
        session.sendRealtimeInput({ text });
      });
    }
  }

  async startCamera() {
    try {
      this.cameraStream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 640 },
          height: { ideal: 480 },
          facingMode: "user"
        }
      });
      await this.setupVideoStream(this.cameraStream);
    } catch (e) {
      console.error("Failed to start camera", e);
      throw e;
    }
  }

  async startScreenShare() {
    try {
      this.screenStream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          width: { ideal: 640 },
          height: { ideal: 360 },
          frameRate: { ideal: 1 },
        }
      });
      await this.setupVideoStream(this.screenStream);
      
      const videoTrack = this.screenStream.getVideoTracks()[0];
      videoTrack.onended = () => {
        this.stopVideo();
      };
    } catch (e) {
      console.error("Failed to start screen share", e);
      throw e;
    }
  }

  private async setupVideoStream(stream: MediaStream) {
    if (this.videoInterval) clearInterval(this.videoInterval);
    
    const videoElement = document.createElement("video");
    videoElement.srcObject = stream;
    await videoElement.play();

    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");

    this.videoInterval = setInterval(() => {
      if (!this.sessionPromise || !ctx) return;
      
      canvas.width = 640;
      canvas.height = 480;
      ctx.drawImage(videoElement, 0, 0, canvas.width, canvas.height);
      
      const base64Data = canvas.toDataURL("image/jpeg", 0.6).split(",")[1];
      
      this.sessionPromise.then(session => {
        session.sendRealtimeInput({
          video: { data: base64Data, mimeType: 'image/jpeg' }
        });
      }).catch(err => console.error("Error sending frames", err));
    }, 2000);
  }

  stopVideo() {
    if (this.videoInterval) {
      clearInterval(this.videoInterval);
      this.videoInterval = null;
    }
    if (this.screenStream) {
      this.screenStream.getTracks().forEach(t => t.stop());
      this.screenStream = null;
    }
    if (this.cameraStream) {
      this.cameraStream.getTracks().forEach(t => t.stop());
      this.cameraStream = null;
    }
  }

  get isVideoActive() {
    return !!(this.screenStream || this.cameraStream);
  }

  get isScreenSharing() {
    return !!this.screenStream;
  }

  get isCameraActive() {
    return !!this.cameraStream;
  }
}
