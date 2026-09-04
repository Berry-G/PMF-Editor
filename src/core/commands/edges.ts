/**
 * 목적: 엣지 편집 커맨드들. Undo/Redo 지원.
 * 왜 이 구조인가: 각 커맨드는 apply/revert 쌍으로 Undo/Redo 스택을 구성한다.
 *   revert 는 **apply 전에 캡처해 둔 값만** 쓴다. 적용 후 문서의 현재 값으로
 *   이전 상태를 유추하지 않는다 (deleteEdge/setEdgeProps/addEdge 파손 원인이었다).
 *   setEdgeProps 는 shortcut=true 면 allowed 를 자동으로 Escortee 로 강제한다 (V-P04).
 * 바꾸면 안 되는 것: revert 에서 캡처한 prevEdges 를 통째로 복원하는 것.
 * 근거: SDD-09 §8, SDD-08 §7
 */
import type { Command } from './command.js';
import type { StageDocument, PathEdge } from '../model/stage.js';

export function addEdge(edge: PathEdge): Command {
  // 왜: revert 는 apply 전 edge 목록을 통째로 복원한다.
  //   기존에는 from/to/shortcut 이 같은 엣지를 지우는 방식이라
  //   같은 모양의 엣지가 이미 끝에 있으면 그 엣지까지 사라졌다.
  let prevEdges: PathEdge[] = [];
  return { label: '엣지 추가 ' + edge.from + '→' + edge.to,
    apply(d: StageDocument) { prevEdges = d.path.edges.map(e => ({ ...e })); return { ...d, path: { ...d.path, edges: [...d.path.edges, edge] } }; },
    revert(d: StageDocument) { if (prevEdges.length === 0) return d; return { ...d, path: { ...d.path, edges: prevEdges.map(e => ({ ...e })) } }; },
  };
}

export function deleteEdge(index: number): Command {
  // 왜: revert 는 apply 전에 캡처한 edge 목록을 통째로 복원한다.
  //   적용 후 문서에서 d.path.edges[index] 를 읽으면 밀려온 다른 엣지가 들어 있어
  //   엉뚱한 엣지가 복제되고 지운 엣지는 영영 사라진다.
  let prevEdges: PathEdge[] = [];
  return { label: '엣지 삭제 ' + index,
    apply(d: StageDocument) { prevEdges = d.path.edges.map(e => ({ ...e })); return { ...d, path: { ...d.path, edges: d.path.edges.filter((_, i) => i !== index) } }; },
    revert(d: StageDocument) { if (prevEdges.length === 0) return d; return { ...d, path: { ...d.path, edges: prevEdges.map(e => ({ ...e })) } }; },
  };
}

export function setEdgeProps(index: number, props: Partial<Pick<PathEdge, 'allowed' | 'bidirectional' | 'shortcut'>>): Command {
  // 왜: revert 는 apply 전에 캡처한 엣지를 원래 자리에 복원한다.
  //   적용 후 문서에서 d.path.edges[index] 를 읽으면 이미 수정된 엣지라 revert 가 no-op 이 된다.
  let prevEdges: PathEdge[] = [];
  return { label: '엣지 속성 ' + index,
    apply(d: StageDocument) {
      const e = d.path.edges[index]; if (!e) return d;
      prevEdges = d.path.edges.map(pe => ({ ...pe }));
      const u = { ...e, ...props }; if (u.shortcut) u.allowed = ['Escortee'];
      const es = [...d.path.edges]; es[index] = u;
      return { ...d, path: { ...d.path, edges: es } };
    },
    revert(d: StageDocument) { if (prevEdges.length === 0) return d; return { ...d, path: { ...d.path, edges: prevEdges.map(e => ({ ...e })) } }; },
  };
}