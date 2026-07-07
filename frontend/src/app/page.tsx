"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import Image from "next/image";
import { 
  Upload, 
  MapPin, 
  Settings, 
  FileText, 
  CheckCircle, 
  AlertCircle, 
  Download, 
  RotateCcw,
  Link as LinkIcon,
  Trash2,
  ChevronDown,
  Search,
  Type
} from "lucide-react";

// ─── Certificate Font Catalogue ─────────────────────────────────────────────
interface FontOption {
  value: string;     // value sent to backend / ReportLab name
  label: string;
  category: string;
  google?: boolean;
  preview?: string;  // override CSS font-family for preview
}

const CERTIFICATE_FONTS: FontOption[] = [
  // ── Built-in PDF fonts (always available, no download needed) ──
  { value: "Helvetica",             label: "Helvetica",          category: "Built-in" },
  { value: "Helvetica-Bold",        label: "Helvetica Bold",     category: "Built-in" },
  { value: "Times-Roman",           label: "Times Roman",        category: "Built-in", preview: "Times New Roman" },
  { value: "Times-Bold",            label: "Times Bold",         category: "Built-in", preview: "Times New Roman" },
  { value: "Courier",               label: "Courier",            category: "Built-in" },
  // ── Elegant Serif (Google) ──
  { value: "Playfair Display",      label: "Playfair Display",   category: "Serif",     google: true },
  { value: "Cinzel",                label: "Cinzel",             category: "Serif",     google: true },
  { value: "Cinzel Decorative",     label: "Cinzel Decorative",  category: "Serif",     google: true },
  { value: "Cormorant Garamond",    label: "Cormorant Garamond", category: "Serif",     google: true },
  { value: "EB Garamond",           label: "EB Garamond",        category: "Serif",     google: true },
  { value: "Lora",                  label: "Lora",               category: "Serif",     google: true },
  { value: "Merriweather",          label: "Merriweather",       category: "Serif",     google: true },
  { value: "Libre Baskerville",     label: "Libre Baskerville",  category: "Serif",     google: true },
  { value: "Crimson Text",          label: "Crimson Text",       category: "Serif",     google: true },
  { value: "Spectral",              label: "Spectral",           category: "Serif",     google: true },
  { value: "Bitter",                label: "Bitter",             category: "Serif",     google: true },
  { value: "Zilla Slab",            label: "Zilla Slab",         category: "Serif",     google: true },
  // ── Modern Sans-Serif (Google) ──
  { value: "Montserrat",            label: "Montserrat",         category: "Sans-Serif", google: true },
  { value: "Open Sans",             label: "Open Sans",          category: "Sans-Serif", google: true },
  { value: "Roboto",                label: "Roboto",             category: "Sans-Serif", google: true },
  { value: "Poppins",               label: "Poppins",            category: "Sans-Serif", google: true },
  { value: "Raleway",               label: "Raleway",            category: "Sans-Serif", google: true },
  { value: "Nunito",                label: "Nunito",             category: "Sans-Serif", google: true },
  { value: "Lato",                  label: "Lato",               category: "Sans-Serif", google: true },
  { value: "Inter",                 label: "Inter",              category: "Sans-Serif", google: true },
  { value: "Josefin Sans",          label: "Josefin Sans",       category: "Sans-Serif", google: true },
  { value: "Oswald",                label: "Oswald",             category: "Sans-Serif", google: true },
  { value: "Ubuntu",                label: "Ubuntu",             category: "Sans-Serif", google: true },
  { value: "Cabin",                 label: "Cabin",              category: "Sans-Serif", google: true },
  { value: "Exo 2",                 label: "Exo 2",              category: "Sans-Serif", google: true },
  { value: "Quicksand",             label: "Quicksand",          category: "Sans-Serif", google: true },
  { value: "Varela Round",          label: "Varela Round",       category: "Sans-Serif", google: true },
  // ── Script / Calligraphy (Google) ──
  { value: "Dancing Script",        label: "Dancing Script",     category: "Script",    google: true },
  { value: "Great Vibes",           label: "Great Vibes",        category: "Script",    google: true },
  { value: "Pacifico",              label: "Pacifico",           category: "Display",   google: true },
  { value: "Sacramento",            label: "Sacramento",         category: "Script",    google: true },
  { value: "Alex Brush",            label: "Alex Brush",         category: "Script",    google: true },
  { value: "Allura",                label: "Allura",             category: "Script",    google: true },
  { value: "Pinyon Script",         label: "Pinyon Script",      category: "Script",    google: true },
  { value: "Petit Formal Script",   label: "Petit Formal Script",category: "Script",    google: true },
];

const CATEGORY_ORDER = ["Built-in", "Serif", "Sans-Serif", "Script", "Display"];

// ─── FontPicker Component ────────────────────────────────────────────────────
interface FontPickerProps {
  value: string;
  onChange: (font: string) => void;
  accentColor?: string;
}

