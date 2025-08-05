const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

class AdminManager {
    constructor(db) {
        this.db = db;
        this.OWNER_ID = process.env.OWNER_ID || process.env.ADMIN_ID || "631741452367691778";
        
        // نظام مراقبة العمليات الإدارية
        this.adminActions = new Map();
        this.suspiciousActivity = new Map();
        this.actionLogs = [];
        this.maxLogSize = 1000;
        
        // إعدادات الأمان المحسنة
        this.securitySettings = {
            maxBanAttempts: 10,
            maxPremiumGrants: 20,
            adminActionCooldown: 5000, // 5 ثواني بين العمليات
            emergencyStopCooldown: 300000 // 5 دقائق
        };
        
        // كاش للصلاحيات
        this.permissionCache = new Map();
        this.cacheTimeout = 180000; // 3 دقائق
        
        console.log(`👑 Enhanced Admin Manager initialized (Owner: ${this.OWNER_ID})`);
    }

    async isOwner(userId) { 
        return userId === this.OWNER_ID; 
    }
    
    async isAdmin(userId) { 
        if (this.isOwner(userId)) return true;
        
        const cacheKey = `admin_${userId}`;
        if (this.permissionCache.has(cacheKey)) {
            const cached = this.permissionCache.get(cacheKey);
            if (Date.now() - cached.timestamp < this.cacheTimeout) {
                return cached.isAdmin;
            }
        }
        
        const isAdmin = !!(await this.db.getUserData(userId, 'admin'));
        this.permissionCache.set(cacheKey, { isAdmin, timestamp: Date.now() });
        return isAdmin;
    }
    
    async isPremium(userId) { 
        return !!(await this.db.getUserData(userId, 'premium')); 
    }
    
    async isBanned(userId) { 
        return !!(await this.db.getUserData(userId, 'banned')); 
    }

    async hasPermission(userId) {
        return this.isOwner(userId) || await this.isAdmin(userId);
    }

    async handleCommand(interaction) {
        const startTime = Date.now();
        
        try {
            // التحقق من الصلاحيات
            if (!await this.hasPermission(interaction.user.id)) {
                return this.sendPermissionDenied(interaction);
            }

            // التحقق من cooldown العمليات الإدارية
            if (!this.checkAdminCooldown(interaction.user.id)) {
                return interaction.reply({ 
                    content: '⏳ انتظر قليلاً بين العمليات الإدارية!', 
                    ephemeral: true 
                });
            }

            const subcommand = interaction.options.getSubcommand();
            const targetUser = interaction.options.getUser('المستخدم');
            
            console.log(`🔧 Admin command: ${subcommand} by ${interaction.user.username} (${interaction.user.id})`);
            
            // تسجيل العملية
            this.logAdminAction(interaction.user.id, subcommand, targetUser?.id, interaction.guildId);

            const commands = {
                'بريميوم': () => this.handlePremium(targetUser, interaction),
                'حظر': () => this.handleBan(targetUser, interaction),
                'الغاء_حظر': () => this.handleUnban(targetUser, interaction),
                'اضافة_ادمن': () => this.handleAddAdmin(targetUser, interaction),
                'حذف_ادمن': () => this.handleRemoveAdmin(targetUser, interaction),
                'احصائيات': () => this.handleDetailedStats(interaction),
                'ايقاف_طوارئ': () => this.handleEmergencyStop(interaction),
                'تنظيف': () => this.handleCleanup(interaction)
            };

            const handler = commands[subcommand];
            if (handler) {
                await handler();
            } else {
                await interaction.reply({ 
                    content: '❌ أمر إداري غير معروف!', 
                    ephemeral: true 
                });
            }

            // تسجيل وقت المعالجة
            const processingTime = Date.now() - startTime;
            console.log(`⚡ Admin command ${subcommand} processed in ${processingTime}ms`);

        } catch (error) {
            console.error('❌ Admin command error:', error);
            await this.handleAdminError(interaction, error);
        }
    }

    checkAdminCooldown(userId) {
        const lastAction = this.adminActions.get(userId);
        const now = Date.now();
        
        if (lastAction && (now - lastAction) < this.securitySettings.adminActionCooldown) {
            return false;
        }
        
        this.adminActions.set(userId, now);
        return true;
    }

    logAdminAction(adminId, action, targetId, guildId) {
        const logEntry = {
            adminId,
            action,
            targetId,
            guildId,
            timestamp: Date.now(),
            date: new Date().toISOString()
        };
        
        this.actionLogs.push(logEntry);
        
        // تنظيف السجلات القديمة
        if (this.actionLogs.length > this.maxLogSize) {
            this.actionLogs = this.actionLogs.slice(-this.maxLogSize);
        }
    }

