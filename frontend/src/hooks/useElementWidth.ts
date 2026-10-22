import { useEffect, useState, type RefObject } from 'react'

export const useElementWidth = <T extends HTMLElement>(
  ref: RefObject<T>,
  initial: number = 800
): number => {
  const [width, setWidth] = useState<number>(initial)

  useEffect(() => {
    if (!ref.current) return
    const el = ref.current
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setWidth(entry.contentRect.width)
      }
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [ref])

  return width
}
