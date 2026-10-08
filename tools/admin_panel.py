"""Local-only authenticated collection editor; no third-party dependencies."""
from datetime import datetime, timezone
import ipaddress
import math
import shutil
import hashlib
import hmac
from http.cookies import SimpleCookie
import json
from pathlib import Path
import re
import secrets
import unicodedata
import time
from display_order import DEFAULT_COLLECTIONS, read_order, ordered
from urllib.parse import parse_qs, quote, unquote, urlsplit

from film_catalog import FILMS, ISO_VALUES, validate_film

from admin_security import credential_path, migrate_credentials, save_credentials

MEDIA = (None, 'analog', 'digital')
EXTENSIONS = {'.jpg', '.jpeg', '.png', '.webp', '.avif'}
MAX_UPLOAD = 50 * 1024 * 1024
KNOWN_TITLES = {'alps': 'Alpy', 'cars': 'Samochody', 'dolomites': 'Dolomity', 'torun': 'Toruń', 'planes': 'Samoloty'}


ERRORS_EN = {
 'Nieprawidłowa ścieżka biblioteki.': 'Invalid library path.',
 'Nie znaleziono zdjęcia w bibliotece.': 'Photo not found in the library.',
 'Kolekcja zawiera już plik o tej nazwie.': 'This collection already contains a file with that name.',
 'Potwierdź trwałe usunięcie zdjęcia.': 'Confirm permanent photo deletion.',
 'Nie można bezpiecznie wyczyścić kopii zdjęcia.': 'Cannot safely clean up photo copies.',
 'Trwałe usuwanie nie zostało zakończone. Odśwież panel, aby ponowić czyszczenie.': 'Permanent deletion is incomplete. Refresh the panel to retry cleanup.',
 'Nie można usunąć kolekcji zawierającej dowiązania symboliczne.': 'Cannot delete a collection containing symbolic links.',
 'Nie udało się przygotować paczki. Sprawdź zdjęcia i wolne miejsce na dysku.': 'Could not prepare the package. Check your photos and available disk space.',
 'Przygotuj nową paczkę w panelu.': 'Prepare a new package in the panel.',
'Wybierz ANALOG lub DIGITAL.': 'Choose ANALOG or DIGITAL.',
 'Nieprawidłowa kolekcja.': 'Invalid collection.',
 'Nie znaleziono kolekcji.': 'Collection not found.',
 'Nieprawidłowa nazwa pliku.': 'Invalid filename.',
 'Obsługiwane zdjęcia: JPG, PNG, WebP i AVIF.': 'Supported photos: JPG, PNG, WebP and AVIF.',
 'Podaj nazwę kolekcji (maks. 80 znaków).': 'Enter a collection name (up to 80 characters).',
 'Nazwa musi zawierać litery lub cyfry.': 'The name must contain letters or numbers.',
 'Kolekcja o takiej nazwie już istnieje.': 'A collection with this name already exists.',
 'Nie znaleziono zdjęcia.': 'Photo not found.',
 'Wybierz technikę dodawanych zdjęć.': 'Choose a technique for the uploaded photos.',
 'Maksymalny rozmiar zdjęcia to 50 MB.': 'The maximum photo size is 50 MB.',
 'Plik nie jest zdjęciem w zadeklarowanym formacie.': 'The file is not a photo in the declared format.',
 'Panel działa wyłącznie lokalnie.': 'This panel only works locally.',
 'Zaloguj się ponownie w panelu.': 'Sign in to the panel again.',
 'Nieprawidłowe hasło.': 'Incorrect password.',
 'Hasło musi mieć od 8 do 128 znaków.': 'Use a password between 8 and 128 characters.',
 'Hasła nie są takie same.': 'Passwords do not match.',
 'Hasło jest już ustawione. Odśwież stronę i zaloguj się.': 'A password is already set. Refresh the page and sign in.',
 'Najpierw ustaw hasło. Odśwież stronę.': 'Set a password first. Refresh the page.',
 'Zbyt wiele prób. Spróbuj ponownie za minutę.': 'Too many attempts. Try again in one minute.',
 'Nie znaleziono strony.': 'Page not found.',
 'Nie znaleziono operacji.': 'Operation not found.',
 'Odśwież panel i spróbuj ponownie.': 'Refresh the panel and try again.',
 'Plik lub żądanie jest zbyt duże.': 'The file or request is too large.',
 'Przesyłanie zostało przerwane.': 'The upload was interrupted.',
 'Nieprawidłowe dane.': 'Invalid data.',
 'Nieprawidłowe dane. Odśwież panel i spróbuj ponownie.': 'Invalid data. Refresh the panel and try again.',
 'Nie udało się zapisać zmiany lub odczytać zdjęcia. Dotychczasowe pliki zostały zachowane.': 'Could not '
                                                                                              'save the '
                                                                                              'change or '
                                                                                              'read the '
                                                                                              'photo. '
                                                                                              'Existing '
                                                                                              'files have '
                                                                                              'been '
                                                                                              'preserved.'}

class EditorError(Exception):
    def __init__(self, message, status=400):
        super().__init__(message)
        self.status = status


