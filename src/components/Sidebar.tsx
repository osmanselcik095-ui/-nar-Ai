import React from "react";
import { 
  Plus, 
  MessageSquare, 
  Trash2, 
  Sparkles, 
  Cpu, 
  Bot,
  BrainCircuit,
  Terminal,
  FileText,
  HelpCircle,
  Lightbulb,
  Info
} from "lucide-react";
import { ChatSession } from "../types";
import { motion, AnimatePresence } from "motion/react";

interface SidebarProps {
  sessions: ChatSession[];
  activeSessionId: string;
  onSelectSession: (id: string) => void;
  onNewSession: (categoryPrompt?: string) => void;
  onDeleteSession: (id: string, e: React.MouseEvent) => void;
  onClearAll: () => void;
}

export default function Sidebar({
  sessions,
  activeSessionId,
  onSelectSession,
  onNewSession,
  onDeleteSession,
  onClearAll,
}: SidebarProps) {
  // Ultra-clean assistant starter categories (with NO tree/nature/branch themes as requested)
  const starterCategories = [
    { name: "Yazılım ve Kodlama", desc: "Kod analizi, refactoring ve çözümler", icon: Terminal, prompt: "Yazılım geliştirme, algoritmalar veya kod hatalarını çözme üzerine bir sohbet başlatmak istiyorum." },
    { name: "Akıllı Beyin Fırtınası", desc: "Fikirler, projeler ve stratejiler", icon: BrainCircuit, prompt: "Birlikte yaratıcı bir beyin fırtınası yapalım. Bana yeni proje fikirleri ve stratejik hedefler sun." },
    { name: "İçerik ve Edebiyat", desc: "Makale yazımı, çeviri ve özetler", icon: FileText, prompt: "Bir metin hazırlamak veya içerik üretmek istiyorum. Bana dil bilgisi ve etkileyici anlatım konusunda yardımcı olur musun?" },
    { name: "Genel Soru ve Analiz", desc: "Merak ettiğin her şey ve mantık yürütme", icon: HelpCircle, prompt: "Merak ettiğim karmaşık bir konuyu basitleştirerek bana adım adım açıklar mısın?" }
  ];

  return (
    <div className="flex flex-col h-full bg-[#0a0f18] border-r border-[#1e293b] text-gray-300 w-80 flex-shrink-0 select-none">
      {/* Brand Header */}
      <div className="p-6 border-b border-[#1e293b] bg-gradient-to-b from-[#060a12] to-[#0a0f18]">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-indigo-950/80 border border-indigo-500/30 rounded-xl shadow-inner text-indigo-400">
            <Bot className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <h1 className="font-display font-bold text-xl text-white tracking-wide flex items-center gap-1.5">
              Çınar AI
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-400 border border-indigo-500/20">v3.0</span>
            </h1>
            <p className="text-xs text-indigo-400 font-display">Gelişmiş Yapay Zekâ Asistanı</p>
          </div>
        </div>
      </div>

      {/* New Session Button */}
      <div className="p-4">
        <button
          onClick={() => onNewSession()}
          className="w-full py-3 px-4 bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-450 text-white rounded-xl font-medium shadow-md shadow-indigo-950/40 hover:shadow-indigo-500/10 active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer border border-indigo-500/20 font-display"
        >
          <Plus className="w-5 h-5" />
          Yeni Sohbet Başlat
        </button>
      </div>

      {/* Chat History Section */}
      <div className="flex-1 overflow-y-auto px-4 py-2 space-y-2">
        <div className="flex items-center justify-between text-[11px] font-semibold text-indigo-400/60 uppercase tracking-widest px-2 mb-2 select-none">
          <span>SOHBET GEÇMİŞİ</span>
          {sessions.length > 0 && (
            <button
              onClick={onClearAll}
              className="hover:text-red-400 transition-colors text-[10px] cursor-pointer flex items-center gap-1 normal-case font-medium"
              title="Geçmişi Temizle"
            >
              Temizle
            </button>
          )}
        </div>

        {sessions.length === 0 ? (
          <div className="py-6 text-center text-xs text-gray-500 font-display italic">
            Geçmiş sohbet bulunmuyor.
          </div>
        ) : (
          <div className="space-y-1 max-h-[220px] overflow-y-auto pr-1">
            <AnimatePresence initial={false}>
              {sessions.map((session) => (
                <motion.div
                  key={session.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  className={`group relative flex items-center gap-2.5 px-3 py-2.5 rounded-xl cursor-pointer transition-all border ${
                    activeSessionId === session.id
                      ? "bg-indigo-950/30 border-indigo-500/30 text-indigo-300 shadow-sm"
                      : "bg-transparent border-transparent hover:bg-gray-800/10 text-gray-400 hover:text-gray-200"
                  }`}
                  onClick={() => onSelectSession(session.id)}
                >
                  <MessageSquare className={`w-4 h-4 flex-shrink-0 ${
                    activeSessionId === session.id ? "text-indigo-400" : "text-gray-500 group-hover:text-gray-400"
                  }`} />
                  <span className="text-sm truncate pr-6 font-display flex-1">
                    {session.title}
                  </span>
                  
                  {/* Delete Button */}
                  <button
                    onClick={(e) => onDeleteSession(session.id, e)}
                    className="absolute right-2 opacity-0 group-hover:opacity-100 hover:text-red-400 text-gray-400 transition-all p-1 hover:bg-red-950/30 rounded cursor-pointer"
                    title="Sil"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}

        {/* Categories Grid */}
        <div className="border-t border-[#1e293b] pt-4 mt-4">
          <div className="text-[11px] font-semibold text-indigo-400/60 uppercase tracking-widest px-2 mb-3">
            HIZLI ÇALIŞMA ALANLARI
          </div>
          <div className="grid grid-cols-1 gap-2">
            {starterCategories.map((cat, i) => {
              const Icon = cat.icon;
              return (
                <div
                  key={i}
                  onClick={() => onNewSession(cat.prompt)}
                  className="p-3 bg-gradient-to-br from-[#0c1322] to-[#0a0f1a] hover:from-[#111a30] hover:to-[#0f182c] border border-[#1e293b]/50 hover:border-indigo-500/20 rounded-xl cursor-pointer transition-all group active:scale-[0.98]"
                >
                  <div className="flex items-center gap-2.5 mb-1 text-indigo-400">
                    <div className="p-1.5 bg-indigo-950/30 border border-indigo-500/10 rounded-lg group-hover:bg-indigo-500/20 group-hover:text-indigo-300 transition-colors">
                      <Icon className="w-4 h-4" />
                    </div>
                    <span className="text-xs font-display font-medium text-gray-200 group-hover:text-indigo-300 transition-colors animate-fade-in">
                      {cat.name}
                    </span>
                  </div>
                  <p className="text-[11px] text-gray-500 line-clamp-1 pl-1">
                    {cat.desc}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* AI Quote Panel & Info Footer */}
      <div className="p-4 border-t border-[#1e293b] bg-[#060a12] space-y-3">
        <div className="p-3.5 bg-indigo-950/10 border border-indigo-500/10 rounded-xl text-xs relative overflow-hidden">
          <div className="flex items-start gap-2 text-indigo-400 font-display font-medium mb-1">
            <Lightbulb className="w-3.5 h-3.5 mt-0.5 text-yellow-400 animate-pulse" />
            <span>Günün Akıllı İpucu</span>
          </div>
          <p className="text-[11px] text-gray-400 leading-relaxed italic font-display">
            &quot;En karmaşık problemler, küçük parçalara bölünerek kolayca çözülenlerdir. Sorununuzu adım adım paylaşmaktan çekinmeyin.&quot;
          </p>
        </div>

        <div className="flex items-center justify-between text-[11px] text-gray-500 px-1 font-mono">
          <div className="flex items-center gap-1">
            <Info className="w-3 h-3 text-indigo-500/40" />
            <span>Çınar AI Enterprise</span>
          </div>
          <span>Cloud Compute</span>
        </div>
      </div>
    </div>
  );
}
