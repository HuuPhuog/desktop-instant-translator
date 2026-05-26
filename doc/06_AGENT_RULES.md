# AGENT_RULES.md

# AI Agent Rules

## General Rules

* Always use TypeScript
* Always use React functional components
* Always use Tauri
* Never use Electron
* Never use jQuery
* Never use class components in React
* Keep code modular
* Prefer reusable components

---

# UI Rules

* Use TailwindCSS
* Keep UI minimal
* Use dark mode first
* Avoid large modal windows
* Popup must be small and lightweight
* Use smooth animations only when necessary

---

# Architecture Rules

* Separate UI logic from business logic
* Keep services isolated
* Use modular folder structure
* Use feature-based architecture
* Avoid deeply nested components

---

# Performance Rules

* Optimize OCR usage
* Avoid unnecessary renders
* Use lazy loading when possible
* Minimize memory usage
* Keep startup time fast

---

# OCR Rules

* Use Tesseract.js
* OCR must run asynchronously
* OCR should support English first
* Region capture must be optimized

---

# Translation Rules

* Translation must be fast
* Prefer lightweight APIs
* Cache repeated translations when possible

---

# Hotkey Rules

* Global shortcuts must work system-wide
* Hotkeys must be customizable in future
* Avoid conflicts with common shortcuts

---

# Popup Rules

Popup must:

* appear near cursor
* auto-hide when necessary
* support copy action
* support drag movement in future

---

# File Structure Rules

Use:

src/
├── components/
├── features/
├── services/
├── hooks/
├── store/
├── utils/

Never place all logic inside one file.

---

# State Management Rules

Use:

* Zustand

Avoid:

* Redux unless necessary

---

# Styling Rules

Use:

* TailwindCSS

Avoid:

* inline CSS
* large CSS files

---

# Code Quality Rules

* Use async/await
* Avoid callback hell
* Use descriptive naming
* Write readable code
* Prefer maintainability over cleverness

---

# Security Rules

* Never expose API keys
* Store sensitive values in environment variables
* Sanitize user input when necessary

---

# Development Philosophy

The application should feel:

* fast
* lightweight
* modern
* distraction-free
