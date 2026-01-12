import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.quizforgeapp.app',
  appName: 'QuizForge',
  webDir: 'out',
  server: {
    url: 'https://quizforgeapp.com',
    cleartext: false,
    allowNavigation: ['quizforgeapp.com', '*.quizforgeapp.com', '*.vercel.app']
  }
};

export default config;
