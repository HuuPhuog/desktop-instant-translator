# 🌐 Desktop Instant Translator

Một phần mềm dịch thuật tức thì trên màn hình nền (Desktop App) được xây dựng bằng **Tauri v2**, **React**, **TypeScript** và **Rust**. Ứng dụng tích hợp dịch văn bản bôi đen nhanh, chụp ảnh màn hình trích xuất chữ viết (OCR) và Trợ lý học tập AI (AI Learning Assistant) để hỗ trợ học ngoại ngữ toàn diện.

---

## ✨ Tính năng nổi bật

### 1. Dịch thuật tức thì (`Ctrl + Q`)
* Bôi đen văn bản ở bất kỳ ứng dụng nào (Chrome, Notepad, VS Code, v.v.).
* Nhấn tổ hợp phím **`Ctrl + Q`** để tự động copy, dịch và hiển thị kết quả ngay tại vị trí con trỏ chuột.

### 2. Dịch ảnh màn hình OCR (`Ctrl + Shift + Q`)
* Nhấn tổ hợp phím **`Ctrl + Shift + Q`** để kích hoạt lớp phủ màn hình mờ.
* Kéo chuột trái để chọn bất kỳ vùng ảnh nào chứa văn bản.
* Nhận diện chữ viết bằng **Tesseract.js (WebAssembly)** và hiển thị kết quả dịch thuật tức thì.

### 3. Trợ lý học tập trí tuệ nhân tạo (AI Assistant)
* **Phân tích ngữ pháp (Grammar breakdown)**: Phân tích cấu trúc ngữ pháp câu nguồn.
* **Giải nghĩa từ vựng (Vocabulary analysis)**: Trích xuất các từ mới nổi bật kèm nghĩa và ví dụ.
* **Phiên âm quốc tế (IPA)**: Hỗ trợ phiên âm cách đọc của câu.
* **Tạo câu ví dụ (Example sentences)**: Giúp người dùng ghi nhớ ngữ cảnh sử dụng từ.
* Hỗ trợ API Key OpenAI hoặc chế độ demo offline tự động (Mock AI).

### 4. Hệ thống Lịch sử Dịch thuật (History Panel)
* Lưu trữ lịch sử dịch thuật tự động dưới Local Storage thông qua **Zustand Persistence**.
* Hỗ trợ tìm kiếm lịch sử, sao chép nhanh, xóa từng mục hoặc xóa toàn bộ lịch sử.

### 5. Giao diện Premium (UI/UX Guidelines)
* Giao diện tối hiện đại (Dark Mode mặc định).
* Hiệu ứng kính mờ (Glassmorphism), bo góc mềm mại, bóng đổ cao cấp.
* Hoạt ảnh chuyển cảnh mượt mà, phản hồi nhanh chóng (dưới 150ms).

---

## 🛠️ Công nghệ sử dụng

* **Frontend**: React (Vite), TypeScript, Zustand (Quản lý trạng thái & Persistence).
* **Styling**: Tailwind CSS v4 & Vanilla CSS.
* **Backend**: Rust, Tauri v2.
* **OCR**: Tesseract.js (chạy Web Worker xử lý offline tốc độ cao).
* **Keyboard Simulation**: Enigo (Rust).
* **Screenshot Capture**: Screenshots (Rust) hỗ trợ đa màn hình & DPI Scaling.

---

## 📂 Cấu trúc dự án

```text
├── src-tauri/                 # Backend Rust (Tauri)
│   ├── capabilities/          # Định cấu hình quyền hạn (default.json)
│   ├── src/
│   │   ├── lib.rs             # Xử lý chụp ảnh màn hình & giả lập Copy
│   │   └── main.rs
│   └── tauri.conf.json        # Cấu hình cửa sổ chính & cửa sổ overlay
├── src/                       # Frontend React
│   ├── components/
│   │   ├── history/           # HistoryPanel hiển thị lịch sử dịch
│   │   ├── overlay/           # Lớp phủ màn hình ScreenOverlay kéo chọn OCR
│   │   └── popup/             # Cửa sổ dịch thuật & AI Learning Panel
│   ├── hooks/
│   │   ├── useGlobalHotkey.ts # Đăng ký phím tắt toàn cục và quản lý sự kiện
│   │   └── useTranslation.ts  # Hook điều khiển luồng dịch thuật
│   ├── services/
│   │   ├── ai.ts              # Kết nối OpenAI / Mock AI
│   │   ├── hotkey.ts          # Tauri global shortcut API
│   │   ├── ocr.ts             # Gọi Rust chụp màn hình & chạy Tesseract.js
│   │   └── translation.ts     # Gọi API dịch thuật miễn phí
│   ├── stores/                # Zustand Stores (translation, history, ai)
│   ├── styles/                # CSS variables và Tailwind styling
│   ├── App.tsx                # Trang chủ quản lý cài đặt ứng dụng
│   └── main.tsx               # Entrypoint & Router điều hướng cửa sổ
```

---

## 🚀 Hướng dẫn cài đặt & Chạy thử

### 📋 Yêu cầu hệ thống
* Cài đặt **Node.js** (v18 trở lên).
* Cài đặt **Rust & Cargo** (Xem hướng dẫn tại [Tauri Setup](https://tauri.app/start/prerequisites/)).

### 🔧 Các bước thực hiện
1. **Clone dự án và cài đặt dependencies**:
   ```bash
   npm install
   ```

2. **Chạy ứng dụng trong môi trường phát triển (Dev Mode)**:
   ```bash
   npm run tauri dev
   ```

3. **Đóng gói ứng dụng thành file cài đặt (.exe)**:
   ```bash
   npm run tauri build
   ```

---

## ⌨️ Danh sách phím tắt hệ thống

| Phím tắt | Chức năng | Phạm vi hoạt động |
| :--- | :--- | :--- |
| **`Ctrl + Q`** | Dịch nhanh văn bản đang bôi đen | Toàn màn hình (Global) |
| **`Ctrl + Shift + Q`** | Kích hoạt chụp ảnh màn hình dịch OCR | Toàn màn hình (Global) |
| **`Click Chuột Phải`** | Hủy chế độ chụp ảnh màn hình OCR | Khi đang ở chế độ chụp |
| **`ESC`** | Đóng nhanh cửa sổ kết quả / Hủy phân tích AI | Khi cửa sổ popup đang hiển thị |

---

## 💡 Lưu ý quan trọng khi phát triển (Tauri v2)

1. **Quyền hạn cửa sổ (Capabilities)**:
   * Tất cả các quyền liên quan đến phím tắt (`global-shortcut`), quản lý cửa sổ (`window:allow-show`, `window:allow-set-focus`, v.v.) phải được khai báo tường minh trong `src-tauri/capabilities/default.json`.

2. **Tọa độ hiển thị DPI**:
   * Khi gọi hàm chụp màn hình của Rust, tọa độ kéo chuột từ React (Logical CSS Pixels) đã được nhân tự động với `scaleFactor` của màn hình để đảm bảo Rust chụp đúng vùng hiển thị vật lý (Physical Pixels) trên Windows.

---

Chúc bạn có trải nghiệm dịch thuật và học ngoại ngữ tuyệt vời với **Desktop Instant Translator**!
