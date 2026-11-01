/* ════════════════════════════════════════════════���════════════════
   GALLERY CANVAS — Images & Videos on a full canvas with tabs,
   drag & drop, token placement. Mirrors Items Canvas architecture.
   ═══════════════════════════════════════════════════════════════ */

const GALLERY_CANVAS_ICONS = [
  // Media core
  "fa-image","fa-photo-film","fa-film","fa-video","fa-camera","fa-camera-retro",
  "fa-portrait","fa-palette","fa-brush","fa-icons","fa-circle-play","fa-clapperboard",
  // Places & Scenes
  "fa-map","fa-map-location-dot","fa-mountain","fa-city","fa-tree","fa-campground",
  "fa-water","fa-sun","fa-moon","fa-cloud","fa-bolt","fa-fire","fa-rainbow",
  // Beings
  "fa-dragon","fa-ghost","fa-robot","fa-user-astronaut","fa-skull","fa-dungeon",
  "fa-chess-rook","fa-crown","fa-hat-wizard","fa-user-secret","fa-paw",
  // Lore & Misc
  "fa-scroll","fa-book-open","fa-music","fa-volume-high","fa-star","fa-heart",
  "fa-gem","fa-eye","fa-compass","fa-lightbulb"
];

const GALLERY_VIDEO_EXTS = ["mp4", "webm", "ogv", "ogg", "mov", "m4v", "avi", "mkv"];

/* ────────────────────────────────────────────────────────────────
   GLOBAL MEDIA VIEWER — fancy lightbox used by the GM preview
   (click token) AND by players receiving a "galleryShow" socket.
   Exposed on window so cypher-gm-taskbar.js can call it.
   ──────────────────────────────────────────────────────────────── */
function cypherShowGalleryMedia({ src, name = "Media", mediaType = null } = {}) {
  if (!src) return;
  const type = mediaType || _galleryMediaType(src);

  // Close any existing viewer
  document.querySelector(".cgm-gallery-viewer-overlay")?.remove();

  const overlay = document.createElement("div");
  overlay.className = "cgm-gallery-viewer-overlay";
  overlay.innerHTML = `
    <div class="cgm-gallery-viewer-frame">
      <div class="cgm-gallery-viewer-media">
        ${type === "video"
          ? `<video src="${src}" controls autoplay loop playsinline></video>`
          : `<img src="${src}" alt="${foundry.utils.escapeHTML(name)}" draggable="false">`}
      </div>
      <div class="cgm-gallery-viewer-caption">
        <i class="fas ${type === "video" ? "fa-film" : "fa-image"}"></i>
        <span>${foundry.utils.escapeHTML(name)}</span>
      </div>
    </div>
    <button class="cgm-gallery-viewer-close" title="Close (Esc)"><i class="fas fa-times"></i></button>
  `;
  document.body.appendChild(overlay);

  let removed = false;
  const done = () => {
    if (removed) return;
    removed = true;
    overlay.remove();
  };

  const closeViewer = () => {
    if (overlay.classList.contains("cgm-gallery-viewer-closing")) return;
    overlay.classList.add("cgm-gallery-viewer-closing");
    const frame = overlay.querySelector(".cgm-gallery-viewer-frame");
    if (frame) frame.addEventListener("animationend", done, { once: true });
    setTimeout(done, 450); // fallback if animationend never fires
    document.removeEventListener("keydown", onKey);
  };
  const onKey = (e) => { if (e.key === "Escape") closeViewer(); };

  // Click anywhere on the transparent catcher closes; media/caption clicks
  // are stopped so they don't bubble to the catcher.
  overlay.addEventListener("mousedown", (e) => { if (e.target === overlay) closeViewer(); });
  overlay.querySelector(".cgm-gallery-viewer-frame")?.addEventListener("mousedown", (e) => e.stopPropagation());
  overlay.querySelector(".cgm-gallery-viewer-close")?.addEventListener("click", closeViewer);
  document.addEventListener("keydown", onKey);
}

function _galleryMediaType(src) {
  if (!src) return "image";
  const clean = src.split("?")[0].split("#")[0];
  const ext = clean.includes(".") ? clean.split(".").pop().toLowerCase() : "";
  return GALLERY_VIDEO_EXTS.includes(ext) ? "video" : "image";
}

window.cypherShowGalleryMedia = cypherShowGalleryMedia;

/* ═══════════════════════════════════════════════════════════════
   GALLERY CANVAS CLASS
   ═══════════════════════════════════════════════════════════════ */

class GalleryCanvas extends foundry.applications.api.ApplicationV2 {
  static DEFAULT_OPTIONS = {
    id: "cgm-gallery-canvas",
    classes: ["cgm-npc-canvas-app", "cgm-fancy-panel"],
    tag: "div",
    window: {
      frame: false,
      minimizable: false,
      resizable: false,
      controls: []
    },
    position: {
      width: 700,
      height: "auto"
    }
  };

  constructor(options = {}) {
    super(options);
    this._tabs = [];
    this._activeTab = "scenes";
    this._media = {};
    this._tabSettings = {};
    this._contextMenu = null;
    this._loading = false;
    this._dragOver = false;
    this._dataLoaded = false;

    // Camera state (per-tab memory)
    this._camera = { x: 0, y: 0, zoom: 1 };
    this._cameras = {};
    this._isPanning = false;
    this._panStart = { x: 0, y: 0 };
    this._cameraStart = { x: 0, y: 0 };

    this._draggingToken = null;
    this._dragOffset = { x: 0, y: 0 };

    this._searchQuery = "";
    this._showSearchInput = false;
    this._locked = false;
  }

  /* Per-tab camera memory */
  _cameraFor(tabId) {
    return this._cameras[tabId] || { x: 0, y: 0, zoom: 1 };
  }

  _switchTabCamera(newTabId) {
    this._cameras[this._activeTab] = this._camera;
    this._camera = { ...this._cameraFor(newTabId) };
  }

  toggle() {
    if (this.rendered) {
      if (this._locked) {
        ui.notifications.info("Gallery Canvas is locked. Unlock to close.");
        return;
      }
      this.close();
    } else {
      this.render({ force: true });
    }
  }

  /* ================================================================
     SETTINGS HELPERS
     ================================================================ */

  _getTabSettings(tabId) {
    const defaults = {
      fontFamily: "",
      fontColor: "",
      fontSize: 11,
      fontUppercase: true,
      fontBold: true,
      tabBgColor: "",
      label: "",
      icon: "",
      bgImage: "",
      bgFit: "cover",
      bgAlign: "center",
      bgOpacity: 1,
      gridType: "square",
      gridColor: "#c8a96e",
      gridOpacity: 0.05,
      gridSize: 50,
      gridThickness: 1,
      snapToGrid: false,
      showGrid: true,
      canvasOpacity: 1
    };
    if (!this._tabSettings[tabId]) {
      this._tabSettings[tabId] = { ...defaults };
    } else {
      for (const key of Object.keys(defaults)) {
        if (this._tabSettings[tabId][key] === undefined) {
          this._tabSettings[tabId][key] = defaults[key];
        }
      }
    }
    return this._tabSettings[tabId];
  }

  _getEffectiveTab(tabId) {
    const tab = this._tabs.find(t => t.id === tabId);
    const settings = this._getTabSettings(tabId);
    return {
      ...tab,
      label: settings.label || tab?.label || tabId,
      icon: settings.icon || tab?.icon || "fa-image"
    };
  }

  /* ================================================================
     RENDER
     ================================================================ */

  async _prepareContext(options) {
    if (!this._dataLoaded) {
      this._loading = true;
      await this._loadFromFlags();
      this._loading = false;
      this._dataLoaded = true;
      this._ensureDefaultTabs();
    }
    return {
      tabs: this._tabs,
      activeTab: this._activeTab,
      media: this._media[this._activeTab] || [],
      dragOver: this._dragOver,
      camera: this._camera
    };
  }

