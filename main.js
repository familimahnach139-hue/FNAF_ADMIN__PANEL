// Главная страница игры FNaF - ОДИН ЕДИНСТВЕННЫЙ КЛАСС!
class MainGame {
    constructor() {
        this.gameState = {
            // Состояние игры
            isWaitingScreenActive: false,
            isGameActive: false,
            isAdminConnected: false,
            adminId: null,
            
            // Игровые параметры
            time: '12:00 AM',
            energy: 100,
            currentCamera: null,
            cameraOpen: false,
            
            // Видеовызовы (вместо камер)
            videoCalls: {
                1: { id: 1, link: '', type: 'telegram', broken: false, repairing: false, repairTime: 0, callerName: 'Звонок 1' },
                2: { id: 2, link: '', type: 'viber', broken: false, repairing: false, repairTime: 0, callerName: 'Звонок 2' },
                3: { id: 3, link: '', type: 'google-meet', broken: false, repairing: false, repairTime: 0, callerName: 'Звонок 3' },
                4: { id: 4, link: '', type: 'telegram', broken: false, repairing: false, repairTime: 0, callerName: 'Звонок 4' }
            },
            videoCallLinks: {},
            
            // Устройства камер (для подключения через ссылки)
            cameras: {
                1: { id: '', number: 1, broken: false, repairing: false, repairTime: 0, isActive: false, lastUpdate: 0, link: '' },
                2: { id: '', number: 2, broken: false, repairing: false, repairTime: 0, isActive: false, lastUpdate: 0, link: '' },
                3: { id: '', number: 3, broken: false, repairing: false, repairTime: 0, isActive: false, lastUpdate: 0, link: '' },
                4: { id: '', number: 4, broken: false, repairing: false, repairTime: 0, isActive: false, lastUpdate: 0, link: '' }
            },
            cameraDevices: {
                1: { id: '', number: 1, broken: false, repairing: false, repairTime: 0, isActive: false, lastUpdate: 0 },
                2: { id: '', number: 2, broken: false, repairing: false, repairTime: 0, isActive: false, lastUpdate: 0 },
                3: { id: '', number: 3, broken: false, repairing: false, repairTime: 0, isActive: false, lastUpdate: 0 },
                4: { id: '', number: 4, broken: false, repairing: false, repairTime: 0, isActive: false, lastUpdate: 0 }
            },
            
            // Индикаторы
            indicators: {
                green: false,
                orange: false,
                red: false
            },
            
            // Системные состояния
            systemError: false,
            systemRestarting: false,
            restartTimer: 30,
            
            // Ссылка для подключения
            connectionLink: '',
            
            // Победа
            victory: false
        };
        
        this.domElements = {};
        this.connectionInterval = null;
        this.cameraTimers = {};
        this.cameraRefreshTimers = {};
        this.currentNavMode = 'time';
        this._videoRepairTick = null;
        this._victoryEndTimer = null;
        this.init();
    }

    static get VICTORY_VIDEO_SRC() {
        return 'media/' + encodeURIComponent('Five Nights at Freddys - 6 AM [get.gt].mp4');
    }
    
    init() {
        this.cacheDOM();
        this.bindEvents();
        this.generateConnectionLink();
        this.loadState();
        this.setupLoading();
        this.startConnectionPolling();
        this.setupKeyboard();
        this.startStateSync();
        this.startVideoCallRepairGlobalTick();
    }

    escapeHtml(text) {
        if (text == null || text === '') return '';
        const d = document.createElement('div');
        d.textContent = String(text);
        return d.innerHTML;
    }

    pushVideoCallsToAdminStorage() {
        try {
            const adminData = JSON.parse(localStorage.getItem('fnaf_admin_data') || '{}');
            if (!adminData.gameState) adminData.gameState = {};
            adminData.gameState.videoCalls = JSON.parse(JSON.stringify(this.gameState.videoCalls));
            adminData.timestamp = Date.now();
            localStorage.setItem('fnaf_admin_data', JSON.stringify(adminData));
        } catch (e) {
            console.warn('pushVideoCallsToAdminStorage:', e);
        }
    }

    startVideoCallRepairGlobalTick() {
        if (this._videoRepairTick) clearInterval(this._videoRepairTick);
        this._videoRepairTick = setInterval(() => {
            if (!this.gameState.isGameActive) return;
            let changed = false;
            for (let i = 1; i <= 4; i++) {
                const c = this.gameState.videoCalls[i];
                if (!c || !c.repairing || c.repairTime <= 0) continue;
                c.repairTime--;
                c.timestamp = Date.now();
                if (c.repairTime <= 0) {
                    c.repairing = false;
                    c.broken = false;
                    c.repairTime = 0;
                }
                changed = true;
            }
            if (changed) {
                this.saveState();
                this.pushVideoCallsToAdminStorage();
                this.updateCallStatuses();
                this.updateVideoCallsDisplay();
            }
        }, 1000);
    }
    
    startStateSync() {
        setInterval(() => {
            this.syncWithAdminPanel();
        }, 500);
    }
    
    syncWithAdminPanel() {
        try {
            const adminConnectedFlag = localStorage.getItem('fnaf_admin_connected') === 'true';
            let adminPanelFresh = false;
            try {
                const ad = JSON.parse(localStorage.getItem('fnaf_admin_data') || 'null');
                adminPanelFresh = !!(ad && ad.timestamp && Date.now() - ad.timestamp < 8000);
            } catch (e) { /* ignore */ }

            const linked = adminConnectedFlag || adminPanelFresh;
            if (this.gameState.isAdminConnected !== linked) {
                this.gameState.isAdminConnected = linked;
                this.updateAdminConnectionIndicator();
            }
            if (!linked) return;
            
            // Проверяем fnaf_admin_data (основной источник)
            const adminDataStr = localStorage.getItem('fnaf_admin_data');
            const gameStateStr = localStorage.getItem('fnaf_game_state');
            
            let remoteState = null;
            
            if (adminDataStr) {
                try {
                    const adminData = JSON.parse(adminDataStr);
                    remoteState = adminData.gameState || adminData;
                } catch (err) {
                    console.warn('Не удалось прочитать fnaf_admin_data:', err);
                }
            }
            
            if (!remoteState && gameStateStr) {
                try {
                    remoteState = JSON.parse(gameStateStr);
                } catch (err) {
                    console.warn('Не удалось прочитать fnaf_game_state:', err);
                }
            }
            
            if (!remoteState) return;

                this.applyCameraDevicesToCameras(remoteState.cameraDevices);
                
                if (remoteState.videoCalls) {
                    let callsChanged = false;
                    for (let i = 1; i <= 4; i++) {
                        const remoteCall = remoteState.videoCalls[i];
                        if (!remoteCall) continue;
                        const localCall = this.gameState.videoCalls[i];
                        const rts = remoteCall.timestamp || 0;
                        const lts = localCall.timestamp || 0;
                        const newerRemote = rts >= lts;
                        const diff = remoteCall.broken !== localCall.broken
                            || remoteCall.repairing !== localCall.repairing
                            || (remoteCall.repairTime || 0) !== (localCall.repairTime || 0);
                        if (newerRemote && diff) {
                            localCall.broken = !!remoteCall.broken;
                            localCall.repairing = !!remoteCall.repairing;
                            localCall.repairTime = remoteCall.repairTime || 0;
                            localCall.timestamp = rts;
                            if (remoteCall.link != null) localCall.link = remoteCall.link;
                            if (remoteCall.type) localCall.type = remoteCall.type;
                            if (remoteCall.callerName != null) localCall.callerName = remoteCall.callerName;
                            callsChanged = true;
                        }
                    }
                    if (callsChanged) {
                        this.updateCallStatuses();
                        this.updateVideoCallsDisplay();
                    }
                }
                
                if (remoteState.systemError !== undefined) {
                    const rTimer = remoteState.restartTimer ?? this.gameState.restartTimer;
                    const sysDiff = remoteState.systemError !== this.gameState.systemError
                        || !!remoteState.systemRestarting !== !!this.gameState.systemRestarting
                        || (this.gameState.systemRestarting && rTimer !== this.gameState.restartTimer);
                    if (sysDiff) {
                        this.gameState.systemError = !!remoteState.systemError;
                        this.gameState.systemRestarting = !!remoteState.systemRestarting;
                        this.gameState.restartTimer = rTimer;
                        this.updateSystemError();
                        if (!remoteState.systemError) {
                            this.gameState.systemRestarting = false;
                            if (this.domElements.restartBtn) {
                                this.domElements.restartBtn.disabled = false;
                                this.domElements.restartBtn.innerHTML = '<i class="fas fa-power-off"></i> ПЕРЕЗАПУСК СИСТЕМЫ (ПРОБЕЛ)';
                            }
                        }
                        if (this.gameState.systemError && this.gameState.systemRestarting && !this.restartTimerInterval) {
                            this.startRestartTimer();
                        }
                    }
                }
                
                // Синхронизируем индикаторы
                if (remoteState.indicators) {
                    this.gameState.indicators = remoteState.indicators;
                    this.updateIndicators();
                }
                
                // Синхронизируем время
                if (remoteState.time && remoteState.time !== this.gameState.time) {
                    this.gameState.time = remoteState.time;
                    this.updateUI();
                }
                
                // Синхронизируем энергию
                if (remoteState.energy !== undefined && remoteState.energy !== this.gameState.energy) {
                    this.gameState.energy = remoteState.energy;
                    this.updateUI();
                }
                
                // Синхронизируем победу
                if (remoteState.victory && !this.gameState.victory) {
                    this.gameState.victory = true;
                    this.showVictory();
                }
                
                // Синхронизируем Game Over
                if (remoteState.triggerGameOver && this.gameState.isGameActive) {
                    this.triggerGameOver();
                }
                
                // Также проверяем напрямую в fnaf_game_state
                const directGameState = JSON.parse(localStorage.getItem('fnaf_game_state') || '{}');
                if (directGameState.triggerGameOver && this.gameState.isGameActive) {
                    this.triggerGameOver();
                    // Очищаем флаг
                    delete directGameState.triggerGameOver;
                    localStorage.setItem('fnaf_game_state', JSON.stringify(directGameState));
                }
                
                this.saveState();
        } catch (e) {
            console.error('Ошибка синхронизации:', e);
        }
    }

