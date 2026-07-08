import io
import os
import uuid
import re
import urllib.request
import tempfile
import pandas as pd
from typing import Dict, List, Optional
from datetime import datetime
from fastapi import FastAPI, UploadFile, File, Form, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv

try:
    import win32com.client
    HAS_WIN32COM = True
except ImportError:
    HAS_WIN32COM = False

# PDF & QR generation libraries
import fitz  # PyMuPDF
from reportlab.pdfgen import canvas
from reportlab.lib.utils import ImageReader
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from pypdf import PdfReader, PdfWriter
import qrcode

# Supabase python client
from supabase import create_client, Client

load_dotenv()

app = FastAPI(title="Certificate Generator API")

VERIFY_BASE_URL = os.getenv("CERT_VERIFY_BASE_URL", "https://coptercode-website.vercel.app/verify").strip()


def build_verify_url(cert_code: str) -> str:
    """
    Builds a verification URL for QR generation.
    Supports either:
    - direct placeholder format: https://site/verify/{code}
    - query format: https://site/verify?id=CODE
    """
    if not VERIFY_BASE_URL:
        return f"https://coptercode-website.vercel.app/verify?id={cert_code}"

    base = VERIFY_BASE_URL.rstrip('/')

    if "{code}" in base:
        return base.replace("{code}", cert_code)

    separator = "&" if "?" in base else "?"
    return f"{base}{separator}id={cert_code}"

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allow all origins for dev simplicity
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Supabase credentials verification
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

if not SUPABASE_URL or not SUPABASE_SERVICE_ROLE_KEY:
    print("WARNING: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables are missing.")

# Initialize Supabase client
supabase: Optional[Client] = None
if SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY:
    try:
        supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    except Exception as e:
        print(f"Error initializing Supabase client: {e}")

# ───────────────────────────────────────────────────────────────────
# Font management
# ───────────────────────────────────────────────────────────────────
FONT_CACHE_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "font_cache")
os.makedirs(FONT_CACHE_DIR, exist_ok=True)

# ReportLab built-in font names — these require no download
BUILTIN_FONTS = {
    "Helvetica", "Helvetica-Bold", "Helvetica-Oblique", "Helvetica-BoldOblique",
    "Times-Roman", "Times-Bold", "Times-Italic", "Times-BoldItalic",
    "Courier", "Courier-Bold", "Courier-Oblique", "Courier-BoldOblique",
}

# Track already-registered custom fonts in this process to avoid re-registering
_REGISTERED_FONTS: set = set()


def get_reportlab_font(font_name: str) -> str:
    """
    Returns a font name usable by ReportLab canvas.setFont().
    For Google Fonts, downloads the TTF to font_cache/ on first use
    and registers it with pdfmetrics.  Falls back to Helvetica on errors.
    """
    if not font_name or font_name in BUILTIN_FONTS:
        return font_name or "Helvetica"

    if font_name in _REGISTERED_FONTS:
        return font_name  # already registered in this process

    safe_name = re.sub(r"[^A-Za-z0-9_-]", "_", font_name)
    cache_path = os.path.join(FONT_CACHE_DIR, f"{safe_name}.ttf")

    if not os.path.exists(cache_path):
        # Download TTF from Google Fonts CSS API (using Android 4 User-Agent to force direct TTF link in response)
        try:
            api_url = f"https://fonts.googleapis.com/css?family={font_name.replace(' ', '+')}"
            req = urllib.request.Request(
                api_url,
                headers={"User-Agent": "Mozilla/5.0 (Linux; U; Android 4.0.3; ko-kr; LG-L160L Build/IML74K) AppleWebKit/534.30 (KHTML, like Gecko) Version/4.0 Mobile Safari/534.30"}
            )
            css_bytes = urllib.request.urlopen(req, timeout=15).read()
            css_text = css_bytes.decode("utf-8")

            # Extract the TTF URL from src: url(https://...ttf)
            ttf_match = re.search(r"src:\s*url\(([^)]+\.ttf)\)", css_text, re.IGNORECASE)
            if not ttf_match:
                print(f"[font] No TTF URL found for '{font_name}', falling back to Helvetica")
                return "Helvetica"

            ttf_url = ttf_match.group(1).strip().strip("'\"")
            print(f"[font] Downloading '{font_name}' from {ttf_url}")
            urllib.request.urlretrieve(ttf_url, cache_path)
        except Exception as download_err:
            print(f"[font] Failed to download '{font_name}': {download_err}")
            return "Helvetica"

    # Register the TTF with ReportLab
    if os.path.exists(cache_path):
        try:
            pdfmetrics.registerFont(TTFont(font_name, cache_path))
            _REGISTERED_FONTS.add(font_name)
            print(f"[font] Registered '{font_name}'")
            return font_name
        except Exception as reg_err:
            print(f"[font] Failed to register '{font_name}': {reg_err}")

    return "Helvetica"


class Position(BaseModel):
    x: float   # center x fraction (0–1)
    y: float   # center y fraction (0–1)
    w: float = 0.30   # box width fraction  (default generous for back-compat)
    h: float = 0.05   # box height fraction


def calc_pdf_font_size(
    text: str,
    font_name: str,
    box_w_pt: float,
    box_h_pt: float,
    min_size: float = 7,
) -> float:
    """
    Return the largest integer font size (up to box_h_pt * 0.8)
    at which `text` fits inside `box_w_pt` (92% fill).
    Falls back to min_size if nothing fits.
    """
    if not text:
        return 12
    max_size = int(max(min_size, box_h_pt * 0.80))
    for size in range(max_size, int(min_size) - 1, -1):
        try:
            w = pdfmetrics.stringWidth(text, font_name, size)
            if w <= box_w_pt * 0.92:
                return float(size)
        except Exception:
            pass
    return float(min_size)