  async _renderHTML(context, options) {
    const settings = this._getTabSettings(this._activeTab);
    const tabsHTML = this._tabs.map(t => this._buildTabHTML(t)).join("");
    const allMedia = this._media[this._activeTab] || [];
    const media = this._getFilteredMedia(this._activeTab);
    const mediaHTML = media.map((m) => this._buildMediaTokenHTML(m, settings)).join("");
    const hasSearch = this._searchQuery.trim().length > 0;

    const gridSize = (settings.gridSize || 50) * this._camera.zoom;
    const gridOffsetX = this._camera.x % gridSize;
    const gridOffsetY = this._camera.y % gridSize;

    const bgStyle = settings.bgImage
      ? `background-image: url('${settings.bgImage}'); background-size: ${settings.bgFit}; background-position: ${this._mapAlign(settings.bgAlign)}; opacity: ${settings.bgOpacity};`
      : "";

    return `
      <div class="cgm-npc-canvas-container cgm-fancy-container" style="opacity: ${settings.canvasOpacity ?? 1};">
        <div class="cgm-npc-canvas-main">
          <div class="cgm-npc-canvas-header cgm-fancy-header">
            <div class="cgm-fancy-title-wrap">
              <i class="fas fa-photo-film"></i>
              <span class="cgm-npc-canvas-title">Gallery</span>
            </div>
            <div class="cgm-npc-canvas-header-controls">
              ${this._showSearchInput ? `
                <div class="cgm-canvas-search-wrap">
                  <input type="text" class="cgm-canvas-search-input" placeholder="Search media..." value="${foundry.utils.escapeHTML(this._searchQuery)}">
                  ${hasSearch ? `<span class="cgm-canvas-search-count">${media.length}/${allMedia.length}</span>` : ''}
                  <button class="cgm-canvas-search-clear" title="Clear"><i class="fas fa-times"></i></button>
                </div>
              ` : ''}
              <button class="cgm-npc-canvas-search-toggle" title="Search"><i class="fas fa-search"></i></button>
            </div>
            <div class="cgm-npc-canvas-header-btns">
              <button class="cgm-gallery-add-media" title="Add Image / Video"><i class="fas fa-file-arrow-up"></i></button>
              <button class="cgm-npc-canvas-lock" title="${this._locked ? 'Unlock' : 'Lock'}"><i class="fas ${this._locked ? 'fa-lock' : 'fa-lock-open'}"></i></button>
              <button class="cgm-npc-canvas-reset-view" title="Reset View"><i class="fas fa-compress"></i></button>
              <button class="cgm-npc-canvas-add-tab" title="Add Tab"><i class="fas fa-plus"></i></button>
              <button class="cgm-npc-canvas-close" title="Close"><i class="fas fa-times"></i></button>
            </div>
          </div>
          <div class="cgm-npc-canvas-body">
            <div class="cgm-npc-canvas-viewport ${this._dragOver ? 'cgm-npc-canvas-dragover' : ''}" data-tab="${this._activeTab}">
              <div class="cgm-npc-canvas-bg-layer" style="${bgStyle}"></div>
              <div class="cgm-npc-canvas-world"
                   style="transform: translate(${this._camera.x}px, ${this._camera.y}px) scale(${this._camera.zoom});">
                ${settings.showGrid !== false ? `
                <div class="cgm-npc-canvas-grid"
                     style="background-size: ${gridSize}px ${gridSize}px; background-position: ${gridOffsetX}px ${gridOffsetY}px; opacity: ${settings.gridOpacity}; --grid-color: ${settings.gridColor || '#c8a96e'};"></div>
                ` : ''}
                <div class="cgm-npc-canvas-tokens">
                  ${media.length === 0 ? '' : mediaHTML}
                </div>
              </div>
              ${media.length === 0 && !hasSearch ? `
                <div class="cgm-npc-canvas-empty-overlay">
                  <div class="cgm-drop-zone-icon"><i class="fas fa-photo-film"></i></div>
                  <p>Drag images or videos here</p>
                  <span class="cgm-drop-hint">Click <i class="fas fa-file-arrow-up"></i> to browse · Scroll to zoom · Drag to pan</span>
                </div>
              ` : media.length === 0 && hasSearch ? `
                <div class="cgm-npc-canvas-empty-overlay">
                  <div class="cgm-drop-zone-icon"><i class="fas fa-search"></i></div>
                  <p>No media match "${foundry.utils.escapeHTML(this._searchQuery)}"</p>
                  <span class="cgm-drop-hint">Try a different search term</span>
                </div>
              ` : ''}
            </div>
          </div>
        </div>
        <div class="cgm-npc-canvas-tabs cgm-fancy-tabs cgm-tabs-vertical">
          ${tabsHTML}
        </div>
      </div>
    `;
  }

  _mapAlign(align) {
    const map = {
      center: "center",
      "top-left": "top left", top: "top center", "top-right": "top right",
      left: "left center", right: "right center",
      "bottom-left": "bottom left", bottom: "bottom center", "bottom-right": "bottom right"
    };
    return map[align] || "center";
  }

  _buildTabHTML(tab) {
    const settings = this._getTabSettings(tab.id);
    const isActive = tab.id === this._activeTab;
    const eff = this._getEffectiveTab(tab.id);

    const styles = [];
    if (settings.fontFamily) styles.push(`font-family: ${settings.fontFamily}`);
    if (settings.fontColor) styles.push(`color: ${settings.fontColor}`);
    if (settings.fontSize) styles.push(`font-size: ${settings.fontSize}px`);
    if (settings.fontUppercase === false) styles.push(`text-transform: none`);
    if (settings.fontBold === false) styles.push(`font-weight: 400`);
    if (settings.tabBgColor) styles.push(`background: ${settings.tabBgColor}`);

    const styleAttr = styles.length ? `style="${styles.join("; ")}"` : "";

    return `
      <div class="cgm-canvas-tab ${isActive ? 'cgm-canvas-tab-active' : ''}"
           data-tab-id="${tab.id}" data-label="${eff.label}"
           ${styleAttr}>
        <i class="fas ${eff.icon}"></i>
        <span class="cgm-tab-tooltip">${eff.label}</span>
      </div>`;
  }

  /* ================================================================
     FILTER
     ================================================================ */

  _getFilteredMedia(tabId) {
    let media = [...(this._media[tabId] || [])];
    if (this._searchQuery.trim()) {
      const q = this._searchQuery.toLowerCase().trim();
      media = media.filter(m => (m.name || "").toLowerCase().includes(q));
    }
    return media;
  }

  _filterVisibleTokens() {
    const el = this.element;
    if (!el) return;
    const query = this._searchQuery.toLowerCase().trim();
    const tokens = el.querySelectorAll(".cgm-item-token-square");
    let visibleCount = 0;
    const totalCount = tokens.length;

    tokens.forEach(tokenEl => {
      const name = (tokenEl.dataset.name || "").toLowerCase();
      const matches = !query || name.includes(query);
      tokenEl.style.display = matches ? "" : "none";
      if (matches) visibleCount++;
    });

    const countEl = el.querySelector(".cgm-canvas-search-count");
    if (countEl) countEl.textContent = `${visibleCount}/${totalCount}`;

    const emptyOverlay = el.querySelector(".cgm-npc-canvas-empty-overlay");
    const tokensContainer = el.querySelector(".cgm-npc-canvas-tokens");
    if (emptyOverlay) {
      if (visibleCount === 0 && totalCount > 0) {
        emptyOverlay.style.display = "flex";
        emptyOverlay.querySelector("p").textContent = `No media match "${foundry.utils.escapeHTML(this._searchQuery)}"`;
        if (tokensContainer) tokensContainer.style.display = "none";
      } else {
        emptyOverlay.style.display = "none";
        if (tokensContainer) tokensContainer.style.display = "";
      }
    }
  }

  /* ================================================================
     MEDIA TOKEN HTML
     ================================================================ */

  _buildMediaTokenHTML(m, settings) {
    const idx = (this._media[this._activeTab] || []).indexOf(m);
    const name = m.name || "Unknown";
    const src = m.src || "";
    const mediaType = m.mediaType || _galleryMediaType(src);
    const x = m.x ?? 50 + (idx % 6) * 90;
    const y = m.y ?? 50 + Math.floor(idx / 6) * 110;

    const mediaInner = mediaType === "video"
      ? `<video src="${src}" muted preload="metadata" playsinline></video>
         <span class="cgm-gallery-play-badge"><i class="fas fa-play"></i></span>`
      : `<img src="${src}" alt="${foundry.utils.escapeHTML(name)}" draggable="false">`;

    return `
      <div class="cgm-item-token-square cgm-gallery-token" data-media-idx="${idx}" data-name="${foundry.utils.escapeHTML(name)}" data-src="${foundry.utils.escapeHTML(src)}" data-media-type="${mediaType}"
           style="left: ${x}px; top: ${y}px;">
        <div class="cgm-item-token-img-wrap cgm-gallery-img-wrap">
          ${mediaInner}
        </div>
        <div class="cgm-item-token-label">${foundry.utils.escapeHTML(name)}</div>
      </div>
    `;
  }

  _replaceHTML(result, content, options) {
    content.innerHTML = result;
  }

  /* ================================================================
     ON RENDER — Positioning + Event Binding
     ================================================================ */

