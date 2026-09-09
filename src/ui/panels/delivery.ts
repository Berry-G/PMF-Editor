/**
 * 목적: 저장·복사 직전 최신 검증, 파일명 정규화, Unity 전달 요약을 한 경계에서 만든다.
 * 왜 이 구조인가: 저장·다른 이름 저장·복사가 서로 다른 검증 결과와 헤더를 내면 작업본과 전달본을 구분할 수 없다.
 * 바꾸면 안 되는 것: 현재 doc 을 동기 validate 할 것. 오류가 있어도 결과 생성을 막지 말 것.
 * 근거: SDD-03 §9 [D-03-09], SDD-09 §11 [D-09-11], ADR-E08, ADR-E13
 */
import type { StageDocument } from '../../core/model/stage.js';
import { Cell } from '../../core/model/cell.js';
import { encodeForDelivery } from '../../core/toon/encode.js';
import { validate, type Issue } from '../../core/validate/index.js';
import type { EnemyCatalogEntry } from '../../core/sim/params.js';

export interface DeliverySummary {
  internalName: string;
  fileName: string;
  unityAssets: readonly string[];
  villageCount: number;
  burstTriggerCount: number;
  errorCount: number;
  warningCount: number;
  infoCount: number;
}

export interface PreparedDelivery {
  doc: StageDocument;
  text: string;
  issues: Issue[];
  summary: DeliverySummary;
}

export function toonFileName(candidate: string, internalName: string): string {
  const trimmed = candidate.trim();
  const base = trimmed === '' ? internalName.trim() || 'untitled' : trimmed;
  // 왜: 열기로 얻은 fileName 은 이미 .toon 을 포함한다. 저장할 때마다 확장자가 늘어나면 안 된다.
  return base.replace(/(?:\.toon)+$/i, '') + '.toon';
}

export function prepareDelivery(
  doc: StageDocument,
  catalog: readonly EnemyCatalogEntry[],
  fileName: string,
  toolVersion: string,
): PreparedDelivery {
  // 왜: Store 의 issues 는 100ms 디바운스라 마지막 편집 직후에는 이전 문서를 가리킬 수 있다.
  const issues = validate(doc, { mode: 'tool', enemyCatalog: new Set(catalog.map(c => c.name)) });
  let villageCount = 0;
  for (const cell of doc.map.cells) if (cell === Cell.VillageSlot) villageCount++;
  const summary: DeliverySummary = {
    internalName: doc.name,
    fileName: toonFileName(fileName, doc.name),
    unityAssets: [doc.name + '.map.asset', doc.name + '.path.asset', doc.name + '.asset'],
    villageCount,
    burstTriggerCount: doc.burst.triggerNodeIds.length,
    errorCount: issues.filter(i => i.severity === 'error').length,
    warningCount: issues.filter(i => i.severity === 'warning').length,
    infoCount: issues.filter(i => i.severity === 'info').length,
  };
  return { doc, text: encodeForDelivery(doc, { toolVersion, issues }), issues, summary };
}
