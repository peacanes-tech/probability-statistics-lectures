"""Download Wikimedia Commons images (960px) and record credits.
usage: python commons_get.py OUT_DIR name=File:Title.jpg [name=File:...]
Writes OUT_DIR/<name>.<ext> and appends to OUT_DIR/출처.json
"""
import sys, json, re, time, pathlib, urllib.request, urllib.parse, urllib.error

sys.stdout.reconfigure(encoding="utf-8")
API = "https://commons.wikimedia.org/w/api.php"
UA = {"User-Agent": "LectureSlidesBot/0.1 (educational use; peacanes course materials)"}


def fetch(url):
    req = urllib.request.Request(url, headers=UA)
    for wait in (3, 15, 45, 90, 120):
        time.sleep(wait)
        try:
            with urllib.request.urlopen(req, timeout=60) as r:
                return r.read()
        except urllib.error.HTTPError as e:
            if e.code != 429:
                raise
    raise RuntimeError("rate limited: " + url)


def strip(html):
    return re.sub(r"\s+", " ", re.sub(r"<[^>]+>", "", html or "")).strip()


out = pathlib.Path(sys.argv[1])
out.mkdir(parents=True, exist_ok=True)
credits_path = out / "출처.json"
credits = json.loads(credits_path.read_text(encoding="utf-8")) if credits_path.exists() else {}

for arg in sys.argv[2:]:
    name, title = arg.split("=", 1)
    if name in credits and (out / credits[name]["file"]).exists():
        print(f"{name}: already downloaded, skipped")
        continue
    time.sleep(8)  # upload.wikimedia.org rate-limits bursts (HTTP 429)
    q = urllib.parse.urlencode({
        "action": "query", "titles": title, "prop": "imageinfo",
        "iiprop": "url|extmetadata", "iiurlwidth": "960",
        "format": "json", "formatversion": "2",
    })
    page = json.loads(fetch(API + "?" + q))["query"]["pages"][0]
    ii = page["imageinfo"][0]
    m = ii["extmetadata"]
    url = ii.get("thumburl") or ii["url"]
    ext = pathlib.Path(urllib.parse.urlparse(url).path).suffix.lower() or ".jpg"
    if ext not in (".jpg", ".jpeg", ".png", ".gif", ".webp"):
        ext = ".jpg"
    dest = out / f"{name}{ext}"
    dest.write_bytes(fetch(url))
    credits[name] = {
        "file": dest.name,
        "title": title,
        "author": strip(m.get("Artist", {}).get("value", "")),
        "license": m.get("LicenseShortName", {}).get("value", ""),
        "license_url": m.get("LicenseUrl", {}).get("value", ""),
        "source": ii["descriptionurl"],
    }
    credits_path.write_text(json.dumps(credits, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"{dest.name}: {credits[name]['license']} / {credits[name]['author'][:50]}")
