// main.js

/***************************************************
 * Global Variables and DOM Element References
 ***************************************************/
const dragDropArea = document.getElementById('dragDropArea');
const loadingOverlay = document.getElementById('loadingOverlay');

const imageInput = document.getElementById("imageInput");
const output = document.getElementById("output");
const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");

const resolutionInput = document.getElementById("resolution");
const resolutionLabel = document.getElementById("resolutionLabel");

const thresholdInput = document.getElementById("threshold");
const thresholdLabel = document.getElementById("thresholdLabel");

const brightnessInput = document.getElementById("brightness");
const contrastInput = document.getElementById("contrast");

const modeSelect = document.getElementById("modeSelect");
const binaryOptions = document.getElementById("binaryOptions");
const thresholdContainer = document.getElementById('thresholdContainer');

const char0Input = document.getElementById("char0");
const char1Input = document.getElementById("char1");
const color0Input = document.getElementById("color0");
const color1Input = document.getElementById("color1");

const zoomRange = document.getElementById("zoomRange");

const downloadTextBtn = document.getElementById("downloadTextBtn");
const downloadPNGBtn = document.getElementById("downloadPNGBtn");

const rotateBtn = document.getElementById("rotateBtn");

const shareBtn = document.getElementById("shareBtn");
const shareLink = document.getElementById("shareLink");

const languageSelect = document.getElementById("languageSelect");

const undoBtn = document.getElementById("undoBtn");
const redoBtn = document.getElementById("redoBtn");

// Color Mode Elements (ASCII Only)
const colorModeSelect = document.getElementById('colorMode');
const customColorInput = document.getElementById('customColor');

// Internal State Variables
let storedImage = null;
let rotationAngle = 0;
let asciiArtText = "";
let worker = null; // Web Worker instance
let undoStack = [];
let redoStack = [];

// Image Size Limits
const MAX_IMAGE_WIDTH = 2000;
const MAX_IMAGE_HEIGHT = 2000;

// Current Language Setting
let currentLang = 'en';

/***************************************************
 * Initialization on Page Load
 ***************************************************/
initWorker();
loadUserSettings();
checkSharedArt();
toggleArtModeOptions(); // Adjust UI based on art mode
applyTranslations(currentLang);

/***************************************************
 * Event Listeners
 ***************************************************/

// Language Selection Change
languageSelect.addEventListener("change", () => {
  const selectedLang = languageSelect.value;
  setLanguage(selectedLang);
  showToast(`Language changed to: ${selectedLang === 'en' ? 'English' : 'العربية'}`, 'info');
});

// Drag & Drop Events
["dragenter", "dragover"].forEach(evtName => {
  dragDropArea.addEventListener(evtName, e => {
    e.preventDefault();
    e.stopPropagation();
    dragDropArea.classList.add('drag-over');
  });
});
["dragleave", "drop"].forEach(evtName => {
  dragDropArea.addEventListener(evtName, e => {
    e.preventDefault();
    e.stopPropagation();
    dragDropArea.classList.remove('drag-over');
  });
});
dragDropArea.addEventListener('drop', e => {
  const file = e.dataTransfer.files[0];
  if (file && file.type.startsWith("image/")) {
    handleImage(file);
  } else {
    showToast("Please drop a valid image file.", 'warning');
  }
});
dragDropArea.addEventListener('click', () => {
  imageInput.click(); // Trigger file selection dialog
});

// File Input Change Event
imageInput.addEventListener("change", e => {
  const file = e.target.files[0];
  if (file) {
    if (!file.type.startsWith("image/")) {
      showToast("File is not an image. Please select an image file.", 'warning');
      return;
    }
    handleImage(file);
  }
});

// Resolution Slider Input
resolutionInput.addEventListener("input", () => {
  const resolutionValueSpan = resolutionLabel.querySelector('#resolutionValue');
  if (resolutionValueSpan) {
    resolutionValueSpan.textContent = resolutionInput.value;
  }
  saveUserSettings();
  regenerateArtIfPossible();
});

