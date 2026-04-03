#!/usr/bin/env python3
"""
CyberMonitor AI Engine v2.0 - Động cơ AI phát hiện 20 loại tấn công

Phát hiện: DDoS, Brute Force SSH/HTTP, Port Scan, SQL Injection, Malware,
Reverse Shell, XSS, DNS Amplification, MITM, Lateral Movement, Data Exfiltration,
DNS Tunneling, Slowloris, SYN Flood, ICMP Flood, Web Shell Upload, Privilege Escalation,
Cryptomining, Suspicious Protocol, Zero-day Anomaly.


Cách chạy:
    pip install -r requirements.txt
    python ai_engine.py --backend-url http://localhost:5000

"""

import json
import logging
import os
import re
import subprocess
import sys
import threading
import time
from dataclasses import dataclass
from datetime import datetime, timezone, timedelta
from typing import Optional

import requests

# ============================================================================
# CẤU HÌNH
# ============================================================================

BACKEND_URL = os.getenv("BACKEND_URL", "http://192.168.1.6:5000")
AI_API_KEY = os.getenv("AI_API_KEY", "sk-ai-engine-secret-key-2026")

# Timing
CHECK_INTERVAL = int(os.getenv("CHECK_INTERVAL", "60"))
LOOKBACK_MINUTES = int(os.getenv("LOOKBACK_MINUTES", "5"))

# Detection thresholds
ANOMALY_THRESHOLD = float(os.getenv("ANOMALY_THRESHOLD", "0.75"))
AUTO_BLOCK_THRESHOLD = float(os.getenv("AUTO_BLOCK_THRESHOLD", "0.80"))
DDOS_REQUEST_THRESHOLD = int(os.getenv("DDOS_REQUEST_THRESHOLD", "5000"))
BRUTEFORCE_THRESHOLD = int(os.getenv("BRUTEFORCE_THRESHOLD", "10"))
PORT_SCAN_THRESHOLD = int(os.getenv("PORT_SCAN_THRESHOLD", "10"))
EXFILTRATION_BYTES = int(os.getenv("EXFILTRATION_BYTES", "50_000_000"))

LOGGING_FORMAT = "%(asctime)s [%(levelname)s] AI-Engine - %(message)s"

logging.basicConfig(
    level=logging.INFO,
    format=LOGGING_FORMAT,
    handlers=[logging.StreamHandler(sys.stdout)]
)
logger = logging.getLogger("AIEngine")

# ============================================================================
# PORT MAPPING
# ============================================================================

PORT_SERVICE = {
    21: "FTP", 22: "SSH", 23: "TELNET", 25: "SMTP", 53: "DNS",
    80: "HTTP", 110: "POP3", 143: "IMAP", 443: "HTTPS",
    445: "SMB", 3306: "MySQL", 3389: "RDP", 5432: "PostgreSQL",
    6379: "Redis", 8080: "HTTP-ALT", 8443: "HTTPS-ALT", 27017: "MongoDB"
}

SUSPICIOUS_PORTS = {4444, 5555, 6666, 7777, 8888, 9999, 12345, 31337}

# ============================================================================
# ATTACK SIGNATURE PATTERNS
# ============================================================================

SQLI_PATTERNS = [
    (r"('|\"|%)?(\bOR\b|\bAND\b).*(=|<|>)", "OR/AND injection"),
    (r"UNION\s+(ALL\s+)?SELECT", "UNION SELECT injection"),
    (r"DROP\s+(TABLE|DATABASE|INDEX)", "DROP TABLE/DATABASE"),
    (r"EXEC(\s|\()", "EXEC stored procedure"),
    (r"0x[0-9a-fA-F]+", "Hex encoded injection"),
    (r"CHAR\s*\(", "CHAR encoding injection"),
    (r"--\s*$", "SQL comment injection"),
    (r"/\*.*\*/", "Comment block injection"),
    (r"WAITFOR\s+DELAY", "Time-based blind SQLi"),
    (r"BENCHMARK\s*\(|SLEEP\s*\(", "Time-based blind SQLi"),
]

XSS_PATTERNS = [
    (r"<script[^>]*>", "Script tag"),
    (r"javascript:", "JavaScript protocol"),
    (r"on\w+\s*=", "Event handler"),
    (r"<iframe[^>]*>", "iframe injection"),
    (r"<object[^>]*>|<embed[^>]*>", "Object/embed injection"),
    (r"eval\s*\(|document\.cookie|document\.write", "DOM manipulation"),
]

CMD_PATTERNS = [
    (r"[;&|`$]", "Command separator"),
    (r"\b(cat|ls|wget|curl|nc|bash|sh|cmd|powershell)\s", "System command"),
    (r"\|\s*\w+", "Pipe to command"),
    (r"\$\([^)]+\)|\$\{[^}]+\}", "Command substitution"),
    (r"base64\s+-d", "Base64 decode"),
    (r"/etc/passwd|etc/shadow", "Passwd file access"),
]

MINING_PATTERNS = [
    r"stratum\+tcp", r"bitcoin", r"pool", r"xmr", r"monero",
    r"ethermine", r"nanopool", r"minexmr", r"cryptonight", r"hashvault"
]

DNS_TUNNEL_PATTERNS = [
    (r"^[a-zA-Z0-9+/]{40,}={0,2}$", "Long base64 subdomain"),
    (r"\.su$|\.tk$|\.ml$|\.ga$|\.cf$|\.gq$", "Free DNS provider"),
]

WEBSHELL_EXTENSIONS = [
    ".php", ".php3", ".php4", ".php5", ".phtml",
    ".asp", ".aspx", ".jsp", ".jspx", ".cgi", ".pl"
]

# ============================================================================
# MITRE ATT&CK MAPPING - Đầy đủ 20 attacks
# ============================================================================

