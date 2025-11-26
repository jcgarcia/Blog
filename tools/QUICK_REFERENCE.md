# Quick Reference - Blog Publishing Tool

## Global Usage (after installation)
```bash
# Basic publishing
blog-publish ./my-post.md

# Fast content method
blog-publish ./my-post.md --content

# With custom API key
blog-publish ./my-post.md --api-key YOUR_KEY

# Show help
blog-publish --help
```

## Alternative Usage (if global install failed)
```bash
# Direct execution
node /path/to/tools/blog-publish.js ./my-post.md

# From tools directory
cd /path/to/tools && node blog-publish.js ./my-post.md
```

## Required Markdown Format
```markdown
---
title: "Your Post Title"
description: "Post description"
date: 2025-08-04
tags: [tag1, tag2]
---

# Your Content Here
Your blog post content...
```
