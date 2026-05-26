/**
 * ============================================
 * 📁 src/services/questionGrouper.ts
 * ============================================
 *
 * MỤC ĐÍCH:
 * Phân loại và nhóm các dòng OCR thành PassageBlock và QuestionBlock[].
 * Đây là "bộ não" của Exam Document Understanding Engine.
 *
 * PHÂN LOẠI DÒNG:
 * QUESTION_STEM   → /^\s*(\d{2,3})\s*[.)]/   (e.g. "131.")
 * OPTION_LINE     → /^[(\[]?[A-D][.)]/        (e.g. "(A) and")
 * MULTI_OPTION    → dòng chứa ≥2 ký hiệu [A-D] (đáp án cùng hàng)
 * PASSAGE_LINE    → Không khớp trên, >10 từ
 * SHORT_NOISE     → <3 từ, không có ký hiệu câu hỏi/đáp án
 *
 * LOGIC NHÓM:
 * 1. Quét dòng từ trên xuống dưới trong mỗi vùng cột
 * 2. QUESTION_STEM → mở QuestionBlock mới
 * 3. OPTION_LINE sau QUESTION_STEM → gán vào options của QuestionBlock hiện tại
 * 4. PASSAGE_LINE trước QUESTION_STEM đầu tiên → gán vào PassageBlock
 * 5. QUESTION_STEM tiếp theo → đóng QuestionBlock cũ, mở QuestionBlock mới
 * ============================================
 */

import type { OCRLineBox, OCRRegionBox, PassageBlock, QuestionBlock, AnswerOption, ReconstructedLine, Token } from "../types";
import { convertWordToToken, buildCleanText, detectBlanksInText } from "./blankDetector";

