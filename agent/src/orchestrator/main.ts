import { query } from '@anthropic-ai/claude-agent-sdk';
import type { Options } from '@anthropic-ai/claude-agent-sdk';
import chalk from 'chalk';

import { analyzerAgentDefinition, fixerAgentDefinition } from '../agents/definitions.js';
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

    // 5. 메인 에이전트 실행 (서브에이전트 조율)
    const sdkOptions: Options = {
      cwd: this.config.projectPath,
      permissionMode: 'default',

      // 서브에이전트 정의
      agents: {
        'issue-analyzer': analyzerAgentDefinition,
        'issue-fixer': fixerAgentDefinition,
      },

      // MCP GitHub 서버 연결
      mcpServers: {
        github: {
          type: 'stdio',
          command: 'npx',
          args: ['-y', '@modelcontextprotocol/server-github'],
          env: {
            GITHUB_PERSONAL_ACCESS_TOKEN: envConfig.githubToken,
          },
        },
      },

      // 허용 도구
      allowedTools: [
        'Task',
        'Read',
        'Edit',
        'Write',
        'Glob',
        'Grep',
        'Bash',
      ],

      // 커스텀 권한 핸들러
      canUseTool: async (toolName, input) => {
        // 승인이 필요한 작업 처리
        if (this.requiresApproval(toolName)) {
          const approved = await this.approvalQueue.requestToolApproval(
            toolName,
            input as Record<string, unknown>
          );
          return approved
            ? { behavior: 'allow' as const, updatedInput: input }
            : { behavior: 'deny' as const, message: '사용자가 거부함' };
        }
        return { behavior: 'allow' as const, updatedInput: input };
      },
    };

    // 6. 오케스트레이터 프롬프트 실행
    const orchestratorPrompt = this.buildOrchestratorPrompt(issueGroups, state);

    console.log(chalk.green('🚀 에이전트 실행 중...\n'));

    try {
      for await (const message of query({
        prompt: orchestratorPrompt,
        options: sdkOptions,
      })) {
        await this.handleMessage(message, state);
        await this.stateManager.save(state);
      }
    } catch (error) {
      console.error(chalk.red('\n❌ 에이전트 실행 중 오류 발생:'), error);
      await this.stateManager.save(state);
    }

    // 7. 최종 결과 요약
    this.printSummary(state);

    // 8. 완료된 이슈의 이미지 삭제
    for (const issueNumber of state.completedIssues) {
      await this.imageCleaner.cleanForIssue(issueNumber);
    }
  }

  private buildOrchestratorPrompt(
    issueGroups: Issue[][],
    state: OrchestratorState
  ): string {
    const groupsDescription = issueGroups
      .map((group, i) => {
        const issues = group
          .map((issue) => `- #${issue.number}: ${issue.title}`)
          .join('\n');
        const warning =
          group.length > 1
            ? '\n⚠️ 이 이슈들은 같은 파일을 수정할 수 있어 함께 처리합니다.'
            : '';
        return `### 그룹 ${i + 1}\n${issues}${warning}`;
      })
      .join('\n\n');

    return `
당신은 GitHub 이슈를 처리하는 오케스트레이터 에이전트입니다.

## 프로젝트 정보
- Owner: ${this.config.owner}
- Repo: ${this.config.repo}
- 경로: ${this.config.projectPath}

## 처리할 이슈 그룹

${groupsDescription}

## 지시사항

각 이슈 그룹에 대해 다음을 수행하세요:

1. **분석 단계**: 'issue-analyzer' 서브에이전트를 호출하여 이슈 분석
2. **승인 대기**: 분석 결과를 이슈에 코멘트로 작성하고 사용자 승인 대기
3. **수정 단계**: 승인 시 'issue-fixer' 서브에이전트를 호출하여 코드 수정
4. **검증 단계**: 테스트, 린트, 타입체크 실행
5. **PR 생성**: 검증 통과 시 PR 생성
6. **완료**: 사용자 승인 후 이슈 닫기

## 검증 명령어
- 테스트: ${this.config.testCommand}
- 린트: ${this.config.lintCommand}
- 타입체크: ${this.config.typecheckCommand}

## 중요 규칙

- 여러 그룹을 **병렬로** 처리하세요 (Task 도구 동시 호출)
- 각 그룹의 세션 ID를 추적하여 resume으로 연속 처리
- 검증 실패 시 재시도 (최대 ${this.config.maxTestRetries}회)
- 테스트 통과율 ${this.config.testPassThreshold}% 미만이면 중단

## 현재 상태

${JSON.stringify(state.agents, null, 2)}
`;
  }

  private async fetchOpenIssues(options: RunOptions): Promise<Issue[]> {
    // 실제 구현에서는 MCP GitHub 서버를 통해 이슈를 조회
    // 여기서는 오케스트레이터 프롬프트에서 직접 조회하도록 위임
    // 또는 별도의 query로 먼저 조회할 수 있음

    // 임시: GitHub API 직접 호출 대신 빈 배열 반환
    // 실제로는 메인 query에서 MCP를 통해 조회
    console.log(chalk.gray('   (MCP를 통해 이슈를 조회합니다)'));

    return [];
  }

  private requiresApproval(toolName: string): boolean {
    const approvalRequiredTools = [
      'mcp__github__create_pull_request',
      'mcp__github__close_issue',
      'mcp__github__merge_pull_request',
    ];
    return approvalRequiredTools.includes(toolName);
  }

  private async handleMessage(
    message: unknown,
    state: OrchestratorState
  ): Promise<void> {
    const msg = message as {
      type: string;
      subtype?: string;
      message?: { content?: Array<{ text?: string; name?: string }> };
    };

    if (msg.type === 'assistant' && msg.message?.content) {
      for (const block of msg.message.content) {
        if ('text' in block && block.text) {
          console.log(block.text);
        } else if ('name' in block && block.name) {
          console.log(chalk.cyan(`🔧 Tool: ${block.name}`));
        }
      }
    } else if (msg.type === 'result') {
      console.log(chalk.green(`\n✅ 완료: ${msg.subtype}`));
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
