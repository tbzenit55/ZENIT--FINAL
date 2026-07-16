const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion, makeCacheableSignalKeyStore } = require('@whiskeysockets/baileys');
const pino = require('pino');
const NodeCache = require('node-cache');
const fs = require('fs-extra');
const express = require('express');
const QRCode = require('qrcode');
const axios = require('axios');
const yts = require('yt-search');
require('dotenv').config();

const BOT_NAME = process.env.BOT_NAME || 'ZENIT X BOT';
const OWNER_NAME = process.env.OWNER_NAME || 'ZENIT';
const OWNER_NUMBER = (process.env.OWNER_NUMBER || '91xxxxxxxxxx') + '@s.whatsapp.net';
const PREFIX = process.env.PREFIX || '.';
const PORT = process.env.PORT || 8000;

const app = express();
const msgRetryCounterCache = new NodeCache();

let currentQR = '';
let connected = false;
let sockInstance = null;
let pairingInProgress = false;

app.get('/', (req, res) => {
    res.send(`<!DOCTYPE html>
<html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>${BOT_NAME}</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:Arial;background:#0a0a14;color:#fff;display:flex;justify-content:center;align-items:center;min-height:100vh;padding:20px}
.box{background:rgba(255,255,255,0.03);border-radius:16px;padding:25px;max-width:420px;width:100%;text-align:center;border:1px solid rgba(255,255,255,0.06)}
h1{font-size:22px;background:linear-gradient(135deg,#667eea,#764ba2);-webkit-background-clip:text;-webkit-text-fill-color:transparent;margin:8px 0}
p{color:#888;font-size:12px;margin-bottom:15px}
.qr{background:#fff;padding:10px;border-radius:10px;display:inline-block;margin:10px 0}
.qr img{width:180px;height:180px}
.or{color:#444;margin:15px 0;font-size:11px}
input{width:100%;padding:12px;border-radius:8px;border:1px solid #333;background:rgba(255,255,255,0.04);color:#fff;font-size:15px;text-align:center;margin:8px 0;outline:none}
input:focus{border-color:#764ba2}
.btn{width:100%;padding:12px;border-radius:20px;border:none;font-size:14px;font-weight:600;cursor:pointer;margin:6px 0;color:#fff}
.btn1{background:linear-gradient(135deg,#667eea,#764ba2)}
.btn2{background:rgba(255,255,255,0.05);border:1px solid #333}
.codebox{background:rgba(118,75,162,0.12);border:2px solid #764ba2;border-radius:12px;padding:18px;margin:12px 0;display:none}
.code{font-size:42px;font-weight:bold;letter-spacing:12px;color:#764ba2;font-family:monospace}
.timer{color:#ff6b6b;font-size:12px;margin:5px 0}
.info{color:#aaa;font-size:11px;line-height:1.6;margin-top:8px}
.info b{color:#764ba2}
.badge{display:inline-block;padding:4px 14px;border-radius:15px;font-size:10px;margin:8px 0}
.b1{background:rgba(255,171,0,0.12);color:#ffab00;animation:pulse 1.5s infinite}
.b2{background:rgba(46,213,115,0.12);color:#2ed573}
@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.5}}
.foot{color:#444;font-size:10px;margin-top:12px}
</style></head>
<body>
<div class="box">
<div style="font-size:35px">🤖</div>
<h1>${BOT_NAME}</h1>
<p>WhatsApp Multi-Device Bot</p>
<span class="badge b1" id="badge">⏳ Waiting...</span>
<div class="qr" id="qrDiv"><img id="qrImg" src="" alt="QR"></div>
<div class="or">━━━ OR PAIR CODE ━━━</div>
<input type="tel" id="phone" placeholder="WhatsApp Number (91XXXXXXXXXX)">
<button class="btn btn1" id="btnGet" onclick="getCode()">🔑 GET PAIR CODE</button>
<div class="codebox" id="codeDiv">
<p style="color:#888;font-size:10px;letter-spacing:2px">PAIR CODE</p>
<div class="code" id="codeVal">--------</div>
<p class="timer" id="timerVal">⏰ 60 seconds</p>
<div class="info">📱 <b>WhatsApp</b> → <b>Linked Devices</b> → <b>Link with phone number</b><br>Number: <b id="showNum"></b><br>Code: shown above</div>
</div>
<button class="btn btn2" onclick="location.reload()">🔄 Refresh</button>
<div class="foot">👑 ${OWNER_NAME} | © ${BOT_NAME}</div>
</div>
<script>
let tmr;
async function ld(){try{const r=await fetch('/qr');const d=await r.json();if(d.qr)document.getElementById('qrImg').src=d.qr}catch(e){}}
async function st(){try{const r=await fetch('/status');const d=await r.json();if(d.on){document.getElementById('badge').textContent='🟢 Online';document.getElementById('badge').className='badge b2';document.getElementById('qrDiv').style.display='none'}}catch(e){}}
async function getCode(){
const ph=document.getElementById('phone').value.replace(/[^0-9]/g,'');
if(!ph||ph.length<10)return alert('Enter valid number!');
const btn=document.getElementById('btnGet');btn.textContent='⏳ Wait...';btn.disabled=true;
try{
const r=await fetch('/code?phone='+ph);const d=await r.json();
if(d.error){alert(d.error);btn.textContent='🔑 GET PAIR CODE';btn.disabled=false;return}
document.getElementById('codeVal').textContent=d.code;
document.getElementById('showNum').textContent='+'+ph;
document.getElementById('codeDiv').style.display='block';
document.getElementById('qrDiv').style.display='none';
let s=60;document.getElementById('timerVal').textContent='⏰ '+s+'s';
clearInterval(tmr);
tmr=setInterval(()=>{s--;document.getElementById('timerVal').textContent='⏰ '+s+'s';if(s<=0){clearInterval(tmr);document.getElementById('timerVal').textContent='❌ Expired';document.getElementById('codeVal').textContent='--------'}},1000);
btn.textContent='🔑 GET PAIR CODE';btn.disabled=false;
}catch(e){btn.textContent='🔑 GET PAIR CODE';btn.disabled=false}
}
setInterval(ld,8000);setInterval(st,4000);ld();st();
</script></body></html>`);
});

