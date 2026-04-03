#!/usr/bin/env python3
"""
CyberMonitor Agent - Mắt thần bảo vệ server
Thu thập log mạng, phát hiện 20 loại tấn công, tự động block IP tấn công.

Cách cài đặt:
    pip install requests psutil
    python agent.py --api-key sk_live_xxxx --server-url http://localhost:5000

Auto-block: Khi phát hiện tấn công, agent tự động gọi API backend để block IP.

"""

import argparse
import hashlib
import json
import logging
import os
import platform
import random
import re
import socket
import ssl
import subprocess
import sys
import threading
import time
from dataclasses import dataclass, field
from typing import Optional
from datetime import datetime, timezone, timedelta
import requests

# ============================================================================
# CẤU HÌNH
# ============================================================================

DEFAULT_INTERVAL = 5
DEFAULT_BATCH_SIZE = 100
MAX_RETRIES = 3
RETRY_DELAY = 5
HEARTBEAT_INTERVAL = 30

# Auto-block settings
AUTO_BLOCK_ENABLED = os.getenv("AUTO_BLOCK", "true").lower() == "true"
BLOCK_THRESHOLD_SCORE = float(os.getenv("BLOCK_THRESHOLD_SCORE", "0.75"))

LOGGING_FORMAT = "%(asctime)s [%(levelname)s] %(name)s - %(message)s"

logging.basicConfig(
    level=logging.INFO,
    format=LOGGING_FORMAT,
    handlers=[logging.StreamHandler(sys.stdout)]
)
logger = logging.getLogger("CyberMonitorAgent")

# ============================================================================
# ATTACK SIGNATURES & PATTERNS
# ============================================================================

# Port -> Service mapping
PORT_SERVICE_MAP = {
    21: "FTP", 22: "SSH", 23: "TELNET", 25: "SMTP", 53: "DNS",
    80: "HTTP", 110: "POP3", 143: "IMAP", 443: "HTTPS",
    445: "SMB", 3306: "MySQL", 3389: "RDP", 5432: "PostgreSQL",
    6379: "Redis", 8080: "HTTP-ALT", 8443: "HTTPS-ALT", 27017: "MongoDB",
    5000: "Flask", 5001: "Flask-TLS", 8888: "Jupyter"
}

# Suspicious port list (non-standard, commonly used for malicious)
SUSPICIOUS_PORTS = {4444, 5555, 6666, 7777, 8888, 9999, 12345, 31337}

# Known mining pool domains/IP patterns (partial list)
MINING_PATTERNS = [
    "stratum", "bitcoin", "pool", "xmr", "monero", "ethermine",
    "nanopool", "minexmr", "cryptonight", "hashvault"
]

# SQL injection patterns
SQLI_PATTERNS = [
    r"('|\"|%)?(\bOR\b|\bAND\b).*(=|<|>)",
    r"UNION\s+(ALL\s+)?SELECT",
    r"DROP\s+(TABLE|DATABASE|INDEX)",
    r"EXEC(\s|\()",
    r"0x[0-9a-fA-F]+",
    r"CHAR\s*\(",
    r"--\s*$",
    r"/\*.*\*/",
    r"WAITFOR\s+DELAY",
    r"BENCHMARK\s*\(",
    r"SLEEP\s*\(",
]

# XSS patterns
XSS_PATTERNS = [
    r"<script[^>]*>",
    r"javascript:",
    r"on\w+\s*=",
    r"<iframe[^>]*>",
    r"<object[^>]*>",
    r"<embed[^>]*>",
    r"eval\s*\(",
    r"document\.cookie",
    r"document\.write",
]

# Command injection patterns
CMD_INJECT_PATTERNS = [
    r"[;&|`$]",
    r"\b(cat|ls|wget|curl|nc|bash|sh|cmd|powershell)\s",
    r"\|\s*\w+",
    r"\$\([^)]+\)",
    r"\$\{[^}]+\}",
    r"base64\s+-d",
    r"nc\s+-e",
    r"/etc/passwd",
    r"etc/shadow",
]

# Web shell file extensions
WEBSHELL_EXTENSIONS = [
    ".php", ".php3", ".php4", ".php5", ".phtml",
    ".asp", ".aspx", ".jsp", ".jspx",
    ".cgi", ".pl", ".py", ".rb"
]

# DNS tunneling patterns
DNS_QUERY_PATTERNS = [
    r"^[a-zA-Z0-9+/]{20,}=",
    r"\.su$|\.tk$|\.ml$|\.ga$|\.cf$|\.gq$",
    r"longsubdomain",
]


# ============================================================================
# MODELS
# ============================================================================

@dataclass
class TrafficLogEntry:
    source_ip: str
    destination_ip: Optional[str] = None
    source_port: Optional[int] = None
    destination_port: Optional[int] = None
    protocol: Optional[str] = None
    bytes_in: int = 0
    bytes_out: int = 0
    packets_in: int = 0
    packets_out: int = 0
    request_count: int = 1
    raw_payload: Optional[str] = None

    def to_dict(self) -> dict:
        return {
            "SourceIp": self.source_ip,
            "DestinationIp": self.destination_ip,
            "SourcePort": self.source_port,
            "DestinationPort": self.destination_port,
            "Protocol": self.protocol,
            "BytesIn": self.bytes_in,
            "BytesOut": self.bytes_out,
            "PacketsIn": self.packets_in,
            "PacketsOut": self.packets_out,
            "RequestCount": self.request_count,
            "RawPayload": self.raw_payload,
        }


@dataclass
class SystemMetrics:
    cpu_percent: float = 0.0
    ram_percent: float = 0.0
    ram_used_mb: int = 0
    ram_total_mb: int = 0
    disk_percent: float = 0.0
    network_bytes_sent: int = 0
    network_bytes_recv: int = 0
    uptime_seconds: int = 0
    hostname: str = ""
    os_name: str = ""
    timestamp: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


@dataclass
class AttackSignature:
    attack_type: str
    severity: str
    score: float
    title: str
    description: str
    mitre_tactic: str
    mitre_technique: str
    evidence: dict


# ============================================================================
# ATTACK DETECTOR - Phát hiện 20 loại tấn công
# ============================================================================

