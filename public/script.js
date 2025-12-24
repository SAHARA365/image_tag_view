let allData = [];
let displayData = [];
let currentItem = null;

// 設定
let currentPage = 1;
const ITEMS_PER_PAGE = 50;
let currentSortMode = 'date-desc';

// 選択モード用
let isSelectionMode = false;
let selectedItems = new Set(); 

// タグ設定
const TAG_ORDER = ['copyright', 'character', 'artist', 'general', 'meta', 'size'];
const TAG_LABELS = { copyright: '作品名', character: 'キャラ', artist: '絵師', general: '一般', meta: 'メタ', size: 'サイズ' };

window.onload = async () => {
  await loadData();
  updateTagList();
  
  if (window.location.hash.startsWith('#post=')) {
    handleHashChange();
  } else {
    applyFilterAndSort();
  }
};

window.onpopstate = () => handleHashChange();

function handleHashChange() {
  const hash = window.location.hash;
  if (hash.startsWith('#post=')) {
    const title = decodeURIComponent(hash.replace('#post=', ''));
    const item = allData.find(d => d.title === title);
    if (item) renderPostView(item);
  } else {
    renderGalleryView();
  }
}

async function loadData() {
  try {
    const res = await fetch('/api/metadata');
    const data = await res.json();
    allData = Object.values(data)
      .filter(item => item && typeof item === 'object' && item.title)
      .sort((a, b) => b.createdAt - a.createdAt);
    displayData = [...allData];
  } catch (e) { console.error(e); }
}

// ----------------------------------------------------
// 選択モード・一括操作
// ----------------------------------------------------

function toggleSelectionMode() {
  // 1. フラグを反転
  isSelectionMode = !isSelectionMode;
  selectedItems.clear();
  
  const btn = document.getElementById('mode-btn');
  const controls = document.getElementById('bulk-controls');

  // 2. 状態に合わせて表示/非表示を切り替え
  if (isSelectionMode) {
    btn.classList.add('active');
    btn.innerText = "☑ 終了";
    // ★ここで確実に表示
    if(controls) controls.style.display = 'flex'; 
  } else {
    btn.classList.remove('active');
    btn.innerText = "☑ 選択モード";
    // ★ここで確実に非表示
    if(controls) controls.style.display = 'none';
  }
  
  const countSpan = document.getElementById('selected-count');
  if(countSpan) countSpan.innerText = "0枚";

  // 3. 最後にギャラリー（画像枠線など）を更新
  renderGalleryView();
}

function toggleItemSelection(title) {
  if (selectedItems.has(title)) {
    selectedItems.delete(title);
  } else {
    selectedItems.add(title);
  }
  updateBulkPanel();
  renderGalleryView();
}

function updateBulkPanel() {
  const countSpan = document.getElementById('selected-count');
  if (countSpan) {
    countSpan.innerText = `${selectedItems.size}枚`;
  }
}

function cancelSelection() {
  selectedItems.clear();
  updateBulkPanel();
  renderGalleryView();
}

async function applyBulkTag() {
  const nameInput = document.getElementById('bulk-tag-name');
  const typeInput = document.getElementById('bulk-tag-type');
  const tagName = nameInput.value.trim();
  const tagType = typeInput.value;

  if (!tagName || selectedItems.size === 0) return;

  // ▼▼▼ 修正：確認ダイアログ（confirm）を削除しました ▼▼▼
  // if (!confirm(...)) return;  <-- この行を消しました
  // ▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲

  for (const title of selectedItems) {
    const item = allData.find(d => d.title === title);
    if (!item) continue;
    
    const currentTags = (item.tags || []).map(t => typeof t === 'string' ? t : t.name);
    if (!currentTags.includes(tagName)) {
      const newTags = (item.tags || []).map(t => typeof t === 'string' ? { name: t, type: 'general' } : t);
      newTags.push({ name: tagName, type: tagType });
      item.tags = newTags;
      await saveMetadata(item);
    }
  }

  // 完了メッセージ（もしこれも邪魔なら alert の行を消してください）
  alert('完了しました！');
  
  nameInput.value = '';
  selectedItems.clear(); // 選択解除
  updateBulkPanel();
  renderGalleryView();
  updateTagList();
}

// ----------------------------------------------------
// コアロジック
// ----------------------------------------------------

function applyFilterAndSort() {
  const keyword = document.getElementById('search').value.toLowerCase();
  const sortMode = document.getElementById('sort-select').value;

  let filtered = allData.filter(item => {
    const tagString = (item.tags || []).map(t => typeof t === 'string' ? t : t.name).join(' ');
    const text = (item.title + ' ' + tagString).toLowerCase();
    return text.includes(keyword);
  });

  if (sortMode === 'date-desc') filtered.sort((a, b) => b.createdAt - a.createdAt);
  else if (sortMode === 'date-asc') filtered.sort((a, b) => a.createdAt - b.createdAt);
  else if (sortMode === 'name-asc') filtered.sort((a, b) => a.title.localeCompare(b.title));
  else if (sortMode === 'random') filtered.sort(() => Math.random() - 0.5);

  displayData = filtered;
  currentPage = 1;
  renderGalleryView();
}

