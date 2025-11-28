require("dotenv").config();

const express = require("express");
const cors = require("cors");
const { Pool } = require("pg");
const jwt = require("jsonwebtoken");
const { OAuth2Client } = require("google-auth-library");

const app = express();

// ---------- Middleware ----------
app.use(express.json());
app.use(
  cors({
    origin: [
      "http://localhost:5173",
      "https://employee-timetracker.netlify.app",   // your real Netlify site
    ],
    credentials: true,
  })
);

// ---------- Database ----------
const connectionString =
  process.env.SUPABASE_DB_URL ||
  process.env.DATABASE_URL ||
  process.env.POSTGRES_URL;

if (!connectionString) {
  console.error("❌ No Postgres connection string found.");
  process.exit(1);
}

const pool = new Pool({
  connectionString,
  ssl: { rejectUnauthorized: false },
});

// ---------- Google + JWT ----------
const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID || "");

function createAppToken(user) {
  return jwt.sign(
    {
      user_id: user.id,
      email: user.email,
      role: user.role,
      team_id: user.team_id,
    },
    process.env.JWT_SECRET || "dev_secret",
    { expiresIn: process.env.JWT_EXPIRES_IN || "8h" }
  );
}

function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization || "";
  const parts = authHeader.split(" ");
  if (parts.length !== 2 || parts[0] !== "Bearer") {
    return res.status(401).json({ error: "Missing or invalid Authorization header" });
  }
  try {
    req.user = jwt.verify(parts[1], process.env.JWT_SECRET || "dev_secret");
    next();
  } catch (err) {
    console.error("JWT verify error:", err);
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}

// ---------- Helpers ----------
async function isMonthLocked(teamId, workDate) {
  if (!teamId || !workDate) return false;
  const d = new Date(workDate);
  const year = d.getUTCFullYear();
  const month = d.getUTCMonth() + 1;
  const q = `
    SELECT 1
    FROM month_locks
    WHERE team_id = $1 AND year = $2 AND month = $3
    LIMIT 1
  `;
  const result = await pool.query(q, [teamId, year, month]);
  return result.rows.length > 0;
}

// ---------- Health ----------
app.get("/api/health", async (req, res) => {
  try {
    await pool.query("SELECT 1");
    return res.json({ status: "ok" });
  } catch (err) {
    console.error("Healthcheck DB error:", err);
    return res.status(500).json({ error: "DB not reachable" });
  }
});

// ---------- Public teams (no auth) ----------
app.get("/api/public/teams", async (req, res) => {
  try {
    const result = await pool.query("SELECT id, name FROM teams ORDER BY name");
    return res.json(result.rows);
  } catch (err) {
    console.error("Error fetching public teams:", err);
    return res.status(500).json({ error: "Failed to load teams" });
  }
});

// ---------- Authenticated teams (keeps for compatibility) ----------
app.get("/api/teams", authMiddleware, async (req, res) => {
  try {
    const result = await pool.query("SELECT id, name FROM teams ORDER BY name");
    return res.json(result.rows);
  } catch (err) {
    console.error("Error fetching teams:", err);
    return res.status(500).json({ error: "Failed to load teams" });
  }
});

