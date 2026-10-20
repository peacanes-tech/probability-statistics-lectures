"""Search Wikimedia Commons and print candidate images with license info.
usage: python commons_search.py "query1" "query2" ...
"""
import sys, json, re, time, urllib.request, urllib.parse, urllib.error

sys.stdout.reconfigure(encoding="utf-8")
API = "https://commons.wikimedia.org/w/api.php"
UA = {"User-Agent": "LectureSlidesBot/0.1 (educational use; peacanes course materials)"}


def api(params):
    params = {**params, "format": "json", "formatversion": "2"}
    req = urllib.request.Request(API + "?" + urllib.parse.urlencode(params), headers=UA)
    for wait in (0, 10, 30, 60):
        time.sleep(wait or 3)
        try:
            with urllib.request.urlopen(req, timeout=30) as r:
                return json.load(r)
        except urllib.error.HTTPError as e:
            if e.code != 429:
                raise
    return {}


def strip(html):
    return re.sub(r"<[^>]+>", "", html or "").strip()


for q in sys.argv[1:]:
    print(f"\n### {q}")
    data = api({
        "action": "query", "generator": "search", "gsrsearch": f"filetype:bitmap {q}",
        "gsrnamespace": "6", "gsrlimit": "5", "prop": "imageinfo",
        "iiprop": "url|size|extmetadata", "iiurlwidth": "960",
    })
    for p in data.get("query", {}).get("pages", []):
        ii = p["imageinfo"][0]
        m = ii.get("extmetadata", {})
        lic = m.get("LicenseShortName", {}).get("value", "?")
        artist = strip(m.get("Artist", {}).get("value", ""))[:60]
        print(f"- {p['title']} | {ii['width']}x{ii['height']} | {lic} | {artist}")
        print(f"  thumb: {ii.get('thumburl')}")
        print(f"  page:  {ii['descriptionurl']}")
