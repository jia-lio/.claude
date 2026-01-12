import * as readline from 'readline';
import chalk from 'chalk';
import type { AnalysisResult, SubAgentState, ApprovalRequest } from '../types/index.js';

export class ApprovalQueue {
  private queue: ApprovalRequest[] = [];
  private processing = false;

  /**
   * 분석 결과 승인 요청
   */
  async requestFixApproval(
    agentKey: string,
    state: SubAgentState,
    analysis: AnalysisResult
  ): Promise<boolean> {
    return new Promise((resolve) => {
      this.queue.push({
        type: 'fix',
        agentKey,
        state,
        analysis,
        resolve,
      });
      this.processQueue();
    });
  }

  /**
   * 이슈 닫기 승인 요청
   */
  async requestCloseApproval(
    agentKey: string,
    state: SubAgentState
  ): Promise<boolean> {
    return new Promise((resolve) => {
      this.queue.push({
        type: 'close',
        agentKey,
        state,
        resolve,
      });
      this.processQueue();
    });
  }

  /**
   * 도구 사용 승인 요청 (MCP 도구용)
   */
  async requestToolApproval(
    toolName: string,
    input: Record<string, unknown>
  ): Promise<boolean> {
    console.log('\n' + '─'.repeat(60));
    console.log(chalk.yellow(`🔧 도구 승인 요청: ${toolName}`));
    console.log(chalk.gray(JSON.stringify(input, null, 2)));

    const approved = await this.askConfirmation(
      `이 작업을 허용할까요?`
    );

    console.log('─'.repeat(60) + '\n');
    return approved;
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

  /**
   * 분석 결과 표시
   */
  private displayAnalysis(request: ApprovalRequest): void {
    const a = request.analysis!;
    const issueNumbers = request.state.issueNumbers
      .map((n) => `#${n}`)
      .join(', ');

    console.log(chalk.bold(`\n📋 이슈: ${issueNumbers}`));
    console.log(chalk.cyan(`\n📝 요약: ${a.summary}`));
    console.log(chalk.yellow(`🔎 원인: ${a.suggestedFix.rootCause}`));
    console.log(chalk.green(`💡 제안: ${a.suggestedFix.title}`));

    const difficultyColor =
      a.difficulty === 'easy'
        ? chalk.green
        : a.difficulty === 'medium'
          ? chalk.yellow
          : chalk.red;
    console.log(
      `📊 난이도: ${difficultyColor(a.difficulty)} | ⏱️ ${a.estimatedTime}`
    );

    console.log(chalk.blue(`\n📄 영향 파일:`));
    for (const file of a.affectedFiles) {
      const typeColor =
        file.changeType === 'primary' ? chalk.red : chalk.gray;
      console.log(`   - ${file.path} ${typeColor(`(${file.changeType})`)}`);
    }

    if (a.suggestedFix.sideEffects && a.suggestedFix.sideEffects.length > 0) {
      console.log(chalk.yellow(`\n⚠️ 예상 부작용:`));
      for (const effect of a.suggestedFix.sideEffects) {
        console.log(`   - ${effect}`);
      }
    }

    console.log('');
  }

  /**
   * 수정 결과 표시
   */
  private displayFixResult(request: ApprovalRequest): void {
    const issueNumbers = request.state.issueNumbers
      .map((n) => `#${n}`)
      .join(', ');

    console.log(chalk.green(`\n✅ 이슈 수정 완료: ${issueNumbers}`));

    if (request.state.prNumber) {
      console.log(chalk.blue(`📄 PR: #${request.state.prNumber}`));
    }

    console.log('');
  }

  /**
   * 사용자 확인 요청
   */
  private async askConfirmation(message: string): Promise<boolean> {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    return new Promise((resolve) => {
      rl.question(
        chalk.bold(`${message} (y/n) `),
        (answer) => {
          rl.close();
          const normalized = answer.toLowerCase().trim();
          resolve(normalized === 'y' || normalized === 'yes');
        }
      );
    });
  }

  /**
   * 대기 중인 승인 요청 수
   */
  get pendingCount(): number {
    return this.queue.length;
  }

  /**
   * 처리 중 여부
   */
  get isProcessing(): boolean {
    return this.processing;
  }
}
