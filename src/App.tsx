import { useEffect, useMemo, useRef, useState, type ChangeEvent, type DragEvent } from "react";
import QRCode from "qrcode";
import * as pdfjsLib from "pdfjs-dist";
import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import mammoth from "mammoth/mammoth.browser";
import {
  ArrowDown,
  ArrowRight,
  BrainCircuit,
  CalendarDays,
  Check,
  ChevronRight,
  CircleHelp,
  Code2,
  Download,
  ExternalLink,
  FileCheck2,
  FileText,
  FileType,
  GraduationCap,
  Image as ImageIcon,
  Link2,
  Loader2,
  Mail,
  MapPin,
  Menu,
  Palette,
  Phone,
  ScanLine,
  ShieldCheck,
  Sparkles,
  Upload,
  Wand2,
  X,
  Zap,
  type LucideIcon,
} from "lucide-react";

type ToolId = "qr" | "compress" | "resume";
type CompressFormat = "image/webp" | "image/jpeg";
type DeveloperMode = "clean" | "dark" | "glass";

type ResumeAnalysis = {
  score: number;
  wordCount: number;
  sectionsFound: number;
  bullets: number;
  contactReady: boolean;
  keywordHits: number;
  atsFriendly: boolean;
  highlights: string[];
  suggestions: string[];
};

type Tool = {
  id: ToolId;
  label: string;
  description: string;
  icon: LucideIcon;
};

const tools: Tool[] = [
  { id: "qr", label: "QR code maker", description: "Turn a link into a little doorway.", icon: ScanLine },
  { id: "compress", label: "Image compressor", description: "Make files lighter, keep the good bits.", icon: ImageIcon },
  { id: "resume", label: "ATS resume analyzer", description: "Check any resume file against ATS-style rules.", icon: FileText },
];

const resumeSections = ["experience", "education", "skills", "projects", "summary", "certifications"];
const atsKeywords = [
  "led", "managed", "built", "designed", "developed", "improved", "launched", "created",
  "implemented", "increased", "reduced", "optimized", "collaborated", "delivered", "achieved",
];
const atsRiskyElements = [
  { pattern: /\btable\b|\bcolumn\b/i, note: "Avoid multi-column layouts or tables. Many ATS parsers read them out of order." },
  { pattern: /[^\x00-\x7F]/, note: "Watch for special characters or icons. Some ATS software cannot read them correctly." },
];
const sampleResume = [
  "SHOAIB FAROOQ",
  "Full Stack Developer | AI Enthusiast | UI/UX Designer",
  "Lahore, Pakistan | shoaibfarooq1076@gmail.com | +92 304 9891873",
  "LinkedIn: linkedin.com/in/shoaib-farooq-825b273ab",
  "",
  "SUMMARY",
  "Computer Science student and hands-on full stack developer from Lahore. I design clean, human-centered interfaces and then build them with React, Node.js, and Python. I care about useful products, thoughtful UI/UX, and turning ideas into working tools that people can actually use.",
  "",
  "EXPERIENCE",
  "Independent Full Stack Developer | 2024 - Present",
  "- Designed and developed Chhote Tools, a browser-based toolkit with a QR code generator, image compressor, and ATS resume analyzer.",
  "- Built full stack web products with React, Node.js, and Python, focusing on clear user flows and practical everyday use.",
  "- Created AI-assisted and productivity tools, including an image generation workflow and a plagiarism-checking companion.",
  "- Collaborated with design and engineering thinking to ship 3 working web applications from idea to live product.",
  "- Improved usability through clean layouts, simple copy, and faster local-first features that keep user data private.",
  "",
  "EDUCATION",
  "Bachelor of Science in Computer Science",
  "COMSATS University Islamabad, Sahiwal Campus | 2024 - Present",
  "- Building a strong foundation in programming, software development, and human-centered product thinking.",
  "",
  "SKILLS",
  "React, Node.js, Python, JavaScript, UI/UX design, full stack development, AI experiments, product thinking",
  "Comfort level: Intermediate",
  "",
  "PROJECTS",
  "Chhote Tools | Personal toolkit",
  "- Developed a privacy-first web toolkit that runs locally in the browser.",
  "- Delivered QR generation, image compression, and ATS resume analysis in one simple interface.",
  "",
  "CERTIFICATIONS",
  "Self-directed learning in full stack development, UI/UX design, and applied AI.",
].join("\n");

