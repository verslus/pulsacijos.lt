const { createReadStream, existsSync, statSync } = require("node:fs");
const { createServer } = require("node:http");
const path = require("node:path");

const publicRoot = __dirname;
const port = Number(process.env.PORT || 4180);

const mimeTypes = new Map([
  [".css", "text/css; charset=utf-8"],
  [".html", "text/html; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
  [".jpg", "image/jpeg"],
  [".jpeg", "image/jpeg"],
  [".png", "image/png"],
  [".svg", "image/svg+xml"],
  [".webp", "image/webp"],
]);

function splitEmails(value = "") {
  return value.split(",").map((entry) => entry.trim()).filter(Boolean);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function readJson(request) {
  return new Promise((resolve, reject) => {
    let body = "";
    request.on("data", (chunk) => {
      body += chunk;
      if (body.length > 32_000) {
        reject(new Error("payload-too-large"));
        request.destroy();
      }
    });
    request.on("end", () => {
      try {
        resolve(JSON.parse(body || "{}"));
      } catch {
        reject(new Error("invalid-json"));
      }
    });
    request.on("error", reject);
  });
}

function sendJson(response, status, payload) {
  response.writeHead(status, {
    "Cache-Control": "no-store",
    "Content-Type": "application/json; charset=utf-8",
  });
  response.end(JSON.stringify(payload));
}

function isAllowedPlan(plan) {
  return [
    "Demo vakaras - liepos 22 d. Vilniuje - 30 €",
    "3 dienų seminaras - liepos 31 - rugpjūčio 2 d. Vilniuje - 350 €",
    "Registracija dviese - liepos 31 - rugpjūčio 2 d. Vilniuje - po 300 € žmogui",
  ].includes(plan);
}

function buildRegistrationEmail({ name, email, phone, note, plan, pageUrl, occurredAt, userAgent }) {
  const rows = [
    ["Pasirinkimas", plan],
    ["Vardas", name],
    ["El. paštas", email],
    ["Telefonas", phone],
    ["Žinutė", note || "nepateikta"],
    ["Laikas", occurredAt],
    ["Puslapis", pageUrl || "nėra"],
    ["User-Agent", userAgent || "nėra"],
  ];

  const text = ["Nauja Pulsacijų registracija", "", ...rows.map(([label, value]) => `${label}: ${value}`)].join("\n");
  const html = `
    <div style="font-family:Arial,sans-serif;line-height:1.5;color:#111827">
      <h2 style="margin:0 0 16px">Nauja Pulsacijų registracija</h2>
      <table style="border-collapse:collapse;width:100%;max-width:760px">
        <tbody>
          ${rows.map(([label, value]) => `
            <tr>
              <td style="padding:8px 12px;border:1px solid #d1d5db;font-weight:700;background:#f9fafb;width:190px">${escapeHtml(label)}</td>
              <td style="padding:8px 12px;border:1px solid #d1d5db">${escapeHtml(value)}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>
  `;

  return { html, text };
}

function buildMaterialEmail({ email, pageUrl, occurredAt, userAgent }) {
  const rows = [
    ["El. paštas", email],
    ["Laikas", occurredAt],
    ["Puslapis", pageUrl || "nėra"],
    ["User-Agent", userAgent || "nėra"],
  ];

  const text = ["Pulsacijų paskaitos medžiagos užklausa", "", ...rows.map(([label, value]) => `${label}: ${value}`)].join("\n");
  const html = `
    <div style="font-family:Arial,sans-serif;line-height:1.5;color:#111827">
      <h2 style="margin:0 0 16px">Pulsacijų paskaitos medžiagos užklausa</h2>
      <table style="border-collapse:collapse;width:100%;max-width:760px">
        <tbody>
          ${rows.map(([label, value]) => `
            <tr>
              <td style="padding:8px 12px;border:1px solid #d1d5db;font-weight:700;background:#f9fafb;width:190px">${escapeHtml(label)}</td>
              <td style="padding:8px 12px;border:1px solid #d1d5db">${escapeHtml(value)}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>
  `;

  return { html, text };
}

async function sendRegistrationEmail({ name, email, phone, note, plan, pageUrl, userAgent }) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.REGISTRATION_FROM_EMAIL || process.env.CONTACT_CLICK_FROM_EMAIL;
  const to = process.env.REGISTRATION_TO_EMAIL || process.env.CONTACT_CLICK_TO_EMAIL;

  if (!apiKey || !from || !to) {
    return { ok: false, reason: "missing-env" };
  }

  const { html, text } = buildRegistrationEmail({
    name,
    email,
    phone,
    note,
    plan,
    pageUrl,
    userAgent,
    occurredAt: new Date().toISOString(),
  });

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: splitEmails(to),
      reply_to: email,
      subject: `Pulsacijų registracija: ${plan}`,
      html,
      text,
    }),
  }).catch(() => null);

  if (!response?.ok) {
    return { ok: false, reason: "send-failed" };
  }

  return { ok: true };
}

