import { useLayoutEffect, useRef } from 'react'

export const useLandingMotion = () => {
  const rootRef = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    const root = rootRef.current
    if (!root) return

    const preference = window.matchMedia('(prefers-reduced-motion: reduce)')
    const elements = Array.from(
      root.querySelectorAll<HTMLElement>(
        '[data-reveal], main h1, main h2, main h3, main p, main li, main tbody tr, main figure, .landing-card, .landing-asset, .landing-stat, .landing-legend'
      )
    )
    let observer: IntersectionObserver | undefined
    let scrollFrame = 0

    root
      .querySelectorAll<SVGPathElement>(
        'svg[aria-label="Historia wartości portfela w PLN"] path[fill="none"], svg path[role="img"]'
      )
      .forEach((path) => {
        path.setAttribute('pathLength', '1')
        path.classList.add('landing-draw')
      })

    elements.forEach((element) => {
      element.classList.add('landing-reveal')
      const siblings = element.parentElement
        ? Array.from(element.parentElement.children)
        : []
      const delay = Math.min(Math.max(siblings.indexOf(element), 0), 5) * 55
      element.style.setProperty('--reveal-delay', `${delay}ms`)
    })

    const configureMotion = () => {
      observer?.disconnect()
      if (preference.matches || !('IntersectionObserver' in window)) {
        root.removeAttribute('data-motion')
        elements.forEach((element) =>
          element.setAttribute('data-visible', 'true')
        )
        return
      }
      root.setAttribute('data-motion', 'on')
      observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting)
              entry.target.setAttribute('data-visible', 'true')
            else if (entry.boundingClientRect.top > window.innerHeight) {
              entry.target.setAttribute('data-visible', 'false')
            }
          })
        },
        { threshold: 0.08, rootMargin: '0px 0px -20px 0px' }
      )
      elements.forEach((element) => observer!.observe(element))
    }

    const updateScroll = () => {
      scrollFrame = 0
      const distance =
        document.documentElement.scrollHeight - window.innerHeight
      const progress =
        distance > 0 ? Math.min(1, Math.max(0, window.scrollY / distance)) : 0
      root.style.setProperty('--scroll-progress', String(progress))
    }
    const onScroll = () => {
      if (!scrollFrame) scrollFrame = window.requestAnimationFrame(updateScroll)
    }
    configureMotion()
    updateScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll, { passive: true })
    preference.addEventListener('change', configureMotion)

    return () => {
      observer?.disconnect()
      window.cancelAnimationFrame(scrollFrame)
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
      preference.removeEventListener('change', configureMotion)
      root.removeAttribute('data-motion')
    }
  }, [])

  return rootRef
}
