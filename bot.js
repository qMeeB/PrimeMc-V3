class ErrorHandler {
    constructor() {
        this.errorCounts = new Map();
        this.ignoredErrors = [
            'chat format code', 'ChatMessage', 'explosion', 'partial packet',
            'Chunk size', 'Cannot read properties', 'unknown chat format',
            'fromNetwork', 'prismarine-chat', 'ECONNRESET', 'EPIPE',
            'socket hang up', 'connect ECONNREFUSED'
        ];
        this.criticalErrors = [
            'ENOMEM', 'ENOSPC', 'EMFILE', 'ENFILE', 'EADDRINUSE'
        ];
        
        this.setupHandlers();
    }

    setupHandlers() {
        process.on('uncaughtException', this.handleUncaughtException.bind(this));
        process.on('unhandledRejection', this.handleUnhandledRejection.bind(this));
        process.on('warning', this.handleWarning.bind(this));
    }

    handleUncaughtException(error) {
        console.error('💥 Uncaught Exception:', error.message);
        
        // تسجيل الخطأ
        const errorKey = error.message || 'unknown';
        const count = this.errorCounts.get(errorKey) || 0;
        this.errorCounts.set(errorKey, count + 1);
        
        // تجاهل الأخطاء غير الحرجة
        const shouldIgnore = this.ignoredErrors.some(ignored => 
            error.message.includes(ignored) || error.stack?.includes(ignored)
        );
        
        if (shouldIgnore) {
            console.log('🚫 Ignored non-critical error, continuing...');
            return;
        }
        
        // التحقق من الأخطاء الحرجة
        const isCritical = this.criticalErrors.some(critical => 
            error.message.includes(critical)
        );
        
        if (isCritical) {
            console.error('❌ Critical system error detected, shutting down...');
            this.performEmergencyShutdown();
            process.exit(1);
        }
        
        // إذا تكرر نفس الخطأ كثيراً
        if (count > 10) {
            console.error('❌ Too many similar errors, shutting down...');
            this.performEmergencyShutdown();
            process.exit(1);
        }
        
        console.log('⚠️ Non-critical error handled, continuing operation...');
    }

    handleUnhandledRejection(reason, promise) {
        console.error('🔴 Unhandled Rejection at:', promise);
        console.error('🔴 Reason:', reason);
        
        // تجاهل بعض الرفض غير الحرج
        if (reason && typeof reason.message === 'string') {
            const shouldIgnore = this.ignoredErrors.some(ignored => 
                reason.message.includes(ignored)
            );
            
            if (shouldIgnore) {
                console.log('🚫 Ignored non-critical rejection');
                return;
            }
        }
        
        // لا نوقف البرنامج للرفض العادي
        console.log('⚠️ Unhandled rejection logged, continuing...');
    }

    handleWarning(warning) {
        // تجاهل التحذيرات غير المهمة
        const ignoredWarnings = ['MaxListenersExceededWarning', 'DeprecationWarning'];
        
        if (ignoredWarnings.some(ignored => warning.name === ignored)) {
            return;
        }
        
        console.warn('⚠️ Warning:', warning.message);
    }

    performEmergencyShutdown() {
        console.log('🚨 Performing emergency shutdown...');
        
        try {
            // إيقاف جميع البوتات
            if (global.mcBots && global.mcBots.size > 0) {
                for (const [id, bot] of global.mcBots) {
                    try { 
                        bot.destroy(); 
                    } catch (e) {}
                }
                global.mcBots.clear();
            }
        } catch (error) {
            console.error('Error during emergency shutdown:', error.message);
        }
    }

    getErrorStats() {
        return {
            totalErrors: Array.from(this.errorCounts.values()).reduce((a, b) => a + b, 0),
            uniqueErrors: this.errorCounts.size,
            topErrors: Array.from(this.errorCounts.entries())
                .sort((a, b) => b[1] - a[1])
                .slice(0, 5)
        };
    }
}

