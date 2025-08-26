const cron = require("node-cron");
const EconomicCalendarTelegramBot = require("../telegramBot");
require("dotenv").config();

class TestSchedulerWithTelegram {
  constructor() {
    this.bot = new EconomicCalendarTelegramBot();
    this.updateCount = 0;
  }

  async init() {
    await this.bot.init();
    console.log("🧪 Test Scheduler with Telegram initialized");
    console.log(
      "⏰ Will update events + send Telegram messages every 5 minutes...\n"
    );
  }

  setupTestSchedule() {
    // Update data + send Telegram every 5 minutes
    cron.schedule("*/5 * * * *", async () => {
      this.updateCount++;
      console.log(
        `\n🔄 Test Update #${
          this.updateCount
        } - ${new Date().toLocaleTimeString()}`
      );
      await this.performUpdateAndBroadcast();
    });

    console.log(
      "✅ Scheduled: Update events + Telegram broadcast every 5 minutes"
    );
    console.log("📊 Press Ctrl+C to stop testing\n");
  }

  async performUpdateAndBroadcast() {
    try {
      // Step 1: Update database
      console.log("   🕷️ Starting web scraping...");
      const startTime = Date.now();

      const result = await this.bot.db.updateEconomicData();

      const duration = ((Date.now() - startTime) / 1000).toFixed(1);

      if (result.success) {
        console.log(
          `   ✅ Scraping success! Updated ${result.data.length} events (${duration}s)`
        );

        // Show sample events
        if (result.data.length > 0) {
          console.log(
            `   📅 Sample: ${result.data[0].date} ${result.data[0].time} - ${result.data[0].event}`
          );
        }

        // Step 2: Send Telegram broadcast
        console.log("   📡 Sending Telegram broadcast...");
        const broadcastResult = await this.bot.broadcastDailyUpdate();

        if (broadcastResult.sent > 0) {
          console.log(
            `   📱 Telegram success! Sent to ${broadcastResult.sent} users`
          );
        } else if (broadcastResult.sent === 0) {
          console.log(
            `   📭 No messages sent: ${
              broadcastResult.message || "No active users or no events"
            }`
          );
        }

        if (broadcastResult.failed > 0) {
          console.log(
            `   ⚠️ Failed to send to ${broadcastResult.failed} users`
          );
        }
      } else {
        console.log(`   ❌ Scraping failed: ${result.message}`);
      }
    } catch (error) {
      console.log(`   💥 Error: ${error.message}`);
    }
  }

  async performManualUpdate() {
    console.log("🔄 Manual update + broadcast triggered...");
    await this.performUpdateAndBroadcast();
  }

  async start() {
    await this.init();

    // Do an immediate update first
    console.log("🚀 Performing initial update + broadcast...");
    await this.performUpdateAndBroadcast();

    // Then start the schedule
    this.setupTestSchedule();

    console.log("📡 Test scheduler with Telegram is running!");
    console.log('💡 Tip: You can manually trigger by pressing "m" + Enter');
  }

  async stop() {
    console.log("\n🛑 Stopping test scheduler...");
    await this.bot.close();
    console.log("✅ Test completed");
  }
}

// Handle user input for manual updates
process.stdin.on("data", async (data) => {
  const input = data.toString().trim().toLowerCase();
  if (input === "m") {
    await scheduler.performManualUpdate();
  }
});

// Handle graceful shutdown
const scheduler = new TestSchedulerWithTelegram();

process.on("SIGINT", async () => {
  await scheduler.stop();
  process.exit(0);
});

// Start if called directly
if (require.main === module) {
  scheduler.start().catch(console.error);
}

module.exports = TestSchedulerWithTelegram;
