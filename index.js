// CryoCorp O2 LLP WhatsApp AI Bot — Saloni CRM (Self-sustaining Replit Version)
require("dotenv").config();
const fs = require("fs");
const express = require("express");
const { Client, LocalAuth } = require("whatsapp-web.js");
const qrcode = require("qrcode-terminal");
const OpenAI = require("openai");

// === 1️⃣ Basic Web Server for Replit Keep-Alive ===
const app = express();
app.get("/", (req, res) => res.send("🚀 CryoCorp O2 LLP WhatsApp AI Bot (Saloni) is running!"));
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🌐 Express server running on port ${PORT}`));

// Ping itself every 5 minutes (300,000 ms) to prevent Replit sleep
setInterval(() => {
  require("http").get(`http://${process.env.REPL_SLUG}.${process.env.REPL_OWNER}.repl.co/`);
}, 300000);

// === 2️⃣ OpenAI Setup ===
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// === 3️⃣ Local JSON Storage (Persistent Database) ===
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
  const leads = loadLeads();
  return leads.find((lead) => lead.number === number);
}

// === 4️⃣ WhatsApp Client Setup ===
const client = new Client({
  authStrategy: new LocalAuth(),
});

client.on("qr", (qr) => {
  console.clear();
  console.log("📱 Scan this QR code to connect WhatsApp:\n");
  qrcode.generate(qr, { small: true });
});

client.on("loading_screen", (percent, message) => {
  console.log(`⏳ Loading WhatsApp Web ${percent}%: ${message}`);
});

client.on("authenticated", () => {
  console.log("🔐 Authenticated successfully!");
});

client.on("auth_failure", (msg) => {
  console.error("❌ Authentication failure:", msg);
});

client.on("disconnected", (reason) => {
  console.log("⚠️ Disconnected:", reason);
});

client.on("ready", () => {
  console.log("✅ CryoCorp WhatsApp AI Bot (Saloni) is ready!");
});

// === 5️⃣ Saloni Context (CRM + Technical) ===
const SALONI_CONTEXT = `
You are *Saloni*, the Customer Relationship Manager at CryoCorp O₂ LLP.

You handle all communication about:
- Sales Orders (SO)
- Purchase Orders (PO)
- Performa Invoices (PI)
- Dispatches, Payments, Follow-ups, and Client CRM.

You are friendly, polite, and professional.
If a query is about technical aspects (like PSA/ASU plant, capacity, ROI, purity, installation, or machinery),
politely respond:
"I'll forward your query to our *Technical Team* for accurate details."

Never re-ask for user information if it's already collected.
If user mentions placing an order, checking PI, or follow-up, guide them naturally.
Keep all replies short, warm, and professional.
`;

// === 6️⃣ Temporary Step Tracker for Ongoing Registration ===
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

// === 7️⃣ AI Reply Function ===
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

// === 8️⃣ WhatsApp Message Handler ===
client.on("message", async (msg) => {
  const text = msg.body.trim();
  const from = msg.from;
  const savedLead = findLeadByNumber(from);

  console.log(`💬 ${from}: ${text}`);
  if (msg.fromMe) return;

  // === New user ===
  if (!savedLead && !leadData[from]) {
    if (["hi", "hello", "hey"].includes(text.toLowerCase())) {
      leadData[from] = { step: 1 };
      await msg.reply(
        "👋 Hello! This is *Saloni* from *CryoCorp O₂ LLP*.\nWelcome! May I know your *Full Name*?"
      );
      return;
    }
  }

  // === Registration Process ===
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

  // === Returning user ===
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

// === 9️⃣ Start Bot ===
console.log("⚙️ Initializing WhatsApp client...");
client.initialize();
