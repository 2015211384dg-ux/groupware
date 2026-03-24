const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('notifApi', {
    onShow: (cb) => ipcRenderer.on('show-notif', (_, data) => cb(data)),
    close:  ()   => ipcRenderer.send('notif-close'),
    openUrl:(url) => ipcRenderer.send('notif-open-url', url)
});
