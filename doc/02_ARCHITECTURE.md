# ARCHITECTURE.md

# System Architecture

## High-Level Architecture

┌───────────────────────────┐
│        React UI           │
│   Popup / Overlay / UI    │
└─────────────┬─────────────┘
│
▼
┌───────────────────────────┐
│      Tauri Commands       │
│     React ↔ Rust IPC      │
└─────────────┬─────────────┘
│
┌────────────┼─────────────┐
▼            ▼             ▼

Clipboard   OCR Engine   Screen Capture
Service      Service       Service

```
          │
          ▼

  Translation Service

          │
          ▼

     Popup Renderer
```

---

# Core Modules

## 1. Hotkey Manager

Purpose:

* register global shortcuts
* trigger translation modes

Responsibilities:

* handle Ctrl + Q
* handle Ctrl + Shift + Q
* dispatch events

---

# 2. Clipboard Service

Purpose:

* retrieve selected text

Flow:

* simulate Ctrl + C
* read clipboard content
* send text to translation service

---

# 3. OCR Service

Purpose:

* extract text from screenshots

Responsibilities:

* image preprocessing
* OCR recognition
* text cleanup

Future Improvements:

* image sharpening
* denoise
* language detection

---

# 4. Translation Service

Purpose:

* translate extracted text

Responsibilities:

* detect language
* call translation API
* return translated result

Future:

* AI grammar explanation
* contextual translation

---

# 5. Overlay System

Purpose:

* allow user to select screen region

Features:

* fullscreen transparent layer
* drag selection
* coordinate tracking

---

# 6. Popup System

Purpose:

* display translation result

Features:

* floating popup
* auto close
* copy button
* dark mode

---

# Data Flow

# Selected Text Translation

User Select Text
↓
Ctrl + Q
↓
Clipboard Service
↓
Translation Service
↓
Popup System

---

# OCR Translation Flow

Ctrl + Shift + Q
↓
Overlay System
↓
Capture Service
↓
OCR Service
↓
Translation Service
↓
Popup System

---

# IPC Communication

## React → Rust

Used for:

* screen capture
* global shortcuts
* native APIs

---

# Rust → React

Used for:

* translation results
* OCR status
* hotkey events

---

# Error Handling

The application must:

* fail gracefully
* never crash on OCR failure
* display fallback messages
* log errors internally

---

# Performance Goals

* startup < 2 seconds
* popup response < 500ms
* lightweight memory usage
* minimal CPU usage

---

# Future Scalability

The architecture should support:

* plugins
* AI features
* multiple OCR engines
* cloud sync
* multi-language support
