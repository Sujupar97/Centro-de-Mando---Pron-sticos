// Transforms Gemini's bullet-point analysis into editorial narrative paragraphs

/**
 * Convert an array of bullet points into flowing narrative paragraphs.
 * Groups every 2-3 bullets into a paragraph, adding transitional words.
 */
export function bulletsToNarrative(bullets: string[]): string {
  if (!bullets || !bullets.length) return "";

  if (bullets.length <= 2) {
    return `<p>${bullets.map(cleanBullet).join(". ")}.</p>`;
  }

  const paragraphs: string[] = [];
  const transitions = [
    "Ademas, ", "Por otro lado, ", "En ese sentido, ",
    "Cabe destacar que ", "Asimismo, ", "De igual manera, ",
    "En cuanto a este aspecto, ", "Respecto a esto, ",
  ];

  let tIdx = 0;
  for (let i = 0; i < bullets.length; i += 3) {
    const chunk = bullets.slice(i, i + 3);
    const sentences = chunk.map((b, j) => {
      let s = cleanBullet(b);
      if (!/[.!?]$/.test(s)) s += ".";
      // Add transition to first sentence of paragraphs after the first
      if (i > 0 && j === 0) {
        s = transitions[tIdx % transitions.length] + s.charAt(0).toLowerCase() + s.slice(1);
        tIdx++;
      }
      return s;
    });
    paragraphs.push(`<p>${sentences.join(" ")}</p>`);
  }

  return paragraphs.join("\n");
}

/**
 * Clean a bullet point: remove leading markers and capitalize.
 */
function cleanBullet(b: string): string {
  let s = b.replace(/^[-•*]\s*/, "").trim();
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/**
 * Format a reading time estimate based on word count.
 */
export function estimateReadingTime(text: string): number {
  const words = text.split(/\s+/).length;
  return Math.max(3, Math.ceil(words / 200));
}

/**
 * Format a relative time string ("hace 2 horas", "hace 3 dias").
 */
export function timeAgo(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 60) return `hace ${diffMins} min`;
  if (diffHours < 24) return `hace ${diffHours}h`;
  if (diffDays < 7) return `hace ${diffDays} dias`;
  return new Date(dateStr).toLocaleDateString("es-ES", { day: "numeric", month: "long" });
}

/**
 * Render a Google AdSense display ad slot.
 */
export function renderAdSlot(slotNumber: number): string {
  return `
  <div class="ad-slot">
    <div class="ad-label">Publicidad</div>
    <ins class="adsbygoogle"
         style="display:block"
         data-ad-client="ca-pub-6499561482256447"
         data-ad-slot="auto"
         data-ad-format="auto"
         data-full-width-responsive="true"></ins>
    <script>(adsbygoogle = window.adsbygoogle || []).push({});</script>
  </div>`;
}
