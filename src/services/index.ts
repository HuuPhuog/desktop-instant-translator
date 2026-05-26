/**
 * ============================================
 * 📁 src/services/index.ts
 * ============================================
 *
 * MỤC ĐÍCH:
 * Barrel file - Export tất cả services từ 1 chỗ.
 *
 * BARREL FILE LÀ GÌ?
 * - Thay vì import riêng từng file:
 *   import { translateText } from '../services/translation';
 *   import { readClipboardText } from '../services/clipboard';
 *
 * - Chỉ cần import 1 nơi:
 *   import { translateText, readClipboardText } from '../services';
 *
 * - Gọn hơn, dễ quản lý hơn
 * ============================================
 */

export { translateText, detectLanguage } from "./translation";
export { readClipboardText, simulateCopy } from "./clipboard";
export { recognizeText, captureScreenRegion } from "./ocr";
export { registerHotkeys, unregisterHotkeys } from "./hotkey";
