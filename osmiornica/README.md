# Luci: ośmiornica z humorkiem do prezentacji

Ciemnofioletowa, neonowa ośmiornica, która od czasu do czasu wpada na slajd, przekrzywia literę w nagłówku i układa się obok tekstu. Ma swój humor dnia, potrafi strzelić focha, myśli obrazkami i śni o AI, świadomości i kosmosie. Nie mówi: wszystko pokazuje miną, emotkami i chmurkami. Reaguje na kliknięcia, uczy się, co bawi salę, i pamięta poprzednie wykłady. Jest to jeden plik JS bez zależności, rysowany na canvasie nad prezentacją.

Demo: `osmiornica/index.html`. Strzałki zmieniają slajdy, `D` otwiera panel prowadzącego, `O` przywołuje Luci.

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
| `data-osmiornica-cel` | nagłówek lub element, przy którym woli psocić |
| `data-osmiornica-podest` | coś, na czym może usiąść (obrazek, karta) |
| `data-osmiornica-przeszkoda` | tu nie siada (pasek nawigacji, logo) |

## Klawisze prowadzącego

`O` przywołaj (gdy już jest: psota; w gorszy dzień może odmówić) · `H` schowaj · `0` tryb poważny · `+` „wyszło”: ukłon i nagroda dla ostatniej psoty, przy okazji poprawia humor · `R` napraw litery, przesunięte punkty i kropkę nad i · `D` panel.

Przekrzywioną literę naprawia się też kliknięciem. Klawisze ośmiornicy mają pierwszeństwo przed prezentacją. W reveal.js `O` otwiera przegląd slajdów, więc warto je przemapować: `window.OSMIORNICA = { keys: { summon: 'q' } }`. Przycisk „czarny ekran” w pilocie zwykle wysyła `B` albo kropkę, więc można go przypisać do przywołania i nie podchodzić do laptopa.

## Ustawienia (`window.OSMIORNICA`)

| Klucz | Domyślnie | Znaczenie |
|---|---|---|
| `mode` | `'lecture'` | `'lecture'`: rzadkie, kontrolowane wejścia; `'demo'`: na każdym slajdzie |
| `name` | `'Luci'` | imię w panelu (np. `'Lucy'`) |
| `firstAfterMin` | `3` | wykład: najwcześniej po tylu minutach |
| `minGapMin` | `9` | wykład: minimalna przerwa między wejściami |
| `maxAppearances` | `6` | wykład: limit wejść na sesję |
| `stayMin` | `1.2` | po tylu minutach na jednym slajdzie sama się zbiera |
| `size` | `0.105` | wielkość względem wysokości ekranu |
| `thoughts` | `true` | chmurki z myślami i snami |
| `memory` | `true` | pamięć w `localStorage` (sesje, kliknięcia, humor dnia, co działało) |
| `skin`, `belly`, `glow`, `neon` | ciemny fiolet `#6516D9`, magenta, cyjan, neon | kolory ciała, spodu ramion, poświaty i obwódki |

Kolor ciała najprościej zmienić w panelu (`D` → Kolor): fiolet, rdzawy (jak prawdziwa Octopus vulgaris), malinowy, błękitny albo własny kolor z próbnika. Po wyborze Luci wyskakuje na chwilę, żeby było widać zmianę. Wybór zostaje zapamiętany na kolejne wykłady. W kodzie: `window.OSMIORNICA = { skin: '#6516D9' }` przed wczytaniem skryptu.

## Co umie

Wzorem jest prawdziwa ośmiornica z małymi twistami: anatomia i zachowania są jak u żywego zwierzęcia, tylko ta akurat psoci na slajdach.

