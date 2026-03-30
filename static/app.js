const uploadZone = document.getElementById("upload-zone");
const tiktokZone = document.getElementById("tiktok-zone");
const fileInput = document.getElementById("file-input");
const processingSection = document.getElementById("processing-section");
const resultsSection = document.getElementById("results-section");
const tiktokResultsSection = document.getElementById("tiktok-results-section");
const errorSection = document.getElementById("error-section");
const progressFill = document.getElementById("progress-fill");
const progressStatus = document.getElementById("progress-status");
const progressPct = document.getElementById("progress-pct");

// ===================== SIDEBAR NAVIGATION =====================

const pageTitles = {
    file: ["Vidéo", "Améliorez la qualité de vos vidéos avec l'IA"],
    tiktok: ["TikTok", "Téléchargez et améliorez des vidéos TikTok sans filigrane"],
    image: ["Image", "Upscalez vos images avec Real-ESRGAN"],
    captions: ["Captions", "Ajoutez des sous-titres automatiques style CapCut"],
    downloader: ["Downloader", "Téléchargez des vidéos depuis YouTube, Instagram, Twitter et +1000 sites"],
    audio: ["Extraction Audio", "Extrayez le son d'une vidéo en MP3 ou WAV"],
    trim: ["Trim Vidéo", "Découpez une portion de votre vidéo"],
    bgremove: ["BG Remove", "Supprimez le fond d'une image avec l'IA"],
    voiceover: ["Voix Off", "Générez des voix off professionnelles avec Microsoft Neural TTS"],
    automation: ["Automation", "Générez des Reels automatiquement et lancez des pipelines vidéo"],
    publish: ["Publier", "Publiez vos vidéos sur TikTok, YouTube et Instagram"],
    scraper: ["Scraper", "Extraire les produits d'une boutique Shopify en CSV ou Excel"],
    analyse: ["Analyse", "Best-sellers, estimation CA, liens vers les ads"],
    history: ["Historique", "Vos derniers fichiers traités"],
    settings: ["Paramètres", "Configurez vos clés API et préférences"],
};

document.querySelectorAll(".nav-item").forEach((item) => {
    item.addEventListener("click", () => {
        const source = item.dataset.source;

        // Update active state
        document.querySelectorAll(".nav-item").forEach((n) => n.classList.remove("active"));
        item.classList.add("active");

        // Update page title
        const titles = pageTitles[source] || [source, ""];
        const titleEl = document.getElementById("page-title");
        const subtitleEl = document.getElementById("page-subtitle");
        if (titleEl) titleEl.textContent = titles[0];
        if (subtitleEl) subtitleEl.textContent = titles[1];

        if (source === "history") {
            // Hide all zones, show history
            _hideAllZones();
            document.getElementById("history-zone").classList.remove("hidden");
            renderHistoryPage();
            return;
        }

        if (source === "settings") {
            _hideAllZones();
            document.getElementById("settings-zone").classList.remove("hidden");
            loadSettingsStatus();
            return;
        }

        // Hide history zone
        document.getElementById("history-zone").classList.add("hidden");

        // New standalone zones that don't use source-tab mechanism
        const standaloneZones = {
            downloader: "downloader-zone",
            audio: "audio-zone",
            trim: "trim-zone",
            bgremove: "bgremove-zone",
            voiceover: "voiceover-zone",
            automation: "automation-zone",
            publish: "publish-zone",
        };
        if (standaloneZones[source]) {
            _hideAllZones();
            document.getElementById(standaloneZones[source]).classList.remove("hidden");
            if (source === "automation") initAutomation();
            if (source === "publish") initPublish();
            return;
        }

        // Trigger the existing source-tab for this source
        const tab = document.querySelector(`.source-tab[data-source="${source}"]`);
        if (tab) tab.click();
    });
});

function _hideAllZones() {
    const ids = [
        "upload-zone", "tiktok-zone", "image-zone", "captions-zone",
        "scraper-zone", "analyse-zone", "mode-section",
        "downloader-zone", "downloader-processing-section", "downloader-results-section",
        "audio-zone", "audio-processing-section", "audio-results-section",
        "trim-zone", "trim-processing-section", "trim-results-section",
        "bgremove-zone", "bgremove-processing-section", "bgremove-results-section",
        "voiceover-zone",
        "automation-zone",
        "publish-zone",
        "settings-zone",
        "scraper-processing-section", "scraper-results-section",
        "analyse-processing-section", "analyse-results-section",
        "captions-processing-section", "captions-results-section", "captions-batch-results-section",
        "image-processing-section", "image-results-section",
        "tracker-scan-section", "tracker-data-section",
    ];
    ids.forEach(id => { const el = document.getElementById(id); if (el) el.classList.add("hidden"); });
    processingSection.classList.add("hidden");
    resultsSection.classList.add("hidden");
    tiktokResultsSection.classList.add("hidden");
    errorSection.classList.add("hidden");
}

// ===================== HISTORY =====================

const HISTORY_KEY = "media_enhancer_history";

function saveHistory(type, name, jobId, downloadUrl, details) {
    try {
        const history = getHistory();
        history.unshift({
            id: Date.now(),
            type,
            name,
            jobId,
            downloadUrl,
            details,
            date: new Date().toISOString(),
        });
        // Keep last 50 entries
        localStorage.setItem(HISTORY_KEY, JSON.stringify(history.slice(0, 50)));
    } catch (e) {}
}

function getHistory() {
    try {
        return JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]");
    } catch (e) {
        return [];
    }
}

function timeAgo(isoDate) {
    const diff = (Date.now() - new Date(isoDate)) / 1000;
    if (diff < 60) return "À l'instant";
    if (diff < 3600) return `Il y a ${Math.floor(diff / 60)} min`;
    if (diff < 86400) return `Il y a ${Math.floor(diff / 3600)}h`;
    return `Il y a ${Math.floor(diff / 86400)} jour(s)`;
}

const typeIcons = {
    video: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="2" y="2" width="20" height="20" rx="3"/><polygon points="10 8 16 12 10 16 10 8"/></svg>`,
    tiktok: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M9 12a4 4 0 1 0 4 4V4a5 5 0 0 0 5 5"/></svg>`,
    image: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>`,
    captions: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="2" y="2" width="20" height="20" rx="2"/><path d="M7 15h4m-4-3h10M7 9h7"/></svg>`,
    scraper: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>`,
    analyse: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>`,
};

const typeLabels = { video: "Vidéo", tiktok: "TikTok", image: "Image", captions: "Captions", scraper: "Scraper", analyse: "Analyse" };

function renderHistoryPage() {
    const history = getHistory();
    const list = document.getElementById("history-list");

    if (history.length === 0) {
        list.innerHTML = `
            <div class="history-empty">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2" opacity="0.3">
                    <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/>
                    <path d="M3 3v5h5"/><path d="M12 7v5l4 2"/>
                </svg>
                <p>Aucun fichier traité pour l'instant</p>
            </div>`;
        return;
    }

    list.innerHTML = history.map((entry) => `
        <div class="history-card">
            <div class="history-card-icon ${entry.type}">${typeIcons[entry.type] || ""}</div>
            <div class="history-card-info">
                <div class="history-card-name">${escapeHtml(entry.name)}</div>
                <div class="history-card-meta">
                    <span class="history-card-badge ${entry.type}">${typeLabels[entry.type] || entry.type}</span>
                    <span>${timeAgo(entry.date)}</span>
                    ${entry.details ? `<span>${escapeHtml(entry.details)}</span>` : ""}
                </div>
            </div>
            <div class="history-card-actions">
                ${entry.downloadUrl ? `<a href="${escapeHtml(entry.downloadUrl)}" class="btn btn-primary btn-sm">Télécharger</a>` : ""}
            </div>
        </div>
    `).join("");
}

document.getElementById("history-clear-btn").addEventListener("click", () => {
    if (confirm("Effacer tout l'historique ?")) {
        localStorage.removeItem(HISTORY_KEY);
        renderHistoryPage();
    }
});

let currentJobId = null;
let pollInterval = null;
let selectedMode = "ai";
let selectedScale = 2;
let selectedFpsBoost = 1;
let selectedImageScale = 2;
let selectedLang = "auto";
let selectedTemplate = "classic";
let selectedSource = window.HAS_MEDIA ? "file" : "scraper";

// ---- Init: enforce correct visibility on page load ----
if (!window.HAS_MEDIA) {
    document.getElementById("mode-section").classList.add("hidden");
    document.getElementById("upload-zone").classList.add("hidden");
    document.getElementById("scraper-zone").classList.remove("hidden");
}

// ---- Source tab selection ----

document.querySelectorAll(".source-tab").forEach((tab) => {
    tab.addEventListener("click", () => {
        document.querySelectorAll(".source-tab").forEach((t) => t.classList.remove("selected"));
        tab.classList.add("selected");
        selectedSource = tab.dataset.source;

        const imageZone = document.getElementById("image-zone");
        const captionsZone = document.getElementById("captions-zone");
        const scraperZone = document.getElementById("scraper-zone");
        const analyseZone = document.getElementById("analyse-zone");
        uploadZone.classList.add("hidden");
        tiktokZone.classList.add("hidden");
        imageZone.classList.add("hidden");
        captionsZone.classList.add("hidden");
        scraperZone.classList.add("hidden");
        analyseZone.classList.add("hidden");

        const modeSection = document.getElementById("mode-section");

        if (selectedSource === "tiktok") {
            tiktokZone.classList.remove("hidden");
            modeSection.classList.remove("hidden");
        } else if (selectedSource === "image") {
            imageZone.classList.remove("hidden");
            modeSection.classList.add("hidden");
        } else if (selectedSource === "captions") {
            captionsZone.classList.remove("hidden");
            modeSection.classList.add("hidden");
        } else if (selectedSource === "scraper") {
            scraperZone.classList.remove("hidden");
            modeSection.classList.add("hidden");
        } else if (selectedSource === "analyse") {
            analyseZone.classList.remove("hidden");
            modeSection.classList.add("hidden");
        } else {
            uploadZone.classList.remove("hidden");
            modeSection.classList.remove("hidden");
        }
    });
});

// ---- Mode selection ----

document.querySelectorAll(".mode-card").forEach((card) => {
    card.addEventListener("click", () => {
        document.querySelectorAll(".mode-card").forEach((c) => c.classList.remove("selected"));
        card.classList.add("selected");
        selectedMode = card.dataset.mode;

        const aiOpts = document.getElementById("ai-options");
        if (selectedMode === "ai") {
            aiOpts.classList.remove("hidden");
        } else {
            aiOpts.classList.add("hidden");
        }
    });
});

document.querySelectorAll(".scale-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
        document.querySelectorAll(".scale-btn").forEach((b) => b.classList.remove("selected"));
        btn.classList.add("selected");
        selectedScale = parseInt(btn.dataset.scale);
    });
});

// ---- FPS boost selection ----

document.querySelectorAll(".fps-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
        document.querySelectorAll(".fps-btn").forEach((b) => b.classList.remove("selected"));
        btn.classList.add("selected");
        selectedFpsBoost = parseInt(btn.dataset.fps);
    });
});

// ---- Image scale selection ----

document.querySelectorAll(".img-scale-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
        document.querySelectorAll(".img-scale-btn").forEach((b) => b.classList.remove("selected"));
        btn.classList.add("selected");
        selectedImageScale = parseInt(btn.dataset.imgscale);
    });
});

// ---- Image upload handlers ----

const imageZoneEl = document.getElementById("image-zone");
const imageUploadZone = document.getElementById("image-upload-zone");
const imageFileInput = document.getElementById("image-file-input");

imageUploadZone.addEventListener("click", () => imageFileInput.click());

imageUploadZone.addEventListener("dragover", (e) => {
    e.preventDefault();
    imageUploadZone.classList.add("dragover");
});

imageUploadZone.addEventListener("dragleave", () => {
    imageUploadZone.classList.remove("dragover");
});

imageUploadZone.addEventListener("drop", (e) => {
    e.preventDefault();
    imageUploadZone.classList.remove("dragover");
    const file = e.dataTransfer.files[0];
    if (file) uploadImage(file);
});

imageFileInput.addEventListener("change", () => {
    if (imageFileInput.files[0]) uploadImage(imageFileInput.files[0]);
});

async function uploadImage(file) {
    const validExts = ["png", "jpg", "jpeg", "webp", "bmp", "tiff", "tif"];
    const ext = file.name.toLowerCase().split(".").pop();
    if (!validExts.includes(ext)) {
        alert("Format non supporte. Utilisez PNG, JPEG ou WebP.");
        return;
    }

    // Hide everything, show image processing
    document.getElementById("source-tabs").classList.add("hidden");
    document.getElementById("mode-section").classList.add("hidden");
    imageZoneEl.classList.add("hidden");
    uploadZone.classList.add("hidden");
    tiktokZone.classList.add("hidden");
    processingSection.classList.add("hidden");
    document.getElementById("image-processing-section").classList.remove("hidden");
    document.getElementById("image-results-section").classList.add("hidden");
    errorSection.classList.add("hidden");

    // Reset image progress
    document.getElementById("image-progress-fill").style.width = "0%";
    document.getElementById("image-progress-pct").textContent = "0%";
    document.getElementById("image-progress-status").textContent = "Upload...";
    document.getElementById("image-detail-status").textContent = "";
    document.querySelectorAll("#image-processing-section .step").forEach(s => s.classList.remove("active", "done"));

    const formData = new FormData();
    formData.append("file", file);
    formData.append("scale", selectedImageScale);

    try {
        const res = await fetch("/image/upload", { method: "POST", body: formData });
        const data = await res.json();

        if (data.error) {
            showError(data.error);
            return;
        }

        currentJobId = data.job_id;
        startImagePolling();
    } catch (err) {
        showError("Erreur lors de l'upload: " + err.message);
    }
}

function startImagePolling() {
    pollInterval = setInterval(pollImageStatus, 1000);
}

async function pollImageStatus() {
    if (!currentJobId) return;

    try {
        const res = await fetch(`/image/status/${currentJobId}`);
        const data = await res.json();

        const pct = data.progress || 0;
        document.getElementById("image-progress-fill").style.width = pct + "%";
        document.getElementById("image-progress-pct").textContent = pct + "%";
        document.getElementById("image-progress-status").textContent = data.status_message || data.status;
        document.getElementById("image-detail-status").textContent = data.status_message || "";

        // Update pipeline steps
        const stepOrder = ["analyzing", "processing", "done"];
        const currentIdx = stepOrder.indexOf(data.status);
        const steps = document.querySelectorAll("#image-processing-section .step");
        steps.forEach((el) => {
            const stepName = el.dataset.step;
            const stepIdx = stepOrder.indexOf(stepName);
            el.classList.remove("active", "done");
            if (stepIdx < currentIdx) el.classList.add("done");
            else if (stepIdx === currentIdx) el.classList.add("active");
        });

        if (data.status === "done") {
            stopPolling();
            showImageResults(data);
        } else if (data.status === "error") {
            stopPolling();
            showError(data.error || "Erreur inconnue");
        }
    } catch (err) {
        // Network error, keep polling
    }
}

function showImageResults(data) {
    document.getElementById("image-processing-section").classList.add("hidden");
    document.getElementById("image-results-section").classList.remove("hidden");

    const inp = data.input_info;
    const out = data.output_info;

    saveHistory("image", inp && inp.filename ? inp.filename : "image", currentJobId, `/image/download/${currentJobId}`, out ? `${inp.resolution} → ${out.resolution}` : "");

    document.getElementById("img-before-info").innerHTML = `
        <p class="big">${inp.size_kb > 1024 ? inp.size_mb + " MB" : inp.size_kb + " KB"}</p>
        <p>${inp.resolution}</p>
        <p>${inp.format}</p>
    `;

    document.getElementById("img-after-info").innerHTML = `
        <p class="big green">${out.size_kb > 1024 ? out.size_mb + " MB" : out.size_kb + " KB"}</p>
        <p>${out.resolution}</p>
        <p>${out.format}</p>
    `;

    document.getElementById("image-download-btn").onclick = () => {
        window.location.href = `/image/download/${currentJobId}`;
    };

    document.getElementById("image-new-btn").onclick = () => {
        document.getElementById("image-results-section").classList.add("hidden");
        document.getElementById("source-tabs").classList.remove("hidden");
        document.getElementById("image-zone").classList.remove("hidden");
        imageFileInput.value = "";
        currentJobId = null;
    };
}

// ---- Captions handlers ----

document.querySelectorAll(".lang-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
        document.querySelectorAll(".lang-btn").forEach((b) => b.classList.remove("selected"));
        btn.classList.add("selected");
        selectedLang = btn.dataset.lang;
    });
});

document.querySelectorAll(".template-card").forEach((card) => {
    card.addEventListener("click", () => {
        document.querySelectorAll(".template-card").forEach((c) => c.classList.remove("selected"));
        card.classList.add("selected");
        selectedTemplate = card.dataset.template;
    });
});

