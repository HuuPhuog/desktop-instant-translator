# UX_REFACTOR_PHASE.md

# UX Refactor Phase — Invisible Productivity Tool Vision

## Overview

The application has successfully completed its core functionality phases:

* selected text translation
* OCR translation
* AI explanation
* translation history
* polished popup UI

The next evolution of the project is no longer feature-focused.

The goal now is:

> Transform the application from a “translator app” into an “invisible productivity assistant”.

This phase focuses entirely on:

* UX refinement
* interaction simplification
* reducing cognitive load
* improving workflow speed
* minimizing UI interruption

---

# Core UX Philosophy

The best translation experience is:

* instant
* lightweight
* contextual
* almost invisible

The application should feel like:

* a native operating system feature
* a productivity utility
* a smart assistant

NOT:

* a heavy dashboard application
* a full-screen translator
* a chatbot interface

---

# UX Problems in Current Version

## Current Issues

### 1. Main Window Feels Too Important

Current UX:

* large dashboard
* centered content
* too much empty space

Problem:
Users should not need to interact with the main window frequently.

---

### 2. Translation Popup Is Too Large

Current popup:

* occupies too much visual space
* blocks learning content
* resembles a modal card

Problem:
Translation should feel lightweight and contextual.

---

### 3. AI Information Overload

Current direction risks:

* too much grammar info
* large explanation panels
* excessive text

Problem:
Users primarily want quick understanding first.

---

### 4. OCR Flow Can Feel Heavy

Potential problems:

* overlay too cinematic
* transitions too slow
* too many visual effects

Problem:
OCR should feel instant and frictionless.

---

# New Product Direction

# Product Identity

The application should evolve into:

> A lightweight background desktop assistant for language learning.

Core characteristics:

* hotkey-first
* tray-first
* inline-first
* minimal UI
* progressive disclosure

---

# Main UX Direction

# 1. Tray-First Architecture

## Goal

The application should primarily live in the system tray.

Users should:

* install app
* keep it running in background
* interact through hotkeys

The main window becomes:

* settings center
* history manager
* configuration page

NOT the main interaction point.

---

# Recommended Tray Features

* quick enable/disable
* OCR trigger
* settings access
* quit application
* startup toggle

---

# 2. Tooltip-First Translation UI

## Goal

Replace large translation cards with compact tooltip-style UI.

---

# Recommended Default Translation UI

Example:

implementation
→ triển khai

or:

━━━━━━━━━━
implementation
triển khai
━━━━━━━━━━

---

# UX Goals

Translation popup should:

* feel instant
* feel contextual
* avoid blocking content
* disappear naturally

---

# Popup Size Rules

Recommended:

* max width: 280–320px
* dynamic height
* adaptive sizing

Avoid:

* large cards
* large paragraphs
* oversized spacing

---

# 3. Progressive Disclosure UX

## Goal

Show only essential information first.

---

# Default View

Show:

* translated meaning
* pronunciation

---

# Expanded View

Only when requested:

* grammar explanation
* AI analysis
* examples
* vocabulary breakdown

---

# UX Principle

Do not overwhelm users immediately.

AI should feel optional and assistive.

---

# 4. Smart Translation Modes

## Goal

The application should intelligently detect user intent.

---

# Recommended Behavior

## If text is selected:

→ use selected text translation

## If no selectable text:

→ fallback to OCR mode

## If subtitles detected continuously:

→ optional subtitle tracking mode

---

# Result

The application feels:

* intelligent
* automatic
* seamless

---

# 5. OCR Overlay Redesign

## Goal

OCR interaction should feel instant and lightweight.

---

# Recommended Overlay Style

Use:

* light dim background
* minimal blur
* bright selection rectangle
* instant response

Avoid:

* cinematic animations
* dramatic transitions
* excessive glow effects

---

# Inspiration

Recommended UX references:

* Windows Snipping Tool
* ShareX
* CleanShot X

---

# 6. Popup Positioning Improvements

## Goal

Popup should intelligently avoid covering important content.

---

# Recommended Position Logic

If cursor near:

* right edge → popup appears left
* bottom edge → popup appears above
* center → popup appears below/right

---

# Requirements

* edge-aware positioning
* collision detection
* smooth repositioning

---

# 7. Quick Actions System

## Goal

Provide lightweight contextual actions.

---

# Recommended Actions

Inside popup:

* Copy
* Save
* Explain
* Replay pronunciation

Keep actions:

* icon-based
* compact
* secondary

---

# 8. AI-On-Demand Architecture

## Goal

AI explanation should NOT appear automatically.

---

# Recommended Flow

Default:

* show translation only

User clicks:

* Explain

Then:

* lazy load AI explanation

---

# Benefits

* faster perceived performance
* less visual overload
* lower API cost
* cleaner UI

---

# 9. Main Window Refactor

## Goal

Transform main window into a compact control center.

---

# Recommended Sections

## General

* startup settings
* language settings
* tray behavior

## Hotkeys

* OCR shortcut
* translate shortcut

## AI

* API status
* AI enable/disable

## History

* clear history
* export history

## About

* version
* updates

---

# Remove

Avoid:

* large hero sections
* centered empty layouts
* oversized dashboard cards

---

# 10. Performance UX Goals

## Startup Time

Target:
< 2 seconds

---

# OCR Speed

Target:
< 1 second

---

# Popup Display

Target:
< 300ms

---

# Memory Usage

Target:
< 300MB RAM

---

# 11. Recommended Design Language

## Recommended

* minimal dark UI
* Fluent Windows style
* subtle glassmorphism
* compact utility UI

---

# Avoid

* cyberpunk neon
* overly futuristic effects
* excessive animations
* gaming aesthetics

---

# Design Inspirations

Recommended references:

* Raycast
* Ddict
* ShareX
* PowerToys
* CleanShot X
* macOS Spotlight
* Grammarly desktop

---

# 12. Final Product Vision

The final application should feel like:

> A native desktop productivity utility for instant language understanding.

Users should:

* forget the app is running
* rely on it naturally
* use it dozens of times daily without friction

The application should become:

* invisible
* fast
* contextual
* dependable
* habit-forming

---

# Long-Term UX Philosophy

The best UX is not:

* more features
* bigger interfaces
* more AI panels

The best UX is:

* fewer interruptions
* fewer clicks
* faster understanding
* smoother workflow

The application should disappear into the user's workflow while still providing powerful assistance.
