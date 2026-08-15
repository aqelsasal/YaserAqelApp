import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";

const app = express();
const PORT = 3000;

// Middleware for parsing JSON bodies
app.use(express.json({ limit: '50mb' }));

// Ensure data folder exists
const DATA_DIR = path.join(process.cwd(), "data");
const PROJECTS_DIR = path.join(DATA_DIR, "projects");

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR);
}
if (!fs.existsSync(PROJECTS_DIR)) {
  fs.mkdirSync(PROJECTS_DIR);
}

// Helper to read project
const readProject = (id: string) => {
  const filePath = path.join(PROJECTS_DIR, `${id}.json`);
  if (!fs.existsSync(filePath)) return null;
  try {
    const raw = fs.readFileSync(filePath, "utf-8");
    return JSON.parse(raw);
  } catch (error) {
    console.error(`Error reading project ${id}:`, error);
    return null;
  }
};

// Helper to write project
const writeProject = (id: string, data: any) => {
  const filePath = path.join(PROJECTS_DIR, `${id}.json`);
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf-8");
};

// API: Create new shared project
app.post("/api/projects/create", (req, res) => {
  try {
    const { budget, workers, employees, suppliers, expenses, projectName, name, location, client, status, notes, currency } = req.body;
    
    // Generate a secure random ID
    const projectId = "prj_" + Math.random().toString(36).substring(2, 10);
    
    const projectData = {
      id: projectId,
      name: projectName || name || 'مشروع سحابي',
      location: location || '',
      client: client || '',
      status: status || 'active',
      notes: notes || '',
      currency: currency || 'YER',
      isSyncActive: true,
      disabled: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      budget: budget || [],
      workers: workers || [],
      employees: employees || [],
      suppliers: suppliers || [],
      expenses: expenses || []
    };
    
    writeProject(projectId, projectData);
    res.json({ projectId });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// API: Get shared project data
app.get("/api/projects/:id", (req, res) => {
  try {
    const { id } = req.params;
    const project = readProject(id);
    if (!project) {
      return res.status(404).json({ error: "المشروع غير موجود أو تم إلغاء المزامنة السحابية له", disabled: true });
    }
    if (project.disabled || project.isSyncActive === false) {
      return res.status(403).json({ error: "تم إلغاء المزامنة السحابية لهذا المشروع من قبل المالك، ولم يعد الوصول أو الاطلاع عبر هذا الرابط متاحاً.", disabled: true });
    }
    res.json(project);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// API: Sync/Update shared project data
app.put("/api/projects/:id", (req, res) => {
  try {
    const { id } = req.params;
    const { budget, workers, employees, suppliers, expenses, projectName, name, location, client, status, notes, currency } = req.body;
    
    const existing = readProject(id);
    if (!existing) {
      return res.status(404).json({ error: "المشروع غير موجود", disabled: true });
    }
    if (existing.disabled || existing.isSyncActive === false) {
      return res.status(403).json({ error: "تم إلغاء المزامنة السحابية لهذا المشروع من قبل المالك.", disabled: true });
    }
    
    const updatedProject = {
      ...existing,
      updatedAt: new Date().toISOString(),
      name: (projectName || name) !== undefined ? (projectName || name) : existing.name,
      location: location !== undefined ? location : existing.location,
      client: client !== undefined ? client : existing.client,
      status: status !== undefined ? status : existing.status,
      notes: notes !== undefined ? notes : existing.notes,
      currency: currency !== undefined ? currency : existing.currency,
      budget: budget !== undefined ? budget : existing.budget,
      workers: workers !== undefined ? workers : existing.workers,
      employees: employees !== undefined ? employees : (existing.employees || []),
      suppliers: suppliers !== undefined ? suppliers : existing.suppliers,
      expenses: expenses !== undefined ? expenses : existing.expenses
    };
    
    writeProject(id, updatedProject);
    res.json({ status: "ok", updatedAt: updatedProject.updatedAt });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// API: Cancel/Disable shared project sync
app.post("/api/projects/:id/cancel-sync", (req, res) => {
  try {
    const { id } = req.params;
    const existing = readProject(id);
    if (existing) {
      existing.isSyncActive = false;
      existing.disabled = true;
      existing.disabledAt = new Date().toISOString();
      writeProject(id, existing);
    }
    res.json({ status: "ok", message: "تم إلغاء المزامنة السحابية وتعطيل رابط المشاركة بنجاح" });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Vite Middleware & Static Asset Routing
async function setupVite() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

setupVite();
