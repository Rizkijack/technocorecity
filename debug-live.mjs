import { parseRooms } from './src/lib/technocore/parse-rooms.ts'
import { readFileSync } from 'node:fs'
const txt = readFileSync('live-rooms.txt','utf8')
console.log('TXT start', txt.slice(0,300).replace(/\n/g,'\\n'))
try {
  const rooms = parseRooms(txt)
  console.log('PARSED COUNT', rooms.length)
  console.log(rooms.slice(0,2))
  console.log('OK no throw')
} catch(e){
  console.error('THROW', e.name, e.message)
  console.error(e)
}
