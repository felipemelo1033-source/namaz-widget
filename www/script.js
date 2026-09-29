let interval;

// === Datenquelle: ezan-app-main (ATF Mobil Backend) ===
// Live-Fetch statt lokaler JSON-Dateien: keine jährliche manuelle Aktualisierung
// mehr nötig, und alle Länder der Welt sind automatisch verfügbar.
const EZAN_BASE = 'https://raw.githubusercontent.com/felipemelo1033-source/ezan-app-main/main/data/';

// ezan-app-main liefert Bundesland-Namen ohne Umlaute/Bindestriche
// (z.B. "BADEN WURTTEMBERG" statt "Baden-Württemberg"). Für Deutschland
// verwenden wir daher weiterhin die korrekt geschriebenen Namen (siehe Commit be9b75a).
const GERMAN_STATE_NAMES = {
    "850": "Baden-Württemberg", "851": "Bayern", "852": "Berlin",
    "853": "Brandenburg", "854": "Bremen", "855": "Hamburg",
    "856": "Hessen", "857": "Niedersachsen", "858": "Mecklenburg-Vorpommern",
    "859": "Nordrhein-Westfalen", "860": "Rheinland-Pfalz", "861": "Saarland",
    "862": "Thüringen", "863": "Sachsen", "864": "Sachsen-Anhalt",
    "865": "Schleswig-Holstein"
};

let countriesList = null;   // [{id, code, name}]
let searchIndex = null;     // [{id, name, country, _searchName}] – weltweit
let currentCityId = null;   // ausgewählte Stadt-ID (String)
let currentCityName = null; // Rohname (GROSSBUCHSTABEN) für Anzeige/Speicherung

// Normalisiert für den Such-/Namensvergleich: Groß/Klein nach türkischer Regel,
// dann werden alle Akzent-/Umlaut-Zeichen entfernt (NFD-Zerlegung + Kombinationszeichen
// strippen). Das gleicht zwei unabhängige Probleme in einem Schritt aus:
// 1) Türkisches İ vs. normales lateinisches I ("Istanbul" soll "İSTANBUL" finden).
// 2) ezan-app-main liefert deutsche Städtenamen ohne Umlaute ("KOLN" statt "KÖLN"),
//    daher muss auch "Köln"/"Köngen" (so wie man es normal tippt) die gespeicherte
//    umlautlose Schreibweise finden.
// (İ zerlegt über NFD ebenfalls sauber in I + Punkt-Kombinationszeichen, daher reicht
// diese eine Regel für beide Fälle.)
function foldForSearch(str) {
    return (str || '').toLocaleUpperCase('tr-TR').normalize('NFD').replace(/[̀-ͯ]/g, '');
}

async function loadCountries() {
    if (countriesList) return;
    try {
        const res = await fetch(`${EZAN_BASE}locations/countries.json`);
        const countries = await res.json();
        countriesList = countries;
        const select = document.getElementById('country-select');
        select.innerHTML = '<option value="">Ülke Seçin</option>';
        countries
            .slice()
            .sort((a, b) => a.name.localeCompare(b.name, 'tr'))
            .forEach(c => {
                const opt = document.createElement('option');
                opt.value = c.id;
                opt.textContent = formatCityName(c.name);
                select.appendChild(opt);
            });
    } catch (e) {
        console.error("Ülke listesi yüklenemedi", e);
        countriesList = [];
    }
}

async function loadSearchIndex() {
    if (searchIndex) return;
    try {
        const res = await fetch(`${EZAN_BASE}locations/search_index.json`);
        searchIndex = await res.json();
        // Einmalig vorberechnen statt bei jedem Tastendruck neu zu normalisieren.
        searchIndex.forEach(c => { c._searchName = foldForSearch(c.name); });
    } catch (e) {
        console.error("Arama dizini yüklenemedi", e);
        searchIndex = [];
    }
}

