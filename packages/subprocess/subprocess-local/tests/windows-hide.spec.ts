import { spawn, spawnSync } from 'node:child_process'
import { describe, expect, it, vi } from 'vitest'
import { spawnSubprocess, taskkillProcessTree } from '../src/spawn.ts'
import { WindowsProcessInspector } from '../src/windows-inspector.ts'

vi.mock('node:child_process', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:child_process')>()
  return {
    ...actual,
    spawn: vi.fn(actual.spawn),
    spawnSync: vi.fn(),
  }
})

const spawnMock = vi.mocked(spawn)
const spawnSyncMock = vi.mocked(spawnSync)

function noOpSpec() {
  return {
    argv: [process.execPath, '-e', ''],
    cwd: process.cwd(),
    stdio: {
      stdin: 'ignore' as const,
      stdout: { maxBytes: 1024 },
      stderr: { maxBytes: 1024 },
    },
    graceMs: 1000,
  }
}

describe('Windows console visibility', () => {
  it('hides an opted-in ordinary subprocess window on Windows', async () => {
    spawnMock.mockClear()
    const running = spawnSubprocess({ ...noOpSpec(), windowsHide: true }, { platform: 'win32' })
    await running.done

    expect(spawnMock).toHaveBeenCalledOnce()
    expect(spawnMock.mock.calls[0]?.[2]).toMatchObject({ windowsHide: true })
  })

  it.each([
    ['an opted-out', false],
    ['an omitted', undefined],
  ])('does not hide %s ordinary subprocess window on Windows', async (_description, windowsHide) => {
    spawnMock.mockClear()
    const spec = { ...noOpSpec(), ...(windowsHide === undefined ? {} : { windowsHide }) }
    const running = spawnSubprocess(spec, { platform: 'win32' })
    await running.done

    expect(spawnMock).toHaveBeenCalledOnce()
    expect(spawnMock.mock.calls[0]?.[2]).toMatchObject({ windowsHide: false })
  })

  it('ignores an opted-in ordinary subprocess window setting off Windows', async () => {
    spawnMock.mockClear()
    const running = spawnSubprocess({ ...noOpSpec(), windowsHide: true }, { platform: 'linux' })
    await running.done

    expect(spawnMock).toHaveBeenCalledOnce()
    expect(spawnMock.mock.calls[0]?.[2]).toMatchObject({ windowsHide: false })
  })

  it('hides taskkill used for ordinary process-tree teardown', () => {
    spawnSyncMock.mockClear()
    taskkillProcessTree(2 ** 30)

    expect(spawnSyncMock).toHaveBeenCalledOnce()
    expect(spawnSyncMock.mock.calls[0]?.[2]).toMatchObject({ windowsHide: true })
  })

  it('hides taskkill used for terminal process-tree teardown', () => {
    spawnSyncMock.mockClear()
    new WindowsProcessInspector().signalGroup(2 ** 30, 'SIGTERM')

    expect(spawnSyncMock).toHaveBeenCalledOnce()
    expect(spawnSyncMock.mock.calls[0]?.[2]).toMatchObject({ windowsHide: true })
  })
})
