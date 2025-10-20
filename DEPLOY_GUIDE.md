## Deploy Nhanh

### 1. SSH vào VPS
```bash
ssh root@36.50.54.74
cd /opt/projects
git clone --branch deploy https://github.com/dailongmedia2603/kocao.git
cd kocao/
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
git pull origin main
pm2 restart kocao
```

## API Endpoints
- `GET /health` - Health check
- `POST /scrape` - Scrape TikTok
- `POST /transcribe` - Transcribe audio

**URL:** `http://36.50.54.74:8000`