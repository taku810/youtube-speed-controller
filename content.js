// 動画速度コントローラ - コンテンツスクリプト
console.log("動画速度コントローラが読み込まれました");

// グローバル変数
let videoElements = [];
let currentVideoElement = null;
let lastPlaybackRate = 1.0;
let settings = null;
let videoId = null;
let markers = [];
let statusBarElement = null;
let presetMenuElement = null;
let controlsTimeout = null;

// 設定の読み込み
function loadSettings() {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ action: 'getSettings' }, (response) => {
      if (response && response.settings) {
        settings = response.settings;
        resolve(settings);
      } else {
        // バックグラウンドスクリプトからの応答がない場合はデフォルト設定を使用
        settings = {
          shortcuts: {
            rewind: 'Z',
            forward: 'X',
            decreaseSpeed: 'A',
            increaseSpeed: 'D',
            openPresets: 'S',
            addMarker: 'M'
          },
          speedPresets: [
            { name: '0.5倍速', value: 0.5 },
            { name: '1.0倍速', value: 1.0 },
            { name: '1.5倍速', value: 1.5 },
            { name: '2.0倍速', value: 2.0 }
          ],
          markers: {},
          display: {
            showStatusBar: true,
            statusBarPosition: 'top-left'
          },
          skipTime: 5,
          speedStep: 0.1
        };
        resolve(settings);
      }
    });
  });
}

// 動画要素を検出する関数
function findVideoElements() {
  const newVideoElements = Array.from(document.querySelectorAll('video'));
  
  // 新しい動画要素を追加
  newVideoElements.forEach(video => {
    if (!videoElements.includes(video)) {
      videoElements.push(video);
      console.log('新しい動画要素を検出しました:', video);
      
      // 動画の読み込みが完了したときのイベントリスナーを設定
      video.addEventListener('loadedmetadata', () => {
        detectCurrentVideo();
        updateStatusBar();
        detectVideoId();
        loadMarkers();
        createMarkerElements();
      });
    }
  });

  // 存在しなくなった動画要素を削除
  videoElements = videoElements.filter(video => document.body.contains(video));

  // 現在再生中の動画を探す
  detectCurrentVideo();
}

// 現在アクティブな動画を探す
function detectCurrentVideo() {
  // 再生中の動画を優先
  const playingVideo = videoElements.find(video => !video.paused && !video.ended);
  if (playingVideo) {
    if (currentVideoElement !== playingVideo) {
      currentVideoElement = playingVideo;
      detectVideoId();
      loadMarkers();
      updateStatusBar();
    }
    return;
  }

  // 再生中の動画がなければ、最も大きな表示領域の動画を選択
  let maxArea = 0;
  let maxVideo = null;

  videoElements.forEach(video => {
    const rect = video.getBoundingClientRect();
    const area = rect.width * rect.height;

    // 要素が見えている場合のみ計算
    if (area > 0 && rect.top < window.innerHeight && rect.bottom > 0 
        && rect.left < window.innerWidth && rect.right > 0) {
      if (area > maxArea) {
        maxArea = area;
        maxVideo = video;
      }
    }
  });

  if (maxVideo && maxVideo !== currentVideoElement) {
    currentVideoElement = maxVideo;
    detectVideoId();
    loadMarkers();
    updateStatusBar();
  } else if (!currentVideoElement && videoElements.length > 0) {
    // 見えている動画がない場合は最初の動画を選択
    currentVideoElement = videoElements[0];
    detectVideoId();
    loadMarkers();
    updateStatusBar();
  }
}

// YouTubeの動画IDを検出する
function detectVideoId() {
  if (!currentVideoElement) return;
  
  const oldVideoId = videoId;
  
  if (window.location.hostname.includes('youtube.com')) {
    // YouTube動画の場合はURLからIDを抽出
    const url = new URL(window.location.href);
    if (url.searchParams.has('v')) {
      videoId = url.searchParams.get('v');
    } else if (url.pathname.startsWith('/embed/')) {
      videoId = url.pathname.split('/')[2];
    } else if (url.pathname.startsWith('/shorts/')) {
      videoId = url.pathname.split('/')[2];
    }
  } else if (window.location.hostname.includes('nicovideo.jp')) {
    // ニコニコ動画の場合
    const match = window.location.pathname.match(/watch\/(sm\d+)/);
    if (match) {
      videoId = match[1];
    }
  } else {
    // その他の動画サイトの場合はホスト名+パスをIDとして使用
    videoId = window.location.hostname + window.location.pathname;
  }
  
  // 動画IDが変わった場合はマーカーを更新
  if (videoId && oldVideoId !== videoId) {
    loadMarkers();
    createMarkerElements();
  }
}

