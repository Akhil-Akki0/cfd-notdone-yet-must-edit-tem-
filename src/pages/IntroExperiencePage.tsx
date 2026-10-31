import React, { useState, useEffect, useRef, useCallback } from 'react';
import { usePlatform } from '../context/PlatformContext';
import { sound } from '../utils/soundEffects';
import {
  ArrowDown,
  ArrowRight,
  Volume2,
  VolumeX,
  Play,
  RotateCcw,
  Sparkles,
  Compass,
  Layers,
  ChevronDown,
  Maximize2
} from 'lucide-react';

const VIDEO_URL = '/videos/robot_clean.mp4';
const FALLBACK_VIDEO_URL = '/videos/robot.mp4';

// Sleek authentic chapters from frount-about-page-done-robot-incomming-
const CHAPTERS = [
  {
    id: 1,
    kicker: 'AI-Powered Fluid Dynamics',
    leadIn: 'Simulate the',
    wordLeft: 'FL',
    wordRight: 'OW',
    name: 'FLOW',
    description:
      'Fifty years of computational fluid physics distilled into real-time neural operators. Simulate boundary layers, turbulent kinetic energy, and pressure fields at supersonic speeds.',
    specs: [
      { label: 'Airspeed', value: 'Mach 0.84' },
      { label: 'Reynolds', value: '4.2 × 10⁶' },
      { label: 'Residual', value: '1.4 × 10⁻⁶' },
    ],
  },
  {
    id: 2,
    kicker: 'Digital Wind Tunnel',
    leadIn: 'Governing the',
    wordLeft: 'AE',
    wordRight: 'RO',
    name: 'AERO',
    description:
      'Industrial boundary layers computed instantaneously through Fourier Neural Operators. Eliminate multi-week wind tunnel prototyping with sub-second aerodynamic polar predictions.',
    specs: [
      { label: 'Lift to Drag', value: 'L/D 18.6' },
      { label: 'Pressure', value: '101.3 kPa' },
      { label: 'Grid Mesh', value: '4.8M Cells' },
    ],
  },
  {
    id: 3,
    kicker: 'Solver Engine',
    leadIn: 'Command the',
    wordLeft: 'WI',
    wordRight: 'ND',
    name: 'WIND',
    description:
      'Turbulence closure accelerated by tensor cores. Predict wake vortex detachment, buffet onset, and pressure drag with empirical aerodynamic validation across high angles of attack.',
    specs: [
      { label: 'Vortex Yaw', value: '14.2° Detached' },
      { label: 'Inference', value: '4.2 ms / Polar' },
      { label: 'Turbulence', value: 'k = 0.85 m²/s²' },
    ],
  },
  {
    id: 4,
    kicker: 'Aerodynamic Workflow',
    leadIn: 'Mastering',
    wordLeft: 'CO',
    wordRight: 'RE',
    name: 'CORE',
    description:
      'An end-to-end aerodynamic pipeline: automated surface mesh healing, boundary condition validation, residual convergence tracking, and instant solver export.',
    specs: [
      { label: 'Standard', value: 'FAA FAR-25' },
      { label: 'Solver', value: 'OpenFOAM' },
      { label: 'Pipeline', value: 'HDF5 / VTK' },
    ],
  },
];

