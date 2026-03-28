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

    const langNames = { fr: "Francais", en: "English", de: "Deutsch" };
    document.getElementById("captions-lang-result").textContent =
        langNames[data.detected_language] || data.detected_language || "Auto";
    document.getElementById("captions-segments-result").textContent = data.segments_count || 0;
    document.getElementById("captions-size-result").textContent = (data.output_size_mb || 0) + " MB";

    document.getElementById("captions-download-btn").onclick = () => {
        window.location.href = `/captions/download/${currentJobId}`;
    };

    document.getElementById("captions-new-btn").onclick = () => {
        document.getElementById("captions-results-section").classList.add("hidden");
        document.getElementById("source-tabs").classList.remove("hidden");
        document.getElementById("captions-zone").classList.remove("hidden");
        captionsFileInput.value = "";
        currentJobId = null;
    };
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
