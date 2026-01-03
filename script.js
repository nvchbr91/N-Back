const RESOURCES = {
    letters: ['C', 'H', 'J', 'K', 'L', 'Q', 'R', 'S', 'T'],
    numbers: ['1', '2', '3', '4', '5', '6', '7', '8', '9'],
    colors: ['#e53935', '#1e88e5', '#43a047', '#fb8c00', '#8e24aa', '#00897b', '#d3b11bff', '#d81b60', '#6d4c41']
};

const MODES = {
    pos: { key: 'q', btnId: 'btnPos', setId: 'settingPos', label: 'Position' },
    aud: { key: 'w', btnId: 'btnAud', setId: 'settingAud', label: 'Audio' },
    num: { key: 'a', btnId: 'btnNum', setId: 'settingNum', label: 'Number' },
    col: { key: 's', btnId: 'btnCol', setId: 'settingCol', label: 'Color' }
};

class AudioController {
    constructor() {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        this.ctx = new AudioContext();
        this.buffers = new Map();
        this.vol = 1;
    }

    async preload(letters) {
        if (this.ctx.state === 'suspended') {
            const resumeHandler = () => {
                this.ctx.resume();
                document.removeEventListener('click', resumeHandler);
                document.removeEventListener('keydown', resumeHandler);
            };
            document.addEventListener('click', resumeHandler);
            document.addEventListener('keydown', resumeHandler);
        }

        try {
            await Promise.all(letters.map(async l => {
                const res = await fetch(`./sounds/${l.toLowerCase()}.wav`);
                if (!res.ok) throw new Error(`Missing sound: ${l}`);
                const buf = await this.ctx.decodeAudioData(await res.arrayBuffer());
                this.buffers.set(l, buf);
            }));
        } catch (e) {
            console.error("Audio Load Error:", e);
        }
    }

    play(letter) {
        const buf = this.buffers.get(letter);
        if (!buf) return;
        
        if (this.ctx.state === 'suspended') this.ctx.resume();

        const src = this.ctx.createBufferSource();
        const gain = this.ctx.createGain();
        src.buffer = buf;
        gain.gain.value = this.vol;
        src.connect(gain);
        gain.connect(this.ctx.destination);
        src.start(0);
    }
}

class NBackGame {
    constructor() {
        this.audio = new AudioController();
        this.dom = this.cacheDOM();
        this.state = this.getInitialState();
        
        this.timerID = null;
        this.startTime = 0;
        this.expectedTime = 0;

        this.init();
    }

    cacheDOM() {
        const get = (id) => document.getElementById(id);
        const dom = {
            grid: get('grid'),
            cells: [],
            startBtn: get('startBtn'),
            resetBtn: get('resetBtn'),
            titleBtn: get('titleBtn'),
            settingsPanel: get('settingsPanel'),
            statsPanel: get('statsPanel'),
            closeSettings: get('closeSettings'),
            closeStats: get('closeStats'),
            trialProgress: get('trialProgress'),
            inputs: {
                volume: get('volume'),
                prob: get('prob'),
                n: get('settingN'),
                trials: get('trialInput'),
                wait: get('waitTime'),
                show: get('showTime')
            },
            stats: {
                total: get('totalStats'),
                accuracy: get('accuracy'),
                matches: { 
                    pos: get('totPosMatches'), 
                    aud: get('totAudMathces'),
                    num: get('totNumMathces') || get('totNumMatches'), 
                    col: get('totColMathces') || get('totColMatches'), 
                    all: get('totMathces') || get('totMatches')
                },
                detail: { 
                    pos: get('posStats'), 
                    aud: get('audStats'), 
                    num: get('numStats'), 
                    col: get('colStats') 
                }
            },
            buttons: {},
            settings: {}
        };

        Object.keys(MODES).forEach(k => {
            dom.buttons[k] = get(MODES[k].btnId);
            dom.settings[k] = get(MODES[k].setId);
        });

        dom.grid.innerHTML = '';
        for (let i = 0; i < 9; i++) {
            const cell = document.createElement('div');
            cell.className = 'cell';
            dom.grid.appendChild(cell);
            dom.cells.push(cell);
        }

        return dom;
    }

