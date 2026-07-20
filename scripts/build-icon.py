from pathlib import Path
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
SIZE = 1024
image = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
pixels = image.load()

for y in range(SIZE):
    for x in range(SIZE):
        ratio = (x + y) / (2 * (SIZE - 1))
        pixels[x, y] = (
            round(23 + (16 - 23) * ratio),
            round(111 + (162 - 111) * ratio),
            round(209 + (190 - 209) * ratio),
            255,
        )

mask = Image.new("L", (SIZE, SIZE), 0)
ImageDraw.Draw(mask).rounded_rectangle((48, 48, 976, 976), radius=216, fill=255)
image.putalpha(mask)
draw = ImageDraw.Draw(image)
points = [(184, 548), (316, 548), (384, 352), (494, 744), (590, 436), (656, 608), (840, 608)]
draw.line(points, fill="white", width=68, joint="curve")
radius = 44
for x, y in (points[0], points[-1]):
    draw.ellipse((x - radius, y - radius, x + radius, y + radius), fill="white")

png_path = ROOT / "build" / "icon.png"
ico_path = ROOT / "build" / "icon.ico"
image.resize((512, 512), Image.Resampling.LANCZOS).save(png_path)
image.save(ico_path, sizes=[(16, 16), (24, 24), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)])
print(png_path)
print(ico_path)
