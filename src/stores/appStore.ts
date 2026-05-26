/**
 * ============================================
 * 📁 src/stores/appStore.ts
 * ============================================
 *
 * MỤC ĐÍCH:
 * Zustand store quản lý state cấp ứng dụng (app-level).
 * Khác với translationStore (chỉ cho dịch thuật),
 * store này quản lý những thứ "toàn cục":
 * - Theme (dark/light)
 * - Settings (cài đặt)
 * - Overlay visibility (OCR overlay)
 *
 * TẠI SAO TÁCH 2 STORE?
 * - Separation of Concerns: mỗi store lo 1 việc
 * - translationStore: data dịch thuật
 * - appStore: cấu hình + trạng thái chung
 * - Dễ debug, dễ maintain
 * ============================================
 */

import { create } from "zustand";
import type { Theme, AppSettings } from "../types";

/**
 * Cài đặt mặc định của ứng dụng
 *
 * Theo các doc:
 * - theme: dark (UI_GUIDELINES: "default dark mode")
 * - targetLanguage: vi (ứng dụng cho người Việt học tiếng Anh)
 * - hotkeyTranslate: Ctrl+Q (PROJECT_SPEC)
 * - hotkeyOCR: Ctrl+Shift+Q (PROJECT_SPEC)
 * - autoHideDelay: 5000ms (5 giây rồi tự ẩn popup)
 */
import { persist } from "zustand/middleware";

const DEFAULT_SETTINGS: AppSettings = {
  theme: "dark",
  targetLanguage: "vi",
  showPronunciation: false,
  autoHideDelay: 6000,
  hotkeyTranslate: "Ctrl+Q",
  hotkeyOCR: "Ctrl+Shift+Q",
  showOnStartup: false,
  minimizeToTray: true,
  autoExpandAIForWords: true, // Mặc định bật
};

interface AppState {
  theme: Theme;
  settings: AppSettings;
  isOverlayVisible: boolean;
  isReady: boolean;

  setTheme: (theme: Theme) => void;
  updateSettings: (settings: Partial<AppSettings>) => void;
  setOverlayVisible: (visible: boolean) => void;
  setReady: () => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      theme: "dark",
      settings: DEFAULT_SETTINGS,
      isOverlayVisible: false,
      isReady: false,

      setTheme: (theme) => set({ theme }),

      updateSettings: (settings) =>
        set((state) => ({
          settings: { ...state.settings, ...settings },
        })),

      setOverlayVisible: (visible) => set({ isOverlayVisible: visible }),

      setReady: () => set({ isReady: true }),
    }),
    {
      name: "app-settings-storage",
      partialize: (state) => ({ settings: state.settings, theme: state.theme }), // Only persist settings & theme
    }
  )
);
