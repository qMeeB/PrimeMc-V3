const bots = await this.db.getUserData(interaction.user.id, 'bots');
            const bot = bots.find(b => b.id === parseInt(botId) && b.running);
            
            if (!bot) {
                return interaction.update({ 
                    content: '❌ البوت غير موجود أو متوقف!', 
                    components: [], 
                    embeds: [] 
                });
            }
            
            await this.sendMessageToBot(bot, message, interaction, true);
            
        } catch (error) {
            console.error('Chat select error:', error);
            await interaction.update({ 
                content: '❌ حدث خطأ في إرسال الرسالة!', 
                components: [], 
                embeds: [] 
            });
        }
    }

    async sendMessageToBot(botData, message, interaction, isUpdate = false) {
        try {
            const mcBot = global.mcBots?.get(botData.id);
            
            if (!mcBot || !mcBot.sendMessage(message)) {
                const embed = new EmbedBuilder()
                    .setColor('#ff0000')
                    .setTitle('❌ فشل الإرسال')
                    .setDescription('البوت غير متصل أو لا يستطيع إرسال الرسائل')
                    .addFields([
                        { name: '🤖 البوت', value: botData.name, inline: true },
                        { name: '💡 حل', value: 'تأكد من أن البوت متصل', inline: true }
                    ]);
                    
                if (isUpdate) {
                    return interaction.update({ embeds: [embed], components: [] });
                } else {
                    return interaction.reply({ embeds: [embed], ephemeral: true });
                }
            }

            // تحديث إحصائيات الرسائل
            await this.db.updateBotStats(botData.id, { messagesSent: 1 });

            const embed = new EmbedBuilder()
                .setColor('#00ff00')
                .setTitle('✅ تم إرسال الرسالة')
                .addFields([
                    { name: '🤖 البوت', value: botData.name, inline: true },
                    { name: '🌐 السيرفر', value: `${botData.ip}:${botData.port}`, inline: true },
                    { name: '💬 الرسالة', value: `"${message}"`, inline: false },
                    { name: '⏰ وقت الإرسال', value: new Date().toLocaleTimeString('ar'), inline: true }
                ])
                .setFooter({ text: 'تم الإرسال بنجاح' })
                .setTimestamp();

            if (isUpdate) {
                await interaction.update({ embeds: [embed], components: [] });
            } else {
                await interaction.reply({ embeds: [embed], ephemeral: true });
            }

            console.log(`💬 User ${interaction.user.username} sent message via ${botData.name}: ${message}`);
            
        } catch (error) {
            console.error('Send message to bot error:', error);
            const errorMsg = '❌ فشل في إرسال الرسالة!';
            
            if (isUpdate) {
                await interaction.update({ content: errorMsg, components: [], embeds: [] });
            } else {
                await interaction.reply({ content: errorMsg, ephemeral: true });
            }
        }
    }

    async premiumInfo(interaction) {
        try {
            const isPremium = await this.admin.isPremium(interaction.user.id);
            const user = await this.db.getUserData(interaction.user.id, 'user');
            const bots = await this.db.getUserData(interaction.user.id, 'bots');
            
            const embed = new EmbedBuilder()
                .setColor(isPremium ? '#ffd700' : '#ff6b6b')
                .setTitle(isPremium ? '💎 حساب بريميوم' : '🌟 ترقى للبريميوم')
                .setDescription(isPremium ? 'أنت تتمتع بمميزات البريميوم!' : 'احصل على مميزات إضافية مع البريميوم!')
                .addFields([
                    { 
                        name: '🆓 الحساب المجاني', 
                        value: `• حتى ${this.config.MAX_FREE} بوت\n• الميزات الأساسية\n• دعم المجتمع`, 
                        inline: true 
                    },
                    { 
                        name: '💎 حساب البريميوم', 
                        value: `• حتى ${this.config.MAX_PREMIUM} بوت\n• تغيير أسماء البوتات\n• دعم أولوية\n• إحصائيات متقدمة`, 
                        inline: true 
                    },
                    {
                        name: '📊 حسابك الحالي',
                        value: `• النوع: ${isPremium ? '💎 بريميوم' : '🆓 مجاني'}\n• البوتات: ${bots.length}/${isPremium ? this.config.MAX_PREMIUM : this.config.MAX_FREE}`,
                        inline: false
                    }
                ]);

            if (isPremium && user?.expires) {
                const expiryDate = new Date(user.expires);
                const timeLeft = expiryDate.getTime() - Date.now();
                const daysLeft = Math.ceil(timeLeft / (1000 * 60 * 60 * 24));
                
                embed.addFields([
                    { name: '⏰ ينتهي في', value: expiryDate.toLocaleDateString('ar'), inline: true },
                    { name: '⏳ المتبقي', value: `${daysLeft} يوم`, inline: true }
                ]);
                
                if (daysLeft <= 7) {
                    embed.setFooter({ text: '⚠️ سينتهي البريميوم قريباً!' });
                }
            }

            if (!isPremium) {
                embed.setFooter({ text: 'تواصل مع المطورين للحصول على البريميوم' });
            }

            await interaction.reply({ embeds: [embed], ephemeral: true });
            
        } catch (error) {
            console.error('Premium info error:', error);
            await interaction.reply({ 
                content: '❌ حدث خطأ في عرض معلومات البريميوم!', 
                ephemeral: true 
            });
        }
    }

    async renameBot(interaction) {
        try {
            if (!await this.admin.isPremium(interaction.user.id)) {
                const embed = new EmbedBuilder()
                    .setColor('#ff6b6b')
                    .setTitle('💎 ميزة بريميوم')
                    .setDescription('تغيير أسماء البوتات متاح للحسابات المميزة فقط')
                    .addFields([
                        { name: '💡 كيفية الحصول على البريميوم', value: 'تواصل مع المطورين', inline: false }
                    ]);
                    
                return interaction.reply({ embeds: [embed], ephemeral: true });
            }

            const newName = interaction.options.getString('الاسم_الجديد').trim();
            
            // التحقق من صحة الاسم
            if (!/^[a-zA-Z0-9_]{3,16}$/.test(newName)) {
                return interaction.reply({ 
                    content: '❌ اسم غير صحيح! يجب أن يكون بين 3-16 حرف ويحتوي على أحرف وأرقام و _ فقط', 
                    ephemeral: true 
                });
            }

            const bots = await this.db.getUserData(interaction.user.id, 'bots');
            
            if (!bots.length) {
                return interaction.reply({ 
                    content: '❌ ليس لديك أي بوتات لتغيير أسمائها!', 
                    ephemeral: true 
                });
            }

            // التحقق من عدم وجود الاسم مسبقاً
            if (bots.find(b => b.name === newName)) {
                return interaction.reply({ 
                    content: '❌ لديك بوت بهذا الاسم بالفعل!', 
                    ephemeral: true 
                });
            }

            if (bots.length === 1) {
                return this.renameSingleBot(bots[0], newName, interaction);
            }

            const menu = new StringSelectMenuBuilder()
                .setCustomId('rename_select')
                .setPlaceholder('اختر البوت لتغيير اسمه ✏️')
                .addOptions(bots.slice(0, 25).map(bot => ({
                    label: bot.name,
                    value: `${bot.id}:${newName}`,
                    description: `${bot.ip}:${bot.port} | ${bot.running ? '🟢 يعمل' : '🔴 متوقف'}`,
                    emoji: '✏️'
                })));

            const row = new ActionRowBuilder().addComponents(menu);

            const embed = new EmbedBuilder()
                .setColor('#0099ff')
                .setTitle('✏️ تغيير اسم البوت')
                .setDescription(`**الاسم الجديد:** ${newName}`)
                .addFields([
                    { name: '📊 البوتات المتاحة', value: bots.length.toString(), inline: true },
                    { name: '✅ الاسم صحيح', value: 'يمكن استخدامه', inline: true }
                ]);

            await interaction.reply({ 
                embeds: [embed], 
                components: [row], 
                ephemeral: true 
            });
            
        } catch (error) {
            console.error('Rename bot error:', error);
            await interaction.reply({ 
                content: '❌ حدث خطأ في تغيير اسم البوت!', 
                ephemeral: true 
            });
        }
    }

    async handleRenameSelect(interaction) {
        try {
            const [botId, ...nameParts] = interaction.values[0].split(':');
            const newName = nameParts.join(':');
            const bots = await this.db.getUserData(interaction.user.id, 'bots');
            const bot = bots.find(b => b.id === parseInt(botId));
            
            if (!bot) {
                return interaction.update({ 
                    content: '❌ البوت غير موجود!', 
                    components: [], 
                    embeds: [] 
                });
            }
            
            await this.renameSingleBot(bot, newName, interaction, true);
            
        } catch (error) {
            console.error('Rename select error:', error);
            await interaction.update({ 
                content: '❌ حدث خطأ في تغيير الاسم!', 
                components: [], 
                embeds: [] 
            });
        }
    }

    async renameSingleBot(botData, newName, interaction, isUpdate = false) {
        try {
            await this.db.execute('UPDATE bots SET name = ? WHERE id = ?', [newName, botData.id]);
            this.db.clearCache(botData.user_id, ['bots']);

            // تحديث اسم البوت في الذاكرة إذا كان يعمل
            if (botData.running && global.mcBots?.has(botData.id)) {
                const mcBot = global.mcBots.get(botData.id);
                if (mcBot.config) {
                    mcBot.config.name = newName;
                }
            }

            const embed = new EmbedBuilder()
                .setColor('#00ff00')
                .setTitle('✅ تم تغيير الاسم بنجاح!')
                .addFields([
                    { name: '🤖 الاسم القديم', value: botData.name, inline: true },
                    { name: '🆕 الاسم الجديد', value: newName, inline: true },
                    { name: '🌐 السيرفر', value: `${botData.ip}:${botData.port}`, inline: true },
                    { name: '📊 الحالة', value: botData.running ? '🟢 يعمل' : '🔴 متوقف', inline: true },
                    { name: '⏰ تاريخ التغيير', value: new Date().toLocaleDateString('ar'), inline: true }
                ])
                .setFooter({ text: 'تم التحديث بنجاح' })
                .setTimestamp();

            if (isUpdate) {
                await interaction.update({ embeds: [embed], components: [] });
            } else {
                await interaction.reply({ embeds: [embed], ephemeral: true });
            }

            console.log(`✏️ User ${interaction.user.username} renamed bot: ${botData.name} -> ${newName}`);
            
        } catch (error) {
            console.error('Rename single bot error:', error);
            const errorMsg = '❌ فشل في تغيير اسم البوت!';
            
            if (isUpdate) {
                await interaction.update({ content: errorMsg, components: [], embeds: [] });
            } else {
                await interaction.reply({ content: errorMsg, ephemeral: true });
            }
        }
    }

    async botInfo(interaction) {
        try {
            const bots = await this.db.getUserData(interaction.user.id, 'bots');
            const isPremium = await this.admin.isPremium(interaction.user.id);
            const maxBots = isPremium ? this.config.MAX_PREMIUM : this.config.MAX_FREE;

            if (!bots.length) {
                const embed = new EmbedBuilder()
                    .setColor('#ffa500')
                    .setTitle('📋 لا توجد بوتات')
                    .setDescription('ليس لديك أي بوتات مسجلة حالياً')
                    .addFields([
                        { name: '🚀 ابدأ الآن', value: 'استخدم `/اضافة` لإنشاء بوت جديد', inline: false },
                        { name: '📊 الحد المتاح', value: `${maxBots} بوت`, inline: true },
                        { name: '⭐ نوع الحساب', value: isPremium ? '💎 بريميوم' : '🆓 مجاني', inline: true }
                    ]);
                    
                return interaction.reply({ embeds: [embed], ephemeral: true });
            }

            const runningBots = bots.filter(b => b.running).length;
            const stoppedBots = bots.length - runningBots;

            const embed = new EmbedBuilder()
                .setColor('#0099ff')
                .setTitle('🤖 معلومات البوتات')
                .setDescription(`إجمالي البوتات: **${bots.length}/${maxBots}**`)
                .addFields([
                    { name: '🟢 يعمل', value: runningBots.toString(), inline: true },
                    { name: '🔴 متوقف', value: stoppedBots.toString(), inline: true },
                    { name: '⭐ نوع الحساب', value: isPremium ? '💎 بريميوم' : '🆓 مجاني', inline: true }
                ])
                .setTimestamp();

            let botsInfo = '';
            for (const [index, bot] of bots.slice(0, 8).entries()) {
                const status = bot.running ? '🟢' : '🔴';
                let botDetails = `**${index + 1}. ${bot.name}** ${status}\n`;
                botDetails += `📍 ${bot.ip}:${bot.port}\n`;
                botDetails += `🆔 ID: ${bot.id}\n`;
                
                if (bot.running && global.mcBots?.has(bot.id)) {
                    const mcBot = global.mcBots.get(bot.id);
                    const botStatus = mcBot.getDetailedStatus();
                    const networkInfo = mcBot.getNetworkInfo();
                    const healthInfo = mcBot.getHealthInfo();
                    
                    botDetails += `🏓 ${networkInfo.ping}ms (${networkInfo.quality})\n`;
                    botDetails += `⏱️ ${botStatus.uptime}\n`;
                    botDetails += `❤️ ${healthInfo.health}/20 🍖 ${healthInfo.food}/20`;
                } else if (bot.running) {
                    botDetails += `🔄 جاري الاتصال...`;
                } else {
                    botDetails += `⏸️ متوقف`;
                }
                
                botsInfo += botDetails + '\n\n';
            }

            if (bots.length > 8) {
                botsInfo += `**... و ${bots.length - 8} بوت آخر**`;
            }

            embed.addFields([
                { name: '📋 قائمة البوتات', value: botsInfo || 'لا توجد تفاصيل', inline: false }
            ]);

            if (isPremium) {
                embed.setFooter({ text: '💎 حساب بريميوم - مميزات إضافية متاحة' });
            } else {
                embed.setFooter({ text: '💡 ترقى للبريميوم للمزيد من المميزات' });
            }

            // إضافة أزرار للتحديث والتفاصيل
            const refreshButton = new ButtonBuilder()
                .setCustomId('refresh_info')
                .setLabel('تحديث')
                .setStyle(ButtonStyle.Primary)
                .setEmoji('🔄');

            const detailsButton = new ButtonBuilder()
                .setCustomId('details_info')
                .setLabel('تفاصيل أكثر')
                .setStyle(ButtonStyle.Secondary)
                .setEmoji('📊');

            const row = new ActionRowBuilder().addComponents(refreshButton, detailsButton);

            await interaction.reply({ embeds: [embed], components: [row], ephemeral: true });
            
        } catch (error) {
            console.error('Bot info error:', error);
            await interaction.reply({ 
                content: '❌ حدث خطأ في عرض معلومات البوتات!', 
                ephemeral: true 
            });
        }
    }

    async handleRefreshButton(interaction) {
        try {
            await interaction.deferUpdate();
            await this.botInfo(interaction);
        } catch (error) {
            console.error('Refresh button error:', error);
            await interaction.followUp({ 
                content: '❌ حدث خطأ في التحديث!', 
                ephemeral: true 
            });
        }
    }

    async handleDetailsButton(interaction) {
        try {
            const bots = await this.db.getUserData(interaction.user.id, 'bots');
            const stats = await this.db.getStats();
            
            let performanceInfo = '';
            let totalUptime = 0;
            let totalMessages = 0;
            
            for (const bot of bots) {
                if (bot.running && global.mcBots?.has(bot.id)) {
                    const mcBot = global.mcBots.get(bot.id);
                    const perf = mcBot.getPerformanceMetrics();
                    totalUptime += perf.uptime;
                    performanceInfo += `**${bot.name}:** ${Math.round(perf.successRate)}% نجاح\n`;
                }
            }

            const embed = new EmbedBuilder()
                .setColor('#9b59b6')
                .setTitle('📊 إحصائيات مفصلة')
                .addFields([
                    { name: '⏱️ إجمالي وقت التشغيل', value: this.formatUptime(Math.floor(totalUptime / 1000)), inline: true },
                    { name: '💬 الرسائل المرسلة', value: totalMessages.toString(), inline: true },
                    { name: '📈 معدل النجاح', value: performanceInfo || 'لا توجد بيانات', inline: false },
                    { name: '🌐 إحصائيات النظام', value: `👥 ${stats.totalUsers} مستخدم\n🤖 ${stats.totalBots} بوت\n🟢 ${stats.runningBots} يعمل`, inline: true }
                ])
                .setTimestamp();

            await interaction.update({ embeds: [embed], components: [] });
            
        } catch (error) {
            console.error('Details button error:', error);
            await interaction.update({ 
                content: '❌ حدث خطأ في عرض التفاصيل!', 
                components: [] 
            });
        }
    }

    async systemStatus(interaction) {
        try {
            const stats = await this.db.getStats();
            const dbHealth = this.db.getHealthStatus();
            const uptime = Date.now() - this.performance.startTime;

            const embed = new EmbedBuilder()
                .setColor('#00ff00')
                .setTitle('📊 حالة النظام')
                .addFields([
                    { 
                        name: '🤖 البوتات', 
                        value: `إجمالي: ${stats.totalBots}\nيعمل: ${stats.runningBots}\nمتوقف: ${stats.totalBots - stats.runningBots}`, 
                        inline: true 
                    },
                    { 
                        name: '👥 المستخدمين', 
                        value: `إجمالي: ${stats.totalUsers}\nبريميوم: ${stats.premiumUsers}\nمحظور: ${stats.bannedUsers}`, 
                        inline: true 
                    },
                    { 
                        name: '⚡ الأداء', 
                        value: `أوامر: ${this.performance.commandsProcessed}\nمتوسط الاستجابة: ${Math.round(this.performance.averageResponseTime)}ms\nذروة المستخدمين: ${this.performance.peakConcurrentUsers}`, 
                        inline: true 
                    },
                    { 
                        name: '💾 قاعدة البيانات', 
                        value: `متصلة: ${dbHealth.connected ? '✅' : '❌'}\nكاش: ${dbHealth.cacheSize} عنصر\nطابور: ${dbHealth.queueSize} استعلام`, 
                        inline: true 
                    },
                    { 
                        name: '🌐 ديسكورد', 
                        value: `سيرفرات: ${this.client.guilds.cache.size}\nمستخدمين مخزنين: ${this.client.users.cache.size}\nاتصال: ${this.client.ws.ping}ms`, 
                        inline: true 
                    },
                    { 
                        name: '⏱️ وقت التشغيل', 
                        value: this.formatUptime(Math.floor(uptime / 1000)), 
                        inline: true 
                    },
                    { 
                        name: '💻 الذاكرة', 
                        value: `${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB`, 
                        inline: true 
                    },
                    { 
                        name: '🚫 الأخطاء', 
                        value: `أخطاء: ${this.performance.errorCount}\nأنماط فريدة: ${this.errorPatterns.size}`, 
                        inline: true 
                    },
                    { 
                        name: '🔥 الأوامر الأكثر استخداماً', 
                        value: this.getTopCommands(), 
                        inline: false 
                    }
                ])
                .setFooter({ text: 'تحديث مباشر' })
                .setTimestamp();

            // تحديد لون حسب حالة النظام
            const systemHealth = this.getSystemHealth();
            embed.setColor(systemHealth.color);
            embed.setDescription(`**حالة النظام:** ${systemHealth.status}`);

            await interaction.reply({ embeds: [embed], ephemeral: true });
            
        } catch (error) {
            console.error('System status error:', error);
            await interaction.reply({ 
                content: '❌ حدث خطأ في عرض حالة النظام!', 
                ephemeral: true 
            });
        }
    }

    getSystemHealth() {
        const dbHealth = this.db.getHealthStatus();
        const avgResponseTime = this.performance.averageResponseTime;
        const errorRate = this.performance.commandsProcessed > 0 ? 
            (this.performance.errorCount / this.performance.commandsProcessed) * 100 : 0;

        if (!dbHealth.connected || avgResponseTime > 5000 || errorRate > 10) {
            return { status: '🔴 غير مستقر', color: '#ff0000' };
        } else if (avgResponseTime > 2000 || errorRate > 5) {
            return { status: '🟡 مستقر نسبياً', color: '#ffaa00' };
        } else {
            return { status: '🟢 ممتاز', color: '#00ff00' };
        }
    }

    getTopCommands() {
        const sorted = Array.from(this.commandStats.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5);
        
        if (sorted.length === 0) return 'لا توجد بيانات';
        
        return sorted.map(([cmd, count], index) => 
            `${index + 1}. ${cmd}: ${count}`
        ).join('\n');
    }

    async showHelp(interaction) {
        try {
            const embed = new EmbedBuilder()
                .setColor('#0099ff')
                .setTitle('📚 دليل الاستخدام')
                .setDescription('مرحباً بك في بوت إدارة ماين كرافت! إليك كيفية الاستخدام:')
                .addFields([
                    {
                        name: '🚀 البدء السريع',
                        value: '1. `/اضافة` - أضف بوت جديد\n2. `/تشغيل` - شغل البوت\n3. `/معلومات` - اعرض حالة البوتات',
                        inline: false
                    },
                    {
                        name: '🎮 الأوامر الأساسية',
                        value: '• `/اضافة [سيرفر] [بورت]` - إضافة بوت\n• `/تشغيل` - تشغيل بوت\n• `/ايقاف` - إيقاف بوت\n• `/حذف` - حذف بوت\n• `/كتابة [رسالة]` - إرسال رسالة',
                        inline: true
                    },
                    {
                        name: '💎 مميزات البريميوم',
                        value: '• `/تغيير_اسم` - تغيير اسم البوت\n• `/البريميوم` - معلومات البريميوم\n• حتى 10 بوتات\n• دعم أولوية',
                        inline: true
                    },
                    {
                        name: '📊 المعلومات',
                        value: '• `/معلومات` - تفاصيل البوتات\n• `/حالة` - حالة النظام\n• `/مساعدة` - هذا الدليل',
                        inline: true
                    },
                    {
                        name: '⚡ نصائح مهمة',
                        value: '• البوتات تحارب الـ AFK تلقائياً\n• تنام في الليل\n• تتحرك بشكل طبيعي\n• مقاومة للأخطاء',
                        inline: false
                    },
                    {
                        name: '🔧 استكشاف الأخطاء',
                        value: '• تأكد من صحة عنوان السيرفر\n• تأكد من أن السيرفر يقبل اللاعبين\n• تأكد من رقم البورت الصحيح\n• استخدم `/حالة` لمراقبة النظام',
                        inline: false
                    },
                    {
                        name: '📞 الدعم',
                        value: 'لأي مساعدة إضافية أو للحصول على البريميوم، تواصل مع المطورين',
                        inline: false
                    }
                ])
                .setFooter({ text: 'بوت ماين كرافت المتقدم - نسخة محسنة' })
                .setTimestamp();

            await interaction.reply({ embeds: [embed], ephemeral: true });
            
        } catch (error) {
            console.error('Show help error:', error);
            await interaction.reply({ 
                content: '❌ حدث خطأ في عرض دليل المساعدة!', 
                ephemeral: true 
            });
        }
    }

    async handleInteractionError(interaction, error) {
        const errorEmbed = new EmbedBuilder()
            .setColor('#ff0000')
            .setTitle('❌ حدث خطأ')
            .setDescription('عذراً، حدث خطأ غير متوقع أثناء تنفيذ الأمر')
            .addFields([
                { name: '🔧 ماذا يمكنك فعله؟', value: '• جرب الأمر مرة أخرى\n• تأكد من صحة البيانات المدخلة\n• انتظر قليلاً ثم حاول مرة أخرى', inline: false },
                { name: '📞 الدعم', value: 'إذا استمر الخطأ، تواصل مع المطورين', inline: false }
            ])
            .setTimestamp();

        try {
            if (!interaction.replied && !interaction.deferred) {
                await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
            } else if (interaction.deferred) {
                await interaction.editReply({ embeds: [errorEmbed] });
            } else if (interaction.isRepliable()) {
                await interaction.followUp({ embeds: [errorEmbed], ephemeral: true });
            }
        } catch (followUpError) {
            console.error('Failed to send error message:', followUpError);
        }
    }

    async sendBotNotification(userId, message, type = 'info') {
        try {
            const user = await this.client.users.fetch(userId);
            const colors = {
                info: '#0099ff',
                warning: '#ffaa00',
                error: '#ff0000',
                success: '#00ff00'
            };
            
            const emojis = {
                info: 'ℹ️',
                warning: '⚠️',
                error: '❌',
                success: '✅'
            };

            const embed = new EmbedBuilder()
                .setColor(colors[type] || colors.info)
                .setTitle(`${emojis[type] || emojis.info} إشعار البوت`)
                .setDescription(message)
                .setTimestamp();

            await user.send({ embeds: [embed] });
            console.log(`📨 Notification sent to ${userId}: ${message}`);
            
        } catch (error) {
            console.error(`Failed to send notification to ${userId}:`, error.message);
        }
    }

    isValidIP(ip) {
        // فحص IPv4
        const ipv4Regex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
        
        // فحص النطاق (Domain)
        const domainRegex = /^[a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?)*$/;
        
        // فحص النطاقات الشائعة لماين كرافت
        const minecraftDomains = [
            'localhost',
            'hypixel.net',
            'mineplex.com',
            'cubecraft.net'
        ];
        
        return ipv4Regex.test(ip) || domainRegex.test(ip) || minecraftDomains.includes(ip.toLowerCase());
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

    startPeriodicSync() {
        // مزامنة حالة البوتات كل 5 دقائق
        setInterval(async () => {
            try {
                await this.db.syncBotStates();
            } catch (error) {
                console.error('Periodic sync error:', error);
            }
        }, 300000);
        
        console.log('🔄 Periodic sync scheduler started');
    }

    startPeriodicCleanup() {
        // تنظيف دوري كل 10 دقائق
        setInterval(() => {
            try {
                // تنظيف الكولداون القديم
                const now = Date.now();
                for (const [key, timestamp] of this.cooldowns) {
                    if (now > timestamp) {
                        this.cooldowns.delete(key);
                    }
                }
                
                // تنظيف معدل الاستخدام القديم
                for (const [key, data] of this.rateLimiter) {
                    if (now > data.window) {
                        this.rateLimiter.delete(key);
                    }
                }
                
                // تنظيف الكاش القديم
                for (const [key, data] of this.responseCache) {
                    if (now - data.timestamp > this.cacheTimeout) {
                        this.responseCache.delete(key);
                    }
                }
                
                // تنظيف طوابير المستخدمين الفارغة
                for (const [userId, queue] of this.userQueues) {
                    if (queue.length === 0) {
                        this.userQueues.delete(userId);
                    }
                }
                
                // Garbage collection إذا كان متاحاً
                if (global.gc) {
                    global.gc();
                }
                
                console.log(`🧹 Cleanup completed: ${this.cooldowns.size} cooldowns, ${this.rateLimiter.size} rate limits, ${this.userQueues.size} user queues`);
                
            } catch (error) {
                console.error('Periodic cleanup error:', error);
            }
        }, 600000); // كل 10 دقائق
        
        console.log('🕐 Enhanced periodic cleanup scheduler started');
    }

    startPerformanceMonitoring() {
        // مراقبة الأداء كل دقيقة
        setInterval(() => {
            try {
                // تحديث إحصائيات الأداء
                const memoryUsage = process.memoryUsage();
                const uptime = Date.now() - this.performance.startTime;
                
                // تسجيل إحصائيات مهمة
                if (this.performance.commandsProcessed % 100 === 0 && this.performance.commandsProcessed > 0) {
                    console.log(`📊 Performance update: ${this.performance.commandsProcessed} commands processed, avg response time: ${Math.round(this.performance.averageResponseTime)}ms`);
                }
                
                // تحذير من استخدام الذاكرة المرتفع
                const memoryMB = Math.round(memoryUsage.heapUsed / 1024 / 1024);
                if (memoryMB > 500) {
                    console.warn(`⚠️ High memory usage: ${memoryMB}MB`);
                }
                
                // تحذير من وقت الاستجابة البطيء
                if (this.performance.averageResponseTime > 3000) {
                    console.warn(`⚠️ Slow response time: ${Math.round(this.performance.averageResponseTime)}ms`);
                }
                
            } catch (error) {
                console.error('Performance monitoring error:', error);
            }
        }, 60000); // كل دقيقة
        
        console.log('📊 Performance monitoring started');
    }

    updateBotStatus() {
        // تحديث حالة البوت كل 5 دقائق
        setInterval(async () => {
            try {
                const stats = await this.db.getStats();
                const activity = {
                    name: `${stats.runningBots} بوت يعمل | ${stats.totalUsers} مستخدم`,
                    type: 3 // WATCHING
                };
                
                this.client.user.setActivity(activity);
                
            } catch (error) {
                console.error('Update bot status error:', error);
            }
        }, 300000); // كل 5 دقائق
    }

    async start() {
        try {
            console.log('🚀 Starting enhanced Discord bot...');
            await this.client.login(process.env.DISCORD_TOKEN);
            console.log('✅ Discord bot logged in successfully');
        } catch (error) {
            console.error('❌ Discord bot start error:', error);
            throw error;
        }
    }

    async shutdown() {
        console.log('🔄 Shutting down Discord bot...');
        
        try {
            // إيقاف جميع البوتات
            if (global.mcBots && global.mcBots.size > 0) {
                console.log(`🛑 Stopping ${global.mcBots.size} Minecraft bots...`);
                for (const [id, bot] of global.mcBots) {
                    try { 
                        bot.destroy(); 
                        console.log(`✅ Stopped bot ${id}`);
                    } catch (e) {
                        console.error(`❌ Error stopping bot ${id}:`, e.message);
                    }
                }
                global.mcBots.clear();
                console.log('✅ All Minecraft bots stopped');
            }

            // تنظيف البيانات المؤقتة
            this.cooldowns.clear();
            this.userQueues.clear();
            this.rateLimiter.clear();
            this.globalRateLimit.clear();
            this.responseCache.clear();
            this.commandStats.clear();
            this.errorPatterns.clear();
            
            console.log('🧹 Cleared all temporary data');

            // إغلاق قاعدة البيانات
            if (this.db) {
                await this.db.close();
                console.log('✅ Database connection closed');
            }

            // إغلاق عميل Discord
            if (this.client) {
                await this.client.destroy();
                console.log('✅ Discord client destroyed');
            }
            
            console.log('✅ Enhanced Discord bot shutdown complete');
        } catch (error) {
            console.error('❌ Error during Discord bot shutdown:', error);
            throw error;
        }
    }

    // دوال مساعدة للإحصائيات والمراقبة
    getSystemMetrics() {
        return {
            performance: this.performance,
            queues: {
                userQueues: this.userQueues.size,
                totalQueuedCommands: Array.from(this.userQueues.values()).reduce((sum, queue) => sum + queue.length, 0)
            },
            cache: {
                rateLimiter: this.rateLimiter.size,
                cooldowns: this.cooldowns.size,
                responseCache: this.responseCache.size
            },
            commands: Object.fromEntries(this.commandStats),
            errors: Object.fromEntries(this.errorPatterns)
        };
    }

    // دالة للحصول على معلومات صحة النظام
    getHealthCheck() {
        const dbHealth = this.db.getHealthStatus();
        const systemHealth = this.getSystemHealth();
        
        return {
            status: systemHealth.status,
            discord: {
                connected: this.client.isReady(),
                guilds: this.client.guilds.cache.size,
                users: this.client.users.cache.size,
                ping: this.client.ws.ping
            },
            database: dbHealth,
            performance: {
                averageResponseTime: this.performance.averageResponseTime,
                commandsProcessed: this.performance.commandsProcessed,
                errorRate: this.performance.commandsProcessed > 0 ? 
                    (this.performance.errorCount / this.performance.commandsProcessed) * 100 : 0
            },
            memory: {
                used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
                total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024)
            },
            uptime: Date.now() - this.performance.startTime
        };
    }
}

