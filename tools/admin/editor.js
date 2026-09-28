(() => {
  if (location.protocol !== 'http:' || !['127.0.0.1', 'localhost'].includes(location.hostname)) {
    document.body.textContent = 'Panel działa tylko lokalnie. / This admin panel only works locally.';
    return;
  }

  const $ = selector => document.querySelector(selector);
  const text = {
    pl: {
      libraryTitle: 'Biblioteka zdjęć', libraryHint: 'Zdjęcia odłączone od kolekcji. Możesz dodać je ponownie bez przesyłania pliku.', libraryEmpty: 'Nie ma zdjęć odłączonych od kolekcji.', libraryTarget: 'Dodawanie do kolekcji: {collection}', libraryChoose: 'Wybierz lub utwórz kolekcję, aby dodać do niej zdjęcia z biblioteki.', libraryAdd: 'Dodaj do kolekcji', libraryAdded: 'Dodano „{name}” z biblioteki. Odśwież podgląd strony.',
      purgePhoto: 'Usuń trwale', purgePhotoLabel: 'Usuń trwale zdjęcie {name}', purging: 'Trwałe usuwanie pliku i kopii aplikacji…', purged: 'Zdjęcie usunięte trwale z plików aplikacji. Podglądy pozostałych zdjęć zostały odbudowane. Przygotuj nową paczkę do publikacji.', wrongConfirmation: 'Nazwa pliku nie jest zgodna. Niczego nie usunięto.',
      confirmPurge: 'TRWAŁE USUNIĘCIE: {name}\n\nUsunie oryginał i identyczne kopie ze wszystkich kolekcji oraz biblioteki/kosza. Wyczyści też WSZYSTKIE lokalne podglądy i paczki publikacji (foldery i ZIP-y); podglądy pozostałych zdjęć zostaną odbudowane.\n\nNie usuwa plików wysłanych wcześniej na hosting, pobranych kopii ani backupów systemowych. Operacji nie można cofnąć w panelu.\n\nAby potwierdzić, wpisz dokładną nazwę pliku:',
      deletePhoto: 'Odłącz od kolekcji', deletePhotoLabel: 'Odłącz zdjęcie {name} od kolekcji', deleteCollection: 'Usuń kolekcję',
      confirmDeletePhoto: 'Odłączyć zdjęcie „{name}” od kolekcji „{collection}”? Zostanie w bibliotece, gotowe do ponownego dodania.',
      confirmDeleteCollection: 'Usunąć kolekcję „{collection}”? Jej zdjęcia ({count}) pozostaną w bibliotece.',
      photoDeleted: 'Odłączono zdjęcie „{name}”. Plik jest w bibliotece. Odśwież podgląd strony. Przed publikacją przygotuj nowy ZIP.',
      collectionDeleted: 'Usunięto kolekcję „{collection}”. Odśwież podgląd strony. Przed publikacją przygotuj nowy ZIP.',
      exportTitle: 'Publikacja strony', exportHint: 'Przygotuj paczkę na hosting. Zawiera wyłącznie publiczną stronę i zdjęcia do wyświetlania.', exportButton: 'Przygotuj ZIP', exportDownload: 'Pobierz ZIP ↓', exporting: 'Przygotowywanie paczki do publikacji…', exported: 'Paczka gotowa: {collections} kolekcji, {photos} zdjęć. Pobierz ZIP z sekcji publikacji.',
      title: 'Wizje — pracownia', workshop: 'pracowania', brandLabel: 'Wizje — pracowania', languageLabel: 'Język panelu', preview: 'Podgląd strony ↗', logout: 'Wyloguj',
      yourCollections: 'TWOJE KOLEKCJE', chooseCollection: 'Wybierz kolekcję', newCollection: 'Nowa kolekcja', name: 'Nazwa', year: 'Rok',
      addLocation: 'Dodaj lokalizację', editLocation: 'Edytuj lokalizację', cancelLocation: 'Anuluj edycję', locationTitle: 'Lokalizacje kolekcji', locationHint: 'Dodawaj miejsca do kolekcji. Każde pojawi się jako punkt na globusie.', locationPlace: 'Miejsce', locationName: 'Nazwa PL', locationNameEn: 'Nazwa EN (opcjonalnie)', latitude: 'Szerokość geograficzna', longitude: 'Długość geograficzna', saveLocation: 'Zapisz lokalizację', clearLocation: 'Usuń lokalizację', customLocation: 'Własna lokalizacja', locationSaved: 'Zapisano lokalizację. Odśwież stronę główną.', locationCleared: 'Usunięto lokalizację z globusa.', frenchAlps: 'Alpy Francuskie', italianDolomites: 'Dolomity · Włochy',
      brand: 'Marka', series: 'Seria', chooseBrand: 'Wybierz markę', chooseSeries: 'Wybierz serię', film: 'Film', chooseFilm: 'Wybierz film', filmIso: 'ISO filmu', chooseIso: 'Wybierz ISO', noFilm: 'Nieoznaczony', noIso: 'Nieoznaczone', filmSaved: 'Zapisano film i ISO. Odśwież podgląd strony.',
      yearUp: 'Następny rok', yearDown: 'Poprzedni rok',
      namePlaceholder: 'np. Wieczory nad morzem', createCollection: 'Utwórz kolekcję', welcomeTitle: 'Twoje zdjęcia, Twoje kolekcje.',
      welcomeCopy: 'Utwórz pierwszą kolekcję, aby dodać zdjęcia.', editingCollection: 'EDYCJA KOLEKCJI',
      dropPhotos: 'Przeciągnij zdjęcia lub wybierz pliki', fileHint: 'JPG, PNG, WebP, AVIF · do 50 MB na zdjęcie',
      cropHint: 'Przygotowane kadry 5:7 zachowają kompozycję. Inne proporcje zostaną przycięte centralnie.',
      uploadMedium: 'Technika dodawanych zdjęć', chooseMedium: 'Wybierz technikę', uploadPhotos: 'Dodaj zdjęcia', photos: 'Zdjęcia',
      autoSave: 'Zmiany techniki zapisują się automatycznie.', emptyCollection: 'Ta kolekcja czeka na pierwsze zdjęcie. Po dodaniu pojawi się na stronie.',
      unassigned: 'Nieoznaczone', needsMedium: 'Technika do ustawienia', medium: 'Technika', photoMedium: 'Technika zdjęcia {name}',
      photoCount: 'Zdjęcia w kolekcji: {count}', saving: 'Zapisywanie…', loading: 'Wczytywanie kolekcji…',
      ready: 'Gotowe. Wybierz kolekcję lub utwórz nową.', saved: 'Zapisano technikę: {name}. Odśwież podgląd strony, aby zobaczyć zmianę.',
      created: 'Kolekcja gotowa. Dodaj pierwsze zdjęcia.', uploading: 'Dodawanie {index} z {total}: {name}',
      uploaded: 'Dodano zdjęć: {count}.', refresh: 'Odśwież podgląd strony, aby zobaczyć kolekcję.',
      tooLarge: 'Maksymalny rozmiar to 50 MB.', failed: 'Nie udało się zapisać zmiany.', error: '{message}', blank: '',
      alps: 'Alpy', cars: 'Samochody', dolomites: 'Dolomity', planes: 'Samoloty', torun: 'Toruń',
    },
    en: {
      libraryTitle: 'Photo library', libraryHint: 'Photos removed from collections. Add them again without uploading the file.', libraryEmpty: 'There are no detached photos.', libraryTarget: 'Adding to collection: {collection}', libraryChoose: 'Choose or create a collection to add photos from the library.', libraryAdd: 'Add to collection', libraryAdded: 'Added “{name}” from the library. Refresh the website preview.',
      purgePhoto: 'Delete permanently', purgePhotoLabel: 'Permanently delete photo {name}', purging: 'Permanently deleting the file and application copies…', purged: 'Photo permanently removed from application files. Previews for remaining photos have been rebuilt. Prepare a new publishing package.', wrongConfirmation: 'The filename does not match. Nothing was deleted.',
      confirmPurge: 'PERMANENT DELETION: {name}\n\nDeletes the original and identical copies from all collections and the library/trash. Also clears ALL local previews and publishing packages (folders and ZIPs); previews for remaining photos will be rebuilt.\n\nDoes not remove previously published hosting files, downloaded copies or system backups. This cannot be undone in the panel.\n\nTo confirm, enter the exact filename:',
      deletePhoto: 'Remove from collection', deletePhotoLabel: 'Remove photo {name} from collection', deleteCollection: 'Delete collection',
      confirmDeletePhoto: 'Remove “{name}” from “{collection}”? It will stay in the library, ready to add again.',
      confirmDeleteCollection: 'Delete collection “{collection}”? Its photos ({count}) will remain in the library.',
      photoDeleted: 'Photo “{name}” removed from the collection and kept in the library. Refresh the website preview. Prepare a new ZIP before publishing.',
      collectionDeleted: 'Collection “{collection}” deleted. Refresh the website preview. Prepare a new ZIP before publishing.',
      exportTitle: 'Publish website', exportHint: 'Prepare a hosting package containing only the public website and display photos.', exportButton: 'Prepare ZIP', exportDownload: 'Download ZIP ↓', exporting: 'Preparing the website package…', exported: 'Package ready: {collections} collections, {photos} photos. Download the ZIP from the publishing section.',
      title: 'Wizje — studio', workshop: 'workshop', brandLabel: 'Wizje — workshop', languageLabel: 'Admin language', preview: 'View website ↗', logout: 'Sign out',
      yourCollections: 'YOUR COLLECTIONS', chooseCollection: 'Choose a collection', newCollection: 'New collection', name: 'Name', year: 'Year',
      addLocation: 'Add location', editLocation: 'Edit location', cancelLocation: 'Cancel editing', locationTitle: 'Collection locations', locationHint: 'Add places to this collection. Each will appear as a point on the globe.', locationPlace: 'Place', locationName: 'Polish name', locationNameEn: 'English name (optional)', latitude: 'Latitude', longitude: 'Longitude', saveLocation: 'Save location', clearLocation: 'Remove location', customLocation: 'Custom location', locationSaved: 'Location saved. Refresh the homepage.', locationCleared: 'Location removed from the globe.', frenchAlps: 'French Alps', italianDolomites: 'Dolomites · Italy',
      brand: 'Brand', series: 'Series', chooseBrand: 'Choose a brand', chooseSeries: 'Choose a series', film: 'Film', chooseFilm: 'Choose film', filmIso: 'Film ISO', chooseIso: 'Choose ISO', noFilm: 'Unassigned', noIso: 'Unassigned', filmSaved: 'Film and ISO saved. Refresh the website preview.',
      yearUp: 'Next year', yearDown: 'Previous year',
      namePlaceholder: 'e.g. Evenings by the sea', createCollection: 'Create collection', welcomeTitle: 'Your photos, your collections.',
      welcomeCopy: 'Create your first collection to add photos.', editingCollection: 'EDIT COLLECTION',
      dropPhotos: 'Drop photos here or choose files', fileHint: 'JPG, PNG, WebP, AVIF · up to 50 MB per photo',
      cropHint: 'Photos cropped to 5:7 keep their composition. Other aspect ratios are cropped centrally.',
      uploadMedium: 'Technique for these photos', chooseMedium: 'Choose a technique', uploadPhotos: 'Add photos', photos: 'Photos',
      autoSave: 'Technique changes are saved automatically.', emptyCollection: 'This collection is waiting for its first photo. It will then appear on the website.',
      unassigned: 'Unassigned', needsMedium: 'Choose a technique', medium: 'Technique', photoMedium: 'Technique for {name}',
      photoCount: 'Photos in collection: {count}', saving: 'Saving…', loading: 'Loading collections…',
      ready: 'Ready. Choose a collection or create a new one.', saved: 'Technique saved: {name}. Refresh the website preview to see the change.',
      created: 'Collection created. Add your first photos.', uploading: 'Adding {index} of {total}: {name}',
      uploaded: 'Photos added: {count}.', refresh: 'Refresh the website preview to see the collection.',
      tooLarge: 'The maximum file size is 50 MB.', failed: 'Could not save the change.', error: '{message}', blank: '',
      alps: 'Alps', cars: 'Cars', dolomites: 'Dolomites', planes: 'Planes', torun: 'Toruń',
    },
  };
  let language = 'pl';
  try { if (localStorage.getItem('wizje-admin-language') === 'en') language = 'en'; } catch {}
  const t = (key, values = {}) => (text[language][key] ?? key).replace(/\{(\w+)\}/g, (_, name) => values[name] ?? '');
  let lastStatus = { key: 'loading', values: {}, error: false };
  let state = { collections: [], csrf: '' };
  let selectedId = null;
  let busy = false;
  let uploadDetails = {};
  const collectionKey = collection => `${collection.year || '2026'}/${collection.id}`;
  const targetCollection = collection => ({ collection: collection.id, year: collection.year || '2026' });
  $('#collection-year').value = String(new Date().getFullYear());
  function updateYearControls() {
    const year = Number($('#collection-year').value);
    $('#collection-year-up').disabled = busy || year >= 2999;
    $('#collection-year-down').disabled = busy || year <= 1000;
  }
  for (const [id, step] of [['#collection-year-up', 1], ['#collection-year-down', -1]]) {
    $(id).addEventListener('click', () => {
      if (busy) return;
      $('#collection-year').value = String(Math.max(1000, Math.min(2999, Number($('#collection-year').value) + step)));
      updateYearControls();
    });
  }
  updateYearControls();
  const selected = () => state.collections.find(collection => collectionKey(collection) === selectedId);
  function status(key, values = {}, error = false) {
    lastStatus = { key, values, error };
    $('#status').textContent = t(key, values);
    $('#status').dataset.error = String(error);
  }
  function setLanguage(next) {
    if (!text[next]) return;
    language = next;
    document.documentElement.lang = next;
    document.title = t('title');
    document.querySelectorAll('[data-i18n]').forEach(element => {
      const value = t(element.dataset.i18n);
      if (element.dataset.i18n === 'workshop') {
        element.replaceChildren(...Array.from(value, letter => {
          const span = document.createElement('span');
          span.textContent = letter;
          return span;
        }));
      } else element.textContent = value;
    });
    document.querySelectorAll('[data-i18n-aria]').forEach(element => { element.setAttribute('aria-label', t(element.dataset.i18nAria)); });
    document.querySelectorAll('[data-i18n-placeholder]').forEach(element => { element.placeholder = t(element.dataset.i18nPlaceholder); });
    document.querySelectorAll('[data-language]').forEach(button => { button.setAttribute('aria-pressed', String(button.dataset.language === next)); });
    try { localStorage.setItem('wizje-admin-language', next); } catch {}
    render();
    status(lastStatus.key, lastStatus.values, lastStatus.error);
  }
  const collectionName = collection => collection.customTitle ? collection.title : (text[language][collection.id] || collection.title);
  const collectionTitle = collection => `${collectionName(collection)} · ${collection.year || '2026'}`;
  function lock(value) {
    busy = value;
    document.querySelectorAll('button, input, select').forEach(control => { control.disabled = value || (control.dataset.requiresCollection === 'true' && !selected()); });
    updateYearControls();
  }
  async function request(path, data, binary = false) {
    const options = data === undefined ? {} : {
      method: 'POST', headers: { 'X-Wizje-CSRF': state.csrf, 'Content-Type': binary ? 'application/octet-stream' : 'application/json' },
      body: binary ? data : JSON.stringify(data),
    };
    options.headers = { ...options.headers, 'Accept-Language': language };
    const response = await fetch('/admin/api/' + path, options);
    const result = await response.json();
    if (response.status === 401) window.location.assign('/admin');
    if (!response.ok) throw new Error(result.error || t('failed'));
    return result;
  }
  function options(select, value, allowEmpty = true) {
    select.replaceChildren();
    const entries = [...(allowEmpty ? [['', t('unassigned')]] : []), ['analog', 'ANALOG'], ['digital', 'DIGITAL']];
    for (const [key, label] of entries) {
      const option = document.createElement('option'); option.value = key; option.textContent = label; select.append(option);
    }
    select.value = value || '';
  }
  function badges(parent, medium) {
    parent.replaceChildren();
    const types = ['analog', 'digital'].includes(medium) ? [medium] : [];
    if (!types.length) {
      const label = document.createElement('span'); label.className = 'unassigned'; label.textContent = t('needsMedium'); parent.append(label);
    }
    for (const type of types) {
      const badge = document.createElement('span'); badge.className = `badge ${type}`; badge.textContent = type.toUpperCase(); parent.append(badge);
    }
  }
  function filmBadges(parent, photo) {
    if (photo.medium !== 'analog') return;
    const film = (state.films || []).find(item => item.id === photo.film);
    if (film) {
      const badge = document.createElement('span'); badge.className = `badge film-brand--${film.brand}`;
      badge.textContent = film.name; parent.append(badge);
    }
    if (photo.iso) {
      const badge = document.createElement('span'); badge.className = 'badge film-iso';
      badge.textContent = `ISO ${photo.iso}`; parent.append(badge);
    }
  }
  function filmControls(value, onChange) {
    const row = document.createElement('div'); row.className = 'film-controls';
    const films = state.films || [];
    const selectedFilm = films.find(item => item.id === value.film);
    const brandNames = { kodak: 'Kodak', fujifilm: 'Fujifilm', ilford: 'Ilford' };
    for (const key of ['film', 'iso']) {
      const group = document.createElement('label'); group.className = 'film-control';
      const label = document.createElement('span'); label.className = 'film-control-label';
      label.textContent = t(key === 'film' ? 'film' : 'filmIso');
      const select = document.createElement('select'); select.className = 'film-select'; select.disabled = busy;
      select.setAttribute('aria-label', label.textContent);
      if (key === 'film' && selectedFilm) select.classList.add(`film-brand--${selectedFilm.brand}`);
      const empty = document.createElement('option'); empty.value = ''; empty.textContent = '⊘';
      empty.setAttribute('aria-label', t(key === 'film' ? 'noFilm' : 'noIso'));
      empty.title = t(key === 'film' ? 'noFilm' : 'noIso'); select.append(empty);
      if (key === 'film') {
        for (const brand of [...new Set(films.map(item => item.brand))]) {
          const options = document.createElement('optgroup'); options.label = brandNames[brand] || brand;
          for (const film of films.filter(item => item.brand === brand)) {
            const option = document.createElement('option'); option.value = film.id; option.textContent = film.name;
            options.append(option);
          }
          select.append(options);
        }
      } else {
        for (const iso of state.isoValues || []) {
          const option = document.createElement('option'); option.value = String(iso); option.textContent = `ISO ${iso}`;
          select.append(option);
        }
      }
      select.value = value[key] == null ? '' : String(value[key]);
      select.title = key === 'film' ? (selectedFilm?.name || t('noFilm')) : (value.iso ? `ISO ${value.iso}` : t('noIso'));
      select.addEventListener('change', () => {
        if (busy) return;
        onChange({ film: value.film || null, iso: value.iso || null,
          [key]: select.value ? (key === 'iso' ? Number(select.value) : select.value) : null });
      });
      group.append(label, select); row.append(group);
    }
    return row;
  }
  function renderUploadFilm() {
    const host = $('#upload-film');
    host.hidden = $('input[name="upload-medium"]:checked')?.value !== 'analog';
    host.replaceChildren(filmControls(uploadDetails, next => { uploadDetails = next; renderUploadFilm(); }));
  }
  document.querySelectorAll('input[name="upload-medium"]').forEach(input => input.addEventListener('change', () => {
    if (input.value === 'digital') uploadDetails = {};
    renderUploadFilm();
  }));
  $('#upload-form').addEventListener('reset', () => { uploadDetails = {}; queueMicrotask(renderUploadFilm); });
  function actionIcon(kind) {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 24 24'); svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('focusable', 'false'); svg.setAttribute('fill', 'none');
    svg.setAttribute('stroke', 'currentColor'); svg.setAttribute('stroke-width', '1.7');
    svg.setAttribute('stroke-linecap', 'round'); svg.setAttribute('stroke-linejoin', 'round');
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', kind === 'folder' ? 'M3 7V5a1 1 0 0 1 1-1h5l2 3h9a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V7Z' : kind === 'trash'
      ? 'M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7M14 10v7'
      : 'M10 4H4v16h6M14 8l4 4-4 4M8 12h10');
    svg.append(path); return svg;
  }
  function permanentButton(photo, target) {
    const button = document.createElement('button'); button.type = 'button'; button.className = 'danger photo-action';
    button.append(actionIcon('trash')); button.title = t('purgePhoto'); button.setAttribute('aria-label', t('purgePhotoLabel', { name: photo.name }));
    button.addEventListener('click', () => {
      if (busy) return;
      const confirmation = window.prompt(t('confirmPurge', { name: photo.name }));
      if (confirmation === null) return;
      if (confirmation !== photo.name) { status('wrongConfirmation', {}, true); return; }
      return mutate(async () => {
        status('purging'); invalidateExport();
        await request('purge-photo', { ...target, confirmation });
        await reload(); status('purged');
      });
    });
    return button;
  }
  function renderLibrary() {
    const collection = selected();
    $('#library-target').textContent = collection ? t('libraryTarget', { collection: collectionTitle(collection) }) : t('libraryChoose');
    const grid = $('#library-grid'); grid.replaceChildren();
    const photos = state.library || [];
    $('#library-empty').hidden = photos.length > 0;
    for (const photo of photos) {
      const card = document.createElement('article'); card.className = 'photo';
      const image = document.createElement('img'); image.src = photo.preview; image.alt = photo.name; image.loading = 'lazy';
      const name = document.createElement('p'); name.className = 'photo-name'; name.textContent = photo.name;
      const badgeRow = document.createElement('div'); badgeRow.className = 'badges'; badges(badgeRow, photo.medium); filmBadges(badgeRow, photo);
      const add = document.createElement('button'); add.type = 'button'; add.className = 'secondary photo-delete';
      add.textContent = t('libraryAdd'); add.dataset.requiresCollection = 'true'; add.disabled = busy || !collection;
      add.addEventListener('click', () => {
        if (busy || !collection) return;
        return mutate(async () => {
          await request('library-attach', { id: photo.id, ...targetCollection(collection) });
          invalidateExport(); await reload(); status('libraryAdded', { name: photo.name });
        });
      });
      const actions = document.createElement('div'); actions.className = 'photo-actions';
      actions.append(add, permanentButton(photo, { id: photo.id }));
      card.append(image, name, badgeRow, actions); grid.append(card);
    }
  }
  let editingLocationIndex = null;
  const collectionLocations = collection => collection.locations || (collection.location ? [collection.location] : []);
  const locationPresets = [
    { id: 'torun', name: 'Toruń', lat: 53.01, lon: 18.60 },
    { id: 'wroclaw', name: 'Wrocław', lat: 51.10, lon: 17.03 },
    { id: 'alps', name: 'Alpy Francuskie', nameEn: 'French Alps', label: 'frenchAlps', lat: 45.83, lon: 6.85 },
    { id: 'dolomites', name: 'Dolomity · Włochy', nameEn: 'Dolomites · Italy', label: 'italianDolomites', lat: 46.43, lon: 11.85 },
  ];
  function fillLocation(location) {
    $('#location-name').value = location?.name || '';
    $('#location-name-en').value = location?.nameEn || '';
    $('#location-lat').value = location?.lat ?? '';
    $('#location-lon').value = location?.lon ?? '';
  }
  function renderLocation(collection) {
    const select = $('#location-preset'); select.replaceChildren();
    for (const place of [{ id: '', name: t('customLocation') }, ...locationPresets]) {
      const option = document.createElement('option'); option.value = place.id;
      option.textContent = place.label ? t(place.label) : place.name; select.append(option);
    }
    resetLocationForm();
    const list = $('#collection-locations'); list.replaceChildren();
    const locations = collectionLocations(collection);
    locations.forEach((location, index) => {
      const item = document.createElement('li');
      const displayName = language === 'en' ? (location.nameEn || location.name) : location.name;
      const name = document.createElement('span'); name.textContent = displayName;
      const coordinates = document.createElement('small'); coordinates.textContent = `${location.lat.toFixed(2)}, ${location.lon.toFixed(2)}`;
      const description = document.createElement('div'); description.append(name, coordinates);
      const edit = document.createElement('button'); edit.type = 'button'; edit.className = 'secondary'; edit.textContent = '✎';
      edit.title = t('editLocation'); edit.setAttribute('aria-label', `${t('editLocation')}: ${displayName}`);
      edit.addEventListener('click', () => {
        if (busy) return;
        editingLocationIndex = index; fillLocation(location);
        select.value = locationPresets.find(place => place.lat === location.lat && place.lon === location.lon)?.id || '';
        $('#save-location').textContent = t('saveLocation'); $('#cancel-location').hidden = false;
        $('#location-name').focus();
      });
      const remove = document.createElement('button'); remove.type = 'button'; remove.className = 'secondary'; remove.append(actionIcon('trash'));
      remove.title = t('clearLocation'); remove.setAttribute('aria-label', `${t('clearLocation')}: ${displayName}`);
      remove.addEventListener('click', () => {
        if (busy) return;
        mutate(async () => {
          await request('locations', { ...targetCollection(collection), locations: locations.filter((_, i) => i !== index) });
          invalidateExport(); await reload(); status('locationCleared');
        });
      });
      item.append(description, edit, remove); list.append(item);
    });
  }
  function resetLocationForm() {
    editingLocationIndex = null; fillLocation(null); $('#location-preset').value = '';
    $('#save-location').textContent = t('addLocation'); $('#cancel-location').hidden = true;
  }
  $('#cancel-location').addEventListener('click', resetLocationForm);
  $('#location-preset').addEventListener('change', () => {
    const place = locationPresets.find(place => place.id === $('#location-preset').value);
    if (place) fillLocation(place);
  });
  $('#location-form').addEventListener('submit', event => {
    event.preventDefault();
    const collection = selected();
    if (!collection || busy || !$('#location-form').reportValidity()) return;
    const location = { name: $('#location-name').value.trim(), nameEn: $('#location-name-en').value.trim(), lat: Number($('#location-lat').value), lon: Number($('#location-lon').value) };
    const locations = [...collectionLocations(collection)];
    if (editingLocationIndex === null) locations.push(location);
    else locations[editingLocationIndex] = location;
    mutate(async () => {
      await request('locations', { ...targetCollection(collection), locations });
      invalidateExport(); await reload(); status('locationSaved');
    });
  });
  function render() {
    renderLibrary();
    renderUploadFilm();
    const navigation = $('#collections');
    const expanded = new Map([...navigation.querySelectorAll('details')].map(group => [group.dataset.year, group.open]));
    navigation.replaceChildren();
    const years = [...new Set(state.collections.map(collection => collection.year || '2026'))].sort((a, b) => Number(b) - Number(a));
    const branches = new Map();
    for (const year of years) {
      const group = document.createElement('details'); group.className = 'collection-year'; group.dataset.year = year;
      group.open = expanded.get(year) ?? true;
      const heading = document.createElement('summary');
      const title = document.createElement('span'); title.textContent = year;
      heading.append(actionIcon('folder'), title);
      const children = document.createElement('div'); children.className = 'collection-branches';
      group.append(heading, children); navigation.append(group); branches.set(year, children);
    }
    for (const collection of state.collections) {
      const button = document.createElement('button'); button.type = 'button';
      button.setAttribute('aria-current', String(collectionKey(collection) === selectedId));
      const title = document.createElement('span'); title.className = 'collection-tree-name'; title.textContent = collectionName(collection);
      const count = document.createElement('span'); count.className = 'collection-tree-count'; count.textContent = collection.photos.length;
      button.append(actionIcon('folder'), title, count); button.addEventListener('click', () => {
        if (busy) return;
        selectedId = collectionKey(collection); $('#upload-form').reset(); render(); status('blank');
      }); branches.get(collection.year || '2026').append(button);
    }
    const collection = selected();
    $('#welcome').hidden = Boolean(collection); $('#editor').hidden = !collection;
    if (!collection) return;
    renderLocation(collection);
    $('#collection-title').textContent = collectionTitle(collection);
    $('#photo-count').textContent = t('photoCount', { count: collection.photos.length });
    $('#empty').hidden = collection.photos.length > 0;
    const grid = $('#photo-grid'); grid.replaceChildren();
    collection.photos.forEach((photo, index) => {
      const card = document.createElement('article'); card.className = 'photo';
      const image = document.createElement('img'); image.src = photo.preview; image.alt = photo.name; image.loading = 'lazy';
      const name = document.createElement('p'); name.className = 'photo-name'; name.textContent = photo.name;
      const badgeRow = document.createElement('div'); badgeRow.className = 'badges'; badges(badgeRow, photo.medium); filmBadges(badgeRow, photo);
      const label = document.createElement('label'); label.htmlFor = `photo-medium-${index}`; label.textContent = t('medium');
      const select = document.createElement('select'); select.id = label.htmlFor; options(select, photo.medium);
      select.setAttribute('aria-label', t('photoMedium', { name: photo.name }));
      select.addEventListener('change', () => mutate(async () => {
        await request('medium', { ...targetCollection(selected()), name: photo.name, medium: select.value || null });
        await reload(); status('saved', { name: photo.name });
      }));
      const remove = document.createElement('button'); remove.type = 'button'; remove.className = 'secondary photo-action';
      remove.append(actionIcon('exit')); remove.title = t('deletePhoto'); remove.setAttribute('aria-label', t('deletePhotoLabel', { name: photo.name }));
      remove.addEventListener('click', () => {
        if (busy || !window.confirm(t('confirmDeletePhoto', { name: photo.name, collection: collectionTitle(collection) }))) return;
        return mutate(async () => {
          await request('delete-photo', { ...targetCollection(collection), name: photo.name });
          invalidateExport(); await reload(); status('photoDeleted', { name: photo.name });
        });
      });
      const actions = document.createElement('div'); actions.className = 'photo-actions';
      actions.append(remove, permanentButton(photo, { ...targetCollection(collection), name: photo.name }));
      card.append(image, name, badgeRow, label, select);
      if (photo.medium === 'analog') card.append(filmControls(photo, next => mutate(async () => {
        await request('film', { ...targetCollection(collection), name: photo.name, ...next });
        invalidateExport(); await reload(); status('filmSaved');
      })));
      card.append(actions); grid.append(card);
    });
  }
  async function reload() {
    state = await request('state');
    if (!state.collections.some(collection => collectionKey(collection) === selectedId)) selectedId = (state.collections[0] ? collectionKey(state.collections[0]) : null);
    render();
  }
  async function mutate(action) {
    if (busy) return;
    lock(true); status('saving');
    try { await action(); }
    catch (error) { status('error', { message: error.message }, true); await reload().catch(() => {}); }
    finally { lock(false); }
  }
  function invalidateExport() {
    $('#export-download').hidden = true;
    $('#export-details').hidden = true;
  }
  $('#delete-collection').addEventListener('click', () => {
    const collection = selected();
    if (busy || !collection) return;
    const title = collectionTitle(collection);
    if (!window.confirm(t('confirmDeleteCollection', { collection: title, count: collection.photos.length }))) return;
    return mutate(async () => {
      await request('delete-collection', { ...targetCollection(collection) });
      $('#upload-form').reset(); invalidateExport(); await reload();
      status('collectionDeleted', { collection: title });
    });
  });
  $('#create-form').addEventListener('submit', event => {
    event.preventDefault();
    const name = $('#collection-name').value.trim();
    const year = $('#collection-year').value;
    mutate(async () => {
      const result = await request('collections', { name, year }); selectedId = collectionKey(result);
      $('#create-form').reset(); $('#collection-year').value = year; $('#upload-form').reset(); await reload(); status('created');
    });
  });
  $('#upload-form').addEventListener('submit', event => {
    event.preventDefault(); const files = [...$('#photos').files]; const medium = $('input[name="upload-medium"]:checked')?.value;
    if (!files.length || !medium) return;
    mutate(async () => {
      const errors = []; let count = 0;
      for (const [index, file] of files.entries()) {
        status('uploading', { index: index + 1, total: files.length, name: file.name });
        try {
          if (file.size > 50 * 1024 * 1024) throw new Error(t('tooLarge'));
          const params = new URLSearchParams({ ...targetCollection(selected()), name: file.name, medium });
          if (medium === 'analog') {
            if (uploadDetails.film) params.set('film', uploadDetails.film);
            if (uploadDetails.iso) params.set('iso', uploadDetails.iso);
          }
          await request('upload?' + params, file, true); count++;
        } catch (error) { errors.push(`${file.name}: ${error.message}`); }
      }
      $('#upload-form').reset(); await reload();
      status('error', { message: t('uploaded', { count }) + (errors.length ? '\n' + errors.join('\n') : ' ' + t('refresh')) }, errors.length > 0);
    });
  });
  $('#export-site').addEventListener('click', () => mutate(async () => {
    status('exporting');
    $('#export-download').hidden = true;
    $('#export-details').hidden = true;
    const result = await request('export', {});
    const link = $('#export-download');
    link.href = result.download;
    link.download = result.name;
    link.hidden = false;
    $('#export-details').textContent = `${result.name} · ${(result.bytes / 1024 / 1024).toFixed(2)} MB`;
    $('#export-details').hidden = false;
    status('exported', result);
  }));
  const dropzone = $('#dropzone');
  for (const type of ['dragenter', 'dragover']) dropzone.addEventListener(type, event => { event.preventDefault(); if (!busy) dropzone.classList.add('is-dragging'); });
  for (const type of ['dragleave', 'drop']) dropzone.addEventListener(type, event => { event.preventDefault(); dropzone.classList.remove('is-dragging'); });
  dropzone.addEventListener('drop', event => { if (!busy && event.dataTransfer.files.length) $('#photos').files = event.dataTransfer.files; });
  $('#logout').addEventListener('click', () => mutate(async () => { await request('logout', {}); window.location.assign('/admin'); }));
  document.querySelectorAll('[data-language]').forEach(button => button.addEventListener('click', () => setLanguage(button.dataset.language)));
  setLanguage(language);
  reload().then(() => status('ready')).catch(error => status('error', { message: error.message }, true));
})();
