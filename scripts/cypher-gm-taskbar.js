/**
 * Cypher GM Taskbar v3.17.21
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
    this._xpCircleSize = 16;
    this._xpCircleOffsetX = 0;
    this._xpCircleOffsetY = 4;
    this._settingsTab = "general";
    this._autoHideTimer = null;
    this._isHidden = false;
    this._connInterval = null;
    this._actorNotes = {};
    this._radialMenuEl = null;
    this._tooltipEl = null;
    this._tooltipTimer = null;
    this._radialMenuSize = 200;
    this._radialMenuOffset = 20;
    this._notesPanelEl = null;
    // Section settings (extensible for multiple sections)
    this._sections = [
      { id: "section1", name: "SECTION 1", width: 10, bgColor: "#ffffff", bgOpacity: 30 }
    ];
    this._notesPanelPos = null;
    this._notesLineStart = null;
    this._targetPanelEl = null;
    this._targetPanelPos = null;
    this._targetLineStart = null;
    this._damagePanelEl = null;
    this._damagePanelPos = null;
    this._damageLineStart = null;
    this._recoveryPanelEl = null;
    this._recoveryPanelPos = null;
    this._recoveryLineStart = null;
    this._cyphersPanelEl = null;
    this._cyphersPanelPos = null;
    this._cyphersLineStart = null;
    this._notesSubMenuEl = null;
    this._targetSubMenuEl = null;
    this._damageSubMenuEl = null;
    this._recoverySubMenuEl = null;
    this._cyphersSubMenuEl = null;
    this._subMenuPositions = {};
    this._lastDifficulty = 0;
    this._loadSettings();
    this._loadActorNotes();
    this._loadPanelPositions();
  }

  /* Load saved panel positions from localStorage */
  _loadPanelPositions() {
    try {
      const data = JSON.parse(localStorage.getItem("cgm-panel-positions") || "{}");
      this._notesPanelPos = data.notes || null;
      this._targetPanelPos = data.target || null;
      this._damagePanelPos = data.damage || null;
      this._recoveryPanelPos = data.recovery || null;
      this._cyphersPanelPos = data.cyphers || null;
      this._subMenuPositions = data.subMenus || {};
    } catch {}
  }

  /* Save panel positions to localStorage */
  _savePanelPositions() {
    try {
      const data = {
        notes: this._notesPanelPos,
        target: this._targetPanelPos,
        damage: this._damagePanelPos,
        recovery: this._recoveryPanelPos,
        cyphers: this._cyphersPanelPos,
        subMenus: this._subMenuPositions,
      };
      localStorage.setItem("cgm-panel-positions", JSON.stringify(data));
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
    try { return game.settings.get(MODULE_ID, key); } catch { return fallback; }
  }

  async _ss(key, value) {
    try { await game.settings.set(MODULE_ID, key, value); } catch (e) { console.warn(`${MODULE_ID} | Failed to save setting "${key}":`, e); }
  }

  _loadSettings() {
    this._dock = this._gs("dock", "bottom");
    this._opacity = this._gs("opacity", 100);
    this._compact = this._gs("compact", false);
    this._notes = this._gs("notes", "");
    this._globalDifficulty = this._gs("globalDifficulty", 4);
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
    this._xpCircleSize = this._gs("xpCircleSize", 16);
    this._xpCircleOffsetX = this._gs("xpCircleOffsetX", 0);
    this._xpCircleOffsetY = this._gs("xpCircleOffsetY", 4);
    this._radialMenuSize = this._gs("radialMenuSize", 200);
    this._radialMenuOffset = this._gs("radialMenuOffset", 20);
    // Load SECTION 1 settings
    this._sections[0].width = this._gs("sectionWidth", 10);
    this._sections[0].bgColor = this._gs("sectionBgColor", "#ffffff");
    this._sections[0].bgOpacity = this._gs("sectionBgOpacity", 30);
    this._settingsTab = "general";
  }

  /* ─── Render ─── */

  render() {
    document.querySelector(`#${MODULE_ID}-bar`)?.remove();
    document.querySelector(`.cgm-panel`)?.remove();
    if (this._connInterval) clearInterval(this._connInterval);
    if (this._autoHideTimer) clearTimeout(this._autoHideTimer);

    const bar = document.createElement("div");
    bar.id = `${MODULE_ID}-bar`;
    bar.classList.add("cgm-taskbar");
    bar.classList.add(this._dock === "top" ? "cgm-pos-top" : "cgm-pos-bottom");
    if (!this._locked) bar.classList.add("cgm-autohide");
    bar.innerHTML = this._buildHTML();
    document.body.appendChild(bar);
    this.element = bar;

    this._applySettings();
    this._bindEvents();
    this._bindPortraitEvents();
    this._startConnectionMonitor();
    this._setupAutoHide();

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

  /* ─── HTML Builder ─── */

  _buildHTML() {
    const connStatus = this._getConnectionStatus();
    const lockIcon = this._locked ? "fa-lock" : "fa-lock-open";
    const lockTitle = this._locked ? "Taskbar locked (visible)" : "Taskbar unlocked (auto-hide)";
    const gd = this._globalDifficulty;
    const tn = gd * 3;

    return `
      <!-- Floating player portraits above bar -->
      ${this._buildPortraitsFloat()}

      <div class="cgm-inner">
        <!-- Left side: GM Brand + Global Difficulty Box -->
        <div class="cgm-brand"><i class="fas fa-dungeon"></i> GM</div>

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

        <div class="cgm-spacer"></div>

        <!-- SECTION 1 -->
        ${this._buildSectionHTML(0)}

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
  _buildSectionHTML(index) {
    const sec = this._sections[index];
    if (!sec) return "";
    const rgb = this._hexToRgb(sec.bgColor);
    const bgStyle = rgb ? `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${sec.bgOpacity / 100})` : `rgba(255,255,255,${sec.bgOpacity / 100})`;
    return `
      <div class="cgm-custom-section" title="${sec.name}" style="width: ${sec.width}%; background: ${bgStyle};">
        <div class="cgm-section-separator cgm-sep-left"></div>
        <div class="cgm-section-content">
          <div class="cgm-section-buttons">
            <button class="cgm-section-btn" data-action="openNameGenerator" title="Open Name Generator">
              <i class="fas fa-signature"></i>
            </button>
          </div>
        </div>
        <div class="cgm-section-separator cgm-sep-right"></div>
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

  /* ─── Floating Portraits (above bar, left side) ─── */

  _buildPortraitsFloat() {
    const pcs = this._getPartyData();
    if (!pcs.length) return ``;
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
          const actor = game.actors.get(pc.id);
          const individualDiff = actor?.getFlag("cypher-gm-taskbar", "targetDifficulty") ?? 0;
          return `
          <div class="cgm-portrait-wrap ${nameAbove ? 'cgm-portrait-name-above' : ''}" data-actor-id="${pc.id}">
            <div class="cgm-portrait-difficulty ${individualDiff > 0 ? 'cgm-difficulty-active' : ''}">${individualDiff > 0 ? individualDiff : ''}</div>
            <div class="cgm-portrait-img-wrap ${shapeCls}" style="width:${size}px;height:${size}px;">
              <img src="${pc.img}" alt="${pc.name}" class="cgm-portrait-img"
                   style="border-color: ${bColor}; border-width: ${borderWidth}px; object-fit: ${fit};">
              <div class="cgm-portrait-damage cgm-damage-${pc.damageTrack.toLowerCase()}"></div>
            </div>
            <div class="cgm-portrait-info">
              <div class="cgm-portrait-name" style="font-size:${nameSize}px;color:${nColor};margin-left:${nameOffset}px;">${pc.name}</div>
              <div class="cgm-portrait-pools" style="margin-left:${barOffset}px;width:${barWidth}px;">
                <div class="cgm-portrait-pool-bar"><div class="cgm-portrait-pool-fill cgm-pool-might" style="width:${pc.pools.might.percent}%"></div></div>
                <div class="cgm-portrait-pool-bar"><div class="cgm-portrait-pool-fill cgm-pool-speed" style="width:${pc.pools.speed.percent}%"></div></div>
                <div class="cgm-portrait-pool-bar"><div class="cgm-portrait-pool-fill cgm-pool-intellect" style="width:${pc.pools.intellect.percent}%"></div></div>
              </div>
              <div class="cgm-xp-wrap" style="margin-left:${xpOffsetX}px;margin-top:${xpOffsetY}px;">${xpCircle}</div>
            </div>
          </div>`;
        }).join("")}
      </div>
    `;
  }

  _loadActorNotes() {
    const raw = this._gs("actorNotes", "");
    try { this._actorNotes = raw ? JSON.parse(raw) : {}; } catch { this._actorNotes = {}; }
    console.log(`${MODULE_ID} | Notes loaded:`, this._actorNotes);
  }

  async _saveActorNotes() {
    try {
      await this._ss("actorNotes", JSON.stringify(this._actorNotes));
      console.log(`${MODULE_ID} | Notes saved:`, this._actorNotes);
    } catch (err) {
      console.error(`${MODULE_ID} | Failed to save notes:`, err);
    }
  }

  _getActorNotes(actorId, includeArchived = false) {
    const notes = this._actorNotes[actorId] || [];
    if (includeArchived) return notes;
    return notes.filter(n => !n.archived);
  }

  async _addActorNote(actorId, note) {
    if (!this._actorNotes[actorId]) this._actorNotes[actorId] = [];
    this._actorNotes[actorId].push({
      text: note,
      time: new Date().toLocaleTimeString(),
      date: new Date().toLocaleDateString(),
      archived: false
    });
    console.log(`${MODULE_ID} | Adding note for ${actorId}:`, note);
    await this._saveActorNotes();
  }

  async _deleteActorNote(actorId, index) {
    if (this._actorNotes[actorId]) {
      this._actorNotes[actorId].splice(index, 1);
      if (this._actorNotes[actorId].length === 0) delete this._actorNotes[actorId];
      console.log(`${MODULE_ID} | Deleted note ${index} for ${actorId}`);
      await this._saveActorNotes();
    }
  }

  async _archiveActorNote(actorId, index) {
    if (this._actorNotes[actorId] && this._actorNotes[actorId][index]) {
      this._actorNotes[actorId][index].archived = true;
      console.log(`${MODULE_ID} | Archived note ${index} for ${actorId}`);
      await this._saveActorNotes();
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
      { action: "damage",     icon: "fa-skull",       label: "Damage", isDamage: true },
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
      else if (seg.isDamage) specialClass = "cgm-pie-seg-damage";
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
      else if (seg.isDamage) specialLabelClass = "cgm-pie-label-damage";
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
      } else if (action === "damage") {
        this._showDamageSubMenu(id, wrapEl);
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
            ChatMessage.create({
              speaker: { actor: id, alias: a.name },
              content: `<div style="padding:10px 14px;background:rgba(217,64,64,0.08);border:1px solid rgba(217,64,64,0.25);border-radius:8px;">
                <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;">
                  <i class="fas fa-bolt" style="color:#ff4444;font-size:16px;"></i>
                  <strong style="color:#ff6666;font-size:14px;">GM Intrusion — ${a.name}</strong>
                </div>
                <div style="color:#aaa;font-size:12px;line-height:1.5;">
                  The GM has triggered an intrusion on this character.<br>
                  <span style="color:#c8a96e;">Accept</span> to gain 1 XP (if under cap) or <span style="color:#ff6666;">Decline</span> by paying 1 XP.
                </div>
              </div>`
            });
            ui.notifications.info(`Intrusion sent for ${a.name}`);
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
      if (!menu.contains(e.target)) {
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
    this._hideNotesSubMenu();
    this._hideTargetSubMenu();
    this._hideDamageSubMenu();
    this._hideRecoverySubMenu();
    this._hideCyphersSubMenu();
    this._hideCallForRollSubMenu();
    this._hideCallForRollSkillSubMenu();
    this._hideCallForRollFrequentSubMenu();
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
      if (!subMenu.contains(e.target) && !this._connectingLineEl?.contains(e.target)) {
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

    // 2 slices: HEALTH and EFFECTS
    const slices = [
      { key: "health", label: "Health", icon: "fa-heart-pulse", color: "#40b060", startAngle: 225, endAngle: 315 },
      { key: "effects", label: "Effects", icon: "fa-sparkles", color: "#8a74cc", startAngle: 45, endAngle: 135 },
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

    // Get armor
    let armor = 0;
    try {
      armor = Number(foundry.utils.getProperty(actor, "system.combat.armor") ?? 0);
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
      el.addEventListener("click", (e) => {
        e.stopPropagation();
        const key = el.dataset.key;
        if (key === "health") {
          this._showHealthSubmenu(actorId, wrapEl, endX, endY);
        } else if (key === "effects") {
          ui.notifications.info("Active Effects: placeholder (coming soon)");
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
      if (!lineContainer.contains(e.target) && !subMenu.contains(e.target)) {
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
      if (!healthMenu.contains(e.target) && !this._connectingLineEl?.contains(e.target)) {
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
    this._statusActorId = null;
    this._statusWrapEl = null;
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

  /* ─── DAMAGE Submenu ─── */
  _showDamageSubMenu(actorId, wrapEl) {
    const result = this._buildSubMenuBase(actorId, wrapEl, 3, 9, 110, [
      { key: "input", label: "Input", icon: "fa-skull", color: "#d94040" },
      { key: "track", label: "Track", icon: "fa-heart-pulse", color: "#d94040" },
    ], "rgba(217,64,64,0.4)", "damage");
    if (!result) return;
    const { subMenu } = result;
    this._damageSubMenuEl = subMenu;

    subMenu.querySelectorAll(".cgm-sub-seg, .cgm-sub-label").forEach(el => {
      el.addEventListener("click", (e) => {
        e.stopPropagation();
        const key = el.dataset.key;
        if (key === "input") {
          this._hideDamageSubMenu();
          this._showDamagePanel(actorId, wrapEl);
        } else if (key === "track") {
          this._hideDamageSubMenu();
          this._hideRadialMenu();
          this._showDamageTrackPanel(actorId, wrapEl);
        }
      });
    });
  }

  _hideDamageSubMenu() {
    if (this._damageSubMenuEl) {
      this._damageSubMenuEl.classList.remove("cgm-status-submenu-visible");
      setTimeout(() => { this._damageSubMenuEl?.remove(); this._damageSubMenuEl = null; }, 200);
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

    const skillRows = skills.map((s, idx) => `
      <div class="cgm-skill-row" data-skill-idx="${idx}" style="animation-delay:${idx * 0.02}s">
        <i class="fas fa-dice-d20"></i>
        <span class="cgm-skill-name">${foundry.utils.escapeHTML(s.name)}</span>
        <span class="cgm-skill-pool">${this._detectSkillPoolMeta(s).pool}</span>
      </div>
    `).join("");

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
        if (!panel.contains(e.target)) this._hideCallForRollSkillSubMenu();
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

    const skillRows = frequentSkills.map((s, idx) => `
      <div class="cgm-skill-row" data-freq-idx="${idx}" style="animation-delay:${idx * 0.04}s">
        <i class="fas fa-star"></i>
        <span class="cgm-skill-name">${foundry.utils.escapeHTML(s.name)}</span>
        <span class="cgm-skill-pool">${this._detectSkillPoolMeta(s).pool}</span>
      </div>
    `).join("");

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
        if (!panel.contains(e.target)) this._hideCallForRollFrequentSubMenu();
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

    await ChatMessage.create({
      speaker: { actor: actor.id, alias: actor.name },
      content: `<div style="padding:10px 14px;background:rgba(200,169,110,0.12);border:1px solid rgba(200,169,110,0.35);border-radius:8px;">
        <div style="font-size:1.05em;font-weight:700;color:#8a6e3e;margin-bottom:4px;"><i class="fas fa-dice-d20"></i> GM Call for Roll</div>
        <div style="color:#000000;"><strong>${actor.name}</strong> — the GM is requesting a <strong>${poolName}</strong> roll.</div>
      </div>`
    });
    ui.notifications.info(`GM requests ${actor.name} to roll ${poolName}.`);

    // Try Cypher Taskbar's native dialog first
    const ctb = window.CypherTaskbar?.instance;
    if (ctb && typeof ctb._openNativeAttributeRollDialog === "function") {
      try {
        await ctb._openNativeAttributeRollDialog(actor, poolName, { presetDifficulty: gmDifficulty });
        return;
      } catch (err) {
        console.warn("[CypherGMTaskbar] CypherTaskbar dialog failed:", err);
      }
    }
    // Fallback: open our own simple roll dialog
    await this._openFallbackPoolDialog(actor, poolName);
  }

  /* ─── Execute Skill Roll ─── */
  async _doGMCallRollSkill(actor, skillItem) {
    const skillName = skillItem.name;
    const gmDifficulty = this._getGMDifficulty(actor);

    await ChatMessage.create({
      speaker: { actor: actor.id, alias: actor.name },
      content: `<div style="padding:10px 14px;background:rgba(200,169,110,0.12);border:1px solid rgba(200,169,110,0.35);border-radius:8px;">
        <div style="font-size:1.05em;font-weight:700;color:#8a6e3e;margin-bottom:4px;"><i class="fas fa-dice-d20"></i> GM Call for Roll</div>
        <div style="color:#000000;"><strong>${actor.name}</strong> — the GM is requesting a <strong>${skillName}</strong> roll.</div>
      </div>`
    });
    ui.notifications.info(`GM requests ${actor.name} to roll ${skillName}.`);

    // Try Cypher Taskbar's native dialog first
    const ctb = window.CypherTaskbar?.instance;
    if (ctb && typeof ctb._openNativeSkillRollDialog === "function") {
      try {
        await ctb._openNativeSkillRollDialog(actor, skillItem, gmDifficulty);
        return;
      } catch (err) {
        console.warn("[CypherGMTaskbar] CypherTaskbar dialog failed:", err);
      }
    }
    // Fallback: open our own simple roll dialog
    await this._openFallbackSkillDialog(actor, skillItem);
  }

  /* ─── Get GM Difficulty for Roll Dialogs ─── */
  _getGMDifficulty(actor) {
    if (!actor) return null;
    // 1. Individual actor difficulty (set via GM Taskbar Target button)
    const individual = actor.getFlag("cypher-gm-taskbar", "targetDifficulty");
    if (Number.isFinite(individual)) return Math.max(0, Math.min(15, individual));
    // 2. Global difficulty from GM Taskbar settings
    return this._globalDifficulty ?? null;
  }

  /* ─── Fallback Pool Dialog ─── */
  async _openFallbackPoolDialog(actor, poolName) {
    const poolKey = poolName.toLowerCase();
    const poolData = actor.system?.pools?.[poolKey] ?? {};
    const poolValue = poolData.value ?? poolData.current ?? 0;
    const edge = poolData.edge ?? 0;
    const effortCap = Math.max(0, Math.min(6, Number(actor?.system?.basic?.effort ?? actor?.system?.advancement?.effort ?? 0) || 0));

    const content = `
      <form class="cgm-roll-form">
        <div style="display:flex;flex-direction:column;gap:10px;padding:4px;font-family:'Signika','Palatino Linotype',serif;">
          <div style="text-align:center;color:#8a6e3e;font-weight:700;font-size:1.1em;"><i class="fas fa-dice-d20"></i> ${poolName} Roll — ${actor.name}</div>
          <div style="display:flex;justify-content:center;gap:16px;font-size:0.85em;color:#555;">
            <span>Pool: ${poolValue}</span><span>Edge: ${edge}</span>
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
            <label style="display:flex;flex-direction:column;gap:2px;font-size:0.8em;color:#333;"><span>Difficulty</span><select name="baseDifficulty" style="background:#f5f2eb;border:1px solid #d4c9a8;border-radius:6px;padding:4px 6px;color:#222;">${[0,1,2,3,4,5,6,7,8,9,10].map(v => `<option value="${v}" ${v===0?'selected':''}>${v}</option>`).join('')}</select></label>
            <label style="display:flex;flex-direction:column;gap:2px;font-size:0.8em;color:#333;"><span>Assets</span><select name="assets" style="background:#f5f2eb;border:1px solid #d4c9a8;border-radius:6px;padding:4px 6px;color:#222;">${[0,1,2].map(v => `<option value="${v}" ${v===0?'selected':''}>${v}</option>`).join('')}</select></label>
            <label style="display:flex;flex-direction:column;gap:2px;font-size:0.8em;color:#333;"><span>Effort</span><select name="effort" style="background:#f5f2eb;border:1px solid #d4c9a8;border-radius:6px;padding:4px 6px;color:#222;">${Array.from({length:effortCap+1},(_,v)=>`<option value="${v}" ${v===0?'selected':''}>${v}</option>`).join('')}</select></label>
            <label style="display:flex;flex-direction:column;gap:2px;font-size:0.8em;color:#333;"><span>Ease</span><select name="easedBy" style="background:#f5f2eb;border:1px solid #d4c9a8;border-radius:6px;padding:4px 6px;color:#222;">${[0,1,2,3,4,5,6].map(v => `<option value="${v}" ${v===0?'selected':''}>${v}</option>`).join('')}</select></label>
          </div>
          <label style="display:flex;flex-direction:column;gap:2px;font-size:0.8em;color:#333;"><span>Hindrance</span><select name="hinderedBy" style="background:#f5f2eb;border:1px solid #d4c9a8;border-radius:6px;padding:4px 6px;color:#222;">${[0,1,2,3,4,5,6].map(v => `<option value="${v}" ${v===0?'selected':''}>${v}</option>`).join('')}</select></label>
        </div>
      </form>`;

    return new Promise(resolve => {
      new Dialog({
        title: `Roll ${poolName}`,
        content,
        buttons: {
          roll: { icon: '<i class="fas fa-dice-d20"></i>', label: 'Roll', callback: async html => {
            const form = html?.[0]?.querySelector?.('.cgm-roll-form');
            if (!form) return resolve(null);
            const data = Object.fromEntries(new FormData(form).entries());
            await this._performFallbackRoll(actor, poolName, null, data);
            resolve(true);
          }},
          cancel: { icon: '<i class="fas fa-times"></i>', label: 'Cancel', callback: () => resolve(null) }
        },
        default: 'roll'
      }).render(true);
    });
  }

  /* ─── Fallback Skill Dialog ─── */
  async _openFallbackSkillDialog(actor, skillItem) {
    const skillName = skillItem.name;
    const poolMeta = this._detectSkillPoolMeta(skillItem);
    const defaultPool = poolMeta.pool || "Might";
    const effortCap = Math.max(0, Math.min(6, Number(actor?.system?.basic?.effort ?? actor?.system?.advancement?.effort ?? 0) || 0));
    const rating = (skillItem.system?.basic?.rating || "").toLowerCase();
    let skillStep = 0;
    if (rating.includes("specialized")) skillStep = 2;
    else if (rating.includes("trained")) skillStep = 1;
    else if (rating.includes("inability")) skillStep = -1;

    const content = `
      <form class="cgm-roll-form">
        <div style="display:flex;flex-direction:column;gap:10px;padding:4px;font-family:'Signika','Palatino Linotype',serif;">
          <div style="text-align:center;color:#8a6e3e;font-weight:700;font-size:1.1em;"><i class="fas fa-dice-d20"></i> ${skillName} — ${actor.name}</div>
          <div style="display:flex;justify-content:center;gap:16px;font-size:0.85em;color:#555;">
            <span>Pool: ${defaultPool}</span><span>Step: ${skillStep >= 0 ? '+' + skillStep : skillStep}</span>
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
            <label style="display:flex;flex-direction:column;gap:2px;font-size:0.8em;color:#333;"><span>Pool</span><select name="pool" style="background:#f5f2eb;border:1px solid #d4c9a8;border-radius:6px;padding:4px 6px;color:#222;">${['Might','Speed','Intellect'].map(p => `<option value="${p}" ${p===defaultPool?'selected':''}>${p}</option>`).join('')}</select></label>
            <label style="display:flex;flex-direction:column;gap:2px;font-size:0.8em;color:#333;"><span>Difficulty</span><select name="baseDifficulty" style="background:#f5f2eb;border:1px solid #d4c9a8;border-radius:6px;padding:4px 6px;color:#222;">${[0,1,2,3,4,5,6,7,8,9,10].map(v => `<option value="${v}" ${v===0?'selected':''}>${v}</option>`).join('')}</select></label>
            <label style="display:flex;flex-direction:column;gap:2px;font-size:0.8em;color:#333;"><span>Assets</span><select name="assets" style="background:#f5f2eb;border:1px solid #d4c9a8;border-radius:6px;padding:4px 6px;color:#222;">${[0,1,2].map(v => `<option value="${v}" ${v===0?'selected':''}>${v}</option>`).join('')}</select></label>
            <label style="display:flex;flex-direction:column;gap:2px;font-size:0.8em;color:#333;"><span>Effort</span><select name="effort" style="background:#f5f2eb;border:1px solid #d4c9a8;border-radius:6px;padding:4px 6px;color:#222;">${Array.from({length:effortCap+1},(_,v)=>`<option value="${v}" ${v===0?'selected':''}>${v}</option>`).join('')}</select></label>
            <label style="display:flex;flex-direction:column;gap:2px;font-size:0.8em;color:#333;"><span>Ease</span><select name="easedBy" style="background:#f5f2eb;border:1px solid #d4c9a8;border-radius:6px;padding:4px 6px;color:#222;">${[0,1,2,3,4,5,6].map(v => `<option value="${v}" ${v===0?'selected':''}>${v}</option>`).join('')}</select></label>
            <label style="display:flex;flex-direction:column;gap:2px;font-size:0.8em;color:#333;"><span>Hindrance</span><select name="hinderedBy" style="background:#f5f2eb;border:1px solid #d4c9a8;border-radius:6px;padding:4px 6px;color:#222;">${[0,1,2,3,4,5,6].map(v => `<option value="${v}" ${v===0?'selected':''}>${v}</option>`).join('')}</select></label>
          </div>
        </div>
      </form>`;

    return new Promise(resolve => {
      new Dialog({
        title: `Roll ${skillName}`,
        content,
        buttons: {
          roll: { icon: '<i class="fas fa-dice-d20"></i>', label: 'Roll', callback: async html => {
            const form = html?.[0]?.querySelector?.('.cgm-roll-form');
            if (!form) return resolve(null);
            const data = Object.fromEntries(new FormData(form).entries());
            await this._performFallbackRoll(actor, data.pool || defaultPool, skillItem, data);
            resolve(true);
          }},
          cancel: { icon: '<i class="fas fa-times"></i>', label: 'Cancel', callback: () => resolve(null) }
        },
        default: 'roll'
      }).render(true);
    });
  }

  /* ─── Perform Fallback Roll ─── */
  async _performFallbackRoll(actor, poolName, skillItem, options) {
    const baseDifficulty = Number(options.baseDifficulty) || 0;
    const assets = Number(options.assets) || 0;
    const effort = Number(options.effort) || 0;
    const easedBy = Number(options.easedBy) || 0;
    const hinderedBy = Number(options.hinderedBy) || 0;
    const poolKey = poolName.toLowerCase();
    const poolData = actor.system?.pools?.[poolKey] ?? {};
    const edge = poolData.edge ?? 0;
    const poolValue = poolData.value ?? poolData.current ?? 0;

    let skillStep = 0;
    if (skillItem) {
      const rating = (skillItem.system?.basic?.rating || "").toLowerCase();
      if (rating.includes("specialized")) skillStep = 2;
      else if (rating.includes("trained")) skillStep = 1;
      else if (rating.includes("inability")) skillStep = -1;
    }

    const finalDifficulty = Math.max(0, baseDifficulty - assets - effort - easedBy - skillStep + hinderedBy);
    const target = finalDifficulty * 3;
    const effortCost = effort > 0 ? Math.max(0, effort * 3 - edge) : 0;

    const roll = await (new Roll('1d20')).evaluate();
    const total = Number(roll.total ?? 0);
    const modifier = (skillStep + assets + effort + easedBy - hinderedBy) * 3;
    const achievedDifficulty = Math.max(0, Math.floor((total + modifier) / 3));
    const success = total >= target;

    let spent = 0;
    if (effortCost > 0 && poolValue >= effortCost) {
      await actor.update({ [`system.pools.${poolKey}.value`]: Math.max(0, poolValue - effortCost) });
      spent = effortCost;
    }

    let specialText = "";
    if (total === 1) specialText = "<div style='color:#8a6e3e;font-weight:700;'>GM Intrusion!</div>";
    else if (total === 17) specialText = "<div style='color:#8a6e3e;'>+1 Damage</div>";
    else if (total === 18) specialText = "<div style='color:#8a6e3e;'>+2 Damage</div>";
    else if (total === 19) specialText = "<div style='color:#8a6e3e;font-weight:700;'>Minor Effect</div>";
    else if (total === 20) specialText = "<div style='color:#8a6e3e;font-weight:700;'>Major Effect</div>";

    const rollName = skillItem ? skillItem.name : poolName;
    const flavor = `
      <div style="padding:10px 14px;background:rgba(200,169,110,0.1);border:1px solid rgba(200,169,110,0.3);border-radius:8px;">
        <div style="font-size:1.1em;font-weight:700;color:#8a6e3e;margin-bottom:6px;"><i class="fas fa-dice-d20"></i> ${rollName} — ${actor.name}</div>
        <div style="color:#333;font-size:0.85em;margin-bottom:4px;">Base ${baseDifficulty} · Assets ${assets} · Effort ${effort} · Ease ${easedBy} · Hindrance ${hinderedBy}</div>
        <div style="color:#333;font-size:0.85em;margin-bottom:4px;">Final ${finalDifficulty} · Target ${target} · Edge ${edge} · Cost ${effortCost}</div>
        ${specialText}
        <div style="font-size:1.2em;font-weight:700;color:${success ? '#2d8a3e' : '#c9302c'};margin-top:6px;">${success ? '✓ Success' : '✗ Failure'} — ${total} vs ${target}</div>
        <div style="color:#555;font-size:0.85em;margin-top:4px;">Achieved Difficulty ${achievedDifficulty}</div>
      </div>`;

    await roll.toMessage({ speaker: ChatMessage.getSpeaker({ actor }), flavor }, { rollMode: game.settings.get('core', 'rollMode') });
  }

  /* ─── Helpers ─── */
  _detectSkillPoolMeta(skillItem) {
    const name = (skillItem.name || "").toLowerCase();
    const desc = (skillItem.system?.description || skillItem.system?.basic?.description || "").toLowerCase();
    const combined = name + " " + desc;
    if (/\bmight\b/.test(combined)) return { pool: "Might" };
    if (/\bspeed\b/.test(combined)) return { pool: "Speed" };
    if (/\bintellect\b/.test(combined)) return { pool: "Intellect" };
    return { pool: "Might" };
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

    ChatMessage.create({
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

    ChatMessage.create({
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
    const result = this._buildSubMenuBase(actorId, wrapEl, 5, 9, 110, [
      { key: "view", label: "View", icon: "fa-flask", color: "#8a74cc" },
      { key: "create", label: "New", icon: "fa-plus", color: "#8a74cc" },
    ], "rgba(138,116,204,0.4)");
    if (!result) return;
    const { subMenu } = result;
    this._cyphersSubMenuEl = subMenu;

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

  /* ─── Add Note Dialog ─── */
  async _showAddNoteDialog(actorId) {
    const actor = game.actors.get(actorId);
    if (!actor) return;
    const note = await new Promise((resolve) => {
      new Dialog({
        title: `Add Note — ${actor.name}`,
        content: `<div style="padding:12px;"><textarea id="cgm-new-note" rows="4" style="width:100%;background:rgba(0,0,0,0.5);border:1px solid rgba(200,169,110,0.3);border-radius:4px;color:#e8e0d4;padding:8px;font-family:inherit;resize:vertical;" placeholder="Enter note..."></textarea></div>`,
        buttons: {
          add: { icon: '<i class="fas fa-plus"></i>', label: "Add", callback: (html) => resolve(html.find("#cgm-new-note").val()) },
          cancel: { icon: '<i class="fas fa-times"></i>', label: "Cancel", callback: () => resolve(null) }
        },
        default: "add"
      }).render(true);
    });
    if (note?.trim()) {
      const notes = this._getActorNotes(actor);
      notes.push(note.trim());
      await actor.setFlag("cypher-gm-taskbar", "notes", notes);
      ui.notifications.info(`Note added for ${actor.name}`);
    }
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
    ChatMessage.create({
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
      ? notes.map((n, i) => `
        <div class="cgm-note-item ${n.archived ? 'cgm-note-archived' : ''}">
          <div class="cgm-note-meta">
            <span>${n.date} ${n.time} ${n.archived ? '<span class="cgm-note-archive-badge">Archived</span>' : ''}</span>
            <button class="cgm-note-delete" data-index="${i}" title="Delete"><i class="fas fa-times"></i></button>
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
        const idx = parseInt(btn.dataset.index);
        await this._deleteActorNote(actorId, idx);
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

    panel.querySelector(".cgm-target-chat-btn")?.addEventListener("click", () => {
      const d = parseInt(slider.value, 10);
      const data = difficultyData[d];
      ChatMessage.create({
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
      if (!panel.contains(e.target) && !this._connectingLineEl?.contains(e.target)) {
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

    // Get armor
    let armor = 0;
    try {
      armor = Number(foundry.utils.getProperty(actor, "system.combat.armor")) || 0;
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
      if (!panel.contains(e.target) && !this._connectingLineEl?.contains(e.target)) {
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
      if (!panel.contains(e.target) && !this._connectingLineEl?.contains(e.target)) {
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

    // Get cyphers
    const cyphers = actor.items?.filter(i => i.type === "cypher") || [];
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
    const panelH = Math.min(400, 180 + cyphers.length * 50);

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

    const cypherList = cyphers.length
      ? cyphers.map((c, i) => `
        <div class="cgm-cypher-item">
          <div class="cgm-cypher-info">
            <span class="cgm-cypher-name">${this._escapeHTML(c.name)}</span>
            <span class="cgm-cypher-level">Lvl ${c.system?.level ?? "?"}</span>
          </div>
          <button class="cgm-cypher-use-btn" data-index="${i}"><i class="fas fa-flask"></i> Use</button>
        </div>
      `).join("")
      : `<div class="cgm-cypher-empty">No cyphers carried</div>`;

    panel.innerHTML = `
      <div class="cgm-connected-panel-header">
        <i class="fas fa-flask"></i>
        <span>Cyphers: ${name}</span>
        <button class="cgm-connected-panel-close"><i class="fas fa-xmark"></i></button>
      </div>
      <div class="cgm-cyphers-body">
        <div class="cgm-cyphers-count">
          <span class="cgm-cyphers-carried">${cyphers.length}</span> / <span class="cgm-cyphers-max">${cypherLimit}</span>
        </div>
        <div class="cgm-cyphers-list">${cypherList}</div>
      </div>
    `;

    document.body.appendChild(panel);
    this._cyphersPanelEl = panel;
    panel.offsetHeight;
    requestAnimationFrame(() => requestAnimationFrame(() => panel.classList.add("cgm-connected-panel-visible")));
    this._makePanelDraggable(panel, "_cyphersLineStart", "_cyphersPanelPos");

    // ── Handlers ──
    panel.querySelectorAll(".cgm-cypher-use-btn").forEach(btn => {
      btn.addEventListener("click", async () => {
        const idx = parseInt(btn.dataset.index);
        const cypher = cyphers[idx];
        if (!cypher) return;
        // Send to chat that cypher was used
        ChatMessage.create({
          speaker: { actor: actorId, alias: actor.name },
          content: `<div style="padding:6px 10px;background:rgba(136,85,204,0.1);border:1px solid rgba(136,85,204,0.3);border-radius:6px;">
            <strong style="color:#aa77dd;">🧪 ${actor.name} uses ${cypher.name}</strong><br>
            <span style="color:#aaa;font-size:12px;">Level ${cypher.system?.level ?? "?"} Cypher — single use consumed</span>
          </div>`
        });
        // Delete the cypher item (single use)
        await cypher.delete();
        ui.notifications.info(`${cypher.name} used and consumed.`);
        this._hideCyphersPanel();
      });
    });

    panel.querySelector(".cgm-connected-panel-close")?.addEventListener("click", (e) => {
      e.stopPropagation();
      this._hideCyphersPanel();
    });

    const closeHandler = (e) => {
      if (!panel.contains(e.target) && !this._connectingLineEl?.contains(e.target)) {
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

  _sendIntrusionChatMessage(actor, accepted, gaveXPTo = null) {
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

    ChatMessage.create({
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

  _bindPortraitEvents() {
    if (!this.element) return;
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
    });
  }

  /* Update baseDifficulty on any open Cypher System roll dialogs */
  _updateOpenRollDialogs() {
    const dialogs = Object.values(ui.windows).filter(app => app.constructor.name === "RollEngineDialogSheet");
    for (const dialog of dialogs) {
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

  _getPartyData() {
    return game.actors.filter(a => a.type === "pc" && a.hasPlayerOwner).map(actor => {
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
      const cypherCount = actor.items.filter(i => i.type === "cypher" || i.type === "artifact").length;
      const cypherLimit = sys.basic?.cypherLimit ?? sys.settings?.cypherLimit ?? 0;

      // Recovery state
      let recoveryAvailable = 4;
      let recoveryTotal = 4;
      let rolls = null;
      if (Array.isArray(sys.combat?.recoveries?.recoveryRolls)) rolls = sys.combat.recoveries.recoveryRolls;
      else if (Array.isArray(sys.recoveries?.recoveryRolls)) rolls = sys.recoveries.recoveryRolls;
      else if (Array.isArray(sys.combat?.recoveryRolls)) rolls = sys.combat.recoveryRolls;

      if (rolls) {
        recoveryAvailable = rolls.filter(r => !!r).length;
        recoveryTotal = rolls.length;
      } else {
        const rec = sys.combat?.recoveries || {};
        const used = [rec.oneAction, rec.tenMinutes, rec.oneHour, rec.tenHours].filter(Boolean).length;
        recoveryAvailable = 4 - used;
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
        recoveryTotal
      };
    });
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
        <div class="cgm-setting-section-title">SECTION 1</div>
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
      </div>
    `;

    return `
      <div class="cgm-panel-header"><i class="fas fa-cog"></i> Settings</div>
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

    // Global difficulty controls
    this.element.querySelector('[data-action="globalDiffDown"]')?.addEventListener("click", async () => {
      this._globalDifficulty = Math.max(0, this._globalDifficulty - 1);
      await this._ss("globalDifficulty", this._globalDifficulty);
      this._updateDifficultyBox();
      this._refreshPortraits();
      this._updateOpenRollDialogs();
    });
    this.element.querySelector('[data-action="globalDiffUp"]')?.addEventListener("click", async () => {
      this._globalDifficulty = Math.min(15, this._globalDifficulty + 1);
      await this._ss("globalDifficulty", this._globalDifficulty);
      this._updateDifficultyBox();
      this._refreshPortraits();
      this._updateOpenRollDialogs();
    });
    this.element.querySelector('[data-action="globalDiffReset"]')?.addEventListener("click", async () => {
      this._globalDifficulty = 4;
      await this._ss("globalDifficulty", 4);
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
        this._updateDifficultyBox();
        this._refreshPortraits();
        this._updateOpenRollDialogs();
      });
    }

    // Name Generator button in SECTION 1
    this.element.querySelector('[data-action="openNameGenerator"]')?.addEventListener("click", () => {
      if (window.CypherNameGenerator) window.CypherNameGenerator.open();
      else if (window.NameGenerator) window.NameGenerator.open();
      else ui.notifications.warn("Name Generator module is not active.");
    });
    // Lock toggle
    this.element.querySelector('[data-action="toggleLock"]')?.addEventListener("click", async () => {
      this._locked = !this._locked;
      await this._ss("locked", this._locked);
      this.render();
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
        // Opacity — update live
        el.querySelector('[data-action="setOpacity"]')?.addEventListener("input", async (e) => {
          this._opacity = parseInt(e.target.value);
          await this._ss("opacity", this._opacity);
          if (this.element) this.element.style.opacity = `${this._opacity}%`;
          const vd = el.querySelector('.cgm-slider-val');
          if (vd) vd.textContent = `${this._opacity}%`;
        });
        // Section settings — width, color, opacity (update live, no re-render)
        const _updateSectionStyle = () => {
          const sec = this._sections[0];
          const rgb = this._hexToRgb(sec.bgColor);
          const bg = rgb ? `rgba(${rgb.r},${rgb.g},${rgb.b},${sec.bgOpacity/100})` : `rgba(255,255,255,${sec.bgOpacity/100})`;
          const sectionEl = this.element?.querySelector('.cgm-custom-section');
          if (sectionEl) {
            sectionEl.style.width = `${sec.width}%`;
            sectionEl.style.background = bg;
          }
        };
        el.querySelector('[data-action="setSectionWidth"]')?.addEventListener("input", async (e) => {
          const idx = parseInt(e.target.dataset.section);
          this._sections[idx].width = parseInt(e.target.value);
          await this._ss("sectionWidth", this._sections[idx].width);
          const vd = e.target.nextElementSibling;
          if (vd) vd.textContent = `${this._sections[idx].width}%`;
          _updateSectionStyle();
        });
        el.querySelector('[data-action="setSectionColor"]')?.addEventListener("input", async (e) => {
          const idx = parseInt(e.target.dataset.section);
          this._sections[idx].bgColor = e.target.value;
          await this._ss("sectionBgColor", this._sections[idx].bgColor);
          _updateSectionStyle();
        });
        el.querySelector('[data-action="setSectionOpacity"]')?.addEventListener("input", async (e) => {
          const idx = parseInt(e.target.dataset.section);
          this._sections[idx].bgOpacity = parseInt(e.target.value);
          await this._ss("sectionBgOpacity", this._sections[idx].bgOpacity);
          const vd = e.target.nextElementSibling;
          if (vd) vd.textContent = `${this._sections[idx].bgOpacity}%`;
          _updateSectionStyle();
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
  }

  /* ─── Auto-Hide ─── */

  _setupAutoHide() {
    if (!this.element || this._locked) return;

    // Bar starts hidden in autohide mode
    this._isHidden = true;

    const show = () => {
      if (this._isHidden) { this.element.classList.add("cgm-visible"); this._isHidden = false; }
      clearTimeout(this._autoHideTimer);
      this._autoHideTimer = setTimeout(() => { this.element.classList.remove("cgm-visible"); this._isHidden = true; }, 3000);
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
}

/* ═══════════════════════════════════════════════════════════════
   SETTINGS
   ═══════════════════════════════════════════════════════════════ */

function registerSettings() {
  game.settings.register(MODULE_ID, "dock", { name: "Dock Position", hint: "Where the taskbar appears.", scope: "client", config: false, type: String, default: "bottom", choices: { bottom: "Bottom", top: "Top" } });
  game.settings.register(MODULE_ID, "opacity", { name: "Opacity", hint: "Taskbar opacity percentage.", scope: "client", config: false, type: Number, default: 100, range: { min: 50, max: 100, step: 5 } });
  game.settings.register(MODULE_ID, "compact", { name: "Compact Mode", hint: "Show compact buttons.", scope: "client", config: false, type: Boolean, default: false });
  game.settings.register(MODULE_ID, "notes", { name: "Quick Notes", hint: "GM quick notes storage.", scope: "client", config: false, type: String, default: "" });
  game.settings.register(MODULE_ID, "locked", { name: "Taskbar Locked", hint: "Lock taskbar visible.", scope: "client", config: false, type: Boolean, default: true });
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
  game.settings.register(MODULE_ID, "actorNotes", { name: "Actor Notes", hint: "Per-actor notes stored as JSON.", scope: "client", config: false, type: String, default: "" });
  game.settings.register(MODULE_ID, "radialMenuSize", { name: "Radial Menu Size", hint: "Size of the radial menu in pixels.", scope: "client", config: false, type: Number, default: 200, range: { min: 100, max: 300, step: 10 } });
  game.settings.register(MODULE_ID, "radialMenuOffset", { name: "Radial Menu Offset", hint: "Distance from portrait to menu in pixels.", scope: "client", config: false, type: Number, default: 20, range: { min: 10, max: 100, step: 5 } });
  game.settings.register(MODULE_ID, "disableGMTaskbar", { name: "Never Load GM Taskbar", hint: "If enabled, the GM Taskbar will not appear for this user. Requires reload.", scope: "client", config: true, type: Boolean, default: false });
  // SECTION 1 settings
  game.settings.register(MODULE_ID, "sectionWidth", { name: "Section Width", hint: "Width of SECTION 1 as a percentage.", scope: "client", config: false, type: Number, default: 10 });
  game.settings.register(MODULE_ID, "sectionBgColor", { name: "Section Background Color", hint: "Background color of SECTION 1.", scope: "client", config: false, type: String, default: "#ffffff" });
  game.settings.register(MODULE_ID, "sectionBgOpacity", { name: "Section Background Opacity", hint: "Background opacity of SECTION 1 (0-100).", scope: "client", config: false, type: Number, default: 30 });
}

/* ═══════════════════════════════════════════════════════════════
   HOOKS
   ═══════════════════════════════════════════════════════════════ */

Hooks.once("init", () => {
  console.log(`${MODULE_ID} | Module loaded`);
  registerSettings();
});

Hooks.once("ready", () => {
  if (!game.user?.isGM) { console.log(`${MODULE_ID} | User is not GM — taskbar skipped`); return; }
  const disabled = (() => { try { return game.settings.get(MODULE_ID, "disableGMTaskbar"); } catch { return false; } })();
  if (disabled) { console.log(`${MODULE_ID} | GM Taskbar disabled in settings`); return; }
  setTimeout(() => { window.cypherGMTaskbar = new GMTaskbar(); window.cypherGMTaskbar.render(); console.log(`${MODULE_ID} | GM taskbar rendered`); }, 500);
});

/* Refresh portraits when actor data changes (pools, XP, damage track, etc.) */
Hooks.on("updateActor", (actor, data, options, userId) => {
  if (!game.user?.isGM) return;
  if (actor.type !== "pc" || !actor.hasPlayerOwner) return;
  if (!window.cypherGMTaskbar) return;
  // Debounce: wait for all updates to settle
  clearTimeout(window._cgmRefreshTimer);
  window._cgmRefreshTimer = setTimeout(() => {
    window.cypherGMTaskbar._refreshPortraits();
  }, 100);
});

/* Refresh portraits when items change on actors (cyphers, artifacts) */
Hooks.on("createItem", (item, options, userId) => {
  if (!game.user?.isGM) return;
  const actor = item.parent;
  if (!actor || actor.type !== "pc" || !actor.hasPlayerOwner) return;
  if (!window.cypherGMTaskbar) return;
  clearTimeout(window._cgmRefreshTimer);
  window._cgmRefreshTimer = setTimeout(() => {
    window.cypherGMTaskbar._refreshPortraits();
  }, 100);
});

Hooks.on("deleteItem", (item, options, userId) => {
  if (!game.user?.isGM) return;
  const actor = item.parent;
  if (!actor || actor.type !== "pc" || !actor.hasPlayerOwner) return;
  if (!window.cypherGMTaskbar) return;
  clearTimeout(window._cgmRefreshTimer);
  window._cgmRefreshTimer = setTimeout(() => {
    window.cypherGMTaskbar._refreshPortraits();
  }, 100);
});

/* ── Apply GM Taskbar difficulty to Cypher System roll dialogs ── */
Hooks.on("renderRollEngineDialogSheet", (app, html, data) => {
  if (!window.cypherGMTaskbar) return;

  const actor = fromUuidSync(app.object.actorUuid);
  if (!actor) return;

  // Determine target difficulty: individual actor flag first, then global
  let difficulty = actor.getFlag("cypher-gm-taskbar", "targetDifficulty");
  if (difficulty === undefined || difficulty === null) {
    difficulty = window.cypherGMTaskbar._globalDifficulty;
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
