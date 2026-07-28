import {
  useEffect,
  useRef,
  useState,
  useTransition,
  type FormEvent,
} from "react";
import { EditPencil, Trash } from "iconoir-react";
import { AssistantMessage } from "./components/AssistantMessage";
import { ChatComposer } from "./components/ChatComposer";
import { UserMessage } from "./components/UserMessage";
import { ChatProvider } from "./context/ChatProvider";
import {
  useChatActions,
  useChatPhase,
  useChatState,
} from "./context/chatContext";

function ConversationHeader() {
  const { conversationId } = useChatState();
  const { startNewConversation } = useChatActions();
  const [isPending, startTransition] = useTransition();

  function handleNewConversation() {
    // Switching a potentially long transcript is non-urgent UI work.
    startTransition(startNewConversation);
  }

  return (
    <header className="app-header">
      <div>
        <p className="eyebrow">EY alliance intelligence concept</p>
        <h1>EY Alliance Intelligence</h1>
      </div>

      <div className="header-actions">
        <span className="conversation-badge">
          {conversationId
            ? `Conversation ID ${conversationId.slice(0, 8)}`
            : "New conversation"}
        </span>
        <button
          className="secondary-button"
          type="button"
          onClick={handleNewConversation}
          disabled={!conversationId || isPending}
        >
          {isPending ? "Starting…" : "+ New chat"}
        </button>
      </div>
    </header>
  );
}

function ConversationHistory() {
  const { conversationId, conversations } = useChatState();
  const {
    deleteConversation,
    loadConversation,
    renameConversation,
  } = useChatActions();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftTitle, setDraftTitle] = useState("");

  function startRenaming(id: string, title: string) {
    setEditingId(id);
    setDraftTitle(title);
  }

  function handleRename(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingId || !draftTitle.trim()) return;
    renameConversation(editingId, draftTitle);
    setEditingId(null);
  }

  function handleDelete(id: string, title: string) {
    if (window.confirm(`Delete "${title}" from chat history?`)) {
      deleteConversation(id);
    }
  }

  return (
    <aside className="history-panel" aria-label="Chat history">
      <h2>Previous chats</h2>
      {conversations.length === 0 ? (
        <p className="history-empty">Your conversations will appear here.</p>
      ) : (
        <nav>
          {conversations.map((conversation) =>
            editingId === conversation.id ? (
              <form
                className="history-rename-form"
                key={conversation.id}
                onSubmit={handleRename}
              >
                <label className="sr-only" htmlFor={`title-${conversation.id}`}>
                  Conversation name
                </label>
                <input
                  id={`title-${conversation.id}`}
                  maxLength={60}
                  value={draftTitle}
                  onChange={(event) => setDraftTitle(event.target.value)}
                  autoFocus
                />
                <div>
                  <button type="submit" disabled={!draftTitle.trim()}>
                    Save
                  </button>
                  <button type="button" onClick={() => setEditingId(null)}>
                    Cancel
                  </button>
                </div>
              </form>
            ) : (
              <div className="history-entry" key={conversation.id}>
                <button
                  type="button"
                  className="history-item"
                  aria-current={
                    conversation.id === conversationId ? "page" : undefined
                  }
                  onClick={() => loadConversation(conversation.id)}
                >
                  <span>{conversation.title}</span>
                  <time dateTime={conversation.updatedAt}>
                    {new Intl.DateTimeFormat(undefined, {
                      month: "short",
                      day: "numeric",
                    }).format(new Date(conversation.updatedAt))}
                  </time>
                </button>
                <div className="history-actions">
                  <button
                    className="history-icon-button"
                    type="button"
                    aria-label={`Rename ${conversation.title}`}
                    title="Rename chat"
                    onClick={() =>
                      startRenaming(conversation.id, conversation.title)
                    }
                  >
                    <EditPencil aria-hidden="true" width={18} height={18} />
                  </button>
                  <button
                    className="history-icon-button history-delete-button"
                    type="button"
                    aria-label={`Delete ${conversation.title}`}
                    title="Delete chat"
                    onClick={() =>
                      handleDelete(conversation.id, conversation.title)
                    }
                  >
                    <Trash aria-hidden="true" width={18} height={18} />
                  </button>
                </div>
              </div>
            )
          )}
        </nav>
      )}
    </aside>
  );
}

function ChatStatusAnnouncer() {
  const phase = useChatPhase();

  return (
    <p className="sr-only" role="status" aria-live="polite">
      {phase === "streaming"
        ? "Assistant response started."
        : "Assistant is ready."}
    </p>
  );
}

function ChatTranscript() {
  const { messages, phase, error } = useChatState();
  const transcriptRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const transcript = transcriptRef.current;

    if (transcript) {
      transcript.scrollTop = transcript.scrollHeight;
    }
  }, [messages]);

  return (
    <section
      ref={transcriptRef}
      className="transcript"
      role="log"
      aria-live="off"
      aria-label="Chat transcript"
      aria-busy={phase === "streaming"}
    >
      {messages.length === 0 && (
        <div className="empty-state">
          <h2>Explore strategic alliances</h2>
          <p>
            Ask about alliance performance, key contacts or win stories.
          </p>
        </div>
      )}

      {messages.map((message) =>
        message.role === "user" ? (
          <UserMessage key={message.id} message={message} />
        ) : (
          <AssistantMessage key={message.id} message={message} />
        )
      )}

      {error && (
        <p className="request-error" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}

function ChatExperience() {
  return (
    <div className="app-layout">
      <ConversationHistory />
      <main className="app-shell">
        <ConversationHeader />
        <ChatStatusAnnouncer />
        <ChatTranscript />
        <ChatComposer />
        <p className="concept-note">
          Concept demo for portfolio purposes. Not an official EY product.
        </p>
      </main>
    </div>
  );
}

function App() {
  return (
    <ChatProvider>
      <ChatExperience />
    </ChatProvider>
  );
}

export default App;
