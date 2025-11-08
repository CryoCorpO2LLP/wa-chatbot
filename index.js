// CryoCorp O₂ LLP WhatsApp AI Bot — Saloni CRM
import 'dotenv/config';
import fs from 'fs';
import express from 'express';
import qrcode from 'qrcode';
import qrcodeTerminal from 'qrcode-terminal';
import OpenAI from 'openai';
import pkg from 'whatsapp-web.js';
const { Client, LocalAuth } = pkg;

// === Configuration ===
const IS_RAILWAY = !!process.env.RAILWAY_ENVIRONMENT;
const PORT = process.env.PORT || 3000;

console.log(`🚂 Environment: ${IS_RAILWAY ? 'Railway' : 'Local'}`);
console.log(`🔧 Node Version: ${process.version}`);
console.log(`📦 Starting CryoCorp WhatsApp Bot...`);

// === OpenAI Setup ===
let openai = null;
if (process.env.OPENAI_API_KEY) {
  openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY.trim() });
  console.log("🤖 OpenAI initialized");
} else {
  console.warn("⚠️ OPENAI_API_KEY missing - AI disabled");
}

// === Lead Storage ===
const leadsFile = "./leads.json";
if (!fs.existsSync(leadsFile)) fs.writeFileSync(leadsFile, "[]");

const loadLeads = () => {
  try {
    return JSON.parse(fs.readFileSync(leadsFile, "utf8") || "[]");
  } catch (error) {
    console.error("❌ Error loading leads:", error.message);
    return [];
  }
};

const saveLeads = (data) => {
  try {
    fs.writeFileSync(leadsFile, JSON.stringify(data, null, 2));
  } catch (error) {
    console.error("❌ Error saving leads:", error.message);
  }
};

const findLeadByNumber = (num) => loadLeads().find((l) => l.number === num);

// === Saloni CRM Context ===
const SALONI_CONTEXT = `You are Saloni, CRM Executive at CryoCorp O₂ LLP. Assist clients regarding Sales Orders, Purchase Orders, Proforma Invoices, Dispatches, Payments, or CRM queries. Keep responses professional and helpful.`;

// === AI Function ===
async function getAIReply(msg) {
  if (!openai) return "⚠️ AI service is currently unavailable. Please contact us directly.";
  try {
    const res = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: SALONI_CONTEXT },
        { role: "user", content: msg },
      ],
      temperature: 0.7,
      max_tokens: 300,
    });
    return res.choices[0].message.content.trim();
  } catch (err) {
    console.error("❌ OpenAI Error:", err.message);
    return "⚠️ I'm having trouble connecting to our AI service. Please try again later or contact us directly.";
  }
}

// === WhatsApp Handler ===
const tempLeads = {};

async function setupMessageHandler(client) {
  client.on("message", async (msg) => {
    if (msg.fromMe) return;
    
    const from = msg.from;
    const text = msg.body.trim();
    const saved = findLeadByNumber(from);

    console.log(`💬 ${from}: ${text}`);

    // New user flow
    if (!saved && !tempLeads[from]) {
      if (["hi", "hello", "hey", "hola", "start"].includes(text.toLowerCase())) {
        tempLeads[from] = { step: 1 };
        await msg.reply("👋 Hello! I'm *Saloni* from *CryoCorp O₂ LLP*.\nMay I know your *Full Name*?");
        return;
      }
    }

    // Lead collection flow
    if (tempLeads[from]) {
      const lead = tempLeads[from];
      switch (lead.step) {
        case 1:
          lead.name = text;
          lead.step = 2;
          await msg.reply(`Nice to meet you, *${lead.name}*! What's your *Company Name*?`);
          break;
        case 2:
          lead.company = text;
          lead.step = 3;
          await msg.reply("Got it 👍 Please share your *Email ID*:");
          break;
        case 3:
          lead.email = text;
          lead.number = from;
          lead.timestamp = new Date().toISOString();
          
          const leads = loadLeads();
          if (!leads.find(l => l.number === from)) {
            leads.push(lead);
            saveLeads(leads);
            console.log(`✅ New lead saved: ${lead.name} from ${lead.company}`);
          }
          
          delete tempLeads[from];
          await msg.reply(`✅ Thank you, *${lead.name}*! Your details have been saved.\n\nHow can I assist you with CryoCorp O₂ LLP today?`);
          break;
      }
      return;
    }

    // Existing user flow
    if (saved) {
      if (["hi", "hello", "hey"].includes(text.toLowerCase())) {
        await msg.reply(`👋 Welcome back, *${saved.name}* from *${saved.company}*! How can I assist you today?`);
      } else {
        const reply = await getAIReply(text);
        await msg.reply(reply);
        console.log(`🤖 Saloni: ${reply}`);
      }
    }
  });

  // Handle errors
  client.on("auth_failure", (msg) => {
    console.error("❌ WhatsApp authentication failed:", msg);
  });

  client.on("disconnected", (reason) => {
    console.log("⚠️ WhatsApp disconnected:", reason);
  });
}

// === Express Server ===
const app = express();
let latestQR = null;
let qrGenerated = false;

app.use(express.json());

