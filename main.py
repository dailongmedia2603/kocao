from fastapi import FastAPI, HTTPException, BackgroundTasks, Query
from fastapi.responses import JSONResponse, FileResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field
from typing import Optional, List, Dict
from pathlib import Path
import uvicorn
import json
from datetime import datetime
import os
from dotenv import load_dotenv

from tiktok_scraper import SimpleTikTokScraper
from transcriber import WhisperTranscriber

# Load environment variables
load_dotenv()

# Configuration from environment variables
API_VERSION = os.getenv("API_VERSION", "2.0.0")
API_HOST = os.getenv("API_HOST", "0.0.0.0")
API_PORT = int(os.getenv("API_PORT", "8000"))
API_RELOAD = os.getenv("API_RELOAD", "true").lower() == "true"
API_LOG_LEVEL = os.getenv("API_LOG_LEVEL", "info")

CORS_ALLOW_ORIGINS = os.getenv("CORS_ALLOW_ORIGINS", "*").split(",")
CORS_ALLOW_CREDENTIALS = os.getenv("CORS_ALLOW_CREDENTIALS", "true").lower() == "true"
CORS_ALLOW_METHODS = os.getenv("CORS_ALLOW_METHODS", "*").split(",")
CORS_ALLOW_HEADERS = os.getenv("CORS_ALLOW_HEADERS", "*").split(",")

UPLOAD_DIR = os.getenv("UPLOAD_DIR", "uploads")
MAX_VIDEOS_LIMIT = int(os.getenv("MAX_VIDEOS_LIMIT", "1000"))

# Storage URL configuration for returning public URLs instead of direct file responses
STORAGE_BASE_URL = os.getenv("STORAGE_BASE_URL", f"http://localhost:{API_PORT}/storage")

WHISPER_MODEL_NAME = os.getenv("WHISPER_MODEL_NAME", "base")
WHISPER_DEVICE = os.getenv("WHISPER_DEVICE", "auto")
WHISPER_COMPUTE_TYPE = os.getenv("WHISPER_COMPUTE_TYPE", "auto")

app = FastAPI(
    title="TikTok Scraper API",
    description="""
    RESTful API for scraping TikTok channel videos, metadata, and speech-to-text transcription.
    
    **NOTE**: All APIs are currently PUBLIC for easy testing and integration.
    CORS is configured to allow all origins (*).
    Future updates will include domain restrictions and authentication.
    """,
    version=API_VERSION,
    docs_url="/docs",
    redoc_url="/redoc"
)

# CORS Configuration - Currently PUBLIC
# NOTE: This allows all origins for easy testing and development.
# TODO: Restrict CORS_ALLOW_ORIGINS to specific domains in production
# Example: CORS_ALLOW_ORIGINS=https://yourdomain.com,https://app.yourdomain.com
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ALLOW_ORIGINS,
    allow_credentials=CORS_ALLOW_CREDENTIALS,
    allow_methods=CORS_ALLOW_METHODS,
    allow_headers=CORS_ALLOW_HEADERS,
)

scraper = SimpleTikTokScraper(download_path=UPLOAD_DIR)
# Initialize with optimized settings (auto-detect GPU, use INT8/FP16 quantization)
transcriber = WhisperTranscriber(
    model_name=WHISPER_MODEL_NAME,
    device=None if WHISPER_DEVICE == "auto" else WHISPER_DEVICE,
    compute_type=WHISPER_COMPUTE_TYPE
)

# Mount static files directory for serving uploaded videos and transcriptions
# This allows direct access to files via /storage/{filename}
# Note: In production, it's recommended to use Nginx to serve static files
upload_path = Path(UPLOAD_DIR)
upload_path.mkdir(parents=True, exist_ok=True)
app.mount("/storage", StaticFiles(directory=str(upload_path)), name="storage")

class ChannelRequest(BaseModel):
    channel_link: str = Field(..., description="TikTok channel URL or username (e.g., @username or https://www.tiktok.com/@username)")
    max_videos: Optional[int] = Field(None, description="Maximum number of videos to process (None = all videos)", ge=1, le=MAX_VIDEOS_LIMIT)

    class Config:
        json_schema_extra = {
            "example": {
                "channel_link": "@lephianhdev",
                "max_videos": None
            }
        }

class VideoMetadata(BaseModel):
    video_id: str
    title: str
    description: str
    duration: int
    view_count: int
    like_count: int
    comment_count: int
    repost_count: int
    uploader: str
    upload_date: str
    webpage_url: str

