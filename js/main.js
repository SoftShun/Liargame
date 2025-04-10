/**
 * 라이어 게임 - 메인 스크립트
 * DOM 조작 및 게임 로직 연결
 */

document.addEventListener('DOMContentLoaded', () => {
    // PeerJS 라이브러리 로드 확인
    function checkPeerJSLoaded() {
        if (typeof Peer === 'undefined') {
            console.error('PeerJS 라이브러리가 로드되지 않았습니다.');
            alert('필수 라이브러리(PeerJS)가 로드되지 않았습니다. 페이지를 새로고침 하거나 다른 브라우저에서 시도해주세요.');
            return false;
        }
        console.log('PeerJS 라이브러리 확인 완료:', typeof Peer);
        return true;
    }

    // 페이지 로드 시 PeerJS 로드 여부 확인
    setTimeout(checkPeerJSLoaded, 5000);
    
    // 로컬 스토리지 초기화 (이전 세션 데이터가 문제를 일으킬 수 있음)
    try {
        localStorage.removeItem('liargame_data');
        localStorage.removeItem('liargame_session');
        console.log('로컬 스토리지 초기화 완료');
    } catch (e) {
        console.warn('로컬 스토리지 초기화 실패:', e);
    }

    // ID 중복 확인 (플레이어 목록 ID가 중복될 수 있음)
    window.addEventListener('load', () => {
        const allElements = document.querySelectorAll('[id]');
        const idMap = {};
        
        allElements.forEach(el => {
            const id = el.id;
            if (!idMap[id]) {
                idMap[id] = [];
            }
            idMap[id].push(el);
        });
        
        for (const id in idMap) {
            if (idMap[id].length > 1) {
                console.error(`중복된 ID 발견: ${id}, 개수: ${idMap[id].length}`);
                
                // players-list ID 충돌 해결
                if (id === 'players-list') {
                    // 게임 화면의 players-list에 고유 ID 부여
                    const gameScreenList = document.querySelector('#game-screen .players-list');
                    if (gameScreenList) {
                        gameScreenList.id = 'game-players-list';
                        console.log('게임 화면의 players-list ID를 game-players-list로 변경했습니다.');
                    }
                }
            }
        }
    });

    // DOM 요소
    const loginScreen = document.getElementById('login-screen');
    const lobbyScreen = document.getElementById('lobby-screen');
    const gameScreen = document.getElementById('game-screen');
    const nicknameInput = document.getElementById('nickname-input');
    const joinGameBtn = document.getElementById('join-game-btn');
    const playersList = document.getElementById('players-list');
    const playerCount = document.getElementById('player-count');
    const gameSettings = document.getElementById('game-settings');
    const gameModeSelect = document.getElementById('game-mode');
    const startGameBtn = document.getElementById('start-game-btn');
    const categoryDisplay = document.getElementById('category');
    const wordDisplay = document.getElementById('word');
    const chatMessages = document.getElementById('chat-messages');
    const chatInput = document.getElementById('chat-input');
    const chatSendBtn = document.getElementById('chat-send-btn');
    const turnChatInput = document.getElementById('turn-chat-input');
    const turnChatSendBtn = document.getElementById('turn-chat-send-btn');
    const turnDisplay = document.getElementById('turn-display');
    const voteSection = document.getElementById('vote-section');
    const voteList = document.getElementById('vote-list');
    const voteResultDisplay = document.getElementById('vote-result');
    const gameResultDisplay = document.getElementById('game-result');
    const restartGameBtn = document.getElementById('restart-game-btn');
    const spectatorList = document.getElementById('spectator-list');
    const helpBtn = document.getElementById('help-btn');
    const helpModal = document.getElementById('help-modal');
    const closeModalBtn = document.querySelector('.close-btn');
    const freeChatMessages = document.getElementById('free-chat-messages');
    
    // 단일 고정 방 ID - 모든 사용자가 동일한 방에 접속
    const DEFAULT_ROOM_ID = "liargame-fixed-room";
    
    // 게임 인스턴스
    console.log('게임 인스턴스 생성 시작');
    let game = new LiarGame();
    let myId = null;
    let votingTimer = null;
    let guessTimer = null;
    let isFirstPlayer = true;  // 첫 번째 플레이어 여부

    // 초기 화면 설정
    loginScreen.style.display = 'block';
    lobbyScreen.style.display = 'none';
    gameScreen.style.display = 'none';
    
    // 도움말 모달 이벤트
    helpBtn.addEventListener('click', () => {
        helpModal.style.display = 'block';
    });
    
    closeModalBtn.addEventListener('click', () => {
        helpModal.style.display = 'none';
    });
    
    window.addEventListener('click', (event) => {
        if (event.target === helpModal) {
            helpModal.style.display = 'none';
        }
    });
    
    // 게임 참여 버튼 클릭
    joinGameBtn.addEventListener('click', async () => {
        const nickname = nicknameInput.value.trim();
        
        if (nickname.length < 1 || nickname.length > 6) {
            alert('닉네임은 1자 이상 6자 이하로 입력해주세요.');
            return;
        }
        
        joinGameBtn.disabled = true;
        joinGameBtn.textContent = '접속 중...';
        
        try {
            console.log('게임 초기화 시작');
            myId = await game.init(nickname);
            
            // 로그인 화면 숨기고 로비 화면 표시
            loginScreen.style.display = 'none';
            lobbyScreen.style.display = 'block';
            
            // 이벤트 리스너 설정
            setupGameListeners();
            
            // 기존 방에 입장 시도 
            try {
                console.log('기존 방 입장 시도:', DEFAULT_ROOM_ID);
                await game.joinRoom(DEFAULT_ROOM_ID);
                console.log('기존 방 입장 성공');
                isFirstPlayer = false;
                
                // 플레이어 목록 업데이트
                updatePlayersList();
                
                // 일반 플레이어는 게임 시작/설정 버튼 비활성화
                startGameBtn.disabled = true;
                gameModeSelect.disabled = true;
            } catch (joinError) {
                console.log('기존 방 입장 실패, 새 방 생성:', joinError.message);
                
                // 기존 방 입장 실패 시 새 방 생성 (첫 번째 플레이어)
                const roomId = game.createRoom();
                isFirstPlayer = true;
                
                // 플레이어 목록 업데이트
                updatePlayersList();
                
                // 첫 번째 플레이어는 자동으로 방장
                startGameBtn.disabled = false;
                gameModeSelect.disabled = false;
            }
            
            console.log('게임 초기화 및 방 설정 완료');
        } catch (error) {
            joinGameBtn.disabled = false;
            joinGameBtn.textContent = '게임 참여하기';
            
            console.error('게임 초기화 실패:', error);
            
            // 오류 상세 정보 로깅
            console.log('게임 초기화 오류 상세 정보');
            console.log('오류 메시지:', error.message || '알 수 없는 오류');
            console.log('오류 객체:', error);
            console.log('브라우저:', navigator.userAgent);
            console.log('PeerJS 상태:', window.peerJSLoaded ? '로드됨' : '로드 안됨');
            
            let errorMessage = '연결 오류가 발생했습니다.\n';
            
            // 오류 유형에 따른 메시지 처리
            if (error.type === 'network' || error.message && error.message.includes('network')) {
                errorMessage += '네트워크 연결을 확인해주세요.';
            } else if (error.type === 'peer-unavailable') {
                errorMessage += '존재하지 않는 방입니다.';
            } else if (error.type === 'unavailable-id') {
                errorMessage += '이미 사용 중인 ID입니다.';
            } else if (error.message && error.message.includes('시간 초과')) {
                errorMessage += '연결 시간이 초과되었습니다. 다시 시도해주세요.';
            } else if (error.message && error.message.includes('SSL')) {
                errorMessage += 'SSL 연결 오류가 발생했습니다. HTTPS 환경에서 실행해주세요.';
            } else {
                errorMessage += '알 수 없는 오류가 발생했습니다. 페이지를 새로고침 후 다시 시도해주세요.';
            }
            
            // 브라우저 캐시 삭제 방법 안내
            errorMessage += '\n\n문제가 지속될 경우:';
            errorMessage += '\n1. 브라우저 캐시 삭제: Ctrl+Shift+Delete (Chrome/Edge) 또는 Command+Shift+Delete (Safari)';
            errorMessage += '\n2. 시크릿/비공개 브라우징 모드에서 접속: Ctrl+Shift+N (Chrome) 또는 Ctrl+Shift+P (Firefox)';
            errorMessage += '\n3. 다른 브라우저에서 시도: Chrome, Firefox, Edge 등';
            
            alert(errorMessage);
        }
    });
    
    // 게임 시작 버튼 클릭
    startGameBtn.addEventListener('click', () => {
        if (!game) return;
        if (!game.isHost) {
            alert('방장만 게임을 시작할 수 있습니다.');
            return;
        }
        
        game.setGameMode(gameModeSelect.value);
        game.startGame();
    });
    
    // 턴 채팅 전송 버튼 클릭
    turnChatSendBtn.addEventListener('click', () => {
        if (!game) return;
        
        const message = turnChatInput.value.trim();
        if (!message) return;
        
        if (game.gamePhase === 'playing' && 
            game.turnOrder[game.currentTurn].id === myId) {
            game.sendMessage(message, true);
            turnChatInput.value = '';
        } else if (game.gamePhase === 'wordGuess' && game.liar === myId) {
            game.sendMessage(message, false);
            turnChatInput.value = '';
        }
    });
    
    // 턴 채팅 입력시 엔터키 처리
    turnChatInput.addEventListener('keypress', event => {
        if (event.key === 'Enter') {
            event.preventDefault();
            turnChatSendBtn.click();
        }
    });
    
    // 일반 채팅 전송 버튼 클릭
    chatSendBtn.addEventListener('click', () => {
        if (!game) return;
        
        const message = chatInput.value.trim();
        if (!message) return;
        
        sendFreeChat(message);
        chatInput.value = '';
    });
    
    // 채팅 입력시 엔터키 처리
    chatInput.addEventListener('keypress', event => {
        if (event.key === 'Enter') {
            event.preventDefault();
            chatSendBtn.click();
        }
    });
    
    // 게임 재시작 버튼 클릭
    restartGameBtn.addEventListener('click', () => {
        if (!game) return;
        if (!game.isHost) {
            alert('방장만 게임을 재시작할 수 있습니다.');
            return;
        }
        
        game.restartGame();
    });
    
    // 게임 모드 변경
    gameModeSelect.addEventListener('change', () => {
        if (!game || !game.isHost) return;
        game.setGameMode(gameModeSelect.value);
    });
    
    // 자유 채팅 메시지 전송
    function sendFreeChat(message) {
        const freeChatData = {
            type: 'freeChat',
            playerId: myId,
            nickname: game.players.find(p => p.id === myId).nickname,
            message: message
        };
        
        // 모든 플레이어에게 전송
        game.broadcastToAll(freeChatData);
        
        // 자유 채팅 메시지 표시
        showFreeChatMessage(freeChatData.nickname, freeChatData.message);
    }
    
    // 게임 이벤트 리스너 설정
    function setupGameListeners() {
        // 초기화 완료 이벤트
        game.on('initialized', data => {
            console.log('게임 초기화 완료:', data);
        });
        
        // 방 생성 이벤트
        game.on('roomCreated', data => {
            console.log('방 생성됨:', data);
            
            // 접속 정보 표시
            const connectionInfo = document.createElement('div');
            connectionInfo.classList.add('connection-info');
            connectionInfo.innerHTML = `
                <p>방 ID: <span id="room-id">${data.roomId}</span>
                <button id="copy-room-id" class="copy-btn">복사</button></p>
                <p>다른 플레이어들이 이 방에 자동으로 연결됩니다.</p>
            `;
            
            // 로비 컨트롤 영역에 추가
            const lobbyControls = document.getElementById('lobby-controls');
            if (lobbyControls) {
                lobbyControls.innerHTML = '';
                lobbyControls.appendChild(connectionInfo);
                
                // 복사 버튼 이벤트 추가
                const copyBtn = document.getElementById('copy-room-id');
                if (copyBtn) {
                    copyBtn.addEventListener('click', () => {
                        const roomIdSpan = document.getElementById('room-id');
                        if (roomIdSpan) {
                            navigator.clipboard.writeText(roomIdSpan.textContent)
                                .then(() => {
                                    copyBtn.textContent = '복사됨!';
                                    setTimeout(() => {
                                        copyBtn.textContent = '복사';
                                    }, 2000);
                                })
                                .catch(err => {
                                    console.error('클립보드 복사 실패:', err);
                                    alert('클립보드 복사에 실패했습니다.');
                                });
                        }
                    });
                }
            }
        });
        
        // 방 입장 이벤트
        game.on('roomJoined', data => {
            console.log('방 입장됨:', data);
        });
        
        // 플레이어 입장 이벤트
        game.on('playerJoined', data => {
            console.log('플레이어 입장:', data);
            updatePlayersList();
            showSystemMessage(`${data.nickname}님이 입장했습니다.`);
            
            // 플레이어 수 업데이트
            playerCount.textContent = game.players.length;
        });
        
        // 플레이어 퇴장 이벤트
        game.on('playerLeft', data => {
            console.log('플레이어 퇴장:', data);
            updatePlayersList();
            showSystemMessage(`${data.nickname}님이 퇴장했습니다.`);
            
            // 플레이어 수 업데이트
            playerCount.textContent = game.players.length;
        });
        
        // 관전자 입장 이벤트
        game.on('spectatorJoined', data => {
            console.log('관전자 입장:', data);
            updateSpectatorList();
            showSystemMessage(`${data.nickname}님이 관전자로 입장했습니다.`);
        });
        
        // 관전자 퇴장 이벤트
        game.on('spectatorLeft', data => {
            console.log('관전자 퇴장:', data);
            updateSpectatorList();
            showSystemMessage(`${data.nickname}님이 관전을 종료했습니다.`);
        });
        
        // 새 호스트 지정 이벤트
        game.on('newHost', data => {
            console.log('새 호스트:', data);
            updatePlayersList();
            showSystemMessage(`${data.nickname}님이 새로운 방장이 되었습니다.`);
            
            // 내가 새 방장이면 설정 버튼 활성화
            if (data.id === myId) {
                startGameBtn.disabled = false;
                gameModeSelect.disabled = false;
            }
        });
        
        // 게임 모드 변경 이벤트
        game.on('gameModeChanged', data => {
            console.log('게임 모드 변경:', data);
            gameModeSelect.value = data.mode;
            showSystemMessage(`게임 모드가 ${data.mode === 'basic' ? '기본 모드' : '스파이 모드'}로 변경되었습니다.`);
        });
        
        // 게임 시작 이벤트
        game.on('gameStarted', data => {
            console.log('게임 시작:', data);
            
            // 화면 전환
            lobbyScreen.style.display = 'none';
            gameScreen.style.display = 'block';
            
            // 게임 정보 표시
            categoryDisplay.textContent = `카테고리: ${data.category}`;
            
            if (data.isLiar) {
                wordDisplay.textContent = '당신은 라이어입니다!';
                wordDisplay.classList.add('liar');
            } else {
                wordDisplay.textContent = `단어: ${data.word}`;
                wordDisplay.classList.remove('liar');
            }
            
            if (data.isSpy) {
                const spyInfo = document.createElement('div');
                spyInfo.textContent = '당신은 스파이입니다! 정답을 알고 있지만, 들키지 않도록 조심하세요.';
                spyInfo.classList.add('spy');
                wordDisplay.appendChild(spyInfo);
            }
            
            // 턴 순서 표시
            console.log('턴 순서 데이터:', data.turnOrder);
            
            // 플레이어 컬럼이 보이는지 확인 및 강제로 표시
            const playersColumn = document.querySelector('.players-column');
            if (playersColumn) {
                playersColumn.style.display = 'block';
                playersColumn.style.visibility = 'visible';
            }
            
            // 플레이어 순서 업데이트
            updateTurnOrder(data.turnOrder);
            
            // 턴 순서가 보이는지 확인
            setTimeout(() => {
                const gamePlayersList = document.querySelector('#game-screen .players-list');
                if (gamePlayersList && gamePlayersList.children.length === 0) {
                    console.warn('플레이어 목록이 비어있습니다. 수동으로 추가합니다.');
                    
                    // 임시 데이터로 강제 표시
                    const tempPlayers = [];
                    tempPlayers.push({
                        id: myId,
                        nickname: game.players.find(p => p.id === myId)?.nickname || '나'
                    });
                    
                    // 다른 플레이어들 추가
                    game.players.forEach(p => {
                        if (p.id !== myId) {
                            tempPlayers.push({
                                id: p.id,
                                nickname: p.nickname
                            });
                        }
                    });
                    
                    updateTurnOrder(tempPlayers);
                }
            }, 500);
            
            // 채팅창 초기화
            // 플레이어 컬럼 스타일 확인
            if (playersColumn) {
                console.log('플레이어 컬럼 스타일:', 
                    'display:', window.getComputedStyle(playersColumn).display,
                    'height:', window.getComputedStyle(playersColumn).height,
                    'visibility:', window.getComputedStyle(playersColumn).visibility
                );
            }
            
            // 채팅창 초기화
            chatMessages.innerHTML = '';
            freeChatMessages.innerHTML = '';
            showSystemMessage('게임이 시작되었습니다.');
            
            // 투표 섹션 초기화
            voteSection.style.display = 'none';
            voteResultDisplay.innerHTML = '';
            gameResultDisplay.innerHTML = '';
        });
        
        // 턴 시작 이벤트
        game.on('turnStart', data => {
            console.log('턴 시작:', data);
            
            turnDisplay.textContent = `${data.turnNumber}번째 차례: ${data.nickname}`;
            
            // 현재 플레이어 하이라이트
            const gamePlayersList = document.querySelector('#game-screen .players-list');
            if (gamePlayersList) {
                const playerItems = gamePlayersList.querySelectorAll('.player-item');
                playerItems.forEach(item => {
                    item.classList.remove('current-turn');
                });
                
                const currentPlayer = gamePlayersList.querySelector(`[data-player-id="${data.playerId}"]`);
                if (currentPlayer) {
                    currentPlayer.classList.add('current-turn');
                } else {
                    console.warn(`현재 턴 플레이어(${data.nickname}, ${data.playerId})의 요소를 찾을 수 없습니다.`);
                }
            } else {
                console.error('게임 화면의 플레이어 리스트를 찾을 수 없습니다.');
            }
            
            // 채팅 입력창 활성화/비활성화
            if (data.playerId === myId) {
                turnChatInput.disabled = false;
                turnChatSendBtn.disabled = false;
                turnChatInput.placeholder = '당신의 차례입니다. 단어에 대해 설명해주세요. (40자 이내)';
                turnChatInput.focus();
            } else {
                turnChatInput.disabled = true;
                turnChatSendBtn.disabled = true;
                turnChatInput.placeholder = `${data.nickname}님의 차례입니다.`;
            }
            
            showSystemMessage(`${data.nickname}님의 차례입니다.`);
        });
        
        // 턴 채팅 이벤트
        game.on('turnChat', data => {
            console.log('턴 채팅:', data);
            
            const messageEl = document.createElement('div');
            messageEl.classList.add('turn-message');
            
            const nickname = document.createElement('span');
            nickname.classList.add('nickname');
            nickname.textContent = `${data.nickname}: `;
            
            const message = document.createElement('span');
            message.textContent = data.message;
            
            messageEl.appendChild(nickname);
            messageEl.appendChild(message);
            chatMessages.appendChild(messageEl);
            chatMessages.scrollTop = chatMessages.scrollHeight;
        });
        
        // 자유 채팅 이벤트 처리
        game.peer.on('connection', conn => {
            conn.on('data', data => {
                if (data.type === 'freeChat') {
                    showFreeChatMessage(data.nickname, data.message);
                }
            });
        });
        
        // 기존 연결들에 대한 자유 채팅 이벤트 등록
        for (const conn of game.connections) {
            conn.on('data', data => {
                if (data.type === 'freeChat') {
                    showFreeChatMessage(data.nickname, data.message);
                }
            });
        }
        
        // 투표 시작 이벤트
        game.on('voteStart', data => {
            console.log('투표 시작:', data);
            
            // 투표 섹션 표시
            voteSection.style.display = 'block';
            voteList.innerHTML = '';
            
            // 투표 타이머 설정 (20초)
            let timeLeft = 20;
            document.getElementById('vote-timer').textContent = `투표 시간: ${timeLeft}초`;
            
            votingTimer = setInterval(() => {
                timeLeft--;
                document.getElementById('vote-timer').textContent = `투표 시간: ${timeLeft}초`;
                
                if (timeLeft <= 0) {
                    clearInterval(votingTimer);
                }
            }, 1000);
            
            // 투표 목록 생성
            data.players.forEach(player => {
                const playerItem = document.createElement('div');
                playerItem.classList.add('vote-player-item');
                
                const nickname = document.createElement('span');
                nickname.textContent = player.nickname;
                
                const voteBtn = document.createElement('button');
                voteBtn.textContent = '투표';
                voteBtn.classList.add('vote-btn');
                
                // 내 자신에게는 투표 불가
                if (player.id === myId) {
                    voteBtn.disabled = true;
                }
                
                // 투표 버튼 클릭 이벤트
                voteBtn.addEventListener('click', () => {
                    game.submitVote(player.id);
                    
                    // 모든 투표 버튼 비활성화
                    const allVoteBtns = voteList.querySelectorAll('.vote-btn');
                    allVoteBtns.forEach(btn => {
                        btn.disabled = true;
                    });
                    
                    playerItem.classList.add('voted');
                    showSystemMessage(`당신은 ${player.nickname}님에게 투표했습니다.`);
                });
                
                playerItem.appendChild(nickname);
                playerItem.appendChild(voteBtn);
                voteList.appendChild(playerItem);
            });
            
            showSystemMessage('투표가 시작되었습니다. 라이어라고 생각되는 사람에게 투표하세요.');
            turnChatInput.disabled = true;
            turnChatSendBtn.disabled = true;
        });
        
        // 투표 결과 이벤트
        game.on('voteResult', data => {
            console.log('투표 결과:', data);
            
            // 투표 타이머 중지
            clearInterval(votingTimer);
            
            // 결과 표시
            voteResultDisplay.innerHTML = '';
            
            const voteTitle = document.createElement('h3');
            voteTitle.textContent = '투표 결과';
            voteResultDisplay.appendChild(voteTitle);
            
            const voteTable = document.createElement('table');
            voteTable.classList.add('vote-table');
            
            // 테이블 헤더
            const headerRow = document.createElement('tr');
            const headerVoter = document.createElement('th');
            headerVoter.textContent = '투표자';
            const headerTarget = document.createElement('th');
            headerTarget.textContent = '투표 대상';
            
            headerRow.appendChild(headerVoter);
            headerRow.appendChild(headerTarget);
            voteTable.appendChild(headerRow);
            
            // 투표 결과 행 추가
            for (const voterId in data.votes) {
                const voter = game.players.find(p => p.id === voterId);
                const targetId = data.votes[voterId];
                let targetNickname = '기권';
                
                if (targetId) {
                    const target = game.players.find(p => p.id === targetId);
                    if (target) {
                        targetNickname = target.nickname;
                    }
                }
                
                const row = document.createElement('tr');
                const tdVoter = document.createElement('td');
                tdVoter.textContent = voter ? voter.nickname : '알 수 없음';
                const tdTarget = document.createElement('td');
                tdTarget.textContent = targetNickname;
                
                row.appendChild(tdVoter);
                row.appendChild(tdTarget);
                voteTable.appendChild(row);
            }
            
            voteResultDisplay.appendChild(voteTable);
            
            // 투표 집계 표시
            const voteSummary = document.createElement('div');
            voteSummary.classList.add('vote-summary');
            
            const summaryTitle = document.createElement('h3');
            summaryTitle.textContent = '득표 수';
            voteSummary.appendChild(summaryTitle);
            
            const summaryList = document.createElement('ul');
            
            for (const targetId in data.voteCount) {
                const target = game.players.find(p => p.id === targetId);
                if (!target) continue;
                
                const count = data.voteCount[targetId];
                const item = document.createElement('li');
                item.textContent = `${target.nickname}: ${count}표`;
                summaryList.appendChild(item);
            }
            
            voteSummary.appendChild(summaryList);
            voteResultDisplay.appendChild(voteSummary);
            
            // 최종 게임 결과 표시 (라이어가 지목된 경우)
            if (data.gameResult) {
                displayGameResult(data.gameResult, data.playerScores);
            }
        });
        
        // 단어 추측 시작 이벤트
        game.on('wordGuessStart', data => {
            console.log('단어 추측 시작:', data);
            
            // 라이어 추측 타이머 설정 (20초)
            let timeLeft = 20;
            const timerDisplay = document.createElement('div');
            timerDisplay.id = 'guess-timer';
            timerDisplay.textContent = `라이어 추측 시간: ${timeLeft}초`;
            timerDisplay.classList.add('timer');
            
            voteResultDisplay.appendChild(timerDisplay);
            
            guessTimer = setInterval(() => {
                timeLeft--;
                timerDisplay.textContent = `라이어 추측 시간: ${timeLeft}초`;
                
                if (timeLeft <= 0) {
                    clearInterval(guessTimer);
                }
            }, 1000);
            
            // 현재 플레이어 하이라이트
            const playerItems = playersList.querySelectorAll('.player-item');
            playerItems.forEach(item => {
                item.classList.remove('current-turn');
                item.classList.remove('liar-guess');
            });
            
            const liarPlayer = playersList.querySelector(`[data-player-id="${data.liarId}"]`);
            if (liarPlayer) {
                liarPlayer.classList.add('liar-guess');
            }
            
            // 라이어만 입력 가능
            if (myId === data.liarId) {
                turnChatInput.disabled = false;
                turnChatSendBtn.disabled = false;
                turnChatInput.placeholder = '당신이 라이어입니다! 단어를 추측해 입력하세요. (20초)';
                turnChatInput.focus();
            } else {
                turnChatInput.disabled = true;
                turnChatSendBtn.disabled = true;
                turnChatInput.placeholder = `${data.liarNickname}님이 단어를 추측 중입니다...`;
            }
            
            showSystemMessage(`${data.liarNickname}님이 라이어입니다! 단어를 추측할 시간이 20초 주어집니다.`);
        });
        
        // 게임 결과 이벤트
        game.on('gameResult', data => {
            console.log('게임 결과:', data);
            
            // 라이어 추측 타이머 중지
            clearInterval(guessTimer);
            displayGameResult(data.gameResult, data.playerScores);
        });
        
        // 게임 재시작 이벤트
        game.on('gameRestarted', data => {
            console.log('게임 재시작:', data);
            
            // 화면 초기화
            gameScreen.style.display = 'none';
            lobbyScreen.style.display = 'block';
            
            // 플레이어 목록 업데이트
            updatePlayersList();
            
            // 플레이어 수 업데이트
            playerCount.textContent = game.players.length;
            
            showSystemMessage('게임이 재시작되었습니다.');
        });
        
        // 게임 강제 종료 이벤트
        game.on('gameEnded', data => {
            console.log('게임 종료:', data);
            
            // 게임 상태 초기화
            gameScreen.style.display = 'none';
            lobbyScreen.style.display = 'block';
            
            showSystemMessage(`게임이 종료되었습니다: ${data.reason}`);
        });
        
        // 오류 이벤트
        game.on('error', data => {
            console.error('게임 오류:', data);
            alert(`오류: ${data.message}`);
        });
    }
    
    // 플레이어 목록 업데이트
    function updatePlayersList() {
        if (!game) return;
        
        playersList.innerHTML = '';
        
        game.players.forEach((player, index) => {
            const playerItem = document.createElement('div');
            playerItem.classList.add('player-item');
            playerItem.dataset.playerId = player.id;
            
            // 내 자신 표시
            if (player.id === myId) {
                playerItem.classList.add('my-player');
            }
            
            // 호스트 표시
            if (player.isHost) {
                playerItem.classList.add('host');
            }
            
            const nickname = document.createElement('span');
            nickname.classList.add('player-nickname');
            nickname.textContent = player.nickname;
            
            const score = document.createElement('span');
            score.classList.add('player-score');
            score.textContent = `${player.score}점`;
            
            const status = document.createElement('span');
            status.classList.add('player-status');
            if (player.isHost) {
                status.textContent = '[방장]';
            }
            
            playerItem.appendChild(nickname);
            playerItem.appendChild(score);
            playerItem.appendChild(status);
            
            playersList.appendChild(playerItem);
        });
        
        // 플레이어 수 업데이트
        playerCount.textContent = game.players.length;
        
        // 게임 설정 섹션 업데이트
        startGameBtn.disabled = !game.isHost;
        gameModeSelect.disabled = !game.isHost;
    }
    
    // 관전자 목록 업데이트
    function updateSpectatorList() {
        if (!game) return;
        
        spectatorList.innerHTML = '';
        
        if (game.spectators.length === 0) {
            spectatorList.style.display = 'none';
            return;
        }
        
        spectatorList.style.display = 'block';
        
        const title = document.createElement('h3');
        title.textContent = '관전자';
        spectatorList.appendChild(title);
        
        const list = document.createElement('ul');
        
        game.spectators.forEach(spectator => {
            const item = document.createElement('li');
            item.textContent = spectator.nickname;
            list.appendChild(item);
        });
        
        spectatorList.appendChild(list);
    }
    
    // 턴 순서 업데이트
    function updateTurnOrder(turnOrder) {
        if (!game) return;
        
        console.log('턴 순서 업데이트:', turnOrder);
        
        // 게임 화면의 플레이어 리스트 요소 가져오기
        // ID 중복을 해결하기 위해 querySelector 사용
        const gamePlayersList = document.querySelector('#game-screen .players-list');
        if (!gamePlayersList) {
            console.error('게임 화면의 플레이어 리스트 요소를 찾을 수 없습니다.');
            return;
        }
        
        // 플레이어 리스트 초기화
        gamePlayersList.innerHTML = '';
        
        // 턴 순서가 없거나 비어있는 경우 처리
        if (!turnOrder || turnOrder.length === 0) {
            console.error('턴 순서 데이터가 없습니다.');
            const emptyMessage = document.createElement('div');
            emptyMessage.textContent = '플레이어 정보를 불러올 수 없습니다.';
            emptyMessage.style.padding = '10px';
            gamePlayersList.appendChild(emptyMessage);
            return;
        }
        
        // 플레이어 항목 생성 및 추가
        turnOrder.forEach((player, index) => {
            const playerItem = document.createElement('div');
            playerItem.classList.add('player-item');
            playerItem.dataset.playerId = player.id;
            
            // 내 자신 표시
            if (player.id === myId) {
                playerItem.classList.add('my-player');
            }
            
            // 순서 표시
            const orderNumber = document.createElement('span');
            orderNumber.classList.add('turn-order');
            orderNumber.textContent = `${index + 1}`;
            
            const nickname = document.createElement('span');
            nickname.classList.add('player-nickname');
            nickname.textContent = player.nickname || '알 수 없음';
            
            // 현재 플레이어면 하이라이트
            if (index === 0) {
                playerItem.classList.add('current-turn');
            }
            
            playerItem.appendChild(orderNumber);
            playerItem.appendChild(nickname);
            
            gamePlayersList.appendChild(playerItem);
        });
        
        console.log('플레이어 리스트 업데이트 완료, 항목 수:', gamePlayersList.children.length);
    }
    
    // 시스템 메시지 표시 (메인 채팅창)
    function showSystemMessage(message) {
        const messageEl = document.createElement('div');
        messageEl.classList.add('system-message');
        messageEl.textContent = message;
        
        chatMessages.appendChild(messageEl);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }
    
    // 자유 채팅 메시지 표시 (오른쪽 자유 채팅창)
    function showFreeChatMessage(nickname, message) {
        const messageEl = document.createElement('div');
        messageEl.classList.add('free-chat-message');
        
        const nicknameSpan = document.createElement('span');
        nicknameSpan.classList.add('nickname');
        nicknameSpan.textContent = `${nickname}: `;
        
        const messageSpan = document.createElement('span');
        messageSpan.textContent = message;
        
        messageEl.appendChild(nicknameSpan);
        messageEl.appendChild(messageSpan);
        
        freeChatMessages.appendChild(messageEl);
        freeChatMessages.scrollTop = freeChatMessages.scrollHeight;
    }
    
    // 게임 결과 표시
    function displayGameResult(result, playerScores) {
        gameResultDisplay.innerHTML = '';
        
        const resultTitle = document.createElement('h3');
        resultTitle.textContent = '게임 결과';
        gameResultDisplay.appendChild(resultTitle);
        
        const resultInfo = document.createElement('div');
        resultInfo.classList.add('result-info');
        
        // 라이어 정보
        const liarInfo = document.createElement('p');
        liarInfo.textContent = `라이어: ${result.liarNickname}`;
        resultInfo.appendChild(liarInfo);
        
        // 스파이 정보 (스파이 모드인 경우)
        if (result.spyId) {
            const spyInfo = document.createElement('p');
            spyInfo.textContent = `스파이: ${result.spyNickname}`;
            resultInfo.appendChild(spyInfo);
        }
        
        // 단어 정보
        const wordInfo = document.createElement('p');
        wordInfo.textContent = `정답 단어: ${result.word}`;
        resultInfo.appendChild(wordInfo);
        
        // 라이어 추측 정보 (추측 단계가 있었을 경우)
        if (result.guessedWord !== undefined) {
            const guessInfo = document.createElement('p');
            guessInfo.textContent = `라이어의 추측: ${result.guessedWord || '(시간 초과)'}`;
            guessInfo.classList.add(result.isCorrect ? 'correct-guess' : 'wrong-guess');
            resultInfo.appendChild(guessInfo);
        }
        
        // 승리 정보
        const winnerInfo = document.createElement('p');
        winnerInfo.classList.add('winner-info');
        
        if (result.result === 'liarWin') {
            winnerInfo.textContent = '라이어 승리!';
            winnerInfo.classList.add('liar-win');
        } else {
            winnerInfo.textContent = '시민들 승리!';
            winnerInfo.classList.add('citizens-win');
        }
        
        resultInfo.appendChild(winnerInfo);
        gameResultDisplay.appendChild(resultInfo);
        
        // 점수 정보
        const scoreTitle = document.createElement('h3');
        scoreTitle.textContent = '현재 점수';
        gameResultDisplay.appendChild(scoreTitle);
        
        const scoreTable = document.createElement('table');
        scoreTable.classList.add('score-table');
        
        const headerRow = document.createElement('tr');
        const headerPlayer = document.createElement('th');
        headerPlayer.textContent = '플레이어';
        const headerScore = document.createElement('th');
        headerScore.textContent = '점수';
        
        headerRow.appendChild(headerPlayer);
        headerRow.appendChild(headerScore);
        scoreTable.appendChild(headerRow);
        
        playerScores.sort((a, b) => b.score - a.score).forEach(player => {
            const row = document.createElement('tr');
            
            // 내 자신 하이라이트
            if (player.id === myId) {
                row.classList.add('my-score');
            }
            
            const tdPlayer = document.createElement('td');
            tdPlayer.textContent = player.nickname;
            const tdScore = document.createElement('td');
            tdScore.textContent = player.score;
            
            row.appendChild(tdPlayer);
            row.appendChild(tdScore);
            scoreTable.appendChild(row);
        });
        
        gameResultDisplay.appendChild(scoreTable);
        
        // 재시작 버튼 표시
        restartGameBtn.style.display = 'block';
    }
});
