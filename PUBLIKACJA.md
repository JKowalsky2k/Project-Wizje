# Przygotowanie strony Wizje do publikacji

## 1. Zapisz zmiany w panelu

Dodaj kolekcje i zdjęcia w lokalnym panelu. Poczekaj na zakończenie przesyłania i zapisu. Na czas przygotowywania paczki nie edytuj kolekcji.

W edycji zdjęcia sekcja **Własne kadry do formatów** pozwala wgrać oddzielny plik dla każdego formatu wydruku. Przygotuj plik w proporcjach wybranego formatu, z uwzględnieniem orientacji zdjęcia. Podgląd i lupa używają przypisanego kadru; formaty bez przypisania korzystają ze zdjęcia głównego. Możesz zastąpić plik, usunąć przypisanie albo cofnąć zmianę. Pliki źródłowe kadrów pozostają lokalnie w `assets/collections/.print-crops/`; ZIP zawiera wyłącznie wygenerowane podglądy. Po dodaniu lub zmianie kadru przygotuj nową paczkę.

## 2. Przygotuj paczkę w panelu

Panel pokazuje zmiany od ostatniej paczki przygotowanej w panelu: dodane, usunięte i zmienione zdjęcia, kolekcje oraz ceny. Informacja pozostaje po ponownym uruchomieniu.

W lokalnym panelu otwórz sekcję **Publikacja strony** po lewej i kliknij **Przygotuj ZIP**. Poczekaj na komunikat o zakończeniu, potem kliknij **Pobierz ZIP ↓**. Paczka zapisuje się również w `dist/`. Jeżeli zmienisz zdjęcia po jej przygotowaniu, utwórz nową paczkę.

Panel otwiera się lokalnie bez ekranu logowania. Przygotowanie i pobranie wymagają sesji tworzonej automatycznie przy otwarciu panelu. Link pobierania działa tylko w przeglądarce, w której powstała paczka, i wygasa po godzinie lub zakończeniu sesji. Wtedy przygotuj nową paczkę. Panel niczego sam nie wysyła na hosting.

Możesz też uruchomić skrypt w Terminalu:

```sh
cd ~/Documents/Project-Zwidy
python3 tools/publish.py
```

Skrypt przygotuje aktualną listę kolekcji i brakujące podglądy zdjęć. Nie trzeba wcześniej uruchamiać generatora ani serwera podglądu. Przygotowanie nowych podglądów wymaga macOS i Swift (Command Line Tools), tak jak lokalny panel.

W folderze `dist` powstaną:

- folder `wizje-DATA-GODZINA-…` z gotową stroną;
- archiwum ZIP o tej samej nazwie, z `index.html` bezpośrednio w środku.

Każde uruchomienie tworzy nową paczkę. Skrypt wypisuje dokładne ścieżki i rozmiar ZIP. Poprzednie paczki pozostają na dysku.

## 3. Wyślij gotową stronę na hosting

W menedżerze plików hostingu otwórz katalog przypisany do swojej domeny, często nazywany `public_html` lub `www`.

Wyślij **zawartość wygenerowanego folderu**, a nie cały projekt. Możesz też wysłać ZIP i rozpakować go w katalogu strony. Plik `index.html` ma znajdować się bezpośrednio w katalogu strony, obok `styles.css`, skryptów JS i folderu `assets`.

Jeżeli publikujesz aktualizację, nadpisz publiczne pliki strony z nowej paczki. Podglądy zdjęć mają nazwy zależne od zawartości plików, więc nowe wersje nie korzystają ze starej kopii zdjęcia w pamięci przeglądarki. Stare, nieużywane podglądy na hostingu można później usunąć. Przed zastąpieniem istniejącej strony zachowaj jej kopię.

Hosting ma serwować zwykłe pliki statyczne. Na serwerze nie potrzebujesz Pythona ani Swift. Nie uruchamiaj tam lokalnego serwera `tools/collections.py`. Włącz HTTPS dla domeny w ustawieniach hostingu.

## 4. Sprawdź opublikowaną stronę

Otwórz adres domeny i sprawdź zdjęcia, strzałki bębna oraz przełącznik PL/EN. Strona działa również w podkatalogu, ponieważ zasoby mają ścieżki względne.

Panel administratora nadal działa tylko na Twoim komputerze. Po kolejnych zmianach powtórz przygotowanie paczki i wysłanie jej na hosting.

## Co zawiera paczka

