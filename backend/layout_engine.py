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
    if not font_name:
        font_name = "Calibri"
    fn_lower = font_name.lower()
    
    # 1. Case-insensitive search in local fonts folders
    search_dirs = ["backend/fonts", "fonts"]
    for d in search_dirs:
        if os.path.exists(d):
            try:
                for f in os.listdir(d):
                    # Strip spaces/hyphens for comparison (e.g. CanvaSans vs Canva Sans)
                    f_clean = f.lower().replace(" ", "").replace("-", "").replace("_", "")
                    fn_clean = fn_lower.replace(" ", "").replace("-", "").replace("_", "")
                    if f_clean == f"{fn_clean}.ttf" or f_clean == f"{fn_clean}regular.ttf":
                        return os.path.abspath(os.path.join(d, f))
            except Exception:
                pass
                
    # 2. Resilient fallback check with hardcoded paths
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
            
    # 3. System font check
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
            
    # 4. Try matching case-insensitively in system fonts directories
    sys_dirs = ["/usr/share/fonts/truetype/custom", "~/.local/share/fonts"]
    for d in sys_dirs:
        expanded_d = os.path.expanduser(d)
        if os.path.exists(expanded_d):
            try:
                for root, _, files in os.walk(expanded_d):
                    for f in files:
                        f_clean = f.lower().replace(" ", "").replace("-", "").replace("_", "")
                        fn_clean = fn_lower.replace(" ", "").replace("-", "").replace("_", "")
                        if f_clean == f"{fn_clean}.ttf":
                            return os.path.abspath(os.path.join(root, f))
            except Exception:
                pass
                
    # 5. Fallback to any TTF file in workspace
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

def clean_font_family(font_name):
    if not font_name:
        return "Arial"
    name = font_name
    # Remove common style/weight suffixes
    for word in ["-Bold", " Bold", "Bold", "-Regular", " Regular", "Regular", "-Italic", " Italic", "Italic", "bd", "bd ", " bd"]:
        name = name.replace(word, "")
    # Add spaces back if missing between lowercase and uppercase (e.g. CanvaSans -> Canva Sans)
    name = re.sub(r'(?<=[a-z])(?=[A-Z])', ' ', name)
    name = name.replace("-", " ").replace("_", " ").strip()
    return name

def generate_font_face_rules():
    rules = []
    fonts_dir = None
    for d in ["backend/fonts", "fonts"]:
        if os.path.exists(d):
            fonts_dir = os.path.abspath(d)
            break
            
    if fonts_dir:
        from pathlib import Path
        for f in os.listdir(fonts_dir):
            if f.endswith(".ttf") or f.endswith(".otf"):
                font_path = os.path.join(fonts_dir, f)
                file_uri = Path(font_path).as_uri()
                
                font_name = f[:-4]
                family_clean = clean_font_family(font_name)
                weight = "normal"
                style = "normal"
                
                name_lower = font_name.lower()
                if "bold" in name_lower or ",bold" in name_lower:
                    weight = "bold"
                if "italic" in name_lower:
                    style = "italic"
                
                # Register clean normalized family name
                rules.append(
                    f"@font-face {{\n"
                    f"  font-family: '{family_clean}';\n"
                    f"  src: url('{file_uri}') format('truetype');\n"
                    f"  font-weight: {weight};\n"
                    f"  font-style: {style};\n"
                    f"}}\n"
                )
                
                # Register raw filename family (e.g. 'CanvaSans-Regular')
                rules.append(
                    f"@font-face {{\n"
                    f"  font-family: '{font_name}';\n"
                    f"  src: url('{file_uri}') format('truetype');\n"
                    f"  font-weight: normal;\n"
                    f"  font-style: normal;\n"
                    f"}}\n"
                )
                
                # Register clean fallback name with spaces
                friendly_name = font_name.replace("-", " ").replace("_", " ").strip()
                rules.append(
                    f"@font-face {{\n"
                    f"  font-family: '{friendly_name}';\n"
                    f"  src: url('{file_uri}') format('truetype');\n"
                    f"  font-weight: {weight};\n"
                    f"  font-style: {style};\n"
                    f"}}\n"
                )
    return "\n".join(rules)

