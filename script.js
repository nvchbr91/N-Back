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
const settingNum = document.getElementById('settingNum');
const settingCol = document.getElementById('settingCol');
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
const btnNum = document.getElementById('btnNum');
const btnCol = document.getElementById('btnCol');
const letters = ['C', 'H', 'J', 'K', 'L', 'Q', 'R', 'S', 'T'];
const numbers = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];
const colors = [
    '#e53935',
    '#1e88e5',
    '#43a047',
    '#fb8c00',
    '#8e24aa',
    '#00897b',
    '#d3b11bff',
    '#d81b60',
    '#6d4c41'
];

let cells = [];
let intervalID = null;
let playing = false;
let paused = false;
let trialIndex = 0;
let maxTrials = 0;
let valid = true;

let posMatches = 0;
let audMatches = 0;
let numMatches = 0;
let colMatches = 0;
let posCorrects = 0;
let audCorrects = 0;
let numCorrects = 0;
let colCorrects = 0;
let posIncorrects = 0;
let audIncorrects = 0;
let numIncorrects = 0;
let colIncorrects = 0;
let posMissed = false;
let audMissed = false;
let numMissed = false;
let colMissed = false;
let totClickedPos = 0;
let totClickedAud = 0;
let totClickedNum = 0;
let totClickedCol = 0;
let idxPos = -1;
let idxAud = -1;
let idxNum = -1;
let idxCol = -1;
let posH = null;
let audH = null;
let numH = null;
let colH = null;
let clickPos = false;
let clickAud = false;
let clickNum = false;
let clickCol = false;
let posHistory = [];
let audHistory = [];
let numHistory = [];
let colHistory = [];
let checkedModes = 0;

for (let i = 0; i < 9; i++) {
    const cell = document.createElement('div');
    cell.className = 'cell';
    grid.appendChild(cell);
    cells.push(cell);
}

let ttsReady = false;
let selectedVoice = null;

function waitForVoices(timeout = 7000) {
    return new Promise(resolve => {
        const voices = speechSynthesis.getVoices();
        if (voices.length > 0) {
            resolve();
            return;
        }
        const timer = setTimeout(() => resolve(), timeout);
        speechSynthesis.onvoiceschanged = () => {
            clearTimeout(timer);
            resolve();
        };
    });
}

function getBestVoice() {
    const voices = speechSynthesis.getVoices();
    if (!voices || voices.length === 0) return null;
    const preferred = [
        "Google UK English Male",
        "Google US English",
        "Microsoft Aria",
        "Microsoft Jenny",
        "Alex",
        "Daniel",
        "Samantha",
        "Alloy"
    ];
    for (const sub of preferred) {
        const found = voices.find(v => v.name && v.name.includes(sub));
        if (found) return found;
    }
    const enVoice = voices.find(v => typeof v.lang === "string" && v.lang.toLowerCase().startsWith("en"));
    if (enVoice) return enVoice;
    return voices[0];
}

async function warmupTTS() {
    selectedVoice = getBestVoice();
    if (!selectedVoice) return;
    const warm = (voice) => new Promise(resolve => {
        const u = new SpeechSynthesisUtterance(" ");
        u.volume = 0;
        u.rate = 1;
        u.pitch = 1;
        u.voice = voice;
        u.onend = u.onerror = () => resolve();
        try { speechSynthesis.cancel(); } catch (e) {}
        speechSynthesis.speak(u);
    });
    for (let i = 0; i < 3; i++) {
        await warm(selectedVoice);
        await new Promise(r => setTimeout(r, 60));
    }
    ttsReady = true;
}

function speakLetter(letter) {
    if (!ttsReady || !selectedVoice) return;
    try { speechSynthesis.cancel(); } catch (e) {}
    const utter = new SpeechSynthesisUtterance(letter);
    utter.voice = selectedVoice;
    utter.lang = selectedVoice.lang || "en-US";
    utter.rate = 1.0;
    utter.pitch = 1.0;
    utter.volume = 1.0;
    speechSynthesis.speak(utter);
}

window.addEventListener("load", async () => {
    await waitForVoices();
    await warmupTTS();
});

