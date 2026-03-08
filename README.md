# Obscuraworks Engineering Blog

A production-ready static blog built with [Hugo](https://gohugo.io/), designed for the [Obscuraworks](https://obscuraworks.org) engineering team.

**Live URL:** https://blog.obscuraworks.org

---

## Project Structure -

```
obscuraworks-blog/
├── .github/
│   └── workflows/
│       └── deploy.yml          # GitHub Actions CI/CD
├── archetypes/
│   ├── blog.md                 # Template for new blog posts
│   └── changelog.md            # Template for changelog entries
├── assets/
│   ├── css/
│   │   └── main.css            # Primary stylesheet (processed by Hugo Pipes)
│   └── js/
│       └── main.js             # Theme toggle, copy buttons, ToC, mobile nav
├── content/
│   ├── _index.md               # Homepage content
│   ├── about.md                # About page
│   ├── blog/
│   │   ├── _index.md           # Blog section index
│   │   ├── introducing-obscuraworks.md
│   │   ├── building-modern-api-platforms.md
│   │   └── scaling-api-infrastructure.md
│   └── changelog/
│       ├── _index.md           # Changelog section index
│       └── v1-release.md       # v1.0 release notes
├── layouts/
│   ├── _default/
│   │   ├── baseof.html         # Base HTML shell
│   │   ├── list.html           # Blog listing and taxonomy pages
│   │   └── single.html         # Individual article layout
│   ├── categories/
│   │   └── list.html           # Categories index page
│   ├── changelog/
│   │   ├── list.html           # Changelog listing
│   │   └── single.html         # Individual changelog entry
│   ├── partials/
│   │   ├── head/
│   │   │   └── meta.html       # SEO meta, OG, Twitter cards, CSS
│   │   ├── footer.html         # Site footer
│   │   ├── nav.html            # Navigation bar
│   │   ├── post-card.html      # Reusable post card component
│   │   └── scripts.html        # JS includes
│   ├── 404.html                # Custom 404 page
│   └── index.html              # Homepage layout
├── static/
│   ├── favicon.svg
│   ├── robots.txt
│   └── images/
│       └── og-default.png      # Default OpenGraph image (add manually)
├── cloudflare-pages.toml       # Cloudflare Pages config
├── netlify.toml                # Netlify config with headers
├── hugo.toml                   # Main Hugo configuration
└── README.md
```

---

## Prerequisites

- Hugo **extended** version ≥ 0.120.0 (extended is required for CSS processing)
- Git

---

## Local Development

### 1. Install Hugo

**macOS (Homebrew):**
```bash
brew install hugo
```

**Linux:**
```bash
# Download the extended binary from GitHub releases
HUGO_VERSION="0.147.0"
wget "https://github.com/gohugoio/hugo/releases/download/v${HUGO_VERSION}/hugo_extended_${HUGO_VERSION}_linux-amd64.tar.gz"
tar -xzf hugo_extended_*.tar.gz
sudo mv hugo /usr/local/bin/
```

**Windows (Scoop):**
```powershell
scoop install hugo-extended
```

Verify installation:
```bash
hugo version
# Hugo Static Site Generator v0.147.0/extended ...
```

### 2. Clone and Run

```bash
git clone https://github.com/obscuraworks/blog.git
cd blog

# Start the development server with live reload
hugo server -D

# The site is now running at:
# http://localhost:1313
```

The `-D` flag includes draft posts. Remove it to preview only published content.

---

## Writing Content

### Create a New Blog Post

```bash
hugo new content blog/my-post-title.md
```

This generates `content/blog/my-post-title.md` using the blog archetype. Edit the frontmatter:

```yaml
---
title: "My Post Title"
description: "A one or two sentence summary for SEO and post excerpts."
date: 2025-06-15T09:00:00Z
author: "Your Name"
categories: ["Engineering"]          # One primary category
tags: ["api", "infrastructure"]      # Multiple tags
draft: false                         # Set to false to publish
---
```

Write the post body in Markdown. When `draft: false` is set, the post is published on the next build.

### Create a Changelog Entry

```bash
hugo new content changelog/v1-2-0.md
```

Frontmatter for changelog entries:

```yaml
---
title: "v1.2.0 — GraphQL Gateway Beta"
description: "Introducing the GraphQL gateway in public beta, plus performance improvements."
date: 2025-07-01T09:00:00Z
version: "v1.2.0"
type: "Minor"          # Major | Minor | Patch
draft: false
---
```

### Frontmatter Reference

| Field | Type | Required | Description |
|---|---|---|---|
| `title` | string | ✅ | Post title |
| `description` | string | ✅ | SEO description and excerpt (1–2 sentences) |
| `date` | datetime | ✅ | Publication date (ISO 8601) |
| `author` | string | | Author display name |
| `categories` | list | | Primary category (one recommended) |
| `tags` | list | | Topic tags |
| `image` | string | | OpenGraph image path (`/images/my-post.png`) |
| `draft` | bool | | `true` = hidden in production builds |

---

## Code Blocks

Hugo uses Chroma for syntax highlighting. Specify the language after the opening fence:

````markdown
```go
package main

import "fmt"

func main() {
    fmt.Println("Hello, Obscuraworks")
}
```
````

Copy buttons are added automatically to all code blocks via JavaScript.

---

## Adding Images

Place images in `static/images/`:

```bash
cp my-diagram.png static/images/
```

Reference in Markdown:

```markdown
![Architecture diagram](/images/my-diagram.png)
```

For the OpenGraph default image, add a 1200×630px PNG to `static/images/og-default.png`.

---

## Build for Production

```bash
# Build with minification
hugo --minify

# Output is in ./public/
ls public/
```

The `public/` directory contains the complete static site, ready to upload to any static host.

---

## Deployment

### Cloudflare Pages

1. Push the repository to GitHub
2. In the Cloudflare dashboard: **Pages → Create application → Connect to Git**
3. Set:
   - Build command: `hugo --minify`
   - Build output directory: `public`
4. Add environment variable: `HUGO_VERSION` = `0.147.0`
5. Deploy

Configure your custom domain to point to the Cloudflare Pages URL.

### Netlify

1. Push to GitHub
2. **New site from Git** in Netlify dashboard
3. Build command: `hugo --minify`
4. Publish directory: `public`
5. Environment variable: `HUGO_VERSION` = `0.147.0`

The `netlify.toml` in this project sets security headers and cache policies automatically.

### GitHub Pages

The `.github/workflows/deploy.yml` workflow handles CI/CD:

- Every push to `main` builds and deploys to GitHub Pages
- Pull requests trigger a build to catch errors

Enable GitHub Pages in your repository settings (**Settings → Pages → Source: GitHub Actions**).

### Manual / Any Static Host

```bash
hugo --minify --baseURL "https://blog.obscuraworks.org"
# Upload ./public/* to your hosting provider
```

---

## Configuration Reference

Key settings in `hugo.toml`:

```toml
[params]
  platformURL = "https://obscuraworks.org"  # Platform CTA link
  platformCTA = "Try Now"                    # CTA button text
  showTableOfContents = true                 # Sidebar ToC on articles
  showReadingTime = true                     # Reading time estimate
  showAuthor = true                          # Author byline on articles
  dateFormat = "January 2, 2006"            # Go date format string
```

---

## RSS Feed

The blog exposes an RSS feed at:

```
https://blog.obscuraworks.org/blog/index.xml
```

Convenience redirects (configured in `netlify.toml`):
- `/feed` → `/blog/index.xml`
- `/rss` → `/blog/index.xml`

---

## SEO

Every page generates:

- `<title>` tag
- `<meta name="description">`
- OpenGraph tags (`og:title`, `og:description`, `og:image`, `og:url`)
- Twitter card tags
- Canonical URL
- `sitemap.xml` (auto-generated by Hugo at `/sitemap.xml`)
- `robots.txt` (at `/robots.txt`)

For best SEO results, always fill in the `description` frontmatter field on every post.

---

## Performance Notes

- CSS and JS are minified and fingerprinted by Hugo Pipes
- Zero external JavaScript dependencies
- Google Fonts loaded with `preconnect` hints
- Syntax highlighting uses server-side Chroma (no client-side JS)
- All assets are CDN-friendly (immutable cache headers via `netlify.toml`)

---

## License

Content © 2025 Obscuraworks. All rights reserved.
