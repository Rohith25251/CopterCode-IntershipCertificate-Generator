import os
import io
import pandas as pd
import fitz
from reportlab.pdfgen import canvas
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.lib.utils import ImageReader
from pypdf import PdfReader, PdfWriter
import qrcode

def generate_local_cert():
    template_path = "C:/Users/ROHITH P/Downloads/ROHITH P cerf (3).pdf (2).pdf"
    excel_path = "C:/Users/ROHITH P/Desktop/TEST 3.xlsx"
    output_path = "C:/Users/ROHITH P/Downloads/ROHITH_P_perfect_cert.pdf"
    
    # 1. Load Excel Data
    df = pd.read_excel(excel_path)
    row = df.iloc[0]
    
    name = str(row['NAME']).strip()
    college = str(row['INSTITUTION']).strip()
    year = str(row['YEAR']).strip()
    dept = str(row['DEPARTMENT']).strip()
    domain = str(row['DOMAIN']).strip()
    project_area = str(row['INTERNSHIP & LIVE PROJECT AREA']).strip()
    batch = str(row['BATCH ']).strip()
    date_val = str(row['DATE']).strip()
    
    # 2. PDF dimensions
    doc = fitz.open(template_path)
    page = doc[0]
    width_pt = float(page.rect.width)
    height_pt = float(page.rect.height)
    
    # 3. Generate QR code
    qr_code = "CCFT7165509"  # from the example
    qr_url = f"https://coptercode-website.vercel.app/verify?id={qr_code}"
    qr = qrcode.QRCode(version=1, box_size=10, border=1)
    qr.add_data(qr_url)
    qr.make(fit=True)
    from qrcode.image.pil import PilImage
    qr_img = qr.make_image(image_factory=PilImage, fill_color="black", back_color="white")
    qr_io = io.BytesIO()
    qr_img.save(qr_io, format="PNG")
    qr_io.seek(0)
    qr_reader = ImageReader(qr_io)
    
    # 4. Create Overlay Canvas
    overlay_io = io.BytesIO()
    can = canvas.Canvas(overlay_io, pagesize=(width_pt, height_pt))
    
    # Register font (Canva Sans or Arial/Helvetica)
    # We will use Helvetica-Bold and Helvetica.
    
    # Helper to calculate font size to fit line width
    def get_font_size(text, font, max_w, max_h=18, default_size=14):
        size = default_size
        while size > 6:
            w = pdfmetrics.stringWidth(text, font, size)
            if w <= max_w:
                return size
            size -= 0.5
        return 6

    # Draw text left-aligned starting on the line
    def draw_on_line(text, font, x_start, x_end, y_line, font_size=14, offset_y=3):
        max_w = x_end - x_start
        actual_fs = get_font_size(text, font, max_w, default_size=font_size)
        can.setFont(font, actual_fs)
        # y coordinate in ReportLab is from bottom
        y_rl = height_pt - y_line + offset_y
        can.drawString(x_start, y_rl, text)
        print(f"Drew '{text}' at x={x_start:.2f}, y={y_rl:.2f} (fs={actual_fs})")

    # Mapped Lines from template:
    # 1. DATE: Line 5: Point(488.016, 156.13) -> Point(545.811, 156.13)
    draw_on_line(date_val, "Helvetica-Bold", 488.0, 545.8, 156.13, font_size=10, offset_y=2)
    
    # 2. Candidate Name: Line 6: Point(145.12, 292.37) -> Point(241.74, 292.37)
    draw_on_line(name, "Helvetica-Bold", 145.12, 241.74, 292.37, font_size=14, offset_y=3)
    
    # 3. Institute Name: Line 7: Point(130.31, 313.38) -> Point(360.57, 313.38)
    draw_on_line(college, "Helvetica-Bold", 130.31, 360.57, 313.38, font_size=12, offset_y=3)
    
    # 4. This is to notify: Name: Line 8: Point(130.31, 347.21) -> Point(201.07, 347.21)
    draw_on_line(name + ",", "Helvetica-Bold", 130.31, 201.07, 347.21, font_size=12, offset_y=3)
    
    # 5. This is to notify: Year: Line 9: Point(215.94, 347.21) -> Point(267.65, 347.77)
    draw_on_line(year + ",", "Helvetica-Bold", 215.94, 267.65, 347.21, font_size=12, offset_y=3)
    
    # 6. This is to notify: Dept: Line 10: Point(277.99, 348.15) -> Point(565.44, 348.33)
    draw_on_line(dept + ",", "Helvetica-Bold", 277.99, 565.44, 348.15, font_size=11, offset_y=3)
    
    # 7. Domain: Line 11: Point(165.96, 383.45) -> Point(548.36, 383.45)
    draw_on_line(domain, "Helvetica-Bold", 165.96, 548.36, 383.45, font_size=12, offset_y=3)
    
    # 8. Project Area: Line 12 & Line 13
    # If the text is long, we can split or print. Let's see:
    max_w_line12 = 575.52 - 277.99
    # Check if project_area fits on line 12
    w_project = pdfmetrics.stringWidth(project_area, "Helvetica-Bold", 12)
    if w_project <= max_w_line12:
        draw_on_line(project_area, "Helvetica-Bold", 277.99, 575.52, 436.72, font_size=12, offset_y=3)
    else:
        # Split project_area into two lines:
        words = project_area.split(" ")
        line1 = ""
        line2 = ""
        for word in words:
            test_line = (line1 + " " + word).strip()
            if pdfmetrics.stringWidth(test_line, "Helvetica-Bold", 12) <= max_w_line12:
                line1 = test_line
            else:
                line2 = (line2 + " " + word).strip()
        draw_on_line(line1, "Helvetica-Bold", 277.99, 575.52, 436.72, font_size=12, offset_y=3)
        if line2:
            draw_on_line(line2, "Helvetica-Bold", 20.99, 183.43, 457.09, font_size=12, offset_y=3)

    # 9. Batch Duration: Line 14: Point(379.33, 489.99) -> Point(494.02, 489.99)
    draw_on_line(batch, "Helvetica-Bold", 379.33, 494.02, 489.99, font_size=12, offset_y=3)

    # 10. Intern Access Code: Wait, in the Canva design, they added "Intern Access Code: CCFT7165509" below Candidate Name!
    # Wait, looking at the inspect_pdf.py output:
    # Text: 'Intern Access Code: ' at Bbox: [25.53, 258.31, 166.54, 277.87]
    # Text: 'CCFT7165509' at Bbox: [166.54, 258.31, 264.09, 277.87]
    # Wait! In the template, is there a line for Intern Access Code?
    # No, there is no line in the template, but in the Canva design, they drew it!
    # Let's draw "Intern Access Code: CCFT7165509" at x=25.53, y=273.66 (measured from top).
    # In ReportLab bottom-up: y = 842.25 - 273.66 = 568.59
    can.setFont("Helvetica", 14.36)
    can.drawString(25.53, height_pt - 273.66 + 3, "Intern Access Code: ")
    can.setFont("Helvetica-Bold", 14.36)
    can.drawString(166.54, height_pt - 273.66 + 3, qr_code)
    
    # 11. Draw QR code in top right or bottom right?
    # In template/Canva, the QR code is on the top right or bottom?
    # Let's check Page 3 of ROHITH P cerf (3).pdf:
    # Ah, the template has a large blue logo on the top right.
    # Where was the QR code positioned?
    # Let's check coordinates from templates table:
    # qr_pos: {'x': 0.7536, 'y': 0.8373}, size: 0.1626
    # Wait, y=0.8373 is near the bottom.
    # Let's check if the template has the QR code.
    # Let's draw it at the pos from templates DB or similar.
    # Let's draw QR at x = 450, y = 50, size = 100
    qr_size_pt = 0.16 * width_pt
    qr_x = 0.75 * width_pt
    qr_y = (1 - 0.83) * height_pt - qr_size_pt
    can.drawImage(qr_reader, qr_x, qr_y, width=qr_size_pt, height=qr_size_pt)

    can.save()
    overlay_io.seek(0)
    
    # Merge overlay with template PDF
    template_reader = PdfReader(template_path)
    overlay_reader = PdfReader(overlay_io)
    
    writer = PdfWriter()
    template_page = template_reader.pages[0]
    overlay_page = overlay_reader.pages[0]
    
    template_page.merge_page(overlay_page)
    writer.add_page(template_page)
    
    # Add any remaining pages
    for i in range(1, len(template_reader.pages)):
        writer.add_page(template_reader.pages[i])
        
    with open(output_path, "wb") as f:
        writer.write(f)
    print(f"Generated perfect certificate at: {output_path}")

if __name__ == '__main__':
    generate_local_cert()