const captionsZoneEl = document.getElementById("captions-zone");
const captionsUploadZone = document.getElementById("captions-upload-zone");
const captionsFileInput = document.getElementById("captions-file-input");

captionsUploadZone.addEventListener("click", () => captionsFileInput.click());

captionsUploadZone.addEventListener("dragover", (e) => {
    e.preventDefault();
    captionsUploadZone.classList.add("dragover");
});

captionsUploadZone.addEventListener("dragleave", () => {
    captionsUploadZone.classList.remove("dragover");
});

captionsUploadZone.addEventListener("drop", (e) => {
    e.preventDefault();
    captionsUploadZone.classList.remove("dragover");
    const files = e.dataTransfer.files;
    if (files.length > 0) uploadForCaptions(files);
});

captionsFileInput.addEventListener("change", () => {
    if (captionsFileInput.files.length > 0) uploadForCaptions(captionsFileInput.files);
});

let captionsBatchMode = false;

async function uploadForCaptions(files) {
    // Filter MP4 only
    const mp4Files = Array.from(files).filter(f => f.name.toLowerCase().endsWith(".mp4"));
    if (mp4Files.length === 0) {
        alert("Seuls les fichiers MP4 sont acceptes.");
        return;
    }

    // Hide everything, show captions processing
    document.getElementById("source-tabs").classList.add("hidden");
    document.getElementById("mode-section").classList.add("hidden");
    captionsZoneEl.classList.add("hidden");
    uploadZone.classList.add("hidden");
    tiktokZone.classList.add("hidden");
    document.getElementById("image-zone").classList.add("hidden");
    processingSection.classList.add("hidden");
    document.getElementById("captions-processing-section").classList.remove("hidden");
    document.getElementById("captions-results-section").classList.add("hidden");
    document.getElementById("captions-batch-results-section").classList.add("hidden");
    errorSection.classList.add("hidden");

    // Reset
    document.getElementById("captions-progress-fill").style.width = "0%";
    document.getElementById("captions-progress-pct").textContent = "0%";
    document.getElementById("captions-progress-status").textContent = mp4Files.length > 1
        ? `Demarrage (${mp4Files.length} videos)...`
        : "Demarrage...";
    document.getElementById("captions-detail-status").textContent = "";
    document.querySelectorAll("#captions-processing-section .step").forEach(s => s.classList.remove("active", "done"));

    const formData = new FormData();
    for (const file of mp4Files) {
        formData.append("files", file);
    }
    formData.append("language", selectedLang);
    formData.append("template", selectedTemplate);

    try {
        const res = await fetch("/captions/upload", { method: "POST", body: formData });
        const data = await res.json();

        if (data.error) {
            showError(data.error);
            return;
        }

        currentJobId = data.job_id;
        captionsBatchMode = data.mode === "batch";
        if (captionsBatchMode) {
            startCaptionsBatchPolling();
        } else {
            startCaptionsPolling();
        }
    } catch (err) {
        showError("Erreur: " + err.message);
    }
}

function startCaptionsPolling() {
    pollInterval = setInterval(pollCaptionsStatus, 1000);
}

async function pollCaptionsStatus() {
    if (!currentJobId) return;

    try {
        const res = await fetch(`/captions/status/${currentJobId}`);
        const data = await res.json();

        const pct = data.progress || 0;
        document.getElementById("captions-progress-fill").style.width = pct + "%";
        document.getElementById("captions-progress-pct").textContent = pct + "%";
        document.getElementById("captions-progress-status").textContent = data.status_message || data.status;
        document.getElementById("captions-detail-status").textContent = data.status_message || "";

        // Update pipeline steps
        const stepOrder = ["extracting", "transcribing", "generating", "burning", "done"];
        const currentIdx = stepOrder.indexOf(data.status);
        document.querySelectorAll("#captions-processing-section .step").forEach((el) => {
            const stepName = el.dataset.step;
            const stepIdx = stepOrder.indexOf(stepName);
            el.classList.remove("active", "done");
            if (stepIdx < currentIdx) el.classList.add("done");
            else if (stepIdx === currentIdx) el.classList.add("active");
        });

        if (data.status === "done") {
            stopPolling();
            showCaptionsResults(data);
        } else if (data.status === "error") {
            stopPolling();
            showError(data.error || "Erreur inconnue");
        }
    } catch (err) {
        // Network error, keep polling
    }
}

function showCaptionsResults(data) {
    document.getElementById("captions-processing-section").classList.add("hidden");
    document.getElementById("captions-results-section").classList.remove("hidden");

    saveHistory("captions", "video_captionné.mp4", currentJobId, `/captions/download/${currentJobId}`, `${data.segments_count || 0} segments · ${data.output_size_mb || 0} MB`);

    const langNames = { fr: "Français", en: "English", de: "Deutsch" };
    document.getElementById("captions-lang-result").textContent =
        langNames[data.detected_language] || data.detected_language || "Auto";
    document.getElementById("captions-segments-result").textContent = data.segments_count || 0;
    document.getElementById("captions-size-result").textContent = (data.output_size_mb || 0) + " MB";

    // Track active download job (updated after each reburn)
    let _activeDownloadJobId = currentJobId;

    const dlBtn = document.getElementById("captions-download-btn");
    dlBtn.textContent = "Télécharger la vidéo sous-titrée";
    dlBtn.onclick = () => { window.location.href = `/captions/download/${_activeDownloadJobId}`; };

    document.getElementById("captions-new-btn").onclick = () => {
        document.getElementById("captions-results-section").classList.add("hidden");
        document.getElementById("source-tabs").classList.remove("hidden");
        document.getElementById("captions-zone").classList.remove("hidden");
        captionsFileInput.value = "";
        currentJobId = null;
    };

    // Init CapCut editor
    _ceInit(currentJobId, (newJobId) => {
        _activeDownloadJobId = newJobId;
        dlBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg> Télécharger la version modifiée`;
    });
}

// ===================== TIMING HELPERS =====================

function _formatTime(sec) {
    const m = Math.floor(sec / 60);
    const s = (sec % 60).toFixed(2).padStart(5, "0");
    return `${m}:${s}`;
}

function _parseTime(str) {
    const parts = str.split(":");
    if (parts.length === 2) return parseFloat(parts[0]) * 60 + parseFloat(parts[1]);
    return parseFloat(str);
}

function _ceFormatTime(s) {
    if (!s || isNaN(s)) return "0:00";
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, "0")}`;
}

// ===================== CAPCUT EDITOR =====================

let _ceSegments = [];
let _ceSelectedIdx = -1;

function _ceInit(jobId, onReburnDone) {
    const toggleBtn = document.getElementById("captions-editor-toggle");
    const panel = document.getElementById("captions-editor-panel");
    let loaded = false;

    toggleBtn.onclick = async () => {
        if (!panel.classList.contains("hidden")) {
            panel.classList.add("hidden");
            toggleBtn.classList.remove("open");
            return;
        }
        panel.classList.remove("hidden");
        toggleBtn.classList.add("open");
        if (!loaded) {
            loaded = true;
            const list = document.getElementById("captions-segments-list");
            list.innerHTML = `<div style="color:#6b6b88;padding:12px;font-size:0.82rem;">Chargement des segments...</div>`;
            try {
                const res = await fetch(`/captions/segments/${jobId}`);
                const json = await res.json();
                _ceSegments = (json.segments || []).map(s => Object.assign({}, s));
                _ceSetup(jobId);
            } catch (e) {
                list.innerHTML = `<div style="color:#f87171;">Erreur de chargement.</div>`;
            }
        }
    };

    document.getElementById("captions-reburn-btn").onclick = () => _ceReburn(jobId, onReburnDone);
}

function _ceSetup(jobId) {
    const video = document.getElementById("ce-video");
    video.src = `/captions/input/${jobId}`;

    // Play/pause
    const playBtn = document.getElementById("ce-play-btn");
    const playIcon = document.getElementById("ce-play-icon");
    playBtn.onclick = () => video.paused ? video.play() : video.pause();
    video.addEventListener("play", () => {
        playIcon.innerHTML = `<rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/>`;
    });
    video.addEventListener("pause", () => {
        playIcon.innerHTML = `<polygon points="5 3 19 12 5 21 5 3"/>`;
    });
    video.addEventListener("ended", () => {
        playIcon.innerHTML = `<polygon points="5 3 19 12 5 21 5 3"/>`;
    });

    // Time + overlay + playhead
    video.addEventListener("timeupdate", () => {
        const t = video.currentTime, d = video.duration || 0;
        document.getElementById("ce-time-display").textContent = `${_ceFormatTime(t)} / ${_ceFormatTime(d)}`;
        if (d) document.getElementById("ce-playhead").style.left = ((t / d) * 100) + "%";
        _ceUpdateOverlay(t);
        _ceHighlightTimeline(t);
    });

    // On metadata: detect aspect ratio + build timeline
    video.addEventListener("loadedmetadata", () => {
        const wrap = document.getElementById("ce-video-wrap");
        if (video.videoWidth > video.videoHeight) wrap.classList.add("landscape");
        _ceBuildTimeline(video.duration, video);
    });

    // Style live preview
    ["ce-color-text", "ce-color-outline", "ce-size", "ce-pos"].forEach(id => {
        document.getElementById(id).addEventListener("input", () => {
            const sv = document.getElementById("ce-size");
            const pv = document.getElementById("ce-pos");
            document.getElementById("ce-size-val").textContent = sv.value + "px";
            document.getElementById("ce-pos-val").textContent = pv.value + "%";
            _ceApplyOverlayStyle();
        });
    });
    _ceApplyOverlayStyle();

    // Segments
    document.getElementById("ce-seg-count").textContent = _ceSegments.length + " segments";
    _ceRenderList(video);
}

function _ceApplyOverlayStyle() {
    const overlay = document.getElementById("ce-sub-overlay");
    if (!overlay) return;
    const color = document.getElementById("ce-color-text").value;
    const outline = document.getElementById("ce-color-outline").value;
    const size = parseInt(document.getElementById("ce-size").value);
    const pos = parseInt(document.getElementById("ce-pos").value);
    overlay.style.color = color;
    overlay.style.fontSize = Math.round(size * 0.38) + "px";
    overlay.style.top = pos + "%";
    overlay.style.textShadow = `1px 1px 0 ${outline}, -1px 1px 0 ${outline}, 1px -1px 0 ${outline}, -1px -1px 0 ${outline}`;
}

function _ceUpdateOverlay(t) {
    const overlay = document.getElementById("ce-sub-overlay");
    if (!overlay) return;
    const seg = _ceSegments.find(s => t >= s.start && t <= s.end);
    overlay.textContent = seg ? seg.text : "";
}

function _ceBuildTimeline(duration, video) {
    const track = document.getElementById("ce-timeline-track");
    track.querySelectorAll(".ce-timeline-seg").forEach(e => e.remove());

    _ceSegments.forEach((seg, i) => {
        const left = (seg.start / duration) * 100;
        const w = Math.max(0.4, ((seg.end - seg.start) / duration) * 100);
        const block = document.createElement("div");
        block.className = "ce-timeline-seg";
        block.style.cssText = `left:${left}%;width:${w}%;`;
        block.dataset.idx = i;
        block.title = seg.text;
        if (w > 3) block.textContent = seg.text.slice(0, 10) + (seg.text.length > 10 ? "…" : "");
        block.addEventListener("click", (e) => {
            e.stopPropagation();
            _ceSelect(i, video);
        });
        track.appendChild(block);
    });

    track.addEventListener("click", (e) => {
        if (e.target !== track) return;
        const rect = track.getBoundingClientRect();
        video.currentTime = ((e.clientX - rect.left) / rect.width) * duration;
    });
}

function _ceHighlightTimeline(t) {
    document.querySelectorAll(".ce-timeline-seg").forEach((b) => {
        const i = parseInt(b.dataset.idx);
        const seg = _ceSegments[i];
        if (!seg) return;
        b.classList.toggle("active", t >= seg.start && t <= seg.end);
    });
}

function _ceRenderList(video) {
    const list = document.getElementById("captions-segments-list");
    list.innerHTML = "";
    _ceSegments.forEach((seg, i) => {
        const card = document.createElement("div");
        card.className = "segment-card";
        card.dataset.index = i;
        const safeText = seg.text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
        card.innerHTML = `
            <div class="segment-index" style="cursor:pointer;" title="Sélectionner">${i + 1}</div>
            <input class="segment-text-input" type="text" value="${safeText}" data-field="text" />
            <div class="segment-times">
                <input class="segment-time-input" type="text" value="${_formatTime(seg.start)}" data-field="start" />
                <span class="segment-times-sep">→</span>
                <input class="segment-time-input" type="text" value="${_formatTime(seg.end)}" data-field="end" />
                <button class="segment-delete-btn" data-delete="${i}" title="Supprimer">✕</button>
            </div>`;

        // Live sync text
        card.querySelector('[data-field="text"]').addEventListener("input", (e) => {
            _ceSegments[i].text = e.target.value;
            _ceSegments[i].words = [];
            const tblock = document.querySelector(`.ce-timeline-seg[data-idx="${i}"]`);
            if (tblock) tblock.title = e.target.value;
            _ceUpdateOverlay(document.getElementById("ce-video").currentTime);
        });
        card.querySelector('[data-field="start"]').addEventListener("change", (e) => {
            const t = _parseTime(e.target.value);
            if (!isNaN(t)) _ceSegments[i].start = t;
        });
        card.querySelector('[data-field="end"]').addEventListener("change", (e) => {
            const t = _parseTime(e.target.value);
            if (!isNaN(t)) _ceSegments[i].end = t;
        });

        // Click index to select
        card.querySelector(".segment-index").addEventListener("click", () => _ceSelect(i, video));

        // Delete button
        card.querySelector(".segment-delete-btn").addEventListener("click", (e) => {
            e.stopPropagation();
            if (_ceSegments.length <= 1) { alert("Impossible de supprimer le seul segment."); return; }
            _ceSegments.splice(i, 1);
            _ceRenderList(video);
            document.getElementById("ce-seg-count").textContent = _ceSegments.length + " segments";
            // Rebuild timeline if video ready
            if (video && video.duration) _ceBuildTimeline(video.duration, video);
        });

        list.appendChild(card);
    });
}

function _ceSelect(idx, video) {
    _ceSelectedIdx = idx;
    const seg = _ceSegments[idx];

    // Seek video to segment start
    video.currentTime = seg.start;

    // Highlight card + timeline block
    document.querySelectorAll(".segment-card").forEach((c, i) => c.classList.toggle("selected", i === idx));
    document.querySelectorAll(".ce-timeline-seg").forEach((b) => b.classList.toggle("selected", parseInt(b.dataset.idx) === idx));

    // Scroll card into view
    const card = document.querySelector(`.segment-card[data-index="${idx}"]`);
    if (card) card.scrollIntoView({ behavior: "smooth", block: "nearest" });

    // Right panel edit
    const panel = document.getElementById("ce-seg-edit");
    const safeText = seg.text.replace(/</g, "&lt;").replace(/>/g, "&gt;");
    panel.innerHTML = `
        <textarea class="ce-seg-textarea" id="ce-seg-text">${safeText}</textarea>
        <div class="ce-seg-edit-times">
            <input class="segment-time-input" id="ce-seg-start" type="text" value="${_formatTime(seg.start)}" title="Début">
            <span class="segment-times-sep">→</span>
            <input class="segment-time-input" id="ce-seg-end" type="text" value="${_formatTime(seg.end)}" title="Fin">
        </div>`;

    document.getElementById("ce-seg-text").addEventListener("input", (e) => {
        _ceSegments[idx].text = e.target.value;
        _ceSegments[idx].words = [];
        const card = document.querySelector(`.segment-card[data-index="${idx}"]`);
        if (card) card.querySelector('[data-field="text"]').value = e.target.value;
        const tblock = document.querySelector(`.ce-timeline-seg[data-idx="${idx}"]`);
        if (tblock) tblock.title = e.target.value;
        _ceUpdateOverlay(video.currentTime);
    });
    document.getElementById("ce-seg-start").addEventListener("change", (e) => {
        const t = _parseTime(e.target.value);
        if (!isNaN(t)) {
            _ceSegments[idx].start = t;
            const card = document.querySelector(`.segment-card[data-index="${idx}"]`);
            if (card) card.querySelector('[data-field="start"]').value = e.target.value;
        }
    });
    document.getElementById("ce-seg-end").addEventListener("change", (e) => {
        const t = _parseTime(e.target.value);
        if (!isNaN(t)) {
            _ceSegments[idx].end = t;
            const card = document.querySelector(`.segment-card[data-index="${idx}"]`);
            if (card) card.querySelector('[data-field="end"]').value = e.target.value;
        }
    });
}

async function _ceReburn(jobId, onDone) {
    const reburnBtn = document.getElementById("captions-reburn-btn");
    reburnBtn.disabled = true;
    reburnBtn.innerHTML = "Envoi en cours...";

    const progressDiv = document.getElementById("captions-reburn-progress");
    progressDiv.classList.remove("hidden");
    document.getElementById("captions-reburn-fill").style.width = "0%";
    document.getElementById("captions-reburn-pct").textContent = "0%";
    document.getElementById("captions-reburn-status").textContent = "Démarrage...";

    const animEl = document.getElementById("ce-animation");
    const maxWordsEl = document.getElementById("ce-max-words");
    const bgOpacityEl = document.getElementById("ce-bg-opacity");
    const bgColorEl = document.getElementById("ce-bg-color");
    const uppercaseEl = document.getElementById("ce-uppercase");
    const hlColorEl = document.getElementById("ce-highlight-color");

    const style = {
        text_color: document.getElementById("ce-color-text").value,
        outline_color: document.getElementById("ce-color-outline").value,
        font_size: parseInt(document.getElementById("ce-size").value),
        text_y_ratio: parseInt(document.getElementById("ce-pos").value) / 100,
        template: document.getElementById("ce-template").value,
        animation: animEl ? animEl.value : "none",
        max_words: maxWordsEl ? parseInt(maxWordsEl.value) : 2,
        bg_opacity: bgOpacityEl ? parseInt(bgOpacityEl.value) : 0,
        bg_color: bgColorEl ? bgColorEl.value : "#000000",
        uppercase: uppercaseEl ? uppercaseEl.checked : false,
        highlight_color: hlColorEl ? hlColorEl.value : "#ffff00",
    };

    try {
        const res = await fetch(`/captions/reburn/${jobId}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ segments: _ceSegments, style }),
        });
        const json = await res.json();
        if (json.error) throw new Error(json.error);
        _cePollReburn(json.job_id, reburnBtn, onDone);
    } catch (e) {
        progressDiv.classList.add("hidden");
        reburnBtn.disabled = false;
        reburnBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="5 3 19 12 5 21 5 3"/></svg> Regénérer avec les modifications`;
        alert("Erreur : " + e.message);
    }
}

function _cePollReburn(newJobId, reburnBtn, onDone) {
    const fill = document.getElementById("captions-reburn-fill");
    const pctEl = document.getElementById("captions-reburn-pct");
    const statusEl = document.getElementById("captions-reburn-status");

    const iv = setInterval(async () => {
        try {
            const res = await fetch(`/captions/status/${newJobId}`);
            const data = await res.json();
            const p = data.progress || 0;
            fill.style.width = p + "%";
            pctEl.textContent = p + "%";
            statusEl.textContent = data.status_message || data.status;

            if (data.status === "done") {
                clearInterval(iv);
                reburnBtn.disabled = false;
                reburnBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="5 3 19 12 5 21 5 3"/></svg> Regénérer avec les modifications`;
                statusEl.textContent = "✓ Terminé — cliquez sur Télécharger en haut";
                if (onDone) onDone(newJobId);
                showToast("Vidéo regénérée !", "Nouvelle version prête. Tu peux continuer à éditer !");
                // Montrer l'output (vidéo brûlée) dans le player pour review
                // L'éditeur reste fonctionnel pour de nouvelles modifications
            } else if (data.status === "error") {
                clearInterval(iv);
                reburnBtn.disabled = false;
                reburnBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="5 3 19 12 5 21 5 3"/></svg> Regénérer avec les modifications`;
                statusEl.textContent = "Erreur : " + (data.error || "inconnue");
            }
        } catch (_) {}
    }, 1000);
}

// ---- Captions batch polling ----

function startCaptionsBatchPolling() {
    pollInterval = setInterval(pollCaptionsBatchStatus, 1000);
}

async function pollCaptionsBatchStatus() {
    if (!currentJobId) return;

    try {
        const res = await fetch(`/captions/batch/status/${currentJobId}`);
        const data = await res.json();

        const pct = data.progress || 0;
        document.getElementById("captions-progress-fill").style.width = pct + "%";
        document.getElementById("captions-progress-pct").textContent = pct + "%";
        document.getElementById("captions-progress-status").textContent = data.status_message || data.status;
        document.getElementById("captions-detail-status").textContent = data.status_message || "";

        // Simple step tracking for batch
        const stepOrder = ["extracting", "transcribing", "generating", "burning", "done"];
        if (data.status === "processing") {
            document.querySelectorAll("#captions-processing-section .step").forEach((el, idx) => {
                el.classList.remove("active", "done");
                if (idx === 0) el.classList.add("done");
                if (idx === 1 || idx === 2 || idx === 3) el.classList.add("active");
            });
        }

        if (data.status === "done") {
            stopPolling();
            showCaptionsBatchResults(data);
        } else if (data.status === "error") {
            stopPolling();
            showError(data.error || "Erreur inconnue");
        }
    } catch (err) {}
}

function showCaptionsBatchResults(data) {
    document.getElementById("captions-processing-section").classList.add("hidden");
    document.getElementById("captions-batch-results-section").classList.remove("hidden");

    const list = document.getElementById("captions-batch-results-list");
    list.innerHTML = "";

    const results = data.results || [];
    results.forEach((r, idx) => {
        const card = document.createElement("div");
        card.className = "tiktok-result-card" + (r.status === "done" ? "" : " error");

        if (r.status === "done") {
            card.innerHTML = `
                <div class="tiktok-result-info">
                    <div class="tiktok-result-title">${escapeHtml(r.filename || "Video " + (idx + 1))}</div>
                    <div class="tiktok-result-meta">
                        ${r.output_size_mb || "?"} MB &middot; ${r.detected_language || "?"}
                    </div>
                </div>
                <button class="btn btn-primary btn-sm" onclick="downloadCaptionsBatch('${currentJobId}', ${idx})">
                    Telecharger
                </button>
            `;
        } else {
            card.innerHTML = `
                <div class="tiktok-result-info">
                    <div class="tiktok-result-title">${escapeHtml(r.filename || "Video " + (idx + 1))}</div>
                    <div class="tiktok-result-error">${escapeHtml(r.error || "Erreur")}</div>
                </div>
                <span class="tiktok-result-badge-error">Echoue</span>
            `;
        }

        list.appendChild(card);
    });

    document.getElementById("captions-batch-download-all-btn").onclick = () => {
        results.forEach((r, idx) => {
            if (r.status === "done") {
                downloadCaptionsBatch(currentJobId, idx);
            }
        });
    };

    document.getElementById("captions-batch-new-btn").onclick = () => {
        document.getElementById("captions-batch-results-section").classList.add("hidden");
        document.getElementById("source-tabs").classList.remove("hidden");
        document.getElementById("captions-zone").classList.remove("hidden");
        captionsFileInput.value = "";
        currentJobId = null;
    };
}

function downloadCaptionsBatch(batchId, index) {
    window.location.href = `/captions/batch/download/${batchId}/${index}`;
}

// ---- TikTok URL input ----

const tiktokUrls = document.getElementById("tiktok-urls");
const urlCount = document.getElementById("url-count");
const tiktokStartBtn = document.getElementById("tiktok-start-btn");

function countUrls() {
    const text = tiktokUrls.value.trim();
    if (!text) {
        urlCount.textContent = "0 URL(s) detectee(s)";
        tiktokStartBtn.disabled = true;
        return 0;
    }
    const urls = text.split(/[\n,]+/).map(u => u.trim()).filter(u => u.length > 0 && u.includes("tiktok"));
    const count = urls.length;
    urlCount.textContent = `${count} URL(s) detectee(s)`;
    tiktokStartBtn.disabled = count === 0;
    return count;
}

tiktokUrls.addEventListener("input", countUrls);

tiktokStartBtn.addEventListener("click", () => {
    const text = tiktokUrls.value.trim();
    if (!text) return;
    const urls = text.split(/[\n,]+/).map(u => u.trim()).filter(u => u.length > 0);
    startTiktokJob(urls);
});

async function startTiktokJob(urls) {
    // Show processing
    document.getElementById("source-tabs").classList.add("hidden");
    document.getElementById("mode-section").classList.add("hidden");
    tiktokZone.classList.add("hidden");
    uploadZone.classList.add("hidden");
    processingSection.classList.remove("hidden");
    resultsSection.classList.add("hidden");
    tiktokResultsSection.classList.add("hidden");
    errorSection.classList.add("hidden");
    resetProgress();

    // Show TikTok pipeline
    document.getElementById("pipeline-ffmpeg").classList.add("hidden");
    document.getElementById("pipeline-ai").classList.add("hidden");
    document.getElementById("pipeline-tiktok").classList.remove("hidden");
    document.getElementById("ai-detail-status").classList.remove("hidden");
    document.getElementById("input-info").classList.add("hidden");

    try {
        const res = await fetch("/tiktok", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                urls: urls,
                mode: selectedMode,
                scale: selectedScale,
                fps_boost: selectedFpsBoost,
            }),
        });
        const data = await res.json();

        if (data.error) {
            showError(data.error);
            return;
        }

        currentJobId = data.job_id;
        startTiktokPolling();
    } catch (err) {
        showError("Erreur: " + err.message);
    }
}

