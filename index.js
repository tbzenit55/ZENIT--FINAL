const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion, makeCacheableSignalKeyStore } = require('@whiskeysockets/baileys');
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
app.use(express.json());
const msgRetryCounterCache = new NodeCache();

let currentQR = '';
let botConnected = false;
let sockInstance = null;

// ═══════════════════ WEB PAGE ═══════════════════
app.get('/', (req, res) => {
    res.send(`<!DOCTYPE html>
<html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>${CONFIG.BOT_NAME}</title>
<meta http-equiv="refresh" content="120">
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:'Segoe UI',sans-serif;background:#0a0a14;color:#fff;min-height:100vh;display:flex;justify-content:center;align-items:center;padding:20px}
.card{background:rgba(255,255,255,0.03);border-radius:20px;padding:30px;max-width:420px;width:100%;text-align:center;border:1px solid rgba(255,255,255,0.06);box-shadow:0 8px 32px rgba(0,0,0,0.4)}
h1{font-size:24px;background:linear-gradient(135deg,#667eea,#764ba2);-webkit-background-clip:text;-webkit-text-fill-color:transparent;margin:10px 0}
.subtitle{color:#777;font-size:12px;margin-bottom:20px}
.qr-box{background:#fff;padding:12px;border-radius:12px;display:inline-block;margin:10px 0}
#qrImg{width:180px;height:180px}
.separator{color:#444;margin:20px 0;font-size:12px}
.separator::before,.separator::after{content:' ─── '}
input{width:100%;padding:14px;border-radius:10px;border:1px solid #333;background:rgba(255,255,255,0.04);color:#fff;font-size:16px;text-align:center;margin:10px 0;outline:none;letter-spacing:1px}
input:focus{border-color:#764ba2}
.btn{width:100%;padding:14px;border-radius:25px;border:none;font-size:15px;font-weight:600;cursor:pointer;margin:8px 0;color:#fff;transition:all 0.2s}
.btn-primary{background:linear-gradient(135deg,#667eea,#764ba2)}
.btn-primary:disabled{opacity:0.5}
.btn-secondary{background:rgba(255,255,255,0.05);border:1px solid #333}
.code-box{background:rgba(118,75,162,0.12);border:2px solid #764ba2;border-radius:15px;padding:20px;margin:15px 0;display:none}
.code{font-size:44px;font-weight:bold;letter-spacing:12px;color:#764ba2;font-family:'Courier New',monospace;text-shadow:0 0 20px rgba(118,75,162,0.4)}
.timer{color:#ff6b6b;font-size:13px;margin:8px 0}
.info{color:#aaa;font-size:12px;line-height:1.8;margin-top:10px}
.info b{color:#764ba2}
.badge{display:inline-block;padding:5px 16px;border-radius:20px;font-size:11px;margin:10px 0;font-weight:600}
.badge-wait{background:rgba(255,171,0,0.12);color:#ffab00;animation:glow 1.5s infinite}
.badge-on{background:rgba(46,213,115,0.12);color:#2ed573}
@keyframes glow{0%,100%{opacity:1}50%{opacity:0.5}}
.steps{text-align:left;margin:15px 0;padding:15px;background:rgba(255,255,255,0.02);border-radius:10px;font-size:12px}
.steps ol{padding-left:20px}
.steps li{margin:5px 0;color:#bbb}
.footer{color:#444;font-size:10px;margin-top:15px}
</style></head>
<body>
<div class="card">
<div style="font-size:40px">🤖</div>
<h1>${CONFIG.BOT_NAME}</h1>
<p class="subtitle">WhatsApp Multi-Device Bot</p>

<span class="badge badge-wait" id="statusBadge">⏳ Waiting...</span>

<div class="qr-box" id="qrDiv">
    <img id="qrImg" src="" alt="QR Code">
    <p style="color:#888;font-size:10px;margin-top:5px">Scan with WhatsApp</p>
</div>

<div class="separator">OR USE PAIR CODE</div>

<input type="tel" id="phoneInput" placeholder="Enter WhatsApp Number (91XXXXXXXXXX)">
<button class="btn btn-primary" id="getCodeBtn" onclick="getPairCode()">🔑 GET PAIR CODE</button>

<div class="code-box" id="codeDiv">
    <p style="color:#888;font-size:10px;letter-spacing:3px;margin-bottom:8px">YOUR PAIR CODE</p>
    <div class="code" id="pairCodeDisplay">--------</div>
    <p class="timer" id="timerText">⏰ Valid for 60 seconds</p>
    <div class="info">
        📱 Open <b>WhatsApp</b><br>
        → <b>Linked Devices</b><br>
        → <b>Link with phone number</b><br>
        → Enter number: <b id="showNumber">+91XXXXXXXXXX</b><br>
        → Enter code shown above
    </div>
</div>

<button class="btn btn-secondary" onclick="location.reload()">🔄 Refresh Page</button>

<div class="steps">
    <strong>📋 How to Connect:</strong>
    <ol>
        <li>Scan <b>QR code</b> (Recommended) <b>OR</b></li>
        <li>Enter your <b>WhatsApp number</b></li>
        <li>Click <b>GET PAIR CODE</b></li>
        <li>Open WhatsApp → <b>Linked Devices</b></li>
        <li>Tap <b>"Link with phone number"</b></li>
        <li>Enter your <b>number + code</b></li>
    </ol>
</div>

<div class="footer">👑 ${CONFIG.OWNER_NAME} | © 2025 ${CONFIG.BOT_NAME}</div>
</div>

<script>
let countdownInterval;

async function loadQR(){
    try{
        const r=await fetch('/qr');
        const d=await r.json();
        if(d.qr){
            document.getElementById('qrImg').src=d.qr;
            document.getElementById('statusBadge').textContent='📱 Ready to Connect';
        }
    }catch(e){}
}

async function checkStatus(){
    try{
        const r=await fetch('/status');
        const d=await r.json();
        if(d.connected){
            document.getElementById('statusBadge').textContent='🟢 Bot Online';
            document.getElementById('statusBadge').className='badge badge-on';
            document.getElementById('qrDiv').style.display='none';
        }
    }catch(e){}
}

async function getPairCode(){
    const phone=document.getElementById('phoneInput').value.replace(/[^0-9]/g,'');
    if(!phone||phone.length<10) return alert('❌ Enter valid WhatsApp number with country code!');
    
    const btn=document.getElementById('getCodeBtn');
    btn.textContent='⏳ Generating...';
    btn.disabled=true;
    
    try{
        const r=await fetch('/request-pair?phone='+phone);
        const d=await r.json();
        
        if(d.error){
            alert('❌ '+d.error);
            btn.textContent='🔑 GET PAIR CODE';
            btn.disabled=false;
            return;
        }
        
        document.getElementById('pairCodeDisplay').textContent=d.code;
        document.getElementById('showNumber').textContent='+'+phone;
        document.getElementById('codeDiv').style.display='block';
        document.getElementById('qrDiv').style.display='none';
        document.getElementById('statusBadge').textContent='🔑 Enter Code in WhatsApp';
        
        let sec=60;
        document.getElementById('timerText').textContent='⏰ Valid for '+sec+' seconds';
        clearInterval(countdownInterval);
        countdownInterval=setInterval(()=>{
            sec--;
            document.getElementById('timerText').textContent='⏰ Valid for '+sec+' seconds';
            if(sec<=0){
                clearInterval(countdownInterval);
                document.getElementById('timerText').textContent='❌ Code expired! Get new code';
                document.getElementById('pairCodeDisplay').textContent='--------';
            }
        },1000);
        
        btn.textContent='🔑 GET PAIR CODE';
        btn.disabled=false;
    }catch(e){
        btn.textContent='🔑 GET PAIR CODE';
        btn.disabled=false;
        alert('❌ Server error. Please try again.');
    }
}

setInterval(loadQR,10000);
setInterval(checkStatus,5000);
loadQR();
checkStatus();
</script></body></html>`);
});