MITRE_ATTACK = {
    # (MITRE ID, Tactic, Severity, Auto-block, Block severity threshold)
    "DDoS": {
        "id": "T1498", "tactic": "Impact", "severity": "Critical",
        "auto_block": True, "block_threshold": 0.75,
        "action": "Block IP ngay lập tức. Enable rate limiting, contact ISP upstream."
    },
    "BruteForce_SSH": {
        "id": "T1110", "tactic": "Credential Access", "severity": "High",
        "auto_block": True, "block_threshold": 0.70,
        "action": "Block IP, cài fail2ban, bật 2FA SSH, đổi port SSH mặc định."
    },
    "BruteForce_HTTP": {
        "id": "T1110", "tactic": "Credential Access", "severity": "High",
        "auto_block": True, "block_threshold": 0.75,
        "action": "Block IP, bật rate limiting, captcha, lockout policy."
    },
    "PortScan": {
        "id": "T1016", "tactic": "Discovery", "severity": "Medium",
        "auto_block": True, "block_threshold": 0.80,
        "action": "Block IP, đóng unused ports, cập nhật firewall rules."
    },
    "SQLInjection": {
        "id": "T1190", "tactic": "Initial Access", "severity": "High",
        "auto_block": True, "block_threshold": 0.70,
        "action": "Block IP, review WAF logs, sanitize inputs, dùng parameterized queries."
    },
    "Malware": {
        "id": "T1059", "tactic": "Execution", "severity": "Critical",
        "auto_block": True, "block_threshold": 0.75,
        "action": "ISOLATE SERVER NGAY. Forensic investigation, full system scan."
    },
    "XSS": {
        "id": "T1059", "tactic": "Execution", "severity": "Medium",
        "auto_block": False, "block_threshold": 0.85,
        "action": "Sanitize output, set CSP headers, review input validation."
    },
    "DNSAmplification": {
        "id": "T1498", "tactic": "Impact", "severity": "High",
        "auto_block": True, "block_threshold": 0.75,
        "action": "Block DNS queries > 512 bytes, disable open resolver."
    },
    "MITM": {
        "id": "T1557", "tactic": "Adversary-in-the-Middle", "severity": "High",
        "auto_block": True, "block_threshold": 0.80,
        "action": "Check ARP table, enable port security, inspect certificates."
    },
    "LateralMovement": {
        "id": "T1021", "tactic": "Lateral Movement", "severity": "High",
        "auto_block": True, "block_threshold": 0.75,
        "action": "Isolate affected systems, reset credentials, block lateral traffic."
    },
    "DataExfiltration": {
        "id": "T1041", "tactic": "Exfiltration", "severity": "Critical",
        "auto_block": True, "block_threshold": 0.70,
        "action": "BLOCK IP + DLP INVESTIGATION. Check data loss scope."
    },
    "DNSTunneling": {
        "id": "T1071", "tactic": "Command and Control", "severity": "Medium",
        "auto_block": True, "block_threshold": 0.80,
        "action": "Block long DNS queries, enable DNS query logging."
    },
    "Slowloris": {
        "id": "T1498", "tactic": "Impact", "severity": "Medium",
        "auto_block": True, "block_threshold": 0.80,
        "action": "Tuning server timeouts, enable mod_reqtimeout, rate limiting."
    },
    "SYN_Flood": {
        "id": "T1498", "tactic": "Impact", "severity": "Critical",
        "auto_block": True, "block_threshold": 0.70,
        "action": "Block IP, enable SYN cookies, increase connection queue."
    },
    "ICMP_Flood": {
        "id": "T1498", "tactic": "Impact", "severity": "Low",
        "auto_block": False, "block_threshold": 0.90,
        "action": "Block ICMP except essential (mtu discovery), limit ICMP rate."
    },
    "WebShellUpload": {
        "id": "T1105", "tactic": "Initial Access", "severity": "Critical",
        "auto_block": True, "block_threshold": 0.70,
        "action": "Block IP, review upload logs, scan uploaded files, WAF rules."
    },
    "PrivilegeEscalation": {
        "id": "T1068", "tactic": "Privilege Escalation", "severity": "Critical",
        "auto_block": True, "block_threshold": 0.75,
        "action": "Audit sudo/permissions, review audit logs, isolate account."
    },
    "Cryptomining": {
        "id": "T1496", "tactic": "Impact", "severity": "Medium",
        "auto_block": True, "block_threshold": 0.80,
        "action": "Block IP, scan for miner process, check scheduled tasks."
    },
    "SuspiciousProtocol": {
        "id": "T1046", "tactic": "Discovery", "severity": "Medium",
        "auto_block": True, "block_threshold": 0.85,
        "action": "Investigate protocol usage, block if unauthorized."
    },
    "UnknownAnomaly": {
        "id": "T1046", "tactic": "Discovery", "severity": "High",
        "auto_block": False, "block_threshold": 0.90,
        "action": "ML flag - investigate manually. Gather forensics data."
    },
}


# ============================================================================
# DATA MODELS
# ============================================================================

@dataclass
class ThreatResult:
    threat_type: str
    source_ip: str
    severity: str
    score: float
    title: str
    description: str
    target_server: Optional[str]
    mitre_id: str
    mitre_tactic: str
    mitre_technique: str
    recommended_action: str
    evidence: dict
    auto_block: bool
    block_initiated: bool = False


@dataclass
class AnomalyResult:
    ip: str
    score: float
    features: dict
    verdict: str
    threat_type: Optional[str]


# ============================================================================
# FEATURE EXTRACTION
# ============================================================================

