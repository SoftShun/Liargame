/**
 * 라이어 게임 로직
 * PeerJS를 사용하여 P2P 연결을 구현합니다.
 */

class LiarGame {
    constructor() {
        this.peer = null;
        this.connections = [];
        this.players = [];
        this.myId = null;
        this.isHost = false;
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

    // 고정 ID로 PeerJS 초기화 (방장용)
    async initWithFixedId() {
        const FIXED_ROOM_ID = "liargame-fixed-room";
        
        return new Promise((resolve, reject) => {
            // 고정 ID로 피어 생성 시도
            this.peer = new Peer(FIXED_ROOM_ID, {
                debug: 3,
                config: {
                    'iceServers': [
                        { urls: 'stun:stun.l.google.com:19302' },
                        { urls: 'stun:stun1.l.google.com:19302' },
                        { urls: 'stun:stun2.l.google.com:19302' },
                        { urls: 'stun:stun3.l.google.com:19302' },
                        { urls: 'stun:stun4.l.google.com:19302' }
                    ]
                },
                reconnectTimer: 3000,
                pingInterval: 5000
            });
            
            // 타임아웃 설정
            const timeout = setTimeout(() => {
                this.peer.destroy();
                reject(new Error('고정 ID 접속 시간 초과'));
            }, 5000);
            
            // ID 할당 성공 (방장이 됨)
            this.peer.on('open', id => {
                clearTimeout(timeout);
                console.log('방장 ID 할당됨:', id);
                this.myId = id;
                this.isHost = true; // 방장으로 설정
                resolve();
            });
            
            // ID 타입 이미 사용중 오류 - 이미 다른 사람이 방장이라는 의미
            this.peer.on('error', err => {
                clearTimeout(timeout);
                // ID 중복 오류는 파트너 초대를 의미
                if (err.type === 'unavailable-id') {
                    console.log('고정 ID가 이미 사용중, 일반 플레이어로 접속');
                }
                this.peer.destroy();
                reject(err);
            });
        });
    }

    // 게임 초기화 및 피어 연결
    async init(nickname) {
        if (nickname.length < 1 || nickname.length > 6) {
            throw new Error('닉네임은 1자 이상 6자 이하로 입력해주세요.');
        }

        try {
            console.log("PeerJS 인스턴스 생성 시작");
            // PeerJS 인스턴스 생성 - GitHub Pages 호환 설정
            this.peer = new Peer(null, {
                debug: 3, // 최대 디버그 레벨
                secure: true,
                host: 'peerjs.min.js.org', // 안정적인 공용 서버
                port: 443,
                path: '/',
                config: {
                    'iceServers': [
                        { urls: 'stun:stun.l.google.com:19302' },
                        { urls: 'stun:stun1.l.google.com:19302' },
                        { urls: 'stun:stun2.l.google.com:19302' },
                        { urls: 'stun:stun3.l.google.com:19302' },
                        { urls: 'stun:stun4.l.google.com:19302' },
                        { urls: 'stun:global.stun.twilio.com:3478?transport=udp' }
                    ]
                }
            });
            
            console.log("PeerJS 생성 완료, 연결 대기 중");
            
            // 연결 설정 완료 대기
            await new Promise((resolve, reject) => {
                let timeout = setTimeout(() => {
                    reject(new Error("PeerJS 연결 시간 초과"));
                }, 10000); // 10초 타임아웃
                
                this.peer.on('open', id => {
                    clearTimeout(timeout);
                    console.log("PeerJS ID 할당됨:", id);
                    this.myId = id;
                    resolve();
                });
                
                this.peer.on('error', err => {
                    clearTimeout(timeout);
                    console.error("PeerJS 오류:", err);
                    reject(err);
                });
            });

            // 플레이어 정보 저장
            this.players.push({
                id: this.myId,
                nickname: nickname,
                isHost: false,
                isLiar: false,
                isSpy: false,
                score: 0
            });

            // 연결 요청 처리
            this.peer.on('connection', conn => {
                console.log("새 연결 요청 받음");
                this.handleNewConnection(conn);
            });

            console.log('게임 초기화 완료, 내 ID:', this.myId);
            this.emit('initialized', { id: this.myId });
            return this.myId;
        } catch (error) {
            console.error('게임 초기화 실패:', error);
            throw error;
        }
    }

    // 방 생성 (호스트가 됨)
    createRoom() {
        console.log('방 생성 중...');
        if (!this.peer || !this.myId) {
            console.error('방 생성 실패: PeerJS 연결이 초기화되지 않았습니다.');
            throw new Error('연결이 초기화되지 않았습니다. 페이지를 새로고침 후 다시 시도해주세요.');
        }
        
        console.log('방 ID 설정:', this.myId);
        this.isHost = true;
        this.players[0].isHost = true;
        this.emit('roomCreated', { roomId: this.myId });
        return this.myId;
    }

    // 방에 입장
    async joinRoom(roomId) {
        let retryCount = 0;
        const maxRetries = 3;
        
        while (retryCount < maxRetries) {
            try {
                console.log(`방 입장 시도 (${retryCount + 1}/${maxRetries}):`, roomId);
                
                // 유효한 roomId인지 검사 (비어있거나 기본값인 경우 예외 처리)
                if (!roomId || roomId === "undefined" || roomId === "null") {
                    throw new Error("유효하지 않은 방 ID");
                }
                
                // 방장(호스트)에게 연결
                const conn = this.peer.connect(roomId, { 
                    reliable: true,
                    serialization: 'json', 
                    metadata: { 
                        nickname: this.players[0].nickname,
                        type: 'join-request'
                    }
                });
                
                // 연결 설정 완료 대기
                await new Promise((resolve, reject) => {
                    // 연결 타임아웃 설정
                    const timeout = setTimeout(() => {
                        reject(new Error('연결 시간 초과'));
                    }, 15000); // 15초로 제한 시간 증가
                    
                    conn.on('open', () => {
                        clearTimeout(timeout);
                        console.log('연결 성공');
                        this.connections.push(conn);
                        resolve();
                    });
                    
                    conn.on('error', err => {
                        clearTimeout(timeout);
                        console.error('연결 오류:', err);
                        reject(err);
                    });
                    
                    // PeerJS의 연결 실패를 더 잘 처리하기 위한 추가 이벤트 리스너
                    this.peer.once('error', err => {
                        clearTimeout(timeout);
                        console.error('Peer 오류 (연결 시도 중):', err);
                        reject(err);
                    });
                });

                // 내 정보 전송
                const myPlayer = this.players[0];
                conn.send({
                    type: 'playerJoin',
                    player: myPlayer
                });

                // 메시지 수신 처리
                this.setupConnectionListeners(conn);

                this.emit('roomJoined', { roomId });
                return true;
            } catch (error) {
                console.error(`방 입장 실패 (시도 ${retryCount + 1}/${maxRetries}):`, error);
                retryCount++;
                
                if (retryCount >= maxRetries) {
                    console.error('최대 재시도 횟수 초과');
                    throw new Error(`방 입장에 실패했습니다: ${error.message}`);
                }
                
                // 재시도 전 대기 (500ms씩 증가하는 백오프)
                const waitTime = 1000 + (retryCount * 500);
                console.log(`${waitTime}ms 후 재시도...`);
                await new Promise(resolve => setTimeout(resolve, waitTime));
            }
        }
    }

    // 새로운 연결 처리
    handleNewConnection(conn) {
        conn.on('open', () => {
            this.connections.push(conn);
            this.setupConnectionListeners(conn);

            // 이미 게임이 시작되었다면 관전자로 처리
            if (this.gameStarted) {
                conn.send({
                    type: 'gameAlreadyStarted',
                    gameState: this.getGameState()
                });
            } else {
                // 현재 방 상태 전송
                conn.send({
                    type: 'roomState',
                    players: this.players,
                    gameMode: this.gameMode
                });
            }
        });
    }

    // 연결에 대한 리스너 설정
    setupConnectionListeners(conn) {
        conn.on('data', data => {
            this.handleMessage(conn, data);
        });

        conn.on('close', () => {
            this.handleDisconnect(conn);
        });

        conn.on('error', err => {
            console.error('연결 오류:', err);
            this.handleDisconnect(conn);
        });
    }

    // 메시지 처리
    handleMessage(conn, data) {
        console.log('메시지 수신:', data);

        switch (data.type) {
            case 'playerJoin':
                this.handlePlayerJoin(conn, data.player);
                break;
            case 'gameMode':
                this.setGameMode(data.mode);
                break;
            case 'startGame':
                this.startGame();
                break;
            case 'chat':
                this.handleChat(data);
                break;
            case 'turnEnd':
                this.nextTurn();
                break;
            case 'vote':
                this.handleVote(data.from, data.target);
                break;
            case 'guess':
                this.handleGuess(data.playerId, data.word);
                break;
            case 'restartGame':
                this.restartGame();
                break;
            case 'freeChat':
                // 자유 채팅 메시지는 그대로 전달만 합니다.
                this.broadcastToAll(data);
                break;
            default:
                console.log('알 수 없는 메시지 유형:', data.type);
        }
    }

    // 플레이어 입장 처리
    handlePlayerJoin(conn, player) {
        // 이미 게임이 시작됐으면 관전자로 처리
        if (this.gameStarted) {
            this.spectators.push({
                id: player.id,
                nickname: player.nickname,
                connection: conn
            });
            
            conn.send({
                type: 'spectatorMode',
                gameState: this.getGameState()
            });
            
            this.broadcastToAll({
                type: 'spectatorJoined',
                nickname: player.nickname
            });
            
            this.emit('spectatorJoined', { nickname: player.nickname });
            return;
        }

        // 이미 있는 플레이어인지 확인
        const existingPlayer = this.players.find(p => p.id === player.id);
        if (existingPlayer) return;

        // 최대 8명까지만 입장 가능
        if (this.players.length >= 8) {
            conn.send({
                type: 'roomFull'
            });
            return;
        }

        // 플레이어 추가
        this.players.push({
            ...player,
            isLiar: false,
            isSpy: false,
            score: 0,
            connection: conn
        });

        // 다른 모든 플레이어에게 새 플레이어 정보 전송
        for (const connection of this.connections) {
            if (connection !== conn) {
                connection.send({
                    type: 'playerJoined',
                    player: {
                        id: player.id,
                        nickname: player.nickname,
                        isHost: player.isHost,
                        score: 0
                    }
                });
            }
        }

        // 이벤트 발생
        this.emit('playerJoined', { 
            id: player.id,
            nickname: player.nickname
        });
    }

    // 연결 끊김 처리
    handleDisconnect(conn) {
        // 연결 리스트에서 제거
        const index = this.connections.findIndex(c => c === conn);
        if (index > -1) {
            this.connections.splice(index, 1);
        }

        // 관전자인 경우
        const spectatorIndex = this.spectators.findIndex(s => s.connection === conn);
        if (spectatorIndex > -1) {
            const spectator = this.spectators[spectatorIndex];
            this.spectators.splice(spectatorIndex, 1);
            
            this.broadcastToAll({
                type: 'spectatorLeft',
                nickname: spectator.nickname
            });
            
            this.emit('spectatorLeft', { nickname: spectator.nickname });
            return;
        }

        // 플레이어인 경우
        const playerIndex = this.players.findIndex(p => p.connection === conn);
        if (playerIndex > -1) {
            const player = this.players[playerIndex];
            this.players.splice(playerIndex, 1);
            
            // 다른 모든 플레이어에게 알림
            this.broadcastToAll({
                type: 'playerLeft',
                playerId: player.id,
                nickname: player.nickname
            });
            
            this.emit('playerLeft', { 
                id: player.id,
                nickname: player.nickname
            });

            // 호스트가 나간 경우 새 호스트 지정
            if (player.isHost && this.players.length > 0) {
                this.players[0].isHost = true;
                if (this.players[0].id === this.myId) {
                    this.isHost = true;
                }
                
                this.broadcastToAll({
                    type: 'newHost',
                    hostId: this.players[0].id,
                    nickname: this.players[0].nickname
                });
                
                this.emit('newHost', {
                    id: this.players[0].id,
                    nickname: this.players[0].nickname
                });
            }

            // 게임 진행 중이었다면 게임 종료
            if (this.gameStarted && this.players.length < 1) {
                this.endGame('인원 부족으로 게임이 종료되었습니다.');
            }
        }
    }

    // 게임 모드 설정
    setGameMode(mode) {
        if (!this.isHost) return;
        if (mode !== 'basic' && mode !== 'spy') return;
        
        this.gameMode = mode;
        this.broadcastToAll({
            type: 'gameMode',
            mode: mode
        });
        
        this.emit('gameModeChanged', { mode });
    }

    // 1인 플레이 게임 종료 처리
    handleSoloGameEnd() {
        this.gamePhase = 'result';
        
        // 자동으로 라이어 승리
        const gameResult = {
            result: 'liarWin',
            liarId: this.liar,
            liarNickname: this.players.find(p => p.id === this.liar).nickname,
            word: this.currentWord,
            isSoloGame: true
        };
        
        // 점수 계산
        this.updateScores(gameResult.result);
        
        // 게임 결과 전송
        this.emit('gameResult', {
            gameResult: gameResult,
            playerScores: this.players.map(p => ({ id: p.id, nickname: p.nickname, score: p.score }))
        });
    }

    // 게임 시작
    startGame() {
        if (!this.isHost) return;
        // 1명으로도 게임 시작 가능하도록 수정
        if (this.players.length < 1) {
            this.emit('error', { message: '게임을 시작하려면 최소 1명 이상이 필요합니다.' });
            return;
        }
        
        // 게임 상태 초기화
        this.gameStarted = true;
        this.gamePhase = 'playing';
        this.resetVotes();
        
        // 카테고리와 단어 선택
        const category = gameData.getRandomCategory();
        this.currentCategory = category.name;
        this.currentWord = gameData.getRandomWord(category.name);
        
        // 라이어, 스파이 선정
        const playerCount = this.players.length;
        
        // 라이어 선정
        const liarIndex = Math.floor(Math.random() * playerCount);
        this.players[liarIndex].isLiar = true;
        this.liar = this.players[liarIndex].id;
        
        // 스파이 모드인 경우 스파이 선정 (라이어와 다른 사람)
        // 플레이어가 2명 이상일 때만 스파이 선정
        this.spy = null; // 기본값으로 null 설정
        if (this.gameMode === 'spy' && playerCount >= 2) {
            let spyIndex;
            do {
                spyIndex = Math.floor(Math.random() * playerCount);
            } while (spyIndex === liarIndex);
            
            this.players[spyIndex].isSpy = true;
            this.spy = this.players[spyIndex].id;
        }
        
        // 발언 순서 랜덤 설정
        this.turnOrder = [...this.players];
        for (let i = this.turnOrder.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [this.turnOrder[i], this.turnOrder[j]] = [this.turnOrder[j], this.turnOrder[i]];
        }
        
        this.currentTurn = 0;
        
        // 각 플레이어에게 게임 정보 전송
        for (const player of this.players) {
            let playerMessage = {
                type: 'gameStarted',
                category: this.currentCategory,
                isLiar: player.id === this.liar,
                isSpy: player.id === this.spy,
                turnOrder: this.turnOrder.map(p => ({ 
                    id: p.id, 
                    nickname: p.nickname 
                })),
                playerId: player.id
            };
            
            // 라이어가 아닌 경우에만 단어 전달
            if (player.id !== this.liar) {
                playerMessage.word = this.currentWord;
            }
            
            // 플레이어에게 정보 전송
            if (player.id === this.myId) {
                this.emit('gameStarted', playerMessage);
            } else {
                player.connection.send(playerMessage);
            }
        }
        
        // 관전자들에게 게임 정보 전송 (단어 제외)
        for (const spectator of this.spectators) {
            spectator.connection.send({
                type: 'gameStartedSpectator',
                category: this.currentCategory,
                turnOrder: this.turnOrder.map(p => ({ 
                    id: p.id, 
                    nickname: p.nickname 
                }))
            });
        }
        
        // 현재 턴 정보 전송
        this.broadcastToAll({
            type: 'turnStart',
            playerId: this.turnOrder[this.currentTurn].id,
            nickname: this.turnOrder[this.currentTurn].nickname,
            turnNumber: this.currentTurn + 1
        });
        
        this.emit('turnStart', {
            playerId: this.turnOrder[this.currentTurn].id,
            nickname: this.turnOrder[this.currentTurn].nickname,
            turnNumber: this.currentTurn + 1
        });
    }

    // 턴 종료 및 다음 턴 설정
    nextTurn() {
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
        
        // 현재 턴 정보 전송
        this.broadcastToAll({
            type: 'turnStart',
            playerId: this.turnOrder[this.currentTurn].id,
            nickname: this.turnOrder[this.currentTurn].nickname,
            turnNumber: this.currentTurn + 1
        });
        
        this.emit('turnStart', {
            playerId: this.turnOrder[this.currentTurn].id,
            nickname: this.turnOrder[this.currentTurn].nickname,
            turnNumber: this.currentTurn + 1
        });
    }

    // 투표 시작
    startVoting() {
        this.gamePhase = 'voting';
        this.resetVotes();
        
        // 20초 타이머 설정
        this.voteTimer = setTimeout(() => {
            this.endVoting();
        }, 20000);
        
        this.broadcastToAll({
            type: 'voteStart',
            players: this.players.map(p => ({
                id: p.id,
                nickname: p.nickname
            }))
        });
        
        this.emit('voteStart', {
            players: this.players.map(p => ({
                id: p.id,
                nickname: p.nickname
            }))
        });
    }

    // 투표 처리
    handleVote(fromId, targetId) {
        this.votes[fromId] = targetId;
        
        // 모든 플레이어가 투표했는지 확인
        const allVoted = this.players.every(p => this.votes[p.id] !== undefined);
        
        if (allVoted) {
            clearTimeout(this.voteTimer);
            this.endVoting();
        }
    }

    // 투표 종료 및 결과 처리
    endVoting() {
        // 투표 집계
        const voteCount = {};
        
        for (const playerId in this.votes) {
            const targetId = this.votes[playerId];
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
                this.startWordGuessing();
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
                
                // 점수 계산
                this.updateScores(gameResult.result);
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
            
            // 점수 계산
            this.updateScores(gameResult.result);
        }
        
        // 투표 결과 전송
        this.broadcastToAll({
            type: 'voteResult',
            votes: this.votes,
            voteCount: voteCount,
            gameResult: gameResult,
            playerScores: this.players.map(p => ({ id: p.id, nickname: p.nickname, score: p.score }))
        });
        
        this.emit('voteResult', {
            votes: this.votes,
            voteCount: voteCount,
            gameResult: gameResult,
            playerScores: this.players.map(p => ({ id: p.id, nickname: p.nickname, score: p.score }))
        });
        
        this.gamePhase = 'result';
    }

    // 라이어의 단어 추측 시작
    startWordGuessing() {
        this.gamePhase = 'wordGuess';
        
        // 20초 타이머 설정
        this.guessTimer = setTimeout(() => {
            this.handleGuess(this.liar, '');
        }, 20000);
        
        this.broadcastToAll({
            type: 'wordGuessStart',
            liarId: this.liar,
            liarNickname: this.players.find(p => p.id === this.liar).nickname
        });
        
        this.emit('wordGuessStart', {
            liarId: this.liar,
            liarNickname: this.players.find(p => p.id === this.liar).nickname
        });
    }

    // 라이어의 단어 추측 처리
    handleGuess(playerId, word) {
        if (playerId !== this.liar) return;
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
        this.updateScores(gameResult.result);
        
        // 게임 결과 전송
        this.broadcastToAll({
            type: 'gameResult',
            gameResult: gameResult,
            playerScores: this.players.map(p => ({ id: p.id, nickname: p.nickname, score: p.score }))
        });
        
        this.emit('gameResult', {
            gameResult: gameResult,
            playerScores: this.players.map(p => ({ id: p.id, nickname: p.nickname, score: p.score }))
        });
        
        this.gamePhase = 'result';
    }

    // 채팅 메시지 처리
    handleChat(data) {
        // 게임 중이고 현재 차례가 아니면 채팅 무시
        if (this.gamePhase === 'playing' && this.turnOrder[this.currentTurn].id !== data.playerId) {
            return;
        }
        
        // 채팅이 40글자를 초과하면 잘라내기
        if (data.message.length > 40) {
            data.message = data.message.substring(0, 40);
        }
        
        // 게임 중이면 턴 채팅으로 처리
        if (this.gamePhase === 'playing' && this.turnOrder[this.currentTurn].id === data.playerId) {
            this.broadcastToAll({
                type: 'turnChat',
                playerId: data.playerId,
                nickname: data.nickname,
                message: data.message
            });
            
            this.emit('turnChat', {
                playerId: data.playerId,
                nickname: data.nickname,
                message: data.message
            });
            
            // 자동으로 다음 턴으로 진행
            setTimeout(() => this.nextTurn(), 1000);
        } 
        // 라이어 추측 단계에서는 라이어의 메시지만 처리
        else if (this.gamePhase === 'wordGuess' && data.playerId === this.liar) {
            this.handleGuess(data.playerId, data.message);
        }
        // 그 외에는 일반 채팅으로 처리
        else {
            this.broadcastToAll({
                type: 'chat',
                playerId: data.playerId,
                nickname: data.nickname,
                message: data.message
            });
            
            this.emit('chat', {
                playerId: data.playerId,
                nickname: data.nickname,
                message: data.message
            });
        }
    }

    // 모든 플레이어에게 메시지 전송
    broadcastToAll(message) {
        for (const player of this.players) {
            if (player.id !== this.myId) {
                player.connection.send(message);
            }
        }
        
        for (const spectator of this.spectators) {
            spectator.connection.send(message);
        }
    }

    // 투표 초기화
    resetVotes() {
        this.votes = {};
    }

    // 점수 업데이트
    updateScores(result) {
        if (result === 'liarWin') {
            // 라이어 승리: 라이어 +3점, 스파이 +1점
            for (const player of this.players) {
                if (player.id === this.liar) {
                    player.score += 3;
                } else if (player.id === this.spy) {
                    player.score += 1;
                }
            }
        } else if (result === 'playersWin') {
            // 플레이어 승리: 라이어와 스파이 외 모두 +1점
            for (const player of this.players) {
                if (player.id !== this.liar && player.id !== this.spy) {
                    player.score += 1;
                }
            }
        }
    }

    // 게임 다시 시작
    restartGame() {
        if (!this.isHost) return;
        
        // 게임 상태 초기화
        this.gameStarted = false;
        this.gamePhase = 'lobby';
        
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
                score: 0,
                connection: spectator.connection
            });
        }
        this.spectators = [];
        
        // 모든 플레이어에게 게임 재시작 알림
        this.broadcastToAll({
            type: 'gameRestarted',
            players: this.players.map(p => ({
                id: p.id,
                nickname: p.nickname,
                isHost: p.isHost,
                score: p.score
            }))
        });
        
        this.emit('gameRestarted', {
            players: this.players.map(p => ({
                id: p.id,
                nickname: p.nickname,
                isHost: p.isHost,
                score: p.score
            }))
        });
    }

    // 게임 강제 종료
    endGame(reason) {
        // 타이머 초기화
        if (this.voteTimer) {
            clearTimeout(this.voteTimer);
        }
        if (this.guessTimer) {
            clearTimeout(this.guessTimer);
        }
        
        // 게임 상태 초기화
        this.gameStarted = false;
        this.gamePhase = 'lobby';
        
        // 모든 플레이어에게 게임 종료 알림
        this.broadcastToAll({
            type: 'gameEnded',
            reason: reason
        });
        
        this.emit('gameEnded', { reason });
    }

    // 현재 게임 상태 가져오기
    getGameState() {
        return {
            gameStarted: this.gameStarted,
            gamePhase: this.gamePhase,
            gameMode: this.gameMode,
            players: this.players.map(p => ({
                id: p.id,
                nickname: p.nickname,
                isHost: p.isHost,
                score: p.score
            })),
            currentCategory: this.currentCategory,
            currentTurn: this.currentTurn,
            turnOrder: this.turnOrder.map(p => ({ id: p.id, nickname: p.nickname }))
        };
    }

    // 메시지 전송 (채팅 및 명령 전송)
    sendMessage(message, isTurnChat = false) {
        // 메시지 길이 제한
        if (message.length > 40) {
            message = message.substring(0, 40);
        }
        
        const messageData = {
            type: isTurnChat ? 'turnChat' : 'chat',
            playerId: this.myId,
            nickname: this.players.find(p => p.id === this.myId).nickname,
            message: message
        };
        
        // 라이어 추측 단계에서는 메시지 타입 변경
        if (this.gamePhase === 'wordGuess' && this.liar === this.myId) {
            messageData.type = 'guess';
        }
        
        // 모든 플레이어에게 메시지 전송
        this.broadcastToAll(messageData);
        
        // 자신에게도 이벤트 발생
        this.emit(messageData.type, {
            playerId: this.myId,
            nickname: this.players.find(p => p.id === this.myId).nickname,
            message: message
        });
        
        // 라이어 추측 단계에서 라이어가 채팅을 보내면 자동으로 추측으로 처리
        if (this.gamePhase === 'wordGuess' && this.liar === this.myId) {
            this.handleGuess(this.myId, message);
        }
        
        // 턴 채팅인 경우 자동으로 다음 턴으로 진행
        if (isTurnChat && this.gamePhase === 'playing') {
            setTimeout(() => this.nextTurn(), 1000);
        }
    }

    // 투표 제출
    submitVote(targetId) {
        if (this.gamePhase !== 'voting') return;
        
        this.votes[this.myId] = targetId;
        
        this.broadcastToAll({
            type: 'vote',
            from: this.myId,
            target: targetId
        });
        
        // 모든 플레이어가 투표했는지 확인
        const allVoted = this.players.every(p => this.votes[p.id] !== undefined);
        
        if (allVoted) {
            clearTimeout(this.voteTimer);
            this.endVoting();
        }
    }
}