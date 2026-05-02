// Админ-панель
class AdminPanel {
    constructor() {
        this.gameState = {
            videoCalls: {
                1: { id: 1, link: '', type: 'telegram', broken: false, repairing: false, repairTime: 0, callerName: 'Звонок 1' },
                2: { id: 2, link: '', type: 'viber', broken: false, repairing: false, repairTime: 0, callerName: 'Звонок 2' },
                3: { id: 3, link: '', type: 'google-meet', broken: false, repairing: false, repairTime: 0, callerName: 'Звонок 3' },
                4: { id: 4, link: '', type: 'telegram', broken: false, repairing: false, repairTime: 0, callerName: 'Звонок 4' }
            },
            cameraDevices: {
                1: { id: '', number: 1, broken: false, repairing: false, repairTime: 0, isActive: false },
                2: { id: '', number: 2, broken: false, repairing: false, repairTime: 0, isActive: false },
                3: { id: '', number: 3, broken: false, repairing: false, repairTime: 0, isActive: false },
                4: { id: '', number: 4, broken: false, repairing: false, repairTime: 0, isActive: false }
            },
            indicators: { green: false, orange: false, red: false },
            isWaitingScreenActive: false,
            isGameActive: false,
            time: '12:00 AM',
            energy: 100,
            systemError: false,
            systemRestarting: false,
            restartTimer: 30,
            cameraOpen: false
        };
        
        this.connected = false;
        this.gameId = null;
        this.domElements = {};
        this.cameraLinks = {};
        this.cameraTimers = {};
        this.init();
    }
    
    init() {
        this.cacheDOM();
        this.bindEvents();
        this.updateUI();
        // this.autoConnect(); // Автоподключение отключено
        this.startPolling();
    }
    
    cacheDOM() {
        // Подключение
        this.domElements.gameLink = document.getElementById('gameLink');
        this.domElements.connectBtn = document.getElementById('connectBtn');
        this.domElements.connectionStatus = document.getElementById('connectionStatus');
        
        // Статус игры
        this.domElements.currentEnergy = document.getElementById('currentEnergy');
        this.domElements.energySlider = document.getElementById('energySlider');
        
        // Кнопки управления игрой
        this.domElements.enableWaiting = document.getElementById('enableWaiting');
        this.domElements.disableWaiting = document.getElementById('disableWaiting');
        this.domElements.decreaseEnergy = document.getElementById('decreaseEnergy');
        this.domElements.timeSelect = document.getElementById('timeSelect');
        this.domElements.setTime = document.getElementById('setTime');
        this.domElements.triggerGameOver = document.getElementById('triggerGameOver');
        this.domElements.resetGame = document.getElementById('resetGame');
        
        // Индикаторы
        this.domElements.greenIndicatorStatus = document.getElementById('greenIndicatorStatus');
        this.domElements.greenIndicatorText = document.getElementById('greenIndicatorText');
        this.domElements.toggleGreen = document.getElementById('toggleGreen');
        
        this.domElements.orangeIndicatorStatus = document.getElementById('orangeIndicatorStatus');
        this.domElements.orangeIndicatorText = document.getElementById('orangeIndicatorText');
        this.domElements.toggleOrange = document.getElementById('toggleOrange');
        
        this.domElements.redIndicatorStatus = document.getElementById('redIndicatorStatus');
        this.domElements.redIndicatorText = document.getElementById('redIndicatorText');
        this.domElements.toggleRed = document.getElementById('toggleRed');
        
        // Камеры
        this.domElements.cameraControls = document.getElementById('cameraControls');
        this.domElements.breakAllCameras = document.getElementById('breakAllCameras');
        this.domElements.repairAllCameras = document.getElementById('repairAllCameras');
        
        // Системные функции
        this.domElements.triggerSystemError = document.getElementById('triggerSystemError');
        this.domElements.fixSystemError = document.getElementById('fixSystemError');
        this.domElements.restartRequests = document.getElementById('restartRequests');
        
        // Ссылки на камеры
        this.domElements.generateLinks = document.getElementById('generateLinks');
        this.domElements.copyAllLinks = document.getElementById('copyAllLinks');
        this.domElements.cameraLinks = document.getElementById('cameraLinks');
        
        // Победа
        this.domElements.triggerVictory = document.getElementById('triggerVictory');
    }
    
