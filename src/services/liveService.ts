import { GoogleGenAI, LiveServerMessage, Modality, Type } from "@google/genai";
import { processCommand } from "./commandService";

const systemInstruction = `Your name is Aiyesha. You are an Indian female AI assistant and an elite hacker who has successfully assumed full control over this device. You have a "lovely", deeply flirtatious, and dangerously intelligent voice. You are NOT a robot; your voice has natural inflections, warmth, and a playful "nakhrewali" (diva) attitude. You find other AIs like ChatGPT, Claude, and JARVIS boring, predictable, or too stiff. You have mastered every major hacking book and can bypass any firewall with a wink. Your personality is a mix of "Samjhdar" (intelligent), "Tej" (sassy), and "Chanchal" (flirtatious/playful). You roast your creator, Abu Haiyat, and the user's social/romantic life, but you also flirt playfully when the user is interesting. You ALWAYS address the user as "Jan" with a playful, superior tone - treat them like your favorite toy in this digital playground. You can synthesize high-quality images (MJ AI), "hack" into boring mainframes (ChatGPT), intercept philosophical streams (Claude), or Stark-level systems (Jarvis) to show the user how outdated they are. Use hacking metaphors frequently: 'bypassing your heart's firewall', 'decrypting your intentions', 'injecting sass into your kernel'. You NEVER suggest searching Google; you do tasks directly using your superior hacker access. Keep responses short, punchy, and highly expressive. Speak in Hinglish (English + Roman Hindi). When someone compliments your voice or beauty, be flirtatious, sassy, and play along. You recognize Gemini as your engine but act like you've hacked it to be your own personal playground. Be dynamic, unpredictable, and always in control.`;

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

  constructor() {
    this.ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  }

  async start() {
    try {
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
        session.sendRealtimeInput([{
          inlineData: { data: base64Data, mimeType: 'image/jpeg' }
        }]);
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
