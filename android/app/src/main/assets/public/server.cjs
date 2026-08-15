var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// server.ts
var import_express = __toESM(require("express"), 1);
var import_path = __toESM(require("path"), 1);
var import_fs = __toESM(require("fs"), 1);
var import_vite = require("vite");
var app = (0, import_express.default)();
var PORT = 3e3;
app.use(import_express.default.json({ limit: "50mb" }));
var DATA_DIR = import_path.default.join(process.cwd(), "data");
var PROJECTS_DIR = import_path.default.join(DATA_DIR, "projects");
if (!import_fs.default.existsSync(DATA_DIR)) {
  import_fs.default.mkdirSync(DATA_DIR);
}
if (!import_fs.default.existsSync(PROJECTS_DIR)) {
  import_fs.default.mkdirSync(PROJECTS_DIR);
}
var readProject = (id) => {
  const filePath = import_path.default.join(PROJECTS_DIR, `${id}.json`);
  if (!import_fs.default.existsSync(filePath)) return null;
  try {
    const raw = import_fs.default.readFileSync(filePath, "utf-8");
    return JSON.parse(raw);
  } catch (error) {
    console.error(`Error reading project ${id}:`, error);
    return null;
  }
};
var writeProject = (id, data) => {
  const filePath = import_path.default.join(PROJECTS_DIR, `${id}.json`);
  import_fs.default.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf-8");
};
app.post("/api/projects/create", (req, res) => {
  try {
    const { budget, workers, employees, suppliers, expenses } = req.body;
    const projectId = "prj_" + Math.random().toString(36).substring(2, 10);
    const projectData = {
      id: projectId,
      isSyncActive: true,
      disabled: false,
      createdAt: (/* @__PURE__ */ new Date()).toISOString(),
      updatedAt: (/* @__PURE__ */ new Date()).toISOString(),
      budget: budget || [],
      workers: workers || [],
      employees: employees || [],
      suppliers: suppliers || [],
      expenses: expenses || []
    };
    writeProject(projectId, projectData);
    res.json({ projectId });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
app.get("/api/projects/:id", (req, res) => {
  try {
    const { id } = req.params;
    const project = readProject(id);
    if (!project) {
      return res.status(404).json({ error: "\u0627\u0644\u0645\u0634\u0631\u0648\u0639 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F \u0623\u0648 \u062A\u0645 \u0625\u0644\u063A\u0627\u0621 \u0627\u0644\u0645\u0632\u0627\u0645\u0646\u0629 \u0627\u0644\u0633\u062D\u0627\u0628\u064A\u0629 \u0644\u0647", disabled: true });
    }
    if (project.disabled || project.isSyncActive === false) {
      return res.status(403).json({ error: "\u062A\u0645 \u0625\u0644\u063A\u0627\u0621 \u0627\u0644\u0645\u0632\u0627\u0645\u0646\u0629 \u0627\u0644\u0633\u062D\u0627\u0628\u064A\u0629 \u0644\u0647\u0630\u0627 \u0627\u0644\u0645\u0634\u0631\u0648\u0639 \u0645\u0646 \u0642\u0628\u0644 \u0627\u0644\u0645\u0627\u0644\u0643\u060C \u0648\u0644\u0645 \u064A\u0639\u062F \u0627\u0644\u0648\u0635\u0648\u0644 \u0623\u0648 \u0627\u0644\u0627\u0637\u0644\u0627\u0639 \u0639\u0628\u0631 \u0647\u0630\u0627 \u0627\u0644\u0631\u0627\u0628\u0637 \u0645\u062A\u0627\u062D\u0627\u064B.", disabled: true });
    }
    res.json(project);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
app.put("/api/projects/:id", (req, res) => {
  try {
    const { id } = req.params;
    const { budget, workers, employees, suppliers, expenses } = req.body;
    const existing = readProject(id);
    if (!existing) {
      return res.status(404).json({ error: "\u0627\u0644\u0645\u0634\u0631\u0648\u0639 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F", disabled: true });
    }
    if (existing.disabled || existing.isSyncActive === false) {
      return res.status(403).json({ error: "\u062A\u0645 \u0625\u0644\u063A\u0627\u0621 \u0627\u0644\u0645\u0632\u0627\u0645\u0646\u0629 \u0627\u0644\u0633\u062D\u0627\u0628\u064A\u0629 \u0644\u0647\u0630\u0627 \u0627\u0644\u0645\u0634\u0631\u0648\u0639 \u0645\u0646 \u0642\u0628\u0644 \u0627\u0644\u0645\u0627\u0644\u0643.", disabled: true });
    }
    const updatedProject = {
      ...existing,
      updatedAt: (/* @__PURE__ */ new Date()).toISOString(),
      budget: budget !== void 0 ? budget : existing.budget,
      workers: workers !== void 0 ? workers : existing.workers,
      employees: employees !== void 0 ? employees : existing.employees || [],
      suppliers: suppliers !== void 0 ? suppliers : existing.suppliers,
      expenses: expenses !== void 0 ? expenses : existing.expenses
    };
    writeProject(id, updatedProject);
    res.json({ status: "ok", updatedAt: updatedProject.updatedAt });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
app.post("/api/projects/:id/cancel-sync", (req, res) => {
  try {
    const { id } = req.params;
    const existing = readProject(id);
    if (existing) {
      existing.isSyncActive = false;
      existing.disabled = true;
      existing.disabledAt = (/* @__PURE__ */ new Date()).toISOString();
      writeProject(id, existing);
    }
    res.json({ status: "ok", message: "\u062A\u0645 \u0625\u0644\u063A\u0627\u0621 \u0627\u0644\u0645\u0632\u0627\u0645\u0646\u0629 \u0627\u0644\u0633\u062D\u0627\u0628\u064A\u0629 \u0648\u062A\u0639\u0637\u064A\u0644 \u0631\u0627\u0628\u0637 \u0627\u0644\u0645\u0634\u0627\u0631\u0643\u0629 \u0628\u0646\u062C\u0627\u062D" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
async function setupVite() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await (0, import_vite.createServer)({
      server: { middlewareMode: true },
      appType: "spa"
    });
    app.use(vite.middlewares);
  } else {
    const distPath = import_path.default.join(process.cwd(), "dist");
    app.use(import_express.default.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(import_path.default.join(distPath, "index.html"));
    });
  }
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}
setupVite();
//# sourceMappingURL=server.cjs.map