def read_json(path, default):
    return json.loads(path.read_text(encoding='utf-8')) if path.exists() else default


def write_json(path, data):
    temp = path.with_name('.' + path.name + '.' + secrets.token_hex(6))
    try:
        temp.write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
        temp.replace(path)
    finally:
        temp.unlink(missing_ok=True)


def valid_medium(value):
    if value not in MEDIA:
        raise EditorError('Wybierz ANALOG lub DIGITAL.')
    return value


def slugify(name):
    text = unicodedata.normalize('NFKD', name.lower().replace('ł', 'l'))
    text = text.encode('ascii', 'ignore').decode()
    return re.sub(r'[^a-z0-9]+', '-', text).strip('-')[:80]


class EditorStore:
    def __init__(self, root, photo_root, rebuild, trash_root=None):
        self.root = root
        self.photo_root = photo_root
        self.rebuild = rebuild
        self.types_path = photo_root / 'photo-types.json'
        self.info_path = photo_root / 'collection-info.json'
        self.order_path = photo_root / 'display-order.json'
        self.trash_root = trash_root or credential_path(root).parent / 'trash'
        from media_library import MediaLibrary
        self.library = MediaLibrary(self)

    def types(self):
        return read_json(self.types_path, {'photos': {}})

    def folder(self, name):
        if not isinstance(name, str) or not name or name.startswith('.') or '/' in name or '\\' in name:
            raise EditorError('Nieprawidłowa kolekcja.')
        path = self.photo_root / name
        if path.is_symlink() or not path.is_dir() or path.resolve().parent != self.photo_root.resolve():
            raise EditorError('Nie znaleziono kolekcji.', 404)
        return path

    def photo(self, collection, name):
        folder = self.folder(collection)
        if not isinstance(name, str) or not name or name.startswith('.') or '/' in name or '\\' in name or len(name) > 160:
            raise EditorError('Nieprawidłowa nazwa pliku.')
        path = folder / name
        if path.suffix.lower() not in EXTENSIONS or path.is_symlink():
            raise EditorError('Obsługiwane zdjęcia: JPG, PNG, WebP i AVIF.')
        return path

    def state(self):
        config = self.types()
        display_order = read_order(self.photo_root)
        info = read_json(self.info_path, {})
        previews = {}
        manifest = self.root / 'assets/collections/manifest.js'
        if manifest.exists():
            data = json.loads(manifest.read_text().split(' = ', 1)[1].rstrip(';\n'))
            previews = {p.get('original', p['src']): p['src'] for c in data for p in c['photos']}
        items = []
        for folder in sorted(self.photo_root.iterdir(), key=lambda p: p.name.casefold()):
            if not folder.is_dir() or folder.is_symlink() or folder.name.startswith('.'):
                continue
            photos = []
            for file in sorted(folder.iterdir(), key=lambda p: [int(x) if x.isdigit() else x.casefold() for x in re.split(r'(\d+)', p.name)]):
                if not file.is_file() or file.is_symlink() or file.name.startswith('.') or file.suffix.lower() not in EXTENSIONS:
                    continue
                key = f'{folder.name}/{file.name}'
                src = file.relative_to(self.root).as_posix()
                src = '/'.join(quote(part) for part in src.split('/'))
                photos.append({'name': file.name, 'preview': '/' + previews.get(src, src),
                               'medium': config.get('photos', {}).get(key),
                               'orientation': config.get('orientations', {}).get(key, 'portrait'),
                               'colorMode': config.get('colorModes', {}).get(key),
                               **config.get('filmDetails', {}).get(key, {})})
            photos = ordered(photos, display_order.get('photos', {}).get(folder.name, []), key=lambda p: p['name'])
            items.append({'id': folder.name, 'title': info.get(folder.name, {}).get('title', KNOWN_TITLES.get(folder.name, folder.name.capitalize())),
                          'customTitle': 'title' in info.get(folder.name, {}), 'location': (info.get(folder.name, {}).get('locations') or [info.get(folder.name, {}).get('location')])[0],
                          'locations': info.get(folder.name, {}).get('locations', [info[folder.name]['location']] if info.get(folder.name, {}).get('location') else []), 'photos': photos})
        items = ordered(items, DEFAULT_COLLECTIONS, key=lambda c: c['id'])
        return ordered(items, display_order.get('collections', []), key=lambda c: c['id'])

    def reorder(self, names, collection=None, expected=None):
        items = self.state()
        if collection is None:
            current = [item['id'] for item in items]
        else:
            self.folder(collection)
            current = [p['name'] for item in items if item['id'] == collection for p in item['photos']]
        if not isinstance(names, list) or any(not isinstance(name, str) for name in names):
            raise EditorError('Nieprawidłowa kolejność / Invalid display order.')
        if len(names) != len(current) or len(set(names)) != len(names) or set(names) != set(current):
            raise EditorError('Lista uległa zmianie. Odśwież panel / The list changed. Refresh the panel.', 409)
        if expected != current:
            raise EditorError('Kolejność uległa zmianie. Odśwież panel / The order changed. Refresh the panel.', 409)
        before = self.order_path.read_bytes() if self.order_path.exists() else None
        config = read_order(self.photo_root)
        if collection is None:
            config['collections'] = names
        else:
            config.setdefault('photos', {})[collection] = names
        derived_paths = [self.root / name for name in ('assets/collections/manifest.js', 'gallery.html', 'sitemap.xml', 'robots.txt')]
        snapshots = {path: path.read_bytes() if path.exists() else None for path in derived_paths}
        try:
            write_json(self.order_path, config)
            self.rebuild()
        except Exception:
            if before is None:
                self.order_path.unlink(missing_ok=True)
            else:
                self.order_path.write_bytes(before)
            for path, content in snapshots.items():
                if content is None:
                    path.unlink(missing_ok=True)
                else:
                    path.write_bytes(content)
            raise

    def create(self, name):
        if not isinstance(name, str) or not name.strip() or len(name.strip()) > 80:
            raise EditorError('Podaj nazwę kolekcji (maks. 80 znaków).')
        slug = slugify(name)
        if not slug:
            raise EditorError('Nazwa musi zawierać litery lub cyfry.')
        folder = self.photo_root / slug
        if folder.exists():
            raise EditorError('Kolekcja o takiej nazwie już istnieje.', 409)
        before_info = read_json(self.info_path, {})
        info = dict(before_info)
        info[slug] = {'title': name.strip()}
        folder.mkdir()
        try:
            write_json(self.info_path, info)
            self.rebuild()
        except Exception:
            write_json(self.info_path, before_info)
            folder.rmdir()
            raise
        return slug

    def set_location(self, collection, location):
        self.set_locations(collection, [] if location is None else [location])

    def set_locations(self, collection, locations):
        self.folder(collection)
        if not isinstance(locations, list):
            raise EditorError('Nieprawidłowa lista lokalizacji / Invalid location list.')
        normalized = []
        seen = set()
        for location in locations:
            if not isinstance(location, dict):
                raise EditorError('Nieprawidłowa lokalizacja / Invalid location.')
            name = location.get('name')
            if not isinstance(name, str) or not name.strip() or len(name.strip()) > 120:
                raise EditorError('Podaj nazwę miejsca (maks. 120 znaków) / Enter a place name (max. 120 characters).')
            for key, limit in [('lat', 90), ('lon', 180)]:
                value = location.get(key)
                if type(value) not in (int, float) or not math.isfinite(value) or abs(value) > limit:
                    raise EditorError('Nieprawidłowe współrzędne / Invalid coordinates.')
            name_en = location.get('nameEn', '')
            if not isinstance(name_en, str) or len(name_en.strip()) > 120:
                raise EditorError('Nazwa angielska: maks. 120 znaków / English name: max. 120 characters.')
            name_en = name_en.strip() or {'Alpy Francuskie': 'French Alps', 'Dolomity · Włochy': 'Dolomites · Italy'}.get(name.strip(), '')
            location = {'name': name.strip(), 'lat': round(location['lat'], 2), 'lon': round(location['lon'], 2)}
            if name_en:
                location['nameEn'] = name_en
            point = (location['lat'], location['lon'])
            if point not in seen:
                normalized.append(location)
                seen.add(point)
        before = read_json(self.info_path, {})
        config = json.loads(json.dumps(before))
        entry = config.setdefault(collection, {})
        entry.pop('location', None)
        if not normalized:
            entry.pop('locations', None)
            if not entry:
                config.pop(collection)
        else:
            entry['locations'] = normalized
        write_json(self.info_path, config)
        try:
            self.rebuild()
        except Exception:
            write_json(self.info_path, before)
            raise

    def set_medium(self, collection, name, medium):
        medium = valid_medium(medium)
        path = self.photo(collection, name)
        if not path.is_file():
            raise EditorError('Nie znaleziono zdjęcia.', 404)
        before = self.types()
        config = json.loads(json.dumps(before))
        config.setdefault('photos', {})[f'{collection}/{name}'] = medium
        if medium != 'analog':
            config.get('filmDetails', {}).pop(f'{collection}/{name}', None)
        write_json(self.types_path, config)
        try:
            self.rebuild()
        except Exception:
            write_json(self.types_path, before)
            raise

    def set_orientation(self, collection, name, orientation):
        if orientation not in ('portrait', 'landscape'):
            raise EditorError('Nieprawidłowa orientacja / Invalid orientation.')
        if not self.photo(collection, name).is_file():
            raise EditorError('Nie znaleziono zdjęcia.', 404)
        before = self.types()
        config = json.loads(json.dumps(before))
        config.setdefault('orientations', {})[f'{collection}/{name}'] = orientation
        write_json(self.types_path, config)
        try:
            self.rebuild()
        except Exception:
            write_json(self.types_path, before)
            raise

    def set_color_mode(self, collection, name, color_mode):
        if color_mode not in ('color', 'monochrome'):
            raise EditorError('Nieprawidłowa kolorystyka / Invalid color mode.')
        if not self.photo(collection, name).is_file():
            raise EditorError('Nie znaleziono zdjęcia.', 404)
        before = self.types()
        config = json.loads(json.dumps(before))
        config.setdefault('colorModes', {})[f'{collection}/{name}'] = color_mode
        write_json(self.types_path, config)
        try:
            self.rebuild()
        except Exception:
            write_json(self.types_path, before)
            raise

    def set_film(self, collection, name, film=None, iso=None):
        details = validate_film(film, iso)
        path = self.photo(collection, name)
        if not path.is_file():
            raise EditorError('Nie znaleziono zdjęcia.', 404)
        before = self.types()
        key = f'{collection}/{name}'
        if before.get('photos', {}).get(key) != 'analog':
            raise EditorError('Film i ISO dotyczą zdjęć analogowych / Film and ISO require ANALOG.')
        config = json.loads(json.dumps(before))
        config.setdefault('filmDetails', {}).pop(key, None)
        if details:
            config['filmDetails'][key] = details
        write_json(self.types_path, config)
        try:
            self.rebuild()
        except Exception:
            write_json(self.types_path, before)
            raise

    def upload(self, collection, name, medium, content, film=None, iso=None, orientation='portrait', color_mode='color'):
        if color_mode not in ('color', 'monochrome'):
            raise EditorError('Nieprawidłowa kolorystyka / Invalid color mode.')
        if orientation not in ('portrait', 'landscape'):
            raise EditorError('Nieprawidłowa orientacja / Invalid orientation.')
        medium = valid_medium(medium)
        details = validate_film(film, iso)
        if details and medium != 'analog':
            raise EditorError('Film i ISO dotyczą zdjęć analogowych / Film and ISO require ANALOG.')
        if medium is None:
            raise EditorError('Wybierz technikę dodawanych zdjęć.')
        path = self.photo(collection, name)
        if not content or len(content) > MAX_UPLOAD:
            raise EditorError('Maksymalny rozmiar zdjęcia to 50 MB.', 413)
        ext = path.suffix.lower()
        signatures = {
            '.jpg': content.startswith(b'\xff\xd8\xff'), '.jpeg': content.startswith(b'\xff\xd8\xff'),
            '.png': content.startswith(b'\x89PNG\r\n\x1a\n'),
            '.webp': content[:4] == b'RIFF' and content[8:12] == b'WEBP',
            '.avif': content[4:8] == b'ftyp' and (b'avif' in content[8:40] or b'avis' in content[8:40]),
        }
        if not signatures.get(ext):
            raise EditorError('Plik nie jest zdjęciem w zadeklarowanym formacie.')
        before = self.types()
        config = json.loads(json.dumps(before))
        config.setdefault('photos', {})[f'{collection}/{name}'] = medium
        config.setdefault('colorModes', {})[f'{collection}/{name}'] = color_mode
        config.setdefault('orientations', {})[f'{collection}/{name}'] = orientation
        config.setdefault('filmDetails', {}).pop(f'{collection}/{name}', None)
        if details:
            config['filmDetails'][f'{collection}/{name}'] = details
        try:
            with path.open('xb') as output:
                output.write(content)
        except FileExistsError:
            raise EditorError(f'Plik {name} już istnieje. Zmień jego nazwę przed dodaniem.', 409)
        try:
            write_json(self.types_path, config)
            self.rebuild()  # The image decoder also validates the complete upload.
        except Exception:
            path.unlink(missing_ok=True)
            write_json(self.types_path, before)
            raise

    def delete_photo(self, collection, name):
        photo = self.photo(collection, name)
        if not photo.is_file():
            raise EditorError('Nie znaleziono zdjęcia.', 404)
        return self._delete(collection, photo)

    def delete_collection(self, collection):
        return self._delete(collection, self.folder(collection), whole=True)

    def _delete(self, collection, source, whole=False):
        folder = self.folder(collection)
        sources = [source]
        # Removing the last real photo must not resurrect an old Canva board.
        remaining = [p for p in folder.iterdir() if p.is_file() and not p.is_symlink()
                     and not p.name.startswith('.') and p.suffix.lower() in EXTENSIONS and p != source]
        board = self.photo_root / (collection + '.png')
        if (whole or not remaining) and (board.exists() or board.is_symlink()):
            sources.append(board)
        for item in sources:
            if item.is_symlink() or (item.is_dir() and any(p.is_symlink() for p in item.rglob('*'))):
                raise EditorError('Nie można usunąć kolekcji zawierającej dowiązania symboliczne.')
        if self.trash_root.resolve().is_relative_to(self.root.resolve()):
            raise RuntimeError('Kosz musi znajdować się poza katalogiem strony.')
        if any(p.is_symlink() for p in (self.trash_root, *self.trash_root.parents)):
            raise RuntimeError('Kosz nie może być dowiązaniem symbolicznym.')
        self.trash_root.mkdir(mode=0o700, parents=True, exist_ok=True)
        identifier = datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ-') + secrets.token_hex(8)
        trash = self.trash_root / identifier
        trash.mkdir(mode=0o700)
        before_types, before_info = self.types(), read_json(self.info_path, {})
        config, info = json.loads(json.dumps(before_types)), dict(before_info)
        key = f'{collection}/{source.name}'
        selected_types = {k: v for k, v in config.get('photos', {}).items()
                          if (k.startswith(collection + '/') if whole else k == key)}
        config['photos'] = {k: v for k, v in config.get('photos', {}).items() if k not in selected_types}
        if whole:
            info.pop(collection, None)
            config.get('collections', {}).pop(collection, None)
        selected_film = {k: v for k, v in config.get('filmDetails', {}).items()
                         if (k.startswith(collection + '/') if whole else k == key)}
        config['filmDetails'] = {k: v for k, v in config.get('filmDetails', {}).items() if k not in selected_film}
        selected_colors = {k: v for k, v in config.get('colorModes', {}).items() if (k.startswith(collection + '/') if whole else k == key)}
        config['colorModes'] = {k: v for k, v in config.get('colorModes', {}).items() if k not in selected_colors}
        selected_orientations = {k: v for k, v in config.get('orientations', {}).items() if (k.startswith(collection + '/') if whole else k == key)}
        config['orientations'] = {k: v for k, v in config.get('orientations', {}).items() if k not in selected_orientations}
        snapshot_paths = [self.types_path, self.info_path, self.root / 'assets/collections/manifest.js']
        snapshots = {path: path.read_bytes() if path.exists() else None for path in snapshot_paths}
        restore = {'year': self.photo_root.name, 'kind': 'collection' if whole else 'photo', 'collection': collection,
                   'files': [{'stored': str(index), 'original': item.relative_to(self.photo_root).as_posix()}
                             for index, item in enumerate(sources)],
                   'photos': selected_types, 'filmDetails': selected_film, 'orientations': selected_orientations, 'colorModes': selected_colors, 'collectionInfo': before_info.get(collection), 'status': 'pending'}
        write_json(trash / 'restore.json', restore)
        moved = []
        try:
            for index, item in enumerate(sources):
                target = trash / str(index)
                shutil.move(str(item), str(target))
                moved.append((item, target))
            write_json(self.types_path, config)
            if whole:
                write_json(self.info_path, info)
            self.rebuild()
            restore['status'] = 'deleted'
            write_json(trash / 'restore.json', restore)
        except Exception:
            for original, saved in reversed(moved):
                shutil.move(str(saved), str(original))
            for path, content in snapshots.items():
                if content is None:
                    path.unlink(missing_ok=True)
                else:
                    path.write_bytes(content)
            restore['status'] = 'rolled-back'
            write_json(trash / 'restore.json', restore)
            raise
        return identifier


