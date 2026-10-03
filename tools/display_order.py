"""Stable display ordering without renaming collection folders or photographs."""
import json

DEFAULT_COLLECTIONS = ('alps', 'cars', 'dolomites', 'torun')


def read_order(photo_root):
    path = photo_root / 'display-order.json'
    if not path.exists():
        return {}
    data = json.loads(path.read_text(encoding='utf-8'))
    if not isinstance(data, dict):
        raise ValueError('Invalid display order metadata')
    return data


def ordered(items, saved, key=lambda item: item):
    """Keep unsaved/new items in their existing fallback order, after saved ones."""
    if not isinstance(saved, (list, tuple)):
        return list(items)
    ranks = {name: index for index, name in enumerate(saved) if isinstance(name, str)}
    return sorted(items, key=lambda item: ranks.get(key(item), len(saved)))
