#!/usr/bin/env python3
"""
Tool giả lập tấn công để test email cảnh báo
Gửi traffic giả vào Backend → AI Engine phát hiện → Gửi email tự động

Cách dùng:
    python fake_attack_generator.py --attack ddos
    python fake_attack_generator.py --attack bruteforce --count 50
    python fake_attack_generator.py --attack portscan
"""

import argparse
import json
import random
import time
from datetime import datetime, timezone
import requests

# Cấu hình - ĐÃ SETTING SẴN
BACKEND_URL = "http://192.168.1.6:5000"
API_KEY = "sk_live_xBtaaeH872HbK7IGuFVTumTtPTxht9wW"
SERVER_ID = "1229083d-6051-4647-ba81-a97460b73807"
TENANT_ID = "B2CE16AB-12D7-4A5D-8249-3FB35ED958A8"

# Danh sách IP giả để tấn công
ATTACKER_IPS = [
    "1.1.1.1", "8.8.8.8", "192.168.1.100", "10.0.0.50",
    "203.113.77.10", "45.76.123.45", "185.220.101.1"
]

# Các loại tấn công
ATTACK_TYPES = {
    "ddos": {
        "name": "DDoS Attack",
        "request_count": 500,  # Số request giả
        "bytes_in": 1000,
        "bytes_out": 100,
        "ports": [80, 443],
        "protocol": "TCP"
    },
    "bruteforce": {
        "name": "Brute Force SSH",
        "request_count": 50,
        "bytes_in": 500,
        "bytes_out": 200,
        "ports": [22],
        "protocol": "TCP"
    },
    "portscan": {
        "name": "Port Scan",
        "request_count": 100,
        "bytes_in": 100,
        "bytes_out": 50,
        "ports": list(range(1, 65535, 100)),  # Quét nhiều port
        "protocol": "TCP"
    },
    "sqli": {
        "name": "SQL Injection",
        "request_count": 20,
        "bytes_in": 2000,
        "bytes_out": 500,
        "ports": [80, 443],
        "protocol": "HTTP",
        "payload": "' OR '1'='1' -- UNION SELECT * FROM users"
    },
    "malware": {
        "name": "Malware Activity",
        "request_count": 30,
        "bytes_in": 5000,
        "bytes_out": 10000,
        "ports": [443, 8080],
        "protocol": "HTTPS",
        "payload": "base64_encoded_malware_payload"
    }
}


def generate_traffic_log(attack_type: str, server_id: str, tenant_id: str, attacker_ip: str = None):
    """Tạo 1 traffic log giả"""
    config = ATTACK_TYPES.get(attack_type, ATTACK_TYPES["ddos"])
    
    if not attacker_ip:
        attacker_ip = random.choice(ATTACKER_IPS)
    
    port = random.choice(config["ports"])
    
    log = {
        "tenantId": tenant_id,
        "serverId": server_id,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "sourceIp": attacker_ip,
        "destinationIp": "192.168.1.10",  # IP server bị tấn công
        "sourcePort": random.randint(10000, 65000),
        "destinationPort": port,
        "protocol": config["protocol"],
        "bytesIn": config["bytes_in"] + random.randint(-100, 100),
        "bytesOut": config["bytes_out"] + random.randint(-50, 50),
        "packetsIn": random.randint(1, 10),
        "packetsOut": random.randint(1, 5),
        "requestCount": 1,
        "isAnomaly": False,  # AI Engine sẽ tự phát hiện
        "rawPayload": config.get("payload", "")
    }
    
    return log


def send_traffic_logs(logs: list, api_key: str):
    """Gửi traffic logs lên Backend"""
    url = f"{BACKEND_URL}/api/logs/ingest"
    headers = {
        "Content-Type": "application/json",
        "X-API-Key": api_key
    }
    
    try:
        response = requests.post(url, json=logs, headers=headers, timeout=10)
        if response.status_code == 200:
            print(f"✅ Đã gửi {len(logs)} traffic logs")
            return True
        else:
            print(f"❌ Lỗi: {response.status_code} - {response.text}")
            return False
    except Exception as e:
        print(f"❌ Lỗi kết nối: {e}")
        return False


def simulate_attack(attack_type: str, server_id: str, tenant_id: str, api_key: str, count: int = None, backend_url: str = None):
    """Giả lập tấn công"""
    if attack_type not in ATTACK_TYPES:
        print(f"❌ Loại tấn công không hợp lệ: {attack_type}")
        print(f"Các loại hợp lệ: {', '.join(ATTACK_TYPES.keys())}")
        return
    
    # Sử dụng backend_url nếu được truyền vào
    url = backend_url or BACKEND_URL
    
    config = ATTACK_TYPES[attack_type]
    total_requests = count or config["request_count"]
    
    print(f"\n🚨 BẮT ĐẦU GIẢ LẬP TẤN CÔNG: {config['name']}")
    print(f"📊 Số lượng request: {total_requests}")
    print(f"🎯 Server ID: {server_id}")
    print(f"🏢 Tenant ID: {tenant_id}")
    print(f"🌐 Backend: {url}")
    print("-" * 60)
    
    # Gửi theo batch để không quá tải
    batch_size = 50
    total_sent = 0
    
    for i in range(0, total_requests, batch_size):
        batch_count = min(batch_size, total_requests - i)
        logs = []
        
        # Tạo traffic logs
        for _ in range(batch_count):
            log = generate_traffic_log(attack_type, server_id, tenant_id)
            logs.append(log)
        
        # Gửi lên Backend
        if send_traffic_logs(logs, api_key):
            total_sent += len(logs)
            print(f"📤 Đã gửi: {total_sent}/{total_requests} requests")
        
        # Delay nhỏ giữa các batch
        if i + batch_size < total_requests:
            time.sleep(0.5)
    
    print("-" * 60)
    print(f"✅ HOÀN TẤT! Đã gửi {total_sent} traffic logs")
    print(f"\n⏳ Đợi AI Engine phân tích (5-10 giây)...")
    print(f"📧 Email cảnh báo sẽ được gửi tự động nếu phát hiện tấn công!")
    print(f"\n💡 Kiểm tra:")
    print(f"   1. Backend logs: Xem AI Engine có phát hiện không")
    print(f"   2. Database: SELECT * FROM Alerts ORDER BY CreatedAt DESC")
    print(f"   3. Email: Kiểm tra hộp thư của Admin users")


def main():
    parser = argparse.ArgumentParser(description="Tool giả lập tấn công để test email cảnh báo")
    parser.add_argument("--attack", "-a", required=True, 
                       choices=list(ATTACK_TYPES.keys()),
                       help="Loại tấn công")
    parser.add_argument("--server-id", "-s", default=SERVER_ID,
                       help=f"Server ID (mặc định: {SERVER_ID})")
    parser.add_argument("--tenant-id", "-t", default=TENANT_ID,
                       help=f"Tenant ID (mặc định: {TENANT_ID})")
    parser.add_argument("--api-key", "-k", default=API_KEY,
                       help="API Key để gửi logs")
    parser.add_argument("--count", "-c", type=int,
                       help="Số lượng request (mặc định theo loại tấn công)")
    parser.add_argument("--backend", "-b", default=BACKEND_URL,
                       help=f"Backend URL (mặc định: {BACKEND_URL})")
    
    args = parser.parse_args()
    
    simulate_attack(
        attack_type=args.attack,
        server_id=args.server_id,
        tenant_id=args.tenant_id,
        api_key=args.api_key,
        count=args.count,
        backend_url=args.backend
    )


if __name__ == "__main__":
    main()