// تهيئة معالج الأخطاء
const errorHandler = new ErrorHandler();

// Express server محسن للأداء العالي
class HighPerformanceServer {
    constructor() {
        this.app = express();
        this.requestCount = 0;
        this.responseTime = [];
        this.healthChecks = new Map();
        this.rateLimiter = new Map();
        
        this.setupMiddleware();
        this.setupRoutes();
    }

    setupMiddleware() {
        // إعدادات الأمان والأداء
        this.app.use((req, res, next) => {
            const startTime = Date.now();
            
            // Headers أمان
            res.header('X-Powered-By', 'Enhanced MC Bot Manager v2.0');
            res.header('X-Content-Type-Options', 'nosniff');
            res.header('X-Frame-Options', 'DENY');
            res.header('Access-Control-Allow-Origin', '*');
            res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
            
            // تسجيل وقت الاستجابة
            res.on('finish', () => {
                const responseTime = Date.now() - startTime;
                this.responseTime.push(responseTime);
                if (this.responseTime.length > 100) {
                    this.responseTime.shift();
                }
                this.requestCount++;
            });
            
            next();
        });

        // JSON parsing محسن
        this.app.use(express.json({ limit: '10mb' }));
        this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));
    }

    setupRoutes() {
        // الصفحة الرئيسية مع معلومات مفصلة
        this.app.get('/', (req, res) => {
            try {
                const uptime = Math.floor(process.uptime());
                const memory = process.memoryUsage();
                const errorStats = errorHandler.getErrorStats();
                
                const status = {
                    status: 'online',
                    version: '2.0.0-enhanced',
                    uptime: uptime,
                    formattedUptime: this.formatUptime(uptime),
                    bots: {
                        total: global.mcBots?.size || 0,
                        active: this.getActiveBots(),
                        byServer: this.getBotsByServer()
                    },
                    performance: {
                        memory: {
                            used: Math.round(memory.heapUsed / 1024 / 1024),
                            total: Math.round(memory.heapTotal / 1024 / 1024),
                            external: Math.round(memory.external / 1024 / 1024)
                        },
                        requests: this.requestCount,
                        averageResponseTime: this.getAverageResponseTime(),
                        errors: errorStats
                    },
                    system: {
                        nodeVersion: process.version,
                        platform: process.platform,
                        arch: process.arch,
                        pid: process.pid
                    },
                    timestamp: new Date().toISOString(),
                    healthScore: this.calculateHealthScore()
                };

                res.json(status);
            } catch (error) {
                console.error('Health check error:', error.message);
                res.status(500).json({ 
                    status: 'error', 
                    message: 'Internal server error',
                    timestamp: new Date().toISOString()
                });
            }
        });

        // فحص صحة مبسط
        this.app.get('/health', (req, res) => {
            try {
                const healthScore = this.calculateHealthScore();
                res.json({ 
                    status: healthScore > 70 ? 'healthy' : healthScore > 40 ? 'degraded' : 'unhealthy',
                    score: healthScore,
                    timestamp: new Date().toISOString(),
                    bots: global.mcBots?.size || 0
                });
            } catch (error) {
                res.status(500).json({ 
                    status: 'unhealthy', 
                    error: error.message,
                    timestamp: new Date().toISOString()
                });
            }
        });

        // معلومات البوتات المفصلة
        this.app.get('/bots', (req, res) => {
            try {
                const botsInfo = [];
                if (global.mcBots) {
                    for (const [id, bot] of global.mcBots) {
                        try {
                            const status = bot.getDetailedStatus();
                            const performance = bot.getPerformanceMetrics();
                            const health = bot.getHealthInfo();
                            const network = bot.getNetworkInfo();
                            
                            botsInfo.push({
                                id: id,
                                name: bot.config?.name || 'Unknown',
                                server: `${bot.config?.ip}:${bot.config?.port}` || 'Unknown',
                                status: status,
                                performance: performance,
                                health: health,
                                network: network,
                                lastUpdate: new Date().toISOString()
                            });
                        } catch (e) {
                            botsInfo.push({
                                id: id,
                                name: bot.config?.name || 'Unknown',
                                status: 'error',
                                error: e.message
                            });
                        }
                    }
                }
                
                res.json({ 
                    bots: botsInfo, 
                    total: botsInfo.length,
                    active: botsInfo.filter(b => b.status?.connected).length,
                    timestamp: new Date().toISOString()
                });
            } catch (error) {
                res.status(500).json({ error: error.message });
            }
        });

        // إحصائيات النظام المتقدمة
        this.app.get('/stats', (req, res) => {
            try {
                const stats = {
                    system: {
                        uptime: process.uptime(),
                        memory: process.memoryUsage(),
                        cpu: process.cpuUsage(),
                        version: process.version
                    },
                    application: {
                        requests: this.requestCount,
                        averageResponseTime: this.getAverageResponseTime(),
                        errors: errorHandler.getErrorStats(),
                        bots: {
                            total: global.mcBots?.size || 0,
                            byStatus: this.getBotStatusBreakdown()
                        }
                    },
                    performance: {
                        healthScore: this.calculateHealthScore(),
                        memoryUsage: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
                        uptime: this.formatUptime(Math.floor(process.uptime()))
                    },
                    timestamp: new Date().toISOString()
                };

                res.json(stats);
            } catch (error) {
                res.status(500).json({ error: error.message });
            }
        });

        // نقطة نهاية للمراقبة الخارجية
        this.app.get('/metrics', (req, res) => {
            try {
                const metrics = {
                    'bot_manager_uptime_seconds': process.uptime(),
                    'bot_manager_memory_usage_bytes': process.memoryUsage().heapUsed,
                    'bot_manager_total_bots': global.mcBots?.size || 0,
                    'bot_manager_active_bots': this.getActiveBots(),
                    'bot_manager_requests_total': this.requestCount,
                    'bot_manager_errors_total': errorHandler.getErrorStats().totalErrors,
                    'bot_manager_health_score': this.calculateHealthScore()
                };

                res.set('Content-Type', 'text/plain');
                res.send(
                    Object.entries(metrics)
                        .map(([key, value]) => `${key} ${value}`)
                        .join('\n')
                );
            } catch (error) {
                res.status(500).json({ error: error.message });
            }
        });

        // API للتحكم في البوتات (محمي)
        this.app.post('/api/bot/:id/action', (req, res) => {
            try {
                const botId = parseInt(req.params.id);
                const action = req.body.action;
                const apiKey = req.headers['x-api-key'];

                // التحقق من API Key (إذا كان متاحاً)
                if (process.env.API_KEY && apiKey !== process.env.API_KEY) {
                    return res.status(401).json({ error: 'Unauthorized' });
                }

                const bot = global.mcBots?.get(botId);
                if (!bot) {
                    return res.status(404).json({ error: 'Bot not found' });
                }

                let result;
                switch (action) {
                    case 'status':
                        result = bot.getDetailedStatus();
                        break;
                    case 'stop':
                        bot.stop();
                        result = { message: 'Bot stopped' };
                        break;
                    case 'chat':
                        const message = req.body.message;
                        if (message) {
                            const sent = bot.sendMessage(message);
                            result = { sent, message };
                        } else {
                            return res.status(400).json({ error: 'Message required' });
                        }
                        break;
                    default:
                        return res.status(400).json({ error: 'Invalid action' });
                }

                res.json({ success: true, result });
            } catch (error) {
                res.status(500).json({ error: error.message });
            }
        });

        // معالج 404
        this.app.use((req, res) => {
            res.status(404).json({
                error: 'Not Found',
                message: 'The requested endpoint does not exist',
                availableEndpoints: ['/', '/health', '/bots', '/stats', '/metrics'],
                timestamp: new Date().toISOString()
            });
        });

        // معالج الأخطاء العام
        this.app.use((error, req, res, next) => {
            console.error('Express error:', error);
            res.status(500).json({
                error: 'Internal Server Error',
                message: 'An unexpected error occurred',
                timestamp: new Date().toISOString()
            });
        });
    }

    getActiveBots() {
        if (!global.mcBots) return 0;
        let active = 0;
        for (const [id, bot] of global.mcBots) {
            try {
                if (bot.isRunning) active++;
            } catch (e) {}
        }
        return active;
    }

    getBotsByServer() {
        const servers = {};
        if (global.mcBots) {
            for (const [id, bot] of global.mcBots) {
                try {
                    const server = `${bot.config.ip}:${bot.config.port}`;
                    servers[server] = (servers[server] || 0) + 1;
                } catch (e) {}
            }
        }
        return servers;
    }

    getBotStatusBreakdown() {
        const breakdown = { running: 0, stopped: 0, error: 0 };
        if (global.mcBots) {
            for (const [id, bot] of global.mcBots) {
                try {
                    if (bot.isRunning) breakdown.running++;
                    else breakdown.stopped++;
                } catch (e) {
                    breakdown.error++;
                }
            }
        }
        return breakdown;
    }

    getAverageResponseTime() {
        if (this.responseTime.length === 0) return 0;
        const sum = this.responseTime.reduce((a, b) => a + b, 0);
        return Math.round(sum / this.responseTime.length);
    }

    calculateHealthScore() {
        let score = 100;
        
        // خصم نقاط للذاكرة المرتفعة
        const memoryMB = process.memoryUsage().heapUsed / 1024 / 1024;
        if (memoryMB > 1000) score -= 30;
        else if (memoryMB > 500) score -= 15;
        
        // خصم نقاط للأخطاء
        const errorStats = errorHandler.getErrorStats();
        if (errorStats.totalErrors > 100) score -= 20;
        else if (errorStats.totalErrors > 50) score -= 10;
        
        // خصم نقاط لوقت الاستجابة البطيء
        const avgResponse = this.getAverageResponseTime();
        if (avgResponse > 1000) score -= 20;
        else if (avgResponse > 500) score -= 10;
        
        return Math.max(0, score);
    }

    formatUptime(seconds) {
        const days = Math.floor(seconds / 86400);
        const hours = Math.floor((seconds % 86400) / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = seconds % 60;
        
        if (days > 0) return `${days}d ${hours}h ${minutes}m ${secs}s`;
        if (hours > 0) return `${hours}h ${minutes}m ${secs}s`;
        if (minutes > 0) return `${minutes}m ${secs}s`;
        return `${secs}s`;
    }

    start(port) {
        const server = this.app.listen(port, () => {
            console.log(`🌐 Enhanced server running on port ${port}`);
            console.log(`📊 Health check: http://localhost:${port}/health`);
            console.log(`🤖 Bots info: http://localhost:${port}/bots`);
            console.log(`📈 Stats: http://localhost:${port}/stats`);
        });

        // معالجة أخطاء السيرفر
        server.on('error', (error) => {
            console.error('🌐 Server error:', error.message);
            if (error.code === 'EADDRINUSE') {
                console.error(`❌ Port ${port} is already in use`);
                process.exit(1);
            }
        });

        // إعدادات الأداء
        server.keepAliveTimeout = 65000;
        server.headersTimeout = 66000;

        return server;
    }
}