class LayoutPayload(BaseModel):
    template_id: str
    name_pos: Position
    college_pos: Position
    year_pos: Position          # renamed from batch_pos
    qr_pos: Position
    qr_size: float
    department_pos: Optional[Position] = None
    role_pos: Optional[Position] = None
    project_pos: Optional[Position] = None   # NEW
    month_pos: Optional[Position] = None     # NEW
    date_pos: Optional[Position] = None      # renamed from end_date_pos
    font_settings: Optional[Dict[str, str]] = None  # per-field font names


def convert_pptx_to_pdf_bytes(pptx_bytes: bytes) -> bytes:
    if not HAS_WIN32COM:
        raise ValueError("PowerPoint COM library (pywin32) is not installed on this system.")
    
    # Save the pptx bytes to a temp file
    temp_pptx = tempfile.NamedTemporaryFile(suffix=".pptx", delete=False)
    temp_pptx.write(pptx_bytes)
    temp_pptx.close()
    
    temp_pdf = tempfile.NamedTemporaryFile(suffix=".pdf", delete=False)
    temp_pdf.close() # we just need the name
    
    powerpoint = None
    presentation = None
    try:
        # Initialize PowerPoint COM in background
        powerpoint = win32com.client.DispatchEx("PowerPoint.Application")
        
        abs_pptx = os.path.abspath(temp_pptx.name)
        abs_pdf = os.path.abspath(temp_pdf.name)
        
        presentation = powerpoint.Presentations.Open(abs_pptx, WithWindow=False)
        presentation.SaveAs(abs_pdf, 32) # 32 = PDF
        presentation.Close()
        
        with open(temp_pdf.name, "rb") as f:
            pdf_bytes = f.read()
            
        return pdf_bytes
    except Exception as e:
        print(f"Failed to convert PPTX to PDF via win32com: {e}")
        raise ValueError(f"Could not convert PPTX to PDF. Make sure PowerPoint is installed. Details: {e}")
    finally:
        if presentation is not None:
            try:
                presentation.Close()
            except Exception:
                pass
        if powerpoint is not None:
            try:
                powerpoint.Quit()
            except Exception:
                pass
        # Clean up temp files
        try:
            os.remove(temp_pptx.name)
            os.remove(temp_pdf.name)
        except Exception:
            pass

def defragment_paragraph(paragraph, placeholders):
    """
    Defragments python-pptx runs that have split placeholders
    (e.g., <<INTERNSHIP & LIVE PROJECT AREA>> might be split into multiple runs).
    Converts split runs into a single run so they can be replaced accurately.
    """
    for key in placeholders:
        keys_to_check = [key, key.replace("<<", "«").replace(">>", "»")]
        for k_check in keys_to_check:
            search_start = 0
            while True:
                p_text = "".join(run.text for run in paragraph.runs)
                start_idx = p_text.find(k_check, search_start)
                if start_idx == -1:
                    break

                # Map each character position to its run index
                run_map = []
                for run_idx, run in enumerate(paragraph.runs):
                    run_map.extend([run_idx] * len(run.text))

                end_idx = start_idx + len(k_check) - 1
                if end_idx >= len(run_map):
                    break

                # Get run indices that cover the placeholder
                run_indices = run_map[start_idx : end_idx + 1]
                first_run_idx = run_indices[0]
                last_run_idx = run_indices[-1]

                if first_run_idx == last_run_idx:
                    search_start = start_idx + len(k_check)
                    continue

                # Merge split runs
                combined_text = "".join(paragraph.runs[r_i].text for r_i in range(first_run_idx, last_run_idx + 1))
                paragraph.runs[first_run_idx].text = combined_text
                for r_i in range(first_run_idx + 1, last_run_idx + 1):
                    paragraph.runs[r_i].text = ""

                search_start = start_idx + len(k_check)

def text_frame_has_placeholders(text_frame, replacements) -> bool:
    """
    Returns True if the text frame contains any of the keys in replacements,
    or general QR placeholders.
    """
    text = text_frame.text
    for key in replacements:
        if key in text:
            return True
        guill_key = key.replace("<<", "«").replace(">>", "»")
        if guill_key in text:
            return True
    
    for qr_key in ("<<QR>>", "<<QR_CODE>>", "<<QRCODE>>", "«QR»", "«QR_CODE»", "«QRCODE»"):
        if qr_key in text:
            return True
            
    return False

def detect_certificate_title(slide) -> str:
    """
    Detects the certificate type based on the text contents of the slide shapes.
    Returns: 'Internship Certificate', 'Letter Of Recomandation', 'Experience Letter', or 'Certificate'.
    """
    for shape in slide.shapes:
        if shape.has_text_frame:
            text = shape.text_frame.text.lower()
            if "recommendation" in text or "recomandation" in text:
                return "Letter Of Recomandation"
            elif "experience certificate" in text or "experience letter" in text:
                return "Experience Letter"
            elif "internship" in text:
                return "Internship Certificate"
    
    # Fallback checks
    for shape in slide.shapes:
        if shape.has_text_frame:
            text = shape.text_frame.text.lower()
            if "certificate" in text:
                return "Certificate"
                
    return "Certificate"