// 動画速度を変更する関数
function changePlaybackRate(delta) {
  if (!currentVideoElement) return;

  const speedStep = settings ? settings.speedStep : 0.1;
  let newRate = Math.round((currentVideoElement.playbackRate + delta) * 10) / 10;
  // 速度の範囲を0.1倍～10倍に制限
  newRate = Math.max(0.1, Math.min(10, newRate));
  
  currentVideoElement.playbackRate = newRate;
  lastPlaybackRate = newRate;
  
  // 速度変更の表示
  showControls(`再生速度: ${newRate.toFixed(1)}倍`);
  updateStatusBar();
}

// 動画を指定秒数だけスキップする関数
function skipVideo(seconds) {
  if (!currentVideoElement) return;
  
  const skipTime = settings ? settings.skipTime : 5;
  const actualSkipTime = seconds || skipTime * Math.sign(seconds);
  
  currentVideoElement.currentTime += actualSkipTime;
  
  // スキップ操作の表示
  const message = actualSkipTime > 0 ? `+${actualSkipTime}秒` : `${actualSkipTime}秒`;
  showControls(message);
}

// 操作情報を画面上に表示する関数
function showControls(message) {
  // 既存の情報表示要素を探す
  let controlsElement = document.getElementById('video-speed-controller-info');
  
  // 要素がなければ作成
  if (!controlsElement) {
    controlsElement = document.createElement('div');
    controlsElement.id = 'video-speed-controller-info';
    controlsElement.style.position = 'fixed';
    controlsElement.style.top = '80px';
    controlsElement.style.right = '20px';
    controlsElement.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
    controlsElement.style.color = 'white';
    controlsElement.style.padding = '10px 15px';
    controlsElement.style.borderRadius = '4px';
    controlsElement.style.fontSize = '16px';
    controlsElement.style.fontWeight = 'bold';
    controlsElement.style.zIndex = '9999';
    controlsElement.style.transition = 'opacity 0.3s';
    document.body.appendChild(controlsElement);
  }

  // メッセージを設定して表示
  controlsElement.textContent = message;
  controlsElement.style.opacity = '1';
  
  // タイムアウトをクリア
  if (controlsTimeout) {
    clearTimeout(controlsTimeout);
  }
  
  // 2秒後に非表示
  controlsTimeout = setTimeout(() => {
    controlsElement.style.opacity = '0';
  }, 2000);
}

// ステータスバーの作成または更新
function updateStatusBar() {
  if (!settings || !settings.display.showStatusBar || !currentVideoElement) return;
  
  if (!statusBarElement) {
    // ステータスバーを作成
    statusBarElement = document.createElement('div');
    statusBarElement.id = 'video-speed-controller-status';
    document.body.appendChild(statusBarElement);
  }
  
  // スタイルの設定
  statusBarElement.style.position = 'fixed';
  statusBarElement.style.zIndex = '9999';
  statusBarElement.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
  statusBarElement.style.color = 'white';
  statusBarElement.style.padding = '3px 8px';
  statusBarElement.style.fontSize = '14px';
  statusBarElement.style.borderRadius = '3px';
  statusBarElement.style.fontFamily = 'Arial, sans-serif';
  
  // 位置の設定
  switch (settings.display.statusBarPosition) {
    case 'top-left':
      statusBarElement.style.top = '10px';
      statusBarElement.style.left = '10px';
      statusBarElement.style.right = 'auto';
      statusBarElement.style.bottom = 'auto';
      break;
    case 'top-right':
      statusBarElement.style.top = '10px';
      statusBarElement.style.right = '10px';
      statusBarElement.style.left = 'auto';
      statusBarElement.style.bottom = 'auto';
      break;
    case 'bottom-left':
      statusBarElement.style.bottom = '10px';
      statusBarElement.style.left = '10px';
      statusBarElement.style.right = 'auto';
      statusBarElement.style.top = 'auto';
      break;
    case 'bottom-right':
      statusBarElement.style.bottom = '10px';
      statusBarElement.style.right = '10px';
      statusBarElement.style.left = 'auto';
      statusBarElement.style.top = 'auto';
      break;
  }
  
  // コンテンツの設定
  statusBarElement.textContent = `${currentVideoElement.playbackRate.toFixed(1)}x`;
  
  // 表示設定に基づいて表示/非表示を切り替え
  statusBarElement.style.display = settings.display.showStatusBar ? 'block' : 'none';
}

