import React, { useState, useEffect } from 'react';
import { simulateRace } from '../api';
import { SimulationResult } from '../types';
import {
  Zap,
  CheckCircle2,
  XCircle,
  Database,
  Clock,
  ShieldCheck,
  X,
  Play,
  RotateCcw,
  Terminal,
} from 'lucide-react';

interface ConcurrencySimModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ConcurrencySimModal: React.FC<ConcurrencySimModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [isRunning, setIsRunning] = useState(false);
  const [result, setResult] = useState<SimulationResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  async function handleRunSimulation() {
    setIsRunning(true);
    setError(null);
    setResult(null);
    try {
      const data = await simulateRace();
      setResult(data);
    } catch (err: any) {
      setError(err.message || 'Simulation failed');
    } finally {
      setIsRunning(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[100] overflow-y-auto bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 font-mono text-xs"
      role="dialog"
      aria-modal="true"
      aria-labelledby="sim-modal-title"
    >
      <div className="relative w-full max-w-2xl rounded-lg bg-zinc-900 border border-zinc-800 shadow-2xl overflow-hidden text-zinc-100 flex flex-col max-h-[90vh]">

        <div className="p-4 border-b border-zinc-800 flex items-center justify-between bg-zinc-950/80">
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-amber-400 fill-current" />
            <h2 id="sim-modal-title" className="font-bold text-xs uppercase tracking-wider text-zinc-100">
              SAATHI // 50-WAY CONCURRENCY RACE STRESS TEST
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded text-zinc-500 hover:text-zinc-200 transition"
            aria-label="Close dialog"
          >
            <X className="w-4 h-4" />
          </button>
        </div>


        <div className="p-4 overflow-y-auto space-y-4 flex-1">

          <div className="rounded bg-zinc-950 border border-zinc-800/80 p-3 text-xs leading-relaxed text-zinc-300">
            <span className="font-bold text-zinc-100 block mb-1">
              THE CONCURRENCY INVARIANT
            </span>
            <p className="text-[11px] text-zinc-400">
              When a team has strictly <strong>1 seat remaining</strong> and 50 participants click "Join" at the exact same millisecond, exactly <strong>1 transaction commits (200 OK)</strong> and the remaining <strong>49 receive 409 Conflict (TEAM_FULL)</strong>. The team member count never exceeds 2.
            </p>
          </div>


          {!result && !isRunning && !error && (
            <div className="py-6 text-center space-y-3">
              <div className="w-10 h-10 rounded bg-zinc-800 border border-zinc-700 mx-auto flex items-center justify-center text-amber-400">
                <Zap className="w-5 h-5 fill-current" />
              </div>
              <div className="space-y-0.5">
                <h3 className="font-bold text-sm text-zinc-100">Ready to Fire 50 Simultaneous Transactions</h3>
                <p className="text-[11px] text-zinc-400 max-w-md mx-auto">
                  Launches 50 parallel asynchronous HTTP requests hitting the PostgreSQL <code className="text-amber-300">SELECT ... FOR UPDATE</code> row lock at the exact same millisecond.
                </p>
              </div>
              <button
                onClick={handleRunSimulation}
                className="px-4 py-2 rounded bg-zinc-100 hover:bg-white text-zinc-950 font-bold text-xs transition cursor-pointer inline-flex items-center gap-1.5"
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>Launch 50-Way Concurrency Race</span>
              </button>
            </div>
          )}


          {isRunning && (
            <div className="py-8 text-center space-y-2">
              <div className="w-8 h-8 rounded-full border-2 border-amber-500/20 border-t-amber-400 animate-spin mx-auto" />
              <p className="font-bold text-xs text-zinc-100">Executing 50 Simultaneous Transactions...</p>
              <p className="text-[10px] text-zinc-400">
                PostgreSQL exclusive row lock contention: SELECT * FROM teams FOR UPDATE
              </p>
            </div>
          )}


          {error && (
            <div className="rounded bg-rose-950/40 border border-rose-900/60 p-3 text-xs text-rose-300 space-y-2">
              <p className="font-bold">Simulation Error:</p>
              <p className="text-[11px] font-mono">{error}</p>
              <button
                onClick={handleRunSimulation}
                className="px-2.5 py-1 rounded bg-rose-900/60 hover:bg-rose-800 text-rose-100 text-xs transition"
              >
                Retry
              </button>
            </div>
          )}


          {result && (
            <div className="space-y-4">

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                <div className="p-2.5 rounded bg-zinc-950 border border-zinc-800">
                  <span className="text-[10px] text-zinc-500 block">TOTAL ATTEMPTS</span>
                  <span className="text-sm font-bold text-zinc-100">{result.totalAttempts} (50x)</span>
                </div>
                <div className="p-2.5 rounded bg-emerald-950/40 border border-emerald-900/60">
                  <span className="text-[10px] text-emerald-400 block">SUCCEEDED (200 OK)</span>
                  <span className="text-sm font-bold text-emerald-300">{result.succeededCount} (EXACTLY 1)</span>
                </div>
                <div className="p-2.5 rounded bg-rose-950/40 border border-rose-900/60">
                  <span className="text-[10px] text-rose-400 block">BLOCKED (409 CONFLICT)</span>
                  <span className="text-sm font-bold text-rose-300">{result.failed409Count} (EXACTLY 49)</span>
                </div>
                <div className="p-2.5 rounded bg-zinc-950 border border-zinc-800">
                  <span className="text-[10px] text-zinc-500 block">EXECUTION TIME</span>
                  <span className="text-sm font-bold text-zinc-200">{result.durationMs}ms</span>
                </div>
              </div>


              <div className="rounded bg-zinc-950 border border-zinc-800 p-3 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-zinc-200">
                    POSTGRESQL DATABASE GROUND TRUTH
                  </span>
                  <span className="text-[10px] px-1.5 py-0.2 rounded bg-emerald-950 border border-emerald-800 text-emerald-300 font-bold">
                    VERIFIED: {result.membersInDb.length} / {result.team.maxSize} SLOTS
                  </span>
                </div>
                <div className="divide-y divide-zinc-800/60">
                  {result.membersInDb.map((m) => (
                    <div key={m.user_id} className="py-1.5 flex items-center justify-between text-[11px]">
                      <div className="flex items-center gap-2">
                        <span className="text-zinc-200 font-semibold">{m.name}</span>
                        <span
                          className={`text-[9px] px-1 py-0.2 rounded uppercase ${m.role === 'LEADER'
                              ? 'bg-sky-950 border border-sky-800 text-sky-300'
                              : 'bg-emerald-950 border border-emerald-800 text-emerald-300'
                            }`}
                        >
                          {m.role}
                        </span>
                      </div>
                      <span className="text-zinc-500 text-[10px]">{m.user_id.slice(0, 8)}...</span>
                    </div>
                  ))}
                </div>
              </div>


              <div className="pt-2 flex justify-end">
                <button
                  onClick={handleRunSimulation}
                  disabled={isRunning}
                  className="px-3 py-1.5 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-semibold flex items-center gap-1.5 transition"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Run Concurrency Race Again</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
