
const fs = require('fs');
const readline = require('readline');

// Mock Score Helper (Copied from Dashboard.jsx)
const getScore = (val, type = 'positive') => {
    if (!val) return 0;
    const v = typeof val === 'string' ? val.trim() : '';

    const freqScale = ['ほとんどなかった', 'ときどきあった', 'しばしばあった', 'ほとんどいつもあった'];
    let idx = freqScale.indexOf(v);
    if (idx !== -1) {
        if (type === 'negative') return 4 - idx;
        return idx + 1;
    }

    const agreeScale = ['そうだ', 'まあそうだ', 'ややちがう', 'ちがう'];
    idx = agreeScale.indexOf(v);
    if (idx !== -1) {
        // Negative factor (Work Demand): False (3) is Good (4).
        if (type === 'negative') return idx + 1;
        return 4 - idx;
    }

    const supportScale = ['非常に', 'かなり', '多少', '全くない'];
    idx = supportScale.indexOf(v);
    if (idx !== -1) {
        return 4 - idx;
    }
    return 0; // Unknown
};

// Main processing
async function main() {
    // Read the actual CSV
    const csvPath = '/Users/kazu/Web -main/アプリ開発/ヒヤリハット集計/新ヒヤリハット報告（建災防方式）（回答） - フォームの回答 1.csv';
    const content = fs.readFileSync(csvPath, 'utf8');

    // Parse CSV (Simplified)
    const lines = content.split('\n');
    const headers = lines[0].split(',').map(s => s.trim().replace(/^"|"$/g, ''));

    // Just grab the first data row
    // Assuming row 2 (index 1) is data
    // Need to handle potential quoted values in CSV, but let's see if simple split works for now
    // Actually, simple split fails on "7. A, 9. B". Need regex or lib
    // Simple regex for CSV splitting
    const parseCSVLine = (line) => {
        const res = [];
        let inQuote = false;
        let start = 0;
        for (let i = 0; i < line.length; i++) {
            if (line[i] === '"') inQuote = !inQuote;
            if (line[i] === ',' && !inQuote) {
                res.push(line.substring(start, i).trim().replace(/^"|"$/g, ''));
                start = i + 1;
            }
        }
        res.push(line.substring(start).trim().replace(/^"|"$/g, ''));
        return res;
    };

    const rowValues = parseCSVLine(lines[1]); // First data row

    // Construct object like in Dashboard.jsx
    const row = {};
    headers.forEach((h, i) => {
        row[h] = rowValues[i];
    });

    console.log("--- ROW DATA ---");
    console.log(JSON.stringify(row, null, 2));

    // ---------------------------------------------------------
    // Debug 1: Incident Parsing
    // ---------------------------------------------------------
    const incidentCategories = [
        '墜落しそうになった', '転倒しそうになった', '機械等に激突されそうになった',
        'ものが落下してきた', 'ものが倒れかかってきた', '自分からぶつかりそうになった',
        'はさまれそうになった', '切られそうになった', 'やけどしそうになった',
        '感電しそうになった', '交通事故になりそうだった', 'その他'
    ];
    let incidentCounts = {};
    incidentCategories.forEach(c => incidentCounts[c] = 0);

    const formIncidentKey = Object.keys(row).find(k => k.includes('どのような体験か'));
    console.log(`\n[Incident Logic] Found Key: "${formIncidentKey}"`);

    if (formIncidentKey && row[formIncidentKey]) {
        const val = row[formIncidentKey];
        console.log(`[Incident Logic] Value: "${val}"`);

        let matchFound = false;
        incidentCategories.forEach(cat => {
            if (val.includes(cat)) {
                console.log(`  MATCH: "${cat}" inside "${val}"`);
                matchFound = true;
            } else {
                // console.log(`  FAIL: "${cat}" not in "${val}"`);
            }
        });
        if (!matchFound) console.log("  NO MATCHES FOUND!");
    } else {
        console.log("  KEY NOT FOUND OR VALUE EMPTY");
    }


    // ---------------------------------------------------------
    // Debug 2: Cause Parsing
    // ---------------------------------------------------------
    const causeCategories = [
        '設備・機械に問題があった', '工具・保護具に問題があった', '現場の作業環境に問題があった',
        '作業方法に問題があった', '連絡・連携ミスがあった', '確認が不足していた',
        'よく考えずに行動してしまった', '考え事をしていた', 'よく見えなかった'
    ];
    const formCauseKey = Object.keys(row).find(k => k.includes('発生原因'));
    console.log(`\n[Cause Logic] Found Key: "${formCauseKey}"`);

    if (formCauseKey && row[formCauseKey]) {
        const val = row[formCauseKey];
        console.log(`[Cause Logic] Value: "${val}"`);

        // This is where simple parsing often fails due to spaces in "7. A, 9. B"
        causeCategories.forEach(cat => {
            if (val.includes(cat)) {
                console.log(`  MATCH: "${cat}" inside "${val}"`);
            }
        });
    }

    // ---------------------------------------------------------
    // Debug 3: Activity Parsing
    // ---------------------------------------------------------
    const activityKey = Object.keys(row).find(k => k.includes('回避するのに役立った') || k.includes('役立ったと思われる活動'));
    console.log(`\n[Activity Logic] Found Key: "${activityKey}"`);
    if (activityKey && row[activityKey]) {
        const val = row[activityKey];
        console.log(`[Activity Logic] Value: "${val}"`);
        const acts = val.split(/[,、]/).map(s => s.trim());
        acts.forEach(act => {
            const cleanAct = act.replace(/^\d+\.\s*/, '');
            console.log(`  Extracted Act: "${cleanAct}" (Original: "${act}")`);
        });
    }

    // ---------------------------------------------------------
    // Debug 4: Radar Scores
    // ---------------------------------------------------------
    console.log("\n[Radar Check]");
    const checkScore = (category, keyIncludes) => {
        const key = Object.keys(row).find(k => k.includes(keyIncludes));
        if (key) {
            const val = row[key];
            const score = getScore(val, 'negative'); // assuming check just for value existence
            console.log(`  ${category} [${keyIncludes}]: Key="${key}", Val="${val}", Score=${score}`);
        } else {
            console.log(`  ${category} [${keyIncludes}]: NOT FOUND`);
        }
    };
    checkScore('仕事の量・質', 'たくさんの仕事をしなければならなかった');
    checkScore('疲労感', 'ひどく疲れた');

}

main().catch(console.error);
