/**
 * 목적: 화면 색과 크기의 유일한 정의. 게임 화면과 같은 그림을 내기 위한 값들이다.
 * 왜 이 구조인가: 게임의 타일은 이미지가 아니라 코드로 만든 단색 사각형이라, 색 몇 개만 옮기면
 *   에셋 추출 없이 같은 그림이 나온다. 원본은 언제나 게임 코드이고 이 파일은 **사본** 이므로
 *   값마다 `출처:` 를 달아 게임이 바뀌었을 때 grep 한 번으로 찾게 한다.
 * 바꾸면 안 되는 것: 게임 출처가 있는 값을 손으로 고치지 마라 — 게임 `SceneParts.cs` /
 *   `GreyboxFactory.cs` 에서 다시 복사하고 출처 라인을 갱신하라. `@출처-불필요` 마커 위쪽의
 *   모든 색 리터럴은 `palette-source.test.ts` 가 출처 주석을 검사한다.
 * 근거: SDD-01 §5 [D-01-05], SDD-08 §8 [D-08-08], ADR-E09
 */
import { Cell } from './model/cell.js';

/** 1셀의 기준 픽셀 크기. 게임 타일 스프라이트(32px)와 맞췄다. 줌은 합성 단계에서 곱한다. */
export const CELL_PX = 32;

export const BACKGROUND = '#141419'; // 출처: Editor/SceneBootstrap.cs:54-63 (0.08, 0.08, 0.1)

export const COLOR: Readonly<Record<Cell, string>> = {
  [Cell.Ground]: '#3D3D45', // 출처: Editor/SceneParts.cs:41-42 (0.24, 0.24, 0.27)
  [Cell.Road]: '#BD9966', // 출처: Editor/SceneParts.cs:44-45 (0.74, 0.6, 0.4)
  [Cell.Buildable]: '#598CA6', // 출처: Editor/SceneParts.cs:46-47 (0.35, 0.55, 0.65)
  [Cell.VillageSlot]: '#40994D', // 출처: Editor/SceneParts.cs:48-49 (0.25, 0.6, 0.3)
  [Cell.Blocked]: '#1A1A1F', // 출처: Editor/SceneParts.cs:50-51 (0.1, 0.1, 0.12)
  [Cell.Water]: '#214780', // 출처: Editor/SceneParts.cs:54-55 (0.13, 0.28, 0.5)
  [Cell.Empty]: '#141419', // 출처: Editor/SceneBootstrap.cs:54-63 — 타일이 없으면 배경이 보인다
};

export const ACTOR = {
  escortee: '#F35A8C', // 출처: Editor/GreyboxFactory.cs:127 (0.95, 0.35, 0.55) 하트
  mother: '#6B1E8C', // 출처: Editor/GreyboxFactory.cs:137-138 (0.42, 0.12, 0.55) 사각
  village: '#33BF4D', // 출처: Editor/GreyboxFactory.cs:195 (0.2, 0.75, 0.3) 사각
  exit: '#FFD600', // 출처: Editor/SceneParts.cs:194-202 (1, 0.84, 0) 테두리
  walker: '#E62626', // 출처: Editor/GreyboxFactory.cs:146 (0.9, 0.15, 0.15) 원
  scout: '#FF9E29', // 출처: Editor/GreyboxFactory.cs:162 (1, 0.62, 0.16) 원
} as const;

/** 셀 하나를 1.0 으로 본 크기. 게임 프리팹의 `localScale` 을 그대로 옮긴 값이다. */
export const ACTOR_SCALE = {
  escortee: 0.9, // 출처: Editor/GreyboxFactory.cs:127
  mother: 1.5, // 출처: Editor/GreyboxFactory.cs:137-138
  village: 1.4, // 출처: Editor/GreyboxFactory.cs:195
} as const;

export const EDGE = {
  normal: 'rgba(179,179,179,0.9)', // 출처: Runtime/Pathing/PathNodeAuthoring.cs:38-61 기즈모 (0.7,0.7,0.7,0.9)
  shortcut: '#FFD600', // 출처: Runtime/Pathing/PathNodeAuthoring.cs:38-61 — 지름길은 노란 점선
  nodeStart: '#FFFFFF', // 출처: Runtime/Pathing/PathNodeAuthoring.cs:38-61 시작 노드 = 흰색
  nodeExit: '#FFD600', // 출처: Runtime/Pathing/PathNodeAuthoring.cs:38-61 탈출 노드 = 금색
  nodeNormal: '#B3B3B3', // 출처: Runtime/Pathing/PathNodeAuthoring.cs:38-61 일반 노드 = 회색
  /** 지름길 점선 간격(셀 단위). 출처: PathNodeAuthoring.cs 의 dash 0.25 */
  dash: 0.25,
} as const;

/* @출처-불필요 — 아래는 게임에 대응물이 없는 툴 전용 색이다 (선택·검증 마커·격자 등). */

export const UI = {
  selection: '#4DA3FF',
  /** 마을 구역별 도달 가능 영역 색. 구역 번호로 순환한다. */
  reach: ['#4DA3FF', '#7FD17F', '#D1A34D', '#C77FD1'],
  unreachHatch: 'rgba(255,255,255,0.18)',
  error: '#FF4D4D',
  warning: '#FFC24D',
  info: '#7FB2FF',
  grid: 'rgba(255,255,255,0.07)',
  gridMajor: 'rgba(255,255,255,0.16)',
  brushPreview: 'rgba(255,255,255,0.5)',
  text: '#D6D6DB',
  textDim: '#8A8A93',
  panel: '#1B1B21',
  panelBorder: '#2C2C34',
} as const;
