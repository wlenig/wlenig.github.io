// @ts-check
import { defineConfig } from 'astro/config';

import react from '@astrojs/react';

import tailwind from '@astrojs/tailwind';

import icon from 'astro-icon';
import theme from './data/quietlight-color-theme.json'

// https://astro.build/config
export default defineConfig({
  integrations: [
    react(), 
    tailwind(), 
    icon({
      // include: {
      //   mdi: ['linkedin', 'github', 'email']
      // }
    })
  ],
  markdown: {
    shikiConfig: {
      theme: theme,
    }
  }
});