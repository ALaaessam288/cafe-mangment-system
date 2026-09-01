/**
 * ═════════════════════════════════════════════════════════════════════
 * SMART LOGO BACKGROUND REMOVER & TRANSPARENCY PROCESSOR
 * ═════════════════════════════════════════════════════════════════════
 * Provides intelligent client-side background removal for café logos:
 * - Auto-detects dominant background color from borders & corners
 * - Boundary-connected flood-fill + Euclidean color distance
 * - Anti-aliased alpha feathering & halo de-contamination
 * - Auto bounding-box trimming for clean, crisp PNG output
 */

/**
 * Calculates Euclidean distance between two RGB colors (0 to 441.67)
 */
function colorDistance(r1, g1, b1, r2, g2, b2) {
  const dr = r1 - r2;
  const dg = g1 - g2;
  const db = b1 - b2;
  return Math.sqrt(dr * dr + dg * dg + db * db);
}

/**
 * Detects dominant edge background color from image boundary pixels
 */
function detectDominantEdgeColor(data, width, height) {
  const edgeSamples = [];
  const step = Math.max(1, Math.floor(Math.min(width, height) / 40));

  // Top & Bottom edges
  for (let x = 0; x < width; x += step) {
    // Top
    const topIdx = (0 * width + x) * 4;
    edgeSamples.push([data[topIdx], data[topIdx + 1], data[topIdx + 2]]);
    // Bottom
    const btmIdx = ((height - 1) * width + x) * 4;
    edgeSamples.push([data[btmIdx], data[btmIdx + 1], data[btmIdx + 2]]);
  }

  // Left & Right edges
  for (let y = 0; y < height; y += step) {
    // Left
    const leftIdx = (y * width + 0) * 4;
    edgeSamples.push([data[leftIdx], data[leftIdx + 1], data[leftIdx + 2]]);
    // Right
    const rightIdx = (y * width + (width - 1)) * 4;
    edgeSamples.push([data[rightIdx], data[rightIdx + 1], data[rightIdx + 2]]);
  }

  // Calculate median / average of corners and edges
  let rSum = 0;
  let gSum = 0;
  let bSum = 0;
  for (const [r, g, b] of edgeSamples) {
    rSum += r;
    gSum += g;
    bSum += b;
  }

  const count = edgeSamples.length || 1;
  return {
    r: Math.round(rSum / count),
    g: Math.round(gSum / count),
    b: Math.round(bSum / count),
  };
}

/**
 * Automatically removes the background from an image and outputs a transparent PNG.
 * 
 * @param {string|HTMLImageElement|File} source - Image Data URL, Image element, or File
 * @param {Object} options
 * @param {'auto'|'white'|'black'|'custom'} [options.mode='auto'] - Color detection mode
 * @param {number} [options.tolerance=35] - Color distance threshold (0 to 150)
 * @param {number} [options.feather=15] - Edge feathering smoothness
 * @param {boolean} [options.floodFillOnly=true] - Only remove background connected to outer borders
 * @param {boolean} [options.autoTrim=true] - Auto trim transparent outer padding
 * @param {{r:number, g:number, b:number}} [options.customColor] - Custom background color
 * @param {number} [options.maxDimension=512] - Max width/height to resize
 * @returns {Promise<{ dataUrl: string, width: number, height: number, detectedBg: string }>}
 */
