const { EconomicCalendarScraper } = require("../calendarScrapper");

async function findCurrentDayData() {
  const scraper = new EconomicCalendarScraper();

  try {
    await scraper.init();

    const actualToday = new Date().toLocaleDateString("ru-RU", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });

    console.log(`🗓️ System today: ${actualToday}\n`);

    await scraper.page.goto("https://ru.investing.com/economic-calendar/", {
      waitUntil: "networkidle2",
      timeout: 30000,
    });

    // Check Today tab
    console.log('📋 Checking "Today" tab...');
    await scraper.page.click("#timeFrame_today");
    await new Promise((resolve) => setTimeout(resolve, 2000));

    const todayData = await scraper.scrapeTodayData();
    console.log(`Today tab events: ${todayData.length}`);
    if (todayData.length > 0) {
      console.log(`Today tab date: ${todayData[0].date}`);
      console.log(
        `Matches system date: ${
          todayData[0].date === actualToday ? "✅ YES" : "❌ NO"
        }`
      );
    }

    // Check Tomorrow tab
    console.log('\n📋 Checking "Tomorrow" tab...');
    await scraper.page.click("#timeFrame_tomorrow");
    await new Promise((resolve) => setTimeout(resolve, 2000));

    const tomorrowData = await scraper.scrapeTomorrowData();
    console.log(`Tomorrow tab events: ${tomorrowData.length}`);
    if (tomorrowData.length > 0) {
      console.log(`Tomorrow tab date: ${tomorrowData[0].date}`);
      console.log(
        `Matches system date: ${
          tomorrowData[0].date === actualToday ? "✅ YES" : "❌ NO"
        }`
      );
    }

    console.log("\n🎯 CONCLUSION:");
    if (todayData.some((e) => e.date === actualToday)) {
      console.log('✅ Current day data is in "Today" tab');
    } else if (tomorrowData.some((e) => e.date === actualToday)) {
      console.log('✅ Current day data is in "Tomorrow" tab');
    } else {
      console.log("❌ Current day data not found in either tab");
    }
  } catch (error) {
    console.error("Error:", error);
  } finally {
    await scraper.close();
  }
}

findCurrentDayData();
