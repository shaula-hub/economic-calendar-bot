class EconomicEventsModel {
  constructor(database) {
    this.db = database;
  }

  async overwriteEventsForDate(events) {
    if (!events || events.length === 0) {
      console.log("⚠️ No events to insert");
      return;
    }

    // Get unique dates from the events
    const dates = [
      ...new Set(
        events.map((event) => {
          const [day, month, year] = event.date.split(".");
          return `${year}-${month}-${day}`;
        })
      ),
    ];

    console.log(`🗑️ Clearing events for dates: ${dates.join(", ")}`);

    const insertQuery = `
    INSERT INTO economic_events (date, time, currency, volatility, event, fact, forecast, previous)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
  `;

    try {
      // Start transaction
      await this.db.query("BEGIN");

      // Delete existing events for these dates
      for (const date of dates) {
        const deleteResult = await this.db.query(
          "DELETE FROM economic_events WHERE date = $1",
          [date]
        );
        console.log(`✅ Cleared ${deleteResult.rowCount} events for ${date}`);
      }

      // Insert new events
      let insertedCount = 0;
      for (const event of events) {
        const [day, month, year] = event.date.split(".");
        const formattedDate = `${year}-${month}-${day}`;

        await this.db.query(insertQuery, [
          formattedDate,
          event.time,
          event.currency,
          event.volatility,
          event.event,
          event.fact,
          event.forecast,
          event.previous,
        ]);
        insertedCount++;
      }

      await this.db.query("COMMIT");
      console.log(
        `✅ Successfully inserted ${insertedCount} events for ${dates.length} date(s)`
      );
    } catch (error) {
      await this.db.query("ROLLBACK");
      console.error("❌ Error overwriting events for date:", error);
      throw error;
    }
  }

  async getAllEvents() {
    try {
      const result = await this.db.query(
        "SELECT * FROM economic_events ORDER BY date, time"
      );
      return result.rows;
    } catch (error) {
      console.error("❌ Error fetching events:", error);
      throw error;
    }
  }

  async getEventsByDate(date) {
    try {
      const result = await this.db.query(
        "SELECT * FROM economic_events WHERE date = $1 ORDER BY time",
        [date]
      );
      return result.rows;
    } catch (error) {
      console.error("❌ Error fetching events by date:", error);
      throw error;
    }
  }
}

module.exports = EconomicEventsModel;
