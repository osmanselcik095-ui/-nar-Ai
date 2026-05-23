import React, { useState, useEffect, useRef } from "react";
import Sidebar from "./components/Sidebar";
import { Message, ChatSession } from "./types";
import { 
  initAuth, 
  googleSignIn, 
  googleSignOut, 
  getAccessToken 
} from "./firebase";
import { User } from "firebase/auth";
import { 
  Send, 
  Sparkles, 
  Volume2, 
  VolumeX, 
  Plus, 
  Loader2, 
  AlertCircle,
  Clock,
  ExternalLink,
  Bot,
  User as UserIcon,
  PanelLeftClose,
  PanelLeft,
  Mail,
  CheckCircle,
  XCircle,
  LogOut,
  ChevronRight,
  Brain
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import Markdown from "react-markdown";

export default function App() {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string>("");
  const [inputText, setInputText] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [isVoiceEnabled, setIsVoiceEnabled] = useState(false);
  
  // Google Authentication State
  const [user, setUser] = useState<User | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authWarning, setAuthWarning] = useState<string | null>(null);

  // Email Notification States
  const [isSendingEmail, setIsSendingEmail] = useState<string | null>(null); // messageId or "session"
  const [emailStatus, setEmailStatus] = useState<{ id: string; success: boolean; message: string } | null>(null);

  // Sidebar Toggle
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  // Audio Playback State
  const [currentlyPlayingAudioId, setCurrentlyPlayingAudioId] = useState<string | null>(null);
  const [audioLoadingId, setAudioLoadingId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Key / API alert state
  const [apiError, setApiError] = useState<{ message: string; isKeyMissing: boolean } | null>(null);

  // Auto Scroll
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  // 1. INITIALIZE SESSIONS AND FIREBASE AUTH STATE
  useEffect(() => {
    // Session Loader
    try {
      const stored = localStorage.getItem("cinar_ai_sessions");
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed && parsed.length > 0) {
          setSessions(parsed);
          setActiveSessionId(parsed[0].id);
        } else {
          createNewSession();
        }
      } else {
        createNewSession();
      }
    } catch (e) {
      console.error("Local storage error:", e);
      createNewSession();
    }

    // Auth State Loader
    const unsubscribe = initAuth(
      (currentUser, token) => {
        setUser(currentUser);
        setAccessToken(token);
        setAuthLoading(false);
      },
      () => {
        setUser(null);
        setAccessToken(null);
        setAuthLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  // 2. ACTIVE SESSION SEPARATION
  const activeSession = sessions.find(s => s.id === activeSessionId);

  // 3. STORAGE SYNC HELPER
  const saveSessionsToLocal = (updatedSessions: ChatSession[]) => {
    setSessions(updatedSessions);
    localStorage.setItem("cinar_ai_sessions", JSON.stringify(updatedSessions));
  };

  // 4. CHAT STATE SCROLL
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [activeSession?.messages, isGenerating]);

  // 5. STARTER SESSIONS CREATE
  const createNewSession = (categoryPrompt?: string) => {
    const newId = `session_${Date.now()}`;
    const newSession: ChatSession = {
      id: newId,
      title: "Yeni Sohbet",
      messages: [],
      createdAt: new Date().toLocaleDateString("tr-TR"),
    };

    const updated = [newSession, ...sessions];
    saveSessionsToLocal(updated);
    setActiveSessionId(newId);

    if (categoryPrompt) {
      setTimeout(() => {
        handleSendMessage(categoryPrompt, newId);
      }, 150);
    }
  };

  // 6. DELETE SINGLE CHAT EXERCISE
  const handleDeleteSession = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const filtered = sessions.filter(s => s.id !== id);
    let nextActiveId = activeSessionId;

    if (activeSessionId === id) {
      nextActiveId = filtered.length > 0 ? filtered[0].id : "";
    }

    if (filtered.length === 0) {
      const defaultId = `session_${Date.now()}`;
      const defaultSession: ChatSession = {
        id: defaultId,
        title: "Yeni Sohbet",
        messages: [],
        createdAt: new Date().toLocaleDateString("tr-TR"),
      };
      saveSessionsToLocal([defaultSession]);
      setActiveSessionId(defaultId);
    } else {
      saveSessionsToLocal(filtered);
      setActiveSessionId(nextActiveId);
    }

    stopAudioPlayback();
  };

  // 7. WIPE SESSIONS W/ VERIFICATION
  const handleClearAllSessions = () => {
    const confirmed = window.confirm("Tüm sohbet geçmişinizi sıfırlamak istiyor musunuz?");
    if (confirmed) {
      const defaultId = `session_${Date.now()}`;
      const defaultSession: ChatSession = {
        id: defaultId,
        title: "Yeni Sohbet",
        messages: [],
        createdAt: new Date().toLocaleDateString("tr-TR"),
      };
      saveSessionsToLocal([defaultSession]);
      setActiveSessionId(defaultId);
      stopAudioPlayback();
      setApiError(null);
    }
  };

  // 8. GOOGLE AUTHENTICATION CORE FLOWS
  const handleSignIn = async () => {
    setAuthWarning(null);
    try {
      const result = await googleSignIn();
      if (result) {
        setUser(result.user);
        setAccessToken(result.accessToken);
      }
    } catch (e: any) {
      console.error("Popup Auth failed:", e);
      if (e.code === "auth/popup-closed-by-user" || e.message?.includes("popup-closed-by-user")) {
        setAuthWarning(
          "Giriş penceresi kapatıldı. Oturum açmak için lütfen oturum aç butonuna tekrar tıklayın."
        );
      } else {
        setAuthWarning(
          `Google Girişi sırasında bir sorun oluştu: ${e.message || e}`
        );
      }
    }
  };

  const handleSignOut = async () => {
    if (window.confirm("Oturumu kapatmak istediğinize emin misiniz?")) {
      await googleSignOut();
      setUser(null);
      setAccessToken(null);
      stopAudioPlayback();
    }
  };

  // 9. CLIENT-SIDE WARNING-FREE EMAIL TRANSMISSION
  // Opens the user's default email composer with prefilled contents and saves to clipboard.
  // This avoids requesting sensitive scopes and completely removes Google's "Unverified App" warning.
  const handleSendEmail = async (messageText: string, messageId: string, subjectTitle: string) => {
    setIsSendingEmail(messageId);
    setEmailStatus(null);

    try {
      const cleanText = messageText.replace(/[*#`_\-]/g, "");
      const emailRecipient = user?.email || "";
      const emailSubject = subjectTitle || "Çınar AI Akıllı Bilgi Notu";
      const emailBody = `Merhaba,\n\nÇınar AI ile yaptığınız sohbetten seçtiğiniz bilgi notu aşağıdadır:\n\n----------------------------------------\n\n${cleanText}\n\n----------------------------------------\n\nBu e-posta Çınar AI asistanından alınmıştır.`;
      
      const mailtoUrl = `mailto:${emailRecipient}?subject=${encodeURIComponent(emailSubject)}&body=${encodeURIComponent(emailBody)}`;
      
      // Open default mail handler programmatically and safely
      const link = document.createElement("a");
      link.href = mailtoUrl;
      link.target = "_blank";
      link.rel = "noreferrer";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      // Save to clipboard for double convenience
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(cleanText);
      }

      setEmailStatus({
        id: messageId,
        success: true,
        message: "E-postanız hazırlandı ve panoya kopyalandı!",
      });
    } catch (err: any) {
      console.error("Mail trigger error:", err);
      setEmailStatus({
        id: messageId,
        success: false,
        message: "E-posta hazırlanamadı.",
      });
    } finally {
      setIsSendingEmail(null);
    }
  };

  // 10. TEXT TO SPEECH (With safe inline codec resolution)
  const handleVoicePlay = async (text: string, messageId: string) => {
    if (currentlyPlayingAudioId === messageId && audioRef.current) {
      stopAudioPlayback();
      return;
    }

    try {
      setAudioLoadingId(messageId);
      setCurrentlyPlayingAudioId(null);

      // Strip markdown syntax for natural voice narration
      const cleanText = text.replace(/[*#`_\-]/g, "").slice(0, 300);
      const res = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: cleanText }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || "Seslendirme verisi oluşturulamadı.");
      }

      const data = await res.json();
      if (data.audio) {
        if (audioRef.current) {
          audioRef.current.pause();
        }

        // DYNAMIC AUDIO CODEC RESOLUTION - uses actual mimeType returned from Gemini endpoint (AAC, WAV, etc.)
        const audioMimeType = data.mimeType || "audio/aac";
        const audioUrl = `data:${audioMimeType};base64,${data.audio}`;
        
        const audio = new Audio(audioUrl);
        audioRef.current = audio;
        
        setCurrentlyPlayingAudioId(messageId);
        
        audio.onended = () => {
          setCurrentlyPlayingAudioId(null);
        };

        audio.onerror = () => {
          setCurrentlyPlayingAudioId(null);
          alert("Ses oynatıcı hatası: Tarayıcınız ses formatını desteklemiyor.");
        };

        await audio.play();
      }
    } catch (err: any) {
      console.error("Audio trigger failed:", err);
      alert(err.message || "Seslendirme servisi şu an meşgul.");
    } finally {
      setAudioLoadingId(null);
    }
  };

  const stopAudioPlayback = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    setCurrentlyPlayingAudioId(null);
  };

  const maybeTriggerAutoVoice = async (replyText: string, replyMessageId: string) => {
    if (isVoiceEnabled) {
      handleVoicePlay(replyText, replyMessageId);
    }
  };

  // 11. TEXT RESPONSE REQUEST HANDLER
  const handleSendMessage = async (textToSend?: string, targetSessionId?: string) => {
    const messageText = (textToSend || inputText).trim();
    if (!messageText || isGenerating) return;

    if (!textToSend) {
      setInputText("");
    }

    const currentSessionId = targetSessionId || activeSessionId;
    const currentSession = sessions.find(s => s.id === currentSessionId);
    if (!currentSession) return;

    const userMessage: Message = {
      id: `user_${Date.now()}`,
      role: "user",
      text: messageText,
      timestamp: new Date().toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" }),
    };

    const updatedMessages = [...currentSession.messages, userMessage];
    
    // Dynamic renaming of initial chats
    let sessionTitle = currentSession.title;
    if (currentSession.title === "Yeni Sohbet") {
      sessionTitle = messageText.length > 25 ? `${messageText.slice(0, 25)}...` : messageText;
    }

    const updatedSessions = sessions.map(s => {
      if (s.id === currentSessionId) {
        return { ...s, title: sessionTitle, messages: updatedMessages };
      }
      return s;
    });

    saveSessionsToLocal(updatedSessions);
    setIsGenerating(true);
    setApiError(null);
    setEmailStatus(null);

    try {
      const messageHistory = currentSession.messages.slice(-8).map(m => ({
        role: m.role,
        text: m.text,
      }));

      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: messageText,
          history: messageHistory,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        const isKeyMissing = res.status === 403 || errorData.error?.includes("GEMINI_API_KEY");
        throw {
          message: errorData.error || "Uzak sunucu yapay zekâ asistanına uluşamadı.",
          isKeyMissing
        };
      }

      const data = await res.json();

      const aiMessage: Message = {
        id: `ai_${Date.now()}`,
        role: "model",
        text: data.reply,
        suggestions: data.suggestions || [],
        timestamp: new Date().toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" }),
        isAudioPlayable: true,
      };

      const finalSessions = updatedSessions.map(s => {
        if (s.id === currentSessionId) {
          return { ...s, messages: [...s.messages, aiMessage] };
        }
        return s;
      });

      saveSessionsToLocal(finalSessions);
      maybeTriggerAutoVoice(data.reply, aiMessage.id);

    } catch (err: any) {
      console.error("Chat action error:", err);
      setApiError({
        message: err.message || "Bilinmeyen bir iletişim hatası oluştu.",
        isKeyMissing: !!err.isKeyMissing
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // Modern and neat non-bot starter templates (stripped of branching and trees styling details)
  const initialWelcomeStarters = [
    { text: "Bana başarılı olmak için verimli bir günlük çalışma planı tasarla.", label: "Modelleme" },
    { text: "Yazılım algoritmalarında hız kazanmak için hangi temel adımları izlemeliyim?", label: "Yazılım" },
    { text: "Modern dünyada dikkat dağınıklığını nasıl aşabiliriz? Bana pratik öneriler ver.", label: "Analiz" },
    { text: "Bana felsefe tarihinde ufkumu genişletecek üç çarpıcı düşünce akımı anlat.", label: "Felsefe" }
  ];

  return (
    <div className="flex h-screen bg-[#060a12] text-gray-100 overflow-hidden font-sans">
      
      {/* Sidebar Navigation */}
      <div className={`transition-all duration-300 ${isSidebarOpen ? "w-80" : "w-0 overflow-hidden"}`}>
        <Sidebar
          sessions={sessions}
          activeSessionId={activeSessionId}
          onSelectSession={(id) => {
            setActiveSessionId(id);
            stopAudioPlayback();
            setApiError(null);
            setEmailStatus(null);
          }}
          onNewSession={createNewSession}
          onDeleteSession={handleDeleteSession}
          onClearAll={handleClearAllSessions}
        />
      </div>

      {/* Primary chat canvas */}
      <div className="flex-1 flex flex-col relative h-full bg-gradient-to-b from-[#080d19] via-[#050912] to-[#03060c]">
        
        {/* Header Ribbon / Navigation status */}
        <header className="h-20 border-b border-[#1e293b]/50 flex items-center justify-between px-6 bg-[#070b13]/90 backdrop-blur-sm z-30">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="p-2.5 bg-[#0f172a] hover:bg-indigo-950/40 border border-[#1e293b] rounded-xl text-indigo-400 cursor-pointer transition-colors"
              title={isSidebarOpen ? "Menüyü Gizle" : "Menüyü Göster"}
            >
              {isSidebarOpen ? <PanelLeftClose className="w-4 h-4" /> : <PanelLeft className="w-4 h-4" />}
            </button>

            <span className="h-6 w-[1px] bg-[#1e293b]" />

            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse" />
              <div>
                <h2 className="font-display font-semibold text-white text-sm">
                  {activeSession ? activeSession.title : "Yeni Sohbet"}
                </h2>
                <p className="text-[10px] text-gray-400 font-mono">Çınar AI Bilgi İletişim Hattı</p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            
            {/* GOOGLE SIGN IN OR PROFILE PANEL */}
            {authLoading ? (
              <div className="flex items-center gap-2 px-3 py-1.5 bg-[#0e1726] border border-[#1e293b] rounded-xl">
                <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-400" />
                <span className="text-xs text-gray-400 font-mono">Kontrol ediliyor...</span>
              </div>
            ) : user ? (
              /* User Profile & Logout details */
              <div className="flex items-center gap-3 bg-[#0c1220]/95 border border-[#1e293b] p-1.5 pr-3 rounded-2xl">
                {user.photoURL ? (
                  <img src={user.photoURL} alt={user.displayName || "User"} className="w-7 h-7 rounded-lg object-cover" referrerPolicy="no-referrer" />
                ) : (
                  <div className="w-7 h-7 rounded-lg bg-indigo-950 flex items-center justify-center text-indigo-400 text-xs">
                    <UserIcon className="w-3.5 h-3.5" />
                  </div>
                )}
                <div className="hidden md:block text-left">
                  <p className="text-xs font-semibold text-white line-clamp-1 leading-snug">{user.displayName || "Kullanıcı"}</p>
                  <p className="text-[9px] text-indigo-400 font-mono leading-none">{user.email}</p>
                </div>
                <button
                  onClick={handleSignOut}
                  className="p-1 px-1.5 text-gray-400 hover:text-red-400 hover:bg-red-950/20 active:scale-95 rounded transition-all cursor-pointer"
                  title="Oturumu Kapat"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : (
              /* Google Authentication Launch Button */
              <button
                onClick={handleSignIn}
                className="gsi-material-button text-xs font-semibold bg-white text-gray-900 border border-gray-300 hover:bg-gray-50 flex items-center gap-2 px-3.5 py-1.5 rounded-xl cursor-pointer transition-colors shadow-sm active:scale-95 duration-100"
              >
                <div className="gsi-material-button-icon flex items-center justify-center w-4 h-4">
                  <svg version="1.1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" style={{ display: "block" }}>
                    <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"></path>
                    <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"></path>
                    <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"></path>
                    <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"></path>
                  </svg>
                </div>
                <span>Google ile Oturum Aç</span>
              </button>
            )}

            <span className="hidden sm:inline h-5 w-[1px] bg-[#1e293b]" />

            {/* Read Aloud Toggle */}
            <button
              onClick={() => {
                setIsVoiceEnabled(!isVoiceEnabled);
                if (isVoiceEnabled) {
                  stopAudioPlayback();
                }
              }}
              className={`p-2 border rounded-xl flex items-center gap-1.5 text-xs transition-colors cursor-pointer ${
                isVoiceEnabled
                  ? "bg-indigo-950/50 border-indigo-500/40 text-indigo-300"
                  : "bg-[#0c1220] border-[#1e293b] text-gray-400 hover:text-gray-200"
              }`}
              title="Cevapları Otomatik Seslendir"
            >
              {isVoiceEnabled ? <Volume2 className="w-3.5 h-3.5 animate-bounce text-indigo-400" /> : <VolumeX className="w-3.5 h-3.5" />}
              <span className="hidden lg:inline text-[11px] font-semibold">{isVoiceEnabled ? "Ses Açık" : "Sesi Aç"}</span>
            </button>
          </div>
        </header>

        {/* Workspace Missing credentials notification */}
        {apiError && apiError.isKeyMissing && (
          <div className="m-4 p-4 bg-amber-950/20 border border-amber-500/30 rounded-2xl flex items-start gap-3.5 animate-fade-in shadow-lg">
            <AlertCircle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
            <div className="text-xs text-amber-200/90 flex-1">
              <span className="font-semibold block text-sm mb-0.5 text-white">Yapay Zekâ API Anahtarı Gerekli</span>
              <p className="leading-relaxed mb-2">
                Çınar AI asistanının yanıt verebilmesi için sisteminize <strong>GEMINI_API_KEY</strong> eklenmelidir. Lütfen sol taraftaki veya üst paneldeki <strong>Settings &gt; Secrets</strong> menüsünü kullanarak API anahtarınızı tanımlayın.
              </p>
              <a href="https://ai.studio/build" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-semibold text-white hover:underline">
                AI Studio Secrets <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </div>
        )}

        {/* Google Authentication simple notification */}
        {authWarning && (
          <div className="m-4 p-4 bg-red-950/15 border border-red-500/20 rounded-2xl flex items-start gap-3.5 animate-fade-in shadow-lg">
            <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
            <div className="text-xs text-gray-300 flex-1 flex items-center justify-between">
              <p className="leading-relaxed">
                {authWarning}
              </p>
              <button 
                onClick={() => setAuthWarning(null)}
                className="bg-red-950/20 text-red-300 hover:text-white text-xs px-2.5 py-1 rounded-lg border border-red-500/20 active:scale-95 ml-3 transition-all cursor-pointer"
              >
                Kapat
              </button>
            </div>
          </div>
        )}

        {/* Chat message listing scroll view */}
        <div className="flex-1 overflow-y-auto px-6 py-8 space-y-6">
          
          {/* Welcome Dashboard layout */}
          {(!activeSession || activeSession.messages.length === 0) ? (
            <div className="max-w-2xl mx-auto py-10 flex flex-col items-center justify-center text-center">
              
              <div className="relative mb-6">
                <div className="absolute inset-0 bg-indigo-500/15 rounded-full blur-2xl animate-pulse" />
                <div className="absolute inset-0 bg-gradient-to-br from-indigo-950 to-[#0e172a] border border-indigo-500/30 rounded-2xl shadow-lg" />
                <div className="relative p-5 text-indigo-400">
                  <Brain className="w-10 h-10 animate-pulse" />
                </div>
              </div>

              <h3 className="font-display font-bold text-2xl sm:text-3xl text-white tracking-wide mb-3">
                Çınar AI Platformuna Hoş Geldiniz
              </h3>
              
              <p className="text-gray-400 leading-relaxed font-display text-xs sm:text-sm max-w-md mb-8">
                Merak ettiğiniz her konuda size rehberlik etmek üzere geliştirilmiş, rasyonel ve hızlı yapay zekâ asistanınız. Aşağıdaki konuları seçerek sohbete hemen başlayabilirsiniz.
              </p>

              {/* Suggestions grid items */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full">
                {initialWelcomeStarters.map((starter, ix) => (
                  <button
                    key={ix}
                    onClick={() => handleSendMessage(starter.text)}
                    className="p-4 bg-[#0e1422] hover:bg-indigo-950/20 border border-[#1e293b] hover:border-indigo-500/30 text-left text-xs sm:text-sm text-gray-300 rounded-2xl group transition-all duration-200 cursor-pointer flex flex-col justify-between hover:scale-[1.01]"
                  >
                    <span className="font-medium group-hover:text-indigo-300 leading-snug">
                      {starter.text}
                    </span>
                    <div className="flex items-center gap-1 text-indigo-400/50 mt-3 font-display uppercase tracking-widest text-[9px] font-bold">
                      <Sparkles className="w-3 h-3 group-hover:text-indigo-400 transition-colors" />
                      <span>{starter.label}</span>
                    </div>
                  </button>
                ))}
              </div>

            </div>
          ) : (
            
            /* Message Bubbles listing */
            <div className="max-w-3xl mx-auto space-y-6">
              {activeSession.messages.map((msg, idx) => {
                const isUser = msg.role === "user";
                return (
                  <motion.div
                    key={msg.id || idx}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.2 }}
                    className={`flex items-start gap-4 ${isUser ? "justify-end" : "justify-start"}`}
                  >
                    {!isUser && (
                      <div className="w-8 h-8 rounded-lg bg-indigo-950 border border-indigo-500/20 flex items-center justify-center text-indigo-400 flex-shrink-0 mt-1 shadow-sm">
                        <Bot className="w-4 h-4" />
                      </div>
                    )}

                    <div className="flex flex-col max-w-[85%] space-y-1">
                      
                      <div className={`p-4 rounded-2xl font-display text-sm leading-relaxed relative ${
                        isUser
                          ? "bg-gradient-to-br from-indigo-950 to-[#4f46e5]/10 border border-indigo-500/30 text-gray-100 rounded-tr-none"
                          : "bg-[#0d1321] border border-[#1e293b]/80 text-gray-200 rounded-tl-none"
                      }`}>
                        
                        <div className="markdown-body text-gray-100">
                          <Markdown>{msg.text}</Markdown>
                        </div>

                        {/* Speech & Email Action Bar underneath Bot responses */}
                        {!isUser && msg.isAudioPlayable !== false && (
                          <div className="mt-4 pt-3 border-t border-[#1e293b]/40 flex items-center justify-between gap-3 flex-wrap">
                            
                            {/* Send to my Email button (Gmail integration confirmation) */}
                            <div className="flex items-center gap-1.5">
                              {user ? (
                                <button
                                  onClick={() => handleSendEmail(msg.text, msg.id, activeSession?.title || "Sohbet Detayı")}
                                  className="px-2.5 py-1.5 rounded-lg border bg-[#060a12] border-[#1e293b] hover:border-indigo-500/30 text-gray-400 hover:text-indigo-300 transition-colors text-xs flex items-center gap-1.5 cursor-pointer"
                                  title="Bu mesajı e-posta olarak kendime hazırla"
                                >
                                  {isSendingEmail === msg.id ? (
                                    <>
                                      <Loader2 className="w-3 h-3 animate-spin text-indigo-400" />
                                      <span>Hazırlanıyor...</span>
                                    </>
                                  ) : (
                                    <>
                                      <Mail className="w-3.5 h-3.5" />
                                      <span>E-posta Gönder</span>
                                    </>
                                  )}
                                </button>
                              ) : (
                                <button
                                  onClick={async () => {
                                    try {
                                      const cleanText = msg.text.replace(/[*#`_\-]/g, "");
                                      if (navigator.clipboard && navigator.clipboard.writeText) {
                                        await navigator.clipboard.writeText(cleanText);
                                        alert("Bilgi notu panoya kopyalandı!");
                                      } else {
                                        alert("Tarayıcınız panoya yazmayı desteklemiyor.");
                                      }
                                    } catch (e) {
                                      console.error(e);
                                    }
                                  }}
                                  className="px-2.5 py-1.5 rounded-lg border bg-[#060a12] border-[#1e293b] hover:border-indigo-500/20 text-gray-500 hover:text-gray-300 transition-colors text-xs flex items-center gap-1 cursor-pointer"
                                  title="Oturum açmadan metni kopyalayın"
                                >
                                  <Mail className="w-3.5 h-3.5" />
                                  <span className="text-[11px]">Panoya Kopyala</span>
                                </button>
                              )}

                              {/* Email Status Alert message inline inside message frame */}
                              {emailStatus && emailStatus.id === msg.id && (
                                <div className={`flex items-center gap-1.5 px-2 py-1 rounded-md text-[10px] uppercase font-mono tracking-widest ${
                                  emailStatus.success ? "text-green-400 bg-green-950/20" : "text-red-400 bg-red-950/20"
                                }`}>
                                  {emailStatus.success ? <CheckCircle className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                                  <span>{emailStatus.success ? "İletildi" : "Hata"}</span>
                                </div>
                              )}
                            </div>

                            {/* Text to speech Playback button */}
                            <button
                              onClick={() => handleVoicePlay(msg.text, msg.id)}
                              disabled={audioLoadingId !== null && audioLoadingId !== msg.id}
                              className={`px-3 py-1.5 rounded-lg border text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50 ${
                                currentlyPlayingAudioId === msg.id
                                  ? "bg-indigo-500/20 border-indigo-400 text-indigo-300"
                                  : "bg-[#0c1221] border-[#1e293b] hover:border-indigo-500/30 text-gray-400 hover:text-indigo-400"
                              }`}
                            >
                              {audioLoadingId === msg.id ? (
                                <>
                                  <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-400" />
                                  <span>Kodlanıyor...</span>
                                </>
                              ) : currentlyPlayingAudioId === msg.id ? (
                                <>
                                  <VolumeX className="w-3.5 h-3.5 text-indigo-400" />
                                  <span>Durdur</span>
                                </>
                              ) : (
                                <>
                                  <Volume2 className="w-3.5 h-3.5" />
                                  <span>Seslendir</span>
                                </>
                              )}
                            </button>

                          </div>
                        )}
                        
                      </div>

                      {/* Suggestions list of questions */}
                      {!isUser && msg.suggestions && msg.suggestions.length > 0 && idx === activeSession.messages.length - 1 && (
                        <div className="pt-2 animate-fade-in">
                          <div className="text-[10px] font-semibold text-indigo-400/60 uppercase tracking-widest ml-1 mb-1.5 flex items-center gap-1">
                            <Sparkles className="w-3 h-3 text-indigo-400" />
                            <span>Önerilen Takip Konuları</span>
                          </div>
                          <div className="flex flex-wrap gap-1.5">
                            {msg.suggestions.map((sug, sIndex) => (
                              <button
                                key={sIndex}
                                onClick={() => handleSendMessage(sug)}
                                className="px-3 py-2 bg-[#0a0f18] hover:bg-indigo-950/30 border border-[#1e293b]/70 hover:border-indigo-500/30 text-xs text-gray-300 hover:text-indigo-300 rounded-xl cursor-pointer font-medium hover:scale-[1.01] transition-all"
                              >
                                {sug}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      <span className={`text-[10px] font-mono text-gray-500 px-1.5 ${isUser ? "text-right" : "text-left"}`}>
                        {msg.timestamp}
                      </span>
                    </div>

                    {isUser && (
                      <div className="w-8 h-8 rounded-lg bg-[#0e1422] border border-[#1e293b] flex items-center justify-center text-gray-400 flex-shrink-0 mt-1 shadow-sm">
                        <UserIcon className="w-4 h-4" />
                      </div>
                    )}
                  </motion.div>
                );
              })}

              {/* Bot thinking placeholder loading */}
              {isGenerating && (
                <div className="flex items-start gap-4 animate-fade-in">
                  <div className="w-8 h-8 rounded-lg bg-indigo-950 border border-indigo-500/20 flex items-center justify-center text-indigo-400 flex-shrink-0 animate-pulse">
                    <Bot className="w-4 h-4" />
                  </div>
                  <div className="bg-[#0b101c] border border-[#1e293b] text-gray-400 p-4 rounded-2xl rounded-tl-none font-display text-sm inline-flex items-center gap-3">
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-400" />
                    <span className="animate-pulse text-xs">Çınar AI bilgiyi işliyor, düşünüyor...</span>
                  </div>
                </div>
              )}

              {/* Chat generic error messages */}
              {apiError && !apiError.isKeyMissing && (
                <div className="p-4 bg-red-950/10 border border-red-500/25 rounded-2xl text-xs text-red-300 flex items-start gap-2 max-w-lg">
                  <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold block text-white mb-0.5">Yapay Zekâ Protokol Hatası</span>
                    <p className="leading-relaxed">{apiError.message}</p>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>
          )}

        </div>

        {/* Enter Text Submission area */}
        <footer className="p-4 sm:p-6 border-t border-[#1e293b]/50 bg-[#070c14]/90 z-10">
          <div className="max-w-3xl mx-auto">
            <div className="relative flex items-center rounded-2xl bg-[#090f1a] border border-[#1e293b] focus-within:border-indigo-500/50 focus-within:ring-2 focus-within:ring-indigo-950 transition-all shadow-inner px-3 py-1.5">
              
              <textarea
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Çınar AI ile sohbete başlayın..."
                rows={1}
                disabled={isGenerating}
                className="flex-1 max-h-32 min-h-[36px] outline-none text-sm text-gray-200 placeholder-gray-500 bg-transparent resize-none py-2 pr-12 pl-2 focus:ring-0 select-text"
              />

              <button
                onClick={() => handleSendMessage()}
                disabled={!inputText.trim() || isGenerating}
                className="absolute right-2.5 p-2 bg-gradient-to-r from-indigo-600 to-indigo-500 text-white rounded-xl active:scale-95 disabled:hover:scale-100 disabled:from-gray-800 disabled:to-gray-800 disabled:opacity-30 disabled:text-gray-500 hover:shadow-lg hover:shadow-indigo-900/40 transition-all flex items-center justify-center cursor-pointer"
                title="Sorgula"
              >
                {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              </button>

            </div>

            <div className="mt-2.5 flex items-center justify-between text-[10px] text-gray-500 px-1">
              <span>Göndermek için Enter&apos;a basın. Satır atlamak için Shift + Enter.</span>
              <span className="flex items-center gap-1 font-mono text-indigo-400/40">
                <Sparkles className="w-3 h-3 text-indigo-500/40" />
                <span>Çınar AI Secure Link</span>
              </span>
            </div>
          </div>
        </footer>

      </div>
    </div>
  );
}