class MetadataResponse(BaseModel):
    success: bool
    message: str
    username: str
    total_videos: int
    videos: List[VideoMetadata]
    metadata_file_url: Optional[str] = None
    timestamp: str

class DownloadResponse(BaseModel):
    success: bool
    message: str
    username: str
    downloaded: int
    videos_list_url: Optional[str] = None
    timestamp: str

class StatusResponse(BaseModel):
    status: str
    service: str
    version: str
    timestamp: str

class TranscribeRequest(BaseModel):
    video_filename: str = Field(..., description="Video filename in uploads directory")
    language: Optional[str] = Field(None, description="Language code (e.g., 'vi', 'en'). None for auto-detect")
    model_size: Optional[str] = Field("base", description="Whisper model size: tiny, base, small, medium, large-v2, large-v3")
    beam_size: Optional[int] = Field(5, description="Beam size for decoding (1=fastest, 5=balanced, 10=best quality)", ge=1, le=10)
    vad_filter: Optional[bool] = Field(True, description="Enable Voice Activity Detection to skip silence (recommended for speed)")
    compute_type: Optional[str] = Field("auto", description="Quantization: int8 (fastest), float16 (GPU), float32 (full), auto")
    
    class Config:
        json_schema_extra = {
            "example": {
                "video_filename": "lephianhdev_001_7521704507173227784.mp4",
                "language": "vi",
                "model_size": "base",
                "beam_size": 5,
                "vad_filter": True,
                "compute_type": "auto"
            }
        }

class TranscriptionSegment(BaseModel):
    id: int
    start: float
    end: float
    text: str
    duration: float

class TranscribeResponse(BaseModel):
    success: bool
    message: str
    video_filename: str
    text: str
    segments: List[TranscriptionSegment]
    language: str
    num_segments: int
    duration: float
    transcription_file_url: Optional[str] = None
    timestamp: str

download_tasks = {}

@app.get("/", response_model=StatusResponse)
async def root():
    return StatusResponse(
        status="online",
        service="TikTok Scraper API",
        version=API_VERSION,
        timestamp=datetime.now().isoformat()
    )

@app.get("/health", response_model=StatusResponse)
async def health_check():
    return StatusResponse(
        status="healthy",
        service="TikTok Scraper API",
        version=API_VERSION,
        timestamp=datetime.now().isoformat()
    )

@app.post("/api/v1/metadata", response_model=MetadataResponse)
async def get_channel_metadata(request: ChannelRequest):
    try:
        if not request.channel_link:
            raise HTTPException(status_code=400, detail="Channel link is required")
        
        username = scraper.extract_username(request.channel_link)
        
        result = scraper.list_videos_with_metadata(
            request.channel_link,
            request.max_videos
        )
        
        if not result['success']:
            raise HTTPException(
                status_code=404,
                detail=result.get('error', 'Failed to fetch channel metadata')
            )
        
        # Convert local file path to public storage URL
        metadata_file = result.get('metadata_file')
        metadata_file_url = None
        if metadata_file:
            filename = Path(metadata_file).name
            metadata_file_url = f"{STORAGE_BASE_URL}/{filename}"
        
        return MetadataResponse(
            success=True,
            message=f"Successfully retrieved {result['total_videos']} videos from @{username}",
            username=username,
            total_videos=result['total_videos'],
            videos=result['videos'],
            metadata_file_url=metadata_file_url,
            timestamp=datetime.now().isoformat()
        )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")

@app.post("/api/v1/download", response_model=DownloadResponse)
async def download_channel_videos(request: ChannelRequest, background_tasks: BackgroundTasks):
    try:
        if not request.channel_link:
            raise HTTPException(status_code=400, detail="Channel link is required")
        
        username = scraper.extract_username(request.channel_link)
        
        result = scraper.download_all_videos(
            request.channel_link,
            request.max_videos
        )
        
        if not result['success']:
            raise HTTPException(
                status_code=500,
                detail=result.get('error', 'Failed to download videos')
            )
        
        # Return URL to videos list endpoint instead of local path
        videos_list_url = f"{STORAGE_BASE_URL.rsplit('/storage', 1)[0]}/api/v1/videos/list"
        
        return DownloadResponse(
            success=True,
            message=f"Successfully downloaded {result['downloaded']} videos from @{username}",
            username=username,
            downloaded=result['downloaded'],
            videos_list_url=videos_list_url,
            timestamp=datetime.now().isoformat()
        )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")

