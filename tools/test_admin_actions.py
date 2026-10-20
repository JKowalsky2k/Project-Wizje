"""Transactions and publishing state in the local photo workspace."""
import json
import os
from pathlib import Path
from tempfile import TemporaryDirectory
from threading import Lock
import time
import unittest
from unittest.mock import patch

from admin_panel import LocalAdmin, EditorError
from test_admin import FakeHandler


class EditorActionTests(unittest.TestCase):
    def setUp(self):
        temp = TemporaryDirectory(); self.addCleanup(temp.cleanup)
        self.root = Path(temp.name).resolve() / 'site'
        self.photos = self.root / 'assets/collections/2026'
        for year in ('2026', '2027'):
            for name in ('source', 'target'):
                (self.root / f'assets/collections/{year}/{name}').mkdir(parents=True)
        for name in ('a.jpg', 'b.jpg'):
            (self.photos / 'source' / name).write_bytes(b'\xff\xd8\xff' + name.encode())
        self.builds = 0
        def rebuild(): self.builds += 1
        self.admin = LocalAdmin(self.root, self.photos, rebuild, Lock(), password_path=Path(temp.name).resolve() / 'private/password.json')
        self.admin.sessions['test-session'] = time.monotonic() + 3600
        self.headers = {'Cookie':'wizje_admin_8765=test-session', 'X-Wizje-CSRF':self.admin.csrf}

    def post(self, route, data, status=200, headers=None):
        handler = FakeHandler('/admin/api/' + route, self.headers if headers is None else headers, json.dumps(data).encode())
        self.admin.post(handler)
        result = json.loads(handler.wfile.getvalue())
        self.assertEqual(handler.status, status, result)
        return result

    def test_group_edit_updates_all_fields_once_and_can_be_undone(self):
        changes = {'medium':'analog','film':'kodak-gold','iso':200,'colorMode':'monochrome','orientation':'landscape','posterSizes':[]}
        result = self.post('bulk-photos', {'collection':'source','names':['a.jpg','b.jpg'],'changes':changes})
        self.assertEqual(self.builds, 1)
        for photo in self.admin.store.state()[0]['photos']:
            self.assertEqual(photo['medium'], 'analog'); self.assertEqual(photo['iso'], 200)
            self.assertEqual(photo['posterSizes'], []); self.assertEqual(photo['orientation'], 'landscape')
        self.post('undo', {'token':result['undo']})
        self.assertIsNone(self.admin.store.types()['photos'].get('source/a.jpg'))
        self.assertEqual(self.builds, 2)

    def test_group_move_preserves_metadata_and_undo_restores_files(self):
        self.admin.store.set_medium('source','a.jpg','analog')
        self.admin.store.set_film('source','a.jpg','kodak-gold',200)
        result = self.post('bulk-photos', {'year':'2026','collection':'source','names':['a.jpg','b.jpg'],'changes':{},'target':{'year':'2027','collection':'target'}})
        target = self.root / 'assets/collections/2027/target'
        self.assertFalse((self.photos/'source/a.jpg').exists()); self.assertTrue((target/'a.jpg').is_file())
        config = self.admin.year_store('2027').types()
        self.assertEqual(config['filmDetails']['target/a.jpg']['iso'],200)
        self.post('undo', {'token':result['undo']})
        self.assertTrue((self.photos/'source/a.jpg').is_file()); self.assertFalse((target/'a.jpg').exists())
        self.assertEqual(self.admin.store.types()['filmDetails']['source/a.jpg']['iso'],200)

    def test_collision_and_invalid_fields_leave_everything_untouched(self):
        (self.photos/'target/b.jpg').write_bytes(b'existing')
        before = self.admin.store.types()
        self.post('bulk-photos', {'collection':'source','names':['a.jpg','b.jpg'],'changes':{'medium':'digital'},'target':{'year':'2026','collection':'target'}},409)
        self.assertEqual(self.admin.store.types(),before)
        self.assertTrue((self.photos/'source/a.jpg').exists()); self.assertFalse((self.photos/'target/a.jpg').exists())
        for changes in ({'orientation':'diagonal'},{'posterSizes':['unknown']},{'medium':'digital','film':'kodak-gold'},{'private':True}):
            self.post('bulk-photos', {'collection':'source','names':['a.jpg'],'changes':changes},400)
        self.assertEqual(self.admin.store.types(),before)

    def test_failed_rebuild_rolls_back_files_and_configuration(self):
        def fail(): raise RuntimeError('decoder failed')
        self.admin.store.rebuild = fail
        self.post('bulk-photos', {'collection':'source','names':['a.jpg'],'changes':{'medium':'digital'},'target':{'year':'2027','collection':'target'}},500)
        self.assertTrue((self.photos/'source/a.jpg').exists())
        self.assertFalse((self.root/'assets/collections/2027/target/a.jpg').exists())
        self.assertNotIn('source/a.jpg', self.admin.store.types()['photos'])

    def test_undo_is_session_bound_and_does_not_overwrite_new_changes(self):
        result = self.post('medium',{'collection':'source','name':'a.jpg','medium':'digital'})
        self.admin.sessions['another'] = time.monotonic() + 3600
        other = {**self.headers,'Cookie':'wizje_admin_8765=another'}
        self.post('undo',{'token':result['undo']},409,other)
        self.admin.store.set_color_mode('source','a.jpg','monochrome')
        self.post('undo',{'token':result['undo']},409)
        self.assertEqual(self.admin.store.types()['colorModes']['source/a.jpg'],'monochrome')
        self.post('bulk-photos',{'collection':'source','names':['a.jpg'],'changes':{'medium':'digital'}},401,{})
        self.post('undo',{'token':result['undo']},403,{'Cookie':self.headers['Cookie']})

    def test_detach_undo_restores_original_without_a_confirmation_step(self):
        result = self.post('delete-photo',{'collection':'source','name':'a.jpg'})
        self.assertFalse((self.photos/'source/a.jpg').exists())
        self.post('undo',{'token':result['undo']})
        self.assertEqual((self.photos/'source/a.jpg').read_bytes(),b'\xff\xd8\xffa.jpg')
        self.assertEqual(self.admin.store.library.state(),[])

    def test_publishing_status_persists_and_detects_metadata_prices_and_sources(self):
        self.assertTrue(self.admin.actions.publication_status()['dirty'])
        self.admin.actions.published('release.zip')
        self.assertFalse(self.admin.actions.publication_status()['dirty'])
        source = self.photos/'source/a.jpg'; stat = source.stat()
        source.write_bytes(b'\xff\xd8\xffc.jpg'); os.utime(source,ns=(stat.st_atime_ns,stat.st_mtime_ns))
        self.assertTrue(self.admin.actions.publication_status()['dirty'])
        self.admin.actions.published('next.zip')
        self.admin.store.set_color_mode('source','a.jpg','monochrome')
        state = self.admin.actions.publication_status()
        self.assertEqual(state['changes']['changed'],1)
        self.admin.save_poster_catalog([{'name':'30 × 40 cm','priceCents':1000}])
        self.assertTrue(self.admin.actions.publication_status()['changes']['prices'])
        fresh = LocalAdmin(self.root,self.photos,self.admin.store.rebuild,Lock(),password_path=self.admin.password_path)
        self.assertEqual(fresh.actions.publication_status()['lastExport'],'next.zip')


if __name__ == '__main__': unittest.main()
