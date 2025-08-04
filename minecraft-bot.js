const mineflayer = require('mineflayer');

class MinecraftBot {
    constructor(config) {
        this.config = config;
        this.bot = null;
        this.isRunning = false;
        this.isConnecting = false;
        this.isManualStop = false; // علامة للإيقاف اليدوي
        this.startTime = null;
        this.stats = { health: 0, food: 0, position: { x: 0, y: 0, z: 0 }, gameMode: 'Unknown', dimension: 'Unknown', ping: 0 };
        this.afkActions = ['look', 'jump', 'sneak'];
        this.afkIndex = 0;
        this.intervals = { afk: null, bed: null };
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        this.reconnectDelay = 5000;
        this.initialConnectionAttempts = 0; // عداد محاولات الاتصال الأولي
        this.maxInitialAttempts = 3; // الحد الأقصى للمحاولات الأولية
        console.log(`🤖 [${this.config.name}] Bot initialized`);
    }

    async start() {
        if (this.isRunning || this.isConnecting) throw new Error('البوت يعمل بالفعل أو في حالة اتصال');
        
        this.isConnecting = true;
        this.isManualStop = false; // إعادة تعيين علامة الإيقاف اليدوي
        this.initialConnectionAttempts++;
        
        console.log(`🔄 [${this.config.name}] Starting connection to ${this.config.ip}:${this.config.port} (Attempt ${this.initialConnectionAttempts}/${this.maxInitialAttempts})`);

        try {
            this.bot = mineflayer.createBot({
                host: this.config.ip, port: this.config.port, username: this.config.name,
                version: false, checkTimeoutInterval: 60000, keepAlive: true, respawn: true, hideErrors: false
            });

            await this.setupEventHandlers();
            await this.waitForConnection();
            
            this.isRunning = true;
            this.isConnecting = false;
            this.startTime = Date.now();
            this.reconnectAttempts = 0;
            this.initialConnectionAttempts = 0; // إعادة تعيين عداد المحاولات الأولية عند النجاح
            
            console.log(`✅ [${this.config.name}] Successfully connected and spawned`);
            this.startAntiAFK();
            this.startBedTimeChecker();
            
            return this.getDetailedStatus();
        } catch (error) {
            this.isConnecting = false;
            this.isRunning = false;
            console.error(`❌ [${this.config.name}] Connection failed (Attempt ${this.initialConnectionAttempts}/${this.maxInitialAttempts}):`, error.message);
            
            // محاولة إعادة الاتصال إذا لم نصل للحد الأقصى
            if (this.initialConnectionAttempts < this.maxInitialAttempts && !this.isManualStop) {
                console.log(`🔄 [${this.config.name}] Retrying connection in 3 seconds...`);
                await this.delay(3000);
                return await this.start(); // إعادة المحاولة
            } else {
                this.initialConnectionAttempts = 0; // إعادة تعيين العداد
                throw new Error(`فشل الاتصال بعد ${this.maxInitialAttempts} محاولات: ${error.message}`);
            }
        }
    }

    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    async setupEventHandlers() {
        return new Promise((resolve, reject) => {
            const events = {
                spawn: () => { console.log(`🌍 [${this.config.name}] Spawned`); this.updateStats(); resolve(); },
                error: (error) => this.isConnecting ? reject(error) : this.handleError(error),
                end: (reason) => this.handleDisconnect(reason),
                death: () => { console.log(`💀 [${this.config.name}] Died, respawning...`); setTimeout(() => this.bot?.respawn(), 2000); },
                kicked: (reason) => this.handleKick(reason),
                message: (message) => this.handleMessage(message.toString()),
                health: () => { this.updateStats(); if (this.bot.health <= 5) console.log(`⚠️ [${this.config.name}] Low health: ${this.bot.health}/20`); },
                food: () => { this.updateStats(); if (this.bot.food <= 5) console.log(`🍖 [${this.config.name}] Low food: ${this.bot.food}/20`); },
                move: () => { if (this.bot?.entity) this.stats.position = this.bot.entity.position; },
                login: () => console.log(`🌐 [${this.config.name}] TCP connection established`),
                game: () => { this.updateStats(); console.log(`🎮 [${this.config.name}] Game info updated`); }
            };

            Object.entries(events).forEach(([event, handler]) => {
                if (event === 'spawn' || event === 'error') this.bot.once(event, handler);
                else this.bot.on(event, handler);
            });

            setTimeout(() => { if (this.isConnecting) reject(new Error('Connection timeout')); }, 30000);
        });
    }