async function sendMaterialEmail({ email, pageUrl, userAgent }) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.REGISTRATION_FROM_EMAIL || process.env.CONTACT_CLICK_FROM_EMAIL;
  const to = process.env.REGISTRATION_TO_EMAIL || process.env.CONTACT_CLICK_TO_EMAIL;

  if (!apiKey || !from || !to) {
    return { ok: false, reason: "missing-env" };
  }

  const { html, text } = buildMaterialEmail({
    email,
    pageUrl,
    userAgent,
    occurredAt: new Date().toISOString(),
  });

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: splitEmails(to),
      reply_to: email,
      subject: "Pulsacijų paskaitos medžiagos užklausa",
      html,
      text,
    }),
  }).catch(() => null);

  if (!response?.ok) {
    return { ok: false, reason: "send-failed" };
  }

  return { ok: true };
}

async function handleRegistration(request, response) {
  let payload;
  try {
    payload = await readJson(request);
  } catch {
    return sendJson(response, 400, { error: "Nepavyko perskaityti duomenų." });
  }

  const name = String(payload.name || "").trim().slice(0, 120);
  const email = String(payload.email || "").trim();
  const phone = String(payload.phone || "").trim().slice(0, 80);
  const note = String(payload.note || "").trim().slice(0, 1600);
  const plan = String(payload.plan || "").trim();
  const pageUrl = String(payload.pageUrl || "").trim();

  if (!name) return sendJson(response, 400, { error: "Įveskite vardą." });
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return sendJson(response, 400, { error: "Įveskite teisingą el. paštą." });
  }
  if (!phone) return sendJson(response, 400, { error: "Įveskite telefoną." });
  if (!isAllowedPlan(plan)) {
    return sendJson(response, 400, { error: "Pasirinkite registracijos variantą." });
  }

  const result = await sendRegistrationEmail({
    name,
    email,
    phone,
    note,
    pageUrl,
    plan,
    userAgent: request.headers["user-agent"] || "",
  });

  if (!result.ok) {
    return sendJson(response, 503, {
      error: "Registracijos išsiųsti nepavyko. Pabandykite WhatsApp arba susisiekite el. paštu.",
      reason: result.reason,
    });
  }

  return sendJson(response, 202, { ok: true });
}

async function handleMaterial(request, response) {
  let payload;
  try {
    payload = await readJson(request);
  } catch {
    return sendJson(response, 400, { error: "Nepavyko perskaityti duomenų." });
  }

  const email = String(payload.email || "").trim();
  const pageUrl = String(payload.pageUrl || "").trim();

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return sendJson(response, 400, { error: "Įveskite teisingą el. paštą." });
  }

  const result = await sendMaterialEmail({
    email,
    pageUrl,
    userAgent: request.headers["user-agent"] || "",
  });

  if (!result.ok) {
    return sendJson(response, 503, {
      error: "Užklausos išsiųsti nepavyko. Susisiekite el. paštu.",
      reason: result.reason,
    });
  }

  return sendJson(response, 202, { ok: true });
}

function isPublicFile(relativePath) {
  return (
    relativePath === "/index.html" ||
    relativePath === "/style.css" ||
    relativePath === "/script.js" ||
    relativePath.startsWith("/images/") ||
    relativePath.startsWith("/docs/")
  );
}

function serveStatic(request, response) {
  const requestUrl = new URL(request.url || "/", `http://${request.headers.host || "localhost"}`);
  const requestedPath = decodeURIComponent(requestUrl.pathname);
  const relativePath = requestedPath === "/" ? "/index.html" : requestedPath;
  const fullPath = path.normalize(path.join(publicRoot, relativePath));

  if (
    !isPublicFile(relativePath) ||
    !fullPath.startsWith(publicRoot) ||
    !existsSync(fullPath) ||
    !statSync(fullPath).isFile()
  ) {
    response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("Nerasta.");
    return;
  }

  response.writeHead(200, {
    "Cache-Control": relativePath === "/index.html" ? "no-cache" : "public, max-age=3600",
    "Content-Type": mimeTypes.get(path.extname(fullPath)) || "application/octet-stream",
  });

  if (request.method === "HEAD") {
    response.end();
    return;
  }

  createReadStream(fullPath).pipe(response);
}

createServer(async (request, response) => {
  if (request.method === "GET" && request.url === "/health") {
    return sendJson(response, 200, { ok: true });
  }

  if (request.method === "POST" && request.url === "/api/register") {
    return handleRegistration(request, response);
  }

  if (request.method === "POST" && request.url === "/api/material") {
    return handleMaterial(request, response);
  }

  if (request.method === "GET" || request.method === "HEAD") {
    return serveStatic(request, response);
  }

  response.writeHead(405, { "Content-Type": "text/plain; charset=utf-8" });
  response.end("Metodas nepalaikomas.");
}).listen(port, () => {
  console.log(`Pulsacijos serveris veikia: http://127.0.0.1:${port}`);
});
