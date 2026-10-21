"""Atomic group edits, session-bound undo and publishing status for the local editor."""
import hashlib
import json
import secrets
import shutil
import time

from film_catalog import validate_film
from photo_previews import source_digest


def snapshot(paths):
    return {path: path.read_bytes() if path.exists() else None for path in paths}


def restore(saved):
    for path, content in saved.items():
        if content is None:
            path.unlink(missing_ok=True)
        else:
            path.write_bytes(content)


class EditorActions:
    def __init__(self, admin):
        self.admin = admin
        self.history = {}
        self.publication_path = admin.password_path.parent / 'publication-state.json'

    def remember(self, handler, before=None, moves=(), action=None):
        now = time.monotonic()
        self.history = {key: value for key, value in self.history.items() if value['expires'] > now}
        while len(self.history) >= 20:
            self.history.pop(next(iter(self.history)))
        token = secrets.token_urlsafe(24)
        self.history[token] = {'session': self.admin.session(handler), 'expires': now + 3600,
                               'before': before, 'after': snapshot(before or []), 'moves': list(moves), 'action': action}
        return token

    def undo(self, handler, token):
        from admin_panel import EditorError
        entry = self.history.get(token) if isinstance(token, str) else None
        if not entry or entry['expires'] <= time.monotonic() or entry['session'] != self.admin.session(handler):
            raise EditorError('Nie można już cofnąć tej zmiany / This change can no longer be undone.', 409)
        if entry['action']:
            entry['action']()
        else:
            if snapshot(entry['after']) != entry['after']:
                raise EditorError('Dane zmieniły się od tego zapisu / The data has changed since this save.', 409)
            for source, target in entry['moves']:
                if source.exists() or source.is_symlink() or not target.is_file() or target.is_symlink():
                    raise EditorError('Nie można przywrócić pliku / Cannot restore the file.', 409)
            current = snapshot(entry['before'])
            derived = snapshot(self.admin.store.root / name for name in ('assets/collections/manifest.js', 'gallery.html', 'sitemap.xml', 'robots.txt'))
            reversed_moves = []
            try:
                for source, target in entry['moves']:
                    shutil.move(str(target), str(source)); reversed_moves.append((source, target))
                restore(entry['before'])
                self.admin.store.rebuild()
            except Exception:
                restore(current)
                for source, target in reversed(reversed_moves):
                    shutil.move(str(source), str(target))
                restore(derived)
                raise
        self.history.pop(token, None)

    def bulk(self, handler, data):
        from admin_panel import EditorError, valid_medium, write_json
        store = self.admin.year_store(data.get('year'))
        collection, names, changes = data.get('collection'), data.get('names'), data.get('changes', {})
        if not isinstance(names, list) or not 1 <= len(names) <= 300 or any(not isinstance(name, str) for name in names) or len(set(names)) != len(names):
            raise EditorError('Wybierz zdjęcia / Select photographs.')
        allowed = {'medium', 'orientation', 'colorMode', 'film', 'iso', 'posterSizes'}
        if not isinstance(changes, dict) or set(changes) - allowed:
            raise EditorError('Nieprawidłowe pola / Invalid fields.')
        target_data = data.get('target')
        target_store, target_collection = store, collection
        if target_data is not None:
            if not isinstance(target_data, dict): raise EditorError('Nieprawidłowa kolekcja.')
            target_store = self.admin.year_store(target_data.get('year'))
            target_collection = target_data.get('collection')
        store.folder(collection); target_store.folder(target_collection)
        moving = target_store.photo_root != store.photo_root or target_collection != collection
        if not changes and not moving:
            raise EditorError('Wybierz zmianę do zastosowania / Choose a change to apply.')
        if 'medium' in changes: valid_medium(changes['medium'])
        if 'orientation' in changes and changes['orientation'] not in ('portrait', 'landscape'):
            raise EditorError('Nieprawidłowa orientacja / Invalid orientation.')
        if 'colorMode' in changes and changes['colorMode'] not in ('color', 'monochrome'):
            raise EditorError('Nieprawidłowa kolorystyka / Invalid color mode.')
        if 'posterSizes' in changes:
            sizes = changes['posterSizes']; catalog = {poster['name'] for poster in self.admin.poster_catalog()}
            if sizes is not None and (not isinstance(sizes, list) or any(not isinstance(value, str) or value not in catalog for value in sizes) or len(set(sizes)) != len(sizes)):
                raise EditorError('Nieprawidłowe formaty zdjęcia / Invalid photo sizes.')
        configs = {item.types_path: item.types() for item in (store, target_store)}
        before = snapshot(configs)
        derived = snapshot(self.admin.store.root / name for name in ('assets/collections/manifest.js', 'gallery.html', 'sitemap.xml', 'robots.txt'))
        moves = []
        for name in names:
            source = store.photo(collection, name)
            if not source.is_file(): raise EditorError('Nie znaleziono zdjęcia.', 404)
            key = collection + '/' + name
            config = configs[store.types_path]
            medium = changes.get('medium', config.get('photos', {}).get(key))
            if any(changes.get(field) is not None for field in ('film', 'iso')):
                if 'medium' in changes and medium != 'analog':
                    raise EditorError('Film i ISO dotyczą zdjęć analogowych / Film and ISO require ANALOG.')
                medium = 'analog'
            config.setdefault('photos', {})[key] = medium
            for field, group in (('orientation', 'orientations'), ('colorMode', 'colorModes'), ('posterSizes', 'posterSizes')):
                if field in changes:
                    if changes[field] is None: config.setdefault(group, {}).pop(key, None)
                    else: config.setdefault(group, {})[key] = changes[field]
            details = dict(config.get('filmDetails', {}).get(key, {}))
            for field in ('film', 'iso'):
                if field in changes: details[field] = changes[field]
            details = validate_film(details.get('film'), details.get('iso')) if medium == 'analog' else {}
            if details: config.setdefault('filmDetails', {})[key] = details
            else: config.setdefault('filmDetails', {}).pop(key, None)
            if moving:
                destination = target_store.photo(target_collection, name)
                if destination.exists() or destination.is_symlink():
                    raise EditorError(f'Plik już istnieje / File already exists: {name}', 409)
                for group in ('photos', 'orientations', 'colorModes', 'posterSizes', 'filmDetails', 'printCrops'):
                    if key in config.get(group, {}):
                        configs[target_store.types_path].setdefault(group, {})[target_collection + '/' + name] = config[group].pop(key)
                moves.append((source, destination))
        completed = []
        try:
            for source, destination in moves:
                shutil.move(str(source), str(destination)); completed.append((source, destination))
            for path, config in configs.items(): write_json(path, config)
            self.admin.store.rebuild()
        except Exception:
            for source, destination in reversed(completed): shutil.move(str(destination), str(source))
            restore(before); restore(derived)
            raise
        return {'ok': True, 'count': len(names), 'undo': self.remember(handler, before, moves)}

    def publication(self, collections=None):
        from admin_panel import read_json
        collections = collections if collections is not None else self.admin.collections_state()
        photos, groups = {}, {}
        digest = hashlib.sha256()
        root = self.admin.store.root
        for collection in collections:
            prefix = f'{collection["year"]}/{collection["id"]}'
            groups[prefix] = {key: collection.get(key) for key in ('title', 'locations')}
            groups[prefix]['order'] = [photo['name'] for photo in collection['photos']]
            for photo in collection['photos']:
                photos[prefix + '/' + photo['name']] = photo
                source = self.admin.year_store(collection['year']).photo(collection['id'], photo['name'])
                digest.update(source_digest(source).encode())
        summary = {'photos': photos, 'collections': groups, 'posters': self.admin.poster_catalog(),
                   'order': [f'{collection["year"]}/{collection["id"]}' for collection in collections]}
        digest.update(json.dumps(summary, sort_keys=True).encode())
        for name in ('index.html', 'styles.css', 'script.js', 'collections.js', 'globe.js', '.htaccess', 'assets/logo/logo.css'):
            path = root / name
            if path.is_file(): digest.update(name.encode() + source_digest(path).encode())
        for path in sorted((root / 'assets/fonts').glob('*.woff2')):
            if path.is_file() and not path.is_symlink(): digest.update(path.name.encode() + source_digest(path).encode())
        if self.publication_path.is_symlink(): raise RuntimeError('Invalid publication state path')
        previous = read_json(self.publication_path, {})
        old = previous.get('summary', {})
        old_photos, old_groups = old.get('photos', {}), old.get('collections', {})
        changes = {'added': len(photos.keys() - old_photos.keys()), 'removed': len(old_photos.keys() - photos.keys()),
                   'changed': sum(photos[key] != old_photos[key] for key in photos.keys() & old_photos.keys()),
                   'collections': sum(groups.get(key) != old_groups.get(key) for key in groups.keys() | old_groups.keys()),
                   'prices': summary['posters'] != old.get('posters', [])}
        if summary['order'] != old.get('order', []): changes['collections'] = max(1, changes['collections'])
        return {'dirty': digest.hexdigest() != previous.get('fingerprint'), 'changes': changes,
                'lastExport': previous.get('name'), 'fingerprint': digest.hexdigest(), 'summary': summary}

    def published(self, name):
        from admin_panel import write_json
        current = self.publication()
        self.publication_path.parent.mkdir(mode=0o700, parents=True, exist_ok=True)
        write_json(self.publication_path, {'name': name, 'fingerprint': current['fingerprint'], 'summary': current['summary']})

    def publication_status(self, collections=None):
        return {key: value for key, value in self.publication(collections).items() if key not in ('summary', 'fingerprint')}
