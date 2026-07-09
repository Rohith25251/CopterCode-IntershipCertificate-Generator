import io
import os
import uuid
import re
import urllib.request
import tempfile
import pandas as pd
from typing import Dict, List, Optional
from datetime import datetime
from fastapi import FastAPI, UploadFile, File, Form, HTTPException, status, Response, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

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


BACKEND_BASE_URL = os.getenv("BACKEND_BASE_URL", "http://localhost:5000").strip()


def send_email_notification(
    to_email: str,
    intern_name: str,
    batch_title: str,
    certificates: List[Dict[str, str]],
    intern_id: str
):
    smtp_server = os.getenv("SMTP_SERVER")
    smtp_port = os.getenv("SMTP_PORT", "587")
    smtp_username = os.getenv("SMTP_USERNAME")
    smtp_password = os.getenv("SMTP_PASSWORD")
    smtp_from_email = os.getenv("SMTP_FROM_EMAIL")
    smtp_from_name = os.getenv("SMTP_FROM_NAME", "CopterCode Team")

    if not smtp_server or not smtp_username or not smtp_password or not smtp_from_email:
        print("WARNING: SMTP credentials not fully configured. Skipping email dispatch.")
        return False

    try:
        portal_link = f"https://coptercode-website.vercel.app/intern-portal?id={intern_id}"

        msg = MIMEMultipart("alternative")
        msg["Subject"] = "Congratulations on Successfully Completing Your Internship at CopterCode"
        msg["From"] = f"{smtp_from_name} <{smtp_from_email}>"
        msg["To"] = to_email

        cert_items_html = ""
        for cert in certificates:
            cert_items_html += f"<li><strong>{cert['label']}</strong></li>"

        html_content = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Congratulations from CopterCode</title>
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; color: #1e293b; margin: 0; padding: 0; -webkit-font-smoothing: antialiased;">
            <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #f8fafc; padding: 40px 0;">
                <tr>
                    <td align="center">
                        <table border="0" cellpadding="0" cellspacing="0" width="600" style="background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05), 0 2px 4px -1px rgba(0,0,0,0.035); border: 1px solid #e2e8f0;">
                            
                            <!-- Header / B&W Logo -->
                            <tr>
                                <td align="center" style="background-color: #ffffff; padding: 32px 24px 24px 24px;">
                                    <img src="https://copter-code-intership-certificate-g.vercel.app/coptercode-logo-bw.svg" alt="CopterCode Logo" style="height: 54px; width: auto; display: block;" />
                                </td>
                            </tr>
                            
                            <!-- Hero Image -->
                            <tr>
                                <td style="padding: 0 24px;">
                                    <img src="https://copter-code-intership-certificate-g.vercel.app/hero-img.jpg" alt="CopterCode Team" style="width: 100%; height: auto; display: block; border-radius: 12px; object-fit: cover;" />
                                </td>
                            </tr>
                            
                            <!-- Main Content -->
                            <tr>
                                <td style="padding: 36px 36px 24px 36px;">
                                    <h2 style="font-size: 16px; font-weight: 700; color: #0f172a; margin: 0 0 16px 0;">Greetings from CopterCode!</h2>
                                    
                                    <p style="font-size: 14px; line-height: 1.6; color: #475569; margin: 0 0 18px 0;">
                                        We are pleased to inform you that you have successfully completed the one-month internship program at <strong>CopterCode</strong>. Your dedication, hard work, and enthusiasm throughout the program have been truly commendable.
                                    </p>
                                    
                                    <p style="font-size: 14px; line-height: 1.6; color: #475569; margin: 0 0 18px 0;">
                                        As a token of your accomplishments, please find attached the following documents for your reference and future endeavors:
                                    </p>
                                    
                                    <!-- Bullet list styled inside a neat callout card -->
                                    <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #f1f5f9; border-radius: 12px; margin-bottom: 24px;">
                                        <tr>
                                            <td style="padding: 18px 24px;">
                                                <ul style="margin: 0; padding: 0 0 0 20px; font-size: 14px; line-height: 1.8; color: #334155; font-weight: bold;">
                                                    <li style="margin-bottom: 6px;">Internship Certificate</li>
                                                    <li style="margin-bottom: 6px;">Letter of Recommendation</li>
                                                    <li style="margin-bottom: 0;">Experience Letter</li>
                                                </ul>
                                            </td>
                                        </tr>
                                    </table>
                                    
                                    <!-- Download CTA Button -->
                                    <table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin: 32px 0;">
                                        <tr>
                                            <td align="center">
                                                <a href="{portal_link}" target="_blank" style="background-color: #0f172a; color: #ffffff !important; text-decoration: none; font-size: 14px; font-weight: bold; padding: 14px 32px; border-radius: 8px; display: inline-block; letter-spacing: 0.5px; box-shadow: 0 4px 12px rgba(15, 23, 42, 0.15);">
                                                    Download Certificate(s)
                                                </a>
                                            </td>
                                        </tr>
                                    </table>
                                    
                                    <p style="font-size: 14px; line-height: 1.6; color: #475569; margin: 0 0 18px 0;">
                                        We extend our heartfelt congratulations and best wishes for your future career. We are confident that the skills and knowledge you have gained here will serve you well in all your professional pursuits.
                                    </p>
                                    
                                    <p style="font-size: 14px; line-height: 1.6; color: #475569; margin: 0 0 20px 0;">
                                        Please feel free to stay in touch with us for any guidance or opportunities. We look forward to seeing you achieve great success ahead.
                                    </p>
                                </td>
                            </tr>
                            
                            <!-- Premium B&W Signature & Footer -->
                            <tr>
                                <td style="background-color: #0f172a; padding: 36px; color: #f8fafc; font-size: 13px; line-height: 1.6; border-bottom-left-radius: 15px; border-bottom-right-radius: 15px;">
                                    <table border="0" cellpadding="0" cellspacing="0" width="100%">
                                        <tr>
                                            <!-- Left Signature details -->
                                            <td width="55%" valign="top">
                                                <p style="margin: 0; font-weight: bold; font-size: 14px; color: #ffffff;">Warm regards,</p>
                                                <p style="margin: 2px 0 16px 0; font-weight: 500; color: #94a3b8;">Team CopterCode</p>
                                                
                                                <p style="margin: 0; color: #cbd5e1; font-size: 12px;">
                                                    ✉️ <a href="mailto:hr@coptercode.co.in" style="color: #38bdf8 !important; text-decoration: none;">hr@coptercode.co.in</a><br>
                                                    🌐 <a href="https://www.coptercode.co.in/" target="_blank" style="color: #38bdf8 !important; text-decoration: none;">www.coptercode.co.in</a>
                                                </p>
                                            </td>
                                            
                                            <!-- Right Contact & Socials details -->
                                            <td width="45%" align="right" valign="top" style="border-left: 1px solid #334155; padding-left: 24px;">
                                                <p style="margin: 0; font-weight: bold; color: #ffffff; font-size: 12px;">Best regards,</p>
                                                <p style="margin: 2px 0 16px 0; font-weight: 500; color: #94a3b8;">HR Team • CopterCode</p>
                                                
                                                <p style="margin: 0; font-size: 11px;">
                                                    📸 <a href="https://instagram.com/coptercode" target="_blank" style="color: #38bdf8 !important; text-decoration: none;">Instagram</a>
                                                </p>
                                                <p style="margin: 4px 0 0 0; font-size: 11px; color: #cbd5e1;">
                                                    Mail Id: <a href="mailto:hr@coptercode.co.in" style="color: #38bdf8 !important; text-decoration: none;">hr@coptercode.co.in</a>
                                                </p>
                                            </td>
                                        </tr>
                                        <tr>
                                            <td colspan="2" align="center" style="padding-top: 28px; border-top: 1px solid #334155; margin-top: 24px; font-size: 10px; color: #64748b;">
                                                This is an automated message. Please do not reply directly to this mail.
                                            </td>
                                        </tr>
                                    </table>
                                </td>
                            </tr>
                        </table>
                    </td>
                </tr>
            </table>
        </body>
        </html>
        """

        msg.attach(MIMEText(html_content, "html"))

        server = smtplib.SMTP(smtp_server, int(smtp_port))
        if int(smtp_port) == 587:
            server.starttls()
        server.login(smtp_username, smtp_password)
        server.sendmail(smtp_from_email, to_email, msg.as_string())
        server.quit()
        print(f"Email sent successfully to {to_email}")
        return True
    except Exception as email_err:
        print(f"Error sending email to {to_email}: {email_err}")
        return False

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allow all origins for dev simplicity
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def read_root():
    return {"status": "success", "message": "Certificate Generator API is running"}

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
                    
                    # If the placeholder textbox is abnormally wide, align the QR image to its left edge.
                    # Otherwise, center it.
                    if shape.width > Inches(2.5):
                        qr_left = shape.left
                    else:
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



@app.post("/api/batch/create")
async def create_batch(
    batch_id: str = Form(...),
    month: str = Form(...),
    issue_date: str = Form(...),
    lor_template: Optional[UploadFile] = File(None),
    experience_template: Optional[UploadFile] = File(None),
    internship_template: Optional[UploadFile] = File(None)
):
    if not supabase:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Supabase client is not configured."
        )

    for f in (lor_template, experience_template, internship_template):
        if f:
            ext = os.path.splitext(f.filename)[1].lower()
            if ext != ".pptx":
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Template {f.filename} must be a PPTX file."
                )

    try:
        lor_path = None
        exp_path = None
        int_path = None

        if lor_template:
            lor_bytes = await lor_template.read()
            lor_path = f"templates/{batch_id}/lor.pptx"
            supabase.storage.from_("templates").upload(
                path=lor_path,
                file=lor_bytes,
                file_options={"content-type": "application/vnd.openxmlformats-officedocument.presentationml.presentation", "upsert": "true"}
            )
        
        if experience_template:
            exp_bytes = await experience_template.read()
            exp_path = f"templates/{batch_id}/experience.pptx"
            supabase.storage.from_("templates").upload(
                path=exp_path,
                file=exp_bytes,
                file_options={"content-type": "application/vnd.openxmlformats-officedocument.presentationml.presentation", "upsert": "true"}
            )

        if internship_template:
            int_bytes = await internship_template.read()
            int_path = f"templates/{batch_id}/internship.pptx"
            supabase.storage.from_("templates").upload(
                path=int_path,
                file=int_bytes,
                file_options={"content-type": "application/vnd.openxmlformats-officedocument.presentationml.presentation", "upsert": "true"}
            )

        batch_record = {
            "id": batch_id,
            "month": month,
            "issue_date": issue_date,
            "lor_template_path": lor_path,
            "experience_template_path": exp_path,
            "internship_template_path": int_path
        }
        supabase.table("batches").upsert(batch_record).execute()

        return {"status": "success", "batch_id": batch_id}

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create batch: {str(e)}"
        )





@app.post("/api/generate")
async def generate_certificates(
    background_tasks: BackgroundTasks,
    excel_file: UploadFile = File(...),
    batch_id: Optional[str] = Form(None),
    template_id: Optional[str] = Form(None)
):
    """
    Processes the details from Excel.
    For each row, inserts records into the 'interns' and 'certificates' tables
    based on their LOR, Experience, and Internship selections.
    Emails certificates to interns.
    """
    target_batch_id = batch_id or template_id
    if not target_batch_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Missing batch_id or template_id parameter."
        )

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

    # Read and parse Excel file
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
        elif "email" in col:
            col_mapping["email"] = col
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
        
        # YES/NO certificate selections
        elif "recomandation" in col or "recommendation" in col or "lor" in col:
            col_mapping["opt_lor"] = col
        elif "experience" in col:
            col_mapping["opt_experience"] = col
        elif "internship certificate" in col or "internship_certificate" in col:
            col_mapping["opt_internship"] = col

    # Fallback to standard column mapping check
    missing_cols = []
    if "name" not in col_mapping:
        missing_cols.append("Name")
    if "email" not in col_mapping:
        missing_cols.append("Email")
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

    # Process row by row
    rows_results = []

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

            def _cell_yes_no(r, key):
                val = _cell_str(r, key).upper()
                return val == "YES"

            name_val = _cell_str(row, "name")
            email_val = _cell_str(row, "email")
            college_val = _cell_str(row, "college")
            year_val = _cell_str(row, "year")
            department_val = _cell_str(row, "department")
            role_val = _cell_str(row, "role")
            project_val = _cell_str(row, "project")
            month_val = _cell_str(row, "month")
            date_val = _cell_str(row, "date")

            opt_lor = _cell_yes_no(row, "opt_lor")
            opt_exp = _cell_yes_no(row, "opt_experience")
            opt_int = _cell_yes_no(row, "opt_internship")

            if not name_val or name_val.lower() == "nan" or not email_val:
                continue

            # Parse Issue Date
            issue_date_val = None
            if date_val:
                try:
                    clean_dt = date_val.strip()
                    parsed_dt = pd.to_datetime(clean_dt, dayfirst=True, errors='raise')
                    issue_date_val = parsed_dt.date().isoformat()
                except Exception:
                    try:
                        from dateutil import parser
                        parsed_dt = parser.parse(clean_dt, dayfirst=True)
                        issue_date_val = parsed_dt.date().isoformat()
                    except Exception:
                        issue_date_val = None

            # 1. Insert/Save Intern details
            intern_data = {
                "email": email_val,
                "name": name_val,
                "college": college_val,
                "year": year_val,
                "department": department_val,
                "role": role_val,
                "project": project_val,
                "month": month_val,
                "date": date_val,
                "batch_id": target_batch_id
            }

            intern_res = supabase.table("interns").insert(intern_data).execute()
            if not intern_res.data:
                raise ValueError("Failed to create intern database record.")
            intern_id = intern_res.data[0]["id"]

            # 2. Build Certificates based on YES/NO choices
            certificates_to_create = []
            if opt_lor:
                certificates_to_create.append(("lor", "Letter of Recommendation"))
            if opt_exp:
                certificates_to_create.append(("experience", "Experience Letter"))
            if opt_int:
                certificates_to_create.append(("internship", "Internship Certificate"))

            email_certificates = []

            for cert_type, label in certificates_to_create:
                cert_code = str(uuid.uuid4())
                
                # Dynamically point pdf_url to backend dynamic PDF route
                dynamic_pdf_url = f"{BACKEND_BASE_URL}/api/certificates/{cert_code}/pdf"

                cert_record = {
                    "cert_code": cert_code,
                    "intern_id": intern_id,
                    "cert_type": cert_type,
                    "status": "active",
                    "pdf_url": dynamic_pdf_url,
                    "name": name_val,
                    "college": college_val,
                    "batch": year_val,
                    "department": department_val,
                    "role": role_val,
                    "project": project_val,
                    "month": month_val,
                    "issue_date": date_val
                }

                supabase.table("certificates").insert(cert_record).execute()

                email_certificates.append({
                    "type": cert_type,
                    "label": label,
                    "cert_code": cert_code,
                    "pdf_url": dynamic_pdf_url
                })

                # Append to rows results for frontend UI display
                rows_results.append({
                    "name": name_val,
                    "college": college_val,
                    "department": department_val,
                    "month": f"{label} ({month_val or year_val})",
                    "cert_code": cert_code,
                    "pdf_url": dynamic_pdf_url,
                    "status": "active"
                })

            # 3. Trigger Email Notification (if any certificate is generated)
            if email_certificates:
                background_tasks.add_task(
                    send_email_notification,
                    email_val,
                    name_val,
                    month_val or year_val,
                    email_certificates,
                    str(intern_id)
                )

        except Exception as row_error:
            print(f"Row {index} failed: {row_error}")
            rows_results.append({
                "name": str(row.get(col_mapping.get("name", ""), "Unknown")),
                "college": str(row.get(col_mapping.get("college", ""), "Unknown")),
                "department": str(row.get(col_mapping.get("department", ""), "Unknown")),
                "month": "Error",
                "cert_code": None,
                "pdf_url": None,
                "status": "error",
                "error": str(row_error)
            })

    return {
        "excel_download_url": "",
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
        
        cert_data = dict(res.data[0])
        intern_id = cert_data.get("intern_id")
        if intern_id:
            intern_res = supabase.table("interns").select("*").eq("id", intern_id).execute()
            if intern_res.data:
                intern = intern_res.data[0]
                cert_data["name"] = intern.get("name")
                cert_data["college"] = intern.get("college")
                cert_data["batch"] = intern.get("year")
                cert_data["department"] = intern.get("department")
                cert_data["role"] = intern.get("role")
                cert_data["project"] = intern.get("project")
                cert_data["month"] = intern.get("month")
                cert_data["issue_date"] = intern.get("date") or cert_data.get("issue_date")
        
        return cert_data

    except HTTPException as he:
        raise he
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Database lookup failed: {str(e)}"
        )


@app.get("/api/certificates/{cert_code}/pdf")
async def get_dynamic_pdf(cert_code: str):
    """
    Generates and returns the PDF for a specific certificate dynamically.
    Downloads the templates from the bucket, parses data, replaces placeholders,
    runs the conversion, and serves raw PDF bytes.
    """
    if not supabase:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Supabase client is not configured."
        )

    try:
        # 1. Fetch certificate record (try exact match first, then case-insensitive fallbacks)
        res = supabase.table("certificates").select("*").eq("cert_code", cert_code).execute()
        if not res.data:
            res = supabase.table("certificates").select("*").eq("cert_code", cert_code.upper()).execute()
        if not res.data:
            res = supabase.table("certificates").select("*").eq("cert_code", cert_code.lower()).execute()

        if not res.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Certificate with code {cert_code} not found."
            )
        
        cert_data = res.data[0]
        
        # 2. Retrieve intern and batch details
        intern_id = cert_data.get("intern_id")
        cert_type = cert_data.get("cert_type") or "internship"
        batch_id = cert_data.get("template_id") # stored as template_id for compatibility

        # Fallback details from certificate record itself for old entries
        intern_name = cert_data.get("name")
        college = cert_data.get("college")
        year = cert_data.get("batch")
        department = cert_data.get("department")
        role = cert_data.get("role")
        project = cert_data.get("project")
        month = cert_data.get("month")
        date_val = cert_data.get("issue_date")

        # Load from interns table if it exists
        if intern_id:
            intern_res = supabase.table("interns").select("*").eq("id", intern_id).execute()
            if intern_res.data:
                intern = intern_res.data[0]
                intern_name = intern.get("name")
                college = intern.get("college")
                year = intern.get("year")
                department = intern.get("department")
                role = intern.get("role")
                project = intern.get("project")
                month = intern.get("month")
                date_val = intern.get("date") or date_val
                batch_id = intern.get("batch_id") or batch_id

        # 3. Retrieve template path from batches table
        template_path = None
        if batch_id:
            batch_res = supabase.table("batches").select("*").eq("id", batch_id).execute()
            if batch_res.data:
                batch = batch_res.data[0]
                if cert_type == "lor":
                    template_path = batch.get("lor_template_path")
                elif cert_type == "experience":
                    template_path = batch.get("experience_template_path")
                else:
                    template_path = batch.get("internship_template_path")
            else:
                # Fallback to old templates table lookup (backward compatible)
                template_res = supabase.table("templates").select("*").eq("id", batch_id).execute()
                if template_res.data:
                    template_path = f"{batch_id}/template.pptx"

        if not template_path:
            # Absolute default fallback
            template_path = f"{batch_id}/template.pptx"

        # 4. Download template PPTX from storage
        try:
            pptx_bytes = supabase.storage.from_("templates").download(template_path)
        except Exception as dl_err:
            # Fallback try template.pptx directly
            try:
                pptx_bytes = supabase.storage.from_("templates").download(f"{batch_id}/template.pptx")
            except Exception:
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail=f"Failed to retrieve template file from Storage bucket: {dl_err}"
                )

        # 5. Prepare replacements
        replacements = {
            "<<NAME>>": intern_name or "",
            "<<INSTITUTION>>": college or "",
            "<<COLLEGE>>": college or "",
            "<<YEAR>>": year or "",
            "<<DEPARTMENT>>": department or "",
            "<<DOMAIN>>": role or "",
            "<<ROLE>>": role or "",
            "<<PROJECT>>": project or "",
            "<<INTERNSHIP & LIVE PROJECT AREA>>": project or "",
            "<<BATCH>>": month or "",
            "<<BATCH >>": month or "",
            "<<DATE>>": str(date_val) if date_val else "",
            "<<DT>>": str(date_val) if date_val else ""
        }

        # 6. Generate QR code bytes pointing to verification URL
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
        try:
            qr_img.save(qr_io, format="PNG")
        except TypeError:
            # PyPNGImage.save doesn't accept the format parameter
            qr_io.seek(0)
            qr_io.truncate(0)
            qr_img.save(qr_io)
        qr_bytes = qr_io.getvalue()

        # 7. Convert and build PDF
        pdf_bytes, cert_title = generate_certificate_from_pptx_bytes(pptx_bytes, replacements, qr_bytes)

        # 8. Return response containing PDF stream
        return Response(
            content=pdf_bytes,
            media_type="application/pdf",
            headers={
                "Content-Disposition": f"inline; filename={cert_code}.pdf"
            }
        )

    except HTTPException as he:
        raise he
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate dynamic certificate PDF: {str(e)}"
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
