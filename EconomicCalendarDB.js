const Database = require("./database");
const EconomicEventsModel = require("./economicEventsModel");
const TelegramUsersModel = require("./telegramUsersModel");
const { scrapeEconomicCalendar } = require("./CalendarScrapper"); // Your scraper

class EconomicCalendarDB {
  constructor() {
    this.db = new Database();
    this.eventsModel = new EconomicEventsModel(this.db);
    this.usersModel = new TelegramUsersModel(this.db);
  }

  async init() {
    try {
      await this.db.createTables();
      console.log("✅ Database initialized");
    } catch (error) {
      console.error("❌ Database initialization failed:", error);
      throw error;
    }
  }

  async updateEconomicData() {
    try {
      console.log("🔄 Начинаю обновление экономических данных...");

      // Scrape fresh data
      const scrapedData = await scrapeEconomicCalendar();

      if (!scrapedData || scrapedData.length === 0) {
        console.log("⚠️ Данные не собраны, база данных не обновлена");
        return { success: false, message: "Данные не собраны" };
      }

      // Use date-specific overwrite
      await this.eventsModel.overwriteEventsForDate(scrapedData);

      console.log("✅ Экономические данные обновлены успешно");
      return {
        success: true,
        message: `Обновлено ${scrapedData.length} событий`,
        data: scrapedData,
      };
    } catch (error) {
      console.error("❌ Ошибка обновления экономических данных:", error);
      return {
        success: false,
        message: error.message,
        error: error,
      };
    }
  }

  async getDataForBroadcast() {
    try {
      const events = await this.eventsModel.getAllEvents();
      const activeUsers = await this.usersModel.getActiveUsers();

      return {
        events,
        users: activeUsers,
        userCount: activeUsers.length,
        eventCount: events.length,
      };
    } catch (error) {
      console.error("❌ Error getting broadcast data:", error);
      throw error;
    }
  }

  async close() {
    await this.db.close();
  }
}

module.exports = EconomicCalendarDB;
