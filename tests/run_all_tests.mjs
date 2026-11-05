#!/usr/bin/env node
import { readdirSync, statSync, writeFileSync } from 'node:fs';
import { resolve, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

// Parse CLI arguments
const args = process.argv.slice(2);
let tierFilter = 'all';
let mode = 'contract';
let targetUrl = 'http://localhost:8080/api';
let specificFile = null;
let jsonOutput = false;

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--tier' && args[i + 1]) tierFilter = args[++i];
  else if (args[i] === '--mode' && args[i + 1]) mode = args[++i];
  else if (args[i] === '--target' && args[i + 1]) targetUrl = args[++i];
  else if (args[i] === '--file' && args[i + 1]) specificFile = args[++i];
  else if (args[i] === '--json') jsonOutput = true;
}

const TIER_DIRS = {
  '1': 'tier1_features',
  '2': 'tier2_boundaries',
  '3': 'tier3_combinations',
  '4': 'tier4_scenarios'
};

async function collectTestFiles() {
  if (specificFile) {
    return [resolve(__dirname, specificFile)];
  }

  const files = [];
  const selectedTiers = tierFilter === 'all' ? Object.keys(TIER_DIRS) : [String(tierFilter)];

  for (const tier of selectedTiers) {
    const dirName = TIER_DIRS[tier];
    if (!dirName) continue;
    const fullDir = join(__dirname, dirName);
    try {
      const entries = readdirSync(fullDir);
      for (const entry of entries) {
        if (entry.endsWith('.mjs') && (entry.startsWith('test_') || entry.includes('test'))) {
          files.push(join(fullDir, entry));
        }
      }
    } catch {
      // dir not found
    }
  }
  return files;
}

function runSingleTest(filePath) {
  return new Promise((resolveResult) => {
    const rel = relative(__dirname, filePath);
    const child = spawn(process.execPath, ['--test', filePath], {
      cwd: __dirname,
      env: {
        ...process.env,
        TEST_MODE: mode,
        TARGET_URL: targetUrl
      }
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', d => { stdout += d.toString(); });
    child.stderr.on('data', d => { stderr += d.toString(); });

    child.on('close', code => {
      // Count tests
      const passMatch = stdout.match(/ℹ pass (\d+)/);
      const failMatch = stdout.match(/ℹ fail (\d+)/);
      const passed = passMatch ? parseInt(passMatch[1], 10) : (code === 0 ? 1 : 0);
      const failed = failMatch ? parseInt(failMatch[1], 10) : (code !== 0 ? 1 : 0);

      resolveResult({
        file: rel,
        code,
        passed,
        failed,
        stdout,
        stderr
      });
    });
  });
}

async function main() {
  console.log('='.repeat(78));
  console.log('  CAR REPAIR QUEUE & ORDER MANAGEMENT SYSTEM — E2E TEST SUITE RUNNER');
  console.log('='.repeat(78));
  console.log(`Execution Mode : ${mode.toUpperCase()} ${mode === 'contract' ? '(In-Memory Oracle)' : `(Live Server: ${targetUrl})`}`);
  console.log(`Tier Filter    : ${tierFilter.toUpperCase()}`);
  console.log(`Node Runtime   : ${process.version}`);
  console.log('-'.repeat(78));

  const testFiles = await collectTestFiles();
  if (testFiles.length === 0) {
    console.error(`No test files found for tier: ${tierFilter}`);
    process.exit(1);
  }

  console.log(`Discovered ${testFiles.length} test suite files. Commencing execution...\n`);

  const startTime = Date.now();
  const results = [];
  let totalPassed = 0;
  let totalFailed = 0;

  for (const f of testFiles) {
    const res = await runSingleTest(f);
    results.push(res);
    totalPassed += res.passed;
    totalFailed += res.failed;

    const statusBadge = res.code === 0 ? '✔ PASS' : '✖ FAIL';
    console.log(`  [${statusBadge}] ${res.file.padEnd(52)} (Tests: ${res.passed} pass, ${res.failed} fail)`);
    if (res.code !== 0) {
      console.log('    ' + '-'.repeat(70));
      console.log('    ' + res.stdout.split('\n').filter(l => l.includes('✖') || l.includes('AssertionError')).join('\n    '));
      console.log('    ' + '-'.repeat(70));
    }
  }

  const durationMs = Date.now() - startTime;
  console.log('\n' + '='.repeat(78));
  console.log('  TEST EXECUTION SUMMARY');
  console.log('='.repeat(78));
  console.log(`  Suites Run      : ${results.length}`);
  console.log(`  Total Test Cases: ${totalPassed + totalFailed}`);
  console.log(`  Passed          : ${totalPassed}`);
  console.log(`  Failed          : ${totalFailed}`);
  console.log(`  Execution Time  : ${(durationMs / 1000).toFixed(2)}s`);
  console.log(`  Overall Status  : ${totalFailed === 0 ? 'SUCCESS (100% PASS)' : 'FAILURE'}`);
  console.log('='.repeat(78));

  const summaryData = {
    timestamp: new Date().toISOString(),
    mode,
    tierFilter,
    durationMs,
    totalSuites: results.length,
    totalTestCases: totalPassed + totalFailed,
    passed: totalPassed,
    failed: totalFailed,
    status: totalFailed === 0 ? 'SUCCESS' : 'FAILURE',
    suites: results.map(r => ({ file: r.file, passed: r.passed, failed: r.failed, code: r.code }))
  };

  try {
    writeFileSync(join(__dirname, 'test_run_summary.json'), JSON.stringify(summaryData, null, 2), 'utf-8');
  } catch {}

  if (totalFailed > 0) {
    process.exit(1);
  }
}

main().catch(err => {
  console.error('Test runner fatal error:', err);
  process.exit(1);
});