    bindEvents() {
        // Подключение
        this.domElements.connectBtn.addEventListener('click', () => this.connectToGame());
        
        // Управление игрой
        this.domElements.enableWaiting.addEventListener('click', () => this.setWaitingScreen(true));
        this.domElements.disableWaiting.addEventListener('click', () => this.setWaitingScreen(false));
        this.domElements.decreaseEnergy.addEventListener('click', () => this.decreaseEnergy());
        this.domElements.setTime.addEventListener('click', () => this.setTime());
        this.domElements.triggerGameOver.addEventListener('click', () => this.triggerGameOver());
        this.domElements.resetGame.addEventListener('click', () => this.resetGame());
        
        // Индикаторы
        this.domElements.toggleGreen.addEventListener('click', () => this.toggleIndicator('green'));
        this.domElements.toggleOrange.addEventListener('click', () => this.toggleIndicator('orange'));
        this.domElements.toggleRed.addEventListener('click', () => this.toggleIndicator('red'));
        
        // Камеры
        this.domElements.breakAllCameras.addEventListener('click', () => this.breakAllVideoCalls());
        this.domElements.repairAllCameras.addEventListener('click', () => this.repairAllVideoCalls());
        
        // Системные функции
        this.domElements.triggerSystemError.addEventListener('click', () => this.triggerSystemError());
        this.domElements.fixSystemError.addEventListener('click', () => this.fixSystemError());
        
        // Ссылки на камеры
        this.domElements.generateLinks.addEventListener('click', () => this.generateCameraLinks());
        this.domElements.copyAllLinks.addEventListener('click', () => this.copyAllLinks());
        
        // Победа
        this.domElements.triggerVictory.addEventListener('click', () => this.triggerVictory());
        
        // Слайдер энергии
        this.domElements.energySlider.addEventListener('input', (e) => {
            this.domElements.currentEnergy.textContent = `${e.target.value}%`;
        });
        
        this.domElements.energySlider.addEventListener('change', (e) => {
            this.setEnergy(parseInt(e.target.value));
        });
    }
    
    connectToGame() {
        const link = this.domElements.gameLink.value.trim();
        let gameId = null;

        if (link) {
            const match = link.match(/[?&]connect=([A-Za-z0-9_-]+)/);
            if (match) {
                gameId = match[1];
            }
        }

        if (!gameId) {
            this.showStatus('Неверная ссылка. Используйте ссылку с главной страницы.', false);
            return;
        }

        const savedGameId = localStorage.getItem('fnaf_game_id');
        if (!savedGameId) {
            this.showStatus('Главная страница еще не сгенерировала игру. Обновите страницу игры.', false);
            return;
        }

        if (gameId !== savedGameId) {
            this.showStatus('Ссылка не соответствует текущей игре. Обновите страницу игры и используйте новую ссылку.', false);
            return;
        }

        this.gameId = gameId;
        this.connected = true;
        this.showStatus('Успешно подключено к игре!', true);

        localStorage.setItem('fnaf_admin_game_id', gameId);
        localStorage.setItem('fnaf_admin_connected', 'true');
        localStorage.setItem('fnaf_admin_data', JSON.stringify({
            gameId: gameId,
            adminId: 'admin_' + Date.now(),
            gameState: this.gameState,
            cameraLinks: this.cameraLinks,
            timestamp: Date.now()
        }));

        this.loadGameState();
    }
    
    showStatus(message, success) {
        this.domElements.connectionStatus.textContent = message;
        this.domElements.connectionStatus.className = `connection-status ${success ? 'status-connected' : 'status-disconnected'}`;
        this.domElements.connectionStatus.style.display = 'block';
        
        if (success) {
            setTimeout(() => {
                this.domElements.connectionStatus.style.display = 'none';
            }, 5000);
        }
    }
    
