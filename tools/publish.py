#!/usr/bin/env python3
"""Prepare an isolated static website and ZIP archive, without local admin files."""
import argparse
from datetime import datetime
from importlib.util import module_from_spec, spec_from_file_location
import json
from pathlib import Path, PurePosixPath
import re
import shutil
import tempfile
from urllib.parse import unquote, urlsplit
import zipfile

from photo_previews import prepare_previews
from seo import write_seo

ROOT = Path(__file__).resolve().parents[1]
PUBLIC_FILES = ('.htaccess', 'index.html', 'styles.css', 'script.js', 'collections.js', 'globe.js', 'favicon.svg', 'favicon.ico', 'assets/logo/social.jpg')
CSS_URL = re.compile(r'url\(\s*[\'\"]?([^\'\"\)]+?)[\'\"]?\s*\)', re.I)


def source_file(root, relative):
    """Never follow links, traverse outside the project, or copy hidden files."""
    relative = PurePosixPath(relative)
    if relative.is_absolute() or (relative.as_posix() != '.htaccess' and any(part.startswith('.') for part in relative.parts)):
        raise ValueError(f'Niedozwolona ścieżka: {relative}')
    current = root
    for part in relative.parts:
        current = current / part
        if current.is_symlink():
            raise ValueError(f'Nie publikuję dowiązań symbolicznych: {relative}')
    if not current.is_file():
        raise ValueError(f'Brakuje pliku strony: {relative}')
    return current


def build_public_tree(root, destination, collections):
    copied = set()

    def copy(relative):
        relative = PurePosixPath(relative).as_posix()
        if relative in copied:
            return
        source = source_file(root, relative)
        target = destination / relative
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(source, target)
        copied.add(relative)

    for name in PUBLIC_FILES:
        copy(name)

    # Follow only the site's CSS/font dependencies, with an explicit asset boundary.
    pending = ['styles.css']
    visited = set()
    while pending:
        css = pending.pop()
        if css in visited:
            continue
        visited.add(css)
        for url in CSS_URL.findall(source_file(root, css).read_text(encoding='utf-8')):
            parsed = urlsplit(url)
            if parsed.scheme or parsed.netloc or parsed.query or parsed.fragment or url.startswith('/'):
                raise ValueError(f'Wymagany lokalny zasób CSS bez parametrów: {url}')
            import posixpath
            relative = posixpath.normpath(str(PurePosixPath(css).parent / unquote(parsed.path)))
            suffix = PurePosixPath(relative).suffix.lower()
            if relative == 'assets/logo/logo.css':
                pending.append(relative)
            elif not (relative.startswith('assets/fonts/') and suffix in ('.woff', '.woff2', '.ttf', '.otf')):
                raise ValueError(f'Zasób spoza listy publikacji: {relative}')
            copy(relative)
            if relative.startswith('assets/fonts/'):
                stem = str(PurePosixPath(relative).with_suffix(''))
                licenses = [stem + '-OFL.txt', stem + '-LICENSE.txt']
                available = [name for name in licenses if (root / name).is_file()]
                if not available:
                    raise ValueError(f'Brak licencji czcionki: {relative}')
                for name in available:
                    copy(name)

    public_collections = []
    photo_count = 0
    for collection in collections:
        photos = []
        for photo in collection['photos']:
            src = photo['src']
            if not re.fullmatch(r'assets/collections/previews/[a-f0-9]+-480\.jpg', src):
                raise ValueError('Kolekcja wymaga osobnych zdjęć i wygenerowanych podglądów. '
                                 'Dodaj zdjęcia przez panel; stare plansze Canva nie są publikowane.')
            copy(src)
            public_photo = {key: photo[key] for key in ('src', 'width', 'height', 'medium', 'film', 'filmBrand', 'iso', 'detail', 'sourceWidth', 'sourceHeight', 'detailWidth', 'detailHeight', 'orientation', 'colorMode') if key in photo}
            if photo.get('detail'):
                if not re.fullmatch(r'assets/collections/previews/[a-f0-9]+-2000\.jpg', photo['detail']):
                    raise ValueError('Nieprawidłowy duży podgląd zdjęcia.')
                copy(photo['detail'])
            photos.append(public_photo)
            photo_count += 1
        locations = collection.get('locations', [collection['location']] if collection.get('location') else [])
        public_locations = [{key: location[key] for key in ('name', 'nameEn', 'lat', 'lon') if key in location} for location in locations]
        public_collections.append({'id': collection['id'], 'year': str(collection.get('year', '2026')), 'title': collection['title'], 'photos': photos,
                                   **({'locations': public_locations, 'location': public_locations[0]} if public_locations else {})})
    manifest = destination / 'assets/collections/manifest.js'
    manifest.parent.mkdir(parents=True, exist_ok=True)
    manifest.write_text('// Public website manifest. Generated by tools/publish.py.\n'
                        'window.ZWIDY_COLLECTIONS = ' + json.dumps(public_collections, ensure_ascii=False, indent=2)
                        + ';\n', encoding='utf-8')
    write_seo(destination, public_collections)
    return photo_count


def publish(root=ROOT):
    spec = spec_from_file_location('wizje_collection_builder', Path(__file__).with_name('collections.py'))
    builder = module_from_spec(spec)
    spec.loader.exec_module(builder)
    collections = prepare_previews(builder.build_all_manifests(root / 'assets/collections'), root)
    output = root / 'dist'
    if output.is_symlink():
        raise ValueError('Folder dist nie może być dowiązaniem symbolicznym.')
    output.mkdir(exist_ok=True)
    name = 'wizje-' + datetime.now().strftime('%Y%m%d-%H%M%S-%f')
    folder, archive = output / name, output / (name + '.zip')
    # Every run creates a new release. Older exports and source files are preserved.
    with tempfile.TemporaryDirectory(prefix='.publish-', dir=output) as temporary:
        stage = Path(temporary)
        site = stage / 'site'
        site.mkdir()
        count = build_public_tree(root, site, collections)
        staged_zip = stage / 'website.zip'
        with zipfile.ZipFile(staged_zip, 'w', zipfile.ZIP_DEFLATED) as bundle:
            for file in sorted(site.rglob('*')):
                if file.is_file():
                    bundle.write(file, file.relative_to(site).as_posix())
        site.rename(folder)
        staged_zip.rename(archive)
    return folder, archive, count, len(collections)


def main():
    argparse.ArgumentParser(description=__doc__).parse_args()
    try:
        folder, archive, photos, collections = publish()
    except (OSError, ValueError, RuntimeError) as error:
        raise SystemExit(f'Nie udało się przygotować strony: {error}')
    print(f'Gotowe: {collections} kolekcji, {photos} zdjęć.')
    print(f'Folder do publikacji: {folder}')
    print(f'Archiwum ZIP: {archive}')
    print(f'Rozmiar ZIP: {archive.stat().st_size / 1024 / 1024:.2f} MB')
    print('Na hosting wyślij ZAWARTOŚĆ folderu albo rozpakuj ZIP w katalogu strony.')
    print('Panel administratora, dane logowania i oryginały zdjęć nie są częścią paczki.')


if __name__ == '__main__':
    main()
