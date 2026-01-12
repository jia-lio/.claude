import { spawn } from 'child_process';
import chalk from 'chalk';

import { ConflictDetector } from './conflict.js';
import { StateManager } from './state.js';
import { ApprovalQueue } from '../approval/queue.js';
import { ImageGenerator } from '../image/generator.js';
import { ImageCleaner } from '../image/cleaner.js';
import { loadEnvConfig } from '../config.js';
import type {
  AgentConfig,
  RunOptions,
  Issue,
  OrchestratorState,
  SubAgentState,
} from '../types/index.js';

export class MainOrchestrator {
  private stateManager: StateManager;
  private approvalQueue: ApprovalQueue;
  private conflictDetector: ConflictDetector;
  private imageGenerator: ImageGenerator;
  private imageCleaner: ImageCleaner;
  private config: AgentConfig;

  constructor(config: AgentConfig) {
    this.config = config;
    this.stateManager = new StateManager(config.projectPath);
    this.approvalQueue = new ApprovalQueue();
    this.conflictDetector = new ConflictDetector();
    this.imageGenerator = new ImageGenerator(config.projectPath);
    this.imageCleaner = new ImageCleaner(config.projectPath);
  }

  async run(options: RunOptions = {}): Promise<void> {
    const envConfig = loadEnvConfig();

    // 1. 이전 상태 복구 (재시작 시)
    let state: OrchestratorState | null = null;
    if (options.resume) {
      state = await this.stateManager.load();
      if (state) {
        console.log(chalk.yellow('📂 이전 상태에서 재시작합니다.\n'));
      }
    }

    // 2. GitHub에서 열린 이슈 조회
    console.log(chalk.blue('📋 열린 이슈 조회 중...'));

    const issues = await this.fetchOpenIssues(options);

    if (issues.length === 0) {
      console.log(chalk.green('✨ 처리할 이슈가 없습니다.'));
      return;
    }

    console.log(`   ${issues.length}개 이슈 발견\n`);

    // 3. 파일 충돌 분석 → 이슈 그룹핑
    console.log(chalk.blue('🔍 파일 충돌 분석 중...'));
    const issueGroups = await this.conflictDetector.groupByConflict(issues);
    console.log(`   ${issueGroups.length}개 그룹으로 분류`);
    console.log(this.conflictDetector.formatGroups(issueGroups) + '\n');

    // 4. 상태 초기화
    if (!state) {
      state = this.stateManager.create({
        owner: this.config.owner,
        repo: this.config.repo,
        projectPath: this.config.projectPath,
        issueGroups,
      });
    }

    // 5. Claude Code CLI로 각 이슈 처리
    console.log(chalk.green('🚀 에이전트 실행 중...\n'));

    for (const group of issueGroups) {
      for (const issue of group) {
        const agentKey = `issue-${issue.number}`;

        // 이미 처리된 이슈 스킵
        if (state.completedIssues.includes(issue.number) ||
            state.rejectedIssues.includes(issue.number) ||
            state.errorIssues.includes(issue.number)) {
          console.log(chalk.gray(`   ⏭️ #${issue.number} 이미 처리됨, 스킵`));
          continue;
        }

        console.log(chalk.blue(`\n📌 이슈 #${issue.number} 처리 중: ${issue.title}`));

        state.agents[agentKey] = {
          status: 'running',
          issueNumber: issue.number,
          startedAt: new Date().toISOString(),
        };
        await this.stateManager.save(state);

        try {
          const result = await this.runClaudeCode(issue);

          if (result.success) {
            state.agents[agentKey].status = 'done';
            state.agents[agentKey].prNumber = result.prNumber;
            state.completedIssues.push(issue.number);
            console.log(chalk.green(`   ✅ #${issue.number} 완료`));
          } else {
            state.agents[agentKey].status = 'error';
            state.agents[agentKey].error = result.error;
            state.errorIssues.push(issue.number);
            console.log(chalk.red(`   ❌ #${issue.number} 실패: ${result.error}`));
          }
        } catch (error) {
          state.agents[agentKey].status = 'error';
          state.agents[agentKey].error = (error as Error).message;
          state.errorIssues.push(issue.number);
          console.log(chalk.red(`   ❌ #${issue.number} 오류: ${(error as Error).message}`));
        }

        await this.stateManager.save(state);
      }
    }

    // 7. 최종 결과 요약
    this.printSummary(state);

    // 8. 완료된 이슈의 이미지 삭제
    for (const issueNumber of state.completedIssues) {
      await this.imageCleaner.cleanForIssue(issueNumber);
    }
  }