    async sendPermissionDenied(interaction) {
        const embed = new EmbedBuilder()
            .setColor('#ff0000')
            .setTitle('🚫 ليس لديك صلاحية')
            .setDescription('هذا الأمر مخصص للمشرفين والمطور فقط')
            .addFields([
                { name: '👑 للمطورين', value: 'جميع الصلاحيات متاحة', inline: true },
                { name: '🛡️ للمشرفين', value: 'صلاحيات محدودة', inline: true },
                { name: '📞 طلب الصلاحية', value: 'تواصل مع المطور الرئيسي', inline: false }
            ])
            .setTimestamp();

        await interaction.reply({ embeds: [embed], ephemeral: true });
    }

    async handlePremium(user, interaction) {
        if (!user) {
            return interaction.reply({ 
                content: '❌ يجب تحديد المستخدم!', 
                ephemeral: true 
            });
        }

        await interaction.deferReply({ ephemeral: true });
        
        try {
            // التحقق من الحظر
            if (await this.isBanned(user.id)) {
                return interaction.editReply({ 
                    content: `❌ لا يمكن منح البريميوم للمستخدم المحظور **${user.username}**!` 
                });
            }

            // التحقق من وجود البريميوم مسبقاً
            if (await this.isPremium(user.id)) {
                return interaction.editReply({ 
                    content: `❌ **${user.username}** لديه بريميوم بالفعل!` 
                });
            }

            // منح البريميوم لمدة شهر
            await this.db.execute(`
                INSERT OR REPLACE INTO users (id, premium, expires, banned, last_activity) 
                VALUES (?, 1, datetime("now", "+1 month"), 0, datetime("now"))
            `, [user.id]);
            
            this.db.clearCache(user.id, ['premium', 'banned', 'user']);

            const expiryDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
            const embed = new EmbedBuilder()
                .setColor('#ffd700')
                .setTitle('✅ تم منح البريميوم!')
                .addFields([
                    { name: '👤 المستخدم', value: `${user.username} (${user.id})`, inline: true },
                    { name: '⏰ المدة', value: '1 شهر', inline: true },
                    { name: '📅 ينتهي في', value: expiryDate.toLocaleDateString('ar'), inline: true },
                    { name: '🎁 المميزات', value: '• حتى 10 بوتات\n• تغيير الأسماء\n• دعم أولوية', inline: false },
                    { name: '👮 بواسطة', value: interaction.user.username, inline: true },
                    { name: '⏰ تاريخ المنح', value: new Date().toLocaleDateString('ar'), inline: true }
                ])
                .setFooter({ text: 'تم تفعيل البريميوم بنجاح' })
                .setTimestamp();

            await interaction.editReply({ embeds: [embed] });
            
            // إرسال إشعار للمستخدم
            try {
                const userNotification = new EmbedBuilder()
                    .setColor('#ffd700')
                    .setTitle('🎉 تهاني! حصلت على البريميوم!')
                    .setDescription('تم تفعيل حسابك المميز من قبل الإدارة')
                    .addFields([
                        { name: '💎 مميزاتك الجديدة', value: '• حتى 10 بوتات\n• تغيير أسماء البوتات\n• دعم أولوية\n• إحصائيات متقدمة', inline: false },
                        { name: '⏰ صالح حتى', value: expiryDate.toLocaleDateString('ar'), inline: true }
                    ])
                    .setFooter({ text: 'استمتع بالمميزات الجديدة!' });

                await user.send({ embeds: [userNotification] });
                console.log(`📧 Premium notification sent to ${user.username}`);
            } catch (e) {
                console.warn(`⚠️ Could not send premium notification to ${user.username}`);
            }

            console.log(`💎 Admin ${interaction.user.username} granted premium to: ${user.username}`);
            
        } catch (error) {
            console.error('Handle premium error:', error);
            await interaction.editReply({ content: '❌ حدث خطأ في منح البريميوم!' });
        }
    }