// ---------- Google Login (Option A: team optional) ----------
app.post("/api/auth/google", async (req, res) => {
  const { idToken, team_id } = req.body;

  if (!idToken) return res.status(400).json({ error: "Missing idToken" });

  try {
    const ticket = await googleClient.verifyIdToken({
      idToken,
      audience: process.env.GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();
    const googleId = payload.sub;
    const email = payload.email;
    const fullName = payload.name || email;
    const avatar = payload.picture || null;

    if (!email) return res.status(400).json({ error: "Google account missing email" });

    // find existing user by email
    const existing = await pool.query("SELECT * FROM users WHERE email = $1", [email]);
    let user;

    if (existing.rows.length > 0) {
      user = existing.rows[0];

      // If user exists but doesn't have a team yet, and frontend provided one => set it
      if (!user.team_id && team_id) {
        const upd = await pool.query("UPDATE users SET team_id=$1 WHERE id=$2 RETURNING *", [team_id, user.id]);
        user = upd.rows[0];
      }
    } else {
      // New user: create user. Option A does NOT require team_id — create with NULL team
      const insert = await pool.query(
        `INSERT INTO users (full_name, email, role, team_id, google_id, avatar_url, password_hash)
         VALUES ($1, $2, 'employee', $3, $4, $5, 'GOOGLE')
         RETURNING *`,
        [fullName, email, team_id || null, googleId, avatar]
      );
      user = insert.rows[0];
    }

    const token = createAppToken(user);

    return res.json({
      token,
      user: {
        id: user.id,
        full_name: user.full_name,
        email: user.email,
        role: user.role,
        team_id: user.team_id,
        avatar_url: user.avatar_url,
      },
    });
  } catch (err) {
    console.error("Google auth error:", err);
    return res.status(500).json({ error: "Failed to verify Google token" });
  }
});

// ---------- Set team (authenticated) ----------
app.post("/api/users/set-team", authMiddleware, async (req, res) => {
  const { user_id, team_id } = req.body;
  if (!user_id || !team_id) return res.status(400).json({ error: "user_id and team_id required" });

  try {
    const result = await pool.query("UPDATE users SET team_id=$1 WHERE id=$2 RETURNING *", [team_id, user_id]);
    return res.json({ user: result.rows[0] });
  } catch (err) {
    console.error("Set team error:", err);
    return res.status(500).json({ error: "Failed to set team" });
  }
});

// ---------- Tasks ----------
app.get("/api/tasks", authMiddleware, async (req, res) => {
  const { team_id } = req.query;
  if (!team_id) return res.status(400).json({ error: "team_id required" });

  try {
    const result = await pool.query("SELECT id, team_id, name FROM task_templates WHERE team_id=$1 ORDER BY name", [team_id]);
    return res.json(result.rows);
  } catch (err) {
    console.error("Error fetching tasks:", err);
    return res.status(500).json({ error: "Failed to load tasks" });
  }
});

// ---------- Start timer ----------
app.post("/api/time-logs/start", authMiddleware, async (req, res) => {
  const { task_template_id, work_location } = req.body;
  const userId = req.user.user_id;

  if (!task_template_id) return res.status(400).json({ error: "task_template_id required" });

  try {
    const taskRes = await pool.query("SELECT id, team_id FROM task_templates WHERE id=$1", [task_template_id]);
    if (taskRes.rows.length === 0) return res.status(400).json({ error: "Task not found" });

    const task = taskRes.rows[0];

    const open = await pool.query("SELECT 1 FROM time_logs WHERE user_id=$1 AND ended_at IS NULL LIMIT 1", [userId]);
    if (open.rows.length > 0) return res.status(400).json({ error: "You already have an active timer." });

    // Validate work_location
    const validLocations = ['office', 'wfh', 'unknown'];
    const location = validLocations.includes(work_location) ? work_location : 'unknown';

    const insert = await pool.query(
      `INSERT INTO time_logs (user_id, team_id, task_template_id, work_date, started_at, work_location)
       VALUES ($1, $2, $3, CURRENT_DATE, NOW(), $4)
       RETURNING *`,
      [userId, task.team_id, task_template_id, location]
    );

    return res.json({ message: "Timer started", log: insert.rows[0] });
  } catch (err) {
    console.error("Start timer error:", err);
    return res.status(500).json({ error: "Failed to start timer" });
  }
});

// ---------- Stop timer ----------
app.post("/api/time-logs/stop", authMiddleware, async (req, res) => {
  const { time_log_id, volume, idle_seconds } = req.body;
  const userId = req.user.user_id;

  if (!time_log_id) return res.status(400).json({ error: "time_log_id required" });

  try {
    const logRes = await pool.query("SELECT * FROM time_logs WHERE id=$1 AND user_id=$2 LIMIT 1", [time_log_id, userId]);
    if (logRes.rows.length === 0) return res.status(404).json({ error: "Log not found" });

    const log = logRes.rows[0];

    if (log.ended_at) return res.status(400).json({ error: "Timer already stopped" });

    // Check month lock
    const locked = await isMonthLocked(log.team_id, log.work_date);
    if (locked) return res.status(403).json({ error: "Month is locked. Cannot stop timer." });

    // compute endedAt server-side
    const nowRes = await pool.query("SELECT NOW() AS now");
    const endedAt = nowRes.rows[0].now;

    // compute seconds safely; protect against malformed started_at
    if (!log.started_at) {
      console.error("Invalid started_at for log:", log.id, log.started_at);
      return res.status(500).json({ error: "Invalid start time stored for this log" });
    }

    const diffRes = await pool.query("SELECT EXTRACT(EPOCH FROM ($1::timestamptz - $2::timestamptz)) AS seconds", [endedAt, log.started_at]);
    let durationSeconds = Math.max(0, Math.round(diffRes.rows[0].seconds || 0));

    let idle = Number(idle_seconds) || 0;
    if (idle < 0) idle = 0;
    if (idle > durationSeconds) idle = durationSeconds;

    const productive = durationSeconds - idle;
    const vol = Number(volume) || 0;

    const update = await pool.query(
      `UPDATE time_logs
       SET ended_at=$1, duration_seconds=$2, idle_seconds=$3, productive_seconds=$4, volume=$5
       WHERE id=$6
       RETURNING *`,
      [endedAt, durationSeconds, idle, productive, vol, time_log_id]
    );

    return res.json({ message: "Timer stopped", log: update.rows[0] });
  } catch (err) {
    console.error("Stop timer error:", err);
    return res.status(500).json({ error: "Failed to stop timer" });
  }
});

// ---------- Recent logs ----------
app.get("/api/time-logs/recent", authMiddleware, async (req, res) => {
  const days = Number(req.query.days || 3);
  const user = req.user;

  try {
    const params = [days];
    const where = ["tl.work_date >= CURRENT_DATE - $1::int"];

    if (user.role === "manager") {
      params.push(user.team_id);
      where.push("tl.team_id = $2");
    } else {
      params.push(user.user_id);
      where.push("tl.user_id = $2");
    }

    const result = await pool.query(
      `SELECT tl.*, json_build_object('id', tt.id, 'name', tt.name) AS task_templates
       FROM time_logs tl
       LEFT JOIN task_templates tt ON tl.task_template_id = tt.id
       WHERE ${where.join(" AND ")}
       ORDER BY tl.work_date DESC, tl.started_at DESC`,
      params
    );

    return res.json(result.rows);
  } catch (err) {
    console.error("Error fetching recent logs:", err);
    return res.status(500).json({ error: "Failed to load logs" });
  }
});

// ---------- Edit / Delete / Export / Month locks (unchanged, but with logging) ----------
// For brevity — keep your existing code for these routes, but ensure you have consistent logging.
// I've kept the implementations you already had — if you'd like I can paste them here verbatim as well.

// ---------- Update a time log ----------
app.patch("/api/time-logs/:id", authMiddleware, async (req, res) => {
  const logId = req.params.id;
  const { work_date, task_template_id, volume } = req.body;
  const userId = req.user.user_id;

  if (!work_date || !task_template_id) {
    return res.status(400).json({ error: "work_date and task_template_id required" });
  }

  try {
    // Check log exists + belongs to user
    const existing = await pool.query(
      "SELECT * FROM time_logs WHERE id=$1 AND user_id=$2 LIMIT 1",
      [logId, userId]
    );
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: "Log not found" });
    }

    const log = existing.rows[0];

    // Check month lock
    const locked = await isMonthLocked(log.team_id, log.work_date);
    if (locked) {
      return res.status(403).json({ error: "Month is locked. Cannot edit log." });
    }

    // Apply update
    const update = await pool.query(
      `UPDATE time_logs
       SET work_date=$1,
           task_template_id=$2,
           volume=$3
       WHERE id=$4
       RETURNING *`,
      [work_date, task_template_id, volume || 0, logId]
    );

    return res.json({ message: "Log updated", log: update.rows[0] });
  } catch (err) {
    console.error("Edit log error:", err);
    return res.status(500).json({ error: "Failed to update log" });
  }
});


