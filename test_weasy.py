import os

from backend.layout_engine import LayoutEngine

# Replacements from Supabase record
replacements = {
    "NAME": "ROHIT P",
    "COLLEGE": "KONGU ENGINEERING COLLEGE",
    "BATCH": "3rd Year",
    "DEPARTMENT": "COMPUTER SCIENCE AND ENGINEERING",
    "ROLE": "FULL-STACK Development & Software Development",
    "PROJECT": "FULL-STACK DEVELOPMENT & SOFTWARE DEVELOPMENT - ERP SOLUTION & SITES",
    "MONTH": "1 MONTH - JAN",
    "DATE": "20.6.2026"
}

# Generate dummy QR code bytes
import qrcode
qr = qrcode.QRCode(version=1, box_size=10, border=1)
qr.add_data("https://coptercode-website.vercel.app/verify?id=1687a6a9-3da5-42f5-8248-564c376a2566")
qr.make(fit=True)
qr_img = qr.make_image(fill_color="black", back_color="white")
import io
qr_io = io.BytesIO()
try:
    qr_img.save(qr_io, format="PNG")  # type: ignore
except TypeError:
    qr_io.seek(0)
    qr_io.truncate(0)
    qr_img.save(qr_io)
qr_bytes = qr_io.getvalue()

template_dir = os.path.abspath("backend/templates/experience")
engine = LayoutEngine(template_dir)
html_content = engine.render_html(replacements, qr_bytes)

# Write HTML content for inspection
with open("test_weasy.html", "w", encoding="utf-8") as f:
    f.write(html_content)
print("Wrote test_weasy.html")

# Compile to PDF
from weasyprint import HTML
HTML(string=html_content).write_pdf("test_weasy.pdf")
print("Wrote test_weasy.pdf")
