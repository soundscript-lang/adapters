import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const publishDirectories = [
  'packages/register',
  'packages/vite',
  'packages/webpack-loader',
  'packages/bun-plugin',
];

function run(command, args, cwd) {
  const result = spawnSync(command, args, {
    cwd,
    env: process.env,
    stdio: 'inherit',
  });
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(' ')} failed in ${cwd}.`);
  }
}

function readManifest(directory) {
  return JSON.parse(readFileSync(join(root, directory, 'package.json'), 'utf8'));
}

const otp = process.env.SOUNDSCRIPT_NPM_OTP ?? process.env.NPM_CONFIG_OTP;

for (const directory of publishDirectories) {
  const manifest = readManifest(directory);
  const args = ['publish', '--access', 'public'];
  if (otp) {
    args.push('--otp', otp);
  }
  console.log(`Publishing ${manifest.name}@${manifest.version} from ${directory}`);
  run('npm', args, join(root, directory));
}