// ---- TikTok Polling ----

function startTiktokPolling() {
    pollInterval = setInterval(pollTiktokStatus, 1000);
}

async function pollTiktokStatus() {
    if (!currentJobId) return;

    try {
        const res = await fetch(`/tiktok/status/${currentJobId}`);
        const data = await res.json();

        // Update progress
        const pct = data.progress || 0;
        progressFill.style.width = pct + "%";
        progressPct.textContent = pct + "%";
        progressStatus.textContent = data.status_message || data.status;

        // Update detail status
        if (data.status_message) {
            document.getElementById("ai-detail-status").textContent = data.status_message;
        }

        // Update TikTok pipeline steps
        const stepOrder = ["downloading", "enhancing", "done"];
        const currentStep = data.status;
        const currentIdx = stepOrder.indexOf(currentStep);
        const pipelineEl = document.getElementById("pipeline-tiktok");
        pipelineEl.querySelectorAll(".step").forEach((el) => {
            const stepName = el.dataset.step;
            const stepIdx = stepOrder.indexOf(stepName);
            el.classList.remove("active", "done");
            if (stepIdx < currentIdx) el.classList.add("done");
            else if (stepIdx === currentIdx) el.classList.add("active");
        });

        if (data.status === "done") {
            stopPolling();
            showTiktokResults(data);
        } else if (data.status === "error") {
            stopPolling();
            showError(data.error || "Erreur inconnue");
        }
    } catch (err) {
        // Network error, keep polling
    }
}

// ---- TikTok Results ----

function showTiktokResults(data) {
    processingSection.classList.add("hidden");
    tiktokResultsSection.classList.remove("hidden");

    const list = document.getElementById("tiktok-results-list");
    list.innerHTML = "";

    const results = data.results || [];
    results.forEach((r, idx) => {
        const card = document.createElement("div");
        card.className = "tiktok-result-card" + (r.status === "done" ? "" : " error");

        if (r.status === "done") {
            const outInfo = r.output_info || {};
            card.innerHTML = `
                <div class="tiktok-result-info">
                    <div class="tiktok-result-title">${escapeHtml(r.title || "Video " + (idx + 1))}</div>
                    <div class="tiktok-result-meta">
                        ${outInfo.resolution || ""} &middot; ${outInfo.size_mb || "?"} MB
                    </div>
                </div>
                <button class="btn btn-primary btn-sm" onclick="downloadTiktok('${currentJobId}', ${idx})">
                    Telecharger
                </button>
            `;
        } else {
            card.innerHTML = `
                <div class="tiktok-result-info">
                    <div class="tiktok-result-title">${escapeHtml(r.title || r.url || "Video " + (idx + 1))}</div>
                    <div class="tiktok-result-error">${escapeHtml(r.error || "Erreur")}</div>
                </div>
                <span class="tiktok-result-badge-error">Echoue</span>
            `;
        }

        list.appendChild(card);
    });

    // Download all button
    document.getElementById("tiktok-download-all-btn").onclick = () => {
        results.forEach((r, idx) => {
            if (r.status === "done") {
                downloadTiktok(currentJobId, idx);
            }
        });
    };

    // New batch button
    document.getElementById("tiktok-new-btn").onclick = () => {
        tiktokResultsSection.classList.add("hidden");
        document.getElementById("source-tabs").classList.remove("hidden");
        document.getElementById("mode-section").classList.remove("hidden");
        tiktokZone.classList.remove("hidden");
        tiktokUrls.value = "";
        countUrls();
        currentJobId = null;
    };
}

function downloadTiktok(jobId, index) {
    window.location.href = `/tiktok/download/${jobId}/${index}`;
}

function escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
}

// ---- Upload handlers ----

uploadZone.addEventListener("click", () => fileInput.click());

uploadZone.addEventListener("dragover", (e) => {
    e.preventDefault();
    uploadZone.classList.add("dragover");
});

uploadZone.addEventListener("dragleave", () => {
    uploadZone.classList.remove("dragover");
});

uploadZone.addEventListener("drop", (e) => {
    e.preventDefault();
    uploadZone.classList.remove("dragover");
    const file = e.dataTransfer.files[0];
    if (file) uploadFile(file);
});

fileInput.addEventListener("change", () => {
    if (fileInput.files[0]) uploadFile(fileInput.files[0]);
});

async function uploadFile(file) {
    if (!file.name.toLowerCase().endsWith(".mp4")) {
        alert("Seuls les fichiers MP4 sont acceptes.");
        return;
    }

    // Show processing section, hide others
    uploadZone.classList.add("hidden");
    tiktokZone.classList.add("hidden");
    document.getElementById("source-tabs").classList.add("hidden");
    document.getElementById("mode-section").classList.add("hidden");
    processingSection.classList.remove("hidden");
    resultsSection.classList.add("hidden");
    tiktokResultsSection.classList.add("hidden");
    errorSection.classList.add("hidden");
    document.getElementById("input-info").classList.remove("hidden");
    resetProgress();

    // Show correct pipeline
    document.getElementById("pipeline-tiktok").classList.add("hidden");
    if (selectedMode === "ai") {
        document.getElementById("pipeline-ffmpeg").classList.add("hidden");
        document.getElementById("pipeline-ai").classList.remove("hidden");
        document.getElementById("ai-detail-status").classList.remove("hidden");
    } else {
        document.getElementById("pipeline-ffmpeg").classList.remove("hidden");
        document.getElementById("pipeline-ai").classList.add("hidden");
        document.getElementById("ai-detail-status").classList.add("hidden");
    }

    // Show/hide FPS step in pipeline
    document.querySelectorAll(".fps-step").forEach(el => {
        if (selectedFpsBoost > 1) el.classList.remove("hidden");
        else el.classList.add("hidden");
    });

    const formData = new FormData();
    formData.append("file", file);
    formData.append("mode", selectedMode);
    formData.append("scale", selectedScale);
    formData.append("fps_boost", selectedFpsBoost);

    try {
        const res = await fetch("/upload", { method: "POST", body: formData });
        const data = await res.json();

        if (data.error) {
            showError(data.error);
            return;
        }

        currentJobId = data.job_id;
        startPolling();
    } catch (err) {
        showError("Erreur lors de l'upload: " + err.message);
    }
}

// ---- Polling ----

function startPolling() {
    pollInterval = setInterval(pollStatus, 1000);
}

function stopPolling() {
    if (pollInterval) {
        clearInterval(pollInterval);
        pollInterval = null;
    }
}

async function pollStatus() {
    if (!currentJobId) return;

    try {
        const res = await fetch(`/status/${currentJobId}`);
        const data = await res.json();

        updateProgress(data);

        if (data.status === "done") {
            stopPolling();
            showResults(data);
        } else if (data.status === "error") {
            stopPolling();
            showError(data.error || "Erreur inconnue");
        }
    } catch (err) {
        // Network error, keep polling
    }
}

// ---- UI Updates ----

function resetProgress() {
    progressFill.style.width = "0%";
    progressPct.textContent = "0%";
    progressStatus.textContent = "Upload...";
    document.querySelectorAll(".step").forEach((s) => {
        s.classList.remove("active", "done");
    });
    document.getElementById("input-info-items").innerHTML = "";
    document.getElementById("ai-detail-status").textContent = "";
}

