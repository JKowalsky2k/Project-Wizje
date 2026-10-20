"""Prepare gallery previews (full landscape frames) and large photo previews."""
import hashlib
from collections import OrderedDict
import json
from pathlib import Path
import shutil
import subprocess
import tempfile
from urllib.parse import quote, unquote


_source_hashes = OrderedDict()


def source_digest(source, verify=False):
    stat = source.stat()
    # ctime and inode also change on replacements which restore size and mtime.
    signature = (str(source.resolve()), stat.st_dev, stat.st_ino, stat.st_size, stat.st_mtime_ns, stat.st_ctime_ns)
    cached = _source_hashes.get(signature)
    if cached is not None and not verify:
        _source_hashes.move_to_end(signature)
        return cached
    digest = hashlib.sha256()
    with source.open('rb') as handle:
        for block in iter(lambda: handle.read(1024 * 1024), b''):
            digest.update(block)
    _source_hashes[signature] = digest.hexdigest()
    while len(_source_hashes) > 2048:
        _source_hashes.popitem(last=False)
    return digest.hexdigest()


def render_jobs(renderer, jobs):
    if not jobs:
        return
    swift = shutil.which('swift')
    if not swift:
        raise RuntimeError('New previews require Swift on macOS. Build locally, then publish the generated previews and manifest.')
    cache = Path(tempfile.gettempdir()) / 'wizje-swift-cache'
    subprocess.run([swift, '-module-cache-path', str(cache), str(renderer)],
                   input=json.dumps(jobs), text=True, check=True)


def prepare_previews(collections, root, verify=False):
    renderer = Path(__file__).with_suffix('.swift')
    recipe = hashlib.sha256(renderer.read_bytes()).hexdigest()
    medium_renderer = Path(__file__).with_name('photo_preview_medium.swift')
    medium_recipe = hashlib.sha256(medium_renderer.read_bytes()).hexdigest()
    output_dir = root / 'assets/collections/previews'
    output_dir.mkdir(parents=True, exist_ok=True)
    jobs = []
    updates = []
    medium_jobs = []
    for collection in collections:
        for photo in collection['photos']:
            if photo.get('crop'):
                continue
            source = root / unquote(photo['src'])
            identity = f'{photo["src"]}:{source_digest(source, verify)}:{recipe}:{photo.get("orientation", "portrait")}'
            fingerprint = hashlib.sha256(identity.encode()).hexdigest()[:24]
            filename = f'{fingerprint}-480.jpg'
            output = output_dir / filename
            detail = output_dir / f'{fingerprint}-2000.jpg'
            high = output_dir / f'{fingerprint}-1440.jpg'
            inspection = output_dir / f'{fingerprint}-inspect.jpg'
            metadata = output_dir / f'{fingerprint}-info.json'
            if any(not path.is_file() or path.stat().st_size == 0 for path in (output, high, detail, inspection, metadata)):
                jobs.append({'source': str(source), 'output': str(output), 'detail': str(detail), 'high': str(high), 'inspection': str(inspection), 'metadata': str(metadata), 'orientation': photo.get('orientation', 'portrait')})
            medium_fingerprint = hashlib.sha256(f'{fingerprint}:{medium_recipe}'.encode()).hexdigest()[:24]
            medium = output_dir / f'{medium_fingerprint}-960.jpg'
            if not medium.is_file() or not medium.stat().st_size:
                medium_jobs.append({'source': str(high), 'output': str(medium)})
            updates.append((photo, f'assets/collections/previews/{quote(filename)}', f'assets/collections/previews/{detail.name}', metadata, medium))
    render_jobs(renderer, jobs)
    render_jobs(medium_renderer, medium_jobs)
    for photo, preview, detail, metadata, medium in updates:
        photo['original'] = photo['src']
        photo['src'] = preview
        photo['detail'] = detail
        photo['previewHigh'] = detail.replace('-2000.jpg', '-1440.jpg')
        photo['previewMedium'] = f'assets/collections/previews/{medium.name}'
        photo['inspection'] = detail.replace('-2000.jpg', '-inspect.jpg')
        photo.update(json.loads(metadata.read_text()))
    return collections
