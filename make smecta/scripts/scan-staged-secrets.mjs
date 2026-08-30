import { randomBytes } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';

const excluded = /(?:^|\/)(?:package-lock\.json|npm-shrinkwrap\.json|pnpm-lock\.yaml|yarn\.lock|worker-configuration\.d\.ts|scan-staged-secrets\.mjs|check-public-assets\.mjs|verify-env\.mjs)$/;
const tokenPatterns = [
  ['private key', /-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----/],
  ['AWS access key', /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/],
  ['GitHub token', /\b(?:gh[opusr]_[A-Za-z0-9_]{36,255}|github_pat_[A-Za-z0-9_]{50,255})\b/],
  ['Slack token', /\bxox[baprs]-[A-Za-z0-9-]{20,}\b/],
  ['Stripe secret', /\bsk_(?:live|test)_[A-Za-z0-9]{20,}\b/],
  ['JWT', /\beyJ[A-Za-z0-9_-]{12,}\.[A-Za-z0-9_-]{12,}\.[A-Za-z0-9_-]{12,}\b/],
];

function entropy(value) {
  const counts = new Map();
  for (const character of value) counts.set(character, (counts.get(character) ?? 0) + 1);
  return [...counts.values()].reduce((total, count) => {
    const probability = count / value.length;
    return total - probability * Math.log2(probability);
  }, 0);
}

export function scanText(text) {
  const findings = [];
  const lines = text.split(/\r?\n/);
  lines.forEach((line, index) => {
    if (/\*\*\*REMOVED-|secret-scan: allow-test-fixture|process\.env|randomBytes\(|getRandomValues\(/.test(line)) return;
    for (const [name, pattern] of tokenPatterns) {
      if (pattern.test(line)) findings.push({ line: index + 1, type: name });
    }
    const assignment = /(?:password|passwd|secret|service[_-]?role|private[_-]?key|api[_-]?key|access[_-]?token)\s*[:=]\s*["']?([^\s"']{12,})/i.exec(line);
    if (assignment && !/^(?:example|placeholder|change-?me|test|dummy|env\.|process\.|import\.meta|randomBytes|Buffer|z\.string|serviceRoleKey|session\.|cookieMap\.)/i.test(assignment[1])) {
      findings.push({ line: index + 1, type: 'credential assignment' });
    }
    for (const match of line.matchAll(/(?<![A-Za-z0-9+/_-])[A-Za-z0-9+/_-]{32,256}={0,2}(?![A-Za-z0-9+/_=-])/g)) {
      const candidate = match[0];
      if (!/^[A-Z0-9_]+$/.test(candidate) && new Set(candidate).size >= 16 && entropy(candidate) >= 4.2) {
        findings.push({ line: index + 1, type: 'high-entropy string' });
      }
    }
  });
  return findings.filter((finding, index) => findings.findIndex((item) => item.line === finding.line && item.type === finding.type) === index);
}

function git(args) {
  const result = spawnSync('git', args, { encoding: args.includes('-z') ? 'buffer' : 'utf8' });
  if (result.status !== 0) throw new Error(result.stderr?.toString().trim() || `git ${args[0]} failed`);
  return result.stdout;
}

if (process.argv.includes('--self-test')) {
  const generated = randomBytes(48).toString('base64url');
  if (scanText(`token=${generated}`).length === 0) throw new Error('high-entropy self-test failed');
  if (scanText('-----BEGIN PRIVATE KEY-----').length === 0) throw new Error('private-key self-test failed');
  if (scanText('const harmless = "public-value";').length !== 0) throw new Error('false-positive self-test failed');
  process.stdout.write('Secret scanner self-test passed.\n');
} else {
  const workingTree = process.argv.includes('--working-tree');
  const names = git(workingTree
    ? ['ls-files', '--cached', '--others', '--exclude-standard', '-z']
    : ['diff', '--cached', '--name-only', '--diff-filter=ACMR', '-z'])
    .toString('utf8').split('\0').filter(Boolean).filter((name) => !excluded.test(name));
  const findings = [];
  for (const name of names) {
    if (workingTree && !existsSync(name)) continue;
    const content = workingTree ? readFileSync(name) : git(['show', `:${name}`]);
    if (content.includes(0)) continue;
    for (const finding of scanText(content.toString('utf8'))) findings.push(`${name}:${finding.line} ${finding.type}`);
  }
  if (findings.length > 0) {
    process.stderr.write(`Commit blocked; potential secrets detected:\n${findings.join('\n')}\n`);
    process.exitCode = 1;
  } else {
    process.stdout.write(`Secret scan passed for ${names.length} ${workingTree ? 'working-tree' : 'staged'} text files.\n`);
  }
}