    applyCameraDevicesToCameras(devices) {
        if (!devices || typeof devices !== 'object') return;
        for (let i = 1; i <= 4; i++) {
            const d = devices[i];
            if (!d) continue;
            const prev = this.gameState.cameras[i] || {
                id: '', number: i, broken: false, repairing: false, repairTime: 0, isActive: false, lastUpdate: 0, link: ''
            };
            const next = { ...prev };
            if (d.link != null && String(d.link).trim() !== '') next.link = d.link;
            if (d.id != null && String(d.id).trim() !== '') next.id = d.id;
            if (d.broken !== undefined) next.broken = d.broken;
            if (d.repairing !== undefined) next.repairing = d.repairing;
            if (d.repairTime !== undefined) next.repairTime = d.repairTime;
            if (d.isActive !== undefined) next.isActive = d.isActive;
            next.number = d.number != null ? d.number : i;
            this.gameState.cameras[i] = next;
            this.gameState.cameraDevices[i] = { ...this.gameState.cameraDevices[i], ...d };
        }
    }
    
    cacheDOM() {
        // Основные экраны
        this.domElements.loadingScreen = document.getElementById('loadingScreen');
        this.domElements.waitingScreen = document.getElementById('waitingScreen');
        this.domElements.gameScreen = document.getElementById('gameScreen');
        
        // Индикаторы подключения
        this.domElements.adminConnected = document.getElementById('adminConnected');
        this.domElements.disconnectAdminBtn = document.getElementById('disconnectAdminBtn');
        this.domElements.mainLink = document.getElementById('mainLink');
        
        // Кнопки
        this.domElements.startGameBtn = document.getElementById('startGameBtn');
        this.domElements.cameraBtn = document.getElementById('cameraBtn');
        this.domElements.leftBtn = document.getElementById('leftBtn');
        this.domElements.rightBtn = document.getElementById('rightBtn');
        this.domElements.restartBtn = document.getElementById('restartBtn');
        this.domElements.restartGameBtn = document.getElementById('restartGameBtn');
        this.domElements.repairCameraBtn = document.getElementById('repairCameraBtn');
        
        // Отображение информации
        this.domElements.timeDisplay = document.getElementById('timeDisplay');
        this.domElements.energyDisplay = document.getElementById('energyDisplay');
        this.domElements.energyLevel = document.getElementById('energyLevel');
        this.domElements.gameStatusText = document.getElementById('gameStatusText');
        this.domElements.navDisplay = document.getElementById('navDisplay');
        this.domElements.currentTimeDisplay = document.getElementById('currentTimeDisplay');
        
        // Индикаторы
        this.domElements.waitingGreen = document.getElementById('indicatorGreen');
        this.domElements.waitingOrange = document.getElementById('indicatorOrange');
        this.domElements.waitingRed = document.getElementById('indicatorRed');
        this.domElements.gameGreenIndicator = document.getElementById('gameGreenIndicator');
        this.domElements.gameOrangeIndicator = document.getElementById('gameOrangeIndicator');
        this.domElements.gameRedIndicator = document.getElementById('gameRedIndicator');
        this.domElements.adminGreenIndicator = document.getElementById('adminGreenIndicator');
        this.domElements.adminOrangeIndicator = document.getElementById('adminOrangeIndicator');
        this.domElements.adminRedIndicator = document.getElementById('adminRedIndicator');
        
        // Камеры
        this.domElements.cameraPlaceholder = document.getElementById('cameraPlaceholder');
        this.domElements.cameraFeed = document.getElementById('cameraFeed');
        this.domElements.cameraInterface = document.getElementById('cameraInterface');
        this.domElements.closeCameraInterface = document.getElementById('closeCameraInterface');
        this.domElements.cameraError = document.getElementById('cameraError');
        this.domElements.repairTimer = document.getElementById('repairTimer');
        
        // Ввод ссылок видеовызовов
        this.domElements.videoCall1Input = document.getElementById('videoCall1Input');
        this.domElements.videoCall2Input = document.getElementById('videoCall2Input');
        this.domElements.videoCall3Input = document.getElementById('videoCall3Input');
        this.domElements.videoCall4Input = document.getElementById('videoCall4Input');
        
        this.domElements.videoCall1Type = document.getElementById('videoCall1Type');
        this.domElements.videoCall2Type = document.getElementById('videoCall2Type');
        this.domElements.videoCall3Type = document.getElementById('videoCall3Type');
        this.domElements.videoCall4Type = document.getElementById('videoCall4Type');
        
        this.domElements.videoCall1Name = document.getElementById('videoCall1Name');
        this.domElements.videoCall2Name = document.getElementById('videoCall2Name');
        this.domElements.videoCall3Name = document.getElementById('videoCall3Name');
        this.domElements.videoCall4Name = document.getElementById('videoCall4Name');
        
        this.domElements.saveVideoCallLinks = document.getElementById('saveVideoCallLinks');
        this.domElements.clearVideoCallLinks = document.getElementById('clearVideoCallLinks');
        
        // Статусы видеовызовов
        this.domElements.videoCall1Status = document.getElementById('videoCall1Status');
        this.domElements.videoCall2Status = document.getElementById('videoCall2Status');
        this.domElements.videoCall3Status = document.getElementById('videoCall3Status');
        this.domElements.videoCall4Status = document.getElementById('videoCall4Status');
        
        // Контейнер для видеовызовов в игре
        this.domElements.videoCallsGrid = document.getElementById('videoCallsGrid');
        
        // Системные сообщения
        this.domElements.systemError = document.getElementById('systemError');
        this.domElements.systemRestartTimer = document.getElementById('restartTimer');
        this.domElements.gameOver = document.getElementById('gameOver');
        
        // Победа
        this.domElements.victoryScreen = document.getElementById('victoryScreen');
        
        // Аниматроник
        this.domElements.animatronic = document.getElementById('animatronic');
    }
    
    bindEvents() {
        // Кнопки
        if (this.domElements.startGameBtn) {
            this.domElements.startGameBtn.addEventListener('click', () => this.startGame());
        }
        if (this.domElements.cameraBtn) {
            this.domElements.cameraBtn.addEventListener('click', () => this.toggleCameraInterface());
        }
        if (this.domElements.closeCameraInterface) {
            this.domElements.closeCameraInterface.addEventListener('click', () => this.toggleCameraInterface());
        }
        if (this.domElements.restartBtn) {
            this.domElements.restartBtn.addEventListener('click', () => this.requestRestart());
        }
        if (this.domElements.restartGameBtn) {
            this.domElements.restartGameBtn.addEventListener('click', () => this.restartGame());
        }
        if (this.domElements.repairCameraBtn) {
            this.domElements.repairCameraBtn.addEventListener('click', () => this.repairCurrentCamera());
        }
        
        // Кнопка отключения админа
        if (this.domElements.disconnectAdminBtn) {
            this.domElements.disconnectAdminBtn.addEventListener('click', () => this.disconnectAdmin());
        }
        
        // Навигация
        if (this.domElements.leftBtn) {
            this.domElements.leftBtn.addEventListener('click', () => this.switchNavMode('time'));
        }
        if (this.domElements.rightBtn) {
            this.domElements.rightBtn.addEventListener('click', () => this.switchNavMode('energy'));
        }
        
        // Ссылка для админ-панели
        if (this.domElements.mainLink) {
            this.domElements.mainLink.addEventListener('click', (e) => {
                if (e.currentTarget.textContent.trim()) {
                    this.copyGameLink(e.currentTarget);
                }
            });
        }
        
        // Видеовызовы
        if (this.domElements.saveVideoCallLinks) {
            this.domElements.saveVideoCallLinks.addEventListener('click', () => this.saveVideoCallLinks());
        }
        if (this.domElements.clearVideoCallLinks) {
            this.domElements.clearVideoCallLinks.addEventListener('click', () => this.clearVideoCallLinks());
        }
    }
    
