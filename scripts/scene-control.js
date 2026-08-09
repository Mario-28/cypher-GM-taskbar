/* ═══════════════════════════════════════════════════════════════
   SCENE CONTROL — Scene Canvas (Foundry V2 API)
   Organize, browse, and control scenes with tabs, drag & drop,
   and a searchable canvas of scene cards.
   ═══════════════════════════════════════════════════════════════ */

const SCENE_CONTROL_ICONS = [
  "fa-map","fa-globe","fa-city","fa-tree","fa-mountain","fa-water",
  "fa-fire","fa-moon","fa-sun","fa-bolt","fa-heart","fa-brain",
  "fa-eye","fa-ghost","fa-spider","fa-paw","fa-crow","fa-fish",
  "fa-cat","fa-dog","fa-horse","fa-dove","fa-frog","fa-hippo",
  "fa-dungeon","fa-chess-rook","fa-chess-pawn","fa-chess-queen","fa-scroll","fa-bullseye"
];

class SceneControl extends foundry.applications.api.ApplicationV2 {
  static DEFAULT_OPTIONS = {
    id: "cgm-scene-control",
    classes: ["cgm-scene-control-app", "cgm-fancy-panel"],
    tag: "div",
    window: {
      frame: false,
      minimizable: false,
      resizable: false,
      controls: []
    },
    position: {
      width: 800,
      height: "auto"
    }
  };

  constructor(options = {}) {
    super(options);
    this._tabs = [];
    this._activeTab = "general";
    this._scenes = {};       // { tabId: [ { sceneId, x, y }, ... ] }
    this._tabSettings = {};  // per-tab settings
    this._contextMenu = null;
    this._loading = false;
    this._dragOver = false;
    this._dataLoaded = false;

    // Camera (per-tab, persisted)
    this._tabCameras = {};   // { tabId: { x, y, zoom } }
    this._camera = { x: 0, y: 0, zoom: 1 };
    this._isPanning = false;
    this._panStart = { x: 0, y: 0 };
    this._cameraStart = { x: 0, y: 0 };

    // Card drag
    this._draggingCard = null;
    this._dragOffset = { x: 0, y: 0 };
    this._dragStartWorld = { x: 0, y: 0 };
    this._dragStartMouse = { x: 0, y: 0 };
    this._dragListenersSet = false;

    this._searchQuery = "";
    this._showSearchInput = false;
    this._locked = false;
    this._isDragging = false;
  }

  toggle() {
    if (this.rendered) {
      if (this._locked) {
        ui.notifications.info("Scene Control is locked. Unlock to close.");
        return;
      }
      this.close();
    } else {
      this.render({ force: true });
    }
  }

