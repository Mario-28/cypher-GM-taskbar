/**
 * Group Statuses Menu for Cypher GM Taskbar
 * Extracted standalone module using same philosophy as GM Group Roll Request
 */

class GroupStatusesMenu {
  constructor(taskbar) {
    this.taskbar = taskbar;
    this._menuEl = null;
    this._effectsEl = null;
    this._attributeEl = null;
    this._healthEl = null;
    this._confirmEl = null;
    this._pending = null;
    this._btnEl = null;
  }

  /* ═══════════════════════════════════════════════════════════
     PUBLIC API
     ═══════════════════════════════════════════════════════════ */

  toggle(btnEl) {
    this._btnEl = btnEl;
    if (this._menuEl) { this.hide(); return; }
    this.taskbar._hideRadialMenu();
    this.taskbar._hideGMGroupRollMenu();
    this._showMainMenu();
  }

  hide() {
    this._hideMainMenu();
    this._hideEffectsMenu();
    this._hideAttributeMenu();
    this._hideHealthMenu();
    this._hideConfirm();
  }

  /* ═══════════════════════════════════════════════════════════
     MAIN MENU
     ═══════════════════════════════════════════════════════════ */

  _showMainMenu() {
    const size = 180;
    const half = size / 2;
    const outerR = half - 6;
    const innerR = outerR * 0.35;
    const gap = 2;
    const segCount = 3;
    const segments = [
      { action: "changeStatus", icon: "fa-bolt", label: "Change\nStatus", colorClass: "cgm-gstatus-seg-status" },
      { action: "changeAttribute", icon: "fa-hand-fist", label: "Change\nAttribute", colorClass: "cgm-gstatus-seg-attr" },
      { action: "changeHealth", icon: "fa-heart-pulse", label: "Change\nHealth", colorClass: "cgm-gstatus-seg-health" },
    ];

    let svgPaths = "";
    segments.forEach((seg, i) => {
      const startAngle = i * (360 / segCount) + gap / 2;
      const endAngle = (i + 1) * (360 / segCount) - gap / 2;
      const d = this._pieWedgePath(startAngle, endAngle, innerR, outerR);
      svgPaths += `<path class="cgm-pie-seg ${seg.colorClass}" data-action="${seg.action}" d="${d}" />`;
    });

    let labelsHtml = "";
    segments.forEach((seg, i) => {
      const midAngle = (i * (360 / segCount) + ((i + 1) * (360 / segCount))) / 2;
      const rad = (midAngle - 90) * Math.PI / 180;
      const labelR = (innerR + outerR) / 2;
      const lx = Math.cos(rad) * labelR + half;
      const ly = Math.sin(rad) * labelR + half;
      const lines = seg.label.split("\n");
      const labelText = lines.map(l => `<span class="cgm-gstatus-line">${l}</span>`).join("");
      labelsHtml += `
        <div class="cgm-pie-label cgm-gstatus-label" data-action="${seg.action}" style="left:${lx.toFixed(1)}px;top:${ly.toFixed(1)}px;">
          <i class="fas ${seg.icon}"></i>
          <span class="cgm-gstatus-text">${labelText}</span>
        </div>
      `;
    });

    const menu = document.createElement("div");
    menu.className = "cgm-radial-menu cgm-gstatus-main";
    menu.style.width = `${size}px`;
    menu.style.height = `${size}px`;

    // Position — check saved position first, then auto-detect
    const btnEl = this._btnEl;
    const savedPos = this.taskbar._loadMenuPosition("groupStatus_main");
    if (savedPos) {
      menu.style.left = `${Math.max(0, Math.min(savedPos.left, window.innerWidth - size))}px`;
      menu.style.top = `${Math.max(0, Math.min(savedPos.top, window.innerHeight - size))}px`;
    } else {
      const rect = btnEl.getBoundingClientRect();
      if (!rect || rect.width === 0 || rect.height === 0) { console.warn("Group Statuses button rect empty"); return; }
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
        menuLeft = (window.innerWidth - size) / 2;
      }
      menu.style.left = `${Math.max(0, Math.min(menuLeft, window.innerWidth - size))}px`;
      menu.style.top = `${Math.max(0, Math.min(menuTop, window.innerHeight - size))}px`;
    }

