/**
 * ============================================
 * 📁 src/components/tooltip/TooltipPopup.tsx
 * ============================================
 *
 * PHASE 2 — Production Tooltip Translation UI
 *
 * DESIGN PRINCIPLES:
 * - Tooltip-first: feels like a native OS tooltip, not a modal card
 * - Progressive disclosure: translation → IPA → AI explanation (on demand)
 * - Adaptive sizing: window resizes dynamically based on content
 * - Minimal visual weight: subtle glass, thin border, soft shadow
 *
 * LAYER ARCHITECTURE:
 * Layer 1 (default): original + translation + compact actions
 * Layer 2 (expand):  + IPA pronunciation + AI grammar/vocabulary
 *
 * INTERACTION:
 * - Auto-hide after 6s (paused on hover or when AI expanded)
 * - ESC to dismiss instantly
 * - Hover pauses auto-hide timer
 * - Click 💡 expands AI panel (lazy loaded, resizes window)
 * ============================================
 */

import { useState, useEffect, useRef, useCallback } from "react";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { PhysicalSize, PhysicalPosition } from "@tauri-apps/api/dpi";
import { invoke } from "@tauri-apps/api/core";
import type { TranslationResult, OCRResult, AILearningResult } from "../../types";
import { writeClipboardText } from "../../services/clipboard";
import { useAIStore } from "../../stores/aiStore";
import { useAppStore } from "../../stores/appStore";

type CombinedTranslationResult = TranslationResult & Partial<OCRResult>;

interface TooltipPayload {
  status: "loading" | "success" | "error";
  result?: CombinedTranslationResult;
  /** ExamDocument riêng biệt để tránh bị truncate khi serialize qua Tauri IPC */
  examDocument?: import("../../types").ExamDocument;
  error?: string;
  cursor?: { x: number; y: number };
}

// Kích thước tooltip
const TOOLTIP_W = 300;
const TOOLTIP_H_COMPACT = 90;
const TOOLTIP_H_EXPANDED = 320;

