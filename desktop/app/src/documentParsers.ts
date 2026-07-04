const textExtensions = new Set(["txt", "md", "markdown", "csv", "json", "html", "xml"]);

export async function extractDocumentText(file: File) {
  const extension = getExtension(file.name);

  if (file.type === "application/pdf" || extension === "pdf") {
    return extractPdfText(file);
  }

  if (
    file.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    extension === "docx"
  ) {
    return extractDocxText(file);
  }

  if (file.type === "application/epub+zip" || extension === "epub") {
    return extractEpubText(file);
  }

  if (file.type.startsWith("text/") || textExtensions.has(extension)) {
    return file.text();
  }

  throw new Error("Unsupported document type. Try PDF, DOCX, EPUB, TXT, MD, CSV, JSON, HTML, or XML.");
}

export function isImportableDocument(file: File) {
  const extension = getExtension(file.name);
  return (
    file.type.startsWith("text/") ||
    textExtensions.has(extension) ||
    ["pdf", "docx", "epub"].includes(extension)
  );
}

function getExtension(name: string) {
  return name.split(".").pop()?.toLowerCase() ?? "";
}

async function extractPdfText(file: File) {
  const pdfjs = await import("pdfjs-dist");
  const worker = await import("pdfjs-dist/build/pdf.worker.mjs?url");
  pdfjs.GlobalWorkerOptions.workerSrc = worker.default;

  const document = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;
  const pages: string[] = [];

  for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
    const page = await document.getPage(pageNumber);
    const content = await page.getTextContent();
    pages.push(
      content.items
        .map((item) => ("str" in item ? item.str : ""))
        .join(" ")
        .replace(/\s+/g, " ")
        .trim(),
    );
  }

  return pages.filter(Boolean).join("\n\n");
}

async function extractDocxText(file: File) {
  const mammoth = await import("mammoth/mammoth.browser");
  const result = await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() });
  return result.value.trim();
}

async function extractEpubText(file: File) {
  const JSZip = (await import("jszip")).default;
  const zip = await JSZip.loadAsync(await file.arrayBuffer());
  const container = await zip.file("META-INF/container.xml")?.async("text");

  if (!container) {
    throw new Error("EPUB container metadata was not found.");
  }

  const parser = new DOMParser();
  const containerXml = parser.parseFromString(container, "application/xml");
  const rootfilePath = containerXml.querySelector("rootfile")?.getAttribute("full-path");

  if (!rootfilePath) {
    throw new Error("EPUB package file was not found.");
  }

  const packageXmlText = await zip.file(rootfilePath)?.async("text");

  if (!packageXmlText) {
    throw new Error("EPUB package content was not readable.");
  }

  const packageXml = parser.parseFromString(packageXmlText, "application/xml");
  const basePath = rootfilePath.includes("/") ? rootfilePath.slice(0, rootfilePath.lastIndexOf("/") + 1) : "";
  const manifest = new Map<string, string>();

  packageXml.querySelectorAll("manifest item").forEach((item) => {
    const id = item.getAttribute("id");
    const href = item.getAttribute("href");
    if (id && href) manifest.set(id, `${basePath}${href}`);
  });

  const spineIds = Array.from(packageXml.querySelectorAll("spine itemref"))
    .map((item) => item.getAttribute("idref"))
    .filter((id): id is string => Boolean(id));

  const sections: string[] = [];

  for (const id of spineIds) {
    const path = manifest.get(id);
    if (!path) continue;
    const html = await zip.file(path)?.async("text");
    if (!html) continue;
    const document = parser.parseFromString(html, "text/html");
    const text = document.body?.textContent?.replace(/\s+/g, " ").trim();
    if (text) sections.push(text);
  }

  return sections.join("\n\n");
}