// إدارة التطبيق الرئيسية
class BotManager {
    constructor() {
        this.server = null;
        this.discordBot = null;
        this.isShuttingDown = false;
        this.startTime = Date.now();
        this.healthMonitor = null;
        
        this.setupGracefulShutdown();
    }

    async initialize() {
        try {
            console.log('🚀 Initializing Enhanced Bot Manager v2.0...');
            
            // التحقق من متغيرات البيئة
            await this.validateEnvironment();
            
            // بدء الخادم
            this.server = new HighPerformanceServer().start(process.env.PORT || 3000);
            
            // بدء بوت Discord
            console.log('🤖 Starting Discord bot...');
            this.discordBot = new DiscordBot();
            await this.discordBot.start();
            
            // بدء مراقبة الصحة
            this.startHealthMonitoring();
            
            // تنظيف دوري للذاكرة
            this.startMemoryManagement();
            
            console.log('✅ Enhanced Bot Manager started successfully!');
            console.log(`📊 Memory usage: ${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB`);
            console.log(`⏱️ Startup time: ${Date.now() - this.startTime}ms`);
            
        } catch (error) {
            console.error('❌ Initialization failed:', error);
            throw error;
        }
    }

    async validateEnvironment() {
        const required = ['DISCORD_TOKEN'];
        const missing = required.filter(key => !process.env[key]);
        
        if (missing.length > 0) {
            throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
        }
        
        // التحقق من صحة التوكن
        if (process.env.DISCORD_TOKEN.length < 50) {
            throw new Error('Invalid DISCORD_TOKEN format');
        }
        
        console.log('✅ Environment validation passed');
    }

