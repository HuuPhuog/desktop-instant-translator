/**
 * ============================================
 * 📁 src/main.tsx
 * ============================================
 *
 * MỤC ĐÍCH:
 * Entry point (điểm khởi đầu) của React application.
 *
 * CÁC BƯỚC KHI APP CHẠY:
 * 1. Tauri khởi động → mở WebView window (ví dụ: main hoặc overlay)
 * 2. WebView load index.html
 * 3. index.html load main.tsx (file này)
 * 4. main.tsx nhận diện window label và điều hướng render component phù hợp
 *
 * IMPORT QUAN TRỌNG:
 * - styles/index.css: phải import TRƯỚC các component
 *   để TailwindCSS và CSS variables có sẵn
 * ============================================
 */

import React from "react";
import ReactDOM from "react-dom/client";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { invoke } from "@tauri-apps/api/core";

// Register global error listeners to write errors to ocr_debug_log.txt
if (typeof window !== "undefined") {
  window.onerror = function (message, source, lineno, colno, error) {
    const logMsg = `[Global Error] ${message} at ${source}:${lineno}:${colno} - Error: ${error?.stack || error}`;
    console.error(logMsg);
    invoke("write_debug_log", { message: `[${new Date().toISOString()}] ${logMsg}` }).catch(() => {});
  };

  window.onunhandledrejection = function (event) {
    const logMsg = `[Unhandled Rejection] Reason: ${event.reason?.stack || event.reason}`;
    console.error(logMsg);
    invoke("write_debug_log", { message: `[${new Date().toISOString()}] ${logMsg}` }).catch(() => {});
  };
}

// Import global styles TRƯỚC component
import "./styles/index.css";

import App from "./App";
import ScreenOverlay from "./components/overlay/ScreenOverlay";
import { TooltipPopup } from "./components/tooltip/TooltipPopup";
import { useTranslationStore } from "./stores/translationStore";
import { useAIStore } from "./stores/aiStore";
import { useHistoryStore } from "./stores/historyStore";
import { translateText } from "./services/translation";

// Lấy window label hiện tại để điều hướng render (Multi-window routing)
let windowLabel = "main";
try {
  const currentWindow = getCurrentWindow();
  windowLabel = currentWindow.label;
} catch (e) {
  console.warn("[main.tsx] Not running inside Tauri context, defaulting window label to 'main'.");
}

// Expose stores & helpers lên window để dễ dàng kiểm thử trên browser
if (typeof window !== "undefined") {
  (window as any).useTranslationStore = useTranslationStore;
  (window as any).useAIStore = useAIStore;
  (window as any).useHistoryStore = useHistoryStore;
  (window as any).translateText = translateText;
}

console.log(`[main.tsx] App mounted. Current window label: "${windowLabel}"`);

// Điều hướng render dựa trên window label
const renderRoot = () => {
  if (windowLabel === "overlay") {
    if (typeof document !== "undefined") {
      document.body.style.backgroundColor = "transparent";
    }
    return <ScreenOverlay />;
  }
  if (windowLabel === "tooltip") {
    if (typeof document !== "undefined") {
      document.body.style.backgroundColor = "transparent";
      document.documentElement.style.backgroundColor = "transparent";
    }
    return <TooltipPopup />;
  }
  return <App />;
};

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    {renderRoot()}
  </React.StrictMode>
);

// Chỉ tự động kích hoạt mô phỏng dịch test trên trình duyệt Web (khi chạy test ngoài Tauri)
if (windowLabel === "main" && typeof window !== "undefined" && !(window as any).__TAURI_INTERNALS__) {
  setTimeout(() => {
    translateText("You are encouraged to answer as many questions as possible within the time allowed.", "vi").then(res => {
      useTranslationStore.getState().setResult(res);
      useTranslationStore.getState().showPopup({ x: 12, y: 12 });
      
      // Đồng thời lưu vào Lịch sử dịch thuật
      useHistoryStore.getState().addHistoryItem(
        res.originalText,
        res.translatedText,
        "ocr",
        res.sourceLanguage,
        res.targetLanguage
      );
    });
  }, 1000);
}

