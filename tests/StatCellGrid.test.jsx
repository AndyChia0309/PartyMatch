import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { StatCell, StatCellGrid } from '../src/components/ui/group/StatCellGrid'

describe('StatCell / StatCellGrid', () => {
  it('渲染 label 跟 children', () => {
    render(
      <StatCellGrid>
        <StatCell label="團主">王小明</StatCell>
      </StatCellGrid>
    )
    expect(screen.getByText('團主')).toBeInTheDocument()
    expect(screen.getByText('王小明')).toBeInTheDocument()
  })

  it('有 onClick 時渲染成按鈕，點擊會觸發且不冒泡', () => {
    const onClick = vi.fn()
    const onOuterClick = vi.fn()
    render(
      <div onClick={onOuterClick}>
        <StatCellGrid>
          <StatCell label="群組人數" onClick={onClick}>6 人</StatCell>
        </StatCellGrid>
      </div>
    )
    fireEvent.click(screen.getByRole('button'))
    expect(onClick).toHaveBeenCalledTimes(1)
    expect(onOuterClick).not.toHaveBeenCalled()
  })

  it('沒有 onClick 時不會渲染成按鈕', () => {
    render(
      <StatCellGrid>
        <StatCell label="建立日期">2026-01-01</StatCell>
      </StatCellGrid>
    )
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('highlight 會套用到 value 那個 span，沒傳的話預設是 text-ink', () => {
    render(
      <StatCellGrid>
        <StatCell label="狀態" highlight="text-info-text">審核進行中</StatCell>
      </StatCellGrid>
    )
    expect(screen.getByText('審核進行中').className).toContain('text-info-text')
  })
})
