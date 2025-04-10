/**
 * 라이어 게임 로직
 * Firebase Realtime Database를 사용하여 실시간 통신을 구현합니다.
 */

class LiarGame {
    constructor() {
        this.myId = null;
        this.nickname = null;
        this.isHost = false;
        this.players = [];
        this.gameStarted = false;
        this.gameMode = 'basic'; // 'basic' 또는 'spy'
        this.currentCategory = null;
        this.currentWord = null;
        this.liar = null;
        this.spy = null;
        this.turnOrder = [];
        this.currentTurn = 0;
        this.votes = {};
        this.scores = {};
        this.spectators = [];
        this.gamePhase = 'lobby'; // 'lobby', 'playing', 'discussion', 'voting', 'result', 'wordGuess'
        this.voteTimer = null;
        this.guessTimer = null;
        this.eventListeners = {};
        this.gameRef = null;
        this.playersRef = null;
        this.messagesRef = null;
        this.connectionRef = null;
    }

    // 이벤트 리스너 등록
    on(event, callback) {
        if (!this.eventListeners[event]) {
            this.eventListeners[event] = [];
        }
        this.eventListeners[event].push(callback);
    }

    // 이벤트 발생
    emit(event, data) {
        if (this.eventListeners[event]) {
            this.eventListeners[event].forEach(callback => callback(data));
        }
    }

    // 게임 초기화 및 Firebase 연결
    async init(nickname) {
        if (nickname.length < 1 || nickname.length > 6) {
            throw new Error('닉네임은 1자 이상 6자 이하로 입력해주세요.');
        }

        try {
            this.nickname = nickname;
            this.myId = 'player_' + Date.now() + '_' + Math.floor(Math.random() * 1000);
            
            // Firebase 참조 설정
            this.gameRef = database.ref('liargame');
            this.playersRef = this.gameRef.child('players');
            this.messagesRef = this.gameRef.child('messages');
            
            // 플레이어 정보 저장
            const playerData = {
                id: this.myId,
                nickname: nickname,
                isHost: false,
                isLiar: false,
                isSpy: false,
                score: 0,
                lastActive: firebase.database.ServerValue.TIMESTAMP
            };
            
            await this.playersRef.child(this.myId).set(playerData);
            
            // 첫 번째 플레이어 확인 (방장 설정)
            const playersSnapshot = await this.playersRef.once('value');
            if (playersSnapshot.numChildren() === 1) {
                this.isHost = true;
                await this.playersRef.child(this.myId).update({ isHost: true });
            }
            
            // 플레이어 목록 이벤트 리스너 설정
            this.playersRef.on('child_added', this.handlePlayerAdded.bind(this));
            this.playersRef.on('child_removed', this.handlePlayerRemoved.bind(this));
            this.playersRef.on('child_changed', this.handlePlayerChanged.bind(this));
            
            // 메시지 이벤트 리스너 설정
            this.messagesRef.on('child_added', this.handleMessageAdded.bind(this));
            
            // 게임 상태 이벤트 리스너 설정
            this.gameRef.child('gameState').on('value', this.handleGameStateChanged.bind(this));
            
            // 연결 상태 모니터링
            this.connectionRef = database.ref('.info/connected');
            this.connectionRef.on('value', (snap) => {
                if (snap.val() === true) {
                    // 연결되었을 때
                    const playerRef = this.playersRef.child(this.myId);
                    
                    // 연결 해제 시 자동 삭제
                    playerRef.onDisconnect().remove();
                    
                    // 마지막 활동 시간 업데이트
                    playerRef.update({
                        lastActive: firebase.database.ServerValue.TIMESTAMP
                    });
                }
            });
            
            // 비활성 플레이어 정리 (5분 이상 비활성 상태인 플레이어 제거)
            setInterval(() => {
                const now = Date.now();
                this.playersRef.once('value', (snapshot) => {
                    snapshot.forEach((playerSnap) => {
                        const player = playerSnap.val();
                        if (player && player.lastActive && now - player.lastActive > 5 * 60 * 1000) {
                            this.playersRef.child(player.id).remove();
                        }
                    });
                });
            }, 60 * 1000); // 1분마다 체크
            
            // 초기화 완료 이벤트 발생
            this.emit('initialized', { id: this.myId, isHost: this.isHost });
            return this.myId;
            
        } catch (error) {
            console.error('게임 초기화 실패:', error);
            throw error;
        }
    }
    
