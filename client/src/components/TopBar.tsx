import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  Users,
  Zap,
  ChevronDown,
  Check,
  Plus,
  Menu,
  X,
  Radio,
  Terminal,
  Activity,
} from 'lucide-react';

interface TopBarProps {
  activeTab: 'board' | 'team' | 'suggestions';
  setActiveTab: (tab: 'board' | 'team' | 'suggestions') => void;
  onOpenSimModal: () => void;
  onOpenScaleModal: () => void;
  onOpenCreateTeamModal: () => void;
}

export const TopBar: React.FC<TopBarProps> = ({
  activeTab,
  setActiveTab,
  onOpenSimModal,
  onOpenScaleModal,
  onOpenCreateTeamModal,
}) => {
  const {
    currentUser,
    currentTeam,
    demoPersonas,
    switchUser,
    sseConnected,
  } = useAuth();

  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);


  useEffect(() => {
    function handleClickOutside(e: MouseEvent | TouchEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsDropdownOpen(false);
      }
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setIsDropdownOpen(false);
        setIsMobileMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  const activeRole: 'LEADER' | 'MBR' | 'SOLO' = !currentTeam
    ? 'SOLO'
    : currentTeam.leader_id === currentUser?.id
      ? 'LEADER'
      : 'MBR';

  const activeCategory: 'Team Leader' | 'Team Member' | 'Solo Hacker' = !currentTeam
    ? 'Solo Hacker'
    : currentTeam.leader_id === currentUser?.id
      ? 'Team Leader'
      : 'Team Member';

  return (
    <header className="sticky top-0 z-50 bg-zinc-950/95 backdrop-blur border-b border-zinc-800 w-full">
      <div className="max-w-7xl mx-auto px-3 sm:px-6">
        <div className="flex items-center justify-between h-14 gap-2">

          <div className="flex items-center gap-2 sm:gap-3 min-w-0 shrink-0">
            <button
              onClick={() => {
                setActiveTab('board');
                setIsMobileMenuOpen(false);
              }}
              className="flex items-center gap-2 hover:opacity-85 transition cursor-pointer text-left focus-visible:ring-1 focus-visible:ring-sky-400 rounded px-1 -mx-1"
              aria-label="Saathi Home - Looking for Teammates Board"
            >
              <span className="font-mono font-bold text-xs sm:text-sm tracking-wider text-zinc-100 flex items-center gap-1.5 shrink-0">
                <Terminal className="w-4 h-4 text-zinc-400 shrink-0" />
                <span>SAATHI</span>
                <span className="hidden sm:inline text-zinc-600">//</span>
                <span className="hidden sm:inline text-zinc-400">RACE-PROOF TEAMS</span>
              </span>
            </button>


            <div
              className={`hidden sm:inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-mono border shrink-0 ${sseConnected
                ? 'bg-emerald-950/40 text-emerald-300 border-emerald-900/60'
                : 'bg-amber-950/40 text-amber-300 border-amber-900/60'
                }`}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full ${sseConnected ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'
                  }`}
              />
              <span>{sseConnected ? 'LIVE SSE' : 'RECONNECTING'}</span>
            </div>
          </div>


          <nav
            className="hidden md:flex items-center gap-1 bg-zinc-900/80 p-0.5 rounded-md border border-zinc-800 text-xs font-mono"
            aria-label="Navigation Tabs"
          >
            <button
              onClick={() => setActiveTab('board')}
              className={`px-3 py-1 rounded transition text-xs ${activeTab === 'board'
                ? 'bg-zinc-800 text-zinc-100 font-semibold shadow-sm'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/40'
                }`}
            >
              [01] Board
            </button>
            <button
              onClick={() => setActiveTab('team')}
              className={`px-3 py-1 rounded transition text-xs flex items-center gap-1.5 ${activeTab === 'team'
                ? 'bg-zinc-800 text-zinc-100 font-semibold shadow-sm'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/40'
                }`}
            >
              <span>[02] My Team</span>
              {currentTeam && (
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              )}
            </button>
            <button
              onClick={() => setActiveTab('suggestions')}
              className={`px-3 py-1 rounded transition text-xs ${activeTab === 'suggestions'
                ? 'bg-zinc-800 text-zinc-100 font-semibold shadow-sm'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/40'
                }`}
            >
              [03] Suggestions
            </button>
          </nav>


          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">

            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                className="flex items-center gap-1.5 sm:gap-2 px-2 sm:px-2.5 py-1.5 rounded-md bg-zinc-900 border border-zinc-800 hover:border-zinc-700 text-xs text-zinc-200 transition focus-visible:ring-2 focus-visible:ring-sky-400 max-w-[140px] sm:max-w-none cursor-pointer"
                aria-expanded={isDropdownOpen}
                aria-haspopup="listbox"
                aria-label="Switch Demo User"
              >
                <div className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" />
                <div className="flex items-center gap-1 text-left min-w-0">
                  <span className="text-[11px] text-zinc-400 hidden lg:inline shrink-0">Active:</span>
                  <span className="font-semibold text-zinc-100 truncate max-w-[75px] sm:max-w-[140px]">
                    {currentUser?.name || 'Select'}
                  </span>
                  <span
                    className={`hidden sm:inline-block text-[10px] font-mono px-1.5 py-0.5 rounded uppercase font-semibold shrink-0 ${activeRole === 'LEADER'
                        ? 'bg-sky-950 border border-sky-800/60 text-sky-300'
                        : activeRole === 'MBR'
                          ? 'bg-zinc-800 border border-zinc-700 text-zinc-300'
                          : 'bg-emerald-950 border border-emerald-800/60 text-emerald-300'
                      }`}
                  >
                    {activeRole}
                  </span>
                </div>
                <ChevronDown className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
              </button>


              {isDropdownOpen && (
                <div
                  className="absolute right-0 mt-2 w-72 sm:w-96 max-w-[calc(100vw-2rem)] rounded-lg bg-zinc-900 border border-zinc-700 shadow-2xl py-1 z-[60] overflow-hidden"
                  style={{ filter: 'drop-shadow(0 20px 25px rgb(0 0 0 / 0.7))' }}
                  role="listbox"
                >
                  <div className="px-3 py-2 border-b border-zinc-800/80 bg-zinc-950/80 flex items-center justify-between text-[11px] font-mono text-zinc-400">
                    <span className="font-semibold text-zinc-200">SWITCH DEMO PERSONA</span>
                    <span className="text-[10px] text-zinc-500">1-CLICK AUTH</span>
                  </div>

                  <div className="max-h-80 overflow-y-auto divide-y divide-zinc-800/40">
                    {demoPersonas.length === 0 ? (
                      <div className="p-4 text-center text-xs text-zinc-500 font-mono">
                        Loading sample personas...
                      </div>
                    ) : (
                      demoPersonas.map((persona) => {
                        const isSelected = persona.id === currentUser?.id;
                        const personaCategory = isSelected ? activeCategory : persona.category;
                        const personaTeamName = isSelected
                          ? (currentTeam ? currentTeam.name : null)
                          : persona.team_name;
                        return (
                          <button
                            key={persona.id}
                            onClick={() => {
                              switchUser(persona.id);
                              setIsDropdownOpen(false);
                            }}
                            className={`w-full px-3 py-2.5 text-left flex items-start justify-between gap-2 hover:bg-zinc-800/80 transition cursor-pointer ${isSelected ? 'bg-zinc-800/50' : ''
                              }`}
                            role="option"
                            aria-selected={isSelected}
                          >
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="font-semibold text-xs text-zinc-100">
                                  {persona.name}
                                </span>
                                <span
                                  className={`text-[10px] font-mono px-1.5 py-0.5 rounded uppercase font-semibold ${personaCategory === 'Team Leader'
                                    ? 'bg-sky-950 border border-sky-800/60 text-sky-300'
                                    : personaCategory === 'Team Member'
                                      ? 'bg-zinc-800 border border-zinc-700 text-zinc-300'
                                      : 'bg-emerald-950 border border-emerald-800/60 text-emerald-300'
                                    }`}
                                >
                                  {personaCategory}
                                </span>
                              </div>
                              <p className="text-[11px] text-zinc-400 truncate mt-0.5 font-mono">
                                {persona.email}
                              </p>
                              {personaTeamName && (
                                <p className="text-[10px] text-zinc-500 font-mono mt-0.5">
                                  Team: {personaTeamName}
                                </p>
                              )}
                            </div>
                            {isSelected && (
                              <Check className="w-4 h-4 text-emerald-400 shrink-0 mt-1" />
                            )}
                          </button>
                        );
                      })
                    )}
                  </div>
                </div>
              )}
            </div>


            <button
              onClick={onOpenScaleModal}
              className="hidden lg:flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-zinc-900 border border-zinc-800 hover:border-zinc-700 text-zinc-300 hover:text-white text-xs font-mono transition shrink-0 cursor-pointer"
              title="Inspect 10,000-user scale telemetry & run in-browser 100-user concurrency probe"
            >
              <Activity className="w-3.5 h-3.5 text-emerald-400" />
              <span>10k Scale &amp; p95</span>
            </button>


            <button
              onClick={onOpenSimModal}
              className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-zinc-900 border border-zinc-700 hover:border-zinc-500 text-zinc-200 hover:text-white text-xs font-mono transition shrink-0 cursor-pointer"
              title="Test PostgreSQL SELECT ... FOR UPDATE with 50 simultaneous transactions"
            >
              <Zap className="w-3.5 h-3.5 text-amber-400 fill-current" />
              <span className="font-semibold">⚡ 50x SIM</span>
            </button>


            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="md:hidden p-1.5 rounded-md text-zinc-400 hover:text-white hover:bg-zinc-800 shrink-0 cursor-pointer"
              aria-label="Toggle Navigation"
            >
              {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>


        {isMobileMenuOpen && (
          <div className="md:hidden border-t border-zinc-800 py-3 space-y-2.5">
            <div className="grid grid-cols-3 gap-1 bg-zinc-900 p-1 rounded-md border border-zinc-800 font-mono text-xs">
              <button
                onClick={() => {
                  setActiveTab('board');
                  setIsMobileMenuOpen(false);
                }}
                className={`py-1.5 text-center rounded ${activeTab === 'board' ? 'bg-zinc-800 text-white font-semibold' : 'text-zinc-400'
                  }`}
              >
                Board
              </button>
              <button
                onClick={() => {
                  setActiveTab('team');
                  setIsMobileMenuOpen(false);
                }}
                className={`py-1.5 text-center rounded ${activeTab === 'team' ? 'bg-zinc-800 text-white font-semibold' : 'text-zinc-400'
                  }`}
              >
                My Team
              </button>
              <button
                onClick={() => {
                  setActiveTab('suggestions');
                  setIsMobileMenuOpen(false);
                }}
                className={`py-1.5 text-center rounded ${activeTab === 'suggestions' ? 'bg-zinc-800 text-white font-semibold' : 'text-zinc-400'
                  }`}
              >
                Matches
              </button>
            </div>


            <div className="pt-2 border-t border-zinc-800/60 space-y-1.5">
              <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider block px-1">
                SWITCH PERSONA ({demoPersonas.length} AVAILABLE)
              </span>
              <div className="space-y-1">
                {demoPersonas.map((p) => {
                  const isSelected = p.id === currentUser?.id;
                  const pCategory = isSelected ? activeCategory : p.category;
                  return (
                    <button
                      key={p.id}
                      onClick={() => {
                        switchUser(p.id);
                        setIsMobileMenuOpen(false);
                      }}
                      className={`w-full px-2.5 py-1.5 rounded text-left flex items-center justify-between text-xs transition cursor-pointer ${isSelected ? 'bg-zinc-800 text-zinc-100 font-semibold' : 'text-zinc-400 hover:bg-zinc-800/40'
                        }`}
                    >
                      <div className="flex items-center gap-2 truncate">
                        <span className={`w-1.5 h-1.5 rounded-full ${isSelected ? 'bg-emerald-400' : 'bg-zinc-600'}`} />
                        <span className="truncate">{p.name}</span>
                        <span className="text-[10px] font-mono text-zinc-400">[{pCategory}]</span>
                      </div>
                      {isSelected && <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />}
                    </button>
                  );
                })}
              </div>
            </div>


            <button
              onClick={() => {
                onOpenScaleModal();
                setIsMobileMenuOpen(false);
              }}
              className="w-full py-2 px-3 rounded-md bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 text-zinc-300 text-xs font-mono font-semibold flex items-center justify-center gap-2 cursor-pointer"
            >
              <Activity className="w-3.5 h-3.5 text-emerald-400" />
              <span>📊 10k Scale &amp; p95 Telemetry</span>
            </button>


            <button
              onClick={() => {
                onOpenSimModal();
                setIsMobileMenuOpen(false);
              }}
              className="w-full py-2 px-3 rounded-md bg-amber-950/40 border border-amber-800/60 hover:bg-amber-900/40 text-amber-300 text-xs font-mono font-semibold flex items-center justify-center gap-2 cursor-pointer"
            >
              <Zap className="w-3.5 h-3.5 text-amber-400 fill-current" />
              <span>⚡ Race Stress Test (50 Concurrent Joins)</span>
            </button>

            {!currentTeam && (
              <button
                onClick={() => {
                  onOpenCreateTeamModal();
                  setIsMobileMenuOpen(false);
                }}
                className="w-full py-2 rounded-md bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-mono font-semibold flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span> Create New Team</span>
              </button>
            )}


            <div className="flex items-center justify-between px-2 pt-1 text-[11px] font-mono text-zinc-500 border-t border-zinc-800/60">
              <span>SYSTEM STATUS</span>
              <span className="flex items-center gap-1.5 text-emerald-400 font-semibold">
                <span className={`w-1.5 h-1.5 rounded-full ${sseConnected ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`} />
                {sseConnected ? 'LIVE SSE' : 'RECONNECTING'}
              </span>
            </div>
          </div>
        )}
      </div>
    </header>
  );
};
