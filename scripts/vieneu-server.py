"""
Chạy server OpenAI-compatible của VieNeu-TTS kèm CORS cho Vở Ngoại Ngữ.

Server gốc (`apps/openai_speech.py` trong repo VieNeu-TTS) không bật CORS, nên trình duyệt chặn
app gọi tới dù server đã chạy. Script này nạp đúng FastAPI app của VieNeu, thêm CORSMiddleware
cho các origin của app rồi chạy uvicorn. Không sửa gì trong repo VieNeu.

Cách chạy (từ thư mục english-skills):
    VIENEU_DIR=../VieNeu-TTS uv run --project ../VieNeu-TTS python scripts/vieneu-server.py

Biến môi trường:
    VIENEU_DIR           thư mục repo VieNeu-TTS (mặc định: ../VieNeu-TTS cạnh dự án này)
    VIENEU_CORS_ORIGINS  danh sách origin cách nhau bằng dấu phẩy
                         (mặc định: app production + localhost dev/preview)
    HOST / PORT          như server gốc (mặc định 127.0.0.1:8000). HOST=0.0.0.0 để máy khác
                         trong Wi-Fi gọi tới; khi đó nên đặt VIENEU_API_KEY theo cảnh báo của VieNeu.
"""
from __future__ import annotations

import os
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
VIENEU_DIR = Path(os.environ.get("VIENEU_DIR") or HERE.parent.parent / "VieNeu-TTS").resolve()
if not (VIENEU_DIR / "apps" / "openai_speech.py").exists():
    sys.exit(f"Không thấy VieNeu-TTS tại {VIENEU_DIR}. Đặt VIENEU_DIR trỏ tới thư mục đã clone.")
sys.path.insert(0, str(VIENEU_DIR))
os.chdir(VIENEU_DIR)  # VieNeu đọc tài nguyên (giọng mẫu, model cache) theo cwd

DEFAULT_ORIGINS = [
    "https://free-language.vercel.app",
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:4173",
    "http://127.0.0.1:4173",
]
origins = [o.strip() for o in os.environ.get("VIENEU_CORS_ORIGINS", ",".join(DEFAULT_ORIGINS)).split(",") if o.strip()]

import uvicorn  # noqa: E402
from fastapi.middleware.cors import CORSMiddleware  # noqa: E402

import apps.openai_speech as srv  # noqa: E402  (nạp app + startup event của VieNeu)

srv.app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization"],
    allow_credentials=False,
    max_age=600,
)

if __name__ == "__main__":
    host = os.environ.get("HOST", "127.0.0.1")
    port = int(os.environ.get("PORT", "8000"))
    print(f"VieNeu-TTS + CORS cho: {', '.join(origins)}", flush=True)
    print(f"Địa chỉ dán vào app: http://{'localhost' if host in ('127.0.0.1', '::1') else host}:{port}", flush=True)
    uvicorn.run(srv.app, host=host, port=port, workers=1, log_level="info")
