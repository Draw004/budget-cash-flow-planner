(() => {
  'use strict';

  const A4_W_PT = 595.28;
  const A4_H_PT = 841.89;

  function bytesFromString(str) { return new TextEncoder().encode(str); }
  function concatBytes(parts) {
    const total = parts.reduce((sum, p) => sum + p.length, 0);
    const out = new Uint8Array(total);
    let offset = 0;
    for (const part of parts) { out.set(part, offset); offset += part.length; }
    return out;
  }
  function dataUrlToBytes(dataUrl) {
    const b64 = dataUrl.slice(dataUrl.indexOf(',') + 1);
    const bin = atob(b64);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i += 1) out[i] = bin.charCodeAt(i);
    return out;
  }

  function makePdfFromJpegs(images) {
    const pageCount = images.length;
    const objectCount = 2 + pageCount * 3;
    const offsets = new Array(objectCount + 1).fill(0);
    const chunks = [];
    let cursor = 0;
    const push = part => {
      const bytes = typeof part === 'string' ? bytesFromString(part) : part;
      chunks.push(bytes); cursor += bytes.length;
    };
    push(new Uint8Array([0x25,0x50,0x44,0x46,0x2d,0x31,0x2e,0x34,0x0a,0x25,0xe2,0xe3,0xcf,0xd3,0x0a]));
    const writeObject = (num, parts) => {
      offsets[num] = cursor; push(`${num} 0 obj\n`);
      parts.forEach(push); push(`\nendobj\n`);
    };
    writeObject(1, [`<< /Type /Catalog /Pages 2 0 R >>`]);
    const kids = Array.from({length: pageCount}, (_, i) => `${3 + i * 3} 0 R`).join(' ');
    writeObject(2, [`<< /Type /Pages /Count ${pageCount} /Kids [${kids}] >>`]);
    images.forEach((img, i) => {
      const pageObj = 3 + i * 3, imageObj = pageObj + 1, contentObj = pageObj + 2;
      writeObject(pageObj, [
        `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${A4_W_PT} ${A4_H_PT}] ` +
        `/Resources << /XObject << /Im${i + 1} ${imageObj} 0 R >> >> /Contents ${contentObj} 0 R >>`
      ]);
      offsets[imageObj] = cursor;
      push(`${imageObj} 0 obj\n`);
      push(`<< /Type /XObject /Subtype /Image /Width ${img.width} /Height ${img.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${img.bytes.length} >>\nstream\n`);
      push(img.bytes); push(`\nendstream\nendobj\n`);
      const stream = bytesFromString(`q\n${A4_W_PT} 0 0 ${A4_H_PT} 0 0 cm\n/Im${i + 1} Do\nQ\n`);
      writeObject(contentObj, [`<< /Length ${stream.length} >>\nstream\n`, stream, `endstream`]);
    });
    const xrefOffset = cursor;
    push(`xref\n0 ${objectCount + 1}\n0000000000 65535 f \n`);
    for (let i = 1; i <= objectCount; i += 1) push(`${String(offsets[i]).padStart(10, '0')} 00000 n \n`);
    push(`trailer\n<< /Size ${objectCount + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`);
    return concatBytes(chunks);
  }

  function createPage(options = {}) {
    const width = options.width || 794, height = options.height || 1123, scale = options.scale || 2.25;
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(width * scale); canvas.height = Math.round(height * scale);
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) throw new Error('PDF canvas is unavailable.');
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    ctx.fillStyle = options.background || '#ffffff'; ctx.fillRect(0, 0, width, height);
    ctx.textBaseline = 'alphabetic'; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    return { canvas, ctx, width, height, scale };
  }

  function roundRect(ctx, x, y, w, h, r, fill, stroke, lineWidth = 1) {
    const rr = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + rr, y); ctx.lineTo(x + w - rr, y); ctx.quadraticCurveTo(x + w, y, x + w, y + rr);
    ctx.lineTo(x + w, y + h - rr); ctx.quadraticCurveTo(x + w, y + h, x + w - rr, y + h);
    ctx.lineTo(x + rr, y + h); ctx.quadraticCurveTo(x, y + h, x, y + h - rr);
    ctx.lineTo(x, y + rr); ctx.quadraticCurveTo(x, y, x + rr, y); ctx.closePath();
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lineWidth; ctx.stroke(); }
  }

  function linesForText(ctx, text, maxWidth) {
    const paragraphs = String(text ?? '').split(/\n/);
    const lines = [];
    for (const paragraph of paragraphs) {
      const words = paragraph.trim().split(/\s+/).filter(Boolean);
      if (!words.length) { lines.push(''); continue; }
      let line = words[0];
      for (let i = 1; i < words.length; i += 1) {
        const test = `${line} ${words[i]}`;
        if (ctx.measureText(test).width <= maxWidth) line = test;
        else { lines.push(line); line = words[i]; }
      }
      lines.push(line);
    }
    return lines;
  }

  function wrappedText(ctx, text, x, y, maxWidth, options = {}) {
    const size = options.size || 10, lineHeight = options.lineHeight || size * 1.35;
    const weight = options.weight || 400, color = options.color || '#13233a';
    const family = options.family || 'Arial';
    ctx.font = `${weight} ${size}px ${family}`; ctx.fillStyle = color;
    ctx.textAlign = options.align || 'left';
    let lines = linesForText(ctx, text, maxWidth);
    if (options.maxLines && lines.length > options.maxLines) {
      lines = lines.slice(0, options.maxLines);
      let last = lines[lines.length - 1];
      while (last && ctx.measureText(`${last}...`).width > maxWidth) last = last.slice(0, -1);
      lines[lines.length - 1] = `${last}...`;
    }
    lines.forEach((line, i) => ctx.fillText(line, x, y + i * lineHeight));
    return y + Math.max(0, lines.length - 1) * lineHeight;
  }

  function text(ctx, value, x, y, options = {}) {
    const size = options.size || 10, weight = options.weight || 400, family = options.family || 'Arial';
    ctx.font = `${weight} ${size}px ${family}`; ctx.fillStyle = options.color || '#13233a';
    ctx.textAlign = options.align || 'left';
    ctx.fillText(String(value ?? ''), x, y);
  }

  function line(ctx, x1, y1, x2, y2, color = '#dce4ea', width = 1) {
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.strokeStyle = color; ctx.lineWidth = width; ctx.stroke();
  }

  async function drawSvgElement(ctx, svgElement, x, y, w, h) {
    if (!svgElement) return;
    const clone = svgElement.cloneNode(true);
    clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    const markup = new XMLSerializer().serializeToString(clone);
    const blob = new Blob([markup], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    try {
      const img = new Image();
      await new Promise((resolve, reject) => { img.onload = resolve; img.onerror = () => reject(new Error('Could not render report chart.')); img.src = url; });
      ctx.drawImage(img, x, y, w, h);
    } finally { URL.revokeObjectURL(url); }
  }

  function canvasToJpeg(canvas, quality = 0.94) {
    const dataUrl = canvas.toDataURL('image/jpeg', quality);
    return { bytes: dataUrlToBytes(dataUrl), width: canvas.width, height: canvas.height };
  }

  function triggerDownload(bytes, filename) {
    const blob = new Blob([bytes], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = filename.endsWith('.pdf') ? filename : `${filename}.pdf`;
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 10000);
  }

  async function downloadCanvases(canvases, options = {}) {
    const images = canvases.map(c => canvasToJpeg(c, options.quality || 0.94));
    const pdf = makePdfFromJpegs(images); triggerDownload(pdf, options.filename || 'carrowmont-report.pdf'); return pdf;
  }

  window.CarrowmontPdfExport = {
    createPage, roundRect, wrappedText, text, line, drawSvgElement, downloadCanvases, makePdfFromJpegs
  };
})();
