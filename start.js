const Scheduler = require("./scheduler");
require("dotenv").config();

async function main() {
  console.log("🏦 Starting Economic Calendar Bot System (PRODUCTION)...");
  console.log(`Environment: ${process.env.NODE_ENV || "production"}`);
  console.log(
    `Bot Token: ${
      process.env.TELEGRAM_BOT_TOKEN ? "Configured ✅" : "Missing ❌"
    }`
  );
  console.log(`Database: ${process.env.DB_NAME || "economic_calendar"}`);

  const scheduler = new Scheduler();
  // Make it global for cleanup
  global.scheduler = scheduler;

  try {
    await scheduler.start();

    console.log("✅ System is running in PRODUCTION mode");
    console.log("📅 Daily schedule:");
    console.log("   05:00 - Send daily broadcast");
    console.log("\n🔧 Available manual commands in Telegram:");
    console.log("   /update - Manual data update");
    console.log("   /events - View today's events");
    console.log("   /subscribe - Subscribe to updates");

    // Handle shutdown gracefully
    process.on("SIGINT", async () => {
      console.log("\n🛑 Graceful shutdown initiated...");
      await scheduler.stop();
      process.exit(0);
    });

    process.on("SIGTERM", async () => {
      console.log("\n🛑 SIGTERM received, shutting down...");
      await scheduler.stop();
      process.exit(0);
    });
  } catch (error) {
    console.error("❌ Failed to start production system:", error);
    process.exit(1);
  }
}

main();
