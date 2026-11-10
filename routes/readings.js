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

// Common reading validation
async function validateReading({
  reading_date,
  time_slot,
  glucose_value,
  partial = false,
}) {
  const errors = {};
  const validFields = {};

  if (!partial || glucose_value !== undefined) {
    if (
      glucose_value === undefined ||
      glucose_value === null ||
      glucose_value === ""
    ) {
      errors.glucose_value = "Please enter a glucose value.";
    } else if (
      !Number.isInteger(Number(glucose_value)) ||
      Number(glucose_value) < 40 ||
      Number(glucose_value) > 600
    ) {
      errors.glucose_value = "Value must be between 40 and 600 mg/dl.";
    } else {
      validFields.glucose_value = Number(glucose_value);
    }
  }

  if (!partial || time_slot !== undefined) {
    if (!allowedTimeSlots.includes(time_slot)) {
      errors.time_slot = "Invalid time slot.";
    } else {
      validFields.time_slot = time_slot;
    }
  }

  if (!partial || reading_date !== undefined) {
    try {
      const date = await pool.query(
        "SELECT $1::date > CURRENT_DATE AS is_future",
        [reading_date],
      );

      if (date.rows[0].is_future) {
        errors.reading_date = "Date cannot be in the future.";
      } else {
        validFields.reading_date = reading_date;
      }
    } catch (error) {
      console.error(error);
      errors.reading_date = "Invalid reading date.";
    }
  }

  return {
    validFields,
    errors: Object.keys(errors).length === 0 ? null : errors,
  };
}

function calculateReport(readings) {
  if (readings.length === 0) {
    return {
      highest: null,
      lowest: null,
      average: null,
      count: 0,
    };
  }

  const values = readings.map((reading) => Number(reading.glucose_value));

  const highest = Math.max(...values);
  const lowest = Math.min(...values);

  const average = Number(
    (values.reduce((total, value) => total + value, 0) / values.length).toFixed(
      1,
    ),
  );

  return {
    highest,
    lowest,
    average,
    count: readings.length,
  };
}

function isValidDate(date) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return false;
  }

  const parsedDate = new Date(`${date}T00:00:00.000Z`);

  return (
    !Number.isNaN(parsedDate.getTime()) &&
    parsedDate.toISOString().slice(0, 10) === date
  );
}

// Add a glucose reading
router.post("/", auth, async (req, res) => {
  const { reading_date, time_slot, glucose_value } = req.body;

  const { validFields, errors } = await validateReading({
    reading_date,
    time_slot,
    glucose_value,
  });

  if (errors) {
    return res.status(400).json({ errors });
  }

  try {
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
router.get("/", auth, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, reading_date, time_slot, glucose_value, created_at
       FROM readings
       WHERE user_id = $1
       ORDER BY reading_date DESC, created_at DESC`,
      [req.user.id],
    );

    return res.status(200).json({
      message: "Glucose readings retrieved successfully",
      readings: result.rows,
    });
  } catch (error) {
    console.error("Error retrieving readings:", error.message);

    return res.status(500).json({
      message: "Internal server error",
    });
  }
});

// Edit a glucose reading
router.put("/:id", auth, async (req, res) => {
  const { reading_date, time_slot, glucose_value } = req.body;
  const reading_id = req.params.id;
  const user_id = req.user.id;

  try {
    const { validFields, errors } = await validateReading({
      reading_date,
      time_slot,
      glucose_value,
      partial: true,
    });

    if (Object.keys(validFields).length === 0) {
      return res.status(400).json({
        message: "No valid fields to update.",
        errors,
      });
    }

    const updates = [];
    const values = [user_id, reading_id];

    for (const [field, value] of Object.entries(validFields)) {
      values.push(value);
      updates.push(`${field} = $${values.length}`);
    }

    const result = await pool.query(
      `UPDATE readings
       SET ${updates.join(", ")}
       WHERE user_id = $1 AND id = $2
       RETURNING id, reading_date, time_slot, glucose_value, created_at`,
      values,
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        message: "Glucose reading not found",
      });
    }

    return res.status(200).json({
      message: errors
        ? "Glucose reading partially updated"
        : "Glucose reading updated successfully",
      reading: result.rows[0],
      errors,
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      message: "Failed to update glucose reading",
    });
  }
});

// Delete a glucose reading
router.delete("/:id", auth, async (req, res) => {
  const reading_id = req.params.id;
  const user_id = req.user.id;

  try {
    const result = await pool.query(
      `DELETE FROM readings
       WHERE user_id = $1 AND id = $2
       RETURNING id`,
      [user_id, reading_id],
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        message: "Glucose reading not found",
      });
    }

    return res.status(200).json({
      message: "Glucose reading deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting reading:", error.message);

    return res.status(500).json({
      message: "Failed to delete glucose reading",
    });
  }
});

// Get daily report
router.get("/report/daily", auth, async (req, res) => {
  try {
    const { date } = req.query;

    if (!date || !isValidDate(date)) {
      return res.status(400).json({
        message: "Please provide a valid date in YYYY-MM-DD format.",
      });
    }

    const user_id = req.user.id;

    const result = await pool.query(
      `SELECT id, reading_date, time_slot, glucose_value, created_at
       FROM readings
       WHERE user_id = $1
       AND reading_date = $2
       ORDER BY created_at ASC`,
      [user_id, date],
    );

    const readings = result.rows;
    const report = calculateReport(readings);

    return res.status(200).json({
      date,
      report,
      readings,
    });
  } catch (error) {
    console.error("Daily report error:", error);

    return res.status(500).json({
      message: "Failed to generate daily report.",
    });
  }
});

// Get month-to-date report
router.get("/report/month-to-date", auth, async (req, res) => {
  try {
    const { date } = req.query;

    if (!date || !isValidDate(date)) {
      return res.status(400).json({
        message: "Please provide a valid date in YYYY-MM-DD format.",
      });
    }

    const user_id = req.user.id;

    const result = await pool.query(
      `SELECT id, reading_date, time_slot, glucose_value, created_at
       FROM readings
       WHERE user_id = $1
       AND reading_date >= DATE_TRUNC('month', $2::date)::date
       AND reading_date <= $2::date
       ORDER BY reading_date DESC, created_at ASC`,
      [user_id, date],
    );

    const readings = result.rows;
    const report = calculateReport(readings);

    return res.status(200).json({
      start_date: `${date.slice(0, 7)}-01`,
      end_date: date,
      report,
      readings,
    });
  } catch (error) {
    console.error("Month-to-date report error:", error);

    return res.status(500).json({
      message: "Failed to generate month-to-date report.",
    });
  }
});

// Get previous month report
router.get("/report/monthly", auth, async (req, res) => {
  try {
    const user_id = req.user.id;

    const result = await pool.query(
      `SELECT id, reading_date, time_slot, glucose_value, created_at
       FROM readings
       WHERE user_id = $1
       AND reading_date >= (
         DATE_TRUNC('month', CURRENT_DATE) - INTERVAL '1 month'
       )::date
       AND reading_date < DATE_TRUNC('month', CURRENT_DATE)::date
       ORDER BY reading_date DESC, created_at ASC`,
      [user_id],
    );

    const readings = result.rows;
    const report = calculateReport(readings);

    return res.status(200).json({
      report,
      readings,
    });
  } catch (error) {
    console.error("Monthly report error:", error);

    return res.status(500).json({
      message: "Failed to generate monthly report.",
    });
  }
});

module.exports = router;
