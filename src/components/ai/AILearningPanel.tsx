/**
 * ============================================
 * 📁 src/components/ai/AILearningPanel.tsx
 * ============================================
 *
 * MỤC ĐÍCH:
 * Giao diện trợ lý học tập AI (AI Learning Panel) tích hợp trong Translation Popup.
 *
 * CÁC TÍNH NĂNG CHÍNH:
 * 1. Collapsible: Tiết kiệm không gian hiển thị, chỉ tải khi người học yêu cầu.
 * 2. Tải tiến trình (Progressive): Spinner mượt mà không block luồng dịch chính.
 * 3. Trực quan hóa dữ liệu: Phân bổ dữ liệu IPA, Ngữ pháp, Từ vựng, Ví dụ mẫu
 *    theo phong cách thẻ mờ tối hiện đại.
 * ============================================
 */

import { useState, useEffect } from "react";
import { useAIStore } from "../../stores/aiStore";
import type { OCRResult, TranslationResult } from "../../types";

interface AILearningPanelProps {
  /** Văn bản tiếng Anh gốc cần phân tích */
  text: string;
  ocrResult?: OCRResult | TranslationResult;
}

export function AILearningPanel({ text, ocrResult }: AILearningPanelProps) {
  const [isOpen, setIsOpen] = useState(false);
  const { analysis, status, error, fetchAnalysis, cancelAnalysis, resetAI } = useAIStore();

  // Tự động reset trạng thái AI khi text gốc thay đổi (dịch từ mới)
  useEffect(() => {
    resetAI();
    setIsOpen(false);
  }, [text, resetAI]);

  // Hủy request khi component bị unmount (đóng popup đột ngột)
  useEffect(() => {
    return () => {
      cancelAnalysis();
    };
  }, [cancelAnalysis]);

  // Click Toggle: Mở rộng và trigger gọi API phân tích AI
  const handleToggle = () => {
    const nextState = !isOpen;
    setIsOpen(nextState);

    if (nextState && status === "idle") {
      fetchAnalysis(text, "vi", ocrResult);
    } else if (!nextState) {
      cancelAnalysis();
    }
  };

  const handleRetry = () => {
    fetchAnalysis(text, "vi", ocrResult);
  };

  return (
    <div className="w-full mt-3 pt-2.5 border-t border-white/5 font-sans">
      {/* Nút Toggle mở rộng */}
      <button
        onClick={handleToggle}
        className="w-full flex items-center justify-between text-[11px] font-semibold py-1.5 px-2.5 rounded-md transition-all active:scale-99 cursor-pointer"
        style={{
          backgroundColor: "rgba(99, 102, 241, 0.04)",
          border: "1px solid rgba(99, 102, 241, 0.15)",
          color: "var(--color-accent-primary)",
        }}
      >
        <span className="flex items-center gap-1.5">
          <span>✨</span> Trợ lý học tập AI {isOpen ? "đang mở" : ""}
        </span>
        <span className="text-[9px] opacity-70 transition-transform duration-200">
          {isOpen ? "▼ Thu gọn" : "▲ Xem giải thích"}
        </span>
      </button>

      {/* VÙNG NỘI DUNG CO GIÃN (COLLAPSIBLE) */}
      {isOpen && (
        <div className="mt-2.5 space-y-3 max-h-[220px] overflow-y-auto pr-0.5 animate-fade-in">
          {/* A. TRẠNG THÁI LOADING */}
          {status === "loading" && (
            <div className="flex flex-col items-center justify-center py-6 gap-2">
              <div
                className="w-4 h-4 border-2 border-t-transparent rounded-full animate-spin"
                style={{
                  borderColor: "var(--color-accent-primary) transparent var(--color-accent-primary) transparent",
                }}
              />
              <span className="text-[10px] text-white/40">AI đang phân tích cấu trúc...</span>
            </div>
          )}

          {/* B. TRẠNG THÁI LỖI */}
          {status === "error" && (
            <div className="p-2.5 rounded-md bg-red-500/5 border border-red-500/10 text-center space-y-2">
              <p className="text-[10px] text-red-300">{error || "Lỗi tải phân tích AI."}</p>
              <button
                onClick={handleRetry}
                className="px-3 py-1 rounded text-[9px] font-medium bg-red-500/10 text-red-200 border border-red-500/20 active:scale-95 cursor-pointer"
              >
                Thử lại
              </button>
            </div>
          )}

          {/* C. TRẠNG THÁI THÀNH CÔNG */}
          {status === "success" && analysis && (
            <div className="space-y-3 text-[11px] leading-relaxed">
              {/* 1. Phiên âm IPA */}
              {analysis.ipaPronunciation && (
                <div className="flex items-center gap-2 p-2 rounded-md bg-white/3 border border-white/5">
                  <span className="text-[9px] font-bold text-amber-400 uppercase tracking-wide">Pronunciation</span>
                  <span className="font-mono text-xs font-semibold text-amber-200/90 select-text">
                    {analysis.ipaPronunciation}
                  </span>
                </div>
              )}

              {/* 2. Cấu trúc Ngữ Pháp */}
              {analysis.grammarBreakdown && analysis.grammarBreakdown.length > 0 && (
                <div className="space-y-1">
                  <span className="text-[9px] font-bold text-indigo-300 uppercase tracking-wider block">Ngữ Pháp chính</span>
                  <ul className="list-disc pl-4 space-y-1 text-white/80 select-text">
                    {analysis.grammarBreakdown.map((item, idx) => (
                      <li key={idx} className="marker:text-indigo-400">{item}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* 3. Từ vựng cốt lõi */}
              {analysis.vocabularyExplanation && analysis.vocabularyExplanation.length > 0 && (
                <div className="space-y-1.5">
                  <span className="text-[9px] font-bold text-emerald-300 uppercase tracking-wider block">Từ vựng cốt lõi</span>
                  <div className="grid gap-1.5">
                    {analysis.vocabularyExplanation.map((item, idx) => (
                      <div
                        key={idx}
                        className="p-2 rounded-md border"
                        style={{
                          backgroundColor: "var(--color-bg-secondary)",
                          borderColor: "var(--color-border)",
                        }}
                      >
                        <div className="flex items-baseline gap-1.5 select-text">
                          <span className="font-bold text-emerald-300">{item.word}</span>
                          <span className="text-[9px] text-white/30 italic">({item.partOfSpeech})</span>
                          <span className="text-white/40 text-[9px] ml-1">➔</span>
                          <span className="text-white/95 font-medium ml-1">{item.meaning}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 4. Ví dụ áp dụng */}
              {analysis.exampleUsage && analysis.exampleUsage.length > 0 && (
                <div className="space-y-1.5">
                  <span className="text-[9px] font-bold text-sky-300 uppercase tracking-wider block">Ví dụ mẫu tương tự</span>
                  <div className="space-y-1.5 select-text">
                    {analysis.exampleUsage.map((ex, idx) => (
                      <div key={idx} className="pl-2 border-l border-sky-500/30 space-y-0.5">
                        <p className="font-medium text-white/95">{ex.original}</p>
                        <p className="text-[10px] text-white/50">{ex.translated}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 5. Nhận xét Ngữ Cảnh */}
              {analysis.contextualExplanation && (
                <div className="space-y-1 select-text">
                  <span className="text-[9px] font-bold text-purple-300 uppercase tracking-wider block">Ngữ cảnh & Sắc thái</span>
                  <p className="text-white/70 italic text-[10px] pl-1">{analysis.contextualExplanation}</p>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default AILearningPanel;
