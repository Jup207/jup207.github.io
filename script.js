const DEFAULT_PLAYERS = [
    { id: 1, name: '김형남', bu: 6 },
    { id: 2, name: '계신웅', bu: 8 },
    { id: 3, name: '김영석', bu: 8 },
    { id: 4, name: '임위철', bu: 10 },
    { id: 5, name: '이정훈', bu: 11 }
];

let PLAYERS = [];
let matches = [];
let playerStats = {};
let gameCount = 10;
let maxSets = 3;
let isInitialLoad = true;

const firebaseConfig = {
  apiKey: "AIzaSyD1P1OwTu2kX7SL-m43YiLoR_VujM_mh_4",
  authDomain: "pingpong-d9710.firebaseapp.com",
  databaseURL: "https://pingpong-d9710-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "pingpong-d9710",
  storageBucket: "pingpong-d9710.firebasestorage.app",
  messagingSenderId: "992627061278",
  appId: "1:992627061278:web:d39361c834a12d4a50740f",
  measurementId: "G-V59NCP6D1S"
};

let dbRef = null;

function updateStatus(text, color) {
    const el = document.getElementById('connection-status');
    if (el) {
        el.innerText = text;
        el.style.color = color;
    }
}

function init() {
    loadFromLocalStorage();
    initFirebase();
    renderPlayersInput();
    if(matches.length === 0) {
        generateMatches(gameCount, false); 
    } else {
        calculateStats();
        renderDashboard();
        renderMatches();
    }
    switchTab('matches');
}

function initFirebase() {
    updateStatus('🟡 서버 연결 중...', 'var(--text-secondary)');
    
    if (!firebase.apps.length) {
        firebase.initializeApp(firebaseConfig);
    }
    const db = firebase.database();
    dbRef = db.ref('pingpong_rooms/main_room');

    dbRef.on('value', (snapshot) => {
        const data = snapshot.val();
        if (data) {
            PLAYERS = data.players || [];
            if (data.matches) {
                matches = data.matches.map(m => {
                    if (!m.maxSets) m.maxSets = m.setResults ? m.setResults.length : 3;
                    return m;
                });
            }
            if (data.gameCount) gameCount = data.gameCount;
            if (data.maxSets) maxSets = data.maxSets;
            
            saveToLocalStorage();
            calculateStats();
            renderDashboard();
            renderMatches();
            renderPlayersInput();
            
            if (isInitialLoad) {
                updateStatus('🟢 실시간 동기화', 'var(--accent-green)');
                isInitialLoad = false;
            }
        } else {
            if (isInitialLoad) {
                saveToFirebase();
                updateStatus('🟢 실시간 동기화', 'var(--accent-green)');
                isInitialLoad = false;
            }
        }
    });
}

function saveToFirebase() {
    if (dbRef) {
        dbRef.set({
            players: PLAYERS,
            matches: matches,
            gameCount: gameCount,
            maxSets: maxSets,
            timestamp: Date.now()
        });
    }
}

function saveToLocalStorage() {
    localStorage.setItem('pingpong_players', JSON.stringify(PLAYERS));
    localStorage.setItem('pingpong_matches', JSON.stringify(matches));
    localStorage.setItem('pingpong_gameCount', gameCount);
    localStorage.setItem('pingpong_maxSets', maxSets);
}

function loadFromLocalStorage() {
    const savedPlayers = localStorage.getItem('pingpong_players');
    const savedMatches = localStorage.getItem('pingpong_matches');
    const savedCount = localStorage.getItem('pingpong_gameCount');
    const savedMaxSets = localStorage.getItem('pingpong_maxSets');

    if (savedPlayers) PLAYERS = JSON.parse(savedPlayers);
    else PLAYERS = [...DEFAULT_PLAYERS];

    if (savedMatches) {
        matches = JSON.parse(savedMatches).map(m => {
            if (!m.maxSets) m.maxSets = m.setResults ? m.setResults.length : 3;
            return m;
        });
    }
    if (savedCount) gameCount = parseInt(savedCount);
    if (savedMaxSets) maxSets = parseInt(savedMaxSets);
}

window.resetAllData = function() {
    if(confirm('모든 데이터가 초기화됩니다. 계속하시겠습니까?')) {
        PLAYERS = [...DEFAULT_PLAYERS];
        gameCount = 10;
        generateMatches(gameCount, true);
        switchTab('matches');
    }
}