    async handleBan(user, interaction) {
        if (!user) {
            return interaction.reply({ 
                content: '❌ يجب تحديد المستخدم!', 
                ephemeral: true 
            });
        }

        await interaction.deferReply({ ephemeral: true });
        
        try {
            // فحوصات الأمان
            if (this.isOwner(user.id)) {
                return interaction.editReply({ content: '❌ لا يمكن حظر المطور الرئيسي!' });
            }
            
            if (await this.isAdmin(user.id)) {
                return interaction.editReply({ content: '❌ لا يمكن حظر مشرف آخر!' });
            }
            
            if (await this.isBanned(user.id)) {
                return interaction.editReply({ content: `❌ **${user.username}** محظور بالفعل!` });
            }

            // تنفيذ الحظر
            await this.db.execute(`
                INSERT OR REPLACE INTO users (id, banned, premium, expires, last_activity) 
                VALUES (?, 1, 0, NULL, datetime("now"))
            `, [user.id]);
            
            // إيقاف جميع بوتات المستخدم
            const stoppedBots = await this.stopUserBots(user.id);
            
            // حظر IP المستخدم
            const userData = await this.db.getUserData(user.id, 'user');
            if (userData?.current_ip) {
                await this.db.execute(`
                    UPDATE ip_usage SET banned = 1 WHERE ip = ?
                `, [userData.current_ip]);
            }
            
            this.db.clearCache(user.id);

            const embed = new EmbedBuilder()
                .setColor('#ff0000')
                .setTitle('🔨 تم حظر المستخدم')
                .addFields([
                    { name: '👤 المستخدم', value: `${user.username} (${user.id})`, inline: true },
                    { name: '🛑 البوتات المتوقفة', value: stoppedBots.toString(), inline: true },
                    { name: '👮 محظور بواسطة', value: interaction.user.username, inline: true },
                    { name: '⏰ تاريخ الحظر', value: new Date().toLocaleDateString('ar'), inline: true },
                    { name: '🚫 العواقب', value: '• إيقاف جميع البوتات\n• منع إنشاء بوتات جديدة\n• حظر الـ IP', inline: false }
                ])
                .setFooter({ text: 'تم تنفيذ الحظر بنجاح' })
                .setTimestamp();

            await interaction.editReply({ embeds: [embed] });

            // إرسال إشعار للمستخدم المحظور
            try {
                const banNotification = new EmbedBuilder()
                    .setColor('#ff0000')
                    .setTitle('🚫 تم حظرك من استخدام البوت')
                    .setDescription('تم حظر حسابك من قبل الإدارة')
                    .addFields([
                        { name: '📋 تفاصيل الحظر', value: '• تم إيقاف جميع بوتاتك\n• لا يمكنك إنشاء بوتات جديدة\n• الحظر يشمل الـ IP الخاص بك', inline: false },
                        { name: '📞 للاستفسار', value: 'تواصل مع الإدارة إذا كنت تعتقد أن هذا خطأ', inline: false }
                    ])
                    .setTimestamp();

                await user.send({ embeds: [banNotification] });
                console.log(`📧 Ban notification sent to ${user.username}`);
            } catch (e) {
                console.warn(`⚠️ Could not send ban notification to ${user.username}`);
            }

            console.log(`🔨 Admin ${interaction.user.username} banned user: ${user.username} - ${stoppedBots} bots stopped`);
            
        } catch (error) {
            console.error('Handle ban error:', error);
            await interaction.editReply({ content: '❌ حدث خطأ في حظر المستخدم!' });
        }
    }

