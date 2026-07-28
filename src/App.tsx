import {
  useEffect,
  useRef,
  useTransition,
} from "react";
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
        <p className="eyebrow">Enterprise conversational UI</p>
        <h1>Alliance Navigator</h1>
      </div>

      <div className="header-actions">
        <span className="conversation-badge">
          {conversationId
            ? `Conversation ${conversationId.slice(0, 8)}`
            : "New conversation"}
        </span>
        <button
          className="secondary-button"
          type="button"
          onClick={handleNewConversation}
          disabled={!conversationId || isPending}
        >
          {isPending ? "Starting…" : "New chat"}
        </button>
      </div>
    </header>
  );
}

function ConversationHistory() {
  const { conversationId, conversations } = useChatState();
  const { loadConversation } = useChatActions();

  return (
    <aside className="history-panel" aria-label="Chat history">
      <h2>Previous chats</h2>
      {conversations.length === 0 ? (
        <p className="history-empty">Your conversations will appear here.</p>
      ) : (
        <nav>
          {conversations.map((conversation) => (
            <button
              key={conversation.id}
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
          ))}
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
          <h2>Ask about an alliance</h2>
          <p>
            Try asking about Microsoft’s pipeline, key contacts or
            win stories.
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
