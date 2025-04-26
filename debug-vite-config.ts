import { performance } from 'perf_hooks';

// Start timing
const startTime = performance.now();

// Import vite config file
import viteConfig from './vite.config';
console.log('Vite config loaded');

// End timing
const configEndTime = performance.now();
console.log(`Time to load Vite config: ${(configEndTime - startTime).toFixed(2)}ms`);

// Try to create Vite server
const initStartTime = performance.now();
import { createServer as createViteServer } from 'vite';

async function testViteInit() {
  try {
    const vite = await createViteServer({
      ...viteConfig,
      configFile: false,
      server: {
        middlewareMode: true,
      },
      appType: "custom",
    });
    
    const initEndTime = performance.now();
    console.log(`Time to initialize Vite server: ${(initEndTime - initStartTime).toFixed(2)}ms`);
    console.log(`Total Vite startup time: ${(initEndTime - startTime).toFixed(2)}ms`);
    
    // Close the server and exit
    await vite.close();
    process.exit(0);
  } catch (error) {
    console.error('Error initializing Vite:', error);
    process.exit(1);
  }
}

testViteInit();