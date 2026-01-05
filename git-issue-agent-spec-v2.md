# Git Issue Agent 설계 문서 v2

## 개요

지정한 GitHub 프로젝트의 이슈를 분석하고, 승인 후 수정까지 처리하는 CLI 에이전트

**핵심 기술 스택:**
- **AI 엔진**: Claude API
- **코드 접근**: 로컬 클론
- **프레임워크**: Claude Agent SDK (`@anthropic-ai/claude-agent-sdk`)
- **수정 검증**: 테스트 + 린트 + 타입체크

---

## 아키텍처

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         Main Agent (Orchestrator)                           │
│                                                                             │
│   1. 프로젝트의 모든 열린 이슈 조회 (MCP GitHub)                              │
│   2. 파일 충돌 분석 → 충돌 이슈들 그룹핑                                       │
│   3. agents 옵션으로 서브에이전트 정의                                        │
│   4. Task 도구로 서브에이전트 호출 (병렬)                                     │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                    ┌───────────────┼───────────────┐
                    ▼               ▼               ▼
            ┌─────────────┐ ┌─────────────┐ ┌─────────────┐
            │ Sub Agent   │ │ Sub Agent   │ │ Sub Agent   │
            │ Issue #42   │ │ Issue #43   │ │ #44 + #45   │ ← 충돌 이슈 합침
            │             │ │             │ │ (merged)    │
            └─────────────┘ └─────────────┘ └─────────────┘
                    │               │               │
                    ▼               ▼               ▼
            ┌─────────────────────────────────────────────┐
            │              각 서브에이전트 흐름             │
            │                                             │
            │   분석 → 승인대기 → 수정 → 검증 → 승인 → 완료  │
            │          (resume)                           │
            └─────────────────────────────────────────────┘
```

---

## 프로젝트 구조

```
git-issue-agent/
├── package.json
├── tsconfig.json
├── .env.example
├── src/
│   ├── index.ts              # CLI 엔트리포인트
│   ├── config.ts             # 환경변수, 설정
│   ├── types/
│   │   └── index.ts          # 타입 정의
│   ├── orchestrator/
│   │   ├── main.ts           # 메인 에이전트 (오케스트레이터)
│   │   ├── conflict.ts       # 파일 충돌 감지 & 그룹핑
│   │   └── state.ts          # 상태 저장/복구 (재시작용)
│   ├── agents/
│   │   ├── definitions.ts    # 서브에이전트 정의 (AgentDefinition)
│   │   ├── analyzer.ts       # 분석 에이전트 프롬프트
│   │   ├── fixer.ts          # 수정 에이전트 프롬프트
│   │   └── verifier.ts       # 검증 에이전트 (테스트/린트/타입체크)
│   ├── approval/
│   │   ├── queue.ts          # 승인 큐 (터미널 순차 처리)
│   │   └── prompt.ts         # 터미널 승인 요청 UI
│   ├── image/
│   │   ├── generator.ts      # 분석 결과 이미지 생성
│   │   ├── uploader.ts       # GitHub 이미지 업로드
│   │   └── cleaner.ts        # 완료 후 이미지 삭제
│   └── cli/
│       ├── display.ts        # 터미널 출력 포맷
│       └── progress.ts       # 병렬 처리 진행 상황 표시
├── templates/
│   └── analysis.html         # 분석 결과 이미지 템플릿
└── state/                    # 상태 저장 디렉토리 (gitignore)
    └── .gitkeep
```

---

## 핵심 인터페이스

### 타입 정의

```typescript
// src/types/index.ts

// ═══════════════════════════════════════════════════════════
// 이슈 & 분석 결과
// ═══════════════════════════════════════════════════════════

export interface Issue {
  number: number;
  title: string;
  body: string;
  labels: string[];
  state: 'open' | 'closed';
}

export interface AnalysisResult {
  issue: Issue;
  summary: string;
  suggestedFix: SuggestedFix;
  affectedFiles: AffectedFile[];
  difficulty: 'easy' | 'medium' | 'hard';
  estimatedTime: string;
}

export interface SuggestedFix {
  title: string;
  description: string;
  rootCause: string;
  steps: FixStep[];
  codeChanges: CodeChange[];
  alternatives?: string[];
  sideEffects?: string[];
  testingGuide: string;
}

export interface FixStep {
  order: number;
  action: string;
  detail: string;
  file?: string;
}

