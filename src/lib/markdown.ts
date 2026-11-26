/** Markdown mínimo e seguro (escapa HTML): títulos ##/###, listas, parágrafos, **negrito**, `código` e [links](/interno|https). */
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

function inline(s: string) {
  return esc(s)
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/`(.+?)`/g, "<code>$1</code>")
    .replace(/\[([^\]]+)\]\(((?:\/|https:\/\/)[^)\s]*)\)/g, (_, t, href) => `<a href="${href}"${href.startsWith("http") ? ' rel="noopener noreferrer" target="_blank"' : ""}>${t}</a>`)
    .replace(/\[PENDENTE([^\]]*)\]/g, '<mark class="rounded bg-warning-bg px-1 text-warning">[PENDENTE$1]</mark>');
}

export function renderMarkdown(md: string): string {
  const out: string[] = [];
  let list: "ul" | "ol" | null = null;
  const close = () => {
    if (list) out.push(`</${list}>`);
    list = null;
  };
  for (const raw of md.split("\n")) {
    const line = raw.trim();
    if (!line) { close(); continue; }
    let m: RegExpMatchArray | null;
    if ((m = line.match(/^(#{2,3})\s+(.*)$/))) { close(); out.push(`<h${m[1].length}>${inline(m[2])}</h${m[1].length}>`); continue; }
    if ((m = line.match(/^[-*]\s+(.*)$/))) { if (list !== "ul") { close(); out.push("<ul>"); list = "ul"; } out.push(`<li>${inline(m[1])}</li>`); continue; }
    if ((m = line.match(/^\d+\.\s+(.*)$/))) { if (list !== "ol") { close(); out.push('<ol class="list-decimal pl-6">'); list = "ol"; } out.push(`<li>${inline(m[1])}</li>`); continue; }
    close();
    out.push(`<p>${inline(line)}</p>`);
  }
  close();
  return out.join("\n");
}
