/**
 * ============================================
 * 📁 src/services/clipboard.ts
 * ============================================
 *
 * MỤC ĐÍCH:
 * Service đọc nội dung clipboard (bộ nhớ tạm) và giả lập copy.
 *
 * CÁCH HOẠT ĐỘNG (theo 02_ARCHITECTURE.md):
 * 1. User chọn text bất kỳ đâu trên desktop
 * 2. Nhấn Ctrl+Q
 * 3. App simulate Ctrl+C (copy text)
 * 4. Service này đọc clipboard
 * 5. Trả text về cho translation service
 *
 * THEO: 08_TOOLING.md
 * - "Tauri Clipboard Plugin: read selected text"
 *
 * CÔNG NGHỆ:
 * - Sử dụng @tauri-apps/plugin-clipboard-manager
 * - Giao tiếp React ↔ Rust qua IPC (invoke)
 * ============================================
 */

import { readText, writeText } from "@tauri-apps/plugin-clipboard-manager";
import { invoke } from "@tauri-apps/api/core";

/**
 * readClipboardText - Đọc text từ clipboard hệ thống
 *
 * @returns Text hiện tại trong clipboard
 */
export async function readClipboardText(): Promise<string> {
  try {
    const text = await readText();
    return text || "";
  } catch (error) {
    console.error("[Clipboard Service] Error reading clipboard:", error);
    return "";
  }
}

/**
 * writeClipboardText - Ghi text vào clipboard hệ thống (cho tính năng Copy kết quả dịch)
 *
 * @param text - Text cần ghi vào clipboard
 */
export async function writeClipboardText(text: string): Promise<void> {
  try {
    await writeText(text);
  } catch (error) {
    console.error("[Clipboard Service] Error writing to clipboard:", error);
  }
}

/**
 * simulateCopy - Simulate Ctrl+C để copy text đã chọn
 *
 * Tại sao cần simulate?
 * → User chọn text ở app khác (Chrome, Word, etc.)
 * → App của mình không thể trực tiếp đọc text đó
 * → Phải simulate Ctrl+C để text vào clipboard
 * → Rồi mới đọc clipboard được
 *
 * Gọi Tauri Rust command `simulate_copy` để giả lập keyboard input native
 */
export async function simulateCopy(): Promise<void> {
  try {
    await invoke("simulate_copy");
  } catch (error) {
    console.error("[Clipboard Service] Error simulating copy:", error);
  }
}