export interface CodeChange {
  file: string;
  line?: number;
  type: 'add' | 'modify' | 'delete';
  before?: string;
  after: string;
  explanation: string;
}

export interface AffectedFile {
  path: string;
  changeType: 'primary' | 'secondary';
  reason: string;
}

// ═══════════════════════════════════════════════════════════
// 서브에이전트 상태
// ═══════════════════════════════════════════════════════════

export type SubAgentStatus =
  | 'pending'
  | 'analyzing'
  | 'waiting-fix-approval'
  | 'fixing'
  | 'verifying'
  | 'waiting-close-approval'
  | 'closing'
  | 'done'
  | 'rejected'
  | 'error';

export interface SubAgentState {
  issueNumbers: number[];           // 단일 또는 병합된 이슈들
  status: SubAgentStatus;
  sessionId?: string;               // Claude Agent SDK 세션 ID
  analysisResult?: AnalysisResult;
  prNumber?: number;
  error?: string;
  retryCount: number;
}

export interface SubAgentResult {
  issueNumbers: number[];
  status: 'completed' | 'rejected' | 'error';
  analysis?: AnalysisResult;
  prNumber?: number;
  error?: string;
}

// ═══════════════════════════════════════════════════════════
// 검증 결과
// ═══════════════════════════════════════════════════════════

export interface VerificationResult {
  passed: boolean;
  test: TestResult;
  lint: LintResult;
  typecheck: TypecheckResult;
}

export interface TestResult {
  total: number;
  passed: number;
  failed: number;
  passRate: number;          // 0 ~ 100
  retryCount: number;
  logs: string;
}

export interface LintResult {
  passed: boolean;
  errorCount: number;
  warningCount: number;
  logs: string;
}

export interface TypecheckResult {
  passed: boolean;
  errorCount: number;
  logs: string;
}

// ═══════════════════════════════════════════════════════════
// 상태 저장 (재시작용)
// ═══════════════════════════════════════════════════════════

export interface OrchestratorState {
  version: string;
  startedAt: string;
  projectPath: string;
  owner: string;
  repo: string;
  agents: Record<string, SubAgentState>;  // key: issueNumbers.join('-')
  completedIssues: number[];
  rejectedIssues: number[];
  errorIssues: number[];
}

// ═══════════════════════════════════════════════════════════
// 설정
// ═══════════════════════════════════════════════════════════

export interface AgentConfig {
  owner: string;
  repo: string;
  projectPath: string;
  maxConcurrent: number;
  testCommand: string;
  lintCommand: string;
  typecheckCommand: string;
  testPassThreshold: number;  // 기본 50 (%)
  maxTestRetries: number;     // 기본 3
}

export interface RunOptions {
  maxConcurrent?: number;
  labels?: string[];
  assignee?: string;
  limit?: number;
  resume?: boolean;           // 이전 상태에서 재시작
}
```

---

## Claude Agent SDK 연동

### 메인 에이전트 (오케스트레이터)

```typescript
// src/orchestrator/main.ts

import { query, type Options } from '@anthropic-ai/claude-agent-sdk';
import { analyzerAgentDefinition, fixerAgentDefinition } from '../agents/definitions';
import { ConflictDetector } from './conflict';
import { StateManager } from './state';
import { ApprovalQueue } from '../approval/queue';

export class MainOrchestrator {
  private stateManager: StateManager;
  private approvalQueue: ApprovalQueue;
  private config: AgentConfig;

  constructor(config: AgentConfig) {
    this.config = config;
    this.stateManager = new StateManager(config.projectPath);
    this.approvalQueue = new ApprovalQueue();
  }

