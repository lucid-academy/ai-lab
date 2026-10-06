# Lucek: ośmiornica-psotnica do prezentacji

Fioletowa ośmiornica, która od czasu do czasu wpada na slajd, przekrzywia literę w nagłówku i układa się obok tekstu. Reaguje na kliknięcia, uczy się, co bawi salę, i pamięta poprzednie wykłady. Jest to jeden plik JS bez zależności, rysowany na canvasie nad prezentacją.

Demo: `osmiornica/index.html`. Strzałki zmieniają slajdy, `D` otwiera panel prowadzącego, `O` przywołuje ośmiornicę.

## Wpięcie we własną prezentację

```html
<script>window.OSMIORNICA = { mode: 'lecture' }</script>  <!-- opcjonalnie -->
<script src="osmiornica.js" defer></script>
```

Zmiany slajdów są wykrywane automatycznie w reveal.js oraz w prezentacjach, które przełączają klasę `active`, `present` lub `current` na `section` / `.slide`. W innym przypadku wystarczy po zmianie slajdu wysłać zdarzenie:

```js
document.dispatchEvent(new CustomEvent('slidechange', { detail: { slide: el } }))
```

## Atrybuty w HTML

| Atrybut | Działanie |
|---|---|
| `data-osmiornica="nie"` na slajdzie | nigdy się tu nie pojawia (trudne treści, demo na żywo) |
| `data-osmiornica="tu"` | pojawia się zawsze |
| `data-osmiornica="final"` | finał: spada na nagłówek i się kłania |
| `data-osmiornica-cel` | nagłówek lub element, który woli psocić |
| `data-osmiornica-podest` | coś, na czym może usiąść (obrazek, karta) |
| `data-osmiornica-przeszkoda` | tu nie siada (pasek nawigacji, logo) |

## Klawisze prowadzącego

`O` przywołaj (gdy już jest: psota) · `H` schowaj · `0` tryb poważny · `W` „to jego wina” (gdy padnie wideo) · `+` „wyszło”: ukłon i nagroda dla ostatniej psoty · `R` napraw litery · `D` panel.

Przekrzywioną literę naprawia się też kliknięciem. Klawisze ośmiornicy mają pierwszeństwo przed prezentacją. W reveal.js `O` otwiera przegląd slajdów, więc warto je przemapować: `window.OSMIORNICA = { keys: { summon: 'q' } }`. Przycisk „czarny ekran” w pilocie zwykle wysyła `B` albo kropkę, więc można go przypisać do przywołania i nie podchodzić do laptopa.

## Ustawienia (`window.OSMIORNICA`)

| Klucz | Domyślnie | Znaczenie |
|---|---|---|
| `mode` | `'lecture'` | `'lecture'`: rzadkie, kontrolowane wejścia; `'demo'`: na każdym slajdzie |
| `name` | `'Lucek'` | imię w panelu |
| `firstAfterMin` | `3` | wykład: najwcześniej po tylu minutach |
| `minGapMin` | `9` | wykład: minimalna przerwa między wejściami |
| `maxAppearances` | `6` | wykład: limit wejść na sesję |
| `stayMin` | `1.2` | po tylu minutach na jednym slajdzie sama się zbiera |
| `size` | `0.105` | wielkość względem wysokości ekranu |
| `memory` | `true` | pamięć w `localStorage` (sesje, kliknięcia, co działało) |
| `skin`, `glow` | fiolet i cyjan Lucid | kolory ciała i poświaty |

## Co umie

- **Wejścia:** zerknięcie zza dolnej krawędzi, upadek na nagłówek z przekrzywieniem litery, kamuflaż (na slajdzie otwierają się same oczy), ramię z własną wolą (litera odpływa „sama”, a potem ośmiornica wychodzi z kamuflażu, przyłapana).
- **Reakcje na kliknięcie:** atrament z wabikiem w kształcie ośmiornicy (pseudomorf, prawdziwa sztuczka głowonogów), opóźniona reakcja, kamuflaż, ramię sięgające do kursora, rzadko woda w rzutnik i przygaszony ekran. Można ją złapać i rzucić.
- **Wyjścia:** odrzut z pulsującym płaszczem albo wpłynięcie w literę „o” (ośmiornica przejdzie przez każdą szczelinę większą od dzioba).
- **Nastrój:** pięć zmiennych (ciekawość, irytacja, nuda, radość, strach) zmienia kolor skóry, plamki, źrenice i powieki oraz wybór psot. Ignorowana się nudzi i robi śmielsze psoty. Wykres nastroju jest w panelu.
- **Uczenie:** po każdym `+` zapisuje, która psota zadziałała, i wybiera takie częściej (prosty „wieloręki bandyta”). Klikana częściej zaczyna płoszyć się przed kursorem. Od drugiego wykładu wita salę zdaniem „…znowu wy?”.
- Przy `prefers-reduced-motion` pojawia się i znika płynnie, bez spadania i skoków.

## Dalsze kroki: LLM

Akcje są gotowym menu dla modelu. Model wybiera akcję i krótką kwestię, a kod je animuje, więc ruch zawsze wygląda dobrze. Najprościej zacząć od skryptu, który przed wykładem czyta slajdy i zapisuje do JSON-a pomysły na psoty dla każdego slajdu. Wywołanie na żywo wymaga proxy z kluczem albo uruchomienia prezentacji jako artefaktu Claude.ai.