@app.get("/api/v1/metadata/{username}")
async def get_saved_metadata(username: str):
    """
    Get metadata for a user's videos as JSON response with storage URL
    """
    try:
        metadata_file = Path(UPLOAD_DIR) / f"{username}_videos_metadata.json"
        
        if not metadata_file.exists():
            raise HTTPException(
                status_code=404,
                detail=f"No metadata found for user @{username}"
            )
        
        # Read and return JSON content with storage URL
        with open(metadata_file, 'r', encoding='utf-8') as f:
            metadata_content = json.load(f)
        
        # Generate storage URL for the metadata file
        metadata_url = f"{STORAGE_BASE_URL}/{metadata_file.name}"
        
        return JSONResponse(content={
            "success": True,
            "username": username,
            "total_videos": len(metadata_content),
            "metadata": metadata_content,
            "metadata_file_url": metadata_url,
            "timestamp": datetime.now().isoformat()
        })
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")

@app.get("/api/v1/videos/list")
async def list_downloaded_videos():
    try:
        download_path = Path(UPLOAD_DIR)
        
        if not download_path.exists():
            return JSONResponse(content={
                "success": True,
                "message": "No uploads directory found",
                "videos": [],
                "total": 0
            })
        
        video_extensions = ['.mp4', '.webm', '.mkv', '.avi']
        video_files = []
        
        for ext in video_extensions:
            video_files.extend(download_path.glob(f"*{ext}"))
        
        files_info = []
        for video_file in sorted(video_files, key=lambda x: x.stat().st_mtime, reverse=True):
            files_info.append({
                "filename": video_file.name,
                "url": f"{STORAGE_BASE_URL}/{video_file.name}",
                "size_mb": round(video_file.stat().st_size / (1024 * 1024), 2),
                "created": datetime.fromtimestamp(video_file.stat().st_ctime).isoformat(),
                "modified": datetime.fromtimestamp(video_file.stat().st_mtime).isoformat()
            })
        
        return JSONResponse(content={
            "success": True,
            "message": f"Found {len(files_info)} downloaded videos",
            "videos": files_info,
            "total": len(files_info),
            "timestamp": datetime.now().isoformat()
        })
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")

@app.get("/api/v1/videos/{filename}")
async def get_video_info(filename: str):
    """
    Get video file information and storage URL
    Returns metadata and public URL instead of direct file download
    """
    try:
        video_path = Path(UPLOAD_DIR) / filename
        
        if not video_path.exists():
            raise HTTPException(
                status_code=404,
                detail=f"Video file '{filename}' not found"
            )
        
        # Return video info with storage URL
        return JSONResponse(content={
            "success": True,
            "filename": filename,
            "url": f"{STORAGE_BASE_URL}/{filename}",
            "size_mb": round(video_path.stat().st_size / (1024 * 1024), 2),
            "created": datetime.fromtimestamp(video_path.stat().st_ctime).isoformat(),
            "modified": datetime.fromtimestamp(video_path.stat().st_mtime).isoformat(),
            "timestamp": datetime.now().isoformat()
        })
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")

@app.post("/api/v1/transcribe", response_model=TranscribeResponse)
async def transcribe_video(request: TranscribeRequest):
    """
    Transcribe speech from video to text with timestamps (OPTIMIZED)
    
    - **video_filename**: Name of video file in uploads directory
    - **language**: Language code (vi, en, etc.) or None for auto-detect
    - **model_size**: Whisper model size (tiny/base/small/medium/large-v2/large-v3)
    - **beam_size**: Decoding quality (1=fastest/greedy, 5=balanced, 10=best)
    - **vad_filter**: Enable VAD to skip silence (significantly faster)
    - **compute_type**: Quantization type (int8=fastest CPU, float16=fast GPU, auto=recommended)
    
    Performance Tips:
    - Enable vad_filter=true for 2-3x speedup on videos with silence
    - Use beam_size=1 for maximum speed (greedy decoding)
    - Use compute_type="int8" on CPU or "float16" on GPU for best speed
    - medium model with optimizations is now faster than old base model
    """
    global transcriber
    
    try:
        # Check if video exists
        video_path = Path(UPLOAD_DIR) / request.video_filename
        
        if not video_path.exists():
            raise HTTPException(
                status_code=404,
                detail=f"Video file '{request.video_filename}' not found in uploads directory"
            )
        
        # Update transcriber model if different (with compute_type)
        if request.model_size and (
            request.model_size != transcriber.model_name or 
            request.compute_type != transcriber.compute_type
        ):
            transcriber = WhisperTranscriber(
                model_name=request.model_size,
                device=None,  # Auto-detect
                compute_type=request.compute_type or "auto"
            )
        
        # Transcribe with optimized parameters
        result = transcriber.transcribe_video_with_save(
            str(video_path),
            output_dir=UPLOAD_DIR,
            language=request.language,
            beam_size=request.beam_size or 5,
            vad_filter=request.vad_filter if request.vad_filter is not None else True
        )
        
        if not result.get("success"):
            raise HTTPException(
                status_code=500,
                detail=result.get("error", "Transcription failed")
            )
        
        # Convert local file path to public storage URL
        transcription_file = result.get("transcription_file")
        transcription_file_url = None
        if transcription_file:
            filename = Path(transcription_file).name
            transcription_file_url = f"{STORAGE_BASE_URL}/{filename}"
        
        return TranscribeResponse(
            success=True,
            message=f"Successfully transcribed video with {result['num_segments']} segments",
            video_filename=request.video_filename,
            text=result["text"],
            segments=[TranscriptionSegment(**seg) for seg in result["segments"]],
            language=result["language"],
            num_segments=result["num_segments"],
            duration=result["duration"],
            transcription_file_url=transcription_file_url,
            timestamp=datetime.now().isoformat()
        )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")