// Threshold Slider Input
thresholdInput.addEventListener("input", () => {
  const thresholdValueSpan = thresholdLabel.querySelector('#thresholdValue');
  if (thresholdValueSpan) {
    thresholdValueSpan.textContent = thresholdInput.value;
  }
  saveUserSettings();
  regenerateArtIfPossible();
});

// Brightness Slider Input
brightnessInput.addEventListener("input", () => {
  const brightnessValueSpan = document.getElementById("brightnessValue");
  if (brightnessValueSpan) {
    brightnessValueSpan.textContent = brightnessInput.value;
  }
  saveUserSettings();
  regenerateArtIfPossible();
});

// Contrast Slider Input
contrastInput.addEventListener("input", () => {
  const contrastValueSpan = document.getElementById("contrastValue");
  if (contrastValueSpan) {
    contrastValueSpan.textContent = contrastInput.value;
  }
  saveUserSettings();
  regenerateArtIfPossible();
});

// Art Mode Selection Change
modeSelect.addEventListener("change", () => {
  toggleArtModeOptions(); // Adjust UI based on selected art mode
  saveUserSettings();
  regenerateArtIfPossible();
});

// ASCII/Binary Options Input
[char0Input, char1Input, color0Input, color1Input].forEach(el => {
  el.addEventListener("input", () => {
    saveUserSettings();
    regenerateArtIfPossible();
  });
});

// Zoom Slider Input
zoomRange.addEventListener("input", () => {
  const zoomValue = zoomRange.value;
  output.style.fontSize = zoomValue + "px";
  output.style.lineHeight = zoomValue + "px";
});

// Download Text Button Click
downloadTextBtn.addEventListener("click", () => {
  downloadAsText(asciiArtText);
});

// Download PNG Button Click
downloadPNGBtn.addEventListener("click", () => {
  downloadAsPNG();
});

// Rotate Button Click
rotateBtn.addEventListener("click", () => {
  rotationAngle = (rotationAngle + 90) % 360;
  saveCurrentState();
  regenerateArtIfPossible();
});

// Share Button Click
shareBtn.addEventListener("click", () => {
  const encoded = btoa(unescape(encodeURIComponent(asciiArtText)));
  const currentURL = window.location.origin + window.location.pathname;
  shareLink.value = `${currentURL}?art=${encoded}`;
  showToast("Shareable link generated!", 'info');
});

// Undo Button Click
undoBtn.addEventListener("click", doUndo);

// Redo Button Click
redoBtn.addEventListener("click", doRedo);

// Color Mode Selection Change
colorModeSelect.addEventListener('change', (e) => {
  const selectedMode = e.target.value;
  customColorInput.disabled = (selectedMode !== 'custom');
  saveUserSettings();
  regenerateArtIfPossible();
});

// Custom Color Input Change
customColorInput.addEventListener('input', () => {
  saveUserSettings();
  regenerateArtIfPossible();
});

// Optional: ESC key to close loading overlay
document.addEventListener("keydown", e => {
  if (e.key === "Escape") {
    loadingOverlay.classList.remove("active");
    showToast("Processing canceled.", 'info');
  }
});

/***************************************************
 * Implementation Functions
 ***************************************************/

/**
 * Handles the uploaded image file
 * @param {File} file - The uploaded image file
 */
