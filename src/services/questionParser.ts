/**
 * ============================================
 * 📁 src/services/questionParser.ts
 * ============================================
 *
 * MỤC ĐÍCH:
 * Bộ Phân Tích Câu Hỏi (Question Parsing Engine).
 * Chuyển đổi dữ liệu thô từ OCR/Layout thành các đối tượng câu hỏi chuẩn hóa StructuredQuestion.
 * ============================================
 */

import type { OCRResult, StructuredQuestion } from "../types";
import { detectLayout } from "./layoutDetector";

// Regex quét và tách các đáp án trắc nghiệm
const OPTION_SPLIT_REGEX = /(?:\b|\()([A-D])[\.\)\-\]\s]\s*([^\(\[A-D]+)/gi;

/**
 * parseQuestions - Phân tích và cấu trúc hóa danh sách câu hỏi học thuật từ OCRResult
 *
 * @param ocrResult Kết quả OCR chứa thông tin hình học và bố cục
 * @returns Danh sách câu hỏi có cấu trúc chuẩn
 */
export function parseQuestions(ocrResult: OCRResult): StructuredQuestion[] {
  // Nếu OCRResult chưa chạy qua Layout Detection, thực hiện chạy trước
  let layout = ocrResult.layoutInfo;
  if (!layout) {
    try {
      layout = detectLayout(ocrResult);
    } catch (e) {
      console.warn("[Question Parser] Failed to detect layout, using empty layout:", e);
      layout = {
        layoutType: "general",
        confidence: 100,
        groupedQuestions: []
      };
    }
  }

  const groupedQuestions = layout.groupedQuestions || [];
  const passageContext = layout.passageText || null;
  const structuredQuestions: StructuredQuestion[] = [];

  groupedQuestions.forEach((gq, index) => {
    try {
      const questionNumber = gq.questionNumber || String(index + 1);
      const questionText = gq.questionText || "";

      // 1. Phân tách và cấu trúc hóa mảng options (A, B, C, D)
      const optionsMap = new Map<string, string>();

      gq.optionsLines.forEach((line) => {
        const text = line.text.trim();
        OPTION_SPLIT_REGEX.lastIndex = 0;
        
        let match;
        let foundMatch = false;

        // Quét tất cả các cụm đáp án xuất hiện trên dòng (hỗ trợ cả dòng đơn và dòng chứa nhiều đáp án)
        while ((match = OPTION_SPLIT_REGEX.exec(text)) !== null) {
          const label = match[1].toUpperCase();
          const val = match[2].trim().replace(/[,;\s]+$/, ""); // Dọn dẹp dấu phẩy/chấm ở cuối
          optionsMap.set(label, val);
          foundMatch = true;
        }

        // Khôi phục lỗi: Nếu dòng không khớp Regex chuẩn nhưng bắt đầu bằng một ký tự lựa chọn trắc nghiệm
        if (!foundMatch) {
          const cleanText = text.replace(/^\s*[\(\[A-Da-d\s]*\b([A-Da-d])[\.\)\-\]\s]\s*/, "");
          const labelMatch = text.match(/^\s*[\(\[A-Da-d\s]*\b([A-Da-d])\b/);
          if (labelMatch) {
            optionsMap.set(labelMatch[1].toUpperCase(), cleanText.trim());
          }
        }
      });

      // Tạo mảng options theo thứ tự A, B, C, D
      const options: string[] = [];
      ["A", "B", "C", "D"].forEach((label) => {
        const val = optionsMap.get(label);
        if (val) {
          options.push(`${label}. ${val}`);
        }
      });

      // Lớp khôi phục lỗi: Nếu không trích xuất được bất kỳ option A/B/C/D nào
      // Sử dụng toàn bộ nội dung dòng đáp án thô làm các lựa chọn
      if (options.length === 0 && gq.optionsLines.length > 0) {
        gq.optionsLines.forEach((ol, idx) => {
          const label = ["A", "B", "C", "D"][idx] || "A";
          options.push(`${label}. ${ol.text.trim()}`);
        });
      }

      // 2. Định vị chỗ trống (Blank Position)
      let blankPosition: number | null = null;
      
      // Tìm chỗ trống trong câu hỏi
      const blankMatch = questionText.match(/_{3,}|\.{4,}|\(\s*\d*\s*\)|\(\s*blank\s*\)/i);
      if (blankMatch && blankMatch.index !== undefined) {
        blankPosition = blankMatch.index;
      }

      structuredQuestions.push({
        questionNumber,
        questionText,
        options,
        blankPosition,
        passageContext
      });
    } catch (err) {
      console.error(`[Question Parser] Lỗi phân tích câu hỏi chỉ mục ${index}:`, err);
      // Khôi phục lỗi: Trả về câu hỏi thô nếu bị crash giữa chừng
      structuredQuestions.push({
        questionNumber: gq.questionNumber || String(index + 1),
        questionText: gq.questionText || "",
        options: gq.optionsLines.map(ol => ol.text.trim()),
        blankPosition: null,
        passageContext
      });
    }
  });

  return structuredQuestions;
}