@app.get("/api/v1/transcription/{video_name}")
async def get_saved_transcription(video_name: str):
    """
    Get saved transcription with storage URL
    
    - **video_name**: Video filename without extension (e.g., 'username_001_7521704507173227784')
    """
    try:
        transcription_file = Path(UPLOAD_DIR) / f"{video_name}_transcription.json"
        
        if not transcription_file.exists():
            raise HTTPException(
                status_code=404,
                detail=f"No transcription found for video '{video_name}'"
            )
        
        # Read and return transcription content with storage URL
        with open(transcription_file, 'r', encoding='utf-8') as f:
            transcription_content = json.load(f)
        
        # Generate storage URL for the transcription file
        transcription_url = f"{STORAGE_BASE_URL}/{transcription_file.name}"
        
        return JSONResponse(content={
            "success": True,
            "video_name": video_name,
            "transcription": transcription_content,
            "transcription_file_url": transcription_url,
            "timestamp": datetime.now().isoformat()
        })
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")

@app.get("/api/v1/transcriptions/list")
async def list_transcriptions():
    """
    List all saved transcription files
    """
    try:
        download_path = Path(UPLOAD_DIR)
        
        if not download_path.exists():
            return JSONResponse(content={
                "success": True,
                "message": "No uploads directory found",
                "transcriptions": [],
                "total": 0
            })
        
        transcription_files = list(download_path.glob("*_transcription.json"))
        
        files_info = []
        for trans_file in sorted(transcription_files, key=lambda x: x.stat().st_mtime, reverse=True):
            try:
                with open(trans_file, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                
                files_info.append({
                    "filename": trans_file.name,
                    "url": f"{STORAGE_BASE_URL}/{trans_file.name}",
                    "video_name": trans_file.stem.replace("_transcription", ""),
                    "language": data.get("language", "unknown"),
                    "num_segments": data.get("num_segments", 0),
                    "duration": data.get("duration", 0),
                    "size_kb": round(trans_file.stat().st_size / 1024, 2),
                    "created": datetime.fromtimestamp(trans_file.stat().st_ctime).isoformat(),
                    "modified": datetime.fromtimestamp(trans_file.stat().st_mtime).isoformat()
                })
            except:
                continue
        
        return JSONResponse(content={
            "success": True,
            "message": f"Found {len(files_info)} transcription files",
            "transcriptions": files_info,
            "total": len(files_info),
            "timestamp": datetime.now().isoformat()
        })
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")

@app.exception_handler(404)
async def not_found_handler(request, exc):
    return JSONResponse(
        status_code=404,
        content={
            "success": False,
            "error": "Resource not found",
            "detail": str(exc.detail) if hasattr(exc, 'detail') else "The requested resource was not found",
            "timestamp": datetime.now().isoformat()
        }
    )

@app.exception_handler(500)
async def internal_error_handler(request, exc):
    return JSONResponse(
        status_code=500,
        content={
            "success": False,
            "error": "Internal server error",
            "detail": str(exc.detail) if hasattr(exc, 'detail') else "An unexpected error occurred",
            "timestamp": datetime.now().isoformat()
        }
    )

if __name__ == "__main__":
    print("=" * 60)
    print("TikTok Scraper API Server")
    print("=" * 60)
    print(f"Documentation: http://localhost:{API_PORT}/docs")
    print(f"ReDoc: http://localhost:{API_PORT}/redoc")
    print("=" * 60)
    
    uvicorn.run(
        "main:app",
        host=API_HOST,
        port=API_PORT,
        reload=API_RELOAD,
        log_level=API_LOG_LEVEL
    )