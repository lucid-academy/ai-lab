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

`O` przywołaj (gdy już jest: psota; w gorszy dzień może odmówić) · `H` schowaj · `0` tryb poważny · `+` „wyszło”: ukłon i nagroda dla ostatniej psoty, przy okazji poprawia humor · `R` napraw litery · `D` panel.

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

Kolor ciała najprościej zmienić w panelu (`D` → Kolor): kilka gotowych odcieni i własny kolor z próbnika. Wybór zostaje zapamiętany na kolejne wykłady. W kodzie: `window.OSMIORNICA = { skin: '#6516D9' }` przed wczytaniem skryptu.

## Co umie

- **Wygląd:** duży, cętkowany worek płaszcza nad wąską twarzą, duże, wesołe oczy na wypukłościach (iskierki w tęczówkach, dolne powieki uniesione w uśmiechu, mały uśmiech pod oczami), fałdy brwi, które niosą większość mimiki, i grube ramiona z dużymi przyssawkami. Skóra jest w głębokim, intensywnym fiolecie, a co kilka sekund przebiega po niej fala światła: rozbłyskują obwódki, kropki na płaszczu i przyssawki.
- **Ramiona:** w spoczynku leżą luźno na podłożu, każde trochę inaczej. Przyssawki są wtedy pod spodem i widać tylko ich brzegi, a za krawędzią podestu ramiona zwisają. Co jakiś czas jedno ramię unosi koniec i obmacuje okolicę, a końcówki powoli zmieniają zwinięcie.
- **Wejścia:** zerknięcie zza dolnej krawędzi (często z machnięciem ramienia na powitanie), upadek na nagłówek z przekrzywieniem litery (wzdryga się i patrzy na literę z pytajnikiem w chmurce), drzemka (opada na slajd jak liść, z ramionami w górze jak spadochron, przeciąga się i zasypia), kamuflaż (na slajdzie otwierają się same oczy) oraz cztery sceny inspirowane Darwin's Paradox i prawdziwymi ośmiornicami:
  - **Przyklejona do szyby:** wypływa z głębi i przykleja się do ekranu od środka jak do szyby akwarium. Widać jej spód z rzędami przyssawek, rozgląda się po sali, a potem zsuwa się w dół, odklejając przyssawki od góry.
  - **Kryjówka w łupinie:** wchodzi z połówką kokosa na głowie jak w kasku, chowa się pod nią, zerka jednym okiem spod brzegu, potem unosi łupinę i się rozgląda. Szturchnięta chowa się z powrotem. Ośmiornice naprawdę noszą ze sobą łupiny i się w nich chowają.
  - **Reflektor:** skrada się nisko i płasko, a z górnego rogu omiata slajd reflektor jak w grze. Gdy światło się zbliża, Luci znika w kamuflażu i zamyka oczy, bo to oczy zdradzają ośmiornicę. Za drugim razem gasi lampę strumieniem wody.
  - **Polowanie na rybkę:** przez slajd przepływa świecąca rybka, Luci śledzi ją oczami i próbuje złapać. Zwykle chybia i udaje, że wcale jej nie zależało. Czasem złapie, przytuli i wypuści.
- **Reakcje na kliknięcie:** atrament z wabikiem w kształcie ośmiornicy (pseudomorf, prawdziwa sztuczka głowonogów), kamuflaż, chowanie się pod łupiną kokosa, foch, rzadko woda w rzutnik i przygaszony ekran. Złapana myszką wisi za czubek płaszcza, który marszczy się w fałdy. Robi naburmuszoną minę, krzyżuje ramiona i myśli o burzy. Rzucona koziołkuje i ląduje z zawrotami głowy.
- **Charakter:** ciekawska, wesoła i miejscami marudna indywidualistka. Kiedy coś jej nie pasuje (poprawiona litera, nieudane polowanie), przewraca oczami. Czasem patrzy na salę z zadowoloną, nieco bezczelną miną.
- **Humor dnia:** pogodna, ciekawska, marudna albo zaspana. Losowany raz na dzień, zmienia jej nastroje, myśli i sny. Marudna rzadziej się uśmiecha, częściej przewraca oczami, strzela focha i potrafi odmówić wyjścia. Zaspana szybciej zasypia.
- **Foch:** odwraca się plecami, krzyżuje ramiona, zerka przez ramię, czy ktoś zauważył. Szturchnięta w trakcie focha potrafi się obrazić i odpłynąć. `+` (przeprosiny) ją udobrucha.
- **Myśli i sny:** nie mówi, myśli obrazkami w neonowej chmurce: planeta, galaktyka, atom, sieć neuronowa, żarówka, kawa, zegar, burza i inne. Gdy zaśnie, sen ma zupełnie inną chmurkę: owalny kawałek nocnego nieba z gwiazdami i przerywaną poświatą, z pustymi bańkami zamiast kropek. Śni o swoich zainteresowaniach: sieć neuronowa z płynącą aktywacją, mechanizm uwagi nad tokenami, test lustra (rozpoznaje siebie), jej własny gwiazdozbiór, galaktyka, orbity i czarna dziura. Sny zmieniają się co 15 sekund, a po trzech zapada w głęboki sen bez chmurki na mniej więcej 40 sekund, żeby nie rozpraszać, gdy zostajecie dłużej na slajdzie. Śpiąca zostaje na slajdzie znacznie dłużej i budzi się, gdy podjedzie do niej kursor.
- **Wyjścia:** odrzut z pulsującym płaszczem albo zsunięcie się za dolną krawędź.
- **Nastrój:** pięć zmiennych (ciekawość, irytacja, nuda, radość, strach) zmienia kolor skóry, cętki, źrenice, powieki i brwi oraz wybór psot. Domyślnie przeważają ciekawość i radość: rozluźnione powieki, uśmiechnięte oczy, rozszerzone źrenice, a gdy czyta slajd, przechyla głowę i unosi jedną brew. Ciężkie powieki pojawiają się dopiero przy prawdziwej nudzie. Wykres nastroju jest w panelu.
- **Zaskoczenie:** wzdrygnięcie, nie wytrzeszcz. Blednie, podskakuje, podkurcza ramiona i po pół sekundy przechodzi w prawdziwą reakcję: podejrzliwość, złość albo zakłopotanie.
- **Uczenie:** po każdym `+` zapisuje, która psota zadziałała, i wybiera takie częściej (prosty „wieloręki bandyta”). Klikana częściej zaczyna płoszyć się przed kursorem. Od drugiego wykładu wita salę sceptycznym spojrzeniem i myślą ↻ („znowu wy?”). Drzemkę wybiera tym chętniej, im dłużej trwa wykład.
- Przy `prefers-reduced-motion` pojawia się i znika płynnie, bez spadania i skoków.

API: `Osmiornica.summon('foch')`, `.temper('marudna')`, `.reward()`, `.panel(true)`; nazwy akcji są w `Osmiornica.actions`.

## Dalsze kroki: LLM

Akcje są gotowym menu dla modelu. Model wybiera akcję i obrazek do chmurki, a kod je animuje, więc ruch zawsze wygląda dobrze. Luci nie mówi, więc model nie musi pisać kwestii, tylko trafnie dobrać minę i myśl. Najprościej zacząć od skryptu, który przed wykładem czyta slajdy i zapisuje do JSON-a pomysły na psoty dla każdego slajdu. Wywołanie na żywo wymaga proxy z kluczem albo uruchomienia prezentacji jako artefaktu Claude.ai.