window.switchTab = function(tabName) {
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    document.getElementById(`tab-${tabName}`).classList.add('active');

    document.querySelectorAll('.matches-container, .settings-container').forEach(el => {
        el.classList.remove('active-tab');
    });
    
    document.getElementById(`${tabName}-container`).classList.add('active-tab');
    
    // 설정 화면일 때는 대시보드 스탯 숨기기 (화면 클리어)
    const statsContainer = document.getElementById('player-stats');
    if (statsContainer) {
        statsContainer.style.display = tabName === 'settings' ? 'none' : 'flex';
    }

    // 로드 모어 버튼 표시 처리
    const loadMoreBtn = document.getElementById('load-more-container');
    if (loadMoreBtn) {
        loadMoreBtn.style.display = tabName === 'matches' ? 'block' : 'none';
    }

    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function renderPlayersInput() {
    const container = document.getElementById('players-input-list');
    container.innerHTML = '';
    
    PLAYERS.forEach((p, idx) => {
        const row = document.createElement('div');
        row.className = 'player-input-row';
        row.innerHTML = `
            <input type="text" value="${p.name}" class="p-name" placeholder="이름" required>
            <input type="number" value="${p.bu}" class="p-bu" placeholder="부수" min="1" max="20" required>
            <button class="remove-btn" onclick="removePlayer(${idx})">삭제</button>
        `;
        container.appendChild(row);
    });
    document.getElementById('game-count').value = gameCount;
    const maxSetsEl = document.getElementById('max-sets');
    if(maxSetsEl) maxSetsEl.value = maxSets;
}

window.addPlayerInput = function() {
    PLAYERS.push({ id: Date.now(), name: '', bu: 10 });
    renderPlayersInput();
}

window.removePlayer = function(idx) {
    if(PLAYERS.length <= 4) {
        alert('최소 4명의 선수가 필요합니다.');
        return;
    }
    PLAYERS.splice(idx, 1);
    renderPlayersInput();
}

window.applySettingsAndGenerate = function() {
    const rows = document.querySelectorAll('.player-input-row');
    let newPlayers = [];
    let isValid = true;

    rows.forEach((row, idx) => {
        const name = row.querySelector('.p-name').value.trim();
        const bu = parseInt(row.querySelector('.p-bu').value);
        if (!name || isNaN(bu)) isValid = false;
        newPlayers.push({ id: idx + 1, name, bu });
    });

    if (!isValid) return alert('모든 선수의 이름과 부수를 입력해주세요.');
    if (newPlayers.length < 4) return alert('선수는 최소 4명이어야 합니다.');

    const countInput = parseInt(document.getElementById('game-count').value);
    if (isNaN(countInput) || countInput < 1) return alert('게임 수는 1 이상이어야 합니다.');

    const maxSetsInput = parseInt(document.getElementById('max-sets').value);

    PLAYERS = newPlayers;
    gameCount = countInput;
    if(maxSetsInput === 3 || maxSetsInput === 5) maxSets = maxSetsInput;
    
    generateMatches(gameCount, true);
    switchTab('matches');
}

window.applySettingsOnly = function() {
    const maxSetsInput = parseInt(document.getElementById('max-sets').value);
    if(maxSetsInput === 3 || maxSetsInput === 5) {
        maxSets = maxSetsInput;
        
        matches.forEach(m => {
            const hasStarted = m.setResults.some(r => r !== 0);
            if (!hasStarted) {
                m.maxSets = maxSets;
                m.setResults = Array(maxSets).fill(0);
                m.winner = 0;
            }
        });

        saveToLocalStorage();
        calculateStats();
        renderDashboard();
        renderMatches();
        saveToFirebase();
        switchTab('matches');
    }
}

function recalcWinner(match) {
    let t1Wins = match.setResults.filter(r => r === 1).length;
    let t2Wins = match.setResults.filter(r => r === 2).length;
    const mMaxSets = match.maxSets || match.setResults.length;
    let winsNeeded = Math.ceil(mMaxSets / 2);

    if (t1Wins >= winsNeeded) match.winner = 1;
    else if (t2Wins >= winsNeeded) match.winner = 2;
    else match.winner = 0;
}

function findBestTeams(selectedPlayers) {
    const combos = [
        [[selectedPlayers[0], selectedPlayers[1]], [selectedPlayers[2], selectedPlayers[3]]],
        [[selectedPlayers[0], selectedPlayers[2]], [selectedPlayers[1], selectedPlayers[3]]],
        [[selectedPlayers[0], selectedPlayers[3]], [selectedPlayers[1], selectedPlayers[2]]]
    ];

    let bestCombo = null;
    let minDiff = Infinity;

    combos.forEach(combo => {
        const sum1 = combo[0][0].bu + combo[0][1].bu;
        const sum2 = combo[1][0].bu + combo[1][1].bu;
        const diff = Math.abs(sum1 - sum2);

        if (diff < minDiff) {
            minDiff = diff;
            bestCombo = combo;
        }
    });

    return bestCombo;
}

function getPlayAndRefCounts() {
    let refCounts = {};
    let playCounts = {};
    PLAYERS.forEach(p => {
        refCounts[p.id] = 0;
        playCounts[p.id] = 0;
    });

    matches.forEach(m => {
        if(m.referee) refCounts[m.referee.id]++;
        m.team1.forEach(p => playCounts[p.id]++);
        m.team2.forEach(p => playCounts[p.id]++);
    });
    return { refCounts, playCounts };
}

window.loadMoreMatches = function() {
    const addCount = 10;
    gameCount += addCount;
    
    const { refCounts, playCounts } = getPlayAndRefCounts();
    let nextMatchId = matches.length > 0 ? matches[matches.length - 1].id + 1 : 1;

    for (let i = 0; i < addCount; i++) {
        let referee = null;
        let playing4 = [];

        if (PLAYERS.length === 4) {
            playing4 = [...PLAYERS];
        } else {
            let sortedRefs = [...PLAYERS].sort((a, b) => refCounts[a.id] - refCounts[b.id]);
            referee = sortedRefs[0];
            refCounts[referee.id]++;

            let remaining = PLAYERS.filter(p => p.id !== referee.id);
            remaining.sort((a, b) => playCounts[a.id] - playCounts[b.id]);
            playing4 = remaining.slice(0, 4);
        }

        playing4.forEach(p => playCounts[p.id]++);
        const teams = findBestTeams(playing4);
        if (Math.random() > 0.5) teams.reverse();

        matches.push({
            id: nextMatchId++,
            referee: referee,
            team1: teams[0],
            team2: teams[1],
            setResults: Array(maxSets).fill(0),
            winner: 0,
            maxSets: maxSets
        });
    }

    saveToLocalStorage();
    calculateStats();
    renderDashboard();
    renderMatches();
    saveToFirebase();
}

function generateMatches(totalGames, shouldBroadcast) {
    matches = [];
    let refCounts = {};
    let playCounts = {};
    PLAYERS.forEach(p => {
        refCounts[p.id] = 0;
        playCounts[p.id] = 0;
    });

    for (let i = 0; i < totalGames; i++) {
        let referee = null;
        let playing4 = [];

        if (PLAYERS.length === 4) {
            playing4 = [...PLAYERS];
        } else {
            let sortedRefs = [...PLAYERS].sort((a, b) => refCounts[a.id] - refCounts[b.id]);
            referee = sortedRefs[0];
            refCounts[referee.id]++;

            let remaining = PLAYERS.filter(p => p.id !== referee.id);
            remaining.sort((a, b) => playCounts[a.id] - playCounts[b.id]);
            playing4 = remaining.slice(0, 4);
        }

        playing4.forEach(p => playCounts[p.id]++);
        const teams = findBestTeams(playing4);
        if (Math.random() > 0.5) teams.reverse();

        matches.push({
            id: i + 1,
            referee: referee,
            team1: teams[0],
            team2: teams[1],
            setResults: Array(maxSets).fill(0),
            winner: 0,
            maxSets: maxSets
        });
    }

    saveToLocalStorage();
    calculateStats();
    renderDashboard();
    renderMatches();

    if(shouldBroadcast) {
        saveToFirebase();
    }
}

function calculateStats() {
    playerStats = {};
    PLAYERS.forEach(p => {
        playerStats[p.id] = { ...p, wins: 0, matchesPlayed: 0 };
    });

    matches.forEach(m => {
        if (m.winner !== 0) {
            m.team1.forEach(p => { if(playerStats[p.id]) playerStats[p.id].matchesPlayed++ });
            m.team2.forEach(p => { if(playerStats[p.id]) playerStats[p.id].matchesPlayed++ });
            
            if (m.winner === 1) {
                m.team1.forEach(p => { if(playerStats[p.id]) playerStats[p.id].wins++ });
            } else if (m.winner === 2) {
                m.team2.forEach(p => { if(playerStats[p.id]) playerStats[p.id].wins++ });
            }
        }
    });
}

function renderDashboard() {
    const container = document.getElementById('player-stats');
    container.innerHTML = '';

    // 총 완료된 경기 수 확인 (순위 표시 여부)
    const completedMatches = matches.filter(m => m.winner !== 0).length;
    const showRank = completedMatches > 0;
    
    // 헤더에 완료된 경기수 업데이트
    const completedGamesEl = document.getElementById('completed-games-count');
    if (completedGamesEl) {
        completedGamesEl.innerText = `완료된 게임: ${completedMatches} / ${gameCount}게임`;
    }

    // 정렬: 1순위 승수(내림차순), 2순위 부수(오름차순-디폴트 잘치는사람)
    const sortedStats = Object.values(playerStats).sort((a, b) => {
        if (b.wins !== a.wins) return b.wins - a.wins;
        return a.bu - b.bu; 
    });

    let currentRank = 1;
    let previousWins = -1;
    let rankOffset = 0; // 공동 순위 보정

    sortedStats.forEach((stat, index) => {
        // 공동 순위 계산 (승수 기준)
        if (stat.wins !== previousWins) {
            currentRank = currentRank + rankOffset;
            rankOffset = 1;
        } else {
            rankOffset++;
        }
        previousWins = stat.wins;

        const rate = stat.matchesPlayed === 0 ? 0 : Math.round((stat.wins / stat.matchesPlayed) * 100);
        const wrapper = document.createElement('div');
        wrapper.className = 'player-stat-wrapper';
        
        let rankHtml = '';
        if (showRank) {
            let rankClass = 'player-rank';
            if (currentRank === 1) rankClass += ' rank-1';
            else if (currentRank === 2) rankClass += ' rank-2';
            else if (currentRank === 3) rankClass += ' rank-3';
            rankHtml = `<div class="${rankClass}">${currentRank}위</div>`;
        } else {
            rankHtml = `<div class="player-rank" style="visibility:hidden">0위</div>`;
        }

        wrapper.innerHTML = `
            ${rankHtml}
            <div class="player-stat-card">
                <div class="player-name">${stat.name}</div>
                <div class="player-bu">${stat.bu}부</div>
                <div class="player-record">
                    <div>${stat.wins}승</div>
                    <div style="font-size: 0.7rem; color: var(--text-secondary); font-weight: normal;">/${stat.matchesPlayed}전</div> 
                    <div class="player-rate">(${rate}%)</div>
                </div>
            </div>
        `;
        container.appendChild(wrapper);
    });
}

window.handleSetClick = function(matchId, setIndex, teamWin) {
    const match = matches.find(m => m.id === matchId);
    const mMaxSets = match.maxSets || match.setResults.length;
    
    let t1W = 0, t2W = 0;
    for(let i=0; i<setIndex; i++) {
        if(match.setResults[i] === 1) t1W++;
        if(match.setResults[i] === 2) t2W++;
    }
    const winsNeeded = Math.ceil(mMaxSets / 2);
    if(t1W >= winsNeeded || t2W >= winsNeeded) return;

    if (match.setResults[setIndex] === teamWin) {
        match.setResults[setIndex] = 0;
    } else {
        match.setResults[setIndex] = teamWin;
    }

    recalcWinner(match);

    if (match.winner !== 0) {
        for(let i = setIndex + 1; i < mMaxSets; i++) {
            if(match.setResults[i] !== undefined) {
                match.setResults[i] = 0;
            }
        }
    }

    // 로컬 적용 및 렌더링
    saveToLocalStorage();
    calculateStats();
    renderDashboard();
    renderMatches(); 
    
    // 서버 전송
    saveToFirebase();
}

function renderMatches() {
    const container = document.getElementById('matches-container');
    container.innerHTML = '';

    matches.forEach(match => {
        const t1Sum = match.team1[0].bu + match.team1[1].bu;
        const t2Sum = match.team2[0].bu + match.team2[1].bu;

        let cardClass = 'match-card';
        if (match.winner === 1) cardClass += ' team1-win finished';
        if (match.winner === 2) cardClass += ' team2-win finished';

        const card = document.createElement('div');
        card.className = cardClass;

        card.innerHTML = `
            <div class="match-header">
                <span class="match-number">Game ${match.id}</span>
                ${match.referee ? `<span class="match-referee" onclick="openSwapModal(${match.id})" title="심판 교체하기">👑 심판: ${match.referee.name} 🔄</span>` : `<span class="match-referee">심판 없음</span>`}
            </div>
            
            <div class="match-body">
                <div class="teams-container">
                    <div class="team ${match.winner === 1 ? 'winner' : (match.winner === 2 ? 'loser' : '')}">
                        <div class="team-name">${match.team1[0].name}, ${match.team1[1].name}</div>
                        <div class="team-bu-sum">합: ${t1Sum}</div>
                    </div>
                    
                    <div class="vs">VS</div>
                    
                    <div class="team ${match.winner === 2 ? 'winner' : (match.winner === 1 ? 'loser' : '')}">
                        <div class="team-name">${match.team2[0].name}, ${match.team2[1].name}</div>
                        <div class="team-bu-sum">합: ${t2Sum}</div>
                    </div>
                </div>

                <div class="sets-container">
                    <div class="result-label-box">
                        <span class="set-title" style="visibility:hidden">결과</span>
                        <div class="result-label ${match.winner === 1 ? 'win' : (match.winner === 2 ? 'loss' : '')}">${match.winner === 1 ? '승' : (match.winner === 2 ? '패' : '')}</div>
                        <div class="result-label ${match.winner === 2 ? 'win' : (match.winner === 1 ? 'loss' : '')}">${match.winner === 2 ? '승' : (match.winner === 1 ? '패' : '')}</div>
                    </div>
                    ${Array.from({length: match.maxSets || match.setResults.length}).map((_, setIdx) => {
                        let t1W = 0, t2W = 0;
                        for(let i=0; i<setIdx; i++) {
                            if(match.setResults[i] === 1) t1W++;
                            if(match.setResults[i] === 2) t2W++;
                        }
                        const mMaxSets = match.maxSets || match.setResults.length;
                        const winsNeeded = Math.ceil(mMaxSets / 2);
                        const isDisabled = (t1W >= winsNeeded || t2W >= winsNeeded);
                        const t1Win = match.setResults[setIdx] === 1;
                        const t2Win = match.setResults[setIdx] === 2;
                        return `
                        <div class="set-box ${isDisabled ? 'disabled-set' : ''}">
                            <span class="set-title">${setIdx + 1}세트</span>
                            <button class="set-btn team1-btn ${t1Win ? 'active' : ''} ${t2Win ? 'loser' : ''} ${isDisabled ? 'disabled' : ''}" 
                                ${isDisabled ? 'disabled' : ''}
                                onclick="handleSetClick(${match.id}, ${setIdx}, 1)">팀1</button>
                            <button class="set-btn team2-btn ${t2Win ? 'active' : ''} ${t1Win ? 'loser' : ''} ${isDisabled ? 'disabled' : ''}" 
                                ${isDisabled ? 'disabled' : ''}
                                onclick="handleSetClick(${match.id}, ${setIdx}, 2)">팀2</button>
                        </div>
                        `
                    }).join('')}
                </div>
            </div>
        `;
        
        container.appendChild(card);
    });
}

let currentSwapMatchId = null;

window.openSwapModal = function(matchId) {
    const match = matches.find(m => m.id === matchId);
    if (!match || !match.referee) return;
    
    // Check if results are entered
    const hasResults = match.setResults.some(res => res !== 0);
    if (hasResults) {
        alert("승패가 입력된 게임은 심판을 변경할 수 없습니다.");
        return;
    }
    
    currentSwapMatchId = matchId;
    const listContainer = document.getElementById('swap-player-list');
    listContainer.innerHTML = '';
    
    // Players in this match
    const playingPlayers = [...match.team1, ...match.team2];
    
    playingPlayers.forEach(p => {
        const btn = document.createElement('button');
        btn.className = 'modal-player-btn';
        btn.innerText = `${p.name} (${p.bu}부)`;
        btn.onclick = () => performSwap(p.id);
        listContainer.appendChild(btn);
    });
    
    document.getElementById('swap-modal').classList.add('active');
}

window.closeSwapModal = function() {
    document.getElementById('swap-modal').classList.remove('active');
    currentSwapMatchId = null;
}

window.performSwap = function(playerId) {
    if (!currentSwapMatchId) return;
    const match = matches.find(m => m.id === currentSwapMatchId);
    if (!match) return;
    
    const oldReferee = match.referee;
    let targetPlayer = null;
    
    const t1Idx = match.team1.findIndex(p => p.id === playerId);
    if (t1Idx !== -1) {
        targetPlayer = match.team1[t1Idx];
        match.team1[t1Idx] = oldReferee;
    } else {
        const t2Idx = match.team2.findIndex(p => p.id === playerId);
        if (t2Idx !== -1) {
            targetPlayer = match.team2[t2Idx];
            match.team2[t2Idx] = oldReferee;
        }
    }
    
    if (targetPlayer) {
        match.referee = targetPlayer;
        saveToLocalStorage();
        calculateStats();
        renderDashboard();
        renderMatches();
        saveToFirebase();
    }
    closeSwapModal();
}

document.addEventListener('DOMContentLoaded', init);