  async run(options: RunOptions = {}): Promise<void> {
    // 1. 이전 상태 복구 (재시작 시)
    let state = options.resume
      ? await this.stateManager.load()
      : null;

    // 2. GitHub에서 열린 이슈 조회 (MCP 사용)
    console.log('📋 열린 이슈 조회 중...');
    const issues = await this.fetchOpenIssues(options);

    if (issues.length === 0) {
      console.log('✨ 처리할 이슈가 없습니다.');
      return;
    }

    console.log(`   ${issues.length}개 이슈 발견\n`);

    // 3. 파일 충돌 분석 → 이슈 그룹핑
    console.log('🔍 파일 충돌 분석 중...');
    const conflictDetector = new ConflictDetector();
    const issueGroups = await conflictDetector.groupByConflict(issues);

    console.log(`   ${issueGroups.length}개 그룹으로 분류\n`);

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
            GITHUB_PERSONAL_ACCESS_TOKEN: process.env.GITHUB_TOKEN!,
          },
        },
      },

      // 허용 도구
      allowedTools: [
        'Task',           // 서브에이전트 호출
        'Read', 'Edit', 'Write', 'Glob', 'Grep',  // 파일 조작
        'Bash',           // 명령어 실행
        'mcp__github__*', // GitHub MCP 도구들
      ],

      // 커스텀 권한 핸들러
      canUseTool: async (toolName, input, { signal }) => {
        // 승인이 필요한 작업 처리
        if (this.requiresApproval(toolName, input)) {
          const approved = await this.approvalQueue.request(toolName, input);
          return approved
            ? { behavior: 'allow', updatedInput: input }
            : { behavior: 'deny', message: '사용자가 거부함' };
        }
        return { behavior: 'allow', updatedInput: input };
      },
    };

    // 6. 오케스트레이터 프롬프트 실행
    const orchestratorPrompt = this.buildOrchestratorPrompt(issueGroups, state);

    console.log('🚀 에이전트 실행 중...\n');

    for await (const message of query({
      prompt: orchestratorPrompt,
      options: sdkOptions,
    })) {
      // 메시지 처리 & 상태 업데이트
      await this.handleMessage(message, state);
      await this.stateManager.save(state);
    }

    // 7. 최종 결과 요약
    this.printSummary(state);
  }

  private buildOrchestratorPrompt(
    issueGroups: Issue[][],
    state: OrchestratorState
  ): string {
    return `
당신은 GitHub 이슈를 처리하는 오케스트레이터 에이전트입니다.

## 처리할 이슈 그룹

${issueGroups.map((group, i) => `
### 그룹 ${i + 1}
${group.map(issue => `- #${issue.number}: ${issue.title}`).join('\n')}
${group.length > 1 ? '⚠️ 이 이슈들은 같은 파일을 수정할 수 있어 함께 처리합니다.' : ''}
`).join('\n')}

## 지시사항

각 이슈 그룹에 대해 다음을 수행하세요:

1. **분석 단계**: 'issue-analyzer' 서브에이전트를 호출하여 이슈 분석
2. **승인 대기**: 분석 결과를 이슈에 코멘트로 작성하고 사용자 승인 대기
3. **수정 단계**: 승인 시 'issue-fixer' 서브에이전트를 호출하여 코드 수정
4. **검증 단계**: 테스트, 린트, 타입체크 실행
5. **PR 생성**: 검증 통과 시 PR 생성
6. **완료**: 사용자 승인 후 이슈 닫기

## 중요 규칙

- 여러 그룹을 **병렬로** 처리하세요 (Task 도구 동시 호출)
- 각 그룹의 세션 ID를 추적하여 resume으로 연속 처리
- 승인 요청은 ApprovalQueue를 통해 순차 처리됨
- 검증 실패 시 재시도 (최대 ${this.config.maxTestRetries}회)
- 테스트 통과율 ${this.config.testPassThreshold}% 미만이면 중단

## 현재 상태

${JSON.stringify(state.agents, null, 2)}
`;
  }

  private async fetchOpenIssues(options: RunOptions): Promise<Issue[]> {
    // MCP GitHub를 통해 이슈 조회 (query 내에서 처리)
    // 실제로는 메인 query 실행 전에 별도 query로 조회하거나
    // 오케스트레이터 프롬프트에서 조회하도록 지시
    return [];
  }

  private requiresApproval(toolName: string, input: any): boolean {
    // 승인이 필요한 작업 판단
    return toolName === 'mcp__github__create_pull_request' ||
           toolName === 'mcp__github__close_issue';
  }

  private async handleMessage(message: any, state: OrchestratorState): Promise<void> {
    // 메시지 타입에 따른 처리
    if (message.type === 'assistant') {
      for (const block of message.message?.content || []) {
        if ('text' in block) {
          console.log(block.text);
        } else if ('name' in block) {
          console.log(`🔧 Tool: ${block.name}`);
        }
      }
    } else if (message.type === 'result') {
      console.log(`\n✅ 완료: ${message.subtype}`);
    }
  }

  private printSummary(state: OrchestratorState): void {
    console.log('\n' + '═'.repeat(60));
    console.log('📊 최종 결과');
    console.log('═'.repeat(60));
    console.log(`   ✅ 완료: ${state.completedIssues.length}개`);
    console.log(`   ⏭️  거부: ${state.rejectedIssues.length}개`);
    console.log(`   ❌ 에러: ${state.errorIssues.length}개`);
    console.log('═'.repeat(60));
  }
}
```

### 서브에이전트 정의

```typescript
// src/agents/definitions.ts

