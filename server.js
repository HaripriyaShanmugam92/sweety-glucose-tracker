// server.js

const express = require("express");
const pool = require("./db");
const authRoutes = require("./routes/auth");
const readingRoutes = require("./routes/readings");

const app = express();

const PORT = 3000;

app.use(express.json());

app.use("/api/auth", authRoutes);

app.use("/api/readings", readingRoutes);

app.get("/", (req, res) => {
  res.send("Sweety Glucose Tracker API is running!");
});

app.post("/test", (req, res) => {
  const data = req.body;

  res.json({
    message: "Data received successfully",
    receivedData: data,
  });
});

app.get("/db-test", async (req, res) => {
  try {
    const result = await pool.query("SELECT NOW()");

    res.json({
      message: "PostgreSQL connected successfully!",
      time: result.rows[0].now,
    });
  } catch (error) {
    console.error(error.message);

    res.status(500).json({
      message: "Database connection failed",
    });
  }
});

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

module.exports = app;
