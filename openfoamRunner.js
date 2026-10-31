/**
 * Hardened OpenFOAM v2606 Execution Engine & Docker/WSL2 Sandboxing
 * 
 * DEVELOPED by Akhil.A gmail :- akkedu01@gmail.com
 */

import fs from 'fs';
import path from 'path';
import os from 'os';
import { spawn, execFile } from 'child_process';
import crypto from 'crypto';
import logger from './logger.js';

const BASE_CASE_DIR = '/tmp/of_cases';
const CASE_TIMEOUT_MS = parseInt(process.env.CASE_TIMEOUT_MS || '600000', 10); // 10 minutes
const MAX_GLOBAL_CONCURRENT = parseInt(process.env.MAX_CONCURRENT_JOBS || '10', 10);
const MAX_USER_CONCURRENT = 2;

const isWindows = process.platform === 'win32';
const USE_DOCKER_SANDBOX = process.env.OPENFOAM_EXEC_MODE === 'docker';
// Native OpenFOAM only: never manufacture CFD results.

// Job Queue & State
const activeJobs = new Map(); // caseId -> Job
const jobQueue = []; // Array of queued job objects (FIFO)
let runningGlobalCount = 0;

// Ensure base storage directory exists
if (!isWindows) {
  try {
    fs.mkdirSync(BASE_CASE_DIR, { recursive: true, mode: 0o700 });
  } catch (e) {}
}

/**
 * Validate that a path is strictly inside BASE_CASE_DIR to prevent Path Traversal
 */
function assertSafeCaseDir(caseDir, expectedUuid) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(expectedUuid)) {
    throw new Error('Security Violation: Invalid Case UUID format.');
  }

  // Canonicalize path
  const normalized = path.normalize(caseDir);
  const resolved = path.resolve(caseDir);
  const allowedRoot = path.resolve(BASE_CASE_DIR);

  if (!isWindows && !resolved.startsWith(allowedRoot)) {
    throw new Error(`Security Violation: Path traversal attempt outside ${BASE_CASE_DIR}`);
  }
}

/**
 * Safe Command Execution via execFile / spawn with argument array.
 * NEVER uses shell string concatenation or raw user strings.
 */
