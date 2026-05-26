/**
 * ============================================
 * 📁 src/types/index.ts
 * ============================================
 *
 * MỤC ĐÍCH:
 * Định nghĩa tất cả TypeScript interfaces/types
 * dùng chung trong toàn bộ ứng dụng.
 *
 * TẠI SAO CẦN FILE NÀY?
 * - TypeScript cần biết "hình dạng" của dữ liệu
 * - Giúp IDE gợi ý code tốt hơn (autocomplete)
 * - Phát hiện lỗi ngay khi viết code, không phải lúc chạy
 * - Là "hợp đồng" giữa các module: translation service
 *   trả về gì, popup nhận cái gì → rõ ràng
 *
 * NGUYÊN TẮC:
 * - Mỗi interface đại diện cho 1 "khái niệm" dữ liệu
 * - Đặt tên rõ ràng, có ý nghĩa
 * - Export tất cả để các file khác import
 * ============================================
 */

// ============================================
// TRANSLATION TYPES
// ============================================

/**
 * TranslationResult - Kết quả dịch thuật
 *
 * Khi user dịch 1 đoạn text, service sẽ trả về
 * object có cấu trúc này. Popup sẽ dùng data này
 * để hiển thị.
 *
 * Theo ARCHITECTURE.md - Popup Layout:
 * ┌────────────────────┐
 * │ Original Text      │ → originalText
 * │ Translation        │ → translatedText
 * │ Pronunciation      │ → pronunciation (future)
 * └────────────────────┘
 */
export interface TranslationResult {
  /** Text gốc mà user chọn */
  originalText: string;

  /** Bản dịch */
  translatedText: string;

  /** Ngôn ngữ nguồn (tự detect hoặc user chọn) */
  sourceLanguage: string;

  /** Ngôn ngữ đích */
  targetLanguage: string;

  /** Phiên âm IPA (future feature) */
  pronunciation?: string;

  /** Timestamp khi dịch */
  timestamp: number;
}

// ============================================
// OCR TYPES
// ============================================

/**
 * OCRResult - Kết quả nhận dạng chữ từ ảnh
 *
 * Khi user chọn vùng màn hình, OCR engine sẽ
 * "đọc" text từ ảnh và trả về object này.
 *
 * Theo ARCHITECTURE.md - OCR Service:
 * - image preprocessing
 * - OCR recognition
 * - text cleanup
 */
export interface OCRWordBox {
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
  confidence: number;
}

export interface OCRLineBox {
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
  confidence: number;
  words: OCRWordBox[];
  lineIndex: number;
  regionIndex: number;
}

export interface OCRRegionBox {
  regionIndex: number;
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
  lines: OCRLineBox[];
}

/**
 * OCRResult - Kết quả nhận dạng chữ từ ảnh với đầy đủ vị trí hình học
 */
export interface OCRResult {
  /** Text được nhận dạng từ ảnh */
  text: string;

  /** Độ chính xác (0-100) */
  confidence: number;

  /** Ngôn ngữ phát hiện được */
  detectedLanguage?: string;

  /** Danh sách các từ có vị trí */
  words?: OCRWordBox[];

  /** Danh sách các dòng có vị trí */
  lines?: OCRLineBox[];

  /** Danh sách các vùng/cột văn bản */
  regions?: OCRRegionBox[];

  /** Thông tin phân tích bố cục tài liệu (legacy) */
  layoutInfo?: DocumentLayoutInfo;

  /** Danh sách các câu hỏi đã được chuẩn hóa cấu trúc hình học (legacy) */
  structuredQuestions?: StructuredQuestion[];

  /**
   * ExamDocument — Kết quả của Exam Document Understanding Engine (v2).
   * Đây là dữ liệu đầu vào chính cho AI Solver.
   * Được nhúng tại đây để tương thích ngược với OCRResult.
   */
  examDocument?: ExamDocument;
}

export interface StructuredQuestion {
  questionNumber: string;
  questionText: string;
  options: string[];
  blankPosition: number | null;
  passageContext: string | null;
}

export type DocumentLayoutType = 
  | "toeic_part5"
  | "toeic_part6"
  | "reading_set"
  | "subtitle"
  | "vocab_card"
  | "general";