    // 플레이어 추가 이벤트 처리
    handlePlayerAdded(snapshot) {
        const playerData = snapshot.val();
        
        // 이미 게임이 시작됐는지 확인
        if (this.gameStarted && playerData.id !== this.myId) {
            // 게임이 시작된 후 들어온 플레이어는 관전자로 처리
            this.spectators.push(playerData);
            this.emit('spectatorJoined', { nickname: playerData.nickname });
            return;
        }
        
        // 지역 플레이어 목록에 추가
        const existingPlayerIndex = this.players.findIndex(p => p.id === playerData.id);
        if (existingPlayerIndex === -1) {
            this.players.push(playerData);
        } else {
            this.players[existingPlayerIndex] = playerData;
        }
        
        // 이벤트 발생 (자신 제외)
        if (playerData.id !== this.myId) {
            this.emit('playerJoined', { 
                id: playerData.id,
                nickname: playerData.nickname
            });
        }
    }
    
    // 플레이어 제거 이벤트 처리
    handlePlayerRemoved(snapshot) {
        const playerData = snapshot.val();
        
        // 관전자 목록에서 확인
        const spectatorIndex = this.spectators.findIndex(s => s.id === playerData.id);
        if (spectatorIndex > -1) {
            const spectator = this.spectators[spectatorIndex];
            this.spectators.splice(spectatorIndex, 1);
            this.emit('spectatorLeft', { nickname: spectator.nickname });
            return;
        }
        
        // 플레이어 목록에서 제거
        const playerIndex = this.players.findIndex(p => p.id === playerData.id);
        if (playerIndex > -1) {
            const player = this.players[playerIndex];
            this.players.splice(playerIndex, 1);
            
            this.emit('playerLeft', { 
                id: player.id,
                nickname: player.nickname
            });
            
            // 호스트가 나간 경우 새 호스트 지정
            if (player.isHost && this.players.length > 0) {
                const newHost = this.players[0];
                if (newHost.id === this.myId) {
                    this.isHost = true;
                    this.playersRef.child(this.myId).update({ isHost: true });
                }
                
                this.emit('newHost', {
                    id: newHost.id,
                    nickname: newHost.nickname
                });
            }
            
            // 게임 진행 중이었다면 게임 종료 확인
            if (this.gameStarted && this.players.length < 1) {
                this.endGame('인원 부족으로 게임이 종료되었습니다.');
            }
        }
    }
    
    // 플레이어 변경 이벤트 처리
    handlePlayerChanged(snapshot) {
        const playerData = snapshot.val();
        const playerIndex = this.players.findIndex(p => p.id === playerData.id);
        
        if (playerIndex > -1) {
            const oldPlayer = this.players[playerIndex];
            this.players[playerIndex] = playerData;
            
            // 방장 변경 확인
            if (!oldPlayer.isHost && playerData.isHost) {
                this.emit('newHost', {
                    id: playerData.id,
                    nickname: playerData.nickname
                });
                
                // 자신이 방장이 된 경우
                if (playerData.id === this.myId) {
                    this.isHost = true;
                }
            }
        }
    }
    
