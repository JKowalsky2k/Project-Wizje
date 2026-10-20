/* Pointer-based sorting: the original tile reserves its place in the layout. */
window.WizjeSortable = (() => {
  let active = null;
  const bindings = new WeakMap();

  function attach(container, options) {
    const attached = bindings.has(container);
    bindings.set(container, options);
    if (attached) return;
    container.addEventListener('dragstart', event => {
      if (event.target.closest('[data-sort-handle]')) event.preventDefault();
    });
    container.addEventListener('pointerdown', event => {
      const { canStart, onDrop, onStart = () => {}, onCancel = () => {} } = bindings.get(container);
      const handle = event.target.closest('[data-sort-handle]');
      const tile = handle?.closest('[data-sort-key]');
      if (!tile || tile.parentElement !== container || event.button !== 0 || event.isPrimary === false || active || !canStart()) return;
      const original = [...container.children];
      if (original.length < 2) return;
      const expected = original.map(item => item.dataset.sortKey);
      const initial = tile.getBoundingClientRect();
      const offset = { x: event.clientX - initial.left, y: event.clientY - initial.top };
      const start = { x: event.clientX, y: event.clientY };
      let x = start.x, y = start.y, ghost = null, frame = null, dragging = false;
      let lastTime = null, dirty = true;
      const animations = new Map();
      let layout = new Map();
      function measure() {
        layout = new Map([...container.children].map(child => {
          const rect = child.getBoundingClientRect();
          return [child, { left: rect.left + (window.scrollX || 0), top: rect.top + (window.scrollY || 0), width: rect.width, height: rect.height }];
        }));
      }

      function place() {
        ghost.style.transform = `translate(${x - offset.x}px,${y - offset.y}px)`;
        // Hit-test final layout slots, never the temporarily animated tile positions.
        const px = x + (window.scrollX || 0), py = y + (window.scrollY || 0);
        const target = [...layout].find(([child, rect]) => {
          const insetX = Math.min(18, rect.width * .12), insetY = Math.min(18, rect.height * .12);
          return px >= rect.left + insetX && px <= rect.left + rect.width - insetX
            && py >= rect.top + insetY && py <= rect.top + rect.height - insetY;
        })?.[0];
        if (!target || target === tile || target.parentElement !== container) return;
        const children = [...container.children];
        const positions = new Map();
        animations.forEach(animation => animation.cancel());
        animations.clear();
        for (const child of children) {
          positions.set(child, child.getBoundingClientRect());
        }
        container.insertBefore(tile, children.indexOf(target) > children.indexOf(tile) ? target.nextSibling : target);
        measure();
        if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
        for (const child of children) {
          if (child === tile || !child.animate) continue;
          const before = positions.get(child), measured = layout.get(child);
          const after = { left: measured.left - (window.scrollX || 0), top: measured.top - (window.scrollY || 0) };
          if (before.left === after.left && before.top === after.top) continue;
          animations.set(child, child.animate([
            { transform: `translate(${before.left - after.left}px, ${before.top - after.top}px)` },
            { transform: 'translate(0, 0)' },
          ], { duration: 180, easing: 'ease-out' }));
        }
      }

      function tick(time) {
        if (!dragging) return;
        // Scroll the page while dragging near the viewport edge.
        const elapsed = Math.min(lastTime === null ? 16 : time - lastTime, 32);
        lastTime = time;
        const edge = 64;
        const speed = y < edge ? -Math.min(1, (edge - y) / edge)
          : y > innerHeight - edge ? Math.min(1, (y - innerHeight + edge) / edge) : 0;
        if (speed) window.scrollBy(0, speed * elapsed * .7);
        if (dirty || speed) { place(); dirty = false; }
        frame = requestAnimationFrame(tick);
      }

      function move(next) {
        if (next.pointerId !== event.pointerId) return;
        x = next.clientX; y = next.clientY;
        if (!dragging && Math.hypot(x - start.x, y - start.y) < 7) return;
        if (!dragging) {
          if (!canStart() || !tile.isConnected) { finish(false); return; }
          dragging = true;
          ghost = tile.cloneNode(true);
          ghost.removeAttribute('id');
          ghost.removeAttribute('data-sort-key');
          ghost.querySelectorAll('[id]').forEach(node => node.removeAttribute('id'));
          ghost.querySelectorAll('[name]').forEach(node => node.removeAttribute('name'));
          ghost.classList.add('sort-ghost');
          ghost.setAttribute('aria-hidden', 'true');
          ghost.inert = true;
          ghost.style.width = `${initial.width}px`;
          ghost.style.height = `${initial.height}px`;
          document.body.append(ghost);
          tile.classList.add('sort-placeholder');
          container.classList.add('is-sorting');
          document.body.classList.add('sorting-active');
          onStart();
          measure();
          frame = requestAnimationFrame(tick);
        }
        next.preventDefault();
        dirty = true;
      }

      function finish(commit) {
        document.removeEventListener('pointermove', move);
        document.removeEventListener('pointerup', up);
        document.removeEventListener('pointercancel', cancelPointer);
        document.removeEventListener('keydown', key);
        window.removeEventListener('blur', cancel);
        window.removeEventListener('resize', cancel);
        cancelAnimationFrame(frame);
        animations.forEach(animation => animation.cancel());
        active = null;
        if (!dragging) return;
        // A drag must not also activate the collection button under the pointer.
        const suppressClick = click => { click.preventDefault(); click.stopImmediatePropagation(); };
        document.addEventListener('click', suppressClick, true);
        setTimeout(() => document.removeEventListener('click', suppressClick, true), 0);
        ghost.remove();
        tile.classList.remove('sort-placeholder');
        container.classList.remove('is-sorting');
        document.body.classList.remove('sorting-active');
        const bounds = container.getBoundingClientRect();
        const inside = x >= bounds.left && x <= bounds.right && y >= bounds.top && y <= bounds.bottom;
        const order = [...container.children].map(item => item.dataset.sortKey);
        const restore = () => {
          // A refresh may already have replaced these nodes with confirmed server state.
          if (original.every(item => item.parentElement === container)) original.forEach(item => container.append(item));
        };
        if (commit && inside && order.some((name, index) => name !== expected[index])) {
          // Keep the dropped position visible while saving instead of jumping back.
          Promise.resolve(onDrop(order, expected)).then(saved => {
            if (saved === false) restore();
          }).catch(restore);
        } else { restore(); onCancel(); }
      }
      function up(next) {
        if (next.pointerId !== event.pointerId) return;
        x = next.clientX; y = next.clientY;
        if (dragging) place();
        finish(true);
      }
      function cancelPointer(next) { if (next.pointerId === event.pointerId) finish(false); }
      function cancel() { finish(false); }
      function key(next) { if (next.key === 'Escape') { next.preventDefault(); finish(false); } }
      active = cancel;
      document.addEventListener('pointermove', move, { passive: false });
      document.addEventListener('pointerup', up);
      document.addEventListener('pointercancel', cancelPointer);
      document.addEventListener('keydown', key);
      window.addEventListener('blur', cancel);
      window.addEventListener('resize', cancel);
    });
  }
  return { attach, cancel: () => active?.(), isDragging: () => active !== null };
})();

