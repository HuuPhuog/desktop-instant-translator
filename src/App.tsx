/**
 * ============================================
 * 📁 src/App.tsx
 * ============================================
 *
 * MỤC ĐÍCH:
 * Settings & Control Center cho Desktop Instant Translator.
 * Trong kiến trúc tray-first, main window chỉ hiển thị khi
 * người dùng click tray icon hoặc chọn "Cài đặt" từ tray menu.
 *
 * UX REFACTOR:
 * - Không còn là dashboard chính
 * - Không render TranslationPopup (popup giờ là cửa sổ riêng)
 * - Compact settings layout
 * ============================================
 */

import { useState, useEffect } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { enable, disable } from "@tauri-apps/plugin-autostart";
import { HistoryPanel } from "./components/history/HistoryPanel";
import { useGlobalHotkey } from "./hooks/useGlobalHotkey";
import { useAppStore } from "./stores/appStore";

function App() {
  const [currentView, setCurrentView] = useState<"settings" | "history">("settings");
  
  const settings = useAppStore((state) => state.settings);
  const updateSettings = useAppStore((state) => state.updateSettings);

  useGlobalHotkey(); // Activate global hotkeys when settings are open or in background

  // Lắng nghe event điều hướng từ tray menu
  useEffect(() => {
    let unlisten: () => void;
    getCurrentWindow().listen("navigate-to", (event) => {
      const target = event.payload as string;
      if (target === "settings" || target === "history") {
        setCurrentView(target);
      }
    }).then(fn => unlisten = fn);
    return () => { if (unlisten) unlisten(); };
  }, []);

  // Xử lý tự khởi động cùng Windows
  const handleAutoStartChange = async (checked: boolean) => {
    try {
      if (checked) await enable();
      else await disable();
      updateSettings({ showOnStartup: checked });
    } catch (err) {
      console.error("Failed to toggle autostart", err);
    }
  };

  // Ẩn cửa sổ thay vì tắt app nếu minimizeToTray = true
  useEffect(() => {
    const unlisten = getCurrentWindow().onCloseRequested(async (event) => {
      if (settings.minimizeToTray) {
        event.preventDefault();
        await getCurrentWindow().hide();
      }
    });
    return () => { unlisten.then(fn => fn()); };
  }, [settings.minimizeToTray]);

  return (
    <main
      className="flex flex-col h-screen"
      style={{
        backgroundColor: "var(--color-bg-primary)",
        color: "var(--color-text-primary)",
        fontFamily: "var(--font-primary)",
      }}
    >
      {/* HEADER */}
      <div className="flex items-center justify-between p-4 pb-3 border-b border-white/5 shrink-0">
        <h1 className="text-sm font-bold flex items-center gap-2">
          <span className="text-base">{currentView === "settings" ? "⚙️" : "🕒"}</span>
          {currentView === "settings" ? "Cài đặt" : "Lịch sử"}
        </h1>

        <button
          onClick={() => setCurrentView((v) => (v === "settings" ? "history" : "settings"))}
          className="text-[11px] font-semibold px-2.5 py-1 rounded-md transition-all active:scale-95 cursor-pointer flex items-center gap-1.5"
          style={{
            backgroundColor: "rgba(255, 255, 255, 0.04)",
            border: "1px solid var(--color-border)",
            color: "var(--color-text-secondary)",
          }}
        >
          {currentView === "settings" ? "Lịch sử →" : "← Cài đặt"}
        </button>
      </div>

      {/* CONTENT */}
      <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
        {currentView === "history" ? (
          <HistoryPanel />
        ) : (
          <div className="space-y-4">
            
            {/* Phím tắt */}
            <div className="space-y-2">
              <h2 className="text-[10px] font-bold uppercase tracking-wider text-[#646478]">Phím tắt</h2>
              <div className="bg-[#12121a] rounded-lg border border-white/5 p-3 space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-xs text-[#a2a2b4]">Dịch vùng bôi đen</span>
                  <kbd className="text-[10px] px-1.5 py-0.5 font-mono bg-[#1a1a24] rounded-md border border-white/10 text-[#f1f1f6]">{settings.hotkeyTranslate}</kbd>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs text-[#a2a2b4]">Chụp ảnh màn hình OCR</span>
                  <kbd className="text-[10px] px-1.5 py-0.5 font-mono bg-[#1a1a24] rounded-md border border-white/10 text-[#f1f1f6]">{settings.hotkeyOCR}</kbd>
                </div>
              </div>
            </div>

            {/* Dịch thuật */}
            <div className="space-y-2">
              <h2 className="text-[10px] font-bold uppercase tracking-wider text-[#646478]">Dịch thuật</h2>
              <div className="bg-[#12121a] rounded-lg border border-white/5 p-3 space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-xs text-[#a2a2b4]">Ngôn ngữ đích</span>
                  <select 
                    value={settings.targetLanguage}
                    onChange={(e) => updateSettings({ targetLanguage: e.target.value })}
                    className="text-xs bg-[#1a1a24] text-[#f1f1f6] border border-white/10 rounded-md px-2 py-1 outline-none"
                  >
                    <option value="vi">Tiếng Việt</option>
                    <option value="en">English</option>
                    <option value="ja">日本語</option>
                    <option value="ko">한국어</option>
                    <option value="zh">中文</option>
                  </select>
                </div>
                
                <div className="flex justify-between items-center">
                  <span className="text-xs text-[#a2a2b4]">Tự động ẩn Tooltip (giây)</span>
                  <select 
                    value={settings.autoHideDelay}
                    onChange={(e) => updateSettings({ autoHideDelay: Number(e.target.value) })}
                    className="text-xs bg-[#1a1a24] text-[#f1f1f6] border border-white/10 rounded-md px-2 py-1 outline-none"
                  >
                    <option value={3000}>3 giây</option>
                    <option value={5000}>5 giây</option>
                    <option value={6000}>6 giây</option>
                    <option value={8000}>8 giây</option>
                  </select>
                </div>
              </div>
            </div>

            {/* AI Assistant */}
            <div className="space-y-2">
              <h2 className="text-[10px] font-bold uppercase tracking-wider text-[#646478]">AI Assistant</h2>
              <div className="bg-[#12121a] rounded-lg border border-white/5 p-3 space-y-3">
                <label className="flex items-center justify-between cursor-pointer">
                  <span className="text-xs text-[#a2a2b4]">Tự động giải thích khi tra 1 từ đơn</span>
                  <input 
                    type="checkbox" 
                    checked={settings.autoExpandAIForWords}
                    onChange={(e) => updateSettings({ autoExpandAIForWords: e.target.checked })}
                    className="accent-[#6366f1] w-3.5 h-3.5"
                  />
                </label>
              </div>
            </div>

            {/* Hệ thống */}
            <div className="space-y-2">
              <h2 className="text-[10px] font-bold uppercase tracking-wider text-[#646478]">Hệ thống</h2>
              <div className="bg-[#12121a] rounded-lg border border-white/5 p-3 space-y-3">
                <label className="flex items-center justify-between cursor-pointer">
                  <span className="text-xs text-[#a2a2b4]">Khởi động cùng Windows</span>
                  <input 
                    type="checkbox" 
                    checked={settings.showOnStartup}
                    onChange={(e) => handleAutoStartChange(e.target.checked)}
                    className="accent-[#6366f1] w-3.5 h-3.5"
                  />
                </label>
                
                <label className="flex items-center justify-between cursor-pointer">
                  <span className="text-xs text-[#a2a2b4]">Chạy ngầm ở System Tray khi đóng</span>
                  <input 
                    type="checkbox" 
                    checked={settings.minimizeToTray}
                    onChange={(e) => updateSettings({ minimizeToTray: e.target.checked })}
                    className="accent-[#6366f1] w-3.5 h-3.5"
                  />
                </label>
              </div>
            </div>
            
          </div>
        )}
      </div>
    </main>
  );
}

export default App;
