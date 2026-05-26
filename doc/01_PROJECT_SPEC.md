# PROJECT_SPEC.md

# Desktop Instant Translator

## Overview

Desktop Instant Translator is a Windows desktop application that allows users to instantly translate English text appearing anywhere on the screen.

The application supports:

* translating selected text
* OCR translation from images/videos/subtitles
* floating popup translations
* global hotkeys
* instant workflow without switching applications

The application is inspired by:

* Ddict
* Google Lens
* Screen Translator

---

# Main Goals

The application aims to:

* reduce interruption during learning
* improve English learning workflow
* provide instant translation everywhere on desktop
* combine OCR + text selection translation

---

# Core Features

## 1. Selected Text Translation

### Workflow

User selects text
↓
Press hotkey
↓
Application copies selected text
↓
Read clipboard
↓
Translate text
↓
Show popup translation

### Hotkey

Ctrl + Q

---

## 2. OCR Screen Translation

### Workflow

User presses OCR hotkey
↓
Fullscreen overlay appears
↓
User selects screen region
↓
Capture screenshot
↓
OCR detects text
↓
Translate detected text
↓
Show popup

### Hotkey

Ctrl + Shift + Q

---

# Technical Goals

* lightweight desktop application
* low RAM usage
* fast startup
* modular architecture
* scalable codebase
* AI-friendly structure

---

# Main Technologies

## Frontend

* React
* TypeScript
* TailwindCSS

## Desktop

* Tauri
* Rust

## OCR

* Tesseract.js

## Translation

* Google Translate API
* OpenAI API (future)

---

# MVP Scope

The first MVP version should include:

* global hotkeys
* selected text translation
* OCR translation
* popup UI
* clipboard reading

Do NOT include:

* login
* cloud sync
* authentication
* advanced AI features

---

# Future Features

* AI grammar explanation
* pronunciation
* vocabulary saving
* flashcards
* translation history
* auto subtitle translation
* multi-language support

---

# User Experience Goals

The application must:

* feel instant
* not interrupt learning
* use minimal UI
* support dark mode
* work globally across Windows
