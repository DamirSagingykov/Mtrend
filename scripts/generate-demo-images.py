"""Генерация нейтральных SVG-заглушек для демонстрационных товаров (не фотографии!)."""
import os, sys

OUT = sys.argv[1] if len(sys.argv) > 1 else "public/demo"
os.makedirs(OUT, exist_ok=True)

SHAPES = {
    "suit": """<path d="M210 170 L270 140 L300 230 L330 140 L390 170 L470 210 L500 470 L455 480 L440 330 L430 650 L170 650 L160 330 L145 480 L100 470 L130 210 Z" fill="{c}"/>
<path d="M270 140 L300 230 L330 140 L320 135 L300 190 L280 135 Z" fill="#fff" opacity=".9"/>
<path d="M300 230 L255 330 L240 300 L270 140 M300 230 L345 330 L360 300 L330 140" fill="none" stroke="{d}" stroke-width="3"/>
<line x1="300" y1="230" x2="300" y2="650" stroke="{d}" stroke-width="2"/>
<circle cx="300" cy="420" r="6" fill="{d}"/><circle cx="300" cy="480" r="6" fill="{d}"/>
<path d="M195 470 h50" stroke="{d}" stroke-width="3"/><path d="M355 470 h50" stroke="{d}" stroke-width="3"/>""",
    "coat": """<path d="M215 150 L275 125 L300 210 L325 125 L385 150 L465 195 L495 520 L450 530 L438 340 L445 740 L155 740 L162 340 L150 530 L105 520 L135 195 Z" fill="{c}"/>
<path d="M275 125 L300 210 L325 125 L250 260 L300 330 L350 260 Z" fill="{d}" opacity=".25"/>
<line x1="300" y1="210" x2="300" y2="740" stroke="{d}" stroke-width="2"/>
<circle cx="280" cy="380" r="7" fill="{d}"/><circle cx="320" cy="380" r="7" fill="{d}"/><circle cx="280" cy="470" r="7" fill="{d}"/><circle cx="320" cy="470" r="7" fill="{d}"/>
<path d="M185 560 h60 M355 560 h60" stroke="{d}" stroke-width="3"/>""",
    "jacket": """<path d="M210 170 L275 140 L300 200 L325 140 L390 170 L470 210 L500 460 L455 470 L440 330 L440 600 L160 600 L160 330 L145 470 L100 460 L130 210 Z" fill="{c}"/>
<rect x="160" y="585" width="280" height="30" fill="{d}" opacity=".5"/>
<line x1="300" y1="200" x2="300" y2="615" stroke="{d}" stroke-width="4"/>
<path d="M275 140 L300 200 L325 140" fill="none" stroke="{d}" stroke-width="5"/>
<path d="M190 420 l40 -10 M410 420 l-40 -10" stroke="{d}" stroke-width="3"/>""",
    "shirt": """<path d="M215 170 L270 145 L300 175 L330 145 L385 170 L470 220 L495 470 L455 478 L435 330 L430 650 L170 650 L165 330 L145 478 L105 470 L130 220 Z" fill="{c}"/>
<path d="M270 145 L300 175 L330 145 L340 175 L300 205 L260 175 Z" fill="#fff" opacity=".85"/>
<line x1="300" y1="205" x2="300" y2="650" stroke="{d}" stroke-width="2"/>
<circle cx="300" cy="260" r="4" fill="{d}"/><circle cx="300" cy="340" r="4" fill="{d}"/><circle cx="300" cy="420" r="4" fill="{d}"/><circle cx="300" cy="500" r="4" fill="{d}"/><circle cx="300" cy="580" r="4" fill="{d}"/>
<rect x="215" y="250" width="50" height="45" fill="none" stroke="{d}" stroke-width="2"/>""",
    "knit": """<path d="M215 175 Q300 215 385 175 L470 225 L495 490 L455 498 L435 340 L432 640 L168 640 L165 340 L145 498 L105 490 L130 225 Z" fill="{c}"/>
<path d="M240 170 Q300 235 360 170" fill="none" stroke="{d}" stroke-width="10"/>
<rect x="168" y="605" width="264" height="35" fill="{d}" opacity=".35"/>
<path d="M455 480 l40 8 M105 482 l40 8" stroke="{d}" stroke-width="10" opacity=".35"/>""",
    "polo": """<path d="M210 175 L270 155 L300 185 L330 155 L390 175 L460 230 L430 300 L400 285 L400 620 L200 620 L200 285 L170 300 L140 230 Z" fill="{c}"/>
<path d="M270 155 L300 185 L330 155 L345 190 L300 215 L255 190 Z" fill="{d}" opacity=".35"/>
<line x1="300" y1="200" x2="300" y2="290" stroke="{d}" stroke-width="3"/><circle cx="300" cy="230" r="4" fill="#fff"/><circle cx="300" cy="265" r="4" fill="#fff"/>""",
    "tshirt": """<path d="M215 170 Q300 210 385 170 L470 225 L435 305 L400 290 L400 630 L200 630 L200 290 L165 305 L130 225 Z" fill="{c}"/>
<path d="M245 172 Q300 215 355 172" fill="none" stroke="{d}" stroke-width="6" opacity=".5"/>""",
    "trousers": """<path d="M200 140 L400 140 L420 700 L330 700 L300 290 L270 700 L180 700 Z" fill="{c}"/>
<rect x="200" y="140" width="200" height="30" fill="{d}" opacity=".4"/>
<line x1="300" y1="170" x2="300" y2="290" stroke="{d}" stroke-width="2"/>
<path d="M225 200 L245 320 M375 200 L355 320" stroke="{d}" stroke-width="2" opacity=".5"/>""",
    "sport": """<path d="M215 170 Q300 205 385 170 L470 225 L495 490 L455 498 L435 340 L432 560 L168 560 L165 340 L145 498 L105 490 L130 225 Z" fill="{c}"/>
<path d="M240 172 Q300 220 360 172 L300 240 Z" fill="{d}" opacity=".4"/>
<line x1="300" y1="200" x2="300" y2="560" stroke="{d}" stroke-width="3"/>
<path d="M170 300 L130 495 M430 300 L470 495" stroke="#fff" stroke-width="6" opacity=".7"/>""",
    "shoes": """<path d="M110 520 Q120 430 200 440 L330 470 Q420 480 470 520 Q510 545 500 575 L120 575 Q100 560 110 520 Z" fill="{c}"/>
<rect x="110" y="575" width="395" height="22" rx="8" fill="{d}"/>
<path d="M250 460 Q300 500 360 478" fill="none" stroke="{d}" stroke-width="3"/>""",
    "loafers": """<path d="M100 525 Q110 455 180 455 L340 470 Q440 480 480 520 Q505 545 495 575 L115 575 Q95 560 100 525 Z" fill="{c}"/>
<rect x="105" y="575" width="395" height="18" rx="6" fill="{d}"/>
<path d="M300 475 L420 498 L410 520 L300 505 Z" fill="{d}" opacity=".4"/>""",
    "sneakers": """<path d="M110 520 Q115 420 190 425 L300 455 Q420 470 480 515 Q510 540 500 565 L115 565 Q100 550 110 520 Z" fill="{c}"/>
<rect x="105" y="560" width="400" height="38" rx="14" fill="#fff" stroke="{d}" stroke-width="3"/>
<path d="M230 445 L270 520 M260 452 L300 525 M290 460 L330 530" stroke="{d}" stroke-width="5"/>""",
    "boots": """<path d="M150 250 L300 250 L310 450 Q420 470 470 510 Q500 540 490 570 L140 570 Z" fill="{c}"/>
<rect x="135" y="570" width="360" height="26" rx="6" fill="{d}"/>
<path d="M180 280 L280 280 M180 320 L280 320 M180 360 L285 360" stroke="{d}" stroke-width="3" opacity=".5"/>""",
    "belt": """<rect x="80" y="370" width="440" height="60" rx="6" fill="{c}"/>
<rect x="400" y="350" width="90" height="100" rx="8" fill="none" stroke="#b39b80" stroke-width="12"/>
<circle cx="200" cy="400" r="6" fill="{d}"/><circle cx="250" cy="400" r="6" fill="{d}"/><circle cx="300" cy="400" r="6" fill="{d}"/>""",
    "thermo": """<path d="M220 170 Q300 200 380 170 L455 215 L480 520 L445 525 L425 330 L425 600 L175 600 L175 330 L155 525 L120 520 L145 215 Z" fill="{c}"/>
<path d="M250 172 Q300 205 350 172" fill="none" stroke="{d}" stroke-width="6" opacity=".4"/>
<path d="M175 560 h250" stroke="{d}" stroke-width="8" opacity=".3"/>""",
}

