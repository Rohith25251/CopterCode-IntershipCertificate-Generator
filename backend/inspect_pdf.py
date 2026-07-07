import fitz

def inspect():
    doc = fitz.open("C:/Users/ROHITH P/Downloads/ROHITH P cerf (3).pdf (2).pdf")
    page = doc[0]
    blocks = page.get_text("dict")["blocks"]
    for block in blocks:
        if "lines" in block:
            for line in block["lines"]:
                for span in line["spans"]:
                    print(f"Text: {repr(span['text'])}")
                    print(f"  Font: {span['font']}")
                    print(f"  Size: {span['size']:.2f}")
                    print(f"  Color: {span['color']}")
                    print(f"  Origin: {span['origin']}")
                    print(f"  Bbox: {[round(x, 2) for x in span['bbox']]}")

if __name__ == '__main__':
    inspect()