function handleImage(file) {
  const preview = document.createElement('div');
  preview.className = 'file-preview';
  preview.innerHTML = `
    ${file.name} (${(file.size/1024).toFixed(1)}KB)
    <button class="remove-file" aria-label="Remove file">×</button>
  `;
  
  dragDropArea.innerHTML = '';
  dragDropArea.appendChild(preview);

  // Remove File Button Click Event
  preview.querySelector('.remove-file').addEventListener('click', () => {
    storedImage = null;
    dragDropArea.innerHTML = 'Drag & Drop an image here or click to select';
    output.innerHTML = '';
    showToast("File removed.", 'info');
  });

  const imgURL = URL.createObjectURL(file);
  const img = new Image();
  img.onload = () => {
    if (img.width > MAX_IMAGE_WIDTH || img.height > MAX_IMAGE_HEIGHT) {
      showToast(`Image is too large (max is ${MAX_IMAGE_WIDTH}x${MAX_IMAGE_HEIGHT}).`, 'warning');
      return;
    }
    storedImage = img;
    rotationAngle = 0;
    saveCurrentState();
    regenerateArtIfPossible();
    showToast("Image loaded successfully!", 'success');
  };
  img.onerror = () => {
    showToast("Could not load image. Please try another file.", 'error');
  };
  img.src = imgURL;
}

/**
 * Regenerates the ASCII/Binary/Emoji art if an image is loaded
 */
function regenerateArtIfPossible() {
  if (!storedImage) return;
  loadingOverlay.classList.add("active");
  generateArtWithWorker(storedImage);
}

/**
 * Sends image data to the Web Worker for processing
 * @param {HTMLImageElement} img - The loaded image
 */
function generateArtWithWorker(img) {
  const width = parseInt(resolutionInput.value, 10);
  const aspectRatio = img.height / img.width;
  const height = Math.round(width * aspectRatio);

  // Set canvas dimensions
  canvas.width = width;
  canvas.height = height;
  ctx.clearRect(0, 0, width, height);

  // Handle rotation
  if (rotationAngle === 90 || rotationAngle === 270) {
    canvas.width = height;
    canvas.height = width;
  }

  ctx.save();
  ctx.translate(canvas.width / 2, canvas.height / 2);
  ctx.rotate((Math.PI / 180) * rotationAngle);
  if (rotationAngle === 90 || rotationAngle === 270) {
    ctx.drawImage(img, -height / 2, -width / 2, height, width);
  } else {
    ctx.drawImage(img, -width / 2, -height / 2, width, height);
  }
  ctx.restore();

  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

  // Prepare data for the worker
  const workerData = {
    imageData,
    width: canvas.width,
    height: canvas.height,
    mode: modeSelect.value,
    threshold: parseInt(thresholdInput.value, 10),
    char0: char0Input.value || "0",
    char1: char1Input.value || "1",
    col0: color0Input.value || "#000000",
    col1: color1Input.value || "#FFFFFF",
    brightness: parseInt(brightnessInput.value, 10),
    contrast: parseInt(contrastInput.value, 10),
    grayscaleChars: ["@", "#", "S", "%", "?", "*", "+", ";", ":", ",", "."],
    emojiChars: ["🌑", "🌘", "🌗", "🌖", "🌕", "🌞", "⭐", "✨", "🌟", "💫"],
    colorMode: colorModeSelect.value,
    customColor: customColorInput.value
  };

  // Send data to the worker
  worker.postMessage(workerData);
}

/**
 * Sets the application language and updates the UI
 * @param {string} lang - Language code ('en' or 'ar')
 */
function setLanguage(lang) {
  currentLang = lang;
  applyTranslations(lang);
  saveUserSettings(); // Ensure language is saved in settings
}

/**
 * Applies translations to the UI elements based on selected language
 * @param {string} lang - Language code
 */