import type { AgentDefinition } from '@anthropic-ai/claude-agent-sdk';

/**
 * 이슈 분석 서브에이전트
 */
export const analyzerAgentDefinition: AgentDefinition = {
  description: '이슈를 분석하고 해결 방안을 제시하는 에이전트. 이슈 내용을 이해하고 코드베이스를 탐색하여 근본 원인과 수정 방법을 찾습니다.',

  tools: ['Read', 'Glob', 'Grep', 'mcp__github__get_issue', 'mcp__github__add_issue_comment'],

  model: 'sonnet',  // 분석은 sonnet으로 충분

  prompt: `
당신은 GitHub 이슈를 분석하는 전문가입니다.

## 분석 절차

1. 이슈 내용을 꼼꼼히 읽고 문제점 파악
2. 코드베이스를 탐색하여 관련 파일 찾기
3. 근본 원인 분석
4. 구체적인 해결 방안 제시

## 출력 형식

분석 완료 시 다음 JSON 형식으로 결과를 반환하세요:

\`\`\`json
{
  "summary": "이슈 요약 (1-2문장)",
  "suggestedFix": {
    "title": "해결 방안 제목",
    "description": "상세 설명",
    "rootCause": "근본 원인",
    "steps": [
      { "order": 1, "action": "수행할 작업", "detail": "상세 설명", "file": "파일 경로" }
    ],
    "codeChanges": [
      {
        "file": "파일 경로",
        "line": 42,
        "type": "modify",
        "before": "변경 전 코드",
        "after": "변경 후 코드",
        "explanation": "변경 이유"
      }
    ],
    "sideEffects": ["예상 부작용"],
    "testingGuide": "테스트 방법"
  },
  "affectedFiles": [
    { "path": "파일 경로", "changeType": "primary", "reason": "수정 이유" }
  ],
  "difficulty": "easy | medium | hard",
  "estimatedTime": "예상 소요 시간"
}
\`\`\`

## 주의사항

- 추측하지 말고 실제 코드를 확인하세요
- 변경 최소화 원칙: 필요한 부분만 수정
- 기존 코드 스타일 유지
`,
};

/**
 * 이슈 수정 서브에이전트
 */
export const fixerAgentDefinition: AgentDefinition = {
  description: '분석 결과를 바탕으로 실제 코드를 수정하는 에이전트. 파일을 편집하고 테스트를 실행합니다.',

  tools: ['Read', 'Edit', 'Write', 'Glob', 'Grep', 'Bash'],

  model: 'sonnet',

  prompt: `
당신은 코드를 수정하는 전문가입니다.

## 수정 절차

1. 분석 결과의 codeChanges를 순서대로 적용
2. 수정 후 관련 파일 확인
3. 검증 명령어 실행 (테스트, 린트, 타입체크)

## 검증 규칙

1. **테스트**: 통과율 50% 이상 필수
   - 실패 시 최대 3회 재시도
   - 재시도마다 실패 원인 분석 후 수정

2. **린트**: 에러 0개 필수
   - 경고는 허용

3. **타입체크**: 에러 0개 필수

## 검증 실패 시

- 실패 원인 분석
- 코드 수정
- 재검증
- 3회 재시도 후에도 실패 시 상세 로그와 함께 보고

## 주의사항

- 분석 결과에 명시된 부분만 수정
- 추가적인 리팩토링 금지
- 기존 코드 스타일 유지
`,
};
```

### 검증 에이전트

```typescript
// src/agents/verifier.ts

export interface VerificationConfig {
  testCommand: string;        // e.g., "npm test"
  lintCommand: string;        // e.g., "npm run lint"
  typecheckCommand: string;   // e.g., "npm run typecheck"
  testPassThreshold: number;  // 50
  maxRetries: number;         // 3
}

