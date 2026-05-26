/**
 * ============================================
 * 📁 src/components/history/HistoryPanel.tsx
 * ============================================
 *
 * MỤC ĐÍCH:
 * Giao diện lịch sử dịch thuật tối giản, trực quan và hiệu năng cao (Premium UI/UX).
 *
 * CÁC TÍNH NĂNG CHÍNH:
 * 1. Tìm kiếm tức thì: Lọc văn bản gốc và bản dịch nhanh chóng.
 * 2. Sao chép nhanh: Nút copy chuyên biệt cho từng kết quả dịch.
 * 3. Dọn dẹp linh hoạt: Hỗ trợ xóa đơn lẻ từng mục hoặc xóa sạch toàn bộ lịch sử.
 * 4. Tương thích giao diện: Thiết kế mượt mà, tối giản, hỗ trợ Dark Mode đồng bộ.
 * ============================================
 */

import { useState, useMemo } from "react";
import { useHistoryStore } from "../../stores/historyStore";
import { writeClipboardText } from "../../services/clipboard";

export function HistoryPanel() {
  const { items, clearHistory, deleteHistoryItem } = useHistoryStore();
  const [searchQuery, setSearchQuery] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Bộ lọc tìm kiếm tối ưu bằng useMemo để tránh tính toán lại không cần thiết
  const filteredItems = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return items;
    return items.filter(
      (item) =>
        item.originalText.toLowerCase().includes(query) ||
        item.translatedText.toLowerCase().includes(query)
    );
  }, [items, searchQuery]);

  // Sao chép bản dịch của một item cụ thể
  const handleCopy = async (id: string, text: string) => {
    await writeClipboardText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1500);
  };

  // Format thời gian hiển thị thân thiện (ví dụ: "10:24" hoặc "Hôm qua 10:24")
  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    const hours = String(date.getHours()).padStart(2, "0");
    const minutes = String(date.getMinutes()).padStart(2, "0");
    return `${hours}:${minutes}`;
  };

  return (
    <div className="flex flex-col w-full h-full p-4 select-none">
      {/* 1. THANH TÌM KIẾM & NÚT DỌN DẸP */}
      <div className="flex gap-2 mb-3.5 items-center">
        <div className="relative flex-1">
          <span className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none text-white/30 text-xs">
            🔍
          </span>
          <input
            type="text"
            placeholder="Tìm kiếm lịch sử..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full text-xs pl-8 pr-3 py-1.5 outline-none rounded-md transition-colors"
            style={{
              backgroundColor: "var(--color-bg-tertiary)",
              border: "1px solid var(--color-border)",
              color: "var(--color-text-primary)",
            }}
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute inset-y-0 right-0 pr-2.5 flex items-center text-[10px] text-white/40 hover:text-white cursor-pointer"
            >
              ✕
            </button>
          )}
        </div>

        {items.length > 0 && (
          <button
            onClick={clearHistory}
            className="text-[11px] font-medium px-2.5 py-1.5 rounded-md border transition-all active:scale-95 cursor-pointer bg-red-500/5 text-red-400 border-red-500/10 hover:bg-red-500/10"
          >
            Xóa hết
          </button>
        )}
      </div>

      {/* 2. DANH SÁCH LỊCH SỬ DỊCH */}
      <div className="flex-1 overflow-y-auto pr-0.5 space-y-2">
        {filteredItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-center opacity-40">
            <span className="text-xl mb-1">🕒</span>
            <p className="text-[11px]" style={{ color: "var(--color-text-muted)" }}>
              {searchQuery ? "Không tìm thấy kết quả phù hợp" : "Lịch sử dịch đang rỗng"}
            </p>
          </div>
        ) : (
          filteredItems.map((item) => (
            <div
              key={item.id}
              className="group flex flex-col p-3 rounded-lg border transition-all hover:border-white/10"
              style={{
                backgroundColor: "var(--color-bg-secondary)",
                borderColor: "var(--color-border)",
              }}
            >
              {/* Header của History item */}
              <div className="flex items-center justify-between text-[10px] pb-1 border-b border-white/5 mb-1.5">
                <div className="flex items-center gap-1.5" style={{ color: "var(--color-text-muted)" }}>
                  <span 
                    className="px-1.5 py-0.5 rounded text-[8px] font-bold tracking-wider"
                    style={{
                      backgroundColor: item.type === "ocr" ? "rgba(16, 185, 129, 0.08)" : "rgba(99, 102, 241, 0.08)",
                      color: item.type === "ocr" ? "var(--color-success)" : "var(--color-accent-primary)",
                      border: "1px solid",
                      borderColor: item.type === "ocr" ? "rgba(16, 185, 129, 0.15)" : "rgba(99, 102, 241, 0.15)",
                    }}
                  >
                    {item.type === "ocr" ? "📷 OCR" : "🔤 TEXT"}
                  </span>
                  <span>
                    {item.sourceLanguage.toUpperCase()} ➔ {item.targetLanguage.toUpperCase()}
                  </span>
                </div>
                
                <span style={{ color: "var(--color-text-muted)" }}>
                  {formatTime(item.timestamp)}
                </span>
              </div>

              {/* Dòng chữ gốc */}
              <div 
                className="text-[11px] leading-relaxed break-words font-medium mb-1 line-clamp-2 select-text"
                style={{ color: "var(--color-text-primary)" }}
              >
                {item.originalText}
              </div>

              {/* Dòng bản dịch */}
              <div 
                className="text-[11px] leading-relaxed break-words line-clamp-2 select-text"
                style={{ color: "var(--color-text-secondary)" }}
              >
                {item.translatedText}
              </div>

              {/* Thanh action bar ẩn hiện khi hover */}
              <div className="flex justify-end gap-1.5 mt-2 pt-1.5 border-t border-white/5 opacity-70 group-hover:opacity-100 transition-opacity">
                {/* Nút Copy */}
                <button
                  onClick={() => handleCopy(item.id, item.translatedText)}
                  className="px-2 py-0.5 rounded text-[9px] font-medium transition-all active:scale-95 cursor-pointer"
                  style={{
                    backgroundColor: copiedId === item.id ? "rgba(16, 185, 129, 0.08)" : "rgba(255, 255, 255, 0.03)",
                    color: copiedId === item.id ? "var(--color-success)" : "var(--color-text-secondary)",
                  }}
                >
                  {copiedId === item.id ? "✓ Đã copy" : "Sao chép"}
                </button>

                {/* Nút Xóa */}
                <button
                  onClick={() => deleteHistoryItem(item.id)}
                  className="px-2 py-0.5 rounded text-[9px] font-medium text-red-400/80 hover:text-red-400 hover:bg-red-500/5 transition-all active:scale-95 cursor-pointer"
                >
                  Xóa
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export default HistoryPanel;
