/**
 * ColorCraft — Modern Color Palette Generator & Design System Tool
 * Vanilla JavaScript implementation
 */

'use strict';

(function () {
  // =========================================================================
  // State Management
  // =========================================================================
  const PALETTE_SIZE = 5;
  const STORAGE_KEY = 'colorcraft_saved_palettes_v1';

  // Role labels for each swatch position
  const ROLE_NAMES = ['Primary', 'Secondary', 'Accent', 'Surface', 'Muted'];

  let state = {
    colors: [
      { hex: '#2563EB', locked: false },
      { hex: '#3B82F6', locked: false },
      { hex: '#60A5FA', locked: false },
      { hex: '#93C5FD', locked: false },
      { hex: '#BFDBFE', locked: false }
    ],
    format: 'hex', // 'hex' | 'rgb' | 'hsl'
    harmony: 'random', // 'random' | 'analogous' | 'monochromatic' | 'triadic' | 'complementary' | 'split-complementary'
    gradient: {
      color1Index: 0,
      color2Index: 2,
      angle: 135,
      type: 'linear'
    },
    contrast: {
      fgHex: '#0F172A',
      bgHex: '#60A5FA'
    },
    savedPalettes: []
  };

  // Starter Palettes if localStorage is empty
  const STARTER_PALETTES = [
    {
      id: 'starter-1',
      name: 'Electric Neon',
      colors: ['#0f172a', '#3b82f6', '#06b6d4', '#10b981', '#f59e0b'],
      createdAt: 'Default'
    },
    {
      id: 'starter-2',
      name: 'Sunset Horizon',
      colors: ['#4c0519', '#9f1239', '#e11d48', '#fb7185', '#ffe4e6'],
      createdAt: 'Default'
    },
    {
      id: 'starter-3',
      name: 'Forest Flora',
      colors: ['#064e3b', '#047857', '#10b981', '#6ee7b7', '#d1fae5'],
      createdAt: 'Default'
    }
  ];

  // =========================================================================
  // Color Math & Conversions
  // =========================================================================

  /**
   * Clamp a number between min and max
   */
  function clamp(val, min, max) {
    return Math.min(Math.max(val, min), max);
  }

  /**
   * Convert HEX to RGB Object {r, g, b}
   */
  function hexToRgb(hex) {
    let cleanHex = hex.replace('#', '').trim();
    if (cleanHex.length === 3) {
      cleanHex = cleanHex.split('').map(c => c + c).join('');
    }
    if (cleanHex.length !== 6) {
      return { r: 0, g: 0, b: 0 };
    }
    const num = parseInt(cleanHex, 16);
    return {
      r: (num >> 16) & 255,
      g: (num >> 8) & 255,
      b: num & 255
    };
  }

  /**
   * Convert RGB to HEX String (#RRGGBB)
   */
  function rgbToHex(r, g, b) {
    const toHex = c => {
      const hex = Math.round(clamp(c, 0, 255)).toString(16);
      return hex.length === 1 ? '0' + hex : hex;
    };
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`.toUpperCase();
  }

  /**
   * Convert RGB to HSL Object {h, s, l} (h: 0-360, s: 0-100, l: 0-100)
   */
  function rgbToHsl(r, g, b) {
    r /= 255;
    g /= 255;
    b /= 255;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    let h = 0;
    let s = 0;
    const l = (max + min) / 2;

    if (max !== min) {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      switch (max) {
        case r: h = (g - b) / d + (g < b ? 6 : 0); break;
        case g: h = (b - r) / d + 2; break;
        case b: h = (r - g) / d + 4; break;
      }
      h /= 6;
    }

    return {
      h: Math.round(h * 360),
      s: Math.round(s * 100),
      l: Math.round(l * 100)
    };
  }

  /**
   * Convert HSL to RGB Object {r, g, b}
   */
  function hslToRgb(h, s, l) {
    h = (h % 360 + 360) % 360;
    s = clamp(s, 0, 100) / 100;
    l = clamp(l, 0, 100) / 100;

    const c = (1 - Math.abs(2 * l - 1)) * s;
    const x = c * (1 - Math.abs((h / 60) % 2 - 1));
    const m = l - c / 2;
    let r1 = 0, g1 = 0, b1 = 0;

    if (h >= 0 && h < 60) { r1 = c; g1 = x; b1 = 0; }
    else if (h >= 60 && h < 120) { r1 = x; g1 = c; b1 = 0; }
    else if (h >= 120 && h < 180) { r1 = 0; g1 = c; b1 = x; }
    else if (h >= 180 && h < 240) { r1 = 0; g1 = x; b1 = c; }
    else if (h >= 240 && h < 300) { r1 = x; g1 = 0; b1 = c; }
    else { r1 = c; g1 = 0; b1 = x; }

    return {
      r: Math.round((r1 + m) * 255),
      g: Math.round((g1 + m) * 255),
      b: Math.round((b1 + m) * 255)
    };
  }

  /**
   * Format a color in the desired representation string
   */
  function formatColor(hex, format) {
    const rgb = hexToRgb(hex);
    if (format === 'rgb') {
      return `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`;
    }
    if (format === 'hsl') {
      const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);
      return `hsl(${hsl.h}, ${hsl.s}%, ${hsl.l}%)`;
    }
    return hex.toUpperCase();
  }

  /**
   * Calculate WCAG 2.1 relative luminance of a color
   */
  function getLuminance(r, g, b) {
    const a = [r, g, b].map(v => {
      v /= 255;
      return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    });
    return a[0] * 0.2126 + a[1] * 0.7152 + a[2] * 0.0722;
  }

  /**
   * Calculate WCAG 2.1 Contrast Ratio between two HEX colors
   */
  function getContrastRatio(hex1, hex2) {
    const rgb1 = hexToRgb(hex1);
    const rgb2 = hexToRgb(hex2);
    const lum1 = getLuminance(rgb1.r, rgb1.g, rgb1.b);
    const lum2 = getLuminance(rgb2.r, rgb2.g, rgb2.b);
    const brightest = Math.max(lum1, lum2);
    const darkest = Math.min(lum1, lum2);
    return (brightest + 0.05) / (darkest + 0.05);
  }

  /**
   * Return high-contrast text color (#ffffff or #0f172a) for a given background
   */
  function getContrastingTextColor(hex) {
    const rgb = hexToRgb(hex);
    const lum = getLuminance(rgb.r, rgb.g, rgb.b);
    return lum > 0.42 ? '#0f172a' : '#ffffff';
  }

  // =========================================================================
  // Palette Generation Engines
  // =========================================================================

  /**
   * Random integer in [min, max]
   */
  function randomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  /**
   * Generate an aesthetically pleasing vibrant random color
   */
  function getRandomVibrantHsl() {
    const h = randomInt(0, 360);
    const s = randomInt(45, 95);
    const l = randomInt(35, 75);
    return { h, s, l };
  }

  /**
   * Generate palette based on chosen harmony rule
   */
  function generatePaletteColors() {
    const harmony = state.harmony;
    const newColors = [...state.colors];

    // Pick base hue from first locked color, or generate a random fresh base
    const firstLocked = state.colors.find(c => c.locked);
    let baseHsl;
    if (firstLocked) {
      const rgb = hexToRgb(firstLocked.hex);
      baseHsl = rgbToHsl(rgb.r, rgb.g, rgb.b);
    } else {
      baseHsl = getRandomVibrantHsl();
    }

    const generatedHexes = [];

    switch (harmony) {
      case 'analogous': {
        // Adjacent hues, spaced by ~20 to 25 degrees
        const spread = 22;
        const startHue = (baseHsl.h - spread * 2 + 360) % 360;
        for (let i = 0; i < PALETTE_SIZE; i++) {
          const h = (startHue + i * spread) % 360;
          const s = clamp(baseHsl.s + (i % 2 === 0 ? 5 : -5), 45, 90);
          const l = clamp(30 + i * 12, 25, 80);
          const rgb = hslToRgb(h, s, l);
          generatedHexes.push(rgbToHex(rgb.r, rgb.g, rgb.b));
        }
        break;
      }

      case 'monochromatic': {
        // Same hue, vary lightness and saturation
        for (let i = 0; i < PALETTE_SIZE; i++) {
          const h = baseHsl.h;
          const s = clamp(baseHsl.s - i * 8, 30, 95);
          const l = clamp(18 + i * 16, 18, 88);
          const rgb = hslToRgb(h, s, l);
          generatedHexes.push(rgbToHex(rgb.r, rgb.g, rgb.b));
        }
        break;
      }

      case 'triadic': {
        // 3 hues spaced 120 degrees apart
        const hues = [
          baseHsl.h,
          (baseHsl.h + 120) % 360,
          (baseHsl.h + 240) % 360,
          (baseHsl.h + 20) % 360,
          (baseHsl.h + 140) % 360
        ];
        for (let i = 0; i < PALETTE_SIZE; i++) {
          const h = hues[i];
          const s = clamp(baseHsl.s + (i % 2 === 0 ? 8 : -8), 50, 90);
          const l = clamp(35 + (i * 10) % 45, 30, 75);
          const rgb = hslToRgb(h, s, l);
          generatedHexes.push(rgbToHex(rgb.r, rgb.g, rgb.b));
        }
        break;
      }

      case 'complementary': {
        // Base hue and opposite hue (180 deg)
        const complementHue = (baseHsl.h + 180) % 360;
        const hues = [
          baseHsl.h,
          baseHsl.h,
          (baseHsl.h + 30) % 360,
          complementHue,
          complementHue
        ];
        const lightnesses = [30, 55, 75, 45, 65];
        for (let i = 0; i < PALETTE_SIZE; i++) {
          const rgb = hslToRgb(hues[i], baseHsl.s, lightnesses[i]);
          generatedHexes.push(rgbToHex(rgb.r, rgb.g, rgb.b));
        }
        break;
      }

      case 'split-complementary': {
        // Base and two hues adjacent to complement (+150 and +210)
        const hues = [
          baseHsl.h,
          (baseHsl.h + 150) % 360,
          (baseHsl.h + 210) % 360,
          (baseHsl.h + 30) % 360,
          (baseHsl.h + 180) % 360
        ];
        const lightnesses = [35, 50, 65, 45, 75];
        for (let i = 0; i < PALETTE_SIZE; i++) {
          const rgb = hslToRgb(hues[i], clamp(baseHsl.s, 50, 85), lightnesses[i]);
          generatedHexes.push(rgbToHex(rgb.r, rgb.g, rgb.b));
        }
        break;
      }

      case 'random':
      default: {
        // Golden ratio distributed hues to ensure distinct, harmonious diversity
        const goldenRatio = 0.618033988749895;
        let startH = Math.random();
        for (let i = 0; i < PALETTE_SIZE; i++) {
          startH = (startH + goldenRatio) % 1;
          const h = Math.floor(startH * 360);
          const s = randomInt(50, 92);
          const l = randomInt(35, 75);
          const rgb = hslToRgb(h, s, l);
          generatedHexes.push(rgbToHex(rgb.r, rgb.g, rgb.b));
        }
        break;
      }
    }

    // Apply only to unlocked colors
    for (let i = 0; i < PALETTE_SIZE; i++) {
      if (!newColors[i].locked) {
        newColors[i].hex = generatedHexes[i];
      }
    }

    state.colors = newColors;
    renderAll();
  }

  /**
   * Reset the palette to curated balanced initial state and unlock all
   */
  function resetPalette() {
    state.colors = [
      { hex: '#2563EB', locked: false },
      { hex: '#06B6D4', locked: false },
      { hex: '#10B981', locked: false },
      { hex: '#F59E0B', locked: false },
      { hex: '#EF4444', locked: false }
    ];
    state.harmony = 'random';
    const harmonySelect = document.getElementById('harmonyModeSelect');
    if (harmonySelect) harmonySelect.value = 'random';
    renderAll();
    showToast('Palette reset to defaults.');
  }

  // =========================================================================
  // Clipboard Operations
  // =========================================================================

  /**
   * Robust clipboard copy with fallback
   */
  async function copyToClipboard(text) {
    if (navigator.clipboard && window.isSecureContext) {
      try {
        await navigator.clipboard.writeText(text);
        return true;
      } catch (err) {
        console.warn('Navigator clipboard error, trying fallback', err);
      }
    }
    // Fallback using textarea
    try {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.position = 'fixed';
      textarea.style.left = '-9999px';
      textarea.style.top = '0';
      textarea.setAttribute('readonly', '');
      document.body.appendChild(textarea);
      textarea.select();
      const successful = document.execCommand('copy');
      document.body.removeChild(textarea);
      return successful;
    } catch (err) {
      console.error('Copy fallback failed', err);
      return false;
    }
  }

  /**
   * Toast notification trigger using Bootstrap 5 Toast API
   */
  function showToast(message, iconClass = 'bi-clipboard-check') {
    const toastEl = document.getElementById('appNotificationToast');
    const toastMessageEl = document.getElementById('toastMessage');
    const toastIconEl = document.getElementById('toastIcon');

    if (!toastEl || !toastMessageEl) return;

    toastMessageEl.textContent = message;
    if (toastIconEl) {
      toastIconEl.className = `bi ${iconClass} me-2 text-primary`;
    }

    const toast = bootstrap.Toast.getOrCreateInstance(toastEl, { delay: 2600 });
    toast.show();
  }

  // =========================================================================
  // Storage Management (Favorites)
  // =========================================================================

  function loadSavedPalettesFromStorage() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          state.savedPalettes = parsed;
          return;
        }
      }
    } catch (e) {
      console.error('Failed to parse saved palettes from localStorage', e);
    }
    // Default starter palettes
    state.savedPalettes = [...STARTER_PALETTES];
    savePalettesToStorage();
  }

  function savePalettesToStorage() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state.savedPalettes));
    } catch (e) {
      console.error('Could not save to localStorage', e);
      showToast('Storage limit exceeded or unavailable', 'bi-exclamation-triangle');
    }
  }

  function saveCurrentPalette(customName) {
    const paletteName = customName && customName.trim() ? customName.trim() : `Palette #${state.savedPalettes.length + 1}`;
    const newEntry = {
      id: 'palette-' + Date.now(),
      name: paletteName,
      colors: state.colors.map(c => c.hex),
      createdAt: new Date().toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
    };
    state.savedPalettes.unshift(newEntry);
    savePalettesToStorage();
    renderSavedPalettes();
    showToast(`Saved "${newEntry.name}" to favorites!`, 'bi-heart-fill');
  }

  function deleteSavedPalette(id) {
    state.savedPalettes = state.savedPalettes.filter(p => p.id !== id);
    savePalettesToStorage();
    renderSavedPalettes();
    showToast('Palette removed from favorites.', 'bi-trash');
  }

  function loadSavedPaletteIntoGenerator(id) {
    const found = state.savedPalettes.find(p => p.id === id);
    if (!found || !Array.isArray(found.colors)) return;

    found.colors.forEach((hex, idx) => {
      if (idx < PALETTE_SIZE) {
        state.colors[idx].hex = hex;
        state.colors[idx].locked = false; // unlock when loading a full set
      }
    });

    renderAll();
    showToast(`Loaded "${found.name}" palette!`, 'bi-check2-circle');

    // Smooth scroll to top palette container
    const paletteEl = document.getElementById('paletteContainer');
    if (paletteEl) {
      paletteEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }

  // =========================================================================
  // DOM Rendering & Components
  // =========================================================================

  /**
   * Render the 5 primary color swatches
   */
  function renderPaletteSwatches() {
    const container = document.getElementById('paletteContainer');
    if (!container) return;
    container.innerHTML = '';

    state.colors.forEach((colorObj, index) => {
      const hex = colorObj.hex;
      const isLocked = colorObj.locked;
      const textColor = getContrastingTextColor(hex);
      const isLightText = textColor === '#ffffff';
      const rgb = hexToRgb(hex);
      const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);

      const activeFormattedValue = formatColor(hex, state.format);

      const swatch = document.createElement('div');
      swatch.className = `color-swatch ${isLightText ? 'swatch-dark-mode' : ''}`;
      swatch.style.backgroundColor = hex;
      swatch.style.color = textColor;
      swatch.tabIndex = 0;
      swatch.setAttribute('role', 'region');
      swatch.setAttribute('aria-label', `Color ${index + 1}: ${hex}, ${ROLE_NAMES[index]}. Click to copy value.`);

      swatch.innerHTML = `
        <div class="swatch-top-bar">
          <span class="swatch-index">0${index + 1}</span>
          <div class="d-flex align-items-center gap-2">
            <!-- Hidden native color input -->
            <label class="swatch-btn" title="Pick custom color" aria-label="Pick color for swatch ${index + 1}">
              <i class="bi bi-eyedropper"></i>
              <input type="color" class="color-picker-input" value="${hex}" data-index="${index}">
            </label>
            <!-- Lock/Unlock button -->
            <button type="button" class="swatch-btn ${isLocked ? 'locked' : ''} lock-btn" data-index="${index}" title="${isLocked ? 'Unlock color' : 'Lock color'}" aria-label="${isLocked ? 'Unlock color ' + hex : 'Lock color ' + hex}">
              <i class="bi ${isLocked ? 'bi-lock-fill' : 'bi-unlock'}"></i>
            </button>
          </div>
        </div>

        <div class="swatch-center-indicator">
          <span class="copy-badge-pill">
            <i class="bi bi-copy me-1"></i> Copy ${state.format.toUpperCase()}
          </span>
        </div>

        <div class="swatch-bottom-meta">
          <span class="color-role-tag">${ROLE_NAMES[index]}</span>
          <div class="swatch-primary-code">
            <span>${activeFormattedValue}</span>
            <button type="button" class="btn btn-link p-0 text-inherit text-decoration-none copy-btn-direct" data-value="${activeFormattedValue}" title="Copy value" aria-label="Copy ${activeFormattedValue}">
              <i class="bi bi-clipboard" style="font-size: 0.95rem; opacity: 0.85;"></i>
            </button>
          </div>
          <div class="swatch-secondary-codes">
            ${state.format !== 'hex' ? `<span>HEX: ${hex.toUpperCase()}</span>` : ''}
            ${state.format !== 'rgb' ? `<span>RGB: ${rgb.r}, ${rgb.g}, ${rgb.b}</span>` : ''}
            ${state.format !== 'hsl' ? `<span>HSL: ${hsl.h}°, ${hsl.s}%, ${hsl.l}%</span>` : ''}
          </div>
        </div>
      `;

      // Swatch Click to Copy
      swatch.addEventListener('click', async (e) => {
        // If clicking lock button or color picker input, do not copy
        if (e.target.closest('.lock-btn') || e.target.closest('.color-picker-input') || e.target.closest('label')) {
          return;
        }
        const copied = await copyToClipboard(activeFormattedValue);
        if (copied) {
          showToast(`Copied ${activeFormattedValue} to clipboard!`);
        }
      });

      // Keyboard enter/space to copy
      swatch.addEventListener('keydown', async (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          const copied = await copyToClipboard(activeFormattedValue);
          if (copied) {
            showToast(`Copied ${activeFormattedValue} to clipboard!`);
          }
        }
      });

      // Lock toggle button
      const lockBtn = swatch.querySelector('.lock-btn');
      lockBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        state.colors[index].locked = !state.colors[index].locked;
        renderPaletteSwatches();
        showToast(state.colors[index].locked ? `Locked ${hex}` : `Unlocked ${hex}`, state.colors[index].locked ? 'bi-lock-fill' : 'bi-unlock');
      });

      // Color picker input listener
      const colorInput = swatch.querySelector('.color-picker-input');
      colorInput.addEventListener('input', (e) => {
        const newHex = e.target.value;
        state.colors[index].hex = newHex;
        renderAll();
      });

      // Direct copy button inside swatch
      const directCopyBtn = swatch.querySelector('.copy-btn-direct');
      directCopyBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const copied = await copyToClipboard(activeFormattedValue);
        if (copied) {
          showToast(`Copied ${activeFormattedValue} to clipboard!`);
        }
      });

      container.appendChild(swatch);
    });
  }

  /**
   * Render Gradient Generator Component
   */
  function renderGradientGenerator() {
    const preview = document.getElementById('gradientPreview');
    const cssCodeEl = document.getElementById('gradientCssCode');
    const color1Select = document.getElementById('gradientColor1Select');
    const color2Select = document.getElementById('gradientColor2Select');
    const angleSlider = document.getElementById('gradientAngleRange');
    const angleValueEl = document.getElementById('gradientAngleValue');

    if (!preview || !cssCodeEl || !color1Select || !color2Select) return;

    // Populate dropdown options with current palette colors
    const renderSelectOptions = (selectEl, selectedIdx) => {
      selectEl.innerHTML = '';
      state.colors.forEach((c, i) => {
        const option = document.createElement('option');
        option.value = i;
        option.textContent = `Color 0${i + 1} (${c.hex}) - ${ROLE_NAMES[i]}`;
        if (i === selectedIdx) option.selected = true;
        selectEl.appendChild(option);
      });
    };

    renderSelectOptions(color1Select, state.gradient.color1Index);
    renderSelectOptions(color2Select, state.gradient.color2Index);

    const c1 = state.colors[state.gradient.color1Index]?.hex || state.colors[0].hex;
    const c2 = state.colors[state.gradient.color2Index]?.hex || state.colors[1].hex;
    const angle = state.gradient.angle;
    const isLinear = state.gradient.type === 'linear';

    const gradientCss = isLinear
      ? `linear-gradient(${angle}deg, ${c1}, ${c2})`
      : `radial-gradient(circle, ${c1}, ${c2})`;

    preview.style.background = gradientCss;
    cssCodeEl.textContent = `background: ${gradientCss};`;

    if (angleSlider) angleSlider.value = angle;
    if (angleValueEl) angleValueEl.textContent = `${angle}°`;
  }

  /**
   * Render Contrast Checker Component
   */
  function renderContrastChecker() {
    const fgInput = document.getElementById('contrastFgColor');
    const bgInput = document.getElementById('contrastBgColor');
    const fgSelect = document.getElementById('contrastFgPaletteSelect');
    const bgSelect = document.getElementById('contrastBgPaletteSelect');
    const ratioNumberEl = document.getElementById('contrastRatioNumber');
    const previewBox = document.getElementById('contrastPreviewBox');
    const badgeNormalAA = document.getElementById('badgeNormalAA');
    const badgeLargeAA = document.getElementById('badgeLargeAA');
    const badgeNormalAAA = document.getElementById('badgeNormalAAA');

    if (!ratioNumberEl || !previewBox) return;

    const fgHex = state.contrast.fgHex;
    const bgHex = state.contrast.bgHex;

    if (fgInput) fgInput.value = fgHex;
    if (bgInput) bgInput.value = bgHex;

    // Sync palette dropdowns
    const populatePaletteDropdown = (selectEl, currentHex) => {
      if (!selectEl) return;
      selectEl.innerHTML = '<option value="">-- Choose from Palette --</option>';
      state.colors.forEach((c, idx) => {
        const opt = document.createElement('option');
        opt.value = c.hex;
        opt.textContent = `Color 0${idx + 1}: ${c.hex} (${ROLE_NAMES[idx]})`;
        if (c.hex.toUpperCase() === currentHex.toUpperCase()) {
          opt.selected = true;
        }
        selectEl.appendChild(opt);
      });
    };

    populatePaletteDropdown(fgSelect, fgHex);
    populatePaletteDropdown(bgSelect, bgHex);

    const ratio = getContrastRatio(fgHex, bgHex);
    const formattedRatio = ratio.toFixed(2);
    ratioNumberEl.textContent = `${formattedRatio}:1`;

    // Update live preview box
    previewBox.style.backgroundColor = bgHex;
    previewBox.style.color = fgHex;

    // WCAG Compliances:
    // Normal Text AA: 4.5:1
    // Large Text AA: 3:1
    // Normal Text AAA: 7:1
    const passesNormalAA = ratio >= 4.5;
    const passesLargeAA = ratio >= 3.0;
    const passesNormalAAA = ratio >= 7.0;

    const setBadgeState = (el, passed) => {
      if (!el) return;
      if (passed) {
        el.className = 'wcAG-badge wcag-pass';
        el.innerHTML = '<i class="bi bi-check-circle-fill"></i> Pass';
      } else {
        el.className = 'wcAG-badge wcag-fail';
        el.innerHTML = '<i class="bi bi-x-circle-fill"></i> Fail';
      }
    };

    setBadgeState(badgeNormalAA, passesNormalAA);
    setBadgeState(badgeLargeAA, passesLargeAA);
    setBadgeState(badgeNormalAAA, passesNormalAAA);
  }

  /**
   * Render Live Website Sample Preview
   */
  function renderWebsitePreview() {
    const previewFrame = document.getElementById('websitePreviewFrame');
    if (!previewFrame) return;

    const cPrimary = state.colors[0]?.hex || '#2563EB';
    const cSecondary = state.colors[1]?.hex || '#3B82F6';
    const cAccent = state.colors[2]?.hex || '#60A5FA';
    const cSurface = state.colors[3]?.hex || '#F8FAFC';
    const cMuted = state.colors[4]?.hex || '#64748B';

    // Target elements inside the mock frame
    const heroBanner = previewFrame.querySelector('.mock-hero-banner');
    const heroTitle = previewFrame.querySelector('.mock-hero-title');
    const heroBtn = previewFrame.querySelector('.mock-hero-btn');
    const mockBadge = previewFrame.querySelector('.mock-feature-badge');
    const mockCard = previewFrame.querySelector('.mock-card');
    const mockCardIcon = previewFrame.querySelector('.mock-card-icon');
    const mockBrandLogo = previewFrame.querySelector('.mock-brand-logo');

    const heroTextColor = getContrastingTextColor(cPrimary);
    const heroBtnTextColor = getContrastingTextColor(cAccent);
    const badgeTextColor = getContrastingTextColor(cSecondary);

    if (heroBanner) {
      heroBanner.style.backgroundColor = cPrimary;
      heroBanner.style.color = heroTextColor;
    }
    if (heroTitle) heroTitle.style.color = heroTextColor;
    if (heroBtn) {
      heroBtn.style.backgroundColor = cAccent;
      heroBtn.style.color = heroBtnTextColor;
      heroBtn.style.borderColor = cAccent;
    }
    if (mockBadge) {
      mockBadge.style.backgroundColor = cSecondary;
      mockBadge.style.color = badgeTextColor;
    }
    if (mockCard) {
      mockCard.style.backgroundColor = '#ffffff';
      mockCard.style.borderTop = `4px solid ${cSecondary}`;
    }
    if (mockCardIcon) {
      mockCardIcon.style.color = cPrimary;
    }
    if (mockBrandLogo) {
      mockBrandLogo.style.color = cPrimary;
    }
  }

  /**
   * Render Saved Favorites Palettes
   */
  function renderSavedPalettes() {
    const container = document.getElementById('savedPalettesList');
    const countBadge = document.getElementById('savedPalettesCount');
    if (!container) return;

    if (countBadge) {
      countBadge.textContent = state.savedPalettes.length;
    }

    if (state.savedPalettes.length === 0) {
      container.innerHTML = `
        <div class="col-12 text-center py-4 text-muted">
          <i class="bi bi-heartbreak fs-3 d-block mb-2 text-secondary"></i>
          <p class="mb-0">No saved palettes yet. Click "Save Palette" to store your favorite color themes!</p>
        </div>
      `;
      return;
    }

    container.innerHTML = '';

    state.savedPalettes.forEach(item => {
      const col = document.createElement('div');
      col.className = 'col-md-6 col-lg-4';

      const swatchesHtml = item.colors
        .map(hex => `<div class="saved-swatch-chip" style="background-color: ${hex};" title="${hex}"></div>`)
        .join('');

      col.innerHTML = `
        <div class="saved-palette-card">
          <div class="saved-swatches-strip">
            ${swatchesHtml}
          </div>
          <div class="d-flex justify-content-between align-items-start mb-2">
            <div>
              <h6 class="fw-bold mb-0 text-dark">${item.name}</h6>
              <small class="text-muted" style="font-size: 0.75rem;">${item.createdAt || 'Saved'}</small>
            </div>
            <div class="d-flex gap-1">
              <button class="btn btn-sm btn-outline-primary btn-load-palette" data-id="${item.id}" title="Load palette into editor">
                <i class="bi bi-arrow-up-right me-1"></i> Load
              </button>
              <button class="btn btn-sm btn-outline-danger btn-delete-palette" data-id="${item.id}" title="Delete palette">
                <i class="bi bi-trash"></i>
              </button>
            </div>
          </div>
        </div>
      `;

      col.querySelector('.btn-load-palette').addEventListener('click', () => {
        loadSavedPaletteIntoGenerator(item.id);
      });

      col.querySelector('.btn-delete-palette').addEventListener('click', () => {
        deleteSavedPalette(item.id);
      });

      container.appendChild(col);
    });
  }

  /**
   * Render All Views in Synchrony
   */
  function renderAll() {
    renderPaletteSwatches();
    renderGradientGenerator();
    renderContrastChecker();
    renderWebsitePreview();
  }

  // =========================================================================
  // Export Modal Generation
  // =========================================================================

  function openExportModal() {
    const codeArea = document.getElementById('exportCodeArea');
    const formatSelect = document.getElementById('exportFormatSelect');
    if (!codeArea || !formatSelect) return;

    const generateCode = () => {
      const mode = formatSelect.value;
      if (mode === 'css') {
        const vars = state.colors
          .map((c, i) => `  --color-${ROLE_NAMES[i].toLowerCase()}: ${c.hex}; /* 0${i + 1} */`)
          .join('\n');
        codeArea.value = `:root {\n${vars}\n}`;
      } else if (mode === 'json') {
        const obj = {
          palette: state.colors.map((c, i) => ({
            role: ROLE_NAMES[i],
            hex: c.hex,
            rgb: hexToRgb(c.hex),
            hsl: rgbToHsl(hexToRgb(c.hex).r, hexToRgb(c.hex).g, hexToRgb(c.hex).b)
          }))
        };
        codeArea.value = JSON.stringify(obj, null, 2);
      } else if (mode === 'tailwind') {
        const tw = state.colors
          .map((c, i) => `      'color-${i + 1}': '${c.hex}', // ${ROLE_NAMES[i]}`)
          .join('\n');
        codeArea.value = `// Tailwind CSS theme.colors extension\nmodule.exports = {\n  theme: {\n    extend: {\n      colors: {\n${tw}\n      }\n    }\n  }\n};`;
      }
    };

    generateCode();
    formatSelect.onchange = generateCode;

    const modalEl = document.getElementById('exportModal');
    if (modalEl) {
      const modal = bootstrap.Modal.getOrCreateInstance(modalEl);
      modal.show();
    }
  }

  // =========================================================================
  // Event Listeners & Initialization
  // =========================================================================

  function setupEventListeners() {
    // Generate Palette Button
    const generateBtn = document.getElementById('generatePaletteBtn');
    if (generateBtn) {
      generateBtn.addEventListener('click', () => {
        generatePaletteColors();
      });
    }

    // Reset Palette Button
    const resetBtn = document.getElementById('resetPaletteBtn');
    if (resetBtn) {
      resetBtn.addEventListener('click', () => {
        resetPalette();
      });
    }

    // Harmony Mode Selector
    const harmonySelect = document.getElementById('harmonyModeSelect');
    if (harmonySelect) {
      harmonySelect.addEventListener('change', (e) => {
        state.harmony = e.target.value;
        generatePaletteColors();
      });
    }

    // Format Toggle Radio/Buttons (HEX / RGB / HSL)
    const formatButtons = document.querySelectorAll('[data-format-toggle]');
    formatButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        formatButtons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        state.format = btn.getAttribute('data-format-toggle');
        renderPaletteSwatches();
        showToast(`Display format changed to ${state.format.toUpperCase()}`);
      });
    });

    // Spacebar keyboard shortcut for palette regeneration
    window.addEventListener('keydown', (e) => {
      if (e.code === 'Space' || e.key === ' ') {
        const activeEl = document.activeElement;
        const tagName = activeEl ? activeEl.tagName.toUpperCase() : '';
        const isEditable = activeEl && (activeEl.isContentEditable || activeEl.getAttribute('contenteditable') === 'true');
        const isInput = tagName === 'INPUT' || tagName === 'TEXTAREA' || tagName === 'SELECT';

        // Do not intercept if user is typing, filling inputs or interacting with sliders
        if (isInput || isEditable) {
          return;
        }

        // Prevent page scroll when spacebar is pressed
        e.preventDefault();
        generatePaletteColors();
      }
    });

    // Gradient Color 1 & 2 Selectors
    const gColor1 = document.getElementById('gradientColor1Select');
    const gColor2 = document.getElementById('gradientColor2Select');
    if (gColor1) {
      gColor1.addEventListener('change', (e) => {
        state.gradient.color1Index = parseInt(e.target.value, 10);
        renderGradientGenerator();
      });
    }
    if (gColor2) {
      gColor2.addEventListener('change', (e) => {
        state.gradient.color2Index = parseInt(e.target.value, 10);
        renderGradientGenerator();
      });
    }

    // Gradient Angle Slider
    const gAngle = document.getElementById('gradientAngleRange');
    if (gAngle) {
      gAngle.addEventListener('input', (e) => {
        state.gradient.angle = parseInt(e.target.value, 10);
        renderGradientGenerator();
      });
    }

    // Angle Preset Quick Buttons
    const anglePresets = document.querySelectorAll('[data-angle-preset]');
    anglePresets.forEach(btn => {
      btn.addEventListener('click', () => {
        const val = parseInt(btn.getAttribute('data-angle-preset'), 10);
        state.gradient.angle = val;
        renderGradientGenerator();
      });
    });

    // Copy CSS Gradient Code Button
    const copyGradientBtn = document.getElementById('copyGradientCssBtn');
    if (copyGradientBtn) {
      copyGradientBtn.addEventListener('click', async () => {
        const cssCodeEl = document.getElementById('gradientCssCode');
        if (cssCodeEl) {
          const success = await copyToClipboard(cssCodeEl.textContent);
          if (success) showToast('Gradient CSS copied to clipboard!');
        }
      });
    }

    // Contrast Checker Event Listeners
    const fgInput = document.getElementById('contrastFgColor');
    const bgInput = document.getElementById('contrastBgColor');
    const fgSelect = document.getElementById('contrastFgPaletteSelect');
    const bgSelect = document.getElementById('contrastBgPaletteSelect');
    const swapContrastBtn = document.getElementById('swapContrastColorsBtn');

    if (fgInput) {
      fgInput.addEventListener('input', (e) => {
        state.contrast.fgHex = e.target.value;
        renderContrastChecker();
      });
    }
    if (bgInput) {
      bgInput.addEventListener('input', (e) => {
        state.contrast.bgHex = e.target.value;
        renderContrastChecker();
      });
    }
    if (fgSelect) {
      fgSelect.addEventListener('change', (e) => {
        if (e.target.value) {
          state.contrast.fgHex = e.target.value;
          renderContrastChecker();
        }
      });
    }
    if (bgSelect) {
      bgSelect.addEventListener('change', (e) => {
        if (e.target.value) {
          state.contrast.bgHex = e.target.value;
          renderContrastChecker();
        }
      });
    }
    if (swapContrastBtn) {
      swapContrastBtn.addEventListener('click', () => {
        const temp = state.contrast.fgHex;
        state.contrast.fgHex = state.contrast.bgHex;
        state.contrast.bgHex = temp;
        renderContrastChecker();
      });
    }

    // Save Palette Modal & Buttons
    const saveCurrentPaletteBtn = document.getElementById('savePaletteBtn');
    if (saveCurrentPaletteBtn) {
      saveCurrentPaletteBtn.addEventListener('click', () => {
        const modalEl = document.getElementById('savePaletteModal');
        const nameInput = document.getElementById('paletteNameInput');
        if (nameInput) {
          nameInput.value = `Palette #${state.savedPalettes.length + 1}`;
        }
        if (modalEl) {
          const modal = bootstrap.Modal.getOrCreateInstance(modalEl);
          modal.show();
        }
      });
    }

    const confirmSavePaletteBtn = document.getElementById('confirmSavePaletteBtn');
    if (confirmSavePaletteBtn) {
      confirmSavePaletteBtn.addEventListener('click', () => {
        const nameInput = document.getElementById('paletteNameInput');
        const name = nameInput ? nameInput.value : '';
        saveCurrentPalette(name);
        const modalEl = document.getElementById('savePaletteModal');
        if (modalEl) {
          const modal = bootstrap.Modal.getInstance(modalEl);
          if (modal) modal.hide();
        }
      });
    }

    // Export Palette Button
    const exportPaletteBtn = document.getElementById('exportPaletteBtn');
    if (exportPaletteBtn) {
      exportPaletteBtn.addEventListener('click', () => {
        openExportModal();
      });
    }

    // Copy Export Code Button
    const copyExportCodeBtn = document.getElementById('copyExportCodeBtn');
    if (copyExportCodeBtn) {
      copyExportCodeBtn.addEventListener('click', async () => {
        const codeArea = document.getElementById('exportCodeArea');
        if (codeArea) {
          const success = await copyToClipboard(codeArea.value);
          if (success) showToast('Export code copied to clipboard!');
        }
      });
    }
  }

  // =========================================================================
  // Bootstrap Application
  // =========================================================================
  function init() {
    loadSavedPalettesFromStorage();
    setupEventListeners();
    generatePaletteColors(); // Initial generation
    renderSavedPalettes();
  }

  // Run on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
