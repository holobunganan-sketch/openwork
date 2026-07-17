export function assertOpenWorkVersion(value: unknown) {
  if (typeof value !== "string" || !/^0\.2\.1(?:-rc\.[1-9][0-9]*)?$/.test(value)) {
    throw new Error("OpenWork release version must be 0.2.1 or 0.2.1-rc.N")
  }
  return value
}