function changeSort() { applyFilterAndSort(); }
function filterImages() { applyFilterAndSort(); }
function searchTag(tagName) {
  document.getElementById('search').value = tagName;
  if (window.location.hash) history.pushState(null, null, ' ');
  applyFilterAndSort();
}

function changePage(delta) {
  const maxPage = Math.ceil(displayData.length / ITEMS_PER_PAGE) || 1;
  const nextPage = currentPage + delta;
  if (nextPage >= 1 && nextPage <= maxPage) {
    currentPage = nextPage;
    renderGalleryView();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
}

// ----------------------------------------------------
// 表示関連
// ----------------------------------------------------

function showGallery() {
  if (window.location.hash) history.pushState(null, null, ' ');
  renderGalleryView();
}

function renderGalleryView() {
  document.getElementById('post-view').classList.remove('active');
  document.getElementById('gallery-view').style.display = 'grid';
  document.getElementById('toolbar').style.display = 'flex';
  
  const pgContainer = document.getElementById('pagination-container');
  if(pgContainer) pgContainer.style.display = 'flex';
  
  // ▼▼▼ ★復活させる部分★ ▼▼▼
  // 画面を描き直すたびに、選択モードなら強制的に「表示」、違うなら「非表示」にします。
  // これで確実に状態が維持されます。
  const bulkControls = document.getElementById('bulk-controls');
  if (bulkControls) {
      bulkControls.style.display = isSelectionMode ? 'flex' : 'none';
  }
  // ▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲▲

  const container = document.getElementById('gallery-view');
  container.innerHTML = '';

  const start = (currentPage - 1) * ITEMS_PER_PAGE;
  const end = start + ITEMS_PER_PAGE;
  const pageItems = displayData.slice(start, end);

  document.getElementById('page-info').innerText = `Page ${currentPage} / ${Math.ceil(displayData.length / ITEMS_PER_PAGE) || 1} (${displayData.length} items)`;

  pageItems.forEach(item => {
    const div = document.createElement('div');
    div.className = 'thumb-card';
    
    if (selectedItems.has(item.title)) {
      div.classList.add('selected');
    }

    const imgUrl = `/api/cover-image?folder=${encodeURIComponent(item.title)}`;
    div.innerHTML = `<img src="${imgUrl}" loading="lazy">`;
    
    div.onclick = () => {
      if (isSelectionMode) {
        toggleItemSelection(item.title);
      } else {
        openPost(item);
      }
    };
    
    container.appendChild(div);
  });
}

function openPost(item) {
  history.pushState({ id: item.title }, '', `#post=${encodeURIComponent(item.title)}`);
  renderPostView(item);
}

function renderPostView(item) {
  currentItem = item;
  document.getElementById('gallery-view').style.display = 'none';
  document.getElementById('toolbar').style.display = 'none';
  
  const pgContainer = document.getElementById('pagination-container');
  if(pgContainer) pgContainer.style.display = 'none';
  
  const postView = document.getElementById('post-view');
  postView.classList.add('active');

  const imgUrl = `/api/cover-image?folder=${encodeURIComponent(item.title)}`;
  const mainImg = document.getElementById('main-image');
  mainImg.src = imgUrl;
  mainImg.onclick = () => window.open(imgUrl, '_blank');
  mainImg.style.cursor = "zoom-in";

  document.getElementById('image-title').innerText = item.title;
  document.getElementById('info-id').innerText = item.title;
  document.getElementById('info-date').innerText = new Date(item.createdAt).toLocaleDateString();

  renderSidebarTags(item);
}

// ----------------------------------------------------
// タグ管理関連
// ----------------------------------------------------

function renderSidebarTags(item) {
  const container = document.getElementById('tag-container');
  container.innerHTML = '';
  const normalizedTags = (item.tags || []).map(t => typeof t === 'string' ? { name: t, type: 'general' } : t);
  const groups = { copyright: [], character: [], artist: [], general: [], meta: [], size: [] };
  
  normalizedTags.forEach(t => {
    const type = groups[t.type] ? t.type : 'general';
    groups[type].push(t);
  });

  TAG_ORDER.forEach(type => {
    if (groups[type].length === 0) return;
    const section = document.createElement('div');
    section.className = 'tag-section';
    section.innerHTML = `<h4>${TAG_LABELS[type]}</h4>`;
    const ul = document.createElement('ul');
    ul.className = 'tag-list';
    
    groups[type].forEach(tagObj => {
      let count = 0;
      allData.forEach(d => {
        const dTags = (d.tags || []).map(dt => typeof dt === 'string' ? dt : dt.name);
        if (dTags.includes(tagObj.name)) count++;
      });
      const li = document.createElement('li');
      li.innerHTML = `
        <a href="#" class="tag-link type-${type}" onclick="searchTag('${tagObj.name}'); return false;">
          ? ${tagObj.name} <span style="color:#888; font-size:0.8em;">(${count})</span>
        </a>
        <span class="remove-btn" onclick="removeTag('${tagObj.name}')">×</span>
      `;
      ul.appendChild(li);
    });
    section.appendChild(ul);
    container.appendChild(section);
  });
}

async function addCurrentTag() {
  const nameInput = document.getElementById('new-tag-name');
  const typeInput = document.getElementById('new-tag-type');
  const name = nameInput.value.trim();
  const type = typeInput.value;
  if (!name || !currentItem) return;

  const currentTags = (currentItem.tags || []).map(t => typeof t === 'string' ? t : t.name);
  if (currentTags.includes(name)) { alert('既に登録されています'); return; }

  const newTags = (currentItem.tags || []).map(t => typeof t === 'string' ? { name: t, type: 'general' } : t);
  newTags.push({ name: name, type: type });
  currentItem.tags = newTags;
  
  await saveMetadata(currentItem);
  renderSidebarTags(currentItem);
  updateTagList();
  nameInput.value = '';
}

async function removeTag(tagName) {
  if (!currentItem) return;
  currentItem.tags = (currentItem.tags || []).filter(t => {
    const tName = typeof t === 'string' ? t : t.name;
    return tName !== tagName;
  });
  await saveMetadata(currentItem);
  renderSidebarTags(currentItem);
}

async function saveMetadata(item) {
  await fetch(`/api/metadata/${encodeURIComponent(item.title)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tags: item.tags })
  });
}

function updateTagList() {
  const tagCounts = {};
  allData.forEach(item => {
    (item.tags || []).forEach(t => {
      const tagName = typeof t === 'string' ? t : t.name;
      tagCounts[tagName] = (tagCounts[tagName] || 0) + 1;
    });
  });
  const datalist = document.getElementById('tag-suggestions');
  datalist.innerHTML = '';
  Object.keys(tagCounts).sort().forEach(tag => {
    const option = document.createElement('option');
    option.value = tag;
    option.label = `${tag} (${tagCounts[tag]})`;
    datalist.appendChild(option);
  });
}

// ▼▼▼ 新規追加：ページ内全選択 ▼▼▼
function selectAllInPage() {
  // 現在表示中のページの範囲を計算
  const start = (currentPage - 1) * ITEMS_PER_PAGE;
  const end = start + ITEMS_PER_PAGE;
  const pageItems = displayData.slice(start, end);
  
  // そのページのアイテムだけを選択状態に追加
  pageItems.forEach(item => selectedItems.add(item.title));
  
  updateBulkPanel();
  renderGalleryView();
}

// ▼▼▼ 新規追加：全解除 ▼▼▼
function deselectAll() {
  selectedItems.clear();
  updateBulkPanel();
  renderGalleryView();
}

// ▼▼▼ 修正：タグ追加（選択維持＆アラート削除） ▼▼▼
async function applyBulkTag() {
  const nameInput = document.getElementById('bulk-tag-name');
  const typeInput = document.getElementById('bulk-tag-type');
  const tagName = nameInput.value.trim();
  const tagType = typeInput.value;

  if (!tagName || selectedItems.size === 0) return;

  // 確認ダイアログなし
  
  for (const title of selectedItems) {
    const item = allData.find(d => d.title === title);
    if (!item) continue;
    
    const currentTags = (item.tags || []).map(t => typeof t === 'string' ? t : t.name);
    if (!currentTags.includes(tagName)) {
      const newTags = (item.tags || []).map(t => typeof t === 'string' ? { name: t, type: 'general' } : t);
      newTags.push({ name: tagName, type: tagType });
      item.tags = newTags;
      await saveMetadata(item);
    }
  }

  // ★変更点：完了アラート削除、選択解除（clear）もしない
  // alert('完了しました！'); // ← 削除
  
  nameInput.value = '';
  // selectedItems.clear(); // ← 削除（選択状態をキープ！）
  
  updateBulkPanel();
  renderGalleryView(); // 枠線はそのままで、内部データ（タグ）だけ更新された状態を表示
  updateTagList();
  
  // 入力欄にフォーカスを戻して、すぐ次のタグを打てるようにする
  nameInput.focus();
}

// ※古い cancelSelection 関数がもし残っていても、ボタンから呼ばれなくなるのでそのままで大丈夫です。
