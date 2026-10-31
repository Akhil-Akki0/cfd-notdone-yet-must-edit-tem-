import React from 'react';
import { PlatformProvider, usePlatform } from './context/PlatformContext';
import { AuthProvider } from './context/AuthContext';
import { AuthModal } from './components/Auth/AuthModal';
import { Navbar } from './components/Navigation/Navbar';
import { LandingPage } from './pages/LandingPage';
import { DashboardPage } from './pages/DashboardPage';
import { ProjectsPage } from './pages/ProjectsPage';
import { GeometryPage } from './pages/GeometryPage';
import { SimulationSetupPage } from './pages/SimulationSetupPage';
import { SimulationRunnerPage } from './pages/SimulationRunnerPage';
import { CfdWorkbenchView } from './components/CfdWorkbenchView';
import { AeroThermalFlowLabPage } from './pages/AeroThermalFlowLabPage';
import { IntroExperiencePage } from './pages/IntroExperiencePage';
import { AIAnalysisPage } from './pages/AIAnalysisPage';
import { ReportingPage } from './pages/ReportingPage';
import { ParametricSweepsPage } from './pages/ParametricSweepsPage';
import { DocumentationPage } from './pages/DocumentationPage';
import { SimulationQueueDrawer } from './components/SimulationQueue/SimulationQueueDrawer';
import { OpenFoamExportModal } from './components/common/OpenFoamExportModal';
import { PageSkeleton } from './components/common/PageSkeleton';
import { AerospaceVideoBackground } from './components/ui/AerospaceVideoBackground';
import { motion, AnimatePresence } from 'motion/react';

const AppContent: React.FC = () => {
  const {
    page,
    themeMode,
    lightTheme,
    activeThemeConfig,
    isQueueOpen,
    setIsQueueOpen,
    isOpenFoamModalOpen,
    setIsOpenFoamModalOpen,
    geometries,
    currentGeometryId,
    simConfig,
    projects,
    currentProjectId,
  } = usePlatform();

  const [isPageLoading, setIsPageLoading] = React.useState(true);

  React.useEffect(() => {
    setIsPageLoading(true);
    const timeout = window.setTimeout(() => setIsPageLoading(false), 200);
    return () => window.clearTimeout(timeout);
  }, [page]);

  React.useEffect(() => {
    document.documentElement.style.setProperty('--theme-accent', activeThemeConfig.accentColor);
    document.documentElement.style.setProperty('--theme-glow', activeThemeConfig.glowColor);
  }, [activeThemeConfig]);

  const currentGeom = geometries.find((g) => g.id === currentGeometryId) || geometries[0];
  const currentProj = projects.find((p) => p.projectId === currentProjectId) || projects[0];

  const themeBgClass = 'bg-transparent text-slate-900';

  return (
    <div className={`flex flex-col lg:flex-row min-h-[100dvh] h-[100dvh] w-full max-w-[100vw] ${themeBgClass} font-sans antialiased overflow-hidden select-none relative transition-colors duration-300`}>
      {/* High-Performance Metallic Rocket Aerospace Video Background (Hidden during Intro story) */}
      {page !== 'intro' && (
        <AerospaceVideoBackground
          lightTheme={lightTheme}
          theme={themeMode}
        />
      )}

      {/* Left-Side Navigation Bar arranged one by one */}
      <Navbar />

      {/* Main Workspace Area (Content + Footer) */}
      <div className="flex-1 flex flex-col overflow-hidden relative z-10 min-w-0 h-full">
        {/* Main Screen Container with Fluid Animated Transitions */}
        <main className="flex-1 flex flex-col overflow-hidden relative">
          <AnimatePresence mode="wait">
            <motion.div
              key={page}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.18, ease: 'easeOut' }}
              className="flex-1 flex flex-col overflow-hidden h-full w-full"
            >
              {isPageLoading ? <PageSkeleton /> : (
                <>
                  {page === 'intro' && <IntroExperiencePage />}
                  {page === 'landing' && <LandingPage />}
                  {page === 'dashboard' && <DashboardPage />}
                  {page === 'projects' && <ProjectsPage />}
                  {page === 'geometry' && <GeometryPage />}
                  {page === 'setup' && <SimulationSetupPage />}
                  {page === 'runner' && <SimulationRunnerPage />}
                  {page === 'sweeps' && <ParametricSweepsPage />}
                  {page === 'results' && <CfdWorkbenchView />}
                  {page === 'aerothermal' && <AeroThermalFlowLabPage />}
                  {page === 'ai' && <AIAnalysisPage />}
                  {page === 'reporting' && <ReportingPage />}
                  {page === 'docs' && <DocumentationPage />}
                </>
              )}
            </motion.div>
          </AnimatePresence>
        </main>


      </div>

      {/* Authentication & Security Modal */}
      <AuthModal />

      {/* Simulation Queue Drawer */}
      <SimulationQueueDrawer
        isOpen={isQueueOpen}
        onClose={() => setIsQueueOpen(false)}
        onOpenOpenFoamModal={() => {
          setIsQueueOpen(false);
          setIsOpenFoamModalOpen(true);
        }}
      />

      {/* Full OpenFOAM Case ZIP Exporter Modal */}
      {currentGeom && (
        <OpenFoamExportModal
          isOpen={isOpenFoamModalOpen}
          onClose={() => setIsOpenFoamModalOpen(false)}
          geometry={currentGeom}
          simConfig={simConfig}
          projectName={currentProj?.name || currentGeom.name}
        />
      )}
    </div>
  );
};

export default function App() {
  return (
    <AuthProvider>
      <PlatformProvider>
        <AppContent />
      </PlatformProvider>
    </AuthProvider>
  );
}
