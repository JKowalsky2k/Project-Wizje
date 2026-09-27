"""Run with: python3 -m unittest discover -s tools -p 'test_*.py'."""
from pathlib import Path
from tempfile import TemporaryDirectory
import unittest
import json
from importlib.util import spec_from_file_location, module_from_spec

spec = spec_from_file_location('zwidy_collections', Path(__file__).with_name('collections.py'))
collections = module_from_spec(spec)
spec.loader.exec_module(collections)


class ManifestTests(unittest.TestCase):
    def setUp(self):
        self.temp = TemporaryDirectory()
        self.root = Path(self.temp.name)
        self.addCleanup(self.temp.cleanup)

    def test_empty_folders_use_three_valid_source_rectangles(self):
        for name, _ in collections.COLLECTIONS:
            (self.root / f'{name}.png').touch()
        result = collections.build_manifest(self.root)
        self.assertEqual([c['id'] for c in result], ['alps', 'cars', 'dolomites', 'torun'])
        for collection in result:
            self.assertEqual(len(collection['photos']), 3)
            for photo in collection['photos']:
                x, y, width, height = photo['crop']
                self.assertGreater(width, 0)
                self.assertGreater(height, 0)
                self.assertLessEqual(x + width, photo['sourceSize'][0])
                self.assertLessEqual(y + height, photo['sourceSize'][1])
                self.assertTrue((self.root / Path(photo['src']).name).is_file())

    def test_real_photos_replace_boards_and_sort_naturally(self):
        folder = self.root / 'alps'
        folder.mkdir()
        for name in ['10.jpg', '2.JPG', '01.webp', 'notes.txt', '.hidden.jpg', 'raw.nef']:
            (folder / name).touch()
        result = collections.build_manifest(self.root)[0]['photos']
        self.assertEqual([p['src'].split('/')[-1] for p in result], ['01.webp', '2.JPG', '10.jpg'])
        self.assertTrue(all('crop' not in p for p in result))

    def test_filenames_are_url_encoded(self):
        folder = self.root / 'torun'
        folder.mkdir()
        (folder / '01 Wisła #1?.png').touch()
        photo = collections.build_manifest(self.root)[0]['photos'][0]
        self.assertEqual(photo['src'], 'assets/collections/2026/torun/01%20Wis%C5%82a%20%231%3F.png')

    def test_single_photo_and_removal(self):
        folder = self.root / 'cars'
        folder.mkdir()
        photo = folder / '01.avif'
        photo.touch()
        self.assertEqual(len(collections.build_manifest(self.root)[0]['photos']), 1)
        photo.unlink()
        self.assertEqual(collections.build_manifest(self.root), [])

    def test_ignores_symlinks_and_directories(self):
        folder = self.root / 'dolomites'
        folder.mkdir()
        (folder / 'nested.jpg').mkdir()
        source = self.root / 'external.jpg'
        source.touch()
        (folder / 'linked.jpg').symlink_to(source)
        self.assertEqual(collections.build_manifest(self.root), [])

    def test_discovers_new_collection_folder(self):
        folder = self.root / 'planes'
        folder.mkdir()
        (folder / '01.jpg').touch()
        result = collections.build_manifest(self.root)
        self.assertEqual(result[0]['id'], 'planes')
        self.assertEqual(result[0]['title'], 'Planes')
        self.assertEqual(len(result), 1)

    def test_empty_tree_has_no_broken_fallbacks(self):
        self.assertEqual(collections.build_manifest(self.root), [])

    def test_photo_techniques_and_custom_title(self):
        folder = self.root / 'nowa-kolekcja'
        folder.mkdir()
        for name in ['01.jpg', '02.jpg', '03.jpg']:
            (folder / name).touch()
        (self.root / 'photo-types.json').write_text(json.dumps({
            'collections': {'nowa-kolekcja': 'analog'},
            'photos': {'nowa-kolekcja/02.jpg': 'analog', 'nowa-kolekcja/03.jpg': 'digital'}
        }))
        (self.root / 'collection-info.json').write_text(json.dumps({'nowa-kolekcja': {'title': 'Moje lato'}}))
        result = collections.build_manifest(self.root)[0]
        self.assertEqual(result['title'], 'Moje lato')
        self.assertEqual([p.get('medium') for p in result['photos']], [None, 'analog', 'digital'])

    def test_discovers_years_and_keeps_same_collection_names_separate(self):
        for year in ['2026', '2027']:
            folder = self.root / year / 'cars'; folder.mkdir(parents=True)
            (folder / '01.jpg').touch()
        (self.root / '2028').mkdir()
        (self.root / 'previews').mkdir()
        (self.root / '2029').symlink_to(self.root / '2027')
        result = collections.build_all_manifests(self.root)
        self.assertEqual([c['year'] for c in result], ['2027', '2026'])
        self.assertEqual([c['id'] for c in result], ['cars', 'cars'])
        self.assertEqual(result[0]['photos'][0]['src'], 'assets/collections/2027/cars/01.jpg')
        self.assertEqual(result[1]['photos'][0]['src'], 'assets/collections/2026/cars/01.jpg')


if __name__ == '__main__':
    unittest.main()