    async handleUnban(user, interaction) {
        if (!user) {
            return interaction.reply({ 
                content: '❌ يجب تحديد المستخدم!', 
                ephemeral: true 
            });
        }

        await interaction.deferReply({ ephemeral: true });
        
        try {
            if (!await this.isBanned(user.id)) {
                return interaction.editReply({ content: `❌ **${user.username}** غير محظور!` });
            }

            // إلغاء الحظر
            await this.db.execute('UPDATE users SET banned = 0 WHERE id = ?', [user.id]);
            
            // إلغاء حظر IP إذا كان المستخدم الوحيد عليه
            const userData = await this.db.getUserData(user.id, 'user');
            if (userData?.current_ip) {
                const ipUsers = await this.db.query(`
                    SELECT COUNT(*) as count FROM users 
                    WHERE current_ip = ? AND banned = 1 AND id != ?
                `, [userData.current_ip, user.id]);
                
                if (ipUsers[0].count === 0) {
                    await this.db.execute(`
                        UPDATE ip_usage SET banned = 0 WHERE ip = ?
                    `, [userData.current_ip]);
                }
            }
            
            this.db.clearCache(user.id);

            const embed = new EmbedBuilder()
                .setColor('#00ff00')
                .setTitle('✅ تم إلغاء حظر المستخدم')
                .addFields([
                    { name: '👤 المستخدم', value: `${user.username} (${user.id})`, inline: true },
                    { name: '👮 ألغى الحظر', value: interaction.user.username, inline: true },
                    { name: '⏰ تاريخ إلغاء الحظر', value: new Date().toLocaleDateString('ar'), inline: true },
                    { name: '✅ الصلاحيات المستعادة', value: '• يمكن إنشاء بوتات جديدة\n• يمكن تشغيل البوتات\n• الوصول الكامل للبوت', inline: false }
                ])
                .setFooter({ text: 'تم إلغاء الحظر بنجاح' })
                .setTimestamp();

            await interaction.editReply({ embeds: [embed] });

            // إرسال إشعار للمستخدم
            try {
                const unbanNotification = new EmbedBuilder()
                    .setColor('#00ff00')
                    .setTitle('🎉 تم إلغاء حظرك!')
                    .setDescription('تم إلغاء حظر حسابك من قبل الإدارة')
                    .addFields([
                        { name: '✅ يمكنك الآن', value: '• إنشاء بوتات جديدة\n• تشغيل البوتات\n• استخدام جميع الأوامر', inline: false },
                        { name: '💡 نصيحة', value: 'تأكد من اتباع قوانين الاستخدام لتجنب الحظر مرة أخرى', inline: false }
                    ])
                    .setTimestamp();

                await user.send({ embeds: [unbanNotification] });
                console.log(`📧 Unban notification sent to ${user.username}`);
            } catch (e) {
                console.warn(`⚠️ Could not send unban notification to ${user.username}`);
            }

            console.log(`✅ Admin ${interaction.user.username} unbanned user: ${user.username}`);
            
        } catch (error) {
            console.error('Handle unban error:', error);
            await interaction.editReply({ content: '❌ حدث خطأ في إلغاء حظر المستخدم!' });
        }
    }

    async handleAddAdmin(user, interaction) {
        if (!this.isOwner(interaction.user.id)) {
            return interaction.reply({ 
                content: '❌ هذا الأمر للمطور الرئيسي فقط!', 
                ephemeral: true 
            });
        }

        if (!user) {
            return interaction.reply({ 
                content: '❌ يجب تحديد المستخدم!', 
                ephemeral: true 
            });
        }

        await interaction.deferReply({ ephemeral: true });
        
        try {
            if (await this.isAdmin(user.id)) {
                return interaction.editReply({ content: `❌ **${user.username}** مشرف بالفعل!` });
            }
            
            if (this.isOwner(user.id)) {
                return interaction.editReply({ content: '❌ المطور الرئيسي لديه جميع الصلاحيات بالفعل!' });
            }

            // إضافة المشرف الجديد
            await this.db.execute(`
                INSERT INTO admins (id, added_by, permissions, added_at) 
                VALUES (?, ?, 'basic', datetime("now"))
            `, [user.id, interaction.user.id]);
            
            this.db.clearCache(user.id, ['admin']);
            this.permissionCache.delete(`admin_${user.id}`);

            const embed = new EmbedBuilder()
                .setColor('#ffd700')
                .setTitle('👑 تم إضافة مشرف جديد!')
                .addFields([
                    { name: '👤 المشرف الجديد', value: `${user.username} (${user.id})`, inline: true },
                    { name: '👑 أضافه', value: interaction.user.username, inline: true },
                    { name: '🛡️ نوع الصلاحية', value: 'أساسية', inline: true },
                    { name: '⏰ تاريخ الإضافة', value: new Date().toLocaleDateString('ar'), inline: true },
                    { name: '🔧 الصلاحيات المتاحة', value: '• منح/إزالة البريميوم\n• حظر/إلغاء حظر المستخدمين\n• عرض الإحصائيات\n• تنظيف النظام', inline: false }
                ])
                .setFooter({ text: 'تم منح الصلاحيات بنجاح' })
                .setTimestamp();

            await interaction.editReply({ embeds: [embed] });

            // إرسال إشعار للمشرف الجديد
            try {
                const adminNotification = new EmbedBuilder()
                    .setColor('#ffd700')
                    .setTitle('👑 تم منحك صلاحيات الإشراف!')
                    .setDescription('تم منحك صلاحيات الإشراف من قبل المطور الرئيسي')
                    .addFields([
                        { name: '🛡️ صلاحياتك الجديدة', value: '• استخدام أوامر `/ادمن`\n• إدارة حسابات البريميوم\n• حظر/إلغاء حظر المستخدمين\n• عرض إحصائيات النظام', inline: false },
                        { name: '⚠️ مسؤولياتك', value: '• استخدم الصلاحيات بحكمة\n• لا تتجاوز حدود صلاحيتك\n• اتبع توجيهات المطور', inline: false }
                    ])
                    .setTimestamp();

                await user.send({ embeds: [adminNotification] });
                console.log(`📧 Admin notification sent to ${user.username}`);
            } catch (e) {
                console.warn(`⚠️ Could not send admin notification to ${user.username}`);
            }

            console.log(`👑 Owner ${interaction.user.username} added admin: ${user.username}`);
            
        } catch (error) {
            console.error('Handle add admin error:', error);
            await interaction.editReply({ content: '❌ حدث خطأ في إضافة المشرف!' });
        }
    }