function updateProgress(data) {
    const pct = data.progress || 0;
    progressFill.style.width = pct + "%";
    progressPct.textContent = pct + "%";

    const mode = data.mode || "ffmpeg";

    if (mode === "ai") {
        const msg = data.status_message || "";
        const statusMap = {
            queued: "En attente...",
            analyzing: "Analyse de la video...",
            ai_processing: msg || "Traitement IA en cours...",
            fps_boost: "Interpolation FPS en cours...",
            done: "Termine !",
        };
        progressStatus.textContent = statusMap[data.status] || msg || data.status;

        if (msg) {
            document.getElementById("ai-detail-status").textContent = msg;
        }

        let activeStep = data.status;
        if (data.status === "ai_processing" && pct < 8) activeStep = "ai_processing";
        else if (data.status === "ai_processing" && pct >= 8 && pct < 87) activeStep = "ai_upscale";
        else if (data.status === "ai_processing" && pct >= 87) activeStep = "ai_reassemble";

        const stepOrder = selectedFpsBoost > 1
            ? ["analyzing", "ai_processing", "ai_upscale", "ai_reassemble", "fps_boost", "done"]
            : ["analyzing", "ai_processing", "ai_upscale", "ai_reassemble", "done"];
        const currentIdx = stepOrder.indexOf(activeStep);

        const pipelineEl = document.getElementById("pipeline-ai");
        pipelineEl.querySelectorAll(".step").forEach((el) => {
            const stepName = el.dataset.step;
            const stepIdx = stepOrder.indexOf(stepName);
            el.classList.remove("active", "done");
            if (stepIdx === -1) return;
            if (stepIdx < currentIdx) el.classList.add("done");
            else if (stepIdx === currentIdx) el.classList.add("active");
        });
    } else {
        const statusMap = {
            queued: "En attente...",
            analyzing: "Analyse de la video...",
            processing: "Amelioration et compression...",
            fps_boost: "Interpolation FPS en cours...",
            done: "Termine !",
        };
        progressStatus.textContent = statusMap[data.status] || data.status;

        const steps = selectedFpsBoost > 1
            ? ["analyzing", "processing", "fps_boost", "done"]
            : ["analyzing", "processing", "done"];
        const currentIdx = steps.indexOf(data.status);
        const pipelineEl = document.getElementById("pipeline-ffmpeg");
        pipelineEl.querySelectorAll(".step").forEach((el) => {
            const stepName = el.dataset.step;
            const stepIdx = steps.indexOf(stepName);
            el.classList.remove("active", "done");
            if (stepIdx === -1) return;
            if (stepIdx < currentIdx) el.classList.add("done");
            else if (stepIdx === currentIdx) el.classList.add("active");
        });
    }

    if (data.input_info) {
        showInputInfo(data.input_info);
    }
}

function showInputInfo(info) {
    const container = document.getElementById("input-info-items");
    if (container.children.length > 0) return;

    const items = [
        { label: "Resolution", value: info.resolution },
        { label: "Duree", value: info.duration_str },
        { label: "Taille", value: info.size_mb + " MB" },
        { label: "Codec", value: info.codec.toUpperCase() },
        { label: "FPS", value: info.fps },
        { label: "Debit", value: Math.round(info.bitrate / 1000) + " kbps" },
    ];

    container.innerHTML = items
        .map(
            (i) => `
        <div class="info-item">
            <div class="label">${i.label}</div>
            <div class="value">${i.value}</div>
        </div>
    `
        )
        .join("");
}

function showResults(data) {
    processingSection.classList.add("hidden");
    resultsSection.classList.remove("hidden");

    const inp = data.input_info;
    const out = data.output_info;

    // Save to history
    saveHistory("video", inp && inp.filename ? inp.filename : "video.mp4", currentJobId, `/download/${currentJobId}`, out ? `${inp.resolution} → ${out.resolution} · ${out.size_mb} MB` : "");

    document.getElementById("before-info").innerHTML = `
        <p class="big">${inp.size_mb} MB</p>
        <p>${inp.resolution} &middot; ${inp.codec.toUpperCase()}</p>
        <p>${Math.round(inp.bitrate / 1000)} kbps &middot; ${inp.fps} fps</p>
    `;

    document.getElementById("after-info").innerHTML = `
        <p class="big green">${out.size_mb} MB</p>
        <p>${out.resolution} &middot; ${out.codec.toUpperCase()}</p>
        <p>${Math.round(out.bitrate / 1000)} kbps &middot; ${out.fps} fps</p>
    `;

    const ratio = data.compression_ratio || 0;
    const saved = (inp.size_mb - out.size_mb).toFixed(1);

    if (ratio > 0) {
        document.getElementById("savings").innerHTML = `
            Reduction de <strong>${ratio}%</strong> &mdash; ${saved} MB economises
        `;
    } else {
        document.getElementById("savings").innerHTML = `
            La video a ete amelioree. Nouvelle taille : <strong>${out.size_mb} MB</strong>
        `;
    }

    document.getElementById("download-btn").onclick = () => {
        window.location.href = `/download/${currentJobId}`;
    };

    document.getElementById("new-btn").onclick = () => {
        resultsSection.classList.add("hidden");
        uploadZone.classList.remove("hidden");
        document.getElementById("source-tabs").classList.remove("hidden");
        document.getElementById("mode-section").classList.remove("hidden");
        fileInput.value = "";
        currentJobId = null;
        // Restore correct source view
        if (selectedSource === "tiktok") {
            uploadZone.classList.add("hidden");
            tiktokZone.classList.remove("hidden");
        }
    };
}

function showError(message) {
    processingSection.classList.add("hidden");
    document.getElementById("captions-processing-section").classList.add("hidden");
    document.getElementById("image-processing-section").classList.add("hidden");
    document.getElementById("scraper-processing-section").classList.add("hidden");
    document.getElementById("analyse-processing-section").classList.add("hidden");
    document.getElementById("tracker-scan-section").classList.add("hidden");
    errorSection.classList.remove("hidden");
    document.getElementById("error-message").textContent = message;

    document.getElementById("retry-btn").onclick = () => {
        errorSection.classList.add("hidden");
        document.getElementById("source-tabs").classList.remove("hidden");
        document.getElementById("image-processing-section").classList.add("hidden");
        document.getElementById("captions-processing-section").classList.add("hidden");
        document.getElementById("scraper-processing-section").classList.add("hidden");
        fileInput.value = "";
        imageFileInput.value = "";
        captionsFileInput.value = "";
        currentJobId = null;
        if (selectedSource === "tiktok") {
            document.getElementById("mode-section").classList.remove("hidden");
            tiktokZone.classList.remove("hidden");
        } else if (selectedSource === "image") {
            document.getElementById("image-zone").classList.remove("hidden");
        } else if (selectedSource === "captions") {
            document.getElementById("captions-zone").classList.remove("hidden");
        } else if (selectedSource === "scraper") {
            document.getElementById("scraper-zone").classList.remove("hidden");
        } else if (selectedSource === "analyse") {
            document.getElementById("analyse-zone").classList.remove("hidden");
        } else {
            document.getElementById("mode-section").classList.remove("hidden");
            uploadZone.classList.remove("hidden");
        }
    };
}

// ---- Shopify Scraper ----

const scraperUrlInput = document.getElementById("scraper-url-input");
const scraperFetchBtn = document.getElementById("scraper-fetch-btn");
let scraperSelectedCollections = new Set();

scraperFetchBtn.addEventListener("click", () => {
    const url = scraperUrlInput.value.trim();
    if (!url) return;
    fetchScraperCollections(url);
});

scraperUrlInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
        e.preventDefault();
        scraperFetchBtn.click();
    }
});

async function fetchScraperCollections(storeUrl) {
    scraperFetchBtn.disabled = true;
    scraperFetchBtn.textContent = "Analyse...";
    document.getElementById("scraper-collections-section").classList.add("hidden");
    document.getElementById("scraper-no-collections").classList.add("hidden");

    try {
        const res = await fetch("/scraper/collections", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ url: storeUrl }),
        });
        const data = await res.json();

        if (data.error) {
            alert("Erreur: " + data.error);
            return;
        }

        const collections = data.collections || [];
        if (collections.length === 0) {
            document.getElementById("scraper-no-collections").classList.remove("hidden");
        } else {
            showScraperCollections(collections);
        }
    } catch (err) {
        alert("Erreur de connexion: " + err.message);
    } finally {
        scraperFetchBtn.disabled = false;
        scraperFetchBtn.textContent = "Analyser";
    }
}

function showScraperCollections(collections) {
    const section = document.getElementById("scraper-collections-section");
    const list = document.getElementById("scraper-collections-list");
    list.innerHTML = "";
    scraperSelectedCollections.clear();

    collections.forEach((c) => {
        const card = document.createElement("div");
        card.className = "scraper-collection-card";
        card.dataset.handle = c.handle;
        card.innerHTML = `
            <div class="scraper-collection-info">
                <div class="scraper-collection-title">${escapeHtml(c.title)}</div>
                <div class="scraper-collection-meta">${c.products_count || "?"} produits</div>
            </div>
            <div class="scraper-collection-check">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polyline points="20 6 9 17 4 12"/>
                </svg>
            </div>
        `;
        card.addEventListener("click", () => {
            card.classList.toggle("selected");
            if (card.classList.contains("selected")) {
                scraperSelectedCollections.add(c.handle);
            } else {
                scraperSelectedCollections.delete(c.handle);
            }
        });
        list.appendChild(card);
    });

    section.classList.remove("hidden");
}

document.getElementById("scraper-select-all-btn").addEventListener("click", () => {
    document.querySelectorAll(".scraper-collection-card").forEach((c) => {
        c.classList.add("selected");
        scraperSelectedCollections.add(c.dataset.handle);
    });
});

document.getElementById("scraper-deselect-all-btn").addEventListener("click", () => {
    document.querySelectorAll(".scraper-collection-card").forEach((c) => {
        c.classList.remove("selected");
    });
    scraperSelectedCollections.clear();
});

document.getElementById("scraper-start-btn").addEventListener("click", () => {
    startScraping(Array.from(scraperSelectedCollections));
});

document.getElementById("scraper-start-all-btn").addEventListener("click", () => {
    startScraping([]);
});

async function startScraping(collections) {
    const storeUrl = scraperUrlInput.value.trim();
    if (!storeUrl) return;

    // Show processing
    document.getElementById("source-tabs").classList.add("hidden");
    document.getElementById("scraper-zone").classList.add("hidden");
    document.getElementById("scraper-processing-section").classList.remove("hidden");
    document.getElementById("scraper-results-section").classList.add("hidden");
    errorSection.classList.add("hidden");

    // Reset
    document.getElementById("scraper-progress-fill").style.width = "0%";
    document.getElementById("scraper-progress-pct").textContent = "0%";
    document.getElementById("scraper-progress-status").textContent = "Connexion...";
    document.getElementById("scraper-detail-status").textContent = "";
    document.querySelectorAll("#scraper-processing-section .step").forEach(s => s.classList.remove("active", "done"));

    try {
        const res = await fetch("/scraper/start", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ url: storeUrl, collections: collections }),
        });
        const data = await res.json();

        if (data.error) {
            showError(data.error);
            return;
        }

        currentJobId = data.job_id;
        startScraperPolling();
    } catch (err) {
        showError("Erreur: " + err.message);
    }
}

function startScraperPolling() {
    pollInterval = setInterval(pollScraperStatus, 1000);
}

async function pollScraperStatus() {
    if (!currentJobId) return;

    try {
        const res = await fetch(`/scraper/status/${currentJobId}`);
        const data = await res.json();

        const pct = data.progress || 0;
        document.getElementById("scraper-progress-fill").style.width = pct + "%";
        document.getElementById("scraper-progress-pct").textContent = pct + "%";
        document.getElementById("scraper-progress-status").textContent = data.status_message || data.status;
        document.getElementById("scraper-detail-status").textContent = data.status_message || "";

        // Update pipeline steps
        const stepMap = { queued: -1, connecting: 0, scraping: 1, generating: 2, done: 3 };
        const currentIdx = stepMap[data.status] !== undefined ? stepMap[data.status] : 1;
        const stepOrder = ["connecting", "scraping", "generating", "done"];
        document.querySelectorAll("#scraper-processing-section .step").forEach((el) => {
            const stepName = el.dataset.step;
            const stepIdx = stepOrder.indexOf(stepName);
            el.classList.remove("active", "done");
            if (stepIdx < currentIdx) el.classList.add("done");
            else if (stepIdx === currentIdx) el.classList.add("active");
        });

        if (data.status === "done") {
            stopPolling();
            showScraperResults(data);
        } else if (data.status === "error") {
            stopPolling();
            showError(data.error || "Erreur inconnue");
        }
    } catch (err) {}
}

function showScraperResults(data) {
    document.getElementById("scraper-processing-section").classList.add("hidden");
    document.getElementById("scraper-results-section").classList.remove("hidden");

    document.getElementById("scraper-products-count").textContent = data.products_count || 0;
    document.getElementById("scraper-rows-count").textContent = data.rows_count || 0;

    saveHistory("scraper", document.getElementById("scraper-url-input").value || "boutique", currentJobId, `/scraper/download/${currentJobId}`, `${data.products_count || 0} produits`);

    document.getElementById("scraper-download-btn").onclick = () => {
        window.location.href = `/scraper/download/${currentJobId}`;
    };

    document.getElementById("scraper-new-btn").onclick = () => {
        document.getElementById("scraper-results-section").classList.add("hidden");
        document.getElementById("source-tabs").classList.remove("hidden");
        document.getElementById("scraper-zone").classList.remove("hidden");
        document.getElementById("scraper-collections-section").classList.add("hidden");
        document.getElementById("scraper-no-collections").classList.add("hidden");
        scraperUrlInput.value = "";
        currentJobId = null;
    };
}

// ---- Shop Analyse ----

const analyseUrlInput = document.getElementById("analyse-url-input");
const analyseFetchBtn = document.getElementById("analyse-fetch-btn");

// Analyse sub-tabs
document.querySelectorAll(".analyse-subtab").forEach((tab) => {
    tab.addEventListener("click", () => {
        document.querySelectorAll(".analyse-subtab").forEach((t) => t.classList.remove("selected"));
        tab.classList.add("selected");
        const sub = tab.dataset.subtab;
        document.getElementById("analyse-quick-section").classList.toggle("hidden", sub !== "quick");
        document.getElementById("analyse-tracking-section").classList.toggle("hidden", sub !== "tracking");
        if (sub === "tracking") loadTrackedStores();
    });
});

analyseFetchBtn.addEventListener("click", () => {
    const url = analyseUrlInput.value.trim();
    if (!url) return;
    startAnalyse(url);
});

analyseUrlInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
        e.preventDefault();
        analyseFetchBtn.click();
    }
});

async function startAnalyse(storeUrl) {
    // Show processing
    document.getElementById("source-tabs").classList.add("hidden");
    document.getElementById("analyse-zone").classList.add("hidden");
    document.getElementById("analyse-processing-section").classList.remove("hidden");
    document.getElementById("analyse-results-section").classList.add("hidden");
    errorSection.classList.add("hidden");

    // Reset
    document.getElementById("analyse-progress-fill").style.width = "0%";
    document.getElementById("analyse-progress-pct").textContent = "0%";
    document.getElementById("analyse-progress-status").textContent = "Connexion...";
    document.getElementById("analyse-detail-status").textContent = "";
    document.querySelectorAll("#analyse-processing-section .step").forEach(s => s.classList.remove("active", "done"));

    try {
        const res = await fetch("/analyse/start", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ url: storeUrl }),
        });
        const data = await res.json();

        if (data.error) {
            showError(data.error);
            return;
        }

        currentJobId = data.job_id;
        startAnalysePolling();
    } catch (err) {
        showError("Erreur: " + err.message);
    }
}

function startAnalysePolling() {
    pollInterval = setInterval(pollAnalyseStatus, 1000);
}

async function pollAnalyseStatus() {
    if (!currentJobId) return;

    try {
        const res = await fetch(`/analyse/status/${currentJobId}`);
        const data = await res.json();

        const pct = data.progress || 0;
        document.getElementById("analyse-progress-fill").style.width = pct + "%";
        document.getElementById("analyse-progress-pct").textContent = pct + "%";
        document.getElementById("analyse-progress-status").textContent = data.status_message || data.status;
        document.getElementById("analyse-detail-status").textContent = data.status_message || "";

        // Update pipeline steps
        const stepMap = { queued: -1, connecting: 0, scraping: 1, analyzing: 2, done: 3 };
        const currentIdx = stepMap[data.status] !== undefined ? stepMap[data.status] : 1;
        const stepOrder = ["connecting", "scraping", "analyzing", "done"];
        document.querySelectorAll("#analyse-processing-section .step").forEach((el) => {
            const stepName = el.dataset.step;
            const stepIdx = stepOrder.indexOf(stepName);
            el.classList.remove("active", "done");
            if (stepIdx < currentIdx) el.classList.add("done");
            else if (stepIdx === currentIdx) el.classList.add("active");
        });

        if (data.status === "done") {
            stopPolling();
            showAnalyseResults(data);
        } else if (data.status === "error") {
            stopPolling();
            showError(data.error || "Erreur inconnue");
        }
    } catch (err) {}
}

