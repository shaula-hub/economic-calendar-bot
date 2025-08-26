const puppeteer = require("puppeteer");

const fs = require("fs"); // Add this import - for DEBUG

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

  // Add this logging helper function
  logToFile(message) {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] ${message}\n`;
    fs.appendFileSync("/tmp/scraper-debug.log", logMessage);
    console.log(message); // Also show in console if anyone is watching
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

  async scrapeTodayData() {
    try {
      await this.page.goto("https://ru.investing.com/economic-calendar/", {
        waitUntil: "networkidle2",
        timeout: 30000,
      });

      console.log("🔍 Looking for Today tab...");

      // Today tab selectors
      const possibleSelectors = [
        "#timeFrame_today",
        'a[id="timeFrame_today"]',
        '.newBtn.toggleButton:contains("Сегодня")',
        'a[data-test="Today"]',
        'a[href*="today"]',
      ];

      let todayClicked = false;

      for (const selector of possibleSelectors) {
        try {
          await this.page.waitForSelector(selector, { timeout: 3000 });

          // Check if already selected (has "toggled" class)
          const isToggled = await this.page.evaluate((sel) => {
            const element = document.querySelector(sel);
            return element ? element.classList.contains("toggled") : false;
          }, selector);

          if (isToggled) {
            console.log(`✅ Today tab already selected: ${selector}`);
            todayClicked = true;
            break;
          } else {
            await this.page.click(selector);
            console.log(`✅ Clicked Today tab using: ${selector}`);
            todayClicked = true;
            break;
          }
        } catch (err) {
          console.log(`❌ Selector failed: ${selector}`);
          continue;
        }
      }

      // Fallback: click by text content for "Сегодня" (Today)
      if (!todayClicked) {
        console.log("🔄 Trying text-based click...");
        try {
          const clicked = await this.page.evaluate(() => {
            const elements = Array.from(
              document.querySelectorAll("a, button, span")
            );
            const todayElement = elements.find(
              (el) => el.textContent && el.textContent.trim() === "Сегодня"
            );
            if (todayElement) {
              todayElement.click();
              return true;
            }
            return false;
          });

          if (clicked) {
            console.log("✅ Clicked Today tab by text content");
            todayClicked = true;
          }
        } catch (err) {
          console.log("❌ Text-based click failed");
        }
      }

      if (!todayClicked) {
        throw new Error("Could not find or click Today tab");
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

      // Final fallback - use today's date
      if (!finalParsedDate) {
        console.log(
          "⚠️  Could not find valid date on page, using today as fallback"
        );
        const today = new Date();
        finalParsedDate = today.toLocaleDateString("ru-RU", {
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
        const results = [];
        let eventIndex = 0; // ADD THIS: Global counter for maintaining original order

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

            // Simplified time extraction - just take what the website gives us
            let time = null;
            const timeText = cells[0].textContent.trim();

            console.log(`Row ${index} time: "${timeText}"`);

            if (timeText.length > 0 && timeText !== "-" && timeText !== "TBA") {
              time = timeText; // Store exactly as it appears on website
              console.log(`✅ ACCEPTED TIME: ${time}`);
            } else {
              console.log(`❌ NO VALID TIME FOUND`);
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

            // Economic calendar typical order: Time, Currency, Volatility, Event, Actual, Forecast, Previous
            // Last 3 cells should be:  Actual (Fact), Forecast, Previous
            let previous = null,
              forecast = null,
              fact = null;

            // NEW - Correct mapping (cells 4, 5, 6)
            if (cells.length >= 7) {
              const factCell = cells[4].textContent.trim(); // Cell 4: FACT/Actual
              const forecastCell = cells[5].textContent.trim(); // Cell 5: FORECAST
              const previousCell = cells[6].textContent.trim(); // Cell 6: PREVIOUS

              fact = factCell === "" || factCell === "-" ? null : factCell;
              forecast =
                forecastCell === "" || forecastCell === "-"
                  ? null
                  : forecastCell;
              previous =
                previousCell === "" || previousCell === "-"
                  ? null
                  : previousCell;

              console.log(
                `Row ${index} correct mapping: F:${factCell}, Fc:${forecastCell}, P:${previousCell}`
              );
            }

            if (time && event) {
              const rowData = {
                date: targetDate,
                time, // Keep original time for now, convert outside
                currency: currency || "N/A",
                volatility,
                event,
                fact, // Actual
                forecast, // Forecast
                previous, // Previous
                originalIndex: eventIndex++, // ADD THIS: Sequential index preserving website order
              };

              results.push(rowData);
              console.log(
                `Row ${index} with originalIndex ${rowData.originalIndex}:`,
                rowData
              );
            }
          } catch (rowError) {
            console.log(`Error processing row ${index}:`, rowError.message);
          }
        });

        return results;
      }, finalParsedDate);

      console.log(`📊 Found ${events.length} events before processing`);

      // Process numbers and convert relative times
      const processedEvents = events.map((event) => ({
        ...event,
        fact: this.parseNumber(event.fact),
        forecast: this.parseNumber(event.forecast),
        previous: this.parseNumber(event.previous),
        // originalIndex is preserved automatically from the spread operator
      }));

      console.log(`✅ Processed ${processedEvents.length} events`);
      return processedEvents;
    } catch (error) {
      console.error("❌ Today scraping error:", error.message);
      throw error;
    }
  }

  async scrapeTomorrowData() {
    try {
      await this.page.goto("https://ru.investing.com/economic-calendar/", {
        waitUntil: "networkidle2",
        timeout: 30000,
      });

      console.log("🔍 Looking for Tomorrow tab...");

      // Tomorrow tab selectors (fixed)
      const possibleSelectors = [
        "#timeFrame_tomorrow",
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
        const results = [];
        let eventIndex = 0; // ADD THIS: Global counter for maintaining original order

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

            // Simplified time extraction - just take what the website gives us
            let time = null;
            const timeText = cells[0].textContent.trim();

            console.log(`Row ${index} time: "${timeText}"`);

            if (timeText.length > 0 && timeText !== "-" && timeText !== "TBA") {
              time = timeText; // Store exactly as it appears on website
              console.log(`✅ ACCEPTED TIME: ${time}`);
            } else {
              console.log(`❌ NO VALID TIME FOUND`);
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

            // Economic calendar typical order: Time, Currency, Volatility, Event, Actual, Forecast, Previous
            // Last 3 cells should be: Actual (Fact), Forecast, Previous,
            let previous = null,
              forecast = null,
              fact = null;

            // NEW - Correct mapping (cells 4, 5, 6)
            if (cells.length >= 7) {
              const factCell = cells[4].textContent.trim(); // Cell 4: FACT/Actual
              const forecastCell = cells[5].textContent.trim(); // Cell 5: FORECAST
              const previousCell = cells[6].textContent.trim(); // Cell 6: PREVIOUS

              fact = factCell === "" || factCell === "-" ? null : factCell;
              forecast =
                forecastCell === "" || forecastCell === "-"
                  ? null
                  : forecastCell;
              previous =
                previousCell === "" || previousCell === "-"
                  ? null
                  : previousCell;

              console.log(
                `Row ${index} correct mapping: F:${factCell}, Fc:${forecastCell}, P:${previousCell}`
              );
            }

            if (time && event) {
              const rowData = {
                date: targetDate,
                time, // Keep original time for now, convert outside
                currency: currency || "N/A",
                volatility,
                event,
                fact, // Actual (rightmost column)
                forecast, // Forecast (leftmost of the three)
                previous, // Previous (middle column)
                originalIndex: eventIndex++, // ADD THIS: Sequential index preserving website order
              };

              results.push(rowData);
              console.log(
                `Row ${index} with originalIndex ${rowData.originalIndex}:`,
                rowData
              );
            }
          } catch (rowError) {
            console.log(`Error processing row ${index}:`, rowError.message);
          }
        });

        return results;
      }, finalParsedDate);

      console.log(`📊 Found ${events.length} events before processing`);

      // Process numbers and convert relative times
      const processedEvents = events.map((event) => ({
        ...event,
        fact: this.parseNumber(event.fact),
        forecast: this.parseNumber(event.forecast),
        previous: this.parseNumber(event.previous),
        // originalIndex is preserved automatically from the spread operator
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

    // TEMPORARY DEBUG - check table structure first
    // console.log("🔍 DEBUGGING TABLE STRUCTURE...");
    // await scraper.debugTableStructure();

    // IMPORTANT: Use the smart current day scraper
    const data = await scraper.scrapeTodayData();
    console.log(
      "Сбор данных текущего дня:",
      JSON.stringify(data.slice(0, 2), null, 2)
    ); // Show first 2 events
    return data;
  } catch (error) {
    console.error("Failed to scrape:", error);
    return [];
  } finally {
    await scraper.close();
  }
}

module.exports = { scrapeEconomicCalendar, EconomicCalendarScraper };
