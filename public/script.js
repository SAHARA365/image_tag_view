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
const TAG_LABELS = { copyright: '出典', character: 'キャラクター', artist: '絵師', general: '一般', meta: 'メタ', size: 'サイズ' };
const UNTAGGED_LABEL = 'タグ未登録'; 

// ----------------------------------------------------
// 初期化・URL管理
// ----------------------------------------------------

window.addEventListener('DOMContentLoaded', async () => {
  // 1. URLパラメータの復元 (リロード対策)
  const params = new URLSearchParams(window.location.search);
  const savedQuery = params.get('q');
  const searchInput = document.getElementById('search');
　const savedSort = localStorage.getItem('savedSortMode');
  const sortSelect = document.getElementById('sort-select');
  if (savedSort && sortSelect) {
      sortSelect.value = savedSort;
  }

  if (savedQuery && searchInput) {
      searchInput.value = savedQuery;
  }

  const updateClearBtn = () => {
      const btn = document.getElementById('clear-btn');
      if (btn && searchInput) {
          btn.style.display = searchInput.value.length > 0 ? 'block' : 'none';
      }
  };

if (searchInput) {
    // ページ読み込み時に一度チェック（更新などで文字が残っている場合のため）
    updateClearBtn(); 

    searchInput.addEventListener('input', (e) => {
      const val = e.target.value;
      updateURLState(val);
      filterImages();
      updateClearBtn(); // ★この1行が抜けていました！これを追加
    });
  }

  // 2. データのロード
  await loadData();
  updateTagList();
  
  // 3. 状態の復元
  if (window.location.hash.startsWith('#post=')) {
    handleHashChange();
  } else {
    applyFilterAndSort();
  }
});

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

function updateURLState(searchText) {
  const url = new URL(window.location);
  if (searchText) {
    url.searchParams.set('q', searchText);
  } else {
    url.searchParams.delete('q');
  }
  window.history.replaceState(null, '', url);
}

async function loadData() {
  try {
    const res = await fetch('/api/metadata');
    const data = await res.json();
    allData = Object.values(data)
      .filter(item => item && typeof item === 'object' && item.title)
      .sort((a, b) => b.createdAt - a.createdAt);
    displayData = [...allData];
  } catch (e) { 
    console.error('Data load failed:', e); 
    alert('データの読み込みに失敗しました。ログインしていますか？');
  }
}

// ----------------------------------------------------
// コアロジック (フィルタ・ソート)
// ----------------------------------------------------

