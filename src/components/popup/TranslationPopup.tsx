/**
 * ============================================
 * 📁 src/components/popup/TranslationPopup.tsx
 * ============================================
 *
 * MỤC ĐÍCH:
 * Component popup hiển thị kết quả dịch thuật cao cấp (Premium UI/UX).
 *
 * CÁC CẢI TIẾN PHẦN 6:
 * - Nhúng thêm component AILearningPanel hỗ trợ giải thích IPA, ngữ pháp, từ vựng.
 * - Tự động gọi resetAI() hủy các request phân tích AI chạy ngầm ngay khi popup đóng/bị ẩn.
 * ============================================
 */

import { useEffect, useState } from "react";
import { useTranslationStore } from "../../stores/translationStore";
import { useAIStore } from "../../stores/aiStore";
import { writeClipboardText } from "../../services/clipboard";
import { AILearningPanel } from "../ai/AILearningPanel";

export function TranslationPopup() {
  const { isPopupVisible, popupPosition, result, status, error, hidePopup } =
    useTranslationStore();

  const [copied, setCopied] = useState(false);
  const [isClosing, setIsClosing] = useState(false);

  const aiStatus = useAIStore((s) => s.status);

  // Auto-hide popup sau 60 giây khi ở chế độ thường, nhưng tạm dừng khi người dùng mở Trợ lý AI
  useEffect(() => {
    if (isPopupVisible && status !== "loading" && aiStatus === "idle") {
      const timer = setTimeout(() => {
        handleClose();
      }, 60000);

      return () => clearTimeout(timer);
    }
  }, [isPopupVisible, status, aiStatus]);

  // Reset trạng thái copied khi hiển thị kết quả mới
  useEffect(() => {
    setCopied(false);
    setIsClosing(false);
  }, [isPopupVisible, result]);

  // Lắng nghe phím ESC toàn cục để ẩn nhanh popup
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isPopupVisible) {
        handleClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isPopupVisible]);

  if (!isPopupVisible && !isClosing) return null;

  // Đóng popup kèm hiệu ứng fade-out và hủy request AI ngầm
  const handleClose = () => {
    setIsClosing(true);
    // Hủy bỏ request phân tích AI đang chạy ngầm để tiết kiệm chi phí
    useAIStore.getState().resetAI();

    setTimeout(() => {
      setIsClosing(false);
      hidePopup();
    }, 140); // Khớp với thời gian animation
  };

  // Copy bản dịch vào clipboard
  const handleCopy = async () => {
    if (result?.translatedText) {
      await writeClipboardText(result.translatedText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div
      id="translation-popup"
      className={`fixed z-50 p-4 border shadow-popup ${isClosing ? "animate-fade-out" : "animate-fade-in"
        }`}
      style={{
        left: `${popupPosition.x}px`,
        top: `${popupPosition.y}px`,
        transform: "translate(-12px, 12px)",
        backgroundColor: "var(--color-bg-popup)",
        borderColor: "var(--color-border)",
        borderRadius: "var(--radius-lg)",
        backdropFilter: "blur(18px)",
        maxWidth: "340px",
        minWidth: "280px",
        color: "var(--color-text-primary)",
        fontFamily: "var(--font-primary)",
      }}
    >
      {/* 1. TRẠNG THÁI LOADING (Spinner mượt mà) */}
      {status === "loading" && (
        <div className="flex flex-col items-center justify-center py-5 gap-3">
          <div
            className="w-5 h-5 border-2 border-t-transparent rounded-full animate-spin"
            style={{
              borderColor: "var(--color-accent-primary) transparent var(--color-accent-primary) transparent"
            }}
          />
          <span
            className="text-xs font-medium tracking-wide"
            style={{ color: "var(--color-text-secondary)" }}
          >
            Đang dịch thuật...
          </span>
        </div>
      )}

      {/* 2. TRẠNG THÁI ERROR */}
      {status === "error" && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold tracking-wider text-red-400 uppercase">
              Lỗi hệ thống
            </span>
            <button
              onClick={handleClose}
              className="w-5 h-5 flex items-center justify-center rounded-full text-xs text-muted hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
              style={{ color: "var(--color-text-muted)" }}
            >
              ✕
            </button>
          </div>
          <p className="text-xs font-medium text-red-200/90 leading-relaxed">
            {error || "Đã xảy ra lỗi không xác định."}
          </p>
        </div>
      )}

      {/* 3. TRẠNG THÁI THÀNH CÔNG */}
      {status === "success" && result && (
        <div className="space-y-3.5">
          {/* Header thanh thông tin ngôn ngữ */}
          <div className="flex items-center justify-between pb-2 border-b border-white/5">
            <div
              className="flex items-center gap-1.5 text-[10px] font-bold tracking-widest uppercase"
              style={{ color: "var(--color-text-muted)" }}
            >
              <span>{result.sourceLanguage}</span>
              <span className="text-white/20">➔</span>
              <span style={{ color: "var(--color-success)" }}>{result.targetLanguage}</span>
            </div>
            <button
              onClick={handleClose}
              className="w-5 h-5 flex items-center justify-center rounded-full text-[10px] hover:bg-white/5 transition-colors cursor-pointer"
              style={{ color: "var(--color-text-muted)" }}
            >
              ✕
            </button>
          </div>

          {/* Text nguyên bản gốc */}
          <div
            className="text-xs max-h-16 overflow-y-auto leading-relaxed select-text pr-1 font-normal animate-fade-in"
            style={{ color: "var(--color-text-secondary)" }}
          >
            {result.originalText}
          </div>

          {/* Bản dịch dịch nghĩa */}
          <div
            className="text-sm font-medium leading-relaxed select-text border-t border-white/5 pt-2.5"
            style={{ color: "var(--color-text-primary)" }}
          >
            {result.translatedText}
          </div>

          {/* ✨ Trợ lý phân tích học tập AI (Tải progressive bất đồng bộ) */}
          <AILearningPanel text={result.originalText} ocrResult={result} />

          {/* Action bar dưới cùng */}
          <div className="flex items-center justify-between border-t border-white/5 pt-2.5 text-[10px]">
            <span style={{ color: "var(--color-text-muted)" }}>
              ESC để đóng nhanh
            </span>

            <button
              onClick={handleCopy}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[11px] font-medium cursor-pointer transition-all active:scale-95"
              style={{
                backgroundColor: copied ? "rgba(16, 185, 129, 0.1)" : "rgba(255, 255, 255, 0.03)",
                color: copied ? "var(--color-success)" : "var(--color-text-primary)",
                border: "1px solid",
                borderColor: copied ? "rgba(16, 185, 129, 0.2)" : "rgba(255, 255, 255, 0.06)",
              }}
              onMouseEnter={(e) => {
                if (!copied) {
                  e.currentTarget.style.backgroundColor = "rgba(255, 255, 255, 0.08)";
                }
              }}
              onMouseLeave={(e) => {
                if (!copied) {
                  e.currentTarget.style.backgroundColor = "rgba(255, 255, 255, 0.03)";
                }
              }}
            >
              {copied ? (
                <>
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
                  </svg>
                  <span>Đã copy!</span>
                </>
              ) : (
                <>
                  <svg className="w-3.5 h-3.5 text-white/50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                  </svg>
                  <span>Sao chép</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default TranslationPopup;