Tylko publiczną stronę, używane fonty wraz z licencjami, wspólny styl logo i podglądy zdjęć aktualnych kolekcji. Publiczny manifest zachowuje tytuły i oznaczenia ANALOG/DIGITAL, ale nie zawiera ścieżek do oryginałów.

Paczka pomija panel administratora, ewentualny stary katalog `.local-admin`, repozytorium Git, narzędzia, pliki ustawień panelu, oryginalne zdjęcia i nieużywane podglądy. Skrypt kopiuje wyłącznie dozwolone pliki i odrzuca dowiązania symboliczne. Nie wysyła niczego do internetu.

**Na hosting przekazuj wyłącznie gotową paczkę z `dist`, nigdy cały katalog projektu.** `.gitignore` sam w sobie nie zabezpiecza przed ręcznym wysłaniem prywatnych plików.


## Ochrona przy przypadkowym wysłaniu projektu

Panel nie wymaga hasła. Ewentualne dane wcześniejszego logowania pozostają **poza projektem**, na macOS w `~/Library/Application Support/Wizje/<identyfikator projektu>/password.json`. Dokładną ścieżkę wyświetla terminal po uruchomieniu lokalnego serwera. Dotychczasowy zapis z `.local-admin/password.json` jest przenoszony automatycznie po sprawdzeniu kopii; hasło pozostaje takie samo. Nie kopiuj katalogu danych aplikacji na hosting.

Lokalny serwer odrzuca dostęp do panelu od klientów i adresów nasłuchu innych niż loopback, obce nagłówki Host, żądania cross-site oraz nagłówki przekazywania ruchu przez proxy. Pliki publiczne są serwowane z listy dozwolonych ścieżek; katalogi, oryginały, dane panelu i dowiązania są blokowane. Nie konfiguruj tunelu ani proxy do tego serwera — nadal jest przeznaczony wyłącznie do pracy lokalnej.

