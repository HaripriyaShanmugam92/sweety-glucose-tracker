// readings.js

const express = require("express");
const pool = require("../db");
const auth = require("../middleware/auth");

const router = express.Router();

const allowedTimeSlots = [
  "Morning fasting",
  "After breakfast",
  "After lunch",
  "After dinner",
];

// Add a glucose reading
router.post("/", auth, async (req, res) => {
  const { reading_date, time_slot, glucose_value } = req.body;

  if (
    glucose_value === undefined ||
    glucose_value === null ||
    glucose_value === ""
  ) {
    return res.status(400).json({
      message: "Please enter a glucose value.",
    });
  }

  if (
    !Number.isInteger(Number(glucose_value)) ||
    Number(glucose_value) < 40 ||
    Number(glucose_value) > 600
  ) {
    return res.status(400).json({
      message: "Value must be between 40 and 600 mg/dl.",
    });
  }

  if (!allowedTimeSlots.includes(time_slot)) {
    return res.status(400).json({
      message: "Invalid time slot.",
    });
  }

  try {
    const date = await pool.query(
      "SELECT $1::date > CURRENT_DATE AS is_future",
      [reading_date],
    );

    if (date.rows[0].is_future) {
      return res.status(400).json({
        message: "Date cannot be in the future.",
      });
    }

    const result = await pool.query(
      `SELECT 
            COUNT(*) AS total_readings,
            COUNT(*) FILTER (WHERE time_slot = $3) AS duplicate_slot 
        FROM readings WHERE user_id = $1 
        AND reading_date = $2;`,
      [req.user.id, reading_date, time_slot],
    );

    if (Number(result.rows[0].duplicate_slot) > 0) {
      return res.status(400).json({
        message: `You already have an ${time_slot} reading for this date.`,
      });
    }

    if (Number(result.rows[0].total_readings) >= 4) {
      return res.status(400).json({
        message: "You can add only 4 readings per day.",
      });
    }

    const reading = await pool.query(
      `INSERT INTO readings
        (user_id, reading_date, time_slot, glucose_value)
        VALUES ($1, $2, $3, $4)
        RETURNING *`,
      [req.user.id, reading_date, time_slot, glucose_value],
    );

    return res.status(201).json({
      message: "Glucose reading added successfully",
      reading: reading.rows[0],
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      message: "Failed to add glucose reading",
    });
  }
});

// View glucose readings
router.get("/", auth, async (req, res) => {});

// Edit a glucose reading
router.put("/:id", auth, async (req, res) => {});

// Delete a glucose reading
router.delete("/:id", auth, async (req, res) => {});

module.exports = router;
