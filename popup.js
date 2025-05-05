// ポップアップページが読み込まれたときに実行
document.addEventListener('DOMContentLoaded', function() {
  // ステータス表示要素
  const statusElement = document.getElementById('status');
  
  // アクティブなタブでコンテンツスクリプトにメッセージを送信
  chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
    if (tabs.length === 0) {
      statusElement.textContent = 'エラー: アクティブなタブが見つかりません。';
      return;
    }
    
    // YouTubeなどの対象サイトでない場合はメッセージを表示
    const url = tabs[0].url;
    if (!url.includes('youtube.com') && 
        !url.includes('nicovideo.jp') && 
        !url.includes('dailymotion.com') && 
        !url.includes('vimeo.com')) {
      statusElement.innerHTML = '<span style="color: #d93025;">この拡張機能は対応サイトでのみ利用できます。</span>';
      return;
    }
    
    // コンテンツスクリプトにステータス取得メッセージを送信
    chrome.tabs.sendMessage(tabs[0].id, { action: 'getStatus' }, function(response) {
      // レスポンスがない場合（拡張機能が読み込まれていない場合など）
      if (chrome.runtime.lastError || !response) {
        statusElement.innerHTML = '動画が検出されていないか、ページを再読み込みしてください。';
        return;
      }
      
      // レスポンスがある場合、動画情報を表示
      if (response.hasVideo) {
        statusElement.innerHTML = `
          <table>
            <tr>
              <td>速度:</td>
              <td>${response.playbackRate.toFixed(1)}倍速</td>
            </tr>
            <tr>
              <td>状態:</td>
              <td>${response.isPlaying ? '再生中' : '停止中'}</td>
            </tr>
          </table>
        `;
      } else {
        statusElement.textContent = '動画が検出されていません。';
      }
    });
  });
});