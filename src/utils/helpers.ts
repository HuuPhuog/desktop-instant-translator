/**
 * ============================================
 * 📁 src/utils/helpers.ts
 * ============================================
 *
 * MỤC ĐÍCH:
 * Tập hợp các utility functions (hàm tiện ích)
 * dùng chung trong toàn bộ ứng dụng.
 *
 * UTILITY FUNCTIONS LÀ GÌ?
 * - Hàm nhỏ, làm 1 việc cụ thể
 * - Không phụ thuộc vào React hay component nào
 * - Có thể dùng ở bất kỳ đâu
 * - Thường là pure function (input → output, không side effect)
 * ============================================
 */

/**
 * truncateText - Cắt text nếu quá dài
 *
 * @param text - Text gốc
 * @param maxLength - Độ dài tối đa
 * @returns Text đã cắt + "..." nếu quá dài
 *
 * Dùng cho: Popup hiển thị text gốc quá dài
 */
export function truncateText(text: string, maxLength: number = 100): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength) + "...";
}

/**
 * formatTimestamp - Chuyển timestamp thành chuỗi thời gian
 *
 * @param timestamp - Unix timestamp (milliseconds)
 * @returns Chuỗi thời gian dạng "HH:MM:SS"
 *
 * Dùng cho: Translation history (Phase 5)
 */
export function formatTimestamp(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString("vi-VN");
}

/**
 * debounce - Trì hoãn thực thi function
 *
 * @param fn - Function cần debounce
 * @param delay - Thời gian delay (ms)
 * @returns Function đã được debounce
 *
 * DEBOUNCE LÀ GÌ?
 * - Khi user gõ nhanh, function bị gọi liên tục
 * - Debounce "chờ" cho user ngừng gõ rồi mới gọi
 * - Giảm số lần gọi API không cần thiết
 *
 * Ví dụ: debounce(search, 300)
 * → User gõ "hello" → chỉ gọi search("hello") 1 lần
 * → Thay vì 5 lần: search("h"), search("he"), ...
 */
export function debounce<T extends (...args: unknown[]) => void>(
  fn: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timeoutId: ReturnType<typeof setTimeout>;

  return (...args: Parameters<T>) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), delay);
  };
}

/**
 * classNames - Gộp nhiều CSS class thành 1 string
 *
 * @param classes - Danh sách class names
 * @returns Chuỗi class đã gộp, bỏ qua giá trị falsy
 *
 * Ví dụ: classNames("btn", isActive && "btn-active", "btn-primary")
 * → "btn btn-active btn-primary" (nếu isActive = true)
 * → "btn btn-primary" (nếu isActive = false)
 */
export function classNames(
  ...classes: (string | boolean | undefined | null)[]
): string {
  return classes.filter(Boolean).join(" ");
}

/**
 * sleep - Promise-based delay
 *
 * @param ms - Thời gian chờ (milliseconds)
 *
 * Dùng cho: Test/debug, hoặc tạo delay nhân tạo
 * Ví dụ: await sleep(1000); // Chờ 1 giây
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * copyToClipboard - Copy text vào clipboard
 *
 * @param text - Text cần copy
 * @returns true nếu thành công
 *
 * Dùng cho: Nút "Copy" trên popup
 * Sử dụng Clipboard API của browser
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    console.error("[Helpers] Failed to copy to clipboard");
    return false;
  }
}