export interface GroupedQuestion {
  questionNumber: string;
  questionText: string;
  questionLine: OCRLineBox;
  optionsLines: OCRLineBox[];
  hasBlank: boolean;
}

export interface DocumentLayoutInfo {
  layoutType: DocumentLayoutType;
  confidence: number;
  passageText?: string;
  groupedQuestions: GroupedQuestion[];
}

/**
 * ScreenRegion - Vùng màn hình user chọn
 *
 * Khi user kéo chuột chọn vùng trên overlay,
 * ta cần lưu tọa độ để chụp screenshot đúng chỗ.
 */
export interface ScreenRegion {
  /** Tọa độ góc trên-trái */
  x: number;
  y: number;

  /** Kích thước vùng chọn */
  width: number;
  height: number;
}

// ============================================
// APP STATE TYPES
// ============================================

/**
 * TranslationMode - Chế độ dịch
 *
 * App hỗ trợ 2 chế độ chính:
 * - 'text': Dịch text đã chọn (Ctrl+Q)
 * - 'ocr': Dịch từ ảnh/màn hình (Ctrl+Shift+Q)
 */
export type TranslationMode = "text" | "ocr";

/**
 * AppStatus - Trạng thái hiện tại của app
 *
 * Dùng để UI biết nên hiển thị gì:
 * - idle: không làm gì, ẩn popup
 * - loading: đang xử lý, hiện spinner
 * - success: có kết quả, hiện popup
 * - error: có lỗi, hiện thông báo lỗi
 */
export type AppStatus = "idle" | "loading" | "success" | "error";

/**
 * Theme - Chủ đề giao diện
 *
 * Hiện tại chỉ có dark (theo UI_GUIDELINES).
 * Để sẵn 'light' và 'system' cho future.
 */
export type Theme = "dark" | "light" | "system";

/**
 * PopupPosition - Vị trí popup trên màn hình
 *
 * Popup xuất hiện gần con trỏ chuột.
 * Theo UI_GUIDELINES: "appear near cursor"
 */
export interface PopupPosition {
  x: number;
  y: number;
}

/**
 * AppSettings - Cài đặt ứng dụng
 *
 * Lưu trữ các tùy chọn của người dùng.
 * Future: sẽ có settings panel (04_FEATURE_LIST.md)
 */
export interface AppSettings {
  /** Theme hiện tại */
  theme: Theme;

  /** Ngôn ngữ đích mặc định */
  targetLanguage: string;

  /** Hiển thị phiên âm không */
  showPronunciation: boolean;

  /** Thời gian tự động ẩn popup (ms) */
  autoHideDelay: number;

  /** Phím tắt dịch text */
  hotkeyTranslate: string;

  /** Phím tắt OCR */
  hotkeyOCR: string;

  /** Tự động chạy khi khởi động Windows */
  showOnStartup: boolean;

  /** Ẩn xuống khay hệ thống khi đóng cửa sổ thay vì thoát app */
  minimizeToTray: boolean;

  /** Tự động mở rộng AI panel khi dịch 1 từ đơn lẻ */
  autoExpandAIForWords: boolean;
}

/**
 * HotkeyEvent - Sự kiện phím tắt
 *
 * Khi Tauri backend bắt được phím tắt global,
 * nó gửi event này sang React frontend.
 *
 * Theo ARCHITECTURE.md - Rust → React:
 * "hotkey events"
 */
export interface HotkeyEvent {
  /** Loại phím tắt được nhấn */
  mode: TranslationMode;

  /** Thời điểm nhấn */
  timestamp: number;
}

// ============================================
// HISTORY TYPES
// ============================================

/**
 * HistoryItem - Định nghĩa cấu trúc dữ liệu cho một mục lịch sử dịch thuật
 * Thiết kế cho Phase 5 và chuẩn bị cho các tính năng học tập AI trong tương lai.
 */
export interface HistoryItem {
  /** ID duy nhất cho mỗi mục lịch sử */
  id: string;

  /** Đoạn văn bản gốc cần dịch */
  originalText: string;

  /** Bản dịch kết quả nhận được */
  translatedText: string;

  /** Chế độ dịch thuật đã sử dụng ('text' hoặc 'ocr') */
  type: TranslationMode;

  /** Thời điểm thực hiện dịch (milliseconds) */
  timestamp: number;