    async waitForConnection() {
        return new Promise((resolve, reject) => {
            if (this.bot.player) return resolve();
            
            const checkSpawn = () => {
                if (this.bot?.player) resolve();
                else setTimeout(checkSpawn, 500);
            };
            
            setTimeout(() => this.isConnecting ? reject(new Error('Spawn timeout')) : resolve(), 25000);
            checkSpawn();
        });
    }

    updateStats() {
        if (!this.bot) return;
        
        this.stats = {
            health: this.bot.health || 0,
            food: this.bot.food || 0,
            position: this.bot.entity ? {
                x: Math.round(this.bot.entity.position.x * 10) / 10,
                y: Math.round(this.bot.entity.position.y * 10) / 10,
                z: Math.round(this.bot.entity.position.z * 10) / 10
            } : { x: 0, y: 0, z: 0 },
            gameMode: this.getGameModeName(this.bot.game?.gameMode),
            dimension: this.getDimensionName(this.bot.game?.dimension),
            ping: this.bot.player?.ping || 0,
            level: this.bot.experience?.level || 0
        };
    }

    getGameModeName(mode) {
        const modes = { 0: 'Survival', 1: 'Creative', 2: 'Adventure', 3: 'Spectator' };
        return modes[mode] || 'Unknown';
    }

    getDimensionName(dimension) {
        if (typeof dimension === 'string') {
            if (dimension.includes('overworld')) return 'Overworld';
            if (dimension.includes('nether')) return 'Nether';
            if (dimension.includes('end')) return 'End';
        }
        return dimension || 'Unknown';
    }

    getDetailedStatus() {
        const uptime = this.startTime ? Math.floor((Date.now() - this.startTime) / 1000) : 0;
        return {
            name: this.config.name,
            server: `${this.config.ip}:${this.config.port}`,
            status: this.isRunning ? 'متصل' : 'غير متصل',
            uptime: this.formatUptime(uptime),
            stats: this.stats,
            connected: this.isRunning,
            reconnectAttempts: this.reconnectAttempts
        };
    }

    formatUptime(seconds) {
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = seconds % 60;
        return h > 0 ? `${h}س ${m}د ${s}ث` : m > 0 ? `${m}د ${s}ث` : `${s}ث`;
    }

    startAntiAFK() {
        if (this.intervals.afk) clearInterval(this.intervals.afk);
        
        this.intervals.afk = setInterval(() => {
            if (!this.bot || !this.isRunning || this.isManualStop) return;
            
            try {
                const action = this.afkActions[this.afkIndex % this.afkActions.length];
                const actions = {
                    look: () => this.bot.look(Math.random() * Math.PI * 2, (Math.random() - 0.5) * Math.PI),
                    jump: () => { this.bot.setControlState('jump', true); setTimeout(() => this.bot?.setControlState('jump', false), 500); },
                    sneak: () => { this.bot.setControlState('sneak', true); setTimeout(() => this.bot?.setControlState('sneak', false), 1000); }
                };
                
                actions[action]?.();
                this.afkIndex++;
                console.log(`🤖 [${this.config.name}] Anti-AFK: ${action}`);
            } catch (error) {
                console.error(`❌ [${this.config.name}] Anti-AFK error:`, error.message);
            }
        }, 30000);
    }

    startBedTimeChecker() {
        if (this.intervals.bed) clearInterval(this.intervals.bed);
        
        this.intervals.bed = setInterval(() => {
            if (!this.bot || !this.isRunning || this.isManualStop) return;
            
            try {
                const timeOfDay = this.bot.time?.timeOfDay || 0;
                const isNight = timeOfDay > 12000 && timeOfDay < 24000;
                if (isNight) this.tryToSleep();
            } catch (error) {
                console.error(`❌ [${this.config.name}] Bed checker error:`, error.message);
            }
        }, 10000);
    }

