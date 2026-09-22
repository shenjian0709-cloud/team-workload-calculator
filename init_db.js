const { openDatabase } = require("./lib/database");
openDatabase(process.env.DB_PATH || "./data/team.db")
  .then(async (db) => {
    await db.close();
    console.log("Database ready (schema v2). Existing data preserved.");
  })
  .catch((e) => {
    console.error(e.message);
    process.exitCode = 1;
  });
