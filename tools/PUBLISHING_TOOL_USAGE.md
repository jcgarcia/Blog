# Bedtime Blog Publishing Tool: Usage Guide

## Overview
The Bedtime Blog Publishing Tool allows you to publish Markdown blog posts with YAML frontmatter directly to your cloud-hosted blog backend. It validates your post, loads configuration and API keys from the database, and securely uploads your content to the live system.

---

## Prerequisites
- Node.js (v18+ recommended)
- Access to the project directory (where the publishing tool and your markdown files are located)
- Your API key and database configuration must already be set up (handled by the backend automation)

---

## Markdown File Format
Your post must start with a YAML frontmatter block, for example:

```
---
title: "Your Post Title"
date: 2025-08-04
tags: [tag1, tag2, tag3]
description: "A short description of your post."
---

# Your Content
Write your blog post here using Markdown.
```

- **Required fields:** `title`, `description`
- **Optional fields:** `date`, `tags`, etc.

---

## How to Publish a Post
1. Place your markdown file (e.g., `my-post.md`) in the tools directory or any accessible path.
2. Open a terminal and run:

```
node /home/jcgarcia/docs/Tech/Blog/code/tools/blog-publish.js /path/to/your-post.md
```

- The tool will:
  - Validate the frontmatter and content
  - Load API configuration from the database
  - Upload the post to the backend
  - Print a success message with the post ID and details

---

## Troubleshooting
- **No frontmatter found:** Ensure your file starts with `---` and ends the frontmatter with another `---`.
- **API Error (401/403):** Check your API key and backend deployment.
- **API Error (400):** Check your frontmatter fields and content for formatting issues.
- **API Error (404):** Ensure the backend is running and accessible at the correct URL.

---

## Example
```
node /home/jcgarcia/docs/Tech/Blog/code/tools/blog-publish.js /home/jcgarcia/docs/Tech/Blog/code/tools/brief.md
```

Expected output:
```
✅ Configuration loaded from database
✅ Markdown file validation passed
📄 Publishing: brief.md
✅ Post published successfully!
📝 Title: What you can expect from copilot
🏷️  Category: copilot
🆔 Post ID: 1
📅 Published: 6/14/2025, 1:00:00 AM
```

---

## Where Posts Go
- Posts are stored in the database and will be visible in the frontend after the next deployment.
- Each post is assigned a unique ID and can be managed via the admin interface (if available).

---

## Next Steps
- Tomorrow: The frontend will be updated to read and display posts from the database automatically.

---

For any issues, check the backend logs or contact the system administrator.
