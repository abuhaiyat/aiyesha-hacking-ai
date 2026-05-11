import React, { useEffect, useRef, useMemo } from "react";
import { motion, AnimatePresence } from "motion/react";

export type VisualizerState = "idle" | "listening" | "processing" | "speaking";
export type VisualizerMood = "calm" | "cheeky" | "dramatic" | "technical" | "flirty" | "energetic";

interface VisualizerProps {
  state: VisualizerState;
  mood?: VisualizerMood;
}

// Particle system for the background
const Particles = ({ color, count = 30, speed = 0.5, energetic = false }: { color: string; count?: number; speed?: number; energetic?: boolean }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationFrameId: number;
    let particles: Array<{
      x: number;
      y: number;
      size: number;
      speedX: number;
      speedY: number;
      opacity: number;
      color: string;
      jitter: boolean;
    }> = [];

    const resize = () => {
      if (!canvas) return;
      const parent = canvas.parentElement;
      if (parent) {
        canvas.width = parent.offsetWidth;
        canvas.height = parent.offsetHeight;
      }
    };

    const createParticles = () => {
      particles = [];
      for (let i = 0; i < count; i++) {
        particles.push({
          x: Math.random() * canvas.width,
          y: Math.random() * canvas.height,
          size: Math.random() * 2 + (energetic ? 1 : 0.5),
          speedX: (Math.random() - 0.5) * speed * (energetic ? 2 : 1),
          speedY: (Math.random() - 0.5) * speed * (energetic ? 2 : 1),
          opacity: Math.random() * 0.5 + 0.1,
          color: color,
          jitter: energetic && Math.random() > 0.8,
        });
      }
    };

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      particles.forEach((p) => {
        ctx.fillStyle = p.color;
        ctx.globalAlpha = p.opacity;
        
        if (p.jitter) {
          ctx.beginPath();
          ctx.rect(p.x, p.y, p.size * 2, p.size * 0.5);
          ctx.fill();
        } else {
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          ctx.fill();
        }

        p.x += p.speedX;
        p.y += p.speedY;

        if (p.x < 0) p.x = canvas.width;
        if (p.x > canvas.width) p.x = 0;
        if (p.y < 0) p.y = canvas.height;
        if (p.y > canvas.height) p.y = 0;
      });

      animationFrameId = requestAnimationFrame(draw);
    };

    resize();
    createParticles();
    draw();

    window.addEventListener("resize", resize);
    return () => {
      window.removeEventListener("resize", resize);
      cancelAnimationFrame(animationFrameId);
    };
  }, [color, count, speed, energetic]);

  return <canvas ref={canvasRef} className="absolute inset-0 w-full h-full pointer-events-none" />;
};