// 速度プリセットメニューの表示
function showPresetMenu() {
  if (!settings || !settings.speedPresets || settings.speedPresets.length === 0) return;
  
  // 既存のメニューを閉じる
  hidePresetMenu();
  
  // 新しいメニューを作成
  presetMenuElement = document.createElement('div');
  presetMenuElement.id = 'video-speed-controller-presets';
  
  // スタイルの設定
  presetMenuElement.style.position = 'fixed';
  presetMenuElement.style.bottom = '50px';
  presetMenuElement.style.left = '50%';
  presetMenuElement.style.transform = 'translateX(-50%)';
  presetMenuElement.style.backgroundColor = isPageDarkMode() ? 'rgba(255, 255, 255, 0.8)' : 'rgba(0, 0, 0, 0.8)';
  presetMenuElement.style.color = isPageDarkMode() ? 'black' : 'white';
  presetMenuElement.style.padding = '15px';
  presetMenuElement.style.borderRadius = '8px';
  presetMenuElement.style.zIndex = '9999';
  presetMenuElement.style.display = 'flex';
  presetMenuElement.style.flexWrap = 'wrap';
  presetMenuElement.style.justifyContent = 'center';
  presetMenuElement.style.gap = '10px';
  presetMenuElement.style.maxWidth = '80%';
  
  // プリセットボタンを作成
  settings.speedPresets.forEach(preset => {
    const presetButton = document.createElement('button');
    presetButton.textContent = preset.name;
    
    // スタイルの設定
    presetButton.style.padding = '8px 16px';
    presetButton.style.border = 'none';
    presetButton.style.borderRadius = '4px';
    presetButton.style.backgroundColor = isPageDarkMode() ? '#333' : '#f0f0f0';
    presetButton.style.color = isPageDarkMode() ? 'white' : 'black';
    presetButton.style.cursor = 'pointer';
    presetButton.style.fontSize = '14px';
    
    // 現在の速度に近いプリセットをハイライト
    if (currentVideoElement && Math.abs(currentVideoElement.playbackRate - preset.value) < 0.05) {
      presetButton.style.backgroundColor = '#1a73e8';
      presetButton.style.color = 'white';
    }
    
    // クリック時の動作を設定
    presetButton.addEventListener('click', () => {
      if (currentVideoElement) {
        currentVideoElement.playbackRate = preset.value;
        updateStatusBar();
        showControls(`再生速度: ${preset.value.toFixed(1)}倍`);
      }
      hidePresetMenu();
    });
    
    presetMenuElement.appendChild(presetButton);
  });
  
  // ドキュメントに追加
  document.body.appendChild(presetMenuElement);
  
  // 画面のどこかをクリックしたらメニューを閉じる
  setTimeout(() => {
    document.addEventListener('click', hidePresetMenuOnClickOutside);
  }, 10);
}

// プリセットメニューを閉じる
function hidePresetMenu() {
  if (presetMenuElement && presetMenuElement.parentNode) {
    presetMenuElement.parentNode.removeChild(presetMenuElement);
    presetMenuElement = null;
    document.removeEventListener('click', hidePresetMenuOnClickOutside);
  }
}

// メニュー外をクリックしたときにメニューを閉じる
function hidePresetMenuOnClickOutside(event) {
  if (presetMenuElement && !presetMenuElement.contains(event.target)) {
    hidePresetMenu();
  }
}

// ページがダークモードかどうかを判定
function isPageDarkMode() {
  // 簡易的な判定方法（背景色の明るさで判断）
  const bodyBg = window.getComputedStyle(document.body).backgroundColor;
  const match = bodyBg.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  if (match) {
    const r = parseInt(match[1]);
    const g = parseInt(match[2]);
    const b = parseInt(match[3]);
    const brightness = (r * 299 + g * 587 + b * 114) / 1000;
    return brightness < 128;  // 128未満なら暗いと判断
  }
  return false;
}

// マーカーの追加
function addMarker() {
  if (!currentVideoElement || !videoId) return;
  
  // 現在の再生位置を取得
  const time = currentVideoElement.currentTime;
  
  // マーカーのラベルを入力させる
  const label = prompt('マーカーのラベル（任意）:', '');
  
  // マーカーオブジェクトを作成
  const marker = {
    time,
    label,
    createdAt: new Date().toISOString()
  };
  
  // バックグラウンドスクリプトにマーカー保存を依頼
  chrome.runtime.sendMessage({
    action: 'saveMarker',
    videoId,
    marker
  }, response => {
    if (response && response.success) {
      showControls('マーカーを追加しました');
      loadMarkers();
      createMarkerElements();
    }
  });
}

// マーカーの読み込み
function loadMarkers() {
  if (!videoId) return;
  
  chrome.runtime.sendMessage({
    action: 'getMarkers',
    videoId
  }, response => {
    if (response && response.markers) {
      markers = response.markers;
      createMarkerElements();
    }
  });
}

