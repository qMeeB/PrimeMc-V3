const mineflayer = require('mineflayer');

class MinecraftBot {
    constructor(config) {
        this.config = config;
        this.bot = null;
        this.isRunning = false;
        this.isConnecting = false;
        this.isManualStop = false;
        this.startTime = null;
        this.connectionStartTime = null;
        this.totalUptime = 0;
        this.connectionAttempts = 0;
        this.maxConnectionAttempts = 3; // محاولات الاتصال الأولي
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5; // محاولات إعادة الاتصال
        this.baseReconnectDelay = 5000;
        this.currentReconnectDelay = this.baseReconnectDelay;
        
        // إحصائيات محسنة
        this.stats = {
            health: 20,
            food: 20,
            position: { x: 0, y: 0, z: 0 },
            gameMode: 'Unknown',
            dimension: 'Unknown',
            ping: 0,
            level: 0,
            lastPingUpdate: 0,
            averagePing: 0,
            pingReadings: []
        };
        
        // نظام الحركة والأنشطة المطور
        this.activities = {
            afk: ['look', 'jump', 'sneak', 'walk', 'turn', 'hit'],
            movement: ['circle', 'square', 'random', 'back_forth'],
            combat: ['hit_air', 'block', 'critical_hit']
        };
        this.currentActivity = 0;
        this.movementPattern = 0;
        this.intervals = {
            afk: null,
            movement: null,
            combat: null,
            bedCheck: null,
            statsUpdate: null,
            healthCheck: null
        };
        
        // نظام إدارة الأخطاء المحسن
        this.errorCounts = new Map();
        this.ignoredErrors = [
            'chat format code', 'ChatMessage', 'explosion', 'partial packet',
            'Chunk size', 'Cannot read properties', 'unknown chat format',
            'fromNetwork', 'prismarine-chat', 'ChatMessage is not a constructor',
            'Cannot read property', 'TypeError: Cannot read properties of null'
        ];
        
        // نظام البحث عن السرير المطور
        this.bedSearchRadius = 32;
        this.lastBedSearch = 0;
        this.foundBeds = [];
        this.sleepAttempts = 0;
        this.maxSleepAttempts = 3;
        
        // نظام الحركة المتقدم
        this.walkingState = {
            isWalking: false,
            direction: 0,
            steps: 0,
            maxSteps: 10,
            currentPath: []
        };
        
        // نظام مراقبة الأداء
        this.performance = {
            lastResponseTime: Date.now(),
            lagSpikes: 0,
            totalMessages: 0,
            successfulActions: 0
        };
        
        // callback للإشعارات
        this.onNotification = config.onNotification || (() => {});
        
        console.log(`🤖 [${this.config.name}] Enhanced bot initialized`);
    }

    async start() {
        if (this.isRunning || this.isConnecting) {
            throw new Error('البوت يعمل بالفعل أو في حالة اتصال');
        }
        
        this.isConnecting = true;
        this.isManualStop = false;
        this.connectionAttempts++;
        this.connectionStartTime = Date.now();
        
        console.log(`🔄 [${this.config.name}] محاولة الاتصال ${this.connectionAttempts}/${this.maxConnectionAttempts}`);

        try {
            this.bot = mineflayer.createBot({
                host: this.config.ip,
                port: this.config.port,
                username: this.config.name,
                version: false,
                checkTimeoutInterval: 30000,
                keepAlive: true,
                respawn: true,
                hideErrors: true,
                skipValidation: true,
                auth: 'offline',
                chatLengthLimit: 256,
                defaultChatPatterns: false,
                physicsEnabled: true,
                loadInternalPlugins: false
            });

            await this.setupEnhancedHandlers();
            await this.waitForSpawn();
            
            this.isRunning = true;
            this.isConnecting = false;
            this.startTime = Date.now();
            this.connectionAttempts = 0;
            this.reconnectAttempts = 0;
            this.currentReconnectDelay = this.baseReconnectDelay;
            
            console.log(`✅ [${this.config.name}] اتصال ناجح في ${Date.now() - this.connectionStartTime}ms`);
            
            // بدء الأنشطة المحسنة
            this.startEnhancedActivities();
            
            return this.getDetailedStatus();
        } catch (error) {
            this.isConnecting = false;
            this.isRunning = false;
            
            console.error(`❌ [${this.config.name}] فشل الاتصال:`, error.message);
            
            if (this.connectionAttempts < this.maxConnectionAttempts && !this.isManualStop) {
                await this.delay(2000 * this.connectionAttempts);
                return await this.start();
            } else {
                this.connectionAttempts = 0;
                throw new Error(`فشل الاتصال نهائياً: ${error.message}`);
            }
        }
    }

