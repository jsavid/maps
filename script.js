const countries = window.gameData.countries;

// Audio System (Reusing from Flag game)
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

const SoundManager = {
    playTone: (freq, type, duration) => {
        if (audioCtx.state === 'suspended') audioCtx.resume();
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
        gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + duration);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start();
        osc.stop(audioCtx.currentTime + duration);
    },

    playWin: () => {
        const now = audioCtx.currentTime;
        [523.25, 659.25, 783.99, 1046.50].forEach((freq, i) => {
            const osc = audioCtx.createOscillator();
            const gain = audioCtx.createGain();
            osc.frequency.value = freq;
            osc.type = 'sine';
            gain.gain.setValueAtTime(0.05, now + i * 0.1);
            gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.1 + 0.3);
            osc.connect(gain);
            gain.connect(audioCtx.destination);
            osc.start(now + i * 0.1);
            osc.stop(now + i * 0.1 + 0.3);
        });
    },

    playLose: () => {
        SoundManager.playTone(150, 'sawtooth', 0.4);
        SoundManager.playTone(140, 'sawtooth', 0.4);
    }
};

// Map configuration constants
const MAP_CONFIG = {
    selector: '#map-container',
    map: 'world',
    backgroundColor: 'transparent',
    draggable: true,
    zoomButtons: true,
    zoomOnScroll: true,
    regionsSelectable: false, // Strictly disable manual selection
    regionStyle: {
        initial: {
            fill: '#d4b483', // Brownish-tan for a classic parchment look
            stroke: '#555555', // Softer dark gray
            strokeWidth: 0.3, // Optimal thickness
            fillOpacity: 1
        },
        hover: {
            fillOpacity: 0.9,
            cursor: 'default'
        },
        selected: {
            fill: '#10b981' // Keep emerald for the target country highlight
        }
    },
    onRegionTooltipShow(event, tooltip) {
        // Disable tooltips so they don't give away the answer
        event.preventDefault();
    },
    onRegionClick(event, code) {
        // Prevent manual selection by user
        event.preventDefault();
    }
};

// Game State
let currentScore = 0;
let remainingCountries = [];
let currentQuestion = null;
let isAnswered = false;
let continentStats = {};
let map = null;

// DOM Elements
const scoreEl = document.getElementById('score');
const countEl = document.getElementById('count');
const gameContainer = document.getElementById('game-container');
const gameOverSection = document.getElementById('game-over');
const finalScoreVal = document.getElementById('final-score-value');
const statsBreakdown = document.getElementById('stats-breakdown');
const finalMessage = document.getElementById('final-message');
const restartBtn = document.getElementById('restart-btn');
const continentHint = document.getElementById('continent-hint');
const optionsContainer = document.getElementById('options-container');
const flashOverlay = document.getElementById('flash-overlay');

const TOTAL_QUESTIONS = 20;

// Initialize Map
function initMap() {
    try {
        console.log("Initializing map...");
        map = new jsVectorMap(MAP_CONFIG);
        console.log("Map initialized successfully");
    } catch (e) {
        console.error("Error initializing map:", e);
        // Fallback or alert if map fails
    }
}

// Initialize Game
function init() {
    if (!map) initMap();

    // Shuffle and pick 20
    const shuffled = [...countries].sort(() => 0.5 - Math.random());
    remainingCountries = shuffled.slice(0, TOTAL_QUESTIONS);
    currentScore = 0;

    // Reset Stats
    continentStats = {};
    remainingCountries.forEach(c => {
        if (!continentStats[c.continent]) {
            continentStats[c.continent] = { correct: 0, total: 0 };
        }
    });

    updateScoreUI();

    // UI Reset
    gameContainer.classList.remove('hidden');
    gameOverSection.classList.add('hidden');

    generateQuestion();

    restartBtn.onclick = () => {
        if (map) map.reset(); // Reset zoom
        init();
    };
}

function updateScoreUI() {
    scoreEl.textContent = currentScore;
    const answeredCount = TOTAL_QUESTIONS - remainingCountries.length;
    countEl.textContent = `${answeredCount}/${TOTAL_QUESTIONS}`;
}

function triggerFlash(type) {
    flashOverlay.className = 'flash-overlay';
    void flashOverlay.offsetWidth;
    if (type === 'correct') {
        flashOverlay.classList.add('flash-correct');
    } else {
        flashOverlay.classList.add('flash-wrong');
    }
}