  /**
   * Claude Code CLI를 사용하여 이슈 처리
   */
  private async runClaudeCode(issue: Issue): Promise<{ success: boolean; prNumber?: number; error?: string }> {
    const envConfig = loadEnvConfig();

    const prompt = `
GitHub 이슈를 분석하고 수정해주세요.

## 이슈 정보
- 번호: #${issue.number}
- 제목: ${issue.title}
- 내용: ${issue.body}
- 라벨: ${issue.labels.join(', ') || '없음'}

## 저장소 정보
- Owner: ${this.config.owner}
- Repo: ${this.config.repo}

## 작업 순서
1. 이슈 내용을 분석하여 수정이 필요한 파일과 변경 사항을 파악
2. 코드를 수정 (Edit 도구 사용)
3. 수정 완료 후 브랜치 생성 및 커밋
4. PR 생성 (mcp__github__create_pull_request 사용)
5. 결과를 JSON으로 출력: {"success": true, "prNumber": 123} 또는 {"success": false, "error": "오류 메시지"}

## 중요
- 반드시 마지막에 JSON 결과를 출력하세요
- PR 생성이 완료되면 success: true와 PR 번호를 포함하세요
`;

    return new Promise((resolve) => {
      const args = [
        '--print',
        '--dangerously-skip-permissions',
        '-p', prompt,
      ];

      console.log(chalk.gray(`   $ claude ${args.slice(0, 2).join(' ')} ...`));

      const child = spawn('claude', args, {
        cwd: this.config.projectPath,
        shell: true,
        env: {
          ...process.env,
          GITHUB_TOKEN: envConfig.githubToken,
        },
      });

      let stdout = '';
      let stderr = '';

      child.stdout?.on('data', (data) => {
        const text = data.toString();
        stdout += text;
        // 실시간 출력
        process.stdout.write(chalk.gray(text));
      });

      child.stderr?.on('data', (data) => {
        stderr += data.toString();
      });

      child.on('close', (code) => {
        if (code !== 0) {
          resolve({ success: false, error: `프로세스 종료 코드: ${code}\n${stderr}` });
          return;
        }

        // JSON 결과 파싱 시도
        const jsonMatch = stdout.match(/\{[\s\S]*"success"[\s\S]*\}/);
        if (jsonMatch) {
          try {
            const result = JSON.parse(jsonMatch[0]);
            resolve(result);
            return;
          } catch {
            // JSON 파싱 실패
          }
        }

        // JSON 없으면 성공으로 간주
        resolve({ success: true });
      });

      child.on('error', (error) => {
        resolve({ success: false, error: error.message });
      });
    });
  }

  private async fetchOpenIssues(options: RunOptions): Promise<Issue[]> {
    const envConfig = loadEnvConfig();
    const { owner, repo } = this.config;

    try {
      // GitHub REST API로 열린 이슈 조회
      let url = `https://api.github.com/repos/${owner}/${repo}/issues?state=open&per_page=100`;

      // 라벨 필터
      if (options.labels && options.labels.length > 0) {
        url += `&labels=${options.labels.join(',')}`;
      }

      // 담당자 필터
      if (options.assignee) {
        url += `&assignee=${options.assignee}`;
      }

      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${envConfig.githubToken}`,
          'Accept': 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28',
        },
      });

      if (!response.ok) {
        throw new Error(`GitHub API 오류: ${response.status} ${response.statusText}`);
      }

      const data = await response.json() as Array<{
        number: number;
        title: string;
        body: string | null;
        labels: Array<{ name: string }>;
        assignee: { login: string } | null;
        pull_request?: unknown;
      }>;

      // PR은 제외하고 이슈만 필터링
      let issues: Issue[] = data
        .filter(item => !item.pull_request)
        .map(item => ({
          number: item.number,
          title: item.title,
          body: item.body || '',
          labels: item.labels.map(l => l.name),
          assignee: item.assignee?.login,
        }));

      // 개수 제한
      if (options.limit && options.limit > 0) {
        issues = issues.slice(0, options.limit);
      }

      return issues;
    } catch (error) {
      console.error(chalk.red('이슈 조회 실패:'), (error as Error).message);
      return [];
    }
  }

  private printSummary(state: OrchestratorState): void {
    console.log('\n' + '═'.repeat(60));
    console.log(chalk.bold('📊 최종 결과'));
    console.log('═'.repeat(60));
    console.log(
      chalk.green(`   ✅ 완료: ${state.completedIssues.length}개`)
    );
    console.log(
      chalk.yellow(`   ⏭️  거부: ${state.rejectedIssues.length}개`)
    );
    console.log(chalk.red(`   ❌ 에러: ${state.errorIssues.length}개`));
    console.log('═'.repeat(60));
  }
}
