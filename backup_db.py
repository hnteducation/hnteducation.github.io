#!/usr/bin/env python
# -*- coding: utf-8 -*-

"""
SCRIPT SAO LƯU DỮ LIỆU OFFLINE CHO HNT EDUCATION
-------------------------------------------------
Script này sử dụng thư viện tiêu chuẩn của Python (không cần cài thêm thư viện ngoài).
Chức năng: Tự động kết nối đến API Google Sheets, tải toàn bộ dữ liệu học sinh & học phí,
và lưu thành file JSON cục bộ trên máy tính của bạn để lưu trữ dự phòng.

HƯỚNG DẪN SỬ DỤNG:
1. Đảm bảo máy tính đã cài đặt Python (tải từ python.org).
2. Chạy file này bằng cách nhấp đúp hoặc gõ lệnh: python backup_db.py
3. Trong lần đầu chạy, script sẽ hỏi bạn nhập URL Web App và Mật mã (Passcode).
   Thông tin này sẽ tự động lưu lại vào file `config_backup.json` để chạy tự động các lần sau.
"""

import os
import json
import urllib.request
import urllib.error
from datetime import datetime

CONFIG_FILE = "config_backup.json"
BACKUP_DIR = "backups"

def load_config():
    if os.path.exists(CONFIG_FILE):
        try:
            with open(CONFIG_FILE, 'r', encoding='utf-8') as f:
                return json.load(f)
        except Exception as e:
            print(f"[!] Lỗi đọc file cấu hình: {e}")
    return None

def save_config(api_url, passcode):
    config = {
        "api_url": api_url,
        "passcode": passcode
    }
    try:
        with open(CONFIG_FILE, 'w', encoding='utf-8') as f:
            json.dump(config, f, indent=4, ensure_ascii=False)
        print(f"[*] Đã lưu thông tin cấu hình vào file '{CONFIG_FILE}'.")
    except Exception as e:
        print(f"[!] Lỗi lưu file cấu hình: {e}")

def get_input(prompt):
    return input(prompt).strip()

def run_backup():
    print("="*60)
    print("        HỆ THỐNG SAO LƯU DỮ LIỆU OFFLINE - HNT EDUCATION")
    print("="*60)
    
    # 1. Khởi tạo cấu hình
    config = load_config()
    if not config:
        print("[*] Không tìm thấy cấu hình cũ. Vui lòng thiết lập kết nối:")
        api_url = get_input("-> Nhập URL Google Apps Script Web App: ")
        passcode = get_input("-> Nhập Mật mã bảo mật (Passcode): ")
        
        if not api_url or not passcode:
            print("[!] Lỗi: Bạn phải nhập đầy đủ URL và Mật mã để tiếp tục.")
            return
            
        save_config(api_url, passcode)
        config = {"api_url": api_url, "passcode": passcode}

    api_url = config.get("api_url")
    passcode = config.get("passcode")
    
    print(f"[*] Đang kết nối tới API: {api_url[:40]}...")
    
    # 2. Chuẩn bị yêu cầu API
    payload = {
        "passcode": passcode,
        "action": "getData"
    }
    data_bytes = json.dumps(payload).encode('utf-8')
    
    req = urllib.request.Request(
        api_url,
        data=data_bytes,
        headers={'Content-Type': 'text/plain'} # Dùng text/plain tương tự trình duyệt để tối ưu GAS
    )
    
    # 3. Gửi yêu cầu và nhận phản hồi
    try:
        with urllib.request.urlopen(req, timeout=15) as response:
            res_body = response.read().decode('utf-8')
            result = json.loads(res_body)
            
            if not result.get("success"):
                print(f"[!] Lỗi từ máy chủ API: {result.get('error')}")
                # Nếu sai passcode, xóa cấu hình cũ để nhập lại lần sau
                if "Unauthorized" in result.get('error', ''):
                    if os.path.exists(CONFIG_FILE):
                        os.remove(CONFIG_FILE)
                        print("[*] Đã xóa file cấu hình sai mật mã. Vui lòng chạy lại script để cấu hình lại.")
                return
            
            # 4. Ghi nhận dữ liệu và lưu file
            students = result.get("students", [])
            payments = result.get("payments", [])
            print(f"[+] Kết nối thành công! Đã tải về: {len(students)} học sinh và {len(payments)} lịch sử đóng phí.")
            
            # Tạo thư mục backups nếu chưa có
            if not os.path.exists(BACKUP_DIR):
                os.makedirs(BACKUP_DIR)
                print(f"[*] Đã tạo thư mục lưu trữ: '{BACKUP_DIR}/'")
                
            # Tạo tên file kèm ngày giờ
            now_str = datetime.now().strftime("%Y-%m-%d_%H-%M-%S")
            backup_filename = os.path.join(BACKUP_DIR, f"backup_hnt_{now_str}.json")
            
            backup_data = {
                "backup_time": datetime.now().isoformat(),
                "students": students,
                "payments": payments
            }
            
            with open(backup_filename, 'w', encoding='utf-8') as f:
                json.dump(backup_data, f, indent=4, ensure_ascii=False)
                
            print(f"[SUCCESS] Đã lưu bản sao lưu offline thành công tại:")
            print(f"          -> {os.path.abspath(backup_filename)}")
            print("="*60)
            
    except urllib.error.URLError as e:
        print(f"[!] Lỗi kết nối mạng: {e.reason}")
        print("    Vui lòng kiểm tra lại mạng Internet hoặc tính chính xác của URL Apps Script.")
    except Exception as e:
        print(f"[!] Lỗi không xác định: {e}")

if __name__ == "__main__":
    run_backup()
    # Giữ cửa sổ terminal không bị tắt ngay trên Windows
    input("\nBấm Enter để thoát...")
