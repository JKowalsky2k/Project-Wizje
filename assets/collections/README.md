# Zdjęcia kolekcji

Wrzuć osobne fotografie do folderów:

- `2026/alps/` — Alpy
- `2026/cars/` — samochody
- `2026/dolomites/` — Dolomity
- `2026/torun/` — Toruń
- `2026/planes/` — samoloty

Nowe foldery w `2026/` są wykrywane jako nowe kolekcje. Puste foldery bez planszy źródłowej są pomijane.

Obsługiwane pliki: JPG, JPEG, PNG, WebP i AVIF. Nazwy określają kolejność, np. `01.jpg`, `02.jpg`, `03.jpg` (sortowanie naturalne: 2 przed 10). Najlepiej pasują pionowe kadry 5:7; inne proporcje są kadrowane centralnie w generowanych podglądach. Pliki źródłowe nie są modyfikowane.

## Podgląd podczas pracy

W katalogu głównym projektu uruchom:

```sh
python3 tools/collections.py --serve
```

Otwórz `http://127.0.0.1:8000`. Po dodaniu lub usunięciu zdjęć odśwież stronę — serwer odczyta foldery ponownie. W razie zajętego portu możesz dodać `--port 8001`.

## Lokalny panel administratora

To samo polecenie `python3 tools/collections.py --serve` uruchamia panel razem ze stroną. Otwórz `/admin` (np. `http://127.0.0.1:8000/admin`). Przy pierwszym wejściu ustaw hasło o długości od 8 do 128 znaków. Następnie możesz logować się tym samym hasłem w każdej przeglądarce na tym komputerze. Hasło pozostaje po restarcie serwera; wtedy trzeba zalogować się ponownie. Sesje przeglądarek są niezależne i wygasają po 12 godzinach.

Skrót hasła z losową solą (PBKDF2-SHA256) jest przechowywany poza katalogiem strony: na macOS w `~/Library/Application Support/Wizje/<identyfikator projektu>/password.json`. Terminal pokazuje dokładną ścieżkę. Stary plik `.local-admin/password.json` jest automatycznie przenoszony, z zachowaniem hasła. Aby zresetować zapomniane hasło, zatrzymaj serwer i usuń plik wskazany w terminalu, następnie uruchom podgląd i ustaw nowe hasło. Nie usuwa to zdjęć ani kolekcji. Przeniesienie projektu do innej lokalizacji na dysku tworzy osobny identyfikator i wymaga ustawienia hasła dla tej lokalizacji.

Panel nasłuchuje wyłącznie na `127.0.0.1`. Jest lokalnym narzędziem do edycji, a nie panelem dostępnym na hostingu statycznym.

W panelu możesz:

- utworzyć kolekcję z własną nazwą;
- dodać kilka zdjęć naraz, również przez przeciągnięcie;
- wybrać przy zdjęciu **ANALOG** albo **DIGITAL**;
- przełączyć język panelu między **PL** i **EN** (wybór jest zapamiętywany w przeglądarce);
- odłączyć zdjęcie od kolekcji i dodać je ponownie z biblioteki bez uploadu;
- usunąć kolekcję z zachowaniem jej zdjęć w bibliotece;
- usunąć zdjęcie trwale z oryginałów, biblioteki i kopii zarządzanych przez aplikację;
- otworzyć podgląd strony w osobnej karcie;
- przygotować i pobrać ZIP do publikacji przyciskiem **Przygotuj ZIP**.

Wybór techniki zapisuje się od razu. Odśwież podgląd strony, aby zobaczyć zmiany. ANALOG otrzymuje złotą etykietę, DIGITAL srebrną. Technika dotyczy wyłącznie zdjęć; kolekcje nie mają domyślnej techniki. Istniejącym zdjęciom nie przypisujemy techniki automatycznie. „Nieoznaczone” oznacza brak etykiety na stronie.

