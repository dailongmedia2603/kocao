## Cấu Hình Môi Trường

### 1. Development (Local)

Khi chạy trên máy local, không cần cấu hình gì đặc biệt:

```bash
# Sử dụng file .env mặc định hoặc không cần .env
python main.py
```

**Kết quả:**
- API chạy tại: `http://localhost:8000`
- Tất cả URL trong response: `http://localhost:8000/...`
- Domain restriction: TẮT (mặc định)
- CORS: Cho phép tất cả (*) 

### 2. Production (VPS)

Trên VPS, cần copy file cấu hình production:

```bash
# Copy production config
cp production.env .env

# Restart service
pm2 restart kocao
```

**Kết quả:**
- API chạy tại: `http://36.50.54.74:8000`
- Tất cả URL trong response: `http://36.50.54.74:8000/...`
- Domain restriction: BẬT
- CORS: Chỉ cho phép domain được cấu hình

## Biến Môi Trường Quan Trọng

### PUBLIC_URL
Định nghĩa URL public của server. Tất cả URL trong response sẽ dựa vào biến này.

```bash
# Development
PUBLIC_URL=http://localhost:8000

# Production VPS
PUBLIC_URL=http://36.50.54.74:8000

# Production Domain
PUBLIC_URL=https://api.yourdomain.com
```

### ENABLE_DOMAIN_RESTRICTION
Bật/tắt kiểm tra domain truy cập.

```bash
# Development: cho phép tất cả
ENABLE_DOMAIN_RESTRICTION=false

# Production: chỉ cho phép domain cụ thể
ENABLE_DOMAIN_RESTRICTION=true
```

### ALLOWED_DOMAINS
Danh sách domain được phép truy cập (khi ENABLE_DOMAIN_RESTRICTION=true).

```bash
ALLOWED_DOMAINS=kocao.vercel.app,drxaikoc.com,drxaistudio.com
```

### CORS_ALLOW_ORIGINS
Cấu hình CORS cho phép origin nào được phép.

```bash
# Development: cho phép tất cả
CORS_ALLOW_ORIGINS=*

# Production: chỉ domain cụ thể
CORS_ALLOW_ORIGINS=https://kocao.vercel.app,https://drxaikoc.com,https://drxaistudio.com
```