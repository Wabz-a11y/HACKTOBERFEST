import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { agentApi, clinicalApi } from '../../services/api';
import { HospitalFacility } from '../../types';
import { CameraCapture } from '../../components/CameraCapture';
import { MapView } from '../../components/MapView';
import {
  Send,
  Camera,
  Bot,
  User,
  RefreshCw,
  Plus,
  History,
  ChevronLeft,
  ChevronRight,
  Trash2,
  MessageSquare,
} from 'lucide-react';

// ─── Types ──────────────────────────────────────────────────────────────────

interface ChatMessage {
  id: string;
  sender: 'user' | 'agent';
  text: string;
  image?: string;
  timestamp: string; // ISO
  hospitals?: HospitalFacility[];
}

interface ChatSession {
  id: string;
  title: string;
  timestamp: string; // ISO
  messages: ChatMessage[];
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const createDefaultSession = (): ChatSession => ({
  id: `session-${Date.now()}`,
  title: 'New Chat',
  timestamp: new Date().toISOString(),
  messages: [],
});

const STORAGE_KEY_PREFIX = 'medagent_chats_';

const loadSessions = (userId: string): ChatSession[] => {
  try {
    const raw = localStorage.getItem(`${STORAGE_KEY_PREFIX}${userId}`);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (_) {}
  return [];
};

const saveSessions = (userId: string, sessions: ChatSession[]) => {
  try {
    localStorage.setItem(`${STORAGE_KEY_PREFIX}${userId}`, JSON.stringify(sessions));
  } catch (_) {}
};

const formatRelativeTime = (iso: string): string => {
  const date = new Date(iso);
  if (isNaN(date.getTime())) return '';
  const now = new Date();
  const diffMs = Math.max(0, now.getTime() - date.getTime());
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);

  const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const isToday = date.toDateString() === now.toDateString();

  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const isYesterday = date.toDateString() === yesterday.toDateString();

  if (isToday) {
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 6) return `${diffHours}h ago`;
    return `Today ${timeStr}`;
  }
  if (isYesterday) return `Yesterday ${timeStr}`;
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays < 7) {
    const weekday = date.toLocaleDateString([], { weekday: 'short' });
    return `${weekday} ${timeStr}`;
  }
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
};