Import przyjmuje zdjęcia do 50 MB i nigdy nie nadpisuje istniejącego pliku. Jeżeli nazwa się powtarza, zmień nazwę nowego zdjęcia. Zapis uruchamia przygotowanie podglądów i aktualizuje manifest. Zmiany są zapisywane lokalnie — publikacja nadal wymaga wysłania aktualnych plików strony na hosting.

Ustawienia techniki znajdują się w `2026/photo-types.json`, a nazwy nowych kolekcji w `2026/collection-info.json`. Nie trzeba edytować tych plików ręcznie. Pliki interfejsu panelu w `tools/admin/` oraz narzędzia Python/Swift nie są częścią publicznej strony i nie są serwowane jako zwykłe zasoby.

## Publikacja jako strona statyczna

Uruchom `python3 tools/publish.py` w katalogu projektu. Skrypt przygotuje folder i ZIP w `dist/`, zawierające tylko publiczną stronę, fonty z licencjami i aktualne podglądy zdjęć. Panel, hasło i oryginały nie trafiają do paczki. Każde uruchomienie tworzy nową wersję.

Pełna instrukcja: [PUBLIKACJA.md](../../PUBLIKACJA.md).

## Zachowanie galerii

Każda kolekcja ma obracający się bęben: zdjęcie na środku i dwa przygaszone, ustawione pod kątem po bokach. Tylko centralne zdjęcie ma ozdobną ramę w odcieniach ciemnego drewna i złota. Strzałki obracają cały zestaw przez 0,5 s; kolejne zdjęcia są ładowane wcześniej, a szybkie kliknięcie podczas animacji zapamiętuje następny krok. Automatyczna zmiana następuje co około 6–7 sekund i zatrzymuje się poza ekranem, w ukrytej karcie, po najechaniu myszą lub przy obsłudze klawiaturą.

Preferencja systemowa ograniczenia ruchu domyślnie wyłącza automatyczne zmiany i obracanie zdjęć. Ręczne przełączanie nadal działa. Dla jednego zdjęcia pokaz pozostaje statyczny.

Jeżeli obok pustego folderu nadal istnieje wcześniejsza plansza PNG o tej samej nazwie, kolekcja może skorzystać z jej trzech kadrów. Są to wyłącznie prostokąty kadrowania w CSS, bez przerabiania oryginałów. Pierwsze własne zdjęcie w folderze zastępuje ten zestaw startowy. Po dodaniu osobnych zdjęć plansze PNG nie są potrzebne.

Tytuły kolekcji są prawdziwym tekstem HTML z mieszanką fontów użytych w logo; obsługują przełącznik EN/PL. Logika animacji: `collections.js`; wygląd: `styles.css`; generowanie listy plików: `tools/collections.py`.

Fotografie są pojedynczymi elementami `img`, bez dzielenia na klapki i bez linii przez środek. Bęben korzysta z gotowych, wygładzonych podglądów także podczas animacji; przed przejściem kod czeka na wczytanie i zdekodowanie kolejnego pliku.

## Pomniejszanie zdjęć

Generator przygotowuje podglądy 480 × 672 px (dwukrotna rozdzielczość maksymalnego okienka galerii). Używa wysokiej jakości interpolacji, aby ograniczyć aliasing drobnego ziarna podczas dużego pomniejszenia. Kadrowanie 5:7 jest centralne i uwzględnia orientację EXIF; kolor jest zapisywany w sRGB, JPEG z jakością 90%. Nie dodaje rozmycia CSS ani odszumiania. Oryginały pozostają bez zmian.

Nowe pliki powstają w `assets/collections/previews/`. Zmiana oryginału lub algorytmu tworzy nową nazwę podglądu, co omija stare kopie w pamięci przeglądarki. Kolejne odświeżenia korzystają z istniejących podglądów. `original` w manifeście wskazuje plik źródłowy, a `src` gotowy podgląd.

Przygotowanie nowych podglądów używa systemowych bibliotek macOS przez Swift (Command Line Tools). Opublikowana strona pozostaje statyczna i działa niezależnie od systemu. Pomocnicze pliki: `tools/photo_previews.py` i `tools/photo_previews.swift`.