// ---------- Delete a time log ----------
app.delete("/api/time-logs/:id", authMiddleware, async (req, res) => {
  const logId = req.params.id;
  const userId = req.user.user_id;

  try {
    const existing = await pool.query(
      "SELECT * FROM time_logs WHERE id=$1 AND user_id=$2 LIMIT 1",
      [logId, userId]
    );
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: "Log not found" });
    }

    const log = existing.rows[0];

    // Check month lock
    const locked = await isMonthLocked(log.team_id, log.work_date);
    if (locked) {
      return res.status(403).json({ error: "Month is locked. Cannot delete log." });
    }

    await pool.query("DELETE FROM time_logs WHERE id=$1", [logId]);
    return res.json({ message: "Log deleted" });
  } catch (err) {
    console.error("Delete log error:", err);
    return res.status(500).json({ error: "Failed to delete log" });
  }
});


// ---------- CSV Export ----------
app.get("/api/time-logs/export", authMiddleware, async (req, res) => {
  const { from, to } = req.query;
  const user = req.user;

  if (!from || !to) {
    return res.status(400).json({ error: "from and to required" });
  }

  try {
    const params = [from, to];
    let userFilter = "";

    if (user.role === "manager") {
      params.push(user.team_id);
      userFilter = "AND tl.team_id = $3";
    } else {
      params.push(user.user_id);
      userFilter = "AND tl.user_id = $3";
    }

    const result = await pool.query(
      `SELECT tl.*, tt.name AS task_name
       FROM time_logs tl
       LEFT JOIN task_templates tt ON tl.task_template_id = tt.id
       WHERE tl.work_date BETWEEN $1 AND $2
       ${userFilter}
       ORDER BY tl.work_date, tl.started_at`,
      params
    );

    let csv = "date,start,end,duration,idle,productive,volume,task,location\n";
    for (const row of result.rows) {
      const start = row.started_at ? new Date(row.started_at).toISOString() : "";
      const end = row.ended_at ? new Date(row.ended_at).toISOString() : "";
      const location = row.work_location || "unknown";
      csv += `${row.work_date},${start},${end},${row.duration_seconds},${row.idle_seconds},${row.productive_seconds},${row.volume},${row.task_name},${location}\n`;
    }

    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", "attachment; filename=time-logs.csv");
    return res.send(csv);
  } catch (err) {
    console.error("CSV export error:", err);
    return res.status(500).json({ error: "Failed to export CSV" });
  }
});

