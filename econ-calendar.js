const puppeteer = require("puppeteer");

class EconomicCalendarScraper {
  constructor() {
    this.browser = null;
    this.page = null;
  }

  async init() {
    this.browser = await puppeteer.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });
    this.page = await this.browser.newPage();
    await this.page.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
    );
  }

  async close() {
    if (this.browser) {
      await this.browser.close();
    }
  }

  parseRussianDate(dateStr) {
    // Add null check
    if (!dateStr) {
      console.log("❌ Date string is null or empty");
      return null;
    }

    // Clean HTML entities
    let cleanDateStr = dateStr
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .trim();

    console.log(`🔍 Parsing date string: "${cleanDateStr}"`);

    // Skip obvious placeholder dates or empty strings
    if (
      cleanDateStr.includes("2038") ||
      cleanDateStr.includes("1970") ||
      cleanDateStr === ""
    ) {
      //   console.log("❌ Skipping placeholder or empty date");
      return null;
    }

    // Parse "Понедельник, 4 августа 2025 г." to "04.08.2025"
    const months = {
      января: "01",
      февраля: "02",
      марта: "03",
      апреля: "04",
      мая: "05",
      июня: "06",
      июля: "07",
      августа: "08",
      сентября: "09",
      октября: "10",
      ноября: "11",
      декабря: "12",
      // Add English months as fallback
      january: "01",
      february: "02",
      march: "03",
      april: "04",
      may: "05",
      june: "06",
      july: "07",
      august: "08",
      september: "09",
      october: "10",
      november: "11",
      december: "12",
      jan: "01",
      feb: "02",
      mar: "03",
      apr: "04",
      jun: "06",
      jul: "07",
      aug: "08",
      sep: "09",
      oct: "10",
      nov: "11",
      dec: "12",
    };

    // Fixed regex: Use [а-яё] for Cyrillic characters or [a-zA-Zа-яёА-ЯЁ] for both
    const match = cleanDateStr.match(/(\d+)\s+([а-яёa-zA-Z]+)\s+(\d{4})/);
    if (!match) {
      console.log("❌ Date regex did not match");
      return null;
    }

    const [, day, monthName, year] = match;
    const month = months[monthName.toLowerCase()];
    if (!month) {
      console.log(`❌ Month not found: ${monthName}`);
      return null;
    }

    const result = `${day.padStart(2, "0")}.${month}.${year}`;
    console.log(`✅ Parsed date: ${result}`);
    return result;
  }

  parseNumber(value) {
    if (!value || value.trim() === "" || value === "-") return null;

    // Remove % and convert
    let cleanValue = value.replace("%", "").replace(",", ".").trim();

    // Handle K suffix (thousands)
    if (cleanValue.endsWith("K")) {
      cleanValue = cleanValue.slice(0, -1);
      const num = parseFloat(cleanValue);
      return isNaN(num) ? null : num * 1000;
    }

    const num = parseFloat(cleanValue);
    return isNaN(num) ? null : num;
  }

  // Add this debugging function to scraper.js before scrapeTomorrowData():

  async debugPageStructure() {
    try {
      await this.page.goto("https://ru.investing.com/economic-calendar/", {
        waitUntil: "networkidle2",
        timeout: 30000,
      });

      console.log("🔍 Debugging page structure...");

      // Check what tabs are available
      const tabInfo = await this.page.evaluate(() => {
        // Look for different possible tab selectors
        const selectors = [
          'a[data-test="Tomorrow"]',
          '[data-test*="Tomorrow"]',
          'a[href*="tomorrow"]',
          ".tabItem",
          ".tab",
          'a[aria-label*="Завтра"]',
          'a[title*="Завтра"]',
        ];

        const results = {};

        selectors.forEach((selector) => {
          const elements = document.querySelectorAll(selector);
          results[selector] = elements.length;
          if (elements.length > 0) {
            results[`${selector}_text`] = Array.from(elements).map(
              (el) => el.textContent?.trim() || el.outerHTML.substring(0, 100)
            );
          }
        });

        // Also search for any element containing "Завтра"
        const allElements = document.querySelectorAll("*");
        const zavtraElements = [];
        allElements.forEach((el) => {
          if (
            el.textContent &&
            el.textContent.includes("Завтра") &&
            el.tagName !== "SCRIPT"
          ) {
            zavtraElements.push({
              tag: el.tagName,
              classes: el.className,
              id: el.id,
              text: el.textContent.trim().substring(0, 50),
              selector: el.getAttribute("data-test") || "no-data-test",
            });
          }
        });

        results.zavtraElements = zavtraElements;
        return results;
      });

      console.log("Tab debugging results:", JSON.stringify(tabInfo, null, 2));
      return tabInfo;
    } catch (error) {
      console.error("Debug error:", error.message);
    }
  }

  async scrapeTomorrowData() {
    try {
      await this.page.goto("https://ru.investing.com/economic-calendar/", {
        waitUntil: "networkidle2",
        timeout: 30000,
      });

      console.log("🔍 Looking for Tomorrow tab...");

      // Updated selectors based on debug results
      const possibleSelectors = [
        "#timeFrame_tomorrow", // Found in debug!
        'a[id="timeFrame_tomorrow"]',
        '.newBtn.toggleButton:contains("Завтра")',
        'a[data-test="Tomorrow"]',
        'a[href*="tomorrow"]',
      ];

      let tomorrowClicked = false;

      for (const selector of possibleSelectors) {
        try {
          await this.page.waitForSelector(selector, { timeout: 3000 });

          // Check if already selected (has "toggled" class)
          const isToggled = await this.page.evaluate((sel) => {
            const element = document.querySelector(sel);
            return element ? element.classList.contains("toggled") : false;
          }, selector);

          if (isToggled) {
            console.log(`✅ Tomorrow tab already selected: ${selector}`);
            tomorrowClicked = true;
            break;
          } else {
            await this.page.click(selector);
            console.log(`✅ Clicked Tomorrow tab using: ${selector}`);
            tomorrowClicked = true;
            break;
          }
        } catch (err) {
          console.log(`❌ Selector failed: ${selector}`);
          continue;
        }
      }

      // Fallback: click by text content
      if (!tomorrowClicked) {
        console.log("🔄 Trying text-based click...");
        try {
          const clicked = await this.page.evaluate(() => {
            const elements = Array.from(
              document.querySelectorAll("a, button, span")
            );
            const tomorrowElement = elements.find(
              (el) => el.textContent && el.textContent.trim() === "Завтра"
            );
            if (tomorrowElement) {
              tomorrowElement.click();
              return true;
            }
            return false;
          });

          if (clicked) {
            console.log("✅ Clicked Tomorrow tab by text content");
            tomorrowClicked = true;
          }
        } catch (err) {
          console.log("❌ Text-based click failed");
        }
      }

      if (!tomorrowClicked) {
        throw new Error("Could not find or click Tomorrow tab");
      }

      // Replace waitForTimeout with proper delay
      await new Promise((resolve) => setTimeout(resolve, 3000));

      // Find and parse date
      console.log("🔍 Looking for date on page...");

      const dateInfo = await this.page.evaluate(() => {
        const results = {
          foundElements: [],
          pageTitle: document.title,
          url: window.location.href,
        };

        // Check all possible date containers
        const selectors = [
          "#datePickerToggleBtn",
          ".datePickerDisplayDate",
          ".economicCalendarDatePickerTitle",
          '[data-test="date-picker-title"]',
          ".datePicker",
          ".calendar-date",
          ".date-title",
          ".selectedDate",
          "#economicCalendarForm .datePickerDisplayDate",
          ".datePickerDisplayDate span",
          "#datePickerToggleBtn span",
        ];

        selectors.forEach((selector) => {
          const element = document.querySelector(selector);
          if (element) {
            results.foundElements.push({
              selector,
              text: element.textContent.trim(),
              innerHTML: element.innerHTML.trim(),
              innerText: element.innerText ? element.innerText.trim() : "",
              title: element.title || "",
              value: element.value || "",
            });
          }
        });

        // Also search for any text that looks like a meaningful date (not 2038!)
        const allText = document.body.textContent;
        const dateMatches = allText.match(/\d{1,2}\s+\w+\s+202[4-9]/g); // Only 2024-2029
        if (dateMatches) {
          results.dateMatches = dateMatches.slice(0, 5);
        }

        // Look for current selected date in any format
        const russianDateMatches = allText.match(
          /\d{1,2}\s+(января|февраля|марта|апреля|мая|июня|июля|августа|сентября|октября|ноября|декабря)\s+202[4-9]/g
        );
        if (russianDateMatches) {
          results.russianDateMatches = russianDateMatches.slice(0, 5);
        }

        return results;
      });

      console.log(
        "📅 Date extraction debug:",
        JSON.stringify(dateInfo, null, 2)
      );

      let finalParsedDate = null;
      let foundDateText = null;

      // Try found elements first
      if (dateInfo.foundElements.length > 0) {
        for (const element of dateInfo.foundElements) {
          // Try different text sources
          const textSources = [
            element.text,
            element.innerText,
            element.innerHTML,
            element.title,
            element.value,
          ];

          for (const text of textSources) {
            if (text && text.length > 0 && !text.includes("2038")) {
              foundDateText = text;
              finalParsedDate = this.parseRussianDate(text);
              if (finalParsedDate) {
                console.log(
                  `✅ Successfully parsed date from ${element.selector}: ${finalParsedDate}`
                );
                break;
              }
            }
          }
          if (finalParsedDate) break;
        }
      }

      // Try Russian date matches
      if (!finalParsedDate && dateInfo.russianDateMatches) {
        for (const match of dateInfo.russianDateMatches) {
          foundDateText = match;
          finalParsedDate = this.parseRussianDate(match);
          if (finalParsedDate) {
            console.log(
              `✅ Successfully parsed date from Russian text match: ${finalParsedDate}`
            );
            break;
          }
        }
      }

      // Try regular date matches (but skip obvious placeholders)
      if (!finalParsedDate && dateInfo.dateMatches) {
        for (const match of dateInfo.dateMatches) {
          if (!match.includes("2038")) {
            foundDateText = match;
            finalParsedDate = this.parseRussianDate(match);
            if (finalParsedDate) {
              console.log(
                `✅ Successfully parsed date from text match: ${finalParsedDate}`
              );
              break;
            }
          }
        }
      }

      // Final fallback
      if (!finalParsedDate) {
        console.log(
          "⚠️  Could not find valid date on page, using tomorrow as fallback"
        );
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        finalParsedDate = tomorrow.toLocaleDateString("ru-RU", {
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
        });
        console.log(`📅 Using fallback date: ${finalParsedDate}`);
      }

      console.log(`📅 Final parsed date: ${finalParsedDate}`);

      // Extract table data - wait for content to load
      await new Promise((resolve) => setTimeout(resolve, 2000));

      const events = await this.page.evaluate((targetDate) => {
        // ... rest of the table extraction code stays the same
        const results = [];

        // Try different table row selectors
        const possibleRowSelectors = [
          "tr.js-event-item",
          "tr[data-event-datetime]",
          "#economicCalendarData tr",
          "table.genTbl tbody tr",
          ".economicCalendarRow",
          "tbody tr",
        ];

        let rows = [];
        for (const selector of possibleRowSelectors) {
          rows = document.querySelectorAll(selector);
          if (rows.length > 0) {
            console.log(`Found ${rows.length} rows with selector: ${selector}`);
            break;
          }
        }

        if (rows.length === 0) {
          console.log("No table rows found with any selector");
          return [];
        }

        rows.forEach((row, index) => {
          try {
            const cells = row.querySelectorAll("td");
            if (cells.length < 5) return; // Skip incomplete rows

            console.log(`Row ${index} has ${cells.length} cells`);

            // Time is usually in first cell
            let time = null;
            const timeText = cells[0].textContent.trim();
            if (timeText.match(/^\d{2}:\d{2}$/)) {
              time = timeText;
            }

            if (!time) return; // Skip rows without valid time

            // Currency - usually in second cell, look for 3-letter codes
            let currency = null;
            for (let i = 1; i < Math.min(4, cells.length); i++) {
              const cellText = cells[i].textContent.trim();
              if (cellText.match(/^[A-Z]{3}$/)) {
                currency = cellText;
                break;
              }
            }

            // Volatility - count importance indicators (usually in a cell near currency)
            let volatility = 0;
            for (let i = 1; i < Math.min(4, cells.length); i++) {
              const cell = cells[i];
              const stars = cell.querySelectorAll(
                ".grayFullBullishIcon, .redFullBullishIcon, .orangeFullBullishIcon"
              );
              if (stars.length > 0) {
                volatility = stars.length;
                break;
              }
              // Fallback: count any star-like elements
              const allStars = cell.querySelectorAll(
                '[class*="star"], [class*="Bull"]'
              );
              if (allStars.length > 0) {
                volatility = Math.min(3, allStars.length); // Cap at 3
                break;
              }
            }

            // Event description - usually the cell with longest meaningful text
            let event = null;
            let maxLength = 0;
            for (let i = 2; i < cells.length - 3; i++) {
              // Skip first 2 and last 3 cells
              const cellText = cells[i].textContent.trim();
              if (
                cellText.length > maxLength &&
                cellText.length > 10 &&
                !cellText.match(/^\d+[\.,]?\d*%?$/) &&
                !cellText.match(/^[A-Z]{3}$/)
              ) {
                event = cellText;
                maxLength = cellText.length;
              }
            }

            // Economic calendar typical order: Time, Currency, Volatility, Event, Previous, Forecast, Actual
            // Last 3 cells should be: Previous, Forecast, Actual (Fact)
            // Economic calendar typical order: Time, Currency, Volatility, Event, Forecast, Previous, Actual
            // Last 3 cells should be: Forecast, Previous, Actual (Fact)
            let previous = null,
              forecast = null,
              fact = null;

            if (cells.length >= 3) {
              const lastThreeCells = [
                cells[cells.length - 3].textContent.trim(), // Forecast
                cells[cells.length - 2].textContent.trim(), // Previous
                cells[cells.length - 1].textContent.trim(), // Actual/Fact
              ];

              console.log(`Row ${index} last 3 cells:`, lastThreeCells);

              // Assign in correct order: Forecast, Previous, Actual
              forecast =
                lastThreeCells[0] === "" || lastThreeCells[0] === "-"
                  ? null
                  : lastThreeCells[0];
              previous =
                lastThreeCells[1] === "" || lastThreeCells[1] === "-"
                  ? null
                  : lastThreeCells[1];
              fact =
                lastThreeCells[2] === "" || lastThreeCells[2] === "-"
                  ? null
                  : lastThreeCells[2];
            }

            if (time && event) {
              const rowData = {
                date: targetDate,
                time,
                currency: currency || "N/A",
                volatility,
                event,
                fact, // Actual (rightmost column)
                forecast, // Forecast (leftmost of the three)
                previous, // Previous (middle column)
              };

              results.push(rowData);
              console.log(`Row ${index}:`, rowData);
            }
          } catch (rowError) {
            console.log(`Error processing row ${index}:`, rowError.message);
          }
        });

        return results;
      }, finalParsedDate); // Use finalParsedDate instead of parsedDate

      console.log(`📊 Found ${events.length} events before processing`);

      // Process numbers
      const processedEvents = events.map((event) => ({
        ...event,
        fact: this.parseNumber(event.fact),
        forecast: this.parseNumber(event.forecast),
        previous: this.parseNumber(event.previous),
      }));

      console.log(`✅ Processed ${processedEvents.length} events`);
      return processedEvents;
    } catch (error) {
      console.error("❌ Scraping error:", error.message);
      throw error;
    }
  }
}

// Usage function
async function scrapeEconomicCalendar() {
  const scraper = new EconomicCalendarScraper();

  try {
    await scraper.init();
    const data = await scraper.scrapeTomorrowData();
    console.log("Scraped data:", JSON.stringify(data, null, 2));
    return data;
  } catch (error) {
    console.error("Failed to scrape:", error);
    return [];
  } finally {
    await scraper.close();
  }
}

module.exports = { scrapeEconomicCalendar, EconomicCalendarScraper };

// // Run if called directly
// if (require.main === module) {
//   scrapeEconomicCalendar();
// }
