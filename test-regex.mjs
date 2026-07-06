const t0 = Date.now();
const h = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
  Accept: "text/html",
  "Accept-Language": "pt-BR,pt;q=0.9",
};
fetch("https://www.motorsport.com/f1/galleries/", { headers: h })
  .then(r => r.text())
  .then(html => {
    console.log("HTML size:", html.length, "bytes, load:", Date.now()-t0, "ms");
    const t1 = Date.now();
    const anchors = html.match(/<a\b[^>]*class=["'][^"']*ms-item--photo-gallery[^"']*["'][\s\S]*?<\/a>/gi) ?? [];
    console.log("Regex:", anchors.length, "anchors in", Date.now()-t1, "ms");
  })
  .catch(e => console.log("Error:", e.message))
