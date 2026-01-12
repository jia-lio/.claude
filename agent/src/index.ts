#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';

import { MainOrchestrator } from './orchestrator/main.js';
import { StateManager } from './orchestrator/state.js';
import { ImageCleaner } from './image/cleaner.js';
import {
  detectGitHubRepo,
  validateGitHubToken,
  loadEnvConfig,
  DEFAULT_CONFIG,
} from './config.js';

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
  .option('--test-command <command>', '테스트 명령어', DEFAULT_CONFIG.testCommand)
  .option('--lint-command <command>', '린트 명령어', DEFAULT_CONFIG.lintCommand)
  .option(
    '--typecheck-command <command>',
    '타입체크 명령어',
    DEFAULT_CONFIG.typecheckCommand
  )
  .option(
    '--test-threshold <number>',
    '테스트 통과 임계값 (%)',
    String(DEFAULT_CONFIG.testPassThreshold)
  )
  .option(
    '--max-retries <number>',
    '최대 재시도 횟수',
    String(DEFAULT_CONFIG.maxTestRetries)
  )
  .action(async (options) => {
    try {
      // GitHub 토큰 검증
      validateGitHubToken();

      // Git 저장소 감지
      const spinner = ora('Git 저장소 감지 중...').start();
      const { owner, repo } = detectGitHubRepo();
      spinner.succeed(`저장소: ${chalk.cyan(`${owner}/${repo}`)}`);

      const envConfig = loadEnvConfig();

      const orchestrator = new MainOrchestrator({
        owner,
        repo,
        projectPath: process.cwd(),
        maxConcurrent: parseInt(options.maxConcurrent, 10),
        testCommand: options.testCommand,
        lintCommand: options.lintCommand,
        typecheckCommand: options.typecheckCommand,
        testPassThreshold: parseInt(options.testThreshold, 10),
        maxTestRetries: parseInt(options.maxRetries, 10),
      });

      await orchestrator.run({
        maxConcurrent: parseInt(options.maxConcurrent, 10),
        labels: options.labels?.split(','),
        assignee: options.assignee,
        limit: options.limit ? parseInt(options.limit, 10) : undefined,
        resume: options.resume,
      });
    } catch (error) {
      console.error(chalk.red('\n❌ 오류:'), (error as Error).message);
      process.exit(1);
    }
  });

program
  .command('analyze <issue>')
  .description('단일 이슈 분석 (수정 없이)')
  .action(async (issueNumber) => {
    try {
      validateGitHubToken();

      const { owner, repo } = detectGitHubRepo();

      console.log(chalk.blue(`📋 이슈 #${issueNumber} 분석 중...`));
      console.log(chalk.gray(`   저장소: ${owner}/${repo}`));
      console.log(chalk.yellow('\n⚠️ 단일 이슈 분석은 아직 구현되지 않았습니다.'));
      console.log(
        chalk.gray('   "git-issue-agent run" 명령어를 사용해주세요.\n')
      );
    } catch (error) {
      console.error(chalk.red('\n❌ 오류:'), (error as Error).message);
      process.exit(1);
    }
  });

