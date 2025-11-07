// CryoCorp O₂ LLP WhatsApp AI Bot — Saloni CRM
import 'dotenv/config';
import fs from 'fs';
import express from 'express';
import axios from 'axios';
import qrcode from 'qrcode';
import OpenAI from 'openai';
import pkg from 'whatsapp-web.js';
import puppeteer from 'puppeteer';
const { Client, LocalAuth } = pkg;

// === 1️⃣ OpenAI Setup ===
let openai = null;
try {
  if (!process.env.OPENAI_API_KEY) {
    console.warn("⚠️ OPENAI_API_KEY not found in .env — AI will be disabled");
  } else {
    openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY.trim() });
    console.log("🤖 OpenAI initialized.");
  }
} catch (err) {
  console.error("❌ OpenAI init error:", err.message);
}

// === 2️⃣ Persistent Lead Storage ===
const leadsFile = "./leads.json";
if (!fs.existsSync(leadsFile)) fs.writeFileSync(leadsFile, "[]");
const loadLeads = () => JSON.parse(fs.readFileSync(leadsFile, "utf8") || "[]");
const saveLeads = (data) => fs.writeFileSync(leadsFile, JSON.stringify(data, null, 2));
const findLeadByNumber = (num) => loadLeads().find((l) => l.number === num);

// === 3️⃣ Environment Detect ===
const IS_LOCAL = !process.env.RENDER && !process.env.RAILWAY_STATIC_URL && !process.env.REPL_SLUG;
console.log(`🌍 Environment: ${IS_LOCAL ? "Local (VS Code)" : "Cloud (Render/Railway/Replit)"}`);

// === 4️⃣ QR Code Storage ===
let latestQR = null;

// === 5️⃣ Create WhatsApp Client (Local QR Fix) ===
async function createWhatsAppClient() {
  console.log("🧭 Launching WhatsApp client...");

  const client = new Client({
    authStrategy: new LocalAuth({ dataPath: "./.wwebjs_auth" }),
    puppeteer: {
      headless: false, // 👈 show Chrome window for local debugging
      executablePath: await puppeteer.executablePath(),
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    },
  });

  client.on("qr", async (qr) => {
    latestQR = await qrcode.toDataURL(qr);
    console.log("📱 QR ready — open http://localhost:3000/qr to scan!");
  });

  client.on("authenticated", () => console.log("🔐 Authenticated successfully!"));
  client.on("ready", () => console.log("✅ WhatsApp connected and ready!"));
  client.on("disconnected", (r) => console.log("⚠️ Disconnected:", r));

  return client;
}

// === 6️⃣ Saloni CRM Context ===
const SALONI_CONTEXT = `
You are Saloni, CRM Executive at CryoCorp O₂ LLP.
Assist clients regarding Sales Orders, Purchase Orders, Proforma Invoices, Dispatches, Payments, or CRM queries.
If technical (PSA/ASU details), say:
"Let me connect you to our technical team for detailed assistance."
Keep responses polite, brief, and professional.
`;

// === 7️⃣ AI Chat Function ===
async function getAIReply(msg) {
  if (!openai) return "⚠️ AI unavailable (missing API key).";
  try {
    const res = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: SALONI_CONTEXT },
        { role: "user", content: msg },
      ],
      temperature: 0.7,
    });
    return res.choices[0].message.content.trim();
  } catch (err) {
    console.error("❌ OpenAI Error:", err.message);
    return "⚠️ Sorry, I couldn't reach CryoCorp AI right now.";
  }
}

// === 8️⃣ WhatsApp Message Handler ===
const tempLeads = {};

async function setupMessageHandler(client) {
  client.on("message", async (msg) => {
    const from = msg.from;
    const text = msg.body.trim();
    const saved = findLeadByNumber(from);

    if (msg.fromMe) return;
    console.log(`💬 ${from}: ${text}`);

    // Lead collection flow
    if (!saved && !tempLeads[from]) {
      if (["hi", "hello", "hey"].includes(text.toLowerCase())) {
        tempLeads[from] = { step: 1 };
        await msg.reply("👋 Hello! I'm *Saloni* from *CryoCorp O₂ LLP*.\nMay I know your *Full Name*?");
        return;
      }
    }

    if (tempLeads[from]) {
      const lead = tempLeads[from];
      if (lead.step === 1) {
        lead.name = text;
        lead.step = 2;
        return msg.reply(`Nice to meet you, *${lead.name}*! May I know your *Company Name*?`);
      } else if (lead.step === 2) {
        lead.company = text;
        lead.step = 3;
        return msg.reply("Got it 👍 Please share your *Email ID*.");
      } else if (lead.step === 3) {
        lead.email = text;
        lead.step = 4;
        return msg.reply("Perfect 😊 Lastly, may I have your *Contact Number*?");
      } else if (lead.step === 4) {
        lead.contact = text;
        lead.number = from;
        const leads = loadLeads();
        leads.push({ Timestamp: new Date().toLocaleString(), ...lead });
        saveLeads(leads);
        delete tempLeads[from];
        return msg.reply(`✅ Thank you, *${lead.name} from ${lead.company}*! Your details are saved.\nHow can I assist you today?`);
      }
    }

    // Returning leads (AI reply)
    if (saved) {
      if (["hi", "hello", "hey"].includes(text.toLowerCase())) {
        return msg.reply(`👋 Welcome back, *${saved.name} from ${saved.company}*! How can I assist you today?`);
      }
      const reply = await getAIReply(text);
      await msg.reply(reply);
      console.log(`🤖 Saloni: ${reply}`);
    }
  });
}

// === 9️⃣ Express Server (QR Route) ===
const app = express();
const PORT = process.env.PORT || 3000;

app.get("/", (req, res) =>
  res.send(`<h2>✅ CryoCorp WhatsApp AI Bot is Live!</h2><p>Visit <a href="/qr">/qr</a> to scan the QR.</p>`)
);

app.get("/qr", (req, res) =>
  res.send(
    latestQR
      ? `<h3>📱 Scan this QR:</h3><img src="${latestQR}" width="300"/><p>Refresh if expired.</p>`
      : "<h3>⏳ QR not ready yet. Please refresh.</h3>"
  )
);

app.listen(PORT, () => console.log(`🌐 Web server running on port ${PORT}`));

// === 🔟 Keep Alive (Replit Only) ===
if (process.env.REPL_SLUG && process.env.REPL_OWNER) {
  setInterval(() => {
    axios.get(`https://${process.env.REPL_SLUG}.${process.env.REPL_OWNER}.repl.co/`).catch(() => {});
  }, 5 * 60 * 1000);
}

// === 1️⃣1️⃣ Initialize Client ===
(async () => {
  console.log("⚙️ Initializing WhatsApp client...");
  const client = await createWhatsAppClient();
  await setupMessageHandler(client);
  await client.initialize();
})();
