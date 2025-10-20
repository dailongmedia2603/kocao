### Bước 1: SSH vào VPS
```bash
ssh root@36.50.54.74
```

### Bước 2: Chạy script deploy tự động
```bash
# Download và chạy script
curl -fsSL https://raw.githubusercontent.com/your-username/kocao/main/deploy.sh | bash
```

### Hoặc deploy thủ công:

#### Bước 2a: Cài đặt dependencies
```bash
# Update system
apt update && apt upgrade -y

# Install Python
apt install -y python3 python3-pip python3-venv

# Install Node.js cho PM2
curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
apt-get install -y nodejs

# Install PM2
npm install -g pm2
```

#### Bước 2b: Clone và setup code
```bash
# Clone repository
git clone https://github.com/your-username/kocao.git
cd kocao

# Tạo virtual environment
python3 -m venv venv
source venv/bin/activate

# Cài đặt dependencies
pip install -r requirements.txt
```

#### Bước 2c: Chạy với PM2
```bash
# Tạo thư mục logs
mkdir -p logs

# Start với PM2
pm2 start ecosystem.config.js

# Save cấu hình
pm2 save

# Setup auto-start khi reboot
pm2 startup
```

### Bước 3: Kiểm tra
```bash
# Xem status
pm2 status

# Xem logs
pm2 logs kocao-api

# Test API
curl http://localhost:8000/health
```

### Bước 4: Mở port (nếu cần)
```bash
# Mở port 8000
ufw allow 8000
```

## Quản lý ứng dụng

### PM2 Commands
```bash
# Xem status
pm2 status

# Restart app
pm2 restart kocao-api

# Stop app
pm2 stop kocao-api

# Xem logs
pm2 logs kocao-api

# Monitor real-time
pm2 monit

# Xóa app
pm2 delete kocao-api
```

### Update code
```bash
# Pull code mới
git pull origin main

# Restart app
pm2 restart kocao-api
```

## Troubleshooting

### Nếu app không chạy:
```bash
# Xem logs chi tiết
pm2 logs kocao-api --lines 50

# Check Python dependencies
source venv/bin/activate
pip list

# Test manual
python main.py
```

### Nếu port bị block:
```bash
# Check port
netstat -tlnp | grep 8000

# Kill process nếu cần
sudo kill -9 <PID>
```

## Ưu điểm của cách deploy này:
- ✅ **Đơn giản** - Không cần Docker
- ✅ **Nhanh** - Deploy trong vài phút
- ✅ **Ổn định** - PM2 auto restart
- ✅ **Dễ quản lý** - Commands đơn giản
- ✅ **Tiết kiệm** - Ít tài nguyên hơn Docker

## API Endpoints:
- `GET /health` - Health check
- `POST /scrape` - Scrape TikTok video
- `POST /transcribe` - Transcribe audio

**API sẽ chạy tại: `http://36.50.54.74:8000`** 🎉
