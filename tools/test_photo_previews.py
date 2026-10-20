"""Regression for narrow white borders in the supplied landscape exports."""
import hashlib
import os
from pathlib import Path
import shutil
import struct
import sys
from tempfile import TemporaryDirectory
import unittest
import zlib

from photo_previews import prepare_previews, source_digest


class DigestCacheTests(unittest.TestCase):
    def test_repeated_build_uses_cached_hash_but_publish_verifies_content(self):
        from unittest.mock import patch
        with TemporaryDirectory() as directory:
            source = Path(directory) / 'source.jpg'
            source.write_bytes(b'original')
            digest = source_digest(source)
            with patch.object(Path, 'open', side_effect=AssertionError('unchanged source was read again')):
                self.assertEqual(source_digest(source), digest)
            with patch.object(Path, 'open', side_effect=OSError('verification reads source')):
                with self.assertRaises(OSError): source_digest(source, verify=True)


def png(width, height, white_right, rgb=b'\x48\x70\x90'):
    def chunk(kind, data):
        return struct.pack('>I', len(data)) + kind + data + struct.pack('>I', zlib.crc32(kind + data) & 0xffffffff)
    row = b'\x00' + rgb * (width - white_right) + b'\xff\xff\xff' * white_right
    return b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', struct.pack('>IIBBBBB', width, height, 8, 2, 0, 0, 0)) + chunk(b'IDAT', zlib.compress(row * height)) + chunk(b'IEND', b'')


@unittest.skipUnless(sys.platform == 'darwin' and shutil.which('swift'), 'Preview generation requires macOS Swift')
class PreviewEdgeTests(unittest.TestCase):
    def test_white_export_strip_removed_everywhere_without_changing_sources(self):
        with TemporaryDirectory() as directory:
            root = Path(directory)
            folder = root / 'assets/collections/2026/test'
            folder.mkdir(parents=True)
            photos = []
            expected = [('strip.png', 3, 37), ('plain.png', 0, 40), ('wide-white-region.png', 12, 40)]
            fingerprints = {}
            for name, white, width in expected:
                path = folder / name
                path.write_bytes(png(40, 30, white))
                fingerprints[name] = hashlib.sha256(path.read_bytes()).digest()
                photos.append({'src': str(path.relative_to(root)), 'orientation': 'landscape'})
            prepare_previews([{'photos': photos}], root)
            for photo, (name, white, width) in zip(photos, expected):
                self.assertEqual(photo['sourceWidth'], width)
                self.assertEqual(photo['sourceHeight'], 30)
                self.assertEqual(photo['trimmedRight'], 3 if white == 3 else 0)
                for key in ('src', 'previewMedium', 'previewHigh', 'detail', 'inspection'):
                    self.assertTrue((root / photo[key]).is_file())
                self.assertEqual(hashlib.sha256((folder / name).read_bytes()).digest(), fingerprints[name])

    def test_replacement_with_same_size_and_mtime_gets_new_preview_names(self):
        with TemporaryDirectory() as directory:
            root = Path(directory)
            path = root / 'assets/collections/2026/test/image.png'
            path.parent.mkdir(parents=True)
            original = png(40, 30, 0)
            replacement = next(data for red in range(73, 255) if len(data := png(40, 30, 0, bytes([red, 112, 144]))) == len(original))
            path.write_bytes(original)
            stat = path.stat()
            def build():
                photo = {'src': path.relative_to(root).as_posix(), 'orientation': 'landscape'}
                prepare_previews([{'photos': [photo]}], root)
                return photo
            first = build()
            path.write_bytes(replacement)
            os.utime(path, ns=(stat.st_atime_ns, stat.st_mtime_ns))
            self.assertEqual(path.stat().st_size, stat.st_size)
            self.assertEqual(path.stat().st_mtime_ns, stat.st_mtime_ns)
            second = build()
            for key in ('src', 'previewHigh', 'detail', 'inspection'):
                self.assertNotEqual(first[key], second[key])