    async setupEnhancedHandlers() {
        return new Promise((resolve, reject) => {
            const connectionTimeout = setTimeout(() => {
                if (this.isConnecting) {
                    reject(new Error('انتهت مهلة الاتصال'));
                }
            }, 25000);

            // معالج الأخطاء المحسن
            this.bot.on('error', (error) => {
                if (this.isConnecting) {
                    clearTimeout(connectionTimeout);
                    if (this.isFatalError(error)) {
                        reject(error);
                    } else {
                        console.warn(`⚠️ [${this.config.name}] تحذير الاتصال:`, error.message);
                    }
                } else {
                    this.handleError(error);
                }
            });

            // تجاهل أخطاء العميل
            this.bot._client.on('error', () => {});
            this.bot._client.on('end', () => {});

            // معالج الرسائل المحسن
            this.bot.on('messagestr', (message) => {
                this.handleMessage(message);
            });

            this.bot.on('message', (jsonMsg) => {
                try {
                    if (jsonMsg && typeof jsonMsg.toString === 'function') {
                        this.handleMessage(jsonMsg.toString());
                    }
                } catch (e) {}
            });

            // الأحداث الأساسية
            this.bot.once('spawn', () => {
                clearTimeout(connectionTimeout);
                console.log(`🌍 [${this.config.name}] تم الظهور في العالم`);
                this.updateStats();
                resolve();
            });

            this.bot.on('end', (reason) => {
                clearTimeout(connectionTimeout);
                this.handleDisconnect(reason);
            });

            this.bot.on('death', () => {
                console.log(`💀 [${this.config.name}] مات، جاري الإحياء...`);
                setTimeout(() => {
                    try {
                        if (this.bot && this.isRunning && !this.isManualStop) {
                            this.bot.respawn();
                        }
                    } catch (e) {}
                }, 1500);
            });

            this.bot.on('kicked', (reason) => {
                this.onNotification(`تم طرد البوت ${this.config.name}: ${reason}`, 'warning');
                this.handleKick(reason);
            });

            // مراقبة الصحة والطعام
            this.bot.on('health', () => {
                this.updateStats();
                if (this.bot.health <= 5) {
                    this.onNotification(`⚠️ ${this.config.name} صحة منخفضة: ${this.bot.health}/20`, 'warning');
                }
            });

            this.bot.on('food', () => {
                this.updateStats();
                if (this.bot.food <= 5) {
                    this.onNotification(`🍖 ${this.config.name} جوع شديد: ${this.bot.food}/20`, 'warning');
                }
            });

            // مراقبة الحركة والموقع
            this.bot.on('move', () => {
                this.updatePosition();
                this.performance.lastResponseTime = Date.now();
            });

            this.bot.on('physicTick', () => {
                this.updatePing();
            });

            // مراقبة تغيير اللعبة
            this.bot.on('game', () => {
                this.updateStats();
            });

            this.bot.on('login', () => {
                console.log(`🌐 [${this.config.name}] تم تسجيل الدخول`);
            });
        });
    }

    async waitForSpawn() {
        return new Promise((resolve, reject) => {
            if (this.bot && this.bot.player) {
                return resolve();
            }
            
            let attempts = 0;
            const maxAttempts = 40;
            
            const checkSpawn = () => {
                attempts++;
                if (this.bot?.player && this.bot?.entity) {
                    resolve();
                } else if (attempts >= maxAttempts) {
                    reject(new Error('انتهت مهلة انتظار الظهور'));
                } else {
                    setTimeout(checkSpawn, 500);
                }
            };
            
            setTimeout(checkSpawn, 1000);
        });
    }

    isFatalError(error) {
        const fatalErrors = ['ENOTFOUND', 'ECONNREFUSED', 'EHOSTUNREACH', 'ETIMEDOUT'];
        return fatalErrors.some(fatal => error.message.includes(fatal));
    }

