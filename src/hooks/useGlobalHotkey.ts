/**
 * ============================================
 * 📁 src/hooks/useGlobalHotkey.ts
 * ============================================
 *
 * MỤC ĐÍCH:
 * Custom hook quản lý việc lắng nghe phím tắt global (Ctrl+Q, Ctrl+Shift+Q)
 * và điều phối luồng dịch thuật qua cửa sổ Tooltip riêng biệt.
 *
 * UX REFACTOR:
 * - Translation popup giờ là cửa sổ Tauri riêng (label: "tooltip")
 * - Kết quả được gửi qua Tauri event "tooltip-update"
 * - Tooltip hiển thị tại vị trí con trỏ chuột (contextual)
 * - Main window KHÔNG hiển thị khi dịch (tray-first)
 * ============================================
 */

import { useEffect, useRef } from "react";
import { registerHotkeys } from "../services/hotkey";
import { simulateCopy, readClipboardText } from "../services/clipboard";
import { captureScreenRegion, recognizeText } from "../services/ocr";
import { useTranslation } from "./useTranslation";
import { useTranslationStore } from "../stores/translationStore";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { WebviewWindow } from "@tauri-apps/api/webviewWindow";
import { listen, emit, UnlistenFn } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";

export function useGlobalHotkey() {
  const { translate } = useTranslation();
  const setMode = useTranslationStore((s) => s.setMode);

  const logHotkey = async (msg: string) => {
    console.log(msg);
    try {
      await invoke("write_debug_log", { message: `[${new Date().toISOString()}] [useGlobalHotkey] ${msg}` });
    } catch (err) {}
  };

  const translateRef = useRef(translate);
  useEffect(() => {
    translateRef.current = translate;
  }, [translate]);

  let currentWin: any = null;
  let isMainWindow = false;
  try {
    currentWin = getCurrentWindow();
    isMainWindow = currentWin.label === "main";
  } catch (e) {
    console.warn("[useGlobalHotkey] Not running inside Tauri context.");
    isMainWindow = true;
  }

  const currentWinRef = useRef(currentWin);
  useEffect(() => {
    currentWinRef.current = currentWin;
  }, [currentWin]);

  useEffect(() => {
    // Chỉ cửa sổ "main" mới đăng ký phím tắt hệ thống
    if (!isMainWindow) return;

    let active = true;
    let unlistenSelected: UnlistenFn | null = null;

    const setup = async () => {
      await logHotkey("Starting registerHotkeys...");
      // 1. Đăng ký các hotkeys global
      await registerHotkeys(async (mode) => {
        if (!active) return;

        if (mode === "text") {
          await logHotkey("Triggering Selected Text Translation...");
          setMode("text");

          try {
            // Simulate Ctrl+C và đọc clipboard
            await simulateCopy();
            const text = await readClipboardText();
            await logHotkey(`Read clipboard text length: ${text ? text.length : 0}`);
            
            // SMART MODE DETECTION: Nếu không có text bôi đen, tự động chuyển sang OCR
            if (!text || !text.trim()) {
              await logHotkey("No text found in clipboard. Falling back to OCR mode.");
              setMode("ocr");
              const overlayWin = await WebviewWindow.getByLabel("overlay");
              if (overlayWin) {
                await overlayWin.show();
                await overlayWin.setAlwaysOnTop(true);
                await overlayWin.setFocus();
              }
              return;
            }

            // Lấy vị trí con trỏ chuột từ Rust
            const [cursorX, cursorY] = await invoke<[number, number]>("get_cursor_position");
            const scale = await currentWinRef.current.scaleFactor();
            const logCursorX = cursorX / scale;
            const logCursorY = cursorY / scale;
            await logHotkey(`Cursor physical: ${cursorX}, ${cursorY}. Logical: ${logCursorX}, ${logCursorY}`);

            // Báo cho tooltip biết đang loading và truyền tọa độ (để tooltip tự định vị)
            await logHotkey("Emitting tooltip-update loading state...");
            await emit("tooltip-update", { status: "loading", cursor: { x: logCursorX, y: logCursorY } });

            // Dịch văn bản
            await logHotkey(`Calling translateRef.current for text of length: ${text.length}`);
            await translateRef.current(text);
            await logHotkey("translateRef.current completed.");

            // Lấy kết quả từ store và gửi tới tooltip
            const result = useTranslationStore.getState().result;
            const translationStatus = useTranslationStore.getState().status;
            await logHotkey(`Zustand state: status=${translationStatus}, hasResult=${!!result}`);

            if (translationStatus === "success" && result) {
              await logHotkey("Emitting tooltip-update success state.");
              await emit("tooltip-update", { 
                status: "success", 
                result, 
                cursor: { x: logCursorX, y: logCursorY } 
              });
            } else {
              const errorMsg = useTranslationStore.getState().error || "Translation failed";
              await logHotkey(`Translation failed. Emitting tooltip-update error: ${errorMsg}`);
              await emit("tooltip-update", { 
                status: "error", 
                error: errorMsg, 
                cursor: { x: logCursorX, y: logCursorY } 
              });
            }
          } catch (error) {
            const message = error instanceof Error ? error.message : "Translation failed";
            await logHotkey(`Catch block triggered in text flow: ${message}`);
            const scale = await currentWinRef.current.scaleFactor();
            const [cX, cY] = await invoke<[number, number]>("get_cursor_position").catch(() => [0, 0]);
            await emit("tooltip-update", {
              status: "error",
              error: message,
              cursor: { x: cX / scale, y: cY / scale }
            });
          }
        }

        else if (mode === "ocr") {
          await logHotkey("Triggering Screen OCR Mode...");
          setMode("ocr");

          try {
            const overlayWin = await WebviewWindow.getByLabel("overlay");
            if (overlayWin) {
              await overlayWin.show();
              await overlayWin.setAlwaysOnTop(true);
              await overlayWin.setFocus();
              await logHotkey("Overlay window shown and focused.");
            } else {
              await logHotkey("Overlay window not found.");
            }
          } catch (error) {
            await logHotkey(`Failed to show overlay window: ${error}`);
          }
        }
      });

      if (!active) return;
      await logHotkey("registerHotkeys done. Registering ocr-region-selected listener...");

      // 2. Lắng nghe sự kiện tọa độ vùng chọn gửi từ overlay window
      const unlisten = await listen<{ x: number; y: number; width: number; height: number }>(
        "ocr-region-selected",
        async (event) => {
          if (!active) return;
          const { x, y, width, height } = event.payload;
          await logHotkey(`Received OCR region: x=${x}, y=${y}, w=${width}, h=${height}`);

          // Báo cho tooltip biết đang loading và truyền tọa độ dưới cùng của vùng chọn OCR
          await logHotkey("Emitting tooltip-update loading state for OCR...");
          await emit("tooltip-update", { status: "loading", cursor: { x: x, y: y + height } });

          try {
            // Scale factor cho physical pixels
            const scale = await currentWinRef.current.scaleFactor();
            await logHotkey(`Current scale factor: ${scale}`);

            const physicalRegion = {
              x: Math.round(x * scale),
              y: Math.round(y * scale),
              width: Math.round(width * scale),
              height: Math.round(height * scale),
            };
            await logHotkey(`Physical region: ${JSON.stringify(physicalRegion)}`);

            // Chụp screenshot + phân tích cấu trúc tài liệu
            await logHotkey("Calling captureScreenRegion...");
            const imgData = await captureScreenRegion(physicalRegion);
            await logHotkey("Calling recognizeText (DocumentParser pipeline)...");
            const ocrResult = await recognizeText(imgData);
            await logHotkey(
              `recognizeText done. Type: ${ocrResult.examDocument?.documentType}. ` +
              `Questions: ${ocrResult.examDocument?.questions?.length ?? 0}. ` +
              `Text length: ${ocrResult.text?.length ?? 0}`
            );

            if (!ocrResult.text || !ocrResult.text.trim()) {
              throw new Error("Không phát hiện văn bản nào trong vùng chọn.");
            }

            const exam = ocrResult.examDocument;
            const hasStructuredQuestions = exam && exam.questions.length > 0;

            if (hasStructuredQuestions) {
              // Luồng tài liệu có cấu trúc: gửi examDocument như field riêng cấp 1
              // KHÔNG spread ocrResult (tránh serialize words[] lớn làm truncate IPC)
              await logHotkey(`Structured exam detected (${exam!.documentType}). Questions: ${exam!.questions.length}.`);

              // Tạo ExamDocument nhẹ (chỉ gửi qua IPC những gì cần thiết)
              const lightExam: import("../types").ExamDocument = {
                documentType: exam!.documentType,
                questions: exam!.questions.map((q) => ({
                  number: q.number,
                  hasBlank: q.hasBlank,
                  options: q.options,
                  stem: { tokens: [], cleanText: q.stem.cleanText, y: q.stem.y, height: q.stem.height },
                })),
                rawText: exam!.rawText,
                passage: exam!.passage
                  ? {
                      cleanText: exam!.passage.cleanText,
                      lines: [], // không gửi lines nặng qua IPC
                    }
                  : undefined,
              };

              await emit("tooltip-update", {
                status: "success",
                result: {
                  originalText: ocrResult.text,
                  translatedText: exam!.passage?.cleanText ?? ocrResult.text,
                  sourceLanguage: "en",
                  targetLanguage: "vi",
                  timestamp: Date.now(),
                },
                examDocument: lightExam, // field cấp 1, tách biệt với result
                cursor: { x, y: y + height },
              });
            } else {
              // Fallback: văn bản thông thường (subtitle, general text) → dịch bình thường
              await logHotkey("General text detected. Calling translateRef.current...");
              await translateRef.current(ocrResult.text);
              await logHotkey("translateRef.current completed for general OCR.");

              const result = useTranslationStore.getState().result;
              const translationStatus = useTranslationStore.getState().status;
              await logHotkey(`Zustand state: status=${translationStatus}, hasResult=${!!result}`);

              if (translationStatus === "success" && result) {
                const combinedResult = {
                  ...result,
                  ...ocrResult,
                  originalText: ocrResult.text,
                };
                await logHotkey("Emitting tooltip-update success (general).");
                await emit("tooltip-update", {
                  status: "success",
                  result: combinedResult,
                  cursor: { x, y: y + height },
                });
              } else {
                const errorMsg = useTranslationStore.getState().error || "OCR translation failed";
                await logHotkey(`Translation failed: ${errorMsg}`);
                await emit("tooltip-update", {
                  status: "error",
                  error: errorMsg,
                  cursor: { x, y: y + height },
                });
              }
            }
          } catch (err) {
            const message = err instanceof Error ? err.message : "OCR failed";
            await logHotkey(`Catch block triggered in OCR flow: ${message}`);
            await emit("tooltip-update", {
              status: "error",
              error: message,
              cursor: { x, y: y + height },
            });
          }
        }
        );

        if (!active) {
          unlisten();
          return;
        }
        unlistenSelected = unlisten;
        await logHotkey("ocr-region-selected listener registered.");
      };

      setup();

      return () => {
        active = false;
        // KHÔNG unregisterHotkeys ở đây để tránh race-condition khi React StrictMode / HMR unmount & mount lại liên tục.
        // Phím tắt sẽ được giải phóng tự động bởi hệ điều hành khi ứng dụng tắt.
        if (unlistenSelected) {
          unlistenSelected();
        }
      };
    }, [isMainWindow]);
  }

export default useGlobalHotkey;
