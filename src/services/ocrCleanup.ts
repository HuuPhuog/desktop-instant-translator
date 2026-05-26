/**
 * ============================================
 * 📁 src/services/ocrCleanup.ts
 * ============================================
 *
 * MỤC ĐÍCH:
 * Làm sạch và chuẩn hóa kết quả từ Tesseract.js (OCR Post-processing).
 *
 * VẤN ĐỀ THƯỜNG GẶP TỪ OCR:
 * 1. Chữ nhiễu ở viền (ex: "|", "^", "~").
 * 2. Xuống dòng sai (đặc biệt trong subtitles hoặc đoạn văn).
 * 3. Dính chữ (ex: "rn" -> "m", "cl" -> "d").
 * ============================================
 */

export function cleanOcrText(rawText: string): string {
  if (!rawText) return "";

  let cleaned = rawText;

  // 1. Chuẩn hóa các dấu gạch ngang/gạch dưới liên tục (ví dụ: ---, ——-, --—-—, _______)
  // thành dạng khoảng trống điền khuyết tiêu chuẩn " _______ " để Google Translate và LLM hiểu đúng.
  cleaned = cleaned.replace(/[-—_]{2,}/g, " _______ ");

  // 2. Loại bỏ các ký tự rác sinh ra do viền, bo góc ảnh (noise characters)
  // Lưu ý: Đã loại bỏ kí tự "_" khỏi danh sách xóa để giữ lại khoảng trống điền từ.
  cleaned = cleaned.replace(/[|~^{}[\]\\]/g, "");

  // 3. Nối dòng (Merge broken lines)
  // Subtitles hoặc văn bản cột đôi thường bị cắt làm 2 dòng. Nếu dòng trước không kết thúc bằng 
  // dấu chấm, dấu hỏi, dấu than, thì dòng sau nên được nối vào.
  // Thay thế dấu \n bằng dấu cách nếu dòng trước không phải là kết thúc câu.
  cleaned = cleaned.replace(/([^.?!:;])\n+/g, "$1 ");
  
  // Xóa các dấu \n dư thừa hoặc khoảng trắng dư thừa
  cleaned = cleaned.replace(/\n{2,}/g, "\n");
  cleaned = cleaned.replace(/\s{2,}/g, " ");

  // 4. Sửa lỗi chính tả phổ biến từ Tesseract
  const commonTypos: Record<string, string> = {
    " l\\\\'m ": " I'm ",
    " \\\\' ": " ' ",
    " , ": ", ",
    " \\. ": ". "
  };

  for (const [typo, fix] of Object.entries(commonTypos)) {
    const regex = new RegExp(typo, "g");
    cleaned = cleaned.replace(regex, fix);
  }

  // 5. Trim hai đầu
  return cleaned.trim();
}
