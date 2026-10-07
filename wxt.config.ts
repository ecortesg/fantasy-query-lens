import { defineConfig } from 'wxt';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  vite: () => ({ plugins: [tailwindcss()] }),
  manifest: {
    name: 'Fantasy Query Lens',
    description: 'Your fantasy roster on any rankings page, and a lineup from that page’s ranks.',
    permissions: ['storage', 'scripting', 'activeTab'],
    optional_host_permissions: ['https://*/*', 'http://*/*'],
    action: { default_title: 'Open Fantasy Query Lens' },
    // Like a toolbar click, the shortcut grants activeTab (ADR-0002).
    commands: { _execute_action: { suggested_key: { default: 'Alt+Shift+L' } } },
  },
});