export function TooltipPopup() {
  const [result, setResult] = useState<CombinedTranslationResult | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isPinned, setIsPinned] = useState(false);
  const [isManualPosition, setIsManualPosition] = useState(false);
  const [ttsState, setTtsState] = useState<"idle" | "normal" | "slow">("idle");
  // Lưu ExamDocument riêng để truyền cho AI solver (tránh mất data qua IPC serialization)
  const [currentExamDoc, setCurrentExamDoc] = useState<import("../../types").ExamDocument | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  // AI store
  const aiStatus = useAIStore((s) => s.status);
  const aiAnalysis = useAIStore((s) => s.analysis);
  const aiError = useAIStore((s) => s.error);
  const fetchAnalysis = useAIStore((s) => s.fetchAnalysis);
  const cancelAnalysis = useAIStore((s) => s.cancelAnalysis);
  const resetAI = useAIStore((s) => s.resetAI);

  const settings = useAppStore((state) => state.settings);

  const logTooltip = async (msg: string) => {
    console.log(msg);
    try {
      await invoke("write_debug_log", { message: `[${new Date().toISOString()}] [TooltipPopup] ${msg}` });
    } catch (err) {}
  };

  // === Position window at cursor ===
  const positionWindowAt = useCallback(async (x: number, y: number, currentWidth: number, currentHeight: number) => {
    try {
      const win = getCurrentWindow();
      const scale = await win.scaleFactor();
      
      const offset = 16;
      const logX = x;
      const logY = y;
      const screenW = window.screen.width;
      const screenH = window.screen.height;

      let posX = logX + offset;
      let posY = logY + offset;

      if (posX + currentWidth > screenW) posX = logX - currentWidth - offset;
      if (posY + currentHeight > screenH) posY = logY - currentHeight - offset;

      posX = Math.max(4, posX);
      posY = Math.max(4, posY);

      const pX = Math.round(posX * scale);
      const pY = Math.round(posY * scale);

      await logTooltip(`positionWindowAt input logX=${logX}, logY=${logY}, cursorX=${x}, cursorY=${y}, scale=${scale}, screenW=${screenW}, screenH=${screenH}, posX=${posX}, posY=${posY}, pX=${pX}, pY=${pY}`);

      // We only position it if it's not pinned and not manually positioned
      // But we will pass the check to the caller.
      await win.setPosition(new PhysicalPosition(pX, pY));
      await logTooltip(`setPosition done`);
      await win.show();
      await logTooltip(`win.show done`);
      await win.setAlwaysOnTop(true);
      await logTooltip(`win.setAlwaysOnTop done`);
      await win.setFocus();
      await logTooltip(`win.setFocus done`);
    } catch (e) {
      await logTooltip(`positionWindowAt failed: ${e}`);
    }
  }, []);

  // === Resize window to fit content ===
  const resizeWindow = useCallback(async (expanded: boolean, text: string = "") => {
    let width = TOOLTIP_W;
    let estimatedHeight = expanded ? TOOLTIP_H_EXPANDED : TOOLTIP_H_COMPACT;

    try {
      const win = getCurrentWindow();
      const scale = await win.scaleFactor();

      if (text) {
        const isSingleWord = !text.includes(" ") && text.length < 20;
        const isLongText = text.length > 60;

        if (isSingleWord) {
          width = 280;
        } else if (isLongText) {
          width = 360;
          estimatedHeight = expanded ? 380 : 250; 
        }
      }

      const size = await win.innerSize();
      // Only set width immediately, leave height to the ResizeObserver
      await win.setSize(new PhysicalSize(
        Math.round(width * scale),
        size.height
      ));
    } catch (e) {
      // Silently fail if not in Tauri context
    }
    
    return { width, height: estimatedHeight };
  }, []);

  // === Dynamic Height ResizeObserver ===
  useEffect(() => {
    if (status !== "idle" && cardRef.current) {
      const observer = new ResizeObserver(async (entries) => {
        for (let entry of entries) {
          // Add 16px for padding/shadow safe area
          const contentHeight = entry.target.getBoundingClientRect().height + 16;
          await logTooltip(`ResizeObserver callback: contentHeight=${contentHeight}`);
          try {
            const win = getCurrentWindow();
            const scale = await win.scaleFactor();
            const size = await win.innerSize();
            const newPhysicalHeight = Math.round(contentHeight * scale);
            await logTooltip(`ResizeObserver: current innerSize=${size.width}x${size.height}, newPhysicalHeight=${newPhysicalHeight}, scale=${scale}`);
            
            // Only update if height actually changes to prevent infinite loops
            if (Math.abs(size.height - newPhysicalHeight) > 2) {
              await logTooltip(`ResizeObserver setting size to ${size.width}x${newPhysicalHeight}`);
              await win.setSize(new PhysicalSize(size.width, newPhysicalHeight));
              await logTooltip(`ResizeObserver setSize done`);
            }
          } catch(e) {
            await logTooltip(`ResizeObserver error: ${e}`);
          }
        }
      });
      observer.observe(cardRef.current);
      return () => observer.disconnect();
    }
  }, [status]);

  // === Hide tooltip ===
  const hideTooltip = useCallback(async () => {
    try {
      const win = getCurrentWindow();
      await win.hide();
    } catch (e) { /* ignore */ }
    setStatus("idle");
    setIsExpanded(false);
    setIsPinned(false);
    setIsManualPosition(false);
    resetAI();
  }, [resetAI]);

  // === Listen for events from main window ===
  useEffect(() => {
    let cancelled = false;
    const setup = async () => {
      return await listen<TooltipPayload>("tooltip-update", async (event) => {
        if (cancelled) return;
        const p = event.payload;
        await logTooltip(`tooltip-update received status=${p.status}, cursor=${JSON.stringify(p.cursor)}, hasResult=${!!p.result}`);
        if (p.status === "loading") {
          setStatus("loading");
          setResult(null);
          setError(null);
          setCurrentExamDoc(null);
          setCopied(false);
          setIsExpanded(false);
          resetAI();
          const { width, height } = await resizeWindow(false);

          // Position window if cursor is provided and not pinned/manual
          if (p.cursor && !isPinned && !isManualPosition) {
            await positionWindowAt(p.cursor.x, p.cursor.y, width, height);
          }
        } else if (p.status === "success" && p.result) {
          setStatus("success");
          setResult(p.result);
          setError(null);

          // Lấy examDocument từ field riêng (top-level trong payload) hoặc từ result nếu có
          const examDoc = p.examDocument ?? (p.result as any).examDocument ?? null;
          setCurrentExamDoc(examDoc);

          const isSingleWord = !p.result.originalText.includes(" ") && p.result.originalText.length < 20;
          const isExamDocument = examDoc && examDoc.questions && examDoc.questions.length > 0;
          let shouldExpand = false;

          if (isExamDocument) {
            // Bài thi có cấu trúc → tự động mở rộng AI panel
            shouldExpand = true;
            setIsExpanded(true);
            // Truyền examDocument qua ocrResult-compatible wrapper để AI solver nhận đúng
            fetchAnalysis(p.result.originalText, "vi", { examDocument: examDoc } as any);
          } else if (isSingleWord && settings.autoExpandAIForWords) {
            shouldExpand = true;
            setIsExpanded(true);
            fetchAnalysis(p.result.originalText, "vi", p.result);
          } else {
            setIsExpanded(false);
          }

          const { width, height } = await resizeWindow(shouldExpand, p.result.originalText);
          
          // Re-position if it's auto-positioned, to account for new size
          if (p.cursor && !isPinned && !isManualPosition) {
            await positionWindowAt(p.cursor.x, p.cursor.y, width, height);
          }

        } else if (p.status === "error") {
          setStatus("error");
          setError(p.error || "Translation failed");
          await logTooltip(`tooltip-update error payload: ${p.error}`);
        }
      });
    };
    const unlistenPromise = setup();
    return () => {
      cancelled = true;
      unlistenPromise.then((fn) => fn());
    };
  }, [resetAI, resizeWindow, positionWindowAt, settings.autoExpandAIForWords, fetchAnalysis, isPinned, isManualPosition]);

  // === Auto-hide timer (paused on hover or when AI expanded or Pinned) ===
  useEffect(() => {
    if (status === "success" && !isHovered && !isExpanded && !isPinned) {
      timerRef.current = setTimeout(() => hideTooltip(), 15000);
      return () => { if (timerRef.current) clearTimeout(timerRef.current); };
    }
  }, [status, isHovered, isExpanded, isPinned, hideTooltip]);

  // === ESC to dismiss ===
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") hideTooltip();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [hideTooltip]);

  // === TTS play logic ===
  const stopTTS = useCallback(() => {
    try {
      if (typeof window !== "undefined" && window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
    } catch (e) {
      console.warn("Speech synthesis cancel failed", e);
    }
    setTtsState("idle");
  }, []);

  // Cancel TTS when tooltip is hidden, starts loading, or text changes
  useEffect(() => {
    stopTTS();
    return () => {
      stopTTS();
    };
  }, [result?.originalText, status, stopTTS]);

  const handlePlayTTS = () => {
    if (!result?.originalText) return;

    try {
      // 1. Cancel active playback
      if (window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }

      // 2. Toggle speed
      let nextSpeed: "normal" | "slow" = "normal";
      if (ttsState === "normal") {
        nextSpeed = "slow";
      } else if (ttsState === "slow") {
        nextSpeed = "normal";
      }

      setTtsState(nextSpeed);

      // 3. Setup utterance
      const utterance = new SpeechSynthesisUtterance(result.originalText);
      const srcLang = result.sourceLanguage?.toLowerCase() || "en";
      
      if (srcLang.startsWith("en")) {
        utterance.lang = "en-US";
      } else if (srcLang.startsWith("vi")) {
        utterance.lang = "vi-VN";
      } else if (srcLang.startsWith("ja")) {
        utterance.lang = "ja-JP";
      } else if (srcLang.startsWith("ko")) {
        utterance.lang = "ko-KR";
      } else if (srcLang.startsWith("zh")) {
        utterance.lang = "zh-CN";
      } else if (srcLang.startsWith("fr")) {
        utterance.lang = "fr-FR";
      } else if (srcLang.startsWith("de")) {
        utterance.lang = "de-DE";
      } else {
        utterance.lang = srcLang;
      }

      utterance.rate = nextSpeed === "slow" ? 0.75 : 1.0;

      utterance.onend = () => {
        setTtsState("idle");
      };
      utterance.onerror = (e) => {
        console.warn("TTS playback error:", e);
        setTtsState("idle");
      };

      window.speechSynthesis.speak(utterance);
    } catch (err) {
      console.error("TTS failed to initialize:", err);
      setTtsState("idle");
    }
  };

  // === Copy ===
  const handleCopy = async () => {
    if (result?.translatedText) {
      await writeClipboardText(result.translatedText);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }
  };

  // === Toggle AI expand ===
  const handleExpand = async () => {
    const next = !isExpanded;
    setIsExpanded(next);
    await resizeWindow(next, result?.originalText);

    if (next && aiStatus === "idle" && result) {
      fetchAnalysis(result.originalText, "vi", currentExamDoc ? { examDocument: currentExamDoc } as any : result);
    } else if (!next) {
      cancelAnalysis();
    }
  };
  // === Dragging window ===
  const handleMouseDown = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    // Prevent dragging if clicking on buttons or selectable text
    if (target.tagName === "BUTTON" || target.closest("button")) return;
    if (
      window.getComputedStyle(target).userSelect === "text" || 
      target.closest('[style*="user-select: text"]') ||
      target.closest('[style*="userSelect: text"]')
    ) return;
    
    setIsManualPosition(true); // User moved it manually
    getCurrentWindow().startDragging();
  };

  if (status === "idle") return null;

  return (
    <div
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        width: "100vw",
        minHeight: "100%",
        background: "transparent",
        fontFamily: "'Inter', 'Segoe UI', system-ui, sans-serif",
        padding: 0,
        margin: 0,
      }}
    >
      <div 
        ref={cardRef}
        style={tooltipCard} 
        onMouseDown={handleMouseDown}
        // data-tauri-drag-region was removed in favor of startDragging()
      >
        {/* ── LOADING ── */}
        {status === "loading" && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 0" }}>
            <div style={spinnerStyle} />
            <span style={{ fontSize: 12, color: "#a2a2b4" }}>Đang dịch...</span>
          </div>
        )}

        {/* ── ERROR ── */}
        {status === "error" && (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "4px 0" }}>
            <span style={{ fontSize: 11, color: "#ef4444", flex: 1 }}>{error}</span>
            <button onClick={hideTooltip} style={iconBtn} title="Đóng">✕</button>
          </div>
        )}

        {/* ── SUCCESS ── */}
        {status === "success" && result && (
          <>
            {/* Row 1: Original text (muted, small) */}
            <div style={{
              fontSize: 11, color: "#646478", lineHeight: "1.3",
              maxHeight: 20, overflow: "hidden", textOverflow: "ellipsis",
              whiteSpace: "nowrap", userSelect: "text",
            }}>
              {result.originalText}
            </div>

            {/* Row 2: Translation (primary) */}
            <div style={{
              fontSize: 13, fontWeight: 500, color: "#f1f1f6",
              lineHeight: "1.4", userSelect: "text",
              margin: "3px 0 6px",
            }}>
              {result.translatedText}
            </div>

            {/* Row 3: Actions bar */}
            <div style={{ display: "flex", alignItems: "center", gap: 2 }}>
              {/* Language badge */}
              <span style={{
                fontSize: 9, color: "#646478", fontWeight: 600,
                textTransform: "uppercase", letterSpacing: "0.5px",
                marginRight: "auto",
              }}>
                {result.sourceLanguage} → {result.targetLanguage}
              </span>

              {/* Pin */}
              <button 
                onClick={() => setIsPinned(!isPinned)} 
                style={{
                  ...iconBtn,
                  color: isPinned ? "#6366f1" : "#a2a2b4",
                  background: isPinned ? "rgba(99,102,241,0.1)" : undefined,
                }} 
                title={isPinned ? "Bỏ ghim" : "Ghim cửa sổ"}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill={isPinned ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
                </svg>
              </button>

              {/* Speaker TTS Button */}
              <button 
                onClick={handlePlayTTS} 
                style={{
                  ...iconBtn,
                  color: ttsState === "normal" ? "#6366f1" : ttsState === "slow" ? "#f59e0b" : "#a2a2b4",
                  background: ttsState !== "idle" ? "rgba(255,255,255,0.05)" : undefined,
                }} 
                title={ttsState === "slow" ? "Tốc độ: 0.75x (Click để đổi 1.0x)" : "Tốc độ: 1.0x (Click để đổi 0.75x)"}
              >
                {ttsState === "slow" ? (
                  <span style={{ fontSize: 13, display: "inline-flex", alignItems: "center", justifyContent: "center" }}>🐢</span>
                ) : (
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
                    <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path>
                  </svg>
                )}
              </button>

              {/* Copy */}
              <button onClick={handleCopy} style={iconBtn} title="Sao chép">
                {copied ? (
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2.5" strokeLinecap="round"><path d="M5 13l4 4L19 7"/></svg>
                ) : (
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>
                )}
              </button>

              {/* Explain (AI toggle) */}
              <button
                onClick={handleExpand}
                style={{
                  ...iconBtn,
                  color: isExpanded ? "#6366f1" : "#a2a2b4",
                  background: isExpanded ? "rgba(99,102,241,0.1)" : undefined,
                }}
                title={isExpanded ? "Thu gọn" : "Giải thích AI"}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 015.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
              </button>

              {/* Close */}
              <button onClick={hideTooltip} style={iconBtn} title="Đóng (ESC)">
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>

            {/* ── EXPANDED: AI PANEL ── */}
            {isExpanded && (
              <div style={{
                marginTop: 8, paddingTop: 8,
                borderTop: "1px solid rgba(255,255,255,0.06)",
                maxHeight: 200, overflowY: "auto",
              }}>
                {/* AI Loading */}
                {aiStatus === "loading" && (
                  <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 0" }}>
                    <div style={{ ...spinnerStyle, width: 12, height: 12, borderWidth: 1.5 }} />
                    <span style={{ fontSize: 11, color: "#646478" }}>AI đang phân tích...</span>
                  </div>
                )}

                {/* AI Error */}
                {aiStatus === "error" && (
                  <div style={{ fontSize: 11, color: "#ef4444", padding: "4px 0" }}>
                    {aiError || "Lỗi phân tích AI"}
                    <button onClick={() => fetchAnalysis(result.originalText, "vi", currentExamDoc ? { examDocument: currentExamDoc } as any : result)} style={{ ...iconBtn, fontSize: 10, marginLeft: 8 }}>Thử lại</button>
                  </div>
                )}

                {/* AI Success */}
                {aiStatus === "success" && aiAnalysis && (
                  <AIContent analysis={aiAnalysis} />
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// === Helper function to parse basic markdown (**bold** and `code`) ===
function parseFormattedText(text: string): React.ReactNode[] {
  const regex = /(\*\*.*?\*\*|`.*?`)/g;
  const parts = text.split(regex);

  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={i} style={{ color: "#ffffff", fontWeight: 700 }}>{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith("`") && part.endsWith("`")) {
      return (
        <code
          key={i}
          style={{
            fontFamily: "Consolas, Monaco, monospace",
            backgroundColor: "rgba(255, 255, 255, 0.12)",
            color: "#fbbf24",
            padding: "2px 5px",
            borderRadius: 4,
            fontSize: "10.5px",
            margin: "0 2px",
          }}
        >
          {part.slice(1, -1)}
        </code>
      );
    }
    return part;
  });
}

// === AI Content sub-component (lightweight) ===
function AIContent({ analysis }: { analysis: AILearningResult }) {
  const [activeQuestionIdx, setActiveQuestionIdx] = useState(0);
  const [isPassageExpanded, setIsPassageExpanded] = useState(true);
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({});

  const isSectionExpanded = (sectionType: string) => {
    const key = `${activeQuestionIdx}-${sectionType}`;
    if (expandedSections[key] !== undefined) {
      return expandedSections[key];
    }
    // For reading sets: whyCorrect is expanded, others collapsed by default
    if (analysis.isReadingSet) {
      return sectionType === "whyCorrect";
    }
    // For non-reading sets, expand by default
    return true;
  };

  const toggleSection = (sectionType: string) => {
    const key = `${activeQuestionIdx}-${sectionType}`;
    setExpandedSections(prev => ({
      ...prev,
      [key]: !isSectionExpanded(sectionType)
    }));
  };

  const isCorrectOption = (opt: string, correctLetter?: string) => {
    if (!correctLetter) return false;
    const cleanOpt = opt.trim().toUpperCase();
    const cleanLetter = correctLetter.trim().toUpperCase();
    
    return (
      cleanOpt.startsWith(`${cleanLetter}.`) ||
      cleanOpt.startsWith(`${cleanLetter})`) ||
      cleanOpt.startsWith(`(${cleanLetter})`) ||
      cleanOpt.startsWith(`${cleanLetter} `) ||
      cleanOpt === cleanLetter
    );
  };

  const renderGrammarCard = (item: string, sectionType: string, i: number) => {
    const expanded = isSectionExpanded(sectionType);
    
    // Split header and body
    let headerText = item;
    let bodyText = "";
    const firstNewlineIdx = item.indexOf("\n");
    if (firstNewlineIdx !== -1) {
      headerText = item.substring(0, firstNewlineIdx).trim();
      bodyText = item.substring(firstNewlineIdx + 1).trim();
    } else {
      const firstColonIdx = item.indexOf(":");
      if (firstColonIdx !== -1) {
        headerText = item.substring(0, firstColonIdx + 1).trim();
        bodyText = item.substring(firstColonIdx + 1).trim();
      }
    }

    let cardStyle: React.CSSProperties = {
      borderRadius: 8,
      marginTop: 6,
      marginBottom: 6,
      lineHeight: "1.6",
      userSelect: "text",
      fontSize: 11,
      overflow: "hidden",
      transition: "all 0.2s ease-in-out",
    };

    if (item.startsWith("🎯")) {
      cardStyle = {
        ...cardStyle,
        backgroundColor: "rgba(16, 185, 129, 0.04)",
        border: "1px solid rgba(16, 185, 129, 0.15)",
        color: "#e6fcf5",
      };
    } else if (item.startsWith("💡")) {
      cardStyle = {
        ...cardStyle,
        backgroundColor: "rgba(99, 102, 241, 0.04)",
        border: "1px solid rgba(99, 102, 241, 0.15)",
        color: "#f0f2ff",
      };
    } else if (item.startsWith("❌")) {
      cardStyle = {
        ...cardStyle,
        backgroundColor: "rgba(239, 68, 68, 0.03)",
        border: "1px solid rgba(239, 68, 68, 0.12)",
        color: "#fff5f5",
      };
    } else if (item.startsWith("📍") || item.startsWith("🔗")) {
      cardStyle = {
        ...cardStyle,
        backgroundColor: "rgba(245, 158, 11, 0.04)",
        border: "1px solid rgba(245, 158, 11, 0.15)",
        color: "#fffbeb",
      };
    } else {
      cardStyle = {
        ...cardStyle,
        backgroundColor: "rgba(255, 255, 255, 0.02)",
        border: "1px solid rgba(255, 255, 255, 0.05)",
        color: "#e2e8f0",
      };
    }

    const hasBody = bodyText.length > 0;

    return (
      <div key={i} style={cardStyle}>
        {/* Header Clickable Row */}
        <div 
          onClick={() => hasBody && toggleSection(sectionType)}
          style={{
            padding: "8px 12px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            cursor: hasBody ? "pointer" : "default",
            userSelect: "none",
            fontWeight: 600,
            backgroundColor: "rgba(0, 0, 0, 0.12)",
          }}
        >
          <span style={{ flex: 1, paddingRight: 8 }}>{headerText}</span>
          {hasBody && (
            <span style={{ 
              fontSize: 9, 
              color: "rgba(255,255,255,0.4)",
              transition: "transform 0.2s",
              transform: expanded ? "rotate(180deg)" : "rotate(0deg)",
              display: "inline-block"
            }}>
              ▼
            </span>
          )}
        </div>
        
        {/* Body (Collapsible Content) */}
        {(!hasBody || expanded) && (
          <div style={{ 
            padding: "8px 12px", 
            borderTop: hasBody ? "1px solid rgba(255, 255, 255, 0.03)" : "none",
            fontSize: 10.5,
            lineHeight: "1.5",
            color: "rgba(255, 255, 255, 0.85)",
            whiteSpace: "pre-line",
          }}>
            {parseFormattedText(hasBody ? bodyText : headerText)}
          </div>
        )}
      </div>
    );
  };

  if (analysis.isReadingSet) {
    const questions = analysis.readingQuestions || [];
    const activeQ = questions[activeQuestionIdx];

    return (
      <div style={{ fontSize: 11, lineHeight: "1.5", color: "#a2a2b4" }}>
        {/* Reading Set Header Overview */}
        <div style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          backgroundColor: "rgba(99, 102, 241, 0.05)",
          border: "1px solid rgba(99, 102, 241, 0.12)",
          borderRadius: 6,
          padding: "5px 8px",
          marginBottom: 8,
          fontSize: 10,
          fontWeight: 600,
          color: "#c7d2fe"
        }}>
          <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
            📝 Bộ đề đọc hiểu ({questions.length} câu)
          </span>
          <span style={{ fontSize: 9, color: "#818cf8", opacity: 0.8 }}>
            TOEIC / IELTS Reading Engine
          </span>
        </div>

        {/* Collapsible Passage */}
        {analysis.passageText && (
          <div style={{
            backgroundColor: "rgba(255, 255, 255, 0.02)",
            border: "1px solid rgba(255, 255, 255, 0.05)",
            borderRadius: 8,
            padding: "6px 10px",
            marginBottom: 8,
          }}>
            <div style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              fontSize: 10,
              fontWeight: 700,
              color: "#38bdf8",
              textTransform: "uppercase",
              letterSpacing: "0.5px",
              cursor: "pointer",
            }}
            onClick={() => setIsPassageExpanded(!isPassageExpanded)}
            >
              <span>📖 Đoạn văn đọc hiểu</span>
              <span style={{ color: "#a2a2b4", fontSize: 9 }}>
                {isPassageExpanded ? "▼ Thu gọn" : "▲ Mở rộng"}
              </span>
            </div>
            {isPassageExpanded && (
              <div style={{
                fontSize: 11,
                color: "#e2e8f0",
                maxHeight: 120,
                overflowY: "auto",
                padding: "6px 8px",
                backgroundColor: "rgba(0, 0, 0, 0.2)",
                borderRadius: 6,
                marginTop: 6,
                whiteSpace: "pre-line",
                lineHeight: "1.5",
                userSelect: "text",
              }}>
                {parseFormattedText(analysis.passageText)}
              </div>
            )}
          </div>
        )}

        {/* Question Selector Tabs */}
        {questions.length > 0 && (
          <div style={{ 
            marginBottom: 8, 
            display: "flex", 
            alignItems: "center", 
            justifyContent: "space-between",
            gap: 6, 
            borderBottom: "1px solid rgba(255,255,255,0.04)",
            paddingBottom: 6
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ fontSize: 9, fontWeight: 700, color: "#646478", textTransform: "uppercase" }}>Câu hỏi:</span>
              <div style={{ display: "flex", gap: 4 }}>
                {questions.map((q, idx) => (
                  <button
                    key={idx}
                    onClick={() => setActiveQuestionIdx(idx)}
                    style={{
                      padding: "2px 8px",
                      fontSize: 9,
                      fontWeight: 700,
                      borderRadius: 4,
                      border: activeQuestionIdx === idx ? "1px solid #6366f1" : "1px solid rgba(255, 255, 255, 0.05)",
                      backgroundColor: activeQuestionIdx === idx ? "rgba(99, 102, 241, 0.15)" : "rgba(255, 255, 255, 0.02)",
                      color: activeQuestionIdx === idx ? "#818cf8" : "#a2a2b4",
                      cursor: "pointer",
                      transition: "all 80ms",
                    }}
                  >
                    {q.questionNumber}
                  </button>
                ))}
              </div>
            </div>

            {/* Prev/Next Flow Controls */}
            <div style={{ display: "flex", alignItems: "center", gap: 3 }}>
              <button
                disabled={activeQuestionIdx === 0}
                onClick={() => setActiveQuestionIdx(prev => Math.max(0, prev - 1))}
                style={{
                  padding: "2px 6px",
                  fontSize: 9,
                  fontWeight: 600,
                  borderRadius: 4,
                  border: "1px solid rgba(255, 255, 255, 0.05)",
                  backgroundColor: "rgba(255, 255, 255, 0.02)",
                  color: activeQuestionIdx === 0 ? "rgba(255,255,255,0.15)" : "#a2a2b4",
                  cursor: activeQuestionIdx === 0 ? "default" : "pointer",
                  transition: "all 80ms",
                }}
              >
                ◀ Trước
              </button>
              <button
                disabled={activeQuestionIdx === questions.length - 1}
                onClick={() => setActiveQuestionIdx(prev => Math.min(questions.length - 1, prev + 1))}
                style={{
                  padding: "2px 6px",
                  fontSize: 9,
                  fontWeight: 600,
                  borderRadius: 4,
                  border: "1px solid rgba(255, 255, 255, 0.05)",
                  backgroundColor: "rgba(255, 255, 255, 0.02)",
                  color: activeQuestionIdx === questions.length - 1 ? "rgba(255,255,255,0.15)" : "#a2a2b4",
                  cursor: activeQuestionIdx === questions.length - 1 ? "default" : "pointer",
                  transition: "all 80ms",
                }}
              >
                Sau ▶
              </button>
            </div>
          </div>
        )}

        {/* Question Detail */}
        {activeQ && (
          <div style={{ marginTop: 6 }}>
            {/* Question Text */}
            <div style={{
              fontSize: 11,
              fontWeight: 600,
              color: "#f1f1f6",
              marginBottom: 6,
              backgroundColor: "rgba(255, 255, 255, 0.02)",
              padding: "6px 8px",
              borderRadius: 6,
              borderLeft: "2.5px solid #818cf8",
              userSelect: "text"
            }}>
              {activeQ.questionNumber}: {parseFormattedText(activeQ.questionText)}
            </div>

            {/* Options */}
            {activeQ.options && activeQ.options.length > 0 && (
              <div style={{
                display: "grid",
                gridTemplateColumns: activeQ.options.length > 2 ? "1fr" : "1fr 1fr",
                gap: 4,
                paddingLeft: 6,
                marginBottom: 8,
              }}>
                {activeQ.options.map((opt, oIdx) => {
                  const isCorrect = isCorrectOption(opt, activeQ.correctAnswer);
                  return (
                    <div 
                      key={oIdx} 
                      style={{ 
                        fontSize: 10.5, 
                        color: isCorrect ? "#34d399" : "#94a3b8", 
                        backgroundColor: isCorrect ? "rgba(16, 185, 129, 0.08)" : "rgba(255, 255, 255, 0.01)",
                        border: isCorrect ? "1px solid rgba(16, 185, 129, 0.2)" : "1px solid rgba(255, 255, 255, 0.02)",
                        borderRadius: 6,
                        padding: "4px 8px",
                        display: "flex",
                        alignItems: "center",
                        gap: 4,
                        userSelect: "text",
                        fontWeight: isCorrect ? 600 : 400
                      }}
                    >
                      {isCorrect && <span style={{ color: "#10b981", marginRight: 2 }}>✓</span>}
                      {parseFormattedText(opt)}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Structured Explanations */}
            {renderGrammarCard(activeQ.whyCorrect, "whyCorrect", 0)}
            {renderGrammarCard(activeQ.grammarInsight, "grammarInsight", 1)}
            {activeQ.collocationInsight && renderGrammarCard(activeQ.collocationInsight, "collocationInsight", 2)}
            {renderGrammarCard(activeQ.whyOthersWrong, "whyOthersWrong", 3)}

            {/* Collapsible Translation */}
            {activeQ.translation && renderGrammarCard(`🇻🇳 Bản dịch câu hỏi\n${activeQ.translation}`, "translation", 4)}
          </div>
        )}
      </div>
    );
  }

  return (
    <div style={{ fontSize: 11, lineHeight: "1.5", color: "#a2a2b4" }}>
      {/* IPA */}
      {analysis.ipaPronunciation && (
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8, marginTop: 4 }}>
          <span style={{ fontSize: 9, fontWeight: 700, color: "#f59e0b", textTransform: "uppercase", letterSpacing: "0.5px" }}>IPA</span>
          <span style={{ fontFamily: "monospace", fontSize: 12, color: "#fbbf24", userSelect: "text" }}>
            {analysis.ipaPronunciation}
          </span>
        </div>
      )}

      {/* Grammar */}
      {analysis.grammarBreakdown && analysis.grammarBreakdown.length > 0 && (
        <div style={{ marginBottom: 10 }}>
          <span style={sectionLabel("#818cf8")}>Phân Tích Giải Thích</span>
          {analysis.grammarBreakdown.map((item, i) => renderGrammarCard(item, `grammarInsight-${i}`, i))}
        </div>
      )}

      {/* Vocabulary */}
      {analysis.vocabularyExplanation && analysis.vocabularyExplanation.length > 0 && (
        <div style={{ marginBottom: 10 }}>
          <span style={sectionLabel("#34d399")}>Từ vựng trọng tâm</span>
          <div style={{
            backgroundColor: "rgba(255, 255, 255, 0.02)",
            border: "1px solid rgba(255, 255, 255, 0.05)",
            borderRadius: 8,
            padding: "6px 10px",
            marginTop: 4
          }}>
            {analysis.vocabularyExplanation.map((v, i) => (
              <div key={i} style={{ 
                padding: "4px 0", 
                borderBottom: i < (analysis.vocabularyExplanation?.length || 0) - 1 ? "1px solid rgba(255,255,255,0.04)" : "none",
                userSelect: "text" 
              }}>
                <span style={{ fontWeight: 600, color: "#34d399" }}>{v.word}</span>
                <span style={{ color: "#646478", fontSize: 10, marginLeft: 4 }}>({v.partOfSpeech})</span>
                <span style={{ color: "#e2e8f0", marginLeft: 6 }}>{parseFormattedText(v.meaning)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Examples */}
      {analysis.exampleUsage && analysis.exampleUsage.length > 0 && (
        <div style={{ marginBottom: 10 }}>
          <span style={sectionLabel("#38bdf8")}>Ví dụ mở rộng</span>
          <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 4 }}>
            {analysis.exampleUsage.map((ex, i) => (
              <div key={i} style={{ 
                padding: "6px 10px", 
                backgroundColor: "rgba(56,189,248,0.03)",
                borderLeft: "3px solid #38bdf8",
                borderRadius: "0 8px 8px 0",
                userSelect: "text" 
              }}>
                <div style={{ color: "#e2e2ea", fontWeight: 500 }}>{ex.original}</div>
                <div style={{ color: "#94a3b8", fontSize: 10, marginTop: 2 }}>{ex.translated}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Context */}
      {analysis.contextualExplanation && (
        <div style={{ 
          color: "#9ca3af", 
          fontStyle: "italic", 
          fontSize: 10, 
          userSelect: "text",
          backgroundColor: "rgba(255,255,255,0.02)",
          borderRadius: 6,
          padding: "6px 10px",
          marginTop: 6
        }}>
          💡 {parseFormattedText(analysis.contextualExplanation)}
        </div>
      )}
    </div>
  );
}

// === Shared styles ===
const tooltipCard: React.CSSProperties = {
  backgroundColor: "rgba(16, 16, 24, 0.94)",
  backdropFilter: "blur(16px)",
  border: "1px solid rgba(255,255,255,0.07)",
  borderRadius: 10,
  padding: "8px 12px",
  boxShadow: "0 4px 20px rgba(0,0,0,0.4), 0 0 0 0.5px rgba(255,255,255,0.05)",
  overflow: "hidden",
  color: "#f1f1f6",
};

const spinnerStyle: React.CSSProperties = {
  width: 14, height: 14,
  border: "2px solid rgba(99,102,241,0.2)",
  borderTop: "2px solid #6366f1",
  borderRadius: "50%",
  animation: "spin 0.6s linear infinite",
};

const iconBtn: React.CSSProperties = {
  background: "none",
  border: "none",
  color: "#a2a2b4",
  padding: "4px 5px",
  cursor: "pointer",
  borderRadius: 5,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  lineHeight: 1,
  transition: "background 80ms, color 80ms",
};

const sectionLabel = (color: string): React.CSSProperties => ({
  fontSize: 9, fontWeight: 700, color,
  textTransform: "uppercase", letterSpacing: "0.6px",
  display: "block", marginBottom: 2,
});

export default TooltipPopup;
