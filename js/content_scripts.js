console.log('B站截图插件 content script 已加载');

function captureVideoImage() {
    // 尝试多个可能的视频选择器（B站页面结构可能变化）
    const selectors = [
        ".bpx-player-video-wrap video",
        "video[src*='blob']",
        ".player-video video"
    ];
    let video = null;
    for (let sel of selectors) {
        video = document.querySelector(sel);
        if (video) break;
    }

    if (!video) {
        alert('未找到视频元素，请确保您在B站视频播放页面');
        console.warn('未找到视频元素');
        return;
    }

    // 确保视频已加载元数据
    if (!video.videoWidth || !video.videoHeight) {
        alert('视频尚未加载完成，请稍后重试');
        return;
    }

    console.log('找到视频元素，尺寸:', video.videoWidth, 'x', video.videoHeight);

    const canvas = new OffscreenCanvas(video.videoWidth, video.videoHeight);
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, video.videoWidth, video.videoHeight);

    const d = new Date();
    const timeStr = '' + d.getFullYear() +
                    (d.getMonth() + 1).toString().padStart(2, '0') +
                    d.getDate().toString().padStart(2, '0') +
                    d.getHours().toString().padStart(2, '0') +
                    d.getMinutes().toString().padStart(2, '0') +
                    d.getSeconds().toString().padStart(2, '0');

    canvas.convertToBlob().then(blob => {
        console.log('截图 blob 大小:', blob.size);
        const reader = new FileReader();
        reader.onloadend = () => {
            const dataUrl = reader.result;
            console.log('转换 dataUrl 完成，长度:', dataUrl.length);
            chrome.runtime.sendMessage({
                action: 'captureImageData',
                dataUrl: dataUrl,
                timestamp: timeStr
            }, (response) => {
                if (chrome.runtime.lastError) {
                    console.error('发送数据给后台失败:', chrome.runtime.lastError.message);
                    alert('截图数据发送失败，可能是后台服务未响应，请重试。');
                } else {
                    console.log('后台已接收数据');
                }
            });
        };
        reader.readAsDataURL(blob);
    }).catch(err => {
        console.error('canvas 转换 blob 失败:', err);
    });
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log('content script 收到消息:', request);
    if (request === 'captureImage') {
        captureVideoImage();
        sendResponse('已开始截图');
    }
});