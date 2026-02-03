chrome.runtime.onMessage.addListener((r, s, p) => {
    if (r.action === 'SYNC_THEME') {
        chrome.cookies.get({ url: 'https://isy-api.ksr.ch', name: 'token' }, (c) => {
            if (c) {
                console.log(`Isy Sync token: ${c.value}`);
            }
        });
    }
});
