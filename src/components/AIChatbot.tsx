/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  MessageSquare,
  X,
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  Play,
  Pause,
  Square,
  Languages,
  UserCheck,
  Send,
  Loader2,
  ChevronDown,
  Sparkles,
  ArrowRight,
  Download,
  CheckCircle,
  AlertTriangle,
  Flame,
  Info,
  Trash2,
  Copy,
  Check,
  RotateCcw
} from 'lucide-react';
import { DailyLog, MasterItem, StockItemLog, CashDetailsLog, ExpenseLog } from '../types';

interface AIChatbotProps {
  ledgerState: {
    masterItems: MasterItem[];
    currentLog: DailyLog | null;
    logDates: string[];
    selectedDate: string;
  };
  onUpdateStock: (updatedStock: StockItemLog[]) => void;
  onAddExpense: (expense: ExpenseLog) => void;
  onUpdateCash: (updatedCash: CashDetailsLog) => void;
  onNavigate: (tab: 'ledger' | 'analytics') => void;
  onOpenManageCatalog: () => void;
  onDownloadExcel: () => void;
}

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  timestamp: Date;
  actionExecuted?: {
    type: string;
    description: string;
  };
  isReport?: boolean;
}

const SUPPORTED_LANGUAGES = [
  { name: 'Auto Detect', code: 'auto', native: 'Auto' },
  { name: 'English', code: 'en-US', native: 'English' },
  { name: 'Tamil', code: 'ta-IN', native: 'தமிழ்' },
  { name: 'Hindi', code: 'hi-IN', native: 'हिंदी' },
  { name: 'Telugu', code: 'te-IN', native: 'తెలుగు' },
  { name: 'Kannada', code: 'kn-IN', native: 'ಕನ್ನಡ' },
  { name: 'Malayalam', code: 'ml-IN', native: 'മലയാളം' },
  { name: 'Marathi', code: 'mr-IN', native: 'मರಾಠಿ' },
  { name: 'Bengali', code: 'bn-IN', native: 'বাংলা' },
  { name: 'Gujarati', code: 'gu-IN', native: 'ગુજરાતી' },
  { name: 'Punjabi', code: 'pa-IN', native: 'ਪੰਜਾਬੀ' },
  { name: 'Arabic', code: 'ar-SA', native: 'العربية' },
  { name: 'French', code: 'fr-FR', native: 'Français' },
  { name: 'German', code: 'de-DE', native: 'Deutsch' },
  { name: 'Spanish', code: 'es-ES', native: 'Español' },
  { name: 'Japanese', code: 'ja-JP', native: '日本語' },
  { name: 'Chinese', code: 'zh-CN', native: '简体中文' }
];

const SUGGESTED_COMMANDS = [
  { label: 'Show low stock products', icon: Flame },
  { label: "Show today's sales summary", icon: Sparkles },
  { label: 'Suggest restocking quantities', icon: Info },
  { label: 'Check products expiring soon', icon: AlertTriangle },
  { label: "Add 50 units of Rice (Refill)", command: "Add 50 units of Rice" },
  { label: "Navigate to Digital Audits", command: "Show analytics dashboard" }
];

