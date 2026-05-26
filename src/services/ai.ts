/**
 * ============================================
 * 📁 src/services/ai.ts
 * ============================================
 *
 * MỤC ĐÍCH:
 * Service phân tích học tập bằng AI (Gemini).
 * Nhận ExamDocument (đã cấu trúc hóa) → Giải câu hỏi → AILearningResult.
 *
 * V2 CHANGES:
 * - Ưu tiên ExamDocument làm đầu vào (không dùng raw OCR text nữa)
 * - Schema khóa correctAnswer thành enum ["A","B","C","D"] — chống hallucinate
 * - Post-processing validation: kiểm tra đáp án trả về có hợp lệ không
 * - Gemini dịch passage text (tích hợp trong 1 lần gọi) — không qua Google Translate
 * ============================================
 */

import type { AILearningResult, OCRResult, TranslationResult, ExamDocument, QuestionBlock, AnswerOption } from "../types";

const GEMINI_API_KEY = (import.meta.env.VITE_GEMINI_API_KEY as string) || "";
const MODEL_NAME = "gemini-2.5-flash";

// ─── Prompt builders ──────────────────────────────────────────────────────────

function buildExamSystemPrompt(): string {
  return `You are a professional AI English learning tutor specialized in TOEIC and IELTS exam analysis.

CRITICAL HALLUCINATION PREVENTION RULES:
1. ONLY solve and explain the questions explicitly listed in the input JSON. Do NOT invent new questions.
2. For each question, the "correctAnswer" MUST be EXACTLY one of: "A", "B", "C", or "D".
   - Do NOT put the option text as correctAnswer. Only the single letter.
   - Only choose from the "options" array provided. Do NOT invent option values.
3. Keep explanations educational, concise, and professional.
4. If a question has a blank ("______"), the answer fills that blank.
5. For the passage:
   - Provide a clean, natural Vietnamese translation in "passageTranslation".
   - In the passage text, any ALL-CAPS token with NO vowels (e.g. "TTR", "FTTRG", "HB", "FTN") is an OCR artifact from a blank line. Replace it with "______" in your translation and in "passageText".
   - Preserve real blanks "______" as-is.

Output strictly conforms to the provided JSON schema.`;
}

function buildExamQueryText(exam: ExamDocument): string {
  const lines: string[] = [];

  if (exam.passage) {
    lines.push("READING PASSAGE:");
    lines.push(`"""\n${exam.passage.cleanText}\n"""`);
    lines.push("");
  }

  lines.push("QUESTIONS TO SOLVE:");
  lines.push(JSON.stringify(
    exam.questions.map((q: QuestionBlock) => ({
      questionNumber: q.number,
      questionText: q.stem.cleanText,
      options: q.options.map((o: AnswerOption) => ({ label: o.label, text: o.text })),
      hasBlank: q.hasBlank,
    })),
    null, 2
  ));

  return lines.join("\n");
}

function buildGeneralSystemPrompt(targetLang: string): string {
  return `You are a professional AI English learning assistant specialized in TOEIC, IELTS, grammar analysis.
Analyze the input English text, which may contain OCR artifacts.

Detect if this is a Reading Set (passage + multiple choice questions):
- If YES: set isReadingSet=true, extract passageText, parse readingQuestions with correctAnswer as single letter A/B/C/D only.
- If NO: set isReadingSet=false, fill ipaPronunciation, grammarBreakdown, vocabularyExplanation, exampleUsage, contextualExplanation.

Provide analysis in ${targetLang === "vi" ? "Vietnamese" : "English"}.
Response MUST strictly follow the provided JSON schema.`;
}

// ─── Schema definitions ───────────────────────────────────────────────────────

const READING_QUESTION_SCHEMA = {
  type: "OBJECT",
  properties: {
    questionNumber: { type: "STRING" },
    questionText: { type: "STRING" },
    options: {
      type: "ARRAY",
      items: { type: "STRING" },
    },
    correctAnswer: {
      type: "STRING",
      enum: ["A", "B", "C", "D"],
    },
    whyCorrect: { type: "STRING" },
    whyOthersWrong: { type: "STRING" },
    grammarInsight: { type: "STRING" },
    collocationInsight: { type: "STRING" },
    translation: { type: "STRING" },
  },
  required: [
    "questionNumber", "questionText", "options",
    "correctAnswer", "whyCorrect", "whyOthersWrong",
    "grammarInsight", "collocationInsight", "translation",
  ],
};

const FULL_RESPONSE_SCHEMA = {
  type: "OBJECT",
  properties: {
    isReadingSet: { type: "BOOLEAN" },
    passageText: { type: "STRING" },
    passageTranslation: { type: "STRING" },
    readingQuestions: { type: "ARRAY", items: READING_QUESTION_SCHEMA },
    ipaPronunciation: { type: "STRING" },
    grammarBreakdown: { type: "ARRAY", items: { type: "STRING" } },
    vocabularyExplanation: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          word: { type: "STRING" },
          partOfSpeech: { type: "STRING" },
          meaning: { type: "STRING" },
        },
        required: ["word", "partOfSpeech", "meaning"],
      },
    },
    exampleUsage: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          original: { type: "STRING" },
          translated: { type: "STRING" },
        },
        required: ["original", "translated"],
      },
    },
    contextualExplanation: { type: "STRING" },
  },
  required: ["isReadingSet"],
};