    // 게임 상태 변경 이벤트 처리
    handleGameStateChanged(snapshot) {
        const gameState = snapshot.val();
        if (!gameState) return;
        
        // 게임 모드 변경
        if (gameState.gameMode !== this.gameMode) {
            this.gameMode = gameState.gameMode;
            this.emit('gameModeChanged', { mode: this.gameMode });
        }
        
        // 게임 시작
        if (gameState.gameStarted && !this.gameStarted) {
            this.gameStarted = true;
            this.gamePhase = gameState.gamePhase;
            this.currentCategory = gameState.category;
            this.currentWord = gameState.word;
            this.liar = gameState.liar;
            this.spy = gameState.spy;
            this.turnOrder = gameState.turnOrder || [];
            this.currentTurn = gameState.currentTurn || 0;
            
            // 자신의 역할 확인
            const isLiar = this.liar === this.myId;
            const isSpy = this.spy === this.myId;
            
            // 게임 시작 이벤트 발생
            this.emit('gameStarted', {
                category: this.currentCategory,
                word: isLiar ? null : this.currentWord,
                isLiar: isLiar,
                isSpy: isSpy,
                turnOrder: this.turnOrder.map(playerId => {
                    const player = this.players.find(p => p.id === playerId);
                    return {
                        id: playerId,
                        nickname: player ? player.nickname : 'Unknown'
                    };
                })
            });
            
            // 현재 턴 정보 이벤트 발생
            if (this.turnOrder.length > 0 && this.currentTurn < this.turnOrder.length) {
                const currentPlayerId = this.turnOrder[this.currentTurn];
                const currentPlayer = this.players.find(p => p.id === currentPlayerId);
                
                this.emit('turnStart', {
                    playerId: currentPlayerId,
                    nickname: currentPlayer ? currentPlayer.nickname : 'Unknown',
                    turnNumber: this.currentTurn + 1
                });
            }
        }
        
        // 턴 변경
        if (this.gameStarted && gameState.currentTurn !== this.currentTurn) {
            this.currentTurn = gameState.currentTurn;
            
            if (this.gamePhase === 'playing' && this.currentTurn < this.turnOrder.length) {
                const currentPlayerId = this.turnOrder[this.currentTurn];
                const currentPlayer = this.players.find(p => p.id === currentPlayerId);
                
                this.emit('turnStart', {
                    playerId: currentPlayerId,
                    nickname: currentPlayer ? currentPlayer.nickname : 'Unknown',
                    turnNumber: this.currentTurn + 1
                });
            }
        }
        
        // 게임 단계 변경
        if (this.gameStarted && gameState.gamePhase !== this.gamePhase) {
            this.gamePhase = gameState.gamePhase;
            
            // 투표 시작
            if (this.gamePhase === 'voting') {
                this.emit('voteStart', {
                    players: this.players.map(p => ({
                        id: p.id,
                        nickname: p.nickname
                    }))
                });
            }
            
            // 라이어 추측 시작
            if (this.gamePhase === 'wordGuess') {
                const liarPlayer = this.players.find(p => p.id === this.liar);
                
                this.emit('wordGuessStart', {
                    liarId: this.liar,
                    liarNickname: liarPlayer ? liarPlayer.nickname : 'Unknown'
                });
            }
            
            // 게임 결과 (결과 단계)
            if (this.gamePhase === 'result' && gameState.gameResult) {
                if (gameState.voteResult) {
                    this.votes = gameState.votes || {};
                    
                    this.emit('voteResult', {
                        votes: this.votes,
                        voteCount: gameState.voteCount || {},
                        gameResult: gameState.gameResult,
                        playerScores: gameState.playerScores || []
                    });
                } else {
                    this.emit('gameResult', {
                        gameResult: gameState.gameResult,
                        playerScores: gameState.playerScores || []
                    });
                }
            }
        }
        
        // 게임 재시작
        if (this.gameStarted && !gameState.gameStarted) {
            this.gameStarted = false;
            this.gamePhase = 'lobby';
            
            // 플레이어 상태 초기화
            for (const player of this.players) {
                player.isLiar = false;
                player.isSpy = false;
            }
            
            // 관전자들을 플레이어로 변경
            for (const spectator of this.spectators) {
                this.players.push({
                    id: spectator.id,
                    nickname: spectator.nickname,
                    isHost: false,
                    isLiar: false,
                    isSpy: false,
                    score: 0
                });
            }
            this.spectators = [];
            
            this.emit('gameRestarted', {
                players: this.players.map(p => ({
                    id: p.id,
                    nickname: p.nickname,
                    isHost: p.isHost,
                    score: p.score
                }))
            });
        }
    }
    
