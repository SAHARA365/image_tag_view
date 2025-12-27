// server.js — リネーム機能追加済み・完全版
const express = require('express');
const fs = require('fs');
const path = require('path');
const cookieParser = require('cookie-parser');
const session = require('express-session');

const app = express();

// ▼▼▼ 設定エリア ▼▼▼
const MY_PASSWORD = '1hiedaAQ'; 
const SESSION_SECRET = 'secret_key_image_tag_view'; 
const METADATA_PATH = path.join(__dirname, 'metadata.json');
const IMAGES_DIR = path.join(__dirname, 'images'); 
// ▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲

// .avif 用 MIME
try {
  const m = require('mime');
  if (m?.define) m.define({ 'image/avif': ['avif'] }, true);
} catch { console.warn('[mime] init skipped'); }

// ---- metadata 構築 ----
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
        console.error(`[致命的エラー] 画像フォルダが見つかりません: ${IMAGES_DIR}`);
        return metadata;
    }

    const files = fs.readdirSync(IMAGES_DIR)
      .filter(n => /\.(avif|webp|jpe?g|png)$/i.test(n))
      .sort((a, b) => a.localeCompare(b, 'ja'));

    for (const key of Object.keys(metadata)) {
      if (!files.includes(key)) { delete metadata[key]; changed = true; }
    }
    for (const file of files) {
      if (!metadata[file]) {
        metadata[file] = { title: file, pages: [file], createdAt: fs.statSync(path.join(IMAGES_DIR, file)).mtimeMs, tags: [] };
        changed = true;
      }
      if (!metadata[file].tags) metadata[file].tags = [];
      const hasUntagged = metadata[file].tags.some(t => t.name === 'タグ未登録');
      const hasReal = metadata[file].tags.some(t => t.name !== 'タグ未登録');
      if (metadata[file].tags.length === 0) {
        metadata[file].tags.push({ name: 'タグ未登録', type: 'general' });
        changed = true;
      } else if (hasUntagged && hasReal) {
        metadata[file].tags = metadata[file].tags.filter(t => t.name !== 'タグ未登録');
        changed = true;
      }
    }
  } catch (e) { console.error('[metadata] build error:', e); }

  if (changed) fs.writeFileSync(METADATA_PATH, JSON.stringify(metadata, null, 2));
  return metadata;
}

// ===== ミドルウェア設定 =====
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(session({
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: { httpOnly: true } 
}));

// ===== 認証チェック関数 =====
const checkAuth = (req, res, next) => {
    if (req.session.isLoggedIn) {
        return next();
    }
    res.redirect('/login');
};

// ===== 認証不要エリア =====
app.get('/login', (req, res) => {
    const loginPage = path.join(__dirname, 'public/login.html');
    if (fs.existsSync(loginPage)) {
        res.sendFile(loginPage);
    } else {
        res.status(404).send('public/login.html が見つかりません');
    }
});

app.post('/login', (req, res) => {
    if (req.body.password === MY_PASSWORD) {
        req.session.isLoggedIn = true;
        req.session.save(() => res.redirect('/'));
    } else {
        res.redirect('/login?error=1');
    }
});

app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

app.get('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/login');
});

// ★★★ ここから認証必須 ★★★
app.use(checkAuth);

app.get('/api/metadata', (_req, res) => {
  res.set('Cache-Control', 'no-store');
  res.json({ ...loadMetadataWithPages() });
});

app.put('/api/metadata/:title', (req, res) => {
  const fileName = req.params.title;
  const { tags } = req.body;
  let metadata = loadMetadataWithPages();
  if (metadata[fileName]) {
     if (tags) {
        const hasReal = tags.some(t => t.name !== 'タグ未登録');
        metadata[fileName].tags = hasReal ? tags.filter(t => t.name !== 'タグ未登録') : tags;
     }
     fs.writeFileSync(METADATA_PATH, JSON.stringify(metadata, null, 2));
     res.json({ ok: true });
  } else {
     res.status(404).json({ ok: false });
  }
});

// ▼▼▼ 追加したリネームAPI ▼▼▼
app.post('/api/tags/rename', (req, res) => {
  const { oldName, newName } = req.body;
  if (!oldName || !newName) return res.status(400).json({ error: 'Invalid names' });

  let metadata = loadMetadataWithPages();
  let changedCount = 0;

  Object.values(metadata).forEach(item => {
    if (!item.tags) return;
    
    let itemChanged = false;
    item.tags = item.tags.map(tag => {
      const tName = typeof tag === 'string' ? tag : tag.name;
      const tType = typeof tag === 'string' ? 'general' : tag.type;

      if (tName === oldName) {
        itemChanged = true;
        return { name: newName, type: tType };
      }
      return tag;
    });

    if (itemChanged) changedCount++;
  });

  if (changedCount > 0) {
    fs.writeFileSync(METADATA_PATH, JSON.stringify(metadata, null, 2));
  }

  console.log(`[タグリネーム] ${oldName} -> ${newName} (${changedCount}件)`);
  res.json({ ok: true, count: changedCount });
});
// ▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲

app.get('/api/cover-image', (req, res) => {
  const fileName = String(req.query?.folder || req.query?.title || '');
  if (!fileName) return res.status(404).send('No Filename');

  const safeName = path.basename(fileName);
  const filePath = path.join(IMAGES_DIR, safeName);

  if (fs.existsSync(filePath)) {
      res.sendFile(filePath);
  } else {
      res.status(404).send('Not Found');
  }
});

app.use('/images', express.static(IMAGES_DIR));
app.use(express.static(path.join(__dirname, 'public')));

// サーバー起動
const PORT = process.env.PORT ? Number(process.env.PORT) : 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`\n===========================================`);
  console.log(`🚀 サーバー起動: http://localhost:${PORT}`);
  console.log(`📂 画像フォルダ: ${IMAGES_DIR}`);
  console.log(`===========================================\n`);
});