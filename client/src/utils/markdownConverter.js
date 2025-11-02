// Simple markdown to HTML converter for WYSIWYG editor
export const markdownToHtml = (markdown) => {
  if (!markdown) return '';

  let text = markdown;

  // Helper: escape HTML inside code blocks
  const escapeHtml = (str) =>
    str.replace(/&/g, '&amp;')
       .replace(/</g, '&lt;')
       .replace(/>/g, '&gt;');

  // 1) Handle fenced code blocks first: ```lang\ncode\n```
  text = text.replace(/```(\w+)?\n([\s\S]*?)```/g, (match, lang, code) => {
    const languageClass = lang ? ` class="language-${lang}"` : '';
    return `<pre><code${languageClass}>${escapeHtml(code)}</code></pre>`;
  });

  // 2) Inline code `code`
  text = text.replace(/`([^`]+)`/g, (m, code) => `<code>${escapeHtml(code)}</code>`);

  // Convert headers
  text = text.replace(/^### (.*$)/gim, '<h3>$1</h3>');
  text = text.replace(/^## (.*$)/gim, '<h2>$1</h2>');
  text = text.replace(/^# (.*$)/gim, '<h1>$1</h1>');

  // Convert bold and italic
  text = text.replace(/\*\*\*(.*?)\*\*\*/g, '<strong><em>$1</em></strong>');
  text = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  text = text.replace(/\*(.*?)\*/g, '<em>$1</em>');

  // Convert underline (not standard markdown but commonly used)
  text = text.replace(/__(.*?)__/g, '<u>$1</u>');

  // Convert images ![alt](src)
  text = text.replace(/!\[(.*?)\]\((.*?)\)/g, '<img src="$2" alt="$1" style="max-width: 100%; height: auto; margin: 10px 0;" />');

  // Convert links [text](url)
  text = text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');

  // Convert unordered lists
  text = text.replace(/^\s*[\-\*\+]\s+(.*$)/gim, '<li>$1</li>');
  text = text.replace(/(<li>.*<\/li>)/gs, '<ul>$1</ul>');

  // Convert ordered lists
  text = text.replace(/^\s*\d+\.\s+(.*$)/gim, '<li>$1</li>');

  // Convert line breaks to paragraphs (avoid breaking code blocks)
  // First, split by double newlines to paragraphs
  const paragraphs = text.split(/\n\n+/g);
  const processed = paragraphs.map(p => {
    // If paragraph already contains block-level tags, keep it
    if (/^\s*<(h[1-6]|ul|ol|pre|blockquote|table|img|p|div)/i.test(p.trim())) {
      return p;
    }
    // Otherwise replace single newlines with <br> and wrap in <p>
    const withBreaks = p.replace(/\n/g, '<br>');
    return `<p>${withBreaks}</p>`;
  }).join('');

  // Clean up empty paragraphs
  const html = processed.replace(/<p>\s*<\/p>/g, '');

  return html;
};

// Simple HTML to markdown converter for storage
export const htmlToMarkdown = (html) => {
  if (!html) return '';
  
  let markdown = html;
  
  // Convert headers
  markdown = markdown.replace(/<h1[^>]*>(.*?)<\/h1>/gi, '# $1\n\n');
  markdown = markdown.replace(/<h2[^>]*>(.*?)<\/h2>/gi, '## $1\n\n');
  markdown = markdown.replace(/<h3[^>]*>(.*?)<\/h3>/gi, '### $1\n\n');
  
  // Convert bold and italic
  markdown = markdown.replace(/<strong[^>]*>(.*?)<\/strong>/gi, '**$1**');
  markdown = markdown.replace(/<b[^>]*>(.*?)<\/b>/gi, '**$1**');
  markdown = markdown.replace(/<em[^>]*>(.*?)<\/em>/gi, '*$1*');
  markdown = markdown.replace(/<i[^>]*>(.*?)<\/i>/gi, '*$1*');
  markdown = markdown.replace(/<u[^>]*>(.*?)<\/u>/gi, '__$1__');
  
  // Convert lists
  markdown = markdown.replace(/<ul[^>]*>(.*?)<\/ul>/gis, (match, content) => {
    return content.replace(/<li[^>]*>(.*?)<\/li>/gi, '- $1\n');
  });
  
  markdown = markdown.replace(/<ol[^>]*>(.*?)<\/ol>/gis, (match, content) => {
    let counter = 1;
    return content.replace(/<li[^>]*>(.*?)<\/li>/gi, () => `${counter++}. $1\n`);
  });
  
  // Convert images - handle all attribute orders
  markdown = markdown.replace(/<img[^>]*>/gi, (match) => {
    const srcMatch = match.match(/src="([^"]*)"/);
    const altMatch = match.match(/alt="([^"]*)"/);
    
    const src = srcMatch ? srcMatch[1] : '';
    const alt = altMatch ? altMatch[1] : '';
    
    return `![${alt}](${src})`;
  });

  // Convert code blocks
  markdown = markdown.replace(/<pre>\s*<code(?: class="language-([^"]+)")?>([\s\S]*?)<\/code>\s*<\/pre>/gi, (m, lang, code) => {
    const decoded = code.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
    return lang ? `\n\n\`\`\`${lang}\n${decoded}\n\`\`\`\n\n` : `\n\n\`\`\`\n${decoded}\n\`\`\`\n\n`;
  });

  // Convert inline code
  markdown = markdown.replace(/<code>(.*?)<\/code>/gi, (m, c) => `\\`${c.replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&amp;/g,'&')}\\``);
  
  // Convert links
  markdown = markdown.replace(/<a[^>]*href="([^"]*)"[^>]*>(.*?)<\/a>/gi, '[$2]($1)');
  
  // Convert line breaks and paragraphs
  markdown = markdown.replace(/<br\s*\/?>/gi, '\n');
  markdown = markdown.replace(/<\/p>\s*<p[^>]*>/gi, '\n\n');
  markdown = markdown.replace(/<p[^>]*>/gi, '');
  markdown = markdown.replace(/<\/p>/gi, '\n\n');
  
  // Remove any remaining HTML tags
  markdown = markdown.replace(/<[^>]*>/g, '');
  
  // Clean up extra whitespace
  markdown = markdown.replace(/\n{3,}/g, '\n\n');
  markdown = markdown.trim();
  
  return markdown;
};