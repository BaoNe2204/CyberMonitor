# Tool Giả Lập Tấn Công - Test Email Cảnh Báo

Tool này giả lập các cuộc tấn công để AI Engine phát hiện và tự động gửi email cảnh báo.

## Cách hoạt động

```
Tool gửi traffic giả → Backend nhận logs → AI Engine phân tích 
→ Phát hiện tấn công → Tạo Alert → Gửi email tự động
```

## Chuẩn bị

### 1. Lấy thông tin cần thiết

```sql
-- Lấy Tenant ID
SELECT Id, CompanyName FROM Tenants;

-- Lấy Server ID
SELECT Id, Name, TenantId FROM Servers;

-- Lấy API Key (hoặc tạo mới)
SELECT Id, KeyPrefix, Name FROM ApiKeys WHERE IsActive = 1;
```

### 2. Cài đặt Python dependencies

```bash
pip install requests
```

## Cách sử dụng

### Cú pháp cơ bản

```bash
python fake_attack_generator.py \
  --attack <loại_tấn_công> \
  --server-id <SERVER_ID> \
  --tenant-id <TENANT_ID> \
  --api-key <API_KEY>
```

### Ví dụ cụ thể

#### 1. Giả lập DDoS Attack (Critical)

```bash
python fake_attack_generator.py \
  --attack ddos \
  --server-id "12345678-1234-1234-1234-123456789012" \
  --tenant-id "87654321-4321-4321-4321-210987654321" \
  --api-key "sk_live_abcd1234"
```

Kết quả:
- Gửi 500 requests giả từ nhiều IP
- AI Engine phát hiện DDoS
- Email cảnh báo Critical được gửi ngay

#### 2. Giả lập Brute Force SSH (High)

```bash
python fake_attack_generator.py \
  --attack bruteforce \
  --server-id "YOUR_SERVER_ID" \
  --tenant-id "YOUR_TENANT_ID" \
  --api-key "YOUR_API_KEY" \
  --count 100
```

Kết quả:
- Gửi 100 requests đăng nhập SSH thất bại
- AI Engine phát hiện Brute Force
- Email cảnh báo High được gửi

#### 3. Giả lập Port Scan (Medium)

```bash
python fake_attack_generator.py \
  --attack portscan \
  --server-id "YOUR_SERVER_ID" \
  --tenant-id "YOUR_TENANT_ID" \
  --api-key "YOUR_API_KEY"
```

Kết quả:
- Quét nhiều port khác nhau
- AI Engine phát hiện Port Scan
- Email cảnh báo Medium được gửi

#### 4. Giả lập SQL Injection (High)

```bash
python fake_attack_generator.py \
  --attack sqli \
  --server-id "YOUR_SERVER_ID" \
  --tenant-id "YOUR_TENANT_ID" \
  --api-key "YOUR_API_KEY"
```

Kết quả:
- Gửi payload SQL Injection
- AI Engine phát hiện SQL Injection
- Email cảnh báo High được gửi

#### 5. Giả lập Malware (Critical)

```bash
python fake_attack_generator.py \
  --attack malware \
  --server-id "YOUR_SERVER_ID" \
  --tenant-id "YOUR_TENANT_ID" \
  --api-key "YOUR_API_KEY"
```

## Các loại tấn công hỗ trợ

| Loại | Tên | Severity | Số request mặc định |
|------|-----|----------|---------------------|
| `ddos` | DDoS Attack | Critical | 500 |
| `bruteforce` | Brute Force SSH | High | 50 |
| `portscan` | Port Scan | Medium | 100 |
| `sqli` | SQL Injection | High | 20 |
| `malware` | Malware Activity | Critical | 30 |

## Tùy chọn nâng cao

### Thay đổi số lượng request

```bash
python fake_attack_generator.py \
  --attack ddos \
  --count 1000 \
  --server-id "..." \
  --tenant-id "..." \
  --api-key "..."
```

### Thay đổi Backend URL

```bash
python fake_attack_generator.py \
  --attack ddos \
  --backend "http://192.168.1.100:5000" \
  --server-id "..." \
  --tenant-id "..." \
  --api-key "..."
```

## Kiểm tra kết quả

### 1. Xem Backend logs

```bash
# Trong console Backend, sẽ thấy:
[INFO] AI-PRO - ALERT TRIGGERED: DDoS - Phát hiện tấn công DDoS
```

### 2. Kiểm tra Database

