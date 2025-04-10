/**
 * 라이어 게임 - 메인 스크립트
 * DOM 조작 및 게임 로직 연결
 */

document.addEventListener('DOMContentLoaded', () => {
    console.log('게임 스크립트 초기화');
    
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
    const playersList = document.getElementById('players-list');
    const gamePlayersList = document.getElementById('game-players-list');
    const spectatorsList = document.getElementById('spectators-list');
    const nicknameInput = document.getElementById('nickname-input');
    const roomIdInput = document.getElementById('room-id-input');
    const joinGameBtn = document.getElementById('join-game-btn');
    const createRoomBtn = document.getElementById('create-room-btn');
    const joinRoomBtn = document.getElementById('join-room-btn');
    const startGameBtn = document.getElementById('start-game-btn');
    const gameModeSelect = document.getElementById('game-mode-select');
    const chatInput = document.getElementById('chat-input');
    const chatSendBtn = document.getElementById('chat-send-btn');
    const chatMessages = document.getElementById('chat-messages');
    const turnChatInput = document.getElementById('turn-chat-input');
    const turnChatSendBtn = document.getElementById('turn-chat-send-btn');
    const turnMessages = document.getElementById('turn-messages');
    const gameInfo = document.getElementById('game-info');
    const currentWordDisplay = document.getElementById('current-word');
    const turnIndicator = document.getElementById('turn-indicator');
    const restartGameBtn = document.getElementById('restart-game-btn');
    const voteSection = document.getElementById('vote-section');
    const voteList = document.getElementById('vote-list');
    const wordGuessSection = document.getElementById('word-guess-section');
    const wordGuessInput = document.getElementById('word-guess-input');
    const wordGuessBtn = document.getElementById('word-guess-btn');
    const voteTimer = document.getElementById('vote-timer');
    const wordGuessTimer = document.getElementById('word-guess-timer');
    const gameResultDisplay = document.getElementById('game-result');
    
    // 게임 상태 변수
    let game = new LiarGame();
    let myId = null;
    let isFirstPlayer = false;
    let roomId = null;
    const DEFAULT_ROOM_ID = 'liargame-shared-room';
    
    // 초기 화면 설정
    loginScreen.style.display = 'block';
    lobbyScreen.style.display = 'none';
    gameScreen.style.display = 'none';
    
    // 버튼 초기 비활성화
    startGameBtn.disabled = true;
    
    // 새 방 만들기 버튼
    createRoomBtn.addEventListener('click', async () => {
        const nickname = nicknameInput.value.trim();
        
        if (nickname.length < 1 || nickname.length > 6) {
            alert('닉네임은 1자 이상 6자 이하로 입력해주세요.');
            return;
        }
        
        createRoomBtn.disabled = true;
        joinRoomBtn.disabled = true;
        createRoomBtn.textContent = '방 생성 중...';
        
        try {
            console.log('게임 초기화 시작');
            // 게임 초기화
            myId = await game.init(nickname);
            
            // 로그인 화면 숨기고 로비 화면 표시
            loginScreen.style.display = 'none';
            lobbyScreen.style.display = 'block';
            
            // 이벤트 리스너 설정
            setupGameListeners();
            
            // 방 생성
            roomId = game.createRoom();
            console.log('방 생성 완료, 방 ID:', roomId);
            
            // 방 ID 표시
            document.getElementById('room-id-display').textContent = roomId;
            document.getElementById('room-id-container').style.display = 'block';
            
            // 첫 번째 플레이어는 자동으로 방장
            isFirstPlayer = true;
            startGameBtn.disabled = false;
            gameModeSelect.disabled = false;
            
            // 플레이어 목록 업데이트
            updatePlayersList();
            
            console.log('게임 초기화 및 방 설정 완료');
        } catch (error) {
            createRoomBtn.disabled = false;
            joinRoomBtn.disabled = false;
            createRoomBtn.textContent = '새 방 만들기';
            
            console.error('게임 초기화 실패:', error);
            alert('방 생성에 실패했습니다: ' + error.message);
        }
    });
    
    // 방 참여 버튼
    joinRoomBtn.addEventListener('click', async () => {
        const nickname = nicknameInput.value.trim();
        const inputRoomId = roomIdInput.value.trim();
        
        if (nickname.length < 1 || nickname.length > 6) {
            alert('닉네임은 1자 이상 6자 이하로 입력해주세요.');
            return;
        }
        
        if (!inputRoomId) {
            alert('방 ID를 입력해주세요.');
            return;
        }
        
        createRoomBtn.disabled = true;
        joinRoomBtn.disabled = true;
        joinRoomBtn.textContent = '참여 중...';
        
        try {
            console.log('게임 초기화 시작');
            // 게임 초기화
            myId = await game.init(nickname);
            
            // 로그인 화면 숨기고 로비 화면 표시
            loginScreen.style.display = 'none';
            lobbyScreen.style.display = 'block';
            
            // 이벤트 리스너 설정
            setupGameListeners();
            
            // 기존 방 입장 시도
            try {
                // 입력된 방 ID로 입장 시도
                console.log('방 입장 시도:', inputRoomId);
                await game.joinRoom(inputRoomId);
                console.log('방 입장 성공');
                
                // 방 ID 저장
                roomId = inputRoomId;
                
                // 일반 플레이어는 게임 시작/설정 버튼 비활성화
                isFirstPlayer = false;
                startGameBtn.disabled = true;
                gameModeSelect.disabled = true;
                
                // 플레이어 목록 업데이트
                updatePlayersList();
            } catch (joinError) {
                console.error('방 입장 실패:', joinError.message);
                
                // 오류 메시지 표시
                alert('방 입장에 실패했습니다: ' + joinError.message);
                
                // 로그인 화면으로 돌아가기
                createRoomBtn.disabled = false;
                joinRoomBtn.disabled = false;
                joinRoomBtn.textContent = '방 참여하기';
                loginScreen.style.display = 'block';
                lobbyScreen.style.display = 'none';
                return;
            }
            
            console.log('게임 초기화 및 방 설정 완료');
        } catch (error) {
            createRoomBtn.disabled = false;
            joinRoomBtn.disabled = false;
            joinRoomBtn.textContent = '방 참여하기';
            
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
        if (!game) {
            console.error('게임 인스턴스가 없습니다.');
            return;
        }
        
        const player = game.players.find(p => p.id === myId);
        if (!player) {
            console.error('플레이어 정보를 찾을 수 없습니다.');
            return;
        }
        
        console.log('자유 채팅 메시지 전송 함수 호출:', message);
        
        try {
            const freeChatData = {
                type: 'freeChat',
                playerId: myId,
                nickname: player.nickname,
                message: message
            };
            
            // 모든 플레이어에게 전송
            game.broadcastToAll(freeChatData);
            
            // 자유 채팅 메시지 표시
            showFreeChatMessage(freeChatData.nickname, freeChatData.message);
            
            console.log('자유 채팅 메시지 전송 완료');
        } catch (error) {
            console.error('자유 채팅 메시지 전송 중 오류 발생:', error);
            
            // 오류 발생해도 UI에는 메시지 표시 (적어도 로컬에서는 작동하도록)
            try {
                showFreeChatMessage(player.nickname, message);
            } catch (displayError) {
                console.error('자유 채팅 메시지 표시 중 오류 발생:', displayError);
            }
        }
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
            
            // 시작 팝업 내용 설정
            const popupCategoryWord = document.getElementById('popup-category-word');
            const popupRoleInfo = document.getElementById('popup-role-info');
            
            popupCategoryWord.textContent = `카테고리: ${data.category}`;
            
            if (data.isLiar) {
                popupRoleInfo.textContent = '당신은 라이어입니다!';
                popupRoleInfo.className = 'liar';
            } else if (data.isSpy) {
                popupRoleInfo.textContent = `단어: ${data.word} (스파이)`;
                popupRoleInfo.className = 'spy';
            } else {
                popupRoleInfo.textContent = `단어: ${data.word}`;
                popupRoleInfo.className = '';
            }
            
            // 시작 팝업 표시
            const gameStartPopup = document.getElementById('game-start-popup');
            gameStartPopup.classList.add('active');
            
            // 4초 후 팝업 숨기기
            setTimeout(() => {
                gameStartPopup.classList.remove('active');
            }, 4000);
            
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
            
            // 카운트다운 인터벌이 있다면 정리
            if (window.countdownInterval) {
                clearInterval(window.countdownInterval);
                window.countdownInterval = null;
            }
            
            // 게임 종료 팝업 숨기기
            const gameEndCountdown = document.getElementById('game-end-countdown');
            if (gameEndCountdown) {
                gameEndCountdown.classList.remove('active');
            }
            
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
        
        // 게임 결과에 따른 헤더 설정
        const resultHeader = document.createElement('h3');
        
        if (result.result === 'liarWin') {
            resultHeader.textContent = '라이어 승리!';
            resultHeader.style.color = '#e74c3c';
        } else {
            resultHeader.textContent = '시민들 승리!';
            resultHeader.style.color = '#3498db';
        }
        
        gameResultDisplay.appendChild(resultHeader);
        
        // 라이어 정보
        const liarInfo = document.createElement('p');
        liarInfo.textContent = `라이어: ${result.liarNickname}`;
        liarInfo.classList.add('player-info', 'liar-info');
        gameResultDisplay.appendChild(liarInfo);
        
        // 스파이 정보 (있는 경우)
        if (result.spyId) {
            const spyInfo = document.createElement('p');
            spyInfo.textContent = `스파이: ${result.spyNickname}`;
            spyInfo.classList.add('player-info', 'spy-info');
            gameResultDisplay.appendChild(spyInfo);
        }
        
        // 단어 정보
        const wordInfo = document.createElement('p');
        wordInfo.textContent = `단어: ${result.word}`;
        wordInfo.classList.add('word-info');
        gameResultDisplay.appendChild(wordInfo);
        
        // 라이어가 단어를 맞췄는지 정보 (있는 경우)
        if (result.guessedWord) {
            const guessInfo = document.createElement('p');
            guessInfo.textContent = `라이어의 추측: ${result.guessedWord}`;
            guessInfo.classList.add('guess-info');
            gameResultDisplay.appendChild(guessInfo);
        }
        
        // 점수 테이블
        const scoreTable = document.createElement('table');
        scoreTable.classList.add('score-table');
        
        // 테이블 헤더
        const headerRow = document.createElement('tr');
        
        const headerPlayer = document.createElement('th');
        headerPlayer.textContent = '플레이어';
        
        const headerScore = document.createElement('th');
        headerScore.textContent = '점수';
        
        headerRow.appendChild(headerPlayer);
        headerRow.appendChild(headerScore);
        scoreTable.appendChild(headerRow);
        
        // 플레이어별 점수
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
        
        // 게임 종료 카운트다운 팝업에 정보 설정
        const endResultInfo = document.getElementById('end-result-info');
        
        // 결과 정보 설정
        if (result.result === 'liarWin') {
            endResultInfo.textContent = '라이어 승리!';
            endResultInfo.style.color = '#e74c3c';
        } else {
            endResultInfo.textContent = '시민들 승리!';
            endResultInfo.style.color = '#3498db';
        }
        
        // 카운트다운 팝업 표시 (방장인 경우에만 자동으로 재시작)
        if (game.isHost) {
            // 카운트다운 시작
            const gameEndCountdown = document.getElementById('game-end-countdown');
            const countdownTimer = document.getElementById('countdown-timer');
            const countdownNumber = document.querySelector('.countdown-number');
            
            gameEndCountdown.classList.add('active');
            
            let timeLeft = 10;
            countdownNumber.textContent = timeLeft;
            countdownNumber.setAttribute('data-count', timeLeft);
            countdownTimer.textContent = '초 후 다음 게임이 시작됩니다';
            
            // 메시지를 표시하여 다음 게임이 시작됨을 알립니다
            showSystemMessage(`${timeLeft}초 후 다음 게임이 자동으로 시작됩니다. 잠시만 기다려주세요!`);
            
            // 전역 변수로 인터벌 저장
            if (window.countdownInterval) {
                clearInterval(window.countdownInterval);
            }
            
            // 처음에 크기 애니메이션 실행
            countdownNumber.classList.add('pulse');
            setTimeout(() => {
                countdownNumber.classList.remove('pulse');
            }, 500);
            
            window.countdownInterval = setInterval(() => {
                timeLeft--;
                
                // 숫자 업데이트
                countdownNumber.textContent = timeLeft;
                countdownNumber.setAttribute('data-count', timeLeft);
                
                // 애니메이션 효과 추가
                countdownNumber.classList.add('pulse');
                setTimeout(() => {
                    countdownNumber.classList.remove('pulse');
                }, 500);
                
                if (timeLeft <= 0) {
                    clearInterval(window.countdownInterval);
                    window.countdownInterval = null;
                    gameEndCountdown.classList.remove('active');
                    
                    // 게임 재시작
                    game.restartGame();
                }
            }, 1000);
        } else {
            // 방장이 아닌 경우, 카운트다운 없이 정보만 표시
            const gameEndCountdown = document.getElementById('game-end-countdown');
            const countdownTimer = document.getElementById('countdown-timer');
            const countdownNumber = document.querySelector('.countdown-number');
            
            gameEndCountdown.classList.add('active');
            countdownNumber.style.display = 'none';
            countdownTimer.textContent = '방장이 다음 게임을 시작하길 기다리는 중...';
            
            // 시스템 메시지 표시
            showSystemMessage('방장이 다음 게임을 시작하길 기다리는 중입니다. 자유롭게 채팅해 주세요!');
            
            // 10초 후 팝업 숨기기
            setTimeout(() => {
                gameEndCountdown.classList.remove('active');
            }, 10000);
        }
    }

    // 채팅 버튼 이벤트 리스너 설정
    function setupChatButtonListeners() {
        console.log('채팅 버튼 이벤트 리스너 설정 시작');
        
        // DOM 요소 존재 확인 로깅
        console.log('채팅 요소 존재 확인:',
            'chatSendBtn:', !!chatSendBtn,
            'chatInput:', !!chatInput,
            'turnChatSendBtn:', !!turnChatSendBtn,
            'turnChatInput:', !!turnChatInput,
            'free-chat-send-btn:', !!document.getElementById('free-chat-send-btn'),
            'free-chat-input:', !!document.getElementById('free-chat-input')
        );
        
        // 일반 채팅 이벤트 리스너
        if (chatSendBtn && chatInput) {
            // 채팅 버튼 이벤트 리스너 등록
            chatSendBtn.addEventListener('click', () => {
                if (!game) return;
                
                const message = chatInput.value.trim();
                if (!message) return;
                
                console.log('일반 채팅 메시지 전송:', message);
                sendFreeChat(message);
                chatInput.value = '';
            });
            
            // 입력 필드에서 Enter 키 누를 때 메시지 전송
            chatInput.addEventListener('keypress', event => {
                if (event.key === 'Enter') {
                    event.preventDefault();
                    chatSendBtn.click();
                }
            });
            
            console.log('일반 채팅 이벤트 리스너 등록 완료');
        } else {
            console.error('일반 채팅 DOM 요소를 찾을 수 없습니다.');
        }

        // 턴 채팅 이벤트 리스너
        if (turnChatSendBtn && turnChatInput) {
            turnChatSendBtn.addEventListener('click', () => {
                if (!game) return;
                
                const message = turnChatInput.value.trim();
                if (!message) return;
                
                console.log('턴 채팅 메시지 전송 시도:', message);
                
                if (message.length > 40) {
                    alert('설명은 40자 이내로 입력해주세요.');
                    return;
                }
                
                if (game.gamePhase === 'playing' && 
                    game.turnOrder[game.currentTurn].id === myId) {
                    game.sendMessage(message, true);
                    turnChatInput.value = '';
                    turnChatInput.disabled = true;
                    turnChatSendBtn.disabled = true;
                } else if (game.gamePhase === 'wordGuess' && game.liar === myId) {
                    game.sendMessage(message, false);
                    turnChatInput.value = '';
                    turnChatInput.disabled = true;
                    turnChatSendBtn.disabled = true;
                }
            });
            
            turnChatInput.addEventListener('keypress', event => {
                if (event.key === 'Enter') {
                    event.preventDefault();
                    turnChatSendBtn.click();
                }
            });
            
            console.log('턴 채팅 이벤트 리스너 등록 완료');
        } else {
            console.error('턴 채팅 DOM 요소를 찾을 수 없습니다.');
        }
        
        // 자유 채팅 이벤트 리스너
        const freeChatSendBtn = document.getElementById('free-chat-send-btn');
        const freeChatInput = document.getElementById('free-chat-input');
        
        if (freeChatSendBtn && freeChatInput) {
            // 자유 채팅 버튼 이벤트 리스너 등록
            freeChatSendBtn.addEventListener('click', () => {
                if (!game) return;
                
                const message = freeChatInput.value.trim();
                if (!message) return;
                
                console.log('자유 채팅 메시지 전송:', message);
                sendFreeChat(message);
                freeChatInput.value = '';
            });
            
            freeChatInput.addEventListener('keypress', event => {
                if (event.key === 'Enter') {
                    event.preventDefault();
                    freeChatSendBtn.click();
                }
            });
            
            console.log('자유 채팅 이벤트 리스너 등록 완료');
        } else {
            console.error('자유 채팅 DOM 요소를 찾을 수 없습니다.');
        }
        
        console.log('채팅 버튼 이벤트 리스너 설정 완료');
    }

    // 초기화 시 채팅 이벤트 리스너 설정
    setupChatButtonListeners();
});
