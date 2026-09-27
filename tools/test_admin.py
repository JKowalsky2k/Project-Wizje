import io
import json
from pathlib import Path
from tempfile import TemporaryDirectory
from threading import Lock
from types import SimpleNamespace
import unittest
from unittest.mock import patch
import zipfile

from admin_panel import EditorStore, EditorError, LocalAdmin


class FakeHandler:
    def __init__(self, path, headers=None, body=b''):
        self.path = path
        self.headers = {'Host': '127.0.0.1:8765', **(headers or {})}
        self.headers.setdefault('Content-Length', str(len(body)))
        self.server = SimpleNamespace(server_port=8765, server_address=('127.0.0.1', 8765))
        self.client_address = ('127.0.0.1', 54321)
        self.rfile, self.wfile = io.BytesIO(body), io.BytesIO()
        self.response_headers = {}

    def send_response(self, status): self.status = status
    def send_header(self, name, value): self.response_headers[name] = value
    def end_headers(self): pass


class AdminTests(unittest.TestCase):
    def setUp(self):
        temp = TemporaryDirectory(); self.addCleanup(temp.cleanup)
        self.root = Path(temp.name).resolve() / 'website'
        self.password_path = Path(temp.name).resolve() / 'credentials/password.json'
        self.photos = self.root / 'assets/collections/2026'; self.photos.mkdir(parents=True)
        self.rebuilds = 0
        def rebuild(): self.rebuilds += 1
        self.store = EditorStore(self.root, self.photos, rebuild, trash_root=self.password_path.parent / 'trash')
        self.admin = LocalAdmin(self.root, self.photos, rebuild, Lock(), password_path=self.password_path)

    def login_request(self, password='test-password-123', setup=None, headers=None):
        body = json.dumps({'password': password, 'confirmation': password,
                           'setup': not self.admin.password_path.exists() if setup is None else setup}).encode()
        request = FakeHandler('/admin/api/login', {'X-Wizje-CSRF': self.admin.auth_csrf, **(headers or {})}, body)
        self.admin.post(request)
        return request

    def login(self):
        request = self.login_request()
        self.assertEqual(request.status, 200)
        self.assertIn('HttpOnly', request.response_headers['Set-Cookie'])
        self.assertIn('SameSite=Strict', request.response_headers['Set-Cookie'])
        return request.response_headers['Set-Cookie'].split(';', 1)[0]

    def test_years_isolate_identical_collection_names_and_library_moves(self):
        cookie = self.login()
        def post(action, data, raw=False):
            request = FakeHandler('/admin/api/' + action,
                {'Cookie': cookie, 'X-Wizje-CSRF': self.admin.csrf},
                data if raw else json.dumps(data).encode())
            self.admin.post(request)
            self.assertEqual(request.status, 200, request.wfile.getvalue())
            return json.loads(request.wfile.getvalue())
        for year in ['2026', '2027']:
            result = post('collections', {'name': 'Wakacje', 'year': year})
            self.assertEqual(result['key'], year + '/wakacje')
            post('upload?collection=wakacje&year=' + year + '&name=photo.jpg&medium=analog', b'\xff\xd8\xfftest', True)
        self.assertEqual({c['key'] for c in self.admin.collections_state()}, {'2026/wakacje', '2027/wakacje'})
        post('medium', {'collection': 'wakacje', 'year': '2027', 'name': 'photo.jpg', 'medium': 'digital'})
        self.assertEqual(self.admin.year_store('2026').types()['photos']['wakacje/photo.jpg'], 'analog')
        self.assertEqual(self.admin.year_store('2027').types()['photos']['wakacje/photo.jpg'], 'digital')
        post('delete-photo', {'collection': 'wakacje', 'year': '2027', 'name': 'photo.jpg'})
        self.assertTrue((self.photos / 'wakacje/photo.jpg').is_file())
        library_id = self.admin.store.library.state()[0]['id']
        post('library-attach', {'id': library_id, 'collection': 'wakacje', 'year': '2027'})
        self.assertEqual(self.admin.year_store('2027').types()['photos']['wakacje/photo.jpg'], 'digital')
        post('delete-collection', {'collection': 'wakacje', 'year': '2027'})
        self.assertTrue((self.photos / 'wakacje/photo.jpg').is_file())
        self.assertFalse((self.photos.parent / '2027/wakacje').exists())

    def test_year_paths_reject_invalid_values_and_symlinks(self):
        for year in ['../2027', '2027/other', '2027.5', '', 999, 3000, True, []]:
            with self.assertRaises(EditorError):
                self.admin.year_store(year, create=True)
        (self.photos.parent / '2027').symlink_to(self.photos, target_is_directory=True)
        with self.assertRaises(EditorError):
            self.admin.year_store('2027', create=True)

    def test_private_routes_require_login(self):
        for path in ['/admin/editor.js', '/admin/api/state']:
            request = FakeHandler(path); self.admin.get(request)
            self.assertEqual(request.status, 401)
        for path in ['/admin', '/admin/login.js', '/admin/editor.css', '/admin/api/auth']:
            request = FakeHandler(path); self.admin.get(request)
            self.assertEqual(request.status, 200)
        request = FakeHandler('/admin/access?token=old'); self.admin.get(request)
        self.assertEqual(request.status, 303)
        self.assertNotIn('Set-Cookie', request.response_headers)

    def test_password_survives_restart_and_two_browser_sessions(self):
        first = self.login()
        saved = self.admin.password_path.read_text()
        self.assertNotIn('test-password-123', saved)
        self.assertEqual(self.admin.password_path.stat().st_mode & 0o777, 0o600)
        second = self.login()
        self.assertNotEqual(first, second)
        for cookie in [first, second]:
            self.assertTrue(self.admin.authenticated(FakeHandler('/admin', {'Cookie': cookie})))
        self.admin = LocalAdmin(self.root, self.photos, lambda: None, Lock(), password_path=self.password_path)
        self.assertFalse(self.admin.authenticated(FakeHandler('/admin', {'Cookie': first})))
        self.login()  # Same password, fresh server.
        self.assertEqual(self.admin.password_path.read_text(), saved)

    def test_login_validation_csrf_origin_and_rate_limit(self):
        for headers in [{'X-Wizje-CSRF': ''}, {'Origin': 'https://evil.example'}, {'Host': 'evil.example:8765'}]:
            self.assertIn(self.login_request(headers=headers).status, (401, 403))
        self.assertFalse(self.admin.password_path.exists())
        request = FakeHandler('/admin/api/login', {'X-Wizje-CSRF': self.admin.auth_csrf},
                              b'{"setup":true,"password":"test-password-123","confirmation":"different"}')
        self.admin.post(request)
        self.assertEqual(request.status, 400)
        self.assertFalse(self.admin.password_path.exists())
        self.login()
        self.assertEqual(self.login_request(setup=True).status, 409)
        for _ in range(5): self.assertEqual(self.login_request(password='incorrect-password').status, 401)
        self.assertEqual(self.login_request().status, 429)

    def test_session_expiry_and_logout_are_per_browser(self):
        first, second = self.login(), self.login()
        request = FakeHandler('/admin/api/logout', {'Cookie': first, 'X-Wizje-CSRF': self.admin.csrf})
        self.admin.post(request)
        self.assertFalse(self.admin.authenticated(FakeHandler('/admin', {'Cookie': first})))
        self.assertTrue(self.admin.authenticated(FakeHandler('/admin', {'Cookie': second})))
        self.admin.sessions[second.split('=', 1)[1]] = 0
        self.assertFalse(self.admin.authenticated(FakeHandler('/admin', {'Cookie': second})))

    def test_login_and_state(self):
        cookie = self.login()
        request = FakeHandler('/admin/api/state', {'Cookie': cookie})
        self.admin.get(request)
        self.assertEqual(request.status, 200)
        self.assertEqual(json.loads(request.wfile.getvalue())['csrf'], self.admin.csrf)

    def test_write_requires_session_csrf_and_local_origin(self):
        body = json.dumps({'name': 'Test', 'medium': 'analog'}).encode()
        cookie = self.login()
        for headers, expected in [({}, 401), ({'Cookie': cookie}, 403),
            ({'Cookie': cookie, 'X-Wizje-CSRF': self.admin.csrf, 'Origin': 'https://evil.example'}, 403),
            ({'Cookie': cookie, 'X-Wizje-CSRF': self.admin.csrf, 'Host': 'evil.example:8765'}, 401)]:
            request = FakeHandler('/admin/api/collections', headers, body)
            self.admin.post(request); self.assertEqual(request.status, expected)
        self.assertFalse((self.photos / 'test').exists())

    def test_authenticated_create_and_logout(self):
        cookie = self.login()
        headers = {'Cookie': cookie, 'X-Wizje-CSRF': self.admin.csrf, 'Origin': 'http://127.0.0.1:8765'}
        request = FakeHandler('/admin/api/collections', headers, json.dumps({'name': 'Łódź nocą'}).encode())
        self.admin.post(request)
        self.assertEqual(request.status, 200)
        self.assertTrue((self.photos / 'lodz-noca').is_dir())
        request = FakeHandler('/admin/api/logout', headers)
        self.admin.post(request)
        request = FakeHandler('/admin/api/state', {'Cookie': cookie}); self.admin.get(request)
        self.assertEqual(request.status, 401)

    def test_photo_technique_only(self):
        slug = self.store.create('Zdjęcia')
        (self.photos / slug / '01.jpg').write_bytes(b'original')
        self.assertIsNone(self.store.state()[0]['photos'][0]['medium'])
        self.assertNotIn('medium', self.store.state()[0])
        self.assertTrue(self.store.state()[0]['customTitle'])
        for medium in ['analog', 'digital', None]:
            self.store.set_medium(slug, '01.jpg', medium)
            self.assertEqual(self.store.state()[0]['photos'][0]['medium'], medium)
        self.assertIsNone(self.store.state()[0]['photos'][0]['medium'])

    def test_upload_preserves_existing_files_and_rejects_paths(self):
        slug = self.store.create('Test')
        content = b'\xff\xd8\xfffake-image-for-store-test'
        self.store.upload(slug, '01.jpg', 'analog', content)
        with self.assertRaises(EditorError): self.store.upload(slug, '01.jpg', 'digital', content)
        self.assertEqual((self.photos / slug / '01.jpg').read_bytes(), content)
        for name in ['../secret.jpg', '/secret.jpg', '.hidden.jpg', 'bad.html', 'a\\b.jpg']:
            with self.assertRaises(EditorError): self.store.upload(slug, name, 'analog', content)
        with self.assertRaises(EditorError): self.store.upload('../test', '01.jpg', 'analog', content)
        with self.assertRaises(EditorError): self.store.upload(slug, '02.jpg', 'analog', b'<html>bad</html>')

    def test_decode_failure_rolls_back_new_upload(self):
        slug = self.store.create('Test')
        before = self.store.types()
        def fail(): raise RuntimeError('Decoder rejected image')
        self.store.rebuild = fail
        with self.assertRaises(RuntimeError): self.store.upload(slug, 'bad.jpg', 'analog', b'\xff\xd8\xffbad')
        self.assertFalse((self.photos / slug / 'bad.jpg').exists())
        self.assertEqual(self.store.types(), before)

    def test_symlinks_and_invalid_medium_are_rejected(self):
        outside = self.root / 'outside'; outside.mkdir()
        (self.photos / 'linked').symlink_to(outside)
        with self.assertRaises(EditorError): self.store.folder('linked')
        slug = self.store.create('Test')
        for medium in ['maybe', 'both', 'mix']:
            with self.assertRaises(EditorError): self.store.set_medium(slug, '01.jpg', medium)

    def test_removed_default_route_and_english_errors(self):
        headers = {'Cookie': self.login(), 'X-Wizje-CSRF': self.admin.csrf, 'Accept-Language': 'en'}
        request = FakeHandler('/admin/api/default', headers, b'{}')
        self.admin.post(request)
        self.assertEqual(request.status, 404)
        self.assertEqual(json.loads(request.wfile.getvalue())['error'], 'Operation not found.')
        request = FakeHandler('/admin/api/medium', headers, b'{"medium":"both"}')
        self.admin.post(request)
        self.assertEqual(request.status, 400)
        self.assertEqual(json.loads(request.wfile.getvalue())['error'], 'Choose ANALOG or DIGITAL.')

    def test_local_boundary_rejects_remote_proxy_and_cross_site_requests(self):
        for headers in [{'Forwarded': 'for=1.2.3.4'}, {'X-Forwarded-For': '1.2.3.4'},
                        {'X-Forwarded-Host': 'example.com'}, {'Sec-Fetch-Site': 'cross-site'}]:
            request = FakeHandler('/admin/api/auth', headers)
            self.admin.get(request)
            self.assertEqual(request.status, 403)
        for peer, bind in [('192.168.1.2', '127.0.0.1'), ('127.0.0.1', '0.0.0.0')]:
            request = FakeHandler('/admin')
            request.client_address = (peer, 54321)
            request.server.server_address = (bind, 8765)
            self.admin.get(request)
            self.assertEqual(request.status, 403)

    def test_migrates_password_outside_site_without_reset(self):
        self.login()
        saved = self.password_path.read_bytes()
        legacy = self.root / '.local-admin/password.json'
        legacy.parent.mkdir()
        legacy.write_bytes(saved)
        self.password_path.unlink()
        self.admin = LocalAdmin(self.root, self.photos, lambda: None, Lock(), password_path=self.password_path)
        self.assertFalse(legacy.exists())
        self.assertEqual(self.password_path.read_bytes(), saved)
        self.login()
        self.assertFalse(self.password_path.resolve().is_relative_to(self.root.resolve()))
        with self.assertRaises(RuntimeError):
            LocalAdmin(self.root, self.photos, lambda: None, Lock(), password_path=legacy)

    def test_export_and_download_require_the_creating_session(self):
        output = self.root / 'dist'; output.mkdir()
        archive = output / 'wizje-test.zip'
        with zipfile.ZipFile(archive, 'w') as bundle: bundle.writestr('index.html', 'public')
        first, second = self.login(), self.login()
        with patch('publish.publish', return_value=(output, archive, 12, 4)) as publish:
            for headers in [{}, {'Cookie': first}]:
                request = FakeHandler('/admin/api/export', headers, b'{}')
                self.admin.post(request)
                self.assertIn(request.status, (401, 403))
            publish.assert_not_called()
            request = FakeHandler('/admin/api/export', {'Cookie': first, 'X-Wizje-CSRF': self.admin.csrf}, b'{}')
            self.admin.post(request)
            self.assertEqual(request.status, 200)
            publish.assert_called_once_with(self.root)
        result = json.loads(request.wfile.getvalue())
        for cookie, expected in [('', 401), (second, 404), (first, 200)]:
            request = FakeHandler(result['download'], {'Cookie': cookie})
            self.admin.get(request)
            self.assertEqual(request.status, expected)
            if expected == 200:
                self.assertEqual(request.wfile.getvalue(), archive.read_bytes())
                self.assertEqual(request.response_headers['Content-Type'], 'application/zip')
        archive.unlink()
        archive.symlink_to(self.password_path)
        request = FakeHandler(result['download'], {'Cookie': first})
        self.admin.get(request)
        self.assertEqual(request.status, 404)

    def test_download_expires(self):
        cookie = self.login()
        self.admin.exports['expired'] = {'session': cookie.split('=', 1)[1], 'expires': 0, 'path': self.root / 'private'}
        request = FakeHandler('/admin/download/expired', {'Cookie': cookie})
        self.admin.get(request)
        self.assertEqual(request.status, 404)

    def test_delete_photo_preserves_backup_and_other_photos(self):
        slug = self.store.create('Test')
        for name in ['01.jpg', '02.jpg']:
            (self.photos / slug / name).write_bytes(name.encode())
            self.store.set_medium(slug, name, 'analog')
        identifier = self.store.delete_photo(slug, '01.jpg')
        self.assertFalse((self.photos / slug / '01.jpg').exists())
        self.assertTrue((self.photos / slug / '02.jpg').exists())
        self.assertNotIn(slug + '/01.jpg', self.store.types()['photos'])
        self.assertEqual(self.store.types()['photos'][slug + '/02.jpg'], 'analog')
        backup = self.store.trash_root / identifier
        self.assertEqual((backup / '0').read_bytes(), b'01.jpg')
        restore = json.loads((backup / 'restore.json').read_text())
        self.assertEqual(restore['photos'], {slug + '/01.jpg': 'analog'})
        self.assertEqual(restore['status'], 'deleted')
        self.assertEqual(restore['files'][0]['original'], slug + '/01.jpg')
        self.assertEqual(len(self.store.state()[0]['photos']), 1)

    def test_delete_collection_cleans_metadata_and_keeps_backup(self):
        slug = self.store.create('Moje zdjęcia')
        (self.photos / slug / '01.jpg').write_bytes(b'original')
        self.store.set_medium(slug, '01.jpg', 'digital')
        self.store.create('Inne')
        identifier = self.store.delete_collection(slug)
        self.assertFalse((self.photos / slug).exists())
        self.assertEqual([c['id'] for c in self.store.state()], ['inne'])
        self.assertNotIn(slug, json.loads(self.store.info_path.read_text()))
        self.assertEqual(self.store.types()['photos'], {})
        backup = self.store.trash_root / identifier
        self.assertEqual((backup / '0/01.jpg').read_bytes(), b'original')
        self.assertEqual(json.loads((backup / 'restore.json').read_text())['collectionInfo']['title'], 'Moje zdjęcia')
        self.assertEqual(self.store.create('Moje zdjęcia'), slug)

    def test_failed_delete_restores_files_metadata_and_manifest(self):
        slug = self.store.create('Test')
        (self.photos / slug / '01.jpg').write_bytes(b'original')
        self.store.set_medium(slug, '01.jpg', 'analog')
        manifest = self.root / 'assets/collections/manifest.js'
        manifest.write_text('previous manifest')
        snapshot = {p: p.read_bytes() for p in [self.store.types_path, self.store.info_path, manifest]}
        def fail():
            manifest.write_text('incomplete new manifest')
            raise RuntimeError('failed rebuild')
        self.store.rebuild = fail
        with self.assertRaises(RuntimeError): self.store.delete_collection(slug)
        self.assertEqual((self.photos / slug / '01.jpg').read_bytes(), b'original')
        for path, content in snapshot.items(): self.assertEqual(path.read_bytes(), content)

    def test_delete_last_photo_removes_legacy_board_fallback(self):
        slug = self.store.create('Alps')
        (self.photos / slug / '01.jpg').write_bytes(b'original')
        (self.photos / 'alps.png').write_bytes(b'legacy board')
        identifier = self.store.delete_photo(slug, '01.jpg')
        self.assertFalse((self.photos / 'alps.png').exists())
        self.assertEqual((self.store.trash_root / identifier / '1').read_bytes(), b'legacy board')
        self.assertEqual(self.store.state()[0]['photos'], [])

    def test_delete_rejects_traversal_symlinks_and_missing_name(self):
        slug = self.store.create('Test')
        photo = self.photos / slug / '01.jpg'; photo.write_bytes(b'original')
        for collection, name in [(slug, None), (slug, '../01.jpg'), ('../test', '01.jpg')]:
            with self.assertRaises(EditorError): self.store.delete_photo(collection, name)
        with self.assertRaises(EditorError): self.store.delete_collection('../test')
        (self.photos / slug / 'linked.jpg').symlink_to(photo)
        with self.assertRaises(EditorError): self.store.delete_collection(slug)
        self.assertEqual(photo.read_bytes(), b'original')

    def test_delete_endpoints_require_session_and_csrf(self):
        slug = self.store.create('Test')
        photo = self.photos / slug / '01.jpg'; photo.write_bytes(b'original')
        cookie = self.login()
        for route in ['delete-photo', 'delete-collection']:
            body = json.dumps({'collection': slug, 'name': '01.jpg'}).encode()
            for headers in [{}, {'Cookie': cookie}]:
                request = FakeHandler('/admin/api/' + route, headers, body)
                self.admin.post(request)
                self.assertIn(request.status, (401, 403))
                self.assertTrue(photo.exists())
        headers = {'Cookie': cookie, 'X-Wizje-CSRF': self.admin.csrf}
        request = FakeHandler('/admin/api/delete-photo', headers, json.dumps({'collection': slug, 'name': '01.jpg'}).encode())
        self.admin.post(request); self.assertEqual(request.status, 200)
        self.assertFalse(photo.exists())
        request = FakeHandler('/admin/api/delete-collection', headers, json.dumps({'collection': slug}).encode())
        self.admin.post(request); self.assertEqual(request.status, 200)
        self.assertFalse(photo.parent.exists())

    def test_library_preview_attach_and_purge_are_authenticated(self):
        slug = self.store.create('Test')
        original = self.photos / slug / '01.jpg'; original.write_bytes(b'photo')
        self.store.delete_photo(slug, '01.jpg')
        item = self.store.library.state()[0]
        cookie = self.login()
        headers = {'Cookie': cookie, 'X-Wizje-CSRF': self.admin.csrf}
        request = FakeHandler(item['preview']); self.admin.get(request)
        self.assertEqual(request.status, 401)
        request = FakeHandler(item['preview'], {'Cookie': cookie}); self.admin.get(request)
        self.assertEqual(request.status, 200)
        self.assertEqual(request.wfile.getvalue(), b'photo')
        self.assertEqual(request.response_headers['Cache-Control'], 'no-store')
        for route in ['library-attach', 'purge-photo']:
            for auth in [{}, {'Cookie': cookie}]:
                request = FakeHandler('/admin/api/' + route, auth, json.dumps({'id': item['id'], 'collection': slug, 'confirmation': '01.jpg'}).encode())
                self.admin.post(request)
                self.assertIn(request.status, (401, 403))
        request = FakeHandler('/admin/api/library-attach', headers, json.dumps({'id': item['id'], 'collection': slug}).encode())
        self.admin.post(request); self.assertEqual(request.status, 200)
        self.assertEqual(original.read_bytes(), b'photo')
        request = FakeHandler('/admin/api/purge-photo', headers, json.dumps({'collection': slug, 'name': '01.jpg', 'confirmation': 'wrong'}).encode())
        self.admin.post(request); self.assertEqual(request.status, 400)
        self.assertTrue(original.exists())
        request = FakeHandler('/admin/api/purge-photo', headers, json.dumps({'collection': slug, 'name': '01.jpg', 'confirmation': '01.jpg'}).encode())
        self.admin.post(request); self.assertEqual(request.status, 200)
        self.assertFalse(original.exists())
        request = FakeHandler(item['preview'], {'Cookie': cookie}); self.admin.get(request)
        self.assertEqual(request.status, 404)


if __name__ == '__main__': unittest.main()
