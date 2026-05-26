/**
 * ============================================
 * 📁 src/services/translation.ts
 * ============================================
 *
 * MỤC ĐÍCH:
 * Service xử lý việc dịch thuật.
 * Nhận text → gọi Google Translate API → trả về kết quả dịch.
 *
 * THEO: 02_ARCHITECTURE.md - "Translation Service"
 * - detect language
 * - call translation API
 * - return translated result
 *
 * CÔNG NGHỆ:
 * - Google Translate Free API (gtx client)
 * - Nhanh, nhẹ, không cần API Key, hoạt động ổn định cho nhu cầu cá nhân.
 * ============================================
 */

import type { TranslationResult } from "../types";

/**
 * translateText - Hàm dịch text sử dụng Google Translate Free API
 *
 * @param text - Text cần dịch
 * @param targetLang - Ngôn ngữ đích (mặc định: "vi")
 * @returns TranslationResult chứa bản dịch và ngôn ngữ gốc
 */
export async function translateText(
  text: string,
  targetLang: string = "vi"
): Promise<TranslationResult> {
  const trimmed = text.trim();
  if (!trimmed) {
    throw new Error("Text to translate cannot be empty");
  }

  // Danh sách các endpoints để thử nghiệm theo thứ tự độ tin cậy
  const endpoints = [
    `https://translate.google.com/translate_a/single?client=gtx&sl=auto&tl=${targetLang}&dt=t&q=${encodeURIComponent(trimmed)}`,
    `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${targetLang}&dt=t&q=${encodeURIComponent(trimmed)}`
  ];

  let lastError: any = null;

  for (const url of endpoints) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4000); // 4 giây timeout cho mỗi endpoint

      const response = await fetch(url, { signal: controller.signal });
      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`Google Translate API returned status ${response.status}`);
      }

      const data = await response.json();
      
      // Parse kết quả từ Google Translate format
      if (!data || !data[0]) {
        throw new Error("Invalid response format from Google Translate");
      }

      // Kết hợp các dòng dịch lại (trong trường hợp dịch nhiều dòng)
      let translatedText = "";
      for (const chunk of data[0]) {
        if (chunk && chunk[0]) {
          translatedText += chunk[0];
        }
      }

      // Phát hiện ngôn ngữ gốc từ phần tử thứ 2 của response array
      const sourceLanguage = data[2] || "auto";

      return {
        originalText: trimmed,
        translatedText: translatedText.trim(),
        sourceLanguage,
        targetLanguage: targetLang,
        timestamp: Date.now(),
      };
    } catch (error) {
      console.warn(`[Translation Service] Failed to fetch from ${url}:`, error);
      lastError = error;
      // Tiếp tục thử endpoint tiếp theo
    }
  }

  // Nếu tất cả các endpoints đều thất bại
  console.error("[Translation Service] All translation endpoints failed.");
  throw new Error(
    lastError instanceof Error ? lastError.message : "Failed to connect to Google Translate API"
  );
}

/**
 * detectLanguage - Phát hiện ngôn ngữ của text
 *
 * @param text - Text cần detect
 * @returns Mã ngôn ngữ (ví dụ: "en", "vi", "ja")
 */
export async function detectLanguage(text: string): Promise<string> {
  try {
    // Google Translate translate API đã bao gồm auto-detect,
    // nhưng nếu cần detect riêng lẻ ta có thể gọi translate sang chính nó
    const result = await translateText(text, "en");
    return result.sourceLanguage;
  } catch (error) {
    console.error("[Translation Service] Error detecting language:", error);
    return "en"; // Default fallback
  }
}
