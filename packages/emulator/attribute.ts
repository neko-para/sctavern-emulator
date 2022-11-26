type CombinePolicy = 'add' | 'max' | 'discard'

interface AttributeEntry {
  value: number
  policy: CombinePolicy
}

export class AttributeManager {
  attrib: Record<string, AttributeEntry>
  view: Record<
    string,
    {
      view: (...a: number[]) => string
      deps: string[]
    }
  >
  refresh: () => Promise<void>

  constructor(refresh: () => Promise<void>) {
    this.attrib = {}
    this.view = {}
    this.refresh = refresh
  }

  has(name: string): boolean {
    return name in this.attrib
  }

  get(name: string, def = 0): number {
    return this.has(name) ? this.attrib[name].value : def
  }

  config(name: string, value: number, policy: CombinePolicy = 'add') {
    this.attrib[name] = {
      value,
      policy,
    }
  }

  async set(name: string, value: number) {
    if (!this.has(name)) {
      return
    }
    this.attrib[name].value = value
    if (
      Object.keys(this.view)
        .map(k => this.view[k])
        .map(v => v.deps.includes(name))
        .reduce((a, b) => a || b, false)
    ) {
      await this.refresh()
    }
  }

  setView(name: string, view: (...v: number[]) => string, ...deps: string[]) {
    this.view[name] = {
      view,
      deps,
    }
  }

  cleanView() {
    this.view = {}
  }

  queryView(): string[] {
    const res: string[] = []
    for (const k in this.view) {
      res.push(this.view[k].view(...this.view[k].deps.map(a => this.get(a))))
    }
    return res.filter(s => s)
  }

  combine(a: AttributeManager) {
    this.cleanView()
    for (const ak of new Set([
      ...Object.keys(this.attrib),
      ...Object.keys(a.attrib),
    ])) {
      const desc0 = this.attrib[ak]
      const desc1 = a.attrib[ak]
      if (desc0 && desc1 && desc0.policy !== desc1.policy) {
        console.warn('Combined attribute have difference policy')
      }
      const policy = (desc0 || desc1).policy
      const value = ((policy: CombinePolicy) => {
        switch (policy) {
          case 'add':
            return (desc0?.value || 0) + (desc1?.value || 0)
          case 'max':
            return Math.max(desc0?.value || 0, desc1?.value || 0)
          case 'discard':
            return 0
        }
      })(policy)
      this.attrib[ak] = {
        policy,
        value,
      }
    }
  }
}
