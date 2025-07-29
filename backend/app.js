const express = require("express");
const sqlite3 = require("sqlite3").verbose();
const cors = require("cors");
const { initialize, getDb } = require("./db.js");
const app = express();
const PORT = 3001;

// Initialize database before starting server
initialize()
  .then(() => {
    console.log("Database initialized successfully");

    // Enable CORS for requests from localhost:3000 with credentials support
    app.use(
      cors({
        origin: "http://localhost:3000",
        methods: ["GET", "POST", "PUT", "DELETE"],
        allowedHeaders: ["Content-Type", "Authorization"],
        credentials: true,
        exposedHeaders: ["Content-Length", "X-Foo", "X-Bar"],
      })
    );

    app.use(express.json());

    // Get the database instance
    const db = getDb();

    // Add error handling middleware
    app.use((err, req, res, next) => {
      console.error("Error:", err);
      res.status(500).json({
        success: false,
      });
    });

    // Fake login endpoint
    app.post("/login", (req, res) => {
      console.log("Login attempt:", req.body);
      try {
        const { username, password } = req.body;
        if (!username || !password) {
          console.error("Missing credentials");
          return res.status(400).json({
            success: false,
            message: "Username and password are required",
          });
        }

        if (username === "testuser" && password === "password") {
          console.log("Login successful for testuser");
          res.json({
            success: true,
            token: "fake-jwt-token",
            message: "Login successful",
          });
        } else {
          console.error("Invalid credentials for:", username);
          res.status(401).json({
            success: false,
            message: "Invalid credentials",
          });
        }
      } catch (error) {
        console.error("Login error:", error);
        res.status(500).json({
          success: false,
          message: "Server error occurred",
        });
      }
    });

    // Todo endpoints
    app.get("/items", (req, res) => {
      db.all("SELECT * FROM todos", [], (err, rows) => {
        if (err) {
          console.error("Database error:", err);
          res.status(500).json({
            error: err.message,
            success: false,
          });
          return;
        }
        res.json({
          success: true,
          data: rows,
        });
      });
    });

    app.post("/items", (req, res) => {
      try {
        const title = req.body.title;

        if (!title) {
          return res.status(400).json({
            success: false,
            message: "Title is required",
          });
        }

        // Insert the new todo
        db.run(
          "INSERT INTO todos (title, completed) VALUES (?, ?)",
          [title, false],
          function (err) {
            if (err) {
              console.error("Error inserting todo:", err);
              if (err.message.includes("UNIQUE constraint failed")) {
                return res.status(400).json({
                  success: false,
                  message: "Todo with this title already exists",
                  error: err.message,
                });
              }
              return res.status(500).json({
                success: false,
                message: "Failed to create todo",
                error: err.message,
              });
            }

            // Return success response
            res.status(201).json({
              success: true,
              message: "Todo created successfully",
              id: this.lastID,
            });
          }
        );
      } catch (error) {
        console.error("Error in POST /items:", error);
        res.status(500).json({
          success: false,
          message: "Internal server error",
          error: error.message,
        });
      }
    });

    app.put("/items/:id", (req, res) => {
      const { title, completed } = req.body;
      if (!title) {
        return res.status(400).json({
          success: false,
          message: "Title is required",
        });
      }

      db.run(
        "UPDATE todos SET title = ?, completed = ? WHERE id = ?",
        [title, completed, req.params.id],
        function (err) {
          if (err) {
            console.error("Database error:", err);
            res.status(500).json({
              error: err.message,
              success: false,
            });
            return;
          }
          res.json({
            success: true,
          });
        }
      );
    });

    app.delete("/items/:id", (req, res) => {
      db.run("DELETE FROM todos WHERE id = ?", [req.params.id], function (err) {
        if (err) {
          console.error("Database error:", err);
          res.status(500).json({
            error: err.message,
            success: false,
          });
          return;
        }
        res.json({
          success: true,
        });
      });
    });

    // Start server
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });

    return db;
  })
  .catch((err) => {
    console.error("Failed to initialize database:", err);
    process.exit(1);
  });
