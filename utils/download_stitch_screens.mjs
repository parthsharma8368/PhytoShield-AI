/**
 * PhytoShield AI - Stitch Asset & Screen Fetcher
 *
 * Downloads code (HTML/CSS) and preview images for Stitch screens
 * using either STITCH_API_KEY via @google/stitch-sdk or hosted URLs.
 */
import fs from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Load .env using Node.js built-in loadEnvFile
const envPath = path.resolve(process.cwd(), '.env');
if (existsSync(envPath)) {
  process.loadEnvFile(envPath);
}
const homeEnvPath = path.resolve(process.env.HOME || '', '.env');
if (existsSync(homeEnvPath)) {
  process.loadEnvFile(homeEnvPath);
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '..');
const OUTPUT_DIR = path.resolve(PROJECT_ROOT, 'frontend', 'stitch_reference');

const PROJECT_ID = '14553048578926206038';
const SCREENS = [
  {
    name: '01_design_system',
    id: 'asset-stub-assets_ef31168a795748caa87a3c7190281ddb',
    title: 'Design System'
  },
  {
    name: '02_architecture_benchmarks',
    id: 'db50ab9302d549468345d5b2e2949748',
    title: 'Architecture & Multi-Model Benchmarks'
  },
  {
    name: '03_diagnostic_xai_studio',
    id: 'dcdeb0ed542a4d4fa945d9aec4420be1',
    title: 'Diagnostic & XAI Studio (Refined)'
  },
  {
    name: '04_trust_safety_refined',
    id: 'abab0affe7cc4e488e7288cb109d1d7f',
    title: 'Trust & Safety (Refined)'
  },
  {
    name: '05_model_inference_attribution',
    id: 'a28158b667c04d6cb428f563185420fb',
    title: 'Model Inference & Attribution Processing'
  },
  {
    name: '06_trust_safety_telemetry_expanded',
    id: '03785ec76f7e421c87055280dba0fe86',
    title: 'Trust & Safety (10D Telemetry Expanded)'
  }
];

async function main() {
  const apiKey = process.env.STITCH_API_KEY;
  const accessToken = process.env.STITCH_ACCESS_TOKEN;

  if (!apiKey && !accessToken) {
    console.error('MISSING_AUTH: Please set STITCH_API_KEY or STITCH_ACCESS_TOKEN in .env or provide hosted URLs.');
    process.exit(2);
  }

  // Find stitch-sdk location in npx cache or local node_modules
  const candidatePaths = [
    '/Users/parthsharma/.npm/_npx/829c6278c197c365/node_modules/@google/stitch-sdk/dist/src/client.js',
    path.resolve(PROJECT_ROOT, 'node_modules/@google/stitch-sdk/dist/src/client.js'),
    path.resolve(PROJECT_ROOT, 'frontend/node_modules/@google/stitch-sdk/dist/src/client.js')
  ];

  let StitchToolClient = null;
  for (const p of candidatePaths) {
    if (existsSync(p)) {
      const mod = await import(p);
      StitchToolClient = mod.StitchToolClient;
      break;
    }
  }

  if (!StitchToolClient) {
    console.error('Could not locate @google/stitch-sdk client module.');
    process.exit(1);
  }

  const client = new StitchToolClient({
    apiKey,
    accessToken,
    projectId: PROJECT_ID
  });

  await fs.mkdir(OUTPUT_DIR, { recursive: true });
  console.log(`Connecting to Stitch API for Project "${PROJECT_ID}"...`);

  for (const screen of SCREENS) {
    const screenDir = path.join(OUTPUT_DIR, screen.name);
    await fs.mkdir(screenDir, { recursive: true });
    console.log(`\nFetching ${screen.title} [${screen.id}]...`);

    try {
      const screenData = await client.callTool('get_screen', {
        projectId: PROJECT_ID,
        screenId: screen.id,
        name: `projects/${PROJECT_ID}/screens/${screen.id}`
      });

      await fs.writeFile(
        path.join(screenDir, 'metadata.json'),
        JSON.stringify(screenData, null, 2),
        'utf-8'
      );
      console.log(`  ✓ Saved metadata.json`);

      const htmlUrl = screenData?.htmlCode?.downloadUrl;
      if (htmlUrl) {
        const htmlRes = await fetch(htmlUrl);
        const htmlText = await htmlRes.text();
        await fs.writeFile(path.join(screenDir, 'screen.html'), htmlText, 'utf-8');
        console.log(`  ✓ Saved screen.html (${htmlText.length} bytes)`);
      } else {
        console.log(`  ℹ No HTML download URL returned`);
      }

      const screenshotUrl = screenData?.screenshot?.downloadUrl;
      if (screenshotUrl) {
        const imgRes = await fetch(screenshotUrl);
        const imgBuffer = Buffer.from(await imgRes.arrayBuffer());
        await fs.writeFile(path.join(screenDir, 'screen.png'), imgBuffer);
        console.log(`  ✓ Saved screen.png (${imgBuffer.length} bytes)`);
      } else {
        console.log(`  ℹ No screenshot download URL returned`);
      }
    } catch (err) {
      console.error(`  ✗ Failed fetching screen ${screen.id}:`, err.message);
    }
  }

  console.log(`\nScreen asset fetching complete. Directory: ${OUTPUT_DIR}`);
}

main().catch((err) => {
  console.error('Unexpected error:', err);
  process.exit(1);
});
