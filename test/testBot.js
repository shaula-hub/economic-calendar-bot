const EconomicCalendarTelegramBot = require("../telegramBot");

async function testBot() {
  console.log("🤖 Testing Telegram bot...");

  const bot = new EconomicCalendarTelegramBot();

  try {
    await bot.init();
    console.log("✅ Bot initialized successfully!");
    console.log("🔗 Bot is now running and listening for messages...");
    console.log("\n📱 Test your bot:");
    console.log("1. Open Telegram");
    console.log("2. Search for your bot username");
    console.log("3. Send /start");
    console.log("4. Try other commands: /subscribe, /events, /status");
    console.log("\n⏹️  Press Ctrl+C to stop the bot");

    // Keep the bot running
    process.on("SIGINT", async () => {
      console.log("\n🛑 Stopping bot...");
      await bot.close();
      process.exit(0);
    });
  } catch (error) {
    console.error("❌ Bot test failed:", error);
    process.exit(1);
  }
}

testBot();
