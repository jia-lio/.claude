import * as fs from 'fs/promises';
import * as path from 'path';
import type { OrchestratorState, SubAgentState, Issue } from '../types/index.js';

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
      const key = group.map((i) => i.number).join('-');
      agents[key] = {
        issueNumbers: group.map((i) => i.number),
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
   * 상태 존재 여부 확인
   */
  async exists(): Promise<boolean> {
    try {
      await fs.access(this.statePath);
      return true;
    } catch {
      return false;
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

  /**
   * 이슈 완료 처리
   */
  markCompleted(state: OrchestratorState, issueNumbers: number[]): void {
    state.completedIssues.push(...issueNumbers);
  }

  /**
   * 이슈 거부 처리
   */
  markRejected(state: OrchestratorState, issueNumbers: number[]): void {
    state.rejectedIssues.push(...issueNumbers);
  }

  /**
   * 이슈 에러 처리
   */
  markError(state: OrchestratorState, issueNumbers: number[]): void {
    state.errorIssues.push(...issueNumbers);
  }
}
