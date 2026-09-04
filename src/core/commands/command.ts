/**
 * 목적: Command 인터페이스 + History 클래스.
 * 왜 이 구조인가: 커맨드는 바뀐 부분만 기억. coalesce로 스트로크 합침.
 *   apply/revert는 새 문서 반환 (in-place 금지).
 * 바꾸면 안 되는 것: apply/revert 계약. beginStroke/endStroke 쌍.
 * 근거: SDD-01 §3 [D-01-03], SDD-09 §8 [D-09-08], ADR-E04
 */
import type { StageDocument } from '../model/stage.js';

export interface Command {
  readonly label: string;
  apply(doc: StageDocument): StageDocument;
  revert(doc: StageDocument): StageDocument;
  coalesce?(next: Command): Command | null;
}

export class History {
  private undoStack: Command[] = [];
  private redoStack: Command[] = [];
  private savedDepth = 0;
  private inStroke = false;
  private strokeStart = 0;
  _doc: StageDocument;

  constructor(initial: StageDocument) { this._doc = initial; }
  get doc(): StageDocument { return this._doc; }
  get canUndo(): boolean { return this.undoStack.length > 0; }
  get canRedo(): boolean { return this.redoStack.length > 0; }
  get dirty(): boolean { return this.undoStack.length !== this.savedDepth; }

  push(cmd: Command): void {
    const next = cmd.apply(this._doc);
    if (this.inStroke && this.undoStack.length > this.strokeStart) {
      const top = this.undoStack[this.undoStack.length - 1]!;
      if (top.coalesce) {
        const m = top.coalesce(cmd);
        if (m) { this.undoStack[this.undoStack.length - 1] = m; this._doc = next; this.redoStack = []; return; }
      }
    }
    this.undoStack.push(cmd); this.redoStack = []; this._doc = next;
  }

  undo(): void { if (!this.canUndo) return; const cmd = this.undoStack.pop()!; this._doc = cmd.revert(this._doc); this.redoStack.push(cmd); }
  redo(): void { if (!this.canRedo) return; const cmd = this.redoStack.pop()!; this._doc = cmd.apply(this._doc); this.undoStack.push(cmd); }
  markSaved(): void { this.savedDepth = this.undoStack.length; }
  beginStroke(): void { this.inStroke = true; this.strokeStart = this.undoStack.length; }
  endStroke(): void { this.inStroke = false; }
  replace(doc: StageDocument): void { this.undoStack = []; this.redoStack = []; this._doc = doc; this.markSaved(); }
}