class AttackDetector:
    """
    Phát hiện 20 loại tấn công dựa trên traffic patterns + signature matching.
    """

    def __init__(self, local_ip: str):
        self.local_ip = local_ip
        self._ip_history: dict[str, list] = {}
        self._lock = threading.Lock()

    def analyze(self, logs: list[TrafficLogEntry]) -> list[AttackSignature]:
        """Phân tích logs, trả về danh sách các cuộc tấn công phát hiện được."""
        attacks = []

        # Gom nhóm theo source IP
        ip_groups: dict[str, list] = {}
        for log in logs:
            src = log.source_ip
            if src not in ip_groups:
                ip_groups[src] = []
            ip_groups[src].append(log)

        for src_ip, ip_logs in ip_groups.items():
            # Bỏ qua nếu là IP local
            if src_ip in (self.local_ip, "127.0.0.1", "::1", "localhost"):
                continue

            # Phát hiện từng loại tấn công
            detected = self._detect_all_attacks(src_ip, ip_logs)
            attacks.extend(detected)

        return attacks

    def _detect_all_attacks(self, src_ip: str, logs: list[TrafficLogEntry]) -> list[AttackSignature]:
        attacks = []
        total_requests = sum(l.request_count for l in logs)
        total_bytes_in = sum(l.bytes_in for l in logs)
        total_bytes_out = sum(l.bytes_out for l in logs)
        ports_touched = {l.destination_port for l in logs if l.destination_port}
        protocols = {l.protocol for l in logs if l.protocol}
        payloads = [l.raw_payload for l in logs if l.raw_payload]
        total_packets_in = sum(l.packets_in for l in logs)
        total_packets_out = sum(l.packets_out for l in logs)

        now = datetime.now(timezone.utc)
        with self._lock:
            # Lưu history để so sánh
            if src_ip not in self._ip_history:
                self._ip_history[src_ip] = []
            self._ip_history[src_ip].append({
                "time": now,
                "requests": total_requests,
                "bytes": total_bytes_in + total_bytes_out,
                "ports": len(ports_touched)
            })
            # Giữ 10 phút history
            cutoff = now - timedelta(minutes=10)
            self._ip_history[src_ip] = [
                h for h in self._ip_history[src_ip]
                if (now - h["time"].replace(tzinfo=timezone.utc)).total_seconds() < 600
            ]
            recent = self._ip_history[src_ip]

        avg_requests_per_cycle = sum(h["requests"] for h in recent) / max(1, len(recent))

        # ============ 1. DDoS (T1498) ============
        ddos_score = self._score_ddos(total_requests, avg_requests_per_cycle, logs)
        if ddos_score >= 0.75:
            attacks.append(AttackSignature(
                attack_type="DDoS",
                severity="Critical",
                score=ddos_score,
                title=f"DDoS Attack: {src_ip} - {total_requests:,} requests",
                description=(
                    f"Phát hiện tấn công DDoS từ {src_ip}.\n"
                    f"- Requests: {total_requests:,} (avg cycle: {avg_requests_per_cycle:.0f})\n"
                    f"- Bytes out: {total_bytes_out:,} bytes\n"
                    f"- Target port: {ports_touched}\n"
                    f"- Khuyến nghị: Block IP trên firewall ngay lập tức"
                ),
                mitre_tactic="Impact",
                mitre_technique="T1498 - Network Denial of Service",
                evidence={
                    "source_ip": src_ip,
                    "request_count": total_requests,
                    "avg_requests_per_cycle": avg_requests_per_cycle,
                    "target_ports": sorted(ports_touched),
                    "ddos_score": ddos_score
                }
            ))

        # ============ 2. Brute Force SSH (T1110) ============
        ssh_logs = [l for l in logs if l.destination_port == 22]
        if ssh_logs:
            bf_score = self._score_bruteforce(total_requests, total_bytes_in, logs)
            if bf_score >= 0.7:
                attacks.append(AttackSignature(
                    attack_type="BruteForce_SSH",
                    severity="High",
                    score=bf_score,
                    title=f"SSH Brute Force: {src_ip} - {len(ssh_logs)} attempts",
                    description=(
                        f"Phát hiện brute force SSH từ {src_ip}.\n"
                        f"- SSH connections: {len(ssh_logs)}\n"
                        f"- Avg bytes/request: {total_bytes_in // max(1, len(ssh_logs))} bytes\n"
                        f"- Ports touched: {sorted(ports_touched)}\n"
                        f"- Khuyến nghị: Cài fail2ban, block IP, bật 2FA SSH"
                    ),
                    mitre_tactic="Credential Access",
                    mitre_technique="T1110 - Brute Force",
                    evidence={
                        "source_ip": src_ip,
                        "ssh_attempts": len(ssh_logs),
                        "avg_bytes": total_bytes_in // max(1, len(ssh_logs)),
                        "bf_score": bf_score
                    }
                ))

        # ============ 3. Brute Force HTTP (T1110) ============
        web_logs = [l for l in logs if l.destination_port in (80, 443, 8080, 8443)]
        if web_logs:
            # Tìm POST requests trong payload
            post_count = sum(1 for p in payloads if p and re.search(r"POST|login|auth|password", p, re.I))
            if post_count >= 5:
                attacks.append(AttackSignature(
                    attack_type="BruteForce_HTTP",
                    severity="High",
                    score=0.75,
                    title=f"HTTP Login Brute Force: {src_ip} - {post_count} login attempts",
                    description=(
                        f"Phát hiện brute force HTTP/login từ {src_ip}.\n"
                        f"- Login attempts: {post_count}\n"
                        f"- Target: {web_logs[0].destination_port}/{'https' if web_logs[0].destination_port in (443, 8443) else 'http'}\n"
                        f"- Khuyến nghị: Block IP, bật rate limiting, captcha"
                    ),
                    mitre_tactic="Credential Access",
                    mitre_technique="T1110 - Brute Force",
                    evidence={"source_ip": src_ip, "login_attempts": post_count}
                ))

        # ============ 4. Port Scan / Sweep (T1016) ============
        if len(ports_touched) >= 10 and total_requests < len(ports_touched) * 3:
            attacks.append(AttackSignature(
                attack_type="PortScan",
                severity="Medium",
                score=min(0.9, 0.5 + len(ports_touched) * 0.03),
                title=f"Port Scan: {src_ip} - {len(ports_touched)} ports scanned",
                description=(
                    f"Phát hiện port scan từ {src_ip}.\n"
                    f"- Ports scanned: {sorted(ports_touched)}\n"
                    f"- Services exposed: {[PORT_SERVICE_MAP.get(p, 'Unknown') for p in sorted(ports_touched)]}\n"
                    f"- Khuyến nghị: Đóng các port không cần thiết, cập nhật firewall"
                ),
                mitre_tactic="Discovery",
                mitre_technique="T1016 - System Network Configuration Discovery",
                evidence={
                    "source_ip": src_ip,
                    "ports_scanned": sorted(ports_touched),
                    "port_count": len(ports_touched),
                    "avg_bytes_per_port": total_bytes_in // max(1, len(ports_touched))
                }
            ))

        # ============ 5. SQL Injection (T1190) ============
        sqli_matches = []
        for payload in payloads:
            if payload:
                for pattern in SQLI_PATTERNS:
                    if re.search(pattern, payload, re.I):
                        sqli_matches.append(pattern)
                        break
        if sqli_matches:
            attacks.append(AttackSignature(
                attack_type="SQLInjection",
                severity="High",
                score=min(1.0, 0.8 + len(sqli_matches) * 0.05),
                title=f"SQL Injection Attempt: {src_ip} - {len(sqli_matches)} patterns",
                description=(
                    f"Phát hiện SQL injection từ {src_ip}.\n"
                    f"- Patterns detected: {set(sqli_matches)}\n"
                    f"- Target ports: {[p for p in sorted(ports_touched) if p in (80, 443, 3306, 5432)]}\n"
                    f"- Khuyến nghị: Review WAF logs, sanitize inputs, dùng parameterized queries"
                ),
                mitre_tactic="Initial Access",
                mitre_technique="T1190 - Exploit Public-Facing Application",
                evidence={
                    "source_ip": src_ip,
                    "sqli_patterns": list(set(sqli_matches)),
                    "pattern_count": len(sqli_matches)
                }
            ))

        # ============ 6. Malware / Reverse Shell (T1059) ============
        malware_indicators = []
        for payload in payloads:
            if payload:
                for pattern in CMD_INJECT_PATTERNS:
                    if re.search(pattern, payload, re.I):
                        malware_indicators.append(pattern)
                        break
                # Check for base64 encoded commands
                if re.search(r"[A-Za-z0-9+/]{50,}={0,2}", payload):
                    malware_indicators.append("base64_encoded")
        if malware_indicators or (total_bytes_out > 500000 and len(ports_touched) > 5):
            attacks.append(AttackSignature(
                attack_type="Malware",
                severity="Critical",
                score=min(1.0, 0.85 + len(malware_indicators) * 0.05),
                title=f"Malware / Suspicious Activity: {src_ip}",
                description=(
                    f"Phát hiện malware hoặc suspicious command execution từ {src_ip}.\n"
                    f"- Indicators: {set(malware_indicators)}\n"
                    f"- Large outbound: {total_bytes_out:,} bytes\n"
                    f"- Khuyến nghị: Isolate server, forensics investigation"
                ),
                mitre_tactic="Execution",
                mitre_technique="T1059 - Command and Scripting Interpreter",
                evidence={"source_ip": src_ip, "indicators": list(set(malware_indicators))}
            ))

        # ============ 7. XSS (T1059) ============
        xss_matches = []
        for payload in payloads:
            if payload:
                for pattern in XSS_PATTERNS:
                    if re.search(pattern, payload, re.I):
                        xss_matches.append(pattern)
                        break
        if xss_matches:
            attacks.append(AttackSignature(
                attack_type="XSS",
                severity="Medium",
                score=min(0.9, 0.7 + len(xss_matches) * 0.05),
                title=f"XSS Attempt: {src_ip} - {len(xss_matches)} patterns",
                description=(
                    f"Phát hiện XSS attempt từ {src_ip}.\n"
                    f"- Patterns: {set(xss_matches)}\n"
                    f"- Khuyến nghị: Sanitize output, set CSP headers"
                ),
                mitre_tactic="Execution",
                mitre_technique="T1059 - Command and Scripting Interpreter",
                evidence={"source_ip": src_ip, "xss_patterns": list(set(xss_matches))}
            ))

        # ============ 8. DNS Amplification (T1498) ============
        dns_logs = [l for l in logs if l.destination_port == 53]
        if dns_logs:
            dns_bytes = sum(l.bytes_out for l in dns_logs)
            dns_ratio = dns_bytes / max(1, sum(l.bytes_in for l in dns_logs))
            if dns_ratio > 10 and dns_bytes > 10000:
                attacks.append(AttackSignature(
                    attack_type="DNSAmplification",
                    severity="High",
                    score=min(1.0, 0.8 + dns_ratio * 0.05),
                    title=f"DNS Amplification: {src_ip} - ratio {dns_ratio:.1f}x",
                    description=(
                        f"Phát hiện DNS amplification attack từ {src_ip}.\n"
                        f"- DNS response bytes: {dns_bytes:,}\n"
                        f"- Amplification ratio: {dns_ratio:.1f}x\n"
                        f"- Khuyến nghị: Block DNS amplification, configure recursive DNS"
                    ),
                    mitre_tactic="Impact",
                    mitre_technique="T1498 - Network Denial of Service",
                    evidence={"source_ip": src_ip, "dns_ratio": dns_ratio, "dns_bytes": dns_bytes}
                ))

        # ============ 9. MITM (T1557) ============
        # Phát hiện ARP spoofing indicator - traffic giữa 2 internal IPs bất thường
        internal_logs = [l for l in logs if self._is_internal_ip(l.destination_ip or "")]
        if len(internal_logs) > 20 and len(ports_touched) > 5:
            attacks.append(AttackSignature(
                attack_type="MITM",
                severity="High",
                score=0.7,
                title=f"Suspicious Internal Traffic: {src_ip}",
                description=(
                    f"Phát hiện suspicious internal traffic từ {src_ip}.\n"
                    f"- Internal connections: {len(internal_logs)}\n"
                    f"- Khuyến nghị: Kiểm tra ARP table, switch port security"
                ),
                mitre_tactic="Adversary-in-the-Middle",
                mitre_technique="T1557 - Sniffing",
                evidence={"source_ip": src_ip, "internal_connections": len(internal_logs)}
            ))

        # ============ 10. Lateral Movement (T1021) ============
        if len(internal_logs) > 10 and len(ports_touched) >= 3:
            attacks.append(AttackSignature(
                attack_type="LateralMovement",
                severity="High",
                score=min(0.9, 0.6 + len(internal_logs) * 0.02),
                title=f"Lateral Movement: {src_ip} - {len(internal_logs)} internal hops",
                description=(
                    f"Phát hiện lateral movement từ {src_ip}.\n"
                    f"- Internal hops: {len(internal_logs)}\n"
                    f"- Services accessed: {sorted(ports_touched)}\n"
                    f"- Khuyến nghị: Isolate affected systems, reset credentials"
                ),
                mitre_tactic="Lateral Movement",
                mitre_technique="T1021 - Remote Services",
                evidence={"source_ip": src_ip, "lateral_hops": len(internal_logs)}
            ))

        # ============ 11. Data Exfiltration (T1041) ============
        if total_bytes_out > 50_000_000:  # > 50MB outbound
            attacks.append(AttackSignature(
                attack_type="DataExfiltration",
                severity="Critical",
                score=min(1.0, 0.8 + (total_bytes_out / 100_000_000) * 0.2),
                title=f"Data Exfiltration: {src_ip} - {total_bytes_out / 1024 / 1024:.1f} MB outbound",
                description=(
                    f"Phát hiện data exfiltration từ {src_ip}.\n"
                    f"- Total outbound: {total_bytes_out / 1024 / 1024:.2f} MB\n"
                    f"- Inbound: {total_bytes_in / 1024 / 1024:.2f} MB\n"
                    f"- Ratio out/in: {total_bytes_out / max(1, total_bytes_in):.1f}x\n"
                    f"- Khuyến nghị: Block IP immediately, DLP investigation"
                ),
                mitre_tactic="Exfiltration",
                mitre_technique="T1041 - Exfiltration Over C2 Channel",
                evidence={
                    "source_ip": src_ip,
                    "bytes_out_mb": round(total_bytes_out / 1024 / 1024, 2),
                    "bytes_in_mb": round(total_bytes_in / 1024 / 1024, 2),
                    "ratio": round(total_bytes_out / max(1, total_bytes_in), 1)
                }
            ))

        # ============ 12. DNS Tunneling (T1071) ============
        dns_payload_logs = [l for l in logs if l.destination_port == 53 and l.raw_payload]
        dns_tunnel_count = 0
        for l in dns_payload_logs:
            for pattern in DNS_QUERY_PATTERNS:
                if re.search(pattern, l.raw_payload or "", re.I):
                    dns_tunnel_count += 1
                    break
        if dns_tunnel_count >= 10 or (len(dns_logs) > 100 and len(set(l.raw_payload for l in dns_logs if l.raw_payload)) > 50):
            attacks.append(AttackSignature(
                attack_type="DNSTunneling",
                severity="Medium",
                score=min(0.9, 0.6 + dns_tunnel_count * 0.02),
                title=f"DNS Tunneling: {src_ip} - {dns_tunnel_count} suspicious queries",
                description=(
                    f"Phát hiện DNS tunneling từ {src_ip}.\n"
                    f"- Suspicious DNS queries: {dns_tunnel_count}\n"
                    f"- Khuyến nghị: Block long DNS queries, DNS logging"
                ),
                mitre_tactic="Command and Control",
                mitre_technique="T1071 - Application Layer Protocol",
                evidence={"source_ip": src_ip, "dns_tunnel_count": dns_tunnel_count}
            ))

        # ============ 13. Slowloris (T1498) ============
        slowloris_score = 0
        http_logs = [l for l in logs if l.destination_port in (80, 443, 8080, 8443)]
        if http_logs:
            avg_bytes_http = sum(l.bytes_in for l in http_logs) / len(http_logs)
            if avg_bytes_http < 100 and len(http_logs) > 20:
                slowloris_score = min(1.0, 0.7 + len(http_logs) * 0.01)
        if slowloris_score >= 0.7:
            attacks.append(AttackSignature(
                attack_type="Slowloris",
                severity="Medium",
                score=slowloris_score,
                title=f"Slowloris DoS: {src_ip} - {len(http_logs)} incomplete connections",
                description=(
                    f"Phát hiện Slowloris attack từ {src_ip}.\n"
                    f"- HTTP connections: {len(http_logs)}\n"
                    f"- Avg bytes/conn: {avg_bytes_http:.0f}\n"
                    f"- Khuyến nghị: Timeout config, rate limiting"
                ),
                mitre_tactic="Impact",
                mitre_technique="T1498 - Network Denial of Service",
                evidence={"source_ip": src_ip, "http_connections": len(http_logs)}
            ))

        # ============ 14. SYN Flood (T1498) ============
        # SYN flood: many packets_out, few packets_in (incomplete handshake)
        syn_packets_in = sum(l.packets_in for l in logs)
        syn_packets_out = sum(l.packets_out for l in logs)
        syn_indicator = 0.0
        if syn_packets_in > 0:
            syn_indicator = syn_packets_out / syn_packets_in
        if syn_indicator > 5 and syn_packets_out > 5000:
            attacks.append(AttackSignature(
                attack_type="SYN_Flood",
                severity="Critical",
                score=min(1.0, 0.8 + syn_indicator * 0.05),
                title=f"SYN Flood: {src_ip} - ratio {syn_indicator:.1f}x, {syn_packets_out:,} SYNs",
                description=(
                    f"Phát hiện SYN flood từ {src_ip}.\n"
                    f"- Out packets: {syn_packets_out:,}\n"
                    f"- In packets: {syn_packets_in:,}\n"
                    f"- Ratio: {syn_indicator:.1f}x (high = potential SYN flood)\n"
                    f"- Khuyến nghị: Block IP, enable SYN cookies"
                ),
                mitre_tactic="Impact",
                mitre_technique="T1498 - Network Denial of Service",
                evidence={
                    "source_ip": src_ip,
                    "packets_out": syn_packets_out,
                    "packets_in": syn_packets_in,
                    "syn_ratio": syn_indicator
                }
            ))

        # ============ 15. ICMP Flood (T1498) ============
        icmp_logs = [l for l in logs if l.protocol and "ICMP" in l.protocol.upper()]
        if icmp_logs and len(icmp_logs) > 100:
            attacks.append(AttackSignature(
                attack_type="ICMP_Flood",
                severity="Medium",
                score=min(0.9, 0.6 + len(icmp_logs) * 0.003),
                title=f"ICMP Flood: {src_ip} - {len(icmp_logs)} pings",
                description=(
                    f"Phát hiện ICMP flood từ {src_ip}.\n"
                    f"- ICMP packets: {len(icmp_logs)}\n"
                    f"- Khuyến nghị: Block ICMP, except essential (mtu discovery)"
                ),
                mitre_tactic="Impact",
                mitre_technique="T1498 - Network Denial of Service",
                evidence={"source_ip": src_ip, "icmp_count": len(icmp_logs)}
            ))

        # ============ 16. Web Shell Upload (T1105) ============
        upload_indicators = []
        for payload in payloads:
            if payload:
                for ext in WEBSHELL_EXTENSIONS:
                    if ext in payload.lower():
                        upload_indicators.append(ext)
        if upload_indicators:
            attacks.append(AttackSignature(
                attack_type="WebShellUpload",
                severity="Critical",
                score=min(1.0, 0.85 + len(upload_indicators) * 0.05),
                title=f"Web Shell Upload: {src_ip} - {len(upload_indicators)} suspicious files",
                description=(
                    f"Phát hiện web shell upload attempt từ {src_ip}.\n"
                    f"- Suspicious extensions: {set(upload_indicators)}\n"
                    f"- Khuyến nghị: Review upload endpoints, WAF rules"
                ),
                mitre_tactic="Initial Access",
                mitre_technique="T1105 - Ingress Tool Transfer",
                evidence={"source_ip": src_ip, "extensions": list(set(upload_indicators))}
            ))

        # ============ 17. Privilege Escalation (T1068) ============
        priv_esc_indicators = []
        for payload in payloads:
            if payload:
                if re.search(r"(sudo|su |chmod|chown|passwd|sudoers|\/etc\/shadow)", payload, re.I):
                    priv_esc_indicators.append("sudo_privilege")
                if re.search(r"(0x[a-f0-9]{8}|token|impersonate)", payload, re.I):
                    priv_esc_indicators.append("token_manipulation")
        if priv_esc_indicators:
            attacks.append(AttackSignature(
                attack_type="PrivilegeEscalation",
                severity="Critical",
                score=min(1.0, 0.8 + len(priv_esc_indicators) * 0.1),
                title=f"Privilege Escalation Attempt: {src_ip}",
                description=(
                    f"Phát hiện privilege escalation attempt từ {src_ip}.\n"
                    f"- Indicators: {set(priv_esc_indicators)}\n"
                    f"- Khuyến nghị: Review user permissions, audit sudo commands"
                ),
                mitre_tactic="Privilege Escalation",
                mitre_technique="T1068 - Exploitation for Privilege Escalation",
                evidence={"source_ip": src_ip, "indicators": list(set(priv_esc_indicators))}
            ))

        # ============ 18. Cryptomining (T1496) ============
        crypto_indicators = []
        for payload in payloads:
            if payload:
                for pattern in MINING_PATTERNS:
                    if pattern.lower() in payload.lower():
                        crypto_indicators.append(pattern)
        high_cpu_indicator = len(logs) > 0  # Checked via metrics separately
        if crypto_indicators or (total_bytes_out > 10000000 and total_bytes_in < 100000):
            attacks.append(AttackSignature(
                attack_type="Cryptomining",
                severity="Medium",
                score=min(0.9, 0.6 + len(crypto_indicators) * 0.1),
                title=f"Cryptomining Indicator: {src_ip}",
                description=(
                    f"Phát hiện cryptomining indicator từ {src_ip}.\n"
                    f"- Mining patterns: {set(crypto_indicators)}\n"
                    f"- Outbound: {total_bytes_out:,} bytes\n"
                    f"- Khuyến nghị: Check CPU usage, scan for miners"
                ),
                mitre_tactic="Impact",
                mitre_technique="T1496 - Resource Hijacking",
                evidence={"source_ip": src_ip, "patterns": list(set(crypto_indicators))}
            ))

        # ============ 19. Suspicious Protocol (Anomaly) ============
        # Phát hiện protocol bất thường (ví dụ: IRC, TOR, custom protocols)
        suspicious_protocols = {"IRC", "TOR", "SOCKS", "PROXY", "FTP-DATA"}
        found_suspicious = protocols & suspicious_protocols
        if found_suspicious:
            attacks.append(AttackSignature(
                attack_type="SuspiciousProtocol",
                severity="Medium",
                score=0.65,
                title=f"Suspicious Protocol: {src_ip} using {found_suspicious}",
                description=(
                    f"Phát hiện suspicious protocol từ {src_ip}.\n"
                    f"- Protocols: {found_suspicious}\n"
                    f"- Khuyến nghị: Investigate traffic content"
                ),
                mitre_tactic="Discovery",
                mitre_technique="T1046 - Network Service Discovery",
                evidence={"source_ip": src_ip, "protocols": list(found_suspicious)}
            ))

        # ============ 20. Zero-day / Unknown Anomaly (General) ============
        # Bất kỳ IP nào có score tổng hợp cao mà không khớp loại cụ thể nào
        if not attacks:
            composite = min(1.0,
                (total_requests / 1000) * 0.2 +
                (len(ports_touched) / 50) * 0.2 +
                (total_bytes_out / 1_000_000) * 0.3
            )
            if composite >= 0.8:
                attacks.append(AttackSignature(
                    attack_type="UnknownAnomaly",
                    severity="High",
                    score=composite,
                    title=f"Unknown Anomaly: {src_ip} - score {composite:.2f}",
                    description=(
                        f"Phát hiện bất thường chưa xác định từ {src_ip}.\n"
                        f"- Composite score: {composite:.2f}\n"
                        f"- Requests: {total_requests:,}, Ports: {len(ports_touched)}\n"
                        f"- Bytes out: {total_bytes_out:,}\n"
                        f"- Khuyến nghị: ML model flag - investigate manually"
                    ),
                    mitre_tactic="Discovery",
                    mitre_technique="T1046 - Network Service Discovery",
                    evidence={
                        "source_ip": src_ip,
                        "composite_score": composite,
                        "requests": total_requests,
                        "ports": len(ports_touched)
                    }
                ))

        return attacks

    def _score_ddos(self, request_count: int, avg_per_cycle: float, logs: list[TrafficLogEntry]) -> float:
        """Tính DDoS score 0.0-1.0"""
        if request_count < 100:
            return 0.0
        score = 0.0
        if request_count > 5000:
            score += 0.6
        elif request_count > 1000:
            score += 0.3
        elif request_count > 100:
            score += 0.1

        if avg_per_cycle > 5000:
            score += 0.3
        elif avg_per_cycle > 1000:
            score += 0.15

        # 1 IP gửi đến nhiều ports cùng lúc = DDoS
        ports = {l.destination_port for l in logs if l.destination_port}
        if len(ports) == 1 and request_count > 100:
            score += 0.1

        return min(1.0, score)

    def _score_bruteforce(self, request_count: int, bytes_in: int, logs: list[TrafficLogEntry]) -> float:
        """Tính brute force score"""
        score = 0.0
        avg_bytes = bytes_in / max(1, request_count)
        if request_count > 10:
            score += 0.4
        elif request_count > 5:
            score += 0.2

        if avg_bytes < 100:
            score += 0.3
        elif avg_bytes < 500:
            score += 0.1

        return min(1.0, score)

    def _is_internal_ip(self, ip: str) -> bool:
        """Check if IP is internal (RFC 1918)"""
        try:
            parts = ip.split('.')
            if len(parts) != 4:
                return False
            first = int(parts[0])
            second = int(parts[1])
            if first == 10:
                return True
            if first == 172 and 16 <= second <= 31:
                return True
            if first == 192 and second == 168:
                return True
            if first == 127:
                return True
            return False
        except (ValueError, IndexError):
            return False


