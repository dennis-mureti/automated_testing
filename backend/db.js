const sqlite3 = require("sqlite3").verbose();
const path = require("path");

// Create a persistent database file in the backend directory
const dbPath = path.join(__dirname, "database.sqlite");

// Initialize database connection
let database;

const initializeDatabase = () => {
  return new Promise((resolve, reject) => {
    database = new sqlite3.Database(dbPath, (err) => {
      if (err) {
        console.error("Error connecting to database:", err);
        reject(err);
        return;
      }
      console.log("Connected to database successfully");

      // Create todos table if it doesn't exist
      database.serialize(() => {
        database.run(
          "CREATE TABLE IF NOT EXISTS todos (id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT NOT NULL, completed BOOLEAN DEFAULT 0)",
          (err) => {
            if (err) {
              console.error("Error creating table:", err);
              reject(err);
              return;
            }
            console.log("Todos table created successfully");

            // Add initial data if table is empty
            database.get(
              "SELECT COUNT(*) as count FROM todos",
              [],
              (err, row) => {
                if (err) {
                  console.error("Error checking table:", err);
                  reject(err);
                  return;
                }

                if (row.count === 0) {
                  database.run(
                    "INSERT INTO todos (title, completed) VALUES ('Learn testing', 0)",
                    (err) => {
                      if (err) {
                        console.error("Error inserting initial data:", err);
                        reject(err);
                        return;
                      }
                      console.log("Initial data inserted successfully");
                      resolve(database);
                    }
                  );
                } else {
                  resolve(database);
                }
              }
            );
          }
        );
      });
    });
  });
};

// Export the database connection and initialization function
module.exports = {
  initialize: initializeDatabase,
  getDb: () => database,
};
