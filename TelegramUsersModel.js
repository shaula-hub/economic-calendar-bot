class TelegramUsersModel {
  constructor(database) {
    this.db = database;
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
      is_active = true,
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