/* Shared photo view calculations, independent of the DOM. */
window.WizjePhotoTools = {
  reference(photo) { return String(photo.preview || '').match(/\/([a-f0-9]{10,})-(?:480|2000)\.jpg/i)?.[1].slice(0, 10).toUpperCase() || ''; },
  available(photo, posters) { return posters.some(poster => photo.posterSizes == null || photo.posterSizes.includes(poster.name)); },
  missing(photo) { return !photo.medium || !photo.colorMode || (photo.medium === 'analog' && (!photo.film || !photo.iso)); },
  matches(photo, filters, posters) {
    return (!filters.search || `${photo.name} ${this.reference(photo)}`.toLocaleLowerCase().includes(filters.search.toLocaleLowerCase()))
      && (!filters.medium || photo.medium === filters.medium)
      && (!filters.orientation || (photo.orientation || 'portrait') === filters.orientation)
      && (!filters.color || photo.colorMode === filters.color)
      && (!filters.available || this.available(photo, posters) === (filters.available === 'yes'))
      && (!filters.missing || this.missing(photo));
  },
  fit(photo, name, margins) {
    const match = String(name).match(/^(\d+(?:[.,]\d+)?)\s*[×xX]\s*(\d+(?:[.,]\d+)?)\s*(?:cm)?$/);
    let dims = match ? match.slice(1).map(value => Number(value.replace(',', '.'))).sort((a,b) => a-b) : [50,70];
    if (dims.some(value => !Number.isFinite(value) || value <= 0)) dims = [50,70];
    if (photo.orientation === 'landscape') dims.reverse();
    const width = photo.detailWidth || photo.sourceWidth || dims[0], height = photo.detailHeight || photo.sourceHeight || dims[1];
    const scale = Math.min(dims[0]/width, dims[1]/height) * (margins ? .84 : 1);
    const w = width * scale, h = height * scale;
    return {paperWidth:dims[0],paperHeight:dims[1],w,h,x:(dims[0]-w)/2,y:(dims[1]-h)/2};
  },
};

