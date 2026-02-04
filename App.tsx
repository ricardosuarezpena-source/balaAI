
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  Send, Plus, Sidebar as SidebarIcon, Settings, 
  Loader2, Image as ImageIcon, Sparkles, 
  MessageSquare, Trash2, Clock, Video, KeyRound, ExternalLink,
  Wand2, X, ChevronUp, HelpCircle, Github
} from 'lucide-react';
import { Message, ChatSession } from './types';
import MessageBubble from './components/MessageBubble';
import ErrorDisplay from './components/ErrorDisplay';
import { streamChat, generateImage, generateVideo } from './services/geminiService';

const App: React.FC = () => {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const [isGeneratingVideo, setIsGeneratingVideo] = useState(false);
  const [videoStatus, setVideoStatus] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [showKeySelection, setShowKeySelection] = useState(false);
  const [showToolsMenu, setShowToolsMenu] = useState(false);
  
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const toolsMenuRef = useRef<HTMLDivElement>(null);

  // Computed: current messages
  const currentMessages = useMemo(() => {
    const session = sessions.find(s => s.id === currentSessionId);
    return session ? session.messages : [];
  }, [sessions, currentSessionId]);

  // Initial Load
  useEffect(() => {
    const saved = localStorage.getItem('nova_ai_sessions');
    const lastId = localStorage.getItem('nova_ai_last_id');
    if (saved) {
      try {
        const parsedSessions = JSON.parse(saved);
        setSessions(parsedSessions);
        if (lastId && parsedSessions.some((s: any) => s.id === lastId)) {
          setCurrentSessionId(lastId);
        } else if (parsedSessions.length > 0) {
          setCurrentSessionId(parsedSessions[0].id);
        }
      } catch (e) {
        console.error("Error loading sessions", e);
      }
    }
  }, []);

  // Save on change
  useEffect(() => {
    if (sessions.length > 0) {
      localStorage.setItem('nova_ai_sessions', JSON.stringify(sessions));
    }
    if (currentSessionId) {
      localStorage.setItem('nova_ai_last_id', currentSessionId);
    }
  }, [sessions, currentSessionId]);

  // Click outside to close tools menu
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (toolsMenuRef.current && !toolsMenuRef.current.contains(event.target as Node)) {
        setShowToolsMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Auto-scroll
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
    }
  }, [sessions, currentSessionId, isLoading, error, videoStatus]);

  const createNewSession = () => {
    const newId = Date.now().toString();
    const newSession: ChatSession = {
      id: newId,
      title: 'Nueva conversación',
      messages: [],
      lastModified: Date.now()
    };
    setSessions(prev => [newSession, ...prev]);
    setCurrentSessionId(newId);
    setInputValue('');
    setError(null);
  };

  const deleteSession = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    const newSessions = sessions.filter(s => s.id !== id);
    setSessions(newSessions);
    if (currentSessionId === id) {
      setCurrentSessionId(newSessions.length > 0 ? newSessions[0].id : null);
    }
    if (newSessions.length === 0) {
      localStorage.removeItem('nova_ai_sessions');
      localStorage.removeItem('nova_ai_last_id');
    }
  };

  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInputValue(e.target.value);
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
    }
  };

  const updateSessionMessages = (sessionId: string, newMessages: Message[], title?: string) => {
    setSessions(prev => prev.map(s => {
      if (s.id === sessionId) {
        return { 
          ...s, 
          messages: newMessages, 
          lastModified: Date.now(),
          title: title || s.title 
        };
      }
      return s;
    }));
  };

  const openKeySelector = async () => {
    await window.aistudio.openSelectKey();
    setShowKeySelection(false);
    handleSendMessage(undefined, false, true);
  };

  const handleSendMessage = async (textToSubmit?: string, forceImage: boolean = false, forceVideo: boolean = false) => {
    const text = textToSubmit || inputValue.trim();
    if (!text || isLoading) return;

    setShowToolsMenu(false);

    let sessionId = currentSessionId;
    if (!sessionId) {
      sessionId = Date.now().toString();
      const newSession: ChatSession = {
        id: sessionId,
        title: text.slice(0, 30) + (text.length > 30 ? '...' : ''),
        messages: [],
        lastModified: Date.now()
      };
      setSessions(prev => [newSession, ...prev]);
      setCurrentSessionId(sessionId);
    }

    const currentSession = sessions.find(s => s.id === sessionId) || { messages: [] };
    setError(null);

    const isVideoRequest = forceVideo || /^(genera|crea|haz|muéstrame|dibuja) un video\b/i.test(text);
    const isImageRequest = !isVideoRequest && (forceImage || /^(genera|crea|dibuja|haz una imagen de)\b/i.test(text));

    if (isVideoRequest) {
      const hasKey = await window.aistudio.hasSelectedApiKey();
      if (!hasKey) {
        setShowKeySelection(true);
        return;
      }
    }

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: text,
      timestamp: Date.now(),
    };

    const updatedMessagesWithUser = [...currentSession.messages, userMessage];
    updateSessionMessages(sessionId, updatedMessagesWithUser);
    
    setInputValue('');
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
    setIsLoading(true);

    const botMessageId = (Date.now() + 1).toString();

    if (isImageRequest) {
      setIsGeneratingImage(true);
      try {
        const imageUrl = await generateImage(text);
        const botMessage: Message = {
          id: botMessageId,
          role: 'model',
          content: `He generado esta imagen basada en tu solicitud: "${text}"`,
          imageUrl,
          timestamp: Date.now(),
        };
        updateSessionMessages(sessionId, [...updatedMessagesWithUser, botMessage]);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setIsGeneratingImage(false);
        setIsLoading(false);
      }
      return;
    }

    if (isVideoRequest) {
      setIsGeneratingVideo(true);
      setVideoStatus('Preparando entorno de renderizado...');
      try {
        const videoUrl = await generateVideo(text, (msg) => setVideoStatus(msg));
        const botMessage: Message = {
          id: botMessageId,
          role: 'model',
          content: `Tu video cinematográfico está listo: "${text}"`,
          videoUrl,
          timestamp: Date.now(),
        };
        updateSessionMessages(sessionId, [...updatedMessagesWithUser, botMessage]);
      } catch (err: any) {
        if (err.message === "SELECTION_REQUIRED") {
          setShowKeySelection(true);
          updateSessionMessages(sessionId, updatedMessagesWithUser);
        } else {
          setError(err.message);
        }
      } finally {
        setIsGeneratingVideo(false);
        setVideoStatus('');
        setIsLoading(false);
      }
      return;
    }

    try {
      const history = updatedMessagesWithUser.map(msg => ({
        role: msg.role === 'user' ? 'user' : 'model',
        parts: msg.content
      }));

      let accumulatedContent = "";
      updateSessionMessages(sessionId, [...updatedMessagesWithUser, {
        id: botMessageId,
        role: 'model',
        content: '',
        timestamp: Date.now()
      }]);

      await streamChat(history, (chunk) => {
        accumulatedContent += chunk;
        setSessions(prev => prev.map(s => {
          if (s.id === sessionId) {
            return {
              ...s,
              messages: s.messages.map(m => m.id === botMessageId ? { ...m, content: accumulatedContent } : m)
            };
          }
          return s;
        }));
      });
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <div className="flex h-screen bg-[#131314] text-[#e3e3e3] overflow-hidden font-sans">
      {/* Modal de Selección de Llave */}
      {showKeySelection && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-[#1e1f20] w-full max-w-md rounded-[2.5rem] border border-white/10 p-8 shadow-2xl animate-in zoom-in-95 duration-300">
            <div className="w-16 h-16 bg-blue-500/20 rounded-2xl flex items-center justify-center mb-6 mx-auto">
              <KeyRound className="w-8 h-8 text-blue-400" />
            </div>
            <h2 className="text-2xl font-bold text-center mb-2 font-display">Llave de Pago Requerida</h2>
            <p className="text-gray-400 text-center text-sm mb-8 leading-relaxed">
              La generación de video con <b>Veo 3.1</b> requiere que selecciones una API Key vinculada a un proyecto de Google Cloud con facturación activa.
            </p>
            <div className="space-y-3">
              <button 
                onClick={openKeySelector}
                className="w-full py-4 bg-white text-black font-bold rounded-2xl hover:scale-[1.02] transition-transform active:scale-95 shadow-xl shadow-white/5"
              >
                Seleccionar mi API Key
              </button>
              <button 
                onClick={() => setShowKeySelection(false)}
                className="w-full py-4 bg-white/5 text-gray-300 font-bold rounded-2xl hover:bg-white/10 transition-colors"
              >
                Cancelar
              </button>
            </div>
            <a 
              href="https://ai.google.dev/gemini-api/docs/billing" 
              target="_blank" 
              className="mt-6 flex items-center justify-center gap-2 text-[11px] text-blue-400/80 hover:text-blue-400 hover:underline transition-colors"
            >
              Documentación sobre facturación <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </div>
      )}

      {/* Sidebar Historial */}
      <aside className={`${isSidebarOpen ? 'w-72' : 'w-0'} transition-all duration-500 ease-in-out bg-[#1e1f20] border-r border-white/5 flex flex-col overflow-hidden shadow-2xl z-30`}>
        <div className="p-4 flex flex-col h-full">
          <button 
            onClick={createNewSession}
            className="flex items-center gap-3 px-4 py-4 bg-white/5 hover:bg-white/10 rounded-2xl text-sm font-semibold transition-all mb-6 border border-white/5 group"
          >
            <Plus className="w-5 h-5 text-blue-400 group-hover:rotate-90 transition-transform" />
            <span>Nueva sesión</span>
          </button>

          <div className="flex-1 overflow-y-auto custom-scrollbar">
            <h3 className="px-2 text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-4 flex items-center gap-2">
              <Clock className="w-3 h-3" /> Recientes
            </h3>
            <div className="space-y-1">
              {sessions.map(session => (
                <div 
                  key={session.id}
                  onClick={() => { setCurrentSessionId(session.id); setError(null); }}
                  className={`group px-3 py-3 text-sm rounded-xl cursor-pointer flex items-center justify-between transition-all ${
                    currentSessionId === session.id 
                      ? 'bg-blue-500/10 text-blue-300 border border-blue-500/20 shadow-lg' 
                      : 'text-gray-400 hover:bg-white/5 hover:text-gray-200'
                  }`}
                >
                  <div className="flex items-center gap-3 truncate">
                    <MessageSquare className={`w-4 h-4 flex-shrink-0 ${currentSessionId === session.id ? 'text-blue-400' : 'text-gray-500'}`} />
                    <span className="truncate font-medium">{session.title}</span>
                  </div>
                  <button 
                    onClick={(e) => deleteSession(e, session.id)}
                    className="p-1.5 opacity-0 group-hover:opacity-100 hover:bg-red-500/20 hover:text-red-400 rounded-lg transition-all"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
              {sessions.length === 0 && (
                <div className="text-center py-10 px-4">
                  <p className="text-xs text-gray-600 font-medium">No hay chats guardados aún</p>
                </div>
              )}
            </div>
          </div>

          <div className="pt-4 border-t border-white/5 flex flex-col gap-1">
             <button className="flex items-center gap-3 px-4 py-3 hover:bg-white/5 rounded-xl transition-all text-sm text-gray-400 hover:text-white">
                <Settings className="w-4 h-4" /> Ajustes
             </button>
          </div>
        </div>
      </aside>

      {/* Main UI */}
      <main className="flex-1 flex flex-col relative min-w-0 bg-[#0e0e0f]">
        <header className="h-16 flex items-center justify-between px-6 bg-[#131314]/60 backdrop-blur-xl border-b border-white/5 z-20">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="p-2.5 hover:bg-white/5 rounded-xl transition-all text-gray-400 hover:text-white"
            >
              <SidebarIcon className="w-5 h-5" />
            </button>
            <h1 className="text-lg font-bold bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 bg-clip-text text-transparent uppercase tracking-tighter">balaAI 3.1 Pro</h1>
          </div>
          <div className="flex items-center gap-3">
             <div className="w-9 h-9 rounded-2xl bg-gradient-to-tr from-blue-600 to-purple-600 flex items-center justify-center text-white text-xs font-black shadow-lg shadow-blue-600/20">AI</div>
          </div>
        </header>

        <div ref={scrollRef} className="flex-1 overflow-y-auto custom-scrollbar px-4 lg:px-0">
          <div className="max-w-3xl mx-auto py-12">
            {!currentSessionId || (currentMessages.length === 0 && !error) ? (
              <div className="flex flex-col items-center justify-center min-h-[60vh] text-center animate-in fade-in zoom-in duration-700">
                <div className="relative mb-8">
                  <div className="absolute inset-0 bg-blue-500 blur-[80px] opacity-20 animate-pulse" />
                  <div className="relative w-24 h-24 rounded-[3rem] bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center shadow-2xl">
                    <Sparkles className="w-12 h-12 text-white" />
                  </div>
                </div>
                <h2 className="text-4xl font-bold mb-4 tracking-tight">Experiencia balaAI</h2>
                <p className="text-gray-400 max-w-md text-lg leading-relaxed mb-12 px-6">
                  IA Multimodal de nueva generación. Chatea, crea imágenes y genera videos cinematográficos.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full max-w-2xl px-4">
                  {[
                    { text: "Genera un video de un astronauta en Marte", icon: <Video className="w-4 h-4 text-purple-400" /> },
                    { text: "Crea una imagen de un samurái futurista", icon: <ImageIcon className="w-4 h-4 text-pink-400" /> },
                    { text: "Explica la teoría de cuerdas simplemente", icon: <HelpCircle className="w-4 h-4 text-blue-400" /> },
                    { text: "Escribe código para un juego en JS", icon: <Github className="w-4 h-4 text-green-400" /> }
                  ].map((item, i) => (
                    <button 
                      key={i}
                      onClick={() => handleSendMessage(item.text, item.text.includes("imagen"), item.text.includes("video"))}
                      className="p-5 bg-white/[0.03] hover:bg-white/[0.08] border border-white/10 rounded-[1.5rem] text-left text-sm text-gray-300 transition-all flex items-start gap-4 hover:border-white/20 hover:translate-y-[-2px] group"
                    >
                      <div className="p-2.5 bg-white/5 rounded-xl group-hover:scale-110 transition-transform">{item.icon}</div>
                      <span className="mt-1 leading-snug">{item.text}</span>
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            {currentMessages.map((msg) => (
              <MessageBubble key={msg.id} message={msg} />
            ))}

            {(isLoading || isGeneratingImage || isGeneratingVideo) && (
              <div className="flex gap-4 px-2 py-4 animate-in fade-in">
                <div className="w-9 h-9 rounded-xl bg-white/5 flex items-center justify-center border border-white/5">
                  <Loader2 className="w-5 h-5 animate-spin text-blue-500" />
                </div>
                <div className="flex-1 space-y-3 pt-2">
                  <div className="h-3 bg-white/5 rounded-full w-[90%] animate-pulse" />
                  <div className="h-3 bg-white/5 rounded-full w-[60%] animate-pulse" />
                  {isGeneratingVideo && (
                    <div className="mt-6 p-6 rounded-[2rem] bg-blue-500/5 border border-blue-500/10 animate-in slide-in-from-top-4">
                      <div className="flex items-center gap-4 mb-4">
                        <div className="w-2 h-2 rounded-full bg-blue-500 animate-ping" />
                        <span className="text-xs font-bold text-blue-400 uppercase tracking-widest">{videoStatus}</span>
                      </div>
                      <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                        <div className="h-full bg-blue-500 w-1/3 animate-[progress_10s_ease-in-out_infinite]" />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {error && <ErrorDisplay error={error} onRetry={() => handleSendMessage()} />}
          </div>
        </div>

        {/* Input Dock con Menú de Herramientas Agrupado */}
        <div className="p-6 bg-gradient-to-t from-[#0e0e0f] via-[#0e0e0f] to-transparent z-40">
          <div className="max-w-3xl mx-auto relative">
            
            {/* Menú de Herramientas Flotante */}
            {showToolsMenu && (
              <div 
                ref={toolsMenuRef}
                className="absolute bottom-full left-4 mb-4 w-64 bg-[#1e1f20] border border-white/10 rounded-[2rem] p-2 shadow-2xl backdrop-blur-xl animate-in slide-in-from-bottom-4 fade-in duration-300 z-50 overflow-hidden"
              >
                <div className="p-3 mb-1 border-b border-white/5">
                  <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest px-2">Creatividad</span>
                </div>
                <button
                  onClick={() => handleSendMessage(undefined, true)}
                  className="w-full flex items-center gap-4 p-4 hover:bg-white/5 rounded-2xl transition-all text-gray-300 hover:text-pink-400 group"
                >
                  <div className="p-2.5 bg-pink-400/10 rounded-xl group-hover:scale-110 transition-transform">
                    <ImageIcon className="w-5 h-5 text-pink-400" />
                  </div>
                  <div className="flex flex-col items-start">
                    <span className="text-sm font-bold">Generar Imagen</span>
                    <span className="text-[10px] text-gray-500">BalaAI Image 2.5</span>
                  </div>
                </button>
                <button
                  onClick={() => handleSendMessage(undefined, false, true)}
                  className="w-full flex items-center gap-4 p-4 hover:bg-white/5 rounded-2xl transition-all text-gray-300 hover:text-purple-400 group"
                >
                  <div className="p-2.5 bg-purple-400/10 rounded-xl group-hover:scale-110 transition-transform">
                    <Video className="w-5 h-5 text-purple-400" />
                  </div>
                  <div className="flex flex-col items-start">
                    <span className="text-sm font-bold">Generar Video</span>
                    <span className="text-[10px] text-gray-500">Motor Veo 3.1</span>
                  </div>
                </button>
              </div>
            )}

            <div className="relative group bg-[#1e1f20] rounded-[2.5rem] border border-white/10 focus-within:border-blue-500/40 shadow-2xl transition-all p-2 flex items-end">
              
              <button
                type="button"
                onClick={() => setShowToolsMenu(!showToolsMenu)}
                className={`mb-1 p-4 rounded-[1.5rem] transition-all flex items-center justify-center ${
                  showToolsMenu ? 'bg-white/10 text-white' : 'text-gray-500 hover:bg-white/5 hover:text-gray-300'
                }`}
              >
                {showToolsMenu ? <X className="w-6 h-6" /> : <Plus className="w-6 h-6" />}
              </button>

              <form 
                onSubmit={(e) => { e.preventDefault(); handleSendMessage(); }}
                className="flex-1 flex flex-col"
              >
                <textarea
                  ref={textareaRef}
                  value={inputValue}
                  onChange={handleTextareaChange}
                  onKeyDown={handleKeyDown}
                  placeholder="Envía un mensaje o usa las herramientas..."
                  rows={1}
                  className="w-full bg-transparent px-4 py-5 pr-16 text-[#e3e3e3] placeholder-gray-500 focus:outline-none resize-none min-h-[60px] max-h-[200px] custom-scrollbar leading-relaxed text-lg"
                />
              </form>

              <button
                onClick={() => handleSendMessage()}
                disabled={!inputValue.trim() || isLoading}
                className={`mb-1 p-4 rounded-[1.5rem] transition-all flex items-center justify-center ${
                  inputValue.trim() && !isLoading 
                    ? 'bg-white text-black hover:scale-105 shadow-xl shadow-white/5' 
                    : 'bg-[#2f2f2f] text-gray-600 cursor-not-allowed'
                }`}
              >
                {isLoading ? <Loader2 className="w-6 h-6 animate-spin" /> : <Send className="w-6 h-6" />}
              </button>
            </div>
          </div>
        </div>
      </main>
      <style>{`
        @keyframes progress {
          0% { width: 0%; }
          50% { width: 70%; }
          100% { width: 100%; }
        }
        .font-display { font-family: 'Inter', sans-serif; letter-spacing: -0.02em; }
      `}</style>
    </div>
  );
};

export default App;
