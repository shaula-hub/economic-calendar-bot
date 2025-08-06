const { EconomicCalendarScraper } = require("../CalendarScrapper");

async function findActualEconomicTable() {
  const scraper = new EconomicCalendarScraper();

  try {
    await scraper.init();

    await scraper.page.goto("https://ru.investing.com/economic-calendar/", {
      waitUntil: "networkidle2",
      timeout: 30000,
    });

    // Make sure we're on Today tab
    await scraper.page.click("#timeFrame_today");
    await new Promise((resolve) => setTimeout(resolve, 3000));

    console.log("🔍 Searching for the REAL economic calendar table...\n");

    const realTableAnalysis = await scraper.page.evaluate(() => {
      const results = {
        foundTables: [],
        economicRows: [],
      };

      // Look for more specific economic calendar selectors
      const economicSelectors = [
        "table#economicCalendarData tbody tr",
        "table.genTbl tbody tr",
        "tr.js-event-item",
        "tr[data-event-datetime]",
        ".economicCalendarRow",
        'tr[id*="eventRowId"]',
        "tr.event",
        'tbody tr[class*="event"]',
      ];

      console.log("Testing economic calendar selectors...");

      economicSelectors.forEach((selector) => {
        const rows = document.querySelectorAll(selector);
        if (rows.length > 0) {
          console.log(`Selector "${selector}" found ${rows.length} rows`);

          // Analyze first few rows to see if they look like economic events
          const sampleData = Array.from(rows)
            .slice(0, 3)
            .map((row, index) => {
              const cells = row.querySelectorAll("td");
              return {
                rowIndex: index,
                cellCount: cells.length,
                firstCellText: cells[0] ? cells[0].textContent.trim() : "",
                allCellsText: Array.from(cells).map((cell) =>
                  cell.textContent.trim()
                ),
                rowClasses: row.className,
                rowId: row.id,
              };
            });

          results.foundTables.push({
            selector,
            rowCount: rows.length,
            sampleData,
          });
        }
      });

      // Also search for any rows that contain time patterns (HH:MM)
      console.log("Searching for rows with time patterns...");
      const allRows = document.querySelectorAll("tr");
      const timeRows = [];

      allRows.forEach((row, index) => {
        const cells = row.querySelectorAll("td");
        if (cells.length > 0) {
          const firstCellText = cells[0].textContent.trim();
          // Look for time pattern HH:MM
          if (firstCellText.match(/^\d{2}:\d{2}$/)) {
            timeRows.push({
              rowIndex: index,
              cellCount: cells.length,
              timeText: firstCellText,
              allCells: Array.from(cells).map((cell) =>
                cell.textContent.trim()
              ),
              rowClasses: row.className,
              rowId: row.id,
            });
          }
        }
      });

      results.economicRows = timeRows.slice(0, 5); // First 5 time-based rows

      return results;
    });

    console.log("📊 Analysis Results:\n");

    if (realTableAnalysis.foundTables.length > 0) {
      console.log("🎯 Found potential economic calendar tables:");
      realTableAnalysis.foundTables.forEach((table, index) => {
        console.log(
          `\n   Table ${index + 1}: ${table.selector} (${table.rowCount} rows)`
        );
        table.sampleData.forEach((row) => {
          console.log(
            `     Row ${row.rowIndex}: "${row.firstCellText}" (${row.cellCount} cells)`
          );
          if (row.allCellsText.length <= 10) {
            // Only show if not too many cells
            console.log(
              `       All cells: [${row.allCellsText
                .map((c) => `"${c}"`)
                .join(", ")}]`
            );
          }
        });
      });
    }

    if (realTableAnalysis.economicRows.length > 0) {
      console.log(
        "\n⏰ Found rows with time patterns (likely economic events):"
      );
      realTableAnalysis.economicRows.forEach((row) => {
        console.log(`\n   ⏰ ${row.timeText} (${row.cellCount} cells):`);
        console.log(`     Classes: "${row.rowClasses}"`);
        console.log(`     ID: "${row.rowId}"`);

        // Show all cells but highlight last 3 (should be forecast, previous, actual)
        row.allCells.forEach((cellText, cellIndex) => {
          const isLast3 = cellIndex >= row.allCells.length - 3;
          const marker = isLast3 ? "→" : " ";
          console.log(`     ${marker} Cell ${cellIndex}: "${cellText}"`);
        });

        if (row.cellCount >= 3) {
          const lastThree = row.allCells.slice(-3);
          console.log(`     🎯 LAST 3 (F|P|A): [${lastThree.join(" | ")}]`);
        }
      });
    } else {
      console.log("❌ No rows with time patterns found!");
    }

    return realTableAnalysis;
  } catch (error) {
    console.error("❌ Error:", error);
  } finally {
    await scraper.close();
  }
}

findActualEconomicTable();
