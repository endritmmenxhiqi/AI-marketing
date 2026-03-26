# AI Marketing - MVP

AI-powered marketing tool for creating catchy text and professional videos for TikTok, Instagram Reels, and YouTube Shorts.

## Core Features
1. **User Input Form**: Collects product details, keywords, and desired style.
2. **AI Generation**: Produces catchy captions and relevant hashtags using an LLM.
3. **Video Generation**: Assembles short videos using stock media and FFmpeg with text overlays.
4. **AI Voiceover**: Converts generated captions into high-quality speech.
5. **Export & Preview**: Renders final MP4 videos with a preview option.

## Tech Stack
- **Backend**: Node.js, Express
- **Frontend**: React (Vite), Vanilla CSS
- **Database**: MongoDB (Atlas)
- **AI Services**: OpenAI (GPT-4), ElevenLabs/Google TTS
- **Video Processing**: FFmpeg
- **Media**: Pexels/Pixabay APIs

## Directory Structure
- `backend/`: Node.js Express server.
- `frontend/`: React Vite application.

## Prerequisites
- Node.js installed.
- MongoDB Atlas account.
- FFmpeg installed on your system.
- API keys for OpenAI and Pexels.

## Getting Started

### Backend
1. Navigate to `backend/`.
2. Copy `.env.example` to `.env` and fill in your keys.
3. Run `npm install`.
4. Run `npm start`.

### Frontend
1. Navigate to `frontend/`.
2. Run `npm install`.
3. Run `npm run dev`.
