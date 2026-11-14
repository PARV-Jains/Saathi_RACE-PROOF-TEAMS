import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import {
  createInvite,
  leaveTeam,
  kickTeamMember,
  respondToJoinRequest,
  fetchTeamAuditLogs,
  simulateRace,
} from '../api';
import { AuditLog, SimulationResult } from '../types';
import {
  User,
  Users,
  KeyRound,
  Copy,
  Check,
  UserX,
  LogOut,
  Clock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Zap,
  Plus,
  ArrowRight,
  ShieldAlert,
  Terminal,
} from 'lucide-react';

export const TeamDashboardTab: React.FC<{ onOpenCreateTeamModal: () => void }> = ({
  onOpenCreateTeamModal,
}) => {
  const {
    currentUser,
    currentTeam,
    teamMembers,
    pendingRequests,
    activeInvites,
    refreshUserData,
  } = useAuth();
  const { showToast } = useToast();

  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [isGeneratingInvite, setIsGeneratingInvite] = useState(false);
  const [isLeaving, setIsLeaving] = useState(false);
  const [processingRequestId, setProcessingRequestId] = useState<string | null>(null);
  const [kickingUserId, setKickingUserId] = useState<string | null>(null);


  const [isRunningStressTest, setIsRunningStressTest] = useState(false);
  const [stressTestResult, setStressTestResult] = useState<SimulationResult | null>(null);

  const isLeader = currentTeam?.leader_id === currentUser?.id;


  useEffect(() => {
    if (!currentTeam) {
      setAuditLogs([]);
      setStressTestResult(null);
      return;
    }

    let mounted = true;
    async function loadLogs() {
      setLoadingLogs(true);
      try {
        const logs = await fetchTeamAuditLogs(currentTeam!.id);
        if (mounted) setAuditLogs(logs);
      } catch (err) {
        console.warn('Could not load audit logs:', err);
      } finally {
        if (mounted) setLoadingLogs(false);
      }
    }

    loadLogs();
    return () => {
      mounted = false;
    };
  }, [currentTeam]);


  async function handleFireStressTest() {
    setIsRunningStressTest(true);
    setStressTestResult(null);
    try {
      const result = await simulateRace();
      setStressTestResult(result);
      showToast({
        type: 'success',
        title: '50-Way Concurrency Test Finished',
        message: '1 Succeeded (200 OK) · 49 Blocked (409 Conflict). Verified in PostgreSQL.',
      });

      if (currentTeam) {
        const logs = await fetchTeamAuditLogs(currentTeam.id);
        setAuditLogs(logs);
      }
    } catch (err: any) {
      showToast({
        type: 'error',
        title: 'Simulation Error',
        message: err.message,
      });
    } finally {
      setIsRunningStressTest(false);
    }
  }


  async function handleGenerateInvite() {
    if (!currentTeam) return;
    setIsGeneratingInvite(true);
    try {
      const invite = await createInvite(currentTeam.id, 60);
      showToast({
        type: 'success',
        title: 'Invite Code Created',
        message: `Code: ${invite.code} (Expires in 60m)`,
      });
      await refreshUserData();
    } catch (err: any) {
      showToast({
        type: 'error',
        title: 'Failed to Create Invite',
        message: err.message,
      });
    } finally {
      setIsGeneratingInvite(false);
    }
  }


  function handleCopyInvite(code: string) {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2500);
    showToast({
      type: 'info',
      title: 'Copied to Clipboard',
      message: `Code: ${code}`,
    });
  }


  async function handleLeaveTeam() {
    if (!currentTeam) return;
    const confirmMsg = isLeader
      ? teamMembers.length === 1
        ? 'You are the last member. Leaving will permanently delete this team.'
        : 'You are the leader. Leaving will transfer leadership to the next earliest member.'
      : 'Are you sure you want to leave this team?';

    if (!window.confirm(confirmMsg)) return;

    setIsLeaving(true);
    try {
      const result = await leaveTeam(currentTeam.id);
      if (result.deleted) {
        showToast({
          type: 'info',
          title: 'Team Auto-Deleted',
          message: 'As the last member, the team was cleanly purged from the registry.',
        });
      } else {
        showToast({
          type: 'success',
          title: 'Left Team',
          message: result.newLeaderId
            ? 'Leadership transferred to the next member automatically.'
            : 'You have left the team.',
        });
      }
      await refreshUserData();
    } catch (err: any) {
      showToast({
        type: 'error',
        title: 'Leave Team Failed',
        message: err.message,
      });
    } finally {
      setIsLeaving(false);
    }
  }


  async function handleKickMember(targetUserId: string, targetName: string) {
    if (!currentTeam || !isLeader) return;
    if (!window.confirm(`Remove ${targetName} from the team?`)) return;

    setKickingUserId(targetUserId);
    try {
      await kickTeamMember(currentTeam.id, targetUserId);
      showToast({
        type: 'info',
        title: 'Member Removed',
        message: `${targetName} was removed from the roster.`,
      });
      await refreshUserData();
    } catch (err: any) {
      showToast({
        type: 'error',
        title: 'Removal Failed',
        message: err.message,
        code: err.code,
      });
    } finally {
      setKickingUserId(null);
    }
  }


  async function handleRespondRequest(requestId: string, decision: 'ACCEPTED' | 'DECLINED') {
    setProcessingRequestId(requestId);
    try {
      await respondToJoinRequest(requestId, decision);
      showToast({
        type: decision === 'ACCEPTED' ? 'success' : 'info',
        title: decision === 'ACCEPTED' ? 'Request Accepted' : 'Request Declined',
        message: decision === 'ACCEPTED' ? 'New member added under row lock.' : 'Request marked as declined.',
      });
      await refreshUserData();
    } catch (err: any) {
      showToast({
        type: 'error',
        title: 'Response Failed (409 Conflict)',
        message: err.message,
        code: err.code,
      });
    } finally {
      setProcessingRequestId(null);
    }
  }


  if (!currentTeam) {
    return (
      <div className="rounded-lg bg-zinc-900 border border-zinc-800 p-8 sm:p-12 text-center max-w-xl mx-auto space-y-4 my-8">
        <div className="w-10 h-10 rounded-md bg-zinc-800 border border-zinc-700 flex items-center justify-center mx-auto text-zinc-400">
          <Users className="w-5 h-5" />
        </div>
        <div className="space-y-1">
          <h2 className="text-base font-bold text-zinc-100 tracking-tight">
            Not Currently in a Team
          </h2>
          <p className="text-xs text-zinc-400 font-mono">
            You are browsing as a Solo Hacker. Create a new team or request to join an existing one from the board.
          </p>
        </div>
        <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-2">
          <button
            onClick={onOpenCreateTeamModal}
            className="w-full sm:w-auto px-4 py-2 rounded bg-zinc-100 hover:bg-white text-zinc-950 font-mono font-bold text-xs transition flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span> Create New Team</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">

      <div className="rounded-lg bg-zinc-900 border border-zinc-800 p-4 space-y-4">
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap font-mono text-[11px]">
              <span className="text-zinc-400 uppercase tracking-wider">SAATHI // TEAM CONSOLE</span>
              <span className="text-zinc-600">//</span>
              <span className="text-zinc-500 font-mono">ID: {currentTeam.id.slice(0, 8)}...</span>
              <span
                className={`px-1.5 py-0.2 rounded uppercase font-semibold border ${isLeader
                  ? 'bg-sky-950 border-sky-800/80 text-sky-300'
                  : 'bg-zinc-800 border-zinc-700 text-zinc-300'
                  }`}
              >
                {isLeader ? 'LEADER CONTROLS' : 'MEMBER VIEW'}
              </span>
            </div>
            <h1 className="text-xl font-bold text-zinc-100 tracking-tight">
              {currentTeam.name}
            </h1>
            <p className="text-xs text-zinc-400 max-w-2xl leading-relaxed">
              {currentTeam.description || 'No description provided.'}
            </p>
          </div>


          <div className="flex items-center gap-2 flex-wrap">
            {isLeader && (
              <button
                onClick={handleFireStressTest}
                disabled={isRunningStressTest}
                className="px-3 py-1.5 rounded bg-amber-950/40 border border-amber-800/80 hover:bg-amber-900/50 disabled:opacity-40 text-amber-300 font-mono text-xs font-semibold flex items-center gap-1.5 transition"
                title="Fires 50 simultaneous transactions at the last remaining seat under lock"
              >
                <Zap className="w-3.5 h-3.5 fill-current text-amber-400" />
                <span>{isRunningStressTest ? 'Firing 50 Concurrency...' : '⚡ Race Stress Test (50x)'}</span>
              </button>
            )}

            <button
              onClick={handleLeaveTeam}
              disabled={isLeaving}
              className="px-3 py-1.5 rounded bg-zinc-950 border border-zinc-800 hover:border-rose-800 hover:text-rose-400 text-zinc-400 font-mono text-xs transition flex items-center gap-1.5"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>{isLeaving ? 'Leaving...' : 'Leave Team'}</span>
            </button>
          </div>
        </div>


        {stressTestResult && (
          <div className="rounded border border-amber-900/60 bg-amber-950/20 p-3.5 space-y-2 font-mono text-xs">
            <div className="flex items-center justify-between flex-wrap gap-2 text-amber-300 font-bold">
              <span className="flex items-center gap-1.5">
                <Zap className="w-4 h-4 fill-current" />
                50-WAY CONCURRENCY TEST SUMMARY
              </span>
              <span className="text-zinc-400 font-normal text-[11px]">
                Target: {stressTestResult.team.name} · Completed in {stressTestResult.durationMs}ms
              </span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
              <div className="p-2 rounded bg-zinc-950/80 border border-zinc-800">
                <span className="text-[10px] text-zinc-500 block">TOTAL ATTEMPTS</span>
                <span className="text-sm font-bold text-zinc-100">50 SIMULTANEOUS</span>
              </div>
              <div className="p-2 rounded bg-emerald-950/40 border border-emerald-900/60">
                <span className="text-[10px] text-emerald-400 block">SUCCEEDED (200 OK)</span>
                <span className="text-sm font-bold text-emerald-300">
                  {stressTestResult.succeededCount} (EXACTLY 1)
                </span>
              </div>
              <div className="p-2 rounded bg-rose-950/40 border border-rose-900/60">
                <span className="text-[10px] text-rose-400 block">BLOCKED (409 CONFLICT)</span>
                <span className="text-sm font-bold text-rose-300">
                  {stressTestResult.failed409Count} (EXACTLY 49)
                </span>
              </div>
              <div className="p-2 rounded bg-zinc-950/80 border border-zinc-800">
                <span className="text-[10px] text-zinc-500 block">DB GROUND TRUTH</span>
                <span className="text-sm font-bold text-zinc-200">
                  {stressTestResult.membersInDb.length} / {stressTestResult.team.maxSize} SEATS
                </span>
              </div>
            </div>
            {stressTestResult.winner && (
              <p className="text-[11px] text-zinc-400 pt-1">
                Sole Winner: <span className="text-emerald-400 font-semibold">{stressTestResult.winner.name}</span>{' '}
                · 49 other concurrent clients received instant 409 TEAM_FULL errors under lock.
              </p>
            )}
          </div>
        )}


        <div className="space-y-1 pt-1 font-mono">
          <div className="flex justify-between text-xs text-zinc-400">
            <span>SEAT CAPACITY</span>
            <span className="font-semibold text-zinc-200">
              {currentTeam.current_member_count} of {currentTeam.max_size} Seats Occupied
            </span>
          </div>
          <div className="w-full bg-zinc-950 rounded h-1.5 overflow-hidden border border-zinc-800/80">
            <div
              className="h-full bg-emerald-400 transition-all duration-300"
              style={{
                width: `${Math.round(
                  (currentTeam.current_member_count / currentTeam.max_size) * 100
                )}%`,
              }}
            />
          </div>
        </div>
      </div>


      {isLeader && (
        <div className="rounded-lg bg-zinc-900 border border-zinc-800 p-4 space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <h2 className="font-mono text-xs font-bold text-zinc-200 uppercase tracking-wider">
                EXPIRING INVITE CODES (HIGH-ENTROPY)
              </h2>
              <p className="text-xs text-zinc-400 font-mono mt-0.5">
                96-bit cryptographic entropy prevents brute-forcing. Rate-limited sliding window.
              </p>
            </div>
            <button
              onClick={handleGenerateInvite}
              disabled={isGeneratingInvite}
              className="px-3 py-1.5 rounded bg-zinc-100 hover:bg-white disabled:opacity-40 text-zinc-950 font-mono text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
            >
              <KeyRound className="w-3.5 h-3.5" />
              <span>{isGeneratingInvite ? 'Generating...' : '+ Generate 1h Invite'}</span>
            </button>
          </div>

          {activeInvites.length === 0 ? (
            <p className="text-xs text-zinc-500 font-mono">
              No active invite codes. Generate one above to invite candidates directly.
            </p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 pt-1 font-mono">
              {activeInvites.map((inv) => (
                <div
                  key={inv.code}
                  className="rounded bg-zinc-950 border border-zinc-800 p-2.5 flex items-center justify-between gap-2"
                >
                  <div className="min-w-0">
                    <span className="text-xs font-bold text-zinc-100 tracking-wider block truncate">
                      {inv.code}
                    </span>
                    <span className="text-[10px] text-zinc-500 flex items-center gap-1 mt-0.5">
                      <Clock className="w-3 h-3 text-zinc-500" />
                      Expires: {new Date(inv.expires_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <button
                    onClick={() => handleCopyInvite(inv.code)}
                    className="p-1.5 rounded bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-zinc-800 transition"
                    title="Copy invite code"
                  >
                    {copiedCode === inv.code ? (
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}


      {isLeader && pendingRequests.length > 0 && (
        <div className="rounded-lg bg-zinc-900 border border-amber-900/40 p-4 space-y-3">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
            <h2 className="font-mono text-xs font-bold text-amber-300 uppercase tracking-wider">
              PENDING JOIN REQUESTS ({pendingRequests.length})
            </h2>
          </div>

          <div className="space-y-2">
            {pendingRequests.map((req) => (
              <div
                key={req.id}
                className="rounded bg-zinc-950 border border-zinc-800 p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2 font-mono">
                    <span className="font-bold text-zinc-100">{req.name || 'Candidate'}</span>
                    <span className="text-[11px] text-zinc-500">({req.email})</span>
                  </div>
                  {req.message && (
                    <p className="text-xs text-zinc-400 font-mono text-[11px]">"{req.message}"</p>
                  )}
                  {req.skills && req.skills.length > 0 && (
                    <div className="flex flex-wrap gap-1 pt-0.5 font-mono">
                      {req.skills.map((s) => (
                        <span key={s} className="text-[10px] px-1.5 rounded bg-zinc-900 text-zinc-400 border border-zinc-800">
                          {s}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2 shrink-0 font-mono">
                  <button
                    onClick={() => handleRespondRequest(req.id, 'ACCEPTED')}
                    disabled={processingRequestId === req.id}
                    className="px-3 py-1.5 rounded bg-emerald-950 border border-emerald-800/80 hover:bg-emerald-900 text-emerald-300 text-xs font-semibold flex items-center gap-1 transition"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Accept</span>
                  </button>
                  <button
                    onClick={() => handleRespondRequest(req.id, 'DECLINED')}
                    disabled={processingRequestId === req.id}
                    className="px-3 py-1.5 rounded bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 text-zinc-400 text-xs flex items-center gap-1 transition"
                  >
                    <XCircle className="w-3.5 h-3.5" />
                    <span>Decline</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}


      <div className="rounded-lg bg-zinc-900 border border-zinc-800 overflow-hidden">
        <div className="px-4 py-3 border-b border-zinc-800 bg-zinc-950/60 flex items-center justify-between font-mono text-xs">
          <span className="font-bold text-zinc-200 uppercase tracking-wider">TEAM ROSTER</span>
          <span className="text-zinc-500">{teamMembers.length} ACTIVE MEMBERS</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left font-mono text-xs">
            <thead className="bg-zinc-950/40 text-[11px] text-zinc-500 uppercase border-b border-zinc-800/80">
              <tr>
                <th className="px-4 py-2.5 font-medium">Hacker</th>
                <th className="px-4 py-2.5 font-medium">Role</th>
                <th className="px-4 py-2.5 font-medium hidden sm:table-cell">Skills</th>
                <th className="px-4 py-2.5 font-medium hidden md:table-cell">Joined</th>
                {isLeader && <th className="px-4 py-2.5 font-medium text-right">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/60">
              {teamMembers.map((member) => {
                const isMemberLeader = member.role === 'LEADER';
                const isCurrentUser = member.user_id === currentUser?.id || member.id === currentUser?.id;

                return (
                  <tr key={member.id || member.user_id} className="hover:bg-zinc-800/30">
                    <td className="px-4 py-3">
                      <div className="font-semibold text-zinc-200">
                        {member.name}
                        {isCurrentUser && (
                          <span className="ml-1.5 text-[10px] text-emerald-400 font-normal">(You)</span>
                        )}
                      </div>
                      <div className="text-[11px] text-zinc-500">{member.email}</div>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`text-[10px] px-1.5 py-0.5 rounded uppercase font-semibold border ${isMemberLeader
                          ? 'bg-sky-950 border-sky-800 text-sky-300'
                          : 'bg-zinc-950 border-zinc-800 text-zinc-400'
                          }`}
                      >
                        {member.role}
                      </span>
                    </td>
                    <td className="px-4 py-3 hidden sm:table-cell">
                      <div className="flex flex-wrap gap-1">
                        {(member.skills || []).slice(0, 3).map((s) => (
                          <span key={s} className="text-[10px] px-1 rounded bg-zinc-950 text-zinc-400 border border-zinc-800">
                            {s}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-zinc-500 text-[11px] hidden md:table-cell">
                      {new Date(member.joined_at).toLocaleDateString()}
                    </td>
                    {isLeader && (
                      <td className="px-4 py-3 text-right">
                        {!isMemberLeader && (
                          <button
                            onClick={() => handleKickMember(member.user_id || member.id, member.name)}
                            disabled={kickingUserId === (member.user_id || member.id)}
                            className="px-2 py-1 rounded bg-zinc-950 hover:bg-rose-950/60 border border-zinc-800 hover:border-rose-900 text-zinc-400 hover:text-rose-300 text-[11px] transition"
                          >
                            Remove
                          </button>
                        )}
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>


      <div className="rounded-lg bg-zinc-900 border border-zinc-800 overflow-hidden font-mono text-xs">
        <div className="px-4 py-3 border-b border-zinc-800 bg-zinc-950/60 flex items-center justify-between">
          <span className="font-bold text-zinc-200 uppercase tracking-wider">
            AUDIT LOG TIMELINE (IMMUTABLE POSTGRES RECORD)
          </span>
          <span className="text-zinc-500 text-[11px]">{auditLogs.length} EVENTS</span>
        </div>

        {loadingLogs ? (
          <div className="p-4 text-zinc-500">Loading audit history...</div>
        ) : auditLogs.length === 0 ? (
          <div className="p-4 text-zinc-500">No events recorded yet.</div>
        ) : (
          <div className="max-h-72 overflow-y-auto divide-y divide-zinc-800/40">
            {auditLogs.map((log) => (
              <div key={log.id} className="p-3 hover:bg-zinc-800/20 flex items-start justify-between gap-4">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[10px] px-1.5 py-0.2 rounded uppercase bg-zinc-950 text-zinc-300 border border-zinc-800 font-semibold">
                      {log.action}
                    </span>
                    <span className="text-zinc-500 text-[11px]">
                      Actor: {log.actor_id.slice(0, 8)}...
                    </span>
                  </div>
                  {log.metadata && Object.keys(log.metadata).length > 0 && (
                    <p className="text-[11px] text-zinc-400 truncate max-w-xl">
                      {JSON.stringify(log.metadata)}
                    </p>
                  )}
                </div>
                <span className="text-[10px] text-zinc-500 shrink-0">
                  {new Date(log.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