export default function Visualizer({ state, mood = "technical" }: VisualizerProps) {
  // Enhanced themes with mood palettes and animation settings
  const theme = useMemo(() => {
    // Base defaults
    let primary = "#06b6d4"; 
    let secondary = "#22d3ee";
    let glow = "rgba(6, 182, 212, 0.3)";
    let particleCount = 30;
    let particleSpeed = 0.5;
    let rotationSpeed = 1;
    let scaleRange = [1, 1.05, 1];
    let energetic = false;
    let blurBase = 150;

    // Mood configuration
    switch (mood) {
      case "cheeky":
      case "energetic":
        primary = "#fbbf24"; // Sassy Yellow/Amber
        secondary = "#ef4444"; // Adding Red accents
        glow = "rgba(251, 191, 36, 0.4)";
        rotationSpeed = 3.0; // Sharp/Fast
        scaleRange = [1, 1.15, 0.9, 1.1, 1]; // Energetic/Jagged
        particleCount = 60;
        particleSpeed = 2.0;
        energetic = true;
        blurBase = 100;
        break;
      case "dramatic":
        primary = "#c084fc"; // Violet
        secondary = "#a855f7";
        glow = "rgba(192, 132, 252, 0.6)";
        rotationSpeed = 1.5;
        scaleRange = [0.8, 1.3, 0.8]; // Large/Exaggerated
        particleCount = 80;
        particleSpeed = 0.8;
        blurBase = 200; // Deep/Dreamy
        break;
      case "calm":
        primary = "#10b981"; // Emerald
        secondary = "#34d399";
        glow = "rgba(16, 185, 129, 0.3)";
        rotationSpeed = 0.4; // Flowing/Slow
        scaleRange = [0.95, 1.05, 0.95]; // Smooth breathing
        particleCount = 20;
        particleSpeed = 0.3;
        break;
      case "flirty":
        primary = "#f43f5e"; // Rose
        secondary = "#fb7185";
        glow = "rgba(244, 63, 94, 0.5)";
        rotationSpeed = 0.8;
        scaleRange = [1, 1.1, 1];
        particleCount = 40;
        particleSpeed = 0.6;
        break;
      case "technical":
      default:
        primary = "#06b6d4";
        secondary = "#22d3ee";
        glow = "rgba(6, 182, 212, 0.3)";
        rotationSpeed = 1.0;
        break;
    }

    // State overrides
    if (state === "listening") {
      particleCount *= 2;
      particleSpeed *= 2;
      rotationSpeed *= 1.5;
    } else if (state === "processing") {
      particleCount *= 3;
      particleSpeed *= 4;
      rotationSpeed *= 3;
    } else if (state === "speaking") {
      particleCount *= 1.5;
      particleSpeed *= 1.5;
    }

    return { primary, secondary, glow, particleCount, particleSpeed, rotationSpeed, scaleRange, energetic, blurBase };
  }, [state, mood]);

  const getRingVariants = (index: number, reverse: boolean = false) => ({
    animate: {
      rotate: reverse ? [-360, 0] : [0, 360],
      scale: state === "speaking" ? theme.scaleRange : 1,
      opacity: state === "idle" ? [0.1, 0.2, 0.1] : [0.3, 0.7, 0.3],
      transition: {
        rotate: {
          duration: Math.max(2, 10 - index * 2) / theme.rotationSpeed,
          repeat: Infinity,
          ease: "linear",
        },
        scale: {
          duration: mood === "energetic" ? 0.4 : 1.2,
          repeat: Infinity,
          ease: mood === "calm" ? "easeInOut" : "anticipate",
        },
        opacity: {
          duration: 2,
          repeat: Infinity,
        }
      },
    },
  });

  return (
    <div className="absolute inset-0 flex items-center justify-center overflow-hidden pointer-events-none z-0">
      {/* Background Particles */}
      <Particles 
        color={theme.primary} 
        count={theme.particleCount} 
        speed={theme.particleSpeed} 
        energetic={theme.energetic}
      />

      {/* Cinematic Ambient Glows */}
      <motion.div
        animate={{
          scale: state === "idle" ? [1, 1.3, 1] : mood === "dramatic" ? [1.5, 3, 1.5] : [1.5, 2, 1.5],
          opacity: state === "idle" ? 0.05 : mood === "dramatic" ? [0.1, 0.3, 0.1] : 0.15,
          backgroundColor: theme.primary,
        }}
        transition={{ duration: mood === "dramatic" ? 8 : 5, repeat: Infinity }}
        className="absolute w-[100%] h-[100%] rounded-full opacity-20"
        style={{ filter: `blur(${theme.blurBase}px)` }}
      />

      {/* HUD Scanner Rings */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        {[...Array(4)].map((_, i) => (
          <motion.div
            key={`hud-ring-${i}`}
            variants={getRingVariants(i, i % 2 !== 0)}
            animate="animate"
            className="absolute rounded-full border flex items-center justify-center"
            style={{
              width: `${40 + i * 15}%`,
              height: `${40 + i * 15}%`,
              color: theme.primary,
              borderColor: theme.primary,
              borderStyle: mood === "energetic" ? "solid" : (i % 2 === 0 ? "dashed" : "dotted"),
              borderWidth: mood === "energetic" ? "4px" : (i === 3 ? "1px" : "2px"),
              filter: `drop-shadow(0 0 8px ${theme.primary})`,
              clipPath: mood === "energetic" && i % 2 === 0 ? "polygon(0% 0%, 100% 0%, 100% 75%, 75% 75%, 75% 100%, 0% 100%)" : "none"
            }}
          >
            {/* Small HUD marker bits */}
            {i === 2 && (
              <div className="absolute top-0 w-4 h-1 bg-current blur-[1px]" />
            )}
            {i === 1 && state === "processing" && (
              <motion.div 
                animate={{ opacity: [1, 0, 1] }}
                transition={{ duration: 0.1, repeat: Infinity }}
                className="absolute right-0 w-1 h-8 bg-current shadow-[0_0_10px_white]"
              />
            )}
          </motion.div>
        ))}
      </div>

      {/* Center Core Interface */}
      <div className="relative flex items-center justify-center w-64 h-64 md:w-80 md:h-80 lg:w-96 lg:h-96">
        
        {/* Orbital Node */}
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ 
            duration: 15 / theme.rotationSpeed, 
            repeat: Infinity, 
            ease: "linear" 
          }}
          className="absolute inset-0"
        >
          <motion.div 
            animate={{ 
              scale: mood === "energetic" ? [1, 2, 1] : mood === "calm" ? [1, 1.2, 1] : [1, 1.5, 1],
              opacity: [0.5, 1, 0.5]
            }}
            transition={{ duration: mood === "energetic" ? 0.2 : 1, repeat: Infinity }}
            className="absolute top-0 left-1/2 -translate-x-1/2 w-4 h-4 rounded-full blur-[2px]"
            style={{ 
              backgroundColor: theme.primary, 
              boxShadow: `0 0 15px ${theme.primary}, 0 0 30px ${theme.primary}` 
            }}
          />
        </motion.div>

        {/* The Brain Core */}
        <motion.div
          animate={{
            scale: state === "speaking" ? theme.scaleRange : [1, 1.05, 1],
            boxShadow: [
              `0 0 40px ${theme.glow}, inset 0 0 20px ${theme.glow}`,
              `0 0 60px ${theme.glow}, inset 0 0 40px ${theme.glow}`,
              `0 0 40px ${theme.glow}, inset 0 0 20px ${theme.glow}`,
            ]
          }}
          transition={{ 
            duration: state === "speaking" ? (mood === "energetic" ? 0.2 : 0.6) : 3, 
            repeat: Infinity 
          }}
          className="relative w-36 h-36 md:w-44 md:h-44 lg:w-52 lg:h-52 rounded-full border-2 flex items-center justify-center backdrop-blur-3xl z-30"
          style={{
            borderColor: theme.primary,
            backgroundColor: "rgba(0,0,0,0.6)",
          }}
        >
          {/* Internal Geometric "Brain" Geometry */}
          <div className="absolute inset-4 rounded-full border border-white/5 overflow-hidden">
             {state === "processing" && (
                <motion.div 
                  initial={{ rotate: 0 }}
                  animate={{ rotate: 360 }}
                  transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
                  className="absolute inset-0 border-2 border-dashed opacity-20"
                  style={{ borderColor: theme.primary }}
                />
             )}
             <div className="absolute inset-0 flex items-center justify-center overflow-hidden">
                <div className="w-[150%] h-[2px] bg-white/10 rotate-45" />
                <div className="w-[150%] h-[2px] bg-white/10 -rotate-45" />
             </div>
          </div>

          {/* AI Persona Interface */}
          <div className="text-center px-4 relative z-10">
            <motion.div
              animate={{ opacity: [0.4, 0.8, 0.4], letterSpacing: ["2px", "4px", "2px"] }}
              transition={{ duration: 3, repeat: Infinity }}
              className="text-[10px] md:text-xs uppercase font-mono mb-2 text-gray-400"
            >
              Matrix.Active
            </motion.div>
            
            <div 
              className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tighter text-white"
              style={{ 
                textShadow: `0 0 10px ${theme.primary}, 0 0 20px ${theme.primary}`,
                fontFamily: "Share Tech Mono, monospace"
              }}
            >
              AIYESHA
            </div>

            <div className="mt-2 flex items-center justify-center gap-1">
              <span className={`w-1 h-3 ${state === 'listening' ? 'animate-pulse' : 'opacity-40'}`} style={{ backgroundColor: theme.primary }} />
              <span className={`w-1 h-5 ${state === 'processing' ? 'animate-bounce' : 'opacity-40'}`} style={{ backgroundColor: theme.primary }} />
              <span className={`w-1 h-3 ${state === 'speaking' ? 'animate-pulse' : 'opacity-40'}`} style={{ backgroundColor: theme.primary }} />
            </div>

            <motion.div
              animate={{ opacity: [0.5, 1, 0.5] }}
              transition={{ duration: 2, repeat: Infinity }}
              className="text-[9px] uppercase tracking-[3px] mt-2 text-gray-300 font-mono"
            >
              {mood} | {state}
            </motion.div>
          </div>

          {/* Scanline Effect */}
          <div className="absolute inset-0 overflow-hidden rounded-full opacity-20 pointer-events-none">
            <motion.div 
               animate={{ y: ["-100%", "100%"] }}
               transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
               className="w-full h-1/2 bg-gradient-to-b from-transparent via-white/30 to-transparent"
            />
          </div>
        </motion.div>
      </div>
    </div>
  );
}
