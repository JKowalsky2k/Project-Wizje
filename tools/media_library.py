"""Detached photos and permanent deletion of files managed by the local editor."""
import hashlib
import json
from pathlib import Path
import re
import shutil

from admin_panel import EditorError, EXTENSIONS, read_json, write_json


def digest(path):
    result = hashlib.sha256()
    with path.open('rb') as source:
        for chunk in iter(lambda: source.read(1024 * 1024), b''):
            result.update(chunk)
    return result.hexdigest()


class MediaLibrary:
    def __init__(self, store):
        self.store = store
        self.journal = store.trash_root.parent / 'pending-photo-purge.json'

    def entries(self):
        items = []
        root = self.store.trash_root
        if not root.exists():
            return items
        if root.is_symlink():
            raise EditorError('Nieprawidłowa ścieżka biblioteki.')
        for directory in sorted(root.iterdir(), reverse=True):
            record = directory / 'restore.json'
            if directory.is_symlink() or not directory.is_dir() or record.is_symlink() or not record.is_file():
                continue
            data = read_json(record, {})
            if data.get('status') != 'deleted':
                continue
            for saved in data.get('files', []):
                stored = saved.get('stored', '')
                original = Path(saved.get('original', ''))
                if not re.fullmatch(r'\d+', stored) or original.is_absolute() or '..' in original.parts:
                    continue
                source = directory / stored
                if source.is_symlink() or not source.exists():
                    continue
                files = sorted(source.rglob('*')) if source.is_dir() else [source]
                for file in files:
                    if not file.is_file() or file.is_symlink() or any(p.is_symlink() for p in file.parents):
                        continue
                    relative = file.relative_to(source) if source.is_dir() else Path()
                    name = original / relative
                    if name.suffix.lower() not in EXTENSIONS or name.name.startswith('.'):
                        continue
                    identifier = hashlib.sha256((directory.name + '/' + file.relative_to(directory).as_posix()).encode()).hexdigest()[:32]
                    items.append({'id': identifier, 'name': name.name, 'path': file,
                                  'original': name.as_posix(), 'medium': data.get('photos', {}).get(name.as_posix()),
                                  'colorMode': data.get('colorModes', {}).get(name.as_posix()),
                                  'orientation': data.get('orientations', {}).get(name.as_posix(), 'portrait'),
                                  'filmDetails': data.get('filmDetails', {}).get(name.as_posix(), {}),
                                  'preview': '/admin/library-image/' + identifier})
        return items

    def state(self):
        return [{**{key: item[key] for key in ('id', 'name', 'medium', 'preview')}, **item['filmDetails']} for item in self.entries()]

    def find(self, identifier):
        if isinstance(identifier, str) and re.fullmatch(r'[a-f0-9]{32}', identifier):
            for item in self.entries():
                if item['id'] == identifier:
                    return item
        raise EditorError('Nie znaleziono zdjęcia w bibliotece.', 404)

    def attach(self, identifier, collection):
        item = self.find(identifier)
        target = self.store.photo(collection, item['name'])
        if target.exists():
            raise EditorError('Kolekcja zawiera już plik o tej nazwie.', 409)
        before = self.store.types()
        manifest = self.store.root / 'assets/collections/manifest.js'
        previous_manifest = manifest.read_bytes() if manifest.exists() else None
        config = json.loads(json.dumps(before))
        config.setdefault('photos', {})[collection + '/' + item['name']] = item['medium']
        key = collection + '/' + item['name']
        config.setdefault('colorModes', {})[key] = item['colorMode']
        config.setdefault('orientations', {})[key] = item['orientation']
        config.setdefault('filmDetails', {}).pop(key, None)
        if item['medium'] == 'analog' and item['filmDetails']:
            config['filmDetails'][key] = item['filmDetails']
        shutil.move(str(item['path']), str(target))
        try:
            write_json(self.store.types_path, config)
            self.store.rebuild()
        except Exception:
            shutil.move(str(target), str(item['path']))
            write_json(self.store.types_path, before)
            if previous_manifest is None:
                manifest.unlink(missing_ok=True)
            else:
                manifest.write_bytes(previous_manifest)
            raise

    def photo_roots(self):
        parent = self.store.photo_root.parent
        return sorted({self.store.photo_root, *(p for p in parent.iterdir()
                      if re.fullmatch(r'[12]\d{3}', p.name) and p.is_dir() and not p.is_symlink())})

    def _safe(self, path):
        allowed = [*(root.resolve() for root in self.photo_roots()), self.store.trash_root.resolve(),
                   (self.store.root / 'assets/collections/previews').resolve(),
                   (self.store.root / 'dist').resolve()]
        return (not any(p.is_symlink() for p in (path, *path.parents))
                and any(path.resolve().is_relative_to(root) and path.resolve() != root for root in allowed))

    def purge(self, confirmed, collection=None, name=None, identifier=None):
        if identifier is not None:
            item = self.find(identifier)
            source, filename = item['path'], item['name']
        else:
            source = self.store.photo(collection, name)
            filename = name
            if not source.is_file():
                raise EditorError('Nie znaleziono zdjęcia.', 404)
        if confirmed is not True:
            raise EditorError('Potwierdź trwałe usunięcie zdjęcia.')
        fingerprint = digest(source)
        targets = set()
        # Remove byte-identical originals across collections and the old trash/library.
        for root in [*self.photo_roots(), self.store.trash_root]:
            if not root.exists():
                continue
            for path in root.rglob('*'):
                if path.is_file() and self._safe(path) and path.name not in ('restore.json', 'photo-types.json', 'collection-info.json'):
                    if path.stat().st_size == source.stat().st_size and digest(path) == fingerprint:
                        targets.add(path)
        # Historical preview names cannot always be traced back to an original.
        # Clear all generated preview caches and releases, then rebuild only retained photos.
        previews = self.store.root / 'assets/collections/previews'
        if previews.exists():
            targets.update(p for p in previews.rglob('*') if p.is_file())
        output = self.store.root / 'dist'
        directories = []
        if output.exists():
            for release in output.iterdir():
                if not re.fullmatch(r'wizje-\d{8}-\d{6}-\d{6}(?:\.zip)?|\.publish-[A-Za-z0-9_-]+', release.name):
                    continue
                if release.is_dir():
                    directories.append(str(release))
                    targets.update(p for p in release.rglob('*') if p.is_file() or p.is_symlink())
                else:
                    targets.add(release)
        for path in targets:
            if not self._safe(path):
                raise EditorError('Nie można bezpiecznie wyczyścić kopii zdjęcia.')
        if any(Path(path).is_symlink() for path in directories):
            raise EditorError('Nie można bezpiecznie wyczyścić kopii zdjęcia.')
        # A metadata-only journal lets an interrupted purge resume without retaining a photo backup.
        self.journal.parent.mkdir(mode=0o700, parents=True, exist_ok=True)
        write_json(self.journal, {'files': [str(p) for p in sorted(targets)], 'directories': directories})
        self.finish_pending()

    def finish_pending(self):
        if not self.journal.exists():
            return
        plan = read_json(self.journal, {})
        paths = [Path(path) for path in plan['files']]
        if any(not self._safe(path) for path in paths):
            raise EditorError('Nie można bezpiecznie wyczyścić kopii zdjęcia.')
        try:
            for path in paths:
                path.unlink(missing_ok=True)
            for name in plan['directories']:
                path = Path(name)
                if not self._safe(path):
                    raise EditorError('Nie można bezpiecznie wyczyścić kopii zdjęcia.')
                if path.exists():
                    # Only remove empty directories; never follow links or erase unplanned files.
                    for child in sorted(path.rglob('*'), key=lambda p: len(p.parts), reverse=True):
                        if child.is_dir() and not child.is_symlink():
                            child.rmdir()
                    path.rmdir()
            for root in self.photo_roots():
                types = root / 'photo-types.json'
                if not types.exists() and root != self.store.photo_root:
                    continue
                config = read_json(types, {'photos': {}})
                config['photos'] = {key: value for key, value in config.get('photos', {}).items()
                                    if (root / key).is_file()}
                config['filmDetails'] = {key: value for key, value in config.get('filmDetails', {}).items()
                                         if (root / key).is_file()}
                config['colorModes'] = {key: value for key, value in config.get('colorModes', {}).items() if (root / key).is_file()}
                config['orientations'] = {key: value for key, value in config.get('orientations', {}).items() if (root / key).is_file()}
                write_json(types, config)
            self.store.rebuild()
            self.journal.unlink()
        except Exception as error:
            raise EditorError('Trwałe usuwanie nie zostało zakończone. Odśwież panel, aby ponowić czyszczenie.', 503) from error