W projekcie i nowych paczkach jest `.htaccess` dla **Apache 2.4**. Dopuszcza publiczne pliki strony, podglądy i fonty; blokuje resztę, w tym panel, Git, oryginały, ustawienia i archiwa. Prześlij również ten ukryty plik. Ochrona działa tylko wtedy, gdy hosting obsługuje `.htaccess`, pozwala na wymagane dyrektywy (`AllowOverride`) i ma włączone `mod_rewrite`. Przy błędzie 500 sprawdź te ustawienia z hostingiem. [Dokumentacja kontroli dostępu Apache](https://httpd.apache.org/docs/2.4/howto/access.html).

Dla **Nginx** jest przykład `tools/deployment/nginx.conf.example`, do zastosowania przez administratora w konfiguracji serwera. Nginx nie stosuje reguł `.htaccess`; ustaw katalog domeny na wygenerowany folder i użyj listy dozwolonych ścieżek z przykładu. Przykład dotyczy publikacji w katalogu głównym domeny. [Dokumentacja konfiguracji lokalizacji Nginx](https://nginx.org/en/docs/http/ngx_http_core_module.html#location).

Inne hostingi statyczne mogą ignorować oba pliki konfiguracji. Żaden plik projektu nie zapewnia ochrony na każdym hostingu. Wysyłaj wyłącznie paczkę z panelu. Po publikacji sprawdź, że `/tools/admin/index.html`, `/.git/config` i `/assets/collections/2026/photo-types.json` zwracają 403/404 i nie udostępniają treści plików.

Jeśli cały projekt trafił już do internetu, usuń prywatne pliki z hostingu i wdroż czystą paczkę. Jeżeli wysłana wersja zawierała stary plik hasła w `.local-admin`, zmień to hasło; nowe blokady nie cofają wcześniejszego ujawnienia.


## Usunięcie zdjęcia a paczki publikacji

Odłączenie zdjęcia od kolekcji działa bez pytania o potwierdzenie i zachowuje je w prywatnej bibliotece. Przycisk **Cofnij ostatnią zmianę** przywraca ostatnio odłączone zdjęcie. Nowa paczka zawiera tylko zdjęcia aktualnie przypisane do kolekcji.

Opcja **Usuń trwale** działa od razu po kliknięciu i usuwa także wszystkie wygenerowane lokalne paczki `wizje-*` oraz cache podglądów. Podglądy zachowanych zdjęć są odbudowywane; po zakończeniu przygotuj nowy ZIP. Kopie ZIP pobrane poza `dist`, wcześniejsze pliki na hostingu i backupy nie są automatycznie usuwane. Szczegóły opisuje [instrukcja biblioteki](assets/collections/README.md#biblioteka-zdjęć-i-trwałe-usuwanie).


## SEO dla wizje.eu

Docelowy adres tej wersji to **https://wizje.eu/**. Strona ma adres kanoniczny, opis, metadane podglądu linków i dane strukturalne WebSite/Organization. Domyślna treść pozostaje angielska; przycisk PL zmienia język w przeglądarce. Nie są to osobne adresy językowe, dlatego nie dodajemy fikcyjnych znaczników hreflang.

Każde przygotowanie paczki generuje z aktualnych publicznych kolekcji:

- `gallery.html` — zwykłą galerię HTML z podpisami, zdjęciami i linkami; działa bez JavaScript;
- `sitemap.xml` — mapę strony głównej, galerii i publicznych zdjęć;
- `robots.txt` — zezwolenie na indeksowanie oraz wskazanie mapy strony.

Podgląd linków używa `assets/logo/social.jpg`. Reguły Apache, przykład Nginx i lokalny serwer dopuszczają nowe publiczne pliki. Prywatne pliki nadal są blokowane przez listę dozwolonych ścieżek; robots.txt nie służy do ich zabezpieczania.

Lokalne pliki galerii i mapy można odświeżyć po zmianie manifestu poleceniem `python3 tools/seo.py`. Paczka z panelu robi to automatycznie. Ta konfiguracja SEO zakłada publikację w katalogu głównym wizje.eu; przy zmianie domeny lub podkatalogu trzeba zaktualizować adresy w `index.html` i `SITE_URL` w `tools/seo.py` oraz ponownie wygenerować paczkę.

Po uruchomieniu pełnej strony:

1. Włącz HTTPS oraz przekierowanie wersji HTTP i www na `https://wizje.eu/` w hostingu.
2. Wgraj nową paczkę zamiast placeholdera. Nie blokuj pełnej strony dyrektywą noindex ani hasłem.
3. Sprawdź odpowiedzi 200 dla `/`, `/gallery.html`, `/robots.txt`, `/sitemap.xml` i `/assets/logo/social.jpg`.
4. Zweryfikuj domenę w Google Search Console (rekord DNS z własnego konta), zgłoś `https://wizje.eu/sitemap.xml` i sprawdź stronę narzędziem kontroli adresu URL.

Mapa i metadane ułatwiają wykrycie treści, ale nie gwarantują indeksacji ani pozycji. Przy rozwoju galerii warto dodać indywidualne opisy zdjęć i osobne podstrony kolekcji. Obecne podpisy identyfikują kolekcję, technikę i numer fotografii; nie zgadują zawartości kadru.

## Odświeżanie plików po aktualizacji

Nowe paczki automatycznie nadają wersję adresom CSS, JS i ikon na podstawie plików
wydania. Nie trzeba ręcznie zmieniać `?v=` po edycji strony lub cennika.
Konfiguracja Apache i przykład Nginx rozdzielają pamięć podręczną:

- HTML, skrypty, arkusze CSS i manifest mają `Cache-Control: no-cache, no-transform`.
  Przeglądarka może przechować pliki, ale sprawdza ich aktualność przed ponownym użyciem.
- Zdjęcia z nazwami zależnymi od zawartości mają `public, max-age=31536000, immutable, no-transform`.
  Zmiana zdjęcia lub sposobu generowania daje nowy adres, więc aktualizacja nie wymaga czyszczenia cache.
- Prywatne odpowiedzi panelu nadal mają `no-store`.

Apache i przykład Nginx włączają również kompresję tekstu. Jeżeli hosting lub CDN
nadpisuje te ustawienia, dopasuj jego reguły do powyższego podziału.

Galeria ma miniatury 480, 960 i 1440 px dobierane przez przeglądarkę do szerokości i
gęstości pikseli ekranu. Duży podgląd i lupa zachowują osobne obrazy; oryginały
pozostają bez zmian.

Nazwy podglądów zależą od skrótu zawartości zdjęcia i wersji generatora, więc podmiana
zdjęcia generuje nowe pliki także przy zachowanym rozmiarze pliku i dacie modyfikacji.
Generator pomija w kopiach podglądu wąski, całkowicie biały pasek przy prawej krawędzi
poziomych eksportów (maks. 8 pikseli). Szersze białe obszary i oryginały zachowuje.