program
  .command('status')
  .description('현재 진행 상태 확인')
  .action(async () => {
    try {
      const stateManager = new StateManager(process.cwd());
      const state = await stateManager.load();

      if (!state) {
        console.log(chalk.yellow('📋 저장된 상태가 없습니다.'));
        return;
      }

      console.log(chalk.bold('\n📊 현재 상태'));
      console.log('═'.repeat(50));
      console.log(`시작 시간: ${state.startedAt}`);
      console.log(`저장소: ${state.owner}/${state.repo}`);
      console.log('');

      console.log(chalk.blue('에이전트 상태:'));
      for (const [key, agent] of Object.entries(state.agents)) {
        const statusColor =
          agent.status === 'done'
            ? chalk.green
            : agent.status === 'error'
              ? chalk.red
              : agent.status === 'rejected'
                ? chalk.yellow
                : chalk.cyan;

        console.log(
          `   ${key}: ${statusColor(agent.status)}${
            agent.prNumber ? ` (PR #${agent.prNumber})` : ''
          }`
        );
      }

      console.log('');
      console.log(chalk.green(`✅ 완료: ${state.completedIssues.length}개`));
      console.log(chalk.yellow(`⏭️  거부: ${state.rejectedIssues.length}개`));
      console.log(chalk.red(`❌ 에러: ${state.errorIssues.length}개`));
      console.log('═'.repeat(50) + '\n');
    } catch (error) {
      console.error(chalk.red('\n❌ 오류:'), (error as Error).message);
      process.exit(1);
    }
  });

program
  .command('clean')
  .description('상태 파일 및 임시 파일 삭제')
  .option('-f, --force', '확인 없이 삭제')
  .action(async (options) => {
    try {
      const stateManager = new StateManager(process.cwd());
      const imageCleaner = new ImageCleaner(process.cwd());

      if (!options.force) {
        const hasState = await stateManager.exists();
        const hasImages = await imageCleaner.exists();

        if (!hasState && !hasImages) {
          console.log(chalk.yellow('📋 삭제할 파일이 없습니다.'));
          return;
        }

        console.log(chalk.yellow('⚠️ 다음 파일들이 삭제됩니다:'));
        if (hasState) console.log('   - 상태 파일 (state/orchestrator-state.json)');
        if (hasImages) console.log('   - 분석 이미지 (state/images/)');

        // 간단한 확인 (실제로는 readline으로 구현)
        console.log(chalk.gray('\n--force 옵션으로 확인 없이 삭제할 수 있습니다.'));
        return;
      }

      const spinner = ora('파일 삭제 중...').start();

      await stateManager.clear();
      await imageCleaner.cleanAll();

      spinner.succeed('모든 임시 파일이 삭제되었습니다.');
    } catch (error) {
      console.error(chalk.red('\n❌ 오류:'), (error as Error).message);
      process.exit(1);
    }
  });

program
  .command('config')
  .description('설정 확인')
  .action(() => {
    try {
      const envConfig = loadEnvConfig();

      console.log(chalk.bold('\n⚙️ 현재 설정'));
      console.log('═'.repeat(50));
      console.log(
        `GitHub Token: ${envConfig.githubToken ? chalk.green('설정됨') : chalk.red('미설정')}`
      );
      console.log(
        `Anthropic API Key: ${
          envConfig.anthropicApiKey ? chalk.green('설정됨') : chalk.yellow('미설정 (선택)')
        }`
      );
      console.log(`동시 처리 수: ${envConfig.maxConcurrent}`);
      console.log(`테스트 통과 임계값: ${envConfig.testPassThreshold}%`);
      console.log(`최대 재시도 횟수: ${envConfig.maxTestRetries}`);
      console.log('═'.repeat(50) + '\n');
    } catch (error) {
      console.error(chalk.red('\n❌ 오류:'), (error as Error).message);
      process.exit(1);
    }
  });

// 헬프 메시지 커스터마이징
program.addHelpText(
  'after',
  `
${chalk.bold('예시:')}
  $ git-issue-agent run                     # 모든 열린 이슈 처리
  $ git-issue-agent run --labels bug        # 'bug' 라벨 이슈만 처리
  $ git-issue-agent run --max-concurrent 3  # 동시에 3개 이슈 처리
  $ git-issue-agent run --resume            # 이전 상태에서 재시작
  $ git-issue-agent status                  # 현재 진행 상태 확인
  $ git-issue-agent clean --force           # 임시 파일 삭제

${chalk.bold('필수 환경 변수:')}
  GITHUB_TOKEN    GitHub Personal Access Token

${chalk.bold('더 많은 정보:')}
  https://github.com/your-repo/git-issue-agent
`
);

program.parse();
