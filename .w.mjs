const fs = require("fs");
const NL = "
";
function w(p, lines) { fs.writeFileSync(p, lines.join(NL) + NL, "utf8"); console.log("OK " + p); }
w("src/core/commands/nodes.ts", [
"/**",
" * 목적: 노드·엣지 편집 커맨드들. Undo/Redo 지원.",
" * 근거: SDD-09 §8, SDD-08 §7",
" */",
"import type { Command } from \"./command.js\";",
"import type { StageDocument, PathNode, PathEdge, XY } from \"../model/stage.js\";",
"",
"export function addNode(node: PathNode): Command {",
"  return { label: \"노드 추가 \" + node.id, apply(d) { return { ...d, path: { ...d.path, nodes: [...d.path.nodes, node] } }; }, revert(d) { return { ...d, path: { ...d.path, nodes: d.path.nodes.filter(n => n.id !== node.id) } }; } };",
"}",
"",
"export function moveNode(id: string, to: XY): Command {",
"  let prev: PathNode | undefined;",
"  return { label: \"노드 이동 \" + id, apply(d) { const nodes = d.path.nodes.map(n => { if (n.id === id) { prev = n; return { ...n, x: to.x, y: to.y }; } return n; }); return { ...d, path: { ...d.path, nodes } }; }, revert(d) { if (!prev) return d; return { ...d, path: { ...d.path, nodes: d.path.nodes.map(n => n.id === id ? prev : n) } }; } };",
"}",
]); console.log("done");