function showAnalyseResults(data) {
    document.getElementById("analyse-processing-section").classList.add("hidden");
    document.getElementById("analyse-results-section").classList.remove("hidden");

    document.getElementById("analyse-store-name").textContent = data.store_name || "-";

    saveHistory("analyse", data.store_name || "boutique", currentJobId, null, `${data.total_products || 0} produits analysés`);
    document.getElementById("analyse-total-products").textContent = data.total_products || 0;

    const revenue = parseFloat(data.total_revenue_est || 0);
    document.getElementById("analyse-total-revenue").textContent =
        revenue >= 1000 ? (revenue / 1000).toFixed(1) + "k EUR" : revenue.toFixed(0) + " EUR";

    const list = document.getElementById("analyse-products-list");
    list.innerHTML = "";

    const products = data.products || [];
    products.forEach((p) => {
        const card = document.createElement("div");
        card.className = "analyse-product-card";

        const monthlyRev = parseFloat(p.monthly_revenue_est || 0);
        const revDisplay = monthlyRev >= 1000
            ? (monthlyRev / 1000).toFixed(1) + "k"
            : monthlyRev.toFixed(0);

        card.innerHTML = `
            <div class="analyse-product-rank">#${p.rank}</div>
            <div class="analyse-product-img-wrap">
                ${p.image ? `<img src="${escapeHtml(p.image)}" class="analyse-product-img" alt="" loading="lazy">` : '<div class="analyse-product-img-placeholder"></div>'}
            </div>
            <div class="analyse-product-info">
                <div class="analyse-product-title">${escapeHtml(p.title)}</div>
                <div class="analyse-product-meta">
                    ${escapeHtml(p.price_range)} EUR &middot; ~${p.monthly_sales_est} ventes/mois &middot; <strong>${revDisplay} EUR/mois</strong>
                </div>
                <div class="analyse-product-type">${escapeHtml(p.product_type || p.vendor || "")}</div>
            </div>
            <div class="analyse-product-actions">
                <a href="${escapeHtml(p.product_url)}" target="_blank" class="analyse-link-btn" title="Voir le produit">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                </a>
                <a href="${escapeHtml(p.fb_ads_link)}" target="_blank" class="analyse-link-btn analyse-fb" title="Facebook Ad Library">FB</a>
                <a href="${escapeHtml(p.tiktok_ads_link)}" target="_blank" class="analyse-link-btn analyse-tt" title="TikTok Creative Center">TT</a>
            </div>
        `;

        list.appendChild(card);
    });

    document.getElementById("analyse-new-btn").onclick = () => {
        document.getElementById("analyse-results-section").classList.add("hidden");
        document.getElementById("source-tabs").classList.remove("hidden");
        document.getElementById("analyse-zone").classList.remove("hidden");
        analyseUrlInput.value = "";
        currentJobId = null;
    };
}

// ---- Inventory Tracker ----

const trackerUrlInput = document.getElementById("tracker-url-input");
const trackerAddBtn = document.getElementById("tracker-add-btn");

trackerAddBtn.addEventListener("click", async () => {
    const url = trackerUrlInput.value.trim();
    if (!url) return;

    trackerAddBtn.disabled = true;
    trackerAddBtn.textContent = "Ajout...";

    try {
        const res = await fetch("/tracker/add", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ url }),
        });
        const data = await res.json();
        if (data.error) {
            alert("Erreur: " + data.error);
            return;
        }

        // Trigger first scan
        trackerUrlInput.value = "";
        startTrackerScan(data.store_id);
    } catch (err) {
        alert("Erreur: " + err.message);
    } finally {
        trackerAddBtn.disabled = false;
        trackerAddBtn.textContent = "Ajouter";
    }
});

trackerUrlInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") { e.preventDefault(); trackerAddBtn.click(); }
});

async function loadTrackedStores() {
    const list = document.getElementById("tracker-stores-list");
    list.innerHTML = '<div style="text-align:center; color:#52525b; padding:20px;">Chargement...</div>';

    try {
        const res = await fetch("/tracker/stores");
        const data = await res.json();
        const stores = data.stores || [];

        if (stores.length === 0) {
            list.innerHTML = '<div style="text-align:center; color:#52525b; padding:20px;">Aucune boutique trackee. Ajoutez-en une ci-dessus.</div>';
            return;
        }

        list.innerHTML = "";
        stores.forEach((s) => {
            const card = document.createElement("div");
            card.className = "tracker-store-card";

            const lastScan = s.last_scan_at
                ? new Date(s.last_scan_at + "Z").toLocaleString("fr-FR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })
                : "Jamais";

            card.innerHTML = `
                <div class="tracker-store-info">
                    <div class="tracker-store-domain">${escapeHtml(s.domain)}</div>
                    <div class="tracker-store-meta">Dernier scan: ${lastScan}</div>
                </div>
                <div class="tracker-store-actions">
                    <button class="btn btn-primary btn-sm" onclick="viewTrackerData('${s.id}', '${escapeHtml(s.domain)}')">Voir</button>
                    <button class="btn btn-secondary btn-sm" onclick="startTrackerScan('${s.id}')">Re-scan</button>
                    <button class="tracker-remove-btn" onclick="removeTrackerStore('${s.id}')" title="Supprimer">&times;</button>
                </div>
            `;
            list.appendChild(card);
        });
    } catch (err) {
        list.innerHTML = `<div style="text-align:center; color:#f87171; padding:20px;">Erreur: ${err.message}</div>`;
    }
}

function startTrackerScan(storeId) {
    // Show scan processing
    document.getElementById("source-tabs").classList.add("hidden");
    document.getElementById("analyse-zone").classList.add("hidden");
    document.getElementById("tracker-scan-section").classList.remove("hidden");
    document.getElementById("tracker-data-section").classList.add("hidden");
    errorSection.classList.add("hidden");

    document.getElementById("tracker-progress-fill").style.width = "0%";
    document.getElementById("tracker-progress-pct").textContent = "0%";
    document.getElementById("tracker-progress-status").textContent = "Demarrage du scan...";
    document.getElementById("tracker-detail-status").textContent = "";
    document.querySelectorAll("#tracker-scan-section .step").forEach(s => s.classList.remove("active", "done"));
    document.querySelector('#tracker-scan-section .step[data-step="scanning"]').classList.add("active");

    fetch(`/tracker/scan/${storeId}`, { method: "POST" })
        .then(r => r.json())
        .then(data => {
            if (data.error) { showError(data.error); return; }
            currentJobId = data.job_id;
            window._trackerStoreId = storeId;
            pollInterval = setInterval(pollTrackerScan, 1000);
        })
        .catch(err => showError("Erreur: " + err.message));
}

async function pollTrackerScan() {
    if (!currentJobId) return;
    try {
        const res = await fetch(`/tracker/scan/status/${currentJobId}`);
        const data = await res.json();

        const pct = data.progress || 0;
        document.getElementById("tracker-progress-fill").style.width = pct + "%";
        document.getElementById("tracker-progress-pct").textContent = pct + "%";
        document.getElementById("tracker-progress-status").textContent = data.status_message || data.status;
        document.getElementById("tracker-detail-status").textContent = data.status_message || "";

        if (data.status === "done") {
            stopPolling();
            document.querySelectorAll("#tracker-scan-section .step").forEach(s => s.classList.add("done"));
            // Show results
            viewTrackerData(window._trackerStoreId);
        } else if (data.status === "error") {
            stopPolling();
            showError(data.error || "Erreur de scan");
        }
    } catch (err) {}
}

async function viewTrackerData(storeId, domainLabel) {
    document.getElementById("source-tabs").classList.add("hidden");
    document.getElementById("analyse-zone").classList.add("hidden");
    document.getElementById("tracker-scan-section").classList.add("hidden");
    document.getElementById("tracker-data-section").classList.remove("hidden");
    errorSection.classList.add("hidden");

    document.getElementById("tracker-products-list").innerHTML = '<div style="text-align:center;color:#52525b;padding:20px;">Chargement...</div>';

    try {
        const res = await fetch(`/tracker/data/${storeId}?days=30`);
        const data = await res.json();

        if (data.error) { showError(data.error); return; }

        const store = data.store || {};
        document.getElementById("tracker-store-name").textContent = store.domain || domainLabel || "-";
        document.getElementById("tracker-scan-count").textContent = data.scan_count || 0;
        document.getElementById("tracker-period").textContent = data.delta_days
            ? data.delta_days + " jours"
            : "1er scan";

        const totalRev = parseFloat(data.total_monthly_revenue_est || 0);
        document.getElementById("tracker-total-revenue").textContent =
            totalRev >= 1000 ? (totalRev / 1000).toFixed(1) + "k EUR" : totalRev.toFixed(0) + " EUR";

        // Show notice if single scan
        document.getElementById("tracker-single-scan-notice").classList.toggle("hidden", !data.is_single_scan);

        const list = document.getElementById("tracker-products-list");
        list.innerHTML = "";

        const products = data.products || [];
        if (products.length === 0 && data.is_single_scan) {
            list.innerHTML = '<div style="text-align:center;color:#71717a;padding:20px;">Les donnees de ventes apparaitront apres le 2e scan (dans ~24h).</div>';
        }

        products.forEach((p) => {
            const card = document.createElement("div");
            card.className = "analyse-product-card";

            const monthlyRev = parseFloat(p.monthly_revenue_est || 0);
            const revDisplay = monthlyRev >= 1000 ? (monthlyRev / 1000).toFixed(1) + "k" : monthlyRev.toFixed(0);
            const stockInfo = p.current_stock !== undefined ? ` &middot; Stock: ${p.current_stock}` : "";

            card.innerHTML = `
                <div class="analyse-product-rank">#${p.rank}</div>
                <div class="analyse-product-img-wrap">
                    ${p.image ? `<img src="${escapeHtml(p.image)}" class="analyse-product-img" alt="" loading="lazy">` : '<div class="analyse-product-img-placeholder"></div>'}
                </div>
                <div class="analyse-product-info">
                    <div class="analyse-product-title">${escapeHtml(p.title)}</div>
                    <div class="analyse-product-meta">
                        ${p.price ? p.price + " EUR" : ""} &middot;
                        <strong>${p.total_sold} vendus</strong> (${p.daily_sales}/j) &middot;
                        <strong class="tracker-rev">${revDisplay} EUR/mois</strong>${stockInfo}
                    </div>
                    <div class="analyse-product-type">${escapeHtml(p.product_type || p.vendor || "")}</div>
                </div>
                <div class="analyse-product-actions">
                    <a href="${escapeHtml(p.product_url)}" target="_blank" class="analyse-link-btn" title="Voir le produit">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                    </a>
                    <a href="${escapeHtml(p.fb_ads_link)}" target="_blank" class="analyse-link-btn analyse-fb" title="Facebook Ad Library">FB</a>
                    <a href="${escapeHtml(p.tiktok_ads_link)}" target="_blank" class="analyse-link-btn analyse-tt" title="TikTok Creative Center">TT</a>
                </div>
            `;
            list.appendChild(card);
        });

        document.getElementById("tracker-back-btn").onclick = () => {
            document.getElementById("tracker-data-section").classList.add("hidden");
            document.getElementById("source-tabs").classList.remove("hidden");
            document.getElementById("analyse-zone").classList.remove("hidden");
            // Switch to tracking subtab
            document.querySelectorAll(".analyse-subtab").forEach(t => t.classList.remove("selected"));
            document.querySelector('.analyse-subtab[data-subtab="tracking"]').classList.add("selected");
            document.getElementById("analyse-quick-section").classList.add("hidden");
            document.getElementById("analyse-tracking-section").classList.remove("hidden");
            loadTrackedStores();
        };
    } catch (err) {
        showError("Erreur: " + err.message);
    }
}

async function removeTrackerStore(storeId) {
    if (!confirm("Supprimer cette boutique du tracking ?")) return;
    try {
        await fetch(`/tracker/remove/${storeId}`, { method: "POST" });
        loadTrackedStores();
    } catch (err) {
        alert("Erreur: " + err.message);
    }
}

// ===================== EXCEL EXPORT =====================

document.getElementById("scraper-download-excel-btn") && document.getElementById("scraper-download-excel-btn").addEventListener("click", () => {
    if (currentJobId) window.location.href = `/scraper/download/${currentJobId}/excel`;
});

// ===================== BROWSER NOTIFICATIONS =====================

function requestNotificationPermission() {
    if ("Notification" in window && Notification.permission === "default") {
        Notification.requestPermission();
    }
}
requestNotificationPermission();

function showToast(title, message) {
    const toast = document.createElement("div");
    toast.className = "toast";
    toast.innerHTML = `
        <div class="toast-icon">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="20 6 9 17 4 12"/>
            </svg>
        </div>
        <div class="toast-text"><strong>${escapeHtml(title)}</strong>${escapeHtml(message)}</div>
    `;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 4000);
}

function notifyDone(title, message) {
    showToast(title, message);
    if ("Notification" in window && Notification.permission === "granted") {
        new Notification(title, { body: message, icon: "/static/favicon.ico" });
    }
}

// Hook notifications into existing result functions
const _origShowResults = showResults;
// We patch via the saveHistory calls instead (already done above)

// ===================== DOWNLOADER MULTI-PLATEFORMES =====================

const downloaderUrls = document.getElementById("downloader-urls");
const downloaderUrlCount = document.getElementById("downloader-url-count");
const downloaderStartBtn = document.getElementById("downloader-start-btn");

function countDownloaderUrls() {
    const text = (downloaderUrls && downloaderUrls.value.trim()) || "";
    if (!text) {
        if (downloaderUrlCount) downloaderUrlCount.textContent = "0 URL(s) détectée(s)";
        if (downloaderStartBtn) downloaderStartBtn.disabled = true;
        return;
    }
    const urls = text.split(/[\n,]+/).map(u => u.trim()).filter(u => u.length > 4);
    if (downloaderUrlCount) downloaderUrlCount.textContent = `${urls.length} URL(s) détectée(s)`;
    if (downloaderStartBtn) downloaderStartBtn.disabled = urls.length === 0;
}

if (downloaderUrls) downloaderUrls.addEventListener("input", countDownloaderUrls);

if (downloaderStartBtn) downloaderStartBtn.addEventListener("click", () => {
    const text = downloaderUrls.value.trim();
    if (!text) return;
    const urls = text.split(/[\n,]+/).map(u => u.trim()).filter(u => u.length > 4);
    startDownloaderJob(urls);
});

async function startDownloaderJob(urls) {
    document.getElementById("downloader-zone").classList.add("hidden");
    document.getElementById("downloader-processing-section").classList.remove("hidden");
    document.getElementById("downloader-results-section").classList.add("hidden");

    document.getElementById("downloader-progress-fill").style.width = "0%";
    document.getElementById("downloader-progress-pct").textContent = "0%";
    document.getElementById("downloader-progress-status").textContent = "Démarrage...";
    document.getElementById("downloader-detail-status").textContent = "";

    try {
        const res = await fetch("/platform", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ urls }),
        });
        const data = await res.json();
        if (data.error) { showDownloaderError(data.error); return; }
        currentJobId = data.job_id;
        pollInterval = setInterval(pollDownloaderStatus, 1000);
    } catch (err) {
        showDownloaderError(err.message);
    }
}

async function pollDownloaderStatus() {
    if (!currentJobId) return;
    try {
        const res = await fetch(`/platform/status/${currentJobId}`);
        const data = await res.json();
        const pct = data.progress || 0;
        document.getElementById("downloader-progress-fill").style.width = pct + "%";
        document.getElementById("downloader-progress-pct").textContent = pct + "%";
        document.getElementById("downloader-progress-status").textContent = data.status_message || "";
        document.getElementById("downloader-detail-status").textContent = data.status_message || "";

        if (data.status === "done") {
            stopPolling();
            showDownloaderResults(data);
            notifyDone("Téléchargement terminé !", `${data.results.filter(r => r.status === "done").length} vidéo(s) téléchargée(s)`);
        } else if (data.status === "error") {
            stopPolling();
            showDownloaderError(data.error || "Erreur inconnue");
        }
    } catch (err) {}
}

function showDownloaderResults(data) {
    document.getElementById("downloader-processing-section").classList.add("hidden");
    document.getElementById("downloader-results-section").classList.remove("hidden");

    const list = document.getElementById("downloader-results-list");
    const results = data.results || [];
    list.innerHTML = results.map((r, idx) => {
        if (r.status === "done") {
            return `<div class="tiktok-result-card">
                <div class="tiktok-result-info">
                    <div class="tiktok-result-title">${escapeHtml(r.title || r.url)}</div>
                    <div class="tiktok-result-meta">${escapeHtml(r.platform)} &middot; ${r.size_mb} MB</div>
                </div>
                <a href="/platform/download/${currentJobId}/${idx}" class="btn btn-primary btn-sm">Télécharger</a>
            </div>`;
        } else {
            return `<div class="tiktok-result-card error">
                <div class="tiktok-result-info">
                    <div class="tiktok-result-title">${escapeHtml(r.url)}</div>
                    <div class="tiktok-result-error">${escapeHtml(r.error || "Erreur")}</div>
                </div>
                <span class="tiktok-result-badge-error">Échoué</span>
            </div>`;
        }
    }).join("");

    results.filter(r => r.status === "done").forEach(r => {
        saveHistory("tiktok", r.title || r.url, currentJobId, null, `${r.platform} · ${r.size_mb} MB`);
    });

    document.getElementById("downloader-new-btn").onclick = () => {
        document.getElementById("downloader-results-section").classList.add("hidden");
        document.getElementById("downloader-zone").classList.remove("hidden");
        downloaderUrls.value = "";
        countDownloaderUrls();
        currentJobId = null;
    };
}

