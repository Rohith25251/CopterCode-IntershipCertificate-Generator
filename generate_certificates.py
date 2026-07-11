import os
import re
import uuid
import argparse
import io
import shutil
import subprocess
import json
import pandas as pd
import qrcode
import fitz
from pptx import Presentation
# Deferred/Dynamic import of WeasyPrint to avoid static checker errors on environments without native DLLs
weasyprint_html = None
def get_weasyprint_html():
    global weasyprint_html
    if weasyprint_html is None:
        try:
            from weasyprint import HTML as WP_HTML
            weasyprint_html = WP_HTML
        except Exception as e:
            raise ImportError(
                "WeasyPrint could not be imported. Please ensure that WeasyPrint and its native dependencies (GTK/Cairo/Pango) are installed.\n"
                f"Error details: {e}"
            )
    return weasyprint_html

import sys
# Make import of layout_engine robust and quiet static checkers
backend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), 'backend'))
if backend_dir not in sys.path:
    sys.path.append(backend_dir)

try:
    from backend.layout_engine import LayoutEngine
except ImportError:
    import importlib
    layout_engine = importlib.import_module("layout_engine")
    LayoutEngine = layout_engine.LayoutEngine

# =====================================================
# HELPERS
# =====================================================

def safe_filename(name):
    """Sanitize filenames for filesystem safety."""
    return re.sub(r'[\\/*?:"<>|]', "_", str(name)).strip()

def get_alignment_str(paragraph):
    from pptx.enum.text import PP_ALIGN
    align = paragraph.alignment
    if align == PP_ALIGN.CENTER:
        return "center"
    elif align == PP_ALIGN.RIGHT:
        return "right"
    elif align == PP_ALIGN.JUSTIFY:
        return "justify"
    return "left"

def get_color_hex(run):
    try:
        color = run.font.color
        if color and color.type == 1:  # RGBColor
            rgb = color.rgb
            return f"#{rgb[0]:02x}{rgb[1]:02x}{rgb[2]:02x}"
    except:
        pass
    return None

def is_body_text_shape(shape):
    if not shape.has_text_frame:
        return False
    text = shape.text_frame.text.strip()
    if not text:
        return False
    # Always include if it contains a placeholder
    if any(p in text for p in ["<<", ">>", "«", "»"]):
        return True
    # Bounding check for vertical column shapes (wide text blocks in the middle of A4)
    left_in = shape.left.inches
    top_in = shape.top.inches
    width_in = shape.width.inches
    
    is_wide_and_centered = (left_in < 1.0) and (width_in > 6.5)
    is_in_middle_band = (top_in > 2.2) and (top_in < 9.0)
    
    return is_wide_and_centered and is_in_middle_band

def export_pptx_to_pdf(pptx_path: str, output_dir: str) -> str:
    """Converts PPTX to PDF using headless LibreOffice (fallback path on Linux/Docker)."""
    os.makedirs(output_dir, exist_ok=True)
    profile_dir = f"/tmp/lo_profile_{uuid.uuid4().hex}"

    cmd = [
        "soffice",
        "--headless",
        "--norestore",
        "--nofirststartwizard",
        "--nologo",
        "--nodefault",
        "--invisible",
        "--convert-to", "pdf",
        "--outdir", output_dir,
        f"-env:UserInstallation=file://{profile_dir}",
        pptx_path,
    ]

    env = os.environ.copy()
    env["HOME"] = "/tmp"

    try:
        subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=60,
            check=True,
            env=env,
        )
    except subprocess.TimeoutExpired:
        raise RuntimeError(f"LibreOffice conversion timed out for {pptx_path}")
    except subprocess.CalledProcessError as e:
        raise RuntimeError(
            f"LibreOffice conversion failed with exit code {e.returncode}.\nStdout: {e.stdout}\nStderr: {e.stderr}"
        )
    finally:
        shutil.rmtree(profile_dir, ignore_errors=True)

    expected_pdf = os.path.join(
        output_dir,
        os.path.splitext(os.path.basename(pptx_path))[0] + ".pdf",
    )
    if not os.path.exists(expected_pdf):
        raise RuntimeError(f"Conversion reported success but output PDF not found: {expected_pdf}")
    return expected_pdf

