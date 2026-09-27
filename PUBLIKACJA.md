# Przygotowanie strony Wizje do publikacji

## 1. Zapisz zmiany w panelu

Dodaj kolekcje i zdjęcia w lokalnym panelu. Poczekaj na zakończenie przesyłania i zapisu. Na czas przygotowywania paczki nie edytuj kolekcji.

## 2. Przygotuj paczkę w panelu

W lokalnym panelu otwórz sekcję **Publikacja strony** po lewej i kliknij **Przygotuj ZIP**. Poczekaj na komunikat o zakończeniu, potem kliknij **Pobierz ZIP ↓**. Paczka zapisuje się również w `dist/`. Jeżeli zmienisz zdjęcia po jej przygotowaniu, utwórz nową paczkę.

Przygotowanie i pobranie wymagają zalogowania. Link pobierania działa tylko w przeglądarce, w której powstała paczka, i wygasa po godzinie lub zakończeniu sesji. Wtedy przygotuj nową paczkę. Panel niczego sam nie wysyła na hosting.

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

Hasło administratora jest przechowywane **poza projektem**, na macOS w `~/Library/Application Support/Wizje/<identyfikator projektu>/password.json`. Dokładną ścieżkę wyświetla terminal po uruchomieniu lokalnego serwera. Dotychczasowy zapis z `.local-admin/password.json` jest przenoszony automatycznie po sprawdzeniu kopii; hasło pozostaje takie samo. Nie kopiuj katalogu danych aplikacji na hosting.

Lokalny serwer odrzuca dostęp do panelu od klientów i adresów nasłuchu innych niż loopback, obce nagłówki Host, żądania cross-site oraz nagłówki przekazywania ruchu przez proxy. Pliki publiczne są serwowane z listy dozwolonych ścieżek; katalogi, oryginały, dane panelu i dowiązania są blokowane. Nie konfiguruj tunelu ani proxy do tego serwera — nadal jest przeznaczony wyłącznie do pracy lokalnej.

W projekcie i nowych paczkach jest `.htaccess` dla **Apache 2.4**. Dopuszcza publiczne pliki strony, podglądy i fonty; blokuje resztę, w tym panel, Git, oryginały, ustawienia i archiwa. Prześlij również ten ukryty plik. Ochrona działa tylko wtedy, gdy hosting obsługuje `.htaccess`, pozwala na wymagane dyrektywy (`AllowOverride`) i ma włączone `mod_rewrite`. Przy błędzie 500 sprawdź te ustawienia z hostingiem. [Dokumentacja kontroli dostępu Apache](https://httpd.apache.org/docs/2.4/howto/access.html).

Dla **Nginx** jest przykład `tools/deployment/nginx.conf.example`, do zastosowania przez administratora w konfiguracji serwera. Nginx nie stosuje reguł `.htaccess`; ustaw katalog domeny na wygenerowany folder i użyj listy dozwolonych ścieżek z przykładu. Przykład dotyczy publikacji w katalogu głównym domeny. [Dokumentacja konfiguracji lokalizacji Nginx](https://nginx.org/en/docs/http/ngx_http_core_module.html#location).

Inne hostingi statyczne mogą ignorować oba pliki konfiguracji. Żaden plik projektu nie zapewnia ochrony na każdym hostingu. Wysyłaj wyłącznie paczkę z panelu. Po publikacji sprawdź, że `/tools/admin/index.html`, `/.git/config` i `/assets/collections/2026/photo-types.json` zwracają 403/404 i nie udostępniają treści plików.

Jeśli cały projekt trafił już do internetu, usuń prywatne pliki z hostingu i wdroż czystą paczkę. Jeżeli wysłana wersja zawierała stary plik hasła w `.local-admin`, zmień to hasło; nowe blokady nie cofają wcześniejszego ujawnienia.


## Usunięcie zdjęcia a paczki publikacji

Odłączenie zdjęcia od kolekcji zachowuje je w prywatnej bibliotece. Nowa paczka zawiera tylko zdjęcia aktualnie przypisane do kolekcji.

Opcja **Usuń trwale** wymaga osobnego potwierdzenia i usuwa także wszystkie wygenerowane lokalne paczki `wizje-*` oraz cache podglądów. Podglądy zachowanych zdjęć są odbudowywane; po zakończeniu przygotuj nowy ZIP. Kopie ZIP pobrane poza `dist`, wcześniejsze pliki na hostingu i backupy nie są automatycznie usuwane. Szczegóły opisuje [instrukcja biblioteki](assets/collections/README.md#biblioteka-zdjęć-i-trwałe-usuwanie).
