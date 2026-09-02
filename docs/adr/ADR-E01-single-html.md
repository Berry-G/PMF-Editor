# ADR-E01. 툴은 TypeScript + Vite 로 만들고 **단일 HTML 파일** 로 배포한다

- 상태: 채택 · 2026-09-03 · 사용자 확정
- 관련: SDD-01 §1, §9

## 결정

개발은 TypeScript(strict) + Vite + vitest 로 하고, `vite-plugin-singlefile` 로 **`dist/pmf-editor.html` 파일 하나** 를 산출한다.
웹에 올리지 않는다. 설치형(Tauri/Electron/.NET)으로 만들지 않는다.

## 이유

| 후보 | 왜 아닌가 |
|---|---|
| Tauri | Rust 툴체인 + 빌드 환경. 서명 없는 exe 는 SmartScreen 경고. 배포 비용이 가장 크다 |
| Python | 기획자가 Python 을 깔아야 한다. PyInstaller 는 백신 오탐이 흔하다 |
| C# WinForms/WPF | .NET 런타임 의존, Windows 전용. 만드는 비용 대비 이득 없음 |
| Unity 에디터 확장 | "기획자는 Unity 를 쓰지 않는다" 를 정면으로 위반 |
| 순수 HTML 손코딩 | 스타크래프트급 규모(수천 줄)에서 모듈·타입·테스트 없이는 유지가 안 된다 |

단일 HTML 은 **기획자 쪽 설치가 0** 이고, 파일 열기·저장이 File System Access API 로 정상 동작하며, 의존성 0 이면 몇 년 뒤에 열어도 그대로 돈다. 개발자는 만들고 즉시 검증할 수 있다.
TS + Vite 는 그 산출물을 **제대로 된 개발 환경** 에서 만들기 위한 것이다 — 산출물의 단순함과 개발의 규율을 둘 다 가진다.

## 대가

- 브라우저 샌드박스: 페이지가 시작하는 다운로드를 막는 환경이 있다 → FSAA 1순위, `TOON 복사` 를 최후 경로로 남긴다 (SDD-01 §6).
- 네이티브 기능(최근 파일 목록, 자동 저장 경로)은 localStorage 로 대체한다.

## 되돌리기

`ui/`·`io/` 만 갈아 끼우면 `core/` 는 그대로 Tauri 에 얹힌다 (ADR-E03). 그래서 이 결정은 값싸다.
