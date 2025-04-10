/**
 * 라이어 게임 - 메인 스크립트
 * DOM 조작 및 게임 로직 연결
 */

document.addEventListener('DOMContentLoaded', () => {
    console.log('게임 스크립트 초기화');
    
    // 로컬 스토리지 초기화 (이전 세션 데이터가 문제를 일으킬 수 있음)
    try {
        localStorage.removeItem('liargame_data');
        localStorage.removeItem('liargame_session');
        console.log('로컬 스토리지 초기화 완료');
    } catch (e) {
        console.warn('로컬 스토리지 초기화 실패:', e);
    }

    // DOM 요소
    const loginScreen = document.getElementById('login-screen');
    const lobbyScreen = document.getElementById('lobby-screen');
    const gameScreen = document.getElementById('game-screen');
    const nicknameInput = document.getElementById('nickname-input');
    const enterGameBtn = document.getElementById('enter-game-btn');
    const startGameBtn = document.getElementById('start-game-btn');
    const gameModeSelect = document.getElementById('game-mode-select');
    const shareBtn = document.getElementById('share-btn');
    const lobbyPlayersList = document.getElementById('lobby-players-list');
    const gamePlayersList = document.getElementById('game-players-list');
    const playerCount = document.getElementById('player-count');
    const spectatorsList = document.getElementById('spectators-list');
    const chatInput = document.getElementById('chat-input');
    const chatSendBtn = document.getElementById('chat-send-btn');
    const turnChatInput = document.getElementById('turn-chat-input');
    const turnChatSendBtn = document.getElementById('turn-chat-send-btn');
    const turnMessages = document.getElementById('turn-messages');
    const freeChatMessages = document.getElementById('free-chat-messages');
    const category = document.getElementById('category');
    const word = document.getElementById('word');
    const role = document.getElementById('role');
    const turnDisplay = document.getElementById('turn-display');
    const restartGameBtn = document.getElementById('restart-game-btn');
    const voteSection = document.getElementById('vote-section');
    const votePlayersListDiv = document.getElementById('vote-players-list');
    const voteTimer = document.getElementById('vote-timer');
    const voteResult = document.getElementById('vote-result');
    const gameResult = document.getElementById('game-result');
    const gameResultContent = document.getElementById('game-result-content');
    const startVoteBtn = document.getElementById('start-vote-btn');
    const helpBtn = document.getElementById('help-btn');
    const helpModal = document.getElementById('help-modal');
    const closeHelp = document.getElementById('close-help');
    
    // 게임 상태 변수
    let game = new LiarGame();
    let myId = null;
    
    // 초기 화면 설정
    loginScreen.style.display = 'block';
    lobbyScreen.style.display = 'none';
    gameScreen.style.display = 'none';
    
    // 버튼 초기 비활성화
    startGameBtn.disabled = true;
    
    // 게임 참가 버튼 클릭
    enterGameBtn.addEventListener('click', async () => {
        const nickname = nicknameInput.value.trim();
        
        if (nickname.length < 1 || nickname.length > 6) {
            alert('닉네임은 1자 이상 6자 이하로 입력해주세요.');
            return;
        }
        
        enterGameBtn.disabled = true;
        enterGameBtn.textContent = '접속 중...';
        
        try {
            console.log('게임 초기화 시작');
            // 게임 초기화
            myId = await game.init(nickname);
            
            // 이벤트 리스너 설정
            setupGameListeners();
            
            // 로그인 화면 숨기고 로비 화면 표시
            loginScreen.style.display = 'none';
            lobbyScreen.style.display = 'block';
            
            // 방장 여부에 따라 시작 버튼 활성화
            startGameBtn.disabled = !game.isHost;
            gameModeSelect.disabled = !game.isHost;
            
            // 플레이어 목록 업데이트
            updateLobbyPlayersList();
            
            console.log('게임 초기화 및 방 설정 완료');
        } catch (error) {
            enterGameBtn.disabled = false;
            enterGameBtn.textContent = '접속하기';
            
            console.error('게임 초기화 실패:', error);
            alert('연결 오류가 발생했습니다. 다시 시도해주세요.');
        }
    });
    
    // 게임 시작 버튼 클릭
    startGameBtn.addEventListener('click', () => {
        if (!game) return;
        if (!game.isHost) {
            alert('방장만 게임을 시작할 수 있습니다.');
            return;
        }
        
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
    
    // 투표 시작 버튼 클릭
    startVoteBtn.addEventListener('click', () => {
        if (!game || !game.isHost) {
            alert('방장만 투표를 시작할 수 있습니다.');
            return;
        }
        
        game.startVoting();
    });
    
    // 링크 공유 버튼 클릭
    shareBtn.addEventListener('click', () => {
        try {
            const gameUrl = window.location.href;
            navigator.clipboard.writeText(gameUrl)
                .then(() => {
                    alert('게임 링크가 클립보드에 복사되었습니다. 친구들에게 공유해보세요!');
                    shareBtn.textContent = '링크 복사됨!';
                    setTimeout(() => {
                        shareBtn.textContent = '친구에게 게임 링크 공유하기';
                    }, 2000);
                })
                .catch(err => {
                    console.error('클립보드 복사 실패:', err);
                    alert('링크 복사에 실패했습니다. 수동으로 URL을 복사해주세요.');
                });
        } catch (error) {
            console.error('링크 공유 오류:', error);
            alert('링크 공유에 실패했습니다. 수동으로 URL을 복사해주세요.');
        }
    });
    
    // 도움말 버튼 클릭
    helpBtn.addEventListener('click', () => {
        helpModal.style.display = 'block';
    });
    
    // 도움말 닫기 버튼 클릭
    closeHelp.addEventListener('click', () => {
        helpModal.style.display = 'none';
    });
    
    // 도움말 모달 바깥 클릭 시 닫기
    window.addEventListener('click', (event) => {
        if (event.target === helpModal) {
            helpModal.style.display = 'none';
        }
    });
    
    // 자유 채팅 메시지 전송
    chatSendBtn.addEventListener('click', () => {
        if (!game) return;
        
        const message = chatInput.value.trim();
        if (!message) return;
        
        game.sendMessage(message, false);
        chatInput.value = '';
    });
    
    // 자유 채팅 Enter 키 이벤트
    chatInput.addEventListener('keypress', (event) => {
        if (event.key === 'Enter') {
            chatSendBtn.click();
        }
    });
    
    // 턴 채팅 메시지 전송
    turnChatSendBtn.addEventListener('click', () => {
        if (!game) return;
        
        const message = turnChatInput.value.trim();
        if (!message) return;
        
        if (message.length > 40) {
            alert('설명은 40자 이내로 입력해주세요.');
            return;
        }
        
        game.sendMessage(message, true);
        turnChatInput.value = '';
    });
    
    // 턴 채팅 Enter 키 이벤트
    turnChatInput.addEventListener('keypress', (event) => {
        if (event.key === 'Enter') {
            turnChatSendBtn.click();
        }
    });
    
    // 게임 이벤트 리스너 설정
    function setupGameListeners() {
        // 초기화 완료 이벤트
        game.on('initialized', data => {
            console.log('게임 초기화 완료:', data);
        });
        
        // 플레이어 입장 이벤트
        game.on('playerJoined', data => {
            console.log('플레이어 입장:', data);
            updateLobbyPlayersList();
            showSystemMessage(`${data.nickname}님이 입장했습니다.`);
        });
        
        // 플레이어 퇴장 이벤트
        game.on('playerLeft', data => {
            console.log('플레이어 퇴장:', data);
            updateLobbyPlayersList();
            showSystemMessage(`${data.nickname}님이 퇴장했습니다.`);
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
            updateLobbyPlayersList();
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
            category.textContent = data.category;
            
            if (data.isLiar) {
                word.textContent = '당신은 라이어입니다!';
                role.textContent = '라이어';
                word.classList.add('liar');
                role.classList.add('liar');
            } else {
                word.textContent = data.word;
                if (data.isSpy) {
                    role.textContent = '스파이';
                    role.classList.add('spy');
                } else {
                    role.textContent = '시민';
                    role.classList.remove('spy');
                }
                word.classList.remove('liar');
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
            updateGamePlayersList(data.turnOrder);
            
            // 채팅창 초기화
            turnMessages.innerHTML = '';
            freeChatMessages.innerHTML = '';
            showSystemMessage('게임이 시작되었습니다.');
            
            // 투표 섹션 초기화
            votePlayersListDiv.innerHTML = '';
            voteSection.style.display = 'block';
            voteResult.style.display = 'none';
            gameResult.style.display = 'none';
            restartGameBtn.style.display = 'none';
        });
        
        // 턴 시작 이벤트
        game.on('turnStart', data => {
            console.log('턴 시작:', data);
            
            turnDisplay.textContent = `${data.turnNumber}번째 차례: ${data.nickname}`;
            
            // 현재 플레이어 하이라이트
            if (gamePlayersList) {
                const playerItems = gamePlayersList.querySelectorAll('.player-item');
                playerItems.forEach(item => {
                    item.classList.remove('current-turn');
                });
                
                const playerItems2 = gamePlayersList.querySelectorAll('.player-item');
                const currentPlayer = Array.from(playerItems2).find(item => item.dataset.playerId === data.playerId);
                if (currentPlayer) {
                    currentPlayer.classList.add('current-turn');
                }
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
            turnMessages.appendChild(messageEl);
            turnMessages.scrollTop = turnMessages.scrollHeight;
        });
        
        // 일반 채팅 이벤트
        game.on('chat', data => {
            console.log('일반 채팅:', data);
            showFreeChatMessage(data.nickname, data.message);
        });
        
        // 투표 시작 이벤트
        game.on('voteStart', data => {
            console.log('투표 시작:', data);
            
            // 투표 섹션 표시
            voteSection.style.display = 'block';
            votePlayersListDiv.innerHTML = '';
            
            // 투표 타이머 설정 (20초)
            let timeLeft = 20;
            voteTimer.style.display = 'block';
            voteTimer.textContent = `투표 시간: ${timeLeft}초`;
            
            const votingTimer = setInterval(() => {
                timeLeft--;
                voteTimer.textContent = `투표 시간: ${timeLeft}초`;
                
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
                    const allVoteBtns = votePlayersListDiv.querySelectorAll('.vote-btn');
                    allVoteBtns.forEach(btn => {
                        btn.disabled = true;
                    });
                    
                    playerItem.classList.add('voted');
                    showSystemMessage(`당신은 ${player.nickname}님에게 투표했습니다.`);
                });
                
                playerItem.appendChild(nickname);
                playerItem.appendChild(voteBtn);
                votePlayersListDiv.appendChild(playerItem);
            });
            
            // 투표 시작 버튼 숨기기
            startVoteBtn.style.display = 'none';
            
            showSystemMessage('투표가 시작되었습니다. 라이어라고 생각되는 사람에게 투표하세요.');
            turnChatInput.disabled = true;
            turnChatSendBtn.disabled = true;
        });
        
        // 투표 결과 이벤트
        game.on('voteResult', data => {
            console.log('투표 결과:', data);
            
            // 투표 섹션 숨기기
            voteSection.style.display = 'none';
            
            // 결과 컨테이너 표시
            voteResult.style.display = 'block';
            const voteResultContent = document.getElementById('vote-result-content');
            voteResultContent.innerHTML = '';
            
            // 투표 결과 표시
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
            
            voteResultContent.appendChild(voteTable);
            
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
            voteResultContent.appendChild(voteSummary);
            
            // 최종 게임 결과 표시 (라이어가 지목된 경우)
            if (data.gameResult) {
                displayGameResult(data.gameResult, data.playerScores);
            }
        });
        
        // 라이어 추측 시작 이벤트
        game.on('wordGuessStart', data => {
            console.log('단어 추측 시작:', data);
            
            // 현재 턴 정보 업데이트
            turnDisplay.textContent = `라이어 (${data.liarNickname})의 단어 추측 시간`;
            
            // 현재 플레이어 하이라이트
            if (gamePlayersList) {
                const playerItems = gamePlayersList.querySelectorAll('.player-item');
                playerItems.forEach(item => {
                    item.classList.remove('current-turn');
                    item.classList.remove('liar-guess');
                });
                
                const playerItems2 = gamePlayersList.querySelectorAll('.player-item');
                const liarPlayer = Array.from(playerItems2).find(item => item.dataset.playerId === data.liarId);
                if (liarPlayer) {
                    liarPlayer.classList.add('liar-guess');
                }
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
            updateLobbyPlayersList();
            
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
    
    // 로비 플레이어 목록 업데이트
    function updateLobbyPlayersList() {
        if (!lobbyPlayersList) return;
        
        lobbyPlayersList.innerHTML = '';
        
        if (game.players.length === 0) {
            const emptyItem = document.createElement('div');
            emptyItem.className = 'player-item';
            emptyItem.textContent = '아직 참가자가 없습니다';
            lobbyPlayersList.appendChild(emptyItem);
            if (playerCount) playerCount.textContent = '0';
            return;
        }
        
        game.players.forEach(player => {
            const playerItem = document.createElement('div');
            playerItem.className = 'player-item';
            playerItem.dataset.playerId = player.id;
            
            const playerName = document.createElement('span');
            playerName.className = 'player-name';
            playerName.textContent = player.nickname;
            
            if (player.id === myId) {
                playerName.textContent += ' (나)';
            }
            
            playerItem.appendChild(playerName);
            
            if (player.isHost) {
                const hostBadge = document.createElement('span');
                hostBadge.className = 'host-badge';
                hostBadge.textContent = '방장';
                playerItem.appendChild(hostBadge);
            }
            
            lobbyPlayersList.appendChild(playerItem);
        });
        
        if (playerCount) playerCount.textContent = game.players.length.toString();
    }
    
    // 게임 플레이어 목록 업데이트
    function updateGamePlayersList(turnOrder) {
        if (!gamePlayersList) return;
        
        gamePlayersList.innerHTML = '';
        
        if (!turnOrder || turnOrder.length === 0) {
            const emptyItem = document.createElement('div');
            emptyItem.textContent = '플레이어 정보를 불러올 수 없습니다.';
            emptyItem.style.padding = '10px';
            gamePlayersList.appendChild(emptyItem);
            return;
        }
        
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
            if (index === game.currentTurn) {
                playerItem.classList.add('current-turn');
            }
            
            playerItem.appendChild(orderNumber);
            playerItem.appendChild(nickname);
            
            gamePlayersList.appendChild(playerItem);
        });
    }
    
    // 관전자 목록 업데이트
    function updateSpectatorList() {
        if (!spectatorsList) return;
        
        spectatorsList.innerHTML = '';
        
        if (game.spectators.length === 0) {
            const emptyItem = document.createElement('li');
            emptyItem.textContent = '관전자가 없습니다';
            spectatorsList.appendChild(emptyItem);
            return;
        }
        
        game.spectators.forEach(spectator => {
            const spectatorItem = document.createElement('li');
            spectatorItem.textContent = spectator.nickname;
            
            if (spectator.id === myId) {
                spectatorItem.textContent += ' (나)';
            }
            
            spectatorsList.appendChild(spectatorItem);
        });
    }
    
    // 시스템 메시지 표시 (턴 채팅창)
    function showSystemMessage(message) {
        const messageEl = document.createElement('div');
        messageEl.classList.add('system-message');
        messageEl.textContent = message;
        
        turnMessages.appendChild(messageEl);
        turnMessages.scrollTop = turnMessages.scrollHeight;
    }
    
    // 자유 채팅 메시지 표시
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
        if (!gameResultContent) return;
        
        gameResultContent.innerHTML = '';
        gameResult.style.display = 'block';
        
        // 게임 결과에 따른 헤더 설정
        const resultHeader = document.createElement('h3');
        
        if (result.result === 'liarWin') {
            resultHeader.textContent = '라이어 승리!';
            resultHeader.style.color = '#e74c3c';
        } else {
            resultHeader.textContent = '시민들 승리!';
            resultHeader.style.color = '#3498db';
        }
        
        gameResultContent.appendChild(resultHeader);
        
        // 라이어 정보
        const liarInfo = document.createElement('p');
        liarInfo.textContent = `라이어: ${result.liarNickname}`;
        liarInfo.classList.add('player-info', 'liar-info');
        gameResultContent.appendChild(liarInfo);
        
        // 스파이 정보 (있는 경우)
        if (result.spyId) {
            const spyInfo = document.createElement('p');
            spyInfo.textContent = `스파이: ${result.spyNickname}`;
            spyInfo.classList.add('player-info', 'spy-info');
            gameResultContent.appendChild(spyInfo);
        }
        
        // 단어 정보
        const wordInfo = document.createElement('p');
        wordInfo.textContent = `단어: ${result.word}`;
        wordInfo.classList.add('word-info');
        gameResultContent.appendChild(wordInfo);
        
        // 라이어가 단어를 맞췄는지 정보 (있는 경우)
        if (result.guessedWord) {
            const guessInfo = document.createElement('p');
            guessInfo.textContent = `라이어의 추측: ${result.guessedWord}`;
            guessInfo.classList.add('guess-info');
            gameResultContent.appendChild(guessInfo);
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
        if (playerScores && playerScores.length > 0) {
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
        }
        
        gameResultContent.appendChild(scoreTable);
        
        // 재시작 버튼 표시 (방장인 경우)
        if (game.isHost) {
            restartGameBtn.style.display = 'block';
        } else {
            showSystemMessage('방장이 다음 게임을 시작하길 기다리고 있습니다...');
        }
        
        // 게임 종료 카운트다운 팝업 표시 (방장인 경우에만)
        if (game.isHost) {
            displayCountdown(result);
        }
    }
    
    // 카운트다운 표시
    function displayCountdown(result) {
        // 게임 종료 카운트다운 팝업 요소
        const gameEndCountdown = document.getElementById('game-end-countdown');
        const endResultInfo = document.getElementById('end-result-info');
        const countdownNumber = document.getElementById('countdown-number');
        const countdownProgress = document.getElementById('countdown-progress');
        const countdownTimer = document.getElementById('countdown-timer');
        
        // 결과 정보 설정
        if (result.result === 'liarWin') {
            endResultInfo.textContent = '라이어 승리!';
            endResultInfo.style.color = '#e74c3c';
        } else {
            endResultInfo.textContent = '시민들 승리!';
            endResultInfo.style.color = '#3498db';
        }
        
        // 카운트다운 요소 초기화
        gameEndCountdown.classList.add('active');
        countdownNumber.style.display = 'block';
        
        let timeLeft = 10;
        countdownNumber.textContent = timeLeft;
        countdownNumber.setAttribute('data-count', timeLeft);
        countdownTimer.textContent = '초 후 다음 게임이 시작됩니다';
        
        // 프로그레스 바 초기화
        if (countdownProgress) {
            countdownProgress.style.width = '100%';
            countdownProgress.style.transition = `width ${timeLeft}s linear`;
            
            // 강제 리플로우를 통해 transition이 제대로 적용되도록 함
            void countdownProgress.offsetWidth;
            
            // 애니메이션 시작
            setTimeout(() => {
                countdownProgress.style.width = '0%';
            }, 50);
        }
        
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
                setTimeout(() => {
                    game.restartGame();
                }, 300);
            }
        }, 1000);
    }
    
    // Nickname input에서 Enter 키 처리
    nicknameInput.addEventListener('keypress', (event) => {
        if (event.key === 'Enter') {
            enterGameBtn.click();
        }
    });
});