// ═══════════════════ API ═══════════════════
app.get('/qr', (req, res) => {
    res.json({ qr: currentQR || null });
});

app.get('/request-pair', async (req, res) => {
    const phone = req.query.phone;
    
    if (!phone || phone.length < 10) {
        return res.json({ error: 'Enter valid phone number with country code (e.g., 91XXXXXXXXXX)' });
    }
    
    if (!sockInstance) {
        return res.json({ error: 'Bot is starting. Please wait 15 seconds and try again.' });
    }
    
    if (botConnected) {
        return res.json({ error: 'Bot is already connected! No need for pair code.' });
    }
    
    if (!currentQR) {
        return res.json({ error: 'QR code not ready yet. Wait for QR to appear on page first.' });
    }
    
    try {
        const code = await sockInstance.requestPairingCode(phone);
        console.log(`✅ Pair Code for +${phone}: ${code}`);
        return res.json({ code: code, phone: phone });
    } catch(e) {
        console.error('Pair error:', e.message);
        return res.json({ error: 'Failed to generate code. Make sure QR is visible on page, then wait 10 seconds and try again.' });
    }
});

app.get('/status', (req, res) => {
    res.json({ connected: botConnected, users: users.size });
});

app.listen(CONFIG.PORT, () => console.log(`🌐 Web: ${CONFIG.PORT}`));

