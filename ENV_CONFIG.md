## Danh sách các biến môi trường

### API Server Configuration

| Biến | Mặc định | Mô tả |
|------|----------|-------|
| `API_HOST` | `0.0.0.0` | Địa chỉ IP mà server lắng nghe |
| `API_PORT` | `8000` | Cổng mà server chạy |
| `API_VERSION` | `2.0.0` | Phiên bản API |
| `API_RELOAD` | `true` | Bật/tắt auto-reload khi code thay đổi |
| `API_LOG_LEVEL` | `info` | Mức độ log (debug, info, warning, error) |

### CORS Configuration

| Biến | Mặc định | Mô tả |
|------|----------|-------|
| `CORS_ALLOW_ORIGINS` | `*` | Danh sách origins được phép (phân cách bởi dấu phẩy) |
| `CORS_ALLOW_CREDENTIALS` | `true` | Cho phép gửi credentials |
| `CORS_ALLOW_METHODS` | `*` | Danh sách HTTP methods được phép |
| `CORS_ALLOW_HEADERS` | `*` | Danh sách headers được phép |

### Upload/Download Configuration

| Biến | Mặc định | Mô tả |
|------|----------|-------|
| `UPLOAD_DIR` | `uploads` | Thư mục lưu trữ video và transcription |
| `MAX_VIDEOS_LIMIT` | `1000` | Giới hạn tối đa số video có thể tải |

### Whisper Transcription Configuration

| Biến | Mặc định | Mô tả |
|------|----------|-------|
| `WHISPER_MODEL_NAME` | `base` | Kích thước model (tiny, base, small, medium, large-v2, large-v3) |
| `WHISPER_DEVICE` | `auto` | Device sử dụng (auto, cuda, cpu) |
| `WHISPER_COMPUTE_TYPE` | `auto` | Loại quantization (auto, int8, float16, float32) |
| `WHISPER_BEAM_SIZE` | `5` | Beam size cho decoding (1-10) |
| `WHISPER_VAD_FILTER` | `true` | Bật Voice Activity Detection |
| `WHISPER_CPU_THREADS` | `0` | Số threads cho CPU (0 = auto) |
| `WHISPER_NUM_WORKERS` | `4` | Số workers cho GPU |

### VAD (Voice Activity Detection) Parameters

| Biến | Mặc định | Mô tả |
|------|----------|-------|
| `VAD_THRESHOLD` | `0.5` | Ngưỡng phát hiện giọng nói (0.0-1.0) |
| `VAD_MIN_SPEECH_DURATION_MS` | `250` | Độ dài tối thiểu của speech (ms) |
| `VAD_MAX_SPEECH_DURATION_S` | `inf` | Độ dài tối đa của speech (seconds) |
| `VAD_MIN_SILENCE_DURATION_MS` | `2000` | Độ dài im lặng tối thiểu để tách segment (ms) |
| `VAD_SPEECH_PAD_MS` | `400` | Padding xung quanh speech (ms) |

### Whisper Advanced Parameters

| Biến | Mặc định | Mô tả |
|------|----------|-------|
| `WHISPER_COMPRESSION_RATIO_THRESHOLD` | `2.4` | Ngưỡng compression ratio |
| `WHISPER_LOG_PROB_THRESHOLD` | `-1.0` | Ngưỡng log probability |
| `WHISPER_NO_SPEECH_THRESHOLD` | `0.6` | Ngưỡng phát hiện không có speech |
| `WHISPER_PATIENCE` | `1.0` | Patience cho beam search |
| `WHISPER_LENGTH_PENALTY` | `1.0` | Length penalty |
| `WHISPER_REPETITION_PENALTY` | `1.0` | Repetition penalty |
| `WHISPER_NO_REPEAT_NGRAM_SIZE` | `0` | Kích thước n-gram không lặp |
| `WHISPER_MAX_INITIAL_TIMESTAMP` | `1.0` | Timestamp tối đa ban đầu |

### TikTok Scraper Configuration

| Biến | Mặc định | Mô tả |
|------|----------|-------|
| `TIKTOK_DOWNLOAD_FORMAT` | `best` | Format download (best, worst, hoặc format string của yt-dlp) |
| `TIKTOK_QUIET` | `false` | Chế độ quiet cho yt-dlp |

## Ví dụ cấu hình

### Development (Phát triển)
```env
API_HOST=127.0.0.1
API_PORT=8000
API_RELOAD=true
API_LOG_LEVEL=debug
UPLOAD_DIR=uploads
WHISPER_MODEL_NAME=base
WHISPER_VAD_FILTER=true
```

### Production (Sản xuất)
```env
API_HOST=0.0.0.0
API_PORT=80
API_RELOAD=false
API_LOG_LEVEL=warning
UPLOAD_DIR=/var/app/uploads
WHISPER_MODEL_NAME=medium
WHISPER_COMPUTE_TYPE=int8
WHISPER_VAD_FILTER=true
CORS_ALLOW_ORIGINS=https://yourdomain.com
```

### High Performance (Hiệu suất cao - GPU)
```env
WHISPER_MODEL_NAME=large-v3
WHISPER_DEVICE=cuda
WHISPER_COMPUTE_TYPE=float16
WHISPER_BEAM_SIZE=10
WHISPER_VAD_FILTER=true
WHISPER_NUM_WORKERS=8
```

### Low Resource (Tài nguyên thấp - CPU)
```env
WHISPER_MODEL_NAME=tiny
WHISPER_DEVICE=cpu
WHISPER_COMPUTE_TYPE=int8
WHISPER_BEAM_SIZE=1
WHISPER_VAD_FILTER=true
WHISPER_CPU_THREADS=4
```