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
        ('harman', 'harman-phoenix-200', 'HARMAN Phoenix 200'),
        ('harman', 'harman-phoenix-ii', 'HARMAN Phoenix II'),
        ('kono', 'kono-delight-art-100', 'KONO! Delight ART 100'),
        ('kono', 'kono-delight-art-400', 'KONO! Delight ART 400'),
        ('kono', 'kono-delight-art-ii-100', 'KONO! Delight ART II 100'),
        ('kono', 'kono-delight-art-ii-400', 'KONO! Delight ART II 400'),
        ('kono', 'kono-original-moonstruck', 'KONO! Original Moonstruck'),
        ('kono', 'kono-original-sunstroke', 'KONO! Original Sunstroke'),
        ('kono', 'kono-original-mirage', 'KONO! Original Mirage'),
        ('kono', 'kono-original-monsoon', 'KONO! Original Monsoon'),
        ('kono', 'kono-original-galaxy', 'KONO! Original Galaxy'),
        ('kono', 'kono-original-candy', 'KONO! Original Candy'),
        ('kono', 'kono-kolorit-125t', 'KONO! KOLORIT 125T'),
        ('kono', 'kono-kolorit-400t', 'KONO! KOLORIT 400T'),
        ('kono', 'kono-rotwild-400', 'KONO! ROTWILD 400'),
        ('kono', 'kono-donau-ii', 'KONO! DONAU II'),
        ('kono', 'kono-rekorder', 'KONO! REKORDER'),
        ('kono', 'kono-cinis-400', 'KONO! CINIS 400'),
        ('kono', 'kono-alien-200', 'KONO! ALIEN 200'),
        ('kono', 'kono-luft-200', 'KONO! LUFT 200'),
        ('kono', 'kono-ufo-200', 'KONO! UFO 200'),
        ('kono', 'kono-bebop-200', 'KONO! BEBOP 200'),
        ('kono', 'kono-offbeat-200', 'KONO! OFFBEAT 200'),
        ('kono', 'kono-mojo-200', 'KONO! MOJO 200'),
    ]
]
FILM_BY_ID = {film['id']: film for film in FILMS}
ISO_VALUES = [8, 25, 50, 64, 100, 125, 160, 200, 250, 320, 400, 500, 640, 800, 1000, 1600, 3200]


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