function executeSafeCommand(command, args = [], workingDir, timeoutMs = CASE_TIMEOUT_MS) {
  return new Promise((resolve) => {
    // Whitelist allowed OpenFOAM and utility binaries
    const ALLOWED_BINARIES = [
      'blockMesh',
      'snappyHexMesh',
      'checkMesh',
      'simpleFoam',
      'foamToVTK',
      'which',
      'command',
      'ls',
      'cat',
    ];

    if (!ALLOWED_BINARIES.includes(command)) {
      return resolve({
        exitCode: 1,
        stdout: '',
        stderr: `Security violation: command '${command}' is not in the approved OpenFOAM whitelist.`,
      });
    }

    // Ensure all arguments are strict strings containing NO shell metacharacters
    const sanitizedArgs = args.map((a) => {
      const str = String(a);
      if (/[;&|`$><!\n\r]/.test(str)) {
        throw new Error(`Security violation: illegal characters detected in argument for ${command}`);
      }
      return str;
    });

    let child;
    let stdoutBuf = '';
    let stderrBuf = '';
    let killedByTimeout = false;

    // 1. Docker Sandboxed Execution Mode
    if (USE_DOCKER_SANDBOX) {
      // Docker command arguments array (no shell interpolation)
      const dockerArgs = [
        'run',
        '--rm',
        '--network', 'none',
        '--read-only',
        '--tmpfs', '/tmp/of_cases:rw,noexec,nosuid,size=2g',
        '--cap-drop', 'ALL',
        '--security-opt', 'no-new-privileges',
        '--pids-limit', '256',
        '--memory', '2g',
        '--cpus', '2',
        '-v', `${workingDir}:${workingDir}:rw`,
        '-w', workingDir,
        'opencfd/openfoam-default:latest',
        command,
        ...sanitizedArgs,
      ];

      child = spawn('docker', dockerArgs, {
        detached: true,
        env: {
          PATH: '/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin',
        },
      });
    }
    // 2. WSL2 Mode (Windows Host)
    else if (isWindows) {
      // WSL installations use versioned paths (openfoam13, openfoam14,
      // openfoam2606, etc.). Source every available bashrc so the runner is
      // not tied to one release name.
      const scriptBody = `
        if [ -f /usr/lib/openfoam/openfoam2606/etc/bashrc ]; then
          source /usr/lib/openfoam/openfoam2606/etc/bashrc
        else
          for bashrc in $(find /usr/lib/openfoam /opt -type f -path '*/etc/bashrc' 2>/dev/null | sort -V); do source "$bashrc"; done
        fi
        cd "${workingDir}" && ${command} "$@"
      `;

      child = spawn('wsl.exe', ['bash', '-lc', scriptBody, '--', ...sanitizedArgs], {
        detached: true,
      });
    }
    // 3. Native Linux Mode (Docker Container or Linux Server)
    else {
      const scriptBody = `
        if [ -f /usr/lib/openfoam/openfoam2606/etc/bashrc ]; then
          source /usr/lib/openfoam/openfoam2606/etc/bashrc
        else
          for bashrc in $(find /usr/lib/openfoam /opt -type f -path '*/etc/bashrc' 2>/dev/null | sort -V); do source "$bashrc"; done
        fi
        cd "${workingDir}" && ${command} "$@"
      `;

      child = spawn('bash', ['-lc', scriptBody, '--', ...sanitizedArgs], {
        detached: true,
      });
    }

    const timer = setTimeout(() => {
      killedByTimeout = true;
      try {
        if (child.pid) {
          // Kill the entire process tree safely
          process.kill(-child.pid, 'SIGKILL');
        }
      } catch (e) {
        try { child.kill('SIGKILL'); } catch (e2) {}
      }
    }, timeoutMs);

    child.stdout.on('data', (data) => {
      stdoutBuf += data.toString();
      if (stdoutBuf.length > 50 * 1024 * 1024) {
        stdoutBuf = stdoutBuf.slice(-20 * 1024 * 1024); // Cap buffer
      }
    });

    child.stderr.on('data', (data) => {
      stderrBuf += data.toString();
    });

    child.on('error', (err) => {
      clearTimeout(timer);
      resolve({
        exitCode: 1,
        stdout: stdoutBuf,
        stderr: `Process spawn error: ${err.message}`,
      });
    });

    child.on('close', (code) => {
      clearTimeout(timer);
      if (killedByTimeout) {
        resolve({
          exitCode: 124,
          stdout: stdoutBuf,
          stderr: `Process timed out after ${timeoutMs / 1000}s and was terminated.`,
        });
      } else {
        resolve({
          exitCode: typeof code === 'number' ? code : 1,
          stdout: stdoutBuf,
          stderr: stderrBuf,
        });
      }
    });
  });
}

/**
 * Generates OpenFOAM Case Dictionaries with safe parameter ranges
 */
function writeCaseDictionaries(caseDir, config = {}) {
  const vel = Math.max(0.01, Math.min(100.0, Number(config.inletVelocity) || 1.0));
  const maxIter = Math.max(1, Math.min(10000, parseInt(config.maxIterations, 10) || 500));
  const nu = Math.max(1e-6, Math.min(1e-2, Number(config.viscosity) || 1.5e-5));

  const sysDir = path.join(caseDir, 'system');
  const constDir = path.join(caseDir, 'constant');
  const zeroDir = path.join(caseDir, '0');

  [sysDir, constDir, zeroDir].forEach((d) => {
    if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true, mode: 0o700 });
  });

  // 1. system/blockMeshDict
  fs.writeFileSync(path.join(sysDir, 'blockMeshDict'), `/*--------------------------------*- C++ -*----------------------------------*\\
FoamFile
{
    version     2.0;
    format      ascii;
    class       dictionary;
    location    "system";
    object      blockMeshDict;
}
scale   1;
vertices
(
    (-2.0 -2.0 -2.0)
    ( 4.0 -2.0 -2.0)
    ( 4.0  2.0 -2.0)
    (-2.0  2.0 -2.0)
    (-2.0 -2.0  2.0)
    ( 4.0 -2.0  2.0)
    ( 4.0  2.0  2.0)
    (-2.0  2.0  2.0)
);
blocks
(
    hex (0 1 2 3 4 5 6 7) (60 40 40) simpleGrading (1 1 1)
);
edges ();
boundary
(
    inlet
    {
        type patch;
        faces ((0 4 7 3));
    }
    outlet
    {
        type patch;
        faces ((1 2 6 5));
    }
    walls
    {
        type patch;
        faces ((0 1 5 4) (3 7 6 2));
    }
    frontAndBack
    {
        type patch;
        faces ((0 3 2 1) (4 5 6 7));
    }
);
mergePatchPairs ();
`);

  // 2. system/snappyHexMeshDict
  fs.writeFileSync(path.join(sysDir, 'snappyHexMeshDict'), `/*--------------------------------*- C++ -*----------------------------------*\\
FoamFile
{
    version     2.0;
    format      ascii;
    class       dictionary;
    location    "system";
    object      snappyHexMeshDict;
}
castellatedMesh true;
snap            true;
addLayers       false;

geometry
{
    geometry.stl
    {
        type triSurfaceMesh;
        name cylinder;
    }
};

castellatedMeshControls
{
    maxLocalCells 500000;
    maxGlobalCells 2000000;
    minRefinementCells 10;
    nCellsBetweenLevels 3;
    features ();
    refinementSurfaces
    {
        cylinder
        {
            level (2 3);
        }
    }
    resolveFeatureAngle 30;
    refinementRegions {}
    locationInMesh (2.5 1.2 0.0);
    allowFreeStandingZoneFaces true;
}

snapControls
{
    nSmoothPatch 3;
    tolerance 2.0;
    nSolveIter 30;
    nRelaxIter 5;
    nFeatureSnapIter 10;
    implicitFeatureSnap false;
    explicitFeatureSnap true;
    multiFaceFeatureSnap false;
}

addLayersControls
{
    relativeSizes true;
    layers {}
    expansionRatio 1.2;
    finalLayerThickness 0.5;
    minThickness 0.1;
}

meshQualityControls
{
    maxNonOrtho 65;
    maxBoundarySkewness 20;
    maxInternalSkewness 4;
    maxConcave 80;
    minVol 1e-13;
    minTetQuality 1e-15;
    minArea -1;
    minTwist 0.02;
    minDeterminant 0.001;
    minFaceWeight 0.02;
}
`);

  // 3. system/controlDict
  fs.writeFileSync(path.join(sysDir, 'controlDict'), `/*--------------------------------*- C++ -*----------------------------------*\\
FoamFile
{
    version     2.0;
    format      ascii;
    class       dictionary;
    location    "system";
    object      controlDict;
}
application     simpleFoam;
startFrom       startTime;
startTime       0;
stopAt          endTime;
endTime         ${maxIter};
deltaT          1;
writeControl    timeStep;
writeInterval   50;
purgeWrite      3;
writeFormat     ascii;
writePrecision  7;
writeCompression off;
runTimeModifiable true;

functions
{
    forces
    {
        type            forces;
        libs            ("libforces.so");
        writeControl    timeStep;
        writeInterval   1;
        patches         (cylinder);
        pName           p;
        UName           U;
        rho             rhoInf;
        rhoInf          1.225;
        CofG            (0 0 0);
    }
    forceCoeffs
    {
        type            forceCoeffs;
        libs            ("libforces.so");
        writeControl    timeStep;
        writeInterval   1;
        patches         (cylinder);
        pName           p;
        UName           U;
        rho             rhoInf;
        rhoInf          1.225;
        CofG            (0 0 0);
        liftDir         (0 1 0);
        dragDir         (1 0 0);
        pitchAxis       (0 0 1);
        magUInf         ${vel};
        lRef            1.0;
        Aref            2.0;
    }
}
`);

  // 4. system/fvSchemes
  fs.writeFileSync(path.join(sysDir, 'fvSchemes'), `/*--------------------------------*- C++ -*----------------------------------*\\
FoamFile
{
    version     2.0;
    format      ascii;
    class       dictionary;
    location    "system";
    object      fvSchemes;
}
ddtSchemes { default steadyState; }
gradSchemes
{
    default Gauss linear;
    grad(p) Gauss linear;
    grad(U) cellLimited Gauss linear 1;
}
divSchemes
{
    default none;
    div(phi,U) bounded Gauss linearUpwind grad(U);
    div((nuEff*dev2(T(grad(U))))) Gauss linear;
}
laplacianSchemes { default Gauss linear corrected; }
interpolationSchemes { default linear; }
snGradSchemes { default corrected; }
wallDist { method meshWave; }
`);

  // 5. system/fvSolution
  fs.writeFileSync(path.join(sysDir, 'fvSolution'), `/*--------------------------------*- C++ -*----------------------------------*\\
FoamFile
{
    version     2.0;
    format      ascii;
    class       dictionary;
    location    "system";
    object      fvSolution;
}
solvers
{
    p
    {
        solver GAMG;
        tolerance 1e-06;
        relTol 0.01;
        smoother GaussSeidel;
    }
    U
    {
        solver smoothSolver;
        smoother GaussSeidel;
        tolerance 1e-06;
        relTol 0.01;
    }
}
SIMPLE
{
    nNonOrthogonalCorrectors 2;
    consistent yes;
    residualControl
    {
        p 1e-4;
        U 1e-4;
    }
}
relaxationFactors
{
    fields { p 0.3; }
    equations { U 0.7; }
}
`);

  // 6. 0/U
  fs.writeFileSync(path.join(zeroDir, 'U'), `/*--------------------------------*- C++ -*----------------------------------*\\
FoamFile
{
    version 2.0;
    format ascii;
    class volVectorField;
    location "0";
    object U;
}
dimensions [0 1 -1 0 0 0 0];
internalField uniform (${vel} 0 0);
boundaryField
{
    inlet { type fixedValue; value uniform (${vel} 0 0); }
    outlet { type inletOutlet; inletValue uniform (0 0 0); value uniform (${vel} 0 0); }
    walls { type slip; }
    cylinder { type noSlip; }
    frontAndBack { type slip; }
}
`);

  // 7. 0/p
  fs.writeFileSync(path.join(zeroDir, 'p'), `/*--------------------------------*- C++ -*----------------------------------*\\
FoamFile
{
    version 2.0;
    format ascii;
    class volScalarField;
    location "0";
    object p;
}
dimensions [0 2 -2 0 0 0 0];
internalField uniform 0;
boundaryField
{
    inlet { type zeroGradient; }
    outlet { type fixedValue; value uniform 0; }
    walls { type zeroGradient; }
    cylinder { type zeroGradient; }
    frontAndBack { type zeroGradient; }
}
`);

  // 8. constant/transportProperties
  fs.writeFileSync(path.join(constDir, 'transportProperties'), `/*--------------------------------*- C++ -*----------------------------------*\\
FoamFile
{
    version 2.0;
    format ascii;
    class dictionary;
    location "constant";
    object transportProperties;
}
transportModel Newtonian;
nu [0 2 -1 0 0 0 0] ${nu};
`);

  // 9. constant/momentumTransport & turbulenceProperties
  fs.writeFileSync(path.join(constDir, 'momentumTransport'), `/*--------------------------------*- C++ -*----------------------------------*\\
FoamFile
{
    version 2.0;
    format ascii;
    class dictionary;
    location "constant";
    object momentumTransport;
}
simulationType laminar;
`);
  fs.writeFileSync(path.join(constDir, 'turbulenceProperties'), `/*--------------------------------*- C++ -*----------------------------------*\\
FoamFile
{
    version 2.0;
    format ascii;
    class dictionary;
    location "constant";
    object turbulenceProperties;
}
simulationType laminar;
`);
}

/**
 * VTK Metric Parser
 */
function parseVtkMetrics(vtkText) {
  const lines = vtkText.split('\n');
  let pointsCount = 0;
  let cellsCount = 0;
  let maxVelocity = 0;
  let minVelocity = Infinity;
  let maxPressure = -Infinity;
  let minPressure = Infinity;

  let inVectorField = false;
  let inScalarField = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line.startsWith('POINTS')) {
      pointsCount = parseInt(line.split(/\s+/)[1], 10) || 0;
    } else if (line.startsWith('CELLS')) {
      cellsCount = parseInt(line.split(/\s+/)[1], 10) || 0;
    } else if (line.startsWith('VECTORS U')) {
      inVectorField = true;
      inScalarField = false;
      continue;
    } else if (line.startsWith('SCALARS p')) {
      inScalarField = true;
      inVectorField = false;
      if (lines[i + 1] && lines[i + 1].includes('LOOKUP_TABLE')) i++;
      continue;
    } else if (line.startsWith('POINT_DATA') || line.startsWith('CELL_DATA')) {
      inVectorField = false;
      inScalarField = false;
    }

    if (inVectorField && line.length > 0) {
      const parts = line.split(/\s+/).map(Number);
      if (parts.length >= 3 && !isNaN(parts[0])) {
        const mag = Math.sqrt(parts[0] ** 2 + parts[1] ** 2 + parts[2] ** 2);
        if (mag > maxVelocity) maxVelocity = mag;
        if (mag < minVelocity) minVelocity = mag;
      }
    }

    if (inScalarField && line.length > 0) {
      const val = parseFloat(line);
      if (!isNaN(val)) {
        if (val > maxPressure) maxPressure = val;
        if (val < minPressure) minPressure = val;
      }
    }
  }

  return {
    pointsCount,
    cellsCount,
    maxVelocity: maxVelocity > 0 ? Number(maxVelocity.toFixed(4)) : null,
    minVelocity: minVelocity < Infinity ? Number(minVelocity.toFixed(4)) : null,
    maxPressure: maxPressure > -Infinity ? Number(maxPressure.toFixed(4)) : null,
    minPressure: minPressure < Infinity ? Number(minPressure.toFixed(4)) : null,
  };
}

/**
 * Force Coefficients Parser
 */
function parseForceCoeffs(content) {
  if (!content) return null;
  const lines = content.trim().split('\n');
  let headerLine = null;
  const dataLines = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('#') && (trimmed.includes('Cd') || trimmed.includes('CD') || trimmed.includes('Cl') || trimmed.includes('CL'))) {
      headerLine = trimmed.replace(/^#\s*/, '');
    } else if (!trimmed.startsWith('#') && trimmed.length > 0) {
      dataLines.push(trimmed);
    }
  }

  if (dataLines.length === 0) return null;
  const lastValues = dataLines[dataLines.length - 1].split(/\s+/).map(Number);

  let cD = null;
  let cL = null;

  if (headerLine) {
    const headers = headerLine.split(/\s+/);
    const cdIdx = headers.findIndex((h) => /^cd$/i.test(h));
    const clIdx = headers.findIndex((h) => /^cl$/i.test(h));
    if (cdIdx !== -1 && !isNaN(lastValues[cdIdx])) cD = Number(lastValues[cdIdx].toFixed(5));
    if (clIdx !== -1 && !isNaN(lastValues[clIdx])) cL = Number(lastValues[clIdx].toFixed(5));
  }

  if (cD === null && lastValues.length >= 4) {
    cD = Number(lastValues[2].toFixed(5));
    cL = Number(lastValues[3].toFixed(5));
  }

  if (cD === null || isNaN(cD) || cL === null || isNaN(cL)) return null;
  return { cD, cL };
}

/**
 * Residuals Parser
 */
function parseResiduals(stdoutLog) {
  const residuals = [];
  const lines = stdoutLog.split('\n');
  let currentIter = 0;

  for (const line of lines) {
    if (line.startsWith('Time = ')) {
      currentIter = parseInt(line.replace('Time = ', '').trim(), 10) || currentIter + 1;
    } else if (line.includes('Solving for Ux, Initial residual =')) {
      const match = line.match(/Initial residual = ([0-9.eE+-]+)/);
      if (match) {
        residuals.push({
          iteration: currentIter,
          xMomentum: parseFloat(match[1]),
        });
      }
    } else if (line.includes('Solving for p, Initial residual =')) {
      const match = line.match(/Initial residual = ([0-9.eE+-]+)/);
      if (match && residuals.length > 0) {
        residuals[residuals.length - 1].continuity = parseFloat(match[1]);
      }
    }
  }
  return residuals;
}

/**
 * Process Job Pipeline
 */
async function processJob(job) {
  runningGlobalCount++;
  job.status = 'running';
  job.progress = 10;
  job.startedAt = new Date().toISOString();
  job.logs.push(`[EXEC_START] Sandboxed worker started for case ${job.caseId}`);

  const caseDir = job.caseDir;

  try {
    assertSafeCaseDir(caseDir, job.caseId);


    // 1. blockMesh
    job.logs.push('[STEP 1/5] Executing blockMesh...');
    const resBlock = await executeSafeCommand('blockMesh', [], caseDir);
    if (resBlock.exitCode !== 0) {
      job.logs.push(resBlock.stderr || resBlock.stdout);
      throw new Error(`OpenFOAM blockMesh is unavailable or failed: ${resBlock.stderr || resBlock.stdout || 'check that OpenFOAM is installed and configured.'}`);
    }
    job.logs.push(resBlock.stdout || resBlock.stderr);
    job.progress = 30;

    // 2. snappyHexMesh -overwrite
    job.logs.push('[STEP 2/5] Executing snappyHexMesh -overwrite...');
    const resSnappy = await executeSafeCommand('snappyHexMesh', ['-overwrite'], caseDir);
    job.logs.push(resSnappy.stdout || resSnappy.stderr);
    if (resSnappy.exitCode !== 0 && !resSnappy.stdout.includes('Finished meshing')) {
      throw new Error(`snappyHexMesh failed with code ${resSnappy.exitCode}: ${resSnappy.stderr || resSnappy.stdout}`);
    }
    job.progress = 55;

    // 3. checkMesh
    job.logs.push('[STEP 3/5] Executing checkMesh verification...');
    const resCheck = await executeSafeCommand('checkMesh', [], caseDir);
    job.logs.push(resCheck.stdout);

    let finalCells = 0;
    const cellMatch = resCheck.stdout.match(/cells:\s+([0-9]+)/);
    if (cellMatch) finalCells = parseInt(cellMatch[1], 10);
    job.progress = 65;

    // 4. simpleFoam
    job.logs.push('[STEP 4/5] Executing simpleFoam solver...');
    const resSolver = await executeSafeCommand('simpleFoam', [], caseDir);
    job.logs.push(resSolver.stdout.slice(-2500));
    if (resSolver.exitCode !== 0 && !resSolver.stdout.includes('End')) {
      throw new Error(`simpleFoam failed with code ${resSolver.exitCode}: ${resSolver.stderr || resSolver.stdout}`);
    }
    job.progress = 85;

    // 5. foamToVTK -latestTime
    job.logs.push('[STEP 5/5] Exporting solution via foamToVTK -latestTime...');
    await executeSafeCommand('foamToVTK', ['-latestTime'], caseDir);

    // Find produced VTK
    const findVtk = await executeSafeCommand('ls', ['VTK/*.vtk'], caseDir);
    const vtkFileName = findVtk.stdout.trim().split('\n')[0];
    if (!vtkFileName) {
      throw new Error('foamToVTK produced no .vtk file in VTK/ directory.');
    }

    const catVtk = await executeSafeCommand('cat', [vtkFileName], caseDir);
    if (!catVtk.stdout || catVtk.exitCode !== 0) {
      throw new Error(`Failed reading VTK output file: ${vtkFileName}`);
    }

    const metrics = parseVtkMetrics(catVtk.stdout);
    if (!metrics || metrics.maxVelocity === null || metrics.maxPressure === null) {
      throw new Error(`Could not parse velocity/pressure fields from VTK file: ${vtkFileName}`);
    }

    if (!finalCells || finalCells <= 0) {
      throw new Error('checkMesh reported an invalid or non-positive cell count.');
    }

    // Parse forces
    let forceData = null;
    const primaryForces = await executeSafeCommand('cat', ['postProcessing/forceCoeffs/0/coefficient.dat'], caseDir);
    if (primaryForces.exitCode === 0 && primaryForces.stdout) {
      forceData = parseForceCoeffs(primaryForces.stdout);
    }
    if (!forceData) {
      const altForces = await executeSafeCommand('cat', ['postProcessing/forceCoeffs/0/forceCoeffs.dat'], caseDir);
      if (altForces.exitCode === 0 && altForces.stdout) {
        forceData = parseForceCoeffs(altForces.stdout);
      }
    }
    if (!forceData) {
      throw new Error('postProcessing force coefficients could not be parsed.');
    }

    const vtkBase64 = Buffer.from(catVtk.stdout).toString('base64');
    const residuals = parseResiduals(resSolver.stdout);

    job.status = 'completed';
    job.progress = 100;
    job.completedAt = new Date().toISOString();
    job.result = {
      success: true,
      solverMode: 'native',
      caseId: job.caseId,
      metrics: {
        cells: finalCells,
        points: metrics.pointsCount,
        maxVelocity: metrics.maxVelocity,
        minVelocity: metrics.minVelocity,
        maxPressure: metrics.maxPressure,
        minPressure: metrics.minPressure,
        cL: forceData.cL,
        cD: forceData.cD,
      },
      residuals,
      vtkBase64,
    };

    job.logs.push(`[COMPLETE] OpenFOAM v2606 finished successfully. Cells: ${finalCells}, Max Vel: ${metrics.maxVelocity} m/s`);
    logger.audit('SIMULATION_SUCCESS', {
      caseId: job.caseId,
      userId: job.owner,
      cells: finalCells,
      durationMs: Date.now() - new Date(job.startedAt).getTime(),
    });
  } catch (err) {
    job.status = 'failed';
    // A failed run is not complete or converged. Preserve the last known
    // progress so the progress bar cannot visually report a false 100%.
    job.progress = Math.min(job.progress, 99);
    job.errorMessage = err.message || 'Simulation execution encountered an internal error';
    job.logs.push(`[FATAL_ERROR] ${err.message}`);
    job.result = {
      success: false,
      solverMode: 'native',
      metrics: null,
      error: 'Simulation failed during OpenFOAM solver execution.',
    };
    logger.error('Simulation execution failure', {
      caseId: job.caseId,
      userId: job.owner,
      error: err.message,
    });
  } finally {
    runningGlobalCount--;
    // Trigger next job in FIFO queue
    scheduleNextQueueJob();
  }
}

function scheduleNextQueueJob() {
  if (runningGlobalCount >= MAX_GLOBAL_CONCURRENT || jobQueue.length === 0) {
    return;
  }
  const nextJob = jobQueue.shift();
  if (nextJob) {
    processJob(nextJob);
  }
}

/**
 * Submits a new simulation job with fair FIFO scheduling and per-user limits
 */
function submitSimulationJob({ caseId, ownerId, config, stlBuffer }) {
  // Check user active concurrency
  let userRunningOrQueued = 0;
  for (const j of activeJobs.values()) {
    if (j.owner === ownerId && (j.status === 'running' || j.status === 'queued')) {
      userRunningOrQueued++;
    }
  }

  if (userRunningOrQueued >= MAX_USER_CONCURRENT) {
    throw new Error(`Maximum concurrent simulation limit (${MAX_USER_CONCURRENT}) reached for your account. Please wait for previous jobs to complete.`);
  }

  const caseUuid = caseId || crypto.randomUUID();
  const caseDir = isWindows ? `/tmp/of_cases/${caseUuid}` : path.join(BASE_CASE_DIR, caseUuid);

  // Assert directory path safety
  assertSafeCaseDir(caseDir, caseUuid);

  // Setup Workspace directories
  fs.mkdirSync(path.join(caseDir, 'constant', 'triSurface'), { recursive: true, mode: 0o700 });
  fs.mkdirSync(path.join(caseDir, 'system'), { recursive: true, mode: 0o700 });
  fs.mkdirSync(path.join(caseDir, '0'), { recursive: true, mode: 0o700 });

  // A real solver run must always use the caller's validated STL.
  if (!stlBuffer || !Buffer.isBuffer(stlBuffer) || stlBuffer.length < 84) {
    throw new Error('A validated STL geometry is required. No placeholder mesh is permitted.');
  }
  fs.writeFileSync(path.join(caseDir, 'constant', 'triSurface', 'geometry.stl'), stlBuffer);

  // Write safe dictionaries
  writeCaseDictionaries(caseDir, config);

  const job = {
    caseId: caseUuid,
    caseDir,
    owner: ownerId,
    status: 'queued',
    progress: 0,
    logs: [`[QUEUE] Job ${caseUuid} accepted and queued for execution.`],
    createdAt: new Date().toISOString(),
    startedAt: null,
    completedAt: null,
    result: null,
  };

  activeJobs.set(caseUuid, job);

  if (runningGlobalCount < MAX_GLOBAL_CONCURRENT) {
    processJob(job);
  } else {
    jobQueue.push(job);
    job.logs.push(`[QUEUE] Capacity limit reached (${MAX_GLOBAL_CONCURRENT} active). Position in queue: ${jobQueue.length}`);
  }

  return job;
}

function getJobStatus(caseId, requestingUserId, requestingUserRole) {
  assertSafeCaseDir(`/tmp/of_cases/${caseId}`, caseId);

  const job = activeJobs.get(caseId);
  if (!job) return null;

  // IDOR Protection: Standard users can only view their own jobs
  if (requestingUserRole !== 'admin' && job.owner !== requestingUserId) {
    const error = new Error('Forbidden: You do not have permission to access this simulation case.');
    error.code = 'IDOR_BLOCKED';
    throw error;
  }

  return {
    caseId: job.caseId,
    status: job.status,
    progress: job.progress,
    logs: job.logs,
    createdAt: job.createdAt,
    startedAt: job.startedAt,
    completedAt: job.completedAt,
    result: job.result,
  };
}

export {
  submitSimulationJob,
  getJobStatus,
  executeSafeCommand,
  assertSafeCaseDir,
  activeJobs,
  BASE_CASE_DIR,
};

export default {
  submitSimulationJob,
  getJobStatus,
  executeSafeCommand,
  assertSafeCaseDir,
  activeJobs,
  BASE_CASE_DIR,
};
// This runner intentionally fails safely when native OpenFOAM is unavailable.