    async handleRemoveAdmin(user, interaction) {
        if (!this.isOwner(interaction.user.id)) {
            return interaction.reply({ 
                content: '❌ هذا الأمر للمطور الرئيسي فقط!', 
                ephemeral: true 
            });
        }

        if (!user) {
            return interaction.reply({ 
                content: '❌ يجب تحديد المستخدم!', 
                ephemeral: true 
            });
        }

        await interaction.deferReply({ ephemeral: true });
        
        try {
            if (!await this.isAdmin(user.id)) {
                return interaction.editReply({ content: `❌ **${user.username}** ليس مشرفاً!` });
            }

            // إزالة المشرف
            await this.db.execute('DELETE FROM admins WHERE id = ?', [user.id]);
            this.db.clearCache(user.id, ['admin']);
            this.permissionCache.delete(`admin_${user.id}`);

            const embed = new EmbedBuilder()
                .setColor('#ff9900')
                .setTitle('🗑️ تم إزالة مشرف')
                .addFields([
                    { name: '👤 المشرف المُزال', value: `${user.username} (${user.id})`, inline: true },
                    { name: '👑 أزاله', value: interaction.user.username, inline: true },
                    { name: '⏰ تاريخ الإزالة', value: new Date().toLocaleDateString('ar'), inline: true },
                    { name: '🚫 الصلاحيات المُلغاة', value: '• جميع أوامر الإدارة\n• الوصول للإحصائيات\n• إدارة المستخدمين', inline: false }
                ])
                .setFooter({ text: 'تم إلغاء الصلاحيات' })
                .setTimestamp();

            await interaction.editReply({ embeds: [embed] });

            // إرسال إشعار للمشرف المُزال
            try {
                const removeNotification = new EmbedBuilder()
                    .setColor('#ff9900')
                    .setTitle('⚠️ تم إلغاء صلاحيات الإشراف')
                    .setDescription('تم إلغاء صلاحيات الإشراف الخاصة بك')
                    .addFields([
                        { name: '🚫 لم تعد تستطيع', value: '• استخدام أوامر الإدارة\n• إدارة المستخدمين\n• الوصول للإحصائيات المتقدمة', inline: false },
                        { name: '📞 للاستفسار', value: 'تواصل مع المطور الرئيسي', inline: false }
                    ])
                    .setTimestamp();

                await user.send({ embeds: [removeNotification] });
                console.log(`📧 Admin removal notification sent to ${user.username}`);
            } catch (e) {
                console.warn(`⚠️ Could not send admin removal notification to ${user.username}`);
            }

            console.log(`🗑️ Owner ${interaction.user.username} removed admin: ${user.username}`);
            
        } catch (error) {
            console.error('Handle remove admin error:', error);
            await interaction.editReply({ content: '❌ حدث خطأ في إزالة المشرف!' });
        }
    }