def get_or_create_html_template(template_pptx_path: str, cert_type: str) -> str:
    """Generates layout.json and background.png locally for CLI execution cache."""
    cache_dir = os.path.abspath(f"templates_cache/cli_{cert_type}")
    layout_json_path = os.path.join(cache_dir, "layout.json")
    bg_png_path = os.path.join(cache_dir, "background.png")
    
    if os.path.exists(layout_json_path) and os.path.exists(bg_png_path):
        return cache_dir
        
    os.makedirs(cache_dir, exist_ok=True)
    print(f"  [CLI] Exporting template layout & background for {cert_type}...")
    
    # 1. Parse shapes layout
    prs = Presentation(template_pptx_path)
    slide = prs.slides[0]
    
    layout_data = {
        "template": cert_type,
        "width_in": prs.slide_width.inches,
        "height_in": prs.slide_height.inches,
        "shapes": []
    }
    
    shapes_to_clear = []
    for shape in slide.shapes:
        if not shape.has_text_frame:
            continue
        if not is_body_text_shape(shape):
            continue
            
        left_in = shape.left.inches
        top_in = shape.top.inches
        width_in = shape.width.inches
        height_in = shape.height.inches
        
        font_name = "Calibri"
        font_size = 14
        font_color = "#000000"
        bold = False
        italic = False
        align = "left"
        
        if shape.text_frame.paragraphs:
            p = shape.text_frame.paragraphs[0]
            align = get_alignment_str(p)
            if p.runs:
                r = p.runs[0]
                if r.font.name:
                    font_name = r.font.name
                if r.font.size:
                    font_size = r.font.size.pt
                c = get_color_hex(r)
                if c:
                    font_color = c
                bold = bool(r.font.bold)
                italic = bool(r.font.italic)
                
        paragraphs_cfg = []
        for p in shape.text_frame.paragraphs:
            runs_cfg = []
            for r in p.runs:
                r_color = get_color_hex(r) or font_color
                runs_cfg.append({
                    "text": r.text,
                    "font_name": r.font.name or font_name,
                    "font_size": r.font.size.pt if r.font.size else font_size,
                    "bold": bool(r.font.bold),
                    "italic": bool(r.font.italic),
                    "color": r_color
                })
            paragraphs_cfg.append({
                "align": get_alignment_str(p),
                "runs": runs_cfg
            })
            
        shape_cfg = {
            "id": shape.shape_id,
            "name": shape.name,
            "left": left_in,
            "top": top_in,
            "width": width_in,
            "height": height_in,
            "font_name": font_name,
            "font_size": font_size,
            "color": font_color,
            "bold": bold,
            "italic": italic,
            "align": align,
            "original_text": shape.text_frame.text,
            "paragraphs": paragraphs_cfg
        }
        layout_data["shapes"].append(shape_cfg)
        shapes_to_clear.append(shape)
        
    with open(layout_json_path, "w", encoding="utf-8") as f:
        json.dump(layout_data, f, indent=2)
        
    # 2. Clear text runs for background export
    for shape in shapes_to_clear:
        for p in shape.text_frame.paragraphs:
            for r in p.runs:
                r.text = ""
                
    temp_cleared_pptx = os.path.join(cache_dir, "temp_cleared.pptx")
    prs.save(temp_cleared_pptx)
    
    # 3. Export background PNG (Windows COM or Linux LibreOffice)
    exported_bg = False
    try:
        import sys
        if sys.platform == "win32":
            import win32com.client
            print(f"  [Windows CLI] Exporting background slide via PowerPoint COM...")
            powerpoint = win32com.client.DispatchEx("PowerPoint.Application")
            presentation = powerpoint.Presentations.Open(os.path.abspath(temp_cleared_pptx), WithWindow=False)
            presentation.Slides(1).Export(os.path.abspath(bg_png_path), "PNG")
            presentation.Close()
            powerpoint.Quit()
            exported_bg = True
    except Exception as win_err:
        print(f"  [Windows CLI] COM export failed/not available: {win_err}")
        
    if not exported_bg:
        # Fallback to LibreOffice + PyMuPDF
        pdf_path = export_pptx_to_pdf(temp_cleared_pptx, cache_dir)
        doc = fitz.open(pdf_path)
        page = doc[0]
        matrix = fitz.Matrix(300 / 72, 300 / 72)
        pix = page.get_pixmap(matrix=matrix)
        pix.save(bg_png_path)
        doc.close()
        if os.path.exists(pdf_path):
            os.remove(pdf_path)
            
    if os.path.exists(temp_cleared_pptx):
        os.remove(temp_cleared_pptx)
        
    return cache_dir