```sql
-- Xem alerts mới
SELECT TOP 5 
    Id, Severity, AlertType, Title, SourceIp, CreatedAt 
FROM Alerts 
ORDER BY CreatedAt DESC;

-- Xem tickets tự động tạo
SELECT TOP 5 
    TicketNumber, Title, Priority, Status, CreatedAt 
FROM Tickets 
ORDER BY CreatedAt DESC;

-- Xem notifications
SELECT TOP 5 
    Title, Message, Type, CreatedAt 
FROM Notifications 
ORDER BY CreatedAt DESC;
```

### 3. Kiểm tra Email

- Kiểm tra Inbox của Admin users
- Subject: `🚨 [Critical] Phát hiện tấn công DDoS`
- Nếu không thấy, kiểm tra Spam/Junk

## Troubleshooting

### Lỗi "API Key không hợp lệ"

```bash
# Tạo API Key mới trong database
INSERT INTO ApiKeys (Id, TenantId, KeyHash, KeyPrefix, Name, Permissions, IsActive)
VALUES (
    NEWID(),
    'YOUR_TENANT_ID',
    'hash_of_key',
    'sk_test_',
    'Test API Key',
    '{"ingest":true,"read":true}',
    1
);
```

### AI Engine không phát hiện

- Đảm bảo AI Engine đang chạy:
  ```bash
  cd Al-Engine
  python ai_engine.py --backend-url http://localhost:5000
  ```
- Kiểm tra logs AI Engine
- Tăng số lượng request: `--count 1000`

### Email không được gửi

1. Kiểm tra cấu hình SMTP trong `appsettings.json`
2. Kiểm tra Admin users có email không:
   ```sql
   SELECT Email, Role FROM Users WHERE TenantId = 'YOUR_TENANT_ID';
   ```
3. Xem logs Backend để tìm lỗi gửi email

## Script nhanh

Tạo file `test_attack.sh`:

```bash
#!/bin/bash

# Cấu hình
SERVER_ID="YOUR_SERVER_ID"
TENANT_ID="YOUR_TENANT_ID"
API_KEY="YOUR_API_KEY"

# Giả lập DDoS
python fake_attack_generator.py \
  --attack ddos \
  --server-id "$SERVER_ID" \
  --tenant-id "$TENANT_ID" \
  --api-key "$API_KEY"

echo "✅ Hoàn tất! Kiểm tra email sau 10 giây..."
```

Chạy:
```bash
chmod +x test_attack.sh
./test_attack.sh
```

## Lưu ý quan trọng

- Tool này CHỈ dùng để test, KHÔNG dùng trên production
- Traffic giả sẽ được lưu vào database
- AI Engine cần 5-10 giây để phân tích
- Email sẽ được gửi tự động nếu phát hiện tấn công
- Mỗi alert sẽ tạo 1 ticket và 1 notification

## Luồng hoạt động chi tiết

```
1. Tool gửi traffic logs → POST /api/logs/ingest
2. Backend lưu vào TrafficLogs table
3. AI Engine (chạy mỗi 5s) đọc logs mới
4. AI Engine phân tích:
   - Feature extraction
   - Anomaly detection (ML)
   - Threat profiling (MITRE)
5. Nếu phát hiện tấn công → POST /api/alerts/trigger
6. Backend tạo Alert + Ticket
7. Backend gửi email tự động:
   - Gửi cho Admin users
   - Gửi cho Server Alert Emails
8. Push notification qua SignalR
```

## Ví dụ output

```
🚨 BẮT ĐẦU GIẢ LẬP TẤN CÔNG: DDoS Attack
📊 Số lượng request: 500
🎯 Server ID: 12345678-1234-1234-1234-123456789012
🏢 Tenant ID: 87654321-4321-4321-4321-210987654321
------------------------------------------------------------
✅ Đã gửi 50 traffic logs
📤 Đã gửi: 50/500 requests
✅ Đã gửi 50 traffic logs
📤 Đã gửi: 100/500 requests
...
------------------------------------------------------------
✅ HOÀN TẤT! Đã gửi 500 traffic logs

⏳ Đợi AI Engine phân tích (5-10 giây)...
📧 Email cảnh báo sẽ được gửi tự động nếu phát hiện tấn công!

💡 Kiểm tra:
   1. Backend logs: Xem AI Engine có phát hiện không
   2. Database: SELECT * FROM Alerts ORDER BY CreatedAt DESC
   3. Email: Kiểm tra hộp thư của Admin users
```