class LayoutEngine:
    def __init__(self, template_dir):
        self.template_dir = template_dir
        with open(os.path.join(template_dir, "layout.json"), "r", encoding="utf-8") as f:
            self.layout = json.load(f)
            
    def render_html(self, replacements, qr_bytes):
        # 1. Prepare shape configurations
        shapes = []
        default_font_path = find_font_file()
        
        # Load shapes from layout.json
        for orig_shape in self.layout["shapes"]:
            shape = dict(orig_shape)
            shapes.append(shape)
            
        # 2. Perform replacements and calculate text frame heights & scaling
        for shape in shapes:
            if shape.get("is_line", False):
                continue
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
                    # Sort replacements by key length descending to prevent substring collisions (e.g. <<PROJECT>> matching inside <<INTERNSHIP & LIVE PROJECT AREA>>)
                    sorted_replacements = sorted(replacements.items(), key=lambda item: len(item[0]), reverse=True)
                    for key, val in sorted_replacements:
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
            
            # Find the specific font path for this shape's font name
            shape_font_name = shape.get("font_name", "Calibri")
            font_path = find_font_file(shape_font_name) or default_font_path
            
            if not shape.get("is_flow", True) or shape["height"] < 0.5:
                best_scale = 1.0
                shape["best_scale"] = 1.0
                shape["required_height"] = shape["height"]
            else:
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
            if shape.get("is_line", False) or shape.get("is_qr") or not shape.get("is_flow", True):
                continue
                
            # If shape is taller than its initial height, it grows
            if shape["required_height"] > shape["height"]:
                delta_y = shape["required_height"] - shape["height"]
                shape["height"] = shape["required_height"]
                
                # Shift all overlapping downstream FLOW shapes down
                for j in range(i + 1, len(shapes_sorted)):
                    other = shapes_sorted[j]
                    if not other.get("is_line", False) and other.get("is_flow", True) and horiz_overlap(shape, other):
                        other["top"] = other["top"] + delta_y
                        
            # Enforce 0.08 inch clearance gaps for FLOW shapes
            for j in range(i + 1, len(shapes_sorted)):
                other = shapes_sorted[j]
                if not other.get("is_line", False) and other.get("is_flow", True) and horiz_overlap(shape, other):
                    gap = other["top"] - (shape["top"] + shape["height"])
                    if gap < 0.08:
                        extra_shift = 0.08 - gap
                        other["top"] = other["top"] + extra_shift
                        
        # 5. Overlap Validation Pass
        overlaps = []
        for i in range(len(shapes_sorted)):
            s1 = shapes_sorted[i]
            if s1.get("is_line", False) or s1.get("is_qr") or not s1.get("resolved_text", "").strip():
                continue
            for j in range(i + 1, len(shapes_sorted)):
                s2 = shapes_sorted[j]
                if s2.get("is_line", False) or s2.get("is_qr") or not s2.get("resolved_text", "").strip():
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
        font_face_rules = generate_font_face_rules()
        html_parts = [
            "<!DOCTYPE html>",
            "<html>",
            "<head>",
            "  <meta charset='utf-8'>",
            "  <style>",
            font_face_rules,
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
            "    .footer-bar {",
            "      position: absolute;",
            "      bottom: 0;",
            "      left: 0;",
            f"      width: {self.layout['width_in']}in;",
            "      height: 0.34in;",
            "      background-color: #72402f;",
            "      z-index: 5;",
            "    }",
            "    .text-box {",
            "      position: absolute;",
            "      z-index: 10;",
            "      box-sizing: border-box;",
            "      overflow: visible;",
            "      padding: 0;",
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
            "    .line-shape {",
            "      position: absolute;",
            "      z-index: 8;",
            "      height: 2px;",
            "      box-sizing: border-box;",
            "    }",
            "    .run-bold {",
            "      font-weight: bold;",
            "    }",
            "    .run-italic {",
            "      font-style: italic;",
            "    }",
            "    .run-underline {",
            "      text-decoration: underline;",
            "    }",
            "  </style>",
            "</head>",
            "<body>",
            "  <div class='page'>",
            f"    <img class='bg-img' src='data:image/png;base64,{bg_base64}' />",
            "    <div class='footer-bar'></div>"
        ]
        
        # Build absolutely-positioned shape divs
        for shape in shapes_sorted:
            l = shape["left"]
            t = shape["top"]
            w = shape["width"]
            h = shape["height"]
            
            # If shape is near the bottom edge (footer area), shift it up slightly
            # to prevent it from being clipped by the A4 page boundary in WeasyPrint
            if t > 11.0:
                t = max(11.0, t - 0.08)
                
            if shape.get("is_line", False):
                t_center = t + (h - 0.02) / 2
                line_color = shape.get("line_color", "#000000")
                html_parts.append(
                    f"    <div class='line-shape' style='left: {l:.3f}in; top: {t_center:.3f}in; width: {w:.3f}in; background-color: {line_color};'></div>"
                )
                continue
            
            if shape["is_qr"]:
                # Force a reasonable square size for the QR code
                qr_size = 1.1  # inches (good standard size)
                if 0.5 <= w <= 2.0 and 0.5 <= h <= 2.0:
                    qr_size = min(w, h)
                
                # Determine horizontal alignment within the original text box
                align = shape.get("align", "left")
                if shape.get("paragraphs"):
                    align = shape["paragraphs"][0].get("align", align)
                    
                if align == "right":
                    left_pos = l + w - qr_size
                elif align == "center":
                    left_pos = l + (w - qr_size) / 2
                else:
                    left_pos = l
                
                # Ensure the QR code stays within page bounds
                page_width = self.layout.get("width_in", 8.27)
                if left_pos + qr_size > page_width - 0.2:
                    left_pos = page_width - qr_size - 0.4
                if left_pos < 0.2:
                    left_pos = 0.2
                    
                # Remove fixed height constraint so box can expand to contain both image and label
                html_parts.append(
                    f"    <div class='qr-box' style='left: {left_pos:.3f}in; top: {t:.3f}in; width: {qr_size:.3f}in; text-align: center;'>"
                )
                html_parts.append(f"      <img src='data:image/png;base64,{qr_base64}' style='width: 100%; height: auto; display: block; margin-bottom: 2px;' />")
                html_parts.append("      <span style='font-family: Arial, sans-serif; font-size: 7.5pt; color: #444444; font-weight: bold; display: block; white-space: nowrap; text-transform: uppercase; letter-spacing: 0.5px;'>scan to verify</span>")
                html_parts.append("    </div>")
            else:
                best_scale = shape["best_scale"]
                default_size = shape["font_size"] * best_scale
                shape_font_name = shape.get("font_name", "Arial")
                clean_family = clean_font_family(shape_font_name)
                
                # Apply custom fonts and text sizing styles
                style_str = (
                    f"left: {l}in; "
                    f"top: {t}in; "
                    f"width: {w}in; "
                    f"height: {h}in; "
                    f"font-family: '{clean_family}', Arial, Calibri, sans-serif; "
                    f"font-size: {default_size}pt; "
                    f"color: {shape['color']}; "
                )
                # Prevent wrapping for short headings/labels and off-flow text boxes
                # Use resolved_text length so we don't nowrap long replaced placeholder values
                resolved_txt = shape.get("resolved_text", "")
                if not shape.get("is_flow", True) or (len(resolved_txt) < 50 and "\n" not in resolved_txt):
                    style_str += "overflow: visible; padding-top: 0; padding-bottom: 0; "
                    if "\n" not in resolved_txt:
                        style_str += "white-space: nowrap; "
                
                html_parts.append(f'    <div class="text-box" style="{style_str}">')
                
                for p in shape["resolved_paragraphs"]:
                    align = p["align"]
                    # Check if paragraph is empty (no runs or all runs have empty text)
                    has_content = any(r.get("resolved_text", "").strip() for r in p.get("resolved_runs", []))
                    html_parts.append(f"      <p style='text-align: {align};'>")
                    
                    if not has_content:
                        # Empty paragraph — render non-breaking space so it gets full line-height
                        html_parts.append(f"        <span>&nbsp;</span>")
                    else:
                        for r in p["resolved_runs"]:
                            span_style = f"color: {r['color']}; "
                            if r["font_size"] != shape["font_size"]:
                                span_style += f"font-size: {r['font_size'] * best_scale}pt; "
                            if r["font_name"]:
                                r_font_clean = clean_font_family(r["font_name"])
                                span_style += f"font-family: '{r_font_clean}', Arial, sans-serif; "
                                
                            classes = []
                            if r["bold"]:
                                classes.append("run-bold")
                            if r["italic"]:
                                classes.append("run-italic")
                            if r.get("underline"):
                                classes.append("run-underline")
                                
                            class_str = f"class='{' '.join(classes)}'" if classes else ""
                            text_escaped = r["resolved_text"].replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;").replace("\n", "<br/>")
                            
                            html_parts.append(f'        <span {class_str} style="{span_style}">{text_escaped}</span>')
                    
                    html_parts.append("      </p>")
                html_parts.append("    </div>")
                
        html_parts.append("  </div>")
        html_parts.append("</body>")
        html_parts.append("</html>")
        
        return "\n".join(html_parts)
