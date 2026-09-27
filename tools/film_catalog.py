"""Film choices shared by the local editor and static manifest generator."""
FILMS = [
    {'id': identifier, 'name': name, 'brand': brand}
    for brand, identifier, name in [
        ('kodak', 'kodak-gold', 'Kodak Gold'),
        ('kodak', 'kodak-colorplus', 'Kodak ColorPlus'),
        ('kodak', 'kodak-ultramax', 'Kodak UltraMax'),
        ('kodak', 'kodak-portra', 'Kodak Portra'),
        ('kodak', 'kodak-ektar', 'Kodak Ektar'),
        ('kodak', 'kodak-tri-x', 'Kodak Tri-X'),
        ('kodak', 'kodak-t-max', 'Kodak T-Max'),
        ('fujifilm', 'fujicolor-c200', 'Fujicolor C200'),
        ('fujifilm', 'fujifilm-400', 'Fujifilm 400'),
        ('fujifilm', 'fujicolor-superia', 'Fujicolor Superia X-TRA'),
        ('ilford', 'ilford-hp5', 'Ilford HP5 Plus'),
        ('ilford', 'ilford-fp4', 'Ilford FP4 Plus'),
        ('ilford', 'ilford-delta', 'Ilford Delta'),
    ]
]
FILM_BY_ID = {film['id']: film for film in FILMS}
ISO_VALUES = [25, 50, 64, 100, 125, 160, 200, 250, 320, 400, 500, 640, 800, 1000, 1600, 3200]


def validate_film(film=None, iso=None):
    film = None if film == '' else film
    iso = None if iso == '' else iso
    if film is not None and (not isinstance(film, str) or film not in FILM_BY_ID):
        raise ValueError('Nieprawidłowy film / Invalid film.')
    if isinstance(iso, str) and iso.isdecimal():
        iso = int(iso)
    if iso is not None and (type(iso) is not int or iso not in ISO_VALUES):
        raise ValueError('Nieprawidłowe ISO / Invalid ISO.')
    return {key: value for key, value in {'film': film, 'iso': iso}.items() if value is not None}


def public_film(details):
    details = validate_film(details.get('film'), details.get('iso'))
    result = {'iso': details['iso']} if 'iso' in details else {}
    if details.get('film'):
        film = FILM_BY_ID[details['film']]
        result.update(film=film['name'], filmBrand=film['brand'])
    return result