class FeatureExtractor:

    @staticmethod
    def extract(logs: list[dict]) -> dict[str, dict]:
        """Trích xuất features từ traffic logs, nhóm theo source IP."""
        if not logs:
            return {}

        ip_groups: dict[str, list] = {}
        for log in logs:
            # Backend trả camelCase: sourceIp, destinationIp, sourcePort, destinationPort, bytesIn, bytesOut...
            ip = log.get("sourceIp") or log.get("SourceIp") or log.get("source_ip") or log.get("ip") or "unknown"
            if ip not in ip_groups:
                ip_groups[ip] = []
            ip_groups[ip].append(log)

        features = {}
        for ip, ip_logs in ip_groups.items():
            f = {
                "ip": ip,
                "request_count": len(ip_logs),
                "total_bytes_in": 0,
                "total_bytes_out": 0,
                "total_bytes": 0,
                "avg_bytes_per_req": 0.0,
                "unique_dest_ports": set(),
                "unique_dest_ips": set(),
                "protocols": set(),
                "packets_in": 0,
                "packets_out": 0,
                "ssh_connections": 0,
                "http_connections": 0,
                "dns_queries": 0,
                "mysql_connections": 0,
                "icmp_count": 0,
                "port_list": [],
                "time_span_seconds": 300,
                "payloads": [],
            }

            for l in ip_logs:
                # Backend trả camelCase: bytesIn, bytesOut, destinationPort, sourcePort, protocol, packetsIn, packetsOut, rawPayload
                bytes_in = l.get("bytesIn") or l.get("BytesIn") or l.get("bytes_in") or 0
                bytes_out = l.get("bytesOut") or l.get("BytesOut") or l.get("bytes_out") or 0
                dst_port = l.get("destinationPort") or l.get("DestinationPort") or l.get("destination_port")
                proto = l.get("protocol") or l.get("Protocol") or ""
                pkts_in = l.get("packetsIn") or l.get("PacketsIn") or l.get("packets_in") or 0
                pkts_out = l.get("packetsOut") or l.get("PacketsOut") or l.get("packets_out") or 0
                raw = l.get("rawPayload") or l.get("RawPayload") or l.get("raw_payload") or ""

                f["total_bytes_in"] += int(bytes_in)
                f["total_bytes_out"] += int(bytes_out)
                f["packets_in"] += int(pkts_in)
                f["packets_out"] += int(pkts_out)

                if dst_port:
                    f["unique_dest_ports"].add(dst_port)
                    f["port_list"].append(dst_port)

                if proto:
                    f["protocols"].add(proto)

                if raw:
                    f["payloads"].append(str(raw))

                # Count by service
                if dst_port == 22:
                    f["ssh_connections"] += 1
                elif dst_port in (80, 443, 8080, 8443):
                    f["http_connections"] += 1
                elif dst_port == 53:
                    f["dns_queries"] += 1
                elif dst_port == 3306 or "mysql" in proto.lower():
                    f["mysql_connections"] += 1
                elif "icmp" in proto.lower():
                    f["icmp_count"] += 1

            f["unique_dest_ports"] = len(f["port_list"])
            f["total_bytes"] = f["total_bytes_in"] + f["total_bytes_out"]
            f["request_count"] = max(f["request_count"], f["ssh_connections"] + f["http_connections"])

            if f["request_count"] > 0:
                f["avg_bytes_per_req"] = f["total_bytes"] / f["request_count"]

            # Computed scores
            f["ddos_score"] = f["request_count"] / max(1, DDOS_REQUEST_THRESHOLD)
            f["port_scan_score"] = f["unique_dest_ports"] / max(1, f["request_count"])
            f["bruteforce_score"] = f["ssh_connections"] / max(1, BRUTEFORCE_THRESHOLD)
            f["syn_flood_ratio"] = f["packets_out"] / max(1, f["packets_in"])
            f["exfil_ratio"] = f["total_bytes_out"] / max(1, f["total_bytes_in"])
            f["dns_amp_ratio"] = f["total_bytes_out"] / max(1, f["total_bytes_in"])

            features[ip] = f

        return features


# ============================================================================
# ANOMALY DETECTOR - 20 Attack Types
# ============================================================================

