import { computePositions } from '../src/lib/three/layout.ts'
function makeRoom(name){ return {name, topic:'', messageCount:0, sizeBytes:0, idleSeconds:0} }
function test(n){
  const rooms = Array.from({length:n}, (_,i)=>makeRoom(`r${i}`))
  const map = computePositions(rooms)
  let max=0
  for(const pos of map.values()){
    const d = Math.hypot(pos[0], pos[1])
    if(d>max) max=d
  }
  console.log(`n=${n} maxDist=${max.toFixed(2)} fogFar=120 ${max<=120?'GREEN visible':'RED behind fog (BUG)'}`)
  return max<=120
}
console.log("Testing OLD layout (max(20,n*3)) — should be RED for n=50")
const ok50 = test(50)
const ok200 = test(200)
if(!ok50 || !ok200){
  console.log("RED: bug reproduced — gedung di belakang kabut, tidak terlihat")
  process.exit(1)
} else {
  console.log("GREEN: fix works — gedung dalam kabut")
  process.exit(0)
}
