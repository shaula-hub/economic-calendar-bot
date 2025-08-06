const { EconomicCalendarScraper } = require('./econ-calendar');

async function runDebugTest() {
  const scraper = new EconomicCalendarScraper();
  
  try {
    await scraper.init();
    
    // First run debug to see page structure
    console.log('=== DEBUGGING PAGE STRUCTURE ===');
    await scraper.debugPageStructure();
    
    console.log('\n=== ATTEMPTING TO SCRAPE ===');
    const data = await scraper.scrapeTomorrowData();
    
    if (data.length === 0) {
      console.log('No data found');
    } else {
      console.log(`\n📊 Found ${data.length} events:`);
      console.table(data);
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await scraper.close();
  }
}

runDebugTest();