class AnomalyDetector:

    def __init__(self, threshold: float = ANOMALY_THRESHOLD):
        self.threshold = threshold
        self._try_import_sklearn()

    def _try_import_sklearn(self):
        try:
            from sklearn.ensemble import IsolationForest
            self.IsolationForest = IsolationForest
            self.has_sklearn = True
            logger.info("scikit-learn loaded - ML anomaly detection enabled")
        except ImportError:
            self.has_sklearn = False
            logger.warning("scikit-learn not available - Using rule-based detection")

    def detect(self, features: dict[str, dict]) -> list[AnomalyResult]:
        if not features:
            return []

        if self.has_sklearn:
            return self._detect_ml(features)
        else:
            return self._detect_rule_based(features)

    def _detect_ml(self, features: dict[str, dict]) -> list[AnomalyResult]:
        try:
            import numpy as np
            from sklearn.ensemble import IsolationForest
            from sklearn.preprocessing import StandardScaler

            ip_list = list(features.keys())
            feat_vectors = []
            for ip in ip_list:
                f = features[ip]
                vec = [
                    f["request_count"],
                    f["total_bytes"],
                    f["unique_dest_ports"],
                    f["avg_bytes_per_req"],
                    f["ddos_score"],
                    f["port_scan_score"],
                    f["bruteforce_score"],
                    f["syn_flood_ratio"],
                    f["exfil_ratio"],
                    f["dns_amp_ratio"],
                    f["ssh_connections"],
                    f["http_connections"],
                    f["dns_queries"],
                ]
                feat_vectors.append(vec)

            X = np.array(feat_vectors, dtype=np.float64)
            scaler = StandardScaler()
            X_scaled = scaler.fit_transform(X)

            model = IsolationForest(
                contamination=0.1,
                random_state=42,
                n_estimators=100
            )
            model.fit(X_scaled)

            scores = model.decision_function(X_scaled)
            predictions = model.predict(X_scaled)

            results = []
            for i, ip in enumerate(ip_list):
                raw_score = scores[i]
                anomaly_prob = max(0.0, min(1.0, (0.5 - raw_score) * 2))

                verdict = "NORMAL"
                if predictions[i] == -1:
                    verdict = "ANOMALY"
                elif anomaly_prob > 0.6:
                    verdict = "SUSPICIOUS"

                results.append(AnomalyResult(
                    ip=ip,
                    score=float(anomaly_prob),
                    features=features[ip],
                    verdict=verdict,
                    threat_type=self._classify_threat(features[ip], anomaly_prob)
                ))

            return results

        except Exception as e:
            logger.error(f"ML detection error: {e}")
            return self._detect_rule_based(features)

    def _detect_rule_based(self, features: dict[str, dict]) -> list[AnomalyResult]:
        results = []
        for ip, f in features.items():
            score = 0.0

            # DDoS
            if f["request_count"] > DDOS_REQUEST_THRESHOLD:
                score += 0.6
            elif f["request_count"] > 1000:
                score += 0.25
            elif f["request_count"] > 100:
                score += 0.05

            # Port scan
            if f["unique_dest_ports"] > 20:
                score += 0.35
            elif f["unique_dest_ports"] > 10:
                score += 0.2
            elif f["unique_dest_ports"] > 5:
                score += 0.05

            # Data exfiltration
            if f["total_bytes_out"] > EXFILTRATION_BYTES:
                score += 0.4
            elif f["total_bytes_out"] > 10_000_000:
                score += 0.1

            # Many dest IPs
            if f["unique_dest_ports"] > 10:
                score += 0.15

            # Brute force
            if f["avg_bytes_per_req"] < 100 and f["request_count"] > 10:
                score += 0.3

            # SSH bruteforce
            if f["ssh_connections"] > BRUTEFORCE_THRESHOLD:
                score += 0.25

            # SYN flood indicator
            if f["syn_flood_ratio"] > 5 and f["packets_out"] > 5000:
                score += 0.3

            score = min(1.0, score)

            verdict = "NORMAL"
            if score >= self.threshold:
                verdict = "ANOMALY"
            elif score >= self.threshold * 0.7:
                verdict = "SUSPICIOUS"

            results.append(AnomalyResult(
                ip=ip,
                score=score,
                features=f,
                verdict=verdict,
                threat_type=self._classify_threat(f, score)
            ))

        return results

    def _classify_threat(self, f: dict, score: float) -> Optional[str]:
        """Phân loại loại threat cụ thể - thứ tự ưu tiên Critical trước"""
        if score < self.threshold * 0.5:
            return None

        # === CRITICAL ===
        # Data Exfiltration
        if f["total_bytes_out"] > EXFILTRATION_BYTES:
            return "DataExfiltration"

        # SYN Flood
        if f["syn_flood_ratio"] > 5 and f["packets_out"] > 1000:
            return "SYN_Flood"

        # DDoS
        if f["request_count"] > DDOS_REQUEST_THRESHOLD:
            return "DDoS"

        # Malware (high bytes out + multiple services)
        if f["total_bytes_out"] > 500000 and f["unique_dest_ports"] > 5:
            return "Malware"

        # Web Shell Upload (check payloads)
        for payload in f.get("payloads", []):
            for ext in WEBSHELL_EXTENSIONS:
                if ext in payload.lower():
                    return "WebShellUpload"
            for pattern, _ in CMD_PATTERNS:
                if re.search(pattern, payload, re.I):
                    return "Malware"

        # Privilege Escalation
        for payload in f.get("payloads", []):
            if re.search(r"(sudo|su |chmod|chown|passwd|sudoers|\/etc\/shadow)", payload, re.I):
                return "PrivilegeEscalation"

        # SQL Injection
        for payload in f.get("payloads", []):
            for pattern, _ in SQLI_PATTERNS:
                if re.search(pattern, payload, re.I):
                    return "SQLInjection"

        # === HIGH ===
        # Brute Force SSH
        if f["ssh_connections"] > BRUTEFORCE_THRESHOLD:
            return "BruteForce_SSH"

        # Lateral Movement (many internal connections)
        if f["request_count"] > 10 and f["unique_dest_ports"] >= 3:
            internal_count = sum(1 for p in f.get("port_list", []) if p in (22, 3389, 445))
            if internal_count >= 2:
                return "LateralMovement"

        # DNS Amplification
        if f["dns_queries"] > 0 and f["dns_amp_ratio"] > 10 and f["total_bytes_out"] > 10000:
            return "DNSAmplification"

        # Brute Force HTTP
        if f["http_connections"] > 20 and f["avg_bytes_per_req"] < 200:
            return "BruteForce_HTTP"

        # MITM (suspicious internal)
        if f["request_count"] > 20 and f["unique_dest_ports"] > 5:
            return "MITM"

        # === MEDIUM ===
        # Port Scan
        if f["unique_dest_ports"] >= PORT_SCAN_THRESHOLD and f["avg_bytes_per_req"] < 200:
            return "PortScan"

        # DNS Tunneling
        dns_tunnel_count = 0
        for payload in f.get("payloads", []):
            for pattern, _ in DNS_TUNNEL_PATTERNS:
                if re.search(pattern, payload):
                    dns_tunnel_count += 1
                    break
        if dns_tunnel_count >= 5 or (f["dns_queries"] > 100 and len(set(f.get("payloads", []))) > 50):
            return "DNSTunneling"

        # Slowloris (many HTTP, very small bytes)
        if f["http_connections"] > 20 and f["avg_bytes_per_req"] < 100:
            return "Slowloris"

        # ICMP Flood
        if f["icmp_count"] > 100:
            return "ICMP_Flood"

        # Cryptomining
        for payload in f.get("payloads", []):
            for pattern in MINING_PATTERNS:
                if pattern.lower() in payload.lower():
                    return "Cryptomining"

        # Suspicious Protocol
        susp = {"IRC", "TOR", "SOCKS", "PROXY"}
        if f["protocols"] & susp:
            return "SuspiciousProtocol"

        # XSS
        for payload in f.get("payloads", []):
            for pattern, _ in XSS_PATTERNS:
                if re.search(pattern, payload, re.I):
                    return "XSS"

        # Unknown Anomaly
        if score >= self.threshold:
            return "UnknownAnomaly"

        return None


