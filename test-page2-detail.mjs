const h = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
  Accept: "text/html",
  "Accept-Language": "pt-BR,pt;q=0.9",
};
const PREVIOUS_YEARS = ["2025", "2024", "2023", "2022", "2021", "2020"];

fetch("https://www.motorsport.com/f1/galleries/?page=2", { headers: h })
  .then(r => r.text())
  .then(html => {
    const anchors = html.match(/<a\b[^>]*class=["'][^"']*ms-item--photo-gallery[^"']*["'][\s\S]*?<\/a>/gi);
    console.log("Total anchors:", anchors ? anchors.length : 0);
    if (!anchors) return;
    anchors.forEach((a, i) => {
      const titleRaw = a.match(/<p\b[^>]*class=["'][^"']*ms-item__title[^"']*["'][^>]*>([\s\S]*?)<\/p>/i)?.[1];
      const timeRaw = a.match(/<time\b[^>]*class=["'][^"']*ms-item__date[^"']*["'][^>]*>([\s\S]*?)<\/time>/i)?.[1];
      const href = a.match(/href=["']([^"']+)["']/i)?.[1];
      const title = titleRaw ? titleRaw.replace(/<script[\s\S]*?<\/script>/gi, "").replace(/<style[\s\S]*?<\/style>/gi, "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim() : "";
      const searchable = `${title} ${href}`.toLowerCase();
      const filtered = PREVIOUS_YEARS.some(year => searchable.includes(year));
      const daysAgo = "?";
      console.log(`${i+1}. [${timeRaw ? timeRaw.trim() : "no time"}] "${title.slice(0,50)}" filtered=${filtered}`);
    });
  })
  .catch(e => console.log("Error:", e.message))
