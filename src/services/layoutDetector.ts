/**
 * ============================================
 * 📁 src/services/layoutDetector.ts
 * ============================================
 *
 * MỤC ĐÍCH:
 * Engine nhận diện và phân tích bố cục tài liệu (Document Layout Detection Engine).
 * Nhận đầu vào là kết quả định vị OCR → Gom nhóm đoạn văn, câu hỏi, đáp án.
 * Phân loại định dạng bài học (TOEIC Part 5, Part 6, Part 7, IELTS, Subtitles, Vocab Cards).
 * ============================================
 */

import type { OCRResult, OCRLineBox, DocumentLayoutInfo, GroupedQuestion, DocumentLayoutType } from "../types";

// Các Regex nhận diện câu hỏi và đáp án trắc nghiệm
const QUESTION_REGEX = /^\s*(?:Question|Quest\.|Q)?\s*(\d+)\s*[\.\)\-\/\s]/i;
const OPTION_REGEX = /^\s*[\(\[A-Da-d\s]*\b([A-Da-d])[\.\)\-\]\s]/;
const MULTI_OPTION_REGEX = /[\(\[]?[A-D][\.\)\-\]]/g; // Dành cho các đáp án nằm chung trên một dòng
const BLANK_REGEX = /_{3,}|\.{4,}|\(\s*\d*\s*\)|\(\s*blank\s*\)/i;

/**
 * detectLayout - Phân tích cấu trúc hình học OCR và xác định loại bố cục
 *
 * @param ocrResult Kết quả OCR đã có tọa độ hình học
 * @returns Thông tin bố cục chi tiết
 */
