import { createMockTransport } from './mockTransport'
import { createWebSocketTransport } from './websocketTransport'
import type { BackendTransport } from './transport'

export function createBackendTransport(): BackendTransport {
  const wsUrl = import.meta.env.VITE_WS_URL?.trim()
  const useMock = import.meta.env.VITE_USE_MOCK_BACKEND === 'true' || !wsUrl

  if (useMock) {
    return createMockTransport()
  }

  return createWebSocketTransport(wsUrl)
}