    updateStats() {
        if (!this.bot || !this.bot.entity) return;
        
        try {
            this.stats = {
                ...this.stats,
                health: this.bot.health || 20,
                food: this.bot.food || 20,
                gameMode: this.getGameModeName(this.bot.game?.gameMode),
                dimension: this.getDimensionName(this.bot.game?.dimension),
                level: this.bot.experience?.level || 0
            };
        } catch (error) {
            console.warn(`⚠️ [${this.config.name}] خطأ في تحديث الإحصائيات:`, error.message);
        }
    }

    updatePosition() {
        if (!this.bot?.entity?.position) return;
        
        try {
            this.stats.position = {
                x: Math.round(this.bot.entity.position.x * 10) / 10,
                y: Math.round(this.bot.entity.position.y * 10) / 10,
                z: Math.round(this.bot.entity.position.z * 10) / 10
            };
        } catch (error) {}
    }

    updatePing() {
        try {
            if (this.bot?.player?.ping !== undefined) {
                const currentPing = this.bot.player.ping;
                
                // تحديث قراءات البينق
                this.stats.pingReadings.push(currentPing);
                if (this.stats.pingReadings.length > 20) {
                    this.stats.pingReadings.shift();
                }
                
                // حساب متوسط البينق
                this.stats.averagePing = Math.round(
                    this.stats.pingReadings.reduce((a, b) => a + b, 0) / this.stats.pingReadings.length
                );
                
                this.stats.ping = currentPing;
                this.stats.lastPingUpdate = Date.now();
                
                // تحديث قاعدة البيانات كل 30 ثانية
                if (Date.now() - this.stats.lastPingUpdate > 30000) {
                    if (this.config.onStatsUpdate) {
                        this.config.onStatsUpdate(this.config.id, { ping: this.stats.averagePing });
                    }
                }
            }
        } catch (error) {}
    }

    startEnhancedActivities() {
        // نشاط مكافحة AFK المحسن
        this.startAdvancedAntiAFK();
        
        // نشاط الحركة المتقدم
        this.startAdvancedMovement();
        
        // نشاط القتال الخفيف
        this.startLightCombat();
        
        // فحص وقت النوم
        this.startEnhancedBedCheck();
        
        // مراقبة الأداء
        this.startPerformanceMonitoring();
        
        // فحص الصحة الدوري
        this.startHealthMonitoring();
    }

    startAdvancedAntiAFK() {
        if (this.intervals.afk) clearInterval(this.intervals.afk);
        
        this.intervals.afk = setInterval(() => {
            if (!this.isRunning || this.isManualStop || !this.bot) return;
            
            try {
                const activity = this.activities.afk[this.currentActivity % this.activities.afk.length];
                this.performActivity(activity);
                this.currentActivity++;
                this.performance.successfulActions++;
            } catch (error) {
                this.handleActivityError('afk', error);
            }
        }, 20000 + Math.random() * 10000); // 20-30 ثانية
    }

    startAdvancedMovement() {
        if (this.intervals.movement) clearInterval(this.intervals.movement);
        
        this.intervals.movement = setInterval(() => {
            if (!this.isRunning || this.isManualStop || !this.bot) return;
            
            try {
                const pattern = this.activities.movement[this.movementPattern % this.activities.movement.length];
                this.performMovementPattern(pattern);
                this.movementPattern++;
            } catch (error) {
                this.handleActivityError('movement', error);
            }
        }, 35000 + Math.random() * 15000); // 35-50 ثانية
    }

    startLightCombat() {
        if (this.intervals.combat) clearInterval(this.intervals.combat);
        
        this.intervals.combat = setInterval(() => {
            if (!this.isRunning || this.isManualStop || !this.bot) return;
            
            try {
                // ضرب خفيف في الهواء أحياناً
                if (Math.random() < 0.3) { // 30% احتمال
                    const combatAction = this.activities.combat[Math.floor(Math.random() * this.activities.combat.length)];
                    this.performCombatAction(combatAction);
                }
            } catch (error) {
                this.handleActivityError('combat', error);
            }
        }, 45000 + Math.random() * 30000); // 45-75 ثانية
    }

