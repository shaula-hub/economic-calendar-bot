async handleStart(msg) {
  // ... existing subscription check code ...

  const welcomeMessage = `
🏦 **Бот экономических событий**

✅ Добро пожаловать! Вы подписчик ${REQUIRED_CHANNEL}

📊 Я предоставляю ежедневную информацию по экономическим событиям,
которые могут повлиять на цены активов на финансовых площадках\\.

**Доступные команды:**
📬 /subscribe \\- Подписаться на ежедневные обновления событий  
🔕 /unsubscribe \\- Отписаться
📊 /status \\- Проверка статуса подписки
🔄 /update \\- Обновить экономические данные сейчас

Для получения ежедневных данных выберите /subscribe!
  `;

  await this.bot.sendMessage(chatId, welcomeMessage, {
    parse_mode: "Markdown",
  });
}