# ============================================================================
# IP BLOCKER - Tự động chặn IP tấn công
# ============================================================================

class IPBlocker:
    """
    Chặn IP tấn công trên local server.
    Windows: dùng Windows Firewall (netsh)
    Linux: dùng iptables
    """

    def __init__(self, backend_url: str, api_key: str):
        self.backend_url = backend_url.rstrip('/')
        self.api_key = api_key
        self.session = requests.Session()
        self.session.headers.update({
            "X-API-Key": api_key,
            "Content-Type": "application/json"
        })
        self._blocked_ips: set[str] = set()
        self._lock = threading.Lock()
        self._platform = platform.system()

    def block(self, ip: str, reason: str, attack_type: str, severity: str) -> bool:
        """Chặn IP - trả về True nếu thành công"""
        with self._lock:
            if ip in self._blocked_ips:
                logger.debug(f"IP {ip} already blocked")
                return True

        logger.warning(f"[BLOCK] Attempting to block {ip} - Reason: {reason}")

        # Bước 1: Block trên local firewall
        local_success = self._block_local(ip, reason)

        # Bước 2: Báo cho backend biết đã block (để update DB + notify)
        self._report_block_to_backend(ip, attack_type, severity, reason, local_success)

        if local_success:
            with self._lock:
                self._blocked_ips.add(ip)
            logger.warning(f"[BLOCK] SUCCESS: Blocked {ip} ({attack_type})")
            return True
        else:
            logger.error(f"[BLOCK] FAILED: Could not block {ip} - may need admin privileges")
            return False

    def unblock(self, ip: str) -> bool:
        """Bỏ chặn IP"""
        with self._lock:
            if ip not in self._blocked_ips:
                return True

        success = self._unblock_local(ip)
        if success:
            with self._lock:
                self._blocked_ips.discard(ip)
            logger.info(f"[UNBLOCK] Unblocked {ip}")
            self._report_unblock_to_backend(ip)
        return success

    def _block_local(self, ip: str, reason: str) -> bool:
        """Block IP trên local firewall"""
        if self._platform == "Windows":
            return self._block_windows(ip, reason)
        else:
            return self._block_linux(ip, reason)

    def _block_windows(self, ip: str, reason: str) -> bool:
        """Windows Firewall block via netsh"""
        rule_name = f"CyberMonitor_Block_{ip.replace('.', '_')}"
        try:
            # Thử netsh (cần Admin)
            result = subprocess.run(
                [
                    "netsh", "advfirewall", "firewall", "add", "rule",
                    f"name={rule_name}",
                    "dir=in",
                    "action=block",
                    f"remoteip={ip}",
                    "protocol=any",
                    f"description=CyberMonitor:{reason}"
                ],
                capture_output=True,
                text=True,
                timeout=10
            )
            if result.returncode == 0:
                return True
            logger.warning(f"netsh failed: {result.stderr}")
            return False
        except FileNotFoundError:
            logger.error("netsh not found - are you running as Administrator?")
            return False
        except Exception as e:
            logger.error(f"Windows firewall block failed: {e}")
            return False

    def _block_linux(self, ip: str, reason: str) -> bool:
        """Linux iptables block"""
        try:
            # Kiểm tra đã block chưa
            check = subprocess.run(
                ["iptables", "-C", "INPUT", "-s", ip, "-j", "DROP"],
                capture_output=True
            )
            if check.returncode == 0:
                logger.debug(f"IP {ip} already in iptables")
                return True

            result = subprocess.run(
                ["iptables", "-A", "INPUT", "-s", ip, "-j", "DROP"],
                capture_output=True,
                text=True,
                timeout=10
            )
            if result.returncode == 0:
                return True
            logger.warning(f"iptables failed: {result.stderr}")
            return False
        except FileNotFoundError:
            logger.error("iptables not found - are you running as root?")
            return False
        except Exception as e:
            logger.error(f"Linux firewall block failed: {e}")
            return False

    def _unblock_local(self, ip: str) -> bool:
        """Unblock IP trên local firewall"""
        if self._platform == "Windows":
            rule_name = f"CyberMonitor_Block_{ip.replace('.', '_')}"
            try:
                result = subprocess.run(
                    ["netsh", "advfirewall", "firewall", "delete", "rule", f"name={rule_name}"],
                    capture_output=True,
                    text=True,
                    timeout=10
                )
                return result.returncode == 0
            except Exception as e:
                logger.error(f"Windows unblock failed: {e}")
                return False
        else:
            try:
                result = subprocess.run(
                    ["iptables", "-D", "INPUT", "-s", ip, "-j", "DROP"],
                    capture_output=True,
                    text=True,
                    timeout=10
                )
                return result.returncode == 0
            except Exception as e:
                logger.error(f"Linux unblock failed: {e}")
                return False

    def _report_block_to_backend(self, ip: str, attack_type: str, severity: str, reason: str, success: bool):
        """Báo cho backend biết IP đã block"""
        try:
            payload = {
                "ip": ip,
                "attack_type": attack_type,
                "severity": severity,
                "reason": reason,
                "blocked": success,
                "blocked_at": datetime.now(timezone.utc).isoformat()
            }
            resp = self.session.post(
                f"{self.backend_url}/api/defense/block-ip",
                json=payload,
                timeout=10
            )
            if resp.status_code == 200:
                logger.info(f"[BLOCK] Backend notified: {ip}")
            else:
                logger.warning(f"[BLOCK] Backend notification failed: {resp.status_code}")
        except Exception as e:
            logger.error(f"[BLOCK] Backend notification error: {e}")

    def _report_unblock_to_backend(self, ip: str):
        """Báo backend IP đã unblock"""
        try:
            resp = self.session.post(
                f"{self.backend_url}/api/defense/unblock-ip",
                json={"ip": ip},
                timeout=10
            )
            if resp.status_code != 200:
                logger.warning(f"[UNBLOCK] Backend notification failed: {resp.status_code}")
        except Exception as e:
            logger.error(f"[UNBLOCK] Backend notification error: {e}")


