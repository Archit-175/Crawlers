# Crawlers

Crawlers is a static web project focused on forest awareness, country-specific forest pages, an interactive world map, a gallery, and a quiz experience.

## Project Structure

- `index.html` — main landing page
- `Country/` — country and forest detail pages
- `Gallary/` — gallery pages and assets (`Gallary` is the folder name in this repository)
- `Quiz/` — interactive quiz module
- `parallex/` — parallax visuals and related assets (`parallex` is the folder name in this repository)
- Root CSS/JS files (`body.css`, `header.css`, `map.js`, etc.) — shared styles and behavior

## Getting Started

Because this is a static site, no build step is required.

1. Clone the repository.
2. Open `index.html` in a browser, or serve the folder with a local static server for best results.

Example with Python:

```bash
cd /home/runner/work/Crawlers/Crawlers
python3 -m http.server 8000
```

Then visit `http://localhost:8000`.

## Notes

- Some pages load external assets and links, so an internet connection improves the full experience.
- File and folder names are used directly in links; keep existing paths unchanged when adding new content.
