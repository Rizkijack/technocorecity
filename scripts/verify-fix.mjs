import { computePositions } from '../src/lib/three/layout.ts'
function makeRoom(name){ return {name, topic:'', messageCount:0, sizeBytes:0, idleSeconds:0} }
for(const n of [12,50,200]){
  const rooms = Array.from({length:n}, (_,i)=>makeRoom(`r${i}`))
  const map = computePositions(rooms)
  let max=0
  for(const p of map.values()) max=Math.max(max, Math.hypot(p[0],p[1]))
  const ok = max<=60+1e-9 && max<=120
  console.log(`n=${n} max=${max.toFixed(2)} ${ok?'PASS':'FAIL'}`)
  if(!ok) process.exit(1)
}
console.log("GREEN: all within fog")
