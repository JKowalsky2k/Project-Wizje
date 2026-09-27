# Czcionki logotypu Wizje

Aktualna nazwa: **Wizje**. Logo składa się z liter w / i / z / j / e, kolejno w fontach Knewave / Lemon Tuesday / Bungee Shade / Georgia Italic / Berkshire Swash. Litera j używa teraz smuklejszej kursywy Georgia w rozmiarze 1em zamiast Anton 1.2em; Georgia jest pobierana z systemu, z fallbackiem serif. Zachowano przesunięcia pionowe. Bazowy odstęp między literami wynosi 6 px. Przed j dodano 6 px, a za j odjęto 3 px: odstęp z–j wynosi 12 px, a j–e 3 px (między polami znaków). Nazwy klas CSS oznaczają historyczne pozycje stylów.

Poniższa analiza opisuje dobór fontów do wcześniejszej nazwy Zwidy i historycznej grafiki `Logotyp.png`.

Analiza: 2026-09-26. Punkt odniesienia: `assets/logo/Logotyp.png` oraz litery w `index.html`. Dobór dotyczy pięciu konkretnych glifów, a nie zgodności całych rodzin. Podgląd: `../../font-preview.html`.

## Wnioski z kodu

Strona jest statyczna: `index.html`, `styles.css`, `script.js`. Logo jest tekstem z pięcioma osobnymi elementami `.logo-letter--…`, więc każda litera może mieć własny font. Skrypt obsługuje tłumaczenia, nie zmienia liter logotypu.

- Przypisania przed zmianą: z → Permanent Marker, w → Lemon Tuesday, i → Bungee Shade, d → Righteous, y → Rye.
- Oi ma deklarację `@font-face`, ale nie jest używany przez żaden selektor.
- Bungee Shade miał wagę 700 przy deklaracji fontu 400. Po wdrożeniu wszystkie litery mają wagę 400 i `font-synthesis: none`, aby uniknąć sztucznego pogrubiania.
- Righteous ma znacznie lżejsze, geometryczne d niż wzorzec; Rye ma westernowe zdobienia odmienne od Barbra.
- Fonty są serwowane lokalnie. Nie trzeba dodawać zewnętrznego API ani skryptu.
- Przesunięcia poszczególnych liter w CSS są częścią kompozycji. Sama zmiana nazw rodzin nie odtworzy proporcji oryginału.

## Rekomendowane bezpłatne kandydatury

| Litera | Wzorzec | Kandydat | Dopasowanie i ograniczenia |
| --- | --- | --- | --- |
| z | Six Hands Black | Knewave | Ciężki, pochylony, pędzlowy znak. Bardziej zaokrąglony niż wzorzec. Permanent Marker pozostaje alternatywą o lżejszym, markerowym rysunku. |
| w | Lemon Tuesday | Lemon Tuesday | Oryginał, bez potrzeby zamiennika. Istniejący plik jest identyczny bajtowo z paczką autora. |
| i | Rig Solid Medium Fill | Bungee Shade | Dostępny już w projekcie; podobny efekt przestrzenny, ale inna konstrukcja, szeryfy i kierunek cienia. Najsłabsze dopasowanie konstrukcji w tym zestawie. |
| d | Cayento | Anton | Ciężki, wąski pionowy znak z niewielkim światłem, bliższy wzorcowi niż Righteous. Nie kopiuje detali Cayento. |
| y | Barbra | Spicy Rice | Ciężki ozdobny charakter retro. Inny ogonek i kontrast niż w Barbra; przybliżenie stylistyczne. |
| y — alternatywa | Barbra | Berkshire Swash | Bardziej kaligraficzny kierunek, lżejszy rysunek. Do porównania, nie odpowiednik 1:1. |

Nie znaleziono wiernych, darmowych odpowiedników Rig Solid Medium Fill i Barbra w sprawdzonym zestawie. Gdy priorytetem jest identyczność logotypu, właściwym kierunkiem jest licencjonowany eksport oryginalnego projektu jako grafika albo odpowiednie licencje na oryginalne webfonty.

## Licencje i pochodzenie