    async handleDetailedStats(interaction) {
        await interaction.deferReply({ ephemeral: true });
        
        try {
            const stats = await this.db.getStats();
            const systemHealth = this.getSystemHealth();
            const recentActions = this.getRecentAdminActions(10);
            
            const embed = new EmbedBuilder()
                .setColor(systemHealth.color)
                .setTitle('📊 إحصائيات النظام المفصلة')
                .setDescription(`**حالة النظام:** ${systemHealth.status}`)
                .addFields([
                    { 
                        name: '👥 المستخدمين', 
                        value: `**الإجمالي:** ${stats.totalUsers}\n**البريميوم:** ${stats.premiumUsers}\n**المحظورين:** ${stats.bannedUsers}\n**النشطين:** ${stats.totalUsers - stats.bannedUsers}`, 
                        inline: true 
                    },
                    { 
                        name: '🤖 البوتات', 
                        value: `**الإجمالي:** ${stats.totalBots}\n**يعمل:** ${stats.runningBots}\n**متوقف:** ${stats.totalBots - stats.runningBots}\n**معدل التشغيل:** ${stats.totalBots > 0 ? Math.round((stats.runningBots / stats.totalBots) * 100) : 0}%`, 
                        inline: true 
                    },
                    { 
                        name: '🛡️ الإدارة', 
                        value: `**المشرفين:** ${stats.totalAdmins}\n**المطور:** 1\n**الـ IPs المحظورة:** ${stats.bannedIPs}`, 
                        inline: true 
                    },
                    { 
                        name: '💾 قاعدة البيانات', 
                        value: `**الاتصال:** ${this.db.getHealthStatus().connected ? '✅ متصل' : '❌ منقطع'}\n**الكاش:** ${this.db.getHealthStatus().cacheSize} عنصر\n**الطابور:** ${this.db.getHealthStatus().queueSize} استعلام`, 
                        inline: true 
                    },
                    { 
                        name: '⚡ الأداء', 
                        value: `**الذاكرة:** ${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB\n**وقت التشغيل:** ${this.formatUptime(Math.floor(process.uptime()))}\n**العمليات الإدارية:** ${this.actionLogs.length}`, 
                        inline: true 
                    },
                    { 
                        name: '🌐 ديسكورد', 
                        value: `**السيرفرات:** ${interaction.client.guilds.cache.size}\n**المستخدمين المخزنين:** ${interaction.client.users.cache.size}\n**البينق:** ${interaction.client.ws.ping}ms`, 
                        inline: true 
                    }
                ])
                .setTimestamp();

            // إضافة سجل العمليات الأخيرة
            if (recentActions.length > 0) {
                const actionsText = recentActions.map(action => 
                    `• **${action.action}** بواسطة <@${action.adminId}> ${action.targetId ? `على <@${action.targetId}>` : ''}`
                ).join('\n');
                
                embed.addFields([
                    { name: '📋 آخر العمليات الإدارية', value: actionsText, inline: false }
                ]);
            }

            // إضافة أزرار للعمليات السريعة
            const refreshButton = new ButtonBuilder()
                .setCustomId('refresh_stats')
                .setLabel('تحديث')
                .setStyle(ButtonStyle.Primary)
                .setEmoji('🔄');

            const cleanupButton = new ButtonBuilder()
                .setCustomId('quick_cleanup')
                .setLabel('تنظيف سريع')
                .setStyle(ButtonStyle.Secondary)
                .setEmoji('🧹');

            const backupButton = new ButtonBuilder()
                .setCustomId('backup_db')
                .setLabel('نسخ احتياطي')
                .setStyle(ButtonStyle.Success)
                .setEmoji('💾');

            const row = new ActionRowBuilder().addComponents(refreshButton, cleanupButton, backupButton);

            await interaction.editReply({ embeds: [embed], components: [row] });
            
        } catch (error) {
            console.error('Handle detailed stats error:', error);
            await interaction.editReply({ content: '❌ حدث خطأ في عرض الإحصائيات!' });
        }
    }

    async handleEmergencyStop(interaction) {
        if (!this.isOwner(interaction.user.id)) {
            return interaction.reply({ 
                content: '❌ الإيقاف الطارئ للمطور الرئيسي فقط!', 
                ephemeral: true 
            });
        }

        // التحقق من cooldown
        const lastEmergencyStop = this.adminActions.get('emergency_stop');
        if (lastEmergencyStop && (Date.now() - lastEmergencyStop) < this.securitySettings.emergencyStopCooldown) {
            const timeLeft = Math.ceil((this.securitySettings.emergencyStopCooldown - (Date.now() - lastEmergencyStop)) / 60000);
            return interaction.reply({ 
                content: `⏳ يجب انتظار ${timeLeft} دقيقة قبل الإيقاف الطارئ التالي!`, 
                ephemeral: true 
            });
        }

        await interaction.deferReply({ ephemeral: true });
        
        try {
            let stoppedCount = 0;
            const startTime = Date.now();

            // إيقاف جميع البوتات
            if (global.mcBots && global.mcBots.size > 0) {
                console.log(`🚨 Emergency stop initiated: stopping ${global.mcBots.size} bots`);
                
                const stopPromises = [];
                for (const [id, mcBot] of global.mcBots) {
                    stopPromises.push(
                        new Promise((resolve) => {
                            try { 
                                mcBot.destroy(); 
                                stoppedCount++;
                                resolve();
                            } catch (e) {
                                console.error(`Error stopping bot ${id}:`, e);
                                resolve();
                            }
                        })
                    );
                }
                
                // انتظار إيقاف جميع البوتات (مع timeout)
                await Promise.allSettled(stopPromises);
                global.mcBots.clear();
            }

            // تحديث قاعدة البيانات
            await this.db.execute('UPDATE bots SET running = 0');
            
            // تسجيل العملية
            this.adminActions.set('emergency_stop', Date.now());
            
            const processingTime = Date.now() - startTime;
            
            const embed = new EmbedBuilder()
                .setColor('#ff0000')
                .setTitle('🚨 تم تنفيذ الإيقاف الطارئ')
                .setDescription('تم إيقاف جميع البوتات في النظام بنجاح')
                .addFields([
                    { name: '🛑 البوتات المتوقفة', value: stoppedCount.toString(), inline: true },
                    { name: '⏱️ وقت المعالجة', value: `${processingTime}ms`, inline: true },
                    { name: '👑 نُفذ بواسطة', value: interaction.user.username, inline: true },
                    { name: '⏰ وقت التنفيذ', value: new Date().toLocaleString('ar'), inline: true },
                    { name: '🔄 التأثير', value: '• إيقاف فوري لجميع البوتات\n• تحديث قاعدة البيانات\n• تنظيف الذاكرة', inline: false }
                ])
                .setFooter({ text: 'الإيقاف الطارئ مكتمل' })
                .setTimestamp();

            await interaction.editReply({ embeds: [embed] });

            console.log(`🚨 Emergency stop executed by ${interaction.user.username}: ${stoppedCount} bots stopped in ${processingTime}ms`);
            
        } catch (error) {
            console.error('Handle emergency stop error:', error);
            await interaction.editReply({ content: '❌ حدث خطأ أثناء الإيقاف الطارئ!' });
        }
    }

