/* ═══════════════════════════════════════════════════════════════
   NPC CANVAS — True Scene Canvas (Foundry V2 API)
   Miniature scene with pan, zoom, grid, and free token placement
   ═══════════════════════════════════════════════════════════════ */

const NPC_CANVAS_ICONS = [
  "fa-users","fa-star","fa-skull","fa-dragon","fa-chess-knight","fa-shield-alt",
  "fa-fire","fa-moon","fa-sun","fa-bolt","fa-heart","fa-brain",
  "fa-eye","fa-ghost","fa-spider","fa-paw","fa-crow","fa-fish",
  "fa-cat","fa-dog","fa-horse","fa-dove","fa-frog","fa-hippo",
  "fa-dungeon","fa-chess-rook","fa-chess-pawn","fa-chess-queen","fa-scroll","fa-bullseye"
];

class NPCCanvas extends foundry.applications.api.ApplicationV2 {
  static DEFAULT_OPTIONS = {
    id: "cgm-npc-canvas",
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
    this._activeTab = "general";
    this._npcs = {};
    this._tabSettings = {};
    this._contextMenu = null;
    this._loading = false;
    this._dragOver = false;
    this._dataLoaded = false;
    
    // Scene camera state
    this._camera = { x: 0, y: 0, zoom: 1 };
    this._isPanning = false;
    this._panStart = { x: 0, y: 0 };
    this._cameraStart = { x: 0, y: 0 };
    
    // Token drag state
    this._draggingToken = null;
    this._dragOffset = { x: 0, y: 0 };
    
    this._searchQuery = "";
    this._showSearchInput = false;
    this._locked = false;
    this._selectedNPCs = new Set();
  }