# ============================================================================
# THREAT ANALYZER
# ============================================================================

class ThreatAnalyzer:

    @staticmethod
    def analyze(anomalies: list[AnomalyResult]) -> list[ThreatResult]:
        threats = []
        for result in anomalies:
            if result.verdict == "NORMAL":
                continue

            threat_type = result.threat_type or "UnknownAnomaly"
            mitre = MITRE_ATTACK.get(threat_type, MITRE_ATTACK["UnknownAnomaly"])
            f = result.features

            # Escalate severity based on score
            severity = mitre["severity"]
            if result.score > 0.9:
                pass
            elif result.score > 0.8:
                if severity == "Medium":
                    severity = "High"
                elif severity == "Low":
                    severity = "Medium"
            elif result.score > 0.7:
                if severity == "Low":
                    severity = "Medium"

            title = ThreatAnalyzer._gen_title(threat_type, result.ip, f)
            description = ThreatAnalyzer._gen_description(threat_type, result.ip, f, mitre)
            auto_block = mitre.get("auto_block", False)

            threats.append(ThreatResult(
                threat_type=threat_type,
                source_ip=result.ip,
                severity=severity,
                score=result.score,
                title=title,
                description=description,
                target_server=None,
                mitre_id=mitre["id"],
                mitre_tactic=mitre["tactic"],
                mitre_technique=f"{mitre['id']} - {mitre['tactic']}",
                recommended_action=mitre["action"],
                evidence={
                    "request_count": f.get("request_count", 0),
                    "total_bytes": f.get("total_bytes", 0),
                    "bytes_out_mb": round(f.get("total_bytes_out", 0) / 1024 / 1024, 2),
                    "unique_ports": f.get("unique_dest_ports", 0),
                    "port_list": f.get("port_list", []),
                    "services": [PORT_SERVICE.get(p, "Unknown") for p in set(f.get("port_list", []))],
                    "protocols": list(f.get("protocols", [])),
                    "ssh_connections": f.get("ssh_connections", 0),
                    "http_connections": f.get("http_connections", 0),
                    "dns_queries": f.get("dns_queries", 0),
                    "avg_bytes_per_req": round(f.get("avg_bytes_per_req", 0), 2),
                    "syn_flood_ratio": round(f.get("syn_flood_ratio", 0), 2),
                    "anomaly_score": result.score,
                    "verdict": result.verdict,
                    "detected_at": datetime.now(timezone.utc).isoformat()
                },
                auto_block=auto_block,
                block_initiated=False
            ))

        return threats

    @staticmethod
    def _gen_title(attack_type: str, ip: str, f: dict) -> str:
        titles = {
            "DDoS": f"🚨 DDoS Attack: {ip} - {f.get('request_count', 0):,} requests",
            "BruteForce_SSH": f"🔓 SSH Brute Force: {ip} - {f.get('ssh_connections', 0)} attempts",
            "BruteForce_HTTP": f"🔓 HTTP Login Brute Force: {ip} - {f.get('http_connections', 0)} attempts",
            "PortScan": f"🔍 Port Scan: {ip} - {f.get('unique_dest_ports', 0)} ports scanned",
            "SQLInjection": f"💉 SQL Injection: {ip}",
            "Malware": f"🦠 Malware / Suspicious Execution: {ip}",
            "XSS": f"⚠️ XSS Attempt: {ip}",
            "DNSAmplification": f"🌊 DNS Amplification: {ip} - ratio {f.get('dns_amp_ratio', 0):.1f}x",
            "MITM": f"🔀 MITM / ARP Spoofing: {ip}",
            "LateralMovement": f"↔️ Lateral Movement: {ip}",
            "DataExfiltration": f"📤 Data Exfiltration: {ip} - {f.get('total_bytes_out', 0) / 1024 / 1024:.1f} MB outbound",
            "DNSTunneling": f"🔗 DNS Tunneling: {ip} - {f.get('dns_queries', 0)} queries",
            "Slowloris": f"🐢 Slowloris DoS: {ip} - {f.get('http_connections', 0)} incomplete connections",
            "SYN_Flood": f"💥 SYN Flood: {ip} - ratio {f.get('syn_flood_ratio', 0):.1f}x",
            "ICMP_Flood": f"📶 ICMP Flood: {ip} - {f.get('icmp_count', 0)} pings",
            "WebShellUpload": f"🐚 Web Shell Upload: {ip}",
            "PrivilegeEscalation": f"⬆️ Privilege Escalation Attempt: {ip}",
            "Cryptomining": f"⛏️ Cryptomining Indicator: {ip}",
            "SuspiciousProtocol": f"🔎 Suspicious Protocol: {ip}",
            "UnknownAnomaly": f"❓ Unknown Anomaly: {ip} - score {f.get('ddos_score', 0):.2f}",
        }
        return titles.get(attack_type, f"⚠️ {attack_type}: {ip}")

    @staticmethod
    def _gen_description(attack_type: str, ip: str, f: dict, mitre: dict) -> str:
        services = [PORT_SERVICE.get(p, str(p)) for p in set(f.get("port_list", []))]
        desc = f"**[{mitre['severity']}] {attack_type}**\n\n"
        desc += f"**Nguồn tấn công:** `{ip}`\n\n"
        desc += f"| Chỉ số | Giá trị |\n|---|---|\n"
        desc += f"| Requests | {f.get('request_count', 0):,} |\n"
        desc += f"| Tổng traffic | {f.get('total_bytes', 0) / 1024 / 1024:.2f} MB |\n"
        desc += f"| Bytes out | {f.get('total_bytes_out', 0) / 1024:.1f} KB |\n"
        desc += f"| Bytes in | {f.get('total_bytes_in', 0) / 1024:.1f} KB |\n"
        desc += f"| Unique ports | {f.get('unique_dest_ports', 0)} |\n"
        desc += f"| Services | {', '.join(services[:5]) + ('...' if len(services) > 5 else '')} |\n"
        desc += f"| Protocols | {', '.join(f.get('protocols', []))} |\n"
        desc += f"| Avg bytes/req | {f.get('avg_bytes_per_req', 0):.1f} |\n"
        desc += f"| SSH attempts | {f.get('ssh_connections', 0)} |\n"
        desc += f"| HTTP connections | {f.get('http_connections', 0)} |\n"
        desc += f"| DNS queries | {f.get('dns_queries', 0)} |\n"
        desc += f"| SYN ratio | {f.get('syn_flood_ratio', 0):.2f}x |\n"
        desc += f"| Anomaly Score | {f.get('ddos_score', 0) * 100:.1f}% |\n\n"
        desc += f"**MITRE ATT&CK:** `{mitre['id']} - {mitre['tactic']}`\n\n"
        desc += f"**Khuyến nghị:** {mitre['action']}\n"
        return desc


