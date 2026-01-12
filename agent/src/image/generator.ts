import nodeHtmlToImage from 'node-html-to-image';
import * as fs from 'fs/promises';
import * as path from 'path';
import { fileURLToPath } from 'url';
import type { AnalysisResult } from '../types/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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

    const template = await this.loadTemplate();
    const html = this.renderTemplate(template, analysis);

    const filename = `analysis-${analysis.issue.number}-${Date.now()}.png`;
    const outputPath = path.join(this.outputDir, filename);

    await nodeHtmlToImage({
      output: outputPath,
      html,
      puppeteerArgs: {
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
      },
    });

    return outputPath;
  }

  /**
   * 템플릿 로드
   */
  private async loadTemplate(): Promise<string> {
    try {
      return await fs.readFile(this.templatePath, 'utf-8');
    } catch {
      // 템플릿 파일이 없으면 기본 템플릿 사용
      return this.getDefaultTemplate();
    }
  }

  /**
   * 템플릿 렌더링
   */
  private renderTemplate(template: string, analysis: AnalysisResult): string {
    const escapeHtml = (str: string) =>
      str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');

    const difficultyClass = analysis.difficulty;
    const difficultyKo =
      analysis.difficulty === 'easy'
        ? '쉬움'
        : analysis.difficulty === 'medium'
          ? '보통'
          : '어려움';

    // 코드 변경 사항 HTML 생성
    const codeChangesHtml = analysis.suggestedFix.codeChanges
      .map(
        (change) => `
        <div class="change-block">
          <div class="change-header">
            <span class="change-type ${change.type}">[${change.type}]</span>
            <span class="file-path">${escapeHtml(change.file)}</span>
            ${change.line ? `<span class="line-number">Line ${change.line}</span>` : ''}
          </div>
          <div class="code-diff">
            ${change.before ? `<div class="diff-remove">- ${escapeHtml(change.before)}</div>` : ''}
            <div class="diff-add">+ ${escapeHtml(change.after)}</div>
          </div>
          <p class="explanation">${escapeHtml(change.explanation)}</p>
        </div>
      `
      )
      .join('');

    // 영향 파일 HTML 생성
    const affectedFilesHtml = analysis.affectedFiles
      .map(
        (file) => `
        <li>
          <span class="file-type ${file.changeType}">${file.changeType}</span>
          <code>${escapeHtml(file.path)}</code>
          <span class="reason">${escapeHtml(file.reason)}</span>
        </li>
      `
      )
      .join('');

    // 수정 단계 HTML 생성
    const stepsHtml = analysis.suggestedFix.steps
      .map(
        (step) => `
        <li>
          <strong>${escapeHtml(step.action)}</strong>
          <p>${escapeHtml(step.detail)}</p>
          ${step.file ? `<code>📄 ${escapeHtml(step.file)}</code>` : ''}
        </li>
      `
      )
      .join('');

    return template
      .replace(/\{\{issueNumber\}\}/g, String(analysis.issue.number))
      .replace(/\{\{issueTitle\}\}/g, escapeHtml(analysis.issue.title))
      .replace(/\{\{summary\}\}/g, escapeHtml(analysis.summary))
      .replace(
        /\{\{suggestedFix\.title\}\}/g,
        escapeHtml(analysis.suggestedFix.title)
      )
      .replace(
        /\{\{suggestedFix\.rootCause\}\}/g,
        escapeHtml(analysis.suggestedFix.rootCause)
      )
      .replace(
        /\{\{suggestedFix\.description\}\}/g,
        escapeHtml(analysis.suggestedFix.description)
      )
      .replace(/\{\{difficulty\}\}/g, difficultyKo)
      .replace(/\{\{difficultyClass\}\}/g, difficultyClass)
      .replace(/\{\{estimatedTime\}\}/g, escapeHtml(analysis.estimatedTime))
      .replace(/\{\{codeChanges\}\}/g, codeChangesHtml)
      .replace(/\{\{affectedFiles\}\}/g, affectedFilesHtml)
      .replace(/\{\{steps\}\}/g, stepsHtml)
      .replace(
        /\{\{testingGuide\}\}/g,
        escapeHtml(analysis.suggestedFix.testingGuide)
      );
  }

  /**
   * 기본 템플릿
   */
  private getDefaultTemplate(): string {
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #1a1a2e;
      color: #eee;
      padding: 24px;
      width: 800px;
    }
    .analysis-card {
      background: #16213e;
      border-radius: 12px;
      padding: 24px;
    }
    h1 {
      font-size: 20px;
      margin-bottom: 20px;
      color: #fff;
    }
    h2 {
      font-size: 16px;
      margin: 16px 0 8px 0;
      color: #4fc3f7;
    }
    h3 {
      font-size: 14px;
      margin: 12px 0 6px 0;
      color: #81d4fa;
    }
    p {
      font-size: 14px;
      line-height: 1.6;
      margin-bottom: 8px;
    }
    section {
      margin-bottom: 16px;
    }
    .change-block {
      background: #0d0d1a;
      border-radius: 8px;
      padding: 12px;
      margin: 8px 0;
    }
    .change-header {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 8px;
    }
    .change-type {
      font-size: 12px;
      font-weight: bold;
      padding: 2px 6px;
      border-radius: 4px;
    }
    .change-type.add { background: #1b5e20; color: #a5d6a7; }
    .change-type.modify { background: #e65100; color: #ffcc80; }
    .change-type.delete { background: #b71c1c; color: #ef9a9a; }
    .file-path {
      font-family: monospace;
      font-size: 12px;
      color: #90caf9;
    }
    .line-number {
      font-size: 11px;
      color: #757575;
    }
    .code-diff {
      font-family: monospace;
      font-size: 12px;
      margin: 8px 0;
    }
    .diff-remove {
      color: #ef5350;
      background: rgba(239, 83, 80, 0.1);
      padding: 2px 4px;
    }
    .diff-add {
      color: #66bb6a;
      background: rgba(102, 187, 106, 0.1);
      padding: 2px 4px;
    }
    .explanation {
      font-size: 12px;
      color: #9e9e9e;
      font-style: italic;
    }
    ul {
      list-style: none;
      padding-left: 0;
    }
    li {
      font-size: 13px;
      margin: 6px 0;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .file-type {
      font-size: 11px;
      padding: 2px 6px;
      border-radius: 4px;
    }
    .file-type.primary { background: #e65100; color: #fff; }
    .file-type.secondary { background: #424242; color: #bdbdbd; }
    code {
      font-family: monospace;
      font-size: 12px;
      background: #0d0d1a;
      padding: 2px 6px;
      border-radius: 4px;
    }
    .reason {
      font-size: 11px;
      color: #9e9e9e;
    }
    .meta {
      display: flex;
      gap: 16px;
      margin-top: 16px;
      padding-top: 16px;
      border-top: 1px solid #333;
    }
    .difficulty {
      font-size: 12px;
      padding: 4px 12px;
      border-radius: 16px;
      font-weight: bold;
    }
    .difficulty.easy { background: #1b5e20; color: #a5d6a7; }
    .difficulty.medium { background: #e65100; color: #ffcc80; }
    .difficulty.hard { background: #b71c1c; color: #ef9a9a; }
    .time {
      font-size: 12px;
      color: #9e9e9e;
    }
    ol {
      padding-left: 20px;
    }
    ol li {
      display: block;
      margin: 8px 0;
    }
    ol li strong {
      color: #4fc3f7;
    }
    ol li p {
      font-size: 12px;
      color: #bdbdbd;
      margin: 4px 0;
    }
  </style>
</head>
<body>
  <div class="analysis-card">
    <h1>🔍 이슈 #{{issueNumber}} 분석 결과</h1>

    <section class="summary">
      <h2>📝 요약</h2>
      <p>{{summary}}</p>
    </section>

    <section class="root-cause">
      <h2>🔎 근본 원인</h2>
      <p>{{suggestedFix.rootCause}}</p>
    </section>

    <section class="solution">
      <h2>💡 제안: {{suggestedFix.title}}</h2>
      <p>{{suggestedFix.description}}</p>

      <h3>📋 수정 단계</h3>
      <ol>
        {{steps}}
      </ol>
    </section>

    <section class="code-changes">
      <h2>📄 코드 변경 사항</h2>
      {{codeChanges}}
    </section>

    <section class="files">
      <h2>📁 영향받는 파일</h2>
      <ul>
        {{affectedFiles}}
      </ul>
    </section>

    <section class="testing">
      <h2>🧪 테스트 방법</h2>
      <p>{{testingGuide}}</p>
    </section>

    <div class="meta">
      <span class="difficulty {{difficultyClass}}">난이도: {{difficulty}}</span>
      <span class="time">⏱️ {{estimatedTime}}</span>
    </div>
  </div>
</body>
</html>
    `;
  }
}
