# SKILL.md

# Project Skills

This document defines the knowledge system and implementation philosophy for the AI agent.

---

# OCR Skill

## Purpose

Extract text from images or screenshots.

---

# OCR Rules

* Use Tesseract.js
* OCR must run asynchronously
* OCR should prioritize English accuracy
* OCR results must be cleaned before translation

---

# OCR Best Practices

Recommended preprocessing:

* grayscale conversion
* contrast enhancement
* image sharpening

Avoid:

* processing extremely large screenshots
* blocking UI during OCR

---

# Translation Skill

## Purpose

Translate extracted or selected text.

---

# Translation Rules

* Translation must feel instant
* Use lightweight APIs first
* Avoid unnecessary API calls
* Cache repeated translations

---

# Translation Workflow

Input Text
↓
Detect Language
↓
Translate
↓
Return Structured Result

---

# Clipboard Skill

## Purpose

Read selected text globally.

---

# Clipboard Workflow

User Selects Text
↓
Simulate Ctrl + C
↓
Read Clipboard
↓
Translate

---

# Clipboard Rules

* Never overwrite clipboard permanently
* Restore previous clipboard if necessary
* Handle empty clipboard safely

---

# Popup Skill

## Purpose

Display translation result elegantly.

---

# Popup Rules

Popup must:

* appear near cursor
* avoid covering selected text
* auto-hide gracefully
* support future expansion

---

# Popup UX Rules

The popup should:

* feel lightweight
* appear instantly
* never steal focus aggressively

---

# Overlay Skill

## Purpose

Allow OCR screen selection.

---

# Overlay Rules

Overlay must:

* cover fullscreen
* darken background slightly
* support smooth drag selection
* capture correct coordinates

---

# Overlay Best Practices

* use transparent window
* avoid lag
* support multi-monitor systems

---

# Hotkey Skill

## Purpose

Provide global access to translation features.

---

# Hotkey Rules

Default:

* Ctrl + Q → Selected text translation
* Ctrl + Shift + Q → OCR translation

---

# Hotkey Best Practices

* avoid conflicting shortcuts
* allow customization in future
* keep shortcuts memorable

---

# Performance Skill

## Goals

The application must:

* launch quickly
* remain lightweight
* avoid memory leaks
* minimize CPU usage

---

# Performance Rules

* lazy load heavy modules
* avoid blocking main thread
* optimize OCR operations
* debounce repeated actions

---

# Error Handling Skill

## Rules

The app should:

* fail gracefully
* never crash silently
* display fallback messages
* log internal errors

---

# AI Feature Skill

## Future Purpose

Transform the application into an AI learning assistant.

---

# Future AI Features

* grammar explanation
* contextual translation
* vocabulary analysis
* pronunciation analysis
* sentence breakdown

---

# Architecture Philosophy

The project architecture should remain:

* modular
* scalable
* AI-readable
* maintainable
* feature-oriented

---

# Development Philosophy

The project prioritizes:

1. user experience
2. speed
3. simplicity
4. maintainability
5. scalability
