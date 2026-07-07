import React, { useRef, useEffect } from "react";
import { templateSchema } from "../utils/templateSchema";
import { calculateFitFontSize, wrapAndRenderText } from "../utils/textEngine";

export default function CertificateCanvas({ data }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Draw background
    ctx.fillStyle = templateSchema.colors.background;
    ctx.fillRect(0, 0, templateSchema.dimensions.width, templateSchema.dimensions.height);

    // Draw luxury borders / frame accents
    ctx.strokeStyle = templateSchema.colors.primaryAccent;
    ctx.lineWidth = 8;
    ctx.strokeRect(30, 30, templateSchema.dimensions.width - 60, templateSchema.dimensions.height - 60);

    ctx.strokeStyle = "#1e1e24";
    ctx.lineWidth = 1;
    ctx.strokeRect(45, 45, templateSchema.dimensions.width - 90, templateSchema.dimensions.height - 90);

    // Modern geometric accent corners
    const w = templateSchema.dimensions.width;
    const h = templateSchema.dimensions.height;
    ctx.fillStyle = templateSchema.colors.primaryAccent;
    // Top-Left corner accent
    ctx.fillRect(25, 25, 60, 8);
    ctx.fillRect(25, 25, 8, 60);
    // Top-Right corner accent
    ctx.fillRect(w - 85, 25, 60, 8);
    ctx.fillRect(w - 33, 25, 8, 60);
    // Bottom-Left corner accent
    ctx.fillRect(25, h - 33, 60, 8);
    ctx.fillRect(25, h - 85, 8, 60);
    // Bottom-Right corner accent
    ctx.fillRect(w - 85, h - 33, 60, 8);
    ctx.fillRect(w - 33, h - 85, 8, 60);

    // Flow Auto-layout starting parameters
    const centerX = templateSchema.dimensions.width / 2;
    let currentY = templateSchema.elements.header.y;

    // 1. Render Header
    const header = templateSchema.elements.header;
    ctx.save();
    ctx.font = `${header.fontWeight} ${header.fontSize}px ${header.fontFamily}`;
    ctx.fillStyle = header.color;
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.fillText(header.text, centerX, currentY);
    ctx.restore();
    currentY += header.fontSize + header.spacing;

    // 2. Render SubHeader
    const subHeader = templateSchema.elements.subHeader;
    ctx.save();
    ctx.font = `${subHeader.fontWeight} ${subHeader.fontSize}px ${subHeader.fontFamily}`;
    ctx.fillStyle = subHeader.color;
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.fillText(subHeader.text, centerX, currentY);
    ctx.restore();
    currentY += subHeader.fontSize + subHeader.spacing;

    // 3. Render Recipient Name (with fit scaling)
    const recipient = templateSchema.elements.recipientName;
    const recipientNameText = data?.name || "Recipient Full Name";
    const fittedNameSize = calculateFitFontSize(
      ctx,
      recipientNameText,
      recipient.maxWidth,
      recipient.baseSize,
      recipient.minSize,
      recipient.fontFamily,
      recipient.fontWeight
    );
    
    ctx.save();
    ctx.font = `${recipient.fontWeight} ${fittedNameSize}px ${recipient.fontFamily}`;
    ctx.fillStyle = recipient.color;
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.fillText(recipientNameText, centerX, currentY);
    ctx.restore();
    currentY += fittedNameSize + recipient.spacing;

    // 4. Render Description (with auto wrapping & height flow)
    const desc = templateSchema.elements.description;
    const descText = data?.description || "has successfully completed the curriculum and project specifications.";
    const renderedDescHeight = wrapAndRenderText(
      ctx,
      descText,
      centerX,
      currentY,
      desc.maxWidth,
      desc.lineHeight,
      desc.baseSize,
      desc.fontFamily,
      desc.fontWeight,
      desc.color
    );
    currentY += renderedDescHeight + desc.spacing;

    // 5. Render Footer Line (sticky Y-anchor at 880)
    const footer = templateSchema.elements.footerLine;
    ctx.save();
    ctx.font = `${footer.fontWeight} ${footer.fontSize}px ${footer.fontFamily}`;
    ctx.fillStyle = footer.color;
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.fillText(footer.text, centerX, footer.y);

    // Decorative line under footer signatures
    ctx.strokeStyle = "#3f3f46";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(centerX - 250, footer.y - 15);
    ctx.lineTo(centerX + 250, footer.y - 15);
    ctx.stroke();
    ctx.restore();

  }, [data]);

  const downloadHighResPng = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const link = document.createElement("a");
    link.download = `certificate_${data?.name?.toLowerCase().replace(/\s+/g, "_") || "output"}.png`;
    link.href = canvas.toDataURL("image/png", 1.0);
    link.click();
  };

  return (
    <div className="w-full flex flex-col items-center gap-6">
      <div className="w-full max-w-4xl overflow-hidden rounded-2xl border border-zinc-800 bg-[#0c0c0e] p-2 shadow-2xl">
        <canvas
          ref={canvasRef}
          width={templateSchema.dimensions.width}
          height={templateSchema.dimensions.height}
          className="w-full h-auto aspect-video rounded-xl"
        />
      </div>
      
      <button
        onClick={downloadHighResPng}
        className="px-6 py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-bold shadow-md cursor-pointer transition-all duration-300 text-sm"
      >
        Download High-Res PNG
      </button>
    </div>
  );
}