    startEnhancedBedCheck() {
        if (this.intervals.bedCheck) clearInterval(this.intervals.bedCheck);
        
        this.intervals.bedCheck = setInterval(() => {
            if (!this.isRunning || this.isManualStop || !this.bot) return;
            
            try {
                const timeOfDay = this.bot.time?.timeOfDay || 0;
                const isNight = timeOfDay > 12000 && timeOfDay < 24000;
                
                if (isNight && this.sleepAttempts < this.maxSleepAttempts) {
                    this.findAndSleep();
                }
                
                // إعادة تعيين محاولات النوم في النهار
                if (!isNight) {
                    this.sleepAttempts = 0;
                }
            } catch (error) {
                this.handleActivityError('bedCheck', error);
            }
        }, 10000); // كل 10 ثواني
    }

    startPerformanceMonitoring() {
        if (this.intervals.statsUpdate) clearInterval(this.intervals.statsUpdate);
        
        this.intervals.statsUpdate = setInterval(() => {
            if (!this.isRunning) return;
            
            try {
                // فحص التأخير
                const now = Date.now();
                const timeSinceLastResponse = now - this.performance.lastResponseTime;
                
                if (timeSinceLastResponse > 60000) { // أكثر من دقيقة
                    this.performance.lagSpikes++;
                    console.warn(`⚠️ [${this.config.name}] تأخير في الاستجابة: ${timeSinceLastResponse}ms`);
                }
                
                // تحديث الإحصائيات العامة
                this.updateStats();
            } catch (error) {}
        }, 30000); // كل 30 ثانية
    }

    startHealthMonitoring() {
        if (this.intervals.healthCheck) clearInterval(this.intervals.healthCheck);
        
        this.intervals.healthCheck = setInterval(() => {
            if (!this.isRunning || !this.bot) return;
            
            try {
                // محاولة أكل الطعام إذا كان الجوع منخفض
                if (this.bot.food < 15) {
                    this.tryToEat();
                }
                
                // تحذير من الصحة المنخفضة
                if (this.bot.health < 10) {
                    this.onNotification(`🚨 ${this.config.name} صحة حرجة: ${this.bot.health}/20`, 'error');
                }
            } catch (error) {}
        }, 15000); // كل 15 ثانية
    }

    performActivity(activity) {
        if (!this.bot || !this.isRunning) return;
        
        const actions = {
            look: () => {
                const yaw = (Math.random() - 0.5) * Math.PI * 2;
                const pitch = (Math.random() - 0.5) * Math.PI * 0.6;
                this.bot.look(yaw, pitch);
            },
            
            jump: () => {
                this.bot.setControlState('jump', true);
                setTimeout(() => {
                    if (this.bot && this.isRunning) {
                        this.bot.setControlState('jump', false);
                    }
                }, 600 + Math.random() * 400);
            },
            
            sneak: () => {
                this.bot.setControlState('sneak', true);
                setTimeout(() => {
                    if (this.bot && this.isRunning) {
                        this.bot.setControlState('sneak', false);
                    }
                }, 1000 + Math.random() * 1000);
            },
            
            walk: () => {
                const directions = ['forward', 'back', 'left', 'right'];
                const direction = directions[Math.floor(Math.random() * directions.length)];
                this.bot.setControlState(direction, true);
                setTimeout(() => {
                    if (this.bot && this.isRunning) {
                        this.bot.setControlState(direction, false);
                    }
                }, 1500 + Math.random() * 1500);
            },
            
            turn: () => {
                if (this.bot.entity) {
                    const currentYaw = this.bot.entity.yaw || 0;
                    const newYaw = currentYaw + (Math.random() - 0.5) * Math.PI;
                    this.bot.look(newYaw, this.bot.entity.pitch || 0);
                }
            },
            
            hit: () => {
                // ضرب خفيف في الهواء
                if (Math.random() < 0.4) { // 40% احتمال
                    try {
                        this.bot.attack(null); // ضرب في الهواء
                    } catch (e) {}
                }
            }
        };
        
        const action = actions[activity];
        if (action) action();
    }

