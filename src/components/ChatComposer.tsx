import {
  memo,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";
import { Send, Square } from "iconoir-react";
import {
  useChatActions,
  useChatPhase,
} from "../context/chatContext";

export const ChatComposer = memo(function ChatComposer() {
  const [value, setValue] = useState("");
  const phase = useChatPhase();
  const { cancelResponse, sendMessage } = useChatActions();
  const inputRef = useRef<HTMLInputElement>(null);
  const previousPhaseRef = useRef(phase);
  const isStreaming = phase === "streaming";

  useEffect(() => {
    if (
      previousPhaseRef.current === "streaming" &&
      phase === "idle"
    ) {
      inputRef.current?.focus();
    }

    previousPhaseRef.current = phase;
  }, [phase]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const prompt = value.trim();

    if (!prompt || isStreaming) {
      return;
    }

    setValue("");
    void sendMessage(prompt);
  }

  return (
    <form className="composer" onSubmit={handleSubmit}>
      <label htmlFor="chat-input">Ask about an alliance</label>

      <div className="composer__row">
        <input
          ref={inputRef}
          id="chat-input"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          placeholder="Ask about alliance performance, contacts or win stories"
          disabled={isStreaming}
          aria-describedby="composer-help"
        />

        {isStreaming ? (
          <button
            className="cancel-button"
            type="button"
            onClick={cancelResponse}
            aria-label="Stop response"
            title="Stop response"
          >
            <Square aria-hidden="true" width={20} height={20} />
          </button>
        ) : (
          <button
            type="submit"
            disabled={!value.trim()}
            aria-label="Send message"
            title="Send message"
          >
            <Send aria-hidden="true" width={20} height={20} />
          </button>
        )}
      </div>

      <small id="composer-help">
        Demo scenarios are labeled; standard prompts use the AI provider.
      </small>
    </form>
  );
});