def generate_certificate_from_pptx_bytes(pptx_bytes: bytes, replacements: dict, qr_bytes: bytes) -> tuple:
    from pptx import Presentation
    from pptx.util import Inches
    import tempfile
    
    # Save the input pptx bytes to a temp file
    temp_pptx = tempfile.NamedTemporaryFile(suffix=".pptx", delete=False)
    temp_pptx.write(pptx_bytes)
    temp_pptx.close()
    
    try:
        prs = Presentation(temp_pptx.name)
        slide = prs.slides[0]
        
        # Fields that should WRAP to next line instead of shrinking font
        WRAP_FIELDS = {"<<INTERNSHIP & LIVE PROJECT AREA>>", "<<PROJECT>>", "<<DOMAIN>>", "<<ROLE>>"}

        # 1. Process shapes and replace text
        for shape in list(slide.shapes):
            if shape.has_text_frame:
                text_frame = shape.text_frame
                combined_text = text_frame.text.strip()

                # Fix for "COPTERCODE" wrapping "E" to the next line in the header textbox
                if ("COPTERCODE" in combined_text or "COPTERCOD" in combined_text) and len(combined_text) < 15:
                    text_frame.word_wrap = False
                    shape.width = shape.width + Inches(0.5)

                # Skip text boxes that don't contain any placeholders at all to preserve formatting/alignment
                if not text_frame_has_placeholders(text_frame, replacements):
                    continue

                # Enable word wrap so long values flow to next line naturally
                text_frame.word_wrap = True

                # Defragment paragraph runs to resolve split placeholders
                placeholders_to_defrag = list(replacements.keys()) + ["<<QR>>", "<<QR_CODE>>", "<<QRCODE>>"]
                for paragraph in text_frame.paragraphs:
                    defragment_paragraph(paragraph, placeholders_to_defrag)

                combined_text = text_frame.text.strip()

                # Check for QR placeholder
                if "<<QR>>" in combined_text or "«QR»" in combined_text:
                    # Make the QR code larger (1.15 in x 1.15 in)
                    qr_w = Inches(1.15)
                    qr_h = Inches(1.15)
                    
                    # Center the QR image relative to the original <<QR>> placeholder textbox
                    qr_left = int(shape.left + (shape.width - qr_w) // 2)
                    qr_top = int(shape.top + (shape.height - qr_h) // 2)

                    # Remove placeholder shape
                    sp = shape._element
                    sp.getparent().remove(sp)

                    # Write QR bytes to a temp file to insert as picture
                    temp_qr = tempfile.NamedTemporaryFile(suffix=".png", delete=False)
                    temp_qr.write(qr_bytes)
                    temp_qr.close()

                    try:
                        slide.shapes.add_picture(temp_qr.name, qr_left, qr_top, width=qr_w, height=qr_h)
                    finally:
                        try:
                            os.remove(temp_qr.name)
                        except Exception:
                            pass
                    continue

                # Standard replacements on text runs
                for paragraph in text_frame.paragraphs:
                    for run in paragraph.runs:
                        for key, val in replacements.items():
                            has_match = False
                            actual_key = None

                            if key in run.text:
                                has_match = True
                                actual_key = key
                            else:
                                guill_key = key.replace("<<", "«").replace(">>", "»")
                                if guill_key in run.text:
                                    has_match = True
                                    actual_key = guill_key

                            if has_match:
                                # Standardize to Arial to prevent system font substitutions
                                run.font.name = "Arial"
                                
                                # For body/area fields: keep font size and let text wrap
                                # For short label fields (name, institution): allow mild shrinking
                                is_wrap_field = key in WRAP_FIELDS
                                if not is_wrap_field and run.font.size and val:
                                    length = len(val)
                                    limit = 20 if "NAME" in key else 30
                                    if length > limit:
                                        scale = limit / length
                                        scale = max(0.75, min(1.0, scale))
                                        run.font.size = int(run.font.size * scale)

                                run.text = run.text.replace(actual_key, val)

                                # Clean up visual hacks (multiple consecutive spaces) and fix missing comma spaces
                                if run.text:
                                    run.text = re.sub(r',([a-zA-Z])', r', \1', run.text)
                                    run.text = re.sub(r'\s{2,}', ' ', run.text)
                                
        # Save presentation back to same temp file
        prs.save(temp_pptx.name)
        
        # Detect certificate title from slide text
        cert_title = detect_certificate_title(slide)
        
        # Read the modified PPTX file bytes
        with open(temp_pptx.name, "rb") as f:
            modified_pptx_bytes = f.read()
            
        # Convert to PDF
        pdf_bytes = convert_pptx_to_pdf_bytes(modified_pptx_bytes)
        return pdf_bytes, cert_title
        
    finally:
        try:
            os.remove(temp_pptx.name)
        except Exception:
            pass



@app.get("/")
def read_root():
    return {"status": "healthy", "service": "Certificate Generator API"}


@app.post("/api/template/preview")
async def template_preview(
    template_file: UploadFile = File(...),
    excel_file: Optional[UploadFile] = File(None)
):
    """
    Accepts template PDF or PPTX and optional Excel sheet.
    Converts PPTX to PDF if necessary.
    Uploads PDF template to Supabase Storage bucket 'templates'.
    Extracts first page width and height in points.
    Renders first page as PNG.
    Uploads PNG to Supabase storage.
    Inserts a metadata record into templates table.
    Returns preview URL, page dimensions, and detected fields.
    """
    if not supabase:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Supabase client is not configured. Please set environment variables."
        )

    # Validate file format — PPTX only
    ext = os.path.splitext(template_file.filename)[1].lower()
    if ext != ".pptx":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Template must be a PPTX file. Please upload a PowerPoint (.pptx) file."
        )

    try:
        # Detect fields in Excel sheet if uploaded
        detected_fields = ["name", "college", "year"]
        if excel_file:
            try:
                excel_bytes = await excel_file.read()
                df = pd.read_excel(io.BytesIO(excel_bytes))
                df.columns = [str(col).strip().lower() for col in df.columns]
                
                # Check for optional columns in excel
                for col in df.columns:
                    if "department" in col or "dept" in col or "branch" in col:
                        if "department" not in detected_fields:
                            detected_fields.append("department")
                    elif "role" in col or "domain" in col:
                        if "role" not in detected_fields:
                            detected_fields.append("role")
                    elif "project" in col or "proj" in col or "area" in col:
                        if "project" not in detected_fields:
                            detected_fields.append("project")
                    elif "month" in col or "batch" in col:
                        if "month" not in detected_fields:
                            detected_fields.append("month")
                    elif "date" in col or "dt" in col:
                        if "date" not in detected_fields:
                            detected_fields.append("date")
            except Exception as e:
                print(f"Error parsing optional Excel columns in preview: {e}")

        raw_bytes = await template_file.read()
        if ext == ".pptx":
            try:
                pdf_bytes = convert_pptx_to_pdf_bytes(raw_bytes)
            except Exception as conv_err:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Failed to convert uploaded PPTX template to PDF: {conv_err}"
                )
        else:
            pdf_bytes = raw_bytes
        template_id = str(uuid.uuid4())

        # Save to Supabase Storage (private bucket 'templates')
        try:
            # If PPTX, save original PPTX file first
            if ext == ".pptx":
                pptx_path = f"{template_id}/template.pptx"
                supabase.storage.from_("templates").upload(
                    path=pptx_path,
                    file=raw_bytes,
                    file_options={"content-type": "application/vnd.openxmlformats-officedocument.presentationml.presentation"}
                )
                
            pdf_path = f"{template_id}/template.pdf"
            supabase.storage.from_("templates").upload(
                path=pdf_path,
                file=pdf_bytes,
                file_options={"content-type": "application/pdf"}
            )
        except Exception as upload_err:
            err_txt = str(upload_err)
            if 'row-level security' in err_txt.lower() or 'violates row' in err_txt.lower() or '403' in err_txt:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail=("Supabase Storage upload blocked by row-level security (RLS). "
                            "Ensure your backend is using the Supabase service_role key (SUPABASE_SERVICE_ROLE_KEY) "
                            "or make the 'templates' bucket writable by your backend. Do NOT expose the service role key to the frontend.")
                )
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to upload template assets to Supabase Storage: {upload_err}"
            )

        # Open PDF with PyMuPDF to extract dimensions and render page 1
        try:
            doc = fitz.open(stream=pdf_bytes, filetype="pdf")
            if len(doc) == 0:
                raise ValueError("The PDF contains no pages.")
            page = doc.load_page(0)
            width_pt = float(page.rect.width)
            height_pt = float(page.rect.height)

            # Render page 1 to PNG
            pix = page.get_pixmap(dpi=150)
            png_bytes = pix.tobytes("png")
        except Exception as pdf_err:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Failed to parse PDF and render preview: {pdf_err}"
            )

        # Upload preview PNG to templates bucket
        png_path = f"{template_id}/preview.png"
        try:
            supabase.storage.from_("templates").upload(
                path=png_path,
                file=png_bytes,
                file_options={"content-type": "image/png"}
            )
        except Exception as png_upload_err:
            err_txt = str(png_upload_err)
            if 'row-level security' in err_txt.lower() or 'violates row' in err_txt.lower() or '403' in err_txt:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail=("Supabase Storage upload blocked by row-level security (RLS). "
                            "Ensure your backend is using the Supabase service_role key (SUPABASE_SERVICE_ROLE_KEY) "
                            "or make the 'templates' bucket writable by your backend. Do NOT expose the service role key to the frontend.")
                )
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to upload preview image: {png_upload_err}"
            )

        # Generate a signed URL for the preview image so the frontend can display it
        # Private templates bucket needs a signed URL or can be accessed via backend proxy.
        # We will generate a signed URL valid for 7 days (604800 seconds)
        try:
            res = supabase.storage.from_("templates").create_signed_url(png_path, expires_in=604800)
            preview_image_url = res["signedURL"]
        except Exception as sign_err:
            # Fallback if signed URL generation fails, try public URL (if user configures bucket as public)
            preview_image_url = supabase.storage.from_("templates").get_public_url(png_path)

        # Get file public or private url for database
        file_url = supabase.storage.from_("templates").get_public_url(pdf_path)

        # Insert metadata record into 'templates' table
        # Use schema fields: template_pdf_url, preview_image_url, page_width_pt, page_height_pt
        # Provide sensible defaults for layout positions so the insert succeeds if the table
        # requires non-null jsonb columns. Admin can update layout via /api/template/layout.
        template_record = {
            "id": template_id,
            "template_pdf_url": file_url,
            "preview_image_url": preview_image_url,
            "page_width_pt": width_pt,
            "page_height_pt": height_pt,
            "name_pos": {"x": 0.5, "y": 0.5},
            "college_pos": {"x": 0.5, "y": 0.4},
            "batch_pos": {"x": 0.5, "y": 0.35},
            "qr_pos": {"x": 0.85, "y": 0.15},
            "qr_size": 0.12
        }
        try:
            supabase.table("templates").insert(template_record).execute()
        except Exception as db_err:
            err_txt = str(db_err)
            if 'row-level security' in err_txt.lower() or 'violates row' in err_txt.lower() or '403' in err_txt:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail=("Database insert blocked by row-level security (RLS). "
                            "Ensure your backend is configured with the Supabase service_role key (SUPABASE_SERVICE_ROLE_KEY) "
                            "and that it has permission to write to the 'templates' table. Do NOT expose the service role key to the frontend.")
                )
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to save template record in database: {db_err}"
            )

        return {
            "template_id": template_id,
            "preview_image_url": preview_image_url,
            "page_width_pt": width_pt,
            "page_height_pt": height_pt,
            "detected_fields": detected_fields
        }

    except HTTPException as he:
        raise he
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Unexpected error: {str(e)}"
        )


