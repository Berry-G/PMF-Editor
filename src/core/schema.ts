/**
 * 목적: 파일 포맷의 스키마 식별자 한 곳. `.toon` 첫머리의 `schema:` 값과 같아야 한다.
 * 왜 이 구조인가: 코덱·검증기·게이트 테스트가 모두 이 상수를 본다. 상수가 여러 곳에 흩어지면
 *   버전을 올릴 때 하나가 남아 옛 파일을 조용히 받아들인다.
 * 바꾸면 안 되는 것: 값을 올리면 `docs/SDD-02 §4·§5` → 씨앗 재생성 → 픽스처 → ADR 한 장이
 *   같은 커밋에 따라와야 한다. `schema-version.test.ts` 가 씨앗·픽스처와의 일치를 검사한다.
 * 근거: SDD-02 §7 [D-02-09], SDD-08 §3 [D-08-03]
 */

export const SCHEMA = 'pmf.stage/1' as const;
export type Schema = typeof SCHEMA;
