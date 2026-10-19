const express = require('express');
const cors = require('cors');
const { spawn } = require('child_process');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname)));

const ALLOWED = ['youtube.com','youtu.be','instagram.com','facebook.com','fb.watch','tiktok.com','twitter.com','x.com'];
function validUrl(u){
  try {
    const url = new URL(u);
    if (!['http:','https:'].includes(url.protocol)) return false;
    if (/localhost|127\.0\.0\.1|0\.0\.0\.0|::1/i.test(url.hostname)) return false;
    const host = url.hostname.replace(/^www\./,'');
    return ALLOWED.some(d => host === d || host.endsWith('.'+d));
  } catch { return false; }
}

// simple rate limit
const hits = new Map();
function rateLimit(req,res,next){
  const ip = req.ip; const now = Date.now();
  const arr = (hits.get(ip)||[]).filter(t=>now-t<60000);
  if (arr.length >= 20) return res.status(429).json({error:'Too many requests'});
  arr.push(now); hits.set(ip,arr); next();
}
app.use('/api', rateLimit);

app.post('/api/info', (req,res)=>{
  const { url } = req.body || {};
  if (!validUrl(url)) return res.status(400).json({error:'Unsupported or invalid URL'});
  const p = spawn('yt-dlp', ['-J','--no-warnings', url], { stdio: ['ignore','pipe','pipe'] });
  let out='', err='';
  p.stdout.on('data',d=>out+=d);
  p.stderr.on('data',d=>err+=d);
  p.on('close', code=>{
    if (code !== 0) return res.status(500).json({error: err.trim() || 'Failed to fetch info'});
    try {
      const info = JSON.parse(out);
      const formats = (info.formats||[]).filter(f=>f.vcodec!=='none'||f.acodec!=='none').map(f=>({
        id: f.format_id, label: f.format_note || f.resolution || (f.height? f.height+'p' : f.ext), ext: f.ext,
        hasVideo: f.vcodec!=='none', hasAudio: f.acodec!=='none', filesize: f.filesize||f.filesize_approx
      }));
      res.json({ title: info.title, thumbnail: info.thumbnail, duration: info.duration, formats });
    } catch { res.status(500).json({error:'Parse error'}); }
  });
});

app.get('/api/download', (req,res)=>{
  const { url, format } = req.query;
  if (!validUrl(url)) return res.status(400).send('Invalid URL');
  const args = ['-f', format || 'best', '--no-warnings', '-o', '-', url];
  const p = spawn('yt-dlp', args, { stdio: ['ignore','pipe','pipe'] });
  res.setHeader('Content-Disposition', 'attachment; filename="video.mp4"');
  res.setHeader('Content-Type', 'application/octet-stream');
  p.stdout.pipe(res);
  let err='';
  p.stderr.on('data',d=>err+=d);
  p.on('close', code=>{ if (code!==0) console.error(err); });
  req.on('close', ()=> p.kill());
});

app.listen(3000, ()=> console.log('BD Downloader server running on http://localhost:3000'));
