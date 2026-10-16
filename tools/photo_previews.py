"""Prepare gallery previews (full landscape frames) and large photo previews."""
import hashlib
import json
from pathlib import Path
import shutil
import subprocess
import tempfile
from urllib.parse import quote, unquote


def prepare_previews(collections, root):
    renderer = Path(__file__).with_suffix('.swift')
    recipe = hashlib.sha256(renderer.read_bytes()).hexdigest()
    output_dir = root / 'assets/collections/previews'
    output_dir.mkdir(parents=True, exist_ok=True)
    jobs = []
    updates = []
    for collection in collections:
        for photo in collection['photos']:
            if photo.get('crop'):
                continue
            source = root / unquote(photo['src'])
            # Content hashing also detects replacements that retain size and mtime.
            digest = hashlib.sha256()
            with source.open('rb') as handle:
                for block in iter(lambda: handle.read(1024 * 1024), b''):
                    digest.update(block)
            identity = f'{photo["src"]}:{digest.hexdigest()}:{recipe}:{photo.get("orientation", "portrait")}'
            fingerprint = hashlib.sha256(identity.encode()).hexdigest()[:24]
            filename = f'{fingerprint}-480.jpg'
            output = output_dir / filename
            detail = output_dir / f'{fingerprint}-2000.jpg'
            high = output_dir / f'{fingerprint}-1440.jpg'
            inspection = output_dir / f'{fingerprint}-inspect.jpg'
            metadata = output_dir / f'{fingerprint}-info.json'
            if any(not path.is_file() or path.stat().st_size == 0 for path in (output, high, detail, inspection, metadata)):
                jobs.append({'source': str(source), 'output': str(output), 'detail': str(detail), 'high': str(high), 'inspection': str(inspection), 'metadata': str(metadata), 'orientation': photo.get('orientation', 'portrait')})
            updates.append((photo, f'assets/collections/previews/{quote(filename)}', f'assets/collections/previews/{detail.name}', metadata))
    if jobs:
        swift = shutil.which('swift')
        if not swift:
            raise RuntimeError('New previews require Swift on macOS. Build locally, then publish the generated previews and manifest.')
        cache = Path(tempfile.gettempdir()) / 'wizje-swift-cache'
        subprocess.run([swift, '-module-cache-path', str(cache), str(renderer)],
                       input=json.dumps(jobs), text=True, check=True)
    for photo, preview, detail, metadata in updates:
        photo['original'] = photo['src']
        photo['src'] = preview
        photo['detail'] = detail
        photo['previewHigh'] = detail.replace('-2000.jpg', '-1440.jpg')
        photo['inspection'] = detail.replace('-2000.jpg', '-inspect.jpg')
        photo.update(json.loads(metadata.read_text()))
    return collections
