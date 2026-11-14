import React, { useState, useEffect, useCallback } from 'react';
import { fetchBoard, joinTeamByInvite, submitJoinRequest } from '../api';
import { Team } from '../types';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import {
  Search,
  Filter,
  Users,
  KeyRound,
  Send,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  Shield,
  Layers,
} from 'lucide-react';

const COMMON_SKILLS = [
  'ALL',
  'TypeScript',
  'React',
  'PostgreSQL',
  'Node.js',
  'Python',
  'Rust',
  'Go',
  'Docker',
];

export const BoardTab: React.FC = () => {
  const { currentUser, currentTeam, sentRequest, refreshUserData } = useAuth();
  const { showToast } = useToast();

  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSkill, setSelectedSkill] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [includeFull, setIncludeFull] = useState(false);
  const [inviteCodeInput, setInviteCodeInput] = useState('');
  const [joiningCode, setJoiningCode] = useState(false);


  const [optimisticRequestedTeamIds, setOptimisticRequestedTeamIds] = useState<Set<string>>(
    new Set()
  );

  const loadBoard = useCallback(async () => {
    try {
      const data = await fetchBoard({
        skill: selectedSkill === 'ALL' ? undefined : selectedSkill,
        search: searchQuery.trim() || undefined,
        includeFull,
        limit: 50,
      });
      setTeams(data.items);
    } catch (err: any) {
      console.error('Failed to load board:', err);
    } finally {
      setLoading(false);
    }
  }, [selectedSkill, searchQuery, includeFull]);


  useEffect(() => {
    loadBoard();
  }, [loadBoard]);


  useEffect(() => {
    setOptimisticRequestedTeamIds(new Set());
    loadBoard();
  }, [currentUser?.id, loadBoard]);


  useEffect(() => {
    const eventSource = new EventSource('/api/events');

    function onUpdate() {
      loadBoard();
    }

    eventSource.addEventListener('team:created', onUpdate);
    eventSource.addEventListener('team:member_joined', onUpdate);
    eventSource.addEventListener('team:member_left', onUpdate);
    eventSource.addEventListener('team:deleted', onUpdate);
    eventSource.addEventListener('team:member_removed', onUpdate);

    return () => {
      eventSource.close();
    };
  }, [loadBoard]);


  async function handleJoinByInvite(e: React.FormEvent) {
    e.preventDefault();
    const code = inviteCodeInput.trim();
    if (!code) return;

    if (!currentUser) {
      showToast({ type: 'warning', title: 'Login Required', message: 'Please select a persona first.' });
      return;
    }

    setJoiningCode(true);

    try {
      const updatedTeam = await joinTeamByInvite(code);
      showToast({
        type: 'success',
        title: 'Joined Team Successfully',
        message: `Added to ${updatedTeam.name} under atomic transaction lock.`,
      });
      setInviteCodeInput('');
      await refreshUserData();
      await loadBoard();
    } catch (err: any) {

      showToast({
        type: 'error',
        title: err.statusCode === 429 ? 'Rate Limited (429)' : 'Join Rejected (409 Conflict)',
        message: err.message,
        code: err.code || `HTTP_${err.statusCode}`,
      });
    } finally {
      setJoiningCode(false);
    }
  }


  async function handleRequestJoin(targetTeam: Team) {
    if (!currentUser) {
      showToast({ type: 'warning', title: 'Login Required', message: 'Please select a persona first.' });
      return;
    }

    if (currentTeam) {
      showToast({
        type: 'warning',
        title: 'Already In Team',
        message: 'Leave your current team before requesting to join another.',
        code: 'ALREADY_IN_TEAM',
      });
      return;
    }


    setOptimisticRequestedTeamIds((prev) => new Set(prev).add(targetTeam.id));
    showToast({
      type: 'info',
      title: 'Submitting Request...',
      message: `Requesting to join "${targetTeam.name}"`,
    });

    try {
      await submitJoinRequest(
        targetTeam.id,
        `Hi! I'd like to join your team with my ${currentUser.skills.slice(0, 3).join(', ')} skills.`
      );

      showToast({
        type: 'success',
        title: 'Join Request Submitted',
        message: `Pending leader review for ${targetTeam.name}.`,
      });
      await refreshUserData();

      setOptimisticRequestedTeamIds((prev) => {
        const next = new Set(prev);
        next.delete(targetTeam.id);
        return next;
      });
    } catch (err: any) {

      setOptimisticRequestedTeamIds((prev) => {
        const next = new Set(prev);
        next.delete(targetTeam.id);
        return next;
      });

      showToast({
        type: 'error',
        title: 'Request Failed (409 Conflict)',
        message: err.message,
        code: err.code || 'CONFLICT',
      });
    }
  }

  const filteredTeams = teams.filter((t) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    const nameMatch = t.name.toLowerCase().includes(q);
    const descMatch = (t.description || '').toLowerCase().includes(q);
    const skillMatch = (t.required_skills || []).some((s) => s.toLowerCase().includes(q));
    return nameMatch || descMatch || skillMatch;
  });

  return (
    <div className="space-y-4">

      <div className="rounded-lg bg-zinc-900 border border-zinc-800 p-4 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs uppercase tracking-wider text-zinc-400">
                LIVE TEAM REGISTRY
              </span>
              <span className="font-mono text-[10px] px-1.5 py-0.2 rounded bg-zinc-800 text-zinc-300">
                P95 &lt; 2MS
              </span>
            </div>
            <h1 className="text-lg font-bold text-zinc-100 tracking-tight mt-0.5">
              Looking for Teammates Board
            </h1>
            <p className="text-xs text-zinc-400 font-mono">
              Saathi · Live updates via SSE. Every join executed under PostgreSQL exclusive row lock.
            </p>
          </div>


          <form
            onSubmit={handleJoinByInvite}
            className="flex items-center gap-2 w-full sm:w-auto"
          >
            <div className="relative flex-1 sm:w-56">
              <KeyRound className="w-3.5 h-3.5 text-zinc-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={inviteCodeInput}
                onChange={(e) => setInviteCodeInput(e.target.value)}
                placeholder="Enter invite code..."
                className="w-full pl-8 pr-2.5 py-1.5 rounded bg-zinc-950 border border-zinc-800 text-xs font-mono text-zinc-100 placeholder-zinc-600 focus-visible:ring-1 focus-visible:ring-sky-400"
              />
            </div>
            <button
              type="submit"
              disabled={joiningCode || !inviteCodeInput.trim()}
              className="px-3 py-1.5 rounded bg-zinc-800 hover:bg-zinc-700 disabled:opacity-40 text-xs font-mono font-medium text-zinc-200 transition shrink-0"
            >
              {joiningCode ? 'Joining...' : 'Redeem Code'}
            </button>
          </form>
        </div>
      </div>


      <div className="flex flex-col md:flex-row gap-2 items-stretch md:items-center justify-between">

        <div className="flex items-center gap-1 overflow-x-auto pb-1 md:pb-0 scrollbar-none no-scrollbar font-mono text-xs">
          <Filter className="w-3.5 h-3.5 text-zinc-500 shrink-0 mr-1" />
          {COMMON_SKILLS.map((skill) => {
            const isSelected = selectedSkill === skill;
            return (
              <button
                key={skill}
                onClick={() => setSelectedSkill(skill)}
                className={`px-2.5 py-1 rounded text-[11px] whitespace-nowrap transition cursor-pointer uppercase ${isSelected
                  ? 'bg-zinc-100 text-zinc-900 font-bold'
                  : 'bg-zinc-900 text-zinc-400 hover:text-zinc-200 border border-zinc-800'
                  }`}
              >
                {skill}
              </button>
            );
          })}
        </div>


        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => setIncludeFull(!includeFull)}
            className={`px-2.5 py-1 rounded border text-[11px] font-mono transition cursor-pointer flex items-center gap-1.5 shrink-0 ${includeFull
              ? 'bg-amber-950/60 border-amber-800 text-amber-300 font-semibold'
              : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-zinc-200'
              }`}
            title="Toggle visibility of teams that have reached maximum capacity"
          >
            <span className={`w-1.5 h-1.5 rounded-full ${includeFull ? 'bg-amber-400 animate-pulse' : 'bg-zinc-600'}`} />
            <span>Show Full Teams</span>
          </button>


          <div className="relative w-full sm:w-56">
            <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search teams or skills..."
              className="w-full pl-8 pr-2.5 py-1 rounded bg-zinc-900 border border-zinc-800 text-xs text-zinc-100 placeholder-zinc-500 focus-visible:ring-1 focus-visible:ring-sky-400 font-mono text-[11px]"
            />
          </div>
        </div>
      </div>


      {loading && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {[1, 2, 3, 4, 5, 6].map((n) => (
            <div
              key={n}
              className="rounded-lg bg-zinc-900 border border-zinc-800 p-4 space-y-3 animate-pulse"
            >
              <div className="h-4 bg-zinc-800 rounded w-1/2" />
              <div className="h-3 bg-zinc-800 rounded w-full" />
              <div className="h-6 bg-zinc-800 rounded" />
            </div>
          ))}
        </div>
      )}


      {!loading && filteredTeams.length === 0 && (
        <div className="rounded-lg bg-zinc-900/40 border border-zinc-800 p-8 text-center space-y-2">
          <Users className="w-8 h-8 text-zinc-600 mx-auto" />
          <p className="font-mono text-xs text-zinc-300 font-semibold">NO OPEN TEAMS FOUND</p>
          <p className="text-xs text-zinc-500 max-w-sm mx-auto">
            Try adjusting your skill filter or search query. Live teams update automatically.
          </p>
        </div>
      )}


      {!loading && filteredTeams.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {filteredTeams.map((team) => {
            const seatsRemaining = team.max_size - team.current_member_count;
            const isFull = seatsRemaining <= 0;
            const isMember = currentTeam?.id === team.id;
            const hasRequested =
              optimisticRequestedTeamIds.has(team.id) ||
              sentRequest?.team_id === team.id;

            const percentFilled = Math.min(
              100,
              Math.round((team.current_member_count / team.max_size) * 100)
            );

            return (
              <div
                key={team.id}
                className="rounded-lg bg-zinc-900 border border-zinc-800 hover:border-zinc-700 p-4 flex flex-col justify-between transition-colors"
              >
                <div className="space-y-2.5">

                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-semibold text-xs sm:text-sm text-zinc-100 truncate">
                      {team.name}
                    </h3>
                    <span
                      className={`text-[10px] font-mono px-1.5 py-0.5 rounded border uppercase shrink-0 font-medium ${seatsRemaining === 1
                        ? 'bg-amber-950/60 border-amber-800/80 text-amber-300'
                        : isFull
                          ? 'bg-zinc-950 border-zinc-800 text-zinc-500'
                          : 'bg-emerald-950/60 border-emerald-800/80 text-emerald-300'
                        }`}
                    >
                      {seatsRemaining === 1
                        ? '1 SEAT LEFT'
                        : isFull
                          ? 'FULL (4/4)'
                          : `${seatsRemaining} OPEN`}
                    </span>
                  </div>


                  <p className="text-xs text-zinc-400 line-clamp-2 leading-relaxed">
                    {team.description || 'No description provided.'}
                  </p>


                  <div className="space-y-1">
                    <div className="flex justify-between text-[11px] font-mono text-zinc-400">
                      <span>CAPACITY</span>
                      <span className="font-semibold text-zinc-200">
                        {team.current_member_count} / {team.max_size}
                      </span>
                    </div>
                    <div className="w-full bg-zinc-950 rounded h-1 overflow-hidden border border-zinc-800/60">
                      <div
                        className={`h-full transition-all duration-300 ${seatsRemaining === 1
                          ? 'bg-amber-400'
                          : isFull
                            ? 'bg-rose-400'
                            : 'bg-emerald-400'
                          }`}
                        style={{ width: `${percentFilled}%` }}
                      />
                    </div>
                  </div>


                  {team.required_skills && team.required_skills.length > 0 && (
                    <div className="flex flex-wrap gap-1 pt-0.5">
                      {team.required_skills.map((skill) => (
                        <span
                          key={skill}
                          className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-zinc-950 text-zinc-400 border border-zinc-800"
                        >
                          {skill}
                        </span>
                      ))}
                    </div>
                  )}
                </div>


                <div className="pt-3 mt-3 border-t border-zinc-800/80">
                  {isMember ? (
                    <div className="w-full py-1.5 rounded bg-zinc-950 border border-zinc-800 text-emerald-400 text-xs font-mono text-center flex items-center justify-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>YOUR TEAM</span>
                    </div>
                  ) : hasRequested ? (
                    <div className="w-full py-1.5 rounded bg-zinc-950 border border-amber-900/60 text-amber-300 text-xs font-mono text-center flex items-center justify-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                      <span>REQUEST PENDING</span>
                    </div>
                  ) : isFull ? (
                    <div className="w-full py-1.5 rounded bg-zinc-950 text-zinc-500 text-xs font-mono text-center border border-zinc-800">
                      CAPACITY REACHED
                    </div>
                  ) : (
                    <button
                      onClick={() => handleRequestJoin(team)}
                      disabled={!!currentTeam}
                      className="w-full py-1.5 rounded bg-zinc-800 hover:bg-zinc-700 disabled:opacity-40 disabled:hover:bg-zinc-800 text-zinc-100 font-mono text-xs transition flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>Request to Join</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