## Biblioteka zdjęć i trwałe usuwanie

**Odłącz od kolekcji** usuwa zdjęcie tylko z danej kolekcji. Oryginał pozostaje w bibliotece zdjęć, widocznej pod edytorem kolekcji. Wybierz docelową kolekcję w bocznej liście, a następnie kliknij **Dodaj do kolekcji** przy zdjęciu w bibliotece. Plik wraca do kolekcji bez ponownego przesyłania, wraz z przypisaną techniką. Jeśli w docelowej kolekcji istnieje już plik o tej nazwie, panel odmawia nadpisania go.

**Usuń kolekcję** usuwa folder kolekcji i jej ustawienia; zachowane zdjęcia trafiają do biblioteki. Wcześniejsze zdjęcia zachowane w lokalnym koszu są też dostępne w bibliotece. Biblioteka przechowuje odłączone pliki poza projektem, w folderze `trash` obok lokalnego pliku hasła. Oryginały są wyświetlane przez chroniony endpoint wymagający sesji, z nagłówkiem `Cache-Control: no-store`. Biblioteka nie trafia do paczki publikacji.

**Usuń trwale** jest dostępne przy zdjęciu w kolekcji oraz w bibliotece. Wymaga wpisania dokładnej nazwy pliku. Usuwa wskazany oryginał i kopie identyczne bajt po bajcie ze wszystkich kolekcji oraz biblioteki/kosza aplikacji. Nie można tego cofnąć w panelu.

Potwierdzenie informuje także o usunięciu **wszystkich wygenerowanych podglądów i lokalnych paczek publikacji** w `dist` (folderów `wizje-DATA-GODZINA-…`, ich ZIP-ów i pozostałości roboczych `.publish-*`). Jest to konieczne, ponieważ stare nazwy podglądów nie zawsze pozwalają przypisać je do oryginału. Podglądy pozostałych zdjęć są następnie odbudowywane. Ręcznie umieszczone, inaczej nazwane pliki w `dist` nie są usuwane.

Jeśli czyszczenie zostanie przerwane, panel zwróci błąd i ponowi je przy odświeżeniu lub restarcie. Dziennik `pending-photo-purge.json` poza projektem zawiera wyłącznie ścieżki do doczyszczenia, bez kopii zdjęcia. Nie wykonuj ręcznego eksportu ani zmian plików podczas tej operacji.

Zakres usuwania obejmuje pliki zarządzane przez tę lokalną aplikację. Kopie pobrane do Pobranych, wysłane wcześniej na hosting, backupy systemowe, pliki poza jej katalogami oraz wcześniej pobrane dane przeglądarki są poza tym zakresem. Aplikacja usuwa pliki, ale nie gwarantuje fizycznego wymazania danych z nośnika ani migawek dysku. Przy usuwaniu opublikowanego zdjęcia trzeba również usunąć stare pliki na hostingu i uwzględnić jego cache/CDN.


## Wybór roku na stronie głównej

Nad nagłówkiem kolekcji znajduje się pionowa rolka roku. Sterowanie odbywa się przyciskiem ↑ po lewej (nowszy rok) i ↓ po prawej (starszy rok). Przyciski obsługują też klawiaturę przez Tab i Enter/Spację. Lata nie są klikalne; przewijanie strony nie zmienia roku. Lista zawiera lata z niepustymi kolekcjami; domyślnie wybierany jest najnowszy z opublikowanymi zdjęciami.

Generator i eksport odczytują foldery lat `assets/collections/2026/`, `assets/collections/2027/` itd. Każdy rok ma własne foldery kolekcji oraz opcjonalne `photo-types.json` i `collection-info.json`. Przykładowo zdjęcia w `assets/collections/2027/wakacje/` dodadzą rok 2027 po odświeżeniu podglądu lub przygotowaniu nowego ZIP-a. Puste foldery lat nie tworzą opcji na rolce. Panel obsługuje wszystkie lata. Przy tworzeniu kolekcji wpisz rok w polu „Rok”; folder roku i kolekcji powstanie automatycznie. Rok pojawi się na stronie po dodaniu pierwszego zdjęcia. Nazwy kolekcji mogą powtarzać się w różnych latach.


