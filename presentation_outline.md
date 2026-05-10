# AI Marketing Studio - Presentation Script & Outline

**Total Duration:** 8 Minutes (6 min Presentation + 2 min Q&A)
**Language:** English Only
**Format:** Minimal Slides + Live Demo

---

## 1. Project Overview (0:30) - [Speaker 1]
*   **Goal:** Briefly explain what the project is.
*   **Hook:** "AI Marketing Studio automates the creation of 30-45 second vertical marketing videos for TikTok, Reels, and Shorts."
*   **The Problem:** Video production is slow and expensive for small businesses.
*   **The Solution:** Input a product image and description; get a fully rendered, narrated video in minutes.

---

## 2. Live Demo: Progress & Real Work (2:30) - [Speaker 2]
*   **Action:** Show the dashboard and start a new generation.
*   **Highlight Progress:**
    *   Show the **Landing Page** (Drag & drop image).
    *   Show the **Real-time Generation** (SSE progress updates).
    *   Show a **Completed Video** (Play the MP4 with captions and voiceover).
    *   Show the **Trim Feature** (Demonstrate a quick edit to the video).

---

## 3. Tech & Architecture (1:00) - [Speaker 3]
*   **The Stack:**
    *   **Frontend:** React + Vite + Framer Motion (Modern UI/UX).
    *   **Backend:** Node.js + Express + TypeScript.
    *   **AI Engine:** OpenAI (Scripts), Deepgram/ElevenLabs (Voice).
    *   **Media:** Pexels API for stock footage.
    *   **Rendering Pipe:** BullMQ + Redis + FFmpeg (Server-side rendering).

---

## 4. Challenges & Teamwork (1:00) - [All Speakers]
*   **Technical Challenges:** 
    *   Syncing voiceover timing with captions in FFmpeg.
    *   Managing heavy rendering jobs using background workers (BullMQ).
*   **Teamwork:**
    *   How we split frontend/backend/services.
    *   Clarity in API contracts to ensure smooth integration.

---

## 5. Next Steps & Expectations (1:00) - [Speaker 1]
*   **Roadmap:**
    *   Expanding media fallbacks with Stability AI.
    *   Adding support for multiple aspect ratios (Square/Landscape).
    *   Implementing a template system for different brand aesthetics.
*   **Conclusion:** Ready for production-scale beta testing.

---

## 6. Q&A (2:00) - [Everyone]
*   Be ready to answer questions about:
    *   API costs (OpenAI/Pexels).
    *   Rendering performance limitations.
    *   Copyright of generated content.

---

## Presentation Tips:
*   **Strict Timing:** Stick to the 6-minute window for the presentation.
*   **No Theory:** Don't talk about *what* AI could do; show *what your app actually does*.
*   **Clarity:** Use the modern UI demo to do the heavy lifting for your slides.