    // 메시지 추가 이벤트 처리
    handleMessageAdded(snapshot) {
        const message = snapshot.val();
        
        switch (message.type) {
            case 'turnChat':
                this.emit('turnChat', {
                    playerId: message.playerId,
                    nickname: message.nickname,
                    message: message.content
                });
                break;
                
            case 'freeChat':
                this.emit('chat', {
                    playerId: message.playerId,
                    nickname: message.nickname,
                    message: message.content
                });
                break;
        }
    }

    // 게임 모드 설정
    setGameMode(mode) {
        if (!this.isHost) return;
        if (mode !== 'basic' && mode !== 'spy') return;
        
        this.gameMode = mode;
        this.gameRef.child('gameState').update({
            gameMode: mode
        });
    }

    // 게임 시작
    startGame() {
        if (!this.isHost) return;
        if (this.players.length < 1) {
            this.emit('error', { message: '게임을 시작하려면 최소 1명 이상이 필요합니다.' });
            return;
        }
        
        // 카테고리와 단어 선택
        const category = gameData.getRandomCategory();
        this.currentCategory = category.name;
        this.currentWord = gameData.getRandomWord(category.name);
        
        // 라이어, 스파이 선정
        const playerCount = this.players.length;
        
        // 라이어 선정
        const liarIndex = Math.floor(Math.random() * playerCount);
        this.liar = this.players[liarIndex].id;
        
        // 스파이 모드인 경우 스파이 선정 (라이어와 다른 사람)
        this.spy = null; // 기본값으로 null 설정
        if (this.gameMode === 'spy' && playerCount >= 2) {
            let spyIndex;
            do {
                spyIndex = Math.floor(Math.random() * playerCount);
            } while (spyIndex === liarIndex);
            
            this.spy = this.players[spyIndex].id;
        }
        
        // 발언 순서 랜덤 설정
        this.turnOrder = this.players.map(p => p.id);
        for (let i = this.turnOrder.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [this.turnOrder[i], this.turnOrder[j]] = [this.turnOrder[j], this.turnOrder[i]];
        }
        
        this.currentTurn = 0;
        
        // 게임 상태 저장
        this.gameRef.child('gameState').set({
            gameStarted: true,
            gamePhase: 'playing',
            gameMode: this.gameMode,
            category: this.currentCategory,
            word: this.currentWord,
            liar: this.liar,
            spy: this.spy,
            turnOrder: this.turnOrder,
            currentTurn: this.currentTurn,
            startTime: firebase.database.ServerValue.TIMESTAMP
        });
    }

    // 턴 종료 및 다음 턴 설정
    nextTurn() {
        if (!this.isHost) return;
        
        this.currentTurn++;
        
        // 모든 플레이어가 발언했으면 투표 단계로
        if (this.currentTurn >= this.turnOrder.length) {
            // 1인 플레이 시에는 자동으로 라이어 승리
            if (this.players.length === 1) {
                this.handleSoloGameEnd();
                return;
            }
            
            this.startVoting();
            return;
        }
        
        // 현재 턴 업데이트
        this.gameRef.child('gameState').update({
            currentTurn: this.currentTurn
        });
    }

    // 1인 플레이 게임 종료 처리
    handleSoloGameEnd() {
        if (!this.isHost) return;
        
        // 자동으로 라이어 승리
        const gameResult = {
            result: 'liarWin',
            liarId: this.liar,
            liarNickname: this.players.find(p => p.id === this.liar).nickname,
            word: this.currentWord,
            isSoloGame: true
        };
        
        // 점수 계산
        const playerScores = this.updateScores(gameResult.result);
        
        // 게임 결과 저장
        this.gameRef.child('gameState').update({
            gamePhase: 'result',
            gameResult: gameResult,
            playerScores: playerScores
        });
    }

    // 투표 시작
    startVoting() {
        if (!this.isHost) return;
        
        this.resetVotes();
        
        // 게임 상태 업데이트
        this.gameRef.child('gameState').update({
            gamePhase: 'voting',
            votes: {}
        });
        
        // 20초 타이머 설정
        this.voteTimer = setTimeout(() => {
            this.endVoting();
        }, 20000);
    }

