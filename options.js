// 設定ページのスクリプト

// デフォルト設定（バックグラウンドスクリプトと同じ値に保つ）
const defaultSettings = {
  // キーボードショートカット設定
  shortcuts: {
    rewind: 'Z',        // 巻き戻し
    forward: 'X',       // 早送り
    decreaseSpeed: 'A', // 速度を下げる
    increaseSpeed: 'D', // 速度を上げる
    openPresets: 'S',   // プリセット画面を開く
    addMarker: 'M'      // マーカーを追加
  },
  // 速度プリセット設定
  speedPresets: [
    { name: '0.5倍速', value: 0.5 },
    { name: '1.0倍速', value: 1.0 },
    { name: '1.5倍速', value: 1.5 },
    { name: '2.0倍速', value: 2.0 }
  ],
  // マーカー（空の配列で初期化）
  markers: {},
  // 表示設定
  display: {
    showStatusBar: true,  // ステータスバーを表示するかどうか
    statusBarPosition: 'top-left' // ステータスバーの位置
  },
  // スキップ設定
  skipTime: 5, // スキップする秒数（デフォルト5秒）
  speedStep: 0.1 // 速度変更の刻み幅（デフォルト0.1倍）
};

// 現在の設定
let currentSettings = {};

// ページ読み込み時の処理
document.addEventListener('DOMContentLoaded', () => {
  // タブ切り替え機能を初期化
  initTabs();
  
  // 設定を読み込み
  loadSettings();
  
  // イベントリスナーを設定
  setupEventListeners();
});

// タブ切り替え機能を初期化
function initTabs() {
  const tabs = document.querySelectorAll('.tab');
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      // アクティブなタブとコンテンツを非アクティブにする
      document.querySelectorAll('.tab, .tab-content').forEach(el => {
        el.classList.remove('active');
      });
      
      // クリックされたタブとそのコンテンツをアクティブにする
      tab.classList.add('active');
      const tabId = `${tab.getAttribute('data-tab')}-tab`;
      document.getElementById(tabId).classList.add('active');
    });
  });
}

// 設定を読み込む
function loadSettings() {
  chrome.storage.local.get('settings', (result) => {
    currentSettings = result.settings || JSON.parse(JSON.stringify(defaultSettings));
    
    // フォームに設定を適用
    applySettingsToForm();
  });
}

// フォームに設定を適用
function applySettingsToForm() {
  // ショートカット設定を適用
  Object.keys(currentSettings.shortcuts).forEach(action => {
    const input = document.getElementById(`shortcut-${action}`);
    if (input) {
      input.value = currentSettings.shortcuts[action];
    }
  });
  
  // スキップ時間と速度ステップを適用
  document.getElementById('skip-time').value = currentSettings.skipTime;
  document.getElementById('speed-step').value = currentSettings.speedStep;
  
  // プリセット設定を適用
  renderSpeedPresets();
  
  // マーカー一覧を表示
  renderMarkers();
  
  // 表示設定を適用
  document.getElementById('show-status-bar').checked = currentSettings.display.showStatusBar;
  
  // ステータスバーの位置設定を適用
  document.querySelectorAll('.position-option').forEach(option => {
    if (option.getAttribute('data-position') === currentSettings.display.statusBarPosition) {
      option.classList.add('selected');
    } else {
      option.classList.remove('selected');
    }
  });
}

// プリセット一覧を表示
function renderSpeedPresets() {
  const container = document.getElementById('preset-container');
  container.innerHTML = '';
  
  currentSettings.speedPresets.forEach((preset, index) => {
    const presetItem = document.createElement('div');
    presetItem.className = 'preset-item';
    
    presetItem.innerHTML = `
      <input type="text" class="preset-name" value="${preset.name}" placeholder="プリセット名">
      <input type="number" class="preset-value" value="${preset.value}" min="0.1" max="10" step="0.1">
      <button class="remove-preset" data-index="${index}">削除</button>
    `;
    
    container.appendChild(presetItem);
  });
}

