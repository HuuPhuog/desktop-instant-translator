/**
 * ============================================
 * 📁 src/services/blankDetector.ts
 * ============================================
 *
 * MỤC ĐÍCH:
 * Phát hiện các khoảng trống điền từ (fill-in-the-blank) trong kết quả OCR.
 * Blank tokens KHÔNG BAO GIỜ được dịch như văn bản thông thường.
 *
 * CHIẾN LƯỢC 4 LỚP:
 * Layer 1: Regex trên text token (dấu gạch ngang, gạch dưới liên tiếp)
 * Layer 2: Tỷ lệ khung hình bbox (width >> height = đường kẻ ngang)
 * Layer 3: Confidence Tesseract thấp + text ngắn/rỗng
 * Layer 4: Heuristic vị trí giữa câu (có từ trước và sau)
 * ============================================
 */

import type { WordToken, BlankToken, Token } from "../types";

// Biểu thức chính quy nhận diện các mẫu blank phổ biến
const BLANK_REGEX = /^[-—_]{2,}$|^[—\-–]{1,}$/;

// Ngưỡng tỷ lệ khung hình: width/height > ASPECT_RATIO_THRESHOLD → đường kẻ ngang
const ASPECT_RATIO_THRESHOLD = 5;

// Ngưỡng độ tin cậy Tesseract thấp (0-100)
const LOW_CONFIDENCE_THRESHOLD = 25;

/**
 * inferBlankLength - Suy luận độ dài của khoảng trống từ chiều rộng pixel
 */
function inferBlankLength(pixelWidth: number): "short" | "medium" | "long" {
  if (pixelWidth < 60) return "short";
  if (pixelWidth < 150) return "medium";
  return "long";
}

/**
 * isBlankToken - Kiểm tra xem một word từ Tesseract có phải là khoảng trống không
 * Áp dụng 4 lớp kiểm tra theo thứ tự từ rõ ràng nhất đến heuristic nhất.
 */
export function isBlankToken(word: {
  text: string;
  confidence: number;
  bbox: { x: number; y: number; width: number; height: number };
}): boolean {
  const { text, confidence, bbox } = word;
  const trimmed = text.trim();

  // Layer 1: Regex — chuỗi gạch ngang/gạch dưới thuần túy
  if (BLANK_REGEX.test(trimmed)) {
    return true;
  }

  // Layer 2: Tỷ lệ khung hình — width >> height (đường kẻ ngang không phải chữ)
  if (bbox.height > 0 && bbox.width / bbox.height > ASPECT_RATIO_THRESHOLD) {
    // Thêm điều kiện: text phải ngắn hoặc chứa toàn gạch
    if (trimmed.length < 5 || /^[-—_]+$/.test(trimmed)) {
      return true;
    }
  }

  // Layer 3: Confidence rất thấp + text ngắn hoặc không có ký tự chữ/số
  if (confidence < LOW_CONFIDENCE_THRESHOLD && trimmed.length > 0) {
    const hasLetters = /[a-zA-Z0-9]/.test(trimmed);
    if (!hasLetters) {
      return true;
    }
  }

  // Layer 4: Text rỗng hoặc chỉ có khoảng trắng (Tesseract đôi khi trả về rỗng cho vùng gạch)
  if (trimmed.length === 0 && bbox.width > 30) {
    return true;
  }

  // Layer 5: Word có confidence thấp (< 35) + là chữ in hoa gibberish ngắn có tỉ lệ khung dẹt ngang
  // (Đặc trưng của nét gạch ngang bị nhận diện sai thành F, T, N, R, G phối hợp số câu hỏi)
  if (confidence < 35 && trimmed.length > 0 && trimmed.length <= 7) {
    const isGibberish = /^[A-Z0-9]+$/.test(trimmed);
    const aspect = bbox.height > 0 ? bbox.width / bbox.height : 0;
    if (isGibberish && aspect >= 1.8) {
      return true;
    }
  }

  return false;
}

/**
 * convertWordToToken - Chuyển đổi 1 word từ Tesseract sang Token (WordToken hoặc BlankToken)
 */
export function convertWordToToken(word: {
  text: string;
  confidence: number;
  bbox: { x: number; y: number; width: number; height: number };
}): Token {
  if (isBlankToken(word)) {
    const blank: BlankToken = {
      type: "blank",
      pixelX: word.bbox.x,
      pixelWidth: word.bbox.width,
      inferredLength: inferBlankLength(word.bbox.width),
    };
    return blank;
  }

  const wordToken: WordToken = {
    type: "word",
    text: word.text,
    confidence: word.confidence,
    bbox: word.bbox,
  };
  return wordToken;
}

/**
 * buildCleanText - Xây dựng chuỗi text sạch từ danh sách Token.
 * Blank tokens được thay thế bằng "______" để hiển thị cho người dùng.
 * Text tokens được nối lại bằng khoảng trắng.
 */
export function buildCleanText(tokens: Token[]): string {
  return tokens
    .map((t) => (t.type === "blank" ? "______" : t.text))
    .join(" ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

/**
 * detectBlanksInText - Phát hiện blanks trong một chuỗi text thuần túy (không có bbox).
 * Dùng cho trường hợp fallback khi không có thông tin hình học từ Tesseract.
 * Trả về chuỗi đã chuẩn hóa với blanks được thay thế bằng "______".
 */
export function detectBlanksInText(text: string): string {
  if (!text) return "";
  // Chuẩn hóa các mẫu blank phổ biến thành "______"
  return text
    .replace(/[-—–_]{2,}/g, "______")
    .replace(/\s{2,}/g, " ")
    .trim();
}
