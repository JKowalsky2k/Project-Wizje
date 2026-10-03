#!/usr/bin/env python3
"""Build the photo manifest, or serve the site with automatic folder discovery."""
import argparse
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
import json
from pathlib import Path
import re
from urllib.parse import quote, urlsplit, unquote
import posixpath
from threading import Lock

from film_catalog import public_film
from photo_previews import prepare_previews
from admin_panel import LocalAdmin
from display_order import read_order, ordered
from seo import write_seo

ROOT = Path(__file__).resolve().parents[1]
PHOTO_ROOT = ROOT / 'assets/collections/2026'
MANIFEST = ROOT / 'assets/collections/manifest.js'
MANIFEST_LOCK = Lock()
EXTENSIONS = {'.jpg', '.jpeg', '.png', '.webp', '.avif'}
# Source rectangles in the existing 2000 × 2000 Canva boards.
# These are display-only crops; the original files remain intact.
COLLECTIONS = [
    ('alps', [(234, 417, 396, 550), (809, 417, 395, 550), (1383, 417, 395, 550)]),
    ('cars', [(229, 466, 394, 549), (803, 466, 394, 549), (1377, 466, 394, 549)]),
    ('dolomites', [(234, 417, 394, 550), (803, 417, 394, 550), (1372, 417, 394, 550)]),
    ('torun', [(229, 417, 394, 550), (803, 417, 394, 550), (1377, 417, 394, 550)]),
]


def natural_key(path):
    return [int(part) if part.isdigit() else part.casefold()
            for part in re.split(r'(\d+)', path.name)]


def read_photo_types(photo_root):
    path = photo_root / 'photo-types.json'
    if not path.exists():
        return {}
    data = json.loads(path.read_text(encoding='utf-8'))
    if not isinstance(data, dict):
        raise ValueError(f'{path}: expected an object')
    overrides = data.get('photos', {})
    if not isinstance(overrides, dict):
        raise ValueError(f'{path}: photos must be an object')
    for key, value in overrides.items():
        if value not in (None, 'analog', 'digital'):
            raise ValueError(f'{path}: invalid medium for {key}: {value}')
    return overrides


def build_manifest(photo_root=PHOTO_ROOT, year=None):
    year = str(year or (photo_root.name if re.fullmatch(r"[12]\d{3}", photo_root.name) else "2026"))
    result = []
    display_order = read_order(photo_root)
    overrides = read_photo_types(photo_root)
    types_path = photo_root / 'photo-types.json'
    details = json.loads(types_path.read_text()).get('filmDetails', {}) if types_path.exists() else {}
    color_modes = json.loads(types_path.read_text()).get('colorModes', {}) if types_path.exists() else {}
    orientations = json.loads(types_path.read_text()).get('orientations', {}) if types_path.exists() else {}
    info_path = photo_root / "collection-info.json"
    info = json.loads(info_path.read_text(encoding="utf-8")) if info_path.exists() else {}
    known = dict(COLLECTIONS)
    photo_root.mkdir(parents=True, exist_ok=True)
    # Existing curated order first; new collection folders follow alphabetically.
    folders = {p.name: p for p in photo_root.iterdir()
               if p.is_dir() and not p.is_symlink() and not p.name.startswith('.')}
    names = list(known) + sorted(set(folders) - set(known), key=str.casefold)
    names = ordered(names, display_order.get('collections', []))
    for name in names:
        folder = photo_root / name
        files = sorted((p for p in folder.iterdir()
                        if p.is_file() and not p.is_symlink()
                        and not p.name.startswith('.')
                        and p.suffix.lower() in EXTENSIONS), key=natural_key) if folder.is_dir() else []
        files = ordered(files, display_order.get('photos', {}).get(name, []), key=lambda p: p.name)
        prefix = f'assets/collections/{year}/{quote(name)}'
        photos = []
        for p in files:
            photo = {'src': f'{prefix}/{quote(p.name)}', 'orientation': orientations.get(f'{name}/{p.name}', 'portrait')}
            if color_modes.get(f'{name}/{p.name}') in ('color', 'monochrome'):
                photo['colorMode'] = color_modes[f'{name}/{p.name}']
            medium = overrides.get(f'{name}/{p.name}')
            if medium is not None:
                photo['medium'] = medium
            if medium == 'analog':
                photo.update(public_film(details.get(f'{name}/{p.name}', {})))
            photos.append(photo)
        if not photos and name in known and (photo_root / f'{name}.png').is_file():
            photos = [{'src': f'{prefix}.png', 'crop': crop, 'sourceSize': [2000, 2000]}
                      for crop in known[name]]
        if photos:
            locations = info.get(name, {}).get('locations', [info[name]['location']] if info.get(name, {}).get('location') else [])
            result.append({'id': name, 'year': year, 'title': info.get(name, {}).get('title', name.replace('-', ' ').replace('_', ' ').capitalize()), 'photos': photos, **({'locations': locations, 'location': locations[0]} if locations else {})})

    return result