    async handleCleanup(interaction) {
        await interaction.deferReply({ ephemeral: true });
        
        try {
            const startTime = Date.now();
            const cleanupResults = {};

            // تنظيف الحسابات المنتهية الصلاحية
            cleanupResults.expiredAccounts = await this.db.cleanupExpired();
            
            // مزامنة حالة البوتات
            await this.db.syncBotStates();
            cleanupResults.syncedBots = 'تم';
            
            // تنظيف الكاش
            const oldCacheSize = this.db.cache.size;
            this.clearExpiredCache();
            cleanupResults.cacheCleared = oldCacheSize - this.db.cache.size;
            
            // تنظيف سجلات الإدارة القديمة
            const oldLogsCount = this.actionLogs.length;
            this.cleanupOldLogs();
            cleanupResults.logsCleared = oldLogsCount - this.actionLogs.length;
            
            // Garbage collection
            if (global.gc) {
                global.gc();
                cleanupResults.memoryOptimized = 'تم';
            }
            
            const processingTime = Date.now() - startTime;

            const embed = new EmbedBuilder()
                .setColor('#00ff00')
                .setTitle('🧹 تم تنظيف النظام')
                .setDescription('تم تنفيذ عملية تنظيف شاملة للنظام')
                .addFields([
                    { name: '📅 الحسابات المنتهية', value: `${cleanupResults.expiredAccounts} حساب`, inline: true },
                    { name: '🤖 مزامنة البوتات', value: cleanupResults.syncedBots, inline: true },
                    { name: '💾 تنظيف الكاش', value: `${cleanupResults.cacheCleared} عنصر`, inline: true },
                    { name: '📋 تنظيف السجلات', value: `${cleanupResults.logsCleared} سجل`, inline: true },
                    { name: '🗑️ تحسين الذاكرة', value: cleanupResults.memoryOptimized || 'غير متاح', inline: true },
                    { name: '⏱️ وقت المعالجة', value: `${processingTime}ms`, inline: true },
                    { name: '👮 نُفذ بواسطة', value: interaction.user.username, inline: true },
                    { name: '⏰ وقت التنفيذ', value: new Date().toLocaleString('ar'), inline: true }
                ])
                .setFooter({ text: 'تنظيف النظام مكتمل' })
                .setTimestamp();

            await interaction.editReply({ embeds: [embed] });

            console.log(`🧹 System cleanup completed by ${interaction.user.username} in ${processingTime}ms`);
            
        } catch (error) {
            console.error('Handle cleanup error:', error);
            await interaction.editReply({ content: '❌ حدث خطأ أثناء تنظيف النظام!' });
        }
    }

    async handleAdminError(interaction, error) {
        console.error('Admin command error:', error);
        
        const errorEmbed = new EmbedBuilder()
            .setColor('#ff0000')
            .setTitle('❌ خطأ في الأمر الإداري')
            .setDescription('حدث خطأ أثناء تنفيذ الأمر الإداري')
            .addFields([
                { name: '🔧 الإجراء المطلوب', value: '• تحقق من صحة البيانات\n• جرب الأمر مرة أخرى\n• تواصل مع المطور الرئيسي', inline: false }
            ])
            .setTimestamp();

        try {
            if (!interaction.replied && !interaction.deferred) {
                await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
            } else if (interaction.deferred) {
                await interaction.editReply({ embeds: [errorEmbed] });
            }
        } catch (e) {
            console.error('Failed to send admin error message:', e);
        }
    }