// マーカー要素の作成
function createMarkerElements() {
  if (!videoId || !currentVideoElement) return;
  
  // 既存のマーカーピンを削除
  removeExistingMarkerElements();
  
  // 再生バーを探す
  const progressBar = findVideoProgressBar();
  if (!progressBar) return;
  
  // マーカーピン要素を作成して配置
  markers.forEach(marker => {
    createMarkerPin(marker, progressBar);
  });
  
  // サムネイル要素にマーカー数バッジを追加
  updateThumbnailBadges();
}

// 既存のマーカーピン要素を削除
function removeExistingMarkerElements() {
  document.querySelectorAll('.video-speed-controller-marker-pin').forEach(el => {
    el.parentNode.removeChild(el);
  });
}

// 動画サイト別の再生バー検索
function findVideoProgressBar() {
  // YouTubeの場合
  if (window.location.hostname.includes('youtube.com')) {
    return document.querySelector('.ytp-progress-bar');
  }
  
  // ニコニコ動画の場合
  else if (window.location.hostname.includes('nicovideo.jp')) {
    return document.querySelector('.PlayerSlider-track');
  }
  
  // その他の動画サイトの場合（汎用的な検索を試みる）
  else {
    // 動画の周辺要素から進捗バーらしき要素を探す
    if (currentVideoElement) {
      const parentRect = currentVideoElement.getBoundingClientRect();
      
      // 再生バーの候補となる要素（幅が長く、高さが低いもの）を探す
      const candidates = Array.from(document.querySelectorAll('div, span, progress'))
        .filter(el => {
          const rect = el.getBoundingClientRect();
          // 動画要素の下にある細長い要素を探す
          return rect.width > parentRect.width * 0.5 &&
                 rect.height < 20 &&
                 rect.top > parentRect.top &&
                 rect.top < parentRect.bottom + 50;
        });
      
      return candidates[0] || null;
    }
  }
  
  return null;
}

// マーカーピンの作成
function createMarkerPin(marker, progressBar) {
  if (!currentVideoElement || !progressBar) return;
  
  const pin = document.createElement('div');
  pin.className = 'video-speed-controller-marker-pin';
  
  // スタイル設定
  pin.style.position = 'absolute';
  pin.style.width = '8px';
  pin.style.height = '8px';
  pin.style.backgroundColor = '#ff4081';
  pin.style.borderRadius = '50%';
  pin.style.top = '-4px';
  pin.style.zIndex = '10';
  pin.style.cursor = 'pointer';
  
  // 位置の計算
  const progressBarRect = progressBar.getBoundingClientRect();
  const videoDuration = currentVideoElement.duration || 1;
  const position = (marker.time / videoDuration) * 100;
  pin.style.left = `${position}%`;
  
  // ツールチップ設定
  pin.title = `${formatTime(marker.time)}${marker.label ? ` - ${marker.label}` : ''}`;
  
  // クリックイベント（マーカー位置にジャンプ）
  pin.addEventListener('click', (e) => {
    e.stopPropagation(); // 親要素のクリックイベントを防ぐ
    if (currentVideoElement) {
      currentVideoElement.currentTime = marker.time;
      showControls(`マーカー: ${pin.title}`);
    }
  });
  
  // 右クリックイベント（マーカーの削除）
  pin.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    if (confirm('このマーカーを削除しますか？')) {
      chrome.runtime.sendMessage({
        action: 'deleteMarker',
        videoId,
        time: marker.time
      }, response => {
        if (response && response.success) {
          showControls('マーカーを削除しました');
          loadMarkers();
        }
      });
    }
  });
  
  // 進捗バーに追加
  progressBar.style.position = 'relative'; // 親要素がrelative位置指定であることを確認
  progressBar.appendChild(pin);
}

// サムネイルにマーカー数バッジを表示
function updateThumbnailBadges() {
  if (window.location.hostname.includes('youtube.com')) {
    // YouTubeの場合、関連動画のサムネイルを探す
    document.querySelectorAll('a[href*="watch?v="]').forEach(link => {
      try {
        const href = link.getAttribute('href');
        const match = href.match(/[?&]v=([^&]+)/);
        if (match) {
          const linkVideoId = match[1];
          
          // 既存のバッジがあれば削除
          const existingBadge = link.querySelector('.video-speed-controller-badge');
          if (existingBadge) {
            existingBadge.parentNode.removeChild(existingBadge);
          }
          
          // 該当動画のマーカー数を取得
          chrome.runtime.sendMessage({
            action: 'getMarkers',
            videoId: linkVideoId
          }, response => {
            if (response && response.markers && response.markers.length > 0) {
              const badgeCount = response.markers.length;
              createBadge(link, badgeCount);
            }
          });
        }
      } catch (e) {
        console.log('バッジ作成エラー:', e);
      }
    });
  }
}

