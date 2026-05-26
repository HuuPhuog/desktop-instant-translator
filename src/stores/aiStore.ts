/**
 * ============================================
 * 📁 src/stores/aiStore.ts
 * ============================================
 *
 * MỤC ĐÍCH:
 * Zustand store quản lý kết quả phân tích học tập AI,
 * cơ chế cache trên RAM và hủy yêu cầu (abort) thông minh.
 *
 * CÁC TÍNH NĂNG CHÍNH:
 * 1. Cache quản lý RAM: Tránh lặp lại yêu cầu API cho cùng một từ/câu.
 * 2. Tải bất đồng bộ không chặn (Non-blocking): Popup chính hiển thị ngay,
 *    kết quả AI load sau khi người học yêu cầu.
 * 3. Hủy bỏ an toàn (Cancellation): Tự động gọi abort() chặn đứng request
 *    chạy ngầm khi người dùng tắt popup hoặc đổi từ cần dịch.
 * ============================================
 */

import { create } from "zustand";
import type { AILearningResult, OCRResult, TranslationResult } from "../types";
import { analyzeText } from "../services/ai";

type AIStatus = "idle" | "loading" | "success" | "error";

interface AIState {
  /** Kết quả phân tích hiện tại */
  analysis: AILearningResult | null;

  /** Trạng thái tải của AI */
  status: AIStatus;

  /** Thông báo lỗi của AI nếu có */
  error: string | null;

  /** Cache RAM lưu trữ kết quả phân tích tránh gọi API trùng */
  cache: Record<string, AILearningResult>;

  /** Controller quản lý việc hủy request HTTP */
  abortController: AbortController | null;

  /** Gửi yêu cầu phân tích câu/từ */
  fetchAnalysis: (text: string, targetLang?: string, ocrResult?: OCRResult | TranslationResult) => Promise<void>;

  /** Hủy yêu cầu phân tích hiện tại đang chạy ngầm */
  cancelAnalysis: () => void;

  /** Reset trạng thái AI */
  resetAI: () => void;
}

export const useAIStore = create<AIState>((set, get) => ({
  analysis: null,
  status: "idle",
  error: null,
  cache: {},
  abortController: null,

  fetchAnalysis: async (text, targetLang = "vi", ocrResult) => {
    const trimmed = text.trim();
    if (!trimmed) return;

    const { cache, abortController } = get();

    // 1. Nếu có request trước đó đang chạy, thực hiện Hủy (Abort) ngay
    if (abortController) {
      abortController.abort();
    }

    // 2. Kiểm tra bộ nhớ đệm Cache
    const cacheKey = `${trimmed}_${targetLang}`;
    if (cache[cacheKey]) {
      console.log(`[AI Store] Cache Hit for: "${trimmed}"`);
      set({
        analysis: cache[cacheKey],
        status: "success",
        error: null,
        abortController: null,
      });
      return;
    }

    // 3. Khởi tạo AbortController mới cho request hiện tại
    const newController = new AbortController();
    set({
      status: "loading",
      analysis: null,
      error: null,
      abortController: newController,
    });

    try {
      const result = await analyzeText(trimmed, targetLang, newController.signal, ocrResult);

      // Lưu kết quả vào Cache RAM và cập nhật state
      set((state) => ({
        analysis: result,
        status: "success",
        error: null,
        abortController: null,
        cache: {
          ...state.cache,
          [cacheKey]: result,
        },
      }));
    } catch (err) {
      // Nếu lỗi do chủ động hủy request, không cập nhật trạng thái lỗi
      if (err instanceof DOMException && err.name === "AbortError") {
        return;
      }

      set({
        status: "error",
        error: err instanceof Error ? err.message : "Không thể phân tích dữ liệu AI.",
        abortController: null,
      });
    }
  },

  cancelAnalysis: () => {
    const { abortController } = get();
    if (abortController) {
      abortController.abort();
      set({ abortController: null, status: "idle" });
      console.log("[AI Store] Active AI request canceled.");
    }
  },

  resetAI: () => {
    const { abortController } = get();
    if (abortController) {
      abortController.abort();
    }
    set({
      analysis: null,
      status: "idle",
      error: null,
      abortController: null,
    });
  },
}));