export const verifierPrompt = (config: VerificationConfig) => `
## 검증 수행

다음 명령어를 순서대로 실행하세요:

### 1. 테스트
\`\`\`bash
${config.testCommand}
\`\`\`

**통과 기준**: 전체 테스트 중 ${config.testPassThreshold}% 이상 통과
**재시도**: 실패 시 최대 ${config.maxRetries}회 재시도

### 2. 린트
\`\`\`bash
${config.lintCommand}
\`\`\`

**통과 기준**: 에러 0개 (경고는 허용)

### 3. 타입체크
\`\`\`bash
${config.typecheckCommand}
\`\`\`

**통과 기준**: 에러 0개

## 실패 처리

테스트 실패 시:
1. 실패한 테스트 분석
2. 관련 코드 수정
3. 재실행
4. ${config.maxRetries}회 재시도 후에도 50% 미만이면 중단

린트/타입체크 실패 시:
1. 에러 내용 확인
2. 해당 코드 수정
3. 재실행

## 결과 보고

\`\`\`json
{
  "passed": true | false,
  "test": {
    "total": 100,
    "passed": 95,
    "failed": 5,
    "passRate": 95,
    "retryCount": 1,
    "logs": "..."
  },
  "lint": {
    "passed": true,
    "errorCount": 0,
    "warningCount": 3,
    "logs": "..."
  },
  "typecheck": {
    "passed": true,
    "errorCount": 0,
    "logs": "..."
  }
}
\`\`\`
`;
```

---

## 파일 충돌 감지 & 그룹핑

```typescript
// src/orchestrator/conflict.ts

import { query } from '@anthropic-ai/claude-agent-sdk';
import type { Issue, AffectedFile } from '../types';

export class ConflictDetector {
  /**
   * 이슈들을 분석하여 같은 파일을 수정할 가능성이 있는 이슈들을 그룹핑
   */
  async groupByConflict(issues: Issue[]): Promise<Issue[][]> {
    // 1. 각 이슈의 영향 파일 예측 (빠른 분석)
    const issueFiles = await this.predictAffectedFiles(issues);

    // 2. 파일 기반 그룹핑
    const groups: Issue[][] = [];
    const assigned = new Set<number>();

    for (const issue of issues) {
      if (assigned.has(issue.number)) continue;

      const group = [issue];
      assigned.add(issue.number);

      const files = issueFiles.get(issue.number) || [];

      // 같은 파일을 수정하는 다른 이슈 찾기
      for (const other of issues) {
        if (assigned.has(other.number)) continue;

        const otherFiles = issueFiles.get(other.number) || [];
        const hasConflict = files.some(f => otherFiles.includes(f));

        if (hasConflict) {
          group.push(other);
          assigned.add(other.number);
        }
      }

      groups.push(group);
    }

    return groups;
  }

  /**
   * 이슈 내용을 기반으로 영향받을 파일 예측 (빠른 분석)
   */
  private async predictAffectedFiles(issues: Issue[]): Promise<Map<number, string[]>> {
    const result = new Map<number, string[]>();

    // 병렬로 각 이슈 분석
    const predictions = await Promise.all(
      issues.map(async (issue) => {
        const files = await this.quickAnalyze(issue);
        return { number: issue.number, files };
      })
    );

    for (const { number, files } of predictions) {
      result.set(number, files);
    }

    return result;
  }

  private async quickAnalyze(issue: Issue): Promise<string[]> {
    // 간단한 휴리스틱 또는 빠른 AI 분석으로 영향 파일 예측
    // 실제 구현 시 Claude API로 빠른 분석 수행
    const files: string[] = [];

    // 이슈 내용에서 파일 경로 추출
    const pathRegex = /[\w\-\/]+\.(ts|js|tsx|jsx|py|go|rs|java|cpp|c|h)/g;
    const matches = issue.body?.match(pathRegex) || [];
    files.push(...matches);

    return [...new Set(files)];
  }
}
```

---

## 상태 관리 (재시작 지원)

```typescript
// src/orchestrator/state.ts

import * as fs from 'fs/promises';
import * as path from 'path';
import type { OrchestratorState, SubAgentState, Issue } from '../types';

const STATE_VERSION = '1.0.0';

export class StateManager {
  private statePath: string;

  constructor(projectPath: string) {
    this.statePath = path.join(projectPath, 'state', 'orchestrator-state.json');
  }

  /**
   * 새 상태 생성
   */
  create(params: {
    owner: string;
    repo: string;
    projectPath: string;
    issueGroups: Issue[][];
  }): OrchestratorState {
    const agents: Record<string, SubAgentState> = {};

    for (const group of params.issueGroups) {
      const key = group.map(i => i.number).join('-');
      agents[key] = {
        issueNumbers: group.map(i => i.number),
        status: 'pending',
        retryCount: 0,
      };
    }

    return {
      version: STATE_VERSION,
      startedAt: new Date().toISOString(),
      projectPath: params.projectPath,
      owner: params.owner,
      repo: params.repo,
      agents,
      completedIssues: [],
      rejectedIssues: [],
      errorIssues: [],
    };
  }

