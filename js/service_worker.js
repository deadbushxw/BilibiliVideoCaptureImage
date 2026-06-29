/**
 * 通知 content script 截图
 */
function notifyCapture() {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (!tabs[0]) {
            console.error('没有找到活动标签页');
            return;
        }
        chrome.tabs.sendMessage(tabs[0].id, 'captureImage', (response) => {
            if (chrome.runtime.lastError) {
                console.error('发送消息失败:', chrome.runtime.lastError.message);
                // 可以尝试提示用户刷新页面
            } else {
                console.log('content script 回复:', response);
            }
        });
    });
}

// 快捷键
chrome.commands.onCommand.addListener((command) => {
    console.log('快捷键触发:', command);
    if (command === 'BilibiliCaptureImage') {
        notifyCapture();
    }
});

// 右键菜单创建
chrome.runtime.onInstalled.addListener(() => {
    chrome.contextMenus.create({
        id: 'capture',
        title: 'B站视频截图',
        contexts: ['page']
    });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
    if (info.menuItemId === 'capture') {
        notifyCapture();
    }
});

// 监听来自 content script 的截图数据
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'captureImageData') {
        console.log('收到截图数据，长度:', request.dataUrl.length, '时间戳:', request.timestamp);

        chrome.storage.sync.get('downloadSubfolder', (data) => {
            let filename = `screenshot-${request.timestamp}.png`;
            const subfolder = data.downloadSubfolder;
            if (subfolder && subfolder.trim() !== '') {
                // 去除首尾空格，并确保路径分隔符正确
                let cleanSubfolder = subfolder.trim().replace(/[\\/]+$/, ''); // 去掉末尾的斜杠
                // 将用户输入的子文件夹名称作为目录，使用正斜杠
                filename = `${cleanSubfolder}/${filename}`;
            }
            console.log('准备下载，文件名:', filename);

            chrome.downloads.download({
                url: request.dataUrl,
                filename: filename,
                conflictAction: 'uniquify'
            }, (downloadId) => {
                if (chrome.runtime.lastError) {
                    console.error('下载失败:', chrome.runtime.lastError.message);
                } else {
                    console.log('下载已启动，ID:', downloadId);
                }
            });
        });
    }
});