# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Essential Commands

```bash
# Install dependencies
npm install

# Development server only (frontend at http://localhost:5173)
npm run dev

# Start backend server only (API at http://localhost:5900)
npm run server

# Run both frontend and backend simultaneously
npm run dev:all

# Production build
npm run build

# Preview production build
npm run preview
```

## High-level Architecture

### Core Application Flow
AI Shorts Studio is a React application that creates YouTube Shorts videos through a multi-stage pipeline:
1. **Script Generation**: User provides theme/topic → Gemini AI generates structured JSON script with scenes
2. **Media Processing**: Each scene generates images (Gemini) and audio (MiniMax) either sequentially or in parallel
3. **Video Composition**: Shotstack API combines media assets with transitions and effects into final video
4. **Distribution**: Videos uploaded to YouTube channels with metadata and scheduling

### Service Architecture
The application uses a dual-server architecture:
- **Frontend (Vite)**: React app on port 5173 for UI and orchestration
- **Backend (Express)**: Asset server on port 5900 for Shotstack media hosting and settings persistence

The backend server is crucial for video rendering as Shotstack requires publicly accessible URLs for media assets. The Express server stores base64 data as temporary assets and serves them via HTTP endpoints.

### State Management Strategy
- Central state management in `App.tsx` using React hooks (no Redux/Context API)
- Scripts persisted in localStorage with automatic save on changes
- Settings synchronized between UI and backend JSON files
- Tab-based navigation maintains isolated component state

### API Integration Architecture
All external services use a unified retry mechanism in `services/api.ts`:
- **Gemini AI**: Script and image generation with configurable prompts
- **MiniMax**: Korean TTS with voice model selection
- **Shotstack**: Video rendering with webhook support
- **YouTube**: Multi-channel OAuth2 integration

Each API has specific error handling for rate limits, content filtering, and service-specific failures.

## Critical Implementation Details

### Media Asset Workflow
The backend server (`server.js`) manages a critical asset pipeline:
1. Frontend generates base64-encoded media (images/audio)
2. Assets posted to `/api/assets/store` endpoint
3. Server returns public URLs accessible to Shotstack
4. Shotstack fetches media during rendering process
5. Assets remain cached for video re-rendering

This architecture solves CORS issues and provides reliable media access for the video rendering service.

### Scene Timing Synchronization
Each scene maintains precise timing data:
- `start_time` and `end_time` for video timeline
- Audio duration calculated from MiniMax responses
- Image display duration matches audio length
- Transitions handled by Shotstack timeline API

The timing system ensures audio-visual synchronization across all scenes.

### Settings Persistence Model
Settings are stored in dual locations:
- **Frontend**: React state for immediate UI updates
- **Backend**: JSON files in `src/` directory for persistence

Files include:
- `apikeys.json`: API credentials
- `short_script_prompt.json`: Script generation prompts
- `short_image_prompt.json`: Image style and prompts
- `voice_model.json`: TTS voice selection
- `image_generation_mode.json`: Sequential/parallel processing

### Error Recovery Patterns
The application implements multiple recovery strategies:
- **API Failures**: Exponential backoff with max 3 retries
- **Partial Generation**: Skip failed scenes and continue
- **Asset Fallbacks**: Use cached media when regeneration fails
- **State Recovery**: localStorage preserves work across sessions

## New File Naming Architecture (To Be Implemented)

### YouTube-Style Unique ID System
Each scenario will be assigned a unique 11-character YouTube-style ID (e.g., `2B6GHA4d0Jc`) for consistent file organization and media asset matching.

### Folder Structure
```
📁 data/
  📁 scenarios/
    📁 2B6GHA4d0Jc/                    # Unique scenario ID folder
      📁 Image/
        ├── 2B6GHA4d0Jc_Image1.jpg    # Scene 1 image
        ├── 2B6GHA4d0Jc_Image2.jpg    # Scene 2 image
        └── ...
      📁 Script/
        ├── 2B6GHA4d0Jc_Script.json   # Main script data
        └── 2B6GHA4d0Jc_Prompts.json  # Image prompts
      📁 Voice/
        ├── 2B6GHA4d0Jc_Voice1.mp3    # Scene 1 audio
        ├── 2B6GHA4d0Jc_Voice2.mp3    # Scene 2 audio
        └── ...
      📁 Srt/
        └── 2B6GHA4d0Jc_Subtitle.srt  # Generated subtitles
      └── 2B6GHA4d0Jc_metadata.json   # Scenario metadata
  📁 mp4/
    ├── 2B6GHA4d0Jc_video.mp4         # Rendered video
    └── 2B6GHA4d0Jc_video.json        # Upload metadata
```

### Benefits
- **Consistent Naming**: All files related to a scenario share the same ID prefix
- **Easy Matching**: No more timestamp-based mismatching issues
- **Organized Storage**: Clean separation by media type
- **Scalable**: Supports unlimited scenarios without conflicts

## Video Composition Details

### Visual Structure
The final video consists of layered components:
1. **Background Frame**: Black template with "빛나는 썰" header (9:16 ratio)
2. **Title Area**: Scenario title displayed below header
3. **Subtitle Area**: SRT captions synchronized with audio
4. **Content Area**: Square AI-generated images in center
5. **Watermark**: Shotstack logo (free tier)

### SRT Subtitle Generation
Subtitles are generated from script text:
1. Split text into 20-character lines
2. Calculate timing based on audio duration
3. Format in standard SRT structure:
```
1
00:00:00,000 --> 00:00:01,980
First line of subtitle

2
00:00:01,980 --> 00:00:03,960
Second line of subtitle
```

### Shotstack Rendering Pipeline
1. **Timeline Assembly**: Combine all tracks (header, title, subtitles, images, audio, BGM)
2. **API Request**: Send JSON configuration to Shotstack
3. **Status Polling**: Check rendering progress every 5 seconds
4. **Download**: Retrieve completed MP4 file
5. **Metadata**: Save YouTube upload information

### YouTube Upload Metadata
Each rendered video includes metadata for YouTube upload:
```json
{
  "title": "Video title for YouTube",
  "description": "Video description",
  "tags": ["#tag1", "#tag2"],
  "directory": "./data/mp4/2B6GHA4d0Jc_video.mp4",
  "status": "ready",
  "number": "2B6GHA4d0Jc_video"
}
```