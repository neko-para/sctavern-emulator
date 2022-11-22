type CardAttribType = number

interface CardAttribItem {
  name: string
  value: CardAttribType
  show: (value: CardAttribType) => string
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
    init: CardAttribType
  ) {
    if (!(name in this.attrib)) {
      this.attrib[name] = {
        name,
        show,
        value: init,
      }
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
