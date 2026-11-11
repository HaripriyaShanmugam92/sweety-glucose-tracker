require("dotenv").config();

const pool = require("../db");
const bcrypt = require("bcrypt");

async function seedDatabase() {
  try {
    // Create demo user
    const passwordHash = await bcrypt.hash("SweetyDemo@123", 10);

    await pool.query(
      `INSERT INTO users (name, email, password)
       VALUES ($1, $2, $3)
       ON CONFLICT (email) DO NOTHING`,
      ["Demo User", "demo@sweety.com", passwordHash],
    );

    // Get demo user's ID
    const userResult = await pool.query(
      "SELECT id FROM users WHERE email = $1",
      ["demo@sweety.com"],
    );

    const userId = userResult.rows[0].id;

    // Sample glucose readings
    const readings = [
      ["2026-11-10", "Morning fasting", 95],
      ["2026-11-10", "After breakfast", 135],
      ["2026-11-10", "After lunch", 145],
      ["2026-11-10", "After dinner", 125],

      ["2026-10-15", "Morning fasting", 90],
      ["2026-10-15", "After breakfast", 130],
      ["2026-10-15", "After lunch", 150],
      ["2026-10-15", "After dinner", 120],
    ];

    for (const reading of readings) {
      await pool.query(
        `INSERT INTO readings
         (user_id, reading_date, time_slot, glucose_value)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (user_id, reading_date, time_slot) DO NOTHING`,
        [userId, ...reading],
      );
    }

    console.log("Demo user and sample readings created successfully!");
    console.log("Email: demo@sweety.com");
    console.log("Password: SweetyDemo@123");
  } catch (error) {
    console.error("Seed error:", error);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

seedDatabase();
