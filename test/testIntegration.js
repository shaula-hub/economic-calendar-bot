const EconomicCalendarDB = require("../economicCalendarDB");
require("dotenv").config(); // Load environment variables

async function testFullIntegration() {
  const calendarDB = new EconomicCalendarDB();

  try {
    console.log("🧪 Testing full integration...\n");

    // Initialize database
    console.log("🔧 Initializing database...");
    await calendarDB.init();
    console.log("✅ Database initialized\n");

    // Test scraping and database update
    console.log("📊 Testing scraper -> database flow...");
    const updateResult = await calendarDB.updateEconomicData();
    console.log("Update result:", updateResult);

    if (updateResult.success) {
      // Test data retrieval
      console.log("\n📋 Testing data retrieval...");
      const broadcastData = await calendarDB.getDataForBroadcast();

      console.log(`📈 Events in database: ${broadcastData.eventCount}`);
      console.log(`👥 Active users: ${broadcastData.userCount}`);

      // Show sample events
      if (broadcastData.events.length > 0) {
        console.log("\n📅 Sample events:");
        broadcastData.events.slice(0, 3).forEach((event, index) => {
          console.log(
            `${index + 1}. ${event.date} ${event.time} - ${event.currency} - ${
              event.event
            }`
          );
          if (event.forecast || event.previous || event.fact) {
            console.log(
              `   📊 F:${event.forecast || "N/A"} P:${
                event.previous || "N/A"
              } A:${event.fact || "N/A"}`
            );
          }
        });
      }

      console.log("\n✅ Integration test completed successfully!");
      return true;
    } else {
      console.log("❌ Integration test failed:", updateResult.message);
      return false;
    }
  } catch (error) {
    console.error("❌ Integration test error:", error);
    return false;
  } finally {
    await calendarDB.close();
  }
}

// Test individual components
async function testDatabaseConnection() {
  console.log("🔗 Testing database connection...");
  const calendarDB = new EconomicCalendarDB();

  try {
    await calendarDB.init();
    console.log("✅ Database connection successful");

    // Test a simple query
    const result = await calendarDB.db.query("SELECT NOW() as current_time");
    console.log("⏰ Database time:", result.rows[0].current_time);

    await calendarDB.close();
    return true;
  } catch (error) {
    console.error("❌ Database connection failed:", error);
    return false;
  }
}

async function testScraper() {
  console.log("🕷️ Testing scraper...");

  try {
    const { scrapeEconomicCalendar } = require("../code3");
    const data = await scrapeEconomicCalendar();

    if (data && data.length > 0) {
      console.log(`✅ Scraper successful: ${data.length} events found`);
      console.log("📊 Sample data:", data[0]);
      return true;
    } else {
      console.log("⚠️ Scraper returned no data");
      return false;
    }
  } catch (error) {
    console.error("❌ Scraper failed:", error);
    return false;
  }
}

// Run specific test based on command line argument
async function runTests() {
  const testType = process.argv[2];

  switch (testType) {
    case "db":
      await testDatabaseConnection();
      break;
    case "scraper":
      await testScraper();
      break;
    case "full":
    default:
      await testFullIntegration();
      break;
  }
}

// Run test if called directly
if (require.main === module) {
  runTests();
}

module.exports = { testFullIntegration, testDatabaseConnection, testScraper };
