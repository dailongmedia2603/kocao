# TikTok API

RESTful API for TikTok.

## Requirements

- Python 3.10+
- pip
- FFmpeg

### Install FFmpeg

```
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

### 2. Configure Environment Variables

Copy `env.example` to `.env` and customize settings:

```bash
cp env.example .env
```

Edit `.env` file with your preferred settings. All settings are optional and have sensible defaults.

## Usage

### Start the server

```bash
python main.py
```

Server will run at: **http://localhost:{API_PORT}** (default: http://localhost:8000)

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

### 7. Transcribe Video (OPTIMIZED)
```
POST http://localhost:8000/api/v1/transcribe
Content-Type: application/json

{
  "video_filename": "lephianhdev_001_7521704507173227784.mp4",
  "language": "vi",
  "model_size": "medium",
  "beam_size": 5,
  "vad_filter": true,
  "compute_type": "auto"
}
```

**Parameters:**
- `video_filename`: Video file name in uploads directory (required)
- `language`: Language code (`vi`, `en`, `zh`, etc.) or `null` for auto-detect
- `model_size`: Whisper model size (now much faster!)
  - `tiny`: Fastest, lowest accuracy
  - `base`: Fast and good quality
  - `small`: Better accuracy, still fast
  - `medium`: High accuracy, **recommended** (now faster than old base!)
  - `large-v2`, `large-v3`: Best accuracy, optimized speed
- `beam_size`: Decoding quality (1=fastest, 5=balanced, 10=best) - optional, default: 5
- `vad_filter`: Enable Voice Activity Detection for 2-3x speedup - optional, default: true
- `compute_type`: Quantization (`int8`, `float16`, `float32`, `auto`) - optional, default: auto

**Response:** Returns full text + segments with timestamps

**Performance Tips:**
- Use `vad_filter=true` for videos with silence (TikTok, YouTube) - free 2-3x speedup!
- Use `beam_size=1` for maximum speed (greedy decoding)
- Use `compute_type="auto"` for optimal speed (INT8 on CPU, FP16 on GPU)
- Medium model with optimizations is now faster than old base model!

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

- First transcription will be slower (downloading and loading Whisper model)
- **Optimizations applied:** 4-10x faster than before with same accuracy
- GPU auto-detected and utilized if available (3-5x additional speedup)
- VAD (Voice Activity Detection) automatically skips silent parts
- Auto language detection works well for most cases
- Transcription files saved permanently until manually deleted
- Supports 90+ languages including Vietnamese, English, Chinese, Japanese, Korean, etc.