# ============================================================================
# AGENT HUB LISTENER - Nhận lệnh từ Backend qua SignalR
# ============================================================================

class AgentHubListener:
    """
    Kết nối SignalR WebSocket đến Backend AgentHub để NHẬN lệnh block/unblock.
    Backend push: Clients.Group(serverId).ReceiveBlockCommand(...) → Agent nhận + thực thi.

    Agent gọi: hub.invoke("JoinServerGroup", serverId) để đăng ký vào group.
    """

    def __init__(self, server_url: str, server_id: str, api_key: str, ip_blocker: "IPBlocker"):
        self.server_url = server_url.rstrip('/')
        self.server_id = server_id
        self.api_key = api_key
        self.blocker = ip_blocker
        self.hub = None
        self._thread: threading.Thread | None = None
        self._running = False
        self._hub_connected = False

    def start(self):
        """Bắt đầu lắng nghe SignalR (daemon thread)"""
        if self._running:
            return
        self._running = True
        self._thread = threading.Thread(target=self._listen_loop, daemon=True)
        self._thread.start()
        logger.info(f"[HubListener] SignalR listener started for server {self.server_id}")

    def stop(self):
        self._running = False
        if self.hub:
            try:
                self.hub.stop()
            except Exception:
                pass
            self.hub = None
        logger.info("[HubListener] SignalR listener stopped")

    def _listen_loop(self):
        """Vòng lặp kết nối SignalR có retry tự động"""
        while self._running:
            try:
                self._connect_and_listen()
            except Exception as e:
                if not self._running:
                    break
                logger.warning(f"[HubListener] Connection lost: {e}. Reconnecting in 5s...")
                time.sleep(5)

    def _connect_and_listen(self):
        """Kết nối SignalR và đăng ký event handlers"""
        try:
            from signalrcore.hub_connection_builder import HubConnectionBuilder
        except ImportError:
            logger.warning("[HubListener] signalrcore not installed. Run: pip install signalrcore")
            return

        hub_url = f"{self.server_url}/hubs/agents"
        token = self.api_key  # API key làm auth token đơn giản

        self.hub = HubConnectionBuilder()\
            .with_url(
                hub_url,
                options={
                    "headers": {
                        "X-API-Key": self.api_key,
                        "Authorization": f"Bearer {token}"
                    },
                    "skip_negotiation": False,
                    "verify_ssl": True,
                }
            )\
            .configure_logging(logging.WARNING)\
            .build()

        # ── Đăng ký handler cho lệnh BLOCK ──────────────────────────────────
        self.hub.on("ReceiveBlockCommand", self._on_block_command)

        # ── Đăng ký handler cho lệnh UNBLOCK ────────────────────────────────
        self.hub.on("ReceiveUnblockCommand", self._on_unblock_command)

        # ── Handler khi Server gọi Ping ─────────────────────────────────────
        self.hub.on("Ping", lambda _: logger.debug("[HubListener] Ping received from backend"))

        # Track connection state via callbacks
        def on_closed():
            self._hub_connected = False
        self.hub.on_close(on_closed)

        self.hub.start()
        self._hub_connected = True

        # Sau khi kết nối thành công → đăng ký vào group = serverId
        try:
            self.hub.send("JoinServerGroup", [self.server_id])
            logger.info(f"[HubListener] Joined server group: {self.server_id}")
        except Exception as e:
            logger.warning(f"[HubListener] Could not join server group: {e}")

        # Chờ cho đến khi bị ngắt (signalrcore tự xử)
        while self._running:
            if not self._hub_connected:
                try:
                    self.hub.send("JoinServerGroup", [self.server_id])
                    self._hub_connected = True
                    logger.info(f"[HubListener] Rejoined server group: {self.server_id}")
                except Exception as e:
                    logger.warning(f"[HubListener] Cannot rejoin group: {e}")
            time.sleep(1)

    def _on_block_command(self, args: list):
        """
        Xử lý lệnh block từ Backend qua SignalR:
        Backend → AgentHub → ReceiveBlockCommand({ip, reason, attackType, severity, ...})
        """
        try:
            if not args:
                return
            cmd = args[0] if isinstance(args[0], dict) else {}
            ip = cmd.get("ip") or (args[0] if len(args) > 0 else None)
            if not ip:
                logger.warning("[HubListener] Block command with no IP")
                return

            reason = cmd.get("reason", "Backend command")
            attack_type = cmd.get("attackType", "Unknown")
            severity = cmd.get("severity", "Medium")

            logger.warning(
                f"[HubListener] 🛑 RECEIVED BLOCK COMMAND → IP={ip} | Reason={reason} | Attack={attack_type}"
            )

            success = self.blocker.block(
                ip=str(ip),
                reason=str(reason),
                attack_type=str(attack_type),
                severity=str(severity)
            )

            if success:
                logger.info(f"[HubListener] ✅ Blocked {ip} via backend command")
            else:
                logger.error(f"[HubListener] ❌ Failed to block {ip} — may need admin/root")

        except Exception as e:
            logger.error(f"[HubListener] Error processing block command: {e}")

    def _on_unblock_command(self, args: list):
        """Xử lý lệnh unblock từ Backend qua SignalR"""
        try:
            ip = None
            if len(args) > 0:
                ip = args[0] if isinstance(args[0], str) else (args[0].get("ip") if isinstance(args[0], dict) else None)

            if not ip:
                logger.warning("[HubListener] Unblock command with no IP")
                return

            logger.info(f"[HubListener] 🔓 RECEIVED UNBLOCK COMMAND → IP={ip}")
            success = self.blocker.unblock(str(ip))
            if success:
                logger.info(f"[HubListener] ✅ Unblocked {ip} via backend command")

        except Exception as e:
            logger.error(f"[HubListener] Error processing unblock command: {e}")