    performMovementPattern(pattern) {
        if (!this.bot || !this.isRunning) return;
        
        const patterns = {
            circle: () => {
                // حركة دائرية
                for (let i = 0; i < 8; i++) {
                    setTimeout(() => {
                        if (this.bot && this.isRunning) {
                            const angle = (i * Math.PI) / 4;
                            this.bot.look(angle, 0);
                            this.bot.setControlState('forward', true);
                            setTimeout(() => {
                                if (this.bot && this.isRunning) {
                                    this.bot.setControlState('forward', false);
                                }
                            }, 500);
                        }
                    }, i * 800);
                }
            },
            
            square: () => {
                // حركة مربعة
                const moves = [
                    { dir: 'forward', time: 2000 },
                    { dir: 'right', time: 2000 },
                    { dir: 'back', time: 2000 },
                    { dir: 'left', time: 2000 }
                ];
                
                moves.forEach((move, i) => {
                    setTimeout(() => {
                        if (this.bot && this.isRunning) {
                            this.bot.setControlState(move.dir, true);
                            setTimeout(() => {
                                if (this.bot && this.isRunning) {
                                    this.bot.setControlState(move.dir, false);
                                }
                            }, move.time);
                        }
                    }, i * 2500);
                });
            },
            
            random: () => {
                // حركة عشوائية
                const directions = ['forward', 'back', 'left', 'right'];
                const randomDir = directions[Math.floor(Math.random() * directions.length)];
                this.bot.setControlState(randomDir, true);
                setTimeout(() => {
                    if (this.bot && this.isRunning) {
                        this.bot.setControlState(randomDir, false);
                    }
                }, 1000 + Math.random() * 2000);
            },
            
            back_forth: () => {
                // ذهاب وإياب
                this.bot.setControlState('forward', true);
                setTimeout(() => {
                    if (this.bot && this.isRunning) {
                        this.bot.setControlState('forward', false);
                        this.bot.setControlState('back', true);
                        setTimeout(() => {
                            if (this.bot && this.isRunning) {
                                this.bot.setControlState('back', false);
                            }
                        }, 2000);
                    }
                }, 2000);
            }
        };
        
        const patternAction = patterns[pattern];
        if (patternAction) patternAction();
    }

    performCombatAction(action) {
        if (!this.bot || !this.isRunning) return;
        
        const actions = {
            hit_air: () => {
                // ضرب خفيف في الهواء
                try {
                    this.bot.attack(null);
                } catch (e) {}
            },
            
            block: () => {
                // محاولة الحماية
                try {
                    this.bot.activateItem();
                    setTimeout(() => {
                        if (this.bot && this.isRunning) {
                            this.bot.deactivateItem();
                        }
                    }, 1000);
                } catch (e) {}
            },
            
            critical_hit: () => {
                // ضربة حرجة (قفز + ضرب)
                try {
                    this.bot.setControlState('jump', true);
                    setTimeout(() => {
                        if (this.bot && this.isRunning) {
                            this.bot.attack(null);
                            this.bot.setControlState('jump', false);
                        }
                    }, 200);
                } catch (e) {}
            }
        };
        
        const combatAction = actions[action];
        if (combatAction) combatAction();
    }

    async findAndSleep() {
        if (this.sleepAttempts >= this.maxSleepAttempts) return;
        
        try {
            // البحث عن السرير بشكل أكثر دقة
            const bed = this.bot.findBlock({
                matching: (block) => {
                    return block && block.name && (
                        block.name.includes('bed') ||
                        block.name.endsWith('_bed')
                    );
                },
                maxDistance: this.bedSearchRadius,
                count: 1
            });

            if (bed) {
                console.log(`🛏️ [${this.config.name}] وجد سرير في الموقع ${bed.position.x}, ${bed.position.y}, ${bed.position.z}`);
                
                // الاقتراب من السرير أولاً
                if (this.bot.entity.position.distanceTo(bed.position) > 3) {
                    await this.bot.pathfinder.goto(bed.position);
                }
                
                // محاولة النوم
                await this.bot.sleep(bed);
                console.log(`😴 [${this.config.name}] نام بنجاح`);
                this.sleepAttempts = 0;
                
            } else {
                // البحث في نطاق أوسع
                this.bedSearchRadius = Math.min(this.bedSearchRadius + 8, 64);
                this.sleepAttempts++;
                console.log(`🔍 [${this.config.name}] لم يجد سرير، توسيع البحث إلى ${this.bedSearchRadius} بلوك`);
            }
        } catch (error) {
            this.sleepAttempts++;
            console.warn(`⚠️ [${this.config.name}] فشل في النوم:`, error.message);
        }
    }