    // 투표 처리
    submitVote(targetId) {
        if (this.gamePhase !== 'voting') return;
        
        // 투표 저장
        this.gameRef.child('gameState/votes').child(this.myId).set(targetId);
    }

    // 투표 종료 및 결과 처리
    endVoting() {
        if (!this.isHost) return;
        
        // 투표 타이머 중지
        clearTimeout(this.voteTimer);
        
        // 투표 데이터 가져오기
        this.gameRef.child('gameState/votes').once('value', (snapshot) => {
            const votes = snapshot.val() || {};
            
            // 투표 집계
            const voteCount = {};
            
            for (const playerId in votes) {
                const targetId = votes[playerId];
                if (!targetId) continue; // 기권표는 건너뜀
                
                if (!voteCount[targetId]) {
                    voteCount[targetId] = 0;
                }
                voteCount[targetId]++;
            }
            
            // 최다 득표자 찾기
            let maxVotes = 0;
            let maxVotePlayer = null;
            
            for (const targetId in voteCount) {
                if (voteCount[targetId] > maxVotes) {
                    maxVotes = voteCount[targetId];
                    maxVotePlayer = targetId;
                }
            }
            
            // 과반수 확인
            const majorityThreshold = Math.floor(this.players.length / 2) + 1;
            let gameResult;
            
            if (maxVotes >= majorityThreshold) {
                // 라이어가 지목된 경우
                if (maxVotePlayer === this.liar) {
                    // 게임 상태 업데이트 (라이어 추측 단계)
                    this.gameRef.child('gameState').update({
                        gamePhase: 'wordGuess',
                        votes: votes,
                        voteCount: voteCount
                    });
                    
                    // 라이어 추측 타이머 설정
                    this.guessTimer = setTimeout(() => {
                        this.handleGuess('');
                    }, 20000);
                    
                    return;
                } else {
                    // 라이어가 아닌 사람이 지목된 경우
                    gameResult = {
                        result: 'liarWin',
                        liarId: this.liar,
                        liarNickname: this.players.find(p => p.id === this.liar).nickname,
                        word: this.currentWord
                    };
                    
                    // 스파이 모드인 경우 스파이 정보도 포함
                    if (this.gameMode === 'spy' && this.spy) {
                        gameResult.spyId = this.spy;
                        gameResult.spyNickname = this.players.find(p => p.id === this.spy).nickname;
                    }
                }
            } else {
                // 과반수 득표자 없음, 라이어 승리
                gameResult = {
                    result: 'liarWin',
                    liarId: this.liar,
                    liarNickname: this.players.find(p => p.id === this.liar).nickname,
                    word: this.currentWord
                };
                
                // 스파이 모드인 경우 스파이 정보도 포함
                if (this.gameMode === 'spy' && this.spy) {
                    gameResult.spyId = this.spy;
                    gameResult.spyNickname = this.players.find(p => p.id === this.spy).nickname;
                }
            }
            
            // 점수 계산
            const playerScores = this.updateScores(gameResult.result);
            
            // 게임 결과 저장
            this.gameRef.child('gameState').update({
                gamePhase: 'result',
                votes: votes,
                voteCount: voteCount,
                voteResult: true,
                gameResult: gameResult,
                playerScores: playerScores
            });
        });
    }