// マーカー一覧を表示
function renderMarkers() {
  const container = document.getElementById('marker-container');
  const noMarkersElement = document.getElementById('no-markers');
  
  // マーカーコンテナをクリア（説明テキストは残す）
  const markersChildren = Array.from(container.children);
  markersChildren.forEach(child => {
    if (child !== noMarkersElement) {
      container.removeChild(child);
    }
  });
  
  // マーカーがあるかどうかを確認
  const markerVideos = Object.keys(currentSettings.markers);
  
  if (markerVideos.length === 0) {
    noMarkersElement.style.display = 'block';
    return;
  }
  
  noMarkersElement.style.display = 'none';
  
  // 動画ごとのマーカーを表示
  markerVideos.forEach(videoId => {
    const markers = currentSettings.markers[videoId];
    
    if (markers.length === 0) return;
    
    // 動画グループを作成
    const markerGroup = document.createElement('div');
    markerGroup.className = 'marker-group';
    
    // 動画タイトルを表示
    const title = document.createElement('h4');
    title.textContent = getVideoTitle(videoId);
    markerGroup.appendChild(title);
    
    // マーカーリスト
    markers.forEach(marker => {
      const markerItem = document.createElement('div');
      markerItem.className = 'marker-item';
      
      markerItem.innerHTML = `
        <div class="marker-time">${formatTime(marker.time)}</div>
        <div class="marker-title">${marker.label || '（無題）'}</div>
        <div class="marker-actions">
          <button class="delete-marker" data-video-id="${videoId}" data-time="${marker.time}">削除</button>
        </div>
      `;
      
      markerGroup.appendChild(markerItem);
    });
    
    container.appendChild(markerGroup);
  });
}

// 動画IDからタイトルを取得（現状ではIDをそのまま表示）
function getVideoTitle(videoId) {
  // 将来的には動画のタイトルをキャッシュするなどの機能を追加できます
  return `動画ID: ${videoId}`;
}

// 秒数を時:分:秒形式にフォーマット
function formatTime(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  
  return [
    h > 0 ? h : null,
    h > 0 ? String(m).padStart(2, '0') : m,
    String(s).padStart(2, '0')
  ].filter(Boolean).join(':');
}

// イベントリスナーを設定
function setupEventListeners() {
  // 保存ボタン
  document.getElementById('save-settings').addEventListener('click', saveSettings);
  
  // デフォルト設定に戻すボタン
  document.getElementById('restore-defaults').addEventListener('click', restoreDefaults);
  
  // プリセット追加ボタン
  document.getElementById('add-preset').addEventListener('click', addPreset);
  
  // プリセット削除ボタンのイベントを委譲
  document.getElementById('preset-container').addEventListener('click', (e) => {
    if (e.target.classList.contains('remove-preset')) {
      const index = parseInt(e.target.getAttribute('data-index'));
      removePreset(index);
    }
  });
  
  // マーカー削除ボタンのイベントを委譲
  document.getElementById('marker-container').addEventListener('click', (e) => {
    if (e.target.classList.contains('delete-marker')) {
      const videoId = e.target.getAttribute('data-video-id');
      const time = parseFloat(e.target.getAttribute('data-time'));
      deleteMarker(videoId, time);
    }
  });
  
  // ステータスバー位置オプションのイベント
  document.querySelectorAll('.position-option').forEach(option => {
    option.addEventListener('click', () => {
      // 選択されているオプションのクラスを削除
      document.querySelectorAll('.position-option').forEach(op => {
        op.classList.remove('selected');
      });
      
      // クリックされたオプションを選択状態に
      option.classList.add('selected');
    });
  });
}