    setupKeyboard() {
        document.addEventListener('keydown', (e) => {
            if (e.code === 'Space') {
                e.preventDefault();
                if (this.gameState.systemError) {
                    this.requestRestart();
                } else if (this.gameState.isGameActive) {
                    this.toggleCameraInterface();
                }
            } else if (e.code === 'ArrowLeft') {
                this.switchNavMode('time');
            } else if (e.code === 'ArrowRight') {
                this.switchNavMode('energy');
            } else if (e.code === 'Escape') {
                this.closeCameraInterface();
            } else if (e.code >= 'Digit1' && e.code <= 'Digit4') {
                const cameraId = parseInt(e.code.replace('Digit', ''));
                this.selectCamera(cameraId);
            }
        });
    }
    
    generateConnectionLink() {
        let gameId = localStorage.getItem('fnaf_game_id');
        
        if (!gameId) {
            gameId = 'game_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
            localStorage.setItem('fnaf_game_id', gameId);
        }
        
        const currentUrl = window.location.href.split('?')[0];
        this.gameState.connectionLink = currentUrl + '?connect=' + gameId;
        
        localStorage.setItem('fnaf_connection_link', this.gameState.connectionLink);
        
        if (this.domElements.mainLink) {
            this.domElements.mainLink.textContent = this.gameState.connectionLink;
        }
        
        this.saveState();
    }
    
    updateAdminConnectionIndicator() {
        if (this.domElements.adminConnected) {
            this.domElements.adminConnected.style.display = this.gameState.isAdminConnected ? 'flex' : 'none';
        }
        
        // Также обновляем индикатор в админ-панели
        if (this.gameState.isAdminConnected) {
            this.domElements.adminGreenIndicator.classList.add('active');
        } else {
            this.domElements.adminGreenIndicator.classList.remove('active');
        }
    }
    
    disconnectAdmin() {
        // Отключаем админа
        this.gameState.isAdminConnected = false;
        this.gameState.adminId = null;
        
        // Очищаем данные админа из localStorage
        localStorage.removeItem('fnaf_admin_data');
        localStorage.removeItem('fnaf_admin_connected');
        
        // Обновляем состояние
        this.updateAdminConnectionIndicator();
        this.saveState();
        
        // Показываем уведомление
        this.showNotification('Админ отключен', 'warning');
        
        console.log('Админ отключен от игры');
    }
    
    setupLoading() {
        setTimeout(() => {
            this.domElements.loadingScreen.classList.remove('active');
            this.checkGameState();
        }, 2000);
    }
    
    checkGameState() {
        const savedLink = localStorage.getItem('fnaf_connection_link');
        if (savedLink && this.domElements.mainLink) {
            this.gameState.connectionLink = savedLink;
            this.domElements.mainLink.textContent = savedLink;
        }
        
        if (this.gameState.isGameActive) {
            this.loadVideoCallLinks();
            this.showGameScreen();
        } else if (this.gameState.isAdminConnected) {
            this.showWaitingScreen(true);
        } else {
            this.showWaitingScreen(false);
        }
    }
    
    showWaitingScreen(isReady) {
        this.gameState.isWaitingScreenActive = true;
        this.domElements.waitingScreen.classList.add('active');
        this.domElements.gameScreen.classList.remove('active');
        
        if (isReady) {
            this.domElements.gameStatusText.textContent = 'Админ подключен. Нажмите "Начать игру".';
            this.domElements.startGameBtn.disabled = false;
        } else {
            this.domElements.gameStatusText.textContent = 'Ожидание подключения админ-панели...';
            this.domElements.startGameBtn.disabled = true;
        }
        
        this.updateIndicators();
    }
    
    showGameScreen() {
        this.domElements.waitingScreen.classList.remove('active');
        this.domElements.gameScreen.classList.add('active');
        this.updateUI();
        this.updateNavDisplay();
        this.updateVideoCallsDisplay();
    }
    
    startGame() {
        if (!this.gameState.isWaitingScreenActive || !this.gameState.isAdminConnected) return;
        
        this.gameState.isGameActive = true;
        this.gameState.isWaitingScreenActive = false;
        this.saveState();
        this.showGameScreen();
        this.loadVideoCallLinks();
        this.updateCallStatuses();
        this.updateVideoCallsDisplay();
    }
    
    loadVideoCallLinks() {
        const savedLinks = localStorage.getItem('fnaf_video_call_links');
        if (savedLinks) {
            const links = JSON.parse(savedLinks);
            this.gameState.videoCallLinks = links;
            
            for (let i = 1; i <= 4; i++) {
                if (this.domElements[`videoCall${i}Input`] && links[i]) {
                    this.domElements[`videoCall${i}Input`].value = links[i].link || '';
                    this.gameState.videoCalls[i].link = links[i].link || '';
                    this.gameState.videoCalls[i].type = links[i].type || 'telegram';
                    this.gameState.videoCalls[i].callerName = links[i].callerName || `Звонок ${i}`;
                }
            }
        }
    }
    
    updateCallStatuses() {
        for (let i = 1; i <= 4; i++) {
            const call = this.gameState.videoCalls[i];
            const statusElement = this.domElements[`videoCall${i}Status`];
            
            if (!statusElement) continue;
            
            if (!call.link || call.link.trim() === '') {
                statusElement.textContent = 'Нет ссылки';
                statusElement.className = 'call-status status-offline';
            } else if (call.broken) {
                if (call.repairing) {
                    statusElement.textContent = `Ремонт: ${call.repairTime}с`;
                    statusElement.className = 'call-status status-repairing';
                } else {
                    statusElement.textContent = 'Сломана';
                    statusElement.className = 'call-status status-offline';
                }
            } else {
                statusElement.textContent = 'Активна';
                statusElement.className = 'call-status status-online';
            }
        }
    }
    
    saveVideoCallLinks() {
        const links = {};
        let hasLinks = false;
        
        for (let i = 1; i <= 4; i++) {
            const linkInput = this.domElements[`videoCall${i}Input`];
            const typeSelect = this.domElements[`videoCall${i}Type`];
            const nameInput = this.domElements[`videoCall${i}Name`];
            
            if (linkInput && linkInput.value.trim()) {
                links[i] = {
                    link: linkInput.value.trim(),
                    type: typeSelect ? typeSelect.value : 'telegram',
                    callerName: nameInput ? nameInput.value.trim() : `Звонок ${i}`
                };
                hasLinks = true;
                this.gameState.videoCalls[i].link = links[i].link;
                this.gameState.videoCalls[i].type = links[i].type;
                this.gameState.videoCalls[i].callerName = links[i].callerName;
            }
        }
        
        if (hasLinks) {
            this.gameState.videoCallLinks = links;
            localStorage.setItem('fnaf_video_call_links', JSON.stringify(links));
            this.saveState();
            this.updateCallStatuses();
            this.updateVideoCallsDisplay();
            this.showNotification('Видеовызовы сохранены!', 'success');
        } else {
            this.showNotification('Введите хотя бы одну ссылку на видеовызов!', 'warning');
        }
    }
    
    clearVideoCallLinks() {
        if (confirm('Очистить все ссылки на видеовызовы?')) {
            for (let i = 1; i <= 4; i++) {
                if (this.domElements[`videoCall${i}Input`]) {
                    this.domElements[`videoCall${i}Input`].value = '';
                }
                this.gameState.videoCalls[i].link = '';
            }
            
            this.gameState.videoCallLinks = {};
            localStorage.removeItem('fnaf_video_call_links');
            
            this.updateCallStatuses();
            this.updateVideoCallsDisplay();
            this.saveState();
            this.showNotification('Все видеовызовы очищены!', 'success');
        }
    }
    
    toggleCameraInterface() {
        if (!this.gameState.isGameActive || this.gameState.systemError) return;
        
        this.gameState.cameraOpen = !this.gameState.cameraOpen;
        
        if (this.domElements.cameraInterface) {
            this.domElements.cameraInterface.classList.toggle('active');
        }
        
        if (this.gameState.cameraOpen && !this.gameState.indicators.orange) {
            this.gameState.indicators.orange = true;
            this.saveState();
            this.updateAdminPanel();
        }
    }
    
