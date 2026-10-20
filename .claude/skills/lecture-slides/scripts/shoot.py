"""Screenshot deck slides with headless Chrome/Edge to check layout.
usage: python -I shoot.py DECK.html OUT_DIR 1.0 2.4 5.3 ...
Each argument is "<slide>.<step>" (1-based slide, step as in the deck's #hash).
"""
import sys, pathlib, subprocess, urllib.parse

deck = pathlib.Path(sys.argv[1]).resolve()
out = pathlib.Path(sys.argv[2]); out.mkdir(parents=True, exist_ok=True)
browsers = [
    r"C:\Program Files\Google\Chrome\Application\chrome.exe",
    r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
    r"C:\Program Files\Microsoft\Edge\Application\msedge.exe",
]
exe = next((b for b in browsers if pathlib.Path(b).exists()), None)
if not exe:
    sys.exit("no Chrome/Edge found")
url = "file:///" + urllib.parse.quote(deck.as_posix(), safe="/:")
for h in sys.argv[3:]:
    png = out / f"s{h}.png"
    subprocess.run([exe, "--headless=new", "--disable-gpu", "--hide-scrollbars",
                    "--window-size=1280,720", "--virtual-time-budget=4000",
                    f"--screenshot={png}", f"{url}#{h}"],
                   stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    print(png)
