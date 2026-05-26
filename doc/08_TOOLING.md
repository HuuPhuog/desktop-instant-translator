# TOOLING.md

# Technology Stack

## Desktop Framework

### Tauri

Purpose:

* create lightweight desktop application
* integrate Rust backend with React frontend
* build Windows executable

Reasons:

* low memory usage
* smaller app size than Electron
* faster startup
* modern architecture

---

# Frontend

## React

Purpose:

* build user interface
* popup UI
* settings UI
* overlay components

---

## TypeScript

Purpose:

* type safety
* maintainable code
* better scalability

---

## TailwindCSS

Purpose:

* rapid UI development
* minimal styling system
* consistent design

---

# Backend

## Rust

Purpose:

* native performance
* system integration
* screen capture
* global shortcuts

---

# OCR

## Tesseract.js

Purpose:

* extract text from screenshots
* OCR processing

Supported:

* English OCR first

Future:

* Japanese
* Korean
* Vietnamese

---

# Translation APIs

## Phase 1

Google Translate API

Purpose:

* lightweight translation
* fast translation speed

---

## Phase 2

OpenAI API

Purpose:

* grammar explanation
* vocabulary explanation
* AI translation enhancement

---

# Clipboard

## Tauri Clipboard Plugin

Purpose:

* read selected text
* access clipboard content

---

# Global Shortcuts

## Tauri Global Shortcut Plugin

Purpose:

* register system-wide hotkeys

Examples:

* Ctrl + Q
* Ctrl + Shift + Q

---

# State Management

## Zustand

Purpose:

* lightweight state management
* simple architecture

---

# Overlay System

## Transparent Fullscreen Window

Purpose:

* region selection
* OCR capture area

---

# Build Tools

## Vite

Purpose:

* fast frontend development
* hot reload
* optimized builds

---

# Packaging

## Tauri Build

Command:

npm run tauri build

Output:

* setup.exe
* Windows installer

---

# Recommended VSCode Extensions

* ES7+ React snippets
* Tailwind CSS IntelliSense
* Rust Analyzer
* Prettier
* Error Lens
* Path IntelliSense

---

# Recommended Development Environment

OS:

* Windows 10/11

Required:

* Node.js
* Rust
* Visual Studio Build Tools
* VSCode
