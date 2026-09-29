/* Rotating photo drum with an ornamental frame on the center photograph. */
(() => {
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const imageLoads = new Map();
  const galleries = [];
  const letterStyles = ['z', 'w', 'i', 'd', 'y'];
  const copy = () => translations[document.documentElement.lang] || translations.en;

  // A UI deterrent only: public images remain accessible to the browser.
  function discouragePhotoSaving(surface) {
    for (const type of ['contextmenu', 'dragstart']) {
      surface.addEventListener(type, event => event.preventDefault());
    }
  }

  function loadPhoto(photo) {
    if (!imageLoads.has(photo.src)) {
      const pending = new Promise((resolve, reject) => {
        const image = new Image();
        const timeout = setTimeout(() => finish(new Error('Image timeout')), 15000);
        function finish(error) {
          clearTimeout(timeout);
          image.onload = image.onerror = null;
          if (error) reject(error);
          else resolve();
        }
        image.onload = async () => {
          try {
            if (image.decode) await image.decode();
            finish();
          } catch (error) {
            finish(error);
          }
        };
        image.onerror = () => finish(new Error('Image unavailable'));
        image.src = photo.src;
      }).catch((error) => {
        imageLoads.delete(photo.src);
        throw error;
      });
      imageLoads.set(photo.src, pending);
    }
    return imageLoads.get(photo.src);
  }

  function paint(surface, photo) {
    surface.style.backgroundImage = `url(${JSON.stringify(photo.src)})`;
    surface.style.backgroundSize = 'cover';
    surface.style.backgroundPosition = 'center';
    if (photo.crop) {
      const [x, y, width, height] = photo.crop;
      const [sourceWidth, sourceHeight] = photo.sourceSize;
      surface.style.backgroundSize = `${sourceWidth / width * 100}% ${sourceHeight / height * 100}%`;
      surface.style.backgroundPosition = `${x / (sourceWidth - width) * 100}% ${y / (sourceHeight - height) * 100}%`;
    }
  }

  function pose(slot, count) {
    const distance = Math.abs(slot);
    const direction = Math.sign(slot);
    const visible = distance < 2 && !(count === 2 && slot < 0);
    const x = distance === 0 ? 0 : direction * (distance === 1 ? 92 : 178);
    const depth = distance === 0 ? 0 : distance === 1 ? -85 : -170;
    const angle = -direction * (distance === 1 ? 34 : 58);
    const scale = distance === 0 ? 1 : distance === 1 ? .9 : .74;
    return {
      transform: `translate(-50%, -50%) translateX(${x}%) translateZ(${depth}px) rotateY(${angle}deg) scale(${scale})`,
      opacity: visible ? (slot === 0 ? 1 : .48) : 0,
      zIndex: slot === 0 ? 3 : distance === 1 ? 2 : 0,
    };
  }

  const frameCorner = `<svg viewBox="0 0 64 64" aria-hidden="true" focusable="false">
    <path d="M6 58V6h52M12 52V12h40" fill="none" stroke="#503313" stroke-width="5"/>
    <path d="M6 58V6h52M12 52V12h40" fill="none" stroke="#d4ad58" stroke-width="2"/>
    <path d="M8 8C24 4 34 8 37 17C40 27 29 31 25 23C22 17 29 13 32 18M8 8C4 24 8 34 17 37C27 40 31 29 23 25C17 22 13 29 18 32" fill="none" stroke="#624319" stroke-width="6"/>
    <path d="M8 8C24 4 34 8 37 17C40 27 29 31 25 23C22 17 29 13 32 18M8 8C4 24 8 34 17 37C27 40 31 29 23 25C17 22 13 29 18 32" fill="none" stroke="#e0bd70" stroke-width="3"/>
    <path d="M11 11C18 9 23 13 26 26C13 23 9 18 11 11ZM17 8C22 0 36 1 42 7C31 7 28 14 17 8ZM8 17C0 22 1 36 7 42C7 31 14 28 8 17Z" fill="#ba8e3f" stroke="#ecd29a" stroke-width="1"/>
    <path d="M13 13L25 25M21 7L36 6M7 21L6 36" fill="none" stroke="#795222" stroke-width="1.5"/>
    <path d="M9 43C20 39 24 43 22 48C20 53 14 49 17 46M43 9C39 20 43 24 48 22C53 20 49 14 46 17" fill="none" stroke="#d4ad58" stroke-width="2"/>
    <circle cx="8" cy="8" r="4" fill="#edcf87" stroke="#876027" stroke-width="1.5"/>
  </svg>`;

  // Set together with its locally generated QR code.
  const instagramProfile = {"username": "twoj_profil", "url": "https://www.instagram.com/", "example": true, "qr": "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 35 35\" aria-hidden=\"true\" shape-rendering=\"crispEdges\"><rect width=\"35\" height=\"35\" fill=\"#fff\"/><path d=\"M5 5h1v1h-1zM6 5h1v1h-1zM7 5h1v1h-1zM8 5h1v1h-1zM9 5h1v1h-1zM10 5h1v1h-1zM11 5h1v1h-1zM21 5h1v1h-1zM23 5h1v1h-1zM24 5h1v1h-1zM25 5h1v1h-1zM26 5h1v1h-1zM27 5h1v1h-1zM28 5h1v1h-1zM29 5h1v1h-1zM5 6h1v1h-1zM11 6h1v1h-1zM14 6h1v1h-1zM16 6h1v1h-1zM17 6h1v1h-1zM18 6h1v1h-1zM19 6h1v1h-1zM20 6h1v1h-1zM21 6h1v1h-1zM23 6h1v1h-1zM29 6h1v1h-1zM5 7h1v1h-1zM7 7h1v1h-1zM8 7h1v1h-1zM9 7h1v1h-1zM11 7h1v1h-1zM13 7h1v1h-1zM16 7h1v1h-1zM19 7h1v1h-1zM20 7h1v1h-1zM23 7h1v1h-1zM25 7h1v1h-1zM26 7h1v1h-1zM27 7h1v1h-1zM29 7h1v1h-1zM5 8h1v1h-1zM7 8h1v1h-1zM8 8h1v1h-1zM9 8h1v1h-1zM11 8h1v1h-1zM13 8h1v1h-1zM15 8h1v1h-1zM16 8h1v1h-1zM18 8h1v1h-1zM19 8h1v1h-1zM20 8h1v1h-1zM23 8h1v1h-1zM25 8h1v1h-1zM26 8h1v1h-1zM27 8h1v1h-1zM29 8h1v1h-1zM5 9h1v1h-1zM7 9h1v1h-1zM8 9h1v1h-1zM9 9h1v1h-1zM11 9h1v1h-1zM13 9h1v1h-1zM15 9h1v1h-1zM16 9h1v1h-1zM19 9h1v1h-1zM21 9h1v1h-1zM23 9h1v1h-1zM25 9h1v1h-1zM26 9h1v1h-1zM27 9h1v1h-1zM29 9h1v1h-1zM5 10h1v1h-1zM11 10h1v1h-1zM13 10h1v1h-1zM15 10h1v1h-1zM16 10h1v1h-1zM17 10h1v1h-1zM18 10h1v1h-1zM20 10h1v1h-1zM23 10h1v1h-1zM29 10h1v1h-1zM5 11h1v1h-1zM6 11h1v1h-1zM7 11h1v1h-1zM8 11h1v1h-1zM9 11h1v1h-1zM10 11h1v1h-1zM11 11h1v1h-1zM13 11h1v1h-1zM15 11h1v1h-1zM17 11h1v1h-1zM19 11h1v1h-1zM21 11h1v1h-1zM23 11h1v1h-1zM24 11h1v1h-1zM25 11h1v1h-1zM26 11h1v1h-1zM27 11h1v1h-1zM28 11h1v1h-1zM29 11h1v1h-1zM13 12h1v1h-1zM15 12h1v1h-1zM16 12h1v1h-1zM17 12h1v1h-1zM20 12h1v1h-1zM21 12h1v1h-1zM5 13h1v1h-1zM7 13h1v1h-1zM8 13h1v1h-1zM9 13h1v1h-1zM10 13h1v1h-1zM11 13h1v1h-1zM14 13h1v1h-1zM16 13h1v1h-1zM17 13h1v1h-1zM18 13h1v1h-1zM19 13h1v1h-1zM20 13h1v1h-1zM21 13h1v1h-1zM23 13h1v1h-1zM24 13h1v1h-1zM25 13h1v1h-1zM26 13h1v1h-1zM27 13h1v1h-1zM9 14h1v1h-1zM13 14h1v1h-1zM14 14h1v1h-1zM15 14h1v1h-1zM16 14h1v1h-1zM17 14h1v1h-1zM21 14h1v1h-1zM22 14h1v1h-1zM24 14h1v1h-1zM28 14h1v1h-1zM5 15h1v1h-1zM9 15h1v1h-1zM10 15h1v1h-1zM11 15h1v1h-1zM17 15h1v1h-1zM20 15h1v1h-1zM21 15h1v1h-1zM22 15h1v1h-1zM23 15h1v1h-1zM24 15h1v1h-1zM25 15h1v1h-1zM26 15h1v1h-1zM28 15h1v1h-1zM29 15h1v1h-1zM7 16h1v1h-1zM8 16h1v1h-1zM9 16h1v1h-1zM10 16h1v1h-1zM14 16h1v1h-1zM17 16h1v1h-1zM19 16h1v1h-1zM22 16h1v1h-1zM24 16h1v1h-1zM29 16h1v1h-1zM7 17h1v1h-1zM8 17h1v1h-1zM9 17h1v1h-1zM11 17h1v1h-1zM12 17h1v1h-1zM13 17h1v1h-1zM14 17h1v1h-1zM17 17h1v1h-1zM18 17h1v1h-1zM19 17h1v1h-1zM20 17h1v1h-1zM21 17h1v1h-1zM22 17h1v1h-1zM23 17h1v1h-1zM24 17h1v1h-1zM25 17h1v1h-1zM27 17h1v1h-1zM28 17h1v1h-1zM29 17h1v1h-1zM5 18h1v1h-1zM7 18h1v1h-1zM8 18h1v1h-1zM9 18h1v1h-1zM10 18h1v1h-1zM12 18h1v1h-1zM13 18h1v1h-1zM14 18h1v1h-1zM17 18h1v1h-1zM18 18h1v1h-1zM21 18h1v1h-1zM22 18h1v1h-1zM24 18h1v1h-1zM26 18h1v1h-1zM28 18h1v1h-1zM5 19h1v1h-1zM7 19h1v1h-1zM8 19h1v1h-1zM11 19h1v1h-1zM12 19h1v1h-1zM15 19h1v1h-1zM19 19h1v1h-1zM20 19h1v1h-1zM22 19h1v1h-1zM23 19h1v1h-1zM24 19h1v1h-1zM25 19h1v1h-1zM26 19h1v1h-1zM28 19h1v1h-1zM29 19h1v1h-1zM5 20h1v1h-1zM7 20h1v1h-1zM8 20h1v1h-1zM9 20h1v1h-1zM10 20h1v1h-1zM12 20h1v1h-1zM13 20h1v1h-1zM14 20h1v1h-1zM15 20h1v1h-1zM16 20h1v1h-1zM19 20h1v1h-1zM21 20h1v1h-1zM22 20h1v1h-1zM24 20h1v1h-1zM25 20h1v1h-1zM29 20h1v1h-1zM5 21h1v1h-1zM9 21h1v1h-1zM10 21h1v1h-1zM11 21h1v1h-1zM16 21h1v1h-1zM17 21h1v1h-1zM18 21h1v1h-1zM21 21h1v1h-1zM22 21h1v1h-1zM23 21h1v1h-1zM24 21h1v1h-1zM25 21h1v1h-1zM27 21h1v1h-1zM13 22h1v1h-1zM14 22h1v1h-1zM16 22h1v1h-1zM17 22h1v1h-1zM18 22h1v1h-1zM20 22h1v1h-1zM21 22h1v1h-1zM25 22h1v1h-1zM26 22h1v1h-1zM5 23h1v1h-1zM6 23h1v1h-1zM7 23h1v1h-1zM8 23h1v1h-1zM9 23h1v1h-1zM10 23h1v1h-1zM11 23h1v1h-1zM15 23h1v1h-1zM18 23h1v1h-1zM19 23h1v1h-1zM21 23h1v1h-1zM23 23h1v1h-1zM25 23h1v1h-1zM27 23h1v1h-1zM28 23h1v1h-1zM29 23h1v1h-1zM5 24h1v1h-1zM11 24h1v1h-1zM13 24h1v1h-1zM15 24h1v1h-1zM21 24h1v1h-1zM25 24h1v1h-1zM26 24h1v1h-1zM5 25h1v1h-1zM7 25h1v1h-1zM8 25h1v1h-1zM9 25h1v1h-1zM11 25h1v1h-1zM13 25h1v1h-1zM16 25h1v1h-1zM17 25h1v1h-1zM18 25h1v1h-1zM19 25h1v1h-1zM20 25h1v1h-1zM21 25h1v1h-1zM22 25h1v1h-1zM23 25h1v1h-1zM24 25h1v1h-1zM25 25h1v1h-1zM27 25h1v1h-1zM5 26h1v1h-1zM7 26h1v1h-1zM8 26h1v1h-1zM9 26h1v1h-1zM11 26h1v1h-1zM13 26h1v1h-1zM14 26h1v1h-1zM16 26h1v1h-1zM23 26h1v1h-1zM25 26h1v1h-1zM26 26h1v1h-1zM27 26h1v1h-1zM28 26h1v1h-1zM29 26h1v1h-1zM5 27h1v1h-1zM7 27h1v1h-1zM8 27h1v1h-1zM9 27h1v1h-1zM11 27h1v1h-1zM13 27h1v1h-1zM15 27h1v1h-1zM18 27h1v1h-1zM20 27h1v1h-1zM21 27h1v1h-1zM26 27h1v1h-1zM27 27h1v1h-1zM29 27h1v1h-1zM5 28h1v1h-1zM11 28h1v1h-1zM14 28h1v1h-1zM16 28h1v1h-1zM19 28h1v1h-1zM20 28h1v1h-1zM21 28h1v1h-1zM22 28h1v1h-1zM24 28h1v1h-1zM25 28h1v1h-1zM26 28h1v1h-1zM29 28h1v1h-1zM5 29h1v1h-1zM6 29h1v1h-1zM7 29h1v1h-1zM8 29h1v1h-1zM9 29h1v1h-1zM10 29h1v1h-1zM11 29h1v1h-1zM13 29h1v1h-1zM14 29h1v1h-1zM15 29h1v1h-1zM16 29h1v1h-1zM17 29h1v1h-1zM18 29h1v1h-1zM19 29h1v1h-1zM24 29h1v1h-1zM25 29h1v1h-1zM26 29h1v1h-1zM27 29h1v1h-1zM28 29h1v1h-1zM29 29h1v1h-1z\" fill=\"#000\"/></svg>"};
  let detailDialog = null;
  let detailPhoto = null;
  let detailCollection = null;
  let detailOpener = null;
  let detailOpen = false;

  function collectionHeading(heading, title, identity = title) {
    heading.replaceChildren();
    const accessible = document.createElement('span'); accessible.className = 'sr-only'; accessible.textContent = title;
    heading.append(accessible); heading.style.setProperty('--letters', Array.from(title).length);
    // Stable per collection; shuffled batches keep all five fonts in the mix.
    let seed = 2166136261;
    for (const character of identity) seed = Math.imul(seed ^ character.codePointAt(0), 16777619) >>> 0;
    const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
    let batch = [], previous = -1;
    Array.from(title).forEach(character => {
      if (!batch.length) {
        batch = letterStyles.map((_, index) => index);
        for (let i = batch.length - 1; i > 0; i--) {
          const j = Math.floor(random() * (i + 1));
          [batch[i], batch[j]] = [batch[j], batch[i]];
        }
        if (batch[batch.length - 1] === previous) [batch[0], batch[batch.length - 1]] = [batch[batch.length - 1], batch[0]];
      }
      const slot = batch.pop(); previous = slot;
      const letter = document.createElement('span'); letter.className = `collection__letter collection__letter--${letterStyles[slot]}`;
      letter.setAttribute('aria-hidden', 'true');
      letter.textContent = slot === 1 || slot === 4 ? character.toLocaleLowerCase() : character.toLocaleUpperCase();
      heading.append(letter);
    });
  }
  function detailCopy() {
    if (!detailDialog || !detailPhoto) return;
    const find = selector => detailDialog.querySelector(selector);
    detailDialog.querySelectorAll('[data-detail-copy]').forEach(node => { node.textContent = copy()[node.dataset.detailCopy]; });
    find('.photo-detail__close').setAttribute('aria-label', copy().closePreview);
    const order = find('.photo-detail__order');
    order.hidden = !instagramProfile;
    if (instagramProfile) {
      order.querySelectorAll('a').forEach(link => { link.href = instagramProfile.url; });
      find('.photo-detail__instagram-handle').textContent = '@' + instagramProfile.username;
      find('.photo-detail__qr').setAttribute('aria-label', copy().instagramQr);
      find('.photo-detail__example').hidden = !instagramProfile.example;
    }
    const title = copy()[`${detailCollection.id}Title`] || detailCollection.title;
    collectionHeading(find('#photo-detail-title'), title, detailCollection.id);
    find('.photo-detail__year').textContent = detailCollection.year;
    find('.photo-detail__image').alt = `${title} — ${copy().photoLabel} ${detailCollection.photos.indexOf(detailPhoto) + 1}`;
    const dimensions = detailPhoto.sourceWidth && detailPhoto.sourceHeight
      ? `${detailPhoto.sourceWidth} × ${detailPhoto.sourceHeight} px` : copy().notSpecified;
    find('[data-detail-dimensions]').textContent = dimensions;
    const badges = find('.photo-detail__badges'); badges.replaceChildren();
    const analog = detailPhoto.medium === 'analog';
    function badge(label, className) {
      const node = document.createElement('span'); node.className = `photo-medium ${className}`; node.textContent = label; badges.append(node);
    }
    if (['analog', 'digital'].includes(detailPhoto.medium)) badge(detailPhoto.medium.toUpperCase(), `photo-medium--${detailPhoto.medium}`);
    else badge(copy().notSpecified, '');
    find('.photo-detail__film').hidden = !analog;
    const film = find('[data-detail-film]'); film.textContent = detailPhoto.film || copy().notSpecified;
    film.className = 'photo-medium';
    if (['kodak', 'fujifilm', 'ilford'].includes(detailPhoto.filmBrand)) film.classList.add(`film-brand--${detailPhoto.filmBrand}`);
    find('[data-detail-iso]').textContent = detailPhoto.iso ? `ISO ${detailPhoto.iso}` : copy().notSpecified;
  }
  function ensureDetailDialog() {
    if (detailDialog) return;
    detailDialog = document.createElement('dialog'); detailDialog.className = 'photo-detail';
    detailDialog.setAttribute('aria-labelledby', 'photo-detail-title');
    detailDialog.dataset.frame = 'true'; detailDialog.dataset.margins = 'true'; detailDialog.dataset.matColor = 'black';
    detailDialog.innerHTML = `
      <button class="photo-detail__close" type="button" autofocus>×</button>
      <div class="photo-detail__layout">
        <div class="photo-detail__art">
          <div class="drum-card detail-preview" data-center="true">
            <div class="drum-card__frame"><div class="drum-card__mat">
              <img class="photo-detail__image" decoding="async" draggable="false" alt="">
            </div>${['tl', 'tr', 'bl', 'br'].map(corner => `<span class="museum-corner museum-corner--${corner}" aria-hidden="true">${frameCorner}</span>`).join('')}</div>
          </div>
          <p class="photo-detail__load-error" role="status" hidden data-detail-copy="photoError"></p>
        </div>
        <aside class="photo-detail__info">
          <p class="photo-detail__eyebrow" data-detail-copy="detailCollection"></p>
          <h2 id="photo-detail-title" class="collection__title"></h2>
          <p class="photo-detail__year"></p>
          <dl class="photo-detail__metadata">
            <div><dt data-detail-copy="pixelDimensions"></dt><dd data-detail-dimensions=""></dd></div>
            <div><dt data-detail-copy="photoTechnique"></dt><dd class="photo-detail__badges"></dd></div>
            <div class="photo-detail__film"><dt data-detail-copy="filmAndIso"></dt><dd><span data-detail-film=""></span><span class="photo-medium film-iso" data-detail-iso=""></span></dd></div>
          </dl>
          <fieldset class="photo-detail__settings">
            <legend data-detail-copy="previewAppearance"></legend>
            <label class="photo-detail__toggle"><span data-detail-copy="ornateFrame"></span><input id="detail-frame" type="checkbox" aria-describedby="detail-frame-notice" checked></label>
            <p id="detail-frame-notice" class="photo-detail__notice" data-detail-copy="frameNotice"></p>
            <label class="photo-detail__toggle"><span data-detail-copy="photoMargins"></span><input id="detail-margins" type="checkbox" checked></label>
            <fieldset class="photo-detail__colors"><legend data-detail-copy="marginColor"></legend>
              <label><input type="radio" name="detail-color" value="black" checked><span class="mat-choice mat-choice--black" data-detail-copy="blackMat"></span></label>
              <label><input type="radio" name="detail-color" value="white"><span class="mat-choice mat-choice--white" data-detail-copy="whiteMat"></span></label>
            </fieldset>
          </fieldset>
          <section class="photo-detail__order" aria-labelledby="photo-order-title" hidden>
            <h3 id="photo-order-title" data-detail-copy="orderTitle"></h3>
            <p class="photo-detail__price"><span data-detail-copy="posterPriceLabel"></span><strong data-detail-copy="posterPrice"></strong></p>
            <p class="photo-detail__order-note" data-detail-copy="instagramOrders"></p>
            <div class="photo-detail__order-contact">
              <div class="photo-detail__order-links">
                <span class="photo-detail__example" data-detail-copy="exampleProfile"></span>
                <a class="photo-detail__instagram-handle" target="_blank" rel="noopener noreferrer"></a>
                <a class="photo-detail__order-button" target="_blank" rel="noopener noreferrer"><span data-detail-copy="orderOnInstagram"></span><span aria-hidden="true">↗</span></a>
              </div>
              <a class="photo-detail__qr" target="_blank" rel="noopener noreferrer">${instagramProfile?.qr || ''}</a>
            </div>
          </section>
        </aside>
      </div>`;
    discouragePhotoSaving(detailDialog.querySelector('.detail-preview'));
    document.body.append(detailDialog);
    const find = selector => detailDialog.querySelector(selector);
    find('.photo-detail__close').addEventListener('click', () => detailDialog.close());
    detailDialog.addEventListener('click', event => { if (event.target === detailDialog) {
      const bounds = detailDialog.getBoundingClientRect();
      if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) detailDialog.close();
    } });
    detailDialog.addEventListener('close', () => {
      detailOpen = false; document.body.classList.remove('has-photo-detail');
      if (detailOpener?.isConnected && detailOpener.getAttribute('aria-hidden') !== 'true') detailOpener.focus({ preventScroll: true });
      detailPhoto = null; detailCollection = null;
      galleries.forEach(gallery => gallery.schedule());
    });
    find('#detail-frame').addEventListener('change', event => { detailDialog.dataset.frame = String(event.target.checked); });
    find('#detail-margins').addEventListener('change', event => {
      detailDialog.dataset.margins = String(event.target.checked);
      find('.photo-detail__colors').disabled = !event.target.checked;
    });
    detailDialog.querySelectorAll('input[name="detail-color"]').forEach(input => input.addEventListener('change', () => {
      if (input.checked) detailDialog.dataset.matColor = input.value;
    }));
    find('.photo-detail__image').addEventListener('error', () => { find('.photo-detail__load-error').hidden = false; });
    find('.photo-detail__image').addEventListener('load', () => { find('.photo-detail__load-error').hidden = true; });
  }
  function openDetail(card) {
    if (card.slot !== 0 || card.collection.busy || card.element.getAttribute('aria-hidden') === 'true') return;
    ensureDetailDialog();
    detailPhoto = card.photo; detailCollection = card.collection; detailOpener = card.element;
    detailDialog.dataset.landscape = String(detailPhoto.orientation === 'landscape');
    detailDialog.style.setProperty("--photo-ratio", detailPhoto.sourceWidth > detailPhoto.sourceHeight ? `${detailPhoto.sourceWidth} / ${detailPhoto.sourceHeight}` : "7 / 5");
    detailDialog.querySelector('.photo-detail__load-error').hidden = true;
    detailDialog.querySelector('.photo-detail__image').src = detailPhoto.detail || detailPhoto.src;
    detailCopy();
    detailOpen = true;
    galleries.forEach(gallery => gallery.schedule());
    document.body.classList.add('has-photo-detail');
    detailDialog.showModal();
  }
  document.addEventListener('languagechange', detailCopy);

  class DrumCard {
    constructor(parent, photo, collection, number, slot) {
      this.collection = collection;
      this.animations = [];
      this.failed = false;
      this.element = document.createElement('div');
      this.element.className = 'drum-card';
      this.element.setAttribute('role', 'button');
      this.element.setAttribute('aria-haspopup', 'dialog');
      this.element.addEventListener('click', event => {
        if (this.element.querySelector('.drum-card__frame').contains(event.target)) openDetail(this);
      });
      this.element.addEventListener('keydown', event => {
        if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); openDetail(this); }
      });
      this.element.innerHTML = `
        <div class="drum-card__frame">
          <div class="drum-card__mat">
          <div class="drum-card__image" aria-hidden="true">
            <img alt="" decoding="async" draggable="false">
            <span class="drum-card__error" hidden></span>
          </div>
          </div>
          ${['tl', 'tr', 'bl', 'br'].map(corner => `<span class="museum-corner museum-corner--${corner}" aria-hidden="true">${frameCorner}</span>`).join('')}
        </div>
        <div class="drum-card__medium" aria-hidden="true" hidden></div>`;
      discouragePhotoSaving(this.element.querySelector('.drum-card__frame'));
      parent.append(this.element);
      this.surface = this.element.querySelector('.drum-card__image');
      this.image = this.surface.querySelector('img');
      this.error = this.element.querySelector('.drum-card__error');
      this.medium = this.element.querySelector('.drum-card__medium');
      this.place(slot);
      this.setPhoto(photo, number);
    }

    setPhoto(photo, number) {
      this.photo = photo;
      this.element.dataset.landscape = String(photo.orientation === 'landscape');
      this.element.style.setProperty("--photo-ratio", photo.sourceWidth > photo.sourceHeight ? `${photo.sourceWidth} / ${photo.sourceHeight}` : "7 / 5");
      this.number = number;
      this.failed = false;
      this.error.hidden = true;
      if (photo.crop) {
        paint(this.surface, photo);
        this.image.hidden = true;
      } else {
        this.surface.style.backgroundImage = 'none';
        this.image.src = photo.src;
        this.image.hidden = false;
      }
      this.medium.replaceChildren();
      const types = ['analog', 'digital'].includes(photo.medium) ? [photo.medium] : [];
      for (const type of types) {
        const badge = document.createElement('span');
        badge.className = `photo-medium photo-medium--${type}`;
        badge.textContent = type.toUpperCase();
        this.medium.append(badge);
      }
      if (photo.medium === 'analog') {
        if (photo.film) {
          const badge = document.createElement('span');
          const brand = ['kodak', 'fujifilm', 'ilford'].includes(photo.filmBrand) ? photo.filmBrand : 'unknown';
          badge.className = `photo-medium film-brand--${brand}`; badge.textContent = photo.film;
          this.medium.append(badge);
        }
        if (photo.iso) {
          const badge = document.createElement('span'); badge.className = 'photo-medium film-iso';
          badge.textContent = `ISO ${photo.iso}`; this.medium.append(badge);
        }
      }
      this.medium.hidden = types.length === 0;
      this.updateLabel();
    }

    updateLabel() {
      const title = copy()[`${this.collection.id}Title`] || this.collection.title;
      this.element.setAttribute('aria-label', this.failed
        ? `${title} — ${copy().photoError}`
        : `${title} — ${copy().photoLabel} ${this.number + 1}${this.medium.hidden ? '' : ` — ${Array.from(this.medium.children, (badge) => badge.textContent).join(' + ')}`}`);
      this.error.textContent = copy().photoError;
    }

    async initialize() {
      const photo = this.photo;
      try {
        await loadPhoto(photo);
      } catch {
        if (this.photo !== photo) return;
        this.failed = true;
        this.error.hidden = false;
        this.updateLabel();
      }
    }

    place(slot) {
      this.slot = slot;
      const state = pose(slot, this.collection.photos.length);
      Object.assign(this.element.style, state);
      this.element.setAttribute('aria-hidden', String(state.opacity === 0));
      this.element.tabIndex = slot === 0 ? 0 : -1;
      this.element.setAttribute('role', slot === 0 ? 'button' : 'group');
      this.element.dataset.center = String(slot === 0);
    }

    async moveTo(slot) {
      const from = pose(this.slot, this.collection.photos.length);
      const to = pose(slot, this.collection.photos.length);
      this.element.dataset.center = String(slot === 0);
      if (!reducedMotion.matches && this.element.animate) {
        this.element.style.zIndex = to.zIndex;
        const animation = this.element.animate([
          { transform: from.transform, opacity: from.opacity },
          { transform: to.transform, opacity: to.opacity },
        ], { duration: 500, easing: 'cubic-bezier(.22,.8,.25,1)', fill: 'both' });
        this.animations = [animation];
        await Promise.allSettled([animation.finished]);
      }
      this.place(slot);
      this.animations.forEach(animation => animation.cancel());
      this.animations = [];
    }
  }

  class Collection {
    constructor(data, order) {
      this.id = data.id;
      this.year = String(data.year || '2026');
      this.title = data.title || data.id;
      this.photos = data.photos;
      this.offset = 0;
      this.visible = !('IntersectionObserver' in window);
      this.hovered = false;
      this.focused = false;
      this.paused = reducedMotion.matches;
      this.busy = false;
      this.queuedDirection = null;
      this.loaded = false;
      this.timer = null;
      this.interval = 6000 + order * 350;
      this.element = document.createElement('article');
      this.element.className = 'collection';
      this.element.setAttribute('aria-labelledby', `collection-${order}-title`);
      this.element.innerHTML = `
        <h3 class="collection__title" id="collection-${order}-title"></h3>
        <div class="collection__stage">
          <div class="collection__drum"></div>
          <button class="collection__arrow collection__previous" type="button"><span aria-hidden="true">←</span></button>
          <button class="collection__arrow collection__next" type="button"><span aria-hidden="true">→</span></button>
        </div>`;
      document.querySelector('#collection-list').append(this.element);
      const drum = this.element.querySelector('.collection__drum');
      const slots = this.photos.length === 1 ? [0] : [-2, -1, 0, 1, 2];
      this.cards = slots.map(slot => {
        const number = (slot + this.photos.length) % this.photos.length;
        return new DrumCard(drum, this.photos[number], this, number, slot);
      });
      this.previousButton = this.element.querySelector('.collection__previous');
      this.nextButton = this.element.querySelector('.collection__next');
      this.previousButton.hidden = this.nextButton.hidden = this.photos.length < 2;
      this.previousButton.addEventListener('click', () => this.advance(-1));
      this.nextButton.addEventListener('click', () => this.advance(1));
      this.element.addEventListener('pointerenter', (event) => {
        if (event.pointerType !== 'mouse') return;
        this.hovered = true;
        this.schedule();
      });
      this.element.addEventListener('pointerleave', () => {
        this.hovered = false;
        this.schedule();
      });
      this.element.addEventListener('focusin', () => {
        this.focused = true;
        this.schedule();
      });
      this.element.addEventListener('focusout', (event) => {
        this.focused = this.element.contains(event.relatedTarget);
        this.schedule();
      });
      this.updateCopy();
      this.preloadNeighbours();
      Promise.all(this.cards.map((card) => card.initialize())).then(() => {
        this.loaded = true;
        this.schedule();
      });
    }

    updateCopy() {
      const title = copy()[`${this.id}Title`] || this.title;
      const heading = this.element.querySelector('.collection__title');
      collectionHeading(heading, title, this.id);
      this.previousButton.setAttribute('aria-label', `${title} — ${copy().previousPhotos}`);
      this.nextButton.setAttribute('aria-label', `${title} — ${copy().nextPhotos}`);
      this.cards.forEach((card) => card.updateLabel());
    }

    schedule() {
      clearTimeout(this.timer);
      if (detailOpen || this.element.hidden || !this.loaded || this.paused || this.busy || !this.visible || this.hovered || this.focused || document.hidden || this.photos.length < 2) return;
      this.timer = setTimeout(() => this.advance(), this.interval);
    }

    preloadNeighbours() {
      // Keep the next few photographs ready in either direction, without waiting.
      for (const step of [-3, -2, -1, 0, 1, 2, 3]) {
        const index = ((this.offset + step) % this.photos.length + this.photos.length) % this.photos.length;
        loadPhoto(this.photos[index]).catch(() => {});
      }
    }

    async advance(direction = 1) {
      if (this.photos.length < 2) return;
      if (this.busy) {
        // Keep the latest click, without building a long queue of transitions.
        this.queuedDirection = direction;
        return;
      }
      clearTimeout(this.timer);
      this.busy = true;
      const nextOffset = (this.offset + direction + this.photos.length) % this.photos.length;
      const nextHidden = (nextOffset + direction * 2 + this.photos.length) % this.photos.length;
      try {
        await Promise.all(this.cards.filter(card => Math.abs(card.slot - direction) <= 1).map(card => loadPhoto(card.photo)));
        await Promise.all(this.cards.map(card => card.moveTo(card.slot - direction)));
        this.offset = nextOffset;
        const recycled = direction === 1 ? this.cards.shift() : this.cards.pop();
        recycled.place(direction * 2);
        recycled.setPhoto(this.photos[nextHidden], nextHidden);
        recycled.initialize();
        if (direction === 1) this.cards.push(recycled);
        else this.cards.unshift(recycled);
      } catch {
        // A failed download leaves the current selection in place for retry.
      } finally {
        this.busy = false;
        this.updateCopy();
        this.preloadNeighbours();
        const queued = this.queuedDirection;
        this.queuedDirection = null;
        if (queued !== null && !detailOpen && !this.element.hidden && !document.hidden) this.advance(queued);
        else this.schedule();
      }
    }
  }

  const source = (window.ZWIDY_COLLECTIONS || []).filter(data => data.photos.length);
  const availableYears = [...new Set(source.map(data => String(data.year || '2026')))].sort((a, b) => Number(b) - Number(a));
  const years = availableYears.length ? availableYears : ['2026'];
  let selectedCollection = "all";
  let selectedOrientation = "all";
  let selectedColorMode = "all";
  const collectionFilter = document.querySelector("#filter-collection");
  let selectedYear = availableYears[0] || '2026';
  const observer = 'IntersectionObserver' in window ? new IntersectionObserver((entries) => {
    for (const entry of entries) {
      const gallery = galleries.find(item => item.element === entry.target);
      if (!gallery) continue;
      gallery.visible = entry.isIntersecting;
      gallery.schedule();
    }
  }, { threshold: 0.15 }) : null;

  function updateFilterCopy() {
    collectionFilter.replaceChildren();
    const all = document.createElement('option'); all.value = 'all'; all.textContent = copy().filterAll; collectionFilter.append(all);
    source.filter(data => String(data.year || '2026') === selectedYear).forEach(data => {
      const option = document.createElement('option'); option.value = data.id;
      option.textContent = copy()[`${data.id}Title`] || data.title || data.id; collectionFilter.append(option);
    });
    collectionFilter.value = selectedCollection;
    document.querySelector("#filter-reset").disabled = selectedCollection === "all" && selectedOrientation === "all" && selectedColorMode === "all";
    document.querySelector('#filter-status').textContent = `${copy().filterResults} ${galleries.length}`;
  }

  function applyFilters() {
    for (const gallery of galleries) {
      gallery.element.hidden = true;
      gallery.queuedDirection = null;
      clearTimeout(gallery.timer);
      if (observer) observer.unobserve(gallery.element);
      gallery.cards.forEach(card => card.animations.forEach(animation => animation.cancel()));
    }
    galleries.length = 0;
    document.querySelector('#collection-list').replaceChildren();
    for (const data of source) {
      if (String(data.year || '2026') !== selectedYear || (selectedCollection !== 'all' && data.id !== selectedCollection)) continue;
      const photos = data.photos.filter(photo => (selectedOrientation === 'all' || (photo.orientation || 'portrait') === selectedOrientation) && (selectedColorMode === 'all' || photo.colorMode === selectedColorMode));
      if (!photos.length) continue;
      const gallery = new Collection({ ...data, photos }, galleries.length);
      galleries.push(gallery);
      if (observer) observer.observe(gallery.element);
    }
    galleries.forEach((gallery, index) => { gallery.element.dataset.yearLast = String(index === galleries.length - 1); });
    document.querySelector('[data-collection-count]').textContent = galleries.length ? `01 — ${String(galleries.length).padStart(2, '0')}` : '00';
    document.querySelector('#year-empty').hidden = galleries.length > 0;
    updateFilterCopy();
  }

  function selectYear(year) {
    if (!years.includes(year)) return;
    if (selectedYear !== year) selectedCollection = 'all';
    selectedYear = year;
    document.documentElement.dataset.collectionYear = year;
    document.dispatchEvent(new CustomEvent('collectionyearchange', { detail: year }));
    applyFilters();
    document.querySelector('#year-status').textContent = `${copy().yearSelected} ${year}`;
  }
  document.querySelector('#filter-reset').addEventListener('click', () => {
    selectedCollection = selectedOrientation = selectedColorMode = 'all';
    document.querySelector('#filter-color-mode').value = 'all';
    document.querySelectorAll('input[name="filter-orientation"]').forEach(input => { input.checked = input.value === 'all'; });
    applyFilters();
    collectionFilter.focus({ preventScroll: true });
  });
  document.querySelector('#filter-color-mode').addEventListener('change', event => { selectedColorMode = event.target.value; applyFilters(); });
  collectionFilter.addEventListener('change', () => { selectedCollection = collectionFilter.value; applyFilters(); });
  document.querySelectorAll('input[name="filter-orientation"]').forEach(input => {
    input.addEventListener('change', () => { if (input.checked) { selectedOrientation = input.value; applyFilters(); } });
  });

  const wheel = document.querySelector('#year-wheel');
  const rowHeight = 48;
  const yearUp = document.querySelector('#year-up');
  const yearDown = document.querySelector('#year-down');
  const yearOptions = years.map(year => {
    const option = document.createElement('div');
    option.className = 'year-wheel__option'; option.id = `year-option-${year}`;
    option.textContent = year;
    wheel.append(option); return option;
  });
  function updateWheel() {
    const position = wheel.scrollTop / rowHeight;
    yearOptions.forEach((option, index) => {
      const distance = index - position;
      option.style.transform = `perspective(280px) rotateX(${Math.max(-55, Math.min(55, distance * -26))}deg) scale(${Math.max(.82, 1 - Math.abs(distance) * .1)})`;
      option.style.opacity = String(Math.max(.2, 1 - Math.abs(distance) * .55));
    });
    yearUp.disabled = years.indexOf(selectedYear) === 0;
    yearDown.disabled = years.indexOf(selectedYear) === years.length - 1;
  }
  function chooseYear(year, scroll = true) {
    selectYear(year);
    if (scroll) wheel.scrollTo({ top: years.indexOf(year) * rowHeight, behavior: reducedMotion.matches ? 'auto' : 'smooth' });
    updateWheel();
  }
  wheel.addEventListener('scroll', updateWheel, { passive: true });
  yearUp.addEventListener('click', () => {
    const index = years.indexOf(selectedYear);
    if (index > 0) chooseYear(years[index - 1]);
  });
  yearDown.addEventListener('click', () => {
    const index = years.indexOf(selectedYear);
    if (index < years.length - 1) chooseYear(years[index + 1]);
  });
  wheel.scrollTop = years.indexOf(selectedYear) * rowHeight;
  selectYear(selectedYear); updateWheel();
  document.addEventListener('visibilitychange', () => galleries.forEach((gallery) => gallery.schedule()));
  document.addEventListener('languagechange', () => {
    galleries.forEach(gallery => gallery.updateCopy());
    updateFilterCopy();
    document.querySelector('#year-status').textContent = `${copy().yearSelected} ${selectedYear}`;
  });
  reducedMotion.addEventListener('change', () => {
    galleries.forEach((gallery) => {
      gallery.paused = reducedMotion.matches;
      if (reducedMotion.matches) {
        gallery.cards.forEach((card) => card.animations.forEach((animation) => animation.finish()));
      }
      gallery.updateCopy();
      gallery.schedule();
    });
  });
  setLanguage(document.documentElement.lang);
})();
