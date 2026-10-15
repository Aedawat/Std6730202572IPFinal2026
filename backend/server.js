require('dotenv').config();
const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

// In-Memory Employee Array ตามข้อกำหนดข้อสอบ
let employees = [
  { id: "1", name: "John Doe", position: "Software Engineer", status: "Active", salary: 45000 },
  { id: "2", name: "Jane Smith", position: "HR Manager", status: "Active", salary: 65000 },
  { id: "3", name: "Bob Johnson", position: "Junior Developer", status: "On Leave", salary: 25000 },
  { id: "4", name: "Alice Brown", position: "Senior Architect", status: "Active", salary: 90000 },
  { id: "5", name: "Charlie Davis", position: "Intern", status: "Active", salary: 18000 }
];

// ----------------------------------------------------
// Phase 1: Authentication
// ----------------------------------------------------
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  if (username === 'admin' && password === 'password123') {
    return res.status(200).json({ success: true, token: 'mock-jwt-token' });
  }
  return res.status(401).json({ success: false, message: 'Invalid credentials' });
});

// ----------------------------------------------------
// Phase 1: CRUD Endpoints
// ----------------------------------------------------

// GET /api/employees - ดึงข้อมูลพนักงานทั้งหมด
app.get('/api/employees', (req, res) => {
  res.status(200).json(employees);
});

// POST /api/employees - เพิ่มพนักงานใหม่
app.post('/api/employees', (req, res) => {
  const { name, position, salary } = req.body;
  
  if (!name || !position || salary === undefined || salary === '' || isNaN(Number(salary))) {
    return res.status(400).json({ message: 'All fields (name, position, salary) are required.' });
  }

  const newEmp = {
    id: String(Date.now()),
    name,
    position,
    status: 'Active',
    salary: Number(salary)
  };

  employees.push(newEmp);
  res.status(201).json(newEmp);
});

// PUT /api/employees/:id/status - สลับสถานะ (Active <-> On Leave)
app.put('/api/employees/:id/status', (req, res) => {
  const { id } = req.params;
  const emp = employees.find(e => e.id === id);

  if (!emp) {
    return res.status(404).json({ message: 'Employee not found' });
  }

  emp.status = emp.status === 'Active' ? 'On Leave' : 'Active';
  res.status(200).json(emp);
});

// DELETE /api/employees/:id - ลบพนักงาน
app.delete('/api/employees/:id', (req, res) => {
  const { id } = req.params;
  const index = employees.findIndex(e => e.id === id);

  if (index === -1) {
    return res.status(404).json({ message: 'Employee not found' });
  }

  employees.splice(index, 1);
  res.status(200).json({ success: true, message: 'Employee deleted' });
});

// ----------------------------------------------------
// Phase 2: K-Means Salary Clustering (k=3)
// ----------------------------------------------------
app.get('/api/employees/salary-clusters', (req, res) => {
  const salaries = employees.map(e => Number(e.salary)).filter(s => !isNaN(s));

  if (salaries.length === 0) {
    return res.status(200).json({ success: true, clusters: [] });
  }

  let k = Math.min(3, salaries.length);
  salaries.sort((a, b) => a - b);

  // กำหนด Centroids เริ่มต้น
  let centroids = [];
  if (k === 1) centroids = [salaries[0]];
  else if (k === 2) centroids = [salaries[0], salaries[salaries.length - 1]];
  else centroids = [salaries[0], salaries[Math.floor(salaries.length / 2)], salaries[salaries.length - 1]];

  let clusters = [[], [], []];

  for (let iter = 0; iter < 20; iter++) {
    clusters = Array.from({ length: k }, () => []);

    for (let s of salaries) {
      let closestIndex = 0;
      let minDiff = Math.abs(s - centroids[0]);
      for (let i = 1; i < k; i++) {
        let diff = Math.abs(s - centroids[i]);
        if (diff < minDiff) {
          minDiff = diff;
          closestIndex = i;
        }
      }
      clusters[closestIndex].push(s);
    }

    let newCentroids = clusters.map((cls, idx) => {
      if (cls.length === 0) return centroids[idx];
      return cls.reduce((sum, val) => sum + val, 0) / cls.length;
    });

    if (centroids.every((c, idx) => c === newCentroids[idx])) break;
    centroids = newCentroids;
  }

  const formattedClusters = clusters
    .map((cls, idx) => ({
      group: `Tier ${idx + 1}`,
      centroid: cls.length > 0 ? Math.round(cls.reduce((a, b) => a + b, 0) / cls.length) : 0,
      count: cls.length
    }))
    .filter(c => c.count > 0);

  res.status(200).json({
    success: true,
    clusters: formattedClusters
  });
});

const PORT = process.env.PORT || 3053;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});