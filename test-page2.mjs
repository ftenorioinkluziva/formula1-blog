const h = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
  Accept: "text/html",
  "Accept-Language": "pt-BR,pt;q=0.9",
};
fetch("https://www.motorsport.com/f1/galleries/?page=2", { headers: h })
  .then(r => r.text())
  .then(html => {
    console.log("Has next:", /next|proxima|›|»/i.test(html));
    const anchors = html.match(/<a\b[^>]*class=["'][^"']*ms-item--photo-gallery[^"']*["'][\s\S]*?<\/a>/gi);
    console.log("Anchors:", anchors ? anchors.length : 0);
    if (anchors) {
      const dates = anchors.map(a => {
        const m = a.match(/<time\b[^>]*>([\s\S]*?)<\/time>/i);
        return m ? m[1].trim() : "no date";
      });
      console.log("First 5 dates:", dates.slice(0,5));
      console.log("Last 5 dates:", dates.slice(-5));
    }
  })
  .catch(e => console.log("Error:", e.message))
