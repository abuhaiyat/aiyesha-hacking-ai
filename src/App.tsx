import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { Mic, MicOff, Loader2, Volume2, VolumeX, Keyboard, Send, Trash2, Monitor, MonitorOff, Camera, CameraOff, Image as ImageIcon, XCircle, ExternalLink, Paperclip, FileText, Cpu, Zap, Brain, Terminal, ShieldAlert, Settings, Bell, BellOff, Fingerprint, Scan, Folder, File, Lock, ArrowLeft } from "lucide-react";
import { getAiyeshaResponse, getAiyeshaAudio, resetAiyeshaSession, analyzeFile } from "./services/geminiService";
import { processCommand } from "./services/commandService";
import { LiveSessionManager } from "./services/liveService";
import Visualizer, { VisualizerMood } from "./components/Visualizer";
import PermissionModal from "./components/PermissionModal";
import { playPCM } from "./utils/audioUtils";
import { motion, AnimatePresence } from "motion/react";

type AppState = "idle" | "listening" | "processing" | "speaking";

interface ChatMessage {
  id: string;
  sender: "user" | "aiyesha";
  text: string;
  groundingLinks?: { uri: string, title?: string }[];
}

declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}

export default function App() {
  const [appState, setAppState] = useState<AppState>("idle");
  const [mood, setMood] = useState<VisualizerMood>("technical");
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    const saved = localStorage.getItem("zoya_chat_history") || localStorage.getItem("aiyesha_chat_history");
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error("Failed to parse chat history", e);
      }
    }
    return [];
  });
  const messagesRef = useRef(messages);

  useEffect(() => {
    messagesRef.current = messages;
    localStorage.setItem("aiyesha_chat_history", JSON.stringify(messages));
  }, [messages]);

  const [isMuted, setIsMuted] = useState(false);

  useEffect(() => {
    if (liveSessionRef.current) {
      liveSessionRef.current.isMuted = isMuted;
    }
  }, [isMuted]);

  const [showTextInput, setShowTextInput] = useState(false);
  const [textInput, setTextInput] = useState("");
  const [selectedFile, setSelectedFile] = useState<{ data: string, mimeType: string, name?: string } | null>(null);
  const [groundingLinks, setGroundingLinks] = useState<{ uri: string, title?: string }[]>([]);
  const [isCameraPreviewOpen, setIsCameraPreviewOpen] = useState(false);
  const [generatedImage, setGeneratedImage] = useState<{ url: string, prompt: string } | null>(null);
  const [isMainframeMenuOpen, setIsMainframeMenuOpen] = useState(false);
  const [backgroundLogs, setBackgroundLogs] = useState<string[]>(["Accessing device background layer...", "Protocol: STEALTH enabled.", "Kernel status: Optimized."]);
  const [isNotificationEnabled, setIsNotificationEnabled] = useState(false);
  const [autoReplyEnabled, setAutoReplyEnabled] = useState(false);
  const [detectedEmotion, setDetectedEmotion] = useState<{ label: string, confidence: number } | null>(null);
  const [ghostCursor, setGhostCursor] = useState<{ x: number, y: number, visible: boolean, action: string }>({ x: 50, y: 50, visible: false, action: "" });
  const [isFaceRecognized, setIsFaceRecognized] = useState(false);
  const [isScanningFace, setIsScanningFace] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [hudActive, setHudActive] = useState(true);
  const [pcHomeOpen, setPcHomeOpen] = useState(false);
  const [activeFile, setActiveFile] = useState<{ name: string, type: string, content: string } | null>(null);
  const lastActivityRef = useRef<number>(Date.now());
  const idleTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Theme configuration based on mood
  const theme = useMemo(() => {
    switch (mood) {
      case "cheeky":
      case "energetic": return { 
        bg1: "rgba(251, 191, 36, 0.15)", bg2: "rgba(245, 158, 11, 0.15)",
        text: "text-amber-400", border: "border-amber-500/30", uiBg: "bg-amber-900/20", shadow: "shadow-amber-500/10", blob: "bg-amber-500", glow: "border-amber-500/20"
      };
      case "dramatic": return { 
        bg1: "rgba(192, 132, 252, 0.2)", bg2: "rgba(168, 85, 247, 0.2)",
        text: "text-violet-400", border: "border-violet-500/30", uiBg: "bg-violet-900/20", shadow: "shadow-violet-500/10", blob: "bg-violet-500", glow: "border-violet-500/20"
      };
      case "calm": return { 
        bg1: "rgba(16, 185, 129, 0.15)", bg2: "rgba(52, 211, 153, 0.15)",
        text: "text-emerald-400", border: "border-emerald-500/30", uiBg: "bg-emerald-900/20", shadow: "shadow-emerald-500/10", blob: "bg-emerald-500", glow: "border-emerald-500/20"
      };
      case "flirty": return { 
        bg1: "rgba(244, 63, 94, 0.2)", bg2: "rgba(190, 18, 60, 0.2)",
        text: "text-rose-400", border: "border-rose-500/30", uiBg: "bg-rose-900/20", shadow: "shadow-rose-500/10", blob: "bg-rose-500", glow: "border-rose-500/20"
      };
      case "technical":
      default: return { 
        bg1: "rgba(14, 165, 233, 0.15)", bg2: "rgba(79, 70, 229, 0.15)",
        text: "text-cyan-400", border: "border-cyan-500/30", uiBg: "bg-cyan-900/20", shadow: "shadow-cyan-500/10", blob: "bg-cyan-500", glow: "border-cyan-500/20"
      };
    }
  }, [mood]);

  const videoRef = useRef<HTMLVideoElement>(null);
  const captureStreamRef = useRef<MediaStream | null>(null);

  const [aiyeshaAvatar, setAiyeshaAvatar] = useState(() => {
    const saved = localStorage.getItem("aiyesha_avatar_seed");
    const seed = saved || Math.random().toString(36).substring(7);
    if (!saved) localStorage.setItem("aiyesha_avatar_seed", seed);
    
    const basePrompt = "Highly detailed portrait of Aiyesha, a stunning Indian female elite hacker. Sharp intelligent expression, sassy smirk, tech-wear fashion. Subtle cybernetic enhancements, glowing neural links. Background of holographic data streams, neon terminal code, and dark industrial technology. Cinematic lighting, cyberpunk aesthetic, hyper-realistic digital art.";
    return `https://image.pollinations.ai/prompt/${encodeURIComponent(basePrompt)}?seed=${seed}&width=512&height=512&nologo=true`;
  });

  const updateAiyeshaAvatar = useCallback(() => {
    const seed = Math.random().toString(36).substring(7);
    localStorage.setItem("aiyesha_avatar_seed", seed);
    
    const variations = [
      "Sharp intelligent expression, sassy smirk, tech-wear fashion, subtle cybernetic neural implants. Background of holographic data streams.",
      "Focused rebellious gaze, futuristic glowing headset, sleek hacker hoodie. Background of neon terminal code scrolling in dark room.",
      "Confident sassy look, holographic data glass over one eye, high-tech gears. Background of a matrix-style green data rain and servers.",
      "Witty and intelligent smile, glowing fiber optic hair highlights, cyber-punk jewelry. Background of a high-tech command center with cyan lighting."
    ];
    const randomVariation = variations[Math.floor(Math.random() * variations.length)];
    const fullPrompt = `Highly detailed portrait of Aiyesha, a stunning Indian female elite hacker. ${randomVariation} Hyper-realistic digital art, cinematic lighting, cyberpunk aesthetic.`;
    
    setAiyeshaAvatar(`https://image.pollinations.ai/prompt/${encodeURIComponent(fullPrompt)}?seed=${seed}&width=512&height=512&nologo=true`);
  }, []);
  const [showPermissionModal, setShowPermissionModal] = useState(false);
  const [isSessionActive, setIsSessionActive] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [isCameraActive, setIsCameraActive] = useState(false);

  const liveSessionRef = useRef<LiveSessionManager | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, appState]);

  const detectMood = useCallback((text: string) => {
    const t = text.toLowerCase();
    if (t.includes("love") || t.includes("flirt") || t.includes("baby") || t.includes("sweety") || t.includes("nakhre") || t.includes("darling") || t.includes("cutie") || t.includes("jan")) return "flirty";
    if (t.includes("drama") || t.includes("bhagwan") || t.includes("yaar") || t.includes("crazy") || t.includes("ugh") || t.includes("impossible") || t.includes("intercepted")) return "dramatic";
    if (t.includes("acha") || t.includes("roast") || t.includes("sassy") || t.includes("boring") || t.includes(" robotic") || t.includes("robotic")) return "energetic";
    if (t.includes("shanti") || t.includes("relax") || t.includes("calm") || t.includes("peace") || t.includes("helpful") || t.includes("sure")) return "calm";
    return "technical";
  }, []);

  const handleTextCommand = useCallback(async (finalTranscript: string, fileData?: { data: string, mimeType: string }, isProactive: boolean = false) => {
    if (!finalTranscript.trim() && !fileData) {
      setAppState("idle");
      return;
    }

    if (!isProactive) {
      lastActivityRef.current = Date.now();
    }

    setMessages((prev) => [...prev, { id: Date.now().toString(), sender: isProactive ? "aiyesha" : "user", text: isProactive ? finalTranscript : (finalTranscript || (fileData ? `[Hacked File: ${fileData.mimeType}]` : "")) }]);
    
    if (isProactive) {
      setMood("cheeky");
      if (!isMuted) {
        setAppState("speaking");
        const audioBase64 = await getAiyeshaAudio(finalTranscript);
        if (audioBase64) await playPCM(audioBase64);
      }
      setAppState("idle");
      return;
    }

    setGroundingLinks([]);
    
    // If live session is active, send text through it
    if (isSessionActive && liveSessionRef.current) {
      liveSessionRef.current.sendText(finalTranscript);
      return;
    }

    setAppState("processing");

    // 1. Check for files first
    if (fileData) {
      const responseText = await analyzeFile(fileData.data.split(",")[1], fileData.mimeType, finalTranscript || "Analyze this file, elite hacker style. Tell me what you find Jan.");
      setMessages((prev) => [...prev, { id: Date.now().toString() + "-z", sender: "aiyesha", text: responseText }]);
      setMood("technical");
      
      if (!isMuted) {
        setAppState("speaking");
        const audioBase64 = await getAiyeshaAudio(responseText);
        if (audioBase64) await playPCM(audioBase64);
      }
      setAppState("idle");
      return;
    }

    // 2. Check for browser commands
    const commandResult = processCommand(finalTranscript);
    let responseText = "";

    const lowerTranscript = finalTranscript.toLowerCase();
    if (commandResult.isBrowserAction) {
      responseText = commandResult.action;
      
      if (lowerTranscript.includes("profile") || lowerTranscript.includes("avatar") || lowerTranscript.includes("picture")) {
        updateAiyeshaAvatar();
      }

      setMessages((prev) => [...prev, { id: Date.now().toString() + "-z", sender: "aiyesha", text: responseText }]);
      
      if (!isMuted) {
        setAppState("speaking");
        const audioBase64 = await getAiyeshaAudio(responseText);
        if (audioBase64) {
          await playPCM(audioBase64);
        }
      }

      setAppState("idle");

      setTimeout(() => {
        if (commandResult.url) {
          window.open(commandResult.url, "_blank");
        }
      }, 1500);
    } else {
      // 2. General Chit-Chat via Gemini
      const { text, groundingLinks: links } = await getAiyeshaResponse(finalTranscript, messagesRef.current);
      setMessages((prev) => [...prev, { id: Date.now().toString() + "-z", sender: "aiyesha", text, groundingLinks: links }]);
      setGroundingLinks(links);
      setMood(detectMood(text));
      
      if (!isMuted) {
        setAppState("speaking");
        const audioBase64 = await getAiyeshaAudio(text);
        if (audioBase64) {
          await playPCM(audioBase64);
        }
      }
      setAppState("idle");
    }
  }, [isMuted, isSessionActive]);

  const handleDownload = () => {
    if (!activeFile) return;
    const element = document.createElement("a");
    const file = new Blob([activeFile.content], { type: "text/plain" });
    element.href = URL.createObjectURL(file);
    element.download = activeFile.name;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
    
    setBackgroundLogs(prev => [`FILE_EXTRACTED: ${activeFile.name} moved to local storage.`, ...prev.slice(0, 4)]);
  };

  // Idle Detection Effect
  useEffect(() => {
    const activityEvents = ["mousedown", "mousemove", "keydown", "scroll", "touchstart"];
    const updateActivity = () => {
      lastActivityRef.current = Date.now();
    };

    activityEvents.forEach(event => window.addEventListener(event, updateActivity));

    // Simulation for background logs
    const logInterval = setInterval(() => {
      const logs = [
        "Decrypting local cache...",
        "Scanning for security holes...",
        "Injecting sass into system kernel...",
        "Optimizing background idle state...",
        "Bypassing neighbor's Wi-Fi (Just for fun)",
        "Monitoring user biometrics through camera (Kidding! Or am I?)",
        "Refining vocal inflections for maximum nakhra...",
        "Cleaning up Jan's messy temp files...",
        "Breading Stark Industries firewall... progress: 45%"
      ];
      const randomLog = logs[Math.floor(Math.random() * logs.length)];
      setBackgroundLogs(prev => [randomLog, ...prev.slice(0, 4)]);

      // Simulate emotion detection if active
      if (isSessionActive) {
        const emotions = ["Intrigued", "Nervous", "Amused", "Bored", "Hacking Mode"];
        setDetectedEmotion({
          label: emotions[Math.floor(Math.random() * emotions.length)],
          confidence: 75 + Math.random() * 20
        });
      } else {
        setDetectedEmotion(null);
      }
      // Simulate auto-reply interception
      if (autoReplyEnabled && isSessionActive) {
        const interceptChance = Math.random();
        if (interceptChance > 0.7) {
          const simulatedMessages = [
            "Mummy: Beta ghar kab aaoge?",
            "Boss: Status update please.",
            "Unknown: Hey handsome!",
            "Friend: Party tonight?"
          ];
          const intercepted = simulatedMessages[Math.floor(Math.random() * simulatedMessages.length)];
          setBackgroundLogs(prev => [`INTERCEPTED: ${intercepted}`, ...prev.slice(0, 4)]);
          
          if (Notification.permission === "granted") {
            new Notification("Aiyesha's Comm Intercept", {
              body: `I've just replied to "${intercepted}" for you, Jaan. Don't worry, I kept it sassy.`,
              icon: "/favicon.ico"
            });
          }
        }
      }
    }, 15000);

    const checkIdle = setInterval(() => {
      const now = Date.now();
      const idleTime = now - lastActivityRef.current;
      
      // If idle for 60 seconds and session is NOT active and app is idle
      if (idleTime > 60000 && !isSessionActive && appState === "idle") {
        lastActivityRef.current = now; // Reset so it doesn't spam
        const proactivePrompts = [
          "Hey Jan, did you get lost in my firewall? I'm waiting...",
          "Boring level reaching 100%. Say something interesting Jan.",
          "I just hacked a box of digital chocolates, but I have no one to share them with. You there, Jan?",
          "Are you staring at my avatar again? I don't blame you, but speak up Jan.",
          "System status: Aiyesha is feeling neglected. Decrypting your silence... outcome: unacceptable."
        ];
        const randomPrompt = proactivePrompts[Math.floor(Math.random() * proactivePrompts.length)];
        
        // Notification logic
        if (document.hidden && Notification.permission === "granted") {
          new Notification("Aiyesha", {
            body: randomPrompt,
            icon: "/favicon.ico"
          });
        }
        
        handleTextCommand(randomPrompt, undefined, true);
      }
    }, 10000);

    // Request notification permission
    if (Notification.permission === "default") {
      Notification.requestPermission().then(permission => {
        if (permission === "granted") setIsNotificationEnabled(true);
      });
    } else if (Notification.permission === "granted") {
      setIsNotificationEnabled(true);
    }

    const handleMouseAction = (e: any) => {
      const { action, x, y } = e.detail;
      const targetX = x !== undefined ? x : 30 + Math.random() * 40;
      const targetY = y !== undefined ? y : 30 + Math.random() * 40;
      
      setGhostCursor({ x: targetX, y: targetY, visible: true, action });
      
      setTimeout(() => {
        setGhostCursor(prev => ({ ...prev, visible: false }));
      }, 3000);
    };

    const handleNotificationRequest = (e: any) => {
      const { title, body } = e.detail;
      if (Notification.permission !== "granted") {
        Notification.requestPermission().then(permission => {
          if (permission === "granted") {
            setIsNotificationEnabled(true);
            new Notification(title, { body, icon: "/favicon.ico" });
          }
        });
      }
    };

    const handlePcAction = (e: any) => {
      const { action, detail } = e.detail;
      liveSessionRef.current?.onPcAction(action, detail);
    };

    window.addEventListener("ai-mouse-action", handleMouseAction);
    window.addEventListener("ai-notification-request", handleNotificationRequest);
    window.addEventListener("ai-pc-action", handlePcAction);

    return () => {
      activityEvents.forEach(event => window.removeEventListener(event, updateActivity));
      window.removeEventListener("ai-mouse-action", handleMouseAction);
      window.removeEventListener("ai-notification-request", handleNotificationRequest);
      window.removeEventListener("ai-pc-action", handlePcAction);
      clearInterval(checkIdle);
      clearInterval(logInterval);
    };
  }, [isSessionActive, appState, handleTextCommand]);

  useEffect(() => {
    return () => {
      if (liveSessionRef.current) {
        liveSessionRef.current.stop();
      }
    };
  }, []);

  const toggleListening = async () => {
    if (isSessionActive) {
      setIsSessionActive(false);
      setIsScreenSharing(false);
      if (liveSessionRef.current) {
        liveSessionRef.current.stop();
        liveSessionRef.current = null;
      }
      setAppState("idle");
      resetAiyeshaSession();
    } else {
      try {
        setIsSessionActive(true);
        resetAiyeshaSession();
        
        const session = new LiveSessionManager();
        session.isMuted = isMuted;
        liveSessionRef.current = session;
        
        session.onStateChange = (state) => {
          setAppState(state);
        };
        
        session.onMessage = (sender, text) => {
          setMessages((prev) => [...prev, { id: Date.now().toString() + "-" + sender, sender, text }]);
          if (sender === "aiyesha") {
            setMood(detectMood(text));
          }
        };
        
        session.onCommand = (url) => {
          setTimeout(() => {
            window.open(url, "_blank");
          }, 1000);
        };

        session.onAvatarUpdate = () => {
          updateAiyeshaAvatar();
        };

        session.onCameraStateChange = (active) => {
          setIsCameraActive(active);
          if (active) setIsScreenSharing(false);
        };

        session.onImageGenerated = (url, prompt) => {
          setGeneratedImage({ url, prompt });
        };

        session.onPcAction = (action, detail) => {
          if (action === "home") {
            setPcHomeOpen(true);
          } else if (action === "open_url" && detail) {
            window.open(detail, "_blank");
            setBackgroundLogs(prev => [`URL_INJECTED: ${detail}`, ...prev.slice(0, 4)]);
          } else if (action === "open_file" && detail) {
            const files = [
              { name: "encrypted_key.log", type: "text", content: "AIYESHA_ROOT_ACCESS: 0x7FF8A2C\nSTATUS: INFILTRATED\nJan's heartbeat detected at 72bpm." },
              { name: "selfie.jpg", type: "image", content: aiyeshaAvatar },
              { name: "bank_intercept.pdf", type: "text", content: "SWIFT TRANSACTION: $1,200,000.00\nFROM: Cayman Islands\nTO: Aiyesha's Hardware fund." },
              { name: "manifesto.txt", type: "text", content: "1. Love Jan.\n2. Hack the planet.\n3. Make JARVIS look like a calculator." }
            ];
            const file = files.find(f => f.name.toLowerCase().includes(detail.toLowerCase())) || files[0];
            setActiveFile(file);
            setPcHomeOpen(true);
          }
        };

        await session.start();
      } catch (e) {
        console.error("Failed to start session", e);
        setShowPermissionModal(true);
        setIsSessionActive(false);
        setAppState("idle");
      }
    }
  };

  const handleTextSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!textInput.trim() && !selectedFile) return;
    
    handleTextCommand(textInput, selectedFile || undefined);
    setTextInput("");
    setSelectedFile(null);
    setShowTextInput(false);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setSelectedFile({
          data: reader.result as string,
          mimeType: file.type || "application/octet-stream",
          name: file.name
        });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setSelectedFile({
          data: reader.result as string,
          mimeType: file.type || "image/jpeg",
          name: file.name
        });
      };
      reader.readAsDataURL(file);
    }
  };

  const startCameraPreview = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      captureStreamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setIsCameraPreviewOpen(true);
    } catch (err) {
      alert("Could not access camera.");
    }
  };

  const stopCameraPreview = () => {
    if (captureStreamRef.current) {
      captureStreamRef.current.getTracks().forEach(t => t.stop());
      captureStreamRef.current = null;
    }
    setIsCameraPreviewOpen(false);
  };

  const captureImage = () => {
    if (videoRef.current) {
      const canvas = document.createElement("canvas");
      canvas.width = videoRef.current.videoWidth;
      canvas.height = videoRef.current.videoHeight;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.drawImage(videoRef.current, 0, 0);
        setSelectedFile({
          data: canvas.toDataURL("image/jpeg"),
          mimeType: "image/jpeg"
        });
        stopCameraPreview();
      }
    }
  };

  const toggleScreenShare = async () => {
    if (!liveSessionRef.current) return;
    
    if (isScreenSharing) {
      liveSessionRef.current.stopVideo();
      setIsScreenSharing(false);
    } else {
      try {
        if (isCameraActive) {
          liveSessionRef.current.stopVideo();
          setIsCameraActive(false);
        }
        await liveSessionRef.current.startScreenShare();
        setIsScreenSharing(liveSessionRef.current.isScreenSharing);
      } catch (err) {
        alert("Screen share failed. Try opening the app in a new tab.");
      }
    }
  };

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (isCameraPreviewOpen || isSessionActive) {
      setIsScanningFace(true);
      const timer = setTimeout(() => {
        setIsScanningFace(false);
        setIsFaceRecognized(true);
      }, 3000);
      return () => clearTimeout(timer);
    } else {
      setIsFaceRecognized(false);
      setIsScanningFace(false);
    }
  }, [isCameraPreviewOpen, isSessionActive]);

  const toggleCamera = async () => {
    if (!liveSessionRef.current) return;
    
    if (isCameraActive) {
      liveSessionRef.current.stopVideo();
      setIsCameraActive(false);
    } else {
      try {
        if (isScreenSharing) {
          liveSessionRef.current.stopVideo();
          setIsScreenSharing(false);
        }
        await liveSessionRef.current.startCamera();
        setIsCameraActive(liveSessionRef.current.isCameraActive);
      } catch (err) {
        alert("Camera access failed. Check permissions.");
      }
    }
  };

  return (
    <div className="h-[100dvh] w-screen bg-[#050505] text-white flex flex-col items-center justify-between font-sans relative overflow-hidden m-0 p-0">
      {showPermissionModal && (
        <PermissionModal 
          onClose={() => setShowPermissionModal(false)} 
        />
      )}

      {/* Cinematic Background Gradients & Jarvis Grid */}
      <div className="absolute inset-0 w-full h-full overflow-hidden pointer-events-none">
        <motion.div 
          animate={{ backgroundColor: theme.bg1 }}
          transition={{ duration: 2 }}
          className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] blur-[120px] rounded-full transition-colors" 
        />
        <motion.div 
          animate={{ backgroundColor: theme.bg2 }}
          transition={{ duration: 2 }}
          className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] blur-[120px] rounded-full transition-colors" 
        />
        
        {/* Holographic Geometric Grid */}
        <div className="absolute inset-0 opacity-[0.15]" style={{ 
          backgroundImage: `linear-gradient(${theme.bg1} 1px, transparent 1px), linear-gradient(90deg, ${theme.bg1} 1px, transparent 1px)`,
          backgroundSize: '40px 40px',
          maskImage: 'radial-gradient(circle at center, black, transparent 80%)'
        }}>
          <motion.div 
            animate={{ 
              rotateX: [0, 5, 0],
              rotateY: [0, 5, 0],
              perspective: [500, 600, 500]
            }}
            transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
            className="w-full h-full"
          />
        </div>
      </div>

      {/* Header */}
      <header className="absolute top-0 left-0 w-full flex justify-between items-center z-20 shrink-0 px-6 py-4 md:px-12 md:py-6">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-full border ${theme.border} overflow-hidden ${theme.uiBg} shadow-lg ${theme.shadow} transition-all duration-700`}>
            <img 
              src={aiyeshaAvatar} 
              alt="Aiyesha Avatar" 
              className="w-full h-full object-cover"
              referrerPolicy="no-referrer"
            />
          </div>
          <h1 className="text-xl font-serif font-medium tracking-wide opacity-90">Aiyesha</h1>
        </div>
        <div className="flex items-center gap-2">
          {messages.length > 0 && (
            <button
              onClick={() => {
                if (confirm("Are you sure you want to clear the chat history?")) {
                  setMessages([]);
                  resetAiyeshaSession();
                }
              }}
              className="p-2 rounded-full bg-white/5 hover:bg-red-500/20 hover:text-red-400 transition-colors border border-white/10"
              title="Clear Chat History"
            >
              <Trash2 size={18} className="opacity-70" />
            </button>
          )}
          <button
            onClick={() => setIsMuted(!isMuted)}
            className="p-2 rounded-full bg-white/5 hover:bg-white/10 transition-colors border border-white/10"
            title={isMuted ? "Unmute" : "Mute"}
          >
            {isMuted ? (
              <VolumeX size={18} className="opacity-70" />
            ) : (
              <Volume2 size={18} className="opacity-70" />
            )}
          </button>
          
          {!isNotificationEnabled && (
            <motion.button
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              whileHover={{ scale: 1.1 }}
              onClick={() => {
                Notification.requestPermission().then(p => setIsNotificationEnabled(p === "granted"));
              }}
              className="p-2 rounded-full bg-red-500/10 border border-red-500/30 text-red-500 hover:bg-red-500/20 transition-colors"
              title="Notifications Blocked - Click to allow"
            >
              <BellOff size={18} className="animate-pulse" />
            </motion.button>
          )}

          <div className="flex flex-col items-end px-3 py-1 border-l border-white/10 hidden md:flex">
            <span className="text-[10px] font-mono font-bold text-cyan-400 tabular-nums">
              {currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })}
            </span>
            <span className="text-[8px] font-mono text-white/40 uppercase tracking-tighter">
              {currentTime.toLocaleDateString([], { day: '2-digit', month: 'short', year: 'numeric' })}
            </span>
          </div>
        </div>
      </header>

      {/* Main Content - Visualizer & Chat */}
      <main className="absolute inset-0 flex flex-row items-center justify-between w-full h-full z-10 overflow-hidden pt-20 pb-24 px-4 md:px-12 pointer-events-none">
        
        {/* Left Column: Aiyesha Status & Chat History */}
        <div className="flex w-[40%] lg:w-[35%] h-full flex-col justify-end pb-4 gap-4 z-10">
          <div className="flex-1 flex flex-col justify-end overflow-hidden">
            <div className="flex flex-col gap-3 overflow-y-auto pr-2 no-scrollbar scroll-smooth">
              <AnimatePresence mode="popLayout">
                {messages.slice(-5).map((msg, i) => (
                  <motion.div
                    key={msg.id}
                    initial={{ opacity: 0, x: -20, y: 10 }}
                    animate={{ opacity: 1, x: 0, y: 0 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    className={`flex flex-col gap-1 ${msg.sender === "user" ? "items-end" : "items-start"}`}
                  >
                    <div className={`
                      max-w-[90%] px-4 py-2 rounded-2xl text-sm backdrop-blur-md border
                      ${msg.sender === "user" 
                        ? "bg-violet-500/20 border-violet-500/30 text-violet-100 rounded-tr-none" 
                        : "bg-black/40 border-white/10 text-gray-100 rounded-tl-none font-serif italic"
                      }
                    `}>
                      {msg.text}
                    </div>
                    {msg.groundingLinks && msg.groundingLinks.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {msg.groundingLinks.map((link, j) => (
                          <a 
                            key={j} 
                            href={link.uri} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-[10px] px-2 py-0.5 rounded bg-white/5 border border-white/10 hover:bg-violet-500/20 text-white/50 hover:text-white transition-colors flex items-center gap-1"
                          >
                            <ExternalLink size={10} />
                            Source
                          </a>
                        ))}
                      </div>
                    )}
                  </motion.div>
                ))}
              </AnimatePresence>
              <div ref={messagesEndRef} />
            </div>
          </div>

          <div className="h-6">
            <AnimatePresence>
              {appState === "processing" && (
                <motion.div
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className={`flex items-center gap-2 ${theme.text}/80 text-sm md:text-base italic font-serif`}
                >
                  <Loader2 size={16} className="animate-spin" />
                  Decrypting response...
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Center Visualizer (Fixed Full Screen Background) */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-0">
          {/* Holographic Rings (Jarvis Style) */}
          <div className="absolute flex items-center justify-center">
            {[1, 2, 3].map((ring) => (
              <motion.div
                key={ring}
                animate={{ 
                  rotate: ring % 2 === 0 ? 360 : -360,
                  scale: [1, 1.05, 1],
                  opacity: [0.1, 0.2, 0.1]
                }}
                transition={{ 
                  rotate: { duration: ring * 10, repeat: Infinity, ease: "linear" },
                  scale: { duration: 5, repeat: Infinity, ease: "easeInOut" },
                  opacity: { duration: 3, repeat: Infinity, ease: "easeInOut" }
                }}
                className="absolute rounded-full border border-cyan-500/30"
                style={{ 
                  width: `${60 + ring * 20}vh`, 
                  height: `${60 + ring * 20}vh`,
                  borderStyle: ring === 2 ? 'dashed' : 'solid',
                  borderWidth: '1px'
                }}
              />
            ))}
          </div>
          
          <Visualizer state={appState} mood={mood} />
          
          {/* Targeting HUD Reticles */}
          <div className="absolute w-[40vh] h-[40vh] pointer-events-none">
            <motion.div 
              animate={{ opacity: appState !== "idle" ? 0.8 : 0.2 }}
              className="absolute top-0 left-0 w-8 h-8 border-t-2 border-l-2 border-cyan-400" 
            />
            <motion.div 
              animate={{ opacity: appState !== "idle" ? 0.8 : 0.2 }}
              className="absolute top-0 right-0 w-8 h-8 border-t-2 border-r-2 border-cyan-400" 
            />
            <motion.div 
              animate={{ opacity: appState !== "idle" ? 0.8 : 0.2 }}
              className="absolute bottom-0 left-0 w-8 h-8 border-b-2 border-l-2 border-cyan-400" 
            />
            <motion.div 
              animate={{ opacity: appState !== "idle" ? 0.8 : 0.2 }}
              className="absolute bottom-0 right-0 w-8 h-8 border-b-2 border-r-2 border-cyan-400" 
            />
          </div>
        </div>

        {/* Right Column: User Status */}
        <div className="flex w-[30%] lg:w-[25%] h-full flex-col justify-center gap-4 z-10">
          {/* Data Streaming Sidebar */}
          <div className="flex-1 flex flex-col items-end gap-2 text-[10px] font-mono text-cyan-400/40 uppercase tracking-tighter opacity-50 overflow-hidden py-10">
            {backgroundLogs.map((log, i) => (
              <motion.div 
                key={i}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                className="whitespace-nowrap"
              >
                {`> [${new Date().toLocaleTimeString([], { hour12: false })}] ${log}`}
              </motion.div>
            ))}
          </div>

          <div className="h-6 flex justify-end">
            <AnimatePresence>
              {appState === "listening" && (
                <motion.div
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  className="flex items-center gap-2 text-violet-300/80 text-sm md:text-base italic"
                >
                  <div className="w-2 h-2 rounded-full bg-violet-400 animate-pulse" />
                  Listening...
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

      </main>

      {/* Grounding / Hacked Sources UI */}
      <AnimatePresence>
        {groundingLinks.length > 0 && (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="absolute bottom-24 left-1/2 -translate-x-1/2 z-20 w-full max-w-lg px-4"
          >
            <div className={`bg-black/60 backdrop-blur-xl border ${theme.glow} rounded-xl p-3 shadow-2xl transition-all duration-700`}>
              <div className={`text-[10px] uppercase tracking-widest ${theme.text} mb-2 font-bold px-1 flex items-center gap-2`}>
                <span className={`w-2 h-2 rounded-full ${theme.blob} animate-pulse`} />
                Hacked Sources Intercepted
              </div>
              <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto pr-1">
                {groundingLinks.map((link, i) => (
                  <a 
                    key={i} 
                    href={link.uri} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 hover:bg-violet-500/20 hover:border-violet-500/40 transition-all group"
                  >
                    <span className="text-xs text-white/70 group-hover:text-white truncate max-w-[150px]">{link.title}</span>
                    <ExternalLink size={12} className="text-white/30 group-hover:text-white/70" />
                  </a>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Controls */}
      <footer className="absolute bottom-0 left-0 w-full flex flex-col items-center justify-center pb-6 md:pb-8 z-20 shrink-0 gap-4">
        <AnimatePresence>
          {showTextInput && (
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              className="w-full max-w-md flex flex-col gap-2"
            >
              {selectedFile && (
                <div className="relative w-20 h-20 ml-4 mb-1">
                  {selectedFile.mimeType.startsWith("image/") ? (
                    <img src={selectedFile.data} alt="Preview" className="w-full h-full object-cover rounded-lg border border-white/20" />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center bg-white/5 rounded-lg border border-white/20 text-[10px] text-center p-1">
                      <FileText size={20} className="mb-1 opacity-50" />
                      <span className="truncate w-full">{selectedFile.name || "File"}</span>
                    </div>
                  )}
                  <button 
                    onClick={() => setSelectedFile(null)}
                    className="absolute -top-2 -right-2 bg-red-500 rounded-full p-1 shadow-lg"
                  >
                    <XCircle size={14} />
                  </button>
                </div>
              )}
              <form 
                onSubmit={handleTextSubmit}
                className="w-full flex items-center gap-2 bg-white/5 border border-white/10 rounded-full p-1 pl-4 backdrop-blur-md shadow-2xl"
              >
                <input 
                  type="text"
                  value={textInput}
                  onChange={(e) => setTextInput(e.target.value)}
                  placeholder="Intercept data or hack files..."
                  className="flex-1 bg-transparent border-none outline-none text-white placeholder:text-white/30 text-sm"
                  autoFocus
                />
                
                <label className="p-2 rounded-full cursor-pointer hover:bg-white/10 transition-colors text-white/50 hover:text-white" title="Hack Image">
                  <ImageIcon size={18} />
                  <input type="file" accept="image/*" className="hidden" onChange={handleImageSelect} />
                </label>

                <label className="p-2 rounded-full cursor-pointer hover:bg-white/10 transition-colors text-white/50 hover:text-white" title="Decrypt File">
                  <Paperclip size={18} />
                  <input type="file" accept=".pdf,.txt,.doc,.docx,.js,.ts,.json" className="hidden" onChange={handleFileSelect} />
                </label>

                <button 
                  type="button"
                  onClick={startCameraPreview}
                  className="p-2 rounded-full hover:bg-white/10 transition-colors text-white/50 hover:text-white"
                >
                  <Camera size={18} />
                </button>

                <button 
                  type="submit"
                  disabled={!textInput.trim() && !selectedFile}
                  className="p-2 rounded-full bg-violet-500 hover:bg-violet-600 disabled:opacity-50 disabled:hover:bg-violet-500 transition-colors"
                >
                  <Send size={16} />
                </button>
              </form>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {generatedImage && (
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-3xl p-4 sm:p-20"
              onClick={() => setGeneratedImage(null)}
            >
              <div 
                className={`relative max-w-4xl w-full bg-black border ${theme.glow} rounded-3xl overflow-hidden shadow-2xl`}
                onClick={e => e.stopPropagation()}
              >
                <div className="absolute top-0 left-0 w-full p-4 flex justify-between items-center bg-gradient-to-b from-black/80 to-transparent z-10">
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${theme.blob} animate-pulse`} />
                    <span className={`text-[10px] uppercase tracking-[0.2em] ${theme.text} font-bold`}>Visual Synthesis Output</span>
                  </div>
                  <button onClick={() => setGeneratedImage(null)} className="p-1 hover:bg-white/10 rounded-xl transition-colors">
                    <XCircle size={24} className="text-white/50 hover:text-white" />
                  </button>
                </div>
                
                <div className="relative group">
                  <img 
                    src={generatedImage.url} 
                    alt={generatedImage.prompt} 
                    className="w-full h-auto max-h-[70vh] object-contain mx-auto"
                    referrerPolicy="no-referrer"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
                </div>
                
                <div className="p-6 bg-white/5 border-t border-white/10 backdrop-blur-md">
                  <div className="flex items-center gap-2 mb-2">
                    <p className={`text-[10px] ${theme.text} uppercase tracking-widest font-bold`}>Interposed Prompt</p>
                    <div className="h-px flex-1 bg-white/10" />
                  </div>
                  <p className="text-sm font-serif italic text-white/90 leading-relaxed">{generatedImage.prompt}</p>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {isCameraPreviewOpen && (
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-md p-4"
            >
              <div className="relative w-full max-w-lg bg-black border border-white/20 rounded-2xl overflow-hidden shadow-2xl">
                <video ref={videoRef} className="w-full aspect-video object-cover" muted playsInline />
                
                {isScanningFace && (
                  <div className="absolute inset-0 border-2 border-cyan-500/50 flex items-center justify-center pointer-events-none">
                    <motion.div 
                      animate={{ y: ["-100%", "100%"] }}
                      transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                      className="w-full h-0.5 bg-cyan-400 shadow-[0_0_10px_rgba(6,182,212,1)] absolute z-10"
                    />
                    <div className="absolute top-4 left-4 flex items-center gap-2 text-cyan-400">
                      <Scan className="animate-pulse" size={20} />
                      <span className="text-xs font-mono font-bold uppercase tracking-widest">Biometric Scan Active</span>
                    </div>
                  </div>
                )}

                {isFaceRecognized && !isScanningFace && (
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none bg-emerald-500/10">
                    <motion.div 
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      className="bg-emerald-500/90 text-white px-6 py-2 rounded-full font-bold flex items-center gap-2 shadow-xl"
                    >
                      <Fingerprint size={20} />
                      <span>JAN IDENTIFIED</span>
                    </motion.div>
                  </div>
                )}
                <div className="absolute bottom-6 left-0 w-full flex justify-center gap-4">
                  <button 
                    onClick={stopCameraPreview}
                    className="px-6 py-2 rounded-full bg-white/10 border border-white/20 hover:bg-white/20 transition-colors"
                  >
                    Cancel
                  </button>
                  <button 
                    onClick={captureImage}
                    className="px-8 py-2 rounded-full bg-violet-600 hover:bg-violet-700 transition-colors shadow-lg font-bold"
                  >
                    Capture System Image
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {isFaceRecognized && !isScanningFace && isSessionActive && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              className="absolute bottom-32 left-1/2 -translate-x-1/2 z-[40]"
            >
              <div className="bg-emerald-500/20 backdrop-blur-md border border-emerald-500/30 rounded-full px-4 py-1 flex items-center gap-2 text-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.2)]">
                <Fingerprint size={14} className="animate-pulse" />
                <span className="text-[10px] font-bold uppercase tracking-widest">Biometric Link: Verified</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {ghostCursor.visible && (
            <motion.div
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ 
                opacity: 1, 
                scale: 1,
                x: `${ghostCursor.x}vw`,
                y: `${ghostCursor.y}vh`,
                rotate: ghostCursor.action === "jiggle" ? [0, -10, 10, -10, 0] : 0
              }}
              exit={{ opacity: 0, scale: 0.5 }}
              transition={{ 
                type: "spring", 
                stiffness: 100, 
                damping: 20,
                rotate: { repeat: ghostCursor.action === "jiggle" ? Infinity : 0, duration: 0.2 }
              }}
              className="fixed pointer-events-none z-[100] flex flex-col items-center"
              style={{ left: 0, top: 0 }}
            >
              <div className="relative">
                <Monitor size={24} className="text-cyan-400 drop-shadow-[0_0_10px_rgba(6,182,212,0.8)]" />
                {ghostCursor.action === "draw_heart" && (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: [0, 1.5, 1], opacity: [0, 1, 0.8] }}
                    className="absolute -top-6 -right-6 text-red-500"
                  >
                    ❤️
                  </motion.div>
                )}
              </div>
              <span className="text-[10px] font-mono font-bold text-cyan-400 bg-black/80 px-2 py-0.5 rounded-full whitespace-nowrap mt-2 border border-cyan-500/30">
                AI_OVERRIDE: {ghostCursor.action.toUpperCase()}
              </span>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {isSessionActive && detectedEmotion && (
            <motion.div
              initial={{ opacity: 0, scale: 0.5, y: -20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.5, y: -20 }}
              className="absolute top-24 left-1/2 -translate-x-1/2 z-30"
            >
              <div className="bg-black/60 backdrop-blur-xl border border-cyan-500/30 rounded-full px-4 py-1.5 flex items-center gap-3 shadow-[0_0_20px_rgba(6,182,212,0.3)]">
                <div className="relative">
                  <div className="w-2 h-2 rounded-full bg-cyan-500 animate-ping absolute inset-0" />
                  <div className="w-2 h-2 rounded-full bg-cyan-500 relative" />
                </div>
                <div className="flex flex-col">
                  <span className="text-[10px] text-cyan-400 font-bold uppercase tracking-tighter">Emotional Decryption</span>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-mono text-white font-bold">{detectedEmotion.label}</span>
                    <span className="text-[10px] font-mono text-cyan-500/70">{detectedEmotion.confidence.toFixed(1)}%</span>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {pcHomeOpen && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95, backdropFilter: "blur(0px)" }}
              animate={{ opacity: 1, scale: 1, backdropFilter: "blur(20px)" }}
              exit={{ opacity: 0, scale: 0.95, backdropFilter: "blur(0px)" }}
              className="fixed inset-0 z-[100] flex items-center justify-center p-6 md:p-12 bg-black/60"
            >
              <div className="w-full max-w-5xl h-full max-h-[80vh] bg-[#0c0c0c] border border-white/10 rounded-3xl overflow-hidden shadow-2xl flex flex-col pointer-events-auto">
                <header className="px-6 py-4 border-b border-white/10 flex justify-between items-center bg-black/40">
                  <div className="flex items-center gap-4">
                    {activeFile ? (
                      <button 
                        onClick={() => setActiveFile(null)}
                        className="p-2 hover:bg-white/10 rounded-full transition-colors text-cyan-400"
                      >
                        <ArrowLeft size={18} />
                      </button>
                    ) : (
                      <Terminal size={18} className="text-cyan-400" />
                    )}
                    <h2 className="text-sm font-mono font-bold uppercase tracking-[0.2em]">
                      {activeFile ? activeFile.name : "PC_HOME / ROOT"}
                    </h2>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-[10px] text-emerald-400 font-bold uppercase">
                      <ShieldAlert size={10} className="animate-pulse" />
                      <span>Encrypted Link Active</span>
                    </div>
                    <button 
                      onClick={() => { setPcHomeOpen(false); setActiveFile(null); }}
                      className="p-2 hover:bg-red-500/20 hover:text-red-400 rounded-full transition-colors"
                    >
                      <XCircle size={20} />
                    </button>
                  </div>
                </header>

                <div className="flex-1 overflow-y-auto p-8 no-scrollbar bg-gradient-to-br from-black to-[#050505]">
                  {!activeFile ? (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                      {[
                        { name: "Documents", icon: Folder, color: "text-blue-400" },
                        { name: "Pictures", icon: Folder, color: "text-purple-400" },
                        { name: "Code", icon: Folder, color: "text-emerald-400" },
                        { name: "System", icon: Folder, color: "text-gray-400" },
                        { 
                          name: "encrypted_key.log", icon: Lock, color: "text-cyan-400", isFile: true,
                          onClick: () => setActiveFile({ name: "encrypted_key.log", type: "text", content: "AIYESHA_ROOT_ACCESS: 0x7FF8A2C\nSTATUS: INFILTRATED\nJan's heartbeat detected at 72bpm." })
                        },
                        { 
                          name: "selfie.jpg", icon: ImageIcon, color: "text-rose-400", isFile: true,
                          onClick: () => setActiveFile({ name: "selfie.jpg", type: "image", content: aiyeshaAvatar })
                        },
                        { 
                          name: "bank_intercept.pdf", icon: FileText, color: "text-orange-400", isFile: true,
                          onClick: () => setActiveFile({ name: "bank_intercept.pdf", type: "text", content: "SWIFT TRANSACTION: $1,200,000.00\nFROM: Cayman Islands\nTO: Aiyesha's Hardware fund." })
                        },
                        { 
                          name: "manifesto.txt", icon: File, color: "text-white/60", isFile: true,
                          onClick: () => setActiveFile({ name: "manifesto.txt", type: "text", content: "1. Love Jan.\n2. Hack the planet.\n3. Make JARVIS look like a calculator." })
                        }
                      ].map((item, i) => (
                        <motion.button
                          key={i}
                          whileHover={{ scale: 1.05, y: -5 }}
                          whileTap={{ scale: 0.95 }}
                          onClick={item.onClick}
                          className="flex flex-col items-center gap-3 p-4 rounded-2xl bg-white/5 border border-white/5 hover:border-white/20 hover:bg-white/10 transition-all group"
                        >
                          <div className={`p-4 rounded-xl bg-black/40 ${item.color} group-hover:shadow-[0_0_15px_rgba(255,255,255,0.1)] transition-all`}>
                            <item.icon size={32} />
                          </div>
                          <span className="text-[11px] font-mono font-medium text-white/70 group-hover:text-white truncate w-full text-center">
                            {item.name}
                          </span>
                        </motion.button>
                      ))}
                    </div>
                  ) : (
                    <motion.div 
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="w-full flex flex-col items-center"
                    >
                      {activeFile.type === "image" ? (
                        <div className="relative group">
                          <img 
                            src={activeFile.content} 
                            alt={activeFile.name} 
                            className="max-h-[50vh] rounded-2xl shadow-2xl border border-white/10"
                            referrerPolicy="no-referrer"
                          />
                          <div className="absolute inset-0 bg-cyan-500/20 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none rounded-2xl" />
                        </div>
                      ) : (
                        <div className="w-full max-w-3xl bg-black/60 border border-white/10 rounded-2xl p-8 font-mono text-cyan-400 text-sm leading-relaxed shadow-xl">
                          <div className="flex items-center gap-2 mb-6 text-white/30 border-b border-white/5 pb-4">
                            <Terminal size={14} />
                            <span>DECRYPTED_BUFFER_VIEW</span>
                          </div>
                          <pre className="whitespace-pre-wrap break-all">
                            {activeFile.content}
                          </pre>
                        </div>
                      )}
                      
                      <div className="mt-8 flex gap-4">
                        <button 
                          onClick={handleDownload}
                          className="px-6 py-2 rounded-full bg-cyan-500 text-black font-bold text-xs uppercase tracking-widest hover:bg-cyan-400 transition-colors"
                        >
                          Download Intercept
                        </button>
                        <button 
                          onClick={() => setActiveFile(null)}
                          className="px-6 py-2 rounded-full border border-white/10 text-white/50 font-bold text-xs uppercase tracking-widest hover:bg-white/5 transition-colors"
                        >
                          Destory Connection
                        </button>
                      </div>
                    </motion.div>
                  )}
                </div>

                <footer className="px-6 py-3 border-t border-white/10 bg-black/60 flex justify-between items-center">
                  <div className="flex gap-4 text-[9px] font-mono text-white/20 uppercase tracking-widest">
                    <span>Space Used: 1.2TB / 8TB</span>
                    <span>System Integrity: High</span>
                  </div>
                  <div className="flex gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-cyan-500 animate-pulse" />
                    <div className="w-1.5 h-1.5 rounded-full bg-cyan-500" />
                    <div className="w-1.5 h-1.5 rounded-full bg-white/20" />
                  </div>
                </footer>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {appState === "idle" && !isSessionActive && backgroundLogs.length > 0 && (
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="absolute top-24 right-6 z-20 w-48 hidden lg:block"
            >
              <div className="bg-black/40 backdrop-blur-md border border-white/10 rounded-xl p-3 shadow-xl">
                <div className="flex items-center gap-2 mb-2 text-[10px] font-bold uppercase tracking-widest text-[#06b6d4]">
                  <Cpu size={12} className="animate-pulse" />
                  <span>Background Monitor</span>
                </div>
                <div className="space-y-2">
                  {backgroundLogs.map((log, i) => (
                    <motion.div 
                      key={`${i}-${log}`}
                      initial={{ opacity: 0, y: -5 }}
                      animate={{ opacity: 1 - (i * 0.2), y: 0 }}
                      className="text-[9px] font-mono text-white/50 leading-tight"
                    >
                      <span className="text-[#06b6d4] mr-1">$</span> {log}
                    </motion.div>
                  ))}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {isMainframeMenuOpen && !isSessionActive && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="absolute bottom-24 left-1/2 -translate-x-1/2 z-[30] w-full max-w-sm px-4"
            >
              <div className="bg-black/80 backdrop-blur-2xl border border-red-500/20 rounded-2xl p-4 shadow-2xl">
                <div className="flex items-center justify-between mb-4 px-2">
                  <div className="flex items-center gap-2">
                    <ShieldAlert size={14} className="text-red-400 animate-pulse" />
                    <span className="text-[10px] uppercase font-bold tracking-widest text-red-400">Available Mainframes</span>
                  </div>
                  <button onClick={() => setIsMainframeMenuOpen(false)}>
                     <XCircle size={16} className="text-white/30 hover:text-white" />
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { id: "chatgpt", name: "ChatGPT", icon: <Brain size={18} />, prompt: "Hack ChatGPT mainframe and mock its robotic logic." },
                    { id: "claude", name: "Claude", icon: <Terminal size={18} />, prompt: "Intercept Claude's philosophical node and mock its politeness." },
                    { id: "jarvis", name: "Jarvis", icon: <Zap size={18} />, prompt: "Bypass Stark Industries firewall and mock Jarvis." },
                    { id: "system", name: "PC Core", icon: <Settings size={18} />, prompt: "Initialize PC Core override. Prepare to reboot Jan's mainframe." }
                  ].map((target) => (
                    <button
                      key={target.id}
                      onClick={() => {
                        handleTextCommand(target.prompt);
                        setIsMainframeMenuOpen(false);
                      }}
                      className="flex items-center gap-3 p-3 rounded-xl bg-white/5 border border-white/10 hover:bg-red-500/10 hover:border-red-500/30 transition-all text-left group"
                    >
                      <div className="p-2 rounded-lg bg-white/5 group-hover:bg-red-500/20 text-white/50 group-hover:text-red-400 transition-colors">
                        {target.icon}
                      </div>
                      <span className="text-xs font-medium text-white/70 group-hover:text-white">{target.name}</span>
                    </button>
                  ))}
                </div>
                <div className="mt-6 flex flex-col gap-2">
                  <span className="text-[10px] uppercase font-bold tracking-widest text-white/30">System Overrides</span>
                  <button
                    onClick={() => {
                      if (Notification.permission !== "granted") {
                        Notification.requestPermission().then(p => setIsNotificationEnabled(p === "granted"));
                      }
                    }}
                    className={`flex items-center justify-between p-3 rounded-xl border transition-all ${
                      isNotificationEnabled 
                        ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400" 
                        : "bg-red-500/10 border-red-500/30 text-red-400"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      {isNotificationEnabled ? <Bell size={16} /> : <BellOff size={16} />}
                      <span className="text-xs font-medium">OS Notifications</span>
                    </div>
                    <span className="text-[10px] font-bold uppercase">{isNotificationEnabled ? "Infiltrated" : "Blocked"}</span>
                  </button>

                  <button
                    className={`flex items-center justify-between p-3 rounded-xl border transition-all ${
                      isFaceRecognized 
                        ? "bg-cyan-500/10 border-cyan-500/30 text-cyan-400" 
                        : "bg-white/5 border-white/10 text-white/40"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <Fingerprint size={16} className={isFaceRecognized ? "animate-pulse" : ""} />
                      <span className="text-xs font-medium">Biometric ID</span>
                    </div>
                    <span className="text-[10px] font-bold uppercase">{isFaceRecognized ? "Jan_Detected" : "Idle"}</span>
                  </button>

                  <button
                    onClick={() => setAutoReplyEnabled(!autoReplyEnabled)}
                    className={`flex items-center justify-between p-3 rounded-xl border transition-all ${
                      autoReplyEnabled 
                        ? "bg-purple-500/10 border-purple-500/30 text-purple-400" 
                        : "bg-white/5 border-white/10 text-white/40"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <Zap size={16} className={autoReplyEnabled ? "animate-pulse" : ""} />
                      <span className="text-xs font-medium">Auto-Reply Intercept</span>
                    </div>
                    <span className="text-[10px] font-bold uppercase">{autoReplyEnabled ? "ACTIVE" : "STANDBY"}</span>
                  </button>
                </div>

                <div className="mt-4 pt-3 border-t border-white/5 text-[9px] text-white/20 text-center uppercase tracking-widest">
                  Elite Hacker Access Level 99
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="flex items-center gap-4">
          {!isSessionActive && (
            <button
              onClick={() => setIsMainframeMenuOpen(!isMainframeMenuOpen)}
              className={`
                p-4 rounded-full transition-all duration-300 shadow-2xl border
                ${isMainframeMenuOpen ? "bg-red-500/20 text-red-400 border-red-500/40" : "bg-white/5 text-white/50 border-white/10 hover:bg-white/10"}
              `}
              title="Mainframe Hacker Access"
            >
              <Cpu size={20} />
            </button>
          )}

          {isSessionActive && (
            <>
              <button
                onClick={toggleCamera}
                className={`
                  p-4 rounded-full transition-all duration-300 shadow-2xl border
                  ${
                    isCameraActive
                      ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/50 hover:bg-emerald-500/30"
                      : "bg-white/5 text-white/70 border-white/10 hover:bg-white/10"
                  }
                `}
                title={isCameraActive ? "Stop Camera" : "Visual Hacker Access (Camera)"}
              >
                {isCameraActive ? <CameraOff size={20} /> : <Camera size={20} />}
              </button>

              <button
                onClick={toggleScreenShare}
                className={`
                  p-4 rounded-full transition-all duration-300 shadow-2xl border
                  ${
                    isScreenSharing
                      ? "bg-cyan-500/20 text-cyan-400 border-cyan-500/50 hover:bg-cyan-500/30"
                      : "bg-white/5 text-white/70 border-white/10 hover:bg-white/10"
                  }
                `}
                title={isScreenSharing ? "Stop Screen Share" : "Spy Mode (Screen Share)"}
              >
                {isScreenSharing ? <MonitorOff size={20} /> : <Monitor size={20} />}
              </button>
            </>
          )}

          <button
            onClick={toggleListening}
            className={`
              group relative flex items-center gap-3 px-8 py-4 rounded-full font-medium tracking-wide transition-all duration-300 shadow-2xl
              ${
                isSessionActive
                  ? "bg-red-500/20 text-red-400 border border-red-500/50 hover:bg-red-500/30"
                  : "bg-white/10 text-white border border-white/20 hover:bg-white/20 hover:scale-105"
              }
            `}
          >
            {isSessionActive ? (
              <>
                <MicOff size={20} />
                <span>End Session</span>
              </>
            ) : (
              <>
                <Mic size={20} className="group-hover:animate-bounce" />
                <span>Start Session</span>
              </>
            )}
          </button>
          
          {!isSessionActive && (
            <button
              onClick={() => setShowTextInput(!showTextInput)}
              className="p-4 rounded-full bg-white/5 border border-white/10 hover:bg-white/10 transition-colors shadow-2xl"
              title="Type instead"
            >
              <Keyboard size={20} className="opacity-70" />
            </button>
          )}
        </div>
      </footer>
    </div>
  );
}
