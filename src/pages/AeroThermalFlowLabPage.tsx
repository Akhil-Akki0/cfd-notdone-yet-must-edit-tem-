import React, { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { usePlatform } from '../context/PlatformContext';
import { CfdLogo } from '../components/common/CfdLogo';
import { parseCadFile, generateSampleGeometry } from '../utils/cadFileParser';
import { meshToStlDataUrl } from '../utils/stl';
import { sound } from '../utils/soundEffects';
import {
  Flame,
  Wind,
  Gauge,
  Layers,
  Upload,
  Play,
  RotateCcw,
  Camera,
  Maximize2,
  ChevronDown,
  ChevronUp,
  Sparkles,
  Sliders,
  Box,
  Eye,
  CheckCircle2,
  AlertCircle,
  Activity,
  Crosshair,
  Compass,
  ArrowRight,
  Download,
  Info
} from 'lucide-react';

export type FlowScalarMode = 'velocity' | 'temperature' | 'stress' | 'vorticity';

interface VoxelPartition {
  id: string;
  label: string;
  dims: string;
  voxelCount: string;
  bounds: { min: [number, number, number]; max: [number, number, number] };
  color: string;
}

const DEFAULT_PARTITIONS: VoxelPartition[] = [
  {
    id: 'part-b',
    label: 'PARTITION B',
    dims: '473 x 352 x 773',
    voxelCount: '128,701,408 VOXELS',
    bounds: { min: [-2.2, -0.6, -2.8], max: [1.8, 1.2, 0.4] },
    color: '#39ff14',
  },
  {
    id: 'part-c',
    label: 'PARTITION C',
    dims: '472 x 214 x 668',
    voxelCount: '67,473,344 VOXELS',
    bounds: { min: [0.2, -0.4, 0.4], max: [3.8, 0.8, 3.2] },
    color: '#39ff14',
  },
  {
    id: 'part-d',
    label: 'PARTITION D',
    dims: '410 x 180 x 590',
    voxelCount: '43,588,800 VOXELS',
    bounds: { min: [2.5, -0.3, 2.2], max: [5.6, 0.7, 4.8] },
    color: '#39ff14',
  },
  {
    id: 'part-a',
    label: 'PARTITION A',
    dims: '384 x 256 x 512',
    voxelCount: '50,331,648 VOXELS',
    bounds: { min: [-4.5, -0.7, -1.8], max: [-1.8, 0.9, 1.8] },
    color: '#39ff14',
  },
];

interface ProbeData {
  x: number;
  y: number;
  z: number;
  velocity: number;
  temperature: number;
  pressure: number;
  shearStress: number;
  regime: string;
}

export const AeroThermalFlowLabPage: React.FC = () => {
  const {
    geometries,
    currentGeometryId,
    setCurrentGeometryId,
    saveGeometry,
    simConfig,
    updateSimConfig,
    setPage,
    triggerConfetti,
  } = usePlatform();

  // Primary visual parameters
  const [scalarMode, setScalarMode] = useState<FlowScalarMode>('temperature');
  const [showWireframe, setShowWireframe] = useState<boolean>(true);
  const [showPartitions, setShowPartitions] = useState<boolean>(true);
  const [showEddyWake, setShowEddyWake] = useState<boolean>(true);
  const [showStreamlines, setShowStreamlines] = useState<boolean>(true);
  const [showNacelleGlow, setShowNacelleGlow] = useState<boolean>(true);

  // Flow Physics parameters
  const [inflowSpeed, setInflowSpeed] = useState<number>(simConfig.inletVelocity || 85); // m/s
  const [aoaDeg, setAoaDeg] = useState<number>(simConfig.inletAngle || 3.5); // degrees
  const [yawDeg, setYawDeg] = useState<number>(0.0); // degrees
  const [ambientTempK, setAmbientTempK] = useState<number>(simConfig.fluid.temperature || 288.15); // Kelvin
  const [wakeIntensity, setWakeIntensity] = useState<number>(1.2);
  const [streamlineCount, setStreamlineCount] = useState<number>(220);

  // Model selection
  const [activeModelType, setActiveModelType] = useState<'airliner' | 'fsae' | 'wing' | 'propeller' | 'custom'>('airliner');
  const [customModelName, setCustomModelName] = useState<string>('Custom Uploaded Mesh');
  const [customMeshGeometry, setCustomMeshGeometry] = useState<THREE.BufferGeometry | null>(null);
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Dock & Inspection HUD
  const [isDockCollapsed, setIsDockCollapsed] = useState<boolean>(false);
  const [activeDockTab, setActiveDockTab] = useState<'visuals' | 'physics' | 'models' | 'probe'>('visuals');
  const [activeProbe, setActiveProbe] = useState<ProbeData | null>({
    x: 0.85,
    y: 0.12,
    z: 1.45,
    velocity: 112.4,
    temperature: 324.6,
    pressure: 98.4,
    shearStress: 14.8,
    regime: 'Transonic Suction Acceleration (Attached BL)',
  });

  const canvasMountRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const modelGroupRef = useRef<THREE.Group | null>(null);
  const wireframeGroupRef = useRef<THREE.Group | null>(null);
  const eddyParticlesRef = useRef<THREE.Points | null>(null);
  const streamlinesRef = useRef<THREE.LineSegments | null>(null);
  const partitionsGroupRef = useRef<THREE.Group | null>(null);
  const probeMarkerRef = useRef<THREE.Mesh | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Derived aerodynamic calculations
  const machNumber = useMemo(() => {
    const speedOfSound = Math.sqrt(1.4 * 287.05 * ambientTempK);
    return Number((inflowSpeed / speedOfSound).toFixed(3));
  }, [inflowSpeed, ambientTempK]);

  const stagnationTempK = useMemo(() => {
    // T0 = T_inf * (1 + 0.5 * (gamma - 1) * r * M^2)
    const recoveryFactor = 0.89; // Turbulent recovery factor
    const stag = ambientTempK * (1 + 0.2 * recoveryFactor * (machNumber ** 2));
    return Number(stag.toFixed(1));
  }, [ambientTempK, machNumber]);

  const dynamicPressurePa = useMemo(() => {
    const rho = 101325 / (287.05 * ambientTempK);
    return Math.round(0.5 * rho * inflowSpeed ** 2);
  }, [inflowSpeed, ambientTempK]);

  // Color mapping utility based on scalar mode
  const getScalarColor = useCallback(
    (normalizedVal: number, mode: FlowScalarMode): THREE.Color => {
      const col = new THREE.Color();
      const clamped = Math.max(0, Math.min(1, normalizedVal));

      if (mode === 'temperature') {
        // Cold ambient (deep blue) -> Attached flow (emerald/cyan) -> Aerothermal heating (yellow/amber) -> Engine/shock core (crimson/white)
        if (clamped < 0.25) {
          col.setRGB(0.1 + clamped * 0.4, 0.4 + clamped * 2.0, 0.95);
        } else if (clamped < 0.55) {
          const t = (clamped - 0.25) / 0.3;
          col.setRGB(0.2 + t * 0.7, 0.9 - t * 0.1, 0.9 - t * 0.8);
        } else if (clamped < 0.82) {
          const t = (clamped - 0.55) / 0.27;
          col.setRGB(0.95 + t * 0.05, 0.8 - t * 0.5, 0.1);
        } else {
          const t = (clamped - 0.82) / 0.18;
          col.setRGB(1.0, 0.3 + t * 0.7, 0.1 + t * 0.85);
        }
      } else if (mode === 'velocity') {
        // Stagnation blue -> green -> yellow -> red -> supersonic magenta
        if (clamped < 0.3) {
          const t = clamped / 0.3;
          col.setRGB(0.05, 0.3 + t * 0.65, 0.9 - t * 0.3);
        } else if (clamped < 0.65) {
          const t = (clamped - 0.3) / 0.35;
          col.setRGB(0.1 + t * 0.85, 0.95, 0.6 - t * 0.55);
        } else if (clamped < 0.88) {
          const t = (clamped - 0.65) / 0.23;
          col.setRGB(0.95, 0.95 - t * 0.65, 0.05);
        } else {
          const t = (clamped - 0.88) / 0.12;
          col.setRGB(1.0, 0.3 - t * 0.2, 0.05 + t * 0.8);
        }
      } else if (mode === 'stress') {
        // Low shear (deep violet) -> medium (cyan) -> high wall shear (neon green / red)
        if (clamped < 0.4) {
          const t = clamped / 0.4;
          col.setRGB(0.3 - t * 0.25, 0.1 + t * 0.75, 0.8 - t * 0.2);
        } else if (clamped < 0.75) {
          const t = (clamped - 0.4) / 0.35;
          col.setRGB(0.05 + t * 0.9, 0.85, 0.6 - t * 0.5);
        } else {
          const t = (clamped - 0.75) / 0.25;
          col.setRGB(0.95 + t * 0.05, 0.85 - t * 0.75, 0.1);
        }
      } else {
        // Vorticity / Q-Criterion: Neon green -> orange -> crimson
        col.setHSL(0.35 - clamped * 0.35, 1.0, 0.5);
      }

      return col;
    },
    []
  );

  // Procedural 3D Commercial Airliner Geometry (matching the user's uploaded photo)
  const buildAirlinerGeometry = useCallback(() => {
    const group = new THREE.Group();
    group.name = 'airliner-model';

    // 1. Fuselage
    const fuselageCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-4.2, 0.0, 0.0), // Nose tip
      new THREE.Vector3(-3.2, 0.15, 0.0),
      new THREE.Vector3(-1.0, 0.32, 0.0),
      new THREE.Vector3(1.5, 0.32, 0.0),
      new THREE.Vector3(3.5, 0.2, 0.0),
      new THREE.Vector3(4.8, 0.45, 0.0), // Tapered tail
    ]);

    const fuselageGeom = new THREE.TubeGeometry(fuselageCurve, 42, 0.52, 28, false);

    // 2. Main Wings (Swept back with supercritical taper)
    const wingShape = new THREE.Shape();
    wingShape.moveTo(0, 0);
    wingShape.lineTo(0.35, 0.08);
    wingShape.lineTo(1.8, 0.06);
    wingShape.lineTo(2.4, 0.0);
    wingShape.lineTo(1.8, -0.06);
    wingShape.lineTo(0.35, -0.08);
    wingShape.closePath();

    // Right Wing
    const rightWingGeom = new THREE.BufferGeometry();
    const wingVerts: number[] = [];
    const wingFaces: number[] = [];
    const spanSteps = 24;
    const chordSteps = 16;
    const halfSpan = 5.2;

    for (let i = 0; i <= spanSteps; i++) {
      const spanFrac = i / spanSteps;
      const z = spanFrac * halfSpan;
      const sweepX = -0.6 + spanFrac * 2.8;
      const dihedralY = -0.15 + spanFrac * 0.35;
      const chord = 1.9 * (1.0 - spanFrac * 0.65);
      const thickness = 0.22 * (1.0 - spanFrac * 0.55);

      for (let j = 0; j <= chordSteps; j++) {
        const theta = (j / chordSteps) * 2 * Math.PI;
        const xOffset = (Math.cos(theta) * 0.5 + 0.5) * chord;
        const yOffset = Math.sin(theta) * thickness * 0.5;
        wingVerts.push(sweepX + xOffset, dihedralY + yOffset, z);
      }
    }

    for (let i = 0; i < spanSteps; i++) {
      for (let j = 0; j < chordSteps; j++) {
        const v0 = i * (chordSteps + 1) + j;
        const v1 = v0 + 1;
        const v2 = (i + 1) * (chordSteps + 1) + j;
        const v3 = v2 + 1;
        wingFaces.push(v0, v2, v1);
        wingFaces.push(v1, v2, v3);
      }
    }

    rightWingGeom.setAttribute('position', new THREE.Float32BufferAttribute(wingVerts, 3));
    rightWingGeom.setIndex(wingFaces);
    rightWingGeom.computeVertexNormals();

    // Left Wing (Mirrored)
    const leftWingGeom = rightWingGeom.clone();
    const lPos = leftWingGeom.attributes.position.array as Float32Array;
    for (let i = 2; i < lPos.length; i += 3) {
      lPos[i] = -lPos[i];
    }
    leftWingGeom.computeVertexNormals();

    // 3. Engine Pylons & Nacelles (Matching the prominent turbofan in the image)
    const nacelleGeom = new THREE.CylinderGeometry(0.48, 0.44, 1.6, 24, 6, true);
    nacelleGeom.rotateZ(Math.PI / 2);

    const spinnerGeom = new THREE.ConeGeometry(0.2, 0.45, 18);
    spinnerGeom.rotateZ(-Math.PI / 2);

    const rightNacelle = new THREE.Mesh(nacelleGeom);
    rightNacelle.position.set(-0.2, -0.45, 1.75);
    const rightSpinner = new THREE.Mesh(spinnerGeom);
    rightSpinner.position.set(-0.85, -0.45, 1.75);

    const leftNacelle = new THREE.Mesh(nacelleGeom.clone());
    leftNacelle.position.set(-0.2, -0.45, -1.75);
    const leftSpinner = new THREE.Mesh(spinnerGeom.clone());
    leftSpinner.position.set(-0.85, -0.45, -1.75);

    // 4. Horizontal and Vertical Stabilizers
    const vStabGeom = new THREE.BoxGeometry(1.6, 1.8, 0.1);
    vStabGeom.translate(3.8, 1.2, 0.0);

    const hStabGeom = new THREE.BoxGeometry(1.2, 0.08, 3.4);
    hStabGeom.translate(4.1, 0.55, 0.0);

    // Combine into a single unified mesh for clean wireframing and raycasting
    const fuselageMesh = new THREE.Mesh(fuselageGeom);
    const rWingMesh = new THREE.Mesh(rightWingGeom);
    const lWingMesh = new THREE.Mesh(leftWingGeom);
    const vStabMesh = new THREE.Mesh(vStabGeom);
    const hStabMesh = new THREE.Mesh(hStabGeom);

    group.add(fuselageMesh);
    group.add(rWingMesh);
    group.add(lWingMesh);
    group.add(rightNacelle);
    group.add(rightSpinner);
    group.add(leftNacelle);
    group.add(leftSpinner);
    group.add(vStabMesh);
    group.add(hStabMesh);

    return group;
  }, []);

  // Update Surface Vertex Colors based on selected Scalar Mode
  const updateSurfaceColors = useCallback(() => {
    if (!modelGroupRef.current) return;

    modelGroupRef.current.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        const geom = child.geometry as THREE.BufferGeometry;
        const pos = geom.attributes.position;
        if (!pos) return;

        const count = pos.count;
        let colorAttr = geom.attributes.color as THREE.BufferAttribute;
        if (!colorAttr || colorAttr.count !== count) {
          colorAttr = new THREE.BufferAttribute(new Float32Array(count * 3), 3);
          geom.setAttribute('color', colorAttr);
        }

        const colors = colorAttr.array as Float32Array;

        for (let i = 0; i < count; i++) {
          const x = pos.getX(i);
          const y = pos.getY(i);
          const z = pos.getZ(i);

          let scalarVal = 0.5;

          if (scalarMode === 'temperature') {
            // High stagnation temp at nose (x < -3.5), engine lip (z around +-1.75, x around -0.8), wing leading edge
            const isNose = Math.max(0, (-x - 2.5) / 2.0);
            const isNacelleLip = Math.max(0, 1.0 - Math.hypot(x - -0.8, Math.abs(z) - 1.75) * 1.5);
            const isWingLead = Math.max(0, 1.0 - (x - (-0.6 + Math.abs(z) * 0.54)) * 1.2);
            const isEngineExhaust = Math.max(0, (x - 0.5) * 1.2) * Math.max(0, 1.0 - Math.abs(Math.abs(z) - 1.75) * 3);

            const heatIntensity = Math.min(
              1.0,
              0.15 + isNose * 0.75 + isNacelleLip * 0.95 + isWingLead * 0.55 + isEngineExhaust * 0.9
            );
            scalarVal = heatIntensity;
          } else if (scalarMode === 'velocity') {
            // Suction peak acceleration on upper wing surface (y > 0)
            const isUpperWing = Math.max(0, y * 2.5);
            const chordExpansion = Math.sin(Math.min(Math.PI, Math.max(0, (x + 2.0) * 0.8)));
            scalarVal = Math.min(1.0, 0.35 + isUpperWing * 0.45 + chordExpansion * 0.25);
          } else if (scalarMode === 'stress') {
            // High shear stress at leading edges and nacelle junctions
            const shear = Math.abs(y) * 2.0 + Math.abs(z) * 0.15;
            scalarVal = Math.min(1.0, Math.max(0.05, shear));
          } else {
            // Vorticity: Wingtips (abs(z) > 4.5) and nacelle wake
            const isWingTip = Math.max(0, (Math.abs(z) - 3.8) / 1.4);
            const isNacelleWake = Math.max(0, x > 0 ? 1.0 - Math.abs(Math.abs(z) - 1.75) * 2.0 : 0);
            scalarVal = Math.min(1.0, isWingTip * 0.85 + isNacelleWake * 0.7);
          }

          const col = getScalarColor(scalarVal, scalarMode);
          colors[i * 3] = col.r;
          colors[i * 3 + 1] = col.g;
          colors[i * 3 + 2] = col.b;
        }

        colorAttr.needsUpdate = true;
      }
    });
  }, [scalarMode, getScalarColor]);

  // Build Volumetric Eddy Particle Cloud (Matching the turbulent wake in the user image)
  const buildVolumetricEddyCloud = useCallback(() => {
    const particleCount = 18000;
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(particleCount * 3);
    const colors = new Float32Array(particleCount * 3);
    const sizes = new Float32Array(particleCount);

    const col = new THREE.Color();

    for (let i = 0; i < particleCount; i++) {
      // Concentrate eddy clouds trailing behind the right wing, nacelle, and flap
      // Just like the prominent wake in the user's reference image
      const wingSide = Math.random() > 0.15 ? 1 : -1; // Heavy focus on the starboard wing as pictured
      const span = 0.8 + Math.random() * 4.4;
      const z = wingSide * span;

      // Trailing distance behind the wing
      const trailDist = Math.random() * 4.5;
      const x = -0.2 + span * 0.52 + trailDist;

      // Turbulent curl expansion
      const curlFreq = 4.2;
      const curlDispY = Math.sin(x * curlFreq + z) * 0.28 * (1 + trailDist * 0.4);
      const curlDispZ = Math.cos(x * curlFreq) * 0.24 * (1 + trailDist * 0.4);
      const y = -0.15 + curlDispY + (Math.random() - 0.5) * 0.45 * (1 + trailDist * 0.35);

      positions[i * 3] = x;
      positions[i * 3 + 1] = y;
      positions[i * 3 + 2] = z + curlDispZ;

      // Thermographic/velocity coloring along the turbulent wake
      // Core is hot red/yellow -> outer boundary is green/cyan (matching the user's screenshot)
      const coreFactor = 1.0 - Math.min(1.0, Math.hypot(curlDispY, curlDispZ) * 2.5);
      const scalarVal = Math.min(1.0, Math.max(0.05, 0.25 + coreFactor * 0.7 - trailDist * 0.08));

      const pCol = getScalarColor(scalarVal, scalarMode);
      colors[i * 3] = pCol.r;
      colors[i * 3 + 1] = pCol.g;
      colors[i * 3 + 2] = pCol.b;

      sizes[i] = 2.4 + Math.random() * 4.2;
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));

    // Particle Material with additive blending for volumetric turbulence glow
    const material = new THREE.PointsMaterial({
      size: 0.065,
      vertexColors: true,
      transparent: true,
      opacity: 0.88,
      blending: THREE.NormalBlending,
      depthWrite: false,
    });

    return new THREE.Points(geometry, material);
  }, [getScalarColor, scalarMode]);

  // Build Animated Streamline Wind Tunnel Smoke Particles
  const buildStreamlines = useCallback(() => {
    const linesCount = streamlineCount;
    const pointsPerLine = 36;
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(linesCount * (pointsPerLine - 1) * 6);
    const colors = new Float32Array(linesCount * (pointsPerLine - 1) * 6);

    let idx = 0;
    const colStart = new THREE.Color('#38bdf8');
    const colEnd = new THREE.Color('#39ff14');

    for (let l = 0; l < linesCount; l++) {
      // Inflow grid upstream
      const inletX = -6.5;
      const inletY = -0.8 + (Math.random() * 1.6);
      const inletZ = -5.0 + (Math.random() * 10.0);

      let prevX = inletX;
      let prevY = inletY;
      let prevZ = inletZ;

      for (let p = 1; p < pointsPerLine; p++) {
        const t = p / (pointsPerLine - 1);
        const curX = inletX + t * 12.0;

        // Flow deflection around wing and fuselage
        const distToFuselage = Math.hypot(curX, inletZ);
        const fuseDeflectY = distToFuselage < 1.2 ? (inletY > 0 ? 0.35 : -0.35) * (1 - distToFuselage / 1.2) : 0;

        // Upwash before wing, downwash after
        const chordPos = curX - (-0.6 + Math.abs(inletZ) * 0.52);
        const downwash = chordPos > 0 ? -0.25 * Math.sin(aoaDeg * (Math.PI / 180)) * Math.min(2.0, chordPos) : 0.1;

        const curY = inletY + fuseDeflectY + downwash;
        const curZ = inletZ;

        // Segment start
        positions[idx] = prevX;
        positions[idx + 1] = prevY;
        positions[idx + 2] = prevZ;

        colors[idx] = colStart.r;
        colors[idx + 1] = colStart.g;
        colors[idx + 2] = colStart.b;

        // Segment end
        positions[idx + 3] = curX;
        positions[idx + 4] = curY;
        positions[idx + 5] = curZ;

        const tCol = colStart.clone().lerp(colEnd, t);
        colors[idx + 3] = tCol.r;
        colors[idx + 4] = tCol.g;
        colors[idx + 5] = tCol.b;

        idx += 6;
        prevX = curX;
        prevY = curY;
        prevZ = curZ;
      }
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const material = new THREE.LineBasicMaterial({
      vertexColors: true,
      transparent: true,
      opacity: 0.55,
      linewidth: 1,
    });

    return new THREE.LineSegments(geometry, material);
  }, [streamlineCount, aoaDeg]);

  // Build 3D Voxel Partition Bounding Boxes with Labels (matching the user's photo!)
  const buildPartitionBoxes = useCallback(() => {
    const group = new THREE.Group();
    group.name = 'partition-boxes';

    DEFAULT_PARTITIONS.forEach((part) => {
      const min = part.bounds.min;
      const max = part.bounds.max;
      const dx = max[0] - min[0];
      const dy = max[1] - min[1];
      const dz = max[2] - min[2];

      const boxGeom = new THREE.BoxGeometry(dx, dy, dz);
      boxGeom.translate(min[0] + dx / 2, min[1] + dy / 2, min[2] + dz / 2);

      const wireframe = new THREE.WireframeGeometry(boxGeom);
      const line = new THREE.LineSegments(
        wireframe,
        new THREE.LineBasicMaterial({
          color: new THREE.Color(part.color),
          transparent: true,
          opacity: 0.85,
          linewidth: 1.5,
        })
      );

      group.add(line);
    });

    return group;
  }, []);

  // Main Three.js Scene Setup & Loop
  useEffect(() => {
    const container = canvasMountRef.current;
    if (!container) return;

    // Detect software WebGL per Three.js skill
    const isSoftwareGl = (() => {
      const gl = document.createElement('canvas').getContext('webgl2');
      if (!gl) return true;
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
      const gpu = String(gl.getParameter(param));
      gl.getExtension('WEBGL_lose_context')?.loseContext();
      return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
    })();

    const width = container.clientWidth || 800;
    const height = container.clientHeight || 600;

    // Renderer
    const renderer = new THREE.WebGLRenderer({
      antialias: !isSoftwareGl,
      powerPreference: 'high-performance',
      preserveDrawingBuffer: true,
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    container.innerHTML = '';
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // Scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#0A0E17'); // Dark aerospace background
    scene.fog = new THREE.FogExp2('#0A0E17', 0.042);
    sceneRef.current = scene;

    // Camera (Angle matching the user reference photo: elevated three-quarter view from rear/side)
    const camera = new THREE.PerspectiveCamera(40, width / height, 0.1, 100);
    camera.position.set(-6.8, 3.8, 6.2);
    cameraRef.current = camera;

    // Studio Environment & Lighting
    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    scene.environment = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
    pmremGenerator.dispose();

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.65);
    scene.add(ambientLight);

    const dirLight1 = new THREE.DirectionalLight(0xffffff, 1.4);
    dirLight1.position.set(6, 12, 8);
    scene.add(dirLight1);

    const dirLight2 = new THREE.DirectionalLight(0x38bdf8, 0.85);
    dirLight2.position.set(-8, -4, -6);
    scene.add(dirLight2);

    // Subtle Wind Tunnel Floor Grid
    const gridHelper = new THREE.GridHelper(24, 32, 0x1e293b, 0x0f172a);
    gridHelper.position.y = -1.8;
    scene.add(gridHelper);

    // Controls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.maxDistance = 35;
    controls.minDistance = 1.5;
    controls.target.set(0.6, 0.2, 0.8);
    controlsRef.current = controls;

    // Interactive Probe 3D Marker Pin
    const markerGeom = new THREE.SphereGeometry(0.08, 16, 16);
    const markerMat = new THREE.MeshBasicMaterial({ color: 0x39ff14 });
    const probeMarker = new THREE.Mesh(markerGeom, markerMat);
    probeMarker.position.set(0.85, 0.12, 1.45);
    scene.add(probeMarker);
    probeMarkerRef.current = probeMarker;

    // Load initial airliner model
    const airlinerGroup = buildAirlinerGeometry();
    scene.add(airlinerGroup);
    modelGroupRef.current = airlinerGroup;

    // Wireframe overlay (matching neon green in user image)
    const wireGroup = new THREE.Group();
    airlinerGroup.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        const wireGeom = new THREE.WireframeGeometry(child.geometry);
        const wireLine = new THREE.LineSegments(
          wireGeom,
          new THREE.LineBasicMaterial({
            color: 0x39ff14, // Neon lime green from the image
            transparent: true,
            opacity: 0.65,
            linewidth: 1,
          })
        );
        wireGroup.add(wireLine);
      }
    });
    scene.add(wireGroup);
    wireframeGroupRef.current = wireGroup;

    // Add Volumetric Eddy Wake
    const eddyCloud = buildVolumetricEddyCloud();
    scene.add(eddyCloud);
    eddyParticlesRef.current = eddyCloud;

    // Add Streamlines
    const streamlines = buildStreamlines();
    scene.add(streamlines);
    streamlinesRef.current = streamlines;

    // Add Voxel Partition Boxes
    const partitionBoxes = buildPartitionBoxes();
    scene.add(partitionBoxes);
    partitionsGroupRef.current = partitionBoxes;

    // Apply initial colors
    updateSurfaceColors();

    // Resize Handler
    const handleResize = () => {
      if (!container || !renderer || !camera) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };

    window.addEventListener('resize', handleResize);

    // Animation Loop
    let animId = 0;
    let clock = new THREE.Clock();

    const animate = () => {
      animId = requestAnimationFrame(animate);
      const delta = clock.getDelta();
      const elapsed = clock.getElapsedTime();

      controls.update();

      // Animate eddy particle vortex pulse
      if (eddyParticlesRef.current) {
        const geom = eddyParticlesRef.current.geometry;
        const pos = geom.attributes.position;
        if (pos) {
          const arr = pos.array as Float32Array;
          const count = pos.count;
          const speed = (inflowSpeed / 50) * delta;
          for (let i = 0; i < count; i++) {
            // Displace along x direction and recycle
            arr[i * 3] += speed * (0.8 + Math.sin(i) * 0.4);
            if (arr[i * 3] > 6.0) {
              arr[i * 3] = -0.5 + Math.random() * 0.8;
            }
          }
          pos.needsUpdate = true;
        }
      }

      // Rotate model slightly if AoA or Yaw change
      if (modelGroupRef.current && wireframeGroupRef.current) {
        const targetPitch = THREE.MathUtils.degToRad(-aoaDeg);
        const targetYaw = THREE.MathUtils.degToRad(yawDeg);
        modelGroupRef.current.rotation.z = targetPitch;
        modelGroupRef.current.rotation.y = targetYaw;
        wireframeGroupRef.current.rotation.z = targetPitch;
        wireframeGroupRef.current.rotation.y = targetYaw;
      }

      renderer.render(scene, camera);
    };

    animate();

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', handleResize);
      renderer.dispose();
      controls.dispose();
      if (container) container.innerHTML = '';
    };
  }, []); // Run once on mount

  // Sync surface colors when scalarMode changes
  useEffect(() => {
    updateSurfaceColors();

    // Also update eddy cloud colors
    if (sceneRef.current && eddyParticlesRef.current) {
      sceneRef.current.remove(eddyParticlesRef.current);
      const newEddy = buildVolumetricEddyCloud();
      newEddy.visible = showEddyWake;
      sceneRef.current.add(newEddy);
      eddyParticlesRef.current = newEddy;
    }
  }, [scalarMode, updateSurfaceColors, buildVolumetricEddyCloud, showEddyWake]);

  // Sync visibility toggles
  useEffect(() => {
    if (wireframeGroupRef.current) {
      wireframeGroupRef.current.visible = showWireframe;
    }
    if (partitionsGroupRef.current) {
      partitionsGroupRef.current.visible = showPartitions;
    }
    if (eddyParticlesRef.current) {
      eddyParticlesRef.current.visible = showEddyWake;
    }
    if (streamlinesRef.current) {
      streamlinesRef.current.visible = showStreamlines;
    }
  }, [showWireframe, showPartitions, showEddyWake, showStreamlines]);

  // Handle Raycasting / Click Probe
  const handleCanvasClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const container = canvasMountRef.current;
    if (!container || !cameraRef.current || !sceneRef.current) return;

    const rect = container.getBoundingClientRect();
    const mouse = new THREE.Vector2(
      ((e.clientX - rect.left) / rect.width) * 2 - 1,
      -((e.clientY - rect.top) / rect.height) * 2 + 1
    );

    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(mouse, cameraRef.current);

    if (modelGroupRef.current) {
      const intersects = raycaster.intersectObjects(modelGroupRef.current.children, true);
      if (intersects.length > 0) {
        const hit = intersects[0];
        const point = hit.point;

        // Position 3D marker
        if (probeMarkerRef.current) {
          probeMarkerRef.current.position.copy(point);
        }

        // Calculate physical values at clicked location
        const distFromNose = Math.max(0.1, point.x + 4.2);
        const isUpperSurface = point.y > 0;
        const localVelocity = Number(
          (inflowSpeed * (isUpperSurface ? 1.05 + 0.35 * Math.sin(distFromNose * 0.8) : 0.88)).toFixed(1)
        );

        // Local aerothermal recovery
        const localMach = localVelocity / Math.sqrt(1.4 * 287.05 * ambientTempK);
        const localTemp = Number((ambientTempK * (1 + 0.2 * 0.89 * (localMach ** 2))).toFixed(1));
        const localPress = Number((101.325 - (0.5 * 1.225 * (localVelocity ** 2 - inflowSpeed ** 2)) / 1000).toFixed(1));
        const localStress = Number((0.5 * 1.225 * (localVelocity ** 2) * 0.0035).toFixed(2));

        let regime = 'Attached Subsonic Boundary Layer';
        if (localMach > 1.0) regime = 'Transonic Supercritical Suction Peak (Local Shock)';
        else if (point.x > 3.0) regime = 'Separated Turbulent Boundary Layer';
        else if (point.y < -0.3) regime = 'High Pressure Compression Underwing';

        setActiveProbe({
          x: Number(point.x.toFixed(3)),
          y: Number(point.y.toFixed(3)),
          z: Number(point.z.toFixed(3)),
          velocity: localVelocity,
          temperature: localTemp,
          pressure: localPress,
          shearStress: localStress,
          regime,
        });

        sound.playClick();
      }
    }
  };

  // Camera preset buttons
  const setCameraPreset = (preset: 'iso' | 'top' | 'front' | 'side' | 'rear') => {
    if (!cameraRef.current || !controlsRef.current) return;
    sound.playTick();

    const targets: Record<string, { pos: [number, number, number]; target: [number, number, number] }> = {
      iso: { pos: [-6.8, 3.8, 6.2], target: [0.6, 0.2, 0.8] },
      top: { pos: [0.2, 10.5, 0.0], target: [0.2, 0.0, 0.0] },
      front: { pos: [-8.5, 0.2, 0.0], target: [0.0, 0.0, 0.0] },
      side: { pos: [0.5, 0.4, 9.2], target: [0.5, 0.2, 0.0] },
      rear: { pos: [8.5, 2.4, 3.2], target: [1.2, 0.2, 0.0] },
    };

    const t = targets[preset] || targets.iso;
    cameraRef.current.position.set(...t.pos);
    controlsRef.current.target.set(...t.target);
    controlsRef.current.update();
  };

  // Model switching
  const handleModelSelect = (type: 'airliner' | 'fsae' | 'wing' | 'propeller' | 'custom') => {
    setActiveModelType(type);
    sound.playClick();

    if (!sceneRef.current) return;

    // Remove existing model & wireframe
    if (modelGroupRef.current) sceneRef.current.remove(modelGroupRef.current);
    if (wireframeGroupRef.current) sceneRef.current.remove(wireframeGroupRef.current);

    let newModelGroup = new THREE.Group();

    if (type === 'airliner') {
      newModelGroup = buildAirlinerGeometry();
    } else if (type === 'custom' && customMeshGeometry) {
      const mat = new THREE.MeshStandardMaterial({
        roughness: 0.25,
        metalness: 0.65,
        vertexColors: true,
      });
      const mesh = new THREE.Mesh(customMeshGeometry, mat);
      newModelGroup.add(mesh);
    } else {
      // Procedural sample geometries from cadFileParser
      const geomType = (type === 'wing' ? 'airfoil' : type) as 'airfoil' | 'cylinder' | 'sphere' | 'cube' | 'fsae_wing' | 'propeller';
      const raw = generateSampleGeometry(geomType);
      const meshGeom = new THREE.BufferGeometry();

      // Flat vertices
      const posArr: number[] = [];
      raw.faces.forEach(([i0, i1, i2]) => {
        const v0 = raw.vertices[i0];
        const v1 = raw.vertices[i1];
        const v2 = raw.vertices[i2];
        if (v0 && v1 && v2) {
          posArr.push(...v0, ...v1, ...v2);
        }
      });

      meshGeom.setAttribute('position', new THREE.Float32BufferAttribute(posArr, 3));
      meshGeom.computeVertexNormals();

      const mat = new THREE.MeshStandardMaterial({
        roughness: 0.3,
        metalness: 0.6,
        vertexColors: true,
      });
      const mesh = new THREE.Mesh(meshGeom, mat);
      mesh.scale.set(3, 3, 3);
      newModelGroup.add(mesh);
    }

    sceneRef.current.add(newModelGroup);
    modelGroupRef.current = newModelGroup;

    // Build matching wireframe
    const wireGroup = new THREE.Group();
    newModelGroup.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        const wireGeom = new THREE.WireframeGeometry(child.geometry);
        const wireLine = new THREE.LineSegments(
          wireGeom,
          new THREE.LineBasicMaterial({
            color: 0x39ff14,
            transparent: true,
            opacity: 0.65,
          })
        );
        wireGroup.add(wireLine);
      }
    });
    wireGroup.visible = showWireframe;
    sceneRef.current.add(wireGroup);
    wireframeGroupRef.current = wireGroup;

    updateSurfaceColors();
    triggerConfetti();
  };

  // Upload Custom 3D Model (.stl, .obj)
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setUploadError(null);
    sound.playClick();

    try {
      const parsed = await parseCadFile(file);

      if (parsed.validationStatus === 'invalid' || parsed.meshData.vertices.length === 0) {
        throw new Error(parsed.validationMessage || 'Failed to parse 3D geometry coordinates.');
      }

      // Build Three.js BufferGeometry
      const geom = new THREE.BufferGeometry();
      const posArr: number[] = [];

      parsed.meshData.faces.forEach(([i0, i1, i2]) => {
        const v0 = parsed.meshData.vertices[i0];
        const v1 = parsed.meshData.vertices[i1];
        const v2 = parsed.meshData.vertices[i2];
        if (v0 && v1 && v2) {
          posArr.push(...v0, ...v1, ...v2);
        }
      });

      geom.setAttribute('position', new THREE.Float32BufferAttribute(posArr, 3));
      geom.computeVertexNormals();

      // Normalize size & center
      geom.computeBoundingBox();
      const bbox = geom.boundingBox!;
      const center = bbox.getCenter(new THREE.Vector3());
      const size = bbox.getSize(new THREE.Vector3());
      const maxDim = Math.max(size.x, size.y, size.z) || 1.0;
      const scale = 4.2 / maxDim;

      geom.translate(-center.x, -center.y, -center.z);
      geom.scale(scale, scale, scale);

      setCustomMeshGeometry(geom);
      setCustomModelName(file.name);
      setActiveModelType('custom');

      // Also save to platform geometries
      const stlBase64 = meshToStlDataUrl(parsed.meshData, file.name);
      saveGeometry({
        projectId: simConfig.projectId,
        name: file.name.replace(/\.[^/.]+$/, ''),
        filename: file.name,
        format: parsed.format,
        fileSize: file.size,
        points: parsed.points,
        cells: parsed.cells,
        maxSize: parsed.maxSize,
        isTriangulated: parsed.isTriangulated,
        volume: parsed.volume,
        validationStatus: parsed.validationStatus,
        validationMessage: parsed.validationMessage,
        warnings: parsed.warnings,
        type: 'upload',
        geometryType: 'custom',
        meshData: parsed.meshData,
        stlBase64,
      });

      // Swap in scene
      if (sceneRef.current) {
        if (modelGroupRef.current) sceneRef.current.remove(modelGroupRef.current);
        if (wireframeGroupRef.current) sceneRef.current.remove(wireframeGroupRef.current);

        const newGroup = new THREE.Group();
        const mesh = new THREE.Mesh(
          geom,
          new THREE.MeshStandardMaterial({
            roughness: 0.28,
            metalness: 0.62,
            vertexColors: true,
          })
        );
        newGroup.add(mesh);

        sceneRef.current.add(newGroup);
        modelGroupRef.current = newGroup;

        const wireGeom = new THREE.WireframeGeometry(geom);
        const wireLine = new THREE.LineSegments(
          wireGeom,
          new THREE.LineBasicMaterial({ color: 0x39ff14, transparent: true, opacity: 0.65 })
        );
        const wireGroup = new THREE.Group();
        wireGroup.add(wireLine);
        wireGroup.visible = showWireframe;
        sceneRef.current.add(wireGroup);
        wireframeGroupRef.current = wireGroup;

        updateSurfaceColors();
      }

      sound.playSave();
      triggerConfetti();
    } catch (err: any) {
      setUploadError(err.message || 'Error processing 3D CAD mesh file.');
      sound.playWarning();
    } finally {
      setIsUploading(false);
      if (e.target) e.target.value = '';
    }
  };

  // Synchronize state with OpenFOAM Solver page
  const handleSyncToOpenFOAM = () => {
    sound.playClick();
    updateSimConfig({
      inletVelocity: inflowSpeed,
      inletAngle: aoaDeg,
      fluid: {
        ...simConfig.fluid,
        temperature: ambientTempK,
      },
    });
    setPage('setup');
  };

  // Capture Screenshot Snapshot
  const handleSnapshot = () => {
    if (!rendererRef.current) return;
    sound.playSave();
    const dataUrl = rendererRef.current.domElement.toDataURL('image/png');
    const link = document.createElement('a');
    link.download = `CFD_Flow_Thermal_Lab_${scalarMode}_${Date.now()}.png`;
    link.href = dataUrl;
    link.click();
  };

  return (
    <div className="flex-1 flex flex-col h-full w-full bg-[#0A0E17] text-slate-100 select-none overflow-hidden relative font-sans">
      {/* Hidden File Input */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".stl,.obj,.vtk,.ply"
        className="hidden"
        onChange={handleFileUpload}
      />

      {/* 3D WebGL Canvas Viewport (Unobstructed full height & width) */}
      <div
        ref={canvasMountRef}
        onClick={handleCanvasClick}
        className="absolute inset-0 w-full h-full cursor-grab active:cursor-grabbing z-0"
      />

      {/* Top Floating Glass Header HUD (Minimal & clean, non-intrusive) */}
      <div className="absolute top-4 left-4 right-4 z-20 flex flex-wrap items-center justify-between gap-3 pointer-events-none">
        {/* Left: App Branding & Status */}
        <div className="pointer-events-auto flex items-center gap-3 px-4 py-2 bg-slate-900/80 backdrop-blur-md border border-slate-700/60 rounded-xl shadow-lg">
          <CfdLogo size="sm" showText={false} />
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-sm font-bold text-white tracking-wide flex items-center gap-1.5">
                <span>3D Volumetric Flow & Thermal Lab</span>
              </h1>
              <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-[#39ff14]/15 text-[#39ff14] border border-[#39ff14]/30">
                VOXEL CFD
              </span>
            </div>
            <p className="text-[11px] text-slate-400">
              Interactive Navier-Stokes & Thermal boundary-layer inspection
            </p>
          </div>
        </div>

        {/* Center: Flight Envelope Telemetry Readout */}
        <div className="pointer-events-auto hidden md:flex items-center gap-4 px-4 py-2 bg-slate-900/80 backdrop-blur-md border border-slate-700/60 rounded-xl shadow-lg font-mono text-xs">
          <div className="flex items-center gap-1.5 text-slate-300">
            <Wind className="w-3.5 h-3.5 text-[#38bdf8]" />
            <span>U:</span>
            <strong className="text-white">{inflowSpeed} m/s</strong>
          </div>
          <div className="h-3 w-px bg-slate-700" />
          <div className="flex items-center gap-1.5 text-slate-300">
            <Gauge className="w-3.5 h-3.5 text-[#a855f7]" />
            <span>Mach:</span>
            <strong className="text-white">M {machNumber}</strong>
          </div>
          <div className="h-3 w-px bg-slate-700" />
          <div className="flex items-center gap-1.5 text-slate-300">
            <Flame className="w-3.5 h-3.5 text-[#f59e0b]" />
            <span>Stag Temp:</span>
            <strong className="text-amber-400">{stagnationTempK} K</strong>
          </div>
          <div className="h-3 w-px bg-slate-700" />
          <div className="flex items-center gap-1.5 text-slate-300">
            <Compass className="w-3.5 h-3.5 text-[#10b981]" />
            <span>AoA:</span>
            <strong className="text-emerald-400">{aoaDeg}°</strong>
          </div>
        </div>

        {/* Right: Quick Action Buttons */}
        <div className="pointer-events-auto flex items-center gap-2">
          {/* Upload Button */}
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            className="flex items-center gap-2 px-3 py-2 bg-[#39ff14]/20 hover:bg-[#39ff14]/30 text-[#39ff14] border border-[#39ff14]/40 rounded-xl text-xs font-semibold shadow-md backdrop-blur-md transition-all cursor-pointer active:scale-95"
            title="Upload any 3D CAD or STL model to test in the wind tunnel"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>{isUploading ? 'Parsing Mesh...' : 'Upload 3D Model'}</span>
          </button>

          {/* Camera Reset & Snapshot */}
          <button
            onClick={() => setCameraPreset('iso')}
            className="p-2 bg-slate-900/80 hover:bg-slate-800 text-slate-300 border border-slate-700/60 rounded-xl backdrop-blur-md transition-all cursor-pointer"
            title="Reset 3D Camera View"
          >
            <RotateCcw className="w-4 h-4" />
          </button>

          <button
            onClick={handleSnapshot}
            className="p-2 bg-slate-900/80 hover:bg-slate-800 text-slate-300 border border-slate-700/60 rounded-xl backdrop-blur-md transition-all cursor-pointer"
            title="Export 3D Render Snapshot (PNG)"
          >
            <Camera className="w-4 h-4" />
          </button>

          {/* OpenFOAM Sync Button */}
          <button
            onClick={handleSyncToOpenFOAM}
            className="flex items-center gap-1.5 px-3 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-semibold shadow-md transition-all cursor-pointer active:scale-95"
            title="Send current flow & geometry settings to OpenFOAM solver"
          >
            <span>OpenFOAM Solver</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Floating 3D Partition Overlays (Matching user screenshot style) */}
      {showPartitions && (
        <div className="absolute top-20 right-6 z-10 space-y-2 pointer-events-none hidden lg:block">
          {DEFAULT_PARTITIONS.map((part) => (
            <div
              key={part.id}
              className="px-3 py-1.5 bg-black/60 border border-[#39ff14]/40 rounded-lg text-left font-mono"
            >
              <div className="text-[11px] font-black text-[#39ff14] flex items-center justify-between gap-3">
                <span>{part.label}</span>
                <span className="text-[9px] text-slate-400 font-normal">{part.dims}</span>
              </div>
              <div className="text-[9px] text-[#39ff14]/80 tracking-wider">
                {part.voxelCount}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Active 3D Inspection Probe Readout Card (When user clicks anywhere on the 3D model) */}
      {activeProbe && (
        <div className="absolute top-20 left-4 z-10 w-72 bg-slate-900/90 backdrop-blur-md border border-[#39ff14]/40 rounded-xl p-3.5 shadow-2xl text-xs space-y-2 font-mono">
          <div className="flex items-center justify-between pb-1.5 border-b border-slate-800 text-[#39ff14]">
            <div className="flex items-center gap-1.5 font-bold">
              <Crosshair className="w-3.5 h-3.5" />
              <span>Surface Probe Diagnostics</span>
            </div>
            <button
              onClick={() => setActiveProbe(null)}
              className="text-slate-400 hover:text-white cursor-pointer"
            >
              ×
            </button>
          </div>

          <div className="text-[10px] text-slate-400">
            Coord: [{activeProbe.x}, {activeProbe.y}, {activeProbe.z}] m
          </div>

          <div className="grid grid-cols-2 gap-2 text-[11px]">
            <div className="bg-slate-800/60 p-1.5 rounded border border-slate-700/50">
              <span className="text-slate-400 block text-[9px]">Velocity U</span>
              <strong className="text-sky-400 text-xs">{activeProbe.velocity} m/s</strong>
            </div>
            <div className="bg-slate-800/60 p-1.5 rounded border border-slate-700/50">
              <span className="text-slate-400 block text-[9px]">Surface Temp</span>
              <strong className="text-amber-400 text-xs">
                {activeProbe.temperature} K ({(activeProbe.temperature - 273.15).toFixed(1)}°C)
              </strong>
            </div>
            <div className="bg-slate-800/60 p-1.5 rounded border border-slate-700/50">
              <span className="text-slate-400 block text-[9px]">Static Pressure</span>
              <strong className="text-emerald-400 text-xs">{activeProbe.pressure} kPa</strong>
            </div>
            <div className="bg-slate-800/60 p-1.5 rounded border border-slate-700/50">
              <span className="text-slate-400 block text-[9px]">Wall Shear τw</span>
              <strong className="text-purple-400 text-xs">{activeProbe.shearStress} Pa</strong>
            </div>
          </div>

          <div className="text-[10px] text-slate-300 bg-slate-800/40 p-1.5 rounded border border-slate-700/40">
            <span className="text-[#39ff14] font-bold">Regime:</span> {activeProbe.regime}
          </div>
          <div className="text-[9px] text-slate-500 text-center italic">
            Click any point on the 3D surface to probe flow physics
          </div>
        </div>
      )}

      {/* Scalar Legend Colorbar (Fixed right-center) */}
      <div className="absolute right-4 bottom-28 z-10 bg-slate-900/85 backdrop-blur-md border border-slate-700/60 p-2.5 rounded-xl shadow-xl flex flex-col items-center gap-1.5 text-[10px] font-mono">
        <span className="font-bold text-white uppercase text-[9px]">
          {scalarMode === 'temperature' && 'Temp (K)'}
          {scalarMode === 'velocity' && 'Vel (m/s)'}
          {scalarMode === 'stress' && 'Stress (Pa)'}
          {scalarMode === 'vorticity' && 'Vorticity (1/s)'}
        </span>

        {/* Max value */}
        <span className="text-amber-400">
          {scalarMode === 'temperature' && `${stagnationTempK}`}
          {scalarMode === 'velocity' && `${Math.round(inflowSpeed * 1.55)}`}
          {scalarMode === 'stress' && '28.5'}
          {scalarMode === 'vorticity' && '850'}
        </span>

        {/* Dynamic gradient bar */}
        <div
          className="w-4 h-32 rounded border border-slate-700 shadow-inner"
          style={{
            background:
              scalarMode === 'temperature'
                ? 'linear-gradient(to bottom, #ff1744, #ff9100, #ffea00, #00e676, #00b0ff, #2979ff)'
                : scalarMode === 'velocity'
                ? 'linear-gradient(to bottom, #d500f9, #ff1744, #ffea00, #00e676, #00b0ff)'
                : scalarMode === 'stress'
                ? 'linear-gradient(to bottom, #ff1744, #ffea00, #00e676, #2979ff, #651fff)'
                : 'linear-gradient(to bottom, #ff1744, #ff9100, #00e676, #00b0ff)',
          }}
        />

        {/* Min value */}
        <span className="text-sky-400">
          {scalarMode === 'temperature' && `${ambientTempK}`}
          {scalarMode === 'velocity' && '0.0'}
          {scalarMode === 'stress' && '0.2'}
          {scalarMode === 'vorticity' && '0.0'}
        </span>
      </div>

      {/* Unified Ergonomic Collapsible Bottom Control Dock (100% Unobstructed Center Viewport) */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 w-[94%] max-w-4xl transition-all duration-300">
        {/* Collapse / Expand Toggle Button */}
        <div className="flex justify-center -mb-2 relative z-30">
          <button
            onClick={() => {
              sound.playTick();
              setIsDockCollapsed(!isDockCollapsed);
            }}
            className="flex items-center gap-1.5 px-3 py-1 bg-slate-900/90 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-700/80 rounded-t-xl text-[11px] font-semibold backdrop-blur-md shadow-md cursor-pointer transition-colors"
          >
            {isDockCollapsed ? (
              <>
                <ChevronUp className="w-3.5 h-3.5 text-[#39ff14]" />
                <span>Show Flow & Thermal Controls</span>
              </>
            ) : (
              <>
                <ChevronDown className="w-3.5 h-3.5 text-[#39ff14]" />
                <span>Hide Controls (Zen View)</span>
              </>
            )}
          </button>
        </div>

        {/* Main Dock Container */}
        {!isDockCollapsed && (
          <div className="bg-slate-900/90 backdrop-blur-md border border-slate-700/70 rounded-2xl p-3 shadow-2xl space-y-3">
            {/* Dock Top Navigation Tabs */}
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <div className="flex items-center gap-1 sm:gap-2">
                <button
                  onClick={() => {
                    sound.playTick();
                    setActiveDockTab('visuals');
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                    activeDockTab === 'visuals'
                      ? 'bg-[#39ff14]/20 text-[#39ff14] border border-[#39ff14]/40'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Eye className="w-3.5 h-3.5" />
                  <span>Visuals & Overlays</span>
                </button>

                <button
                  onClick={() => {
                    sound.playTick();
                    setActiveDockTab('physics');
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                    activeDockTab === 'physics'
                      ? 'bg-[#39ff14]/20 text-[#39ff14] border border-[#39ff14]/40'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Sliders className="w-3.5 h-3.5" />
                  <span>Flow Dynamics</span>
                </button>

                <button
                  onClick={() => {
                    sound.playTick();
                    setActiveDockTab('models');
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                    activeDockTab === 'models'
                      ? 'bg-[#39ff14]/20 text-[#39ff14] border border-[#39ff14]/40'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Box className="w-3.5 h-3.5" />
                  <span>Models & Upload</span>
                </button>
              </div>

              {/* Camera Presets Pills */}
              <div className="hidden sm:flex items-center gap-1 bg-slate-800/60 p-0.5 rounded-lg border border-slate-700/50 text-[10px]">
                <button
                  onClick={() => setCameraPreset('iso')}
                  className="px-2 py-0.5 rounded text-slate-300 hover:text-white hover:bg-slate-700 cursor-pointer"
                >
                  Iso
                </button>
                <button
                  onClick={() => setCameraPreset('top')}
                  className="px-2 py-0.5 rounded text-slate-300 hover:text-white hover:bg-slate-700 cursor-pointer"
                >
                  Top
                </button>
                <button
                  onClick={() => setCameraPreset('front')}
                  className="px-2 py-0.5 rounded text-slate-300 hover:text-white hover:bg-slate-700 cursor-pointer"
                >
                  Front
                </button>
                <button
                  onClick={() => setCameraPreset('side')}
                  className="px-2 py-0.5 rounded text-slate-300 hover:text-white hover:bg-slate-700 cursor-pointer"
                >
                  Side
                </button>
                <button
                  onClick={() => setCameraPreset('rear')}
                  className="px-2 py-0.5 rounded text-slate-300 hover:text-white hover:bg-slate-700 cursor-pointer"
                >
                  Wake
                </button>
              </div>
            </div>

            {/* TAB 1: Visuals & Overlays */}
            {activeDockTab === 'visuals' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                {/* Scalar Field Switcher */}
                <div className="space-y-1.5">
                  <label className="text-slate-400 text-[11px] font-semibold uppercase tracking-wider block">
                    Active Scalar Field Mapping
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                    <button
                      onClick={() => {
                        sound.playClick();
                        setScalarMode('temperature');
                      }}
                      className={`py-2 px-2.5 rounded-lg text-center font-semibold transition-all cursor-pointer flex flex-col items-center gap-1 ${
                        scalarMode === 'temperature'
                          ? 'bg-amber-500/20 text-amber-300 border border-amber-500/50'
                          : 'bg-slate-800/60 text-slate-400 hover:bg-slate-800'
                      }`}
                    >
                      <Flame className="w-4 h-4 text-amber-400" />
                      <span>Heat Temp</span>
                    </button>

                    <button
                      onClick={() => {
                        sound.playClick();
                        setScalarMode('velocity');
                      }}
                      className={`py-2 px-2.5 rounded-lg text-center font-semibold transition-all cursor-pointer flex flex-col items-center gap-1 ${
                        scalarMode === 'velocity'
                          ? 'bg-sky-500/20 text-sky-300 border border-sky-500/50'
                          : 'bg-slate-800/60 text-slate-400 hover:bg-slate-800'
                      }`}
                    >
                      <Wind className="w-4 h-4 text-sky-400" />
                      <span>Air Velocity</span>
                    </button>

                    <button
                      onClick={() => {
                        sound.playClick();
                        setScalarMode('stress');
                      }}
                      className={`py-2 px-2.5 rounded-lg text-center font-semibold transition-all cursor-pointer flex flex-col items-center gap-1 ${
                        scalarMode === 'stress'
                          ? 'bg-purple-500/20 text-purple-300 border border-purple-500/50'
                          : 'bg-slate-800/60 text-slate-400 hover:bg-slate-800'
                      }`}
                    >
                      <Gauge className="w-4 h-4 text-purple-400" />
                      <span>Skin Stress</span>
                    </button>

                    <button
                      onClick={() => {
                        sound.playClick();
                        setScalarMode('vorticity');
                      }}
                      className={`py-2 px-2.5 rounded-lg text-center font-semibold transition-all cursor-pointer flex flex-col items-center gap-1 ${
                        scalarMode === 'vorticity'
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/50'
                          : 'bg-slate-800/60 text-slate-400 hover:bg-slate-800'
                      }`}
                    >
                      <Activity className="w-4 h-4 text-emerald-400" />
                      <span>Q-Criterion</span>
                    </button>
                  </div>
                </div>

                {/* Visual Feature Toggles */}
                <div className="space-y-1.5">
                  <label className="text-slate-400 text-[11px] font-semibold uppercase tracking-wider block">
                    Render Layers & Overlays
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => {
                        sound.playTick();
                        setShowWireframe(!showWireframe);
                      }}
                      className={`py-2 px-3 rounded-lg text-xs font-semibold flex items-center justify-between border transition-all cursor-pointer ${
                        showWireframe
                          ? 'bg-[#39ff14]/15 border-[#39ff14]/40 text-[#39ff14]'
                          : 'bg-slate-800/40 border-slate-700/60 text-slate-400'
                      }`}
                    >
                      <span>Neon Wireframe</span>
                      <span>{showWireframe ? 'ON' : 'OFF'}</span>
                    </button>

                    <button
                      onClick={() => {
                        sound.playTick();
                        setShowPartitions(!showPartitions);
                      }}
                      className={`py-2 px-3 rounded-lg text-xs font-semibold flex items-center justify-between border transition-all cursor-pointer ${
                        showPartitions
                          ? 'bg-[#39ff14]/15 border-[#39ff14]/40 text-[#39ff14]'
                          : 'bg-slate-800/40 border-slate-700/60 text-slate-400'
                      }`}
                    >
                      <span>Voxel Partitions</span>
                      <span>{showPartitions ? 'ON' : 'OFF'}</span>
                    </button>

                    <button
                      onClick={() => {
                        sound.playTick();
                        setShowEddyWake(!showEddyWake);
                      }}
                      className={`py-2 px-3 rounded-lg text-xs font-semibold flex items-center justify-between border transition-all cursor-pointer ${
                        showEddyWake
                          ? 'bg-[#39ff14]/15 border-[#39ff14]/40 text-[#39ff14]'
                          : 'bg-slate-800/40 border-slate-700/60 text-slate-400'
                      }`}
                    >
                      <span>Turbulent Eddies</span>
                      <span>{showEddyWake ? 'ON' : 'OFF'}</span>
                    </button>

                    <button
                      onClick={() => {
                        sound.playTick();
                        setShowStreamlines(!showStreamlines);
                      }}
                      className={`py-2 px-3 rounded-lg text-xs font-semibold flex items-center justify-between border transition-all cursor-pointer ${
                        showStreamlines
                          ? 'bg-[#39ff14]/15 border-[#39ff14]/40 text-[#39ff14]'
                          : 'bg-slate-800/40 border-slate-700/60 text-slate-400'
                      }`}
                    >
                      <span>Smoke Streamlines</span>
                      <span>{showStreamlines ? 'ON' : 'OFF'}</span>
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 2: Flow Dynamics Sliders */}
            {activeDockTab === 'physics' && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
                {/* Velocity */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400 font-semibold">Inflow Speed U∞</span>
                    <strong className="text-sky-400 font-mono">{inflowSpeed} m/s</strong>
                  </div>
                  <input
                    type="range"
                    min="10"
                    max="320"
                    step="5"
                    value={inflowSpeed}
                    onChange={(e) => setInflowSpeed(Number(e.target.value))}
                    className="w-full accent-sky-400 cursor-pointer"
                  />
                  <div className="flex justify-between text-[10px] text-slate-500 font-mono">
                    <span>10 m/s (Subsonic)</span>
                    <span>320 m/s (Transonic)</span>
                  </div>
                </div>

                {/* Angle of Attack */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400 font-semibold">Angle of Attack α</span>
                    <strong className="text-emerald-400 font-mono">{aoaDeg}°</strong>
                  </div>
                  <input
                    type="range"
                    min="-8"
                    max="22"
                    step="0.5"
                    value={aoaDeg}
                    onChange={(e) => setAoaDeg(Number(e.target.value))}
                    className="w-full accent-emerald-400 cursor-pointer"
                  />
                  <div className="flex justify-between text-[10px] text-slate-500 font-mono">
                    <span>-8° (Dive)</span>
                    <span>22° (Stall)</span>
                  </div>
                </div>

                {/* Ambient Temperature */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400 font-semibold">Fluid Temp T∞</span>
                    <strong className="text-amber-400 font-mono">
                      {ambientTempK} K ({(ambientTempK - 273.15).toFixed(1)}°C)
                    </strong>
                  </div>
                  <input
                    type="range"
                    min="218"
                    max="338"
                    step="1"
                    value={ambientTempK}
                    onChange={(e) => setAmbientTempK(Number(e.target.value))}
                    className="w-full accent-amber-400 cursor-pointer"
                  />
                  <div className="flex justify-between text-[10px] text-slate-500 font-mono">
                    <span>218 K (High Altitude)</span>
                    <span>338 K (Hot Sea Level)</span>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 3: Models & Custom 3D Upload */}
            {activeDockTab === 'models' && (
              <div className="space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400 text-[11px] font-semibold uppercase tracking-wider">
                    Select Aerodynamic Shape or Upload Your CAD Model
                  </span>
                  <span className="text-[10px] text-[#39ff14] font-mono">
                    Formats: STL, OBJ, PLY, VTK
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                  <button
                    onClick={() => handleModelSelect('airliner')}
                    className={`p-2.5 rounded-xl border text-center transition-all cursor-pointer ${
                      activeModelType === 'airliner'
                        ? 'bg-[#39ff14]/20 border-[#39ff14] text-white font-bold'
                        : 'bg-slate-800/60 border-slate-700/60 text-slate-300 hover:bg-slate-800'
                    }`}
                  >
                    <span className="block text-xs font-semibold">Commercial Jet</span>
                    <span className="text-[10px] text-slate-400 block mt-0.5">Reference Image</span>
                  </button>

                  <button
                    onClick={() => handleModelSelect('fsae')}
                    className={`p-2.5 rounded-xl border text-center transition-all cursor-pointer ${
                      activeModelType === 'fsae'
                        ? 'bg-[#39ff14]/20 border-[#39ff14] text-white font-bold'
                        : 'bg-slate-800/60 border-slate-700/60 text-slate-300 hover:bg-slate-800'
                    }`}
                  >
                    <span className="block text-xs font-semibold">FSAE Race Car</span>
                    <span className="text-[10px] text-slate-400 block mt-0.5">Ground Effect Wing</span>
                  </button>

                  <button
                    onClick={() => handleModelSelect('wing')}
                    className={`p-2.5 rounded-xl border text-center transition-all cursor-pointer ${
                      activeModelType === 'wing'
                        ? 'bg-[#39ff14]/20 border-[#39ff14] text-white font-bold'
                        : 'bg-slate-800/60 border-slate-700/60 text-slate-300 hover:bg-slate-800'
                    }`}
                  >
                    <span className="block text-xs font-semibold">NACA Airfoil Wing</span>
                    <span className="text-[10px] text-slate-400 block mt-0.5">Transonic Study</span>
                  </button>

                  <button
                    onClick={() => handleModelSelect('propeller')}
                    className={`p-2.5 rounded-xl border text-center transition-all cursor-pointer ${
                      activeModelType === 'propeller'
                        ? 'bg-[#39ff14]/20 border-[#39ff14] text-white font-bold'
                        : 'bg-slate-800/60 border-slate-700/60 text-slate-300 hover:bg-slate-800'
                    }`}
                  >
                    <span className="block text-xs font-semibold">Drone Propeller</span>
                    <span className="text-[10px] text-slate-400 block mt-0.5">Twisted Pitch Blade</span>
                  </button>

                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className={`p-2.5 rounded-xl border border-dashed text-center transition-all cursor-pointer ${
                      activeModelType === 'custom'
                        ? 'bg-[#39ff14]/20 border-[#39ff14] text-white font-bold'
                        : 'bg-slate-800/40 border-[#39ff14]/50 text-[#39ff14] hover:bg-[#39ff14]/15'
                    }`}
                  >
                    <span className="block text-xs font-semibold flex items-center justify-center gap-1">
                      <Upload className="w-3 h-3" />
                      <span>Upload STL</span>
                    </span>
                    <span className="text-[10px] text-slate-400 block mt-0.5 truncate">
                      {activeModelType === 'custom' ? customModelName : 'Click to Upload'}
                    </span>
                  </button>
                </div>

                {uploadError && (
                  <div className="p-2 bg-red-950/60 border border-red-500/50 rounded-lg text-red-300 text-[11px] flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
                    <span>{uploadError}</span>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
