const TelegramBot = require("node-telegram-bot-api");
const EconomicCalendarDB = require("./economicCalendarDB");
require("dotenv").config();

const REQUIRED_CHANNEL = process.env.REQUIRED_CHANNEL_USERNAME || "@ait_biz";

class EconomicCalendarTelegramBot {
  constructor() {
    this.token = process.env.TELEGRAM_BOT_TOKEN;
    this.bot = new TelegramBot(this.token, { polling: true });
    this.db = new EconomicCalendarDB();
    this.setupHandlers();

    // Set up menu after a delay
    setTimeout(() => {
      this.setupCommandMenu();
    }, 2000);
  }

  async init() {
    await this.db.init();

    // Add a small delay to ensure bot is fully initialized
    await new Promise((resolve) => setTimeout(resolve, 1000));

    await this.setupCommandMenu();
    console.log("🤖 Telegram bot initialized");
  }

  async setupCommandMenu() {
    try {
      console.log("🔧 Setting up command menu...");

      var commands = [
        { command: "start", description: "🦅 Старт и информация о боте" },
        { command: "subscribe", description: "📬 Подписаться на обновления" },
        { command: "unsubscribe", description: "📕 Отписаться" },
        { command: "update", description: "🔄 Обновить данные сейчас" },
        { command: "status", description: "📊 Статус подписки" },
      ];

      var result = await this.bot.setMyCommands(commands);
      console.log("✅ Command menu setup result:", result);

      // Also set commands for private chats specifically
      await this.bot.setMyCommands(commands, {
        scope: { type: "all_private_chats" },
      });
      console.log("✅ Private chat commands set");
    } catch (error) {
      console.error("❌ Failed to setup command menu:", error.message);
      console.error("Full error:", error);
    }
  }

  setupHandlers() {
    // Start command
    this.bot.onText(/\/start/, async (msg) => {
      await this.handleStart(msg);
    });

    // Subscribe command
    this.bot.onText(/\/subscribe/, async (msg) => {
      await this.handleSubscribe(msg);
    });

    // Unsubscribe command
    this.bot.onText(/\/unsubscribe/, async (msg) => {
      await this.handleUnsubscribe(msg);
    });

    // Update data command
    this.bot.onText(/\/update/, async (msg) => {
      await this.handleUpdateData(msg);
    });

    // Status command
    this.bot.onText(/\/status/, async (msg) => {
      await this.handleStatus(msg);
    });

    // Error handling
    this.bot.on("polling_error", (error) => {
      console.error("❌ Polling error:", error);
    });
  }

  async checkChannelSubscriptionMiddleware(msg) {
    const userId = msg.from.id;
    const chatId = msg.chat.id;

    try {
      // First ensure user is in database
      await this.db.usersModel.addUser({
        telegram_user_id: userId,
        chat_id: chatId,
        username: msg.from.username || null,
        first_name: msg.from.first_name || "Unknown",
        last_name: msg.from.last_name || null,
      });

      // Check channel subscription
      const isSubscribed = await this.db.usersModel.checkChannelSubscription(
        this.bot,
        userId,
        REQUIRED_CHANNEL
      );

      // Update subscription status in database
      await this.db.usersModel.updateSubscriptionStatus(userId, isSubscribed, {
        username: msg.from.username,
        first_name: msg.from.first_name,
        last_name: msg.from.last_name,
      });

      return isSubscribed;
    } catch (error) {
      console.error("❌ Error in subscription middleware:", error);
      return false; // Fail closed for security
    }
  }

