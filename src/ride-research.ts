type ResearchKind = 'ideas' | 'thought'
type Provider = 'Codex' | 'Claude'

export type ResearchedRide<T> = { ride: T; provider: Provider; contextUsed: number }

const endpoint = '/api/ride-research'

export async function researchProvider(): Promise<Provider | undefined> {
  try {
    const response = await fetch(endpoint, { mode: 'same-origin', cache: 'no-store', signal: AbortSignal.timeout(3000) })
    if (response.ok && response.headers.get('Content-Type')?.includes('application/json')) {
      const { provider } = await response.json()
      if (provider === 'Codex' || provider === 'Claude') return provider
    }
  } catch {
    // The setup screen still works on a static host.
  }
}

export async function researchRide<T>(kind: ResearchKind, question: string, cancellation: AbortSignal): Promise<ResearchedRide<T>> {
  try {
    const response = await fetch(endpoint, {
      method: 'POST', mode: 'same-origin', cache: 'no-store',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kind, question }),
      signal: AbortSignal.any([cancellation, AbortSignal.timeout(155_000)]),
    })
    if (!response.headers.get('Content-Type')?.includes('application/json')) {
      throw new Error('Open Riverloop on its local server to use agent research.')
    }
    const data = await response.json()
    if (!response.ok) throw new Error(data.error ?? 'The agent couldn’t research this ride. Try again.')
    return data
  } catch (error) {
    cancellation.throwIfAborted()
    if (error instanceof DOMException && error.name === 'TimeoutError') throw new Error('The research timed out. Try again.')
    if (error instanceof TypeError) throw new Error('Couldn’t reach the local Riverloop server. Try again.')
    throw error
  }
}