## Film i ISO zdjęć analogowych

Po wybraniu ANALOG w panelu pojawiają się przyciski wyboru filmu i ISO filmu. Wybierz pełną nazwę filmu z listy pogrupowanej według marek, np. „Fujifilm 400”. ISO wybiera się z osobnej listy. Wybrany film ma kolorowy tekst i ramkę na ciemnym tle. Symbol ⊘ oznacza brak przypisania. Ustawienia przy przesyłaniu dotyczą wszystkich dodawanych w tej partii zdjęć; później można je zmienić osobno na karcie zdjęcia. Pola są opcjonalne, a opcja ⊘ usuwa przypisanie. ISO oznacza czułość przypisaną do filmu; panel nie odczytuje jej z EXIF skanu i nie ustawia automatycznie po wyborze filmu.

Katalog obejmuje Kodak Gold, ColorPlus, UltraMax, Portra, Ektar, Tri-X i T-Max; Fujicolor C200, Fujifilm 400, Superia X-TRA; Ilford HP5 Plus, FP4 Plus i Delta. Kolory przycisków nawiązują do marek. Opcje ISO: 25, 50, 64, 100, 125, 160, 200, 250, 320, 400, 500, 640, 800, 1000, 1600 i 3200.

Metadane są zapisywane w `filmDetails` w pliku `photo-types.json` danego roku. Pozostają ze zdjęciem w bibliotece, trafiają do manifestu i paczki publikacji, a na stronie pojawiają się obok ANALOG. Zmiana techniki na DIGITAL usuwa przypisany film i ISO. Katalog oraz dozwolone ISO znajdują się w `tools/film_catalog.py`.


## Globus na stronie głównej

Między sloganem a rokiem znajduje się fragment globusa z konturami państw, bez podpisów pod mapą. Punkty pochodzą z lokalizacji zapisanych przy niepustych kolekcjach z roku wybranego na rolce. Zmiana roku od razu przełącza punkty globusa; rok bez lokalizacji pokazuje same kontury, bez punktów z innych lat. Przy otwarciu strony globus i kolekcje wybierają ten sam najnowszy dostępny rok; identyczne współrzędne łączą się w jeden punkt. Kliknięcie punktu lub wybranie go klawiszem Tab i Enter/Spacją ustawia widok i pokazuje nazwę.

W panelu otwórz kolekcję i sekcję **Lokalizacja kolekcji**. Możesz wybrać Toruń, Wrocław, Alpy Francuskie lub Dolomity albo podać nazwę PL, opcjonalną nazwę EN oraz szerokość i długość geograficzną. Kliknij **Dodaj lokalizację**, aby dopisać miejsce do listy. Każda kolekcja może mieć wiele miejsc. Ikona ołówka edytuje wskazane miejsce, a kosz usuwa tylko ten wpis. Identyczne współrzędne są łączone, aby nie tworzyć podwójnych punktów. Po zmianie odśwież stronę; przed publikacją przygotuj nowy ZIP. Współrzędne zaokrąglamy do dwóch miejsc po przecinku. Nie odczytujemy GPS z EXIF.

Lokalizacja jest zapisywana w `collection-info.json` danego roku, przy nazwie kolekcji w tablicy `locations` (każdy wpis: `name`, opcjonalnie `nameEn`, `lat`, `lon`). Eksport zachowuje wszystkie miejsca. Starsze pojedyncze pole `location` jest nadal odczytywane i po zapisie automatycznie zamieniane na listę. Startowe przypisania: Toruń → Toruń, Samochody → Wrocław, Alpy → Alpy Francuskie, Dolomity → włoskie Dolomity.

