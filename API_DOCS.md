## API Docs

### Health Check
```
GET http://localhost:8000/
```

---

### Lấy Metadata (Không Download)
```
POST http://localhost:8000/api/v1/metadata
```

**Body** → **raw** → **JSON**:
```json
{
  "channel_link": "@lephianhdev",
  "max_videos": null
}
```

**Hoặc giới hạn 10 videos:**
```json
{
  "channel_link": "@lephianhdev",
  "max_videos": 10
}
```

---

### Download Videos
```
POST http://localhost:8000/api/v1/download
```

**Body** → **raw** → **JSON**:
```json
{
  "channel_link": "@lephianhdev",
  "max_videos": 5
}
```

---

### Lấy File Metadata Đã Lưu
```
GET http://localhost:8000/api/v1/metadata/lephianhdev
```

---

### Liệt Kê Videos Đã Download
```
GET http://localhost:8000/api/v1/videos/list
```

---

### Download File Video Cụ Thể
```
GET http://localhost:8000/api/v1/videos/{filename}
```

**Ví dụ:**
```
GET http://localhost:8000/api/v1/videos/lephianhdev_001_7521704507173227784.mp4
```

---

## Speech-to-Text APIs

### Transcribe Video
```
POST http://localhost:8000/api/v1/transcribe
```

**Body** → **raw** → **JSON**:
```json
{
  "video_filename": "lephianhdev_001_7521704507173227784.mp4",
  "language": "vi",
  "model_size": "base"
}
```

**Tham số:**
- `video_filename`: Tên file video trong thư mục uploads (bắt buộc)
- `language`: Mã ngôn ngữ (`vi`, `en`, `zh`, etc.) hoặc `null` để tự động nhận diện
- `model_size`: Kích thước model Whisper
  - `tiny`: Nhanh nhất, độ chính xác thấp
  - `base`: Cân bằng, **khuyên dùng**
  - `small`: Chính xác hơn
  - `medium`: Rất chính xác
  - `large`: Chính xác nhất

**Ví dụ auto-detect language:**
```json
{
  "video_filename": "lephianhdev_001_7521704507173227784.mp4",
  "language": null,
  "model_size": "base"
}
```

---

### Liệt Kê Transcription Files
```
GET http://localhost:8000/api/v1/transcriptions/list
```

---

### Download Transcription File
```
GET http://localhost:8000/api/v1/transcription/{video_name}
```

**Ví dụ:**
```
GET http://localhost:8000/api/v1/transcription/lephianhdev_001_7521704507173227784
```

**Lưu ý:** Không cần thêm `.mp4` hoặc `_transcription.json`