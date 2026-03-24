const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('inboxApi', {
    onData:   (cb) => ipcRenderer.on('inbox-data',   (_, d) => cb(d)),
    openItem: (source, id, url) => ipcRenderer.send('inbox-open-item', { source, id, url }),
    readAll:  ()   => ipcRenderer.send('inbox-read-all'),
    close:    ()   => ipcRenderer.send('inbox-close')
});