function applyTranslations(lang) {
  if (!translations[lang]) {
    console.error(`Translations for language "${lang}" not found.`);
    return;
  }

  // Translate elements with data-i18n attribute
  const elements = document.querySelectorAll('[data-i18n]');
  elements.forEach(element => {
    const key = element.getAttribute('data-i18n');
    if (translations[lang][key]) {
      // Replace text content for elements like <span>
      if (element.tagName.toLowerCase() === 'span') {
        element.textContent = translations[lang][key];
      } else {
        // Replace innerHTML for elements like <h1>, <h3>, <p>
        element.innerHTML = translations[lang][key];
      }
    } else {
      console.warn(`Translation key "${key}" not found for language "${lang}".`);
    }
  });

  // Translate placeholders for input elements
  const placeholderElements = document.querySelectorAll('[data-i18n-placeholder]');
  placeholderElements.forEach(element => {
    const key = element.getAttribute('data-i18n-placeholder');
    if (translations[lang][key]) {
      element.placeholder = translations[lang][key];
    } else {
      console.warn(`Placeholder translation key "${key}" not found for language "${lang}".`);
    }
  });

  // Update text direction based on language
  const htmlElement = document.getElementById('htmlElement');
  if (lang === 'ar') {
    htmlElement.setAttribute('dir', 'rtl');
    htmlElement.setAttribute('lang', 'ar');
  } else {
    htmlElement.setAttribute('dir', 'ltr');
    htmlElement.setAttribute('lang', 'en');
  }
}

/***************************************************
 * Web Worker Initialization
 ***************************************************/

/**
 * Initializes the Web Worker for image processing
 */
function initWorker() {
  // Create a new Web Worker instance
  worker = new Worker("worker.js");
  
  // Listen for messages from the worker
  worker.onmessage = (e) => {
    let { htmlOutput, rawTextOutput } = e.data;
    asciiArtText = rawTextOutput;

    output.innerHTML = htmlOutput;
    loadingOverlay.classList.remove("active");
    showToast("ASCII art generated!", 'success');

    scrollToOutput();
  };

  // Handle worker errors
  worker.onerror = (err) => {
    console.error("Worker Error:", err);
    loadingOverlay.classList.remove("active");
    showToast("An error occurred while processing the image.", 'error');
  };
}

/***************************************************
 * State Management (Undo/Redo)
 ***************************************************/

/**
 * Saves the current state for undo functionality
 */
function saveCurrentState() {
  const state = {
    rotationAngle,
    resolution: resolutionInput.value,
    threshold: thresholdInput.value,
    brightness: brightnessInput.value,
    contrast: contrastInput.value
  };
  undoStack.push(state);
  redoStack.length = 0; // Clear redo stack
}

/**
 * Performs an undo action
 */
function doUndo() {
  if (undoStack.length > 0) {
    // Current state
    const current = {
      rotationAngle,
      resolution: resolutionInput.value,
      threshold: thresholdInput.value,
      brightness: brightnessInput.value,
      contrast: contrastInput.value
    };
    redoStack.push(current);

    // Previous state
    const prev = undoStack.pop();
    rotationAngle = prev.rotationAngle;
    resolutionInput.value = prev.resolution;
    thresholdInput.value = prev.threshold;
    brightnessInput.value = prev.brightness;
    contrastInput.value = prev.contrast;

    // Update UI Labels
    const resolutionValueSpan = resolutionLabel.querySelector('#resolutionValue');
    if (resolutionValueSpan) {
      resolutionValueSpan.textContent = prev.resolution;
    }

    const thresholdValueSpan = thresholdLabel.querySelector('#thresholdValue');
    if (thresholdValueSpan) {
      thresholdValueSpan.textContent = prev.threshold;
    }

    const brightnessValueSpan = document.getElementById("brightnessValue");
    if (brightnessValueSpan) {
      brightnessValueSpan.textContent = prev.brightness;
    }

    const contrastValueSpan = document.getElementById("contrastValue");
    if (contrastValueSpan) {
      contrastValueSpan.textContent = prev.contrast;
    }

    regenerateArtIfPossible();
    showToast("Undo performed.", 'info');
  } else {
    showToast("Nothing to undo.", 'warning');
  }
}

/**
 * Performs a redo action
 */