    showCameraSelection() {
        if (!this.domElements.cameraInterface) return;
        
        const inputsContainer = this.domElements.cameraInterface.querySelector('.camera-inputs');
        if (!inputsContainer) return;
        
        const oldSelection = inputsContainer.querySelector('.camera-selection');
        if (oldSelection) oldSelection.remove();
        
        const cameraButtons = document.createElement('div');
        cameraButtons.className = 'camera-selection';
        cameraButtons.innerHTML = `
            <h3 style="color:#0f0; margin-bottom:20px; text-align:center; font-size:1.5rem;">
                <i class="fas fa-video"></i> ВЫБЕРИТЕ КАМЕРУ ДЛЯ ПРОСМОТРА
            </h3>
            <div class="camera-buttons-grid">
                ${[1,2,3,4].map(i => {
                    const camera = this.gameState.cameras[i];
                    let statusText = '🟢 РАБОТАЕТ';
                    let statusClass = 'status-online';
                    let btnClass = 'success-btn';
                    let disabled = false;
                    let statusDetails = '';
                    
                    if (!camera.link || camera.link.trim() === '') {
                        statusText = '⚫ НЕТ ССЫЛКИ';
                        statusClass = 'status-offline';
                        btnClass = 'disabled-btn';
                        disabled = true;
                        statusDetails = 'Ссылка не настроена';
                    } else if (camera.broken) {
                        if (camera.repairing) {
                            statusText = `🟡 РЕМОНТ: ${camera.repairTime}С`;
                            statusClass = 'status-repairing';
                            btnClass = 'warning-btn';
                            statusDetails = 'В процессе ремонта';
                        } else {
                            statusText = '🔴 СЛОМАНА';
                            statusClass = 'status-offline';
                            btnClass = 'danger-btn';
                            statusDetails = 'Требуется ремонт';
                        }
                    } else {
                        const screenshotTime = localStorage.getItem(`fnaf_camera_${i}_screenshot_time`);
                        if (screenshotTime && Date.now() - parseInt(screenshotTime) < 5000) {
                            statusDetails = '● ПРЯМАЯ ТРАНСЛЯЦИЯ';
                        } else {
                            statusDetails = '✓ УСТРОЙСТВО ПОДКЛЮЧЕНО';
                        }
                    }
                    
                    return `
                        <div class="camera-button-item" style="text-align:center; padding:10px; border:2px solid #333; border-radius:10px; background:#111;">
                            <div style="margin-bottom:15px; color:#0af; font-size:1.1rem;">
                                <i class="fas fa-video"></i> КАМЕРА ${i}
                            </div>
                            <button class="btn ${btnClass} camera-select-btn" 
                                    data-camera="${i}" 
                                    style="width:100%; padding:15px; margin-bottom:10px; font-size:1.1rem;"
                                    ${disabled ? 'disabled' : ''}>
                                ${disabled ? 'НАСТРОИТЬ' : 'ВЫБРАТЬ КАМЕРУ'}
                            </button>
                            <div class="camera-status-badge ${statusClass}" 
                                 style="padding:8px 12px; border-radius:5px; font-size:0.9rem; margin-bottom:8px;">
                                ${statusText}
                            </div>
                            <div style="color:#666; font-size:0.8rem; min-height:20px;">
                                ${statusDetails}
                            </div>
                        </div>
                    `;
                }).join('')}
            </div>
            <div style="text-align:center; margin:25px 0; color:#0f0; font-size:1.1rem;">
                <i class="fas fa-info-circle"></i> Используйте цифры 1-4 для быстрого выбора
            </div>
        `;
        
        inputsContainer.insertBefore(cameraButtons, inputsContainer.firstChild);
        
        setTimeout(() => {
            const buttons = cameraButtons.querySelectorAll('.camera-select-btn');
            buttons.forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const cameraId = parseInt(e.target.closest('button').dataset.camera);
                    this.selectCamera(cameraId);
                });
            });
        }, 100);
    }
    
    updateAdminPanel() {
        const adminData = localStorage.getItem('fnaf_admin_data');
        if (adminData) {
            try {
                const data = JSON.parse(adminData);
                data.gameState = this.gameState;
                data.timestamp = Date.now();
                localStorage.setItem('fnaf_admin_data', JSON.stringify(data));
            } catch (e) {
                console.error('Ошибка обновления админ-панели:', e);
            }
        }
    }
    
    closeCameraInterface() {
        this.gameState.cameraOpen = false;
        if (this.domElements.cameraInterface) {
            this.domElements.cameraInterface.classList.remove('active');
        }
    }
    
    selectCamera(cameraId) {
        if (this.gameState.systemError || !this.gameState.isGameActive) {
            if (this.gameState.systemError) {
                this.showNotification('Системная ошибка! Восстановите питание сначала.', 'warning');
            }
            return;
        }
        
        const camera = this.gameState.cameras[cameraId];
        if (!camera) {
            this.showNotification(`Камера ${cameraId} не найдена!`, 'warning');
            return;
        }
        
        if (!camera.link || camera.link.trim() === '') {
            this.showNotification(
                `Камера ${cameraId} не настроена!\n\n1. Откройте страницу камеры на устройстве\n2. Скопируйте ссылку\n3. Вставьте в поле "Камера ${cameraId}"`, 
                'warning'
            );
            
            setTimeout(() => {
                const input = document.getElementById(`camera${cameraId}Input`);
                if (input) {
                    input.focus();
                    input.style.animation = 'pulse-orange 2s infinite';
                }
            }, 100);
            
            return;
        }
        
        this.gameState.currentCamera = cameraId;
        this.showCameraFeed(cameraId);
        
        setTimeout(() => {
            this.closeCameraInterface();
        }, 500);
        
        this.saveState();
    }
    
    showCameraError(cameraId, message) {
        const msg = message || 'Ошибка камеры';
        if (this.domElements.cameraFeed && this.domElements.cameraPlaceholder) {
            this.domElements.cameraPlaceholder.style.display = 'none';
            this.domElements.cameraFeed.style.display = 'block';
            this.domElements.cameraFeed.innerHTML = `
                <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;min-height:240px;color:#f90;text-align:center;padding:24px;">
                    <i class="fas fa-exclamation-triangle" style="font-size:2.5rem;margin-bottom:12px;"></i>
                    <p style="font-size:1.1rem;">Камера ${cameraId}</p>
                    <p style="color:#888;margin-top:8px;">${msg}</p>
                </div>`;
        }
        this.showNotification(msg, 'warning');
    }

    showCameraFeed(cameraId) {
        const camera = this.gameState.cameras[cameraId];
        if (!this.domElements.cameraFeed || !this.domElements.cameraPlaceholder) {
            this.showNotification(`Камера ${cameraId}: добавьте блоки cameraFeed/cameraPlaceholder в разметку`, 'warning');
            return;
        }
        
        this.domElements.cameraFeed.innerHTML = '';
        this.domElements.cameraFeed.style.display = 'block';
        this.domElements.cameraPlaceholder.style.display = 'none';
        
        if (!camera || !camera.link) {
            this.showCameraError(cameraId, "Ссылка на камеру не настроена");
            return;
        }
        
        if (camera.broken) {
            this.showBrokenCamera(cameraId);
            return;
        }
        
        if (camera.repairing) {
            this.showRepairingCamera(cameraId);
            return;
        }
        
        this.showCameraScreenshotView(cameraId);
    }
    
    showCameraScreenshotView(cameraId) {
        const container = document.createElement('div');
        container.className = 'camera-screenshot-view';
        container.style.width = '100%';
        container.style.height = '100%';
        container.style.position = 'relative';
        container.style.background = '#000';
        container.style.overflow = 'hidden';
        
        const screenshot = localStorage.getItem(`fnaf_camera_${cameraId}_screenshot`);
        const screenshotTime = localStorage.getItem(`fnaf_camera_${cameraId}_screenshot_time`);
        const hasFreshScreenshot = screenshot && screenshotTime && Date.now() - parseInt(screenshotTime) < 5000;
        
        if (hasFreshScreenshot) {
            container.innerHTML = `
                <img src="${screenshot}" 
                     alt="Камера ${cameraId}" 
                     style="width:100%; height:100%; object-fit:cover;">
                
                <div style="position:absolute; top:15px; left:15px; background:rgba(0,0,0,0.85); color:#0f0; padding:10px 15px; border-radius:5px; border:2px solid #0f0; font-size:0.9rem;">
                    <i class="fas fa-video" style="margin-right:8px;"></i> КАМЕРА ${cameraId} • LIVE
                </div>
                
                <div style="position:absolute; top:15px; right:15px; background:rgba(0,20,0,0.85); color:#0f0; padding:10px 15px; border-radius:5px; border:2px solid #0f0; font-size:0.9rem;">
                    <i class="fas fa-clock" style="margin-right:8px;"></i> 
                    <span id="screenshotTime">${new Date(parseInt(screenshotTime)).toLocaleTimeString()}</span>
                </div>
                
                <div style="position:absolute; bottom:15px; left:15px; background:rgba(0,20,0,0.85); color:#0f0; padding:10px 15px; border-radius:5px; border:2px solid #0f0; font-size:0.9rem; animation:pulse-green 2s infinite;">
                    <i class="fas fa-circle" style="color:#0f0; margin-right:8px;"></i> 
                    СВЯЗЬ УСТАНОВЛЕНА
                </div>
                
                <div style="position:absolute; bottom:15px; right:15px; display:flex; gap:10px;">
                    <button onclick="window.mainGame.openCameraPage(${cameraId})" 
                            class="btn" 
                            style="padding:8px 15px; background:rgba(0,20,0,0.9); border:2px solid #0f0; color:#0f0; font-size:0.9rem;">
                        <i class="fas fa-external-link-alt"></i> ОТКРЫТЬ
                    </button>
                    <button onclick="window.mainGame.refreshCameraView(${cameraId})" 
                            class="btn" 
                            style="padding:8px 15px; background:rgba(0,0,20,0.9); border:2px solid #0af; color:#0af; font-size:0.9rem;">
                        <i class="fas fa-sync-alt"></i>
                    </button>
                </div>
                
                <style>
                    @keyframes pulse-green {
                        0%, 100% { box-shadow: 0 0 5px #0f0; }
                        50% { box-shadow: 0 0 15px #0f0; }
                    }
                </style>
            `;
        } else {
            container.innerHTML = `
                <div style="display:flex; flex-direction:column; justify-content:center; align-items:center; height:100%; color:#0f0; text-align:center; padding:30px;">
                    <div style="margin-bottom:30px;">
                        <div style="width:80px; height:80px; border:4px solid #0f0; border-top:4px solid transparent; border-radius:50%; animation:spin 2s linear infinite;"></div>
                    </div>
                    
                    <h2 style="font-size:1.8rem; margin-bottom:15px; color:#0f0;">ОЖИДАНИЕ КАМЕРЫ ${cameraId}</h2>
                    
                    <p style="font-size:1.1rem; margin-bottom:25px; color:#0af; max-width:500px;">
                        Устройство-камера подключено. Ожидание передачи изображения...
                    </p>
                    
                    <div style="background:rgba(0,20,0,0.7); border:2px solid #0f0; border-radius:10px; padding:20px; margin-bottom:30px; max-width:500px;">
                        <h3 style="color:#0f0; margin-bottom:15px; font-size:1.2rem;">
                            <i class="fas fa-info-circle"></i> КАК ЭТО РАБОТАЕТ?
                        </h3>
                        <div style="text-align:left; color:#0af; line-height:1.6;">
                            1. Камера работает на отдельном устройстве<br>
                            2. Устройство передает снимки каждые 2 секунды<br>
                            3. Здесь отображается последний полученный снимок
                        </div>
                    </div>
                    
                    <div style="display:flex; gap:20px; margin-top:20px;">
                        <button onclick="window.mainGame.openCameraPage(${cameraId})" 
                                class="btn" 
                                style="padding:12px 25px; background:#0a0; border:3px solid #0f0; color:#000; font-size:1rem;">
                            <i class="fas fa-external-link-alt"></i> ОТКРЫТЬ КАМЕРУ
                        </button>
                        <button onclick="window.mainGame.refreshCameraView(${cameraId})" 
                                class="btn" 
                                style="padding:12px 25px; background:#222; border:3px solid #0f0; color:#0f0; font-size:1rem;">
                            <i class="fas fa-redo"></i> ОБНОВИТЬ
                        </button>
                    </div>
                    
                    <style>
                        @keyframes spin {
                            0% { transform: rotate(0deg); }
                            100% { transform: rotate(360deg); }
                        }
                    </style>
                </div>
            `;
        }
        
        this.domElements.cameraFeed.appendChild(container);
        this.startCameraAutoRefresh(cameraId);
    }
    
    showBrokenCamera(cameraId) {
        const camera = this.gameState.cameras[cameraId];
        this.domElements.cameraFeed.innerHTML = `
            <div style="display:flex; flex-direction:column; justify-content:center; align-items:center; height:100%; color:#ff0000; background:#200; text-align:center; padding:30px;">
                <i class="fas fa-exclamation-triangle" style="font-size:4rem; margin-bottom:20px;"></i>
                <h2 style="font-size:2rem; margin-bottom:15px;">КАМЕРА ${cameraId} СЛОМАНА</h2>
                <p style="font-size:1.2rem; margin-bottom:25px; color:#ff9900;">Требуется ремонт</p>
                
                ${camera.repairing ? `
                    <div style="background:#330; padding:20px; border-radius:10px; border:2px solid #ff9900; margin-bottom:25px;">
                        <div style="font-size:1.5rem; color:#ff9900; margin-bottom:10px;">
                            <i class="fas fa-tools"></i> РЕМОНТ В ПРОЦЕССЕ
                        </div>
                        <div id="cameraRepairTimer" style="font-size:3rem; font-weight:bold; color:#0f0;">
                            ${camera.repairTime} СЕК
                        </div>
                        <div style="font-size:1rem; color:#666; margin-top:10px;">
                            Осталось до починки
                        </div>
                    </div>
                ` : `
                    <div style="background:#300; padding:20px; border-radius:10px; border:2px solid #ff0000; margin-bottom:25px;">
                        <div style="font-size:1.2rem; color:#fff; margin-bottom:15px;">
                            Для починки камеры:
                        </div>
                        <div style="text-align:left; color:#ff9900; margin-bottom:15px;">
                            1. Откройте страницу камеры ${cameraId}<br>
                            2. Нажмите "ПОЧИНИТЬ КАМЕРУ"<br>
                            3. Или почините из админ-панели
                        </div>
                    </div>
                `}
                
                <button onclick="window.mainGame.openCameraPage(${cameraId})" class="btn" style="padding:15px 30px; background:#330; border:3px solid #ff9900; color:#ff9900; font-size:1.2rem;">
                    <i class="fas fa-tools"></i> ОТКРЫТЬ ДЛЯ РЕМОНТА
                </button>
            </div>
        `;
    }
    
    showRepairingCamera(cameraId) {
        const camera = this.gameState.cameras[cameraId];
        this.domElements.cameraFeed.innerHTML = `
            <div style="display:flex; flex-direction:column; justify-content:center; align-items:center; height:100%; color:#ff9900; background:#330; text-align:center; padding:30px;">
                <i class="fas fa-tools" style="font-size:4rem; margin-bottom:20px; animation:spin 2s linear infinite;"></i>
                <h2 style="font-size:2rem; margin-bottom:15px;">РЕМОНТ КАМЕРЫ ${cameraId}</h2>
                <p style="font-size:1.2rem; margin-bottom:25px;">Камера находится в процессе починки</p>
                
                <div style="font-size:4rem; font-weight:bold; color:#0f0; margin:20px 0;">
                    ${camera.repairTime} СЕК
                </div>
                
                <div style="background:#000; padding:20px; border-radius:10px; border:2px solid #ff9900; margin-top:20px;">
                    <p style="color:#ff9900;">Камера будет автоматически восстановлена через указанное время</p>
                </div>
                
                <style>
                    @keyframes spin {
                        0% { transform: rotate(0deg); }
                        100% { transform: rotate(360deg); }
                    }
                </style>
            </div>
        `;
    }
    
    openCameraPage(cameraId) {
        const camera = this.gameState.cameras[cameraId];
        if (camera && camera.link) {
            window.open(camera.link, '_blank');
        } else {
            this.showNotification(`Камера ${cameraId} не настроена!`, 'warning');
        }
    }
    
    refreshCameraView(cameraId) {
        const screenshot = localStorage.getItem(`fnaf_camera_${cameraId}_screenshot`);
        const screenshotTime = localStorage.getItem(`fnaf_camera_${cameraId}_screenshot_time`);
        
        if (screenshot && screenshotTime && Date.now() - parseInt(screenshotTime) < 5000) {
            this.selectCamera(cameraId);
            this.showNotification(`Камера ${cameraId}: получен свежий снимок`, 'success');
        } else {
            this.showNotification(`Камера ${cameraId}: ожидание данных...`, 'warning');
        }
    }
    
    startCameraAutoRefresh(cameraId) {
        if (this.cameraRefreshTimers && this.cameraRefreshTimers[cameraId]) {
            clearInterval(this.cameraRefreshTimers[cameraId]);
        }
        
        this.cameraRefreshTimers = this.cameraRefreshTimers || {};
        this.cameraRefreshTimers[cameraId] = setInterval(() => {
            if (this.gameState.currentCamera === cameraId) {
                this.refreshCameraView(cameraId);
            }
        }, 3000);
    }
    
    showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = 'notification';
        notification.style.position = 'fixed';
        notification.style.top = '20px';
        notification.style.right = '20px';
        notification.style.padding = '15px 20px';
        notification.style.borderRadius = '5px';
        notification.style.zIndex = '9999';
        notification.style.fontSize = '0.9rem';
        notification.style.maxWidth = '300px';
        notification.style.boxShadow = '0 0 10px rgba(0,0,0,0.5)';
        
        if (type === 'success') {
            notification.style.background = 'rgba(0, 50, 0, 0.9)';
            notification.style.border = '2px solid #0f0';
            notification.style.color = '#0f0';
        } else if (type === 'warning') {
            notification.style.background = 'rgba(50, 30, 0, 0.9)';
            notification.style.border = '2px solid #ff9900';
            notification.style.color = '#ff9900';
        } else {
            notification.style.background = 'rgba(0, 0, 50, 0.9)';
            notification.style.border = '2px solid #0af';
            notification.style.color = '#0af';
        }
        
        notification.innerHTML = `
            <div style="display:flex; align-items:center; gap:10px;">
                <i class="fas fa-${type === 'success' ? 'check-circle' : type === 'warning' ? 'exclamation-triangle' : 'info-circle'}"></i>
                <div>${message}</div>
            </div>
        `;
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 3000);
    }
    
    switchNavMode(mode) {
        this.currentNavMode = mode;
        this.updateNavDisplay();
        this.updateUI();
    }
    
    updateNavDisplay() {
        if (this.currentNavMode === 'time') {
            this.domElements.navDisplay.innerHTML = `
                <div style="text-align:center;padding:20px;">
                    <i class="fas fa-clock" style="font-size:2rem;color:#0f0;margin-bottom:10px;"></i>
                    <div style="font-size:1.8rem;font-weight:bold;">${this.gameState.time}</div>
                    <div style="font-size:1rem;color:#666;margin-top:5px;">Текущее время</div>
                </div>
            `;
        } else {
            this.domElements.navDisplay.innerHTML = `
                <div style="text-align:center;padding:20px;">
                    <i class="fas fa-bolt" style="font-size:2rem;color:#0f0;margin-bottom:10px;"></i>
                    <div style="font-size:1.8rem;font-weight:bold;">${this.gameState.energy}%</div>
                    <div style="font-size:1rem;color:#666;margin-top:5px;">Уровень энергии</div>
                </div>
            `;
        }
    }
    
    requestRestart() {
        if (!this.gameState.systemError) return;
        if (this.gameState.systemRestarting) return;
        
        this.gameState.systemRestarting = true;
        this.gameState.restartTimer = 30;
        
        this.sendRestartRequestToAdmin();
        this.updateSystemError();
        this.startRestartTimer();
        
        this.showNotification('Запрос на перезапуск отправлен админу!', 'info');
    }
    
    sendRestartRequestToAdmin() {
        try {
            const gameState = {
                ...JSON.parse(localStorage.getItem('fnaf_game_state') || '{}'),
                ...this.gameState,
                systemError: true,
                systemRestarting: true,
                restartTimer: 30,
                restartRequested: true,
                restartRequestTime: Date.now(),
                timestamp: Date.now()
            };
            localStorage.setItem('fnaf_game_state', JSON.stringify(gameState));
            
            // Также сохраняем в fnaf_admin_data для мгновенного уведомления
            let adminData = JSON.parse(localStorage.getItem('fnaf_admin_data') || '{}');
            if (!adminData.gameState) {
                adminData.gameState = {};
            }
            
            adminData.gameState.systemError = true;
            adminData.gameState.systemRestarting = true;
            adminData.gameState.restartTimer = 30;
            adminData.gameState.restartRequested = true;
            adminData.gameState.restartRequestTime = Date.now();
            adminData.timestamp = Date.now();
            
            localStorage.setItem('fnaf_admin_data', JSON.stringify(adminData));
            
            console.log('✓ Запрос на перезапуск отправлен админу');
            
        } catch (e) {
            console.error('Ошибка отправки запроса админу:', e);
        }
    }
    
    startRestartTimer() {
        if (this.restartTimerInterval) {
            clearInterval(this.restartTimerInterval);
        }
        
        this.restartTimerInterval = setInterval(() => {
            // Проверяем, одобрил ли админ перезапуск
            const gameState = JSON.parse(localStorage.getItem('fnaf_game_state') || '{}');
            if (gameState.restartApproved) {
                console.log('✓ Админ одобрил перезапуск!');
                clearInterval(this.restartTimerInterval);
                
                // Очищаем флаги
                this.gameState.systemError = false;
                this.gameState.systemRestarting = false;
                gameState.systemError = false;
                gameState.systemRestarting = false;
                delete gameState.restartApproved;
                localStorage.setItem('fnaf_game_state', JSON.stringify(gameState));
                
                this.saveState();
                this.updateUI();
                this.showNotification('✓ Система перезапущена! Электричество восстановлено!', 'success');
                return;
            }
            
            if (!this.gameState.systemError || !this.gameState.systemRestarting) {
                clearInterval(this.restartTimerInterval);
                return;
            }
            
            this.gameState.restartTimer--;
            if (this.domElements.systemRestartTimer) {
                this.domElements.systemRestartTimer.textContent = this.gameState.restartTimer;
            }
            
            this.updateRestartTimerInAdmin();
            
            if (this.gameState.restartTimer <= 0) {
                clearInterval(this.restartTimerInterval);
                console.log('✗ Время истекло - GAME OVER');
                this.triggerGameOver();
            }
            
            this.saveState();
        }, 1000);
    }
    
    updateRestartTimerInAdmin() {
        try {
            let adminData = JSON.parse(localStorage.getItem('fnaf_admin_data') || '{}');
            
            if (adminData.gameState && adminData.gameState.systemRestarting) {
                adminData.gameState.restartTimer = this.gameState.restartTimer;
                adminData.timestamp = Date.now();
                localStorage.setItem('fnaf_admin_data', JSON.stringify(adminData));
            }
        } catch (e) {
            console.error('Ошибка обновления таймера в админ-панели:', e);
        }
    }
    
    triggerGameOver() {
        this.gameState.isGameActive = false;
        if (this.domElements.gameOver) {
            this.domElements.gameOver.classList.add('active');
        }
        if (this.domElements.animatronic) {
            this.domElements.animatronic.classList.add('active');
            setTimeout(() => {
                this.domElements.animatronic.classList.remove('active');
            }, 2000);
        }
        this.saveState();
    }
    
    finishVictoryScreen() {
        if (this._victoryEndTimer) {
            clearTimeout(this._victoryEndTimer);
            this._victoryEndTimer = null;
        }
        const victoryScreen = this.domElements.victoryScreen || document.getElementById('victoryScreen');
        const video = document.getElementById('victoryVideo');
        if (video) {
            video.pause();
            video.removeAttribute('src');
            video.load();
        }
        if (victoryScreen) {
            victoryScreen.classList.remove('active');
            victoryScreen.style.display = 'none';
        }
        if (this.gameState.isGameActive) {
            this.showGameScreen();
        } else {
            this.showWaitingScreen(true);
        }
        this.gameState.victory = false;
        this.saveState();
        const gs = JSON.parse(localStorage.getItem('fnaf_game_state') || '{}');
        gs.victory = false;
        localStorage.setItem('fnaf_game_state', JSON.stringify(gs));
    }

    showVictory() {
        try {
            const victoryScreen = this.domElements.victoryScreen || document.getElementById('victoryScreen');
            if (!victoryScreen) return;

            if (this.domElements.gameScreen) {
                this.domElements.gameScreen.classList.remove('active');
            }

            victoryScreen.classList.add('active');
            victoryScreen.style.display = 'flex';
            victoryScreen.style.zIndex = '9999';

            const video = document.getElementById('victoryVideo');
            if (video) {
                video.src = MainGame.VICTORY_VIDEO_SRC;
                video.load();
                const playAttempt = () => {
                    video.play().catch(() => {
                        this.showNotification('Нажмите на видео для воспроизведения (ограничение браузера)', 'info');
                    });
                };
                video.onended = () => this.finishVictoryScreen();
                video.onerror = () => {
                    this.showNotification('Не найден файл видео в папке media (см. инструкцию)', 'warning');
                    this._victoryEndTimer = setTimeout(() => this.finishVictoryScreen(), 8000);
                };
                playAttempt();
            } else {
                this._victoryEndTimer = setTimeout(() => this.finishVictoryScreen(), 10000);
            }

            const skip = document.getElementById('victorySkipBtn');
            if (skip) {
                skip.onclick = () => this.finishVictoryScreen();
            }
        } catch (e) {
            console.error('Ошибка показа победы:', e);
            this.gameState.victory = false;
        }
    }
    
    restartGame() {
        const videoCallLinks = this.gameState.videoCallLinks;
        const cameras = JSON.parse(JSON.stringify(this.gameState.cameras));
        const cameraDevices = JSON.parse(JSON.stringify(this.gameState.cameraDevices));
        
        this.gameState = {
            isWaitingScreenActive: true,
            isGameActive: false,
            isAdminConnected: this.gameState.isAdminConnected,
            adminId: this.gameState.adminId,
            time: '12:00 AM',
            energy: 100,
            currentCall: null,
            currentCamera: null,
            cameraOpen: false,
            cameras,
            cameraDevices,
            videoCalls: {
                1: { 
                    id: 1, 
                    link: videoCallLinks[1]?.link || '', 
                    type: videoCallLinks[1]?.type || 'telegram',
                    callerName: videoCallLinks[1]?.callerName || 'Звонок 1',
                    broken: false, 
                    repairing: false, 
                    repairTime: 0 
                },
                2: { 
                    id: 2, 
                    link: videoCallLinks[2]?.link || '', 
                    type: videoCallLinks[2]?.type || 'viber',
                    callerName: videoCallLinks[2]?.callerName || 'Звонок 2',
                    broken: false, 
                    repairing: false, 
                    repairTime: 0 
                },
                3: { 
                    id: 3, 
                    link: videoCallLinks[3]?.link || '', 
                    type: videoCallLinks[3]?.type || 'google-meet',
                    callerName: videoCallLinks[3]?.callerName || 'Звонок 3',
                    broken: false, 
                    repairing: false, 
                    repairTime: 0 
                },
                4: { 
                    id: 4, 
                    link: videoCallLinks[4]?.link || '', 
                    type: videoCallLinks[4]?.type || 'telegram',
                    callerName: videoCallLinks[4]?.callerName || 'Звонок 4',
                    broken: false, 
                    repairing: false, 
                    repairTime: 0 
                }
            },
            videoCallLinks: videoCallLinks,
            indicators: { green: false, orange: false, red: false },
            systemError: false,
            systemRestarting: false,
            restartTimer: 30,
            connectionLink: this.gameState.connectionLink,
            victory: false
        };
        
        if (this.domElements.gameOver) this.domElements.gameOver.classList.remove('active');
        if (this.domElements.systemError) this.domElements.systemError.classList.remove('active');
        this.showWaitingScreen(true);
        
        this.domElements.videoCallsGrid.innerHTML = '';
        this.updateCallStatuses();
        this.saveState();
    }
    
    updateUI() {
        if (this.domElements.timeDisplay) {
            this.domElements.timeDisplay.textContent = this.gameState.time;
        }
        if (this.domElements.currentTimeDisplay) {
            this.domElements.currentTimeDisplay.textContent = this.gameState.time;
        }
        if (this.domElements.energyDisplay) {
            this.domElements.energyDisplay.textContent = `${this.gameState.energy}%`;
        }
        if (this.domElements.energyLevel) {
            this.domElements.energyLevel.style.width = `${this.gameState.energy}%`;
            if (this.gameState.energy > 50) {
                this.domElements.energyLevel.style.background = 'linear-gradient(90deg, #0f0, #0a0)';
            } else if (this.gameState.energy > 20) {
                this.domElements.energyLevel.style.background = 'linear-gradient(90deg, #ff9900, #cc6600)';
            } else {
                this.domElements.energyLevel.style.background = 'linear-gradient(90deg, #ff0000, #cc0000)';
            }
        }
        
        this.updateIndicators();
        this.updateSystemError();
        
        if (this.domElements.adminConnected) {
            this.domElements.adminConnected.style.display = this.gameState.isAdminConnected ? 'flex' : 'none';
        }
    }
    
    updateIndicators() {
        const indicators = ['green', 'orange', 'red'];
        
        indicators.forEach(color => {
            const active = this.gameState.indicators[color];
            
            const waitingIndicator = this.domElements[`waiting${color.charAt(0).toUpperCase() + color.slice(1)}`];
            if (waitingIndicator) {
                waitingIndicator.classList.toggle('active', active);
            }
            
            const gameIndicator = this.domElements[`game${color.charAt(0).toUpperCase() + color.slice(1)}Indicator`];
            if (gameIndicator) {
                gameIndicator.classList.toggle('active', active);
            }
            
            const adminIndicator = this.domElements[`admin${color.charAt(0).toUpperCase() + color.slice(1)}Indicator`];
            if (adminIndicator) {
                adminIndicator.classList.toggle('active', active);
            }
        });
    }
    
    getCallDemoVisualHTML(type, callerName) {
        const name = this.escapeHtml(callerName || 'Входящий вызов');
        const gradients = {
            telegram: 'linear-gradient(165deg,#2AABEE 0%,#229ED9 45%,#1a8cc4 100%)',
            viber: 'linear-gradient(165deg,#7360f2 0%,#5b4bd1 100%)',
            'google-meet': 'linear-gradient(165deg,#1a73e8 0%,#174ea6 55%,#202124 100%)',
            whatsapp: 'linear-gradient(165deg,#25D366 0%,#128C7E 100%)'
        };
        const bg = gradients[type] || 'linear-gradient(165deg,#2a2a3a 0%,#111 100%)';
        return `
            <div class="call-demo-mock" style="background:${bg};">
                <div class="call-demo-topbar">
                    <span class="call-demo-dot"></span><span class="call-demo-dot"></span><span class="call-demo-dot"></span>
                </div>
                <div class="call-demo-avatar" aria-hidden="true"></div>
                <div class="call-demo-name">${name}</div>
                <div class="call-demo-status">● демонстрация звонка</div>
                <p class="call-demo-hint">Кнопка «Открыть» ниже — настоящий звонок в Telegram / Viber / Meet и т.д.</p>
            </div>`;
    }

    updateVideoCallsDisplay() {
        if (!this.domElements.videoCallsGrid) return;
        
        this.domElements.videoCallsGrid.innerHTML = '';
        
        for (let i = 1; i <= 4; i++) {
            const call = this.gameState.videoCalls[i];
            const callWindow = document.createElement('div');
            callWindow.className = 'video-call-window';
            callWindow.dataset.callId = i;
            
            let callContent = '';
            let statusClass = 'call-active';
            let statusText = '🟢 АКТИВЕН';
            
            if (!call.link || call.link.trim() === '') {
                statusClass = 'call-offline';
                statusText = '⚫ БЕЗ ССЫЛКИ';
                callContent = `
                    <div class="call-placeholder">
                        <i class="fas fa-video-slash"></i>
                        <p>Видеовызов не настроен</p>
                    </div>
                `;
            } else if (call.broken) {
                statusClass = 'call-broken';
                statusText = '🔴 СЛОМАН';
                if (call.repairing) {
                    statusClass = 'call-repairing';
                    statusText = `🟡 РЕМОНТ ${call.repairTime}с`;
                    callContent = `
                        <div class="call-broken-display">
                            <i class="fas fa-tools"></i>
                            <p>В ремонте: ${call.repairTime} сек</p>
                        </div>
                    `;
                } else {
                    callContent = `
                        <div class="call-broken-display">
                            <i class="fas fa-exclamation-circle"></i>
                            <p>Требуется ремонт</p>
                        </div>
                    `;
                }
            } else {
                callContent = this.getCallDemoVisualHTML(call.type, call.callerName);
            }
            
            callWindow.innerHTML = `
                <div class="call-header">
                    <div class="call-info">
                        <span class="call-number">Звонок ${i}</span>
                        <span class="call-type ${call.type}">${this.getCallTypeIcon(call.type)}</span>
                    </div>
                    <div class="call-status ${statusClass}">${statusText}</div>
                </div>
                <div class="call-content">
                    ${callContent}
                </div>
                <div class="call-actions">
                    <button class="call-action-btn" onclick="window.mainGame.openCallPage(${i})">
                        <i class="fas fa-external-link-alt"></i> Открыть
                    </button>
                    ${call.broken && !call.repairing ? `
                        <button class="call-action-btn repair-btn" onclick="window.mainGame.startCallRepairFromUI(${i})">
                            <i class="fas fa-tools"></i> Починить
                        </button>
                    ` : ''}
                </div>
            `;
            
            this.domElements.videoCallsGrid.appendChild(callWindow);
        }
    }
    
    getCallTypeIcon(type) {
        const icons = {
            'telegram': '✈️ Telegram',
            'viber': '☎️ Viber',
            'google-meet': '👥 Google Meet',
            'whatsapp': '💬 WhatsApp'
        };
        return icons[type] || type;
    }
    
    openCallPage(callId) {
        const call = this.gameState.videoCalls[callId];
        if (call && call.link) {
            window.open(call.link, '_blank');
        } else {
            this.showNotification(`Видеовызов ${callId} не настроен!`, 'warning');
        }
    }
    
    startCallRepairFromUI(callId) {
        const call = this.gameState.videoCalls[callId];
        if (call && call.broken && !call.repairing) {
            call.repairing = true;
            call.repairTime = 30;
            call.timestamp = Date.now();
            this.saveState();
            this.pushVideoCallsToAdminStorage();
            this.updateCallStatuses();
            this.updateVideoCallsDisplay();
            this.showNotification(`Ремонт видеовызова ${callId} начат`, 'success');
        }
    }
    
    updateSystemError() {
        if (!this.domElements.systemError) return;
        if (this.gameState.systemError) {
            this.domElements.systemError.classList.add('active');
            if (this.domElements.systemRestartTimer) {
                this.domElements.systemRestartTimer.textContent = this.gameState.restartTimer;
            }
            if (this.domElements.restartBtn) {
                if (this.gameState.systemRestarting) {
                    this.domElements.restartBtn.disabled = true;
                    this.domElements.restartBtn.innerHTML = '<i class="fas fa-hourglass-half"></i> ОЖИДАНИЕ ПОДТВЕРЖДЕНИЯ';
                } else {
                    this.domElements.restartBtn.disabled = false;
                    this.domElements.restartBtn.innerHTML = '<i class="fas fa-power-off"></i> ПЕРЕЗАПУСК СИСТЕМЫ (ПРОБЕЛ)';
                }
            }
        } else {
            this.domElements.systemError.classList.remove('active');
            if (this.domElements.restartBtn) {
                this.domElements.restartBtn.disabled = false;
                this.domElements.restartBtn.innerHTML = '<i class="fas fa-power-off"></i> ПЕРЕЗАПУСК СИСТЕМЫ (ПРОБЕЛ)';
            }
        }
    }
    
    loadState() {
        const savedState = localStorage.getItem('fnaf_game_state');
        if (savedState) {
            const state = JSON.parse(savedState);
            
            this.gameState.isWaitingScreenActive = state.isWaitingScreenActive || false;
            this.gameState.isGameActive = state.isGameActive || false;
            this.gameState.isAdminConnected = state.isAdminConnected || false;
            this.gameState.adminId = state.adminId;
            this.gameState.time = state.time || '12:00 AM';
            this.gameState.energy = state.energy || 100;
            this.gameState.currentCamera = state.currentCamera;
            this.gameState.cameraOpen = state.cameraOpen || false;
            this.gameState.indicators = state.indicators || { green: false, orange: false, red: false };
            this.gameState.systemError = state.systemError || false;
            this.gameState.systemRestarting = state.systemRestarting || false;
            this.gameState.restartTimer = state.restartTimer || 30;
            this.gameState.victory = state.victory || false;
            
            if (state.videoCalls) {
                for (let i = 1; i <= 4; i++) {
                    if (state.videoCalls[i]) {
                        this.gameState.videoCalls[i] = {
                            ...this.gameState.videoCalls[i],
                            ...state.videoCalls[i]
                        };
                    }
                }
            }
            
            if (state.videoCallLinks) {
                this.gameState.videoCallLinks = state.videoCallLinks;
            }
            
            // Загружаем состояние камер
            if (state.cameras) {
                this.gameState.cameras = state.cameras;
            }
            if (state.cameraDevices) {
                this.applyCameraDevicesToCameras(state.cameraDevices);
            }
        }
        if (this.gameState.systemError && this.gameState.systemRestarting && !this.restartTimerInterval) {
            this.startRestartTimer();
        }
    }
    
    saveState() {
        localStorage.setItem('fnaf_game_state', JSON.stringify(this.gameState));
    }
    
    startConnectionPolling() {
        this.connectionInterval = setInterval(() => {
            const isAdminConnected = localStorage.getItem('fnaf_admin_connected') === 'true';
            const adminDataStr = localStorage.getItem('fnaf_admin_data');
            let adminData = null;
            let isFresh = false;

            if (adminDataStr) {
                try {
                    adminData = JSON.parse(adminDataStr);
                    // Увеличим время свежести до 5 секунд
                    isFresh = adminData.timestamp && Date.now() - adminData.timestamp < 8000;
                } catch (e) {
                    adminData = null;
                }
            }

            // Если нет флага подключения или данные свежие, считаем подключенным
            if (!isAdminConnected && !isFresh) {
                if (this.gameState.isAdminConnected) {
                    this.gameState.isAdminConnected = false;
                    this.gameState.adminId = null;
                    this.updateAdminConnectionIndicator();
                }
                return;
            }

            // Проверяем gameId только если он есть в данных
            if (adminData && adminData.gameId) {
                const savedGameId = localStorage.getItem('fnaf_game_id');
                if (savedGameId && adminData.gameId !== savedGameId) {
                    console.log('GameId не совпадает:', adminData.gameId, 'vs', savedGameId);
                    if (this.gameState.isAdminConnected) {
                        this.gameState.isAdminConnected = false;
                        this.gameState.adminId = null;
                        this.updateAdminConnectionIndicator();
                    }
                    return;
                }
            }

            if (!this.gameState.isAdminConnected) {
                this.gameState.isAdminConnected = true;
                this.gameState.adminId = adminData ? adminData.adminId : null;
                this.updateAdminConnectionIndicator();
                console.log('Админ подключен!');
            }

            if (adminData && adminData.gameState) {
                const remote = adminData.gameState;

                if (remote.isWaitingScreenActive !== undefined) {
                    this.gameState.isWaitingScreenActive = remote.isWaitingScreenActive;
                }

                if (remote.time) {
                    this.gameState.time = remote.time;
                }

                if (remote.energy !== undefined) {
                    this.gameState.energy = remote.energy;
                }

                if (remote.indicators) {
                    this.gameState.indicators = remote.indicators;
                }

                if (remote.videoCalls) {
                    for (let i = 1; i <= 4; i++) {
                        if (remote.videoCalls[i]) {
                            const r = remote.videoCalls[i];
                            const l = this.gameState.videoCalls[i];
                            const rts = r.timestamp || 0;
                            const lts = l.timestamp || 0;
                            if (rts >= lts) {
                                l.broken = !!r.broken;
                                l.repairing = !!r.repairing;
                                l.repairTime = r.repairTime || 0;
                                l.timestamp = rts;
                                if (r.link != null) l.link = r.link;
                                if (r.type) l.type = r.type;
                                if (r.callerName != null) l.callerName = r.callerName;
                            }
                        }
                    }
                    this.updateCallStatuses();
                    this.updateVideoCallsDisplay();
                }

                this.gameState.systemError = remote.systemError || false;
                this.gameState.systemRestarting = remote.systemRestarting || false;
                this.gameState.restartTimer = remote.restartTimer || 30;

                if (this.gameState.systemError && this.gameState.systemRestarting && !this.restartTimerInterval) {
                    this.startRestartTimer();
                }

                if (remote.victory && !this.gameState.victory) {
                    this.gameState.victory = true;
                    this.showVictory();
                }

                if (remote.triggerGameOver && this.gameState.isGameActive) {
                    this.triggerGameOver();
                }
                
                this.applyCameraDevicesToCameras(remote.cameraDevices);
            }

            // Всегда обновляем UI после синхронизации
            this.updateUI();
            this.updateNavDisplay();
            
            // Если админ подключился и игра не активна, показываем экран ожидания
            if (this.gameState.isAdminConnected && !this.gameState.isGameActive && !this.gameState.isWaitingScreenActive) {
                this.showWaitingScreen(true);
            }
        }, 500);
    }
    
    repairCurrentCall() {
        if (this.gameState.currentCall) {
            this.startCallRepairFromUI(this.gameState.currentCall);
        }
    }

    repairCurrentCamera() {
        this.showNotification('Камеры OBS: клавиши 1–4. Починка «камер» в смысле звонков — кнопка «Починить» под окном звонка.', 'info');
    }
    
    copyGameLink(element) {
        const link = element.textContent.trim();
        if (link && link !== 'Загрузка...' && link !== 'Ссылка не сгенерирована') {
            navigator.clipboard.writeText(link).then(() => {
                this.showNotification('Ссылка скопирована!', 'success');
            }).catch(err => {
                console.error('Ошибка копирования:', err);
                this.showNotification('Ошибка копирования', 'warning');
            });
        }
    }
}

// Инициализация игры - ОДИН РАЗ!
document.addEventListener('DOMContentLoaded', () => {
    window.mainGame = new MainGame();
});