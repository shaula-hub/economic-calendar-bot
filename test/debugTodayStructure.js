const { EconomicCalendarScraper } = require("../CalendarScrapper");

async function debugTodayTabInDetail() {
  const scraper = new EconomicCalendarScraper();

  try {
    await scraper.init();

    await scraper.page.goto("https://ru.investing.com/economic-calendar/", {
      waitUntil: "networkidle2",
      timeout: 30000,
    });

    console.log("🔍 Step 1: Checking available tabs...\n");

    // Check what tabs are available
    const tabInfo = await scraper.page.evaluate(() => {
      const tabs = [];

      // Look for all possible tab elements
      const selectors = [
        'a[id*="timeFrame"]',
        ".newBtn.toggleButton",
        'a[data-test*="day"]',
        ".tabItem",
        ".tab",
      ];

      selectors.forEach((selector) => {
        const elements = document.querySelectorAll(selector);
        elements.forEach((el) => {
          tabs.push({
            selector: selector,
            id: el.id,
            text: el.textContent.trim(),
            classes: el.className,
            href: el.href || "no-href",
          });
        });
      });

      return tabs;
    });

    console.log("📋 Available tabs:");
    tabInfo.forEach((tab, index) => {
      console.log(
        `  ${index + 1}. ID: ${tab.id} | Text: "${tab.text}" | Classes: ${
          tab.classes
        }`
      );
    });

    console.log("\n🔍 Step 2: Clicking Today tab...\n");

    // Try to click Today tab
    const possibleSelectors = [
      "#timeFrame_today",
      'a[id="timeFrame_today"]',
      '.newBtn.toggleButton:contains("Сегодня")',
      'a[data-test="Today"]',
    ];

    let todayClicked = false;

    for (const selector of possibleSelectors) {
      try {
        const elementExists = await scraper.page.$(selector);
        if (elementExists) {
          console.log(`✅ Found Today tab with selector: ${selector}`);
          await scraper.page.click(selector);
          console.log(`✅ Clicked Today tab`);
          todayClicked = true;
          break;
        }
      } catch (err) {
        console.log(`❌ Selector failed: ${selector}`);
      }
    }

    // Fallback - click by text
    if (!todayClicked) {
      console.log('🔄 Trying text-based click for "Сегодня"...');
      const clicked = await scraper.page.evaluate(() => {
        const elements = Array.from(
          document.querySelectorAll("a, button, span")
        );
        const todayElement = elements.find(
          (el) =>
            el.textContent &&
            (el.textContent.trim() === "Сегодня" ||
              el.textContent.trim() === "Today" ||
              el.textContent.trim().toLowerCase().includes("сегодня"))
        );
        if (todayElement) {
          console.log("Found today element:", todayElement.textContent);
          todayElement.click();
          return true;
        }
        return false;
      });

      if (clicked) {
        console.log("✅ Clicked Today tab by text");
        todayClicked = true;
      }
    }

    if (!todayClicked) {
      console.log("❌ Could not click Today tab, analyzing current page...");
    }

    // Wait for page to load
    await new Promise((resolve) => setTimeout(resolve, 3000));

    console.log("\n🔍 Step 3: Analyzing current page structure...\n");

    // Analyze the table structure
    const tableAnalysis = await scraper.page.evaluate(() => {
      const analysis = {
        currentUrl: window.location.href,
        pageTitle: document.title,
        dateDisplayed: "",
        tables: [],
        allRows: [],
      };

      // Find displayed date
      const dateSelectors = [
        "#datePickerToggleBtn",
        ".datePickerDisplayDate",
        ".selectedDate",
      ];

      dateSelectors.forEach((selector) => {
        const el = document.querySelector(selector);
        if (el && el.textContent.trim()) {
          analysis.dateDisplayed = el.textContent.trim();
        }
      });

      // Find all tables
      const tables = document.querySelectorAll("table");
      tables.forEach((table, index) => {
        const rows = table.querySelectorAll("tr");
        analysis.tables.push({
          tableIndex: index,
          rowCount: rows.length,
          classes: table.className,
          id: table.id,
        });
      });

      // Find specific economic calendar rows
      const possibleRowSelectors = [
        "tr.js-event-item",
        "tr[data-event-datetime]",
        "#economicCalendarData tr",
        "table.genTbl tbody tr",
        ".economicCalendarRow",
        "tbody tr",
      ];

      let bestRows = [];
      let bestSelector = "";

      possibleRowSelectors.forEach((selector) => {
        const rows = document.querySelectorAll(selector);
        if (rows.length > bestRows.length) {
          bestRows = Array.from(rows);
          bestSelector = selector;
        }
      });

      if (bestRows.length > 0) {
        analysis.bestSelector = bestSelector;
        analysis.bestRowCount = bestRows.length;

        // Analyze first 3 rows in detail
        bestRows.slice(0, 3).forEach((row, rowIndex) => {
          const cells = row.querySelectorAll("td");
          const rowData = {
            rowIndex,
            cellCount: cells.length,
            cells: Array.from(cells).map((cell, cellIndex) => ({
              cellIndex,
              text: cell.textContent.trim(),
              innerHTML: cell.innerHTML.substring(0, 100),
              classes: cell.className,
            })),
          };
          analysis.allRows.push(rowData);
        });
      }

      return analysis;
    });

    console.log("📊 Table Analysis Results:");
    console.log(`   Current URL: ${tableAnalysis.currentUrl}`);
    console.log(`   Date displayed: "${tableAnalysis.dateDisplayed}"`);
    console.log(`   Tables found: ${tableAnalysis.tables.length}`);
    console.log(`   Best row selector: ${tableAnalysis.bestSelector}`);
    console.log(`   Rows found: ${tableAnalysis.bestRowCount}`);

    if (tableAnalysis.allRows.length > 0) {
      console.log("\n📋 Sample Row Details:");
      tableAnalysis.allRows.forEach((row) => {
        console.log(`\n   Row ${row.rowIndex} (${row.cellCount} cells):`);
        row.cells.forEach((cell) => {
          if (cell.text.length > 0) {
            console.log(`     Cell ${cell.cellIndex}: "${cell.text}"`);
          }
        });

        // Show last 3 cells specifically
        if (row.cellCount >= 3) {
          const lastThree = row.cells.slice(-3);
          console.log(
            `     → LAST 3 CELLS: [${lastThree
              .map((c) => `"${c.text}"`)
              .join(", ")}]`
          );
        }
      });
    }

    console.log("\n🔍 Step 4: Testing current scraper method...\n");

    // Test the actual scraping
    try {
      const scrapedData = await scraper.scrapeTodayData();
      console.log(`📊 Scraper found ${scrapedData.length} events`);

      if (scrapedData.length > 0) {
        console.log("\n📈 Sample scraped events:");
        scrapedData.slice(0, 3).forEach((event, index) => {
          console.log(`\n   Event ${index + 1}:`);
          console.log(`     Time: ${event.time}`);
          console.log(`     Currency: ${event.currency}`);
          console.log(`     Event: ${event.event}`);
          console.log(
            `     Forecast: ${event.forecast} (${typeof event.forecast})`
          );
          console.log(
            `     Previous: ${event.previous} (${typeof event.previous})`
          );
          console.log(`     Fact: ${event.fact} (${typeof event.fact})`);
        });

        const withFacts = scrapedData.filter(
          (e) => e.fact !== null && e.fact !== undefined
        );
        console.log(
          `\n✅ Events with FACT data: ${withFacts.length}/${scrapedData.length}`
        );
      }
    } catch (error) {
      console.log(`❌ Scraper error: ${error.message}`);
    }
  } catch (error) {
    console.error("❌ Debug error:", error);
  } finally {
    await scraper.close();
  }
}

debugTodayTabInDetail();
