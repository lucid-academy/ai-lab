// Wspólne ustawienia ankiety (index.html) i panelu (panel.html).
// ENDPOINT = adres aplikacji internetowej Google Apps Script (kończy się na /exec).
// Instrukcja: ewaluacja/README.md. Dopóki ENDPOINT jest pusty, ankieta wysyła odpowiedzi e-mailem (jak stara ankieta.html).
window.EWAL_CONFIG = {
  ENDPOINT: '',
  // Zapasowa ścieżka, gdy ENDPOINT jest pusty albo nie odpowiada: e-mail przez FormSubmit, a w ostateczności mailto.
  FALLBACK_EMAIL: 'piotr.jarczyk.ai@gmail.com',
  // Lista szkoleń pokazywana, gdy arkusz „Szkolenia” jest niedostępny. Docelowo edytuj listę w Arkuszu Google.
  TRAININGS: [
    'Sprawdź, zanim zaufasz (eFajfy)',
    'Warsztaty AI',
    'Wykład o AI'
  ],
  // Krótkie kody do linków i QR: ?s=efajfy zamiast pełnej nazwy szkolenia.
  ALIASES: {
    efajfy: 'Sprawdź, zanim zaufasz (eFajfy)',
    ai: 'Warsztaty AI'
  },
  // Adres publiczny ankiety (do kodów QR w panelu).
  PUBLIC_URL: 'https://lucid-academy.github.io/ai-lab/ewaluacja/'
};