@app.post("/api/template/layout")
async def save_layout(payload: LayoutPayload):
    """
    Saves coordinate fractions to Supabase for the specified template.
    """
    if not supabase:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Supabase client is not configured."
        )

    try:
        data = {
            "name_pos": {"x": payload.name_pos.x, "y": payload.name_pos.y, "w": payload.name_pos.w, "h": payload.name_pos.h},
            "college_pos": {"x": payload.college_pos.x, "y": payload.college_pos.y, "w": payload.college_pos.w, "h": payload.college_pos.h},
            # Store year_pos in batch_pos column (no schema change needed)
            # and pack all extra field positions + font_settings as nested keys
            "batch_pos": {
                "x": payload.year_pos.x,
                "y": payload.year_pos.y,
                "w": payload.year_pos.w,
                "h": payload.year_pos.h,
                "department_pos": {"x": payload.department_pos.x, "y": payload.department_pos.y, "w": payload.department_pos.w, "h": payload.department_pos.h} if payload.department_pos else None,
                "role_pos": {"x": payload.role_pos.x, "y": payload.role_pos.y, "w": payload.role_pos.w, "h": payload.role_pos.h} if payload.role_pos else None,
                "project_pos": {"x": payload.project_pos.x, "y": payload.project_pos.y, "w": payload.project_pos.w, "h": payload.project_pos.h} if payload.project_pos else None,
                "month_pos": {"x": payload.month_pos.x, "y": payload.month_pos.y, "w": payload.month_pos.w, "h": payload.month_pos.h} if payload.month_pos else None,
                "date_pos": {"x": payload.date_pos.x, "y": payload.date_pos.y, "w": payload.date_pos.w, "h": payload.date_pos.h} if payload.date_pos else None,
                "font_settings": payload.font_settings or {},  # per-field font names
            },
            "qr_pos": {"x": payload.qr_pos.x, "y": payload.qr_pos.y},
            "qr_size": payload.qr_size
        }
        res = supabase.table("templates").update(data).eq("id", payload.template_id).execute()
        if not res.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Template with ID {payload.template_id} not found."
            )
        return {"status": "success", "message": "Layout configuration saved."}
    except HTTPException as he:
        raise he
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Database update failed: {str(e)}"
        )