  /* Prevent re-renders while dragging a card */
  render(force = false, options = {}) {
    if (this._isDragging) return this;
    return super.render(force, options);
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
      // Merge in any missing defaults (for settings saved before new fields were added)
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
      id: tabId,
      label: settings.label || tab?.label || tabId,
      icon: settings.icon || tab?.icon || "fa-map",
      ...settings
    };
  }

  /* ================================================================
     LIFECYCLE
     ================================================================ */

  async _prepareContext(options) {
    if (!this._dataLoaded) {
      this._loading = true;
      await this._loadFromFlags();
      this._loading = false;
      this._dataLoaded = true;
    }
    return {};
  }

  async _renderHTML(context, options) {
    const settings = this._getTabSettings(this._activeTab);
    const allScenes = this._scenes[this._activeTab] || [];
    const scenes = this._getFilteredScenes(this._activeTab);
    const scenesHTML = scenes.map((s, idx) => this._buildSceneCardHTML(s, idx, settings)).join("");
    const hasSearch = this._searchQuery.trim().length > 0;

    const gridSize = (settings.gridSize || 50) * this._camera.zoom;
    const gridOffsetX = this._camera.x % gridSize;
    const gridOffsetY = this._camera.y % gridSize;

    const bgStyle = settings.bgImage
      ? `background-image: url('${settings.bgImage}'); background-size: ${settings.bgFit}; background-position: ${this._mapAlign(settings.bgAlign)}; opacity: ${settings.bgOpacity};`
      : "";

    const tabsHTML = this._tabs.map(t => this._buildTabHTML(t)).join("");

    return `
      <div class="cgm-scene-control-container cgm-fancy-container" style="opacity: ${settings.canvasOpacity ?? 1};">
        <div class="cgm-scene-control-main">
          <div class="cgm-scene-control-header cgm-fancy-header">
            <div class="cgm-fancy-title-wrap">
              <i class="fas fa-map"></i>
              <span class="cgm-scene-control-title">Scene Control</span>
            </div>
            <div class="cgm-scene-control-header-controls">
              ${this._showSearchInput ? `
                <div class="cgm-canvas-search-wrap">
                  <input type="text" class="cgm-canvas-search-input" placeholder="Search scenes..." value="${foundry.utils.escapeHTML(this._searchQuery)}">
                  ${hasSearch ? `<span class="cgm-canvas-search-count">${scenes.length}/${allScenes.length}</span>` : ''}
                  <button class="cgm-canvas-search-clear" title="Clear"><i class="fas fa-times"></i></button>
                </div>
              ` : ''}
              <button class="cgm-scene-control-search-toggle" title="Search"><i class="fas fa-search"></i></button>
            </div>
            <div class="cgm-scene-control-header-btns">
              <button class="cgm-scene-control-lock" title="${this._locked ? 'Unlock' : 'Lock'}"><i class="fas ${this._locked ? 'fa-lock' : 'fa-lock-open'}"></i></button>
              <button class="cgm-scene-control-reset-view" title="Reset View"><i class="fas fa-compress"></i></button>
              <button class="cgm-scene-control-add-tab" title="Add Tab"><i class="fas fa-plus"></i></button>
              <button class="cgm-scene-control-close" title="Close"><i class="fas fa-times"></i></button>
            </div>
          </div>
          <div class="cgm-scene-control-body">
            <div class="cgm-scene-control-viewport ${this._dragOver ? 'cgm-scene-control-dragover' : ''}" data-tab="${this._activeTab}">
              <div class="cgm-scene-control-bg-layer" style="${bgStyle}"></div>
              <div class="cgm-scene-control-world"
                   style="transform: translate(${this._camera.x}px, ${this._camera.y}px) scale(${this._camera.zoom});">
                ${settings.showGrid !== false ? `
                <div class="cgm-scene-control-grid"
                     style="background-size: ${gridSize}px ${gridSize}px; background-position: ${gridOffsetX}px ${gridOffsetY}px; opacity: ${settings.gridOpacity}; --grid-color: ${settings.gridColor || '#c8a96e'};"></div>
                ` : ''}
                <div class="cgm-scene-control-cards">
                  ${scenes.length === 0 ? '' : scenesHTML}
                </div>
              </div>
              ${scenes.length === 0 && !hasSearch ? `
                <div class="cgm-scene-control-empty-overlay">
                  <div class="cgm-drop-zone-icon"><i class="fas fa-cloud-arrow-down"></i></div>
                  <p>Drag scenes here</p>
                  <span class="cgm-drop-hint">Scroll to zoom · Drag to pan · Drop to place</span>
                </div>
              ` : scenes.length === 0 && hasSearch ? `
                <div class="cgm-scene-control-empty-overlay">
                  <div class="cgm-drop-zone-icon"><i class="fas fa-search"></i></div>
                  <p>No scenes match "${foundry.utils.escapeHTML(this._searchQuery)}"</p>
                  <span class="cgm-drop-hint">Try a different search term</span>
                </div>
              ` : ''}
            </div>
          </div>
        </div>
        <div class="cgm-scene-control-tabs cgm-fancy-tabs cgm-tabs-vertical">
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

  async _replaceHTML(result, content, options) {
    if (this.element) {
      const container = this.element.querySelector('.cgm-scene-control-container');
      if (container) { container.outerHTML = result; }
      else { this.element.innerHTML = result; }
    }
  }

  _buildSceneCardHTML(scene, idx, settings) {
    const s = game.scenes?.get(scene.sceneId);
    const img = s?.thumbnail || s?.img || "icons/svg/direction.svg";
    const name = s?.name || scene.name || "Unknown Scene";
    const isActive = game.scenes?.active?.id === scene.sceneId;
    const isView = canvas.scene?.id === scene.sceneId;
    const navVisible = s?.navigation;
    const visited = scene.visited === true;
    const x = scene.x ?? 80 + (idx % 5) * 150;
    const y = scene.y ?? 80 + Math.floor(idx / 5) * 170;

    return `
      <div class="cgm-scene-card ${isActive ? 'cgm-scene-active' : ''} ${isView ? 'cgm-scene-view' : ''} ${visited ? 'cgm-scene-visited' : ''}"
           data-scene-id="${scene.sceneId}" data-scene-idx="${idx}"
           data-name="${foundry.utils.escapeHTML(name)}" data-img="${img}"
           style="left: ${x}px; top: ${y}px;">
        <div class="cgm-scene-card-wrap">
          <div class="cgm-scene-visited-check" title="${visited ? 'Visited' : 'Mark as visited'}" data-scene-id="${scene.sceneId}">
            <i class="fas ${visited ? 'fa-check-square' : 'fa-square'}"></i>
          </div>
          <div class="cgm-scene-card-img-wrap">
            <img src="${img}" alt="${foundry.utils.escapeHTML(name)}" class="cgm-scene-card-img" draggable="false">
            ${isActive ? '<div class="cgm-scene-active-badge" title="Active"><i class="fas fa-play"></i></div>' : ''}
            ${!navVisible ? '<div class="cgm-scene-hidden-badge" title="Hidden from nav"><i class="fas fa-eye-slash"></i></div>' : ''}
          </div>
          <div class="cgm-scene-card-name" title="${foundry.utils.escapeHTML(name)}">${foundry.utils.escapeHTML(name)}</div>
        </div>
      </div>
    `;
  }

  _getFilteredScenes(tabId) {
    const arr = this._scenes[tabId] || [];
    if (!this._searchQuery.trim()) return arr;
    const q = this._searchQuery.toLowerCase();
    return arr.filter(s => {
      const sc = game.scenes?.get(s.sceneId);
      const name = (sc?.name || s.name || "").toLowerCase();
      return name.includes(q);
    });
  }

  /* ================================================================
     EVENT BINDING
     ================================================================ */

  _onRender(context, options) {
    if (this.element) {
      this.element.style.position = "fixed";
      this.element.style.left = "50%";
      this.element.style.bottom = "60px";
      this.element.style.transform = "translateX(-50%)";
      this.element.style.width = "800px";
      this.element.style.maxWidth = "90vw";
      this.element.style.maxHeight = "70vh";
      this.element.style.zIndex = "calc(var(--cgm-z-dialog, 10000) - 1)";
      this.element.style.overflow = "visible";
      requestAnimationFrame(() => this.element.classList.add("cgm-fancy-visible"));
    }

    const $html = $(this.element);

    $html.find(".cgm-scene-control-close").on("click", () => {
      if (this._locked) {
        ui.notifications.info("Scene Control is locked. Unlock to close.");
        return;
      }
      this.close();
    });
    $html.find(".cgm-scene-control-add-tab").on("click", () => this._onAddTab());
    $html.find(".cgm-scene-control-lock").on("click", () => {
      this._locked = !this._locked;
      const btn = this.element.querySelector(".cgm-scene-control-lock");
      if (btn) {
        btn.title = this._locked ? "Unlock" : "Lock";
        const i = btn.querySelector("i");
        if (i) { i.classList.toggle("fa-lock", this._locked); i.classList.toggle("fa-lock-open", !this._locked); }
      }
      this.element.querySelector(".cgm-scene-control-container")?.classList.toggle("locked", this._locked);
      ui.notifications.info(this._locked ? "Scene Control locked." : "Scene Control unlocked.");
    });
    $html.find(".cgm-scene-control-reset-view").on("click", () => this._resetView());
    $html.find(".cgm-scene-control-search-toggle").on("click", () => {
      this._showSearchInput = !this._showSearchInput;
      this.render();
      if (this._showSearchInput) {
        requestAnimationFrame(() => this.element?.querySelector(".cgm-canvas-search-input")?.focus());
      }
    });
    $html.find(".cgm-canvas-search-clear").on("click", () => {
      this._searchQuery = "";
      this.render();
    });

    // Side tab click → switch tab
    $html.find(".cgm-canvas-tab").on("click", (e) => {
      const tabId = e.currentTarget.dataset.tabId;
      if (tabId && tabId !== this._activeTab) {
        // Save current tab's camera
        this._tabCameras[this._activeTab] = { ...this._camera };
        // Switch tab
        this._activeTab = tabId;
        // Restore new tab's camera (or default)
        const saved = this._tabCameras[tabId];
        this._camera = saved ? { ...saved } : { x: 0, y: 0, zoom: 1 };
        this.render();
      }
    });

    // Side tab right-click → context menu (settings, delete, etc.)
    $html.find(".cgm-canvas-tab").on("contextmenu", (e) => {
      e.preventDefault();
      const tabId = e.currentTarget.dataset.tabId;
      if (tabId) this._onTabRightClick(tabId, e);
    });

    // Card right-click → context menu
    $html.find(".cgm-scene-card").on("contextmenu", (e) => {
      e.preventDefault();
      this._showContextMenu(e.currentTarget, e);
    });

    // Card hover → global tooltip (appended to body, escapes overflow:hidden)
    if (!this._sceneTooltipEl) {
      this._sceneTooltipEl = document.createElement("div");
      this._sceneTooltipEl.className = "cgm-scene-tooltip";
      document.body.appendChild(this._sceneTooltipEl);
    }
    $html.find(".cgm-scene-card").on("mouseenter", (e) => {
      const card = e.currentTarget;
      const name = card.dataset.name || "";
      this._sceneTooltipEl.textContent = name;
      const rect = card.getBoundingClientRect();
      const tooltipWidth = this._sceneTooltipEl.offsetWidth || 200;
      let left = rect.left + rect.width / 2;
      let top = rect.top - 12;
      const pad = 16;
      if (left - tooltipWidth / 2 < pad) left = tooltipWidth / 2 + pad;
      if (left + tooltipWidth / 2 > window.innerWidth - pad) left = window.innerWidth - tooltipWidth / 2 - pad;
      this._sceneTooltipEl.style.left = left + "px";
      this._sceneTooltipEl.style.top = top + "px";
      this._sceneTooltipEl.style.transform = "translateX(-50%) translateY(-100%)";
      this._sceneTooltipEl.classList.add("cgm-tooltip-visible");
    }).on("mouseleave", () => {
      if (this._sceneTooltipEl) this._sceneTooltipEl.classList.remove("cgm-tooltip-visible");
    });

    // Search input
    const searchInput = this.element?.querySelector(".cgm-canvas-search-input");
    if (searchInput) {
      searchInput.addEventListener("input", (e) => { this._searchQuery = e.target.value; this.render(); });
      searchInput.addEventListener("keydown", (e) => { if (e.key === "Escape") { this._showSearchInput = false; this._searchQuery = ""; this.render(); } });
    }

    // Viewport interactions
    const viewport = this.element?.querySelector(".cgm-scene-control-viewport");
    if (viewport) {
      viewport.addEventListener("mousedown", (e) => {
        if (e.button !== 0 || e.target.closest(".cgm-scene-card")) return;
        this._isPanning = true;
        this._panStart = { x: e.clientX, y: e.clientY };
        this._cameraStart = { ...this._camera };
        viewport.style.cursor = "grabbing";
      });
      document.addEventListener("mousemove", (e) => {
        if (!this._isPanning) return;
        const dx = e.clientX - this._panStart.x;
        const dy = e.clientY - this._panStart.y;
        this._camera.x = this._cameraStart.x + dx;
        this._camera.y = this._cameraStart.y + dy;
        const world = this.element?.querySelector(".cgm-scene-control-world");
        if (world) world.style.transform = `translate(${this._camera.x}px, ${this._camera.y}px) scale(${this._camera.zoom})`;
      });
      document.addEventListener("mouseup", () => {
        if (this._isPanning) { this._isPanning = false; viewport.style.cursor = "grab"; }
      });
      viewport.addEventListener("wheel", (e) => {
        e.preventDefault();
        const delta = e.deltaY > 0 ? -0.1 : 0.1;
        this._camera.zoom = Math.max(0.3, Math.min(3, this._camera.zoom + delta));
        const world = this.element?.querySelector(".cgm-scene-control-world");
        if (world) world.style.transform = `translate(${this._camera.x}px, ${this._camera.y}px) scale(${this._camera.zoom})`;
      });

      // Drag & Drop from sidebar
      viewport.addEventListener("dragenter", (e) => { e.preventDefault(); this._dragOver = true; viewport.classList.add("cgm-scene-control-dragover"); });
      viewport.addEventListener("dragover", (e) => { e.preventDefault(); });
      viewport.addEventListener("dragleave", (e) => {
        if (!viewport.contains(e.relatedTarget)) { this._dragOver = false; viewport.classList.remove("cgm-scene-control-dragover"); }
      });
      viewport.addEventListener("drop", (e) => {
        e.preventDefault(); this._dragOver = false; viewport.classList.remove("cgm-scene-control-dragover");
        this._onDrop(e, viewport);
      });
    }

    // Card drag within canvas
    this._bindCardDrag();

    // Visited checkmark click handler
    $html.find(".cgm-scene-visited-check").on("click", async (e) => {
      e.stopPropagation();
      const sceneId = e.currentTarget.dataset.sceneId;
      const scenes = this._scenes[this._activeTab] || [];
      const scene = scenes.find(s => s.sceneId === sceneId);
      if (scene) {
        scene.visited = !scene.visited;
        await this._saveToFlags();
        this.render();
      }
    });

    // Click outside to close (unless locked)
    const appEl = this.element[0] || this.element;
    if (appEl && !this._outsideClickHandler) {
      this._outsideClickHandler = (e) => {
        if (!this.rendered) return;
        if (this._locked) return;
        // Ignore clicks inside the Scene Control window
        if (appEl.contains(e.target)) return;
        // Ignore clicks on context menus or dialogs
        if (e.target.closest('.cgm-fancy-ctx-menu')) return;
        if (e.target.closest('.dialog') || e.target.closest('.window-app')) return;
        this.close();
      };
      // Use capture phase to catch clicks before they bubble
      setTimeout(() => document.addEventListener("click", this._outsideClickHandler, true), 100);
    }
  }

  _bindCardDrag() {
    const viewport = this.element?.querySelector(".cgm-scene-control-viewport");
    if (!viewport) return;
    const cards = viewport.querySelectorAll(".cgm-scene-card");

    cards.forEach(card => {
      card.addEventListener("mousedown", (e) => {
        if (e.button !== 0) return;
        e.stopPropagation();
        this._isDragging = true;
        this._draggingCard = card;
        // Store initial positions for delta-based drag
        this._dragStartWorld = {
          x: parseFloat(card.style.left) || 0,
          y: parseFloat(card.style.top) || 0
        };
        this._dragStartMouse = { x: e.clientX, y: e.clientY };
        card.style.cursor = "grabbing";
      });
    });

    // Only set up document-level listeners once
    if (this._dragListenersSet) return;
    this._dragListenersSet = true;

    document.addEventListener("mousemove", (e) => {
      if (!this._draggingCard) return;
      if (!this._draggingCard.isConnected) {
        this._draggingCard = null;
        this._isDragging = false;
        return;
      }
      const zoom = this._camera.zoom || 1;
      const dx = (e.clientX - this._dragStartMouse.x) / zoom;
      const dy = (e.clientY - this._dragStartMouse.y) / zoom;
      let x = this._dragStartWorld.x + dx;
      let y = this._dragStartWorld.y + dy;
      // Snap to grid during drag if enabled
      const settings = this._getTabSettings(this._activeTab);
      if (settings.snapToGrid && settings.gridSize > 0) {
        const gs = settings.gridSize;
        const offsetX = this._camera.x / zoom;
        const offsetY = this._camera.y / zoom;
        x = Math.round((x - offsetX) / gs) * gs + offsetX;
        y = Math.round((y - offsetY) / gs) * gs + offsetY;
      }
      this._draggingCard.style.left = `${x}px`;
      this._draggingCard.style.top = `${y}px`;
    });

    document.addEventListener("mouseup", async () => {
      if (!this._draggingCard) return;
      const sceneId = this._draggingCard.dataset.sceneId;
      const scenes = this._scenes[this._activeTab];
      const scene = scenes?.find(s => s.sceneId === sceneId);
      const finalX = parseFloat(this._draggingCard.style.left);
      const finalY = parseFloat(this._draggingCard.style.top);
      if (scene) {
        if (!isNaN(finalX)) scene.x = finalX;
        if (!isNaN(finalY)) scene.y = finalY;
        await this._saveToFlags();
      }
      this._draggingCard.style.cursor = "";
      this._draggingCard = null;
      this._isDragging = false;
    });
  }

  async _onDrop(event, viewport) {
    let data;
    try { data = JSON.parse(event.dataTransfer.getData("text/plain") || "{}"); }
    catch { data = {}; }

    if (data.type === "Scene" && data.uuid) {
      const sceneId = data.uuid.split(".").pop();
      const scene = game.scenes?.get(sceneId);
      if (!scene) { ui.notifications.warn("Scene not found."); return; }

      const zoom = this._camera.zoom || 1;
      const vpRect = viewport.getBoundingClientRect();
      let x = (event.clientX - vpRect.left - this._camera.x) / zoom;
      let y = (event.clientY - vpRect.top - this._camera.y) / zoom;

      // Snap to grid if enabled
      const settings = this._getTabSettings(this._activeTab);
      if (settings.snapToGrid && settings.gridSize > 0) {
        const gs = settings.gridSize;
        const offsetX = this._camera.x / zoom;
        const offsetY = this._camera.y / zoom;
        x = Math.round((x - offsetX) / gs) * gs + offsetX;
        y = Math.round((y - offsetY) / gs) * gs + offsetY;
      }

      const arr = this._scenes[this._activeTab] || [];
      if (arr.some(s => s.sceneId === sceneId)) { ui.notifications.info(`${scene.name} is already on this tab.`); return; }
      arr.push({ sceneId, x, y, name: scene.name });
      this._scenes[this._activeTab] = arr;
      console.log("cgm-scene | dropped:", { sceneId, x, y, tab: this._activeTab });
      await this._saveToFlags();
      this.render();
      ui.notifications.info(`${scene.name} added to ${this._activeTab}.`);
    }
  }

  /* ================================================================
     SCENE ACTIONS
     ================================================================ */

  async _activateScene(sceneId) {
    const scene = game.scenes?.get(sceneId);
    if (!scene) return;
    if (game.scenes?.active?.id === sceneId) {
      ui.notifications.info(`${scene.name} is already active.`);
      return;
    }
    await scene.activate();
    ui.notifications.info(`${scene.name} is now active.`);
    this.render();
  }

  async _viewScene(sceneId) {
    const scene = game.scenes?.get(sceneId);
    if (scene) await scene.view();
  }

  async _editScene(sceneId) {
    const scene = game.scenes?.get(sceneId);
    if (scene) scene.sheet?.render(true);
  }

  async _toggleNav(sceneId) {
    const scene = game.scenes?.get(sceneId);
    if (!scene) return;
    const nav = !scene.navigation;
    await scene.update({ navigation: nav });
    ui.notifications.info(`${scene.name} is now ${nav ? 'visible' : 'hidden'} in navigation.`);
    this.render();
  }

  /* ================================================================
     CONTEXT MENU
     ================================================================ */

  _showContextMenu(cardEl, event) {
    this._closeContextMenu();
    const sceneId = cardEl.dataset.sceneId;
    const scene = game.scenes?.get(sceneId);
    const idx = parseInt(cardEl.dataset.sceneIdx);
    if (!scene) return;

    const isActive = game.scenes?.active?.id === sceneId;
    const nav = scene.navigation;

    // Position above the Scene Control window
    const appEl = this.element[0] || this.element;
    const appRect = appEl?.getBoundingClientRect() || { top: 100, left: 200, width: 400 };
    const cardRect = cardEl.getBoundingClientRect();

    const menu = document.createElement("div");
    menu.className = "cgm-fancy-ctx-menu cgm-scene-ctx-menu";
    menu.innerHTML = `
      <div class="cgm-fancy-ctx-header"><i class="fas fa-map"></i> ${foundry.utils.escapeHTML(scene.name)}</div>
      <div class="cgm-fancy-ctx-item${isActive ? ' cgm-ctx-disabled' : ''}" data-action="activate"><i class="fas fa-play"></i> Activate <span class="cgm-ctx-shortcut">↵</span></div>
      <div class="cgm-fancy-ctx-item" data-action="view"><i class="fas fa-eye"></i> View</div>
      <div class="cgm-fancy-ctx-item" data-action="edit"><i class="fas fa-pen"></i> Edit</div>
      <div class="cgm-fancy-ctx-sep"></div>
      <div class="cgm-fancy-ctx-item" data-action="toggle-nav"><i class="fas ${nav ? 'fa-eye-slash' : 'fa-eye'}"></i> ${nav ? 'Hide' : 'Show'} in Nav</div>
      <div class="cgm-fancy-ctx-item cgm-fancy-ctx-has-submenu" data-action="move-to-tab">
        <i class="fas fa-folder-open"></i> Move to Tab <i class="fas fa-chevron-right cgm-fancy-ctx-chevron"></i>
        <div class="cgm-fancy-ctx-submenu">
          ${(() => {
            const otherTabs = this._tabs.filter(t => t.id !== this._activeTab);
    console.log("cgm-scene | Move to Tab submenu:", { tabs: this._tabs.map(t=>t.id), activeTab: this._activeTab, otherTabs: otherTabs.map(t=>t.id) });
            if (otherTabs.length === 0) return `<div class="cgm-fancy-ctx-subitem" style="opacity:0.5;cursor:default;"><i class="fas fa-ban"></i> No other tabs</div>`;
            return otherTabs.map(t => `
              <div class="cgm-fancy-ctx-subitem" data-tab-id="${t.id}">
                <i class="fas ${t.icon}"></i> ${foundry.utils.escapeHTML(t.label)}
              </div>
            `).join('');
          })()}
        </div>
      </div>
      <div class="cgm-fancy-ctx-sep"></div>
      <div class="cgm-fancy-ctx-item cgm-ctx-danger" data-action="delete"><i class="fas fa-trash"></i> Remove from Canvas</div>
    `;
    menu.style.cssText = `position:fixed;z-index:99999;`;
    document.body.appendChild(menu);
    this._contextMenu = menu;

    // Position above the card, within the app window
    requestAnimationFrame(() => {
      const mRect = menu.getBoundingClientRect();
      let left = cardRect.left + cardRect.width / 2 - mRect.width / 2;
      let top = cardRect.top - mRect.height - 12;
      const pad = 12;
      if (left + mRect.width > window.innerWidth - pad) left = window.innerWidth - mRect.width - pad;
      if (left < pad) left = pad;
      if (top < pad) top = cardRect.bottom + 12;
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

    const closeMenu = (e) => { if (e && menu.contains(e.target)) return; this._closeContextMenu(); document.removeEventListener("click", closeMenu); document.removeEventListener("keydown", escHandler); };
    const escHandler = (e) => { if (e.key === "Escape") closeMenu(); };
    setTimeout(() => { document.addEventListener("click", closeMenu); document.addEventListener("keydown", escHandler); }, 50);

    // Single delegated click handler for the entire menu
    menu.addEventListener("click", async (e) => {
      const subitem = e.target.closest(".cgm-fancy-ctx-subitem");
      if (subitem) {
        const targetTab = subitem.dataset.tabId;
        if (targetTab) await this._moveSceneToTab(sceneId, targetTab);
        closeMenu();
        return;
      }
      const item = e.target.closest(".cgm-fancy-ctx-item");
      if (!item) return;
      const action = item.dataset.action;
      if (action === "move-to-tab") {
        // Toggle submenu visibility on click
        const submenu = item.querySelector(".cgm-fancy-ctx-submenu");
        if (submenu) {
          const isOpen = item.classList.contains("cgm-ctx-submenu-open");
          // Close any other open submenus
          menu.querySelectorAll(".cgm-fancy-ctx-has-submenu").forEach(el => el.classList.remove("cgm-ctx-submenu-open"));
          if (!isOpen) item.classList.add("cgm-ctx-submenu-open");
        }
        return;
      }
      switch (action) {
        case "activate": await this._activateScene(sceneId); break;
        case "view": await this._viewScene(sceneId); break;
        case "edit": this._editScene(sceneId); break;
        case "toggle-nav": await this._toggleNav(sceneId); break;
        case "delete": this._removeScene(idx); break;
      }
      closeMenu();
    });
  }

  _closeContextMenu() {
    if (this._contextMenu) { this._contextMenu.remove(); this._contextMenu = null; }
  }

  async _moveSceneToTab(sceneId, targetTabId) {
    if (targetTabId === this._activeTab) return;
    if (!this._scenes[targetTabId]) this._scenes[targetTabId] = [];
    const arr = this._scenes[this._activeTab] || [];
    const idx = arr.findIndex(s => s.sceneId === sceneId);
    if (idx === -1) return;
    const scene = arr.splice(idx, 1)[0];
    this._scenes[targetTabId].push(scene);
    await this._saveToFlags();
    this.render();
  }

  async _removeScene(idx) {
    const arr = this._scenes[this._activeTab];
    if (!arr || !arr[idx]) return;
    const name = arr[idx].name || "Scene";
    arr.splice(idx, 1);
    await this._saveToFlags();
    this.render();
    ui.notifications.info(`${name} removed from canvas.`);
  }

  /* ================================================================
     TAB MANAGEMENT
     ================================================================ */

  _onAddTab() {
    const dlg = new foundry.applications.api.DialogV2({
      window: { title: "New Tab" },
      content: `
        <form class="cgm-dark-dialog">
          <div class="form-group"><label>Name</label><input type="text" id="cgm-new-tab-name" placeholder="Tab Name"></div>
          <div class="form-group"><label>Icon</label><div class="cgm-icon-grid" style="display:grid;grid-template-columns:repeat(10,1fr);gap:4px;margin-top:6px;">
            ${SCENE_CONTROL_ICONS.map(i => `<button type="button" class="cgm-icon-grid-btn" data-icon="${i}" style="background:transparent;border:1px solid #444;border-radius:4px;color:var(--cgm-text);padding:6px;cursor:pointer;"><i class="fas ${i}"></i></button>`).join('')}
          </div></div>
        </form>
      `,
      buttons: [
        { action: "ok", label: "Create", default: true, callback: async (event, button, dialog) => {
          const name = dialog.element.querySelector("#cgm-new-tab-name")?.value.trim();
          const activeBtn = dialog.element.querySelector(".cgm-icon-grid-btn.cgm-icon-active");
          const icon = activeBtn?.dataset.icon || "fa-map";
          if (!name) { ui.notifications.warn("Tab name required."); return; }
          const id = name.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
          if (this._tabs.find(t => t.id === id)) { ui.notifications.warn("Tab ID already exists."); return; }
          this._tabs.push({ id, label: name, icon });
          this._activeTab = id;
          await this._saveToFlags();
          this.render();
        }},
        { action: "cancel", label: "Cancel" }
      ],
      modal: true
    });
    dlg.render(true);
    this._styleDialog(dlg);
    setTimeout(() => {
      const grid = document.querySelector("#" + dlg.id + " .cgm-icon-grid");
      if (grid) {
        grid.querySelectorAll(".cgm-icon-grid-btn").forEach(btn => {
          btn.addEventListener("click", () => {
            grid.querySelectorAll(".cgm-icon-grid-btn").forEach(b => { b.style.background = "transparent"; b.style.color = "var(--cgm-text)"; b.classList.remove("cgm-icon-active"); });
            btn.style.background = "var(--cgm-accent)"; btn.style.color = "#000"; btn.classList.add("cgm-icon-active");
          });
        });
      }
    }, 100);
  }

  async _onTabRightClick(tabId, event) {
    const tab = this._tabs.find(t => t.id === tabId);
    if (!tab) return;

    // Position above the tab
    const tabEl = event.currentTarget || event.target;
    const tabRect = tabEl.getBoundingClientRect();

    const menu = document.createElement("div");
    menu.className = "cgm-fancy-ctx-menu cgm-scene-ctx-menu";
    const isHome = tabId === "home";
    menu.innerHTML = `
      <div class="cgm-fancy-ctx-header"><i class="fas ${tab.icon}"></i> ${foundry.utils.escapeHTML(tab.label)}</div>
      <div class="cgm-fancy-ctx-section">Tab</div>
      <div class="cgm-fancy-ctx-item" data-action="rename"><i class="fas fa-pen"></i> Rename</div>
      <div class="cgm-fancy-ctx-item" data-action="settings"><i class="fas fa-sliders-h"></i> Tab Settings</div>
      ${isHome ? '' : '<div class="cgm-fancy-ctx-sep"></div><div class="cgm-fancy-ctx-item cgm-ctx-danger" data-action="delete"><i class="fas fa-trash"></i> Delete Tab</div>'}
    `;
    menu.style.cssText = `position:fixed;z-index:99999;`;
    document.body.appendChild(menu);

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

    const close = () => { menu.remove(); document.removeEventListener("click", close); document.removeEventListener("keydown", esc); };
    const esc = (e) => { if (e.key === "Escape") close(); };
    setTimeout(() => { document.addEventListener("click", close); document.addEventListener("keydown", esc); }, 50);

    menu.querySelectorAll(".cgm-fancy-ctx-item").forEach(item => {
      item.addEventListener("click", async () => {
        const action = item.dataset.action;
        if (action === "rename") {
          if (tabId === "home") { ui.notifications.warn("The HOME tab cannot be renamed."); close(); return; }
          const newName = await foundry.applications.api.DialogV2.prompt({
            window: { title: "Rename Tab" },
            content: `<input type="text" value="${foundry.utils.escapeHTML(tab.label)}" id="cgm-rename-input" style="width:100%;background:var(--cgm-input);color:var(--cgm-text);border:1px solid var(--cgm-border);border-radius:4px;padding:6px;">`,
            ok: { callback: (e, btn, d) => d.element.querySelector("#cgm-rename-input")?.value.trim() }
          });
          if (newName) { tab.label = newName; await this._saveToFlags(); this.render(); }
        } else if (action === "settings") {
          this._showTabSettings(tabId);
        } else if (action === "delete") {
          if (tabId === "home") { ui.notifications.warn("The HOME tab cannot be deleted."); close(); return; }
          if (this._tabs.length <= 1) { ui.notifications.warn("Cannot delete the last tab."); close(); return; }
          const confirmed = await foundry.applications.api.DialogV2.confirm({
            window: { title: "Delete Tab" },
            content: `<p>Delete "${foundry.utils.escapeHTML(tab.label)}" and all its scenes?</p>`
          });
          if (confirmed) {
            this._tabs = this._tabs.filter(t => t.id !== tabId);
            delete this._scenes[tabId];
            delete this._tabSettings[tabId];
            if (this._activeTab === tabId) this._activeTab = this._tabs[0]?.id || "home";
            await this._saveToFlags();
            this.render();
          }
        }
        close();
      });
    });
  }


  _showTabSettings(tabId) {
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

    const iconGrid = SCENE_CONTROL_ICONS.map(ic => `
      <button type="button" class="${eff.icon === ic ? 'cgm-ts-active' : ''}" data-icon="${ic}" title="${ic.replace('fa-', '')}">
        <i class="fas ${ic}"></i>
      </button>
    `).join("");

    const content = `
      <div class="cgm-tab-settings-dialog">
        <!-- LIVE PREVIEW -->
        <div class="cgm-ts-preview">
          <div class="cgm-ts-preview-tab" id="cgm-ts-preview-tab">
            <i class="fas ${eff.icon}"></i>
            <span id="cgm-ts-preview-label">${foundry.utils.escapeHTML(eff.label)}</span>
          </div>
          <span class="cgm-ts-preview-badge">LIVE PREVIEW</span>
        </div>

        <!-- TWO COLUMNS -->
        <div class="cgm-ts-columns">
          <!-- LEFT -->
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

          <!-- RIGHT -->
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
                  <span class="cgm-ts-label">Grid Type</span>
                  <select id="cgm-set-grid-type" class="cgm-ts-input">
                    <option value="square" ${s.gridType === 'square' ? 'selected' : ''}>Square</option>
                    <option value="hexOdd" ${s.gridType === 'hexOdd' ? 'selected' : ''}>Hex (Odd)</option>
                    <option value="hexEven" ${s.gridType === 'hexEven' ? 'selected' : ''}>Hex (Even)</option>
                    <option value="none" ${s.gridType === 'none' ? 'selected' : ''}>None</option>
                  </select>
                </div>
                <div class="cgm-ts-row">
                  <span class="cgm-ts-label">Grid Color</span>
                  <input type="color" id="cgm-set-grid-color" class="cgm-ts-input" value="${s.gridColor || '#c8a96e'}">
                </div>
              </div>
              <div class="cgm-ts-row2">
                <div class="cgm-ts-row">
                  <span class="cgm-ts-label">Size (px)</span>
                  <input type="number" id="cgm-set-grid-size" class="cgm-ts-input" min="10" max="200" value="${s.gridSize || 50}">
                </div>
                <div class="cgm-ts-row">
                  <span class="cgm-ts-label">Thickness</span>
                  <input type="number" id="cgm-set-grid-thickness" class="cgm-ts-input" min="0.5" max="5" step="0.5" value="${s.gridThickness || 1}">
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

    const dialog = new Dialog({
      title: `Tab Settings — ${eff.label}`,
      content: content,
      buttons: {
        save: {
          icon: "<i class='fas fa-check'></i>",
          label: "Save Changes",
          callback: async (html) => {
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
              gridType: html.find("#cgm-set-grid-type").val(),
              gridColor: html.find("#cgm-set-grid-color").val(),
              gridSize: parseInt(html.find("#cgm-set-grid-size").val()),
              gridThickness: parseFloat(html.find("#cgm-set-grid-thickness").val()),
              snapToGrid: html.find("#cgm-set-snap-grid").is(":checked"),
              showGrid: html.find("#cgm-set-show-grid").is(":checked"),
              canvasOpacity: parseInt(html.find("#cgm-set-canvas-opacity").val()) / 100
            };

            const t = this._tabs.find(t => t.id === tabId);
            if (t) {
              if (newSettings.label) t.label = newSettings.label.toUpperCase();
              if (newSettings.icon) t.icon = newSettings.icon;
            }

            this._tabSettings[tabId] = newSettings;
            await this._saveToFlags();
            this.render();
            ui.notifications.info(`Tab "${newSettings.label || eff.label}" settings saved.`);
          }
        },
        cancel: { label: "Cancel" }
      },
      default: "save",
      render: (html) => {
        const dlg = html.closest('.dialog');
        if (dlg.length) dlg[0].classList.add('cgm-tab-settings-window');

        // Live preview updates
        const updatePreview = () => {
          const previewTab = html.find('#cgm-ts-preview-tab');
          const previewLabel = html.find('#cgm-ts-preview-label');
          const label = html.find('#cgm-set-label').val().trim() || eff.label;
          const fontFamily = html.find('#cgm-set-font-family').val();
          const fontColor = html.find('#cgm-set-font-color').val();
          const fontSize = html.find('#cgm-set-font-size').val();
          const fontUppercase = html.find('#cgm-set-font-uppercase').is(':checked');
          const fontBold = html.find('#cgm-set-font-bold').is(':checked');
          const tabBg = html.find('#cgm-set-tab-bg').val();
          const icon = html.find('#cgm-set-icon').val();

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

        html.find('#cgm-set-label, #cgm-set-font-family, #cgm-set-font-color, #cgm-set-font-size').on('input change', updatePreview);
        html.find('#cgm-set-font-uppercase, #cgm-set-font-bold').on('change', updatePreview);
        html.find('#cgm-set-tab-bg').on('input', updatePreview);

        // Range value updates
        const bindRange = (id, valId, suffix = '') => {
          html.find(id).on('input', (e) => { html.find(valId).text(e.currentTarget.value + suffix); });
        };
        bindRange('#cgm-set-font-size', '#cgm-set-font-size-val');
        bindRange('#cgm-set-bg-opacity', '#cgm-set-bg-opacity-val', '%');
        bindRange('#cgm-set-grid-opacity', '#cgm-set-grid-opacity-val', '%');
        bindRange('#cgm-set-canvas-opacity', '#cgm-set-canvas-opacity-val', '%');

        // Reset buttons
        html.find('#cgm-clear-font-color').on('click', () => {
          html.find('#cgm-set-font-color').val('#c8a96e');
          updatePreview();
        });
        html.find('#cgm-clear-tab-bg').on('click', () => {
          html.find('#cgm-set-tab-bg').val('#3a3050');
          updatePreview();
        });

        // File picker
        html.find('#cgm-pick-bg-image').on('click', () => {
          new FilePicker({ type: "image", current: s.bgImage || "",
            callback: path => { html.find('#cgm-set-bg-image').val(path); }
          }).render(true);
        });
        html.find('#cgm-clear-bg-image').on('click', () => {
          html.find('#cgm-set-bg-image').val('');
        });

        // Icon grid
        html.find('.cgm-ts-icon-grid button').on('click', function() {
          html.find('.cgm-ts-icon-grid button').removeClass('cgm-ts-active');
          $(this).addClass('cgm-ts-active');
          html.find('#cgm-set-icon').val($(this).data('icon'));
          updatePreview();
        });
      },
      close: () => {
        // Overlay removed — no longer used
      }
    });
    dialog.render(true);
  }


  _resetView() {
    this._camera = { x: 0, y: 0, zoom: 1 };
    this._tabCameras[this._activeTab] = { x: 0, y: 0, zoom: 1 };
    const world = this.element?.querySelector(".cgm-scene-control-world");
    if (world) world.style.transform = `translate(0px, 0px) scale(1)`;
  }

  /* ================================================================
     FLAGS / PERSISTENCE
     ================================================================ */

  async _saveToFlags() {
    const user = game.user;
    if (!user) return;
    // Save current tab's camera before persisting
    this._tabCameras[this._activeTab] = { ...this._camera };
    await user.setFlag("cypher-gm-taskbar", "sceneControlTabs", foundry.utils.deepClone(this._tabs));
    await user.setFlag("cypher-gm-taskbar", "sceneControlScenes", foundry.utils.deepClone(this._scenes));
    await user.setFlag("cypher-gm-taskbar", "sceneControlSettings", foundry.utils.deepClone(this._tabSettings));
    await user.setFlag("cypher-gm-taskbar", "sceneControlCameras", foundry.utils.deepClone(this._tabCameras));
  }

  async _loadFromFlags() {
    const user = game.user;
    if (!user) return;
    this._tabs = foundry.utils.deepClone(await user.getFlag("cypher-gm-taskbar", "sceneControlTabs")) || [{ id: "home", label: "HOME", icon: "fa-home" }];
    this._scenes = foundry.utils.deepClone(await user.getFlag("cypher-gm-taskbar", "sceneControlScenes")) || {};
    this._tabSettings = foundry.utils.deepClone(await user.getFlag("cypher-gm-taskbar", "sceneControlSettings")) || {};
    this._tabCameras = foundry.utils.deepClone(await user.getFlag("cypher-gm-taskbar", "sceneControlCameras")) || {};
    if (!this._tabs.find(t => t.id === this._activeTab)) this._activeTab = this._tabs[0]?.id || "home";
    // Restore current tab's camera
    const savedCam = this._tabCameras[this._activeTab];
    if (savedCam) this._camera = { ...savedCam };
    this._dataLoaded = true;
  }

  /* ================================================================
     CLOSE
     ================================================================ */

  async close(options = {}) {
    this._closeContextMenu();
    if (this._outsideClickHandler) {
      document.removeEventListener("click", this._outsideClickHandler, true);
      this._outsideClickHandler = null;
    }
    if (this._sceneTooltipEl) {
      this._sceneTooltipEl.remove();
      this._sceneTooltipEl = null;
    }
    if (this.element) {
      this.element.classList.remove("cgm-fancy-visible");
      await new Promise(r => setTimeout(r, 180));
    }
    return super.close(options);
  }
}

window.SceneControl = SceneControl;
