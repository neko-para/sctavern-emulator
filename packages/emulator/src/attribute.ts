import { computed, reactive } from '@vue/reactivity'

export class AttributeViewer {
  view: Record<string, string>

  constructor() {
    this.view = reactive({})
  }

  set(name: string, v: () => string) {
    this.view[name] = computed<string>(v) as unknown as string
  }

  clean() {
    Object.keys(this.view).forEach(k => {
      delete this.view[k]
    })
  }

  views(): string[] {
    const res: string[] = []
    for (const k in this.view) {
      res.push(this.view[k])
    }
    return res.filter(s => s)
  }
}

export class AttributeManager {
  attrib: Record<string, number>

  constructor() {
    this.attrib = reactive({})
  }

  has(name: string): boolean {
    return name in this.attrib
  }

  get(name: string, def = 0): number {
    return this.has(name) ? this.attrib[name] : def
  }

  set(name: string, value: number) {
    this.attrib[name] = value
  }

  alter(name: string, delta: number) {
    this.attrib[name] = (this.attrib[name] || 0) + delta
  }

  clean() {
    Object.keys(this.attrib).forEach(k => {
      delete this.attrib[k]
    })
  }
}

export function CombineAttribute(
  a: AttributeManager,
  b: AttributeManager,
  process: (name: string, v1: number, v2: number) => number
): AttributeManager {
  const result = new AttributeManager()
  for (const k of new Set([
    ...Object.keys(a.attrib),
    ...Object.keys(b.attrib),
  ])) {
    const v1 = a.get(k)
    const v2 = b.get(k)
    result.set(k, process(k, v1, v2))
  }
  return result
}