// ---------- Month lock status ----------
app.get("/api/month-locks/status", authMiddleware, async (req, res) => {
  const { team_id, year, month } = req.query;
  if (!team_id || !year || !month) return res.status(400).json({ error: "team_id, year, month required" });
  try {
    const result = await pool.query("SELECT 1 FROM month_locks WHERE team_id=$1 AND year=$2 AND month=$3 LIMIT 1", [team_id, year, month]);
    return res.json({ locked: result.rows.length > 0 });
  } catch (err) {
    console.error("Error checking month lock:", err);
    return res.status(500).json({ error: "Failed to check month lock" });
  }
});

app.post("/api/month-locks/lock", authMiddleware, async (req, res) => {
  const { team_id, year, month } = req.body;
  if (req.user.role !== "manager") return res.status(403).json({ error: "Only managers can lock months" });
  try {
    await pool.query("INSERT INTO month_locks (team_id, year, month) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING", [team_id, year, month]);
    return res.json({ locked: true });
  } catch (err) {
    console.error("Error locking month:", err);
    return res.status(500).json({ error: "Failed to lock month" });
  }
});

app.post("/api/month-locks/unlock", authMiddleware, async (req, res) => {
  const { team_id, year, month } = req.body;
  if (req.user.role !== "manager") return res.status(403).json({ error: "Only managers can unlock" });
  try {
    await pool.query("DELETE FROM month_locks WHERE team_id=$1 AND year=$2 AND month=$3", [team_id, year, month]);
    return res.json({ locked: false });
  } catch (err) {
    console.error("Error unlocking month:", err);
    return res.status(500).json({ error: "Failed to unlock month" });
  }
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`Backend running on port ${PORT}`));
