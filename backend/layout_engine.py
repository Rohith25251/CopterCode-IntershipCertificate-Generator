import os
import re
import json
import base64
from PIL import ImageFont

# Margins default (in inches) matching python-pptx default margins
MARGIN_LEFT_DEFAULT = 0.1
MARGIN_RIGHT_DEFAULT = 0.1
MARGIN_TOP_DEFAULT = 0.05
MARGIN_BOTTOM_DEFAULT = 0.05

def find_font_file(font_name="Calibri"):
    # Resilient font search (local fonts first, then standard paths)
    local_paths = [
        f"backend/fonts/{font_name}.ttf",
        f"fonts/{font_name}.ttf",
        "backend/fonts/Calibri.ttf",
        "fonts/Calibri.ttf",
        "backend/fonts/CanvaSans-Regular.ttf",
        "fonts/CanvaSans-Regular.ttf"
    ]
    for path in local_paths:
        if os.path.exists(path):
            return os.path.abspath(path)
            
    system_fonts = [
        "C:\\Windows\\Fonts\\calibri.ttf",
        "C:\\Windows\\Fonts\\arial.ttf",
        "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
        "/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf",
        "~/.local/share/fonts/Calibri.ttf",
        "~/.local/share/fonts/CanvaSans-Regular.ttf"
    ]
    for path in system_fonts:
        expanded = os.path.expanduser(path)
        if os.path.exists(expanded):
            return os.path.abspath(expanded)
            
    # Fallback to any TTF file in workspace
    for root, dirs, files in os.walk("."):
        for file in files:
            if file.endswith(".ttf"):
                return os.path.abspath(os.path.join(root, file))
                
    return None

def estimate_text_height(text, font_path, font_size_pt, max_width_in):
    # Estimate wrapped height in inches using PIL text measurement at 72 DPI (1 pixel = 1 pt)
    max_width_pt = max_width_in * 72
    try:
        font = ImageFont.truetype(font_path, int(font_size_pt))
    except Exception:
        font = ImageFont.load_default()
        
    paragraphs = text.split('\n')
    total_lines = 0
    
    for para in paragraphs:
        if not para.strip():
            total_lines += 1
            continue
            
        words = para.split(' ')
        current_line = ""
        for word in words:
            test_line = (current_line + " " + word).strip()
            # use getlength for horizontal text measurement
            try:
                w = font.getlength(test_line)
            except AttributeError:
                # Pillow < 9.2.0 compatibility
                w, _ = font.getsize(test_line)
                
            if w <= max_width_pt:
                current_line = test_line
            else:
                if current_line:
                    total_lines += 1
                current_line = word
        if current_line:
            total_lines += 1
            
    # Standard PowerPoint line spacing (1.25x font size)
    line_height_in = (font_size_pt * 1.25) / 72
    return total_lines * line_height_in

def horiz_overlap(s1, s2):
    # Returns True if s1 and s2 overlap horizontally
    return s1["left"] < s2["left"] + s2["width"] and s1["left"] + s1["width"] > s2["left"]

