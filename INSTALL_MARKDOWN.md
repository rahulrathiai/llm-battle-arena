# Installing Markdown Support

To enable markdown rendering in responses, you need to install the new dependencies.

## Steps:

1. **Stop your frontend server** (Ctrl+C in the terminal running `npm run dev`)

2. **Install the new packages:**
   ```bash
   cd frontend
   npm install
   ```

3. **Restart your frontend:**
   ```bash
   npm run dev
   ```

## What this adds:

- **react-markdown**: Renders markdown as HTML
- **remark-gfm**: Adds GitHub Flavored Markdown support (tables, strikethrough, etc.)

## Supported Markdown Features:

- **Headers**: `# H1`, `## H2`, etc.
- **Bold**: `**bold**` or `__bold__`
- **Italic**: `*italic*` or `_italic_`
- **Code**: `` `code` `` for inline, ```code blocks``` for blocks
- **Lists**: `- item` or `1. item`
- **Links**: `[text](url)`
- **Tables**: GitHub Flavored Markdown tables
- **Blockquotes**: `> quote`
- And more!