app.get('/qr', (req, res) => res.json({ qr: currentQR || null }));

app.get('/code', async (req, res) => {
    const phone = req.query.phone;
    if (!phone || phone.length < 10) return res.json({ error: 'Valid number required' });
    if (!sockInstance) return res.json({ error: 'Bot starting...' });
    if (!currentQR) return res.json({ error: 'QR not ready. Wait 10 seconds.' });
    if (pairingInProgress) return res.json({ error: 'Another code being generated. Wait.' });
    
    pairingInProgress = true;
    
    try {
        await new Promise(r => setTimeout(r, 2000));
        const code = await sockInstance.requestPairingCode(phone);
        console.log('PAIR CODE:', code, 'for', phone);
        pairingInProgress = false;
        return res.json({ code });
    } catch(e) {
        pairingInProgress = false;
        console.error('Pair error:', e.message);
        return res.json({ error: 'Failed. Make sure QR is visible, wait 15 seconds, then try.' });
    }
});

app.get('/status', (req, res) => res.json({ on: connected }));
app.listen(PORT, () => console.log('Server:', PORT));

const users = new Set();

async function start() {
    try {
        if (fs.existsSync('./session')) fs.removeSync('./session');
        
        const { state, saveCreds } = await useMultiFileAuthState('./session');
        const { version } = await fetchLatestBaileysVersion();
        console.log('Baileys v' + version);
        
        sockInstance = makeWASocket({
            version,
            logger: pino({ level: 'fatal' }),
            printQRInTerminal: true,
            auth: { creds: state.creds, keys: makeCacheableSignalKeyStore(state.keys, pino({ level: 'fatal' })) },
            browser: ['Ubuntu', 'Chrome', '20.0.0'],
            markOnlineOnConnect: true,
            msgRetryCounterCache,
            syncFullHistory: false,
            defaultQueryTimeoutMs: 120000
        });
        
        sockInstance.ev.on('connection.update', async (up) => {
            const { connection, lastDisconnect, qr } = up;
            if (qr) { 
                currentQR = await QRCode.toDataURL(qr); 
                console.log('✅ QR Ready - Pair code ready to use');
            }
            if (connection === 'close') {
                connected = false; currentQR = '';
                const code = lastDisconnect?.error?.output?.statusCode;
                setTimeout(start, code !== DisconnectReason.loggedOut ? 3000 : 2000);
            } else if (connection === 'open') { 
                connected = true; currentQR = ''; 
                console.log('✅ ZENIT X BOT CONNECTED!');
            }
        });
        
        sockInstance.ev.on('creds.update', saveCreds);
        
        sockInstance.ev.on('messages.upsert', async ({ messages }) => {
            const msg = messages[0];
            if (!msg.message || msg.key.fromMe) return;
            const chat = msg.key.remoteJid; users.add(chat);
            const text = msg.message.conversation || msg.message.extendedTextMessage?.text || '';
            if (text && text.startsWith(PREFIX)) {
                const cmd = text.slice(1).split(' ')[0].toLowerCase();
                const q = text.slice(cmd.length + 2);
                if (cmd === 'ping') await sockInstance.sendMessage(chat, { text: '🏓 Pong!' });
                else if (cmd === 'menu') await sockInstance.sendMessage(chat, { text: '🤖 ' + BOT_NAME + '\n👑 ' + OWNER_NAME + '\n\n.ping .alive .menu .truth .dare .joke .meme .waifu .neko .play' });
                else if (cmd === 'alive') await sockInstance.sendMessage(chat, { text: '🟢 ' + BOT_NAME + ' Online\n👥 Users: ' + users.size });
                else if (cmd === 'truth') await sockInstance.sendMessage(chat, { text: '🔮 ' + ['Biggest fear?','Ever lied?','First crush?','Secret talent?','Last cry?'][Math.floor(Math.random()*5)] });
                else if (cmd === 'dare') await sockInstance.sendMessage(chat, { text: '🎯 ' + ['Sing a song!','Send selfie!','Do 10 pushups!','Post status!','Dance 30 sec!'][Math.floor(Math.random()*5)] });
                else if (cmd === 'joke') { try { const r = await axios.get('https://v2.jokeapi.dev/joke/Any?type=single'); await sockInstance.sendMessage(chat, { text: '😂 ' + r.data.joke }); } catch(e) {} }
                else if (cmd === 'meme') { try { const r = await axios.get('https://meme-api.com/gimme'); await sockInstance.sendMessage(chat, { image: { url: r.data.url }, caption: r.data.title }); } catch(e) {} }
                else if (cmd === 'waifu') { try { const r = await axios.get('https://api.waifu.pics/sfw/waifu'); await sockInstance.sendMessage(chat, { image: { url: r.data.url }, caption: '💕' }); } catch(e) {} }
                else if (cmd === 'neko') { try { const r = await axios.get('https://api.waifu.pics/sfw/neko'); await sockInstance.sendMessage(chat, { image: { url: r.data.url }, caption: '🐱' }); } catch(e) {} }
                else if ((cmd === 'play' || cmd === 'song') && q) { try { const r = await yts(q); const v = r.videos[0]; if(v) await sockInstance.sendMessage(chat, { text: '🎵 ' + v.title + '\n⏱ ' + v.timestamp + '\n🔗 ' + v.url }); } catch(e) {} }
            }
        });
    } catch(e) { console.error(e); setTimeout(start, 5000); }
}
start();
