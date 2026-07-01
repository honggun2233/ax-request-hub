import { anthropic, MODEL } from '../../src/lib/claude'

test('Anthropic 클라이언트 초기화', () => {
  expect(anthropic).toBeDefined()
  expect(typeof anthropic.messages.create).toBe('function')
})

test('MODEL 상수 정의됨', () => {
  expect(MODEL).toBe('claude-sonnet-4-6')
})