function applyFilterAndSort() {
  const searchBox = document.getElementById('search');
  const keyword = searchBox ? searchBox.value.toLowerCase() : '';
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

function changeSort() { 
  const val = document.getElementById('sort-select').value;
  localStorage.setItem('savedSortMode', val); // 設定を保存
  applyFilterAndSort(); 
}
function filterImages() { applyFilterAndSort(); }

function searchTag(tagName) {
  const searchBox = document.getElementById('search');
  searchBox.value = tagName;
  updateURLState(tagName);
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
// 表示関連 (ギャラリー)
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
  
  const bulkControls = document.getElementById('bulk-controls');
  if (bulkControls) bulkControls.style.display = isSelectionMode ? 'flex' : 'none';

  const container = document.getElementById('gallery-view');
  container.innerHTML = '';

  const start = (currentPage - 1) * ITEMS_PER_PAGE;
  const end = start + ITEMS_PER_PAGE;
  const pageItems = displayData.slice(start, end);

  document.getElementById('page-info').innerText = `Page ${currentPage} / ${Math.ceil(displayData.length / ITEMS_PER_PAGE) || 1} (${displayData.length} items)`;

  pageItems.forEach(item => {
    const div = document.createElement('div');
    div.className = 'thumb-card';
    if (selectedItems.has(item.title)) div.classList.add('selected');

    // ★修正: サーバーのAPIエンドポイントに合わせてURL生成
    const imgUrl = `/api/cover-image?folder=${encodeURIComponent(item.title)}`;
    
const postHash = `#post=${encodeURIComponent(item.title)}`;
    
    div.innerHTML = `
      <a href="${postHash}" class="thumb-link" style="display:flex; width:100%; height:100%; align-items:center; justify-content:center; text-decoration:none;">
        <img src="${imgUrl}" loading="lazy" onerror="this.src=''; this.alt='No Image'" style="max-width:100%; max-height:100%;">
      </a>
    `;
    
    // リンク要素を取得
    const link = div.querySelector('a');

    // クリックイベントの制御
    link.addEventListener('click', (e) => {
      // CtrlキーやCommandキーが押されている場合（別タブ希望）は
      // Javascriptで妨害せず、ブラウザ標準の動作（別タブで開く）に任せる
      if (e.ctrlKey || e.metaKey) return;

      // 通常の左クリックの場合は、ページ遷移（リロード）を防ぐ
      e.preventDefault();

      // 選択モードか、通常遷移かで分岐
      if (isSelectionMode) {
        // 親のdivの見た目を変えるために toggleItemSelection を呼ぶ
        toggleItemSelection(item.title);
      } else {
        openPost(item);
      }
    });

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
  document.getElementById('pagination-container').style.display = 'none';
  
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
// タグ管理関連 (サイドバー)
// ----------------------------------------------------

function renderSidebarTags(item) {
  const container = document.getElementById('tag-container');
  container.innerHTML = '';

  // ★追加: 一括削除ボタンエリア
  const controlDiv = document.createElement('div');
  controlDiv.style.marginBottom = '15px';
  controlDiv.style.borderBottom = '1px solid #eee';
  controlDiv.style.paddingBottom = '10px';
  controlDiv.innerHTML = `
    <button id="btn-bulk-delete" onclick="deleteSelectedTags()" disabled 
            style="width:100%; background:#d9534f; color:white; border:none; padding:8px; border-radius:4px; opacity:0.5; cursor:not-allowed;">
      選択したタグを削除 (0)
    </button>
  `;
  container.appendChild(controlDiv);

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
      // カウント計算
      let count = 0;
      allData.forEach(d => {
        const dTags = (d.tags || []).map(dt => typeof dt === 'string' ? dt : dt.name);
        if (dTags.includes(tagObj.name)) count++;
      });

      const li = document.createElement('li');
      li.style.display = 'flex';
      li.style.alignItems = 'center';
      li.style.marginBottom = '4px';

      // ★追加: チェックボックス
      li.innerHTML = `
        <label style="display:flex; align-items:center; cursor:pointer; flex-grow:1;">
          <input type="checkbox" class="tag-selector" value="${tagObj.name}" 
                 onchange="updateDeleteButtonState()" style="margin-right:6px;">
          <a href="#" class="tag-link type-${type}" onclick="searchTag('${tagObj.name}'); return false;" style="pointer-events: auto;">
            ${tagObj.name} <span style="color:#888; font-size:0.8em;">(${count})</span>
          </a>
        </label>
        <span class="remove-btn" onclick="removeTag('${tagObj.name}')" style="margin-left:5px; cursor:pointer;">×</span>
      `;
      ul.appendChild(li);
    });
    section.appendChild(ul);
    container.appendChild(section);
  });
}

function updateDeleteButtonState() {
   const checkboxes = document.querySelectorAll('.tag-selector:checked');
   const btn = document.getElementById('btn-bulk-delete');
   const count = checkboxes.length;
   if (count > 0) {
     btn.disabled = false;
     btn.style.opacity = '1';
     btn.style.cursor = 'pointer';
     btn.innerText = `選択したタグを削除 (${count})`;
   } else {
     btn.disabled = true;
     btn.style.opacity = '0.5';
     btn.style.cursor = 'not-allowed';
     btn.innerText = `選択したタグを削除 (0)`;
   }
}

async function deleteSelectedTags() {
  if(!currentItem) return;
  const checkboxes = document.querySelectorAll('.tag-selector:checked');
  if(checkboxes.length === 0) return;
  if(!confirm(`選択した ${checkboxes.length} 個のタグを削除しますか？`)) return;

  const targets = Array.from(checkboxes).map(c => c.value);
  currentItem.tags = (currentItem.tags || []).filter(t => {
     const tName = typeof t === 'string' ? t : t.name;
     return !targets.includes(tName);
  });
  await saveMetadata(currentItem);
  renderSidebarTags(currentItem); 
}