Dostępność fontu w Canva Free nie oznacza prawa do pobrania jego pliku i osadzenia na niezależnej stronie. Użycie wyeksportowanego projektu i rozpowszechnianie oprogramowania fontu to różne zastosowania. Źródła: [Canva — wyjaśnienie licencji](https://www.canva.com/licensing-explained/) i [Content License Agreement](https://www.canva.com/en_in/policies/content-license-agreement/).

Nowe pliki pobrano bez modyfikowania z oficjalnego repozytorium Google Fonts. Każdy ma dołączoną licencję SIL OFL 1.1, pozwalającą m.in. na używanie komercyjne i osadzanie fontów. Zachowaj pliki licencji oraz informacje o autorach przy dystrybucji; nie sprzedawaj samych fontów. Licencja OFL nie narzuca tej samej licencji grafikom i dokumentom utworzonym za pomocą fontu.

| Plik | Źródło | Licencja w projekcie |
| --- | --- | --- |
| knewave.ttf | [Google Fonts / Knewave](https://github.com/google/fonts/tree/main/ofl/knewave) | knewave-OFL.txt |
| anton.ttf | [Google Fonts / Anton](https://github.com/google/fonts/tree/main/ofl/anton) | anton-OFL.txt |
| spicy-rice.ttf | [Google Fonts / Spicy Rice](https://github.com/google/fonts/tree/main/ofl/spicyrice) | spicy-rice-OFL.txt |
| berkshire-swash.ttf | [Google Fonts / Berkshire Swash](https://github.com/google/fonts/tree/main/ofl/berkshireswash) | berkshire-swash-OFL.txt |
| lemon-tuesday.otf — istniejący plik | [Strona autora na DaFont](https://www.dafont.com/lemon-tuesday.font), [paczka](https://dl.dafont.com/dl/?f=lemon_tuesday) | lemon-tuesday-OFL.txt, dokładna kopia FREE FONT LICENSE.txt z paczki |

Lemon Tuesday: Copyright (c) 2016 by Daria Kwon & Jovanny Lemonad. All rights reserved. Informacja pochodzi z metadanych niezmienionego pliku OTF. Plik licencji z paczki autora potwierdza SIL OFL 1.1.

Istniejące Bungee Shade, Righteous, Rye i Oi mają pliki OFL, Permanent Marker ma plik Apache 2.0. Nie pobierano ich ponownie ani nie odtwarzano historii ich pochodzenia.

Źródła dla oryginalnych rodzin komercyjnych:

- [Six Hands — ParaType / Adobe Fonts](https://fonts.adobe.com/fonts/six-hands): korzystanie przez Adobe i samodzielne hostowanie to różne sposoby licencjonowania.
- [Rig Solid — Jamie Clarke Type](https://store.jamieclarketype.com/fonts/rig-solid).
- [Cayento — strona autora](https://www.mansgreback.com/product/cayento); [informacja autora na DaFont](https://www.dafont.com/cayento.font): darmowa wersja tylko do użytku osobistego.
- [Barbra — Nurrontype / MyFonts](https://www.myfonts.com/collections/barbra-font-nurrontype/).

## Zakres zmian i weryfikacja

Dodano cztery fonty TTF z licencjami, brakującą licencję Lemon Tuesday i osobny podgląd. Na prośbę użytkownika zastosowano zestaw Knewave / Lemon Tuesday / Bungee Shade / Anton / Berkshire Swash w `styles.css`, z rozmiarami d = 1.2em i y = 1.2em zgodnymi z podglądem. TTF nadaje się do podglądu i osadzania; po ostatecznym wyborze można rozważyć przygotowanie WOFF2 zgodnie z warunkami licencji.

Sprawdzono struktury pobranych fontów i nazwy rodzin, zgodność Lemon Tuesday z paczką autora oraz lokalne ścieżki podglądu. Obejrzano render znaków nowych fontów oraz oryginalny logotyp. Podgląd HTML nie został sprawdzony w przeglądarce w tej sesji.

## SHA-256 pobranych fontów oraz Lemon Tuesday

- `knewave.ttf`: `ed3bac761d755b89ab3082c844d4a623d63c7d6eef85d22ba1fb6c680e6a4436`
- `anton.ttf`: `a4ba3a92350ebb031da0cb47630ac49eb265082ca1bc0450442f4a83ab947cab`
- `spicy-rice.ttf`: `f339f9b0b3d585974ec22a374d7e0938b429c229dc0f3b3b16f34c650ab08068`
- `berkshire-swash.ttf`: `f0c80837dc6f32b89b10894a7e39295db4a00ab697cada682a3f5942c342fe00`
- `lemon-tuesday.otf`: `4fd3570c3399cc5a68eaf9cec9733cfbe27dec52632ef8a7b1b3411002f33ef7`

Na prośbę użytkownika zastąpiono Spicy Rice smuklejszym Berkshire Swash dla większego kontrastu litery y z ciężkimi z i d. Zachowano rozmiar 1.2em i przesunięcie pionowe 5px.
