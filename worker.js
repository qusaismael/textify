// Listen for messages from the main thread
self.onmessage = (e) => {
  const {
    imageData,
    width,
    height,
    mode,
    threshold,
    char0,
    char1,
    col0,
    col1,
    brightness,
    contrast,
    grayscaleChars,
    emojiChars,
    colorMode,
    customColor
  } = e.data;

  const d = imageData.data;

  /*******************************************************
   * 1) Apply Brightness and Contrast Adjustments
   *******************************************************/
  /**
   * Adjusts the brightness and contrast of the image data.
   * @param {Uint8ClampedArray} d - The image data array.
   * @param {number} brightnessVal - Brightness adjustment value.
   * @param {number} contrastVal - Contrast adjustment value.
   */
  function applyBrightnessContrast(d, brightnessVal, contrastVal) {
    const bFactor = parseFloat(brightnessVal);
    const cFactor = parseFloat(contrastVal);
    const contrastScale = (cFactor + 100) / 100;     // e.g., contrast=50 => scale=1.5
    const brightnessOffset = bFactor * (255 / 100);  // e.g., brightness=10 => offset=25.5

    for (let i = 0; i < d.length; i += 4) {
      let r = d[i] + brightnessOffset;
      let g = d[i+1] + brightnessOffset;
      let b = d[i+2] + brightnessOffset;

      r = ((r - 128) * contrastScale) + 128;
      g = ((g - 128) * contrastScale) + 128;
      b = ((b - 128) * contrastScale) + 128;

      // Clamp values to [0, 255]
      d[i]   = Math.max(0, Math.min(255, r));
      d[i+1] = Math.max(0, Math.min(255, g));
      d[i+2] = Math.max(0, Math.min(255, b));
    }
  }

  // Apply brightness & contrast adjustments if needed
  if (brightness !== 0 || contrast !== 0) {
    applyBrightnessContrast(d, brightness, contrast);
  }

  /*******************************************************
   * 2) Generate ASCII, Binary, or Emoji Art
   *******************************************************/
  let rawTextOutput = "";
  let htmlOutput = "";

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const index = (y * width + x) * 4;
      const r = d[index];
      const g = d[index + 1];
      const b = d[index + 2];
      const brightnessVal = (r + g + b) / 3;

      if (mode === "binary") {
        // Binary mode: Use char0 and char1 based on threshold
        if (brightnessVal >= threshold) {
          htmlOutput += `<span style="color:${col1}">${char1}</span>`;
          rawTextOutput += char1;
        } else {
          htmlOutput += `<span style="color:${col0}">${char0}</span>`;
          rawTextOutput += char0;
        }
      } 
      else if (mode === "ascii" || mode === "emoji") {
        // ASCII or Emoji mode: Select character based on brightness
        const charArray = (mode === "ascii") ? grayscaleChars : emojiChars;
        const idx = Math.floor((brightnessVal / 255) * (charArray.length - 1));
        const asciiChar = charArray[idx];

        // Determine the final color
        let charColor = `rgb(${r}, ${g}, ${b})`; // default "original"

        if (colorMode === 'custom') {
          charColor = customColor;
        } 
        else if (colorMode === 'bw') {
          charColor = (brightnessVal > 150) ? "#FFFFFF" : "#000000";
        }
        else if (colorMode === 'grayscale') {
          // Convert pixel to grayscale color (like a shade of gray)
          charColor = `rgb(${brightnessVal}, ${brightnessVal}, ${brightnessVal})`;
        }

        htmlOutput += `<span style="color:${charColor}">${asciiChar}</span>`;
        rawTextOutput += asciiChar;
      }
    }
    htmlOutput += "<br>";
    rawTextOutput += "\n";
  }

  // Post the generated art back to the main thread
  self.postMessage({ htmlOutput, rawTextOutput });
};