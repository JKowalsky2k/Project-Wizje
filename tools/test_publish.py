import json
from pathlib import Path
from tempfile import TemporaryDirectory
import unittest

from publish import build_public_tree


class PublishTests(unittest.TestCase):
    def setUp(self):
        temporary = TemporaryDirectory()
        self.addCleanup(temporary.cleanup)
        base = Path(temporary.name)
        self.root, self.output = base / 'source', base / 'output'
        self.root.mkdir(); self.output.mkdir()
        self.write('.htaccess', 'Options -Indexes')
        self.write('index.html', '<link rel="stylesheet" href="styles.css">')
        self.write('script.js', '// public')
        self.write('collections.js', '// public gallery')
        self.write('globe.js', '// public globe')
        self.write('favicon.svg', '<svg/>')
        self.write('favicon.ico', 'icon')
        self.write('styles.css', '@import url("assets/logo/logo.css");')
        self.write('assets/logo/logo.css', '@font-face{src:url("../fonts/test.woff2")}')
        self.write('assets/fonts/test.woff2', 'font')
        self.write('assets/fonts/test-OFL.txt', 'license')
        self.write('assets/collections/previews/abcdef-480.jpg', 'current preview')
        self.data = [{'id': 'test', 'year': '2027', 'title': 'Zdjęcia', 'private': 'secret', 'location': {'name': 'Toruń', 'lat': 53.01, 'lon': 18.6, 'private': 'secret'}, 'photos': [
            {'src': 'assets/collections/previews/abcdef-480.jpg', 'original': 'assets/collections/2026/test/private.jpg',
             'width': 480, 'height': 672, 'medium': 'analog', 'film': 'Kodak Gold', 'filmBrand': 'kodak', 'iso': 200, 'private': 'secret'}]}]

    def write(self, name, content):
        path = self.root / name
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(content)

    def test_exports_dependencies_and_licenses_but_not_private_data(self):
        for path in ['.local-admin/password.json', 'tools/admin/index.html', '.git/config',
                     'assets/collections/2026/photo-types.json', 'assets/collections/2026/test/private.jpg',
                     'assets/collections/previews/123456-480.jpg', 'assets/fonts/private.zip']:
            self.write(path, 'secret')
        self.assertEqual(build_public_tree(self.root, self.output, self.data), 1)
        files = {p.relative_to(self.output).as_posix() for p in self.output.rglob('*') if p.is_file()}
        self.assertEqual(files, {'.htaccess', 'index.html', 'styles.css', 'script.js', 'collections.js', 'globe.js', 'favicon.svg', 'favicon.ico', 'assets/logo/logo.css',
                                'assets/fonts/test.woff2', 'assets/fonts/test-OFL.txt',
                                'assets/collections/previews/abcdef-480.jpg', 'assets/collections/manifest.js'})
        manifest = (self.output / 'assets/collections/manifest.js').read_text()
        self.assertNotIn('secret', manifest)
        self.assertNotIn('original', manifest)
        data = json.loads(manifest.split(' = ', 1)[1].rstrip(';\n'))
        self.assertEqual(data[0]['photos'][0]['medium'], 'analog')
        self.assertEqual(data[0]['photos'][0]['film'], 'Kodak Gold')
        self.assertEqual(data[0]['photos'][0]['filmBrand'], 'kodak')
        self.assertEqual(data[0]['photos'][0]['iso'], 200)
        self.assertEqual(data[0]['title'], 'Zdjęcia')
        self.assertEqual(data[0]['year'], '2027')
        self.assertEqual(data[0]['location'], {'name': 'Toruń', 'lat': 53.01, 'lon': 18.6})

    def test_export_preserves_multiple_locations_without_private_fields(self):
        self.data[0]['locations'] = [{'name': 'Alpy Francuskie', 'nameEn': 'French Alps', 'lat': 53.01, 'lon': 18.6, 'private': 'secret'},
                                     {'name': 'Wrocław', 'lat': 51.1, 'lon': 17.03}]
        build_public_tree(self.root, self.output, self.data)
        manifest = (self.output / 'assets/collections/manifest.js').read_text()
        data = json.loads(manifest.split(' = ', 1)[1].rstrip(';\n'))
        self.assertEqual(len(data[0]['locations']), 2)
        self.assertEqual(data[0]['locations'][0]['nameEn'], 'French Alps')
        self.assertEqual(data[0]['locations'][1]['name'], 'Wrocław')
        self.assertNotIn('secret', manifest)

    def test_rejects_symlinked_assets(self):
        font = self.root / 'assets/fonts/test.woff2'
        font.unlink()
        font.symlink_to(self.root / 'script.js')
        with self.assertRaisesRegex(ValueError, 'symbolicznych'):
            build_public_tree(self.root, self.output, self.data)

    def test_rejects_nonpublic_css_references(self):
        self.write('styles.css', 'body{background:url(".local-admin/password.json")}')
        with self.assertRaisesRegex(ValueError, 'spoza listy'):
            build_public_tree(self.root, self.output, self.data)

    def test_missing_photo_or_license_stops_export(self):
        (self.root / 'assets/collections/previews/abcdef-480.jpg').unlink()
        with self.assertRaisesRegex(ValueError, 'Brakuje pliku'):
            build_public_tree(self.root, self.output, self.data)
        (self.root / 'assets/fonts/test-OFL.txt').unlink()
        with self.assertRaisesRegex(ValueError, 'Brak licencji'):
            build_public_tree(self.root, self.output, self.data)

    def test_original_cannot_be_published_as_preview(self):
        self.data[0]['photos'][0]['src'] = 'assets/collections/2026/test/private.jpg'
        with self.assertRaisesRegex(ValueError, 'osobnych zdjęć'):
            build_public_tree(self.root, self.output, self.data)


if __name__ == '__main__':
    unittest.main()