// 個別タグ追加・削除
async function addCurrentTag() {
  const nameInput = document.getElementById('new-tag-name');
  const typeInput = document.getElementById('new-tag-type');
  const name = nameInput.value.trim();
  const type = typeInput.value;
  if (!name || !currentItem) return;

  const currentTags = (currentItem.tags || []).map(t => typeof t === 'string' ? t : t.name);
  if (currentTags.includes(name)) { alert('既に登録されています'); return; }

  let newTags = (currentItem.tags || []).map(t => typeof t === 'string' ? { name: t, type: 'general' } : t);
  if (name !== UNTAGGED_LABEL) {
    newTags = newTags.filter(t => t.name !== UNTAGGED_LABEL);
  }
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

// ----------------------------------------------------
// 一括操作関連 (ギャラリー画面)
// ----------------------------------------------------

function toggleSelectionMode() {
  isSelectionMode = !isSelectionMode;
  selectedItems.clear();
  const btn = document.getElementById('mode-btn');
  const controls = document.getElementById('bulk-controls');
  if (isSelectionMode) {
    btn.classList.add('active');
    btn.innerText = "☑ 終了";
    if(controls) controls.style.display = 'flex'; 
  } else {
    btn.classList.remove('active');
    btn.innerText = "☑ 選択モード";
    if(controls) controls.style.display = 'none';
  }
  document.getElementById('selected-count').innerText = "0枚";
  renderGalleryView();
}

function toggleItemSelection(title) {
  if (selectedItems.has(title)) selectedItems.delete(title);
  else selectedItems.add(title);
  updateBulkPanel();
  renderGalleryView();
}

function updateBulkPanel() {
  document.getElementById('selected-count').innerText = `${selectedItems.size}枚`;
}

function selectAllInPage() {
  const start = (currentPage - 1) * ITEMS_PER_PAGE;
  const end = start + ITEMS_PER_PAGE;
  const pageItems = displayData.slice(start, end);
  pageItems.forEach(item => selectedItems.add(item.title));
  updateBulkPanel();
  renderGalleryView();
}

function deselectAll() {
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

  for (const title of selectedItems) {
    const item = allData.find(d => d.title === title);
    if (!item) continue;
    
    const currentTags = (item.tags || []).map(t => typeof t === 'string' ? t : t.name);
    if (!currentTags.includes(tagName)) {
      let newTags = (item.tags || []).map(t => typeof t === 'string' ? { name: t, type: 'general' } : t);
      if (tagName !== UNTAGGED_LABEL) {
        newTags = newTags.filter(t => t.name !== UNTAGGED_LABEL);
      }
      newTags.push({ name: tagName, type: tagType });
      item.tags = newTags;
      await saveMetadata(item);
    }
  }
  nameInput.value = '';
  updateBulkPanel();
  renderGalleryView();
  updateTagList();
}

function clearSearch() {
  const searchInput = document.getElementById('search');
  if (searchInput) {
      searchInput.value = '';        // 入力を空にする
      searchInput.focus();           // フォーカスを戻す
      updateURLState('');            // URLのクエリを削除
      filterImages();                // 全件表示に戻す
      
      // ボタンを非表示にする
      const btn = document.getElementById('clear-btn');
      if (btn) btn.style.display = 'none';
  }
}

function navigatePost(step) {
  // 詳細画面が開いていない、またはデータがない場合は無視
  if (!currentItem || displayData.length === 0) return;

  // 現在表示中の画像が、今のリスト(displayData)の何番目かを探す
  // ※ allDataではなくdisplayDataを使うことで、検索結果の中だけで移動できます
  const currentIndex = displayData.findIndex(d => d.title === currentItem.title);

  if (currentIndex === -1) return; // エラー回避

  const newIndex = currentIndex + step;

  // リストの範囲内であれば移動する
  if (newIndex >= 0 && newIndex < displayData.length) {
    openPost(displayData[newIndex]);
  } else {
    // 端まで来たときの通知（お好みで消してもOK）
    console.log('これ以上移動できません');
  }
}

// キーボード操作の追加 (← / →)
document.addEventListener('keydown', (e) => {
  const postView = document.getElementById('post-view');
  
  // 詳細画面が表示されていない(activeクラスがない)ときは何もしない
  if (!postView.classList.contains('active')) return;

  // タグ入力中などに反応しないようにする
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;

  if (e.key === 'ArrowLeft') {
    navigatePost(-1); // 前へ
  } else if (e.key === 'ArrowRight') {
    navigatePost(1);  // 次へ
  }
});