def detect_certificate_title(template_path):
    text_lower = template_path.lower()
    if "recommendation" in text_lower or "recomandation" in text_lower:
        return "Letter Of Recomandation"
    elif "experience" in text_lower:
        return "Experience Letter"
    elif "internship" in text_lower:
        return "Internship Certificate"
    return "Certificate"

# =====================================================
# MAIN PIPELINE
# =====================================================

def main():
    parser = argparse.ArgumentParser(description="WeasyPrint Certificate Generator Batch Tool")
    parser.add_argument(
        "--template", 
        default="C:/Users/ROHITH P/Downloads/TEMPLATE.pptx",
        help="Path to PPTX certificate template slide"
    )
    parser.add_argument(
        "--data", 
        default="C:/Users/ROHITH P/Desktop/TEST 3.xlsx",
        help="Path to Excel spreadsheet rows"
    )
    parser.add_argument(
        "--outdir", 
        default="output",
        help="Directory to save generated certificates"
    )
    args = parser.parse_args()

    # Validate inputs
    if not os.path.exists(args.template):
        if os.path.exists("TEMPLATE.pptx"):
            args.template = "TEMPLATE.pptx"
        else:
            raise FileNotFoundError(f"Template PPTX not found: {args.template}")

    if not os.path.exists(args.data):
        if os.path.exists("TEST 3.xlsx"):
            args.data = "TEST 3.xlsx"
        else:
            raise FileNotFoundError(f"Excel data sheet not found: {args.data}")

    os.makedirs(args.outdir, exist_ok=True)

    print("=" * 60)
    print("Starting HTML/WeasyPrint Certificate Generator...")
    print(f"Template   : {args.template}")
    print(f"Data Sheet : {args.data}")
    print(f"Out Dir    : {args.outdir}")
    print("=" * 60)

    # Resolve template type
    cert_title = detect_certificate_title(args.template)
    cert_type = "internship"
    if "recomandation" in cert_title.lower() or "recommendation" in cert_title.lower():
        cert_type = "lor"
    elif "experience" in cert_title.lower():
        cert_type = "experience"

    # Export slide background and layout on-the-fly (cached locally)
    template_cache_dir = get_or_create_html_template(args.template, cert_type)
    engine = LayoutEngine(template_cache_dir)

    # 1. Load Excel and trim headers/cell values
    df = pd.read_excel(args.data)
    df.columns = [str(col).strip() for col in df.columns]
    
    # Map headers robustly
    col_mapping = {}
    for col in df.columns:
        col_lower = col.lower()
        if "name" in col_lower:
            col_mapping["name"] = col
        elif "college" in col_lower or "university" in col_lower or "institution" in col_lower:
            col_mapping["college"] = col
        elif "year" in col_lower or "class" in col_lower:
            col_mapping["year"] = col
        elif "department" in col_lower or "dept" in col_lower or "branch" in col_lower:
            col_mapping["department"] = col
        elif "role" in col_lower or "domain" in col_lower:
            col_mapping["role"] = col
        elif "project" in col_lower or "proj" in col_lower or "area" in col_lower:
            col_mapping["project"] = col
        elif "month" in col_lower or "batch" in col_lower:
            col_mapping["month"] = col
        elif "date" in col_lower or "dt" in col_lower:
            col_mapping["date"] = col

    # Check for name column
    if "name" not in col_mapping:
        raise ValueError("Excel file is missing a 'NAME' column.")

    def _get_row_val(row_data, key):
        if key not in col_mapping:
            return ""
        val = row_data.get(col_mapping[key], "")
        if pd.isna(val):
            return ""
        return str(val).strip()

    # 2. Process rows
    report = []
    total_rows = len(df)
    
    for index, row in df.iterrows():
        name_val = _get_row_val(row, "name")
        if not name_val or name_val.lower() == "nan":
            continue
            
        college_val = _get_row_val(row, "college")
        year_val = _get_row_val(row, "year")
        department_val = _get_row_val(row, "department")
        role_val = _get_row_val(row, "role")
        project_val = _get_row_val(row, "project")
        month_val = _get_row_val(row, "month")
        date_val = _get_row_val(row, "date")
        
        # Clean date format if parsed
        if date_val:
            try:
                parsed_dt = pd.to_datetime(date_val)
                date_val = parsed_dt.strftime("%d.%m.%Y")
            except Exception:
                pass

        cert_code = str(uuid.uuid4())
        print(f"[{index + 1}/{total_rows}] Generating: {name_val}")
        
        # Setup replacements dictionary
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
        
        # Generate QR code bytes
        verify_url = f"https://coptercode.co.in/verify?id={cert_code}"
        qr = qrcode.QRCode(
            version=1,
            error_correction=qrcode.constants.ERROR_CORRECT_H,
            box_size=12,
            border=2
        )
        qr.add_data(verify_url)
        qr.make(fit=True)
        from qrcode.image.pil import PilImage
        qr_img = qr.make_image(image_factory=PilImage, fill_color="black", back_color="white")
        qr_io = io.BytesIO()
        try:
            qr_img.save(qr_io, format="PNG")
        except TypeError:
            qr_io.seek(0)
            qr_io.truncate(0)
            qr_img.save(qr_io)
        qr_bytes = qr_io.getvalue()
        
        # Compile HTML using the layout engine
        html_content = engine.render_html(replacements, qr_bytes)
        
        # Output PDF path
        out_pdf_name = f"{safe_filename(name_val)}_({cert_title}).pdf"
        out_pdf_path = os.path.join(args.outdir, out_pdf_name)
        
        success = False
        try:
            # Render directly to PDF via WeasyPrint
            get_weasyprint_html()(string=html_content).write_pdf(out_pdf_path)
            success = True
        except Exception as e:
            print(f"  --> WeasyPrint compilation failed for {name_val}: {e}")
            
        report.append({
            "NAME": name_val,
            "CERT_CODE": cert_code,
            "VERIFY_URL": verify_url,
            "STATUS": "SUCCESS" if success else "FAILED",
            "PDF": os.path.abspath(out_pdf_path) if success else ""
        })
        
    # Save compilation report
    report_df = pd.DataFrame(report)
    report_df.to_csv(os.path.join(args.outdir, "report.csv"), index=False)
    
    print("\n" + "=" * 60)
    print("Batch Run Complete!")
    print(f"Generated {len(report_df[report_df['STATUS'] == 'SUCCESS'])}/{len(report_df)} certificates.")
    print(f"Output saved in: {os.path.abspath(args.outdir)}")
    print("=" * 60)

if __name__ == '__main__':
    main()
