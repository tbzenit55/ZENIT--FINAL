const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion } = require('@whiskeysockets/baileys');
const pino = require('pino');
const NodeCache = require('node-cache');
const fs = require('fs-extra');
const express = require('express');
const QRCode = require('qrcode');
const axios = require('axios');
const yts = require('yt-search');
require('dotenv').config();

const CONFIG = {
    BOT_NAME: process.env.BOT_NAME || 'ZENIT X BOT',
    OWNER_NAME: process.env.OWNER_NAME || 'ZENIT',
    OWNER_NUMBER: (process.env.OWNER_NUMBER || '91xxxxxxxxxx') + '@s.whatsapp.net',
    PREFIX: process.env.PREFIX || '.',
    PORT: process.env.PORT || 8000
};

const app = express();
const msgRetryCounterCache = new NodeCache();
let currentQR = '';
let botConnected = false;
let sockInstance = null;
let qrData = null;

// Simple web page
app.get('/', (req, res) => {
    res.send(`<!DOCTYPE html>
<html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>${CONFIG.BOT_NAME}</title>
<meta http-equiv="refresh" content="30">
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:Arial;background:#0a0a14;color:#fff;min-height:100vh;display:flex;justify-content:center;align-items:center;padding:20px}
.box{background:rgba(255,255,255,0.03);border-radius:16px;padding:30px;max-width:400px;width:100%;text-align:center;border:1px solid rgba(255,255,255,0.06)}
h1{font-size:24px;background:linear-gradient(135deg,#667eea,#764ba2);-webkit-background-clip:text;-webkit-text-fill-color:transparent;margin:10px 0}
.desc{color:#888;font-size:12px;margin-bottom:20px}
.qr-box{background:#fff;padding:15px;border-radius:12px;display:inline-block;margin:10px 0}
.qr-box img{width:200px;height:200px}
.badge{display:inline-block;padding:5px 16px;border-radius:20px;font-size:11px;margin:10px 0}
.waiting{background:rgba(255,171,0,0.15);color:#ffab00;animation:pulse 2s infinite}
.online{background:rgba(46,213,115,0.15);color:#2ed573}
@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.5}}
.steps{text-align:left;margin:15px 0;padding:15px;background:rgba(255,255,255,0.02);border-radius:10px;font-size:13px}
.steps ol{padding-left:20px}
.steps li{margin:5px 0;color:#bbb}
.btn{display:inline-block;padding:10px 25px;border-radius:20px;background:rgba(255,255,255,0.08);color:#fff;border:1px solid #333;text-decoration:none;font-size:14px;margin-top:10px}
.footer{color:#444;font-size:10px;margin-top:15px}
</style></head>
<body>
<div class="box">
<div style="font-size:40px">🤖</div>
<h1>${CONFIG.BOT_NAME}</h1>
<p class="desc">WhatsApp Multi-Device Bot</p>
<span class="badge" id="statusBadge">⏳ Loading...</span>
<div class="qr-box" id="qrContainer">
<img id="qrImage" src="" alt="QR Code">
<p style="color:#888;font-size:11px;margin-top:5px">Scan with WhatsApp</p>
</div>
<div class="steps">
<strong>📱 How to Connect:</strong>
<ol>
<li>Open <b>WhatsApp</b> on phone</li>
<li>Go to <b>Linked Devices</b></li>
<li>Tap <b>"Link a Device"</b></li>
<li><b>Scan QR code</b> above</li>
<li>Wait for connection</li>
<li>Send <b>.menu</b> to test</li>
</ol>
</div>
<a href="javascript:location.reload()" class="btn">🔄 Refresh</a>
<div class="footer">👑 ${CONFIG.OWNER_NAME} | © ${CONFIG.BOT_NAME}</div>
</div>
<script>
async function loadQR(){
try{
const r=await fetch('/qr');
const d=await r.json();
if(d.qr&&d.qr.length>100){
document.getElementById('qrImage').src=d.qr;
document.getElementById('statusBadge').textContent='📱 Scan QR Code';
document.getElementById('statusBadge').className='badge waiting';
}
}catch(e){}
}
async function checkStatus(){
try{
const r=await fetch('/status');
const d=await r.json();
if(d.connected){
document.getElementById('statusBadge').textContent='🟢 Bot Online';
document.getElementById('statusBadge').className='badge online';
document.getElementById('qrContainer').style.display='none';
}
}catch(e){}
}
loadQR();
checkStatus();
setInterval(loadQR,15000);
setInterval(checkStatus,5000);
</script>
</body></html>`);
});

app.get('/qr', (req, res) => {
    if (currentQR) res.json({ qr: currentQR });
    else res.json({ qr: '' });
});

app.get('/status', (req, res) => {
    res.json({ connected: botConnected, users: users.size });
});

app.listen(CONFIG.PORT, () => console.log('Web: ' + CONFIG.PORT));

const users = new Set();