  _onRender(context, options) {
    if (this.element) {
      this.element.style.position = "fixed";
      this.element.style.left = "50%";
      this.element.style.bottom = "60px";
      this.element.style.transform = "translateX(-50%)";
      this.element.style.width = "700px";
      this.element.style.maxWidth = "90vw";
      this.element.style.maxHeight = "70vh";
      this.element.style.zIndex = "calc(var(--cgm-z-dialog, 10000) - 1)";
      this.element.style.overflow = "visible";
      requestAnimationFrame(() => this.element.classList.add("cgm-fancy-visible"));
    }

    const el = this.element;
    if (!el) return;

    // Close button
    el.querySelector('.cgm-npc-canvas-close')?.addEventListener('click', () => this.close());

    // Add media button (FilePicker — images & videos)
    el.querySelector('.cgm-gallery-add-media')?.addEventListener('click', () => this._pickMediaFile());

    // Lock toggle
    el.querySelector('.cgm-npc-canvas-lock')?.addEventListener('click', () => {
      this._locked = !this._locked;
      const btn = el.querySelector('.cgm-npc-canvas-lock');
      if (btn) {
        btn.title = this._locked ? 'Unlock' : 'Lock';
        btn.querySelector('i')?.classList.toggle('fa-lock', this._locked);
        btn.querySelector('i')?.classList.toggle('fa-lock-open', !this._locked);
      }
      ui.notifications.info(`Gallery Canvas ${this._locked ? 'locked' : 'unlocked'}.`);
    });

    // Reset view
    el.querySelector('.cgm-npc-canvas-reset-view')?.addEventListener('click', () => {
      this._camera = { x: 0, y: 0, zoom: 1 };
      this._cameras[this._activeTab] = this._camera;
      this.render();
    });

    // Add tab
    el.querySelector('.cgm-npc-canvas-add-tab')?.addEventListener('click', () => this._addTab());

    // Search toggle
    el.querySelector('.cgm-npc-canvas-search-toggle')?.addEventListener('click', () => {
      this._showSearchInput = !this._showSearchInput;
      if (!this._showSearchInput) this._searchQuery = "";
      this.render();
    });

    // Search input
    const searchInput = el.querySelector('.cgm-canvas-search-input');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        this._searchQuery = e.target.value;
        this._filterVisibleTokens();
      });
      searchInput.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
          this._showSearchInput = false;
          this._searchQuery = "";
          this.render();
        }
      });
      searchInput.focus();
    }

    // Search clear
    el.querySelector('.cgm-canvas-search-clear')?.addEventListener('click', () => {
      this._searchQuery = "";
      this._filterVisibleTokens();
      const input = el.querySelector('.cgm-canvas-search-input');
      if (input) { input.value = ""; input.focus(); }
    });

    // Tab switching
    el.querySelectorAll('.cgm-canvas-tab').forEach(tab => {
      tab.addEventListener('click', (e) => {
        if (e.button !== 0) return;
        const tabId = tab.dataset.tabId;
        if (tabId && tabId !== this._activeTab) {
          this._switchTabCamera(tabId);
          this._activeTab = tabId;
          this.render();
        }
      });
      tab.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        this._showTabContextMenu(e, tab.dataset.tabId);
      });
    });

    // Viewport drag & drop + pan + zoom
    const viewport = el.querySelector('.cgm-npc-canvas-viewport');
    if (viewport) {
      viewport.addEventListener('dragenter', (e) => {
        e.preventDefault();
        if (this._locked) return;
        this._dragOver = true;
        viewport.classList.add('cgm-npc-canvas-dragover');
      });
      viewport.addEventListener('dragover', (e) => { e.preventDefault(); });
      viewport.addEventListener('dragleave', (e) => {
        if (!viewport.contains(e.relatedTarget)) {
          this._dragOver = false;
          viewport.classList.remove('cgm-npc-canvas-dragover');
        }
      });
      viewport.addEventListener('drop', async (e) => {
        e.preventDefault();
        if (this._locked) return;
        this._dragOver = false;
        viewport.classList.remove('cgm-npc-canvas-dragover');

        const raw = e.dataTransfer.getData('text/plain');
        if (!raw) return;

        const rect = viewport.getBoundingClientRect();
        const x = (e.clientX - rect.left - this._camera.x) / this._camera.zoom;
        const y = (e.clientY - rect.top - this._camera.y) / this._camera.zoom;

        // 1) Foundry File drop (from file picker / tile / etc.)
        try {
          const data = JSON.parse(raw);
          if (data.type === 'File' && data.path) {
            await this._addMediaToTab(this._activeTab, { src: data.path, name: this._mediaNameFromPath(data.path) }, x, y);
            return;
          }
          if (data.type === 'Item' && data.uuid) {
            const item = await fromUuid(data.uuid).catch(() => null);
            if (item?.img) {
              await this._addMediaToTab(this._activeTab, { src: item.img, name: item.name }, x, y);
            }
            return;
          }
        } catch (err) { /* not JSON — fall through to plain URL */ }

        // 2) Plain URL / path dragged from browser or OS
        const text = raw.trim();
        if (/^(https?:\/\/|\/|\.\/|\.\.\/)/i.test(text)) {
          await this._addMediaToTab(this._activeTab, { src: text, name: this._mediaNameFromPath(text) }, x, y);
        }
      });

      viewport.addEventListener('mousedown', (e) => {
        if (e.button === 1 || (e.button === 0 && e.shiftKey)) {
          e.preventDefault();
          this._isPanning = true;
          this._panStart = { x: e.clientX, y: e.clientY };
          this._cameraStart = { ...this._camera };
          viewport.style.cursor = 'grabbing';
        }
      });

      viewport.addEventListener('wheel', (e) => {
        e.preventDefault();
        const zoomSpeed = 0.001;
        const newZoom = Math.max(0.2, Math.min(3, this._camera.zoom - e.deltaY * zoomSpeed));
        this._camera.zoom = newZoom;
        this.render();
      }, { passive: false });
    }

    // Token drag + click + context menu + tooltip
    el.querySelectorAll('.cgm-item-token-square').forEach(tokenEl => {
      tokenEl.addEventListener('mousedown', (e) => {
        if (this._locked) return;
        if (e.button !== 0) return;
        e.stopPropagation();
        this._draggingToken = tokenEl;
        const rect = tokenEl.getBoundingClientRect();
        this._dragOffset = {
          x: e.clientX - rect.left,
          y: e.clientY - rect.top
        };
        tokenEl.classList.add('cgm-token-dragging');
      });

      tokenEl.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this._showMediaContextMenu(e, tokenEl);
      });

      tokenEl.addEventListener('click', (e) => {
        if (this._draggingToken) return;
        // Click → open local viewer (GM preview)
        const src = tokenEl.dataset.src;
        const name = tokenEl.dataset.name;
        const mediaType = tokenEl.dataset.mediaType;
        if (src) cypherShowGalleryMedia({ src, name, mediaType });
      });

      tokenEl.addEventListener('mouseenter', () => {
        this._showMediaTooltip(tokenEl);
      });
      tokenEl.addEventListener('mouseleave', () => {
        this._hideMediaTooltip();
      });
    });

    // Global mouse move/up for panning and token dragging
    const onMouseMove = (e) => {
      if (this._isPanning) {
        const dx = e.clientX - this._panStart.x;
        const dy = e.clientY - this._panStart.y;
        this._camera.x = this._cameraStart.x + dx;
        this._camera.y = this._cameraStart.y + dy;
        const world = el.querySelector('.cgm-npc-canvas-world');
        if (world) {
          world.style.transform = `translate(${this._camera.x}px, ${this._camera.y}px) scale(${this._camera.zoom})`;
        }
      }
      if (this._draggingToken) {
        const vp = el.querySelector('.cgm-npc-canvas-viewport');
        if (!vp) return;
        const vpRect = vp.getBoundingClientRect();
        const x = (e.clientX - vpRect.left - this._dragOffset.x - this._camera.x) / this._camera.zoom;
        const y = (e.clientY - vpRect.top - this._dragOffset.y - this._camera.y) / this._camera.zoom;
        this._draggingToken.style.left = `${x}px`;
        this._draggingToken.style.top = `${y}px`;
      }
    };

    const onMouseUp = async (e) => {
      if (this._isPanning) {
        this._isPanning = false;
        const vp = el.querySelector('.cgm-npc-canvas-viewport');
        if (vp) vp.style.cursor = '';
        await this._saveToFlags();
      }
      if (this._draggingToken) {
        const idx = parseInt(this._draggingToken.dataset.mediaIdx);
        const x = parseFloat(this._draggingToken.style.left);
        const y = parseFloat(this._draggingToken.style.top);
        const media = this._media[this._activeTab];
        if (media && media[idx]) {
          const s = this._getTabSettings(this._activeTab);
          if (s.snapToGrid) {
            const gs = s.gridSize || 50;
            media[idx].x = Math.round(x / gs) * gs;
            media[idx].y = Math.round(y / gs) * gs;
            this._draggingToken.style.left = `${media[idx].x}px`;
            this._draggingToken.style.top = `${media[idx].y}px`;
          } else {
            media[idx].x = x;
            media[idx].y = y;
          }
          await this._saveToFlags();
        }

        this._draggingToken.classList.remove('cgm-token-dragging');
        this._draggingToken = null;
      }
    };

    if (this._cleanupMouseListeners) this._cleanupMouseListeners();
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
    this._cleanupMouseListeners = () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };
  }

  /* ================================================================
     MEDIA MANAGEMENT
     ================================================================ */

  _mediaNameFromPath(path) {
    if (!path) return "Media";
    const clean = decodeURIComponent(path.split("?")[0]).replace(/\\/g, "/");
    const base = clean.split("/").pop() || "Media";
    const noExt = base.replace(/\.[a-z0-9]+$/i, "");
    // Title-case: replace _ and - with spaces, capitalize words
    return noExt.replace(/[_-]+/g, " ").replace(/\b\w/g, c => c.toUpperCase()) || "Media";
  }

  async _addMediaToTab(tabId, { src, name }, x = 0, y = 0) {
    if (!src) return;
    if (!this._media[tabId]) this._media[tabId] = [];

    // Prevent duplicates by source path
    if (this._media[tabId].find(m => m.src === src)) {
      ui.notifications.info(`"${name}" is already on this tab.`);
      return;
    }

    this._media[tabId].push({
      id: foundry.utils.randomID(),
      name: name || this._mediaNameFromPath(src),
      src: src,
      mediaType: _galleryMediaType(src),
      x: x,
      y: y
    });

    ui.notifications.info(`Added "${name}" to Gallery.`);
    await this._saveToFlags();
    this.render();
  }

  async _removeMediaFromTab(tabId, idx) {
    if (!this._media[tabId]) return;
    this._media[tabId].splice(idx, 1);
    await this._saveToFlags();
    this.render();
  }

  async _moveMediaToTab(idx, targetTabId) {
    if (targetTabId === this._activeTab) return;
    const media = this._media[this._activeTab];
    if (!media || !media[idx]) return;
    const m = media[idx];

    if (!this._media[targetTabId]) this._media[targetTabId] = [];

    if (this._media[targetTabId].find(e => e.src === m.src)) {
      ui.notifications.info(`"${m.name}" is already on that tab.`);
      return;
    }

    this._media[targetTabId].push({ ...m });
    media.splice(idx, 1);
    await this._saveToFlags();
    ui.notifications.info(`Moved "${m.name}" to ${this._tabs.find(t => t.id === targetTabId)?.label || targetTabId}.`);
    this.render();
  }

  async _renameMedia(idx) {
    const media = this._media[this._activeTab];
    const m = media?.[idx];
    if (!m) return;
    const newName = await Dialog.prompt({
      title: "Rename Media",
      content: `<p><input type="text" value="${foundry.utils.escapeHTML(m.name)}" style="width:100%"></p>`,
      callback: (html) => html.find("input").val()
    });
    if (newName && newName.trim()) {
      m.name = newName.trim();
      await this._saveToFlags();
      this.render();
    }
  }

  _pickMediaFile() {
    if (this._locked) {
      ui.notifications.info("Gallery Canvas is locked. Unlock to add media.");
      return;
    }
    new FilePicker({
      type: "imagevideo",
      callback: async (path) => {
        await this._addMediaToTab(this._activeTab, {
          src: path,
          name: this._mediaNameFromPath(path)
        }, 50, 50);
      }
    }).render(true);
  }

  /* ================================================================
     TAB MANAGEMENT
     ================================================================ */

  _ensureDefaultTabs() {
    if (this._tabs.length === 0) {
      this._tabs = [
        { id: "scenes", label: "Scenes", icon: "fa-image" },
        { id: "characters", label: "Characters", icon: "fa-portrait" },
        { id: "misc", label: "Misc", icon: "fa-film" }
      ];
      this._activeTab = "scenes";
    }
  }

  async _addTab() {
    const id = `tab-${Date.now()}`;
    const icons = GALLERY_CANVAS_ICONS;
    const icon = icons[Math.floor(Math.random() * icons.length)];
    this._tabs.push({ id, label: "New Tab", icon });
    this._activeTab = id;
    await this._saveToFlags();
    this.render();
  }

  async _deleteTab(tabId) {
    if (this._tabs.length <= 1) {
      ui.notifications.warn("Cannot delete the last tab.");
      return;
    }
    this._tabs = this._tabs.filter(t => t.id !== tabId);
    delete this._media[tabId];
    delete this._tabSettings[tabId];
    delete this._cameras[tabId];
    if (this._activeTab === tabId) {
      this._activeTab = this._tabs[0]?.id || "scenes";
      this._camera = { ...this._cameraFor(this._activeTab) };
    }
    await this._saveToFlags();
    this.render();
  }

  async _renameTab(tabId) {
    const tab = this._tabs.find(t => t.id === tabId);
    if (!tab) return;
    const newName = await Dialog.prompt({
      title: "Rename Tab",
      content: `<p><input type="text" value="${tab.label}" style="width:100%"></p>`,
      callback: (html) => html.find("input").val()
    });
    if (newName && newName.trim()) {
      tab.label = newName.trim();
      await this._saveToFlags();
      this.render();
    }
  }

  /* ================================================================
     GRID SETTINGS DIALOG
     ================================================================ */

  _showGridSettingsDialog(tabId) {
    const tab = this._tabs.find(t => t.id === tabId);
    const s = this._getTabSettings(tabId);
    const dlg = new foundry.applications.api.DialogV2({
      window: { title: `Grid Settings: ${tab?.label || tabId}` },
      content: `
        <form class="cgm-tab-settings-window cgm-dark-dialog" style="display:grid;gap:14px;min-width:340px;">
          <div class="cgm-fancy-grid-panel-title"><i class="fas fa-border-all"></i> Canvas Grid</div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
            <label style="display:flex;flex-direction:column;gap:4px;font-size:12px;">Grid Type
              <select name="gridType" style="background:var(--cgm-input);color:var(--cgm-text);border:1px solid var(--cgm-border);border-radius:4px;padding:6px;">
                <option value="square" ${s.gridType === 'square' ? 'selected' : ''}>Square</option>
                <option value="hexOdd" ${s.gridType === 'hexOdd' ? 'selected' : ''}>Hex (Odd)</option>
                <option value="hexEven" ${s.gridType === 'hexEven' ? 'selected' : ''}>Hex (Even)</option>
                <option value="none" ${s.gridType === 'none' ? 'selected' : ''}>None</option>
              </select>
            </label>
            <label style="display:flex;flex-direction:column;gap:4px;font-size:12px;">Grid Color
              <input type="color" name="gridColor" value="${s.gridColor || '#c8a96e'}" style="height:30px;background:var(--cgm-input);border:1px solid var(--cgm-border);border-radius:4px;cursor:pointer;">
            </label>
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;">
            <label style="display:flex;flex-direction:column;gap:4px;font-size:12px;">Size (px)
              <input type="number" name="gridSize" value="${s.gridSize || 50}" min="10" max="200" style="background:var(--cgm-input);color:var(--cgm-text);border:1px solid var(--cgm-border);border-radius:4px;padding:6px;">
            </label>
            <label style="display:flex;flex-direction:column;gap:4px;font-size:12px;">Thickness
              <input type="number" name="gridThickness" value="${s.gridThickness || 1}" min="0.5" max="5" step="0.5" style="background:var(--cgm-input);color:var(--cgm-text);border:1px solid var(--cgm-border);border-radius:4px;padding:6px;">
            </label>
            <label style="display:flex;flex-direction:column;gap:4px;font-size:12px;">Opacity
              <input type="range" name="gridOpacity" min="0" max="1" step="0.01" value="${s.gridOpacity ?? 0.05}" style="width:100%;">
            </label>
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
            <label style="display:flex;align-items:center;gap:6px;font-size:12px;cursor:pointer;">
              <input type="checkbox" name="snapToGrid" ${s.snapToGrid ? 'checked' : ''}> Snap to Grid
            </label>
            <label style="display:flex;align-items:center;gap:6px;font-size:12px;cursor:pointer;">
              <input type="checkbox" name="showGrid" ${s.showGrid !== false ? 'checked' : ''}> Show Grid
            </label>
          </div>
          <div style="border-top:1px solid var(--cgm-border);padding-top:10px;margin-top:6px;">
            <div class="cgm-fancy-grid-panel-title"><i class="fas fa-sliders-h"></i> Canvas</div>
            <label style="display:flex;flex-direction:column;gap:4px;font-size:12px;">Window Opacity
              <input type="range" name="canvasOpacity" min="0.3" max="1" step="0.05" value="${s.canvasOpacity ?? 1}" style="width:100%;">
            </label>
          </div>
        </form>
      `,
      buttons: [
        { action: "save", label: "Save", default: true, callback: async (event, button, dialog) => {
          const fd = new FormDataExtended(dialog.element.querySelector("form")).object;
          const settings = this._getTabSettings(tabId);
          settings.gridType = fd.gridType || "square";
          settings.gridColor = fd.gridColor || "#c8a96e";
          settings.gridSize = isNaN(parseInt(fd.gridSize)) ? 50 : parseInt(fd.gridSize);
          settings.gridThickness = isNaN(parseFloat(fd.gridThickness)) ? 1 : parseFloat(fd.gridThickness);
          settings.gridOpacity = isNaN(parseFloat(fd.gridOpacity)) ? 0.05 : parseFloat(fd.gridOpacity);
          settings.snapToGrid = fd.snapToGrid === "on";
          settings.showGrid = fd.showGrid === "on";
          settings.canvasOpacity = parseFloat(fd.canvasOpacity) || 1;
          await this._saveToFlags();
          this.render();
        }},
        { action: "cancel", label: "Cancel" }
      ],
      modal: true
    });
    dlg.render(true);
  }

  /* ================================================================
     TAB SETTINGS DIALOG (full editor with live preview)
     ================================================================ */

  _showTabSettingsDialog(tabId) {
    const tab = this._tabs.find(t => t.id === tabId);
    if (!tab) return;
    const s = this._getTabSettings(tabId);
    const eff = this._getEffectiveTab(tabId);

    const fontOptions = [
      { value: "", label: "Default (Signika)" },
      { value: "var(--font-primary)", label: "Primary Font" },
      { value: "var(--font-mono)", label: "Monospace" },
      { value: "'Bebas Neue', sans-serif", label: "Bebas Neue" },
      { value: "'Cinzel', serif", label: "Cinzel (Fantasy)" },
      { value: "'Roboto', sans-serif", label: "Roboto" },
      { value: "'Georgia', serif", label: "Georgia" },
      { value: "'Courier New', monospace", label: "Courier" }
    ];
    const fitOptions = [
      { value: "cover", label: "Cover" },
      { value: "contain", label: "Contain" },
      { value: "fill", label: "Fill" },
      { value: "none", label: "None" }
    ];
    const alignOptions = [
      { value: "center", label: "Center" },
      { value: "top-left", label: "Top Left" },
      { value: "top", label: "Top" },
      { value: "top-right", label: "Top Right" },
      { value: "left", label: "Left" },
      { value: "right", label: "Right" },
      { value: "bottom-left", label: "Bottom Left" },
      { value: "bottom", label: "Bottom" },
      { value: "bottom-right", label: "Bottom Right" }
    ];

    const iconGrid = GALLERY_CANVAS_ICONS.map(ic => `
      <button type="button" class="${eff.icon === ic ? 'cgm-ts-active' : ''}" data-icon="${ic}" title="${ic.replace('fa-', '')}">
        <i class="fas ${ic}"></i>
      </button>
    `).join("");

    const content = `
      <div class="cgm-tab-settings-dialog">
        <div class="cgm-ts-preview">
          <div class="cgm-ts-preview-tab" id="cgm-ts-preview-tab">
            <i class="fas ${eff.icon}"></i>
            <span id="cgm-ts-preview-label">${foundry.utils.escapeHTML(eff.label)}</span>
          </div>
          <span class="cgm-ts-preview-badge">LIVE PREVIEW</span>
        </div>
        <div class="cgm-ts-columns">
          <div class="cgm-ts-col">
            <div class="cgm-ts-section">
              <h4><i class="fas fa-paint-brush"></i> Tab Appearance</h4>
              <div class="cgm-ts-row">
                <span class="cgm-ts-label">Tab Label</span>
                <input type="text" id="cgm-set-label" class="cgm-ts-input" value="${foundry.utils.escapeHTML(eff.label)}">
              </div>
              <div class="cgm-ts-row2">
                <div class="cgm-ts-row">
                  <span class="cgm-ts-label">Background Color</span>
                  <div class="cgm-ts-input-row">
                    <input type="color" id="cgm-set-tab-bg" class="cgm-ts-input" value="${s.tabBgColor || '#3a3050'}">
                    <button type="button" class="cgm-ts-icon-btn" id="cgm-clear-tab-bg" title="Reset"><i class="fas fa-rotate-left"></i></button>
                  </div>
                </div>
                <div class="cgm-ts-row">
                  <span class="cgm-ts-label">Window Opacity</span>
                  <div class="cgm-ts-range-wrap">
                    <input type="range" id="cgm-set-canvas-opacity" min="30" max="100" value="${Math.round((s.canvasOpacity ?? 1) * 100)}">
                    <span class="cgm-ts-range-val" id="cgm-set-canvas-opacity-val">${Math.round((s.canvasOpacity ?? 1) * 100)}%</span>
                  </div>
                </div>
              </div>
            </div>
            <div class="cgm-ts-section">
              <h4><i class="fas fa-font"></i> Typography</h4>
              <div class="cgm-ts-row2">
                <div class="cgm-ts-row">
                  <span class="cgm-ts-label">Font Family</span>
                  <select id="cgm-set-font-family" class="cgm-ts-input">${fontOptions.map(o => `<option value="${o.value}" ${s.fontFamily === o.value ? 'selected' : ''}>${o.label}</option>`).join("")}</select>
                </div>
                <div class="cgm-ts-row">
                  <span class="cgm-ts-label">Font Color</span>
                  <div class="cgm-ts-input-row">
                    <input type="color" id="cgm-set-font-color" class="cgm-ts-input" value="${s.fontColor || '#c8a96e'}">
                    <button type="button" class="cgm-ts-icon-btn" id="cgm-clear-font-color" title="Reset"><i class="fas fa-rotate-left"></i></button>
                  </div>
                </div>
              </div>
              <div class="cgm-ts-row2">
                <div class="cgm-ts-row">
                  <span class="cgm-ts-label">Size (px)</span>
                  <div class="cgm-ts-range-wrap">
                    <input type="range" id="cgm-set-font-size" min="8" max="18" value="${s.fontSize || 11}">
                    <span class="cgm-ts-range-val" id="cgm-set-font-size-val">${s.fontSize || 11}</span>
                  </div>
                </div>
                <div class="cgm-ts-row2" style="align-items:end;">
                  <label class="cgm-ts-check">
                    <input type="checkbox" id="cgm-set-font-uppercase" ${s.fontUppercase !== false ? 'checked' : ''}>
                    <span class="cgm-ts-check-box"></span>
                    <span class="cgm-ts-check-text">Uppercase</span>
                  </label>
                  <label class="cgm-ts-check">
                    <input type="checkbox" id="cgm-set-font-bold" ${s.fontBold !== false ? 'checked' : ''}>
                    <span class="cgm-ts-check-box"></span>
                    <span class="cgm-ts-check-text">Bold</span>
                  </label>
                </div>
              </div>
            </div>
            <div class="cgm-ts-section">
              <h4><i class="fas fa-icons"></i> Tab Icon</h4>
              <div class="cgm-ts-icon-grid">${iconGrid}</div>
              <input type="hidden" id="cgm-set-icon" value="${eff.icon}">
            </div>
          </div>
          <div class="cgm-ts-col">
            <div class="cgm-ts-section">
              <h4><i class="fas fa-image"></i> Canvas Background</h4>
              <div class="cgm-ts-row">
                <span class="cgm-ts-label">Background Image</span>
                <div class="cgm-ts-input-row">
                  <input type="text" id="cgm-set-bg-image" class="cgm-ts-input" value="${s.bgImage || ''}" readonly placeholder="No image selected">
                  <button type="button" class="cgm-ts-icon-btn" id="cgm-pick-bg-image" title="Browse"><i class="fas fa-folder-open"></i></button>
                  ${s.bgImage ? `<button type="button" class="cgm-ts-icon-btn cgm-ts-danger" id="cgm-clear-bg-image" title="Remove"><i class="fas fa-times"></i></button>` : ''}
                </div>
              </div>
              <div class="cgm-ts-row2">
                <div class="cgm-ts-row">
                  <span class="cgm-ts-label">Fit Mode</span>
                  <select id="cgm-set-bg-fit" class="cgm-ts-input">${fitOptions.map(o => `<option value="${o.value}" ${s.bgFit === o.value ? 'selected' : ''}>${o.label}</option>`).join("")}</select>
                </div>
                <div class="cgm-ts-row">
                  <span class="cgm-ts-label">Alignment</span>
                  <select id="cgm-set-bg-align" class="cgm-ts-input">${alignOptions.map(o => `<option value="${o.value}" ${s.bgAlign === o.value ? 'selected' : ''}>${o.label}</option>`).join("")}</select>
                </div>
              </div>
              <div class="cgm-ts-row">
                <span class="cgm-ts-label">Image Opacity</span>
                <div class="cgm-ts-range-wrap">
                  <input type="range" id="cgm-set-bg-opacity" min="0" max="100" value="${Math.round((s.bgOpacity ?? 1) * 100)}">
                  <span class="cgm-ts-range-val" id="cgm-set-bg-opacity-val">${Math.round((s.bgOpacity ?? 1) * 100)}%</span>
                </div>
              </div>
            </div>
            <div class="cgm-ts-section">
              <h4><i class="fas fa-border-all"></i> Grid Settings</h4>
              <div class="cgm-ts-row2">
                <div class="cgm-ts-row">
                  <span class="cgm-ts-label">Grid Color</span>
                  <input type="color" id="cgm-set-grid-color" class="cgm-ts-input" value="${s.gridColor || '#c8a96e'}">
                </div>
                <div class="cgm-ts-row">
                  <span class="cgm-ts-label">Size (px)</span>
                  <input type="number" id="cgm-set-grid-size" class="cgm-ts-input" min="10" max="200" value="${s.gridSize || 50}">
                </div>
              </div>
              <div class="cgm-ts-row">
                <span class="cgm-ts-label">Grid Opacity</span>
                <div class="cgm-ts-range-wrap">
                  <input type="range" id="cgm-set-grid-opacity" min="0" max="100" value="${Math.round((s.gridOpacity ?? 0.05) * 100)}">
                  <span class="cgm-ts-range-val" id="cgm-set-grid-opacity-val">${Math.round((s.gridOpacity ?? 0.05) * 100)}%</span>
                </div>
              </div>
            </div>
            <div class="cgm-ts-section">
              <h4><i class="fas fa-sliders-h"></i> Options</h4>
              <div class="cgm-ts-row2">
                <label class="cgm-ts-check">
                  <input type="checkbox" id="cgm-set-snap-grid" ${s.snapToGrid ? 'checked' : ''}>
                  <span class="cgm-ts-check-box"></span>
                  <span class="cgm-ts-check-text">Snap to Grid</span>
                </label>
                <label class="cgm-ts-check">
                  <input type="checkbox" id="cgm-set-show-grid" ${s.showGrid !== false ? 'checked' : ''}>
                  <span class="cgm-ts-check-box"></span>
                  <span class="cgm-ts-check-text">Show Grid</span>
                </label>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;

    const dialog = new foundry.applications.api.DialogV2({
      window: { title: `Tab Settings — ${eff.label}` },
      content: content,
      buttons: [
        {
          action: "save",
          icon: "fas fa-check",
          label: "Save Changes",
          default: true,
          callback: async (event, button, dialog) => {
            const html = $(dialog.element);
            const newSettings = {
              fontFamily: html.find("#cgm-set-font-family").val(),
              fontColor: html.find("#cgm-set-font-color").val(),
              fontSize: parseInt(html.find("#cgm-set-font-size").val()),
              fontUppercase: html.find("#cgm-set-font-uppercase").is(":checked"),
              fontBold: html.find("#cgm-set-font-bold").is(":checked"),
              tabBgColor: html.find("#cgm-set-tab-bg").val(),
              label: html.find("#cgm-set-label").val().trim(),
              icon: html.find("#cgm-set-icon").val(),
              bgImage: html.find("#cgm-set-bg-image").val(),
              bgFit: html.find("#cgm-set-bg-fit").val(),
              bgAlign: html.find("#cgm-set-bg-align").val(),
              bgOpacity: parseInt(html.find("#cgm-set-bg-opacity").val()) / 100,
              gridOpacity: parseInt(html.find("#cgm-set-grid-opacity").val()) / 100,
              gridColor: html.find("#cgm-set-grid-color").val(),
              gridSize: parseInt(html.find("#cgm-set-grid-size").val()),
              snapToGrid: html.find("#cgm-set-snap-grid").is(":checked"),
              showGrid: html.find("#cgm-set-show-grid").is(":checked"),
              canvasOpacity: parseInt(html.find("#cgm-set-canvas-opacity").val()) / 100
            };

            const tabIdx = this._tabs.findIndex(t => t.id === tabId);
            if (tabIdx >= 0) {
              if (newSettings.label) this._tabs[tabIdx].label = newSettings.label;
              if (newSettings.icon) this._tabs[tabIdx].icon = newSettings.icon;
            }

            this._tabSettings[tabId] = newSettings;
            await this._saveToFlags();
            this.render();
            ui.notifications.info(`Tab "${newSettings.label || eff.label}" settings saved.`);
          }
        },
        { action: "cancel", label: "Cancel" }
      ],
      render: (event, html) => {
        const $html = $(html);
        const dlg = $html.closest('.dialog');
        if (dlg.length) dlg[0].classList.add('cgm-tab-settings-window');

        const updatePreview = () => {
          const previewTab = $html.find('#cgm-ts-preview-tab');
          const previewLabel = $html.find('#cgm-ts-preview-label');
          const label = $html.find('#cgm-set-label').val().trim() || eff.label;
          const fontFamily = $html.find('#cgm-set-font-family').val();
          const fontColor = $html.find('#cgm-set-font-color').val();
          const fontSize = $html.find('#cgm-set-font-size').val();
          const fontUppercase = $html.find('#cgm-set-font-uppercase').is(':checked');
          const fontBold = $html.find('#cgm-set-font-bold').is(':checked');
          const tabBg = $html.find('#cgm-set-tab-bg').val();
          const icon = $html.find('#cgm-set-icon').val();

          if (previewLabel.length) {
            previewLabel.text(label);
            previewLabel.css({
              'font-family': fontFamily || 'inherit',
              'color': fontColor || '#c8a96e',
              'font-size': (fontSize || 11) + 'px',
              'text-transform': fontUppercase ? 'uppercase' : 'none',
              'font-weight': fontBold ? '700' : '400'
            });
          }
          if (previewTab.length) {
            previewTab.css('background', tabBg || 'linear-gradient(135deg, #3a3050, #231a38)');
          }
          const previewIcon = previewTab.find('i');
          if (previewIcon.length) previewIcon.attr('class', `fas ${icon || eff.icon}`);
        };

        $html.find('#cgm-set-label, #cgm-set-font-family, #cgm-set-font-color, #cgm-set-font-size').on('input change', updatePreview);
        $html.find('#cgm-set-font-uppercase, #cgm-set-font-bold').on('change', updatePreview);
        $html.find('#cgm-set-tab-bg').on('input', updatePreview);

        const bindRange = (id, valId, suffix = '') => {
          $html.find(id).on('input', (e) => { $html.find(valId).text(e.currentTarget.value + suffix); });
        };
        bindRange('#cgm-set-font-size', '#cgm-set-font-size-val');
        bindRange('#cgm-set-bg-opacity', '#cgm-set-bg-opacity-val', '%');
        bindRange('#cgm-set-grid-opacity', '#cgm-set-grid-opacity-val', '%');
        bindRange('#cgm-set-canvas-opacity', '#cgm-set-canvas-opacity-val', '%');

        $html.find('#cgm-clear-font-color').on('click', () => { $html.find('#cgm-set-font-color').val('#c8a96e'); updatePreview(); });
        $html.find('#cgm-clear-tab-bg').on('click', () => { $html.find('#cgm-set-tab-bg').val('#3a3050'); updatePreview(); });

        $html.find('#cgm-pick-bg-image').on('click', () => {
          new FilePicker({ type: "image", current: $html.find("#cgm-set-bg-image").val(),
            callback: (path) => { $html.find("#cgm-set-bg-image").val(path); }
          }).render(true);
        });
        $html.find('#cgm-clear-bg-image').on('click', () => { $html.find('#cgm-set-bg-image').val(''); });

        $html.find('.cgm-ts-icon-grid button').on('click', (e) => {
          const btn = e.currentTarget;
          $html.find('.cgm-ts-icon-grid button').removeClass('cgm-ts-active');
          btn.classList.add('cgm-ts-active');
          $html.find('#cgm-set-icon').val(btn.dataset.icon);
          updatePreview();
        });
      }
    });
    dialog.render({ force: true });
  }

  /* ================================================================
     CONTEXT MENUS
     ================================================================ */

  _showTabContextMenu(event, tabId) {
    this._hideContextMenu();
    const tab = this._tabs.find(t => t.id === tabId);
    if (!tab) return;

    const tabEl = event.currentTarget || event.target;
    const tabRect = tabEl.getBoundingClientRect();

    const menu = document.createElement("div");
    menu.className = "cgm-fancy-ctx-menu";
    const isFirst = this._tabs[0]?.id === tabId;
    menu.innerHTML = `
      <div class="cgm-fancy-ctx-header"><i class="fas ${tab.icon}"></i> ${foundry.utils.escapeHTML(tab.label)}</div>
      <div class="cgm-fancy-ctx-section">Tab</div>
      <div class="cgm-fancy-ctx-item" data-action="tab-settings"><i class="fas fa-sliders-h"></i> Tab Settings</div>
      <div class="cgm-fancy-ctx-item" data-action="grid-settings"><i class="fas fa-border-all"></i> Grid Settings</div>
      <div class="cgm-fancy-ctx-item" data-action="rename"><i class="fas fa-pen"></i> Rename Tab</div>
      ${isFirst ? '' : '<div class="cgm-fancy-ctx-sep"></div><div class="cgm-fancy-ctx-item cgm-ctx-danger" data-action="delete"><i class="fas fa-trash"></i> Delete Tab</div>'}
    `;
    menu.style.cssText = `position:fixed;z-index:99999;`;
    document.body.appendChild(menu);
    this._contextMenu = menu;

    requestAnimationFrame(() => {
      const mRect = menu.getBoundingClientRect();
      let left = tabRect.left + tabRect.width / 2 - mRect.width / 2;
      let top = tabRect.top - mRect.height - 10;
      const pad = 12;
      if (left + mRect.width > window.innerWidth - pad) left = window.innerWidth - mRect.width - pad;
      if (left < pad) left = pad;
      if (top < pad) top = tabRect.bottom + 10;
      menu.style.left = left + "px";
      menu.style.top = top + "px";
      menu.classList.add("cgm-ctx-visible");
    });

    // Track mouse for hover glow
    menu.addEventListener("mousemove", (e) => {
      const item = e.target.closest(".cgm-fancy-ctx-item");
      if (item) {
        const rect = item.getBoundingClientRect();
        item.style.setProperty("--mx", ((e.clientX - rect.left) / rect.width * 100) + "%");
        item.style.setProperty("--my", ((e.clientY - rect.top) / rect.height * 100) + "%");
      }
    });

    const close = (e) => { if (e && (menu.contains(e.target) || e.target.closest('.dialog, .window-app, .application, .file-picker'))) return; menu.remove(); this._contextMenu = null; document.removeEventListener("click", close); document.removeEventListener("keydown", esc); };
    const esc = (e) => { if (e.key === "Escape") close(); };
    setTimeout(() => { document.addEventListener("click", close); document.addEventListener("keydown", esc); }, 50);

    menu.querySelectorAll(".cgm-fancy-ctx-item").forEach(item => {
      item.addEventListener("click", async () => {
        const action = item.dataset.action;
        if (action === "tab-settings") {
          this._showTabSettingsDialog(tabId);
        } else if (action === "rename") {
          this._renameTab(tabId);
        } else if (action === "grid-settings") {
          this._showGridSettingsDialog(tabId);
        } else if (action === "delete") {
          this._deleteTab(tabId);
        }
        close();
      });
    });
  }

  _showMediaContextMenu(event, tokenEl) {
    this._hideContextMenu();
    this._hideMediaTooltip();
    const idx = parseInt(tokenEl.dataset.mediaIdx);
    const name = tokenEl.dataset.name;
    const media = this._media[this._activeTab];
    const m = media?.[idx];
    if (!m) return;

    const moveSubmenu = this._tabs.filter(t => t.id !== this._activeTab).map(t => `
      <div class="cgm-fancy-ctx-subitem" data-tab-id="${t.id}" data-idx="${idx}">
        <i class="fas ${t.icon}"></i> ${foundry.utils.escapeHTML(t.label)}
      </div>
    `).join('');

    const menu = document.createElement('div');
    menu.className = 'cgm-fancy-ctx-menu';
    menu.style.cssText = `position:fixed;z-index:99999;`;
    menu.innerHTML = `
      <div class="cgm-fancy-ctx-header"><i class="fas ${m.mediaType === 'video' ? 'fa-film' : 'fa-image'}"></i> ${foundry.utils.escapeHTML(name)}</div>
      <div class="cgm-fancy-ctx-section">Media</div>
      <div class="cgm-fancy-ctx-item" data-action="view" data-idx="${idx}"><i class="fas fa-eye"></i> View</div>
      <div class="cgm-fancy-ctx-item" data-action="showPlayers" data-idx="${idx}"><i class="fas fa-users"></i> Show to Players</div>
      <div class="cgm-fancy-ctx-sep"></div>
      <div class="cgm-fancy-ctx-item" data-action="copyPath" data-idx="${idx}"><i class="fas fa-link"></i> Copy Path</div>
      <div class="cgm-fancy-ctx-item" data-action="rename" data-idx="${idx}"><i class="fas fa-pen"></i> Rename</div>
      ${moveSubmenu ? `
      <div class="cgm-fancy-ctx-sep"></div>
      <div class="cgm-fancy-ctx-section">Organization</div>
      <div class="cgm-fancy-ctx-item cgm-fancy-ctx-has-submenu" data-action="move-to-tab">
        <i class="fas fa-folder-open"></i> Move to Tab <i class="fas fa-chevron-right cgm-fancy-ctx-chevron"></i>
        <div class="cgm-fancy-ctx-submenu">
          ${moveSubmenu}
        </div>
      </div>
      ` : ''}
      <div class="cgm-fancy-ctx-sep"></div>
      <div class="cgm-fancy-ctx-item cgm-ctx-danger" data-action="remove" data-idx="${idx}"><i class="fas fa-trash"></i> Remove from Canvas</div>
    `;

    document.body.appendChild(menu);
    this._contextMenu = menu;

    const tokenRect = tokenEl.getBoundingClientRect();
    requestAnimationFrame(() => {
      const mRect = menu.getBoundingClientRect();
      let left = tokenRect.left + tokenRect.width / 2 - mRect.width / 2;
      let top = tokenRect.top - mRect.height - 12;
      const pad = 12;
      if (left + mRect.width > window.innerWidth - pad) left = window.innerWidth - mRect.width - pad;
      if (left < pad) left = pad;
      if (top < pad) top = tokenRect.bottom + 12;
      menu.style.left = left + "px";
      menu.style.top = top + "px";
      menu.classList.add("cgm-ctx-visible");
    });

    // Track mouse for hover glow
    menu.addEventListener("mousemove", (e) => {
      const item = e.target.closest(".cgm-fancy-ctx-item");
      if (item) {
        const rect = item.getBoundingClientRect();
        item.style.setProperty("--mx", ((e.clientX - rect.left) / rect.width * 100) + "%");
        item.style.setProperty("--my", ((e.clientY - rect.top) / rect.height * 100) + "%");
      }
    });

    const close = (e) => { if (e && (menu.contains(e.target) || e.target.closest('.dialog, .window-app, .application, .file-picker'))) return; menu.remove(); this._contextMenu = null; document.removeEventListener("click", close); document.removeEventListener("keydown", esc); };
    const esc = (e) => { if (e.key === "Escape") close(); };
    setTimeout(() => { document.addEventListener("click", close); document.addEventListener("keydown", esc); }, 50);

    menu.querySelectorAll(".cgm-fancy-ctx-item").forEach(el => {
      el.addEventListener('click', async (e) => {
        e.stopPropagation();
        const action = el.dataset.action;
        const mediaIdx = parseInt(el.dataset.idx);
        if (action === 'move-to-tab') return; // handled by submenu
        await this._handleMediaAction(action, mediaIdx);
        close();
      });
    });

    // Submenu tab click
    menu.querySelectorAll(".cgm-fancy-ctx-subitem").forEach(sub => {
      sub.addEventListener('click', async () => {
        const targetTab = sub.dataset.tabId;
        const mediaIdx = parseInt(sub.dataset.idx);
        if (targetTab) await this._moveMediaToTab(mediaIdx, targetTab);
        close();
      });
    });
  }

  /* ================================================================
     MEDIA TOOLTIP — Fancy hover tooltip with name, preview, type
     ================================================================ */

  _showMediaTooltip(tokenEl) {
    this._hideMediaTooltip();
    const name = tokenEl.dataset.name || "Unknown";
    const src = tokenEl.dataset.src || "";
    const mediaType = tokenEl.dataset.mediaType || _galleryMediaType(src);

    const tooltip = document.createElement("div");
    tooltip.className = "cgm-token-tooltip-fancy cgm-item-tooltip-fancy";
    tooltip.id = "cgm-gallery-tooltip-active";
    tooltip.innerHTML = `
      ${mediaType === "video"
        ? `<div class="cgm-gallery-tooltip-video"><i class="fas fa-play"></i></div>`
        : `<img src="${src}" alt="" draggable="false">`}
      <span>${foundry.utils.escapeHTML(name)}</span>
      <em class="cgm-gallery-tooltip-type">${mediaType === "video" ? "VIDEO" : "IMAGE"}</em>
    `;

    const appEl = this.element instanceof HTMLElement ? this.element : this.element[0];
    if (appEl) appEl.appendChild(tooltip);

    const appRect = appEl.getBoundingClientRect();
    const tokenRect = tokenEl.getBoundingClientRect();
    const top = tokenRect.top - appRect.top - tooltip.offsetHeight - 12;
    const left = tokenRect.left - appRect.left + (tokenRect.width / 2) - (tooltip.offsetWidth / 2);

    tooltip.style.top = `${top}px`;
    tooltip.style.left = `${left}px`;
    tooltip.style.opacity = "1";
    tooltip.style.transform = "translateY(0) scale(1)";
  }

  _hideMediaTooltip() {
    const existing = document.getElementById("cgm-gallery-tooltip-active");
    if (existing) existing.remove();
  }

  _hideContextMenu() {
    if (this._contextMenu) {
      this._contextMenu.remove();
      this._contextMenu = null;
    }
  }

  async _handleMediaAction(action, idx) {
    const media = this._media[this._activeTab];
    const m = media?.[idx];
    if (!m) return;

    switch (action) {
      case 'view': {
        cypherShowGalleryMedia({ src: m.src, name: m.name, mediaType: m.mediaType });
        break;
      }
      case 'showPlayers': {
        this._showPlayerPickerDialog(m);
        break;
      }
      case 'copyPath': {
        try {
          await navigator.clipboard.writeText(m.src);
          ui.notifications.info("Path copied to clipboard.");
        } catch (err) {
          // Fallback for older browsers / insecure contexts
          const ta = document.createElement("textarea");
          ta.value = m.src;
          document.body.appendChild(ta);
          ta.select();
          document.execCommand("copy");
          ta.remove();
          ui.notifications.info("Path copied to clipboard.");
        }
        break;
      }
      case 'rename': {
        await this._renameMedia(idx);
        break;
      }
      case 'remove': {
        await this._removeMediaFromTab(this._activeTab, idx);
        ui.notifications.info("Removed from canvas.");
        break;
      }
    }
  }

  /* ================================================================
     SHOW TO PLAYERS — picker dialog: individual / selected / all
     ================================================================ */

  _showPlayerPickerDialog(m) {
    const players = game.users.filter(u => !u.isGM && u.active);
    if (!players.length) {
      ui.notifications.warn("No active players to show media to.");
      return;
    }

    const rows = players.map(u => `
      <label class="cgm-gallery-picker-row" data-user-id="${u.id}">
        <img src="${u.avatar || 'icons/svg/mystery-man.svg'}" alt="">
        <span>${foundry.utils.escapeHTML(u.name)}</span>
        <input type="checkbox" name="cgm-gal-player" value="${u.id}" checked>
      </label>
    `).join("");

    const dlg = new foundry.applications.api.DialogV2({
      window: { title: `Show to Players — ${m.name}` },
      content: `
        <form class="cgm-gallery-picker">
          <div class="cgm-fancy-grid-panel-title"><i class="fas fa-users"></i> Who sees "${foundry.utils.escapeHTML(m.name)}"?</div>
          <label class="cgm-gallery-picker-all">
            <input type="checkbox" id="cgm-gal-all" checked>
            <span>All players</span>
            <i class="fas fa-users"></i>
          </label>
          <div class="cgm-gallery-picker-list">${rows}</div>
          <div class="cgm-gallery-picker-hint" id="cgm-gal-hint"></div>
        </form>
      `,
      buttons: [
        { action: "show", label: "Show", icon: "fas fa-eye", default: true, callback: async (event, button, dialog) => {
          const checked = [...dialog.element.querySelectorAll('input[name="cgm-gal-player"]:checked')].map(i => i.value);
          if (!checked.length) {
            ui.notifications.warn("Select at least one player.");
            return;
          }
          await this._emitShowToPlayers(m, checked);
        }},
        { action: "cancel", label: "Cancel" }
      ],
      modal: true,
      render: (event, html) => {
        const $html = $(html);
        // Fancy dark theme on the DIALOG ROOT (form-level class alone does nothing)
        const dlgEl = $html.closest('.dialog');
        if (dlgEl.length) dlgEl[0].classList.add('cgm-dark-dialog', 'cgm-gallery-picker-dialog');

        const root = html instanceof HTMLElement ? html : html[0];
        if (!root) return;
        const allBox = root.querySelector("#cgm-gal-all");
        const boxes = [...root.querySelectorAll('input[name="cgm-gal-player"]')];
        const hint = root.querySelector("#cgm-gal-hint");
        const updateHint = () => {
          if (!hint) return;
          const n = boxes.filter(b => b.checked).length;
          hint.textContent = n === boxes.length
            ? "Everyone will see this"
            : n === 0 ? "Nobody selected — pick at least one player"
            : `${n} of ${boxes.length} players selected`;
        };
        updateHint();
        if (allBox) {
          allBox.addEventListener("change", () => {
            boxes.forEach(b => { b.checked = allBox.checked; });
            updateHint();
          });
          // Keep "All" in sync when individual boxes change
          boxes.forEach(b => b.addEventListener("change", () => {
            allBox.checked = boxes.every(x => x.checked);
            updateHint();
          }));
        }
      }
    });
    dlg.render(true);
  }

  async _emitShowToPlayers(m, userIds) {
    // Broadcast with explicit targets — handler in cypher-gm-taskbar.js
    // (registered BEFORE the userId filter) checks membership.
    game.socket.emit("module.cypher-gm-taskbar", {
      action: "galleryShow",
      src: m.src,
      name: m.name,
      mediaType: m.mediaType,
      targets: userIds
    });
    // GM sees locally what they just sent
    cypherShowGalleryMedia({ src: m.src, name: m.name, mediaType: m.mediaType });
    const label = userIds.length === 1
      ? game.users.get(userIds[0])?.name || "player"
      : `${userIds.length} players`;
    ui.notifications.info(`Showing "${m.name}" to ${label}.`);
  }

  /* ================================================================
     PERSISTENCE
     ================================================================ */

  async _saveToFlags() {
    const data = {
      tabs: this._tabs,
      activeTab: this._activeTab,
      media: this._media,
      tabSettings: this._tabSettings,
      camera: this._camera,
      cameras: this._cameras
    };
    this._cameras[this._activeTab] = this._camera;
    await game.settings.set("cypher-gm-taskbar", "galleryCanvasData", JSON.stringify(data));
  }

  async _loadFromFlags() {
    try {
      const raw = game.settings.get("cypher-gm-taskbar", "galleryCanvasData");
      if (!raw) return;
      const data = JSON.parse(raw);
      if (data.tabs) this._tabs = data.tabs;
      if (data.activeTab) this._activeTab = data.activeTab;
      if (data.media) this._media = data.media;
      if (data.tabSettings) this._tabSettings = data.tabSettings;
      this._cameras = data.cameras || {};
      const savedCam = this._cameras[this._activeTab];
      this._camera = savedCam ? { ...savedCam } : (data.camera ? { ...data.camera } : { x: 0, y: 0, zoom: 1 });
    } catch (e) {
      console.warn("[GalleryCanvas] Failed to load data:", e);
    }
  }

  close(options = {}) {
    if (this._cleanupMouseListeners) this._cleanupMouseListeners();
    this._hideContextMenu();
    this._hideMediaTooltip();
    try { this._saveToFlags(); } catch {}
    return super.close(options);
  }
}
