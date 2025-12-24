// server.js — 画像直置き（1枚絵管理）＆フォルダ分け不要の完全版 + ログイン機能
const express = require('express');
const fs = require('fs');
const path = require('path');
const cookieParser = require('cookie-parser');
// ★追加: セッション管理と認証ミドルウェア
const session = require('express-session');
const authMiddleware = require('./auth'); 

const app = express();

// ▼▼▼ 設定エリア ▼▼▼
// 好きなパスワードに変更してください
const MY_PASSWORD = '1hiedaAQ'; 
const SESSION_SECRET = 'secret_key_image_tag_view'; // 適当な文字列

const METADATA_PATH = path.join(__dirname, 'metadata.json');
const IMAGES_DIR = path.join(__dirname, 'images');
// ▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲

// .avif 用 MIME
try {
  const m = require('mime');
  if (m?.define) m.define({ 'image/avif': ['avif'] }, true);
} catch { console.warn('[mime] init skipped'); }

// ---- metadata 構築（変更なし）----
function loadMetadataWithPages() {
  let metadata = {};
  try {
    if (fs.existsSync(METADATA_PATH)) {
      metadata = JSON.parse(fs.readFileSync(METADATA_PATH, 'utf8') || '{}');
    }
  } catch { metadata = {}; }

  let changed = false;

  try {
    if (!fs.existsSync(IMAGES_DIR)) {
      console.warn(`[warn] images folder not found at: ${IMAGES_DIR}`);
      return metadata;
    }

    const files = fs.readdirSync(IMAGES_DIR)
      .filter(n => /\.(avif|webp|jpe?g|png)$/i.test(n))
      .sort((a, b) => a.localeCompare(b, 'ja'));

    for (const key of Object.keys(metadata)) {
      if (!files.includes(key)) {
        delete metadata[key];
        changed = true;
      }
    }

    for (const file of files) {
      const filePath = path.join(IMAGES_DIR, file);
      let stat;
      try { stat = fs.statSync(filePath); } catch { continue; }

      if (!metadata[file]) {
        metadata[file] = {
          title: file,
          pages: [file],
          createdAt: stat.mtimeMs,
          __sortMs: stat.mtimeMs + Math.random(),
          author: "",
          genre: [],
          tags: [],
          format: ""
        };
        changed = true;
      } else {
        if (metadata[file].createdAt !== stat.mtimeMs) {
          metadata[file].createdAt = stat.mtimeMs;
          changed = true;
        }
        if (!metadata[file].pages) {
          metadata[file].pages = [file];
          changed = true;
        }
      }
    }
  } catch (e) {
    console.error('[metadata] build error:', e);
  }

  if (changed) {
    try {
      fs.writeFileSync(METADATA_PATH, JSON.stringify(metadata, null, 2));
    } catch (e) {
      console.error('[metadata] Save failed:', e);
    }
  }

  return metadata;
}


// ===== ミドルウェア設定 =====
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// ★追加: セッション設定
app.use(session({
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: true
}));

// ===== ログイン・認証ルート（ここは認証なしでアクセス可能にする） =====

// ログイン画面の表示
app.get('/login', (req, res) => {
    res.sendFile(path.join(__dirname, 'public/login.html'));
});

// ログイン処理
app.post('/login', (req, res) => {
    if (req.body.password === MY_PASSWORD) {
        req.session.isLoggedIn = true;
        res.redirect('/');
    } else {
        res.redirect('/login?error=1');
    }
});

// ログアウト処理
app.get('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/login');
});


// ★重要: ここから下に認証ガードをかける
// これ以降に書かれた API や静的ファイルはログインしていないとアクセスできません
app.use(authMiddleware);


// ===== 以下、メイン機能（認証が必要） =====

// Health Check
app.get('/api/health', (req, res) => {
  res.set('Cache-Control', 'no-store');
  res.json({ status: 'ok', timestamp: Date.now() });
});

// Metadata返却
app.get('/api/metadata', (_req, res) => {
  res.set('Cache-Control', 'no-store');
  const data = loadMetadataWithPages();
  res.json({ __api: 'ok', __generatedAt: Date.now(), ...data });
});

// タグ更新 API
app.put('/api/metadata/:title', (req, res) => {
  const fileName = req.params.title;
  const { tags } = req.body;

  let metadata = {};
  if (fs.existsSync(METADATA_PATH)) {
    try {
      metadata = JSON.parse(fs.readFileSync(METADATA_PATH, 'utf8') || '{}');
    } catch { metadata = {}; }
  }

  if (!metadata[fileName]) {
    metadata[fileName] = { 
      title: fileName, pages: [fileName], 
      createdAt: Date.now(), tags: [] 
    };
  }

  if (tags !== undefined) metadata[fileName].tags = tags;

  try {
    fs.writeFileSync(METADATA_PATH, JSON.stringify(metadata, null, 2));
    res.json({ ok: true });
  } catch (e) {
    console.error('[metadata] Save failed:', e);
    res.status(500).json({ ok: false });
  }
});

// 画像URL取得用
app.get('/api/cover-image', (req, res) => {
  const fileName = String(req.query?.folder || req.query?.title || '');
  if (!fileName) return res.status(404).send('Not Found');

  const filePath = path.join(IMAGES_DIR, fileName);
  if (!fs.existsSync(filePath)) {
    return res.status(404).send('Not Found');
  }

  const url = `/images/${encodeURIComponent(fileName)}`;
  res.redirect(302, url);
});

// 画像配信
app.use('/images', express.static(IMAGES_DIR, {
  setHeaders(res) { res.set('Cache-Control', 'public, max-age=3600, must-revalidate'); }
}));

// 静的ファイル（HTML/JS）
// ※ publicフォルダの中身も認証が必要になります
app.use(express.static(path.join(__dirname, 'public'), {
  setHeaders(res, filePath) {
    if (path.basename(filePath) === 'metadata.json') {
      res.setHeader('Cache-Control', 'no-store');
    } else {
      res.setHeader('Cache-Control', 'public, max-age=3600, must-revalidate');
    }
  }
}));

// サーバー起動
function getLocalIp() {
  const os = require('os');
  const nics = os.networkInterfaces();
  for (const nic of Object.values(nics)) {
    for (const iface of nic || []) {
      if (iface && iface.family === 'IPv4' && !iface.internal && !iface.address.startsWith('169.254')) {
        return iface.address;
      }
    }
  }
  return 'localhost';
}
const ip = getLocalIp();
const PORT = process.env.PORT ? Number(process.env.PORT) : 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server running at: http://${ip}:${PORT}/`);
  console.log(`   (Monitoring images at: ${IMAGES_DIR})`);
});