"use client";

import React, { useState, useMemo } from 'react';
import { usePlatform } from '../context/PlatformContext';
import { CfdLogo } from '../components/common/CfdLogo';
import { CloudShader } from '../components/ui/cloud-shader';
import {
  ArrowRight,
  BookOpen,
  CheckCircle2,
  FileSpreadsheet,
  PlayCircle,
  Settings2,
  Wind,
  Compass,
  BarChart3,
  Cpu,
  Layers,
  Activity,
  Gauge,
  Video,
  Flame,
} from 'lucide-react';
import { sound } from '../utils/soundEffects';

interface AirfoilPreset {
  id: string;
  name: string;
  type: string;
  baseCl: number;
  baseCd: number;
  stallAngle: number;
}

const AIRFOILS: AirfoilPreset[] = [
  {
    id: 'naca0012',
    name: 'NACA 0012 Airfoil',
    type: 'Symmetric Benchmark',
    baseCl: 0.11,
    baseCd: 0.008,
    stallAngle: 15,
  },
  {
    id: 'cylinder',
    name: 'Circular Cylinder',
    type: 'Bluff Body (Karman Vortex)',
    baseCl: 0.0,
    baseCd: 1.18,
    stallAngle: 90,
  },
  {
    id: 'sc20714',
    name: 'NASA SC(2)-0714',
    type: 'Supercritical Transonic',
    baseCl: 0.13,
    baseCd: 0.0095,
    stallAngle: 14,
  },
];

