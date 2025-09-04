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
    isVotingActive BOOLEAN DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // Check if isVotingActive column exists, if not add it (for existing databases)
  db.all("PRAGMA table_info(votes)", (err, columns) => {
    if (err) {
      console.error("Error getting table columns:", err);
    } else {
      const hasIsVotingActive = columns.some(
        (col) => col.name === "isVotingActive"
      );
      if (!hasIsVotingActive) {
        console.log("Adding isVotingActive column to existing table...");
        db.run(
          "ALTER TABLE votes ADD COLUMN isVotingActive BOOLEAN DEFAULT 1",
          (err) => {
            if (err) {
              console.error("Error adding isVotingActive column:", err);
            } else {
              console.log("isVotingActive column added successfully");
              // Update existing records to have isVotingActive = 1
              db.run(
                "UPDATE votes SET isVotingActive = 1 WHERE isVotingActive IS NULL",
                (err) => {
                  if (err) {
                    console.error("Error updating existing records:", err);
                  } else {
                    console.log(
                      "Existing records updated with isVotingActive = 1"
                    );
                  }
                }
              );
            }
          }
        );
      }
    }
  });

  // Insert initial vote record if table is empty
  db.get("SELECT COUNT(*) as count FROM votes", (err, row) => {
    if (err) {
      console.error("Error checking votes:", err);
    } else if (row.count === 0) {
      db.run(
        "INSERT INTO votes (upvotes, downvotes, isVotingActive) VALUES (0, 0, 1)",
        (err) => {
          if (err) {
            console.error("Error inserting initial votes:", err);
          } else {
            console.log("Initial vote record inserted");
          }
        }
      );
    }
  });
});

// Routes

// Get current vote counts
app.get("/get-vote", (req, res) => {
  db.get(
    "SELECT upvotes, downvotes, isVotingActive FROM votes ORDER BY updated_at DESC LIMIT 1",
    (err, row) => {
      if (err) {
        console.error("Error fetching votes:", err);
        res.status(500).json({ error: "Failed to fetch votes" });
      } else {
        res.json({
          upvotes: row ? row.upvotes : 0,
          downvotes: row ? row.downvotes : 0,
          isVotingActive: row ? Boolean(row.isVotingActive) : true,
        });
      }
    }
  );
});

// Upvote
app.post("/upvote", (req, res) => {
  // First check if voting is active
  db.get("SELECT isVotingActive FROM votes WHERE id = 1", (err, row) => {
    if (err) {
      console.error("Error checking voting status:", err);
      res.status(500).json({ error: "Failed to check voting status" });
      return;
    }

    if (!row || !row.isVotingActive) {
      res.status(403).json({ error: "Voting is currently disabled" });
      return;
    }

    // Proceed with upvote
    db.run(
      "UPDATE votes SET upvotes = upvotes + 1, updated_at = CURRENT_TIMESTAMP WHERE id = 1",
      function (err) {
        if (err) {
          console.error("Error upvoting:", err);
          res.status(500).json({ error: "Failed to upvote" });
        } else {
          // Get updated counts
          db.get(
            "SELECT upvotes, downvotes, isVotingActive FROM votes WHERE id = 1",
            (err, row) => {
              if (err) {
                console.error("Error fetching updated votes:", err);
                res
                  .status(500)
                  .json({ error: "Failed to fetch updated votes" });
              } else {
                res.json({
                  success: true,
                  upvotes: row.upvotes,
                  downvotes: row.downvotes,
                  isVotingActive: Boolean(row.isVotingActive),
                });
              }
            }
          );
        }
      }
    );
  });
});

// Downvote
app.post("/downvote", (req, res) => {
  // First check if voting is active
  db.get("SELECT isVotingActive FROM votes WHERE id = 1", (err, row) => {
    if (err) {
      console.error("Error checking voting status:", err);
      res.status(500).json({ error: "Failed to check voting status" });
      return;
    }

    if (!row || !row.isVotingActive) {
      res.status(403).json({ error: "Voting is currently disabled" });
      return;
    }

    // Proceed with downvote
    db.run(
      "UPDATE votes SET downvotes = downvotes + 1, updated_at = CURRENT_TIMESTAMP WHERE id = 1",
      function (err) {
        if (err) {
          console.error("Error downvoting:", err);
          res.status(500).json({ error: "Failed to downvote" });
        } else {
          // Get updated counts
          db.get(
            "SELECT upvotes, downvotes, isVotingActive FROM votes WHERE id = 1",
            (err, row) => {
              if (err) {
                console.error("Error fetching updated votes:", err);
                res
                  .status(500)
                  .json({ error: "Failed to fetch updated votes" });
              } else {
                res.json({
                  success: true,
                  upvotes: row.upvotes,
                  downvotes: row.downvotes,
                  isVotingActive: Boolean(row.isVotingActive),
                });
              }
            }
          );
        }
      }
    );
  });
});

// Reset votes
app.post("/reset", (req, res) => {
  db.run(
    "UPDATE votes SET upvotes = 0, downvotes = 0, updated_at = CURRENT_TIMESTAMP WHERE id = 1",
    function (err) {
      if (err) {
        console.error("Error resetting votes:", err);
        res.status(500).json({ error: "Failed to reset votes" });
      } else {
        res.json({
          success: true,
          upvotes: 0,
          downvotes: 0,
        });
      }
    }
  );
});

// Toggle voting active status
app.post("/toggle-voting", (req, res) => {
  const { isVotingActive } = req.body;

  if (typeof isVotingActive !== "boolean") {
    return res
      .status(400)
      .json({ error: "isVotingActive must be a boolean value" });
  }

  db.run(
    "UPDATE votes SET isVotingActive = ?, updated_at = CURRENT_TIMESTAMP WHERE id = 1",
    [isVotingActive ? 1 : 0],
    function (err) {
      if (err) {
        console.error("Error toggling voting status:", err);
        res.status(500).json({ error: "Failed to toggle voting status" });
      } else {
        res.json({
          success: true,
          isVotingActive: isVotingActive,
        });
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
