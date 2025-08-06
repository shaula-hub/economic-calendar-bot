const TelegramBot = require("node-telegram-bot-api");
const EconomicCalendarDB = require("./economicCalendarDB");
require("dotenv").config();

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
        { command: "start", description: "🏦 Старт и информация о боте" },
        { command: "events", description: "📋 События на сегодня" },
        { command: "subscribe", description: "📬 Подписаться на обновления" },
        { command: "unsubscribe", description: "🔕 Отписаться" },
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

    // Get events command
    this.bot.onText(/\/events/, async (msg) => {
      await this.handleGetEvents(msg);
    });

    // Update data command (admin)
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

  async handleStart(msg) {
    const chatId = msg.chat.id;
    const welcomeMessage = `
🏦 **Бот экономических событий**

Добро пожаловать! Я предоставляю ежедневную информацию по экономическим событиям,
которые могут повлиять на цены на активы на финансовых площадках.
Обновление раз в сутки по Гринвичу или по запросу /update.

**Доступные команды:**
📋 /events - Показать сегодняшние экономические события
📬 /subscribe - Подписаться на ежедневные обновления событий
🔕 /unsubscribe - Отписаться
📊 /status - Проверка статуса подписки
🔄 /update - Обновить экономические данные сейчас

Для получения ежедневных экономических данные выберитее /subscribe!
    `;

    await this.bot.sendMessage(chatId, welcomeMessage, {
      parse_mode: "Markdown",
    });
  }

  async handleSubscribe(msg) {
    const chatId = msg.chat.id;
    const user = msg.from;

    try {
      await this.db.usersModel.addUser({
        telegram_user_id: user.id,
        chat_id: chatId,
        username: user.username || null,
        first_name: user.first_name || "Unknown",
        last_name: user.last_name || null,
      });

      await this.bot.sendMessage(
        chatId,
        "✅ **Успешная подписка!**\n\nВы будете получать график планируемых экономических событий.",
        { parse_mode: "Markdown" }
      );
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
      await this.db.usersModel.setUserActive(msg.from.id, false);
      await this.bot.sendMessage(
        chatId,
        "✅ Вы успешно отписались от получения графика планируемых экономических событий."
      );
    } catch (error) {
      await this.bot.sendMessage(
        chatId,
        "❌ You may not be subscribed. Use /subscribe first."
      );
    }
  }

  async handleGetEvents(msg) {
    var chatId = msg.chat.id;

    try {
      var today = new Date().toISOString().split("T")[0]; // YYYY-MM-DD
      var events = await this.db.eventsModel.getEventsByDate(today);

      if (events.length === 0) {
        await this.bot.sendMessage(
          chatId,
          "📅 На сегодня экономические события не запланированы."
        );
        return;
      }

      // Get today's date in DD.MM.YYYY format
      var dateStr = new Date().toLocaleDateString("ru-RU", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      });

      var message = this.formatEventsMessage(events, dateStr);
      var messageParts = this.splitLongMessage(message);

      // Send all parts
      for (var i = 0; i < messageParts.length; i++) {
        var part = messageParts[i];
        var partHeader =
          messageParts.length > 1 ? `(${i + 1}/${messageParts.length}) ` : "";

        await this.bot.sendMessage(chatId, partHeader + part, {
          parse_mode: "Markdown",
        });

        if (i < messageParts.length - 1) {
          await new Promise((resolve) => setTimeout(resolve, 200));
        }
      }
    } catch (error) {
      console.error("Error getting events:", error);
      await this.bot.sendMessage(
        chatId,
        "❌ Error retrieving events. Please try again."
      );
    }
  }

  async handleUpdateData(msg) {
    var chatId = msg.chat.id;

    try {
      // Send initial update message
      await this.bot.sendMessage(
        chatId,
        "🔄 **Updating economic data...**\nPlease wait...",
        { parse_mode: "Markdown" }
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
              parse_mode: "Markdown",
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
          `❌ **Update failed:** ${result.message}`,
          { parse_mode: "Markdown" }
        );
      }
    } catch (error) {
      console.error("Error updating data:", error);
      await this.bot.sendMessage(chatId, "❌ Update error. Please try again.");
    }
  }

  async handleStatus(msg) {
    const chatId = msg.chat.id;

    try {
      const user = await this.db.usersModel.getUserByChatId(chatId);

      if (!user) {
        await this.bot.sendMessage(
          chatId,
          "❌ You are not subscribed.\nUse /subscribe to start receiving updates."
        );
        return;
      }

      const status = user.is_active ? "✅ Active" : "❌ Inactive";
      const subscribeDate = new Date(user.created_at).toLocaleDateString();

      const message = `
📊 **Subscription Status**

Status: ${status}
Subscribed: ${subscribeDate}
Username: ${user.username || "Not set"}
Name: ${user.first_name} ${user.last_name || ""}
      `;

      await this.bot.sendMessage(chatId, message, { parse_mode: "Markdown" });
    } catch (error) {
      console.error("Error checking status:", error);
      await this.bot.sendMessage(chatId, "❌ Error checking status.");
    }
  }

  formatEventsMessage(events, dateStr) {
    let message = `📈 **Economic Events on ${dateStr}**\n\n`;

    // Group events by time
    const eventsByTime = {};
    events.forEach((event) => {
      const time = event.time.substring(0, 5); // HH:MM format
      if (!eventsByTime[time]) eventsByTime[time] = [];
      eventsByTime[time].push(event);
    });

    // Sort times and format events
    Object.keys(eventsByTime)
      .sort()
      .forEach((time) => {
        message += `⏰ ====== ${time} ====== 🎯\n`;

        eventsByTime[time].forEach((event) => {
          const stars = this.getVolatilityStars(event.volatility);
          message += `${stars} **${event.currency}** - ${event.event}\n`;

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
              values.push(`✅ **Факт: ${event.fact}**`);
            }

            if (values.length > 0) {
              message += `   ${values.join("\n   ")}\n`;
            }
          }

          message += "\n";
        });
      });

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
        return "📍"; // No impact data
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
              parse_mode: "Markdown",
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