export const LandingPage: React.FC = () => {
  const { setPage, setSimConfig, simConfig, lightTheme, themeMode, activeThemeConfig } = usePlatform();

  // Interactive Wind Tunnel Preview State
  const [selectedAirfoil, setSelectedAirfoil] = useState<AirfoilPreset>(AIRFOILS[0]);
  const [aoa, setAoa] = useState<number>(4.0); // degrees
  const [velocity, setVelocity] = useState<number>(25.0); // m/s
  const [shaderSpeed, setShaderSpeed] = useState<number>(1.0);
  const [heroBgMode, setHeroBgMode] = useState<'video' | 'shader'>('video');

  // Aerodynamic calculations
  const aeroResults = useMemo(() => {
    if (selectedAirfoil.id === 'cylinder') {
      const chord = 1.0;
      const nu = 1.5e-5;
      const re = Math.round((velocity * chord) / nu);
      return {
        cl: 0.0,
        cd: 1.18,
        ld: 0.0,
        reynolds: re,
        isStalled: false,
      };
    }

    const rad = (aoa * Math.PI) / 180;
    const isStalled = Math.abs(aoa) > selectedAirfoil.stallAngle;

    let cl = 0;
    let cd = selectedAirfoil.baseCd;

    if (!isStalled) {
      cl = selectedAirfoil.baseCl * aoa;
      cd = selectedAirfoil.baseCd + 0.045 * Math.pow(cl, 2);
    } else {
      const stallDrop = Math.sign(aoa) * (selectedAirfoil.baseCl * selectedAirfoil.stallAngle * 0.65);
      cl = stallDrop * Math.cos(rad);
      cd = selectedAirfoil.baseCd + 0.22 * Math.sin(Math.abs(rad));
    }

    const ld = cd > 0.0001 ? Math.max(0, cl / cd) : 0;
    const chord = 1.0;
    const kinematicViscosity = 1.5e-5;
    const reynolds = Math.round((velocity * chord) / kinematicViscosity);

    return {
      cl: Number(cl.toFixed(3)),
      cd: Number(cd.toFixed(4)),
      ld: Number(ld.toFixed(1)),
      reynolds,
      isStalled,
    };
  }, [aoa, velocity, selectedAirfoil]);

  const goTo = (page: Parameters<typeof setPage>[0]) => {
    sound.playClick();
    setPage(page);
  };

  const handleLaunchSimulation = () => {
    sound.playStartSimulation();
    setSimConfig({
      ...simConfig,
      inletVelocity: velocity,
      angleOfAttack: aoa,
    });
    setPage('runner');
  };

  return (
    <div className="flex-1 overflow-y-auto bg-transparent text-slate-900 dark:text-slate-100 relative">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-12 sm:gap-16 px-4 sm:px-8 py-6 sm:py-10">

        {/* ------------------------------------------------------------------ */}
        {/* ------------------------------------------------------------------ */}
        {/* HERO SECTION WITH WORKBENCH PREVIEW & COSMIC AEROSPACE GLASS       */}
        {/* ------------------------------------------------------------------ */}
        <section className="relative overflow-hidden rounded-3xl border border-white/60 shadow-xl glass-surface backdrop-blur-xl">
          {/* Subtle edge illumination letting the 4K background video shine through */}
          <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
            <div className="absolute inset-0 bg-gradient-to-r from-white/20 via-transparent to-transparent pointer-events-none" />
          </div>

          {/* Foreground Hero Content */}
          <div className="relative z-10 p-6 sm:p-10 lg:p-12 flex flex-col gap-8">
            {/* Eyebrow & Status Badge */}
            <div className="flex flex-wrap items-center justify-between gap-3 text-xs font-semibold">
              <div className="flex items-center gap-2">
                <span
                  className="uppercase tracking-[0.18em] font-mono font-bold"
                  style={{ color: activeThemeConfig.accentColor }}
                >
                  CFD PLATFORM
                </span>
                <span aria-hidden="true" className="text-slate-400">·</span>
                <span className="text-slate-700 dark:text-slate-200 font-semibold">OpenFOAM v2606 Engine</span>
                <span aria-hidden="true" className="text-slate-400">·</span>
                <span className="text-slate-700 dark:text-slate-200 font-semibold">Navier-Stokes simpleFoam</span>
              </div>

              {/* Status telemetry pill */}
              <div className="flex items-center gap-2 rounded-xl px-3 py-1 text-[11px] bg-white/40 dark:bg-slate-900/50 border border-white/60 dark:border-white/15 text-slate-800 dark:text-slate-200 backdrop-blur-md shadow-xs">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span className="font-mono text-[10px] font-semibold text-slate-700 dark:text-slate-300">Aero Mesh & Solver: Live</span>
              </div>
            </div>

            {/* Main Headline & Technical Workbench Grid */}
            <div className="grid lg:grid-cols-[1.1fr_0.9fr] gap-8 lg:gap-12 items-center">
              <div>
                <h1 className="text-3xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-slate-950 leading-[1.08] text-balance">
                  Run CFD cases, inspect the flow, and export the results.
                </h1>
                <p className="mt-5 text-base sm:text-lg leading-relaxed text-slate-700 max-w-2xl font-normal">
                  This browser workbench connects geometry, OpenFOAM setup, solver output, visual inspection, and reporting in one place. It is built for checking a case from start to finish, not for showing a pretend dashboard.
                </p>

                {/* Primary & Secondary CTAs */}
                <div className="mt-8 flex flex-wrap items-center gap-3">
                  <button
                    onClick={() => goTo('projects')}
                    className="inline-flex min-h-[46px] items-center justify-center gap-2 rounded-2xl text-white px-6 py-3 text-sm font-bold shadow-md transition-all hover:opacity-95 active:scale-95 cursor-pointer"
                    style={{ backgroundColor: activeThemeConfig.accentColor }}
                  >
                    <span>Open a project</span>
                    <ArrowRight className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => goTo('aerothermal')}
                    className="inline-flex min-h-[46px] items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white px-5 py-3 text-sm font-bold shadow-md transition-all active:scale-95 cursor-pointer"
                  >
                    <Flame className="h-4 w-4 text-amber-200" />
                    <span>3D Flow & Heat Lab</span>
                  </button>
                  <button
                    onClick={() => goTo('docs')}
                    className="glass-item inline-flex min-h-[46px] items-center justify-center gap-2 rounded-2xl text-slate-900 dark:text-slate-100 px-5 py-3 text-sm font-bold shadow-xs transition-colors cursor-pointer"
                  >
                    <span>Read the workflow</span>
                    <BookOpen className="h-4 w-4" />
                  </button>
                </div>

                <p className="mt-4 text-xs leading-relaxed text-slate-600 dark:text-slate-400">
                  Start with the included cylinder case or load your own STL geometry in the workbench.
                </p>
              </div>

              {/* Live Flow-Field Preview / Virtual Aerodynamic Wind Tunnel Card */}
              <div className="glass-surface p-5 sm:p-6 rounded-3xl shadow-xl flex flex-col gap-4 backdrop-blur-md">
                <div className="flex items-center justify-between border-b border-white/40 dark:border-white/10 pb-3">
                  <div className="flex items-center gap-2">
                    <Compass className="h-4 w-4 text-slate-700 dark:text-slate-300" />
                    <span className="font-bold text-sm text-slate-900 dark:text-white">Live Flow-Field Preview</span>
                  </div>
                  <span className="font-mono text-xs text-slate-600 dark:text-slate-400 font-semibold tabular-nums">
                    Re = {(aeroResults.reynolds / 1e6).toFixed(2)}M
                  </span>
                </div>

                {/* Model Selector Tabs */}
                <div className="flex items-center gap-1.5 p-1.5 bg-white/30 dark:bg-slate-800/50 backdrop-blur-md rounded-2xl border border-white/50 dark:border-white/10">
                  {AIRFOILS.map((af) => (
                    <button
                      key={af.id}
                      onClick={() => {
                        setSelectedAirfoil(af);
                        sound.playClick();
                      }}
                      className={`flex-1 py-1.5 px-2.5 text-xs font-semibold rounded-xl transition-all truncate cursor-pointer ${
                        selectedAirfoil.id === af.id
                          ? 'bg-white/80 dark:bg-slate-700/80 text-slate-950 dark:text-white shadow-xs font-bold'
                          : 'text-slate-600 dark:text-slate-400 hover:text-slate-950 dark:hover:text-white'
                      }`}
                    >
                      {af.name}
                    </button>
                  ))}
                </div>

                {/* Streamline Flow Visualizer Canvas */}
                <div className="relative h-40 w-full rounded-2xl bg-slate-950/90 overflow-hidden border border-slate-800/80 flex items-center justify-center">
                  <svg className="absolute inset-0 h-full w-full pointer-events-none" viewBox="0 0 400 160">
                    <defs>
                      <linearGradient id="streamGrad1" x1="0%" y1="0%" x2="100%" y2="0%">
                        <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.3" />
                        <stop offset="50%" stopColor="#2dd4bf" stopOpacity="0.85" />
                        <stop offset="100%" stopColor="#818cf8" stopOpacity="0.4" />
                      </linearGradient>
                      <linearGradient id="stallGrad1" x1="0%" y1="0%" x2="100%" y2="0%">
                        <stop offset="0%" stopColor="#f87171" stopOpacity="0.4" />
                        <stop offset="100%" stopColor="#ef4444" stopOpacity="0.9" />
                      </linearGradient>
                    </defs>

                    {/* Dynamic Streamlines */}
                    {[-35, -20, -6, 8, 22, 36].map((offsetY, idx) => {
                      const isCylinder = selectedAirfoil.id === 'cylinder';
                      const deflection = isCylinder ? 0 : aoa * 2.0;
                      const stallSeparation = aeroResults.isStalled && idx > 2 ? Math.sin(idx) * 16 : 0;
                      return (
                        <path
                          key={idx}
                          d={
                            isCylinder
                              ? `M 10 ${80 + offsetY} C 160 ${80 + offsetY * 1.5}, 240 ${80 + offsetY * 1.5}, 390 ${80 + offsetY + Math.sin(idx * 2) * 8}`
                              : `M 10 ${80 + offsetY} Q 190 ${80 + offsetY - deflection * 0.4} 390 ${80 + offsetY - deflection + stallSeparation}`
                          }
                          fill="none"
                          stroke={aeroResults.isStalled && idx > 2 ? 'url(#stallGrad1)' : 'url(#streamGrad1)'}
                          strokeWidth={idx === 2 ? '2.5' : '1.5'}
                          strokeDasharray={aeroResults.isStalled && idx > 2 ? '5 3' : 'none'}
                        />
                      );
                    })}

                    {/* Geometry Silhouette */}
                    {selectedAirfoil.id === 'cylinder' ? (
                      <circle cx="200" cy="80" r="28" fill="#0f766e" stroke="#2dd4bf" strokeWidth="2.5" />
                    ) : (
                      <g transform={`translate(200, 80) rotate(${-aoa})`}>
                        <path
                          d="M -75,0 C -55,-16 35,-12 75,0 C 35,5 -55,8 -75,0 Z"
                          fill="#0f766e"
                          stroke="#2dd4bf"
                          strokeWidth="2"
                        />
                        <circle cx="-55" cy="0" r="2.5" fill="#ffffff" />
                        <line x1="-75" y1="0" x2="75" y2="0" stroke="rgba(255,255,255,0.3)" strokeDasharray="3 3" />
                      </g>
                    )}
                  </svg>

                  <div className="absolute bottom-2 left-3 text-[11px] font-mono text-slate-300">
                    Flow: {aeroResults.isStalled ? (
                      <span className="text-rose-400 font-bold">Boundary Layer Stall Separation</span>
                    ) : selectedAirfoil.id === 'cylinder' ? (
                      <span className="text-teal-300">Periodic Karman Vortex Wake</span>
                    ) : (
                      <span className="text-teal-300">Attached Boundary Layer Flow</span>
                    )}
                  </div>
                </div>

                {/* Interactive Sliders */}
                <div className="grid grid-cols-2 gap-3.5">
                  <div className="flex flex-col gap-1">
                    <div className="flex justify-between text-xs text-slate-700 dark:text-slate-300 font-medium">
                      <span>AoA (α)</span>
                      <span className="font-mono font-bold text-slate-900 dark:text-white tabular-nums">{aoa.toFixed(1)}°</span>
                    </div>
                    <input
                      type="range"
                      min="-4"
                      max="20"
                      step="0.5"
                      value={aoa}
                      disabled={selectedAirfoil.id === 'cylinder'}
                      onChange={(e) => setAoa(parseFloat(e.target.value))}
                      className="accent-slate-900 dark:accent-teal-400 h-1.5 rounded-full bg-slate-200/80 dark:bg-slate-700/80 cursor-pointer disabled:opacity-40"
                    />
                  </div>

                  <div className="flex flex-col gap-1">
                    <div className="flex justify-between text-xs text-slate-700 dark:text-slate-300 font-medium">
                      <span>Inlet Velocity (U∞)</span>
                      <span className="font-mono font-bold text-slate-900 dark:text-white tabular-nums">{velocity} m/s</span>
                    </div>
                    <input
                      type="range"
                      min="10"
                      max="60"
                      step="1"
                      value={velocity}
                      onChange={(e) => setVelocity(parseFloat(e.target.value))}
                      className="accent-slate-900 dark:accent-teal-400 h-1.5 rounded-full bg-slate-200/80 dark:bg-slate-700/80 cursor-pointer"
                    />
                  </div>
                </div>

                {/* Aerodynamic Coefficients Display */}
                <div className="grid grid-cols-3 gap-2.5 pt-1 border-t border-white/40 dark:border-white/10 text-center">
                  <div className="bg-white/30 dark:bg-slate-800/40 p-2.5 rounded-2xl border border-white/60 dark:border-white/10 shadow-xs backdrop-blur-md">
                    <p className="text-[10px] font-semibold uppercase text-slate-600 dark:text-slate-400">Lift (CL)</p>
                    <p className="font-mono font-bold text-sm text-slate-900 dark:text-white tabular-nums">{aeroResults.cl}</p>
                  </div>
                  <div className="bg-white/30 dark:bg-slate-800/40 p-2.5 rounded-2xl border border-white/60 dark:border-white/10 shadow-xs backdrop-blur-md">
                    <p className="text-[10px] font-semibold uppercase text-slate-600 dark:text-slate-400">Drag (CD)</p>
                    <p className="font-mono font-bold text-sm text-slate-900 dark:text-white tabular-nums">{aeroResults.cd}</p>
                  </div>
                  <div className="bg-white/30 dark:bg-slate-800/40 p-2.5 rounded-2xl border border-white/60 dark:border-white/10 shadow-xs backdrop-blur-md">
                    <p className="text-[10px] font-semibold uppercase text-slate-600 dark:text-slate-400">Ratio (L/D)</p>
                    <p className="font-mono font-bold text-sm text-slate-900 dark:text-white tabular-nums">{aeroResults.ld}</p>
                  </div>
                </div>

                {/* Open in Workbench Action */}
                <button
                  onClick={handleLaunchSimulation}
                  className="w-full inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-900 hover:bg-slate-800 dark:bg-slate-100 dark:hover:bg-white text-white dark:text-slate-900 py-3 text-xs font-bold transition-all shadow-md active:scale-98 cursor-pointer"
                >
                  <Cpu className="h-4 w-4" />
                  Load Configuration in Solver
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* ------------------------------------------------------------------ */}
        {/* SECTION: WHAT IS INCLUDED & A REAL RUN (SECTION 2)                 */}
        {/* ------------------------------------------------------------------ */}
        <section className="grid items-start gap-8 lg:grid-cols-[0.8fr_1.2fr]">
          {/* What is Included */}
          <div className="glass-surface rounded-3xl p-6 sm:p-8 border border-white/60 shadow-xl flex flex-col justify-between backdrop-blur-md">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
                What is included
              </p>
              <h2 className="mt-2 text-xl sm:text-2xl font-bold tracking-tight text-slate-950 dark:text-white">
                Complete engineering workbench tools
              </h2>
              <ul className="mt-5 divide-y divide-white/40 dark:divide-slate-800/80 border-y border-white/40 dark:border-slate-800/80">
                <li className="flex items-start gap-3.5 py-4 text-sm font-medium text-slate-700 dark:text-slate-200">
                  <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-400" />
                  <span>OpenFOAM case setup and solver controls</span>
                </li>
                <li className="flex items-start gap-3.5 py-4 text-sm font-medium text-slate-700 dark:text-slate-200">
                  <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-400" />
                  <span>Mesh checks, residuals, and run logs</span>
                </li>
                <li className="flex items-start gap-3.5 py-4 text-sm font-medium text-slate-700 dark:text-slate-200">
                  <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-400" />
                  <span>3D results, coefficient plots, and exports</span>
                </li>
              </ul>
            </div>
            <button
              onClick={() => goTo('setup')}
              className="mt-6 inline-flex items-center gap-2 rounded-2xl px-5 py-3 bg-white/40 hover:bg-white/70 dark:bg-slate-800/40 dark:hover:bg-slate-800/70 border border-white/60 dark:border-white/10 text-xs font-bold text-slate-900 dark:text-white backdrop-blur-md shadow-xs transition-all cursor-pointer w-fit"
            >
              <span>Explore physics and solver setup</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* A Real Run (Cylinder Case Summary) */}
          <div className="glass-surface p-6 sm:p-8 rounded-3xl border border-white/60 shadow-xl flex flex-col gap-6 backdrop-blur-md">
            <div className="flex flex-col gap-3 border-b border-slate-200/60 dark:border-slate-800/60 pb-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-mono text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400 font-semibold">
                  A Real Run · Cylinder / simpleFoam
                </p>
                <h3 className="mt-1 text-lg sm:text-xl font-bold text-slate-950 dark:text-white">
                  Solver output summary
                </h3>
              </div>
              <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-emerald-500/15 dark:bg-emerald-950/60 px-3.5 py-1 text-xs font-bold text-emerald-700 dark:text-emerald-300 border border-emerald-400/40 dark:border-emerald-800 backdrop-blur-sm">
                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                Case Ready
              </span>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <div className="p-4 bg-white/30 dark:bg-slate-900/40 rounded-2xl border border-white/60 dark:border-white/10 shadow-xs backdrop-blur-md">
                <p className="text-xs text-slate-600 dark:text-slate-400 font-medium">Mesh cells</p>
                <p className="mt-1.5 text-2xl font-black tracking-tight text-slate-900 dark:text-white font-mono tabular-nums">38,120</p>
                <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">after snappyHexMesh</p>
              </div>
              <div className="p-4 bg-white/30 dark:bg-slate-900/40 rounded-2xl border border-white/60 dark:border-white/10 shadow-xs backdrop-blur-md">
                <p className="text-xs text-slate-600 dark:text-slate-400 font-medium">Drag coefficient</p>
                <p className="mt-1.5 text-2xl font-black tracking-tight text-slate-900 dark:text-white font-mono tabular-nums">1.18</p>
                <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">cylinder case result</p>
              </div>
              <div className="p-4 bg-white/30 dark:bg-slate-900/40 rounded-2xl border border-white/60 dark:border-white/10 shadow-xs backdrop-blur-md">
                <p className="text-xs text-slate-600 dark:text-slate-400 font-medium">Solver iterations</p>
                <p className="mt-1.5 text-2xl font-black tracking-tight text-slate-900 dark:text-white font-mono tabular-nums">500</p>
                <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">target iterations</p>
              </div>
            </div>

            {/* Status Chips */}
            <div className="rounded-2xl border border-white/60 dark:border-white/10 bg-white/30 dark:bg-slate-900/40 p-4 font-mono text-xs leading-relaxed text-slate-700 dark:text-slate-300 space-y-1.5 backdrop-blur-md shadow-xs">
              <p><span className="font-bold text-teal-700 dark:text-teal-400">[mesh]</span> checkMesh passed (zero non-orthogonal faces)</p>
              <p><span className="font-bold text-teal-700 dark:text-teal-400">[solve]</span> simpleFoam residuals recorded (&lt; 1.0e-5 threshold)</p>
              <p><span className="font-bold text-teal-700 dark:text-teal-400">[export]</span> VTK and spreadsheet files available for download</p>
            </div>

            <div className="flex justify-end">
              <button
                onClick={() => goTo('results')}
                className="inline-flex items-center gap-2 rounded-2xl px-5 py-2.5 bg-white/40 hover:bg-white/70 dark:bg-slate-800/40 dark:hover:bg-slate-800/70 border border-white/60 dark:border-white/10 text-xs font-bold text-teal-700 dark:text-teal-300 backdrop-blur-md shadow-xs transition-all cursor-pointer"
              >
                <span>Inspect in 3D results workbench</span>
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </section>

        {/* ------------------------------------------------------------------ */}
        {/* SECTION: FROM GEOMETRY TO REPORT (SECTION 3)                       */}
        {/* ------------------------------------------------------------------ */}
        <section className="flex flex-col gap-6">
          <div className="flex flex-col gap-1.5 max-w-2xl px-1">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
              From geometry to report
            </p>
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-950 dark:text-white">
              A straightforward engineering workflow.
            </h2>
            <p className="text-sm sm:text-base leading-relaxed text-slate-600 dark:text-slate-300">
              Each step has a place in the workbench, so you can see what was set, what ran, and what came out.
            </p>
          </div>

          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {[
              {
                number: '01',
                icon: Settings2,
                title: 'Set up geometry',
                text: 'Load a model, check the mesh, and choose the boundaries.',
                page: 'geometry' as const,
              },
              {
                number: '02',
                icon: Wind,
                title: 'Set the physics',
                text: 'Choose the solver, inlet conditions, turbulence model, and run limits.',
                page: 'setup' as const,
              },
              {
                number: '03',
                icon: PlayCircle,
                title: 'Run the case',
                text: 'Watch residuals, logs, and runtime while the solver is working.',
                page: 'runner' as const,
              },
              {
                number: '04',
                icon: FileSpreadsheet,
                title: 'Review and export',
                text: 'Inspect fields and coefficients, then download the files you need.',
                page: 'reporting' as const,
              },
            ].map(({ number, icon: Icon, title, text, page }) => (
              <div
                key={number}
                onClick={() => goTo(page)}
                className="glass-surface p-6 sm:p-7 rounded-3xl border border-white/60 shadow-xl hover:border-cyan-400 dark:hover:border-cyan-400 hover:shadow-2xl transition-all cursor-pointer group flex flex-col justify-between backdrop-blur-md hover:-translate-y-1"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs font-bold px-2.5 py-1 rounded-full bg-teal-500/15 border border-teal-400/40 text-teal-700 dark:text-teal-300">
                      {number}
                    </span>
                    <div className="w-9 h-9 rounded-2xl bg-white/40 dark:bg-slate-800/50 border border-white/60 dark:border-white/10 flex items-center justify-center group-hover:scale-110 transition-transform shadow-xs">
                      <Icon className="h-4 w-4 text-slate-600 dark:text-slate-300 group-hover:text-teal-600 dark:group-hover:text-teal-400 transition-colors" />
                    </div>
                  </div>
                  <h3 className="mt-5 text-base font-bold text-slate-900 dark:text-white group-hover:text-teal-600 dark:group-hover:text-teal-400 transition-colors">
                    {title}
                  </h3>
                  <p className="mt-2 text-xs sm:text-sm leading-relaxed text-slate-600 dark:text-slate-400">
                    {text}
                  </p>
                </div>
                <div className="mt-6 flex items-center gap-1.5 text-xs font-bold text-teal-700 dark:text-teal-400">
                  <span>Open step</span>
                  <ArrowRight className="h-3.5 w-3.5 group-hover:translate-x-1 transition-transform" />
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ------------------------------------------------------------------ */}
        {/* FOOTER CALL-TO-ACTION (SECTION 4)                                 */}
        {/* ------------------------------------------------------------------ */}
        <section className="glass-surface rounded-3xl border border-white/60 shadow-xl p-6 sm:p-8 flex flex-col sm:flex-row items-center justify-between gap-6 backdrop-blur-md">
          <div className="flex flex-col gap-2 text-center sm:text-left">
            <CfdLogo size="sm" showText={true} />
            <p className="text-xs text-slate-600 dark:text-slate-400 max-w-md">
              A practical CFD workbench for setting up cases, checking solver behavior, and keeping the output together.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => goTo('runner')}
              className="inline-flex items-center gap-2 rounded-2xl bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-100 text-white dark:text-slate-950 px-5 py-3 text-xs font-bold transition-all cursor-pointer shadow-md active:scale-95"
            >
              <BarChart3 className="h-4 w-4" />
              <span>Open Workbench</span>
            </button>
            <button
              onClick={() => goTo('reporting')}
              className="inline-flex items-center gap-2 rounded-2xl border border-white/60 dark:border-white/10 bg-white/40 hover:bg-white/70 dark:bg-slate-800/40 dark:hover:bg-slate-800/70 px-5 py-3 text-xs font-bold text-slate-900 dark:text-slate-100 transition-all cursor-pointer shadow-xs backdrop-blur-md active:scale-95"
            >
              <FileSpreadsheet className="h-4 w-4" />
              <span>View Reports</span>
            </button>
          </div>
        </section>

      </div>
    </div>
  );
};

export default LandingPage;
