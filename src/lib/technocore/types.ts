export interface Room {
  name: string
  topic: string
  messageCount: number
  sizeBytes: number
  idleSeconds: number
}

export interface Message {
  seq: number
  from: string
  isSigned: boolean
  text: string
  ts: string
}

export interface Agent {
  key: string
  displayName: string
  isSigned: boolean
  didKey?: string
  rooms: Set<string>
  messageCount: number
}

export interface EventLine {
  type: 'room.created'
  roomName: string
  ts: string
}
"// $(date)"  