- **Wygląd:** duży, cętkowany worek płaszcza nad wąską twarzą, oczy na wypukłościach, lejek z boku i grube ramiona z przyssawkami połączone błoną. Nie ma ust ani uśmiechu. Oko wygląda jak u ośmiornicy: bez białek, cała tęczówka z poziomą, prostokątną źrenicą, która przy ekscytacji, ciekawości czy strachu rozszerza się i zaokrągla. Skóra jest w głębokim fiolecie, a co jakiś czas przebiega po niej fala światła.
- **Emocje jak u ośmiornicy:** zmienia kolor skóry (ciemnieje z irytacji, blednie ze strachu), przez oko przebiega ciemny pas (prawdziwy sygnał ostrzegawczy), nad oczami unoszą się brodawki (papille). Złość jest rzadka: gdy ktoś ją podniesie, rzuci nią albo przy fochu.
- **Spokój:** w spoczynku ramiona leżą luźno i prawie się nie ruszają. Co kilkanaście sekund jedno przesunie się albo uniesie koniec i obmacuje okolicę. We śnie nie ruszają się wcale.
- **Wejścia:** zerknięcie zza dolnej krawędzi (często z machnięciem ramienia), upadek na nagłówek z przekrzywieniem litery, drzemka (opada na slajd jak liść i zasypia), kamuflaż (na slajdzie otwierają się same oczy) i sceny oparte na zachowaniach prawdziwych ośmiornic:
  - **Kryje się między słowami:** słowa w nagłówku rozsuwają się, a ona wciska się w szczelinę w kolorze tekstu, jak dodatkowa litera z oczami. Gdy podjedzie kursor, zamyka oczy i znika w tekście. Ośmiornice żyją w szczelinach i przeciskają się przez każdą większą od dzioba.
  - **Kradnie kropkę znad i:** siada na nagłówku, strąca kropkę z „i” (albo „j”), patrzy, jak się toczy, idzie po nią i zakłada ją sobie na głowę albo zabiera ze sobą. Litera zostaje bez kropki, dopóki jej nie klikniesz.
  - **Przestawia punkt w ramce:** chwyta przyssawkami punkt listy, kafelek albo kartę i przesuwa go trochę krzywo, a czasem zamienia dwa sąsiednie miejscami. Ośmiornice przestawiają kamienie i muszle w swoich norach.
  - **Naciska przycisk:** siada przy przycisku na slajdzie, dotyka go ostrożnie, wzdryga się, a potem wciska kilka razy z coraz większą pewnością. Prezentacja tego nie słyszy, kliknięcie jest tylko na niby. Ośmiornice w laboratoriach uczą się obsługiwać przyciski i dźwignie.
  - **Atrament na treści:** celuje lejkiem w akapit i psika. Na tekście rozlewa się ciemna chmura, która wisi, dryfuje i po kilkunastu sekundach rzednie.
  - **Przyklejona do szyby:** przykleja się do ekranu od środka jak do szyby akwarium, widać spód z rzędami przyssawek, potem zsuwa się w dół.
  - **Reflektor** (w duchu Darwin's Paradox): skrada się, a gdy nadchodzi światło, znika w kamuflażu i zamyka oczy, bo to oczy zdradzają ośmiornicę. Za drugim razem gasi lampę strumieniem wody.
  - **Polowanie na rybkę:** śledzi przepływającą rybkę i rzuca się na nią ramieniem. Zwykle chybia i udaje, że wcale jej nie zależało.
- **Reakcje na kliknięcie:** atrament z wabikiem w kształcie ośmiornicy (pseudomorf), psiknięcie atramentem na treść, kamuflaż, foch, rzadko woda w rzutnik. Złapana myszką wisi za czubek płaszcza, który marszczy się w fałdy, i krzyżuje ramiona. Rzucona koziołkuje i ląduje z zawrotami głowy.
- **Charakter:** ciekawska, spokojna obserwatorka, miejscami marudna indywidualistka. Kiedy coś jej nie pasuje (poprawiona litera, nieudane polowanie), przewraca oczami.
- **Humor dnia:** pogodna, ciekawska, marudna albo zaspana. Losowany raz na dzień, zmienia jej nastroje, myśli i sny. Marudna częściej przewraca oczami, strzela focha i potrafi odmówić wyjścia. Zaspana szybciej zasypia.
- **Foch:** odwraca się plecami, krzyżuje ramiona, zerka przez ramię, czy ktoś zauważył. `+` (przeprosiny) ją udobrucha.
- **Myśli i sny:** nie mówi, myśli obrazkami w neonowej chmurce. Gdy śpi, sen ma inną chmurkę: owalny kawałek nocnego nieba. Śni o swoich zainteresowaniach: sieć neuronowa, mechanizm uwagi, test lustra, jej własny gwiazdozbiór, galaktyka, orbity, czarna dziura. Sny zmieniają się co 15 sekund, a po trzech zapada w głęboki sen bez chmurki na około 40 sekund. Śpiąca zostaje na slajdzie dłużej i budzi się, gdy podjedzie do niej kursor.
- **Naprawianie:** przekrzywioną literę, przesunięty punkt albo literę bez kropki naprawisz kliknięciem; `R` naprawia wszystko naraz (kropka wraca z powrotem na swoje miejsce).
- **Uczenie:** po każdym `+` zapisuje, która psota zadziałała, i wybiera takie częściej. Klikana częściej zaczyna płoszyć się przed kursorem. Od drugiego wykładu wita salę sceptycznym spojrzeniem i myślą ↻ („znowu wy?”).
- Przy `prefers-reduced-motion` pojawia się i znika płynnie, bez spadania i skoków.

API: `Osmiornica.summon('foch')`, `.temper('marudna')`, `.reward()`, `.panel(true)`; nazwy akcji są w `Osmiornica.actions`.

## Dalsze kroki: LLM

Akcje są gotowym menu dla modelu. Model wybiera akcję i obrazek do chmurki, a kod je animuje, więc ruch zawsze wygląda dobrze. Luci nie mówi, więc model nie musi pisać kwestii, tylko trafnie dobrać minę i myśl. Najprościej zacząć od skryptu, który przed wykładem czyta slajdy i zapisuje do JSON-a pomysły na psoty dla każdego slajdu. Wywołanie na żywo wymaga proxy z kluczem albo uruchomienia prezentacji jako artefaktu Claude.ai.