// ─── Regex patterns ───────────────────────────────────────────────────────────
const QUESTION_STEM_REGEX = /^\s*(\d{2,3})\s*[.)]/;
const OPTION_LINE_REGEX = /^\s*[(\[]?\s*([A-D])\s*[.)]\s*(.+)/i;
// Dòng chứa ≥2 cụm [A-D] option trên cùng 1 dòng (e.g. "(A) and (B) furthermore (C) so that")
const MULTI_OPTION_REGEX = /[(\[]?\s*([A-D])\s*[.)]\s*([^(\[A-D]*)/gi;
const BLANK_REGEX = /_{3,}|\.{4,}|[-—]{3,}/;

// ─── Helper: classify a single line ──────────────────────────────────────────
type LineType = "QUESTION_STEM" | "OPTION_LINE" | "MULTI_OPTION" | "PASSAGE_LINE" | "SHORT_NOISE";

interface ClassifiedLine {
  type: LineType;
  line: OCRLineBox;
  questionNumber?: string;
  optionLabel?: "A" | "B" | "C" | "D";
  optionText?: string;
  multiOptions?: AnswerOption[];
}

function classifyLine(line: OCRLineBox): ClassifiedLine {
  const text = line.text.trim();
  const wordCount = text.split(/\s+/).filter(Boolean).length;

  // 1. QUESTION_STEM
  const qMatch = text.match(QUESTION_STEM_REGEX);
  if (qMatch) {
    return { type: "QUESTION_STEM", line, questionNumber: qMatch[1] };
  }

  // 2. MULTI_OPTION: ≥2 đáp án trên cùng 1 dòng
  const multiMatches: AnswerOption[] = [];
  let mMatch: RegExpExecArray | null;
  MULTI_OPTION_REGEX.lastIndex = 0;
  while ((mMatch = MULTI_OPTION_REGEX.exec(text)) !== null) {
    const label = mMatch[1].toUpperCase() as "A" | "B" | "C" | "D";
    const optText = mMatch[2].trim().replace(/[,;]\s*$/, "");
    if (optText) multiMatches.push({ label, text: optText });
  }
  if (multiMatches.length >= 2) {
    return { type: "MULTI_OPTION", line, multiOptions: multiMatches };
  }

  // 3. OPTION_LINE: 1 đáp án trên dòng
  const oMatch = text.match(OPTION_LINE_REGEX);
  if (oMatch) {
    return {
      type: "OPTION_LINE",
      line,
      optionLabel: oMatch[1].toUpperCase() as "A" | "B" | "C" | "D",
      optionText: oMatch[2].trim(),
    };
  }

  // 4. SHORT_NOISE
  if (wordCount < 3) {
    return { type: "SHORT_NOISE", line };
  }

  // 5. PASSAGE_LINE (default)
  return { type: "PASSAGE_LINE", line };
}

// ─── Helper: build a ReconstructedLine from OCRLineBox ────────────────────────
function buildReconstructedLine(line: OCRLineBox): ReconstructedLine {
  let tokens: Token[];

  if (line.words && line.words.length > 0) {
    tokens = line.words.map((w) =>
      convertWordToToken({
        text: w.text,
        confidence: w.confidence,
        bbox: { x: w.x, y: w.y, width: w.width, height: w.height },
      })
    );
  } else {
    // Fallback: không có words → tạo 1 WordToken duy nhất từ text dòng
    // Áp dụng detectBlanksInText để chuẩn hóa blanks trong chuỗi
    const normalized = detectBlanksInText(line.text);
    tokens = normalized.split(/(\s+)/).filter(Boolean).map((part): Token => {
      if (part.trim() === "______") {
        return {
          type: "blank",
          pixelX: line.x,
          pixelWidth: 80,
          inferredLength: "medium",
        };
      }
      return {
        type: "word",
        text: part,
        confidence: line.confidence,
        bbox: { x: line.x, y: line.y, width: line.width, height: line.height },
      };
    });
  }

  return {
    tokens,
    cleanText: buildCleanText(tokens),
    y: line.y,
    height: line.height,
  };
}

// ─── Helper: merge consecutive passage lines into coherent paragraphs ─────────
function mergePassageLines(lines: OCRLineBox[]): ReconstructedLine[] {
  // Sort by Y coordinate (top to bottom)
  const sorted = [...lines].sort((a, b) => a.y - b.y);

  // Calculate average line height to detect paragraph breaks
  const heights = sorted.map((l) => l.height).filter((h) => h > 0);
  const avgHeight = heights.length > 0
    ? heights.reduce((a, b) => a + b, 0) / heights.length
    : 20;
  const PARA_GAP_THRESHOLD = avgHeight * 1.5;

  const merged: ReconstructedLine[] = [];
  let currentGroup: OCRLineBox[] = [];

  for (let i = 0; i < sorted.length; i++) {
    const line = sorted[i];
    const prev = sorted[i - 1];

    const isNewParagraph = prev && (line.y - (prev.y + prev.height)) > PARA_GAP_THRESHOLD;

    if (isNewParagraph && currentGroup.length > 0) {
      // Flush current group as a single ReconstructedLine
      const combinedText = currentGroup.map((l) => l.text.trim()).join(" ");
      const combinedWords = currentGroup.flatMap((l) => l.words || []);
      const groupLine: OCRLineBox = {
        ...currentGroup[0],
        text: combinedText,
        words: combinedWords,
        height: (currentGroup[currentGroup.length - 1].y + currentGroup[currentGroup.length - 1].height) - currentGroup[0].y,
      };
      merged.push(buildReconstructedLine(groupLine));
      currentGroup = [];
    }

    currentGroup.push(line);
  }

  // Flush last group
  if (currentGroup.length > 0) {
    const combinedText = currentGroup.map((l) => l.text.trim()).join(" ");
    const combinedWords = currentGroup.flatMap((l) => l.words || []);
    const groupLine: OCRLineBox = {
      ...currentGroup[0],
      text: combinedText,
      words: combinedWords,
      height: (currentGroup[currentGroup.length - 1].y + currentGroup[currentGroup.length - 1].height) - currentGroup[0].y,
    };
    merged.push(buildReconstructedLine(groupLine));
  }

  return merged;
}

// ─── Main export ──────────────────────────────────────────────────────────────

export interface GroupedExamContent {
  passage?: PassageBlock;
  questions: QuestionBlock[];
}

/**
 * groupQuestionsFromRegions - Phân tích các vùng OCR và nhóm thành cấu trúc PassageBlock + QuestionBlock[].
 *
 * @param regions - Danh sách các vùng OCR đã được phân tách cột
 * @returns Nội dung bài thi đã được cấu trúc hóa
 */
export function groupQuestionsFromRegions(regions: OCRRegionBox[]): GroupedExamContent {
  const passageLines: OCRLineBox[] = [];
  const questions: QuestionBlock[] = [];

  // Tập hợp tất cả các dòng từ tất cả các vùng (giữ nguyên thứ tự đọc đã được sắp xếp trong segmentColumns)
  const allLines: OCRLineBox[] = regions.flatMap((r) => r.lines);

  // Sắp xếp lại theo vùng và Y để đảm bảo thứ tự đọc đúng
  allLines.sort((a, b) => {
    if (a.regionIndex !== b.regionIndex) return a.regionIndex - b.regionIndex;
    return a.y - b.y;
  });

  // Phân loại và nhóm từng dòng
  let currentQuestion: {
    number: string;
    stemLine: OCRLineBox;
    optionLines: OCRLineBox[];
    extraStemLines: OCRLineBox[];
  } | null = null;

  let encounteredFirstQuestion = false;

  for (const line of allLines) {
    const classified = classifyLine(line);

    switch (classified.type) {
      case "QUESTION_STEM": {
        // Đóng câu hỏi cũ nếu có
        if (currentQuestion) {
          questions.push(buildQuestionBlock(currentQuestion));
        }
        // Mở câu hỏi mới
        currentQuestion = {
          number: classified.questionNumber!,
          stemLine: line,
          optionLines: [],
          extraStemLines: [],
        };
        encounteredFirstQuestion = true;
        break;
      }

      case "MULTI_OPTION": {
        if (currentQuestion && classified.multiOptions) {
          // Tạo OCRLineBox giả cho từng option từ multi-option
          for (const opt of classified.multiOptions) {
            const fakeLine: OCRLineBox = {
              ...line,
              text: `${opt.label}. ${opt.text}`,
            };
            currentQuestion.optionLines.push(fakeLine);
          }
        } else if (!encounteredFirstQuestion) {
          passageLines.push(line);
        }
        break;
      }

      case "OPTION_LINE": {
        if (currentQuestion) {
          currentQuestion.optionLines.push(line);
        } else if (!encounteredFirstQuestion) {
          passageLines.push(line);
        }
        break;
      }

      case "PASSAGE_LINE":
      case "SHORT_NOISE": {
        if (!encounteredFirstQuestion) {
          if (classified.type === "PASSAGE_LINE") {
            // Trước câu hỏi đầu tiên → passage
            passageLines.push(line);
          }
        } else if (currentQuestion) {
          if (currentQuestion.optionLines.length === 0) {
            if (classified.type === "PASSAGE_LINE") {
              // Sau QUESTION_STEM nhưng trước options → phần phụ của câu hỏi
              currentQuestion.extraStemLines.push(line);
            }
          } else {
            // Đang trong quá trình parse các option, đây là dòng tiếp nối của option trước
            const lastIdx = currentQuestion.optionLines.length - 1;
            currentQuestion.optionLines[lastIdx].text += " " + line.text.trim();
            if (line.words) {
              currentQuestion.optionLines[lastIdx].words = [
                ...(currentQuestion.optionLines[lastIdx].words || []),
                ...line.words,
              ];
            }
          }
        }
        break;
      }
    }
  }

  // Đóng câu hỏi cuối cùng
  if (currentQuestion) {
    questions.push(buildQuestionBlock(currentQuestion));
  }

  // Xây dựng PassageBlock nếu có passage lines
  let passage: PassageBlock | undefined;
  if (passageLines.length > 0) {
    const mergedLines = mergePassageLines(passageLines);
    const cleanText = mergedLines.map((l) => l.cleanText).join("\n\n");
    passage = { lines: mergedLines, cleanText };
  }

  return { passage, questions };
}

/**
 * buildQuestionBlock - Xây dựng QuestionBlock từ dữ liệu đã gom nhóm
 */
function buildQuestionBlock(q: {
  number: string;
  stemLine: OCRLineBox;
  optionLines: OCRLineBox[];
  extraStemLines: OCRLineBox[];
}): QuestionBlock {
  // Kết hợp stem text + extra stem lines thành 1 dòng
  let allStemText = [q.stemLine, ...q.extraStemLines]
    .map((l) => l.text.trim())
    .join(" ");

  // Tạo stemLine tổng hợp
  const combinedStemLine: OCRLineBox = {
    ...q.stemLine,
    text: allStemText,
    words: [...(q.stemLine.words || []), ...q.extraStemLines.flatMap((l) => l.words || [])],
  };

  const optionsMap = new Map<"A" | "B" | "C" | "D", string>();

  // Kiểm tra xem dòng tiêu đề câu hỏi có chứa luôn đáp án A hay không (ví dụ: "131. (A) cash")
  const stemOptionMatch = allStemText.match(/^\s*(\d{2,3})\s*[.)]\s*[(\[]?\s*([A-D])\s*[.)]\s*(.+)/i);
  if (stemOptionMatch) {
    const label = stemOptionMatch[2].toUpperCase() as "A" | "B" | "C" | "D";
    const text = stemOptionMatch[3].trim();
    optionsMap.set(label, text);
    allStemText = `${stemOptionMatch[1]}.`;
    combinedStemLine.text = allStemText;
    if (combinedStemLine.words && combinedStemLine.words.length > 0) {
      // Giữ lại từ đầu tiên đại diện cho số câu hỏi, loại bỏ các từ thuộc option A
      combinedStemLine.words = combinedStemLine.words.slice(0, 1);
      combinedStemLine.words[0].text = allStemText;
    }
  }

  const stem = buildReconstructedLine(combinedStemLine);

  // Parse options A, B, C, D
  for (const optLine of q.optionLines) {
    const text = optLine.text.trim();
    const match = text.match(OPTION_LINE_REGEX);
    if (match) {
      const label = match[1].toUpperCase() as "A" | "B" | "C" | "D";
      const val = match[2].trim().replace(/[,;:]\s*$/, "");
      if (!optionsMap.has(label)) {
        optionsMap.set(label, val);
      }
    }
  }

  const options: AnswerOption[] = (["A", "B", "C", "D"] as const)
    .filter((label) => optionsMap.has(label))
    .map((label) => ({ label, text: optionsMap.get(label)! }));

  const hasBlank = BLANK_REGEX.test(allStemText);

  return {
    number: q.number,
    stem,
    options,
    hasBlank,
  };
}