    async tryToEat() {
        try {
            const food = this.bot.inventory.items().find(item => 
                item && item.name && (
                    item.name.includes('bread') ||
                    item.name.includes('apple') ||
                    item.name.includes('carrot') ||
                    item.name.includes('potato') ||
                    item.name.includes('meat') ||
                    item.name.includes('fish')
                )
            );
            
            if (food) {
                await this.bot.equip(food, 'hand');
                this.bot.activateItem();
                console.log(`🍖 [${this.config.name}] يأكل ${food.name}`);
            }
        } catch (error) {
            console.warn(`⚠️ [${this.config.name}] فشل في الأكل:`, error.message);
        }
    }

    handleMessage(message) {
        if (!message || typeof message !== 'string') return;
        
        try {
            this.performance.totalMessages++;
            
            const lowerMsg = message.toLowerCase();
            
            // التفاعل مع رسائل النوم
            if (lowerMsg.includes('sleep') || lowerMsg.includes('bed') || lowerMsg.includes('night')) {
                setTimeout(() => this.findAndSleep(), 2000);
            }
            
            // التحذير من الطرد
            if (lowerMsg.includes('kick') || lowerMsg.includes('ban') || lowerMsg.includes('طرد')) {
                this.onNotification(`⚠️ ${this.config.name} تلقى رسالة تحذيرية: ${message}`, 'warning');
            }
            
            // التفاعل مع تحية الأشخاص
            if (lowerMsg.includes('hello') || lowerMsg.includes('hi') || lowerMsg.includes('مرحبا')) {
                setTimeout(() => {
                    if (this.bot && this.isRunning && Math.random() < 0.3) {
                        this.sendMessage('Hello!');
                    }
                }, 1000 + Math.random() * 3000);
            }
            
        } catch (error) {}
    }

    handleActivityError(activityType, error) {
        const errorKey = `${activityType}_${error.message}`;
        const count = this.errorCounts.get(errorKey) || 0;
        this.errorCounts.set(errorKey, count + 1);
        
        // إذا تكرر نفس الخطأ كثيراً، توقف عن هذا النشاط مؤقتاً
        if (count > 5) {
            console.warn(`⚠️ [${this.config.name}] تعطيل نشاط ${activityType} مؤقتاً بسبب الأخطاء المتكررة`);
            if (this.intervals[activityType]) {
                clearInterval(this.intervals[activityType]);
                this.intervals[activityType] = null;
            }
        }
    }

    handleError(error) {
        // تجاهل الأخطاء المعروفة
        if (this.ignoredErrors.some(ignored => error.message.includes(ignored))) {
            return;
        }
        
        const isFatal = this.isFatalError(error);
        
        if (isFatal) {
            console.error(`❌ [${this.config.name}] خطأ حرج:`, error.message);
            this.onNotification(`❌ ${this.config.name} خطأ حرج: ${error.message}`, 'error');
            this.handleDisconnect(`خطأ حرج: ${error.message}`);
        } else {
            console.warn(`⚠️ [${this.config.name}] تحذير:`, error.message);
        }
    }

    handleKick(reason) {
        console.log(`👢 [${this.config.name}] تم الطرد: ${reason}`);
        this.handleDisconnect(`تم الطرد: ${reason}`);
    }

    handleDisconnect(reason) {
        this.isRunning = false;
        this.cleanup();
        
        // حساب وقت التشغيل
        if (this.startTime) {
            this.totalUptime += Date.now() - this.startTime;
        }
        
        console.log(`🔌 [${this.config.name}] انقطع الاتصال: ${reason || 'غير معروف'}`);
        
        const criticalReasons = ['server closed', 'timeout', 'kicked', 'banned', 'خطأ حرج'];
        if (criticalReasons.some(r => (reason || '').toLowerCase().includes(r.toLowerCase()))) {
            this.onNotification(`❌ ${this.config.name} انقطع: ${reason}`, 'error');
        }
        
        if (!this.isManualStop && this.reconnectAttempts < this.maxReconnectAttempts) {
            this.scheduleReconnect(reason);
        } else if (this.isManualStop) {
            console.log(`🛑 [${this.config.name}] إيقاف يدوي - لا إعادة اتصال`);
        } else {
            this.onNotification(`💔 ${this.config.name} فشل نهائياً بعد ${this.maxReconnectAttempts} محاولات`, 'error');
        }
    }

