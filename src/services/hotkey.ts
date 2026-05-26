/**
 * ============================================
 * 📁 src/services/hotkey.ts
 * ============================================
 *
 * MỤC ĐÍCH:
 * Service đăng ký và quản lý global shortcuts
 * (phím tắt hoạt động ở mọi nơi trên Windows).
 *
 * THEO: 02_ARCHITECTURE.md - "Hotkey Manager"
 * - register global shortcuts
 * - trigger translation modes
 * - handle Ctrl + Q
 * - handle Ctrl + Shift + Q
 * - dispatch events
 *
 * GLOBAL SHORTCUT LÀ GÌ?
 * - Phím tắt hoạt động NGAY CẢ khi app ở background
 * - Ví dụ: User đang đọc web Chrome, nhấn Ctrl+Q
 *   → App translator vẫn bắt được event
 * - Đây là tính năng native, cần Tauri Rust backend
 *
 * THEO: 08_TOOLING.md
 * - "Tauri Global Shortcut Plugin"
 * ============================================
 */

import { register, unregisterAll, isRegistered } from "@tauri-apps/plugin-global-shortcut";
import { invoke } from "@tauri-apps/api/core";
import type { TranslationMode } from "../types";

type HotkeyCallback = (mode: TranslationMode) => void;

// Định nghĩa phím tắt chuẩn theo Tauri v2 format
const TEXT_HOTKEY = "CommandOrControl+Q";
const OCR_HOTKEY = "CommandOrControl+Shift+Q";

async function logHotkeyStatus(msg: string) {
  console.log(msg);
  try {
    await invoke("write_debug_log", { message: `[${new Date().toISOString()}] [Hotkey Service] ${msg}` });
  } catch (err) {}
}

let onTriggerCallback: HotkeyCallback | null = null;
let shortcutsRegistered = false;

/**
 * registerHotkeys - Đăng ký tất cả phím tắt global (chỉ thực hiện đăng ký 1 lần duy nhất)
 *
 * @param onTrigger - Callback khi phím tắt được nhấn
 */
export async function registerHotkeys(
  onTrigger: HotkeyCallback
): Promise<void> {
  onTriggerCallback = onTrigger;

  if (shortcutsRegistered) {
    await logHotkeyStatus("Shortcuts already registered, only updated callback.");
    return;
  }

  try {
    await logHotkeyStatus("Initializing global shortcuts (once)...");
    shortcutsRegistered = true;

    // Đăng ký Ctrl + Q cho Text Translation
    try {
      const isTextReg = await isRegistered(TEXT_HOTKEY);
      if (!isTextReg) {
        await register(TEXT_HOTKEY, async (event) => {
          if (event.state === "Pressed") {
            await logHotkeyStatus(`${TEXT_HOTKEY} Triggered!`);
            if (onTriggerCallback) onTriggerCallback("text");
          }
        });
        await logHotkeyStatus(`Successfully registered ${TEXT_HOTKEY}`);
      } else {
        await logHotkeyStatus(`${TEXT_HOTKEY} already registered by this app.`);
      }
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error);
      await logHotkeyStatus(`Failed to register ${TEXT_HOTKEY}: ${errMsg}`);
    }

    // Đăng ký Ctrl + Shift + Q cho OCR Translation
    try {
      const isOcrReg = await isRegistered(OCR_HOTKEY);
      if (!isOcrReg) {
        await register(OCR_HOTKEY, async (event) => {
          if (event.state === "Pressed") {
            await logHotkeyStatus(`${OCR_HOTKEY} Triggered!`);
            if (onTriggerCallback) onTriggerCallback("ocr");
          }
        });
        await logHotkeyStatus(`Successfully registered ${OCR_HOTKEY}`);
      } else {
        await logHotkeyStatus(`${OCR_HOTKEY} already registered by this app.`);
      }
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error);
      await logHotkeyStatus(`Failed to register ${OCR_HOTKEY}: ${errMsg}`);
    }

    // Log trạng thái kiểm tra
    const textReg = await isRegistered(TEXT_HOTKEY);
    const ocrReg = await isRegistered(OCR_HOTKEY);
    await logHotkeyStatus(`Registered status - Text: ${textReg}, OCR: ${ocrReg}`);

  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    await logHotkeyStatus(`Error in registerHotkeys: ${errMsg}`);
  }
}

/**
 * unregisterHotkeys - Gỡ bỏ tất cả phím tắt
 *
 * Gọi khi app đóng hoặc cần reset phím tắt.
 * Quan trọng: Phải gỡ khi app tắt để trả lại phím tắt cho hệ điều hành.
 */
export async function unregisterHotkeys(): Promise<void> {
  try {
    await logHotkeyStatus("Unregistering all global shortcuts...");
    await unregisterAll();
    shortcutsRegistered = false;
    await logHotkeyStatus("All global shortcuts unregistered.");
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    await logHotkeyStatus(`Error unregistering global shortcuts: ${errMsg}`);
  }
}
