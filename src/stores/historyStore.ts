/**
 * ============================================
 * 📁 src/stores/historyStore.ts
 * ============================================
 *
 * MỤC ĐÍCH:
 * Zustand store quản lý lịch sử dịch thuật và tự động đồng bộ (persist)
 * dữ liệu xuống localStorage.
 *
 * THIẾT KẾ:
 * - Module tách biệt khỏi luồng dịch thuật chính để tối ưu hiệu năng.
 * - Sử dụng persist middleware của Zustand giúp lưu trữ bền vững.
 * - Giới hạn tối đa 200 mục lịch sử (FIFO) để bảo toàn bộ nhớ.
 * - Tự động phát hiện trùng lặp: Nếu dịch trùng cụm từ, đưa cụm từ đó lên đầu danh sách.
 * ============================================
 */

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { HistoryItem, TranslationMode } from "../types";

interface HistoryState {
  /** Danh sách các mục lịch sử đã lưu */
  items: HistoryItem[];

  /** Từ khóa tìm kiếm hiện tại */
  searchQuery: string;

  /** Thêm một mục lịch sử mới */
  addHistoryItem: (
    originalText: string,
    translatedText: string,
    type: TranslationMode,
    sourceLanguage: string,
    targetLanguage: string
  ) => void;

  /** Xóa một mục lịch sử cụ thể theo id */
  deleteHistoryItem: (id: string) => void;

  /** Xóa toàn bộ danh sách lịch sử */
  clearHistory: () => void;

  /** Đặt từ khóa tìm kiếm lọc lịch sử */
  setSearchQuery: (query: string) => void;
}

const MAX_HISTORY_ITEMS = 200; // Giới hạn lưu trữ tối đa

export const useHistoryStore = create<HistoryState>()(
  persist(
    (set) => ({
      items: [],
      searchQuery: "",

      addHistoryItem: (originalText, translatedText, type, sourceLanguage, targetLanguage) =>
        set((state) => {
          const trimmedOriginal = originalText.trim();
          const trimmedTranslated = translatedText.trim();

          if (!trimmedOriginal || !trimmedTranslated) return {};

          // Lọc trùng lặp: Nếu cụm từ đã tồn tại, xóa bản ghi cũ để đưa bản ghi mới lên đầu
          const filteredItems = state.items.filter(
            (item) => item.originalText.toLowerCase() !== trimmedOriginal.toLowerCase()
          );

          const newItem: HistoryItem = {
            id: crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 11),
            originalText: trimmedOriginal,
            translatedText: trimmedTranslated,
            type,
            timestamp: Date.now(),
            sourceLanguage: sourceLanguage || "en",
            targetLanguage: targetLanguage || "vi",
          };

          // Tạo danh sách mới, đẩy lên đầu và cắt mảng giữ tối đa 200 mục
          const newItems = [newItem, ...filteredItems].slice(0, MAX_HISTORY_ITEMS);

          return { items: newItems };
        }),

      deleteHistoryItem: (id) =>
        set((state) => ({
          items: state.items.filter((item) => item.id !== id),
        })),

      clearHistory: () => set({ items: [] }),

      setSearchQuery: (query) => set({ searchQuery: query }),
    }),
    {
      name: "translator-history-storage", // Tên key lưu trong localStorage
      partialize: (state) => ({ items: state.items }), // Chỉ lưu trữ mảng items, không lưu searchQuery
    }
  )
);
