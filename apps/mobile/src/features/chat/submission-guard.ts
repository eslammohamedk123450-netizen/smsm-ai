export interface MutableLock {
  current: boolean;
}

export async function runOnce<T>(lock: MutableLock, operation: () => Promise<T>): Promise<T | undefined> {
  if (lock.current) return undefined;
  lock.current = true;
  try {
    return await operation();
  } finally {
    lock.current = false;
  }
}
