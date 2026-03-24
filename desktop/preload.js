const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
    login: (username, password, serverUrl) =>
        ipcRenderer.invoke('login', username, password, serverUrl)
});