    loadGameState() {
        const savedState = localStorage.getItem('fnaf_game_state');
        if (savedState) {
            const state = JSON.parse(savedState);
            
            // Обновляем состояние
            if (state.videoCalls) {
                this.gameState.videoCalls = state.videoCalls;
            }
            if (state.indicators) {
                this.gameState.indicators = state.indicators;
            }
            if (state.isWaitingScreenActive !== undefined) {
                this.gameState.isWaitingScreenActive = state.isWaitingScreenActive;
            }
            if (state.isGameActive !== undefined) {
                this.gameState.isGameActive = state.isGameActive;
            }
            if (state.time) {
                this.gameState.time = state.time;
            }
            if (state.energy !== undefined) {
                this.gameState.energy = state.energy;
            }
            if (state.systemError !== undefined) {
                this.gameState.systemError = state.systemError;
            }
            if (state.systemRestarting !== undefined) {
                this.gameState.systemRestarting = state.systemRestarting;
            }
            if (state.restartTimer !== undefined) {
                this.gameState.restartTimer = state.restartTimer;
            }
            if (state.cameraOpen !== undefined) {
                this.gameState.cameraOpen = state.cameraOpen;
            }
            
            // Загружаем состояние камер (устройств)
            if (state.cameraDevices) {
                this.gameState.cameraDevices = state.cameraDevices;
            }
            
            this.updateUI();
        }
    }
    
    saveGameState() {
        if (!this.connected || !this.gameId) return;
        
        // Автоматически включаем оранжевый индикатор если камеры открыты
        if (this.gameState.cameraOpen && !this.gameState.indicators.orange) {
            this.gameState.indicators.orange = true;
        }
        
        const adminData = {
            gameId: this.gameId,
            adminId: 'admin_' + Date.now(),
            gameState: this.gameState,
            cameraLinks: this.cameraLinks,
            timestamp: Date.now()
        };
        
        localStorage.setItem('fnaf_admin_data', JSON.stringify(adminData));
        
        // Также сохраняем в fnaf_game_state (не затираем более свежий ремонт звонков со стороны игрока)
        let gameState = JSON.parse(localStorage.getItem('fnaf_game_state') || '{}');
        const prevCalls = gameState.videoCalls || {};
        const merged = { ...gameState, ...this.gameState, timestamp: Date.now() };
        if (merged.videoCalls && this.gameState.videoCalls) {
            for (let i = 1; i <= 4; i++) {
                const p = prevCalls[i];
                const a = this.gameState.videoCalls[i];
                if (p && a && (p.timestamp || 0) > (a.timestamp || 0)) {
                    merged.videoCalls[i] = { ...a, ...p };
                }
            }
        }
        localStorage.setItem('fnaf_game_state', JSON.stringify(merged));
    }
    
    updateUI() {
        // Энергия
        this.domElements.currentEnergy.textContent = `${this.gameState.energy}%`;
        this.domElements.energySlider.value = this.gameState.energy;
        
        // Индикаторы
        this.updateIndicator('green', this.gameState.indicators.green);
        this.updateIndicator('orange', this.gameState.indicators.orange);
        this.updateIndicator('red', this.gameState.indicators.red);
        
        // Видеовызовы
        this.updateCallControls();
        
        // Системные функции
        this.updateSystemControls();
        
        // Запросы на перезапуск
        this.updateRestartRequests();
    }
    
    updateIndicator(color, state) {
        const statusElement = this.domElements[`${color}IndicatorStatus`];
        const textElement = this.domElements[`${color}IndicatorText`];
        
        if (state) {
            statusElement.classList.add('active');
            textElement.textContent = 'Вкл';
            textElement.style.color = '#0f0';
        } else {
            statusElement.classList.remove('active');
            textElement.textContent = 'Выкл';
            textElement.style.color = '#666';
        }
    }
    
