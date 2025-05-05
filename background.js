// バックグラウンドサービスワーカー

// デフォルトの設定
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

// 初期化処理
chrome.runtime.onInstalled.addListener(() => {
  // デフォルト設定を保存
  chrome.storage.local.get('settings', (result) => {
    if (!result.settings) {
      chrome.storage.local.set({ settings: defaultSettings });
      console.log('デフォルト設定を保存しました');
    }
  });
});

// コンテンツスクリプトからのメッセージ処理
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'getSettings') {
    // 設定を取得してコンテンツスクリプトに返す
    chrome.storage.local.get('settings', (result) => {
      const settings = result.settings || defaultSettings;
      sendResponse({ settings: settings });
    });
    return true; // 非同期レスポンスのために必須
  } 
  else if (message.action === 'saveSettings') {
    // コンテンツスクリプトから送られた設定を保存
    chrome.storage.local.set({ settings: message.settings }, () => {
      sendResponse({ success: true });
    });
    return true;
  }
  else if (message.action === 'saveMarker') {
    // マーカーを保存
    chrome.storage.local.get('settings', (result) => {
      const settings = result.settings || defaultSettings;
      
      if (!settings.markers[message.videoId]) {
        settings.markers[message.videoId] = [];
      }
      
      // 同じ位置に既にマーカーがあるか確認
      const existingMarkerIndex = settings.markers[message.videoId].findIndex(
        marker => Math.abs(marker.time - message.marker.time) < 1
      );
      
      if (existingMarkerIndex >= 0) {
        // 既存のマーカーを更新
        settings.markers[message.videoId][existingMarkerIndex] = message.marker;
      } else {
        // 新しいマーカーを追加
        settings.markers[message.videoId].push(message.marker);
      }
      
      chrome.storage.local.set({ settings: settings }, () => {
        sendResponse({ success: true });
      });
    });
    return true;
  }
  else if (message.action === 'deleteMarker') {
    // マーカーを削除
    chrome.storage.local.get('settings', (result) => {
      const settings = result.settings || defaultSettings;
      
      if (settings.markers[message.videoId]) {
        // 指定された時間のマーカーを削除
        settings.markers[message.videoId] = settings.markers[message.videoId].filter(
          marker => Math.abs(marker.time - message.time) >= 1
        );
        
        chrome.storage.local.set({ settings: settings }, () => {
          sendResponse({ success: true });
        });
      } else {
        sendResponse({ success: false, error: 'マーカーが見つかりません' });
      }
    });
    return true;
  }
  else if (message.action === 'getMarkers') {
    // 特定の動画のマーカーを取得
    chrome.storage.local.get('settings', (result) => {
      const settings = result.settings || defaultSettings;
      const markers = settings.markers[message.videoId] || [];
      sendResponse({ markers: markers });
    });
    return true;
  }
});