import type { Issue } from '../types/index.js';

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
        const hasConflict = files.some((f) => otherFiles.includes(f));

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
  private async predictAffectedFiles(
    issues: Issue[]
  ): Promise<Map<number, string[]>> {
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

  /**
   * 이슈 내용에서 파일 경로를 휴리스틱하게 추출
   */
  private async quickAnalyze(issue: Issue): Promise<string[]> {
    const files: string[] = [];
    const content = `${issue.title} ${issue.body || ''}`;

    // 파일 경로 패턴 추출
    const pathPatterns = [
      // 일반적인 파일 경로
      /[\w\-./]+\.(ts|js|tsx|jsx|py|go|rs|java|cpp|c|h|css|scss|html|json|yml|yaml|md)/gi,
      // src/ 또는 lib/ 로 시작하는 경로
      /(?:src|lib|app|pages|components|utils|services)\/[\w\-./]+/gi,
    ];

    for (const pattern of pathPatterns) {
      const matches = content.match(pattern) || [];
      files.push(...matches);
    }

    // 중복 제거 및 정규화
    return [...new Set(files.map((f) => f.toLowerCase()))];
  }

  /**
   * 그룹 정보를 사람이 읽기 쉬운 형식으로 출력
   */
  formatGroups(groups: Issue[][]): string {
    return groups
      .map((group, i) => {
        const issueList = group.map((issue) => `#${issue.number}`).join(', ');
        const suffix =
          group.length > 1 ? ' (충돌 가능성 - 함께 처리)' : '';
        return `   그룹 ${i + 1}: ${issueList}${suffix}`;
      })
      .join('\n');
  }
}
