import hashlib
import json
from pathlib import Path
from tempfile import TemporaryDirectory
import unittest

from admin_panel import EditorStore, EditorError


class LibraryTests(unittest.TestCase):
    def setUp(self):
        temporary = TemporaryDirectory(); self.addCleanup(temporary.cleanup)
        base = Path(temporary.name).resolve()
        self.root = base / 'website'
        self.photos = self.root / 'assets/collections/2026'
        self.photos.mkdir(parents=True)
        self.previews = self.root / 'assets/collections/previews'; self.previews.mkdir()
        self.store = EditorStore(self.root, self.photos, self.rebuild, trash_root=base / 'private/trash')
        self.store.create('First'); self.store.create('Second')

    def rebuild(self):
        entries = []
        for path in sorted(self.photos.glob('*/*.jpg')):
            content = path.read_bytes()
            name = hashlib.sha256(content).hexdigest()[:24] + '-480.jpg'
            (self.previews / name).write_bytes(b'preview:' + content)
            entries.append(path.relative_to(self.photos).as_posix())
        (self.root / 'assets/collections/manifest.js').write_text(json.dumps(entries))

    def photo(self, collection='first', name='photo.jpg', content=b'photo to remove'):
        path = self.photos / collection / name
        path.write_bytes(content)
        self.store.set_medium(collection, name, 'analog')
        return path

    def test_detach_and_attach_preserve_original_and_medium(self):
        original = self.photo()
        self.store.delete_photo('first', 'photo.jpg')
        item = self.store.library.state()[0]
        self.assertFalse(original.exists())
        self.assertEqual(item['medium'], 'analog')
        self.assertNotIn('path', item)
        self.store.library.attach(item['id'], 'second')
        self.assertEqual((self.photos / 'second/photo.jpg').read_bytes(), b'photo to remove')
        self.assertEqual(self.store.types()['photos']['second/photo.jpg'], 'analog')
        self.assertEqual(self.store.library.state(), [])

    def test_deleted_collection_photos_can_be_added_individually(self):
        self.photo(name='a.jpg'); self.photo(name='b.jpg', content=b'another photo')
        self.store.delete_collection('first')
        entries = self.store.library.state()
        self.assertEqual(len(entries), 2)
        self.store.library.attach(entries[0]['id'], 'second')
        self.assertEqual(len(self.store.library.state()), 1)
        self.assertFalse((self.photos / 'first').exists())

    def test_attach_conflict_and_failure_do_not_lose_library_file(self):
        self.photo(); self.store.delete_photo('first', 'photo.jpg')
        item = self.store.library.state()[0]
        other = self.photo('second', content=b'different original')
        with self.assertRaises(EditorError): self.store.library.attach(item['id'], 'second')
        self.assertEqual(other.read_bytes(), b'different original')
        self.assertEqual(len(self.store.library.state()), 1)
        def fail(): raise RuntimeError('failed rebuild')
        self.store.rebuild = fail
        with self.assertRaises(RuntimeError): self.store.library.attach(item['id'], 'first')
        self.assertEqual(len(self.store.library.state()), 1)
        self.assertFalse((self.photos / 'first/photo.jpg').exists())

    def test_purge_removes_identical_copies_cache_and_generated_exports(self):
        self.photo(); duplicate = self.photo('second')
        keep = self.photo('second', 'keep.jpg', b'keep this original')
        future = self.photos.parent / '2027/new'
        future.mkdir(parents=True)
        (future / 'duplicate.jpg').write_bytes(b'photo to remove')
        future_types = future.parent / 'photo-types.json'
        future_types.write_text(json.dumps({'photos': {'new/duplicate.jpg': 'digital'}}))
        self.store.delete_photo('first', 'photo.jpg')
        item = self.store.library.state()[0]
        old_preview = self.previews / 'abcdef-480.jpg'; old_preview.write_bytes(b'old thumbnail')
        release = self.root / 'dist/wizje-20260927-120000-123456'; release.mkdir(parents=True)
        (release / 'photo.jpg').write_bytes(b'old public copy')
        archive = release.with_suffix('.zip'); archive.write_bytes(b'old ZIP')
        unrelated = self.root / 'dist/my-notes.txt'; unrelated.write_text('unrelated')
        self.store.library.purge('photo.jpg', identifier=item['id'])
        self.assertFalse(duplicate.exists())
        self.assertFalse((future / 'duplicate.jpg').exists())
        self.assertEqual(json.loads(future_types.read_text())['photos'], {})
        self.assertEqual(keep.read_bytes(), b'keep this original')
        self.assertEqual(self.store.library.state(), [])
        self.assertFalse(old_preview.exists())
        self.assertFalse(release.exists()); self.assertFalse(archive.exists())
        self.assertTrue(unrelated.exists())
        self.assertEqual([p.read_bytes() for p in self.previews.iterdir()], [b'preview:keep this original'])
        self.assertEqual(set(self.store.types()['photos']), {'second/keep.jpg'})
        self.assertFalse(self.store.library.journal.exists())
        for path in self.store.trash_root.rglob('*'):
            if path.is_file(): self.assertNotEqual(path.read_bytes(), b'photo to remove')

    def test_permanent_delete_requires_exact_confirmation_and_safe_paths(self):
        original = self.photo()
        with self.assertRaises(EditorError): self.store.library.purge('wrong', collection='first', name='photo.jpg')
        with self.assertRaises(EditorError): self.store.library.purge('photo.jpg', collection='../first', name='photo.jpg')
        with self.assertRaises(EditorError): self.store.library.find('../private')
        (self.previews / 'linked.jpg').symlink_to(original)
        with self.assertRaises(EditorError): self.store.library.purge('photo.jpg', collection='first', name='photo.jpg')
        self.assertTrue(original.exists())
        self.assertFalse(self.store.library.journal.exists())

    def test_interrupted_purge_resumes_without_photo_backup(self):
        original = self.photo()
        def fail(): raise RuntimeError('preview renderer failed')
        self.store.rebuild = fail
        with self.assertRaises(EditorError) as failure:
            self.store.library.purge('photo.jpg', collection='first', name='photo.jpg')
        self.assertEqual(failure.exception.status, 503)
        self.assertFalse(original.exists())
        self.assertTrue(self.store.library.journal.exists())
        self.assertEqual(self.store.library.state(), [])
        self.store.rebuild = self.rebuild
        self.store.library.finish_pending()
        self.assertFalse(self.store.library.journal.exists())
        self.assertEqual(json.loads((self.root / 'assets/collections/manifest.js').read_text()), [])


if __name__ == '__main__': unittest.main()
