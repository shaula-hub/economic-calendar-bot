const cron = require("node-cron");
const EconomicCalendarTelegramBot = require("./TelegramBot");
require("dotenv").config();

class Scheduler {
  constructor() {
    this.bot = new EconomicCalendarTelegramBot();
    this.updateCount = 0;
    this.isRunning = false;
  }

  async init() {
    await this.bot.init();
    console.log("🏦 Economic Calendar Scheduler initialized");
    console.log("📅 Production schedule: Daily update at 05:00");
    this.isRunning = true;
  }

  setupProductionSchedule() {
    // Daily update at 05:00
    cron.schedule("0 5 * * *", async () => {
      if (this.isRunning) {
        this.updateCount++;
        console.log(
          `\n🔄 Daily Update #${
            this.updateCount
          } - ${new Date().toLocaleString()}`
        );
        await this.performUpdateAndBroadcast();
      }
    });

    console.log("✅ Production schedule active: Daily at 05:00");
  }

  async performUpdateAndBroadcast() {
    try {
      // Step 1: Update database
      console.log("📊 Starting economic data update...");
      const startTime = Date.now();

      const result = await this.bot.db.updateEconomicData();
      const duration = ((Date.now() - startTime) / 1000).toFixed(1);

      if (result.success) {
        console.log(
          `✅ Data updated successfully! ${result.data.length} events (${duration}s)`
        );

        // Step 2: Send Telegram broadcast
        console.log("📡 Sending daily broadcast...");
        const broadcastResult = await this.bot.broadcastDailyUpdate();

        if (broadcastResult.sent > 0) {
          console.log(`📱 Broadcast sent to ${broadcastResult.sent} users`);
        } else {
          console.log(
            `📭 No broadcasts sent: ${
              broadcastResult.message || "No active users"
            }`
          );
        }

        if (broadcastResult.failed > 0) {
          console.log(`⚠️ Failed to send to ${broadcastResult.failed} users`);
          await this.sendErrorNotification(
            `Broadcast partially failed: ${broadcastResult.failed} users unreachable`
          );
        }
      } else {
        const errorMsg = `Data update failed: ${result.message}`;
        console.log(`❌ ${errorMsg}`);
        await this.sendErrorNotification(errorMsg);
      }
    } catch (error) {
      const errorMsg = `System error during update: ${error.message}`;
      console.error(`💥 ${errorMsg}`);
      await this.sendErrorNotification(errorMsg);
    }
  }

  async sendErrorNotification(errorMessage) {
    try {
      // Get active users directly
      const activeUsers = await this.bot.db.usersModel.getActiveUsers();

      if (activeUsers.length === 0) {
        console.log("📭 No active users to send error notification to");
        return;
      }

      const adminMessage =
        `🚨 *Economic Calendar Error*\n\n` +
        `Time: ${new Date().toLocaleString()}\n` +
        `Error: ${errorMessage}\n\n` +
        `System continues running...`;

      let sent = 0;

      // Send to each active user
      for (const user of activeUsers) {
        try {
          await this.bot.bot.sendMessage(user.chat_id, adminMessage, {
            parse_mode: "Markdown",
          });
          sent++;

          // Rate limiting delay
          await new Promise((resolve) => setTimeout(resolve, 100));
        } catch (sendError) {
          console.error(
            `Failed to send error notification to ${user.telegram_user_id}:`,
            sendError.message
          );
        }
      }

      console.log(`📤 Error notification sent to ${sent} users`);
    } catch (notificationError) {
      console.error(
        "❌ Failed to send error notification:",
        notificationError.message
      );
    }
  }

  async start() {
    await this.init();

    // Perform initial update
    console.log("🚀 Performing initial update...");
    await this.performUpdateAndBroadcast();

    // Setup daily schedule
    this.setupProductionSchedule();

    console.log("✅ Economic Calendar Scheduler is running in PRODUCTION mode");
  }

  async stop() {
    console.log("🛑 Stopping scheduler...");
    this.isRunning = false;
    await this.bot.close();
    console.log("✅ Scheduler stopped gracefully");
  }
}

// Handle graceful shutdown
process.on("SIGINT", async () => {
  if (global.scheduler) {
    await global.scheduler.stop();
  }
  process.exit(0);
});

process.on("SIGTERM", async () => {
  if (global.scheduler) {
    await global.scheduler.stop();
  }
  process.exit(0);
});

module.exports = Scheduler;
