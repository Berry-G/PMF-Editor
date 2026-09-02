# fixtures — 툴(TS)과 임포터(C#)가 공유하는 검증 픽스처

규약 정본: `../SDD-06-검증과-테스트.md` §3. 규칙 정본: `../SDD-02-데이터모델.md` §5.

## 규칙

1. **`invalid/<규칙ID>.toon`** — 파일명이 규칙 ID 다. `valid/minimal.toon` 에서 **딱 하나만** 어긋나게 만든다.
2. 테스트는 "이 파일이 정확히 그 ID 를 내고, 다른 ❌ 는 내지 않는다" 를 확인한다.
3. 규칙을 추가·삭제·개명하면 픽스처도 같은 커밋에서. `core/validate/rules.ts` 의 ID 목록과 이 폴더의 파일명 집합이 같은지 테스트가 검사한다.
4. `valid/Stage_Greybox.toon` 은 두지 않는다 — `../examples/Stage_Greybox.toon` 을 직접 읽는다 (사본이 생기면 어긋난다).
5. 게임 프로젝트는 **사본** 을 갖는다 (`Assets/_Project/Scripts/Tests/Authoring/Fixtures/`). 갱신은 `npm run sync:fixtures` 로만. `fixtures-sync.test.ts` 가 어긋남을 잡는다.

## 파일 목록 (M1 에서 채운다)

```
valid/minimal.toon
invalid/V-F01.toon V-F02.toon V-F03.toon
invalid/V-M01.toon … V-M08.toon
invalid/V-P01.toon … V-P09.toon
invalid/V-S01.toon … V-S05.toon
invalid/V-B01.toon V-B02.toon V-B03.toon
```
