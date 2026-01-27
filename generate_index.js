const fs = require('fs');
const path = require('path');

// Da das Skript direkt im /dev Ordner liegt, ist das Daten-Verzeichnis einfach ./data
const dataDir = path.join(__dirname, 'www', 'data'); 
const outputFile = path.join(dataDir, 'master_index.json');

let masterIndex = {};

if (!fs.existsSync(dataDir)) {
    console.error("Hata: 'data' klasörü bulunamadı! Lütfen /dev klasöründe olduğunuzdan emin olun.");
    process.exit(1);
}

// Alle Ordner im data-Verzeichnis lesen (850, 851, etc.)
const states = fs.readdirSync(dataDir).filter(file => {
    return fs.statSync(path.join(dataDir, file)).isDirectory();
});

console.log(`${states.length} Eyalet klasörü bulundu. İşleniyor...`);

states.forEach(stateId => {
    const indexPath = path.join(dataDir, stateId, 'index.json');
    
    if (fs.existsSync(indexPath)) {
        try {
            const stateCities = JSON.parse(fs.readFileSync(indexPath, 'utf8'));
            for (let cityName in stateCities) {
                // Wir speichern den Stadtnamen als Key und die Eyalet-ID als Wert
                masterIndex[cityName.toUpperCase()] = stateId;
            }
        } catch (e) {
            console.error(`Hata: ${stateId} içindeki index.json okunamadı.`);
        }
    }
});

// Die finale master_index.json schreiben
fs.writeFileSync(outputFile, JSON.stringify(masterIndex, null, 2));

console.log(`Bitti! ${Object.keys(masterIndex).length} şehir 'master_index.json' dosyasına kaydedildi.`);