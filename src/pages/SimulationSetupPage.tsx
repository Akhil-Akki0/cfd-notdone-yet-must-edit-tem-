import React, { useState } from 'react';
import { usePlatform } from '../context/PlatformContext';
import { Tooltip } from '../components/common/Tooltip';
import { CfdLogo } from '../components/common/CfdLogo';
import {
  Settings,
  Wind,
  Gauge,
  Layers,
  Cpu,
  CheckCircle2,
  ArrowRight,
  Flame,
  Droplets,
  Sparkles,
  Info
} from 'lucide-react';
import { sound } from '../utils/soundEffects';

export const SimulationSetupPage: React.FC = () => {
  const {
    projects,
    currentProjectId,
    setCurrentProjectId,
    geometries,
    currentGeometryId,
    setCurrentGeometryId,
    simConfig,
    updateSimConfig,
    setPage,
    createSimulation
  } = usePlatform();

  const [savedSuccess, setSavedSuccess] = useState(false);

  const activeProject = projects.find((p) => p.projectId === currentProjectId) || projects[0];
  const activeGeometry = geometries.find((g) => g.id === currentGeometryId) || geometries[0];

  const handleSave = () => {
    sound.playSave();
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 2000);
  };

  const handleProceedToRunner = () => {
    sound.playStartSimulation();
    // Launch runner
    setPage('runner');
  };

  return (
    <div className="flex-1 overflow-y-auto select-none text-[#0F172A] p-4 sm:p-6 lg:p-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-[#BAE6FD]/70">
        <div className="flex items-center gap-3">
          <CfdLogo size="sm" showText={false} />
          <div>
            <h1 className="text-2xl font-black tracking-tight text-[#0F172A] flex items-center gap-2">
              <span>Simulation Setup</span>
            </h1>
            <p className="text-xs text-[#64748B] mt-0.5">
              Configure boundary conditions, mesh parameters, fluid properties, and numerical solver schemes
            </p>
          </div>
        </div>

        {savedSuccess && (
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-[#ECFDF5] border border-[#A7F3D0] text-[#065F46] rounded-md text-xs font-semibold">
            <CheckCircle2 className="w-4 h-4 text-[#10B981]" />
            <span>Configuration Saved</span>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Case, Geometry & Solver (6 cols) */}
        <div className="lg:col-span-6 space-y-5">
          {/* Section 1: Project & Geometry Linking */}
          <div className="bg-white rounded-xl border border-[#E2E8F0] p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-[#E2E8F0]">
              <div className="flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-[#EFF6FF] text-[#2563EB] flex items-center justify-center font-bold text-xs">
                  1
                </span>
                <h2 className="text-xs font-bold text-[#0F172A] uppercase tracking-wider">
                  Case & Geometry Binding
                </h2>
              </div>
              <Tooltip
                title="CAD Boundary Domain"
                content="Binds the current physical project case to an active watertight surface geometry for computational mesh generation and boundary patch tagging."
                tip="Ensure geometry has 0 non-manifold edges before meshing."
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="font-semibold text-[#475569]">Target Project</label>
                  <Tooltip
                    title="Case Workspace"
                    content="The organizational project folder where simulation state, meshes, and post-processed telemetry are stored."
                  />
                </div>
                <select
                  value={currentProjectId}
                  onChange={(e) => {
                    sound.playTick();
                    setCurrentProjectId(e.target.value);
                  }}
                  className="w-full px-3 py-2 bg-[#F8FAFC] rounded-lg border border-[#CBD5E1] text-[#0F172A] text-xs focus:bg-white focus:border-[#2563EB] focus:outline-none"
                >
                  {projects.map((p) => (
                    <option key={p.projectId} value={p.projectId}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="font-semibold text-[#475569]">Domain CAD Geometry</label>
                  <Tooltip
                    title="Obstacle / Airfoil Surface"
                    content="The 3D surface mesh that represents the physical wall boundary inside the CFD domain."
                  />
                </div>
                <select
                  value={currentGeometryId}
                  onChange={(e) => {
                    sound.playTick();
                    setCurrentGeometryId(e.target.value);
                  }}
                  className="w-full px-3 py-2 bg-[#F8FAFC] rounded-lg border border-[#CBD5E1] text-[#0F172A] text-xs focus:bg-white focus:border-[#2563EB] focus:outline-none"
                >
                  {geometries.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.name} ({g.format})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="p-2.5 bg-[#F8FAFC] rounded-lg border border-[#E2E8F0] text-[11px] text-[#64748B] flex items-center justify-between">
              <span>Bound Mesh: <strong>{activeGeometry.name}</strong></span>
              <span className="font-mono text-[10px] text-[#10B981] bg-white px-2 py-0.5 rounded border border-[#CBD5E1]">
                ✓ Watertight
              </span>
            </div>
          </div>

          {/* Section 2: Solver Selection */}
          <div className="bg-white rounded-xl border border-[#E2E8F0] p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-[#E2E8F0]">
              <div className="flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-[#EFF6FF] text-[#2563EB] flex items-center justify-center font-bold text-xs">
                  2
                </span>
                <h2 className="text-xs font-bold text-[#0F172A] uppercase tracking-wider">
                  CFD Solver Engine Architecture
                </h2>
              </div>
              <Tooltip
                title="Solver Engine Selection"
                content="Select the underlying discretized partial differential equation (PDE) solver based on flow Mach number and thermal coupling."
                tip="Use simpleFoam for low-speed incompressible aerodynamics (Mach < 0.3)."
              />
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs">
              {[
                {
                  id: 'simpleFoam',
                  name: 'OpenFOAM simpleFoam',
                  desc: 'Incompressible RANS (SIMPLE)',
                  tooltip: 'Semi-Implicit Method for Pressure-Linked Equations. Standard for steady-state incompressible turbulent external flows.'
                },
                {
                  id: 'SU2_CFD',
                  name: 'SU2 Transonic CFD',
                  desc: 'Compressible Euler / Navier-Stokes',
                  tooltip: 'Stanford University open-source solver. Optimized for transonic shockwave resolution and aerodynamic shape design.'
                },
                {
                  id: 'rhoSimpleFoam',
                  name: 'rhoSimpleFoam',
                  desc: 'High-speed compressible gas',
                  tooltip: 'Density-based steady solver solving continuity, momentum, and total energy with state equation p = ρ·R·T.'
                },
                {
                  id: 'buoyantSimpleFoam',
                  name: 'buoyantSimpleFoam',
                  desc: 'Conjugate heat transfer & thermal',
                  tooltip: 'Includes gravitational buoyancy terms and energy equation for convective heat transfer.'
                },
              ].map((item) => {
                const isSelected = simConfig.solver === item.id;
                return (
                  <Tooltip
                    key={item.id}
                    title={item.name}
                    content={item.tooltip}
                    className="w-full"
                  >
                    <button
                      onClick={() => updateSimConfig({ solver: item.id as any })}
                      className={`w-full p-3 rounded-lg border text-left transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-[#EFF6FF] border-[#2563EB] text-[#0F172A]'
                          : 'bg-[#F8FAFC] border-[#E2E8F0] text-[#475569] hover:bg-white'
                      }`}
                    >
                      <div className="font-bold text-xs text-[#0F172A]">{item.name}</div>
                      <div className="text-[10px] text-[#64748B] mt-0.5">{item.desc}</div>
                    </button>
                  </Tooltip>
                );
              })}
            </div>
          </div>

          {/* Section 3: Inflow & Boundary Conditions */}
          <div className="bg-white rounded-xl border border-[#E2E8F0] p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-[#E2E8F0]">
              <div className="flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-[#EFF6FF] text-[#2563EB] flex items-center justify-center font-bold text-xs">
                  3
                </span>
                <h2 className="text-xs font-bold text-[#0F172A] uppercase tracking-wider">
                  Inflow & Boundary Conditions
                </h2>
              </div>
              <Tooltip
                title="Boundary Conditions (BCs)"
                content="Specifies values of velocity U, pressure p, and turbulence quantities (k, omega) on all boundary patches of the computational domain."
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="font-semibold text-[#475569]">Inlet Velocity (m/s)</label>
                  <Tooltip
                    title="Freestream Velocity (U_inf)"
                    content="Magnitude of uniform inlet flow. Directly controls dynamic pressure q = 0.5·ρ·U² and Reynolds number."
                    tip="Typical wind tunnel tests run between 15 m/s to 60 m/s."
                  />
                </div>
                <div className="flex items-center">
                  <input
                    type="number"
                    inputMode="decimal"
                    step="0.5"
                    value={simConfig.inletVelocity}
                    onChange={(e) => updateSimConfig({ inletVelocity: Number(e.target.value) })}
                    className="w-full px-3 py-2 bg-[#F8FAFC] rounded-lg border border-[#CBD5E1] text-[#0F172A] font-mono text-xs focus:bg-white focus:border-[#2563EB] focus:outline-none"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="font-semibold text-[#475569]">Inflow Angle α (deg)</label>
                  <Tooltip
                    title="Angle of Attack (AoA)"
                    content="Geometric pitch angle of freestream velocity relative to chordline. Higher α increases lift until flow separation occurs (stall)."
                    tip="Airfoil stall typically begins between 12° to 16°."
                  />
                </div>
                <input
                  type="number"
                  inputMode="decimal"
                  step="0.5"
                  value={simConfig.inletAngle}
                  onChange={(e) => updateSimConfig({ inletAngle: Number(e.target.value) })}
                  className="w-full px-3 py-2 bg-[#F8FAFC] rounded-lg border border-[#CBD5E1] text-[#0F172A] font-mono text-xs focus:bg-white focus:border-[#2563EB] focus:outline-none"
                />
              </div>

              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="font-semibold text-[#475569]">Outlet Gauge Pressure (Pa)</label>
                  <Tooltip
                    title="Fixed Value Pressure Outlet"
                    content="Static backpressure at domain exit. 0 Pa gauge corresponds to standard atmospheric pressure (101,325 Pa absolute)."
                    tip="Zero gradient boundary for velocity (Neumann BC)."
                  />
                </div>
                <input
                  type="number"
                  inputMode="decimal"
                  value={simConfig.outletPressure}
                  onChange={(e) => updateSimConfig({ outletPressure: Number(e.target.value) })}
                  className="w-full px-3 py-2 bg-[#F8FAFC] rounded-lg border border-[#CBD5E1] text-[#0F172A] font-mono text-xs focus:bg-white focus:border-[#2563EB] focus:outline-none"
                />
              </div>

              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="font-semibold text-[#475569]">Wall Treatment</label>
                  <Tooltip
                    title="Wall Boundary Condition"
                    content="No-Slip enforces zero relative velocity at solid surface (U_wall = 0), generating viscous boundary layers. Slip sets normal velocity to zero without shear."
                    tip="No-Slip is mandatory for realistic lift, drag, and skin friction."
                  />
                </div>
                <select
                  value={simConfig.wallCondition}
                  onChange={(e) => updateSimConfig({ wallCondition: e.target.value as any })}
                  className="w-full px-3 py-2 bg-[#F8FAFC] rounded-lg border border-[#CBD5E1] text-[#0F172A] text-xs focus:bg-white focus:border-[#2563EB] focus:outline-none"
                >
                  <option value="no_slip">No-Slip Wall (Standard viscous)</option>
                  <option value="slip">Slip Wall (Euler inviscid)</option>
                  <option value="moving">Moving Wall (Translational)</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Fluid, Mesh & Solver Settings (6 cols) */}
        <div className="lg:col-span-6 space-y-5">
          {/* Section 4: Fluid Properties */}
          <div className="bg-white rounded-xl border border-[#E2E8F0] p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-[#E2E8F0]">
              <div className="flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-[#EFF6FF] text-[#2563EB] flex items-center justify-center font-bold text-xs">
                  4
                </span>
                <h2 className="text-xs font-bold text-[#0F172A] uppercase tracking-wider">
                  Fluid Thermodynamic Medium
                </h2>
              </div>
              <Tooltip
                title="Thermophysical Medium"
                content="Constitutive material laws and transport coefficients. For standard sea-level air at 293.15 K (20°C), density ρ = 1.225 kg/m³ and kinematic viscosity ν = 1.5e-5 m²/s."
                tip="Used directly to calculate the cell Reynolds number Re = U·L/ν."
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="font-semibold text-[#475569]">Density ρ (kg/m³)</label>
                  <Tooltip
                    title="Fluid Density (rho)"
                    content="Mass per unit volume. Controls hydrodynamic inertia and dynamic pressure q = 0.5·ρ·U²."
                  />
                </div>
                <input
                  type="number"
                  inputMode="decimal"
                  step="0.001"
                  value={simConfig.fluid.density}
                  onChange={(e) =>
                    updateSimConfig({
                      fluid: { ...simConfig.fluid, density: Number(e.target.value) },
                    })
                  }
                  className="w-full px-3 py-2 bg-[#F8FAFC] rounded-lg border border-[#CBD5E1] text-[#0F172A] font-mono text-xs focus:bg-white focus:border-[#2563EB] focus:outline-none"
                />
              </div>

              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="font-semibold text-[#475569]">Viscosity ν (m²/s)</label>
                  <Tooltip
                    title="Kinematic Viscosity (nu)"
                    content="Ratio of dynamic viscosity to density (nu = mu/rho). Dictates viscous shear stress and boundary layer thickness."
                    tip="Air at 20°C: ~1.5e-5 m²/s. Water: ~1.0e-6 m²/s."
                  />
                </div>
                <input
                  type="number"
                  inputMode="decimal"
                  step="1e-6"
                  value={simConfig.fluid.viscosity}
                  onChange={(e) =>
                    updateSimConfig({
                      fluid: { ...simConfig.fluid, viscosity: Number(e.target.value) },
                    })
                  }
                  className="w-full px-3 py-2 bg-[#F8FAFC] rounded-lg border border-[#CBD5E1] text-[#0F172A] font-mono text-xs focus:bg-white focus:border-[#2563EB] focus:outline-none"
                />
              </div>

              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="font-semibold text-[#475569]">Static Temperature (K)</label>
                  <Tooltip
                    title="Ambient Temperature (T_inf)"
                    content="Absolute thermodynamic temperature in Kelvin. Sutherland's law relates temperature variations to fluid dynamic viscosity."
                  />
                </div>
                <input
                  type="number"
                  inputMode="decimal"
                  step="0.1"
                  value={simConfig.fluid.temperature}
                  onChange={(e) =>
                    updateSimConfig({
                      fluid: { ...simConfig.fluid, temperature: Number(e.target.value) },
                    })
                  }
                  className="w-full px-3 py-2 bg-[#F8FAFC] rounded-lg border border-[#CBD5E1] text-[#0F172A] font-mono text-xs focus:bg-white focus:border-[#2563EB] focus:outline-none"
                />
              </div>

              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="font-semibold text-[#475569]">Reference Pressure (Pa)</label>
                  <Tooltip
                    title="Operating Pressure (p_ref)"
                    content="Base atmospheric datum pressure. 101,325 Pa = 1 atm. Solver operates on gauge pressure relative to this reference."
                  />
                </div>
                <input
                  type="number"
                  inputMode="decimal"
                  value={simConfig.fluid.pressure}
                  onChange={(e) =>
                    updateSimConfig({
                      fluid: { ...simConfig.fluid, pressure: Number(e.target.value) },
                    })
                  }
                  className="w-full px-3 py-2 bg-[#F8FAFC] rounded-lg border border-[#CBD5E1] text-[#0F172A] font-mono text-xs focus:bg-white focus:border-[#2563EB] focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* Section 5: Mesh & Boundary Layer Prism Stack */}
          <div className="bg-white rounded-xl border border-[#E2E8F0] p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-[#E2E8F0]">
              <div className="flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-[#EFF6FF] text-[#2563EB] flex items-center justify-center font-bold text-xs">
                  5
                </span>
                <h2 className="text-xs font-bold text-[#0F172A] uppercase tracking-wider">
                  Unstructured Mesh & Boundary Layer
                </h2>
              </div>
              <Tooltip
                title="Prism Boundary Layer Inflation"
                content="Structured prismatic cell layers extruded orthogonal to solid walls to accurately capture steep velocity gradients inside the viscous sublayer (y+ ~ 1) or log-law region (y+ ~ 30-100)."
                tip="High growth rates (>1.25) may degrade convergence near sharp trailing edges."
              />
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="font-semibold text-[#475569] block">
                    Resolution Density
                  </label>
                  <Tooltip
                    title="Spatial Discretization Density"
                    content="Controls the background octree cell refinement level. Finer meshes decrease discretization error at the cost of higher memory and compute time."
                  />
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {(['coarse', 'medium', 'fine', 'ultra_fine'] as const).map((lvl) => (
                    <button
                      key={lvl}
                      onClick={() =>
                        updateSimConfig({
                          mesh: {
                            ...simConfig.mesh,
                            resolution: lvl,
                            estimatedCells:
                              lvl === 'coarse'
                                ? 52000
                                : lvl === 'medium'
                                ? 184500
                                : lvl === 'fine'
                                ? 420000
                                : 890000,
                          },
                        })
                      }
                      className={`py-1.5 px-2 rounded-lg border text-center uppercase font-mono text-[11px] font-semibold transition-colors cursor-pointer ${
                        simConfig.mesh.resolution === lvl
                          ? 'bg-[#EFF6FF] border-[#2563EB] text-[#2563EB]'
                          : 'bg-[#F8FAFC] border-[#CBD5E1] text-[#64748B]'
                      }`}
                    >
                      {lvl.replace('_', ' ')}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <div className="p-2 bg-[#F8FAFC] rounded border border-[#E2E8F0]">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-[#64748B] block">Prism Layers</span>
                    <Tooltip
                      title="Boundary Layer Count"
                      content="Number of anisotropic inflated prism layers stacked normal to the solid wall."
                      tip="Recommend 12-24 layers for high Re external aerodynamics."
                    />
                  </div>
                  <input
                    type="number"
                    inputMode="numeric"
                    min="6"
                    max="36"
                    value={simConfig.mesh.inflationLayers}
                    onChange={(e) =>
                      updateSimConfig({
                        mesh: { ...simConfig.mesh, inflationLayers: Number(e.target.value) },
                      })
                    }
                    className="w-full mt-1 bg-white px-2 py-1 rounded border border-[#CBD5E1] font-mono text-xs font-bold text-[#0F172A]"
                  />
                </div>

                <div className="p-2 bg-[#F8FAFC] rounded border border-[#E2E8F0]">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-[#64748B] block">Growth Rate</span>
                    <Tooltip
                      title="Geometric Expansion Ratio"
                      content="Height ratio between consecutive prism cells: h_(i+1) = h_i * r. Should stay below 1.20 to prevent numerical diffusion."
                    />
                  </div>
                  <input
                    type="number"
                    inputMode="decimal"
                    step="0.02"
                    min="1.05"
                    max="1.35"
                    value={simConfig.mesh.growthRate}
                    onChange={(e) =>
                      updateSimConfig({
                        mesh: { ...simConfig.mesh, growthRate: Number(e.target.value) },
                      })
                    }
                    className="w-full mt-1 bg-white px-2 py-1 rounded border border-[#CBD5E1] font-mono text-xs font-bold text-[#0F172A]"
                  />
                </div>

                <div className="p-2 bg-[#F8FAFC] rounded border border-[#E2E8F0]">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-[#64748B] block">First Cell (mm)</span>
                    <Tooltip
                      title="First Layer Height (y1)"
                      content="Normal distance from wall to first grid point. Determines wall y+ = (u_tau * y) / nu. Aim for y+ < 1 for low-Re wall-resolved models (k-omega SST) or y+ ~ 30-100 for wall functions."
                    />
                  </div>
                  <input
                    type="number"
                    inputMode="decimal"
                    step="0.002"
                    value={simConfig.mesh.firstCellHeightMm}
                    onChange={(e) =>
                      updateSimConfig({
                        mesh: { ...simConfig.mesh, firstCellHeightMm: Number(e.target.value) },
                      })
                    }
                    className="w-full mt-1 bg-white px-2 py-1 rounded border border-[#CBD5E1] font-mono text-xs font-bold text-[#0F172A]"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between p-2 bg-[#EFF6FF] text-[#1E40AF] rounded border border-[#DBEAFE] font-mono text-[11px]">
                <span>Estimated Grid Cells:</span>
                <strong className="text-xs">{simConfig.mesh.estimatedCells.toLocaleString()}</strong>
              </div>
            </div>
          </div>

          {/* Section 6: Solver Controls */}
          <div className="bg-white rounded-xl border border-[#E2E8F0] p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-[#E2E8F0]">
              <div className="flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-[#EFF6FF] text-[#2563EB] flex items-center justify-center font-bold text-xs">
                  6
                </span>
                <h2 className="text-xs font-bold text-[#0F172A] uppercase tracking-wider">
                  Numerical Solver Controls
                </h2>
              </div>
              <Tooltip
                title="Convergence & Stability Parameters"
                content="Governs iteration limits, matrix relaxation factors, and Courant-Friedrichs-Lewy (CFL) limits for pseudo-transient under-relaxation."
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="font-semibold text-[#475569]">Max Iterations</label>
                  <Tooltip
                    title="Maximum Solver Steps"
                    content="Upper limit of SIMPLE pressure-velocity coupling iterations. Solvers terminate early if residuals drop below 1e-5."
                  />
                </div>
                <input
                  type="number"
                  inputMode="numeric"
                  step="100"
                  value={simConfig.solverSettings.maxIterations}
                  onChange={(e) =>
                    updateSimConfig({
                      solverSettings: {
                        ...simConfig.solverSettings,
                        maxIterations: Number(e.target.value),
                      },
                    })
                  }
                  className="w-full px-3 py-2 bg-[#F8FAFC] rounded-lg border border-[#CBD5E1] text-[#0F172A] font-mono text-xs focus:bg-white focus:border-[#2563EB] focus:outline-none"
                />
              </div>

              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="font-semibold text-[#475569]">Courant CFL Number</label>
                  <Tooltip
                    title="Courant-Friedrichs-Lewy (CFL)"
                    content="CFL = (U · Δt) / Δx. For steady implicit SIMPLE solvers, pseudo-time CFL values between 0.5 and 2.0 stabilize matrix diagonal dominance."
                    tip="Lower CFL if residuals diverge or oscillate wildly."
                  />
                </div>
                <input
                  type="number"
                  inputMode="decimal"
                  step="0.05"
                  value={simConfig.solverSettings.cflNumber}
                  onChange={(e) =>
                    updateSimConfig({
                      solverSettings: {
                        ...simConfig.solverSettings,
                        cflNumber: Number(e.target.value),
                      },
                    })
                  }
                  className="w-full px-3 py-2 bg-[#F8FAFC] rounded-lg border border-[#CBD5E1] text-[#0F172A] font-mono text-xs focus:bg-white focus:border-[#2563EB] focus:outline-none"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Action Footer */}
      <div className="pt-4 border-t border-[#E2E8F0] flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <span className="text-xs text-[#64748B] font-mono text-center sm:text-left">
          Ready for OpenFOAM Case Directory & Field Assembly
        </span>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <button
            onClick={handleSave}
            className="min-h-[44px] px-4 py-2 bg-white hover:bg-[#F8FAFC] text-[#0F172A] border border-[#CBD5E1] rounded-lg text-xs font-semibold transition-colors cursor-pointer text-center"
          >
            Save Configuration
          </button>

          <button
            onClick={handleProceedToRunner}
            className="min-h-[44px] px-5 py-2 bg-[#2563EB] hover:bg-[#1D4ED8] text-white rounded-lg text-xs font-semibold shadow-xs transition-all flex items-center justify-center gap-2 active:scale-95 cursor-pointer text-center"
          >
            <span>Launch Simulation Runner</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};