  toggle() {
    if (this.rendered) {
      if (this._locked) {
        ui.notifications.info("NPC Canvas is locked. Unlock to close.");
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
      icon: settings.icon || tab?.icon || "fa-users"
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
      npcs: this._npcs[this._activeTab] || [],
      dragOver: this._dragOver,
      camera: this._camera
    };
  }

  async _renderHTML(context, options) {
    const settings = this._getTabSettings(this._activeTab);
    const tabsHTML = this._tabs.map(t => this._buildTabHTML(t)).join("");
    const allNpcs = this._npcs[this._activeTab] || [];
    const npcs = this._getFilteredNPCs(this._activeTab);
    const npcsHTML = npcs.map((npc, idx) => this._buildNPCTokenHTML(npc, idx, settings)).join("");
    const hasSearch = this._searchQuery.trim().length > 0;

    const gridSize = (settings.gridSize || 50) * this._camera.zoom;
    const gridOffsetX = this._camera.x % gridSize;
    const gridOffsetY = this._camera.y % gridSize;

    // Canvas background style
    const bgStyle = settings.bgImage 
      ? `background-image: url('${settings.bgImage}'); background-size: ${settings.bgFit}; background-position: ${this._mapAlign(settings.bgAlign)}; opacity: ${settings.bgOpacity};`
      : "";

    return `
      <div class="cgm-npc-canvas-container cgm-fancy-container" style="opacity: ${settings.canvasOpacity ?? 1};">
        <div class="cgm-npc-canvas-main">
          <div class="cgm-npc-canvas-header cgm-fancy-header">
            <div class="cgm-fancy-title-wrap">
              <i class="fas fa-users"></i>
              <span class="cgm-npc-canvas-title">NPC Canvas</span>
            </div>
            <div class="cgm-npc-canvas-header-controls">
              ${this._showSearchInput ? `
                <div class="cgm-canvas-search-wrap">
                  <input type="text" class="cgm-canvas-search-input" placeholder="Search NPCs..." value="${foundry.utils.escapeHTML(this._searchQuery)}">
                  ${hasSearch ? `<span class="cgm-canvas-search-count">${npcs.length}/${allNpcs.length}</span>` : ''}
                  <button class="cgm-canvas-search-clear" title="Clear"><i class="fas fa-times"></i></button>
                </div>
              ` : ''}
              <button class="cgm-npc-canvas-search-toggle" title="Search"><i class="fas fa-search"></i></button>
            </div>
            <div class="cgm-npc-canvas-header-btns">
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
                  ${npcs.length === 0 ? '' : npcsHTML}
                </div>
              </div>
              ${npcs.length === 0 && !hasSearch ? `
                <div class="cgm-npc-canvas-empty-overlay">
                  <div class="cgm-drop-zone-icon"><i class="fas fa-cloud-arrow-down"></i></div>
                  <p>Drag NPCs here</p>
                  <span class="cgm-drop-hint">Scroll to zoom · Drag to pan · Drop to place</span>
                </div>
              ` : npcs.length === 0 && hasSearch ? `
                <div class="cgm-npc-canvas-empty-overlay">
                  <div class="cgm-drop-zone-icon"><i class="fas fa-search"></i></div>
                  <p>No NPCs match "${foundry.utils.escapeHTML(this._searchQuery)}"</p>
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

    // Build inline styles for dynamic tab styling
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
     FILTER & SORT HELPERS
     ================================================================ */

  _getFilteredNPCs(tabId) {
    let npcs = [...(this._npcs[tabId] || [])];
    
    // Search filter
    if (this._searchQuery.trim()) {
      const q = this._searchQuery.toLowerCase().trim();
      npcs = npcs.filter(npc => {
        const actor = game.actors?.get(npc.actorId);
        const name = (actor?.name || npc.name || "").toLowerCase();
        return name.includes(q);
      });
    }
    
    return npcs;
  }

  /* Filter visible tokens in-place without re-rendering */
  _filterVisibleTokens() {
    const $html = $(this.element);
    const query = this._searchQuery.toLowerCase().trim();
    const tokens = $html.find(".cgm-npc-token");
    let visibleCount = 0;
    const totalCount = tokens.length;

    tokens.each((_, tokenEl) => {
      const name = (tokenEl.dataset.name || "").toLowerCase();
      const matches = !query || name.includes(query);
      tokenEl.style.display = matches ? "" : "none";
      if (matches) visibleCount++;
    });

    // Update search count display
    const countEl = $html.find(".cgm-canvas-search-count")[0];
    if (countEl) countEl.textContent = `${visibleCount}/${totalCount}`;

    // Show/hide empty state
    const emptyOverlay = $html.find(".cgm-npc-canvas-empty-overlay")[0];
    const tokensContainer = $html.find(".cgm-npc-canvas-tokens")[0];
    if (emptyOverlay) {
      if (visibleCount === 0 && totalCount > 0) {
        emptyOverlay.style.display = "flex";
        emptyOverlay.querySelector("p").textContent = `No NPCs match "${foundry.utils.escapeHTML(this._searchQuery)}"`;
        if (tokensContainer) tokensContainer.style.display = "none";
      } else {
        emptyOverlay.style.display = "none";
        if (tokensContainer) tokensContainer.style.display = "";
      }
    }
  }

  async _replaceHTML(result, content, options) {
    if (this.element) {
      const container = this.element.querySelector('.cgm-npc-canvas-container');
      if (container) { container.outerHTML = result; }
      else { this.element.innerHTML = result; }
    }
  }

  _buildNPCTokenHTML(npc, idx, settings) {
    const actor = game.actors?.get(npc.actorId);
    const img = npc.img || actor?.img || "icons/svg/mystery-man.svg";
    const name = actor?.name || npc.name || "Unknown";
    const level = this._getNPCLevel(actor);
    const levelBarHTML = this._buildLevelBarHTML(level);
    const x = npc.x ?? 100 + (idx % 6) * 120;
    const y = npc.y ?? 100 + Math.floor(idx / 6) * 140;
    
    let effectsHTML = '';
    if (actor?.effects) {
      const activeEffects = actor.effects.filter(e => !e.disabled);
      if (activeEffects.length > 0) {
        effectsHTML = `<div class="cgm-token-effects">
          ${activeEffects.slice(0, 3).map(e => `<img src="${e.icon}" title="${foundry.utils.escapeHTML(e.label || '')}" class="cgm-token-effect-icon">`).join('')}
          ${activeEffects.length > 3 ? `<span class="cgm-token-effect-more">+${activeEffects.length - 3}</span>` : ''}
        </div>`;
      }
    }
    
    const isDefeated = level && level <= 0;
    const isSelected = this._selectedNPCs.has(npc.actorId);
    
    return `
      <div class="cgm-npc-token cgm-token-scene${isSelected ? ' cgm-token-selected' : ''}" 
           data-actor-id="${npc.actorId}" data-npc-idx="${idx}"
           data-name="${foundry.utils.escapeHTML(name)}" data-img="${img}"
           style="left: ${x}px; top: ${y}px;">
        <div class="cgm-npc-token-scene-wrap">
          <div class="cgm-token-ring"></div>
          <img src="${img}" alt="${foundry.utils.escapeHTML(name)}" class="cgm-npc-token-img" draggable="false">
          ${effectsHTML}
          ${isDefeated ? '<div class="cgm-token-defeated-overlay"><i class="fas fa-skull"></i></div>' : ''}
        </div>
        ${levelBarHTML}
      </div>
    `;
  }

  _buildLevelBarHTML(level) {
    if (level === null || level === undefined) return '';
    const clamped = Math.max(1, Math.min(15, level));
    const pct = (clamped / 15) * 100;
    let color;
    if (clamped <= 5) color = "#40b060";
    else if (clamped <= 7) color = "#e8c840";
    else if (clamped <= 10) color = "#d94040";
    else color = "#a040d0";
    return `
      <div class="cgm-token-level-bar" title="Level ${clamped}">
        <div class="cgm-token-level-track">
          <div class="cgm-token-level-fill" style="width:${pct}%;background:${color};"></div>
        </div>
        <span class="cgm-token-level-text">${clamped}</span>
      </div>
    `;
  }

  _getNPCLevel(actor) {
    if (!actor) return null;
    const sys = actor.system;
    if (!sys) return null;
    // Cypher System: level is typically in pools.level or basic.level
    const level = sys.pools?.level?.value ?? sys.basic?.level ?? sys.level ?? null;
    return level !== undefined && level !== null ? parseInt(level) : null;
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
      this.element.style.width = "700px";
      this.element.style.maxWidth = "90vw";
      this.element.style.maxHeight = "70vh";
      this.element.style.zIndex = "calc(var(--cgm-z-dialog, 10000) - 1)";
      this.element.style.overflow = "visible";
      requestAnimationFrame(() => this.element.classList.add("cgm-fancy-visible"));
    }

    const $html = $(this.element);

    $html.find(".cgm-npc-canvas-close").on("click", () => {
      if (this._locked) {
        ui.notifications.info("NPC Canvas is locked. Unlock to close.");
        return;
      }
      this.close();
    });
    $html.find(".cgm-npc-canvas-add-tab").on("click", () => this._onAddTab());
    $html.find(".cgm-npc-canvas-lock").on("click", () => {
      this._locked = !this._locked;
      const btn = this.element.querySelector(".cgm-npc-canvas-lock");
      if (btn) {
        btn.title = this._locked ? "Unlock" : "Lock";
        btn.classList.toggle("locked", this._locked);
        btn.querySelector("i")?.classList.toggle("fa-lock", this._locked);
        btn.querySelector("i")?.classList.toggle("fa-lock-open", !this._locked);
      }
      ui.notifications.info(`NPC Canvas ${this._locked ? "locked" : "unlocked"}.`);
    });
    $html.find(".cgm-npc-canvas-reset-view").on("click", () => this._resetView());

    // Search toggle
    $html.find(".cgm-npc-canvas-search-toggle").on("click", () => {
      this._showSearchInput = !this._showSearchInput;
      this.render();
    });
    // Search input — filter in-place without re-rendering
    $html.find(".cgm-canvas-search-input").on("input", (e) => {
      this._searchQuery = e.currentTarget.value;
      this._filterVisibleTokens();
    });
    // Search clear
    $html.find(".cgm-canvas-search-clear").on("click", () => {
      this._searchQuery = "";
      this._showSearchInput = false;
      this.render();
    });

    // Tab click
    $html.find(".cgm-canvas-tab").on("click", (e) => {
      const tabId = e.currentTarget.dataset.tabId;
      if (tabId) { this._activeTab = tabId; this._selectedNPCs.clear(); this.render(); }
    });

    // Tab RIGHT CLICK → Fancy context menu
    $html.find(".cgm-canvas-tab").on("contextmenu", (e) => {
      e.preventDefault();
      const tabId = e.currentTarget.dataset.tabId;
      if (tabId) this._onTabRightClick(tabId, e);
    });

    // Token click (select/deselect)
    $html.find(".cgm-npc-token").on("click", (e) => {
      const tokenEl = e.currentTarget;
      const actorId = tokenEl.dataset.actorId;
      if (e.ctrlKey || e.metaKey) {
        // Multi-select toggle
        if (this._selectedNPCs.has(actorId)) {
          this._selectedNPCs.delete(actorId);
          tokenEl.classList.remove("cgm-token-selected");
        } else {
          this._selectedNPCs.add(actorId);
          tokenEl.classList.add("cgm-token-selected");
        }
      } else {
        // Single select — clear others
        this._selectedNPCs.clear();
        $html.find(".cgm-npc-token").removeClass("cgm-token-selected");
        this._selectedNPCs.add(actorId);
        tokenEl.classList.add("cgm-token-selected");
      }
    });

    // Token right-click → context menu
    $html.find(".cgm-npc-token").on("contextmenu", (e) => {
      e.preventDefault();
      const actorId = e.currentTarget.dataset.actorId;
      const actor = game.actors?.get(actorId);
      if (actor) this._showTokenContextMenu(e, actor, e.currentTarget);
    });

    // Token double-click → open sheet
    $html.find(".cgm-npc-token").on("dblclick", (e) => {
      const actorId = e.currentTarget.dataset.actorId;
      const actor = game.actors?.get(actorId);
      if (actor) actor.sheet.render(true);
    });

    // Token hover → fancy tooltip (appended to app root to escape overflow:hidden)
    $html.find(".cgm-npc-token").on("mouseenter", (e) => {
      this._showTokenTooltip(e.currentTarget);
    });
    $html.find(".cgm-npc-token").on("mouseleave", () => {
      this._hideTokenTooltip();
    });

    this._bindSceneInteractions($html);
  }

  /* ================================================================
     TOKEN TOOLTIP — Shown above all elements, outside viewport
     ================================================================ */

  _showTokenTooltip(tokenEl) {
    this._hideTokenTooltip();
    const name = tokenEl.dataset.name || "Unknown";
    const img = tokenEl.dataset.img || "icons/svg/mystery-man.svg";

    const tooltip = document.createElement("div");
    tooltip.className = "cgm-token-tooltip-fancy";
    tooltip.id = "cgm-token-tooltip-active";
    tooltip.innerHTML = `
      <img src="${img}" alt="" draggable="false">
      <span>${foundry.utils.escapeHTML(name)}</span>
    `;

    // Append to app element (outside viewport's overflow:hidden)
    const appEl = this.element[0] || this.element;
    appEl.appendChild(tooltip);

    // Position: centered above the token, relative to app
    const appRect = appEl.getBoundingClientRect();
    const tokenRect = tokenEl.getBoundingClientRect();
    const top = tokenRect.top - appRect.top - tooltip.offsetHeight - 12;
    const left = tokenRect.left - appRect.left + (tokenRect.width / 2) - (tooltip.offsetWidth / 2);

    tooltip.style.top = `${top}px`;
    tooltip.style.left = `${left}px`;
    tooltip.style.opacity = "1";
    tooltip.style.transform = "translateY(0) scale(1)";
  }

  _hideTokenTooltip() {
    const existing = document.getElementById("cgm-token-tooltip-active");
    if (existing) existing.remove();
  }

    /* ================================================================
     TAB RIGHT CLICK → Fancy context menu
     ================================================================ */
  async _onTabRightClick(tabId, event) {
    const tab = this._tabs.find(t => t.id === tabId);
    if (!tab) return;

    const tabEl = event.currentTarget || event.target;
    const tabRect = tabEl.getBoundingClientRect();

    const menu = document.createElement("div");
    menu.className = "cgm-fancy-ctx-menu";
    const isHome = tabId === "home";
    menu.innerHTML = `
      <div class="cgm-fancy-ctx-header"><i class="fas ${tab.icon}"></i> ${foundry.utils.escapeHTML(tab.label)}</div>
      <div class="cgm-fancy-ctx-section">Tab</div>
      <div class="cgm-fancy-ctx-item" data-action="settings"><i class="fas fa-sliders-h"></i> Tab Settings</div>
      <div class="cgm-fancy-ctx-item" data-action="grid-settings"><i class="fas fa-border-all"></i> Grid Settings</div>
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
        if (action === "settings") {
          this._showTabSettingsDialog(tabId);
        } else if (action === "grid-settings") {
          this._showGridSettingsDialog(tabId);
        } else if (action === "delete") {
          if (tabId === "home") { ui.notifications.warn("The HOME tab cannot be deleted."); close(); return; }
          if (this._tabs.length <= 1) { ui.notifications.warn("Cannot delete the last tab."); close(); return; }
          const confirmed = await foundry.applications.api.DialogV2.confirm({
            window: { title: "Delete Tab" },
            content: `<p>Delete "${foundry.utils.escapeHTML(tab.label)}" and all its NPCs?</p>`
          });
          if (confirmed) {
            this._tabs = this._tabs.filter(t => t.id !== tabId);
            delete this._npcs[tabId];
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

  /* ================================================================
     GRID SETTINGS DIALOG (NPC Canvas)
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

/* ═══════════════════════════════════════════════════════════════
     TAB SETTINGS DIALOG v2 — Clean Rewrite
     ═══════════════════════════════════════════════════════════════ */

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

    const iconGrid = NPC_CANVAS_ICONS.map(ic => `
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

            const tabIdx = this._tabs.findIndex(t => t.id === tabId);
            if (tabIdx >= 0) {
              if (newSettings.label) this._tabs[tabIdx].label = newSettings.label.toUpperCase();
              if (newSettings.icon) this._tabs[tabIdx].icon = newSettings.icon;
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
        html.find('#cgm-clear-font-color').on('click', () => { html.find('#cgm-set-font-color').val('#c8a96e'); updatePreview(); });
        html.find('#cgm-clear-tab-bg').on('click', () => { html.find('#cgm-set-tab-bg').val('#3a3050'); updatePreview(); });

        // File picker
        html.find('#cgm-pick-bg-image').on('click', () => {
          new FilePicker({ type: "image", current: html.find("#cgm-set-bg-image").val(),
            callback: (path) => { html.find("#cgm-set-bg-image").val(path); }
          }).render(true);
        });
        html.find('#cgm-clear-bg-image').on('click', () => { html.find('#cgm-set-bg-image').val(''); });

        // Icon grid
        html.find('.cgm-ts-icon-grid button').on('click', (e) => {
          const btn = e.currentTarget;
          html.find('.cgm-ts-icon-grid button').removeClass('cgm-ts-active');
          btn.classList.add('cgm-ts-active');
          html.find('#cgm-set-icon').val(btn.dataset.icon);
          updatePreview();
        });
      },
      close: () => {
        // Overlay removed — no longer used
      }
    });
    dialog.render(true);
  }

  /* ================================================================
     SCENE INTERACTIONS (pan, zoom, drag, drop)
     ================================================================ */

  _bindSceneInteractions($html) {
    const viewport = $html.find(".cgm-npc-canvas-viewport")[0];
    const world = $html.find(".cgm-npc-canvas-world")[0];
    if (!viewport || !world) return;

    viewport.addEventListener("mousedown", (e) => {
      const isToken = e.target.closest(".cgm-npc-token");
      if (e.button === 1 || (e.button === 0 && !isToken)) {
        e.preventDefault();
        this._isPanning = true;
        this._panStart = { x: e.clientX, y: e.clientY };
        this._cameraStart = { ...this._camera };
        viewport.style.cursor = "grabbing";
      }
    });

    document.addEventListener("mousemove", (e) => {
      if (!this._isPanning) return;
      e.preventDefault();
      const dx = e.clientX - this._panStart.x;
      const dy = e.clientY - this._panStart.y;
      this._camera.x = this._cameraStart.x + dx;
      this._camera.y = this._cameraStart.y + dy;
      this._updateTransform(world);
    });

    document.addEventListener("mouseup", () => {
      if (this._isPanning) {
        this._isPanning = false;
        viewport.style.cursor = "";
      }
    });

    viewport.addEventListener("wheel", (e) => {
      e.preventDefault();
      const zoomDelta = e.deltaY > 0 ? -0.1 : 0.1;
      this._zoom(zoomDelta);
    }, { passive: false });

    this._bindTokenDrag(viewport, world);

    viewport.addEventListener("dragenter", (e) => { 
      e.preventDefault(); 
      this._dragOver = true; 
      viewport.classList.add("cgm-npc-canvas-dragover"); 
    });
    viewport.addEventListener("dragover", (e) => { e.preventDefault(); });
    viewport.addEventListener("dragleave", (e) => { 
      if (!viewport.contains(e.relatedTarget)) { 
        this._dragOver = false; 
        viewport.classList.remove("cgm-npc-canvas-dragover"); 
      } 
    });
    viewport.addEventListener("drop", (e) => {
      e.preventDefault();
      this._dragOver = false;
      viewport.classList.remove("cgm-npc-canvas-dragover");
      this._onDrop(e, viewport, world);
    });
  }

  _bindTokenDrag(viewport, world) {
    const settings = this._getTabSettings(this._activeTab);

    viewport.addEventListener("mousedown", (e) => {
      const tokenEl = e.target.closest(".cgm-npc-token");
      if (!tokenEl) return;
      if (e.button !== 0) return;

      e.preventDefault();
      e.stopPropagation();
      this._draggingToken = tokenEl;
      
      const rect = tokenEl.getBoundingClientRect();
      this._dragOffset = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
      };
      tokenEl.classList.add("cgm-token-dragging");
    });

    document.addEventListener("mousemove", (e) => {
      if (!this._draggingToken) return;
      e.preventDefault();
      
      const viewportRect = viewport.getBoundingClientRect();
      const viewportX = e.clientX - viewportRect.left - this._dragOffset.x;
      const viewportY = e.clientY - viewportRect.top - this._dragOffset.y;
      const worldX = (viewportX - this._camera.x) / this._camera.zoom;
      const worldY = (viewportY - this._camera.y) / this._camera.zoom;
      
      this._draggingToken.style.left = `${worldX}px`;
      this._draggingToken.style.top = `${worldY}px`;
    });

    document.addEventListener("mouseup", async (e) => {
      if (!this._draggingToken) return;
      
      const idx = parseInt(this._draggingToken.dataset.npcIdx);
      const npc = this._npcs[this._activeTab]?.[idx];
      if (npc) {
        let x = parseInt(this._draggingToken.style.left);
        let y = parseInt(this._draggingToken.style.top);

        // Snap to grid if enabled
        const settings = this._getTabSettings(this._activeTab);
        if (settings.snapToGrid) {
          const gridSize = settings.gridSize || 50;
          x = Math.round(x / gridSize) * gridSize;
          y = Math.round(y / gridSize) * gridSize;
          this._draggingToken.style.left = `${x}px`;
          this._draggingToken.style.top = `${y}px`;
        }

        npc.x = x;
        npc.y = y;
        await this._saveToFlags();
      }
      
      this._draggingToken.classList.remove("cgm-token-dragging");
      this._draggingToken = null;
    });
  }

  _updateTransform(worldEl) {
    if (!worldEl) return;
    worldEl.style.transform = `translate(${this._camera.x}px, ${this._camera.y}px) scale(${this._camera.zoom})`;
    const settings = this._getTabSettings(this._activeTab);
    const gridSize = (settings.gridSize || 50) * this._camera.zoom;
    const offsetX = this._camera.x % gridSize;
    const offsetY = this._camera.y % gridSize;
    const grid = worldEl.querySelector('.cgm-npc-canvas-grid');
    if (grid) {
      grid.style.backgroundSize = `${gridSize}px ${gridSize}px`;
      grid.style.backgroundPosition = `${offsetX}px ${offsetY}px`;
    }
    const zoomDisplay = this.element?.querySelector('.cgm-canvas-zoom-level');
    if (zoomDisplay) zoomDisplay.textContent = `${Math.round(this._camera.zoom * 100)}%`;
  }

  _zoom(delta) {
    const oldZoom = this._camera.zoom;
    this._camera.zoom = Math.max(0.3, Math.min(2.0, this._camera.zoom + delta));
    const viewport = this.element?.querySelector('.cgm-npc-canvas-viewport');
    if (viewport) {
      const rect = viewport.getBoundingClientRect();
      const zoomRatio = this._camera.zoom / oldZoom;
      this._camera.x = (rect.width / 2) - ((rect.width / 2) - this._camera.x) * zoomRatio;
      this._camera.y = (rect.height / 2) - ((rect.height / 2) - this._camera.y) * zoomRatio;
    }
    const world = this.element?.querySelector('.cgm-npc-canvas-world');
    this._updateTransform(world);
  }

  _resetView() {
    this._camera = { x: 0, y: 0, zoom: 1 };
    const world = this.element?.querySelector('.cgm-npc-canvas-world');
    this._updateTransform(world);
  }

  async _onDrop(event, viewport, world) {
    event.preventDefault();
    this._dragOver = false;
    
    let data;
    try {
      data = JSON.parse(event.dataTransfer.getData("text/plain"));
    } catch {
      const raw = event.dataTransfer.getData("text/plain");
      if (!raw) return;
      try { data = JSON.parse(raw); } catch { return; }
    }
    if (!data) return;

    const viewportRect = viewport.getBoundingClientRect();
    const dropX = event.clientX - viewportRect.left;
    const dropY = event.clientY - viewportRect.top;
    const worldX = Math.round((dropX - this._camera.x) / this._camera.zoom - 50);
    const worldY = Math.round((dropY - this._camera.y) / this._camera.zoom - 50);

    if (data.type === "Actor") {
      let actor = null;
      if (data.uuid) {
        try { actor = await fromUuid(data.uuid); } catch {}
      } else if (data.id) {
        actor = game.actors?.get(data.id);
      }
      if (actor && (actor.type === "npc" || actor.type === "NPC")) {
        await this._addNPC(actor, worldX, worldY);
      }
      return;
    }
    
    if (data.type === "Token") {
      const token = canvas.tokens?.get(data.uuid || data.id);
      if (token?.actor && (token.actor.type === "npc" || token.actor.type === "NPC")) {
        await this._addNPC(token.actor, worldX, worldY);
      }
      return;
    }
  }

  async _addNPC(actor, x, y) {
    if (!this._npcs[this._activeTab]) this._npcs[this._activeTab] = [];
    const exists = this._npcs[this._activeTab].some(n => n.actorId === actor.id);
    if (exists) {
      ui.notifications.warn(`${actor.name} is already on this canvas.`);
      return;
    }
    // Snap if enabled
    const settings = this._getTabSettings(this._activeTab);
    if (settings.snapToGrid) {
      const gridSize = settings.gridSize || 50;
      x = Math.round((x || 100) / gridSize) * gridSize;
      y = Math.round((y || 100) / gridSize) * gridSize;
    }
    this._npcs[this._activeTab].push({
      actorId: actor.id, name: actor.name, img: actor.img,
      x: x ?? 100, y: y ?? 100, addedAt: Date.now()
    });
    await this._saveToFlags();
    this.render();
    ui.notifications.info(`Added ${actor.name} to ${this._getTabLabel(this._activeTab)}.`);
  }

  async _removeNPC(idx) {
    const npc = this._npcs[this._activeTab]?.[idx];
    if (!npc) return;
    this._npcs[this._activeTab].splice(idx, 1);
    await this._saveToFlags();
    this.render();
  }

  async _onSetPortrait($token) {
    const idx = parseInt($token.data("npcIdx"));
    const npc = this._npcs[this._activeTab]?.[idx];
    if (!npc) return;
    const fp = new FilePicker({
      type: "image", current: npc.img,
      callback: async (path) => {
        npc.img = path;
        await this._saveToFlags();
        this.render();
      }
    });
    fp.render(true);
  }

  _closeContextMenu() {
    if (this._contextMenu) {
      this._contextMenu.remove();
      this._contextMenu = null;
    }
  }

  /* ================================================================
     TOKEN CONTEXT MENU
     ================================================================ */

  _showTokenContextMenu(event, actor, tokenEl) {
    this._closeContextMenu();
    const sceneToken = canvas.tokens?.placeables?.find(t => t.actor?.id === actor.id);
    const inCombat = sceneToken ? game.combat?.combatants?.some(c => c.tokenId === sceneToken.id) : false;
    const isDefeated = actor?.effects?.some(e => e.statuses?.has("dead") || e.label === "Dead");
    
    const portraitModule = game.modules?.get("ginzzzu-portraits");
    const portraitShown = portraitModule?.active && !!foundry.utils.getProperty(actor, "flags.ginzzzu-portraits.portraitShown");
    const showCharLabel = portraitShown ? "Hide Character" : "Show Character";
    const showCharClass = portraitShown ? "cgm-ctx-blue" : "cgm-ctx-blue";
    
    // Position above the token
    const tokenRect = tokenEl.getBoundingClientRect();
    
    const menu = document.createElement("div");
    menu.className = "cgm-fancy-ctx-menu cgm-npc-context-menu";
    menu.innerHTML = `
      <div class="cgm-fancy-ctx-header">
        <img src="${actor?.img || 'icons/svg/mystery-man.svg'}" alt="">
        <span>${foundry.utils.escapeHTML(actor?.name || 'NPC')}</span>
      </div>
      <div class="cgm-fancy-ctx-section">Actions</div>
      <div class="cgm-fancy-ctx-item ${showCharClass}" data-action="show-character"><i class="fas fa-portrait"></i> ${showCharLabel}</div>
      <div class="cgm-fancy-ctx-item" data-action="open-sheet"><i class="fas fa-user-circle"></i> Open Character Sheet</div>
      <div class="cgm-fancy-ctx-item" data-action="pan-to"><i class="fas fa-crosshairs"></i> Pan to Token</div>
      <div class="cgm-fancy-ctx-item" data-action="target"><i class="fas fa-bullseye"></i> ${sceneToken?.isTargeted ? 'Untarget' : 'Target'} Token</div>
      <div class="cgm-fancy-ctx-sep"></div>
      <div class="cgm-fancy-ctx-section">Combat</div>
      <div class="cgm-fancy-ctx-item" data-action="toggle-combat"><i class="fas fa-fist-raised"></i> ${inCombat ? 'Remove from Combat' : 'Add to Combat'}</div>
      <div class="cgm-fancy-ctx-item" data-action="toggle-defeated"><i class="fas fa-skull"></i> ${isDefeated ? 'Mark Healthy' : 'Mark Defeated'}</div>
      <div class="cgm-fancy-ctx-item" data-action="toggle-visibility"><i class="fas fa-eye"></i> Toggle Visibility</div>
      <div class="cgm-fancy-ctx-sep"></div>
      <div class="cgm-fancy-ctx-section">Organization</div>
      <div class="cgm-fancy-ctx-item" data-action="copy-token"><i class="fas fa-copy"></i> Copy Token</div>
      <div class="cgm-fancy-ctx-item cgm-fancy-ctx-has-submenu" data-action="move-to-tab">
        <i class="fas fa-folder-open"></i> Move to Tab <i class="fas fa-chevron-right cgm-fancy-ctx-chevron"></i>
        <div class="cgm-fancy-ctx-submenu">
          ${this._tabs.filter(t => t.id !== this._activeTab).map(t => `
            <div class="cgm-fancy-ctx-subitem" data-tab-id="${t.id}">
              <i class="fas ${t.icon}"></i> ${foundry.utils.escapeHTML(t.label)}
            </div>
          `).join('')}
        </div>
      </div>
      <div class="cgm-fancy-ctx-sep"></div>
      <div class="cgm-fancy-ctx-item cgm-ctx-danger" data-action="delete"><i class="fas fa-trash"></i> Remove from Canvas</div>
    `;
    menu.style.cssText = `position:fixed;z-index:99999;`;
    document.body.appendChild(menu);
    this._contextMenu = menu;

    // Position above the token
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
    
    const closeMenu = (e) => {
      if (e && menu.contains(e.target)) return;
      this._closeContextMenu();
      document.removeEventListener("click", closeMenu);
      document.removeEventListener("keydown", escHandler);
    };
    const escHandler = (e) => { if (e.key === "Escape") closeMenu(); };
    setTimeout(() => {
      document.addEventListener("click", closeMenu);
      document.addEventListener("keydown", escHandler);
    }, 50);
    
    menu.querySelectorAll(".cgm-fancy-ctx-item").forEach(item => {
      item.addEventListener("click", async () => {
        const action = item.dataset.action;
        const idx = parseInt(tokenEl.dataset.npcIdx);
        switch (action) {
          case "show-character": await this._showCharacterInPortraits(actor); break;
          case "open-sheet": actor.sheet.render(true); break;
          case "pan-to": this._findTokenOnCanvas(actor); break;
          case "target": if (sceneToken) sceneToken.setTarget(!sceneToken.isTargeted, { releaseOthers: false }); break;
          case "toggle-combat": await this._toggleCombat(actor, sceneToken); break;
          case "toggle-defeated": await this._toggleDefeated(actor); break;
          case "toggle-visibility": if (sceneToken) { await sceneToken.document.update({ hidden: !sceneToken.document.hidden }); ui.notifications.info(`${actor.name} is now ${sceneToken.document.hidden ? 'hidden' : 'visible'}.`); } break;
          case "copy-token": await this._copyToken(actor); break;
          case "move-to-tab": break; // handled by submenu
          case "delete": this._removeNPC(idx); break;
        }
        if (action !== "move-to-tab") closeMenu();
      });
    });

    // Submenu tab click
    menu.querySelectorAll(".cgm-fancy-ctx-subitem").forEach(sub => {
      sub.addEventListener("click", async () => {
        const targetTab = sub.dataset.tabId;
        if (targetTab) await this._moveNPCToTab(actor, targetTab);
        closeMenu();
      });
    });
  }

  _findTokenOnCanvas(actor) {
    const token = canvas.tokens?.placeables?.find(t => t.actor?.id === actor.id);
    if (token) {
      canvas.animatePan({ x: token.x, y: token.y });
      token.control({ releaseOthers: true });
    } else {
      ui.notifications.warn(`${actor.name} has no token on the current scene.`);
    }
  }

  async _toggleCombat(actor, sceneToken) {
    if (!sceneToken) { ui.notifications.warn("No token on scene."); return; }
    const combatant = game.combat?.getCombatantByToken(sceneToken.id);
    if (combatant) { await combatant.delete(); ui.notifications.info(`${actor.name} removed from combat.`); }
    else { await game.combat?.createEmbeddedDocuments("Combatant", [{ tokenId: sceneToken.id, sceneId: canvas.scene?.id, actorId: actor.id }]); ui.notifications.info(`${actor.name} added to combat.`); }
  }

  async _toggleDefeated(actor) {
    const isDead = actor?.effects?.some(e => e.statuses?.has("dead"));
    if (isDead) { const effect = actor.effects.find(e => e.statuses?.has("dead")); if (effect) await effect.delete(); ui.notifications.info(`${actor.name} marked as healthy.`); }
    else { await actor.createEmbeddedDocuments("ActiveEffect", [{ name: "Dead", icon: "icons/svg/skull.svg", statuses: new Set(["dead"]), disabled: false }]); ui.notifications.info(`${actor.name} marked as defeated.`); }
    this.render();
  }

  async _copyToken(actor) {
    const npcs = this._npcs[this._activeTab] || [];
    const existing = npcs.find(n => n.actorId === actor.id);
    if (!existing) return;
    await navigator.clipboard?.writeText(JSON.stringify({ type: "NPCCanvas", npc: existing }));
    ui.notifications.info(`${actor.name} copied to clipboard.`);
  }

  async _moveNPCToTab(actor, targetTabId) {
    if (targetTabId === this._activeTab) return;
    if (!this._npcs[targetTabId]) this._npcs[targetTabId] = [];
    const npcs = this._npcs[this._activeTab] || [];
    const idx = npcs.findIndex(n => n.actorId === actor.id);
    if (idx === -1) return;
    const npc = npcs.splice(idx, 1)[0];
    this._npcs[targetTabId].push(npc);
    await this._saveToFlags();
    this.render();
    ui.notifications.info(`${actor.name} moved to ${this._getTabLabel(targetTabId)}.`);
  }

  async _showCharacterInPortraits(actor) {
    const portraitModule = game.modules?.get("ginzzzu-portraits");
    if (!portraitModule?.active) {
      ui.notifications.warn("ginzzzu-portraits module is not active.");
      return;
    }
    if (!game.user?.isGM) {
      ui.notifications.warn("Only the GM can show/hide portraits.");
      return;
    }
    try {
      const shown = !!foundry.utils.getProperty(actor, "flags.ginzzzu-portraits.portraitShown");
      await actor.update({ "flags.ginzzzu-portraits.portraitShown": !shown });
      ui.notifications.info(`${actor.name} ${shown ? "hidden from" : "shown in"} ginzzzu-portraits.`);
    } catch (e) {
      console.error("[cypher-gm-taskbar] Failed to toggle portrait:", e);
      ui.notifications.error("Failed to toggle character in portraits.");
    }
  }

  async _onAddTab() {
    const dialog = new Dialog({
      title: "Add Tab",
      content: `
        <div class="cgm-dialog-form">
          <div class="cgm-form-row"><label>Tab Name:</label><input type="text" id="cgm-new-tab-name" placeholder="My NPCs"></div>
          <div class="cgm-form-row"><label>Icon:</label><select id="cgm-new-tab-icon">
            <option value="fa-users">Users</option><option value="fa-star">Star</option><option value="fa-skull">Skull</option>
            <option value="fa-dragon">Dragon</option><option value="fa-chess-knight">Knight</option><option value="fa-shield-alt">Shield</option>
            <option value="fa-fire">Fire</option><option value="fa-moon">Moon</option>
          </select></div>
        </div>`,
      buttons: {
        create: { icon: "<i class='fas fa-check'></i>", label: "Create", callback: async (html) => {
          const name = html.find("#cgm-new-tab-name").val().trim();
          const icon = html.find("#cgm-new-tab-icon").val();
          if (!name) return;
          const id = "tab_" + Date.now();
          this._tabs.push({ id, label: name.toUpperCase(), icon });
          this._npcs[id] = [];
          this._activeTab = id;
          await this._saveToFlags();
          this.render();
        }},
        cancel: { label: "Cancel" }
      },
      default: "create"
    });
    dialog.render(true);
  }

  _getTabLabel(tabId) { return this._tabs.find(t => t.id === tabId)?.label || tabId; }

  _ensureDefaultTabs() {
    if (this._tabs.length === 0) {
      this._tabs = [
        { id: "general", label: "GENERAL", icon: "fa-users" },
        { id: "favourite", label: "FAVOURITE", icon: "fa-star" }
      ];
      this._npcs = { general: [], favourite: [] };
    }
  }

  /* ================================================================
     PERSISTENCE
     ================================================================ */

  async _saveToFlags() {
    try { 
      await game.settings.set(MODULE_ID, "npcCanvasData", JSON.stringify({
        tabs: this._tabs,
        npcs: this._npcs,
        activeTab: this._activeTab,
        camera: this._camera,
        tabSettings: this._tabSettings
      })); 
    }
    catch (err) { console.warn("[CypherGMTaskbar] Failed to save NPC canvas:", err); }
  }

  async _loadFromFlags() {
    try {
      const raw = game.settings.get(MODULE_ID, "npcCanvasData");
      if (!raw || raw === "{}") return;
      const data = JSON.parse(raw);
      this._tabs = data.tabs || [];
      this._npcs = data.npcs || {};
      this._activeTab = data.activeTab || "general";
      this._tabSettings = data.tabSettings || {};
      if (data.camera) this._camera = data.camera;
    } catch {}
  }

  close(options = {}) {
    this._closeContextMenu();
    if (this._isPanning) this._isPanning = false;
    if (this.element) this.element.classList.remove("cgm-fancy-visible");
    return super.close(options);
  }
}