    getInitialState() {
        return {
            playing: false,
            paused: false,
            trial: 0,
            maxTrials: 20,
            n: 2,
            history: { pos: [], aud: [], num: [], col: [] },
            current: { pos: -1, aud: -1, num: -1, col: -1 },
            target: { pos: null, aud: null, num: null, col: null },
            clicked: { pos: false, aud: false, num: false, col: false },
            stats: Object.keys(MODES).reduce((acc, key) => {
                acc[key] = { matches: 0, correct: 0, incorrect: 0, clicked: 0 };
                return acc;
            }, {})
        };
    }

    async init() {
        this.bindEvents();
        this.updateConfig();
        await this.audio.preload(RESOURCES.letters);
        console.log("Game Ready");
        console.log('To pass the level, you must achieve at least 100% accuracy in at least 5 out of your last 10 plays.')
    }

    bindEvents() {
        this.dom.titleBtn.addEventListener('click', () => this.dom.settingsPanel.style.display = 'block');
        this.dom.closeSettings.addEventListener('click', () => this.dom.settingsPanel.style.display = 'none');
        this.dom.closeStats.addEventListener('click', () => this.dom.statsPanel.style.display = 'none');
        
        Object.values(this.dom.inputs).forEach(inp => inp.addEventListener('change', () => this.updateConfig()));
        Object.values(this.dom.settings).forEach(chk => chk.addEventListener('change', () => this.updateConfig()));

        this.dom.startBtn.addEventListener('click', () => this.toggleGame());
        if (this.dom.resetBtn) this.dom.resetBtn.addEventListener('click', () => this.fullReset());

        Object.keys(MODES).forEach(mode => {
            const btn = this.dom.buttons[mode];
            btn.addEventListener('click', () => this.handleInput(mode));
            btn.addEventListener('animationend', () => btn.classList.remove('hit', 'incorrect', 'missed'));
        });

        document.addEventListener('keydown', (e) => {
            const key = e.key.toLowerCase();
            if (key === 'f') this.dom.startBtn.click();
            else if (key === 'r') this.dom.resetBtn?.click();
            else {
                const mode = Object.keys(MODES).find(k => MODES[k].key === key);
                if (mode) this.dom.buttons[mode].click();
            }
        });
    }

    updateConfig() {
        const { inputs, settings } = this.dom;
        const activeModes = Object.keys(settings).filter(k => settings[k].checked);
        
        const vals = {
            n: +inputs.n.value,
            trials: +inputs.trials.value,
            wait: +inputs.wait.value,
            show: +inputs.show.value,
            prob: +inputs.prob.value
        };

        if (activeModes.length === 0 || Object.values(vals).some(v => v <= 0) || vals.show >= vals.wait) {
            this.dom.titleBtn.textContent = 'Invalid Config';
            this.validConfig = false;
            return;
        }

        this.validConfig = true;
        this.state.n = vals.n;
        this.state.maxTrials = vals.trials;
        this.audio.vol = inputs.volume.value / 100;

        const modeNames = ['', 'Single', 'Dual', 'Tri', 'Quad'];
        this.dom.titleBtn.textContent = `${modeNames[activeModes.length]} ${vals.n}-Back`;
        this.dom.trialProgress.textContent = `0/${vals.trials}`;
    }