    startHealthMonitoring() {
        this.healthMonitor = setInterval(() => {
            try {
                const memory = process.memoryUsage();
                const memoryMB = Math.round(memory.heapUsed / 1024 / 1024);
                const uptime = Math.floor(process.uptime());
                
                // تحذير من استخدام الذاكرة المرتفع
                if (memoryMB > 1000) {
                    console.warn(`⚠️ High memory usage: ${memoryMB}MB`);
                }
                
                // تسجيل الإحصائيات كل 10 دقائق
                if (uptime % 600 === 0) {
                    console.log(`📊 Health check - Memory: ${memoryMB}MB, Uptime: ${Math.floor(uptime/60)}min, Bots: ${global.mcBots?.size || 0}`);
                }
                
                // تنظيف البوتات المعطلة
                this.cleanupDeadBots();
                
            } catch (error) {
                console.error('Health monitoring error:', error);
            }
        }, 30000); // كل 30 ثانية
        
        console.log('💓 Health monitoring started');
    }

    startMemoryManagement() {
        setInterval(() => {
            try {
                // Garbage collection إذا كان متاحاً
                if (global.gc) {
                    const beforeGC = process.memoryUsage().heapUsed;
                    global.gc();
                    const afterGC = process.memoryUsage().heapUsed;
                    const freed = beforeGC - afterGC;
                    
                    if (freed > 10 * 1024 * 1024) { // أكثر من 10MB
                        console.log(`🧹 GC freed ${Math.round(freed / 1024 / 1024)}MB`);
                    }
                }
                
                // تنظيف إحصائيات الأخطاء القديمة
                if (errorHandler.errorCounts.size > 100) {
                    errorHandler.errorCounts.clear();
                    console.log('🧹 Cleared error statistics');
                }
                
            } catch (error) {
                console.error('Memory management error:', error);
            }
        }, 300000); // كل 5 دقائق
        
        console.log('🧹 Memory management started');
    }

