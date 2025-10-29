// CryoCorp O₂ LLP WhatsApp AI Bot — Saloni CRM (QR Login Stable + Universal Version)
require("dotenv").config();
const fs = require("fs");
const express = require("express");
const axios = require("axios");
const qrcode = require("qrcode-terminal");
const { Client, LocalAuth } = require("whatsapp-web.js");
const OpenAI = require("openai");

// === 1️⃣ OpenAI Setup ===
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// === 2️⃣ Persistent Lead Storage ===
const leadsFile = "./leads.json";
if (!fs.existsSync(leadsFile)) fs.writeFileSync(leadsFile, JSON.stringify([]));

function loadLeads() {
  try {
    return JSON.parse(fs.readFileSync(leadsFile, "utf8"));
  } catch {
    return [];
  }
}
function saveLeads(leads) {
  fs.writeFileSync(leadsFile, JSON.stringify(leads, null, 2));
}
function findLeadByNumber(number) {
  return loadLeads().find((lead) => lead.number === number);
}

// === 3️⃣ Universal Puppeteer Setup (Render / Replit / Local) ===
let chromium = null;
try {
  chromium = require("@sparticuz/chromium");
} catch {
  console.warn("⚠️ @sparticuz/chromium not found, using local Chrome instead.");
}

const isRender = !!process.env.RENDER || process.env.NODE_ENV === "production";

// Create WhatsApp client dynamically
async function createWhatsAppClient() {
  let executablePath;

  try {
    executablePath = isRender && chromium ? await chromium.executablePath() : undefined;
  } catch {
    executablePath = undefined;
  }

  console.log("🧭 Puppeteer executable path:", executablePath || "Local Chrome / Default");

  const client = new Client({
    authStrategy: new LocalAuth({ dataPath: "./.wwebjs_auth" }),
    puppeteer: {
      headless: true,
      executablePath,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-extensions",
        "--disable-dev-shm-usage",
        "--disable-gpu",
        "--no-first-run",
        "--no-zygote",
        "--single-process",
        "--disable-background-timer-throttling",
        "--disable-renderer-backgrounding",
      ],
    },
  });

  // QR & session events
  client.on("qr", (qr) => {
    console.clear();
    console.log("📱 Scan this QR code to connect WhatsApp:\n");
    qrcode.generate(qr, { small: true });
  });

  client.on("loading_screen", (p, msg) =>
    console.log(`⏳ Loading WhatsApp Web ${p}%: ${msg}`)
  );
  client.on("authenticated", () => console.log("🔐 Authenticated successfully!"));
  client.on("auth_failure", (msg) => console.error("❌ Authentication failure:", msg));
  client.on("disconnected", (r) => {
    console.log("⚠️ Disconnected:", r);
    console.log("♻️ Restarting WhatsApp client...");
    setTimeout(() => client.initialize(), 5000);
  });
  client.on("ready", () => console.log("✅ CryoCorp WhatsApp AI Bot (Saloni) is ready!"));

  return client;
}

// === 4️⃣ AI Context (Saloni CRM) ===
const SALONI_CONTEXT = `
You are *Saloni*, the Customer Relationship Manager at CryoCorp O₂ LLP.
You handle all communication about:
- Sales Orders (SO)
- Purchase Orders (PO)
- Performa Invoices (PI)
- Dispatches, Payments, Follow-ups, and Client CRM.

Be friendly, polite, and professional.
If the query is technical (PSA/ASU plant, capacity, ROI, purity), reply:
"Let me connect you to our technical team for detailed assistance."

Never re-ask info already given.
`;

// === 5️⃣ Temporary Lead Tracker ===
const leadData = {};

function saveLead(lead) {
  const leads = loadLeads();
  leads.push({
    Timestamp: new Date().toLocaleString(),
    ...lead,
  });
  saveLeads(leads);
  console.log(`✅ Saved lead: ${lead.name} (${lead.number})`);
}

// === 6️⃣ AI Reply Helper ===
async function getAIReply(userMessage) {
  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: SALONI_CONTEXT },
      { role: "user", content: userMessage },
    ],
    temperature: 0.7,
  });
  return completion.choices[0].message.content.trim();
}

// === 7️⃣ WhatsApp Message Handler ===
async function setupMessageHandler(client) {
  client.on("message", async (msg) => {
    const text = msg.body.trim();
    const from = msg.from;
    const savedLead = findLeadByNumber(from);
    console.log(`💬 ${from}: ${text}`);

    if (msg.fromMe) return;

    // New lead onboarding
    if (!savedLead && !leadData[from]) {
      if (["hi", "hello", "hey"].includes(text.toLowerCase())) {
        leadData[from] = { step: 1 };
        await msg.reply(
          "👋 Hello! This is *Saloni* from *CryoCorp O₂ LLP*.\nWelcome! May I know your *Full Name*?"
        );
        return;
      }
    }

    // Sequential lead data capture
    if (leadData[from]) {
      const lead = leadData[from];
      if (lead.step === 1) {
        lead.name = text;
        lead.step = 2;
        await msg.reply(`Nice to meet you, *${lead.name}*! May I know your *Company Name*?`);
        return;
      } else if (lead.step === 2) {
        lead.company = text;
        lead.step = 3;
        await msg.reply("Got it 👍 Could you please share your *Email ID*?");
        return;
      } else if (lead.step === 3) {
        lead.email = text;
        lead.step = 4;
        await msg.reply("Perfect 😊 Lastly, may I have your *Contact Number*?");
        return;
      } else if (lead.step === 4) {
        lead.contact = text;
        lead.number = from;
        saveLead(lead);
        await msg.reply(
          `✅ Thank you, *${lead.name} from ${lead.company}!* Your details have been securely saved.\nHow can I assist you today?`
        );
        delete leadData[from];
        return;
      }
    }

    // Returning leads
    if (savedLead) {
      if (["hi", "hello", "hey"].includes(text.toLowerCase())) {
        await msg.reply(
          `👋 Welcome back, *${savedLead.name} from ${savedLead.company}!*  
How can I assist you today — Sales Order, Purchase, PI, or Payment update?`
        );
        return;
      }

      try {
        const reply = await getAIReply(text);
        await msg.reply(reply);
        console.log(`🤖 Saloni: ${reply}`);
      } catch (err) {
        console.error("❌ AI Error:", err);
        await msg.reply("Sorry, something went wrong while connecting to CryoCorp AI.");
      }
    }
  });
}

// === 8️⃣ Express Server (Health + Keep-alive) ===
const app = express();
const PORT = process.env.PORT || 3000;
app.get("/", (req, res) => res.send("✅ CryoCorp O₂ LLP WhatsApp Bot — Saloni is Live!"));
app.listen(PORT, () => console.log(`🌐 Express web server running on port ${PORT}`));

// === 9️⃣ Optional Replit Self-Ping ===
if (process.env.REPL_SLUG && process.env.REPL_OWNER) {
  setInterval(() => {
    axios
      .get(`https://${process.env.REPL_SLUG}.${process.env.REPL_OWNER}.repl.co/`)
      .then(() => console.log("🔁 Self-ping OK"))
      .catch(() => console.log("⚠️ Self-ping failed (maybe restarting)"));
  }, 5 * 60 * 1000);
}

// === 🔟 Initialize WhatsApp Client ===
(async () => {
  console.log("⚙️ Initializing WhatsApp client...");
  const client = await createWhatsAppClient();
  await setupMessageHandler(client);
  client.initialize();
})();