async function startBot() {
    try {
        if (fs.existsSync('./session')) fs.removeSync('./session');
        
        const { state, saveCreds } = await useMultiFileAuthState('./session');
        const { version } = await fetchLatestBaileysVersion();
        
        console.log('Baileys:', version);
        
        const sock = makeWASocket({
            version,
            logger: pino({ level: 'fatal' }),
            printQRInTerminal: true,
            auth: state,
            browser: ['ZENIT X BOT', 'Safari', '1.0.0'],
            markOnlineOnConnect: true,
            msgRetryCounterCache,
            defaultQueryTimeoutMs: undefined
        });
        
        sockInstance = sock;
        
        sock.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnect, qr } = update;
            
            if (qr) {
                currentQR = await QRCode.toDataURL(qr);
                console.log('✅ QR Code ready!');
                console.log('📱 Open web page to scan');
            }
            
            if (connection === 'close') {
                console.log('Connection closed');
                botConnected = false;
                currentQR = '';
                const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
                if (shouldReconnect) {
                    setTimeout(startBot, 3000);
                } else {
                    if (fs.existsSync('./session')) fs.removeSync('./session');
                    setTimeout(startBot, 2000);
                }
            } else if (connection === 'open') {
                botConnected = true;
                currentQR = '';
                console.log('✅ Bot Connected Successfully!');
            }
        });
        
        sock.ev.on('creds.update', saveCreds);
        
        sock.ev.on('messages.upsert', async ({ messages }) => {
            const msg = messages[0];
            if (!msg.message || msg.key.fromMe) return;
            
            const chat = msg.key.remoteJid;
            users.add(chat);
            
            const text = msg.message.conversation || 
                        msg.message.extendedTextMessage?.text || 
                        msg.message.imageMessage?.caption || '';
            
            if (!text || !text.startsWith(CONFIG.PREFIX)) return;
            
            const args = text.slice(1).trim().split(/ +/);
            const cmd = args[0]?.toLowerCase();
            const q = args.slice(1).join(' ');
            
            try {
                if (cmd === 'menu' || cmd === 'help') {
                    await sock.sendMessage(chat, { text: `🤖 *${CONFIG.BOT_NAME}*\n👑 ${CONFIG.OWNER_NAME}\n\n.ping\n.alive\n.truth\n.dare\n.joke\n.meme\n.waifu\n.neko\n.play song\n.tiktok link\n.calc 2+2\n.sticker (reply image)` });
                }
                else if (cmd === 'ping') await sock.sendMessage(chat, { text: '🏓 Pong! Bot Online' });
                else if (cmd === 'alive') await sock.sendMessage(chat, { text: `🟢 ${CONFIG.BOT_NAME} Alive!\n👥 Users: ${users.size}` });
                else if (cmd === 'truth') {
                    const truths = ['Biggest fear?','Ever lied?','First crush?','Secret talent?','Last cry?'];
                    await sock.sendMessage(chat, { text: '🔮 ' + truths[Math.floor(Math.random()*truths.length)] });
                }
                else if (cmd === 'dare') {
                    const dares = ['Sing a song!','Send selfie!','Do 10 pushups!','Post status!','Dance!'];
                    await sock.sendMessage(chat, { text: '🎯 ' + dares[Math.floor(Math.random()*dares.length)] });
                }
                else if (cmd === 'joke') {
                    try {
                        const r = await axios.get('https://v2.jokeapi.dev/joke/Any?type=single');
                        await sock.sendMessage(chat, { text: '😂 ' + r.data.joke });
                    } catch(e) {}
                }
                else if (cmd === 'meme') {
                    try {
                        const r = await axios.get('https://meme-api.com/gimme');
                        await sock.sendMessage(chat, { image: { url: r.data.url }, caption: r.data.title });
                    } catch(e) {}
                }
                else if (cmd === 'waifu') {
                    try {
                        const r = await axios.get('https://api.waifu.pics/sfw/waifu');
                        await sock.sendMessage(chat, { image: { url: r.data.url }, caption: '💕' });
                    } catch(e) {}
                }
                else if (cmd === 'neko') {
                    try {
                        const r = await axios.get('https://api.waifu.pics/sfw/neko');
                        await sock.sendMessage(chat, { image: { url: r.data.url }, caption: '🐱' });
                    } catch(e) {}
                }
                else if (cmd === 'play' || cmd === 'song') {
                    if (!q) return;
                    try {
                        const r = await yts(q);
                        const v = r.videos[0];
                        if (v) await sock.sendMessage(chat, { text: '🎵 ' + v.title + '\n⏱ ' + v.timestamp + '\n🔗 ' + v.url });
                    } catch(e) {}
                }
                else if (cmd === 'calc') {
                    if (!q) return;
                    try { await sock.sendMessage(chat, { text: '🧮 ' + eval(q) }); } catch(e) {}
                }
                else if (cmd === 'sticker') {
                    if (msg.message?.imageMessage) {
                        try {
                            const media = await sock.downloadMediaMessage(msg);
                            await sock.sendMessage(chat, { sticker: media });
                        } catch(e) {}
                    }
                }
            } catch(e) {}
        });
        
    } catch(e) {
        console.error('Start error:', e.message);
        setTimeout(startBot, 5000);
    }
}

startBot();
