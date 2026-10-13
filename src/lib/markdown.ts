/**
 * Минимальный безопасный рендер Markdown для CMS-страниц:
 * заголовки (#, ##, ###), списки (-), жирный (**), ссылки [текст](url), абзацы. Весь HTML экранируется.
 */
function esc(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

function inline(s: string) {
  return esc(s)
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\[([^\]]+)\]\(((?:https?:\/\/|\/|mailto:|tel:)[^)\s]+)\)/g, '<a href="$2" class="underline underline-offset-4">$1</a>');
}

export function renderMarkdown(md: string): string {
  const blocks = md.replace(/\r/g, "").split(/\n{2,}/);
  return blocks
    .map((block) => {
      const lines = block.split("\n");
      if (lines.every((l) => /^\s*-\s+/.test(l))) {
        return `<ul>${lines.map((l) => `<li>${inline(l.replace(/^\s*-\s+/, ""))}</li>`).join("")}</ul>`;
      }
      const h = block.match(/^(#{1,3})\s+(.*)$/);
      if (h && lines.length === 1) {
        const level = h[1].length + 1;
        return `<h${level}>${inline(h[2])}</h${level}>`;
      }
      return `<p>${lines.map(inline).join("<br/>")}</p>`;
    })
    .join("\n");
}