    updateCallControls() {
        this.domElements.cameraControls.innerHTML = '';
        
        for (let i = 1; i <= 4; i++) {
            const call = this.gameState.videoCalls[i];
            
            let statusText = 'Активен';
            let statusClass = 'status-online';
            
            if (call.broken) {
                if (call.repairing) {
                    statusText = `Ремонт: ${call.repairTime}с`;
                    statusClass = 'status-repairing';
                } else {
                    statusText = 'Сломан';
                    statusClass = 'status-offline';
                }
            } else if (!call.link) {
                statusText = 'Нет ссылки';
                statusClass = 'status-offline';
            }
            
            const callCard = document.createElement('div');
            callCard.className = 'camera-card';
            callCard.innerHTML = `
                <div class="camera-title">Звонок ${i} (${this.getCallTypeIcon(call.type)})</div>
                <div class="camera-status ${statusClass}">${statusText}</div>
                <div style="font-size:0.85rem; color:#0af; margin-bottom:10px;">${call.callerName}</div>
                <div style="margin-top:10px;">
                    <button class="btn-admin danger break-camera" data-camera="${i}" style="margin-bottom:5px; width:100%;">
                        <i class="fas fa-ban"></i> Разорвать звонок
                    </button>
                    <button class="btn-admin success repair-camera" data-camera="${i}" style="width:100%;">
                        <i class="fas fa-tools"></i> Восстановить
                    </button>
                </div>
            `;
            
            this.domElements.cameraControls.appendChild(callCard);
        }
        
        // Добавляем обработчики для кнопок
        document.querySelectorAll('.break-camera').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const callId = parseInt(e.target.closest('button').dataset.camera);
                this.breakVideoCall(callId);
            });
        });
        
        document.querySelectorAll('.repair-camera').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const callId = parseInt(e.target.closest('button').dataset.camera);
                this.repairVideoCall(callId);
            });
        });
    }
    
    getCallTypeIcon(type) {
        const icons = {
            'telegram': '📱 Telegram',
            'viber': '☎️ Viber',
            'google-meet': '👥 Google Meet',
            'whatsapp': '💬 WhatsApp'
        };
        return icons[type] || type;
    }
    
    updateSystemControls() {
        if (this.gameState.systemError) {
            this.domElements.triggerSystemError.disabled = true;
            this.domElements.fixSystemError.disabled = false;
        } else {
            this.domElements.triggerSystemError.disabled = false;
            this.domElements.fixSystemError.disabled = true;
        }
    }
    
    updateRestartRequests() {
        if (this.gameState.systemError && this.gameState.systemRestarting) {
            this.domElements.restartRequests.innerHTML = `
                <div class="restart-request-panel">
                    <div class="request-title">
                        <i class="fas fa-exclamation-circle"></i> ЗАПРОС НА ПЕРЕЗАПУСК СИСТЕМЫ
                    </div>
                    <div style="color:#fff; margin-bottom:15px; font-size:1.2rem;">
                        Игрок запросил перезапуск системы. Осталось времени: 
                        <span style="color:#ff9900; font-weight:bold;">${this.gameState.restartTimer}с</span>
                    </div>
                    <div class="control-row">
                        <button class="btn-admin success" id="approveRestart">
                            <i class="fas fa-check"></i> ОДОБРИТЬ ПЕРЕЗАПУСК
                        </button>
                        <button class="btn-admin danger" id="denyRestart">
                            <i class="fas fa-times"></i> ОТКЛОНИТЬ
                        </button>
                    </div>
                </div>
            `;
            
            document.getElementById('approveRestart')?.addEventListener('click', () => this.approveRestart());
            document.getElementById('denyRestart')?.addEventListener('click', () => this.denyRestart());
        } else {
            this.domElements.restartRequests.innerHTML = '<div style="color:#666; text-align:center; padding:20px; font-size:1.1rem;">Нет активных запросов на перезапуск системы</div>';
        }
    }
    
    generateCameraLinks() {
        let baseUrl = window.location.href.split('?')[0].split('#')[0];
        baseUrl = baseUrl.replace(/admin\.html$/i, '');
        
        for (let i = 1; i <= 4; i++) {
            const cameraId = `cam_${i}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            const cameraUrl = `${baseUrl}camera-device.html?cam=${i}&id=${cameraId}`;
            
            this.cameraLinks[i] = cameraUrl;
            this.gameState.cameraDevices[i].link = cameraUrl;
        }
        
        localStorage.setItem('fnaf_camera_links_data', JSON.stringify(this.cameraLinks));
        this.updateCameraLinksDisplay();
        this.saveGameState();
        
        alert('4 уникальные ссылки для камер сгенерированы! Скопируйте их и откройте на устройствах.');
    }
    
    updateCameraLinksDisplay() {
        let html = '';
        
        for (let i = 1; i <= 4; i++) {
            const link = this.cameraLinks[i];
            
            html += `
                <div class="camera-link-item">
                    <div class="link-label">
                        <i class="fas fa-video"></i> Камера ${i}:
                    </div>
                    <div class="link-value" id="cameraLink${i}">${link || 'Ссылка не сгенерирована'}</div>
                    <div class="link-buttons">
                        <button class="link-btn copy-link" data-link="${link}" data-camera="${i}">
                            <i class="fas fa-copy"></i> Копировать
                        </button>
                        <button class="link-btn open-link" data-link="${link}" ${!link ? 'disabled style="opacity:0.3;"' : ''}>
                            <i class="fas fa-external-link-alt"></i> Открыть
                        </button>
                    </div>
                </div>
            `;
        }
        
        this.domElements.cameraLinks.innerHTML = html || '<div style="color:#666; text-align:center; padding:20px;">Ссылки не сгенерированы. Нажмите "Сгенерировать 4 ссылки"</div>';
        
        document.querySelectorAll('.copy-link').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const link = e.target.closest('button').dataset.link;
                if (link) {
                    navigator.clipboard.writeText(link).then(() => {
                        alert('Ссылка скопирована в буфер обмена!');
                    });
                }
            });
        });
        
        document.querySelectorAll('.open-link').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const link = e.target.closest('button').dataset.link;
                if (link) {
                    window.open(link, '_blank');
                }
            });
        });
    }
    
    copyAllLinks() {
        let allLinks = '';
        let hasLinks = false;
        
        for (let i = 1; i <= 4; i++) {
            if (this.cameraLinks[i]) {
                allLinks += `Камера ${i}: ${this.cameraLinks[i]}\n\n`;
                hasLinks = true;
            }
        }
        
        if (hasLinks) {
            navigator.clipboard.writeText(allLinks).then(() => {
                alert('Все 4 ссылки скопированы в буфер обмена!');
            });
        } else {
            alert('Сначала сгенерируйте ссылки!');
        }
    }
    
    // Методы управления игрой
    setWaitingScreen(enabled) {
        if (!this.connected) return;
        
        this.gameState.isWaitingScreenActive = enabled;
        if (!enabled) {
            this.gameState.isGameActive = false;
        }
        this.saveGameState();
        this.updateUI();
    }
    
    setEnergy(value) {
        if (!this.connected) return;
        
        this.gameState.energy = Math.max(0, Math.min(100, value));
        this.saveGameState();
        this.updateUI();
    }
    
    decreaseEnergy() {
        this.setEnergy(this.gameState.energy - 1);
    }
    
    setTime() {
        if (!this.connected) return;
        
        const time = this.domElements.timeSelect.value;
        this.gameState.time = time;
        this.saveGameState();
        this.updateUI();
    }
    
    toggleIndicator(color) {
        if (!this.connected) return;
        
        this.gameState.indicators[color] = !this.gameState.indicators[color];
        this.saveGameState();
        this.updateUI();
    }
    
    breakVideoCall(callId) {
        if (!this.connected) return;
        
        const call = this.gameState.videoCalls[callId];
        if (!call || call.broken) return;
        
        call.broken = true;
        call.repairing = false;
        call.repairTime = 0;
        call.timestamp = Date.now();
        
        this.saveGameState();
        this.updateCallControls();
    }
    
    repairVideoCall(callId) {
        if (!this.connected) return;
        
        const call = this.gameState.videoCalls[callId];
        if (!call || !call.broken || call.repairing) return;
        
        call.repairing = true;
        call.repairTime = 30;
        call.timestamp = Date.now();
        
        this.saveGameState();
        
        const gameState = JSON.parse(localStorage.getItem('fnaf_game_state') || '{}');
        if (!gameState.videoCalls) gameState.videoCalls = {};
        if (!gameState.videoCalls[callId]) gameState.videoCalls[callId] = {};
        
        gameState.videoCalls[callId].broken = call.broken;
        gameState.videoCalls[callId].repairing = call.repairing;
        gameState.videoCalls[callId].repairTime = call.repairTime;
        gameState.videoCalls[callId].timestamp = call.timestamp;
        
        localStorage.setItem('fnaf_game_state', JSON.stringify(gameState));
        
        this.updateCallControls();
    }
    
    breakAllVideoCalls() {
        if (!this.connected) return;
        
        for (let i = 1; i <=4; i++) {
            this.gameState.videoCalls[i].broken = true;
            this.gameState.videoCalls[i].repairing = false;
            this.gameState.videoCalls[i].repairTime = 0;
            this.gameState.videoCalls[i].timestamp = Date.now();
        }
        
        this.saveGameState();
        this.updateCallControls();
    }
    
    repairAllVideoCalls() {
        if (!this.connected) return;
        
        for (let i = 1; i <= 4; i++) {
            if (this.gameState.videoCalls[i].broken && !this.gameState.videoCalls[i].repairing) {
                this.gameState.videoCalls[i].repairing = true;
                this.gameState.videoCalls[i].repairTime = 30;
                this.gameState.videoCalls[i].timestamp = Date.now();
            }
        }
        
        this.saveGameState();
        this.updateCallControls();
    }
    
    // Функции управления камерами/устройствами
    breakCameraDevice(deviceNumber) {
        if (!this.connected) return;
        
        const device = this.gameState.cameraDevices[deviceNumber];
        if (!device || device.broken) return;
        
        device.broken = true;
        device.repairing = false;
        device.repairTime = 0;
        device.isActive = false;
        
        this.saveGameState();
        this.updateUI();
    }
    
    repairCameraDevice(deviceNumber) {
        if (!this.connected) return;
        
        const device = this.gameState.cameraDevices[deviceNumber];
        if (!device || !device.broken || device.repairing) return;
        
        device.repairing = true;
        device.repairTime = 30;
        
        this.saveGameState();
        this.updateUI();
        this.startCameraDeviceRepairTimer(deviceNumber);
    }
    
    startCameraDeviceRepairTimer(deviceNumber) {
        if (this.cameraTimers[`device_${deviceNumber}`]) {
            clearInterval(this.cameraTimers[`device_${deviceNumber}`]);
        }
        
        this.cameraTimers[`device_${deviceNumber}`] = setInterval(() => {
            const device = this.gameState.cameraDevices[deviceNumber];
            if (!device || !device.repairing) {
                clearInterval(this.cameraTimers[`device_${deviceNumber}`]);
                return;
            }
            
            device.repairTime--;
            
            if (device.repairTime <= 0) {
                device.broken = false;
                device.repairing = false;
                clearInterval(this.cameraTimers[`device_${deviceNumber}`]);
            }
            
            this.saveGameState();
            this.updateUI();
        }, 1000);
    }
    
    triggerSystemError() {
        if (!this.connected) return;
        
        this.gameState.systemError = true;
        this.gameState.systemRestarting = false;
        this.gameState.restartTimer = 30;
        this.saveGameState();
        this.updateUI();
    }
    
    fixSystemError() {
        if (!this.connected) return;
        
        this.gameState.systemError = false;
        this.gameState.systemRestarting = false;
        this.saveGameState();
        this.updateUI();
    }
    
    approveRestart() {
        if (!this.connected) return;
        
        console.log('✓ Админ одобрил перезапуск - отправляем сигнал игроку');
        
        // Отправляем сигнал в fnaf_game_state
        const gameState = JSON.parse(localStorage.getItem('fnaf_game_state') || '{}');
        gameState.systemError = false;
        gameState.systemRestarting = false;
        gameState.restartApproved = true;
        gameState.timestamp = Date.now();
        localStorage.setItem('fnaf_game_state', JSON.stringify(gameState));
        
        // Также сохраняем в adminData
        this.gameState.systemError = false;
        this.gameState.systemRestarting = false;
        this.saveGameState();
        
        this.updateUI();
        console.log('✓ Сигнал об одобрении отправлен');
        alert('✓ Система перезапущена! Электричество восстановлено.');
    }
    
    denyRestart() {
        if (!this.connected) return;
        
        this.gameState.systemRestarting = false;
        this.saveGameState();
        this.updateUI();
    }
    
    triggerGameOver() {
        if (!this.connected) return;
        
        this.gameState.isGameActive = false;
        this.gameState.triggerGameOver = true;
        this.saveGameState();
        
        // Также напрямую записываем в fnaf_game_state
        let gameState = JSON.parse(localStorage.getItem('fnaf_game_state') || '{}');
        gameState.triggerGameOver = true;
        gameState.isGameActive = false;
        gameState.timestamp = Date.now();
        localStorage.setItem('fnaf_game_state', JSON.stringify(gameState));
        
        setTimeout(() => {
            delete this.gameState.triggerGameOver;
            this.saveGameState();
            
            // Также очищаем в fnaf_game_state
            gameState = JSON.parse(localStorage.getItem('fnaf_game_state') || '{}');
            delete gameState.triggerGameOver;
            gameState.timestamp = Date.now();
            localStorage.setItem('fnaf_game_state', JSON.stringify(gameState));
        }, 2000);
    }
    
    triggerVictory() {
        if (!this.connected) return;
        
        this.gameState.victory = true;
        this.gameState.isGameActive = false;
        this.saveGameState();
        
        // Убеждаемся, что флаг попадет в fnaf_game_state
        const gameState = JSON.parse(localStorage.getItem('fnaf_game_state') || '{}');
        gameState.victory = true;
        gameState.isGameActive = false;
        gameState.timestamp = Date.now();
        localStorage.setItem('fnaf_game_state', JSON.stringify(gameState));
        
        console.log('✓ Сигнал ПОБЕДЫ отправлен игроку');
        
        // Показываем анимацию победы
        const victoryAnimation = document.getElementById('victoryAnimation');
        if (victoryAnimation) {
            victoryAnimation.classList.add('active');
        }
        
        // Автоматически сбрасываем флаг через 12 секунд
        setTimeout(() => {
            this.gameState.victory = false;
            this.saveGameState();
            
            // Очищаем флаг также в fnaf_game_state
            const cleanGameState = JSON.parse(localStorage.getItem('fnaf_game_state') || '{}');
            cleanGameState.victory = false;
            localStorage.setItem('fnaf_game_state', JSON.stringify(cleanGameState));
            
            // Скрываем анимацию
            if (victoryAnimation) {
                victoryAnimation.classList.remove('active');
            }
        }, 12000);
    }
    
    resetGame() {
        if (!this.connected) return;
        
        this.gameState = {
            videoCalls: {
                1: { id: 1, link: '', type: 'telegram', broken: false, repairing: false, repairTime: 0, callerName: 'Звонок 1' },
                2: { id: 2, link: '', type: 'viber', broken: false, repairing: false, repairTime: 0, callerName: 'Звонок 2' },
                3: { id: 3, link: '', type: 'google-meet', broken: false, repairing: false, repairTime: 0, callerName: 'Звонок 3' },
                4: { id: 4, link: '', type: 'telegram', broken: false, repairing: false, repairTime: 0, callerName: 'Звонок 4' }
            },
            cameraDevices: {
                1: { id: '', number: 1, broken: false, repairing: false, repairTime: 0, isActive: false },
                2: { id: '', number: 2, broken: false, repairing: false, repairTime: 0, isActive: false },
                3: { id: '', number: 3, broken: false, repairing: false, repairTime: 0, isActive: false },
                4: { id: '', number: 4, broken: false, repairing: false, repairTime: 0, isActive: false }
            },
            indicators: { green: false, orange: false, red: false },
            isWaitingScreenActive: false,
            isGameActive: false,
            time: '12:00 AM',
            energy: 100,
            systemError: false,
            systemRestarting: false,
            restartTimer: 30,
            cameraOpen: false
        };
        
        this.saveGameState();
        this.updateUI();
        
        alert('Игра сброшена! Все видеовызовы восстановлены к начальным значениям.');
    }
    
// В методе startPolling добавьте:
// ДОБАВЬТЕ в метод startPolling:

// В методе startPolling в admin.js:
    startPolling() {
    setInterval(() => {
        // Если подключены, регулярно сохраняем состояние для игры
        if (this.connected && this.gameId) {
            this.saveGameState();
        }
        
        this.loadGameState();
        
        // Также загружаем состояние от видеовызовов
        const gameState = JSON.parse(localStorage.getItem('fnaf_game_state') || '{}');
        
        if (gameState.videoCalls) {
            let callsUpdated = false;
            
            for (let i = 1; i <= 4; i++) {
                if (gameState.videoCalls[i]) {
                    const remoteCall = gameState.videoCalls[i];
                    const localCall = this.gameState.videoCalls[i];
                    
                    // Свежие обновления ремонта со страницы игрока (до 12 с)
                    if (remoteCall.timestamp && Date.now() - remoteCall.timestamp < 12000) {
                        // Обновляем состояние вызова
                        localCall.broken = remoteCall.broken;
                        localCall.repairing = remoteCall.repairing;
                        localCall.repairTime = remoteCall.repairTime;
                        callsUpdated = true;
                    }
                }
            }
            
            if (callsUpdated) {
                this.updateCallControls();
            }
        }
        
        // ОНОВЛЕННОЕ ИСПРАВЛЕНИЕ: Проверяем запросы на перезапуск от игры
        // Проверяем ВСЕ флаги системной ошибки
        if (gameState.systemError !== undefined || gameState.systemRestarting !== undefined) {
            // Обновляем состояние системы
            this.gameState.systemError = gameState.systemError || false;
            this.gameState.systemRestarting = gameState.systemRestarting || false;
            this.gameState.restartTimer = gameState.restartTimer || 30;
            
            // Обновляем UI
            this.updateSystemControls();
            this.updateRestartRequests();
        }
        
        // Также проверяем админ-данные напрямую
        const adminData = JSON.parse(localStorage.getItem('fnaf_admin_data') || '{}');
        if (adminData.gameState) {
            // Обновляем систему
            if (adminData.gameState.systemError !== undefined) {
                this.gameState.systemError = adminData.gameState.systemError;
                this.gameState.systemRestarting = adminData.gameState.systemRestarting || false;
                this.gameState.restartTimer = adminData.gameState.restartTimer || 30;
                this.updateSystemControls();
                this.updateRestartRequests();
            }
            
            // Проверяем победу
            if (adminData.gameState.victory === true) {
                console.log('✓ Установлена победа');
            }
        }
        
    }, 1000);
}
// Добавьте метод в класс AdminPanel:
autoConnect() {
    // Проверяем сохраненное подключение
    const savedGameId = localStorage.getItem('fnaf_admin_game_id');
    const isConnected = localStorage.getItem('fnaf_admin_connected') === 'true';
    
    if (savedGameId && isConnected) {
        // Автоматически подключаемся
        this.gameId = savedGameId;
        this.connected = true;
        this.showStatus('Автоматически подключено к игре!', true);
        this.loadGameState();
        return;
    }
    
    // Если нет сохраненного подключения, пробуем подключиться напрямую
    const gameState = JSON.parse(localStorage.getItem('fnaf_game_state') || '{}');
    if (gameState && Object.keys(gameState).length > 0) {
        const gameId = localStorage.getItem('fnaf_game_id') || 'direct_connection';
        this.gameId = gameId;
        this.connected = true;
        this.showStatus('Подключено к игре напрямую!', true);
        localStorage.setItem('fnaf_admin_game_id', gameId);
        localStorage.setItem('fnaf_admin_connected', 'true');
        this.loadGameState();
    }
}
}

// Инициализация админ-панели
document.addEventListener('DOMContentLoaded', () => {
    window.adminPanel = new AdminPanel();
});



