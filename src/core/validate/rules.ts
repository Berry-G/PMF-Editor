/**
 * 목적: 검증 규칙 ID 집합과 메타정보. `RULE_IDS` 는 픽스처 파일명과 대조된다.
 * 왜 이 구조인가: 규칙을 추가·삭제하면 이 파일과 픽스처가 함께 바뀌어야 한다.
 *   테스트(`rules-fixtures.test.ts`)가 `RULE_IDS` 와 `docs/fixtures/invalid/*.toon` 의 일치를 검사한다.
 * 바꾸면 안 되는 것: ID 문자열 형식(`V-XX`). 심각도 `by-mode` 는 V-S01 뿐이다 (툴에선 ⚠️, 임포터에선 ❌).
 * 근거: SDD-02 §5 [D-02-06], SDD-08 §4 [D-08-04]
 */
import type { Severity } from './index.js';

export type RuleId =
  | 'V-F01' | 'V-F02' | 'V-F03'
  | 'V-M01' | 'V-M02' | 'V-M03' | 'V-M04' | 'V-M05' | 'V-M06' | 'V-M07' | 'V-M08'
  | 'V-P01' | 'V-P02' | 'V-P03' | 'V-P04' | 'V-P05' | 'V-P06' | 'V-P07' | 'V-P08' | 'V-P09'
  | 'V-S01' | 'V-S02' | 'V-S03' | 'V-S04' | 'V-S05'
  | 'V-B01' | 'V-B02' | 'V-B03';

export interface RuleMeta {
  id: RuleId;
  severity: Severity | 'by-mode';  // 'by-mode' = V-S01: 툴 warning, 임포터 error
  title: string;
}

export const RULE_IDS: readonly RuleId[] = [
  'V-F01', 'V-F02', 'V-F03',
  'V-M01', 'V-M02', 'V-M03', 'V-M04', 'V-M05', 'V-M06', 'V-M07', 'V-M08',
  'V-P01', 'V-P02', 'V-P03', 'V-P04', 'V-P05', 'V-P06', 'V-P07', 'V-P08', 'V-P09',
  'V-S01', 'V-S02', 'V-S03', 'V-S04', 'V-S05',
  'V-B01', 'V-B02', 'V-B03',
];

export const RULES: readonly RuleMeta[] = [
  { id: 'V-F01', severity: 'error', title: '스키마 버전 불일치' },
  { id: 'V-F02', severity: 'error', title: '파일명 오류' },
  { id: 'V-F03', severity: 'error', title: '필드 누락 또는 타입 불일치' },
  { id: 'V-M01', severity: 'error', title: '맵 행 수 불일치' },
  { id: 'V-M02', severity: 'error', title: '알 수 없는 문자' },
  { id: 'V-M03', severity: 'error', title: '마을 없음' },
  { id: 'V-M04', severity: 'error', title: '배치 칸 없음' },
  { id: 'V-M05', severity: 'warning', title: '도로 분할' },
  { id: 'V-M06', severity: 'warning', title: '도달 불가 배치 칸 과다' },
  { id: 'V-M07', severity: 'error', title: '고립된 마을' },
  { id: 'V-M08', severity: 'error', title: '맵 크기 범위' },
  { id: 'V-P01', severity: 'error', title: '없는 노드 참조' },
  { id: 'V-P02', severity: 'error', title: 'start/exit 개수' },
  { id: 'V-P03', severity: 'error', title: '도로 위반' },
  { id: 'V-P04', severity: 'error', title: '지름길 권한 오류' },
  { id: 'V-P05', severity: 'error', title: '경로 없음' },
  { id: 'V-P06', severity: 'warning', title: '무의미한 트리거' },
  { id: 'V-P07', severity: 'error', title: '노드 위치 오류' },
  { id: 'V-P08', severity: 'error', title: '엣지 중복' },
  { id: 'V-P09', severity: 'error', title: 'ID 형식 위반 또는 중복' },
  { id: 'V-S01', severity: 'by-mode', title: '알 수 없는 적' },
  { id: 'V-S02', severity: 'error', title: '스폰 표 이상' },
  { id: 'V-S03', severity: 'error', title: '수치 범위 위반' },
  { id: 'V-S04', severity: 'error', title: '난이도 표 오류' },
  { id: 'V-S05', severity: 'error', title: '체력 곡선 오류' },
  { id: 'V-B01', severity: 'error', title: '모체 속도 초과' },
  { id: 'V-B02', severity: 'warning', title: '트리거 중복' },
  { id: 'V-B03', severity: 'warning', title: '버스트 약함' },
];