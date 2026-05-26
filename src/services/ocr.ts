/**
 * ============================================
 * 📁 src/services/ocr.ts
 * ============================================
 *
 * MỤC ĐÍCH:
 * Service OCR — Điều phối việc chụp ảnh và phân tích tài liệu.
 *
 * PIPELINE V2:
 * captureScreenRegion → parseExamDocument → OCRResult (với examDocument nhúng bên trong)
 *
 * Không còn dùng clusterColumns hay cleanOcrText trực tiếp.
 * Thay vào đó, documentParser.ts xử lý toàn bộ pipeline.
 * ============================================
 */

import { invoke } from "@tauri-apps/api/core";
import type { OCRResult, ScreenRegion, ExamDocument } from "../types";
import { parseExamDocument } from "./documentParser";

/**
 * recognizeText - Nhận dạng và phân tích cấu trúc tài liệu từ ảnh.
 *
 * @param imageData - Dữ liệu ảnh dạng Base64 (data:image/png;base64,...)
 * @returns OCRResult với examDocument được nhúng, cùng rawText để fallback
 */
export async function recognizeText(imageData: string): Promise<OCRResult> {
  console.log("[OCR Service] Starting Exam Document Understanding Engine...");

  try {
    // Chạy toàn bộ pipeline mới: Image → BlankDetector → ColumnSegmenter → QuestionGrouper
    const examDocument: ExamDocument = await parseExamDocument(imageData);

    console.log(
      `[OCR Service] ExamDocument built. Type: ${examDocument.documentType}. ` +
      `Questions: ${examDocument.questions.length}. ` +
      `Passage: ${examDocument.passage ? "YES" : "NO"}.`
    );

    // Trả về OCRResult tương thích ngược (text + examDocument nhúng)
    return {
      text: examDocument.rawText,
      confidence: 90,
      detectedLanguage: "en",
      examDocument,
    };
  } catch (error) {
    console.error("[OCR Service] Pipeline failed:", error);
    throw new Error(error instanceof Error ? error.message : "OCR processing failed");
  }
}

/**
 * captureScreenRegion - Chụp vùng màn hình thông qua Rust Command.
 *
 * @param region - Tọa độ (x, y) tuyệt đối và kích thước (width, height) dạng physical pixels
 * @returns Ảnh PNG mã hóa Base64
 */
export async function captureScreenRegion(region: ScreenRegion): Promise<string> {
  console.log(`[OCR Service] Capturing screen: ${JSON.stringify(region)}`);

  try {
    const base64Data = await invoke<string>("capture_screen", {
      x: Math.round(region.x),
      y: Math.round(region.y),
      width: Math.round(region.width),
      height: Math.round(region.height),
    });

    return `data:image/png;base64,${base64Data}`;
  } catch (error) {
    console.error("[OCR Service] Screen capture failed:", error);
    throw new Error(error instanceof Error ? error.message : "Failed to capture screen region");
  }
}
