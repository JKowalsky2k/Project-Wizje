#!/usr/bin/env python3
"""Odszumianie zdjęć RGB 8 bitów bez zmiany rozdzielczości i profilu ICC."""
import argparse
import math
from pathlib import Path
import subprocess
import sys


def strength(value):
    number = float(value)
    if not math.isfinite(number) or not 0 < number <= 30:
        raise argparse.ArgumentTypeError('Podaj liczbę większą od 0 i nie większą niż 30.')
    return number


def choose_photo():
    if sys.platform == 'darwin':
        selected = subprocess.run(
            ['osascript', '-e',
             'POSIX path of (choose file with prompt "Wybierz oryginalne zdjęcie do odszumienia")'],
            capture_output=True, text=True,
        )
        if selected.returncode:
            if '(-128)' in selected.stderr:
                return ''
            raise RuntimeError(selected.stderr.strip() or 'Nie udało się otworzyć okna wyboru.')
        return selected.stdout.rstrip('\n')
    import tkinter as tk
    from tkinter import filedialog
    root = tk.Tk()
    root.withdraw()
    try:
        return filedialog.askopenfilename(
            title='Wybierz oryginalne zdjęcie do odszumienia',
            filetypes=[('Zdjęcia', '*.jpg *.jpeg *.png *.tif *.tiff'), ('Wszystkie pliki', '*')],
        )
    finally:
        root.destroy()


def detail_fraction(value):
    number = float(value)
    if not math.isfinite(number) or not 0 <= number <= 1:
        raise argparse.ArgumentTypeError('Podaj liczbę od 0 do 1.')
    return number


def denoise(source, output, luminance, color, detail=0.75):
    import cv2
    import numpy as np
    from PIL import Image, ImageOps

    if source.resolve() == output.resolve():
        raise ValueError('Plik wynikowy musi być inny niż oryginał.')
    if output.exists():
        raise ValueError(f'Plik już istnieje: {output}. Wybierz inną nazwę przez --output.')
    formats = {'.tif': 'TIFF', '.tiff': 'TIFF', '.png': 'PNG'}
    fmt = formats.get(output.suffix.lower())
    if not fmt:
        raise ValueError('Wynik zapisz jako .tif, .tiff lub .png (bezstratnie).')

    # Sprawdź również dekoderem OpenCV: Pillow może odczytać TIFF RGB 16-bit jako RGB 8-bit.
    decoded = cv2.imdecode(np.frombuffer(source.read_bytes(), dtype=np.uint8), cv2.IMREAD_UNCHANGED)
    if decoded is None or decoded.dtype != np.uint8:
        raise ValueError('Obsługiwane są zdjęcia 8-bitowe. RAW/16-bit wyeksportuj najpierw do RGB 8-bit z profilem ICC.')
    del decoded
    with Image.open(source) as original:
        if original.mode not in ('RGB', 'L') or getattr(original, 'n_frames', 1) != 1:
            raise ValueError('Wybierz pojedyncze zdjęcie RGB lub szare, 8-bitowe, bez przezroczystości.')
        icc = original.info.get('icc_profile')
        dpi = original.info.get('dpi')
        oriented = ImageOps.exif_transpose(original)
        pixels = np.asarray(oriented)
        print(f'Odszumianie {oriented.width} × {oriented.height} px…', flush=True)
        if oriented.mode == 'L':
            cleaned = cv2.fastNlMeansDenoising(pixels, None, luminance, 7, 21)
            cleaned = cv2.addWeighted(pixels, detail, cleaned, 1 - detail, 0)
        else:
            bgr = cv2.cvtColor(pixels, cv2.COLOR_RGB2BGR)
            cleaned = cv2.fastNlMeansDenoisingColored(bgr, None, luminance, color, 7, 21)
            cleaned = cv2.cvtColor(cleaned, cv2.COLOR_BGR2RGB)
            # Zachowaj część oryginalnej jasności (faktury i ziarna),
            # pozostawiając odszumione kanały koloru. Float ogranicza zaokrąglenia.
            source_ycc = cv2.cvtColor(pixels.astype(np.float32) / 255, cv2.COLOR_RGB2YCrCb)
            clean_ycc = cv2.cvtColor(cleaned.astype(np.float32) / 255, cv2.COLOR_RGB2YCrCb)
            clean_ycc[:, :, 0] = (detail * source_ycc[:, :, 0]
                                  + (1 - detail) * clean_ycc[:, :, 0])
            cleaned = np.rint(np.clip(cv2.cvtColor(clean_ycc, cv2.COLOR_YCrCb2RGB), 0, 1) * 255).astype(np.uint8)
        result = Image.fromarray(cleaned)
        options = {}
        if icc:
            options['icc_profile'] = icc
        if dpi:
            options['dpi'] = dpi
        if fmt == 'TIFF':
            options['compression'] = 'tiff_lzw'
        # Tryb xb chroni istniejące pliki, również przy równoczesnym uruchomieniu.
        with output.open('xb') as target:
            try:
                result.save(target, format=fmt, **options)
            except BaseException:
                output.unlink(missing_ok=True)
                raise
        short, long = sorted(result.size)
        ppi = min(short / (50 / 2.54), long / (70 / 2.54))
        print(f'Zapisano: {output}')
        print(f'50 × 70 cm: około {ppi:.0f} ppi przy wypełnieniu kadru (może wymagać przycięcia).')
        print('300 ppi w tym formacie to około 5906 × 8268 px. Skrypt nie skaluje ani nie kadruje zdjęcia.')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('photo', nargs='?', type=Path, help='Zdjęcie; bez argumentu otwiera okno wyboru.')
    parser.add_argument('-o', '--output', type=Path, help='Wynik TIFF/PNG; domyślnie obok zdjęcia: *_odszumione_detale.tif.')
    parser.add_argument('--luma', type=strength, default=3.0, help='Siła redukcji szumu jasności: 0–30, domyślnie 3.')
    parser.add_argument('--color', type=strength, default=5.0, help='Siła redukcji szumu koloru: 0–30, domyślnie 5.')
    parser.add_argument('--detail', type=detail_fraction, default=0.75,
                        help='Udział oryginalnej jasności: 0–1; domyślnie 0.75. Więcej zachowuje fakturę i ziarno.')
    args = parser.parse_args()
    try:
        source = args.photo
        if source is None:
            selected = choose_photo()
            if not selected:
                print('Anulowano wybór zdjęcia.')
                return 0
            source = Path(selected)
        source = source.expanduser()
        output = args.output.expanduser() if args.output else source.with_name(source.stem + '_odszumione_detale.tif')
        denoise(source, output, args.luma, args.color, args.detail)
    except ImportError as exc:
        print(f'Brak biblioteki: {exc}. Zainstaluj: pip install -r tools/requirements-denoise.txt', file=sys.stderr)
        return 1
    except Exception as exc:
        print(f'Błąd: {exc}', file=sys.stderr)
        return 1
    return 0


if __name__ == '__main__':
    sys.exit(main())