    cleanupDeadBots() {
        if (!global.mcBots || global.mcBots.size === 0) return;
        
        let cleaned = 0;
        for (const [id, bot] of global.mcBots) {
            try {
                // إزالة البوتات التي لا تستجيب
                if (!bot || typeof bot.getDetailedStatus !== 'function') {
                    global.mcBots.delete(id);
                    cleaned++;
                    continue;
                }
                
                // فحص البوتات المعطلة
                const status = bot.getDetailedStatus();
                if (!status || (status.connected === false && status.reconnectAttempts >= 5)) {
                    try {
                        bot.destroy();
                    } catch (e) {}
                    global.mcBots.delete(id);
                    cleaned++;
                }
                
            } catch (error) {
                // إزالة البوتات التي تسبب أخطاء
                global.mcBots.delete(id);
                cleaned++;
            }
        }
        
        if (cleaned > 0) {
            console.log(`🧹 Cleaned up ${cleaned} dead bots`);
        }
    }

    setupGracefulShutdown() {
        const signals = ['SIGINT', 'SIGTERM', 'SIGQUIT'];
        
        signals.forEach(signal => {
            process.on(signal, () => this.gracefulShutdown(signal));
        });

        // معالجة خاصة للـ Windows
        if (process.platform === 'win32') {
            const rl = require('readline').createInterface({
                input: process.stdin,
                output: process.stdout
            });
            
            rl.on('SIGINT', () => {
                process.emit('SIGINT');
            });
        }
    }

