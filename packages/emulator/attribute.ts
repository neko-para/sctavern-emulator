type CardAttribType = number

type AttributeCombinePolicy = 'add' | 'max' | 'discard'

interface CardAttribItem {
  name: string
  value: CardAttribType
  show: (value: CardAttribType) => string
  policy: AttributeCombinePolicy
}

export class AttributeManager {
  attrib: Record<string, CardAttribItem>
  refresh: () => Promise<void>

  constructor(refresh: () => Promise<void>) {
    this.attrib = {}
    this.refresh = refresh
  }

  registerAttribute(
    name: string,
    show: (value: CardAttribType) => string,
    init: CardAttribType,
    option: {
      override?: boolean
      combine_policy?: AttributeCombinePolicy
    } = {}
  ) {
    if (!(name in this.attrib) || option.override) {
      this.attrib[name] = {
        name,
        show,
        value: init,
        policy: option?.combine_policy || 'add',
      }
    }
  }

  removeAttribute(name: string) {
    if (name in this.attrib) {
      delete this.attrib[name]
    }
  }

  getAttribute(name: string): CardAttribType | null {
    return this.attrib[name]?.value || null
  }

  async setAttribute(name: string, value: CardAttribType) {
    if (this.attrib[name]) {
      this.attrib[name].value = value
      await this.refresh()
    }
  }
}
