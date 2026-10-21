import importlib.util
import json
from pathlib import Path
import shutil
import struct
import sys
from tempfile import TemporaryDirectory
from threading import Lock
import time
import unittest
from urllib.parse import urlencode
import zlib

from admin_panel import LocalAdmin, EditorError, write_json
from photo_previews import prepare_previews
from print_crops import crop_source, set_crop
from publish import build_public_tree, PUBLIC_FILES
from test_admin import FakeHandler


def png(width, height):
    def chunk(kind, body):
        return struct.pack('!I', len(body)) + kind + body + struct.pack('!I', zlib.crc32(kind + body))
    pixels = (b'\x00' + bytes((80, 120, 160)) * width) * height
    return b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', struct.pack('!2I5B', width, height, 8, 2, 0, 0, 0)) + chunk(b'IDAT', zlib.compress(pixels)) + chunk(b'IEND', b'')


class PrintCropTests(unittest.TestCase):
    def setUp(self):
        temporary = TemporaryDirectory(); self.addCleanup(temporary.cleanup)
        self.base = Path(temporary.name).resolve(); self.root = self.base / 'site'
        self.photos = self.root / 'assets/collections/2026'
        (self.photos / 'test').mkdir(parents=True)
        (self.photos / 'test/main.png').write_bytes(png(80, 120))
        self.catalog = [{'name':'30 × 40 cm','priceCents':1000}, {'name':'50 × 70 cm','priceCents':2000}]
        write_json(self.root / 'assets/collections/posters.json', self.catalog)
        self.admin = LocalAdmin(self.root, self.photos, lambda: None, Lock(), self.base / 'private/password.json')
        self.admin.sessions['local'] = time.monotonic() + 3600
        self.headers = {'Cookie':'wizje_admin_8765=local','X-Wizje-CSRF':self.admin.csrf}

    def upload(self, body=None, headers=None, size='30 × 40 cm', status=200):
        query = urlencode({'collection':'test','name':'main.png','size':size,'filename':'crop.png'})
        handler = FakeHandler('/admin/api/print-crop?' + query, self.headers if headers is None else headers, png(90,120) if body is None else body)
        self.admin.post(handler)
        result = json.loads(handler.wfile.getvalue())
        self.assertEqual(handler.status, status, result)
        return result

    def post(self, route, data):
        handler = FakeHandler('/admin/api/' + route, self.headers, json.dumps(data).encode())
        self.admin.post(handler)
        result = json.loads(handler.wfile.getvalue()); self.assertEqual(handler.status, 200, result)
        return result

    def test_upload_replace_remove_and_undo_preserve_main_photo(self):
        original = (self.photos / 'test/main.png').read_bytes()
        result = self.upload()
        first = self.admin.store.types()['printCrops']['test/main.png']['30 × 40 cm']
        self.assertEqual(crop_source(self.root, first).read_bytes(), png(90,120))
        self.upload(body=png(180,240))
        second = self.admin.store.types()['printCrops']['test/main.png']['30 × 40 cm']
        self.assertNotEqual(first,second)
        self.assertEqual((self.photos / 'test/main.png').read_bytes(), original)
        removed = self.post('remove-print-crop', {'collection':'test','name':'main.png','size':'30 × 40 cm'})
        self.assertNotIn('test/main.png', self.admin.store.types()['printCrops'])
        self.post('undo',{'token':removed['undo']})
        self.assertEqual(self.admin.store.types()['printCrops']['test/main.png']['30 × 40 cm'], second)

    def test_validation_session_csrf_and_failure_rollback(self):
        self.upload(headers={},status=401)
        self.upload(headers={'Cookie':'wizje_admin_8765=local'},status=403)
        self.upload(headers={**self.headers,'Origin':'https://example.org'},status=403)
        self.upload(size='unknown',status=400)
        self.upload(body=b'not an image',status=400)
        def fail(): raise RuntimeError('decode failure')
        self.admin.store.rebuild = fail
        self.upload(status=500)
        self.assertEqual(self.admin.store.types(), {'photos':{}})
        self.assertEqual(list((self.root / 'assets/collections/.print-crops').iterdir()), [])
        for path in ['../private.jpg','tools/admin/index.html','assets/collections/.print-crops/../main.png']:
            with self.assertRaises(ValueError): crop_source(self.root,path)

    def test_upload_requires_enabled_size_but_disabled_assignment_can_be_removed(self):
        self.upload()
        config = self.admin.store.types()
        config['posterSizes'] = {'test/main.png':['50 × 70 cm']}
        write_json(self.admin.store.types_path,config)
        self.upload(status=400)
        self.post('remove-print-crop', {'collection':'test','name':'main.png','size':'30 × 40 cm'})
        self.assertNotIn('test/main.png', self.admin.store.types()['printCrops'])
        config = self.admin.store.types(); config['posterSizes']['test/main.png'] = []
        write_json(self.admin.store.types_path,config)
        self.upload(size='50 × 70 cm',status=400)
        config['posterSizes']['test/main.png'] = ['30 × 40 cm']
        write_json(self.admin.store.types_path,config)
        self.upload()

    def test_detach_restore_move_and_purge_keep_crop_ownership(self):
        self.upload()
        source = self.admin.store.types()['printCrops']['test/main.png']['30 × 40 cm']
        deleted = self.post('delete-photo', {'collection':'test','name':'main.png'})
        self.post('undo',{'token':deleted['undo']})
        self.assertEqual(self.admin.store.types()['printCrops']['test/main.png']['30 × 40 cm'],source)
        (self.photos / 'target').mkdir()
        self.post('bulk-photos',{'collection':'test','names':['main.png'],'changes':{},'target':{'year':'2026','collection':'target'}})
        self.assertEqual(self.admin.store.types()['printCrops']['target/main.png']['30 × 40 cm'],source)
        # A replacement leaves an old crop for undo; permanent deletion erases both.
        set_crop(self.admin.store,'target','main.png','30 × 40 cm',self.catalog,'new.png',png(180,240))
        self.post('purge-photo', {'collection':'target','name':'main.png','confirmed':True})
        self.assertEqual(list((self.root / 'assets/collections/.print-crops').iterdir()), [])

    @unittest.skipUnless(sys.platform == 'darwin' and shutil.which('swift'), 'requires macOS image renderer')
    def test_real_preview_generation_and_public_export_strip_private_sources(self):
        spec = importlib.util.spec_from_file_location('crop_manifest_builder', Path(__file__).with_name('collections.py'))
        builder = importlib.util.module_from_spec(spec); spec.loader.exec_module(builder)
        def rebuild():
            self.manifest = prepare_previews(builder.build_manifest(self.photos),self.root)
            (self.root / 'assets/collections/manifest.js').write_text('window.ZWIDY_COLLECTIONS = ' + json.dumps(self.manifest) + ';\n')
        self.admin.store.rebuild = rebuild
        self.upload()
        photo = next(p for c in self.manifest if c['id']=='test' for p in c['photos'])
        variant = photo['printCrops']['30 × 40 cm']
        self.assertEqual((variant['detailWidth'],variant['detailHeight']),(90,120))
        self.assertNotEqual(variant['detail'],photo['detail'])
        state = next(c for c in self.admin.store.state() if c['id']=='test')['photos'][0]
        self.assertEqual(state['printCrops']['30 × 40 cm']['detail'],variant['detail'])
        self.assertNotIn('original',state['printCrops']['30 × 40 cm'])
        for name in PUBLIC_FILES:
            path = self.root / name; path.parent.mkdir(parents=True,exist_ok=True); path.write_text('')
        output = self.base / 'public'; output.mkdir()
        build_public_tree(self.root,output,self.manifest)
        public_manifest = (output / 'assets/collections/manifest.js').read_text()
        self.assertIn(variant['detail'],public_manifest)
        self.assertTrue((output / variant['detail']).is_file())
        self.assertTrue((output / variant['inspection']).is_file())
        self.assertNotIn('.print-crops',public_manifest)
        self.assertNotIn('original',public_manifest)
        self.assertFalse((output / 'tools').exists())
        self.assertFalse((output / 'assets/collections/.print-crops').exists())


if __name__ == '__main__': unittest.main()
