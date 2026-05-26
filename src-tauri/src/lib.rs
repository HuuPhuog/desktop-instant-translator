use base64::{engine::general_purpose, Engine as _};
use enigo::{Direction, Enigo, Key, Keyboard, Settings};
use screenshots::Screen;
use std::io::Cursor;
use std::thread::sleep;
use std::time::Duration;
use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    Manager,
};

// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

/**
 * simulate_copy - Command giả lập nhấn phím Ctrl + C để copy text đang được bôi đen.
 * Sử dụng thư viện `enigo` để gửi keyboard input native.
 * Sau khi simulate Ctrl+C, hàm sẽ sleep 150ms để Windows OS có thời gian cập nhật clipboard.
 */
#[tauri::command]
fn simulate_copy() -> Result<String, String> {
    let mut enigo = Enigo::new(&Settings::default())
        .map_err(|e| format!("Failed to initialize Enigo: {}", e))?;

    // Giả lập Ctrl + C
    enigo
        .key(Key::Control, Direction::Press)
        .map_err(|e| format!("Failed Ctrl Press: {:?}", e))?;
    enigo
        .key(Key::Unicode('c'), Direction::Click)
        .map_err(|e| format!("Failed C Click: {:?}", e))?;
    enigo
        .key(Key::Control, Direction::Release)
        .map_err(|e| format!("Failed Ctrl Release: {:?}", e))?;

    // Đợi 150ms để clipboard cập nhật
    sleep(Duration::from_millis(150));
    Ok("Copied".to_string())
}

/**
 * capture_screen - Command chụp vùng màn hình được chỉ định.
 * Nhận tọa độ tuyệt đối x, y và kích thước width, height.
 * Hỗ trợ đa màn hình bằng cách tự động tìm monitor chứa tọa độ (x, y).
 * Trả về ảnh dưới dạng Base64 string.
 */
#[tauri::command]
fn capture_screen(x: i32, y: i32, mut width: u32, mut height: u32) -> Result<String, String> {
    // Đảm bảo kích thước tối thiểu là 1x1 để tránh crash khi người dùng chỉ click chuột
    if width == 0 {
        width = 1;
    }
    if height == 0 {
        height = 1;
    }

    println!(
        "[Rust Backend] Capturing screen region: x={}, y={}, w={}, h={}",
        x, y, width, height
    );

    // Tìm monitor chứa điểm (x, y) thông qua screenshots::Screen::from_point
    let screen = Screen::from_point(x, y).map_err(|e| {
        format!(
            "Failed to find monitor at coordinates ({}, {}): {}",
            x, y, e
        )
    })?;

    // Chuyển tọa độ sang dạng relative với góc trên bên trái của monitor đó
    let rel_x = x - screen.display_info.x;
    let rel_y = y - screen.display_info.y;

    // Chụp vùng chỉ định
    let image = screen
        .capture_area(rel_x, rel_y, width, height)
        .map_err(|e| format!("Failed to capture screen area: {}", e))?;

    // Convert ImageBuffer sang định dạng PNG bytes
    let mut png_bytes: Vec<u8> = Vec::new();
    image
        .write_to(
            &mut Cursor::new(&mut png_bytes),
            screenshots::image::ImageFormat::Png,
        )
        .map_err(|e| format!("Failed to encode image as PNG: {}", e))?;

    // Encode Base64 chuỗi PNG bytes
    let base64_str = general_purpose::STANDARD.encode(&png_bytes);

    Ok(base64_str)
}

#[tauri::command]
fn save_debug_image(name: String, base64_data: String) -> Result<(), String> {
    let clean_base64 = if base64_data.contains(",") {
        base64_data.split(",").collect::<Vec<&str>>()[1]
    } else {
        &base64_data
    };
    let bytes = general_purpose::STANDARD
        .decode(clean_base64)
        .map_err(|e| format!("Failed to decode base64: {}", e))?;
    
    // Lưu vào thư mục temp của hệ thống để tránh kích hoạt watch rebuild của Tauri dev
    let path = std::env::temp_dir().join(&name);
    std::fs::write(&path, bytes).map_err(|e| format!("Failed to write file to {:?}: {}", path, e))?;
    Ok(())
}

