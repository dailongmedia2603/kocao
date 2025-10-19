# TikTok API

RESTful API for scraping TikTok channel videos, metadata, and **speech-to-text transcription** using FastAPI, yt-dlp, and OpenAI Whisper.

## Requirements

- Python 3.10+
- pip
- FFmpeg

### Install FFmpeg

**Windows:**
1. Download from https://ffmpeg.org/download.html
2. Extract and add to PATH
```

## Installation

### 1. Create, activate virtual env and install dependencies

```bash
python -m venv env
env\Scripts\activate
pip install -r requirements.txt
```

**Note:** First installation may take time (downloading Whisper models ~150MB-3GB depending on model size)

## Usage

### Start the server

```bash
python main.py
```

Server will run at: **http://localhost:8000**

### Access API Documentation

- **Swagger UI**: http://localhost:8000/docs
- **ReDoc**: http://localhost:8000/redoc

## API Endpoints

### 1. Health Check
```
GET http://localhost:8000/
GET http://localhost:8000/health
```

### 2. Get Channel Metadata (No Download)
```
POST http://localhost:8000/api/v1/metadata
Content-Type: application/json

{
  "channel_link": "@username",
  "max_videos": null
}
```

**Parameters:**
- `channel_link`: TikTok channel URL or username (e.g., `@lephianhdev` or `https://www.tiktok.com/@lephianhdev`)
- `max_videos`: Maximum number of videos to process (optional, `null` = all videos)

### 3. Download Videos
```
POST http://localhost:8000/api/v1/download
Content-Type: application/json

{
  "channel_link": "@username",
  "max_videos": 10
}
```

### 4. Get Saved Metadata File
```
GET http://localhost:8000/api/v1/metadata/{username}
```

### 5. List Downloaded Videos
```
GET http://localhost:8000/api/v1/videos/list
```

### 6. Download Specific Video File
```
GET http://localhost:8000/api/v1/videos/{filename}
```

### 7. Transcribe Video
```
POST http://localhost:8000/api/v1/transcribe
Content-Type: application/json

{
  "video_filename": "lephianhdev_001_7521704507173227784.mp4",
  "language": "vi",
  "model_size": "base"
}
```

**Parameters:**
- `video_filename`: Video file name in uploads directory (required)
- `language`: Language code (`vi`, `en`, `zh`, etc.) or `null` for auto-detect
- `model_size`: Whisper model size
  - `tiny`: Fastest, lowest accuracy (~39MB)
  - `base`: Good balance, **recommended** (~74MB)
  - `small`: Better accuracy (~244MB)
  - `medium`: High accuracy (~769MB)
  - `large`: Best accuracy (~1.5GB)

**Response:** Returns full text + segments with timestamps

### 8. List Transcriptions
```
GET http://localhost:8000/api/v1/transcriptions/list
```

### 9. Download Transcription File
```
GET http://localhost:8000/api/v1/transcription/{video_name}
```

Example: `GET http://localhost:8000/api/v1/transcription/lephianhdev_001_7521704507173227784`

## Notes

- First transcription will be slower (loading Whisper model)
- Larger models = better accuracy but slower speed
- Auto language detection works well for most cases
- Transcription files saved permanently until manually deleted
- Supports 90+ languages including Vietnamese, English, Chinese, Japanese, Korean, etc.