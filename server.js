import express from "express";
import cors from "cors";
import fs from "fs";
import multer from "multer";
import crypto from "crypto";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = 3000;

/* MIDDLEWARE */
app.use(cors());
app.use(express.json());
app.use(express.static("public"));

const upload = multer({ dest: "uploads/" });

/* FILE PATHS */
const USERS_FILE = "./data/users.json";
const PAYMENTS_FILE = "./data/payments.json";
const CONFIG_FILE = "./data/config.json";
const SUPPORT_FILE = "./data/support_messages.json";


/* INIT */
if (!fs.existsSync("./data")) fs.mkdirSync("./data");
if (!fs.existsSync("./uploads")) fs.mkdirSync("./uploads");

if (!fs.existsSync(USERS_FILE)) fs.writeFileSync(USERS_FILE, "[]");
if (!fs.existsSync(PAYMENTS_FILE)) fs.writeFileSync(PAYMENTS_FILE, "[]");
if (!fs.existsSync(PAYMENTS_FILE)) fs.writeFileSync(SUPPORT_FILE, "[]");

if (!fs.existsSync(CONFIG_FILE))
  fs.writeFileSync(CONFIG_FILE, JSON.stringify({
    walletAddress: "demoWallet123",
    standardFee: "5000",
    priorityFee: "12000",
    balance: "100000"
  }, null, 2));

/* HELPERS */
const readJSON = p => JSON.parse(fs.readFileSync(p, "utf8"));
const writeJSON = (p, d) => fs.writeFileSync(p, JSON.stringify(d, null, 2));
const uid = () => crypto.randomBytes(6).toString("hex").toUpperCase();

/* =========================
   LOGIN / REGISTER
========================= */
app.post("/api/login", (req, res) => {
  const { name, email, wallet, walletType } = req.body;
  if (!email || !wallet) return res.status(400).json({ error: "Missing fields" });

  const users = readJSON(USERS_FILE);

  let user = users.find(u => u.email === email && u.wallet === wallet);

  if (!user) {
    user = {
      uid: uid(),
      name,
      email,
      wallet,
      walletType,
      approved: false,
      createdAt: new Date().toISOString()
    };
    users.push(user);
    writeJSON(USERS_FILE, users);
    return res.json({ uid: user.uid, approved: false });
  }

  // If already approved, inform frontend to redirect
  res.json({ uid: user.uid, approved: user.approved });
});

/* =========================
   CONFIG (JSON-BASED)
========================= */
app.get("/api/config", (req, res) => {
  const config = readJSON(CONFIG_FILE);
  res.json(config);
});

/* =========================
   PAYMENT SUBMISSION
========================= */
app.post("/api/pay", upload.single("proof"), (req, res) => {
  const { uid, type } = req.body;
  console.log({ uid, type, b: req.body })
  if (!uid || !type || !req.file) return res.status(400).json({ error: "Invalid request" });

  const payments = readJSON(PAYMENTS_FILE);

  payments.push({
    id: uid,
    uid,
    type,
    proof: req.file.filename,
    status: "pending",
    createdAt: new Date().toISOString()
  });

  writeJSON(PAYMENTS_FILE, payments);
  res.json({ success: true });
});

/* =========================
   STATUS CHECK
========================= */
app.get("/api/status/:uid", (req, res) => {
  const payments = readJSON(PAYMENTS_FILE);
  const approved = payments.some(
    p => p.uid === req.params.uid && p.status === "approved"
  );
  res.json({ approved });
});

// Get all support messages (ascending order)
app.get("/api/support", (req, res) => {
  const msgs = read(SUPPORT_FILE);
  msgs.sort((a, b) => a.createdAt - b.createdAt);
  res.json(msgs);
});

// Add support message
app.post("/api/support", (req, res) => {
  const { text } = req.body;
  if (!text) return res.status(400).json({ error: "Text required" });

  const msgs = read(SUPPORT_FILE);
  msgs.push({
    id: Date.now(),
    text,
    createdAt: Date.now()
  });

  write(SUPPORT_FILE, msgs);
  res.json({ ok: true });
});

// Delete support message
app.delete("/api/support/:id", (req, res) => {
  const id = Number(req.params.id);
  const msgs = read(SUPPORT_FILE).filter(m => m.id !== id);
  write(SUPPORT_FILE, msgs);
  res.json({ ok: true });
});


/* =========================
   ADMIN LOGIN
========================= */
app.post("/api/admin/login", (req, res) => {
  const { username, password } = req.body;
  if (username === "slime" && password === "crypto26") {
    return res.json({ success: true });
  }
  return res.status(401).json({ success: false });
});

/* =========================
   ADMIN - GET PAYMENTS
========================= */
app.get("/api/admin/payments", (req, res) => {
  const payments = readJSON(PAYMENTS_FILE);
  res.json(payments);
});

/* =========================
   ADMIN - DECISION & CONFIG UPDATE
========================= */
app.post("/api/admin/decision", (req, res) => {
  const { id, status, walletAddress, balance, standardFee, priorityFee } = req.body;

  // Update payment status if id provided
  if (id) {
    const payments = readJSON(PAYMENTS_FILE);
    const p = payments.find(x => x.id === id);
    if (p) p.status = status;
    writeJSON(PAYMENTS_FILE, payments);

    // Update user approved status
    const users = readJSON(USERS_FILE);
    const user = users.find(u => u.uid === p.uid);
    if (user) user.approved = (status === "approved");
    writeJSON(USERS_FILE, users);
  }

  // Update global config
  const config = readJSON(CONFIG_FILE);
  if (walletAddress) config.walletAddress = walletAddress;
  if (balance) config.balance = balance;
  if (standardFee) config.standardFee = standardFee;
  if (priorityFee) config.priorityFee = priorityFee;
  writeJSON(CONFIG_FILE, config);

  res.json({ success: true });
});

/* START */
app.listen(PORT, () =>
  console.log(`Server running on http://localhost:${PORT}`)
);