export async function removeImageBackground(source, options = {}) {
  const {
    mode = 'auto',
    tolerance = 38,
    feather = 18,
    floodFillOnly = true,
    autoTrim = true,
    customColor = null,
    maxDimension = 512,
  } = options;

  const img = await loadImage(source);

  // Resize within maxDimension while maintaining aspect ratio
  let width = img.naturalWidth || img.width;
  let height = img.naturalHeight || img.height;

  if (width > maxDimension || height > maxDimension) {
    if (width > height) {
      height = Math.round((height * maxDimension) / width);
      width = maxDimension;
    } else {
      width = Math.round((width * maxDimension) / height);
      height = maxDimension;
    }
  }

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(img, 0, 0, width, height);

  const imgData = ctx.getImageData(0, 0, width, height);
  const data = imgData.data;

  // Determine target background color
  let bgR = 255;
  let bgG = 255;
  let bgB = 255;

  if (mode === 'white') {
    bgR = 255; bgG = 255; bgB = 255;
  } else if (mode === 'black') {
    bgR = 0; bgG = 0; bgB = 0;
  } else if (mode === 'custom' && customColor) {
    bgR = customColor.r; bgG = customColor.g; bgB = customColor.b;
  } else {
    // Auto-detect dominant edge background color
    const detected = detectDominantEdgeColor(data, width, height);
    bgR = detected.r;
    bgG = detected.g;
    bgB = detected.b;
  }

  const detectedHex = `#${((1 << 24) + (bgR << 16) + (bgG << 8) + bgB).toString(16).slice(1)}`;

  const totalPixels = width * height;
  const visited = new Uint8Array(totalPixels);
  const isBg = new Uint8Array(totalPixels);

  if (floodFillOnly) {
    // Boundary-Connected Flood Fill starting from image perimeter
    const queue = [];

    // Push top & bottom borders
    for (let x = 0; x < width; x++) {
      queue.push(0 * width + x);
      queue.push((height - 1) * width + x);
    }
    // Push left & right borders
    for (let y = 0; y < height; y++) {
      queue.push(y * width + 0);
      queue.push(y * width + (width - 1));
    }

    let head = 0;
    while (head < queue.length) {
      const idx = queue[head++];
      if (visited[idx]) continue;
      visited[idx] = 1;

      const px = idx % width;
      const py = Math.floor(idx / width);
      const dataIdx = idx * 4;

      const r = data[dataIdx];
      const g = data[dataIdx + 1];
      const b = data[dataIdx + 2];
      const a = data[dataIdx + 3];

      if (a === 0) {
        isBg[idx] = 1;
        // Expand transparent areas
        if (px > 0 && !visited[idx - 1]) queue.push(idx - 1);
        if (px < width - 1 && !visited[idx + 1]) queue.push(idx + 1);
        if (py > 0 && !visited[idx - width]) queue.push(idx - width);
        if (py < height - 1 && !visited[idx + width]) queue.push(idx + width);
        continue;
      }

      const dist = colorDistance(r, g, b, bgR, bgG, bgB);

      if (dist <= tolerance + feather) {
        isBg[idx] = 1;

        // Push 4-connected neighbors
        if (px > 0 && !visited[idx - 1]) queue.push(idx - 1);
        if (px < width - 1 && !visited[idx + 1]) queue.push(idx + 1);
        if (py > 0 && !visited[idx - width]) queue.push(idx - width);
        if (py < height - 1 && !visited[idx + width]) queue.push(idx + width);
      }
    }
  }

  // Apply alpha and de-contamination
  for (let i = 0; i < totalPixels; i++) {
    const dataIdx = i * 4;
    const r = data[dataIdx];
    const g = data[dataIdx + 1];
    const b = data[dataIdx + 2];
    const a = data[dataIdx + 3];

    if (a === 0) continue;

    const dist = colorDistance(r, g, b, bgR, bgG, bgB);

    if (floodFillOnly) {
      if (isBg[i]) {
        if (dist <= tolerance) {
          data[dataIdx + 3] = 0; // Fully transparent
        } else if (dist < tolerance + feather) {
          // Smooth alpha transition
          const alphaFactor = (dist - tolerance) / feather;
          data[dataIdx + 3] = Math.round(a * alphaFactor);
        }
      }
    } else {
      // Global keying
      if (dist <= tolerance) {
        data[dataIdx + 3] = 0;
      } else if (dist < tolerance + feather) {
        const alphaFactor = (dist - tolerance) / feather;
        data[dataIdx + 3] = Math.round(a * alphaFactor);
      }
    }
  }

  ctx.putImageData(imgData, 0, 0);

  // Auto-Trim (Bounding box crop to remove excess transparent borders)
  let finalCanvas = canvas;
  if (autoTrim) {
    finalCanvas = trimTransparentCanvas(canvas, ctx, width, height, 12);
  }

  return {
    dataUrl: finalCanvas.toDataURL('image/png'),
    width: finalCanvas.width,
    height: finalCanvas.height,
    detectedBg: detectedHex,
  };
}

/**
 * Trims excess transparent padding from a canvas
 */
function trimTransparentCanvas(sourceCanvas, sourceCtx, width, height, padding = 8) {
  const imgData = sourceCtx.getImageData(0, 0, width, height);
  const data = imgData.data;

  let minX = width;
  let minY = height;
  let maxX = 0;
  let maxY = 0;
  let hasPixels = false;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const alpha = data[(y * width + x) * 4 + 3];
      if (alpha > 10) {
        hasPixels = true;
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }

  if (!hasPixels) return sourceCanvas;

  minX = Math.max(0, minX - padding);
  minY = Math.max(0, minY - padding);
  maxX = Math.min(width - 1, maxX + padding);
  maxY = Math.min(height - 1, maxY + padding);

  const cropW = maxX - minX + 1;
  const cropH = maxY - minY + 1;

  const croppedCanvas = document.createElement('canvas');
  croppedCanvas.width = cropW;
  croppedCanvas.height = cropH;
  const croppedCtx = croppedCanvas.getContext('2d');
  croppedCtx.drawImage(sourceCanvas, minX, minY, cropW, cropH, 0, 0, cropW, cropH);

  return croppedCanvas;
}

/**
 * Loads an image from a File, Blob, Data URL or image element into an HTMLImageElement
 */
function loadImage(source) {
  return new Promise((resolve, reject) => {
    if (source instanceof HTMLImageElement) {
      if (source.complete) return resolve(source);
      source.onload = () => resolve(source);
      source.onerror = reject;
      return;
    }

    const img = new Image();
    img.crossOrigin = 'Anonymous';
    img.onload = () => resolve(img);
    img.onerror = (err) => reject(new Error('فشل تحميل الصورة: ' + (err.message || 'صيغة غير مدعومة')));

    if (typeof source === 'string') {
      img.src = source;
    } else if (source instanceof Blob || source instanceof File) {
      const reader = new FileReader();
      reader.onload = (e) => { img.src = e.target.result; };
      reader.onerror = reject;
      reader.readAsDataURL(source);
    } else {
      reject(new Error('مصدر الصورة غير صالح'));
    }
  });
}

