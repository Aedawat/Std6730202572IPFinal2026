require("dotenv").config();

const express = require("express");
const cors = require("cors");
const { randomUUID } = require("node:crypto");
const mysql = require("mysql2/promise");

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const TABLE = "`Aedawat_Jumpla`";

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

app.use(cors());
app.use(express.json());

const seedEmployees = [
  {
    name: "Ava Johnson",
    position: "HR Manager",
    status: "Active",
    salary: 85000,
  },
  {
    name: "Liam Smith",
    position: "Software Engineer",
    status: "Active",
    salary: 105000,
  },
  {
    name: "Emma Davis",
    position: "Recruiter",
    status: "On Leave",
    salary: 62000,
  },
  {
    name: "Noah Wilson",
    position: "Product Designer",
    status: "Active",
    salary: 78000,
  },
  {
    name: "Olivia Brown",
    position: "Finance Analyst",
    status: "Active",
    salary: 72000,
  },
];

async function initializeDatabase() {
  if (
    !process.env.DB_HOST ||
    !process.env.DB_USER ||
    !process.env.DB_NAME ||
    !process.env.DB_PASSWORD
  ) {
    throw new Error(
      "Database configuration missing. Set DB_HOST, DB_USER, DB_PASSWORD, and DB_NAME in backend/.env."
    );
  }

  await pool.query(`
    CREATE TABLE IF NOT EXISTS ${TABLE} (
      id VARCHAR(36) NOT NULL PRIMARY KEY,
      name VARCHAR(150) NOT NULL,
      position VARCHAR(150) NOT NULL,
      status ENUM('Active', 'On Leave') NOT NULL DEFAULT 'Active',
      salary DECIMAL(12, 2) NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  const [rows] = await pool.query(`SELECT COUNT(*) AS employeeCount FROM ${TABLE}`);
  if (Number(rows[0].employeeCount) === 0) {
    const values = seedEmployees.map((employee) => [
      randomUUID(),
      employee.name,
      employee.position,
      employee.status,
      employee.salary,
    ]);

    await pool.query(
      `INSERT INTO ${TABLE} (id, name, position, status, salary) VALUES ?`,
      [values]
    );
  }
}

function toEmployee(row) {
  return {
    id: row.id,
    name: row.name,
    position: row.position,
    status: row.status,
    salary: Number(row.salary),
  };
}

function validateEmployeeInput(body) {
  const { name, position, salary } = body || {};
  const numericSalary = Number(salary);

  if (
    typeof name !== "string" ||
    !name.trim() ||
    typeof position !== "string" ||
    !position.trim() ||
    (typeof salary !== "number" && typeof salary !== "string") ||
    String(salary).trim() === "" ||
    !Number.isFinite(numericSalary) ||
    numericSalary < 0
  ) {
    return null;
  }

  return {
    name: name.trim(),
    position: position.trim(),
    salary: numericSalary,
  };
}

app.post("/api/login", (req, res) => {
  const { username, password } = req.body || {};

  if (username === "admin" && password === "password123") {
    return res.status(200).json({
      success: true,
      token: "mock-jwt-token",
    });
  }

  return res.status(401).json({
    success: false,
    message: "Invalid username or password",
  });
});

app.get("/api/employees", async (req, res) => {
  const [rows] = await pool.query(
    `SELECT id, name, position, status, salary FROM ${TABLE} ORDER BY created_at, name`
  );
  return res.status(200).json(rows.map(toEmployee));
});

app.post("/api/employees", async (req, res) => {
  const input = validateEmployeeInput(req.body);

  if (!input) {
    return res.status(400).json({
      success: false,
      message: "name, position, and a valid non-negative salary are required",
    });
  }

  const employee = {
    id: randomUUID(),
    ...input,
    status: "Active",
  };

  await pool.execute(
    `INSERT INTO ${TABLE} (id, name, position, status, salary) VALUES (?, ?, ?, ?, ?)`,
    [
      employee.id,
      employee.name,
      employee.position,
      employee.status,
      employee.salary,
    ]
  );

  return res.status(201).json(employee);
});

app.put("/api/employees/:id", async (req, res) => {
  const input = validateEmployeeInput(req.body);

  if (!input) {
    return res.status(400).json({
      success: false,
      message: "name, position, and a valid non-negative salary are required",
    });
  }

  const [result] = await pool.execute(
    `UPDATE ${TABLE} SET name = ?, position = ?, salary = ? WHERE id = ?`,
    [input.name, input.position, input.salary, req.params.id]
  );

  if (result.affectedRows === 0) {
    return res.status(404).json({
      success: false,
      message: "Employee not found",
    });
  }

  const [rows] = await pool.execute(
    `SELECT id, name, position, status, salary FROM ${TABLE} WHERE id = ?`,
    [req.params.id]
  );

  return res.status(200).json(toEmployee(rows[0]));
});

app.put("/api/employees/:id/status", async (req, res) => {
  const [result] = await pool.execute(
    `UPDATE ${TABLE}
     SET status = IF(status = 'Active', 'On Leave', 'Active')
     WHERE id = ?`,
    [req.params.id]
  );

  if (result.affectedRows === 0) {
    return res.status(404).json({
      success: false,
      message: "Employee not found",
    });
  }

  const [rows] = await pool.execute(
    `SELECT id, name, position, status, salary FROM ${TABLE} WHERE id = ?`,
    [req.params.id]
  );

  return res.status(200).json(toEmployee(rows[0]));
});

app.delete("/api/employees/:id", async (req, res) => {
  const [rows] = await pool.execute(
    `SELECT id, name, position, status, salary FROM ${TABLE} WHERE id = ?`,
    [req.params.id]
  );

  if (rows.length === 0) {
    return res.status(404).json({
      success: false,
      message: "Employee not found",
    });
  }

  await pool.execute(`DELETE FROM ${TABLE} WHERE id = ?`, [req.params.id]);
  return res.status(200).json({
    success: true,
    employee: toEmployee(rows[0]),
  });
});

app.get("/api/employees/salary-clusters", async (req, res) => {
  const [rows] = await pool.query(`SELECT salary FROM ${TABLE}`);
  const salaries = rows.map((row) => Number(row.salary));
  const k = 3;
  let centroids;
  let clusters;

  if (salaries.length === 0) {
    centroids = [0, 0, 0];
    clusters = [[], [], []];
  } else {
    const sortedSalaries = [...salaries].sort((a, b) => a - b);
    centroids = [
      sortedSalaries[0],
      sortedSalaries[Math.floor((sortedSalaries.length - 1) / 2)],
      sortedSalaries[sortedSalaries.length - 1],
    ];

    const assignSalaries = () => {
      const assigned = Array.from({ length: k }, () => []);

      for (const salary of salaries) {
        let closestIndex = 0;
        for (let index = 1; index < k; index += 1) {
          if (
            Math.abs(salary - centroids[index]) <
            Math.abs(salary - centroids[closestIndex])
          ) {
            closestIndex = index;
          }
        }
        assigned[closestIndex].push(salary);
      }

      return assigned;
    };

    for (let iteration = 0; iteration < 100; iteration += 1) {
      clusters = assignSalaries();
      const nextCentroids = centroids.map((centroid, index) => {
        const cluster = clusters[index];
        return cluster.length
          ? cluster.reduce((sum, salary) => sum + salary, 0) / cluster.length
          : centroid;
      });

      const converged = nextCentroids.every(
        (centroid, index) => centroid === centroids[index]
      );
      centroids = nextCentroids;
      if (converged) break;
    }

    clusters = assignSalaries();
  }

  const result = centroids
    .map((centroid, index) => ({
      group: `Tier ${index + 1}`,
      centroid,
      count: clusters[index].length,
    }))
    .sort((a, b) => a.centroid - b.centroid)
    .map((cluster, index) => ({
      ...cluster,
      group: `Tier ${index + 1}`,
    }));

  return res.status(200).json({
    success: true,
    clusters: result,
  });
});

app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: "Route not found",
  });
});

app.use((err, req, res, next) => {
  if (res.headersSent) {
    return next(err);
  }

  if (err instanceof SyntaxError && err.status === 400 && "body" in err) {
    return res.status(400).json({
      success: false,
      message: "Invalid JSON request body",
    });
  }

  console.error(err);
  return res.status(500).json({
    success: false,
    message: "Internal server error",
  });
});

if (require.main === module) {
  initializeDatabase()
    .then(() => {
      app.listen(PORT, () => {
        console.log(`HR API server listening on port ${PORT}`);
      });
    })
    .catch((error) => {
      console.error("Failed to initialize MySQL database:", error.message);
      process.exitCode = 1;
    });
}

module.exports = app;