async function loadStatesForCountry(countryId, savedStateId = null) {
    const stateSelect = document.getElementById('state-select');
    try {
        const res = await fetch(`${EZAN_BASE}locations/states_${countryId}.json`);
        const states = await res.json();
        stateSelect.innerHTML = '<option value="">Eyalet/Bölge Seçin</option>';
        states
            .slice()
            .sort((a, b) => a.name.localeCompare(b.name, 'tr'))
            .forEach(s => {
                const opt = document.createElement('option');
                opt.value = s.id;
                opt.textContent = formatCityName(GERMAN_STATE_NAMES[s.id] || s.name);
                if (savedStateId && String(savedStateId) === String(s.id)) opt.selected = true;
                stateSelect.appendChild(opt);
            });
        stateSelect.style.display = 'inline-block';
    } catch (e) {
        console.error("Eyalet listesi yüklenemedi", e);
    }
}

async function loadCitiesForState(stateId, savedCityId = null) {
    const citySelect = document.getElementById('city-select');
    try {
        const res = await fetch(`${EZAN_BASE}locations/cities_${stateId}.json`);
        const cities = await res.json();
        citySelect.innerHTML = '<option value="">Şehir Seçin</option>';
        cities
            .slice()
            .sort((a, b) => a.name.localeCompare(b.name, 'tr'))
            .forEach(c => {
                const opt = document.createElement('option');
                opt.value = c.id;
                opt.textContent = formatCityName(c.name);
                opt.dataset.rawname = c.name;
                if (savedCityId && String(savedCityId) === String(c.id)) opt.selected = true;
                citySelect.appendChild(opt);
            });
        citySelect.style.display = 'inline-block';
        return cities;
    } catch (e) {
        console.error("Şehir listesi yüklenemedi", e);
        return [];
    }
}

async function handleCountryChange() {
    const countryId = document.getElementById('country-select').value;
    document.getElementById('state-select').innerHTML = '<option value="">Eyalet/Bölge Seçin</option>';
    document.getElementById('state-select').style.display = 'none';
    document.getElementById('city-select').innerHTML = '';
    document.getElementById('city-select').style.display = 'none';
    if (!countryId) return;
    await loadStatesForCountry(countryId);
}

async function handleStateChange() {
    const stateId = document.getElementById('state-select').value;
    document.getElementById('city-select').innerHTML = '';
    document.getElementById('city-select').style.display = 'none';
    if (!stateId) return;
    await loadCitiesForState(stateId);
}

function handleManualCityChange() {
    const citySelect = document.getElementById('city-select');
    const opt = citySelect.options[citySelect.selectedIndex];
    if (!opt || !citySelect.value) return;
    currentCityId = citySelect.value;
    currentCityName = opt.dataset.rawname;
    urlParams.delete('city');
    urlParams.delete('state');
    urlParams.delete('country');
    update();
}

