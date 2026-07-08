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
import JSZip from "jszip";

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
  year: string;
  month?: string;
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
  const [isMounted, setIsMounted] = useState(false);
  
  useEffect(() => {
    setIsMounted(true);
  }, []);

  // App state (1 = upload assets, 2 = generation run)
  const [step, setStep] = useState<1 | 2>(1);
  const [backendUrl, setBackendUrl] = useState<string>(() => {
    if (typeof window === "undefined") return "http://localhost:5000";
    return localStorage.getItem("cert_generator_backend_url") || "http://localhost:5000";
  });
  
  // Files
  const [lorTemplateFile, setLorTemplateFile] = useState<File | null>(null);
  const [experienceTemplateFile, setExperienceTemplateFile] = useState<File | null>(null);
  const [internshipTemplateFile, setInternshipTemplateFile] = useState<File | null>(null);
  const [excelFile, setExcelFile] = useState<File | null>(null);
  
  // Batch details
  const [batchId, setBatchId] = useState<string>("");
  const [batchMonth, setBatchMonth] = useState<string>("");
  const [issueDate, setIssueDate] = useState<string>("");

  // Loaded Template ID (used as batch_id)
  const [templateId, setTemplateId] = useState<string>("");
  
  // Generator states
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [excelDownloadUrl, setExcelDownloadUrl] = useState<string>("");
  const [generationResults, setGenerationResults] = useState<CertRow[]>([]);
  const [genStats, setGenStats] = useState({ success: 0, failed: 0, total: 0 });
  const [errorMsg, setErrorMsg] = useState<string>("");
  const [isZipping, setIsZipping] = useState<boolean>(false);
  const [zipProgress, setZipProgress] = useState<{ done: number; total: number }>({ done: 0, total: 0 });

  const handleDownloadAllZip = async () => {
    const rows = generationResults.filter((r) => r.pdf_url && r.status === "active");
    if (rows.length === 0) return;
    setIsZipping(true);
    setZipProgress({ done: 0, total: rows.length });
    try {
      const zip = new JSZip();
      let zipTitle = "Certificates";
      
      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        if (!row.pdf_url) continue;
        const url = row.pdf_url;
        try {
          const res = await fetch(url);
          const blob = await res.arrayBuffer();
          
          // Parse cert title from the PDF filename
          const filename = url.substring(url.lastIndexOf('/') + 1);
          const match = filename.match(/\(([^)]+)\)/);
          const certTitle = match ? match[1].replace(/_/g, ' ') : "Certificate";
          
          if (certTitle !== "Certificate" && zipTitle === "Certificates") {
            zipTitle = certTitle;
          }
          
          const safeName = (row.name || `certificate_${i + 1}`).replace(/[^a-zA-Z0-9_\- ]/g, "_");
          zip.file(`${safeName}_(${certTitle}).pdf`, blob);
        } catch {
          // skip failed fetches silently
        }
        setZipProgress({ done: i + 1, total: rows.length });
      }
      const content = await zip.generateAsync({ type: "blob", compression: "DEFLATE", compressionOptions: { level: 6 } });
      const url = URL.createObjectURL(content);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${zipTitle}.zip`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setIsZipping(false);
      setZipProgress({ done: 0, total: 0 });
    }
  };

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

  // Step 1: Upload templates and metadata
  const [isUploadingTemplate, setIsUploadingTemplate] = useState<boolean>(false);

  // Processing animation sub-steps state
  const [activeSubStep, setActiveSubStep] = useState<number>(0);

  const PROCESS_STEPS = {
    1: [
      "Uploading LOR, Experience, and Internship templates...",
      "Registering batch metadata in Supabase DB...",
      "Generating unique batch records..."
    ],
    2: [
      "Parsing Excel data sheet...",
      "Creating intern profiles in Supabase...",
      "Resolving certificate requirements (YES/NO columns)...",
      "Registering credentials and scheduling email dispatches...",
      "Completing generation run..."
    ]
  };

  const isProcessing = isUploadingTemplate || isGenerating;
  const processingStage = isUploadingTemplate ? 1 : isGenerating ? 2 : 0;

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isProcessing) {
      setActiveSubStep(0);
      const stepsCount = processingStage === 1 ? 3 : 5;
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

  const handleBatchCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!batchId || !batchMonth || !issueDate) {
      setErrorMsg("Please fill in all batch details (Batch ID, Month, and Issue Date).");
      return;
    }
    if (!lorTemplateFile && !experienceTemplateFile && !internshipTemplateFile) {
      setErrorMsg("Please upload at least one PPTX certificate template (LOR, Experience, or Internship).");
      return;
    }

    setIsUploadingTemplate(true);
    setErrorMsg("");

    const formData = new FormData();
    formData.append("batch_id", batchId.trim());
    formData.append("month", batchMonth.trim());
    formData.append("issue_date", issueDate);
    
    if (lorTemplateFile) formData.append("lor_template", lorTemplateFile);
    if (experienceTemplateFile) formData.append("experience_template", experienceTemplateFile);
    if (internshipTemplateFile) formData.append("internship_template", internshipTemplateFile);

    try {
      const response = await fetch(`${backendUrl}/api/batch/create`, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.detail || "Failed to create batch record.");
      }

      const data = await response.json();
      setTemplateId(data.batch_id); // Save batch_id in templateId to maintain compat with Step 2 UI
      
      // Auto-advance to Step 2
      setStep(2);
    } catch (err: unknown) {
      console.error(err);
      if (err instanceof TypeError) {
        setErrorMsg("Network error: failed to reach backend. Check that the backend is running and the Backend URL is correct.");
      } else {
        setErrorMsg(getErrorMessage(err) || "An error occurred connecting to the backend server.");
      }
    } finally {
      setIsUploadingTemplate(false);
    }
  };

  // Step 2: Trigger Generation
  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!excelFile || !templateId) return;

    setIsGenerating(true);
    setExcelDownloadUrl("");
    setGenerationResults([]);
    setErrorMsg("");

    const formData = new FormData();
    formData.append("batch_id", templateId);
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
    setLorTemplateFile(null);
    setExperienceTemplateFile(null);
    setInternshipTemplateFile(null);
    setExcelFile(null);
    setBatchId("");
    setBatchMonth("");
    setIssueDate("");
    setTemplateId("");
    setExcelDownloadUrl("");
    setGenerationResults([]);
    setStep(1);
    setErrorMsg("");
  };

  if (!isMounted) {
    return null;
  }

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
              <span className="text-xl font-bold font-mono text-[#12a150] mt-0.5 block">0{step} / 02</span>
            </div>
            
            {/* Note text */}
            <div>
              <h3 className="text-base font-bold text-stone-900 flex items-center gap-2">
                <span className="inline-block w-2 h-2 rounded-full bg-[#12a150] animate-pulse" />
                {step === 1 && "Upload Base Certificate Files"}
                {step === 2 && "Compile Batch Certificate Run"}
              </h3>
              <p className="mt-1.5 text-xs text-stone-600 leading-relaxed max-w-3xl">
                {step === 1 && "Note: Select the base certificate template (PDF/PPTX) and the intern details Excel sheet (.xlsx). The system will automatically convert, parse, and prepare your files."}
                {step === 2 && "Note: Verify intern record mappings and run the generator. The platform will automatically locate placeholders (e.g. <<NAME>>, <<COLLEGE>>), redact them, insert details, generate QRs, and compile certificates."}
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
              Upload Base <span className="text-[#3b82f6]">Certificate Templates</span>
            </h2>
            <form onSubmit={handleBatchCreate} className="space-y-8">
              
              {/* Three PPTX Templates Grid */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                
                {/* 1. LOR Template */}
                <div className="relative group">
                  <label className="block text-sm font-bold text-zinc-400 mb-2">
                    1. Letter of Recommendation (LOR) PPTX
                  </label>
                  <div className={`border-2 border-dashed rounded-2xl p-6 transition-all duration-300 flex flex-col items-center justify-center min-h-[180px] ${
                    lorTemplateFile 
                      ? "border-[#3b82f6]/60 bg-[#3b82f6]/8" 
                      : "border-zinc-800 bg-[#0b0f19]/80 hover:border-zinc-700 hover:bg-[#121626]"
                  }`}>
                    <input 
                      type="file" 
                      accept="application/vnd.openxmlformats-officedocument.presentationml.presentation,.pptx"
                      onChange={(e) => setLorTemplateFile(e.target.files?.[0] || null)}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    />
                    <FileText className={`w-10 h-10 mb-3 transition-colors ${lorTemplateFile ? "text-[#3b82f6]" : "text-zinc-500 group-hover:text-zinc-400"}`} />
                    {lorTemplateFile ? (
                      <div className="text-center">
                        <p className="text-xs font-bold text-white truncate max-w-[200px]">{lorTemplateFile.name}</p>
                        <p className="text-[10px] text-zinc-400 mt-0.5">{(lorTemplateFile.size / 1024 / 1024).toFixed(2)} MB</p>
                        <button 
                          type="button" 
                          onClick={(e) => { e.stopPropagation(); setLorTemplateFile(null); }}
                          className="mt-2.5 inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-zinc-800 text-zinc-300 hover:bg-red-950/40 hover:text-red-400 transition-colors"
                        >
                          Remove
                        </button>
                      </div>
                    ) : (
                      <div className="text-center">
                        <p className="text-xs font-semibold text-zinc-200">Upload LOR PPTX</p>
                        <p className="text-[10px] text-zinc-500 mt-0.5">Drag & drop template</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* 2. Experience Letter Template */}
                <div className="relative group">
                  <label className="block text-sm font-bold text-zinc-400 mb-2">
                    2. Experience Letter PPTX
                  </label>
                  <div className={`border-2 border-dashed rounded-2xl p-6 transition-all duration-300 flex flex-col items-center justify-center min-h-[180px] ${
                    experienceTemplateFile 
                      ? "border-[#3b82f6]/60 bg-[#3b82f6]/8" 
                      : "border-zinc-800 bg-[#0b0f19]/80 hover:border-zinc-700 hover:bg-[#121626]"
                  }`}>
                    <input 
                      type="file" 
                      accept="application/vnd.openxmlformats-officedocument.presentationml.presentation,.pptx"
                      onChange={(e) => setExperienceTemplateFile(e.target.files?.[0] || null)}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    />
                    <FileText className={`w-10 h-10 mb-3 transition-colors ${experienceTemplateFile ? "text-[#3b82f6]" : "text-zinc-500 group-hover:text-zinc-400"}`} />
                    {experienceTemplateFile ? (
                      <div className="text-center">
                        <p className="text-xs font-bold text-white truncate max-w-[200px]">{experienceTemplateFile.name}</p>
                        <p className="text-[10px] text-zinc-400 mt-0.5">{(experienceTemplateFile.size / 1024 / 1024).toFixed(2)} MB</p>
                        <button 
                          type="button" 
                          onClick={(e) => { e.stopPropagation(); setExperienceTemplateFile(null); }}
                          className="mt-2.5 inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-zinc-800 text-zinc-300 hover:bg-red-950/40 hover:text-red-400 transition-colors"
                        >
                          Remove
                        </button>
                      </div>
                    ) : (
                      <div className="text-center">
                        <p className="text-xs font-semibold text-zinc-200">Upload Experience PPTX</p>
                        <p className="text-[10px] text-zinc-500 mt-0.5">Drag & drop template</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* 3. Internship Certificate Template */}
                <div className="relative group">
                  <label className="block text-sm font-bold text-zinc-400 mb-2">
                    3. Internship Certificate PPTX
                  </label>
                  <div className={`border-2 border-dashed rounded-2xl p-6 transition-all duration-300 flex flex-col items-center justify-center min-h-[180px] ${
                    internshipTemplateFile 
                      ? "border-[#3b82f6]/60 bg-[#3b82f6]/8" 
                      : "border-zinc-800 bg-[#0b0f19]/80 hover:border-zinc-700 hover:bg-[#121626]"
                  }`}>
                    <input 
                      type="file" 
                      accept="application/vnd.openxmlformats-officedocument.presentationml.presentation,.pptx"
                      onChange={(e) => setInternshipTemplateFile(e.target.files?.[0] || null)}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    />
                    <FileText className={`w-10 h-10 mb-3 transition-colors ${internshipTemplateFile ? "text-[#3b82f6]" : "text-zinc-500 group-hover:text-zinc-400"}`} />
                    {internshipTemplateFile ? (
                      <div className="text-center">
                        <p className="text-xs font-bold text-white truncate max-w-[200px]">{internshipTemplateFile.name}</p>
                        <p className="text-[10px] text-zinc-400 mt-0.5">{(internshipTemplateFile.size / 1024 / 1024).toFixed(2)} MB</p>
                        <button 
                          type="button" 
                          onClick={(e) => { e.stopPropagation(); setInternshipTemplateFile(null); }}
                          className="mt-2.5 inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-zinc-800 text-zinc-300 hover:bg-red-950/40 hover:text-red-400 transition-colors"
                        >
                          Remove
                        </button>
                      </div>
                    ) : (
                      <div className="text-center">
                        <p className="text-xs font-semibold text-zinc-200">Upload Internship PPTX</p>
                        <p className="text-[10px] text-zinc-500 mt-0.5">Drag & drop template</p>
                      </div>
                    )}
                  </div>
                </div>

              </div>

              {/* Excel and Batch Details Split */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4">
                
                {/* Excel Upload */}
                <div className="relative group">
                  <label className="block text-sm font-bold text-zinc-400 mb-2">
                    4. Intern Details Sheet (.xlsx)
                  </label>
                  <div className={`border-2 border-dashed rounded-2xl p-6 transition-all duration-300 flex flex-col items-center justify-center min-h-[180px] ${
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
                    <FileText className={`w-10 h-10 mb-3 transition-colors ${excelFile ? "text-emerald-400" : "text-zinc-500 group-hover:text-zinc-400"}`} />
                    {excelFile ? (
                      <div className="text-center">
                        <p className="text-xs font-bold text-white truncate max-w-[240px]">{excelFile.name}</p>
                        <p className="text-[10px] text-zinc-400 mt-0.5">{(excelFile.size / 1024).toFixed(1)} KB • Has YES/NO columns</p>
                        <button 
                          type="button" 
                          onClick={(e) => { e.stopPropagation(); setExcelFile(null); }}
                          className="mt-2.5 inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-zinc-800 text-zinc-300 hover:bg-red-950/40 hover:text-red-400 transition-colors"
                        >
                          Remove
                        </button>
                      </div>
                    ) : (
                      <div className="text-center">
                        <p className="text-xs font-semibold text-zinc-200">Drag & drop your Excel sheet here</p>
                        <p className="text-[10px] text-zinc-500 mt-0.5">Must contain Email and certificate choice columns</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Batch Details Form */}
                <div className="bg-[#0b0f19]/85 border border-zinc-800 rounded-2xl p-6 space-y-4">
                  <h3 className="text-sm font-bold text-zinc-400 border-b border-zinc-850 pb-2">
                    5. Batch Release Details
                  </h3>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[11px] font-extrabold uppercase tracking-wider text-zinc-500 mb-1.5">
                        Batch ID
                      </label>
                      <input 
                        type="text" 
                        required
                        value={batchId}
                        onChange={(e) => setBatchId(e.target.value)}
                        placeholder="e.g. Batch_34_ERP"
                        className="w-full text-xs bg-zinc-900 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-white placeholder-zinc-600 focus:outline-none focus:border-blue-500 focus:bg-black transition-colors"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-extrabold uppercase tracking-wider text-zinc-500 mb-1.5">
                        Month / Year
                      </label>
                      <input 
                        type="text" 
                        required
                        value={batchMonth}
                        onChange={(e) => setBatchMonth(e.target.value)}
                        placeholder="e.g. July 2026"
                        className="w-full text-xs bg-zinc-900 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-white placeholder-zinc-600 focus:outline-none focus:border-blue-500 focus:bg-black transition-colors"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-extrabold uppercase tracking-wider text-zinc-500 mb-1.5">
                      Certificate Issue Date
                    </label>
                    <input 
                      type="date" 
                      required
                      value={issueDate}
                      onChange={(e) => setIssueDate(e.target.value)}
                      className="w-full text-xs bg-zinc-900 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-white focus:outline-none focus:border-blue-500 focus:bg-black transition-colors"
                    />
                  </div>
                </div>

              </div>

              <div className="flex justify-end pt-6 border-t border-zinc-800">
                <button
                  type="submit"
                  disabled={isUploadingTemplate}
                  className={`flex items-center gap-2 px-6 py-3.5 rounded-xl font-bold text-sm transition-all duration-300 ${
                    !isUploadingTemplate
                      ? "bg-blue-600 hover:bg-blue-500 text-white shadow-lg cursor-pointer"
                      : "bg-zinc-900 text-zinc-600 border border-zinc-850 cursor-not-allowed"
                  }`}
                >
                  {isUploadingTemplate ? (
                    <>
                      <div className="w-4 h-4 border-2 border-zinc-700 border-t-white rounded-full animate-spin" />
                      Uploading templates...
                    </>
                  ) : (
                    <>
                      Create Batch
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* STEP 2: EXCEL DETAILS UPLOAD & BATCH GENERATION */}
        {step === 2 && (
          <div className="space-y-8">
            
            {/* Generate Trigger Card */}
            <div className="rounded-[32px] border border-black/5 bg-white p-8 shadow-[0_18px_60px_rgba(0,0,0,0.05)]">
              <h2 className="font-display text-2xl text-stone-900 mb-2">
                Generate Certificates Batch
              </h2>
              <p className="text-xs text-zinc-550 mb-6">
                Template uploaded successfully. Next, run the batch certificate builder to search, redact, and replace placeholders (e.g. &lt;&lt;NAME&gt;&gt;, &lt;&lt;QR&gt;&gt;) in the template.
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
                    <div className="flex items-center gap-3">
                      <a
                        href={excelDownloadUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold py-2.5 px-5 rounded-xl shadow-md text-xs transition-all duration-300"
                      >
                        <Download className="w-4 h-4" /> Download Result Excel Sheet
                      </a>

                      {generationResults.some((r) => r.pdf_url && r.status === "active") && (
                        <button
                          onClick={handleDownloadAllZip}
                          disabled={isZipping}
                          className="inline-flex items-center gap-2 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 disabled:opacity-60 disabled:cursor-not-allowed text-white font-bold py-2.5 px-5 rounded-xl shadow-md text-xs transition-all duration-300"
                        >
                          {isZipping ? (
                            <>
                              <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                              {zipProgress.total > 0
                                ? `Packing ${zipProgress.done}/${zipProgress.total}…`
                                : "Preparing…"}
                            </>
                          ) : (
                            <>
                              <Download className="w-4 h-4" /> Download All PDFs as ZIP
                            </>
                          )}
                        </button>
                      )}
                    </div>
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
                            <td className="p-4 font-mono text-zinc-500 text-xs">{row.month || row.year || "—"}</td>
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
                                <div className="inline-flex items-center gap-2">
                                  {/* View in new tab */}
                                  <a
                                    href={row.pdf_url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    title="Open PDF in new tab"
                                    className="inline-flex items-center gap-1 text-[11px] font-bold text-violet-600 hover:text-violet-800 bg-violet-50 hover:bg-violet-100 border border-violet-200 px-2.5 py-1 rounded-lg transition-all duration-150"
                                  >
                                    <LinkIcon className="w-3 h-3" /> View
                                  </a>

                                  {/* Force-download */}
                                  <button
                                    title="Download PDF"
                                    onClick={async () => {
                                      try {
                                        const res = await fetch(row.pdf_url!);
                                        const blob = await res.blob();
                                        const url = URL.createObjectURL(blob);
                                        const a = document.createElement("a");
                                        a.href = url;
                                        const safeName = (row.name || "certificate").replace(/[^a-zA-Z0-9_\- ]/g, "_");
                                        a.download = `${safeName}.pdf`;
                                        a.click();
                                        URL.revokeObjectURL(url);
                                      } catch {
                                        alert("Failed to download PDF. Please try View instead.");
                                      }
                                    }}
                                    className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 hover:text-emerald-900 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 px-2.5 py-1 rounded-lg transition-all duration-150"
                                  >
                                    <Download className="w-3 h-3" /> Download
                                  </button>
                                </div>
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
                {processingStage === 2 && <Settings className="w-5 h-5 text-emerald-600 animate-spin" />}
              </div>
            </div>

            {/* Stage Title */}
            <span className="text-[9px] font-bold uppercase tracking-[0.24em] text-[#846328] bg-[#b4914c]/8 px-3 py-1 rounded-full border border-[#b4914c]/15 mb-3">
              {processingStage === 1 && "Stage 01 — Parsing Template"}
              {processingStage === 2 && "Stage 02 — Compiling Certificates"}
            </span>
            
            <h3 className="font-sans text-lg text-stone-900 font-bold mb-5">
              {processingStage === 1 && "Analyzing Base Document"}
              {processingStage === 2 && "Building Batch Run"}
            </h3>

            {/* Sequential Processing Steps Checklist */}
            <div className="w-full text-left space-y-3 bg-zinc-50 border border-zinc-150 p-5 rounded-2xl">
              {(processingStage === 1 ? PROCESS_STEPS[1] : PROCESS_STEPS[2]).map((stepText: string, idx: number) => {
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
