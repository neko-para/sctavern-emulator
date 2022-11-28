import { computed, reactive, ComputedRef } from '@vue/reactivity'

type CombinePolicy = 'add' | 'max' | 'discard'
interface AttributeEntry {
  value: number
  policy: CombinePolicy
}

export class AttributeManager {
  attrib: Record<string, AttributeEntry>
  view: Record<string, ComputedRef<string>>

  views: ComputedRef<string[]>

  constructor() {
    this.attrib = reactive({})
    this.view = reactive({})

    this.views = computed(() => {
      const res: string[] = []
      for (const k in this.view) {
        res.push(this.view[k].value)
      }
      return res.filter(s => s)
    })
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

  set(name: string, value: number) {
    if (this.has(name)) {
      this.attrib[name].value = value
    }
  }

  setView(name: string, view: () => string) {
    this.view[name] = computed(view)
  }

  cleanView() {
    this.view = reactive({})
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
