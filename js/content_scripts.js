// ============================================================
// IndexedDB 存取 FileSystemDirectoryHandle
// ============================================================
const DB_NAME = 'BilibiliScreenshotDB';
const DB_VERSION = 1;
const STORE_NAME = 'settings';

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(STORE_NAME);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function dbGet(key) {
  return openDB().then(db => new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const req = tx.objectStore(STORE_NAME).get(key);
    req.onsuccess = () => { resolve(req.result); db.close(); };
    req.onerror = () => { reject(req.error); db.close(); };
  }));
}

function dbPut(key, value) {
  return openDB().then(db => new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const req = tx.objectStore(STORE_NAME).put(value, key);
    req.onsuccess = () => { resolve(); db.close(); };
    req.onerror = () => { reject(req.error); db.close(); };
  }));
}

// ============================================================
// 目录选择 UI
// ============================================================
let folderPickerResolve = null;

function showFolderPickerButton() {
  // 移除已有按钮
  const old = document.getElementById('bcs-folder-picker-btn');
  if (old) old.remove();

  const btn = document.createElement('div');
  btn.id = 'bcs-folder-picker-btn';
  btn.textContent = '📁 点击选择截图保存目录';
  Object.assign(btn.style, {
    position: 'fixed',
    bottom: '20px',
    right: '20px',
    padding: '12px 20px',
    backgroundColor: '#00a1d6',
    color: 'white',
    borderRadius: '8px',
    cursor: 'pointer',
    zIndex: 1000000,
    fontSize: '14px',
    fontWeight: 'bold',
    boxShadow: '0 2px 12px rgba(0,0,0,0.3)',
    fontFamily: 'sans-serif'
  });

  btn.addEventListener('click', async () => {
    try {
      const dirHandle = await window.showDirectoryPicker({ startIn: 'downloads' });
      await dbPut('saveDir', dirHandle);
      btn.textContent = '✅ 目录已选择';
      btn.style.backgroundColor = '#52c41a';
      setTimeout(() => btn.remove(), 2000);
      if (folderPickerResolve) {
        folderPickerResolve(dirHandle);
        folderPickerResolve = null;
      }
    } catch (err) {
      if (err.name !== 'AbortError') {
        btn.textContent = '❌ 选择失败，重试';
        btn.style.backgroundColor = '#ff4d4f';
        setTimeout(() => btn.remove(), 3000);
      }
    }
  });

  document.body.appendChild(btn);
}

// ============================================================
// 保存到用户选择的目录
// ============================================================
async function saveToUserDir(blob, fileName) {
  let dirHandle = await dbGet('saveDir');

  // 有 handle 但权限可能过期
  if (dirHandle) {
    try {
      const perm = await dirHandle.requestPermission({ mode: 'readwrite' });
      if (perm === 'granted') {
        const fileHandle = await dirHandle.getFileHandle(fileName, { create: true });
        const writable = await fileHandle.createWritable();
        await writable.write(blob);
        await writable.close();
        return true;
      }
    } catch (e) {
      console.warn('目录权限失效，需重新选择', e);
    }
  }

  // 没有 handle 或权限失效 → 等待用户点击选择目录
  return false;
}

// ============================================================
// 提取 BV 号
// ============================================================
function getBvid() {
  var m = window.location.pathname.match(/\/video\/(BV[\w]+)/);
  return m ? m[1] : 'unknown';
}

// ============================================================
// 格式化视频时间（秒 → 分_秒 / 时_分_秒）
// ============================================================
function formatVideoTime(seconds) {
  var s = Math.floor(seconds);
  var h = Math.floor(s / 3600);
  var m = Math.floor((s % 3600) / 60);
  var sec = s % 60;
  if (h > 0) {
    return h + '_' + String(m).padStart(2, '0') + '_' + String(sec).padStart(2, '0');
  }
  return m + '_' + String(sec).padStart(2, '0');
}

// ============================================================
// 核心：截图 + 保存
// ============================================================
async function captureVideoImage() {
  var v = document.querySelector(".bpx-player-video-wrap video");
  if (!v) {
    console.error('未找到视频元素');
    return;
  }

  var myCanvas = new OffscreenCanvas(v.videoWidth, v.videoHeight);
  var ctx = myCanvas.getContext('2d');
  ctx.drawImage(v, 0, 0, v.videoWidth, v.videoHeight)
  const blob = await myCanvas.convertToBlob();

  // 写入系统剪贴板
  try {
    const clipboardItem = new ClipboardItem({ 'image/png': blob });
    await navigator.clipboard.write([clipboardItem]);
    console.log('✅ 截图已复制到剪贴板');
  } catch (err) {
    console.error('剪贴板写入失败:', err);
  }

  var d = new Date();
  var timeStr = '' + d.getFullYear() + (d.getMonth() + 1) + d.getDate() + d.getHours() + d.getMinutes() + d.getSeconds();
  var bvid = getBvid();
  var pos = formatVideoTime(v.currentTime + 1);
  const fileName = timeStr + '_' + bvid + '_' + pos + '.png';

  // 尝试保存到用户选择的目录
  const saved = await saveToUserDir(blob, fileName);
  if (saved) {
    console.log('✅ 文件已保存到指定目录:', fileName);
    return;
  }

  // 未选择目录或目录不可用 → <a> 标签下载到默认下载文件夹 + 显示选择目录按钮
  try {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    console.log('✅ 文件已下载到默认文件夹:', fileName);
  } catch (err) {
    console.error('文件下载失败:', err);
  }

  // 首次使用：显示目录选择按钮
  const hasDir = await dbGet('saveDir');
  if (!hasDir) {
    showFolderPickerButton();
  }
}

// ============================================================
// 消息监听
// ============================================================
chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
  if (request === 'captureImage' || request.action === 'captureImage') {
    captureVideoImage();
    sendResponse({ received: true });
    return true;
  }
});
