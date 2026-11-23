(() => {
  const { invoke } = window.__TAURI__.core;
  const { listen } = window.__TAURI__.event;
  const currentWindow = window.__TAURI__.window.getCurrentWindow();

  const INSTALL_STEPS = ['Hoş Geldiniz', 'Lisans', 'Modüller & Konum', 'Kuruluyor', 'Tamamlandı'];
  const UNINSTALL_STEPS = ['Kaldırma Onayı', 'Kaldırılıyor', 'Tamamlandı'];

  const state = {
    mode: 'install',
    version: '1.0.0',
    step: 0,
    accepted: false,
    installDir: '',
    dataDir: '',
    isUpgrade: false,
    payloadBytes: 0,
    freeDiskBytes: 0,
    licenseText: '',
    desktopShortcut: true,
    startMenuShortcut: true,
    autoStart: false,
    launchAfter: true,
    dirValid: true,
    busy: false,
    pct: 0,
    phase: 'Hazırlanıyor…',
    detail: '',
    installedExe: '',
    error: null,
  };

  const $ = (id) => document.getElementById(id);

  function esc(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function fmtSize(bytes) {
    if (!bytes || bytes <= 0) return '—';
    const gb = bytes / (1024 ** 3);
    if (gb >= 1) return `${gb.toFixed(1)} GB`;
    const mb = bytes / (1024 ** 2);
    return `${Math.max(1, Math.round(mb))} MB`;
  }

  function setError(msg) {
    state.error = msg || null;
    const bar = $('errorBar');
    if (state.error) {
      bar.textContent = state.error;
      bar.hidden = false;
    } else {
      bar.hidden = true;
      bar.textContent = '';
    }
  }

  function renderSteps() {
    const steps = state.mode === 'uninstall' ? UNINSTALL_STEPS : INSTALL_STEPS;
    $('stepList').innerHTML = steps
      .map((label, idx) => {
        const cls = idx === state.step ? 'is-active' : idx < state.step ? 'is-done' : '';
        return `<li class="step-item ${cls}"><span class="step-dot"></span><span>${esc(label)}</span></li>`;
      })
      .join('');
  }

  function renderInstallPane() {
    if (state.step === 0) {
      const upgradeBanner = state.isUpgrade
        ? `<div class="note-box">Mevcut bir MarbleOS Studio kurulumu algılandı. Uygulama güncellenecek; tüm okul, öğrenci ve fotoğraf kayıtlarınız (${esc(state.dataDir)}) eksiksiz korunacaktır.</div>`
        : '';
      return `
        <div class="pane pane-center">
          <div class="eyebrow">KURULUMA HOŞ GELDİNİZ</div>
          <h1>MarbleOS Studio</h1>
          <p class="lead">Okul fotoğrafçılığı için vesikalık, biyometrik, PVC kimlik kartı, sınıf albümü ve idareci kütük dosyasını 300 DPI kalitede tek çalışma alanında hazırlayın.</p>
          <div class="cards-3">
            <div class="mini-card"><strong>300 DPI</strong><span>Doğrudan baskı</span></div>
            <div class="mini-card"><strong>Çevrimdışı</strong><span>İnternet gerekmez</span></div>
            <div class="mini-card"><strong>Yerel Kasa</strong><span>Şifreli SQLite</span></div>
          </div>
          ${upgradeBanner}
        </div>`;
    }

    if (state.step === 1) {
      return `
        <div class="pane">
          <h2>Kullanım Koşulları &amp; Lisans</h2>
          <p class="lead">Kuruluma devam etmeden önce lütfen sözleşmeyi inceleyin.</p>
          <div class="license-box">${esc(state.licenseText)}</div>
          <label class="check-line">
            <input id="chkAccept" type="checkbox" class="chk" ${state.accepted ? 'checked' : ''} />
            <span>Sözleşmeyi okudum ve kabul ediyorum</span>
          </label>
        </div>`;
    }

    if (state.step === 2) {
      const needBytes = Math.max(12 * 1024 * 1024, state.payloadBytes * 2);
      return `
        <div class="pane">
          <h2>Modüller &amp; Kurulum Konumu</h2>
          <p class="lead">Yönetici izni gerektirmez; yalnız bu kullanıcı hesabı için kurulur.</p>
          <div class="mod-scroll">
            <div>
              <div class="field-label">Uygulama Klasörü</div>
              <div class="path-row">
                <input id="txtDir" type="text" class="path-input" value="${esc(state.installDir)}" spellcheck="false" />
                <button type="button" id="btnBrowse" class="btn">Değiştir</button>
              </div>
              <div class="sub-meta">
                <span>Gereken alan: ~${fmtSize(needBytes)}</span>
                <span>Kullanılabilir: ${fmtSize(state.freeDiskBytes)}</span>
              </div>
            </div>

            <div>
              <div class="field-label">Kurulum Modülleri</div>
              <div class="modules-list">
                <label class="mod-row is-locked">
                  <input type="checkbox" class="chk" checked disabled />
                  <div class="mod-row-text">
                    <strong>MarbleOS Studio Çekirdek Uygulama (Zorunlu)</strong>
                    <span>4 Stüdyo Modülü · 300 DPI Baskı Motoru · Yerel Şifreli SQLite</span>
                  </div>
                </label>
                <label class="mod-row">
                  <input id="chkDesktop" type="checkbox" class="chk" ${state.desktopShortcut ? 'checked' : ''} />
                  <div class="mod-row-text">
                    <strong>Masaüstü Kısayolu</strong>
                    <span>Masaüstüne doğrudan başlatma simgesi oluştur</span>
                  </div>
                </label>
                <label class="mod-row">
                  <input id="chkStartMenu" type="checkbox" class="chk" ${state.startMenuShortcut ? 'checked' : ''} />
                  <div class="mod-row-text">
                    <strong>Başlat Menüsü Kısayolu</strong>
                    <span>Windows Başlat menüsüne ve arama sonuçlarına ekle</span>
                  </div>
                </label>
                <label class="mod-row">
                  <input id="chkAutoStart" type="checkbox" class="chk" ${state.autoStart ? 'checked' : ''} />
                  <div class="mod-row-text">
                    <strong>Windows Açılışında Başlat</strong>
                    <span>Bilgisayar açıldığında stüdyoyu otomatik hazırla (isteğe bağlı)</span>
                  </div>
                </label>
              </div>
            </div>
          </div>
        </div>`;
    }

    if (state.step === 3) {
      return `
        <div class="pane pane-center">
          <h2>MarbleOS Studio Kuruluyor…</h2>
          <p class="lead" id="progPhase">${esc(state.phase)}</p>
          <div class="progress-track"><div class="progress-fill" id="progFill" style="width:${state.pct}%"></div></div>
          <div class="progress-meta"><span id="progPct">%${state.pct}</span><span>Lütfen pencereyi kapatmayın</span></div>
          <div class="progress-detail" id="progDetail">${esc(state.detail)}</div>
        </div>`;
    }

    return `
      <div class="pane pane-center">
        <svg class="done-icon" width="44" height="44" viewBox="0 0 44 44" aria-hidden="true">
          <circle cx="22" cy="22" r="20" fill="#30d158" opacity=".16"/>
          <path d="M13 22.5l6 6 12-13" fill="none" stroke="#30d158" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
        <h2>Kurulum Tamamlandı</h2>
        <p class="lead">MarbleOS Studio başarıyla kuruldu ve kullanıma hazır. İlk açılışta yerel veritabanı otomatik hazırlanır.</p>
        <div class="done-path">${esc(state.installDir)}</div>
        <label class="check-line">
          <input id="chkLaunch" type="checkbox" class="chk" ${state.launchAfter ? 'checked' : ''} />
          <span>MarbleOS Studio'yu şimdi başlat</span>
        </label>
      </div>`;
  }

  function renderUninstallPane() {
    if (state.step === 0) {
      return `
        <div class="pane pane-center">
          <div class="eyebrow">UYGULAMAYI KALDIR</div>
          <h1>MarbleOS Studio</h1>
          <p class="lead">Uygulama dosyaları, masaüstü ve Başlat Menüsü kısayolları bu bilgisayardan kaldırılacaktır.</p>
          <div class="note-box">Okul, öğrenci ve fotoğraf verileriniz (${esc(state.dataDir)}) güvenlik amacıyla <strong>silinmez ve korunur</strong>.</div>
        </div>`;
    }
    if (state.step === 1) {
      return `
        <div class="pane pane-center">
          <h2>Kaldırılıyor…</h2>
          <p class="lead" id="progPhase">${esc(state.phase)}</p>
          <div class="progress-track"><div class="progress-fill" id="progFill" style="width:${state.pct}%"></div></div>
          <div class="progress-meta"><span id="progPct">%${state.pct}</span><span>Lütfen bekleyin</span></div>
          <div class="progress-detail" id="progDetail">${esc(state.detail)}</div>
        </div>`;
    }
    return `
      <div class="pane pane-center">
        <svg class="done-icon" width="44" height="44" viewBox="0 0 44 44" aria-hidden="true">
          <circle cx="22" cy="22" r="20" fill="#30d158" opacity=".16"/>
          <path d="M13 22.5l6 6 12-13" fill="none" stroke="#30d158" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
        <h2>Kaldırma Tamamlandı</h2>
        <p class="lead">MarbleOS Studio bu bilgisayardan temiz şekilde kaldırıldı. Yerel veri klasörünüz korundu.</p>
      </div>`;
  }

  function renderFooter() {
    const back = $('btnBack');
    const cancel = $('btnCancel');
    const next = $('btnNext');
    next.className = 'btn btn-primary';

    if (state.mode === 'uninstall') {
      back.style.visibility = 'hidden';
      cancel.style.visibility = state.step === 0 ? 'visible' : 'hidden';
      if (state.step === 0) {
        next.textContent = 'Kaldır';
        next.className = 'btn btn-danger';
        next.disabled = state.busy;
      } else if (state.step === 1) {
        next.textContent = 'Kaldırılıyor…';
        next.disabled = true;
      } else {
        next.textContent = 'Kapat';
        next.disabled = false;
      }
      return;
    }

    back.style.visibility = state.step === 0 || state.step >= 3 ? 'hidden' : 'visible';
    back.disabled = state.busy;
    cancel.style.visibility = state.step >= 3 ? 'hidden' : 'visible';
    cancel.disabled = state.busy;
    next.textContent = ['Devam', 'Kabul Et ve Devam', state.isUpgrade ? 'Güncelle' : 'Kur', 'Kuruluyor…', 'Bitir'][state.step];
    next.disabled =
      state.busy ||
      (state.step === 1 && !state.accepted) ||
      (state.step === 2 && !state.dirValid) ||
      state.step === 3;
  }

  function bindPaneEvents() {
    const chkAccept = $('chkAccept');
    if (chkAccept) chkAccept.addEventListener('change', (e) => { state.accepted = e.target.checked; renderFooter(); });

    const chkDesktop = $('chkDesktop');
    if (chkDesktop) chkDesktop.addEventListener('change', (e) => { state.desktopShortcut = e.target.checked; });

    const chkStartMenu = $('chkStartMenu');
    if (chkStartMenu) chkStartMenu.addEventListener('change', (e) => { state.startMenuShortcut = e.target.checked; });

    const chkAutoStart = $('chkAutoStart');
    if (chkAutoStart) chkAutoStart.addEventListener('change', (e) => { state.autoStart = e.target.checked; });

    const chkLaunch = $('chkLaunch');
    if (chkLaunch) chkLaunch.addEventListener('change', (e) => { state.launchAfter = e.target.checked; });

    const txtDir = $('txtDir');
    if (txtDir) {
      txtDir.addEventListener('input', async (e) => {
        state.installDir = e.target.value;
        const res = await invoke('installer_check_dir', { path: state.installDir });
        state.dirValid = res.valid;
        if (res.valid) {
          state.freeDiskBytes = res.freeDiskBytes;
          setError(null);
        } else {
          setError(res.error || 'Geçersiz kurulum klasörü.');
        }
        renderFooter();
      });
    }

    const btnBrowse = $('btnBrowse');
    if (btnBrowse) {
      btnBrowse.addEventListener('click', async () => {
        setError(null);
        try {
          const picked = await invoke('installer_pick_dir');
          if (picked && picked.path) {
            state.installDir = picked.path;
            state.freeDiskBytes = picked.freeDiskBytes;
            state.dirValid = true;
            render();
          }
        } catch (err) {
          setError(typeof err === 'string' ? err : 'Klasör seçilemedi.');
        }
      });
    }
  }

  function render() {
    renderSteps();
    $('pane').innerHTML = state.mode === 'uninstall' ? renderUninstallPane() : renderInstallPane();
    bindPaneEvents();
    renderFooter();
  }

  async function startInstall() {
    setError(null);
    state.busy = true;
    state.step = 3;
    state.pct = 5;
    state.phase = 'Kurulum başlatılıyor…';
    state.detail = state.installDir;
    render();
    try {
      const outcome = await invoke('installer_run_install', {
        options: {
          installDir: state.installDir,
          createDesktopShortcut: state.desktopShortcut,
          createStartMenuShortcut: state.startMenuShortcut,
          autoStart: state.autoStart,
        },
      });
      state.installedExe = outcome.exePath;
      state.installDir = outcome.installDir;
      state.pct = 100;
      state.busy = false;
      state.step = 4;
      render();
    } catch (err) {
      state.busy = false;
      state.step = 2;
      setError(typeof err === 'string' ? err : 'Kurulum tamamlanamadı.');
      render();
    }
  }

  async function startUninstall() {
    setError(null);
    state.busy = true;
    state.step = 1;
    state.pct = 10;
    state.phase = 'Kaldırma başlatılıyor…';
    state.detail = '';
    render();
    try {
      await invoke('installer_run_uninstall');
      state.pct = 100;
      state.busy = false;
      state.step = 2;
      render();
    } catch (err) {
      state.busy = false;
      state.step = 0;
      setError(typeof err === 'string' ? err : 'Kaldırma tamamlanamadı.');
      render();
    }
  }

  $('btnMin').addEventListener('click', () => void currentWindow.minimize());
  $('btnClose').addEventListener('click', () => { if (!state.busy) void currentWindow.close(); });
  $('btnCancel').addEventListener('click', () => { if (!state.busy) void currentWindow.close(); });
  $('btnBack').addEventListener('click', () => {
    if (state.busy || state.step <= 0) return;
    setError(null);
    state.step -= 1;
    render();
  });

  $('btnNext').addEventListener('click', async () => {
    if (state.busy) return;
    if (state.mode === 'uninstall') {
      if (state.step === 0) await startUninstall();
      else if (state.step === 2) await currentWindow.close();
      return;
    }
    if (state.step === 2) {
      await startInstall();
    } else if (state.step === 4) {
      if (state.launchAfter && state.installedExe) {
        try {
          await invoke('installer_launch_app', { exePath: state.installedExe });
        } catch (err) {
          setError(typeof err === 'string' ? err : 'Uygulama başlatılamadı.');
          return;
        }
      }
      await currentWindow.close();
    } else {
      setError(null);
      state.step += 1;
      render();
    }
  });

  async function boot() {
    await listen('installer-progress', (ev) => {
      const p = ev.payload;
      state.pct = p.percent;
      state.phase = p.phase;
      state.detail = p.detail;
      const fill = $('progFill');
      const pct = $('progPct');
      const phase = $('progPhase');
      const detail = $('progDetail');
      if (fill) fill.style.width = `${p.percent}%`;
      if (pct) pct.textContent = `%${p.percent}`;
      if (phase) phase.textContent = p.phase;
      if (detail) detail.textContent = p.detail;
    });

    const init = await invoke('installer_init');
    state.version = init.version;
    state.mode = init.mode;
    state.installDir = init.defaultInstallDir;
    state.dataDir = init.dataDir;
    state.payloadBytes = init.payloadBytes;
    state.freeDiskBytes = init.freeDiskBytes;
    state.licenseText = init.licenseText;
    state.isUpgrade = init.isUpgrade;
    $('winVer').textContent = init.version;
    $('winTitle').textContent =
      init.mode === 'uninstall' ? 'MarbleOS Studio Kaldırma' : 'MarbleOS Studio Kurulumu';
    render();
  }

  void boot();
})();
