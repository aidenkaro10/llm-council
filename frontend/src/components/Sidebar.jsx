import './Sidebar.css';

export default function Sidebar({
  conversations,
  currentConversationId,
  onSelectConversation,
  onNewConversation,
  onDeleteConversation,
  stats,
  onOpenSettings,
}) {
  return (
    <div className="sidebar">
      <div className="sidebar-header">
        <h1>LLM Council</h1>
        <button className="new-conversation-btn" onClick={onNewConversation}>
          + New Conversation
        </button>
      </div>

      <div className="conversation-list">
        {conversations.length === 0 ? (
          <div className="no-conversations">No conversations yet</div>
        ) : (
          conversations.map((conv) => (
            <div
              key={conv.id}
              className={`conversation-item ${
                conv.id === currentConversationId ? 'active' : ''
              }`}
              onClick={() => onSelectConversation(conv.id)}
            >
              <div className="conversation-title">
                {conv.title || 'New Conversation'}
              </div>
              <div className="conversation-meta">
                {Math.floor(conv.message_count / 2) || 0} questions
              </div>
              <button
                className="delete-conversation"
                title="Delete this conversation"
                onClick={(e) => {
                  e.stopPropagation();
                  onDeleteConversation(conv.id);
                }}
              >
                x
              </button>
            </div>
          ))
        )}
      </div>

      <div className="sidebar-footer">
        {stats && stats.question_count > 0 && (
          <div className="lifetime-cost" title="Total spent across every conversation">
            <span>{stats.question_count} questions</span>
            <strong>${stats.total_cost.toFixed(3)}</strong>
          </div>
        )}
        <button className="settings-btn" onClick={onOpenSettings}>
          Settings
        </button>
      </div>
    </div>
  );
}