module.exports = DiscordBot;                'تغيير_اسم': () => this.renameBot(interaction),
                'معلومات': () => this.botInfo(interaction),
                'حالة': () => this.systemStatus(interaction),
                'مساعدة': () => this.showHelp(interaction),
                'ادمن': () => this.admin.handleCommand(interaction)
            };

            const handler = commands[commandName];
            if (handler) {
                await handler();
            } else {
                await interaction.reply({ 
                    content: '❌ أمر غير معروف!', 
                    ephemeral: true 
                });
            }
            
            // تسجيل وقت الاستجابة
            const responseTime = Date.now() - startTime;
            console.log(`⚡ Command ${commandName} processed in ${responseTime}ms`);
            
        } catch (error) {
            console.error(`❌ Command handling error:`, error);
            await this.handleInteractionError(interaction, error);
        }
    }

    async handleComponentInteraction(interaction) {
        const customId = interaction.customId;
        const [action, ...params] = customId.split('_');
        
        const handlers = {
            'start': () => this.handleStartSelect(interaction),
            'stop': () => this.handleStopSelect(interaction),
            'chat': () => this.handleChatSelect(interaction),
            'rename': () => this.handleRenameSelect(interaction),
            'delete': () => this.handleDeleteSelect(interaction),
            'refresh': () => this.handleRefreshButton(interaction),
            'details': () => this.handleDetailsButton(interaction)
        };
        
        const handler = handlers[action];
        if (handler) {
            await handler();
        }
    }

    extractUserIP(interaction) {
        // محاولة استخراج IP من البيانات المتاحة
        // هذا مثال أساسي - قد تحتاج لتحسينه حسب البيئة
        return interaction.user.id.slice(-3); // استخدام جزء من ID كمعرف فريد
    }

    async sendBannedMessage(interaction) {
        const embed = new EmbedBuilder()
            .setColor('#ff0000')
            .setTitle('🚫 محظور')
            .setDescription('تم حظرك من استخدام البوت')
            .addFields([
                { name: '📞 للاستفسار', value: 'تواصل مع المطورين', inline: true },
                { name: '⏰ تاريخ الحظر', value: new Date().toLocaleDateString('ar'), inline: true }
            ])
            .setTimestamp();

        try {
            await interaction.reply({ embeds: [embed], ephemeral: true });
        } catch (error) {
            console.error('Failed to send banned message:', error);
        }
    }

    recordCommandUsage(commandName) {
        const count = this.commandStats.get(commandName) || 0;
        this.commandStats.set(commandName, count + 1);
    }

    updatePerformanceMetrics(responseTime) {
        this.performance.commandsProcessed++;
        this.performance.averageResponseTime = 
            (this.performance.averageResponseTime * (this.performance.commandsProcessed - 1) + responseTime) / 
            this.performance.commandsProcessed;
    }

    updatePeakUsers() {
        const currentUsers = this.userQueues.size;
        if (currentUsers > this.performance.peakConcurrentUsers) {
            this.performance.peakConcurrentUsers = currentUsers;
        }
    }

    recordError(type, error) {
        const errorKey = `${type}_${error.message}`;
        const count = this.errorPatterns.get(errorKey) || 0;
        this.errorPatterns.set(errorKey, count + 1);
    }

    async addBot(interaction) {
        try {
            await interaction.deferReply({ ephemeral: true });
            
            const ip = interaction.options.getString('السيرفر').trim();
            const port = interaction.options.getInteger('البورت');
            
            if (!this.isValidIP(ip)) {
                return interaction.editReply({ 
                    content: '❌ عنوان السيرفر غير صحيح! يجب أن يكون IP صالح أو نطاق صحيح' 
                });
            }
            
            const bots = await this.db.getUserData(interaction.user.id, 'bots');
            const isPremium = await this.admin.isPremium(interaction.user.id);
            const maxBots = isPremium ? this.config.MAX_PREMIUM : this.config.MAX_FREE;

            if (bots.length >= maxBots) {
                const embed = new EmbedBuilder()
                    .setColor('#ff6b6b')
                    .setTitle('❌ وصلت للحد الأقصى')
                    .setDescription(`لديك ${bots.length}/${maxBots} بوت`)
                    .addFields([
                        { name: '💡 حل', value: isPremium ? 'احذف بوت لإضافة جديد' : 'ترقى للبريميوم للمزيد', inline: false }
                    ]);
                    
                return interaction.editReply({ embeds: [embed] });
            }

            // التحقق من وجود بوت على نفس السيرفر
            if (bots.find(b => b.ip === ip && b.port === port)) {
                return interaction.editReply({ 
                    content: '❌ لديك بوت على هذا السيرفر بالفعل!' 
                });
            }

            // الحصول على اسم البوت التالي
            const { name: botName, index: botIndex } = await this.db.getNextBotName(interaction.user.id);
            
            // إضافة البوت لقاعدة البيانات
            const botId = await this.db.addBot(interaction.user.id, botName, ip, port, botIndex);

            const embed = new EmbedBuilder()
                .setColor('#00ff00')
                .setTitle('✅ تم إضافة البوت بنجاح!')
                .addFields([
                    { name: '🤖 اسم البوت', value: botName, inline: true },
                    { name: '🌐 السيرفر', value: `${ip}:${port}`, inline: true },
                    { name: '🆔 معرف البوت', value: botId.toString(), inline: true },
                    { name: '📊 البوتات', value: `${bots.length + 1}/${maxBots}`, inline: true },
                    { name: '⭐ الحالة', value: isPremium ? '💎 بريميوم' : '🆓 مجاني', inline: true },
                    { name: '🎯 الخطوة التالية', value: 'استخدم `/تشغيل` لبدء البوت', inline: false }
                ])
                .setFooter({ text: 'تم إنشاء البوت بنجاح' })
                .setTimestamp();

            await interaction.editReply({ embeds: [embed] });
            console.log(`✅ User ${interaction.user.username} added bot: ${botName} (${ip}:${port})`);
            
        } catch (error) {
            console.error('Add bot error:', error);
            await interaction.editReply({ 
                content: '❌ حدث خطأ في إضافة البوت! حاول مرة أخرى' 
            });
        }
    }

    async deleteBot(interaction) {
        try {
            const bots = await this.db.getUserData(interaction.user.id, 'bots');
            
            if (!bots.length) {
                return interaction.reply({ 
                    content: '❌ ليس لديك أي بوتات لحذفها!', 
                    ephemeral: true 
                });
            }

            if (bots.length === 1) {
                return this.deleteSingleBot(bots[0], interaction);
            }

            const menu = new StringSelectMenuBuilder()
                .setCustomId('delete_select')
                .setPlaceholder('اختر البوت لحذفه نهائياً ⚠️')
                .addOptions(bots.slice(0, 25).map(bot => ({
                    label: bot.name,
                    value: bot.id.toString(),
                    description: `${bot.ip}:${bot.port} | ${bot.running ? '🟢 يعمل' : '🔴 متوقف'}`,
                    emoji: bot.running ? '🟢' : '🔴'
                })));

            const row = new ActionRowBuilder().addComponents(menu);

            const embed = new EmbedBuilder()
                .setColor('#ff9900')
                .setTitle('⚠️ حذف البوت')
                .setDescription('**تحذير:** الحذف نهائي ولا يمكن التراجع عنه!')
                .addFields([
                    { name: '📝 ملاحظة', value: 'سيتم إيقاف البوت تلقائياً إذا كان يعمل', inline: false }
                ]);

            await interaction.reply({ 
                embeds: [embed], 
                components: [row], 
                ephemeral: true 
            });
            
        } catch (error) {
            console.error('Delete bot error:', error);
            await interaction.reply({ 
                content: '❌ حدث خطأ في عرض قائمة البوتات!', 
                ephemeral: true 
            });
        }
    }

    async handleDeleteSelect(interaction) {
        try {
            const botId = parseInt(interaction.values[0]);
            const bots = await this.db.getUserData(interaction.user.id, 'bots');
            const bot = bots.find(b => b.id === botId);
            
            if (!bot) {
                return interaction.update({ 
                    content: '❌ البوت غير موجود!', 
                    components: [], 
                    embeds: [] 
                });
            }
            
            await this.deleteSingleBot(bot, interaction, true);
            
        } catch (error) {
            console.error('Delete select error:', error);
            await interaction.update({ 
                content: '❌ حدث خطأ في حذف البوت!', 
                components: [], 
                embeds: [] 
            });
        }
    }

    async deleteSingleBot(botData, interaction, isUpdate = false) {
        try {
            // إيقاف البوت إذا كان يعمل
            if (botData.running && global.mcBots?.has(botData.id)) {
                const mcBot = global.mcBots.get(botData.id);
                try { 
                    mcBot.stop(); 
                    global.mcBots.delete(botData.id); 
                } catch (e) {
                    console.warn('Warning stopping bot during delete:', e.message);
                }
            }

            // حذف البوت من قاعدة البيانات
            await this.db.execute('DELETE FROM bots WHERE id = ? AND user_id = ?', [botData.id, botData.user_id]);
            await this.db.execute('DELETE FROM bot_stats WHERE bot_id = ?', [botData.id]);
            this.db.clearCache(botData.user_id, ['bots']);

            const embed = new EmbedBuilder()
                .setColor('#ff0000')
                .setTitle('🗑️ تم حذف البوت!')
                .addFields([
                    { name: '🤖 البوت المحذوف', value: botData.name, inline: true },
                    { name: '🌐 السيرفر', value: `${botData.ip}:${botData.port}`, inline: true },
                    { name: '⏰ تاريخ الحذف', value: new Date().toLocaleDateString('ar'), inline: true }
                ])
                .setFooter({ text: 'تم الحذف نهائياً' })
                .setTimestamp();

            if (isUpdate) {
                await interaction.update({ embeds: [embed], components: [] });
            } else {
                await interaction.reply({ embeds: [embed], ephemeral: true });
            }

            console.log(`🗑️ User ${interaction.user.username} deleted bot: ${botData.name}`);
            
        } catch (error) {
            console.error('Delete single bot error:', error);
            const errorMsg = '❌ فشل في حذف البوت!';
            
            if (isUpdate) {
                await interaction.update({ content: errorMsg, components: [], embeds: [] });
            } else {
                await interaction.reply({ content: errorMsg, ephemeral: true });
            }
        }
    }

    async startBot(interaction) {
        try {
            const bots = await this.db.getUserData(interaction.user.id, 'bots');
            const stoppedBots = bots.filter(b => !b.running);
            
            if (!stoppedBots.length) {
                const embed = new EmbedBuilder()
                    .setColor('#ffa500')
                    .setTitle('⚠️ لا توجد بوتات متوقفة')
                    .setDescription('جميع بوتاتك تعمل بالفعل أو ليس لديك بوتات')
                    .addFields([
                        { name: '💡 اقتراح', value: 'استخدم `/معلومات` لعرض حالة البوتات', inline: false }
                    ]);
                    
                return interaction.reply({ embeds: [embed], ephemeral: true });
            }

            if (stoppedBots.length === 1) {
                return this.startSingleBot(stoppedBots[0], interaction);
            }

            const menu = new StringSelectMenuBuilder()
                .setCustomId('start_select')
                .setPlaceholder('اختر البوت للتشغيل 🚀')
                .addOptions(stoppedBots.slice(0, 25).map(bot => ({
                    label: bot.name,
                    value: bot.id.toString(),
                    description: `${bot.ip}:${bot.port}`,
                    emoji: '🔴'
                })));

            const row = new ActionRowBuilder().addComponents(menu);

            const embed = new EmbedBuilder()
                .setColor('#0099ff')
                .setTitle('🚀 تشغيل البوت')
                .setDescription('اختر البوت الذي تريد تشغيله')
                .addFields([
                    { name: '📊 البوتات المتوقفة', value: stoppedBots.length.toString(), inline: true },
                    { name: '⏱️ وقت البدء المتوقع', value: '10-30 ثانية', inline: true }
                ]);

            await interaction.reply({ 
                embeds: [embed], 
                components: [row], 
                ephemeral: true 
            });
            
        } catch (error) {
            console.error('Start bot error:', error);
            await interaction.reply({ 
                content: '❌ حدث خطأ في عرض البوتات المتوقفة!', 
                ephemeral: true 
            });
        }
    }

    async handleStartSelect(interaction) {
        try {
            const botId = parseInt(interaction.values[0]);
            const bots = await this.db.getUserData(interaction.user.id, 'bots');
            const bot = bots.find(b => b.id === botId && !b.running);
            
            if (!bot) {
                return interaction.update({ 
                    content: '❌ البوت غير موجود أو يعمل بالفعل!', 
                    components: [], 
                    embeds: [] 
                });
            }
            
            await this.startSingleBot(bot, interaction, true);
            
        } catch (error) {
            console.error('Start select error:', error);
            await interaction.update({ 
                content: '❌ حدث خطأ في تشغيل البوت!', 
                components: [], 
                embeds: [] 
            });
        }
    }

    async startSingleBot(botData, interaction, isUpdate = false) {
        try {
            const loadingEmbed = new EmbedBuilder()
                .setColor('#ffaa00')
                .setTitle('⏳ جاري تشغيل البوت...')
                .setDescription(`تشغيل **${botData.name}** على ${botData.ip}:${botData.port}`)
                .addFields([
                    { name: '⏱️ الوقت المتوقع', value: '10-30 ثانية', inline: true },
                    { name: '🔄 الحالة', value: 'الاتصال بالسيرفر...', inline: true }
                ])
                .setTimestamp();

            if (isUpdate) {
                await interaction.update({ embeds: [loadingEmbed], components: [] });
            } else {
                await interaction.reply({ embeds: [loadingEmbed], ephemeral: true });
            }

            // إنشاء بوت ماين كرافت جديد
            const mcBot = new MinecraftBot({ 
                id: botData.id,
                name: botData.name, 
                ip: botData.ip, 
                port: botData.port,
                userId: botData.user_id,
                onNotification: (message, type) => this.sendBotNotification(botData.user_id, message, type),
                onStatsUpdate: (botId, stats) => this.db.updateBotStats(botId, stats)
            });
            
            // محاولة تشغيل البوت
            const status = await mcBot.start();
            
            // إضافة البوت للخريطة العامة
            if (!global.mcBots) global.mcBots = new Map();
            global.mcBots.set(botData.id, mcBot);
            
            // تحديث حالة البوت في قاعدة البيانات
            await this.db.execute('UPDATE bots SET running = 1, last_start = datetime("now") WHERE id = ?', [botData.id]);
            await this.db.updateBotStats(botData.id, { totalConnections: 1, successfulConnections: 1 });
            this.db.clearCache(botData.user_id, ['bots']);

            const successEmbed = new EmbedBuilder()
                .setColor('#00ff00')
                .setTitle('✅ تم تشغيل البوت بنجاح!')
                .addFields([
                    { name: '🤖 البوت', value: botData.name, inline: true },
                    { name: '🌐 السيرفر', value: `${botData.ip}:${botData.port}`, inline: true },
                    { name: '📊 الحالة', value: '🟢 متصل', inline: true },
                    { name: '💓 الصحة', value: `${status.stats.health}/20`, inline: true },
                    { name: '🍖 الطعام', value: `${status.stats.food}/20`, inline: true },
                    { name: '🏓 البينق', value: `${status.stats.ping}ms`, inline: true }
                ])
                .setFooter({ text: 'البوت يعمل الآن ومقاوم للـ AFK' })
                .setTimestamp();

            await interaction.editReply({ embeds: [successEmbed] });
            console.log(`✅ User ${interaction.user.username} started bot: ${botData.name}`);
            
        } catch (error) {
            console.error('Start single bot error:', error);
            
            // تنظيف في حالة الفشل
            if (global.mcBots?.has(botData.id)) {
                try { 
                    const mcBot = global.mcBots.get(botData.id);
                    mcBot.stop(); 
                    global.mcBots.delete(botData.id); 
                } catch (e) {}
            }
            
            await this.db.execute('UPDATE bots SET running = 0 WHERE id = ?', [botData.id]);
            
            const errorEmbed = new EmbedBuilder()
                .setColor('#ff0000')
                .setTitle('❌ فشل في تشغيل البوت')
                .addFields([
                    { name: '🤖 البوت', value: botData.name, inline: true },
                    { name: '❌ السبب', value: error.message || 'خطأ في الاتصال', inline: false },
                    { name: '💡 اقتراحات', value: '• تأكد من صحة عنوان السيرفر\n• تأكد من أن السيرفر يعمل\n• جرب مرة أخرى خلال دقائق', inline: false }
                ])
                .setTimestamp();

            await interaction.editReply({ embeds: [errorEmbed] });
        }
    }

    async stopBot(interaction) {
        try {
            const bots = await this.db.getUserData(interaction.user.id, 'bots');
            const runningBots = bots.filter(b => b.running);
            
            if (!runningBots.length) {
                const embed = new EmbedBuilder()
                    .setColor('#ffa500')
                    .setTitle('⚠️ لا توجد بوتات تعمل')
                    .setDescription('جميع بوتاتك متوقفة بالفعل أو ليس لديك بوتات')
                    .addFields([
                        { name: '💡 اقتراح', value: 'استخدم `/تشغيل` لبدء البوتات', inline: false }
                    ]);
                    
                return interaction.reply({ embeds: [embed], ephemeral: true });
            }

            if (runningBots.length === 1) {
                return this.stopSingleBot(runningBots[0], interaction);
            }

            const menu = new StringSelectMenuBuilder()
                .setCustomId('stop_select')
                .setPlaceholder('اختر البوت لإيقافه 🛑')
                .addOptions(runningBots.slice(0, 25).map(bot => ({
                    label: bot.name,
                    value: bot.id.toString(),
                    description: `${bot.ip}:${bot.port}`,
                    emoji: '🟢'
                })));

            const row = new ActionRowBuilder().addComponents(menu);

            const embed = new EmbedBuilder()
                .setColor('#ff9900')
                .setTitle('🛑 إيقاف البوت')
                .setDescription('اختر البوت الذي تريد إيقافه')
                .addFields([
                    { name: '📊 البوتات العاملة', value: runningBots.length.toString(), inline: true },
                    { name: '⏱️ وقت الإيقاف', value: 'فوري', inline: true }
                ]);

            await interaction.reply({ 
                embeds: [embed], 
                components: [row], 
                ephemeral: true 
            });
            
        } catch (error) {
            console.error('Stop bot error:', error);
            await interaction.reply({ 
                content: '❌ حدث خطأ في عرض البوتات العاملة!', 
                ephemeral: true 
            });
        }
    }

    async handleStopSelect(interaction) {
        try {
            const botId = parseInt(interaction.values[0]);
            const bots = await this.db.getUserData(interaction.user.id, 'bots');
            const bot = bots.find(b => b.id === botId && b.running);
            
            if (!bot) {
                return interaction.update({ 
                    content: '❌ البوت غير موجود أو متوقف بالفعل!', 
                    components: [], 
                    embeds: [] 
                });
            }
            
            await this.stopSingleBot(bot, interaction, true);
            
        } catch (error) {
            console.error('Stop select error:', error);
            await interaction.update({ 
                content: '❌ حدث خطأ في إيقاف البوت!', 
                components: [], 
                embeds: [] 
            });
        }
    }

    async stopSingleBot(botData, interaction, isUpdate = false) {
        try {
            const mcBot = global.mcBots?.get(botData.id);
            let botStatus = null;
            
            if (mcBot) {
                botStatus = mcBot.getDetailedStatus();
                mcBot.stop();
                global.mcBots.delete(botData.id);
            }
            
            await this.db.execute('UPDATE bots SET running = 0 WHERE id = ?', [botData.id]);
            this.db.clearCache(botData.user_id, ['bots']);

            const embed = new EmbedBuilder()
                .setColor('#ff9900')
                .setTitle('🛑 تم إيقاف البوت!')
                .addFields([
                    { name: '🤖 البوت', value: botData.name, inline: true },
                    { name: '📊 الحالة', value: '🔴 متوقف', inline: true },
                    { name: '⏰ تاريخ الإيقاف', value: new Date().toLocaleString('ar'), inline: true }
                ]);

            if (botStatus) {
                embed.addFields([
                    { name: '⏱️ مدة التشغيل', value: botStatus.uptime, inline: true },
                    { name: '🏓 آخر بينق', value: `${botStatus.stats.ping}ms`, inline: true },
                    { name: '📈 الأداء', value: `${botStatus.performance.successRate}%`, inline: true }
                ]);
            }

            embed.setFooter({ text: 'يمكنك إعادة تشغيله في أي وقت' })
                .setTimestamp();

            if (isUpdate) {
                await interaction.update({ embeds: [embed], components: [] });
            } else {
                await interaction.reply({ embeds: [embed], ephemeral: true });
            }

            console.log(`🛑 User ${interaction.user.username} stopped bot: ${botData.name}`);
            
        } catch (error) {
            console.error('Stop single bot error:', error);
            
            // محاولة تنظيف في حالة الخطأ
            try {
                await this.db.execute('UPDATE bots SET running = 0 WHERE id = ?', [botData.id]);
                this.db.clearCache(botData.user_id, ['bots']);
            } catch (e) {}
            
            const errorMsg = '❌ حدث خطأ في إيقاف البوت، لكن تم تحديث الحالة';
            
            if (isUpdate) {
                await interaction.update({ content: errorMsg, components: [], embeds: [] });
            } else {
                await interaction.reply({ content: errorMsg, ephemeral: true });
            }
        }
    }

    async sendChat(interaction) {
        try {
            const message = interaction.options.getString('الرسالة').trim();
            const bots = await this.db.getUserData(interaction.user.id, 'bots');
            const runningBots = bots.filter(b => b.running);
            
            if (!runningBots.length) {
                const embed = new EmbedBuilder()
                    .setColor('#ffa500')
                    .setTitle('⚠️ لا توجد بوتات تعمل')
                    .setDescription('يجب أن يكون لديك بوت واحد على الأقل يعمل لإرسال الرسائل')
                    .addFields([
                        { name: '💡 حل', value: 'استخدم `/تشغيل` لبدء أحد البوتات', inline: false }
                    ]);
                    
                return interaction.reply({ embeds: [embed], ephemeral: true });
            }

            if (runningBots.length === 1) {
                return this.sendMessageToBot(runningBots[0], message, interaction);
            }

            const menu = new StringSelectMenuBuilder()
                .setCustomId('chat_select')
                .setPlaceholder('اختر البوت لإرسال الرسالة 💬')
                .addOptions(runningBots.slice(0, 25).map(bot => ({
                    label: bot.name,
                    value: `${bot.id}:${message}`,
                    description: `${bot.ip}:${bot.port}`,
                    emoji: '💬'
                })));

            const row = new ActionRowBuilder().addComponents(menu);

            const embed = new EmbedBuilder()
                .setColor('#0099ff')
                .setTitle('💬 إرسال رسالة')
                .setDescription(`**الرسالة:** "${message}"`)
                .addFields([
                    { name: '📊 البوتات المتاحة', value: runningBots.length.toString(), inline: true },
                    { name: '📝 طول الرسالة', value: `${message.length} حرف`, inline: true }
                ]);

            await interaction.reply({ 
                embeds: [embed], 
                components: [row], 
                ephemeral: true 
            });
            
        } catch (error) {
            console.error('Send chat error:', error);
            await interaction.reply({ 
                content: '❌ حدث خطأ في تحضير إرسال الرسالة!', 
                ephemeral: true 
            });
        }
    }

    async handleChatSelect(interaction) {
        try {
            const [botId, ...messageParts] = interaction.values[0].split(':');
            const message = messageParts.join(':');
            const { 
    Client, 
    GatewayIntentBits, 
    SlashCommandBuilder, 
    EmbedBuilder, 
    ActionRowBuilder, 
    StringSelectMenuBuilder,
    ButtonBuilder,
    ButtonStyle 
} = require('discord.js');
const DatabaseManager = require('./database');
const MinecraftBot = require('./minecraft-bot');
const AdminManager = require('./admin');

class DiscordBot {
    constructor() {
        this.client = new Client({ 
            intents: [GatewayIntentBits.Guilds], 
            shards: 'auto',
            presence: { 
                status: 'online', 
                activities: [{ name: 'إدارة بوتات ماين كرافت', type: 3 }] 
            },
            maxReconnectAttempts: Infinity,
            restTimeOffset: 100
        });
        
        this.db = new DatabaseManager();
        this.admin = new AdminManager(this.db);
        
        // إعدادات محسنة
        this.config = { 
            MAX_FREE: 2, 
            MAX_PREMIUM: 10, 
            BOT_NAMES: ["Sub_to_qMee", "Sub_to_Bejtube"] 
        };
        
        // أنظمة إدارة الطلبات المطورة
        this.userQueues = new Map();
        this.rateLimiter = new Map();
        this.cooldowns = new Map();
        this.globalRateLimit = new Map();
        this.commandStats = new Map();
        
        // نظام الكاش المحسن
        this.responseCache = new Map();
        this.cacheTimeout = 300000; // 5 دقائق
        
        // نظام مراقبة الأداء
        this.performance = {
            commandsProcessed: 0,
            averageResponseTime: 0,
            errorCount: 0,
            startTime: Date.now(),
            peakConcurrentUsers: 0,
            totalInteractions: 0
        };
        
        // نظام إدارة الأخطاء المتقدم
        this.errorPatterns = new Map();
        this.recoveryStrategies = new Map();
        
        this.setupEvents();
        this.admin.startCleanupScheduler();
        this.startPeriodicCleanup();
        this.startPerformanceMonitoring();
    }

    setupEvents() {
        this.client.once('ready', async () => {
            try {
                await this.registerCommands();
                console.log(`✅ Discord bot ready: ${this.client.user.tag}`);
                console.log(`📊 Serving ${this.client.guilds.cache.size} guilds`);
                console.log(`👥 Cached users: ${this.client.users.cache.size}`);
                
                this.startPeriodicSync();
                this.updateBotStatus();
            } catch (error) {
                console.error('❌ Ready event error:', error);
            }
        });

        this.client.on('interactionCreate', async (interaction) => {
            const startTime = Date.now();
            
            try {
                // تحديث إحصائيات الأداء
                this.performance.totalInteractions++;
                this.updatePeakUsers();
                
                // فحص معدل الاستخدام العام
                if (!this.checkGlobalRateLimit(interaction.user.id)) {
                    return this.sendRateLimitMessage(interaction);
                }
                
                // فحص معدل الاستخدام الشخصي
                if (!this.checkUserRateLimit(interaction.user.id)) {
                    return interaction.reply({ 
                        content: '⏳ انتظر قليلاً! لا تستطيع استخدام أكثر من 5 أوامر في الدقيقة', 
                        ephemeral: true 
                    });
                }
                
                await this.queueUserCommand(interaction);
                
                // حساب وقت الاستجابة
                const responseTime = Date.now() - startTime;
                this.updatePerformanceMetrics(responseTime);
                
            } catch (error) {
                this.performance.errorCount++;
                console.error(`❌ Interaction error [${interaction.user.id}]:`, error);
                await this.handleInteractionError(interaction, error);
            }
        });

        this.client.on('error', (error) => {
            console.error('❌ Discord client error:', error);
            this.recordError('client_error', error);
        });

        this.client.on('warn', (info) => {
            if (!info.includes('heartbeat') && !info.includes('READY')) {
                console.warn('⚠️ Discord warning:', info);
            }
        });

        this.client.on('disconnect', () => {
            console.warn('🔌 Discord client disconnected');
        });

        this.client.on('reconnecting', () => {
            console.log('🔄 Discord client reconnecting...');
        });

        this.client.on('resume', () => {
            console.log('✅ Discord client resumed');
        });

        this.client.on('shardError', (error, shardId) => {
            console.error(`❌ Shard ${shardId} error:`, error);
        });
    }

    checkGlobalRateLimit(userId) {
        const now = Date.now();
        const windowSize = 60000; // دقيقة واحدة
        const maxGlobalCommands = 100; // حد أقصى عالمي
        
        if (!this.globalRateLimit.has('global')) {
            this.globalRateLimit.set('global', { count: 0, window: now + windowSize });
        }
        
        const globalLimit = this.globalRateLimit.get('global');
        
        if (now > globalLimit.window) {
            globalLimit.count = 1;
            globalLimit.window = now + windowSize;
            return true;
        }
        
        if (globalLimit.count >= maxGlobalCommands) {
            return false;
        }
        
        globalLimit.count++;
        return true;
    }

    checkUserRateLimit(userId) {
        const now = Date.now();
        const windowSize = 60000; // دقيقة واحدة
        const maxUserCommands = 5; // 5 أوامر في الدقيقة للمستخدم الواحد
        
        if (!this.rateLimiter.has(userId)) {
            this.rateLimiter.set(userId, { count: 0, window: now + windowSize });
            return true;
        }
        
        const userLimit = this.rateLimiter.get(userId);
        
        if (now > userLimit.window) {
            userLimit.count = 1;
            userLimit.window = now + windowSize;
            return true;
        }
        
        if (userLimit.count >= maxUserCommands) {
            return false;
        }
        
        userLimit.count++;
        return true;
    }

    async sendRateLimitMessage(interaction) {
        const embed = new EmbedBuilder()
            .setColor('#ff6b6b')
            .setTitle('⏰ معدل الاستخدام مرتفع')
            .setDescription('النظام مشغول حالياً، يرجى المحاولة خلال بضع دقائق')
            .addFields([
                { name: '📊 حالة النظام', value: 'مشغول', inline: true },
                { name: '⏳ وقت الانتظار المتوقع', value: '2-3 دقائق', inline: true }
            ])
            .setTimestamp();

        try {
            await interaction.reply({ embeds: [embed], ephemeral: true });
        } catch (error) {
            console.error('Failed to send rate limit message:', error);
        }
    }

    async queueUserCommand(interaction) {
        const userId = interaction.user.id;
        
        if (!this.userQueues.has(userId)) {
            this.userQueues.set(userId, []);
        }
        
        const queue = this.userQueues.get(userId);
        const maxQueueSize = 3;
        
        if (queue.length >= maxQueueSize) {
            const embed = new EmbedBuilder()
                .setColor('#ffa500')
                .setTitle('⏸️ طابور مليء')
                .setDescription(`لديك ${queue.length} أوامر في الانتظار. انتظر حتى تكتمل قبل إضافة المزيد.`)
                .setTimestamp();
                
            return interaction.reply({ embeds: [embed], ephemeral: true });
        }
        
        queue.push({
            interaction,
            timestamp: Date.now(),
            command: interaction.commandName
        });
        
        if (queue.length === 1) {
            await this.processUserQueue(userId);
        } else {
            // إشعار بالانتظار للأوامر المؤجلة
            const embed = new EmbedBuilder()
                .setColor('#0099ff')
                .setTitle('⏳ تمت إضافة الأمر للطابور')
                .setDescription(`موقعك في الطابور: ${queue.length}`)
                .setTimestamp();
                
            await interaction.reply({ embeds: [embed], ephemeral: true });
        }
    }

    async processUserQueue(userId) {
        const queue = this.userQueues.get(userId);
        if (!queue || queue.length === 0) return;
        
        const queueItem = queue.shift();
        const { interaction, timestamp } = queueItem;
        
        // تجاهل الأوامر القديمة (أكثر من 30 ثانية)
        if (Date.now() - timestamp > 30000) {
            console.warn(`⏰ Skipping expired command from user ${userId}`);
            if (queue.length > 0) {
                setTimeout(() => this.processUserQueue(userId), 100);
            } else {
                this.userQueues.delete(userId);
            }
            return;
        }
        
        try {
            await this.handleCommand(interaction);
        } catch (error) {
            console.error(`❌ Queue processing error [${userId}]:`, error);
            await this.handleInteractionError(interaction, error);
        }
        
        // معالجة الأمر التالي
        if (queue.length > 0) {
            setTimeout(() => this.processUserQueue(userId), 500);
        } else {
            this.userQueues.delete(userId);
        }
    }

    async registerCommands() {
        const commands = [
            new SlashCommandBuilder()
                .setName('اضافة')
                .setDescription('إضافة بوت ماين كرافت جديد')
                .addStringOption(option => 
                    option.setName('السيرفر')
                        .setDescription('عنوان السيرفر أو IP')
                        .setRequired(true)
                        .setMaxLength(100)
                )
                .addIntegerOption(option => 
                    option.setName('البورت')
                        .setDescription('رقم البورت (1-65535)')
                        .setRequired(true)
                        .setMinValue(1)
                        .setMaxValue(65535)
                ),
            
            new SlashCommandBuilder()
                .setName('حذف')
                .setDescription('حذف أحد البوتات نهائياً'),
            
            new SlashCommandBuilder()
                .setName('تشغيل')
                .setDescription('تشغيل أحد البوتات المتوقفة'),
            
            new SlashCommandBuilder()
                .setName('ايقاف')
                .setDescription('إيقاف أحد البوتات العاملة'),
            
            new SlashCommandBuilder()
                .setName('كتابة')
                .setDescription('إرسال رسالة عبر أحد البوتات')
                .addStringOption(option => 
                    option.setName('الرسالة')
                        .setDescription('الرسالة المراد إرسالها')
                        .setRequired(true)
                        .setMaxLength(200)
                ),
            
            new SlashCommandBuilder()
                .setName('البريميوم')
                .setDescription('عرض معلومات حساب البريميوم'),
            
            new SlashCommandBuilder()
                .setName('تغيير_اسم')
                .setDescription('تغيير اسم البوت (بريميوم فقط)')
                .addStringOption(option => 
                    option.setName('الاسم_الجديد')
                        .setDescription('الاسم الجديد للبوت (3-16 حرف)')
                        .setRequired(true)
                        .setMinLength(3)
                        .setMaxLength(16)
                ),
            
            new SlashCommandBuilder()
                .setName('معلومات')
                .setDescription('عرض معلومات مفصلة عن البوتات'),
            
            new SlashCommandBuilder()
                .setName('حالة')
                .setDescription('عرض حالة النظام والأداء'),
            
            new SlashCommandBuilder()
                .setName('مساعدة')
                .setDescription('دليل الاستخدام والمساعدة'),
            
            new SlashCommandBuilder()
                .setName('ادمن')
                .setDescription('أوامر الإدارة (للمشرفين والمطور)')
                .addSubcommand(subcommand =>
                    subcommand.setName('بريميوم')
                        .setDescription('منح بريميوم لمستخدم')
                        .addUserOption(option => 
                            option.setName('المستخدم').setDescription('المستخدم').setRequired(true)
                        )
                )
                .addSubcommand(subcommand =>
                    subcommand.setName('حظر')
                        .setDescription('حظر مستخدم')
                        .addUserOption(option => 
                            option.setName('المستخدم').setDescription('المستخدم').setRequired(true)
                        )
                )
                .addSubcommand(subcommand =>
                    subcommand.setName('الغاء_حظر')
                        .setDescription('إلغاء حظر مستخدم')
                        .addUserOption(option => 
                            option.setName('المستخدم').setDescription('المستخدم').setRequired(true)
                        )
                )
                .addSubcommand(subcommand =>
                    subcommand.setName('اضافة_ادمن')
                        .setDescription('إضافة مشرف جديد (المطور فقط)')
                        .addUserOption(option => 
                            option.setName('المستخدم').setDescription('المستخدم').setRequired(true)
                        )
                )
                .addSubcommand(subcommand =>
                    subcommand.setName('حذف_ادمن')
                        .setDescription('حذف مشرف (المطور فقط)')
                        .addUserOption(option => 
                            option.setName('المستخدم').setDescription('المستخدم').setRequired(true)
                        )
                )
                .addSubcommand(subcommand =>
                    subcommand.setName('احصائيات')
                        .setDescription('إحصائيات النظام المفصلة')
                )
                .addSubcommand(subcommand =>
                    subcommand.setName('ايقاف_طوارئ')
                        .setDescription('إيقاف جميع البوتات (المطور فقط)')
                )
                .addSubcommand(subcommand =>
                    subcommand.setName('تنظيف')
                        .setDescription('تنظيف النظام (المطور فقط)')
                )
        ];

        try {
            const registeredCommands = await this.client.application.commands.set(commands);
            console.log(`✅ Registered ${registeredCommands.size} commands successfully`);
        } catch (error) {
            console.error('❌ Command registration failed:', error);
            throw error;
        }
    }

    async handleCommand(interaction) {
        if (!interaction.isChatInputCommand() && !interaction.isStringSelectMenu() && !interaction.isButton()) {
            return;
        }
        
        const startTime = Date.now();
        
        try {
            // التحقق من الحظر
            const userIP = this.extractUserIP(interaction);
            if (await this.admin.isBanned(interaction.user.id)) {
                return this.sendBannedMessage(interaction);
            }
            
            // التأكد من وجود المستخدم في قاعدة البيانات
            await this.db.ensureUser(interaction.user.id, userIP);
            
            // معالجة القوائم والأزرار
            if (interaction.isStringSelectMenu() || interaction.isButton()) {
                return await this.handleComponentInteraction(interaction);
            }
            
            // معالجة الأوامر
            const commandName = interaction.commandName;
            this.recordCommandUsage(commandName);
            
            const commands = {
                'اضافة': () => this.addBot(interaction),
                'حذف': () => this.deleteBot(interaction),
                'تشغيل': () => this.startBot(interaction),
                'ايقاف': () => this.stopBot(interaction),
                'كتابة': () => this.sendChat(interaction),
                'البريميوم': () => this.premiumInfo(interaction),
                'تغيير_اسم': () => this.renameBot(
