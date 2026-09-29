let interval;
let masterIndex = null;

// Lädt die Master-Datenbank
async function loadMasterIndex() {
    if (masterIndex) return; // Schon geladen
    try {
        const res = await fetch('./data/master_index.json');
        masterIndex = await res.json();
    } catch (e) {
        console.error("Master Index yüklenemedi");
    }
}

// Die Hauptfunktion für den Standort
async function detectLocation() {
    await loadMasterIndex();
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
            
            // Stadtname in Großbuchstaben (Türkisch-kompatibel)
            const detectedCity = (data.city || data.locality || "").toUpperCase('tr-TR');

            if (masterIndex && masterIndex[detectedCity]) {
                const stateId = masterIndex[detectedCity];

                // 1. Eyalet seç
                document.getElementById('state-select').value = stateId;

                // 2. Şehirleri yükle (Senin fonksiyonun)
                // Wir übergeben detectedCity, damit updateCities es direkt selektiert
                await updateCities(detectedCity);

                // 3. Vakitleri güncelle (Senin fonksiyonun)
                update();

                alert("Konum belirlendi: " + formatCityName(detectedCity));
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

// Suchfunktion initialisieren
document.getElementById('city-search-input').addEventListener('input', async function(e) {
    const term = e.target.value.toUpperCase('tr-TR');
    const resultsDiv = document.getElementById('search-results');
    
    if (term.length < 2) {
        resultsDiv.style.display = 'none';
        return;
    }

    await loadMasterIndex(); // Sicherstellen, dass Index da ist
    
    const matches = Object.keys(masterIndex).filter(city => city.includes(term)).slice(0, 10);
    
    if (matches.length > 0) {
        resultsDiv.innerHTML = matches.map(city => `
            <div onclick="selectCityFromSearch('${city}')" 
                style="padding: 12px; border-bottom: 1px solid #eee; cursor: pointer; text-align: left;">
                ${formatCityName(city)}
            </div>
        `).join('');
        resultsDiv.style.display = 'block';
    } else {
        resultsDiv.style.display = 'none';
    }
});

// Funktion, wenn eine Stadt aus der Suche angeklickt wird
async function selectCityFromSearch(cityName) {
    const stateId = masterIndex[cityName];
    
    // UI Update
    document.getElementById('state-select').value = stateId;
    document.getElementById('city-search-input').value = formatCityName(cityName);
    document.getElementById('search-results').style.display = 'none';

    // Deine Funktionen aufrufen
    await updateCities(cityName);
    update();
}

let currentStateIndex = {};
const urlParams = new URLSearchParams(window.location.search);
const vakitNamen = ["İmsak", "Güneş", "Öğle", "İkindi", "Akşam", "Yatsı"];

// Manche Browser/Adressleisten schreiben Teile der URL beim Autovervollständigen
// klein (z.B. "nagold" statt "NAGOLD"). Die Staedtenamen in den Datendateien
// sind aber immer GROSS geschrieben, daher hier immer normalisieren.
function getCityParam() {
    const c = urlParams.get('city');
    return c ? c.toUpperCase('tr-TR') : c;
}

function formatCityName(name) {
    if (!name) return "";
    const lowerCaseWords = ["an", "der", "den", "dem", "am", "im", "bei", "und", "d.", "a.", "v."];
    let words = name.toLowerCase().split(' ');
    return words.map((word, index) => {
        const cap = (w) => {
            if (w.includes('(')) return w.split('(').map(p => p.charAt(0).toUpperCase() + p.slice(1)).join('(');
            return w.charAt(0).toUpperCase() + w.slice(1);
        }
        if (word.includes('-')) return word.split('-').map(p => cap(p)).join('-');
        return (index === 0 || !lowerCaseWords.includes(word)) ? cap(word) : word;
    }).join(' ');
}

async function updateCities(savedCityId = null) {
    const stateId = document.getElementById('state-select').value;
    const citySelect = document.getElementById('city-select');
    if (!stateId) { citySelect.style.display = 'none'; return; }
    try {
        const res = await fetch(`./data/${stateId}/index.json`);
        currentStateIndex = await res.json();
        citySelect.innerHTML = '<option value="">Şehir Seçin</option>';
        Object.keys(currentStateIndex).sort().forEach(c => {
            let opt = document.createElement('option');
            opt.value = c; opt.text = formatCityName(c);
            if(savedCityId === c) opt.selected = true;
            citySelect.appendChild(opt);
        });

        if (savedCityId) {
            citySelect.value = savedCityId;
        }

        citySelect.style.display = 'inline-block';
    } catch (e) {}
}

function toggleWeekly() {
    const el = document.getElementById('weekly-table-wrapper');
    const label = document.getElementById('weekly-toggle-text');
    
    if (el.style.display === 'none') {
        el.style.display = 'block';
        label.innerText = "📅 7 GÜNLÜK VAKİTLERİ GİZLE";
    } else {
        el.style.display = 'none';
        label.innerText = "📅 7 GÜNLÜK VAKİTLERİ GÖSTER";
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
    const stateSelect = document.getElementById('state-select');
    const citySelect = document.getElementById('city-select');
    const stateId = stateSelect.value;
    const city = getCityParam() || citySelect.value;
    const ayetCont = document.getElementById('ayet-container');
    
if (urlParams.has('admin')) {
    // Blendet die Dropdown-Menüs aus
    if(document.getElementById('picker-area')) {
        document.getElementById('picker-area').style.display = 'none';
    }
    // Blendet das neue Suchfeld aus
    if(document.querySelector('.search-wrapper')) {
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

    // LocalStorage Speicherung
    if (!urlParams.get('city') && city && stateId) {
        localStorage.setItem('userCity', city);
        localStorage.setItem('userState', stateId);
    }

    if (!city || !stateId || !currentStateIndex[city]) return;

    document.getElementById('main-widget').style.opacity = "1";
    document.getElementById('city-title').innerText = formatCityName(city);

    try {
        const res = await fetch(`./data/${stateId}/${currentStateIndex[city]}`);
        const data = await res.json();
        const dKey = new Date().toLocaleDateString('de-DE', {day:'2-digit', month:'2-digit', year:'numeric'});
        if (data[city] && data[city][dKey]) {
            document.getElementById('hicri-tarih').innerText = data[city][dKey].hicri;
            renderTimes(data[city][dKey].vakitler, data[city]);
            renderWeekly(data[city], city);
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

function handleManualCityChange() { urlParams.delete('city'); update(); }

// Initialer Start beim Laden der Seite
async function init() {
    const sCity = getCityParam() || localStorage.getItem('userCity');
    const sState = urlParams.get('state') || localStorage.getItem('userState');
    
    if (sState) {
        document.getElementById('state-select').value = sState;
        // Warten, bis die Städte für dieses Bundesland geladen sind
        await updateCities(sCity); 
        // Dann die Zeiten anzeigen
        update();
    } else {
        update();
    }
	
	// In der init() oder update() Funktion ergänzen:
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