export function detectLayout(ocrResult: OCRResult): DocumentLayoutInfo {
  const lines = ocrResult.lines || [];
  const regions = ocrResult.regions || [];

  if (lines.length === 0) {
    return {
      layoutType: "general",
      confidence: 100,
      groupedQuestions: []
    };
  }

  // 1. Phân loại từng dòng chữ độc lập
  const questionLines: { line: OCRLineBox; questionNum: string }[] = [];
  const optionLines: OCRLineBox[] = [];
  const passageLines: OCRLineBox[] = [];

  lines.forEach((line) => {
    const text = line.text.trim();
    
    // Kiểm tra dòng chứa số câu hỏi
    const qMatch = text.match(QUESTION_REGEX);
    if (qMatch) {
      questionLines.push({ line, questionNum: qMatch[1] });
      return;
    }

    // Kiểm tra dòng chứa đáp án trắc nghiệm
    if (OPTION_REGEX.test(text) || (text.match(MULTI_OPTION_REGEX)?.length || 0) >= 2) {
      optionLines.push(line);
      return;
    }

    // Mặc định là dòng văn bản thường / đoạn văn
    passageLines.push(line);
  });

  // 2. Gom nhóm Câu hỏi & Lựa chọn tương ứng (Question-Region Mapping)
  const groupedQuestions: GroupedQuestion[] = [];
  
  // Sắp xếp các câu hỏi tìm được theo vùng và chỉ số dòng
  const sortedQuestionLines = [...questionLines].sort((a, b) => {
    if (a.line.regionIndex !== b.line.regionIndex) {
      return a.line.regionIndex - b.line.regionIndex;
    }
    return a.line.lineIndex - b.line.lineIndex;
  });

  sortedQuestionLines.forEach((qObj, idx) => {
    const qLine = qObj.line;
    const qNum = qObj.questionNum;

    // Tìm điểm giới hạn của câu hỏi tiếp theo cùng vùng (để không gom nhầm đáp án)
    const nextQLine = sortedQuestionLines.find((nextQ, nextIdx) => 
      nextIdx > idx && nextQ.line.regionIndex === qLine.regionIndex
    )?.line;

    // Tìm các dòng đáp án nằm dưới câu hỏi này và trước câu hỏi tiếp theo
    const questionOptions = optionLines.filter((oLine) => {
      if (oLine.regionIndex !== qLine.regionIndex) return false;
      if (oLine.y <= qLine.y) return false;
      if (nextQLine && oLine.y >= nextQLine.y) return false;
      return true;
    });

    // Gom thêm các dòng văn bản phụ (ví dụ đề câu hỏi dài dòng thứ 2) nằm ngay dưới câu hỏi
    const questionSubTexts = passageLines.filter((pLine) => {
      if (pLine.regionIndex !== qLine.regionIndex) return false;
      if (pLine.y <= qLine.y) return false;
      if (nextQLine && pLine.y >= nextQLine.y) return false;
      // Tránh gom các đoạn văn quá dài của bài đọc
      if (pLine.text.split(/\s+/).length > 20) return false;
      // Chỉ lấy các dòng nằm TRƯỚC dòng đáp án đầu tiên nếu có đáp án
      if (questionOptions.length > 0 && pLine.y >= questionOptions[0].y) return false;
      return true;
    });

    // Tạo nội dung câu hỏi hoàn chỉnh
    let fullQuestionText = qLine.text;
    questionSubTexts.forEach((sub) => {
      fullQuestionText += " " + sub.text;
    });

    groupedQuestions.push({
      questionNumber: qNum,
      questionText: fullQuestionText.trim(),
      questionLine: qLine,
      optionsLines: questionOptions.sort((a, b) => a.y - b.y),
      hasBlank: BLANK_REGEX.test(fullQuestionText)
    });
  });

  // 3. Tách đoạn văn đọc hiểu (Passage Extraction)
  // Xác định các cột/vùng đóng vai trò là Bài đọc hiểu (không chứa câu hỏi/đáp án)
  const passageRegions = regions.filter((r) => {
    const regionLines = r.lines || [];
    const qCount = regionLines.filter(rl => QUESTION_REGEX.test(rl.text)).length;
    const oCount = regionLines.filter(rl => OPTION_REGEX.test(rl.text)).length;
    // Vùng đọc hiểu không được chứa quá nhiều câu hỏi/đáp án
    return qCount === 0 && oCount <= 1 && regionLines.length >= 2;
  });

  let passageText = "";
  if (passageRegions.length > 0) {
    // Sắp xếp các vùng bài đọc từ trái sang phải
    passageRegions.sort((a, b) => a.x - b.x);
    passageText = passageRegions.map(r => r.text).join("\n\n");
  } else {
    // Nếu không tách biệt cột, gom tất cả dòng không chứa Q/A làm passage
    // Thường là phần văn bản dài nằm ở đầu ảnh
    const longPassageLines = passageLines.filter(pl => 
      pl.text.split(/\s+/).length > 12 && 
      !groupedQuestions.some(gq => gq.questionLine.y === pl.y || gq.optionsLines.some(ol => ol.y === pl.y))
    );
    if (longPassageLines.length >= 3) {
      passageText = longPassageLines.map(l => l.text.trim()).join("\n");
    }
  }

  // 4. Nhận diện loại bố cục tài liệu (Layout Detection Logic)
  let layoutType: DocumentLayoutType = "general";
  let confidence = 50;

  // Tính tổng số lượng từ nhận dạng được
  const totalWords = ocrResult.text.split(/\s+/).length;

  // Thuật toán Heuristic phân biệt:
  if (lines.length <= 3 && totalWords < 30) {
    // Bố cục Subtitle: Ít dòng, chữ ngắn
    layoutType = "subtitle";
    confidence = 80;
  } else if (ocrResult.text.toLowerCase().includes("pronunciation:") || ocrResult.text.toLowerCase().includes("synonyms:") || ocrResult.text.toLowerCase().includes("definition:")) {
    // Bố cục Vocab Card: Chứa các keyword học từ vựng
    layoutType = "vocab_card";
    confidence = 90;
  } else if (groupedQuestions.length > 0) {
    if (passageText.length > 100) {
      // Có bài đọc dài đi kèm câu hỏi
      if (groupedQuestions.some(gq => gq.hasBlank) || BLANK_REGEX.test(passageText)) {
        // Bài đọc có chứa chỗ trống điền từ (TOEIC Part 6)
        layoutType = "toeic_part6";
        confidence = 85;
      } else {
        // Bài đọc hiểu thông thường (TOEIC Part 7 / IELTS Reading)
        layoutType = "reading_set";
        confidence = 95;
      }
    } else {
      // Không có bài đọc đi kèm, chỉ có câu hỏi
      layoutType = "toeic_part5";
      confidence = 90;
    }
  } else {
    // Không nhận diện được cấu trúc câu hỏi đặc trưng
    layoutType = "general";
    confidence = 60;
  }

  return {
    layoutType,
    confidence,
    passageText: passageText.trim() || undefined,
    groupedQuestions
  };
}
