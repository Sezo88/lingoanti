import fs from 'fs';
import path from 'path';

const FREQ_FILE = path.join(process.cwd(), 'wordsTR-Freq.csv');
const INPUT_FILE = path.join(process.cwd(), 'kelime_listesi.txt');
const OUTPUT_FILE = path.join(process.cwd(), 'filtered_words.txt');

// Minimum frequency to keep a word
const FREQ_THRESHOLD = 500;

async function filterWords() {
    console.log('Loading frequencies...');
    const freqMap = new Map<string, number>();

    // Read frequencies file line by line
    const freqData = fs.readFileSync(FREQ_FILE, 'utf-8');
    const lines = freqData.split('\n');

    for (const line of lines) {
        const parts = line.trim().split(/\s+/);
        if (parts.length >= 2) {
            const word = parts[0].toLowerCase();
            const freq = parseInt(parts[1], 10);
            if (!isNaN(freq)) {
                // If multiple entries for same word, sum them or take max
                const existing = freqMap.get(word) || 0;
                freqMap.set(word, Math.max(existing, freq));
            }
        }
    }

    console.log(`Loaded ${freqMap.size} unique words from frequency data.`);

    console.log('Filtering word list...');
    const inputData = fs.readFileSync(INPUT_FILE, 'utf-8');
    const inputWords = inputData.split('\n').map(w => w.trim()).filter(w => w.length > 0);

    const filteredWords = [];
    let keptCount = 0;
    let excludedCount = 0;

    for (const word of inputWords) {
        // Turkish character handling: lowercase match
        const lowerWord = word.toLowerCase();
        const freq = freqMap.get(lowerWord) || 0;

        // Also check if it's a very common root word if needed
        // But for now, simple threshold
        if (freq >= FREQ_THRESHOLD) {
            filteredWords.push(word);
            keptCount++;
        } else {
            excludedCount++;
        }
    }

    console.log(`Kept: ${keptCount}`);
    console.log(`Excluded: ${excludedCount}`);

    fs.writeFileSync(OUTPUT_FILE, filteredWords.join('\n'));
    console.log(`Saved to ${OUTPUT_FILE}`);
}

filterWords().catch(console.error);