const formatMsgTime = (iso: string): string => {
  const date = new Date(iso);
  if (isNaN(date.getTime())) return '';
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

// ─── Markdown-ish Renderer ────────────────────────────────────────────────────

const renderFormattedText = (text: string): React.ReactNode => {
  const lines = text.split('\n');
  return lines.map((line, index) => {
    // Bold inline
    const parts = line.split(/(\*\*.*?\*\*)/g);
    const renderInline = (parts: string[]) =>
      parts.map((part, i) => {
        if (part.startsWith('**') && part.endsWith('**')) {
          return (
            <strong key={i} className="font-bold text-slate-900">
              {part.slice(2, -2)}
            </strong>
          );
        }
        return <span key={i}>{part}</span>;
      });

    // H3 heading
    if (line.startsWith('### ')) {
      return (
        <h4 key={index} className="text-sm font-bold text-sky-700 mt-2 mb-1">
          {line.replace('### ', '')}
        </h4>
      );
    }
    // H4 heading
    if (line.startsWith('## ')) {
      return (
        <h3 key={index} className="text-sm font-bold text-primary-700 mt-2 mb-1">
          {line.replace('## ', '')}
        </h3>
      );
    }
    // Bullet
    if (line.startsWith('- ') || line.startsWith('• ')) {
      return (
        <div key={index} className="flex gap-2 ml-2 mb-1 text-sm">
          <span className="text-sky-600 font-bold shrink-0">•</span>
          <span>{renderInline(line.replace(/^[-•]\s/, '').split(/(\*\*.*?\*\*)/g))}</span>
        </div>
      );
    }
    // Numbered list
    if (/^\d+\.\s/.test(line)) {
      return (
        <div key={index} className="flex gap-2 ml-2 mb-1 text-sm">
          {renderInline(parts)}
        </div>
      );
    }
    // Empty line → spacer
    if (!line.trim()) {
      return <div key={index} className="h-1.5" />;
    }
    // Paragraph
    return (
      <p key={index} className="text-sm leading-relaxed mb-1">
        {renderInline(parts)}
      </p>
    );
  });
};

// ─── Typewriter Component ─────────────────────────────────────────────────────

const TypewriterMessage: React.FC<{ text: string; isLatest: boolean }> = ({ text, isLatest }) => {
  const [displayed, setDisplayed] = useState(isLatest ? '' : text);
  const [typing, setTyping] = useState(isLatest);

  useEffect(() => {
    if (!isLatest) {
      setDisplayed(text);
      setTyping(false);
      return;
    }
    let i = 0;
    setDisplayed('');
    setTyping(true);
    const iv = setInterval(() => {
      i += Math.floor(Math.random() * 3) + 2;
      if (i >= text.length) {
        setDisplayed(text);
        setTyping(false);
        clearInterval(iv);
      } else {
        setDisplayed(text.slice(0, i));
      }
    }, 16);
    return () => clearInterval(iv);
  }, [text, isLatest]);

  return (
    <>
      {renderFormattedText(displayed)}
      {typing && (
        <span className="inline-block w-0.5 h-4 bg-sky-500 animate-pulse ml-0.5 align-middle" />
      )}
    </>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────

export const PatientChat: React.FC = () => {
  const { user } = useAuth();
  const location = useLocation();

  const storageUserId = user?.id || 'guest';

  // Sessions state — new clean session always first
  const [initialSession] = useState<ChatSession>(createDefaultSession);
  const [sessions, setSessions] = useState<ChatSession[]>(() => {
    const stored = loadSessions(storageUserId);
    return [initialSession, ...stored];
  });
  const [activeSessionId, setActiveSessionId] = useState<string>(initialSession.id);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Open camera if directed by URL param
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get('action') === 'camera') setShowCamera(true);
  }, [location]);

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [sessions, loading, activeSessionId]);

  // Persist to localStorage on session changes
  useEffect(() => {
    // Only save sessions with real exchanges
    const toSave = sessions.filter(
      (s) => s.messages.some((m) => m.sender === 'user') && s.id !== initialSession.id
    );
    saveSessions(storageUserId, toSave);
  }, [sessions, storageUserId, initialSession.id]);

  const activeSession =
    sessions.find((s) => s.id === activeSessionId) || sessions[0] || initialSession;
  const activeMessages = activeSession?.messages ?? [];

  // History = only sessions with user messages
  const historySessions = sessions.filter((s) =>
    s.messages.some((m) => m.sender === 'user')
  );

  // ── Session management ──────────────────────────────────────────────────

  const handleNewChat = useCallback(() => {
    const fresh = createDefaultSession();
    setSessions((prev) => [fresh, ...prev]);
    setActiveSessionId(fresh.id);
    setInput('');
  }, []);

  const handleSelectSession = useCallback((sessionId: string) => {
    setActiveSessionId(sessionId);
    setSidebarOpen(false);
  }, []);

  const handleDeleteSession = useCallback(
    (e: React.MouseEvent, sessionId: string) => {
      e.stopPropagation();
      setSessions((prev) => {
        const filtered = prev.filter((s) => s.id !== sessionId);
        const remaining = filtered.length > 0 ? filtered : [createDefaultSession()];
        if (activeSessionId === sessionId) setActiveSessionId(remaining[0].id);
        return remaining;
      });
    },
    [activeSessionId]
  );

  // ── Send / receive ──────────────────────────────────────────────────────

  const appendMessage = useCallback(
    (sessionId: string, msg: ChatMessage, newTitle?: string) => {
      setSessions((prev) =>
        prev.map((s) => {
          if (s.id !== sessionId) return s;
          const isGeneric = s.title === 'New Chat';
          return {
            ...s,
            title: newTitle || (isGeneric ? s.title : s.title),
            timestamp: new Date().toISOString(),
            messages: [...s.messages, msg],
          };
        })
      );
    },
    []
  );

  const handleSend = useCallback(
    async (customText?: string, customImage?: string) => {
      const textToSend = customText !== undefined ? customText : input.trim();
      if (!textToSend && !customImage) return;

      const nowIso = new Date().toISOString();
      const targetSessionId = activeSessionId;

      // Derive session title from first user message
      const sessionTitle =
        activeSession.title === 'New Chat' && textToSend
          ? textToSend.length > 35
            ? textToSend.slice(0, 35) + '…'
            : textToSend
          : activeSession.title;

      const userMsg: ChatMessage = {
        id: `user-${Date.now()}`,
        sender: 'user',
        text: textToSend,
        image: customImage,
        timestamp: nowIso,
      };

      setSessions((prev) =>
        prev.map((s) => {
          if (s.id !== targetSessionId) return s;
          return {
            ...s,
            title: sessionTitle,
            timestamp: nowIso,
            messages: [...s.messages, userMsg],
          };
        })
      );

      if (customText === undefined) setInput('');
      if (textareaRef.current) textareaRef.current.style.height = 'auto';
      setLoading(true);

      try {
        const data = await agentApi.chat(
          textToSend || 'Please analyze this scanned prescription image.',
          `session_${user?.id || 'default'}`,
          customImage,
          user
        );

        // Only attach emergency facilities if backend flagged is_emergency or returned hospitals
        let hospitals: HospitalFacility[] | undefined = data.hospitals;
        if (!hospitals && data.is_emergency) {
          try {
            const hospData = await clinicalApi.getNearbyHospitals();
            hospitals = hospData.hospitals;
          } catch (_) {}
        }

        const agentMsg: ChatMessage = {
          id: `agent-${Date.now()}`,
          sender: 'agent',
          text: data.output,
          timestamp: new Date().toISOString(),
          hospitals,
        };

        appendMessage(targetSessionId, agentMsg);
      } catch (_) {
        const errMsg: ChatMessage = {
          id: `err-${Date.now()}`,
          sender: 'agent',
          text: 'I encountered a brief issue connecting to the clinical inference engine. Please check your network and try again.',
          timestamp: new Date().toISOString(),
        };
        appendMessage(targetSessionId, errMsg);
      } finally {
        setLoading(false);
      }
    },
    [input, activeSessionId, activeSession, user, appendMessage]
  );

  const handleCameraCapture = useCallback(
    (base64Image: string) => {
      handleSend('Please analyze this prescription photograph and extract all medication details.', base64Image);
    },
    [handleSend]
  );

  // Auto-resize textarea
  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    e.target.style.height = 'auto';
    e.target.style.height = `${Math.min(e.target.scrollHeight, 120)}px`;
  };

  const handleTextareaKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // ── Quick prompts ────────────────────────────────────────────────────────

  const quickPrompts = [
    {
      label: 'Missed Dose Protocol',
      text: 'What should I do if I missed my morning Metformin dose?',
      variant: 'default',
    },
    {
      label: 'Food Interaction Check',
      text: 'Can I drink grapefruit juice with my Atorvastatin medication?',
      variant: 'default',
    },
    {
      label: '🚨 Emergency Triage Test',
      text: 'I have acute crushing chest pain, what should I do?',
      variant: 'emergency',
    },
  ];

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="max-w-5xl mx-auto px-2 sm:px-4 py-4 h-[calc(100vh-5rem)] flex flex-col gap-3">

      {/* ── Agent Banner ─────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl px-4 py-3 border border-slate-200 shadow-sm flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-gradient-to-tr from-sky-600 to-primary-600 text-white rounded-xl shadow-md shrink-0">
            <Bot className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-bold text-slate-900 text-sm">MedAgent Clinical Assistant</h2>
              <span className="text-[10px] uppercase font-bold px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded-full">
                Online
              </span>
            </div>
            <p className="text-xs text-slate-500">Prescription intake, drug interactions &amp; emergency facility routing</p>
          </div>
        </div>

        {/* History toggle (desktop visible) */}
        <button
          onClick={() => setSidebarOpen((p) => !p)}
          title={sidebarOpen ? 'Close history' : 'Chat history'}
          className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-100 text-xs font-medium transition"
        >
          <History className="w-3.5 h-3.5" />
          <span>History</span>
          {historySessions.length > 0 && (
            <span className="bg-primary-100 text-primary-700 text-[10px] font-bold px-1.5 py-0.5 rounded-full">
              {historySessions.length}
            </span>
          )}
        </button>
      </div>

      {/* ── Workspace: sidebar + chat ─────────────────────────────────── */}
      <div className="flex flex-1 gap-3 min-h-0">

        {/* ── Sidebar ────────────────────────────────────────────────── */}
        {sidebarOpen && (
          <div className="w-64 shrink-0 bg-white border border-slate-200 rounded-2xl shadow-sm flex flex-col overflow-hidden">
            {/* Sidebar header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Workspace
              </span>
              <button
                onClick={() => setSidebarOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
                title="Collapse"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
            </div>

            {/* New Chat button */}
            <div className="px-3 py-2 border-b border-slate-100">
              <button
                onClick={handleNewChat}
                className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-xl text-xs font-semibold transition shadow-sm"
              >
                <Plus className="w-3.5 h-3.5" />
                New Chat Session
              </button>
            </div>

            {/* History list */}
            <div className="flex-1 overflow-y-auto px-3 py-3 space-y-1.5">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 px-1 mb-2 flex items-center gap-1.5">
                <History className="w-3 h-3" />
                Chat History ({historySessions.length})
              </p>

              {historySessions.length === 0 ? (
                <p className="text-xs text-slate-400 italic px-1">
                  No history yet. History is recorded when you send a message.
                </p>
              ) : (
                historySessions.map((s) => {
                  const isActive = s.id === activeSessionId;
                  return (
                    <div
                      key={s.id}
                      onClick={() => handleSelectSession(s.id)}
                      className={`flex items-center gap-2 p-2.5 rounded-xl cursor-pointer transition group ${
                        isActive
                          ? 'bg-primary-50 border border-primary-200'
                          : 'hover:bg-slate-50 border border-transparent'
                      }`}
                    >
                      <MessageSquare
                        className={`w-3.5 h-3.5 shrink-0 ${isActive ? 'text-primary-600' : 'text-slate-400'}`}
                      />
                      <div className="flex-1 min-w-0">
                        <p
                          className={`text-xs font-medium truncate ${
                            isActive ? 'text-primary-800 font-semibold' : 'text-slate-700'
                          }`}
                        >
                          {s.title}
                        </p>
                        <p className="text-[10px] text-slate-400 mt-0.5">
                          {formatRelativeTime(s.timestamp)}
                        </p>
                      </div>
                      <button
                        onClick={(e) => handleDeleteSession(e, s.id)}
                        className="p-1 rounded-lg text-slate-300 hover:text-rose-500 hover:bg-rose-50 opacity-0 group-hover:opacity-100 transition shrink-0"
                        title="Delete session"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* ── Chat panel ─────────────────────────────────────────────── */}
        <div className="flex-1 flex flex-col min-w-0 bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">

          {/* Chat header row */}
          <div className="flex items-center gap-2 px-4 py-2.5 border-b border-slate-100 shrink-0">
            {/* Collapsed sidebar controls */}
            {!sidebarOpen && (
              <>
                <button
                  onClick={() => setSidebarOpen(true)}
                  title="Open workspace panel"
                  className="p-1.5 rounded-lg text-slate-400 hover:text-primary-600 hover:bg-slate-100 transition"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
                <button
                  onClick={handleNewChat}
                  title="New Chat"
                  className="p-1.5 rounded-lg text-slate-400 hover:text-primary-600 hover:bg-slate-100 transition"
                >
                  <Plus className="w-4 h-4" />
                </button>
                <div className="w-px h-4 bg-slate-200" />
              </>
            )}
            <h3 className="text-sm font-semibold text-slate-700 truncate">
              {activeSession.title || 'New Chat'}
            </h3>
          </div>

          {/* ── Messages ─────────────────────────────────────────────── */}
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">

            {/* Welcome banner when session is empty */}
            {activeMessages.length === 0 && (
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-sky-100 text-sky-600 flex items-center justify-center shrink-0">
                  <Bot className="w-4 h-4" />
                </div>
                <div className="max-w-[82%] bg-slate-50 border border-slate-200 rounded-2xl rounded-tl-none px-4 py-3 shadow-sm">
                  <p className="text-sm text-slate-700 leading-relaxed">
                    Hello <strong>{user?.full_name || 'there'}</strong>! I am{' '}
                    <strong>MedAgent</strong>, your clinical medication assistant.
                    How can I help you today? You can ask me about medication dosage,
                    side effects, what to do if you missed a dose, or use the{' '}
                    <span className="text-primary-600 font-medium">camera button</span>{' '}
                    to scan a new prescription.
                  </p>
                  <span className="block text-[10px] text-slate-400 mt-2">
                    {formatMsgTime(initialSession.timestamp)}
                  </span>
                </div>
              </div>
            )}

            {/* Message list */}
            {activeMessages.map((m, idx) => {
              const isUser = m.sender === 'user';
              const isLatestAgent =
                !isUser && idx === activeMessages.length - 1 && !loading;

              return (
                <div
                  key={m.id}
                  className={`flex items-start gap-3 ${isUser ? 'flex-row-reverse' : ''}`}
                >
                  {/* Avatar */}
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                      isUser
                        ? 'bg-primary-600 text-white'
                        : 'bg-sky-100 text-sky-600'
                    }`}
                  >
                    {isUser ? (
                      <User className="w-4 h-4" />
                    ) : (
                      <Bot className="w-4 h-4" />
                    )}
                  </div>

                  {/* Bubble */}
                  <div className={`max-w-[82%] space-y-2 ${isUser ? 'items-end' : 'items-start'} flex flex-col`}>
                    <div
                      className={`px-4 py-3 rounded-2xl shadow-sm ${
                        isUser
                          ? 'bg-primary-600 text-white rounded-tr-none'
                          : 'bg-slate-50 border border-slate-200 rounded-tl-none text-slate-800'
                      }`}
                    >
                      {/* Image preview */}
                      {m.image && (
                        <div className="mb-3 rounded-xl overflow-hidden border border-white/20">
                          <img
                            src={m.image}
                            alt="Prescription Upload"
                            className="max-h-60 w-auto object-cover rounded-lg"
                          />
                        </div>
                      )}

                      {/* Text */}
                      {isUser ? (
                        <p className="text-sm leading-relaxed">{m.text}</p>
                      ) : (
                        <TypewriterMessage text={m.text} isLatest={isLatestAgent} />
                      )}
                    </div>

                    {/* Map panel */}
                    {m.hospitals && m.hospitals.length > 0 && (
                      <div className="w-full">
                        <MapView hospitals={m.hospitals} />
                      </div>
                    )}

                    {/* Timestamp */}
                    <span
                      className={`text-[10px] text-slate-400 ${
                        isUser ? 'text-right' : 'text-left'
                      }`}
                    >
                      {formatMsgTime(m.timestamp)}
                    </span>
                  </div>
                </div>
              );
            })}

            {/* Typing indicator */}
            {loading && (
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-sky-50 flex items-center justify-center text-sky-600">
                  <RefreshCw className="w-4 h-4 animate-spin" />
                </div>
                <div className="px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl rounded-tl-none shadow-sm">
                  <p className="text-xs text-slate-500 italic">
                    MedAgent is checking clinical guidelines…
                  </p>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* ── Quick Prompts ──────────────────────────────────────── */}
          <div className="px-4 py-2 flex items-center gap-2 overflow-x-auto scrollbar-none shrink-0 border-t border-slate-100">
            {quickPrompts.map((qp) => (
              <button
                key={qp.label}
                onClick={() => handleSend(qp.text)}
                disabled={loading}
                className={`text-xs px-3 py-1.5 rounded-xl border whitespace-nowrap transition disabled:opacity-50 ${
                  qp.variant === 'emergency'
                    ? 'bg-rose-50 border-rose-200 text-rose-700 hover:bg-rose-100 font-semibold'
                    : 'bg-white border-slate-200 text-slate-700 hover:border-primary-400'
                }`}
              >
                {qp.label}
              </button>
            ))}
          </div>

          {/* ── Input Form ────────────────────────────────────────── */}
          <div className="px-4 pb-4 pt-2 shrink-0">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSend();
              }}
              className="flex items-end gap-2 bg-slate-50 rounded-2xl p-2 border border-slate-200 shadow-md focus-within:border-primary-300 transition"
            >
              {/* Camera button */}
              <button
                type="button"
                onClick={() => setShowCamera(true)}
                className="p-2.5 text-slate-500 hover:text-primary-600 hover:bg-white hover:shadow-sm rounded-xl transition mb-0.5 shrink-0"
                title="Scan Prescription"
              >
                <Camera className="w-5 h-5" />
              </button>

              {/* Textarea */}
              <textarea
                ref={textareaRef}
                rows={1}
                value={input}
                onChange={handleTextareaChange}
                onKeyDown={handleTextareaKeyDown}
                placeholder="Type medication question or symptoms… (Shift+Enter for new line)"
                disabled={loading}
                className="flex-1 px-2 py-2 text-sm bg-transparent focus:outline-none resize-none max-h-28 text-slate-800 placeholder:text-slate-400"
                style={{ height: 'auto' }}
              />

              {/* Send button */}
              <button
                type="submit"
                disabled={!input.trim() || loading}
                className="p-2.5 bg-primary-600 hover:bg-primary-700 disabled:bg-slate-200 text-white rounded-xl transition shadow-sm mb-0.5 shrink-0"
                title={loading ? 'Processing…' : 'Send'}
              >
                {loading ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
              </button>
            </form>
            <p className="text-[10px] text-slate-400 text-center mt-1.5">
              MedAgent may make mistakes. Always consult your prescribing physician for clinical decisions.
            </p>
          </div>
        </div>
      </div>

      {/* ── Camera Modal ────────────────────────────────────────────── */}
      {showCamera && (
        <CameraCapture onCapture={handleCameraCapture} onClose={() => setShowCamera(false)} />
      )}
    </div>
  );
};
