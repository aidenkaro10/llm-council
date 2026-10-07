import { Plus, Trash2, X } from 'lucide-react';
import { cn } from './ui';

/** Past conversations, in a drawer that slides over everything. */
export default function Sidebar({
  conversations,
  currentConversationId,
  onSelectConversation,
  onNewConversation,
  onDeleteConversation,
  open,
  onClose,
}) {
  return (
    <>
      <div
        className={cn(
          'fixed inset-0 z-40 bg-black/50 backdrop-blur-[2px] transition-opacity duration-300',
          open ? 'opacity-100' : 'pointer-events-none opacity-0'
        )}
        onClick={onClose}
      />
      <aside
        className={cn(
          'glass fixed inset-y-3 left-3 z-50 flex w-[300px] max-w-[calc(100vw-24px)] flex-col rounded-3xl transition-transform duration-300 ease-out',
          open ? 'translate-x-0' : '-translate-x-[calc(100%+24px)]'
        )}
      >
        <div className="flex items-center justify-between px-5 pt-5 pb-3">
          <span className="text-[11px] font-semibold tracking-[0.38em] text-white/70">HISTORY</span>
          <button
            className="flex h-8 w-8 items-center justify-center rounded-full text-white/70 hover:bg-white/10 cursor-pointer"
            onClick={onClose}
            title="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="px-3 pb-2">
          <button
            onClick={onNewConversation}
            className="flex w-full items-center justify-center gap-2 rounded-full bg-white py-2.5 text-[13px] font-medium text-black transition hover:bg-white/90 cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            New question
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-3">
          {conversations.length === 0 ? (
            <p className="px-3 py-8 text-center text-[13px] text-white/40">Nothing yet.</p>
          ) : (
            <ul className="space-y-0.5">
              {conversations.map((conv) => (
                <li key={conv.id}>
                  <div
                    onClick={() => onSelectConversation(conv.id)}
                    className={cn(
                      'group flex cursor-pointer items-center gap-2 rounded-2xl px-3 py-2.5 transition-colors',
                      conv.id === currentConversationId ? 'bg-white/10' : 'hover:bg-white/5'
                    )}
                  >
                    <span className="min-w-0 flex-1 truncate text-[13.5px] text-white/90">
                      {conv.title || 'New conversation'}
                    </span>
                    <button
                      className="shrink-0 rounded-full p-1.5 text-white/40 opacity-70 transition hover:bg-[var(--danger)]/15 hover:text-[var(--danger)] md:opacity-0 md:group-hover:opacity-100 cursor-pointer"
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
      </aside>
    </>
  );
}