// ═══════════════════ BOT ═══════════════════
const users = new Set();
const blockedUsers = new Set();

async function handleCommand(sock, msg, chat, text) {
    const args = text.slice(CONFIG.PREFIX.length).trim().split(/ +/);
    const cmd = args[0].toLowerCase();
    const q = args.slice(1).join(' ');
    const isOwner = msg.key.remoteJid === CONFIG.OWNER_NUMBER;
    const isGroup = chat.endsWith('@g.us');
    if (blockedUsers.has(msg.key.participant || chat)) return;

    try {
        switch(cmd) {
            case 'menu': case 'help':
                await sock.sendMessage(chat, { text: `🤖 *${CONFIG.BOT_NAME}*\n👑 ${CONFIG.OWNER_NAME}\n⚡ Prefix: ${CONFIG.PREFIX}\n\n📥 DOWNLOAD\n${CONFIG.PREFIX}play .tiktok .instagram .facebook\n\n🎮 FUN\n${CONFIG.PREFIX}truth .dare .joke .meme .quote .toss .roll\n\n🎨 ANIME\n${CONFIG.PREFIX}waifu .neko .anime\n\n🛠 UTILITY\n${CONFIG.PREFIX}ping .alive .calc .translate .weather .wiki .qr\n\n🖼 MEDIA\n${CONFIG.PREFIX}sticker .toimg\n\n👥 GROUP\n${CONFIG.PREFIX}tagall .hidetag\n\n👑 OWNER\n${CONFIG.PREFIX}broadcast .restart` });
                break;
            case 'ping':
                const start = Date.now();
                await sock.sendMessage(chat, { text: `🏓 Pong! ${Date.now()-start}ms` });
                break;
            case 'alive':
                const up = process.uptime();
                await sock.sendMessage(chat, { text: `🟢 ${CONFIG.BOT_NAME} Alive!\n⏰ ${Math.floor(up/3600)}h ${Math.floor((up%3600)/60)}m\n👥 ${users.size} users` });
                break;
            case 'truth':
                const t = ['Biggest fear? 😨','Ever lied to best friend? 🤥','Most embarrassing moment? 😳','First crush name? 💕','Secret talent? 🤫'];
                await sock.sendMessage(chat, { text: `🔮 ${t[Math.floor(Math.random()*t.length)]}` });
                break;
            case 'dare':
                const d = ['Send voice note singing! 🎤','Change DP to meme for 1hr! 📸','Send selfie right now! 🤳','Post status: I ❤️ ZENIT X BOT 📢','Do 10 pushups! 💪'];
                await sock.sendMessage(chat, { text: `🎯 ${d[Math.floor(Math.random()*d.length)]}` });
                break;
            case 'joke':
                try{const r=await axios.get('https://v2.jokeapi.dev/joke/Any?type=single');await sock.sendMessage(chat,{text:`😂 ${r.data.joke}`});}catch(e){await sock.sendMessage(chat,{text:'😂 Light attracts bugs!'});}
                break;
            case 'meme':
                try{const r=await axios.get('https://meme-api.com/gimme');await sock.sendMessage(chat,{image:{url:r.data.url},caption:r.data.title});}catch(e){}
                break;
            case 'quote':
                try{const r=await axios.get('https://api.quotable.io/random');await sock.sendMessage(chat,{text:`💭 "${r.data.content}" — ${r.data.author}`});}catch(e){}
                break;
            case 'toss':await sock.sendMessage(chat,{text:Math.random()<0.5?'🪙 Heads!':'🪙 Tails!'});break;
            case 'roll':await sock.sendMessage(chat,{text:`🎲 ${Math.floor(Math.random()*6)+1}`});break;
            case 'play': case 'song':
                if(!q)return;
                try{const r=await yts(q);const v=r.videos[0];if(v)await sock.sendMessage(chat,{text:`🎵 *${v.title}*\n⏱ ${v.timestamp}\n👁 ${v.views}\n🔗 ${v.url}`});}catch(e){}
                break;
            case 'tiktok':
                if(!q)return;
                try{const r=await axios.get('https://api.akuari.my.id/downloader/tiktok?link='+q);if(r.data.status)await sock.sendMessage(chat,{video:{url:r.data.result.nowm},caption:'✅ '+CONFIG.BOT_NAME});}catch(e){}
                break;
            case 'instagram':
                if(!q)return;
                try{const r=await axios.get('https://api.akuari.my.id/downloader/instagram?link='+q);if(r.data.status)await sock.sendMessage(chat,{video:{url:r.data.result.url},caption:'✅ '+CONFIG.BOT_NAME});}catch(e){}
                break;
            case 'facebook':
                if(!q)return;
                try{const r=await axios.get('https://api.akuari.my.id/downloader/facebook?link='+q);if(r.data.status)await sock.sendMessage(chat,{video:{url:r.data.result.hd},caption:'✅ '+CONFIG.BOT_NAME});}catch(e){}
                break;
            case 'waifu':
                try{const r=await axios.get('https://api.waifu.pics/sfw/waifu');await sock.sendMessage(chat,{image:{url:r.data.url},caption:'💕 Waifu'});}catch(e){}
                break;
            case 'neko':
                try{const r=await axios.get('https://api.waifu.pics/sfw/neko');await sock.sendMessage(chat,{image:{url:r.data.url},caption:'🐱 Neko'});}catch(e){}
                break;
            case 'anime':
                if(!q)return;
                try{const r=await axios.get('https://api.jikan.moe/v4/anime?q='+q+'&limit=1');const a=r.data.data[0];if(a)await sock.sendMessage(chat,{image:{url:a.images.jpg.large_image_url},caption:'🎬 '+a.title+'\\n⭐ '+a.score});}catch(e){}
                break;
            case 'calc':
                if(!q)return;
                try{await sock.sendMessage(chat,{text:'🧮 '+eval(q)});}catch(e){}
                break;
            case 'translate':
                if(!q)return;
                try{const r=await axios.get('https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=en&dt=t&q='+encodeURIComponent(q));await sock.sendMessage(chat,{text:'🌐 '+r.data[0][0][0]});}catch(e){}
                break;
            case 'weather':if(!q)return;await sock.sendMessage(chat,{text:'🌤 https://wttr.in/'+q});break;
            case 'wiki':
                if(!q)return;
                try{const r=await axios.get('https://en.wikipedia.org/api/rest_v1/page/summary/'+encodeURIComponent(q));await sock.sendMessage(chat,{text:'📚 '+r.data.extract});}catch(e){}
                break;
            case 'qr':
                if(!q)return;
                try{const b=await QRCode.toBuffer(q);await sock.sendMessage(chat,{image:b});}catch(e){}
                break;
            case 'sticker':
                if(msg.message?.imageMessage||msg.message?.videoMessage){try{const m=await sock.downloadMediaMessage(msg);await sock.sendMessage(chat,{sticker:m});}catch(e){}}
                break;
            case 'toimg':
                if(msg.message?.stickerMessage){try{const m=await sock.downloadMediaMessage(msg);await sock.sendMessage(chat,{image:m});}catch(e){}}
                break;
            case 'tagall':
                if(!isGroup)return;
                try{const meta=await sock.groupMetadata(chat);await sock.sendMessage(chat,{text:q||'🔔 Everyone!',mentions:meta.participants.map(p=>p.id)});}catch(e){}
                break;
            case 'hidetag':
                if(!isGroup)return;
                try{const meta=await sock.groupMetadata(chat);await sock.sendMessage(chat,{text:q||'🔔',mentions:meta.participants.map(p=>p.id)});}catch(e){}
                break;
            case 'broadcast':
                if(!isOwner||!q)return;
                let s=0;for(let u of users){try{await sock.sendMessage(u,{text:'📢 *'+CONFIG.BOT_NAME+'*\n\n'+q});s++;await new Promise(r=>setTimeout(r,300));}catch(e){}}await sock.sendMessage(chat,{text:'✅ Sent to '+s+'/'+users.size});
                break;
            case 'restart':if(!isOwner)return;await sock.sendMessage(chat,{text:'🔄 Restarting...'});process.exit(0);
        }
    } catch(e) {}
}

