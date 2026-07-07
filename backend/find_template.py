import os
import dotenv
from supabase import create_client
import fitz
import hashlib

def find_matching_template():
    dotenv.load_dotenv()
    sb = create_client(os.getenv("SUPABASE_URL"), os.getenv("SUPABASE_SERVICE_ROLE_KEY"))
    
    local_path = "C:/Users/ROHITH P/Downloads/ROHITH P cerf (3).pdf (2).pdf"
    with open(local_path, "rb") as f:
        local_data = f.read()
    local_hash = hashlib.sha256(local_data).hexdigest()
    print(f"Local template hash: {local_hash}")
    
    res = sb.table("templates").select("*").execute()
    for t in res.data:
        t_id = t["id"]
        pdf_path = f"{t_id}/template.pdf"
        try:
            db_bytes = sb.storage.from_("templates").download(pdf_path)
            db_hash = hashlib.sha256(db_bytes).hexdigest()
            print(f"Template {t_id} hash: {db_hash}")
            if db_hash == local_hash:
                print(f"-> EXACT MATCH FOUND: {t_id}")
                return t_id
            
            # Fallback comparison by text blocks
            doc_db = fitz.open(stream=db_bytes, filetype="pdf")
            doc_local = fitz.open(local_path)
            db_text = doc_db[0].get_text()
            local_text = doc_local[0].get_text()
            if db_text == local_text:
                print(f"-> TEXT MATCH FOUND: {t_id}")
                return t_id
        except Exception as e:
            print(f"Error checking template {t_id}: {e}")
            
    return None

if __name__ == '__main__':
    find_matching_template()
