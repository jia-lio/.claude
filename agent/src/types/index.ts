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
  issueNumbers: number[];
  status: SubAgentStatus;
  sessionId?: string;
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
  passRate: number;
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
  agents: Record<string, SubAgentState>;
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
  testPassThreshold: number;
  maxTestRetries: number;
}

export interface RunOptions {
  maxConcurrent?: number;
  labels?: string[];
  assignee?: string;
  limit?: number;
  resume?: boolean;
}

// ═══════════════════════════════════════════════════════════
// 승인 요청
// ═══════════════════════════════════════════════════════════

export interface ApprovalRequest {
  type: 'fix' | 'close';
  agentKey: string;
  state: SubAgentState;
  analysis?: AnalysisResult;
  resolve: (approved: boolean) => void;
}