function endGame() {
    gameContainer.classList.add('hidden');
    gameOverSection.classList.remove('hidden');

    const percentage = Math.round((currentScore / TOTAL_QUESTIONS) * 100);
    finalScoreVal.textContent = `${percentage}%`;

    let msg = "";
    if (percentage === 100) msg = "Perfect! 😎 🏆 (Legend level!)";
    else if (percentage >= 90) msg = "Excellent! 😃 ⭐ (Almost flawless!)";
    else if (percentage >= 80) msg = "Very Good! 😄 ✨ (Keep it up!)";
    else if (percentage >= 70) msg = "Good! 🙂 👍 (On the right track)";
    else if (percentage >= 60) msg = "So-so... 🙃 ⚖️ (Just scraping by)";
    else if (percentage >= 50) msg = "Weak! 🤨 ⚠️ (Need to push a bit harder)";
    else if (percentage >= 40) msg = "Bad! 🤔 📉 (Need to rethink the strategy)";
    else if (percentage >= 30) msg = "Very Bad! 🥺 🆘 (Red alert!)";
    else if (percentage >= 20) msg = "Horrible! 🙄 🤦‍♂️ (Don't even ask...)";
    else if (percentage >= 10) msg = "Awful! 🫠 🌋 (Total disaster)";
    else msg = "Speechless! 🤯 💀 (What happened here?)";

    finalMessage.textContent = msg;

    statsBreakdown.innerHTML = '';
    const sortedContinents = Object.keys(continentStats).sort();

    sortedContinents.forEach(cont => {
        const data = continentStats[cont];
        if (data.total > 0) {
            let contPercent = Math.round((data.correct / data.total) * 100);
            const row = document.createElement('div');
            row.className = 'stat-row';
            row.innerHTML = `
                <span class="continent-name">${cont}</span>
                <span class="continent-score">${contPercent}% (${data.correct}/${data.total})</span>
            `;
            statsBreakdown.appendChild(row);
        }
    });

    SoundManager.playWin();
}

function generateQuestion() {
    if (remainingCountries.length === 0) {
        endGame();
        return;
    }

    isAnswered = false;
    optionsContainer.innerHTML = '';

    // Pick Random
    const randomIndex = Math.floor(Math.random() * remainingCountries.length);
    const correctCountry = remainingCountries[randomIndex];

    continentStats[correctCountry.continent].total++;
    remainingCountries.splice(randomIndex, 1);
    updateScoreUI();

    // Distractors (6 options total)
    const sameContinent = countries.filter(c =>
        c.continent === correctCountry.continent && c.code !== correctCountry.code
    );

    const shuffledDistractors = sameContinent.sort(() => 0.5 - Math.random());
    const distractors = shuffledDistractors.slice(0, 5); // 5 distractors + 1 correct = 6
    const options = [correctCountry, ...distractors].sort(() => 0.5 - Math.random());

    currentQuestion = {
        correct: correctCountry,
        options: options
    };

    // Highlight and Focus on Map
    if (map) {
        try {
            map.clearSelectedRegions();
            const countryCode = correctCountry.code.toUpperCase();

            // Highlight
            map.setSelectedRegions([countryCode]);

            // Zoom/Focus logic for visibility
            // We use setFocus which handles zooming to specific region(s)
            map.setFocus({
                regions: [countryCode],
                animate: true,
                padding: 0.2 // Give some breathing room
            });
        } catch (e) {
            console.error("Map focus error:", e);
        }
    }

    continentHint.textContent = correctCountry.continent;

    options.forEach(country => {
        const btn = document.createElement('button');
        btn.className = 'option-btn';

        // Handle special codes for flags (e.g. Kosovo _1 -> xk)
        let flagCode = country.code.toLowerCase();
        if (flagCode === '_1') flagCode = 'xk';

        btn.innerHTML = `
            <img src="https://flagcdn.com/w40/${flagCode}.png" class="option-flag" alt="">
            <span>${country.name}</span>
        `;

        btn.dataset.code = country.code;
        btn.addEventListener('click', () => handleAnswer(country, btn));
        optionsContainer.appendChild(btn);
    });
}

function handleAnswer(selectedCountry, btnElement) {
    if (isAnswered) return;
    isAnswered = true;

    const correctCode = currentQuestion.correct.code;
    const continent = currentQuestion.correct.continent;
    const allButtons = optionsContainer.querySelectorAll('.option-btn');

    if (selectedCountry.code === correctCode) {
        currentScore++;
        continentStats[continent].correct++;
        SoundManager.playWin();
        triggerFlash('correct');
        btnElement.classList.add('correct');
        scoreEl.parentElement.classList.add('pulse');
        setTimeout(() => scoreEl.parentElement.classList.remove('pulse'), 500);
    } else {
        SoundManager.playLose();
        triggerFlash('wrong');
        btnElement.classList.add('wrong');
        allButtons.forEach(btn => {
            if (btn.dataset.code === correctCode) {
                btn.classList.add('correct');
            }
        });
    }

    updateScoreUI();
    allButtons.forEach(btn => btn.disabled = true);

    setTimeout(() => {
        // Clear regions before next question
        map.clearSelectedRegions();
        generateQuestion();
    }, 1500); // Slightly longer delay to see the map
}

// Start
window.onload = () => {
    init();
};