  async sendSubscriptionRequired(chatId) {
    const channelUrl = `https://t.me/${REQUIRED_CHANNEL.substring(1)}`;
    const message = `
<b>🔒 Доступ ограничен</b>

Для использования этого бота необходимо быть подписчиком канала ${channelUrl}

<b>📢 Подпишитесь на канал:</b>
👆 Нажмите на ссылку выше

<b>✅ После подписки:</b>
Вернитесь сюда и нажмите /start
`.trim();

    await this.bot.sendMessage(chatId, message, {
      parse_mode: "HTML",
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: "📢 Подписаться на канал",
              url: channelUrl,
            },
          ],
        ],
      },
    });
  }

  async sendCongratulationMessage(chatId) {
    const channelUrl = `https://t.me/${REQUIRED_CHANNEL.substring(1)}`;
    const message = `
<b>🎉 Поздравляем!</b>

✅ Вы успешно подписались на канал ${channelUrl}
🤖 Теперь у вас есть полный доступ к боту экономического календаря!

<b>📊 Что вы можете делать:</b>
📬 /subscribe - Получать ежедневные обновления
🔄 /update - Обновить данные вручную

<b>💡 Совет:</b> Используйте /subscribe чтобы получать график экономических событий каждый день!
`.trim();

    await this.bot.sendMessage(chatId, message, { parse_mode: "HTML" });
  }

  async handleStart(msg) {
    const channelUrl = `https://t.me/${REQUIRED_CHANNEL.substring(1)}`;
    const chatId = msg.chat.id;

    const isSubscribed = await this.checkChannelSubscriptionMiddleware(msg);

    if (!isSubscribed) {
      await this.sendSubscriptionRequired(chatId);
      return;
    }

    const user = await this.db.usersModel.getUserByChatId(chatId);
    const isNewSubscriber =
      user &&
      user.subscription_date &&
      Date.now() - new Date(user.subscription_date).getTime() < 60000;

    if (isNewSubscriber) {
      await this.sendCongratulationMessage(chatId);
      return;
    }

    const welcomeMessage = `
<b>🦅 Бот экономических событий</b>

✅ Добро пожаловать! Вы подписчик ${channelUrl}

📊 Я предоставляю ежедневную информацию по экономическим событиям,
которые могут повлиять на цены активов на финансовых площадках.

<b>Доступные команды:</b>
📬 /subscribe - Подписаться на ежедневные обновления событий  
📕 /unsubscribe - Отписаться
📊 /status - Проверка статуса подписки
🔄 /update - Обновить экономические данные сейчас

Для получения ежедневных данных выберите /subscribe!
`.trim();

    await this.bot.sendMessage(chatId, welcomeMessage, {
      parse_mode: "HTML",
    });
  }

  async handleSubscribe(msg) {
    const channelUrl = `https://t.me/${REQUIRED_CHANNEL.substring(1)}`;
    const chatId = msg.chat.id;

    const isSubscribed = await this.checkChannelSubscriptionMiddleware(msg);

    if (!isSubscribed) {
      await this.sendSubscriptionRequired(chatId);
      return;
    }

    const user = msg.from;

    try {
      // First add/update user info
      await this.db.usersModel.addUser({
        telegram_user_id: user.id,
        chat_id: chatId,
        username: user.username || null,
        first_name: user.first_name || "Unknown",
        last_name: user.last_name || null,
      });

      // Explicitly activate the user for bot notifications
      await this.db.usersModel.setUserActive(user.id, true);

      const message = `<b>✅ Успешная подписка!</b>

📊 Вы будете получать график планируемых экономических событий каждый день.

💡 Не забудьте подписаться на наш канал ${channelUrl} для получения дополнительных материалов!`;

      await this.bot.sendMessage(chatId, message, { parse_mode: "HTML" });
    } catch (error) {
      console.error("Error subscribing user:", error);
      await this.bot.sendMessage(
        chatId,
        "❌ Ошибка подписки. Пожалуйста, попробуйте ещё."
      );
    }
  }

  async handleUnsubscribe(msg) {
    const chatId = msg.chat.id;

    try {
      // Directly unsubscribe without checking channel subscription
      // User should be able to unsubscribe from bot notifications regardless
      const result = await this.db.usersModel.setUserActive(msg.from.id, false);

      if (result) {
        await this.bot.sendMessage(
          chatId,
          "✅ Вы успешно отписались от получения графика планируемых экономических событий.\n\nЧтобы возобновить подписку, используйте /subscribe"
        );
      } else {
        await this.bot.sendMessage(
          chatId,
          "❌ Ошибка при отписке. Попробуйте еще раз."
        );
      }
    } catch (error) {
      console.error("Error unsubscribing user:", error);
      await this.bot.sendMessage(
        chatId,
        "❌ Вы не подписаны на рассылку. Используйте /subscribe для подписки."
      );
    }
  }

  async handleUpdateData(msg) {
    const chatId = msg.chat.id;

    // Check subscription first
    const isSubscribed = await this.checkChannelSubscriptionMiddleware(msg);

    if (!isSubscribed) {
      await this.sendSubscriptionRequired(chatId);
      return;
    }

    // Check if user is active (subscribed to bot notifications)
    try {
      const user = await this.db.usersModel.getUserByChatId(chatId);
      if (!user || !user.is_active) {
        await this.bot.sendMessage(
          chatId,
          "📵 Вы отписались от уведомлений бота.\n\nИспользуйте /subscribe чтобы снова получать данные."
        );
        return;
      }
    } catch (error) {
      console.error("Error checking user active status:", error);
      await this.bot.sendMessage(
        chatId,
        "❌ Ошибка проверки статуса пользователя."
      );
      return;
    }

    try {
      // Send initial update message
      await this.bot.sendMessage(
        chatId,
        "🔄 <b>Updating economic data...</b>\nPlease wait...",
        { parse_mode: "HTML" }
      );

      // Update the database
      var result = await this.db.updateEconomicData();

      if (result.success) {
        // Send quick confirmation
        await this.bot.sendMessage(
          chatId,
          `✅ Updated ${result.data.length} events\n📊 Sending full calendar...`
        );

        // Get today's events and send the full formatted message
        var today = new Date().toISOString().split("T")[0];
        var todayEvents = await this.db.eventsModel.getEventsByDate(today);

        if (todayEvents.length > 0) {
          // Get today's date in DD.MM.YYYY format
          var dateStr = new Date().toLocaleDateString("ru-RU", {
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
          });

          // Send the same formatted message as daily broadcast
          var fullMessage = this.formatEventsMessage(todayEvents, dateStr);
          var messageParts = this.splitLongMessage(fullMessage);

          // Send all parts
          for (var i = 0; i < messageParts.length; i++) {
            var part = messageParts[i];
            var partHeader =
              messageParts.length > 1
                ? `(${i + 1}/${messageParts.length}) `
                : "";

            await this.bot.sendMessage(chatId, partHeader + part, {
              parse_mode: "HTML",
            });

            if (i < messageParts.length - 1) {
              await new Promise((resolve) => setTimeout(resolve, 200));
            }
          }
        } else {
          await this.bot.sendMessage(
            chatId,
            "📅 No events found for today after update"
          );
        }
      } else {
        await this.bot.sendMessage(
          chatId,
          `❌ <b>Update failed:</b> ${result.message}`,
          { parse_mode: "HTML" }
        );
      }
    } catch (error) {
      console.error("Error updating data:", error);
      await this.bot.sendMessage(chatId, "❌ Update error. Please try again.");
    }
  }

  async handleStatus(msg) {
    const channelUrl = `https://t.me/${REQUIRED_CHANNEL.substring(1)}`;
    const chatId = msg.chat.id;
    const isSubscribed = await this.checkChannelSubscriptionMiddleware(msg);

    if (!isSubscribed) {
      await this.sendSubscriptionRequired(chatId);
      return;
    }

    try {
      const user = await this.db.usersModel.getUserByChatId(chatId);

      if (!user) {
        await this.bot.sendMessage(
          chatId,
          "❌ Пользователь не найден в базе данных.\nИспользуйте /subscribe для регистрации."
        );
        return;
      }

      // Show bot subscription status based on is_active field
      const botStatus = user.is_active
        ? "✅ Активен (получаете рассылку)"
        : "❌ Неактивен (рассылка отключена)";

      const channelStatus = isSubscribed ? "✅ Подписан" : "❌ Не подписан";
      const subscribeDate = user.created_at
        ? new Date(user.created_at).toLocaleDateString("ru-RU")
        : "Неизвестно";

      const username = user.username || "Не установлено";
      const firstName = user.first_name || "";
      const lastName = user.last_name || "";

      const message = `<b>📊 Статус подписки</b>

Статус бота: ${botStatus}
Канал ${channelUrl}: ${channelStatus}
Дата регистрации: ${subscribeDate}
Имя пользователя: ${username ? "@" + username : "Не установлено"}
Имя: ${firstName} ${lastName}`.trim();

      await this.bot.sendMessage(chatId, message, { parse_mode: "HTML" });
    } catch (error) {
      console.error("Error checking status:", error);
      await this.bot.sendMessage(chatId, "❌ Ошибка проверки статуса.");
    }
  }

  formatEventsMessage(events, dateStr) {
    let message = `<b>📈 Экономические события на ${dateStr}</b>\n\n`;

    // Events are already sorted by original_index from the database query
    // Just group them by time while preserving order
    const eventsByTime = new Map(); // Map preserves insertion order

    events.forEach((event) => {
      const timeKey = event.time;

      if (!eventsByTime.has(timeKey)) {
        eventsByTime.set(timeKey, []);
      }
      eventsByTime.get(timeKey).push(event);
    });

    // Display groups in the order they were added
    for (const [timeKey, timeEvents] of eventsByTime) {
      message += `⏰ ====== ${timeKey} ====== 🎯\n`;

      timeEvents.forEach((event) => {
        const stars = this.getVolatilityStars(event.volatility);
        message += `${stars} <b>${event.currency}</b> - ${event.event}\n`;

        if (
          event.previous !== null ||
          event.forecast !== null ||
          event.fact !== null
        ) {
          const values = [];

          if (event.previous !== null && event.previous !== undefined) {
            values.push(`📋 Предыдущий: ${event.previous}`);
          }

          if (event.forecast !== null && event.forecast !== undefined) {
            values.push(`📊 Прогноз: ${event.forecast}`);
          }

          if (event.fact !== null && event.fact !== undefined) {
            values.push(`✅ <b>Факт: ${event.fact}</b>`);
          }

          if (values.length > 0) {
            message += `   ${values.join("\n   ")}\n`;
          }
        }

        message += "\n";
      });
    }

    return message;
  }

  splitLongMessage(message, maxLength) {
    if (!maxLength) maxLength = 4000;

    if (message.length <= maxLength) {
      return [message];
    }

    var parts = [];
    var lines = message.split("\n");
    var currentPart = "";

    for (var i = 0; i < lines.length; i++) {
      var line = lines[i];
      // If adding this line would exceed the limit
      if (currentPart.length + line.length + 1 > maxLength) {
        if (currentPart.trim()) {
          parts.push(currentPart.trim());
          currentPart = "";
        }
      }
      currentPart += line + "\n";
    }

    // Add the last part
    if (currentPart.trim()) {
      parts.push(currentPart.trim());
    }

    return parts;
  }

  getVolatilityStars(volatility) {
    switch (volatility) {
      case 3:
        return "🔴🔴🔴"; // High impact
      case 2:
        return "🟡🟡"; // Medium impact
      case 1:
        return "🟢"; // Low impact
      default:
        return "📄"; // No impact data
    }
  }

  async broadcastDailyUpdate() {
    try {
      console.log("📢 Starting daily broadcast...");

      // Get today's events
      var today = new Date().toISOString().split("T")[0];
      var events = await this.db.eventsModel.getEventsByDate(today);

      if (events.length === 0) {
        console.log("📅 No events for today, skipping broadcast");
        return { sent: 0, message: "No events today" };
      }

      // Get active users
      var activeUsers = await this.db.usersModel.getActiveUsers();

      if (activeUsers.length === 0) {
        console.log("👥 No active users to broadcast to");
        return { sent: 0, message: "No active users" };
      }

      // Get today's date in DD.MM.YYYY format
      var dateStr = new Date().toLocaleDateString("ru-RU", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      });

      // Format message and split if too long
      var message = this.formatEventsMessage(events, dateStr);
      var messageParts = this.splitLongMessage(message);
      var sent = 0;
      var failed = 0;

      console.log(
        `📤 Broadcasting ${messageParts.length} message parts to ${activeUsers.length} users...`
      );

      // Send to each user
      for (var userIndex = 0; userIndex < activeUsers.length; userIndex++) {
        var user = activeUsers[userIndex];
        try {
          // Send all parts of the message
          for (var i = 0; i < messageParts.length; i++) {
            var part = messageParts[i];
            var partHeader =
              messageParts.length > 1
                ? `(${i + 1}/${messageParts.length}) `
                : "";

            await this.bot.sendMessage(user.chat_id, partHeader + part, {
              parse_mode: "HTML",
            });

            // Rate limiting delay between parts
            if (i < messageParts.length - 1) {
              await new Promise((resolve) => setTimeout(resolve, 200));
            }
          }
          sent++;

          // Rate limiting delay between users
          await new Promise((resolve) => setTimeout(resolve, 100));
        } catch (error) {
          console.error(
            `Failed to send to ${user.telegram_user_id}:`,
            error.message
          );
          failed++;

          // Deactivate blocked users
          if (error.response && error.response.error_code === 403) {
            await this.db.usersModel.setUserActive(
              user.telegram_user_id,
              false
            );
            console.log(`Deactivated blocked user: ${user.telegram_user_id}`);
          }
        }
      }

      console.log(`✅ Broadcast complete: ${sent} sent, ${failed} failed`);
      return { sent, failed, eventsCount: events.length };
    } catch (error) {
      console.error("❌ Broadcast error:", error);
      return { sent: 0, failed: 0, error: error.message };
    }
  }
}

module.exports = EconomicCalendarTelegramBot;
