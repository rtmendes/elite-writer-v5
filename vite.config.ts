import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';

// Frost theme HTML injection plugin
function frostThemePlugin() {
  return {
    name: 'frost-theme-inject',
    transformIndexHtml(html) {
      return html.replace(
        '</head>',
        `  <!-- Frost theme bootstrap: reads saved theme from localStorage before React mounts -->
  <script>
    (function() {
      var t = localStorage.getItem('ip-theme');
      if (t === 'frost') {
        document.documentElement.setAttribute('data-theme', 'frost');
        var l = document.createElement('link');
        l.rel = 'stylesheet'; l.id = 'frost-css'; l.href = '/frost.css';
        document.head.appendChild(l);
      } else if (t === 'light') {
        document.documentElement.setAttribute('data-theme', 'light');
      }
    })();
  </script>
</head>`
      );
    }
  };
}

export default defineConfig({
  plugins: [react(), tailwindcss(), frostThemePlugin()],
  resolve: {
    alias: { '@': path.resolve(__dirname, './client/src') },
  },
  root: './client',
  build: {
    outDir: '../dist',
    emptyOutDir: true,
  },
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:3001',
      '/trpc': 'http://localhost:3001',
    },
  },
});
