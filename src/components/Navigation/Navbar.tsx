import React, { useState, useEffect, useRef } from 'react';
import { usePlatform } from '../../context/PlatformContext';
import { PageId } from '../../types';
import { CfdLogo } from '../common/CfdLogo';
import { Tooltip } from '../common/Tooltip';
import { motion, AnimatePresence } from 'motion/react';
import { animate, stagger } from 'animejs';
import {
  Globe,
  LayoutDashboard,
  FolderKanban,
  Shapes,
  Settings,
  PlayCircle,
  BarChart3,
  Brain,
  FileSpreadsheet,
  Volume2,
  VolumeX,
  TrendingUp,
  BookOpen,
  ListOrdered,
  FolderArchive,
  Sun,
  Moon,
  Menu,
  X,
  ChevronRight,
  ChevronLeft,
  SlidersHorizontal,
  Flame,
  Compass,
} from 'lucide-react';

export const Navbar: React.FC = () => {
  const {
    page,
    setPage,
    soundEnabled,
    toggleSound,
    activeThemeConfig,
    themeMode,
    toggleThemeMode,
    queue,
    setIsQueueOpen,
    setIsOpenFoamModalOpen,
  } = usePlatform();

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(true);
  const [optimisticPage, setOptimisticPage] = useState<PageId | null>(null);

  const navRef = useRef<HTMLElement>(null);

  useEffect(() => {
    setOptimisticPage(null);
  }, [page]);

  // Initial mount smooth slide-in animation for all left-side elements
  useEffect(() => {
    try {
      animate('.nav-item-slide', {
        x: [-32, 0],
        opacity: [0, 1],
        scale: [0.96, 1],
        duration: 480,
        delay: stagger(26),
        ease: 'outExpo',
      });
      animate('.sidebar-bottom-slide', {
        x: [-28, 0],
        opacity: [0, 1],
        scale: [0.96, 1],
        duration: 440,
        delay: stagger(32, { start: 120 }),
        ease: 'outExpo',
      });
    } catch {}
  }, []);

  const runningJobsCount = queue.filter((j) => j.status === 'running').length;

  const navItems: { id: PageId; label: string; icon: React.FC<{ className?: string }> }[] = [
    { id: 'intro', label: 'Story & Limits', icon: Compass },
    { id: 'landing', label: 'Overview', icon: Globe },
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'projects', label: 'Projects', icon: FolderKanban },
    { id: 'geometry', label: 'Geometry', icon: Shapes },
    { id: 'setup', label: 'Setup', icon: Settings },
    { id: 'runner', label: 'Run', icon: PlayCircle },
    { id: 'sweeps', label: 'Sweeps & Polars', icon: TrendingUp },
    { id: 'results', label: 'Results', icon: BarChart3 },
    { id: 'aerothermal', label: '3D Flow & Heat Lab', icon: Flame },
    { id: 'ai', label: 'AI Analysis', icon: Brain },
    { id: 'reporting', label: 'Reports', icon: FileSpreadsheet },
    { id: 'docs', label: 'Documentation', icon: BookOpen },
  ];

  const handleNavClick = (id: PageId) => {
    setOptimisticPage(id);
    setPage(id);
    setMobileMenuOpen(false);

    try {
      animate(`.nav-item-${id}`, {
        scale: [0.97, 1.02, 1],
        duration: 340,
        ease: 'outExpo',
      });
    } catch {}
  };

  // Bidirectional smooth animation IN (expand) and OUT (collapse) when slide button is pressed
  const handleSlideToggle = () => {
    const nextCollapsed = !isCollapsed;
    setIsCollapsed(nextCollapsed);

    try {
      // Smooth pulse & micro-shift on expand arrow (always staying in greater-than > shape)
      animate('#css-selector-id', {
        scale: [0.9, 1.18, 1],
        x: [0, 4, 0],
        duration: 340,
        ease: 'outExpo',
      });

      if (nextCollapsed) {
        // Animating OUT to compact icon rail
        animate('.nav-item-slide', {
          x: [12, 0],
          scale: [0.94, 1],
          opacity: [0.7, 1],
          duration: 360,
          delay: stagger(16, { from: 'last' }),
          ease: 'outCubic',
        });
        animate('.sidebar-bottom-slide', {
          x: [10, 0],
          scale: [0.94, 1],
          opacity: [0.7, 1],
          duration: 340,
          delay: stagger(20, { from: 'last' }),
          ease: 'outCubic',
        });
      } else {
        // Animating IN to full expanded navigation rail
        animate('.nav-item-slide', {
          x: [-32, 0],
          scale: [0.96, 1],
          opacity: [0.3, 1],
          duration: 440,
          delay: stagger(24),
          ease: 'outExpo',
        });
        animate('.sidebar-bottom-slide', {
          x: [-26, 0],
          scale: [0.96, 1],
          opacity: [0.3, 1],
          duration: 400,
          delay: stagger(28, { start: 70 }),
          ease: 'outExpo',
        });
      }
    } catch {}
  };

  const activePage = optimisticPage || page;

  // Lock body scroll when mobile menu is open
  useEffect(() => {
    if (mobileMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [mobileMenuOpen]);

  // Shared uniform button height & alignment classes so every single element is 100% even in size
  const uniformButtonBase = `w-full h-[38px] min-h-[38px] max-h-[38px] rounded-xl text-xs font-semibold whitespace-nowrap relative cursor-pointer select-none flex items-center ${
    isCollapsed ? 'justify-center px-0' : 'justify-between px-3'
  }`;

  return (
    <>
      {/* 
        LEFT-SIDE NAVIGATION WORKBENCH BAR WITH AEROSPACE GLASSMORPHISM
        All items are 100% uniform in width & height with smooth in-and-out animations
      */}
      <header
        className={`glass-sidebar ${
          isCollapsed ? 'lg:w-20' : 'lg:w-64'
        } lg:h-full lg:flex-col lg:justify-between z-40 shrink-0 sticky top-0 w-full h-14 lg:h-full flex items-center justify-between lg:items-stretch select-none px-3 py-2 sm:px-4 lg:px-0 overflow-hidden`}
      >
        {/* Top: Brand Logo & Title with Smooth Slide In/Out Button */}
        <div
          className={`flex items-center ${
            isCollapsed ? 'lg:flex-col lg:items-center lg:gap-2.5 lg:px-2' : 'justify-between lg:px-3.5'
          } p-2 lg:py-3 lg:border-b border-white/20 dark:border-white/10 bg-transparent shrink-0 w-full lg:w-auto justify-between`}
        >
          {/* Logo: Always visible on mobile; on desktop shows full text when expanded, icon when collapsed */}
          <button
            onClick={() => handleNavClick('landing')}
            className="group text-left transition-transform active:scale-95 flex items-center min-h-[38px] cursor-pointer"
            title="CFD Platform — Home"
            aria-label="CFD Platform Home"
          >
            <div className="lg:hidden">
              <CfdLogo size="sm" showText={true} />
            </div>
            <div className="hidden lg:block">
              <CfdLogo size="sm" showText={!isCollapsed} />
            </div>
          </button>

          {/* Desktop Slide In / Out Toggle Button (Greater-than when minimized, Lesser-than when maximized) */}
          <div className="hidden lg:flex items-center shrink-0">
            <Tooltip
              content={isCollapsed ? 'Extend / Maximize options' : 'Minimize options'}
              position="right"
            >
              <button
                onClick={handleSlideToggle}
                aria-label={isCollapsed ? 'Extend options' : 'Minimize options'}
                title={isCollapsed ? 'Extend options' : 'Minimize options'}
                className="glass-item w-9 h-9 min-h-[36px] min-w-[36px] flex items-center justify-center rounded-xl text-slate-800 dark:text-slate-100 cursor-pointer shadow-xs hover:bg-white/40 transition-colors"
              >
                <div id="css-selector-id" className="flex items-center justify-center">
                  {isCollapsed ? (
                    <ChevronRight className="w-4 h-4 text-slate-800 dark:text-slate-100" />
                  ) : (
                    <ChevronLeft className="w-4 h-4 text-slate-800 dark:text-slate-100" />
                  )}
                </div>
              </button>
            </Tooltip>
          </div>

          {/* Mobile Hamburger Toggle Button (lg:hidden) */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label={mobileMenuOpen ? 'Close Menu' : 'Open Navigation Menu'}
            className="glass-item flex lg:hidden items-center justify-center p-2 min-h-[38px] min-w-[38px] rounded-xl text-slate-800 dark:text-slate-200 cursor-pointer"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>

        {/* Center: Navigation items arranged ONE BY ONE vertically — 100% Even in Size */}
        <div className="hidden lg:flex flex-1 flex-col overflow-hidden min-h-0">
          <AnimatePresence initial={false}>
            {!isCollapsed && (
              <motion.div
                key="nav-header-label"
                initial={{ opacity: 0, x: -10, height: 0 }}
                animate={{ opacity: 1, x: 0, height: 'auto' }}
                exit={{ opacity: 0, x: -10, height: 0 }}
                transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
                className="px-4 pt-2.5 pb-1 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 overflow-hidden whitespace-nowrap"
              >
                Workbench Navigation
              </motion.div>
            )}
          </AnimatePresence>

          <nav
            ref={navRef}
            className="flex-1 flex flex-col gap-1.5 px-3 py-1.5 overflow-y-auto scrollbar-none"
          >
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activePage === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => handleNavClick(item.id)}
                  title={item.label}
                  aria-label={item.label}
                  className={`nav-item-slide nav-item-${item.id} ${uniformButtonBase} ${
                    isActive
                      ? 'glass-item-active font-bold shadow-md'
                      : 'glass-item text-slate-800 dark:text-slate-200 hover:text-slate-950 dark:hover:text-white'
                  }`}
                  style={
                    isActive
                      ? {
                          color: activeThemeConfig.accentColor,
                          borderColor: activeThemeConfig.accentColor,
                        }
                      : {}
                  }
                >
                  <div className={`flex items-center ${isCollapsed ? 'justify-center' : 'gap-2.5 min-w-0 flex-1'}`}>
                    <span className="w-5 h-5 flex items-center justify-center shrink-0">
                      <Icon
                        className={`w-4 h-4 shrink-0 transition-transform duration-200 ${
                          isActive ? 'scale-105' : 'text-slate-700 dark:text-slate-300'
                        }`}
                        style={isActive ? { color: activeThemeConfig.accentColor } : {}}
                      />
                    </span>
                    <AnimatePresence mode="wait" initial={false}>
                      {!isCollapsed && (
                        <motion.span
                          key={`label-${item.id}`}
                          initial={{ opacity: 0, x: -8 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: -8 }}
                          transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
                          className="truncate text-left flex-1"
                        >
                          {item.label}
                        </motion.span>
                      )}
                    </AnimatePresence>
                  </div>

                  {isActive && !isCollapsed && (
                    <motion.span
                      layoutId="activeNavIndicatorVertical"
                      className="w-1.5 h-4 rounded-full shrink-0 ml-2"
                      style={{ backgroundColor: activeThemeConfig.accentColor }}
                      transition={{ type: 'spring', stiffness: 450, damping: 30 }}
                    />
                  )}
                </button>
              );
            })}
            {/* Subtle Divider between Pages and Utility Options */}
            <div className="my-1 border-t border-white/20 dark:border-white/10 shrink-0" />

            {!isCollapsed && (
              <div className="px-1 py-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 overflow-hidden whitespace-nowrap">
                Utilities &amp; Actions
              </div>
            )}

            {/* 1. Simulation Queue Button */}
            <button
              onClick={() => setIsQueueOpen(true)}
              title="Open Simulation Queue & Terminal Logs"
              aria-label="Simulation Queue"
              className={`sidebar-bottom-slide glass-item ${uniformButtonBase} text-slate-800 dark:text-slate-200`}
            >
              <div className={`flex items-center ${isCollapsed ? 'justify-center' : 'gap-2.5 min-w-0 flex-1'}`}>
                <span className="w-5 h-5 flex items-center justify-center shrink-0">
                  <ListOrdered className="w-4 h-4 text-slate-700 dark:text-slate-300" />
                </span>
                <AnimatePresence mode="wait" initial={false}>
                  {!isCollapsed && (
                    <motion.span
                      key="queue-label"
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -8 }}
                      transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
                      className="truncate text-left flex-1"
                    >
                      Queue & Logs
                    </motion.span>
                  )}
                </AnimatePresence>
              </div>
              {!isCollapsed &&
                (runningJobsCount > 0 ? (
                  <span className="w-5 h-5 rounded-full bg-teal-600 text-white text-[10px] flex items-center justify-center font-mono animate-pulse shadow-xs shrink-0">
                    {runningJobsCount}
                  </span>
                ) : (
                  <span className="text-[10px] font-mono text-slate-500 dark:text-slate-400 shrink-0">
                    Idle
                  </span>
                ))}
            </button>

            {/* 2. OpenFOAM Export Quick Button */}
            <button
              onClick={() => setIsOpenFoamModalOpen(true)}
              title="Export Production OpenFOAM Case ZIP"
              aria-label="Export OpenFOAM Case"
              className={`sidebar-bottom-slide glass-item ${uniformButtonBase} text-slate-800 dark:text-slate-200`}
            >
              <div className={`flex items-center ${isCollapsed ? 'justify-center' : 'gap-2.5 min-w-0 flex-1'}`}>
                <span className="w-5 h-5 flex items-center justify-center shrink-0">
                  <FolderArchive className="w-4 h-4 text-teal-600 dark:text-teal-400" />
                </span>
                <AnimatePresence mode="wait" initial={false}>
                  {!isCollapsed && (
                    <motion.span
                      key="export-label"
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -8 }}
                      transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
                      className="truncate text-left flex-1"
                    >
                      Export Case ZIP
                    </motion.span>
                  )}
                </AnimatePresence>
              </div>
              {!isCollapsed && (
                <span className="text-[10px] font-mono text-slate-500 dark:text-slate-400 shrink-0">
                  v2606
                </span>
              )}
            </button>

            {/* 3. Dark / Light Theme Button */}
            <button
              onClick={toggleThemeMode}
              title={themeMode === 'dark' ? 'Switch to Light Theme' : 'Switch to Dark Theme'}
              aria-label="Toggle Theme Mode"
              className={`sidebar-bottom-slide glass-item ${uniformButtonBase} text-slate-800 dark:text-slate-200`}
            >
              <div className={`flex items-center ${isCollapsed ? 'justify-center' : 'gap-2.5 min-w-0 flex-1'}`}>
                <span className="w-5 h-5 flex items-center justify-center shrink-0">
                  {themeMode === 'dark' ? (
                    <Sun className="w-4 h-4 text-amber-400" />
                  ) : (
                    <Moon className="w-4 h-4 text-slate-700" />
                  )}
                </span>
                <AnimatePresence mode="wait" initial={false}>
                  {!isCollapsed && (
                    <motion.span
                      key="theme-label"
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -8 }}
                      transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
                      className="truncate text-left flex-1"
                    >
                      Theme Mode
                    </motion.span>
                  )}
                </AnimatePresence>
              </div>
              {!isCollapsed && (
                <span className="text-[10px] font-mono text-slate-500 dark:text-slate-400 shrink-0">
                  {themeMode === 'dark' ? 'Dark' : 'Light'}
                </span>
              )}
            </button>

            {/* 4. Sound Effects Button */}
            <button
              onClick={toggleSound}
              title={soundEnabled ? 'Sound Effects Enabled' : 'Sound Effects Muted'}
              aria-label="Toggle Sound"
              className={`sidebar-bottom-slide glass-item ${uniformButtonBase} ${
                soundEnabled
                  ? 'text-slate-800 dark:text-slate-200'
                  : 'text-slate-500 dark:text-slate-400'
              }`}
            >
              <div className={`flex items-center ${isCollapsed ? 'justify-center' : 'gap-2.5 min-w-0 flex-1'}`}>
                <span className="w-5 h-5 flex items-center justify-center shrink-0">
                  {soundEnabled ? (
                    <Volume2 className="w-4 h-4 text-teal-600 dark:text-teal-400" />
                  ) : (
                    <VolumeX className="w-4 h-4 text-slate-400" />
                  )}
                </span>
                <AnimatePresence mode="wait" initial={false}>
                  {!isCollapsed && (
                    <motion.span
                      key="sound-label"
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -8 }}
                      transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
                      className="truncate text-left flex-1"
                    >
                      Audio Feedback
                    </motion.span>
                  )}
                </AnimatePresence>
              </div>
              {!isCollapsed && (
                <span
                  className={`text-[10px] font-mono shrink-0 ${
                    soundEnabled ? 'text-teal-600 dark:text-teal-400 font-bold' : 'text-slate-400'
                  }`}
                >
                  {soundEnabled ? 'On' : 'Off'}
                </span>
              )}
            </button>

            {/* 5. Workbench Quick Action CTA */}
            <button
              onClick={() => handleNavClick('runner')}
              title="Launch OpenFOAM Solver"
              aria-label="Launch Solver"
              className={`sidebar-bottom-slide glass-item ${uniformButtonBase} bg-teal-500/20 hover:bg-teal-500/35 border-teal-400/50 text-teal-900 dark:text-teal-100 font-semibold shadow-xs transition-all duration-200 active:scale-95`}
            >
              <div className={`flex items-center ${isCollapsed ? 'justify-center' : 'gap-2.5 min-w-0 flex-1'}`}>
                <span className="w-5 h-5 flex items-center justify-center shrink-0">
                  <PlayCircle className="w-4 h-4 text-teal-600 dark:text-teal-400" />
                </span>
                <AnimatePresence mode="wait" initial={false}>
                  {!isCollapsed && (
                    <motion.span
                      key="solver-label"
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -8 }}
                      transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
                      className="truncate text-left flex-1 font-bold text-teal-900 dark:text-teal-100"
                    >
                      Launch Solver
                    </motion.span>
                  )}
                </AnimatePresence>
              </div>
              {!isCollapsed && (
                <ChevronRight className="w-3.5 h-3.5 text-teal-700 dark:text-teal-300 shrink-0" />
              )}
            </button>
          </nav>
        </div>
      </header>

      {/* Mobile Slide-in Navigation Drawer (arranged one by one on the left with glassmorphism) */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.24, ease: 'easeInOut' }}
              onClick={() => setMobileMenuOpen(false)}
              className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 lg:hidden"
            />

            <motion.div
              initial={{ x: '-100%', opacity: 0.8 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: '-100%', opacity: 0.8 }}
              transition={{ type: 'spring', damping: 28, stiffness: 260 }}
              className="glass-sidebar fixed inset-y-0 left-0 w-[82vw] max-w-xs shadow-2xl z-50 flex flex-col lg:hidden pt-safe pb-safe"
            >
              {/* Drawer Header */}
              <div className="p-4 border-b border-white/40 dark:border-slate-800/60 flex items-center justify-between bg-white/30 dark:bg-slate-950/40 backdrop-blur-md">
                <div className="flex items-center gap-2">
                  <CfdLogo size="sm" showText={true} />
                </div>
                <button
                  onClick={() => setMobileMenuOpen(false)}
                  aria-label="Close navigation drawer"
                  className="glass-item p-2 min-h-[38px] min-w-[38px] flex items-center justify-center rounded-xl text-slate-600 hover:text-slate-900 dark:hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Navigation Links Scrollable List arranged one by one — Uniform Size */}
              <div className="flex-1 overflow-y-auto p-3 space-y-1.5">
                <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider px-3 py-1">
                  Workbench Navigation
                </div>
                {navItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = activePage === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => handleNavClick(item.id)}
                      className={`w-full h-11 min-h-[44px] max-h-[44px] flex items-center justify-between px-3.5 rounded-xl text-sm font-semibold transition-all cursor-pointer ${
                        isActive
                          ? 'glass-item-active font-bold shadow-md'
                          : 'glass-item text-slate-800 dark:text-slate-200'
                      }`}
                      style={
                        isActive
                          ? {
                              color: activeThemeConfig.accentColor,
                              borderColor: activeThemeConfig.accentColor,
                            }
                          : {}
                      }
                    >
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <span className="w-5 h-5 flex items-center justify-center shrink-0">
                          <Icon className="w-4 h-4" />
                        </span>
                        <span className="truncate">{item.label}</span>
                      </div>
                      <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
                    </button>
                  );
                })}

                {/* Additional Quick Controls in Mobile Drawer — Uniform Size */}
                <div className="pt-4 border-t border-white/40 dark:border-slate-800/60 mt-4 space-y-1.5">
                  <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider px-3 py-1">
                    Utilities
                  </div>

                  <button
                    onClick={() => {
                      setMobileMenuOpen(false);
                      setIsQueueOpen(true);
                    }}
                    className="glass-item w-full h-11 min-h-[44px] max-h-[44px] flex items-center justify-between px-3.5 rounded-xl text-sm font-semibold text-slate-800 dark:text-slate-200 cursor-pointer"
                  >
                    <div className="flex items-center gap-3">
                      <span className="w-5 h-5 flex items-center justify-center shrink-0">
                        <ListOrdered className="w-4 h-4 text-teal-600 dark:text-teal-400" />
                      </span>
                      <span>Queue & Logs</span>
                    </div>
                    {runningJobsCount > 0 ? (
                      <span className="w-5 h-5 rounded-full bg-teal-600 text-white text-[11px] flex items-center justify-center font-mono">
                        {runningJobsCount}
                      </span>
                    ) : (
                      <span className="text-xs font-mono text-slate-400">Idle</span>
                    )}
                  </button>

                  <button
                    onClick={() => {
                      setMobileMenuOpen(false);
                      setIsOpenFoamModalOpen(true);
                    }}
                    className="glass-item w-full h-11 min-h-[44px] max-h-[44px] flex items-center justify-between px-3.5 rounded-xl text-sm font-semibold text-slate-800 dark:text-slate-200 cursor-pointer"
                  >
                    <div className="flex items-center gap-3">
                      <span className="w-5 h-5 flex items-center justify-center shrink-0">
                        <FolderArchive className="w-4 h-4 text-teal-600 dark:text-teal-400" />
                      </span>
                      <span>Export Case ZIP</span>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-400" />
                  </button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
};

export default Navbar;