export const IntroExperiencePage: React.FC = () => {
  const { setPage, triggerConfetti } = usePlatform();

  // Scroll Progress (0 to 1 inside the Chapter Track)
  const [scrollProgress, setScrollProgress] = useState<number>(0);
  const [characterXOffset, setCharacterXOffset] = useState<number>(0);
  const [videoSrc, setVideoSrc] = useState<string>(VIDEO_URL);
  const [videoLoaded, setVideoLoaded] = useState<boolean>(false);

  // Limits Section State
  const [isLimitsInView, setIsLimitsInView] = useState<boolean>(false);
  const [isBeyondAnimating, setIsBeyondAnimating] = useState<boolean>(false);
  const [isVanished, setIsVanished] = useState<boolean>(false);
  const [isAudioMuted, setIsAudioMuted] = useState<boolean>(true);
  const [pillExpanded, setPillExpanded] = useState<boolean>(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const targetTimeRef = useRef<number>(0);
  const limitsSectionRef = useRef<HTMLDivElement>(null);
  const pillVideoRef = useRef<HTMLVideoElement | null>(null);

  // Video Scrubbing Synchronized with User Scroll
  const syncVideoTime = useCallback(() => {
    const video = videoRef.current;
    if (video && video.duration && !Number.isNaN(video.duration)) {
      const diff = targetTimeRef.current - video.currentTime;
      if (Math.abs(diff) > 0.015) {
        const vid = video as HTMLVideoElement & { fastSeek?: (time: number) => void };
        if (typeof vid.fastSeek === 'function') {
          try {
            vid.fastSeek(targetTimeRef.current);
          } catch {
            video.currentTime = targetTimeRef.current;
          }
        } else {
          video.currentTime = targetTimeRef.current;
        }
      }
    }
  }, []);

  const handleScroll = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;

    const scrollTop = container.scrollTop;
    const scrollHeight = container.scrollHeight - container.clientHeight;
    if (scrollHeight <= 0) return;

    // First 70% of scroll is dedicated to the 4 chapters
    // Remaining 30% smoothly reveals the LIMITS component
    const totalProgress = Math.max(0, Math.min(1, scrollTop / scrollHeight));

    // Chapter scrub progress (0 to 1 over the first 0.65 of scroll)
    const chapterProg = Math.max(0, Math.min(1, totalProgress / 0.65));
    setScrollProgress(chapterProg);

    const video = videoRef.current;
    if (video && video.duration && !Number.isNaN(video.duration)) {
      targetTimeRef.current = chapterProg * video.duration;
      syncVideoTime();
    }

    // Natural character sway tracking
    const sway = Math.sin(chapterProg * Math.PI * 6) * 14;
    setCharacterXOffset(sway);

    // Limits component enters when past 65% of scroll
    if (totalProgress > 0.62) {
      setIsLimitsInView(true);
      if (!pillExpanded) {
        setTimeout(() => setPillExpanded(true), 250);
      }
    } else {
      setIsLimitsInView(false);
    }
  }, [syncVideoTime, pillExpanded]);

  useEffect(() => {
    let animId: number;
    const loop = () => {
      syncVideoTime();
      animId = requestAnimationFrame(loop);
    };
    animId = requestAnimationFrame(loop);

    return () => cancelAnimationFrame(animId);
  }, [syncVideoTime]);

  // Expand pill on mount if Limits is reached
  useEffect(() => {
    if (isLimitsInView && pillVideoRef.current) {
      pillVideoRef.current.play().catch(() => {});
    }
  }, [isLimitsInView]);

  // Trigger Beyond Limits Launch Sequence
  const triggerBeyondLimits = () => {
    if (isBeyondAnimating) return;
    sound.playStartSimulation();
    setIsBeyondAnimating(true);

    setTimeout(() => {
      setIsVanished(true);
      triggerConfetti();
      // Smoothly navigate to main CFD Platform (Dashboard or 3D Flow Lab)
      setTimeout(() => {
        setPage('landing');
      }, 750);
    }, 700);
  };

  const scrollToLimits = () => {
    sound.playClick();
    if (containerRef.current) {
      const scrollHeight = containerRef.current.scrollHeight - containerRef.current.clientHeight;
      containerRef.current.scrollTo({
        top: scrollHeight,
        behavior: 'smooth',
      });
    }
  };

  const virtualIndex = scrollProgress * (CHAPTERS.length - 1);

  return (
    <div
      ref={containerRef}
      onScroll={handleScroll}
      className="relative w-full h-full text-white select-none overflow-y-auto overflow-x-hidden font-sans bg-black scroll-smooth"
    >
      {/* 
        ======================================================================
        STAGE 1: ROBOT WALK & 4 MONUMENTAL AERODYNAMIC CHAPTERS
        ======================================================================
      */}
      <div className="relative w-full min-h-[340vh]">
        {/* Full-Screen Video Background synchronized with scroll */}
        <video
          ref={videoRef}
          src={videoSrc}
          muted
          playsInline
          preload="auto"
          onError={() => {
            if (videoSrc !== FALLBACK_VIDEO_URL) {
              setVideoSrc(FALLBACK_VIDEO_URL);
            }
          }}
          onLoadedMetadata={() => {
            setVideoLoaded(true);
            handleScroll();
          }}
          className={`fixed inset-0 w-full h-full object-cover pointer-events-none transition-opacity duration-700 ${
            isLimitsInView ? 'opacity-0' : 'opacity-100 z-0'
          }`}
          style={{
            objectPosition: 'center',
          }}
        />

        {/* Fallback dark mesh pattern if video is loading */}
        {!videoLoaded && !isLimitsInView && (
          <div className="fixed inset-0 bg-gradient-to-b from-[#0A0E17] via-[#050811] to-[#0A0E17] pointer-events-none z-0" />
        )}

        {/* Floating Top Header: Skip to Limits & Platform Nav */}
        <div
          className={`fixed top-4 left-6 right-6 z-30 flex items-center justify-between transition-opacity duration-300 ${
            isLimitsInView ? 'opacity-0 pointer-events-none' : 'opacity-100'
          }`}
        >
          <div className="flex items-center gap-2.5 px-3.5 py-1.5 bg-black/60 backdrop-blur-md border border-white/20 rounded-full">
            <span className="w-2 h-2 rounded-full bg-[#39ff14] animate-pulse" />
            <span className="text-xs font-mono font-semibold tracking-wider text-white/90">
              CDF NEURAL SCROLL ENGINE
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={scrollToLimits}
              className="flex items-center gap-1.5 px-4 py-1.5 bg-white/20 hover:bg-white/30 text-white border border-white/30 rounded-full text-xs font-bold shadow-md backdrop-blur-md transition-all cursor-pointer active:scale-95"
            >
              <span>Scroll to Limits Portal</span>
              <ArrowDown className="w-3.5 h-3.5" />
            </button>

            <button
              onClick={() => {
                sound.playClick();
                setPage('landing');
              }}
              className="px-4 py-1.5 bg-[#0284c7] hover:bg-[#0369a1] text-white rounded-full text-xs font-bold shadow-md transition-all cursor-pointer active:scale-95"
            >
              <span>Workbench</span>
            </button>
          </div>
        </div>

        {/* Chapters Stage (Fixed in viewport, animated by scrollProgress) */}
        <div
          className={`fixed inset-0 pointer-events-none z-10 overflow-hidden transition-opacity duration-500 ${
            isLimitsInView ? 'opacity-0' : 'opacity-100'
          }`}
          aria-label="Aerodynamics Chapters"
        >
          {CHAPTERS.map((ch, idx) => {
            const delta = idx - virtualIndex;
            if (Math.abs(delta) > 1.25) return null;

            const yShiftPercent = delta * 115;
            const opacity = Math.max(0, Math.min(1, 1 - Math.abs(delta) * 1.6));

            return (
              <div
                key={ch.id}
                className="absolute inset-0 pointer-events-none will-change-transform"
                style={{
                  transform: `translateY(${yShiftPercent}%)`,
                  opacity,
                  transition: 'opacity 0.08s linear',
                }}
              >
                {/* Top-Left Lead-in and Kicker */}
                <div className="absolute top-16 sm:top-20 left-6 sm:left-14 flex flex-col items-start drop-shadow-[0_2px_14px_rgba(0,0,0,0.95)]">
                  <span className="text-[11px] sm:text-xs font-mono uppercase tracking-[0.22em] text-[#39ff14] mb-1 font-bold">
                    {ch.kicker}
                  </span>
                  <span className="text-3xl sm:text-5xl md:text-6xl font-serif italic text-white/95 tracking-wide">
                    {ch.leadIn}
                  </span>
                </div>

                {/* Monumental Split Text (FL | OW, AE | RO, WI | ND, CO | RE) */}
                <div className="absolute inset-0 flex items-center justify-center">
                  {/* Left Pair */}
                  <div
                    className="absolute top-1/2 flex items-center justify-end select-none will-change-transform"
                    style={{
                      right: `calc(100% - 47.5% - ${characterXOffset}px)`,
                      transform: 'translateY(-50%)',
                    }}
                  >
                    <span
                      className="text-[96px] sm:text-[160px] md:text-[220px] lg:text-[280px] xl:text-[340px] font-black tracking-[-0.04em] leading-none text-right inline-block text-white"
                      style={{
                        textShadow: '0 4px 35px rgba(0, 0, 0, 0.95), 0 0 60px rgba(255, 255, 255, 0.25)',
                      }}
                    >
                      {ch.wordLeft}
                    </span>
                  </div>

                  {/* Right Pair */}
                  <div
                    className="absolute top-1/2 flex items-center justify-start select-none will-change-transform"
                    style={{
                      left: `calc(67.5% + ${characterXOffset}px)`,
                      transform: 'translateY(-50%)',
                    }}
                  >
                    <span
                      className="text-[96px] sm:text-[160px] md:text-[220px] lg:text-[280px] xl:text-[340px] font-black tracking-[-0.04em] leading-none text-left inline-block text-white"
                      style={{
                        textShadow: '0 4px 35px rgba(0, 0, 0, 0.95), 0 0 60px rgba(255, 255, 255, 0.25)',
                      }}
                    >
                      {ch.wordRight}
                    </span>
                  </div>
                </div>

                {/* Chapter Editorial Information & Technical Specs */}
                <div className="absolute left-6 sm:left-14 bottom-24 sm:bottom-28 max-w-[320px] sm:max-w-md flex flex-col gap-3 drop-shadow-[0_2px_14px_rgba(0,0,0,0.95)]">
                  <p className="text-xs sm:text-[13.5px] leading-relaxed text-white/90 font-normal">
                    {ch.description}
                  </p>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] font-mono">
                    {ch.specs.map((spec, sIdx) => (
                      <div key={sIdx} className="flex items-center gap-1.5">
                        <span className="text-white/50 uppercase tracking-wider">{spec.label}:</span>
                        <span className="text-[#39ff14] font-semibold">{spec.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Bottom Permanent Indicators: Platform Architecture */}
        <div
          className={`fixed bottom-6 left-6 sm:left-14 z-20 max-w-sm pointer-events-none drop-shadow-[0_2px_10px_rgba(0,0,0,0.95)] transition-opacity duration-300 ${
            isLimitsInView ? 'opacity-0' : 'opacity-100'
          }`}
        >
          <span className="text-[11px] font-mono uppercase tracking-widest text-[#39ff14] block font-bold">
            Platform Architecture
          </span>
          <span className="text-xs font-semibold text-white/90 tracking-wide">
            Computer Dynamic Fluids (CDF) · Neural Turbulence Engine
          </span>
        </div>

        {/* Bottom Credits: RIM, AKHIL, Email */}
        <div
          className={`fixed bottom-6 right-6 sm:right-14 z-20 transition-all duration-300 pointer-events-auto ${
            scrollProgress > 0.65 && !isLimitsInView
              ? 'opacity-100 translate-y-0'
              : 'opacity-0 translate-y-2 pointer-events-none'
          }`}
        >
          <div className="flex flex-col gap-1 text-right text-xs font-mono drop-shadow-[0_2px_10px_rgba(0,0,0,0.95)]">
            <div>
              <span className="text-white/50">Website Admin: </span>
              <span className="text-white font-bold tracking-wide">RIM</span>
            </div>
            <div>
              <span className="text-white/50">Website Developer: </span>
              <span className="text-white font-bold tracking-wide">AKHIL</span>
            </div>
            <div>
              <span className="text-white/50">Contact Email: </span>
              <a
                href="mailto:akkeduc01@gmail.com"
                className="text-[#39ff14] hover:underline cursor-pointer"
              >
                akkeduc01@gmail.com
              </a>
            </div>
          </div>
        </div>

        {/* Down Scroll Indicator */}
        {!isLimitsInView && (
          <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-20 flex flex-col items-center gap-1 pointer-events-none animate-bounce">
            <span className="text-[10px] font-mono uppercase tracking-widest text-white/60">
              Scroll Down to Limits Portal
            </span>
            <ChevronDown className="w-4 h-4 text-[#39ff14]" />
          </div>
        )}
      </div>

      {/* 
        ======================================================================
        STAGE 2: LIMITS COMPONENT HERO (from Akhil-Akki0/limits-component-)
        Reveals after scrolling down through the four chapters
        ======================================================================
      */}
      <div
        ref={limitsSectionRef}
        className="relative w-full min-h-[100vh] bg-[#FFFFFF] text-[#1D1D1D] flex flex-col items-center justify-center p-6 transition-all duration-700 overflow-hidden"
      >
        {/* Background Paper Layer with SVG Flowing Lines */}
        <div className="absolute inset-0 bg-[#F2F2F1] pointer-events-none z-0 opacity-85">
          <svg className="w-full h-full opacity-60" viewBox="0 0 1440 900" fill="none" preserveAspectRatio="none">
            <path
              d="M-100 450 C 300 250, 600 650, 1540 350"
              stroke="#B9B9B9"
              strokeWidth="1.5"
              strokeDasharray="4 6"
            />
            <path
              d="M-100 520 C 400 320, 800 680, 1540 420"
              stroke="#CBD5E1"
              strokeWidth="1.2"
            />
            <path
              d="M-100 380 C 250 180, 750 580, 1540 280"
              stroke="#94A3B8"
              strokeWidth="0.8"
            />
          </svg>
        </div>

        {/* Architectural Watermark "GO" */}
        <div
          className={`absolute top-[43%] left-1/2 -translate-x-1/2 -translate-y-1/2 text-[26vw] font-black tracking-[-0.06em] leading-none text-[#1D1D1D] pointer-events-none select-none z-1 transition-all duration-700 ${
            isVanished ? 'opacity-0 -translate-y-[120vh]' : 'opacity-[0.045]'
          }`}
        >
          GO
        </div>

        {/* LIMITS Hero Container: "LI" [Expanding Video Pill] "MITS" */}
        <div
          className={`relative z-10 flex items-center justify-center gap-2 sm:gap-4 select-none transition-all duration-700 ${
            isVanished ? 'opacity-0 -translate-y-[120vh] scale-95' : 'opacity-100 scale-100'
          }`}
        >
          {/* "LI" Text */}
          <span className="text-[13vw] sm:text-[14vw] font-extrabold tracking-[-0.045em] leading-[0.8] text-[#1D1D1D]">
            LI
          </span>

          {/* Expanding Video Portal Pill */}
          <div className="relative flex flex-col items-center shrink-0">
            <div
              onClick={triggerBeyondLimits}
              className={`relative rounded-full overflow-hidden bg-[#D8D3CF] shadow-2xl transition-all duration-700 cursor-pointer hover:scale-[1.02] active:scale-[0.98] ${
                pillExpanded
                  ? 'w-[28vw] sm:w-[32vw] md:w-[26vw] h-[22vw] sm:h-[18vw] md:h-[14vw] border-4 border-[#1D1D1D]'
                  : 'w-4 h-[14vw] border-2 border-[#1D1D1D]'
              }`}
            >
              {/* Internal Video */}
              <video
                ref={pillVideoRef}
                src="/media/metallic-rocket-4k.mp4"
                poster="/media/metallic-rocket-loading.mp4"
                autoPlay
                loop
                muted={isAudioMuted}
                playsInline
                className="absolute inset-0 w-full h-full object-cover"
              />

              {/* Sound Toggle Button inside the Pill */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  sound.playTick();
                  setIsAudioMuted(!isAudioMuted);
                }}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 p-2 bg-black/50 hover:bg-black/75 rounded-full text-white backdrop-blur-md transition-transform hover:scale-110 cursor-pointer z-20"
                title={isAudioMuted ? 'Unmute Audio' : 'Mute Audio'}
              >
                {isAudioMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4 text-[#39ff14]" />}
              </button>

              {/* Glowing Portal Overlay */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent pointer-events-none" />
            </div>

            {/* BEYOND LIMITS CTA Button below the Pill */}
            <button
              onClick={triggerBeyondLimits}
              disabled={isBeyondAnimating}
              className="mt-5 px-6 py-2.5 bg-[#1D1D1D] hover:bg-black text-white rounded-full text-xs sm:text-sm font-semibold tracking-wide shadow-xl flex items-center gap-2 transition-all hover:scale-105 active:scale-95 cursor-pointer z-20"
            >
              <span>BEYOND LIMITS</span>
              <ArrowRight className="w-4 h-4 text-[#39ff14] transition-transform group-hover:translate-x-1" />
            </button>
          </div>

          {/* "MITS" Text */}
          <span className="text-[13vw] sm:text-[14vw] font-extrabold tracking-[-0.045em] leading-[0.8] text-[#1D1D1D]">
            MITS
          </span>
        </div>

        {/* Subtitle & Direct Workbench Entrance */}
        <div
          className={`mt-14 max-w-lg text-center z-10 space-y-3 transition-opacity duration-500 ${
            isVanished ? 'opacity-0' : 'opacity-100'
          }`}
        >
          <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
            Click <strong>BEYOND LIMITS</strong> or the portal above to enter the next-generation Navier-Stokes aerodynamic simulation suite, 3D volumetric flow lab, and OpenFOAM engine.
          </p>

          <div className="flex items-center justify-center gap-3 pt-2">
            <button
              onClick={() => {
                sound.playClick();
                setPage('aerothermal');
              }}
              className="px-4 py-2 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white rounded-xl text-xs font-bold shadow-md transition-all active:scale-95 cursor-pointer"
            >
              <span>Launch 3D Flow Lab</span>
            </button>

            <button
              onClick={() => {
                sound.playClick();
                setPage('landing');
              }}
              className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-900 rounded-xl text-xs font-semibold transition-all cursor-pointer"
            >
              <span>Open CFD Workbench</span>
            </button>
          </div>
        </div>

        {/* Return Button if Launched/Vanished */}
        {isVanished && (
          <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-30">
            <button
              onClick={() => {
                sound.playTick();
                setIsVanished(false);
                setIsBeyondAnimating(false);
              }}
              className="px-5 py-2.5 bg-black text-white rounded-full text-xs font-bold shadow-2xl flex items-center gap-2 cursor-pointer transition-transform hover:scale-105"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Return to Limits Portal</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
