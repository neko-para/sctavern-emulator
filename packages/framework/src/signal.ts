export class Signal<Item = unknown> {
  signal: Signal<Item>[]
  action: ((item: Item) => Promise<void>)[]

  constructor() {
    this.signal = []
    this.action = []
  }

  connect<T extends Signal<Item> | ((item: Item) => Promise<void>)>(
    endpoint: T
  ): T {
    if (endpoint instanceof Signal<Item>) {
      this.signal.push(endpoint)
    } else {
      this.action.push(endpoint)
    }
    return endpoint
  }

  disconnect<T extends Signal<Item> | ((item: Item) => Promise<void>) | null>(
    endpoint: T
  ) {
    if (!endpoint) {
      this.signal = []
      this.action = []
    } else if (endpoint instanceof Signal<Item>) {
      this.signal.push(endpoint)
    } else {
      this.action.push(endpoint)
    }
  }

  async emit(item: Item, parallel = false) {
    if (parallel) {
      await Promise.all(
        this.signal.map(s => s.emit(item)).concat(this.action.map(f => f(item)))
      )
    } else {
      for (const s of this.signal) {
        await s.emit(item)
      }
      for (const f of this.action) {
        await f(item)
      }
    }
  }
}