#[tauri::command]
fn write_debug_log(message: String) -> Result<(), String> {
    use std::fs::OpenOptions;
    use std::io::Write;
    
    // Lưu vào thư mục temp của hệ thống để tránh kích hoạt watch rebuild của Tauri dev
    let path = std::env::temp_dir().join("ocr_debug_log.txt");
    let mut file = OpenOptions::new()
        .create(true)
        .append(true)
        .open(&path)
        .map_err(|e| format!("Failed to open log file at {:?}: {}", path, e))?;
    writeln!(file, "{}", message).map_err(|e| format!("Failed to write log: {}", e))?;
    Ok(())
}

/**
 * get_cursor_position - Lấy vị trí con trỏ chuột hiện tại (physical pixels).
 * Sử dụng Windows API GetCursorPos.
 */
#[tauri::command]
fn get_cursor_position() -> Result<(i32, i32), String> {
    #[repr(C)]
    struct POINT {
        x: i32,
        y: i32,
    }

    extern "system" {
        fn GetCursorPos(lp_point: *mut POINT) -> i32;
    }

    unsafe {
        let mut point = POINT { x: 0, y: 0 };
        if GetCursorPos(&mut point) != 0 {
            Ok((point.x, point.y))
        } else {
            Err("Failed to get cursor position".to_string())
        }
    }
}

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            Some(vec!["--hidden"]),
        ))
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .plugin(tauri_plugin_clipboard_manager::init())
        .invoke_handler(tauri::generate_handler![
            greet,
            simulate_copy,
            capture_screen,
            save_debug_image,
            write_debug_log,
            get_cursor_position
        ])
        .setup(|app| {
            // ===== SYSTEM TRAY =====
            let settings_i = MenuItem::with_id(app, "settings", "⚙️ Cài đặt", true, None::<&str>)?;
            let history_i = MenuItem::with_id(app, "history", "🕒 Lịch sử", true, None::<&str>)?;
            let separator_i = tauri::menu::PredefinedMenuItem::separator(app)?;
            let ocr_i = MenuItem::with_id(app, "ocr", "🔍 Chụp màn hình OCR", true, None::<&str>)?;
            let separator_2_i = tauri::menu::PredefinedMenuItem::separator(app)?;
            let quit_i = MenuItem::with_id(app, "quit", "❌ Thoát", true, None::<&str>)?;

            let menu = Menu::with_items(
                app,
                &[
                    &settings_i,
                    &history_i,
                    &separator_i,
                    &ocr_i,
                    &separator_2_i,
                    &quit_i,
                ],
            )?;

            let _tray = TrayIconBuilder::new()
                .icon(app.default_window_icon().unwrap().clone())
                .menu(&menu)
                .show_menu_on_left_click(false)
                .tooltip("Desktop Instant Translator")
                .on_menu_event(|app, event| {
                    match event.id.as_ref() {
                        "settings" | "history" => {
                            if let Some(window) = app.get_webview_window("main") {
                                // Gửi event sang React để biết mở tab nào
                                let _ =
                                    tauri::Emitter::emit(&window, "navigate-to", event.id.as_ref());
                                let _ = window.show();
                                let _ = window.set_focus();
                            }
                        }
                        "ocr" => {
                            if let Some(window) = app.get_webview_window("overlay") {
                                let _ = window.show();
                                let _ = window.set_always_on_top(true);
                                let _ = window.set_focus();
                            }
                        }
                        "quit" => {
                            app.exit(0);
                        }
                        _ => {}
                    }
                })
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } = event
                    {
                        let app = tray.app_handle();
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.set_focus();
                        }
                    }
                })
                .build(app)?;

            println!("[Rust Backend] System tray initialized.");
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