export function AIChatbot({
  ledgerState,
  onUpdateStock,
  onAddExpense,
  onUpdateCash,
  onNavigate,
  onOpenManageCatalog,
  onDownloadExcel,
}: AIChatbotProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);
  
  // Settings States with LocalStorage Persistence
  const [selectedLang, setSelectedLang] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('ledgerhub_chat_lang') || 'auto';
    }
    return 'auto';
  });
  const [userRole, setUserRole] = useState<'Admin' | 'Manager' | 'Staff'>(() => {
    if (typeof window !== 'undefined') {
      return (localStorage.getItem('ledgerhub_chat_role') as any) || 'Staff';
    }
    return 'Staff';
  });
  const [isVoiceEnabled, setIsVoiceEnabled] = useState(() => {
    if (typeof window !== 'undefined') {
      const val = localStorage.getItem('ledgerhub_chat_voice_enabled');
      return val !== null ? val === 'true' : true;
    }
    return true;
  });
  const [isContinuousMode, setIsContinuousMode] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('ledgerhub_chat_continuous_mode') === 'true';
    }
    return false;
  });
  const [voiceRate, setVoiceRate] = useState(1.0);
  const [voicePitch, setVoicePitch] = useState(1.0);
  const [availableVoices, setAvailableVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [selectedVoiceName, setSelectedVoiceName] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('ledgerhub_chat_selected_voice') || '';
    }
    return '';
  });

  // Speech Recognition State
  const [isListening, setIsListening] = useState(false);
  const [speechError, setSpeechError] = useState<string | null>(null);

  // Audio Playback / TTS Status
  const [isPlayingSpeech, setIsPlayingSpeech] = useState(false);
  const [isSpeechPaused, setIsSpeechPaused] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);

  // Smart Notification Alerts
  const [notifications, setNotifications] = useState<string[]>([]);

  // Persist settings changes
  useEffect(() => {
    localStorage.setItem('ledgerhub_chat_lang', selectedLang);
  }, [selectedLang]);

  useEffect(() => {
    localStorage.setItem('ledgerhub_chat_role', userRole);
  }, [userRole]);

  useEffect(() => {
    localStorage.setItem('ledgerhub_chat_voice_enabled', String(isVoiceEnabled));
  }, [isVoiceEnabled]);

  useEffect(() => {
    localStorage.setItem('ledgerhub_chat_continuous_mode', String(isContinuousMode));
  }, [isContinuousMode]);

  useEffect(() => {
    if (selectedVoiceName) {
      localStorage.setItem('ledgerhub_chat_selected_voice', selectedVoiceName);
    }
  }, [selectedVoiceName]);

  // Load voices for synthesis
  useEffect(() => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      const loadVoices = () => {
        const voices = window.speechSynthesis.getVoices();
        setAvailableVoices(voices);
        
        const savedVoice = localStorage.getItem('ledgerhub_chat_selected_voice');
        if (savedVoice && voices.some(v => v.name === savedVoice)) {
          setSelectedVoiceName(savedVoice);
        } else {
          // Default select a good native or language voice
          const defaultVoice = voices.find(v => v.default || v.lang.startsWith('en'));
          if (defaultVoice) {
            setSelectedVoiceName(defaultVoice.name);
          }
        }
      };
      loadVoices();
      window.speechSynthesis.onvoiceschanged = loadVoices;
    }
  }, []);

  // Compute smart notifications alerts from ledger state on load & changes
  useEffect(() => {
    const alerts: string[] = [];
    const masterItems = ledgerState.masterItems || [];
    const currentLog = ledgerState.currentLog;

    if (currentLog?.stockItems) {
      const lowStock = currentLog.stockItems.filter(s => s.balanceStock <= 5 && s.balanceStock > 0);
      const outOfStock = currentLog.stockItems.filter(s => s.balanceStock === 0);
      
      if (lowStock.length > 0) {
        alerts.push(`Low stock warning: ${lowStock.length} items are running low (under 5 units).`);
      }
      if (outOfStock.length > 0) {
        alerts.push(`Out of stock alert: ${outOfStock.length} products are completely out of stock.`);
      }
    }

    // Short expiry warnings
    const dairyCount = masterItems.filter(it => 
      ['milk', 'bread', 'curd', 'egg', 'cheese', 'butter'].some(keyword => it.name.toLowerCase().includes(keyword))
    ).length;
    if (dairyCount > 0) {
      alerts.push(`Expiry warning: ${dairyCount} dairy / bakery products have short shelf life (expiring in 3-5 days).`);
    }

    setNotifications(alerts);
  }, [ledgerState]);

  // Scroll to bottom of chat
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  // Clear speech when closing
  useEffect(() => {
    if (!isOpen) {
      stopSpeech();
    }
  }, [isOpen]);

  // Welcome message
  useEffect(() => {
    if (messages.length === 0) {
      setMessages([
        {
          id: 'welcome',
          role: 'assistant',
          text: `Hello! I am your **LedgerHub AI Assistant**. 🌟

I can help you monitor inventory, calculate sales, recommend restocks, track expiry ranges, log expenses, and even update stocks instantly via voice or chat!

How can I assist you with your grocery ledger today? You can choose your system access level above to simulate different roles.`,
          timestamp: new Date()
        }
      ]);
    }
  }, []);

  // Speech Recognition Setup
  const startSpeechRecognition = () => {
    setSpeechError(null);
    if (typeof window === 'undefined') return;

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setSpeechError('Speech recognition is not supported in this browser. Try Google Chrome.');
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognitionRef.current = recognition;
      recognition.continuous = false;
      recognition.interimResults = false;

      // Map selected lang to voice recognition code
      let langCode = 'en-US';
      if (selectedLang !== 'auto') {
        langCode = selectedLang;
      } else {
        // Fallback to primary locale or system locale for auto-detect
        langCode = (typeof navigator !== 'undefined' && navigator.language) || 'en-US';
      }
      recognition.lang = langCode;

      recognition.onstart = () => {
        setIsListening(true);
        // Stop any active TTS reading when user starts speaking
        stopSpeech();
      };

      recognition.onerror = (e: any) => {
        console.error('Speech recognition error:', e);
        setSpeechError(`Error: ${e.error || 'Failed to capture voice input.'}`);
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognition.onresult = (event: any) => {
        const text = event.results[0][0].transcript;
        if (text) {
          setInputText(text);
          sendMessage(text);
        }
      };

      recognition.start();
    } catch (e: any) {
      console.error(e);
      setSpeechError('Failed to initialize microphone service.');
      setIsListening(false);
    }
  };

  const stopSpeechRecognition = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
    setIsListening(false);
  };

  // Text To Speech Synthesis
  const speakText = (text: string) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window) || !isVoiceEnabled) return;

    // Stop current speech
    window.speechSynthesis.cancel();

    // Clean markdown characters for pleasant speech read-back
    const cleanText = text
      .replace(/\*\*([^*]+)\*\*/g, '$1') // remove bold asterisks
      .replace(/\*([^*]+)\*/g, '$1') // remove italic asterisks
      .replace(/#/g, '') // remove headers
      .replace(/[-*+]\s+/g, '') // remove lists bullets
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // remove markdown links
      .slice(0, 400); // Speak first 400 chars to avoid infinite loop

    const utterance = new SpeechSynthesisUtterance(cleanText);
    
    // Choose selected voice
    if (selectedVoiceName) {
      const voiceObj = availableVoices.find(v => v.name === selectedVoiceName);
      if (voiceObj) {
        utterance.voice = voiceObj;
      }
    }

    // Set voice language code
    if (selectedLang !== 'auto') {
      utterance.lang = selectedLang;
    }

    utterance.rate = voiceRate;
    utterance.pitch = voicePitch;

    utterance.onstart = () => {
      setIsPlayingSpeech(true);
      setIsSpeechPaused(false);
    };

    utterance.onend = () => {
      setIsPlayingSpeech(false);
      setIsSpeechPaused(false);
      if (isContinuousMode) {
        // Auto restart voice recognition after assistant finishes speaking
        setTimeout(() => {
          startSpeechRecognition();
        }, 600); // 600ms delay to prevent listening to TTS tail echo
      }
    };

    utterance.onerror = () => {
      setIsPlayingSpeech(false);
      setIsSpeechPaused(false);
    };

    window.speechSynthesis.speak(utterance);
  };

  const pauseSpeech = () => {
    if (typeof window !== 'undefined' && window.speechSynthesis.speaking && !window.speechSynthesis.paused) {
      window.speechSynthesis.pause();
      setIsSpeechPaused(true);
    }
  };

  const resumeSpeech = () => {
    if (typeof window !== 'undefined' && window.speechSynthesis.paused) {
      window.speechSynthesis.resume();
      setIsSpeechPaused(false);
    }
  };

  const stopSpeech = () => {
    if (typeof window !== 'undefined') {
      window.speechSynthesis.cancel();
      setIsPlayingSpeech(false);
      setIsSpeechPaused(false);
    }
  };

  // Execute structured actions received from Gemini AI model
  const executeSystemAction = (action: { type: string; payload: any }) => {
    if (!action || !action.type) return null;

    try {
      const { type, payload } = action;

      switch (type) {
        case 'UPDATE_STOCK': {
          const currentLog = ledgerState.currentLog;
          const masterItems = ledgerState.masterItems;
          if (!currentLog) return null;

          const { itemId, field, value } = payload;
          if (!itemId || !field || value === undefined) return null;

          // Find product in current log or master list
          const existingIdx = currentLog.stockItems.findIndex((s) => s.itemId === itemId);
          let targetName = '';

          const updatedStock = [...currentLog.stockItems];
          if (existingIdx > -1) {
            targetName = updatedStock[existingIdx].itemName;
            updatedStock[existingIdx] = {
              ...updatedStock[existingIdx],
              [field]: value
            };

            // Recalculate sales: (Open + Refill) - Balance
            const open = updatedStock[existingIdx].openStock || 0;
            const refill = updatedStock[existingIdx].refillStock || 0;
            const balance = updatedStock[existingIdx].balanceStock || 0;
            updatedStock[existingIdx].salesCount = Math.max(0, (open + refill) - balance);
          } else {
            // Find in master list
            const master = masterItems.find((m) => m.id === itemId);
            if (!master) return null;
            targetName = master.name;

            const newItem: StockItemLog = {
              itemId: master.id,
              itemName: master.name,
              openStock: field === 'openStock' ? value : master.defaultOpenStock,
              refillStock: field === 'refillStock' ? value : 0,
              balanceStock: field === 'balanceStock' ? value : master.defaultOpenStock,
              salesCount: 0,
              itemPrice: master.defaultPrice
            };
            
            // Recalculate sales
            const open = newItem.openStock || 0;
            const refill = newItem.refillStock || 0;
            const balance = newItem.balanceStock || 0;
            newItem.salesCount = Math.max(0, (open + refill) - balance);

            updatedStock.push(newItem);
          }

          onUpdateStock(updatedStock);
          return {
            type,
            description: `Updated ${targetName}'s "${field}" to ${value} units.`
          };
        }

        case 'ADD_EXPENSE': {
          const { category, amount, description, paymentMethod } = payload;
          if (!amount || !category) return null;

          const newExpense: ExpenseLog = {
            id: `exp_${Date.now()}`,
            category: category || 'Others',
            amount: Number(amount),
            description: description || 'Added via AI Assistant',
            paymentMethod: paymentMethod || 'cash'
          };

          onAddExpense(newExpense);
          return {
            type,
            description: `Logged a ₹${amount} expense under "${category}" using ${paymentMethod || 'cash'}.`
          };
        }

        case 'UPDATE_CASH': {
          const currentLog = ledgerState.currentLog;
          if (!currentLog) return null;

          const { field, value } = payload;
          if (!field || value === undefined) return null;

          const updatedCash = {
            ...currentLog.cashDetails,
            [field]: Number(value)
          };

          onUpdateCash(updatedCash);
          return {
            type,
            description: `Updated daily cash details: "${field}" set to ₹${value}.`
          };
        }

        case 'NAVIGATE': {
          const { tab } = payload;
          if (tab === 'ledger' || tab === 'analytics') {
            onNavigate(tab);
            return {
              type,
              description: `Navigated dashboard view to "${tab === 'ledger' ? 'Compliance Overview' : 'Digital Audits'}".`
            };
          }
          return null;
        }

        case 'OPEN_MANAGE_CATALOG': {
          onOpenManageCatalog();
          return {
            type,
            description: 'Opened the catalog manager settings modal.'
          };
        }

        default:
          return null;
      }
    } catch (e) {
      console.error('Error executing system action:', e);
      return null;
    }
  };

  const copyToClipboard = (text: string, msgId: string) => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(text);
      setCopiedMessageId(msgId);
      setTimeout(() => {
        setCopiedMessageId(null);
      }, 2000);
    }
  };

  const handleClearChat = () => {
    if (confirm('Are you sure you want to clear your chat history?')) {
      stopSpeech();
      setMessages([
        {
          id: 'welcome',
          role: 'assistant',
          text: `Hello! I am your **LedgerHub AI Assistant**. 🌟\n\nI can help you monitor inventory, calculate sales, recommend restocks, track expiry ranges, log expenses, and even update stocks instantly via voice or chat!\n\nHow can I assist you with your grocery ledger today? You can choose your system access level above to simulate different roles.`,
          timestamp: new Date()
        }
      ]);
    }
  };

  const handleRegenerate = async (msgId: string) => {
    const idx = messages.findIndex(m => m.id === msgId);
    if (idx === -1) return;

    // Find the last user message before this assistant message
    let lastUserQuery = '';
    for (let i = idx - 1; i >= 0; i--) {
      if (messages[i].role === 'user') {
        lastUserQuery = messages[i].text;
        break;
      }
    }

    if (!lastUserQuery) return;

    // Stop synthesis
    stopSpeech();

    // Remove the assistant message and everything after it
    setMessages(prev => prev.slice(0, idx));

    // Send the query again
    sendMessage(lastUserQuery);
  };

  // Main sending message engine
  const sendMessage = async (overrideText?: string) => {
    const textToSend = (overrideText || inputText).trim();
    if (!textToSend) return;

    // Add user message
    const userMsgId = `user_${Date.now()}`;
    const userMsg: ChatMessage = {
      id: userMsgId,
      role: 'user',
      text: textToSend,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMsg]);
    setInputText('');
    setIsLoading(true);

    try {
      // Build conversation history
      const formattedHistory = messages
        .filter(m => m.id !== 'welcome')
        .slice(-10) // Send last 10 messages for context
        .map(m => ({
          role: m.role,
          text: m.text
        }));

      // Send to server API
      const response = await fetch('/api/assistant/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: textToSend,
          history: formattedHistory,
          ledgerState: {
            masterItems: ledgerState.masterItems,
            currentLog: ledgerState.currentLog,
            logDates: ledgerState.logDates,
            selectedDate: ledgerState.selectedDate,
          },
          userRole: userRole,
        }),
      });

      if (!response.ok) {
        throw new Error('Server responded with an error');
      }

      const data = await response.json();
      
      let executedInfo = undefined;
      // Execute any direct client-side system actions returned by Gemini
      if (data.action) {
        const result = executeSystemAction(data.action);
        if (result) {
          executedInfo = result;
        }
      }

      // Check if message is a report format
      const textResponse = data.reply || '';
      const isReport = textResponse.toLowerCase().includes('report') || 
                       textResponse.toLowerCase().includes('sales summary') || 
                       textResponse.toLowerCase().includes('inventory summary');

      const assistantMsg: ChatMessage = {
        id: `ai_${Date.now()}`,
        role: 'assistant',
        text: textResponse,
        timestamp: new Date(),
        actionExecuted: executedInfo || undefined,
        isReport
      };

      setMessages(prev => [...prev, assistantMsg]);

      // Read reply aloud if voice is enabled
      if (isVoiceEnabled) {
        speakText(textResponse);
      }
    } catch (e: any) {
      console.error('Error in chat sending:', e);
      setMessages(prev => [
        ...prev,
        {
          id: `err_${Date.now()}`,
          role: 'assistant',
          text: '⚠️ Oh no! I was unable to connect to the LedgerHub AI server. Please make sure the backend dev server is booted and your **GEMINI_API_KEY** is configured correctly in the settings panel.',
          timestamp: new Date()
        }
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      sendMessage();
    }
  };

  return (
    <>
      {/* FLOATING ACTION BUTTON */}
      <motion.button
        id="floating-ai-chatbot-btn"
        type="button"
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-6 right-6 z-50 flex items-center justify-center gap-2 p-4 bg-gradient-to-r from-blue-600 via-indigo-600 to-indigo-700 hover:from-blue-700 hover:to-indigo-800 text-white shadow-2xl rounded-2xl cursor-pointer focus:outline-none ring-4 ring-white/20 border border-indigo-400/20"
        aria-label="Open Multilingual AI Chatbot Assistant"
      >
        <Sparkles className="w-5 h-5 animate-pulse text-yellow-300" />
        <span className="font-semibold text-sm pr-1">AI Assistant</span>
        
        {/* Unread Alerts Counter */}
        {notifications.length > 0 && (
          <span className="absolute -top-2 -right-2 flex h-5 w-5 items-center justify-center rounded-full bg-rose-500 text-[10px] font-bold text-white border-2 border-white ring-2 ring-rose-500/10">
            {notifications.length}
          </span>
        )}
      </motion.button>

      {/* CHAT CONTAINER PANEL */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            id="ai-assistant-panel"
            initial={{ opacity: 0, y: 100, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 100, scale: 0.9 }}
            transition={{ type: 'spring', damping: 25, stiffness: 220 }}
            className="fixed bottom-24 right-6 z-50 w-[95vw] sm:w-[480px] h-[78vh] sm:h-[650px] bg-slate-900 text-slate-100 rounded-3xl border border-slate-800 flex flex-col shadow-2xl overflow-hidden focus:outline-none"
          >
            {/* PANEL HEADER WITH METRICS */}
            <div className="p-4 bg-gradient-to-r from-slate-900 to-slate-950 border-b border-slate-800 flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-10 h-10 bg-indigo-600/30 border border-indigo-500/20 rounded-xl flex items-center justify-center">
                    <Sparkles className="w-5 h-5 text-yellow-300 animate-bounce" />
                  </div>
                  <div>
                    <h2 className="font-display font-bold text-base leading-tight flex items-center gap-1.5 text-white">
                      LedgerHub AI
                      <span className="text-[10px] px-2 py-0.5 bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 rounded-full font-mono font-bold animate-pulse">
                        LIVE
                      </span>
                    </h2>
                    <p className="text-[11px] text-slate-400 font-medium">Multilingual Shop Assistant & Voice Controller</p>
                  </div>
                </div>
                
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={handleClearChat}
                    className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors focus:outline-none"
                    title="Clear chat history"
                    aria-label="Clear chat history"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsOpen(false)}
                    className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors focus:outline-none"
                    aria-label="Close Chatbot Panel"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* CONTROLS AREA: ROLE SELECT & LANGUAGE */}
              <div className="grid grid-cols-2 gap-2 mt-1">
                {/* Role-Based Selector */}
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] text-slate-500 uppercase font-bold tracking-wider flex items-center gap-1">
                    <UserCheck className="w-3 h-3 text-indigo-400" />
                    Access Role
                  </label>
                  <div className="relative">
                    <select
                      value={userRole}
                      onChange={(e) => setUserRole(e.target.value as any)}
                      className="w-full bg-slate-800 hover:bg-slate-750 text-white text-xs px-2.5 py-1.5 rounded-xl border border-slate-700 focus:outline-none focus:border-indigo-500 appearance-none font-medium"
                    >
                      <option value="Staff">Staff (Queries & Operations)</option>
                      <option value="Manager">Manager (Full Stock/Cash Control)</option>
                      <option value="Admin">Admin (Full Override + Margin Reports)</option>
                    </select>
                    <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
                  </div>
                </div>

                {/* Multilingual Selector */}
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] text-slate-500 uppercase font-bold tracking-wider flex items-center gap-1">
                    <Languages className="w-3 h-3 text-emerald-400" />
                    Chat Language
                  </label>
                  <div className="relative">
                    <select
                      value={selectedLang}
                      onChange={(e) => setSelectedLang(e.target.value)}
                      className="w-full bg-slate-800 hover:bg-slate-750 text-white text-xs px-2.5 py-1.5 rounded-xl border border-slate-700 focus:outline-none focus:border-indigo-500 appearance-none font-medium"
                    >
                      {SUPPORTED_LANGUAGES.map((lang) => (
                        <option key={lang.code} value={lang.code}>
                          {lang.name} ({lang.native})
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
                  </div>
                </div>
              </div>
            </div>

            {/* NOTIFICATION SMART RIBBON */}
            {notifications.length > 0 && (
              <div className="bg-amber-950/40 border-b border-amber-900/30 px-4 py-2 flex items-center justify-between gap-2 text-amber-200 text-xs">
                <div className="flex items-center gap-2 truncate font-medium">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  <span className="truncate">{notifications[0]}</span>
                </div>
                {notifications.length > 1 && (
                  <span className="shrink-0 text-[10px] px-1.5 py-0.5 bg-amber-400/20 rounded font-semibold">
                    +{notifications.length - 1} more
                  </span>
                )}
              </div>
            )}

            {/* CONVERSATION SCROLL CONTAINER */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-900/90 scrollbar-thin scrollbar-thumb-slate-800">
              {messages.map((m) => {
                const isUser = m.role === 'user';
                return (
                  <div key={m.id} className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
                    <div
                      className={`max-w-[85%] rounded-2xl p-3.5 shadow-md ${
                        isUser
                          ? 'bg-gradient-to-br from-indigo-600 to-indigo-700 text-white rounded-tr-none'
                          : 'bg-slate-800 text-slate-100 border border-slate-750 rounded-tl-none'
                      }`}
                    >
                      {/* Markdown rendering simulation (simple bold/paragraph styling) */}
                      <div className="text-xs sm:text-sm leading-relaxed whitespace-pre-line prose prose-invert prose-xs">
                        {m.text}
                      </div>

                      {/* Render direct action executions inside bubbles */}
                      {m.actionExecuted && (
                        <div className="mt-2.5 p-2 bg-emerald-500/15 border border-emerald-500/25 rounded-xl flex items-center gap-2 text-emerald-300 text-[11px] font-medium font-sans">
                          <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
                          <span>Action Executed: {m.actionExecuted.description}</span>
                        </div>
                      )}

                      {/* Render Report Export Options */}
                      {m.isReport && (
                        <div className="mt-3 pt-3.5 border-t border-slate-700 flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={onDownloadExcel}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors focus:outline-none"
                          >
                            <Download className="w-3.5 h-3.5" />
                            Export Excel Report
                          </button>
                          <button
                            type="button"
                            onClick={() => window.print()}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-bold text-indigo-200 bg-slate-700 hover:bg-slate-650 rounded-lg transition-colors focus:outline-none"
                          >
                            Print PDF
                          </button>
                        </div>
                      )}

                      <div className="mt-2.5 pt-1.5 border-t border-slate-700/50 flex items-center justify-between gap-4">
                        <span className="text-[10px] text-slate-400/60 font-mono">
                          {m.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => copyToClipboard(m.text, m.id)}
                            className="p-1 text-slate-400 hover:text-white hover:bg-slate-700 rounded transition-colors focus:outline-none"
                            title="Copy message to clipboard"
                          >
                            {copiedMessageId === m.id ? (
                              <Check className="w-3.5 h-3.5 text-emerald-400" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                          </button>
                          {!isUser && m.id !== 'welcome' && (
                            <button
                              type="button"
                              onClick={() => handleRegenerate(m.id)}
                              className="p-1 text-slate-400 hover:text-white hover:bg-slate-700 rounded transition-colors focus:outline-none"
                              title="Regenerate this response"
                            >
                              <RotateCcw className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}

              {isLoading && (
                <div className="flex justify-start">
                  <div className="bg-slate-800 rounded-2xl rounded-tl-none p-3.5 border border-slate-750 flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin text-indigo-400" />
                    <span className="text-xs text-slate-400 font-medium">LedgerHub AI is computing...</span>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* QUICK SUGGESTIONS CAROUSEL */}
            <div className="px-4 py-2 bg-slate-900 border-t border-slate-800/60">
              <div className="flex items-center gap-1 mb-1.5">
                <Sparkles className="w-3.5 h-3.5 text-yellow-400" />
                <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">Suggested Actions</span>
              </div>
              <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none no-scrollbar">
                {SUGGESTED_COMMANDS.map((cmd, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => {
                      const text = cmd.command || cmd.label;
                      setInputText(text);
                      sendMessage(text);
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] bg-slate-800 hover:bg-indigo-600/15 hover:border-indigo-500/30 rounded-xl border border-slate-750 text-slate-300 font-medium whitespace-nowrap transition-all focus:outline-none"
                  >
                    {cmd.icon && <cmd.icon className="w-3.5 h-3.5 text-indigo-400 shrink-0" />}
                    {cmd.label}
                  </button>
                ))}
              </div>
            </div>

            {/* AUDIO & VOICE SYNTHESIS CONTROL SYSTEM BAR */}
            <div className="px-4 py-2 bg-slate-950 border-t border-slate-800/50 flex flex-col gap-2.5 text-slate-400 text-[11px]">
              <div className="flex flex-wrap items-center justify-between gap-3">
                {/* Auto Read Back Status */}
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setIsVoiceEnabled(!isVoiceEnabled);
                      if (isVoiceEnabled) stopSpeech();
                    }}
                    className={`p-1.5 rounded-lg transition-colors focus:outline-none ${
                      isVoiceEnabled ? 'text-indigo-400 bg-indigo-500/10' : 'text-slate-500 bg-slate-800/40'
                    }`}
                    title={isVoiceEnabled ? 'Voice responses enabled' : 'Voice responses muted'}
                  >
                    {isVoiceEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
                  </button>
                  <span className="font-medium text-slate-300 text-xs">TTS Voice</span>

                  {/* Hands-Free Dialog Mode Toggle */}
                  <button
                    type="button"
                    onClick={() => {
                      setIsContinuousMode(!isContinuousMode);
                    }}
                    className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold transition-all border ${
                      isContinuousMode 
                        ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' 
                        : 'bg-slate-900 text-slate-500 border-slate-800'
                    }`}
                    title="Enable continuous hands-free dialogue: Automatically listens after speaking"
                  >
                    <Mic className="w-3 h-3" />
                    <span>Hands-Free</span>
                  </button>
                </div>

                {/* TTS Voice Custom Controller */}
                {isVoiceEnabled && isPlayingSpeech && (
                  <div className="flex items-center gap-1.5 bg-slate-900 border border-slate-800 px-2 py-1 rounded-xl">
                    {isSpeechPaused ? (
                      <button
                        type="button"
                        onClick={resumeSpeech}
                        className="p-1 text-emerald-400 hover:text-white hover:bg-slate-800 rounded transition-colors focus:outline-none"
                        title="Resume synthesis"
                      >
                        <Play className="w-3 h-3 fill-emerald-400" />
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={pauseSpeech}
                        className="p-1 text-amber-400 hover:text-white hover:bg-slate-800 rounded transition-colors focus:outline-none"
                        title="Pause synthesis"
                      >
                        <Pause className="w-3 h-3 fill-amber-400" />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={stopSpeech}
                      className="p-1 text-rose-400 hover:text-white hover:bg-slate-800 rounded transition-colors focus:outline-none"
                      title="Stop synthesis"
                    >
                      <Square className="w-3 h-3 fill-rose-400" />
                    </button>

                    {/* Active sound bars animation */}
                    <div className="flex items-center gap-0.5 h-3 px-1">
                      <span className="w-[2px] bg-indigo-400 animate-pulse h-full" />
                      <span className="w-[2px] bg-indigo-400 animate-pulse h-2" />
                      <span className="w-[2px] bg-indigo-400 animate-pulse h-full" />
                    </div>
                  </div>
                )}

                {/* Voice Speed Modifier Slider */}
                {isVoiceEnabled && (
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-slate-500 uppercase font-semibold">Speed:</span>
                    <input
                      type="range"
                      min="0.5"
                      max="2.0"
                      step="0.1"
                      value={voiceRate}
                      onChange={(e) => setVoiceRate(parseFloat(e.target.value))}
                      className="w-16 accent-indigo-500 h-1 bg-slate-800 rounded-lg cursor-pointer"
                      title={`Speaking speed multiplier: ${voiceRate}x`}
                    />
                    <span className="font-mono text-[10px] text-indigo-400">{voiceRate}x</span>
                  </div>
                )}
              </div>

              {/* Voice Selection Dropdown */}
              {isVoiceEnabled && availableVoices.length > 0 && (
                <div className="flex items-center gap-2 border-t border-slate-900 pt-2">
                  <span className="text-[10px] text-slate-500 uppercase font-semibold shrink-0">Synthesizer Voice:</span>
                  <select
                    value={selectedVoiceName}
                    onChange={(e) => setSelectedVoiceName(e.target.value)}
                    className="flex-1 bg-slate-900 border border-slate-800 text-slate-300 rounded-lg text-[10px] px-2 py-1 focus:outline-none"
                  >
                    {availableVoices.map((v, i) => (
                      <option key={i} value={v.name}>
                        {v.name} ({v.lang})
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {/* INPUT CONTROLS ROW */}
            <div className="p-4 bg-slate-950 border-t border-slate-850 flex flex-col gap-2">
              <div className="flex items-center gap-2">
                {/* Voice Recognition Microphone Button */}
                <button
                  type="button"
                  onClick={isListening ? stopSpeechRecognition : startSpeechRecognition}
                  className={`p-3.5 rounded-2xl flex items-center justify-center shrink-0 cursor-pointer focus:outline-none transition-all ${
                    isListening
                      ? 'bg-rose-500 hover:bg-rose-600 text-white animate-pulse ring-4 ring-rose-500/20'
                      : 'bg-slate-800 hover:bg-slate-700 text-indigo-400 border border-slate-700'
                  }`}
                  title={isListening ? 'Listening... click to stop' : 'Start speaking commands'}
                >
                  {isListening ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
                </button>

                {/* Text Input Field */}
                <input
                  type="text"
                  placeholder={
                    isListening 
                      ? "Listening to voice input..." 
                      : `Ask AI ("Add 50 Sugar", "Show sales")...`
                  }
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  onKeyDown={handleKeyPress}
                  disabled={isLoading}
                  className="flex-1 min-w-0 bg-slate-900 border border-slate-750 text-slate-100 rounded-2xl px-4 py-3 text-sm focus:border-indigo-500 focus:outline-none placeholder:text-slate-500 font-medium"
                />

                {/* Send Button */}
                <button
                  type="button"
                  onClick={() => sendMessage()}
                  disabled={isLoading || !inputText.trim()}
                  className={`p-3.5 rounded-2xl flex items-center justify-center shrink-0 cursor-pointer transition-colors focus:outline-none ${
                    inputText.trim() && !isLoading
                      ? 'bg-indigo-600 hover:bg-indigo-700 text-white'
                      : 'bg-slate-850 text-slate-600 border border-slate-800'
                  }`}
                >
                  <Send className="w-5 h-5" />
                </button>
              </div>

              {/* Speech Error Flash Ribbon */}
              {speechError && (
                <div className="text-[11px] text-rose-400 font-medium text-center bg-rose-950/20 border border-rose-900/30 rounded-lg py-1 flex items-center justify-center gap-1.5 animate-fade-in">
                  <Info className="w-3.5 h-3.5 shrink-0" />
                  <span>{speechError}</span>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
