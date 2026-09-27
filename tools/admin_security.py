"""Local credentials stay outside the website tree, including during migration."""
import hashlib
import json
import os
from pathlib import Path
import sys


def credential_path(root):
    identity = hashlib.sha256(str(root.resolve()).encode()).hexdigest()[:20]
    base = Path.home() / ('Library/Application Support' if sys.platform == 'darwin' else '.local/share')
    return base / 'Wizje' / identity / 'password.json'


def save_credentials(path, credentials):
    for parent in (path, *path.parents):
        if parent.is_symlink():
            raise RuntimeError('Ścieżka danych logowania nie może być dowiązaniem.')
    path.parent.mkdir(mode=0o700, parents=True, exist_ok=True)
    path.parent.chmod(0o700)
    descriptor = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    try:
        with os.fdopen(descriptor, 'w') as output:
            json.dump(credentials, output)
            output.flush()
            os.fsync(output.fileno())
    except Exception:
        path.unlink(missing_ok=True)
        raise


def migrate_credentials(root, target):
    if target.is_symlink() or target.parent.is_symlink():
        raise RuntimeError('Ścieżka danych logowania nie może być dowiązaniem.')
    legacy = root / '.local-admin/password.json'
    if not legacy.exists():
        return
    if legacy.is_symlink() or legacy.parent.is_symlink():
        raise RuntimeError('Nieprawidłowa ścieżka dotychczasowych danych logowania.')
    saved = json.loads(legacy.read_text())
    if target.exists():
        if json.loads(target.read_text()) != saved:
            raise RuntimeError('Dwie różne konfiguracje hasła. Przerwano migrację bez zmiany plików.')
    else:
        save_credentials(target, saved)
    if json.loads(target.read_text()) != saved:
        raise RuntimeError('Nie udało się zweryfikować przeniesionego hasła.')
    legacy.unlink()  # Remove only after the verified, durable copy is outside the website.
