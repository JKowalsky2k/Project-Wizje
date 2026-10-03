"""Generate crawlable public pages from the sanitized publication manifest."""
from html import escape
import json
from pathlib import Path
import re
from xml.etree import ElementTree as ET

SITE_URL = 'https://wizje.eu/'
IMAGE_NS = 'http://www.google.com/schemas/sitemap-image/1.1'
SITEMAP_NS = 'http://www.sitemaps.org/schemas/sitemap/0.9'


def write_seo(destination, collections):
    sections, navigation, images = [], [], []
    for index, collection in enumerate(collections, 1):
        title = escape(str(collection['title']))
        year = escape(str(collection.get('year', '')))
        anchor = f'collection-{index}'
        navigation.append(f'<a href="#{anchor}">{title} · {year}</a>')
        figures = []
        for number, photo in enumerate(collection['photos'], 1):
            src, detail = photo['src'], photo.get('detail', photo['src'])
            for path in (src, detail):
                if not re.fullmatch(r'assets/collections/previews/[a-f0-9]+-(?:480|2000)\.jpg', path):
                    raise ValueError('SEO gallery requires public photo previews.')
            medium = {'analog': 'Film photography', 'digital': 'Digital photography'}.get(photo.get('medium'), 'Photography')
            label = f'{title} — {medium.lower()} {number} · {year}'
            # Match the dimensions of the actual large image, not the cropped thumbnail.
            dimensions = ''
            width, height = photo.get('detailWidth'), photo.get('detailHeight')
            if detail != src and isinstance(width, int) and isinstance(height, int) and width > 0 and height > 0:
                dimensions = f' width="{width}" height="{height}"'
            figures.append(f'<figure><a href="{detail}"><img src="{detail}" alt="{label}"{dimensions} loading="lazy" decoding="async"></a><figcaption>{label}</figcaption></figure>')
            images.append(SITE_URL + detail)
        sections.append(f'<section id="{anchor}" aria-labelledby="{anchor}-title"><h2 id="{anchor}-title">{title} <small>{year}</small></h2><div class="gallery-grid">{"".join(figures)}</div></section>')

    schema = json.dumps({'@context': 'https://schema.org', '@type': 'ImageGallery',
                         'name': 'Wizje — Photography collections', 'url': SITE_URL + 'gallery.html',
                         'isPartOf': {'@type': 'WebSite', 'name': 'Wizje', 'url': SITE_URL}}, ensure_ascii=False)
    html = f'''<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="theme-color" content="#090909">
  <title>Photography collections — Wizje</title>
  <meta name="description" content="Explore Wizje photography collections. Browse original film and digital photographs, available as posters and prints.">
  <meta name="robots" content="index, follow, max-image-preview:large">
  <link rel="canonical" href="{SITE_URL}gallery.html">
  <link rel="icon" href="favicon.svg" type="image/svg+xml">
  <meta property="og:type" content="website">
  <meta property="og:site_name" content="Wizje">
  <meta property="og:title" content="Photography collections — Wizje">
  <meta property="og:description" content="Original film and digital photography, posters and prints.">
  <meta property="og:url" content="{SITE_URL}gallery.html">
  <meta property="og:image" content="{SITE_URL}assets/logo/social.jpg">
  <meta property="og:image:alt" content="Wizje">
  <meta name="twitter:card" content="summary_large_image">
  <script type="application/ld+json">{schema}</script>
  <style>
    :root {{ color-scheme: dark; font-family: "Helvetica Neue", Helvetica, sans-serif; background: #090909; color: #f3f1ec; }}
    * {{ box-sizing: border-box; }}
    body {{ margin: 0; padding: clamp(24px, 5vw, 72px); }}
    main, header, footer {{ max-width: 1280px; margin: auto; }}
    a {{ color: inherit; text-underline-offset: 4px; }}
    a:focus-visible {{ outline: 2px solid #f3f1ec; outline-offset: 5px; }}
    h1 {{ font-size: clamp(32px, 6vw, 64px); font-weight: 400; }}
    p, figcaption, small {{ color: #92918c; line-height: 1.6; }}
    nav {{ display: flex; flex-wrap: wrap; gap: 16px 24px; margin: 32px 0; }}
    section {{ margin: 64px 0; scroll-margin-top: 24px; }}
    h2 {{ font-weight: 400; border-bottom: 1px solid #30302d; padding-bottom: 16px; }}
    small {{ font-size: 14px; margin-left: 12px; }}
    .gallery-grid {{ display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 260px), 1fr)); gap: 32px; }}
    figure {{ margin: 0; }}
    img {{ display: block; width: 100%; height: auto; aspect-ratio: 4 / 3; object-fit: contain; background: #111; }}
    figcaption {{ margin-top: 12px; font-size: 13px; }}
    footer {{ border-top: 1px solid #30302d; padding-top: 24px; }}
  </style>
</head>
<body>
  <header><a href="./">Wizje — Home</a></header>
  <main>
    <h1>Photography collections</h1>
    <p>Original film and digital photographs by Wizje, available as posters and prints. Select a photograph to view it in detail.</p>
    <nav aria-label="Collections">{''.join(navigation)}</nav>
    {''.join(sections)}
  </main>
  <footer><a href="./">Explore prints and ordering options</a> · <a href="https://www.instagram.com/wizje.poland/">Wizje on Instagram</a></footer>
</body>
</html>
'''
    (destination / 'gallery.html').write_text(html, encoding='utf-8')
    (destination / 'robots.txt').write_text(f'User-agent: *\nAllow: /\n\nSitemap: {SITE_URL}sitemap.xml\n', encoding='utf-8')
    ET.register_namespace('', SITEMAP_NS)
    ET.register_namespace('image', IMAGE_NS)
    sitemap = ET.Element(f'{{{SITEMAP_NS}}}urlset')
    for page in ('', 'gallery.html'):
        entry = ET.SubElement(sitemap, f'{{{SITEMAP_NS}}}url')
        ET.SubElement(entry, f'{{{SITEMAP_NS}}}loc').text = SITE_URL + page
        if page:
            for image in dict.fromkeys(images):
                element = ET.SubElement(entry, f'{{{IMAGE_NS}}}image')
                ET.SubElement(element, f'{{{IMAGE_NS}}}loc').text = image
    ET.ElementTree(sitemap).write(destination / 'sitemap.xml', encoding='utf-8', xml_declaration=True)


if __name__ == '__main__':
    root = Path(__file__).resolve().parents[1]
    manifest = (root / 'assets/collections/manifest.js').read_text(encoding='utf-8')
    write_seo(root, json.loads(manifest.split(' = ', 1)[1].rstrip(';\n')))