function FontPicker({ value, onChange, accentColor = "#6d28d9" }: FontPickerProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  const filtered = query.trim()
    ? CERTIFICATE_FONTS.filter(f =>
        f.label.toLowerCase().includes(query.toLowerCase()) ||
        f.category.toLowerCase().includes(query.toLowerCase())
      )
    : CERTIFICATE_FONTS;

  // Group by category in defined order
  const grouped = CATEGORY_ORDER.reduce<Record<string, FontOption[]>>((acc, cat) => {
    const items = filtered.filter(f => f.category === cat);
    if (items.length) acc[cat] = items;
    return acc;
  }, {});

  const selectedFont = CERTIFICATE_FONTS.find(f => f.value === value);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div ref={ref} className="relative w-full">
      {/* Trigger */}
      <button
        type="button"
        onClick={() => { setOpen(o => !o); setQuery(""); }}
        className="w-full flex items-center justify-between gap-2 bg-white border border-zinc-200 rounded-xl px-3 py-2 text-sm shadow-sm hover:border-violet-400 hover:shadow-md transition-all cursor-pointer"
      >
        <span
          className="truncate font-medium text-zinc-800"
          style={{ fontFamily: selectedFont?.preview ?? selectedFont?.value ?? "inherit" }}
        >
          {selectedFont?.label ?? value}
        </span>
        <ChevronDown size={14} className={`text-zinc-400 shrink-0 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute z-[9999] top-full left-0 right-0 mt-1 bg-white border border-zinc-200 rounded-2xl shadow-2xl overflow-hidden">
          {/* Search */}
          <div className="p-2 border-b border-zinc-100">
            <div className="flex items-center gap-2 bg-zinc-50 border border-zinc-200 rounded-lg px-2 py-1.5">
              <Search size={12} className="text-zinc-400 shrink-0" />
              <input
                autoFocus
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Search fonts…"
                className="flex-1 text-xs bg-transparent outline-none text-zinc-700 placeholder:text-zinc-400"
              />
            </div>
          </div>
          {/* List */}
          <div className="max-h-64 overflow-y-auto">
            {Object.entries(grouped).map(([cat, fonts]) => (
              <div key={cat}>
                <div className="px-3 py-1 text-[9px] font-black uppercase tracking-[0.2em] text-zinc-400 bg-zinc-50 border-b border-zinc-100">{cat}</div>
                {fonts.map(font => (
                  <button
                    key={font.value}
                    type="button"
                    onClick={() => { onChange(font.value); setOpen(false); }}
                    className={`w-full text-left px-3 py-2.5 text-[13px] transition-colors cursor-pointer hover:bg-violet-50 ${
                      font.value === value ? "bg-violet-100 text-violet-700" : "text-zinc-700"
                    }`}
                    style={{ fontFamily: font.preview ?? font.value }}
                  >
                    {font.label}
                    {font.value === value && <span className="float-right text-violet-500 text-xs">✓</span>}
                  </button>
                ))}
              </div>
            ))}
            {Object.keys(grouped).length === 0 && (
              <p className="px-3 py-6 text-xs text-zinc-400 text-center">No fonts match &quot;{query}&quot;</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

interface Point {
  x: number; // 0 to 1
  y: number; // 0 to 1
}

interface CertRow {
  name: string;
  college: string;
  batch: string;
  department?: string;
  cert_code?: string;
  pdf_url?: string;
  status: "active" | "error" | "pending" | "processing";
  error?: string;
}

// ─── Field Box type (left-top corner + width/height, all as fractions 0–1) ──────────────────
interface FieldBox { x: number; y: number; w: number; h: number; }

// Sample preview text shown inside each box on the design canvas
const FIELD_SAMPLES: Record<string, string> = {
  name:       "Candidate Name",
  college:    "Institute Name",
  year:       "II Year",
  department: "Computer Science",
  role:       "Intern",
  project:    "Web Development",
  month:      "June",
  date:       "07-07-2026",
};

// Per-field color palette
const FIELD_CFG: Record<string, { border: string; bg: string; text: string; label: string }> = {
  name:       { border: "#7c3aed", bg: "rgba(124,58,237,0.10)",  text: "#7c3aed", label: "NAME" },
  college:    { border: "#4f46e5", bg: "rgba(79,70,229,0.10)",   text: "#4f46e5", label: "COLLEGE" },
  year:       { border: "#0891b2", bg: "rgba(8,145,178,0.10)",   text: "#0891b2", label: "YEAR" },
  department: { border: "#ea580c", bg: "rgba(234,88,12,0.10)",   text: "#ea580c", label: "DEPT" },
  role:       { border: "#db2777", bg: "rgba(219,39,119,0.10)",  text: "#db2777", label: "ROLE" },
  project:    { border: "#d97706", bg: "rgba(217,119,6,0.10)",   text: "#d97706", label: "PROJECT" },
  month:      { border: "#0d9488", bg: "rgba(13,148,136,0.10)",  text: "#0d9488", label: "MONTH" },
  date:       { border: "#2563eb", bg: "rgba(37,99,235,0.10)",   text: "#2563eb", label: "DATE" },
};

export default function AdminDashboard() {
  // App state
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [backendUrl, setBackendUrl] = useState<string>(() => {
    if (typeof window === "undefined") return "http://localhost:5000";

    return localStorage.getItem("cert_generator_backend_url") || "http://localhost:5000";
  });
  
  // Files
  const [templateFile, setTemplateFile] = useState<File | null>(null);
  const [excelFile, setExcelFile] = useState<File | null>(null);
  
  // Loaded Template details
  const [templateId, setTemplateId] = useState<string>("");
  const [previewUrl, setPreviewUrl] = useState<string>("");
  const [pageWidthPt, setPageWidthPt] = useState<number>(0);
  const [pageHeightPt, setPageHeightPt] = useState<number>(0);
  
  // Layout field boxes — stored as left-edge x, top-edge y, width w, height h (all 0–1 fractions)
  const [nameBox,       setNameBox]       = useState<FieldBox>({ x: 0.18, y: 0.41, w: 0.44, h: 0.06 });
  const [collegeBox,    setCollegeBox]    = useState<FieldBox>({ x: 0.12, y: 0.51, w: 0.55, h: 0.05 });
  const [yearBox,       setYearBox]       = useState<FieldBox>({ x: 0.40, y: 0.61, w: 0.20, h: 0.05 });
  const [qrPos, setQrPos] = useState<Point>({ x: 0.75, y: 0.75 });
  const [qrSize, setQrSize] = useState<number>(0.12);
  const [zoomScale, setZoomScale] = useState<number>(1.0);

  // Extra field boxes
  const [departmentBox, setDepartmentBox] = useState<FieldBox>({ x: 0.25, y: 0.46, w: 0.36, h: 0.05 });
  const [roleBox,       setRoleBox]       = useState<FieldBox>({ x: 0.32, y: 0.56, w: 0.24, h: 0.05 });
  const [projectBox,    setProjectBox]    = useState<FieldBox>({ x: 0.20, y: 0.68, w: 0.40, h: 0.05 });
  const [monthBox,      setMonthBox]      = useState<FieldBox>({ x: 0.18, y: 0.74, w: 0.18, h: 0.05 });
  const [dateBox,       setDateBox]       = useState<FieldBox>({ x: 0.55, y: 0.74, w: 0.22, h: 0.05 });
  const [detectedFields, setDetectedFields] = useState<string[]>(["name", "college", "year"]);

  // Helper: get / set any FieldBox by field name
  const getBox = useCallback((field: string): FieldBox => {
    switch (field) {
      case "name":       return nameBox;
      case "college":    return collegeBox;
      case "year":       return yearBox;
      case "department": return departmentBox;
      case "role":       return roleBox;
      case "project":    return projectBox;
      case "month":      return monthBox;
      case "date":       return dateBox;
      default:           return { x: 0.3, y: 0.5, w: 0.3, h: 0.05 };
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nameBox, collegeBox, yearBox, departmentBox, roleBox, projectBox, monthBox, dateBox]);

  const setBox = useCallback((field: string, box: FieldBox) => {
    switch (field) {
      case "name":       setNameBox(box);       break;
      case "college":    setCollegeBox(box);    break;
      case "year":       setYearBox(box);       break;
      case "department": setDepartmentBox(box); break;
      case "role":       setRoleBox(box);       break;
      case "project":    setProjectBox(box);    break;
      case "month":      setMonthBox(box);      break;
      case "date":       setDateBox(box);       break;
    }
  }, []);

  // Canvas pixel dimensions for font-size calculation
  const [canvasDims, setCanvasDims] = useState({ w: 800, h: 600 });

  // Auto-calculate preview font size to fill text box
  const calcFontSize = useCallback((text: string, box: FieldBox): number => {
    const boxW = box.w * canvasDims.w;
    const boxH = box.h * canvasDims.h;
    const fromH = boxH * 0.58;
    const fromW = (boxW * 0.82) / Math.max(1, text.length * 0.58);
    return Math.max(7, Math.min(fromH, fromW));
  }, [canvasDims]);


  // Font settings — one font per field
  const [fontSettings, setFontSettings] = useState<Record<string, string>>({
    name: "Playfair Display",
    college: "Open Sans",
    year: "Open Sans",
    department: "Open Sans",
    role: "Open Sans",
    project: "Open Sans",
    month: "Open Sans",
    date: "Open Sans",
  });

  const setFieldFont = useCallback((field: string, font: string) => {
    setFontSettings(prev => ({ ...prev, [field]: font }));
  }, []);

  // Dragging state: which field + operation (move box or resize box)
  const [dragging, setDragging] = useState<{ field: string; op: "move" | "resize" | "qr" | "qr-resize" } | null>(null);
  const [dragOffset, setDragOffset] = useState<{ ox: number; oy: number }>({ ox: 0, oy: 0 });
  
  // Generator states
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [isSavingLayout, setIsSavingLayout] = useState<boolean>(false);
  const [excelDownloadUrl, setExcelDownloadUrl] = useState<string>("");
  const [generationResults, setGenerationResults] = useState<CertRow[]>([]);
  const [genStats, setGenStats] = useState({ success: 0, failed: 0, total: 0 });
  const [errorMsg, setErrorMsg] = useState<string>("");

  // Refs
  const canvasRef = useRef<HTMLDivElement>(null);

  // Track canvas pixel size whenever preview loads or window resizes
  useEffect(() => {
    const update = () => {
      if (canvasRef.current) {
        setCanvasDims({ w: canvasRef.current.clientWidth, h: canvasRef.current.clientHeight });
      }
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [previewUrl, zoomScale]);

  // ── Load Google Fonts for browser preview ──────────────────────────────────
  useEffect(() => {
    const googleFonts = CERTIFICATE_FONTS.filter(f => f.google);
    const families = googleFonts
      .map(f => `family=${f.value.replace(/ /g, '+')}:wght@400;700`)
      .join("&");
    const existing = document.getElementById("cert-google-fonts");
    if (existing) return;
    const link = document.createElement("link");
    link.id = "cert-google-fonts";
    link.rel = "stylesheet";
    link.href = `https://fonts.googleapis.com/css2?${families}&display=swap`;
    document.head.appendChild(link);
  }, []);

  // Hero Section Fading Slideshow
  const heroImages = ["/hero-1.jpg", "/hero-2.jpg", "/hero-3.jpg", "/hero-4.jpg"];
  const [currentHeroImageIdx, setCurrentHeroImageIdx] = useState<number>(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentHeroImageIdx((prev) => (prev + 1) % heroImages.length);
    }, 4500); // Cross-fade every 4.5 seconds
    return () => clearInterval(timer);
  }, [heroImages.length]);
  
  const saveBackendUrl = (url: string) => {
    setBackendUrl(url);
    localStorage.setItem("cert_generator_backend_url", url);
  };

  const getErrorMessage = (error: unknown) => {
    if (error instanceof Error) {
      return error.message;
    }

    return String(error);
  };

  // Step 1: Upload Template and get preview
  const [isUploadingTemplate, setIsUploadingTemplate] = useState<boolean>(false);

  // Processing animation sub-steps state
  const [activeSubStep, setActiveSubStep] = useState<number>(0);

  const PROCESS_STEPS = {
    1: [
      "Uploading PDF template document...",
      "Extracting document canvas dimensions...",
      "Rendering high-resolution page preview...",
      "Caching base template layers..."
    ],
    2: [
      "Verifying layout coordinate metrics...",
      "Normalizing overlay anchor positions...",
      "Saving layout schema configurations...",
      "Finalizing visual alignment presets..."
    ],
    3: [
      "Reading uploaded Excel record registry...",
      "Validating student name and college listings...",
      "Generating secure cryptographic registry check-codes...",
      "Stitching text layers and compiling PDF certificates...",
      "Compiling final spreadsheet download sheet..."
    ]
  };

  const isProcessing = isUploadingTemplate || isSavingLayout || isGenerating;
  const processingStage = isUploadingTemplate ? 1 : isSavingLayout ? 2 : isGenerating ? 3 : 0;

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isProcessing) {
      setActiveSubStep(0);
      const stepsCount = processingStage === 1 ? 4 : processingStage === 2 ? 4 : 5;
      interval = setInterval(() => {
        setActiveSubStep((prev) => (prev < stepsCount - 1 ? prev + 1 : prev));
      }, 1200);
    } else {
      setActiveSubStep(0);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isProcessing, processingStage]);

  
  const handleTemplateUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!templateFile) return;

    setIsUploadingTemplate(true);
    setErrorMsg("");

    const formData = new FormData();
    formData.append("template_file", templateFile);
    if (excelFile) {
      formData.append("excel_file", excelFile);
    }

    try {
      const response = await fetch(`${backendUrl}/api/template/preview`, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.detail || "Failed to process template PDF");
      }

      const data = await response.json();
      setTemplateId(data.template_id);
      setPreviewUrl(data.preview_image_url);
      setPageWidthPt(data.page_width_pt);
      setPageHeightPt(data.page_height_pt);
      if (data.detected_fields) {
        setDetectedFields(data.detected_fields);
      } else {
        setDetectedFields(["name", "college", "year", "department", "role", "project", "month", "date"]);
      }
      
      // Auto-advance to Step 2
      setStep(2);
    } catch (err: unknown) {
      console.error(err);
        // Provide clearer guidance when network error occurs
        if (err instanceof TypeError) {
          setErrorMsg("Network error: failed to reach backend. Check that the backend is running and the Backend URL is correct (e.g. http://localhost:5000).");
        } else {
          setErrorMsg(getErrorMessage(err) || "An error occurred connecting to the backend server. Please verify the URL and backend status.");
        }
    } finally {
      setIsUploadingTemplate(false);
    }
  };

  // Step 2: Field-box drag / resize
  const handleBoxDown = (
    e: React.PointerEvent,
    field: string,
    op: "move" | "resize"
  ) => {
    e.stopPropagation();
    e.preventDefault();
    if (!canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const mx = (e.clientX - rect.left) / rect.width;
    const my = (e.clientY - rect.top) / rect.height;
    const box = getBox(field);
    // For move: record offset from pointer to box top-left so it follows cleanly
    setDragOffset({ ox: mx - box.x, oy: my - box.y });
    setDragging({ field, op });
  };

  // QR legacy handlers
  const handleQrDown = (e: React.PointerEvent, op: "qr" | "qr-resize") => {
    e.stopPropagation();
    e.preventDefault();
    setDragging({ field: "_qr", op });
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragging || !canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const mx = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const my = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));

    if (dragging.op === "move") {
      const box = getBox(dragging.field);
      setBox(dragging.field, {
        ...box,
        x: Math.max(0, Math.min(1 - box.w, mx - dragOffset.ox)),
        y: Math.max(0, Math.min(1 - box.h, my - dragOffset.oy)),
      });
    } else if (dragging.op === "resize") {
      const box = getBox(dragging.field);
      // pointer IS the new bottom-right corner
      setBox(dragging.field, {
        ...box,
        w: Math.max(0.04, Math.min(1 - box.x, mx - box.x)),
        h: Math.max(0.02, Math.min(1 - box.y, my - box.y)),
      });
    } else if (dragging.op === "qr") {
      const maxL = 1 - qrSize;
      const maxT = 1 - qrSize;
      setQrPos({ x: Math.max(0, Math.min(maxL, mx)), y: Math.max(0, Math.min(maxT, my)) });
    } else if (dragging.op === "qr-resize") {
      const newSize = Math.max(0.04, Math.min(0.4, mx - qrPos.x));
      setQrSize(newSize);
    }
  };

  const handlePointerUp = () => { setDragging(null); };

  const handleSaveLayout = async () => {
    if (!templateId) return;
    setIsSavingLayout(true);
    setErrorMsg("");

    // Convert FieldBox (left/top + w/h) to center-based Position for backend
    // We also pass w and h so backend can auto-size the font
    const boxToPos = (b: FieldBox) => ({ x: b.x + b.w / 2, y: b.y + b.h / 2, w: b.w, h: b.h });

    try {
      const response = await fetch(`${backendUrl}/api/template/layout`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          template_id: templateId,
          name_pos:       boxToPos(nameBox),
          college_pos:    boxToPos(collegeBox),
          year_pos:       boxToPos(yearBox),
          qr_pos:         qrPos,
          qr_size:        qrSize,
          department_pos: boxToPos(departmentBox),
          role_pos:       boxToPos(roleBox),
          project_pos:    boxToPos(projectBox),
          month_pos:      boxToPos(monthBox),
          date_pos:       boxToPos(dateBox),
          font_settings:  fontSettings,
        }),
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.detail || "Failed to save layout positions");
      }
      setStep(3);
    } catch (err: unknown) {
      console.error(err);
      setErrorMsg(getErrorMessage(err) || "Failed to save layout. Please try again.");
    } finally {
      setIsSavingLayout(false);
    }
  };

  // Step 3: Trigger Generation
  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!excelFile || !templateId) return;

    setIsGenerating(true);
    setExcelDownloadUrl("");
    setGenerationResults([]);
    setErrorMsg("");

    const formData = new FormData();
    formData.append("template_id", templateId);
    formData.append("excel_file", excelFile);

    try {
      const response = await fetch(`${backendUrl}/api/generate`, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.detail || "Failed to generate certificates");
      }

      const data = await response.json();
      setExcelDownloadUrl(data.excel_download_url);
      setGenerationResults(data.rows);

      // Compute statistics
      const total = data.rows.length;
      const rows = data.rows as CertRow[];
      const success = rows.filter((row) => row.status === "active").length;
      const failed = total - success;
      setGenStats({ success, failed, total });

    } catch (err: unknown) {
      console.error(err);
      setErrorMsg(getErrorMessage(err) || "Certificate generation failed. Verify file parameters.");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleReset = () => {
    setTemplateFile(null);
    setExcelFile(null);
    setTemplateId("");
    setPreviewUrl("");
    setExcelDownloadUrl("");
    setGenerationResults([]);
    setStep(1);
    setErrorMsg("");
    setDetectedFields(["name", "college", "year"]);
  };

  return (
    <div className="relative min-h-screen overflow-hidden pb-16 text-stone-850">
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[#faf9f6]" />

      <header className="sticky top-0 z-50 border-b border-black/5 bg-white/70 backdrop-blur-2xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-6 px-6 py-4">
          <div className="flex items-center gap-3.5">
            <div className="relative h-14 w-14 rounded-2xl bg-black shadow-sm flex items-center justify-center">
              <div className="relative h-12 w-12">
                <Image src="/coptercode-logo.svg" alt="CopterCode logo" fill className="object-contain" priority />
              </div>
            </div>
            <span className="font-sans text-2xl font-bold tracking-tight text-[#0f172a]">
              CopterCode
            </span>
          </div>

          <div className="hidden items-center rounded-full border border-black/5 bg-white px-4 py-2 shadow-[0_2px_12px_rgba(0,0,0,0.02)] lg:flex">
            <span className="text-[10px] font-bold uppercase tracking-[0.24em] text-stone-500">
              Intern Certificate Generator
            </span>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-6 pt-10">

        {/* Full-width Immersive Hero Section with Smooth Fading Slideshow */}
        <div className="relative mb-12 overflow-hidden rounded-[32px] h-[360px] md:h-[400px] w-full shadow-[0_15px_50px_rgba(0,0,0,0.08)] border-4 border-white">
          {heroImages.map((src, idx) => {
            const isActive = idx === currentHeroImageIdx;
            return (
              <div
                key={src}
                className="absolute inset-0 bg-cover bg-center transition-opacity duration-1000 ease-in-out"
                style={{
                  backgroundImage: `url('${src}')`,
                  opacity: isActive ? 1 : 0,
                  zIndex: isActive ? 1 : 0
                }}
              />
            );
          })}
        </div>

        {/* Error Toast */}
        {errorMsg && (
          <div className="mb-6 flex items-start gap-3 bg-red-50 border border-red-200 p-4 rounded-xl text-red-800">
            <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
            <div>
              <h4 className="font-bold text-sm">Action Failed</h4>
              <p className="text-xs text-red-700 mt-1">{errorMsg}</p>
            </div>
          </div>
        )}

        {/* Active Stage Guidance Note Card */}
        <div id="active-stage-card" className="mb-8 rounded-3xl border border-emerald-100 bg-white p-6 shadow-[0_8px_30px_rgba(0,0,0,0.02)] flex flex-col md:flex-row md:items-center justify-between gap-6 relative overflow-hidden">
          {/* Accent vertical border detail */}
          <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-[#12a150]" />
          
          <div className="flex flex-col md:flex-row items-start md:items-center gap-5">
            {/* Step badge */}
            <div className="rounded-2xl border border-[#12a150]/20 bg-[#12a150]/10 px-4 py-2 text-center shrink-0">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#12a150] block">Active Stage</span>
              <span className="text-xl font-bold font-mono text-[#12a150] mt-0.5 block">0{step} / 03</span>
            </div>
            
            {/* Note text */}
            <div>
              <h3 className="text-base font-bold text-stone-900 flex items-center gap-2">
                <span className="inline-block w-2 h-2 rounded-full bg-[#12a150] animate-pulse" />
                {step === 1 && "Upload Base Certificate Files"}
                {step === 2 && "Configure Target Coordinate Overlay"}
                {step === 3 && "Compile Batch Certificate Run"}
              </h3>
              <p className="mt-1.5 text-xs text-stone-600 leading-relaxed max-w-3xl">
                {step === 1 && "Note: Select the Canva-exported base template PDF and the intern details excel sheet (.xlsx). The document processor will automatically prepare canvas templates and calculate coordinates dimensions."}
                {step === 2 && "Note: Drag the circles to define name, college, and batch position anchors relative to document resolution. Use the bottom-right corner handles to scale the QR verification box layout."}
                {step === 3 && "Note: Verify intern record mappings and run the generator. The platform will inject verification anchors, map Supabase registry database, build QR verification codes, and pack final PDFs."}
              </p>
            </div>
          </div>

          {/* Action indicator button/icon on right */}
          <div className="hidden lg:flex items-center gap-2 shrink-0">
            <span className="text-[10px] font-bold uppercase tracking-wider text-stone-400">Status</span>
            <div className="flex items-center gap-2 bg-[#12a150] px-4 py-2 rounded-full shadow-[0_4px_12px_rgba(18,161,80,0.15)] select-none">
              <div className="w-1.5 h-1.5 rounded-full bg-white animate-ping" />
              <span className="text-[10px] font-bold text-white uppercase tracking-wider">Ready</span>
            </div>
          </div>
        </div>

        {/* Dynamic Panels */}
        
        {/* STEP 1: ASSETS UPLOAD */}
        {step === 1 && (
          <div className="rounded-[32px] border border-zinc-800 bg-[#030712] p-8 shadow-[0_18px_60px_rgba(0,0,0,0.15)] text-white">
            <h2 className="font-sans text-2xl font-bold text-white mb-6">
              Upload Base <span className="text-[#3b82f6]">Certificate Files</span>
            </h2>
            <form onSubmit={handleTemplateUpload} className="space-y-8">
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                
                {/* PDF Certificate Template Upload Card */}
                <div className="relative group">
                  <label className="block text-sm font-bold text-zinc-400 mb-2">
                    1. Canva-exported PDF Template
                  </label>
                  <div className={`border-2 border-dashed rounded-2xl p-6 transition-all duration-300 flex flex-col items-center justify-center min-h-[220px] ${
                    templateFile 
                      ? "border-[#3b82f6]/60 bg-[#3b82f6]/8" 
                      : "border-zinc-800 bg-[#0b0f19]/80 hover:border-zinc-700 hover:bg-[#121626]"
                  }`}>
                    <input 
                      type="file" 
                      accept="application/pdf"
                      onChange={(e) => setTemplateFile(e.target.files?.[0] || null)}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    />
                    
                    <FileText className={`w-12 h-12 mb-4 transition-colors ${templateFile ? "text-[#3b82f6]" : "text-zinc-500 group-hover:text-zinc-400"}`} />
                    
                    {templateFile ? (
                      <div className="text-center">
                        <p className="text-sm font-bold text-white">{templateFile.name}</p>
                        <p className="text-xs text-zinc-400 mt-1">{(templateFile.size / 1024 / 1024).toFixed(2)} MB • PDF Template</p>
                        <button 
                          type="button" 
                          onClick={(e) => { e.stopPropagation(); setTemplateFile(null); }}
                          className="mt-3 inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-zinc-800 text-zinc-300 hover:bg-red-950/40 hover:text-red-400 transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" /> Remove
                        </button>
                      </div>
                    ) : (
                      <div className="text-center">
                        <p className="text-sm font-semibold text-zinc-200">Drag & drop your PDF template here</p>
                        <p className="text-xs text-zinc-500 mt-1">Supports PDF up to 15MB</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Excel Intern Details Upload Card */}
                <div className="relative group">
                  <label className="block text-sm font-bold text-zinc-400 mb-2">
                    2. Intern Details Sheet (.xlsx)
                  </label>
                  <div className={`border-2 border-dashed rounded-2xl p-6 transition-all duration-300 flex flex-col items-center justify-center min-h-[220px] ${
                    excelFile 
                      ? "border-emerald-500/60 bg-emerald-500/8" 
                      : "border-zinc-800 bg-[#0b0f19]/80 hover:border-zinc-700 hover:bg-[#121626]"
                  }`}>
                    <input 
                      type="file" 
                      accept=".xlsx,.xls"
                      onChange={(e) => setExcelFile(e.target.files?.[0] || null)}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    />
                    
                    <FileText className={`w-12 h-12 mb-4 transition-colors ${excelFile ? "text-emerald-400" : "text-zinc-500 group-hover:text-zinc-400"}`} />
                    
                    {excelFile ? (
                      <div className="text-center">
                        <p className="text-sm font-bold text-white">{excelFile.name}</p>
                        <p className="text-xs text-zinc-400 mt-1">{(excelFile.size / 1024).toFixed(1)} KB • Columns: Name, College, Batch</p>
                        <button 
                          type="button" 
                          onClick={(e) => { e.stopPropagation(); setExcelFile(null); }}
                          className="mt-3 inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-zinc-800 text-zinc-300 hover:bg-red-950/40 hover:text-red-400 transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" /> Remove
                        </button>
                      </div>
                    ) : (
                      <div className="text-center">
                        <p className="text-sm font-semibold text-zinc-200">Drag & drop your Excel sheet here</p>
                        <p className="text-xs text-zinc-500 mt-1">Must contain: Name, College, Batch columns</p>
                      </div>
                    )}
                  </div>
                </div>

              </div>

              <div className="flex justify-end pt-6 border-t border-zinc-800">
                <button
                  type="submit"
                  disabled={!templateFile || isUploadingTemplate}
                  className={`flex items-center gap-2 px-6 py-3.5 rounded-xl font-bold text-sm transition-all duration-300 ${
                    templateFile && !isUploadingTemplate
                      ? "bg-blue-600 hover:bg-blue-500 text-white shadow-lg cursor-pointer"
                      : "bg-zinc-900 text-zinc-600 border border-zinc-850 cursor-not-allowed"
                  }`}
                >
                  {isUploadingTemplate ? (
                    <>
                      <div className="w-4 h-4 border-2 border-zinc-700 border-t-white rounded-full animate-spin" />
                      Parsing PDF Template...
                    </>
                  ) : (
                    <>
                      Generate Certificate
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* STEP 2: FIELD POSITIONING CANVAS */}
        {step === 2 && previewUrl && (
          <div className="grid grid-cols-1 gap-8 rounded-[32px] border border-black/5 bg-white p-8 shadow-[0_18px_60px_rgba(0,0,0,0.05)] lg:grid-cols-12">
            
            {/* Visual designer canvas area */}
            <div className="lg:col-span-8 flex flex-col items-center">
              <div className="w-full flex items-center justify-between mb-4 flex-wrap gap-3">
                <div className="flex items-center gap-3">
                  <h3 className="text-lg font-bold text-zinc-800">Field Positioning Canvas</h3>
                  <span className="text-xs bg-zinc-100 text-zinc-600 px-3 py-1 rounded-full border border-zinc-200 font-mono">
                    {pageWidthPt.toFixed(0)} × {pageHeightPt.toFixed(0)} pt
                  </span>
                </div>
                
                {/* Zoom controls */}
                <div className="flex items-center gap-1.5 bg-zinc-100 p-1 rounded-xl border border-zinc-200 select-none">
                  <button
                    type="button"
                    onClick={() => setZoomScale(prev => Math.max(0.5, prev - 0.1))}
                    className="w-8 h-8 flex items-center justify-center bg-white hover:bg-zinc-50 border border-zinc-200 rounded-lg text-zinc-650 hover:text-zinc-850 font-bold transition-all text-sm cursor-pointer shadow-sm"
                    title="Zoom Out"
                  >
                    —
                  </button>
                  <span className="px-2 text-xs font-bold text-zinc-700 min-w-[48px] text-center font-mono">
                    {Math.round(zoomScale * 100)}%
                  </span>
                  <button
                    type="button"
                    onClick={() => setZoomScale(prev => Math.min(3.0, prev + 0.1))}
                    className="w-8 h-8 flex items-center justify-center bg-white hover:bg-zinc-50 border border-zinc-200 rounded-lg text-zinc-650 hover:text-zinc-850 font-bold transition-all text-sm cursor-pointer shadow-sm"
                    title="Zoom In"
                  >
                    +
                  </button>
                  {zoomScale !== 1.0 && (
                    <button
                      type="button"
                      onClick={() => setZoomScale(1.0)}
                      className="px-2.5 h-8 flex items-center justify-center bg-zinc-200 hover:bg-zinc-300 border border-zinc-300 rounded-lg text-zinc-750 font-bold transition-all text-[11px] cursor-pointer shadow-sm"
                    >
                      Reset
                    </button>
                  )}
                </div>
              </div>
              
              {/* Scrollable container framing the template canvas */}
              <div className="w-full overflow-auto max-h-[70vh] border border-zinc-200 bg-zinc-50 rounded-2xl p-4 flex items-start justify-center shadow-inner">
                <div 
                  ref={canvasRef}
                  onPointerMove={handlePointerMove}
                  onPointerUp={handlePointerUp}
                  onPointerLeave={handlePointerUp}
                  className="relative select-none border border-zinc-300 bg-white shadow-xl rounded-lg overflow-hidden shrink-0 transition-all duration-150"
                  style={{ 
                    width: `${zoomScale * 100}%`,
                    maxWidth: zoomScale > 1.0 ? "none" : "100%",
                    aspectRatio: `${pageWidthPt}/${pageHeightPt}` 
                  }}
                >
                  {/* Template rendered image */}
                  <Image
                    src={previewUrl}
                    alt="Template preview page"
                    fill
                    unoptimized
                    className="pointer-events-none object-contain"
                    sizes="100vw"
                  />

                  {/* ─── Resizable Text-Box Anchors for each field ─── */}
                  {(["name", "college", "year"] as string[])
                    .concat(detectedFields.filter(f => !["name", "college", "year"].includes(f)))
                    .map((field) => {
                      const box = getBox(field);
                      const cfg = FIELD_CFG[field];
                      const sample = FIELD_SAMPLES[field];
                      const fontSize = calcFontSize(sample, box);
                      const font = fontSettings[field] ?? "inherit";
                      const isActive = dragging?.field === field;
                      return (
                        <div
                          key={field}
                          className="absolute"
                          style={{
                            left:   `${box.x * 100}%`,
                            top:    `${box.y * 100}%`,
                            width:  `${box.w * 100}%`,
                            height: `${box.h * 100}%`,
                            border: `2px solid ${cfg.border}`,
                            background: cfg.bg,
                            borderRadius: 4,
                            cursor: "move",
                            boxShadow: isActive ? `0 0 0 3px ${cfg.border}55` : "none",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            overflow: "hidden",
                            userSelect: "none",
                          }}
                          onPointerDown={(e) => handleBoxDown(e, field, "move")}
                        >
                          {/* Label pill — top-left */}
                          <span
                            style={{
                              position: "absolute",
                              top: 2, left: 4,
                              fontSize: 8,
                              fontWeight: 900,
                              letterSpacing: "0.12em",
                              color: cfg.text,
                              opacity: 0.75,
                              lineHeight: 1,
                              pointerEvents: "none",
                            }}
                          >
                            {cfg.label}
                          </span>

                          {/* Sample value text — auto-sized */}
                          <span
                            style={{
                              fontFamily: font,
                              fontSize,
                              color: cfg.text,
                              fontWeight: 600,
                              whiteSpace: "nowrap",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              maxWidth: "95%",
                              pointerEvents: "none",
                              marginTop: 8,
                            }}
                          >
                            {sample}
                          </span>

                          {/* Resize handle — bottom-right */}
                          <div
                            style={{
                              position: "absolute",
                              bottom: 0, right: 0,
                              width: 12, height: 12,
                              background: cfg.border,
                              borderRadius: "2px 0 4px 0",
                              cursor: "se-resize",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                            }}
                            onPointerDown={(e) => {
                              e.stopPropagation();
                              e.preventDefault();
                              setDragging({ field, op: "resize" });
                            }}
                          >
                            <div style={{ width: 5, height: 5, borderRight: `1.5px solid white`, borderBottom: `1.5px solid white` }} />
                          </div>
                        </div>
                      );
                    })
                  }

                  {/* Resizable QR Box (unchanged) */}
                  <div 
                    className="absolute cursor-move border-2 border-dashed border-emerald-500 bg-emerald-500/10"
                    style={{
                      left: `${qrPos.x * 100}%`,
                      top: `${qrPos.y * 100}%`,
                      width: `${qrSize * 100}%`,
                      aspectRatio: "1/1"
                    }}
                    onPointerDown={(e) => handleQrDown(e, "qr")}
                  >
                    <div className="absolute inset-0 flex items-center justify-center p-1">
                      <span className="text-[10px] md:text-xs font-bold text-emerald-600 tracking-tight text-center bg-white/95 px-2 py-0.5 rounded border border-emerald-500/30 shadow-sm">
                        QR Code
                      </span>
                    </div>
                    <div 
                      className="absolute bottom-0 right-0 w-4 h-4 bg-emerald-500 hover:scale-125 transition-transform cursor-se-resize flex items-center justify-center shadow-lg border border-white rounded-sm"
                      onPointerDown={(e) => { e.stopPropagation(); handleQrDown(e, "qr-resize"); }}
                    >
                      <div className="w-1.5 h-1.5 border-r border-b border-white" />
                    </div>
                  </div>
                </div>
              </div>
              <p className="text-xs text-zinc-550 mt-4 text-center">
                Drag each text box onto your template&apos;s blank field. Pull the bottom-right corner handle to resize.
              </p>
            </div>

            {/* Sidebar properties card */}
            <div className="lg:col-span-4 flex flex-col justify-between">
              <div>
                <h3 className="text-lg font-bold text-zinc-800 mb-4">Layout Parameters</h3>
                <p className="text-xs text-zinc-500 mb-6 leading-relaxed">
                  These coordinate values represent positioning relative to the template&apos;s width and height (fractions 0 to 1). This ensures layout constancy when rendering across dynamic print resolutions.
                </p>

                <div className="space-y-4">
                  {/* Name Pos info */}
                  <div className="bg-zinc-50 border border-zinc-150 p-4 rounded-2xl flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-3 h-3 rounded-full bg-violet-500" />
                      <span className="text-sm font-bold text-zinc-750">Name Overlay</span>
                    </div>
                    <div className="text-xs font-mono text-zinc-500">
                      X: <span className="text-violet-600 font-bold">{((nameBox.x + nameBox.w / 2) * 100).toFixed(1)}%</span> • Y: <span className="text-violet-600 font-bold">{((nameBox.y + nameBox.h / 2) * 100).toFixed(1)}%</span>
                    </div>
                  </div>

                  {/* College Pos info */}
                  <div className="bg-zinc-50 border border-zinc-150 p-4 rounded-2xl flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-3 h-3 rounded-full bg-indigo-500" />
                      <span className="text-sm font-bold text-zinc-750">College Overlay</span>
                    </div>
                    <div className="text-xs font-mono text-zinc-500">
                      X: <span className="text-indigo-600 font-bold">{((collegeBox.x + collegeBox.w / 2) * 100).toFixed(1)}%</span> • Y: <span className="text-indigo-600 font-bold">{((collegeBox.y + collegeBox.h / 2) * 100).toFixed(1)}%</span>
                    </div>
                  </div>

                  {/* Year Pos info */}
                  <div className="bg-zinc-50 border border-zinc-150 p-4 rounded-2xl flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-3 h-3 rounded-full bg-cyan-500" />
                      <span className="text-sm font-bold text-zinc-750">Year Overlay</span>
                    </div>
                    <div className="text-xs font-mono text-zinc-500">
                      X: <span className="text-cyan-600 font-bold">{((yearBox.x + yearBox.w / 2) * 100).toFixed(1)}%</span> • Y: <span className="text-cyan-600 font-bold">{((yearBox.y + yearBox.h / 2) * 100).toFixed(1)}%</span>
                    </div>
                  </div>

                  {/* Department Pos info */}
                  {detectedFields.includes("department") && (
                    <div className="bg-zinc-50 border border-zinc-150 p-4 rounded-2xl flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-3 h-3 rounded-full bg-orange-500" />
                        <span className="text-sm font-bold text-zinc-750">Department Overlay</span>
                      </div>
                      <div className="text-xs font-mono text-zinc-500">
                        X: <span className="text-orange-600 font-bold">{((departmentBox.x + departmentBox.w / 2) * 100).toFixed(1)}%</span> • Y: <span className="text-orange-600 font-bold">{((departmentBox.y + departmentBox.h / 2) * 100).toFixed(1)}%</span>
                      </div>
                    </div>
                  )}

                  {/* Role Pos info */}
                  {detectedFields.includes("role") && (
                    <div className="bg-zinc-50 border border-zinc-150 p-4 rounded-2xl flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-3 h-3 rounded-full bg-pink-500" />
                        <span className="text-sm font-bold text-zinc-750">Role Overlay</span>
                      </div>
                      <div className="text-xs font-mono text-zinc-500">
                        X: <span className="text-pink-600 font-bold">{((roleBox.x + roleBox.w / 2) * 100).toFixed(1)}%</span> • Y: <span className="text-pink-600 font-bold">{((roleBox.y + roleBox.h / 2) * 100).toFixed(1)}%</span>
                      </div>
                    </div>
                  )}

                  {/* Project Pos info */}
                  {detectedFields.includes("project") && (
                    <div className="bg-zinc-50 border border-zinc-150 p-4 rounded-2xl flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-3 h-3 rounded-full bg-amber-500" />
                        <span className="text-sm font-bold text-zinc-750">Project Overlay</span>
                      </div>
                      <div className="text-xs font-mono text-zinc-500">
                        X: <span className="text-amber-600 font-bold">{((projectBox.x + projectBox.w / 2) * 100).toFixed(1)}%</span> • Y: <span className="text-amber-600 font-bold">{((projectBox.y + projectBox.h / 2) * 100).toFixed(1)}%</span>
                      </div>
                    </div>
                  )}

                  {/* Month Pos info */}
                  {detectedFields.includes("month") && (
                    <div className="bg-zinc-50 border border-zinc-150 p-4 rounded-2xl flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-3 h-3 rounded-full bg-teal-500" />
                        <span className="text-sm font-bold text-zinc-750">Month Overlay</span>
                      </div>
                      <div className="text-xs font-mono text-zinc-500">
                        X: <span className="text-teal-600 font-bold">{((monthBox.x + monthBox.w / 2) * 100).toFixed(1)}%</span> • Y: <span className="text-teal-600 font-bold">{((monthBox.y + monthBox.h / 2) * 100).toFixed(1)}%</span>
                      </div>
                    </div>
                  )}

                  {/* Date Pos info */}
                  {detectedFields.includes("date") && (
                    <div className="bg-zinc-50 border border-zinc-150 p-4 rounded-2xl flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-3 h-3 rounded-full bg-blue-500" />
                        <span className="text-sm font-bold text-zinc-750">Date Overlay</span>
                      </div>
                      <div className="text-xs font-mono text-zinc-500">
                        X: <span className="text-blue-600 font-bold">{((dateBox.x + dateBox.w / 2) * 100).toFixed(1)}%</span> • Y: <span className="text-blue-600 font-bold">{((dateBox.y + dateBox.h / 2) * 100).toFixed(1)}%</span>
                      </div>
                    </div>
                  )}

                  {/* QR Box info */}
                  <div className="bg-zinc-50 border border-zinc-150 p-4 rounded-2xl flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-3 h-3 rounded-full bg-emerald-500" />
                        <span className="text-sm font-bold text-zinc-750">QR Code Box</span>
                      </div>
                      <div className="text-xs font-mono text-zinc-500">
                        Size: <span className="text-emerald-600 font-bold">{(qrSize * 100).toFixed(1)}%</span>
                      </div>
                    </div>
                    <div className="text-right text-xs font-mono text-zinc-500 border-t border-zinc-200 pt-2">
                      X: <span className="text-emerald-600 font-bold">{(qrPos.x * 100).toFixed(1)}%</span> • Y: <span className="text-emerald-600 font-bold">{(qrPos.y * 100).toFixed(1)}%</span>
                    </div>
                  </div>
                </div>

                {/* ── Font Settings Section ──────────────────────────────── */}
                <div className="mt-6 pt-5 border-t border-zinc-150">
                  <div className="flex items-center gap-2 mb-4">
                    <Type size={14} className="text-violet-500" />
                    <h4 className="text-sm font-bold text-zinc-800">Font Styles</h4>
                    <span className="ml-auto text-[10px] text-zinc-400 font-medium">Per-field Google Fonts</span>
                  </div>

                  <div className="space-y-3">
                    {/* Name Font */}
                    <div className="flex flex-col gap-1.5">
                      <label className="flex items-center gap-2 text-xs font-semibold text-zinc-600">
                        <span className="w-2.5 h-2.5 rounded-full bg-violet-500 inline-block" />
                        Name
                      </label>
                      <FontPicker value={fontSettings.name} onChange={f => setFieldFont("name", f)} accentColor="#7c3aed" />
                    </div>

                    {/* College Font */}
                    <div className="flex flex-col gap-1.5">
                      <label className="flex items-center gap-2 text-xs font-semibold text-zinc-600">
                        <span className="w-2.5 h-2.5 rounded-full bg-indigo-500 inline-block" />
                        College
                      </label>
                      <FontPicker value={fontSettings.college} onChange={f => setFieldFont("college", f)} />
                    </div>

                    {/* Year Font */}
                    <div className="flex flex-col gap-1.5">
                      <label className="flex items-center gap-2 text-xs font-semibold text-zinc-600">
                        <span className="w-2.5 h-2.5 rounded-full bg-cyan-500 inline-block" />
                        Year
                      </label>
                      <FontPicker value={fontSettings.year} onChange={f => setFieldFont("year", f)} />
                    </div>

                    {/* Department Font */}
                    {detectedFields.includes("department") && (
                      <div className="flex flex-col gap-1.5">
                        <label className="flex items-center gap-2 text-xs font-semibold text-zinc-600">
                          <span className="w-2.5 h-2.5 rounded-full bg-orange-500 inline-block" />
                          Department
                        </label>
                        <FontPicker value={fontSettings.department} onChange={f => setFieldFont("department", f)} />
                      </div>
                    )}

                    {/* Role Font */}
                    {detectedFields.includes("role") && (
                      <div className="flex flex-col gap-1.5">
                        <label className="flex items-center gap-2 text-xs font-semibold text-zinc-600">
                          <span className="w-2.5 h-2.5 rounded-full bg-pink-500 inline-block" />
                          Role
                        </label>
                        <FontPicker value={fontSettings.role} onChange={f => setFieldFont("role", f)} />
                      </div>
                    )}

                    {/* Project Font */}
                    {detectedFields.includes("project") && (
                      <div className="flex flex-col gap-1.5">
                        <label className="flex items-center gap-2 text-xs font-semibold text-zinc-600">
                          <span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block" />
                          Project
                        </label>
                        <FontPicker value={fontSettings.project} onChange={f => setFieldFont("project", f)} />
                      </div>
                    )}

                    {/* Month Font */}
                    {detectedFields.includes("month") && (
                      <div className="flex flex-col gap-1.5">
                        <label className="flex items-center gap-2 text-xs font-semibold text-zinc-600">
                          <span className="w-2.5 h-2.5 rounded-full bg-teal-500 inline-block" />
                          Month
                        </label>
                        <FontPicker value={fontSettings.month} onChange={f => setFieldFont("month", f)} />
                      </div>
                    )}

                    {/* Date Font */}
                    {detectedFields.includes("date") && (
                      <div className="flex flex-col gap-1.5">
                        <label className="flex items-center gap-2 text-xs font-semibold text-zinc-600">
                          <span className="w-2.5 h-2.5 rounded-full bg-blue-500 inline-block" />
                          Date
                        </label>
                        <FontPicker value={fontSettings.date} onChange={f => setFieldFont("date", f)} />
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Action buttons */}
              <div className="mt-8 flex flex-col gap-3 pt-6 border-t border-zinc-150">
                <button
                  onClick={handleSaveLayout}
                  disabled={isSavingLayout}
                  className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white font-bold py-3.5 px-6 rounded-xl shadow-md cursor-pointer transition-all duration-300 text-sm"
                >
                  {isSavingLayout ? (
                    <>
                      <div className="w-4 h-4 border-2 border-zinc-450 border-t-white rounded-full animate-spin" />
                      Saving Coordinates...
                    </>
                  ) : (
                    <>
                      Save Layout & Proceed
                    </>
                  )}
                </button>
                
                <button
                  onClick={handleReset}
                  className="w-full inline-flex items-center justify-center gap-2 border border-zinc-200 bg-white hover:bg-zinc-50 text-zinc-650 hover:text-zinc-800 font-bold py-3 px-6 rounded-xl transition-all duration-300 text-sm"
                >
                  <RotateCcw className="w-4 h-4" /> Start Over
                </button>
              </div>

            </div>

          </div>
        )}

        {/* STEP 3: EXCEL DETAILS UPLOAD & BATCH GENERATION */}
        {step === 3 && (
          <div className="space-y-8">
            
            {/* Generate Trigger Card */}
            <div className="rounded-[32px] border border-black/5 bg-white p-8 shadow-[0_18px_60px_rgba(0,0,0,0.05)]">
              <h2 className="font-display text-2xl text-stone-900 mb-2">
                Generate Certificates Batch
              </h2>
              <p className="text-xs text-zinc-550 mb-6">
                Template and coordinates saved successfully. Next, select your details sheet if not already uploaded, and run the batch processor.
              </p>

              <form onSubmit={handleGenerate} className="space-y-6">
                <div className="bg-zinc-50 border border-zinc-150 p-6 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-6">
                  <div className="flex items-center gap-4">
                    <div className="bg-indigo-50 border border-indigo-150 p-3 rounded-xl text-indigo-650">
                      <FileText className="w-6 h-6" />
                    </div>
                    <div>
                      <h4 className="font-bold text-sm text-zinc-850">Intern Excel Details File</h4>
                      <p className="text-xs text-zinc-500 mt-0.5">
                        {excelFile ? `${excelFile.name} (${(excelFile.size / 1024).toFixed(1)} KB)` : "No Excel file selected"}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    {/* File reselector */}
                    <div className="relative">
                      <button type="button" className="px-4 py-2 border border-zinc-200 bg-white text-xs font-bold text-zinc-650 rounded-lg hover:bg-zinc-50 transition-colors">
                        Select Different File
                      </button>
                      <input 
                        type="file" 
                        accept=".xlsx,.xls"
                        onChange={(e) => setExcelFile(e.target.files?.[0] || null)}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={!excelFile || isGenerating}
                      className={`flex items-center gap-2 px-6 py-2.5 rounded-lg font-extrabold text-xs shadow-md transition-all duration-300 ${
                        excelFile && !isGenerating
                          ? "bg-[#12a150] hover:bg-[#0e8340] text-white cursor-pointer"
                          : "bg-zinc-100 text-zinc-400 border border-zinc-200 cursor-not-allowed"
                      }`}
                    >
                      {isGenerating ? (
                        <>
                          <div className="w-3.5 h-3.5 border-2 border-zinc-450 border-t-white rounded-full animate-spin" />
                          Processing Batch...
                        </>
                      ) : (
                        <>
                          Run Certificate Builder
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </form>
            </div>

            {/* Loading / Results display section */}
            {(isGenerating || generationResults.length > 0) && (
              <div className="space-y-6 rounded-[32px] border border-black/5 bg-white p-8 shadow-[0_18px_60px_rgba(0,0,0,0.05)]">
                
                {/* Header Stats */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-zinc-150">
                  <div>
                    <h3 className="text-lg font-bold text-zinc-800">Batch Processing Results</h3>
                    <p className="text-xs text-zinc-500 mt-0.5">
                      {isGenerating ? "Certificates are currently generating..." : "Processing complete."}
                    </p>
                  </div>

                  {!isGenerating && excelDownloadUrl && (
                    <a 
                      href={excelDownloadUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold py-2.5 px-5 rounded-xl shadow-md text-xs transition-all duration-300"
                    >
                      <Download className="w-4 h-4" /> Download Result Excel Sheet
                    </a>
                  )}
                </div>

                {/* Progress HUD */}
                {!isGenerating && generationResults.length > 0 && (
                  <div className="grid grid-cols-3 gap-4">
                    <div className="bg-zinc-50 border border-zinc-150 p-4 rounded-2xl text-center">
                      <span className="text-zinc-500 text-[10px] font-bold uppercase tracking-wider">Total Rows</span>
                      <p className="text-2xl font-extrabold text-zinc-800 mt-1">{genStats.total}</p>
                    </div>
                    <div className="bg-emerald-50 border border-emerald-100 p-4 rounded-2xl text-center">
                      <span className="text-emerald-600 text-[10px] font-bold uppercase tracking-wider">Generated</span>
                      <p className="text-2xl font-extrabold text-emerald-700 mt-1">{genStats.success}</p>
                    </div>
                    <div className="bg-red-50 border border-red-100 p-4 rounded-2xl text-center">
                      <span className="text-red-600 text-[10px] font-bold uppercase tracking-wider">Errors</span>
                      <p className="text-2xl font-extrabold text-red-700 mt-1">{genStats.failed}</p>
                    </div>
                  </div>
                )}

                {/* Results Table */}
                <div className="overflow-x-auto border border-zinc-150 rounded-2xl bg-white">
                  <table className="w-full text-left border-collapse text-sm">
                    <thead>
                      <tr className="border-b border-zinc-150 bg-zinc-50 text-zinc-550 text-xs font-bold font-mono">
                        <th className="p-4">Intern Name</th>
                        <th className="p-4">College</th>
                        <th className="p-4">Department</th>
                        <th className="p-4">Batch</th>
                        <th className="p-4">Certificate ID</th>
                        <th className="p-4">Status</th>
                        <th className="p-4 text-right">PDF File</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100">
                      {isGenerating ? (
                        <tr>
                          <td colSpan={7} className="p-8 text-center text-zinc-500 text-xs">
                            <div className="w-8 h-8 border-2 border-zinc-200 border-t-violet-500 rounded-full animate-spin mx-auto mb-3" />
                            Overlaying PDF fields and uploading certificates...
                          </td>
                        </tr>
                      ) : (
                        generationResults.map((row, idx) => (
                          <tr key={idx} className="hover:bg-zinc-50/50 transition-colors">
                            <td className="p-4 font-bold text-zinc-800">{row.name}</td>
                            <td className="p-4 text-zinc-650">{row.college}</td>
                            <td className="p-4 text-zinc-650">{row.department || "—"}</td>
                            <td className="p-4 font-mono text-zinc-500 text-xs">{row.batch}</td>
                            <td className="p-4 font-mono text-zinc-700 text-xs">
                              {row.cert_code || <span className="text-zinc-400">—</span>}
                            </td>
                            <td className="p-4">
                              {row.status === "active" ? (
                                <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-emerald-50 border border-emerald-150 text-emerald-700 px-2 py-0.5 rounded-full">
                                  Success
                                </span>
                              ) : (
                                <span className="inline-flex flex-col gap-0.5">
                                  <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-red-50 border border-red-150 text-red-700 px-2 py-0.5 rounded-full w-max">
                                    Error
                                  </span>
                                  <span className="text-[10px] text-red-600 block max-w-xs truncate">{row.error}</span>
                                </span>
                              )}
                            </td>
                            <td className="p-4 text-right">
                              {row.pdf_url ? (
                                <a 
                                  href={row.pdf_url} 
                                  target="_blank" 
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1 text-xs font-bold text-violet-600 hover:text-violet-800 transition-colors"
                                >
                                  <LinkIcon className="w-3.5 h-3.5" /> View PDF
                                </a>
                              ) : (
                                <span className="text-zinc-400 text-xs font-bold">Unsaved</span>
                              )}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                {!isGenerating && (
                  <div className="pt-4 flex justify-end border-t border-zinc-150">
                    <button
                      onClick={handleReset}
                      className="inline-flex items-center gap-2 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 font-bold py-3 px-6 rounded-xl text-xs transition-colors cursor-pointer"
                    >
                      <RotateCcw className="w-4 h-4" /> Start New Batch Session
                    </button>
                  </div>
                )}

              </div>
            )}

          </div>
        )}

      </main>

      {/* Premium Process Stage Overlay Loader */}
      {isProcessing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-white/70 backdrop-blur-md transition-all duration-300">
          <div className="max-w-md w-full mx-6 bg-white border border-[#b4914c]/15 rounded-3xl p-8 shadow-[0_30px_100px_rgba(0,0,0,0.06)] flex flex-col items-center text-center relative overflow-hidden">
            
            {/* Ambient decorative light glow inside loader */}
            <div className="absolute -top-12 -right-12 w-24 h-24 bg-[#b4914c]/5 rounded-full blur-2xl pointer-events-none" />
            <div className="absolute -bottom-12 -left-12 w-24 h-24 bg-[#137461]/5 rounded-full blur-2xl pointer-events-none" />

            {/* Spinning Nested Rings Animation */}
            <div className="relative w-28 h-28 mb-6 flex items-center justify-center">
              {/* Outer Glow Ring */}
              <div className="absolute inset-0 rounded-full border border-dashed border-[#b4914c]/20 animate-[spin_12s_linear_infinite]" />
              
              {/* Mid Ring */}
              <div className="absolute inset-2 rounded-full border-2 border-violet-100 border-t-violet-600 animate-[spin_1.5s_linear_infinite]" />
              
              {/* Inner Reverse Ring */}
              <div className="absolute inset-4 rounded-full border border-dashed border-[#137461]/30 animate-[spin_6s_linear_infinite_reverse]" />
              
              {/* Core Icon */}
              <div className="absolute w-12 h-12 rounded-full bg-zinc-50 flex items-center justify-center shadow-[inset_0_2px_4px_rgba(0,0,0,0.02)]">
                {processingStage === 1 && <Upload className="w-5 h-5 text-violet-600 animate-bounce" />}
                {processingStage === 2 && <MapPin className="w-5 h-5 text-indigo-600 animate-[pulse_1.2s_ease-in-out_infinite]" />}
                {processingStage === 3 && <Settings className="w-5 h-5 text-emerald-600 animate-spin" />}
              </div>
            </div>

            {/* Stage Title */}
            <span className="text-[9px] font-bold uppercase tracking-[0.24em] text-[#846328] bg-[#b4914c]/8 px-3 py-1 rounded-full border border-[#b4914c]/15 mb-3">
              {processingStage === 1 && "Stage 01 — Parsing Template"}
              {processingStage === 2 && "Stage 02 — Registering Layout"}
              {processingStage === 3 && "Stage 03 — Compiling Certificates"}
            </span>
            
            <h3 className="font-sans text-lg text-stone-900 font-bold mb-5">
              {processingStage === 1 && "Analyzing Base Document"}
              {processingStage === 2 && "Configuring Fields Registry"}
              {processingStage === 3 && "Building Batch Run"}
            </h3>

            {/* Sequential Processing Steps Checklist */}
            <div className="w-full text-left space-y-3 bg-zinc-50 border border-zinc-150 p-5 rounded-2xl">
              {(processingStage === 1 ? PROCESS_STEPS[1] : processingStage === 2 ? PROCESS_STEPS[2] : PROCESS_STEPS[3]).map((stepText, idx) => {
                const isCompleted = idx < activeSubStep;
                const isActive = idx === activeSubStep;
                return (
                  <div key={idx} className="flex items-center gap-3 transition-all duration-300">
                    <div className={`w-4 h-4 rounded-full flex items-center justify-center shrink-0 border ${
                      isCompleted 
                        ? "bg-emerald-500 border-emerald-500 text-white" 
                        : isActive 
                          ? "border-violet-500 text-violet-500 bg-violet-50" 
                          : "border-zinc-200 text-zinc-300 bg-white"
                    }`}>
                      {isCompleted ? (
                        <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="4">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      ) : isActive ? (
                        <div className="w-1.5 h-1.5 rounded-full bg-violet-500 animate-ping" />
                      ) : null}
                    </div>
                    <span className={`text-xs font-semibold ${
                      isCompleted 
                        ? "text-zinc-400 line-through decoration-zinc-300" 
                        : isActive 
                          ? "text-zinc-800 font-bold" 
                          : "text-zinc-400"
                    }`}>
                      {stepText}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