// ─── Post-processing validation ───────────────────────────────────────────────

function validateAndFixResult(
  result: AILearningResult,
  exam?: ExamDocument
): AILearningResult {
  if (!result.readingQuestions || !exam) return result;

  const validLetters = new Set(["A", "B", "C", "D"]);

  result.readingQuestions = result.readingQuestions.map((rq, idx) => {
    // Validate correctAnswer is a valid letter
    if (!validLetters.has(rq.correctAnswer)) {
      console.warn(
        `[AI Service] Question ${rq.questionNumber}: invalid correctAnswer "${rq.correctAnswer}", clearing.`
      );
      rq.correctAnswer = "";
    }

    // Restore options from ExamDocument if AI mangled them
    const origQ = exam.questions[idx];
    if (origQ && origQ.options.length > 0) {
      rq.options = origQ.options.map((o) => `${o.label}. ${o.text}`);
    }

    return rq;
  });

  return result;
}

// ─── Main export ──────────────────────────────────────────────────────────────

/**
 * analyzeText - Phân tích văn bản tiếng Anh bằng Gemini AI.
 *
 * Ưu tiên sử dụng ExamDocument (structured input) nếu có.
 * Fallback sang phân tích văn bản phẳng nếu không có cấu trúc.
 *
 * @param text - Văn bản gốc (dùng khi không có ExamDocument)
 * @param targetLang - Ngôn ngữ đích giải thích
 * @param signal - AbortSignal để hủy request
 * @param ocrResult - OCRResult chứa examDocument (nếu có)
 */
export async function analyzeText(
  text: string,
  targetLang: string = "vi",
  signal?: AbortSignal,
  ocrResult?: OCRResult | TranslationResult
): Promise<AILearningResult> {
  const trimmed = text.trim();
  if (!trimmed) {
    throw new Error("Văn bản cần phân tích không được để trống");
  }

  if (!GEMINI_API_KEY) {
    throw new Error(
      "Chưa cấu hình API Key. Vui lòng thêm VITE_GEMINI_API_KEY vào file .env và khởi động lại."
    );
  }

  // ── Xác định luồng xử lý ─────────────────────────────────────────────────
  // Chấp nhận bất kỳ object nào có field examDocument (OCRResult, wrapper từ tooltip, v.v.)
  const exam: import("../types").ExamDocument | undefined =
    ocrResult && typeof ocrResult === "object" && "examDocument" in ocrResult
      ? (ocrResult as any).examDocument
      : undefined;
  const hasExamDocument = !!exam && Array.isArray(exam.questions) && exam.questions.length > 0;

  let systemPrompt: string;
  let queryText: string;

  if (hasExamDocument && exam) {
    // Luồng chính: Structured ExamDocument → AI Solver
    console.log(`[AI Service] Using ExamDocument path. Questions: ${exam.questions.length}`);
    systemPrompt = buildExamSystemPrompt();
    queryText = buildExamQueryText(exam);
  } else {
    // Luồng fallback: văn bản phẳng → phân tích chung
    console.log("[AI Service] Using general text analysis path.");
    systemPrompt = buildGeneralSystemPrompt(targetLang);
    queryText = `Analyze this English text: "${trimmed}"`;
  }

  // ── Gọi Gemini API ────────────────────────────────────────────────────────
  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL_NAME}:generateContent?key=${GEMINI_API_KEY}`;

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal,
      body: JSON.stringify({
        contents: [{ parts: [{ text: queryText }] }],
        systemInstruction: { parts: [{ text: systemPrompt }] },
        generationConfig: {
          responseMimeType: "application/json",
          responseSchema: FULL_RESPONSE_SCHEMA,
        },
      }),
    });

    if (!response.ok) {
      throw new Error(`Gemini API returned status ${response.status}`);
    }

    const data = await response.json();
    const rawContent = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!rawContent) {
      throw new Error("Invalid response format from Gemini API");
    }

    const result = JSON.parse(rawContent) as AILearningResult;

    // ── Hậu xử lý: ép is​ReadingSet, validate correctAnswer ─────────────────
    if (hasExamDocument && exam) {
      result.isReadingSet = true;

      // Điền passageText từ ExamDocument nếu Gemini không trả về
      if (!result.passageText && exam.passage) {
        result.passageText = exam.passage.cleanText;
      }

      // Validate và sửa đáp án
      validateAndFixResult(result, exam);
    }

    return result;
  } catch (error: any) {
    if (error instanceof DOMException && error.name === "AbortError") {
      console.log("[AI Service] Gemini Request aborted.");
      throw error;
    }
    console.error("[AI Service] Gemini API error:", error);
    throw new Error(
      error?.message ||
      "Đã xảy ra lỗi khi gọi Gemini API. Kiểm tra kết nối mạng hoặc API Key."
    );
  }
}
