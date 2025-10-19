from fastapi import FastAPI, HTTPException, BackgroundTasks, Query
from fastapi.responses import JSONResponse, FileResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import Optional, List, Dict
from pathlib import Path
import uvicorn
import json
from datetime import datetime

from tiktok_scraper import SimpleTikTokScraper
from transcriber import WhisperTranscriber

app = FastAPI(
    title="TikTok Scraper API",
    description="RESTful API for scraping TikTok channel videos, metadata, and speech-to-text transcription",
    version="2.0.0",
    docs_url="/docs",
    redoc_url="/redoc"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

scraper = SimpleTikTokScraper()
transcriber = WhisperTranscriber(model_name="base")

class ChannelRequest(BaseModel):
    channel_link: str = Field(..., description="TikTok channel URL or username (e.g., @username or https://www.tiktok.com/@username)")
    max_videos: Optional[int] = Field(None, description="Maximum number of videos to process (None = all videos)", ge=1, le=1000)

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
    metadata_file: Optional[str] = None
    timestamp: str

class DownloadResponse(BaseModel):
    success: bool
    message: str
    username: str
    downloaded: int
    download_path: Optional[str] = None
    timestamp: str

class StatusResponse(BaseModel):
    status: str
    service: str
    version: str
    timestamp: str

class TranscribeRequest(BaseModel):
    video_filename: str = Field(..., description="Video filename in uploads directory")
    language: Optional[str] = Field(None, description="Language code (e.g., 'vi', 'en'). None for auto-detect")
    model_size: Optional[str] = Field("base", description="Whisper model size: tiny, base, small, medium, large")
    
    class Config:
        json_schema_extra = {
            "example": {
                "video_filename": "lephianhdev_001_7521704507173227784.mp4",
                "language": "vi",
                "model_size": "base"
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
    transcription_file: Optional[str] = None
    timestamp: str

download_tasks = {}

@app.get("/", response_model=StatusResponse)
async def root():
    return StatusResponse(
        status="online",
        service="TikTok Scraper API",
        version="2.0.0",
        timestamp=datetime.now().isoformat()
    )

@app.get("/health", response_model=StatusResponse)
async def health_check():
    return StatusResponse(
        status="healthy",
        service="TikTok Scraper API",
        version="2.0.0",
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
        
        return MetadataResponse(
            success=True,
            message=f"Successfully retrieved {result['total_videos']} videos from @{username}",
            username=username,
            total_videos=result['total_videos'],
            videos=result['videos'],
            metadata_file=result.get('metadata_file'),
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
        
        return DownloadResponse(
            success=True,
            message=f"Successfully downloaded {result['downloaded']} videos from @{username}",
            username=username,
            downloaded=result['downloaded'],
            download_path=result.get('download_path'),
            timestamp=datetime.now().isoformat()
        )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")

@app.get("/api/v1/metadata/{username}")
async def get_saved_metadata(username: str):
    try:
        metadata_file = Path("uploads") / f"{username}_videos_metadata.json"
        
        if not metadata_file.exists():
            raise HTTPException(
                status_code=404,
                detail=f"No metadata found for user @{username}"
            )
        
        return FileResponse(
            path=metadata_file,
            media_type="application/json",
            filename=f"{username}_videos_metadata.json"
        )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")

@app.get("/api/v1/videos/list")
async def list_downloaded_videos():
    try:
        download_path = Path("uploads")
        
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
async def download_video_file(filename: str):
    try:
        video_path = Path("uploads") / filename
        
        if not video_path.exists():
            raise HTTPException(
                status_code=404,
                detail=f"Video file '{filename}' not found"
            )
        
        return FileResponse(
            path=video_path,
            media_type="video/mp4",
            filename=filename
        )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")

@app.post("/api/v1/transcribe", response_model=TranscribeResponse)
async def transcribe_video(request: TranscribeRequest):
    """
    Transcribe speech from video to text with timestamps
    
    - **video_filename**: Name of video file in uploads directory
    - **language**: Language code (vi, en, etc.) or None for auto-detect
    - **model_size**: Whisper model size (tiny/base/small/medium/large)
    """
    global transcriber
    
    try:
        # Check if video exists
        video_path = Path("uploads") / request.video_filename
        
        if not video_path.exists():
            raise HTTPException(
                status_code=404,
                detail=f"Video file '{request.video_filename}' not found in uploads directory"
            )
        
        # Update transcriber model if different
        if request.model_size and request.model_size != transcriber.model_name:
            transcriber = WhisperTranscriber(model_name=request.model_size)
        
        # Transcribe
        result = transcriber.transcribe_video_with_save(
            str(video_path),
            output_dir="uploads",
            language=request.language
        )
        
        if not result.get("success"):
            raise HTTPException(
                status_code=500,
                detail=result.get("error", "Transcription failed")
            )
        
        return TranscribeResponse(
            success=True,
            message=f"Successfully transcribed video with {result['num_segments']} segments",
            video_filename=request.video_filename,
            text=result["text"],
            segments=[TranscriptionSegment(**seg) for seg in result["segments"]],
            language=result["language"],
            num_segments=result["num_segments"],
            duration=result["duration"],
            transcription_file=result.get("transcription_file"),
            timestamp=datetime.now().isoformat()
        )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")

@app.get("/api/v1/transcription/{video_name}")
async def get_saved_transcription(video_name: str):
    """
    Get saved transcription JSON file
    
    - **video_name**: Video filename without extension (e.g., 'username_001_7521704507173227784')
    """
    try:
        transcription_file = Path("uploads") / f"{video_name}_transcription.json"
        
        if not transcription_file.exists():
            raise HTTPException(
                status_code=404,
                detail=f"No transcription found for video '{video_name}'"
            )
        
        return FileResponse(
            path=transcription_file,
            media_type="application/json",
            filename=f"{video_name}_transcription.json"
        )
        
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
        download_path = Path("uploads")
        
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
    print("Documentation: http://localhost:8000/docs")
    print("ReDoc: http://localhost:8000/redoc")
    print("=" * 60)
    
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        log_level="info"
    )