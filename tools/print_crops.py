"""Private source files for photographer-supplied crops of individual print formats."""
import json
from pathlib import Path
import re
import secrets


def crop_source(root, relative):
    if not isinstance(relative, str) or not re.fullmatch(r'assets/collections/\.print-crops/[a-f0-9]{32}\.(?:jpg|jpeg|png|webp|avif)', relative):
        raise ValueError('Nieprawidłowy plik kadru.')
    path = root / relative
    if any(parent.is_symlink() for parent in (path, *path.parents)) or not path.is_file():
        raise ValueError('Nie znaleziono bezpiecznego pliku kadru.')
    return path


def set_crop(store, collection, name, size, catalog, filename=None, content=None):
    from admin_panel import EditorError, MAX_UPLOAD, write_json
    from admin_actions import snapshot, restore
    if not store.photo(collection, name).is_file():
        raise EditorError('Nie znaleziono zdjęcia.', 404)
    if size not in {poster['name'] for poster in catalog}:
        raise EditorError('Nieprawidłowy format wydruku.')
    before = snapshot([store.types_path, store.root / 'assets/collections/manifest.js',
                       *(store.root / item for item in ('gallery.html', 'sitemap.xml', 'robots.txt'))])
    config = json.loads(json.dumps(store.types()))
    key = f'{collection}/{name}'
    available = config.get('posterSizes', {}).get(key)
    if content is not None and available is not None and size not in available:
        raise EditorError('Najpierw włącz i zapisz ten format dla zdjęcia.')
    variants = config.setdefault('printCrops', {}).setdefault(key, {})
    path = None
    record = None
    if content is None:
        variants.pop(size, None)
    else:
        if not content or len(content) > MAX_UPLOAD:
            raise EditorError('Maksymalny rozmiar zdjęcia to 50 MB.', 413)
        ext = Path(filename or '').suffix.lower()
        signatures = {'.jpg': content.startswith(b'\xff\xd8\xff'), '.jpeg': content.startswith(b'\xff\xd8\xff'),
                      '.png': content.startswith(b'\x89PNG\r\n\x1a\n'),
                      '.webp': content[:4] == b'RIFF' and content[8:12] == b'WEBP',
                      '.avif': content[4:8] == b'ftyp' and (b'avif' in content[8:40] or b'avis' in content[8:40])}
        if not signatures.get(ext):
            raise EditorError('Plik nie jest zdjęciem w zadeklarowanym formacie.')
        folder = store.root / 'assets/collections/.print-crops'
        if any(parent.is_symlink() for parent in (folder, *folder.parents)):
            raise EditorError('Nieprawidłowa ścieżka kadru.')
        folder.mkdir(exist_ok=True)
        path = folder / (secrets.token_hex(16) + ext)
        try:
            with path.open('xb') as output:
                output.write(content)
        except Exception:
            path.unlink(missing_ok=True)
            raise
        variants[size] = path.relative_to(store.root).as_posix()
        # Track replaced/undone crops too, so permanently deleting the main
        # photograph can erase every private version without retaining a backup.
        from photo_previews import source_digest
        record = path.with_suffix('.json')
        try:
            write_json(record, {'photoDigest': source_digest(store.photo(collection, name)), 'file': variants[size]})
        except Exception:
            path.unlink(missing_ok=True)
            raise
    if not variants:
        config['printCrops'].pop(key, None)
    try:
        write_json(store.types_path, config)
        store.rebuild()
    except Exception:
        restore(before)
        if path: path.unlink(missing_ok=True)
        if record: record.unlink(missing_ok=True)
        raise