  /** Ngôn ngữ nguồn (ví dụ: 'en') */
  sourceLanguage: string;

  /** Ngôn ngữ đích (ví dụ: 'vi') */
  targetLanguage: string;
}

// ============================================
// AI LEARNING TYPES
// ============================================

/**
 * VocabularyItem - Định nghĩa cấu trúc của một từ vựng được AI bóc tách giải thích
 */
export interface VocabularyItem {
  /** Từ vựng gốc */
  word: string;

  /** Từ loại (Noun, Verb, Adjective, etc.) */
  partOfSpeech: string;

  /** Nghĩa tiếng Việt */
  meaning: string;
}

/**
 * ExampleSentence - Định nghĩa cấu trúc câu ví dụ mẫu của AI
 */
export interface ExampleSentence {
  /** Câu ví dụ tiếng Anh gốc */
  original: string;

  /** Bản dịch tiếng Việt tương ứng */
  translated: string;
}

export interface ReadingQuestion {
  questionNumber: string;
  questionText: string;
  options: string[];
  correctAnswer: string;
  whyCorrect: string;
  whyOthersWrong: string;
  grammarInsight: string;
  collocationInsight?: string;
  translation: string;
}

/**
 * AILearningResult - Kết quả phân tích học tập từ AI Assistant
 */
export interface AILearningResult {
  /** Phiên âm IPA của từ/câu */
  ipaPronunciation?: string;

  /** Bóc tách và giải thích các điểm ngữ pháp chính */
  grammarBreakdown?: string[];

  /** Giải thích các từ vựng cốt lõi xuất hiện trong câu */
  vocabularyExplanation?: VocabularyItem[];

  /** Các câu ví dụ sinh động áp dụng cấu trúc tương tự */
  exampleUsage?: ExampleSentence[];

  /** Giải thích ngữ cảnh dịch hoặc sắc thái văn phong câu viết */
  contextualExplanation?: string;

  /** Xác định xem có phải là cụm bài đọc (TOEIC Part 6/7, IELTS Reading) gồm nhiều câu hỏi hay không */
  isReadingSet?: boolean;

  /** Nội dung đoạn văn/bài đọc chính */
  passageText?: string;


  /** Danh sách các câu hỏi đi kèm bài đọc */
  readingQuestions?: ReadingQuestion[];
}

// ============================================
// EXAM DOCUMENT UNDERSTANDING ENGINE TYPES
// ============================================

/**
 * WordToken - A word recognized by Tesseract with its bounding box and confidence.
 */
export interface WordToken {
  type: "word";
  text: string;
  confidence: number;
  bbox: { x: number; y: number; width: number; height: number };
}

/**
 * BlankToken - A structured placeholder for a fill-in-the-blank slot.
 * Blanks are NEVER translated or treated as normal text.
 */
export interface BlankToken {
  type: "blank";
  pixelX: number;
  pixelWidth: number;
  inferredLength: "short" | "medium" | "long";
}

/** Union of all token types in a reconstructed line */
export type Token = WordToken | BlankToken;

/**
 * ReconstructedLine - A single line of text with blanks preserved as structured objects.
 * cleanText replaces blanks with "______" for human-readable display.
 */
export interface ReconstructedLine {
  tokens: Token[];
  cleanText: string;
  y: number;
  height: number;
}

/**
 * AnswerOption - A single multiple-choice option (A, B, C, or D).
 */
export interface AnswerOption {
  label: "A" | "B" | "C" | "D";
  text: string;
}

/**
 * PassageBlock - The reading passage region of an exam document.
 */
export interface PassageBlock {
  lines: ReconstructedLine[];
  cleanText: string;
}

/**
 * QuestionBlock - A single question with its stem, options, and metadata.
 */
export interface QuestionBlock {
  number: string;
  stem: ReconstructedLine;
  options: AnswerOption[];
  hasBlank: boolean;
}

/**
 * ExamDocument - The fully structured output of the Exam Document Understanding Engine.
 * This is the primary input to the AI solver.
 */
export interface ExamDocument {
  documentType: "toeic_part5" | "toeic_part6" | "toeic_part7" | "ielts_reading" | "general";
  passage?: PassageBlock;
  questions: QuestionBlock[];
  /** Preserved raw OCR text for fallback/debug */
  rawText: string;
}