    async gracefulShutdown(signal) {
        if (this.isShuttingDown) {
            console.log('🔄 Shutdown already in progress...');
            return;
        }
        
        this.isShuttingDown = true;
        console.log(`🔄 Received ${signal}, initiating graceful shutdown...`);
        
        const shutdownStart = Date.now();
        
        try {
            // إيقاف مراقب الصحة
            if (this.healthMonitor) {
                clearInterval(this.healthMonitor);
                console.log('💓 Health monitor stopped');
            }
            
            // إيقاف جميع البوتات مع تتبع التقدم
            if (global.mcBots && global.mcBots.size > 0) {
                console.log(`🛑 Stopping ${global.mcBots.size} Minecraft bots...`);
                
                const stopPromises = [];
                let stoppedCount = 0;
                
                for (const [id, bot] of global.mcBots) {
                    stopPromises.push(
                        new Promise((resolve) => {
                            try { 
                                bot.destroy(); 
                                stoppedCount++;
                                console.log(`✅ Bot ${id} stopped (${stoppedCount}/${global.mcBots.size})`);
                            } catch (e) {
                                console.error(`❌ Error stopping bot ${id}:`, e.message);
                            }
                            resolve();
                        })
                    );
                }
                
                // انتظار إيقاف جميع البوتات مع timeout
                await Promise.allSettled(stopPromises);
                global.mcBots.clear();
                console.log(`✅ All ${stoppedCount} bots stopped`);
            }

            // إغلاق Discord bot
            if (this.discordBot) {
                console.log('🤖 Shutting down Discord bot...');
                await this.discordBot.shutdown();
                console.log('✅ Discord bot shutdown complete');
            }

            // إغلاق Express server
            if (this.server) {
                await new Promise((resolve) => {
                    this.server.close((err) => {
                        if (err) console.error('❌ Server close error:', err);
                        else console.log('🌐 Express server closed');
                        resolve();
                    });
                });
            }

            const shutdownTime = Date.now() - shutdownStart;
            console.log(`✅ Graceful shutdown completed in ${shutdownTime}ms`);
            console.log(`📊 Final stats - Uptime: ${Math.floor(process.uptime())}s, Memory: ${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB`);
            
            process.exit(0);
            
        } catch (error) {
            console.error('❌ Error during shutdown:', error);
            console.log('🚨 Performing force exit...');
            process.exit(1);
        }
    }

    // دالة للحصول على إحصائيات النظام
    getSystemStats() {
        return {
            uptime: process.uptime(),
            memory: process.memoryUsage(),
            bots: global.mcBots?.size || 0,
            errors: errorHandler.getErrorStats(),
            startTime: this.startTime,
            isShuttingDown: this.isShuttingDown
        };
    }
}

// بدء التطبيق
async function startApplication() {
    try {
        console.log('🎯 Starting Enhanced MC Bot Manager...');
        console.log('🔧 Node.js version:', process.version);
        console.log('💻 Platform:', process.platform, process.arch);
        console.log('🆔 Process ID:', process.pid);
        
        const botManager = new BotManager();
        await botManager.initialize();
        
    } catch (error) {
        console.error('❌ Failed to start application:', error);
        console.error('📋 Stack trace:', error.stack);
        process.exit(1);
    }
}

// التحقق من كون الملف يتم تشغيله مباشرة
if (require.main === module) {
    startApplication();
}

module.exports = {
    BotManager,
    HighPerformanceServer,
    ErrorHandler
};