    menu.innerHTML = `
      <svg class="cgm-pie-svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" style="overflow:visible;transform:translate(${half}px,${half}px);">
        <defs>
          <radialGradient id="cgm-gstatus-bg" cx="0" cy="0" r="${outerR}">
            <stop offset="0%" stop-color="rgba(20,22,35,0.3)" />
            <stop offset="100%" stop-color="rgba(15,17,30,0.95)" />
          </radialGradient>
        </defs>
        <circle cx="0" cy="0" r="${outerR}" fill="url(#cgm-gstatus-bg)" stroke="rgba(212,175,55,0.5)" stroke-width="1.5" />
        ${svgPaths}
        <circle cx="0" cy="0" r="${innerR - 2}" fill="rgba(15,17,30,0.98)" stroke="rgba(212,175,55,0.6)" stroke-width="1.5" />
      </svg>
      ${labelsHtml}
      <div class="cgm-gstatus-close-btn" title="Close menu">
        <i class="fas fa-droplet"></i>
      </div>
    `;

    document.body.appendChild(menu);
    this._menuEl = menu;
    requestAnimationFrame(() => menu.classList.add("cgm-radial-visible"));
    this.taskbar._makeMenuDraggable?.(menu, "groupStatus_main");

    // Draw line from button to menu
    requestAnimationFrame(() => {
      const btnRect = btnEl.getBoundingClientRect();
      const menuRect = menu.getBoundingClientRect();
      this._createLine("cgm-gstatus-line-main",
        btnRect.left + btnRect.width / 2, btnRect.top + btnRect.height / 2,
        menuRect.left + menuRect.width / 2, menuRect.top + menuRect.height / 2);
    });

    this._attachInteractions(menu, segments.map(s => s.action), (action) => {
      if (action === "changeStatus") this._showEffectsMenu();
      else if (action === "changeAttribute") this._showAttributeMenu();
      else if (action === "changeHealth") this._showHealthMenu();
    });

    // Click center drop to close
    menu.querySelector(".cgm-gstatus-close-btn")?.addEventListener("click", (e) => {
      e.stopPropagation();
      this.hide();
    });