function formatBytes(bytes: number) {
  if (!bytes) return "0 KB";
  const isKb = bytes / 1024 / 1024 < 1;
  return `${(isKb ? bytes / 1024 : bytes / 1024 / 1024).toFixed(1)} ${isKb ? "KB" : "MB"}`;
}

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

async function readPdfText(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;
  const pageTexts: string[] = [];
  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const textContent = await page.getTextContent();
    const pageText = textContent.items.map((item) => ("str" in item ? item.str : "")).join(" ");
    pageTexts.push(pageText);
  }
  return pageTexts.join("\n\n");
}

async function readDocxText(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const result = await mammoth.extractRawText({ arrayBuffer: buffer });
  return result.value;
}

async function extractResumeText(file: File): Promise<string> {
  const lowerName = file.name.toLowerCase();
  if (file.type === "application/pdf" || lowerName.endsWith(".pdf")) {
    return readPdfText(file);
  }
  if (
    file.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    lowerName.endsWith(".docx")
  ) {
    return readDocxText(file);
  }
  if (lowerName.endsWith(".doc")) {
    throw new Error("Older .doc files are not supported. Please save it as .docx or .pdf and try again.");
  }
  return file.text();
}

export default function App() {
  const [activeTool, setActiveTool] = useState<ToolId>("qr");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [qrValue, setQrValue] = useState("https://chhote.tools");
  const [qrColor, setQrColor] = useState("#173f39");
  const [qrPreview, setQrPreview] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imageSource, setImageSource] = useState("");
  const [compressedSource, setCompressedSource] = useState("");
  const [compressedBytes, setCompressedBytes] = useState(0);
  const [compressionQuality, setCompressionQuality] = useState(76);
  const [compressFormat, setCompressFormat] = useState<CompressFormat>("image/webp");
  const [imageError, setImageError] = useState("");
  const [resumeText, setResumeText] = useState("");
  const [resumeAnalysis, setResumeAnalysis] = useState<ResumeAnalysis | null>(null);
  const [resumeFileName, setResumeFileName] = useState("");
  const [resumeFileError, setResumeFileError] = useState("");
  const [isReadingResumeFile, setIsReadingResumeFile] = useState(false);
  const [developerMode, setDeveloperMode] = useState<DeveloperMode>("clean");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const resumeInputRef = useRef<HTMLInputElement>(null);

  const currentTool = useMemo(() => tools.find((tool) => tool.id === activeTool) ?? tools[0], [activeTool]);

  useEffect(() => {
    let cancelled = false;
    QRCode.toDataURL(qrValue.trim() || " ", {
      width: 560,
      margin: 2,
      errorCorrectionLevel: "M",
      color: { dark: qrColor, light: "#fffdf7" },
    }).then((dataUrl) => {
      if (!cancelled) setQrPreview(dataUrl);
    });
    return () => {
      cancelled = true;
    };
  }, [qrColor, qrValue]);

  const openTool = (toolId: ToolId) => {
    setActiveTool(toolId);
    setMobileMenuOpen(false);
    window.requestAnimationFrame(() => {
      document.getElementById("studio")?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  };

  const downloadFile = (href: string, name: string) => {
    const link = document.createElement("a");
    link.href = href;
    link.download = name;
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  const handleImage = (file: File) => {
    if (!file.type.startsWith("image/")) {
      setImageError("That file does not look like an image. Try a JPG, PNG, or WebP.");
      return;
    }
    setImageError("");
    setImageFile(file);
    setCompressedSource("");
    setCompressedBytes(0);
    setImageSource(URL.createObjectURL(file));
  };

  const onImagePick = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0];
    if (file) handleImage(file);
  };

  const onImageDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    const file = event.dataTransfer.files?.[0];
    if (file) handleImage(file);
  };

  const compressImage = () => {
    if (!imageFile || !imageSource) return;
    const image = new Image();
    image.onload = () => {
      const canvas = document.createElement("canvas");
      const maxDimension = 2200;
      const scale = Math.min(1, maxDimension / Math.max(image.naturalWidth, image.naturalHeight));
      canvas.width = Math.round(image.naturalWidth * scale);
      canvas.height = Math.round(image.naturalHeight * scale);
      const context = canvas.getContext("2d");
      if (!context) return;
      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      canvas.toBlob(
        (blob) => {
          if (!blob) return;
          setCompressedSource(URL.createObjectURL(blob));
          setCompressedBytes(blob.size);
        },
        compressFormat,
        compressionQuality / 100,
      );
    };
    image.src = imageSource;
  };

  const analyzeResume = () => {
    const cleanText = resumeText.trim();
    const lowerText = cleanText.toLowerCase();
    const wordCount = cleanText ? cleanText.split(/\s+/).length : 0;
    const sectionsFound = resumeSections.filter((section) => lowerText.includes(section)).length;
    const bullets = (cleanText.match(/^\s*[-*•]/gm) ?? []).length;
    const contactReady = /[^\s@]+@[^\s@]+\.[^\s@]+/.test(cleanText) && /(?:\+?\d[\d\s().-]{7,})/.test(cleanText);
    const hasNumbers = /\b\d+(?:\.\d+)?\s?(?:%|x|k|m|years?|users?|projects?|features?)\b/i.test(cleanText);
    const keywordHits = atsKeywords.filter((keyword) => new RegExp(`\\b${keyword}\\b`, "i").test(cleanText)).length;
    const atsFriendly = !atsRiskyElements.some(({ pattern }) => pattern.test(cleanText));
    const score = Math.min(
      98,
      Math.max(
        18,
        20 +
          sectionsFound * 8 +
          (contactReady ? 12 : 0) +
          Math.min(16, bullets * 3) +
          (hasNumbers ? 12 : 0) +
          Math.min(14, keywordHits * 2) +
          (atsFriendly ? 6 : 0) +
          (wordCount > 180 ? 6 : 0),
      ),
    );
    const highlights: string[] = [];
    if (contactReady) highlights.push("Your basic contact details are easy for an ATS to find.");
    if (hasNumbers) highlights.push("You use numbers to show the shape of your impact.");
    if (sectionsFound >= 4) highlights.push("The main sections give your story a clear rhythm.");
    if (keywordHits >= 4) highlights.push("You use strong action verbs that ATS scanners tend to favor.");
    if (atsFriendly) highlights.push("No obvious formatting traps like tables or unusual characters.");
    const suggestions: string[] = [];
    if (!contactReady) suggestions.push("Add a searchable email address and phone number near your name.");
    if (bullets < 3) suggestions.push("Turn a few responsibilities into short, outcome-led bullet points.");
    if (!hasNumbers) suggestions.push("Add one or two useful numbers so the reader can feel your impact.");
    if (sectionsFound < 4) suggestions.push("Consider adding clear headings for experience, skills, and education.");
    if (keywordHits < 4) suggestions.push("Sprinkle in a few more action verbs like led, built, or improved.");
    if (!atsFriendly) atsRiskyElements.forEach(({ pattern, note }) => { if (pattern.test(cleanText)) suggestions.push(note); });
    if (wordCount < 120) suggestions.push("There may be room for a little more context about your strongest work.");
    setResumeAnalysis({
      score,
      wordCount,
      sectionsFound,
      bullets,
      contactReady,
      keywordHits,
      atsFriendly,
      highlights: highlights.length ? highlights : ["There is a thoughtful start here. Keep sharpening the details."],
      suggestions: suggestions.length ? suggestions : ["This is in a lovely place. Give it one final read for your own voice."],
    });
  };

  const onResumeFile = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0];
    event.target.value = "";
    if (!file) return;
    setResumeFileError("");
    setResumeFileName(file.name);
    setIsReadingResumeFile(true);
    extractResumeText(file)
      .then((text) => {
        const trimmed = text.trim();
        if (!trimmed) {
          setResumeFileError("We couldn't find readable text in that file. Try a text-based PDF or a .docx export.");
          return;
        }
        setResumeText(trimmed);
        setResumeAnalysis(null);
      })
      .catch((error: unknown) => {
        setResumeFileError(error instanceof Error ? error.message : "That file could not be read. Try a .pdf, .docx, or .txt file.");
      })
      .finally(() => setIsReadingResumeFile(false));
  };

  const renderQrTool = () => (
    <div className="workspace-content qr-workspace">
      <div className="tool-form">
        <div className="field-heading"><label htmlFor="qr-content">What should it open?</label><span>{qrValue.length}/600</span></div>
        <textarea id="qr-content" className="text-input qr-input" maxLength={600} onChange={(event) => setQrValue(event.target.value)} placeholder="Paste a link, a note, a menu..." value={qrValue} />
        <div className="form-divider" />
        <div className="field-heading"><span className="label-like">Pick an ink color</span><span className="color-value" style={{ color: qrColor }}>{qrColor}</span></div>
        <div className="color-options" role="radiogroup" aria-label="QR code color">
          {[["#173f39", "Deep moss"], ["#b74732", "Warm clay"], ["#5a4b8c", "Soft plum"]].map(([color, label]) => (
            <button aria-label={label} aria-pressed={qrColor === color} className={`color-swatch ${qrColor === color ? "selected" : ""}`} key={color} onClick={() => setQrColor(color)} style={{ backgroundColor: color }} type="button" />
          ))}
        </div>
        <div className="privacy-note"><ShieldCheck size={15} /> Made in your browser. Nothing gets uploaded.</div>
        <button className="primary-button wide-button" disabled={!qrPreview} onClick={() => downloadFile(qrPreview, "chhote-qr-code.png")} type="button"><Download size={17} /> Download PNG</button>
      </div>
      <div className="qr-result">
        <div className="result-kicker"><span className="live-dot" /> Live preview</div>
        <div className="qr-paper">{qrPreview ? <img alt="Generated QR code" src={qrPreview} /> : <div className="qr-loading">Making your little doorway...</div>}</div>
        <div className="qr-result-footer"><span>{qrValue.trim() || "Your content"}</span><span className="ready-label"><Check size={13} /> Ready to share</span></div>
      </div>
    </div>
  );

  const renderCompressTool = () => (
    <div className="workspace-content compress-workspace">
      <input accept="image/*" className="visually-hidden" onChange={onImagePick} ref={fileInputRef} type="file" />
      {!imageFile ? (
        <div className="drop-zone" onClick={() => fileInputRef.current?.click()} onDragOver={(event) => event.preventDefault()} onDrop={onImageDrop} role="button" tabIndex={0}>
          <div className="drop-icon"><ImageIcon size={25} /></div><h3>Drop an image here</h3><p>or click to browse from your device</p><span className="file-hint">JPG, PNG, WebP up to 20 MB</span>
        </div>
      ) : (
        <div className="image-preview-area">
          <div className="image-preview-frame"><img alt="Selected image preview" src={compressedSource || imageSource} />{compressedSource && <span className="preview-badge"><Check size={13} /> Compressed</span>}</div>
          <div className="file-row"><div className="file-name"><ImageIcon size={16} /><span>{imageFile.name}</span></div><button aria-label="Remove selected image" className="icon-button" onClick={() => { setImageFile(null); setImageSource(""); setCompressedSource(""); }} type="button"><X size={17} /></button></div>
        </div>
      )}
      <div className="compress-controls">
        <div className="control-block"><div className="field-heading"><label htmlFor="quality">Quality</label><strong>{compressionQuality}%</strong></div><input className="range-input" id="quality" max="100" min="20" onChange={(event) => setCompressionQuality(Number(event.target.value))} type="range" value={compressionQuality} /><div className="range-labels"><span>Smaller file</span><span>Sharper image</span></div></div>
        <div className="control-block"><span className="label-like">Save as</span><div className="format-options"><button className={compressFormat === "image/webp" ? "format-option active" : "format-option"} onClick={() => setCompressFormat("image/webp")} type="button">WebP <span>recommended</span></button><button className={compressFormat === "image/jpeg" ? "format-option active" : "format-option"} onClick={() => setCompressFormat("image/jpeg")} type="button">JPG</button></div></div>
        {imageError && <p className="error-message">{imageError}</p>}
        {compressedSource && <p className="size-message"><Zap size={15} /> {formatBytes(Math.max(0, imageFile!.size - compressedBytes))} lighter than the original</p>}
        <button className="primary-button wide-button" disabled={!imageFile} onClick={compressImage} type="button"><Wand2 size={17} /> {compressedSource ? "Compress again" : "Compress image"}</button>
        {compressedSource && <button className="text-button download-button" onClick={() => downloadFile(compressedSource, `chhote-${imageFile!.name.split(".")[0]}.${compressFormat === "image/webp" ? "webp" : "jpg"}`)} type="button"><Download size={16} /> Download lighter image ({formatBytes(compressedBytes)})</button>}
      </div>
    </div>
  );

  const renderResumeTool = () => (
    <div className="workspace-content resume-workspace">
      <div className="resume-editor">
        <div className="field-heading"><label htmlFor="resume-content">Your resume text</label><span>Private by design</span></div>
        <textarea className="text-input resume-input" id="resume-content" onChange={(event) => { setResumeText(event.target.value); setResumeAnalysis(null); }} placeholder="Paste your resume here, or upload a PDF, Word (.docx), or text file..." value={resumeText} />
        <div className="upload-support"><FileType size={13} /> Supports PDF, Word (.docx), and plain text files</div>
        {isReadingResumeFile && <p className="size-message"><Loader2 size={14} className="spin-icon" /> Reading {resumeFileName || "your file"}...</p>}
        {resumeFileError && <p className="error-message">{resumeFileError}</p>}
        {!isReadingResumeFile && !resumeFileError && resumeFileName && resumeText && <p className="size-message"><Check size={14} /> Loaded text from {resumeFileName}</p>}
        <div className="editor-actions">
          <div className="editor-links">
            <button className="text-button" onClick={() => resumeInputRef.current?.click()} type="button"><Upload size={15} /> Upload resume</button>
            <input accept=".pdf,.doc,.docx,.txt,.md,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain" className="visually-hidden" onChange={onResumeFile} ref={resumeInputRef} type="file" />
            <button className="text-button muted-button" onClick={() => { setResumeText(sampleResume); setResumeAnalysis(null); setResumeFileName(""); setResumeFileError(""); }} type="button">Use a sample</button>
          </div>
          <button className="primary-button" disabled={!resumeText.trim() || isReadingResumeFile} onClick={analyzeResume} type="button"><Sparkles size={17} /> Run ATS check</button>
        </div>
      </div>
      <div className={`analysis-panel ${resumeAnalysis ? "has-analysis" : ""}`}>
        {!resumeAnalysis ? (
          <div className="analysis-empty"><div className="analysis-scribble"><CircleHelp size={24} /></div><h3>A kinder second pair of eyes.</h3><p>We will look for ATS-friendly structure, clarity, and the small proof points that help your work land.</p><div className="analysis-list"><span><Check size={14} /> ATS keywords</span><span><Check size={14} /> Clear sections</span><span><Check size={14} /> Human advice</span></div></div>
        ) : (
          <div className="analysis-results"><div className="score-line"><div><span className="result-kicker">ATS quick read</span><h3>Your resume has a good pulse.</h3></div><div className="score-ring" style={{ background: `conic-gradient(#b74732 ${resumeAnalysis.score * 3.6}deg, #eadfd3 0deg)` }}><div><strong>{resumeAnalysis.score}</strong><span>/100</span></div></div></div><div className="analysis-metrics"><span><strong>{resumeAnalysis.wordCount}</strong> words</span><span><strong>{resumeAnalysis.sectionsFound}/6</strong> sections</span><span><strong>{resumeAnalysis.bullets}</strong> bullets</span><span><strong>{resumeAnalysis.keywordHits}</strong> keywords</span></div><div className="analysis-section"><span className="mini-heading">What is working</span>{resumeAnalysis.highlights.map((highlight) => <p className="analysis-item positive" key={highlight}><Check size={15} /> {highlight}</p>)}</div><div className="analysis-section"><span className="mini-heading">Worth a little polish</span>{resumeAnalysis.suggestions.map((suggestion) => <p className="analysis-item" key={suggestion}><ArrowRight size={15} /> {suggestion}</p>)}</div></div>
        )}
      </div>
    </div>
  );

  const renderDeveloperSection = () => (
    <section className={`developer-section developer-mode-${developerMode}`} id="developer">
      <div className="developer-grid-lines" aria-hidden="true" />
      <div className="developer-header">
        <div className="developer-heading-copy">
          <p className="developer-overline"><span className="developer-pulse" /> Developer section / 01</p>
          <h2>Meet <em>Shoaib.</em></h2>
          <p className="developer-intro">A builder with a soft spot for useful interfaces, curious questions, and the moment an idea finally starts working.</p>
        </div>
        <div className="developer-modes">
          <span className="mode-label">Choose a visual mood</span>
          <div className="mode-switcher" role="group" aria-label="Developer section visual mood">
            {(["clean", "dark", "glass"] as DeveloperMode[]).map((mode) => (
              <button className={`mode-button ${developerMode === mode ? "active" : ""}`} key={mode} onClick={() => setDeveloperMode(mode)} type="button">
                <span className={`mode-dot mode-dot-${mode}`} />
                {mode === "clean" ? "Minimalist clean" : mode === "dark" ? "Dark futuristic" : "Glassmorphism"}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="developer-layout">
        <aside className="developer-identity">
          <div className="developer-avatar" aria-label="Shoaib Farooq initials">
            <span className="avatar-orbit orbit-one" />
            <span className="avatar-orbit orbit-two" />
            <span className="avatar-initials">SF</span>
            <span className="avatar-caption">build / learn / repeat</span>
          </div>
          <div className="identity-copy">
            <span className="identity-name">SHOAIB FAROOQ</span>
            <h3>Full stack developer</h3>
            <p>AI enthusiast + UI/UX designer</p>
          </div>
          <div className="developer-contact-list">
            <a href="mailto:shoaibfarooq1076@gmail.com"><Mail size={15} /><span>shoaibfarooq1076@gmail.com</span></a>
            <a href="tel:+923049891873"><Phone size={15} /><span>+92 304 9891873</span></a>
            <span><MapPin size={15} /><span>Lahore, Pakistan</span></span>
          </div>
          <a className="linkedin-link" href="https://www.linkedin.com/in/shoaib-farooq-825b273ab/" rel="noreferrer" target="_blank"><span className="linkedin-badge">in</span> Connect on LinkedIn <ExternalLink size={14} /></a>
        </aside>

        <div className="developer-main">
          <div className="developer-bio developer-panel">
            <div className="panel-label"><span>01</span> About me</div>
            <p>I'm Shoaib Farooq, a computer science student and hands-on builder from Lahore. I enjoy moving between logic and feeling: shaping a clean user flow, giving it a thoughtful visual rhythm, then building the real thing with code. My current work sits where full-stack development, AI experiments, and human-centered design meet.</p>
            <p>I'm still early in the journey, which is exactly what makes it exciting. I bring curiosity to the room, learn quickly, and care about making digital products feel clear, calm, and genuinely useful.</p>
          </div>

          <div className="developer-skills developer-panel">
            <div className="panel-label"><span>02</span> What I bring</div>
            <div className="skill-orbits">
              <div className="skill-orbit"><span className="skill-icon"><Code2 size={18} /></span><strong>React</strong><small>Frontend craft</small></div>
              <div className="skill-orbit"><span className="skill-icon"><BrainCircuit size={18} /></span><strong>Node.js</strong><small>Backend thinking</small></div>
              <div className="skill-orbit"><span className="skill-icon"><Palette size={18} /></span><strong>Python</strong><small>AI experiments</small></div>
            </div>
            <div className="skill-level"><span>Current comfort zone</span><strong>Intermediate</strong><span className="level-line"><i /></span></div>
          </div>
        </div>
      </div>

      <div className="journey-block developer-panel">
        <div className="journey-heading"><div><div className="panel-label"><span>03</span> The journey</div><h3>Learning in public, <em>one build at a time.</em></h3></div><span className="journey-note">CS journey / 2024 - now</span></div>
        <div className="journey-line">
          <div className="journey-step"><span className="journey-dot" /><span className="journey-year"><GraduationCap size={14} /> 2024</span><h4>Started the journey</h4><p>Began Computer Science at COMSATS University Islamabad, Sahiwal Campus, and found a place where curiosity could become a practice.</p></div>
          <div className="journey-step"><span className="journey-dot" /><span className="journey-year">Then</span><h4>Found the builder's rhythm</h4><p>Moved from learning concepts to shaping real interfaces, connecting frontends, APIs, and ideas that people can actually use.</p></div>
          <div className="journey-step current-step"><span className="journey-dot" /><span className="journey-year">Now</span><h4>Building with intent</h4><p>Exploring AI, full-stack products, and the kind of design that makes technology feel a little more human.</p></div>
        </div>
      </div>

      <div className="developer-footer-line"><span><CalendarDays size={14} /> Available for thoughtful collaborations, learning, and good problems.</span><a href="mailto:shoaibfarooq1076@gmail.com">Say hello <ArrowRight size={15} /></a></div>
    </section>
  );

  return (
    <div className="app-shell">
      <header className="site-header">
        <a className="brand" href="#top" onClick={() => setMobileMenuOpen(false)}><span className="brand-mark"><span /><span /><span /></span><span>chhote <em>tools</em></span></a>
        <button aria-label="Toggle navigation" className="menu-button" onClick={() => setMobileMenuOpen((open) => !open)} type="button">{mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}</button>
        <nav className={`main-nav ${mobileMenuOpen ? "open" : ""}`}><a href="#studio" onClick={() => setMobileMenuOpen(false)}>The toolkit</a><a href="#developer" onClick={() => setMobileMenuOpen(false)}>Developer</a><button className="header-cta" onClick={() => openTool("qr")} type="button">Make something <ArrowUpRightIcon /></button></nav>
      </header>
      <main>
        <section className="hero-section" id="top">
          <div className="hero-copy"><p className="eyebrow"><span /> Small tools for real life</p><h1>Less fuss.<br /><span>More done.</span></h1><p className="hero-lede">A friendly little corner for the digital loose ends. Make a QR code, shrink a photo, or get a second look at your resume.</p><div className="hero-actions"><button className="primary-button" onClick={() => openTool("qr")} type="button">Start with a QR code <ArrowRight size={17} /></button><a className="quiet-link" href="#studio">See all tools <ArrowDown size={15} /></a></div><p className="hero-footnote"><ShieldCheck size={14} /> No sign-ups. No strange uploads. Just useful.</p></div>
          <div className="hero-visual" aria-label="A preview of the chhote tools toolkit"><div className="hero-visual-top"><span>CHHOTE / 01</span><span>YOUR SMALL WINS</span></div><div className="hero-note"><div className="note-line"><span className="note-number">01</span><span>share the thing</span><ScanLine size={18} /></div><div className="note-line faded"><span className="note-number">02</span><span>lighten the load</span><ImageIcon size={18} /></div><div className="note-line faded"><span className="note-number">03</span><span>tell your story</span><FileCheck2 size={18} /></div><div className="note-footer"><span>one small step at a time</span><span className="handwritten">you've got this</span></div></div><div className="hero-qr"><div className="hero-qr-label">A little link<br />to somewhere good</div>{qrPreview && <img alt="QR code example" src={qrPreview} />}<Link2 size={19} /></div><div className="hero-stamp">tiny<br /><strong>but mighty</strong></div></div>
        </section>
        <section className="intro-strip" id="why"><span className="intro-line" /><p>For the moments between "I should do that" and "glad that's done."</p><span className="intro-line" /></section>
        <section className="studio-section" id="studio"><div className="section-heading"><div><p className="eyebrow">The toolkit</p><h2>Pick your <em>small win.</em></h2></div><p className="section-description">Three simple tools, made with care and no learning curve.</p></div><div className="tool-studio"><aside className="tool-rail" aria-label="Choose a tool"><div className="rail-label">I need to...</div>{tools.map((tool) => { const ToolIcon = tool.icon; return <button className={`tool-choice ${activeTool === tool.id ? "selected" : ""}`} key={tool.id} onClick={() => setActiveTool(tool.id)} type="button"><span className="tool-choice-icon"><ToolIcon size={19} /></span><span className="tool-choice-copy"><strong>{tool.label}</strong><small>{tool.description}</small></span><ChevronRight className="choice-arrow" size={17} /></button>; })}<div className="rail-note"><Zap size={16} /><span>Everything runs locally in your browser.</span></div></aside><section className="tool-workspace" aria-labelledby="active-tool-title"><div className="workspace-header"><div><span className="workspace-index">0{tools.findIndex((tool) => tool.id === activeTool) + 1} / 03</span><h2 id="active-tool-title">{currentTool.label}</h2></div><span className="workspace-tag">{activeTool === "qr" ? "Share simply" : activeTool === "compress" ? "Keep it light" : "Beat the ATS"}</span></div>{activeTool === "qr" && renderQrTool()}{activeTool === "compress" && renderCompressTool()}{activeTool === "resume" && renderResumeTool()}</section></div></section>
        <section className="closing-section"><div className="closing-copy"><p className="eyebrow">A note from the makers</p><h2>Small is a <em>feature.</em></h2><p>We think the best tools respect your time, your attention, and your very human way of getting things done.</p></div><div className="closing-mark"><span>made for</span><strong>the in-between</strong><span>moments</span></div></section>
        {renderDeveloperSection()}
      </main>
      <footer className="site-footer"><div className="footer-brand"><span className="brand-mark"><span /><span /><span /></span><span>chhote tools</span></div><span>Useful little things for everyday people.</span><span>© 2026 Chhote Tools</span></footer>
    </div>
  );
}

function ArrowUpRightIcon() {
  return <ArrowRight size={16} className="arrow-up-right" />;
}