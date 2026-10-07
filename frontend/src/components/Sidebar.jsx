import { Plus, Settings as SettingsIcon, Trash2, Sun, Moon, Scale, X } from 'lucide-react';
import { Button, cn } from './ui';
import { money } from '../lib/cost';

export default function Sidebar({
  conversations,
  currentConversationId,
  onSelectConversation,
  onNewConversation,
  onDeleteConversation,
  stats,
  onOpenSettings,
  theme,
  onToggleTheme,
  open,
  onClose,
}) {
  return (
    <>
      {/* on phones the sidebar slides over the chat, with a dimmed backdrop */}
      {open && (
        <div
          className="fixed inset-0 z-30 bg-black/40 backdrop-blur-[2px] md:hidden"
          onClick={onClose}
        />
      )}
    <aside
      className={cn(
        'z-40 flex h-full w-[280px] shrink-0 flex-col border-r border-[var(--border)] bg-[var(--background)] md:w-[264px] md:bg-[var(--muted)]/40',
        'fixed inset-y-0 left-0 transition-transform duration-200 md:static md:translate-x-0',
        open ? 'translate-x-0 shadow-2xl' : '-translate-x-full'
      )}
    >
      <div className="flex items-center gap-2 px-4 pt-4 pb-3">
        <Scale className="h-[18px] w-[18px]" strokeWidth={2} />
        <span className="flex-1 text-[15px] font-semibold tracking-tight">
          LLM Council
        </span>
        <Button
          variant="ghost"
          size="icon"
          onClick={onToggleTheme}
          title={theme === 'dark' ? 'Switch to light' : 'Switch to dark'}
        >
          {theme === 'dark' ? (
            <Sun className="h-4 w-4" />
          ) : (
            <Moon className="h-4 w-4" />
          )}
        </Button>
        <Button variant="ghost" size="icon" className="md:hidden" onClick={onClose} title="Close">
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="px-3 pb-3">
        <Button variant="primary" className="w-full" onClick={onNewConversation}>
          <Plus className="h-4 w-4" />
          New conversation
        </Button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-2">
        {conversations.length === 0 ? (
          <p className="px-3 py-6 text-center text-[13px] text-[var(--muted-foreground)]">
            Nothing yet. Ask the council something.
          </p>
        ) : (
          <ul className="space-y-0.5">
            {conversations.map((conv) => (
              <li key={conv.id}>
                <div
                  onClick={() => onSelectConversation(conv.id)}
                  className={cn(
                    'group flex cursor-pointer items-center gap-2 rounded-[var(--radius)] px-3 py-2 transition-colors',
                    conv.id === currentConversationId
                      ? 'bg-[var(--card)] shadow-xs ring-1 ring-[var(--border)]'
                      : 'hover:bg-[var(--card)]/60'
                  )}
                >
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[13px] font-medium">
                      {conv.title || 'New conversation'}
                    </div>
                    <div className="text-[11px] text-[var(--muted-foreground)]">
                      {Math.floor(conv.message_count / 2) || 0} question
                      {Math.floor(conv.message_count / 2) === 1 ? '' : 's'}
                    </div>
                  </div>
                  <button
                    className="shrink-0 rounded-md p-1 text-[var(--muted-foreground)] opacity-60 transition hover:bg-[var(--danger)]/10 hover:text-[var(--danger)] md:opacity-0 md:group-hover:opacity-100 cursor-pointer"
                    title="Delete"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteConversation(conv.id);
                    }}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="border-t border-[var(--border)] p-3">
        {stats?.question_count > 0 && (
          <div className="mb-2 flex items-baseline justify-between px-1 font-mono text-[11px] text-[var(--muted-foreground)]">
            <span>
              {stats.question_count} question
              {stats.question_count === 1 ? '' : 's'}
            </span>
            <span className="text-[var(--success)]">{money(stats.total_cost)}</span>
          </div>
        )}
        <Button variant="outline" className="w-full" onClick={onOpenSettings}>
          <SettingsIcon className="h-4 w-4" />
          Settings
        </Button>
      </div>
    </aside>
    </>
  );
}
