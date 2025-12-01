const grid = document.getElementById('grid');
const startBtn = document.getElementById('startBtn');
const resetBtn = document.getElementById('resetBtn');
const titleBtn = document.getElementById('titleBtn');
const settingsPanel = document.getElementById('settingsPanel');
const closeSettings = document.getElementById('closeSettings');
const closeStats = document.getElementById('closeStats');
const prob = document.getElementById('prob');

const settingPos = document.getElementById('settingPos');
const settingAud = document.getElementById('settingAud');
const settingN = document.getElementById('settingN');
const waitTime = document.getElementById('waitTime');
const showTime = document.getElementById('showTime');
const trialInput = document.getElementById('trialInput');
const trialProgress = document.getElementById('trialProgress');
const statsPanel = document.getElementById('statsPanel');
const posStats = document.getElementById('posStats');
const audStats = document.getElementById('audStats');
const totalStats = document.getElementById('totalStats');
const totMatches = document.getElementById('totMathces');
const totPosMatches = document.getElementById('totPosMatches');
const totAudMathces = document.getElementById('totAudMathces');
const accuracyStats = document.getElementById('accuracy');
const btnPos = document.getElementById('btnPos');
const btnAud = document.getElementById('btnAud');
const letters = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];

let cells = [];
let intervalID = null;
let playing = false;
let paused = false;
let trialIndex = 0;
let maxTrials = 0;
let valid = true;

let posMatches = 0;
let audMatches = 0;
let posCorrects = 0;
let audCorrects = 0;
let posIncorrects = 0;
let audIncorrects = 0;
let posMissed = false;
let audMissed = false;
let totClickedPos = 0;
let totClickedAud = 0;
let idxPos = -1;
let idxAud = -1;
let posH = null;
let audH = null;
let clickPos = false;
let clickAud = false;
let posHistory = [];
let audHistory = [];

for (let i = 0; i < 9; i++) {
    const cell = document.createElement('div');
    cell.className = 'cell';
    grid.appendChild(cell);
    cells.push(cell);
}

let ttsReady = false;
let selectedVoice = null;

function loadVoices() {
    const voices = speechSynthesis.getVoices();
    if (voices.length === 0) return false;

    selectedVoice =
        voices.find(v => v.name.includes("Google UK English Male")) ||
        voices.find(v => v.name.includes("Microsoft Aria")) ||
        voices.find(v => v.name.includes("Microsoft Jenny")) ||
        voices.find(v => v.name.includes("Google US English")) ||
        voices.find(v => v.lang === "en-US") ||
        voices[0];

    return true;
}

function waitForVoices(timeout = 3000) {
    return new Promise(resolve => {
        if (loadVoices()) return resolve();

        const timer = setTimeout(resolve, timeout);

        speechSynthesis.onvoiceschanged = () => {
            clearTimeout(timer);
            loadVoices();
            resolve();
        };
    });
}

function warmUpTTS() {
    return new Promise(resolve => {
        speechSynthesis.cancel();

        const u = new SpeechSynthesisUtterance("test");
        u.volume = 0;
        u.rate = 1.0;

        u.onend = () => {
            ttsReady = true;
            resolve();
        };

        u.onerror = () => {
            ttsReady = true;
            resolve();
        };

        if (selectedVoice) u.voice = selectedVoice;
        
        speechSynthesis.cancel();
        speechSynthesis.speak(u);
    });
}

function speakLetter(letter) {
    const utter = new SpeechSynthesisUtterance(letter);
    utter.lang = 'en-US';
    utter.rate = 1.1;
    if (selectedVoice) utter.voice = selectedVoice;
    speechSynthesis.cancel();
    speechSynthesis.speak(utter);;
}

window.addEventListener("load", async () => {
    await waitForVoices();
    await warmUpTTS();
    console.log("TTS READY");
});

function updateTitle() {
    if (settingPos.checked === false && settingAud.checked === false) {
        titleBtn.textContent = `Select Mode`;
        valid = false;
        return;
    }
    if ((settingN.value <= 0 || Math.floor(settingN.value) != settingN.value)
        || (trialInput.value <= 0 || Math.floor(trialInput.value) != trialInput.value)
        || (waitTime.value <= 0 || Math.floor(waitTime.value) != waitTime.value)
        || (showTime.value <= 0 || Number(showTime.value) >= Number(waitTime.value) || Math.floor(showTime.value) != showTime.value)
        || (prob.value < 0 || prob.value > 100 || Math.floor(prob.value) != prob.value)) {
        valid = false;
        alert('Please select a valid mode and ensure all settings are correctly filled out.');
        return;
    }
    valid = true;
    let mode = (settingPos.checked && settingAud.checked) ? 'Dual' : 'Single';
    titleBtn.textContent = `${mode} ${settingN.value}-Back`;
    maxTrials = trialInput.value;
    trialProgress.textContent = `0/${maxTrials}`;
}

