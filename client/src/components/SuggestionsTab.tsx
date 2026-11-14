import React, { useState, useEffect } from 'react';
import { fetchSuggestions } from '../api';
import { Suggestion } from '../types';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import {
  Compass,
  Copy,
  Clock,
  CheckCircle2,
  Users,
  Search,
  Code2,
  Terminal,
} from 'lucide-react';

export const SuggestionsTab: React.FC = () => {
  const { currentUser } = useAuth();
  const { showToast } = useToast();

  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    async function load() {
      if (!currentUser) return;
      setLoading(true);
      try {
        const data = await fetchSuggestions(15);
        if (mounted) setSuggestions(data);
      } catch (err: any) {
        console.warn('Could not load suggestions:', err);
      } finally {
        if (mounted) setLoading(false);
      }
    }
    load();
    return () => {
      mounted = false;
    };
  }, [currentUser]);

  function handleCopyCandidateInfo(s: Suggestion) {
    navigator.clipboard.writeText(`${s.user.name} (${s.user.skills.join(', ')})`);
    showToast({
      type: 'info',
      title: 'Copied Hacker Profile',
      message: `${s.user.name}'s skills copied to clipboard.`,
    });
  }

  return (
    <div className="space-y-4">

      <div className="rounded-lg bg-zinc-900 border border-zinc-800 p-4 space-y-3 font-mono text-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="uppercase tracking-wider text-zinc-400">
                SAATHI // TEAMMATE MATCHMAKER
              </span>
              <span className="text-[10px] px-1.5 py-0.2 rounded bg-zinc-800 text-zinc-300">
                EXPLAINABLE SCORING
              </span>
            </div>
            <h1 className="text-base sm:text-lg font-bold text-zinc-100 font-sans tracking-tight mt-0.5">
              Ranked Solo Hackers
            </h1>
            <p className="text-xs text-zinc-400 font-mono">
              Scored deterministically using complementary skill intersection and timezone overlap.
            </p>
          </div>

          <div className="p-3 rounded bg-zinc-950 border border-zinc-800 text-[11px] space-y-1">
            <span className="text-zinc-400 block font-bold">MATCHING ALGORITHM FORMULA</span>
            <code className="text-emerald-400 block font-semibold">
              Total = (0.65 × SkillScore) + (0.35 × TimezoneScore)
            </code>
            <p className="text-zinc-500 text-[10px]">
              SkillScore = matched / desired · TimezoneScore = max(0, 1 - (|Δtz| / 12))
            </p>
          </div>
        </div>


        {currentUser && (
          <div className="pt-2 flex flex-wrap items-center gap-2 text-xs border-t border-zinc-800/80">
            <span className="text-zinc-400">Target Match Skills:</span>
            {currentUser.desired_skills?.length > 0 ? (
              currentUser.desired_skills.map((skill) => (
                <span
                  key={skill}
                  className="px-2 py-0.5 rounded bg-zinc-950 text-zinc-300 border border-zinc-800 text-[11px]"
                >
                  {skill}
                </span>
              ))
            ) : (
              <span className="text-zinc-500">[ React, Node.js, Python, PostgreSQL ]</span>
            )}
            <span className="text-zinc-500 ml-1">
              · Base Timezone: UTC{currentUser.timezone_offset >= 0 ? '+' : ''}{currentUser.timezone_offset}
            </span>
          </div>
        )}
      </div>


      {loading && (
        <div className="space-y-2">
          {[1, 2, 3, 4].map((n) => (
            <div
              key={n}
              className="rounded-lg bg-zinc-900 border border-zinc-800 p-4 space-y-2 animate-pulse"
            >
              <div className="h-4 bg-zinc-800 rounded w-1/4" />
              <div className="h-3 bg-zinc-800 rounded w-1/2" />
            </div>
          ))}
        </div>
      )}


      {!loading && suggestions.length === 0 && (
        <div className="rounded-lg bg-zinc-900/40 border border-zinc-800 p-8 text-center space-y-2">
          <Users className="w-8 h-8 text-zinc-600 mx-auto" />
          <p className="font-mono text-xs text-zinc-300 font-semibold">NO MATCHES FOUND</p>
          <p className="text-xs text-zinc-500 max-w-sm mx-auto">
            All solo hackers are currently assigned or outside timezone thresholds.
          </p>
        </div>
      )}


      {!loading && suggestions.length > 0 && (
        <div className="space-y-2 font-mono">
          {suggestions.map((s, idx) => {
            const matchPercent = Math.round(s.totalScore * 100);
            const matchedSet = new Set(s.explanation.matchedSkills.map((x) => x.toLowerCase()));

            return (
              <div
                key={s.user.id}
                className="rounded-lg bg-zinc-900 border border-zinc-800 hover:border-zinc-700 p-3.5 transition flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
              >
                <div className="space-y-1.5 flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[11px] font-bold text-zinc-500">#{idx + 1}</span>
                    <span className="font-sans font-bold text-sm text-zinc-100">
                      {s.user.name}
                    </span>
                    <span
                      className={`text-[10px] px-1.5 py-0.5 rounded font-bold border ${matchPercent >= 80
                          ? 'bg-emerald-950 border-emerald-800/80 text-emerald-300'
                          : matchPercent >= 50
                            ? 'bg-amber-950 border-amber-800/80 text-amber-300'
                            : 'bg-zinc-800 border-zinc-700 text-zinc-400'
                        }`}
                    >
                      {matchPercent}% MATCH
                    </span>
                    <span className="text-[11px] text-zinc-500">
                      UTC{s.user.timezoneOffset >= 0 ? '+' : ''}{s.user.timezoneOffset} (Δ {s.explanation.timezoneDiffHours}h)
                    </span>
                  </div>


                  <div className="flex flex-wrap gap-1 pt-0.5">
                    {s.user.skills.map((skill) => {
                      const isMatched = matchedSet.has(skill.toLowerCase());
                      return (
                        <span
                          key={skill}
                          className={`text-[10px] px-1.5 py-0.2 rounded border ${isMatched
                              ? 'bg-emerald-950/60 border-emerald-800 text-emerald-300 font-semibold'
                              : 'bg-zinc-950 border-zinc-800 text-zinc-400'
                            }`}
                        >
                          {skill}
                        </span>
                      );
                    })}
                  </div>


                  <div className="text-[10px] text-zinc-400 pt-0.5 flex items-center gap-3 flex-wrap">
                    <span>Skill Match: {Math.round(s.explanation.skillScore * 100)}% (65% weight)</span>
                    <span>·</span>
                    <span>Timezone Overlap: {Math.round(s.explanation.timezoneScore * 100)}% (35% weight)</span>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-zinc-800">
                  <button
                    onClick={() => handleCopyCandidateInfo(s)}
                    className="px-2.5 py-1.5 rounded bg-zinc-950 border border-zinc-800 hover:bg-zinc-800 text-zinc-300 text-xs transition flex items-center gap-1.5 cursor-pointer"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copy Profile</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
