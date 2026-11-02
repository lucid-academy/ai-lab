/**
 * Ankieta ewaluacyjna Lucid Academy — zaplecze w Google Sheets (Google Apps Script).
 *
 * Co robi:
 *   POST  (z ewaluacja/index.html)              -> dopisuje anonimową odpowiedź do arkusza „Odpowiedzi”
 *   GET   ?action=config                         -> lista szkoleń z arkusza „Szkolenia” (dla formularza)
 *   GET   ?action=list&key=TAJNY_KLUCZ           -> wszystkie odpowiedzi (dla panel.html)
 *   Każdy GET przyjmuje też &callback=fn (JSONP), na wypadek gdyby przeglądarka blokowała fetch.
 *
 * Instalacja (raz, ok. 5 minut) — szczegóły w ewaluacja/README.md:
 *   1. Nowy Arkusz Google -> Rozszerzenia -> Apps Script -> wklej ten plik.
 *   2. Uruchom funkcję `setup` (utworzy arkusze i losowy klucz administratora; klucz zobaczysz w Dzienniku).
 *   3. Wdróż -> Nowe wdrożenie -> Aplikacja internetowa; „Wykonuj jako: Ja”, „Kto ma dostęp: Każdy”.
 *   4. Skopiuj adres URL kończący się na /exec i wpisz go w ENDPOINT w index.html i panel.html.
 *
 * Anonimowość: skrypt nie zapisuje adresu IP, przeglądarki ani żadnych danych osobowych.
 */

var SHEET_ANSWERS = 'Odpowiedzi';
var SHEET_TRAININGS = 'Szkolenia';

var COLUMNS = [
  'id', 'wyslano', 'data_szkolenia', 'szkolenie', 'miejsce', 'typ',
  'ocena', 'przydatnosc', 'prowadzacy', 'tempo', 'pewnosc', 'polecenie',
  'najcenniejsze', 'do_poprawy', 'zrodlo'
];

var ALLOWED = {
  typ: ['senior', 'urzednik', 'inna'],
  ocena: ['1', '2', '3', '4', '5'],
  przydatnosc: ['tak', 'raczej tak', 'raczej nie', 'nie', ''],
  prowadzacy: ['1', '2', '3', '4', '5', ''],
  tempo: ['za wolne', 'w sam raz', 'za szybkie', ''],
  pewnosc: ['tak', 'trochę', 'nie', ''],
  polecenie: ['tak', 'raczej tak', 'raczej nie', 'nie', '']
};

var DEFAULT_TRAININGS = [
  'Sprawdź, zanim zaufasz (eFajfy)',
  'Warsztaty AI',
  'Wykład o AI'
];

function setup() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var a = ss.getSheetByName(SHEET_ANSWERS) || ss.insertSheet(SHEET_ANSWERS);
  if (a.getLastRow() === 0) {
    a.appendRow(COLUMNS);
    a.setFrozenRows(1);
    a.getRange(1, 1, 1, COLUMNS.length).setFontWeight('bold');
  }
  var t = ss.getSheetByName(SHEET_TRAININGS) || ss.insertSheet(SHEET_TRAININGS);
  if (t.getLastRow() === 0) {
    t.appendRow(['szkolenie (jedno w wierszu — pokazuje się w ankiecie)', 'aktywne (TAK/NIE)']);
    t.setFrozenRows(1);
    t.getRange(1, 1, 1, 2).setFontWeight('bold');
    DEFAULT_TRAININGS.forEach(function (n) { t.appendRow([n, 'TAK']); });
    t.setColumnWidth(1, 380);
  }
  var props = PropertiesService.getScriptProperties();
  var key = props.getProperty('ADMIN_KEY');
  if (!key) {
    key = Utilities.getUuid().replace(/-/g, '').slice(0, 16);
    props.setProperty('ADMIN_KEY', key);
  }
  Logger.log('Klucz do panelu administratora: ' + key);
  return key;
}

