import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { agentApi, clinicalApi } from '../../services/api';
import { HospitalFacility, ChatMessage, ChatSession } from '../../types';
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
  Compass,
  ExternalLink,
  Calendar,
  AlertTriangle,
} from 'lucide-react';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const createDefaultSession = (): ChatSession => ({
  id: `session_${Date.now()}`,
  title: 'New Conversation',
  timestamp: new Date().toISOString(),
  messages: [],
});

const STORAGE_KEY_PREFIX = 'medagent_chats_';

const loadLocalSessions = (userId: string): ChatSession[] => {
  try {
    const raw = localStorage.getItem(`${STORAGE_KEY_PREFIX}${userId}`);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (_) {}
  return [];
};

const saveLocalSessions = (userId: string, sessions: ChatSession[]) => {
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
    const renderInline = (tokens: string[]) =>
      tokens.map((part, i) => {
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
  const navigate = useNavigate();

  const storageUserId = user?.id || 'guest';

  // Sessions state — fresh session always ready
  const [initialSession] = useState<ChatSession>(createDefaultSession);
  const [sessions, setSessions] = useState<ChatSession[]>(() => {
    const local = loadLocalSessions(storageUserId);
    return [initialSession, ...local];
  });
  const [activeSessionId, setActiveSessionId] = useState<string>(initialSession.id);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // 1. Fetch persistent chat history transcripts from database
  useEffect(() => {
    let isMounted = true;
    const fetchHistoryFromDb = async () => {
      try {
        setLoadingHistory(true);
        const dbSessions = await agentApi.listSessions();
        if (isMounted && Array.isArray(dbSessions) && dbSessions.length > 0) {
          setSessions((prev) => {
            const currentFresh = prev.find((s) => s.id === initialSession.id) || initialSession;
            // Deduplicate sessions by ID
            const existingIds = new Set([currentFresh.id]);
            const filteredDb = dbSessions.filter((s) => !existingIds.has(s.id));
            const merged = [currentFresh, ...filteredDb];
            saveLocalSessions(storageUserId, merged);
            return merged;
          });
        }
      } catch (err) {
        console.warn('Could not fetch sessions from DB, relying on local state:', err);
      } finally {
        if (isMounted) setLoadingHistory(false);
      }
    };

    fetchHistoryFromDb();
    return () => {
      isMounted = false;
    };
  }, [storageUserId, initialSession]);

  // Open camera if directed by URL param
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get('action') === 'camera') setShowCamera(true);
  }, [location]);

  // Auto-scroll on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [sessions, loading, activeSessionId]);

  // Sync to local storage
  useEffect(() => {
    const toSave = sessions.filter(
      (s) => s.messages.some((m) => m.sender === 'user') && s.id !== initialSession.id
    );
    saveLocalSessions(storageUserId, toSave);
  }, [sessions, storageUserId, initialSession.id]);

  const activeSession =
    sessions.find((s) => s.id === activeSessionId) || sessions[0] || initialSession;
  const activeMessages = activeSession?.messages ?? [];

  // Filter history sessions (those that have user messages)
  const historySessions = sessions.filter(
    (s) => s.messages && s.messages.some((m) => m.sender === 'user')
  );

  // ── Session Management ──────────────────────────────────────────────────

  const handleNewChat = useCallback(() => {
    const fresh = createDefaultSession();
    setSessions((prev) => [fresh, ...prev]);
    setActiveSessionId(fresh.id);
    setInput('');
  }, []);

  const handleSelectSession = useCallback(async (sessionId: string) => {
    setActiveSessionId(sessionId);
    setSidebarOpen(false);

    // Fetch full messages from DB if not already loaded or to ensure latest transcript
    try {
      const full = await agentApi.getSession(sessionId);
      if (full && Array.isArray(full.messages)) {
        setSessions((prev) =>
          prev.map((s) => (s.id === sessionId ? { ...s, ...full } : s))
        );
      }
    } catch (_) {
      // Local copy already in state
    }
  }, []);

  const handleDeleteSession = useCallback(
    async (e: React.MouseEvent, sessionId: string) => {
      e.stopPropagation();
      try {
        await agentApi.deleteSession(sessionId);
      } catch (err) {
        console.warn('Failed to delete session on server:', err);
      }
      setSessions((prev) => {
        const filtered = prev.filter((s) => s.id !== sessionId);
        const remaining = filtered.length > 0 ? filtered : [createDefaultSession()];
        if (activeSessionId === sessionId) setActiveSessionId(remaining[0].id);
        return remaining;
      });
    },
    [activeSessionId]
  );

  // ── Send / Receive Messages ─────────────────────────────────────────────

  const handleSend = useCallback(
    async (customText?: string, customImage?: string) => {
      const textToSend = customText !== undefined ? customText : input.trim();
      if (!textToSend && !customImage) return;

      const nowIso = new Date().toISOString();
      const targetSessionId = activeSessionId;

      // Derive title from first message
      const sessionTitle =
        activeSession.title === 'New Conversation' && textToSend
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

      // Optimistically append user message to active transcript
      setSessions((prev) =>
        prev.map((s) => {
          if (s.id !== targetSessionId) return s;
          return {
            ...s,
            title: sessionTitle,
            timestamp: nowIso,
            messages: [...(s.messages || []), userMsg],
          };
        })
      );

      if (customText === undefined) setInput('');
      if (textareaRef.current) textareaRef.current.style.height = 'auto';
      setLoading(true);

      try {
        // Post message with targetSessionId to preserve multi-turn history in database
        const data = await agentApi.chat(
          textToSend || 'Please analyze this scanned prescription image.',
          targetSessionId,
          customImage,
          user
        );

        // Emergency facility coordinates if needed
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
          navigation: data.navigation,
        };

        setSessions((prev) =>
          prev.map((s) => {
            if (s.id !== targetSessionId) return s;
            return {
              ...s,
              timestamp: new Date().toISOString(),
              messages: [...(s.messages || []), agentMsg],
            };
          })
        );
      } catch (_) {
        const errMsg: ChatMessage = {
          id: `err-${Date.now()}`,
          sender: 'agent',
          text: 'I encountered an issue connecting to the clinical inference engine. Please check your network and try again.',
          timestamp: new Date().toISOString(),
        };
        setSessions((prev) =>
          prev.map((s) => {
            if (s.id !== targetSessionId) return s;
            return {
              ...s,
              messages: [...(s.messages || []), errMsg],
            };
          })
        );
      } finally {
        setLoading(false);
      }
    },
    [input, activeSessionId, activeSession, user]
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

  // ── Quick Prompts ────────────────────────────────────────────────────────

  const quickPrompts = [
    {
      label: '📅 Dose Schedule',
      text: 'What is my dose schedule for today and what pills should I take?',
      variant: 'nav',
    },
    {
      label: '🧭 Go to Dose Timetable',
      text: 'Navigate to my dose schedule page.',
      variant: 'nav',
    },
    {
      label: '📲 Missed Dose SMS',
      text: 'Check if I missed any medication doses and remind me through an SMS.',
      variant: 'default',
    },
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
      label: '🚨 Emergency Triage',
      text: 'I have acute crushing chest pain, what should I do?',
      variant: 'emergency',
    },
  ];

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="max-w-5xl mx-auto px-2 sm:px-4 py-2 h-[calc(100vh-4.5rem)] flex flex-col min-h-0">

      {/* ── Workspace: sidebar + chat (Expanded to full height) ──────── */}
      <div className="flex flex-1 gap-3 min-h-0 h-full">

        {/* ── Sidebar (Transcripts & Session History) ──────────────────── */}
        {sidebarOpen && (
          <div className="w-72 shrink-0 bg-white border border-slate-200 rounded-2xl shadow-sm flex flex-col overflow-hidden h-full">
            {/* Sidebar header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 bg-slate-50">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
                <History className="w-3.5 h-3.5 text-primary-600" />
                Transcripts ({historySessions.length})
              </span>
              <button
                onClick={() => setSidebarOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition"
                title="Collapse transcripts"
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
                New Conversation
              </button>
            </div>

            {/* History list */}
            <div className="flex-1 overflow-y-auto px-3 py-3 space-y-1.5">
              {loadingHistory && (
                <div className="text-center py-4 text-xs text-slate-400 flex items-center justify-center gap-2">
                  <RefreshCw className="w-3.5 h-3.5 animate-spin text-primary-600" />
                  Loading transcripts…
                </div>
              )}

              {!loadingHistory && historySessions.length === 0 ? (
                <div className="text-center py-6 px-2">
                  <MessageSquare className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                  <p className="text-xs text-slate-500 font-medium">No saved transcripts yet.</p>
                  <p className="text-[11px] text-slate-400 mt-1">
                    Send a question or scan a prescription to start your first session.
                  </p>
                </div>
              ) : (
                historySessions.map((s) => {
                  const isActive = s.id === activeSessionId;
                  const messageCount = s.messages ? s.messages.length : 0;
                  return (
                    <div
                      key={s.id}
                      onClick={() => handleSelectSession(s.id)}
                      className={`flex items-start gap-2 p-2.5 rounded-xl cursor-pointer transition group border ${
                        isActive
                          ? 'bg-primary-50/80 border-primary-300 shadow-xs'
                          : 'hover:bg-slate-50 border-slate-100'
                      }`}
                    >
                      <MessageSquare
                        className={`w-4 h-4 shrink-0 mt-0.5 ${isActive ? 'text-primary-600' : 'text-slate-400'}`}
                      />
                      <div className="flex-1 min-w-0">
                        <p
                          className={`text-xs font-semibold truncate ${
                            isActive ? 'text-primary-900' : 'text-slate-700'
                          }`}
                        >
                          {s.title}
                        </p>
                        <div className="flex items-center justify-between text-[10px] text-slate-400 mt-1">
                          <span>{formatRelativeTime(s.timestamp)}</span>
                          <span className="font-medium bg-slate-100 px-1.5 py-0.2 rounded text-slate-600">
                            {messageCount} msgs
                          </span>
                        </div>
                      </div>
                      <button
                        onClick={(e) => handleDeleteSession(e, s.id)}
                        className="p-1 rounded-lg text-slate-300 hover:text-rose-500 hover:bg-rose-50 opacity-0 group-hover:opacity-100 transition shrink-0"
                        title="Delete transcript"
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

        {/* ── Chat panel (Expands to full height) ─────────────────────── */}
        <div className="flex-1 flex flex-col min-w-0 bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden h-full">

          {/* Chat header row */}
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-100 shrink-0 bg-slate-50/50">
            <div className="flex items-center gap-2 min-w-0">
              <button
                onClick={() => setSidebarOpen((p) => !p)}
                title={sidebarOpen ? 'Close transcripts panel' : 'Open transcripts & history'}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-100 text-xs font-semibold transition shrink-0"
              >
                <History className="w-3.5 h-3.5 text-primary-600" />
                <span className="hidden sm:inline">Transcripts</span>
                {historySessions.length > 0 && (
                  <span className="bg-primary-100 text-primary-700 text-[10px] font-bold px-1.5 py-0.2 rounded-full">
                    {historySessions.length}
                  </span>
                )}
              </button>

              <button
                onClick={handleNewChat}
                title="New Conversation"
                className="p-1.5 rounded-lg text-slate-400 hover:text-primary-600 hover:bg-slate-100 transition shrink-0"
              >
                <Plus className="w-4 h-4" />
              </button>

              <div className="w-px h-4 bg-slate-200 shrink-0" />

              <h3 className="text-sm font-semibold text-slate-800 truncate">
                {activeSession.title || 'New Conversation'}
              </h3>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => navigate('/doses')}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-sky-50 text-sky-700 hover:bg-sky-100 rounded-xl transition border border-sky-200 shrink-0"
                title="View full dose schedule timetable"
              >
                <Calendar className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Dose Schedule</span>
              </button>
            </div>
          </div>

          {/* ── Messages List ──────────────────────────────────────────── */}
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">

            {/* Welcome banner when session is fresh */}
            {activeMessages.length === 0 && (
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-sky-100 text-sky-600 flex items-center justify-center shrink-0">
                  <Bot className="w-4 h-4" />
                </div>
                <div className="max-w-[85%] bg-slate-50 border border-slate-200 rounded-2xl rounded-tl-none px-4 py-3.5 shadow-sm">
                  <p className="text-sm text-slate-800 leading-relaxed">
                    Hello <strong>{user?.full_name || 'there'}</strong>! I am{' '}
                    <strong>MedAgent</strong>, your clinical medication assistant.
                  </p>
                  <p className="text-sm text-slate-600 mt-2 leading-relaxed">
                    I can help you monitor your <strong>daily dose schedule</strong>, check active prescriptions,
                    review potential food/drug interactions, or navigate directly to your medication timetable.
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      onClick={() => handleSend('What is my dose schedule for today?')}
                      className="text-xs bg-white border border-slate-200 hover:border-sky-400 text-slate-700 font-medium px-2.5 py-1.5 rounded-lg transition flex items-center gap-1.5 shadow-2xs"
                    >
                      <Calendar className="w-3.5 h-3.5 text-sky-600" />
                      Check Today's Doses
                    </button>
                    <button
                      onClick={() => handleSend('Navigate to my dose schedule')}
                      className="text-xs bg-white border border-slate-200 hover:border-sky-400 text-slate-700 font-medium px-2.5 py-1.5 rounded-lg transition flex items-center gap-1.5 shadow-2xs"
                    >
                      <Compass className="w-3.5 h-3.5 text-primary-600" />
                      Open Dose Schedule
                    </button>
                  </div>
                  <span className="block text-[10px] text-slate-400 mt-3">
                    {formatMsgTime(initialSession.timestamp)}
                  </span>
                </div>
              </div>
            )}

            {/* Rendered interaction messages */}
            {activeMessages.map((m, idx) => {
              const isUser = m.sender === 'user';
              const isLatestAgent = !isUser && idx === activeMessages.length - 1 && !loading;

              return (
                <div
                  key={m.id || idx}
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

                  {/* Message Bubble */}
                  <div className={`max-w-[85%] space-y-2 ${isUser ? 'items-end' : 'items-start'} flex flex-col`}>
                    <div
                      className={`px-4 py-3 rounded-2xl shadow-sm ${
                        isUser
                          ? 'bg-primary-600 text-white rounded-tr-none'
                          : 'bg-slate-50 border border-slate-200 rounded-tl-none text-slate-800'
                      }`}
                    >
                      {/* Uploaded photo */}
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

                      {/* Interactive Navigation Action Banner */}
                      {m.navigation && (
                        <div className="mt-3.5 p-3 bg-gradient-to-r from-sky-50 to-indigo-50 border border-sky-200 rounded-xl flex items-center justify-between gap-3 shadow-xs">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className="p-2 bg-primary-600 text-white rounded-lg shadow-xs shrink-0">
                              <Compass className="w-4 h-4" />
                            </div>
                            <div className="min-w-0">
                              <p className="text-xs font-bold text-slate-900 truncate">
                                {m.navigation.page_name}
                              </p>
                              <p className="text-[11px] text-slate-600 line-clamp-1">
                                {m.navigation.reason || `Open the ${m.navigation.page_name} page`}
                              </p>
                            </div>
                          </div>
                          <button
                            onClick={() => navigate(m.navigation!.target)}
                            className="px-3 py-1.5 bg-primary-600 hover:bg-primary-700 text-white text-xs font-semibold rounded-lg flex items-center gap-1.5 transition shadow-xs shrink-0"
                          >
                            <span>Open</span>
                            <ExternalLink className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Nearby Hospitals Map */}
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

            {/* Inference typing spinner */}
            {loading && (
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-sky-50 flex items-center justify-center text-sky-600">
                  <RefreshCw className="w-4 h-4 animate-spin" />
                </div>
                <div className="px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl rounded-tl-none shadow-sm">
                  <p className="text-xs text-slate-500 italic">
                    MedAgent is evaluating clinical tools &amp; schedule…
                  </p>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* ── Quick Prompts ──────────────────────────────────────────── */}
          <div className="px-4 py-2 flex items-center gap-2 overflow-x-auto scrollbar-none shrink-0 border-t border-slate-100 bg-slate-50/30">
            {quickPrompts.map((qp) => (
              <button
                key={qp.label}
                onClick={() => handleSend(qp.text)}
                disabled={loading}
                className={`text-xs px-3 py-1.5 rounded-xl border whitespace-nowrap transition disabled:opacity-50 ${
                  qp.variant === 'emergency'
                    ? 'bg-rose-50 border-rose-200 text-rose-700 hover:bg-rose-100 font-semibold'
                    : qp.variant === 'nav'
                    ? 'bg-sky-50 border-sky-200 text-sky-800 hover:bg-sky-100 font-medium'
                    : 'bg-white border-slate-200 text-slate-700 hover:border-primary-400'
                }`}
              >
                {qp.label}
              </button>
            ))}
          </div>

          {/* ── Input Form ────────────────────────────────────────────── */}
          <div className="px-4 pb-4 pt-2 shrink-0">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSend();
              }}
              className="flex items-end gap-2 bg-slate-50 rounded-2xl p-2 border border-slate-200 shadow-md focus-within:border-primary-400 focus-within:bg-white transition"
            >
              {/* Camera button */}
              <button
                type="button"
                onClick={() => setShowCamera(true)}
                className="p-2.5 text-slate-500 hover:text-primary-600 hover:bg-white hover:shadow-sm rounded-xl transition mb-0.5 shrink-0"
                title="Scan Prescription with Camera"
              >
                <Camera className="w-5 h-5" />
              </button>

              {/* Input textarea */}
              <textarea
                ref={textareaRef}
                rows={1}
                value={input}
                onChange={handleTextareaChange}
                onKeyDown={handleTextareaKeyDown}
                placeholder="Ask about medications, dose schedule, or request page navigation… (Enter to send)"
                disabled={loading}
                className="flex-1 px-2 py-2 text-sm bg-transparent focus:outline-none resize-none max-h-28 text-slate-800 placeholder:text-slate-400"
                style={{ height: 'auto' }}
              />

              {/* Submit button */}
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
              MedAgent is an AI clinical assistant. Transcripts are stored securely in your patient history.
            </p>
          </div>
        </div>
      </div>

      {/* ── Camera Capture Modal ────────────────────────────────────── */}
      {showCamera && (
        <CameraCapture onCapture={handleCameraCapture} onClose={() => setShowCamera(false)} />
      )}
    </div>
  );
};
