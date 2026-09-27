import { useFlueAgent } from '@flue/react';
import { useState, type FormEvent } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';

const STORAGE_KEY = 'huaji-agent-debug-conversation';

function newConversationId() {
  return `debug-${crypto.randomUUID()}`;
}

function initialConversationId() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved?.startsWith('debug-')) return saved;
  const id = newConversationId();
  localStorage.setItem(STORAGE_KEY, id);
  return id;
}

function Chat({ conversationId }: { conversationId: string }) {
  const [input, setInput] = useState('');
  const [submitError, setSubmitError] = useState('');
  const agent = useFlueAgent({ url: `/api/debug/huaji/${conversationId}` });

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const message = input.trim();
    if (!message) return;
    setSubmitError('');
    try {
      await agent.sendMessage(message, {
        initialData: {
          conversationId: `huajibot:debug:${conversationId}`,
          destination: { bridgeInstance: 'debug', robotId: null, groupId: 'debug' },
        },
      });
      setInput('');
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : String(error));
    }
  }

  return (
    <>
      <div className="status" role="status">
        <span>{agent.status}</span>
        <span>{agent.historyReady ? 'History loaded' : 'Loading history'}</span>
        <button type="button" onClick={() => agent.refresh()}>
          Refresh
        </button>
      </div>
      <div className="messages" aria-live="polite">
        {agent.messages.length === 0 && (
          <p className="empty">Send a message to start this debug conversation.</p>
        )}
        {agent.messages.map((message) => (
          <article className={`message ${message.role}`} key={message.id}>
            <strong>{message.role}</strong>
            {message.parts.map((part, index) => {
              if (part.type === 'text') return <p key={index}>{part.text}</p>;
              if (part.type === 'reasoning')
                return (
                  <details key={index}>
                    <summary>Reasoning</summary>
                    <pre>{part.text}</pre>
                  </details>
                );
              if (part.type === 'dynamic-tool')
                return (
                  <details key={index}>
                    <summary>Tool: {part.toolName}</summary>
                    <pre>{JSON.stringify(part, null, 2)}</pre>
                  </details>
                );
              if (part.type === 'file')
                return (
                  <a key={index} href={part.url} target="_blank" rel="noreferrer">
                    Attachment
                  </a>
                );
              return null;
            })}
          </article>
        ))}
      </div>
      {submitError && (
        <p className="error" role="alert">
          {submitError}
        </p>
      )}
      {agent.error && (
        <p className="error" role="alert">
          {agent.error.message}
        </p>
      )}
      <form onSubmit={submit}>
        <textarea
          aria-label="Message"
          placeholder="Ask the agent…"
          value={input}
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault();
              event.currentTarget.form?.requestSubmit();
            }
          }}
        />
        <button type="submit" disabled={!input.trim()}>
          Send
        </button>
      </form>
    </>
  );
}

function App() {
  const [conversationId, setConversationId] = useState(initialConversationId);

  function startNew() {
    const next = newConversationId();
    localStorage.setItem(STORAGE_KEY, next);
    setConversationId(next);
  }

  return (
    <main>
      <header>
        <div>
          <h1>HuaJi Agent</h1>
          <p>Local debug chat</p>
        </div>
        <button type="button" onClick={startNew}>
          New conversation
        </button>
      </header>
      <div className="conversation-id">
        Conversation: <code>{conversationId}</code>
      </div>
      <Chat key={conversationId} conversationId={conversationId} />
    </main>
  );
}

createRoot(document.getElementById('root')!).render(<App />);
