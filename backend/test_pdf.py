import io
import os
import qrcode
from reportlab.pdfgen import canvas
from reportlab.lib.utils import ImageReader
from pypdf import PdfReader, PdfWriter

def create_mock_template():
    """Generates a dummy 1-page PDF template for testing."""
    packet = io.BytesIO()
    # Using standard letter size
    width, height = 612.0, 792.0
    can = canvas.Canvas(packet, pagesize=(width, height))
    
    # Draw simple certificate background borders and placeholders
    can.setStrokeColorRGB(0.2, 0.2, 0.6)
    can.setLineWidth(10)
    can.rect(20, 20, width - 40, height - 40)
    
    can.setStrokeColorRGB(0.4, 0.4, 0.8)
    can.setLineWidth(2)
    can.rect(30, 30, width - 60, height - 60)
    
    can.setFont("Helvetica-Bold", 32)
    can.drawCentredString(width / 2.0, height - 100, "MOCK CERTIFICATE BASE")
    
    can.setFont("Helvetica", 14)
    can.drawCentredString(width / 2.0, height - 140, "This is a placeholder template generated for testing.")
    
    can.save()
    packet.seek(0)
    return packet.getvalue(), width, height

def generate_test_pdf():
    print("--- Starting Local PDF Overlay & Merge Test ---")
    
    # 1. Create a dummy template
    template_bytes, width_pt, height_pt = create_mock_template()
    print(f"Generated mock template. Dimensions: {width_pt} x {height_pt} pt")
    
    # Save the mock template locally
    with open("mock_template.pdf", "wb") as f:
        f.write(template_bytes)
    print("Saved mock template base to 'mock_template.pdf'")

    # 2. Layout fractions representing relative locations (simulating UI input)
    # Name centered, college centered, batch centered, QR in the bottom right corner
    name_pos = {"x": 0.5, "y": 0.45}
    college_pos = {"x": 0.5, "y": 0.55}
    batch_pos = {"x": 0.5, "y": 0.65}
    qr_pos = {"x": 0.75, "y": 0.75}
    qr_size = 0.12 # 12% of page width
    
    import uuid
    name_val = "Rohith P"
    college_val = "National Institute of Technology"
    batch_val = "2026-Summer"
    cert_code = str(uuid.uuid4())
    
    print("\nSimulating placement coordinates:")
    print(f" - Name (Center): {name_pos}")
    print(f" - College (Center): {college_pos}")
    print(f" - Batch (Center): {batch_pos}")
    print(f" - QR Code (Top-Left): {qr_pos}, Size: {qr_size}")

    # 3. Generate QR code
    qr_url = f"https://coptercode-website.vercel.app/verify?id={cert_code}"
    qr = qrcode.QRCode(version=1, box_size=10, border=1)
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
    qr_io.seek(0)
    qr_reader = ImageReader(qr_io)
    print("QR Code generated successfully.")

    # 4. Draw Overlay PDF using ReportLab
    overlay_io = io.BytesIO()
    can = canvas.Canvas(overlay_io, pagesize=(width_pt, height_pt))

    # Translate coordinates for Name text (center-aligned)
    name_x = name_pos["x"] * width_pt
    name_y = (1 - name_pos["y"]) * height_pt
    can.setFont("Helvetica-Bold", 24)
    can.drawCentredString(name_x, name_y, name_val)

    # Translate coordinates for College text
    college_x = college_pos["x"] * width_pt
    college_y = (1 - college_pos["y"]) * height_pt
    can.setFont("Helvetica", 14)
    can.drawCentredString(college_x, college_y, college_val)

    # Translate coordinates for Batch text
    batch_x = batch_pos["x"] * width_pt
    batch_y = (1 - batch_pos["y"]) * height_pt
    can.setFont("Helvetica", 12)
    can.drawCentredString(batch_x, batch_y, f"Batch: {batch_val}")

    # Translate coordinates for QR code image
    # Note: image coords are top-down, ReportLab is bottom-up.
    # qr_pos represents top-left corner of the QR box.
    qr_x = qr_pos["x"] * width_pt
    qr_size_pt = qr_size * width_pt
    qr_y = (1 - qr_pos["y"]) * height_pt - qr_size_pt
    
    can.drawImage(qr_reader, qr_x, qr_y, width=qr_size_pt, height=qr_size_pt)
    
    can.save()
    overlay_io.seek(0)
    print("ReportLab overlay PDF canvas generated successfully.")

    # 5. Merge overlay with template PDF
    template_reader = PdfReader(io.BytesIO(template_bytes))
    overlay_reader = PdfReader(overlay_io)
    
    writer = PdfWriter()
    template_page = template_reader.pages[0]
    overlay_page = overlay_reader.pages[0]
    
    template_page.merge_page(overlay_page)
    writer.add_page(template_page)
    
    with open("test_output.pdf", "wb") as f:
        writer.write(f)
        
    print("\nMerged template & overlay successfully. Output saved to 'test_output.pdf'.")
    print("--- Test Completed Successfully ---")

if __name__ == "__main__":
    generate_test_pdf()