    toggleGame() {
        if (!this.validConfig) return alert('Invalid settings! Check inputs.');
        
        if (!this.state.playing && !this.state.paused) {
            this.state.playing = true;
            this.dom.startBtn.textContent = 'Pause';
            this.dom.settingsPanel.style.display = 'none';
            this.dom.statsPanel.style.display = 'none';
            if (this.dom.resetBtn) this.dom.resetBtn.style.visibility = 'visible';
            
            const waitTime = parseInt(this.dom.inputs.wait.value, 10);
            this.startTime = performance.now();
            this.expectedTime = this.startTime + waitTime;
            
            this.timerID = setTimeout(() => this.step(), waitTime);

        } else if (this.state.playing) {
            this.state.playing = false;
            this.state.paused = true;
            this.dom.startBtn.textContent = 'Start';
            clearTimeout(this.timerID);
        } else if (this.state.paused) {
            this.state.paused = false;
            this.state.playing = true;
            this.dom.startBtn.textContent = 'Pause';
            
            const waitTime = parseInt(this.dom.inputs.wait.value, 10);
            this.expectedTime = performance.now() + waitTime;
            this.timerID = setTimeout(() => this.step(), waitTime);
        }
    }

    step() {
        if (!this.state.playing) return;
        this.nextTrial();

        const waitTime = parseInt(this.dom.inputs.wait.value, 10);
        const currentTime = performance.now();
        const drift = currentTime - this.expectedTime;
        
        let nextDelay = Math.max(0, waitTime - drift);
        this.expectedTime += waitTime;
        this.timerID = setTimeout(() => this.step(), nextDelay);
    }

    nextTrial() {
        if (this.state.trial > 0) {
            Object.keys(MODES).forEach(m => {
                if (this.dom.settings[m].checked) {
                    const isMatch = this.checkMatchCondition(m);
                    if (isMatch && !this.state.clicked[m]) {
                         this.dom.buttons[m].classList.add('missed');
                    }
                }
            });
        }

        this.state.trial++;
        this.dom.trialProgress.textContent = `${this.state.trial}/${this.state.maxTrials}`;
        
        if (this.state.trial > this.state.maxTrials) {
            this.finishGame();
            return;
        }

        this.state.clicked = { pos: false, aud: false, num: false, col: false };
        
        let p = Math.max(0, Math.min(100, this.dom.inputs.prob.value)) / 100;
        const activeCount = Object.keys(MODES).filter(k => this.dom.settings[k].checked).length;
        if (activeCount > 1) p = 1 - Math.pow(1 - p, 1 / activeCount);

        this.generateStimuli(p);
        this.renderFrame();

        setTimeout(() => this.clearGrid(), parseInt(this.dom.inputs.show.value, 10));
    }

    generateStimuli(prob) {
        const { n, trial, history } = this.state;
        
        Object.keys(MODES).forEach(mode => {
            if (!this.dom.settings[mode].checked) {
                history[mode].push(-1);
                this.state.current[mode] = -1;
                this.state.target[mode] = null;
                return;
            }

            const resKey = mode === 'pos' ? null : (mode === 'aud' ? 'letters' : (mode === 'num' ? 'numbers' : 'colors'));
            const resources = resKey ? RESOURCES[resKey] : null;
            const maxIdx = resKey ? resources.length : 9;

            let targetVal = null;
            let targetIdx = -1;

            if (trial > n) {
                const histIdx = history[mode].length - n;
                if (histIdx >= 0) {
                    targetVal = history[mode][histIdx];
                    if (targetVal !== -1) {
                         targetIdx = mode === 'pos' ? targetVal : resources.indexOf(targetVal);
                    }
                }
            }
            this.state.target[mode] = targetVal;

            let currentIdx;
            if (trial > n && targetVal !== null && Math.random() < prob) {
                currentIdx = targetIdx;
            } else {
                currentIdx = this.randExcluding(maxIdx, (trial > n && targetVal !== null) ? targetIdx : null);
            }

            this.state.current[mode] = currentIdx;
            const valToPush = mode === 'pos' ? currentIdx : resources[currentIdx];
            history[mode].push(valToPush);

            if (trial > n && currentIdx === targetIdx) {
                this.state.stats[mode].matches++;
            }
        });
    }

    randExcluding(n, exclude) {
        if (exclude === null || exclude === undefined) return Math.floor(Math.random() * n);
        let r = Math.floor(Math.random() * (n - 1));
        return r < exclude ? r : r + 1;
    }

