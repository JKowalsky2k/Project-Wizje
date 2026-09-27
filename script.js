const translations = {
  en: {
    pageTitle: "Wizje — Photography & Prints",
    metaDescription: "Original photography, posters and fine art prints.",
    homeLabel: "Wizje — Home",
    languageLabel: "Choose language",
    headerNote: "Photography · posters · prints",
    eyebrow: "Original images for everyday life",
    headlineFirst: "Images worth",
    headlineSecond: "keeping.",
    introCopy: "Photographs and posters for your space.",
    collectionsTitle: "Collections",
    yearLabel: "Collection year",
    yearUp: "Newer year",
    yearDown: "Older year",
    yearSelected: "Collections from",
    yearUpcoming: "Collections for this year are coming soon.",
    collectionLabel: "Collection",
    alpsTitle: "Alps",
    alpsDescription: "Mountain scenes from the road.",
    alpsAlt: "Alps collection: mountain photography",
    planesTitle: "Planes",
    planesDescription: "Aircraft and moments in flight.",
    carsTitle: "Cars",
    carsDescription: "Classic cars in urban settings.",
    carsAlt: "Car collection: automotive photography",
    dolomitesTitle: "Dolomites",
    dolomitesDescription: "Light and landscapes of the Dolomites.",
    dolomitesAlt: "Dolomites collection: mountain photography",
    torunTitle: "Toruń",
    torunDescription: "City scenes along the Vistula.",
    torunAlt: "Torun collection: city and riverside photography",
    photographyLabel: "Photography",
    footerNote: "Original photography",
    nextPhotos: "Next photographs",
    previousPhotos: "Previous photographs",
    photoError: "Photograph unavailable",
    photoLabel: "Photograph",

  },
  pl: {
    pageTitle: "Wizje — fotografia i odbitki",
    metaDescription: "Autorska fotografia, plakaty i odbitki.",
    homeLabel: "Wizje — Strona główna",
    languageLabel: "Wybierz język",
    headerNote: "Fotografia · plakaty · odbitki",
    eyebrow: "Autorskie obrazy na co dzień",
    headlineFirst: "Kadry, które",
    headlineSecond: "chcesz zatrzymać.",
    introCopy: "Fotografie i plakaty do Twojej przestrzeni.",
    collectionsTitle: "Kolekcje",
    yearLabel: "Rok kolekcji",
    yearUp: "Nowszy rok",
    yearDown: "Starszy rok",
    yearSelected: "Kolekcje z roku",
    yearUpcoming: "Kolekcje z tego roku pojawią się wkrótce.",
    collectionLabel: "Kolekcja",
    alpsTitle: "Alpy",
    alpsDescription: "Górskie kadry z podróży.",
    alpsAlt: "Kolekcja Alpy: górskie fotografie",
    planesTitle: "Samoloty",
    planesDescription: "Samoloty i chwile w przestworzach.",
    carsTitle: "Samochody",
    carsDescription: "Motoryzacja w miejskim kadrze.",
    carsAlt: "Kolekcja samochodowa: fotografie aut",
    dolomitesTitle: "Dolomity",
    dolomitesDescription: "Światło i krajobrazy Dolomitów.",
    dolomitesAlt: "Kolekcja Dolomity: fotografie górskich szczytów",
    torunTitle: "Toruń",
    torunDescription: "Miejskie kadry nad Wisłą.",
    torunAlt: "Kolekcja Toruń: fotografie miasta i mostu",
    photographyLabel: "Fotografia",
    footerNote: "Autorska fotografia",
    nextPhotos: "Następne zdjęcia",
    previousPhotos: "Poprzednie zdjęcia",
    photoError: "Zdjęcie niedostępne",
    photoLabel: "Zdjęcie",

  },
};

const languageButtons = document.querySelectorAll("[data-language]");

function setLanguage(language) {
  const copy = translations[language];
  if (!copy) return;

  document.documentElement.lang = language;
  document.title = copy.pageTitle;

  document.querySelectorAll("[data-i18n]").forEach((element) => {
    const key = element.dataset.i18n;
    const collectionNumber = element.textContent.match(/\d+$/)?.[0];
    element.textContent = collectionNumber && key === "collectionLabel"
      ? `${copy[key]} ${collectionNumber}`
      : copy[key];
  });

  document.querySelectorAll("[data-i18n-content]").forEach((element) => {
    element.content = copy[element.dataset.i18nContent];
  });

  document.querySelectorAll("[data-i18n-alt]").forEach((element) => {
    element.alt = copy[element.dataset.i18nAlt];
  });

  document.querySelectorAll("[data-i18n-aria-label]").forEach((element) => {
    element.setAttribute("aria-label", copy[element.dataset.i18nAriaLabel]);
  });

  languageButtons.forEach((button) => {
    button.setAttribute("aria-pressed", String(button.dataset.language === language));
  });
  document.dispatchEvent(new CustomEvent("languagechange", { detail: language }));
}

languageButtons.forEach((button) => {
  button.addEventListener("click", () => setLanguage(button.dataset.language));
});