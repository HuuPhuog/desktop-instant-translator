/**
 * ============================================
 * 📁 src/hooks/useTranslation.ts
 * ============================================
 *
 * MỤC ĐÍCH:
 * Custom React hook encapsulate (đóng gói) toàn bộ
 * logic dịch thuật thành 1 hook dễ dùng.
 *
 * CUSTOM HOOK LÀ GÌ?
 * - Một function bắt đầu bằng "use"
 * - Bên trong có thể dùng các React hooks khác
 *   (useState, useEffect, useCallback, etc.)
 * - Giúp tái sử dụng logic giữa nhiều components
 *
 * TẠI SAO CẦN CUSTOM HOOK?
 * - Component chỉ cần gọi: const { translate } = useTranslation()
 * - Không cần biết bên trong gọi API như nào
 * - Logic phức tạp được "giấu" trong hook
 * - Nhiều component có thể dùng chung hook này
 *
 * VÍ DỤ SỬ DỤNG:
 * ```tsx
 * function Popup() {
 *   const { translate, result, isLoading } = useTranslation();
 *
 *   // Khi cần dịch:
 *   await translate("Hello World");
 *
 *   // result sẽ tự cập nhật
 *   // isLoading sẽ tự chuyển true → false
 * }
 * ```
 * ============================================
 */

import { useCallback } from "react";
import { useTranslationStore } from "../stores/translationStore";
import { useHistoryStore } from "../stores/historyStore";
import { translateText } from "../services/translation";

/**
 * useTranslation - Hook chính cho dịch thuật
 *
 * Trả về:
 * - result: Kết quả dịch (hoặc null)
 * - status: Trạng thái hiện tại
 * - isLoading: Có đang loading không
 * - error: Thông báo lỗi
 * - translate: Hàm gọi để dịch text
 * - hidePopup: Hàm ẩn popup
 */
export function useTranslation() {
  // Lấy state và actions từ Zustand store
  const result = useTranslationStore((s) => s.result);
  const status = useTranslationStore((s) => s.status);
  const error = useTranslationStore((s) => s.error);
  const isPopupVisible = useTranslationStore((s) => s.isPopupVisible);
  const mode = useTranslationStore((s) => s.mode);

  // Lấy actions (hàm thay đổi state)
  const setResult = useTranslationStore((s) => s.setResult);
  const setLoading = useTranslationStore((s) => s.setLoading);
  const setError = useTranslationStore((s) => s.setError);
  const hidePopup = useTranslationStore((s) => s.hidePopup);

  // Action ghi nhận lịch sử
  const addHistoryItem = useHistoryStore((s) => s.addHistoryItem);

  /**
   * translate - Thực hiện dịch text
   *
   * useCallback để tránh tạo function mới mỗi lần render.
   * Dependencies []: function chỉ tạo 1 lần.
   *
   * Flow:
   * 1. Đặt loading state
   * 2. Gọi translation service
   * 3. Nếu thành công → setResult và ghi nhận vào lịch sử
   * 4. Nếu lỗi → setError
   *
   * try/catch: Bắt lỗi (ví dụ: mất mạng, API lỗi)
   * để app không crash (theo ARCHITECTURE: "fail gracefully")
   */
  const translate = useCallback(
    async (text: string, targetLang: string = "vi") => {
      // Không dịch text rỗng
      if (!text.trim()) return;

      try {
        setLoading();
        const translationResult = await translateText(text, targetLang);
        setResult(translationResult);

        // Tự động ghi lại lịch sử dịch thuật sau khi dịch thành công
        addHistoryItem(
          translationResult.originalText,
          translationResult.translatedText,
          mode,
          translationResult.sourceLanguage,
          translationResult.targetLanguage
        );
      } catch (err) {
        // Xử lý lỗi gracefully
        const message =
          err instanceof Error ? err.message : "Translation failed";
        setError(message);
        console.error("[useTranslation] Error:", message);
      }
    },
    [setLoading, setResult, setError, mode, addHistoryItem]
  );

  return {
    // State
    result,
    status,
    error,
    isLoading: status === "loading",
    isPopupVisible,

    // Actions
    translate,
    hidePopup,
  };
}
