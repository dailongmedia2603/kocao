from faster_whisper import WhisperModel
import os
import json
from pathlib import Path
from typing import Dict, List, Optional
import logging
import torch
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Configuration from environment variables
DEFAULT_WHISPER_MODEL = os.getenv("WHISPER_MODEL_NAME", "base")
DEFAULT_WHISPER_DEVICE = os.getenv("WHISPER_DEVICE", "auto")
DEFAULT_WHISPER_COMPUTE_TYPE = os.getenv("WHISPER_COMPUTE_TYPE", "auto")
DEFAULT_BEAM_SIZE = int(os.getenv("WHISPER_BEAM_SIZE", "5"))
DEFAULT_VAD_FILTER = os.getenv("WHISPER_VAD_FILTER", "true").lower() == "true"
DEFAULT_CPU_THREADS = int(os.getenv("WHISPER_CPU_THREADS", "0"))
DEFAULT_NUM_WORKERS = int(os.getenv("WHISPER_NUM_WORKERS", "4"))

# VAD Parameters
VAD_THRESHOLD = float(os.getenv("VAD_THRESHOLD", "0.5"))
VAD_MIN_SPEECH_DURATION_MS = int(os.getenv("VAD_MIN_SPEECH_DURATION_MS", "250"))
VAD_MAX_SPEECH_DURATION_S = os.getenv("VAD_MAX_SPEECH_DURATION_S", "inf")
VAD_MAX_SPEECH_DURATION_S = float(VAD_MAX_SPEECH_DURATION_S) if VAD_MAX_SPEECH_DURATION_S != "inf" else float("inf")
VAD_MIN_SILENCE_DURATION_MS = int(os.getenv("VAD_MIN_SILENCE_DURATION_MS", "2000"))
VAD_SPEECH_PAD_MS = int(os.getenv("VAD_SPEECH_PAD_MS", "400"))

# Whisper Advanced Parameters
COMPRESSION_RATIO_THRESHOLD = float(os.getenv("WHISPER_COMPRESSION_RATIO_THRESHOLD", "2.4"))
LOG_PROB_THRESHOLD = float(os.getenv("WHISPER_LOG_PROB_THRESHOLD", "-1.0"))
NO_SPEECH_THRESHOLD = float(os.getenv("WHISPER_NO_SPEECH_THRESHOLD", "0.6"))
PATIENCE = float(os.getenv("WHISPER_PATIENCE", "1.0"))
LENGTH_PENALTY = float(os.getenv("WHISPER_LENGTH_PENALTY", "1.0"))
REPETITION_PENALTY = float(os.getenv("WHISPER_REPETITION_PENALTY", "1.0"))
NO_REPEAT_NGRAM_SIZE = int(os.getenv("WHISPER_NO_REPEAT_NGRAM_SIZE", "0"))
MAX_INITIAL_TIMESTAMP = float(os.getenv("WHISPER_MAX_INITIAL_TIMESTAMP", "1.0"))

DEFAULT_UPLOAD_DIR = os.getenv("UPLOAD_DIR", "uploads")

