# ADR-E10. 저작 파이프라인 — C# ToonWriter + ToonExporter

- **날짜:** 2026-09-05
- **상태:** ✅ 확정

## 결정

에디터 레포의 `.toon` 출력 로직(encode.ts, formatNumber.ts, quote.ts)을 게임 프로젝트의 C#으로 포팅한다.

| 파일 | 담당 |
|---|---|
| `ToonWriter.cs` | StageDocument → .toon 문자열. encode.ts + number.ts + quote.ts 의 C# 포팅 |
| `ToonExporter.cs` | Stage_Greybox.asset + GreyboxMapData → ToonWriter 호출 |
| `StageDocument.cs` | C# struct — TS StageDocument 와 같은 필드 |

## 이유

1. **바이트 동일 보장** — 같은 입력이 같은 출력을 내는지 C# 포팅과 TS 구현의 왕복으로 검증한다.
2. **게임이 진실 공급원** — `.asset` 값(GreyboxFactory 가 아닌 실측)을 .toon 으로 내보내려면 게임 프로젝트에서 읽어야 한다.
3. **왕복 증명** — 익스포터 출력과 씨앗 파일이 정확히 일치해야 임포터(ToonReader)가 의미가 있다.

## 설계 정본

에디터 레포 `docs/SDD-05-저작파이프라인.md` 가 이 결정의 전체 설계다. C# 구현은 그 사양을 따른다.