// ═══════════════════ START ═══════════════════
async function startBot() {
    if (fs.existsSync('./session')) {
        fs.removeSync('./session');
    }
    
    const { state, saveCreds } = await useMultiFileAuthState('./session');
    const { version } = await fetchLatestBaileysVersion();
    
    console.log('Baileys v' + version);
    
    const sock = makeWASocket({
        version: [2, 3000, 1015901307],
        logger: pino({ level: 'silent' }),
        printQRInTerminal: true,
        auth: state,
        browser: ['Chrome (Linux)', '', ''],
        markOnlineOnConnect: true,
        msgRetryCounterCache,
        syncFullHistory: false,
        defaultQueryTimeoutMs: undefined
    });
    
    sockInstance = sock;
    
    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;
        
        if (qr) {
            currentQR = await QRCode.toDataURL(qr);
            console.log('✅ QR Ready');
        }
        
        if (connection === 'close') {
            const code = lastDisconnect?.error?.output?.statusCode;
            botConnected = false;
            currentQR = '';
            console.log('Closed:', code);
            
            if (code !== DisconnectReason.loggedOut) {
                setTimeout(startBot, 3000);
            } else {
                if (fs.existsSync('./session')) fs.removeSync('./session');
                setTimeout(startBot, 2000);
            }
        } else if (connection === 'open') {
            botConnected = true;
            currentQR = '';
            console.log('✅ CONNECTED!');
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
                    msg.message.imageMessage?.caption ||
                    msg.message.videoMessage?.caption || '';
        
        if (text && text.startsWith(CONFIG.PREFIX)) {
            await handleCommand(sock, msg, chat, text);
        }
    });
}

startBot().catch(err => {
    console.error('Error:', err.message);
    setTimeout(startBot, 5000);
});