    async stopUserBots(userId) {
        const userBots = await this.db.getUserData(userId, 'bots');
        let stoppedCount = 0;
        
        for (const botData of userBots) {
            if (botData.running && global.mcBots?.has(botData.id)) {
                try {
                    const mcBot = global.mcBots.get(botData.id);
                    mcBot.destroy();
                    global.mcBots.delete(botData.id);
                    await this.db.execute('UPDATE bots SET running = 0 WHERE id = ?', [botData.id]);
                    stoppedCount++;
                } catch (error) {
                    console.error(`Error stopping bot ${botData.id}:`, error);
                }
            }
        }

        return stoppedCount;
    }

    getSystemHealth() {
        const dbHealth = this.db.getHealthStatus();
        const memoryUsage = process.memoryUsage().heapUsed / 1024 / 1024;
        
        if (!dbHealth.connected || memoryUsage > 1000) {
            return { status: '🔴 غير مستقر', color: '#ff0000' };
        } else if (memoryUsage > 500 || dbHealth.queueSize > 10) {
            return { status: '🟡 مستقر نسبياً', color: '#ffaa00' };
        } else {
            return { status: '🟢 ممتاز', color: '#00ff00' };
        }
    }

    getRecentAdminActions(limit = 10) {
        return this.actionLogs
            .slice(-limit)
            .reverse()
            .map(log => ({
                ...log,
                timeAgo: this.getTimeAgo(log.timestamp)
            }));
    }

    getTimeAgo(timestamp) {
        const diff = Date.now() - timestamp;
        const minutes = Math.floor(diff / 60000);
        const hours = Math.floor(diff / 3600000);
        const days = Math.floor(diff / 86400000);
        
        if (days > 0) return `${days}ي`;
        if (hours > 0) return `${hours}س`;
        if (minutes > 0) return `${minutes}د`;
        return 'الآن';
    }

    clearExpiredCache() {
        const now = Date.now();
        for (const [key, data] of this.permissionCache) {
            if (now - data.timestamp > this.cacheTimeout) {
                this.permissionCache.delete(key);
            }
        }
    }

    cleanupOldLogs() {
        // الاحتفاظ بآخر 500 سجل فقط
        if (this.actionLogs.length > 500) {
            this.actionLogs = this.actionLogs.slice(-500);
        }
    }

    formatUptime(seconds) {
        const days = Math.floor(seconds / 86400);
        const hours = Math.floor((seconds % 86400) / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        
        if (days > 0) return `${days}ي ${hours}س ${minutes}د`;
        if (hours > 0) return `${hours}س ${minutes}د`;
        return `${minutes}د`;
    }

    startCleanupScheduler() {
        // تنظيف دوري كل ساعة
        setInterval(async () => {
            try {
                await this.db.cleanupExpired();
                this.clearExpiredCache();
                this.cleanupOldLogs();
                console.log('🕐 Scheduled admin cleanup completed');
            } catch (error) {
                console.error('Scheduled cleanup error:', error);
            }
        }, 3600000); // كل ساعة

        // مزامنة حالة البوتات كل 5 دقائق
        setInterval(async () => {
            try {
                await this.db.syncBotStates();
            } catch (error) {
                console.error('Bot state sync error:', error);
            }
        }, 300000); // كل 5 دقائق
        
        console.log('🕐 Enhanced admin cleanup scheduler started');
    }

    // دوال للحصول على الإحصائيات والمراقبة
    getAdminMetrics() {
        return {
            totalActions: this.actionLogs.length,
            recentActions: this.getRecentAdminActions(5),
            cachedPermissions: this.permissionCache.size,
            suspiciousActivity: this.suspiciousActivity.size,
            systemHealth: this.getSystemHealth()
        };
    }

    // دالة للحصول على سجل مفصل للعمليات
    getDetailedActionLog(limit = 50) {
        return this.actionLogs
            .slice(-limit)
            .reverse()
            .map(log => ({
                ...log,
                adminName: `Admin_${log.adminId.slice(-4)}`,
                targetName: log.targetId ? `User_${log.targetId.slice(-4)}` : null,
                formattedDate: new Date(log.timestamp).toLocaleString('ar')
            }));
    }
}

module.exports = AdminManager;
