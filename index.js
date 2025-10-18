// index.js
require('dotenv').config();
const { Client } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const OpenAI = require('openai');

// Initialize ChatGPT client
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
});

// Initialize WhatsApp client
const client = new Client({
    puppeteer: {
        headless: true, // set to false if you want to see browser window
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    }
});

// ✅ Show QR Code clearly in terminal
client.on('qr', qr => {
    console.clear(); // clears old text so QR is full size
    console.log('📱 Scan this QR code with WhatsApp (Linked Devices):\n');
    qrcode.generate(qr, { small: true });
    console.log('\nIf QR looks cut off, enlarge your terminal or use Windows Terminal.');
});

// ✅ When bot is ready
client.on('ready', () => {
    console.log('✅ WhatsApp ChatGPT Bot is ready and connected!');
});

// ✅ Listen for incoming messages
client.on('message', async msg => {
    const userMessage = msg.body.trim();
    console.log(`💬 Message from ${msg.from}: ${userMessage}`);

    if (msg.fromMe) return; // Avoid replying to itself

    try {
        const response = await openai.chat.completions.create({
            model: "gpt-3.5-turbo",
            messages: [{ role: "user", content: userMessage }]
        });

        const botReply = response.choices[0].message.content;
        await msg.reply(botReply);
        console.log("🤖 Replied:", botReply);

    } catch (error) {
        console.error("❌ Error:", error.message);
        msg.reply("⚠️ Sorry, something went wrong while connecting to ChatGPT.");
    }
});

// ✅ Initialize WhatsApp client
client.initialize();