function showDownloaderError(msg) {
    document.getElementById("downloader-processing-section").classList.add("hidden");
    document.getElementById("downloader-zone").classList.remove("hidden");
    alert("Erreur : " + msg);
}

// ===================== AUDIO EXTRACTION =====================

let selectedAudioFmt = "mp3";

document.querySelectorAll(".audio-fmt-btn").forEach(btn => {
    btn.addEventListener("click", () => {
        document.querySelectorAll(".audio-fmt-btn").forEach(b => b.classList.remove("selected"));
        btn.classList.add("selected");
        selectedAudioFmt = btn.dataset.fmt;
    });
});

const audioUploadZone = document.getElementById("audio-upload-zone");
const audioFileInput = document.getElementById("audio-file-input");

if (audioUploadZone) {
    audioUploadZone.addEventListener("click", () => audioFileInput.click());
    audioUploadZone.addEventListener("dragover", e => { e.preventDefault(); audioUploadZone.classList.add("dragover"); });
    audioUploadZone.addEventListener("dragleave", () => audioUploadZone.classList.remove("dragover"));
    audioUploadZone.addEventListener("drop", e => {
        e.preventDefault(); audioUploadZone.classList.remove("dragover");
        if (e.dataTransfer.files[0]) uploadAudio(e.dataTransfer.files[0]);
    });
}
if (audioFileInput) audioFileInput.addEventListener("change", () => { if (audioFileInput.files[0]) uploadAudio(audioFileInput.files[0]); });

async function uploadAudio(file) {
    document.getElementById("audio-zone").classList.add("hidden");
    document.getElementById("audio-processing-section").classList.remove("hidden");
    document.getElementById("audio-results-section").classList.add("hidden");
    document.getElementById("audio-progress-fill").style.width = "0%";
    document.getElementById("audio-progress-pct").textContent = "0%";
    document.getElementById("audio-progress-status").textContent = "Upload...";

    const formData = new FormData();
    formData.append("file", file);
    formData.append("format", selectedAudioFmt);

    try {
        const res = await fetch("/audio/upload", { method: "POST", body: formData });
        const data = await res.json();
        if (data.error) { alert("Erreur : " + data.error); document.getElementById("audio-zone").classList.remove("hidden"); document.getElementById("audio-processing-section").classList.add("hidden"); return; }
        currentJobId = data.job_id;
        pollInterval = setInterval(pollAudioStatus, 1000);
    } catch (err) { alert("Erreur : " + err.message); }
}

async function pollAudioStatus() {
    if (!currentJobId) return;
    try {
        const res = await fetch(`/audio/status/${currentJobId}`);
        const data = await res.json();
        const pct = data.progress || 0;
        document.getElementById("audio-progress-fill").style.width = pct + "%";
        document.getElementById("audio-progress-pct").textContent = pct + "%";
        document.getElementById("audio-progress-status").textContent = data.status_message || "";
        if (data.status === "done") {
            stopPolling();
            document.getElementById("audio-processing-section").classList.add("hidden");
            document.getElementById("audio-results-section").classList.remove("hidden");
            document.getElementById("audio-result-format").textContent = selectedAudioFmt.toUpperCase();
            document.getElementById("audio-result-size").textContent = (data.size_mb || 0) + " MB";
            document.getElementById("audio-download-btn").onclick = () => { window.location.href = `/audio/download/${currentJobId}`; };
            document.getElementById("audio-new-btn").onclick = () => {
                document.getElementById("audio-results-section").classList.add("hidden");
                document.getElementById("audio-zone").classList.remove("hidden");
                currentJobId = null;
            };
            saveHistory("audio", data.filename || "audio", currentJobId, `/audio/download/${currentJobId}`, `${selectedAudioFmt.toUpperCase()} · ${data.size_mb} MB`);
            notifyDone("Audio extrait !", `${data.filename || "audio"} · ${data.size_mb} MB`);
        } else if (data.status === "error") {
            stopPolling();
            alert("Erreur : " + (data.error || "Inconnue"));
            document.getElementById("audio-processing-section").classList.add("hidden");
            document.getElementById("audio-zone").classList.remove("hidden");
        }
    } catch (err) {}
}

// ===================== VIDEO TRIM =====================

const trimUploadZone = document.getElementById("trim-upload-zone");
const trimFileInput = document.getElementById("trim-file-input");
let trimFilepath = null;
let trimDuration = 0;

if (trimUploadZone) {
    trimUploadZone.addEventListener("click", () => trimFileInput.click());
    trimUploadZone.addEventListener("dragover", e => { e.preventDefault(); trimUploadZone.classList.add("dragover"); });
    trimUploadZone.addEventListener("dragleave", () => trimUploadZone.classList.remove("dragover"));
    trimUploadZone.addEventListener("drop", e => {
        e.preventDefault(); trimUploadZone.classList.remove("dragover");
        if (e.dataTransfer.files[0]) uploadTrimVideo(e.dataTransfer.files[0]);
    });
}
if (trimFileInput) trimFileInput.addEventListener("change", () => { if (trimFileInput.files[0]) uploadTrimVideo(trimFileInput.files[0]); });

async function uploadTrimVideo(file) {
    trimUploadZone.classList.add("hidden");
    const formData = new FormData();
    formData.append("file", file);
    try {
        const res = await fetch("/trim/upload", { method: "POST", body: formData });
        const data = await res.json();
        if (data.error) { alert("Erreur : " + data.error); trimUploadZone.classList.remove("hidden"); return; }
        trimFilepath = data.filepath;
        trimDuration = data.duration;
        showTrimControls(trimDuration);
    } catch (err) { alert("Erreur : " + err.message); trimUploadZone.classList.remove("hidden"); }
}

function showTrimControls(duration) {
    const controls = document.getElementById("trim-controls");
    controls.classList.remove("hidden");

    const startInput = document.getElementById("trim-start");
    const endInput = document.getElementById("trim-end");
    const rangeStart = document.getElementById("trim-range-start");
    const rangeEnd = document.getElementById("trim-range-end");
    const totalDur = document.getElementById("trim-total-duration");

    endInput.value = duration.toFixed(1);
    endInput.max = duration;
    startInput.max = duration;
    rangeStart.max = duration;
    rangeEnd.max = duration;
    rangeEnd.value = duration;
    totalDur.textContent = formatSeconds(duration);

    rangeStart.addEventListener("input", () => { startInput.value = parseFloat(rangeStart.value).toFixed(1); });
    rangeEnd.addEventListener("input", () => { endInput.value = parseFloat(rangeEnd.value).toFixed(1); });
    startInput.addEventListener("input", () => { rangeStart.value = startInput.value; });
    endInput.addEventListener("input", () => { rangeEnd.value = endInput.value; });
}