// バッジ要素の作成
function createBadge(parentElement, count) {
  const thumbnail = parentElement.querySelector('img') || parentElement;
  
  if (thumbnail) {
    const badge = document.createElement('div');
    badge.className = 'video-speed-controller-badge';
    badge.textContent = count;
    
    badge.style.position = 'absolute';
    badge.style.bottom = '5px';
    badge.style.right = '5px';
    badge.style.backgroundColor = '#ff4081';
    badge.style.color = 'white';
    badge.style.padding = '2px 5px';
    badge.style.fontSize = '12px';
    badge.style.fontWeight = 'bold';
    badge.style.borderRadius = '10px';
    badge.style.zIndex = '2';
    
    // サムネイル要素に対して適切な位置決めができるよう、親要素にスタイルを適用
    if (thumbnail.parentElement) {
      if (window.getComputedStyle(thumbnail.parentElement).position === 'static') {
        thumbnail.parentElement.style.position = 'relative';
      }
      thumbnail.parentElement.appendChild(badge);
    }
  }
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

// キーボードイベントのリスナー
function handleKeyDown(e) {
  if (!settings) return;
  
  // 入力欄にフォーカスがある場合は無視
  if (document.activeElement && 
      (document.activeElement.tagName === 'INPUT' || 
       document.activeElement.tagName === 'TEXTAREA' || 
       document.activeElement.isContentEditable)) {
    return;
  }

  // 現在アクティブな動画を確認
  if (!currentVideoElement) {
    findVideoElements();
    if (!currentVideoElement) return;
  }

  const key = e.key.toUpperCase();
  
  // ショートカットキーの確認
  if (key === settings.shortcuts.rewind) {
    // 巻き戻し
    skipVideo(-settings.skipTime);
    e.preventDefault();
  }
  else if (key === settings.shortcuts.forward) {
    // 早送り
    skipVideo(settings.skipTime);
    e.preventDefault();
  }
  else if (key === settings.shortcuts.decreaseSpeed) {
    // 速度を下げる
    changePlaybackRate(-settings.speedStep);
    e.preventDefault();
  }
  else if (key === settings.shortcuts.increaseSpeed) {
    // 速度を上げる
    changePlaybackRate(settings.speedStep);
    e.preventDefault();
  }
  else if (key === settings.shortcuts.openPresets) {
    // プリセット画面を開く
    showPresetMenu();
    e.preventDefault();
  }
  else if (key === settings.shortcuts.addMarker) {
    // マーカーを追加
    addMarker();
    e.preventDefault();
  }
}

// 現在の動画ステータスを取得する関数
function getVideoStatus() {
  if (!currentVideoElement) {
    findVideoElements();
  }
  
  return {
    hasVideo: !!currentVideoElement,
    playbackRate: currentVideoElement ? currentVideoElement.playbackRate : 1.0,
    isPlaying: currentVideoElement ? !currentVideoElement.paused : false,
    duration: currentVideoElement ? currentVideoElement.duration : 0,
    currentTime: currentVideoElement ? currentVideoElement.currentTime : 0
  };
}

// メッセージリスナーを設定
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'getStatus') {
    sendResponse(getVideoStatus());
  }
  else if (message.action === 'settingsUpdated') {
    settings = message.settings;
    updateStatusBar();
    loadMarkers();
    createMarkerElements();
  }
  return true; // 非同期レスポンスのために必須
});

// MutationObserverを設定して動的に追加される動画要素を検出
const observer = new MutationObserver(() => {
  findVideoElements();
});

// 初期化とイベントリスナーの設定
async function init() {
  // 設定を読み込み
  await loadSettings();
  
  // 初回の動画要素検出
  findVideoElements();

  // 定期的に動画要素を検出して更新
  setInterval(() => {
    findVideoElements();
    updateStatusBar();
    createMarkerElements();
    updateThumbnailBadges();
  }, 3000);

  // DOMの変更を監視
  observer.observe(document.body, {
    childList: true,
    subtree: true
  });

  // キーボードイベントのリスナー登録
  document.addEventListener('keydown', handleKeyDown);

  // ページの表示状態が変わったときに再検出
  document.addEventListener('visibilitychange', () => {
    findVideoElements();
    updateStatusBar();
  });

  console.log('動画速度コントローラが初期化されました');
}

// ページが読み込まれたら初期化
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}