/* Workshop editor. */
(() => {
  if (location.protocol !== 'http:' || !['127.0.0.1', 'localhost'].includes(location.hostname)) {
    document.body.textContent = 'Panel działa tylko lokalnie. / This admin panel only works locally.';
    return;
  }

  const $ = selector => document.querySelector(selector);
  const text = {
    pl: {
      photoSizes: 'Dostępne formaty', allSizes: 'Wszystkie, także dodane później', savePhotoSizes: 'Zapisz formaty zdjęcia', marginHint: 'Minimalne marginesy: lewy/prawy {x} cm, góra/dół {y} cm. Dodatkowe odstępy zależą od proporcji zdjęcia.', noSizesHint: 'Odznaczenie wszystkich formatów wyłącza zamawianie zdjęcia.', posterSettings: 'Plakaty i ceny', posterSettingsHint: 'Dodaj formaty w cm, np. 30 × 40 cm. Przy każdym zdjęciu wybierz dostępne formaty. Nowe zdjęcia domyślnie mają wszystkie formaty.', posterAdd: 'Dodaj format', posterSave: 'Zapisz formaty i ceny', posterFormat: 'Format (cm)', posterPrice: 'Cena (zł)', posterRemove: 'Usuń format', posterSaved: 'Zapisano globalne formaty i ceny. Przygotuj nowy ZIP przed publikacją.',
      dragOrder: 'Przeciągnij, aby zmienić kolejność: {name}', draggingOrder: 'Przesuń w nowe miejsce i puść. Esc anuluje.', orderHint: 'Przeciągnij uchwyt ⋮⋮, aby zmienić kolejność. Przy aktywnych filtrach najpierw je wyczyść.',
      orderPosition: 'Pozycja {index} z {total}', moveEarlier: 'Przesuń wcześniej: {name}', moveLater: 'Przesuń później: {name}', orderSaved: 'Kolejność zapisana. Odśwież podgląd strony. Przed publikacją przygotuj nowy ZIP.',
      libraryTitle: 'Biblioteka zdjęć', libraryHint: 'Zdjęcia odłączone od kolekcji. Możesz dodać je ponownie bez przesyłania pliku.', libraryEmpty: 'Nie ma zdjęć odłączonych od kolekcji.', libraryTarget: 'Dodawanie do kolekcji: {collection}', libraryChoose: 'Wybierz lub utwórz kolekcję, aby dodać do niej zdjęcia z biblioteki.', libraryAdd: 'Dodaj do kolekcji', libraryAdded: 'Dodano „{name}” z biblioteki. Odśwież podgląd strony.',
      purgePhoto: 'Usuń trwale', purgePhotoLabel: 'Usuń trwale zdjęcie {name}', purging: 'Trwałe usuwanie pliku i kopii aplikacji…', purged: 'Zdjęcie usunięte trwale z plików aplikacji. Podglądy pozostałych zdjęć zostały odbudowane. Przygotuj nową paczkę do publikacji.',
      deletePhoto: 'Odłącz od kolekcji', deletePhotoLabel: 'Odłącz zdjęcie {name} od kolekcji', deleteCollection: 'Usuń kolekcję',
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
      colorMode: 'Kolorystyka', color: 'Kolorowe', monochrome: 'Czarno-białe',
      orientation: 'Orientacja', portrait: 'Pionowa', landscape: 'Pozioma',
      cropHint: 'Domyślny kadr jest pionowy (5:7). Wybierz orientację przy dodawaniu lub zmień ją osobno pod zdjęciem.',
      uploadMedium: 'Technika dodawanych zdjęć', chooseMedium: 'Wybierz technikę', uploadPhotos: 'Dodaj zdjęcia', photos: 'Zdjęcia',
      photoReference: 'Kod zdjęcia',
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
      photoSizes: 'Available sizes', allSizes: 'All, including future sizes', savePhotoSizes: 'Save photo sizes', marginHint: 'Minimum margins: left/right {x} cm, top/bottom {y} cm. Additional spacing depends on photo proportions.', noSizesHint: 'Unchecking every size disables ordering for this photo.', posterSettings: 'Posters and prices', posterSettingsHint: 'Add sizes in cm, e.g. 30 × 40 cm. Select available sizes for each photo. New photos default to all sizes.', posterAdd: 'Add size', posterSave: 'Save sizes and prices', posterFormat: 'Size (cm)', posterPrice: 'Price (PLN)', posterRemove: 'Remove size', posterSaved: 'Global sizes and prices saved. Prepare a new ZIP before publishing.',
      dragOrder: 'Drag to reorder: {name}', draggingOrder: 'Move to a new position and release. Esc cancels.', orderHint: 'Drag the ⋮⋮ handle to reorder. Clear active filters before sorting.',
      orderPosition: 'Position {index} of {total}', moveEarlier: 'Move earlier: {name}', moveLater: 'Move later: {name}', orderSaved: 'Order saved. Refresh the website preview. Prepare a new ZIP before publishing.',
      libraryTitle: 'Photo library', libraryHint: 'Photos removed from collections. Add them again without uploading the file.', libraryEmpty: 'There are no detached photos.', libraryTarget: 'Adding to collection: {collection}', libraryChoose: 'Choose or create a collection to add photos from the library.', libraryAdd: 'Add to collection', libraryAdded: 'Added “{name}” from the library. Refresh the website preview.',
      purgePhoto: 'Delete permanently', purgePhotoLabel: 'Permanently delete photo {name}', purging: 'Permanently deleting the file and application copies…', purged: 'Photo permanently removed from application files. Previews for remaining photos have been rebuilt. Prepare a new publishing package.',
      deletePhoto: 'Remove from collection', deletePhotoLabel: 'Remove photo {name} from collection', deleteCollection: 'Delete collection',
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
      colorMode: 'Color', color: 'Color', monochrome: 'Black & white',
      orientation: 'Orientation', portrait: 'Portrait', landscape: 'Landscape',
      cropHint: 'The default crop is portrait (5:7). Choose orientation when uploading or change it below each photo.',
      uploadMedium: 'Technique for these photos', chooseMedium: 'Choose a technique', uploadPhotos: 'Add photos', photos: 'Photos',
      photoReference: 'Photo reference',
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
  Object.assign(text.pl, {
    searchCollections:'Szukaj kolekcji',searchPhotos:'Szukaj zdjęcia',searchHint:'Nazwa lub kod zdjęcia',all:'Wszystkie',availability:'Zamawianie',available:'Dostępne',unavailable:'Niedostępne',missingData:'Brakujące dane',resetFilters:'Wyczyść filtry',noMatches:'Brak zdjęć pasujących do filtrów.',
    selectVisible:'Zaznacz widoczne',clearSelection:'Odznacz wszystkie',selectedCount:'Zaznaczono: {count}',filterResults:'Widoczne: {visible} z {total}',bulkEdit:'Edycja zaznaczonych zdjęć',bulkHint:'Ustaw tylko pola, które chcesz zmienić. Pozostałe zachowają swoje wartości.',unchanged:'Bez zmian',applyBulk:'Zastosuj do zaznaczonych',bulkSaved:'Zaktualizowano zdjęcia: {count}.',moveTo:'Przenieś do kolekcji',keepCollection:'Pozostaw w obecnej kolekcji',sizeKeep:'Bez zmian',sizeInherit:'Wszystkie obecne i przyszłe',sizeChoose:'Wybrane formaty',sizeNone:'Wyłącz zamawianie',clearValue:'Wyczyść',
    editPhoto:'Edytuj zdjęcie',photoSettings:'Ustawienia zdjęcia',close:'Zamknij',previousPhoto:'Poprzednie',nextPhoto:'Następne',previewSize:'Format podglądu',previewFrame:'Ramka',previewMargins:'Marginesy',previewColor:'Kolor marginesów',black:'Czarne',white:'Białe',previewFailed:'Nie udało się wczytać podglądu.',previewDimensions:'Zdjęcie: {w} × {h} cm. Marginesy: lewy/prawy {x} cm, góra/dół {y} cm.',
    undoShort:'Cofnij',undo:'Cofnij ostatnią zmianę',undone:'Zmiana cofnięta.',retry:'Spróbuj ponownie',fieldSaved:'Zapisano',fieldFailed:'Błąd zapisu',saved:'Zapisano ustawienia: {name}.',autoSave:'Ustawienia zapisują się automatycznie.',
    packageDirty:'Masz zmiany niewłączone do ostatniego ZIP-a.',packageClean:'Ostatnia paczka zawiera aktualne dane.',packageNone:'Przygotuj pierwszą paczkę w panelu.',packageChanges:'Dodane: {added}, usunięte: {removed}, zmienione zdjęcia: {changed}.',packageCollections:'Zmienione kolekcje: {count}',packagePrices:'Zmiany formatów lub cen',packageAppearance:'Zmiany strony lub ustawień',
    retryUploads:'Ponów nieudane pliki',uploadWaiting:'Oczekuje',uploadSending:'Przesyłanie: {percent}%',uploadProcessing:'Przygotowywanie podglądów…',uploadDone:'Dodano',uploadFailed:'Błąd: {message}',
  });
  Object.assign(text.en, {
    searchCollections:'Search collections',searchPhotos:'Search photos',searchHint:'File name or photo reference',all:'All',availability:'Ordering',available:'Available',unavailable:'Unavailable',missingData:'Missing information',resetFilters:'Reset filters',noMatches:'No photographs match these filters.',
    selectVisible:'Select visible',clearSelection:'Clear selection',selectedCount:'Selected: {count}',filterResults:'Showing {visible} of {total}',bulkEdit:'Edit selected photos',bulkHint:'Set only the fields you want to change. Other values will be preserved.',unchanged:'Keep current values',applyBulk:'Apply to selected',bulkSaved:'Photos updated: {count}.',moveTo:'Move to collection',keepCollection:'Keep current collection',sizeKeep:'Keep current values',sizeInherit:'All current and future sizes',sizeChoose:'Selected sizes',sizeNone:'Disable ordering',clearValue:'Clear value',
    editPhoto:'Edit photo',photoSettings:'Photo settings',close:'Close',previousPhoto:'Previous',nextPhoto:'Next',previewSize:'Preview size',previewFrame:'Frame',previewMargins:'Margins',previewColor:'Margin color',black:'Black',white:'White',previewFailed:'Could not load the preview.',previewDimensions:'Photo: {w} × {h} cm. Margins: left/right {x} cm, top/bottom {y} cm.',
    undoShort:'Undo',undo:'Undo last change',undone:'Change undone.',retry:'Try again',fieldSaved:'Saved',fieldFailed:'Save failed',saved:'Photo settings saved: {name}.',autoSave:'Settings are saved automatically.',
    packageDirty:'Changes are not included in the last ZIP.',packageClean:'The last package contains the current data.',packageNone:'Prepare the first package in the panel.',packageChanges:'Added: {added}, removed: {removed}, changed photos: {changed}.',packageCollections:'Changed collections: {count}',packagePrices:'Size or price changes',packageAppearance:'Website or settings changes',
    retryUploads:'Retry failed files',uploadWaiting:'Waiting',uploadSending:'Uploading: {percent}%',uploadProcessing:'Preparing previews…',uploadDone:'Added',uploadFailed:'Error: {message}',
  });
  let language = 'pl';
  try { if (localStorage.getItem('wizje-admin-language') === 'en') language = 'en'; } catch {}
  const t = (key, values = {}) => (text[language][key] ?? key).replace(/\{(\w+)\}/g, (_, name) => values[name] ?? '');
  let lastStatus = { key: 'loading', values: {}, error: false };
  let state = { collections: [], posters: [], csrf: '' };
  let selectedId = null;
  let busy = false;
  let uploadDetails = {};
  const photoTools = window.WizjePhotoTools;
  const selectedPhotos = new Set();
  let selectionCollection = null, editingPhoto = null, undoToken = null, retryAction = null;
  let importItems = [], importContext = null;
  const fieldStates = new Map();
  const filters = () => ({search:$('#photo-search').value.trim(),medium:$('#photo-filter-medium').value,orientation:$('#photo-filter-orientation').value,color:$('#photo-filter-color').value,available:$('#photo-filter-available').value,missing:$('#photo-filter-missing').checked});
  const hasFilters = () => Object.values(filters()).some(Boolean);
  const visiblePhotos = collection => collection.photos.filter(photo => photoTools.matches(photo,filters(),state.posters || []));
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
  const photoReference = photo => photoTools.reference(photo);
  function referenceRow(photo) {
    const reference = document.createElement('p'); reference.className = 'photo-reference';
    const label = document.createElement('span'); label.textContent = `${t('photoReference')}:`;
    const code = document.createElement('code'); code.textContent = photoReference(photo);
    reference.append(label, code); return reference;
  }
  function renderPosterSettings() {
    const list = $('#poster-list');
    list.replaceChildren();
    for (const poster of state.posters || []) {
      const row = document.createElement('div'); row.className = 'poster-row';
      const nameLabel = document.createElement('label'); nameLabel.textContent = t('posterFormat');
      const name = document.createElement('input'); name.type = 'text'; name.maxLength = 40; name.value = poster.name; name.required = true;
      nameLabel.append(name);
      const priceLabel = document.createElement('label'); priceLabel.textContent = t('posterPrice');
      const price = document.createElement('input'); price.type = 'number'; price.min = '0'; price.max = '1000000'; price.step = '0.01'; price.value = (poster.priceCents / 100).toFixed(2); price.required = true;
      priceLabel.append(price);
      const remove = document.createElement('button'); remove.type = 'button'; remove.className = 'secondary'; remove.textContent = '−'; remove.title = t('posterRemove'); remove.setAttribute('aria-label', `${t('posterRemove')}: ${poster.name}`);
      remove.addEventListener('click', () => { if (list.querySelectorAll('.poster-row').length > 1) row.remove(); });
      row.append(nameLabel, priceLabel, remove); list.append(row);
    }
  }
  $('#poster-add').addEventListener('click', () => {
    const row = document.createElement('div'); row.className = 'poster-row';
    const nameLabel = document.createElement('label'); nameLabel.textContent = t('posterFormat');
    const name = document.createElement('input'); name.type = 'text'; name.maxLength = 40; name.placeholder = 'np. 70 × 100'; name.required = true; nameLabel.append(name);
    const priceLabel = document.createElement('label'); priceLabel.textContent = t('posterPrice');
    const price = document.createElement('input'); price.type = 'number'; price.min = '0'; price.max = '1000000'; price.step = '0.01'; price.value = '0'; price.required = true; priceLabel.append(price);
    const remove = document.createElement('button'); remove.type = 'button'; remove.className = 'secondary'; remove.textContent = '−'; remove.title = t('posterRemove'); remove.setAttribute('aria-label', t('posterRemove')); remove.addEventListener('click', () => { if ($('#poster-list').querySelectorAll('.poster-row').length > 1) row.remove(); });
    row.append(nameLabel, priceLabel, remove); $('#poster-list').append(row); name.focus();
  });
  $('#poster-save').addEventListener('click', () => mutate(async () => {
    const posters = [...$('#poster-list').querySelectorAll('.poster-row')].map(row => ({
      name: row.querySelector('input[type="text"]').value.trim(),
      priceCents: Math.round(Number(row.querySelector('input[type="number"]').value) * 100),
    }));
    await request('posters', { posters });
    invalidateExport(); await reload(); status('posterSaved');
  }));
  function lock(value) {
    busy = value;
    document.querySelectorAll('button, input, select').forEach(control => { control.disabled = (value && control.dataset.alwaysEnabled !== 'true') || control.dataset.orderBoundary === 'true' || control.dataset.sizeInherited === 'true' || (control.dataset.requiresCollection === 'true' && !selected()); });
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
    if (result.publication) { state.publication = result.publication; renderPublication(); }
    if (result.undo) { undoToken = result.undo; updateUndoButtons(); }
    if (data !== undefined && !result.undo && path !== 'undo') { undoToken = null; updateUndoButtons(); }
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
    const brandNames = { kodak: 'Kodak', fujifilm: 'Fujifilm', ilford: 'Ilford', harman: 'HARMAN', foma: 'Foma', kono: 'KONO!' };
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
      return mutate(async () => {
        status('purging'); invalidateExport();
        await request('purge-photo', { ...target, confirmed: true });
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
  function locationPresets() {
    const places = new Map();
    for (const collection of state.collections) {
      for (const location of collectionLocations(collection)) {
        const lat = Number(location.lat), lon = Number(location.lon);
        if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
        const key = `${lat.toFixed(5)},${lon.toFixed(5)}`;
        if (!places.has(key)) places.set(key, {
          id: `location-${places.size}`, name: location.name,
          nameEn: location.nameEn, lat, lon,
        });
      }
    }
    return [...places.values()];
  }
  function fillLocation(location) {
    $('#location-name').value = location?.name || '';
    $('#location-name-en').value = location?.nameEn || '';
    $('#location-lat').value = location?.lat ?? '';
    $('#location-lon').value = location?.lon ?? '';
  }
  function renderLocation(collection) {
    const select = $('#location-preset'); select.replaceChildren();
    for (const place of [{ id: '', name: t('customLocation') }, ...locationPresets()]) {
      const option = document.createElement('option'); option.value = place.id;
      option.textContent = place.id && language === 'en' ? (place.nameEn || place.name) : place.name; select.append(option);
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
        select.value = locationPresets().find(place => place.lat === location.lat && place.lon === location.lon)?.id || '';
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
    const place = locationPresets().find(place => place.id === $('#location-preset').value);
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
  function orderIcon(kind) {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 20 20');
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('focusable', 'false');
    if (kind === 'grip') {
      for (const x of [7, 13]) for (const y of [5, 10, 15]) {
        const dot = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        dot.setAttribute('cx', x); dot.setAttribute('cy', y); dot.setAttribute('r', '1.2');
        dot.setAttribute('fill', 'currentColor'); svg.append(dot);
      }
    } else {
      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('d', kind === 'up' ? 'M6 11l4-4 4 4' : 'M6 9l4 4 4-4');
      path.setAttribute('fill', 'none'); path.setAttribute('stroke', 'currentColor');
      path.setAttribute('stroke-width', '1.5'); path.setAttribute('stroke-linecap', 'round');
      path.setAttribute('stroke-linejoin', 'round'); svg.append(path);
    }
    return svg;
  }
  function orderControls(items, index, collection, photo = null) {
    const row = document.createElement('div'); row.className = 'order-controls';
    const position = document.createElement('span');
    position.textContent = `${index + 1} / ${items.length}`;
    position.setAttribute('aria-label', t('orderPosition', { index: index + 1, total: items.length }));
    const grip = document.createElement('button'); grip.type = 'button'; grip.className = 'sort-grip';
    grip.append(orderIcon('grip')); grip.dataset.sortHandle = 'true';
    grip.title = t('dragOrder', { name: photo?.name || collectionName(collection) });
    grip.setAttribute('aria-label', grip.title);
    row.append(grip, position);
    const identity = JSON.stringify([collectionKey(collection), photo?.name || null]);
    for (const step of [-1, 1]) {
      const button = document.createElement('button'); button.type = 'button';
      button.append(orderIcon(step < 0 ? 'up' : 'down'));
      button.dataset.orderIdentity = identity;
      button.dataset.orderStep = String(step);
      button.dataset.orderBoundary = String(index + step < 0 || index + step >= items.length);
      button.disabled = busy || button.dataset.orderBoundary === 'true';
      button.title = t(step < 0 ? 'moveEarlier' : 'moveLater', { name: photo?.name || collectionName(collection) });
      button.setAttribute('aria-label', button.title);
      button.addEventListener('click', async () => {
        if (busy || button.dataset.orderBoundary === 'true') return;
        const expected = items.map(item => photo ? item.name : item.id);
        const order = [...expected];
        [order[index], order[index + step]] = [order[index + step], order[index]];
        await mutate(async () => {
          await request(photo ? 'reorder-photos' : 'reorder-collections', {
            ...targetCollection(collection), order, expected,
          });
          invalidateExport(); await reload(); status('orderSaved');
        });
        const controls = [...document.querySelectorAll('[data-order-identity]')]
          .filter(control => control.dataset.orderIdentity === identity && !control.disabled);
        const next = controls.find(control => control.dataset.orderStep === String(step)) || controls[0];
        next?.focus({ preventScroll: true });
      });
      row.append(button);
    }
    return row;
  }
  function enableSorting(container, collection, photos = false) {
    window.WizjeSortable.attach(container, {
      canStart: () => !busy && !(photos ? hasFilters() : $('#collection-search').value.trim()),
      onStart: () => status('draggingOrder'),
      onCancel: () => status('blank'),
      onDrop: (order, expected) => mutate(async () => {
        await request(photos ? 'reorder-photos' : 'reorder-collections', {
          ...targetCollection(collection), order, expected,
        });
        invalidateExport(); await reload(); status('orderSaved');
      }),
    });
  }
  function render() {
    window.WizjeSortable.cancel();
    renderPosterSettings();
    renderLibrary();
    renderUploadFilm();
    renderPublication();
    renderImports();
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
        selectedId = collectionKey(collection); selectedPhotos.clear(); $('#upload-form').reset(); render(); status('blank');
      });
      const siblings = state.collections.filter(item => item.year === collection.year);
      const row = document.createElement('div'); row.className = 'collection-order-row';
      row.dataset.sortKey = collection.id; button.dataset.sortHandle = 'true';
      row.append(button, orderControls(siblings, siblings.indexOf(collection), collection));
      row.dataset.collectionName = `${collectionName(collection)} ${collection.year || '2026'}`.toLocaleLowerCase();
      row.hidden = !row.dataset.collectionName.includes($('#collection-search').value.toLocaleLowerCase().trim());
      branches.get(collection.year || '2026').append(row);
    }
    for (const [year, branch] of branches) {
      enableSorting(branch, state.collections.find(item => (item.year || '2026') === year));
    }
    const collection = selected();
    $('#welcome').hidden = Boolean(collection); $('#editor').hidden = !collection;
    if (!collection) return;
    renderLocation(collection);
    $('#collection-title').textContent = collectionTitle(collection);
    $('#photo-count').textContent = t('photoCount', { count: collection.photos.length });
    $('#empty').hidden = collection.photos.length > 0;
    if (selectionCollection !== selectedId) { selectedPhotos.clear(); selectionCollection = selectedId; }
    for (const name of selectedPhotos) if (!collection.photos.some(photo => photo.name === name)) selectedPhotos.delete(name);
    renderGrid(); renderBulkFields();
    if (editingPhoto) renderPhotoEditor();
  }
  function renderGrid() {
    const collection = selected(); if (!collection) return;
    const grid = $('#photo-grid'); grid.replaceChildren();
    enableSorting(grid, collection, true);
    const photos = visiblePhotos(collection);
    photos.forEach(photo => grid.append(renderPhotoCard(photo,collection.photos.indexOf(photo),collection)));
    $('#filter-empty').hidden = photos.length > 0 || !collection.photos.length;
    $('#filter-results').textContent = t('filterResults',{visible:photos.length,total:collection.photos.length});
    updateSelection();
  }
  function updateSelection() {
    const collection = selected(); if (!collection) return;
    const visible = visiblePhotos(collection), count = visible.filter(photo => selectedPhotos.has(photo.name)).length;
    $('#select-visible').checked = visible.length > 0 && count === visible.length;
    $('#select-visible').indeterminate = count > 0 && count < visible.length;
    $('#selection-count').textContent = t('selectedCount',{count:selectedPhotos.size});
    $('#bulk-form').hidden = !selectedPhotos.size;
    for (const card of $('#photo-grid').children) {
      card.dataset.selected = String(selectedPhotos.has(card.dataset.sortKey));
      const input = card.querySelector('input[type="checkbox"]'); if (input) input.checked = selectedPhotos.has(card.dataset.sortKey);
    }
  }
  async function savePhoto(path, collection, photo, changes) {
    setFieldState(path,'saving');
    let result;
    try { result = await request(path, { ...targetCollection(collection), name: photo.name, ...changes }); }
    catch (error) { setFieldState(path,'error',() => mutate(() => savePhoto(path,collection,photo,changes))); throw error; }
    invalidateExport();
    if (!result.photo) { await reload(); return; }
    const currentCollection = state.collections.find(item => collectionKey(item) === collectionKey(collection));
    const index = currentCollection?.photos.findIndex(item => item.name === photo.name) ?? -1;
    if (index < 0) { await reload(); return; }
    currentCollection.photos[index] = result.photo;
    const grid = $('#photo-grid');
    const old = [...grid.children].find(card => card.dataset.sortKey === photo.name);
    if (collectionKey(collection) === selectedId && old) {
      if (photoTools.matches(result.photo,filters(),state.posters || [])) old.replaceWith(renderPhotoCard(result.photo,index,currentCollection));
      else old.remove();
    }
    fieldStates.set(path,{state:'saved'});
    if (editingPhoto?.name === photo.name && editingPhoto.collection === collectionKey(collection)) renderPhotoEditor();
    $('#filter-results').textContent = t('filterResults',{visible:visiblePhotos(currentCollection).length,total:currentCollection.photos.length});
    $('#filter-empty').hidden = visiblePhotos(currentCollection).length > 0 || !currentCollection.photos.length;
    updateSelection();
  }
  function renderPhotoCard(photo, index, collection) {
    const card = document.createElement('article'); card.className = 'photo compact-photo'; card.dataset.sortKey = photo.name;
    const choose = document.createElement('label'); choose.className = 'check-label photo-selection';
    const checkbox = document.createElement('input'); checkbox.type = 'checkbox'; checkbox.checked = selectedPhotos.has(photo.name);
    checkbox.setAttribute('aria-label',`${t('selectVisible')}: ${photo.name}`);
    checkbox.addEventListener('change',() => { if (checkbox.checked) selectedPhotos.add(photo.name); else selectedPhotos.delete(photo.name); updateSelection(); });
    choose.append(checkbox);
    const image = document.createElement('img'); image.src = photo.preview; image.alt = photo.name; image.loading = 'lazy'; image.decoding = 'async'; image.draggable = false;
    const open = () => { if (!busy && !window.WizjeSortable.isDragging()) openPhotoEditor(collection,photo); };
    image.addEventListener('click',open);
    const name = document.createElement('p'); name.className = 'photo-name'; name.textContent = photo.name;
    const badgeRow = document.createElement('div'); badgeRow.className = 'badges'; badges(badgeRow,photo.medium); filmBadges(badgeRow,photo);
    if (photoTools.missing(photo)) { const missing = document.createElement('span'); missing.className = 'missing-badge'; missing.textContent = t('missingData'); badgeRow.append(missing); }
    const edit = document.createElement('button'); edit.type = 'button'; edit.className = 'primary edit-photo'; edit.textContent = t('editPhoto'); edit.addEventListener('click',open);
    card.append(choose,orderControls(collection.photos,index,collection,photo),image,name,referenceRow(photo),badgeRow,edit,photoActions(photo,collection));
    return card;
  }
  function photoActions(photo,collection) {
    const remove = document.createElement('button'); remove.type = 'button'; remove.className = 'secondary photo-action'; remove.append(actionIcon('exit')); remove.title = t('deletePhoto'); remove.setAttribute('aria-label',t('deletePhotoLabel',{name:photo.name}));
    remove.addEventListener('click',() => {
      if (busy) return;
      return mutate(async () => { await request('delete-photo',{...targetCollection(collection),name:photo.name}); invalidateExport(); await reload(); status('photoDeleted',{name:photo.name}); });
    });
    const actions = document.createElement('div'); actions.className = 'photo-actions'; actions.append(remove,permanentButton(photo,{...targetCollection(collection),name:photo.name})); return actions;
  }
  function renderPhotoFields(photo,index,collection) {
      const card = document.createElement('div'); card.className = 'photo-fields';
      const label = document.createElement('label'); label.htmlFor = 'editor-photo-medium'; label.textContent = t('medium');
      const select = document.createElement('select'); select.id = label.htmlFor; options(select,photo.medium);
      select.setAttribute('aria-label',t('photoMedium',{name:photo.name}));
      select.addEventListener('change',() => mutate(async () => { await savePhoto('medium',collection,photo,{medium:select.value || null}); status('saved',{name:photo.name}); }));
      card.append(label,select,fieldStatus('medium'));
      const orientationGroup = document.createElement('fieldset'); orientationGroup.className = 'orientation-picker';
      const orientationLegend = document.createElement('legend'); orientationLegend.textContent = t('orientation');
      const orientationOptions = document.createElement('div'); orientationOptions.className = 'orientation-options';
      for (const value of ['portrait', 'landscape']) {
        const optionLabel = document.createElement('label'); optionLabel.title = t(value);
        const input = document.createElement('input'); input.type = 'radio'; input.name = `photo-orientation-${index}`; input.value = value;
        input.checked = value === (photo.orientation || 'portrait'); input.setAttribute('aria-label', t(value));
        const icon = document.createElement('span'); icon.className = `orientation-icon orientation-icon--${value}`; icon.setAttribute('aria-hidden', 'true');
        input.addEventListener('change', () => mutate(async () => {
          await savePhoto('orientation', collection, photo, { orientation: value }); status('saved', { name: photo.name });
        }));
        optionLabel.append(input, icon); orientationOptions.append(optionLabel);
      }
      orientationGroup.append(orientationLegend, orientationOptions); card.append(orientationGroup,fieldStatus('orientation'));
      const colorLabel = document.createElement('label'); colorLabel.className = 'color-mode-field'; colorLabel.textContent = t('colorMode');
      const colorSelect = document.createElement('select'); colorSelect.setAttribute('aria-label', t('colorMode') + ': ' + photo.name);
      if (!photo.colorMode) {
        const placeholder = document.createElement('option'); placeholder.value = ''; placeholder.textContent = t('unassigned'); placeholder.disabled = true; colorSelect.append(placeholder);
      }
      for (const value of ['color', 'monochrome']) {
        const option = document.createElement('option'); option.value = value; option.textContent = t(value); colorSelect.append(option);
      }
      colorSelect.value = photo.colorMode || '';
      colorSelect.addEventListener('change', () => mutate(async () => {
        await savePhoto('color-mode', collection, photo, { colorMode: colorSelect.value }); status('saved', { name: photo.name });
      }));
      colorLabel.append(colorSelect); card.append(colorLabel,fieldStatus('color-mode'));


      if (photo.medium === 'analog') card.append(filmControls(photo, next => mutate(async () => {
        await savePhoto('film', collection, photo, next); status('filmSaved');
      })));
      card.append(fieldStatus('film'));
      const sizes = document.createElement('fieldset'); sizes.className = 'photo-sizes';
      const legend = document.createElement('legend'); legend.textContent = t('photoSizes'); sizes.append(legend);
      const allLabel = document.createElement('label');
      const all = document.createElement('input'); all.type = 'checkbox'; all.checked = photo.posterSizes == null;
      const allText = document.createElement('span'); allText.textContent = t('allSizes');
      allLabel.append(all, allText); sizes.append(allLabel);
      const choices = [];
      for (const poster of state.posters || []) {
        const row = document.createElement('label');
        const input = document.createElement('input'); input.type = 'checkbox'; input.value = poster.name;
        input.checked = all.checked || photo.posterSizes.includes(poster.name); input.disabled = all.checked; input.dataset.sizeInherited = String(all.checked);
        const text = document.createElement('span'); text.textContent = poster.name;
        const match = poster.name.match(/^(\d+(?:[.,]\d+)?)\s*[×xX]\s*(\d+(?:[.,]\d+)?)\s*(?:cm)?$/);
        if (match) {
          const dims = match.slice(1).map(v => Number(v.replace(',', '.'))).sort((a, b) => a - b);
          if (photo.orientation === 'landscape') dims.reverse();
          const hint = document.createElement('small');
          hint.textContent = t('marginHint', { x: +(dims[0] * .08).toFixed(2), y: +(dims[1] * .08).toFixed(2) }); text.append(hint);
        }
        row.append(input, text); sizes.append(row); choices.push(input);
      }
      all.addEventListener('change', () => choices.forEach(input => { input.disabled = all.checked; input.dataset.sizeInherited = String(all.checked); if (all.checked) input.checked = true; }));
      const note = document.createElement('p'); note.className = 'crop-note'; note.textContent = t('noSizesHint'); sizes.append(note);
      const saveSizes = document.createElement('button'); saveSizes.type = 'button'; saveSizes.className = 'secondary'; saveSizes.textContent = t('savePhotoSizes');
      saveSizes.addEventListener('click', () => mutate(async () => {
        await savePhoto('photo-sizes', collection, photo, { posterSizes: all.checked ? null : choices.filter(input => input.checked).map(input => input.value) }); status('saved', { name: photo.name });
      }));
      sizes.append(saveSizes); card.append(sizes);
      card.append(fieldStatus('photo-sizes'),photoActions(photo,collection));
      return card;
  }
  function fieldStatus(path) {
    const node = document.createElement('div'); node.className = 'field-status'; node.dataset.field = path; node.setAttribute('role','status');
    fillFieldStatus(node,path); return node;
  }
  function fillFieldStatus(node,path) {
    node.replaceChildren(); const entry = fieldStates.get(path); if (!entry) return;
    node.dataset.state = entry.state;
    const label = document.createElement('span'); label.textContent = t(entry.state === 'saving' ? 'saving' : entry.state === 'error' ? 'fieldFailed' : 'fieldSaved'); node.append(label);
    if (entry.retry) { const button = document.createElement('button'); button.type = 'button'; button.className = 'quiet'; button.textContent = t('retry'); button.addEventListener('click',entry.retry); node.append(button); }
  }
  function setFieldState(path,value,retry=null) {
    fieldStates.set(path,{state:value,retry});
    for (const node of $('#photo-editor-fields').querySelectorAll('.field-status')) if (node.dataset.field === path) fillFieldStatus(node,path);
  }
  function openPhotoEditor(collection,photo) {
    const next = {collection:collectionKey(collection),name:photo.name};
    if (editingPhoto?.name !== next.name || editingPhoto?.collection !== next.collection) fieldStates.clear();
    editingPhoto = next; renderPhotoEditor();
    if (!$('#photo-dialog').open) $('#photo-dialog').showModal();
  }
  function renderPhotoEditor() {
    if (!editingPhoto) return;
    const collection = state.collections.find(item => collectionKey(item) === editingPhoto.collection);
    const photo = collection?.photos.find(item => item.name === editingPhoto.name);
    if (!photo) { editingPhoto = null; if ($('#photo-dialog').open) $('#photo-dialog').close(); return; }
    $('#photo-editor-title').textContent = `${photo.name} · ${collectionTitle(collection)}`;
    $('#photo-editor-fields').replaceChildren(renderPhotoFields(photo,collection.photos.indexOf(photo),collection));
    const image = $('#admin-preview-image'), source = photo.detail || photo.preview;
    if (image.getAttribute('src') !== source) {
      $('#preview-load-state').textContent = t('loading');
      image.onload = () => { $('#preview-load-state').textContent = ''; };
      image.onerror = () => { $('#preview-load-state').textContent = t('previewFailed'); };
      image.src = source;
    }
    image.alt = photo.name;
    const size = $('#preview-size'), previous = size.value; size.replaceChildren();
    let posters = (state.posters || []).filter(poster => photo.posterSizes == null || photo.posterSizes.includes(poster.name));
    if (!posters.length) posters = state.posters?.length ? state.posters : [{name:'50 × 70 cm'}];
    for (const poster of posters) { const option = document.createElement('option'); option.value = option.textContent = poster.name; size.append(option); }
    size.value = posters.some(poster => poster.name === previous) ? previous : posters[0].name;
    const visible = collectionKey(collection) === selectedId ? visiblePhotos(collection) : collection.photos;
    const index = visible.findIndex(item => item.name === photo.name);
    $('#editor-position').textContent = `${index < 0 ? '—' : index+1} / ${visible.length}`;
    updateAdminPreview();
  }
  function updateAdminPreview() {
    if (!editingPhoto) return;
    const collection = state.collections.find(item => collectionKey(item) === editingPhoto.collection);
    const photo = collection?.photos.find(item => item.name === editingPhoto.name); if (!photo) return;
    const fit = photoTools.fit(photo,$('#preview-size').value,$('#preview-margins').checked);
    const artwork = $('#admin-artwork'); artwork.dataset.frame = String($('#preview-frame').checked);
    artwork.style.setProperty('--paper-ratio',fit.paperWidth/fit.paperHeight);
    artwork.style.setProperty('--mat-color',$('#preview-color').value === 'white' ? '#f5f3ee' : '#050505');
    const image = $('#admin-preview-image'); image.style.width = `${100*fit.w/fit.paperWidth}%`; image.style.height = `${100*fit.h/fit.paperHeight}%`;
    const format = value => new Intl.NumberFormat(language,{maximumFractionDigits:2}).format(value);
    $('#preview-dimensions').textContent = t('previewDimensions',Object.fromEntries(['w','h','x','y'].map(key => [key,format(fit[key])])));
  }
  function navigateEditor(direction) {
    if (busy || !editingPhoto) return;
    const collection = state.collections.find(item => collectionKey(item) === editingPhoto.collection); if (!collection) return;
    const photos = collectionKey(collection) === selectedId ? visiblePhotos(collection) : collection.photos; if (!photos.length) return;
    const index = photos.findIndex(photo => photo.name === editingPhoto.name);
    const next = index < 0 ? (direction > 0 ? 0 : photos.length-1) : (index+direction+photos.length)%photos.length;
    openPhotoEditor(collection,photos[next]);
  }
  function addSelect(host,id,label,entries) {
    const group = document.createElement('label'), title = document.createElement('span'); title.textContent = label;
    const select = document.createElement('select'); select.id = id;
    for (const [value,name] of entries) { const option = document.createElement('option'); option.value = value; option.textContent = name; select.append(option); }
    group.append(title,select); host.append(group); return select;
  }
  function renderBulkFields() {
    const host = $('#bulk-fields'); host.replaceChildren();
    const keep = ['',t('unchanged')];
    addSelect(host,'bulk-medium',t('medium'),[keep,['analog','ANALOG'],['digital','DIGITAL'],['__clear__',t('clearValue')]]);
    addSelect(host,'bulk-orientation',t('orientation'),[keep,['portrait',t('portrait')],['landscape',t('landscape')]]);
    addSelect(host,'bulk-color',t('colorMode'),[keep,['color',t('color')],['monochrome',t('monochrome')]]);
    addSelect(host,'bulk-film',t('film'),[keep,['__clear__',t('clearValue')],...(state.films || []).map(film => [film.id,film.name])]);
    addSelect(host,'bulk-iso',t('filmIso'),[keep,['__clear__',t('clearValue')],...(state.isoValues || []).map(iso => [String(iso),String(iso)])]);
    const mode = addSelect(host,'bulk-size-mode',t('photoSizes'),[['',t('sizeKeep')],['inherit',t('sizeInherit')],['choose',t('sizeChoose')],['none',t('sizeNone')]]);
    const sizes = document.createElement('fieldset'); sizes.id = 'bulk-size-choices'; sizes.className = 'bulk-size-choices'; sizes.hidden = true;
    for (const poster of state.posters || []) { const label = document.createElement('label'); label.className = 'check-label'; const input = document.createElement('input'); input.type = 'checkbox'; input.value = poster.name; const text = document.createElement('span'); text.textContent = poster.name; label.append(input,text); sizes.append(label); }
    mode.addEventListener('change',() => { sizes.hidden = mode.value !== 'choose'; }); host.append(sizes);
    addSelect(host,'bulk-target',t('moveTo'),[['',t('keepCollection')],...state.collections.filter(collection => collectionKey(collection) !== selectedId).map(collection => [collectionKey(collection),collectionTitle(collection)])]);
  }
  function renderPublication() {
    const publication = state.publication, changes = publication?.changes;
    if (publication?.dirty) { $('#export-download').hidden = true; $('#export-details').hidden = true; }
    $('#publication-state').textContent = t(!publication?.lastExport ? 'packageNone' : publication.dirty ? 'packageDirty' : 'packageClean');
    $('#publication-state').dataset.dirty = String(publication?.dirty !== false);
    const list = $('#publication-changes'); list.replaceChildren();
    if (!publication?.dirty || !changes) return;
    const add = value => { const item = document.createElement('li'); item.textContent = value; list.append(item); };
    add(t('packageChanges',changes));
    if (changes.collections) add(t('packageCollections',{count:changes.collections}));
    if (changes.prices) add(t('packagePrices'));
    if (!changes.added && !changes.removed && !changes.changed && !changes.collections && !changes.prices) add(t('packageAppearance'));
  }
  function updateUndoButtons() { for (const id of ['undo-change','undo-editor-change']) $('#'+id).hidden = !undoToken; }
  function undoChange() {
    if (!undoToken) return;
    return mutate(async () => { await request('undo',{token:undoToken}); undoToken = null; fieldStates.clear(); updateUndoButtons(); invalidateExport(); await reload(); status('undone'); });
  }
  $('#undo-change').addEventListener('click',undoChange);
  $('#undo-editor-change').addEventListener('click',undoChange);
  $('#retry-change').addEventListener('click',() => { if (retryAction) return mutate(retryAction); });
  $('#close-photo-editor').addEventListener('click',() => $('#photo-dialog').close());
  $('#photo-dialog').addEventListener('close',() => { editingPhoto = null; });
  $('#previous-editor-photo').addEventListener('click',() => navigateEditor(-1));
  $('#next-editor-photo').addEventListener('click',() => navigateEditor(1));
  $('#photo-dialog').addEventListener('keydown',event => { if (['INPUT','SELECT','TEXTAREA'].includes(event.target.tagName)) return; if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') { event.preventDefault(); navigateEditor(event.key === 'ArrowLeft' ? -1 : 1); } });
  for (const id of ['preview-size','preview-margins','preview-frame','preview-color']) $('#'+id).addEventListener('change',updateAdminPreview);
  for (const id of ['photo-search','photo-filter-medium','photo-filter-orientation','photo-filter-color','photo-filter-available','photo-filter-missing']) $('#'+id).addEventListener(id === 'photo-search' ? 'input' : 'change',renderGrid);
  $('#reset-photo-filters').addEventListener('click',() => { for (const id of ['photo-search','photo-filter-medium','photo-filter-orientation','photo-filter-color','photo-filter-available']) $('#'+id).value = ''; $('#photo-filter-missing').checked = false; renderGrid(); });
  $('#select-visible').addEventListener('change',() => { const collection = selected(); if (!collection) return; for (const photo of visiblePhotos(collection)) { if ($('#select-visible').checked) selectedPhotos.add(photo.name); else selectedPhotos.delete(photo.name); } updateSelection(); });
  $('#clear-selection').addEventListener('click',() => { selectedPhotos.clear(); updateSelection(); });
  $('#collection-search').addEventListener('input',() => { const query = $('#collection-search').value.toLocaleLowerCase().trim(); for (const row of $('#collections').querySelectorAll('.collection-order-row')) row.hidden = !row.dataset.collectionName.includes(query); });
  $('#bulk-form').addEventListener('submit',event => {
    event.preventDefault(); const collection = selected(); if (!collection || !selectedPhotos.size || busy) return;
    const changes = {};
    for (const [id,key] of [['bulk-medium','medium'],['bulk-orientation','orientation'],['bulk-color','colorMode'],['bulk-film','film'],['bulk-iso','iso']]) { const value = $('#'+id).value; if (value) changes[key] = value === '__clear__' ? null : key === 'iso' ? Number(value) : value; }
    const sizes = $('#bulk-size-mode').value;
    if (sizes) changes.posterSizes = sizes === 'inherit' ? null : sizes === 'none' ? [] : [...$('#bulk-size-choices').querySelectorAll('input')].filter(input => input.checked).map(input => input.value);
    const destination = $('#bulk-target').value.split('/');
    const data = {...targetCollection(collection),names:[...selectedPhotos],changes};
    if (destination.length === 2) data.target = {year:destination[0],collection:destination[1]};
    return mutate(async () => { const result = await request('bulk-photos',data); selectedPhotos.clear(); invalidateExport(); await reload(); status('bulkSaved',result); });
  });
  async function reload() {
    state = await request('state');
    if (!state.collections.some(collection => collectionKey(collection) === selectedId)) selectedId = (state.collections[0] ? collectionKey(state.collections[0]) : null);
    render();
  }
  async function mutate(action) {
    if (busy) return;
    lock(true); status('saving');
    try { await action(); retryAction = null; $('#retry-change').hidden = true; if (lastStatus.key === 'saving') status('blank'); return true; }
    catch (error) { retryAction = action; $('#retry-change').hidden = false; status('error', { message: error.message }, true); return false; }
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
  function renderImports() {
    const list = $('#upload-progress'); list.replaceChildren();
    for (const item of importItems) {
      const row = document.createElement('li'); item.row = row;
      const name = document.createElement('span'); name.textContent = item.file.name;
      item.label = document.createElement('span'); item.progress = document.createElement('progress'); item.progress.max = 100;
      row.append(name,item.label,item.progress); list.append(row); updateImportItem(item);
    }
    $('#retry-uploads').hidden = !importItems.some(item => item.state === 'error');
  }
  function updateImportItem(item) {
    item.row.dataset.state = item.state;
    const key = {waiting:'uploadWaiting',uploading:'uploadSending',processing:'uploadProcessing',done:'uploadDone',error:'uploadFailed'}[item.state];
    item.label.textContent = t(key,{percent:item.percent || 0,message:item.error || ''});
    item.progress.hidden = item.state === 'error';
    if (item.state === 'processing') item.progress.removeAttribute('value');
    else item.progress.value = item.state === 'done' ? 100 : item.percent || 0;
  }
  function uploadRequest(path,body,progress) {
    return new Promise((resolve,reject) => {
      const xhr = new XMLHttpRequest(); xhr.open('POST','/admin/api/'+path); xhr.timeout = 180000;
      xhr.setRequestHeader('X-Wizje-CSRF',state.csrf); xhr.setRequestHeader('Accept-Language',language); xhr.setRequestHeader('Content-Type','application/octet-stream');
      xhr.upload.onprogress = event => { if (event.lengthComputable) progress(event.loaded,event.total,false); };
      xhr.upload.onload = () => progress(body.size,body.size,true);
      xhr.onload = () => {
        try {
          const result = JSON.parse(xhr.responseText);
          if (xhr.status === 401) window.location.assign('/admin');
          if (xhr.status < 200 || xhr.status >= 300) throw new Error(result.error || t('failed'));
          if (result.publication) { state.publication = result.publication; renderPublication(); }
          undoToken = null; updateUndoButtons();
          resolve(result);
        } catch (error) { reject(error); }
      };
      xhr.onerror = xhr.ontimeout = () => reject(new Error(t('failed')));
      xhr.send(body);
    });
  }
  async function runImports(items) {
    const params = new URLSearchParams(importContext.params);
    const groups = [];
    for (const item of items) {
      item.error = ''; item.percent = 0; item.state = 'waiting';
      if (!item.file.size || item.file.size > 50*1024*1024) { item.state = 'error'; item.error = t('tooLarge'); continue; }
      let group = groups[groups.length-1];
      if (!group || group.bytes+item.file.size > 50*1024*1024 || group.items.length >= 50) { group = {items:[],bytes:0}; groups.push(group); }
      group.items.push(item); group.bytes += item.file.size;
    }
    renderImports();
    for (const group of groups) {
      const metadata = new TextEncoder().encode(JSON.stringify(group.items.map(item => ({name:item.file.name,size:item.file.size}))));
      const header = new ArrayBuffer(4); new DataView(header).setUint32(0,metadata.byteLength);
      const payload = new Blob([header,metadata,...group.items.map(item => item.file)]);
      const progress = (loaded,total,processing) => {
        let offset = 4+metadata.byteLength;
        for (const item of group.items) { item.state = processing ? 'processing' : 'uploading'; item.percent = Math.max(0,Math.min(100,Math.round(100*(loaded-offset)/item.file.size))); offset += item.file.size; updateImportItem(item); }
      };
      try {
        await uploadRequest('upload-batch?'+params,payload,progress);
        for (const item of group.items) { item.state = 'done'; updateImportItem(item); }
      } catch {
        // The batch is atomic. Retry its files separately to identify the bad file.
        let known = new Set();
        try { const fresh = await request('state'); const collection = fresh.collections.find(value => collectionKey(value) === importContext.collection); known = new Set(collection?.photos.map(photo => photo.name) || []); } catch {}
        for (const item of group.items) {
          if (known.has(item.file.name) && !importContext.existing.has(item.file.name)) { item.state = 'done'; updateImportItem(item); continue; }
          item.state = 'uploading'; item.percent = 0; updateImportItem(item);
          const single = new URLSearchParams(params); single.set('name',item.file.name);
          try {
            await uploadRequest('upload?'+single,item.file,(loaded,total,processing) => { item.state = processing ? 'processing' : 'uploading'; item.percent = Math.round(100*loaded/total); updateImportItem(item); });
            item.state = 'done'; known.add(item.file.name);
          } catch (error) { item.state = 'error'; item.error = error.message; }
          updateImportItem(item);
        }
      }
    }
    invalidateExport(); $('#upload-form').reset(); await reload(); renderImports();
    const count = importItems.filter(item => item.state === 'done').length;
    status('uploaded',{count});
  }
  $('#upload-form').addEventListener('submit',event => {
    event.preventDefault(); const collection = selected(), files = [...$('#photos').files], medium = $('input[name="upload-medium"]:checked')?.value;
    if (busy || !collection || !files.length || !medium) return;
    importContext = {collection:collectionKey(collection),existing:new Set(collection.photos.map(photo => photo.name)),params:{...targetCollection(collection),medium,orientation:$('input[name="upload-orientation"]:checked').value,colorMode:$('#upload-color-mode').value}};
    if (medium === 'analog') { if (uploadDetails.film) importContext.params.film = uploadDetails.film; if (uploadDetails.iso) importContext.params.iso = uploadDetails.iso; }
    importItems = files.map(file => ({file,state:'waiting',percent:0}));
    return mutate(() => runImports(importItems));
  });
  $('#retry-uploads').addEventListener('click',() => { const failed = importItems.filter(item => item.state === 'error'); if (failed.length && importContext) return mutate(() => runImports(failed)); });
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
  document.querySelectorAll('[data-language]').forEach(button => button.addEventListener('click', () => setLanguage(button.dataset.language)));
  async function start() {
    try {
      setLanguage(language);
      await reload();
      status('ready');
    } catch (error) {
      status('error', { message: error.message }, true);
    }
  }
  start();
})();