// Die Hauptfunktion für den Standort
async function detectLocation() {
    await loadCountries();
    await loadSearchIndex();
    const btn = document.getElementById('location-btn');
    const originalText = btn.innerText;
    btn.innerText = "⌛ ARANIYOR...";

    if (!navigator.geolocation) {
        alert("Tarayıcınız konum özelliğini desteklemiyor.");
        btn.innerText = originalText;
        return;
    }

    navigator.geolocation.getCurrentPosition(async (position) => {
        const lat = position.coords.latitude;
        const lon = position.coords.longitude;

        try {
            // Reverse Geocoding API
            const response = await fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lon}&localityLanguage=tr`);
            const data = await response.json();

            const detectedCity = foldForSearch(data.city || data.locality || "");
            const detectedCountryName = (data.countryName || "").toUpperCase();
            const country = countriesList.find(c => c.code.toUpperCase() === detectedCountryName);

            const cityMatch = (country && searchIndex.find(c => String(c.country) === String(country.id) && c._searchName === detectedCity))
                || searchIndex.find(c => c._searchName === detectedCity);

            if (cityMatch) {
                currentCityId = String(cityMatch.id);
                currentCityName = cityMatch.name;

                if (country) {
                    document.getElementById('country-select').value = country.id;
                    await loadStatesForCountry(country.id);
                }
                document.getElementById('state-select').value = '';
                document.getElementById('city-select').innerHTML = '';
                document.getElementById('city-select').style.display = 'none';
                document.getElementById('city-search-input').value = formatCityName(cityMatch.name);

                // Erst die Anzeige fertig aktualisieren, DANACH die blockierende
                // Bestätigung zeigen — alert() pausiert die JS-Ausführung, sonst
                // bliebe update() (Vakit-Fetch, Titel) bis zum Wegklicken haengen
                // und es sah so aus, als waere gar nichts passiert.
                await update();
                alert("Konum belirlendi: " + formatCityName(cityMatch.name));
            } else {
                alert("Şehir bulunamadı: " + detectedCity);
            }
        } catch (error) {
            alert("Hata oluştu.");
        }
        btn.innerText = originalText;
    }, () => {
        alert("Konum izni reddedildi.");
        btn.innerText = originalText;
    });
}

function renderSearchResults(matches) {
    const resultsDiv = document.getElementById('search-results');
    resultsDiv.innerHTML = '';
    matches.forEach(m => {
        const item = document.createElement('div');
        item.className = 'search-result-item';
        item.style.cssText = 'padding: 12px; border-bottom: 1px solid #eee; cursor: pointer; text-align: left;';
        item.textContent = formatCityName(m.name);
        item.addEventListener('click', () => selectCityFromSearch(m.id, m.name, m.country));
        resultsDiv.appendChild(item);
    });
    resultsDiv.style.display = matches.length ? 'block' : 'none';
}

// Suchfunktion initialisieren
document.getElementById('city-search-input').addEventListener('input', async function(e) {
    const term = foldForSearch(e.target.value);
    const resultsDiv = document.getElementById('search-results');

    if (term.length < 2) {
        resultsDiv.style.display = 'none';
        return;
    }

    await loadSearchIndex(); // Sicherstellen, dass der weltweite Index da ist

    const matches = searchIndex.filter(c => c._searchName.includes(term)).slice(0, 10);
    renderSearchResults(matches);
});

// Funktion, wenn eine Stadt aus der Suche angeklickt wird
async function selectCityFromSearch(cityId, cityName, countryId) {
    currentCityId = String(cityId);
    currentCityName = cityName;

    document.getElementById('city-search-input').value = formatCityName(cityName);
    document.getElementById('search-results').style.display = 'none';

    // Land-Dropdown zur Orientierung mitziehen; Eyalet/Stadt bleiben frei wählbar,
    // da die Suche die Stadt direkt per ID findet (ohne den Umweg über ein Bundesland).
    if (countryId) {
        document.getElementById('country-select').value = String(countryId);
        await loadStatesForCountry(countryId);
    }
    document.getElementById('state-select').value = '';
    document.getElementById('city-select').innerHTML = '';
    document.getElementById('city-select').style.display = 'none';

    update();
}

const urlParams = new URLSearchParams(window.location.search);
const vakitNamen = ["İmsak", "Güneş", "Öğle", "İkindi", "Akşam", "Yatsı"];

// Manche Browser/Adressleisten schreiben Teile der URL beim Autovervollständigen
// klein (z.B. "nagold" statt "NAGOLD"). Die Staedtenamen in den Datendateien
// sind aber immer GROSS geschrieben, daher hier immer normalisieren.
function getCityParam() {
    const c = urlParams.get('city');
    return c ? foldForSearch(c) : c;
}

function formatCityName(name) {
    if (!name) return "";
    const lowerCaseWords = ["an", "der", "den", "dem", "am", "im", "bei", "und", "d.", "a.", "v."];
    let words = name.toLowerCase().split(' ');
    const result = words.map((word, index) => {
        const cap = (w) => {
            if (w.includes('(')) return w.split('(').map(p => p.charAt(0).toUpperCase() + p.slice(1)).join('(');
            return w.charAt(0).toUpperCase() + w.slice(1);
        }
        if (word.includes('-')) return word.split('-').map(p => cap(p)).join('-');
        return (index === 0 || !lowerCaseWords.includes(word)) ? cap(word) : word;
    }).join(' ');
    // (Nicht-lokalisiertes) toLowerCase()/toUpperCase() zerlegt das türkische İ in
    // "I" + separates Punkt-Kombinationszeichen (Unicode-Standardverhalten). Als zwei
    // Zeichen platzieren viele Schriftarten den Punkt falsch statt sauber über dem I –
    // NFC setzt es wieder zu einem einzigen İ-Zeichen zusammen, das jede Schriftart
    // korrekt wie ein normales Zeichen rendert.
    return result.normalize('NFC');
}

function toggleWeekly() {
    const el = document.getElementById('weekly-table-wrapper');
    const label = document.getElementById('weekly-toggle-label');

    if (el.style.display === 'none') {
        el.style.display = 'block';
        label.innerText = "7 GÜNLÜK VAKİTLERİ GİZLE";
    } else {
        el.style.display = 'none';
        label.innerText = "7 GÜNLÜK VAKİTLERİ GÖSTER";
    }
}

function renderWeekly(cityData, cityName) {
    const body = document.getElementById('weekly-body');
    body.innerHTML = "";
    if (urlParams.has('admin')) return;
    document.getElementById('weekly-container').style.display = 'block';
    const today = new Date();
    for (let i = 0; i < 7; i++) {
        const d = new Date(today); d.setDate(today.getDate() + i);
        const k = d.toLocaleDateString('de-DE', {day:'2-digit', month:'2-digit', year:'numeric'});
        const day = cityData[k];
        if (day) {
            const row = `<tr><td><b>${k}</b></td><td>${day.vakitler[0]}</td><td>${day.vakitler[1]}</td><td>${day.vakitler[2]}</td><td>${day.vakitler[3]}</td><td>${day.vakitler[4]}</td><td>${day.vakitler[5]}</td></tr>`;
            body.innerHTML += row;
        }
    }
}

function updateCurrentDate() {
    const jetzt = new Date();

    // Datumsteil (z.B. 27 Ocak 2026)
    const datePart = jetzt.toLocaleDateString('tr-TR', {
        day: 'numeric',
        month: 'long',
        year: 'numeric'
    });

    // Wochentag (z.B. Salı)
    const dayPart = jetzt.toLocaleDateString('tr-TR', {
        weekday: 'long'
    });

    // Zusammenfügen im gewünschten Format
    document.getElementById('güncel-tarih').innerText = `${datePart} / ${dayPart}`;
}

// Stelle sicher, dass die Funktion beim Start aufgerufen wird
updateCurrentDate();

// === LIVE-UHR & AUTOMATISCHER TAGESWECHSEL ===
let lastDateKey = new Date().toLocaleDateString('de-DE', {day:'2-digit', month:'2-digit', year:'numeric'});

function tickClock() {
    const now = new Date();
    const clockEl = document.getElementById('live-clock');
    if (clockEl) {
        clockEl.innerText = now.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    }

    // Tageswechsel erkennen: Datum, Vakitler und Ayet automatisch neu laden
    // (wichtig für Bildschirme, die 24/7 durchlaufen)
    const key = now.toLocaleDateString('de-DE', {day:'2-digit', month:'2-digit', year:'numeric'});
    if (key !== lastDateKey) {
        lastDateKey = key;
        updateCurrentDate();
        update();
    }
}
tickClock();
setInterval(tickClock, 1000);

// === AYET AUTO-FIT (nur TV-/Admin-Modus) ===
// Verkleinert die Ayet-Schrift schrittweise, falls ein langer Text
// die Bildschirmseite überlaufen lassen würde – so bleibt alles auf einer Seite.
function fitAyetToScreen() {
    if (!document.body.classList.contains('admin-mode')) return;
    const container = document.querySelector('.container');
    const ayet = document.getElementById('ayet-text');
    if (!container || !ayet) return;

    let size = 2.8; // vh – Basisgröße, identisch zur CSS-Regel
    ayet.style.fontSize = size + 'vh';

    let guard = 0;
    while (container.scrollHeight > container.clientHeight + 1 && size > 1.4 && guard < 40) {
        size -= 0.1;
        ayet.style.fontSize = size + 'vh';
        guard++;
    }
}

// Bei Fenster-/Auflösungsänderung neu anpassen
window.addEventListener('resize', () => requestAnimationFrame(fitAyetToScreen));

async function update() {
    const ayetCont = document.getElementById('ayet-container');

    if (urlParams.has('admin')) {
        // Blendet die Dropdown-Menüs aus
        if (document.getElementById('picker-area')) {
            document.getElementById('picker-area').style.display = 'none';
        }
        // Blendet das neue Suchfeld aus
        if (document.querySelector('.search-wrapper')) {
            document.querySelector('.search-wrapper').style.display = 'none';
        }
    }

    // Ayet laden
    try {
        const aRes = await fetch(`./data/ayetler.json?v=${Date.now()}`);
        const aData = await aRes.json();
        const dKey = new Date().toLocaleDateString('de-DE', {day:'2-digit', month:'2-digit', year:'numeric'});

        if (aData[dKey]) {
            document.getElementById('ayet-text').innerText = aData[dKey].text;
            document.getElementById('ayet-quelle').innerText = aData[dKey].quelle;
            ayetCont.style.display = 'block'; // WICHTIG: Hier wird es sichtbar gemacht
            requestAnimationFrame(fitAyetToScreen); // langen Ayet auf eine Seite einpassen
        } else {
            ayetCont.style.display = 'none'; // Verstecken, wenn kein Ayet da ist
        }
    } catch(e) {
        console.error("Ayet yüklenemedi:", e);
        ayetCont.style.display = 'none';
    }

    if (!currentCityId) return;

    // LocalStorage Speicherung (nicht bei fest vorgegebener TV-URL)
    if (!urlParams.get('city')) {
        localStorage.setItem('userCityId', currentCityId);
        localStorage.setItem('userCityName', currentCityName || '');
        // Immer mitspeichern (auch leer), damit z.B. nach einer Suche kein
        // verwaistes altes Bundesland übrig bleibt, das nicht mehr zur Stadt passt.
        localStorage.setItem('userCountryId', document.getElementById('country-select').value || '');
        localStorage.setItem('userStateId', document.getElementById('state-select').value || '');
    }

    document.getElementById('main-widget').style.opacity = "1";
    document.getElementById('city-title').innerText = formatCityName(currentCityName || '');

    try {
        const res = await fetch(`${EZAN_BASE}vakitler/${currentCityId}.json`);
        const json = await res.json();
        const days = (json && json.data) || [];
        const cityAll = {};
        days.forEach(d => {
            cityAll[d.gregorianDateShort] = {
                hicri: d.hijriDateLong,
                vakitler: [d.fajr, d.sunrise, d.dhuhr, d.asr, d.maghrib, d.isha]
            };
        });

        const dKey = new Date().toLocaleDateString('de-DE', {day:'2-digit', month:'2-digit', year:'numeric'});
        if (cityAll[dKey]) {
            document.getElementById('hicri-tarih').innerText = cityAll[dKey].hicri;
            renderTimes(cityAll[dKey].vakitler, cityAll);
            renderWeekly(cityAll, currentCityName);
        }
    } catch(e) {
        console.error("Vakitler yüklenemedi:", e);
    }
}

function renderTimes(times, cityAll) {
    let currentIdx = -1;
    const now = new Date();

    // 1. Alle Zeiten auf die Boxen schreiben
    times.forEach((t, i) => {
        document.getElementById('t-' + i).innerText = t;
        document.getElementById('box-' + i).classList.remove('active');
    });

    // 2. Bestimme die aktuelle Gebetszeit
    // Wir laufen rückwärts durch die Zeiten (von Yatsı bis İmsak)
    // Die erste Zeit, die kleiner oder gleich "jetzt" ist, ist die aktuelle Phase.
    for (let i = times.length - 1; i >= 0; i--) {
        const [h, m] = times[i].split(':').map(Number);
        const pDate = new Date(now);
        pDate.setHours(h, m, 0, 0);

        if (now >= pDate) {
            currentIdx = i;
            break;
        }
    }

    // Sonderfall: Wenn "now" vor der ersten Zeit (İmsak) liegt, ist noch Yatsı vom Vortag aktiv
    if (currentIdx === -1) {
        currentIdx = 5; // Markiere Yatsı
    }

    // 3. Markiere die aktuelle Zeit
    if (currentIdx !== -1) {
        document.getElementById('box-' + currentIdx).classList.add('active');
    }

    // 4. Countdown für die NÄCHSTE Zeit berechnen (Logik bleibt für den Timer gleich)
    let next = null;
    let nextIdx = -1;

    times.forEach((t, i) => {
        const [h, m] = t.split(':').map(Number);
        const pDate = new Date(now);
        pDate.setHours(h, m, 0, 0);
        if (!next && pDate > now) {
            next = pDate;
            nextIdx = i;
        }
    });

    // Falls kein Gebet mehr heute (nach Yatsı), nimm das erste Gebet von morgen
    if (!next) {
        const tom = new Date(now);
        tom.setDate(tom.getDate() + 1);
        const tk = tom.toLocaleDateString('de-DE', {day:'2-digit', month:'2-digit', year:'numeric'});
        if (cityAll[tk]) {
            const [h, m] = cityAll[tk].vakitler[0].split(':').map(Number);
            next = new Date(tom);
            next.setHours(h, m, 0, 0);
            nextIdx = 0;
        }
    }

    if (nextIdx !== -1) {
        document.getElementById('next-vakit-name').innerHTML = "<strong>" + vakitNamen[nextIdx] + "</strong> Vaktine";
        startCountdown(next);
    }
}

function startCountdown(target) {
    if (interval) clearInterval(interval);
    interval = setInterval(() => {
        const diff = target - new Date();
        if (diff <= 0) { update(); return; }
        document.getElementById('hours').innerText = String(Math.floor(diff/3600000)).padStart(2,'0');
        document.getElementById('minutes').innerText = String(Math.floor((diff%3600000)/60000)).padStart(2,'0');
        document.getElementById('seconds').innerText = String(Math.floor((diff%60000)/1000)).padStart(2,'0');
    }, 1000);
}

// Initialer Start beim Laden der Seite
async function init() {
    await loadCountries();

    const urlCountry = urlParams.get('country');
    const urlState = urlParams.get('state');
    const urlCityName = getCityParam(); // aus ?city=... (alte TV-URLs, ohne Land)

    const savedCountry = localStorage.getItem('userCountryId');
    const savedState = localStorage.getItem('userStateId');
    const savedCityId = localStorage.getItem('userCityId');
    const savedCityName = localStorage.getItem('userCityName');

    // Alte TV-URLs (?admin&city=...&state=...) hatten kein "country" – das waren
    // immer deutsche Bundesland-IDs (850-865), daher hier Deutschland annehmen.
    let countryId = urlCountry || (urlState ? '13' : null) || savedCountry;
    let stateId = urlState || savedState;

    if (!countryId && !stateId && !savedCityId) {
        // Erststart ohne gespeicherte Auswahl: Deutschland als Standard vorauswählen
        countryId = '13';
    }

    if (countryId) {
        document.getElementById('country-select').value = countryId;
        await loadStatesForCountry(countryId, stateId);
    }

    if (stateId) {
        document.getElementById('state-select').value = stateId;
        const cities = await loadCitiesForState(stateId);

        if (urlCityName) {
            const match = cities.find(c => foldForSearch(c.name) === urlCityName);
            if (match) {
                currentCityId = String(match.id);
                currentCityName = match.name;
                document.getElementById('city-select').value = match.id;
            }
        } else if (savedCityId && cities.some(c => String(c.id) === String(savedCityId))) {
            currentCityId = savedCityId;
            currentCityName = savedCityName;
            document.getElementById('city-select').value = savedCityId;
        }
    } else if (savedCityId && savedCityName) {
        // Stadt aus vorheriger Sitzung ohne gespeichertes Bundesland (z.B. per Suche gewählt)
        currentCityId = savedCityId;
        currentCityName = savedCityName;
        document.getElementById('city-search-input').value = formatCityName(savedCityName);
    }

    update();

    if (urlParams.has('admin')) {
        document.body.classList.add('admin-mode');
    }
}

// Liste schließen, wenn man außerhalb klickt
document.addEventListener('click', function(e) {
    if (!document.querySelector('.search-wrapper').contains(e.target)) {
        document.getElementById('search-results').style.display = 'none';
    }
});

document.addEventListener('DOMContentLoaded', () => {
    init();
});