    scheduleReconnect(reason) {
        if (this.isManualStop) return;

        this.reconnectAttempts++;
        
        // تأخير متزايد مع عشوائية
        this.currentReconnectDelay = Math.min(
            this.baseReconnectDelay * Math.pow(1.5, this.reconnectAttempts - 1),
            60000 // حد أقصى دقيقة واحدة
        );
        
        // إضافة عشوائية لتجنب محاولات متزامنة
        const randomDelay = Math.random() * 5000;
        const totalDelay = this.currentReconnectDelay + randomDelay;
        
        console.log(`🔄 [${this.config.name}] إعادة اتصال خلال ${Math.round(totalDelay/1000)}ث (${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
        
        setTimeout(async () => {
            if (this.isManualStop) return;

            try {
                console.log(`🔄 [${this.config.name}] محاولة إعادة الاتصال...`);
                this.connectionAttempts = 0; // إعادة تعيين محاولات الاتصال الأولي
                await this.start();
                console.log(`✅ [${this.config.name}] نجحت إعادة الاتصال`);
            } catch (error) {
                console.error(`❌ [${this.config.name}] فشلت إعادة الاتصال:`, error.message);
                
                if (this.reconnectAttempts >= this.maxReconnectAttempts) {
                    this.onNotification(`💔 ${this.config.name} استنفد محاولات إعادة الاتصال`, 'error');
                } else if (!this.isManualStop) {
                    this.scheduleReconnect(`فشل إعادة الاتصال: ${error.message}`);
                }
            }
        }, totalDelay);
    }

    sendMessage(message) {
        if (!this.bot || !this.isRunning || this.isManualStop) {
            return false;
        }

        try {
            if (typeof message === 'string' && message.length > 0) {
                const safeMessage = message.trim().substring(0, 256);
                if (safeMessage.length > 0) {
                    this.bot.chat(safeMessage);
                    this.performance.totalMessages++;
                    console.log(`💬 [${this.config.name}] أرسل: ${safeMessage}`);
                    return true;
                }
            }
        } catch (error) {
            console.error(`❌ [${this.config.name}] فشل إرسال الرسالة:`, error.message);
        }
        
        return false;
    }

    getGameModeName(mode) {
        const modes = { 
            0: 'البقاء', 
            1: 'الإبداع', 
            2: 'المغامرة', 
            3: 'المشاهدة' 
        };
        return modes[mode] || 'غير معروف';
    }

    getDimensionName(dimension) {
        if (typeof dimension === 'string') {
            if (dimension.includes('overworld')) return 'العالم العلوي';
            if (dimension.includes('nether')) return 'العالم السفلي';
            if (dimension.includes('end')) return 'النهاية';
        }
        return dimension || 'غير معروف';
    }

    getDetailedStatus() {
        const uptime = this.startTime ? Math.floor((Date.now() - this.startTime) / 1000) : 0;
        const totalUptimeSeconds = Math.floor((this.totalUptime + (this.startTime ? Date.now() - this.startTime : 0)) / 1000);
        
        return {
            name: this.config.name,
            server: `${this.config.ip}:${this.config.port}`,
            status: this.isRunning ? 'متصل' : 'غير متصل',
            uptime: this.formatUptime(uptime),
            totalUptime: this.formatUptime(totalUptimeSeconds),
            stats: {
                ...this.stats,
                ping: this.stats.averagePing || this.stats.ping || 0
            },
            connected: this.isRunning,
            reconnectAttempts: this.reconnectAttempts,
            performance: {
                ...this.performance,
                successRate: this.performance.totalMessages > 0 ? 
                    Math.round((this.performance.successfulActions / this.performance.totalMessages) * 100) : 100
            },
            errors: {
                total: Array.from(this.errorCounts.values()).reduce((a, b) => a + b, 0),
                unique: this.errorCounts.size
            }
        };
    }

    formatUptime(seconds) {
        const days = Math.floor(seconds / 86400);
        const hours = Math.floor((seconds % 86400) / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = seconds % 60;
        
        if (days > 0) return `${days}ي ${hours}س ${minutes}د`;
        if (hours > 0) return `${hours}س ${minutes}د ${secs}ث`;
        if (minutes > 0) return `${minutes}د ${secs}ث`;
        return `${secs}ث`;
    }

    cleanup() {
        try {
            // إيقاف جميع الفواصل الزمنية
            Object.keys(this.intervals).forEach(key => {
                if (this.intervals[key]) {
                    clearInterval(this.intervals[key]);
                    this.intervals[key] = null;
                }
            });
            
            // إيقاف جميع الحركات
            if (this.bot && this.bot.setControlState) {
                const controls = ['forward', 'back', 'left', 'right', 'jump', 'sneak', 'sprint'];
                controls.forEach(control => {
                    try {
                        this.bot.setControlState(control, false);
                    } catch (e) {}
                });
            }
            
            console.log(`🧹 [${this.config.name}] تم تنظيف الأنشطة`);
        } catch (error) {
            console.warn(`⚠️ [${this.config.name}] خطأ في التنظيف:`, error.message);
        }
    }

    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    stop() {
        console.log(`🛑 [${this.config.name}] إيقاف البوت...`);
        
        this.isRunning = false;
        this.isConnecting = false;
        this.isManualStop = true;
        
        // حساب إجمالي وقت التشغيل
        if (this.startTime) {
            this.totalUptime += Date.now() - this.startTime;
        }
        
        this.cleanup();
        
        if (this.bot) {
            try {
                // إرسال رسالة وداع (اختيارية)
                if (Math.random() < 0.3) {
                    this.bot.chat('Goodbye!');
                    setTimeout(() => {
                        this.finalizeStop();
                    }, 1000);
                } else {
                    this.finalizeStop();
                }
            } catch (error) {
                console.error(`❌ [${this.config.name}] خطأ أثناء الإيقاف:`, error.message);
                this.finalizeStop();
            }
        } else {
            this.finalizeStop();
        }
    }

    finalizeStop() {
        if (this.bot) {
            try {
                if (this.bot.quit) this.bot.quit('تم إيقاف البوت بواسطة المستخدم');
                if (this.bot.end) this.bot.end();
                if (this.bot._client && this.bot._client.end) this.bot._client.end();
            } catch (error) {
                console.warn(`⚠️ [${this.config.name}] تحذير أثناء الإغلاق:`, error.message);
            }
            this.bot = null;
        }
        
        console.log(`✅ [${this.config.name}] تم إيقاف البوت بنجاح (وقت التشغيل الإجمالي: ${this.formatUptime(Math.floor(this.totalUptime / 1000))})`);
    }

    destroy() {
        this.stop();
        
        // تنظيف المراجع
        this.errorCounts.clear();
        this.foundBeds.length = 0;
        this.stats.pingReadings.length = 0;
        
        console.log(`🗑️ [${this.config.name}] تم تدمير البوت وتحرير الذاكرة`);
    }

    // دوال مساعدة للإحصائيات المتقدمة
    getPerformanceMetrics() {
        return {
            averagePing: this.stats.averagePing,
            lagSpikes: this.performance.lagSpikes,
            successRate: this.performance.totalMessages > 0 ? 
                Math.round((this.performance.successfulActions / this.performance.totalMessages) * 100) : 100,
            errorRate: this.performance.totalMessages > 0 ?
                Math.round((Array.from(this.errorCounts.values()).reduce((a, b) => a + b, 0) / this.performance.totalMessages) * 100) : 0,
            uptime: this.startTime ? Date.now() - this.startTime : 0,
            totalUptime: this.totalUptime
        };
    }

    // دالة للحصول على معلومات الصحة
    getHealthInfo() {
        return {
            health: this.stats.health,
            food: this.stats.food,
            isHealthy: this.stats.health > 15 && this.stats.food > 15,
            needsAttention: this.stats.health < 10 || this.stats.food < 10,
            status: this.stats.health < 5 ? 'حرج' : 
                   this.stats.health < 10 ? 'منخفض' : 
                   this.stats.health < 15 ? 'متوسط' : 'جيد'
        };
    }

    // دالة للحصول على معلومات الشبكة
    getNetworkInfo() {
        return {
            ping: this.stats.ping,
            averagePing: this.stats.averagePing,
            connectionAttempts: this.connectionAttempts,
            reconnectAttempts: this.reconnectAttempts,
            isStable: this.stats.averagePing < 100 && this.performance.lagSpikes < 5,
            quality: this.stats.averagePing < 50 ? 'ممتاز' :
                    this.stats.averagePing < 100 ? 'جيد' :
                    this.stats.averagePing < 200 ? 'متوسط' : 'ضعيف'
        };
    }
}

module.exports = MinecraftBot;
