import fitz

def get_lines():
    doc = fitz.open("C:/Users/ROHITH P/Downloads/ROHITH P cerf (3).pdf (2).pdf")
    page = doc[0]
    drawings = page.get_drawings()
    print(f"Total drawings: {len(drawings)}")
    for idx, d in enumerate(drawings):
        for item in d['items']:
            if item[0] == 'l':
                print(f"Line {idx}: {item[1]} -> {item[2]}, width={d.get('width')}, rect={d.get('rect')}")
            elif item[0] == 're':
                print(f"Rect {idx}: {item[1]}, fill={d.get('fill')}, color={d.get('color')}, rect={d.get('rect')}")

if __name__ == '__main__':
    get_lines()
