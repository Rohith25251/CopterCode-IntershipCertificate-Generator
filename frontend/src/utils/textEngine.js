/**
 * Calculates the optimal font size to fit text within a maximum width.
 */
export function calculateFitFontSize(ctx, text, maxWidth, baseSize, minSize, fontFamily, fontWeight = "normal") {
  let fontSize = baseSize;
  ctx.save();
  
  while (fontSize > minSize) {
    ctx.font = `${fontWeight} ${fontSize}px ${fontFamily}`;
    const metrics = ctx.measureText(text);
    if (metrics.width <= maxWidth) {
      break;
    }
    fontSize--;
  }
  
  ctx.restore();
  return fontSize;
}

/**
 * Wraps text into lines and renders them, returning the calculated height of the text block.
 * Handles split newlines for multi-paragraph formatting.
 */
export function wrapAndRenderText(ctx, text, x, y, maxWidth, lineHeight, fontSize, fontFamily, fontWeight = "normal", color = "#ffffff") {
  ctx.save();
  ctx.font = `${fontWeight} ${fontSize}px ${fontFamily}`;
  ctx.fillStyle = color;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';

  const paragraphs = text.split("\n");
  const lines = [];

  for (const para of paragraphs) {
    const words = para.split(" ");
    let currentLine = "";

    for (let i = 0; i < words.length; i++) {
      const word = words[i];
      const testLine = currentLine ? currentLine + " " + word : word;
      const testWidth = ctx.measureText(testLine).width;
      
      if (testWidth > maxWidth && currentLine) {
        lines.push(currentLine);
        currentLine = word;
      } else {
        currentLine = testLine;
      }
    }
    if (currentLine) {
      lines.push(currentLine);
    }
  }

  // Render each line
  let currentY = y;
  for (let i = 0; i < lines.length; i++) {
    ctx.fillText(lines[i], x, currentY);
    currentY += lineHeight;
  }

  ctx.restore();
  // Return total occupied height
  return lines.length * lineHeight;
}
