/**
 * ============================================
 * 📁 src/stores/translationStore.ts
 * ============================================
 *
 * MỤC ĐÍCH:
 * Zustand store quản lý state (trạng thái) cho
 * chức năng dịch thuật.
 *
 * ZUSTAND LÀ GÌ?
 * - Thư viện quản lý state cho React
 * - Giống Redux nhưng đơn giản hơn rất nhiều
 * - Không cần Provider, không cần boilerplate
 * - Chỉ cần tạo 1 hook, dùng ở bất kỳ component nào
 *
 * CÁCH HOẠT ĐỘNG:
 * 1. Định nghĩa "store" = object chứa data + functions
 * 2. Component gọi hook → nhận data
 * 3. Khi data thay đổi → component tự re-render
 *
 * VÍ DỤ SỬ DỤNG:
 * ```tsx
 * function Popup() {
 *   const result = useTranslationStore(s => s.result);
 *   const status = useTranslationStore(s => s.status);
 *   // Component tự update khi result hoặc status thay đổi
 * }
 * ```
 *
 * THEO: 08_TOOLING.md - "Zustand: lightweight state management"
 * ============================================
 */

import { create } from "zustand";
import type { TranslationResult, AppStatus, TranslationMode, PopupPosition } from "../types";

/**
 * TranslationState - Interface cho translation store
 *
 * Chia làm 2 phần:
 * 1. State (data): result, status, mode, ...
 * 2. Actions (hành động): setResult, setLoading, ...
 *
 * Tại sao tách State và Actions?
 * → Dễ đọc, dễ hiểu store chứa gì và làm được gì
 */
interface TranslationState {
  // ==================
  // STATE (Dữ liệu)
  // ==================

  /** Kết quả dịch hiện tại (null nếu chưa dịch) */
  result: TranslationResult | null;

  /** Trạng thái: idle, loading, success, error */
  status: AppStatus;

  /** Chế độ dịch: text (Ctrl+Q) hoặc ocr (Ctrl+Shift+Q) */
  mode: TranslationMode;

  /** Thông báo lỗi (nếu có) */
  error: string | null;

  /** Popup có đang hiện không */
  isPopupVisible: boolean;

  /** Vị trí popup trên màn hình */
  popupPosition: PopupPosition;

  // ==================
  // ACTIONS (Hành động)
  // ==================
  // Mỗi action là 1 function thay đổi state

  /** Đặt kết quả dịch mới + hiện popup */
  setResult: (result: TranslationResult) => void;

  /** Đặt trạng thái loading (đang dịch...) */
  setLoading: () => void;

  /** Đặt trạng thái lỗi */
  setError: (message: string) => void;

  /** Đổi chế độ dịch */
  setMode: (mode: TranslationMode) => void;

  /** Hiện popup tại vị trí cụ thể */
  showPopup: (position: PopupPosition) => void;

  /** Ẩn popup */
  hidePopup: () => void;

  /** Reset về trạng thái ban đầu */
  reset: () => void;
}

/**
 * useTranslationStore - Zustand Hook
 *
 * TẠI SAO DÙNG `create()`?
 * - `create()` là hàm của Zustand tạo ra 1 React hook
 * - `set` là hàm cập nhật state (giống setState nhưng mạnh hơn)
 * - Khi gọi `set({...})`, Zustand tự thông báo cho
 *   tất cả component đang "subscribe" (lắng nghe) state đó
 *
 * PERFORMANCE:
 * - Zustand chỉ re-render component khi state mà
 *   component đó dùng thay đổi
 * - Ví dụ: Component A dùng `result`, Component B dùng `status`
 *   → Khi `result` đổi, chỉ A re-render, B không bị ảnh hưởng
 */
export const useTranslationStore = create<TranslationState>((set) => ({
  // Giá trị khởi tạo
  result: null,
  status: "idle",
  mode: "text",
  error: null,
  isPopupVisible: false,
  popupPosition: { x: 0, y: 0 },

  // ==================
  // ACTION IMPLEMENTATIONS
  // ==================

  setResult: (result) =>
    set({
      result,
      status: "success",
      error: null,
      isPopupVisible: true,
    }),

  setLoading: () =>
    set({
      status: "loading",
      error: null,
    }),

  setError: (message) =>
    set({
      status: "error",
      error: message,
      isPopupVisible: true,
    }),

  setMode: (mode) => set({ mode }),

  showPopup: (position) => {
    // Dự đoán kích thước popup (rộng ~320px, cao ~180px) để tính toán giới hạn màn hình
    const popupWidth = 320;
    const popupHeight = 180;

    const screenWidth = typeof window !== "undefined" ? window.screen.width : 1920;
    const screenHeight = typeof window !== "undefined" ? window.screen.height : 1080;

    let adjustedX = position.x;
    let adjustedY = position.y;

    // Chống tràn mép phải màn hình
    if (adjustedX + popupWidth > screenWidth) {
      adjustedX = screenWidth - popupWidth - 20;
    }

    // Chống tràn mép dưới màn hình (đẩy popup lên trên)
    if (adjustedY + popupHeight > screenHeight) {
      adjustedY = Math.max(10, position.y - popupHeight - 40);
    }

    // Đảm bảo không tràn mép trái và mép trên
    adjustedX = Math.max(10, adjustedX);
    adjustedY = Math.max(10, adjustedY);

    set({
      isPopupVisible: true,
      popupPosition: { x: adjustedX, y: adjustedY },
    });
  },

  hidePopup: () =>
    set({
      isPopupVisible: false,
    }),

  reset: () =>
    set({
      result: null,
      status: "idle",
      mode: "text",
      error: null,
      isPopupVisible: false,
      popupPosition: { x: 0, y: 0 },
    }),
}));
