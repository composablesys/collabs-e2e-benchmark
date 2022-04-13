const nodeID: Uint8Array = new Uint8Array(6)
let clockSequence: number = 0
let lastClock: Uint8Array = new Uint8Array(7)

const EPOCH: number = 946684800000 // 1 Jan 2000

const POW2_42: number = 2 ** 42
const POW2_32: number = 2 ** 32
const POW2_16: number = 2 ** 16

const navigationStart: number =
  (Date.now() - performance.now() - EPOCH) % POW2_42 // 42 bit
const navigationStart32: number = navigationStart >>> 0 // 32 bit

export const now = (): Uint8Array => {
  const time: Uint8Array = new Uint8Array(7)
  const view: DataView = new DataView(time.buffer)

  const now: number = performance.now()
  if (now >= POW2_32) {
    throw '' // happens after 1.5 month (page should refresh before that)
  }

  const low_part: number = (navigationStart32 + now) * 10000 // 46 bit
  const low: number = low_part >>> 0 // 32 bit
  const low_high_part: number = (low_part - low) / POW2_32 // 14 bit
  const high: number =
    ((navigationStart - navigationStart32) / POW2_32) * 10000 + low_high_part // 24 bit
  const high1: number = (high / POW2_16) >>> 0 // 8 bit
  const high2: number = high - high1 * POW2_16 // 16 bit

  view.setUint8(0, high1)
  view.setUint16(1, high2, false)
  view.setUint32(3, low, false)

  return time
}

export const newUUID = (): string => {
  if (clockSequence === 0) {
    const sequence: Uint8Array = new Uint8Array(2)
    crypto.getRandomValues(sequence)
    const view: Uint16Array = new Uint16Array(sequence.buffer)
    clockSequence = view[0]

    crypto.getRandomValues(nodeID)
  }

  const uid: Uint8Array = new Uint8Array(15)
  const view: DataView = new DataView(uid.buffer)

  const clock: Uint8Array = now()
  uid.set(clock, 0)

  if (arrayLowerOrEquals(clock, lastClock)) {
    clockSequence++
  }
  lastClock = clock

  view.setUint16(7, clockSequence, false)

  uid.set(nodeID, 9)

  return bytesToHex(uid)
}

const arrayLowerOrEquals = <T>(a1: ArrayLike<T>, a2: ArrayLike<T>): boolean => {
  for (let i = 0; i < Math.min(a1.length, a2.length); i++) {
    if (a1[i] > a2[i]) {
      return false
    }
  }
  return a1.length <= a2.length
}

const bytesToHex = (buf: Uint8Array): string => {
  let s = ''
  for (let b of buf) {
    const s0 = b / 16 >>> 0
    const s1 = b - s0 * 16
    s += s0.toString(16) + s1.toString(16)
  }
  return s
}
