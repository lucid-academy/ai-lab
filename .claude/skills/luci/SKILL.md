---
name: luci
description: Dołącza Luci, neonową ośmiornicę-maskotkę Lucid Academy, do prezentacji HTML. Użyj, gdy użytkownik pisze „dołącz Luci z GH”, „dodaj Luci”, „wstaw Luci”, „prezentacja z Luci” albo chce, żeby ośmiornica pojawiała się na slajdach.
---

# Luci w prezentacji

Luci to jeden plik JS bez zależności w repo `lucid-academy/ai-lab`, folder `osmiornica/`: silnik `osmiornica.js`, dokumentacja `README.md`, demo `index.html`. Najnowsza wersja jest publicznie na GitHub Pages:

https://lucid-academy.github.io/ai-lab/osmiornica/osmiornica.js

Prezentacje podpinają ten adres, a nie kopię pliku, dzięki czemu każda poprawka Luci sama trafia do wszystkich prezentacji. Dołączając Luci, nie zmieniaj `osmiornica/osmiornica.js`: to wspólny silnik wszystkich prezentacji.

## 1. Skrypt

Przed `</body>` prezentacji:

```html
<script>window.OSMIORNICA = { mode: 'lecture' }</script>
<script src="https://lucid-academy.github.io/ai-lab/osmiornica/osmiornica.js" defer></script>
```

- `mode: 'lecture'` (domyślnie): rzadkie wejścia, najwcześniej po 3 min, co najmniej 9 min przerwy, najwyżej 6 razy. `mode: 'demo'`: wchodzi na każdy slajd (do pokazów i testów).
- Życzenia użytkownika tłumacz na ustawienia w tym samym obiekcie:
  - kolor → `skin`: `#6516D9` fiolet (domyślny), `#A3452B` rdzawy, `#C21B6E` malinowy, `#2D5BDB` błękitny albo dowolny hex;
  - „częściej” → np. `firstAfterMin: 1, minGapMin: 5, maxAppearances: 10`; „na każdym slajdzie” → `mode: 'demo'`;
  - „bez chmurek” → `thoughts: false`; „większa / mniejsza” → `size` (domyślnie `0.105` wysokości ekranu);
  - pełna lista ustawień jest w `osmiornica/README.md`.
- Wykład bez internetu (tylko gdy użytkownik o tym mówi): skopiuj `osmiornica.js` obok prezentacji i ustaw `src="osmiornica.js"`.

## 2. Zmiana slajdów

Luci musi wiedzieć, kiedy zmienia się slajd. Sprawdź w kodzie prezentacji funkcję, która pokazuje slajd:

- reveal.js albo klasa `active` / `present` / `current` przełączana na `section`, `.slide` lub `[data-slide]` → nic nie rób, Luci wykrywa to sama;
- każdy inny mechanizm (klasa na innym elemencie, `display`, `hidden`, `transform`, numer w zmiennej) → po zmianie slajdu dopisz poniższą linijkę, gdzie `el` to element nowego slajdu:

  ```js
  document.dispatchEvent(new CustomEvent('slidechange', { detail: { slide: el } }))
  ```

- strona przewijana zamiast slajdów → `IntersectionObserver` na sekcjach, który wysyła to samo zdarzenie, gdy sekcja zajmie większość ekranu.

## 3. Atrybuty

Oznaczaj bez dopytywania o każdy szczegół. Użytkownik może to potem zmienić.

| Atrybut | Gdzie |
|---|---|
| `data-osmiornica="final"` | ostatni slajd (podziękowania): Luci kłania się na koniec |
| `data-osmiornica="nie"` | slajdy z quizem, ankietą, wideo, formularzem, demo na żywo albo trudnym tematem; także pojedyncze elementy, których nie wolno ruszać |
| `data-osmiornica-przeszkoda` | stałe elementy nad slajdami: nawigacja, pasek postępu, numer slajdu, logo |
| `data-osmiornica-podest` | karty, ramki i obrazki, na których może usiąść |
| `data-osmiornica-cel` | 1–3 nagłówki, które dobrze nadają się na psikus |
| `data-osmiornica="tu"` | tylko gdy użytkownik chce, żeby na danym slajdzie wpadła na pewno |

## 4. Klawisze

Luci przechwytuje przed prezentacją klawisze `O` (przywołaj), `H` (schowaj), `0` (tryb poważny), `+` (nagroda), `R` (napraw) i `D` (panel). Jeśli prezentacja używa któregoś z nich, przemapuj Luci w `keys`, np. `keys: { summon: 'q', panel: 'p' }`. W reveal.js `O` otwiera przegląd slajdów, więc tam zawsze daj `keys: { summon: 'q' }`.

## 5. Czego Luci szuka na slajdach

Każdy psikus potrzebuje rekwizytu. Gdy go nie ma, Luci wybiera inny numer, więc nic się nie psuje. Nie przebudowuj treści pod Luci; to tylko informacja, czego się spodziewać:

- nagłówki `h1`–`h3`: przekrzywia literę, strąca kropkę znad „i” lub „j”, chowa się między słowami;
- `<button>`: naciska go (na niby, bez prawdziwego kliknięcia);
- punkty list, chipy, małe karty z ramką lub tłem: przesuwa je;
- akapity: psika na nie atramentem.

## 6. Test

Jeśli jest przeglądarka (Playwright z Chromium):

1. Otwórz prezentację. W konsoli nie ma błędów, a `window.Osmiornica` istnieje.
2. Wywołaj `Osmiornica.mode('demo')` i przejdź przez slajdy. Luci pojawia się na każdym, nie zasłania nawigacji, a przy zmianie slajdu się wycofuje.
3. Gdy sandbox nie ma dostępu do github.io, podstaw lokalny plik:

   ```js
   await page.route('https://lucid-academy.github.io/ai-lab/osmiornica/osmiornica.js',
     r => r.fulfill({ path: 'osmiornica/osmiornica.js', contentType: 'application/javascript' }))
   ```

Podgląd jako Artifact w Claude Code blokuje skrypty z github.io. Dołącz wtedy plik przez `files` (`{ "osmiornica.js": "osmiornica/osmiornica.js" }`) i tylko w kopii do podglądu ustaw `src="osmiornica.js"`.

## 7. Na koniec powiedz użytkownikowi

- co zostało oznaczone i dlaczego (zwłaszcza slajdy z `nie`);
- że `D` otwiera panel (kolor, tryb, każda akcja na żądanie), `0` wyłącza Luci na czas pytań, a `R` naprawia jej psikusy;
- że w podglądzie artefaktu w czacie Luci może się nie pokazać, bo czat blokuje skrypty z zewnętrznych adresów; w pobranym pliku i na GitHub Pages działa.