/** Gdyby trzeba było zmienić klucz: wpisz nowy tutaj, uruchom raz i usuń z kodu. */
function ustawKlucz() {
  PropertiesService.getScriptProperties().setProperty('ADMIN_KEY', 'WPISZ-NOWY-KLUCZ');
}

function doPost(e) {
  try {
    var raw = (e && e.postData && e.postData.contents) || '{}';
    var d = JSON.parse(raw);
    if (d.website) return out_({ ok: true }, e); // pułapka na boty: pole niewidoczne dla ludzi

    var row = clean_(d);
    if (!row) return out_({ ok: false, error: 'invalid' }, e);

    var lock = LockService.getScriptLock();
    lock.waitLock(10000);
    try {
      var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_ANSWERS);
      if (!sh) { setup(); sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_ANSWERS); }
      sh.appendRow(COLUMNS.map(function (c) { return row[c]; }));
    } finally {
      lock.releaseLock();
    }
    return out_({ ok: true }, e);
  } catch (err) {
    return out_({ ok: false, error: String(err) }, e);
  }
}

function doGet(e) {
  var p = (e && e.parameter) || {};
  if (p.action === 'config') {
    return out_({ ok: true, trainings: trainings_() }, e);
  }
  if (p.action === 'list') {
    var key = PropertiesService.getScriptProperties().getProperty('ADMIN_KEY');
    if (!key || p.key !== key) return out_({ ok: false, error: 'unauthorized' }, e);
    return out_({ ok: true, rows: rows_(), trainings: trainings_() }, e);
  }
  return out_({ ok: true, info: 'Ankieta ewaluacyjna Lucid Academy' }, e);
}

function clean_(d) {
  function s(v, max) { return String(v == null ? '' : v).replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, max || 200); }
  var r = {
    id: Utilities.getUuid().slice(0, 8),
    wyslano: new Date().toISOString(),
    data_szkolenia: s(d.data_szkolenia, 10),
    szkolenie: s(d.szkolenie, 120),
    miejsce: s(d.miejsce, 120),
    typ: s(d.typ, 20),
    ocena: s(d.ocena, 1),
    przydatnosc: s(d.przydatnosc, 20),
    prowadzacy: s(d.prowadzacy, 1),
    tempo: s(d.tempo, 20),
    pewnosc: s(d.pewnosc, 20),
    polecenie: s(d.polecenie, 20),
    najcenniejsze: s(d.najcenniejsze, 1500),
    do_poprawy: s(d.do_poprawy, 1500),
    zrodlo: s(d.zrodlo, 30)
  };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(r.data_szkolenia)) return null;
  if (!r.szkolenie) return null;
  for (var k in ALLOWED) if (ALLOWED[k].indexOf(r[k]) < 0) return null;
  // Arkusz nie może potraktować tekstu jak formuły
  ['szkolenie', 'miejsce', 'najcenniejsze', 'do_poprawy', 'zrodlo'].forEach(function (k) {
    if (/^[=+\-@]/.test(r[k])) r[k] = "'" + r[k];
  });
  return r;
}

function rows_() {
  var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_ANSWERS);
  if (!sh || sh.getLastRow() < 2) return [];
  var v = sh.getRange(1, 1, sh.getLastRow(), sh.getLastColumn()).getDisplayValues();
  var head = v.shift();
  return v.map(function (r) {
    var o = {};
    head.forEach(function (h, i) { o[h] = r[i]; });
    return o;
  });
}

function trainings_() {
  var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_TRAININGS);
  if (!sh || sh.getLastRow() < 2) return DEFAULT_TRAININGS;
  return sh.getRange(2, 1, sh.getLastRow() - 1, 2).getDisplayValues()
    .filter(function (r) { return r[0] && String(r[1]).trim().toUpperCase() !== 'NIE'; })
    .map(function (r) { return String(r[0]).trim(); });
}

function out_(obj, e) {
  var cb = e && e.parameter && e.parameter.callback;
  if (cb && /^[A-Za-z_$][\w$]{0,40}$/.test(cb)) {
    return ContentService.createTextOutput(cb + '(' + JSON.stringify(obj) + ')')
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