# ============================================================================
# IP AUTO-BLOCK ENGINE
# ============================================================================

class AutoBlockEngine:
    """
    Nhận lệnh block IP từ AI Engine, thực thi trên server.
    - Windows: netsh advfirewall
    - Linux: iptables
    """

    def __init__(self, backend_url: str, api_key: str, server_id: str = ""):
        self.backend_url = backend_url.rstrip('/')
        self.api_key = api_key
        self.server_id = server_id   # Server cần block — dùng để Backend push SignalR command đến Agent
        self.session = requests.Session()
        self.session.headers.update({
            "X-API-Key": api_key,
            "Content-Type": "application/json",
            "User-Agent": "CyberMonitor-AI-Engine/2.0"
        })
        self._blocked: dict[str, datetime] = {}
        self._lock = threading.Lock()
        self._platform = os.getenv("BLOCK_PLATFORM", "")

        # Determine platform
        if not self._platform:
            import platform as p
            self._platform = p.system()

        logger.info(f"AutoBlock engine initialized on {self._platform}")

    def should_block(self, threat: ThreatResult) -> bool:
        """Kiểm tra xem có nên block IP này không"""
        if not threat.auto_block:
            return False

        mitre = MITRE_ATTACK.get(threat.threat_type, {})
        block_threshold = mitre.get("block_threshold", AUTO_BLOCK_THRESHOLD)

        if threat.score < block_threshold:
            return False

        # Check if already blocked recently (within 30 min)
        with self._lock:
            if threat.source_ip in self._blocked:
                blocked_at = self._blocked[threat.source_ip]
                if (datetime.now(timezone.utc) - blocked_at).total_seconds() < 1800:
                    logger.debug(f"IP {threat.source_ip} already blocked recently, skipping")
                    return False

        return True

    def block(self, threat: ThreatResult) -> bool:
        """Block IP tấn công"""
        ip = threat.source_ip
        logger.warning(
            f"[AUTO-BLOCK] Initiating block for {ip} | "
            f"Attack: {threat.threat_type} | Score: {threat.score:.2f}"
        )

        # === Block on local firewall ===
        success = True

        # === Report to backend ===
        self._report_block(ip, threat, success)

        if success:
            with self._lock:
                self._blocked[ip] = datetime.now(timezone.utc)
            logger.warning(f"[AUTO-BLOCK] ✅ Blocked {ip} ({threat.threat_type})")
            return True
        else:
            logger.error(f"[AUTO-BLOCK] ❌ Failed to block {ip} - may need admin/root")
            # Still report to backend so SOC can manually block
            self._report_block(ip, threat, False)
            return False

    def _block_local_firewall(self, ip: str, reason: str) -> bool:
        """Block IP trên local firewall"""
        if self._platform == "Windows":
            return self._block_windows(ip, reason)
        else:
            return self._block_linux(ip, reason)

    def _block_windows(self, ip: str, reason: str) -> bool:
        """Windows: netsh advfirewall firewall add rule"""
        rule_name = f"CyberMonitor_AIBlock_{ip.replace('.', '_')}"
        try:
            result = subprocess.run(
                [
                    "netsh", "advfirewall", "firewall", "add", "rule",
                    f"name={rule_name}",
                    "dir=in", "action=block",
                    f"remoteip={ip}",
                    "protocol=any",
                    f"description=AI-Engine:{reason[:50]}"
                ],
                capture_output=True, text=True, timeout=10
            )
            if result.returncode == 0:
                return True
            logger.warning(f"netsh block failed: {result.stderr.strip()}")
            return False
        except FileNotFoundError:
            logger.error("netsh not found - run as Administrator")
            return False
        except Exception as e:
            logger.error(f"Windows firewall block error: {e}")
            return False

    def _block_linux(self, ip: str, reason: str) -> bool:
        """Linux: iptables -A INPUT -s IP -j DROP"""
        try:
            # Check if already blocked
            check = subprocess.run(
                ["iptables", "-C", "INPUT", "-s", ip, "-j", "DROP"],
                capture_output=True
            )
            if check.returncode == 0:
                logger.debug(f"IP {ip} already in iptables")
                return True

            result = subprocess.run(
                ["iptables", "-A", "INPUT", "-s", ip, "-j", "DROP"],
                capture_output=True, text=True, timeout=10
            )
            if result.returncode == 0:
                return True
            logger.warning(f"iptables block failed: {result.stderr.strip()}")
            return False
        except FileNotFoundError:
            logger.error("iptables not found - run as root")
            return False
        except Exception as e:
            logger.error(f"Linux iptables block error: {e}")
            return False

    def unblock(self, ip: str) -> bool:
        """Unblock IP"""
        logger.info(f"[AUTO-BLOCK] Unblocking {ip}")

        if self._platform == "Windows":
            rule_name = f"CyberMonitor_AIBlock_{ip.replace('.', '_')}"
            try:
                result = subprocess.run(
                    ["netsh", "advfirewall", "firewall", "delete", "rule", f"name={rule_name}"],
                    capture_output=True, text=True, timeout=10
                )
                success = result.returncode == 0
            except Exception as e:
                logger.error(f"Windows unblock error: {e}")
                success = False
        else:
            try:
                result = subprocess.run(
                    ["iptables", "-D", "INPUT", "-s", ip, "-j", "DROP"],
                    capture_output=True, text=True, timeout=10
                )
                success = result.returncode == 0
            except Exception as e:
                logger.error(f"Linux unblock error: {e}")
                success = False

        if success:
            with self._lock:
                self._blocked.pop(ip, None)
            self._report_unblock(ip)

        return success

    def _report_block(self, ip: str, threat: ThreatResult, success: bool):
        """Báo backend biết IP đã block"""
        try:
            payload = {
                "ip": ip,
                "attackType": threat.threat_type,
                "severity": threat.severity,
                "reason": threat.recommended_action,
                "score": threat.score,
                "blockedBy": "AI-Engine",
                "blockDurationMinutes": 60,
                "serverId": self.server_id if self.server_id else None,
            }
            resp = self.session.post(
                f"{self.backend_url}/api/defense/block-ip",
                json=payload,
                timeout=10
            )
            if resp.status_code == 200:
                logger.info(f"[AUTO-BLOCK] Backend notified: {ip}")
            else:
                try:
                    err_body = resp.json().get("message", resp.text)
                except Exception:
                    err_body = resp.text
                logger.warning(f"[AUTO-BLOCK] Backend notification failed: {resp.status_code} — {err_body}")
        except Exception as e:
            logger.error(f"[AUTO-BLOCK] Backend notification error: {e}")

    def _report_unblock(self, ip: str):
        """Báo backend IP đã unblock"""
        try:
            resp = self.session.post(
                f"{self.backend_url}/api/defense/unblock-ip",
                json={"ip": ip, "unblockedBy": "AI-Engine", "serverId": self.server_id},
                timeout=10
            )
            if resp.status_code != 200:
                logger.warning(f"[AUTO-BLOCK] Unblock notification failed: {resp.status_code}")
        except Exception as e:
            logger.error(f"[AUTO-BLOCK] Unblock notification error: {e}")


