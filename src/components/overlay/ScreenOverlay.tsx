/**
 * ============================================
 * 📁 src/components/overlay/ScreenOverlay.tsx
 * ============================================
 *
 * MỤC ĐÍCH:
 * Giao diện lớp phủ màn hình (Overlay) dùng để kéo thả chọn vùng chụp OCR.
 *
 * CÁC CẢI TIẾN PHẦN 4:
 * 1. Hoạt ảnh nền mờ: Thêm hiệu ứng transition overlay mềm mại (animate-overlay-in) tránh chuyển cảnh đột ngột.
 * 2. Visual Selection Box: Cải thiện khung nét đứt màu xanh ngọc neon (#00cec9), viền bo góc nhẹ, bóng đổ tinh tế.
 * 3. Chỉ dẫn UI: Thiết kế bảng chỉ dẫn dạng viên thuốc (Pill shape) glassmorphism tinh xảo.
 * ============================================
 */

import { useState, useRef, MouseEvent } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { emit } from "@tauri-apps/api/event";

interface SelectionArea {
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
}

export function ScreenOverlay() {
  const [isSelecting, setIsSelecting] = useState(false);
  const [area, setArea] = useState<SelectionArea | null>(null);
  const overlayRef = useRef<HTMLDivElement>(null);

  // Mouse Down: Bắt đầu chọn vùng màn hình
  const handleMouseDown = (e: MouseEvent<HTMLDivElement>) => {
    // Chỉ phản hồi chuột trái
    if (e.button !== 0) return;

    setIsSelecting(true);
    setArea({
      startX: e.screenX,
      startY: e.screenY,
      currentX: e.screenX,
      currentY: e.screenY,
    });
  };

  // Mouse Move: Cập nhật vùng chọn theo chuyển động chuột
  const handleMouseMove = (e: MouseEvent<HTMLDivElement>) => {
    if (!isSelecting || !area) return;

    setArea((prev) => {
      if (!prev) return null;
      return {
        ...prev,
        currentX: e.screenX,
        currentY: e.screenY,
      };
    });
  };

  // Mouse Up: Nhả chuột -> Ẩn overlay, gửi tọa độ sang Main window
  const handleMouseUp = async () => {
    if (!isSelecting || !area) return;
    setIsSelecting(false);

    const x = Math.min(area.startX, area.currentX);
    const y = Math.min(area.startY, area.currentY);
    const width = Math.abs(area.startX - area.currentX);
    const height = Math.abs(area.startY - area.currentY);

    try {
      const win = getCurrentWindow();
      await win.hide();
    } catch (err) {
      console.error("Failed to hide overlay window:", err);
    }

    // Nếu vùng chọn đủ lớn (tránh click nhầm) thì phát sự kiện dịch thuật
    if (width > 5 && height > 5) {
      console.log(`[ScreenOverlay] Selected area: x=${x}, y=${y}, w=${width}, h=${height}`);
      await emit("ocr-region-selected", { x, y, width, height });
    }

    setArea(null);
  };

  // Click chuột phải để hủy bỏ chế độ chụp
  const handleContextMenu = async (e: MouseEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsSelecting(false);
    setArea(null);
    try {
      await getCurrentWindow().hide();
    } catch (err) {
      console.error("Failed to hide overlay window on cancel:", err);
    }
  };

  // Tính toán CSS style cho hộp selection box vẽ nét đứt
  const getSelectionBoxStyle = () => {
    if (!area) return { display: "none" };

    const left = Math.min(area.startX, area.currentX);
    const top = Math.min(area.startY, area.currentY);
    const width = Math.abs(area.startX - area.currentX);
    const height = Math.abs(area.startY - area.currentY);

    return {
      left: `${left}px`,
      top: `${top}px`,
      width: `${width}px`,
      height: `${height}px`,
      border: "1.5px solid rgba(255, 255, 255, 0.9)", // Viền trắng sáng mảnh
      backgroundColor: "rgba(255, 255, 255, 0.1)", // Nền trong mờ nhẹ
      position: "absolute" as const,
      pointerEvents: "none" as const,
      zIndex: 100,
      boxShadow: "0 0 0 9999px rgba(0, 0, 0, 0.3)", // Làm tối phần ngoài
    };
  };

  return (
    <div
      ref={overlayRef}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onContextMenu={handleContextMenu}
      className="w-screen h-screen relative select-none"
      style={{
        backgroundColor: "transparent", // Xóa base overlay vì đã dùng boxShadow
        cursor: "crosshair",
        overflow: "hidden",
      }}
    >
      {/* Vùng tối mặc định nếu chưa kéo (khi kéo, boxShadow sẽ take over) */}
      {!area && (
        <div style={{ position: "absolute", inset: 0, backgroundColor: "rgba(0,0,0,0.3)" }} />
      )}

      {/* Pill guide */}
      <div 
        className="absolute top-6 left-1/2 transform -translate-x-1/2 px-3 py-1.5 text-[10px] font-medium tracking-wide rounded-full pointer-events-none"
        style={{
          backgroundColor: "rgba(0, 0, 0, 0.65)",
          color: "rgba(255, 255, 255, 0.8)",
          border: "1px solid rgba(255, 255, 255, 0.1)",
          backdropFilter: "blur(4px)",
          zIndex: 50,
        }}
      >
        Kéo chọn vùng để dịch • Click phải để hủy
      </div>

      {/* Box vẽ vùng đang chọn */}
      {area && <div style={getSelectionBoxStyle()} />}
    </div>
  );
}

export default ScreenOverlay;