  /**
   * 상태 저장
   */
  async save(state: OrchestratorState): Promise<void> {
    const dir = path.dirname(this.statePath);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(this.statePath, JSON.stringify(state, null, 2));
  }

  /**
   * 상태 로드
   */
  async load(): Promise<OrchestratorState | null> {
    try {
      const content = await fs.readFile(this.statePath, 'utf-8');
      const state = JSON.parse(content) as OrchestratorState;

      if (state.version !== STATE_VERSION) {
        console.warn('⚠️ 상태 버전 불일치, 새로 시작합니다.');
        return null;
      }

      return state;
    } catch {
      return null;
    }
  }

  /**
   * 상태 삭제 (완료 시)
   */
  async clear(): Promise<void> {
    try {
      await fs.unlink(this.statePath);
    } catch {
      // 파일 없으면 무시
    }
  }

  /**
   * 서브에이전트 상태 업데이트
   */
  updateAgent(
    state: OrchestratorState,
    key: string,
    update: Partial<SubAgentState>
  ): void {
    if (state.agents[key]) {
      state.agents[key] = { ...state.agents[key], ...update };
    }
  }
}
```

---

## 승인 큐

```typescript
// src/approval/queue.ts

import * as readline from 'readline';
import type { AnalysisResult, SubAgentState } from '../types';

interface ApprovalRequest {
  type: 'fix' | 'close';
  agentKey: string;
  state: SubAgentState;
  analysis?: AnalysisResult;
  resolve: (approved: boolean) => void;
}

export class ApprovalQueue {
  private queue: ApprovalRequest[] = [];
  private processing = false;

  /**
   * 승인 요청을 큐에 추가
   */
  async request(
    type: 'fix' | 'close',
    agentKey: string,
    state: SubAgentState,
    analysis?: AnalysisResult
  ): Promise<boolean> {
    return new Promise(resolve => {
      this.queue.push({ type, agentKey, state, analysis, resolve });
      this.processQueue();
    });
  }

  /**
   * 큐 순차 처리
   */
  private async processQueue(): Promise<void> {
    if (this.processing || this.queue.length === 0) return;

    this.processing = true;

    while (this.queue.length > 0) {
      const request = this.queue.shift()!;

      console.log('\n' + '─'.repeat(60));

      if (request.type === 'fix') {
        this.displayAnalysis(request);
      } else {
        this.displayFixResult(request);
      }

      const approved = await this.askConfirmation(
        request.type === 'fix'
          ? `[${request.agentKey}] 수정을 진행할까요?`
          : `[${request.agentKey}] 이슈를 닫을까요?`
      );

      request.resolve(approved);

      console.log('─'.repeat(60) + '\n');
    }

    this.processing = false;
  }