    async tryToSleep() {
        try {
            const bed = this.bot.findBlock({
                matching: (block) => block?.name?.includes('bed'),
                maxDistance: 16
            });

            if (bed) {
                console.log(`🛏️ [${this.config.name}] Found bed, sleeping...`);
                await this.bot.sleep(bed);
                console.log(`😴 [${this.config.name}] Went to sleep`);
            } else {
                this.sendMessage("Looking for a bed...");
            }
        } catch (error) {
            console.log(`💤 [${this.config.name}] Could not sleep: ${error.message}`);
        }
    }

    handleMessage(message) {
        console.log(`💬 [${this.config.name}] ${message}`);
        if (message.toLowerCase().includes('sleep') || message.includes('نوم')) {
            setTimeout(() => this.tryToSleep(), 2000);
        }
    }

    handleDisconnect(reason) {
        this.isRunning = false;
        this.cleanup();
        console.log(`🔌 [${this.config.name}] Disconnected: ${reason || 'Unknown'}`);
        
        // فقط إعادة الاتصال إذا لم يكن إيقاف يدوي
        if (!this.isManualStop && this.reconnectAttempts < this.maxReconnectAttempts) {
            this.scheduleReconnect();
        } else if (this.isManualStop) {
            console.log(`🛑 [${this.config.name}] Manual stop detected, no reconnection will be attempted`);
        } else {
            console.log(`💔 [${this.config.name}] Max reconnect attempts reached, giving up`);
        }
    }

    handleKick(reason) {
        console.log(`👢 [${this.config.name}] Kicked: ${reason}`);
        this.handleDisconnect(`Kicked: ${reason}`);
    }

    handleError(error) {
        console.error(`❌ [${this.config.name}] Error:`, error.message);
        if (error.message.includes('ENOTFOUND') || error.message.includes('ECONNREFUSED')) {
            this.handleDisconnect(`Connection error: ${error.message}`);
        }
    }

    scheduleReconnect() {
        if (this.isManualStop) {
            console.log(`🛑 [${this.config.name}] Manual stop detected, canceling reconnection`);
            return;
        }

        this.reconnectAttempts++;
        const delay = this.reconnectDelay * this.reconnectAttempts;
        
        console.log(`🔄 [${this.config.name}] Reconnecting in ${delay/1000}s (${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
        
        setTimeout(async () => {
            if (this.isManualStop) {
                console.log(`🛑 [${this.config.name}] Manual stop detected during reconnect, aborting`);
                return;
            }

            try {
                // إعادة تعيين عداد المحاولات الأولية لإعادة الاتصال
                this.initialConnectionAttempts = 0;
                await this.start();
            } catch (error) {
                console.error(`❌ [${this.config.name}] Reconnect failed:`, error.message);
                if (this.reconnectAttempts >= this.maxReconnectAttempts) {
                    console.log(`💔 [${this.config.name}] Max reconnect attempts reached`);
                } else if (!this.isManualStop) {
                    this.scheduleReconnect();
                }
            }
        }, delay);
    }

    sendMessage(message) {
        if (!this.bot || !this.isRunning || this.isManualStop) {
            console.log(`❌ [${this.config.name}] Cannot send message: bot not running`);
            return false;
        }

        try {
            this.bot.chat(message);
            console.log(`💬 [${this.config.name}] Sent: ${message}`);
            return true;
        } catch (error) {
            console.error(`❌ [${this.config.name}] Failed to send message:`, error.message);
            return false;
        }
    }

    cleanup() {
        Object.values(this.intervals).forEach(interval => {
            if (interval) clearInterval(interval);
        });
        this.intervals = { afk: null, bed: null };
    }

    stop() {
        console.log(`🛑 [${this.config.name}] Stopping bot...`);
        this.isRunning = false;
        this.isConnecting = false;
        this.isManualStop = true; // تعيين علامة الإيقاف اليدوي
        this.cleanup();
        
        if (this.bot) {
            try {
                this.bot.quit('Bot stopped by user');
                this.bot.end();
            } catch (error) {
                console.error(`❌ [${this.config.name}] Error during stop:`, error.message);
            }
            this.bot = null;
        }
        
        console.log(`✅ [${this.config.name}] Bot stopped successfully`);
    }

    destroy() {
        this.stop();
    }
}

module.exports = MinecraftBot;