class LocalAdmin:
    def __init__(self, root, photo_root, rebuild, lock, password_path=None):
        self.lock = lock
        self.password_path = password_path or credential_path(root)
        if self.password_path.resolve().is_relative_to(root.resolve()):
            raise RuntimeError('Hasło musi być przechowywane poza katalogiem strony.')
        migrate_credentials(root, self.password_path)
        self.store = EditorStore(root, photo_root, rebuild, trash_root=self.password_path.parent / 'trash')
        self.poster_catalog_path = root / 'assets/collections/posters.json'
        self.poster_script_path = root / 'assets/collections/posters.js'
        self.store.library.finish_pending()
        self.exports = {}
        self.auth_csrf = secrets.token_urlsafe(32)
        self.login_failures = []
        self.csrf = secrets.token_urlsafe(32)
        self.sessions = {}
        self.assets = Path(__file__).parent / 'admin'

    def poster_catalog(self):
        posters = read_json(self.poster_catalog_path, [{'name': '50 × 70 cm', 'priceCents': 6999}])
        if not isinstance(posters, list) or not posters:
            raise EditorError('Katalog plakatów jest nieprawidłowy.')
        return posters

    def save_poster_catalog(self, posters):
        if not isinstance(posters, list) or not posters or len(posters) > 30:
            raise EditorError('Dodaj od 1 do 30 formatów plakatów.')
        normalized, names = [], set()
        for poster in posters:
            if not isinstance(poster, dict):
                raise EditorError('Nieprawidłowy format plakatu.')
            name, price = poster.get('name'), poster.get('priceCents')
            if (not isinstance(name, str) or not name.strip() or len(name.strip()) > 40
                    or isinstance(price, bool) or not isinstance(price, int) or not 0 <= price <= 100000000):
                raise EditorError('Podaj nazwę formatu i prawidłową cenę (0–1 000 000 zł).')
            name = name.strip()
            if name.casefold() in names:
                raise EditorError('Formaty plakatów muszą mieć różne nazwy.')
            names.add(name.casefold())
            normalized.append({'name': name, 'priceCents': price})
        write_json(self.poster_catalog_path, normalized)
        script = '// Global poster catalogue. Managed in the local admin panel.\nwindow.ZWIDY_POSTERS = ' + json.dumps(normalized, ensure_ascii=False) + ';\n'
        temp = self.poster_script_path.with_name('.posters.js.' + secrets.token_hex(6))
        try:
            temp.write_text(script, encoding='utf-8')
            temp.replace(self.poster_script_path)
        finally:
            temp.unlink(missing_ok=True)
        return normalized

    def year_store(self, year=None, create=False):
        year = str(year) if year is not None else self.store.photo_root.name
        if not re.fullmatch(r'[12]\d{3}', year):
            raise EditorError('Nieprawidłowy rok / Invalid year (1000–2999).')
        parent = self.store.photo_root.parent
        folder = parent / year
        if parent.is_symlink() or folder.is_symlink() or folder.resolve().parent != parent.resolve():
            raise EditorError('Nieprawidłowy folder roku / Invalid year folder.')
        if create:
            folder.mkdir(exist_ok=True)
        if not folder.is_dir():
            raise EditorError('Nie znaleziono roku / Year not found.', 404)
        return EditorStore(self.store.root, folder, self.store.rebuild, trash_root=self.store.trash_root)

    def collections_state(self):
        items = []
        for folder in sorted(self.store.photo_root.parent.iterdir(), reverse=True):
            if re.fullmatch(r'[12]\d{3}', folder.name) and folder.is_dir() and not folder.is_symlink():
                for collection in self.year_store(folder.name).state():
                    items.append({**collection, 'year': folder.name, 'key': folder.name + '/' + collection['id']})
        return items

    def cookie_name(self, handler):
        return f'wizje_admin_{handler.server.server_port}'

    def session(self, handler):
        try:
            cookies = SimpleCookie(handler.headers.get('Cookie', ''))
            value = cookies.get(self.cookie_name(handler))
            return value.value if value else ''
        except Exception:
            return ''

    def authenticated(self, handler):
        return self.sessions.get(self.session(handler), 0) > time.monotonic()

    def valid_host(self, handler):
        port = handler.server.server_port
        try:
            local_peer = ipaddress.ip_address(handler.client_address[0]).is_loopback
            local_bind = ipaddress.ip_address(handler.server.server_address[0]).is_loopback
        except (AttributeError, ValueError, IndexError):
            return False
        forwarded = any(key.lower() == 'forwarded' or key.lower().startswith('x-forwarded-')
                        or key.lower() in ('x-real-ip', 'true-client-ip') for key in handler.headers)
        return (local_peer and local_bind and not forwarded
                and handler.headers.get('Sec-Fetch-Site') != 'cross-site'
                and handler.headers.get('Host') in (f'127.0.0.1:{port}', f'localhost:{port}'))


    def send(self, handler, status, body, content_type='application/json; charset=utf-8', headers=None):
        if isinstance(body, dict):
            if 'error' in body and handler.headers.get('Accept-Language', '').lower().startswith('en'):
                message = body['error']
                duplicate = re.fullmatch(r'Plik (.+) już istnieje. Zmień jego nazwę przed dodaniem.', message)
                body = {**body, 'error': (f'File {duplicate[1]} already exists. Rename it before uploading.'
                                         if duplicate else ERRORS_EN.get(message, message))}
            body = json.dumps(body, ensure_ascii=False).encode()
        elif isinstance(body, str):
            body = body.encode()
        handler.send_response(status)
        handler.send_header('Content-Type', content_type)
        handler.send_header('Content-Length', str(len(body)))
        handler.send_header('Cache-Control', 'no-store')
        handler.send_header('X-Content-Type-Options', 'nosniff')
        handler.send_header('X-Frame-Options', 'DENY')
        handler.send_header('X-Robots-Tag', 'noindex, nofollow, noarchive')
        handler.send_header('Referrer-Policy', 'no-referrer')
        handler.send_header('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' blob:; object-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'")
        for key, value in (headers or {}).items():
            handler.send_header(key, value)
        handler.end_headers()
        handler.wfile.write(body)

    def get(self, handler):
        url = urlsplit(handler.path)
        path = url.path
        if path != '/admin' and not path.startswith('/admin/'):
            return False
        if not self.valid_host(handler):
            self.send(handler, 403, {'error': 'Panel działa wyłącznie lokalnie.'})
            return True
        if path == '/admin/access':
            self.send(handler, 303, '', headers={'Location': '/admin'})
            return True
        if path == '/admin/api/auth':
            self.send(handler, 200, {'setup': not self.password_path.exists(), 'csrf': self.auth_csrf})
            return True
        public_files = {'/admin/login.js': ('login.js', 'text/javascript'),
                        '/admin/editor.css': ('editor.css', 'text/css')}
        if path in public_files:
            name, mime = public_files[path]
            self.send(handler, 200, (self.assets / name).read_bytes(), mime)
            return True
        if not self.authenticated(handler):
            if path in ('/admin', '/admin/'):
                self.send(handler, 200, (self.assets / 'login.html').read_bytes(), 'text/html; charset=utf-8')
            else:
                self.send(handler, 401, {'error': 'Zaloguj się ponownie w panelu.'})
            return True
        if path.startswith('/admin/download/'):
            self.download(handler, path.rsplit('/', 1)[-1])
            return True
        if path.startswith('/admin/library-image/'):
            with self.lock:
                try:
                    self.store.library.finish_pending()
                    item = self.store.library.find(path.rsplit('/', 1)[-1])
                    mime = {'.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png',
                            '.webp': 'image/webp', '.avif': 'image/avif'}[Path(item['name']).suffix.lower()]
                    self.send(handler, 200, item['path'].read_bytes(), mime)
                except EditorError as error:
                    self.send(handler, error.status, {'error': str(error)})
            return True
        if path == '/admin/api/state':
            with self.lock:
                try:
                    self.store.library.finish_pending()
                    self.send(handler, 200, {'collections': self.collections_state(), 'library': self.store.library.state(), 'films': FILMS, 'isoValues': ISO_VALUES, 'posters': self.poster_catalog(), 'csrf': self.csrf})
                except EditorError as error:
                    self.send(handler, error.status, {'error': str(error)})
            return True
        files = {'/admin': ('index.html', 'text/html; charset=utf-8'), '/admin/': ('index.html', 'text/html; charset=utf-8'),
                 '/admin/editor.css': ('editor.css', 'text/css'), '/admin/editor.js': ('editor.js', 'text/javascript')}
        if path in files:
            name, mime = files[path]
            self.send(handler, 200, (self.assets / name).read_bytes(), mime)
        else:
            self.send(handler, 404, {'error': 'Nie znaleziono strony.'})
        return True

    def login(self, handler, data):
        if not isinstance(data, dict):
            raise EditorError('Nieprawidłowe dane.')
        now = time.monotonic()
        self.login_failures = [stamp for stamp in self.login_failures if now - stamp < 60]
        if len(self.login_failures) >= 5:
            raise EditorError('Zbyt wiele prób. Spróbuj ponownie za minutę.', 429)
        password = data.get('password')
        if not isinstance(password, str) or not 8 <= len(password) <= 128:
            self.login_failures.append(now)
            raise EditorError('Hasło musi mieć od 8 do 128 znaków.')
        setup = data.get('setup') is True
        existing = self.password_path.exists()
        if setup and existing:
            raise EditorError('Hasło jest już ustawione. Odśwież stronę i zaloguj się.', 409)
        if not setup and not existing:
            raise EditorError('Najpierw ustaw hasło. Odśwież stronę.', 409)
        if setup:
            if password != data.get('confirmation'):
                raise EditorError('Hasła nie są takie same.')
            salt = secrets.token_bytes(32)
            digest = hashlib.pbkdf2_hmac('sha256', password.encode(), salt, 600_000)
            save_credentials(self.password_path, {'salt': salt.hex(), 'hash': digest.hex(), 'iterations': 600_000})
        else:
            saved = read_json(self.password_path, {})
            digest = hashlib.pbkdf2_hmac('sha256', password.encode(), bytes.fromhex(saved['salt']), saved['iterations'])
            if not hmac.compare_digest(digest.hex(), saved['hash']):
                self.login_failures.append(now)
                raise EditorError('Nieprawidłowe hasło.', 401)
        self.login_failures.clear()
        self.sessions = {key: expiry for key, expiry in self.sessions.items() if expiry > now}
        session = secrets.token_urlsafe(32)
        self.sessions[session] = now + 12 * 60 * 60
        self.send(handler, 200, {'ok': True}, headers={
            'Set-Cookie': f'{self.cookie_name(handler)}={session}; HttpOnly; SameSite=Strict; Path=/admin; Max-Age=43200'})

    def export(self, handler):
        from publish import publish
        try:
            _, archive, photos, collections = publish(self.store.root)
        except Exception:
            raise EditorError('Nie udało się przygotować paczki. Sprawdź zdjęcia i wolne miejsce na dysku.', 500)
        now = time.monotonic()
        self.exports = {key: value for key, value in self.exports.items() if value['expires'] > now}
        identifier = secrets.token_urlsafe(24)
        self.exports[identifier] = {'path': archive, 'session': self.session(handler), 'expires': now + 3600}
        return {'download': '/admin/download/' + identifier, 'name': archive.name,
                'photos': photos, 'collections': collections, 'bytes': archive.stat().st_size}

    def download(self, handler, identifier):
        artifact = self.exports.get(identifier)
        if not artifact or artifact['session'] != self.session(handler) or artifact['expires'] <= time.monotonic():
            self.send(handler, 404, {'error': 'Przygotuj nową paczkę w panelu.'})
            return
        path = artifact['path']
        output = self.store.root / 'dist'
        if (output.is_symlink() or path.is_symlink() or not path.is_file()
                or path.resolve().parent != output.resolve()):
            self.send(handler, 404, {'error': 'Przygotuj nową paczkę w panelu.'})
            return
        with path.open('rb') as source:
            handler.send_response(200)
            handler.send_header('Content-Type', 'application/zip')
            handler.send_header('Content-Disposition', f'attachment; filename="{path.name}"')
            handler.send_header('Content-Length', str(path.stat().st_size))
            handler.send_header('Cache-Control', 'no-store')
            handler.send_header('X-Content-Type-Options', 'nosniff')
            handler.send_header('X-Robots-Tag', 'noindex, nofollow')
            handler.end_headers()
            shutil.copyfileobj(source, handler.wfile)

    def post(self, handler):
        url = urlsplit(handler.path)
        if not url.path.startswith('/admin/api/'):
            self.send(handler, 404, {'error': 'Nie znaleziono operacji.'})
            return
        login = url.path == '/admin/api/login'
        if not self.valid_host(handler) or (not login and not self.authenticated(handler)):
            self.send(handler, 401, {'error': 'Zaloguj się ponownie w panelu.'})
            return
        origin = handler.headers.get('Origin')
        allowed = {f'http://127.0.0.1:{handler.server.server_port}', f'http://localhost:{handler.server.server_port}'}
        expected_csrf = self.auth_csrf if login else self.csrf
        if (origin and origin not in allowed) or not hmac.compare_digest(handler.headers.get('X-Wizje-CSRF', ''), expected_csrf):
            self.send(handler, 403, {'error': 'Odśwież panel i spróbuj ponownie.'})
            return
        try:
            length = int(handler.headers.get('Content-Length', '0'))
            maximum = 2048 if login else (MAX_UPLOAD if url.path.endswith('/upload') else 64 * 1024)
            if length < 0 or length > maximum:
                raise EditorError('Plik lub żądanie jest zbyt duże.', 413)
            content = handler.rfile.read(length)
            if len(content) != length:
                raise EditorError('Przesyłanie zostało przerwane.')
            with self.lock:
                if login:
                    self.login(handler, json.loads(content))
                    return
                self.store.library.finish_pending()
                if url.path == '/admin/api/upload':
                    args = parse_qs(url.query)
                    self.year_store(args.get('year', [None])[0]).upload(args.get('collection', [''])[0], args.get('name', [''])[0], args.get('medium', [''])[0], content, args.get('film', [None])[0], args.get('iso', [None])[0], args.get('orientation', ['portrait'])[0], args.get('colorMode', ['color'])[0])
                    result = {'ok': True}
                elif url.path == '/admin/api/logout':
                    self.sessions.pop(self.session(handler), None)
                    self.send(handler, 200, {'ok': True}, headers={'Set-Cookie': f'{self.cookie_name(handler)}=; Max-Age=0; HttpOnly; SameSite=Strict; Path=/admin'})
                    return
                else:
                    data = json.loads(content)
                    if not isinstance(data, dict):
                        raise EditorError('Nieprawidłowe dane.')
                    if url.path == '/admin/api/export':
                        result = self.export(handler)
                    elif url.path == '/admin/api/posters':
                        result = {'posters': self.save_poster_catalog(data.get('posters'))}
                    elif url.path == '/admin/api/reorder-collections':
                        self.year_store(data.get('year')).reorder(data.get('order'), expected=data.get('expected'))
                        result = {'ok': True}
                    elif url.path == '/admin/api/reorder-photos':
                        store = self.year_store(data.get('year'))
                        store.folder(data.get('collection'))
                        store.reorder(data.get('order'), collection=data['collection'], expected=data.get('expected'))
                        result = {'ok': True}
                    elif url.path == '/admin/api/collections':
                        store = self.year_store(data.get('year'), create=True)
                        identifier = store.create(data.get('name'))
                        result = {'id': identifier, 'year': store.photo_root.name, 'key': store.photo_root.name + '/' + identifier}
                    elif url.path == '/admin/api/library-attach':
                        self.year_store(data.get('year')).library.attach(data.get('id'), data.get('collection'))
                        result = {'ok': True}
                    elif url.path == '/admin/api/purge-photo':
                        self.year_store(data.get('year')).library.purge(data.get('confirmed'), collection=data.get('collection'), name=data.get('name'), identifier=data.get('id'))
                        self.exports.clear()
                        result = {'ok': True}
                    elif url.path == '/admin/api/delete-photo':
                        result = {'ok': True, 'trashId': self.year_store(data.get('year')).delete_photo(data.get('collection'), data.get('name'))}
                    elif url.path == '/admin/api/delete-collection':
                        result = {'ok': True, 'trashId': self.year_store(data.get('year')).delete_collection(data.get('collection'))}
                    elif url.path == '/admin/api/locations':
                        self.year_store(data.get('year')).set_locations(data.get('collection'), data.get('locations'))
                        result = {'ok': True}
                    elif url.path == '/admin/api/location':
                        self.year_store(data.get('year')).set_location(data.get('collection'), data.get('location'))
                        result = {'ok': True}
                    elif url.path == '/admin/api/film':
                        self.year_store(data.get('year')).set_film(data.get('collection'), data.get('name'), data.get('film'), data.get('iso'))
                        result = {'ok': True}
                    elif url.path == '/admin/api/color-mode':
                        self.year_store(data.get('year')).set_color_mode(data.get('collection'), data.get('name'), data.get('colorMode'))
                        result = {'ok': True}
                    elif url.path == '/admin/api/orientation':
                        self.year_store(data.get('year')).set_orientation(data.get('collection'), data.get('name'), data.get('orientation'))
                        result = {'ok': True}
                    elif url.path == '/admin/api/medium':
                        self.year_store(data.get('year')).set_medium(data.get('collection'), data.get('name'), data.get('medium'))
                        result = {'ok': True}
                    else:
                        raise EditorError('Nie znaleziono operacji.', 404)
                self.send(handler, 200, result)
        except EditorError as error:
            self.send(handler, error.status, {'error': str(error)})
        except (ValueError, TypeError):
            self.send(handler, 400, {'error': 'Nieprawidłowe dane. Odśwież panel i spróbuj ponownie.'})
        except Exception:
            self.send(handler, 500, {'error': 'Nie udało się zapisać zmiany lub odczytać zdjęcia. Dotychczasowe pliki zostały zachowane.'})
