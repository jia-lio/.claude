/**
 * 검증 설정 및 프롬프트 생성
 */

export interface VerificationConfig {
  testCommand: string;
  lintCommand: string;
  typecheckCommand: string;
  testPassThreshold: number;
  maxRetries: number;
}

/**
 * 검증 프롬프트 생성
 */
export function createVerifierPrompt(config: VerificationConfig): string {
  return `
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
4. ${config.maxRetries}회 재시도 후에도 ${config.testPassThreshold}% 미만이면 중단

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
}

/**
 * 기본 검증 설정
 */
export const DEFAULT_VERIFICATION_CONFIG: VerificationConfig = {
  testCommand: 'npm test',
  lintCommand: 'npm run lint',
  typecheckCommand: 'npm run typecheck',
  testPassThreshold: 50,
  maxRetries: 3,
};