function formatSeconds(s) {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, "0")}`;
}

const trimStartBtn = document.getElementById("trim-start-btn");
if (trimStartBtn) trimStartBtn.addEventListener("click", async () => {
    const start = parseFloat(document.getElementById("trim-start").value) || 0;
    const end = parseFloat(document.getElementById("trim-end").value) || 0;
    if (end <= start) { alert("La fin doit être après le début."); return; }

    document.getElementById("trim-controls").classList.add("hidden");
    document.getElementById("trim-processing-section").classList.remove("hidden");
    document.getElementById("trim-progress-fill").style.width = "20%";
    document.getElementById("trim-progress-pct").textContent = "20%";
    document.getElementById("trim-progress-status").textContent = "Découpe en cours...";

    try {
        const res = await fetch("/trim/start", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ filepath: trimFilepath, start, end }),
        });
        const data = await res.json();
        if (data.error) { alert("Erreur : " + data.error); return; }
        currentJobId = data.job_id;
        pollInterval = setInterval(pollTrimStatus, 1000);
    } catch (err) { alert("Erreur : " + err.message); }
});

async function pollTrimStatus() {
    if (!currentJobId) return;
    try {
        const res = await fetch(`/trim/status/${currentJobId}`);
        const data = await res.json();
        const pct = data.progress || 0;
        document.getElementById("trim-progress-fill").style.width = pct + "%";
        document.getElementById("trim-progress-pct").textContent = pct + "%";
        document.getElementById("trim-progress-status").textContent = data.status_message || "";
        if (data.status === "done") {
            stopPolling();
            document.getElementById("trim-processing-section").classList.add("hidden");
            document.getElementById("trim-results-section").classList.remove("hidden");
            document.getElementById("trim-result-size").textContent = (data.size_mb || 0) + " MB";
            document.getElementById("trim-download-btn").onclick = () => { window.location.href = `/trim/download/${currentJobId}`; };
            document.getElementById("trim-new-btn").onclick = () => {
                document.getElementById("trim-results-section").classList.add("hidden");
                document.getElementById("trim-upload-zone").classList.remove("hidden");
                document.getElementById("trim-controls").classList.add("hidden");
                trimFileInput.value = "";
                trimFilepath = null;
                currentJobId = null;
            };
            saveHistory("video", "trimmed_video.mp4", currentJobId, `/trim/download/${currentJobId}`, `${data.size_mb} MB`);
            notifyDone("Découpe terminée !", `${data.size_mb} MB`);
        } else if (data.status === "error") {
            stopPolling();
            alert("Erreur : " + (data.error || "Inconnue"));
            document.getElementById("trim-processing-section").classList.add("hidden");
        }
    } catch (err) {}
}

// ===================== BG REMOVE =====================

const bgremoveUploadZone = document.getElementById("bgremove-upload-zone");
const bgremoveFileInput = document.getElementById("bgremove-file-input");
let bgremoveOriginalSrc = null;

if (bgremoveUploadZone) {
    bgremoveUploadZone.addEventListener("click", () => bgremoveFileInput.click());
    bgremoveUploadZone.addEventListener("dragover", e => { e.preventDefault(); bgremoveUploadZone.classList.add("dragover"); });
    bgremoveUploadZone.addEventListener("dragleave", () => bgremoveUploadZone.classList.remove("dragover"));
    bgremoveUploadZone.addEventListener("drop", e => {
        e.preventDefault(); bgremoveUploadZone.classList.remove("dragover");
        if (e.dataTransfer.files[0]) uploadBgRemove(e.dataTransfer.files[0]);
    });
}
if (bgremoveFileInput) bgremoveFileInput.addEventListener("change", () => { if (bgremoveFileInput.files[0]) uploadBgRemove(bgremoveFileInput.files[0]); });

async function uploadBgRemove(file) {
    bgremoveOriginalSrc = URL.createObjectURL(file);
    document.getElementById("bgremove-zone").classList.add("hidden");
    document.getElementById("bgremove-processing-section").classList.remove("hidden");
    document.getElementById("bgremove-results-section").classList.add("hidden");
    document.getElementById("bgremove-progress-fill").style.width = "0%";
    document.getElementById("bgremove-progress-pct").textContent = "0%";
    document.getElementById("bgremove-progress-status").textContent = "Chargement du modèle...";
    document.getElementById("bgremove-detail-status").textContent = "";

    const formData = new FormData();
    formData.append("file", file);
    try {
        const res = await fetch("/bgremove/upload", { method: "POST", body: formData });
        const data = await res.json();
        if (data.error) { alert("Erreur : " + data.error); document.getElementById("bgremove-zone").classList.remove("hidden"); document.getElementById("bgremove-processing-section").classList.add("hidden"); return; }
        currentJobId = data.job_id;
        pollInterval = setInterval(pollBgRemoveStatus, 1000);
    } catch (err) { alert("Erreur : " + err.message); }
}

async function pollBgRemoveStatus() {
    if (!currentJobId) return;
    try {
        const res = await fetch(`/bgremove/status/${currentJobId}`);
        const data = await res.json();
        const pct = data.progress || 0;
        document.getElementById("bgremove-progress-fill").style.width = pct + "%";
        document.getElementById("bgremove-progress-pct").textContent = pct + "%";
        document.getElementById("bgremove-progress-status").textContent = data.status_message || "";
        document.getElementById("bgremove-detail-status").textContent = data.status_message || "";

        const steps = document.querySelectorAll("#bgremove-processing-section .step");
        steps.forEach(s => s.classList.remove("active", "done"));
        if (pct > 50) { steps[0].classList.add("done"); steps[1] && steps[1].classList.add("active"); }
        else { steps[0].classList.add("active"); }

        if (data.status === "done") {
            stopPolling();
            document.getElementById("bgremove-processing-section").classList.add("hidden");
            document.getElementById("bgremove-results-section").classList.remove("hidden");
            document.getElementById("bgremove-before").src = bgremoveOriginalSrc;
            document.getElementById("bgremove-after").src = `/bgremove/download/${currentJobId}`;
            document.getElementById("bgremove-result-size").textContent = (data.size_kb || 0) + " KB";
            document.getElementById("bgremove-download-btn").onclick = () => { window.location.href = `/bgremove/download/${currentJobId}`; };
            document.getElementById("bgremove-new-btn").onclick = () => {
                document.getElementById("bgremove-results-section").classList.add("hidden");
                document.getElementById("bgremove-zone").classList.remove("hidden");
                bgremoveFileInput.value = ""; bgremoveOriginalSrc = null; currentJobId = null;
            };
            saveHistory("image", "image_sans_fond.png", currentJobId, `/bgremove/download/${currentJobId}`, `${data.size_kb} KB (PNG transparent)`);
            notifyDone("Fond supprimé !", `PNG transparent · ${data.size_kb} KB`);
        } else if (data.status === "error") {
            stopPolling();
            alert("Erreur : " + (data.error || "Inconnue"));
            document.getElementById("bgremove-processing-section").classList.add("hidden");
            document.getElementById("bgremove-zone").classList.remove("hidden");
        }
    } catch (err) {}
}

// ===================== VOICEOVER =====================

(function initVoiceover() {
    // Char counter
    const voText = document.getElementById("vo-text");
    const voCharCount = document.getElementById("vo-char-count");
    if (voText) {
        voText.addEventListener("input", () => {
            const len = voText.value.length;
            voCharCount.textContent = `${len} / 5000`;
            voCharCount.classList.toggle("warn", len > 4500);
        });
    }

    // Sliders
    const voRate = document.getElementById("vo-rate");
    const voPitch = document.getElementById("vo-pitch");
    if (voRate) {
        voRate.addEventListener("input", () => {
            const v = parseInt(voRate.value);
            document.getElementById("vo-rate-val").textContent =
                v === 0 ? "Normal" : v > 0 ? `+${v}% rapide` : `${v}% lent`;
        });
    }
    if (voPitch) {
        voPitch.addEventListener("input", () => {
            const v = parseInt(voPitch.value);
            document.getElementById("vo-pitch-val").textContent =
                v === 0 ? "Normal" : v > 0 ? `+${v}Hz aigu` : `${v}Hz grave`;
        });
    }

    // Other voices selector → deselect radio + use this value
    const voiceOther = document.getElementById("vo-voice-other");
    if (voiceOther) {
        voiceOther.addEventListener("change", () => {
            if (voiceOther.value) {
                document.querySelectorAll('input[name="vo-voice-radio"]').forEach(r => r.checked = false);
            }
        });
    }
    // Radio click → reset other select
    document.querySelectorAll('input[name="vo-voice-radio"]').forEach(r => {
        r.addEventListener("change", () => { if (voiceOther) voiceOther.value = ""; });
    });

    // AI Script generator
    const aiBtn = document.getElementById("vo-ai-btn");
    if (aiBtn) {
        aiBtn.addEventListener("click", async () => {
            const prompt = document.getElementById("vo-prompt").value.trim();
            if (!prompt) { alert("Décrivez votre script d'abord."); return; }
            const tone = document.getElementById("vo-script-tone").value;
            const duration = document.getElementById("vo-script-duration").value;
            const language = document.getElementById("vo-script-lang").value;
            const statusEl = document.getElementById("vo-ai-status");

            aiBtn.disabled = true;
            aiBtn.textContent = "Génération...";
            statusEl.classList.remove("hidden");
            statusEl.textContent = "✦ Claude rédige votre script...";

            try {
                const res = await fetch("/voiceover/script", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ prompt, tone, duration, language }),
                });
                const json = await res.json();
                if (json.error) throw new Error(json.error);
                if (voText) {
                    voText.value = json.script;
                    voText.dispatchEvent(new Event("input"));
                }
                statusEl.textContent = `✓ Script généré — ${json.word_count || "?"} mots`;
                setTimeout(() => statusEl.classList.add("hidden"), 3000);
            } catch (e) {
                statusEl.textContent = "Erreur : " + e.message;
                setTimeout(() => statusEl.classList.add("hidden"), 5000);
            } finally {
                aiBtn.disabled = false;
                aiBtn.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg> Générer le script`;
            }
        });
    }

    // Generate TTS
    const voBtn = document.getElementById("vo-generate-btn");
    if (!voBtn) return;
    voBtn.addEventListener("click", async () => {
        const text = voText ? voText.value.trim() : "";
        if (!text) { alert("Entrez un texte à lire."); return; }

        // Get selected voice: radio or other select
        const checkedRadio = document.querySelector('input[name="vo-voice-radio"]:checked');
        const otherSelect = document.getElementById("vo-voice-other");
        const voice = (checkedRadio && checkedRadio.value) ||
                      (otherSelect && otherSelect.value) ||
                      "fr-FR-DeniseNeural";

        const rate = parseInt(document.getElementById("vo-rate").value);
        const pitch = parseInt(document.getElementById("vo-pitch").value);

        voBtn.disabled = true;
        voBtn.textContent = "Génération...";
        document.getElementById("vo-processing").classList.remove("hidden");
        document.getElementById("vo-result").classList.add("hidden");
        document.getElementById("vo-progress-fill").style.width = "10%";
        document.getElementById("vo-status").textContent = "Envoi au service TTS...";
        document.getElementById("vo-pct").textContent = "10%";

        // Get voice display name for result
        const checkedLabel = checkedRadio ? checkedRadio.closest(".vo-voice-card").querySelector(".vo-vc-name").textContent : voice;

        try {
            const res = await fetch("/voiceover/generate", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ text, voice, rate, pitch }),
            });
            const json = await res.json();
            if (json.error) throw new Error(json.error);
            _pollVoiceover(json.job_id, checkedLabel || voice);
        } catch (e) {
            voBtn.disabled = false;
            voBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/></svg> Générer la voix off`;
            document.getElementById("vo-processing").classList.add("hidden");
            alert("Erreur : " + e.message);
        }
    });
})();

function _pollVoiceover(jobId, voiceName) {
    const voBtn = document.getElementById("vo-generate-btn");
    const iv = setInterval(async () => {
        try {
            const res = await fetch(`/voiceover/status/${jobId}`);
            const data = await res.json();
            const p = data.progress || 0;
            document.getElementById("vo-progress-fill").style.width = Math.max(10, p) + "%";
            document.getElementById("vo-pct").textContent = p + "%";
            document.getElementById("vo-status").textContent = data.status_message || data.status;

            if (data.status === "done") {
                clearInterval(iv);
                voBtn.disabled = false;
                voBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/></svg> Générer la voix off`;
                document.getElementById("vo-processing").classList.add("hidden");
                document.getElementById("vo-result").classList.remove("hidden");
                // Set audio player
                const player = document.getElementById("vo-player");
                player.src = `/voiceover/download/${jobId}?t=${Date.now()}`;
                document.getElementById("vo-result-voice").textContent = voiceName;
                document.getElementById("vo-result-size").textContent = (data.output_size_kb || 0) + " KB";
                // Download button
                document.getElementById("vo-download-btn").onclick = () => {
                    window.location.href = `/voiceover/download/${jobId}`;
                };
                showToast("Voix off générée !", "Prête à écouter et télécharger.");
            } else if (data.status === "error") {
                clearInterval(iv);
                voBtn.disabled = false;
                voBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/></svg> Générer la voix off`;
                document.getElementById("vo-processing").classList.add("hidden");
                alert("Erreur TTS : " + (data.error || "inconnue"));
            }
        } catch (_) {}
    }, 800);
}

// "Nouvelle voix off" reset
document.getElementById("vo-new-btn") && document.getElementById("vo-new-btn").addEventListener("click", () => {
    document.getElementById("vo-result").classList.add("hidden");
    document.getElementById("vo-text").value = "";
    document.getElementById("vo-char-count").textContent = "0";
});

// ===================== EDITOR: add/delete + animation/maxwords =====================

// Show/hide highlight color row based on animation
document.addEventListener("change", (e) => {
    if (e.target.id === "ce-animation") {
        const anim = e.target.value;
        const row = document.getElementById("ce-highlight-row");
        if (row) row.style.display = (anim === "word_highlight" || anim === "word_highlight_pop") ? "flex" : "none";
    }
    if (e.target.id === "ce-bg-opacity") {
        const v = e.target.value;
        const el = document.getElementById("ce-bg-val");
        if (el) el.textContent = v + "%";
    }
});
document.addEventListener("input", (e) => {
    if (e.target.id === "ce-bg-opacity") {
        const el = document.getElementById("ce-bg-val");
        if (el) el.textContent = e.target.value + "%";
    }
});

// Add segment button
document.addEventListener("click", (e) => {
    if (e.target.id === "ce-add-seg-btn") {
        const video = document.getElementById("ce-video");
        const currentTime = video ? video.currentTime : 0;
        const newSeg = {
            start: currentTime,
            end: Math.min(currentTime + 3, (video && video.duration) || currentTime + 3),
            text: "Nouveau sous-titre",
            words: [],
        };
        _ceSegments.push(newSeg);
        _ceRenderList(video || document.createElement("video"));
        document.getElementById("ce-seg-count").textContent = _ceSegments.length + " segments";
        // Scroll to bottom of list
        const list = document.getElementById("captions-segments-list");
        if (list) list.scrollTop = list.scrollHeight;
        _ceSelect(_ceSegments.length - 1, video || document.createElement("video"));
    }
});

// ===================== SETTINGS =====================

function loadSettingsStatus() {
    fetch("/settings/get")
        .then(r => r.json())
        .then(data => {
            const oaBadge = document.getElementById("openai-badge");
            const anBadge = document.getElementById("anthropic-badge");
            if (oaBadge) oaBadge.classList.toggle("hidden", !data.openai_set);
            if (anBadge) anBadge.classList.toggle("hidden", !data.anthropic_set);
        })
        .catch(() => {});

    fetch("/settings/social/get")
        .then(r => r.json())
        .then(data => {
            const tBadge = document.getElementById("tiktok-api-badge");
            const yBadge = document.getElementById("youtube-api-badge");
            const iBadge = document.getElementById("instagram-api-badge");
            if (tBadge) tBadge.classList.toggle("hidden", !data.tiktok_key_set);
            if (yBadge) yBadge.classList.toggle("hidden", !data.youtube_id_set);
            if (iBadge) iBadge.classList.toggle("hidden", !data.instagram_id_set);
        })
        .catch(() => {});
}

function saveSettings() {
    const openaiVal = (document.getElementById("openai-key-input") || {}).value || "";
    const anthropicVal = (document.getElementById("anthropic-key-input") || {}).value || "";

    const tiktokKey = (document.getElementById("tiktok-client-key-input") || {}).value || "";
    const tiktokSecret = (document.getElementById("tiktok-client-secret-input") || {}).value || "";
    const youtubeId = (document.getElementById("youtube-client-id-input") || {}).value || "";
    const youtubeSecret = (document.getElementById("youtube-client-secret-input") || {}).value || "";
    const igId = (document.getElementById("instagram-app-id-input") || {}).value || "";
    const igSecret = (document.getElementById("instagram-app-secret-input") || {}).value || "";

    const payload = {};
    if (openaiVal && !openaiVal.includes("****")) payload["OPENAI_API_KEY"] = openaiVal;
    if (anthropicVal && !anthropicVal.includes("****")) payload["ANTHROPIC_API_KEY"] = anthropicVal;

    const socialPayload = {};
    if (tiktokKey && !tiktokKey.includes("****")) socialPayload["TIKTOK_CLIENT_KEY"] = tiktokKey;
    if (tiktokSecret && !tiktokSecret.includes("****")) socialPayload["TIKTOK_CLIENT_SECRET"] = tiktokSecret;
    if (youtubeId && !youtubeId.includes("****")) socialPayload["YOUTUBE_CLIENT_ID"] = youtubeId;
    if (youtubeSecret && !youtubeSecret.includes("****")) socialPayload["YOUTUBE_CLIENT_SECRET"] = youtubeSecret;
    if (igId && !igId.includes("****")) socialPayload["INSTAGRAM_APP_ID"] = igId;
    if (igSecret && !igSecret.includes("****")) socialPayload["INSTAGRAM_APP_SECRET"] = igSecret;

    const btn = document.getElementById("settings-save-btn");
    const msg = document.getElementById("settings-save-msg");
    btn.disabled = true;
    btn.textContent = "Sauvegarde...";

    const saves = [];
    if (Object.keys(payload).length > 0) {
        saves.push(fetch("/settings/save", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
        }).then(r => r.json()));
    }
    if (Object.keys(socialPayload).length > 0) {
        saves.push(fetch("/settings/social/save", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(socialPayload),
        }).then(r => r.json()));
    }

    if (saves.length === 0) {
        showToast("info", "Info", "Aucune nouvelle valeur à sauvegarder.");
        btn.disabled = false;
        btn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg> Sauvegarder`;
        return;
    }

    Promise.all(saves)
        .then(() => {
            ["openai-key-input","anthropic-key-input","tiktok-client-key-input","tiktok-client-secret-input",
             "youtube-client-id-input","youtube-client-secret-input","instagram-app-id-input","instagram-app-secret-input"].forEach(id => {
                const el = document.getElementById(id);
                if (el) el.value = "";
            });
            if (msg) { msg.style.display = "inline"; setTimeout(() => { msg.style.display = "none"; }, 3000); }
            showToast("success", "Sauvegardé !", "Vos clés API ont été enregistrées.");
            loadSettingsStatus();
        })
        .catch(() => showToast("error", "Erreur", "Impossible de sauvegarder les paramètres."))
        .finally(() => {
            btn.disabled = false;
            btn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg> Sauvegarder`;
        });
}

function toggleSettingsEye(inputId, btn) {
    const input = document.getElementById(inputId);
    if (!input) return;
    if (input.type === "password") {
        input.type = "text";
        btn.style.color = "#a78bfa";
    } else {
        input.type = "password";
        btn.style.color = "";
    }
}

// ===================== TOAST NOTIFICATION SYSTEM =====================

function showToast(type, title, message, duration = 4000) {
    const container = document.getElementById("toast-container");
    if (!container) return;

    const icons = {
        success: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>`,
        error: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>`,
        info: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`,
        warning: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`,
        default: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`,
    };

    const toast = document.createElement("div");
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `
        <div class="toast-icon ${type}">${icons[type] || icons.default}</div>
        <div class="toast-body">
            ${title ? `<div class="toast-title">${escapeHtml(title)}</div>` : ""}
            ${message ? `<div class="toast-text">${escapeHtml(message)}</div>` : ""}
        </div>
        <button class="toast-close" onclick="this.closest('.toast').remove()">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
    `;

    container.appendChild(toast);

    setTimeout(() => {
        if (toast.parentElement) {
            toast.style.animation = "toastOut 0.3s ease forwards";
            setTimeout(() => toast.remove(), 300);
        }
    }, duration);

    return toast;
}

// ===================== AUTOMATION =====================

let _automationClipsJobId = null;
let _automationClipsPoll = null;
let _batchCaptionsFiles = [];
let _automationInitialized = false;

