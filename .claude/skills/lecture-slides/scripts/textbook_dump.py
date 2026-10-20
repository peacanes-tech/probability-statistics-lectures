"""Extract textbook PDF text page by page (needs: pip install pymupdf).
usage: python -I textbook_dump.py BOOK.pdf OUT.txt
"""
import sys, pathlib
import pymupdf

sys.stdout.reconfigure(encoding="utf-8")
src, out = sys.argv[1], pathlib.Path(sys.argv[2])
d = pymupdf.open(src)
parts = []
for i, page in enumerate(d):
    parts.append(f"\n===== page {i + 1} (images: {len(page.get_images())}) =====\n")
    parts.append(page.get_text())
out.write_text("".join(parts), encoding="utf-8")
print(src, "pages:", d.page_count)