class WhisperTranscriber:
    """
    Optimized transcriber using faster-whisper (CTranslate2) for high-performance transcription
    Features:
    - 4-10x faster than openai-whisper
    - GPU acceleration with CUDA
    - VAD (Voice Activity Detection) for skipping silence
    - INT8 quantization for speed
    - Optimized batch processing
    """
    
    def __init__(self, model_name: str = None, device: Optional[str] = None, compute_type: str = None):
        """
        Initialize optimized Whisper model
        
        Args:
            model_name: Model size (tiny, base, small, medium, large-v2, large-v3)
                       - tiny: fastest, lowest accuracy
                       - base: good balance (recommended)
                       - small: better accuracy, fast
                       - medium: high accuracy, optimized speed
                       - large-v2/v3: best accuracy, faster than before
            device: 'cuda', 'cpu', or None for auto-detection
            compute_type: Quantization type:
                         - 'int8': Fastest, ~4x speedup, minimal accuracy loss
                         - 'float16': Fast, good for GPU (2x speedup)
                         - 'float32': Full precision (slowest)
                         - 'auto': Automatic selection (int8 on CPU, float16 on GPU)
        """
        # Use environment variables as defaults
        self.model_name = model_name if model_name is not None else DEFAULT_WHISPER_MODEL
        self.model = None
        
        # Auto-detect device
        if device is None:
            device_env = DEFAULT_WHISPER_DEVICE
            if device_env == "auto":
                self.device = "cuda" if torch.cuda.is_available() else "cpu"
            else:
                self.device = device_env
        else:
            self.device = device
        
        # Auto-select compute type based on device
        compute_type = compute_type if compute_type is not None else DEFAULT_WHISPER_COMPUTE_TYPE
        if compute_type == "auto":
            if self.device == "cuda":
                # Use float16 on GPU for best speed/accuracy balance
                self.compute_type = "float16"
            else:
                # Use int8 on CPU for maximum speed
                self.compute_type = "int8"
        else:
            self.compute_type = compute_type
        
        logger.info(f"Initializing optimized Whisper transcriber:")
        logger.info(f"  Model: {model_name}")
        logger.info(f"  Device: {self.device}")
        logger.info(f"  Compute type: {self.compute_type}")
        
        if self.device == "cuda":
            logger.info(f"  GPU: {torch.cuda.get_device_name(0)}")
            logger.info(f"  CUDA version: {torch.version.cuda}")
    
    def load_model(self):
        """Load optimized Whisper model (lazy loading)"""
        if self.model is None:
            logger.info(f"Loading optimized Whisper model: {self.model_name}")
            
            # Configure model with optimizations
            cpu_threads = DEFAULT_CPU_THREADS if DEFAULT_CPU_THREADS > 0 else (os.cpu_count() if self.device == "cpu" else 0)
            num_workers = DEFAULT_NUM_WORKERS if self.device == "cuda" else 1
            
            self.model = WhisperModel(
                self.model_name,
                device=self.device,
                compute_type=self.compute_type,
                # CPU optimization: use multiple threads
                cpu_threads=cpu_threads,
                # GPU optimization: use multiple workers
                num_workers=num_workers
            )
            
            logger.info("Optimized model loaded successfully")
    
    def transcribe_video(
        self,
        video_path: str,
        language: Optional[str] = None,
        task: str = "transcribe",
        beam_size: int = 5,
        vad_filter: bool = True,
        vad_parameters: Optional[Dict] = None
    ) -> Dict:
        """
        Transcribe video to text with timestamps using optimized settings
        
        Args:
            video_path: Path to video file
            language: Language code (e.g., 'vi', 'en'). None for auto-detect
            task: 'transcribe' or 'translate' (translate to English)
            beam_size: Beam size for decoding (1=fastest/greedy, 5=balanced, 10=best quality)
                      Lower = faster, higher = more accurate
            vad_filter: Enable VAD to skip silence (significantly speeds up processing)
            vad_parameters: Custom VAD settings (threshold, min_speech_duration, etc.)
        
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
            logger.info(f"Settings: beam_size={beam_size}, vad_filter={vad_filter}")
            
            # Configure VAD parameters for optimal performance
            if vad_parameters is None:
                vad_parameters = {
                    "threshold": VAD_THRESHOLD,
                    "min_speech_duration_ms": VAD_MIN_SPEECH_DURATION_MS,
                    "max_speech_duration_s": VAD_MAX_SPEECH_DURATION_S,
                    "min_silence_duration_ms": VAD_MIN_SILENCE_DURATION_MS,
                    "speech_pad_ms": VAD_SPEECH_PAD_MS
                }
            
            # Transcribe with optimized parameters
            segments_generator, info = self.model.transcribe(
                video_path,
                language=language,
                task=task,
                beam_size=beam_size,
                # VAD optimization - skip silent parts
                vad_filter=vad_filter,
                vad_parameters=vad_parameters if vad_filter else None,
                # Batch processing for speed
                word_timestamps=False,  # Disable word-level timestamps for speed
                # Temperature settings for better stability
                temperature=[0.0, 0.2, 0.4, 0.6, 0.8, 1.0],
                # Compression ratio threshold
                compression_ratio_threshold=COMPRESSION_RATIO_THRESHOLD,
                log_prob_threshold=LOG_PROB_THRESHOLD,
                no_speech_threshold=NO_SPEECH_THRESHOLD,
                # Initial prompt for better context (optional)
                initial_prompt=None,
                # Condition on previous text
                condition_on_previous_text=True,
                # Faster processing
                patience=PATIENCE,
                length_penalty=LENGTH_PENALTY,
                repetition_penalty=REPETITION_PENALTY,
                no_repeat_ngram_size=NO_REPEAT_NGRAM_SIZE,
                # Prefix settings
                prefix=None,
                suppress_blank=True,
                suppress_tokens=[-1],
                without_timestamps=False,
                max_initial_timestamp=MAX_INITIAL_TIMESTAMP,
                # Additional optimizations
                prepend_punctuations="\"'([{-",
                append_punctuations="\"'.。,，!！?？:：\")]}、"
            )
            
            # Convert generator to list and format segments
            segments = []
            full_text = []
            
            for idx, seg in enumerate(segments_generator):
                segments.append({
                    "id": idx,
                    "start": seg.start,
                    "end": seg.end,
                    "text": seg.text.strip(),
                    "duration": seg.end - seg.start
                })
                full_text.append(seg.text.strip())
            
            # Get detected language
            detected_language = info.language if hasattr(info, 'language') else language
            
            transcription = {
                "success": True,
                "text": " ".join(full_text),
                "segments": segments,
                "language": detected_language,
                "num_segments": len(segments),
                "duration": segments[-1]["end"] if segments else 0,
                # Additional performance metrics
                "language_probability": info.language_probability if hasattr(info, 'language_probability') else None,
                "duration_info": info.duration if hasattr(info, 'duration') else None
            }
            
            logger.info(f"Transcription completed: {len(segments)} segments, language: {transcription['language']}")
            if hasattr(info, 'language_probability'):
                logger.info(f"Language confidence: {info.language_probability:.2%}")
            
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
        output_dir: str = None,
        language: Optional[str] = None,
        task: str = "transcribe",
        beam_size: int = None,
        vad_filter: bool = None
    ) -> Dict:
        """
        Transcribe video and save result to JSON file
        
        Args:
            video_path: Path to video file
            output_dir: Directory to save transcription
            language: Language code
            task: 'transcribe' or 'translate'
            beam_size: Beam size for decoding quality
            vad_filter: Enable VAD for speed optimization
        
        Returns:
            Dict with transcription result and saved file path
        """
        # Use defaults from environment if not specified
        output_dir = output_dir if output_dir is not None else DEFAULT_UPLOAD_DIR
        beam_size = beam_size if beam_size is not None else DEFAULT_BEAM_SIZE
        vad_filter = vad_filter if vad_filter is not None else DEFAULT_VAD_FILTER
        
        # Transcribe with optimizations
        result = self.transcribe_video(video_path, language, task, beam_size, vad_filter)
        
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
        output_dir: str = None,
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
        output_dir = output_dir if output_dir is not None else DEFAULT_UPLOAD_DIR
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


# Convenience function with optimizations
def transcribe_video_file(
    video_path: str,
    model_size: str = None,
    language: Optional[str] = None,
    save_to_file: bool = True,
    device: Optional[str] = None,
    compute_type: str = None,
    beam_size: int = None,
    vad_filter: bool = None
) -> Dict:
    """
    Quick function to transcribe a single video with optimizations
    
    Args:
        video_path: Path to video file
        model_size: Whisper model size (tiny/base/small/medium/large-v2/large-v3)
        language: Language code (vi, en, etc.)
        save_to_file: Save result to JSON file
        device: 'cuda', 'cpu', or None for auto-detection
        compute_type: 'int8' (fastest), 'float16' (GPU), 'float32', or 'auto'
        beam_size: Beam size for decoding (1=fastest, 5=balanced, 10=best)
        vad_filter: Enable Voice Activity Detection for speed
    
    Returns:
        Transcription result dictionary
    """
    # Use defaults from environment if not specified
    model_size = model_size if model_size is not None else DEFAULT_WHISPER_MODEL
    compute_type = compute_type if compute_type is not None else DEFAULT_WHISPER_COMPUTE_TYPE
    beam_size = beam_size if beam_size is not None else DEFAULT_BEAM_SIZE
    vad_filter = vad_filter if vad_filter is not None else DEFAULT_VAD_FILTER
    
    transcriber = WhisperTranscriber(
        model_name=model_size,
        device=device,
        compute_type=compute_type
    )
    
    if save_to_file:
        return transcriber.transcribe_video_with_save(
            video_path,
            language=language,
            beam_size=beam_size,
            vad_filter=vad_filter
        )
    else:
        return transcriber.transcribe_video(
            video_path,
            language=language,
            beam_size=beam_size,
            vad_filter=vad_filter
        )