@app.post("/api/generate")
async def generate_certificates(
    template_id: str = Form(...),
    excel_file: UploadFile = File(...)
):
    """
    Processes the details from Excel.
    For each row, generates a QR code and replaces placeholders in the template PDF.
    Saves PDF, inserts database record, and compiles excel results sheet.
    """
    if not supabase:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Supabase client is not configured."
        )

    # Validate Excel format
    if not excel_file.filename.lower().endswith((".xlsx", ".xls")):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Please upload a valid Excel file (.xlsx or .xls)."
        )

    # 1. Fetch template metadata
    try:
        template_res = supabase.table("templates").select("*").eq("id", template_id).execute()
        if not template_res.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Template with ID {template_id} not found."
            )
        template_data = template_res.data[0]
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch template metadata: {e}"
        )

    # 2. Download original template (PPTX if available, otherwise fallback to PDF)
    use_pptx_pipeline = False
    template_pptx_bytes = None
    template_pdf_bytes = None
    
    try:
        pptx_path = f"{template_id}/template.pptx"
        template_pptx_bytes = supabase.storage.from_("templates").download(pptx_path)
        use_pptx_pipeline = True
        print(f"Using PPTX pipeline for template ID {template_id}")
    except Exception:
        try:
            pdf_path = f"{template_id}/template.pdf"
            template_pdf_bytes = supabase.storage.from_("templates").download(pdf_path)
            print(f"Using PDF fallback pipeline for template ID {template_id}")
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to download original PDF template: {e}"
            )

    # 3. Read and parse Excel file
    try:
        excel_bytes = await excel_file.read()
        df = pd.read_excel(io.BytesIO(excel_bytes))
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to parse Excel file: {e}"
        )

    # Clean and validate Excel columns
    df.columns = [str(col).strip().lower() for col in df.columns]
    col_mapping = {}
    for col in df.columns:
        if "name" in col:
            col_mapping["name"] = col
        elif "college" in col or "university" in col or "institution" in col:
            col_mapping["college"] = col
        elif "year" in col or "class" in col:
            col_mapping["year"] = col
        elif "department" in col or "dept" in col or "branch" in col:
            col_mapping["department"] = col
        elif "role" in col or "domain" in col:
            col_mapping["role"] = col
        elif "project" in col or "proj" in col or "area" in col:
            col_mapping["project"] = col
        elif "month" in col or "batch" in col:
            col_mapping["month"] = col
        elif "date" in col or "dt" in col:
            col_mapping["date"] = col

    missing_cols = []
    if "name" not in col_mapping:
        missing_cols.append("Name")
    if "college" not in col_mapping:
        missing_cols.append("College")
    if "year" not in col_mapping:
        missing_cols.append("Year")
    if "department" not in col_mapping:
        missing_cols.append("Department")

    if missing_cols:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Excel file is missing required columns: {', '.join(missing_cols)}"
        )

    # 4. Generate Certificates row-by-row
    rows_results = []
    output_rows = []

    for index, row in df.iterrows():
        try:
            def _cell_str(r, key):
                if key not in col_mapping:
                    return ""
                v = r.get(col_mapping[key], "")
                if pd.isna(v):
                    return ""
                if isinstance(v, (pd.Timestamp,)):
                    return str(v.date())
                return str(v).strip()

            name_val = _cell_str(row, "name")
            college_val = _cell_str(row, "college")
            year_val = _cell_str(row, "year")
            department_val = _cell_str(row, "department")
            role_val = _cell_str(row, "role")
            project_val = _cell_str(row, "project")
            month_val = _cell_str(row, "month")
            date_val = _cell_str(row, "date")

            # Skip empty rows
            if not name_val or name_val.lower() == "nan":
                continue

            # Generate a unique UUID for the certificate
            cert_code = str(uuid.uuid4())

            # Check if we should use the high-fidelity PPTX pipeline
            row_use_pptx_pipeline = use_pptx_pipeline
            merged_pdf_bytes = None

            if row_use_pptx_pipeline:
                # 1. Setup replacements dictionary
                replacements = {
                    "<<NAME>>": name_val,
                    "<<INSTITUTION>>": college_val,
                    "<<COLLEGE>>": college_val,
                    "<<YEAR>>": year_val,
                    "<<DEPARTMENT>>": department_val,
                    "<<DOMAIN>>": role_val,
                    "<<ROLE>>": role_val,
                    "<<PROJECT>>": project_val,
                    "<<INTERNSHIP & LIVE PROJECT AREA>>": project_val,
                    "<<BATCH>>": month_val,
                    "<<BATCH >>": month_val,
                    "<<DATE>>": date_val,
                    "<<DT>>": date_val
                }
                
                # 2. Generate QR code bytes
                qr_url = build_verify_url(cert_code)
                qr = qrcode.QRCode(
                    version=1,
                    error_correction=qrcode.constants.ERROR_CORRECT_H,
                    box_size=12,
                    border=2
                )
                qr.add_data(qr_url)
                qr.make(fit=True)
                from qrcode.image.pil import PilImage
                qr_img = qr.make_image(image_factory=PilImage, fill_color="black", back_color="white")
                qr_io = io.BytesIO()
                qr_img.save(qr_io, format="PNG")
                qr_bytes = qr_io.getvalue()
                
                # 3. Generate PDF using PPTX pipeline
                try:
                    merged_pdf_bytes, cert_title = generate_certificate_from_pptx_bytes(template_pptx_bytes, replacements, qr_bytes)
                except Exception as pptx_err:
                    print(f"PPTX pipeline execution failed for row: {pptx_err}")
                    row_use_pptx_pipeline = False
            
            if not row_use_pptx_pipeline:
                # Fallback to PyMuPDF drawing logic on the PDF template
                doc = fitz.open(stream=template_pdf_bytes, filetype="pdf")
                
                # Detect certificate title from template text
                full_text = ""
                for page in doc:
                    full_text += page.get_text()
                
                cert_title = "Certificate"
                full_text_lower = full_text.lower()
                if "recommendation" in full_text_lower or "recomandation" in full_text_lower:
                    cert_title = "Letter Of Recomandation"
                elif "experience certificate" in full_text_lower or "experience letter" in full_text_lower:
                    cert_title = "Experience Letter"
                elif "internship" in full_text_lower:
                    cert_title = "Internship Certificate"
                
                # Define all search keys for each field
                field_placeholders = {
                    "name": ["<<NAME>>"],
                    "college": ["<<COLLEGE>>", "<<INSTITUTION>>", "<<UNIVERSITY>>"],
                    "year": ["<<YEAR>>", "<<CLASS>>"],
                    "department": ["<<DEPARTMENT>>", "<<DEPT>>", "<<BRANCH>>"],
                    "role": ["<<ROLE>>", "<<DOMAIN>>", "<<FIELD>>"],
                    "project": ["<<PROJECT>>", "<<INTERNSHIP & LIVE PROJECT AREA>>", "<<AREA>>"],
                    "month": ["<<MONTH>>", "<<BATCH>>", "<<BATCH >>"],
                    "date": ["<<DATE>>", "<<DT>>"]
                }
                
                for page in doc:
                    # Map of exact keys found on the page to their values and standard field name
                    active_placeholders = {}
                    
                    for field, keys in field_placeholders.items():
                        val = ""
                        if field == "name": val = name_val
                        elif field == "college": val = college_val
                        elif field == "year": val = year_val
                        elif field == "department": val = department_val
                        elif field == "role": val = role_val
                        elif field == "project": val = project_val
                        elif field == "month": val = month_val
                        elif field == "date": val = date_val
                        
                        for key in keys:
                            # check standard format <<KEY>>
                            rects = page.search_for(key)
                            if rects:
                                active_placeholders[key] = {"val": val, "field": field}
                            else:
                                # check guillemets format «KEY»
                                guill_key = key.replace("<<", "«").replace(">>", "»")
                                rects = page.search_for(guill_key)
                                if rects:
                                    active_placeholders[guill_key] = {"val": val, "field": field}
    
                    # Register fonts on the page if they exist
                    fonts_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "fonts")
                    font_paths = {
                        "canvasans-regular": os.path.join(fonts_dir, "CanvaSans-Regular.ttf"),
                        "canvasans-bold": os.path.join(fonts_dir, "CanvaSans-Bold.ttf"),
                        "codecpro-bold": os.path.join(fonts_dir, "CodecPro-Bold.ttf"),
                        "codecpro-regular": os.path.join(fonts_dir, "CodecPro-Regular.ttf")
                    }
                    
                    registered_fonts = {}
                    for name, path in font_paths.items():
                        if os.path.exists(path):
                            try:
                                page.insert_font(fontname=name, fontfile=path)
                                registered_fonts[name] = True
                            except Exception as e:
                                print(f"Failed to register font {name}: {e}")
    
                    # 1. Scan spans to extract styling (font size, color, font family) of placeholders before redacting
                    styles = {}
                    blocks = page.get_text("dict")["blocks"]
                    for block in blocks:
                        if "lines" in block:
                            for line in block["lines"]:
                                for span in line["spans"]:
                                    text = span["text"].strip()
                                    for key in active_placeholders:
                                        if key.lower() in text.lower():
                                            color_int = span["color"]
                                            r = ((color_int >> 16) & 255) / 255.0
                                            g = ((color_int >> 8) & 255) / 255.0
                                            b = (color_int & 255) / 255.0
                                            styles[key] = {
                                                "size": span["size"],
                                                "color": (r, g, b),
                                                "font": span["font"]
                                            }
    
                    # 2. Search and save coordinates of all occurrences of placeholders before redacting
                    replacements_to_apply = []
                    for key, data in active_placeholders.items():
                        rects = page.search_for(key)
                        for r in rects:
                            replacements_to_apply.append({
                                "rect": r,
                                "val": data["val"],
                                "field": data["field"],
                                "key": key
                            })
    
                    # QR code replacements
                    qr_rects = []
                    for qr_key in ("<<QR>>", "<<QR_CODE>>", "<<QRCODE>>", "«QR»", "«QR_CODE»", "«QRCODE»"):
                        rects = page.search_for(qr_key)
                        if rects:
                            qr_rects = rects
                            break
    
                    # 3. Add redactions for all placeholders found
                    for rep in replacements_to_apply:
                        page.add_redact_annot(rep["rect"])
                    for r in qr_rects:
                        page.add_redact_annot(r)
                    
                    # Apply redactions, keeping background graphics & images
                    page.apply_redactions(images=0, graphics=0)
    
                    # 4. Insert replacement text at baseline coordinates
                    for rep in replacements_to_apply:
                        rect = rep["rect"]
                        val = rep["val"]
                        field = rep["field"]
                        key = rep["key"]
                        if val:
                            style = styles.get(key, {"size": 12, "color": (0, 0, 0)})
                            
                            # Determine fontname dynamically from original placeholder font
                            orig_font = style.get("font", "").lower()
                            if "+" in orig_font:
                                orig_font = orig_font.split("+")[1]
                            
                            fontname = "helv"
                            if "canvasans-bold" in orig_font and "canvasans-bold" in registered_fonts:
                                fontname = "canvasans-bold"
                            elif "canvasans-regular" in orig_font and "canvasans-regular" in registered_fonts:
                                fontname = "canvasans-regular"
                            elif "codecpro-bold" in orig_font and "codecpro-bold" in registered_fonts:
                                fontname = "codecpro-bold"
                            elif "codecpro-regular" in orig_font and "codecpro-regular" in registered_fonts:
                                fontname = "codecpro-regular"
                            elif field == "name":
                                fontname = "hebo"  # standard fallback for bold name
                            elif "bold" in orig_font:
                                fontname = "hebo"
                            
                            # Auto-scale font size if text is too long to fit on the page
                            original_size = style.get("size", 12)
                            max_width = page.rect.width - rect.x0 - 30  # 30pt right margin
                            
                            # Calculate exact text width using font metrics
                            try:
                                text_width = fitz.get_text_length(val, fontname=fontname, fontsize=original_size)
                            except Exception:
                                # Fallback estimation if font metrics fail
                                text_width = len(val) * original_size * 0.55
                                
                            fontsize = original_size
                            if text_width > max_width and max_width > 50:
                                fontsize = original_size * (max_width / text_width)
                                fontsize = max(8.0, fontsize)  # Cap minimum size to 8pt
                            
                            # Calculate baseline Y coordinate dynamically (descender space is roughly 18% of the bounding box height)
                            baseline_y = rect.y1 - (rect.y1 - rect.y0) * 0.18
                            point = fitz.Point(rect.x0, baseline_y)
                            
                            page.insert_text(
                                point,
                                val,
                                fontname=fontname,
                                fontsize=fontsize,
                                color=style["color"]
                            )
    
                    # 5. Insert QR Code
                    for r in qr_rects:
                        qr_url = build_verify_url(cert_code)
                        qr = qrcode.QRCode(version=1, box_size=10, border=1)
                        qr.add_data(qr_url)
                        qr.make(fit=True)
                        from qrcode.image.pil import PilImage
                        qr_img = qr.make_image(image_factory=PilImage, fill_color="black", back_color="white")
                        
                        qr_io = io.BytesIO()
                        qr_img.save(qr_io, format="PNG")
                        qr_bytes = qr_io.getvalue()
                        
                        page.insert_image(r, stream=qr_bytes)
    
                # Get final PDF bytes
                merged_pdf_bytes = doc.tobytes()
                doc.close()

            # Upload generated PDF to Supabase Storage ('certificates' bucket)
            safe_name = re.sub(r"[^A-Za-z0-9_-]", "_", name_val.strip())[:40]
            safe_title = cert_title.replace(" ", "_")
            pdf_filename = f"{safe_name}_({safe_title})_{cert_code}.pdf"
            supabase.storage.from_("certificates").upload(
                path=pdf_filename,
                file=merged_pdf_bytes,
                file_options={"content-type": "application/pdf", "upsert": "true"}
            )

            pdf_url = supabase.storage.from_("certificates").get_public_url(pdf_filename)

            # Save certificate to Supabase Database
            issue_date_val = None
            if date_val:
                try:
                    # Clean and parse using pandas
                    clean_dt = date_val.strip()
                    parsed_dt = pd.to_datetime(clean_dt, errors='raise')
                    issue_date_val = parsed_dt.date().isoformat()
                except Exception:
                    # Fallback to dateutil parser (handles formats like 20.6.2026 with dayfirst)
                    try:
                        from dateutil import parser
                        parsed_dt = parser.parse(clean_dt, dayfirst=True)
                        issue_date_val = parsed_dt.date().isoformat()
                    except Exception:
                        issue_date_val = None


            cert_data = {
                "cert_code": cert_code,
                "name": name_val,
                "college": college_val,
                "batch": year_val,         # stored in batch column for backwards compat
                "department": department_val,
                "role": role_val,
                "project": project_val,    # Requires DB column addition
                "month": month_val,        # Requires DB column addition
                "issue_date": issue_date_val,
                "status": "active",
                "pdf_url": pdf_url,
                "template_id": template_id
            }
            # Try upserting; fallback without new columns if DB migration is not run yet
            try:
                supabase.table("certificates").upsert(cert_data, on_conflict="cert_code").execute()
            except Exception as db_col_err:
                err_str = str(db_col_err).lower()
                if "project" in err_str or "month" in err_str or "column" in err_str:
                    fallback_data = {k: v for k, v in cert_data.items() if k not in ("project", "month")}
                    supabase.table("certificates").upsert(fallback_data, on_conflict="cert_code").execute()
                else:
                    raise

            # Success response details
            rows_results.append({
                "name": name_val,
                "college": college_val,
                "year": year_val,
                "month": month_val,
                "department": department_val,
                "cert_code": cert_code,
                "pdf_url": pdf_url,
                "status": "active"
            })

            output_rows.append({
                "cert_code": cert_code,
                "name": name_val,
                "college": college_val,
                "year": year_val,
                "department": department_val,
                "role": role_val,
                "project": project_val,
                "month": month_val,
                "date": date_val
            })

        except Exception as row_error:
            # Log error and continue the batch processing
            print(f"Row {index} failed: {row_error}")
            rows_results.append({
                "name": str(row.get(col_mapping.get("name", ""), "Unknown")),
                "college": str(row.get(col_mapping.get("college", ""), "Unknown")),
                "year": str(row.get(col_mapping.get("year", ""), "Unknown")),
                "department": str(row.get(col_mapping.get("department", ""), "Unknown")),
                "cert_code": None,
                "pdf_url": None,
                "status": "error",
                "error": str(row_error)
            })

    # 5. Create final results Excel file
    excel_download_url = ""
    if output_rows:
        try:
            out_df = pd.DataFrame(output_rows)
            out_df = out_df[["cert_code", "name", "college", "year", "department", "role", "project", "month", "date"]]
            out_df.columns = ["Certificate Code", "Name", "College", "Year", "Department", "Role", "Project", "Month", "Date"]
            
            result_excel_io = io.BytesIO()
            out_df.to_excel(result_excel_io, index=False, engine='openpyxl')
            result_excel_bytes = result_excel_io.getvalue()

            results_filename = f"results_{template_id}_{uuid.uuid4().hex[:8]}.xlsx"
            supabase.storage.from_("certificates").upload(
                path=results_filename,
                file=result_excel_bytes,
                file_options={"content-type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"}
            )
            excel_download_url = supabase.storage.from_("certificates").get_public_url(results_filename)
        except Exception as xl_err:
            print(f"Failed to create and upload results Excel file: {xl_err}")

    return {
        "excel_download_url": excel_download_url,
        "rows": rows_results
    }


