/**
 * 목적: 게이트 테스트가 쓰는 파일 순회 도우미. 저장소 루트 기준 경로를 돌려준다.
 * 왜 이 구조인가: 게이트가 넷이고 전부 같은 순회를 한다. 각자 구현하면 무엇을 검사 대상에서
 *   빠뜨렸는지 서로 달라진다 — 대상 목록이 한 곳에 있어야 한다.
 * 바꾸면 안 되는 것: `node_modules`·`dist` 제외. 그 외 폴더를 예외로 추가하지 마라 —
 *   예외가 생기는 순간 게이트는 "검사한 곳만 지켜지는" 규칙이 된다.
 * 근거: SDD-06 §4 [D-06-04], SDD-08 §12 [D-08-12]
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = fileURLToPath(new URL('../../', import.meta.url));

const SKIP_DIRS = new Set(['node_modules', 'dist', '.git', '.serena']);

/** `dir` 아래에서 확장자가 맞는 파일을 저장소 루트 기준 상대 경로(슬래시)로 돌려준다. */
export function walk(dir: string, extensions: readonly string[]): string[] {
  const out: string[] = [];
  const visit = (abs: string): void => {
    let entries;
    try {
      entries = readdirSync(abs, { withFileTypes: true });
    } catch {
      return; // 왜: 아직 만들지 않은 폴더(예: M1 의 fixtures)는 없는 것이 정상이다
    }
    for (const entry of entries) {
      const child = join(abs, entry.name);
      if (entry.isDirectory()) {
        if (!SKIP_DIRS.has(entry.name)) visit(child);
      } else if (extensions.some((ext) => entry.name.endsWith(ext))) {
        out.push(relative(ROOT, child).split(sep).join('/'));
      }
    }
  };
  visit(join(ROOT, dir));
  return out.sort();
}

export function read(relativePath: string): string {
  return readFileSync(join(ROOT, relativePath), 'utf8');
}