settingPos.addEventListener('change', updateTitle);
settingAud.addEventListener('change', updateTitle);
settingN.addEventListener('change', updateTitle);
trialInput.addEventListener('change', updateTitle);
waitTime.addEventListener('change', updateTitle);
showTime.addEventListener('change', updateTitle);
prob.addEventListener('change', updateTitle);

titleBtn.addEventListener('click', () => { settingsPanel.style.display = 'block'; });
closeSettings.addEventListener('click', () => { settingsPanel.style.display = 'none'; });
closeStats.addEventListener('click', () => { statsPanel.style.display = 'none'; });

function clearGrid() { cells.forEach(c => c.classList.remove('active')); }

function fullReset() {
    clearInterval(intervalID);
    intervalID = null;
    playing = false;
    paused = false;
    trialIndex = 0;
    posMatches = 0;
    audMatches = 0;
    posCorrects = 0;
    audCorrects = 0;
    posIncorrects = 0;
    audIncorrects = 0;
    posMissed = false;
    audMissed = false;
    totClickedPos = 0;
    totClickedAud = 0;
    idxPos = -1;
    idxAud = -1;
    posH = null;
    audH = null;
    clickPos = false;
    clickAud = false;
    posHistory = [];
    audHistory = [];
    clearGrid();
    try {
        speechSynthesis.cancel();
    } catch (e) {}
    startBtn.textContent = 'Start';
    trialProgress.textContent = `0/${maxTrials}`;
    if (resetBtn) resetBtn.style.visibility = 'hidden';
}

if (resetBtn) resetBtn.addEventListener('click', fullReset);

function updateStats() {
    statsPanel.style.display = 'block';
    let totTried = posMatches + audMatches;
    let totClicked = totClickedPos + totClickedAud;
    let totCorrect = posCorrects + audCorrects;
    samples = totClicked <= totTried ? totTried : totClicked;
    totMatches.textContent = `Total Matches: ${totTried}/${maxTrials}`;
    totPosMatches.textContent = `Position Matches: ${posMatches}/${totTried}`;
    totAudMathces.textContent = `Audio Matches: ${audMatches}/${totTried}`;
    totalStats.textContent = `Total Correct: ${totCorrect}/${totTried}`;
    posStats.textContent = `Position: ${posCorrects}/${posMatches}`;
    audStats.textContent = `Audio: ${audCorrects}/${audMatches}`;
    accuracyStats.textContent = `Overall Accuracy: ${samples > 0 ? Math.round((totCorrect / samples) * 100) : 0}%`;
}

function randExcluding(n, exclude) {
    if (n <= 1) return 0;
    if (exclude == null || exclude < 0 || exclude >= n) return Math.floor(Math.random() * n);
    let r = Math.floor(Math.random() * (n - 1));
    return r < exclude ? r : r + 1;
}

