/* Horizontal photo drums: one front photograph and two receding side panels. */
(() => {
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const imageLoads = new Map();
  const galleries = [];
  const letterStyles = ['z', 'w', 'i', 'd', 'y'];
  const copy = () => translations[document.documentElement.lang] || translations.en;

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

  class DrumCard {
    constructor(parent, photo, collection, number, slot) {
      this.collection = collection;
      this.animations = [];
      this.failed = false;
      this.element = document.createElement('div');
      this.element.className = 'drum-card';
      this.element.setAttribute('role', 'img');
      this.element.innerHTML = `
        <div class="drum-card__frame">
          <div class="drum-card__image" aria-hidden="true">
            <img alt="" decoding="async" draggable="false">
            <span class="drum-card__error" hidden></span>
          </div>
        </div>
        <div class="drum-card__medium" aria-hidden="true" hidden></div>`;
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

    place(slot) {
      this.slot = slot;
      const state = pose(slot, this.collection.photos.length);
      Object.assign(this.element.style, state);
      this.element.setAttribute('aria-hidden', String(state.opacity === 0));
    }

    async initialize() {
      try {
        await loadPhoto(this.photo);
      } catch {
        this.failed = true;
        this.error.hidden = false;
        this.updateLabel();
      }
    }

    async moveTo(slot) {
      const from = pose(this.slot, this.collection.photos.length);
      const to = pose(slot, this.collection.photos.length);
      if (!reducedMotion.matches && this.element.animate) {
        this.element.style.zIndex = to.zIndex;
        const animation = this.element.animate([
          { transform: from.transform, opacity: from.opacity },
          { transform: to.transform, opacity: to.opacity },
        ], { duration: 1100, easing: 'cubic-bezier(.22,.8,.25,1)', fill: 'both' });
        this.animations = [animation];
        await Promise.allSettled([animation.finished]);
      }
      this.place(slot);
      this.animations.forEach((animation) => animation.cancel());
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
      this.loaded = false;
      this.timer = null;
      this.interval = 6000 + order * 350;
      this.element = document.createElement('article');
      this.element.className = 'collection';
      this.element.setAttribute('aria-labelledby', `collection-${order}-title`);
      this.element.innerHTML = `
        <div class="collection__stage">
          <div class="collection__drum"></div>
          <button class="collection__arrow collection__previous" type="button"><span aria-hidden="true">←</span></button>
          <button class="collection__arrow collection__next" type="button"><span aria-hidden="true">→</span></button>
        </div>
        <h3 class="collection__title" id="collection-${order}-title"></h3>`;
      document.querySelector('#collection-list').append(this.element);
      const drum = this.element.querySelector('.collection__drum');
      // Hidden cards on both edges allow seamless movement in either direction.
      const slots = this.photos.length === 1 ? [0] : [-2, -1, 0, 1, 2];
      this.cards = slots.map((slot) => {
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
      Promise.all(this.cards.map((card) => card.initialize())).then(() => {
        this.loaded = true;
        this.schedule();
      });
    }

    updateCopy() {
      const title = copy()[`${this.id}Title`] || this.title;
      const heading = this.element.querySelector('.collection__title');
      heading.replaceChildren();
      const accessible = document.createElement('span');
      accessible.className = 'sr-only';
      accessible.textContent = title;
      heading.append(accessible);
      heading.style.setProperty('--letters', Array.from(title).length);
      Array.from(title).forEach((character, index) => {
        const slot = index % letterStyles.length;
        const letter = document.createElement('span');
        letter.className = `collection__letter collection__letter--${letterStyles[slot]}`;
        letter.setAttribute('aria-hidden', 'true');
        letter.textContent = slot === 1 || slot === 4 ? character.toLocaleLowerCase() : character.toLocaleUpperCase();
        heading.append(letter);
      });
      this.previousButton.setAttribute('aria-label', `${title} — ${copy().previousPhotos}`);
      this.nextButton.setAttribute('aria-label', `${title} — ${copy().nextPhotos}`);
      this.cards.forEach((card) => card.updateLabel());
    }

    schedule() {
      clearTimeout(this.timer);
      if (this.element.hidden || !this.loaded || this.paused || this.busy || !this.visible || this.hovered || this.focused || document.hidden || this.photos.length < 2) return;
      this.timer = setTimeout(() => this.advance(), this.interval);
    }

    async advance(direction = 1) {
      if (this.busy || this.photos.length < 2) return;
      clearTimeout(this.timer);
      this.busy = true;
      this.previousButton.disabled = this.nextButton.disabled = true;
      const nextOffset = (this.offset + direction + this.photos.length) % this.photos.length;
      const nextHidden = (nextOffset + direction * 2 + this.photos.length) % this.photos.length;
      try {
        // Decode incoming photographs before moving the whole drum.
        await Promise.all([
          ...this.cards.filter((card) => Math.abs(card.slot - direction) <= 1).map((card) => loadPhoto(card.photo)),
          loadPhoto(this.photos[nextHidden]),
        ]);
        await Promise.all(this.cards.map((card) => card.moveTo(card.slot - direction)));
        this.offset = nextOffset;
        const recycled = direction === 1 ? this.cards.shift() : this.cards.pop();
        recycled.place(direction * 2);
        recycled.setPhoto(this.photos[nextHidden], nextHidden);
        if (direction === 1) this.cards.push(recycled);
        else this.cards.unshift(recycled);
      } catch {
        // A failed download leaves the current selection in place for retry.
      } finally {
        this.busy = false;
        this.previousButton.disabled = this.nextButton.disabled = false;
        this.updateCopy();
        this.schedule();
      }
    }
  }

  const source = (window.ZWIDY_COLLECTIONS || []).filter(data => data.photos.length);
  const availableYears = [...new Set(source.map(data => String(data.year || '2026')))].sort((a, b) => Number(b) - Number(a));
  const years = availableYears.length ? availableYears : ['2026'];
  const mountedYears = new Set();
  let selectedYear = availableYears[0] || '2026';
  const observer = 'IntersectionObserver' in window ? new IntersectionObserver((entries) => {
    for (const entry of entries) {
      const gallery = galleries.find(item => item.element === entry.target);
      if (!gallery) continue;
      gallery.visible = entry.isIntersecting;
      gallery.schedule();
    }
  }, { threshold: 0.15 }) : null;

  function selectYear(year) {
    if (!years.includes(year)) return;
    selectedYear = year;
    if (!mountedYears.has(year)) {
      for (const data of source.filter(item => String(item.year || '2026') === year)) {
        const gallery = new Collection(data, galleries.length);
        galleries.push(gallery);
        if (observer) observer.observe(gallery.element);
      }
      mountedYears.add(year);
    }
    const visible = galleries.filter(gallery => gallery.year === year);
    for (const gallery of galleries) {
      gallery.element.hidden = gallery.year !== year;
      gallery.element.dataset.yearLast = String(gallery === visible[visible.length - 1]);
      gallery.schedule();
    }
    document.querySelector('[data-collection-count]').textContent = visible.length
      ? `01 — ${String(visible.length).padStart(2, '0')}` : '00';
    document.querySelector('#year-status').textContent = `${copy().yearSelected} ${year}`;
    document.querySelector('#year-empty').hidden = visible.length > 0;
  }

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
