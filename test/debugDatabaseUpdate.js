const EconomicCalendarDB = require("../economicCalendarDB");
require("dotenv").config();

async function debugDatabaseUpdate() {
  const db = new EconomicCalendarDB();

  try {
    await db.init();

    console.log("📊 BEFORE UPDATE - Database status:");
    const beforeEvents = await db.eventsModel.getAllEvents();
    console.log(`Total events: ${beforeEvents.length}`);

    if (beforeEvents.length > 0) {
      const dates = [
        ...new Set(
          beforeEvents.map((e) => new Date(e.date).toISOString().split("T")[0])
        ),
      ];
      console.log("Dates in DB:", dates.sort());

      const today = new Date().toISOString().split("T")[0];
      const todayEvents = beforeEvents.filter(
        (e) => new Date(e.date).toISOString().split("T")[0] === today
      );
      console.log(`Events for today (${today}): ${todayEvents.length}`);
    }

    console.log("\n🔄 RUNNING UPDATE...");
    const result = await db.updateEconomicData();

    console.log("\n📊 AFTER UPDATE - Database status:");
    console.log("Update result:", result);

    const afterEvents = await db.eventsModel.getAllEvents();
    console.log(`Total events: ${afterEvents.length}`);

    if (afterEvents.length > 0) {
      const dates = [
        ...new Set(
          afterEvents.map((e) => new Date(e.date).toISOString().split("T")[0])
        ),
      ];
      console.log("Dates in DB:", dates.sort());

      const today = new Date().toISOString().split("T")[0];
      const todayEvents = afterEvents.filter(
        (e) => new Date(e.date).toISOString().split("T")[0] === today
      );
      console.log(`Events for today (${today}): ${todayEvents.length}`);

      if (todayEvents.length > 0) {
        console.log("\nSample today events:");
        todayEvents.slice(0, 3).forEach((event) => {
          console.log(`  ${event.time} - ${event.event} (Date: ${event.date})`);
        });
      }
    }

    console.log("\n🔍 COMPARISON:");
    console.log(`Events before: ${beforeEvents.length}`);
    console.log(`Events after: ${afterEvents.length}`);
    console.log(
      `Database changed: ${
        beforeEvents.length !== afterEvents.length ? "✅ YES" : "❌ NO"
      }`
    );
  } catch (error) {
    console.error("Error:", error);
  } finally {
    await db.close();
  }
}

debugDatabaseUpdate();