function randomFlash() {
    trialIndex++;
    trialProgress.textContent = `${trialIndex}/${maxTrials}`;

    if (posMissed) { btnPos.classList.add('missed'); posMissed = false; }
    if (audMissed) { btnAud.classList.add('missed'); audMissed = false; }

    if (trialIndex > maxTrials) {
        clearInterval(intervalID);
        intervalID = null;
        playing = false;
        paused = true;
        startBtn.textContent = 'Start';
        updateStats();
        fullReset();
        return;
    }

    let p_input = Math.max(0, Math.min(100, parseInt(prob.value, 10)));
    let p = p_input / 100;
    let perPos = 0;
    let perAud = 0;
    if (settingPos.checked && settingAud.checked) {
        perPos = 1 - Math.sqrt(1 - p);
        perAud = perPos;
    } else if (settingPos.checked) {
        perPos = p;
    } else if (settingAud.checked) {
        perAud = p;
    }

    let targetPos = null;
    let targetAud = null;

    if (posHistory.length >= settingN.value) targetPos = posHistory[posHistory.length - settingN.value];
    if (audHistory.length >= settingN.value) targetAud = audHistory[audHistory.length - settingN.value];

    if (settingAud.checked) {
        if (trialIndex > settingN.value && targetAud != null && Math.random() < perAud) {
            idxAud = letters.indexOf(targetAud);
        } else {
            if (trialIndex > settingN.value && targetAud != null) idxAud = randExcluding(9, letters.indexOf(targetAud)); else idxAud = Math.floor(Math.random() * 9);
        }
        speechSynthesis.cancel();
        speakLetter(letters[idxAud]);
    }

    if (settingPos.checked) {
        if (trialIndex > settingN.value && targetPos != null && Math.random() < perPos) {
            idxPos = targetPos;
        } else {
            if (trialIndex > settingN.value && targetPos != null) idxPos = randExcluding(9, targetPos); else idxPos = Math.floor(Math.random() * 9);
        }
    }

    let currentTargetPos = null;
    let currentTargetAud = null;
    if (trialIndex > settingN.value) {
        if (posHistory.length >= settingN.value) currentTargetPos = posHistory[posHistory.length - settingN.value];
        if (audHistory.length >= settingN.value) currentTargetAud = audHistory[audHistory.length - settingN.value];
    }

    if (settingPos.checked && trialIndex > settingN.value) {
        if (idxPos === currentTargetPos) {
            posMatches++;
            if (!clickPos) posMissed = true;
        }
    }
    posHistory.push(idxPos);
    clearGrid();
    if (idxPos >= 0 && idxPos < cells.length) cells[idxPos].classList.add('active');
    setTimeout(() => { if (idxPos >= 0 && idxPos < cells.length) cells[idxPos].classList.remove('active'); }, parseInt(showTime.value, 10));

    if (settingAud.checked && trialIndex > settingN.value) {
        if (letters[idxAud] === currentTargetAud) {
            audMatches++;
            if (!clickAud) audMissed = true;
        }
    }
    if (settingAud.checked) audHistory.push(letters[idxAud]); else audHistory.push(-1);

    posH = currentTargetPos;
    audH = currentTargetAud;

    clickPos = false;
    clickAud = false;

    console.log(`Trial ${trialIndex}: Position ${idxPos} (Target: ${currentTargetPos}), Audio ${letters[idxAud]} (Target: ${currentTargetAud})`);
    console.log(`History Position: ${posHistory}, History Audio: ${audHistory}`);
    console.log(`Matches so far - Position: ${posMatches}, Audio: ${audMatches}`);
    console.log(`Correct so far - Position: ${posCorrects}, Audio: ${audCorrects}`);
}

startBtn.addEventListener('click', () => {
    if (!valid) {
        alert('Please select a valid mode and ensure all settings are correctly filled out.');
        return;
    }

    if (!playing && !paused) {
        playing = true;
        paused = false;
        startBtn.textContent = 'Pause';
        statsPanel.style.display = 'none';
        resetBtn.style.visibility = 'visible';
        intervalID = setInterval(randomFlash, parseInt(waitTime.value, 10));
        return;
    }
    if (playing && !paused) {
        paused = true;
        playing = false;
        startBtn.textContent = 'Start';
        clearInterval(intervalID);
        intervalID = null;
        return;
    }
    if (paused && !playing) {
        paused = false;
        playing = true;
        startBtn.textContent = 'Pause';
        intervalID = setInterval(randomFlash, parseInt(waitTime.value, 10));
        return;
    }
});

btnPos.addEventListener('click', () => {
    if (settingPos.checked && playing && !clickPos) {
        if (posH != null && idxPos === posH) {
            posCorrects++;
            btnPos.classList.add('hit');
        } else { btnPos.classList.add('incorrect'); posIncorrects++; }
        totClickedPos++;
    }
    if (!paused && playing) clickPos = true;
    posMissed = false;
});

btnAud.addEventListener('click', () => {
    if (settingAud.checked && playing && !clickAud) {
        if (audH != null && letters[idxAud] === audH) {
            audCorrects++;
            btnAud.classList.add('hit');
        } else { btnAud.classList.add('incorrect'); audIncorrects++; }
        totClickedAud++;
    }
    if (!paused && playing) clickAud = true;
    audMissed = false;
});

btnPos.addEventListener('animationend', () => { btnPos.classList.remove('hit', 'incorrect', 'missed'); });
btnAud.addEventListener('animationend', () => { btnAud.classList.remove('hit', 'incorrect', 'missed'); });

updateTitle();