function doRedo() {
  if (redoStack.length > 0) {
    // Current state
    const current = {
      rotationAngle,
      resolution: resolutionInput.value,
      threshold: thresholdInput.value,
      brightness: brightnessInput.value,
      contrast: contrastInput.value
    };
    undoStack.push(current);

    // Next state
    const next = redoStack.pop();
    rotationAngle = next.rotationAngle;
    resolutionInput.value = next.resolution;
    thresholdInput.value = next.threshold;
    brightnessInput.value = next.brightness;
    contrastInput.value = next.contrast;

    // Update UI Labels
    const resolutionValueSpan = resolutionLabel.querySelector('#resolutionValue');
    if (resolutionValueSpan) {
      resolutionValueSpan.textContent = next.resolution;
    }

    const thresholdValueSpan = thresholdLabel.querySelector('#thresholdValue');
    if (thresholdValueSpan) {
      thresholdValueSpan.textContent = next.threshold;
    }

    const brightnessValueSpan = document.getElementById("brightnessValue");
    if (brightnessValueSpan) {
      brightnessValueSpan.textContent = next.brightness;
    }

    const contrastValueSpan = document.getElementById("contrastValue");
    if (contrastValueSpan) {
      contrastValueSpan.textContent = next.contrast;
    }

    regenerateArtIfPossible();
    showToast("Redo performed.", 'info');
  } else {
    showToast("Nothing to redo.", 'warning');
  }
}

/***************************************************
 * Utility Functions
 ***************************************************/

/**
 * Toggles the visibility of art mode options based on selected mode
 */
function toggleArtModeOptions() {
  const selectedMode = modeSelect.value;
  const colorModeGroup = document.getElementById('colorModeGroup');
  
  if (selectedMode === "ascii") {
    // Show Color Mode options
    colorModeGroup.style.display = "block";
    colorModeSelect.disabled = false;
    
    // Enable custom color input if 'custom' is selected
    if (colorModeSelect.value === 'custom') {
      customColorInput.disabled = false;
    } else {
      customColorInput.disabled = true;
    }
    
    // Hide Binary options and threshold slider
    binaryOptions.style.display = "none";
    thresholdContainer.style.display = "none";
  } else if (selectedMode === "binary") {
    // Hide Color Mode options
    colorModeGroup.style.display = "none";
    colorModeSelect.disabled = true;
    
    // Show Binary options and threshold slider
    binaryOptions.style.display = "block";
    thresholdContainer.style.display = "block";
    
    // Disable and reset custom color input
    customColorInput.disabled = true;
    customColorInput.value = "#00ff00"; // Reset to default or desired color
  } else if (selectedMode === "emoji") {
    // Hide Color Mode options
    colorModeGroup.style.display = "none";
    colorModeSelect.disabled = true;
    
    // Hide Binary options and threshold slider
    binaryOptions.style.display = "none";
    thresholdContainer.style.display = "none";
    
    // Disable and reset custom color input
    customColorInput.disabled = true;
    customColorInput.value = "#00ff00"; // Reset to default or desired color
  }
}

/**
 * Downloads the ASCII art as a text file
 * @param {string} text - The ASCII art text
 */
