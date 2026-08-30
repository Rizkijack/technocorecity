import { computePositions as old } from '../src/lib/three/layout.ts'
// Simulate old vs new
function oldRadius(n){ return Math.max(20, n*3) }
function newRadius(n){ return Math.min(60, 10 + Math.sqrt(n)*7) }

for(const n of [12, 50, 200]){
  console.log(`n=${n} oldRadius=${oldRadius(n)} newRadius=${newRadius(n)} fogFar=120 visible_old=${oldRadius(n) <= 120} visible_new=${newRadius(n) <= 120}`)
}

// Tight loop: does 50 rooms render within fog?
import { parseRooms } from '../src/lib/technocore/parse-rooms.ts'
import { readFileSync } from 'node:fs'
const txt = readFileSync('live-rooms.txt','utf8')
const rooms = parseRooms(txt)
console.log(`parsed ${rooms.length} rooms`)
const positions = (await import('../src/lib/three/layout.ts')).computePositions(rooms)
let maxDist = 0
for(const [name, [x,z]] of positions){
  const d = Math.hypot(x,z)
  if(d>maxDist) maxDist=d
}
console.log(`maxDist=${maxDist} fogFar=120 withinFog=${maxDist <= 120}`)
if(maxDist > 120) console.log("RED: buildings behind fog -> invisible (BUG)")
else console.log("GREEN: buildings within fog -> visible")
