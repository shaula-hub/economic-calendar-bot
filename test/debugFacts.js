const EconomicCalendarDB = require("../economicCalendarDB");
require("dotenv").config();

async function debugFactData() {
  const db = new EconomicCalendarDB();

  try {
    await db.init();

    // Get today's events
    const today = new Date().toISOString().split("T")[0];
    const events = await db.eventsModel.getEventsByDate(today);

    console.log(`📊 Found ${events.length} events for today (${today})\n`);

    // Show detailed data for each event
    events.forEach((event, index) => {
      console.log(`Event ${index + 1}:`);
      console.log(`  Time: ${event.time}`);
      console.log(`  Currency: ${event.currency}`);
      console.log(`  Event: ${event.event}`);
      console.log(`  Forecast: ${event.forecast}`);
      console.log(`  Previous: ${event.previous}`);
      console.log(`  Fact: ${event.fact}`);
      console.log(`  Raw fact type: ${typeof event.fact}`);
      console.log("---");
    });

    // Count how many have fact data
    const withFacts = events.filter(
      (e) => e.fact !== null && e.fact !== undefined
    );
    console.log(
      `\n📈 Events with FACT data: ${withFacts.length}/${events.length}`
    );

    if (withFacts.length > 0) {
      console.log("\n✅ Sample events WITH facts:");
      withFacts.slice(0, 3).forEach((event) => {
        console.log(
          `  ${event.time} ${event.currency} - ${event.event} | FACT: ${event.fact}`
        );
      });
    }

    const withoutFacts = events.filter(
      (e) => e.fact === null || e.fact === undefined
    );
    if (withoutFacts.length > 0) {
      console.log("\n❌ Sample events WITHOUT facts:");
      withoutFacts.slice(0, 3).forEach((event) => {
        console.log(
          `  ${event.time} ${event.currency} - ${event.event} | FACT: ${event.fact}`
        );
      });
    }
  } catch (error) {
    console.error("❌ Debug error:", error);
  } finally {
    await db.close();
  }
}

debugFactData();
