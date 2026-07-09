import os
import sys
import argparse
from dotenv import load_dotenv

# Add backend to path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app import precompile_pptx_template, convert_pptx_to_pdf_bytes, supabase

if not supabase:
    print("Error: Supabase client is not configured. Make sure backend/.env exists.")
    sys.exit(1)

def file_exists_in_storage(bucket: str, path: str) -> bool:
    try:
        folder = os.path.dirname(path)
        filename = os.path.basename(path)
        files = supabase.storage.from_(bucket).list(folder)
        for f in files:
            if f["name"] == filename:
                return True
        return False
    except Exception:
        return False

def main():
    parser = argparse.ArgumentParser(description="Precompile PPTX templates for a specific batch and upload to Supabase.")
    parser.add_argument("batch_id", help="The ID of the batch (e.g., BATCH_17)")
    args = parser.parse_args()

    batch_id = args.batch_id
    print(f"=== Starting precompilation for Batch: {batch_id} ===")

    # Fetch batch record
    batch_res = supabase.table("batches").select("*").eq("id", batch_id).execute()
    if not batch_res.data:
        print(f"Error: Batch '{batch_id}' not found in database.")
        sys.exit(1)

    batch = batch_res.data[0]
    templates = [
        ("lor", batch.get("lor_template_path")),
        ("experience", batch.get("experience_template_path")),
        ("internship", batch.get("internship_template_path"))
    ]

    for label, path in templates:
        if not path:
            continue

        ext = os.path.splitext(path)[1].lower()
        if ext != ".pptx":
            print(f"- {label}: Template is {ext} (no precompilation required)")
            continue

        print(f"\n- Processing {label} template ({path})...")

        bg_path = f"templates/{batch_id}/{label}_background.pdf"
        coords_path = f"templates/{batch_id}/{label}_coordinates.json"

        try:
            # Download PPTX
            print(f"  Downloading PPTX from Supabase...")
            pptx_bytes = supabase.storage.from_("templates").download(path)

            # Precompile
            print("  Precompiling layout structure...")
            blanked_pptx, coordinates_json = precompile_pptx_template(pptx_bytes)

            # Convert to PDF
            print("  Converting blanked presentation to background PDF...")
            background_pdf = convert_pptx_to_pdf_bytes(blanked_pptx)

            # Upload background PDF
            print(f"  Uploading background PDF -> {bg_path}...")
            supabase.storage.from_("templates").upload(
                path=bg_path,
                file=background_pdf,
                file_options={"content-type": "application/pdf", "upsert": "true"}
            )

            # Upload coordinates JSON
            print(f"  Uploading coordinates JSON -> {coords_path}...")
            supabase.storage.from_("templates").upload(
                path=coords_path,
                file=coordinates_json,
                file_options={"content-type": "application/json", "upsert": "true"}
            )

            print(f"  Success: precompiled and uploaded {label} overlay files!")

        except Exception as e:
            print(f"  Error processing {label}: {e}")

    print("\n=== Precompilation Finished ===")

if __name__ == "__main__":
    main()