function initAutomation() {
    if (_automationInitialized) return;
    _automationInitialized = true;

    // ---- Clips Generator ----
    const uploadZoneAuto = document.getElementById("automation-upload-zone");
    const fileInputAuto = document.getElementById("automation-file-input");
    const fileSelectedEl = document.getElementById("automation-file-selected");
    let automationSelectedFile = null;

    if (uploadZoneAuto) {
        uploadZoneAuto.addEventListener("click", () => fileInputAuto && fileInputAuto.click());
        uploadZoneAuto.addEventListener("dragover", e => { e.preventDefault(); uploadZoneAuto.classList.add("dragover"); });
        uploadZoneAuto.addEventListener("dragleave", () => uploadZoneAuto.classList.remove("dragover"));
        uploadZoneAuto.addEventListener("drop", e => {
            e.preventDefault();
            uploadZoneAuto.classList.remove("dragover");
            const file = e.dataTransfer.files[0];
            if (file) _setAutomationFile(file);
        });
    }

    if (fileInputAuto) {
        fileInputAuto.addEventListener("change", () => {
            if (fileInputAuto.files[0]) _setAutomationFile(fileInputAuto.files[0]);
        });
    }

    function _setAutomationFile(file) {
        automationSelectedFile = file;
        if (uploadZoneAuto) uploadZoneAuto.style.display = "none";
        if (fileSelectedEl) {
            fileSelectedEl.style.display = "block";
            fileSelectedEl.textContent = `✓ ${file.name} (${(file.size / 1024 / 1024).toFixed(1)} MB)`;
        }
    }

    const generateBtn = document.getElementById("automation-generate-clips-btn");
    if (generateBtn) {
        generateBtn.addEventListener("click", async () => {
            const urlInput = document.getElementById("automation-url-input");
            const url = urlInput ? urlInput.value.trim() : "";
            const duration = document.getElementById("automation-duration")?.value || "30";
            const numClips = document.getElementById("automation-num-clips")?.value || "3";
            const captionStyle = document.getElementById("automation-caption-style")?.value || "bold_pop";
            const captionColor = document.getElementById("automation-caption-color")?.value || "#ffee00";

            if (!automationSelectedFile && !url) {
                showToast("warning", "Attention", "Sélectionnez un fichier MP4 ou entrez une URL YouTube.");
                return;
            }

            generateBtn.disabled = true;
            generateBtn.textContent = "Génération en cours...";

            const formData = new FormData();
            formData.append("clip_duration", duration);
            formData.append("num_clips", numClips);
            formData.append("style", captionStyle);
            formData.append("accent_color", captionColor);
            if (automationSelectedFile) {
                formData.append("file", automationSelectedFile);
            } else {
                formData.append("url", url);
            }

            const progressEl = document.getElementById("automation-clips-progress");
            const fillEl = document.getElementById("automation-clips-fill");
            const statusEl = document.getElementById("automation-clips-status");
            const pctEl = document.getElementById("automation-clips-pct");
            const resultsEl = document.getElementById("automation-clips-results");

            if (progressEl) progressEl.classList.remove("hidden");
            if (resultsEl) resultsEl.classList.add("hidden");

            try {
                const resp = await fetch("/automation/clips", { method: "POST", body: formData });
                const data = await resp.json();
                if (data.error) {
                    showToast("error", "Erreur", data.error);
                    if (progressEl) progressEl.classList.add("hidden");
                    return;
                }
                _automationClipsJobId = data.job_id;
                _pollAutomationClips(fillEl, statusEl, pctEl, resultsEl, progressEl);
            } catch (err) {
                showToast("error", "Erreur réseau", err.message);
                if (progressEl) progressEl.classList.add("hidden");
            } finally {
                generateBtn.disabled = false;
                generateBtn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="5 3 19 12 5 21 5 3"/></svg> Générer les clips`;
            }
        });
    }

    function _pollAutomationClips(fillEl, statusEl, pctEl, resultsEl, progressEl) {
        if (_automationClipsPoll) clearInterval(_automationClipsPoll);
        _automationClipsPoll = setInterval(async () => {
            try {
                const resp = await fetch(`/automation/clips/status/${_automationClipsJobId}`);
                const data = await resp.json();

                if (fillEl) fillEl.style.width = data.progress + "%";
                if (pctEl) pctEl.textContent = data.progress + "%";
                if (statusEl) {
                    if (data.status === "processing") statusEl.textContent = `Découpe en cours... ${data.clips?.length || 0}/${data.num_clips} clips`;
                    else if (data.status === "done") statusEl.textContent = "Terminé !";
                    else if (data.status === "error") statusEl.textContent = "Erreur";
                }

                if (data.clips && data.clips.length > 0) {
                    _renderClipsResults(data.clips, resultsEl);
                    if (resultsEl) resultsEl.classList.remove("hidden");
                }

                if (data.status === "done" || data.status === "error") {
                    clearInterval(_automationClipsPoll);
                    _automationClipsPoll = null;
                    if (data.status === "done") {
                        showToast("success", "Clips générés !", `${data.clips.length} clip(s) prêt(s) à télécharger.`);
                    } else {
                        showToast("error", "Erreur", data.error || "Génération échouée.");
                    }
                }
            } catch (err) {
                clearInterval(_automationClipsPoll);
            }
        }, 1500);
    }

    function _renderClipsResults(clips, container) {
        if (!container) return;
        container.innerHTML = clips.map((clip, i) => `
            <div class="clip-result-card ${clip.status === 'done' ? 'done' : ''}">
                <div class="clip-num">${i + 1}</div>
                <div class="clip-info">
                    <div class="clip-name">Clip ${i + 1} — ${clip.start}s → ${clip.start + clip.duration}s</div>
                    <div class="clip-meta">${clip.size_mb || '?'} MB · ${clip.duration}s · ${clip.status === 'done' ? '✓ Prêt' : clip.status}</div>
                </div>
                ${clip.status === 'done' ? `
                <a href="/automation/clips/download/${_automationClipsJobId}/${i}" class="btn btn-primary btn-sm">
                    Télécharger
                </a>` : `<span class="badge badge-gray">${clip.status}</span>`}
            </div>
        `).join("");
    }

    // ---- Pipeline ----
    const pipelineBlocks = document.getElementById("pipeline-blocks");
    if (pipelineBlocks) {
        let dragSrc = null;
        pipelineBlocks.querySelectorAll(".pipeline-step-block").forEach(block => {
            block.addEventListener("dragstart", e => {
                dragSrc = block;
                block.classList.add("dragging");
                e.dataTransfer.effectAllowed = "move";
            });
            block.addEventListener("dragend", () => block.classList.remove("dragging"));
            block.addEventListener("dragover", e => {
                e.preventDefault();
                if (dragSrc && dragSrc !== block) block.classList.add("drag-over");
            });
            block.addEventListener("dragleave", () => block.classList.remove("drag-over"));
            block.addEventListener("drop", e => {
                e.preventDefault();
                block.classList.remove("drag-over");
                if (dragSrc && dragSrc !== block) {
                    // Swap positions
                    const parent = block.parentElement;
                    const allChildren = Array.from(parent.children);
                    const srcIdx = allChildren.indexOf(dragSrc);
                    const tgtIdx = allChildren.indexOf(block);
                    if (srcIdx < tgtIdx) {
                        block.after(dragSrc);
                    } else {
                        block.before(dragSrc);
                    }
                    // Update numbers
                    let num = 1;
                    parent.querySelectorAll(".pipeline-step-block").forEach(b => {
                        const numEl = b.querySelector(".pipeline-step-num");
                        if (numEl) numEl.textContent = num++;
                    });
                }
            });

            // Toggle checkbox active state
            const cb = block.querySelector("input[type=checkbox]");
            const checkLabel = block.querySelector(".pipeline-step-check");
            if (cb && checkLabel) {
                cb.addEventListener("change", () => {
                    checkLabel.classList.toggle("checked", cb.checked);
                    block.classList.toggle("active", cb.checked);
                });
            }
        });
    }

    const pipelineRunBtn = document.getElementById("pipeline-run-btn");
    const pipelineResetBtn = document.getElementById("pipeline-reset-btn");
    const pipelineStatus = document.getElementById("pipeline-run-status");

    if (pipelineRunBtn) {
        pipelineRunBtn.addEventListener("click", () => {
            const activeSteps = [];
            document.querySelectorAll(".pipeline-step-block").forEach(b => {
                if (b.querySelector("input[type=checkbox]")?.checked) {
                    activeSteps.push(b.dataset.step);
                }
            });
            if (activeSteps.length === 0) {
                showToast("warning", "Pipeline vide", "Activez au moins une étape.");
                return;
            }
            if (pipelineStatus) {
                pipelineStatus.style.display = "block";
                pipelineStatus.textContent = `Pipeline lancé : ${activeSteps.join(" → ")}`;
            }
            showToast("info", "Pipeline lancé", `Étapes : ${activeSteps.join(", ")}`);
        });
    }

    if (pipelineResetBtn) {
        pipelineResetBtn.addEventListener("click", () => {
            document.querySelectorAll(".pipeline-step-block").forEach((b, i) => {
                const cb = b.querySelector("input[type=checkbox]");
                if (cb) {
                    cb.checked = i < 2;
                    b.querySelector(".pipeline-step-check")?.classList.toggle("checked", i < 2);
                    b.classList.toggle("active", i < 2);
                }
            });
            if (pipelineStatus) pipelineStatus.style.display = "none";
        });
    }

    // ---- Batch Captions ----
    const batchZone = document.getElementById("batch-captions-upload-zone");
    const batchInput = document.getElementById("batch-captions-input");
    const batchFileList = document.getElementById("batch-captions-file-list");
    const batchStartBtn = document.getElementById("batch-captions-start-btn");

    if (batchZone) {
        batchZone.addEventListener("click", () => batchInput && batchInput.click());
        batchZone.addEventListener("dragover", e => { e.preventDefault(); batchZone.classList.add("dragover"); });
        batchZone.addEventListener("dragleave", () => batchZone.classList.remove("dragover"));
        batchZone.addEventListener("drop", e => {
            e.preventDefault();
            batchZone.classList.remove("dragover");
            _setBatchFiles(Array.from(e.dataTransfer.files).filter(f => f.name.toLowerCase().endsWith(".mp4")));
        });
    }

    if (batchInput) {
        batchInput.addEventListener("change", () => {
            _setBatchFiles(Array.from(batchInput.files));
        });
    }

    function _setBatchFiles(files) {
        _batchCaptionsFiles = files;
        if (batchStartBtn) batchStartBtn.disabled = files.length === 0;
        if (batchFileList) {
            batchFileList.innerHTML = files.map((f, i) => `
                <div class="batch-file-item">
                    <span class="batch-file-name">${escapeHtml(f.name)}</span>
                    <span class="batch-file-status" id="batch-status-${i}">En attente</span>
                </div>
            `).join("");
        }
        if (files.length > 0) showToast("info", "Fichiers sélectionnés", `${files.length} vidéo(s) prête(s).`);
    }

    if (batchStartBtn) {
        batchStartBtn.addEventListener("click", async () => {
            if (_batchCaptionsFiles.length === 0) return;
            const lang = document.getElementById("batch-captions-lang")?.value || "auto";
            const template = document.getElementById("batch-captions-template")?.value || "bold_pop";

            batchStartBtn.disabled = true;

            const formData = new FormData();
            _batchCaptionsFiles.forEach(f => formData.append("files", f));
            formData.append("language", lang);
            formData.append("template", template);

            try {
                const resp = await fetch("/captions/upload", { method: "POST", body: formData });
                const data = await resp.json();
                if (data.error) {
                    showToast("error", "Erreur", data.error);
                    batchStartBtn.disabled = false;
                    return;
                }
                showToast("success", "Batch lancé !", `Job ID: ${data.job_id} (mode: ${data.mode})`);
                // Poll batch status
                if (data.mode === "batch") {
                    _pollBatchStatus(data.job_id);
                } else {
                    _pollSingleCaptionsBatch(data.job_id);
                }
            } catch (err) {
                showToast("error", "Erreur réseau", err.message);
                batchStartBtn.disabled = false;
            }
        });
    }

    function _pollBatchStatus(batchId) {
        const poll = setInterval(async () => {
            try {
                const resp = await fetch(`/captions/batch/status/${batchId}`);
                const data = await resp.json();
                const results = data.results || [];
                if (batchFileList) {
                    batchFileList.innerHTML = results.map((r, i) => `
                        <div class="batch-file-item">
                            <span class="batch-file-name">${escapeHtml(r.filename || ("Vidéo " + (i+1)))}</span>
                            <div class="batch-file-progress">
                                <div class="progress-bar" style="height:4px;">
                                    <div class="progress-fill" style="width:${r.progress||0}%"></div>
                                </div>
                            </div>
                            <span class="batch-file-status ${r.status}" id="batch-status-${i}">
                                ${r.status === 'done' ? '✓ Terminé' : r.status === 'error' ? '✗ Erreur' : r.status}
                            </span>
                            ${r.status === 'done' ? `<a href="/captions/batch/download/${batchId}/${i}" class="btn btn-primary btn-xs">Télécharger</a>` : ''}
                        </div>
                    `).join("");
                }
                if (data.status === "done" || data.status === "error") {
                    clearInterval(poll);
                    batchStartBtn.disabled = false;
                    if (data.status === "done") showToast("success", "Batch terminé !", `${results.filter(r=>r.status==='done').length}/${results.length} vidéos sous-titrées.`);
                    else showToast("error", "Erreur batch", data.error || "Échec.");
                }
            } catch (err) {
                clearInterval(poll);
            }
        }, 2000);
    }

    function _pollSingleCaptionsBatch(jobId) {
        const poll = setInterval(async () => {
            try {
                const resp = await fetch(`/captions/status/${jobId}`);
                const data = await resp.json();
                if (data.status === "done") {
                    clearInterval(poll);
                    batchStartBtn.disabled = false;
                    showToast("success", "Terminé !", "Votre vidéo sous-titrée est prête.");
                    if (batchFileList) batchFileList.innerHTML = `
                        <div class="batch-file-item">
                            <span class="batch-file-name">Vidéo sous-titrée</span>
                            <span class="batch-file-status done">✓ Terminé</span>
                            <a href="/captions/download/${jobId}" class="btn btn-primary btn-xs">Télécharger</a>
                        </div>`;
                } else if (data.status === "error") {
                    clearInterval(poll);
                    batchStartBtn.disabled = false;
                    showToast("error", "Erreur", data.error);
                }
            } catch (err) { clearInterval(poll); }
        }, 2000);
    }
}

// ===================== PUBLISH =====================

let _publishInitialized = false;

function initPublish() {
    if (_publishInitialized) return;
    _publishInitialized = true;

    // Load platform status
    _loadPublishStatus();

    // File browse
    const browsBtn = document.getElementById("publish-browse-btn");
    const fileInput = document.getElementById("publish-file-input");
    const filePathInput = document.getElementById("publish-file-path");

    if (browsBtn) browsBtn.addEventListener("click", () => fileInput && fileInput.click());
    if (fileInput) {
        fileInput.addEventListener("change", () => {
            if (fileInput.files[0]) {
                if (filePathInput) filePathInput.value = fileInput.files[0].name;
                fileInput._selectedFile = fileInput.files[0];
            }
        });
    }

    // Schedule toggle
    const nowBtn = document.getElementById("schedule-now-btn");
    const laterBtn = document.getElementById("schedule-later-btn");
    const dateInput = document.getElementById("publish-scheduled-time");

    if (nowBtn) nowBtn.addEventListener("click", () => {
        nowBtn.classList.add("active");
        laterBtn?.classList.remove("active");
        if (dateInput) dateInput.classList.add("hidden");
    });
    if (laterBtn) laterBtn.addEventListener("click", () => {
        laterBtn.classList.add("active");
        nowBtn?.classList.remove("active");
        if (dateInput) dateInput.classList.remove("hidden");
    });

    // Network checkbox visual feedback
    document.querySelectorAll(".network-check-label input[type=checkbox]").forEach(cb => {
        cb.addEventListener("change", () => {
            cb.closest(".network-check-label")?.classList.toggle("checked", cb.checked);
        });
    });

    // Publish button
    const publishNowBtn = document.getElementById("publish-now-btn");
    if (publishNowBtn) {
        publishNowBtn.addEventListener("click", async () => {
            const title = document.getElementById("publish-title")?.value.trim() || "";
            const description = document.getElementById("publish-description")?.value.trim() || "";
            const hashtags = document.getElementById("publish-hashtags")?.value.trim() || "";
            const filePath = document.getElementById("publish-file-path")?.value.trim() || "";

            const platforms = [];
            if (document.getElementById("publish-on-tiktok")?.checked) platforms.push("tiktok");
            if (document.getElementById("publish-on-youtube")?.checked) platforms.push("youtube");
            if (document.getElementById("publish-on-instagram")?.checked) platforms.push("instagram");

            if (!filePath) {
                showToast("warning", "Fichier manquant", "Sélectionnez une vidéo à publier.");
                return;
            }
            if (platforms.length === 0) {
                showToast("warning", "Aucun réseau", "Sélectionnez au moins un réseau social.");
                return;
            }

            const progressEl = document.getElementById("publish-progress");
            const fillEl = document.getElementById("publish-progress-fill");
            const statusEl = document.getElementById("publish-progress-status");

            publishNowBtn.disabled = true;
            publishNowBtn.textContent = "Publication...";
            if (progressEl) progressEl.style.display = "block";
            if (fillEl) fillEl.style.width = "30%";
            if (statusEl) statusEl.textContent = `Publication sur ${platforms.join(", ")}...`;

            const scheduledTime = document.getElementById("schedule-later-btn")?.classList.contains("active")
                ? document.getElementById("publish-scheduled-time")?.value || null
                : null;

            try {
                const resp = await fetch("/publish/post", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ video_path: filePath, title, description, hashtags, platforms, scheduled_time: scheduledTime }),
                });
                const data = await resp.json();

                if (fillEl) fillEl.style.width = "100%";

                if (data.error) {
                    showToast("error", "Erreur", data.error);
                } else {
                    const results = data.results || {};
                    const successes = Object.entries(results).filter(([,v]) => v.ok).map(([k]) => k);
                    const failures = Object.entries(results).filter(([,v]) => !v.ok).map(([k,v]) => `${k}: ${v.error}`);

                    if (successes.length > 0) {
                        showToast("success", "Publié !", `Succès sur : ${successes.join(", ")}`);
                    }
                    if (failures.length > 0) {
                        showToast("error", "Erreurs", failures.join(" | "), 7000);
                    }

                    // Reload publish history
                    _loadPublishHistory();
                }
            } catch (err) {
                showToast("error", "Erreur réseau", err.message);
            } finally {
                publishNowBtn.disabled = false;
                publishNowBtn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg> Publier`;
                if (progressEl) setTimeout(() => { progressEl.style.display = "none"; }, 3000);
            }
        });
    }

    // Load publish history on init
    _loadPublishHistory();
}

async function _loadPublishStatus() {
    try {
        const resp = await fetch("/publish/status");
        const data = await resp.json();

        _updatePlatformCard("tiktok", data.tiktok);
        _updatePlatformCard("youtube", data.youtube);
        _updatePlatformCard("instagram", data.instagram);
    } catch (err) {
        // silently fail
    }
}

function _updatePlatformCard(platform, isConnected) {
    const card = document.getElementById(`${platform}-platform-card`);
    const statusEl = document.getElementById(`${platform}-platform-status`);
    const btn = document.getElementById(`${platform}-connect-btn`);

    if (!card || !statusEl) return;

    if (isConnected) {
        card.classList.add("connected");
        statusEl.className = "platform-status connected-status";
        statusEl.innerHTML = `<span class="status-dot"></span>Connecté`;
        if (btn) {
            btn.textContent = "Déconnecter";
            btn.className = "btn btn-secondary btn-sm";
            btn.onclick = async () => {
                // Clear token from config
                await fetch("/settings/social/save", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ [`${platform.toUpperCase()}_ACCESS_TOKEN`]: "" }),
                });
                _loadPublishStatus();
                showToast("info", "Déconnecté", `${platform} a été déconnecté.`);
            };
        }
    } else {
        card.classList.remove("connected");
        statusEl.className = "platform-status disconnected-status";
        statusEl.innerHTML = `<span class="status-dot"></span>Non connecté`;
        if (btn) {
            btn.textContent = "Connecter";
            btn.className = "btn btn-primary btn-sm";
            const authUrls = { tiktok: "/publish/tiktok/auth", youtube: "/publish/youtube/auth", instagram: "/publish/instagram/auth" };
            btn.onclick = () => window.open(authUrls[platform], "_blank", "width=600,height=700");
        }
    }
}

async function _loadPublishHistory() {
    try {
        const resp = await fetch("/publish/history");
        const data = await resp.json();
        const tbody = document.getElementById("publish-history-tbody");
        if (!tbody) return;

        const history = data.history || [];
        if (history.length === 0) {
            tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;color:#3a3a55;padding:24px;">Aucune publication pour l'instant</td></tr>`;
            return;
        }

        tbody.innerHTML = history.map(entry => {
            const results = entry.results || {};
            const ts = entry.date ? JSON.parse(entry.date).ts : null;
            const dateStr = ts ? new Date(ts * 1000).toLocaleDateString("fr-FR", { day:"2-digit", month:"2-digit", year:"2-digit", hour:"2-digit", minute:"2-digit" }) : "—";

            return entry.platforms.map(platform => {
                const r = results[platform] || {};
                const statusClass = r.ok ? "published" : "failed";
                const statusLabel = r.ok ? "Publié" : "Échec";
                const link = r.url ? `<a href="${escapeHtml(r.url)}" target="_blank" style="color:#7c3aed;font-size:0.78rem;">Voir</a>` : "—";
                const platformEmojis = { tiktok: "🎵", youtube: "▶️", instagram: "📸" };

                return `<tr>
                    <td>${platformEmojis[platform] || ""} ${platform}</td>
                    <td style="max-width:200px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escapeHtml(entry.title || "—")}</td>
                    <td><span class="pub-badge ${statusClass}">${statusLabel}</span></td>
                    <td style="white-space:nowrap;">${dateStr}</td>
                    <td>${link}</td>
                </tr>`;
            }).join("");
        }).join("");
    } catch (err) {
        // silently fail
    }
}

