import os
import json
from backend.layout_engine import LayoutEngine

# Create dummy QR bytes
qr_bytes = b"dummy_qr_code_bytes"

# Test data with long names and departments to trigger layout scaling and shifting
replacements = {
    "<<NAME>>": "GHAANDHAMADHAN VIGNESHWARAN SENAPATHI",
    "<<INSTITUTION>>": "KONGU ENGINEERING COLLEGE (AUTONOMOUS), PERUNDURAI, ERODE",
    "<<COLLEGE>>": "KONGU ENGINEERING COLLEGE (AUTONOMOUS), PERUNDURAI, ERODE",
    "<<YEAR>>": "4th Year",
    "<<DEPARTMENT>>": "COMPUTER SCIENCE AND BUSINESS SYSTEMS (CSBS) & SOFTWARE DEVELOPMENT",
    "<<DOMAIN>>": "FULL-STACK DEVELOPMENT & ARTIFICIAL INTELLIGENCE SOLUTIONS",
    "<<ROLE>>": "FULL-STACK DEVELOPMENT & ARTIFICIAL INTELLIGENCE SOLUTIONS",
    "<<PROJECT>>": "ENTERPRISE RESOURCE PLANNING (ERP) INTEGRATED PORTAL WITH DYNAMIC SCHEDULING",
    "<<INTERNSHIP & LIVE PROJECT AREA>>": "ENTERPRISE RESOURCE PLANNING (ERP) INTEGRATED PORTAL WITH DYNAMIC SCHEDULING",
    "<<BATCH>>": "2 MONTHS - MAY TO JULY",
    "<<BATCH >>": "2 MONTHS - MAY TO JULY",
    "<<DATE>>": "11.07.2026",
    "<<DT>>": "11.07.2026"
}

def test_template(name):
    template_dir = f"backend/templates/{name}"
    if not os.path.exists(template_dir):
        print(f"Template directory {template_dir} does not exist. Run export_templates.py first.")
        return
        
    print(f"\n==========================================")
    print(f"Testing layout generation for: {name.upper()}")
    print(f"==========================================")
    
    engine = LayoutEngine(template_dir)
    
    # Render HTML
    html_content = engine.render_html(replacements, qr_bytes)
    
    # Save output to scratch directory for browser preview
    out_html = f"scratch/test_{name}.html"
    with open(out_html, "w", encoding="utf-8") as f:
        f.write(html_content)
        
    print(f"Saved layout preview to: {out_html}")
    
    # Print the coordinates of shifted/scaled elements
    print("\nPositions after Layout Shifting:")
    for shape in sorted(engine.layout["shapes"], key=lambda s: s["top"]):
        print(f"  Shape {shape['id']} ({shape['name']}): L={shape['left']:.3f}in | T={shape['top']:.3f}in | W={shape['width']:.3f}in | H={shape['height']:.3f}in")

if __name__ == "__main__":
    for name in ["internship", "experience", "lor"]:
        test_template(name)
