import { Signal } from './signal'

class CriticalSection {
  res: (() => void)[] | null

  constructor() {
    this.res = null
  }

  async enter(): Promise<boolean> {
    if (this.res) {
      await new Promise<void>(resolve => {
        this.res?.push(resolve)
      })
      return false
    } else {
      this.res = []
      return true
    }
  }

  leave() {
    if (!this.res) {
      return
    }
    if (this.res.length > 0) {
      const f = this.res.shift() as () => void
      f()
    } else {
      this.res = null
    }
  }
}

export class AsyncQueue<Item = unknown> {
  section: CriticalSection
  items: Item[]
  resolves: ((item: Item) => void)[]

  constructor() {
    this.section = new CriticalSection()
    this.items = []
    this.resolves = []
  }

  push(item: Item, async = true) {
    const r = this.resolves.shift()
    if (r) {
      this.section.enter().then(direct => {
        if (direct && async) {
          setTimeout(() => {
            r(item)
            this.section.leave()
          }, 0)
        } else {
          r(item)
          this.section.leave()
        }
      })
    } else {
      this.items.push(item)
    }
  }

  pushSig(): Signal<Item> {
    const s = new Signal<Item>()
    s.connect(async item => {
      this.push(item)
    })
    return s
  }

  async pop(): Promise<Item> {
    if (this.items.length > 0) {
      return this.items.shift() as Item
    } else {
      return new Promise<Item>(resolve => {
        this.resolves.push(resolve)
      })
    }
  }
}
