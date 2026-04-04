/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useRef } from 'react';
import { GoogleGenAI, ThinkingLevel } from "@google/genai";
import { Search, Smartphone, ShieldCheck, History, ExternalLink, Loader2, Info, AlertCircle, Moon, Sun, Phone, Mail, MapPin, MessageSquare, Zap, SmartphoneNfc, Trash2, X, Share2, Check, Copy } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import ReactMarkdown from 'react-markdown';

// Initialize Gemini API
const getAI = () => {
  const key = process.env.GEMINI_API_KEY || '';
  return new GoogleGenAI({ apiKey: key });
};

type SearchType = 'screen' | 'case';

interface SearchResult {
  text: string;
  sources: { uri: string; title: string }[];
  model: string;
  type: SearchType;
}

interface HistoryItem {
  model: string;
  type: SearchType;
}

export default function App() {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<SearchResult | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [searchType, setSearchType] = useState<SearchType>('screen');
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  const searchCache = useRef<Record<string, SearchResult>>({});

  useEffect(() => {
    // Load history
    const savedHistory = localStorage.getItem('searchHistory');
    if (savedHistory) {
      try {
        const parsed = JSON.parse(savedHistory);
        // Migration for old string-only history
        const migrated = parsed.map((item: any) => 
          typeof item === 'string' ? { model: item, type: 'screen' } : item
        );
        setHistory(migrated);
      } catch (e) {
        console.error("Failed to parse history", e);
      }
    }

    // Load cache
    const savedCache = localStorage.getItem('searchCache_v6');
    if (savedCache) {
      try {
        searchCache.current = JSON.parse(savedCache);
      } catch (e) {
        console.error("Failed to load cache", e);
      }
    }

    // Load dark mode preference
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'dark') {
      setIsDarkMode(true);
      document.documentElement.classList.add('dark');
    }
  }, []);

  const toggleDarkMode = () => {
    const newMode = !isDarkMode;
    setIsDarkMode(newMode);
    if (newMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  };

  const saveToHistory = (model: string, type: SearchType) => {
    const newItem = { model, type };
    const newHistory = [newItem, ...history.filter(h => h.model !== model || h.type !== type)].slice(0, 8);
    setHistory(newHistory);
    localStorage.setItem('searchHistory', JSON.stringify(newHistory));
  };

  const clearHistory = () => {
    setHistory([]);
    localStorage.removeItem('searchHistory');
    setShowClearConfirm(false);
  };

  const handleShare = async () => {
    if (!result) return;
    
    const shareText = `UZEE TECH Compatibility Report for ${result.model} (${result.type === 'screen' ? 'Screen Protector' : 'Back Case'}):\n\n${result.text}\n\nSearch more at: ${window.location.href}`;
    
    if (navigator.share) {
      try {
        await navigator.share({
          title: `UZEE TECH - ${result.model} Compatibility`,
          text: shareText,
          url: window.location.href,
        });
      } catch (err) {
        console.log('Error sharing:', err);
      }
    } else {
      // Fallback: Copy to clipboard
      try {
        await navigator.clipboard.writeText(shareText);
        setIsCopied(true);
        setTimeout(() => setIsCopied(false), 2000);
      } catch (err) {
        console.error('Failed to copy:', err);
      }
    }
  };

  const handleWhatsAppShare = () => {
    if (!result) return;
    const shareText = encodeURIComponent(`UZEE TECH Compatibility Report for ${result.model} (${result.type === 'screen' ? 'Screen Protector' : 'Back Case'}):\n\n${result.text}\n\nSearch more at: ${window.location.href}`);
    window.open(`https://wa.me/?text=${shareText}`, '_blank');
  };

  const handleSearch = async (searchModel: string = query, type: SearchType = searchType) => {
    const normalizedQuery = `${type}:${searchModel.trim().toLowerCase()}`;
    if (!searchModel.trim()) return;
    
    // Check Cache First
    if (searchCache.current[normalizedQuery]) {
      setResult(searchCache.current[normalizedQuery]);
      saveToHistory(searchModel, type);
      return;
    }

    setLoading(true);
    setError(null);
    setResult({ text: '', sources: [], model: searchModel, type: type });

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey || apiKey === '' || apiKey === 'undefined' || apiKey === 'null') {
      setError("API Key is missing. Please add a secret named 'UZEE' to your GitHub repository and update your deploy.yml file.");
      setLoading(false);
      return;
    }

    const aiInstance = getAI();
    try {
      const itemType = type === 'screen' ? 'screen protector' : 'back case / cover';
      const responseStream = await aiInstance.models.generateContentStream({
        model: "gemini-flash-latest",
        contents: `Mobile: "${searchModel}". 
        Find compatible ${itemType} matches. 
        
        CRITICAL: 
        1. Cross-reference multiple data points: screen size (diagonal), aspect ratio, physical dimensions (height/width/thickness), and cutout positions (camera, sensors, buttons, ports).
        2. Check ALL brands (Samsung, Xiaomi, Redmi, Poco, Realme, Vivo, Oppo, Apple, etc.).
        3. "100% Matching" means identical physical dimensions and cutout patterns.
        4. "Slightly Matching" means same screen size/body size but minor differences (e.g., slightly different camera bump or sensor placement).
        
        Format:
        ### 100% Matching Models
        
        - **[Model Name]**
          [Specific reason why it matches perfectly, e.g., "Identical 6.67\" panel and sensor layout"]
        
        - **[Model Name]**
          [Specific reason why it matches perfectly]
        
        ### Slightly Matching Models
        
        - **[Model Name]**
          [Specific reason for slight mismatch, e.g., "Same screen size but camera cutout is 2mm lower"]
        
        - **[Model Name]**
          [Specific reason for slight mismatch]
        
        IMPORTANT: 
        1. BOLD the model names.
        2. Put details on a NEW line below the model name.
        3. Use DOUBLE line breaks between items for maximum spacing.
        4. ONLY lists. NO intro/outro.`,
        config: {
          tools: [{ googleSearch: {} }],
        },
      });

      let fullText = '';
      let sources: { uri: string; title: string }[] = [];

      for await (const chunk of responseStream) {
        const textChunk = chunk.text || '';
        fullText += textChunk;
        
        const chunkSources = chunk.candidates?.[0]?.groundingMetadata?.groundingChunks
          ?.filter(c => c.web)
          ?.map(c => ({
            uri: c.web!.uri,
            title: c.web!.title || c.web!.uri
          })) || [];
        
        if (chunkSources.length > 0) {
          sources = Array.from(new Map([...sources, ...chunkSources].map(s => [s.uri, s])).values());
        }

        setResult(prev => prev ? { ...prev, text: fullText, sources } : { text: fullText, sources, model: searchModel, type: type });
      }

      // Save to Cache
      const finalResult = { text: fullText, sources, model: searchModel, type: type };
      searchCache.current[normalizedQuery] = finalResult;
      localStorage.setItem('searchCache_v6', JSON.stringify(searchCache.current));
      
      saveToHistory(searchModel, type);
    } catch (err: any) {
      console.error("Search error:", err);
      let errorMessage = "Failed to fetch compatibility data. Please try again.";
      
      // Handle Rate Limit (429) specifically
      if (err?.message?.includes('429') || err?.message?.includes('RESOURCE_EXHAUSTED')) {
        errorMessage = "Search limit reached. Please wait 1 minute and try again.";
      } else if (err?.message) {
        errorMessage = `Error: ${err.message}`;
      } else if (typeof err === 'string') {
        errorMessage = `Error: ${err}`;
      } else {
        try {
          errorMessage = `Error: ${JSON.stringify(err)}`;
        } catch (e) {
          errorMessage = "An unknown error occurred during search.";
        }
      }
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={`min-h-screen transition-colors duration-300 ${isDarkMode ? 'bg-black text-slate-100' : 'bg-slate-50 text-slate-900'} font-sans`}>
      {/* Header */}
      <header className={`sticky top-0 z-[1000] h-auto py-2.5 border-b transition-colors duration-300 ${
        isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
      }`}>
        <div className="relative h-full px-[5%] flex items-center justify-center">
          {/* Centered Logo Container */}
          <div className="flex flex-col items-center justify-center">
            <img 
              src="https://i.ibb.co/G4L7yTx8/Board-logo.png" 
              alt="UZEE TECH" 
              className="h-[100px] w-auto object-contain block"
              onError={(e) => {
                e.currentTarget.src = "https://img.icons8.com/fluency/48/shield.png";
              }}
            />
            <span className="text-[8px] text-slate-400 -mt-2">v2.0</span>
          </div>
          
          {/* Moon Toggle - Positioned absolute to not affect centering */}
          <div className="absolute right-[5%] flex items-center">
            <button
              onClick={toggleDarkMode}
              className={`cursor-pointer p-2 rounded-lg border flex items-center transition-all duration-300 ${
                isDarkMode 
                  ? 'bg-slate-800 border-slate-700 text-yellow-400 hover:bg-slate-700' 
                  : 'bg-[#f8f9fa] border-[#ddd] text-slate-600 hover:bg-slate-100'
              }`}
              title={isDarkMode ? "Switch to Light Mode" : "Switch to Dark Mode"}
            >
              {isDarkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 mt-[10px] pb-16">
        {/* Hero Section */}
        <div className="text-center mb-12">
          <h2 className={`text-4xl md:text-5xl font-black mb-4 tracking-tight ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
            Compatibility <span className="text-red-600">Check</span>
          </h2>
          <p className={`text-lg ${isDarkMode ? 'text-slate-400' : 'text-slate-600'} max-w-2xl mx-auto`}>
            Find 100% exact matches and compatible alternatives for your phone model.
          </p>
        </div>

        {/* Search Bar */}
        <div className="relative max-w-2xl mx-auto mb-10">
          {/* Type Selector */}
          <div className="flex items-center justify-center gap-3 mb-6">
            <button
              onClick={() => {
                setSearchType('screen');
                if (query.trim()) handleSearch(query, 'screen');
              }}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold transition-all duration-300 ${
                searchType === 'screen'
                  ? 'bg-red-600 text-white shadow-lg shadow-red-600/20'
                  : isDarkMode ? 'bg-slate-900 text-slate-400 border border-slate-800 hover:bg-slate-800' : 'bg-white text-slate-500 border border-slate-200 hover:bg-slate-50'
              }`}
            >
              <ShieldCheck className="w-4 h-4" />
              <span>Screen Protector</span>
            </button>
            <button
              onClick={() => {
                setSearchType('case');
                if (query.trim()) handleSearch(query, 'case');
              }}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold transition-all duration-300 ${
                searchType === 'case'
                  ? 'bg-red-600 text-white shadow-lg shadow-red-600/20'
                  : isDarkMode ? 'bg-slate-900 text-slate-400 border border-slate-800 hover:bg-slate-800' : 'bg-white text-slate-500 border border-slate-200 hover:bg-slate-50'
              }`}
            >
              <SmartphoneNfc className="w-4 h-4" />
              <span>Back Case</span>
            </button>
          </div>

          <div className="relative group">
            <div className="absolute inset-y-0 left-0 pl-5 flex items-center pointer-events-none">
              <Search className={`h-6 w-6 transition-colors ${isDarkMode ? 'text-slate-600 group-focus-within:text-red-500' : 'text-slate-400 group-focus-within:text-red-600'}`} />
            </div>
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              placeholder="Enter phone model (e.g., iPhone 15 Pro)"
              className={`block w-full pl-14 pr-36 py-5 border rounded-2xl shadow-lg outline-none transition-all text-xl font-medium ${
                isDarkMode 
                  ? 'bg-slate-900 border-slate-800 text-white focus:ring-4 focus:ring-red-900/20 focus:border-red-600' 
                  : 'bg-white border-slate-200 text-slate-900 focus:ring-4 focus:ring-red-100 focus:border-red-600'
              }`}
            />
            <button
              onClick={() => handleSearch()}
              disabled={loading || !query.trim()}
              className="absolute right-2.5 inset-y-2.5 px-8 bg-red-600 text-white font-bold rounded-xl hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2 shadow-lg shadow-red-600/30 active:scale-95"
            >
              {loading ? (
                <Loader2 className="w-6 h-6 animate-spin" />
              ) : (
                <>
                  <Zap className="w-4 h-4 fill-current" />
                  <span>SEARCH</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Recent Searches */}
        {history.length > 0 && !result && !loading && (
          <div className="max-w-2xl mx-auto mb-12">
            <div className="flex items-center justify-between mb-4 px-1">
              <div className="flex items-center gap-2 text-slate-500">
                <History className="w-4 h-4" />
                <span className="text-sm font-bold uppercase tracking-widest">Recent Searches</span>
              </div>
              <button
                onClick={() => setShowClearConfirm(true)}
                className={`flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-lg transition-all ${
                  isDarkMode 
                    ? 'text-slate-500 hover:text-red-500 hover:bg-red-500/10' 
                    : 'text-slate-400 hover:text-red-600 hover:bg-red-50'
                }`}
              >
                <Trash2 className="w-3 h-3" />
                Clear All
              </button>
            </div>
            <div className="flex flex-wrap gap-3">
              {history.map((item, idx) => (
                <button
                  key={`${item.model}-${item.type}-${idx}`}
                  onClick={() => {
                    setQuery(item.model);
                    setSearchType(item.type);
                    handleSearch(item.model, item.type);
                  }}
                  className={`px-5 py-2.5 border rounded-xl text-sm font-bold transition-all shadow-sm flex items-center gap-2 ${
                    isDarkMode 
                      ? 'bg-slate-900 border-slate-800 text-slate-400 hover:border-red-600 hover:text-red-500' 
                      : 'bg-white border-slate-200 text-slate-600 hover:border-red-300 hover:text-red-600'
                  }`}
                >
                  {item.type === 'screen' ? <ShieldCheck className="w-3 h-3" /> : <SmartphoneNfc className="w-3 h-3" />}
                  <span>{item.model}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Loading State */}
        {loading && (
          <div className="flex flex-col items-center justify-center py-24 animate-pulse">
            <div className="relative">
              <Smartphone className={`w-20 h-20 ${isDarkMode ? 'text-slate-800' : 'text-slate-200'}`} />
              <div className="absolute inset-0 flex items-center justify-center">
                <Loader2 className="w-10 h-10 text-red-600 animate-spin" />
              </div>
            </div>
            <p className={`mt-6 text-lg font-bold tracking-tight ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>ANALYZING DATABASES...</p>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className={`max-w-2xl mx-auto border-l-4 p-5 rounded-xl flex items-start gap-4 shadow-md ${
            isDarkMode ? 'bg-red-950/20 border-red-600 text-red-400' : 'bg-red-50 border-red-600 text-red-700'
          }`}>
            <AlertCircle className="w-6 h-6 mt-0.5 flex-shrink-0" />
            <p className="text-base font-bold">{error}</p>
          </div>
        )}

        {/* Results */}
        <AnimatePresence mode="wait">
          {result && !loading && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="max-w-3xl mx-auto"
            >
              <div className={`border rounded-[2rem] overflow-hidden shadow-2xl ${
                isDarkMode ? 'bg-slate-900 border-slate-800 shadow-black/80' : 'bg-white border-slate-200 shadow-slate-300/50'
              }`}>
                <div className="bg-red-600 px-8 py-5 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <Smartphone className="text-white w-7 h-7" />
                    <div className="flex flex-col">
                      <h3 className="text-white font-black text-xl tracking-tight uppercase leading-none">{result.model}</h3>
                      <span className="text-white/60 text-[10px] font-black uppercase tracking-widest mt-1">
                        {result.type === 'screen' ? 'Screen Protector' : 'Back Case'} Compatibility
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleWhatsAppShare}
                      className="bg-[#25D366]/20 hover:bg-[#25D366]/30 text-white p-2.5 rounded-xl transition-all flex items-center gap-2 group"
                      title="Share via WhatsApp"
                    >
                      <MessageSquare className="w-5 h-5 fill-current" />
                      <span className="text-[10px] font-black uppercase tracking-widest hidden sm:block">
                        WHATSAPP
                      </span>
                    </button>
                    <button
                      onClick={handleShare}
                      className="bg-black/20 hover:bg-black/30 text-white p-2.5 rounded-xl transition-all flex items-center gap-2 group"
                      title="Share Result"
                    >
                      {isCopied ? <Check className="w-5 h-5" /> : <Share2 className="w-5 h-5" />}
                      <span className="text-[10px] font-black uppercase tracking-widest hidden sm:block">
                        {isCopied ? 'COPIED' : 'SHARE'}
                      </span>
                    </button>
                    <span className="bg-black/20 text-white text-[10px] font-black px-3 py-1.5 rounded-full uppercase tracking-[0.2em] hidden sm:block">
                      MATCH REPORT
                    </span>
                  </div>
                </div>
                
                <div className="p-8 md:p-10">
                  <div className={`prose max-w-none 
                    ${isDarkMode ? 'prose-invert prose-headings:text-red-500 prose-p:text-slate-400 prose-li:text-slate-400' : 'prose-slate prose-headings:text-red-600 prose-p:text-slate-600 prose-li:text-slate-600'}
                    prose-headings:font-black prose-headings:text-xl prose-headings:mb-10 prose-headings:mt-24 first:prose-headings:mt-0 prose-headings:uppercase prose-headings:tracking-tight
                    prose-h3:bg-red-600/5 prose-h3:border-l-4 prose-h3:border-red-600 prose-h3:pl-6 prose-h3:py-5 prose-h3:rounded-r-2xl prose-h3:shadow-sm
                    prose-ul:list-none prose-ul:pl-0 prose-li:mb-10 prose-li:font-medium prose-li:flex prose-li:items-start prose-li:leading-relaxed prose-li:before:content-[''] prose-li:before:w-2.5 prose-li:before:h-2.5 prose-li:before:bg-red-600 prose-li:before:rounded-full prose-li:before:mr-5 prose-li:before:mt-2.5`}>
                    <ReactMarkdown
                      components={{
                        h3: ({ node, ...props }) => (
                          <h3 {...props} className="mt-24 mb-10 first:mt-0 font-black text-xl uppercase tracking-tight bg-red-600/5 border-l-4 border-red-600 pl-6 py-5 rounded-r-2xl shadow-sm" />
                        )
                      }}
                    >
                      {result.text}
                    </ReactMarkdown>
                  </div>

                  {result.sources.length > 0 && (
                    <div className={`mt-10 pt-10 border-t ${isDarkMode ? 'border-slate-800' : 'border-slate-100'}`}>
                      <h4 className={`text-xs font-black uppercase tracking-[0.3em] mb-6 flex items-center gap-2 ${isDarkMode ? 'text-slate-600' : 'text-slate-400'}`}>
                        <Info className="w-4 h-4" />
                        VERIFIED SOURCES
                      </h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {result.sources.map((source, idx) => (
                          <a
                            key={idx}
                            href={source.uri}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={`flex items-center gap-3 p-4 border rounded-2xl transition-all group ${
                              isDarkMode 
                                ? 'bg-black border-slate-800 hover:bg-slate-800 hover:border-red-600' 
                                : 'bg-slate-50 border-slate-100 hover:bg-red-50 hover:border-red-200'
                            }`}
                          >
                            <div className={`p-2 rounded-xl border transition-colors ${
                              isDarkMode ? 'bg-slate-900 border-slate-800 group-hover:border-red-600' : 'bg-white border-slate-200 group-hover:border-red-200'
                            }`}>
                              <ExternalLink className={`w-4 h-4 ${isDarkMode ? 'text-slate-600 group-hover:text-red-500' : 'text-slate-400 group-hover:text-red-600'}`} />
                            </div>
                            <span className={`text-sm font-bold truncate ${isDarkMode ? 'text-slate-400 group-hover:text-red-400' : 'text-slate-600 group-hover:text-red-700'}`}>
                              {source.title}
                            </span>
                          </a>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="mt-10 text-center">
                <button
                  onClick={() => {
                    setResult(null);
                    setQuery('');
                  }}
                  className={`text-xs font-black uppercase tracking-widest transition-colors ${isDarkMode ? 'text-slate-700 hover:text-slate-400' : 'text-slate-400 hover:text-slate-600'}`}
                >
                  RESET SEARCH
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Footer */}
      <footer className={`mt-24 border-t py-8 transition-colors duration-300 ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
        <div className="max-w-6xl mx-auto px-6">
          {/* Company Info - Professional Horizontal Layout */}
          <div className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 mb-10 ${isDarkMode ? 'text-slate-300' : 'text-slate-600'}`}>
            <div className="flex flex-col items-center text-center group">
              <div className={`p-3 rounded-2xl mb-3 transition-transform group-hover:scale-110 ${isDarkMode ? 'bg-slate-800 text-red-400' : 'bg-red-50 text-red-600'}`}>
                <Phone className="w-5 h-5" />
              </div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">Contact</p>
              <a href="tel:+94704965706" className="text-sm font-semibold hover:text-red-500 transition-colors">+94 70 496 5706</a>
            </div>

            <div className="flex flex-col items-center text-center group">
              <div className={`p-3 rounded-2xl mb-3 transition-transform group-hover:scale-110 ${isDarkMode ? 'bg-slate-800 text-green-400' : 'bg-green-50 text-green-600'}`}>
                <MessageSquare className="w-5 h-5" />
              </div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">WhatsApp</p>
              <a href="https://wa.me/94761197224" target="_blank" rel="noopener noreferrer" className="text-sm font-semibold hover:text-green-500 transition-colors">+94 76 119 7224</a>
            </div>

            <div className="flex flex-col items-center text-center group">
              <div className={`p-3 rounded-2xl mb-3 transition-transform group-hover:scale-110 ${isDarkMode ? 'bg-slate-800 text-blue-400' : 'bg-blue-50 text-blue-600'}`}>
                <Mail className="w-5 h-5" />
              </div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">Email</p>
              <a href="mailto:uzeetechcare@gmail.com" className="text-sm font-semibold hover:text-blue-500 transition-colors">uzeetechcare@gmail.com</a>
            </div>

            <div className="flex flex-col items-center text-center group">
              <div className={`p-3 rounded-2xl mb-3 transition-transform group-hover:scale-110 ${isDarkMode ? 'bg-slate-800 text-orange-400' : 'bg-orange-50 text-orange-600'}`}>
                <MapPin className="w-5 h-5" />
              </div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">Address</p>
              <p className="text-sm font-semibold leading-tight">149, Mirigama Rd, Deen Junction, Negombo</p>
            </div>
          </div>

          <div className="pt-8 border-t border-slate-100 dark:border-slate-800 flex flex-col md:flex-row items-center justify-between gap-4">
            <p className={`text-xs font-medium ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>
              © {new Date().getFullYear()} UZEE TECH (PVT) Ltd. All rights reserved.
            </p>
          </div>
        </div>
      </footer>

      {/* Confirmation Modal */}
      <AnimatePresence>
        {showClearConfirm && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowClearConfirm(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className={`relative w-full max-w-sm rounded-3xl shadow-2xl overflow-hidden border ${
                isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'
              }`}
            >
              <div className="p-8 text-center">
                <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-6">
                  <Trash2 className="w-8 h-8 text-red-600" />
                </div>
                <h3 className={`text-xl font-black mb-2 uppercase tracking-tight ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
                  Clear History?
                </h3>
                <p className={`text-sm mb-8 leading-relaxed ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                  This will permanently delete all your recent searches. This action cannot be undone.
                </p>
                <div className="flex flex-col gap-3">
                  <button
                    onClick={clearHistory}
                    className="w-full py-4 bg-red-600 text-white font-black uppercase tracking-widest rounded-2xl hover:bg-red-700 transition-all shadow-lg shadow-red-600/30 active:scale-95"
                  >
                    Yes, Clear All
                  </button>
                  <button
                    onClick={() => setShowClearConfirm(false)}
                    className={`w-full py-4 font-black uppercase tracking-widest rounded-2xl transition-all ${
                      isDarkMode 
                        ? 'bg-slate-800 text-slate-300 hover:bg-slate-700' 
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    Cancel
                  </button>
                </div>
              </div>
              <button 
                onClick={() => setShowClearConfirm(false)}
                className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