@app.get("/api/certificates/{cert_code}")
def lookup_certificate(cert_code: str):
    """
    Looks up details of a certificate from database (supports case-insensitive matching).
    """
    if not supabase:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Supabase client is not configured."
        )

    try:
        # Try exact match first
        res = supabase.table("certificates").select("*").eq("cert_code", cert_code).execute()
        if not res.data:
            # Fallback to uppercase
            res = supabase.table("certificates").select("*").eq("cert_code", cert_code.upper()).execute()
        if not res.data:
            # Fallback to lowercase
            res = supabase.table("certificates").select("*").eq("cert_code", cert_code.lower()).execute()

        if not res.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Certificate with code {cert_code} not found."
            )
        return res.data[0]
    except HTTPException as he:
        raise he
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Database lookup failed: {str(e)}"
        )


@app.post("/api/certificates/{cert_code}/revoke")
def revoke_certificate(cert_code: str, reason: Optional[str] = None):
    """
    Admin-only command to revoke a certificate.
    Sets status = 'revoked'.
    """
    if not supabase:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Supabase client is not configured."
        )

    try:
        update_data = {
            "status": "revoked",
            "revoked_at": datetime.utcnow().isoformat()
        }
        if reason:
            update_data["revoke_reason"] = reason

        # Find case-insensitive target code
        target_code = cert_code
        check_res = supabase.table("certificates").select("cert_code").eq("cert_code", cert_code).execute()
        if not check_res.data:
            check_res_upper = supabase.table("certificates").select("cert_code").eq("cert_code", cert_code.upper()).execute()
            if check_res_upper.data:
                target_code = cert_code.upper()
            else:
                check_res_lower = supabase.table("certificates").select("cert_code").eq("cert_code", cert_code.lower()).execute()
                if check_res_lower.data:
                    target_code = cert_code.lower()

        res = supabase.table("certificates").update(update_data).eq("cert_code", target_code).execute()
        if not res.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Certificate with code {cert_code} not found."
            )
        return {"status": "success", "message": f"Certificate {target_code} revoked successfully."}
    except HTTPException as he:
        raise he
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Database update failed: {str(e)}"
        )


if __name__ == "__main__":
    import uvicorn

    port = int(os.getenv("PORT", 5000))
    # Bind to 0.0.0.0 so the dev server is reachable from the host machine
    # Use import string so automatic reload works when running `python app.py`
    uvicorn.run("app:app", host="0.0.0.0", port=port, reload=True)