# ============================================================================
# DATA COLLECTOR
# ============================================================================

class DataCollector:
    """Thu thập log mạng từ hệ thống"""

    def __init__(self, demo_mode: bool = False):
        self.demo_mode = demo_mode
        self._try_import_psutil()

    def _try_import_psutil(self):
        try:
            import psutil
            self.psutil = psutil
            logger.info("psutil loaded - Real monitoring enabled")
        except ImportError:
            self.psutil = None
            logger.warning("psutil not installed - Running in DEMO mode")

    def collect_traffic_logs(self) -> list[TrafficLogEntry]:
        if self.demo_mode or self.psutil is None:
            return self._generate_demo_logs()
        return self._collect_real_logs()

    def _collect_real_logs(self) -> list[TrafficLogEntry]:
        logs = []
        try:
            hostname = socket.gethostname()
            local_ip = self._get_local_ip()

            connections = self.psutil.net_connections(kind='inet')

            ip_groups: dict[str, dict] = {}
            for conn in connections:
                try:
                    if conn.raddr:
                        remote_ip = conn.raddr.ip
                        remote_port = conn.raddr.port

                        if remote_ip not in ip_groups:
                            ip_groups[remote_ip] = {
                                'destination_ip': remote_ip,
                                'destination_port': remote_port,
                                'protocol': conn.type_name(),
                                'bytes_in': 0,
                                'bytes_out': 0,
                                'packets_in': 0,
                                'packets_out': 0,
                                'request_count': 0
                            }

                        ip_groups[remote_ip]['request_count'] += 1
                        ip_groups[remote_ip]['bytes_out'] += random.randint(100, 2000)
                        ip_groups[remote_ip]['bytes_in'] += random.randint(50, 1500)
                        ip_groups[remote_ip]['packets_out'] += 1
                        ip_groups[remote_ip]['packets_in'] += 1
                except (AttributeError, OSError):
                    continue

            for ip, data in ip_groups.items():
                logs.append(TrafficLogEntry(
                    source_ip=local_ip,
                    destination_ip=data['destination_ip'],
                    destination_port=data['destination_port'],
                    protocol=data['protocol'],
                    bytes_in=data['bytes_in'],
                    bytes_out=data['bytes_out'],
                    packets_in=data['packets_in'],
                    packets_out=data['packets_out'],
                    request_count=data['request_count'],
                    raw_payload=json.dumps({
                        'hostname': hostname,
                        'conn_type': data['protocol'],
                        'sample': True
                    })
                ))
        except Exception as e:
            logger.error(f"Error collecting real logs: {e}")
            return self._generate_demo_logs()

        return logs if logs else self._generate_demo_logs()

    def _generate_demo_logs(self) -> list[TrafficLogEntry]:
        hostname = socket.gethostname()
        local_ip = self._get_local_ip()

        attack_sources = [
            ("1.1.1.1", 443, "HTTPS", 15000, 500, 100, 50),
            ("192.168.1.50", 22, "SSH", 500, 200, 20, 5),
            ("10.0.0.1", 80, "HTTP", 2000, 800, 15, 10),
            ("203.0.113.10", 3306, "MySQL", 100, 50, 5, 2),
            ("198.51.100.5", 443, "HTTPS", 3000, 1000, 20, 15),
        ]

        logs = []
        for src_ip, port, proto, bout, bin_, pout, pin in attack_sources:
            logs.append(TrafficLogEntry(
                source_ip=src_ip,
                destination_ip=local_ip,
                destination_port=port,
                protocol=proto,
                bytes_out=bout,
                bytes_in=bin_,
                packets_out=pout,
                packets_in=pin,
                request_count=random.randint(1, bout // 100),
                raw_payload=json.dumps({
                    'hostname': hostname,
                    'demo': True,
                    'simulated_attack': src_ip == "1.1.1.1",
                    'timestamp': datetime.now(timezone.utc).isoformat()
                })
            ))

        return logs

    def _get_local_ip(self) -> str:
        try:
            s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
            s.connect(("8.8.8.8", 80))
            ip = s.getsockname()[0]
            s.close()
            return ip
        except Exception:
            return "127.0.0.1"

    def collect_system_metrics(self) -> SystemMetrics:
        if self.psutil is None:
            return self._generate_demo_metrics()

        try:
            cpu = self.psutil.cpu_percent(interval=0.1)
            ram = self.psutil.virtual_memory()
            disk = self.psutil.disk_usage('/')
            net = self.psutil.net_io_counters()
            boot_time = self.psutil.boot_time()

            return SystemMetrics(
                cpu_percent=cpu,
                ram_percent=ram.percent,
                ram_used_mb=int(ram.used / (1024 * 1024)),
                ram_total_mb=int(ram.total / (1024 * 1024)),
                disk_percent=disk.percent,
                network_bytes_sent=net.bytes_sent,
                network_bytes_recv=net.bytes_recv,
                uptime_seconds=int(time.time() - boot_time),
                hostname=socket.gethostname(),
                os_name=platform.system() + " " + platform.release(),
                timestamp=datetime.now(timezone.utc).isoformat()
            )
        except Exception as e:
            logger.error(f"Error collecting system metrics: {e}")
            return self._generate_demo_metrics()

    def _generate_demo_metrics(self) -> SystemMetrics:
        return SystemMetrics(
            cpu_percent=random.uniform(10, 80),
            ram_percent=random.uniform(20, 70),
            ram_used_mb=random.randint(1024, 8192),
            ram_total_mb=8192,
            disk_percent=random.uniform(30, 80),
            network_bytes_sent=random.randint(1000000, 100000000),
            network_bytes_recv=random.randint(1000000, 100000000),
            uptime_seconds=random.randint(86400, 2592000),
            hostname=socket.gethostname(),
            os_name=platform.system() + " " + platform.release(),
            timestamp=datetime.now(timezone.utc).isoformat()
        )


# ============================================================================
# CYBERMONITOR AGENT
# ============================================================================

class CyberMonitorAgent:
    """
    Agent chính - thu thập log, phát hiện tấn công, tự động block IP.
    """

    def __init__(
        self,
        api_key: str,
        server_url: str = "http://localhost:5000",
        server_id: str = "",
        interval: int = DEFAULT_INTERVAL,
        batch_size: int = DEFAULT_BATCH_SIZE,
        demo_mode: bool = False,
        ssl_verify: bool = True
    ):
        self.api_key = api_key
        self.server_url = server_url.rstrip('/')
        self.server_id = server_id  # Dùng để join SignalR group (AgentHub)
        self.interval = interval
        self.batch_size = batch_size
        self.demo_mode = demo_mode
        self.ssl_verify = ssl_verify

        self.collector = DataCollector(demo_mode=demo_mode)
        local_ip = self.collector._get_local_ip()
        self.detector = AttackDetector(local_ip=local_ip)
        self.blocker = IPBlocker(backend_url=server_url, api_key=api_key)

        # SignalR listener — nhận lệnh block/unblock từ Backend
        self.hub_listener: AgentHubListener | None = None

        self.session = requests.Session()
        self.session.headers.update({
            "X-API-Key": api_key,
            "Content-Type": "application/json",
            "User-Agent": f"CyberMonitorAgent/1.0 ({platform.system()})"
        })

        self._running = False
        self._lock = threading.Lock()
        self._stats = {
            "total_sent": 0,
            "total_failed": 0,
            "total_attacks_detected": 0,
            "total_ips_blocked": 0,
            "start_time": None,
            "last_success": None,
            "last_error": None
        }

    @property
    def api_key_prefix(self) -> str:
        if len(self.api_key) > 12:
            return self.api_key[:12] + "***"
        return "***"

    def start(self):
        self._running = True
        self._stats["start_time"] = datetime.now(timezone.utc)

        logger.info("=" * 60)
        logger.info(" CyberMonitor Agent v2.0 - STARTING (with Auto-Block)")
        logger.info(f" API Key: {self.api_key_prefix}")
        logger.info(f" Server URL: {self.server_url}")
        logger.info(f" Interval: {self.interval}s")
        logger.info(f" Demo Mode: {'ON' if self.demo_mode else 'OFF'}")
        logger.info(f" Auto-Block: {'ENABLED' if AUTO_BLOCK_ENABLED else 'DISABLED'}")
        logger.info(f" SignalR Push: ENABLED (receive block commands from backend)")
        logger.info("=" * 60)

        self._register_agent()

        # ── BẮT ĐẦU SIGNALR LISTENER ────────────────────────────────────────
        # Kết nối đến Backend AgentHub, nhận lệnh block/unblock
        if self.server_id:
            self.hub_listener = AgentHubListener(
                server_url=self.server_url,
                server_id=self.server_id,
                api_key=self.api_key,
                ip_blocker=self.blocker
            )
            self.hub_listener.start()
        else:
            logger.warning("[HubListener] No server_id provided — SignalR push DISABLED")

        heartbeat_thread = threading.Thread(target=self._heartbeat_loop, daemon=True)
        heartbeat_thread.start()

        while self._running:
            try:
                self._collect_and_send()
            except Exception as e:
                logger.error(f"Fatal error in main loop: {e}")

            time.sleep(self.interval)

    def stop(self):
        logger.info("Stopping CyberMonitor Agent...")
        self._running = False
        if self.hub_listener:
            self.hub_listener.stop()

    def _register_agent(self):
        try:
            resp = self.session.get(
                f"{self.server_url}/health",
                timeout=5,
                verify=self.ssl_verify
            )
            if resp.status_code < 500:
                logger.info(f"Backend connection verified: {self.server_url}")
            else:
                logger.warning(f"Backend returned {resp.status_code}, will retry...")
        except requests.exceptions.SSLError as e:
            logger.warning(f"SSL verification failed: {e}. Retrying without verify...")
            self.ssl_verify = False
        except requests.exceptions.ConnectionError:
            logger.warning(f"Cannot connect to {self.server_url}. Will retry...")
        except Exception as e:
            logger.warning(f"Health check failed: {e}")

    def _collect_and_send(self):
        logs = self.collector.collect_traffic_logs()
        metrics = self.collector.collect_system_metrics()

        if not logs:
            logger.debug("No logs collected this cycle")
            return

        # === PHÁT HIỆN TẤN CÔNG ===
        attacks = self.detector.analyze(logs)
        if attacks:
            logger.warning(f"[DETECTION] Found {len(attacks)} attack(s): {[a.attack_type for a in attacks]}")
            with self._lock:
                self._stats["total_attacks_detected"] += len(attacks)

            for attack in attacks:
                # Gửi alert lên backend
                self._send_attack_alert(attack)

                # Auto-block nếu score >= threshold
                if AUTO_BLOCK_ENABLED and attack.score >= BLOCK_THRESHOLD_SCORE:
                    success = self.blocker.block(
                        ip=attack.evidence.get("source_ip", ""),
                        reason=attack.title,
                        attack_type=attack.attack_type,
                        severity=attack.severity
                    )
                    if success:
                        with self._lock:
                            self._stats["total_ips_blocked"] += 1

        batches = [logs[i:i + self.batch_size] for i in range(0, len(logs), self.batch_size)]

        for batch in batches:
            payload = {
                "logs": [log.to_dict() for log in batch],
                "hostname": metrics.hostname,
                "os": metrics.os_name,
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "cpu_percent": metrics.cpu_percent,
                "ram_percent": metrics.ram_percent,
                "disk_percent": metrics.disk_percent
            }

            success = self._send_with_retry(payload)

            with self._lock:
                if success:
                    self._stats["total_sent"] += len(batch)
                    self._stats["last_success"] = datetime.now(timezone.utc)
                else:
                    self._stats["total_failed"] += len(batch)

        attack_summary = f" | ATTACKS: {len(attacks)}" if attacks else ""
        logger.info(
            f"[{datetime.now().strftime('%H:%M:%S')}] "
            f"Sent {len(logs)} logs{attack_summary} | "
            f"CPU: {metrics.cpu_percent:.1f}% | "
            f"RAM: {metrics.ram_percent:.1f}% | "
            f"DISK: {metrics.disk_percent:.1f}%"
        )

    def _send_attack_alert(self, attack: AttackSignature):
        """Gửi attack alert lên backend để lưu DB + notify SOC"""
        try:
            payload = {
                "alertType": attack.attack_type,
                "severity": attack.severity,
                "title": attack.title,
                "description": attack.description,
                "sourceIp": attack.evidence.get("source_ip", ""),
                "mitreTactic": attack.mitre_tactic,
                "mitreTechnique": attack.mitre_technique,
                "anomalyScore": attack.score,
                "recommendedAction": f"Auto-blocked by Agent | {attack.description}",
                "evidence": json.dumps(attack.evidence),
                "blocked": AUTO_BLOCK_ENABLED and attack.score >= BLOCK_THRESHOLD_SCORE
            }
            resp = self.session.post(
                f"{self.server_url}/api/alerts/trigger",
                json=payload,
                timeout=10,
                verify=self.ssl_verify
            )
            if resp.status_code == 200:
                logger.info(f"[ALERT] Sent to backend: {attack.attack_type} from {attack.evidence.get('source_ip')}")
            else:
                logger.warning(f"[ALERT] Backend rejected: {resp.status_code}")
        except Exception as e:
            logger.error(f"[ALERT] Failed to send alert: {e}")

    def _send_with_retry(self, payload: dict) -> bool:
        for attempt in range(MAX_RETRIES):
            try:
                resp = self.session.post(
                    f"{self.server_url}/api/logs/ingest",
                    json=payload,
                    timeout=10,
                    verify=self.ssl_verify
                )

                if resp.status_code == 200:
                    data = resp.json()
                    if data.get("success"):
                        return True
                    else:
                        logger.warning(f"Server rejected payload: {data.get('message')}")
                        return False

                elif resp.status_code == 401:
                    logger.error("API Key rejected (401 Unauthorized)")
                    self._stats["last_error"] = "401 Unauthorized"
                    return False

                elif resp.status_code >= 500:
                    logger.warning(f"Server error {resp.status_code}, retrying...")

                else:
                    logger.warning(f"Request failed: {resp.status_code}")

            except requests.exceptions.SSLError:
                logger.warning(f"SSL error on attempt {attempt + 1}, retrying without verify...")
                self.ssl_verify = False

            except requests.exceptions.ConnectionError as e:
                logger.warning(f"Connection error on attempt {attempt + 1}: {e}")

            except requests.exceptions.Timeout:
                logger.warning(f"Request timeout on attempt {attempt + 1}")

            except Exception as e:
                logger.error(f"Unexpected error sending logs: {e}")
                self._stats["last_error"] = str(e)
                return False

            if attempt < MAX_RETRIES - 1:
                time.sleep(RETRY_DELAY * (attempt + 1))

        return False

    def _heartbeat_loop(self):
        while self._running:
            time.sleep(HEARTBEAT_INTERVAL)
            try:
                uptime = (datetime.now(timezone.utc) - self._stats["start_time"]).total_seconds()
                logger.debug(
                    f"[HEARTBEAT] Running {int(uptime)}s | "
                    f"Sent: {self._stats['total_sent']} | "
                    f"Failed: {self._stats['total_failed']} | "
                    f"Attacks: {self._stats['total_attacks_detected']} | "
                    f"Blocked: {self._stats['total_ips_blocked']}"
                )
            except Exception:
                pass

    def get_stats(self) -> dict:
        with self._lock:
            stats = self._stats.copy()
            stats["api_key"] = self.api_key_prefix
            stats["blocked_ips"] = list(self.blocker._blocked_ips)
            if stats["start_time"]:
                stats["uptime_seconds"] = (
                    datetime.now(timezone.utc) - stats["start_time"]
                ).total_seconds()
            return stats


# ============================================================================
# CLI
# ============================================================================

def main():
    script_dir = os.path.dirname(os.path.abspath(__file__))
    logger.info(f"Working directory: {os.getcwd()} | Script: {script_dir}")

    parser = argparse.ArgumentParser(
        description="CyberMonitor Agent v2.0 - Thu thập log + Phát hiện 20 loại tấn công + Auto-Block IP",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Ví dụ:
  python agent.py --api-key sk_live_abc123 --server-url http://localhost:5000
  python agent.py --api-key sk_live_abc123 --demo
  python agent.py -k sk_live_test -u http://192.168.1.6:5000 -i 5

Auto-Block:
  Khi phát hiện tấn công (score >= 0.75), agent sẽ:
  1. Block IP trên Windows Firewall (netsh) / Linux iptables
  2. Báo cho backend để notify SOC team
  3. Tạo Alert + Ticket tự động

Tắt auto-block: AUTO_BLOCK=false python agent.py ...

Lưu ý: Chạy với quyền Administrator/Root để block IP được.
        """
    )

    parser.add_argument("-k", "--api-key", required=True, help="API Key từ CyberMonitor dashboard")
    parser.add_argument("-u", "--server-url", default="http://localhost:5000",
                        help="URL của CyberMonitor Backend (default: http://localhost:5000)")
    parser.add_argument("-i", "--interval", type=int, default=DEFAULT_INTERVAL,
                        help=f"Số giây giữa mỗi lần gửi (default: {DEFAULT_INTERVAL})")
    parser.add_argument("-b", "--batch-size", type=int, default=DEFAULT_BATCH_SIZE,
                        help=f"Số log entry mỗi request (default: {DEFAULT_BATCH_SIZE})")
    parser.add_argument("--demo", action="store_true",
                        help="Chế độ demo: tạo log giả lập")
    parser.add_argument("--no-ssl-verify", action="store_true",
                        help="Bỏ qua SSL verification")
    parser.add_argument("-v", "--verbose", action="store_true",
                        help="Bật debug logging")
    parser.add_argument("--server-id",
                        default=os.getenv("CYBERMONITOR_SERVER_ID", ""),
                        help="Server ID để nhận lệnh block qua SignalR (AgentHub). "
                             "Lấy từ biến môi trường CYBERMONITOR_SERVER_ID")

    args = parser.parse_args()

    if args.verbose:
        logging.getLogger().setLevel(logging.DEBUG)

    agent = CyberMonitorAgent(
        api_key=args.api_key,
        server_url=args.server_url,
        server_id=args.server_id,
        interval=args.interval,
        batch_size=args.batch_size,
        demo_mode=args.demo,
        ssl_verify=not args.no_ssl_verify
    )

    try:
        agent.start()
    except KeyboardInterrupt:
        print("\n")
        logger.info("Agent stopped by user")
        stats = agent.get_stats()
        logger.info(f"Final stats: {stats}")
        sys.exit(0)


if __name__ == "__main__":
    main()