    renderFrame() {
        const { current } = this.state;
        
        if (this.dom.settings.aud.checked && current.aud !== -1) {
            this.audio.play(RESOURCES.letters[current.aud]);
        }

        this.clearGrid();
        const posActive = this.dom.settings.pos.checked;
        const cellIdx = posActive ? current.pos : 4;

        if (cellIdx >= 0 && cellIdx < 9) {
            const cell = this.dom.cells[cellIdx];
            if (posActive) cell.classList.add('active');
            
            if (this.dom.settings.num.checked && current.num !== -1) {
                cell.classList.add('activeNum');
                cell.textContent = RESOURCES.numbers[current.num];
            }
            
            if (this.dom.settings.col.checked && current.col !== -1) {
                cell.style.background = RESOURCES.colors[current.col];
            }
        }
    }

    clearGrid() {
        this.dom.cells.forEach(c => {
            c.className = 'cell';
            c.textContent = ' ';
            c.removeAttribute('style');
        });
    }

    handleInput(mode) {
        if (!this.state.playing || this.state.paused || this.state.clicked[mode]) return;
        if (!this.dom.settings[mode].checked) return;

        this.state.clicked[mode] = true;
        this.state.stats[mode].clicked++;
        
        const btn = this.dom.buttons[mode];
        const isMatch = this.checkMatchCondition(mode);

        btn.classList.remove('missed');

        if (isMatch) {
            this.state.stats[mode].correct++;
            btn.classList.add('hit');
        } else {
            this.state.stats[mode].incorrect++;
            btn.classList.add('incorrect');
        }
    }

    checkMatchCondition(mode) {
        const { current, target } = this.state;
        if (target[mode] === null) return false;
        if (mode === 'pos') return current.pos === target[mode];
        const resKey = mode === 'aud' ? 'letters' : (mode === 'num' ? 'numbers' : 'colors');
        return RESOURCES[resKey][current[mode]] === target[mode];
    }

    finishGame() {
        clearTimeout(this.timerID);
        this.state.playing = false;
        this.state.paused = true;
        this.dom.startBtn.textContent = 'Start';
        this.updateStatsUI();
        this.fullReset();
    }

    updateStatsUI() {
        const { stats } = this.state;
        const domS = this.dom.stats;
        
        let grandTotalMatches = 0;
        let grandTotalCorrect = 0;
        let grandTotalClicked = 0;

        Object.keys(MODES).forEach(m => {
            grandTotalMatches += stats[m].matches;
            grandTotalCorrect += stats[m].correct;
            grandTotalClicked += stats[m].clicked;
            
            domS.matches[m].textContent = `${MODES[m].label} Matches: ${stats[m].matches}/${this.state.maxTrials}`;
            domS.detail[m].textContent = `${MODES[m].label}: ${stats[m].correct}/${stats[m].matches}`;
        });

        const samples = Math.max(grandTotalMatches, grandTotalClicked); 
        
        domS.total.style.display = 'block';
        this.dom.statsPanel.style.display = 'block';
        domS.matches.all.textContent = `Total Opportunities: ${grandTotalMatches}/${this.state.maxTrials}`;
        domS.total.textContent = `Total Correct: ${grandTotalCorrect}/${grandTotalMatches}`;
        domS.accuracy.textContent = `Accuracy: ${samples > 0 ? Math.round((grandTotalCorrect / samples) * 100) : 0}%`;
    }

    fullReset() {
        clearTimeout(this.timerID);
        this.state = this.getInitialState();
        this.updateConfig();
        this.clearGrid();
        
        this.dom.startBtn.textContent = 'Start';
        if (this.dom.resetBtn) this.dom.resetBtn.style.visibility = 'hidden';
        Object.values(this.dom.buttons).forEach(b => b.classList.remove('missed', 'hit', 'incorrect'));
    }
}

window.addEventListener('load', () => {
    if(!document.getElementById('grid')) {
        console.error("HTML Elements missing. Please check your HTML structure.");
        return;
    }
    new NBackGame();
});