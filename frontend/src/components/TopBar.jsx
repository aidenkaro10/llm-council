import { Menu, Plus, Settings as SettingsIcon, Volume2, VolumeX } from 'lucide-react';
import { money } from '../lib/cost';

/** Two glass pills floating over the chamber: the menu on the left, tools on the right. */
export default function TopBar({ stats, onOpenMenu, onNewConversation, onOpenSettings, soundOn, onToggleSound }) {
  const pill = 'glass flex items-center gap-1 rounded-full p-1';
  const icon =
    'flex h-9 w-9 items-center justify-center rounded-full text-white/80 transition hover:bg-white/10 hover:text-white cursor-pointer';

  return (
    <header className="pointer-events-none fixed inset-x-0 top-0 z-30 flex items-center justify-between p-3 sm:p-4">
      <div className={`${pill} pointer-events-auto pr-4`}>
        <button className={icon} onClick={onOpenMenu} title="Conversations">
          <Menu className="h-4 w-4" />
        </button>
        <span className="text-[11px] font-semibold tracking-[0.38em] text-white">LLM COUNCIL</span>
      </div>

      <div className={`${pill} pointer-events-auto`}>
        {stats?.question_count > 0 && (
          <span
            className="hidden px-3 font-mono text-[11.5px] text-[var(--success)] sm:inline"
            title={`Spent across ${stats.question_count} questions`}
          >
            {money(stats.total_cost)}
          </span>
        )}
        <button
          className={icon}
          onClick={onToggleSound}
          title={soundOn ? 'Sound off' : 'Sound on'}
          aria-pressed={soundOn}
        >
          {soundOn ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4 opacity-60" />}
        </button>
        <button className={icon} onClick={onNewConversation} title="New conversation">
          <Plus className="h-4 w-4" />
        </button>
        <button className={icon} onClick={onOpenSettings} title="Settings">
          <SettingsIcon className="h-4 w-4" />
        </button>
      </div>
    </header>
  );
}
