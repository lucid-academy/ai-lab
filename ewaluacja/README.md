# Ankieta ewaluacyjna Lucid Academy (uniwersalna)

Jedna, anonimowa ankieta po każdych zajęciach: warsztatach, wykładach, szkoleniach eFajfy.
Stara ankieta `../ankieta.html` (warsztaty „AI w procesach twórczych”) zostaje bez zmian.

| Plik | Do czego |
|---|---|
| `index.html` | ankieta dla uczestników (telefon, duże przyciski) |
| `panel.html` | panel z wynikami: filtry po dacie, szkoleniu, miejscu i typie osoby, wykresy, komentarze, eksport CSV, generator linków i kodów QR |
| `config.js` | adres zaplecza (ENDPOINT), lista szkoleń, krótkie kody do linków |
| `apps-script.gs` | zaplecze: Google Apps Script zapisujący odpowiedzi w Arkuszu Google |
| `qrcode.js` | biblioteka QR (qrcode-generator 1.4.4, MIT) |

Adresy po publikacji na GitHub Pages:

- ankieta: https://lucid-academy.github.io/ai-lab/ewaluacja/
- panel: https://lucid-academy.github.io/ai-lab/ewaluacja/panel.html (podgląd na danych przykładowych: `panel.html?demo=1`)

## Co jest w ankiecie

Kontekst: szkolenie, data (domyślnie dzisiaj), miejsce (opcjonalnie).
Pytania: kim jesteś (senior / urzędnik / inna osoba)*, ocena 1–5*, przydatność, zrozumiałość prowadzących 1–5, tempo,
„czuję się pewniej”, polecenie znajomym, co najcenniejsze, co poprawić. Gwiazdka = obowiązkowe.

Ankieta nie pyta o imię ani kontakt, a zaplecze nie zapisuje IP ani przeglądarki.

## Linki i kody QR

Parametry linku (wszystkie opcjonalne):

- `s` nazwa szkolenia albo krótki kod z `config.js` (np. `s=efajfy`),
- `m` miejsce, np. `m=Ciechocinek`,
- `d` data `RRRR-MM-DD` (bez niej ankieta wstawia dzień wypełnienia, więc jeden kod QR działa na wszystkie terminy),
- `t` z góry zaznaczony typ: `senior` albo `urzednik`.

Przykład: `https://lucid-academy.github.io/ai-lab/ewaluacja/?s=efajfy`.
Gdy link ma `s`, uczestnik widzi gotowe „Szkolenie / Data” i od razu odpowiada na pytania (może to zmienić).
Kody QR najprościej robić w panelu (sekcja „Link i kod QR”).

## Podłączenie Arkusza Google (raz, ok. 5 minut)

Dopóki `ENDPOINT` w `config.js` jest pusty, ankieta wysyła każdą odpowiedź e-mailem (FormSubmit, jak stara ankieta), a panel nie ma czego pokazać.

1. Utwórz nowy Arkusz Google, np. „Ankiety Lucid Academy”.
2. W arkuszu: **Rozszerzenia → Apps Script**. Usuń przykładowy kod i wklej całość `apps-script.gs`. Zapisz.
3. Wybierz funkcję `setup` i kliknij **Uruchom** (Google poprosi o zgodę na dostęp do arkusza). Powstaną arkusze „Odpowiedzi” i „Szkolenia”, a w **Dzienniku wykonania** pojawi się klucz do panelu. Zapisz go w bezpiecznym miejscu (nie wrzucaj do repozytorium).
4. **Wdróż → Nowe wdrożenie → typ: Aplikacja internetowa**. „Wykonuj jako: **Ja**”, „Kto ma dostęp: **Każdy**”. Skopiuj adres kończący się na `/exec`.
5. Wklej ten adres w `config.js` jako `ENDPOINT` i opublikuj zmianę w repozytorium.
6. Otwórz `panel.html`, wpisz klucz. Gotowe.

Po każdej zmianie kodu w Apps Script trzeba zrobić **Wdróż → Zarządzaj wdrożeniami → Edytuj → Nowa wersja**, żeby adres `/exec` dalej działał z nowym kodem.

Listę szkoleń w ankiecie zmieniasz w arkuszu „Szkolenia” (kolumna B: `NIE` ukrywa szkolenie), bez dotykania kodu.
