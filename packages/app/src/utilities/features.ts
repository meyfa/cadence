interface UserAgentData {
  readonly mobile?: boolean
  readonly platform?: string
}

const deviceMemory = 'deviceMemory' in navigator
  ? (navigator as any).deviceMemory as number
  : undefined

const userAgentData = 'userAgentData' in navigator
  ? (navigator as any).userAgentData as UserAgentData
  : undefined

export function isLowMemoryDevice (): boolean | undefined {
  if (deviceMemory != null) {
    return deviceMemory <= 2
  }

  return undefined
}

export function isLikelyMobile (): boolean {
  if (userAgentData?.mobile != null) {
    return userAgentData.mobile
  }

  const coarsePointer = window.matchMedia('(pointer: coarse)').matches
  const smallScreen = Math.min(window.screen.width, window.screen.height) <= 768

  return coarsePointer && smallScreen
}

export function isMacOS (): boolean {
  const stringToCheck = userAgentData?.platform ?? navigator.userAgent
  return stringToCheck.toLowerCase().includes('mac')
}

export function isCoarsePointer (): boolean {
  return window.matchMedia('(pointer: coarse)').matches
}