// Health check endpoint
app.get("/", (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>CryoCorp WhatsApp Bot</title>
      <style>
        body { font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; }
        .status { padding: 10px; border-radius: 5px; margin: 10px 0; }
        .live { background: #d4edda; color: #155724; }
        .info { background: #d1ecf1; color: #0c5460; }
        a { color: #007bff; text-decoration: none; }
        a:hover { text-decoration: underline; }
      </style>
    </head>
    <body>
      <h1>✅ CryoCorp O₂ LLP WhatsApp Bot</h1>
      <div class="status live"><strong>Status:</strong> Live and Running</div>
      <div class="status info">
        <strong>Environment:</strong> ${IS_RAILWAY ? 'Railway' : 'Local'}<br>
        <strong>QR Ready:</strong> ${qrGenerated ? 'Yes' : 'No'}<br>
        <strong>AI Service:</strong> ${openai ? 'Active' : 'Inactive'}
      </div>
      <p>
        <a href="/qr">📱 Scan QR Code</a> | 
        <a href="/health">❤️ Health Check</a> | 
        <a href="/leads">📊 View Leads</a>
      </p>
    </body>
    </html>
  `);
});

app.get("/qr", (req, res) => {
  if (latestQR) {
    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>QR Code - CryoCorp Bot</title>
        <style>
          body { font-family: Arial, sans-serif; text-align: center; padding: 40px; }
          .container { max-width: 400px; margin: 0 auto; }
          img { border: 2px solid #333; border-radius: 10px; }
          .info { margin: 20px 0; padding: 15px; background: #f8f9fa; border-radius: 5px; }
        </style>
      </head>
      <body>
        <div class="container">
          <h2>📱 Scan QR Code</h2>
          <div class="info">
            <p>Open WhatsApp → Settings → Linked Devices → Link a Device</p>
          </div>
          <img src="${latestQR}" width="300" alt="WhatsApp QR Code">
          <p><small>Refresh if QR code expires</small></p>
          <p><a href="/">← Back to Home</a></p>
        </div>
      </body>
      </html>
    `);
  } else {
    res.send(`
      <!DOCTYPE html>
      <html>
      <head><title>QR Not Ready</title></head>
      <body style="font-family: Arial; text-align: center; padding: 40px;">
        <h2>⏳ QR Code Not Ready</h2>
        <p>Please wait a moment and refresh the page.</p>
        <p><a href="/">← Back to Home</a></p>
      </body>
      </html>
    `);
  }
});

app.get("/health", (req, res) => {
  res.json({ 
    status: "healthy",
    service: "CryoCorp WhatsApp Bot",
    environment: IS_RAILWAY ? "railway" : "local",
    timestamp: new Date().toISOString(),
    qr_ready: !!latestQR,
    ai_active: !!openai
  });
});

app.get("/leads", (req, res) => {
  try {
    const leads = loadLeads();
    res.json({
      total_leads: leads.length,
      leads: leads
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to load leads" });
  }
});

// === WhatsApp Client ===
async function createWhatsAppClient() {
  console.log("⚙️ Initializing WhatsApp client with Puppeteer...");

  const puppeteerOptions = {
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-accelerated-2d-canvas",
      "--no-first-run",
      "--no-zygote",
      "--disable-gpu",
      "--single-process"
    ]
  };

  const client = new Client({
    authStrategy: new LocalAuth({ 
      dataPath: "./.wwebjs_auth",
      clientId: "cryocorp-terminal-bot"
    }),
    puppeteer: puppeteerOptions
  });

  // QR Code Handler
  client.on("qr", (qr) => {
    console.log("\n" + "=".repeat(60));
    console.log("📱 WHATSAPP QR CODE - SCAN WITH YOUR PHONE");
    console.log("=".repeat(60));
    
    // Display QR in terminal
    qrcodeTerminal.generate(qr, { small: true }, function (qrcode) {
      console.log(qrcode);
    });
    
    console.log("\n📱 Instructions:");
    console.log("1. Open WhatsApp → Settings → Linked Devices");
    console.log("2. Tap 'Link a Device'");
    console.log("3. Point camera at QR code above");
    console.log("⏰ QR expires in 20 seconds");
    console.log("=".repeat(60));
    
    // Also generate for web interface
    generateWebQR(qr);
  });

  // Authentication Handlers
  client.on("authenticated", () => {
    console.log("✅ WhatsApp authenticated successfully!");
  });

  client.on("auth_failure", (msg) => {
    console.error("❌ WhatsApp authentication failed:", msg);
  });

  client.on("ready", () => {
    console.log("🎉 WhatsApp client is ready and connected!");
    console.log("🤖 Saloni CRM AI Bot is now active!");
    console.log("💬 Send 'Hi' to test the bot");
  });

  client.on("disconnected", (reason) => {
    console.log("⚠️ WhatsApp disconnected:", reason);
    console.log("🔄 Attempting to reconnect in 10 seconds...");
    setTimeout(() => {
      client.initialize();
    }, 10000);
  });

  return client;
}

// Generate web QR
async function generateWebQR(qr) {
  try {
    latestQR = await qrcode.toDataURL(qr);
    qrGenerated = true;
    console.log("🌐 Web QR also available at: http://localhost:3000/qr");
  } catch (error) {
    console.log("⚠️ Could not generate web QR");
  }
}

// === Application Start ===
async function startApp() {
  try {
    console.log("🚀 Starting CryoCorp WhatsApp Bot...");
    
    const client = await createWhatsAppClient();
    await setupMessageHandler(client);
    await client.initialize();
    
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`🌐 Express server running on port ${PORT}`);
      console.log(`📊 Health check: http://localhost:${PORT}/health`);
      console.log(`📱 Web QR: http://localhost:${PORT}/qr`);
    });
    
  } catch (error) {
    console.error("❌ Failed to start application:", error);
    console.log("🔄 Restarting in 15 seconds...");
    setTimeout(startApp, 15000);
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('🛑 Received SIGINT - Shutting down gracefully...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('🛑 Received SIGTERM - Shutting down gracefully...');
  process.exit(0);
});

// Start the application
startApp();