  private displayAnalysis(request: ApprovalRequest): void {
    const a = request.analysis!;
    console.log(`\n📋 이슈: ${request.state.issueNumbers.map(n => `#${n}`).join(', ')}`);
    console.log(`\n📝 요약: ${a.summary}`);
    console.log(`🔎 원인: ${a.suggestedFix.rootCause}`);
    console.log(`💡 제안: ${a.suggestedFix.title}`);
    console.log(`📊 난이도: ${a.difficulty} | ⏱️ ${a.estimatedTime}`);

    console.log(`\n📄 영향 파일:`);
    for (const file of a.affectedFiles) {
      console.log(`   - ${file.path} (${file.changeType})`);
    }
  }

  private displayFixResult(request: ApprovalRequest): void {
    console.log(`\n✅ 이슈 수정 완료: ${request.state.issueNumbers.map(n => `#${n}`).join(', ')}`);
    console.log(`📄 PR: #${request.state.prNumber}`);
  }

  private async askConfirmation(message: string): Promise<boolean> {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    return new Promise(resolve => {
      rl.question(`${message} (y/n) `, answer => {
        rl.close();
        resolve(answer.toLowerCase() === 'y');
      });
    });
  }
}
```

---

## 이미지 생성 & 관리

```typescript
// src/image/generator.ts

import nodeHtmlToImage from 'node-html-to-image';
import * as fs from 'fs/promises';
import * as path from 'path';
import type { AnalysisResult } from '../types';

export class ImageGenerator {
  private templatePath: string;
  private outputDir: string;

  constructor(projectPath: string) {
    this.templatePath = path.join(__dirname, '../../templates/analysis.html');
    this.outputDir = path.join(projectPath, 'state', 'images');
  }

  /**
   * 분석 결과를 이미지로 생성
   */
  async generate(analysis: AnalysisResult): Promise<string> {
    await fs.mkdir(this.outputDir, { recursive: true });

    const template = await fs.readFile(this.templatePath, 'utf-8');
    const html = this.renderTemplate(template, analysis);

    const filename = `analysis-${analysis.issue.number}-${Date.now()}.png`;
    const outputPath = path.join(this.outputDir, filename);

    await nodeHtmlToImage({
      output: outputPath,
      html,
      puppeteerArgs: {
        args: ['--no-sandbox'],
      },
    });

    return outputPath;
  }

  private renderTemplate(template: string, analysis: AnalysisResult): string {
    // Mustache 스타일 템플릿 렌더링
    return template
      .replace(/\{\{summary\}\}/g, analysis.summary)
      .replace(/\{\{suggestedFix\.title\}\}/g, analysis.suggestedFix.title)
      .replace(/\{\{suggestedFix\.rootCause\}\}/g, analysis.suggestedFix.rootCause)
      .replace(/\{\{suggestedFix\.description\}\}/g, analysis.suggestedFix.description)
      .replace(/\{\{difficulty\}\}/g, analysis.difficulty)
      .replace(/\{\{estimatedTime\}\}/g, analysis.estimatedTime)
      // ... 나머지 필드들
      ;
  }
}

// src/image/cleaner.ts

export class ImageCleaner {
  private outputDir: string;

  constructor(projectPath: string) {
    this.outputDir = path.join(projectPath, 'state', 'images');
  }

  /**
   * 특정 이슈의 이미지 삭제
   */
  async cleanForIssue(issueNumber: number): Promise<void> {
    try {
      const files = await fs.readdir(this.outputDir);
      const targetFiles = files.filter(f => f.includes(`analysis-${issueNumber}-`));

      for (const file of targetFiles) {
        await fs.unlink(path.join(this.outputDir, file));
      }
    } catch {
      // 무시
    }
  }

  /**
   * 모든 이미지 삭제
   */
  async cleanAll(): Promise<void> {
    try {
      await fs.rm(this.outputDir, { recursive: true, force: true });
    } catch {
      // 무시
    }
  }
}
```

---

## CLI 인터페이스

```typescript
// src/index.ts

import { Command } from 'commander';
import { MainOrchestrator } from './orchestrator/main';
import { detectGitHubRepo } from './config';

const program = new Command();

program
  .name('git-issue-agent')
  .description('GitHub 이슈를 자동으로 분석하고 수정하는 에이전트')
  .version('1.0.0');

program
  .command('run')
  .description('열린 이슈들을 병렬로 처리')
  .option('-c, --max-concurrent <number>', '동시 처리 수', '5')
  .option('-l, --labels <labels>', '특정 라벨만 처리 (콤마 구분)')
  .option('-a, --assignee <assignee>', '특정 담당자만 처리')
  .option('-n, --limit <number>', '최대 처리 이슈 수')
  .option('-r, --resume', '이전 상태에서 재시작')
  .option('--test-command <command>', '테스트 명령어', 'npm test')
  .option('--lint-command <command>', '린트 명령어', 'npm run lint')
  .option('--typecheck-command <command>', '타입체크 명령어', 'npm run typecheck')
  .action(async (options) => {
    const { owner, repo } = detectGitHubRepo();

    const orchestrator = new MainOrchestrator({
      owner,
      repo,
      projectPath: process.cwd(),
      maxConcurrent: parseInt(options.maxConcurrent),
      testCommand: options.testCommand,
      lintCommand: options.lintCommand,
      typecheckCommand: options.typecheckCommand,
      testPassThreshold: 50,
      maxTestRetries: 3,
    });

    await orchestrator.run({
      maxConcurrent: parseInt(options.maxConcurrent),
      labels: options.labels?.split(','),
      assignee: options.assignee,
      limit: options.limit ? parseInt(options.limit) : undefined,
      resume: options.resume,
    });
  });

program
  .command('analyze <issue>')
  .description('단일 이슈 분석 (수정 없이)')
  .action(async (issueNumber) => {
    // 단일 이슈 분석 모드
    console.log(`📋 이슈 #${issueNumber} 분석 중...`);
    // TODO: 구현
  });

program
  .command('status')
  .description('현재 진행 상태 확인')
  .action(async () => {
    // 상태 파일 읽어서 표시
    // TODO: 구현
  });

program
  .command('clean')
  .description('상태 파일 및 임시 파일 삭제')
  .action(async () => {
    // 정리
    // TODO: 구현
  });

program.parse();
```

---

## 환경 변수

```bash
# .env.example

# GitHub Personal Access Token (필수)
GITHUB_TOKEN=ghp_xxxxxxxxxxxx

# Anthropic API Key (선택 - Claude Code 인증 없을 때)
ANTHROPIC_API_KEY=sk-ant-xxxxx

# 선택적 설정
MAX_CONCURRENT=5
TEST_PASS_THRESHOLD=50
MAX_TEST_RETRIES=3
```

---

## 의존성

```json
{
  "name": "git-issue-agent",
  "version": "1.0.0",
  "type": "module",
  "main": "dist/index.js",
  "bin": {
    "git-issue-agent": "./dist/index.js"
  },
  "scripts": {
    "build": "tsc",
    "dev": "tsx src/index.ts",
    "lint": "eslint src/",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@anthropic-ai/claude-agent-sdk": "^0.1.76",
    "commander": "^11.0.0",
    "dotenv": "^16.0.0",
    "node-html-to-image": "^4.0.0",
    "chalk": "^5.0.0",
    "ora": "^7.0.0"
  },
  "devDependencies": {
    "@types/node": "^20.0.0",
    "typescript": "^5.0.0",
    "tsx": "^4.0.0",
    "eslint": "^8.0.0",
    "@typescript-eslint/eslint-plugin": "^6.0.0",
    "@typescript-eslint/parser": "^6.0.0"
  }
}
```

---

## 실행 흐름 요약

```
$ git-issue-agent run --max-concurrent 5

📋 열린 이슈 조회 중...
   4개 이슈 발견

🔍 파일 충돌 분석 중...
   3개 그룹으로 분류
   - 그룹 1: #42
   - 그룹 2: #43
   - 그룹 3: #44, #45 (충돌 - 합침)

🚀 에이전트 실행 중...

   [#42] 🔍 분석 중...
   [#43] 🔍 분석 중...
   [#44-45] 🔍 분석 중...
   [#42] 📋 분석 완료

────────────────────────────────────────────────────────────────
📋 이슈: #42
📝 요약: 로그인 버튼 클릭 시 아무 반응이 없는 문제
🔎 원인: onClick 핸들러가 바인딩되지 않음
💡 제안: onClick 핸들러 바인딩 추가
📊 난이도: easy | ⏱️ 10분

📄 영향 파일:
   - src/components/LoginButton.tsx (primary)

[#42] 수정을 진행할까요? (y/n) y
────────────────────────────────────────────────────────────────

   [#42] 🔧 수정 중...
   [#42] 🧪 검증 중... (테스트)
   [#42] ✅ 테스트 통과 (98/100)
   [#42] 🧪 검증 중... (린트)
   [#42] ✅ 린트 통과
   [#42] 🧪 검증 중... (타입체크)
   [#42] ✅ 타입체크 통과
   [#42] 📤 PR 생성 중...

────────────────────────────────────────────────────────────────
✅ 이슈 수정 완료: #42
📄 PR: #101

[#42] 이슈를 닫을까요? (y/n) y
────────────────────────────────────────────────────────────────

   [#42] 🎉 완료!
   [#42] 🗑️ 이미지 삭제

... (다른 이슈들 처리)

════════════════════════════════════════════════════════════════
📊 최종 결과
════════════════════════════════════════════════════════════════
   ✅ 완료: 3개 (#42, #43, #44-45)
   ⏭️  거부: 0개
   ❌ 에러: 0개
════════════════════════════════════════════════════════════════
```

---

## 확장 가능 항목

1. **Slack/Discord 알림**: 승인 요청을 메신저로 전송
2. **GitHub Actions 연동**: 특정 라벨 붙으면 자동 실행
3. **웹 대시보드**: 진행 상황 실시간 모니터링
4. **커스텀 분석 룰**: 프로젝트별 분석 규칙 설정
5. **멀티 레포**: 여러 레포지토리 동시 처리
