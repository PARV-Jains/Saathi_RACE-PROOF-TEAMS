import React, { useState } from 'react';
import { ToastProvider } from './context/ToastContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { TopBar } from './components/TopBar';
import { BoardTab } from './components/BoardTab';
import { TeamDashboardTab } from './components/TeamDashboardTab';
import { SuggestionsTab } from './components/SuggestionsTab';
import { ConcurrencySimModal } from './components/ConcurrencySimModal';
import { CreateTeamModal } from './components/CreateTeamModal';
import { ScaleModal } from './components/ScaleModal';
import { Shield, Terminal, Cpu } from 'lucide-react';

const MainApp: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'board' | 'team' | 'suggestions'>('board');
  const [isSimModalOpen, setIsSimModalOpen] = useState(false);
  const [isScaleModalOpen, setIsScaleModalOpen] = useState(false);
  const [isCreateTeamOpen, setIsCreateTeamOpen] = useState(false);

  const { currentUser, currentTeam } = useAuth();

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col font-sans selection:bg-zinc-800 selection:text-white w-full">

      <TopBar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onOpenSimModal={() => setIsSimModalOpen(true)}
        onOpenScaleModal={() => setIsScaleModalOpen(true)}
        onOpenCreateTeamModal={() => setIsCreateTeamOpen(true)}
      />


      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-4">
        {activeTab === 'board' && <BoardTab />}
        {activeTab === 'team' && (
          <TeamDashboardTab onOpenCreateTeamModal={() => setIsCreateTeamOpen(true)} />
        )}
        {activeTab === 'suggestions' && <SuggestionsTab />}
      </main>


      <ConcurrencySimModal
        isOpen={isSimModalOpen}
        onClose={() => setIsSimModalOpen(false)}
      />

      <ScaleModal
        isOpen={isScaleModalOpen}
        onClose={() => setIsScaleModalOpen(false)}
      />

      <CreateTeamModal
        isOpen={isCreateTeamOpen}
        onClose={() => setIsCreateTeamOpen(false)}
        onTeamCreated={() => setActiveTab('team')}
      />


      <footer className="border-t border-zinc-800/80 bg-zinc-950 py-4 text-xs text-zinc-500 font-mono w-full">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-[11px]">
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            <span className="text-zinc-400 font-medium">
              SAATHI // RACE-PROOF TEAMS
            </span>
          </div>
          <div className="flex items-center gap-4 text-zinc-500 flex-wrap">


            <button
              onClick={() => setIsScaleModalOpen(true)}
              className="text-emerald-400 hover:text-emerald-300 font-semibold transition cursor-pointer flex items-center gap-1.5"
              title="View live 10,000-user scale metrics & benchmark telemetry"
            >
              <span>P95 LATENCY: 2MS</span>
              <span className="text-[9px] bg-emerald-950/80 border border-emerald-800/80 px-1 py-0.2 rounded text-emerald-300">
                TELEMETRY
              </span>
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
};

export const App: React.FC = () => {
  return (
    <ToastProvider>
      <AuthProvider>
        <MainApp />
      </AuthProvider>
    </ToastProvider>
  );
};

export default App;
