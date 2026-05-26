/**
 * ============================================
 * 📁 src/services/documentParser.ts
 * ============================================
 *
 * MỤC ĐÍCH:
 * Bộ điều phối pipeline Exam Document Understanding Engine.
 * Nhận ảnh → OCR → phân tích bố cục → nhóm câu hỏi → ExamDocument có cấu trúc.
 *
 * PIPELINE:
 * Image → Tesseract (words+bboxes) → BlankDetector → ColumnSegmenter
 *   → QuestionGrouper → ExamDocument
 *
 * KHÔNG trộn lẫn OCR text thô vào Google Translate ngay lập tức.
 * Dữ liệu được cấu trúc hóa TRƯỚC, AI/dịch thuật chạy SAU.
 * ============================================
 */

import { createWorker } from "tesseract.js";
import { invoke } from "@tauri-apps/api/core";
import type { ExamDocument } from "../types";
import { preprocessImageForOCR } from "./imageProcessor";
import { segmentColumns, type RawLine } from "./columnSegmenter";
import { groupQuestionsFromRegions } from "./questionGrouper";
import { detectBlanksInText } from "./blankDetector";

const log = async (msg: string) => {
  console.log(msg);
  try {
    await invoke("write_debug_log", {
      message: `[${new Date().toISOString()}] [DocumentParser] ${msg}`,
    });
  } catch (_) {}
};

/**
 * parseExamDocument - Phân tích ảnh OCR và trả về ExamDocument có cấu trúc.
 *
 * @param imageData - Ảnh dạng Base64 (data:image/png;base64,...)
 * @returns ExamDocument với passage, questions, và rawText
 */
export async function parseExamDocument(imageData: string): Promise<ExamDocument> {
  await log("Starting parseExamDocument...");

  // ── Step 1: Tiền xử lý ảnh ──────────────────────────────────────────────
  await log("Step 1: Preprocessing image...");
  const processedImage = await preprocessImageForOCR(imageData);

  // Lưu debug images
  try {
    await invoke("save_debug_image", { name: "ocr_raw.png", base64Data: imageData });
    await invoke("save_debug_image", { name: "ocr_processed.png", base64Data: processedImage });
  } catch (_) {}

  // ── Step 2: Tesseract OCR lấy words + bboxes ─────────────────────────────
  await log("Step 2: Running Tesseract OCR...");
  let worker: Awaited<ReturnType<typeof createWorker>> | null = null;
  let resultData: any;

  try {
    worker = await createWorker("eng", 1, {
      logger: (m) => log(`[Tesseract] ${m.status}: ${Math.round(m.progress * 100)}%`),
    });

    const result = await worker.recognize(processedImage, {}, { blocks: true });
    resultData = result.data;
    await log(`Tesseract done. Confidence: ${resultData.confidence}%. Text length: ${resultData.text?.length}`);
  } catch (err) {
    await log(`Tesseract failed: ${err}`);
    throw err;
  } finally {
    if (worker) {
      try { await worker.terminate(); } catch (_) {}
    }
  }

  const rawText = detectBlanksInText(resultData.text || "");

  // ── Step 3: Trích xuất RawLines từ blocks Tesseract ──────────────────────
  await log("Step 3: Extracting raw lines from Tesseract blocks...");
  const rawLines: RawLine[] = [];

  const blocks = resultData.blocks || [];
  for (const block of blocks) {
    for (const para of block.paragraphs || []) {
      for (const line of para.lines || []) {
        if (!line.words || line.words.length === 0) continue;

        const words = (line.words as any[]).map((w: any) => ({
          text: w.text || "",
          confidence: w.confidence || 0,
          bbox: {
            x: w.bbox.x0,
            y: w.bbox.y0,
            width: w.bbox.x1 - w.bbox.x0,
            height: w.bbox.y1 - w.bbox.y0,
          },
        }));

        // Sắp xếp các từ từ trái qua phải đề phòng Tesseract trả về không thứ tự
        words.sort((a, b) => a.bbox.x - b.bbox.x);

        // Tìm các điểm phân tách nếu khoảng cách ngang giữa các từ quá lớn (thường do gộp cột lỗi)
        const segments: typeof words[] = [];
        let currentSegment: typeof words = [];

        for (let i = 0; i < words.length; i++) {
          const w = words[i];
          if (currentSegment.length > 0) {
            const prevW = currentSegment[currentSegment.length - 1];
            const gap = w.bbox.x - (prevW.bbox.x + prevW.bbox.width);
            const gapThreshold = Math.max(100, prevW.bbox.height * 2.5);

            if (gap >= gapThreshold) {
              segments.push(currentSegment);
              currentSegment = [];
            }
          }
          currentSegment.push(w);
        }
        if (currentSegment.length > 0) {
          segments.push(currentSegment);
        }

        // Tạo RawLine riêng biệt cho mỗi phân đoạn được chia cột
        for (const segment of segments) {
          const firstWord = segment[0];
          const lastWord = segment[segment.length - 1];
          const segmentX0 = firstWord.bbox.x;
          const segmentX1 = lastWord.bbox.x + lastWord.bbox.width;
          const segmentY = Math.min(...segment.map((w) => w.bbox.y));
          const segmentMaxY = Math.max(...segment.map((w) => w.bbox.y + w.bbox.height));
          const segmentText = segment.map((w) => w.text).join(" ");
          const avgConfidence = segment.reduce((sum, w) => sum + w.confidence, 0) / segment.length;

          rawLines.push({
            text: segmentText,
            x: segmentX0,
            y: segmentY,
            width: segmentX1 - segmentX0,
            height: segmentMaxY - segmentY,
            confidence: avgConfidence,
            words: segment,
            x0: segmentX0,
            x1: segmentX1,
          });
        }
      }
    }
  }
  await log(`Extracted ${rawLines.length} raw lines.`);

  // ── Step 4: Phân tách cột (ColumnSegmenter) ───────────────────────────────
  await log("Step 4: Segmenting columns...");
  const regions = segmentColumns(rawLines);
  await log(`Column segmentation: ${regions.length} regions found.`);

  // ── Step 5: Nhóm câu hỏi (QuestionGrouper) ───────────────────────────────
  await log("Step 5: Grouping questions and passage...");
  const { passage, questions } = groupQuestionsFromRegions(regions);
  await log(`Grouping done. Passage: ${passage ? "YES" : "NO"}. Questions: ${questions.length}.`);

  // ── Step 6: Xác định loại tài liệu ───────────────────────────────────────
  let documentType: ExamDocument["documentType"] = "general";

  if (questions.length > 0) {
    const hasBlankQuestions = questions.some((q) => q.hasBlank);
    const hasPassage = !!passage && passage.cleanText.length > 80;

    if (hasPassage && hasBlankQuestions) {
      documentType = "toeic_part6";
    } else if (hasPassage) {
      documentType = "toeic_part7";
    } else if (hasBlankQuestions) {
      documentType = "toeic_part5";
    } else {
      documentType = "toeic_part5";
    }
  }

  await log(`Document type determined: ${documentType}. Questions: ${questions.length}.`);

  return {
    documentType,
    passage,
    questions,
    rawText,
  };
}
