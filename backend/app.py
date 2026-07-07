import io
import os
import uuid
import re
import urllib.request
import pandas as pd
from typing import Dict, List, Optional
from datetime import datetime
from fastapi import FastAPI, UploadFile, File, Form, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv

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


@app.get("/")
def read_root():
    return {"status": "healthy", "service": "Certificate Generator API"}


@app.post("/api/template/preview")
async def template_preview(
    template_file: UploadFile = File(...),
    excel_file: Optional[UploadFile] = File(None)
):
    """
    Accepts template PDF and optional Excel sheet.
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

    # Validate file format
    if not template_file.filename.lower().endswith(".pdf"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Template must be a PDF file."
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

        pdf_bytes = await template_file.read()
        template_id = str(uuid.uuid4())

        # Save to Supabase Storage (private bucket 'templates')
        pdf_path = f"{template_id}/template.pdf"
        try:
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
                detail=f"Failed to upload PDF template to Supabase Storage: {upload_err}"
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
    For each row, generates a QR code and positions text overlays.
    Merges them onto the template, saves PDF, inserts database record.
    Generates a download link for a final compiled Excel results list.
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

    # 1. Fetch template & layout metadata
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

    # Unpack position dicts; fall back to sensible defaults for w/h for old data
    def _pos(d: Optional[dict], default_x=0.5, default_y=0.5, default_w=0.30, default_h=0.05):
        if not d:
            return None
        return {
            "x": d.get("x", default_x),
            "y": d.get("y", default_y),
            "w": d.get("w", default_w),
            "h": d.get("h", default_h),
        }

    name_pos    = _pos(template_data.get("name_pos"),    0.5, 0.45)
    college_pos = _pos(template_data.get("college_pos"), 0.5, 0.55)
    batch_pos_data = template_data.get("batch_pos") or {}

    year_pos = {
        "x": batch_pos_data.get("x", 0.5),
        "y": batch_pos_data.get("y", 0.65),
        "w": batch_pos_data.get("w", 0.20),
        "h": batch_pos_data.get("h", 0.05),
    } if isinstance(batch_pos_data, dict) else _pos(None)

    department_pos = _pos(batch_pos_data.get("department_pos")) if isinstance(batch_pos_data, dict) else None
    role_pos       = _pos(batch_pos_data.get("role_pos"))       if isinstance(batch_pos_data, dict) else None
    project_pos    = _pos(batch_pos_data.get("project_pos"))    if isinstance(batch_pos_data, dict) else None
    month_pos      = _pos(batch_pos_data.get("month_pos"))      if isinstance(batch_pos_data, dict) else None
    date_pos       = _pos(batch_pos_data.get("date_pos"))       if isinstance(batch_pos_data, dict) else None
    font_settings: Dict[str, str] = (batch_pos_data.get("font_settings") or {}) if isinstance(batch_pos_data, dict) else {}

    qr_pos = template_data.get("qr_pos")
    qr_size = template_data.get("qr_size")

    # Validate layout has been saved
    if not all([name_pos, college_pos, year_pos, qr_pos, qr_size is not None]):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Template layout coordinates are incomplete. Please save layout first."
        )

    width_pt  = template_data.get("page_width_pt") or template_data.get("width_pt")
    height_pt = template_data.get("page_height_pt") or template_data.get("height_pt")

    # 2. Download original template PDF from storage
    try:
        pdf_path = f"{template_id}/template.pdf"
        template_pdf_bytes = supabase.storage.from_("templates").download(pdf_path)
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
    # Accepts: NAME, DEPARTMENT, YEAR, COLLEGE, ROLE, PROJECT, MONTH, DATE
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
    output_rows = []  # For final excel: cert_code, name, college, batch

    # Cache for batch counters to avoid querying DB repeatedly for the same batch
    batch_counters = {}

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

            # Create QR code
            qr_url = build_verify_url(cert_code)
            qr = qrcode.QRCode(version=1, box_size=10, border=1)
            qr.add_data(qr_url)
            qr.make(fit=True)
            
            from qrcode.image.pil import PilImage
            qr_img = qr.make_image(image_factory=PilImage, fill_color="black", back_color="white")
            pil_img = qr_img.get_image()

            qr_io = io.BytesIO()
            pil_img.save(qr_io, format="PNG")
            qr_io.seek(0)
            qr_reader = ImageReader(qr_io)

            # Draw ReportLab Overlay
            overlay_io = io.BytesIO()
            can = canvas.Canvas(overlay_io, pagesize=(width_pt, height_pt))

            # Render text overlays using per-field fonts and auto-sized font-size
            # Resolve per-field fonts (downloads TTF from Google Fonts on first use)
            f_name     = get_reportlab_font(font_settings.get("name",       "Helvetica-Bold"))
            f_college  = get_reportlab_font(font_settings.get("college",    "Helvetica"))
            f_year     = get_reportlab_font(font_settings.get("year",       "Helvetica"))
            f_dept     = get_reportlab_font(font_settings.get("department", "Helvetica"))
            f_role     = get_reportlab_font(font_settings.get("role",       "Helvetica"))
            f_project  = get_reportlab_font(font_settings.get("project",    "Helvetica"))
            f_month    = get_reportlab_font(font_settings.get("month",      "Helvetica"))
            f_date     = get_reportlab_font(font_settings.get("date",       "Helvetica"))

            def draw_field(pos: Optional[dict], text: str, font: str) -> None:
                """Draw text left-aligned at the left edge of the stored bounding-box position."""
                if not pos or not text:
                    return
                bw = pos.get("w", 0.30) * width_pt
                bh = pos.get("h", 0.05) * height_pt
                cx = pos["x"] * width_pt          # x is already the center fraction
                cy = (1 - pos["y"]) * height_pt   # flip y for PDF coordinates
                fs = calc_pdf_font_size(text, font, bw, bh)
                can.setFont(font, fs)
                lx = cx - (bw / 2)
                ly = cy - (bh / 2) + 2.0
                can.drawString(lx, ly, text)

            draw_field(name_pos,    name_val,       f_name)
            draw_field(college_pos, college_val,    f_college)
            draw_field(year_pos,    year_val,       f_year)
            draw_field(department_pos, department_val, f_dept)
            draw_field(role_pos,    role_val,       f_role)
            draw_field(project_pos, project_val,    f_project)
            draw_field(month_pos,   month_val,      f_month)
            draw_field(date_pos,    date_val,       f_date)

            # Render QR overlay
            qr_x = qr_pos["x"] * width_pt
            qr_size_pt = qr_size * width_pt
            qr_y = (1 - qr_pos["y"]) * height_pt - qr_size_pt
            can.drawImage(qr_reader, qr_x, qr_y, width=qr_size_pt, height=qr_size_pt)

            can.save()
            overlay_io.seek(0)

            # Merge PDF overlay with original
            template_reader = PdfReader(io.BytesIO(template_pdf_bytes))
            overlay_reader = PdfReader(overlay_io)
            
            writer = PdfWriter()
            template_page = template_reader.pages[0]
            overlay_page = overlay_reader.pages[0]
            
            template_page.merge_page(overlay_page)
            writer.add_page(template_page)

            # Add remaining pages
            for i in range(1, len(template_reader.pages)):
                writer.add_page(template_reader.pages[i])

            merged_pdf_io = io.BytesIO()
            writer.write(merged_pdf_io)
            merged_pdf_bytes = merged_pdf_io.getvalue()

            # Upload generated PDF to Supabase Storage ('certificates' bucket)
            pdf_filename = f"{cert_code}.pdf"
            supabase.storage.from_("certificates").upload(
                path=pdf_filename,
                file=merged_pdf_bytes,
                file_options={"content-type": "application/pdf", "upsert": "true"}
            )

            pdf_url = supabase.storage.from_("certificates").get_public_url(pdf_filename)

            # Save certificate to Supabase Database
            # Map date -> issue_date to match schema
            issue_date_val = None
            try:
                if date_val:
                    issue_date_val = datetime.fromisoformat(date_val).date().isoformat()
            except Exception:
                issue_date_val = date_val or None

            cert_data = {
                "cert_code": cert_code,
                "name": name_val,
                "college": college_val,
                "batch": year_val,         # stored in batch column for backwards compat
                "department": department_val,
                "role": role_val,
                "project": project_val,    # NEW column — requires DB migration
                "month": month_val,        # NEW column — requires DB migration
                "issue_date": issue_date_val,
                "status": "active",
                "pdf_url": pdf_url,
                "template_id": template_id
            }
            # Try upserting; specify on_conflict="cert_code" to handle existing records
            try:
                supabase.table("certificates").upsert(cert_data, on_conflict="cert_code").execute()
            except Exception as db_col_err:
                err_str = str(db_col_err).lower()
                if "project" in err_str or "month" in err_str or "column" in err_str:
                    # Fallback: upsert without new columns if migration not run yet
                    fallback_data = {k: v for k, v in cert_data.items() if k not in ("project", "month")}
                    supabase.table("certificates").upsert(fallback_data, on_conflict="cert_code").execute()
                else:
                    raise

            # Success response details
            rows_results.append({
                "name": name_val,
                "college": college_val,
                "year": year_val,
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