// 設定を保存
function saveSettings() {
  // ショートカット設定を取得
  const shortcuts = {};
  Object.keys(currentSettings.shortcuts).forEach(action => {
    const input = document.getElementById(`shortcut-${action}`);
    if (input && input.value) {
      shortcuts[action] = input.value.toUpperCase();
    } else {
      shortcuts[action] = currentSettings.shortcuts[action];
    }
  });
  
  // 速度プリセットを取得
  const speedPresets = [];
  const presetItems = document.querySelectorAll('.preset-item');
  presetItems.forEach(item => {
    const nameInput = item.querySelector('.preset-name');
    const valueInput = item.querySelector('.preset-value');
    
    if (nameInput && valueInput) {
      const name = nameInput.value || `${valueInput.value}倍速`;
      const value = parseFloat(valueInput.value) || 1.0;
      
      speedPresets.push({
        name: name,
        value: Math.max(0.1, Math.min(10, value))
      });
    }
  });
  
  // 表示設定を取得
  const showStatusBar = document.getElementById('show-status-bar').checked;
  
  const selectedPosition = document.querySelector('.position-option.selected');
  const statusBarPosition = selectedPosition ? 
    selectedPosition.getAttribute('data-position') : 
    currentSettings.display.statusBarPosition;
  
  // スキップ時間と速度ステップを取得
  const skipTime = parseInt(document.getElementById('skip-time').value) || 5;
  const speedStep = parseFloat(document.getElementById('speed-step').value) || 0.1;
  
  // 現在の設定を更新
  currentSettings = {
    ...currentSettings,
    shortcuts,
    speedPresets,
    display: {
      showStatusBar,
      statusBarPosition
    },
    skipTime,
    speedStep
  };
  
  // 設定をストレージに保存
  chrome.storage.local.set({ settings: currentSettings }, () => {
    showStatusMessage('設定を保存しました', 'success');
    
    // 設定の変更をコンテンツスクリプトに通知
    chrome.tabs.query({}, tabs => {
      tabs.forEach(tab => {
        chrome.tabs.sendMessage(tab.id, {
          action: 'settingsUpdated',
          settings: currentSettings
        }).catch(() => {
          // エラー処理は不要（コンテンツスクリプトがロードされていない場合など）
        });
      });
    });
  });
}

// デフォルト設定に戻す
function restoreDefaults() {
  if (confirm('すべての設定をデフォルトに戻しますか？')) {
    currentSettings = JSON.parse(JSON.stringify(defaultSettings));
    applySettingsToForm();
    showStatusMessage('デフォルト設定を適用しました。保存するには「設定を保存」ボタンをクリックしてください。', 'success');
  }
}

// プリセットを追加
function addPreset() {
  if (currentSettings.speedPresets.length >= 10) {
    showStatusMessage('プリセットは最大10個までです', 'error');
    return;
  }
  
  currentSettings.speedPresets.push({
    name: `新規プリセット`,
    value: 1.0
  });
  
  renderSpeedPresets();
}

// プリセットを削除
function removePreset(index) {
  if (index >= 0 && index < currentSettings.speedPresets.length) {
    currentSettings.speedPresets.splice(index, 1);
    renderSpeedPresets();
  }
}

// マーカーを削除
function deleteMarker(videoId, time) {
  if (currentSettings.markers[videoId]) {
    currentSettings.markers[videoId] = currentSettings.markers[videoId].filter(
      marker => Math.abs(marker.time - time) >= 1
    );
    
    // マーカーがなくなった場合は動画エントリー自体を削除
    if (currentSettings.markers[videoId].length === 0) {
      delete currentSettings.markers[videoId];
    }
    
    renderMarkers();
    showStatusMessage('マーカーを削除しました。保存するには「設定を保存」ボタンをクリックしてください。', 'success');
  }
}

// ステータスメッセージを表示
function showStatusMessage(message, type) {
  const statusElement = document.getElementById('status-message');
  statusElement.textContent = message;
  statusElement.className = `status-message ${type}`;
  
  // 3秒後にメッセージを消す
  setTimeout(() => {
    statusElement.className = 'status-message';
  }, 3000);
}