def darken(hex_, f=0.65):
    h = hex_.lstrip("#")
    r, g, b = (int(h[i:i+2], 16) for i in (0, 2, 4))
    return "#%02x%02x%02x" % (int(r*f), int(g*f), int(b*f))

def svg(shape, color, bg="#efe8df", variant=0):
    d = darken(color) if color.lower() not in ("#1c1c1c", "#141414", "#1f2430") else "#555555"
    body = SHAPES[shape].format(c=color, d=d)
    tr = "" if variant == 0 else ' transform="translate(300 400) scale(1.25) translate(-300 -400)"'
    return f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 800" width="600" height="800">
<rect width="600" height="800" fill="{bg}"/>
<ellipse cx="300" cy="{730 if shape not in ('shoes','loafers','sneakers','boots','belt') else 620}" rx="210" ry="18" fill="#000" opacity=".06"/>
<g{tr}>{body}</g>
<text x="300" y="776" font-family="Arial,Helvetica,sans-serif" font-size="15" letter-spacing="5" fill="#8a6a4f" text-anchor="middle">M-TREND · DEMO</text>
</svg>'''

COLORS = {
    "navy": "#1f2a44", "black": "#1c1c1c", "graphite": "#4a4a4a", "grey": "#8d8d8d", "beige": "#cbb59a",
    "brown": "#6b4a32", "white": "#f4f2ee", "blue": "#5b7fa6", "olive": "#5f6146", "burgundy": "#6d2533",
    "camel": "#b08559", "lightblue": "#a9c1d9", "cream": "#e8dcc6", "khaki": "#9b8b63", "indigo": "#2f3e5c",
}

if __name__ == "__main__":
    for shape in SHAPES:
        for cname, chex in COLORS.items():
            for v in (0, 1):
                bg = "#efe8df" if v == 0 else "#f7f3ee"
                with open(os.path.join(OUT, f"{shape}-{cname}-{v+1}.svg"), "w") as f:
                    f.write(svg(shape, chex, bg, v))
    # Баннер и категории
    hero = '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1920 1080" preserveAspectRatio="xMidYMid slice">
<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#3a3a3a"/><stop offset=".55" stop-color="#5a4a3c"/><stop offset="1" stop-color="#8a6a4f"/></linearGradient></defs>
<rect width="1920" height="1080" fill="url(#g)"/>
<g opacity=".18" fill="#f7f3ee"><path d="M1180 230 L1290 180 L1340 330 L1390 180 L1500 230 L1640 300 L1700 760 L1620 780 L1590 520 L1580 1080 L1100 1080 L1090 520 L1060 780 L980 760 L1040 300 Z"/></g>
<text x="1880" y="1050" font-family="Arial" font-size="18" letter-spacing="6" fill="#f7f3ee" opacity=".55" text-anchor="end">ЗАМЕНИТЕ ФОТО В АДМИН-ПАНЕЛИ · DEMO</text>
</svg>'''
    with open(os.path.join(OUT, "hero.svg"), "w") as f:
        f.write(hero)
    hero2 = hero.replace("#3a3a3a", "#d9c8b4").replace("#5a4a3c", "#efe8df").replace("#8a6a4f", "#b39b80").replace('fill="#f7f3ee"', 'fill="#141414"')
    with open(os.path.join(OUT, "hero-2.svg"), "w") as f:
        f.write(hero2)
    print("ok")
