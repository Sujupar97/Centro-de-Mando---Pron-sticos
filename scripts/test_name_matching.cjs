// scripts/test_name_matching.cjs

// REPLICATING LOGIC FROM _shared/team-normalization.ts
const KNOWN_ALIASES = {
    'wolverhamptonwanderers': ['wolves'],
    'wolves': ['wolverhamptonwanderers'],
    'tottenhamhotspur': ['spurs', 'tottenham'], // Added to test manual alias too
    'spurs': ['tottenhamhotspur', 'tottenham'],
    'tottenham': ['tottenhamhotspur', 'spurs'],
    'manchesterunited': ['manutd'],
    'manutd': ['manchesterunited']
};

function normalizeName(name) {
    return name
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/\b(fc|cf|sc|cd|ac|as|sv|vfb|borussia|sporthera|club|deportiva|atletico|real|sporting|olympique|inter)\b/g, '')
        .replace(/[^a-z0-9]/g, "")
        .trim();
}

function getSimilarity(str1, str2) {
    if (str1 === str2) return 1.0;
    if (str1.length < 2 || str2.length < 2) return 0.0;
    const bigrams1 = new Map();
    for (let i = 0; i < str1.length - 1; i++) {
        const bigram = str1.substring(i, i + 2);
        bigrams1.set(bigram, (bigrams1.get(bigram) || 0) + 1);
    }
    let intersection = 0;
    for (let i = 0; i < str2.length - 1; i++) {
        const bigram = str2.substring(i, i + 2);
        const count = bigrams1.get(bigram);
        if (count && count > 0) {
            bigrams1.set(bigram, count - 1);
            intersection++;
        }
    }
    return (2.0 * intersection) / (str1.length + str2.length - 2);
}

function areTeamsEqual(nameA, nameB) {
    // 1. Direct Normalization Check (for .includes)
    const normA = nameA.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");
    const normB = nameB.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");

    console.log(`\nComparing: "${nameA}" vs "${nameB}"`);
    console.log(`   NormSimple: "${normA}" vs "${normB}"`);

    if (normA === normB) { console.log("   => Exact Match (Norm)"); return true; }
    if (normA.includes(normB)) { console.log(`   => Inclusion A contains B`); return true; }
    if (normB.includes(normA)) { console.log(`   => Inclusion B contains A`); return true; }

    // 2. Alias Check
    if (KNOWN_ALIASES[normA]?.includes(normB)) { console.log("   => Alias Match A->B"); return true; }
    if (KNOWN_ALIASES[normB]?.includes(normA)) { console.log("   => Alias Match B->A"); return true; }

    // 3. Core Name Similarity (Dice Check)
    const coreA = normalizeName(nameA);
    const coreB = normalizeName(nameB);

    const score = getSimilarity(coreA, coreB);
    console.log(`   Core: "${coreA}" vs "${coreB}" -> Dice: ${score.toFixed(3)}`);

    return score >= 0.65;
}

// TEST CASES
const tests = [
    ["Chelsea", "Chelsea"],
    ["Wolves", "Wolverhampton Wanderers"],
    ["Tottenham", "Tottenham Hotspur"], // The suspect
    ["Burnley", "Burnley"],
    ["Man Utd", "Manchester United"],
    ["West Ham", "West Ham United"],
    ["Brighton", "Brighton and Hove Albion"], // Hard one
    ["Inter", "Internazionale"]
];

console.log("=== RUNNING MATCHING TESTS ===");
let passed = 0;
tests.forEach(t => {
    const result = areTeamsEqual(t[0], t[1]);
    if (result) {
        console.log("✅ MATCHED\n");
        passed++;
    } else {
        console.log("❌ FAILED\n");
    }
});
console.log(`Passed: ${passed}/${tests.length}`);