function updateTitle() {
    checkedModes = settingPos.checked + settingAud.checked + settingNum.checked + settingCol.checked;
    let mode = '';

    if (checkedModes === 0) {
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

    if (checkedModes === 1) mode = 'Single';
    else if (checkedModes === 2) mode = 'Dual';
    else if (checkedModes === 3) mode = 'Tri';
    else if (checkedModes === 4) mode = 'Quad';

    valid = true;
    titleBtn.textContent = `${mode} ${settingN.value}-Back`;
    maxTrials = trialInput.value;
    trialProgress.textContent = `0/${maxTrials}`;
}

settingPos.addEventListener('change', updateTitle);
settingAud.addEventListener('change', updateTitle);
settingNum.addEventListener('change', updateTitle);
settingCol.addEventListener('change', updateTitle);
settingN.addEventListener('change', updateTitle);
trialInput.addEventListener('change', updateTitle);
waitTime.addEventListener('change', updateTitle);
showTime.addEventListener('change', updateTitle);
prob.addEventListener('change', updateTitle);

titleBtn.addEventListener('click', () => { settingsPanel.style.display = 'block'; });
closeSettings.addEventListener('click', () => { settingsPanel.style.display = 'none'; });
closeStats.addEventListener('click', () => { statsPanel.style.display = 'none'; });

function clearGrid() {
    cells.forEach(c => c.classList.remove('active'));
    cells.forEach(c => c.classList.remove('activeNum'));
    cells.forEach(c => c.textContent = " ");
    cells.forEach(c => c.removeAttribute("style"));
}

function fullReset() {
    clearInterval(intervalID);
    intervalID = null;
    playing = false;
    paused = false;
    trialIndex = 0;
    posMatches = 0;
    audMatches = 0;
    numMatches = 0;
    colMatches = 0;
    posCorrects = 0;
    audCorrects = 0;
    numCorrects = 0;
    colCorrects = 0;
    posIncorrects = 0;
    audIncorrects = 0;
    numIncorrects = 0;
    colIncorrects = 0;
    posMissed = false;
    audMissed = false;
    numMissed = false;
    colMissed = false;
    totClickedPos = 0;
    totClickedAud = 0;
    totClickedNum = 0;
    totClickedCol = 0;
    idxPos = -1;
    idxAud = -1;
    idxNum = -1;
    idxCol = -1;
    posH = null;
    audH = null;
    numH = null;
    colH = null;
    clickPos = false;
    clickAud = false;
    clickNum = false;
    clickCol = false;
    posHistory = [];
    audHistory = [];
    numHistory = [];
    colHistory = [];

    clearGrid();
    try {
        speechSynthesis.cancel();
    } catch (e) { }

    startBtn.textContent = 'Start';
    trialProgress.textContent = `0/${maxTrials}`;

    if (resetBtn) resetBtn.style.visibility = 'hidden';
}

if (resetBtn) resetBtn.addEventListener('click', fullReset);

function updateStats() {
    let totTried = posMatches + audMatches + numMatches + colMatches;
    let totClicked = totClickedPos + totClickedAud + totClickedNum + totClickedCol;
    let totCorrect = posCorrects + audCorrects + numCorrects + colCorrects;
    let samples = totClicked <= totTried ? totTried : totClicked;

    statsPanel.style.display = 'block';
    totMatches.textContent = `Total Matches: ${totTried}/${maxTrials}`;
    totPosMatches.textContent = `Position Matches: ${posMatches}/${totTried}`;
    totAudMathces.textContent = `Audio Matches: ${audMatches}/${totTried}`;
    totNumMathces.textContent = `Number Matches: ${numMatches}/${totTried}`;
    totColMathces.textContent = `Color Matches: ${colMatches}/${totTried}`;
    totalStats.textContent = `Total Correct: ${totCorrect}/${totTried}`;
    posStats.textContent = `Position: ${posCorrects}/${posMatches}`;
    audStats.textContent = `Audio: ${audCorrects}/${audMatches}`;
    numStats.textContent = `Number: ${numCorrects}/${numMatches}`;
    colStats.textContent = `Color: ${colCorrects}/${colMatches}`;
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
    if (numMissed) { btnNum.classList.add('missed'); numMissed = false; }
    if (colMissed) { btnCol.classList.add('missed'); colMissed = false; }

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

    if (checkedModes === 4) {
        p = 1 - Math.pow(1 - p, 1 / 4);
    } else if (checkedModes === 3) {
        p = 1 - Math.pow(1 - p, 1 / 3);
    } else if (checkedModes === 2) {
        p = 1 - Math.pow(1 - p, 1 / 2);
    }

    let targetPos = null;
    let targetAud = null;
    let targetNum = null;
    let targetCol = null;

    if (posHistory.length >= settingN.value) targetPos = posHistory[posHistory.length - settingN.value];
    if (audHistory.length >= settingN.value) targetAud = audHistory[audHistory.length - settingN.value];

    if (settingAud.checked) {
        if (trialIndex > settingN.value && targetAud != null && Math.random() < p) {
            idxAud = letters.indexOf(targetAud);
        } else {
            if (trialIndex > settingN.value && targetAud != null) idxAud = randExcluding(9, letters.indexOf(targetAud)); else idxAud = Math.floor(Math.random() * 9);
        }
        speechSynthesis.cancel();
        speakLetter(letters[idxAud]);
    }

    if (settingPos.checked) {
        if (trialIndex > settingN.value && targetPos != null && Math.random() < p) {
            idxPos = targetPos;
        } else {
            if (trialIndex > settingN.value && targetPos != null) idxPos = randExcluding(9, targetPos); else idxPos = Math.floor(Math.random() * 9);
        }
    }

    if (settingNum.checked) {
        if (trialIndex > settingN.value && targetNum != null && Math.random() < p) {
            idxNum = numbers.indexOf(targetNum);
        } else {
            if (trialIndex > settingN.value && targetNum != null) idxNum = randExcluding(9, numbers.indexOf(targetNum)); else idxNum = Math.floor(Math.random() * 9);
        }
    }

    if (settingCol.checked) {
        if (trialIndex > settingN.value && targetCol != null && Math.random() < p) {
            idxCol = colors.indexOf(targetCol);
        } else {
            if (trialIndex > settingN.value && targetCol != null) idxCol = randExcluding(9, colors.indexOf(targetCol)); else idxCol = Math.floor(Math.random() * 9);
        }
    }

    let currentTargetPos = null;
    let currentTargetAud = null;
    let currentTargetNum = null;
    let currentTargetCol = null;

    if (trialIndex > settingN.value) {
        if (posHistory.length >= settingN.value) currentTargetPos = posHistory[posHistory.length - settingN.value];
        if (audHistory.length >= settingN.value) currentTargetAud = audHistory[audHistory.length - settingN.value];
        if (numHistory.length >= settingN.value) currentTargetNum = numHistory[numHistory.length - settingN.value];
        if (colHistory.length >= settingN.value) currentTargetCol = colHistory[colHistory.length - settingN.value];
    }

    if (settingPos.checked && trialIndex > settingN.value) {
        if (idxPos === currentTargetPos) {
            posMatches++;
            if (!clickPos) posMissed = true;
        }
    }
    posHistory.push(idxPos);

    if (settingAud.checked && trialIndex > settingN.value) {
        if (letters[idxAud] === currentTargetAud) {
            audMatches++;
            if (!clickAud) audMissed = true;
        }
    }
    if (settingAud.checked) audHistory.push(letters[idxAud]); else audHistory.push(-1);

    if (settingNum.checked && trialIndex > settingN.value) {
        if (numbers[idxNum] === currentTargetNum) {
            numMatches++;
            if (!clickNum) numMissed = true;
        }
    }
    if (settingNum.checked) numHistory.push(numbers[idxNum]); else numHistory.push(-1);

    if (settingCol.checked && trialIndex > settingN.value) {
        if (colors[idxCol] === currentTargetCol) {
            colMatches++;
            if (!clickCol) colMissed = true;
        }
    }
    if (settingCol.checked) colHistory.push(colors[idxCol]); else colHistory.push(-1);

    clearGrid();

    if (idxPos >= 0 && idxPos < cells.length) {
        cells[idxPos].classList.add('active');

        if (idxNum >= 0) {
            cells[idxPos].classList.add('activeNum');
            cells[idxPos].textContent = numbers[idxNum];
        }

        if (idxCol >= 0) {
            cells[idxPos].style.background = colors[idxCol];
        }
    } else {
        if (idxNum >= 0) {
            cells[4].classList.add('activeNum');
            cells[4].textContent = numbers[idxNum];
        }

        if (idxCol >= 0) {
            cells[4].style.background = colors[idxCol];
        }
    }

    setTimeout(() => { clearGrid(); }, parseInt(showTime.value, 10));

    posH = currentTargetPos;
    audH = currentTargetAud;
    numH = currentTargetNum;
    colH = currentTargetCol;

    clickPos = false;
    clickAud = false;
    clickNum = false;
    clickCol = false;
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

btnNum.addEventListener('click', () => {
    if (settingNum.checked && playing && !clickNum) {
        if (numH != null && numbers[idxNum] === numH) {
            numCorrects++;
            btnNum.classList.add('hit');
        } else { btnNum.classList.add('incorrect'); numIncorrects++; }
        totClickedNum++;
    }
    if (!paused && playing) clickNum = true;
    numMissed = false;
});

btnCol.addEventListener('click', () => {
    if (settingCol.checked && playing && !clickCol) {
        if (colH != null && colors[idxCol] === colH) {
            colCorrects++;
            btnCol.classList.add('hit');
        } else { btnCol.classList.add('incorrect'); colIncorrects++; }
        totClickedCol++;
    }
    if (!paused && playing) clickCol = true;
    colMissed = false;
});

btnPos.addEventListener('animationend', () => { btnPos.classList.remove('hit', 'incorrect', 'missed'); });
btnAud.addEventListener('animationend', () => { btnAud.classList.remove('hit', 'incorrect', 'missed'); });
btnNum.addEventListener('animationend', () => { btnNum.classList.remove('hit', 'incorrect', 'missed'); });
btnCol.addEventListener('animationend', () => { btnCol.classList.remove('hit', 'incorrect', 'missed'); });

document.addEventListener("keydown", (event) => {
    switch (event.key.toLowerCase()) {
        case 'q':
            btnPos.click();
            break;
        case 'w':
            btnAud.click();
            break;
        case 'a':
            btnNum.click();
            break;
        case 's':
            btnCol.click();
            break;
        case 'f':
            startBtn.click();
            break;
        case 'r':
            resetBtn.click();
            break;
    }
});

updateTitle();

console.log(`W: Position \nA: Audio\nS: Number \nD: Color \nF: Start/Pause \nR: Reset`)