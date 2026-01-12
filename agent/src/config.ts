import { execSync } from 'child_process';
import { config as dotenvConfig } from 'dotenv';

// .env 파일 로드
dotenvConfig();

/**
 * 현재 디렉토리의 git remote origin에서 owner/repo 추출
 */
export function detectGitHubRepo(): { owner: string; repo: string } {
  try {
    const remoteUrl = execSync('git remote get-url origin', {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    }).trim();

    // HTTPS: https://github.com/owner/repo.git
    const httpsMatch = remoteUrl.match(/github\.com\/([^/]+)\/([^/.]+)/);
    if (httpsMatch) {
      return { owner: httpsMatch[1], repo: httpsMatch[2] };
    }

    // SSH: git@github.com:owner/repo.git
    const sshMatch = remoteUrl.match(/github\.com:([^/]+)\/([^/.]+)/);
    if (sshMatch) {
      return { owner: sshMatch[1], repo: sshMatch[2] };
    }

    throw new Error(`GitHub remote URL 파싱 실패: ${remoteUrl}`);
  } catch (error) {
    throw new Error(
      'Git 저장소를 찾을 수 없습니다. GitHub 프로젝트 디렉토리에서 실행해주세요.'
    );
  }
}

/**
 * 환경 변수에서 설정 로드
 */
export function loadEnvConfig() {
  return {
    githubToken: process.env.GITHUB_TOKEN || '',
    anthropicApiKey: process.env.ANTHROPIC_API_KEY || '',
    maxConcurrent: parseInt(process.env.MAX_CONCURRENT || '5', 10),
    testPassThreshold: parseInt(process.env.TEST_PASS_THRESHOLD || '50', 10),
    maxTestRetries: parseInt(process.env.MAX_TEST_RETRIES || '3', 10),
  };
}

/**
 * GitHub 토큰 검증
 */
export function validateGitHubToken(): void {
  const { githubToken } = loadEnvConfig();
  if (!githubToken) {
    throw new Error(
      'GITHUB_TOKEN이 설정되지 않았습니다.\n' +
        '.env 파일에 GITHUB_TOKEN=ghp_xxx 형식으로 설정해주세요.'
    );
  }
}

/**
 * 기본 설정값
 */
export const DEFAULT_CONFIG = {
  maxConcurrent: 5,
  testCommand: 'npm test',
  lintCommand: 'npm run lint',
  typecheckCommand: 'npm run typecheck',
  testPassThreshold: 50,
  maxTestRetries: 3,
} as const;