function downloadAsText(text) {
  const blob = new Blob([text], { type: "text/plain" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = "ascii-art.txt";
  link.click();
  showToast("Text file downloaded.", 'success');
}

/**
 * Downloads the ASCII art as a PNG image
 */
function downloadAsPNG() {
  loadingOverlay.classList.add("active");
  
  // Capture the output div with higher scaling
  html2canvas(output, {
    scale: 4, 
    logging: false,
    backgroundColor: getComputedStyle(output).backgroundColor,
    allowTaint: true,
    useCORS: true,
    onclone: (clonedDoc) => {
      clonedDoc.getElementById('output').style.fontFamily = '"SFMono-Regular", Menlo, Consolas, "Liberation Mono", monospace'; // Ensure correct font
    }
  }).then(canvas => {
    const link = document.createElement("a");
    link.href = canvas.toDataURL("image/png");
    link.download = "ascii-art.png";
    link.click();
    loadingOverlay.classList.remove("active");
    showToast("PNG file downloaded.", 'success');
  }).catch(error => {
    console.error("Error generating PNG:", error);
    loadingOverlay.classList.remove("active");
    showToast("Failed to download PNG.", 'error');
  });
}

/**
 * Displays a toast notification
 * @param {string} message - The message to display
 * @param {string} type - The type of toast ('success', 'error', 'warning', 'info')
 */
function showToast(message, type) {
  const toast = document.createElement("div");
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  document.body.appendChild(toast);
  setTimeout(() => {
    toast.remove();
  }, 3000);
}

/**
 * Loads user settings from localStorage
 */
function loadUserSettings() {
  const settings = JSON.parse(localStorage.getItem('userSettings'));
  if (settings) {
    currentLang = settings.language || 'en';
    languageSelect.value = currentLang;
    
    rotationAngle = settings.rotationAngle || 0;
    resolutionInput.value = settings.resolution || 100;
    thresholdInput.value = settings.threshold || 128;
    brightnessInput.value = settings.brightness || 0;
    contrastInput.value = settings.contrast || 0;
    
    char0Input.value = settings.char0 || "0";
    char1Input.value = settings.char1 || "1";
    color0Input.value = settings.color0 || "#000000";
    color1Input.value = settings.color1 || "#FFFFFF";
    
    modeSelect.value = settings.mode || "ascii";
    colorModeSelect.value = settings.colorMode || "original";
    customColorInput.value = settings.customColor || "#00ff00";
    
    zoomRange.value = settings.zoom || 6;
    output.style.fontSize = `${zoomRange.value}px`;
    output.style.lineHeight = `${zoomRange.value}px`;
    
    // Update UI Labels
    const resolutionValueSpan = resolutionLabel.querySelector('#resolutionValue');
    if (resolutionValueSpan) {
      resolutionValueSpan.textContent = resolutionInput.value;
    }
    
    const thresholdValueSpan = thresholdLabel.querySelector('#thresholdValue');
    if (thresholdValueSpan) {
      thresholdValueSpan.textContent = thresholdInput.value;
    }
    
    const brightnessValueSpan = document.getElementById("brightnessValue");
    if (brightnessValueSpan) {
      brightnessValueSpan.textContent = brightnessInput.value;
    }
    
    const contrastValueSpan = document.getElementById("contrastValue");
    if (contrastValueSpan) {
      contrastValueSpan.textContent = contrastInput.value;
    }
    
    toggleArtModeOptions();
  }
}

/**
 * Saves user settings to localStorage
 */
function saveUserSettings() {
  const settings = {
    language: currentLang,
    rotationAngle,
    resolution: resolutionInput.value,
    threshold: thresholdInput.value,
    brightness: brightnessInput.value,
    contrast: contrastInput.value,
    char0: char0Input.value,
    char1: char1Input.value,
    color0: color0Input.value,
    color1: color1Input.value,
    mode: modeSelect.value,
    colorMode: colorModeSelect.value,
    customColor: customColorInput.value,
    zoom: zoomRange.value
  };
  localStorage.setItem('userSettings', JSON.stringify(settings));
}

/**
 * Checks if shared art is present in the URL and loads it
 */
function checkSharedArt() {
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.has('art')) {
    try {
      const decoded = decodeURIComponent(escape(atob(urlParams.get('art'))));
      asciiArtText = decoded;
      output.innerHTML = asciiArtText.replace(/\n/g, '<br>');
      showToast("Shared ASCII art loaded!", 'success');
    } catch (error) {
      console.error("Error decoding shared art:", error);
      showToast("Failed to load shared ASCII art.", 'error');
    }
  }
}

/**
 * Scrolls the view to the ASCII art output section
 */
function scrollToOutput() {
  output.scrollIntoView({ behavior: 'smooth' });
}