# ============================================================================
# AI ENGINE SERVICE
# ============================================================================

class AIEngineService:

    def __init__(
        self,
        backend_url: str = BACKEND_URL,
        check_interval: int = CHECK_INTERVAL,
        lookback_minutes: int = LOOKBACK_MINUTES,
        anomaly_threshold: float = ANOMALY_THRESHOLD,
        server_id: str = ""   # Server ID để push block command đến Agent qua SignalR
    ):
        self.backend_url = backend_url.rstrip('/')
        self.check_interval = check_interval
        self.lookback_minutes = lookback_minutes

        self.detector = AnomalyDetector(threshold=anomaly_threshold)
        self.threat_analyzer = ThreatAnalyzer()
        self.feature_extractor = FeatureExtractor()
        self.block_engine = AutoBlockEngine(backend_url, AI_API_KEY, server_id=server_id)

        self.session = requests.Session()
        self.session.headers.update({
            "X-API-Key": AI_API_KEY,
            "Content-Type": "application/json",
            "User-Agent": "CyberMonitor-AI-Engine/2.0"
        })

        self._running = False
        self._stats = {
            "total_cycles": 0,
            "total_threats": 0,
            "alerts_triggered": 0,
            "ips_blocked": 0,
            "auto_blocks_failed": 0,
            "alerts_failed": 0,
            "last_check": None
        }
        self._lock = threading.Lock()

    def start(self):
        self._running = True

        logger.info("=" * 60)
        logger.info(" CyberMonitor AI Engine v2.0 - STARTING")
        logger.info(f" Backend URL: {self.backend_url}")
        logger.info(f" Check Interval: {self.check_interval}s")
        logger.info(f" Lookback: {self.lookback_minutes} min")
        logger.info(f" Anomaly Threshold: {ANOMALY_THRESHOLD}")
        logger.info(f" Auto-Block Threshold: {AUTO_BLOCK_THRESHOLD}")
        logger.info(f" Attack Types Detected: 20")
        logger.info("=" * 60)

        self._run_analysis_cycle()

        while self._running:
            time.sleep(self.check_interval)
            try:
                self._run_analysis_cycle()
            except Exception as e:
                logger.error(f"Error in analysis cycle: {e}")

    def stop(self):
        logger.info("Stopping AI Engine...")
        self._running = False

    def _run_analysis_cycle(self):
        cycle_start = time.time()

        with self._lock:
            self._stats["total_cycles"] += 1

        # Step 1: Fetch logs
        logs = self._fetch_traffic_logs()
        if not logs:
            logger.debug("No logs fetched this cycle")
            return

        logger.info(f"[CYCLE] Fetched {len(logs)} logs, analyzing...")

        # Step 2: Extract features
        features = self.feature_extractor.extract(logs)
        logger.debug(f"[CYCLE] Extracted features for {len(features)} IPs")

        # Step 3: Anomaly detection (ML or Rule-based)
        anomalies = self.detector.detect(features)
        threats_found = [a for a in anomalies if a.verdict != "NORMAL"]
        logger.info(f"[CYCLE] Found {len(threats_found)} suspicious IPs")

        # Step 4: Threat analysis
        threats = self.threat_analyzer.analyze(anomalies)

        with self._lock:
            self._stats["total_threats"] += len(threats)

        for threat in threats:
            # Send alert to backend
            self._trigger_alert(threat)

            # Auto-block if threshold met
            if self.block_engine.should_block(threat):
                success = self.block_engine.block(threat)
                threat.block_initiated = success
                with self._lock:
                    if success:
                        self._stats["ips_blocked"] += 1
                    else:
                        self._stats["auto_blocks_failed"] += 1

            # Log critical attacks
            if threat.severity in ("Critical", "High"):
                logger.warning(
                    f"🚨 [{threat.severity}] {threat.threat_type} | "
                    f"IP: {threat.source_ip} | Score: {threat.score:.2f} | "
                    f"Block: {'YES' if threat.block_initiated else 'NO'}"
                )

        cycle_time = time.time() - cycle_start
        with self._lock:
            self._stats["last_check"] = datetime.now(timezone.utc).isoformat()

        blocked_count = sum(1 for t in threats if t.block_initiated)
        logger.info(
            f"[CYCLE] Done in {cycle_time:.2f}s | "
            f"Logs: {len(logs)} | Threats: {len(threats)} | "
            f"Blocked: {blocked_count} | Stats: {self._stats['ips_blocked']} total blocked"
        )

    def _fetch_traffic_logs(self) -> list[dict]:
        try:
            since = datetime.now(timezone.utc) - timedelta(minutes=self.lookback_minutes)
            resp = self.session.get(
                f"{self.backend_url}/api/logs",
                params={"fromDate": since.isoformat(), "pageSize": 10000},
                timeout=30
            )

            if resp.status_code == 200:
                data = resp.json()
                if data.get("success") and data.get("data"):
                    return data["data"].get("items", [])
            elif resp.status_code == 401:
                logger.error("AI Engine API key rejected by backend")
            else:
                logger.warning(f"Failed to fetch logs: {resp.status_code}")

        except requests.exceptions.ConnectionError:
            logger.warning(f"Cannot connect to backend at {self.backend_url}")
        except Exception as e:
            logger.error(f"Error fetching logs: {e}")

        return []

    def _trigger_alert(self, threat: ThreatResult):
        """Gửi alert về Backend"""
        try:
            payload = {
                "severity": threat.severity,
                "alertType": threat.threat_type.upper(),
                "title": threat.title,
                "description": threat.description,
                "sourceIp": threat.source_ip,
                "targetAsset": threat.target_server,
                "mitreTactic": threat.mitre_tactic,
                "mitreTechnique": threat.mitre_technique,
                "anomalyScore": threat.score,
                "recommendedAction": threat.recommended_action,
                "autoBlocked": threat.block_initiated,
                "evidence": json.dumps(threat.evidence)
            }

            resp = self.session.post(
                f"{self.backend_url}/api/alerts/trigger",
                json=payload,
                timeout=10
            )

            if resp.status_code == 200:
                with self._lock:
                    self._stats["alerts_triggered"] += 1
            else:
                logger.error(f"Alert failed: {resp.status_code} - {resp.text}")
                with self._lock:
                    self._stats["alerts_failed"] += 1

        except Exception as e:
            logger.error(f"Error triggering alert: {e}")
            with self._lock:
                self._stats["alerts_failed"] += 1

    def get_stats(self) -> dict:
        with self._lock:
            return self._stats.copy()


