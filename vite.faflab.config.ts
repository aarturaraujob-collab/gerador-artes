import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";
import fs from "fs";

// Overwrites the copied public/.htaccess (RewriteBase /urano/, wrong for this
// deploy) with one scoped to /faflab/ — the public FAF Lab page is deployed
// to its own top-level folder, separate from the Urano admin tool.
const FAFLAB_HTACCESS = `<IfModule mod_rewrite.c>
  RewriteEngine On
  RewriteBase /faflab/

  RewriteCond %{REQUEST_FILENAME} -f [OR]
  RewriteCond %{REQUEST_FILENAME} -d
  RewriteRule ^ - [L]

  RewriteRule ^ index.html [L]
</IfModule>
`;

export default defineConfig({
  // Production is served standalone at https://www.futeboldealagoas.net/faflab
  // (separate from /urano — see vite.config.ts). Dev preview stays at root.
  base: process.env.NODE_ENV === "production" ? "/faflab/" : "/",

  plugins: [
    react(),
    tailwindcss(),
    {
      // Vite names the built HTML after the input file ("faflab.html"), but
      // Apache's fallback rewrite (and any static host) expects "index.html"
      // at the folder root — rename it once the build has finished writing.
      name: "faflab-htaccess-and-rename",
      closeBundle() {
        const outDir = path.resolve(__dirname, "dist-faflab");
        fs.writeFileSync(path.join(outDir, ".htaccess"), FAFLAB_HTACCESS);
        const builtHtml = path.join(outDir, "faflab.html");
        if (fs.existsSync(builtHtml)) {
          fs.renameSync(builtHtml, path.join(outDir, "index.html"));
        }
      },
    },
  ],

  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },

  build: {
    outDir: "dist-faflab",
    rollupOptions: {
      input: path.resolve(__dirname, "faflab.html"),
    },
  },

  server: {
    host: "0.0.0.0",
    port: 5174,
    allowedHosts: true,
  },
});
