import React, { useState, useEffect } from 'react';
import { createTeam } from '../api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { Plus, X, Users, Terminal } from 'lucide-react';

interface CreateTeamModalProps {
  isOpen: boolean;
  onClose: () => void;
  onTeamCreated: () => void;
}

export const CreateTeamModal: React.FC<CreateTeamModalProps> = ({
  isOpen,
  onClose,
  onTeamCreated,
}) => {
  const { currentUser, refreshUserData } = useAuth();
  const { showToast } = useToast();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [minSize, setMinSize] = useState(2);
  const [maxSize, setMaxSize] = useState(4);
  const [skillsInput, setSkillsInput] = useState('React, TypeScript, Node.js');
  const [isSubmitting, setIsSubmitting] = useState(false);

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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!currentUser) return;

    if (!name.trim()) {
      showToast({ type: 'warning', title: 'Missing Team Name', message: 'Enter a valid team name.' });
      return;
    }

    if (minSize < 1 || maxSize < minSize) {
      showToast({ type: 'error', title: 'Invalid Bounds', message: 'Min size must be ≥ 1 and Max size ≥ Min size.' });
      return;
    }

    setIsSubmitting(true);
    try {
      const skills = skillsInput
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);

      const newTeam = await createTeam({
        hackathonId: 'hack_2026',
        name: name.trim(),
        description: description.trim(),
        minSize,
        maxSize,
        requiredSkills: skills,
      });

      showToast({
        type: 'success',
        title: 'Team Created',
        message: `"${newTeam.name}" initialized under transaction lock.`,
      });

      await refreshUserData();
      onTeamCreated();
      onClose();
    } catch (err: any) {
      showToast({
        type: 'error',
        title: 'Creation Failed (Conflict)',
        message: err.message,
        code: err.code || 'CONFLICT',
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[100] overflow-y-auto bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 font-mono text-xs"
      role="dialog"
      aria-modal="true"
      aria-labelledby="create-team-modal-title"
    >
      <div className="relative w-full max-w-lg rounded-lg bg-zinc-900 border border-zinc-800 shadow-2xl overflow-hidden text-zinc-100 flex flex-col">

        <div className="p-4 border-b border-zinc-800 flex items-center justify-between bg-zinc-950/80">
          <div className="flex items-center gap-2">
            <Terminal className="w-4 h-4 text-zinc-400" />
            <h2 id="create-team-modal-title" className="font-bold text-xs uppercase tracking-wider text-zinc-100">
              CREATE NEW TEAM
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


        <form onSubmit={handleSubmit} className="p-4 space-y-4 font-sans text-xs">
          <div className="space-y-1 font-mono">
            <label className="text-[11px] font-bold text-zinc-300 block uppercase">
              Team Name *
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Distributed Consensus Engine"
              className="w-full px-3 py-1.5 rounded bg-zinc-950 border border-zinc-800 text-xs text-zinc-100 placeholder-zinc-600 focus-visible:ring-1 focus-visible:ring-sky-400 font-mono"
            />
          </div>

          <div className="space-y-1 font-mono">
            <label className="text-[11px] font-bold text-zinc-300 block uppercase">
              Project Description
            </label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What are you building? e.g. Building an ultra-low-latency consensus protocol..."
              className="w-full px-3 py-1.5 rounded bg-zinc-950 border border-zinc-800 text-xs text-zinc-100 placeholder-zinc-600 focus-visible:ring-1 focus-visible:ring-sky-400 font-mono resize-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3 font-mono">
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-zinc-300 block uppercase">
                Min Team Size
              </label>
              <input
                type="number"
                min={1}
                max={10}
                value={minSize}
                onChange={(e) => setMinSize(parseInt(e.target.value) || 1)}
                className="w-full px-3 py-1.5 rounded bg-zinc-950 border border-zinc-800 text-xs text-zinc-100 focus-visible:ring-1 focus-visible:ring-sky-400 font-mono"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-zinc-300 block uppercase">
                Max Team Size
              </label>
              <input
                type="number"
                min={1}
                max={10}
                value={maxSize}
                onChange={(e) => setMaxSize(parseInt(e.target.value) || 1)}
                className="w-full px-3 py-1.5 rounded bg-zinc-950 border border-zinc-800 text-xs text-zinc-100 focus-visible:ring-1 focus-visible:ring-sky-400 font-mono"
              />
            </div>
          </div>

          <div className="space-y-1 font-mono">
            <label className="text-[11px] font-bold text-zinc-300 block uppercase">
              Required Skills (comma separated)
            </label>
            <input
              type="text"
              value={skillsInput}
              onChange={(e) => setSkillsInput(e.target.value)}
              placeholder="TypeScript, PostgreSQL, React, etc."
              className="w-full px-3 py-1.5 rounded bg-zinc-950 border border-zinc-800 text-xs text-zinc-100 placeholder-zinc-600 focus-visible:ring-1 focus-visible:ring-sky-400 font-mono"
            />
          </div>

          <div className="p-3 rounded bg-zinc-950 border border-zinc-800/80 text-[11px] font-mono text-zinc-400 space-y-0.5">
            <span className="text-zinc-300 font-bold block">INVARIANT GUARANTEE</span>
            <p>
              Creating this team assigns you as <code className="text-sky-300">LEADER</code> and sets member count to 1 inside an atomic PostgreSQL transaction.
            </p>
          </div>

          <div className="pt-2 flex items-center justify-end gap-2 font-mono">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !name.trim()}
              className="px-4 py-1.5 rounded bg-zinc-100 hover:bg-white disabled:opacity-40 text-zinc-950 font-bold text-xs transition cursor-pointer flex items-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{isSubmitting ? 'Creating...' : 'Initialize Team'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