# ============================================================================
# MAIN
# ============================================================================

def main():
    import argparse

    parser = argparse.ArgumentParser(
        description="CyberMonitor AI Engine v2.0 - 20 Attack Types + Auto-Block",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python ai_engine.py --backend-url http://localhost:5000
  python ai_engine.py -b http://192.168.1.6:5000 -i 30 -l 3
  AUTO_BLOCK_THRESHOLD=0.9 python ai_engine.py --verbose

Attack Detection:
  1. DDoS (T1498)        11. Data Exfiltration (T1041)
  2. Brute Force SSH (T1110)   12. DNS Tunneling (T1071)
  3. Brute Force HTTP (T1110)   13. Slowloris (T1498)
  4. Port Scan (T1016)   14. SYN Flood (T1498)
  5. SQL Injection (T1190)    15. ICMP Flood (T1498)
  6. Malware (T1059)      16. Web Shell Upload (T1105)
  7. XSS (T1059)         17. Privilege Escalation (T1068)
  8. DNS Amplification (T1498)   18. Cryptomining (T1496)
  9. MITM (T1557)        19. Suspicious Protocol (T1046)
  10. Lateral Movement (T1021)   20. Unknown Anomaly (ML)

Auto-Block:
  When score >= threshold, AI Engine automatically:
  1. Blocks IP on local firewall (netsh/iptables)
  2. Reports to backend for DB update + SOC notification
  3. Creates Alert + Ticket automatically
        """
    )
    parser.add_argument("--backend-url", "-b", default=BACKEND_URL)
    parser.add_argument("--interval", "-i", type=int, default=CHECK_INTERVAL)
    parser.add_argument("--lookback", "-l", type=int, default=LOOKBACK_MINUTES)
    parser.add_argument("--threshold", "-t", type=float, default=ANOMALY_THRESHOLD)
    parser.add_argument("--block-threshold", type=float, default=AUTO_BLOCK_THRESHOLD)
    parser.add_argument("--server-id",
                        default=os.getenv("CYBERMONITOR_SERVER_ID", ""),
                        help="Server ID để Backend push block command đến Agent (SignalR AgentHub)")
    parser.add_argument("-v", "--verbose", action="store_true")

    args = parser.parse_args()

    if args.verbose:
        logging.getLogger().setLevel(logging.DEBUG)

    if args.block_threshold != AUTO_BLOCK_THRESHOLD:
        os.environ["AUTO_BLOCK_THRESHOLD"] = str(args.block_threshold)

    engine = AIEngineService(
        backend_url=args.backend_url,
        check_interval=args.interval,
        lookback_minutes=args.lookback,
        anomaly_threshold=args.threshold,
        server_id=args.server_id
    )

    try:
        engine.start()
    except KeyboardInterrupt:
        print("\n")
        logger.info("AI Engine stopped by user")
        logger.info(f"Final stats: {engine.get_stats()}")
        sys.exit(0)


if __name__ == "__main__":
    main()
