Odszumianie zdjęcia do wydruku 50 × 70 cm
=======================================

Uruchom w katalogu projektu (pierwsze dwie komendy tylko przy instalacji):

```sh
python3 -m venv .venv-denoise
.venv-denoise/bin/python -m pip install -r tools/requirements-denoise.txt
.venv-denoise/bin/python tools/denoise_photo.py
```

Otworzy się natywne okno wyboru zdjęcia na macOS (na innych systemach wymaga
Tkinter). Można też wskazać plik bez okna:

```sh
.venv-denoise/bin/python tools/denoise_photo.py "/ścieżka/DOL001.jpg"
```

Wynik: `DOL001_odszumione_detale.tif` obok oryginału. Skrypt nie nadpisuje plików.
Wybierz oryginał w najwyższej rozdzielczości, nie miniaturę ze strony.
Algorytm Non-local Means redukuje szum jasności i koloru; ustawienia domyślne
są łagodne. Przy mocniejszym szumie porównaj wariant:

```sh
.venv-denoise/bin/python tools/denoise_photo.py "/ścieżka/DOL001.jpg" --luma 5 --color 8 -o "/ścieżka/DOL001_mocniej.tif"
```

Oceń oba warianty przy powiększeniu 100%, zwłaszcza drobne faktury i krawędzie.
Większa siła może usuwać detale. Najlepiej sprawdzić fragment na próbnym wydruku
w docelowej skali. Odszumianie dużego zdjęcia może potrwać kilka minut.

Obsługiwane są pojedyncze zdjęcia RGB i szare 8-bitowe (JPEG, PNG, TIFF), bez
przezroczystości. RAW, TIFF 16-bit i CMYK wymagają wcześniejszego eksportu do
RGB 8-bit; zachowaj oryginalny plik o większej głębi tonalnej.
Wynik jest bezstratnym TIFF/PNG: zachowuje liczbę pikseli po uwzględnieniu
orientacji EXIF, profil ICC oraz istniejące DPI. Inne metadane EXIF są pomijane.

Skrypt podaje przybliżone ppi dla kadru wypełniającego 50 × 70 cm, ale nie
przycina ani nie powiększa obrazu. Samo ustawienie DPI nie dodaje szczegółów.
Odszumianie nie naprawi braku rozdzielczości ani wszystkich artefaktów JPEG.

Zachowanie faktury: domyślne `--detail 0.75` przywraca 75% oryginalnej
jasności, pozostawiając odszumiony kolor. Zachowuje również część szumu.
`--detail 1` zachowuje całą oryginalną jasność, `--detail 0` daje pełne
wygładzanie poprzedniej wersji. Zawsze przetwarzaj oryginał.
