import os
from dotenv import load_dotenv
from supabase import create_client

# Load environment variables from backend/.env for local testing
load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

if not SUPABASE_URL or not SUPABASE_SERVICE_ROLE_KEY:
    print("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in environment")
    raise SystemExit(1)

sb = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

try:
    content = b"healthcheck"
    path = "test_upload_check.txt"
    res = sb.storage.from_("templates").upload(path=path, file=content)
    print("Upload result:", res)
    pub = sb.storage.from_("templates").get_public_url(path)
    print("Public URL:", pub)
except Exception as e:
    print("Upload failed:", e)
    raise
