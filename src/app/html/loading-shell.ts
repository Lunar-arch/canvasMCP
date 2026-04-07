interface HtmlLoaderOptions {
  apiBase: string;
  target: string;
}

function toSafeJson(value: string): string {
  return JSON.stringify(value);
}

export function buildHtmlLoadingShell(options: HtmlLoaderOptions): string {
  const apiBase = toSafeJson(options.apiBase);
  const initialTarget = toSafeJson(options.target || "/");

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <title>StudyFlow Loader</title>
    <style>
      :root {
        --bg: #f5f8ff;
        --panel: #ffffff;
        --ink: #0f274a;
        --muted: #5b6d8c;
        --line: #d7e3f7;
        --accent: #0ea5e9;
        --accent-strong: #0284c7;
        --danger: #dc2626;
        --shadow: 0 18px 42px rgba(16, 39, 74, 0.15);
      }

      * {
        box-sizing: border-box;
      }

      html,
      body {
        margin: 0;
        padding: 0;
        min-height: 100%;
        background:
          radial-gradient(circle at 15% 0%, rgba(14, 165, 233, 0.25), transparent 40%),
          radial-gradient(circle at 100% 100%, rgba(59, 130, 246, 0.2), transparent 42%),
          var(--bg);
        color: var(--ink);
        font-family: "Space Grotesk", "Avenir Next", "Segoe UI", sans-serif;
      }

      .shell {
        min-height: 100vh;
        display: grid;
        place-items: center;
        padding: 24px;
      }

      .panel {
        width: min(680px, 96vw);
        background: linear-gradient(180deg, #fff, #f9fbff);
        border: 1px solid var(--line);
        border-radius: 18px;
        box-shadow: var(--shadow);
        overflow: hidden;
      }

      .panel-head {
        padding: 16px 18px;
        border-bottom: 1px solid var(--line);
        display: flex;
        align-items: center;
        gap: 12px;
      }

      .logo {
        width: 36px;
        height: 36px;
        border-radius: 11px;
        display: grid;
        place-items: center;
        font-weight: 700;
        color: #fff;
        background: linear-gradient(135deg, var(--accent), var(--accent-strong));
      }

      .title {
        margin: 0;
        font-size: 1.08rem;
      }

      .subtitle {
        margin: 2px 0 0;
        color: var(--muted);
        font-size: 0.85rem;
      }

      .panel-body {
        padding: 18px;
        display: grid;
        gap: 14px;
      }

      .status-row {
        display: flex;
        align-items: center;
        gap: 12px;
      }

      .spinner {
        width: 24px;
        height: 24px;
        border: 3px solid #c8d8f2;
        border-top-color: var(--accent);
        border-radius: 999px;
        animation: spin 0.8s linear infinite;
        flex: 0 0 24px;
      }

      @keyframes spin {
        to {
          transform: rotate(360deg);
        }
      }

      .phase {
        margin: 0;
        font-size: 0.78rem;
        color: var(--muted);
        text-transform: uppercase;
        letter-spacing: 0.08em;
        font-weight: 700;
      }

      .message {
        margin: 3px 0 0;
        font-size: 1rem;
        font-weight: 600;
      }

      .progress {
        height: 8px;
        border-radius: 999px;
        background: #dfebfb;
        overflow: hidden;
      }

      .progress-bar {
        height: 100%;
        width: 0%;
        background: linear-gradient(90deg, var(--accent), var(--accent-strong));
        transition: width 220ms ease;
      }

      .stream-log {
        border: 1px solid var(--line);
        border-radius: 12px;
        background: #0b1220;
        color: #d5e2f5;
        padding: 10px;
        min-height: 180px;
        max-height: 220px;
        overflow: auto;
        font-family: "IBM Plex Mono", "Consolas", monospace;
        font-size: 0.78rem;
      }

      .stream-item {
        margin-bottom: 6px;
      }

      .stream-item.error {
        color: #fca5a5;
      }

      .controls {
        display: flex;
        justify-content: flex-end;
      }

      .retry {
        border: 1px solid var(--line);
        background: #fff;
        border-radius: 10px;
        padding: 8px 12px;
        font: inherit;
        font-weight: 600;
        cursor: pointer;
        display: none;
      }

      .error-banner {
        border: 1px solid #fecaca;
        background: #fff1f2;
        color: var(--danger);
        border-radius: 10px;
        padding: 9px 10px;
        font-size: 0.86rem;
        display: none;
      }
    </style>
  </head>
  <body>
    <div class="shell">
      <div class="panel">
        <div class="panel-head">
          <div class="logo">SF</div>
          <div>
            <h1 class="title">StudyFlow</h1>
            <p class="subtitle">Preparing exact build output for HTML delivery</p>
          </div>
        </div>
        <div class="panel-body">
          <div class="status-row">
            <div id="spinner" class="spinner"></div>
            <div>
              <p id="phase" class="phase">Initializing</p>
              <p id="message" class="message">Connecting to status stream...</p>
            </div>
          </div>

          <div class="progress">
            <div id="progress-bar" class="progress-bar"></div>
          </div>

          <div id="error-banner" class="error-banner"></div>
          <div id="stream-log" class="stream-log"></div>

          <div class="controls">
            <button id="retry-btn" class="retry" type="button">Retry</button>
          </div>
        </div>
      </div>
    </div>

    <script>
      (function () {
        "use strict";

        const API_BASE = ${apiBase};
        const INITIAL_TARGET = ${initialTarget};

        const phaseEl = document.getElementById("phase");
        const messageEl = document.getElementById("message");
        const progressBarEl = document.getElementById("progress-bar");
        const streamLogEl = document.getElementById("stream-log");
        const errorBannerEl = document.getElementById("error-banner");
        const retryButtonEl = document.getElementById("retry-btn");
        const spinnerEl = document.getElementById("spinner");

        let currentEventSource = null;
        let activeTarget = INITIAL_TARGET;
        let streamFinished = false;

        function normalizeTarget(input) {
          const value = (input || "").trim().toLowerCase();
          if (!value || value === "/" || value === "home" || value === "index") return "/";
          if (value === "/dashboard" || value === "dashboard") return "/dashboard";
          if (value === "/setup" || value === "setup") return "/setup";
          return "/";
        }

        function appendStreamLine(text, isError) {
          const line = document.createElement("div");
          line.className = "stream-item" + (isError ? " error" : "");
          line.textContent = "[" + new Date().toLocaleTimeString() + "] " + text;
          streamLogEl.appendChild(line);
          streamLogEl.scrollTop = streamLogEl.scrollHeight;
        }

        function showError(message) {
          errorBannerEl.textContent = message;
          errorBannerEl.style.display = "block";
          retryButtonEl.style.display = "inline-block";
          spinnerEl.style.display = "none";
          appendStreamLine(message, true);
        }

        function hideError() {
          errorBannerEl.style.display = "none";
          retryButtonEl.style.display = "none";
          spinnerEl.style.display = "block";
        }

        function setStatus(phase, message, progress) {
          phaseEl.textContent = phase;
          messageEl.textContent = message;
          progressBarEl.style.width = String(Math.max(0, Math.min(100, progress))) + "%";
        }

        function closeStream() {
          if (currentEventSource) {
            currentEventSource.close();
            currentEventSource = null;
          }
        }

        function resolveFinalUrl(payload) {
          if (payload && typeof payload.appUrl === "string" && payload.appUrl) {
            return payload.appUrl;
          }

          if (payload && typeof payload.sourcePath === "string" && /^https?:\/\//i.test(payload.sourcePath)) {
            return payload.sourcePath;
          }

          if (payload && typeof payload.renderUrl === "string" && payload.renderUrl) {
            return payload.renderUrl;
          }

          return "";
        }

        function loadFinalHtml(payload) {
          const finalUrl = resolveFinalUrl(payload);
          if (!finalUrl) {
            throw new Error("Missing final URL in complete event");
          }

          setStatus("Sending", "Launching app route...", 98);
          appendStreamLine("Navigating to " + finalUrl, false);
          window.location.assign(finalUrl);
        }

        function connectStream() {
          const params = new URLSearchParams(window.location.search);
          activeTarget = normalizeTarget(params.get("target") || INITIAL_TARGET);
          const encodedTarget = encodeURIComponent(activeTarget);
          const streamUrl = API_BASE + "/api/html/stream?target=" + encodedTarget;
          streamFinished = false;

          setStatus("Initializing", "Connecting to server stream...", 2);
          appendStreamLine("Connecting to " + streamUrl, false);
          hideError();

          closeStream();
          const source = new EventSource(streamUrl);
          currentEventSource = source;

          source.addEventListener("status", function (event) {
            const payload = JSON.parse(event.data);
            const label = String(payload.phase || "status").replace(/-/g, " ");
            setStatus(label, String(payload.message || "Working..."), Number(payload.progress || 0));
            appendStreamLine(String(payload.message || "status"), false);
          });

          source.addEventListener("complete", function (event) {
            const payload = JSON.parse(event.data);
            streamFinished = true;
            source.close();
            currentEventSource = null;
            try {
              loadFinalHtml(payload);
            } catch (error) {
              showError(error instanceof Error ? error.message : String(error));
            }
          });

          source.addEventListener("fatal", function (event) {
            const payload = JSON.parse(event.data);
            closeStream();
            showError(String(payload.message || "Initialization failed."));
          });

          source.addEventListener("error", function () {
            if (streamFinished) {
              return;
            }
            closeStream();
            showError("Stream disconnected unexpectedly. Retry to reconnect.");
          });
        }

        retryButtonEl.addEventListener("click", function () {
          streamLogEl.innerHTML = "";
          connectStream();
        });

        connectStream();
      })();
    </script>
  </body>
</html>`;
}