class LayoutEngine:
    def __init__(self, template_dir):
        self.template_dir = template_dir
        with open(os.path.join(template_dir, "layout.json"), "r", encoding="utf-8") as f:
            self.layout = json.load(f)
            
    def render_html(self, replacements, qr_bytes):
        # 1. Prepare shape configurations
        shapes = []
        font_path = find_font_file()
        
        # Load shapes from layout.json
        for orig_shape in self.layout["shapes"]:
            shape = dict(orig_shape)
            shapes.append(shape)
            
        # 2. Perform replacements and calculate text frame heights & scaling
        for shape in shapes:
            # Check if this shape is the QR Code placeholder
            text_str = shape["original_text"]
            if "<<QR>>" in text_str or "«QR»" in text_str:
                shape["is_qr"] = True
                continue
                
            shape["is_qr"] = False
            
            # Resolve placeholders in paragraph and run texts
            resolved_paragraphs = []
            full_text_list = []
            
            for p in shape["paragraphs"]:
                resolved_runs = []
                p_text_list = []
                for r in p["runs"]:
                    r_text = r["text"]
                    # Replace placeholders
                    for key, val in replacements.items():
                        r_text = r_text.replace(key, str(val))
                        guill_key = key.replace("<<", "«").replace(">>", "»")
                        r_text = r_text.replace(guill_key, str(val))
                        
                    # Standard spelling & formatting normalization
                    r_text = re.sub(r',([a-zA-Z])', r', \1', r_text)
                    r_text = re.sub(r'\s{2,}', ' ', r_text)
                    
                    runs_copy = dict(r)
                    runs_copy["resolved_text"] = r_text
                    resolved_runs.append(runs_copy)
                    p_text_list.append(r_text)
                    
                p_copy = dict(p)
                p_copy["resolved_runs"] = resolved_runs
                resolved_paragraphs.append(p_copy)
                full_text_list.append("".join(p_text_list))
                
            shape["resolved_paragraphs"] = resolved_paragraphs
            shape["resolved_text"] = "\n".join(full_text_list)
            
            # 3. Autofit scale calculation
            # Get text padding margins
            margin_l = MARGIN_LEFT_DEFAULT
            margin_r = MARGIN_RIGHT_DEFAULT
            margin_t = MARGIN_TOP_DEFAULT
            margin_b = MARGIN_BOTTOM_DEFAULT
            
            usable_w = shape["width"] - (margin_l + margin_r)
            declared_h = shape["height"]
            
            original_size = shape["font_size"]
            scale = 1.0
            best_scale = 0.6
            
            while scale >= 0.6:
                # Estimate text block height at this scaled font size
                est_h = estimate_text_height(shape["resolved_text"], font_path, original_size * scale, usable_w)
                total_h = est_h + margin_t + margin_b
                if total_h <= declared_h:
                    best_scale = scale
                    break
                scale -= 0.05
                
            shape["best_scale"] = best_scale
            # Required height at the scaled font size (at least 60% readability floor)
            est_h = estimate_text_height(shape["resolved_text"], font_path, original_size * best_scale, usable_w)
            shape["required_height"] = est_h + margin_t + margin_b
            
        # 4. Vertical layout shifting & Clearance propagation
        # Sort shapes from top to bottom based on original top coordinates
        shapes_sorted = sorted(shapes, key=lambda s: s["top"])
        
        for i in range(len(shapes_sorted)):
            shape = shapes_sorted[i]
            if shape["is_qr"]:
                continue
                
            # If shape is taller than its initial height, it grows
            if shape["required_height"] > shape["height"]:
                delta_y = shape["required_height"] - shape["height"]
                shape["height"] = shape["required_height"]
                
                # Shift all overlapping downstream shapes down
                for j in range(i + 1, len(shapes_sorted)):
                    other = shapes_sorted[j]
                    if horiz_overlap(shape, other):
                        other["top"] = other["top"] + delta_y
                        
            # Enforce 0.08 inch clearance gaps
            for j in range(i + 1, len(shapes_sorted)):
                other = shapes_sorted[j]
                if horiz_overlap(shape, other):
                    gap = other["top"] - (shape["top"] + shape["height"])
                    if gap < 0.08:
                        extra_shift = 0.08 - gap
                        other["top"] = other["top"] + extra_shift
                        
        # 5. Overlap Validation Pass
        overlaps = []
        for i in range(len(shapes_sorted)):
            s1 = shapes_sorted[i]
            if s1["is_qr"] or not s1.get("resolved_text", "").strip():
                continue
            for j in range(i + 1, len(shapes_sorted)):
                s2 = shapes_sorted[j]
                if s2["is_qr"] or not s2.get("resolved_text", "").strip():
                    continue
                if horiz_overlap(s1, s2):
                    # Check vertical overlap
                    y_overlap = min(s1["top"] + s1["height"], s2["top"] + s2["height"]) - max(s1["top"], s2["top"])
                    if y_overlap > 0.05:
                        overlaps.append((s1["name"], s2["name"], y_overlap))
                        
        if overlaps:
            print(f"[Warning] Layout Engine detected text overlaps after shifting: {overlaps}")
            
        # 6. Generate final HTML/CSS page markup
        bg_png_path = os.path.join(self.template_dir, "background.png")
        # Convert background image to base64 to avoid local file resolution issues in WeasyPrint
        with open(bg_png_path, "rb") as img_f:
            bg_base64 = base64.b64encode(img_f.read()).decode("utf-8")
            
        qr_base64 = base64.b64encode(qr_bytes).decode("utf-8")
        
        # Build A4 stylesheet
        html_parts = [
            "<!DOCTYPE html>",
            "<html>",
            "<head>",
            "  <meta charset='utf-8'>",
            "  <style>",
            "    @page {",
            f"      size: {self.layout['width_in']}in {self.layout['height_in']}in;",
            "      margin: 0;",
            "    }",
            "    body {",
            "      margin: 0;",
            "      padding: 0;",
            "      background-color: #ffffff;",
            "    }",
            "    .page {",
            "      position: relative;",
            f"      width: {self.layout['width_in']}in;",
            f"      height: {self.layout['height_in']}in;",
            "      box-sizing: border-box;",
            "      overflow: hidden;",
            "      page-break-after: always;",
            "    }",
            "    .bg-img {",
            "      position: absolute;",
            "      top: 0;",
            "      left: 0;",
            f"      width: {self.layout['width_in']}in;",
            f"      height: {self.layout['height_in']}in;",
            "      z-index: 1;",
            "    }",
            "    .text-box {",
            "      position: absolute;",
            "      z-index: 10;",
            "      box-sizing: border-box;",
            "      overflow: hidden;",
            "      padding: 0.05in 0.1in;",
            "    }",
            "    .text-box p {",
            "      margin: 0;",
            "      padding: 0;",
            "      line-height: 1.25;",
            "    }",
            "    .qr-box {",
            "      position: absolute;",
            "      z-index: 20;",
            "      box-sizing: border-box;",
            "    }",
            "    .qr-box img {",
            "      width: 100%;",
            "      height: 100%;",
            "      object-fit: contain;",
            "    }",
            "  </style>",
            "</head>",
            "<body>",
            "  <div class='page'>",
            f"    <img class='bg-img' src='data:image/png;base64,{bg_base64}' />"
        ]
        
        # Build absolutely-positioned shape divs
        for shape in shapes_sorted:
            l = shape["left"]
            t = shape["top"]
            w = shape["width"]
            h = shape["height"]
            
            if shape["is_qr"]:
                # Centered QR Box element
                html_parts.append(
                    f"    <div class='qr-box' style='left: {l}in; top: {t}in; width: {w}in; height: {h}in;'>"
                )
                html_parts.append(f"      <img src='data:image/png;base64,{qr_base64}' />")
                html_parts.append("    </div>")
            else:
                best_scale = shape["best_scale"]
                default_size = shape["font_size"] * best_scale
                
                # Apply custom fonts and text sizing styles
                style_str = (
                    f"left: {l}in; "
                    f"top: {t}in; "
                    f"width: {w}in; "
                    f"height: {h}in; "
                    f"font-family: Arial, Calibri, sans-serif; "
                    f"font-size: {default_size}pt; "
                    f"color: {shape['color']}; "
                )
                
                html_parts.append(f"    <div class='text-box' style='{style_str}'>")
                
                for p in shape["resolved_paragraphs"]:
                    align = p["align"]
                    html_parts.append(f"      <p style='text-align: {align};'>")
                    
                    for r in p["resolved_runs"]:
                        span_style = f"color: {r['color']}; "
                        if r["font_size"] != shape["font_size"]:
                            span_style += f"font-size: {r['font_size'] * best_scale}pt; "
                        if r["font_name"]:
                            span_style += f"font-family: {r['font_name']}, Arial, sans-serif; "
                            
                        classes = []
                        if r["bold"]:
                            classes.append("run-bold")
                        if r["italic"]:
                            classes.append("run-italic")
                            
                        class_str = f"class='{' '.join(classes)}'" if classes else ""
                        text_escaped = r["resolved_text"].replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;").replace("\n", "<br/>")
                        
                        html_parts.append(f"        <span {class_str} style='{span_style}'>{text_escaped}</span>")
                        
                    html_parts.append("      </p>")
                html_parts.append("    </div>")
                
        html_parts.append("  </div>")
        html_parts.append("</body>")
        html_parts.append("</html>")
        
        return "\n".join(html_parts)
