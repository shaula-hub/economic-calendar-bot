// Replace this section in broadcastDailyUpdate():
// Get today's date in DD.MM.YYYY format
var today = new Date();
var dateStr = today.toLocaleDateString("ru-RU", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

// Format message
var message = this.formatEventsMessage(events, dateStr);
var messageParts = this.splitLongMessage(message);

console.log(
  `📤 Broadcasting ${messageParts.length} message parts to ${activeUsers.length} users...`
);

// Send to each user
for (var userIndex = 0; userIndex < activeUsers.length; userIndex++) {
  var user = activeUsers[userIndex];
  try {
    // Send all parts of the message
    for (var i = 0; i < messageParts.length; i++) {
      var part = messageParts[i];
      var partHeader =
        messageParts.length > 1 ? `(${i + 1}/${messageParts.length}) ` : "";

      await this.bot.sendMessage(user.chat_id, partHeader + part, {
        parse_mode: "Markdown",
      });

      // Rate limiting delay between parts
      if (i < messageParts.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, 200));
      }
    }
    sent++;

    // Rate limiting delay between users
    await new Promise((resolve) => setTimeout(resolve, 100));
  } catch (error) {
    console.error(`Failed to send to ${user.telegram_user_id}:`, error.message);
    failed++;

    // Deactivate blocked users
    if (error.response && error.response.error_code === 403) {
      await this.db.usersModel.setUserActive(user.telegram_user_id, false);
      console.log(`Deactivated blocked user: ${user.telegram_user_id}`);
    }
  }
}