Kontury: Natural Earth, skala 1:110m, domena publiczna. Źródło: https://github.com/nvkelso/natural-earth-vector/blob/master/geojson/ne_110m_admin_0_countries.geojson . Dane są osadzone w `globe.js`; strona nie wysyła zapytań do usług mapowych. Eksport i konfiguracje dostępu do publicznych plików uwzględniają globus.

Nazwy punktów i lista lokalizacji w panelu zmieniają się wraz z językiem PL/EN. Presety Alp i Dolomitów mają gotowe tłumaczenia. Dla własnych miejsc wpisz nazwę EN; gdy jej nie ma, używana jest nazwa PL.


## Większy podgląd zdjęcia

Kliknięcie widocznego zdjęcia lub Enter/Spacja po wybraniu go klawiszem Tab otwiera okno szczegółów. Pokazuje pionowy kadr 5:7 (centralne przycięcie jak na stronie głównej), a po prawej nazwę kolekcji w jej typografii, rok, rozdzielczość oryginału w pikselach oraz technikę i — dla analogu — zapisany film i ISO. Nieznane dane są oznaczone jako niepodane. Nie wyliczamy rozmiaru wydruku w centymetrach.

Można włączać i wyłączać ramę, dodawać i usuwać passe-partout oraz wybierać jego czarny lub biały kolor. Ustawienia dotyczą wyłącznie podglądu. ESC, krzyżyk lub kliknięcie poza oknem zamyka podgląd. Automatyczna zmiana zdjęć jest w tym czasie wstrzymana.

Generator przygotowuje oprócz miniatur 480×672 podglądy `*-2000.jpg` o dłuższym boku maks. 2000 px, z zachowaniem proporcji, bez powiększania małych plików. `*-info.json` jest lokalną pamięcią wymiarów i nie trafia do eksportu. Publiczny manifest zawiera ścieżkę `detail` oraz `sourceWidth`, `sourceHeight`, `detailWidth`, `detailHeight`. Paczka publikacji zawiera większe podglądy, ale nie oryginały ani ich metadane GPS.

Sekcja zamówień w podglądzie zawiera przykładowy profil `@twoj_profil`, wyraźnie oznaczony jako przykładowy. Przycisk i lokalnie osadzony kod QR prowadzą obecnie do `https://www.instagram.com/`, a nie do konta innej osoby. Po utworzeniu profilu należy zmienić `username`, `url` i `qr` razem w obiekcie `instagramProfile` w `collections.js`, ustawić `example: false` i przygotować nową paczkę publikacji. Kod QR musi być wygenerowany dla tego samego adresu co link. Sekcja ma tłumaczenia PL/EN.

Orientację wybiera się w panelu przy dodawaniu oraz osobno pod każdym zdjęciem. Domyślnie wszystkie zdjęcia mają pionowy kadr 5:7, również dotychczasowe fotografie. Dopiero wybranie „Pozioma” zachowuje pełny kadr oryginału i dopasowuje ramę. Wybór zapisuje się w mapie `orientations` w `photo-types.json` oraz zachowuje po odłączeniu i ponownym dodaniu zdjęcia.

## Filtry kolekcji

Pod nagłówkiem kolekcji dostępne są filtry kolekcji, orientacji i kolorystyki. Łączą się ze sobą w wybranym roku. Zmiana roku resetuje wybór kolekcji; orientacja i kolorystyka pozostają wybrane. Filtry nie zmieniają zdjęć ani lokalizacji globusa (globus nadal pokazuje cały wybrany rok).

Kolorystykę („Kolorowe” / „Czarno-białe”) ustawia się przy przesyłaniu i osobno pod zdjęciem w panelu. Nowe zdjęcia domyślnie mają wybrane „Kolorowe”. Dotychczasowe bez oznaczenia są widoczne tylko przy filtrze „Wszystkie”, dopóki nie ustawisz kolorystyki. Nie stosujemy automatycznego odbarwiania. Metadane `colorModes` w `photo-types.json` zachowują się po przeniesieniu do biblioteki i przywróceniu; publiczny manifest eksportuje `colorMode`.
