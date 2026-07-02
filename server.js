const { createServer } = require("node:http");

const port = Number(process.env.PORT || 4180);
const redirectTarget = process.env.REDIRECT_TARGET || "https://lapinoskrynia.lt/";

function sendJson(response, status, payload) {
  response.writeHead(status, {
    "Cache-Control": "no-store",
    "Content-Type": "application/json; charset=utf-8",
  });
  response.end(JSON.stringify(payload));
}

function redirect(response) {
  response.writeHead(301, {
    "Cache-Control": "no-store",
    Location: redirectTarget,
  });
  response.end();
}

createServer((request, response) => {
  if (request.method === "GET" && request.url === "/health") {
    return sendJson(response, 200, { ok: true, redirectTarget });
  }

  return redirect(response);
}).listen(port, () => {
  console.log(`Pulsacijos redirect serveris veikia: http://127.0.0.1:${port} -> ${redirectTarget}`);
});