    // 라이어의 단어 추측 처리
    handleGuess(word) {
        if (!this.isHost && this.myId !== this.liar) return;
        
        // 내가 라이어인 경우, 추측 내용을 호스트에게 전송
        if (!this.isHost && this.myId === this.liar) {
            this.messagesRef.push({
                type: 'guess',
                playerId: this.myId,
                nickname: this.nickname,
                content: word,
                timestamp: firebase.database.ServerValue.TIMESTAMP
            });
            return;
        }
        
        // 호스트인 경우 라이어 추측 결과 처리
        if (this.isHost) {
            clearTimeout(this.guessTimer);
            
            // 추측 결과 확인
            const isCorrect = word.toLowerCase() === this.currentWord.toLowerCase();
            let gameResult;
            
            if (isCorrect) {
                gameResult = {
                    result: 'liarWin',
                    liarId: this.liar,
                    liarNickname: this.players.find(p => p.id === this.liar).nickname,
                    word: this.currentWord,
                    guessedWord: word,
                    isCorrect: true
                };
            } else {
                gameResult = {
                    result: 'playersWin',
                    liarId: this.liar,
                    liarNickname: this.players.find(p => p.id === this.liar).nickname,
                    word: this.currentWord,
                    guessedWord: word,
                    isCorrect: false
                };
            }
            
            // 스파이 모드인 경우 스파이 정보도 포함
            if (this.gameMode === 'spy' && this.spy) {
                gameResult.spyId = this.spy;
                gameResult.spyNickname = this.players.find(p => p.id === this.spy).nickname;
            }
            
            // 점수 계산
            const playerScores = this.updateScores(gameResult.result);
            
            // 게임 결과 저장
            this.gameRef.child('gameState').update({
                gamePhase: 'result',
                gameResult: gameResult,
                playerScores: playerScores
            });
        }
    }

    // 메시지 전송 (채팅 및 명령 전송)
    sendMessage(message, isTurnChat = false) {
        // 메시지 길이 제한
        if (message.length > 40) {
            message = message.substring(0, 40);
        }
        
        // 메시지 타입 결정
        let messageType = isTurnChat ? 'turnChat' : 'freeChat';
        
        // 라이어 추측 단계에서는 메시지 타입 변경
        if (this.gamePhase === 'wordGuess' && this.liar === this.myId) {
            this.handleGuess(message);
            return;
        }
        
        // 메시지 저장
        this.messagesRef.push({
            type: messageType,
            playerId: this.myId,
            nickname: this.nickname,
            content: message,
            timestamp: firebase.database.ServerValue.TIMESTAMP
        });
        
        // 턴 채팅인 경우 자동으로 다음 턴으로 진행 (호스트만)
        if (isTurnChat && this.gamePhase === 'playing' && this.isHost) {
            setTimeout(() => this.nextTurn(), 1000);
        }
    }

    // 투표 초기화
    resetVotes() {
        this.votes = {};
    }

    // 점수 업데이트
    updateScores(result) {
        const playerScores = [];
        
        for (const player of this.players) {
            let newScore = player.score || 0;
            
            if (result === 'liarWin') {
                // 라이어 승리: 라이어 +3점, 스파이 +1점
                if (player.id === this.liar) {
                    newScore += 3;
                } else if (player.id === this.spy) {
                    newScore += 1;
                }
            } else if (result === 'playersWin') {
                // 플레이어 승리: 라이어와 스파이 외 모두 +1점
                if (player.id !== this.liar && player.id !== this.spy) {
                    newScore += 1;
                }
            }
            
            // 로컬 점수 업데이트
            player.score = newScore;
            
            // Firebase 점수 업데이트
            this.playersRef.child(player.id).update({ score: newScore });
            
            // 점수 정보 배열에 추가
            playerScores.push({
                id: player.id,
                nickname: player.nickname,
                score: newScore
            });
        }
        
        return playerScores;
    }

    // 게임 다시 시작
    restartGame() {
        if (!this.isHost) return;
        
        // 게임 상태 초기화
        this.gameRef.child('gameState').set({
            gameStarted: false,
            gamePhase: 'lobby',
            gameMode: this.gameMode
        });
        
        // 플레이어 상태 초기화
        for (const playerId of Object.keys(this.players)) {
            this.playersRef.child(playerId).update({
                isLiar: false,
                isSpy: false
            });
        }
    }

    // 게임 강제 종료
    endGame(reason) {
        if (!this.isHost) return;
        
        // 타이머 초기화
        if (this.voteTimer) {
            clearTimeout(this.voteTimer);
        }
        if (this.guessTimer) {
            clearTimeout(this.guessTimer);
        }
        
        // 게임 상태 초기화
        this.gameRef.child('gameState').set({
            gameStarted: false,
            gamePhase: 'lobby',
            gameMode: this.gameMode,
            endReason: reason
        });
        
        this.emit('gameEnded', { reason });
    }
}
