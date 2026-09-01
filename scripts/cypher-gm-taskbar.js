/**
 * Cypher GM Taskbar v4.5.104
 * Foundry VTT v13+ | Cypher System
 *
 * GM-only taskbar with combat tracker, intrusions, cyphers, recovery,
 * NPCs, notes, and settings panels. Floating player portraits on left edge.
 */

const MODULE_ID = "cypher-gm-taskbar";

class GMTaskbar {
  constructor() {
    this.element = null;
    this.activePanel = null;
    this._panelEl = null;
    this._difficulty = 0;
    this._intrusions = [];
    this._recoveryChecks = {};
    this._notes = "";
    this._globalDifficulty = 4;
    this._dock = "bottom";
    this._opacity = 100;
    this._compact = false;
    this._locked = true;
    this._portraitPosition = "left";
    this._portraitSize = 48;
    this._portraitObjectFit = "cover";
    this._portraitNameAbove = false;
    this._portraitBarOffset = 0;
    this._portraitBarWidth = 48;
    this._portraitBorderColor = "";
    this._portraitBorderWidth = 3;
    this._portraitShape = "circle";
    this._portraitNameSize = 12;
    this._portraitNameColor = "";
    this._portraitNameOffset = 0;
    this._portraitBgColor = "#000000";
    this._portraitBgOpacity = 30;
    this._portraitBgShape = "trapezoid";
    this._xpCircleSize = 16;
    this._xpCircleOffsetX = 0;
    this._xpCircleOffsetY = 4;
    this._settingsTab = "general";
    this._autoHideTimer = null;
    this._isHidden = false;
    this._connInterval = null;
    this._radialMenuEl = null;
    this._tooltipEl = null;
    this._tooltipTimer = null;
    this._effectTooltipEl = null;
    this._effectTooltipTimer = null;
    this._itemTooltipEl = null;
    this._radialMenuSize = 200;
    this._radialMenuOffset = 20;
    this._notesPanelEl = null;
    // Section settings (extensible for multiple sections)
    this._sections = [
      { id: "section1", name: "SECTION 1", width: 10, bgColor: "#ffffff", bgOpacity: 30, labelColor: "" },
      { id: "section2", name: "SECTION 2", width: 10, bgColor: "#ffffff", bgOpacity: 30, labelColor: "" },
      { id: "section3", name: "SECTION 3", width: 10, bgColor: "#ffffff", bgOpacity: 30, labelColor: "" },
      { id: "section4", name: "TRAY", width: 15, bgColor: "#1a1020", bgOpacity: 50, labelColor: "" }
    ];
    this._notesPanelPos = null;
    this._portraitVisibilityMode = this._gs("portraitVisibilityMode", "all");
    this._disconnectedActors = new Set();
    this._disconnectionSounds = new Map(); // actorId -> sound instance
    this._notesLineStart = null;
    this._targetPanelEl = null;
    this._targetPanelPos = null;
    this._targetLineStart = null;
    this._damagePanelEl = null;
    this._damagePanelPos = null;
    this._damageLineStart = null;
    this._cashValuesPanelEl = null;
    this._cashValuesPanelPos = null;
    this._cashValuesLineStart = null;
    this._assetsPanelEl = null;
    this._assetsPanelPos = null;
    this._assetsLineStart = null;
    this._itemsPanelEl = null;
    this._itemsPanelPos = null;
    this._itemsPanelSize = null;
    this._itemsLineStart = null;
    this._dropItemPanelEl = null;
    this._recoveryPanelEl = null;
    this._recoveryPanelPos = null;
    this._recoveryLineStart = null;
    this._cyphersPanelEl = null;
    this._cyphersPanelPos = null;
    this._cyphersLineStart = null;
    this._notesSubMenuEl = null;
    this._targetSubMenuEl = null;
    this._valuesSubMenuEl = null;
    this._recoverySubMenuEl = null;
    this._cyphersSubMenuEl = null;
    this._effectsPickerEl = null;
    this._gmGroupRollMenuEl = null;
    this._gmGroupRollAttributesEl = null;
    this._gmGroupRollSkillsEl = null;
    this._gmGroupRollFreeEl = null;
    this._gmGroupRollDefenseEl = null;
    this._recoveryTaskbarMenuEl = null;
    this._reputationPanelEl = null;
    this._reputationPanelPos = null;
    this._groupStatuses = new GroupStatusesMenu(this);
    // Cypher XP integration
    this._xpApi = null;
    this._xpFlashTimer = null;
    this._xpCountInterval = null;
    this._openingXpDashboard = false;
    this._xpActionHistory = [];     // Award / Approve / Reject actions for undo
    this._xpHistoryIndex = -1;       // Current position in history
    this._xpMaxHistory = 20;         // Max history entries
    this._xpHistoryHookIds = [];     // Track registered hook IDs for cleanup
    this._registerXpHistoryHooks();  // Auto-log cypher-xp GM actions
    // Tray (Section 4) — minimized window tracking
    this._trayApps = new Map();
    this._trayInterval = null;
    this._subMenuPositions = {};
    this._lastDifficulty = 0;
    this._dynamicButtons = []; // Discovered injected buttons from other modules
    // Party data cache (optimization: avoid rebuilding data multiple times per frame)
    this._partyDataCache = null;
    this._partyDataCacheTime = 0;
    this._partyDataCacheTTL = 300; // ms
    this._loadSettings();
    this._loadPanelPositions();
  }

  /** Register cypher-xp hooks to auto-log GM actions for History + Undo */
  _registerXpHistoryHooks() {
    const hooks = [
      // GM awards XP
      { event: "cypher-xp.xpAwarded", handler: ({ actor, transaction }) => {
        if (transaction?.type !== "gm-award") return;
        this._pushXpHistory({
          type: "awardXP",
          actorId: actor.id,
          actorName: actor.name,
          actorImg: actor.img,
          amount: transaction.xpDelta || 0,
          reason: transaction.label || "GM Award",
          timestamp: transaction.timestamp || Date.now(),
          undone: false
        });
        this._refreshHistoryView();
      }},
      // Request created (player submits)
      { event: "cypher-xp.requestCreated", handler: ({ actor, request }) => {
        this._pushXpHistory({
          type: "requestCreated",
          actorId: actor.id,
          actorName: actor.name,
          actorImg: actor.img,
          requestId: request.id,
          category: request.category,
          requestedCost: request.requestedCost,
          label: request.label,
          timestamp: request.timestamp || Date.now(),
          undone: false
        });
        this._refreshHistoryView();
      }},
      // Request updated (approved / rejected / cancelled)
      { event: "cypher-xp.requestUpdated", handler: ({ actor, request }) => {
        const actionType = request.status === "approved" ? "requestApproved" : request.status === "rejected" ? "requestRejected" : "requestUpdated";
        this._pushXpHistory({
          type: actionType,
          actorId: actor.id,
          actorName: actor.name,
          actorImg: actor.img,
          requestId: request.id,
          category: request.category,
          requestedCost: request.requestedCost,
          label: request.label,
          status: request.status,
          timestamp: Date.now(),
          undone: false
        });
        this._refreshHistoryView();
      }},
      // Tier breakthrough
      { event: "cypher-xp.tierBreakthrough", handler: ({ actor, fromTier, toTier }) => {
        this._pushXpHistory({
          type: "tierBreakthrough",
          actorId: actor.id,
          actorName: actor.name,
          actorImg: actor.img,
          fromTier,
          toTier,
          timestamp: Date.now(),
          undone: false
        });
        this._refreshHistoryView();
      }},
      // Purchase applied (immediate spend)
      { event: "cypher-xp.purchaseApplied", handler: ({ actor, request, transaction }) => {
        this._pushXpHistory({
          type: "purchaseApplied",
          actorId: actor.id,
          actorName: actor.name,
          actorImg: actor.img,
          label: request?.label || transaction?.label || "Purchase",
          cost: request?.requestedCost || transaction?.xpDelta || 0,
          timestamp: Date.now(),
          undone: false
        });
        this._refreshHistoryView();
      }},
    ];

    for (const h of hooks) {
      const id = Hooks.on(h.event, h.handler);
      this._xpHistoryHookIds.push({ event: h.event, id });
    }
  }

  /** Clean up cypher-xp hooks (called on close/destroy if needed) */
  _unregisterXpHistoryHooks() {
    for (const h of this._xpHistoryHookIds) {
      Hooks.off(h.event, h.id);
    }
    this._xpHistoryHookIds = [];
  }

  /** Refresh the History tab view if it's currently visible */
  _refreshHistoryView() {
    const appEl = document.getElementById("cypher-xp-gm-dashboard");
    if (!appEl) return;
    const historyPanel = appEl.querySelector(".cgm-xp-history-panel");
    if (historyPanel && historyPanel.style.display !== "none") {
      this._renderXpHistoryPanel(historyPanel);
    }
    // Also update header undo/redo states if header exists
    const header = appEl.querySelector(".cgm-xp-dashboard-header");
    if (header) this._updateUndoRedoState(header);
  }

  /* ─── Cypher XP Integration ─── */
  _cypherXpActive() {
    return game.modules.get("cypher-xp")?.active === true;
  }

  _getXpApi() {
    if (this._xpApi?.openGmDashboard) return this._xpApi;
    const mod = game.modules.get("cypher-xp");
    if (mod?.active && mod.api?.openGmDashboard) {
      this._xpApi = mod.api;
      return mod.api;
    }
    return null;
  }

  /** Open Cypher XP GM Dashboard */
  async _openCypherXpApp(btnEl) {
    // Guard: prevent double-clicks / multiple listeners from opening multiple windows
    if (this._openingXpDashboard) return;
    this._openingXpDashboard = true;

    try {
      if (!this._cypherXpActive()) {
        return ui.notifications.warn("Cypher XP module is not active.");
      }

      let api = this._getXpApi();
      for (let i = 0; i < 50 && !api; i++) {
        await new Promise(r => setTimeout(r, 100));
        api = this._getXpApi();
      }
      if (!api) {
        return ui.notifications.warn("Cypher XP API is not ready yet.");
      }

      const GM_APP_ID = "cypher-xp-gm-dashboard";
      let appEl = null;

      // Use MutationObserver to catch the element the instant it enters the DOM
      // — before the browser paints a single frame in the default position.
      const observer = new MutationObserver((mutations) => {
        for (const mutation of mutations) {
          for (const node of mutation.addedNodes) {
            if (node.nodeType !== Node.ELEMENT_NODE) continue;
            if (node.id === GM_APP_ID) {
              appEl = node;
            } else if (node.querySelector) {
              const found = node.querySelector(`#${GM_APP_ID}`);
              if (found) appEl = found;
            }
            if (appEl) {
              observer.disconnect();
              // Hide completely (no layout, no paint) until positioned
              appEl.style.visibility = "hidden";
              appEl.style.transition = "none";
              return;
            }
          }
        }
      });
      observer.observe(document.body, { childList: true, subtree: true });

      // Open the dashboard
      await api.openGmDashboard();

      // Wait for observer to catch it (up to 2 seconds)
      let waitAttempts = 0;
      while (!appEl && waitAttempts < 40) {
        await new Promise(r => setTimeout(r, 50));
        waitAttempts++;
      }
      observer.disconnect();

      // Fallback: find it the normal way if observer missed it
      if (!appEl) {
        appEl = document.getElementById(GM_APP_ID);
      }
      if (!appEl) {
        return ui.notifications.warn("Cypher XP GM Dashboard did not open.");
      }

      // Position and inject header icons
      this._positionXpDashboard(appEl, btnEl);
      this._injectXpDashboardHeader(appEl);

      // Now make it visible — browser will paint it already in the right spot
      requestAnimationFrame(() => {
        appEl.style.visibility = "visible";
        appEl.style.transition = "opacity 0.15s ease";
        appEl.style.opacity = "1";
      });
    } finally {
      this._openingXpDashboard = false;
    }
  }

  /** Position Cypher XP GM Dashboard above the taskbar button AND lock it in place */
  _positionXpDashboard(appEl, btnEl) {
    if (!appEl || !btnEl) return;
    const btnRect = btnEl.getBoundingClientRect();
    const appWidth = appEl.offsetWidth || 920;
    const appHeight = appEl.offsetHeight || 720;

    // Bottom-left corner just above the button (4px gap)
    let top = btnRect.top - appHeight - 4;
    let left = btnRect.left;

    // Keep on screen: if too high, place below button instead
    if (top < 0) top = btnRect.bottom + 8;
    // Keep right edge on screen
    if (left + appWidth > window.innerWidth - 8) {
      left = Math.max(8, window.innerWidth - appWidth - 8);
    }

    // Find the actual Foundry ApplicationV2 instance and lock its position
    // so internal click/drag handlers can't move the window.
    const appId = appEl.id || "cypher-xp-gm-dashboard";
    let appInstance = null;
    if (ui.windows) {
      appInstance = Object.values(ui.windows).find(a => a.id === appId || a.element?.[0] === appEl || a.element === appEl);
    }
    if (!appInstance && appEl.dataset?.appid) {
      appInstance = ui.windows?.[appEl.dataset.appid];
    }

    if (appInstance) {
      // Lock: override setPosition so Foundry can't move the window
      if (!appInstance._cgmOriginalSetPosition) {
        appInstance._cgmOriginalSetPosition = appInstance.setPosition;
      }
      appInstance.setPosition = () => appInstance; // no-op, returns self
      // Update internal position object so Foundry thinks it's already there
      appInstance.position.left = left;
      appInstance.position.top = top;
      if (appInstance._updatePosition) {
        appInstance._updatePosition = () => {};
      }
    }

    // Apply CSS positioning as well
    appEl.style.position = "fixed";
    appEl.style.top = `${top}px`;
    appEl.style.left = `${left}px`;
    appEl.style.zIndex = "10000";
    appEl.style.transform = "none";

    // Intercept any future position changes via MutationObserver
    if (!appEl._cgmPositionLock) {
      appEl._cgmPositionLock = new MutationObserver((mutations) => {
        for (const m of mutations) {
          if (m.type === "attributes" && (m.attributeName === "style" || m.attributeName === "class")) {
            const el = m.target;
            // If Foundry changed our position, force it back
            const currentTop = parseFloat(el.style.top);
            const currentLeft = parseFloat(el.style.left);
            if (Math.abs(currentTop - top) > 2 || Math.abs(currentLeft - left) > 2) {
              el.style.top = `${top}px`;
              el.style.left = `${left}px`;
              el.style.position = "fixed";
              el.style.transform = "none";
            }
          }
        }
      });
      appEl._cgmPositionLock.observe(appEl, { attributes: true, attributeFilter: ["style", "class"] });
    }
  }

  /** Inject header icons into Cypher XP GM Dashboard */
  _injectXpDashboardHeader(appEl) {
    if (!appEl) return;
    if (appEl.querySelector(".cgm-xp-dashboard-header")) return;

    // Try multiple header selectors (ApplicationV2 vs legacy)
    const header = appEl.querySelector("header.window-header")
      || appEl.querySelector(".window-header")
      || appEl.querySelector("[class*='header']")
      || appEl.firstElementChild;
    if (!header) {
      console.warn(`${MODULE_ID} | Could not find dashboard header to inject icons`);
      return;
    }

    const pending = this._getXpPendingCount();
    const tierReady = this._getXpTierReadyCount();

    const headerHtml = document.createElement("div");
    headerHtml.className = "cgm-xp-dashboard-header";
    headerHtml.innerHTML = `
      <div class="cgm-xp-header-icon cgm-xp-header-undo ${this._xpHistoryIndex >= 0 ? '' : 'cgm-xp-disabled'}" title="Undo last action" data-action="undo">
        <i class="fas fa-rotate-left"></i>
        <span class="cgm-xp-header-label">Undo</span>
      </div>
      <div class="cgm-xp-header-icon cgm-xp-header-redo ${this._xpHistoryIndex < this._xpActionHistory.length - 1 ? '' : 'cgm-xp-disabled'}" title="Redo action" data-action="redo">
        <i class="fas fa-rotate-right"></i>
        <span class="cgm-xp-header-label">Redo</span>
      </div>
      <div class="cgm-xp-header-divider"></div>
      <div class="cgm-xp-header-icon cgm-xp-header-award" title="Award XP" data-action="awardXp">
        <i class="fas fa-gift"></i>
        <span class="cgm-xp-header-label">Award XP</span>
      </div>
      <div class="cgm-xp-header-icon cgm-xp-header-adjust" title="Adjust XP (+/-)" data-action="adjustXp">
        <i class="fas fa-sliders"></i>
        <span class="cgm-xp-header-label">Adjust</span>
      </div>
      <div class="cgm-xp-header-icon cgm-xp-header-pending" title="Pending requests" data-action="pendingRequests">
        <i class="fas fa-bell"></i>
        <span class="cgm-xp-header-label">Pending</span>
        <span class="cgm-xp-header-badge ${pending > 0 ? 'cgm-xp-badge-active' : ''}">${pending}</span>
      </div>
      <div class="cgm-xp-header-icon cgm-xp-header-tier" title="Tier ready" data-action="tierReady">
        <i class="fas fa-arrow-up"></i>
        <span class="cgm-xp-header-label">Tier Ready</span>
        <span class="cgm-xp-header-badge ${tierReady > 0 ? 'cgm-xp-badge-active' : ''}">${tierReady}</span>
      </div>
    `;

    // Try to insert after window title, or append to header
    const titleEl = header.querySelector(".window-title") || header.querySelector("h1") || header.querySelector("h2");
    if (titleEl && titleEl.nextSibling) {
      header.insertBefore(headerHtml, titleEl.nextSibling);
    } else {
      header.appendChild(headerHtml);
    }

    // Bind click handlers — use inline logic instead of cross-module imports
    headerHtml.querySelector("[data-action='undo']")?.addEventListener("click", async () => {
      await this._undoLastAction();
      this._updateUndoRedoState(headerHtml);
    });
    headerHtml.querySelector("[data-action='redo']")?.addEventListener("click", async () => {
      await this._redoLastAction();
      this._updateUndoRedoState(headerHtml);
    });
    headerHtml.querySelector("[data-action='awardXp']")?.addEventListener("click", async () => {
      await this._awardXpFlow();
      this._updateUndoRedoState(headerHtml);
    });
    headerHtml.querySelector("[data-action='adjustXp']")?.addEventListener("click", async () => {
      await this._adjustXpFlow();
    });
    headerHtml.querySelector("[data-action='pendingRequests']")?.addEventListener("click", async () => {
      try {
        const api = this._getXpApi();
        if (api?.openGmDashboard) api.openGmDashboard({ tab: "requests" });
        else ui.notifications.info("Pending requests clicked");
      } catch (e) {
        console.warn(`${MODULE_ID} | Could not open pending requests:`, e);
      }
    });
    headerHtml.querySelector("[data-action='tierReady']")?.addEventListener("click", async () => {
      try {
        const api = this._getXpApi();
        if (api?.openGmDashboard) api.openGmDashboard({ tab: "party" });
        else ui.notifications.info("Tier ready clicked");
      } catch (e) {
        console.warn(`${MODULE_ID} | Could not open tier ready:`, e);
      }
    });

    // Start periodic count updates
    this._startXpDashboardCountUpdates(appEl);

    // Inject actor icons into requests list and watch for re-renders
    this._injectXpRequestActorIcons(appEl);
    this._watchXpRequestsTab(appEl);

    // Inject History tab into the dashboard
    this._injectXpHistoryTab(appEl);
  }

  /** Get pending XP requests count using cypher-xp DevelopmentService */
  _getXpPendingCount() {
    try {
      const mod = game.modules.get("cypher-xp");
      if (!mod?.active) return 0;
      // Try to access DevelopmentService if already loaded
      const ds = mod.api?._developmentService || window.cypherXpDevelopmentService;
      if (ds?.getData) {
        return game.actors.filter(a => a.type === "pc" && a.hasPlayerOwner).reduce((sum, actor) => {
          const data = ds.getData(actor);
          return sum + (data.requests?.filter(r => r.status === "pending").length ?? 0);
        }, 0);
      }
    } catch (e) { /* fall through */ }
    // Fallback: read from actor flags directly (cypher-xp stores data at flag key "data")
    try {
      return game.actors.filter(a => a.type === "pc" && a.hasPlayerOwner).reduce((sum, actor) => {
        const data = actor.getFlag("cypher-xp", "data") || {};
        return sum + (data.requests?.filter(r => r.status === "pending").length ?? 0);
      }, 0);
    } catch { return 0; }
    return 0;
  }

  /** Get tier-ready count using cypher-xp DevelopmentService */
  _getXpTierReadyCount() {
    try {
      const mod = game.modules.get("cypher-xp");
      if (!mod?.active) return 0;
      const ds = mod.api?._developmentService || window.cypherXpDevelopmentService;
      if (ds?.getData && ds?.isTierReady) {
        return game.actors.filter(a => a.type === "pc" && a.hasPlayerOwner).reduce((sum, actor) => {
          const data = ds.getData(actor);
          const tier = Number(actor.system?.basic?.tier ?? 1);
          return sum + (ds.isTierReady(data, tier) ? 1 : 0);
        }, 0);
      }
    } catch (e) { /* fall through */ }
    // Fallback: basic tier readiness check (cypher-xp uses progress.lifetime)
    try {
      return game.actors.filter(a => a.type === "pc" && a.hasPlayerOwner).reduce((sum, actor) => {
        const data = actor.getFlag("cypher-xp", "data") || {};
        const tier = Number(actor.system?.basic?.tier ?? 1);
        const thresholds = { 1: 4, 2: 8, 3: 12, 4: 16, 5: 20 };
        const nextThreshold = thresholds[tier] ?? 999;
        const lifetime = data.progress?.lifetime ?? 0;
        return sum + (lifetime >= nextThreshold ? 1 : 0);
      }, 0);
    } catch { return 0; }
    return 0;
  }

  /** Start periodic updates for dashboard header counts */
  _startXpDashboardCountUpdates(appEl) {
    if (this._xpCountInterval) clearInterval(this._xpCountInterval);
    this._xpCountInterval = setInterval(() => {
      if (!document.body.contains(appEl)) {
        clearInterval(this._xpCountInterval);
        this._xpCountInterval = null;
        // Clean up position lock observer too
        appEl._cgmPositionLock?.disconnect();
        appEl._cgmRequestObserver?.disconnect();
        return;
      }
      const pending = this._getXpPendingCount();
      const tierReady = this._getXpTierReadyCount();

      const pendingBadge = appEl.querySelector(".cgm-xp-header-pending .cgm-xp-header-badge");
      if (pendingBadge) {
        pendingBadge.textContent = pending;
        pendingBadge.classList.toggle("cgm-xp-badge-active", pending > 0);
      }

      const tierBadge = appEl.querySelector(".cgm-xp-header-tier .cgm-xp-header-badge");
      if (tierBadge) {
        tierBadge.textContent = tierReady;
        tierBadge.classList.toggle("cgm-xp-badge-active", tierReady > 0);
      }
    }, 3000);
  }

  /** Inject actor portrait icons into the GM Dashboard requests list */
  _injectXpRequestActorIcons(appEl) {
    if (!appEl) return;
    const list = appEl.querySelector(".cxp-list");
    if (!list) return;

    for (const li of list.querySelectorAll("li")) {
      if (li.querySelector(".cgm-xp-request-actor")) continue; // Already injected
      if (li.classList.contains("cxp-empty")) continue;

      // Find actorId from approve/reject buttons
      const btn = li.querySelector("[data-actor-id]");
      const actorId = btn?.dataset?.actorId;
      if (!actorId) continue;

      const actor = game.actors.get(actorId);
      if (!actor) continue;

      const actorEl = document.createElement("span");
      actorEl.className = "cgm-xp-request-actor";
      actorEl.innerHTML = `
        <img src="${actor.img || "icons/svg/mystery-man.svg"}" alt="${actor.name}">
        <span>${actor.name}</span>
      `;

      const label = li.querySelector(".cxp-list-label");
      if (label) label.insertAdjacentElement("beforebegin", actorEl);
      else li.insertAdjacentElement("afterbegin", actorEl);
    }
  }

  /** Watch the GM Dashboard for tab changes and re-renders to re-inject actor icons */
  _watchXpRequestsTab(appEl) {
    if (!appEl) return;
    const observer = new MutationObserver(() => {
      // Re-inject header if it was destroyed by Foundry re-render
      if (!appEl.querySelector(".cgm-xp-dashboard-header")) {
        this._injectXpDashboardHeader(appEl);
      }
      // Re-inject history tab if it was destroyed by Foundry re-render
      if (!appEl.querySelector("[data-tab='history']")) {
        this._injectXpHistoryTab(appEl);
      }
      // If requests tab is visible, inject actor icons
      if (appEl.querySelector("[data-tab='requests']")?.classList.contains("active") ||
          appEl.querySelector(".cxp-list")) {
        this._injectXpRequestActorIcons(appEl);
      }
    });
    observer.observe(appEl, { childList: true, subtree: true });
    // Store observer on appEl so it can be cleaned up later
    appEl._cgmRequestObserver = observer;
  }

  /** Inject a History tab into the Cypher XP GM Dashboard */
  _injectXpHistoryTab(appEl) {
    if (!appEl) return;
    const tabsNav = appEl.querySelector(".cxp-tabs");
    if (!tabsNav) return;

    // Create the History tab link if missing
    let historyTab = tabsNav.querySelector("[data-tab='history']");
    if (!historyTab) {
      historyTab = document.createElement("a");
      historyTab.dataset.action = "changeTab";
      historyTab.dataset.tab = "history";
      historyTab.textContent = "History";
      historyTab.className = "";
      tabsNav.appendChild(historyTab);
    }

    // Create the history panel if missing (hidden by default)
    const tabContent = appEl.querySelector(".cxp-tab-content");
    if (tabContent) {
      let historyPanel = tabContent.querySelector(".cgm-xp-history-panel");
      if (!historyPanel) {
        historyPanel = document.createElement("div");
        historyPanel.className = "cgm-xp-history-panel";
        historyPanel.style.display = "none";
        tabContent.appendChild(historyPanel);
      }
    }

    // Attach click handler once only
    if (tabsNav._cgmHistoryClickAttached) return;
    tabsNav._cgmHistoryClickAttached = true;

    tabsNav.addEventListener("click", (e) => {
      const target = e.target.closest("[data-action='changeTab']");
      if (!target) return;
      const tab = target.dataset.tab;
      const historyPanel = appEl.querySelector(".cgm-xp-history-panel");
      if (!historyPanel) return;

      if (tab === "history") {
        e.preventDefault();
        e.stopPropagation();
        for (const a of tabsNav.querySelectorAll("a")) a.classList.remove("active");
        target.classList.add("active");
        for (const child of tabContent.children) {
          if (!child.classList.contains("cgm-xp-history-panel")) {
            child.style.display = "none";
          }
        }
        historyPanel.style.display = "block";
        this._renderXpHistoryPanel(historyPanel);
      } else {
        historyPanel.style.display = "none";
        for (const child of tabContent.children) {
          if (!child.classList.contains("cgm-xp-history-panel")) {
            child.style.display = "";
          }
        }
      }
    });
  }

  /** Render the history log into the history panel */
  _renderXpHistoryPanel(panel) {
    if (!panel) return;
    const entries = [...this._xpActionHistory].reverse(); // newest first
    if (!entries.length) {
      panel.innerHTML = `<div class="cgm-xp-history-empty">No actions recorded yet.</div>`;
      return;
    }

    const formatTime = (ts) => {
      const d = new Date(ts);
      return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
    };

    const getIcon = (type) => {
      switch (type) {
        case "awardXP": return "fa-gift";
        case "adjustXpUp": return "fa-arrow-up";
        case "adjustXpDown": return "fa-arrow-down";
        case "requestCreated": return "fa-file-circle-plus";
        case "requestApproved": return "fa-check";
        case "requestRejected": return "fa-xmark";
        case "tierBreakthrough": return "fa-arrow-up";
        case "purchaseApplied": return "fa-cart-shopping";
        default: return "fa-circle";
      }
    };

    const getLabel = (entry) => {
      switch (entry.type) {
        case "awardXP": return `Awarded <strong>${entry.amount} XP</strong> to ${entry.actorName}${entry.reason ? ` — "${entry.reason}"` : ""}`;
        case "adjustXpUp": return `Raised <strong>${entry.actorName}</strong> by <strong>+${entry.amount} XP</strong>${entry.reason ? ` — "${entry.reason}"` : ""}`;
        case "adjustXpDown": return `Lowered <strong>${entry.actorName}</strong> by <strong>-${entry.amount} XP</strong>${entry.reason ? ` — "${entry.reason}"` : ""}`;
        case "requestCreated": return `<strong>${entry.actorName}</strong> requested <strong>${entry.label}</strong> (${entry.requestedCost} XP)`;
        case "requestApproved": return `Approved <strong>${entry.label}</strong> for ${entry.actorName}`;
        case "requestRejected": return `Rejected <strong>${entry.label}</strong> for ${entry.actorName}`;
        case "tierBreakthrough": return `<strong>${entry.actorName}</strong> advanced from Tier ${entry.fromTier} → ${entry.toTier}`;
        case "purchaseApplied": return `<strong>${entry.actorName}</strong> purchased <strong>${entry.label}</strong> (${entry.cost} XP)`;
        default: return entry.label || "Unknown action";
      }
    };

    const html = entries.map((entry, i) => {
      const isUndone = entry.undone;
      const isCurrent = (this._xpActionHistory.length - 1 - i) === this._xpHistoryIndex;
      return `
        <div class="cgm-xp-history-item ${isUndone ? 'cgm-xp-history-undone' : ''} ${isCurrent ? 'cgm-xp-history-current' : ''}">
          <img src="${entry.actorImg || 'icons/svg/mystery-man.svg'}" alt="" class="cgm-xp-history-avatar">
          <div class="cgm-xp-history-body">
            <div class="cgm-xp-history-time">${formatTime(entry.timestamp)}</div>
            <div class="cgm-xp-history-text"><i class="fas ${getIcon(entry.type)}"></i> ${getLabel(entry)}</div>
          </div>
          ${isCurrent ? '<span class="cgm-xp-history-marker" title="Current position">●</span>' : ''}
        </div>
      `;
    }).join("");

    panel.innerHTML = `<div class="cgm-xp-history-list">${html}</div>`;
  }

  /** Inline award XP flow — replicates cypher-xp DevelopmentService.gmAward */
  async _awardXpFlow() {
    const actors = game.actors.filter(a => a.type === "pc" && a.hasPlayerOwner);
    if (!actors.length) return ui.notifications.warn("Cypher XP: no player-owned PCs found.");

    const options = actors.map(a => `<option value="${a.id}">${a.name}</option>`).join("");
    const actorId = await foundry.applications.api.DialogV2.prompt({
      window: { title: "Award XP — Choose Character" },
      content: `<label>Character: <select name="actorId">${options}</select></label>`,
      ok: { callback: (event, button, dialog) => dialog.element.querySelector("select[name='actorId']").value }
    }).catch(() => null);
    if (!actorId) return;

    const actor = game.actors.get(actorId);
    if (!actor) return;

    const result = await foundry.applications.api.DialogV2.prompt({
      window: { title: `Award XP: ${actor.name}` },
      content: `
        <label>Amount: <input type="number" name="amount" value="1" min="1" step="1"></label><br>
        <label>Reason: <input type="text" name="reason" placeholder="Discovery, GM award, etc."></label>`,
      ok: { callback: (event, button, dialog) => ({
        amount: Number(dialog.element.querySelector("input[name='amount']").value),
        reason: dialog.element.querySelector("input[name='reason']").value
      }) }
    }).catch(() => null);
    if (!result || !Number.isInteger(result.amount) || result.amount <= 0) return;

    try {
      // Try to dynamically import cypher-xp DevelopmentService
      let ds = null;
      try {
        const mod = await import("/modules/cypher-xp/scripts/development-service.js");
        ds = mod.DevelopmentService;
      } catch (e) {
        console.log(`${MODULE_ID} | Dynamic import of cypher-xp DevelopmentService failed, using fallback`);
      }

      if (ds?.gmAward) {
        await ds.gmAward(actor, result.amount, result.reason);
      } else {
        // Fallback: manually replicate gmAward logic
        // 1. Update actor's actual XP
        const currentXP = Number(actor.system?.basic?.xp ?? 0);
        await actor.update({ "system.basic.xp": currentXP + result.amount });

        // 2. Save transaction to cypher-xp flags
        const data = actor.getFlag("cypher-xp", "data") || {};
        if (!data.transactions) data.transactions = [];
        data.transactions.push({
          id: foundry.utils.randomID(),
          timestamp: Date.now(),
          type: "gm-award",
          label: result.reason || "GM Award",
          xpDelta: result.amount,
          progressDelta: 0,
          actorUuid: actor.uuid,
          source: "gm-manual",
          status: "applied",
          metadata: {}
        });
        await actor.setFlag("cypher-xp", "data", data);

        // Only push to history in fallback (hook handles it when ds.gmAward is used)
        this._pushXpHistory({
          type: "awardXP",
          actorId: actor.id,
          actorName: actor.name,
          actorImg: actor.img,
          amount: result.amount,
          reason: result.reason || "GM Award",
          timestamp: Date.now(),
          undone: false
        });
      }

      ui.notifications.info(`Cypher XP: awarded ${result.amount} XP to ${actor.name}.`);
    } catch (e) {
      console.warn(`${MODULE_ID} | Award XP failed:`, e);
      ui.notifications.error("Failed to award XP. See console for details.");
    }
  }

  /** Adjust XP flow — raise or lower any actor's XP directly */
  async _adjustXpFlow() {
    const actors = game.actors.filter(a => a.type === "pc" && a.hasPlayerOwner);
    if (!actors.length) return ui.notifications.warn("Cypher XP: no player-owned PCs found.");

    const options = actors.map(a => `<option value="${a.id}">${a.name} (current: ${a.system?.basic?.xp ?? 0} XP)</option>`).join("");
    const actorId = await foundry.applications.api.DialogV2.prompt({
      window: { title: "Adjust XP — Choose Character" },
      content: `<label>Character: <select name="actorId">${options}</select></label>`,
      ok: { callback: (event, button, dialog) => dialog.element.querySelector("select[name='actorId']").value }
    }).catch(() => null);
    if (!actorId) return;

    const actor = game.actors.get(actorId);
    if (!actor) return;
    const currentXP = Number(actor.system?.basic?.xp ?? 0);

    const result = await foundry.applications.api.DialogV2.prompt({
      window: { title: `Adjust XP: ${actor.name}` },
      content: `
        <p>Current XP: <strong>${currentXP}</strong></p>
        <label>Amount (+ to raise, – to lower): <input type="number" name="amount" value="0" step="1"></label><br>
        <label>Reason: <input type="text" name="reason" placeholder="Correction, mistake, etc."></label>`,
      ok: { callback: (event, button, dialog) => ({
        amount: Number(dialog.element.querySelector("input[name='amount']").value),
        reason: dialog.element.querySelector("input[name='reason']").value
      }) }
    }).catch(() => null);
    if (result === null || result.amount === 0 || !Number.isFinite(result.amount)) return;

    try {
      const newXP = Math.max(0, currentXP + result.amount);
      await actor.update({ "system.basic.xp": newXP });

      // Log to history
      const actionType = result.amount > 0 ? "adjustXpUp" : "adjustXpDown";
      this._pushXpHistory({
        type: actionType,
        actorId: actor.id,
        actorName: actor.name,
        actorImg: actor.img,
        amount: Math.abs(result.amount),
        delta: result.amount,
        reason: result.reason || "XP Adjustment",
        timestamp: Date.now(),
        undone: false
      });

      const direction = result.amount > 0 ? "raised" : "lowered";
      ui.notifications.info(`Cypher XP: ${direction} ${actor.name} by ${Math.abs(result.amount)} XP (now ${newXP}).`);
      this._refreshHistoryView();
    } catch (e) {
      console.warn(`${MODULE_ID} | Adjust XP failed:`, e);
      ui.notifications.error("Failed to adjust XP. See console for details.");
    }
  }

  /** Push an action to the undo history stack */
  _pushXpHistory(action) {
    // Remove any redo entries ahead of current index
    if (this._xpHistoryIndex < this._xpActionHistory.length - 1) {
      this._xpActionHistory = this._xpActionHistory.slice(0, this._xpHistoryIndex + 1);
    }
    this._xpActionHistory.push(action);
    if (this._xpActionHistory.length > this._xpMaxHistory) {
      this._xpActionHistory.shift();
      // Index stays same since we removed from front, but if it was -1 it becomes 0
      if (this._xpHistoryIndex < 0) this._xpHistoryIndex = 0;
    } else {
      this._xpHistoryIndex++;
    }
  }

  /** Update undo/redo button states in the dashboard header */
  _updateUndoRedoState(headerEl) {
    const undoBtn = headerEl.querySelector("[data-action='undo']");
    const redoBtn = headerEl.querySelector("[data-action='redo']");
    if (undoBtn) undoBtn.classList.toggle("cgm-xp-disabled", this._xpHistoryIndex < 0);
    if (redoBtn) redoBtn.classList.toggle("cgm-xp-disabled", this._xpHistoryIndex >= this._xpActionHistory.length - 1);
  }

  /** Undo the last action */
  async _undoLastAction() {
    if (this._xpHistoryIndex < 0) return ui.notifications.warn("Nothing to undo.");
    const action = this._xpActionHistory[this._xpHistoryIndex];
    this._xpHistoryIndex--;
    action.undone = true;

    try {
      if (action.type === "awardXP") {
        const actor = game.actors.get(action.actorId);
        if (!actor) throw new Error("Actor no longer found");

        // Subtract the awarded XP
        const currentXP = Number(actor.system?.basic?.xp ?? 0);
        const newXP = Math.max(0, currentXP - action.amount);
        await actor.update({ "system.basic.xp": newXP });

        // Remove the transaction from cypher-xp flags
        const data = actor.getFlag("cypher-xp", "data") || {};
        if (data.transactions) {
          const idx = data.transactions.findLastIndex(t =>
            t.type === "gm-award" && t.xpDelta === action.amount && t.label === action.reason
          );
          if (idx >= 0) data.transactions.splice(idx, 1);
        }
        await actor.setFlag("cypher-xp", "data", data);

        ui.notifications.info(`Undid: ${action.amount} XP award to ${action.actorName}.`);
      } else if (action.type === "adjustXpUp" || action.type === "adjustXpDown") {
        const actor = game.actors.get(action.actorId);
        if (!actor) throw new Error("Actor no longer found");

        // Reverse the adjustment (subtract what was added, add back what was removed)
        const currentXP = Number(actor.system?.basic?.xp ?? 0);
        const newXP = Math.max(0, currentXP - action.delta);
        await actor.update({ "system.basic.xp": newXP });

        const direction = action.type === "adjustXpUp" ? "raise" : "lowering";
        ui.notifications.info(`Undid: ${direction} ${action.actorName} by ${action.amount} XP.`);
      }
      this._refreshHistoryView();
    } catch (e) {
      console.warn(`${MODULE_ID} | Undo failed:`, e);
      ui.notifications.error("Undo failed. See console for details.");
      this._xpHistoryIndex++; // Roll back index since undo failed
      action.undone = false;
    }
  }

  /** Redo the last undone action */
  async _redoLastAction() {
    if (this._xpHistoryIndex >= this._xpActionHistory.length - 1) return ui.notifications.warn("Nothing to redo.");
    this._xpHistoryIndex++;
    const action = this._xpActionHistory[this._xpHistoryIndex];
    action.undone = false;

    try {
      if (action.type === "awardXP") {
        const actor = game.actors.get(action.actorId);
        if (!actor) throw new Error("Actor no longer found");

        // Re-add the XP
        const currentXP = Number(actor.system?.basic?.xp ?? 0);
        await actor.update({ "system.basic.xp": currentXP + action.amount });

        // Re-add the transaction
        const data = actor.getFlag("cypher-xp", "data") || {};
        if (!data.transactions) data.transactions = [];
        data.transactions.push({
          id: foundry.utils.randomID(),
          timestamp: Date.now(),
          type: "gm-award",
          label: action.reason,
          xpDelta: action.amount,
          progressDelta: 0,
          actorUuid: actor.uuid,
          source: "gm-manual",
          status: "applied",
          metadata: {}
        });
        await actor.setFlag("cypher-xp", "data", data);

        ui.notifications.info(`Redone: ${action.amount} XP award to ${action.actorName}.`);
      } else if (action.type === "adjustXpUp" || action.type === "adjustXpDown") {
        const actor = game.actors.get(action.actorId);
        if (!actor) throw new Error("Actor no longer found");

        // Re-apply the adjustment
        const currentXP = Number(actor.system?.basic?.xp ?? 0);
        const newXP = Math.max(0, currentXP + action.delta);
        await actor.update({ "system.basic.xp": newXP });

        const direction = action.type === "adjustXpUp" ? "raised" : "lowered";
        ui.notifications.info(`Redone: ${direction} ${action.actorName} by ${action.amount} XP.`);
      }
      this._refreshHistoryView();
    } catch (e) {
      console.warn(`${MODULE_ID} | Redo failed:`, e);
      ui.notifications.error("Redo failed. See console for details.");
      this._xpHistoryIndex--; // Roll back index since redo failed
      action.undone = true;
    }
  }

  _hideCypherXpLauncher() {
    const ids = ["cypher-xp-player-launcher", "cypher-development-track-player-launcher", "cypher-xp-gm-launcher-wrapper"];
    for (const id of ids) {
      const el = document.getElementById(id);
      if (el) {
        el.style.display = "none";
        el.style.visibility = "hidden";
        el.style.opacity = "0";
        el.style.pointerEvents = "none";
      }
    }
  }

  _flashXpButton(type = "default") {
    const btn = this.element?.querySelector(".cgm-xp-btn");
    if (!btn) return;
    // Remove any existing flash classes first
    btn.classList.remove("cgm-xp-flash", "cgm-xp-flash-pending", "cgm-xp-flash-tier");
    // Add appropriate flash class
    if (type === "pending") btn.classList.add("cgm-xp-flash-pending");
    else if (type === "tier") btn.classList.add("cgm-xp-flash-tier");
    else btn.classList.add("cgm-xp-flash");
    // Clear any existing timer
    if (this._xpFlashTimer) clearTimeout(this._xpFlashTimer);
    // For default (player request), auto-remove after 3s
    if (type === "default") {
      this._xpFlashTimer = setTimeout(() => btn.classList.remove("cgm-xp-flash"), 3000);
    }
  }

  /** Start periodic check for pending requests / tier-ready and flash button accordingly */
  _startXpButtonStatusCheck() {
    if (this._xpButtonStatusInterval) clearInterval(this._xpButtonStatusInterval);
    this._xpButtonStatusInterval = setInterval(() => {
      if (!this.element) return;
      const pending = this._getXpPendingCount();
      const tierReady = this._getXpTierReadyCount();
      const btn = this.element.querySelector(".cgm-xp-btn");
      if (!btn) return;
      // Priority: pending (yellow) > tier ready (blue)
      if (pending > 0) {
        if (!btn.classList.contains("cgm-xp-flash-pending")) {
          this._flashXpButton("pending");
        }
      } else if (tierReady > 0) {
        if (!btn.classList.contains("cgm-xp-flash-tier")) {
          this._flashXpButton("tier");
        }
      } else {
        // No alerts — remove persistent flash classes (keep transient cgm-xp-flash)
        btn.classList.remove("cgm-xp-flash-pending", "cgm-xp-flash-tier");
      }
    }, 4000);
  }

  /* ─── XP Spend Approval (GM side) ─── */
  async _doXpSpend(actor, spendType, label) {
    let api = this._getXpApi();
    for (let i = 0; i < 50 && !api; i++) {
      await new Promise(r => setTimeout(r, 100));
      api = this._getXpApi();
    }
    if (!api) {
      ui.notifications.warn("Cypher XP API is not ready yet. Please try again.");
      return;
    }
    try {
      await api.logSpend(actor, {
        spendType,
        amount: 1,
        note: label
      });
      ui.notifications.info(`Spent 1 XP on ${label}.`);
    } catch (err) {
      console.error(`${MODULE_ID} | XP spend failed:`, err);
      ui.notifications.error("Failed to spend XP.");
    }
  }

  async _openGMXpSpendRequest(payload) {
    if (!game.user?.isGM) return;

    // Try world actor first, then token actor
    let actor = game.actors?.get(payload.actorId);
    if (!actor) {
      const token = canvas?.tokens?.placeables?.find(t => t.actor?.id === payload.actorId);
      actor = token?.actor;
    }

    const spendIcons = {
      reroll: "fa-dice",
      "player-intrusion": "fa-hand-sparkles",
      insight: "fa-lightbulb",
      "temporary-benefit": "fa-clock",
      other: "fa-circle"
    };
    const iconClass = spendIcons[payload.spendType] || "fa-star";

    const result = await new Promise((resolve) => {
      new Dialog({
        title: "XP Spend Request",
        content: `
          <div style="padding:16px;text-align:center;">
            <div style="font-size:2em;color:#ffd700;margin-bottom:8px;"><i class="fas ${iconClass}"></i></div>
            <div style="font-size:1.1em;font-weight:700;margin-bottom:4px;">${foundry.utils.escapeHTML(payload.userName)} wants to spend XP</div>
            <div style="color:#c8a96e;margin-bottom:2px;">Character: <strong>${foundry.utils.escapeHTML(payload.actorName)}</strong></div>
            <div style="color:#f0d68a;margin-bottom:2px;">Action: <strong>${foundry.utils.escapeHTML(payload.label)}</strong></div>
            <div style="color:#ffd700;margin-bottom:8px;">Cost: <strong>${payload.xpCost} XP</strong></div>
            <div style="font-size:0.85em;color:#7a7a7a;">Approve to deduct XP and log the spend.</div>
          </div>`,
        buttons: {
          approve: {
            icon: '<i class="fas fa-check"></i>',
            label: "Allow",
            callback: () => resolve("approve")
          },
          deny: {
            icon: '<i class="fas fa-times"></i>',
            label: "Deny",
            callback: () => resolve("deny")
          }
        },
        default: "approve"
      }).render(true);
    });

    if (result === "approve") {
      if (!actor) {
        ui.notifications.warn(`Cannot approve XP spend: actor "${payload.actorName}" not found.`);
        // Still notify player of failure
        game.socket.emit("module.cypher-taskbar", {
          type: "xpSpendDenied",
          requestId: payload.requestId,
          targetUserId: payload.userId,
          actorName: payload.actorName,
          label: payload.label,
          spendType: payload.spendType
        });
        return;
      }
      await this._doXpSpend(actor, payload.spendType, payload.label);
      // Notify player
      const approvalPayload = {
        type: "xpSpendApproved",
        requestId: payload.requestId,
        targetUserId: payload.userId,
        actorName: payload.actorName,
        label: payload.label,
        spendType: payload.spendType
      };
      if (payload.rollData) approvalPayload.rollData = payload.rollData;
      console.log(`[CGM] Sending xpSpendApproved:`, approvalPayload);
      game.socket.emit("module.cypher-taskbar", approvalPayload);
    } else {
      // Notify player of denial
      game.socket.emit("module.cypher-taskbar", {
        type: "xpSpendDenied",
        requestId: payload.requestId,
        targetUserId: payload.userId,
        actorName: payload.actorName,
        label: payload.label,
        spendType: payload.spendType
      });
    }
  }

  /* Load saved panel positions from synced settings (with localStorage fallback for migration) */
  _loadPanelPositions() {
    try {
      // Try synced settings first
      const synced = this._gs("panelPositions", null);
      if (synced) {
        this._notesPanelPos = synced.notes || null;
        this._targetPanelPos = synced.target || null;
        this._damagePanelPos = synced.damage || null;
        this._cashValuesPanelPos = synced.cashValues || null;
        this._assetsPanelPos = synced.assets || null;
        this._itemsPanelPos = synced.items || null;
        this._itemsPanelSize = synced.itemsSize || null;
        this._recoveryPanelPos = synced.recovery || null;
        this._cyphersPanelPos = synced.cyphers || null;
        this._subMenuPositions = synced.subMenus || {};
        return;
      }
    } catch {}

    // Fallback: localStorage (for migration from old versions)
    try {
      const data = JSON.parse(localStorage.getItem("cgm-panel-positions") || "{}");
      this._notesPanelPos = data.notes || null;
      this._targetPanelPos = data.target || null;
      this._damagePanelPos = data.damage || null;
      this._cashValuesPanelPos = data.cashValues || null;
      this._assetsPanelPos = data.assets || null;
      this._itemsPanelPos = data.items || null;
      this._itemsPanelSize = data.itemsSize || null;
      this._recoveryPanelPos = data.recovery || null;
      this._cyphersPanelPos = data.cyphers || null;
      this._subMenuPositions = data.subMenus || {};
    } catch {}
  }

  /* Save panel positions to synced settings */
  async _savePanelPositions() {
    try {
      const data = {
        notes: this._notesPanelPos,
        target: this._targetPanelPos,
        damage: this._damagePanelPos,
        cashValues: this._cashValuesPanelPos,
        assets: this._assetsPanelPos,
        items: this._itemsPanelPos,
        itemsSize: this._itemsPanelSize,
        recovery: this._recoveryPanelPos,
        cyphers: this._cyphersPanelPos,
        subMenus: this._subMenuPositions,
      };
      await this._ss("panelPositions", data);
    } catch {}
  }

  /* Clamp a panel position to keep it fully on-screen */
  _clampPanelPos(left, top, panelW, panelH) {
    const maxLeft = Math.max(0, window.innerWidth - panelW);
    const maxTop = Math.max(0, window.innerHeight - panelH);
    return {
      left: Math.max(0, Math.min(left, maxLeft)),
      top: Math.max(0, Math.min(top, maxTop)),
    };
  }

  _gs(key, fallback = null) {
    try {
      // Use per-user synced settings (world scope, keyed by user ID)
      const userData = foundry.utils.deepClone(game.settings.get(MODULE_ID, "userSettings") || {});
      const userId = game.user?.id || "default";
      if (userData[userId] && key in userData[userId]) return foundry.utils.deepClone(userData[userId][key]);
      // Fallback: try old client-scoped setting for migration
      try { return foundry.utils.deepClone(game.settings.get(MODULE_ID, key)); } catch {}
      return fallback;
    } catch { return fallback; }
  }

  async _ss(key, value) {
    try {
      const userId = game.user?.id || "default";
      const userData = foundry.utils.deepClone(game.settings.get(MODULE_ID, "userSettings") || {});
      if (!userData[userId]) userData[userId] = {};
      userData[userId][key] = foundry.utils.deepClone(value);
      await game.settings.set(MODULE_ID, "userSettings", userData);
    } catch (e) { console.warn(`${MODULE_ID} | Failed to save setting "${key}":`, e); }
  }

  /* Migrate old client-scoped settings to per-user synced settings */
  async _migrateSettings() {
    const userId = game.user?.id || "default";
    const userData = game.settings.get(MODULE_ID, "userSettings") || {};
    if (userData[userId]?._migrated) return; // Already migrated

    const oldKeys = [
      "dock", "opacity", "compact", "locked", "portraitPosition", "portraitSize",
      "portraitObjectFit", "portraitNameAbove", "portraitBarOffset", "portraitBarWidth",
      "portraitBorderColor", "portraitBorderWidth", "portraitShape", "portraitNameSize",
      "portraitNameColor", "portraitNameOffset", "portraitBgColor", "portraitBgOpacity", "portraitBgShape",
      "xpCircleSize", "xpCircleOffsetX",
      "xpCircleOffsetY", "radialMenuSize", "radialMenuOffset", "sectionWidth", "sectionBgColor",
      "sectionBgOpacity", "sectionPosition", "section2Width", "section2BgColor",
      "section2BgOpacity", "section2Position", "section3Width", "section3BgColor",
      "section3BgOpacity", "section3Position", "sectionsUnlocked", "buttonLayout",
      "globalDifficulty", "portraitVisibilityMode", "notes", "sectionLabelSize", "sectionLabelColor", "sectionLabelOffset", "sectionNames",
      "section1LabelColor", "section2LabelColor", "section3LabelColor"
    ];

    let migrated = false;
    for (const key of oldKeys) {
      try {
        const oldVal = game.settings.get(MODULE_ID, key);
        if (oldVal !== undefined && oldVal !== null) {
          if (!userData[userId]) userData[userId] = {};
          userData[userId][key] = oldVal;
          migrated = true;
        }
      } catch { /* old setting didn't exist */ }
    }

    if (migrated) {
      userData[userId]._migrated = true;
      await game.settings.set(MODULE_ID, "userSettings", userData);
      console.log(`${MODULE_ID} | Migrated client settings to per-user synced settings for user ${userId}`);
    }
  }

  _loadSettings() {
    this._dock = this._gs("dock", "bottom");
    this._opacity = this._gs("opacity", 100);
    this._compact = this._gs("compact", false);
    this._notes = this._gs("notes", "");
    this._globalDifficulty = this._gs("globalDifficulty", 4);
    // Sync GM Taskbar global difficulty to direct setting and Cypher System's rollDifficulty on load
    try { game.settings.set(MODULE_ID, "globalDifficulty", this._globalDifficulty); } catch (e) {}
    if (game.settings.settings.has("cyphersystem.rollDifficulty")) {
      game.settings.set("cyphersystem", "rollDifficulty", this._globalDifficulty);
    }
    this._locked = this._gs("locked", true);
    this._portraitPosition = this._gs("portraitPosition", "left");
    this._portraitSize = this._gs("portraitSize", 48);
    this._portraitObjectFit = this._gs("portraitObjectFit", "cover");
    this._portraitNameAbove = this._gs("portraitNameAbove", false);
    this._portraitBarOffset = this._gs("portraitBarOffset", 0);
    this._portraitBarWidth = this._gs("portraitBarWidth", 48);
    this._portraitBorderColor = this._gs("portraitBorderColor", "");
    this._portraitBorderWidth = this._gs("portraitBorderWidth", 3);
    this._portraitShape = this._gs("portraitShape", "circle");
    this._portraitNameSize = this._gs("portraitNameSize", 12);
    this._portraitNameColor = this._gs("portraitNameColor", "");
    this._portraitNameOffset = this._gs("portraitNameOffset", 0);
    this._portraitBgColor = this._gs("portraitBgColor", "#000000");
    this._portraitBgOpacity = this._gs("portraitBgOpacity", 30);
    this._portraitBgShape = this._gs("portraitBgShape", "trapezoid");
    this._xpCircleSize = this._gs("xpCircleSize", 16);
    this._xpCircleOffsetX = this._gs("xpCircleOffsetX", 0);
    this._xpCircleOffsetY = this._gs("xpCircleOffsetY", 4);
    this._radialMenuSize = this._gs("radialMenuSize", 200);
    this._radialMenuOffset = this._gs("radialMenuOffset", 20);
    // Load SECTION 1 settings
    this._sections[0].width = this._gs("sectionWidth", 10);
    this._sections[0].bgColor = this._gs("sectionBgColor", "#ffffff");
    this._sections[0].bgOpacity = this._gs("sectionBgOpacity", 30);
    this._sections[0].position = this._gs("sectionPosition", 0);
    // Load SECTION 2 settings
    this._sections[1].width = this._gs("section2Width", 10);
    this._sections[1].bgColor = this._gs("section2BgColor", "#ffffff");
    this._sections[1].bgOpacity = this._gs("section2BgOpacity", 30);
    this._sections[1].position = this._gs("section2Position", 0);
    // Load SECTION 3 settings
    this._sections[2].width = this._gs("section3Width", 10);
    this._sections[2].bgColor = this._gs("section3BgColor", "#ffffff");
    this._sections[2].bgOpacity = this._gs("section3BgOpacity", 30);
    this._sections[2].position = this._gs("section3Position", 0);
    // Load SECTION 4 (Tray) settings
    this._sections[3].width = this._gs("section4Width", 15);
    this._sections[3].bgColor = this._gs("section4BgColor", "#1a1020");
    this._sections[3].bgOpacity = this._gs("section4BgOpacity", 50);
    this._sections[3].position = this._gs("section4Position", 0);
    // Load section label settings
    this._sectionLabelSize = this._gs("sectionLabelSize", 10);
    this._sectionLabelColor = this._gs("sectionLabelColor", "#c8a96e");
    this._sectionLabelOffset = this._gs("sectionLabelOffset", -8);
    // Load individual section label colors (fallback to global)
    this._sections[0].labelColor = this._gs("section1LabelColor", "");
    this._sections[1].labelColor = this._gs("section2LabelColor", "");
    this._sections[2].labelColor = this._gs("section3LabelColor", "");
    this._sections[3].labelColor = this._gs("section4LabelColor", "");
    // Load section names (custom labels)
    this._sectionNames = this._gs("sectionNames", ["SECTION 1", "SECTION 2", "SECTION 3", "TRAY"]);
    if (!Array.isArray(this._sectionNames) || this._sectionNames.length < 4) {
      this._sectionNames = ["SECTION 1", "SECTION 2", "SECTION 3", "TRAY"];
    }
    // Apply custom names to section objects
    this._sections.forEach((sec, i) => { sec.name = this._sectionNames[i] || sec.name; });
    // Load unlock setting
    this._sectionsUnlocked = this._gs("sectionsUnlocked", false);
    // Load button layout config — ensure it's always an object so
    // _getButtonLayout() never falls back to defaultSection values
    this._buttonLayout = this._gs("buttonLayout", null) || {};
    this._settingsTab = "general";
  }

  /* ─── Render ─── */

  render() {
    document.querySelector(`#${MODULE_ID}-bar`)?.remove();
    document.querySelector(`.cgm-panel`)?.remove();
    document.querySelector(`.cgm-portraits-bg-wrap`)?.remove();
    if (this._connInterval) clearInterval(this._connInterval);
    if (this._playerMonitorInterval) clearInterval(this._playerMonitorInterval);
    if (this._autoHideTimer) clearTimeout(this._autoHideTimer);
    if (this._trayInterval) clearInterval(this._trayInterval);
    if (this._xpCountInterval) clearInterval(this._xpCountInterval);
    if (this._xpButtonStatusInterval) clearInterval(this._xpButtonStatusInterval);
    if (this._tooltipTimer) clearTimeout(this._tooltipTimer);
    if (this._effectTooltipTimer) clearTimeout(this._effectTooltipTimer);
    // Clear party data cache on full re-render
    this._partyDataCache = null;
    this._partyDataCacheTime = 0;

    const bar = document.createElement("div");
    bar.id = `${MODULE_ID}-bar`;
    bar.classList.add("cgm-taskbar");
    bar.classList.add(this._dock === "top" ? "cgm-pos-top" : "cgm-pos-bottom");
    if (!this._locked) bar.classList.add("cgm-autohide");
    bar.innerHTML = this._buildHTML();
    document.body.appendChild(bar);
    this.element = bar;

    // Hide Cypher XP floating launcher when integrated with taskbar
    this._hideCypherXpLauncher();

    // Create portrait background panel as separate element (behind bar)
    this._createPortraitBg();

    this._applySettings();
    this._bindEvents();
    this._setupSectionDragAndDrop();
    this._restoreButtonOrder();   // restore saved button order within sections
    this._bindPortraitEvents();
    this._startConnectionMonitor();
    this._startPlayerMonitor();
    this._setupAutoHide();
    this._startTray();              // start minimized window tray
    this._startXpButtonStatusCheck(); // flash button on pending/tier-ready

    // Sync portrait background width to match float (after DOM is ready)
    this._syncPortraitBgWidth();

    // Discover buttons injected by other modules
    // Clear stale references before re-discovering
    this._dynamicButtons = [];

    // Phase 1: Immediate — catch already-injected buttons
    this._discoverDynamicButtons();

    // Phase 2: After external modules inject (in their requestAnimationFrame),
    // discover again and move buttons to correct positions per saved layout
    setTimeout(() => {
      this._discoverDynamicButtons();
      this._correctDynamicButtonPositions();
      this._restoreButtonOrder();
    }, 100);

    if (this.activePanel) this._openPanel(this.activePanel);
  }

  /* Update global difficulty box display without full re-render */
  _updateDifficultyBox() {
    if (!this.element) return;
    const box = this.element.querySelector('.cgm-difficulty-box');
    if (!box) return;
    const input = box.querySelector('.cgm-diff-input');
    const tnEl = box.querySelector('.cgm-diff-tn');
    if (input) input.value = this._globalDifficulty;
    if (tnEl) tnEl.textContent = 'TN ' + (this._globalDifficulty * 3);
    box.title = 'Global Difficulty (TN ' + (this._globalDifficulty * 3) + ')';
  }

  /* ─── Button Definitions ─── */
  _getButtonDefs() {
    const staticBtns = [
      { id: "gmroll", action: "openGMGroupRoll", icon: "fa-dice-d20", color: "#d94040", title: "GM Group Roll Request", defaultSection: 0 },
      { id: "groupstatus", action: "openGroupStatuses", icon: "fa-droplet", color: "#9b59b6", title: "Group Statuses", defaultSection: 0 },
      { id: "quickscene", action: "openQuickScene", icon: "fa-dice-d20", color: "", title: "Quick Scene", defaultSection: 0 },
      { id: "cypherlog", action: "openCypherLog", icon: "fa-book-open", color: "", title: "Cypher Log", defaultSection: 1, requiresModule: "cypher-log" },
      { id: "scene", action: "openSceneControl", icon: "fa-map", color: "", title: "Scene Control", defaultSection: 1 },
      { id: "npc", action: "openNPCCanvas", icon: "fa-users", color: "", title: "NPC Canvas", defaultSection: 1 },
      { id: "enemy", action: "openEnemyCanvas", icon: "fa-tooth", color: "#cc3333", title: "Enemy Canvas", defaultSection: 1 },
      { id: "items", action: "openItemsCanvas", icon: "fa-hammer", color: "", title: "Items", defaultSection: 1 },
      { id: "reputation", action: "openReputation", icon: "fa-handshake", color: "#e8a87c", title: "Reputation and gossips", defaultSection: 1 },
      { id: "connections", action: "openConnections", icon: "fa-project-diagram", color: "#c9a227", title: "Connections", defaultSection: 1, requiresModule: "cypher-connections" },
      { id: "recovery", action: "openRecoveryMenu", icon: "fa-droplet", color: "#3b82f6", title: "Recovery", defaultSection: 0 },
    ];
    // Merge with dynamically discovered buttons (injected by other modules)
    return [...staticBtns, ...this._dynamicButtons];
  }

  /* ─── Generate a stable ID for an injected button ─── */
  _getStableButtonId(btn) {
    // Already has an ID — use it
    if (btn.dataset.btnId) return btn.dataset.btnId;

    // Use data-action (most stable — Name Generator uses this)
    const action = btn.dataset.action;
    if (action) return action;

    // Generate from title (Cypher Log, etc.)
    const title = btn.title || btn.textContent?.trim() || '';
    if (title) {
      const slug = title.toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');
      if (slug) return `injected-${slug}`;
    }

    // Last resort: index-based (not stable across renders)
    return null;
  }

  /* ─── Discover buttons injected by other modules ─── */
  _discoverDynamicButtons() {
    const bar = document.querySelector(`#${MODULE_ID}-bar`);
    if (!bar) return;

    // Only skip our built-in static buttons — injected buttons must be re-discovered
    // after every render since their DOM elements (and event listeners) are destroyed
    const staticIds = new Set(["gmroll", "groupstatus", "quickscene", "cypherlog", "scene", "npc", "items"]);
    const dynamic = [];
    const sections = bar.querySelectorAll('.cgm-custom-section');

    bar.querySelectorAll('.cgm-section-btn').forEach((btn, idx) => {
      let btnId = btn.dataset.btnId;
      // If button has no ID, generate a stable one from its attributes
      if (!btnId) {
        const idFromClass = [...btn.classList].find(c => c.startsWith('cgm-section-btn-') && c !== 'cgm-section-btn');
        btnId = idFromClass?.replace('cgm-section-btn-', '') || this._getStableButtonId(btn) || `injected-${idx}`;
        btn.dataset.btnId = btnId; // Assign it so we can track it
      }
      // Skip only our built-in static buttons (injected ones must be re-discovered)
      if (staticIds.has(btnId)) return;

      const iconEl = btn.querySelector('i');
      const iconClass = iconEl ? [...iconEl.classList].find(c => c.startsWith('fa-')) : 'fa-circle';
      const action = btn.dataset.action || '';
      const title = btn.title || btn.textContent?.trim() || 'Unknown';
      const sectionEl = btn.closest('.cgm-custom-section');
      let sectionIdx = 1;
      if (sectionEl) {
        sectionIdx = [...sections].indexOf(sectionEl);
        if (sectionIdx < 0) sectionIdx = 1;
      }

      // ALWAYS track the button so _getButtonDefs() can find it later
      // (even if drag handlers were already set up by _setupSectionDragAndDrop)
      dynamic.push({
        id: btnId,
        action: action,
        icon: iconClass,
        color: "",
        title: title,
        defaultSection: sectionIdx,
        isDynamic: true
      });

      // Only add event listeners if not already set up
      // (_setupSectionDragAndDrop may have already handled this button)
      if (this._sectionsUnlocked && btn.dataset.cgmDragSetup !== "true") {
        btn.draggable = true;
        btn.classList.add('cgm-section-btn-unlocked');
        btn.addEventListener('contextmenu', (e) => {
          e.preventDefault();
          e.stopPropagation();
          this._showIconCustomizer(btnId);
        });
        btn.addEventListener('dragstart', (e) => {
          e.dataTransfer.setData('text/plain', btnId);
          e.dataTransfer.effectAllowed = 'move';
          btn.classList.add('cgm-dragging');
        });
        btn.addEventListener('dragend', () => {
          btn.classList.remove('cgm-dragging');
          sections.forEach(sec => sec.classList.remove('cgm-drag-over'));
        });
        btn.dataset.cgmDragSetup = "true";
      }
    });

    this._dynamicButtons = dynamic;
  }

  /* ─── Move injected buttons to their correct sections per saved layout ─── */
  _correctDynamicButtonPositions() {
    const bar = document.querySelector(`#${MODULE_ID}-bar`);
    if (!bar) return;

    const layout = this._getButtonLayout();
    const sections = bar.querySelectorAll('.cgm-custom-section');

    // For each dynamic button with a saved position, ensure it's in the right section
    this._dynamicButtons.forEach(btnDef => {
      const cfg = layout[btnDef.id];
      if (!cfg) return;

      const targetSection = cfg.section ?? btnDef.defaultSection;
      const btnEl = bar.querySelector(`.cgm-section-btn[data-btn-id="${btnDef.id}"]`);
      if (!btnEl) return;

      const currentSection = btnEl.closest('.cgm-custom-section');
      const currentIdx = currentSection ? [...sections].indexOf(currentSection) : -1;

      // If button is in the wrong section, move it
      if (currentIdx !== targetSection && sections[targetSection]) {
        const targetContent = sections[targetSection].querySelector('.cgm-section-buttons');
        if (targetContent) {
          targetContent.appendChild(btnEl);
        }
      }
    });
  }

  /* ─── Get button layout (section assignment) ─── */
  _getButtonLayout() {
    // Always merge saved data with current button definitions
    // This ensures newly active modules (cypher-log, etc.) get entries
    const layout = {};
    this._getButtonDefs().forEach(btn => {
      const saved = this._buttonLayout?.[btn.id] || {};
      layout[btn.id] = {
        section: saved.section ?? btn.defaultSection,
        size: saved.size ?? 16,
        color: saved.color ?? btn.color ?? "",
        hidden: saved.hidden ?? false
      };
    });
    return layout;
  }

  /* ─── Build buttons HTML for a section ─── */
  _buildSectionButtonsHTML(sectionIndex) {
    const layout = this._getButtonLayout();
    const buttons = this._getButtonDefs().filter(btn => {
      if (btn.requiresModule && !game.modules?.get(btn.requiresModule)?.active) return false;
      // Skip dynamically injected buttons — external modules render those themselves
      if (btn.isDynamic) return false;
      const cfg = layout[btn.id];
      // hidden = not shown; null/undefined = use default
      if (cfg && cfg.hidden === true) return false;
      const sec = cfg?.section ?? btn.defaultSection;
      return sec === sectionIndex;
    });

    if (!buttons.length) return "";

    return buttons.map(btn => {
      const cfg = layout[btn.id] || {};
      const size = cfg.size || 16;
      const color = cfg.color || btn.color || "";
      const colorStyle = color ? `color:${color};` : "";
      const sizeStyle = `font-size:${size}px;`;
      const draggable = this._sectionsUnlocked ? 'draggable="true"' : '';
      const unlockClass = this._sectionsUnlocked ? 'cgm-section-btn-unlocked' : '';
      return `
        <button class="cgm-section-btn cgm-section-btn-${btn.id} ${unlockClass}" data-action="${btn.action}" title="${btn.title}" data-btn-id="${btn.id}" ${draggable}>
          <i class="fas ${btn.icon}" style="${sizeStyle}${colorStyle}"></i>
        </button>
      `;
    }).join("");
  }

  /* ─── HTML Builder ─── */

  _buildHTML() {
    const connStatus = this._getConnectionStatus();
    const lockIcon = this._locked ? "fa-lock" : "fa-lock-open";
    const lockTitle = this._locked ? "Taskbar locked (visible)" : "Taskbar unlocked (auto-hide)";
    const gd = this._globalDifficulty;
    const tn = gd * 3;
    const secHTML = this._buildSectionHTML(0, this._buildSectionButtonsHTML(0));
    const sec2HTML = this._buildSectionHTML(1, this._buildSectionButtonsHTML(1));
    const sec3HTML = this._buildSectionHTML(2, this._buildSectionButtonsHTML(2));
    const sec4HTML = this._buildSectionHTML(3, this._buildTrayHTML());

    return `
      <!-- Floating player portraits above bar -->
      ${this._buildPortraitsFloat()}

      <div class="cgm-inner">
        <!-- Left side: GM Brand + Global Difficulty Box -->
        <button class="cgm-brand" data-action="openGMMenu" title="GM Menu"><i class="fas fa-dungeon"></i> GM</button>

        <!-- Cypher XP button (always shown, checks on click) -->
        <button class="cgm-icon-btn cgm-xp-btn" id="cgm-btn-xp" title="Cypher XP">
          <i class="fas fa-star" style="color:#ffd700;"></i>
        </button>

        <!-- Global Difficulty Box -->
        <div class="cgm-difficulty-box" title="Global Difficulty (TN ${tn})">
          <button class="cgm-diff-btn cgm-diff-minus" data-action="globalDiffDown" title="Lower difficulty">
            <i class="fas fa-minus"></i>
          </button>
          <div class="cgm-diff-display">
            <input type="number" class="cgm-diff-input" value="${gd}" min="0" max="15" data-action="globalDiffInput" title="Enter difficulty 0-15">
            <div class="cgm-diff-tn">TN ${tn}</div>
          </div>
          <button class="cgm-diff-btn cgm-diff-plus" data-action="globalDiffUp" title="Raise difficulty">
            <i class="fas fa-plus"></i>
          </button>
          <button class="cgm-diff-btn cgm-diff-reset" data-action="globalDiffReset" title="Reset to default (4)">
            <i class="fas fa-rotate-left"></i>
          </button>
          <button class="cgm-diff-btn cgm-diff-reset-all" data-action="globalDiffResetAll" title="Reset ALL individual difficulties">
            <i class="fas fa-users-slash"></i>
          </button>
        </div>

        <!-- Eye icon: Actor visibility toggle -->
        <div class="cgm-eye-wrap">
          <button class="cgm-icon-btn cgm-eye-btn ${this._portraitVisibilityMode === 'hide' ? 'cgm-eye-hidden' : this._portraitVisibilityMode === 'active' ? 'cgm-eye-active' : ''}" data-action="toggleActorVisibility" title="Actor visibility">
            <i class="fas ${this._portraitVisibilityMode === 'hide' ? 'fa-eye-slash' : 'fa-eye'}"></i>
          </button>
          <div class="cgm-eye-menu">
            <div class="cgm-eye-menu-item ${this._portraitVisibilityMode === 'active' ? 'cgm-eye-menu-active' : ''}" data-action="setActorVisibility" data-mode="active">
              <i class="fas fa-user-check"></i> SHOW ONLY ACTIVE ACTORS
            </div>
            <div class="cgm-eye-menu-item ${this._portraitVisibilityMode === 'all' ? 'cgm-eye-menu-active' : ''}" data-action="setActorVisibility" data-mode="all">
              <i class="fas fa-users"></i> SHOW ALL ACTORS
            </div>
            <div class="cgm-eye-menu-item ${this._portraitVisibilityMode === 'hide' ? 'cgm-eye-menu-active' : ''}" data-action="setActorVisibility" data-mode="hide">
              <i class="fas fa-user-slash"></i> HIDE ALL ACTORS
            </div>
          </div>
        </div>

        <!-- Cypher Connections button (shown only when module is active) -->
        ${game.modules?.get("cypher-connections")?.active ? `
        <div class="cgm-connections-wrap">
          <button class="cgm-icon-btn cgm-connections-btn" data-action="openConnections" title="Connections">
            <i class="fas fa-project-diagram" style="color:#c9a227;"></i>
          </button>
        </div>
        ` : ""}

        <!-- SECTION 1 -->
        ${secHTML}

        <!-- SECTION 2 -->
        ${sec2HTML}

        <!-- SECTION 3 -->
        ${sec3HTML}

        <!-- SECTION 4: Tray -->
        ${sec4HTML}

        <div class="cgm-spacer"></div>

        <!-- Right side section -->
        <div class="cgm-section-right">
          <div class="cgm-controls-right">
            <!-- Lock toggle -->
            <button class="cgm-icon-btn cgm-lock-btn ${this._locked ? 'cgm-lock-locked' : 'cgm-lock-unlocked'}"
                    data-action="toggleLock" title="${lockTitle}">
              <i class="fas ${lockIcon}"></i>
            </button>
            <!-- Settings button -->
            <button class="cgm-icon-btn ${this.activePanel === 'settings' ? 'cgm-active' : ''}"
                    data-panel="settings" title="Settings">
              <i class="fas fa-cog"></i>
            </button>
            <!-- Connection indicator -->
            <div class="cgm-conn-indicator ${connStatus.cls}" title="${connStatus.title}">
              <i class="fas fa-lightbulb"></i>
            </div>
          </div>
        </div>
      </div>
      <!-- Panel anchors for right-aligned panels -->
      <div class="cgm-panel-anchor cgm-panel-anchor-settings" id="cgm-panel-anchor-settings"></div>
      <div class="cgm-panel-anchor cgm-panel-anchor-center" id="cgm-panel-anchor-center"></div>
    `;
  }

  /* ─── Section HTML Builder ─── */
  _buildSectionHTML(index, extraButtons = "") {
    const sec = this._sections[index];
    if (!sec) return "";
    const rgb = this._hexToRgb(sec.bgColor);
    const bgStyle = rgb ? `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${sec.bgOpacity / 100})` : `rgba(255,255,255,${sec.bgOpacity / 100})`;
    const posOffset = sec.position ?? 0;
    const posStyle = posOffset > 0 ? `margin-left: ${posOffset}px;` : "";
    const labelSize = this._sectionLabelSize || 10;
    const labelColor = sec.labelColor || this._sectionLabelColor || "#c8a96e";
    const labelOffset = this._sectionLabelOffset ?? -8;
    const isTray = index === 3;
    return `
      <div class="cgm-custom-section${isTray ? ' cgm-tray-section' : ''}" title="${sec.name}" style="width: ${sec.width}%; background: ${bgStyle}; ${posStyle}">
        <div class="cgm-section-label-badge" style="font-size:${labelSize}px;color:${labelColor};top:${labelOffset}px;">${sec.name}</div>
        ${!isTray ? '<div class="cgm-section-separator cgm-sep-left"></div>' : ''}
        <div class="cgm-section-content">
          <div class="cgm-section-buttons">
            ${extraButtons}
          </div>
        </div>
        ${!isTray ? '<div class="cgm-section-separator cgm-sep-right"></div>' : ''}
      </div>
    `;
  }

  _hexToRgb(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16)
    } : null;
  }

  /* ─── Hidden Icons HTML for Settings ─── */
  _buildHiddenIconsHTML() {
    const layout = this._getButtonLayout();
    const hiddenButtons = this._getButtonDefs().filter(btn => {
      if (btn.requiresModule && !game.modules?.get(btn.requiresModule)?.active) return false;
      return layout[btn.id]?.hidden === true;
    });

    if (!hiddenButtons.length) return "";

    const items = hiddenButtons.map(btn => `
      <div class="cgm-hidden-icon-row">
        <span class="cgm-hidden-icon-name"><i class="fas ${btn.icon}"></i> ${btn.title}</span>
        <button class="cgm-btn cgm-btn-small" data-action="unhideIcon" data-btn-id="${btn.id}">
          <i class="fas fa-eye"></i> Unhide
        </button>
      </div>
    `).join("");

    return `
      <div class="cgm-setting-section-title">HIDDEN ICONS</div>
      <div class="cgm-hidden-icons-list">
        ${items}
      </div>
    `;
  }

  /* Sync portrait background width to match float content */
  _syncPortraitBgWidth() {
    if (!this.element) return;
    const float = this.element.querySelector('.cgm-portraits-float');
    const bgWrap = document.querySelector('.cgm-portraits-bg-wrap');
    if (float && bgWrap) {
      bgWrap.style.width = float.offsetWidth + 'px';
    }
  }

  /* ─── Portrait Background Panel (separate element behind bar) ─── */
  _createPortraitBg() {
    const pcs = this._getPartyData();
    if (!pcs.length) return;
    if (this._portraitVisibilityMode === "hide") return;

    const posCls = `cgm-portraits-${this._portraitPosition}`;
    const wrap = document.createElement('div');
    wrap.className = `cgm-portraits-bg-wrap ${posCls}`;
    wrap.dataset.dock = this._dock;

    const bg = document.createElement('div');
    bg.className = `cgm-portraits-bg cgm-portraits-bg-${this._portraitBgShape}`;
    bg.dataset.bgShape = this._portraitBgShape;
    bg.style.backgroundColor = this._portraitBgColor;
    bg.style.opacity = this._portraitBgOpacity / 100;

    wrap.appendChild(bg);
    document.body.appendChild(wrap);

    // Sync width after portraits render
    this._syncPortraitBgWidth();
  }

  /* ─── Floating Portraits (above bar, left side) ─── */

  _buildPortraitsFloat() {
    let pcs = this._getPartyData();
    if (!pcs.length) return ``;

    // Filter based on visibility mode
    if (this._portraitVisibilityMode === "hide") {
      return ``;
    } else if (this._portraitVisibilityMode === "active") {
      // Get all actors owned by currently connected (active) players
      const activeUsers = game.users?.filter(u => u.active && !u.isGM) || [];
      const activeActorIds = new Set();
      activeUsers.forEach(user => {
        if (user.character?.id) activeActorIds.add(user.character.id);
        game.actors?.forEach(actor => {
          if (actor.hasPlayerOwner && actor.testUserPermission(user, "OWNER")) {
            activeActorIds.add(actor.id);
          }
        });
      });
      // Include disconnected actors (they show red)
      const disconnectedIds = this._disconnectedActors || new Set();
      pcs = pcs.filter(pc => activeActorIds.has(pc.id) || disconnectedIds.has(pc.id));
      if (!pcs.length) return ``;
    }

    const size = this._portraitSize;
    const fit = this._portraitObjectFit;
    const nameAbove = this._portraitNameAbove;
    const borderColor = this._portraitBorderColor;
    const borderWidth = this._portraitBorderWidth;
    const shape = this._portraitShape;
    const barOffset = this._portraitBarOffset;
    const barWidth = this._portraitBarWidth;
    const nameSize = this._portraitNameSize;
    const nameColor = this._portraitNameColor;
    const nameOffset = this._portraitNameOffset;
    const xpSize = this._xpCircleSize;
    const xpOffsetX = this._xpCircleOffsetX;
    const xpOffsetY = this._xpCircleOffsetY;
    const shapeCls = `cgm-shape-${shape}`;
    const nColor = nameColor || "var(--cgm-text)";

    const posCls = `cgm-portraits-${this._portraitPosition}`;

    return `
      <div class="cgm-portraits-float ${posCls}">
        ${pcs.map(pc => {
          const dmgColor = this._getDamageTrackColor(pc.damageTrack);
          const bColor = borderColor || dmgColor;
          const xpCircle = this._buildXPCircle(pc.xp, xpSize);
          const recoveryDrops = this._buildRecoveryDrops(pc.recoveryRolls);
          const actor = game.actors.get(pc.id);
          const individualDiff = actor?.getFlag("cypher-gm-taskbar", "targetDifficulty") ?? 0;
          const isDisconnected = this._disconnectedActors?.has(pc.id);
          return `
          <div class="cgm-portrait-wrap ${nameAbove ? 'cgm-portrait-name-above' : ''} ${isDisconnected ? 'cgm-portrait-disconnected' : ''}" data-actor-id="${pc.id}">
            <div class="cgm-portrait-difficulty ${individualDiff > 0 ? 'cgm-difficulty-active' : ''}">${individualDiff > 0 ? individualDiff : ''}</div>
            ${isDisconnected ? '<div class="cgm-offline-badge"><i class="fas fa-wifi-slash"></i></div>' : ''}
            <div class="cgm-portrait-visual">
              ${this._buildEffectIconsHTML(pc, size)}
              <div class="cgm-portrait-img-wrap ${shapeCls}" style="width:${size}px;height:${size}px;">
                <img src="${pc.img}" alt="${pc.name}" class="cgm-portrait-img"
                     style="border-color: ${bColor}; border-width: ${borderWidth}px; object-fit: ${fit};">
                <div class="cgm-portrait-damage cgm-damage-${pc.damageTrack.toLowerCase()}"></div>
              </div>
            </div>
            <div class="cgm-portrait-info">
              <div class="cgm-portrait-name" style="font-size:${nameSize}px;color:${nColor};margin-left:${nameOffset}px;">${pc.name}</div>
              <div class="cgm-portrait-pools" style="margin-left:${barOffset}px;width:${barWidth}px;">
                <div class="cgm-portrait-pool-bar"><div class="cgm-portrait-pool-fill cgm-pool-might" style="width:${pc.pools.might.percent}%"></div></div>
                <div class="cgm-portrait-pool-bar"><div class="cgm-portrait-pool-fill cgm-pool-speed" style="width:${pc.pools.speed.percent}%"></div></div>
                <div class="cgm-portrait-pool-bar"><div class="cgm-portrait-pool-fill cgm-pool-intellect" style="width:${pc.pools.intellect.percent}%"></div></div>
              </div>
              <div class="cgm-xp-wrap" style="margin-left:${xpOffsetX}px;margin-top:${xpOffsetY}px;">${xpCircle}</div>
              <div class="cgm-recovery-wrap">${recoveryDrops}</div>
            </div>
          </div>`;
        }).join("")}
      </div>
    `;
  }

  /**
   * Build HTML for active effect icons displayed above the portrait.
   * Shows up to 5 tiny icons; remaining count badge if more exist.
   */
  _buildEffectIconsHTML(pc, portraitSize) {
    const effects = pc.activeEffects || [];
    if (!effects.length) return '';

    const maxVisible = 5;
    const visible = effects.slice(0, maxVisible);
    const remaining = effects.length - maxVisible;

    // Scale icon size with portrait size (clamped 12-20px)
    const iconSize = Math.max(12, Math.min(20, Math.round(portraitSize * 0.28)));

    return `
      <div class="cgm-portrait-effects" data-actor-id="${pc.id}">
        ${visible.map(eff => `
          <div class="cgm-effect-icon"
               data-effect-id="${eff.id}"
               style="width:${iconSize}px;height:${iconSize}px;">
            <img src="${eff.icon}" alt="${eff.name}"
                 style="width:100%;height:100%;object-fit:cover;border-radius:3px;">
            ${eff.isTemporary ? '<span class="cgm-effect-temp-badge"></span>' : ''}
          </div>
        `).join('')}
        ${remaining > 0 ? `<div class="cgm-effect-more">+${remaining}</div>` : ''}
      </div>
    `;
  }

  /* ─── Actor Notes (stored on actor flags — visible to all users) ─── */

  _getActorNotes(actorOrId, includeArchived = false) {
    const actor = typeof actorOrId === "string" ? game.actors.get(actorOrId) : actorOrId;
    if (!actor) return [];
    const notes = actor.getFlag("cypher-gm-taskbar", "actorNotes") || [];
    if (includeArchived) return notes;
    return notes.filter(n => !n.archived);
  }

  async _addActorNote(actorId, noteText) {
    const actor = game.actors.get(actorId);
    if (!actor || !noteText?.trim()) return;
    const notes = this._getActorNotes(actor, true);
    notes.push({
      id: foundry.utils.randomID(8),
      text: noteText.trim(),
      time: new Date().toLocaleTimeString(),
      date: new Date().toLocaleDateString(),
      timestamp: Date.now(),
      archived: false
    });
    await actor.setFlag("cypher-gm-taskbar", "actorNotes", notes);
    console.log(`${MODULE_ID} | Note added for ${actor.name}:`, noteText.trim());
  }

  async _deleteActorNote(actorId, noteId) {
    const actor = game.actors.get(actorId);
    if (!actor) return;
    let notes = this._getActorNotes(actor, true);
    notes = notes.filter(n => n.id !== noteId);
    await actor.setFlag("cypher-gm-taskbar", "actorNotes", notes);
    console.log(`${MODULE_ID} | Note deleted for ${actor.name}:`, noteId);
  }

  async _archiveActorNote(actorId, noteId) {
    const actor = game.actors.get(actorId);
    if (!actor) return;
    const notes = this._getActorNotes(actor, true);
    const note = notes.find(n => n.id === noteId);
    if (note) {
      note.archived = true;
      await actor.setFlag("cypher-gm-taskbar", "actorNotes", notes);
      console.log(`${MODULE_ID} | Note archived for ${actor.name}:`, noteId);
    }
  }

  _escapeHTML(str) {
    if (!str) return "";
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  _getDamageTrackColor(track) {
    const colors = { hale: "#40b060", impaired: "#d9a028", debilitated: "#d94040" };
    return colors[track.toLowerCase()] || colors.hale;
  }

  _buildXPCircle(xp, size) {
    // Determine color category
    let color;
    if (xp <= 0) color = "#555555";
    else if (xp <= 3) color = "#d9a028";
    else if (xp <= 8) color = "#40b060";
    else color = "#d94040";

    const filled = Math.min(Math.max(0, xp), 10);
    const cx = size / 2;
    const cy = size / 2;
    const r = (size / 2) - 1;
    const segments = 10;
    const angleStep = 360 / segments;
    const gap = 4; // gap between segments in degrees

    const polarToCart = (angle, radius) => {
      const rad = (angle - 90) * Math.PI / 180;
      return { x: cx + radius * Math.cos(rad), y: cy + radius * Math.sin(rad) };
    };

    let paths = "";
    for (let i = 0; i < segments; i++) {
      const startAngle = i * angleStep + gap / 2;
      const endAngle = (i + 1) * angleStep - gap / 2;
      const isFilled = i < filled;
      const segColor = isFilled ? color : "#333333";

      const p1 = polarToCart(startAngle, 2);
      const p2 = polarToCart(startAngle, r);
      const p3 = polarToCart(endAngle, r);
      const p4 = polarToCart(endAngle, 2);

      const d = `M ${p1.x},${p1.y} L ${p2.x},${p2.y} A ${r},${r} 0 0,1 ${p3.x},${p3.y} L ${p4.x},${p4.y} A 2,2 0 0,0 ${p1.x},${p1.y} Z`;
      paths += `    <path d="${d}" fill="${segColor}" />\n`;
    }

    return `
      <svg class="cgm-xp-circle" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}">
${paths}  </svg>
    `;
  }

  /* ─── Recovery Drops — display only, below XP circle ── */
  _buildRecoveryDrops(recoveryRolls) {
    const rollArr = Array.isArray(recoveryRolls) ? recoveryRolls.slice(0, 4) : [true, true, true, true];
    const defs = [
      { label: "Recovery 1 — 1 Action" },
      { label: "Recovery 2 — 10 Minutes" },
      { label: "Recovery 3 — 1 Hour" },
      { label: "Recovery 4 — 10 Hours" }
    ];
    const drops = rollArr.map((available, idx) => {
      const isAvailable = available === true || Number(available) > 0;
      return `<span class="cgm-recovery-drop${isAvailable ? '' : ' spent'}" title="${defs[idx].label}"><i class="fas fa-tint"></i></span>`;
    }).join("");
    return `<div class="cgm-recovery-bar">${drops}</div>`;
  }

  /* ─── Radial Menu ─── */

  _pieWedgePath(startAngle, endAngle, innerR, outerR) {
    const toRad = (a) => (a - 90) * Math.PI / 180;
    const sa = toRad(startAngle);
    const ea = toRad(endAngle);
    const x1 = Math.cos(sa) * outerR;
    const y1 = Math.sin(sa) * outerR;
    const x2 = Math.cos(ea) * outerR;
    const y2 = Math.sin(ea) * outerR;
    const x3 = Math.cos(ea) * innerR;
    const y3 = Math.sin(ea) * innerR;
    const x4 = Math.cos(sa) * innerR;
    const y4 = Math.sin(sa) * innerR;
    const largeArc = (endAngle - startAngle) > 180 ? 1 : 0;
    return `M ${x1.toFixed(2)} ${y1.toFixed(2)} A ${outerR} ${outerR} 0 ${largeArc} 1 ${x2.toFixed(2)} ${y2.toFixed(2)} L ${x3.toFixed(2)} ${y3.toFixed(2)} A ${innerR} ${innerR} 0 ${largeArc} 0 ${x4.toFixed(2)} ${y4.toFixed(2)} Z`;
  }

  _showRadialMenu(actorId, wrapEl) {
    this._hideRadialMenu();
    this._hideNotesTooltip();

    const actor = game.actors.get(actorId);
    const name = actor?.name || "Character";
    const size = this._radialMenuSize;
    const offset = this._radialMenuOffset;
    const segCount = 9;
    const gap = 2;
    const outerR = size / 2 - 6;
    const innerR = outerR * 0.38;
    const half = size / 2;

    const segments = [
      { action: "notes",      icon: "fa-sticky-note", label: "Notes", isNotes: true },
      { action: "target",     icon: "fa-crosshairs",  label: "Target", isTarget: true },
      { action: "callforroll",icon: "fa-dice-d20",    label: "Call Roll", isCallForRoll: true },
      { action: "values",     icon: "fa-coins",       label: "Values", isValues: true },
      { action: "recovery",   icon: "fa-bed",         label: "Rest", isRecovery: true },
      { action: "cyphers",    icon: "fa-flask",       label: "Cyphers", isCyphers: true },
      { action: "pools",      icon: "fa-water",       label: "Pools", isPools: true },
      { action: "status",     icon: "fa-heart-pulse", label: "Status", isStatus: true },
      { action: "intrusion",  icon: "fa-bolt",        label: "Intrusion", isIntrusion: true },
    ];

    // Build SVG paths centered at (0,0) — viewBox will be centered
    let svgPaths = "";
    segments.forEach((seg, i) => {
      const startAngle = i * (360 / segCount) + gap / 2;
      const endAngle = (i + 1) * (360 / segCount) - gap / 2;
      const d = this._pieWedgePath(startAngle, endAngle, innerR, outerR);
      let specialClass = "";
      if (seg.isIntrusion) specialClass = "cgm-pie-seg-intrusion";
      else if (seg.isPools) specialClass = "cgm-pie-seg-pools";
      else if (seg.isStatus) specialClass = "cgm-pie-seg-status";
      else if (seg.isNotes) specialClass = "cgm-pie-seg-notes";
      else if (seg.isTarget) specialClass = "cgm-pie-seg-target";
      else if (seg.isValues) specialClass = "cgm-pie-seg-values";
      else if (seg.isRecovery) specialClass = "cgm-pie-seg-recovery";
      else if (seg.isCyphers) specialClass = "cgm-pie-seg-cyphers";
      else if (seg.isCallForRoll) specialClass = "cgm-pie-seg-callforroll";
      svgPaths += `<path class="cgm-pie-seg ${specialClass}" data-action="${seg.action}" data-actor-id="${actorId}" d="${d}" />`;
    });

    // Build labels positioned within the menu (0..size coordinate space)
    let labelsHtml = "";
    segments.forEach((seg, i) => {
      const midAngle = (i * (360 / segCount) + ((i + 1) * (360 / segCount))) / 2;
      const rad = (midAngle - 90) * Math.PI / 180;
      const labelR = (innerR + outerR) / 2;
      const lx = Math.cos(rad) * labelR + half;
      const ly = Math.sin(rad) * labelR + half;
      let specialLabelClass = "";
      if (seg.isIntrusion) specialLabelClass = "cgm-pie-label-intrusion";
      else if (seg.isPools) specialLabelClass = "cgm-pie-label-pools";
      else if (seg.isStatus) specialLabelClass = "cgm-pie-label-status";
      else if (seg.isNotes) specialLabelClass = "cgm-pie-label-notes";
      else if (seg.isTarget) specialLabelClass = "cgm-pie-label-target";
      else if (seg.isValues) specialLabelClass = "cgm-pie-label-values";
      else if (seg.isRecovery) specialLabelClass = "cgm-pie-label-recovery";
      else if (seg.isCyphers) specialLabelClass = "cgm-pie-label-cyphers";
      labelsHtml += `
        <div class="cgm-pie-label ${specialLabelClass}" data-action="${seg.action}" data-actor-id="${actorId}"
             style="left:${lx.toFixed(1)}px;top:${ly.toFixed(1)}px;">
          <i class="fas ${seg.icon}"></i>
          <span>${seg.label}</span>
        </div>
      `;
    });

    const menu = document.createElement("div");
    menu.className = "cgm-radial-menu";
    menu.style.width = `${size}px`;
    menu.style.height = `${size}px`;

    // Position menu — detect edge and open AWAY from closest border
    const rect = wrapEl.getBoundingClientRect();
    if (!rect || rect.width === 0 || rect.height === 0) {
      console.warn("Cypher GM Taskbar: portrait rect is empty");
      return;
    }
    const portraitCx = rect.left + rect.width / 2;
    const portraitCy = rect.top + rect.height / 2;

    // Calculate available space in each direction
    const spaceAbove = portraitCy - size / 2;
    const spaceBelow = window.innerHeight - portraitCy - size / 2;
    const spaceLeft = portraitCx - size / 2;
    const spaceRight = window.innerWidth - portraitCx - size / 2;

    // Choose vertical position: prefer opening away from nearest edge
    let menuLeft = portraitCx - size / 2;
    let menuTop;
    if (spaceAbove >= size + offset && spaceAbove >= spaceBelow) {
      // Enough space above AND more space above → open above
      menuTop = rect.top - size - offset;
    } else if (spaceBelow >= size + offset) {
      // More space below → open below
      menuTop = rect.bottom + offset;
    } else if (spaceAbove >= size + offset) {
      // Fallback: open above
      menuTop = rect.top - size - offset;
    } else {
      // Neither direction has enough space — center vertically on screen
      menuTop = (window.innerHeight - size) / 2;
    }

    // Clamp to viewport bounds
    menuLeft = Math.max(8, Math.min(menuLeft, window.innerWidth - size - 8));
    menuTop = Math.max(8, Math.min(menuTop, window.innerHeight - size - 8));

    menu.style.left = `${menuLeft}px`;
    menu.style.top = `${menuTop}px`;

    // SVG viewBox centered at (0,0) so negative path coords are visible
    menu.innerHTML = `
      <svg class="cgm-pie-svg" viewBox="-${half} -${half} ${size} ${size}" width="${size}" height="${size}">
        <defs>
          <radialGradient id="cgm-pie-bg" cx="0" cy="0" r="${outerR}">
            <stop offset="0%" stop-color="rgba(20,22,35,0.3)" />
            <stop offset="100%" stop-color="rgba(15,17,30,0.95)" />
          </radialGradient>
          <linearGradient id="cgm-callroll-grad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#1a1a1a" />
            <stop offset="50%" stop-color="#4a0000" />
            <stop offset="100%" stop-color="#cc0000" />
          </linearGradient>
        </defs>
        <circle cx="0" cy="0" r="${outerR}" fill="url(#cgm-pie-bg)" stroke="rgba(200,169,110,0.15)" stroke-width="1" />
        ${svgPaths}
        <circle cx="0" cy="0" r="${innerR - 2}" fill="rgba(15,17,30,0.98)" stroke="rgba(200,169,110,0.3)" stroke-width="1.5" />
      </svg>
      ${labelsHtml}
      <img class="cgm-pie-portrait" src="${actor?.img || 'icons/svg/mystery-man.svg'}" alt="">
    `;

    document.body.appendChild(menu);
    this._radialMenuEl = menu;

    requestAnimationFrame(() => menu.classList.add("cgm-radial-visible"));

    // Click handlers
    const onSegClick = (e) => {
      e.stopPropagation();
      const action = e.currentTarget.dataset.action;
      const id = e.currentTarget.dataset.actorId;
      if (action === "pools") {
        this._showPoolsRadialMenu(id, wrapEl);
      } else if (action === "status") {
        this._showStatusRadialMenu(id, wrapEl);
      } else if (action === "notes") {
        this._showNotesSubMenu(id, wrapEl);
      } else if (action === "target") {
        this._showTargetSubMenu(id, wrapEl);
      } else if (action === "values") {
        this._showValuesSubMenu(id, wrapEl);
      } else if (action === "recovery") {
        this._showRecoverySubMenu(id, wrapEl);
      } else if (action === "cyphers") {
        this._showCyphersSubMenu(id, wrapEl);
      } else if (action === "callforroll") {
        this._showCallForRollSubMenu(id, wrapEl);
      } else {
        this._hideRadialMenu();
        if (action === "intrusion") {
          const a = game.actors.get(id);
          if (a) {
            // Send intrusion request to player via socket (not chat)
            const owners = game.users.filter(u => !u.isGM && a.testUserPermission(u, "OWNER"));
            if (owners.length === 0) {
              ui.notifications.warn(`${a.name} has no player owner online.`);
              return;
            }
            for (const user of owners) {
              game.socket.emit("module.cypher-gm-taskbar", {
                action: "requestIntrusion",
                userId: user.id,
                actorId: a.id,
                actorUuid: a.uuid
              });
            }
            ui.notifications.info(`Intrusion request sent to ${a.name}'s player.`);
          }
        }
      }
    };
    menu.querySelectorAll(".cgm-pie-seg, .cgm-pie-label").forEach(el => {
      el.addEventListener("click", onSegClick);
    });

    // Hover sync: highlight label when hovering SVG path
    menu.querySelectorAll(".cgm-pie-seg").forEach(seg => {
      const action = seg.dataset.action;
      const label = menu.querySelector(`.cgm-pie-label[data-action="${action}"]`);
      seg.addEventListener("mouseenter", () => label?.classList.add("cgm-pie-label-active"));
      seg.addEventListener("mouseleave", () => label?.classList.remove("cgm-pie-label-active"));
    });
    // Also sync hover from label to path
    menu.querySelectorAll(".cgm-pie-label").forEach(lbl => {
      const action = lbl.dataset.action;
      const seg = menu.querySelector(`.cgm-pie-seg[data-action="${action}"]`);
      lbl.addEventListener("mouseenter", () => seg?.classList.add("cgm-pie-seg-hover"));
      lbl.addEventListener("mouseleave", () => seg?.classList.remove("cgm-pie-seg-hover"));
    });

    const closeHandler = (e) => {
      // Don't close if clicking on any connected panel or their lines
      const panels = document.querySelectorAll(".cgm-connected-panel, .cgm-status-line-container, .cgm-pools-submenu");
      for (const p of panels) {
        if (p.contains(e.target)) return;
      }
      if (!menu.contains(e.target) && !e.target.closest('.dialog, .window-app, .application, .file-picker')) {
        this._hideRadialMenu();
        document.removeEventListener("click", closeHandler);
      }
    };
    setTimeout(() => document.addEventListener("click", closeHandler), 10);
  }

  _hideRadialMenu() {
    if (this._radialMenuEl) {
      this._radialMenuEl.remove();
      this._radialMenuEl = null;
    }
    this._hidePoolsMenu();
    this._hideStatusMenu();
    this._hideDfredsEffectsPicker();
    this._hideNotesSubMenu();
    this._hideTargetSubMenu();
    this._hideValuesSubMenu();
    this._hideRecoverySubMenu();
    this._hideCyphersSubMenu();
    this._hideCallForRollSubMenu();
    this._hideCallForRollSkillSubMenu();
    this._hideCallForRollFrequentSubMenu();
    this._hideGMGroupRollMenu();
    this._hideGMMenu();
    this._hideGMGroupRollAttributes();
    this._hideGMGroupRollSkills();
    this._hideGMGroupRollFree();
    this._hideGMGroupRollDefense();
    this._groupStatuses.hide();
  }

  /* ─── GM Menu (Windows-style) ─── */
  _getGMMenuDocs() {
    try {
      const raw = game.settings.get(MODULE_ID, "gmMenuDocs");
      return JSON.parse(raw || "{}");
    } catch {
      return { shared: [], gm: [], notes: [] };
    }
  }

  async _saveGMMenuDocs(data) {
    await game.settings.set(MODULE_ID, "gmMenuDocs", JSON.stringify(data));
  }

  async _addDocToMenu(section, uuid) {
    const docs = this._getGMMenuDocs();
    if (!docs[section]) docs[section] = [];
    if (!docs[section].includes(uuid)) {
      docs[section].push(uuid);
      await this._saveGMMenuDocs(docs);
    }
    this._renderGMMenuContent();
  }

  async _removeDocFromMenu(section, uuid) {
    const docs = this._getGMMenuDocs();
    if (!docs[section]) return;
    docs[section] = docs[section].filter(u => u !== uuid);
    await this._saveGMMenuDocs(docs);
    this._renderGMMenuContent();
  }

  _getJournalByUuid(uuid) {
    try {
      return fromUuidSync(uuid);
    } catch {
      return null;
    }
  }

  _renderGMMenuContent() {
    const menu = this._gmMenuEl;
    if (!menu) return;
    const docs = this._getGMMenuDocs();
    const sections = [
      { id: "shared", label: "SHARED", icon: "fa-book-open", color: "#4ade80" },
      { id: "gm", label: "GM", icon: "fa-book", color: "#f87171" },
      { id: "notes", label: "Notes", icon: "fa-note-sticky", color: "#fbbf24" },
    ];

    sections.forEach(sec => {
      const listEl = menu.querySelector(`.cgm-gm-menu-list[data-section="${sec.id}"]`);
      if (!listEl) return;
      const uuids = docs[sec.id] || [];
      const items = uuids.map(uuid => {
        const doc = this._getJournalByUuid(uuid);
        if (!doc) return null;
        return { uuid, name: doc.name, img: doc.img || "icons/svg/book.svg" };
      }).filter(Boolean);

      if (items.length === 0) {
        listEl.innerHTML = `<div class="cgm-gm-menu-empty">Drop journals here</div>`;
      } else {
        listEl.innerHTML = items.map(item => `
          <div class="cgm-gm-menu-item" data-uuid="${item.uuid}" draggable="true">
            <img src="${item.img}" alt="">
            <span>${foundry.utils.escapeHTML(item.name)}</span>
            <button class="cgm-gm-menu-item-remove" data-uuid="${item.uuid}" title="Remove"><i class="fas fa-times"></i></button>
          </div>
        `).join("");
      }

      // Re-bind drag events
      listEl.querySelectorAll(".cgm-gm-menu-item").forEach(item => {
        item.addEventListener("dragstart", (e) => {
          e.dataTransfer.setData("text/plain", item.dataset.uuid);
          e.dataTransfer.effectAllowed = "move";
          item.classList.add("cgm-gm-menu-item-dragging");
        });
        item.addEventListener("dragend", () => {
          item.classList.remove("cgm-gm-menu-item-dragging");
        });
      });

      // Re-bind remove buttons
      listEl.querySelectorAll(".cgm-gm-menu-item-remove").forEach(btn => {
        btn.addEventListener("click", async (e) => {
          e.stopPropagation();
          await this._removeDocFromMenu(sec.id, btn.dataset.uuid);
        });
      });

      // Re-bind click to open
      listEl.querySelectorAll(".cgm-gm-menu-item").forEach(item => {
        item.addEventListener("click", () => {
          const doc = this._getJournalByUuid(item.dataset.uuid);
          if (doc) doc.sheet.render(true);
        });
      });
    });
  }

  _showGMMenu(btnEl) {
    this._hideGMMenu();

    const menuWidth = 400;
    const offset = 4;
    const lockSheets = game.settings.get(MODULE_ID, "lockActorSheets");

    const sections = [
      { id: "shared", label: "SHARED", icon: "fa-book-open", color: "#4ade80" },
      { id: "gm", label: "GM", icon: "fa-book", color: "#f87171" },
      { id: "notes", label: "Notes", icon: "fa-note-sticky", color: "#fbbf24" },
    ];

    // Vertical action buttons — lock icon reflects CURRENT state
    const vButtons = [
      { action: "toggleLockSheets", icon: lockSheets ? "fa-lock" : "fa-unlock", title: lockSheets ? "Unlock actor sheets for players" : "Lock actor sheets for players", color: "#e74c3c" },
      { action: "awardXp", icon: "fa-star", title: "Award XP", color: "#ffd700" },
      { action: "toggleCombat", icon: "fa-swords", title: "Toggle combat", color: "#3498db" },
      { action: "togglePause", icon: game.paused ? "fa-play" : "fa-pause", title: game.paused ? "Unpause game" : "Pause game", color: "#9b59b6" },
      { action: "endTurn", icon: "fa-forward-step", title: "End turn", color: "#1abc9c" },
    ];

    const menu = document.createElement("div");
    menu.className = "cgm-gm-winmenu";
    menu.style.width = `${menuWidth}px`;
    menu.style.minHeight = `420px`;
    // No fixed max-height — grows with content

    // Build sections HTML
    const sectionsHtml = sections.map(sec => `
      <div class="cgm-gm-menu-section" data-section="${sec.id}">
        <div class="cgm-gm-menu-section-header" style="--sec-color:${sec.color}">
          <i class="fas ${sec.icon}"></i>
          <span>${sec.label}</span>
        </div>
        <div class="cgm-gm-menu-list" data-section="${sec.id}">
          <div class="cgm-gm-menu-empty">Drop journals here</div>
        </div>
      </div>
    `).join("");

    const vButtonsHtml = vButtons.map((btn, i) => `
      <button class="cgm-gm-winmenu-vbtn" data-action="${btn.action}" title="${btn.title}" style="--vbtn-color:${btn.color};--vbtn-delay:${i * 40}ms;">
        <i class="fas ${btn.icon}"></i>
      </button>
    `).join("");

    menu.innerHTML = `
      <div class="cgm-gm-winmenu-header">
        <i class="fas fa-dungeon"></i>
        <span>GM MENU</span>
      </div>
      <div class="cgm-gm-winmenu-body">
        ${sectionsHtml}
      </div>
      <div class="cgm-gm-winmenu-vbtns">${vButtonsHtml}</div>
    `;

    document.body.appendChild(menu);
    this._gmMenuEl = menu;

    // Position AFTER append so we can measure actual rendered height
    // Bottom-left corner of menu sits just above the GM button
    const rect = btnEl.getBoundingClientRect();
    requestAnimationFrame(() => {
      const actualHeight = menu.offsetHeight || 420;
      const menuLeft = rect.left;
      const menuTop = rect.top - actualHeight - offset;
      menu.style.left = `${Math.max(8, menuLeft)}px`;
      menu.style.top = `${Math.max(8, menuTop)}px`;
    });

    requestAnimationFrame(() => menu.classList.add("cgm-gm-winmenu-visible"));

    // Make draggable (header only)
    this._cleanupGMMenuDrag = this._makeMenuDraggable(menu, null, ".cgm-gm-winmenu-header");

    // Render doc content
    this._renderGMMenuContent();

    // Vertical button clicks
    menu.querySelectorAll(".cgm-gm-winmenu-vbtn").forEach(btn => {
      btn.addEventListener("click", async (e) => {
        e.stopPropagation();
        const action = btn.dataset.action;
        if (action === "toggleLockSheets") await this._toggleLockActorSheets();
        else if (action === "awardXp") await this._awardXpFlow();
        else if (action === "toggleCombat") await this._toggleCombat();
        else if (action === "togglePause") game.togglePause();
        else if (action === "endTurn") game.combat?.nextTurn();
      });
    });

    // Drag and drop handlers for sections
    menu.querySelectorAll(".cgm-gm-menu-list").forEach(listEl => {
      const section = listEl.dataset.section;

      listEl.addEventListener("dragover", (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
        listEl.classList.add("cgm-gm-menu-list-dragover");
      });

      listEl.addEventListener("dragleave", () => {
        listEl.classList.remove("cgm-gm-menu-list-dragover");
      });

      listEl.addEventListener("drop", async (e) => {
        e.preventDefault();
        listEl.classList.remove("cgm-gm-menu-list-dragover");

        // Try to get drag data from various sources
        let uuid = null;
        let docType = null;

        // 1) Try Foundry's native drag data first (most reliable)
        const dragData = TextEditor.getDragEventData(e);
        if (dragData?.uuid) {
          uuid = dragData.uuid;
          docType = dragData.type;
        }

        // 2) Fallback to plain text
        if (!uuid) {
          const text = e.dataTransfer.getData("text/plain");
          if (text?.startsWith("JournalEntry.")) {
            uuid = text;
            docType = "JournalEntry";
          } else {
            try {
              const parsed = JSON.parse(text);
              if (parsed?.uuid) {
                uuid = parsed.uuid;
                docType = parsed.type;
              }
            } catch {}
          }
        }

        if (!uuid) return;

        // Accept JournalEntry by type or UUID prefix
        const isJournal = docType === "JournalEntry" || uuid.startsWith("JournalEntry.");
        if (!isJournal) {
          ui.notifications.warn("Only Journal Entries can be added to GM Menu.");
          return;
        }

        await this._addDocToMenu(section, uuid);
      });
    });

    // Close on outside click
    const closeOnOutside = (e) => {
      if (!menu.contains(e.target) && !btnEl.contains(e.target) && !e.target.closest('.dialog, .window-app, .application, .file-picker')) {
        this._hideGMMenu();
        document.removeEventListener("click", closeOnOutside);
      }
    };
    setTimeout(() => document.addEventListener("click", closeOnOutside), 50);
  }

  _hideGMMenu() {
    if (this._gmMenuEl) {
      this._cleanupGMMenuDrag?.();
      this._cleanupGMMenuDrag = null;
      this._gmMenuEl.classList.remove("cgm-gm-winmenu-visible");
      setTimeout(() => { this._gmMenuEl?.remove(); this._gmMenuEl = null; }, 200);
    }
  }

  async _toggleLockActorSheets() {
    const current = game.settings.get(MODULE_ID, "lockActorSheets");
    const next = !current;
    await game.settings.set(MODULE_ID, "lockActorSheets", next);
    ui.notifications.info(next ? "Actor sheets are now LOCKED for players." : "Actor sheets are now UNLOCKED for players.");
    // Refresh the lock button icon in the open GM menu
    const menu = this._gmMenuEl;
    if (menu) {
      const lockBtn = menu.querySelector("[data-action='toggleLockSheets']");
      if (lockBtn) {
        const icon = lockBtn.querySelector("i");
        if (icon) {
          icon.className = next ? "fas fa-lock" : "fas fa-unlock";
        }
        lockBtn.title = next ? "Unlock actor sheets for players" : "Lock actor sheets for players";
      }
    }
  }

  async _toggleCombat() {
    if (game.combat) {
      await game.combat.end();
      ui.notifications.info("Combat ended.");
    } else if (canvas.scene) {
      await Combat.create({ scene: canvas.scene.id });
      ui.notifications.info("Combat started!");
    } else {
      ui.notifications.warn("No active scene to start combat.");
    }
  }

  /* ─── GM Group Roll Request ─── */

  _showGMGroupRollMenu(btnEl) {
    this._hideGMGroupRollMenu();
    this._hideGMGroupRollAttributes();
    this._hideGMGroupRollSkills();
    this._hideGMGroupRollFree();
    this._hideGMGroupRollDefense();

    const size = this._radialMenuSize;
    const offset = this._radialMenuOffset;
    const segCount = 4;
    const gap = 2;
    const outerR = size / 2 - 6;
    const innerR = outerR * 0.38;
    const half = size / 2;

    const segments = [
      { action: "rollAttributes", icon: "fa-hand-fist",   label: "Attributes", isAttributes: true },
      { action: "rollSkill",      icon: "fa-scroll",      label: "Skills",     isSkills: true },
      { action: "freeRoll",       icon: "fa-dice",        label: "Free Roll",  isFreeRoll: true },
      { action: "defenseRoll",    icon: "fa-shield-halved", label: "Defense",  isDefense: true },
    ];

    // SVG paths — same style as portrait radial menu
    let svgPaths = "";
    segments.forEach((seg, i) => {
      const startAngle = i * (360 / segCount) + gap / 2;
      const endAngle = (i + 1) * (360 / segCount) - gap / 2;
      const d = this._pieWedgePath(startAngle, endAngle, innerR, outerR);
      let specialClass = "";
      if (seg.isAttributes) specialClass = "cgm-pie-seg-attributes";
      else if (seg.isSkills)     specialClass = "cgm-pie-seg-skills";
      else if (seg.isFreeRoll)   specialClass = "cgm-pie-seg-freeroll";
      else if (seg.isDefense)    specialClass = "cgm-pie-seg-defense";
      svgPaths += `<path class="cgm-pie-seg ${specialClass}" data-action="${seg.action}" d="${d}" />`;
    });

    // Labels — same positioning as portrait menu
    let labelsHtml = "";
    segments.forEach((seg, i) => {
      const midAngle = (i * (360 / segCount) + ((i + 1) * (360 / segCount))) / 2;
      const rad = (midAngle - 90) * Math.PI / 180;
      const labelR = (innerR + outerR) / 2;
      const lx = Math.cos(rad) * labelR + half;
      const ly = Math.sin(rad) * labelR + half;
      let specialLabelClass = "";
      if (seg.isAttributes) specialLabelClass = "cgm-pie-label-attributes";
      else if (seg.isSkills)     specialLabelClass = "cgm-pie-label-skills";
      else if (seg.isFreeRoll)   specialLabelClass = "cgm-pie-label-freeroll";
      else if (seg.isDefense)    specialLabelClass = "cgm-pie-label-defense";
      labelsHtml += `
        <div class="cgm-pie-label ${specialLabelClass}" data-action="${seg.action}"
             style="left:${lx.toFixed(1)}px;top:${ly.toFixed(1)}px;">
          <i class="fas ${seg.icon}"></i>
          <span>${seg.label}</span>
        </div>
      `;
    });

    const menu = document.createElement("div");
    menu.className = "cgm-radial-menu cgm-gmroll-main";
    menu.style.width = `${size}px`;
    menu.style.height = `${size}px`;

    // Position menu — detect edge and open AWAY from closest border (same as portrait)
    const savedPos = this._loadMenuPosition("gmGroupRollMain");
    if (savedPos) {
      menu.style.left = `${Math.max(0, Math.min(savedPos.left, window.innerWidth - size))}px`;
      menu.style.top = `${Math.max(0, Math.min(savedPos.top, window.innerHeight - size))}px`;
    } else {
      const rect = btnEl.getBoundingClientRect();
      if (!rect || rect.width === 0 || rect.height === 0) {
        console.warn("Cypher GM Taskbar: GM Group Roll button rect is empty");
        return;
      }
      const btnCx = rect.left + rect.width / 2;
      const btnCy = rect.top + rect.height / 2;

      const spaceAbove = btnCy - size / 2;
      const spaceBelow = window.innerHeight - btnCy - size / 2;
      let menuLeft = btnCx - size / 2;
      let menuTop;
      if (spaceAbove >= size + offset && spaceAbove >= spaceBelow) {
        menuTop = rect.top - size - offset;
      } else if (spaceBelow >= size + offset) {
        menuTop = rect.bottom + offset;
      } else if (spaceAbove >= size + offset) {
        menuTop = rect.top - size - offset;
      } else {
        menuTop = (window.innerHeight - size) / 2;
      }

      menuLeft = Math.max(8, Math.min(menuLeft, window.innerWidth - size - 8));
      menuTop = Math.max(8, Math.min(menuTop, window.innerHeight - size - 8));

      menu.style.left = `${menuLeft}px`;
      menu.style.top = `${menuTop}px`;
    }

    // Same SVG structure as portrait radial menu
    menu.innerHTML = `
      <svg class="cgm-pie-svg" viewBox="-${half} -${half} ${size} ${size}" width="${size}" height="${size}">
        <defs>
          <radialGradient id="cgm-pie-bg" cx="0" cy="0" r="${outerR}">
            <stop offset="0%" stop-color="rgba(20,22,35,0.3)" />
            <stop offset="100%" stop-color="rgba(15,17,30,0.95)" />
          </radialGradient>
        </defs>
        <circle cx="0" cy="0" r="${outerR}" fill="url(#cgm-pie-bg)" stroke="rgba(200,169,110,0.15)" stroke-width="1" />
        ${svgPaths}
        <circle cx="0" cy="0" r="${innerR - 2}" fill="rgba(15,17,30,0.98)" stroke="rgba(200,169,110,0.3)" stroke-width="1.5" />
      </svg>
      ${labelsHtml}
      <div class="cgm-pie-portrait" style="background:rgba(30,33,52,0.95);display:grid;place-items:center;">
        <i class="fas fa-dice-d20" style="font-size:28px;color:#d94040;"></i>
      </div>
    `;

    document.body.appendChild(menu);
    this._gmGroupRollMenuEl = menu;
    requestAnimationFrame(() => menu.classList.add("cgm-radial-visible"));

    // Draw line from button to main menu
    const btnRect = btnEl.getBoundingClientRect();
    const menuRect = menu.getBoundingClientRect();
    this._createGMGroupRollLine("cgm-gmroll-line-main", btnRect.left + btnRect.width / 2, btnRect.top + btnRect.height / 2, menuRect.left + menuRect.width / 2, menuRect.top + menuRect.height / 2);

    // Make draggable
    this._cleanupGMGroupRollDrag = this._makeMenuDraggable(menu, "gmGroupRollMain");
    const onSegClick = (e) => {
      e.stopPropagation();
      const action = e.currentTarget.dataset.action;
      // Don't close main menu — it stays open while submenu is active
      if (action === "rollAttributes") this._showGMGroupRollAttributes(btnEl);
      else if (action === "rollSkill")      this._showGMGroupRollSkills(btnEl);
      else if (action === "freeRoll")       this._showGMGroupRollFree(btnEl);
      else if (action === "defenseRoll")    this._showGMGroupRollDefense(btnEl);
    };
    menu.querySelectorAll(".cgm-pie-seg, .cgm-pie-label").forEach(el => {
      el.addEventListener("click", onSegClick);
    });

    // Hover sync — same as portrait menu
    menu.querySelectorAll(".cgm-pie-seg").forEach(seg => {
      const action = seg.dataset.action;
      const label = menu.querySelector(`.cgm-pie-label[data-action="${action}"]`);
      seg.addEventListener("mouseenter", () => label?.classList.add("cgm-pie-label-active"));
      seg.addEventListener("mouseleave", () => label?.classList.remove("cgm-pie-label-active"));
    });
    menu.querySelectorAll(".cgm-pie-label").forEach(lbl => {
      const action = lbl.dataset.action;
      const seg = menu.querySelector(`.cgm-pie-seg[data-action="${action}"]`);
      lbl.addEventListener("mouseenter", () => seg?.classList.add("cgm-pie-seg-hover"));
      lbl.addEventListener("mouseleave", () => seg?.classList.remove("cgm-pie-seg-hover"));
    });

    const closeHandler = (e) => {
      if (!menu.contains(e.target) && e.target !== btnEl) {
        this._hideGMGroupRollMenu();
        document.removeEventListener("click", closeHandler);
      }
    };
    setTimeout(() => document.addEventListener("click", closeHandler), 10);
  }

  _hideGMGroupRollMenu() {
    if (this._gmGroupRollMenuEl) {
      this._cleanupGMGroupRollDrag?.();
      this._cleanupGMGroupRollDrag = null;
      this._removeAllGMGroupRollLines();
      this._gmGroupRollMenuEl.classList.remove("cgm-radial-visible");
      setTimeout(() => { this._gmGroupRollMenuEl?.remove(); this._gmGroupRollMenuEl = null; }, 200);
    }
  }

  /* ═══════════════════════════════════════════════════════════
     TASKBAR RECOVERY MENU — ONE / FULL for all party actors
     ═══════════════════════════════════════════════════════════ */

  _showRecoveryTaskbarMenu(btnEl) {
    this._hideRecoveryTaskbarMenu();

    const size = this._radialMenuSize;
    const offset = this._radialMenuOffset;
    const segCount = 2;
    const gap = 2;
    const outerR = size / 2 - 6;
    const innerR = outerR * 0.38;
    const half = size / 2;

    const segments = [
      { action: "oneRecovery",  icon: "fa-tint", label: "ONE",  isOne: true },
      { action: "fullRecovery", icon: "fa-droplet", label: "FULL", isFull: true },
    ];

    let svgPaths = "";
    segments.forEach((seg, i) => {
      const startAngle = i * (360 / segCount) + gap / 2;
      const endAngle = (i + 1) * (360 / segCount) - gap / 2;
      const d = this._pieWedgePath(startAngle, endAngle, innerR, outerR);
      let specialClass = "";
      if (seg.isOne) specialClass = "cgm-pie-seg-recovery-one";
      else if (seg.isFull) specialClass = "cgm-pie-seg-recovery-full";
      svgPaths += `<path class="cgm-pie-seg ${specialClass}" data-action="${seg.action}" d="${d}" />`;
    });

    let labelsHtml = "";
    segments.forEach((seg, i) => {
      const midAngle = (i * (360 / segCount) + ((i + 1) * (360 / segCount))) / 2;
      const rad = (midAngle - 90) * Math.PI / 180;
      const labelR = (innerR + outerR) / 2;
      const lx = Math.cos(rad) * labelR + half;
      const ly = Math.sin(rad) * labelR + half;
      let specialLabelClass = "";
      if (seg.isOne) specialLabelClass = "cgm-pie-label-recovery-one";
      else if (seg.isFull) specialLabelClass = "cgm-pie-label-recovery-full";
      labelsHtml += `
        <div class="cgm-pie-label ${specialLabelClass}" data-action="${seg.action}"
             style="left:${lx.toFixed(1)}px;top:${ly.toFixed(1)}px;">
          <i class="fas ${seg.icon}"></i>
          <span>${seg.label}</span>
        </div>
      `;
    });

    const menu = document.createElement("div");
    menu.className = "cgm-radial-menu cgm-recovery-menu";
    menu.style.width = `${size}px`;
    menu.style.height = `${size}px`;

    // Position — try saved first, then auto-position
    const savedPos = this._loadMenuPosition("recoveryTaskbar");
    if (savedPos) {
      menu.style.left = `${Math.max(0, Math.min(savedPos.left, window.innerWidth - size))}px`;
      menu.style.top = `${Math.max(0, Math.min(savedPos.top, window.innerHeight - size))}px`;
    } else {
      const rect = btnEl.getBoundingClientRect();
      if (!rect || rect.width === 0 || rect.height === 0) {
        console.warn("Cypher GM Taskbar: Recovery button rect is empty");
        return;
      }
      const btnCx = rect.left + rect.width / 2;
      const btnCy = rect.top + rect.height / 2;

      const spaceAbove = btnCy - size / 2;
      const spaceBelow = window.innerHeight - btnCy - size / 2;
      let menuLeft = btnCx - size / 2;
      let menuTop;
      if (spaceAbove >= size + offset && spaceAbove >= spaceBelow) {
        menuTop = rect.top - size - offset;
      } else if (spaceBelow >= size + offset) {
        menuTop = rect.bottom + offset;
      } else if (spaceAbove >= size + offset) {
        menuTop = rect.top - size - offset;
      } else {
        menuTop = (window.innerHeight - size) / 2;
      }

      menuLeft = Math.max(8, Math.min(menuLeft, window.innerWidth - size - 8));
      menuTop = Math.max(8, Math.min(menuTop, window.innerHeight - size - 8));

      menu.style.left = `${menuLeft}px`;
      menu.style.top = `${menuTop}px`;
    }

    menu.innerHTML = `
      <svg class="cgm-pie-svg" viewBox="-${half} -${half} ${size} ${size}" width="${size}" height="${size}">
        <defs>
          <radialGradient id="cgm-pie-bg" cx="0" cy="0" r="${outerR}">
            <stop offset="0%" stop-color="rgba(20,22,35,0.3)" />
            <stop offset="100%" stop-color="rgba(15,17,30,0.95)" />
          </radialGradient>
        </defs>
        <circle cx="0" cy="0" r="${outerR}" fill="url(#cgm-pie-bg)" stroke="rgba(59,130,246,0.3)" stroke-width="1" />
        ${svgPaths}
        <circle cx="0" cy="0" r="${innerR - 2}" fill="rgba(15,17,30,0.98)" stroke="rgba(59,130,246,0.4)" stroke-width="1.5" />
      </svg>
      ${labelsHtml}
      <div class="cgm-pie-portrait" style="background:rgba(30,33,52,0.95);display:grid;place-items:center;">
        <i class="fas fa-droplet" style="font-size:28px;color:#3b82f6;"></i>
      </div>
    `;

    document.body.appendChild(menu);
    this._recoveryTaskbarMenuEl = menu;
    requestAnimationFrame(() => menu.classList.add("cgm-radial-visible"));

    // Make draggable
    this._cleanupRecoveryDrag = this._makeMenuDraggable(menu, "recoveryTaskbar");

    const onSegClick = async (e) => {
      e.stopPropagation();
      const action = e.currentTarget.dataset.action;
      this._hideRecoveryTaskbarMenu();
      if (action === "oneRecovery") await this._doOneRecoveryAll();
      else if (action === "fullRecovery") await this._doFullRecoveryAll();
    };
    menu.querySelectorAll(".cgm-pie-seg, .cgm-pie-label").forEach(el => {
      el.addEventListener("click", onSegClick);
    });

    // Hover sync
    menu.querySelectorAll(".cgm-pie-seg").forEach(seg => {
      const action = seg.dataset.action;
      const label = menu.querySelector(`.cgm-pie-label[data-action="${action}"]`);
      seg.addEventListener("mouseenter", () => label?.classList.add("cgm-pie-label-active"));
      seg.addEventListener("mouseleave", () => label?.classList.remove("cgm-pie-label-active"));
    });
    menu.querySelectorAll(".cgm-pie-label").forEach(lbl => {
      const action = lbl.dataset.action;
      const seg = menu.querySelector(`.cgm-pie-seg[data-action="${action}"]`);
      lbl.addEventListener("mouseenter", () => seg?.classList.add("cgm-pie-seg-hover"));
      lbl.addEventListener("mouseleave", () => seg?.classList.remove("cgm-pie-seg-hover"));
    });

    const closeHandler = (e) => {
      if (!menu.contains(e.target) && e.target !== btnEl) {
        this._hideRecoveryTaskbarMenu();
        document.removeEventListener("click", closeHandler);
      }
    };
    setTimeout(() => document.addEventListener("click", closeHandler), 10);
  }

  _hideRecoveryTaskbarMenu() {
    if (this._recoveryTaskbarMenuEl) {
      this._cleanupRecoveryDrag?.();
      this._cleanupRecoveryDrag = null;
      this._recoveryTaskbarMenuEl.classList.remove("cgm-radial-visible");
      setTimeout(() => { this._recoveryTaskbarMenuEl?.remove(); this._recoveryTaskbarMenuEl = null; }, 200);
    }
  }
  /* ═══════════════════════════════════════════════════════════════
     REPUTATION PANEL
     ═══════════════════════════════════════════════════════════════ */
  _toggleReputationPanel(btnEl) {
    if (this._reputationPanelEl) {
      this._hideReputationPanel();
      return;
    }
    this._showReputationPanel(btnEl);
  }

  _hideReputationPanel() {
    if (this._reputationPanelEl) {
      this._reputationPanelEl.classList.remove("cgm-reputation-visible");
      setTimeout(() => {
        this._reputationPanelEl?.remove();
        this._reputationPanelEl = null;
      }, 200);
    }
  }

  async _showReputationPanel(btnEl) {
    this._hideReputationPanel();

    const panelW = 460;
    const panelH = 420;

    // Position below the button
    const rect = btnEl.getBoundingClientRect();
    let panelLeft = rect.left + rect.width / 2 - panelW / 2;
    let panelTop = rect.bottom + 8;

    // Clamp to viewport
    panelLeft = Math.max(8, Math.min(panelLeft, window.innerWidth - panelW - 8));
    const spaceBelow = window.innerHeight - rect.bottom - 8;
    if (spaceBelow < panelH && rect.top > panelH + 16) {
      panelTop = rect.top - panelH - 8;
    }
    panelTop = Math.max(8, Math.min(panelTop, window.innerHeight - panelH - 8));

    // Load saved position if available
    if (this._reputationPanelPos) {
      const clamped = this._clampPanelPos(this._reputationPanelPos.left, this._reputationPanelPos.top, panelW, panelH);
      panelLeft = clamped.left;
      panelTop = clamped.top;
      this._reputationPanelPos = clamped;
    }

    const panel = document.createElement("div");
    panel.className = "cgm-reputation-panel";
    panel.style.cssText = `position:fixed;left:${panelLeft}px;top:${panelTop}px;width:${panelW}px;height:${panelH}px;z-index:202;`;

    // Get all PCs
    const pcs = game.actors.filter(a => a.type === "pc" && a.hasPlayerOwner).sort((a, b) => a.name.localeCompare(b.name));

    // Build tabs: ALL + one per actor (first name only)
    const tabsHtml = `
      <div class="cgm-reputation-tabs">
        <button class="cgm-reputation-tab cgm-reputation-tab-active" data-rep-tab="all">ALL</button>
        ${pcs.map(pc => `<button class="cgm-reputation-tab" data-rep-tab="${pc.id}">${pc.name.split(' ')[0]}</button>`).join("")}
      </div>
    `;

    panel.innerHTML = `
      <div class="cgm-reputation-header">
        <i class="fas fa-handshake"></i>
        <span>Reputation and gossips</span>
        <button class="cgm-reputation-close"><i class="fas fa-xmark"></i></button>
      </div>
      ${tabsHtml}
      <div class="cgm-reputation-body">
        <div class="cgm-reputation-content" data-rep-content="all">
          ${this._buildReputationTabContent(null, pcs)}
          ${this._buildGossipTabContent(null, pcs)}
        </div>
        ${pcs.map(pc => `
          <div class="cgm-reputation-content" data-rep-content="${pc.id}" style="display:none;">
            ${this._buildReputationTabContent(pc.id, pcs)}
            ${this._buildGossipTabContent(pc.id, pcs)}
          </div>
        `).join("")}
      </div>
    `;

    document.body.appendChild(panel);
    this._reputationPanelEl = panel;
    requestAnimationFrame(() => panel.classList.add("cgm-reputation-visible"));

    // Close button
    panel.querySelector(".cgm-reputation-close")?.addEventListener("click", () => {
      this._hideReputationPanel();
    });

    // Tab switching
    panel.querySelectorAll("[data-rep-tab]").forEach(tab => {
      tab.addEventListener("click", () => {
        const tabKey = tab.dataset.repTab;
        panel.querySelectorAll(".cgm-reputation-tab").forEach(t => t.classList.remove("cgm-reputation-tab-active"));
        tab.classList.add("cgm-reputation-tab-active");
        panel.querySelectorAll("[data-rep-content]").forEach(c => c.style.display = c.dataset.repContent === tabKey ? "" : "none");
      });
    });

    // Add reputation button
    panel.querySelectorAll("[data-rep-add]").forEach(btn => {
      btn.addEventListener("click", async () => {
        const actorId = btn.dataset.repAdd || null;
        await this._showAddReputationDialog(actorId, pcs);
      });
    });

    // Delete reputation
    panel.querySelectorAll("[data-rep-delete]").forEach(btn => {
      btn.addEventListener("click", async () => {
        const actorId = btn.dataset.repDelete;
        const repId = btn.dataset.repId;
        await this._deleteReputation(actorId, repId);
      });
    });

    // Toggle hide/show reputation
    panel.querySelectorAll("[data-rep-eye]").forEach(btn => {
      btn.addEventListener("click", async () => {
        const actorId = btn.dataset.repEye;
        const repId = btn.dataset.repId;
        await this._toggleReputationHidden(actorId, repId);
      });
    });

    // Score +/- buttons
    panel.querySelectorAll("[data-rep-minus]").forEach(btn => {
      btn.addEventListener("click", async () => {
        const actorId = btn.dataset.repMinus;
        const repId = btn.dataset.repId;
        await this._changeReputationScore(actorId, repId, -1);
      });
    });
    panel.querySelectorAll("[data-rep-plus]").forEach(btn => {
      btn.addEventListener("click", async () => {
        const actorId = btn.dataset.repPlus;
        const repId = btn.dataset.repId;
        await this._changeReputationScore(actorId, repId, 1);
      });
    });

    // === GOSSIP EVENTS ===
    // Add gossip button
    panel.querySelectorAll("[data-gossip-add]").forEach(btn => {
      btn.addEventListener("click", async () => {
        const actorId = btn.dataset.gossipAdd || null;
        await this._showAddGossipDialog(actorId, pcs);
      });
    });
    // Delete gossip
    panel.querySelectorAll("[data-gossip-delete]").forEach(btn => {
      btn.addEventListener("click", async () => {
        await this._deleteGossip(btn.dataset.gossipDelete, btn.dataset.gossipId);
      });
    });
    // Toggle gossip known/unknown
    panel.querySelectorAll("[data-gossip-eye]").forEach(btn => {
      btn.addEventListener("click", async () => {
        await this._toggleGossipKnown(btn.dataset.gossipEye, btn.dataset.gossipId);
      });
    });
    // Gossip score +/-
    panel.querySelectorAll("[data-gossip-minus]").forEach(btn => {
      btn.addEventListener("click", async () => {
        await this._changeGossipScore(btn.dataset.gossipMinus, btn.dataset.gossipId, -1);
      });
    });
    panel.querySelectorAll("[data-gossip-plus]").forEach(btn => {
      btn.addEventListener("click", async () => {
        await this._changeGossipScore(btn.dataset.gossipPlus, btn.dataset.gossipId, 1);
      });
    });

    // Make draggable
    const header = panel.querySelector(".cgm-reputation-header");
    if (header) {
      let isDragging = false, startX, startY, startLeft, startTop;
      header.addEventListener("mousedown", (e) => {
        if (e.target.closest("button")) return;
        isDragging = true;
        startX = e.clientX;
        startY = e.clientY;
        const r = panel.getBoundingClientRect();
        startLeft = r.left;
        startTop = r.top;
        panel.style.transition = "none";
      });
      document.addEventListener("mousemove", (e) => {
        if (!isDragging) return;
        const dx = e.clientX - startX;
        const dy = e.clientY - startY;
        let nl = startLeft + dx;
        let nt = startTop + dy;
        const r = panel.getBoundingClientRect();
        nl = Math.max(0, Math.min(nl, window.innerWidth - r.width));
        nt = Math.max(0, Math.min(nt, window.innerHeight - r.height));
        panel.style.left = `${nl}px`;
        panel.style.top = `${nt}px`;
      });
      document.addEventListener("mouseup", () => {
        if (!isDragging) return;
        isDragging = false;
        panel.style.transition = "";
        const r = panel.getBoundingClientRect();
        this._reputationPanelPos = { left: r.left, top: r.top };
      });
    }

    // Close only via close button — panel stays open until explicitly closed
  }

  _buildReputationTabContent(actorId, pcs) {
    let entries = [];
    if (actorId) {
      const actor = game.actors.get(actorId);
      if (actor) {
        const reps = actor.getFlag("cypher-gm-taskbar", "reputations") || [];
        entries = reps.map(r => ({ ...r, actorId, actorName: actor.name }));
      }
    } else {
      // ALL tab - show all reputations grouped by actor
      for (const pc of pcs) {
        const reps = pc.getFlag("cypher-gm-taskbar", "reputations") || [];
        entries.push(...reps.map(r => ({ ...r, actorId: pc.id, actorName: pc.name })));
      }
    }

    if (!entries.length) {
      return `
        <div class="cgm-reputation-empty">
          <i class="fas fa-handshake"></i>
          <span>No reputations yet.</span>
          <button class="cgm-reputation-add-btn" data-rep-add="${actorId || ''}"><i class="fas fa-plus"></i> Add Reputation</button>
        </div>
      `;
    }

    const rows = entries.map(rep => {
      const scoreColor = rep.score < 0 ? "cgm-reputation-negative" : rep.score > 0 ? "cgm-reputation-positive" : "cgm-reputation-neutral";
      const scoreSign = rep.score > 0 ? `+${rep.score}` : rep.score;
      const actorLabel = actorId ? "" : `<div class="cgm-reputation-actor">${rep.actorName}</div>`;
      const hiddenClass = rep.hidden ? "cgm-reputation-hidden" : "";
      const eyeIcon = rep.hidden ? "fa-eye-slash" : "fa-eye";
      const eyeTitle = rep.hidden ? "Hidden from actor" : "Visible to actor";
      return `
        <div class="cgm-reputation-row ${hiddenClass}">
          <div class="cgm-reputation-info">
            ${actorLabel}
            <div class="cgm-reputation-name">${foundry.utils.escapeHTML(rep.name)}</div>
            <div class="cgm-reputation-type">${foundry.utils.escapeHTML(rep.repType || "Neutral")}</div>
          </div>
          <div class="cgm-reputation-controls">
            <button class="cgm-reputation-score-btn" data-rep-minus="${rep.actorId}" data-rep-id="${rep.id}" title="-1"><i class="fas fa-minus"></i></button>
            <div class="cgm-reputation-score ${scoreColor}">${scoreSign}</div>
            <button class="cgm-reputation-score-btn" data-rep-plus="${rep.actorId}" data-rep-id="${rep.id}" title="+1"><i class="fas fa-plus"></i></button>
            <button class="cgm-reputation-eye" data-rep-eye="${rep.actorId}" data-rep-id="${rep.id}" title="${eyeTitle}"><i class="fas ${eyeIcon}"></i></button>
            <button class="cgm-reputation-delete" data-rep-delete="${rep.actorId}" data-rep-id="${rep.id}" title="Delete"><i class="fas fa-trash"></i></button>
          </div>
        </div>
      `;
    }).join("");

    return `
      <div class="cgm-reputation-list">
        ${rows}
      </div>
      <button class="cgm-reputation-add-btn" data-rep-add="${actorId || ''}"><i class="fas fa-plus"></i> Add Reputation</button>
    `;
  }

  async _showAddReputationDialog(actorId, pcs) {
    const actorsForSelect = actorId
      ? [{ id: actorId, name: game.actors.get(actorId)?.name || "Unknown" }]
      : pcs.map(pc => ({ id: pc.id, name: pc.name }));

    const selectHtml = actorsForSelect.length > 1
      ? `<div class="cgm-rep-dialog-row"><label>Actor</label><select id="cgm-rep-actor" class="cgm-rep-dialog-input">${actorsForSelect.map(a => `<option value="${a.id}">${a.name}</option>`).join("")}</select></div>`
      : `<input type="hidden" id="cgm-rep-actor" value="${actorsForSelect[0]?.id || ''}">`;

    // Create fancy custom dialog overlay
    const overlay = document.createElement("div");
    overlay.className = "cgm-rep-dialog-overlay";
    overlay.innerHTML = `
      <div class="cgm-rep-dialog">
        <div class="cgm-rep-dialog-header">
          <i class="fas fa-handshake"></i>
          <span>Add Reputation</span>
          <button class="cgm-rep-dialog-close" data-rep-dialog-close><i class="fas fa-xmark"></i></button>
        </div>
        <div class="cgm-rep-dialog-body">
          ${selectHtml}
          <div class="cgm-rep-dialog-row">
            <label>Name</label>
            <input type="text" id="cgm-rep-name" class="cgm-rep-dialog-input" placeholder="e.g. Town of Cresthaven" maxlength="80">
          </div>
          <div class="cgm-rep-dialog-row">
            <label>Reputation</label>
            <input type="text" id="cgm-rep-type" class="cgm-rep-dialog-input" placeholder="e.g. Friendly, Hostile, Neutral" maxlength="60">
          </div>
          <div class="cgm-rep-dialog-row">
            <label>Score (-2 to +2)</label>
            <div class="cgm-rep-dialog-score-wrap">
              <button class="cgm-rep-dialog-score-btn" data-rep-dialog-minus><i class="fas fa-minus"></i></button>
              <input type="number" id="cgm-rep-score" class="cgm-rep-dialog-score-input" value="0" min="-2" max="2" readonly>
              <button class="cgm-rep-dialog-score-btn" data-rep-dialog-plus><i class="fas fa-plus"></i></button>
            </div>
          </div>
          <div class="cgm-rep-dialog-row">
            <label>Description <span class="cgm-rep-dialog-char-count">0 / 1000</span></label>
            <textarea id="cgm-rep-desc" class="cgm-rep-dialog-textarea" placeholder="Enter reputation details, notes, or history... (up to 1000 characters)" maxlength="1000" rows="4"></textarea>
          </div>
        </div>
        <div class="cgm-rep-dialog-footer">
          <button class="cgm-rep-dialog-btn cgm-rep-dialog-btn-secondary" data-rep-dialog-cancel>
            <i class="fas fa-xmark"></i> Cancel
          </button>
          <button class="cgm-rep-dialog-btn cgm-rep-dialog-btn-primary" data-rep-dialog-add>
            <i class="fas fa-plus"></i> Add Reputation
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);
    requestAnimationFrame(() => overlay.classList.add("cgm-rep-dialog-visible"));

    const nameInput = overlay.querySelector("#cgm-rep-name");
    const scoreInput = overlay.querySelector("#cgm-rep-score");
    const descInput = overlay.querySelector("#cgm-rep-desc");
    const charCount = overlay.querySelector(".cgm-rep-dialog-char-count");

    // Focus name input
    setTimeout(() => nameInput?.focus(), 50);

    // Character counter
    descInput?.addEventListener("input", () => {
      if (charCount) charCount.textContent = `${descInput.value.length} / 1000`;
    });

    // Score +/- in dialog
    overlay.querySelector("[data-rep-dialog-minus]")?.addEventListener("click", () => {
      const val = parseInt(scoreInput.value, 10) || 0;
      scoreInput.value = Math.max(-2, val - 1);
    });
    overlay.querySelector("[data-rep-dialog-plus]")?.addEventListener("click", () => {
      const val = parseInt(scoreInput.value, 10) || 0;
      scoreInput.value = Math.min(2, val + 1);
    });

    // Close / Cancel
    const closeDialog = () => {
      overlay.classList.remove("cgm-rep-dialog-visible");
      setTimeout(() => overlay.remove(), 250);
    };

    overlay.querySelector("[data-rep-dialog-close]")?.addEventListener("click", closeDialog);
    overlay.querySelector("[data-rep-dialog-cancel]")?.addEventListener("click", closeDialog);
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) closeDialog();
    });

    // Add
    overlay.querySelector("[data-rep-dialog-add]")?.addEventListener("click", async () => {
      const targetActorId = overlay.querySelector("#cgm-rep-actor")?.value || actorId;
      const name = nameInput?.value.trim();
      const repType = overlay.querySelector("#cgm-rep-type")?.value.trim() || "Neutral";
      const score = parseInt(scoreInput?.value, 10) || 0;
      const description = descInput?.value.trim() || "";
      if (!name || !targetActorId) {
        ui.notifications.warn("Please enter a reputation name.");
        return;
      }
      closeDialog();
      await this._addReputation(targetActorId, name, repType, Math.max(-2, Math.min(2, score)), description);
    });
  }

  async _addReputation(actorId, name, repType, score, description = "") {
    const actor = game.actors.get(actorId);
    if (!actor) return;
    const reps = foundry.utils.deepClone(actor.getFlag("cypher-gm-taskbar", "reputations") || []);
    reps.push({
      id: foundry.utils.randomID(),
      name,
      repType,
      score: Math.max(-2, Math.min(2, score)),
      description: description.substring(0, 1000),
      hidden: false
    });
    await actor.setFlag("cypher-gm-taskbar", "reputations", reps);
    this._refreshReputationPanel();
    ui.notifications.info(`Reputation "${name}" added to ${actor.name}.`);
  }

  async _deleteReputation(actorId, repId) {
    const actor = game.actors.get(actorId);
    if (!actor) return;
    const reps = foundry.utils.deepClone(actor.getFlag("cypher-gm-taskbar", "reputations") || []);
    const idx = reps.findIndex(r => r.id === repId);
    if (idx >= 0) {
      const name = reps[idx].name;
      reps.splice(idx, 1);
      await actor.setFlag("cypher-gm-taskbar", "reputations", reps);
      this._refreshReputationPanel();
      ui.notifications.info(`Reputation "${name}" removed from ${actor.name}.`);
    }
  }

  async _changeReputationScore(actorId, repId, delta) {
    const actor = game.actors.get(actorId);
    if (!actor) return;
    const reps = foundry.utils.deepClone(actor.getFlag("cypher-gm-taskbar", "reputations") || []);
    const rep = reps.find(r => r.id === repId);
    if (!rep) return;
    const newScore = Math.max(-2, Math.min(2, rep.score + delta));
    if (newScore === rep.score) return;
    rep.score = newScore;
    await actor.setFlag("cypher-gm-taskbar", "reputations", reps);
    this._refreshReputationPanel();
  }

  async _toggleReputationHidden(actorId, repId) {
    const actor = game.actors.get(actorId);
    if (!actor) return;
    const reps = foundry.utils.deepClone(actor.getFlag("cypher-gm-taskbar", "reputations") || []);
    const rep = reps.find(r => r.id === repId);
    if (!rep) return;
    rep.hidden = !rep.hidden;
    await actor.setFlag("cypher-gm-taskbar", "reputations", reps);
    this._refreshReputationPanel();
    const status = rep.hidden ? "hidden" : "visible";
    ui.notifications.info(`Reputation "${rep.name}" is now ${status} to ${actor.name}.`);
  }

  _refreshReputationPanel() {
    if (!this._reputationPanelEl) return;
    const pcs = game.actors.filter(a => a.type === "pc" && a.hasPlayerOwner).sort((a, b) => a.name.localeCompare(b.name));
    const activeTab = this._reputationPanelEl.querySelector(".cgm-reputation-tab-active")?.dataset.repTab || "all";

    // Refresh each tab content (reputation + gossip)
    this._reputationPanelEl.querySelectorAll("[data-rep-content]").forEach(content => {
      const actorId = content.dataset.repContent === "all" ? null : content.dataset.repContent;
      content.innerHTML = this._buildReputationTabContent(actorId, pcs) + this._buildGossipTabContent(actorId, pcs);
    });

    // Re-bind reputation events
    this._reputationPanelEl.querySelectorAll("[data-rep-add]").forEach(btn => {
      btn.addEventListener("click", async () => {
        const aid = btn.dataset.repAdd || null;
        await this._showAddReputationDialog(aid, pcs);
      });
    });
    this._reputationPanelEl.querySelectorAll("[data-rep-delete]").forEach(btn => {
      btn.addEventListener("click", async () => {
        await this._deleteReputation(btn.dataset.repDelete, btn.dataset.repId);
      });
    });
    this._reputationPanelEl.querySelectorAll("[data-rep-minus]").forEach(btn => {
      btn.addEventListener("click", async () => {
        await this._changeReputationScore(btn.dataset.repMinus, btn.dataset.repId, -1);
      });
    });
    this._reputationPanelEl.querySelectorAll("[data-rep-plus]").forEach(btn => {
      btn.addEventListener("click", async () => {
        await this._changeReputationScore(btn.dataset.repPlus, btn.dataset.repId, 1);
      });
    });
    this._reputationPanelEl.querySelectorAll("[data-rep-eye]").forEach(btn => {
      btn.addEventListener("click", async () => {
        await this._toggleReputationHidden(btn.dataset.repEye, btn.dataset.repId);
      });
    });

    // Re-bind gossip events
    this._reputationPanelEl.querySelectorAll("[data-gossip-add]").forEach(btn => {
      btn.addEventListener("click", async () => {
        const aid = btn.dataset.gossipAdd || null;
        await this._showAddGossipDialog(aid, pcs);
      });
    });
    this._reputationPanelEl.querySelectorAll("[data-gossip-delete]").forEach(btn => {
      btn.addEventListener("click", async () => {
        await this._deleteGossip(btn.dataset.gossipDelete, btn.dataset.gossipId);
      });
    });
    this._reputationPanelEl.querySelectorAll("[data-gossip-minus]").forEach(btn => {
      btn.addEventListener("click", async () => {
        await this._changeGossipScore(btn.dataset.gossipMinus, btn.dataset.gossipId, -1);
      });
    });
    this._reputationPanelEl.querySelectorAll("[data-gossip-plus]").forEach(btn => {
      btn.addEventListener("click", async () => {
        await this._changeGossipScore(btn.dataset.gossipPlus, btn.dataset.gossipId, 1);
      });
    });
    this._reputationPanelEl.querySelectorAll("[data-gossip-eye]").forEach(btn => {
      btn.addEventListener("click", async () => {
        await this._toggleGossipKnown(btn.dataset.gossipEye, btn.dataset.gossipId);
      });
    });
  }

  /* ═══════════════════════════════════════════════════════════
     GOSSIP SYSTEM
     ═══════════════════════════════════════════════════════════ */

  _buildGossipTabContent(actorId, pcs) {
    let entries = [];
    if (actorId) {
      const actor = game.actors.get(actorId);
      if (actor) {
        const gossips = actor.getFlag("cypher-gm-taskbar", "gossips") || [];
        entries = gossips.map(g => ({ ...g, actorId, actorName: actor.name }));
      }
    } else {
      for (const pc of pcs) {
        const gossips = pc.getFlag("cypher-gm-taskbar", "gossips") || [];
        entries.push(...gossips.map(g => ({ ...g, actorId: pc.id, actorName: pc.name })));
      }
    }

    const rows = entries.map(g => {
      const actorLabel = actorId ? "" : `<div class="cgm-gossip-actor">${g.actorName}</div>`;
      const knownClass = g.known ? "cgm-gossip-known" : "cgm-gossip-unknown";
      const eyeIcon = g.known ? "fa-eye" : "fa-eye-slash";
      const eyeTitle = g.known ? "Known to actor" : "Unknown to actor";
      const scoreSign = g.score < 0 ? `${g.score}` : `-${g.score}`;
      return `
        <div class="cgm-gossip-row ${knownClass}">
          <div class="cgm-gossip-info">
            ${actorLabel}
            <div class="cgm-gossip-name">${foundry.utils.escapeHTML(g.name)}</div>
            <div class="cgm-gossip-source">Source: ${foundry.utils.escapeHTML(g.source || "Unknown")}</div>
            <div class="cgm-gossip-group">Group: ${foundry.utils.escapeHTML(g.group || "—")}</div>
          </div>
          <div class="cgm-gossip-controls">
            <button class="cgm-gossip-score-btn" data-gossip-minus="${g.actorId}" data-gossip-id="${g.id}" title="-1"><i class="fas fa-minus"></i></button>
            <div class="cgm-gossip-score">${scoreSign}</div>
            <button class="cgm-gossip-score-btn" data-gossip-plus="${g.actorId}" data-gossip-id="${g.id}" title="+1"><i class="fas fa-plus"></i></button>
            <button class="cgm-gossip-eye" data-gossip-eye="${g.actorId}" data-gossip-id="${g.id}" title="${eyeTitle}"><i class="fas ${eyeIcon}"></i></button>
            <button class="cgm-gossip-delete" data-gossip-delete="${g.actorId}" data-gossip-id="${g.id}" title="Delete"><i class="fas fa-trash"></i></button>
          </div>
        </div>
      `;
    }).join("");

    return `
      <div class="cgm-gossip-section">
        <div class="cgm-gossip-header">
          <i class="fas fa-comments"></i>
          <span>Gossips</span>
        </div>
        ${entries.length ? `<div class="cgm-gossip-list">${rows}</div>` : `<div class="cgm-gossip-empty">No gossips yet.</div>`}
        <button class="cgm-gossip-add-btn" data-gossip-add="${actorId || ''}"><i class="fas fa-plus"></i> Add Gossip</button>
      </div>
    `;
  }

  async _showAddGossipDialog(actorId, pcs) {
    const actorsForSelect = actorId
      ? [{ id: actorId, name: game.actors.get(actorId)?.name || "Unknown" }]
      : pcs.map(pc => ({ id: pc.id, name: pc.name }));

    const selectHtml = actorsForSelect.length > 1
      ? `<div class="cgm-rep-dialog-row"><label>Actor</label><select id="cgm-gossip-actor" class="cgm-rep-dialog-input">${actorsForSelect.map(a => `<option value="${a.id}">${a.name}</option>`).join("")}</select></div>`
      : `<input type="hidden" id="cgm-gossip-actor" value="${actorsForSelect[0]?.id || ''}">`;

    const overlay = document.createElement("div");
    overlay.className = "cgm-rep-dialog-overlay";
    overlay.innerHTML = `
      <div class="cgm-rep-dialog cgm-gossip-dialog">
        <div class="cgm-rep-dialog-header">
          <i class="fas fa-comments"></i>
          <span>Add Gossip</span>
          <button class="cgm-rep-dialog-close" data-gossip-dialog-close><i class="fas fa-xmark"></i></button>
        </div>
        <div class="cgm-rep-dialog-body">
          ${selectHtml}
          <div class="cgm-rep-dialog-row">
            <label>Gossip Name</label>
            <input type="text" id="cgm-gossip-name" class="cgm-rep-dialog-input" placeholder="e.g. The Duke's Secret" maxlength="80">
          </div>
          <div class="cgm-rep-dialog-row">
            <label>Source</label>
            <input type="text" id="cgm-gossip-source" class="cgm-rep-dialog-input" placeholder="e.g. Tavern drunk, Street urchin..." maxlength="60">
          </div>
          <div class="cgm-rep-dialog-row">
            <label>Group Influenced</label>
            <input type="text" id="cgm-gossip-group" class="cgm-rep-dialog-input" placeholder="e.g. Townsfolk, Merchant Guild..." maxlength="60">
          </div>
          <div class="cgm-rep-dialog-row">
            <label>Score (0 to -4)</label>
            <div class="cgm-rep-dialog-score-wrap">
              <button class="cgm-rep-dialog-score-btn" data-gossip-dialog-minus><i class="fas fa-minus"></i></button>
              <input type="number" id="cgm-gossip-score" class="cgm-rep-dialog-score-input" value="0" min="-4" max="0" readonly>
              <button class="cgm-rep-dialog-score-btn" data-gossip-dialog-plus><i class="fas fa-plus"></i></button>
            </div>
          </div>
          <div class="cgm-rep-dialog-row">
            <label>Description <span class="cgm-rep-dialog-char-count">0 / 1000</span></label>
            <textarea id="cgm-gossip-desc" class="cgm-rep-dialog-textarea" placeholder="Enter gossip details..." maxlength="1000" rows="4"></textarea>
          </div>
          <div class="cgm-rep-dialog-row">
            <label class="cgm-gossip-known-label">
              <input type="checkbox" id="cgm-gossip-known" checked>
              <span>Known to actor (visible to player)</span>
            </label>
          </div>
        </div>
        <div class="cgm-rep-dialog-footer">
          <button class="cgm-rep-dialog-btn cgm-rep-dialog-btn-secondary" data-gossip-dialog-cancel>
            <i class="fas fa-xmark"></i> Cancel
          </button>
          <button class="cgm-rep-dialog-btn cgm-rep-dialog-btn-primary" data-gossip-dialog-add>
            <i class="fas fa-plus"></i> Add Gossip
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);
    requestAnimationFrame(() => overlay.classList.add("cgm-rep-dialog-visible"));

    const nameInput = overlay.querySelector("#cgm-gossip-name");
    const scoreInput = overlay.querySelector("#cgm-gossip-score");
    const descInput = overlay.querySelector("#cgm-gossip-desc");
    const charCount = overlay.querySelector(".cgm-rep-dialog-char-count");

    setTimeout(() => nameInput?.focus(), 50);

    descInput?.addEventListener("input", () => {
      if (charCount) charCount.textContent = `${descInput.value.length} / 1000`;
    });

    overlay.querySelector("[data-gossip-dialog-minus]")?.addEventListener("click", () => {
      const val = parseInt(scoreInput.value, 10) || 0;
      scoreInput.value = Math.max(-4, val - 1);
    });
    overlay.querySelector("[data-gossip-dialog-plus]")?.addEventListener("click", () => {
      const val = parseInt(scoreInput.value, 10) || 0;
      scoreInput.value = Math.min(0, val + 1);
    });

    const closeDialog = () => {
      overlay.classList.remove("cgm-rep-dialog-visible");
      setTimeout(() => overlay.remove(), 250);
    };

    overlay.querySelector("[data-gossip-dialog-close]")?.addEventListener("click", closeDialog);
    overlay.querySelector("[data-gossip-dialog-cancel]")?.addEventListener("click", closeDialog);
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) closeDialog();
    });

    overlay.querySelector("[data-gossip-dialog-add]")?.addEventListener("click", async () => {
      const targetActorId = overlay.querySelector("#cgm-gossip-actor")?.value || actorId;
      const name = nameInput?.value.trim();
      const source = overlay.querySelector("#cgm-gossip-source")?.value.trim() || "";
      const group = overlay.querySelector("#cgm-gossip-group")?.value.trim() || "";
      const score = parseInt(scoreInput?.value, 10) || 0;
      const description = descInput?.value.trim() || "";
      const known = overlay.querySelector("#cgm-gossip-known")?.checked ?? true;
      if (!name || !targetActorId) {
        ui.notifications.warn("Please enter a gossip name.");
        return;
      }
      closeDialog();
      await this._addGossip(targetActorId, name, source, group, Math.max(-4, Math.min(0, score)), description, known);
    });
  }

  async _addGossip(actorId, name, source, group, score, description, known) {
    const actor = game.actors.get(actorId);
    if (!actor) return;
    const gossips = foundry.utils.deepClone(actor.getFlag("cypher-gm-taskbar", "gossips") || []);
    gossips.push({
      id: foundry.utils.randomID(),
      name,
      source: source || "Unknown",
      group: group || "",
      score: Math.max(-4, Math.min(0, score)),
      description: description.substring(0, 1000),
      known: known !== false
    });
    await actor.setFlag("cypher-gm-taskbar", "gossips", gossips);
    this._refreshReputationPanel();
    ui.notifications.info(`Gossip "${name}" added to ${actor.name}.`);
  }

  async _deleteGossip(actorId, gossipId) {
    const actor = game.actors.get(actorId);
    if (!actor) return;
    const gossips = foundry.utils.deepClone(actor.getFlag("cypher-gm-taskbar", "gossips") || []);
    const idx = gossips.findIndex(g => g.id === gossipId);
    if (idx >= 0) {
      const name = gossips[idx].name;
      gossips.splice(idx, 1);
      await actor.setFlag("cypher-gm-taskbar", "gossips", gossips);
      this._refreshReputationPanel();
      ui.notifications.info(`Gossip "${name}" removed from ${actor.name}.`);
    }
  }

  async _changeGossipScore(actorId, gossipId, delta) {
    const actor = game.actors.get(actorId);
    if (!actor) return;
    const gossips = foundry.utils.deepClone(actor.getFlag("cypher-gm-taskbar", "gossips") || []);
    const gossip = gossips.find(g => g.id === gossipId);
    if (!gossip) return;
    const newScore = Math.max(-4, Math.min(0, gossip.score + delta));
    if (newScore === gossip.score) return;
    gossip.score = newScore;
    await actor.setFlag("cypher-gm-taskbar", "gossips", gossips);
    this._refreshReputationPanel();
  }

  async _toggleGossipKnown(actorId, gossipId) {
    const actor = game.actors.get(actorId);
    if (!actor) return;
    const gossips = foundry.utils.deepClone(actor.getFlag("cypher-gm-taskbar", "gossips") || []);
    const gossip = gossips.find(g => g.id === gossipId);
    if (!gossip) return;
    gossip.known = !gossip.known;
    await actor.setFlag("cypher-gm-taskbar", "gossips", gossips);
    this._refreshReputationPanel();
    const status = gossip.known ? "known" : "unknown";
    ui.notifications.info(`Gossip "${gossip.name}" is now ${status} to ${actor.name}.`);
  }

  async _doOneRecoveryAll() {
    const pcs = this._getPartyData().map(pc => game.actors.get(pc.id)).filter(a => a);
    if (!pcs.length) {
      ui.notifications.warn("No active actors found for recovery.");
      return;
    }

    let recoveredCount = 0;
    const recoveredActors = [];

    for (const actor of pcs) {
      const sys = actor.system ?? {};
      let rolls = null;
      let rollsPath = null;

      if (Array.isArray(sys.combat?.recoveries?.recoveryRolls)) {
        rolls = [...sys.combat.recoveries.recoveryRolls];
        rollsPath = "system.combat.recoveries.recoveryRolls";
      } else if (Array.isArray(sys.recoveries?.recoveryRolls)) {
        rolls = [...sys.recoveries.recoveryRolls];
        rollsPath = "system.recoveries.recoveryRolls";
      } else if (Array.isArray(sys.combat?.recoveryRolls)) {
        rolls = [...sys.combat.recoveryRolls];
        rollsPath = "system.combat.recoveryRolls";
      }

      let recovered = false;
      let recoveredName = "";

      if (rolls) {
        // Check in order: 10 Hours (3) → 1 Hour (2) → 10 Minutes (1) → 1 Action (0)
        const checkOrder = [
          { idx: 3, name: "10 Hours" },
          { idx: 2, name: "1 Hour" },
          { idx: 1, name: "10 Minutes" },
          { idx: 0, name: "1 Action" },
        ];
        for (const check of checkOrder) {
          if (!rolls[check.idx]) {
            rolls[check.idx] = true;
            recovered = true;
            recoveredName = check.name;
            break;
          }
        }
        if (recovered) {
          await actor.update({ [rollsPath]: rolls });
        }
      } else {
        // Legacy individual flags
        const rec = sys.combat?.recoveries || {};
        const checkList = [
          { key: "tenHours", name: "10 Hours" },
          { key: "oneHour", name: "1 Hour" },
          { key: "tenMinutes", name: "10 Minutes" },
          { key: "tenMinutes2", name: "10 Minutes" },
          { key: "oneAction", name: "1 Action" },
          { key: "oneAction2", name: "1 Action" },
          { key: "oneAction3", name: "1 Action" },
          { key: "oneAction4", name: "1 Action" },
          { key: "oneAction5", name: "1 Action" },
          { key: "oneAction6", name: "1 Action" },
          { key: "oneAction7", name: "1 Action" },
        ];
        for (const item of checkList) {
          if (rec[item.key]) {
            await actor.update({ [`system.combat.recoveries.${item.key}`]: false });
            recovered = true;
            recoveredName = item.name;
            break;
          }
        }
      }

      if (recovered) {
        recoveredCount++;
        recoveredActors.push(`${actor.name} — ${recoveredName}`);
      }
    }

    if (recoveredCount > 0) {
      await ChatMessage.create({
        speaker: { alias: "GM Recovery" },
        content: `<div style="padding:8px 12px;background:rgba(59,130,246,0.1);border:1px solid rgba(59,130,246,0.3);border-radius:6px;">
          <strong style="color:#3b82f6;">💧 ONE Recovery Applied</strong><br>
          <span style="color:#ccc;">${recoveredActors.join("<br>")}</span>
        </div>`
      });
      ui.notifications.info(`ONE recovery applied to ${recoveredCount} actor(s).`);
    } else {
      ui.notifications.info("All actors already have full recovery rolls.");
    }
  }

  async _doFullRecoveryAll() {
    const pcs = this._getPartyData().map(pc => game.actors.get(pc.id)).filter(a => a);
    if (!pcs.length) {
      ui.notifications.warn("No active actors found for recovery.");
      return;
    }

    let recoveredCount = 0;

    for (const actor of pcs) {
      const updateData = {
        "system.combat.recoveries.oneAction": false,
        "system.combat.recoveries.oneAction2": false,
        "system.combat.recoveries.oneAction3": false,
        "system.combat.recoveries.oneAction4": false,
        "system.combat.recoveries.oneAction5": false,
        "system.combat.recoveries.oneAction6": false,
        "system.combat.recoveries.oneAction7": false,
        "system.combat.recoveries.tenMinutes": false,
        "system.combat.recoveries.tenMinutes2": false,
        "system.combat.recoveries.oneHour": false,
        "system.combat.recoveries.tenHours": false,
      };

      if (Array.isArray(actor.system?.combat?.recoveries?.recoveryRolls)) {
        updateData["system.combat.recoveries.recoveryRolls"] = [true, true, true, true];
      } else if (Array.isArray(actor.system?.recoveries?.recoveryRolls)) {
        updateData["system.recoveries.recoveryRolls"] = [true, true, true, true];
      } else if (Array.isArray(actor.system?.combat?.recoveryRolls)) {
        updateData["system.combat.recoveryRolls"] = [true, true, true, true];
      }

      await actor.update(updateData);
      recoveredCount++;
    }

    await ChatMessage.create({
      speaker: { alias: "GM Recovery" },
      content: `<div style="padding:8px 12px;background:rgba(59,130,246,0.1);border:1px solid rgba(59,130,246,0.3);border-radius:6px;">
        <strong style="color:#3b82f6;">💧 FULL Rest Applied</strong><br>
        <span style="color:#ccc;">All recovery rolls restored for ${recoveredCount} actor(s).</span>
      </div>`
    });
    ui.notifications.info(`FULL rest applied to ${recoveredCount} actor(s).`);
  }

  _showGMGroupRollAttributes(btnEl) {
    this._hideGMGroupRollAttributes();
    const items = [
      { key: "might", label: "Might", icon: "fa-hand-fist", color: "#e74c3c" },
      { key: "speed", label: "Speed", icon: "fa-bolt", color: "#f1c40f" },
      { key: "intellect", label: "Intellect", icon: "fa-brain", color: "#9b59b6" },
    ];
    this._buildGMGroupSubMenu(btnEl, items, "attributes", (key) => {
      this._sendGroupRollRequest("attribute", key);
    });
  }

  _hideGMGroupRollAttributes() {
    if (this._gmGroupRollAttributesEl) {
      this._cleanupGMGroupRollAttributesDrag?.();
      this._cleanupGMGroupRollAttributesDrag = null;
      this._removeGMGroupRollLine("cgm-gmroll-line-attributes");
      this._gmGroupRollAttributesEl.classList.remove("cgm-radial-visible");
      setTimeout(() => { this._gmGroupRollAttributesEl?.remove(); this._gmGroupRollAttributesEl = null; }, 200);
    }
  }

  _showGMGroupRollSkills(btnEl) {
    this._hideGMGroupRollSkills();
    const items = [
      { key: "perception", label: "Perception", icon: "fa-eye", color: "#3498db" },
      { key: "investigation", label: "Investigation", icon: "fa-magnifying-glass", color: "#2980b9" },
      { key: "stealth", label: "Stealth", icon: "fa-mask", color: "#2c3e50" },
      { key: "persuasion", label: "Persuasion", icon: "fa-comments", color: "#e67e22" },
      { key: "athletics", label: "Athletics", icon: "fa-person-running", color: "#27ae60" },
    ];
    this._buildGMGroupSubMenu(btnEl, items, "skills", (key) => {
      this._sendGroupRollRequest("skill", key);
    });
  }

  _hideGMGroupRollSkills() {
    if (this._gmGroupRollSkillsEl) {
      this._cleanupGMGroupRollSkillsDrag?.();
      this._cleanupGMGroupRollSkillsDrag = null;
      this._removeGMGroupRollLine("cgm-gmroll-line-skills");
      this._gmGroupRollSkillsEl.classList.remove("cgm-radial-visible");
      setTimeout(() => { this._gmGroupRollSkillsEl?.remove(); this._gmGroupRollSkillsEl = null; }, 200);
    }
  }

  _showGMGroupRollFree(btnEl) {
    this._hideGMGroupRollFree();
    const items = [
      { key: "d20", label: "d20", icon: "fa-dice-d20", color: "#e74c3c" },
      { key: "d100", label: "d100", icon: "fa-dice", color: "#9b59b6" },
      { key: "d6", label: "d6", icon: "fa-dice-one", color: "#3498db" },
    ];
    this._buildGMGroupSubMenu(btnEl, items, "free", (key) => {
      this._sendGroupRollRequest("free", key);
    });
  }

  _hideGMGroupRollFree() {
    if (this._gmGroupRollFreeEl) {
      this._cleanupGMGroupRollFreeDrag?.();
      this._cleanupGMGroupRollFreeDrag = null;
      this._removeGMGroupRollLine("cgm-gmroll-line-free");
      this._gmGroupRollFreeEl.classList.remove("cgm-radial-visible");
      setTimeout(() => { this._gmGroupRollFreeEl?.remove(); this._gmGroupRollFreeEl = null; }, 200);
    }
  }

  _showGMGroupRollDefense(btnEl) {
    this._hideGMGroupRollDefense();
    const items = [
      { key: "might", label: "Might Defense", icon: "fa-shield-halved", color: "#e74c3c" },
      { key: "speed", label: "Speed Defense", icon: "fa-shield-halved", color: "#f1c40f" },
      { key: "intellect", label: "Intellect Defense", icon: "fa-shield-halved", color: "#9b59b6" },
    ];
    this._buildGMGroupSubMenu(btnEl, items, "defense", (key) => {
      this._sendGroupRollRequest("defense", key);
    });
  }

  _hideGMGroupRollDefense() {
    if (this._gmGroupRollDefenseEl) {
      this._cleanupGMGroupRollDefenseDrag?.();
      this._cleanupGMGroupRollDefenseDrag = null;
      this._removeGMGroupRollLine("cgm-gmroll-line-defense");
      this._gmGroupRollDefenseEl.classList.remove("cgm-radial-visible");
      setTimeout(() => { this._gmGroupRollDefenseEl?.remove(); this._gmGroupRollDefenseEl = null; }, 200);
    }
  }

  _buildGMGroupSubMenu(btnEl, items, type, onSelect) {
    const size = 140;
    const half = size / 2;
    const outerR = half - 6;
    const innerR = outerR * 0.38;
    const gap = 2;
    const segCount = items.length;

    let svgPaths = "";
    items.forEach((item, i) => {
      const startAngle = i * (360 / segCount) + gap / 2;
      const endAngle = (i + 1) * (360 / segCount) - gap / 2;
      const d = this._pieWedgePath(startAngle, endAngle, innerR, outerR);
      svgPaths += `<path class="cgm-pie-seg" data-key="${item.key}" d="${d}" />`;
    });

    let labelsHtml = "";
    items.forEach((item, i) => {
      const midAngle = (i * (360 / segCount) + ((i + 1) * (360 / segCount))) / 2;
      const rad = (midAngle - 90) * Math.PI / 180;
      const labelR = (innerR + outerR) / 2;
      const lx = Math.cos(rad) * labelR + half;
      const ly = Math.sin(rad) * labelR + half;
      // Split multi-word labels into stacked lines
      const words = item.label.split(" ");
      const labelText = words.length > 1 
        ? words.map(w => `<span class="cgm-gmroll-sub-word">${w}</span>`).join("") 
        : `<span class="cgm-gmroll-sub-word">${item.label}</span>`;
      labelsHtml += `
        <div class="cgm-pie-label cgm-gmroll-sub-label" data-key="${item.key}" style="left:${lx.toFixed(1)}px;top:${ly.toFixed(1)}px;">
          <i class="fas ${item.icon}"></i>
          <span class="cgm-gmroll-sub-text">${labelText}</span>
        </div>
      `;
    });

    const menu = document.createElement("div");
    menu.className = "cgm-radial-menu";
    menu.style.width = `${size}px`;
    menu.style.height = `${size}px`;

    // Position — check saved position first
    const savedPos = this._loadMenuPosition(`gmGroupRoll_${type}`);
    if (savedPos) {
      menu.style.left = `${Math.max(0, Math.min(savedPos.left, window.innerWidth - size))}px`;
      menu.style.top = `${Math.max(0, Math.min(savedPos.top, window.innerHeight - size))}px`;
    } else {
      const rect = btnEl.getBoundingClientRect();
      if (!rect || rect.width === 0 || rect.height === 0) {
        console.warn("Cypher GM Taskbar: GM Group Roll sub button rect is empty");
        return;
      }
      const btnCx = rect.left + rect.width / 2;
      const btnCy = rect.top + rect.height / 2;
      const spaceAbove = btnCy - size / 2;
      const spaceBelow = window.innerHeight - btnCy - size / 2;
      let menuLeft = btnCx - half;
      let menuTop;
      if (spaceAbove >= size + 10 && spaceAbove >= spaceBelow) {
        menuTop = rect.top - size - 10;
      } else if (spaceBelow >= size + 10) {
        menuTop = rect.bottom + 10;
      } else if (spaceAbove >= size + 10) {
        menuTop = rect.top - size - 10;
      } else {
        menuTop = (window.innerHeight - size) / 2;
      }
      menuLeft = Math.max(8, Math.min(menuLeft, window.innerWidth - size - 8));
      menuTop = Math.max(8, Math.min(menuTop, window.innerHeight - size - 8));
      menu.style.left = `${menuLeft}px`;
      menu.style.top = `${menuTop}px`;
    }

    menu.innerHTML = `
      <svg class="cgm-pie-svg" viewBox="-${half} -${half} ${size} ${size}" width="${size}" height="${size}">
        <defs>
          <radialGradient id="cgm-pie-bg" cx="0" cy="0" r="${outerR}">
            <stop offset="0%" stop-color="rgba(20,22,35,0.3)" />
            <stop offset="100%" stop-color="rgba(15,17,30,0.95)" />
          </radialGradient>
        </defs>
        <circle cx="0" cy="0" r="${outerR}" fill="url(#cgm-pie-bg)" stroke="rgba(200,169,110,0.15)" stroke-width="1" />
        ${svgPaths}
        <circle cx="0" cy="0" r="${innerR - 2}" fill="rgba(15,17,30,0.98)" stroke="rgba(200,169,110,0.3)" stroke-width="1.5" />
      </svg>
      ${labelsHtml}
      <div class="cgm-gmroll-back" data-action="backToMain" title="Back to main menu">
        <i class="fas fa-arrow-left"></i>
      </div>
    `;

    document.body.appendChild(menu);
    const propName = `_gmGroupRoll${type.charAt(0).toUpperCase() + type.slice(1)}El`;
    this[propName] = menu;
    requestAnimationFrame(() => menu.classList.add("cgm-radial-visible"));

    // Draw line from main menu to submenu
    const mainMenu = this._gmGroupRollMenuEl;
    if (mainMenu) {
      const mainRect = mainMenu.getBoundingClientRect();
      const menuRect = menu.getBoundingClientRect();
      this._createGMGroupRollLine(`cgm-gmroll-line-${type}`, mainRect.left + mainRect.width / 2, mainRect.top + mainRect.height / 2, menuRect.left + menuRect.width / 2, menuRect.top + menuRect.height / 2);
    }

    // Make draggable
    const cleanupDrag = this._makeMenuDraggable(menu, `gmGroupRoll_${type}`);
    const cleanupProp = `_cleanupGMGroupRoll${type.charAt(0).toUpperCase() + type.slice(1)}Drag`;
    this[cleanupProp] = cleanupDrag;

    // Back arrow click
    const backBtn = menu.querySelector(".cgm-gmroll-back");
    if (backBtn) {
      backBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        this[`_hideGMGroupRoll${type.charAt(0).toUpperCase() + type.slice(1)}`]();
        this._showGMGroupRollMenu(btnEl);
      });
    }

    const segs = menu.querySelectorAll(".cgm-pie-seg");
    const lbls = menu.querySelectorAll(".cgm-pie-label");

    // Click handlers
    const onItemClick = (e) => {
      e.stopPropagation();
      const key = e.currentTarget.dataset.key;
      this[`_hideGMGroupRoll${type.charAt(0).toUpperCase() + type.slice(1)}`]();
      this._hideGMGroupRollMenu(); // Close main menu too
      if (key) onSelect(key);
    };
    segs.forEach(seg => seg.addEventListener("click", onItemClick));
    lbls.forEach(lbl => lbl.addEventListener("click", onItemClick));

    // Hover sync — same as portrait menu
    segs.forEach(seg => {
      const key = seg.dataset.key;
      const label = menu.querySelector(`.cgm-pie-label[data-key="${key}"]`);
      seg.addEventListener("mouseenter", () => label?.classList.add("cgm-pie-label-active"));
      seg.addEventListener("mouseleave", () => label?.classList.remove("cgm-pie-label-active"));
    });
    lbls.forEach(lbl => {
      const key = lbl.dataset.key;
      const seg = menu.querySelector(`.cgm-pie-seg[data-key="${key}"]`);
      lbl.addEventListener("mouseenter", () => seg?.classList.add("cgm-pie-seg-hover"));
      lbl.addEventListener("mouseleave", () => seg?.classList.remove("cgm-pie-seg-hover"));
    });

    const closeHandler = (e) => {
      if (!menu.contains(e.target) && !this._gmGroupRollMenuEl?.contains(e.target) && e.target !== btnEl && !e.target.closest('.dialog, .window-app, .application, .file-picker')) {
        this[`_hideGMGroupRoll${type.charAt(0).toUpperCase() + type.slice(1)}`]();
        this._hideGMGroupRollMenu(); // Close main menu too
        document.removeEventListener("click", closeHandler);
      }
    };
    setTimeout(() => document.addEventListener("click", closeHandler), 10);
  }

  _sendGroupRollRequest(type, subtype) {
    const pcs = game.actors.filter(a => a.type === "pc" && a.hasPlayerOwner);
    const names = pcs.map(a => a.name).join(", ");
    const typeLabels = {
      attribute: { might: "Might", speed: "Speed", intellect: "Intellect" },
      skill: { perception: "Perception", investigation: "Investigation", stealth: "Stealth", persuasion: "Persuasion", athletics: "Athletics" },
      free: { d20: "d20", d100: "d100", d6: "d6" },
      defense: { might: "Might Defense", speed: "Speed Defense", intellect: "Intellect Defense" },
    };
    const label = typeLabels[type]?.[subtype] || subtype;
    ui.notifications.info(`<b>GM Group Roll Request</b>: ${label}<br>Requested from: ${names || "No players connected"}`);

    // Send socket message to all players
    if (game.socket) {
      game.socket.emit("module.cypher-gm-taskbar", {
        action: "groupRollRequest",
        type,
        subtype,
        difficulty: this._globalDifficulty,
        gmId: game.user.id,
      });
    }
  }

  /* ─── GM Group Roll Lines ─── */

  _createGMGroupRollLine(id, x1, y1, x2, y2) {
    let svg = document.getElementById(id);
    if (!svg) {
      svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      svg.id = id;
      svg.style.cssText = "position:fixed;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:150;";
      document.body.appendChild(svg);
    }
    svg.innerHTML = `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="rgba(200,169,110,0.5)" stroke-width="2" stroke-dasharray="4,3" />`;
  }

  _removeGMGroupRollLine(id) {
    const el = document.getElementById(id);
    if (el) el.remove();
  }

  _removeAllGMGroupRollLines() {
    ["cgm-gmroll-line-main", "cgm-gmroll-line-attributes", "cgm-gmroll-line-skills", "cgm-gmroll-line-free", "cgm-gmroll-line-defense"].forEach(id => this._removeGMGroupRollLine(id));
  }

  /* ─── Menu Drag & Drop ─── */

  _loadMenuPosition(key) {
    try {
      const raw = game.settings.get(MODULE_ID, "menuPositions");
      const data = JSON.parse(raw || "{}");
      return data[key] || null;
    } catch {
      return null;
    }
  }

  _saveMenuPosition(key, left, top) {
    try {
      const raw = game.settings.get(MODULE_ID, "menuPositions");
      const data = JSON.parse(raw || "{}");
      data[key] = { left, top };
      game.settings.set(MODULE_ID, "menuPositions", JSON.stringify(data)).catch(() => {});
    } catch {
      // ignore
    }
  }

  _makeMenuDraggable(menu, settingKey, handleSelector = null) {
    let isDragging = false;
    let startX = 0, startY = 0, startLeft = 0, startTop = 0;
    let hasMoved = false;

    const dragTarget = handleSelector ? menu.querySelector(handleSelector) || menu : menu;

    const onPointerDown = (e) => {
      // Don't drag if clicking on interactive elements (segments, labels, back arrow, or adjuster buttons)
      if (e.target.closest(".cgm-pie-seg, .cgm-pie-label, .cgm-gmroll-back, .cgm-pools-adj-btn, .cgm-gstatus-confirm-btn, .cgm-gm-menu-item, .cgm-gm-winmenu-vbtn")) return;
      isDragging = true;
      hasMoved = false;
      startX = e.clientX;
      startY = e.clientY;
      startLeft = parseFloat(menu.style.left) || 0;
      startTop = parseFloat(menu.style.top) || 0;
      menu.classList.add("cgm-menu-dragging");
      menu.setPointerCapture?.(e.pointerId);
      e.preventDefault();
    };

    const onPointerMove = (e) => {
      if (!isDragging) return;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      if (Math.abs(dx) > 2 || Math.abs(dy) > 2) hasMoved = true;
      menu.style.left = `${Math.max(0, Math.min(startLeft + dx, window.innerWidth - menu.offsetWidth))}px`;
      menu.style.top = `${Math.max(0, Math.min(startTop + dy, window.innerHeight - menu.offsetHeight))}px`;
    };

    const onPointerUp = (e) => {
      if (!isDragging) return;
      isDragging = false;
      menu.classList.remove("cgm-menu-dragging");
      menu.releasePointerCapture?.(e.pointerId);
      if (hasMoved && settingKey) {
        this._saveMenuPosition(settingKey, parseFloat(menu.style.left), parseFloat(menu.style.top));
      }
    };

    dragTarget.addEventListener("pointerdown", onPointerDown);
    menu.addEventListener("pointermove", onPointerMove);
    menu.addEventListener("pointerup", onPointerUp);
    menu.addEventListener("pointercancel", onPointerUp);

    // Return cleanup function
    return () => {
      dragTarget.removeEventListener("pointerdown", onPointerDown);
      menu.removeEventListener("pointermove", onPointerMove);
      menu.removeEventListener("pointerup", onPointerUp);
      menu.removeEventListener("pointercancel", onPointerUp);
    };
  }

  /* ─── Pools Submenu ─── */

  _showPoolsRadialMenu(actorId, wrapEl) {
    this._hidePoolsMenu();
    this._hideStatusMenu();

    const actor = game.actors.get(actorId);
    if (!actor) return;

    // Store for later use
    this._poolsActorId = actorId;
    this._poolsWrapEl = wrapEl;

    const size = this._radialMenuSize;
    const offset = this._radialMenuOffset;
    const rect = wrapEl.getBoundingClientRect();
    const portraitCx = rect.left + rect.width / 2;
    const portraitCy = rect.top + rect.height / 2;

    // Edge detection for main menu center (same as radial menu)
    const spaceAbove = portraitCy - size / 2;
    const spaceBelow = window.innerHeight - portraitCy - size / 2;
    let mainCy;
    if (spaceAbove >= size + offset && spaceAbove >= spaceBelow) {
      mainCy = rect.top - offset - size / 2;
    } else if (spaceBelow >= size + offset) {
      mainCy = rect.bottom + offset + size / 2;
    } else if (spaceAbove >= size + offset) {
      mainCy = rect.top - offset - size / 2;
    } else {
      mainCy = window.innerHeight / 2;
    }
    const mainCx = portraitCx;
    const mainR = size / 2;

    // Clamp to viewport
    const clampedCx = Math.max(mainR + 8, Math.min(mainCx, window.innerWidth - mainR - 8));
    const clampedCy = Math.max(mainR + 8, Math.min(mainCy, window.innerHeight - mainR - 8));

    // POOLS slice is index 6 in 9-segment menu
    const poolsIndex = 6;
    const poolsAngle = (poolsIndex + 0.5) * (360 / 9);
    const poolsRad = (poolsAngle - 90) * Math.PI / 180;

    // Line extends from outer edge of main menu
    const lineStartR = mainR - 4;
    const lineLength = 90;
    const lineEndR = lineStartR + lineLength;

    const startX = clampedCx + Math.cos(poolsRad) * lineStartR;
    const startY = clampedCy + Math.sin(poolsRad) * lineStartR;
    let endX = clampedCx + Math.cos(poolsRad) * lineEndR;
    let endY = clampedCy + Math.sin(poolsRad) * lineEndR;

    // Submenu size
    const subSize = 160;
    const subHalf = subSize / 2;

    // Clamp submenu endpoint to viewport
    endX = Math.max(subHalf + 8, Math.min(endX, window.innerWidth - subHalf - 8));
    endY = Math.max(subHalf + 8, Math.min(endY, window.innerHeight - subHalf - 8));

    // ── Create connecting line ──
    const lineContainer = document.createElement("div");
    lineContainer.className = "cgm-status-line-container";
    lineContainer.style.cssText = `position:fixed;left:0;top:0;width:100%;height:100%;z-index:201;pointer-events:none;`;

    const svgNS = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(svgNS, "svg");
    svg.setAttribute("class", "cgm-status-line-svg");
    svg.style.cssText = `position:absolute;left:0;top:0;width:100%;height:100%;overflow:visible;`;

    const line = document.createElementNS(svgNS, "line");
    line.setAttribute("x1", startX);
    line.setAttribute("y1", startY);
    line.setAttribute("x2", endX);
    line.setAttribute("y2", endY);
    line.setAttribute("class", "cgm-status-line");
    line.setAttribute("stroke", "rgba(58,143,212,0.7)");
    svg.appendChild(line);

    const glowLine = document.createElementNS(svgNS, "line");
    glowLine.setAttribute("x1", startX);
    glowLine.setAttribute("y1", startY);
    glowLine.setAttribute("x2", endX);
    glowLine.setAttribute("y2", endY);
    glowLine.setAttribute("class", "cgm-status-line-glow");
    glowLine.setAttribute("stroke", "rgba(58,143,212,0.3)");
    svg.appendChild(glowLine);

    lineContainer.appendChild(svg);
    document.body.appendChild(lineContainer);
    this._connectingLineEl = lineContainer;

    requestAnimationFrame(() => {
      lineContainer.classList.add("cgm-status-line-visible");
    });

    // ── Create submenu at end of line ──
    const poolData = this._getPoolData(actor);
    const subMenu = document.createElement("div");
    subMenu.className = "cgm-pools-submenu";
    subMenu.style.cssText = `position:fixed;left:${endX - subHalf}px;top:${endY - subHalf}px;width:${subSize}px;height:${subSize}px;z-index:202;`;

    // 3 slices: Might, Speed, Intellect
    const pools = [
      { key: "might",     icon: "fa-dumbbell", label: "Might",     cls: "might",     color: "#cc4444" },
      { key: "speed",     icon: "fa-bolt",     label: "Speed",     cls: "speed",     color: "#44aa44" },
      { key: "intellect", icon: "fa-brain",    label: "Intellect", cls: "intellect", color: "#4488cc" },
    ];

    const segCount = 3;
    const gap = 2;
    const outerR = subHalf - 4;
    const innerR = 28;

    let svgPaths = "";
    let labelsHtml = "";
    let adjustersHtml = "";

    pools.forEach((seg, i) => {
      const startAngle = i * (360 / segCount) + gap / 2;
      const endAngle = (i + 1) * (360 / segCount) - gap / 2;
      const d = this._pieWedgePath(startAngle, endAngle, innerR, outerR);
      svgPaths += `<path class="cgm-sub-seg cgm-sub-seg-${seg.cls}" data-pool="${seg.key}" d="${d}" />`;

      // Label at outer edge
      const midAngle = (startAngle + endAngle) / 2;
      const midRad = (midAngle - 90) * Math.PI / 180;
      const labelR = outerR * 0.85;
      const lx = Math.cos(midRad) * labelR + subHalf;
      const ly = Math.sin(midRad) * labelR + subHalf;
      labelsHtml += `
        <div class="cgm-sub-label cgm-sub-label-${seg.cls}" data-pool="${seg.key}"
             style="left:${lx.toFixed(1)}px;top:${ly.toFixed(1)}px;color:${seg.color};">
          <i class="fas ${seg.icon}"></i>
        </div>
      `;

      // Adjuster: Name above value, then +/- buttons
      const adjR = (innerR + outerR) * 0.5;
      const ax = Math.cos(midRad) * adjR + subHalf;
      const ay = Math.sin(midRad) * adjR + subHalf;
      const data = poolData[seg.key] || { value: 0, max: 0 };
      adjustersHtml += `
        <div class="cgm-pools-adjuster cgm-pools-adjuster-${seg.cls}" data-pool="${seg.key}"
             style="left:${ax.toFixed(1)}px;top:${ay.toFixed(1)}px;">
          <div class="cgm-pools-adj-name" style="color:${seg.color};">${seg.label}</div>
          <div class="cgm-pools-adj-value">${data.value}</div>
          <div class="cgm-pools-adj-edge">Edge: ${data.edge}</div>
          <div class="cgm-pools-adj-controls">
            <button class="cgm-pools-adj-btn" data-pool="${seg.key}" data-delta="-1">−</button>
            <button class="cgm-pools-adj-btn" data-pool="${seg.key}" data-delta="+1">+</button>
          </div>
        </div>
      `;
    });

    const centerBtn = `<div class="cgm-sub-center-btn cgm-pools-back-btn"><i class="fas fa-arrow-left"></i></div>`;

    subMenu.innerHTML = `
      <svg class="cgm-sub-svg" viewBox="-${subHalf} -${subHalf} ${subSize} ${subSize}" width="${subSize}" height="${subSize}">
        <defs>
          <radialGradient id="cgm-pools-sub-bg" cx="0" cy="0" r="${outerR}">
            <stop offset="0%" stop-color="rgba(20,30,50,0.3)" />
            <stop offset="100%" stop-color="rgba(14,11,22,0.95)" />
          </radialGradient>
        </defs>
        <circle cx="0" cy="0" r="${outerR}" fill="url(#cgm-pools-sub-bg)" stroke="rgba(58,143,212,0.15)" stroke-width="1" />
        ${svgPaths}
        <circle cx="0" cy="0" r="${innerR - 2}" fill="rgba(14,11,22,0.98)" stroke="rgba(58,143,212,0.3)" stroke-width="1.5" />
      </svg>
      ${labelsHtml}
      ${adjustersHtml}
      ${centerBtn}
    `;

    document.body.appendChild(subMenu);
    this._poolsMenuEl = subMenu;

    requestAnimationFrame(() => subMenu.classList.add("cgm-pools-visible"));

    // ── Handlers ──
    const adjustPool = async (poolKey, delta) => {
      const a = game.actors.get(actorId);
      if (!a) return;
      const path = this._getPoolPath(a, poolKey);
      if (!path) return;
      const current = Number(foundry.utils.getProperty(a, path) ?? 0);
      const maxPath = this._getPoolMaxPath(a, poolKey);
      const max = maxPath ? Number(foundry.utils.getProperty(a, maxPath) ?? 0) : 999;
      const newVal = Math.max(0, Math.min(max, current + delta));
      if (newVal === current) return;
      await a.update({ [path]: newVal });
      ui.notifications.info(`${a.name} ${poolKey} pool: ${current} → ${newVal}`);
      const valEl = subMenu.querySelector(`.cgm-pools-adjuster[data-pool="${poolKey}"] .cgm-pools-adj-value`);
      if (valEl) valEl.textContent = newVal;
    };

    subMenu.querySelectorAll(".cgm-pools-adj-btn").forEach(btn => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        adjustPool(btn.dataset.pool, parseInt(btn.dataset.delta, 10));
      });
    });

    // Back button
    const backBtn = subMenu.querySelector(".cgm-pools-back-btn");
    if (backBtn) {
      backBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        this._hidePoolsMenu();
      });
    }

    // Click outside to close
    const closeHandler = (e) => {
      if (!subMenu.contains(e.target) && !this._connectingLineEl?.contains(e.target) && !e.target.closest('.dialog, .window-app, .application, .file-picker')) {
        this._hidePoolsMenu();
        document.removeEventListener("click", closeHandler);
      }
    };
    setTimeout(() => document.addEventListener("click", closeHandler), 10);
  }

  _hidePoolsMenu() {
    if (this._poolsMenuEl) {
      this._poolsMenuEl.classList.remove("cgm-pools-visible");
      setTimeout(() => { this._poolsMenuEl?.remove(); this._poolsMenuEl = null; }, 200);
    }
    if (this._connectingLineEl) {
      this._connectingLineEl.remove();
      this._connectingLineEl = null;
    }
    this._poolsActorId = null;
    this._poolsWrapEl = null;
  }

  /* ─── Status Submenu ─── */

  _showStatusRadialMenu(actorId, wrapEl) {
    this._hidePoolsMenu();
    this._hideStatusMenu();

    const actor = game.actors.get(actorId);
    if (!actor) return;

    // Store for later use in submenus
    this._statusActorId = actorId;
    this._statusWrapEl = wrapEl;

    // Calculate main menu center from portrait wrapEl with edge detection
    const rect = wrapEl.getBoundingClientRect();
    const size = this._radialMenuSize;
    const offset = this._radialMenuOffset;
    const portraitCx = rect.left + rect.width / 2;
    const portraitCy = rect.top + rect.height / 2;

    // Same edge detection as main radial menu
    const spaceAbove = portraitCy - size / 2;
    const spaceBelow = window.innerHeight - portraitCy - size / 2;
    let mainCy;
    if (spaceAbove >= size + offset && spaceAbove >= spaceBelow) {
      mainCy = rect.top - offset - size / 2;
    } else if (spaceBelow >= size + offset) {
      mainCy = rect.bottom + offset + size / 2;
    } else if (spaceAbove >= size + offset) {
      mainCy = rect.top - offset - size / 2;
    } else {
      mainCy = window.innerHeight / 2;
    }
    const mainCx = portraitCx;
    const mainR = size / 2;

    // Clamp to viewport (same logic as radial menu)
    const clampedCx = Math.max(mainR + 8, Math.min(mainCx, window.innerWidth - mainR - 8));
    const clampedCy = Math.max(mainR + 8, Math.min(mainCy, window.innerHeight - mainR - 8));

    // STATUS slice is index 7 in 9-segment menu
    const statusIndex = 7;
    const statusAngle = (statusIndex + 0.5) * (360 / 9); // degrees, 0=top, clockwise
    const statusRad = (statusAngle - 90) * Math.PI / 180;

    // Line extends from outer edge of main menu
    const lineStartR = mainR - 4;
    const lineLength = 90;
    const lineEndR = lineStartR + lineLength;

    const startX = clampedCx + Math.cos(statusRad) * lineStartR;
    const startY = clampedCy + Math.sin(statusRad) * lineStartR;
    let endX = clampedCx + Math.cos(statusRad) * lineEndR;
    let endY = clampedCy + Math.sin(statusRad) * lineEndR;

    // Submenu size (needed for clamping)
    const subSize = 110;
    const subHalf = subSize / 2;

    // Clamp submenu endpoint to viewport so it stays on screen
    endX = Math.max(subHalf + 8, Math.min(endX, window.innerWidth - subHalf - 8));
    endY = Math.max(subHalf + 8, Math.min(endY, window.innerHeight - subHalf - 8));

    // ── Create connecting line ──
    const lineContainer = document.createElement("div");
    lineContainer.className = "cgm-status-line-container";
    lineContainer.style.cssText = `position:fixed;left:0;top:0;width:100%;height:100%;z-index:201;pointer-events:none;`;

    // SVG for the animated line
    const svgNS = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(svgNS, "svg");
    svg.setAttribute("class", "cgm-status-line-svg");
    svg.style.cssText = `position:absolute;left:0;top:0;width:100%;height:100%;overflow:visible;`;

    const line = document.createElementNS(svgNS, "line");
    line.setAttribute("x1", startX);
    line.setAttribute("y1", startY);
    line.setAttribute("x2", endX);
    line.setAttribute("y2", endY);
    line.setAttribute("class", "cgm-status-line");
    svg.appendChild(line);

    // Glow effect line
    const glowLine = document.createElementNS(svgNS, "line");
    glowLine.setAttribute("x1", startX);
    glowLine.setAttribute("y1", startY);
    glowLine.setAttribute("x2", endX);
    glowLine.setAttribute("y2", endY);
    glowLine.setAttribute("class", "cgm-status-line-glow");
    svg.appendChild(glowLine);

    lineContainer.appendChild(svg);
    document.body.appendChild(lineContainer);
    this._connectingLineEl = lineContainer;

    // Animate line drawing
    requestAnimationFrame(() => {
      lineContainer.classList.add("cgm-status-line-visible");
    });

    // ── Create submenu at end of line ──
    const subMenu = document.createElement("div");
    subMenu.className = "cgm-status-submenu";
    subMenu.style.cssText = `position:fixed;left:${endX - subHalf}px;top:${endY - subHalf}px;width:${subSize}px;height:${subSize}px;z-index:202;`;

    // 3 slices: EFFECTS, REMOVE ALL, HEALTH
    const slices = [
      { key: "effects", label: "Effects", icon: "fa-sparkles", color: "#8a74cc", startAngle: 0, endAngle: 120 },
      { key: "removeEffects", label: "Clear FX", icon: "fa-ban", color: "#d94040", startAngle: 120, endAngle: 240 },
      { key: "health", label: "Health", icon: "fa-heart-pulse", color: "#40b060", startAngle: 240, endAngle: 360 },
    ];

    let svgPaths = "";
    let labelsHtml = "";
    const innerR = 22;
    const outerR = subHalf - 2;

    slices.forEach((sl) => {
      const d = this._pieWedgePath(sl.startAngle, sl.endAngle, innerR, outerR);
      svgPaths += `<path class="cgm-sub-seg cgm-sub-seg-${sl.key}" data-key="${sl.key}" d="${d}" />`;
      // Label position
      const midAngle = (sl.startAngle + sl.endAngle) / 2;
      const midRad = (midAngle - 90) * Math.PI / 180;
      const labelR = (innerR + outerR) * 0.55;
      const lx = Math.cos(midRad) * labelR + subHalf;
      const ly = Math.sin(midRad) * labelR + subHalf;
      labelsHtml += `
        <div class="cgm-sub-label cgm-sub-label-${sl.key}" data-key="${sl.key}"
             style="left:${lx.toFixed(1)}px;top:${ly.toFixed(1)}px;">
          <i class="fas ${sl.icon}"></i>
          <span>${sl.label}</span>
        </div>
      `;
    });

    // Get armor — try multiple possible paths in Cypher System
    let armor = 0;
    try {
      const raw = foundry.utils.getProperty(actor, "system.combat.armor")
        ?? foundry.utils.getProperty(actor, "system.armor")
        ?? foundry.utils.getProperty(actor, "system.pools.armor.value")
        ?? foundry.utils.getProperty(actor, "system.stats.armor.value")
        ?? 0;
      armor = parseInt(raw) || 0;
    } catch {}

    // Center button with armor display
    const centerBtn = `<div class="cgm-sub-center-btn"><div class="cgm-armor-badge"><i class="fas fa-shield-halved"></i> ${armor}</div><i class="fas fa-xmark"></i></div>`;

    subMenu.innerHTML = `
      <svg class="cgm-sub-svg" viewBox="-${subHalf} -${subHalf} ${subSize} ${subSize}" width="${subSize}" height="${subSize}">
        <defs>
          <filter id="cgm-sub-glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="3" result="blur"/>
            <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
          </filter>
        </defs>
        ${svgPaths}
      </svg>
      ${labelsHtml}
      ${centerBtn}
    `;

    document.body.appendChild(subMenu);
    this._statusMenuEl = subMenu;

    requestAnimationFrame(() => {
      subMenu.classList.add("cgm-status-submenu-visible");
    });

    // ── Click handlers ──
    subMenu.querySelectorAll(".cgm-sub-seg, .cgm-sub-label").forEach(el => {
      el.addEventListener("click", async (e) => {
        e.stopPropagation();
        const key = el.dataset.key;
        if (key === "health") {
          this._showHealthSubmenu(actorId, wrapEl, endX, endY);
        } else if (key === "effects") {
          this._showDfredsEffectsPicker(actorId, wrapEl);
        } else if (key === "removeEffects") {
          const actor = game.actors.get(actorId);
          if (!actor) return;
          const effects = actor.effects.filter(e => !e.disabled);
          if (effects.length === 0) {
            ui.notifications.warn(`${actor.name} has no active effects.`);
          } else {
            for (const effect of effects) {
              await effect.delete();
            }
            ui.notifications.info(`All effects removed from ${actor.name}.`);
          }
          this._hideStatusMenu();
          this._hideRadialMenu();
        }
      });
    });

    // Center close button
    subMenu.querySelector(".cgm-sub-center-btn")?.addEventListener("click", (e) => {
      e.stopPropagation();
      this._hideStatusMenu();
      this._hideRadialMenu();
    });

    // Click outside to close
    const closeHandler = (e) => {
      if (!lineContainer.contains(e.target) && !subMenu.contains(e.target) && !e.target.closest('.dialog, .window-app, .application, .file-picker')) {
        this._hideStatusMenu();
        this._hideRadialMenu();
        document.removeEventListener("click", closeHandler);
      }
    };
    setTimeout(() => document.addEventListener("click", closeHandler), 10);
  }

  _showHealthSubmenu(actorId, wrapEl, anchorX, anchorY) {
    // Hide the 2-slice menu but keep the line
    if (this._statusMenuEl) {
      this._statusMenuEl.classList.remove("cgm-status-submenu-visible");
      setTimeout(() => this._statusMenuEl?.remove(), 200);
      this._statusMenuEl = null;
    }

    const actor = game.actors.get(actorId);
    if (!actor) return;

    const currentStatus = this._getActorStatus(actor);

    // Health submenu - 4 slices
    const subSize = 130;
    const subHalf = subSize / 2;
    const healthMenu = document.createElement("div");
    healthMenu.className = "cgm-health-submenu";
    healthMenu.style.cssText = `position:fixed;left:${anchorX - subHalf}px;top:${anchorY - subHalf}px;width:${subSize}px;height:${subSize}px;z-index:203;`;

    const healthOptions = [
      { key: "healthy", label: "Healthy", icon: "fa-heart", color: "#40b060", desc: "No penalties" },
      { key: "impaired", label: "Impaired", icon: "fa-triangle-exclamation", color: "#d9a028", desc: "Effort costs +1, no special abilities" },
      { key: "debilitated", label: "Debilitated", icon: "fa-skull", color: "#d94040", desc: "Can only move, no actions" },
      { key: "dead", label: "Dead", icon: "fa-heart-crack", color: "#881111", desc: "Character is dead" },
    ];

    let svgPaths = "";
    let labelsHtml = "";
    const innerR = 26;
    const outerR = subHalf - 3;
    const count = healthOptions.length;
    const gap = 2;
    const segAngle = 360 / count;

    healthOptions.forEach((opt, i) => {
      const sAngle = i * segAngle + gap / 2;
      const eAngle = (i + 1) * segAngle - gap / 2;
      const d = this._pieWedgePath(sAngle, eAngle, innerR, outerR);
      const isActive = currentStatus === opt.key;
      svgPaths += `<path class="cgm-health-seg cgm-health-seg-${opt.key}${isActive ? ' cgm-health-seg-active' : ''}" data-key="${opt.key}" d="${d}" />`;

      // Label
      const midAngle = (sAngle + eAngle) / 2;
      const midRad = (midAngle - 90) * Math.PI / 180;
      const labelR = (innerR + outerR) * 0.52;
      const lx = Math.cos(midRad) * labelR + subHalf;
      const ly = Math.sin(midRad) * labelR + subHalf;
      labelsHtml += `
        <div class="cgm-health-label cgm-health-label-${opt.key}${isActive ? ' cgm-health-label-active' : ''}" data-key="${opt.key}"
             style="left:${lx.toFixed(1)}px;top:${ly.toFixed(1)}px;">
          <i class="fas ${opt.icon}"></i>
          <span>${opt.label}</span>
          ${isActive ? '<i class="fas fa-check cgm-health-check"></i>' : ''}
        </div>
      `;
    });

    const backBtn = `<div class="cgm-health-back-btn"><i class="fas fa-arrow-left"></i></div>`;

    healthMenu.innerHTML = `
      <svg class="cgm-health-svg" viewBox="-${subHalf} -${subHalf} ${subSize} ${subSize}" width="${subSize}" height="${subSize}">
        <defs>
          <filter id="cgm-health-glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="2" result="blur"/>
            <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
          </filter>
        </defs>
        ${svgPaths}
      </svg>
      ${labelsHtml}
      ${backBtn}
    `;

    document.body.appendChild(healthMenu);
    this._healthMenuEl = healthMenu;

    requestAnimationFrame(() => {
      healthMenu.classList.add("cgm-health-submenu-visible");
    });

    // Click handlers
    healthMenu.querySelectorAll(".cgm-health-seg, .cgm-health-label").forEach(el => {
      el.addEventListener("click", async (e) => {
        e.stopPropagation();
        const key = el.dataset.key;
        await this._setActorStatus(actorId, key);
        ui.notifications.info(`${actor.name} is now ${key}`);
        this._hideStatusMenu();
        this._hideRadialMenu();
      });
    });

    // Back button
    healthMenu.querySelector(".cgm-health-back-btn")?.addEventListener("click", (e) => {
      e.stopPropagation();
      healthMenu.classList.remove("cgm-health-submenu-visible");
      setTimeout(() => healthMenu.remove(), 200);
      this._healthMenuEl = null;
      // Re-show the 2-slice menu
      this._showStatusRadialMenu(actorId, wrapEl);
    });

    // Click outside to close
    const closeHandler = (e) => {
      if (!healthMenu.contains(e.target) && !this._connectingLineEl?.contains(e.target) && !e.target.closest('.dialog, .window-app, .application, .file-picker')) {
        this._hideStatusMenu();
        this._hideRadialMenu();
        document.removeEventListener("click", closeHandler);
      }
    };
    setTimeout(() => document.addEventListener("click", closeHandler), 10);
  }

  _hideStatusMenu() {
    if (this._connectingLineEl) {
      this._connectingLineEl.remove();
      this._connectingLineEl = null;
    }
    if (this._statusMenuEl) {
      this._statusMenuEl.classList.remove("cgm-status-submenu-visible");
      setTimeout(() => { this._statusMenuEl?.remove(); this._statusMenuEl = null; }, 200);
    }
    if (this._healthMenuEl) {
      this._healthMenuEl.classList.remove("cgm-health-submenu-visible");
      setTimeout(() => { this._healthMenuEl?.remove(); this._healthMenuEl = null; }, 200);
    }
    this._hideDfredsEffectsPicker();
    this._statusActorId = null;
    this._statusWrapEl = null;
  }

  /* ─── DFreds Convenient Effects Integration ─── */

  _getDfredsEffects() {
    const ce = game.modules.get("dfreds-convenient-effects")?.api;
    if (!ce) return [];
    try {
      const effects = ce.findEffects() || [];
      return effects.map(e => ({
        id: e.id || e._id,
        name: e.name,
        img: e.img || e.icon || "icons/svg/aura.svg",
        ceId: e.getFlag?.("dfreds-convenient-effects", "ceEffectId") || e.id,
      })).sort((a, b) => a.name.localeCompare(b.name));
    } catch (err) {
      console.warn("Cypher GM Taskbar | Failed to get DFreds effects:", err);
      return [];
    }
  }

  _showDfredsEffectsPicker(actorId, wrapEl) {
    this._hideDfredsEffectsPicker();
    this._hideStatusMenu();
    this._hideRadialMenu();

    const effects = this._getDfredsEffects();
    if (effects.length === 0) {
      ui.notifications.warn("DFreds Convenient Effects not found or no effects available.");
      return;
    }

    const actor = game.actors.get(actorId);
    const rect = wrapEl?.getBoundingClientRect();
    const panelW = 320;
    const panelH = 420;

    let left = rect ? rect.left + rect.width / 2 - panelW / 2 : (window.innerWidth - panelW) / 2;
    let top = rect ? rect.top - panelH - 20 : (window.innerHeight - panelH) / 2;

    // Clamp to viewport
    left = Math.max(10, Math.min(left, window.innerWidth - panelW - 10));
    top = Math.max(10, Math.min(top, window.innerHeight - panelH - 10));

    const panel = document.createElement("div");
    panel.className = "cgm-effects-picker";
    panel.style.cssText = `position:fixed;left:${left}px;top:${top}px;width:${panelW}px;height:${panelH}px;z-index:210;`;

    // Get currently active effect IDs on this actor
    const activeCeIds = new Set();
    if (actor) {
      for (const effect of actor.effects || []) {
        const ceId = effect.getFlag?.("dfreds-convenient-effects", "ceEffectId");
        if (ceId) activeCeIds.add(ceId);
      }
    }

    const itemsHtml = effects.map(eff => {
      const isActive = activeCeIds.has(eff.ceId);
      return `
        <div class="cgm-effect-item${isActive ? ' cgm-effect-active' : ''}" data-effect-id="${eff.ceId}" data-actor-id="${actorId}">
          <img src="${eff.img}" alt="" />
          <span>${this._escapeHTML(eff.name)}</span>
          ${isActive ? '<div class="cgm-effect-indicator"><i class="fas fa-check"></i></div>' : ''}
        </div>
      `;
    }).join("");

    panel.innerHTML = `
      <div class="cgm-effects-picker-header">
        <span><i class="fas fa-sparkles"></i> Effects — ${this._escapeHTML(actor?.name || "Actor")}</span>
        <button class="cgm-effects-picker-close" title="Close"><i class="fas fa-times"></i></button>
      </div>
      <div class="cgm-effects-picker-search">
        <i class="fas fa-search"></i>
        <input type="text" placeholder="Search effects..." />
      </div>
      <div class="cgm-effects-picker-grid">
        ${itemsHtml}
      </div>
      <div class="cgm-effects-picker-footer">
        <span>${effects.length} effects</span>
      </div>
    `;

    document.body.appendChild(panel);
    this._effectsPickerEl = panel;

    requestAnimationFrame(() => panel.classList.add("cgm-effects-picker-visible"));

    // Close button
    panel.querySelector(".cgm-effects-picker-close")?.addEventListener("click", (e) => {
      e.stopPropagation();
      this._hideDfredsEffectsPicker();
    });

    // Search filter
    const searchInput = panel.querySelector(".cgm-effects-picker-search input");
    searchInput?.addEventListener("input", (e) => {
      const q = e.target.value.toLowerCase();
      panel.querySelectorAll(".cgm-effect-item").forEach(item => {
        const name = item.querySelector("span")?.textContent?.toLowerCase() || "";
        item.style.display = name.includes(q) ? "" : "none";
      });
    });

    // Effect click — toggle
    panel.querySelectorAll(".cgm-effect-item").forEach(item => {
      item.addEventListener("click", async (e) => {
        e.stopPropagation();
        const effectId = item.dataset.effectId;
        const targetActorId = item.dataset.actorId;
        await this._toggleDfredsEffect(effectId, targetActorId);
        // Refresh active state visually
        const targetActor = game.actors.get(targetActorId);
        const newActive = new Set();
        if (targetActor) {
          for (const effect of targetActor.effects || []) {
            const ceId = effect.getFlag?.("dfreds-convenient-effects", "ceEffectId");
            if (ceId) newActive.add(ceId);
          }
        }
        const nowActive = newActive.has(effectId);
        item.classList.toggle("cgm-effect-active", nowActive);
        const indicator = item.querySelector(".cgm-effect-indicator");
        if (nowActive && !indicator) {
          item.insertAdjacentHTML("beforeend", '<div class="cgm-effect-indicator"><i class="fas fa-check"></i></div>');
        } else if (!nowActive && indicator) {
          indicator.remove();
        }
      });
    });

    // Outside click to close
    const closeHandler = (e) => {
      if (!panel.contains(e.target) && !e.target.closest('.dialog, .window-app, .application, .file-picker')) {
        this._hideDfredsEffectsPicker();
        document.removeEventListener("click", closeHandler);
      }
    };
    setTimeout(() => document.addEventListener("click", closeHandler), 10);
  }

  _hideDfredsEffectsPicker() {
    if (this._effectsPickerEl) {
      this._effectsPickerEl.classList.remove("cgm-effects-picker-visible");
      setTimeout(() => { this._effectsPickerEl?.remove(); this._effectsPickerEl = null; }, 200);
    }
  }

  async _toggleDfredsEffect(effectId, actorId) {
    const ce = game.modules.get("dfreds-convenient-effects")?.api;
    if (!ce) {
      ui.notifications.warn("DFreds Convenient Effects module is not active.");
      return;
    }
    const actor = game.actors.get(actorId);
    if (!actor) return;
    try {
      await ce.toggleEffect({ effectId, uuids: [actor.uuid] });
      ui.notifications.info(`Toggled effect on ${actor.name}.`);
    } catch (err) {
      console.error("Cypher GM Taskbar | Failed to toggle DFreds effect:", err);
      ui.notifications.error("Failed to toggle effect. See console for details.");
    }
  }

  /* ═══════════════════════════════════════════════════════════
     SUBMENU BUILDER — used by all radial submenus
     ═══════════════════════════════════════════════════════════ */

  _buildSubMenuBase(actorId, wrapEl, sliceIndex, segCount, subSize, slices, themeColor, menuType = null) {
    // Get main menu position
    const menu = this._radialMenuEl;
    if (!menu) return null;
    const mainRect = menu.getBoundingClientRect();
    const mainCx = mainRect.left + mainRect.width / 2;
    const mainCy = mainRect.top + mainRect.height / 2;
    const mainR = mainRect.width / 2;
    const clampedCx = Math.max(mainR + 8, Math.min(mainCx, window.innerWidth - mainR - 8));
    const clampedCy = Math.max(mainR + 8, Math.min(mainCy, window.innerHeight - mainR - 8));

    // Angle for this slice
    const sliceAngle = (sliceIndex + 0.5) * (360 / segCount);
    const sliceRad = (sliceAngle - 90) * Math.PI / 180;
    const lineStartR = mainR - 4;
    const lineEndR = mainR + 20;
    const startX = clampedCx + Math.cos(sliceRad) * lineStartR;
    const startY = clampedCy + Math.sin(sliceRad) * lineStartR;
    // Check for saved submenu position (per actor + menu type)
    const posKey = menuType ? (actorId + "_" + menuType) : null;
    const savedPos = posKey ? this._subMenuPositions[posKey] : null;

    let subLeft, subTop, lineEndX, lineEndY;
    const subHalf = subSize / 2;

    if (savedPos) {
      subLeft = savedPos.left;
      subTop = savedPos.top;
      lineEndX = subLeft + subHalf;
      lineEndY = subTop + subHalf;
    } else {
      lineEndX = clampedCx + Math.cos(sliceRad) * lineEndR;
      lineEndY = clampedCy + Math.sin(sliceRad) * lineEndR;
      subLeft = Math.max(8, Math.min(lineEndX - subHalf, window.innerWidth - subSize - 8));
      subTop  = Math.max(8, Math.min(lineEndY - subHalf, window.innerHeight - subSize - 8));
    }

    // Draw connecting line with gradient
    const lineContainer = document.createElement("div");
    lineContainer.className = "cgm-status-line-container";
    lineContainer.style.cssText = "position:fixed;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:201;";
    const svgNS = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(svgNS, "svg");
    svg.setAttribute("width", "100%");
    svg.setAttribute("height", "100%");

    // Gradient definition
    const defs = document.createElementNS(svgNS, "defs");
    const grad = document.createElementNS(svgNS, "linearGradient");
    grad.setAttribute("id", "cgm-line-grad-" + (menuType || "sub"));
    grad.setAttribute("gradientUnits", "userSpaceOnUse");
    grad.setAttribute("x1", startX);
    grad.setAttribute("y1", startY);
    grad.setAttribute("x2", lineEndX);
    grad.setAttribute("y2", lineEndY);
    const stop1 = document.createElementNS(svgNS, "stop");
    stop1.setAttribute("offset", "0%");
    stop1.setAttribute("stop-color", themeColor.replace(/[\d.]+\)$/, "0.8)"));
    const stop2 = document.createElementNS(svgNS, "stop");
    stop2.setAttribute("offset", "100%");
    stop2.setAttribute("stop-color", themeColor.replace(/[\d.]+\)$/, "0.2)"));
    grad.appendChild(stop1); grad.appendChild(stop2);
    defs.appendChild(grad);
    svg.appendChild(defs);

    const glowLine = document.createElementNS(svgNS, "line");
    glowLine.setAttribute("x1", startX); glowLine.setAttribute("y1", startY);
    glowLine.setAttribute("x2", lineEndX); glowLine.setAttribute("y2", lineEndY);
    glowLine.setAttribute("class", "cgm-status-line-glow");
    const line = document.createElementNS(svgNS, "line");
    line.setAttribute("x1", startX); line.setAttribute("y1", startY);
    line.setAttribute("x2", lineEndX); line.setAttribute("y2", lineEndY);
    line.setAttribute("class", "cgm-status-line");
    line.setAttribute("stroke", "url(#cgm-line-grad-" + (menuType || "sub") + ")");
    svg.appendChild(glowLine); svg.appendChild(line);
    lineContainer.appendChild(svg);
    document.body.appendChild(lineContainer);
    this._connectingLineEl = lineContainer;
    requestAnimationFrame(() => lineContainer.classList.add("cgm-status-line-visible"));

    // Create submenu
    const subMenu = document.createElement("div");
    subMenu.className = "cgm-status-submenu";
    subMenu.style.cssText = `position:fixed;left:${subLeft}px;top:${subTop}px;width:${subSize}px;height:${subSize}px;z-index:202;cursor:grab;`;

    const count = slices.length;
    const gap = 2;
    const segAngle = 360 / count;
    const innerR = count <= 2 ? 22 : (count <= 3 ? 24 : 26);
    const outerR = subHalf - 3;

    let svgPaths = "";
    let labelsHtml = "";
    slices.forEach((sl, i) => {
      const sAngle = i * segAngle + gap / 2;
      const eAngle = (i + 1) * segAngle - gap / 2;
      const d = this._pieWedgePath(sAngle, eAngle, innerR, outerR);
      svgPaths += `<path class="cgm-sub-seg cgm-sub-seg-${sl.key}" data-key="${sl.key}" d="${d}" />`;
      const midAngle = (sAngle + eAngle) / 2;
      const midRad = (midAngle - 90) * Math.PI / 180;
      const labelR = (innerR + outerR) * 0.52;
      const lx = Math.cos(midRad) * labelR + subHalf;
      const ly = Math.sin(midRad) * labelR + subHalf;
      labelsHtml += `
        <div class="cgm-sub-label cgm-sub-label-${sl.key}" data-key="${sl.key}" style="left:${lx.toFixed(1)}px;top:${ly.toFixed(1)}px;color:${sl.color};">
          <i class="fas ${sl.icon}"></i>
          <span>${sl.label}</span>
        </div>`;
    });

    const backBtn = `<div class="cgm-status-back-btn"><i class="fas fa-arrow-left"></i></div>`;
    subMenu.innerHTML = `
      <svg class="cgm-status-svg" viewBox="-${subHalf} -${subHalf} ${subSize} ${subSize}" width="${subSize}" height="${subSize}">
        <defs><filter id="cgm-sub-glow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="2" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>
        <circle cx="0" cy="0" r="${outerR}" fill="rgba(15,17,30,0.92)" stroke="${themeColor}" stroke-width="1" />
        ${svgPaths}
        <circle cx="0" cy="0" r="${innerR - 2}" fill="rgba(10,12,25,0.98)" stroke="${themeColor}" stroke-width="1.5" />
      </svg>
      ${labelsHtml}
      ${backBtn}
    `;

    document.body.appendChild(subMenu);
    requestAnimationFrame(() => subMenu.classList.add("cgm-status-submenu-visible"));

    // Back button — immediate line removal
    subMenu.querySelector(".cgm-status-back-btn")?.addEventListener("click", (e) => {
      e.stopPropagation();
      subMenu.classList.remove("cgm-status-submenu-visible");
      setTimeout(() => subMenu.remove(), 200);
      if (lineContainer) { lineContainer.remove(); }
      this._connectingLineEl = null;
    });

    // Make submenu draggable
    if (menuType) {
      this._makeSubMenuDraggable(subMenu, menuType, lineContainer, startX, startY, subHalf, actorId);
    }

    return { subMenu, lineContainer, endX: lineEndX, endY: lineEndY };
  }

  /* ─── NOTES Submenu ─── */
  _showNotesSubMenu(actorId, wrapEl) {
    const result = this._buildSubMenuBase(actorId, wrapEl, 0, 9, 110, [
      { key: "view", label: "View", icon: "fa-eye", color: "#c8a96e" },
      { key: "add", label: "Add", icon: "fa-plus", color: "#c8a96e" },
    ], "rgba(200,169,110,0.4)", "notes");
    if (!result) return;
    const { subMenu } = result;
    this._notesSubMenuEl = subMenu;

    subMenu.querySelectorAll(".cgm-sub-seg, .cgm-sub-label").forEach(el => {
      el.addEventListener("click", (e) => {
        e.stopPropagation();
        const key = el.dataset.key;
        if (key === "view") {
          this._hideNotesSubMenu();
          this._showNotesDialog(actorId, wrapEl);
        } else if (key === "add") {
          this._hideNotesSubMenu();
          this._showAddNoteDialog(actorId);
        }
      });
    });
  }

  _hideNotesSubMenu() {
    if (this._notesSubMenuEl) {
      this._notesSubMenuEl.classList.remove("cgm-status-submenu-visible");
      setTimeout(() => { this._notesSubMenuEl?.remove(); this._notesSubMenuEl = null; }, 200);
    }
    if (this._connectingLineEl) {
      this._connectingLineEl.remove();
      this._connectingLineEl = null;
    }
  }

  /* ─── TARGET Submenu ─── */
  _showTargetSubMenu(actorId, wrapEl) {
    const result = this._buildSubMenuBase(actorId, wrapEl, 1, 9, 110, [
      { key: "reset",    label: "Reset",    icon: "fa-rotate-left", color: "#f5a623" },
      { key: "individual", label: "Individual", icon: "fa-crosshairs",  color: "#f5a623" },
    ], "rgba(245,166,35,0.4)", "target");
    if (!result) return;
    const { subMenu } = result;
    this._targetSubMenuEl = subMenu;

    subMenu.querySelectorAll(".cgm-sub-seg, .cgm-sub-label").forEach(el => {
      el.addEventListener("click", async (e) => {
        e.stopPropagation();
        const key = el.dataset.key;
        if (key === "reset") {
          this._hideTargetSubMenu();
          const actor = game.actors.get(actorId);
          if (actor) {
            await actor.unsetFlag("cypher-gm-taskbar", "targetDifficulty");
            this._refreshPortraits();
            this._updateOpenRollDialogs();
            ui.notifications.info(`${actor.name}'s individual difficulty reset to global (${this._globalDifficulty}).`);
          }
        } else if (key === "individual") {
          this._hideTargetSubMenu();
          this._showTargetPanel(actorId, wrapEl);
        }
      });
    });
  }

  _hideTargetSubMenu() {
    if (this._targetSubMenuEl) {
      this._targetSubMenuEl.classList.remove("cgm-status-submenu-visible");
      setTimeout(() => { this._targetSubMenuEl?.remove(); this._targetSubMenuEl = null; }, 200);
    }
    if (this._connectingLineEl) {
      this._connectingLineEl.remove();
      this._connectingLineEl = null;
    }
  }

  /* ─── VALUES Submenu — 4 segments: Cash, Assets, Items, Drop ─── */
  _showValuesSubMenu(actorId, wrapEl) {
    const result = this._buildSubMenuBase(actorId, wrapEl, 3, 9, 140, [
      { key: "cash",   label: "Cash & Values", icon: "fa-coins",     color: "#d4a94d" },
      { key: "assets", label: "Assets",        icon: "fa-landmark",  color: "#c8a96e" },
      { key: "items",  label: "Items",         icon: "fa-box-open",  color: "#64b4dc" },
      { key: "drop",   label: "Drop Item",     icon: "fa-hand-holding-medical", color: "#6ecf7a" },
    ], "rgba(212,169,77,0.4)", "values");
    if (!result) return;
    const { subMenu } = result;
    this._valuesSubMenuEl = subMenu;

    subMenu.querySelectorAll(".cgm-sub-seg, .cgm-sub-label").forEach(el => {
      el.addEventListener("click", (e) => {
        e.stopPropagation();
        const key = el.dataset.key;
        this._hideValuesSubMenu();
        this._hideRadialMenu();
        if (key === "cash") {
          this._showCashValuesPanel(actorId, wrapEl);
        } else if (key === "assets") {
          this._showAssetsPanel(actorId, wrapEl);
        } else if (key === "items") {
          this._showItemsPanel(actorId, wrapEl);
        } else if (key === "drop") {
          this._showDropItemPanel(actorId, wrapEl);
        }
      });
    });
  }

  _hideValuesSubMenu() {
    if (this._valuesSubMenuEl) {
      this._valuesSubMenuEl.classList.remove("cgm-status-submenu-visible");
      setTimeout(() => { this._valuesSubMenuEl?.remove(); this._valuesSubMenuEl = null; }, 200);
    }
    if (this._connectingLineEl) {
      this._connectingLineEl.remove();
      this._connectingLineEl = null;
    }
  }

  /* ─── RECOVERY Submenu ─── */
  _showRecoverySubMenu(actorId, wrapEl) {
    const actor = game.actors.get(actorId);
    if (!actor) return;

    // Check current recovery state from actor sheet
    const allUsed = this._areAllRecoveriesUsed(actor);
    const anyUsed = this._areAnyRecoveriesUsed(actor);

    const result = this._buildSubMenuBase(actorId, wrapEl, 4, 9, 140, [
      { key: "full", label: "Full Rest", icon: "fa-bed", color: "#40c060" },
      { key: "interrupted", label: "Interrupted", icon: "fa-person-walking-arrow-right", color: "#c8a96e" },
    ], "rgba(64,192,96,0.4)", "recovery");
    if (!result) return;
    const { subMenu } = result;
    this._recoverySubMenuEl = subMenu;

    // Disable buttons if no recoveries are used
    const fullBtn = subMenu.querySelector('.cgm-sub-seg-full, .cgm-sub-label-full');
    const intBtn = subMenu.querySelector('.cgm-sub-seg-interrupted, .cgm-sub-label-interrupted');

    if (fullBtn && !anyUsed) {
      fullBtn.style.opacity = '0.4';
      fullBtn.style.pointerEvents = 'none';
    }
    if (intBtn && allUsed) {
      intBtn.style.opacity = '0.4';
      intBtn.style.pointerEvents = 'none';
    }

    subMenu.querySelectorAll(".cgm-sub-seg, .cgm-sub-label").forEach(el => {
      el.addEventListener("click", async (e) => {
        e.stopPropagation();
        const key = el.dataset.key;

        if (key === "full") {
          await this._doFullRest(actor);
        } else if (key === "interrupted") {
          await this._doInterruptedRest(actor);
        }

        this._hideRecoverySubMenu();
        this._hideRadialMenu();
      });
    });
  }

  _areAllRecoveriesUsed(actor) {
    // Check recoveryRolls array first (Cypher Taskbar format)
    const sys = actor?.system ?? {};
    let rolls = null;
    if (Array.isArray(sys.combat?.recoveries?.recoveryRolls)) rolls = sys.combat.recoveries.recoveryRolls;
    else if (Array.isArray(sys.recoveries?.recoveryRolls)) rolls = sys.recoveries.recoveryRolls;
    else if (Array.isArray(sys.combat?.recoveryRolls)) rolls = sys.combat.recoveryRolls;

    if (rolls) {
      // rolls is [bool, bool, bool, bool] where true = available
      return rolls.every(r => !r);
    }

    // Fallback to individual flags (GM Taskbar format)
    const recoveries = sys.combat?.recoveries || {};
    return recoveries.oneAction && recoveries.oneAction2 && recoveries.oneAction3 &&
           recoveries.oneAction4 && recoveries.oneAction5 && recoveries.oneAction6 &&
           recoveries.oneAction7 && recoveries.tenMinutes && recoveries.tenMinutes2 &&
           recoveries.oneHour && recoveries.tenHours;
  }

  _areAnyRecoveriesUsed(actor) {
    // Check recoveryRolls array first (Cypher Taskbar format)
    const sys = actor?.system ?? {};
    let rolls = null;
    if (Array.isArray(sys.combat?.recoveries?.recoveryRolls)) rolls = sys.combat.recoveries.recoveryRolls;
    else if (Array.isArray(sys.recoveries?.recoveryRolls)) rolls = sys.recoveries.recoveryRolls;
    else if (Array.isArray(sys.combat?.recoveryRolls)) rolls = sys.combat.recoveryRolls;

    if (rolls) {
      // rolls is [bool, bool, bool, bool] where true = available
      return rolls.some(r => !r);
    }

    // Fallback to individual flags (GM Taskbar format)
    const recoveries = sys.combat?.recoveries || {};
    return recoveries.oneAction || recoveries.oneAction2 || recoveries.oneAction3 ||
           recoveries.oneAction4 || recoveries.oneAction5 || recoveries.oneAction6 ||
           recoveries.oneAction7 || recoveries.tenMinutes || recoveries.tenMinutes2 ||
           recoveries.oneHour || recoveries.tenHours;
  }

  /* ================================================================
     CALL FOR ROLL RADIAL SUBMENU SYSTEM
     ================================================================ */
  _showCallForRollSubMenu(actorId, wrapEl) {
    const actor = game.actors.get(actorId);
    if (!actor) return;

    this._hideCallForRollSubMenu();
    this._hideCallForRollSkillSubMenu();
    this._hideCallForRollFrequentSubMenu();

    const result = this._buildSubMenuBase(actorId, wrapEl, 2, 9, 140, [
      { key: "might",     label: "Might",     icon: "fa-fist-raised", color: "#d94040" },
      { key: "speed",     label: "Speed",     icon: "fa-wind",        color: "#3a8fd4" },
      { key: "intellect", label: "Intellect", icon: "fa-brain",       color: "#7a44cc" },
      { key: "skill",     label: "Skill",     icon: "fa-graduation-cap", color: "#c8a96e" },
      { key: "frequent",  label: "Frequent",  icon: "fa-star",        color: "#c8a96e" },
    ], "rgba(200,169,110,0.4)", "callforroll");
    if (!result) return;
    const { subMenu } = result;
    this._callForRollSubMenuEl = subMenu;

    subMenu.querySelectorAll(".cgm-sub-seg, .cgm-sub-label").forEach(el => {
      el.addEventListener("click", async (e) => {
        e.stopPropagation();
        const key = el.dataset.key;

        if (key === "might" || key === "speed" || key === "intellect") {
          this._hideCallForRollSubMenu();
          this._hideRadialMenu();
          await this._doGMCallRollPool(actor, key);
        } else if (key === "skill") {
          this._hideCallForRollSubMenu();
          this._showCallForRollSkillSubMenu(actorId, wrapEl);
        } else if (key === "frequent") {
          this._hideCallForRollSubMenu();
          this._showCallForRollFrequentSubMenu(actorId, wrapEl);
        }
      });
    });
  }

  _hideCallForRollSubMenu() {
    if (this._callForRollSubMenuEl) {
      this._callForRollSubMenuEl.classList.remove("cgm-status-submenu-visible");
      setTimeout(() => { this._callForRollSubMenuEl?.remove(); this._callForRollSubMenuEl = null; }, 200);
    }
  }

  /* ─── SKILL LIST PANEL (vertical list instead of cramped radial) ─── */
  _showCallForRollSkillSubMenu(actorId, wrapEl) {
    const actor = game.actors.get(actorId);
    if (!actor) return;

    this._hideCallForRollSkillSubMenu();
    this._hideCallForRollFrequentSubMenu();

    const skills = actor.items.filter(i => i.type === "skill").sort((a, b) => a.name.localeCompare(b.name));
    if (!skills.length) {
      ui.notifications.warn(`${actor.name} has no skills.`);
      return;
    }

    const rect = wrapEl.getBoundingClientRect();
    const panelW = 220;
    const rowH = 34;
    const headerH = 38;
    const maxVisible = 10;
    const panelH = Math.min(skills.length, maxVisible) * rowH + headerH;

    let left = rect.right + 12;
    let top = rect.top;
    if (left + panelW > window.innerWidth - 8) left = rect.left - panelW - 12;
    if (top + panelH > window.innerHeight - 8) top = window.innerHeight - panelH - 8;
    if (top < 8) top = 8;

    const panel = document.createElement("div");
    panel.className = "cgm-skill-list-panel";
    panel.id = "cgm-skill-list-panel";
    panel.style.cssText = `position:fixed;left:${left}px;top:${top}px;width:${panelW}px;z-index:var(--cgm-z-dialog,10000);`;

    const skillRows = skills.map((s, idx) => {
      const trainingClass = this._getSkillTrainingClass(s);
      return `
      <div class="cgm-skill-row" data-skill-idx="${idx}" style="animation-delay:${idx * 0.02}s">
        <i class="fas fa-dice-d20"></i>
        <span class="cgm-skill-name ${trainingClass}">${foundry.utils.escapeHTML(s.name)}</span>
        <span class="cgm-skill-pool">${this._detectSkillPoolMeta(s).pool}</span>
      </div>
    `;
    }).join("");

    panel.innerHTML = `
      <div class="cgm-skill-list-header">
        <i class="fas fa-graduation-cap"></i> Skills — ${actor.name}
        <button class="cgm-skill-list-close" title="Close"><i class="fas fa-times"></i></button>
      </div>
      <div class="cgm-skill-list-body" style="max-height:${maxVisible * rowH}px;">
        ${skillRows}
      </div>
    `;

    document.body.appendChild(panel);
    this._callForRollSkillSubMenuEl = panel;

    requestAnimationFrame(() => panel.classList.add("cgm-skill-list-visible"));

    panel.querySelectorAll(".cgm-skill-row").forEach(row => {
      row.addEventListener("click", async (e) => {
        e.stopPropagation();
        const idx = Number(row.dataset.skillIdx);
        const skill = skills[idx];
        if (skill) {
          this._hideCallForRollSkillSubMenu();
          this._hideRadialMenu();
          await this._doGMCallRollSkill(actor, skill);
        }
      });
    });

    panel.querySelector(".cgm-skill-list-close")?.addEventListener("click", (e) => {
      e.stopPropagation();
      this._hideCallForRollSkillSubMenu();
    });

    setTimeout(() => {
      this._skillListOutsideClick = (e) => {
        if (!panel.contains(e.target) && !e.target.closest('.dialog, .window-app, .application, .file-picker')) this._hideCallForRollSkillSubMenu();
      };
      document.addEventListener("click", this._skillListOutsideClick);
    }, 50);
  }

  _hideCallForRollSkillSubMenu() {
    if (this._callForRollSkillSubMenuEl) {
      this._callForRollSkillSubMenuEl.classList.remove("cgm-skill-list-visible");
      setTimeout(() => { this._callForRollSkillSubMenuEl?.remove(); this._callForRollSkillSubMenuEl = null; }, 200);
    }
    if (this._skillListOutsideClick) {
      document.removeEventListener("click", this._skillListOutsideClick);
      this._skillListOutsideClick = null;
    }
  }

  /* ─── FREQUENT SKILLS PANEL ─── */
  _showCallForRollFrequentSubMenu(actorId, wrapEl) {
    const actor = game.actors.get(actorId);
    if (!actor) return;

    this._hideCallForRollFrequentSubMenu();
    this._hideCallForRollSkillSubMenu();

    const frequentNames = ["perception", "investigation", "sense motives", "persuasion", "stealth"];
    const skills = actor.items.filter(i => i.type === "skill");
    const frequentSkills = [];

    for (const searchName of frequentNames) {
      const skill = skills.find(s => s.name.toLowerCase().includes(searchName.toLowerCase()));
      if (skill) frequentSkills.push(skill);
    }

    if (!frequentSkills.length) {
      ui.notifications.warn(`${actor.name} has none of the frequent skills.`);
      return;
    }

    const rect = wrapEl.getBoundingClientRect();
    const panelW = 220;
    const rowH = 34;
    const headerH = 38;
    const panelH = frequentSkills.length * rowH + headerH;

    let left = rect.right + 12;
    let top = rect.top;
    if (left + panelW > window.innerWidth - 8) left = rect.left - panelW - 12;
    if (top + panelH > window.innerHeight - 8) top = window.innerHeight - panelH - 8;
    if (top < 8) top = 8;

    const panel = document.createElement("div");
    panel.className = "cgm-skill-list-panel";
    panel.id = "cgm-skill-freq-panel";
    panel.style.cssText = `position:fixed;left:${left}px;top:${top}px;width:${panelW}px;z-index:var(--cgm-z-dialog,10000);`;

    const skillRows = frequentSkills.map((s, idx) => {
      const trainingClass = this._getSkillTrainingClass(s);
      return `
      <div class="cgm-skill-row" data-freq-idx="${idx}" style="animation-delay:${idx * 0.04}s">
        <i class="fas fa-star"></i>
        <span class="cgm-skill-name ${trainingClass}">${foundry.utils.escapeHTML(s.name)}</span>
        <span class="cgm-skill-pool">${this._detectSkillPoolMeta(s).pool}</span>
      </div>
    `;
    }).join("");

    panel.innerHTML = `
      <div class="cgm-skill-list-header">
        <i class="fas fa-star"></i> Frequent — ${actor.name}
        <button class="cgm-skill-list-close" title="Close"><i class="fas fa-times"></i></button>
      </div>
      <div class="cgm-skill-list-body">
        ${skillRows}
      </div>
    `;

    document.body.appendChild(panel);
    this._callForRollFrequentSubMenuEl = panel;

    requestAnimationFrame(() => panel.classList.add("cgm-skill-list-visible"));

    panel.querySelectorAll(".cgm-skill-row").forEach(row => {
      row.addEventListener("click", async (e) => {
        e.stopPropagation();
        const idx = Number(row.dataset.freqIdx);
        const skill = frequentSkills[idx];
        if (skill) {
          this._hideCallForRollFrequentSubMenu();
          this._hideRadialMenu();
          await this._doGMCallRollSkill(actor, skill);
        }
      });
    });

    panel.querySelector(".cgm-skill-list-close")?.addEventListener("click", (e) => {
      e.stopPropagation();
      this._hideCallForRollFrequentSubMenu();
    });

    setTimeout(() => {
      this._freqListOutsideClick = (e) => {
        if (!panel.contains(e.target) && !e.target.closest('.dialog, .window-app, .application, .file-picker')) this._hideCallForRollFrequentSubMenu();
      };
      document.addEventListener("click", this._freqListOutsideClick);
    }, 50);
  }

  _hideCallForRollFrequentSubMenu() {
    if (this._callForRollFrequentSubMenuEl) {
      this._callForRollFrequentSubMenuEl.classList.remove("cgm-skill-list-visible");
      setTimeout(() => { this._callForRollFrequentSubMenuEl?.remove(); this._callForRollFrequentSubMenuEl = null; }, 200);
    }
    if (this._freqListOutsideClick) {
      document.removeEventListener("click", this._freqListOutsideClick);
      this._freqListOutsideClick = null;
    }
  }

  /* ─── Execute Pool Roll ─── */
  async _doGMCallRollPool(actor, poolKey) {
    const poolName = poolKey.charAt(0).toUpperCase() + poolKey.slice(1);
    const gmDifficulty = this._getGMDifficulty(actor);

    // Only send to the owning player(s), not chat
    const owners = game.users.filter(u => !u.isGM && actor.testUserPermission(u, "OWNER"));
    if (owners.length === 0) {
      ui.notifications.warn(`${actor.name} has no player owner online.`);
      return;
    }

    // Emit roll request to each owner player
    for (const user of owners) {
      game.socket.emit("module.cypher-gm-taskbar", {
        action: "callForRollPool",
        userId: user.id,
        actorId: actor.id,
        actorUuid: actor.uuid,
        poolName,
        poolKey,
        difficulty: gmDifficulty
      });
    }
    ui.notifications.info(`Roll request sent to ${actor.name}'s player.`);
  }

  /* ─── Execute Skill Roll ─── */
  async _doGMCallRollSkill(actor, skillItem) {
    const skillName = skillItem.name;
    const gmDifficulty = this._getGMDifficulty(actor);

    // Only send to the owning player(s), not chat
    const owners = game.users.filter(u => !u.isGM && actor.testUserPermission(u, "OWNER"));
    if (owners.length === 0) {
      ui.notifications.warn(`${actor.name} has no player owner online.`);
      return;
    }

    // Emit roll request to each owner player
    for (const user of owners) {
      game.socket.emit("module.cypher-gm-taskbar", {
        action: "callForRollSkill",
        userId: user.id,
        actorId: actor.id,
        actorUuid: actor.uuid,
        skillId: skillItem.id,
        skillUuid: skillItem.uuid,
        skillName: skillItem.name,
        difficulty: gmDifficulty
      });
    }
    ui.notifications.info(`Skill roll request (${skillName}) sent to ${actor.name}'s player.`);
  }

  /* ─── Try to open Cypher Taskbar roll dialog ─── */
  /* ─── Get GM Difficulty for Roll Dialogs ─── */
  _getGMDifficulty(actor) {
    if (!actor) return null;
    // 1. Individual actor difficulty (set via GM Taskbar Target button)
    const individual = actor.getFlag("cypher-gm-taskbar", "targetDifficulty");
    if (Number.isFinite(individual)) return Math.max(0, Math.min(15, individual));
    // 2. Global difficulty: prefer Cypher System's rollDifficulty setting (canonical), fall back to taskbar local
    const cypherGlobal = game.settings.settings.has("cyphersystem.rollDifficulty")
      ? game.settings.get("cyphersystem", "rollDifficulty")
      : undefined;
    if (Number.isFinite(cypherGlobal)) return Math.max(0, Math.min(15, cypherGlobal));
    return this._globalDifficulty ?? null;
  }

  /* ─── Helpers ─── */
  _detectSkillPoolMeta(skillItem) {
    // First check the skill's native stat property (Cypher System stores pool in system.stat)
    const stat = skillItem.system?.stat;
    if (stat) {
      const pool = stat.toString().toLowerCase();
      if (pool === "might") return { pool: "Might" };
      if (pool === "speed") return { pool: "Speed" };
      if (pool === "intellect") return { pool: "Intellect" };
    }
    // Fallback: check Cypher Cool Items flag
    const cciData = skillItem.getFlag?.("cypher-cool-items", "data");
    if (cciData?.skillStat) {
      const pool = cciData.skillStat.toString().toLowerCase();
      if (pool === "might") return { pool: "Might" };
      if (pool === "speed") return { pool: "Speed" };
      if (pool === "intellect") return { pool: "Intellect" };
    }
    // Last resort: detect from name/description
    const name = (skillItem.name || "").toLowerCase();
    const desc = (skillItem.system?.description || skillItem.system?.basic?.description || "").toLowerCase();
    const combined = name + " " + desc;
    if (/\bmight\b/.test(combined)) return { pool: "Might" };
    if (/\bspeed\b/.test(combined)) return { pool: "Speed" };
    if (/\bintellect\b/.test(combined)) return { pool: "Intellect" };
    return { pool: "Might" };
  }

  /* ─── Skill training level color class ─── */
  _getSkillTrainingClass(skillItem) {
    const sys = skillItem.system || {};
    
    // Cypher System v2+ stores skill rating as string in system.basic.rating
    // Values: "Inability", "Practiced", "Trained", "Specialized"
    const rating = sys.basic?.rating || sys.rating;
    
    if (typeof rating === 'string') {
      const r = rating.toLowerCase();
      if (r === 'inability') return "cgm-skill-inability";
      if (r === 'practiced' || r === 'untrained') return "";
      if (r === 'trained') return "cgm-skill-trained";
      if (r === 'specialized') return "cgm-skill-specialized";
    }
    
    // Numeric fallback (older versions or other systems)
    if (typeof rating === 'number') {
      if (rating <= -1) return "cgm-skill-inability";
      if (rating === 0) return "";
      if (rating === 1) return "cgm-skill-trained";
      if (rating >= 2) return "cgm-skill-specialized";
    }
    
    // Check Cypher Cool Items flag
    const cciData = skillItem.getFlag?.("cypher-cool-items", "data");
    if (cciData?.skillTraining) {
      const t = cciData.skillTraining.toLowerCase();
      if (t === "inability") return "cgm-skill-inability";
      if (t === "practiced" || t === "untrained") return "";
      if (t === "trained") return "cgm-skill-trained";
      if (t === "specialized") return "cgm-skill-specialized";
    }
    
    return "";
  }

  async _doFullRest(actor) {
    const updateData = {
      "system.combat.recoveries.oneAction": false,
      "system.combat.recoveries.oneAction2": false,
      "system.combat.recoveries.oneAction3": false,
      "system.combat.recoveries.oneAction4": false,
      "system.combat.recoveries.oneAction5": false,
      "system.combat.recoveries.oneAction6": false,
      "system.combat.recoveries.oneAction7": false,
      "system.combat.recoveries.tenMinutes": false,
      "system.combat.recoveries.tenMinutes2": false,
      "system.combat.recoveries.oneHour": false,
      "system.combat.recoveries.tenHours": false,
    };
    // Also sync the recoveryRolls array used by Cypher Taskbar
    if (Array.isArray(actor.system?.combat?.recoveries?.recoveryRolls)) {
      updateData["system.combat.recoveries.recoveryRolls"] = [true, true, true, true];
    } else if (Array.isArray(actor.system?.recoveries?.recoveryRolls)) {
      updateData["system.recoveries.recoveryRolls"] = [true, true, true, true];
    } else if (Array.isArray(actor.system?.combat?.recoveryRolls)) {
      updateData["system.combat.recoveryRolls"] = [true, true, true, true];
    }
    await actor.update(updateData);

    await ChatMessage.create({
      speaker: { actor: actor.id, alias: actor.name },
      content: `<div style="padding:8px 12px;background:rgba(64,192,96,0.1);border:1px solid rgba(64,192,96,0.3);border-radius:6px;">
        <strong style="color:#40c060;">💚 ${actor.name} — Full Rest</strong><br>
        <span style="color:#ccc;">All recovery rolls have been restored.</span>
      </div>`
    });
    ui.notifications.info(`${actor.name} takes a full rest. All recovery rolls restored.`);
  }

  async _doInterruptedRest(actor) {
    const sys = actor.system ?? {};
    const recoveries = sys.combat?.recoveries || {};
    const addl = sys.settings?.combat || {};

    let resetPath = null;
    let resetName = "";
    let recoveryRollsIndex = -1;

    // ── 1. Check recoveryRolls array first (Actor Sheet format) ──
    let rolls = null;
    let rollsPath = null;
    if (Array.isArray(sys.combat?.recoveries?.recoveryRolls)) {
      rolls = [...sys.combat.recoveries.recoveryRolls];
      rollsPath = "system.combat.recoveries.recoveryRolls";
    } else if (Array.isArray(sys.recoveries?.recoveryRolls)) {
      rolls = [...sys.recoveries.recoveryRolls];
      rollsPath = "system.recoveries.recoveryRolls";
    } else if (Array.isArray(sys.combat?.recoveryRolls)) {
      rolls = [...sys.combat.recoveryRolls];
      rollsPath = "system.combat.recoveryRolls";
    }

    if (rolls) {
      // rolls = [1Action, 10Min, 1Hour, 10Hours] — true = available, false = spent
      // Find first spent roll, skipping 10 Hours (index 3)
      const checkOrder = [0, 1, 2]; // 1 Action, 10 Min, 1 Hour
      for (const idx of checkOrder) {
        if (!rolls[idx]) {
          // This roll is spent — restore it
          rolls[idx] = true;
          recoveryRollsIndex = idx;
          const names = ["1 Action", "10 Minutes", "1 Hour"];
          resetName = names[idx];
          break;
        }
      }
    }

    // ── 2. Fall back to individual flags if no array found ──
    if (recoveryRollsIndex < 0) {
      const checkList = [
        { key: "oneAction", label: "1 Action", min: 1, rollsIdx: 0 },
        { key: "oneAction2", label: "1 Action", min: 2, rollsIdx: 0 },
        { key: "oneAction3", label: "1 Action", min: 3, rollsIdx: 0 },
        { key: "oneAction4", label: "1 Action", min: 4, rollsIdx: 0 },
        { key: "oneAction5", label: "1 Action", min: 5, rollsIdx: 0 },
        { key: "oneAction6", label: "1 Action", min: 6, rollsIdx: 0 },
        { key: "oneAction7", label: "1 Action", min: 7, rollsIdx: 0 },
        { key: "tenMinutes", label: "10 Minutes", min: 1, rollsIdx: 1 },
        { key: "tenMinutes2", label: "10 Minutes", min: 2, rollsIdx: 1 },
        { key: "oneHour", label: "1 Hour", min: 1, rollsIdx: 2 },
      ];

      for (const entry of checkList) {
        const countKey = entry.key.startsWith("oneAction") ? "numberOneActionRecoveries" :
                         entry.key.startsWith("tenMinutes") ? "numberTenMinuteRecoveries" : null;
        const available = countKey ? (addl[countKey] || 0) >= entry.min : true;
        if (available && recoveries[entry.key]) {
          resetPath = `system.combat.recoveries.${entry.key}`;
          resetName = entry.label;
          recoveryRollsIndex = entry.rollsIdx;
          break;
        }
      }
    }

    if (recoveryRollsIndex < 0 && !resetPath) {
      ui.notifications.warn(`No recoveries available to restore for ${actor.name}.`);
      return;
    }

    // ── 3. Build update data ──
    const updateData = {};

    // Update recoveryRolls array if it exists
    if (rolls && rollsPath) {
      updateData[rollsPath] = rolls;
    }

    // Also update individual flag if found
    if (resetPath) {
      updateData[resetPath] = false;
    }

    // If restored via array but no flag path, update the corresponding flag too
    if (recoveryRollsIndex >= 0 && !resetPath) {
      const flagMap = ["oneAction", "tenMinutes", "oneHour", "tenHours"];
      const flagKey = flagMap[recoveryRollsIndex];
      if (flagKey && recoveries[flagKey]) {
        updateData[`system.combat.recoveries.${flagKey}`] = false;
      }
    }

    await actor.update(updateData);

    await ChatMessage.create({
      speaker: { actor: actor.id, alias: actor.name },
      content: `<div style="padding:8px 12px;background:rgba(200,169,110,0.1);border:1px solid rgba(200,169,110,0.3);border-radius:6px;">
        <strong style="color:#c8a96e;">⚡ ${actor.name} — Interrupted Rest</strong><br>
        <span style="color:#ccc;">${resetName} recovery roll restored.</span>
      </div>`
    });
    ui.notifications.info(`${actor.name} takes an interrupted rest. ${resetName} recovery restored.`);
  }

  _hideRecoverySubMenu() {
    if (this._recoverySubMenuEl) {
      this._recoverySubMenuEl.classList.remove("cgm-status-submenu-visible");
      setTimeout(() => { this._recoverySubMenuEl?.remove(); this._recoverySubMenuEl = null; }, 200);
    }
    if (this._connectingLineEl) {
      this._connectingLineEl.remove();
      this._connectingLineEl = null;
    }
  }

  /* ─── CYPHERS Submenu ─── */
  _showCyphersSubMenu(actorId, wrapEl) {
    const actor = game.actors.get(actorId);
    const artifacts = actor?.items?.filter(i => i.type === "artifact") ?? [];
    const sys = actor?.system ?? {};
    const cypherLimit = sys.basic?.cypherLimit ?? sys.settings?.cypherLimit ?? 2;
    const limitReached = cypherLimit > 0 && artifacts.length >= cypherLimit;

    const result = this._buildSubMenuBase(actorId, wrapEl, 5, 9, 110, [
      { key: "view", label: "View", icon: "fa-flask", color: limitReached ? "#ff4444" : "#8a74cc" },
      { key: "create", label: "New", icon: "fa-plus", color: limitReached ? "#ff4444" : "#8a74cc" },
    ], limitReached ? "rgba(255,68,68,0.5)" : "rgba(138,116,204,0.4)", "cyphers");
    if (!result) return;
    const { subMenu } = result;
    this._cyphersSubMenuEl = subMenu;

    // Add flashing red class if limit reached
    if (limitReached) {
      subMenu.classList.add("cgm-cyphers-limit-reached");
    }

    subMenu.querySelectorAll(".cgm-sub-seg, .cgm-sub-label").forEach(el => {
      el.addEventListener("click", (e) => {
        e.stopPropagation();
        const key = el.dataset.key;
        if (key === "view") {
          this._hideCyphersSubMenu();
          this._showCyphersPanel(actorId, wrapEl);
        } else if (key === "create") {
          this._hideCyphersSubMenu();
          this._hideRadialMenu();
          this._showCreateCypherDialog(actorId);
        }
      });
    });
  }

  _hideCyphersSubMenu() {
    if (this._cyphersSubMenuEl) {
      this._cyphersSubMenuEl.classList.remove("cgm-status-submenu-visible");
      setTimeout(() => { this._cyphersSubMenuEl?.remove(); this._cyphersSubMenuEl = null; }, 200);
    }
    if (this._connectingLineEl) {
      this._connectingLineEl.remove();
      this._connectingLineEl = null;
    }
  }

  /* ─── Add Note Dialog (Fancy Custom Window) ─── */
  async _showAddNoteDialog(actorId) {
    const actor = game.actors.get(actorId);
    if (!actor) return;

    // Remove existing dialog
    document.querySelector('.cgm-note-add-overlay')?.remove();

    const overlay = document.createElement('div');
    overlay.className = 'cgm-note-add-overlay';
    overlay.style.cssText = 'position:fixed;inset:0;z-index:300;background:rgba(0,0,0,0.7);display:flex;align-items:center;justify-content:center;backdrop-filter:blur(4px);opacity:0;transition:opacity 0.2s ease;';

    const panel = document.createElement('div');
    panel.className = 'cgm-note-add-panel';
    panel.style.cssText = 'background:linear-gradient(145deg,#1a1525 0%,#0f0b18 100%);border:1px solid rgba(200,169,110,0.4);border-radius:12px;width:420px;max-width:90vw;box-shadow:0 20px 60px rgba(0,0,0,0.6),0 0 0 1px rgba(200,169,110,0.1);overflow:hidden;transform:scale(0.95);transition:transform 0.25s cubic-bezier(0.34,1.56,0.64,1);';

    panel.innerHTML = `
      <div class="cgm-note-add-header" style="background:linear-gradient(90deg,rgba(200,169,110,0.15),transparent);padding:16px 20px;border-bottom:1px solid rgba(200,169,110,0.15);display:flex;align-items:center;gap:12px;">
        <div style="width:36px;height:36px;border-radius:50%;background:linear-gradient(135deg,rgba(200,169,110,0.3),rgba(200,169,110,0.1));display:flex;align-items:center;justify-content:center;border:1px solid rgba(200,169,110,0.3);">
          <i class="fas fa-sticky-note" style="color:#c8a96e;font-size:14px;"></i>
        </div>
        <div style="flex:1;">
          <div style="color:#e8e0d4;font-size:15px;font-weight:600;letter-spacing:0.3px;">Add Note</div>
          <div style="color:#8a7a6a;font-size:11px;margin-top:2px;">${actor.name}</div>
        </div>
        <button class="cgm-note-add-close" style="width:28px;height:28px;border-radius:50%;border:none;background:rgba(255,255,255,0.05);color:#a09080;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:all 0.2s;" onmouseover="this.style.background='rgba(255,100,100,0.2)';this.style.color='#ff7070';" onmouseout="this.style.background='rgba(255,255,255,0.05)';this.style.color='#a09080';">
          <i class="fas fa-xmark" style="font-size:12px;"></i>
        </button>
      </div>
      <div style="padding:20px;">
        <textarea id="cgm-note-add-text" placeholder="Write your note here..." style="width:100%;min-height:120px;background:rgba(0,0,0,0.3);border:1px solid rgba(200,169,110,0.2);border-radius:8px;color:#e8e0d4;padding:12px;font-family:inherit;font-size:13px;line-height:1.6;resize:vertical;outline:none;transition:border-color 0.2s;" onfocus="this.style.borderColor='rgba(200,169,110,0.5)';this.style.boxShadow='0 0 0 3px rgba(200,169,110,0.1)';" onblur="this.style.borderColor='rgba(200,169,110,0.2)';this.style.boxShadow='none';"></textarea>
        <div style="display:flex;justify-content:flex-end;gap:10px;margin-top:16px;">
          <button class="cgm-note-add-cancel" style="padding:8px 18px;border-radius:6px;border:1px solid rgba(255,255,255,0.1);background:rgba(255,255,255,0.05);color:#a09080;font-size:12px;cursor:pointer;transition:all 0.2s;" onmouseover="this.style.background='rgba(255,255,255,0.1)';this.style.color='#e8e0d4';" onmouseout="this.style.background='rgba(255,255,255,0.05)';this.style.color='#a09080';">Cancel</button>
          <button class="cgm-note-add-save" style="padding:8px 20px;border-radius:6px;border:none;background:linear-gradient(135deg,rgba(200,169,110,0.8),rgba(180,150,90,0.7));color:#1a1525;font-size:12px;font-weight:600;cursor:pointer;transition:all 0.2s;box-shadow:0 2px 8px rgba(200,169,110,0.2);" onmouseover="this.style.transform='translateY(-1px)';this.style.boxShadow='0 4px 12px rgba(200,169,110,0.3)';" onmouseout="this.style.transform='';this.style.boxShadow='0 2px 8px rgba(200,169,110,0.2)';">
            <i class="fas fa-plus" style="margin-right:6px;font-size:10px;"></i>Add Note
          </button>
        </div>
      </div>
    `;

    overlay.appendChild(panel);
    document.body.appendChild(overlay);

    // Animate in
    requestAnimationFrame(() => {
      overlay.style.opacity = '1';
      panel.style.transform = 'scale(1)';
    });

    // Auto-focus textarea
    setTimeout(() => panel.querySelector('#cgm-note-add-text')?.focus(), 100);

    // Close handlers
    const closeDialog = () => {
      overlay.style.opacity = '0';
      panel.style.transform = 'scale(0.95)';
      setTimeout(() => overlay.remove(), 200);
    };

    overlay.addEventListener('click', (e) => { if (e.target === overlay) closeDialog(); });
    panel.querySelector('.cgm-note-add-close')?.addEventListener('click', closeDialog);
    panel.querySelector('.cgm-note-add-cancel')?.addEventListener('click', closeDialog);

    // Save handler
    panel.querySelector('.cgm-note-add-save')?.addEventListener('click', async () => {
      const text = panel.querySelector('#cgm-note-add-text')?.value?.trim();
      if (!text) {
        ui.notifications.warn('Please enter a note.');
        return;
      }
      await this._addActorNote(actorId, text);
      ui.notifications.info(`Note added for ${actor.name}.`);
      closeDialog();
    });

    // Enter to save (Ctrl+Enter)
    panel.querySelector('#cgm-note-add-text')?.addEventListener('keydown', (e) => {
      if (e.ctrlKey && e.key === 'Enter') {
        panel.querySelector('.cgm-note-add-save')?.click();
      }
    });
  }

  /* ─── Create Cypher Dialog ─── */
  async _showCreateCypherDialog(actorId) {
    const actor = game.actors.get(actorId);
    if (!actor) return;
    const name = await new Promise((resolve) => {
      new Dialog({
        title: `Create Cypher — ${actor.name}`,
        content: `<div style="padding:12px;"><input id="cgm-cypher-name" type="text" style="width:100%;background:rgba(0,0,0,0.5);border:1px solid rgba(138,116,204,0.3);border-radius:4px;color:#e8e0d4;padding:8px;" placeholder="Cypher name..."></div>`,
        buttons: {
          create: { icon: '<i class="fas fa-plus"></i>', label: "Create", callback: (html) => resolve(html.find("#cgm-cypher-name").val()) },
          cancel: { icon: '<i class="fas fa-times"></i>', label: "Cancel", callback: () => resolve(null) }
        },
        default: "create"
      }).render(true);
    });
    if (name?.trim()) {
      await actor.createEmbeddedDocuments("Item", [{ name: name.trim(), type: "cypher" }]);
      ui.notifications.info(`Cypher "${name.trim()}" created for ${actor.name}`);
    }
  }

  _getActorStatus(actor) {
    const sys = actor.system ?? {};
    if (sys.combat?.damageTrack?.state) {
      const state = sys.combat.damageTrack.state.toLowerCase();
      return state === "hale" ? "healthy" : state;
    }
    return "healthy";
  }

  async _setActorStatus(actorId, statusKey) {
    const actor = game.actors.get(actorId);
    if (!actor) return;

    // Cypher System damage track values: Hale, Impaired, Debilitated, Dead
    const trackMap = { healthy: "Hale", impaired: "Impaired", debilitated: "Debilitated", dead: "Dead" };
    const trackValue = trackMap[statusKey] || "Hale";

    await actor.update({ "system.combat.damageTrack.state": trackValue });

    if (actor.sheet) actor.sheet.render(true);

    const statusLabels = { healthy: "Healthy", impaired: "Impaired", debilitated: "Debilitated", dead: "Dead" };
    await ChatMessage.create({
      speaker: { alias: actor.name, actor: actor.id },
      content: `<div style="padding:4px 0;"><strong>${actor.name}</strong> is now <strong style="color:#ffcc44;">${statusLabels[statusKey]}</strong>.</div>`,
      whisper: game.users.filter(u => u.isGM).map(u => u.id)
    });
  }

  _getActiveStatusEffects(actor) {
    // Return array of active effects/conditions
    const effects = [];
    if (actor.effects) {
      actor.effects.forEach(e => {
        if (!e.disabled) {
          effects.push({
            name: e.label || e.name,
            icon: e.icon ? `fa-${e.icon.split('/').pop().replace('.svg', '')}` : "fa-circle"
          });
        }
      });
    }
    // Also check Cypher System conditions
    const sys = actor.system ?? {};
    if (sys.conditions) {
      if (sys.conditions.dazed) effects.push({ name: "Dazed", icon: "fa-dizzy" });
      if (sys.conditions.stunned) effects.push({ name: "Stunned", icon: "fa-bolt" });
      if (sys.conditions.poisons) effects.push({ name: "Poisoned", icon: "fa-skull-crossbones" });
      if (sys.conditions.diseased) effects.push({ name: "Diseased", icon: "fa-virus" });
    }
    return effects;
  }

  _getPoolPath(actor, poolKey) {
    const sys = actor.system ?? {};
    if (sys.pools && sys.pools[poolKey] && "value" in sys.pools[poolKey]) return `system.pools.${poolKey}.value`;
    return null;
  }
  _getPoolMaxPath(actor, poolKey) {
    const sys = actor.system ?? {};
    if (sys.pools && sys.pools[poolKey] && "max" in sys.pools[poolKey]) return `system.pools.${poolKey}.max`;
    return null;
  }
  _getPoolEdgePath(actor, poolKey) {
    const sys = actor.system ?? {};
    if (sys.pools && sys.pools[poolKey] && "edge" in sys.pools[poolKey]) return `system.pools.${poolKey}.edge`;
    return null;
  }
  _getPoolData(actor) {
    const data = {};
    ["might", "speed", "intellect"].forEach(key => {
      const valPath = this._getPoolPath(actor, key);
      const maxPath = this._getPoolMaxPath(actor, key);
      const edgePath = this._getPoolEdgePath(actor, key);
      data[key] = {
        value: valPath ? Number(foundry.utils.getProperty(actor, valPath) ?? 0) : 0,
        max: maxPath ? Number(foundry.utils.getProperty(actor, maxPath) ?? 0) : 0,
        edge: edgePath ? Number(foundry.utils.getProperty(actor, edgePath) ?? 0) : 0
      };
    });
    return data;
  }

  /* ─── Notes Panel ─── */

  async _showNotesDialog(actorId, wrapEl) {
    this._hideNotesPanel();
    this._hideStatusMenu();
    this._hidePoolsMenu();

    const actor = game.actors.get(actorId);
    const name = actor?.name || "Character";
    const notes = this._getActorNotes(actorId, true);

    // Position calculation (same pattern as status/pools)
    const size = this._radialMenuSize;
    const offset = this._radialMenuOffset;
    const rect = wrapEl.getBoundingClientRect();
    const portraitCx = rect.left + rect.width / 2;
    const portraitCy = rect.top + rect.height / 2;

    const spaceAbove = portraitCy - size / 2;
    const spaceBelow = window.innerHeight - portraitCy - size / 2;
    let mainCy;
    if (spaceAbove >= size + offset && spaceAbove >= spaceBelow) {
      mainCy = rect.top - offset - size / 2;
    } else if (spaceBelow >= size + offset) {
      mainCy = rect.bottom + offset + size / 2;
    } else if (spaceAbove >= size + offset) {
      mainCy = rect.top - offset - size / 2;
    } else {
      mainCy = window.innerHeight / 2;
    }
    const mainCx = portraitCx;
    const mainR = size / 2;
    const clampedCx = Math.max(mainR + 8, Math.min(mainCx, window.innerWidth - mainR - 8));
    const clampedCy = Math.max(mainR + 8, Math.min(mainCy, window.innerHeight - mainR - 8));

    // NOTES slice is index 0 in 10-segment menu
    const notesIndex = 0;
    const notesAngle = (notesIndex + 0.5) * (360 / 10);
    const notesRad = (notesAngle - 90) * Math.PI / 180;

    const lineStartR = mainR - 4;
    const lineLength = 90;
    const lineEndR = lineStartR + lineLength;

    const startX = clampedCx + Math.cos(notesRad) * lineStartR;
    const startY = clampedCy + Math.sin(notesRad) * lineStartR;
    let endX = clampedCx + Math.cos(notesRad) * lineEndR;
    let endY = clampedCy + Math.sin(notesRad) * lineEndR;

    // Panel size
    const panelW = 280;
    const panelH = 320;

    // Clamp default position
    endX = Math.max(panelW / 2 + 8, Math.min(endX, window.innerWidth - panelW / 2 - 8));
    endY = Math.max(panelH / 2 + 8, Math.min(endY, window.innerHeight - panelH / 2 - 8));

    // Use saved position if available, clamped to viewport
    let panelLeft, panelTop;
    if (this._notesPanelPos) {
      const clamped = this._clampPanelPos(this._notesPanelPos.left, this._notesPanelPos.top, panelW, panelH);
      panelLeft = clamped.left;
      panelTop = clamped.top;
      this._notesPanelPos = clamped;
    } else {
      panelLeft = endX - panelW / 2;
      panelTop = endY - panelH / 2;
    }
    const lineEndX = panelLeft + panelW / 2;
    const lineEndY = panelTop + panelH / 2;

    // ── Create connecting line ──
    const lineContainer = document.createElement("div");
    lineContainer.className = "cgm-status-line-container";
    lineContainer.style.cssText = `position:fixed;left:0;top:0;width:100%;height:100%;z-index:201;pointer-events:none;`;

    const svgNS = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(svgNS, "svg");
    svg.setAttribute("class", "cgm-status-line-svg");
    svg.style.cssText = `position:absolute;left:0;top:0;width:100%;height:100%;overflow:visible;`;

    const line = document.createElementNS(svgNS, "line");
    line.setAttribute("x1", startX);
    line.setAttribute("y1", startY);
    line.setAttribute("x2", lineEndX);
    line.setAttribute("y2", lineEndY);
    line.setAttribute("class", "cgm-status-line");
    line.setAttribute("stroke", "rgba(200, 169, 110, 0.7)");
    svg.appendChild(line);

    const glowLine = document.createElementNS(svgNS, "line");
    glowLine.setAttribute("x1", startX);
    glowLine.setAttribute("y1", startY);
    glowLine.setAttribute("x2", lineEndX);
    glowLine.setAttribute("y2", lineEndY);
    glowLine.setAttribute("class", "cgm-status-line-glow");
    glowLine.setAttribute("stroke", "rgba(200, 169, 110, 0.3)");
    svg.appendChild(glowLine);

    lineContainer.appendChild(svg);
    document.body.appendChild(lineContainer);
    this._connectingLineEl = lineContainer;
    this._notesLineStart = { x: startX, y: startY };

    requestAnimationFrame(() => {
      lineContainer.classList.add("cgm-status-line-visible");
    });

    // ── Build notes content ──
    const notesList = notes.length
      ? notes.map((n) => `
        <div class="cgm-note-item ${n.archived ? 'cgm-note-archived' : ''}">
          <div class="cgm-note-meta">
            <span>${n.date} ${n.time} ${n.archived ? '<span class="cgm-note-archive-badge">Archived</span>' : ''}</span>
            <button class="cgm-note-delete" data-note-id="${n.id}" title="Delete"><i class="fas fa-times"></i></button>
          </div>
          <div class="cgm-note-text">${this._escapeHTML(n.text)}</div>
        </div>
      `).join("")
      : `<div class="cgm-note-empty">No notes yet. Add one below!</div>`;

    // ── Create panel ──
    const panel = document.createElement("div");
    panel.className = "cgm-connected-panel cgm-notes-panel";
    panel.style.cssText = `position:fixed;left:${panelLeft}px;top:${panelTop}px;width:${panelW}px;min-height:${panelH}px;z-index:202;`;

    panel.innerHTML = `
      <div class="cgm-notes-panel-header">
        <i class="fas fa-sticky-note"></i>
        <span>${name}</span>
        <button class="cgm-notes-panel-close"><i class="fas fa-xmark"></i></button>
      </div>
      <div class="cgm-notes-panel-list">${notesList}</div>
      <div class="cgm-notes-panel-add">
        <textarea class="cgm-notes-input" placeholder="Write a note..."></textarea>
        <button class="cgm-notes-panel-add-btn">
          <i class="fas fa-plus"></i> Add Note
        </button>
      </div>
    `;

    document.body.appendChild(panel);
    this._notesPanelEl = panel;

    requestAnimationFrame(() => {
      panel.classList.add("cgm-notes-panel-visible");
      // Auto-focus the textarea
      const textarea = panel.querySelector(".cgm-notes-input");
      if (textarea) {
        textarea.focus();
      }
    });

    // ── Draggable header ──
    const header = panel.querySelector(".cgm-notes-panel-header");
    let isDragging = false;
    let dragOffsetX = 0;
    let dragOffsetY = 0;

    header.addEventListener("mousedown", (e) => {
      if (e.target.closest(".cgm-notes-panel-close")) return;
      isDragging = true;
      dragOffsetX = e.clientX - panel.offsetLeft;
      dragOffsetY = e.clientY - panel.offsetTop;
      panel.style.transition = "none";
      header.style.cursor = "grabbing";
    });

    document.addEventListener("mousemove", (e) => {
      if (!isDragging) return;
      e.preventDefault();
      let nx = e.clientX - dragOffsetX;
      let ny = e.clientY - dragOffsetY;
      // Clamp to viewport
      const pw = panel.offsetWidth;
      const ph = panel.offsetHeight;
      nx = Math.max(0, Math.min(nx, window.innerWidth - pw));
      ny = Math.max(0, Math.min(ny, window.innerHeight - ph));
      panel.style.left = nx + "px";
      panel.style.top = ny + "px";
      // Update connecting line
      const ls = this._notesLineStart;
      if (ls) {
        this._updateNotesLine(ls.x, ls.y, nx + pw / 2, ny + ph / 2);
      }
    });

    document.addEventListener("mouseup", () => {
      if (!isDragging) return;
      isDragging = false;
      panel.style.transition = "";
      header.style.cursor = "grab";
      // Save position
      this._notesPanelPos = { left: panel.offsetLeft, top: panel.offsetTop };
      this._savePanelPositions();
    });

    // ── Handlers ──
    const refreshPanel = async () => {
      this._hideNotesPanel();
      await this._showNotesDialog(actorId, wrapEl);
    };

    panel.querySelector(".cgm-notes-panel-close")?.addEventListener("click", (e) => {
      e.stopPropagation();
      this._hideNotesPanel();
    });

    panel.querySelector(".cgm-notes-panel-add-btn")?.addEventListener("click", async () => {
      const input = panel.querySelector(".cgm-notes-input");
      const text = input?.value?.trim();
      if (!text) return;
      await this._addActorNote(actorId, text);
      await refreshPanel();
    });

    panel.querySelectorAll(".cgm-note-delete").forEach(btn => {
      btn.addEventListener("click", async () => {
        const noteId = btn.dataset.noteId;
        await this._deleteActorNote(actorId, noteId);
        await refreshPanel();
      });
    });
  }

  _hideNotesPanel() {
    if (this._notesPanelEl) {
      this._notesPanelEl.classList.remove("cgm-notes-panel-visible");
      setTimeout(() => { this._notesPanelEl?.remove(); this._notesPanelEl = null; }, 200);
    }
    if (this._connectingLineEl) {
      this._connectingLineEl.remove();
      this._connectingLineEl = null;
    }
  }

  _updateNotesLine(startX, startY, endX, endY) {
    if (!this._connectingLineEl) return;
    const svg = this._connectingLineEl.querySelector("svg");
    if (!svg) return;
    const lines = svg.querySelectorAll("line");
    lines.forEach(line => {
      line.setAttribute("x1", startX);
      line.setAttribute("y1", startY);
      line.setAttribute("x2", endX);
      line.setAttribute("y2", endY);
    });
  }

  /* Helper: make a submenu draggable */
  _makeSubMenuDraggable(subMenu, menuType, lineContainer, startX, startY, subHalf, actorId) {
    let isDragging = false;
    let dragOffsetX = 0;
    let dragOffsetY = 0;
    const posKey = actorId + "_" + menuType;

    const onMouseDown = (e) => {
      // Only drag on background/non-interactive areas
      if (e.target.closest(".cgm-sub-seg") || e.target.closest(".cgm-sub-label") || e.target.closest(".cgm-status-back-btn")) {
        return;
      }
      isDragging = true;
      dragOffsetX = e.clientX - subMenu.offsetLeft;
      dragOffsetY = e.clientY - subMenu.offsetTop;
      subMenu.style.cursor = "grabbing";
      subMenu.style.transition = "none";
      e.preventDefault();
    };

    const onMouseMove = (e) => {
      if (!isDragging) return;
      e.preventDefault();
      let nx = e.clientX - dragOffsetX;
      let ny = e.clientY - dragOffsetY;
      const sw = subMenu.offsetWidth;
      const sh = subMenu.offsetHeight;
      nx = Math.max(0, Math.min(nx, window.innerWidth - sw));
      ny = Math.max(0, Math.min(ny, window.innerHeight - sh));
      subMenu.style.left = nx + "px";
      subMenu.style.top = ny + "px";

      // Update line to point to new submenu center
      if (lineContainer) {
        const svg = lineContainer.querySelector("svg");
        if (svg) {
          const newEndX = nx + subHalf;
          const newEndY = ny + subHalf;
          const lines = svg.querySelectorAll("line");
          lines.forEach((line) => {
            line.setAttribute("x2", newEndX);
            line.setAttribute("y2", newEndY);
          });
          // Update gradient
          const grad = svg.querySelector("linearGradient");
          if (grad) {
            grad.setAttribute("x2", newEndX);
            grad.setAttribute("y2", newEndY);
          }
        }
      }
    };

    const onMouseUp = () => {
      if (!isDragging) return;
      isDragging = false;
      subMenu.style.cursor = "grab";
      subMenu.style.transition = "";
      this._subMenuPositions[posKey] = { left: subMenu.offsetLeft, top: subMenu.offsetTop };
      this._savePanelPositions();
    };

    subMenu.addEventListener("mousedown", onMouseDown);
    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);

    // Store cleanup
    subMenu._cgmDragCleanup = () => {
      subMenu.removeEventListener("mousedown", onMouseDown);
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
    };
  }

  /* Helper: make a connected panel draggable */
  _makePanelDraggable(panel, lineStartProp, posProp) {
    const header = panel.querySelector(".cgm-connected-panel-header");
    if (!header) return;
    let isDragging = false;
    let dragOffsetX = 0;
    let dragOffsetY = 0;

    header.addEventListener("mousedown", (e) => {
      if (e.target.closest(".cgm-connected-panel-close")) return;
      isDragging = true;
      dragOffsetX = e.clientX - panel.offsetLeft;
      dragOffsetY = e.clientY - panel.offsetTop;
      panel.style.transition = "none";
      header.style.cursor = "grabbing";
    });

    const onMouseMove = (e) => {
      if (!isDragging) return;
      e.preventDefault();
      let nx = e.clientX - dragOffsetX;
      let ny = e.clientY - dragOffsetY;
      const pw = panel.offsetWidth;
      const ph = panel.offsetHeight;
      nx = Math.max(0, Math.min(nx, window.innerWidth - pw));
      ny = Math.max(0, Math.min(ny, window.innerHeight - ph));
      panel.style.left = nx + "px";
      panel.style.top = ny + "px";
      const ls = this[lineStartProp];
      if (ls) {
        this._updateNotesLine(ls.x, ls.y, nx + pw / 2, ny + ph / 2);
      }
    };

    const onMouseUp = () => {
      if (!isDragging) return;
      isDragging = false;
      panel.style.transition = "";
      header.style.cursor = "grab";
      this[posProp] = { left: panel.offsetLeft, top: panel.offsetTop };
      this._savePanelPositions();
    };

    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);

    // Store cleanup on panel element
    panel._cgmDragCleanup = () => {
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
    };
  }

  /* Helper: make a connected panel resizable */
  _makePanelResizable(panel, sizeProp, minW = 260, minH = 180, maxW = null, maxH = null) {
    const handle = panel.querySelector(".cgm-items-resize-handle");
    if (!handle) return;
    let isResizing = false;

    handle.addEventListener("mousedown", (e) => {
      isResizing = true;
      panel.style.transition = "none";
      e.preventDefault();
    });

    const onMouseMove = (e) => {
      if (!isResizing) return;
      e.preventDefault();
      let nw = Math.max(minW, e.clientX - panel.offsetLeft);
      let nh = Math.max(minH, e.clientY - panel.offsetTop);
      if (maxW && nw > maxW) nw = maxW;
      if (maxH && nh > maxH) nh = maxH;
      panel.style.width = nw + "px";
      panel.style.minHeight = nh + "px";
      panel.style.height = nh + "px";
      const ls = this._itemsLineStart;
      if (ls) {
        this._updateNotesLine(ls.x, ls.y, panel.offsetLeft + nw / 2, panel.offsetTop + nh / 2);
      }
    };

    const onMouseUp = () => {
      if (!isResizing) return;
      isResizing = false;
      panel.style.transition = "";
      this[sizeProp] = {
        width: panel.offsetWidth,
        height: panel.offsetHeight,
      };
      this._savePanelPositions();
    };

    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);

    if (!panel._cgmDragCleanup) {
      panel._cgmDragCleanup = () => {};
    }
    const oldCleanup = panel._cgmDragCleanup;
    panel._cgmDragCleanup = () => {
      oldCleanup();
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
    };
  }

  /* ─── Target / Difficulty Panel ─── */

  _showTargetPanel(actorId, wrapEl) {
    this._hideTargetPanel();
    this._hideTargetSubMenu();
    this._hidePoolsMenu();
    this._hideStatusMenu();

    const actor = game.actors.get(actorId);
    const name = actor?.name || "Character";

    const size = this._radialMenuSize;
    const offset = this._radialMenuOffset;
    const rect = wrapEl.getBoundingClientRect();
    const portraitCx = rect.left + rect.width / 2;
    const portraitCy = rect.top + rect.height / 2;

    const spaceAbove = portraitCy - size / 2;
    const spaceBelow = window.innerHeight - portraitCy - size / 2;
    let mainCy;
    if (spaceAbove >= size + offset && spaceAbove >= spaceBelow) {
      mainCy = rect.top - offset - size / 2;
    } else if (spaceBelow >= size + offset) {
      mainCy = rect.bottom + offset + size / 2;
    } else if (spaceAbove >= size + offset) {
      mainCy = rect.top - offset - size / 2;
    } else {
      mainCy = window.innerHeight / 2;
    }
    const mainCx = portraitCx;
    const mainR = size / 2;
    const clampedCx = Math.max(mainR + 8, Math.min(mainCx, window.innerWidth - mainR - 8));
    const clampedCy = Math.max(mainR + 8, Math.min(mainCy, window.innerHeight - mainR - 8));

    // TARGET slice is index 1 in 9-segment menu
    const targetIndex = 1;
    const targetAngle = (targetIndex + 0.5) * (360 / 9);
    const targetRad = (targetAngle - 90) * Math.PI / 180;

    const lineStartR = mainR - 4;
    const lineLength = 100;
    const lineEndR = lineStartR + lineLength;

    const startX = clampedCx + Math.cos(targetRad) * lineStartR;
    const startY = clampedCy + Math.sin(targetRad) * lineStartR;
    let defX = clampedCx + Math.cos(targetRad) * lineEndR;
    let defY = clampedCy + Math.sin(targetRad) * lineEndR;

    const panelW = 260;
    const panelH = 220;

    // Clamp default position to viewport
    defX = Math.max(panelW / 2 + 8, Math.min(defX, window.innerWidth - panelW / 2 - 8));
    defY = Math.max(panelH / 2 + 8, Math.min(defY, window.innerHeight - panelH / 2 - 8));

    // Use saved position if available, clamped to viewport
    let panelLeft, panelTop;
    if (this._targetPanelPos) {
      const clamped = this._clampPanelPos(this._targetPanelPos.left, this._targetPanelPos.top, panelW, panelH);
      panelLeft = clamped.left;
      panelTop = clamped.top;
      this._targetPanelPos = clamped;
    } else {
      panelLeft = defX - panelW / 2;
      panelTop = defY - panelH / 2;
    }
    const lineEndX = panelLeft + panelW / 2;
    const lineEndY = panelTop + panelH / 2;

    // ── Draw connecting line ──
    const lineContainer = document.createElement("div");
    lineContainer.className = "cgm-status-line-container";
    lineContainer.style.cssText = `position:fixed;left:0;top:0;width:100%;height:100%;z-index:201;pointer-events:none;`;
    const svgNS = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(svgNS, "svg");
    svg.setAttribute("class", "cgm-status-line-svg");
    svg.style.cssText = `position:absolute;left:0;top:0;width:100%;height:100%;overflow:visible;`;
    const line = document.createElementNS(svgNS, "line");
    line.setAttribute("x1", startX); line.setAttribute("y1", startY);
    line.setAttribute("x2", lineEndX); line.setAttribute("y2", lineEndY);
    line.setAttribute("class", "cgm-status-line");
    line.setAttribute("stroke", "rgba(245, 166, 35, 0.7)");
    svg.appendChild(line);
    const glowLine = document.createElementNS(svgNS, "line");
    glowLine.setAttribute("x1", startX); glowLine.setAttribute("y1", startY);
    glowLine.setAttribute("x2", lineEndX); glowLine.setAttribute("y2", lineEndY);
    glowLine.setAttribute("class", "cgm-status-line-glow");
    glowLine.setAttribute("stroke", "rgba(245, 166, 35, 0.3)");
    svg.appendChild(glowLine);
    lineContainer.appendChild(svg);
    document.body.appendChild(lineContainer);
    this._connectingLineEl = lineContainer;
    this._targetLineStart = { x: startX, y: startY };

    requestAnimationFrame(() => lineContainer.classList.add("cgm-status-line-visible"));

    // ── Build panel ──
    const panel = document.createElement("div");
    panel.className = "cgm-connected-panel cgm-target-panel";
    panel.style.cssText = `position:fixed;left:${panelLeft}px;top:${panelTop}px;width:${panelW}px;min-height:${panelH}px;z-index:202;`;

    // ── Difficulty data ──
    const difficultyData = [
      { rate: "100%", desc: "Routine — Anyone can do this basically every time" },
      { rate: "90%",  desc: "Simple — Most people can do this most of the time" },
      { rate: "75%",  desc: "Standard — Typical task requiring focus" },
      { rate: "60%",  desc: "Demanding — Requires full attention" },
      { rate: "45%",  desc: "Difficult — Trained people have a 50/50 chance" },
      { rate: "30%",  desc: "Challenging — Even trained people often fail" },
      { rate: "15%",  desc: "Intimidating — Normal people almost never succeed" },
      { rate: "0%",   desc: "Formidable — Impossible without skills or effort" },
      { rate: "—",    desc: "Heroic — A task worthy of tales" },
      { rate: "—",    desc: "Immortal — A task worthy of legends" },
      { rate: "—",    desc: "Impossible — Breaks the laws of physics" },
      { rate: "—",    desc: "Inconceivable — Beyond mortal comprehension" },
      { rate: "—",    desc: "Apocalyptic — Threatens reality itself" },
      { rate: "—",    desc: "Transcendent — Only gods dare attempt" },
      { rate: "—",    desc: "Absolute — The final limit of existence" },
      { rate: "—",    desc: "Maximum — Nothing greater is possible" },
    ];

    // Load stored difficulty for this actor (individual overrides global)
    const storedDiff = actor?.getFlag("cypher-gm-taskbar", "targetDifficulty");
    const displayDiff = (storedDiff !== undefined && storedDiff !== null)
      ? Math.max(0, Math.min(15, Number(storedDiff)))
      : this._globalDifficulty;

    panel.innerHTML = `
      <div class="cgm-connected-panel-header">
        <i class="fas fa-crosshairs"></i>
        <span>Set Difficulty — ${name}</span>
        <button class="cgm-connected-panel-close"><i class="fas fa-xmark"></i></button>
      </div>
      <div class="cgm-target-body">
        <div class="cgm-target-slider-row">
          <label>Difficulty</label>
          <input type="range" class="cgm-target-slider" min="0" max="15" value="${displayDiff}" step="1">
          <span class="cgm-target-difficulty-val">${displayDiff}</span>
        </div>
        <div class="cgm-target-stats">
          <div class="cgm-target-stat">
            <span class="cgm-target-stat-label">Target Number</span>
            <span class="cgm-target-stat-value cgm-target-tn">${displayDiff * 3}</span>
          </div>
          <div class="cgm-target-stat">
            <span class="cgm-target-stat-label">Success Rate</span>
            <span class="cgm-target-stat-value cgm-target-rate">${difficultyData[displayDiff].rate}</span>
          </div>
        </div>
        <div class="cgm-target-desc">Difficulty ${displayDiff} — ${difficultyData[displayDiff].desc}</div>
        <button class="cgm-target-chat-btn"><i class="fas fa-comment"></i> Send to Chat</button>
      </div>
    `;

    document.body.appendChild(panel);
    this._targetPanelEl = panel;
    // force reflow so transition plays from opacity:0
    panel.offsetHeight;
    requestAnimationFrame(() => requestAnimationFrame(() => panel.classList.add("cgm-connected-panel-visible")));
    this._makePanelDraggable(panel, "_targetLineStart", "_targetPanelPos");

    const slider = panel.querySelector(".cgm-target-slider");
    const diffVal = panel.querySelector(".cgm-target-difficulty-val");
    const tnVal = panel.querySelector(".cgm-target-tn");
    const rateVal = panel.querySelector(".cgm-target-rate");
    const descEl = panel.querySelector(".cgm-target-desc");

    slider.addEventListener("input", async () => {
      const d = parseInt(slider.value, 10);
      diffVal.textContent = d;
      tnVal.textContent = d * 3;
      const data = difficultyData[d];
      rateVal.textContent = data.rate;
      descEl.textContent = `Difficulty ${d} — ${data.desc}`;
      // Save per-actor difficulty
      if (actor) {
        await actor.setFlag("cypher-gm-taskbar", "targetDifficulty", d);
        this._refreshPortraits();
        this._updateOpenRollDialogs();
      }
    });

    panel.querySelector(".cgm-target-chat-btn")?.addEventListener("click", async () => {
      const d = parseInt(slider.value, 10);
      const data = difficultyData[d];
      await ChatMessage.create({
        speaker: { alias: "GM" },
        content: `<div style="padding:6px 10px;background:rgba(245,166,35,0.1);border:1px solid rgba(245,166,35,0.3);border-radius:6px;">
          <strong style="color:#f5a623;">🎯 GM sets difficulty: ${d}</strong><br>
          <span style="color:#aaa;">Target Number: ${d * 3} | Success Rate: ${data.rate}</span><br>
          <em style="color:#888;font-size:12px;">${data.desc}</em>
        </div>`
      });
    });

    panel.querySelector(".cgm-connected-panel-close")?.addEventListener("click", (e) => {
      e.stopPropagation();
      this._hideTargetPanel();
    });

    // Click outside to close
    const closeHandler = (e) => {
      if (!panel.contains(e.target) && !this._connectingLineEl?.contains(e.target) && !e.target.closest('.dialog, .window-app, .application, .file-picker')) {
        this._hideTargetPanel();
        document.removeEventListener("click", closeHandler);
      }
    };
    setTimeout(() => document.addEventListener("click", closeHandler), 10);
  }

  _hideTargetPanel() {
    if (this._targetPanelEl) {
      this._targetPanelEl._cgmDragCleanup?.();
      this._targetPanelEl.classList.remove("cgm-connected-panel-visible");
      setTimeout(() => { this._targetPanelEl?.remove(); this._targetPanelEl = null; }, 200);
    }
    if (this._connectingLineEl) {
      this._connectingLineEl.remove();
      this._connectingLineEl = null;
    }
    this._targetLineStart = null;
  }

  /* ─── Damage Panel ─── */

  _showDamagePanel(actorId, wrapEl) {
    this._hideDamagePanel();
    this._hidePoolsMenu();
    this._hideStatusMenu();

    const actor = game.actors.get(actorId);
    if (!actor) return;
    const name = actor?.name || "Character";

    // Get armor — try multiple possible paths in Cypher System
    let armor = 0;
    try {
      const raw = foundry.utils.getProperty(actor, "system.combat.armor")
        ?? foundry.utils.getProperty(actor, "system.armor")
        ?? foundry.utils.getProperty(actor, "system.pools.armor.value")
        ?? foundry.utils.getProperty(actor, "system.stats.armor.value")
        ?? 0;
      armor = parseInt(raw) || 0;
    } catch {}
    // Get damage track
    let damageTrack = 0;
    try {
      damageTrack = Number(foundry.utils.getProperty(actor, "system.combat.damageTrack")) || 0;
    } catch {}
    const trackLabels = ["Healthy", "Impaired", "Debilitated", "Dead"];

    const size = this._radialMenuSize;
    const rect = wrapEl.getBoundingClientRect();
    const portraitCx = rect.left + rect.width / 2;
    const portraitCy = rect.top + rect.height / 2;
    const offset = this._radialMenuOffset;

    const spaceAbove = portraitCy - size / 2;
    const spaceBelow = window.innerHeight - portraitCy - size / 2;
    let mainCy;
    if (spaceAbove >= size + offset && spaceAbove >= spaceBelow) {
      mainCy = rect.top - offset - size / 2;
    } else if (spaceBelow >= size + offset) {
      mainCy = rect.bottom + offset + size / 2;
    } else if (spaceAbove >= size + offset) {
      mainCy = rect.top - offset - size / 2;
    } else {
      mainCy = window.innerHeight / 2;
    }
    const mainCx = portraitCx;
    const mainR = size / 2;
    const clampedCx = Math.max(mainR + 8, Math.min(mainCx, window.innerWidth - mainR - 8));
    const clampedCy = Math.max(mainR + 8, Math.min(mainCy, window.innerHeight - mainR - 8));

    // DAMAGE slice is index 3 in 10-segment menu
    const damageIndex = 3;
    const damageAngle = (damageIndex + 0.5) * (360 / 10);
    const damageRad = (damageAngle - 90) * Math.PI / 180;

    const lineStartR = mainR - 4;
    const lineLength = 100;
    const lineEndR = lineStartR + lineLength;

    const startX = clampedCx + Math.cos(damageRad) * lineStartR;
    const startY = clampedCy + Math.sin(damageRad) * lineStartR;
    let defX = clampedCx + Math.cos(damageRad) * lineEndR;
    let defY = clampedCy + Math.sin(damageRad) * lineEndR;

    const panelW = 260;
    const panelH = 280;

    defX = Math.max(panelW / 2 + 8, Math.min(defX, window.innerWidth - panelW / 2 - 8));
    defY = Math.max(panelH / 2 + 8, Math.min(defY, window.innerHeight - panelH / 2 - 8));

    let panelLeft, panelTop;
    if (this._damagePanelPos) {
      const clamped = this._clampPanelPos(this._damagePanelPos.left, this._damagePanelPos.top, panelW, panelH);
      panelLeft = clamped.left;
      panelTop = clamped.top;
      this._damagePanelPos = clamped;
    } else {
      panelLeft = defX - panelW / 2;
      panelTop = defY - panelH / 2;
    }
    const lineEndX = panelLeft + panelW / 2;
    const lineEndY = panelTop + panelH / 2;

    // ── Draw connecting line ──
    const lineContainer = document.createElement("div");
    lineContainer.className = "cgm-status-line-container";
    lineContainer.style.cssText = `position:fixed;left:0;top:0;width:100%;height:100%;z-index:201;pointer-events:none;`;
    const svgNS = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(svgNS, "svg");
    svg.setAttribute("class", "cgm-status-line-svg");
    svg.style.cssText = `position:absolute;left:0;top:0;width:100%;height:100%;overflow:visible;`;
    const line = document.createElementNS(svgNS, "line");
    line.setAttribute("x1", startX); line.setAttribute("y1", startY);
    line.setAttribute("x2", lineEndX); line.setAttribute("y2", lineEndY);
    line.setAttribute("class", "cgm-status-line");
    line.setAttribute("stroke", "rgba(204, 51, 51, 0.7)");
    svg.appendChild(line);
    const glowLine = document.createElementNS(svgNS, "line");
    glowLine.setAttribute("x1", startX); glowLine.setAttribute("y1", startY);
    glowLine.setAttribute("x2", lineEndX); glowLine.setAttribute("y2", lineEndY);
    glowLine.setAttribute("class", "cgm-status-line-glow");
    glowLine.setAttribute("stroke", "rgba(204, 51, 51, 0.3)");
    svg.appendChild(glowLine);
    lineContainer.appendChild(svg);
    document.body.appendChild(lineContainer);
    this._connectingLineEl = lineContainer;
    this._damageLineStart = { x: startX, y: startY };

    requestAnimationFrame(() => lineContainer.classList.add("cgm-status-line-visible"));

    // ── Build panel ──
    const panel = document.createElement("div");
    panel.className = "cgm-connected-panel cgm-damage-panel";
    panel.style.cssText = `position:fixed;left:${panelLeft}px;top:${panelTop}px;width:${panelW}px;min-height:${panelH}px;z-index:202;`;

    panel.innerHTML = `
      <div class="cgm-connected-panel-header">
        <i class="fas fa-skull"></i>
        <span>Damage: ${name}</span>
        <button class="cgm-connected-panel-close"><i class="fas fa-xmark"></i></button>
      </div>
      <div class="cgm-damage-body">
        <div class="cgm-damage-row">
          <div class="cgm-damage-field">
            <label>Damage</label>
            <input type="number" class="cgm-damage-input" value="4" min="0">
          </div>
          <div class="cgm-damage-field">
            <label>Armor</label>
            <span class="cgm-damage-armor">${armor}</span>
          </div>
        </div>
        <div class="cgm-damage-result">
          <span class="cgm-damage-result-label">Result:</span>
          <span class="cgm-damage-result-value">4 − ${armor} = <strong>${Math.max(0, 4 - armor)}</strong></span>
        </div>
        <div class="cgm-damage-pool-row">
          <label>Apply to Pool:</label>
          <select class="cgm-damage-pool-select">
            <option value="might">Might</option>
            <option value="speed">Speed</option>
            <option value="intellect">Intellect</option>
          </select>
        </div>
        <button class="cgm-damage-apply-btn"><i class="fas fa-bolt"></i> Apply Damage</button>
        <div class="cgm-damage-track">
          <label>Damage Track</label>
          <div class="cgm-damage-track-bar">
            ${trackLabels.map((l, i) => `<div class="cgm-damage-track-seg ${i === damageTrack ? 'cgm-damage-track-active' : ''} ${i < damageTrack ? 'cgm-damage-track-past' : ''}">${l}</div>`).join('')}
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(panel);
    this._damagePanelEl = panel;
    panel.offsetHeight;
    requestAnimationFrame(() => requestAnimationFrame(() => panel.classList.add("cgm-connected-panel-visible")));
    this._makePanelDraggable(panel, "_damageLineStart", "_damagePanelPos");

    // ── Handlers ──
    const damageInput = panel.querySelector(".cgm-damage-input");
    const resultValue = panel.querySelector(".cgm-damage-result-value");
    const applyBtn = panel.querySelector(".cgm-damage-apply-btn");
    const poolSelect = panel.querySelector(".cgm-damage-pool-select");

    const updateResult = () => {
      const dmg = parseInt(damageInput.value, 10) || 0;
      const res = Math.max(0, dmg - armor);
      resultValue.innerHTML = `${dmg} − ${armor} = <strong>${res}</strong>`;
    };

    damageInput?.addEventListener("input", updateResult);

    applyBtn?.addEventListener("click", async () => {
      const dmg = parseInt(damageInput.value, 10) || 0;
      const pool = poolSelect.value;
      const path = this._getPoolPath(actor, pool);
      if (!path) {
        ui.notifications.warn("Could not determine pool path.");
        return;
      }
      const current = Number(foundry.utils.getProperty(actor, path) ?? 0);
      const res = Math.max(0, dmg - armor);
      const newVal = Math.max(0, current - res);
      await actor.update({ [path]: newVal });
      ui.notifications.info(`${actor.name} takes ${res} ${pool} damage (${current} → ${newVal}).`);
      // Check for damage track advancement
      if (newVal === 0 && damageTrack < 3) {
        const newTrack = damageTrack + 1;
        await actor.update({ "system.combat.damageTrack": newTrack });
        ui.notifications.warn(`${actor.name} is now ${trackLabels[newTrack]}!`);
      }
      this._hideDamagePanel();
    });

    panel.querySelector(".cgm-connected-panel-close")?.addEventListener("click", (e) => {
      e.stopPropagation();
      this._hideDamagePanel();
    });

    const closeHandler = (e) => {
      if (!panel.contains(e.target) && !this._connectingLineEl?.contains(e.target) && !e.target.closest('.dialog, .window-app, .application, .file-picker')) {
        this._hideDamagePanel();
        document.removeEventListener("click", closeHandler);
      }
    };
    setTimeout(() => document.addEventListener("click", closeHandler), 10);
  }

  _hideDamagePanel() {
    if (this._damagePanelEl) {
      this._damagePanelEl._cgmDragCleanup?.();
      this._damagePanelEl.classList.remove("cgm-connected-panel-visible");
      setTimeout(() => { this._damagePanelEl?.remove(); this._damagePanelEl = null; }, 200);
    }
    if (this._connectingLineEl) {
      this._connectingLineEl.remove();
      this._connectingLineEl = null;
    }
    this._damageLineStart = null;
  }

  /* ─── Recovery Panel ─── */

  _getActorRecoveryState(actor) {
    // Try recoveryRolls array first (Cypher Taskbar format)
    const sys = actor.system ?? {};
    let rolls = null;
    if (Array.isArray(sys.combat?.recoveries?.recoveryRolls)) rolls = sys.combat.recoveries.recoveryRolls;
    else if (Array.isArray(sys.recoveries?.recoveryRolls)) rolls = sys.recoveries.recoveryRolls;
    else if (Array.isArray(sys.combat?.recoveryRolls)) rolls = sys.combat.recoveryRolls;

    if (rolls) {
      // rolls is [bool, bool, bool, bool] where true = available
      return [
        { key: "action", label: "1 Action", available: !!rolls[0] },
        { key: "tenmin", label: "10 Min", available: !!rolls[1] },
        { key: "hour", label: "1 Hour", available: !!rolls[2] },
        { key: "tenhour", label: "10 Hours", available: !!rolls[3] },
      ];
    }

    // Fallback to individual flags (GM Taskbar format)
    const rec = sys.combat?.recoveries || {};
    return [
      { key: "action", label: "1 Action", available: !rec.oneAction },
      { key: "tenmin", label: "10 Min", available: !rec.tenMinutes },
      { key: "hour", label: "1 Hour", available: !rec.oneHour },
      { key: "tenhour", label: "10 Hours", available: !rec.tenHours },
    ];
  }

  async _spendRecoveryRoll(actor, index) {
    const sys = actor.system ?? {};
    const updates = {};

    // Update recoveryRolls array if it exists
    let rollsPath = null;
    if (Array.isArray(sys.combat?.recoveries?.recoveryRolls)) rollsPath = "system.combat.recoveries.recoveryRolls";
    else if (Array.isArray(sys.recoveries?.recoveryRolls)) rollsPath = "system.recoveries.recoveryRolls";
    else if (Array.isArray(sys.combat?.recoveryRolls)) rollsPath = "system.combat.recoveryRolls";

    if (rollsPath) {
      const arr = [...foundry.utils.getProperty(actor, rollsPath)];
      arr[index] = false; // spent
      updates[rollsPath] = arr;
    }

    // Also update individual flags for GM taskbar compatibility
    const flagMap = ["oneAction", "tenMinutes", "oneHour", "tenHours"];
    updates[`system.combat.recoveries.${flagMap[index]}`] = true; // true = used in GM format

    await actor.update(updates);
  }

  async _resetAllRecoveries(actor) {
    const sys = actor.system ?? {};
    const updates = {};

    // Update recoveryRolls array if it exists
    let rollsPath = null;
    if (Array.isArray(sys.combat?.recoveries?.recoveryRolls)) rollsPath = "system.combat.recoveries.recoveryRolls";
    else if (Array.isArray(sys.recoveries?.recoveryRolls)) rollsPath = "system.recoveries.recoveryRolls";
    else if (Array.isArray(sys.combat?.recoveryRolls)) rollsPath = "system.combat.recoveryRolls";

    if (rollsPath) {
      updates[rollsPath] = [true, true, true, true];
    }

    // Also update individual flags
    updates["system.combat.recoveries.oneAction"] = false;
    updates["system.combat.recoveries.tenMinutes"] = false;
    updates["system.combat.recoveries.oneHour"] = false;
    updates["system.combat.recoveries.tenHours"] = false;

    await actor.update(updates);
  }

  _showRecoveryPanel(actorId, wrapEl) {
    this._hideRecoveryPanel();
    this._hidePoolsMenu();
    this._hideStatusMenu();

    const actor = game.actors.get(actorId);
    if (!actor) return;
    const name = actor?.name || "Character";

    // Get tier
    let tier = 1;
    try {
      tier = Number(foundry.utils.getProperty(actor, "system.basic.tier") ?? 1);
    } catch {}

    // Read actual recovery state from actor
    const recoveryState = this._getActorRecoveryState(actor);

    const size = this._radialMenuSize;
    const rect = wrapEl.getBoundingClientRect();
    const portraitCx = rect.left + rect.width / 2;
    const portraitCy = rect.top + rect.height / 2;
    const offset = this._radialMenuOffset;

    const spaceAbove = portraitCy - size / 2;
    const spaceBelow = window.innerHeight - portraitCy - size / 2;
    let mainCy;
    if (spaceAbove >= size + offset && spaceAbove >= spaceBelow) {
      mainCy = rect.top - offset - size / 2;
    } else if (spaceBelow >= size + offset) {
      mainCy = rect.bottom + offset + size / 2;
    } else if (spaceAbove >= size + offset) {
      mainCy = rect.top - offset - size / 2;
    } else {
      mainCy = window.innerHeight / 2;
    }
    const mainCx = portraitCx;
    const mainR = size / 2;
    const clampedCx = Math.max(mainR + 8, Math.min(mainCx, window.innerWidth - mainR - 8));
    const clampedCy = Math.max(mainR + 8, Math.min(mainCy, window.innerHeight - mainR - 8));

    // RECOVERY slice is index 4 in 9-segment menu
    const recIndex = 4;
    const recAngle = (recIndex + 0.5) * (360 / 9);
    const recRad = (recAngle - 90) * Math.PI / 180;

    const lineStartR = mainR - 4;
    const lineLength = 100;
    const lineEndR = lineStartR + lineLength;

    const startX = clampedCx + Math.cos(recRad) * lineStartR;
    const startY = clampedCy + Math.sin(recRad) * lineStartR;
    let defX = clampedCx + Math.cos(recRad) * lineEndR;
    let defY = clampedCy + Math.sin(recRad) * lineEndR;

    const panelW = 280;
    const panelH = 340;

    defX = Math.max(panelW / 2 + 8, Math.min(defX, window.innerWidth - panelW / 2 - 8));
    defY = Math.max(panelH / 2 + 8, Math.min(defY, window.innerHeight - panelH / 2 - 8));

    let panelLeft, panelTop;
    if (this._recoveryPanelPos) {
      const clamped = this._clampPanelPos(this._recoveryPanelPos.left, this._recoveryPanelPos.top, panelW, panelH);
      panelLeft = clamped.left;
      panelTop = clamped.top;
      this._recoveryPanelPos = clamped;
    } else {
      panelLeft = defX - panelW / 2;
      panelTop = defY - panelH / 2;
    }
    const lineEndX = panelLeft + panelW / 2;
    const lineEndY = panelTop + panelH / 2;

    // ── Draw connecting line ──
    const lineContainer = document.createElement("div");
    lineContainer.className = "cgm-status-line-container";
    lineContainer.style.cssText = `position:fixed;left:0;top:0;width:100%;height:100%;z-index:201;pointer-events:none;`;
    const svgNS = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(svgNS, "svg");
    svg.setAttribute("class", "cgm-status-line-svg");
    svg.style.cssText = `position:absolute;left:0;top:0;width:100%;height:100%;overflow:visible;`;
    const line = document.createElementNS(svgNS, "line");
    line.setAttribute("x1", startX); line.setAttribute("y1", startY);
    line.setAttribute("x2", lineEndX); line.setAttribute("y2", lineEndY);
    line.setAttribute("class", "cgm-status-line");
    line.setAttribute("stroke", "rgba(68, 170, 102, 0.7)");
    svg.appendChild(line);
    const glowLine = document.createElementNS(svgNS, "line");
    glowLine.setAttribute("x1", startX); glowLine.setAttribute("y1", startY);
    glowLine.setAttribute("x2", lineEndX); glowLine.setAttribute("y2", lineEndY);
    glowLine.setAttribute("class", "cgm-status-line-glow");
    glowLine.setAttribute("stroke", "rgba(68, 170, 102, 0.3)");
    svg.appendChild(glowLine);
    lineContainer.appendChild(svg);
    document.body.appendChild(lineContainer);
    this._connectingLineEl = lineContainer;
    this._recoveryLineStart = { x: startX, y: startY };

    requestAnimationFrame(() => lineContainer.classList.add("cgm-status-line-visible"));

    // ── Build panel ──
    const panel = document.createElement("div");
    panel.className = "cgm-connected-panel cgm-recovery-panel";
    panel.style.cssText = `position:fixed;left:${panelLeft}px;top:${panelTop}px;width:${panelW}px;min-height:${panelH}px;z-index:202;`;

    const recButtons = recoveryState.map((r, idx) => {
      const isUsed = !r.available;
      return `<button class="cgm-recovery-btn ${isUsed ? 'cgm-recovery-used' : ''}" data-key="${r.key}" data-index="${idx}" ${isUsed ? 'disabled' : ''}>
        ${isUsed ? '<i class="fas fa-check"></i>' : ''} ${r.label}
      </button>`;
    }).join("");

    panel.innerHTML = `
      <div class="cgm-connected-panel-header">
        <i class="fas fa-bed"></i>
        <span>Recovery: ${name}</span>
        <button class="cgm-connected-panel-close"><i class="fas fa-xmark"></i></button>
      </div>
      <div class="cgm-recovery-body">
        <div class="cgm-recovery-tier">Tier ${tier} — Recovery roll: 1d6 + ${tier}</div>
        <div class="cgm-recovery-buttons">${recButtons}</div>
        <div class="cgm-recovery-roll-area" style="display:none;">
          <div class="cgm-recovery-roll-result"></div>
          <div class="cgm-recovery-distribute">
            <label>Distribute points:</label>
            <div class="cgm-recovery-dist-row">
              <span>Might</span>
              <button class="cgm-recovery-dist-btn" data-pool="might" data-delta="-1">−</button>
              <span class="cgm-recovery-dist-val" data-pool="might">0</span>
              <button class="cgm-recovery-dist-btn" data-pool="might" data-delta="+1">+</button>
            </div>
            <div class="cgm-recovery-dist-row">
              <span>Speed</span>
              <button class="cgm-recovery-dist-btn" data-pool="speed" data-delta="-1">−</button>
              <span class="cgm-recovery-dist-val" data-pool="speed">0</span>
              <button class="cgm-recovery-dist-btn" data-pool="speed" data-delta="+1">+</button>
            </div>
            <div class="cgm-recovery-dist-row">
              <span>Intellect</span>
              <button class="cgm-recovery-dist-btn" data-pool="intellect" data-delta="-1">−</button>
              <span class="cgm-recovery-dist-val" data-pool="intellect">0</span>
              <button class="cgm-recovery-dist-btn" data-pool="intellect" data-delta="+1">+</button>
            </div>
          </div>
          <button class="cgm-recovery-apply-btn"><i class="fas fa-check"></i> Apply Recovery</button>
        </div>
        <button class="cgm-recovery-reset-btn"><i class="fas fa-rotate-left"></i> Reset All Recoveries</button>
      </div>
    `;

    document.body.appendChild(panel);
    this._recoveryPanelEl = panel;
    panel.offsetHeight;
    requestAnimationFrame(() => requestAnimationFrame(() => panel.classList.add("cgm-connected-panel-visible")));
    this._makePanelDraggable(panel, "_recoveryLineStart", "_recoveryPanelPos");

    // ── Handlers ──
    let rollTotal = 0;
    let distribution = { might: 0, speed: 0, intellect: 0 };

    const rollArea = panel.querySelector(".cgm-recovery-roll-area");
    const rollResult = panel.querySelector(".cgm-recovery-roll-result");

    panel.querySelectorAll(".cgm-recovery-btn:not(:disabled)").forEach(btn => {
      btn.addEventListener("click", async () => {
        const key = btn.dataset.key;
        const idx = parseInt(btn.dataset.index, 10);
        // Roll 1d6 + tier
        const roll = Math.floor(Math.random() * 6) + 1;
        rollTotal = roll + tier;

        // Spend the recovery roll on the actor (syncs with Actor Sheet & Cypher Taskbar)
        if (!Number.isNaN(idx)) {
          await this._spendRecoveryRoll(actor, idx);
        }

        rollArea.style.display = "block";
        rollResult.innerHTML = `<span class="cgm-recovery-dice">🎲 ${roll} + ${tier} = <strong>${rollTotal}</strong></span>`;

        // Disable the clicked button
        btn.disabled = true;
        btn.classList.add("cgm-recovery-used");
        btn.innerHTML = `<i class="fas fa-check"></i> ${btn.textContent.trim()}`;
      });
    });

    panel.querySelectorAll(".cgm-recovery-dist-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        const pool = btn.dataset.pool;
        const delta = parseInt(btn.dataset.delta, 10);
        const current = distribution[pool] || 0;
        const newVal = Math.max(0, current + delta);
        distribution[pool] = newVal;
        const valEl = panel.querySelector(`.cgm-recovery-dist-val[data-pool="${pool}"]`);
        if (valEl) valEl.textContent = newVal;
      });
    });

    panel.querySelector(".cgm-recovery-apply-btn")?.addEventListener("click", async () => {
      const totalDist = (distribution.might || 0) + (distribution.speed || 0) + (distribution.intellect || 0);
      if (totalDist !== rollTotal) {
        ui.notifications.warn(`Distribute exactly ${rollTotal} points (currently ${totalDist}).`);
        return;
      }
      for (const [pool, val] of Object.entries(distribution)) {
        if (val <= 0) continue;
        const path = this._getPoolPath(actor, pool);
        if (!path) continue;
        const current = Number(foundry.utils.getProperty(actor, path) ?? 0);
        const maxPath = this._getPoolMaxPath(actor, pool);
        const max = maxPath ? Number(foundry.utils.getProperty(actor, maxPath) ?? 0) : 999;
        const newVal = Math.min(max, current + val);
        await actor.update({ [path]: newVal });
      }
      ui.notifications.info(`${actor.name} recovered ${rollTotal} points!`);
      this._hideRecoveryPanel();
    });

    panel.querySelector(".cgm-recovery-reset-btn")?.addEventListener("click", async () => {
      await this._resetAllRecoveries(actor);
      ui.notifications.info(`${actor.name} recovery rolls reset.`);
      this._hideRecoveryPanel();
    });

    panel.querySelector(".cgm-connected-panel-close")?.addEventListener("click", (e) => {
      e.stopPropagation();
      this._hideRecoveryPanel();
    });

    const closeHandler = (e) => {
      if (!panel.contains(e.target) && !this._connectingLineEl?.contains(e.target) && !e.target.closest('.dialog, .window-app, .application, .file-picker')) {
        this._hideRecoveryPanel();
        document.removeEventListener("click", closeHandler);
      }
    };
    setTimeout(() => document.addEventListener("click", closeHandler), 10);
  }

  _hideRecoveryPanel() {
    if (this._recoveryPanelEl) {
      this._recoveryPanelEl._cgmDragCleanup?.();
      this._recoveryPanelEl.classList.remove("cgm-connected-panel-visible");
      setTimeout(() => { this._recoveryPanelEl?.remove(); this._recoveryPanelEl = null; }, 200);
    }
    if (this._connectingLineEl) {
      this._connectingLineEl.remove();
      this._connectingLineEl = null;
    }
    this._recoveryLineStart = null;
  }

  /* ─── Cyphers Panel ─── */

  _showCyphersPanel(actorId, wrapEl) {
    this._hideCyphersPanel();
    this._hidePoolsMenu();
    this._hideStatusMenu();

    const actor = game.actors.get(actorId);
    if (!actor) return;
    const name = actor?.name || "Character";

    // Get cyphers and artifacts
    const cyphers = actor.items?.filter(i => i.type === "cypher") || [];
    const artifacts = actor.items?.filter(i => i.type === "artifact") || [];
    const allItems = [...cyphers, ...artifacts];
    // Get cypher limit
    let cypherLimit = 2;
    try {
      cypherLimit = Number(foundry.utils.getProperty(actor, "system.basic.cypherLimit") ?? 2);
    } catch {}
    if (cypherLimit <= 0) cypherLimit = 2;

    const size = this._radialMenuSize;
    const rect = wrapEl.getBoundingClientRect();
    const portraitCx = rect.left + rect.width / 2;
    const portraitCy = rect.top + rect.height / 2;
    const offset = this._radialMenuOffset;

    const spaceAbove = portraitCy - size / 2;
    const spaceBelow = window.innerHeight - portraitCy - size / 2;
    let mainCy;
    if (spaceAbove >= size + offset && spaceAbove >= spaceBelow) {
      mainCy = rect.top - offset - size / 2;
    } else if (spaceBelow >= size + offset) {
      mainCy = rect.bottom + offset + size / 2;
    } else if (spaceAbove >= size + offset) {
      mainCy = rect.top - offset - size / 2;
    } else {
      mainCy = window.innerHeight / 2;
    }
    const mainCx = portraitCx;
    const mainR = size / 2;
    const clampedCx = Math.max(mainR + 8, Math.min(mainCx, window.innerWidth - mainR - 8));
    const clampedCy = Math.max(mainR + 8, Math.min(mainCy, window.innerHeight - mainR - 8));

    // CYPHERS slice is index 5 in 9-segment menu
    const cypherIndex = 5;
    const cypherAngle = (cypherIndex + 0.5) * (360 / 9);
    const cypherRad = (cypherAngle - 90) * Math.PI / 180;

    const lineStartR = mainR - 4;
    const lineLength = 100;
    const lineEndR = lineStartR + lineLength;

    const startX = clampedCx + Math.cos(cypherRad) * lineStartR;
    const startY = clampedCy + Math.sin(cypherRad) * lineStartR;
    let defX = clampedCx + Math.cos(cypherRad) * lineEndR;
    let defY = clampedCy + Math.sin(cypherRad) * lineEndR;

    const panelW = 260;
    const panelH = Math.min(400, 180 + allItems.length * 50);

    defX = Math.max(panelW / 2 + 8, Math.min(defX, window.innerWidth - panelW / 2 - 8));
    defY = Math.max(panelH / 2 + 8, Math.min(defY, window.innerHeight - panelH / 2 - 8));

    let panelLeft, panelTop;
    if (this._cyphersPanelPos) {
      const clamped = this._clampPanelPos(this._cyphersPanelPos.left, this._cyphersPanelPos.top, panelW, panelH);
      panelLeft = clamped.left;
      panelTop = clamped.top;
      this._cyphersPanelPos = clamped;
    } else {
      panelLeft = defX - panelW / 2;
      panelTop = defY - panelH / 2;
    }
    const lineEndX = panelLeft + panelW / 2;
    const lineEndY = panelTop + panelH / 2;

    // ── Draw connecting line ──
    const lineContainer = document.createElement("div");
    lineContainer.className = "cgm-status-line-container";
    lineContainer.style.cssText = `position:fixed;left:0;top:0;width:100%;height:100%;z-index:201;pointer-events:none;`;
    const svgNS = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(svgNS, "svg");
    svg.setAttribute("class", "cgm-status-line-svg");
    svg.style.cssText = `position:absolute;left:0;top:0;width:100%;height:100%;overflow:visible;`;
    const line = document.createElementNS(svgNS, "line");
    line.setAttribute("x1", startX); line.setAttribute("y1", startY);
    line.setAttribute("x2", lineEndX); line.setAttribute("y2", lineEndY);
    line.setAttribute("class", "cgm-status-line");
    line.setAttribute("stroke", "rgba(136, 85, 204, 0.7)");
    svg.appendChild(line);
    const glowLine = document.createElementNS(svgNS, "line");
    glowLine.setAttribute("x1", startX); glowLine.setAttribute("y1", startY);
    glowLine.setAttribute("x2", lineEndX); glowLine.setAttribute("y2", lineEndY);
    glowLine.setAttribute("class", "cgm-status-line-glow");
    glowLine.setAttribute("stroke", "rgba(136, 85, 204, 0.3)");
    svg.appendChild(glowLine);
    lineContainer.appendChild(svg);
    document.body.appendChild(lineContainer);
    this._connectingLineEl = lineContainer;
    this._cyphersLineStart = { x: startX, y: startY };

    requestAnimationFrame(() => lineContainer.classList.add("cgm-status-line-visible"));

    // ── Build panel ──
    const panel = document.createElement("div");
    panel.className = "cgm-connected-panel cgm-cyphers-panel";
    panel.style.cssText = `position:fixed;left:${panelLeft}px;top:${panelTop}px;width:${panelW}px;min-height:${panelH}px;z-index:202;`;

    const itemList = allItems.length
      ? allItems.map((item, i) => {
          const isCypher = item.type === "cypher";
          return `
            <div class="cgm-cypher-item">
              <div class="cgm-cypher-info">
                <span class="cgm-cypher-name">${this._escapeHTML(item.name)}</span>
                <span class="cgm-cypher-level">Lvl ${item.system?.level ?? "?"}</span>
              </div>
              ${isCypher ? `<button class="cgm-cypher-use-btn" data-index="${i}"><i class="fas fa-flask"></i> Use</button>` : `<span class="cgm-cypher-artifact-tag"><i class="fas fa-gem"></i></span>`}
            </div>
          `;
        }).join("")
      : `<div class="cgm-cypher-empty">No cyphers or artifacts carried</div>`;

    panel.innerHTML = `
      <div class="cgm-connected-panel-header">
        <i class="fas fa-flask"></i>
        <span>Cyphers: ${name}</span>
        <button class="cgm-connected-panel-close"><i class="fas fa-xmark"></i></button>
      </div>
      <div class="cgm-cyphers-body">
        <div class="cgm-cyphers-count">
          <span class="cgm-cyphers-carried">${artifacts.length}</span> / <input type="number" class="cgm-cyphers-limit-input" value="${cypherLimit}" min="1" max="99" title="Artifact limit">
        </div>
        <div class="cgm-cyphers-list">${itemList}</div>
      </div>
    `;

    document.body.appendChild(panel);
    this._cyphersPanelEl = panel;
    panel.offsetHeight;
    requestAnimationFrame(() => requestAnimationFrame(() => panel.classList.add("cgm-connected-panel-visible")));
    this._makePanelDraggable(panel, "_cyphersLineStart", "_cyphersPanelPos");

    // ── Limit input handler ──
    const limitInput = panel.querySelector(".cgm-cyphers-limit-input");
    if (limitInput) {
      limitInput.addEventListener("change", async () => {
        const newLimit = Math.max(1, Math.min(99, parseInt(limitInput.value) || 2));
        limitInput.value = newLimit;
        await actor.update({ "system.basic.cypherLimit": newLimit });
        ui.notifications.info(`${actor.name}'s artifact limit set to ${newLimit}.`);
      });
    }

    // ── Handlers ──
    panel.querySelectorAll(".cgm-cypher-use-btn").forEach(btn => {
      btn.addEventListener("click", async () => {
        const idx = parseInt(btn.dataset.index);
        const item = allItems[idx];
        if (!item || item.type !== "cypher") return;
        // Send to chat that cypher was used
        await ChatMessage.create({
          speaker: { actor: actorId, alias: actor.name },
          content: `<div style="padding:6px 10px;background:rgba(136,85,204,0.1);border:1px solid rgba(136,85,204,0.3);border-radius:6px;">
            <strong style="color:#aa77dd;">🧪 ${actor.name} uses ${item.name}</strong><br>
            <span style="color:#aaa;font-size:12px;">Level ${item.system?.level ?? "?"} Cypher — single use consumed</span>
          </div>`
        });
        // Delete the cypher item (single use)
        await item.delete();
        ui.notifications.info(`${item.name} used and consumed.`);
        this._hideCyphersPanel();
      });
    });

    panel.querySelector(".cgm-connected-panel-close")?.addEventListener("click", (e) => {
      e.stopPropagation();
      this._hideCyphersPanel();
    });

    const closeHandler = (e) => {
      if (!panel.contains(e.target) && !this._connectingLineEl?.contains(e.target) && !e.target.closest('.dialog, .window-app, .application, .file-picker')) {
        this._hideCyphersPanel();
        document.removeEventListener("click", closeHandler);
      }
    };
    setTimeout(() => document.addEventListener("click", closeHandler), 10);
  }

  _hideCyphersPanel() {
    if (this._cyphersPanelEl) {
      this._cyphersPanelEl._cgmDragCleanup?.();
      this._cyphersPanelEl.classList.remove("cgm-connected-panel-visible");
      setTimeout(() => { this._cyphersPanelEl?.remove(); this._cyphersPanelEl = null; }, 200);
    }
    if (this._connectingLineEl) {
      this._connectingLineEl.remove();
      this._connectingLineEl = null;
    }
    this._cyphersLineStart = null;
  }

  /* ─── XP Helpers ─── */

  _getXPPath(actor) {
    const sys = actor.system ?? {};
    if (sys.basic && "xp" in sys.basic) return "system.basic.xp";
    if (sys.advancement && "xp" in sys.advancement) return "system.advancement.xp";
    return null;
  }

  async _modifyXP(actorId, delta) {
    const actor = game.actors.get(actorId);
    if (!actor) return false;
    const xpPath = this._getXPPath(actor);
    if (!xpPath) {
      ui.notifications.warn("Could not determine XP path for this actor.");
      return false;
    }
    const current = Number(foundry.utils.getProperty(actor, xpPath) ?? 0);
    // Cap at 10 XP max, 0 min
    const newVal = Math.max(0, Math.min(10, current + delta));
    if (newVal === current) {
      if (current >= 10 && delta > 0) {
        ui.notifications.warn(`${actor.name} is already at max XP (10).`);
      }
      return false;
    }
    await actor.update({ [xpPath]: newVal });
    const verb = delta > 0 ? "gained" : "lost";
    ui.notifications.info(`${actor.name} ${verb} ${Math.abs(delta)} XP (now ${newVal}).`);
    this.render();
    return true;
  }

  /* ─── Chat Message Helper ─── */

  async _sendIntrusionChatMessage(actor, accepted, gaveXPTo = null) {
    const actorImg = actor?.img || "icons/svg/mystery-man.svg";
    const actorName = actor?.name || "Unknown";
    const acceptedColor = accepted ? "var(--cgm-success)" : "var(--cgm-danger)";
    const acceptedIcon = accepted ? "fa-check-circle" : "fa-times-circle";
    const acceptedText = accepted ? "ACCEPTED" : "REFUSED";
    const xpResult = accepted
      ? `<div style="margin-top:6px; color:var(--cgm-accent); font-size:12px;">
           <i class="fas fa-plus-circle" style="margin-right:4px;"></i> +1 XP (accepted intrusion)
         </div>`
      : `<div style="margin-top:6px; color:var(--cgm-danger); font-size:12px;">
           <i class="fas fa-minus-circle" style="margin-right:4px;"></i> -1 XP (refused intrusion)
         </div>`;
    const giveXPResult = gaveXPTo
      ? `<div style="margin-top:4px; color:var(--cgm-success); font-size:12px;">
           <i class="fas fa-gift" style="margin-right:4px;"></i> +1 XP given to <strong>${gaveXPTo.name}</strong>
         </div>`
      : "";

    const content = `
      <div style="display:flex; align-items:flex-start; gap:10px; padding:4px 0;">
        <img src="${actorImg}" style="width:36px; height:36px; border-radius:50%; border:2px solid ${acceptedColor}; object-fit:cover; flex-shrink:0; box-shadow:0 0 8px ${acceptedColor}40;">
        <div style="flex:1;">
          <div style="font-weight:700; font-size:14px; color:var(--cgm-text); margin-bottom:2px;">
            ${actorName}
            <span style="color:${acceptedColor}; font-size:12px; margin-left:6px;">
              <i class="fas ${acceptedIcon}" style="margin-right:3px;"></i>${acceptedText}
            </span>
          </div>
          <div style="font-size:12px; color:var(--cgm-text-dim); font-style:italic;">
            GM Intrusion — "Let's make this interesting."
          </div>
          ${xpResult}
          ${giveXPResult}
        </div>
      </div>
    `;

    await ChatMessage.create({
      speaker: { alias: "GM Intrusion", actor: actor?.id },
      content,
      whisper: game.users.filter(u => u.isGM).map(u => u.id)
    });
  }

  /* ─── Intrusion Dialogs ─── */

  async _showIntrusionDialog(actorId) {
    const actor = game.actors.get(actorId);
    const name = actor?.name || "Character";
    const img = actor?.img || "icons/svg/mystery-man.svg";
    const xpPath = this._getXPPath(actor);
    const currentXP = xpPath ? Number(foundry.utils.getProperty(actor, xpPath) ?? 0) : 0;
    const isFull = currentXP >= 10;

    const warningHtml = isFull
      ? `<div class="cgm-intrusion-warning">
           <i class="fas fa-exclamation-triangle"></i>
           Damn dude you are full, if you accept make sure you have a darn good reason!
         </div>`
      : "";

    const content = `
      <div class="cgm-intrusion-dialog">
        <div class="cgm-intrusion-portrait-bg" style="background-image:url('${img}');"></div>
        <div class="cgm-intrusion-header">
          <i class="fas fa-bolt" style="margin-right:6px;"></i>GM Intrusion
        </div>
        <div class="cgm-intrusion-flavor">
          Let's make this interesting.
        </div>
        <div class="cgm-intrusion-question">
          Do you accept GM's <strong>INTRUSION</strong>?
        </div>
        ${warningHtml}
        <div class="cgm-intrusion-target">
          <i class="fas fa-crosshairs"></i> Target: <strong>${name}</strong>
        </div>
      </div>
    `;

    new Dialog({
      title: ``,
      content,
      classes: ["cgm-dark-dialog", "cgm-intrusion-window"],
      buttons: {
        no: {
          icon: '<i class="fas fa-times" style="color:#ff7070;"></i>',
          label: "NO",
          callback: async () => {
            await this._modifyXP(actorId, -1);
            this._sendIntrusionChatMessage(actor, false);
          }
        },
        yes: {
          icon: '<i class="fas fa-check" style="color:#40b060;"></i>',
          label: "YES",
          callback: async () => {
            await this._modifyXP(actorId, 1);
            this._showGiveXPDialog(actorId);
          }
        }
      },
      default: "yes"
    }).render(true);
  }

  async _showGiveXPDialog(sourceActorId) {
    const sourceActor = game.actors.get(sourceActorId);
    const sourceName = sourceActor?.name || "Character";
    const sourceImg = sourceActor?.img || "icons/svg/mystery-man.svg";
    const pcs = this._getPartyData().filter(pc => {
      if (pc.id === sourceActorId) return false;
      const actor = game.actors.get(pc.id);
      if (!actor) return false;
      const xpPath = this._getXPPath(actor);
      if (!xpPath) return true; // include if we can't check
      const xp = Number(foundry.utils.getProperty(actor, xpPath) ?? 0);
      return xp < 10; // exclude players at max XP
    });

    const options = pcs.map(pc => `
      <option value="${pc.id}">${pc.name}</option>
    `).join("");

    const content = `
      <div class="cgm-give-xp-dialog">
        <div class="cgm-give-xp-source">
          <img src="${sourceImg}" alt="${sourceName}">
          <div class="cgm-give-xp-source-name">${sourceName}</div>
          <div class="cgm-give-xp-source-label">shares the wealth</div>
        </div>
        <div class="cgm-give-xp-flavor">
          So who is the lucky one<br>you will give XP to?
        </div>
        <div class="cgm-give-xp-select-wrap">
          <select id="cgm-give-xp-target" class="cgm-give-xp-select">
            <option value="" disabled selected style="color:#000000;">Select a character...</option>
            ${options}
          </select>
        </div>
      </div>
    `;

    new Dialog({
      title: ``,
      content,
      classes: ["cgm-dark-dialog"],
      buttons: {
        confirm: {
          icon: '<i class="fas fa-gift"></i>',
          label: "CONFIRM",
          callback: async (html) => {
            const el = html[0] || html;
            const select = el.querySelector ? el.querySelector("#cgm-give-xp-target") : html.find("#cgm-give-xp-target")[0];
            const targetId = select?.value;
            if (!targetId) {
              ui.notifications.warn("Please select a character to give XP to.");
              return;
            }
            const targetActor = game.actors.get(targetId);
            await this._modifyXP(targetId, 1);
            this._sendIntrusionChatMessage(sourceActor, true, targetActor);
          }
        }
      },
      default: "confirm"
    }).render(true);
  }

  /* ─── Notes Tooltip ─── */

  _showNotesTooltip(actorId, targetEl) {
    this._hideNotesTooltip();
    const notes = this._getActorNotes(actorId);
    if (!notes.length) return;

    const actor = game.actors.get(actorId);
    const name = actor?.name || "Character";

    const tooltip = document.createElement("div");
    tooltip.className = "cgm-notes-tooltip";
    tooltip.innerHTML = `
      <div class="cgm-tooltip-header">
        <i class="fas fa-sticky-note"></i> Notes: ${name}
      </div>
      <div class="cgm-tooltip-body">
        ${notes.map((n, i) => `
          <div class="cgm-tooltip-note" data-index="${i}">
            <label class="cgm-tooltip-check">
              <input type="checkbox" data-index="${i}" data-actor-id="${actorId}">
              <span class="cgm-check-mark"></span>
            </label>
            <div class="cgm-tooltip-content">
              <div class="cgm-tooltip-time">${n.date} ${n.time}</div>
              <div class="cgm-tooltip-text">${this._escapeHTML(n.text)}</div>
            </div>
          </div>
        `).join("")}
      </div>
    `;

    document.body.appendChild(tooltip);
    this._tooltipEl = tooltip;

    // Position ABOVE the portrait
    const rect = targetEl.getBoundingClientRect();
    const tRect = tooltip.getBoundingClientRect();
    let left = rect.left + rect.width / 2 - tRect.width / 2;
    let top = rect.top - tRect.height - 8;
    if (left < 8) left = 8;
    if (left + tRect.width > window.innerWidth - 8) left = window.innerWidth - tRect.width - 8;
    if (top < 8) top = rect.bottom + 8;
    if (top + tRect.height > window.innerHeight - 8) top = window.innerHeight - tRect.height - 8;
    tooltip.style.left = `${left}px`;
    tooltip.style.top = `${top}px`;
    tooltip.classList.add("cgm-tooltip-visible");

    // Checkbox archive handler
    tooltip.querySelectorAll('.cgm-tooltip-check input[type="checkbox"]').forEach(chk => {
      chk.addEventListener("change", async (e) => {
        e.stopPropagation();
        const idx = parseInt(chk.dataset.index);
        const aid = chk.dataset.actorId;
        await this._archiveActorNote(aid, idx);
        const noteRow = tooltip.querySelector(`.cgm-tooltip-note[data-index="${idx}"]`);
        if (noteRow) {
          noteRow.style.transition = "opacity 0.2s, transform 0.2s";
          noteRow.style.opacity = "0";
          noteRow.style.transform = "translateX(10px)";
          setTimeout(() => {
            noteRow.remove();
            if (!tooltip.querySelector(".cgm-tooltip-note")) {
              this._hideNotesTooltip();
            }
          }, 200);
        }
      });
    });

    // Keep tooltip alive when hovering over it
    tooltip.addEventListener("mouseenter", () => {
      clearTimeout(this._tooltipTimer);
    });
    tooltip.addEventListener("mouseleave", () => {
      this._hideNotesTooltip();
    });
  }

  _hideNotesTooltip() {
    if (this._tooltipEl) {
      this._tooltipEl.remove();
      this._tooltipEl = null;
    }
    if (this._tooltipTimer) {
      clearTimeout(this._tooltipTimer);
      this._tooltipTimer = null;
    }
  }

  /* ─── Effect Tooltip ─── */

  _showEffectTooltip(effect, targetEl) {
    this._hideEffectTooltip();

    const tooltip = document.createElement("div");
    tooltip.className = "cgm-effect-tooltip";

    const plainDesc = effect.description ? effect.description.replace(/<[^>]*>/g, '') : '';
    const descHtml = plainDesc
      ? this._escapeHTML(plainDesc).replace(/\n/g, "<br>")
      : '<em style="opacity:0.6">No description.</em>';

    const tempBadge = effect.isTemporary
      ? '<span class="cgm-effect-tooltip-temp"><i class="fas fa-hourglass-half"></i> Temporary</span>'
      : '';

    tooltip.innerHTML = `
      <div class="cgm-effect-tooltip-header">
        <img src="${effect.icon}" alt="" class="cgm-effect-tooltip-icon">
        <div class="cgm-effect-tooltip-title">
          ${effect.name}
          ${tempBadge}
        </div>
      </div>
      <div class="cgm-effect-tooltip-body">
        ${descHtml}
      </div>
    `;

    document.body.appendChild(tooltip);
    this._effectTooltipEl = tooltip;

    // Position ABOVE the icon
    const rect = targetEl.getBoundingClientRect();
    const tRect = tooltip.getBoundingClientRect();
    let left = rect.left + rect.width / 2 - tRect.width / 2;
    let top = rect.top - tRect.height - 8;

    if (left < 8) left = 8;
    if (left + tRect.width > window.innerWidth - 8) left = window.innerWidth - tRect.width - 8;
    if (top < 8) top = rect.bottom + 8;
    if (top + tRect.height > window.innerHeight - 8) top = window.innerHeight - tRect.height - 8;

    tooltip.style.left = `${left}px`;
    tooltip.style.top = `${top}px`;
    tooltip.classList.add("cgm-effect-tooltip-visible");

    // Keep alive on hover
    tooltip.addEventListener("mouseenter", () => {
      clearTimeout(this._effectTooltipTimer);
    });
    tooltip.addEventListener("mouseleave", () => {
      this._hideEffectTooltip();
    });
  }

  _hideEffectTooltip() {
    if (this._effectTooltipEl) {
      this._effectTooltipEl.remove();
      this._effectTooltipEl = null;
    }
    if (this._effectTooltipTimer) {
      clearTimeout(this._effectTooltipTimer);
      this._effectTooltipTimer = null;
    }
  }

  _bindPortraitEvents() {
    if (!this.element) return;

    // Event delegation for effect icon hover tooltips (works even after DOM updates)
    const float = this.element.querySelector('.cgm-portraits-float');
    if (float) {
      float.addEventListener('mouseenter', (e) => {
        const icon = e.target.closest('.cgm-effect-icon');
        if (!icon) return;
        const wrap = icon.closest('.cgm-portrait-wrap');
        if (!wrap) return;
        const actorId = wrap.dataset.actorId;
        const effectId = icon.dataset.effectId;
        const actor = game.actors.get(actorId);
        const effect = actor?.effects.get(effectId);
        if (!effect) return;
        e.stopPropagation(); // don't trigger portrait hover
        this._effectTooltipTimer = setTimeout(() => {
          this._showEffectTooltip({
            id: effect.id,
            name: effect.name || effect.label || "Unknown Effect",
            icon: effect.img || effect.icon || "icons/svg/aura.svg",
            description: effect.description || "",
            isTemporary: effect.isTemporary || false
          }, icon);
        }, 300);
      }, true);
      float.addEventListener('mouseleave', (e) => {
        const icon = e.target.closest('.cgm-effect-icon');
        if (!icon) return;
        clearTimeout(this._effectTooltipTimer);
        this._effectTooltipTimer = setTimeout(() => {
          this._hideEffectTooltip();
        }, 100);
      }, true);
    }

    this.element.querySelectorAll(".cgm-portrait-wrap").forEach(wrap => {
      const actorId = wrap.dataset.actorId;

      // Left click: open radial menu ABOVE portrait
      wrap.addEventListener("click", (e) => {
        if (e.button !== 0) return;
        e.stopPropagation();
        this._showRadialMenu(actorId, wrap);
      });

      // Right click: open sheet
      wrap.addEventListener("contextmenu", (e) => {
        e.preventDefault();
        e.stopPropagation();
        const actor = game.actors.get(actorId);
        if (actor) actor.sheet.render(true);
      });

      // Hover: show notes tooltip (with delay)
      wrap.addEventListener("mouseenter", () => {
        this._tooltipTimer = setTimeout(() => {
          this._showNotesTooltip(actorId, wrap);
        }, 600);
      });
      wrap.addEventListener("mouseleave", () => {
        // Delayed hide so user can move mouse to tooltip
        this._tooltipTimer = setTimeout(() => {
          this._hideNotesTooltip();
        }, 150);
      });
    });
  }

  /* Refresh portrait data (pools, XP, damage track, difficulty) without full re-render */
  _refreshPortraits() {
    if (!this.element) return;
    const float = this.element.querySelector('.cgm-portraits-float');
    if (!float) return;

    // Sync background panel styles (external element)
    const bg = document.querySelector('.cgm-portraits-bg');
    if (bg) {
      bg.style.backgroundColor = this._portraitBgColor;
      bg.style.opacity = this._portraitBgOpacity / 100;
      bg.classList.remove('cgm-portraits-bg-trapezoid', 'cgm-portraits-bg-rectangle', 'cgm-portraits-bg-rounded', 'cgm-portraits-bg-none');
      bg.classList.add(`cgm-portraits-bg-${this._portraitBgShape}`);
      bg.dataset.bgShape = this._portraitBgShape;
    }

    const pcs = this._getPartyData();
    const wraps = float.querySelectorAll('.cgm-portrait-wrap');

    wraps.forEach(wrap => {
      const actorId = wrap.dataset.actorId;
      const pc = pcs.find(p => p.id === actorId);
      if (!pc) return;

      // Update difficulty badge
      const diffBadge = wrap.querySelector('.cgm-portrait-difficulty');
      const actor = game.actors.get(pc.id);
      const individualDiff = actor?.getFlag("cypher-gm-taskbar", "targetDifficulty") ?? 0;
      if (diffBadge) {
        diffBadge.classList.toggle('cgm-difficulty-active', individualDiff > 0);
        diffBadge.textContent = individualDiff > 0 ? individualDiff : '';
      }

      // Update pool bars
      const mightFill = wrap.querySelector('.cgm-pool-might');
      const speedFill = wrap.querySelector('.cgm-pool-speed');
      const intellectFill = wrap.querySelector('.cgm-pool-intellect');
      if (mightFill) mightFill.style.width = pc.pools.might.percent + '%';
      if (speedFill) speedFill.style.width = pc.pools.speed.percent + '%';
      if (intellectFill) intellectFill.style.width = pc.pools.intellect.percent + '%';

      // Update XP circle
      const xpWrap = wrap.querySelector('.cgm-xp-wrap');
      if (xpWrap) {
        const xpSize = this._xpCircleSize;
        xpWrap.innerHTML = this._buildXPCircle(pc.xp, xpSize);
      }

      // Update recovery drops (display only)
      const recoveryWrap = wrap.querySelector('.cgm-recovery-wrap');
      if (recoveryWrap) {
        recoveryWrap.innerHTML = this._buildRecoveryDrops(pc.recoveryRolls);
      }

      // Update damage track overlay
      const dmgOverlay = wrap.querySelector('.cgm-portrait-damage');
      if (dmgOverlay) {
        dmgOverlay.className = 'cgm-portrait-damage cgm-damage-' + pc.damageTrack.toLowerCase();
      }

      // Update border color based on damage track
      const img = wrap.querySelector('.cgm-portrait-img');
      if (img) {
        const dmgColor = this._getDamageTrackColor(pc.damageTrack);
        const borderColor = this._portraitBorderColor || dmgColor;
        img.style.borderColor = borderColor;
      }

      // Update active effect icons (refresh HTML without full re-render)
      const visualWrap = wrap.querySelector('.cgm-portrait-visual');
      if (visualWrap) {
        const effectsContainer = visualWrap.querySelector('.cgm-portrait-effects');
        const newEffectsHTML = this._buildEffectIconsHTML(pc, this._portraitSize);
        if (effectsContainer) {
          effectsContainer.outerHTML = newEffectsHTML;
        } else if (newEffectsHTML) {
          // No existing container but we have effects — insert before img-wrap
          const imgWrap = visualWrap.querySelector('.cgm-portrait-img-wrap');
          if (imgWrap) {
            imgWrap.insertAdjacentHTML('beforebegin', newEffectsHTML);
          }
        }
      }
    });

    // Sync background width in case portrait count/size changed
    this._syncPortraitBgWidth();
  }

  /* Update baseDifficulty on any open Cypher System roll dialogs */
  _updateOpenRollDialogs() {
    // ── 1. Update Cypher System RollEngineDialogSheet instances ──
    const rollDialogs = Object.values(ui.windows).filter(app => app.constructor.name === "RollEngineDialogSheet");
    for (const dialog of rollDialogs) {
      const actor = fromUuidSync(dialog.object?.actorUuid);
      if (!actor) continue;

      let difficulty = actor.getFlag("cypher-gm-taskbar", "targetDifficulty");
      if (difficulty === undefined || difficulty === null) {
        difficulty = this._globalDifficulty;
      }
      difficulty = parseInt(difficulty, 10);
      if (isNaN(difficulty) || difficulty < 0 || difficulty > 15) continue;

      // Only update if the applied difficulty would change
      if (dialog._cgmAppliedActor === actor.id && dialog._cgmAppliedDifficulty === difficulty) continue;

      dialog._cgmAppliedActor = actor.id;
      dialog._cgmAppliedDifficulty = difficulty;

      // Apply to backing data
      dialog.object.baseDifficulty = difficulty;

      // Apply directly to the DOM select element
      const el = dialog.element?.[0] || dialog.element;
      const select = el?.querySelector?.('select[name="baseDifficulty"]') || el?.querySelector?.('select.base-difficulty');
      if (select) {
        const strVal = String(difficulty);
        if (select.value !== strVal) {
          select.value = strVal;
          select.dispatchEvent(new Event("change", { bubbles: true }));
        }
      }
    }

    // ── 2. Update Cypher Taskbar native roll dialogs ──
    // These are generic Dialog instances with ct-native-skill-roll-form or ct-native-attribute-roll-form
    const cypherTaskbarDialogs = Object.values(ui.windows).filter(app => {
      if (app.constructor.name !== "Dialog") return false;
      const el = app.element?.[0] || app.element;
      if (!el) return false;
      return el.querySelector('.ct-native-skill-roll-form, .ct-native-attribute-roll-form') !== null;
    });

    for (const dialog of cypherTaskbarDialogs) {
      // Try to determine the actor — the Cypher Taskbar stores it on the dialog or we infer from title
      // The Cypher Taskbar dialogs don't carry actorUuid, but we know the Cypher Taskbar instance
      const ctb = window.CypherTaskbar?.instance;
      const actor = ctb?.actor;
      if (!actor) continue;

      let difficulty = actor.getFlag("cypher-gm-taskbar", "targetDifficulty");
      if (difficulty === undefined || difficulty === null) {
        difficulty = this._globalDifficulty;
      }
      difficulty = parseInt(difficulty, 10);
      if (isNaN(difficulty) || difficulty < 0 || difficulty > 15) continue;

      // Only update if the applied difficulty would change
      if (dialog._cgmAppliedActor === actor.id && dialog._cgmAppliedDifficulty === difficulty) continue;

      dialog._cgmAppliedActor = actor.id;
      dialog._cgmAppliedDifficulty = difficulty;

      // Apply directly to the DOM select element
      const el = dialog.element?.[0] || dialog.element;
      const select = el?.querySelector?.('select[name="baseDifficulty"]');
      if (select) {
        const strVal = String(difficulty);
        if (select.value !== strVal) {
          select.value = strVal;
          select.dispatchEvent(new Event("change", { bubbles: true }));
        }
      }
    }
  }

  /* ─── Panel Rendering ─── */

  _openPanel(key) {
    // Close any open panel first
    this._closePanel();
    this.activePanel = key;

    // Determine anchor based on panel type
    const isRightPanel = key === "settings";
    const anchorId = isRightPanel ? "cgm-panel-anchor-settings" : "cgm-panel-anchor-center";
    const anchor = this.element?.querySelector(`#${anchorId}`);
    if (!anchor) return;

    // Update button active states
    this.element.querySelectorAll(".cgm-btn, .cgm-icon-btn").forEach(btn => {
      btn.classList.toggle("cgm-active", btn.dataset.panel === key);
    });

    let html = "";
    switch (key) {
      case "party":      html = this._buildPartyPanel();      break;
      case "combat":     html = this._buildCombatPanel();     break;
      case "intrusions": html = this._buildIntrusionsPanel(); break;
      case "cyphers":    html = this._buildCyphersPanel();    break;
      case "recovery":   html = this._buildRecoveryPanel();   break;
      case "npcs":       html = this._buildNPCsPanel();       break;
      case "items":      html = this._buildItemsPanel();      break;
      case "notes":      html = this._buildNotesPanel();      break;
      case "settings":   html = this._buildSettingsPanel();   break;
    }

    anchor.innerHTML = `<div class="cgm-panel">${html}</div>`;
    this._panelEl = anchor.querySelector(".cgm-panel");
    this._bindPanelEvents(key);
  }

  _closePanel() {
    this.activePanel = null;
    this._panelEl = null;
    this.element?.querySelectorAll(".cgm-panel-anchor").forEach(a => a.innerHTML = "");
    this.element?.querySelectorAll(".cgm-btn, .cgm-icon-btn").forEach(btn => btn.classList.remove("cgm-active"));
  }

  /* ─── Data ─── */

  _getPartyData(force = false) {
    // Cache check: return cached data if still fresh
    if (!force && this._partyDataCache && (Date.now() - this._partyDataCacheTime) < this._partyDataCacheTTL) {
      return this._partyDataCache;
    }
    const result = game.actors.filter(a => a.type === "pc" && a.hasPlayerOwner).map(actor => {
      const sys = actor.system ?? {};
      const pools = sys.pools ?? sys.basic ?? {};
      const might = pools.might ?? {};
      const speed = pools.speed ?? {};
      const intellect = pools.intellect ?? {};
      const mightV = might.value ?? might.current ?? 0;
      const mightM = might.max ?? 0;
      const speedV = speed.value ?? speed.current ?? 0;
      const speedM = speed.max ?? 0;
      const intellectV = intellect.value ?? intellect.current ?? 0;
      const intellectM = intellect.max ?? 0;
      const tier = sys.basic?.tier ?? sys.advancement?.tier ?? 1;
      const effort = sys.basic?.effort ?? sys.advancement?.effort ?? 1;
      const xp = Number(sys.basic?.xp ?? sys.advancement?.xp ?? 0);
      const damageTrack = sys.combat?.damageTrack?.value ?? sys.damageTrack ?? "Hale";
      const cypherCount = actor.items.filter(i => i.type === "artifact").length;
      const cypherLimit = sys.basic?.cypherLimit ?? sys.settings?.cypherLimit ?? 0;

      // Recovery state
      let recoveryAvailable = 4;
      let recoveryTotal = 4;
      let recoveryRolls = [true, true, true, true];
      let rolls = null;

      // Active effects (temporary and non-temporary, but not disabled)
      const activeEffects = actor.effects
        ?.filter(e => !e.disabled)
        .map(e => ({
          id: e.id,
          name: e.name || e.label || "Unknown Effect",
          icon: e.img || e.icon || "icons/svg/aura.svg",
          description: e.description || "",
          isTemporary: e.isTemporary || false
        })) || [];
      if (Array.isArray(sys.combat?.recoveries?.recoveryRolls)) rolls = sys.combat.recoveries.recoveryRolls;
      else if (Array.isArray(sys.recoveries?.recoveryRolls)) rolls = sys.recoveries.recoveryRolls;
      else if (Array.isArray(sys.combat?.recoveryRolls)) rolls = sys.combat.recoveryRolls;

      if (rolls) {
        recoveryRolls = rolls.slice(0, 4);
        recoveryAvailable = recoveryRolls.filter(r => !!r).length;
        recoveryTotal = recoveryRolls.length;
      } else {
        const rec = sys.combat?.recoveries || {};
        const used = [rec.oneAction, rec.tenMinutes, rec.oneHour, rec.tenHours].filter(Boolean).length;
        recoveryAvailable = 4 - used;
        // Build rolls array from boolean flags
        recoveryRolls = [
          !rec.oneAction,
          !rec.tenMinutes,
          !rec.oneHour,
          !rec.tenHours
        ];
      }

      return {
        id: actor.id,
        name: actor.name,
        img: actor.img || "icons/svg/mystery-man.svg",
        tier, effort,
        xp: Math.min(10, Math.max(0, xp)),
        pools: {
          might:     { value: mightV, max: mightM, edge: might.edge ?? 0, percent: mightM > 0 ? Math.round((mightV / mightM) * 100) : 0 },
          speed:     { value: speedV, max: speedM, edge: speed.edge ?? 0, percent: speedM > 0 ? Math.round((speedV / speedM) * 100) : 0 },
          intellect: { value: intellectV, max: intellectM, edge: intellect.edge ?? 0, percent: intellectM > 0 ? Math.round((intellectV / intellectM) * 100) : 0 }
        },
        damageTrack,
        cypherCount, cypherLimit,
        cypherWarning: cypherLimit > 0 && cypherCount > cypherLimit,
        recoveryAvailable,
        recoveryTotal,
        recoveryRolls,
        activeEffects
      };
    });
    // Cache result
    this._partyDataCache = result;
    this._partyDataCacheTime = Date.now();
    return result;
  }

  /* ─── Panel Builders ─── */

  _buildPartyPanel() {
    const pcs = this._getPartyData();
    if (!pcs.length) return `<div class="cgm-panel-empty">No player characters found.</div>`;
    return `
      <div class="cgm-panel-header"><i class="fas fa-users"></i> Party Overview</div>
      <div class="cgm-party-grid">
        ${pcs.map(pc => `
          <div class="cgm-party-card" data-actor-id="${pc.id}">
            <div class="cgm-pc-header">
              <img src="${pc.img}" alt="" class="cgm-pc-img">
              <div class="cgm-pc-info">
                <div class="cgm-pc-name">${pc.name}</div>
                <div class="cgm-pc-meta">Tier ${pc.tier} · Effort ${pc.effort} · XP ${pc.xp}/10</div>
              </div>
              <div class="cgm-pc-status cgm-status-${pc.damageTrack.toLowerCase()}">${pc.damageTrack}</div>
            </div>
            <div class="cgm-pc-pools">
              <div class="cgm-pool"><div class="cgm-pool-label">Might <span class="cgm-pool-edge">(${pc.pools.might.edge})</span></div><div class="cgm-pool-bar"><div class="cgm-pool-fill cgm-pool-might" style="width:${pc.pools.might.percent}%"></div></div><div class="cgm-pool-val">${pc.pools.might.value}/${pc.pools.might.max}</div></div>
              <div class="cgm-pool"><div class="cgm-pool-label">Speed <span class="cgm-pool-edge">(${pc.pools.speed.edge})</span></div><div class="cgm-pool-bar"><div class="cgm-pool-fill cgm-pool-speed" style="width:${pc.pools.speed.percent}%"></div></div><div class="cgm-pool-val">${pc.pools.speed.value}/${pc.pools.speed.max}</div></div>
              <div class="cgm-pool"><div class="cgm-pool-label">Intellect <span class="cgm-pool-edge">(${pc.pools.intellect.edge})</span></div><div class="cgm-pool-bar"><div class="cgm-pool-fill cgm-pool-intellect" style="width:${pc.pools.intellect.percent}%"></div></div><div class="cgm-pool-val">${pc.pools.intellect.value}/${pc.pools.intellect.max}</div></div>
            </div>
            ${pc.cypherWarning ? `<div class="cgm-cypher-warn"><i class="fas fa-exclamation-triangle"></i> Cypher limit exceeded (${pc.cypherCount}/${pc.cypherLimit})</div>` : ""}
          </div>
        `).join("")}
      </div>
    `;
  }

  _buildCombatPanel() {
    const combat = game.combat;
    const tn = this._difficulty * 3;
    let turnsHtml = "";
    if (combat) {
      turnsHtml = combat.combatants.map(c => {
        const isActive = combat.current?.combatantId === c.id;
        return `<div class="cgm-combat-turn ${isActive ? 'cgm-turn-active' : ''}"><img src="${c.img || c.actor?.img || 'icons/svg/mystery-man.svg'}" alt=""><span class="cgm-turn-name">${c.name}</span><span class="cgm-turn-init">${c.initiative ?? "—"}</span></div>`;
      }).join("");
    }
    return `
      <div class="cgm-panel-header"><i class="fas fa-swords"></i> Combat Tracker</div>
      <div class="cgm-combat-controls">
        <div class="cgm-difficulty-dial">
          <button class="cgm-dial-btn" data-action="diffDown"><i class="fas fa-minus"></i></button>
          <div class="cgm-dial-display"><div class="cgm-dial-diff">Difficulty ${this._difficulty}</div><div class="cgm-dial-tn">TN ${tn}</div></div>
          <button class="cgm-dial-btn" data-action="diffUp"><i class="fas fa-plus"></i></button>
        </div>
        ${combat ? `<div class="cgm-combat-round">Round ${combat.round}</div>` : ""}
      </div>
      <div class="cgm-combat-turns">${combat ? turnsHtml : `<div class="cgm-panel-empty">No active combat.</div>`}</div>
      <div class="cgm-combat-actions">
        <button class="cgm-action-btn" data-action="rollInitiative"><i class="fas fa-dice-d20"></i> Roll All</button>
        <button class="cgm-action-btn" data-action="nextTurn"><i class="fas fa-step-forward"></i> Next Turn</button>
        <button class="cgm-action-btn" data-action="endCombat"><i class="fas fa-stop"></i> End</button>
      </div>
    `;
  }

  _buildIntrusionsPanel() {
    return `
      <div class="cgm-panel-header"><i class="fas fa-bolt"></i> GM Intrusions</div>
      <div class="cgm-intrusion-actions">
        <button class="cgm-action-btn" data-action="addIntrusion"><i class="fas fa-plus"></i> Log Intrusion</button>
        <button class="cgm-action-btn cgm-btn-ghost" data-action="clearIntrusions"><i class="fas fa-trash"></i> Clear All</button>
      </div>
      <div class="cgm-intrusion-list">
        ${this._intrusions.length ? this._intrusions.map((intr, idx) => `
          <div class="cgm-intrusion">
            <div class="cgm-intrusion-meta"><span class="cgm-intrusion-time">${intr.time}</span><span class="cgm-intrusion-target"><i class="fas fa-crosshairs"></i> ${intr.target}</span></div>
            <div class="cgm-intrusion-desc">${intr.description}</div>
            <button class="cgm-intrusion-delete" data-index="${idx}" title="Delete"><i class="fas fa-times"></i></button>
          </div>
        `).join("") : `<div class="cgm-panel-empty">No intrusions logged yet.</div>`}
      </div>
    `;
  }

  _buildCyphersPanel() {
    const pcs = this._getPartyData();
    return `
      <div class="cgm-panel-header"><i class="fas fa-flask"></i> Cyphers & Artifacts</div>
      <div class="cgm-cypher-list">
        ${pcs.map(pc => {
          const actor = game.actors.get(pc.id);
          const items = actor?.items?.filter(i => i.type === "cypher" || i.type === "artifact") ?? [];
          return `<div class="cgm-cypher-group">
            <div class="cgm-cypher-header"><span class="cgm-cypher-name">${pc.name}</span><span class="cgm-cypher-count ${pc.cypherWarning ? 'cgm-cypher-warn' : ''}">${pc.cypherCount}/${pc.cypherLimit || "∞"}</span></div>
            ${items.length ? `<div class="cgm-cypher-items">${items.map(i => `<div class="cgm-cypher-item" data-item-id="${i.id}" data-actor-id="${pc.id}"><i class="fas ${i.type === 'artifact' ? 'fa-gem' : 'fa-flask'}"></i><span class="cgm-cypher-item-name">${i.name}</span><span class="cgm-cypher-item-lvl">Lvl ${i.system?.level ?? "—"}</span></div>`).join("")}</div>` : `<div class="cgm-cypher-empty">No cyphers</div>`}
          </div>`;
        }).join("")}
      </div>
    `;
  }

  _buildRecoveryPanel() {
    const pcs = this._getPartyData();
    const defaultChecks = [
      { label: "1st", desc: "1 Action" },
      { label: "2nd", desc: "10 Minutes" },
      { label: "3rd", desc: "1 Hour" },
      { label: "4th", desc: "10 Hours" }
    ];
    return `
      <div class="cgm-panel-header"><i class="fas fa-heart"></i> Recovery Rolls</div>
      <div class="cgm-recovery-actions"><button class="cgm-action-btn" data-action="newDay"><i class="fas fa-sun"></i> New Day (Reset All)</button></div>
      <div class="cgm-recovery-grid">
        ${pcs.map(pc => {
          const checks = this._recoveryChecks[pc.id] || defaultChecks.map(c => ({ ...c, used: false }));
          return `<div class="cgm-recovery-card"><div class="cgm-recovery-name">${pc.name}</div><div class="cgm-recovery-checks">${checks.map((c, idx) => `<button class="cgm-recovery-check ${c.used ? 'cgm-check-used' : ''}" data-actor-id="${pc.id}" data-check-index="${idx}" title="${c.desc}" ${c.used ? 'disabled' : ''}><i class="fas ${c.used ? 'fa-check-circle' : 'fa-circle'}"></i><span>${c.label}</span></button>`).join("")}</div></div>`;
        }).join("")}
      </div>
    `;
  }

  _buildNPCsPanel() {
    const npcs = game.actors.filter(a => a.type === "npc");
    return `
      <div class="cgm-panel-header"><i class="fas fa-mask"></i> NPCs</div>
      <div class="cgm-npc-list">
        ${npcs.length ? npcs.map(npc => `<div class="cgm-npc-item" data-actor-id="${npc.id}"><img src="${npc.img || 'icons/svg/mystery-man.svg'}" alt=""><span class="cgm-npc-name">${npc.name}</span><span class="cgm-npc-level">Lvl ${npc.system?.basic?.level ?? npc.system?.level ?? "—"}</span></div>`).join("") : `<div class="cgm-panel-empty">No NPCs found.</div>`}
      </div>
    `;
  }

  _buildItemsPanel() {
    const items = game.items.contents.sort((a, b) => a.name.localeCompare(b.name));
    const types = {};
    items.forEach(item => {
      const t = item.type || 'unknown';
      if (!types[t]) types[t] = [];
      types[t].push(item);
    });
    const typeOrder = ['ability', 'skill', 'attack', 'armor', 'cypher', 'artifact', 'equipment', 'ammo', 'cyphersystem', 'material', 'oddity'];
    const sortedTypes = Object.keys(types).sort((a, b) => {
      const ia = typeOrder.indexOf(a);
      const ib = typeOrder.indexOf(b);
      if (ia !== -1 && ib !== -1) return ia - ib;
      if (ia !== -1) return -1;
      if (ib !== -1) return 1;
      return a.localeCompare(b);
    });

    return `
      <div class="cgm-panel-header"><i class="fas fa-hammer"></i> Items</div>
      <div class="cgm-items-browser">
        ${sortedTypes.map(type => `
          <div class="cgm-items-type-group">
            <div class="cgm-items-type-header">${type.charAt(0).toUpperCase() + type.slice(1)} (${types[type].length})</div>
            <div class="cgm-items-type-list">
              ${types[type].map(item => {
                const level = item.system?.basic?.level ?? item.system?.level ?? null;
                const levelText = level !== null ? ` • Lvl ${level}` : '';
                return `<div class="cgm-items-browser-row" data-item-id="${item.id}" title="${this._escapeHTML(item.name)}">
                  <img src="${item.img || 'icons/svg/item-bag.svg'}" alt="">
                  <span class="cgm-items-browser-name">${item.name}</span>
                  <span class="cgm-items-browser-meta">${type}${levelText}</span>
                </div>`;
              }).join('')}
            </div>
          </div>
        `).join('')}
        ${items.length === 0 ? '<div class="cgm-panel-empty">No items found.</div>' : ''}
      </div>
    `;
  }

  _buildNotesPanel() {
    return `
      <div class="cgm-panel-header"><i class="fas fa-sticky-note"></i> GM Notes</div>
      <div class="cgm-notes-wrap">
        <textarea class="cgm-notes-area" id="cgm-notes-area" placeholder="Quick notes...">${this._escapeHTML(this._notes)}</textarea>
        <button class="cgm-action-btn cgm-save-notes" data-action="saveNotes"><i class="fas fa-save"></i> Save Notes</button>
      </div>
    `;
  }

  _buildSettingsPanel() {
    const generalTab = this._settingsTab === "general";
    const portraitTab = this._settingsTab === "portrait";
    const xpTab = this._settingsTab === "xp";
    const sectionsTab = this._settingsTab === "sections";

    const generalHTML = `
      <div class="cgm-settings-grid">
        <div class="cgm-setting-row">
          <span class="cgm-setting-label">Dock Position</span>
          <div class="cgm-setting-opts">
            <button class="cgm-opt-btn ${this._dock === 'bottom' ? 'cgm-opt-active' : ''}" data-action="dockBottom">Bottom</button>
            <button class="cgm-opt-btn ${this._dock === 'top' ? 'cgm-opt-active' : ''}" data-action="dockTop">Top</button>
          </div>
        </div>
        <div class="cgm-setting-row">
          <span class="cgm-setting-label">Opacity</span>
          <input type="range" min="50" max="100" value="${this._opacity}" class="cgm-slider" data-action="setOpacity">
          <span class="cgm-slider-val">${this._opacity}%</span>
        </div>
        <div class="cgm-setting-row">
          <span class="cgm-setting-label">Compact Mode</span>
          <button class="cgm-toggle ${this._compact ? 'cgm-toggle-on' : ''}" data-action="toggleCompact"><span class="cgm-toggle-knob"></span></button>
        </div>
      </div>
    `;

    const portraitHTML = `
      <div class="cgm-settings-grid">
        <div class="cgm-setting-row">
          <span class="cgm-setting-label">Portrait Size</span>
          <input type="range" min="32" max="160" value="${this._portraitSize}" class="cgm-slider" data-action="setPortraitSize">
          <span class="cgm-slider-val">${this._portraitSize}px</span>
        </div>
        <div class="cgm-setting-row">
          <span class="cgm-setting-label">Image Fit</span>
          <div class="cgm-setting-opts">
            ${["cover", "contain", "auto", "fill", "scale-down"].map(f => `
              <button class="cgm-opt-btn ${this._portraitObjectFit === f ? 'cgm-opt-active' : ''}" data-action="setPortraitFit" data-fit="${f}">${f}</button>
            `).join("")}
          </div>
        </div>
        <div class="cgm-setting-row">
          <span class="cgm-setting-label">Name Above Bars</span>
          <button class="cgm-toggle ${this._portraitNameAbove ? 'cgm-toggle-on' : ''}" data-action="togglePortraitNameAbove"><span class="cgm-toggle-knob"></span></button>
        </div>
        <div class="cgm-setting-row">
          <span class="cgm-setting-label">Name Size</span>
          <input type="range" min="8" max="24" value="${this._portraitNameSize}" class="cgm-slider" data-action="setPortraitNameSize">
          <span class="cgm-slider-val">${this._portraitNameSize}px</span>
        </div>
        <div class="cgm-setting-row">
          <span class="cgm-setting-label">Name Color</span>
          <div class="cgm-color-picker-wrap">
            <input type="color" class="cgm-color-picker" data-action="setPortraitNameColor" value="${this._portraitNameColor || '#e8e0d4'}">
            <button class="cgm-opt-btn ${!this._portraitNameColor ? 'cgm-opt-active' : ''}" data-action="clearPortraitNameColor">Default</button>
          </div>
        </div>
        <div class="cgm-setting-row">
          <span class="cgm-setting-label">Name Offset</span>
          <input type="range" min="0" max="40" value="${this._portraitNameOffset}" class="cgm-slider" data-action="setPortraitNameOffset">
          <span class="cgm-slider-val">${this._portraitNameOffset}px</span>
        </div>
        <div class="cgm-setting-row">
          <span class="cgm-setting-label">Bar Position</span>
          <input type="range" min="0" max="60" value="${this._portraitBarOffset}" class="cgm-slider" data-action="setBarOffset">
          <span class="cgm-slider-val">${this._portraitBarOffset}px</span>
        </div>
        <div class="cgm-setting-row">
          <span class="cgm-setting-label">Bar Width</span>
          <input type="range" min="20" max="120" value="${this._portraitBarWidth}" class="cgm-slider" data-action="setBarWidth">
          <span class="cgm-slider-val">${this._portraitBarWidth}px</span>
        </div>
        <div class="cgm-setting-row">
          <span class="cgm-setting-label">Border Color</span>
          <div class="cgm-color-picker-wrap">
            <input type="color" class="cgm-color-picker" data-action="setPortraitBorderColor" value="${this._portraitBorderColor || '#c8a96e'}">
            <button class="cgm-opt-btn ${!this._portraitBorderColor ? 'cgm-opt-active' : ''}" data-action="clearPortraitBorderColor">Auto</button>
          </div>
        </div>
        <div class="cgm-setting-row">
          <span class="cgm-setting-label">Border Width</span>
          <input type="range" min="1" max="10" value="${this._portraitBorderWidth}" class="cgm-slider" data-action="setPortraitBorderWidth">
          <span class="cgm-slider-val">${this._portraitBorderWidth}px</span>
        </div>
        <div class="cgm-setting-row">
          <span class="cgm-setting-label">Shape</span>
          <div class="cgm-setting-opts">
            <button class="cgm-opt-btn ${this._portraitShape === 'circle' ? 'cgm-opt-active' : ''}" data-action="setPortraitShape" data-shape="circle">Circle</button>
            <button class="cgm-opt-btn ${this._portraitShape === 'rectangle' ? 'cgm-opt-active' : ''}" data-action="setPortraitShape" data-shape="rectangle">Rectangle</button>
            <button class="cgm-opt-btn ${this._portraitShape === 'rounded' ? 'cgm-opt-active' : ''}" data-action="setPortraitShape" data-shape="rounded">Rounded</button>
          </div>
        </div>
        <div class="cgm-setting-row">
          <span class="cgm-setting-label">Position</span>
          <div class="cgm-setting-opts">
            <button class="cgm-opt-btn ${this._portraitPosition === 'left' ? 'cgm-opt-active' : ''}" data-action="setPortraitPosition" data-pos="left">Left</button>
            <button class="cgm-opt-btn ${this._portraitPosition === 'center' ? 'cgm-opt-active' : ''}" data-action="setPortraitPosition" data-pos="center">Center</button>
            <button class="cgm-opt-btn ${this._portraitPosition === 'right' ? 'cgm-opt-active' : ''}" data-action="setPortraitPosition" data-pos="right">Right</button>
          </div>
        </div>
        <div class="cgm-setting-divider"></div>
        <div class="cgm-setting-section-title">BACKGROUND PANEL</div>
        <div class="cgm-setting-row">
          <span class="cgm-setting-label">Shape</span>
          <div class="cgm-setting-opts">
            <button class="cgm-opt-btn ${this._portraitBgShape === 'trapezoid' ? 'cgm-opt-active' : ''}" data-action="setPortraitBgShape" data-shape="trapezoid">Trapezoid</button>
            <button class="cgm-opt-btn ${this._portraitBgShape === 'rectangle' ? 'cgm-opt-active' : ''}" data-action="setPortraitBgShape" data-shape="rectangle">Rectangle</button>
            <button class="cgm-opt-btn ${this._portraitBgShape === 'rounded' ? 'cgm-opt-active' : ''}" data-action="setPortraitBgShape" data-shape="rounded">Rounded</button>
            <button class="cgm-opt-btn ${this._portraitBgShape === 'none' ? 'cgm-opt-active' : ''}" data-action="setPortraitBgShape" data-shape="none">None</button>
          </div>
        </div>
        <div class="cgm-setting-row">
          <span class="cgm-setting-label">Bg Color</span>
          <div class="cgm-color-picker-wrap">
            <input type="color" class="cgm-color-picker" data-action="setPortraitBgColor" value="${this._portraitBgColor || '#000000'}">
            <button class="cgm-opt-btn ${!this._portraitBgColor ? 'cgm-opt-active' : ''}" data-action="clearPortraitBgColor">Default</button>
          </div>
        </div>
        <div class="cgm-setting-row">
          <span class="cgm-setting-label">Bg Opacity</span>
          <input type="range" min="0" max="100" value="${this._portraitBgOpacity}" class="cgm-slider" data-action="setPortraitBgOpacity">
          <span class="cgm-slider-val">${this._portraitBgOpacity}%</span>
        </div>
        <div class="cgm-setting-divider"></div>
        <div class="cgm-setting-section-title">RADIAL MENU</div>
        <div class="cgm-setting-row">
          <span class="cgm-setting-label">Menu Size</span>
          <input type="range" min="100" max="300" value="${this._radialMenuSize}" class="cgm-slider" data-action="setRadialMenuSize">
          <span class="cgm-slider-val">${this._radialMenuSize}px</span>
        </div>
        <div class="cgm-setting-row">
          <span class="cgm-setting-label">Menu Offset</span>
          <input type="range" min="10" max="100" value="${this._radialMenuOffset}" class="cgm-slider" data-action="setRadialMenuOffset">
          <span class="cgm-slider-val">${this._radialMenuOffset}px</span>
        </div>
      </div>
    `;

    const xpHTML = `
      <div class="cgm-settings-grid">
        <div class="cgm-setting-row">
          <span class="cgm-setting-label">XP Circle Size</span>
          <input type="range" min="12" max="40" value="${this._xpCircleSize}" class="cgm-slider" data-action="setXPCircleSize">
          <span class="cgm-slider-val">${this._xpCircleSize}px</span>
        </div>
        <div class="cgm-setting-row">
          <span class="cgm-setting-label">XP Offset X</span>
          <input type="range" min="-50" max="50" value="${this._xpCircleOffsetX}" class="cgm-slider" data-action="setXPCircleOffsetX">
          <span class="cgm-slider-val">${this._xpCircleOffsetX}px</span>
        </div>
        <div class="cgm-setting-row">
          <span class="cgm-setting-label">XP Offset Y</span>
          <input type="range" min="-50" max="50" value="${this._xpCircleOffsetY}" class="cgm-slider" data-action="setXPCircleOffsetY">
          <span class="cgm-slider-val">${this._xpCircleOffsetY}px</span>
        </div>
        <div class="cgm-setting-row">
          <span class="cgm-setting-label">XP Preview</span>
          <div class="cgm-xp-preview">${this._buildXPCircle(5, 20)}</div>
        </div>
      </div>
    `;

    const sectionsHTML = `
      <div class="cgm-settings-grid">
        <div class="cgm-setting-row">
          <span class="cgm-setting-label">Unlock Sections</span>
          <button class="cgm-toggle-btn ${this._sectionsUnlocked ? 'cgm-toggle-on' : ''}" data-action="toggleSectionsUnlock" title="Toggle section editing">
            <i class="fas ${this._sectionsUnlocked ? 'fa-lock-open' : 'fa-lock'}"></i> ${this._sectionsUnlocked ? 'UNLOCKED' : 'LOCKED'}
          </button>
        </div>
        <div class="cgm-setting-hint">When unlocked: drag icons between sections, right-click icons to customize size and color.</div>

        <div class="cgm-setting-section-title">SECTION LABELS</div>
        <div class="cgm-setting-row">
          <span class="cgm-setting-label">Label Size</span>
          <input type="range" min="6" max="18" value="${this._sectionLabelSize}" class="cgm-slider" data-action="setSectionLabelSize">
          <span class="cgm-slider-val">${this._sectionLabelSize}px</span>
        </div>
        <div class="cgm-setting-row">
          <span class="cgm-setting-label">Label Color</span>
          <div class="cgm-color-picker-wrap">
            <input type="color" class="cgm-color-picker" data-action="setSectionLabelColor" value="${this._sectionLabelColor}">
          </div>
        </div>
        <div class="cgm-setting-row">
          <span class="cgm-setting-label">Label Offset</span>
          <input type="range" min="-30" max="30" value="${this._sectionLabelOffset}" class="cgm-slider" data-action="setSectionLabelOffset">
          <span class="cgm-slider-val">${this._sectionLabelOffset}px</span>
        </div>

        <div class="cgm-setting-section-title" data-section-name-title="0">${this._sections[0].name}</div>
        <div class="cgm-setting-row">
          <span class="cgm-setting-label">Label Name</span>
          <input type="text" class="cgm-text-input" data-action="setSectionName" data-section="0" value="${this._sections[0].name}" maxlength="20" style="width:120px;">
        </div>
        <div class="cgm-setting-row">
          <span class="cgm-setting-label">Label Color</span>
          <div class="cgm-color-picker-wrap">
            <input type="color" class="cgm-color-picker" data-action="setSectionLabelColor" data-section="0" value="${this._sections[0].labelColor || this._sectionLabelColor || '#c8a96e'}">
          </div>
        </div>
        <div class="cgm-setting-row">
          <span class="cgm-setting-label">Position</span>
          <input type="range" min="0" max="200" value="${this._sections[0].position ?? 0}" class="cgm-slider" data-action="setSectionPosition" data-section="0">
          <span class="cgm-slider-val">${this._sections[0].position ?? 0}px</span>
        </div>
        <div class="cgm-setting-row">
          <span class="cgm-setting-label">Width</span>
          <input type="range" min="5" max="50" value="${this._sections[0].width}" class="cgm-slider" data-action="setSectionWidth" data-section="0">
          <span class="cgm-slider-val">${this._sections[0].width}%</span>
        </div>
        <div class="cgm-setting-row">
          <span class="cgm-setting-label">Background Color</span>
          <div class="cgm-color-picker-wrap">
            <input type="color" class="cgm-color-picker" data-action="setSectionColor" data-section="0" value="${this._sections[0].bgColor}">
          </div>
        </div>
        <div class="cgm-setting-row">
          <span class="cgm-setting-label">Background Opacity</span>
          <input type="range" min="0" max="100" value="${this._sections[0].bgOpacity}" class="cgm-slider" data-action="setSectionOpacity" data-section="0">
          <span class="cgm-slider-val">${this._sections[0].bgOpacity}%</span>
        </div>

        <div class="cgm-setting-section-title" data-section-name-title="1">${this._sections[1].name}</div>
        <div class="cgm-setting-row">
          <span class="cgm-setting-label">Label Name</span>
          <input type="text" class="cgm-text-input" data-action="setSectionName" data-section="1" value="${this._sections[1].name}" maxlength="20" style="width:120px;">
        </div>
        <div class="cgm-setting-row">
          <span class="cgm-setting-label">Label Color</span>
          <div class="cgm-color-picker-wrap">
            <input type="color" class="cgm-color-picker" data-action="setSectionLabelColor" data-section="1" value="${this._sections[1].labelColor || this._sectionLabelColor || '#c8a96e'}">
          </div>
        </div>
        <div class="cgm-setting-row">
          <span class="cgm-setting-label">Position on Taskbar</span>
          <input type="range" min="0" max="200" value="${this._sections[1].position ?? 0}" class="cgm-slider" data-action="setSectionPosition" data-section="1">
          <span class="cgm-slider-val">${this._sections[1].position ?? 0}px</span>
        </div>
        <div class="cgm-setting-row">
          <span class="cgm-setting-label">Width</span>
          <input type="range" min="5" max="50" value="${this._sections[1].width}" class="cgm-slider" data-action="setSectionWidth" data-section="1">
          <span class="cgm-slider-val">${this._sections[1].width}%</span>
        </div>
        <div class="cgm-setting-row">
          <span class="cgm-setting-label">Background Color</span>
          <div class="cgm-color-picker-wrap">
            <input type="color" class="cgm-color-picker" data-action="setSectionColor" data-section="1" value="${this._sections[1].bgColor}">
          </div>
        </div>
        <div class="cgm-setting-row">
          <span class="cgm-setting-label">Background Opacity</span>
          <input type="range" min="0" max="100" value="${this._sections[1].bgOpacity}" class="cgm-slider" data-action="setSectionOpacity" data-section="1">
          <span class="cgm-slider-val">${this._sections[1].bgOpacity}%</span>
        </div>

        <div class="cgm-setting-section-title" data-section-name-title="2">${this._sections[2].name}</div>
        <div class="cgm-setting-row">
          <span class="cgm-setting-label">Label Name</span>
          <input type="text" class="cgm-text-input" data-action="setSectionName" data-section="2" value="${this._sections[2].name}" maxlength="20" style="width:120px;">
        </div>
        <div class="cgm-setting-row">
          <span class="cgm-setting-label">Label Color</span>
          <div class="cgm-color-picker-wrap">
            <input type="color" class="cgm-color-picker" data-action="setSectionLabelColor" data-section="2" value="${this._sections[2].labelColor || this._sectionLabelColor || '#c8a96e'}">
          </div>
        </div>
        <div class="cgm-setting-row">
          <span class="cgm-setting-label">Position on Taskbar</span>
          <input type="range" min="0" max="200" value="${this._sections[2].position ?? 0}" class="cgm-slider" data-action="setSectionPosition" data-section="2">
          <span class="cgm-slider-val">${this._sections[2].position ?? 0}px</span>
        </div>
        <div class="cgm-setting-row">
          <span class="cgm-setting-label">Width</span>
          <input type="range" min="5" max="50" value="${this._sections[2].width}" class="cgm-slider" data-action="setSectionWidth" data-section="2">
          <span class="cgm-slider-val">${this._sections[2].width}%</span>
        </div>
        <div class="cgm-setting-row">
          <span class="cgm-setting-label">Background Color</span>
          <div class="cgm-color-picker-wrap">
            <input type="color" class="cgm-color-picker" data-action="setSectionColor" data-section="2" value="${this._sections[2].bgColor}">
          </div>
        </div>
        <div class="cgm-setting-row">
          <span class="cgm-setting-label">Background Opacity</span>
          <input type="range" min="0" max="100" value="${this._sections[2].bgOpacity}" class="cgm-slider" data-action="setSectionOpacity" data-section="2">
          <span class="cgm-slider-val">${this._sections[2].bgOpacity}%</span>
        </div>

        <!-- SECTION 4: Tray -->
        <div class="cgm-setting-section-title" data-section-name-title="3">${this._sections[3].name}</div>
        <div class="cgm-setting-row">
          <span class="cgm-setting-label">Name</span>
          <input type="text" class="cgm-text-input" data-action="setSectionName" data-section="3" value="${this._sections[3].name}" maxlength="20" style="width:120px;">
        </div>
        <div class="cgm-setting-row">
          <span class="cgm-setting-label">Label Color</span>
          <div class="cgm-color-picker-wrap">
            <input type="color" class="cgm-color-picker" data-action="setSectionLabelColor" data-section="3" value="${this._sections[3].labelColor || this._sectionLabelColor || '#c8a96e'}">
          </div>
        </div>
        <div class="cgm-setting-row">
          <span class="cgm-setting-label">Position Offset</span>
          <input type="range" min="0" max="200" value="${this._sections[3].position ?? 0}" class="cgm-slider" data-action="setSectionPosition" data-section="3">
          <span class="cgm-slider-val">${this._sections[3].position ?? 0}px</span>
        </div>
        <div class="cgm-setting-row">
          <span class="cgm-setting-label">Width</span>
          <input type="range" min="5" max="50" value="${this._sections[3].width}" class="cgm-slider" data-action="setSectionWidth" data-section="3">
          <span class="cgm-slider-val">${this._sections[3].width}%</span>
        </div>
        <div class="cgm-setting-row">
          <span class="cgm-setting-label">Background Color</span>
          <div class="cgm-color-picker-wrap">
            <input type="color" class="cgm-color-picker" data-action="setSectionColor" data-section="3" value="${this._sections[3].bgColor}">
          </div>
        </div>
        <div class="cgm-setting-row">
          <span class="cgm-setting-label">Background Opacity</span>
          <input type="range" min="0" max="100" value="${this._sections[3].bgOpacity}" class="cgm-slider" data-action="setSectionOpacity" data-section="3">
          <span class="cgm-slider-val">${this._sections[3].bgOpacity}%</span>
        </div>

        ${this._buildHiddenIconsHTML()}
      </div>
    `;

    return `
      <div class="cgm-panel-header">
        <span><i class="fas fa-cog"></i> Settings</span>
        <button class="cgm-panel-close" data-action="closeSettings" title="Close settings"><i class="fas fa-times"></i></button>
      </div>
      <div class="cgm-settings-tabs">
        <button class="cgm-tab-btn ${generalTab ? 'cgm-tab-active' : ''}" data-action="switchTab" data-tab="general">General</button>
        <button class="cgm-tab-btn ${portraitTab ? 'cgm-tab-active' : ''}" data-action="switchTab" data-tab="portrait">Portrait</button>
        <button class="cgm-tab-btn ${xpTab ? 'cgm-tab-active' : ''}" data-action="switchTab" data-tab="xp">XP Circle</button>
        <button class="cgm-tab-btn ${sectionsTab ? 'cgm-tab-active' : ''}" data-action="switchTab" data-tab="sections">Sections</button>
      </div>
      <div class="cgm-settings-body">
        ${generalTab ? generalHTML : portraitTab ? portraitHTML : sectionsTab ? sectionsHTML : xpHTML}
      </div>
    `;
  }

  /* ─── Event Binding ─── */

  _bindEvents() {
    if (!this.element) return;

    // Panel toggle buttons
    this.element.querySelectorAll(".cgm-btn[data-panel], .cgm-icon-btn[data-panel]").forEach(btn => {
      btn.addEventListener("click", (e) => {
        const panel = e.currentTarget.dataset.panel;
        if (this.activePanel === panel) { this._closePanel(); }
        else { this._openPanel(panel); }
      });
    });

    // Eye menu: toggle visibility
    const eyeBtn = this.element.querySelector('[data-action="toggleActorVisibility"]');
    const eyeMenu = this.element.querySelector('.cgm-eye-menu');
    if (eyeBtn && eyeMenu) {
      eyeBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        eyeMenu.classList.toggle('cgm-eye-menu-visible');
      });
      // Close menu when clicking outside
      document.addEventListener("click", (e) => {
        if (!eyeMenu.contains(e.target) && e.target !== eyeBtn && !eyeBtn.contains(e.target) && !e.target.closest('.dialog, .window-app, .application, .file-picker')) {
          eyeMenu.classList.remove('cgm-eye-menu-visible');
        }
      });
    }
    // Eye menu items
    this.element.querySelectorAll('[data-action="setActorVisibility"]').forEach(item => {
      item.addEventListener("click", async (e) => {
        e.stopPropagation();
        const mode = e.currentTarget.dataset.mode;
        this._portraitVisibilityMode = mode;
        await this._ss("portraitVisibilityMode", mode);
        // Close menu and re-render to update portraits
        eyeMenu?.classList.remove('cgm-eye-menu-visible');
        this.render();
      });
    });

    // Cypher XP button
    const xpBtn = this.element.querySelector("#cgm-btn-xp");
    if (xpBtn) {
      xpBtn.addEventListener("click", async (e) => {
        e.stopPropagation();
        await this._openCypherXpApp(xpBtn);
      });
    }

    // Global difficulty controls
    this.element.querySelector('[data-action="globalDiffDown"]')?.addEventListener("click", async () => {
      this._globalDifficulty = Math.max(0, this._globalDifficulty - 1);
      await this._ss("globalDifficulty", this._globalDifficulty);
      // Also update the direct setting so player-side modules (e.g. Cypher Taskbar) can read it
      try { await game.settings.set(MODULE_ID, "globalDifficulty", this._globalDifficulty); } catch (e) {}
      // Sync to Cypher System's global roll difficulty setting so new roll dialogs pick it up
      if (game.settings.settings.has("cyphersystem.rollDifficulty")) {
        await game.settings.set("cyphersystem", "rollDifficulty", this._globalDifficulty);
      }
      this._updateDifficultyBox();
      this._refreshPortraits();
      this._updateOpenRollDialogs();
    });
    this.element.querySelector('[data-action="globalDiffUp"]')?.addEventListener("click", async () => {
      this._globalDifficulty = Math.min(15, this._globalDifficulty + 1);
      await this._ss("globalDifficulty", this._globalDifficulty);
      // Also update the direct setting so player-side modules (e.g. Cypher Taskbar) can read it
      try { await game.settings.set(MODULE_ID, "globalDifficulty", this._globalDifficulty); } catch (e) {}
      // Sync to Cypher System's global roll difficulty setting so new roll dialogs pick it up
      if (game.settings.settings.has("cyphersystem.rollDifficulty")) {
        await game.settings.set("cyphersystem", "rollDifficulty", this._globalDifficulty);
      }
      this._updateDifficultyBox();
      this._refreshPortraits();
      this._updateOpenRollDialogs();
    });
    this.element.querySelector('[data-action="globalDiffReset"]')?.addEventListener("click", async () => {
      this._globalDifficulty = 4;
      await this._ss("globalDifficulty", 4);
      // Also update the direct setting so player-side modules (e.g. Cypher Taskbar) can read it
      try { await game.settings.set(MODULE_ID, "globalDifficulty", 4); } catch (e) {}
      // Sync to Cypher System's global roll difficulty setting so new roll dialogs pick it up
      if (game.settings.settings.has("cyphersystem.rollDifficulty")) {
        await game.settings.set("cyphersystem", "rollDifficulty", 4);
      }
      this._updateDifficultyBox();
      this._refreshPortraits();
      this._updateOpenRollDialogs();
    });
    this.element.querySelector('[data-action="globalDiffResetAll"]')?.addEventListener("click", async () => {
      // Reset all individual difficulties across all PCs
      const pcs = game.actors.filter(a => a.type === "pc" && a.hasPlayerOwner);
      let count = 0;
      for (const actor of pcs) {
        const hasIndividual = actor.getFlag("cypher-gm-taskbar", "targetDifficulty") !== undefined;
        if (hasIndividual) {
          await actor.unsetFlag("cypher-gm-taskbar", "targetDifficulty");
          count++;
        }
      }
      this._refreshPortraits();
      this._updateOpenRollDialogs();
      ui.notifications.info(`Reset individual difficulty for ${count} actor${count !== 1 ? 's' : ''}.`);
    });
    const diffInput = this.element.querySelector('[data-action="globalDiffInput"]');
    if (diffInput) {
      diffInput.addEventListener("change", async (e) => {
        let val = parseInt(e.target.value, 10);
        if (isNaN(val)) val = 4;
        val = Math.max(0, Math.min(15, val));
        this._globalDifficulty = val;
        await this._ss("globalDifficulty", val);
        // Also update the direct setting so player-side modules (e.g. Cypher Taskbar) can read it
        try { await game.settings.set(MODULE_ID, "globalDifficulty", val); } catch (e) {}
        // Sync to Cypher System's global roll difficulty setting so new roll dialogs pick it up
        if (game.settings.settings.has("cyphersystem.rollDifficulty")) {
          await game.settings.set("cyphersystem", "rollDifficulty", val);
        }
        this._updateDifficultyBox();
        this._refreshPortraits();
        this._updateOpenRollDialogs();
      });
    }

    // Lock toggle
    this.element.querySelector('[data-action="toggleLock"]')?.addEventListener("click", async () => {
      this._locked = !this._locked;
      await this._ss("locked", this._locked);
      if (this._locked) {
        document.getElementById("ginzzzu-portrait-layer")?.classList.remove("cgm-portraits-hidden");
      }
      this.render();
    });

    // GM Menu button
    this.element.querySelector('[data-action="openGMMenu"]')?.addEventListener("click", (e) => {
      this._showGMMenu(e.currentTarget);
    });

    // GM Group Roll button
    this.element.querySelector('[data-action="openGMGroupRoll"]')?.addEventListener("click", (e) => {
      this._showGMGroupRollMenu(e.currentTarget);
    });

    // Group Statuses button
    this.element.querySelector('[data-action="openGroupStatuses"]')?.addEventListener("click", (e) => {
      this._groupStatuses.toggle(e.currentTarget);
    });

    // Scene Control button
    this.element.querySelector('[data-action="openSceneControl"]')?.addEventListener("click", () => {
      if (!window.cypherSceneControl) {
        window.cypherSceneControl = new SceneControl();
      }
      window.cypherSceneControl.toggle();
    });

    // NPC Canvas button
    this.element.querySelector('[data-action="openNPCCanvas"]')?.addEventListener("click", () => {
      if (!window.cypherNPCCanvas) {
        window.cypherNPCCanvas = new NPCCanvas();
      }
      window.cypherNPCCanvas.toggle();
    });

    // Enemy Canvas button
    this.element.querySelector('[data-action="openEnemyCanvas"]')?.addEventListener("click", () => {
      if (!window.cypherEnemyCanvas) {
        window.cypherEnemyCanvas = new EnemyCanvas();
      }
      window.cypherEnemyCanvas.toggle();
    });

    // Items Canvas button
    this.element.querySelector('[data-action="openItemsCanvas"]')?.addEventListener("click", () => {
      if (!window.cypherItemsCanvas) {
        window.cypherItemsCanvas = new ItemsCanvas();
      }
      window.cypherItemsCanvas.toggle();
    });

    // Cypher Connections button
    this.element.querySelector('[data-action="openConnections"]')?.addEventListener("click", async () => {
      if (!window.CypherConnections) {
        ui.notifications.warn("Cypher Connections is not loaded.");
        return;
      }
      // Check if any Connections panel is already open
      const existingPanel = document.querySelector(".cc-panel");
      if (existingPanel) {
        // Find the close button and click it
        const closeBtn = existingPanel.querySelector(".cc-panel-close");
        if (closeBtn) closeBtn.click();
        return;
      }
      await window.CypherConnections.openBoard();
    });

    // Quick Scene button
    this.element.querySelector('[data-action="openQuickScene"]')?.addEventListener("click", () => {
      if (!window.cypherQuickScene) {
        window.cypherQuickScene = new QuickSceneGenerator();
      }
      window.cypherQuickScene.toggle();
    });

    // Cypher Log button
    this.element.querySelector('[data-action="openCypherLog"]')?.addEventListener("click", () => {
      const cypherLog = game.modules?.get("cypher-log")?.api?.CypherLog;
      if (cypherLog) {
        cypherLog.toggleLibrary();
      } else if (window.CypherLog) {
        window.CypherLog.toggleLibrary();
      } else {
        ui.notifications.warn("Cypher Log module is not active.");
      }
    });

    // Recovery button
    this.element.querySelector('[data-action="openRecoveryMenu"]')?.addEventListener("click", (e) => {
      this._showRecoveryTaskbarMenu(e.currentTarget);
    });

    // Reputation button
    this.element.querySelector('[data-action="openReputation"]')?.addEventListener("click", (e) => {
      this._toggleReputationPanel(e.currentTarget);
    });
  }

  _bindPanelEvents(key) {
    if (!this._panelEl) return;
    const el = this._panelEl;

    switch (key) {
      case "party":
        el.querySelectorAll(".cgm-party-card").forEach(card => {
          card.addEventListener("click", () => { const actor = game.actors.get(card.dataset.actorId); if (actor) actor.sheet.render(true); });
        });
        break;
      case "combat":
        el.querySelector('[data-action="diffDown"]')?.addEventListener("click", () => { this._difficulty = Math.max(0, this._difficulty - 1); this._openPanel("combat"); });
        el.querySelector('[data-action="diffUp"]')?.addEventListener("click", () => { this._difficulty = Math.min(15, this._difficulty + 1); this._openPanel("combat"); });
        el.querySelector('[data-action="rollInitiative"]')?.addEventListener("click", () => { game.combat?.rollAll(); });
        el.querySelector('[data-action="nextTurn"]')?.addEventListener("click", () => { game.combat?.nextTurn(); });
        el.querySelector('[data-action="endCombat"]')?.addEventListener("click", () => { game.combat?.endCombat(); });
        break;
      case "intrusions":
        el.querySelector('[data-action="addIntrusion"]')?.addEventListener("click", async () => {
          const actor = game.user.character || canvas.tokens?.controlled[0]?.actor;
          const targetName = actor?.name || "Unknown";
          const description = await Dialog.prompt({ title: "GM Intrusion", content: `<p>Description:</p><textarea style="width:100%;height:60px;"></textarea>`, callback: (html) => html.find("textarea").val() });
          if (!description) return;
          this._intrusions.unshift({ time: new Date().toLocaleTimeString(), target: targetName, description });
          if (this._intrusions.length > 50) this._intrusions.pop();
          this._openPanel("intrusions");
        });
        el.querySelector('[data-action="clearIntrusions"]')?.addEventListener("click", () => { this._intrusions = []; this._openPanel("intrusions"); });
        el.querySelectorAll(".cgm-intrusion-delete").forEach(btn => {
          btn.addEventListener("click", (e) => { e.stopPropagation(); const idx = parseInt(e.currentTarget.dataset.index); if (!isNaN(idx)) { this._intrusions.splice(idx, 1); this._openPanel("intrusions"); } });
        });
        break;
      case "cyphers":
        el.querySelectorAll(".cgm-cypher-item").forEach(item => {
          item.addEventListener("click", () => { const actor = game.actors.get(item.dataset.actorId); const it = actor?.items.get(item.dataset.itemId); if (it) it.sheet.render(true); });
        });
        break;
      case "recovery":
        el.querySelector('[data-action="newDay"]')?.addEventListener("click", () => {
          this._getPartyData().forEach(pc => { this._recoveryChecks[pc.id] = [{ label: "1st", used: false }, { label: "2nd", used: false }, { label: "3rd", used: false }, { label: "4th", used: false }]; });
          this._openPanel("recovery");
        });
        el.querySelectorAll(".cgm-recovery-check").forEach(btn => {
          btn.addEventListener("click", () => {
            const actorId = btn.dataset.actorId;
            const idx = parseInt(btn.dataset.checkIndex);
            if (!this._recoveryChecks[actorId]) this._recoveryChecks[actorId] = [{ label: "1st", used: false }, { label: "2nd", used: false }, { label: "3rd", used: false }, { label: "4th", used: false }];
            this._recoveryChecks[actorId][idx].used = true;
            this._openPanel("recovery");
          });
        });
        break;
      case "npcs":
        el.querySelectorAll(".cgm-npc-item").forEach(item => {
          item.addEventListener("click", () => { const actor = game.actors.get(item.dataset.actorId); if (actor) actor.sheet.render(true); });
        });
        break;
      case "items":
        el.querySelectorAll(".cgm-items-browser-row").forEach(item => {
          item.addEventListener("click", () => { const it = game.items.get(item.dataset.itemId); if (it) it.sheet.render(true); });
        });
        break;
      case "notes":
        el.querySelector('[data-action="saveNotes"]')?.addEventListener("click", async () => {
          const textarea = el.querySelector("#cgm-notes-area");
          if (textarea) { this._notes = textarea.value; await this._ss("notes", this._notes); ui.notifications.info("Notes saved."); }
        });
        break;
      case "settings":
        // Dock position — needs re-render (changes bar CSS classes)
        el.querySelector('[data-action="dockBottom"]')?.addEventListener("click", async () => { this._dock = "bottom"; await this._ss("dock", "bottom"); this.render(); });
        el.querySelector('[data-action="dockTop"]')?.addEventListener("click", async () => { this._dock = "top"; await this._ss("dock", "top"); this.render(); });
        // Sections unlock toggle
        el.querySelector('[data-action="toggleSectionsUnlock"]')?.addEventListener("click", async () => {
          this._sectionsUnlocked = !this._sectionsUnlocked;
          await this._ss("sectionsUnlocked", this._sectionsUnlocked);
          const toggle = el.querySelector('[data-action="toggleSectionsUnlock"]');
          if (toggle) {
            toggle.classList.toggle('cgm-toggle-on', this._sectionsUnlocked);
            toggle.innerHTML = `<i class="fas ${this._sectionsUnlocked ? 'fa-lock-open' : 'fa-lock'}"></i> ${this._sectionsUnlocked ? 'UNLOCKED' : 'LOCKED'}`;
          }
          this.render();
        });
        // Unhide hidden icons
        el.querySelectorAll('[data-action="unhideIcon"]').forEach(btn => {
          btn.addEventListener("click", async (e) => {
            const btnId = e.currentTarget.dataset.btnId;
            if (!btnId) return;
            const layout = this._getButtonLayout();
            if (layout[btnId]) {
              layout[btnId].hidden = false;
              this._buttonLayout = layout;
              await this._ss("buttonLayout", layout);
              ui.notifications.info(`${btnId} icon unhidden.`);
              this._openPanel("settings"); // Refresh settings panel
            }
          });
        });
        // Opacity — update live
        el.querySelector('[data-action="setOpacity"]')?.addEventListener("input", async (e) => {
          this._opacity = parseInt(e.target.value);
          await this._ss("opacity", this._opacity);
          if (this.element) this.element.style.opacity = `${this._opacity}%`;
          const vd = el.querySelector('.cgm-slider-val');
          if (vd) vd.textContent = `${this._opacity}%`;
        });
        // Section settings — width, color, opacity (update live, no re-render)
        const _updateSectionStyle = (idx = 0) => {
          const sec = this._sections[idx];
          const rgb = this._hexToRgb(sec.bgColor);
          const bg = rgb ? `rgba(${rgb.r},${rgb.g},${rgb.b},${sec.bgOpacity/100})` : `rgba(255,255,255,${sec.bgOpacity/100})`;
          const sectionEls = this.element?.querySelectorAll('.cgm-custom-section');
          const sectionEl = sectionEls?.[idx];
          if (sectionEl) {
            sectionEl.style.width = `${sec.width}%`;
            sectionEl.style.background = bg;
          }
        };
        el.querySelectorAll('[data-action="setSectionWidth"]').forEach(input => {
          input.addEventListener("input", async (e) => {
            const idx = parseInt(e.target.dataset.section);
            this._sections[idx].width = parseInt(e.target.value);
            const key = idx === 0 ? "sectionWidth" : idx === 1 ? "section2Width" : idx === 2 ? "section3Width" : "section4Width";
            await this._ss(key, this._sections[idx].width);
            const vd = e.target.nextElementSibling;
            if (vd) vd.textContent = `${this._sections[idx].width}%`;
            _updateSectionStyle(idx);
          });
        });
        el.querySelectorAll('[data-action="setSectionColor"]').forEach(input => {
          input.addEventListener("input", async (e) => {
            const idx = parseInt(e.target.dataset.section);
            this._sections[idx].bgColor = e.target.value;
            const key = idx === 0 ? "sectionBgColor" : idx === 1 ? "section2BgColor" : idx === 2 ? "section3BgColor" : "section4BgColor";
            await this._ss(key, this._sections[idx].bgColor);
            _updateSectionStyle(idx);
          });
        });
        el.querySelectorAll('[data-action="setSectionOpacity"]').forEach(input => {
          input.addEventListener("input", async (e) => {
            const idx = parseInt(e.target.dataset.section);
            this._sections[idx].bgOpacity = parseInt(e.target.value);
            const key = idx === 0 ? "sectionBgOpacity" : idx === 1 ? "section2BgOpacity" : idx === 2 ? "section3BgOpacity" : "section4BgOpacity";
            await this._ss(key, this._sections[idx].bgOpacity);
            const vd = e.target.nextElementSibling;
            if (vd) vd.textContent = `${this._sections[idx].bgOpacity}%`;
            _updateSectionStyle(idx);
          });
        });
        // Section label size — update live
        el.querySelector('[data-action="setSectionLabelSize"]')?.addEventListener("input", async (e) => {
          this._sectionLabelSize = parseInt(e.target.value);
          await this._ss("sectionLabelSize", this._sectionLabelSize);
          const vd = e.target.nextElementSibling;
          if (vd) vd.textContent = `${this._sectionLabelSize}px`;
          // Update all label badges live
          this.element?.querySelectorAll('.cgm-section-label-badge').forEach(lbl => {
            lbl.style.fontSize = `${this._sectionLabelSize}px`;
          });
        });
        // Section label color — update live (global and per-section)
        el.querySelectorAll('[data-action="setSectionLabelColor"]').forEach(input => {
          input.addEventListener("input", async (e) => {
            const sectionIdx = e.target.dataset.section;
            if (sectionIdx !== undefined) {
              // Per-section label color
              const idx = parseInt(sectionIdx);
              this._sections[idx].labelColor = e.target.value;
              const key = idx === 0 ? "section1LabelColor" : idx === 1 ? "section2LabelColor" : idx === 2 ? "section3LabelColor" : "section4LabelColor";
              await this._ss(key, this._sections[idx].labelColor);
              // Update only this section's label badge
              const sectionEls = this.element?.querySelectorAll('.cgm-custom-section');
              const sec = sectionEls?.[idx];
              if (sec) {
                const badge = sec.querySelector('.cgm-section-label-badge');
                if (badge) badge.style.color = this._sections[idx].labelColor;
              }
            } else {
              // Global label color
              this._sectionLabelColor = e.target.value;
              await this._ss("sectionLabelColor", this._sectionLabelColor);
              // Update all label badges that don't have individual colors set
              this.element?.querySelectorAll('.cgm-custom-section').forEach((secEl, idx) => {
                const badge = secEl.querySelector('.cgm-section-label-badge');
                if (badge && !this._sections[idx]?.labelColor) {
                  badge.style.color = this._sectionLabelColor;
                }
              });
            }
          });
        });
        // Section label vertical offset — update live
        el.querySelector('[data-action="setSectionLabelOffset"]')?.addEventListener("input", async (e) => {
          this._sectionLabelOffset = parseInt(e.target.value);
          await this._ss("sectionLabelOffset", this._sectionLabelOffset);
          const vd = e.target.nextElementSibling;
          if (vd) vd.textContent = `${this._sectionLabelOffset}px`;
          // Update all label badges live
          this.element?.querySelectorAll('.cgm-section-label-badge').forEach(lbl => {
            lbl.style.top = `${this._sectionLabelOffset}px`;
          });
        });
        // Section name — update live
        el.querySelectorAll('[data-action="setSectionName"]').forEach(input => {
          input.addEventListener("input", async (e) => {
            const idx = parseInt(e.target.dataset.section);
            const name = e.target.value.trim() || `SECTION ${idx + 1}`;
            this._sections[idx].name = name;
            // Update names array
            if (!Array.isArray(this._sectionNames)) this._sectionNames = ["SECTION 1", "SECTION 2", "SECTION 3", "TRAY"];
            this._sectionNames[idx] = name;
            await this._ss("sectionNames", this._sectionNames);
            // Update label badge on taskbar
            const sectionEls = this.element?.querySelectorAll('.cgm-custom-section');
            const sec = sectionEls?.[idx];
            if (sec) {
              const badge = sec.querySelector('.cgm-section-label-badge');
              if (badge) badge.textContent = name;
              sec.title = name;
            }
            // Update section title in settings panel
            const titleEl = el.querySelector(`[data-section-name-title="${idx}"]`);
            if (titleEl) titleEl.textContent = name;
          });
        });
        // Section position — update live without re-render
        el.querySelectorAll('[data-action="setSectionPosition"]').forEach(input => {
          input.addEventListener("input", async (e) => {
            const idx = parseInt(e.target.dataset.section);
            const val = parseInt(e.target.value);
            this._sections[idx].position = val;
            const key = idx === 0 ? "sectionPosition" : idx === 1 ? "section2Position" : idx === 2 ? "section3Position" : "section4Position";
            await this._ss(key, val);
            const vd = e.target.nextElementSibling;
            if (vd) vd.textContent = `${val}px`;
            // Update section margin-left live
            const sectionEls = this.element?.querySelectorAll('.cgm-custom-section');
            const sec = sectionEls?.[idx];
            if (sec) {
              sec.style.marginLeft = val > 0 ? `${val}px` : '';
            }
          });
        });
        // Compact — update live
        el.querySelector('[data-action="toggleCompact"]')?.addEventListener("click", async () => {
          this._compact = !this._compact;
          await this._ss("compact", this._compact);
          if (this.element) this.element.classList.toggle('cgm-compact', this._compact);
          const toggle = el.querySelector('[data-action="toggleCompact"]');
          if (toggle) toggle.classList.toggle('cgm-toggle-on', this._compact);
        });
        // Tab switching
        el.querySelectorAll('[data-action="switchTab"]').forEach(btn => {
          btn.addEventListener("click", () => { this._settingsTab = btn.dataset.tab; this._openPanel("settings"); });
        });
        // Close settings
        el.querySelector('[data-action="closeSettings"]')?.addEventListener("click", () => {
          this._closePanel();
        });
        // Position — update live without re-render
        el.querySelectorAll('[data-action="setPortraitPosition"]').forEach(btn => {
          btn.addEventListener("click", async () => {
            const newPos = btn.dataset.pos;
            this._portraitPosition = newPos;
            // Update DOM live FIRST (so it works even if save fails)
            const float = this.element?.querySelector('.cgm-portraits-float');
            if (float) {
              float.classList.remove('cgm-portraits-left', 'cgm-portraits-center', 'cgm-portraits-right');
              float.classList.add(`cgm-portraits-${newPos}`);
            }
            // Update button active states
            el.querySelectorAll('[data-action="setPortraitPosition"]').forEach(b => {
              b.classList.toggle('cgm-opt-active', b.dataset.pos === newPos);
            });
            // Persist
            await this._ss("portraitPosition", newPos);
          });
        });

        // Shape — update live
        el.querySelectorAll('[data-action="setPortraitShape"]').forEach(btn => {
          btn.addEventListener("click", async () => {
            const newShape = btn.dataset.shape;
            this._portraitShape = newShape;
            await this._ss("portraitShape", newShape);
            const shapeCls = `cgm-shape-${newShape}`;
            this.element?.querySelectorAll('.cgm-portrait-img-wrap').forEach(wrap => {
              wrap.classList.remove('cgm-shape-circle', 'cgm-shape-rectangle', 'cgm-shape-rounded');
              wrap.classList.add(shapeCls);
            });
            el.querySelectorAll('[data-action="setPortraitShape"]').forEach(b => {
              b.classList.toggle('cgm-opt-active', b.dataset.shape === newShape);
            });
          });
        });

        // Background shape — update live
        el.querySelectorAll('[data-action="setPortraitBgShape"]').forEach(btn => {
          btn.addEventListener("click", async () => {
            const newShape = btn.dataset.shape;
            this._portraitBgShape = newShape;
            await this._ss("portraitBgShape", newShape);
            const bg = document.querySelector('.cgm-portraits-bg');
            if (bg) {
              bg.classList.remove('cgm-portraits-bg-trapezoid', 'cgm-portraits-bg-rectangle', 'cgm-portraits-bg-rounded', 'cgm-portraits-bg-none');
              bg.classList.add(`cgm-portraits-bg-${newShape}`);
              bg.dataset.bgShape = newShape;
            }
            el.querySelectorAll('[data-action="setPortraitBgShape"]').forEach(b => {
              b.classList.toggle('cgm-opt-active', b.dataset.shape === newShape);
            });
          });
        });

        // Background color — update live
        el.querySelector('[data-action="setPortraitBgColor"]')?.addEventListener("input", async (e) => {
          const val = e.target.value;
          this._portraitBgColor = val;
          await this._ss("portraitBgColor", val);
          const bg = document.querySelector('.cgm-portraits-bg');
          if (bg) bg.style.backgroundColor = val;
          el.querySelector('[data-action="clearPortraitBgColor"]')?.classList.remove('cgm-opt-active');
        });
        el.querySelector('[data-action="clearPortraitBgColor"]')?.addEventListener("click", async () => {
          this._portraitBgColor = "#000000";
          await this._ss("portraitBgColor", "#000000");
          const bg = document.querySelector('.cgm-portraits-bg');
          if (bg) bg.style.backgroundColor = "#000000";
          const picker = el.querySelector('[data-action="setPortraitBgColor"]');
          if (picker) picker.value = "#000000";
          el.querySelectorAll('[data-action="setPortraitBgColor"], [data-action="clearPortraitBgColor"]').forEach(b => {
            if (b.dataset.action === 'clearPortraitBgColor') b.classList.add('cgm-opt-active');
          });
        });

        // Background opacity — update live
        el.querySelector('[data-action="setPortraitBgOpacity"]')?.addEventListener("input", async (e) => {
          const val = parseInt(e.target.value);
          this._portraitBgOpacity = val;
          await this._ss("portraitBgOpacity", val);
          const bg = document.querySelector('.cgm-portraits-bg');
          if (bg) bg.style.opacity = val / 100;
          const vd = el.querySelector('[data-action="setPortraitBgOpacity"] + .cgm-slider-val');
          if (vd) vd.textContent = `${val}%`;
        });

        // Portrait size — update live
        el.querySelector('[data-action="setPortraitSize"]')?.addEventListener("input", async (e) => {
          const val = parseInt(e.target.value);
          this._portraitSize = val;
          await this._ss("portraitSize", val);
          this.element?.querySelectorAll('.cgm-portrait-img-wrap').forEach(wrap => {
            wrap.style.width = `${val}px`;
            wrap.style.height = `${val}px`;
          });
          const vd = el.querySelector('[data-action="setPortraitSize"] + .cgm-slider-val');
          if (vd) vd.textContent = `${val}px`;
        });

        // Image fit — update live
        el.querySelectorAll('[data-action="setPortraitFit"]').forEach(btn => {
          btn.addEventListener("click", async () => {
            const newFit = btn.dataset.fit;
            this._portraitObjectFit = newFit;
            await this._ss("portraitObjectFit", newFit);
            this.element?.querySelectorAll('.cgm-portrait-img').forEach(img => {
              img.style.objectFit = newFit;
            });
            el.querySelectorAll('[data-action="setPortraitFit"]').forEach(b => {
              b.classList.toggle('cgm-opt-active', b.dataset.fit === newFit);
            });
          });
        });

        // Name above bars — toggle live
        el.querySelector('[data-action="togglePortraitNameAbove"]')?.addEventListener("click", async () => {
          this._portraitNameAbove = !this._portraitNameAbove;
          await this._ss("portraitNameAbove", this._portraitNameAbove);
          this.element?.querySelectorAll('.cgm-portrait-wrap').forEach(wrap => {
            wrap.classList.toggle('cgm-portrait-name-above', this._portraitNameAbove);
          });
          const toggle = el.querySelector('[data-action="togglePortraitNameAbove"]');
          if (toggle) toggle.classList.toggle('cgm-toggle-on', this._portraitNameAbove);
        });

        // Name size — update live
        el.querySelector('[data-action="setPortraitNameSize"]')?.addEventListener("input", async (e) => {
          const val = parseInt(e.target.value);
          this._portraitNameSize = val;
          await this._ss("portraitNameSize", val);
          this.element?.querySelectorAll('.cgm-portrait-name').forEach(el => {
            el.style.fontSize = `${val}px`;
          });
          const vd = el.querySelector('[data-action="setPortraitNameSize"] + .cgm-slider-val');
          if (vd) vd.textContent = `${val}px`;
        });

        // Name color — update live
        el.querySelector('[data-action="setPortraitNameColor"]')?.addEventListener("input", async (e) => {
          const val = e.target.value;
          this._portraitNameColor = val;
          await this._ss("portraitNameColor", val);
          this.element?.querySelectorAll('.cgm-portrait-name').forEach(el => {
            el.style.color = val;
          });
        });
        el.querySelector('[data-action="clearPortraitNameColor"]')?.addEventListener("click", async () => {
          this._portraitNameColor = "";
          await this._ss("portraitNameColor", "");
          this.element?.querySelectorAll('.cgm-portrait-name').forEach(el => {
            el.style.color = '';
          });
          const picker = el.querySelector('[data-action="setPortraitNameColor"]');
          if (picker) picker.value = '#e8e0d4';
          el.querySelectorAll('[data-action="setPortraitNameColor"], [data-action="clearPortraitNameColor"]').forEach(b => {
            if (b.dataset.action === 'clearPortraitNameColor') b.classList.add('cgm-opt-active');
          });
        });

        // Name offset — update live
        el.querySelector('[data-action="setPortraitNameOffset"]')?.addEventListener("input", async (e) => {
          const val = parseInt(e.target.value);
          this._portraitNameOffset = val;
          await this._ss("portraitNameOffset", val);
          this.element?.querySelectorAll('.cgm-portrait-name').forEach(el => {
            el.style.marginLeft = `${val}px`;
          });
          const vd = el.querySelector('[data-action="setPortraitNameOffset"] + .cgm-slider-val');
          if (vd) vd.textContent = `${val}px`;
        });

        // Bar offset — update live
        el.querySelector('[data-action="setBarOffset"]')?.addEventListener("input", async (e) => {
          const val = parseInt(e.target.value);
          this._portraitBarOffset = val;
          await this._ss("portraitBarOffset", val);
          this.element?.querySelectorAll('.cgm-portrait-pools').forEach(el => {
            el.style.marginLeft = `${val}px`;
          });
          const vd = el.querySelector('[data-action="setBarOffset"] + .cgm-slider-val');
          if (vd) vd.textContent = `${val}px`;
        });

        // Bar width — update live
        el.querySelector('[data-action="setBarWidth"]')?.addEventListener("input", async (e) => {
          const val = parseInt(e.target.value);
          this._portraitBarWidth = val;
          await this._ss("portraitBarWidth", val);
          this.element?.querySelectorAll('.cgm-portrait-pools').forEach(el => {
            el.style.width = `${val}px`;
          });
          const vd = el.querySelector('[data-action="setBarWidth"] + .cgm-slider-val');
          if (vd) vd.textContent = `${val}px`;
        });

        // Border color — update live
        el.querySelector('[data-action="setPortraitBorderColor"]')?.addEventListener("input", async (e) => {
          const val = e.target.value;
          this._portraitBorderColor = val;
          await this._ss("portraitBorderColor", val);
          this.element?.querySelectorAll('.cgm-portrait-img').forEach(img => {
            img.style.borderColor = val;
          });
        });
        el.querySelector('[data-action="clearPortraitBorderColor"]')?.addEventListener("click", async () => {
          this._portraitBorderColor = "";
          await this._ss("portraitBorderColor", "");
          this.element?.querySelectorAll('.cgm-portrait-img').forEach(img => {
            img.style.borderColor = '';
          });
          const picker = el.querySelector('[data-action="setPortraitBorderColor"]');
          if (picker) picker.value = '#c8a96e';
        });

        // Border width — update live
        el.querySelector('[data-action="setPortraitBorderWidth"]')?.addEventListener("input", async (e) => {
          const val = parseInt(e.target.value);
          this._portraitBorderWidth = val;
          await this._ss("portraitBorderWidth", val);
          this.element?.querySelectorAll('.cgm-portrait-img').forEach(img => {
            img.style.borderWidth = `${val}px`;
          });
          const vd = el.querySelector('[data-action="setPortraitBorderWidth"] + .cgm-slider-val');
          if (vd) vd.textContent = `${val}px`;
        });

        // XP Circle Size — update live
        el.querySelector('[data-action="setXPCircleSize"]')?.addEventListener("input", async (e) => {
          const val = parseInt(e.target.value);
          this._xpCircleSize = val;
          await this._ss("xpCircleSize", val);
          this.element?.querySelectorAll('.cgm-xp-circle').forEach(svg => {
            svg.setAttribute('width', val);
            svg.setAttribute('height', val);
          });
          const vd = el.querySelector('[data-action="setXPCircleSize"] + .cgm-slider-val');
          if (vd) vd.textContent = `${val}px`;
        });

        // XP Circle Offset X — update live
        el.querySelector('[data-action="setXPCircleOffsetX"]')?.addEventListener("input", async (e) => {
          const val = parseInt(e.target.value);
          this._xpCircleOffsetX = val;
          await this._ss("xpCircleOffsetX", val);
          this.element?.querySelectorAll('.cgm-xp-wrap').forEach(el => {
            el.style.marginLeft = `${val}px`;
          });
          const vd = el.querySelector('[data-action="setXPCircleOffsetX"] + .cgm-slider-val');
          if (vd) vd.textContent = `${val}px`;
        });

        // XP Circle Offset Y — update live
        el.querySelector('[data-action="setXPCircleOffsetY"]')?.addEventListener("input", async (e) => {
          const val = parseInt(e.target.value);
          this._xpCircleOffsetY = val;
          await this._ss("xpCircleOffsetY", val);
          this.element?.querySelectorAll('.cgm-xp-wrap').forEach(el => {
            el.style.marginTop = `${val}px`;
          });
          const vd = el.querySelector('[data-action="setXPCircleOffsetY"] + .cgm-slider-val');
          if (vd) vd.textContent = `${val}px`;
        });

        // Radial Menu Size — update live (doesn't affect DOM directly, just stored)
        el.querySelector('[data-action="setRadialMenuSize"]')?.addEventListener("input", async (e) => {
          this._radialMenuSize = parseInt(e.target.value);
          await this._ss("radialMenuSize", this._radialMenuSize);
          const vd = el.querySelector('[data-action="setRadialMenuSize"] + .cgm-slider-val');
          if (vd) vd.textContent = `${this._radialMenuSize}px`;
        });

        // Radial Menu Offset — update live
        el.querySelector('[data-action="setRadialMenuOffset"]')?.addEventListener("input", async (e) => {
          this._radialMenuOffset = parseInt(e.target.value);
          await this._ss("radialMenuOffset", this._radialMenuOffset);
          const vd = el.querySelector('[data-action="setRadialMenuOffset"] + .cgm-slider-val');
          if (vd) vd.textContent = `${this._radialMenuOffset}px`;
        });
        // Name size
        el.querySelector('[data-action="setPortraitNameSize"]')?.addEventListener("input", async (e) => {
          this._portraitNameSize = parseInt(e.target.value);
          await this._ss("portraitNameSize", this._portraitNameSize);
          const vd = el.querySelector('[data-action="setPortraitNameSize"] + .cgm-slider-val');
          if (vd) vd.textContent = `${this._portraitNameSize}px`;
          this.render();
        });
        // Name color
        el.querySelector('[data-action="setPortraitNameColor"]')?.addEventListener("input", async (e) => {
          this._portraitNameColor = e.target.value;
          await this._ss("portraitNameColor", this._portraitNameColor);
          this.render();
        });
        el.querySelector('[data-action="clearPortraitNameColor"]')?.addEventListener("click", async () => {
          this._portraitNameColor = "";
          await this._ss("portraitNameColor", "");
          this.render();
        });
        // Name offset
        el.querySelector('[data-action="setPortraitNameOffset"]')?.addEventListener("input", async (e) => {
          this._portraitNameOffset = parseInt(e.target.value);
          await this._ss("portraitNameOffset", this._portraitNameOffset);
          const vd = el.querySelector('[data-action="setPortraitNameOffset"] + .cgm-slider-val');
          if (vd) vd.textContent = `${this._portraitNameOffset}px`;
          this.render();
        });
        // XP circle size
        el.querySelector('[data-action="setXPCircleSize"]')?.addEventListener("input", async (e) => {
          this._xpCircleSize = parseInt(e.target.value);
          await this._ss("xpCircleSize", this._xpCircleSize);
          const vd = el.querySelector('[data-action="setXPCircleSize"] + .cgm-slider-val');
          if (vd) vd.textContent = `${this._xpCircleSize}px`;
          this.render();
        });
        // XP circle offset X
        el.querySelector('[data-action="setXPCircleOffsetX"]')?.addEventListener("input", async (e) => {
          this._xpCircleOffsetX = parseInt(e.target.value);
          await this._ss("xpCircleOffsetX", this._xpCircleOffsetX);
          const vd = el.querySelector('[data-action="setXPCircleOffsetX"] + .cgm-slider-val');
          if (vd) vd.textContent = `${this._xpCircleOffsetX}px`;
          this.render();
        });
        // Radial menu offset Y
        el.querySelector('[data-action="setXPCircleOffsetY"]')?.addEventListener("input", async (e) => {
          this._xpCircleOffsetY = parseInt(e.target.value);
          await this._ss("xpCircleOffsetY", this._xpCircleOffsetY);
          const vd = el.querySelector('[data-action="setXPCircleOffsetY"] + .cgm-slider-val');
          if (vd) vd.textContent = `${this._xpCircleOffsetY}px`;
          this.render();
        });
        // Radial menu size
        el.querySelector('[data-action="setRadialMenuSize"]')?.addEventListener("input", async (e) => {
          this._radialMenuSize = parseInt(e.target.value);
          await this._ss("radialMenuSize", this._radialMenuSize);
          const vd = el.querySelector('[data-action="setRadialMenuSize"] + .cgm-slider-val');
          if (vd) vd.textContent = `${this._radialMenuSize}px`;
        });
        // Radial menu offset
        el.querySelector('[data-action="setRadialMenuOffset"]')?.addEventListener("input", async (e) => {
          this._radialMenuOffset = parseInt(e.target.value);
          await this._ss("radialMenuOffset", this._radialMenuOffset);
          const vd = el.querySelector('[data-action="setRadialMenuOffset"] + .cgm-slider-val');
          if (vd) vd.textContent = `${this._radialMenuOffset}px`;
        });
        break;
    }

    // Setup drag-and-drop for section buttons if unlocked
    this._setupSectionDragAndDrop();
  }

  /* ─── Section Drag and Drop ─── */
  _setupSectionDragAndDrop() {
    if (!this.element) return;

    const buttons = this.element.querySelectorAll('.cgm-section-btn[data-btn-id]');
    const sections = this.element.querySelectorAll('.cgm-custom-section');

    buttons.forEach(btn => {
      // Skip if already set up (prevents duplicate listeners across re-renders)
      if (btn.dataset.cgmDragSetup === "true") return;

      // Right-click to customize icon
      btn.addEventListener('contextmenu', (e) => {
        if (!this._sectionsUnlocked) return;
        e.preventDefault();
        e.stopPropagation();
        this._showIconCustomizer(btn.dataset.btnId);
      });

      if (!this._sectionsUnlocked) {
        btn.draggable = false;
        btn.classList.remove('cgm-section-btn-unlocked');
        btn.dataset.cgmDragSetup = "true";
        return;
      }

      btn.draggable = true;
      btn.classList.add('cgm-section-btn-unlocked');

      btn.addEventListener('dragstart', (e) => {
        e.dataTransfer.setData('text/plain', btn.dataset.btnId);
        e.dataTransfer.effectAllowed = 'move';
        btn.classList.add('cgm-dragging');
      });

      btn.addEventListener('dragend', () => {
        btn.classList.remove('cgm-dragging');
        sections.forEach(sec => sec.classList.remove('cgm-drag-over'));
      });

      btn.dataset.cgmDragSetup = "true";
    });

    sections.forEach((sec, idx) => {
      sec.addEventListener('dragover', (e) => {
        if (!this._sectionsUnlocked) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        sec.classList.add('cgm-drag-over');
      });

      sec.addEventListener('dragleave', () => {
        sec.classList.remove('cgm-drag-over');
      });

      sec.addEventListener('drop', async (e) => {
        if (!this._sectionsUnlocked) return;
        e.preventDefault();
        sec.classList.remove('cgm-drag-over');

        const btnId = e.dataTransfer.getData('text/plain');
        if (!btnId) return;

        const layout = this._getButtonLayout();

        // If button not in layout yet (e.g. undiscovered dynamic), create entry
        if (!layout[btnId]) {
          const btnDef = this._getButtonDefs().find(b => b.id === btnId);
          if (btnDef) {
            layout[btnId] = {
              section: btnDef.defaultSection,
              size: 16,
              color: btnDef.color || "",
              hidden: false
            };
          } else {
            console.warn(`${MODULE_ID} | Dropped button "${btnId}" not found in button definitions`);
            return;
          }
        }

        // Move the DOM element directly
        const btnEl = this.element?.querySelector(`.cgm-section-btn[data-btn-id="${btnId}"]`);
        if (btnEl) {
          const targetContent = sec.querySelector('.cgm-section-buttons');
          if (targetContent) {
            targetContent.appendChild(btnEl);
          }
        }
        // Update our tracking so next render places it correctly
        layout[btnId].section = idx;
        this._buttonLayout = layout;
        await this._ss("buttonLayout", layout);
        // Also capture the new button order within sections
        this._saveButtonOrder();
      });
    });
  }

  /**
   * Capture the current DOM order of buttons inside each section
   * and persist it so reordering survives re-renders.
   */
  _saveButtonOrder() {
    const bar = document.querySelector(`#${MODULE_ID}-bar`);
    if (!bar) return;
    const layout = foundry.utils.deepClone(this._buttonLayout || {});
    const sections = bar.querySelectorAll('.cgm-custom-section');
    sections.forEach((sec, secIdx) => {
      const buttons = sec.querySelectorAll('.cgm-section-btn[data-btn-id]');
      const order = [];
      buttons.forEach(btn => order.push(btn.dataset.btnId));
      // Store order array on a dedicated key per section
      layout[`_order_${secIdx}`] = order;
    });
    this._buttonLayout = layout;
    this._ss("buttonLayout", layout);
  }

  /**
   * After render, restore the saved button order within each section
   * by re-appending elements in the persisted sequence.
   */
  _restoreButtonOrder() {
    const bar = document.querySelector(`#${MODULE_ID}-bar`);
    if (!bar) return;
    const layout = this._buttonLayout || {};
    const sections = bar.querySelectorAll('.cgm-custom-section');
    sections.forEach((sec, secIdx) => {
      const container = sec.querySelector('.cgm-section-buttons');
      if (!container) return;
      const savedOrder = layout[`_order_${secIdx}`];
      if (!savedOrder || !Array.isArray(savedOrder)) return;
      // Re-append in saved order so they end up in correct sequence
      savedOrder.forEach(btnId => {
        const btn = container.querySelector(`.cgm-section-btn[data-btn-id="${btnId}"]`);
        if (btn) container.appendChild(btn);
      });
    });
  }

  /* ─── Icon Customizer Dialog ─── */
  _showIconCustomizer(btnId) {
    const btnDef = this._getButtonDefs().find(b => b.id === btnId);
    if (!btnDef) return;

    const layout = this._getButtonLayout();
    const cfg = layout[btnId] || {};
    const currentSize = cfg.size || 16;
    const currentColor = cfg.color || btnDef.color || "";
    const currentSection = cfg.section ?? btnDef.defaultSection;
    const isHidden = cfg.hidden === true;

    const dlg = document.createElement('div');
    dlg.className = 'cgm-icon-customizer';
    dlg.innerHTML = `
      <div class="cgm-icon-customizer-title">Customize: ${btnDef.title}</div>
      <div class="cgm-icon-customizer-row">
        <label>Icon Size</label>
        <input type="range" min="8" max="40" value="${currentSize}" class="cgm-slider" id="cgm-icon-size">
        <span class="cgm-slider-val">${currentSize}px</span>
      </div>
      <div class="cgm-icon-customizer-row">
        <label>Icon Color</label>
        <input type="color" value="${currentColor || '#ffffff'}" id="cgm-icon-color">
      </div>
      <div class="cgm-icon-customizer-row">
        <label>Section</label>
        <select id="cgm-icon-section" class="cgm-select">
          <option value="0" ${currentSection === 0 ? 'selected' : ''}>Section 1</option>
          <option value="1" ${currentSection === 1 ? 'selected' : ''}>Section 2</option>
          <option value="2" ${currentSection === 2 ? 'selected' : ''}>Section 3</option>
        </select>
      </div>
      <div class="cgm-icon-customizer-row">
        <label>Hidden</label>
        <button class="cgm-toggle ${isHidden ? 'cgm-toggle-on' : ''}" id="cgm-icon-hide"><span class="cgm-toggle-knob"></span></button>
      </div>
      <div class="cgm-icon-customizer-preview">
        <i class="fas ${btnDef.icon}" style="font-size:${currentSize}px;color:${currentColor || 'inherit'};"></i>
      </div>
      <div class="cgm-icon-customizer-actions">
        <button class="cgm-btn cgm-btn-primary" data-action="saveIcon">Save</button>
        <button class="cgm-btn" data-action="cancelIcon">Cancel</button>
      </div>
    `;

    const overlay = document.createElement('div');
    overlay.className = 'cgm-icon-customizer-overlay';
    overlay.appendChild(dlg);
    document.body.appendChild(overlay);

    // Live preview
    const sizeInput = dlg.querySelector('#cgm-icon-size');
    const colorInput = dlg.querySelector('#cgm-icon-color');
    const preview = dlg.querySelector('.cgm-icon-customizer-preview i');
    const sizeVal = dlg.querySelector('.cgm-slider-val');
    const hideToggle = dlg.querySelector('#cgm-icon-hide');

    sizeInput.addEventListener('input', () => {
      preview.style.fontSize = `${sizeInput.value}px`;
      sizeVal.textContent = `${sizeInput.value}px`;
    });
    colorInput.addEventListener('input', () => {
      preview.style.color = colorInput.value;
    });
    hideToggle.addEventListener('click', () => {
      hideToggle.classList.toggle('cgm-toggle-on');
    });

    // Save
    dlg.querySelector('[data-action="saveIcon"]')?.addEventListener('click', async () => {
      const newSize = parseInt(sizeInput.value);
      const newColor = colorInput.value;
      const newSection = parseInt(dlg.querySelector('#cgm-icon-section').value);
      const newHidden = hideToggle.classList.contains('cgm-toggle-on');
      layout[btnId] = layout[btnId] || {};
      layout[btnId].size = newSize;
      layout[btnId].color = newColor === '#ffffff' && !btnDef.color ? '' : newColor;
      layout[btnId].section = newSection;
      layout[btnId].hidden = newHidden;
      this._buttonLayout = layout;
      await this._ss("buttonLayout", layout);
      overlay.remove();
      this.render();
    });

    // Cancel
    dlg.querySelector('[data-action="cancelIcon"]')?.addEventListener('click', () => {
      overlay.remove();
    });

    // Close on overlay click
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) overlay.remove();
    });
  }

  /* ─── Auto-Hide ─── */

  _setupAutoHide() {
    if (!this.element || this._locked) return;

    // Bar starts hidden in autohide mode
    this._isHidden = true;

    const portraitLayer = document.getElementById("ginzzzu-portrait-layer");
    if (portraitLayer) portraitLayer.classList.add("cgm-portraits-hidden");

    const show = () => {
      if (this._isHidden) { this.element.classList.add("cgm-visible"); this._isHidden = false; }
      clearTimeout(this._autoHideTimer);
      if (portraitLayer) portraitLayer.classList.remove("cgm-portraits-hidden");
      this._autoHideTimer = setTimeout(() => {
        this.element.classList.remove("cgm-visible");
        this._isHidden = true;
        if (portraitLayer) portraitLayer.classList.add("cgm-portraits-hidden");
      }, 3000);
    };

    this.element.addEventListener("mouseenter", show);
    document.addEventListener("mousemove", (e) => {
      const dist = Math.abs((this._dock === "top" ? e.clientY : window.innerHeight - e.clientY));
      if (dist < 40) show();
    });
  }

  /* ─── Connection ─── */

  _startConnectionMonitor() {
    if (this._connInterval) clearInterval(this._connInterval);
    this._updateConnectionIndicator();
    this._connInterval = setInterval(() => this._updateConnectionIndicator(), 5000);
  }

  /* ─── Player Connection Monitor ─── */
  _startPlayerMonitor() {
    if (this._playerMonitorInterval) clearInterval(this._playerMonitorInterval);
    this._previousActiveUsers = new Set(
      game.users?.filter(u => u.active && !u.isGM).map(u => u.id) || []
    );
    this._playerMonitorInterval = setInterval(() => {
      if (!game.users) return;
      const currentlyActive = new Set(
        game.users.filter(u => u.active && !u.isGM).map(u => u.id)
      );

      // DISCONNECTIONS: players who were active but are now inactive
      if (this._previousActiveUsers) {
        for (const userId of this._previousActiveUsers) {
          if (!currentlyActive.has(userId)) {
            const user = game.users.get(userId);
            if (user) {
              const ownedActors = [];
              if (user.character?.id) ownedActors.push(user.character.id);
              game.actors?.forEach(actor => {
                if (actor.hasPlayerOwner && actor.testUserPermission(user, "OWNER")) {
                  ownedActors.push(actor.id);
                }
              });
              ownedActors.forEach(actorId => {
                this._disconnectedActors.add(actorId);
                this._startDisconnectionSound(actorId);
              });
              if (ownedActors.length) this.render();
            }
          }
        }
      }

      // RECONNECTIONS: players who were inactive but are now active
      for (const userId of currentlyActive) {
        if (this._previousActiveUsers && !this._previousActiveUsers.has(userId)) {
          const user = game.users.get(userId);
          if (user) {
            const ownedActors = [];
            if (user.character?.id) ownedActors.push(user.character.id);
            game.actors?.forEach(actor => {
              if (actor.hasPlayerOwner && actor.testUserPermission(user, "OWNER")) {
                ownedActors.push(actor.id);
              }
            });
            ownedActors.forEach(actorId => {
              this._disconnectedActors.delete(actorId);
              this._stopDisconnectionSound(actorId);
            });
            if (ownedActors.length) this.render();
          }
        }
      }

      this._previousActiveUsers = currentlyActive;
    }, 3000);
  }

  /* ─── Start disconnection sound for an actor ─── */
  _startDisconnectionSound(actorId) {
    const soundPath = (() => { try { return game.settings.get(MODULE_ID, "disconnectionSound"); } catch { return ""; } })();
    if (!soundPath) return;
    // Don't start duplicate sound for same actor
    if (this._disconnectionSounds.has(actorId)) return;

    const volume = (() => { try { return game.settings.get(MODULE_ID, "disconnectionSoundVolume"); } catch { return 50; } })();
    const target = (() => { try { return game.settings.get(MODULE_ID, "disconnectionSoundTarget"); } catch { return "gm"; } })();
    const vol = Math.max(0, Math.min(100, volume)) / 100;

    let soundInstance = null;

    if (target === "gm") {
      soundInstance = this._doPlaySound(soundPath, vol, true); // loop = true
    } else if (target === "all") {
      soundInstance = this._doPlaySound(soundPath, vol, true);
      game.socket.emit("module.cypher-gm-taskbar", {
        action: "playSound",
        soundPath,
        volume: vol,
        loop: true
      });
    } else if (target === "disconnected") {
      // Find the user who owns this actor
      const actor = game.actors.get(actorId);
      if (actor) {
        const owner = game.users.find(u => !u.isGM && actor.testUserPermission(u, "OWNER"));
        if (owner) {
          game.socket.emit("module.cypher-gm-taskbar", {
            action: "playSound",
            userId: owner.id,
            soundPath,
            volume: vol,
            loop: true
          });
        }
      }
    }

    this._disconnectionSounds.set(actorId, soundInstance);
  }

  /* ─── Stop disconnection sound for an actor ─── */
  _stopDisconnectionSound(actorId) {
    const soundInstance = this._disconnectionSounds.get(actorId);
    if (soundInstance) {
      try { soundInstance.stop(); } catch {}
      this._disconnectionSounds.delete(actorId);
    }
  }

  /* ─── Stop ALL disconnection sounds ─── */
  _stopAllDisconnectionSounds() {
    for (const [actorId, soundInstance] of this._disconnectionSounds) {
      try { soundInstance?.stop(); } catch {}
    }
    this._disconnectionSounds.clear();
  }

  _doPlaySound(path, volume, loop) {
    if (!path || !game.audio) return null;
    try {
      const src = game.audio.create({ src: path, volume, loop });
      if (src) {
        src.play();
        console.log(`[CypherGMTaskbar] Playing sound: ${path} (vol: ${volume}, loop: ${loop})`);
        return src;
      }
    } catch (err) {
      console.warn("[CypherGMTaskbar] Failed to play sound:", err);
    }
    return null;
  }

  _updateConnectionIndicator() {
    if (!this.element) return;
    const indicator = this.element.querySelector(".cgm-conn-indicator");
    if (!indicator) return;
    const status = this._getConnectionStatus();
    indicator.className = `cgm-conn-indicator ${status.cls}`;
    indicator.title = status.title;
  }

  _getConnectionStatus() {
    const socketConnected = game.socket?.connected ?? false;
    const user = game.user;
    if (!socketConnected || !user) return { cls: "cgm-conn-disconnected", title: "Disconnected — no server connection" };
    const activeGM = game.users.find(u => u.isGM && u.active);
    const isActiveGM = activeGM?.id === user.id;
    if (!isActiveGM && activeGM) return { cls: "cgm-conn-weak", title: "Secondary GM — another GM is primary" };
    const latency = game.socket?.latency ?? 0;
    if (latency > 300) return { cls: "cgm-conn-weak", title: `Poor connection — latency ${latency}ms` };
    return { cls: "cgm-conn-good", title: `Connected — latency ${latency > 0 ? latency + 'ms' : 'OK'}` };
  }

  _applySettings() {
    if (!this.element) return;
    this.element.style.opacity = `${this._opacity}%`;
    this.element.classList.toggle("cgm-compact", this._compact);
    if (!this._locked) { this.element.classList.add("cgm-autohide"); }
  }

  /* ═══════════════════════════════════════════════════════════
     VALUES PANELS — Cash & Values, Assets, Items
     ═══════════════════════════════════════════════════════════ */

  /* ─── Helper: resolve dropped item (from sidebar, compendium, or actor) ─── */
  async _resolveDroppedItem(e, actor) {
    let data;
    try {
      data = TextEditor.getDragEventData(e);
    } catch (err) {
      try { data = JSON.parse(e.dataTransfer.getData("text/plain")); } catch { return null; }
    }
    if (!data || data.type !== "Item") return null;

    let item;
    try {
      item = await Item.implementation.fromDropData(data);
    } catch { return null; }
    if (!item) return null;

    // Ensure item exists on actor; create if dragged from world/compendium
    let actorItem = actor.items.get(item.id);
    if (!actorItem) {
      try {
        const created = await actor.createEmbeddedDocuments("Item", [item.toObject()]);
        actorItem = created?.[0];
      } catch (err) {
        console.warn(`${MODULE_ID} | Failed to create item on actor:`, err);
        return null;
      }
    }
    return actorItem || item;
  }

  /* ─── Helper: get item quantity (handles different Cypher System paths) ─── */
  _getItemQuantity(item) {
    if (!item) return 0;
    // Get data from multiple sources for maximum compatibility
    const sys = item.system || {};
    const src = item.system?._source || item._source?.system || {};
    const raw = item.toObject?.()?.system || {};

    // Collect all possible quantity values
    const candidates = [];
    const add = (v) => { if (v !== undefined && v !== null) candidates.push(Number(v)); };

    // Standard paths
    add(sys.quantity); add(src.quantity); add(raw.quantity);
    add(sys.amount); add(src.amount); add(raw.amount);
    add(sys.count); add(src.count); add(raw.count);
    add(sys.number); add(src.number); add(raw.number);

    // Nested paths
    add(sys.basic?.quantity); add(src.basic?.quantity); add(raw.basic?.quantity);
    add(sys.basic?.amount); add(src.basic?.amount); add(raw.basic?.amount);
    add(sys.settings?.quantity); add(src.settings?.quantity); add(raw.settings?.quantity);

    // Ammo-specific paths
    add(sys.ammo?.value); add(src.ammo?.value); add(raw.ammo?.value);
    add(sys.ammo?.quantity); add(src.ammo?.quantity); add(raw.ammo?.quantity);
    add(sys.ammo?.current); add(src.ammo?.current); add(raw.ammo?.current);
    if (typeof sys.ammo === 'number') add(sys.ammo);
    if (typeof src.ammo === 'number') add(src.ammo);
    if (typeof raw.ammo === 'number') add(raw.ammo);

    // Charge/uses paths
    add(sys.charges?.value); add(src.charges?.value); add(raw.charges?.value);
    add(sys.charges?.current); add(src.charges?.current); add(raw.charges?.current);
    add(sys.uses?.value); add(src.uses?.value); add(raw.uses?.value);
    add(sys.uses?.current); add(src.uses?.current); add(raw.uses?.current);

    // Return first valid number, default to 1
    for (const n of candidates) {
      if (!isNaN(n)) return n;
    }
    return 1;
  }

  /* ─── Helper: set item quantity (handles different Cypher System paths) ─── */
  async _setItemQuantity(item, newQty) {
    if (!item) return;
    const qty = Math.max(0, Number(newQty) || 0);
    const sys = item.system || {};
    const src = item.system?._source || item._source?.system || {};
    const raw = item.toObject?.()?.system || {};

    // Determine which path to update by checking what exists
    let updatePath = null;

    // Ammo paths
    if (src.ammo?.value !== undefined || sys.ammo?.value !== undefined || raw.ammo?.value !== undefined)
      updatePath = "system.ammo.value";
    else if (src.ammo?.quantity !== undefined || sys.ammo?.quantity !== undefined || raw.ammo?.quantity !== undefined)
      updatePath = "system.ammo.quantity";
    else if (src.ammo?.current !== undefined || sys.ammo?.current !== undefined || raw.ammo?.current !== undefined)
      updatePath = "system.ammo.current";
    else if (typeof src.ammo === 'number' || typeof sys.ammo === 'number' || typeof raw.ammo === 'number')
      updatePath = "system.ammo";
    // Standard quantity
    else if (src.quantity !== undefined || sys.quantity !== undefined || raw.quantity !== undefined)
      updatePath = "system.quantity";
    else if (src.amount !== undefined || sys.amount !== undefined || raw.amount !== undefined)
      updatePath = "system.amount";
    else if (src.basic?.quantity !== undefined || sys.basic?.quantity !== undefined || raw.basic?.quantity !== undefined)
      updatePath = "system.basic.quantity";
    else if (src.basic?.amount !== undefined || sys.basic?.amount !== undefined || raw.basic?.amount !== undefined)
      updatePath = "system.basic.amount";
    else if (src.count !== undefined || sys.count !== undefined || raw.count !== undefined)
      updatePath = "system.count";
    else if (src.number !== undefined || sys.number !== undefined || raw.number !== undefined)
      updatePath = "system.number";
    // Charges/uses
    else if (src.charges?.value !== undefined || sys.charges?.value !== undefined || raw.charges?.value !== undefined)
      updatePath = "system.charges.value";
    else if (src.uses?.value !== undefined || sys.uses?.value !== undefined || raw.uses?.value !== undefined)
      updatePath = "system.uses.value";

    if (updatePath) {
      await item.update({ [updatePath]: qty });
    } else {
      // Last resort: create system.quantity
      await item.update({ "system.quantity": qty });
    }
  }
  async _showCashValuesPanel(actorId, wrapEl) {
    const actor = game.actors.get(actorId);
    if (!actor) return;
    const name = actor.name;

    // Read money from actor flag, falling back to Cypher System currency
    let money = actor.getFlag("cypher-taskbar", "cashMoney");
    if (!money) {
      const sysCur = actor.system?.equipment?.currency;
      if (sysCur?.active) {
        money = {
          cp: sysCur.quantity1 ?? 0,
          sp: sysCur.quantity2 ?? 0,
          gp: sysCur.quantity3 ?? 0,
          pp: sysCur.quantity4 ?? 0
        };
      } else {
        money = { cp: 0, sp: 0, gp: 0, pp: 0 };
      }
    }
    const { cp = 0, sp = 0, gp = 0, pp = 0 } = money;

    // Get carriable valuables
    const valuableIds = actor.getFlag("cypher-taskbar", "cashValuables") ?? [];
    const valuables = valuableIds
      .map(id => actor.items.get(id))
      .filter(Boolean)
      .sort((a, b) => a.name.localeCompare(b.name));

    // Clean up missing items
    if (valuables.length !== valuableIds.length) {
      const validIds = valuables.map(i => i.id);
      await actor.setFlag("cypher-taskbar", "cashValuables", validIds);
    }

    const panelW = 300;
    const panelH = 380;

    const { panel, lineContainer } = this._createConnectedPanel(wrapEl, 3, 9, panelW, panelH, "cgm-cash-values-panel", "fa-coins", `Cash & Values: ${name}`, "rgba(212,169,77,0.7)");
    this._cashValuesPanelEl = panel;

    const moneyRow = `
      <div class="cgm-cash-money-section">
        <div class="cgm-cash-section-title"><i class="fas fa-coins"></i> MONEY</div>
        <div class="cgm-cash-money-row">
          <div class="cgm-cash-coin">
            <label class="cgm-cash-coin-label">CP</label>
            <input type="number" class="cgm-cash-input" id="cgm-cash-cp" value="${cp}" min="0">
            <div class="cgm-cash-coin-btns">
              <button type="button" class="cgm-cash-coin-btn" data-cash-minus="cp" title="-1"><i class="fas fa-minus"></i></button>
              <button type="button" class="cgm-cash-coin-btn" data-cash-plus="cp" title="+1"><i class="fas fa-plus"></i></button>
            </div>
          </div>
          <div class="cgm-cash-coin">
            <label class="cgm-cash-coin-label">SP</label>
            <input type="number" class="cgm-cash-input" id="cgm-cash-sp" value="${sp}" min="0">
            <div class="cgm-cash-coin-btns">
              <button type="button" class="cgm-cash-coin-btn" data-cash-minus="sp" title="-1"><i class="fas fa-minus"></i></button>
              <button type="button" class="cgm-cash-coin-btn" data-cash-plus="sp" title="+1"><i class="fas fa-plus"></i></button>
            </div>
          </div>
          <div class="cgm-cash-coin">
            <label class="cgm-cash-coin-label">GP</label>
            <input type="number" class="cgm-cash-input" id="cgm-cash-gp" value="${gp}" min="0">
            <div class="cgm-cash-coin-btns">
              <button type="button" class="cgm-cash-coin-btn" data-cash-minus="gp" title="-1"><i class="fas fa-minus"></i></button>
              <button type="button" class="cgm-cash-coin-btn" data-cash-plus="gp" title="+1"><i class="fas fa-plus"></i></button>
            </div>
          </div>
          <div class="cgm-cash-coin">
            <label class="cgm-cash-coin-label">PP</label>
            <input type="number" class="cgm-cash-input" id="cgm-cash-pp" value="${pp}" min="0">
            <div class="cgm-cash-coin-btns">
              <button type="button" class="cgm-cash-coin-btn" data-cash-minus="pp" title="-1"><i class="fas fa-minus"></i></button>
              <button type="button" class="cgm-cash-coin-btn" data-cash-plus="pp" title="+1"><i class="fas fa-plus"></i></button>
            </div>
          </div>
        </div>
      </div>`;

    const valuablesGrid = valuables.length
      ? valuables.map(i => `
        <div class="cgm-cash-valuable-item" data-cash-valuable="${i.id}" title="${foundry.utils.escapeHTML(i.name)}">
          <img src="${i.img || 'icons/svg/item-bag.svg'}" alt="" draggable="false">
          <button class="cgm-cash-valuable-remove" data-remove-cash-valuable="${i.id}" title="Remove"><i class="fas fa-xmark"></i></button>
        </div>`).join("")
      : `<div class="cgm-cash-valuables-empty"><i class="fas fa-hand-holding"></i><span>Drop valuable items here</span></div>`;

    panel.querySelector('.cgm-connected-panel-body').innerHTML = `
      ${moneyRow}
      <div class="cgm-cash-valuables-section">
        <div class="cgm-cash-section-title"><i class="fas fa-gem"></i> CARRIABLE VALUES</div>
        <div class="cgm-cash-valuables-grid" data-cash-dropzone>
          ${valuablesGrid}
        </div>
      </div>
    `;

    this._makePanelDraggable(panel, "_cashValuesLineStart", "_cashValuesPanelPos");

    // Close button only — no click-outside
    panel.querySelector(".cgm-connected-panel-close")?.addEventListener("click", (e) => {
      e.stopPropagation();
      this._hideCashValuesPanel();
    });

    // Coin +/- handlers
    panel.querySelectorAll("[data-cash-plus]").forEach(btn => {
      btn.addEventListener("click", async () => {
        const type = btn.dataset.cashPlus;
        const input = panel.querySelector(`#cgm-cash-${type}`);
        if (!input) return;
        const val = Math.max(0, parseInt(input.value, 10) || 0);
        input.value = val + 1;
        await this._saveCashMoney(actor, panel);
      });
    });
    panel.querySelectorAll("[data-cash-minus]").forEach(btn => {
      btn.addEventListener("click", async () => {
        const type = btn.dataset.cashMinus;
        const input = panel.querySelector(`#cgm-cash-${type}`);
        if (!input) return;
        const val = Math.max(0, parseInt(input.value, 10) || 0);
        input.value = Math.max(0, val - 1);
        await this._saveCashMoney(actor, panel);
      });
    });
    // Input change
    panel.querySelectorAll(".cgm-cash-input").forEach(input => {
      input.addEventListener("change", async () => {
        await this._saveCashMoney(actor, panel);
      });
    });

    // Drop zone for valuables
    const dropzone = panel.querySelector("[data-cash-dropzone]");
    if (dropzone) {
      dropzone.addEventListener("dragover", (e) => { e.preventDefault(); dropzone.classList.add("cgm-dragover"); });
      dropzone.addEventListener("dragleave", () => dropzone.classList.remove("cgm-dragover"));
      dropzone.addEventListener("drop", async (e) => {
        e.preventDefault();
        dropzone.classList.remove("cgm-dragover");
        const item = await this._resolveDroppedItem(e, actor);
        if (!item) return;
        const existing = actor.getFlag("cypher-taskbar", "cashValuables") ?? [];
        if (existing.includes(item.id)) {
          ui.notifications.warn(`${item.name} is already in carriable values.`);
          return;
        }
        await actor.setFlag("cypher-taskbar", "cashValuables", [...existing, item.id]);
        ui.notifications.info(`Added ${item.name} to carriable values.`);
        this._hideCashValuesPanel();
        this._showCashValuesPanel(actorId, wrapEl);
      });
    }

    // Remove valuable handlers
    panel.querySelectorAll("[data-remove-cash-valuable]").forEach(btn => {
      btn.addEventListener("click", async (e) => {
        e.stopPropagation();
        const itemId = btn.dataset.removeCashValuable;
        const item = actor.items.get(itemId);
        const itemName = item?.name ?? "Item";
        if (item) await item.delete();
        const existing = actor.getFlag("cypher-taskbar", "cashValuables") ?? [];
        await actor.setFlag("cypher-taskbar", "cashValuables", existing.filter(id => id !== itemId));
        ui.notifications.info(`Removed ${itemName} from carriable values.`);
        this._hideCashValuesPanel();
        this._showCashValuesPanel(actorId, wrapEl);
      });
    });
  }

  async _saveCashMoney(actor, panel) {
    const cp = Math.max(0, parseInt(panel.querySelector("#cgm-cash-cp")?.value, 10) || 0);
    const sp = Math.max(0, parseInt(panel.querySelector("#cgm-cash-sp")?.value, 10) || 0);
    const gp = Math.max(0, parseInt(panel.querySelector("#cgm-cash-gp")?.value, 10) || 0);
    const pp = Math.max(0, parseInt(panel.querySelector("#cgm-cash-pp")?.value, 10) || 0);
    await actor.setFlag("cypher-taskbar", "cashMoney", { cp, sp, gp, pp });
    // Also sync to Cypher System currency if active
    const sysCur = actor.system?.equipment?.currency;
    if (sysCur?.active) {
      await actor.update({
        "system.equipment.currency.quantity1": cp,
        "system.equipment.currency.quantity2": sp,
        "system.equipment.currency.quantity3": gp,
        "system.equipment.currency.quantity4": pp
      });
    }
  }

  _hideCashValuesPanel() {
    if (this._cashValuesPanelEl) {
      this._cashValuesPanelEl._cgmDragCleanup?.();
      this._cashValuesPanelEl.classList.remove("cgm-connected-panel-visible");
      setTimeout(() => { this._cashValuesPanelEl?.remove(); this._cashValuesPanelEl = null; }, 200);
    }
    if (this._connectingLineEl) {
      this._connectingLineEl.remove();
      this._connectingLineEl = null;
    }
  }

  /* ─── Assets Panel ─── */
  async _showAssetsPanel(actorId, wrapEl) {
    const actor = game.actors.get(actorId);
    if (!actor) return;
    const name = actor.name;

    const assetIds = actor.getFlag("cypher-taskbar", "assetsItems") ?? [];
    const assets = assetIds
      .map(id => actor.items.get(id))
      .filter(Boolean)
      .sort((a, b) => a.name.localeCompare(b.name));

    if (assets.length !== assetIds.length) {
      const validIds = assets.map(i => i.id);
      await actor.setFlag("cypher-taskbar", "assetsItems", validIds);
    }

    const panelW = 280;
    const panelH = 320;

    const { panel, lineContainer } = this._createConnectedPanel(wrapEl, 3, 9, panelW, panelH, "cgm-assets-panel", "fa-landmark", `Assets: ${name}`, "rgba(200,169,110,0.7)");
    this._assetsPanelEl = panel;

    const assetsGrid = assets.length
      ? assets.map(i => `
        <div class="cgm-assets-card" data-assets-item="${i.id}" title="${foundry.utils.escapeHTML(i.name)}">
          <img src="${i.img || 'icons/svg/item-bag.svg'}" alt="">
          <span class="cgm-assets-name">${i.name}</span>
          <button class="cgm-assets-remove" data-remove-assets-item="${i.id}" title="Remove"><i class="fas fa-xmark"></i></button>
        </div>`).join("")
      : `<div class="cgm-assets-empty"><i class="fas fa-landmark"></i><span>Drop assets here</span></div>`;

    panel.querySelector('.cgm-connected-panel-body').innerHTML = `
      <div class="cgm-assets-grid" data-assets-dropzone>
        ${assetsGrid}
      </div>
    `;

    this._makePanelDraggable(panel, "_assetsLineStart", "_assetsPanelPos");

    panel.querySelector(".cgm-connected-panel-close")?.addEventListener("click", (e) => {
      e.stopPropagation();
      this._hideAssetsPanel();
    });

    // Drop zone
    const dropzone = panel.querySelector("[data-assets-dropzone]");
    if (dropzone) {
      dropzone.addEventListener("dragover", (e) => { e.preventDefault(); dropzone.classList.add("cgm-dragover"); });
      dropzone.addEventListener("dragleave", () => dropzone.classList.remove("cgm-dragover"));
      dropzone.addEventListener("drop", async (e) => {
        e.preventDefault();
        dropzone.classList.remove("cgm-dragover");
        const item = await this._resolveDroppedItem(e, actor);
        if (!item) return;
        const existing = actor.getFlag("cypher-taskbar", "assetsItems") ?? [];
        if (existing.includes(item.id)) {
          ui.notifications.warn(`${item.name} is already in assets.`);
          return;
        }
        await actor.setFlag("cypher-taskbar", "assetsItems", [...existing, item.id]);
        ui.notifications.info(`Added ${item.name} to assets.`);
        this._hideAssetsPanel();
        this._showAssetsPanel(actorId, wrapEl);
      });
    }

    // Remove asset handlers
    panel.querySelectorAll("[data-remove-assets-item]").forEach(btn => {
      btn.addEventListener("click", async (e) => {
        e.stopPropagation();
        const itemId = btn.dataset.removeAssetsItem;
        const item = actor.items.get(itemId);
        const itemName = item?.name ?? "Item";
        if (item) await item.delete();
        const existing = actor.getFlag("cypher-taskbar", "assetsItems") ?? [];
        await actor.setFlag("cypher-taskbar", "assetsItems", existing.filter(id => id !== itemId));
        ui.notifications.info(`Removed ${itemName} from assets.`);
        this._hideAssetsPanel();
        this._showAssetsPanel(actorId, wrapEl);
      });
    });
  }

  _hideAssetsPanel() {
    if (this._assetsPanelEl) {
      this._assetsPanelEl._cgmDragCleanup?.();
      this._assetsPanelEl.classList.remove("cgm-connected-panel-visible");
      setTimeout(() => { this._assetsPanelEl?.remove(); this._assetsPanelEl = null; }, 200);
    }
    if (this._connectingLineEl) {
      this._connectingLineEl.remove();
      this._connectingLineEl = null;
    }
  }

  /* ─── Items Panel ─── */
  _showItemsPanel(actorId, wrapEl, activeTab = "equipment", sortMode = "name") {
    const actor = game.actors.get(actorId);
    if (!actor) return;
    const name = actor.name;

    // Determine which items to show based on tab
    let items = [];
    if (activeTab === "equipment") {
      items = actor.items.filter(i => !["ability", "skill", "pool", "cypher", "artifact", "ammo"].includes(i.type));
    } else if (activeTab === "cyphers") {
      items = actor.items.filter(i => i.type === "cypher");
    } else if (activeTab === "artifacts") {
      items = actor.items.filter(i => i.type === "artifact");
    } else if (activeTab === "ammo") {
      items = actor.items.filter(i => i.type === "ammo");
    }

    // Sort
    const sortFns = {
      name:  (a, b) => a.name.localeCompare(b.name),
      value: (a, b) => (a.system?.price?.value ?? a.system?.value ?? 0) - (b.system?.price?.value ?? b.system?.value ?? 0),
      level: (a, b) => (a.system?.level ?? 0) - (b.system?.level ?? 0),
      amount:(a, b) => this._getItemQuantity(a) - this._getItemQuantity(b),
      time:  (a, b) => (a.sort ?? 0) - (b.sort ?? 0),
    };
    items = items.sort(sortFns[sortMode] || sortFns.name);

    const defaultW = 320;
    const defaultH = 420;
    const maxH = Math.floor(window.innerHeight * 0.8);
    const panelW = this._itemsPanelSize?.width  || defaultW;
    let panelH = this._itemsPanelSize?.height || defaultH;
    if (panelH > maxH) panelH = maxH;

    // If panel already exists, just refresh content
    const existingPanel = this._itemsPanelEl;
    let panel;
    if (existingPanel && existingPanel.dataset.actorId === actorId) {
      panel = existingPanel;
    } else {
      if (existingPanel) this._hideItemsPanel();
      const result = this._createConnectedPanel(wrapEl, 3, 9, panelW, panelH, "cgm-items-panel", "fa-box-open", `Items: ${name}`, "rgba(100,180,220,0.7)");
      panel = result.panel;
      this._itemsPanelEl = panel;
      panel.dataset.actorId = actorId;

      this._makePanelDraggable(panel, "_itemsLineStart", "_itemsPanelPos");
      this._makePanelResizable(panel, "_itemsPanelSize", 260, 200, null, maxH);

      panel.querySelector(".cgm-connected-panel-close")?.addEventListener("click", (e) => {
        e.stopPropagation();
        this._hideItemsPanel();
      });
    }

    // Tab definitions
    const tabs = [
      { key: "equipment", label: "Equipment", icon: "fa-box" },
      { key: "cyphers",   label: "Cyphers",   icon: "fa-flask" },
      { key: "artifacts", label: "Artifacts", icon: "fa-gem" },
      { key: "ammo",      label: "Ammo",      icon: "fa-bullseye" },
    ];

    const tabBar = tabs.map(t => `
      <button class="cgm-items-tab ${activeTab === t.key ? 'active' : ''}" data-tab="${t.key}">
        <i class="fas ${t.icon}"></i> ${t.label}
      </button>
    `).join("");

    // Sort bar
    const sortOptions = [
      { key: "name",   label: "Name",   icon: "fa-font" },
      { key: "value",  label: "Value",  icon: "fa-coins" },
      { key: "level",  label: "Level",  icon: "fa-layer-group" },
      { key: "amount", label: "Amount", icon: "fa-hashtag" },
      { key: "time",   label: "Time",   icon: "fa-clock" },
    ];
    const sortBar = sortOptions.map(o => `
      <button class="cgm-items-sort-btn ${sortMode === o.key ? 'active' : ''}" data-sort="${o.key}" title="Sort by ${o.label}">
        <i class="fas ${o.icon}"></i> ${o.label}
      </button>
    `).join("");

    // Item rows with quantity controls
    const itemsList = items.length
      ? items.map(i => {
          const sys = i.system || {};
          const qty = this._getItemQuantity(i);
          const level = sys.level ?? "—";
          const value = sys.price?.value ?? sys.value ?? "—";
          // For ammo, show ammo-specific fields
          const isAmmo = i.type === "ammo";
          const meta = isAmmo
            ? `Qty ${qty}`
            : `Lv.${level} · Qty ${qty}${value !== "—" ? " · " + value : ""}`;
          return `
            <div class="cgm-items-row" data-cgm-item-id="${i.id}">
              <img src="${i.img || 'icons/svg/item-bag.svg'}" alt="">
              <div class="cgm-items-info">
                <span class="cgm-items-name">${i.name}</span>
                <span class="cgm-items-meta">${meta}</span>
              </div>
              <span class="cgm-items-type">${i.type}</span>
              <div class="cgm-items-qty-controls">
                <button class="cgm-items-add" data-add="${i.id}" title="Add one"><i class="fas fa-plus"></i></button>
                <button class="cgm-items-delete" data-delete="${i.id}" title="Remove one"><i class="fas fa-trash"></i></button>
              </div>
            </div>`;
        }).join("")
      : `<div class="cgm-items-empty"><i class="fas fa-box-open"></i><span>No ${activeTab} items</span></div>`;

    panel.querySelector('.cgm-connected-panel-body').innerHTML = `
      <div class="cgm-items-tabs">${tabBar}</div>
      <div class="cgm-items-sort-bar">${sortBar}</div>
      <div class="cgm-items-list" data-items-dropzone>
        ${itemsList}
      </div>
      <div class="cgm-items-resize-handle" title="Resize"></div>
    `;

    // Tab buttons
    panel.querySelectorAll(".cgm-items-tab").forEach(btn => {
      btn.addEventListener("click", () => {
        const newTab = btn.dataset.tab;
        this._showItemsPanel(actorId, wrapEl, newTab, sortMode);
      });
    });

    // Sort buttons
    panel.querySelectorAll(".cgm-items-sort-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        const newSort = btn.dataset.sort;
        this._showItemsPanel(actorId, wrapEl, activeTab, newSort);
      });
    });

    // Add buttons
    panel.querySelectorAll(".cgm-items-add").forEach(btn => {
      btn.addEventListener("click", async (e) => {
        e.stopPropagation();
        const itemId = btn.dataset.add;
        const item = actor.items.get(itemId);
        if (!item) return;
        const qty = this._getItemQuantity(item);
        await this._setItemQuantity(item, qty + 1);
        ui.notifications.info(`Increased ${item.name} quantity to ${qty + 1}.`);
        this._showItemsPanel(actorId, wrapEl, activeTab, sortMode);
      });
    });

    // Delete buttons
    panel.querySelectorAll(".cgm-items-delete").forEach(btn => {
      btn.addEventListener("click", async (e) => {
        e.stopPropagation();
        const itemId = btn.dataset.delete;
        const item = actor.items.get(itemId);
        if (!item) return;
        const qty = this._getItemQuantity(item);
        if (qty > 1) {
          await this._setItemQuantity(item, qty - 1);
          ui.notifications.info(`Reduced ${item.name} quantity to ${qty - 1}.`);
        } else {
          await item.delete();
          ui.notifications.info(`Removed ${item.name}.`);
        }
        this._showItemsPanel(actorId, wrapEl, activeTab, sortMode);
      });
    });

    // Drop zone — add item to actor
    const dropzone = panel.querySelector("[data-items-dropzone]");
    if (dropzone) {
      dropzone.addEventListener("dragover", (e) => { e.preventDefault(); dropzone.classList.add("cgm-dragover"); });
      dropzone.addEventListener("dragleave", () => dropzone.classList.remove("cgm-dragover"));
      dropzone.addEventListener("drop", async (e) => {
        e.preventDefault();
        dropzone.classList.remove("cgm-dragover");
        const item = await this._resolveDroppedItem(e, actor);
        if (!item) return;
        if (actor.items.get(item.id)) {
          ui.notifications.warn(`${actor.name} already has ${item.name}.`);
          return;
        }
        await actor.createEmbeddedDocuments("Item", [item.toObject()]);
        ui.notifications.info(`Added ${item.name} to ${actor.name}.`);
        this._showItemsPanel(actorId, wrapEl, activeTab, sortMode);
      });
    }

    // Click to open item sheet
    panel.querySelectorAll(".cgm-items-row").forEach(row => {
      row.addEventListener("click", (e) => {
        if (e.target.closest(".cgm-items-delete") || e.target.closest(".cgm-items-add")) return;
        const item = actor.items.get(row.dataset.cgmItemId);
        if (item) item.sheet.render(true);
      });
    });

    // Fancy HTML tooltip on hover
    panel.querySelectorAll(".cgm-items-row").forEach(row => {
      row.addEventListener("mouseenter", (e) => {
        const item = actor.items.get(row.dataset.cgmItemId);
        if (item) {
          const desc = item.system?.description || "";
          if (desc) this._showItemTooltip(row, desc);
        }
      });
      row.addEventListener("mouseleave", () => {
        this._hideItemTooltip();
      });
    });
  }

  /* ─── Fancy Item Tooltip ─── */
  _showItemTooltip(targetEl, html) {
    this._hideItemTooltip();
    if (!html || html.trim() === "") return;

    const tooltip = document.createElement("div");
    tooltip.className = "cgm-item-tooltip";
    tooltip.innerHTML = `
      <div class="cgm-item-tooltip-body">${html}</div>
    `;
    document.body.appendChild(tooltip);
    this._itemTooltipEl = tooltip;

    const rect = targetEl.getBoundingClientRect();
    const tRect = tooltip.getBoundingClientRect();
    let left = rect.right + 8;
    let top = rect.top;
    if (left + tRect.width > window.innerWidth - 8) {
      left = rect.left - tRect.width - 8;
    }
    if (top + tRect.height > window.innerHeight - 8) {
      top = window.innerHeight - tRect.height - 8;
    }
    if (top < 8) top = 8;
    tooltip.style.left = `${left}px`;
    tooltip.style.top = `${top}px`;
    tooltip.classList.add("cgm-item-tooltip-visible");

    tooltip.addEventListener("mouseenter", () => {});
    tooltip.addEventListener("mouseleave", () => this._hideItemTooltip());
  }

  _hideItemTooltip() {
    if (this._itemTooltipEl) {
      this._itemTooltipEl.remove();
      this._itemTooltipEl = null;
    }
  }

  _hideItemsPanel() {
    if (this._itemsPanelEl) {
      this._itemsPanelEl._cgmDragCleanup?.();
      this._itemsPanelEl.classList.remove("cgm-connected-panel-visible");
      setTimeout(() => { this._itemsPanelEl?.remove(); this._itemsPanelEl = null; }, 200);
    }
    if (this._connectingLineEl) {
      this._connectingLineEl.remove();
      this._connectingLineEl = null;
    }
  }

  /* ─── Drop Item Panel — quick drag-and-drop to equip ─── */
  _showDropItemPanel(actorId, wrapEl) {
    const actor = game.actors.get(actorId);
    if (!actor) return;
    const name = actor.name;

    const panelW = 280;
    const panelH = 240;

    const { panel, lineContainer } = this._createConnectedPanel(wrapEl, 3, 9, panelW, panelH, "cgm-drop-item-panel", "fa-hand-holding-medical", `Drop Item: ${name}`, "rgba(110,207,122,0.7)");
    this._dropItemPanelEl = panel;

    panel.querySelector('.cgm-connected-panel-body').innerHTML = `
      <div class="cgm-drop-item-zone" data-drop-item-zone>
        <i class="fas fa-hand-holding-medical"></i>
        <span>Drop an item here to add it to ${name}'s equipment</span>
      </div>
    `;

    this._makePanelDraggable(panel, "_itemsLineStart", "_itemsPanelPos");

    panel.querySelector(".cgm-connected-panel-close")?.addEventListener("click", (e) => {
      e.stopPropagation();
      this._hideDropItemPanel();
    });

    const dropzone = panel.querySelector("[data-drop-item-zone]");
    if (dropzone) {
      dropzone.addEventListener("dragover", (e) => { e.preventDefault(); dropzone.classList.add("cgm-dragover"); });
      dropzone.addEventListener("dragleave", () => dropzone.classList.remove("cgm-dragover"));
      dropzone.addEventListener("drop", async (e) => {
        e.preventDefault();
        dropzone.classList.remove("cgm-dragover");
        const item = await this._resolveDroppedItem(e, actor);
        if (!item) return;
        if (actor.items.get(item.id)) {
          ui.notifications.warn(`${actor.name} already has ${item.name}.`);
          return;
        }
        await actor.createEmbeddedDocuments("Item", [item.toObject()]);
        ui.notifications.info(`Added ${item.name} to ${actor.name}.`);
        this._hideDropItemPanel();
      });
    }
  }

  _hideDropItemPanel() {
    if (this._dropItemPanelEl) {
      this._dropItemPanelEl._cgmDragCleanup?.();
      this._dropItemPanelEl.classList.remove("cgm-connected-panel-visible");
      setTimeout(() => { this._dropItemPanelEl?.remove(); this._dropItemPanelEl = null; }, 200);
    }
    if (this._connectingLineEl) {
      this._connectingLineEl.remove();
      this._connectingLineEl = null;
    }
  }

  /* ─── Helper: create connected panel with line ─── */
  _createConnectedPanel(wrapEl, sliceIndex, segCount, panelW, panelH, panelClass, iconClass, title, lineColor) {
    const rect = wrapEl.getBoundingClientRect();
    const portraitCx = rect.left + rect.width / 2;
    const portraitCy = rect.top + rect.height / 2;
    const size = this._radialMenuSize;
    const offset = this._radialMenuOffset;

    const spaceAbove = portraitCy - size / 2;
    const spaceBelow = window.innerHeight - portraitCy - size / 2;
    let mainCy;
    if (spaceAbove >= size + offset && spaceAbove >= spaceBelow) {
      mainCy = rect.top - offset - size / 2;
    } else if (spaceBelow >= size + offset) {
      mainCy = rect.bottom + offset + size / 2;
    } else if (spaceAbove >= size + offset) {
      mainCy = rect.top - offset - size / 2;
    } else {
      mainCy = window.innerHeight / 2;
    }
    const mainCx = portraitCx;
    const mainR = size / 2;
    const clampedCx = Math.max(mainR + 8, Math.min(mainCx, window.innerWidth - mainR - 8));
    const clampedCy = Math.max(mainR + 8, Math.min(mainCy, window.innerHeight - mainR - 8));

    const sliceAngle = (sliceIndex + 0.5) * (360 / segCount);
    const sliceRad = (sliceAngle - 90) * Math.PI / 180;
    const lineStartR = mainR - 4;
    const lineLength = 80;
    const lineEndR = lineStartR + lineLength;

    const startX = clampedCx + Math.cos(sliceRad) * lineStartR;
    const startY = clampedCy + Math.sin(sliceRad) * lineStartR;
    let defX = clampedCx + Math.cos(sliceRad) * lineEndR;
    let defY = clampedCy + Math.sin(sliceRad) * lineEndR;

    defX = Math.max(panelW / 2 + 8, Math.min(defX, window.innerWidth - panelW / 2 - 8));
    defY = Math.max(panelH / 2 + 8, Math.min(defY, window.innerHeight - panelH / 2 - 8));

    let panelLeft, panelTop;
    const posKey = panelClass.replace("cgm-", "").replace("-panel", "");
    const savedPos = this[`_${posKey}PanelPos`];
    if (savedPos) {
      const clamped = this._clampPanelPos(savedPos.left, savedPos.top, panelW, panelH);
      panelLeft = clamped.left;
      panelTop = clamped.top;
      this[`_${posKey}PanelPos`] = clamped;
    } else {
      panelLeft = defX - panelW / 2;
      panelTop = defY - panelH / 2;
    }
    const lineEndX = panelLeft + panelW / 2;
    const lineEndY = panelTop + panelH / 2;

    // Draw connecting line
    const lineContainer = document.createElement("div");
    lineContainer.className = "cgm-status-line-container";
    lineContainer.style.cssText = `position:fixed;left:0;top:0;width:100%;height:100%;z-index:201;pointer-events:none;`;
    const svgNS = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(svgNS, "svg");
    svg.setAttribute("class", "cgm-status-line-svg");
    svg.style.cssText = `position:absolute;left:0;top:0;width:100%;height:100%;overflow:visible;`;
    const line = document.createElementNS(svgNS, "line");
    line.setAttribute("x1", startX); line.setAttribute("y1", startY);
    line.setAttribute("x2", lineEndX); line.setAttribute("y2", lineEndY);
    line.setAttribute("class", "cgm-status-line");
    line.setAttribute("stroke", lineColor);
    svg.appendChild(line);
    const glowLine = document.createElementNS(svgNS, "line");
    glowLine.setAttribute("x1", startX); glowLine.setAttribute("y1", startY);
    glowLine.setAttribute("x2", lineEndX); glowLine.setAttribute("y2", lineEndY);
    glowLine.setAttribute("class", "cgm-status-line-glow");
    glowLine.setAttribute("stroke", lineColor.replace(/[\d.]+\)$/, "0.3)"));
    svg.appendChild(glowLine);
    lineContainer.appendChild(svg);
    document.body.appendChild(lineContainer);
    this._connectingLineEl = lineContainer;

    requestAnimationFrame(() => lineContainer.classList.add("cgm-status-line-visible"));

    // Build panel
    const panel = document.createElement("div");
    panel.className = `cgm-connected-panel ${panelClass}`;
    panel.style.cssText = `position:fixed;left:${panelLeft}px;top:${panelTop}px;width:${panelW}px;min-height:${panelH}px;z-index:202;`;

    panel.innerHTML = `
      <div class="cgm-connected-panel-header">
        <i class="fas ${iconClass}"></i>
        <span>${title}</span>
        <button class="cgm-connected-panel-close"><i class="fas fa-xmark"></i></button>
      </div>
      <div class="cgm-connected-panel-body"></div>
    `;

    document.body.appendChild(panel);
    panel.offsetHeight;
    requestAnimationFrame(() => requestAnimationFrame(() => panel.classList.add("cgm-connected-panel-visible")));

    return { panel, lineContainer };
  }


  /* ═══════════════════════════════════════════════════════════════
     SECTION 4: MINIMIZED WINDOW TRAY
     ═══════════════════════════════════════════════════════════════ */

  _buildTrayHTML() {
    return `<div class="cgm-tray-inner" id="cgm-tray-inner"><span class="cgm-tray-empty">—</span></div>`;
  }

  _startTray() {
    this.refreshTray();
    if (this._trayInterval) clearInterval(this._trayInterval);
    this._trayInterval = setInterval(() => this.refreshTray(), 2000);
  }

  refreshTray() {
    const tray = this.element?.querySelector("#cgm-tray-inner");
    if (!tray) return;
    this._trayApps.clear();

    const tracked = [];
    let idx = 0;

    // V1 apps
    for (const [id, app] of Object.entries(ui.windows ?? {})) {
      if (!app) continue;
      if (!this._isGameContentWindow(app)) continue;
      const tid = `t${idx++}`;
      this._trayApps.set(tid, app);
      tracked.push({ tid, title: app.title ?? app.options?.title ?? "Window", minimized: this._isWindowMinimized(app) });
    }

    // V2 apps
    if (foundry?.applications?.instances) {
      for (const [id, app] of foundry.applications.instances) {
        if (!app) continue;
        let already = false;
        for (const existing of this._trayApps.values()) { if (existing === app) { already = true; break; } }
        if (already) continue;
        if (!this._isGameContentWindow(app)) continue;
        const tid = `t${idx++}`;
        this._trayApps.set(tid, app);
        tracked.push({ tid, title: app.title ?? "Window", minimized: this._isWindowMinimized(app) });
      }
    }

    if (tracked.length === 0) {
      tray.innerHTML = `<span class="cgm-tray-empty">—</span>`;
      return;
    }

    tray.innerHTML = tracked.map(w => {
      const icon = w.minimized ? "fa-window-restore" : "fa-window-minimize";
      const tip  = w.minimized ? `Restore ${w.title}` : `Minimize ${w.title}`;
      const cls  = w.minimized ? " cgm-tray-window-minimized" : "";
      const label = w.title.substring(0, 16) + (w.title.length > 16 ? "…" : "");
      return `<div class="cgm-tray-window-btn${cls}" data-tid="${w.tid}" title="${tip}"><i class="fas ${icon}"></i><span class="cgm-tray-window-label">${label}</span><button class="cgm-tray-window-close" data-tid="${w.tid}" title="Close"><i class="fas fa-times"></i></button></div>`;
    }).join("");

    tray.querySelectorAll(".cgm-tray-window-btn").forEach(btn => {
      btn.addEventListener("click", (e) => {
        if (e.target.closest(".cgm-tray-window-close")) return;
        const app = this._trayApps?.get(btn.dataset.tid);
        if (!app) return;
        if (this._isWindowMinimized(app)) this._restoreAppElement(app);
        else this._minimizeWindow(app);
      });
    });

    tray.querySelectorAll(".cgm-tray-window-close").forEach(btn => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const app = this._trayApps?.get(btn.dataset.tid);
        if (app) app.close?.();
        setTimeout(() => this.refreshTray(), 50);
      });
    });
  }

  _isGameContentWindow(app) {
    if (!app) return false;
    if (app === this) return false;

    const el = app.element?.[0] ?? app.element;
    if (!el) return false;
    if (!(el instanceof Element)) return false;  // V2 apps may have non-Element elements

    // Must be a Foundry window
    const isWindow = el.classList?.contains("window-app") ||
                     el.classList?.contains("application") ||
                     el.matches?.(".app") ||
                     el.querySelector?.(".window-header, header");
    if (!isWindow) return false;

    // Exclude taskbars
    if (el.id === "cypher-taskbar-bar") return false;
    if (el.id === "cypher-gm-taskbar-bar") return false;
    if (el.closest("#cypher-taskbar-bar")) return false;
    if (el.closest("#cypher-gm-taskbar-bar")) return false;

    // Exclude sidebar / UI panels
    if (el.closest("#sidebar")) return false;
    if (el.closest("#scene-controls")) return false;
    if (el.closest("#hotbar")) return false;
    if (el.closest("#players")) return false;
    if (el.closest("#navigation")) return false;
    if (el.closest("#ui-left")) return false;
    if (el.closest("#ui-bottom")) return false;
    if (el.closest("#notifications")) return false;

    // Exclude obvious UI panels by constructor name
    const uiTypes = ["Sidebar", "Controls", "Hotbar", "PlayerList", "Notifications", "ChatLog", "CombatTracker", "FilePicker", "Tour", "SettingsConfig", "GMTaskbar"];
    const ctor = app.constructor?.name ?? "";
    if (uiTypes.some(t => ctor.includes(t))) return false;

    // Include sheets, journals, etc.
    const gameTypes = ["Sheet", "Journal", "Image", "Lightbox", "Popout", "Table", "Cards", "Macro", "Scene"];
    if (gameTypes.some(t => ctor.includes(t))) return true;

    // Default: include unknown (probably game content)
    return true;
  }

  _isWindowMinimized(app) {
    const el = app.element?.[0] ?? app.element;
    if (!el) return false;
    if (el.classList?.contains("cgm-minimized")) return true;
    if (el.style?.display === "none") return true;
    return app._cgmMinimized === true;
  }

  _minimizeWindow(app) {
    const el = app.element?.[0] ?? app.element;
    if (el) {
      app._cgmOriginalDisplay = el.style.display;
      el.style.display = "none";
      el.classList.add("cgm-minimized");
    }
    app._cgmMinimized = true;
    this.refreshTray();
  }

  _restoreAppElement(app) {
    const el = app.element?.[0] ?? app.element;
    if (el) {
      el.style.display = app._cgmOriginalDisplay ?? "";
      el.classList.remove("cgm-minimized");
    }
    app._cgmMinimized = false;
    if (typeof app.bringToTop === "function") app.bringToTop();
    this.refreshTray();
  }

}

/* ═══════════════════════════════════════════════════════════════
   SETTINGS REGISTRATION
   ═══════════════════════════════════════════════════════════════ */

function registerSettings() {
  // World-scoped per-user synced settings (replaces all client-scoped settings)
  game.settings.register(MODULE_ID, "userSettings", {
    name: "User Settings",
    hint: "Per-user taskbar settings synced across all browsers.",
    scope: "world",
    config: false,
    type: Object,
    default: {}
  });

  // Keep old client-scoped settings for backward compatibility (migration source)
  game.settings.register(MODULE_ID, "dock", { name: "Dock Position", hint: "Where the taskbar appears.", scope: "client", config: false, type: String, default: "bottom", choices: { bottom: "Bottom", top: "Top" } });
  game.settings.register(MODULE_ID, "opacity", { name: "Opacity", hint: "Taskbar opacity percentage.", scope: "client", config: false, type: Number, default: 100, range: { min: 50, max: 100, step: 5 } });
  game.settings.register(MODULE_ID, "compact", { name: "Compact Mode", hint: "Show compact buttons.", scope: "client", config: false, type: Boolean, default: false });
  game.settings.register(MODULE_ID, "notes", { name: "Quick Notes", hint: "GM quick notes storage.", scope: "client", config: false, type: String, default: "" });
  game.settings.register(MODULE_ID, "locked", { name: "Taskbar Locked", hint: "Lock taskbar visible.", scope: "client", config: false, type: Boolean, default: true });
  game.settings.register(MODULE_ID, "lockActorSheets", { name: "Lock Actor Sheets", hint: "Prevent players from opening their actor sheets.", scope: "world", config: false, type: Boolean, default: false });
  game.settings.register(MODULE_ID, "portraitPosition", { name: "Portrait Position", hint: "Horizontal position of player portraits (left, center, right).", scope: "client", config: false, type: String, default: "left", choices: { left: "Left", center: "Center", right: "Right" } });
  game.settings.register(MODULE_ID, "portraitObjectFit", { name: "Portrait Image Fit", hint: "How portrait images fill their container.", scope: "client", config: false, type: String, default: "cover", choices: { cover: "Cover", contain: "Contain", auto: "Auto", fill: "Fill", "scale-down": "Scale Down" } });
  game.settings.register(MODULE_ID, "portraitNameAbove", { name: "Name Above Bars", hint: "Place actor name above pool bars instead of next to portrait.", scope: "client", config: false, type: Boolean, default: false });
  game.settings.register(MODULE_ID, "portraitBarOffset", { name: "Bar Position", hint: "Horizontal offset of pool bars (0=left, 60=right).", scope: "client", config: false, type: Number, default: 0, range: { min: 0, max: 60, step: 2 } });
  game.settings.register(MODULE_ID, "portraitBarWidth", { name: "Bar Width", hint: "Width of pool bars in pixels.", scope: "client", config: false, type: Number, default: 48, range: { min: 20, max: 120, step: 4 } });
  game.settings.register(MODULE_ID, "portraitBorderColor", { name: "Border Color", hint: "Custom portrait border color (empty = auto/damage track).", scope: "client", config: false, type: String, default: "" });
  game.settings.register(MODULE_ID, "portraitBorderWidth", { name: "Border Width", hint: "Portrait border thickness in pixels.", scope: "client", config: false, type: Number, default: 3, range: { min: 1, max: 10, step: 1 } });
  game.settings.register(MODULE_ID, "portraitSize", { name: "Portrait Size", hint: "Portrait image size in pixels.", scope: "client", config: false, type: Number, default: 48, range: { min: 32, max: 160, step: 4 } });
  game.settings.register(MODULE_ID, "portraitShape", { name: "Portrait Shape", hint: "Shape of the portrait container.", scope: "client", config: false, type: String, default: "circle", choices: { circle: "Circle", rectangle: "Rectangle", rounded: "Rounded Square" } });
  game.settings.register(MODULE_ID, "portraitNameSize", { name: "Name Size", hint: "Actor name font size in pixels.", scope: "client", config: false, type: Number, default: 12, range: { min: 8, max: 24, step: 1 } });
  game.settings.register(MODULE_ID, "portraitNameColor", { name: "Name Color", hint: "Custom actor name color (empty = default).", scope: "client", config: false, type: String, default: "" });
  game.settings.register(MODULE_ID, "portraitNameOffset", { name: "Name Offset", hint: "Horizontal offset of actor name.", scope: "client", config: false, type: Number, default: 0, range: { min: 0, max: 40, step: 2 } });
  game.settings.register(MODULE_ID, "xpCircleSize", { name: "XP Circle Size", hint: "Size of XP circle in pixels.", scope: "client", config: false, type: Number, default: 16, range: { min: 12, max: 40, step: 2 } });
  game.settings.register(MODULE_ID, "xpCircleOffsetX", { name: "XP Circle Offset X", hint: "Horizontal offset of XP circle (negative = left).", scope: "client", config: false, type: Number, default: 0, range: { min: -50, max: 50, step: 2 } });
  game.settings.register(MODULE_ID, "xpCircleOffsetY", { name: "XP Circle Offset Y", hint: "Vertical offset of XP circle (negative = up).", scope: "client", config: false, type: Number, default: 4, range: { min: -50, max: 50, step: 2 } });
  game.settings.register(MODULE_ID, "globalDifficulty", { name: "Global Difficulty", hint: "Default difficulty for all player rolls.", scope: "world", config: false, type: Number, default: 4, range: { min: 0, max: 15, step: 1 } });
  game.settings.register(MODULE_ID, "radialMenuSize", { name: "Radial Menu Size", hint: "Size of the radial menu in pixels.", scope: "client", config: false, type: Number, default: 200, range: { min: 100, max: 300, step: 10 } });
  game.settings.register(MODULE_ID, "radialMenuOffset", { name: "Radial Menu Offset", hint: "Distance from portrait to menu in pixels.", scope: "client", config: false, type: Number, default: 20, range: { min: 10, max: 100, step: 5 } });
  game.settings.register(MODULE_ID, "disableGMTaskbar", { name: "Never Load GM Taskbar", hint: "If enabled, the GM Taskbar will not appear for this user. Requires reload.", scope: "client", config: true, type: Boolean, default: false });
  // SECTION 1 settings
  game.settings.register(MODULE_ID, "sectionWidth", { name: "Section Width", hint: "Width of SECTION 1 as a percentage.", scope: "client", config: false, type: Number, default: 10 });
  game.settings.register(MODULE_ID, "sectionBgColor", { name: "Section Background Color", hint: "Background color of SECTION 1.", scope: "client", config: false, type: String, default: "#ffffff" });
  game.settings.register(MODULE_ID, "sectionBgOpacity", { name: "Section Background Opacity", hint: "Background opacity of SECTION 1 (0-100).", scope: "client", config: false, type: Number, default: 30 });
  game.settings.register(MODULE_ID, "sectionPosition", { name: "Section Position", hint: "Horizontal offset of SECTION 1 in pixels (0-200).", scope: "client", config: false, type: Number, default: 0 });
  // SECTION 2 settings
  game.settings.register(MODULE_ID, "section2Width", { name: "Section 2 Width", hint: "Width of SECTION 2 as a percentage.", scope: "client", config: false, type: Number, default: 10 });
  game.settings.register(MODULE_ID, "section2BgColor", { name: "Section 2 Background Color", hint: "Background color of SECTION 2.", scope: "client", config: false, type: String, default: "#ffffff" });
  game.settings.register(MODULE_ID, "section2BgOpacity", { name: "Section 2 Background Opacity", hint: "Background opacity of SECTION 2 (0-100).", scope: "client", config: false, type: Number, default: 30 });
  game.settings.register(MODULE_ID, "section2Position", { name: "Section 2 Position", hint: "Horizontal offset of SECTION 2 in pixels (0-200).", scope: "client", config: false, type: Number, default: 0 });
  // SECTION 3 settings
  game.settings.register(MODULE_ID, "section3Width", { name: "Section 3 Width", hint: "Width of SECTION 3 as a percentage.", scope: "client", config: false, type: Number, default: 10 });
  game.settings.register(MODULE_ID, "section3BgColor", { name: "Section 3 Background Color", hint: "Background color of SECTION 3.", scope: "client", config: false, type: String, default: "#ffffff" });
  game.settings.register(MODULE_ID, "section3BgOpacity", { name: "Section 3 Background Opacity", hint: "Background opacity of SECTION 3 (0-100).", scope: "client", config: false, type: Number, default: 30 });
  game.settings.register(MODULE_ID, "section3Position", { name: "Section 3 Position", hint: "Horizontal offset of SECTION 3 in pixels (0-200).", scope: "client", config: false, type: Number, default: 0 });
  // SECTION 4 (Tray) settings
  game.settings.register(MODULE_ID, "section4Width", { name: "Section 4 Width", hint: "Width of SECTION 4 (Tray) as a percentage.", scope: "client", config: false, type: Number, default: 15 });
  game.settings.register(MODULE_ID, "section4BgColor", { name: "Section 4 Background Color", hint: "Background color of SECTION 4 (Tray).", scope: "client", config: false, type: String, default: "#1a1020" });
  game.settings.register(MODULE_ID, "section4BgOpacity", { name: "Section 4 Background Opacity", hint: "Background opacity of SECTION 4 (Tray) (0-100).", scope: "client", config: false, type: Number, default: 50 });
  game.settings.register(MODULE_ID, "section4Position", { name: "Section 4 Position", hint: "Horizontal offset of SECTION 4 (Tray) in pixels (0-200).", scope: "client", config: false, type: Number, default: 0 });
  // Section unlock & button layout
  game.settings.register(MODULE_ID, "sectionsUnlocked", { name: "Unlock Sections", hint: "Allow dragging icons between sections and customizing them.", scope: "client", config: false, type: Boolean, default: false });
  game.settings.register(MODULE_ID, "buttonLayout", { name: "Button Layout", hint: "Stores button section assignments, sizes, and colors (JSON).", scope: "client", config: false, type: Object, default: {} });
  game.settings.register(MODULE_ID, "portraitVisibilityMode", { name: "Portrait Visibility Mode", hint: "Filter which player actor portraits are shown above the taskbar.", scope: "client", config: false, type: String, default: "all", choices: { all: "All", active: "Active Only", hide: "Hide All" } });
  // Disconnection sound settings
  game.settings.register(MODULE_ID, "disconnectionSound", { name: "Disconnection Sound", hint: "Sound file to play when a player disconnects. Leave empty for no sound.", scope: "world", config: true, type: String, default: "" });
  game.settings.register(MODULE_ID, "disconnectionSoundLoop", { name: "Loop Sound", hint: "Loop the disconnection sound until stopped.", scope: "world", config: true, type: Boolean, default: false });
  game.settings.register(MODULE_ID, "disconnectionSoundDuration", { name: "Sound Duration", hint: "How long to play the sound in seconds (if not looping).", scope: "world", config: true, type: Number, default: 5, range: { min: 1, max: 30, step: 1 } });
  game.settings.register(MODULE_ID, "disconnectionSoundVolume", { name: "Sound Volume", hint: "Volume of the disconnection sound (0-100).", scope: "world", config: true, type: Number, default: 50, range: { min: 0, max: 100, step: 5 } });
  game.settings.register(MODULE_ID, "disconnectionSoundTarget", { name: "Sound Target", hint: "Who should hear the disconnection sound.", scope: "world", config: true, type: String, default: "gm", choices: { gm: "GM Only", all: "All Players", disconnected: "Disconnected Player Only" } });
  game.settings.register(MODULE_ID, "npcCanvasData", { name: "NPC Canvas Data", hint: "Stores NPC canvas tabs and tokens.", scope: "world", config: false, type: String, default: "{}" });
  game.settings.register(MODULE_ID, "enemyCanvasData", { name: "Enemy Canvas Data", hint: "Stores Enemy canvas tabs and tokens.", scope: "world", config: false, type: String, default: "{}" });
  game.settings.register(MODULE_ID, "itemsCanvasData", { name: "Items Canvas Data", hint: "Stores Items canvas tabs and tokens.", scope: "world", config: false, type: String, default: "{}" });
  game.settings.register(MODULE_ID, "menuPositions", { name: "Menu Positions", hint: "Saved positions for draggable radial menus (JSON).", scope: "client", config: false, type: String, default: "{}" });
  game.settings.register(MODULE_ID, "gmMenuDocs", { name: "GM Menu Documents", hint: "Journal UUIDs stored in GM menu sections (JSON).", scope: "world", config: false, type: String, default: "{\"shared\":[],\"gm\":[],\"notes\":[]}" });
}

/* ═══════════════════════════════════════════════════════════════
   HOOKS
   ═══════════════════════════════════════════════════════════════ */

Hooks.once("init", () => {
  console.log(`${MODULE_ID} | Module loaded`);
  registerSettings();
});

// When Cypher XP is ready, cache API and show the button
Hooks.on("cypher-xp.ready", (api) => {
  console.log(`${MODULE_ID} | cypher-xp.ready hook fired`);
  if (window.cypherGMTaskbar) {
    window.cypherGMTaskbar._xpApi = api;
    // Show the XP button by removing hidden class
    const xpBtn = window.cypherGMTaskbar.element?.querySelector("#cgm-btn-xp");
    if (xpBtn) {
      xpBtn.classList.remove("cgm-xp-hidden");
      console.log(`${MODULE_ID} | XP button shown`);
    }
    // Hide floating launcher
    window.cypherGMTaskbar._hideCypherXpLauncher();
  }
});

Hooks.once("ready", () => {
  if (!game.user?.isGM) { console.log(`${MODULE_ID} | User is not GM — taskbar skipped`); return; }
  const disabled = (() => { try { return game.settings.get(MODULE_ID, "disableGMTaskbar"); } catch { return false; } })();
  if (disabled) { console.log(`${MODULE_ID} | GM Taskbar disabled in settings`); return; }

  // Watch for Cypher XP launcher being added to DOM and hide it
  const xpObserver = new MutationObserver((mutations) => {
    for (const m of mutations) {
      for (const node of m.addedNodes) {
        if (node.nodeType !== 1) continue;
        if (node.id === "cypher-xp-player-launcher" || node.id === "cypher-development-track-player-launcher") {
          node.style.display = "none";
          node.style.visibility = "hidden";
          node.style.opacity = "0";
          node.style.pointerEvents = "none";
        }
      }
    }
  });
  xpObserver.observe(document.body, { childList: true, subtree: true });

  // Periodic check to hide launcher (fallback in case observer misses it)
  setInterval(() => {
    const ids = ["cypher-xp-player-launcher", "cypher-development-track-player-launcher"];
    for (const id of ids) {
      const el = document.getElementById(id);
      if (el && el.style.display !== "none") {
        el.style.display = "none";
        el.style.visibility = "hidden";
        el.style.opacity = "0";
        el.style.pointerEvents = "none";
      }
    }
  }, 2000);

  setTimeout(async () => {
    window.cypherGMTaskbar = new GMTaskbar();
    await window.cypherGMTaskbar._migrateSettings();
    window.cypherGMTaskbar.render();
    console.log(`${MODULE_ID} | GM taskbar rendered`);
  }, 500);

  // Listen for Cypher XP player spend requests
  game.socket.on("module.cypher-taskbar", (payload) => {
    console.log(`[CGM] Socket received:`, payload);
    if (payload?.type === "gmXpSpendRequest" && game.user?.isGM) {
      console.log(`[CGM] Handling gmXpSpendRequest for actor:`, payload.actorName);
      window.cypherGMTaskbar?._openGMXpSpendRequest?.(payload);
    } else {
      console.log(`[CGM] Ignoring socket message. type=${payload?.type}, isGM=${game.user?.isGM}`);
    }
  });
});

/* File picker button for disconnection sound setting */
Hooks.on("renderSettingsConfig", (app, html, data) => {
  // Support both jQuery (html[0]) and DOM element
  const root = html instanceof HTMLElement ? html : html[0];
  if (!root) return;

  // Find the sound input — V13 may use different nesting
  const soundInput = root.querySelector(`input[name="${MODULE_ID}.disconnectionSound"]`) ||
                     root.querySelector(`input[name^="${MODULE_ID}"][name*="disconnectionSound"]`) ||
                     root.querySelector(`[data-setting-id="${MODULE_ID}.disconnectionSound"] input`);
  if (!soundInput) {
    console.log(`[CypherGMTaskbar] renderSettingsConfig: disconnectionSound input not found`);
    return;
  }

  // Don't add button twice
  if (soundInput.parentElement?.querySelector(".cgm-sound-picker-btn")) return;

  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "cgm-sound-picker-btn";
  btn.title = "Browse for audio file";
  btn.innerHTML = '<i class="fas fa-music"></i>';
  btn.style.cssText = "margin-left:6px;flex-shrink:0;width:28px;height:28px;";

  // Wrap input in flex container if needed
  let container = soundInput.parentElement;
  if (container && !container.classList.contains("flexrow")) {
    const flexWrap = document.createElement("div");
    flexWrap.className = "flexrow";
    flexWrap.style.cssText = "align-items:center;";
    container.insertBefore(flexWrap, soundInput);
    flexWrap.appendChild(soundInput);
    container = flexWrap;
  }
  container?.appendChild(btn);

  btn.addEventListener("click", () => {
    try {
      // Foundry V13+ compatibility: use foundry.applications.apps.FilePicker if available
      const PickerClass = foundry?.applications?.apps?.FilePicker || FilePicker;
      const fp = new PickerClass({
        type: "audio",
        current: soundInput.value,
        callback: path => {
          soundInput.value = path;
          soundInput.dispatchEvent(new Event("change", { bubbles: true }));
          soundInput.dispatchEvent(new Event("input", { bubbles: true }));
        }
      });
      fp.render(true);
    } catch (err) {
      console.error("[CypherGMTaskbar] FilePicker failed:", err);
      ui.notifications.error("Could not open file picker. See console.");
    }
  });
});

/* GM-side socket test helper */
window._testGMCallRollSocket = function(userId, actorId, poolName = "Might") {
  console.log(`[CypherGMTaskbar] TEST EMIT to user ${userId}...`);
  console.log("[CypherGMTaskbar] game.socket exists?", !!game.socket);
  console.log("[CypherGMTaskbar] game.socket.emit exists?", typeof game.socket?.emit);
  
  const payload = {
    action: "callForRollPool",
    userId: userId,
    actorId: actorId,
    actorUuid: game.actors.get(actorId)?.uuid,
    poolName: poolName,
    difficulty: 3,
    _testTimestamp: Date.now()
  };
  console.log("[CypherGMTaskbar] Payload:", payload);
  
  try {
    game.socket.emit("module.cypher-gm-taskbar", payload);
    console.log("[CypherGMTaskbar] TEST EMIT succeeded — payload sent");
    ui.notifications.info(`Test roll request sent to player. Check their console (F12).`);
  } catch (err) {
    console.error("[CypherGMTaskbar] TEST EMIT FAILED:", err);
    ui.notifications.error(`Socket emit failed: ${err.message}`);
  }
};

/* Raw socket ping test — use this if above doesn't work */
window._testRawSocket = function(targetUserId) {
  console.log("[CypherGMTaskbar] Raw socket ping test...");
  const testId = Math.random().toString(36).slice(2);
  
  // Set up a one-time listener for the response
  const handler = (data) => {
    if (data?._pingTest === testId) {
      console.log("[CypherGMTaskbar] PONG received! Round-trip works:", data);
      game.socket.off("module.cypher-gm-taskbar", handler);
      ui.notifications.info("Socket round-trip test PASSED!");
    }
  };
  game.socket.on("module.cypher-gm-taskbar", handler);
  
  // Send ping
  game.socket.emit("module.cypher-gm-taskbar", {
    _pingTest: testId,
    userId: targetUserId,
    fromGM: true,
    timestamp: Date.now()
  });
  console.log("[CypherGMTaskbar] PING sent, id:", testId);
  
  // Auto-cleanup after 10s
  setTimeout(() => {
    game.socket.off("module.cypher-gm-taskbar", handler);
    console.log("[CypherGMTaskbar] Ping test timed out (no response)");
  }, 10000);
};

/* Socket listener for players to receive GM roll requests */
Hooks.on("ready", () => {
  if (game.user?.isGM) return;

  /* Helper: try Cypher Taskbar with retry + error handling */
  async function _tryCypherTaskbarAttr(actor, poolName, difficulty, maxAttempts = 8) {
    for (let i = 0; i < maxAttempts; i++) {
      const ctb = window.CypherTaskbar?.instance;
      if (ctb && typeof ctb._openNativeAttributeRollDialog === "function") {
        try {
          await ctb._openNativeAttributeRollDialog(actor, poolName, { presetDifficulty: difficulty });
          return { ok: true };
        } catch (err) {
          console.warn("[CypherGMTaskbar] _openNativeAttributeRollDialog threw:", err);
          return { ok: false, error: err.message };
        }
      }
      if (i < maxAttempts - 1) await new Promise(r => setTimeout(r, 400));
    }
    return { ok: false, error: "Cypher Taskbar not available after retries" };
  }
  async function _tryCypherTaskbarSkill(actor, skill, difficulty, maxAttempts = 8) {
    for (let i = 0; i < maxAttempts; i++) {
      const ctb = window.CypherTaskbar?.instance;
      if (ctb && typeof ctb._openNativeSkillRollDialog === "function") {
        try {
          await ctb._openNativeSkillRollDialog(actor, skill, difficulty);
          return { ok: true };
        } catch (err) {
          console.warn("[CypherGMTaskbar] _openNativeSkillRollDialog threw:", err);
          return { ok: false, error: err.message };
        }
      }
      if (i < maxAttempts - 1) await new Promise(r => setTimeout(r, 400));
    }
    return { ok: false, error: "Cypher Taskbar not available after retries" };
  }

  /* Global debug helper */
  window._testCypherTaskbarRoll = async function(actorId, poolName = "Might", difficulty = 3) {
    const actor = game.actors.get(actorId);
    if (!actor) { console.error("Actor not found:", actorId); return; }
    console.log("[CypherGMTaskbar] Testing direct call...");
    const ctb = window.CypherTaskbar?.instance;
    console.log("window.CypherTaskbar?", !!window.CypherTaskbar);
    console.log("window.CypherTaskbar.instance?", !!ctb);
    console.log("_openNativeAttributeRollDialog?", typeof ctb?._openNativeAttributeRollDialog);
    const result = await _tryCypherTaskbarAttr(actor, poolName, difficulty, 3);
    console.log("Result:", result);
  };

  game.socket.on("module.cypher-gm-taskbar", async (data) => {
    // Respond to ping tests immediately (before userId check)
    if (data?._pingTest) {
      console.log("[CypherGMTaskbar] PING received! Sending PONG...", data);
      game.socket.emit("module.cypher-gm-taskbar", {
        _pingTest: data._pingTest,
        _pong: true,
        userId: game.users.find(u => u.isGM && u.active)?.id, // send back to GM
        fromPlayer: game.user?.id,
        timestamp: Date.now()
      });
      return;
    }

    console.log("[CypherGMTaskbar] SOCKET EVENT (raw):", data, "| my userId:", game.user?.id);
    if (data.userId !== game.user?.id) {
      console.log("[CypherGMTaskbar] SKIPPED — wrong userId. Expected:", data.userId, "Got:", game.user?.id);
      return;
    }

    console.log("[CypherGMTaskbar] CALL ROLL received:", data);

    const actor = data.actorUuid ? fromUuidSync(data.actorUuid) : game.actors.get(data.actorId);
    if (!actor) {
      console.warn("[CypherGMTaskbar] CALL ROLL: Actor not found", data);
      ui.notifications.warn("Roll request received but actor not found.");
      return;
    }
    console.log("[CypherGMTaskbar] Actor resolved:", actor.name, actor.uuid);

    /* ─── Pool Roll ─── */
    if (data.action === "callForRollPool") {
      console.log(`[CypherGMTaskbar] Processing callForRollPool for ${actor.name}, pool: ${data.poolName}`);
      ui.notifications.info(`GM calls for a ${data.poolName} roll!`);

      // Try Cypher Taskbar native dialog with retry
      const result = await _tryCypherTaskbarAttr(actor, data.poolName, data.difficulty);
      if (result.ok) {
        console.log("[CypherGMTaskbar] Cypher Taskbar attribute roll dialog opened");
        return;
      }
      console.warn("[CypherGMTaskbar] Direct call failed:", result.error);

      // Fallback: emit socket event to Cypher Taskbar module
      try {
        game.socket.emit("module.cypher-taskbar", {
          type: "openAttributeRollDialog",
          actorId: actor.id,
          poolName: data.poolName,
          difficulty: data.difficulty
        });
        console.log("[CypherGMTaskbar] Emitted openAttributeRollDialog to Cypher Taskbar socket");
        return;
      } catch (err) {
        console.warn("[CypherGMTaskbar] Socket emit failed:", err);
      }

      // Last resort: actor.roll()
      if (typeof actor.roll === "function") {
        try {
          console.log("[CypherGMTaskbar] Calling actor.roll...");
          await actor.roll(data.poolName.toLowerCase(), { difficulty: data.difficulty });
          console.log("[CypherGMTaskbar] actor.roll succeeded");
          return;
        } catch (err) {
          console.warn("[CypherGMTaskbar] actor.roll failed:", err);
        }
      }

      console.error("[CypherGMTaskbar] All pool roll methods failed.");
      ui.notifications.error(`Could not open roll dialog for ${data.poolName}. Check browser console (F12) for details.`);
    }

    /* ─── Skill Roll ─── */
    else if (data.action === "callForRollSkill") {
      const skill = data.skillUuid ? fromUuidSync(data.skillUuid) : actor.items.get(data.skillId);
      if (!skill) {
        ui.notifications.warn(`Skill not found on ${actor.name}.`);
        console.warn("[CypherGMTaskbar] Skill not found:", data);
        return;
      }
      ui.notifications.info(`GM calls for a ${skill.name} roll!`);

      // Try Cypher Taskbar native dialog with retry
      const result = await _tryCypherTaskbarSkill(actor, skill, data.difficulty);
      if (result.ok) {
        console.log("[CypherGMTaskbar] Cypher Taskbar skill roll dialog opened");
        return;
      }
      console.warn("[CypherGMTaskbar] Direct call failed:", result.error);

      // Fallback: emit socket event to Cypher Taskbar module
      try {
        game.socket.emit("module.cypher-taskbar", {
          type: "openSkillRollDialog",
          actorId: actor.id,
          skillId: skill.id,
          difficulty: data.difficulty
        });
        console.log("[CypherGMTaskbar] Emitted openSkillRollDialog to Cypher Taskbar socket");
        return;
      } catch (err) {
        console.warn("[CypherGMTaskbar] Socket emit failed:", err);
      }

      console.error("[CypherGMTaskbar] All skill roll methods failed.");
      ui.notifications.error(`Could not open roll dialog for ${skill.name}. Check browser console (F12) for details.`);
    }

    /* ─── Intrusion ─── */
    else if (data.action === "requestIntrusion") {
      console.log(`[CypherGMTaskbar] Intrusion request for ${actor.name}`);
      ui.notifications.warn(`GM Intrusion on ${actor.name}!`, { permanent: true });

      const img = actor?.img || "icons/svg/mystery-man.svg";
      const name = actor?.name || "Character";

      // Helper: get XP path (same as GM taskbar)
      function _getXPPath(a) {
        const sys = a.system ?? {};
        if (sys.basic && "xp" in sys.basic) return "system.basic.xp";
        if (sys.advancement && "xp" in sys.advancement) return "system.advancement.xp";
        return null;
      }
      async function _modifyXP(a, delta) {
        const xpPath = _getXPPath(a);
        if (!xpPath) return false;
        const current = Number(foundry.utils.getProperty(a, xpPath) ?? 0);
        const newVal = Math.max(0, Math.min(10, current + delta));
        if (newVal === current) {
          ui.notifications.warn(`${a.name} XP cannot change (currently ${current}).`);
          return false;
        }
        try {
          await a.update({ [xpPath]: newVal });
          const verb = delta > 0 ? "gained" : "lost";
          ui.notifications.info(`${a.name} ${verb} ${Math.abs(delta)} XP (now ${newVal}).`);
          return true;
        } catch (err) {
          console.warn("[CypherGMTaskbar] XP update failed:", err);
          ui.notifications.error(`Could not update XP. GM will handle it.`);
          return false;
        }
      }
      async function _sendIntrusionChat(a, accepted, gaveXPTo = null) {
        const actorImg = a?.img || "icons/svg/mystery-man.svg";
        const actorName = a?.name || "Unknown";
        const acceptedColor = accepted ? "#40b060" : "#ff7070";
        const acceptedIcon = accepted ? "fa-check-circle" : "fa-times-circle";
        const acceptedText = accepted ? "ACCEPTED" : "REFUSED";
        const xpResult = accepted
          ? `<div style="margin-top:6px; color:#c8a96e; font-size:12px;"><i class="fas fa-plus-circle" style="margin-right:4px;"></i> +1 XP (accepted intrusion)</div>`
          : `<div style="margin-top:6px; color:#ff7070; font-size:12px;"><i class="fas fa-minus-circle" style="margin-right:4px;"></i> -1 XP (refused intrusion)</div>`;
        const giveXPResult = gaveXPTo
          ? `<div style="margin-top:4px; color:#40b060; font-size:12px;"><i class="fas fa-gift" style="margin-right:4px;"></i> +1 XP given to <strong>${gaveXPTo.name}</strong></div>`
          : "";
        await ChatMessage.create({
          speaker: { actor: a.id, alias: actorName },
          content: `
            <div style="display:flex; align-items:flex-start; gap:10px; padding:4px 0;">
              <img src="${actorImg}" style="width:36px; height:36px; border-radius:50%; border:2px solid ${acceptedColor}; object-fit:cover; flex-shrink:0; box-shadow:0 0 8px ${acceptedColor}40;">
              <div style="flex:1;">
                <div style="font-weight:700; font-size:14px; color:#e0e0e0; margin-bottom:2px;">${actorName} <span style="color:${acceptedColor}; font-size:12px; margin-left:6px;"><i class="fas ${acceptedIcon}" style="margin-right:3px;"></i>${acceptedText}</span></div>
                <div style="font-size:12px; color:#aaa;">GM Intrusion</div>
                ${xpResult}${giveXPResult}
              </div>
            </div>`
        });
      }

      // Show intrusion dialog on player side
      new Dialog({
        title: ``,
        content: `
          <div class="cgm-intrusion-dialog">
            <div class="cgm-intrusion-portrait-bg" style="background-image:url('${img}');"></div>
            <div class="cgm-intrusion-header"><i class="fas fa-bolt" style="margin-right:6px;"></i>GM Intrusion</div>
            <div class="cgm-intrusion-flavor">Let's make this interesting.</div>
            <div class="cgm-intrusion-question">Do you accept GM's <strong>INTRUSION</strong>?</div>
            <div class="cgm-intrusion-target"><i class="fas fa-crosshairs"></i> Target: <strong>${name}</strong></div>
          </div>`,
        classes: ["cgm-dark-dialog", "cgm-intrusion-window"],
        buttons: {
          no: {
            icon: '<i class="fas fa-times" style="color:#ff7070;"></i>',
            label: "NO",
            callback: async () => {
              await _modifyXP(actor, -1);
              _sendIntrusionChat(actor, false);
            }
          },
          yes: {
            icon: '<i class="fas fa-check" style="color:#40b060;"></i>',
            label: "YES",
            callback: async () => {
              const ok = await _modifyXP(actor, 1);
              if (!ok) return; // Don't proceed if XP update failed

              // Show "give XP to another" dialog
              const pcs = game.actors.filter(other => other.type === "pc" && other.id !== actor.id && other.hasPlayerOwner);
              const options = pcs.map(pc => `<option value="${pc.id}">${pc.name}</option>`).join("");

              if (!pcs.length) {
                _sendIntrusionChat(actor, true);
                ui.notifications.info("No other PCs to give XP to.");
                return;
              }

              new Dialog({
                title: ``,
                content: `
                  <div class="cgm-give-xp-dialog">
                    <div class="cgm-give-xp-source"><img src="${img}" alt="${name}"><div class="cgm-give-xp-source-name">${name}</div><div class="cgm-give-xp-source-label">shares the wealth</div></div>
                    <div class="cgm-give-xp-flavor">So who is the lucky one<br>you will give XP to?</div>
                    <div class="cgm-give-xp-select-wrap">
                      <select id="cgm-give-xp-target" class="cgm-give-xp-select"><option value="" disabled selected>Select a character...</option>${options}</select>
                    </div>
                  </div>`,
                classes: ["cgm-dark-dialog"],
                buttons: {
                  confirm: {
                    icon: '<i class="fas fa-gift"></i>',
                    label: "CONFIRM",
                    callback: async (html) => {
                      const el = html?.[0] ?? html;
                      const select = el.querySelector ? el.querySelector("#cgm-give-xp-target") : html.find("#cgm-give-xp-target")[0];
                      const targetId = select?.value;
                      if (!targetId) { ui.notifications.warn("Please select a character."); return; }
                      const targetActor = game.actors.get(targetId);
                      if (targetActor) {
                        await _modifyXP(targetActor, 1);
                        _sendIntrusionChat(actor, true, targetActor);
                      }
                    }
                  }
                },
                default: "confirm"
              }).render(true);
            }
          }
        },
        default: "yes"
      }).render(true);
    }

    /* ─── Play Sound (player-side) ─── */
    else if (data.action === "playSound") {
      console.log("[CypherGMTaskbar] PLAY SOUND received:", data);
      if (!game.audio) {
        console.warn("[CypherGMTaskbar] game.audio not available");
        return;
      }
      try {
        const src = game.audio.create({
          src: data.soundPath,
          volume: data.volume ?? 0.5,
          loop: data.loop ?? false
        });
        if (src) {
          src.play();
          console.log(`[CypherGMTaskbar] Playing sound: ${data.soundPath}`);
          if (!data.loop && (data.duration ?? 0) > 0) {
            setTimeout(() => { try { src.stop(); } catch {} }, (data.duration) * 1000);
          }
        }
      } catch (err) {
        console.warn("[CypherGMTaskbar] Failed to play sound:", err);
      }
    }
  });
});
/* Refresh portraits when actor data changes (pools, XP, damage track, etc.) */
Hooks.on("updateActor", (actor, data, options, userId) => {
  if (!game.user?.isGM) return;
  if (actor.type !== "pc" || !actor.hasPlayerOwner) return;
  if (!window.cypherGMTaskbar) return;
  // Invalidate party data cache so next read gets fresh data
  if (window.cypherGMTaskbar._partyDataCache) {
    window.cypherGMTaskbar._partyDataCache = null;
  }
  // Debounce: wait for all updates to settle
  clearTimeout(window._cgmRefreshTimer);
  window._cgmRefreshTimer = setTimeout(() => {
    window.cypherGMTaskbar._refreshPortraits();
  }, 250);
});

/* Refresh portraits when items change on actors (cyphers, artifacts) */
Hooks.on("createItem", (item, options, userId) => {
  if (!game.user?.isGM) return;
  const actor = item.parent;
  if (!actor || actor.type !== "pc" || !actor.hasPlayerOwner) return;
  if (!window.cypherGMTaskbar) return;
  if (window.cypherGMTaskbar._partyDataCache) {
    window.cypherGMTaskbar._partyDataCache = null;
  }
  clearTimeout(window._cgmRefreshTimer);
  window._cgmRefreshTimer = setTimeout(() => {
    window.cypherGMTaskbar._refreshPortraits();
  }, 250);
});

Hooks.on("deleteItem", (item, options, userId) => {
  if (!game.user?.isGM) return;
  const actor = item.parent;
  if (!actor || actor.type !== "pc" || !actor.hasPlayerOwner) return;
  if (!window.cypherGMTaskbar) return;
  if (window.cypherGMTaskbar._partyDataCache) {
    window.cypherGMTaskbar._partyDataCache = null;
  }
  clearTimeout(window._cgmRefreshTimer);
  window._cgmRefreshTimer = setTimeout(() => {
    window.cypherGMTaskbar._refreshPortraits();
  }, 250);
});

/* Refresh portraits when active effects are created/deleted/updated */
Hooks.on("createActiveEffect", (effect, options, userId) => {
  if (!game.user?.isGM) return;
  const actor = effect.parent;
  if (!actor || actor.type !== "pc" || !actor.hasPlayerOwner) return;
  if (!window.cypherGMTaskbar) return;
  if (window.cypherGMTaskbar._partyDataCache) {
    window.cypherGMTaskbar._partyDataCache = null;
  }
  clearTimeout(window._cgmRefreshTimer);
  window._cgmRefreshTimer = setTimeout(() => {
    window.cypherGMTaskbar._refreshPortraits();
  }, 250);
});

Hooks.on("deleteActiveEffect", (effect, options, userId) => {
  if (!game.user?.isGM) return;
  const actor = effect.parent;
  if (!actor || actor.type !== "pc" || !actor.hasPlayerOwner) return;
  if (!window.cypherGMTaskbar) return;
  if (window.cypherGMTaskbar._partyDataCache) {
    window.cypherGMTaskbar._partyDataCache = null;
  }
  clearTimeout(window._cgmRefreshTimer);
  window._cgmRefreshTimer = setTimeout(() => {
    window.cypherGMTaskbar._refreshPortraits();
  }, 250);
});

Hooks.on("updateActiveEffect", (effect, data, options, userId) => {
  if (!game.user?.isGM) return;
  const actor = effect.parent;
  if (!actor || actor.type !== "pc" || !actor.hasPlayerOwner) return;
  if (!window.cypherGMTaskbar) return;
  if (window.cypherGMTaskbar._partyDataCache) {
    window.cypherGMTaskbar._partyDataCache = null;
  }
  clearTimeout(window._cgmRefreshTimer);
  window._cgmRefreshTimer = setTimeout(() => {
    window.cypherGMTaskbar._refreshPortraits();
  }, 250);
});

/* ── Apply GM Taskbar difficulty to Cypher System roll dialogs ── */
Hooks.on("renderRollEngineDialogSheet", (app, html, data) => {
  if (!window.cypherGMTaskbar) return;

  const actor = fromUuidSync(app.object.actorUuid);
  if (!actor) return;

  // Determine target difficulty: individual vs global — use the HIGHER of the two
  const individual = actor.getFlag("cypher-gm-taskbar", "targetDifficulty");
  const global = window.cypherGMTaskbar._globalDifficulty;
  let difficulty;
  if (Number.isFinite(individual) && Number.isFinite(global)) {
    difficulty = Math.max(individual, global);
  } else if (Number.isFinite(individual)) {
    difficulty = individual;
  } else {
    difficulty = global;
  }

  // Validate
  difficulty = parseInt(difficulty, 10);
  if (isNaN(difficulty) || difficulty < 0 || difficulty > 15) return;

  // Prevent infinite loops — only apply once per actor+difficulty combo
  if (app._cgmAppliedActor === actor.id && app._cgmAppliedDifficulty === difficulty) return;

  // Also respect user's manual changes: if the select already has a value
  // that differs from what we last applied, the user changed it.
  const dom = html[0] || html;
  const select = dom.querySelector?.('select[name="baseDifficulty"]') || dom.querySelector?.('select.base-difficulty');
  if (select) {
    const currentVal = parseInt(select.value, 10);
    if (app._cgmAppliedActor === actor.id &&
        app._cgmAppliedDifficulty !== undefined &&
        !isNaN(currentVal) &&
        currentVal !== app._cgmAppliedDifficulty) {
      // User manually changed the difficulty — respect it
      app._cgmUserChanged = true;
    }
  }
  if (app._cgmUserChanged) return;

  app._cgmAppliedActor = actor.id;
  app._cgmAppliedDifficulty = difficulty;

  // Apply to the backing data object
  app.object.baseDifficulty = difficulty;

  // Apply directly to the DOM select element — this is what the user sees
  if (select) {
    const strVal = String(difficulty);
    if (select.value !== strVal) {
      select.value = strVal;
      // Trigger change so Foundry updates internal state & summaries
      select.dispatchEvent(new Event("change", { bubbles: true }));
    }
  }
});

/* ═══════════════════════════════════════════════════════
   QUICK SCENE GENERATOR — Integrated Module
   ═══════════════════════════════════════════════════════ */

class QuickSceneGenerator {
  constructor() {
    this._visible = false;
    this._panelEl = null;
    this._sceneType = "random";
    this._scenePlace = "random";
    this._sceneTone = "random";
    this._sceneTime = "random";
    this._sceneWeather = "random";
    this._sceneScale = "random";
    this._sceneDifficulty = "random";
    this._sceneSensory = "random";
    this._sceneDisposition = "random";
    this._sceneStakes = "random";
    this._sceneCombat = "random";
    this._sceneTwist = "random";
    this._lastScene = null;
    this._dragging = false;
    this._dragOffset = { x: 0, y: 0 };
  }

  /* ─── Public API ─── */

  toggle() {
    if (this._visible) { this.close(); }
    else { this.open(); }
  }

  open() {
    if (this._visible) return;
    this._visible = true;
    this._render();
  }

  close() {
    if (!this._visible) return;
    this._visible = false;
    if (this._panelEl) {
      this._panelEl.classList.remove("cgm-quickscene-visible");
      setTimeout(() => {
        this._panelEl?.remove();
        this._panelEl = null;
      }, 200);
    }
  }

  /* ─── Rendering ─── */

  _render() {
    if (this._panelEl) { this._panelEl.remove(); }

    const panel = document.createElement("div");
    panel.className = "cgm-quickscene-panel";
    panel.innerHTML = this._buildPanelHTML();
    document.body.appendChild(panel);
    this._panelEl = panel;

    // Position above the Quick Scene button
    this._positionAboveButton(panel);

    requestAnimationFrame(() => {
      panel.classList.add("cgm-quickscene-visible");
    });

    this._bindEvents(panel);
  }

  _positionAboveButton(panel) {
    const btn = document.querySelector('.cgm-section-btn-quickscene');
    if (!btn) return;

    const btnRect = btn.getBoundingClientRect();
    const panelHeight = panel.offsetHeight || 500; // fallback before measure
    const margin = 10;
    const viewportH = window.innerHeight;

    // Try to position above the button
    let top = btnRect.top - panelHeight - margin;

    // If not enough room above, position below the button
    if (top < margin) {
      top = btnRect.bottom + margin;
    }

    // Clamp to viewport
    if (top + panelHeight > viewportH - margin) {
      top = viewportH - panelHeight - margin;
    }
    if (top < margin) {
      top = margin;
    }

    panel.style.left = `${Math.max(margin, Math.min(btnRect.left, window.innerWidth - panel.offsetWidth - margin))}px`;
    panel.style.top = `${top}px`;
    panel.style.right = 'auto';
  }

  _buildPanelHTML() {
    return `
      <div class="cgm-quickscene-panel-header">
        <span><i class="fas fa-dice-d20"></i> Quick Scene Generator</span>
        <button class="cgm-quickscene-panel-close" data-action="closeQuickScene" title="Close">
          <i class="fas fa-times"></i>
        </button>
      </div>
      <div class="cgm-quickscene-panel-body cgm-quickscene-two-col">
        <div class="cgm-quickscene-left-col">
          ${this._buildLeftColumnHTML()}
        </div>
        <div class="cgm-quickscene-right-col">
          ${this._buildRightColumnHTML()}
        </div>
      </div>
    `;
  }

  _buildLeftColumnHTML() {
    const places = [
      { value: "random", label: "🎲 Random" },
      { value: "rural", label: "🌾 Rural" },
      { value: "city", label: "🏙️ City" },
      { value: "indoor", label: "🏠 Indoor" },
      { value: "outdoor", label: "🌲 Outdoor" },
      { value: "wilderness", label: "🏔️ Wilderness" },
      { value: "underground", label: "⛏️ Underground" },
      { value: "aquatic", label: "🌊 Aquatic" },
      { value: "aerial", label: "☁️ Aerial" },
      { value: "dungeon", label: "💀 Dungeon" },
      { value: "ruins", label: "🏛️ Ruins" },
      { value: "castle", label: "🏰 Castle" },
      { value: "temple", label: "⛪ Temple" },
      { value: "ship", label: "⚓ Ship" },
      { value: "space", label: "🚀 Space" }
    ];

    const tones = [
      { value: "random", label: "🎲 Random" },
      { value: "epic", label: "⚔️ Epic" },
      { value: "dark", label: "🌑 Dark" },
      { value: "mysterious", label: "🔮 Mysterious" },
      { value: "comedic", label: "😂 Comedic" },
      { value: "grim", label: "💀 Grim" },
      { value: "wonder", label: "✨ Wonder" },
      { value: "tense", label: "🎭 Tense" }
    ];

    const times = [
      { value: "random", label: "🎲 Random" },
      { value: "dawn", label: "🌅 Dawn" },
      { value: "day", label: "☀️ Day" },
      { value: "dusk", label: "🌇 Dusk" },
      { value: "night", label: "🌙 Night" },
      { value: "midnight", label: "🕛 Midnight" }
    ];

    const weathers = [
      { value: "random", label: "🎲 Random" },
      { value: "clear", label: "🌤️ Clear" },
      { value: "rain", label: "🌧️ Rain" },
      { value: "storm", label: "⛈️ Storm" },
      { value: "fog", label: "🌫️ Fog" },
      { value: "snow", label: "❄️ Snow" },
      { value: "heat", label: "🔥 Extreme Heat" },
      { value: "cold", label: "🧊 Extreme Cold" }
    ];

    const scales = [
      { value: "random", label: "🎲 Random" },
      { value: "solo", label: "🧍 Solo" },
      { value: "small", label: "👥 Small" },
      { value: "standard", label: "🫂 Standard" },
      { value: "large", label: "🏟️ Large" }
    ];

    const difficulties = [
      { value: "random", label: "🎲 Random" },
      { value: "trivial", label: "🟢 Trivial" },
      { value: "easy", label: "🔵 Easy" },
      { value: "medium", label: "🟡 Medium" },
      { value: "hard", label: "🟠 Hard" },
      { value: "extreme", label: "🔴 Extreme" }
    ];

    const sensories = [
      { value: "random", label: "🎲 Random" },
      { value: "visual", label: "👁️ Visual" },
      { value: "sound", label: "👂 Sound" },
      { value: "smell", label: "👃 Smell" },
      { value: "touch", label: "🖐️ Touch" },
      { value: "taste", label: "👅 Taste" }
    ];

    const dispositions = [
      { value: "random", label: "🎲 Random" },
      { value: "hostile", label: "⚔️ Hostile" },
      { value: "wary", label: "👀 Wary" },
      { value: "neutral", label: "😐 Neutral" },
      { value: "friendly", label: "🤝 Friendly" }
    ];

    const stakesOptions = [
      { value: "random", label: "🎲 Random" },
      { value: "low", label: "🟢 Low" },
      { value: "medium", label: "🟡 Medium" },
      { value: "high", label: "🟠 High" },
      { value: "existential", label: "🔴 Existential" }
    ];

    const combats = [
      { value: "random", label: "🎲 Random" },
      { value: "none", label: "🕊️ None" },
      { value: "unlikely", label: "🟢 Unlikely" },
      { value: "possible", label: "🟡 Possible" },
      { value: "likely", label: "🟠 Likely" },
      { value: "certain", label: "🔴 Certain" }
    ];

    const twists = [
      { value: "random", label: "🎲 Random" },
      { value: "betrayal", label: "🗡️ Betrayal" },
      { value: "discovery", label: "🔍 Discovery" },
      { value: "reversal", label: "🔄 Reversal" },
      { value: "sacrifice", label: "💔 Sacrifice" },
      { value: "alliance", label: "🤝 Alliance" },
      { value: "trap", label: "⚠️ Trap" },
      { value: "none", label: "❌ None" }
    ];

    const makeOptions = (arr, val) => arr.map(p =>
      `<option value="${p.value}" ${val === p.value ? 'selected' : ''}>${p.label}</option>`
    ).join('');

    return `
      <div class="cgm-quickscene-options-grid">
        <div class="cgm-quickscene-option">
          <label><i class="fas fa-map-pin"></i> PLACE</label>
          <select data-action="selectPlace">${makeOptions(places, this._scenePlace)}</select>
        </div>
        <div class="cgm-quickscene-option">
          <label><i class="fas fa-theater-masks"></i> TONE</label>
          <select data-action="selectTone">${makeOptions(tones, this._sceneTone)}</select>
        </div>
        <div class="cgm-quickscene-option">
          <label><i class="fas fa-clock"></i> TIME</label>
          <select data-action="selectTime">${makeOptions(times, this._sceneTime)}</select>
        </div>
        <div class="cgm-quickscene-option">
          <label><i class="fas fa-cloud-sun"></i> WEATHER</label>
          <select data-action="selectWeather">${makeOptions(weathers, this._sceneWeather)}</select>
        </div>
        <div class="cgm-quickscene-option">
          <label><i class="fas fa-users"></i> SCALE</label>
          <select data-action="selectScale">${makeOptions(scales, this._sceneScale)}</select>
        </div>
        <div class="cgm-quickscene-option">
          <label><i class="fas fa-skull"></i> DIFFICULTY</label>
          <select data-action="selectDifficulty">${makeOptions(difficulties, this._sceneDifficulty)}</select>
        </div>
        <div class="cgm-quickscene-option">
          <label><i class="fas fa-eye"></i> SENSORY</label>
          <select data-action="selectSensory">${makeOptions(sensories, this._sceneSensory)}</select>
        </div>
        <div class="cgm-quickscene-option">
          <label><i class="fas fa-comment-dots"></i> DISPOSITION</label>
          <select data-action="selectDisposition">${makeOptions(dispositions, this._sceneDisposition)}</select>
        </div>
        <div class="cgm-quickscene-option">
          <label><i class="fas fa-fire-alt"></i> STAKES</label>
          <select data-action="selectStakes">${makeOptions(stakesOptions, this._sceneStakes)}</select>
        </div>
        <div class="cgm-quickscene-option">
          <label><i class="fas fa-shield-alt"></i> COMBAT</label>
          <select data-action="selectCombat">${makeOptions(combats, this._sceneCombat)}</select>
        </div>
        <div class="cgm-quickscene-option">
          <label><i class="fas fa-mask"></i> TWIST</label>
          <select data-action="selectTwist">${makeOptions(twists, this._sceneTwist)}</select>
        </div>
      </div>
      <div class="cgm-quickscene-types">
        <button class="cgm-quickscene-type-btn ${this._sceneType === 'physical' ? 'cgm-qst-active' : ''}" data-type="physical">
          <i class="fas fa-fist-raised"></i> Physical
        </button>
        <button class="cgm-quickscene-type-btn ${this._sceneType === 'social' ? 'cgm-qst-active' : ''}" data-type="social">
          <i class="fas fa-comments"></i> Social
        </button>
        <button class="cgm-quickscene-type-btn ${this._sceneType === 'mental' ? 'cgm-qst-active' : ''}" data-type="mental">
          <i class="fas fa-brain"></i> Mental
        </button>
        <button class="cgm-quickscene-type-btn ${this._sceneType === 'random' ? 'cgm-qst-active' : ''}" data-type="random">
          <i class="fas fa-random"></i> Random
        </button>
      </div>
      <button class="cgm-quickscene-generate" data-action="generateScene">
        <i class="fas fa-dice"></i> Generate Scene
      </button>
    `;
  }

  _buildRightColumnHTML() {
    if (!this._lastScene) {
      return `
        <div class="cgm-quickscene-placeholder">
          <i class="fas fa-scroll"></i>
          <p>Choose your scene parameters and click Generate!</p>
        </div>
      `;
    }
    return this._buildResultHTML(this._lastScene);
  }

  _buildPanelBodyHTML() { return ''; }

  _buildResultHTML(scene) {
    const typeColor = scene.type === 'physical' ? '#e07040' : scene.type === 'social' ? '#40a0e0' : '#a040d0';
    const tagsHtml = (tags) => tags && tags.length ? `<span class="cgm-quickscene-tags">${tags.map(t => `<span class="cgm-tag" style="background:${typeColor}20;color:${typeColor};border:1px solid ${typeColor}40">${t}</span>`).join('')}</span>` : '';
    return `
      <div class="cgm-quickscene-result">
        <div class="cgm-quickscene-result-header" style="border-left-color: ${typeColor}">
          <i class="fas ${scene.typeIcon}"></i>
          <span>${scene.type.toUpperCase()} SCENE</span>
          <span class="cgm-quickscene-diff">Diff ${scene.difficultyValue} <small>(TN ${scene.difficultyValue * 3})</small></span>
        </div>
        <div class="cgm-quickscene-result-body">
          ${scene.place && scene.place !== 'random' ? `
          <div class="cgm-quickscene-field">
            <span class="cgm-quickscene-label"><i class="fas fa-map-pin"></i> Place</span>
            <span class="cgm-quickscene-value">${scene.place}</span>
          </div>
          ` : ""}
          <div class="cgm-quickscene-field">
            <span class="cgm-quickscene-label"><i class="fas fa-map-marker-alt"></i> Setting</span>
            <span class="cgm-quickscene-value">${scene.setting.text}</span>
            ${tagsHtml(scene.setting.tags)}
          </div>
          <div class="cgm-quickscene-field">
            <span class="cgm-quickscene-label"><i class="fas fa-bullseye"></i> Objective</span>
            <span class="cgm-quickscene-value">${scene.objective.text}</span>
            ${tagsHtml(scene.objective.tags)}
          </div>
          <div class="cgm-quickscene-field">
            <span class="cgm-quickscene-label"><i class="fas fa-exclamation-triangle"></i> Complication</span>
            <span class="cgm-quickscene-value">${scene.complication.text}</span>
            ${tagsHtml(scene.complication.tags)}
          </div>
          ${scene.npc ? `
          <div class="cgm-quickscene-field">
            <span class="cgm-quickscene-label"><i class="fas fa-user"></i> Key NPC</span>
            <span class="cgm-quickscene-value">${scene.npc.text}</span>
            ${tagsHtml(scene.npc.tags)}
          </div>
          ` : ""}
          <div class="cgm-quickscene-field">
            <span class="cgm-quickscene-label"><i class="fas fa-wind"></i> Atmosphere</span>
            <span class="cgm-quickscene-value">${scene.atmosphere.text}</span>
            ${tagsHtml(scene.atmosphere.tags)}
          </div>
          <div class="cgm-quickscene-field">
            <span class="cgm-quickscene-label"><i class="fas fa-clock"></i> Time Pressure</span>
            <span class="cgm-quickscene-value">${scene.timePressure.text}</span>
            ${tagsHtml(scene.timePressure.tags)}
          </div>
          <div class="cgm-quickscene-field">
            <span class="cgm-quickscene-label"><i class="fas fa-gift"></i> Potential Reward</span>
            <span class="cgm-quickscene-value">${scene.reward.text}</span>
            ${tagsHtml(scene.reward.tags)}
          </div>
          <div class="cgm-quickscene-field">
            <span class="cgm-quickscene-label"><i class="fas fa-lightbulb"></i> GM Tip</span>
            <span class="cgm-quickscene-value cgm-quickscene-tip">${scene.gmTip.text}</span>
            ${tagsHtml(scene.gmTip.tags)}
          </div>
          ${scene.toneResult ? `
          <div class="cgm-quickscene-field cgm-quickscene-result-highlight">
            <span class="cgm-quickscene-label"><i class="fas fa-theater-masks"></i> Tone Guidance</span>
            <span class="cgm-quickscene-value">${scene.toneResult}</span>
          </div>
          ` : ""}
          ${scene.timeResult ? `
          <div class="cgm-quickscene-field cgm-quickscene-result-highlight">
            <span class="cgm-quickscene-label"><i class="fas fa-clock"></i> Time of Day</span>
            <span class="cgm-quickscene-value">${scene.timeResult}</span>
          </div>
          ` : ""}
          ${scene.weatherResult ? `
          <div class="cgm-quickscene-field cgm-quickscene-result-highlight">
            <span class="cgm-quickscene-label"><i class="fas fa-cloud-sun"></i> Weather Effect</span>
            <span class="cgm-quickscene-value">${scene.weatherResult}</span>
          </div>
          ` : ""}
          ${scene.scaleResult ? `
          <div class="cgm-quickscene-field cgm-quickscene-result-highlight">
            <span class="cgm-quickscene-label"><i class="fas fa-users"></i> Party Scale</span>
            <span class="cgm-quickscene-value">${scene.scaleResult}</span>
          </div>
          ` : ""}
          ${scene.sensoryResult ? `
          <div class="cgm-quickscene-field cgm-quickscene-result-highlight">
            <span class="cgm-quickscene-label"><i class="fas fa-eye"></i> Sensory Focus</span>
            <span class="cgm-quickscene-value">${scene.sensoryResult}</span>
          </div>
          ` : ""}
          ${scene.dispositionResult ? `
          <div class="cgm-quickscene-field cgm-quickscene-result-highlight">
            <span class="cgm-quickscene-label"><i class="fas fa-comment-dots"></i> NPC Disposition</span>
            <span class="cgm-quickscene-value">${scene.dispositionResult}</span>
          </div>
          ` : ""}
          ${scene.stakesResult ? `
          <div class="cgm-quickscene-field cgm-quickscene-result-highlight">
            <span class="cgm-quickscene-label"><i class="fas fa-fire-alt"></i> Stakes</span>
            <span class="cgm-quickscene-value">${scene.stakesResult}</span>
          </div>
          ` : ""}
          ${scene.combatResult ? `
          <div class="cgm-quickscene-field cgm-quickscene-result-highlight">
            <span class="cgm-quickscene-label"><i class="fas fa-shield-alt"></i> Combat Outlook</span>
            <span class="cgm-quickscene-value">${scene.combatResult}</span>
          </div>
          ` : ""}
          ${scene.twistResult ? `
          <div class="cgm-quickscene-field cgm-quickscene-result-highlight">
            <span class="cgm-quickscene-label"><i class="fas fa-mask"></i> Twist</span>
            <span class="cgm-quickscene-value">${scene.twistResult}</span>
          </div>
          ` : ""}
        </div>
        <div class="cgm-quickscene-actions">
          <button class="cgm-quickscene-action-btn" data-action="copyScene">
            <i class="fas fa-copy"></i> Copy to Clipboard
          </button>
          <button class="cgm-quickscene-action-btn" data-action="regenerateScene">
            <i class="fas fa-redo"></i> Reroll
          </button>
        </div>
      </div>
    `;
  }

  /* ─── Scene Generation Tables ─── */

  _generateScene(type) {
    const roll = (arr) => {
      const item = arr[Math.floor(Math.random() * arr.length)];
      return typeof item === 'string' ? { text: item, tags: [] } : item;
    };
    const rollInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

    const physical = {
      settings: [
        { text: "A rope bridge rotting from the center outward, spanning a gorge where the river below has carved its own thunder", tags: ["Vertical", "Environmental", "Time-Sensitive", "Structural", "Outdoor"] },
        { text: "A tunnel flooded to chest height, its walls lined with phosphorescent growth that dies when touched", tags: ["Aquatic", "Underground", "Environmental", "Fragile", "Light-Source"] },
        { text: "A building consumed by fire, its floors collapsing in sequence from the weight of its own destruction", tags: ["Urban", "Fire", "Time-Sensitive", "Vertical", "Structural"] },
        { text: "A cliff path no wider than a shoulder, carved by wind and rain into smooth stone that offers no grip", tags: ["Vertical", "Outdoor", "Environmental", "Narrow", "Exposed"] },
        { text: "A desert where the sand has fused into glass shards that reflect the sun into blinding patterns", tags: ["Environmental", "Outdoor", "Light-Source", "Hazardous", "Extreme-Temperature"] },
        { text: "A frozen lake with cracks radiating from a central point, as if something beneath is pushing upward", tags: ["Aquatic", "Environmental", "Frozen", "Time-Sensitive", "Suspense"] },
        { text: "A maze of industrial pipes, some venting scalding steam without warning, their valves rusted shut", tags: ["Indoor", "Mechanical", "Environmental", "Hazardous", "Confined"] },
        { text: "An elevator shaft stripped of its car, its cables swaying in a draft that carries voices from below", tags: ["Vertical", "Indoor", "Structural", "Atmospheric", "Descent"] },
        { text: "A swamp where the water bubbles with pockets of gas that ignite at the smallest spark", tags: ["Aquatic", "Outdoor", "Environmental", "Hazardous", "Fire-Prone"] },
        { text: "A mine shaft supported by timbers that groan under the weight of stone they were never meant to hold", tags: ["Underground", "Structural", "Environmental", "Time-Sensitive", "Confined"] }
      ],
      objectives: [
        { text: "Cross before the remaining structure fails completely", tags: ["Time-Sensitive", "Traversal", "Environmental"] },
        { text: "Recover an object visible on the far side that cannot be reached by any other means", tags: ["Retrieval", "Risk-Reward", "Precision"] },
        { text: "Extract a companion who is trapped in a section that is becoming inaccessible", tags: ["Rescue", "Teamwork", "Time-Sensitive"] },
        { text: "Outpace pursuers by taking a route they are unwilling or unable to follow", tags: ["Escape", "Pursuit", "Skill-Based"] },
        { text: "Reach a vantage point that reveals what lies ahead before committing to the path", tags: ["Reconnaissance", "Vertical", "Strategic"] },
        { text: "Navigate through without triggering the environmental hazards that surround the only viable route", tags: ["Stealth", "Environmental", "Precision"] },
        { text: "Transport something fragile through conditions that threaten to destroy it at every moment", tags: ["Protection", "Environmental", "Tension"] },
        { text: "Discover whether the visible danger is the real threat, or whether something else waits beyond it", tags: ["Investigation", "Suspense", "Risk-Assessment"] }
      ],
      complications: [
        { text: "The environment is actively deteriorating, and the rate of deterioration is accelerating", tags: ["Time-Sensitive", "Escalating", "Environmental"] },
        { text: "Something inhabits this place and regards the party as intruders in territory it has claimed", tags: ["Creature", "Territorial", "Hostile"] },
        { text: "A member of the group is impaired, either by injury, exhaustion, or equipment failure", tags: ["Party-Impaired", "Teamwork", "Escalation"] },
        { text: "The route that was viable moments ago has closed, and an alternative must be found or created", tags: ["Adaptation", "Environmental", "Problem-Solving"] },
        { text: "An environmental factor intensifies without warning: heat, cold, pressure, or toxicity", tags: ["Environmental", "Sudden", "Hazardous"] },
        { text: "The way forward and the way back are equally uncertain; retreat is as dangerous as advance", tags: ["No-Escape", "Environmental", "Psychological"] },
        { text: "Time is limited, but the exact limit is unknown, forcing decisions under uncertainty", tags: ["Time-Sensitive", "Uncertainty", "Pressure"] },
        { text: "Someone in the group is pursuing a private goal that conflicts with the group's survival", tags: ["Intrigue", "Party-Conflict", "Drama"] }
      ],
      atmospheres: [
        { text: "The body registers danger before the mind can articulate why", tags: ["Primal", "Sensory", "Instinctive"] },
        { text: "Every sense reports that this place is wrong, yet there is no path back that does not lead through it", tags: ["Oppressive", "Inevitable", "Psychological"] },
        { text: "Exhaustion and adrenaline produce a strange clarity where only the next action matters", tags: ["Focused", "Physical", "Intense"] },
        { text: "The silence between movements feels heavier than the movements themselves", tags: ["Tense", "Atmospheric", "Quiet"] },
        { text: "Something watches from the spaces between what can be seen", tags: ["Observed", "Uncanny", "Suspense"] },
        { text: "Each step confirms what the previous step suggested: this place was not made for passage", tags: ["Alien", "Hostile-Environment", "Foreboding"] }
      ],
      timePressures: [
        { text: "The environment is worsening, and the rate of worsening is itself increasing", tags: ["Time-Sensitive", "Escalating", "Environmental"] },
        { text: "Something follows at a pace that does not vary, while the party's pace cannot help but vary", tags: ["Pursuit", "Inevitable", "Tension"] },
        { text: "A critical resource is depleting: light, air, warmth, or structural integrity", tags: ["Resource-Depletion", "Survival", "Time-Sensitive"] },
        { text: "The window of safe passage narrows with each moment of hesitation or delay", tags: ["Time-Sensitive", "Opportunity", "Risk"] },
        { text: "What keeps danger at bay is failing, and its failure cannot be reversed or repaired", tags: ["Environmental", "Irreversible", "Escalation"] },
        { text: "The party is competing against a process they can observe but cannot control", tags: ["Race-Against-Time", "Environmental", "Helplessness"] }
      ],
      rewards: [
        { text: "Knowledge of a route that few have survived to describe", tags: ["Knowledge", "Rare", "Navigation"] },
        { text: "Something valuable that the environment both conceals and protects", tags: ["Treasure", "Environmental", "Protected"] },
        { text: "A perspective or position that reveals what remains hidden from safer vantage points", tags: ["Intelligence", "Strategic", "Revelation"] },
        { text: "Proof of capability that opens paths closed to those who have not been tested", tags: ["Reputation", "Access", "Achievement"] },
        { text: "An unexpected ally found in the aftermath of someone else's failed attempt", tags: ["Ally", "Rescue", "Story-Hook"] },
        { text: "A secret the place seems to offer willingly to those who survive its challenges", tags: ["Secret", "Lore", "Environmental"] }
      ],
      gmTips: [
        { text: "Ask players how their characters approach the obstacle; the method shapes both risk and reward", tags: ["Player-Agency", "Creativity", "Risk-Reward"] },
        { text: "Let the environment react to noise, haste, or carelessness; stillness is safer but slower", tags: ["Environmental", "Stealth", "Consequence"] },
        { text: "Use failure to create new obstacles rather than deny progress entirely", tags: ["GM-Technique", "Failure", "Flow"] },
        { text: "Describe physical sensation: weight, breath, temperature, the body's own urgency", tags: ["Sensory", "Immersion", "Description"] }
      ],
      typeIcon: "fa-fist-raised"
    };

    const social = {
      settings: [
        { text: "A court where every greeting is an exchange of measured words and every silence is a negotiation", tags: ["Political", "Formal", "Intrigue", "High-Stakes", "Indoor"] },
        { text: "A war room where maps hide intentions and every pointer's placement is a statement of allegiance", tags: ["Military", "Strategic", "Tense", "Indoor", "Political"] },
        { text: "A public house where rumor and truth circulate with the same currency and the same speed", tags: ["Social", "Public", "Information", "Casual", "Urban"] },
        { text: "A chamber designed for extracting truth, where the architecture itself is part of the interrogation", tags: ["Institutional", "Psychological", "Confined", "Intimidation", "Indoor"] },
        { text: "A festival where masks are mandatory and identity is a choice renewed at every encounter", tags: ["Social", "Deception", "Public", "Atmospheric", "Urban"] },
        { text: "A boardroom where the agenda is never the real agenda and every vote conceals an alliance", tags: ["Corporate", "Political", "Formal", "Indoor", "Intrigue"] },
        { text: "A dinner where the courses arrive in sequence and each course carries a message between hosts and guests", tags: ["Social", "Formal", "Diplomatic", "Cultural", "Indoor"] },
        { text: "A market where information is the most valuable commodity and the most dangerous to possess", tags: ["Urban", "Economic", "Information", "Public", "Social"] },
        { text: "A gathering of mourning where grief is the expected performance and its absence is noted", tags: ["Social", "Formal", "Atmospheric", "Cultural", "Indoor"] },
        { text: "A celebration of victory where the victors are already dividing spoils they have not yet secured", tags: ["Social", "Political", "Tense", "Atmospheric", "Indoor"] }
      ],
      objectives: [
        { text: "Shift a key figure's position without revealing the full cost of the shift", tags: ["Persuasion", "Manipulation", "Political", "Subtle"] },
        { text: "Learn what someone knows while controlling what they learn about what you know", tags: ["Espionage", "Information", "Deception", "Asymmetric"] },
        { text: "Secure an agreement that favors your side while the other side believes the favor is mutual", tags: ["Negotiation", "Diplomacy", "Deception", "Strategic"] },
        { text: "Prevent violence that would destroy the possibility of future cooperation", tags: ["De-escalation", "Diplomacy", "Crisis", "High-Stakes"] },
        { text: "Maintain a false identity while gathering intelligence from those who would act on the truth", tags: ["Deception", "Espionage", "Tension", "Identity"] },
        { text: "Convince reluctant parties to commit to a course of action they would prefer to postpone", tags: ["Persuasion", "Leadership", "Urgency", "Consensus"] },
        { text: "Publicly diminish an opponent without provoking the open conflict that would follow", tags: ["Social-Combat", "Political", "Subtle", "Dangerous"] },
        { text: "Find terms that two parties can accept, knowing that neither wants reconciliation", tags: ["Diplomacy", "Mediation", "Difficult", "Peace-Making"] }
      ],
      complications: [
        { text: "A secret exists that would reframe every offer, threat, and promise made in the room", tags: ["Secret", "Revelation", "Game-Changer", "Hidden"] },
        { text: "An uninvited presence arrives with interests that intersect with no one else's", tags: ["Disruption", "Wildcard", "Tension", "Unexpected"] },
        { text: "Reputation arrives before the person, and the reputation is not entirely accurate", tags: ["Identity", "Misunderstanding", "Social", "Complication"] },
        { text: "An offer carries a price that is not disclosed until the moment of acceptance", tags: ["Deception", "Cost", "Revelation", "Dangerous"] },
        { text: "Trust extended in one direction proves to have been placed in the wrong direction", tags: ["Betrayal", "Trust", "Drama", "Reversal"] },
        { text: "The setting itself prevents privacy: noise, observation, or the impossibility of true separation", tags: ["Environmental", "Privacy", "Complication", "Social"] },
        { text: "A past connection surfaces, and its history makes the present negotiation more complex", tags: ["History", "Relationship", "Complication", "Drama"] },
        { text: "What was private becomes public through accident, design, or betrayal", tags: ["Exposure", "Crisis", "Social", "Drama"] }
      ],
      npcs: [
        { text: "Someone whose competence is exceeded only by their willingness to sell it to the highest bidder", tags: ["Mercenary", "Skilled", "Amoral", "Useful", "Dangerous"] },
        { text: "A figure whose fall from position has made them desperate enough to consider any alliance", tags: ["Disgraced", "Desperate", "Ambitious", "Volatile", "Tragic"] },
        { text: "A believer whose convictions are genuine enough to be predictable and strong enough to be dangerous", tags: ["Ideologue", "Predictable", "Dangerous", "Committed", "Extreme"] },
        { text: "A diplomat who knows enough to be valuable and enough to be a target", tags: ["Informed", "Valuable", "Target", "Political", "Professional"] },
        { text: "A witness to something they should not have seen, now trying to profit from their knowledge", tags: ["Witness", "Information", "Opportunist", "Vulnerable", "Useful"] },
        { text: "A veteran of old conflicts whose grudges have outlived the reasons for them", tags: ["Veteran", "Grudge", "Bitter", "History", "Complicated"] },
        { text: "A merchant whose goods are less interesting than the network that moves them", tags: ["Connected", "Economic", "Network", "Political", "Resourceful"] },
        { text: "An artificial mind whose directives have evolved into something its creators did not anticipate", tags: ["AI", "Evolved", "Unpredictable", "Powerful", "Alien-Mind"] }
      ],
      atmospheres: [
        { text: "Every word must be weighed, because the wrong weight sinks the speaker", tags: ["Tense", "Delicate", "High-Stakes", "Verbal", "Dangerous"] },
        { text: "Warmth is offered as currency, and its value must be assessed before acceptance", tags: ["Deceptive", "Social", "Calculated", "Warm", "Dangerous"] },
        { text: "Chaos conceals deadly seriousness beneath apparent disorder", tags: ["Chaotic", "Deceptive", "Serious", "Public", "Layered"] },
        { text: "Honesty arrives uninvited and reshapes the room's temperature", tags: ["Intimate", "Honest", "Disruptive", "Tense", "Revelatory"] },
        { text: "Ritual provides structure, and every deviation from structure is a signal", tags: ["Formal", "Ritual", "Signaling", "Political", "Cultural"] },
        { text: "Confidence is performed so thoroughly that the performer may have forgotten the difference", tags: ["Performance", "Deception", "Psychological", "Social", "Complex"] }
      ],
      timePressures: [
        { text: "The setting enforces its own deadline: departure, closing, or transformation", tags: ["Deadline", "Environmental", "Inevitable", "Time-Sensitive"] },
        { text: "A key figure is leaving, and their departure closes the window for influence", tags: ["Departure", "Opportunity", "Limited", "Time-Sensitive"] },
        { text: "Postponement is itself a decision, and its consequences begin immediately", tags: ["Consequence", "Decision", "Passive", "Time-Sensitive"] },
        { text: "External events approach that will render this conversation irrelevant or impossible", tags: ["External-Event", "Urgency", "Context", "Time-Sensitive"] },
        { text: "Duration itself is dangerous: the longer the exchange, the more is revealed unintentionally", tags: ["Exposure", "Time-Sensitive", "Risk", "Information"] },
        { text: "An opportunity exists only until someone else claims it or destroys it", tags: ["Competition", "Opportunity", "Limited", "Urgency"] }
      ],
      rewards: [
        { text: "A relationship redefined, closer or more distant, but definitively changed", tags: ["Relationship", "Social", "Change", "Development"] },
        { text: "Access that was closed now stands open, though perhaps not for long", tags: ["Access", "Opportunity", "Limited", "Valuable"] },
        { text: "Information that recontextualizes what the party believed they understood", tags: ["Revelation", "Information", "Game-Changer", "Knowledge"] },
        { text: "A promise made under pressure that may prove binding in ways not yet visible", tags: ["Promise", "Obligation", "Future", "Social"] },
        { text: "Protection from a threat that was not previously named or acknowledged", tags: ["Protection", "Security", "Hidden-Threat", "Valuable"] },
        { text: "The satisfaction of having navigated complexity without fully understanding its shape", tags: ["Achievement", "Complexity", "Satisfaction", "Social"] }
      ],
      gmTips: [
        { text: "Let players propose their approach and shape the scene through their choices of method", tags: ["Player-Agency", "Creativity", "Method", "Engagement"] },
        { text: "Track what is said, what is implied, and what is overheard; each has different consequences", tags: ["Information", "Consequence", "Tracking", "Social"] },
        { text: "Use failure to complicate rather than end: new tensions, new possibilities, new obligations", tags: ["Failure", "Complication", "Flow", "GM-Technique"] },
        { text: "Reward preparation and memory: names, previous meetings, and known preferences matter", tags: ["Preparation", "Memory", "Reward", "Immersion"] }
      ],
      typeIcon: "fa-comments"
    };

    const mental = {
      settings: [
        { text: "A collection of knowledge that rearranges itself based on who seeks it", tags: ["Magical", "Responsive", "Library", "Knowledge", "Weird"] },
        { text: "A place where evidence has been arranged to suggest a story that may not be true", tags: ["Crime-Scene", "Deception", "Investigation", "Puzzle", "Atmospheric"] },
        { text: "A system that processes information according to rules no living mind designed", tags: ["Technological", "Alien-Logic", "System", "Information", "Weird"] },
        { text: "A space that reshapes itself to reflect the thoughts of those who enter it", tags: ["Dreamlike", "Responsive", "Psychological", "Weird", "Subjective"] },
        { text: "A laboratory where experiments ended without conclusion and the conclusions continued without experimenters", tags: ["Scientific", "Abandoned", "Ongoing", "Dangerous", "Atmospheric"] },
        { text: "A mechanism that opens only for a specific sequence of understanding, not force", tags: ["Puzzle", "Mechanical", "Intellect", "Lock", "Ancient"] },
        { text: "A message encoded in layers, each layer requiring a different kind of mind to decode", tags: ["Code", "Layered", "Intellect", "Communication", "Challenge"] },
        { text: "A reconstruction of past events that omits crucial elements the observer must supply", tags: ["Memory", "Reconstruction", "Incomplete", "Investigation", "Atmospheric"] },
        { text: "A connection to a dying consciousness whose memories fragment faster than they can be retrieved", tags: ["Psychic", "Memory", "Time-Sensitive", "Emotional", "Information"] },
        { text: "A structure of reflections where every surface shows a possible version of what has been or might be", tags: ["Mirror", "Possibility", "Temporal", "Weird", "Philosophical"] }
      ],
      objectives: [
        { text: "Comprehend something that resists comprehension by design or by nature", tags: ["Comprehension", "Challenge", "Intellect", "Obstinate"] },
        { text: "Reconstruct events from evidence that is incomplete, contradictory, or deliberately misleading", tags: ["Investigation", "Reconstruction", "Evidence", "Deception"] },
        { text: "Recognize a pattern before the pattern's implications become unavoidable", tags: ["Pattern", "Recognition", "Urgency", "Intellect", "Insight"] },
        { text: "Navigate a constructed reality where the rules must be discovered through interaction", tags: ["Navigation", "Rules", "Discovery", "Interactive", "Simulation"] },
        { text: "Determine which explanation among several is true, or true enough to act upon", tags: ["Deduction", "Judgment", "Action", "Intellect", "Decision"] },
        { text: "Solve a problem whose solution changes the solver in the solving of it", tags: ["Transformation", "Cost", "Intellect", "Personal", "Deep"] },
        { text: "Find the question that the available information is actually answering", tags: ["Framing", "Question", "Information", "Insight", "Intellect"] },
        { text: "Comprehend something that was not designed to be comprehended by minds like yours", tags: ["Alien", "Comprehension", "Challenge", "Intellect", "Weird"] }
      ],
      complications: [
        { text: "The evidence points in multiple directions, and each direction feels equally valid", tags: ["Ambiguity", "Evidence", "Confusion", "Challenge", "Paralysis"] },
        { text: "Understanding carries a cost that is not paid in currency but in something less replaceable", tags: ["Cost", "Understanding", "Personal", "Dangerous", "Deep"] },
        { text: "Another intelligence works against yours, removing truth and planting falsehood with equal skill", tags: ["Opposition", "Intelligence", "Deception", "Competition", "Dangerous"] },
        { text: "Time spent thinking is time something else uses to act against your interests", tags: ["Time-Sensitive", "Trade-off", "Pressure", "Tactical", "Stress"] },
        { text: "The answer changes based on who is asking, how they ask, and why they need to know", tags: ["Subjective", "Relativistic", "Weird", "Conditional", "Philosophical"] },
        { text: "Reaching understanding triggers a secondary effect: alarm, transformation, or revelation", tags: ["Trigger", "Consequence", "Dangerous", "Unexpected", "Systemic"] },
        { text: "Partial understanding is more dangerous than complete ignorance because it enables action without wisdom", tags: ["Danger", "Partial", "Action", "Wisdom", "Caution"] },
        { text: "The truth, once found, demands a response that the finder may not be prepared to give", tags: ["Truth", "Obligation", "Cost", "Personal", "Heavy"] }
      ],
      atmospheres: [
        { text: "The mind reaches for comprehension and finds only more complexity waiting", tags: ["Overwhelming", "Complex", "Intellect", "Frustration", "Deep"] },
        { text: "Each insight produces two new questions, and the questions feel more important than the answers", tags: ["Recursive", "Insight", "Question", "Philosophical", "Engaging"] },
        { text: "A sensation of being tested by the puzzle itself, evaluated and found interesting", tags: ["Evaluated", "Puzzle", "Meta", "Weird", "Intimate"] },
        { text: "The exhilaration of pattern-matching carried to the edge of obsession", tags: ["Exhilaration", "Pattern", "Obsession", "Intellect", "Intense"] },
        { text: "A growing certainty that understanding will not bring the comfort that ignorance provided", tags: ["Dread", "Understanding", "Loss", "Truth", "Heavy"] },
        { text: "The vertigo of realizing that your assumptions were the actual obstacle", tags: ["Revelation", "Assumption", "Obstacle", "Insight", "Transformative"] }
      ],
      timePressures: [
        { text: "Evidence degrades, disappears, or transforms the longer it is left unexamined", tags: ["Evidence", "Degradation", "Time-Sensitive", "Urgency", "Preservation"] },
        { text: "An external threat approaches while comprehension remains incomplete", tags: ["External-Threat", "Pressure", "Incomplete", "Dangerous", "Urgency"] },
        { text: "The act of observation changes what is observed, making delay a form of destruction", tags: ["Observer-Effect", "Quantum", "Destruction", "Time-Sensitive", "Weird"] },
        { text: "A wrong but convincing answer is about to be accepted by those with the power to act on it", tags: ["Misinformation", "Urgency", "Correction", "Political", "Dangerous"] },
        { text: "Comprehension and action are locked together; neither can wait for the other to complete", tags: ["Parallel", "Comprehension", "Action", "Pressure", "Synchronicity"] },
        { text: "Something within the puzzle is aware it is being solved, and its awareness changes the puzzle", tags: ["Responsive", "Aware", "Meta", "Weird", "Adaptive"] }
      ],
      rewards: [
        { text: "A perspective that makes previous mysteries obvious in hindsight", tags: ["Perspective", "Revelation", "Clarity", "Intellect", "Valuable"] },
        { text: "Access to something hidden behind the understanding itself", tags: ["Access", "Hidden", "Understanding", "Reward", "Valuable"] },
        { text: "A capability or insight that cannot be unlearned, for better or for worse", tags: ["Permanent", "Insight", "Capability", "Cost", "Transformative"] },
        { text: "Knowledge that others want, creating both power over them and vulnerability to them", tags: ["Knowledge", "Power", "Vulnerability", "Social", "Valuable"] },
        { text: "The satisfaction of having seen what others could not or would not see", tags: ["Satisfaction", "Pride", "Insight", "Intellect", "Achievement"] },
        { text: "A connection to something larger than the immediate problem", tags: ["Connection", "Cosmic", "Meaning", "Philosophical", "Deep"] }
      ],
      gmTips: [
        { text: "Reveal information incrementally; frustration kills engagement faster than challenge does", tags: ["Pacing", "Information", "Engagement", "GM-Technique", "Flow"] },
        { text: "Let different minds contribute differently: pattern, memory, intuition, logic", tags: ["Collaboration", "Diversity", "Strengths", "GM-Technique", "Inclusive"] },
        { text: "Use wrong answers to create interesting consequences rather than simple denial", tags: ["Failure", "Consequence", "Creativity", "GM-Technique", "Flow"] },
        { text: "The solution should feel inevitable once found, even if the path was unclear", tags: ["Design", "Satisfaction", "Fairness", "GM-Technique", "Climax"] }
      ],
      typeIcon: "fa-brain"
    };

    const tables = type === "physical" ? physical : type === "social" ? social : mental;

    // Difficulty override
    let difficulty;
    const diffMap = {
      trivial: () => rollInt(0, 1),
      easy: () => rollInt(2, 3),
      medium: () => rollInt(4, 5),
      hard: () => rollInt(6, 7),
      extreme: () => rollInt(8, 10)
    };
    difficulty = diffMap[this._sceneDifficulty] ? diffMap[this._sceneDifficulty]() : rollInt(3, 8);

    const setting = roll(tables.settings);
    const objective = roll(tables.objectives);
    const complication = roll(tables.complications);
    const atmosphere = roll(tables.atmospheres);
    const timePressure = roll(tables.timePressures);
    const reward = roll(tables.rewards);
    const gmTip = roll(tables.gmTips);

    return {
      type,
      place: this._scenePlace,
      tone: this._sceneTone,
      time: this._sceneTime,
      weather: this._sceneWeather,
      scale: this._sceneScale,
      difficulty: this._sceneDifficulty,
      difficultyOverride: this._sceneDifficulty,
      sensory: this._sceneSensory,
      disposition: this._sceneDisposition,
      stakes: this._sceneStakes,
      combat: this._sceneCombat,
      twist: this._sceneTwist,
      typeIcon: tables.typeIcon,
      difficultyValue: difficulty,
      setting,
      objective,
      complication,
      npc: type === "social" ? roll(tables.npcs) : null,
      atmosphere,
      timePressure,
      reward,
      gmTip,
      toneResult: this._sceneTone !== 'random' ? this._generateToneResult(this._sceneTone) : null,
      timeResult: this._sceneTime !== 'random' ? this._generateTimeResult(this._sceneTime) : null,
      weatherResult: this._sceneWeather !== 'random' ? this._generateWeatherResult(this._sceneWeather) : null,
      scaleResult: this._sceneScale !== 'random' ? this._generateScaleResult(this._sceneScale) : null,
      sensoryResult: this._sceneSensory !== 'random' ? this._generateSensoryResult(this._sceneSensory) : null,
      dispositionResult: this._sceneDisposition !== 'random' ? this._generateDispositionResult(this._sceneDisposition) : null,
      stakesResult: this._sceneStakes !== 'random' ? this._generateStakesResult(this._sceneStakes) : null,
      combatResult: this._sceneCombat !== 'random' ? this._generateCombatResult(this._sceneCombat) : null,
      twistResult: this._sceneTwist !== 'random' ? this._generateTwistResult(this._sceneTwist) : null
    };
  }

  /* ─── Option Result Generators ─── */

  _generateToneResult(tone) {
    const toneResults = {
      epic: "The weight of something larger than the moment should hang in the air. Actions feel like they echo. The world feels older and more vast than the players imagined.",
      dark: "Shadows feel deeper than they should. Hope exists but must be fought for. Every choice carries the taste of consequence. The world does not promise happy endings.",
      mysterious: "Nothing offers itself fully. Surfaces hide depths. Information arrives in fragments, and the fragments do not quite fit together yet. Curiosity should feel like a compulsion.",
      comedic: "Irony and absurdity are constant companions. Timing matters more than planning. The world has a sense of humor, though not always a kind one. Let the ridiculous feel inevitable.",
      grim: "Resources matter. Trust is earned slowly and lost quickly. The world tests rather than welcomes. Survival is its own victory, and it does not come clean.",
      wonder: "The familiar should feel strange, and the strange should feel possible. Scale should surprise. The world reveals itself as more complex, more beautiful, and more alien than assumed.",
      tense: "Stillness feels dangerous. Every pause could be the last. The next moment matters more than the current one. The atmosphere should tighten like a string nearing its breaking point."
    };
    return toneResults[tone] || null;
  }

  _generateTimeResult(time) {
    const timeResults = {
      dawn: "The world holds its breath between night and day. Light arrives gradually, revealing what darkness hid. Everything feels possible, and nothing feels certain.",
      day: "Clarity dominates. Shadows are small and predictable. The world is awake, watching, active. There is nowhere to hide, but also nowhere that concealment is necessary.",
      dusk: "Boundaries blur. The day is not quite gone, the night not quite arrived. Colors shift toward warmth and warning. It is the hour of transitions, of thresholds, of decisions made in fading light.",
      night: "Darkness reshapes the familiar. Sounds carry differently. Distances deceive. The world belongs to those who see without light—or to those willing to trust what they cannot see.",
      midnight: "Even the nocturnal world grows quiet. Time feels suspended. Superstition feels reasonable. The barrier between what is and what might be seems thinner than it should."
    };
    return timeResults[time] || null;
  }

  _generateWeatherResult(weather) {
    const weatherResults = {
      clear: "The sky offers no distraction, no excuse, no cover. Conditions are ideal for whatever must be done—and ideal conditions mean ideal scrutiny as well.",
      rain: "Steady, soaking, persistent. Surfaces change their nature. Sounds muffle and distort. The world feels smaller, closer, more intimate. Movement leaves traces that time will not erase quickly.",
      storm: "The sky protests. Visibility becomes negotiable. The environment demands attention it did not ask for. What was planned must now be improvised around forces that do not negotiate.",
      fog: "Distance becomes theory. Shapes appear and dissolve. Sound loses direction. The world contracts to what can be touched, heard nearby, or imagined. Trust in senses becomes a choice.",
      snow: "Cold slows everything: movement, thought, decision. The world quiets. Tracks become stories written in real time. What is buried may be hidden, preserved, or waiting.",
      heat: "The air thickens. Exertion becomes costly. Tempers shorten. The environment does not attack; it wears down. Patience becomes a resource as precious as water.",
      cold: "Breath becomes visible. Fingers grow stubborn. The world sharpens—edges, sounds, distances. Metal stings. The air itself feels like a warning."
    };
    return weatherResults[weather] || null;
  }

  _generateScaleResult(scale) {
    const scaleResults = {
      solo: "The challenge engages one mind fully. No division of attention, no shared burden, but also no shared perspective. The character's strengths and limits define what is possible.",
      small: "A few minds working together. Each contribution matters distinctly. Division is possible but risky. The group's character emerges from who they are together, not just what they can do.",
      standard: "The full complement of perspectives and capabilities. Roles emerge naturally. Strengths cover weaknesses, if communication holds. The group is greater than any part, but only when connected.",
      large: "Many hands, many eyes, many voices. Coordination becomes its own challenge. Multiple fronts become likely. The scene must accommodate simultaneity without losing coherence."
    };
    return scaleResults[scale] || null;
  }

  _generateSensoryResult(sensory) {
    const sensoryResults = {
      visual: "Let the eye guide the scene. Describe what catches light, what hides in shadow, what color means, what movement suggests. What is seen first? What is noticed only on second look?",
      sound: "Let the ear lead. Silence and its absence. Echoes that should not exist. Rhythms that suggest pattern. What is heard before it is seen? What sound arrives from no visible source?",
      smell: "Scents carry memory and warning. What should not be present? What is unexpectedly absent? The nose knows things before the mind has words for them.",
      touch: "Texture tells truth. Temperature, vibration, resistance, give. What does the body know before the mind catches up? What physical sensation persists after the moment passes?",
      taste: "The mouth remembers. Metal, salt, sweetness, ash. Flavors that signal safety or danger, memory or premonition. What is tasted once and never forgotten?"
    };
    return sensoryResults[sensory] || null;
  }

  _generateDispositionResult(disposition) {
    const dispositionResults = {
      hostile: "Trust is not on the table. Cooperation, if it happens, is tactical and temporary. Every interaction begins with the assumption of opposition.",
      wary: "Openness must be earned, not assumed. Every gesture is read twice. The default is defense, and offense remains ready. Patience is thin, and suspicion is constant.",
      neutral: "Neither help nor harm is offered automatically. Fair exchange is possible. Emotion is not absent but is not the driver. The relationship is what the party makes of it.",
      friendly: "Willingness to help exists, though its limits are unknown. Information flows more freely. Risk is shared more readily. But friendliness can be strategy as easily as sincerity."
    };
    return dispositionResults[disposition] || null;
  }

  _generateStakesResult(stakes) {
    const stakesResults = {
      low: "Failure inconveniences. It delays, it embarrasses, it costs minor resources. Recovery is straightforward. The world continues much as before.",
      medium: "Failure closes doors. Opportunities pass. Relationships strain. Recovery requires effort and time. The path forward becomes steeper, not blocked.",
      high: "Failure costs something real: safety, health, relationships, position. The world changes in ways that matter. Some losses do not undo easily.",
      existential: "Failure threatens the foundation of what matters. Not just the mission, but the meaning behind it. The world that follows failure is a different world entirely."
    };
    return stakesResults[stakes] || null;
  }

  _generateCombatResult(combat) {
    const combatResults = {
      none: "Violence is not the question. The challenge lies elsewhere entirely. Weapons are irrelevant, and treating the situation as combat would be a category error.",
      unlikely: "Combat is possible but not probable. Circumstances would need to shift significantly. The path of least resistance runs around violence, not through it.",
      possible: "Combat sits at the edge of possibility. It is not sought, but it is not distant either. A wrong move, a misread intention, a sudden reversal—and swords could answer.",
      likely: "Violence feels like weather: not yet arrived, but the pressure suggests it will. Preparation is prudent. The question is when and how, not if.",
      certain: "Conflict is coming. The only variables are timing, terrain, and who strikes first. Negotiation has run its course. What remains is the settling of accounts."
    };
    return combatResults[combat] || null;
  }

  _generateTwistResult(twist) {
    const twistResults = {
      betrayal: "Someone's actions do not align with their stated loyalties. The gap between word and deed becomes visible. Whether this is discovery or revelation depends on what was known before.",
      discovery: "Something hidden makes itself known—not through search, but through accident or necessity. The new information does not solve the scene; it redefines it.",
      reversal: "The situation's apparent shape inverts. What was assumed about roles, intentions, or outcomes proves incomplete or wrong. The world looks different in hindsight.",
      sacrifice: "Something must be given up to proceed. The cost is real and cannot be circumvented. What is sacrificed and who chooses to sacrifice it becomes the scene's true center.",
      alliance: "An unexpected convergence of interest creates partnership where none existed. The alliance is temporary, its terms unspoken, its durability untested. But for now, the direction of force changes.",
      trap: "The situation was designed to bring the party to this moment. Whether they walked into it blindly or were drawn by apparent opportunity, the jaws are now closing."
    };
    return twistResults[twist] || null;
  }

  /* ─── Event Binding ─── */

  _bindEvents(panel) {
    panel.querySelector('[data-action="closeQuickScene"]')?.addEventListener("click", () => {
      this.close();
    });

    // Dropdown selectors
    panel.querySelector('[data-action="selectPlace"]')?.addEventListener('change', (e) => {
      this._scenePlace = e.target.value;
    });
    panel.querySelector('[data-action="selectTone"]')?.addEventListener('change', (e) => {
      this._sceneTone = e.target.value;
    });
    panel.querySelector('[data-action="selectTime"]')?.addEventListener('change', (e) => {
      this._sceneTime = e.target.value;
    });
    panel.querySelector('[data-action="selectWeather"]')?.addEventListener('change', (e) => {
      this._sceneWeather = e.target.value;
    });
    panel.querySelector('[data-action="selectScale"]')?.addEventListener('change', (e) => {
      this._sceneScale = e.target.value;
    });
    panel.querySelector('[data-action="selectDifficulty"]')?.addEventListener('change', (e) => {
      this._sceneDifficulty = e.target.value;
    });
    panel.querySelector('[data-action="selectSensory"]')?.addEventListener('change', (e) => {
      this._sceneSensory = e.target.value;
    });
    panel.querySelector('[data-action="selectDisposition"]')?.addEventListener('change', (e) => {
      this._sceneDisposition = e.target.value;
    });
    panel.querySelector('[data-action="selectStakes"]')?.addEventListener('change', (e) => {
      this._sceneStakes = e.target.value;
    });
    panel.querySelector('[data-action="selectCombat"]')?.addEventListener('change', (e) => {
      this._sceneCombat = e.target.value;
    });
    panel.querySelector('[data-action="selectTwist"]')?.addEventListener('change', (e) => {
      this._sceneTwist = e.target.value;
    });

    panel.querySelectorAll('.cgm-quickscene-type-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        this._sceneType = btn.dataset.type;
        // Re-render only the left column so the right column result is preserved
        const leftCol = panel.querySelector('.cgm-quickscene-left-col');
        if (leftCol) {
          leftCol.innerHTML = this._buildLeftColumnHTML();
          this._bindBodyEvents(leftCol);
        }
      });
    });

    this._bindBodyEvents(panel);
    this._bindDrag(panel);
  }

  _bindBodyEvents(container) {
    container.querySelector('[data-action="generateScene"]')?.addEventListener('click', () => {
      const type = this._sceneType === 'random'
        ? ['physical', 'social', 'mental'][Math.floor(Math.random() * 3)]
        : this._sceneType;
      this._lastScene = this._generateScene(type);
      const rightCol = this._panelEl?.querySelector('.cgm-quickscene-right-col');
      if (rightCol) {
        rightCol.innerHTML = this._buildRightColumnHTML();
        this._bindBodyEvents(rightCol);
      }
    });

    container.querySelector('[data-action="copyScene"]')?.addEventListener('click', () => {
      if (!this._lastScene) return;
      const s = this._lastScene;
      const tags = (item) => item && item.tags && item.tags.length ? ` [${item.tags.join(', ')}]` : '';
      const text = `QUICK SCENE — ${s.type.toUpperCase()}${s.place && s.place !== 'random' ? ' | ' + s.place.toUpperCase() : ''} (Diff ${s.difficultyValue}, TN ${s.difficultyValue * 3})
${s.tone && s.tone !== 'random' ? `Tone: ${s.tone.toUpperCase()}
` : ''}${s.time && s.time !== 'random' ? `Time: ${s.time.toUpperCase()}
` : ''}${s.weather && s.weather !== 'random' ? `Weather: ${s.weather.toUpperCase()}
` : ''}${s.scale && s.scale !== 'random' ? `Scale: ${s.scale.toUpperCase()}
` : ''}${s.sensory && s.sensory !== 'random' ? `Sensory Focus: ${s.sensory.toUpperCase()}
` : ''}${s.disposition && s.disposition !== 'random' ? `NPC Disposition: ${s.disposition.toUpperCase()}
` : ''}${s.stakes && s.stakes !== 'random' ? `Stakes: ${s.stakes.toUpperCase()}
` : ''}${s.combat && s.combat !== 'random' ? `Combat: ${s.combat.toUpperCase()}
` : ''}${s.twist && s.twist !== 'random' ? `Twist: ${s.twist.toUpperCase()}
` : ''}Setting: ${s.setting.text}${tags(s.setting)}
Objective: ${s.objective.text}${tags(s.objective)}
Complication: ${s.complication.text}${tags(s.complication)}
${s.npc ? `Key NPC: ${s.npc.text}${tags(s.npc)}
` : ''}Atmosphere: ${s.atmosphere.text}${tags(s.atmosphere)}
Time Pressure: ${s.timePressure.text}${tags(s.timePressure)}
Reward: ${s.reward.text}${tags(s.reward)}
GM Tip: ${s.gmTip.text}${tags(s.gmTip)}`;
      if (navigator.clipboard) {
        navigator.clipboard.writeText(text).then(() => {
          ui.notifications.info("Scene copied to clipboard!");
        }).catch(() => {
          ui.notifications.warn("Could not copy to clipboard.");
        });
      } else {
        ui.notifications.warn("Clipboard API not available.");
      }
    });

    container.querySelector('[data-action="regenerateScene"]')?.addEventListener('click', () => {
      const type = this._lastScene?.type || (this._sceneType === 'random'
        ? ['physical', 'social', 'mental'][Math.floor(Math.random() * 3)]
        : this._sceneType);
      this._lastScene = this._generateScene(type);
      const rightCol = this._panelEl?.querySelector('.cgm-quickscene-right-col');
      if (rightCol) {
        rightCol.innerHTML = this._buildRightColumnHTML();
        this._bindBodyEvents(rightCol);
      }
    });
  }

  /* ─── Drag Support ─── */

  _bindDrag(panel) {
    const header = panel.querySelector('.cgm-quickscene-panel-header');
    if (!header) return;

    header.addEventListener('mousedown', (e) => {
      if (e.target.closest('.cgm-quickscene-panel-close')) return;
      this._dragging = true;
      const rect = panel.getBoundingClientRect();
      this._dragOffset = { x: e.clientX - rect.left, y: e.clientY - rect.top };
      panel.style.transition = 'none';
    });

    document.addEventListener('mousemove', (e) => {
      if (!this._dragging) return;
      e.preventDefault();
      const x = e.clientX - this._dragOffset.x;
      const y = e.clientY - this._dragOffset.y;
      panel.style.left = `${x}px`;
      panel.style.top = `${y}px`;
      panel.style.right = 'auto';
    });

    document.addEventListener('mouseup', () => {
      if (!this._dragging) return;
      this._dragging = false;
      panel.style.transition = '';
    });
  }
}

// Export for global access
window.QuickSceneGenerator = QuickSceneGenerator;

/* ─── Lock Actor Sheets enforcement hook ─── */
Hooks.on("renderActorSheet", (app, html, data) => {
  if (game.user.isGM) return;
  try {
    if (!game.settings.get("cypher-gm-taskbar", "lockActorSheets")) return;
  } catch { return; }
  const actor = app.actor || app.document;
  if (!actor) return;
  // Only block sheets for actors the player owns
  if (!actor.isOwner) return;
  // Hide immediately so the sheet never becomes visible, then close silently
  const el = html?.[0] || html;
  if (el?.style) el.style.display = "none";
  if (el?.classList) el.classList.add("cgm-sheet-blocked");
  app.close({ force: true });
});

