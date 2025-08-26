class TelegramUsersModel {
  constructor(database) {
    this.db = database;
  }

  escapeMarkdown(text) {
    if (!text) return text;
    // Escape special Markdown characters
    return text.replace(/([_*\[\]()~`>#+\-=|{}.!\\])/g, "\\$1");
  }

  async addUser(userData) {
    const { telegram_user_id, chat_id, username, first_name, last_name } =
      userData;

    const insertQuery = `
    INSERT INTO telegram_users (telegram_user_id, chat_id, username, first_name, last_name)
    VALUES ($1, $2, $3, $4, $5)
    ON CONFLICT (telegram_user_id) 
    DO UPDATE SET 
      chat_id = EXCLUDED.chat_id,
      username = EXCLUDED.username,
      first_name = EXCLUDED.first_name,
      last_name = EXCLUDED.last_name,
      last_subscription_check = NOW(),
      updated_at = NOW()
    RETURNING *
  `;

    try {
      const result = await this.db.query(insertQuery, [
        telegram_user_id,
        chat_id,
        username,
        first_name,
        last_name,
      ]);
      console.log(`✅ User added/updated: ${telegram_user_id}`);
      return result.rows[0];
    } catch (error) {
      console.error("❌ Error adding user:", error);
      throw error;
    }
  }

  async checkChannelSubscription(bot, userId, channelUsername) {
    try {
      const chatMember = await bot.getChatMember(channelUsername, userId);
      const isSubscribed = ["member", "administrator", "creator"].includes(
        chatMember.status
      );

      console.log(
        `📋 Channel subscription check for ${userId}: ${
          isSubscribed ? "subscribed" : "not subscribed"
        }`
      );
      return isSubscribed;
    } catch (error) {
      console.error(
        `❌ Error checking channel subscription for ${userId}:`,
        error.message
      );

      // TEMPORARY FIX: If bot can't check membership, allow access
      if (error.response && error.response.error_code === 400) {
        console.warn(
          `⚠️ Bot cannot check channel ${channelUsername} membership. Allowing access temporarily.`
        );
        return true; // TEMPORARY - Allow access when bot isn't admin
      }

      // For any other error, also allow temporarily
      console.warn(`⚠️ Channel check error, allowing access temporarily`);
      return true; // TEMPORARY - change to false when bot is admin in channel
    }
  }

  async updateSubscriptionStatus(userId, isSubscribed, userData = null) {
    try {
      // Get current status
      const currentUser = await this.db.query(
        "SELECT channel_subscribed FROM telegram_users WHERE telegram_user_id = $1",
        [userId]
      );

      const wasSubscribed = currentUser.rows[0]?.channel_subscribed || false;

      // Update user subscription status
      const updateQuery = `
        UPDATE telegram_users 
        SET 
          channel_subscribed = $1,
          subscription_date = CASE 
            WHEN $1 = true AND channel_subscribed = false THEN NOW() 
            ELSE subscription_date 
          END,
          last_subscription_check = NOW(),
          updated_at = NOW()
        WHERE telegram_user_id = $2
        RETURNING *
      `;

      const result = await this.db.query(updateQuery, [isSubscribed, userId]);

      // Log subscription events for analytics
      if (isSubscribed !== wasSubscribed) {
        const eventType = isSubscribed ? "subscribed" : "unsubscribed";
        await this.logSubscriptionEvent(userId, eventType, userData);

        console.log(`📊 User ${userId} ${eventType} to/from channel`);
      }

      return result.rows[0];
    } catch (error) {
      console.error("❌ Error updating subscription status:", error);
      throw error;
    }
  }

  async logSubscriptionEvent(userId, eventType, userData = null) {
    try {
      const insertQuery = `
        INSERT INTO subscription_events (telegram_user_id, event_type, user_data)
        VALUES ($1, $2, $3)
        RETURNING *
      `;

      const result = await this.db.query(insertQuery, [
        userId,
        eventType,
        userData ? JSON.stringify(userData) : null,
      ]);

      return result.rows[0];
    } catch (error) {
      console.error("❌ Error logging subscription event:", error);
      // Don't throw - this is just for analytics
    }
  }

  async getSubscriptionStats() {
    try {
      const statsQuery = `
        SELECT 
          COUNT(*) as total_users,
          COUNT(*) FILTER (WHERE channel_subscribed = true) as subscribed_users,
          COUNT(*) FILTER (WHERE is_active = true) as active_users,
          COUNT(*) FILTER (WHERE channel_subscribed = true AND is_active = true) as active_subscribers
        FROM telegram_users
      `;

      const result = await this.db.query(statsQuery);
      return result.rows[0];
    } catch (error) {
      console.error("❌ Error getting subscription stats:", error);
      throw error;
    }
  }

  async getActiveUsers() {
    try {
      const result = await this.db.query(
        "SELECT * FROM telegram_users WHERE is_active = true ORDER BY created_at"
      );
      return result.rows;
    } catch (error) {
      console.error("❌ Error fetching active users:", error);
      throw error;
    }
  }

  async setUserActive(telegram_user_id, isActive) {
    try {
      const result = await this.db.query(
        "UPDATE telegram_users SET is_active = $1, updated_at = NOW() WHERE telegram_user_id = $2 RETURNING *",
        [isActive, telegram_user_id]
      );

      if (result.rows.length === 0) {
        throw new Error(`User ${telegram_user_id} not found`);
      }

      console.log(
        `✅ User ${telegram_user_id} set to ${isActive ? "active" : "inactive"}`
      );
      return result.rows[0];
    } catch (error) {
      console.error("❌ Error updating user status:", error);
      throw error;
    }
  }

  async getUserByChatId(chat_id) {
    try {
      const result = await this.db.query(
        "SELECT * FROM telegram_users WHERE chat_id = $1",
        [chat_id]
      );
      return result.rows[0] || null;
    } catch (error) {
      console.error("❌ Error fetching user by chat_id:", error);
      throw error;
    }
  }
}

module.exports = TelegramUsersModel;