    // Close on outside click — but NOT when clicking in submenus
    const closeHandler = (e) => {
      const inSubmenu = this._effectsEl?.contains(e.target) ||
                        this._attributeEl?.contains(e.target) ||
                        this._healthEl?.contains(e.target) ||
                        this._confirmEl?.contains(e.target);
      if (!menu.contains(e.target) && e.target !== btnEl && !inSubmenu) {
        this.hide();
        document.removeEventListener("click", closeHandler);
      }
    };
    setTimeout(() => document.addEventListener("click", closeHandler), 10);
  }

  _hideMainMenu() {
    if (this._menuEl) {
      this._menuEl.classList.remove("cgm-radial-visible");
      setTimeout(() => { this._menuEl?.remove(); this._menuEl = null; }, 200);
    }
    this._removeLine("cgm-gstatus-line-main");
  }

  /* ═══════════════════════════════════════════════════════════
     SUBMENUS
     ═══════════════════════════════════════════════════════════ */

  _showEffectsMenu() {
    if (this._effectsEl) { this._hideEffectsMenu(); return; }

    const effects = [
      { key: "dead", label: "Dead", icon: "fa-skull" },
      { key: "prone", label: "Prone", icon: "fa-person-falling" },
      { key: "stunned", label: "Stunned", icon: "fa-star" },
      { key: "poisoned", label: "Poisoned", icon: "fa-biohazard" },
      { key: "blinded", label: "Blinded", icon: "fa-eye-slash" },
      { key: "deafened", label: "Deafened", icon: "fa-ear-deaf" },
      { key: "restrained", label: "Restrained", icon: "fa-link" },
      { key: "unconscious", label: "Unconscious", icon: "fa-bed" },
    ];
    this._buildSubMenu(effects, "status", (key) => {
      this._pending = { type: "status", key };
      this._showConfirm();
    });
  }

  _hideEffectsMenu() {
    if (this._effectsEl) {
      this._effectsEl.classList.remove("cgm-radial-visible");
      setTimeout(() => { this._effectsEl?.remove(); this._effectsEl = null; }, 200);
    }
    this._removeLine("cgm-gstatus-line-status");
  }

  _showAttributeMenu() {
    if (this._attributeEl) { this._hideAttributeMenu(); return; }

    // Track accumulated deltas for each pool
    this._pendingDeltas = { might: 0, speed: 0, intellect: 0 };

    // Pool definitions
    const pools = [
      { key: "might",     icon: "fa-dumbbell", label: "Might",     cls: "might",     color: "#cc4444" },
      { key: "speed",     icon: "fa-bolt",     label: "Speed",     cls: "speed",     color: "#44aa44" },
      { key: "intellect", icon: "fa-brain",    label: "Intellect", cls: "intellect", color: "#4488cc" },
    ];

    // Build the submenu
    const subSize = 160;
    const subHalf = subSize / 2;
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
      svgPaths += `<path class="cgm-pie-seg cgm-pie-seg-${seg.cls}" data-pool="${seg.key}" d="${d}" />`;

      // Label at outer edge
      const midAngle = (startAngle + endAngle) / 2;
      const midRad = (midAngle - 90) * Math.PI / 180;
      const labelR = outerR * 0.85;
      const lx = Math.cos(midRad) * labelR + subHalf;
      const ly = Math.sin(midRad) * labelR + subHalf;
      labelsHtml += `
        <div class="cgm-pools-label cgm-pools-label-${seg.cls}" data-pool="${seg.key}"
             style="left:${lx.toFixed(1)}px;top:${ly.toFixed(1)}px;">
          <i class="fas ${seg.icon}"></i>
          <span>${seg.label}</span>
        </div>
      `;

      // Adjuster: +/- buttons with accumulated delta display
      const adjR = (innerR + outerR) * 0.5;
      const ax = Math.cos(midRad) * adjR + subHalf;
      const ay = Math.sin(midRad) * adjR + subHalf;
      adjustersHtml += `
        <div class="cgm-pools-adjuster cgm-pools-adjuster-${seg.cls} cgm-gstatus-adjuster" data-pool="${seg.key}"
             style="left:${ax.toFixed(1)}px;top:${ay.toFixed(1)}px;">
          <div class="cgm-pools-adj-name" style="color:${seg.color};">${seg.label}</div>
          <div class="cgm-gstatus-delta" data-pool="${seg.key}">0</div>
          <div class="cgm-pools-adj-controls">
            <button class="cgm-pools-adj-btn" data-pool="${seg.key}" data-delta="-1">−</button>
            <button class="cgm-pools-adj-btn" data-pool="${seg.key}" data-delta="+1">+</button>
          </div>
        </div>
      `;
    });

    const centerBtn = `<div class="cgm-sub-center-btn cgm-gstatus-confirm-btn" title="Apply changes"><i class="fas fa-check"></i></div>`;

    const subMenu = document.createElement("div");
    subMenu.className = "cgm-pools-submenu cgm-gstatus-pools";
    subMenu.style.cssText = `position:fixed;width:${subSize}px;height:${subSize}px;z-index:202;`;

    // Position
    const savedPos = this.taskbar._loadMenuPosition("groupStatus_attribute");
    if (savedPos) {
      subMenu.style.left = `${Math.max(0, Math.min(savedPos.left, window.innerWidth - subSize))}px`;
      subMenu.style.top = `${Math.max(0, Math.min(savedPos.top, window.innerHeight - subSize))}px`;
    } else {
      const mainRect = this._menuEl?.getBoundingClientRect();
      if (mainRect) {
        const mainCx = mainRect.left + mainRect.width / 2;
        const mainCy = mainRect.top + mainRect.height / 2;
        subMenu.style.left = `${Math.max(8, Math.min(mainCx + 100, window.innerWidth - subSize - 8))}px`;
        subMenu.style.top = `${Math.max(8, Math.min(mainCy - subHalf, window.innerHeight - subSize - 8))}px`;
      } else {
        subMenu.style.left = `${(window.innerWidth - subSize) / 2}px`;
        subMenu.style.top = `${(window.innerHeight - subSize) / 2}px`;
      }
    }

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
    this._attributeEl = subMenu;

    requestAnimationFrame(() => subMenu.classList.add("cgm-pools-visible"));
    this.taskbar._makeMenuDraggable?.(subMenu, "groupStatus_attribute");

    // Draw line from main menu to submenu
    requestAnimationFrame(() => {
      const mainRect = this._menuEl?.getBoundingClientRect();
      const menuRect = subMenu.getBoundingClientRect();
      if (mainRect) {
        this._createLine("cgm-gstatus-line-attribute",
          mainRect.left + mainRect.width / 2, mainRect.top + mainRect.height / 2,
          menuRect.left + menuRect.width / 2, menuRect.top + menuRect.height / 2);
      }
    });

    // ── Handlers ──
    subMenu.querySelectorAll(".cgm-pools-adj-btn").forEach(btn => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const pool = btn.dataset.pool;
        const delta = parseInt(btn.dataset.delta, 10);
        this._pendingDeltas[pool] += delta;
        const deltaEl = subMenu.querySelector(`.cgm-gstatus-delta[data-pool="${pool}"]`);
        if (deltaEl) {
          const val = this._pendingDeltas[pool];
          deltaEl.textContent = val > 0 ? `+${val}` : `${val}`;
          deltaEl.style.color = val > 0 ? "#44aa44" : val < 0 ? "#cc4444" : "#aaaaaa";
        }
      });
    });

    // Confirm button → open actor selection dialog
    const confirmBtn = subMenu.querySelector(".cgm-gstatus-confirm-btn");
    if (confirmBtn) {
      confirmBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        this._showAttributeConfirm();
      });
    }

    // Note: submenu stays open until confirm button is clicked
  }

  _showAttributeConfirm() {
    const pcs = game.actors.filter(a => a.type === "pc" && a.hasPlayerOwner);
    const deltas = this._pendingDeltas || {};
    const hasChanges = Object.values(deltas).some(v => v !== 0);
    if (!hasChanges) {
      ui.notifications.info("No changes to apply.");
      return;
    }

    // Build summary of changes
    const changeSummary = [];
    if (deltas.might) changeSummary.push(`Might ${deltas.might > 0 ? "+" : ""}${deltas.might}`);
    if (deltas.speed) changeSummary.push(`Speed ${deltas.speed > 0 ? "+" : ""}${deltas.speed}`);
    if (deltas.intellect) changeSummary.push(`Intellect ${deltas.intellect > 0 ? "+" : ""}${deltas.intellect}`);

    let content = `
      <div class="cgm-confirm-dialog">
        <h3>Apply Attribute Changes</h3>
        <p class="cgm-confirm-subtitle" style="color:#c8a96e;font-size:12px;margin-bottom:8px;">${changeSummary.join(" | ")}</p>
        <p class="cgm-confirm-subtitle">Select actors to apply:</p>
        <div class="cgm-confirm-actors">
    `;
    pcs.forEach(actor => {
      content += `
        <label class="cgm-confirm-actor">
          <input type="checkbox" name="actor" value="${actor.id}" checked />
          <span class="cgm-confirm-check"></span>
          <img src="${actor.img}" alt="" />
          <span>${actor.name}</span>
        </label>
      `;
    });
    content += `
        </div>
        <label class="cgm-confirm-all">
          <input type="checkbox" id="cgm-confirm-all" checked />
          <span>Apply to ALL players</span>
        </label>
        <div class="cgm-confirm-actions">
          <button class="cgm-confirm-btn cgm-confirm-cancel" data-action="cancel"><i class="fas fa-times"></i> Cancel</button>
          <button class="cgm-confirm-btn cgm-confirm-ok" data-action="confirm"><i class="fas fa-check"></i> Confirm</button>
        </div>
      </div>
    `;

    const dlg = document.createElement("div");
    dlg.className = "cgm-groupstatus-confirm";
    dlg.innerHTML = content;
    document.body.appendChild(dlg);
    this._confirmEl = dlg;
    requestAnimationFrame(() => dlg.classList.add("cgm-confirm-visible"));

    // ALL checkbox
    const allCheckbox = dlg.querySelector("#cgm-confirm-all");
    const actorCheckboxes = dlg.querySelectorAll('input[name="actor"]');
    allCheckbox?.addEventListener("change", (e) => {
      actorCheckboxes.forEach(cb => cb.checked = e.target.checked);
    });

    // Cancel
    dlg.querySelector('[data-action="cancel"]')?.addEventListener("click", () => {
      this._hideConfirm();
    });

    // Confirm
    dlg.querySelector('[data-action="confirm"]')?.addEventListener("click", () => {
      const selectedIds = Array.from(actorCheckboxes).filter(cb => cb.checked).map(cb => cb.value);
      const targetIds = allCheckbox?.checked || selectedIds.length === 0 ? pcs.map(a => a.id) : selectedIds;
      this._applyAttributeChanges(targetIds, deltas);
      this._hideConfirm();
      this._hideAttributeMenu();
      this.hide();
    });

    // Outside click
    const closeHandler = (e) => {
      if (!dlg.contains(e.target)) {
        this._hideConfirm();
        document.removeEventListener("click", closeHandler);
      }
    };
    setTimeout(() => document.addEventListener("click", closeHandler), 10);
  }

  _applyAttributeChanges(actorIds, deltas) {
    const actors = actorIds.map(id => game.actors.get(id)).filter(a => a);
    const changes = [];
    if (deltas.might) changes.push(`Might ${deltas.might > 0 ? "+" : ""}${deltas.might}`);
    if (deltas.speed) changes.push(`Speed ${deltas.speed > 0 ? "+" : ""}${deltas.speed}`);
    if (deltas.intellect) changes.push(`Intellect ${deltas.intellect > 0 ? "+" : ""}${deltas.intellect}`);

    actors.forEach(actor => {
      const updates = {};
      ["might", "speed", "intellect"].forEach(pool => {
        if (deltas[pool]) {
          const sys = actor.system ?? {};
          const poolObj = sys.pools?.[pool];
          if (poolObj) {
            const current = Number(poolObj.value ?? 0);
            const maxVal = Number(poolObj.max ?? current);
            const newVal = Math.max(0, Math.min(maxVal, current + deltas[pool]));
            updates[`system.pools.${pool}.value`] = newVal;
          }
        }
      });
      if (Object.keys(updates).length > 0) {
        actor.update(updates);
      }
    });

    const names = actors.map(a => a.name).join(", ");
    ui.notifications.info(`<b>Attribute Changes</b> (${changes.join(" | ")}) applied to: ${names || "No actors"}`);
  }

  _hideAttributeMenu() {
    if (this._attributeEl) {
      this._attributeEl.classList.remove("cgm-radial-visible");
      setTimeout(() => { this._attributeEl?.remove(); this._attributeEl = null; }, 200);
    }
    this._removeLine("cgm-gstatus-line-attribute");
  }

  _showHealthMenu() {
    if (this._healthEl) { this._hideHealthMenu(); return; }

    const healths = [
      { key: "hale", label: "Hale", icon: "fa-heart" },
      { key: "debilitated", label: "Debilitated", icon: "fa-heart-crack" },
      { key: "incapacitated", label: "Incapacitated", icon: "fa-skull-crossbones" },
    ];
    this._buildSubMenu(healths, "health", (key) => {
      this._pending = { type: "health", key };
      this._showConfirm();
    });
  }

  _hideHealthMenu() {
    if (this._healthEl) {
      this._healthEl.classList.remove("cgm-radial-visible");
      setTimeout(() => { this._healthEl?.remove(); this._healthEl = null; }, 200);
    }
    this._removeLine("cgm-gstatus-line-health");
  }

  /* ═══════════════════════════════════════════════════════════
     SUBMENU BUILDER
     ═══════════════════════════════════════════════════════════ */

  _buildSubMenu(items, type, onSelect) {
    const size = 160;
    const half = size / 2;
    const outerR = half - 6;
    const innerR = outerR * 0.32;
    const gap = 2;
    const segCount = items.length;

    let svgPaths = "";
    items.forEach((item, i) => {
      const startAngle = i * (360 / segCount) + gap / 2;
      const endAngle = (i + 1) * (360 / segCount) - gap / 2;
      const d = this._pieWedgePath(startAngle, endAngle, innerR, outerR);
      svgPaths += `<path class="cgm-pie-seg cgm-gstatus-seg-neutral" data-key="${item.key}" d="${d}" />`;
    });

    let labelsHtml = "";
    items.forEach((item, i) => {
      const midAngle = (i * (360 / segCount) + ((i + 1) * (360 / segCount))) / 2;
      const rad = (midAngle - 90) * Math.PI / 180;
      const labelR = (innerR + outerR) / 2;
      const lx = Math.cos(rad) * labelR + half;
      const ly = Math.sin(rad) * labelR + half;
      const lines = item.label.split("\n");
      const labelText = lines.map(l => `<span class="cgm-gstatus-line">${l}</span>`).join("");
      labelsHtml += `
        <div class="cgm-pie-label cgm-gstatus-sub-label" data-key="${item.key}" style="left:${lx.toFixed(1)}px;top:${ly.toFixed(1)}px;">
          <i class="fas ${item.icon}"></i>
          <span class="cgm-gstatus-text">${labelText}</span>
        </div>
      `;
    });

    const menu = document.createElement("div");
    menu.className = "cgm-radial-menu cgm-gstatus-sub";
    menu.style.width = `${size}px`;
    menu.style.height = `${size}px`;

    // Position — check saved position first, then relative to main menu
    const savedPos = this.taskbar._loadMenuPosition(`groupStatus_${type}`);
    if (savedPos) {
      menu.style.left = `${Math.max(0, Math.min(savedPos.left, window.innerWidth - size))}px`;
      menu.style.top = `${Math.max(0, Math.min(savedPos.top, window.innerHeight - size))}px`;
    } else {
      const mainRect = this._menuEl?.getBoundingClientRect();
      if (mainRect) {
        const mainCx = mainRect.left + mainRect.width / 2;
        const mainCy = mainRect.top + mainRect.height / 2;
        const spaceAbove = mainCy - size / 2;
        const spaceBelow = window.innerHeight - mainCy - size / 2;
        let menuLeft = mainCx - half;
        let menuTop;
        if (spaceAbove >= size + 10 && spaceAbove >= spaceBelow) {
          menuTop = mainRect.top - size - 10;
        } else if (spaceBelow >= size + 10) {
          menuTop = mainRect.bottom + 10;
        } else {
          menuTop = mainCy - half;
          menuLeft = mainRect.right + 10;
        }
        menu.style.left = `${Math.max(0, Math.min(menuLeft, window.innerWidth - size))}px`;
        menu.style.top = `${Math.max(0, Math.min(menuTop, window.innerHeight - size))}px`;
      } else {
        menu.style.left = `${(window.innerWidth - size) / 2}px`;
        menu.style.top = `${(window.innerHeight - size) / 2}px`;
      }
    }

    menu.innerHTML = `
      <svg class="cgm-pie-svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" style="overflow:visible;transform:translate(${half}px,${half}px);">
        <defs>
          <radialGradient id="cgm-gstatus-bg-sub" cx="0" cy="0" r="${outerR}">
            <stop offset="0%" stop-color="rgba(20,22,35,0.3)" />
            <stop offset="100%" stop-color="rgba(15,17,30,0.95)" />
          </radialGradient>
        </defs>
        <circle cx="0" cy="0" r="${outerR}" fill="url(#cgm-gstatus-bg-sub)" stroke="rgba(212,175,55,0.4)" stroke-width="1.5" />
        ${svgPaths}
        <circle cx="0" cy="0" r="${innerR - 2}" fill="rgba(15,17,30,0.98)" stroke="rgba(212,175,55,0.5)" stroke-width="1.5" />
      </svg>
      ${labelsHtml}
      <div class="cgm-gmroll-back" data-action="backToGroupStatus" title="Back">
        <i class="fas fa-arrow-left"></i>
      </div>
    `;

    document.body.appendChild(menu);
    const propName = type === "status" ? "_effectsEl" : type === "attribute" ? "_attributeEl" : "_healthEl";
    this[propName] = menu;
    requestAnimationFrame(() => menu.classList.add("cgm-radial-visible"));
    this.taskbar._makeMenuDraggable?.(menu, `groupStatus_${type}`);

    // Draw line from main menu to submenu
    requestAnimationFrame(() => {
      const mainRect = this._menuEl?.getBoundingClientRect();
      const menuRect = menu.getBoundingClientRect();
      if (mainRect) {
        this._createLine(`cgm-gstatus-line-${type}`,
          mainRect.left + mainRect.width / 2, mainRect.top + mainRect.height / 2,
          menuRect.left + menuRect.width / 2, menuRect.top + menuRect.height / 2);
      }
    });

    // Back button
    const backBtn = menu.querySelector(".cgm-gmroll-back");
    if (backBtn) {
      backBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        if (type === "status") this._hideEffectsMenu();
        else if (type === "attribute") this._hideAttributeMenu();
        else this._hideHealthMenu();
        this._showMainMenu();
      });
    }

    // Item click handlers
    const segs = menu.querySelectorAll(".cgm-pie-seg");
    const lbls = menu.querySelectorAll(".cgm-pie-label");

    const onItemClick = (e) => {
      e.stopPropagation();
      const key = e.currentTarget.dataset.key;
      const item = items.find(it => it.key === key);
      onSelect(key, item);
    };
    segs.forEach(s => s.addEventListener("click", onItemClick));
    lbls.forEach(l => l.addEventListener("click", onItemClick));

    // Close on outside click
    const closeHandler = (e) => {
      if (!menu.contains(e.target) && !this._menuEl?.contains(e.target) && e.target !== this._btnEl) {
        if (type === "status") this._hideEffectsMenu();
        else if (type === "attribute") this._hideAttributeMenu();
        else this._hideHealthMenu();
        this.hide();
        document.removeEventListener("click", closeHandler);
      }
    };
    setTimeout(() => document.addEventListener("click", closeHandler), 10);
  }

  /* ═══════════════════════════════════════════════════════════
     CONFIRM DIALOG
     ═══════════════════════════════════════════════════════════ */

  _showConfirm() {
    if (!this._pending) return;
    this.hide();

    const pending = this._pending;
    const pcs = game.actors.filter(a => a.type === "pc" && a.hasPlayerOwner);
    const typeLabels = { status: "Apply Status", attribute: "Change Attribute", health: "Set Health" };
    const actionLabel = typeLabels[pending.type] || "Apply";

    let content = `
      <div class="cgm-confirm-dialog">
        <h3>${actionLabel}: ${pending.key}</h3>
        <p class="cgm-confirm-subtitle">Select actors to apply:</p>
        <div class="cgm-confirm-actors">
    `;
    pcs.forEach(actor => {
      content += `
        <label class="cgm-confirm-actor">
          <input type="checkbox" name="actor" value="${actor.id}" checked />
          <span class="cgm-confirm-check"></span>
          <img src="${actor.img}" alt="" />
          <span>${actor.name}</span>
        </label>
      `;
    });
    content += `
        </div>
        <label class="cgm-confirm-all">
          <input type="checkbox" id="cgm-confirm-all" checked />
          <span>Apply to ALL players</span>
        </label>
        <div class="cgm-confirm-actions">
          <button class="cgm-confirm-btn cgm-confirm-cancel" data-action="cancel"><i class="fas fa-times"></i> Cancel</button>
          <button class="cgm-confirm-btn cgm-confirm-ok" data-action="confirm"><i class="fas fa-check"></i> Confirm</button>
        </div>
      </div>
    `;

    const dlg = document.createElement("div");
    dlg.className = "cgm-groupstatus-confirm";
    dlg.innerHTML = content;
    document.body.appendChild(dlg);
    this._confirmEl = dlg;
    requestAnimationFrame(() => dlg.classList.add("cgm-confirm-visible"));

    // ALL checkbox
    const allCheckbox = dlg.querySelector("#cgm-confirm-all");
    const actorCheckboxes = dlg.querySelectorAll('input[name="actor"]');
    allCheckbox?.addEventListener("change", (e) => {
      actorCheckboxes.forEach(cb => cb.checked = e.target.checked);
    });

    // Cancel
    dlg.querySelector('[data-action="cancel"]')?.addEventListener("click", () => {
      this._hideConfirm();
      this._pending = null;
    });

    // Confirm
    dlg.querySelector('[data-action="confirm"]')?.addEventListener("click", () => {
      const selectedIds = Array.from(actorCheckboxes).filter(cb => cb.checked).map(cb => cb.value);
      if (allCheckbox?.checked || selectedIds.length === 0) {
        this._applyStatus(pending, pcs.map(a => a.id));
      } else {
        this._applyStatus(pending, selectedIds);
      }
      this._hideConfirm();
      this._pending = null;
    });

    // Outside click
    const closeHandler = (e) => {
      if (!dlg.contains(e.target)) {
        this._hideConfirm();
        this._pending = null;
        document.removeEventListener("click", closeHandler);
      }
    };
    setTimeout(() => document.addEventListener("click", closeHandler), 10);
  }

  _hideConfirm() {
    if (this._confirmEl) {
      this._confirmEl.classList.remove("cgm-confirm-visible");
      setTimeout(() => { this._confirmEl?.remove(); this._confirmEl = null; }, 200);
    }
  }

  _applyStatus(pending, actorIds) {
    const actors = actorIds.map(id => game.actors.get(id)).filter(a => a);
    const typeLabels = { status: { key: "status", label: "Status" }, attribute: { key: "attribute", label: "Attribute" }, health: { key: "health", label: "Health" } };
    const typeInfo = typeLabels[pending.type];

    actors.forEach(actor => {
      if (pending.type === "status") {
        const effect = CONFIG.statusEffects?.find(se => se.id === pending.key);
        if (effect) actor.toggleStatusEffect(pending.key);
      } else if (pending.type === "attribute") {
        const pool = actor.system?.pools?.[pending.data.attr];
        if (pool) {
          const change = pending.data.dir === "up" ? 1 : -1;
          const current = pool.value || 0;
          const max = pool.max || current;
          const newVal = Math.max(0, Math.min(current + change, max));
          actor.update({ [`system.pools.${pending.data.attr}.value`]: newVal });
        }
      } else if (pending.type === "health") {
        const healthStates = { hale: 0, debilitated: 1, incapacitated: 2 };
        const stateValue = healthStates[pending.key] ?? 0;
        actor.update({ "system.health.status": stateValue });
      }
    });

    const names = actors.map(a => a.name).join(", ");
    ui.notifications.info(`<b>Group ${typeInfo.label}</b> applied to: ${names || "No actors"}`);

    if (game.socket) {
      game.socket.emit("module.cypher-gm-taskbar", {
        action: "groupStatusUpdate",
        type: pending.type,
        key: pending.key,
        actorIds,
        gmId: game.user.id,
      });
    }
  }

  /* ═══════════════════════════════════════════════════════════
     LINES (like GM Group Roll)
     ═══════════════════════════════════════════════════════════ */

  _createLine(id, x1, y1, x2, y2) {
    let svg = document.getElementById(id);
    if (!svg) {
      svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      svg.id = id;
      svg.style.cssText = "position:fixed;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:150;";
      document.body.appendChild(svg);
    }
    svg.innerHTML = `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="rgba(212,175,55,0.5)" stroke-width="2" stroke-dasharray="4,3" />`;
  }

  _removeLine(id) {
    const el = document.getElementById(id);
    if (el) el.remove();
  }

  _removeAllLines() {
    ["cgm-gstatus-line-main", "cgm-gstatus-line-status", "cgm-gstatus-line-attribute", "cgm-gstatus-line-health"].forEach(id => this._removeLine(id));
  }

  /* ═══════════════════════════════════════════════════════════
     HELPERS
     ═══════════════════════════════════════════════════════════ */

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

  _attachInteractions(menu, actions, onClick) {
    const segs = menu.querySelectorAll(".cgm-pie-seg");
    const lbls = menu.querySelectorAll(".cgm-pie-label");

    const onSegEnter = (i) => {
      segs[i]?.classList.add("cgm-pie-seg-hover");
      lbls[i]?.classList.add("cgm-pie-label-active");
    };
    const onSegLeave = (i) => {
      segs[i]?.classList.remove("cgm-pie-seg-hover");
      lbls[i]?.classList.remove("cgm-pie-label-active");
    };

    segs.forEach((seg, i) => {
      seg.addEventListener("mouseenter", () => onSegEnter(i));
      seg.addEventListener("mouseleave", () => onSegLeave(i));
    });
    lbls.forEach((lbl, i) => {
      lbl.addEventListener("mouseenter", () => onSegEnter(i));
      lbl.addEventListener("mouseleave", () => onSegLeave(i));
    });

    const onSegClick = (e) => {
      e.stopPropagation();
      const action = e.currentTarget.dataset.action;
      onClick(action);
    };
    segs.forEach(s => s.addEventListener("click", onSegClick));
    lbls.forEach(l => l.addEventListener("click", onSegClick));
  }
}
