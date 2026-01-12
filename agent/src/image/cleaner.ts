import * as fs from 'fs/promises';
import * as path from 'path';

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
      const targetFiles = files.filter((f) =>
        f.includes(`analysis-${issueNumber}-`)
      );

      for (const file of targetFiles) {
        await fs.unlink(path.join(this.outputDir, file));
      }

      if (targetFiles.length > 0) {
        console.log(`   🗑️ 이슈 #${issueNumber} 이미지 삭제됨`);
      }
    } catch {
      // 폴더가 없거나 파일이 없으면 무시
    }
  }

  /**
   * 여러 이슈의 이미지 삭제
   */
  async cleanForIssues(issueNumbers: number[]): Promise<void> {
    for (const issueNumber of issueNumbers) {
      await this.cleanForIssue(issueNumber);
    }
  }

  /**
   * 모든 이미지 삭제
   */
  async cleanAll(): Promise<void> {
    try {
      await fs.rm(this.outputDir, { recursive: true, force: true });
      console.log('   🗑️ 모든 분석 이미지 삭제됨');
    } catch {
      // 폴더가 없으면 무시
    }
  }

  /**
   * 이미지 디렉토리 존재 확인
   */
  async exists(): Promise<boolean> {
    try {
      await fs.access(this.outputDir);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * 이미지 파일 목록 조회
   */
  async listImages(): Promise<string[]> {
    try {
      const files = await fs.readdir(this.outputDir);
      return files.filter((f) => f.endsWith('.png'));
    } catch {
      return [];
    }
  }
}
