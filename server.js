const express = require("express");
const cors = require("cors");
const sqlite3 = require("sqlite3").verbose();
const path = require("path");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Database setup
const dbPath =
  process.env.DATABASE_URL || path.join(__dirname, "database.sqlite");
const db = new sqlite3.Database(dbPath);

// Initialize database
db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS votes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    upvotes INTEGER DEFAULT 0,
    downvotes INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // Insert initial vote record if table is empty
  db.get("SELECT COUNT(*) as count FROM votes", (err, row) => {
    if (err) {
      console.error("Error checking votes:", err);
    } else if (row.count === 0) {
      db.run("INSERT INTO votes (upvotes, downvotes) VALUES (0, 0)", (err) => {
        if (err) {
          console.error("Error inserting initial votes:", err);
        } else {
          console.log("Initial vote record inserted");
        }
      });
    }
  });
});

// Routes

// Get current vote counts
app.get("/get-vote", (req, res) => {
  db.get(
    "SELECT upvotes, downvotes FROM votes ORDER BY updated_at DESC LIMIT 1",
    (err, row) => {
      if (err) {
        console.error("Error fetching votes:", err);
        res.status(500).json({ error: "Failed to fetch votes" });
      } else {
        res.json({
          upvotes: row ? row.upvotes : 0,
          downvotes: row ? row.downvotes : 0,
        });
      }
    }
  );
});

// Upvote
app.post("/upvote", (req, res) => {
  db.run(
    "UPDATE votes SET upvotes = upvotes + 1, updated_at = CURRENT_TIMESTAMP WHERE id = 1",
    function (err) {
      if (err) {
        console.error("Error upvoting:", err);
        res.status(500).json({ error: "Failed to upvote" });
      } else {
        // Get updated counts
        db.get(
          "SELECT upvotes, downvotes FROM votes WHERE id = 1",
          (err, row) => {
            if (err) {
              console.error("Error fetching updated votes:", err);
              res.status(500).json({ error: "Failed to fetch updated votes" });
            } else {
              res.json({
                success: true,
                upvotes: row.upvotes,
                downvotes: row.downvotes,
              });
            }
          }
        );
      }
    }
  );
});

// Downvote
app.post("/downvote", (req, res) => {
  db.run(
    "UPDATE votes SET downvotes = downvotes + 1, updated_at = CURRENT_TIMESTAMP WHERE id = 1",
    function (err) {
      if (err) {
        console.error("Error downvoting:", err);
        res.status(500).json({ error: "Failed to downvote" });
      } else {
        // Get updated counts
        db.get(
          "SELECT upvotes, downvotes FROM votes WHERE id = 1",
          (err, row) => {
            if (err) {
              console.error("Error fetching updated votes:", err);
              res.status(500).json({ error: "Failed to fetch updated votes" });
            } else {
              res.json({
                success: true,
                upvotes: row.upvotes,
                downvotes: row.downvotes,
              });
            }
          }
        );
      }
    }
  );
});

// Health check
app.get("/health", (req, res) => {
  res.json({ status: "OK", timestamp: new Date().toISOString() });
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Database: ${dbPath}`);
});

// Graceful shutdown
process.on("SIGINT", () => {
  console.log("Shutting down server...");
  db.close((err) => {
    if (err) {
      console.error("Error closing database:", err);
    } else {
      console.log("Database connection closed");
    }
    process.exit(0);
  });
});
