## Deploy Nhanh

### 1. SSH vào VPS và Clone Code
```bash
ssh root@36.50.54.74
cd /opt/projects
git clone --branch deploy https://github.com/dailongmedia2603/kocao.git
cd kocao/
```

### 2. Cấu Hình Environment (QUAN TRỌNG!)
```bash
# Kiểm tra cấu hình (đảm bảo PUBLIC_URL đã đúng)
cat .env | grep PUBLIC_URL
# Phải thấy: PUBLIC_URL=http://36.50.54.74:8000

# Kiểm tra domain restriction
cat .env | grep ENABLE_DOMAIN_RESTRICTION
# Phải thấy: ENABLE_DOMAIN_RESTRICTION=true
```

### 3. Deploy
```bash
chmod +x ./deploy.sh
./deploy.sh
```

## Quản Lý

**PM2 Commands:**
- `pm2 status` - Xem trạng thái
- `pm2 restart kocao` - Khởi động lại
- `pm2 logs kocao` - Xem logs
- `pm2 monit` - Monitor real-time

**Update code:**
```bash
cd /opt/projects/kocao
git pull origin deploy
cp production.env .env
pm2 restart kocao
```

## Bảo Mật và Truy Cập

### Domain Restriction (Đã Bật)
API chỉ cho phép truy cập từ các domain sau:
- `kocao.vercel.app`
- `drxaikoc.com`
- `drxaistudio.com`

### Tắt Domain Restriction (Nếu Cần Test)
```bash
# Edit .env file
nano .env

# Đổi dòng này:
ENABLE_DOMAIN_RESTRICTION=false

# Restart
pm2 restart kocao
```

### URL Response
- **Local Development**: Tất cả URL trong response sẽ là `http://localhost:8000/...`
- **Production**: Tất cả URL trong response sẽ là `http://36.50.54.74:8000/...`

## API Endpoints
- `GET /` - Service status
- `GET /health` - Health check
- `GET /docs` - API Documentation
- `POST /api/v1/download` - Download TikTok videos
- `POST /api/v1/metadata` - Get video metadata
- `POST /api/v1/transcribe` - Transcribe video
- `GET /api/v1/videos/list` - List all videos

**Public URL:** `http://36.50.54.74:8000`
**API Docs:** `http://36.50.54.74:8000/docs`