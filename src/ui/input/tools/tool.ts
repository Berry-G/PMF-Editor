/**
 * 목적: 도구 상태기계 인터페이스.
 * 왜 이 구조인가: SDD-09 §10. 각 도구는 onDown/onMove/onUp/onCancel 구현.
 *   공통 컨텍스트로 Store·View·StatusBar 를 받는다.
 * 바꾸면 안 되는 것: Tool 인터페이스 시그니처.
 * 근거: SDD-09 §10 [D-09-10]
 */
import type { Store, ToolId } from '../../state.js';
import { View } from '../../canvas/view.js';
import { StatusBar } from '../../panels/status.js';
import type { XY } from '../../../core/model/stage.js';

export interface PointerInfo { cell: XY; fx: number; fy: number; button: 0 | 1 | 2; shift: boolean; ctrl: boolean; alt: boolean; sx: number; sy: number; }
export interface ToolContext { store: Store; view: View; status: StatusBar; }
export interface Tool { readonly id: ToolId; onDown(p: PointerInfo, ctx: ToolContext): void; onMove(p: PointerInfo, ctx: ToolContext): void; onUp(p: PointerInfo, ctx: ToolContext): void; onCancel(ctx: ToolContext): void; }