def build_all_manifests(collection_root=None):
    collection_root = collection_root or ROOT / 'assets/collections'
    if not collection_root.exists():
        return []
    years = sorted((p for p in collection_root.iterdir()
                    if re.fullmatch(r'[12]\d{3}', p.name) and p.is_dir() and not p.is_symlink()),
                   key=lambda p: p.name, reverse=True)
    return [collection for folder in years for collection in build_manifest(folder, folder.name)]


def write_manifest():
    content = '// Generated by tools/collections.py; edit the photo folders instead.\n'
    collections = prepare_previews(build_all_manifests(), ROOT)
    content += 'window.ZWIDY_COLLECTIONS = ' + json.dumps(collections, ensure_ascii=False, indent=2) + ';\n'
    if not MANIFEST.exists() or MANIFEST.read_text(encoding='utf-8') != content:
        MANIFEST.write_text(content, encoding='utf-8')
    # Legacy cropped boards cannot be published as individual photographs.
    if all(not photo.get('crop') for collection in collections for photo in collection['photos']):
        write_seo(ROOT, collections)


class Handler(SimpleHTTPRequestHandler):
    def do_GET(self):
        if self.server.admin.get(self):
            return
        if not self.server.admin.valid_host(self):
            self.send_error(403)
            return
        path = unquote(urlsplit(self.path).path)
        public = re.fullmatch(
            r'/(?:index\.html|styles\.css|script\.js|collections\.js|globe\.js|favicon\.svg|favicon\.ico|robots\.txt|sitemap\.xml|gallery\.html|font-preview\.html)?'
            r'|/assets/logo/(?:logo\.css|social\.jpg)'
            r'|/assets/fonts/[a-zA-Z0-9_-]+\.(?:woff2?|ttf|otf|txt)'
            r'|/assets/collections/(?:manifest\.js|previews/[a-f0-9]+-(?:480|2000)\.jpg)', path)
        if not public:
            self.send_error(404)
            return
        target = ROOT / (path.lstrip('/') or 'index.html')
        if any(part.is_symlink() for part in (target, *target.parents)) or not target.is_file():
            self.send_error(404)
            return
        if urlsplit(self.path).path == '/assets/collections/manifest.js':
            with MANIFEST_LOCK:
                write_manifest()
        super().do_GET()

    def do_POST(self):
        self.server.admin.post(self)

    def do_HEAD(self):
        # Avoid serving private source files through the inherited HEAD handler.
        self.send_error(405)

    def log_message(self, format, *args):
        if urlsplit(self.path).path.startswith('/admin'):
            return  # Do not log administrator requests.
        super().log_message(format, *args)

    def end_headers(self):
        if urlsplit(self.path).path == '/assets/collections/manifest.js':
            self.send_header('Cache-Control', 'no-store')
        super().end_headers()


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--serve', action='store_true', help='Serve the site; refresh discovers new photos')
    parser.add_argument('--port', type=int, default=8000)
    args = parser.parse_args()
    write_manifest()
    if args.serve:
        server = ThreadingHTTPServer(('127.0.0.1', args.port), partial(Handler, directory=str(ROOT)))
        server.admin = LocalAdmin(ROOT, PHOTO_ROOT, write_manifest, MANIFEST_LOCK)
        print(f'Wizje: http://127.0.0.1:{args.port} (Ctrl+C to stop)', flush=True)
        print(f'Panel administratora: http://127.0.0.1:{args.port}/admin (logowanie hasłem)', flush=True)
        print(f'Lokalne dane logowania (poza stroną): {server.admin.password_path}', flush=True)
        try:
            server.serve_forever()
        except KeyboardInterrupt:
            server.server_close()
    else:
        print('Updated assets/collections/manifest.js')
