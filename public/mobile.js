// Mobile enhancements — loaded after client.js
(function() {
  'use strict';

  function initVoiceInput() {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      return;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = navigator.language || 'en-US';

    const footer = document.querySelector('footer');
    const sendBtn = footer.querySelector('#sendBtn');
    const micBtn = document.createElement('button');
    micBtn.id = 'micBtn';
    micBtn.type = 'button';
    micBtn.textContent = '🎤';
    micBtn.title = 'Voice input';
    micBtn.style.cssText = 'background:var(--s2);border:1px solid var(--b);color:var(--t2);border-radius:12px;padding:8px 12px;cursor:pointer;flex-shrink:0;';
    footer.insertBefore(micBtn, sendBtn);

    micBtn.onclick = () => {
      if (micBtn.classList.contains('listening')) {
        recognition.stop();
        micBtn.classList.remove('listening');
        micBtn.textContent = '🎤';
      } else {
        recognition.start();
        micBtn.classList.add('listening');
        micBtn.textContent = '🔴';
      }
    };

    recognition.onresult = (event) => {
      const text = event.results[0][0].transcript;
      const inp = document.getElementById('inp');
      inp.value = (inp.value + ' ' + text).trim();
      micBtn.classList.remove('listening');
      micBtn.textContent = '🎤';
    };

    recognition.onerror = () => {
      micBtn.classList.remove('listening');
      micBtn.textContent = '🎤';
    };
  }

  function initShare() {
    if (!navigator.share) return;

    const originalDownload = window.downloadFile;
    if (typeof originalDownload !== 'function') return;

    window.downloadFile = function(file) {
      if (/Android|iPhone|iPad|iPod/i.test(navigator.userAgent)) {
        const blob = new Blob([file.content], { type: 'text/plain;charset=utf-8' });
        const shareData = {
          title: file.path,
          text: file.content.substring(0, 500),
          files: [new File([blob], file.path.split('/').pop(), { type: 'text/plain' })]
        };

        if (navigator.canShare && navigator.canShare(shareData)) {
          navigator.share(shareData).catch(() => originalDownload(file));
          return;
        }
      }
      originalDownload(file);
    };
  }

  async function initWakeLock() {
    if (!('wakeLock' in navigator)) return;

    const originalSend = window.send;
    if (typeof originalSend !== 'function') return;

    let wakeLock = null;
    window.send = async function() {
      try {
        wakeLock = await navigator.wakeLock.request('screen');
      } catch {}
      try {
        await originalSend();
      } finally {
        if (wakeLock) {
          try { await wakeLock.release(); } catch {}
          wakeLock = null;
        }
      }
    };
  }

  function initNetworkStatus() {
    const updateNetworkStatus = () => {
      if (!navigator.onLine) {
        const dot = document.getElementById('dot');
        if (dot) dot.style.background = 'var(--y)';
        const txt = document.getElementById('statusText');
        if (txt) txt.textContent = 'Offline (cached)';
      } else if (typeof checkHealth === 'function') {
        checkHealth();
      }
    };

    window.addEventListener('online', updateNetworkStatus);
    window.addEventListener('offline', updateNetworkStatus);
    updateNetworkStatus();
  }

  function initPullToRefresh() {
    let touchStart = 0;
    const main = document.querySelector('main');
    if (!main) return;

    main.addEventListener('touchstart', (e) => {
      if (main.scrollTop === 0) touchStart = e.touches[0].clientY;
    }, { passive: true });

    main.addEventListener('touchmove', (e) => {
      if (main.scrollTop === 0 && e.touches[0].clientY - touchStart > 80) {
        if (typeof checkHealth === 'function') checkHealth();
        touchStart = 0;
      }
    }, { passive: true });
  }

  function initMobile() {
    initVoiceInput();
    initShare();
    initWakeLock();
    initNetworkStatus();
    initPullToRefresh();

    if (/Mobi|Android/i.test(navigator.userAgent)) {
      document.body.classList.add('mobile-device');
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initMobile);
  } else {
    initMobile();
  }
})();
