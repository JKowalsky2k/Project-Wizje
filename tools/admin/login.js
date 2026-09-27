(() => {
  if (location.protocol !== 'http:' || !['127.0.0.1', 'localhost'].includes(location.hostname)) {
    document.body.textContent = 'Panel działa tylko lokalnie. / This admin panel only works locally.';
    return;
  }

  const $ = selector => document.querySelector(selector);
  const copy = {
    pl: {workshop:'pracowania',brandLabel:'Wizje — pracowania',languageLabel:'Język panelu',preview:'Podgląd strony ↗',password:'Hasło',confirmation:'Powtórz hasło',setupTitle:'Ustaw hasło',loginTitle:'Witaj w pracowni',setupDescription:'Ustaw hasło do lokalnego panelu. Użyjesz go także w innych przeglądarkach. Minimum 8 znaków.',loginDescription:'Zaloguj się swoim hasłem do panelu Wizje.',setupSubmit:'Ustaw hasło i wejdź',loginSubmit:'Zaloguj się',loading:'Wczytywanie…',saving:'Logowanie…',failed:'Nie udało się połączyć. Odśwież stronę i spróbuj ponownie.'},
    en: {workshop:'workshop',brandLabel:'Wizje — workshop',languageLabel:'Admin language',preview:'View website ↗',password:'Password',confirmation:'Repeat password',setupTitle:'Set your password',loginTitle:'Welcome to the workshop',setupDescription:'Set a password for your local admin panel. Use it in any browser. At least 8 characters.',loginDescription:'Sign in to Wizje with your password.',setupSubmit:'Set password and sign in',loginSubmit:'Sign in',loading:'Loading…',saving:'Signing in…',failed:'Could not connect. Refresh the page and try again.'},
  };
  let language = 'pl', setup = false, csrf = '', busy = false;
  try { if (localStorage.getItem('wizje-admin-language') === 'en') language = 'en'; } catch {}
  const t = key => copy[language][key];
  function render() {
    document.documentElement.lang = language;
    document.title = `Wizje — ${t(setup ? 'setupTitle' : 'loginTitle')}`;
    document.querySelectorAll('[data-i18n]').forEach(element => {
      const value = t(element.dataset.i18n);
      if (element.dataset.i18n === 'workshop') {
        element.replaceChildren(...Array.from(value, letter => {
          const span = document.createElement('span'); span.textContent = letter; return span;
        }));
      } else element.textContent = value;
    });
    document.querySelectorAll('[data-i18n-aria]').forEach(element => element.setAttribute('aria-label', t(element.dataset.i18nAria)));
    document.querySelectorAll('[data-language]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.language === language)));
    $('#login-title').textContent = t(setup ? 'setupTitle' : 'loginTitle');
    $('#login-description').textContent = t(setup ? 'setupDescription' : 'loginDescription');
    $('#login-submit').textContent = t(setup ? 'setupSubmit' : 'loginSubmit');
    $('#confirmation-row').hidden = !setup;
    $('#confirmation').required = setup;
    $('#password').autocomplete = setup ? 'new-password' : 'current-password';
  }
  function lock(value) {
    busy = value;
    document.querySelectorAll('input, button').forEach(element => { element.disabled = value; });
  }
  function status(message, error = false) { $('#status').textContent = message; $('#status').dataset.error = String(error); }
  document.querySelectorAll('[data-language]').forEach(button => button.addEventListener('click', () => {
    language = button.dataset.language;
    try { localStorage.setItem('wizje-admin-language', language); } catch {}
    render(); status('');
  }));
  $('#login-form').addEventListener('submit', async event => {
    event.preventDefault(); if (busy || !csrf) return;
    lock(true); status(t('saving'));
    try {
      const response = await fetch('/admin/api/login', {
        method:'POST', headers:{'Content-Type':'application/json','Accept-Language':language,'X-Wizje-CSRF':csrf},
        body:JSON.stringify({setup,password:$('#password').value,confirmation:$('#confirmation').value}),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || t('failed'));
      $('#password').value = ''; $('#confirmation').value = '';
      window.location.replace('/admin');
    } catch (error) { status(error.message, true); lock(false); }
  });
  render(); status(t('loading')); lock(true);
  fetch('/admin/api/auth').then(async response => {
    if (!response.ok) throw new Error(t('failed'));
    const data = await response.json(); setup = data.setup; csrf = data.csrf;
    render(); status(''); lock(false); $('#password').focus();
  }).catch(() => { status(t('failed'), true); });
})();
