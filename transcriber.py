import whisper
import os
import json
from pathlib import Path
from typing import Dict, List, Optional
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class WhisperTranscriber:
    """
    Transcribe video/audio files using OpenAI Whisper model
    """
    
    def __init__(self, model_name: str = "base"):
        """
        Initialize Whisper model
        
        Args:
            model_name: Model size (tiny, base, small, medium, large)
                       - tiny: fastest, lowest accuracy
                       - base: good balance (recommended)
                       - small: better accuracy, slower
                       - medium: high accuracy, much slower
                       - large: best accuracy, very slow
        """
        self.model_name = model_name
        self.model = None
        logger.info(f"Initializing Whisper transcriber with model: {model_name}")
    
    def load_model(self):
        """Load Whisper model (lazy loading)"""
        if self.model is None:
            logger.info(f"Loading Whisper model: {self.model_name}")
            self.model = whisper.load_model(self.model_name)
            logger.info("Model loaded successfully")
    
    def transcribe_video(
        self,
        video_path: str,
        language: Optional[str] = None,
        task: str = "transcribe"
    ) -> Dict:
        """
        Transcribe video to text with timestamps
        
        Args:
            video_path: Path to video file
            language: Language code (e.g., 'vi', 'en'). None for auto-detect
            task: 'transcribe' or 'translate' (translate to English)
        
        Returns:
            Dict containing:
                - text: Full transcription
                - segments: List of segments with timestamps
                - language: Detected/specified language
        """
        try:
            # Load model if not loaded
            self.load_model()
            
            # Check if file exists
            if not os.path.exists(video_path):
                raise FileNotFoundError(f"Video file not found: {video_path}")
            
            logger.info(f"Transcribing video: {video_path}")
            
            # Transcribe
            options = {
                "task": task,
                "verbose": False
            }
            
            if language:
                options["language"] = language
            
            result = self.model.transcribe(video_path, **options)
            
            # Format segments
            segments = []
            for seg in result.get("segments", []):
                segments.append({
                    "id": seg["id"],
                    "start": seg["start"],
                    "end": seg["end"],
                    "text": seg["text"].strip(),
                    "duration": seg["end"] - seg["start"]
                })
            
            transcription = {
                "success": True,
                "text": result["text"].strip(),
                "segments": segments,
                "language": result.get("language", language),
                "num_segments": len(segments),
                "duration": segments[-1]["end"] if segments else 0
            }
            
            logger.info(f"Transcription completed: {len(segments)} segments, language: {transcription['language']}")
            
            return transcription
            
        except Exception as e:
            logger.error(f"Transcription failed: {str(e)}")
            return {
                "success": False,
                "error": str(e),
                "text": "",
                "segments": [],
                "language": None
            }
    
    def transcribe_video_with_save(
        self,
        video_path: str,
        output_dir: str = "uploads",
        language: Optional[str] = None,
        task: str = "transcribe"
    ) -> Dict:
        """
        Transcribe video and save result to JSON file
        
        Args:
            video_path: Path to video file
            output_dir: Directory to save transcription
            language: Language code
            task: 'transcribe' or 'translate'
        
        Returns:
            Dict with transcription result and saved file path
        """
        # Transcribe
        result = self.transcribe_video(video_path, language, task)
        
        if not result["success"]:
            return result
        
        # Save to JSON
        try:
            video_name = Path(video_path).stem
            output_path = Path(output_dir) / f"{video_name}_transcription.json"
            
            # Ensure output directory exists
            output_path.parent.mkdir(parents=True, exist_ok=True)
            
            # Save
            with open(output_path, 'w', encoding='utf-8') as f:
                json.dump(result, f, ensure_ascii=False, indent=2)
            
            result["transcription_file"] = str(output_path)
            logger.info(f"Transcription saved to: {output_path}")
            
        except Exception as e:
            logger.error(f"Failed to save transcription: {str(e)}")
            result["save_error"] = str(e)
        
        return result
    
    def transcribe_batch(
        self,
        video_paths: List[str],
        output_dir: str = "uploads",
        language: Optional[str] = None
    ) -> List[Dict]:
        """
        Transcribe multiple videos
        
        Args:
            video_paths: List of video file paths
            output_dir: Directory to save transcriptions
            language: Language code
        
        Returns:
            List of transcription results
        """
        results = []
        total = len(video_paths)
        
        logger.info(f"Starting batch transcription: {total} videos")
        
        for idx, video_path in enumerate(video_paths, 1):
            logger.info(f"Processing {idx}/{total}: {video_path}")
            
            result = self.transcribe_video_with_save(
                video_path,
                output_dir,
                language
            )
            
            result["video_path"] = video_path
            result["index"] = idx
            results.append(result)
        
        logger.info(f"Batch transcription completed: {total} videos")
        
        return results
    
    def get_transcript_text_only(self, video_path: str, language: Optional[str] = None) -> str:
        """
        Get only the text transcription (no timestamps)
        
        Args:
            video_path: Path to video file
            language: Language code
        
        Returns:
            Transcribed text as string
        """
        result = self.transcribe_video(video_path, language)
        return result.get("text", "")
    
    def get_transcript_with_timestamps(self, video_path: str, language: Optional[str] = None) -> List[str]:
        """
        Get transcription formatted with timestamps
        
        Args:
            video_path: Path to video file
            language: Language code
        
        Returns:
            List of formatted strings: "[00:00:00 -> 00:00:05] Text here"
        """
        result = self.transcribe_video(video_path, language)
        
        if not result.get("success"):
            return []
        
        formatted = []
        for seg in result["segments"]:
            start_time = self._format_timestamp(seg["start"])
            end_time = self._format_timestamp(seg["end"])
            formatted.append(f"[{start_time} -> {end_time}] {seg['text']}")
        
        return formatted
    
    @staticmethod
    def _format_timestamp(seconds: float) -> str:
        """Convert seconds to HH:MM:SS format"""
        hours = int(seconds // 3600)
        minutes = int((seconds % 3600) // 60)
        secs = int(seconds % 60)
        return f"{hours:02d}:{minutes:02d}:{secs:02d}"


# Convenience function
def transcribe_video_file(
    video_path: str,
    model_size: str = "base",
    language: Optional[str] = None,
    save_to_file: bool = True
) -> Dict:
    """
    Quick function to transcribe a single video
    
    Args:
        video_path: Path to video file
        model_size: Whisper model size (tiny/base/small/medium/large)
        language: Language code (vi, en, etc.)
        save_to_file: Save result to JSON file
    
    Returns:
        Transcription result dictionary
    """
    transcriber = WhisperTranscriber(model_name=model_size)
    
    if save_to_file:
        return transcriber.transcribe_video_with_save(video_path, language=language)
    else:
        return transcriber.transcribe_video(video_path, language=language)

