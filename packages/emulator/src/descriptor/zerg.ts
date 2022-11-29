import { elited, getUnit, isBiological, isHero, isNormal, Unit } from '@sctavern-emulator/data'
import { CardDescriptorTable } from '../types'
import { autoBind, isCardInstance, us } from '../utils'
import { 科挂X } from './terran'

const data: CardDescriptorTable = {
  虫卵: [
    autoBind('round-start', async (card, gold) => {
      if (
        [card.left(), card.right()]
          .filter(isCardInstance)
          .filter(c => c.data.race === 'Z').length === 2
      ) {
        await card.player.incubate(
          card,
          card.data.units.filter(isNormal).filter(isBiological)
        )
        await card.player.destroy(card)
        await card.player.obtain_resource({
          mineral: 1,
        })
      }
    }),
  ],
  虫群先锋: [
    autoBind('round-end', async (card, gold) => {
      await card.obtain_unit(us('跳虫', gold ? 4 : 2))
    }),
  ],
  蟑螂小队: [
    autoBind('round-start', async (card, gold) => {
      await card.replace_unit(card.find('蟑螂', gold ? 2 : 1), '破坏者')
    }),
    autoBind('post-sell', async (card, gold) => {
      await card.player.inject(us('蟑螂', gold ? 4 : 2))
    }),
  ],
  屠猎者: [
    autoBind('round-end', async card => {
      await card.replace_unit(card.find('刺蛇'), elited)
    }),
    autoBind('tavern-upgraded', async (card, gold) => {
      await card.obtain_unit(us('刺蛇(精英)', gold ? 2 : 1))
    }),
  ],
  埋地刺蛇: [
    autoBind('post-sell', async (card, gold) => {
      await card.player.inject(us('刺蛇', gold ? 6 : 3))
    }),
  ],
  变异军团: [
    autoBind('inject', async (card, gold) => {
      await card.obtain_unit(us('被感染的陆战队员', gold ? 2 : 1))
    }),
  ],
  孵化蟑螂: [
    autoBind('round-end', async (card, gold) => {
      await card.player.incubate(card, us('蟑螂', gold ? 2 : 1))
    }),
  ],
  爆虫滚滚: [
    autoBind('round-end', async (card, gold) => {
      await card.player.incubate(
        card,
        us(
          '爆虫',
          Math.floor(
            (card.find('爆虫').length + card.find('爆虫(精英)').length) /
              (gold ? 15 : 20)
          )
        )
      )
    }),
    (card, gold, text) => {
      let cleaner = () => {}
      const ret = {
        text,
        gold,
        disabled: false,
        unique: '爆虫滚滚',

        unbind() {
          cleaner()
        },
      }
      card.bus.begin()
      card.bus.on('card-selled', async ({ target }) => {
        if (ret.disabled) {
          return
        }
        await card.obtain_unit([
          ...us('爆虫', target.find('跳虫').length),
          ...us('爆虫(精英)', target.find('跳虫(精英)').length),
        ])
      })
      cleaner = card.bus.end()
      return ret
    },
  ],
  飞龙骑脸: [
    autoBind('post-sell', async (card, gold) => {
      await card.player.incubate(card, us('异龙', gold ? 4 : 2))
    }),
  ],
  凶残巨兽: [
    autoBind('post-sell', async (card, gold) => {
      await card.player.inject(us('雷兽', gold ? 1 : 2))
    }),
  ],
  注卵虫后: [
    autoBind('round-start', async (card, gold) => {
      await card.player.inject([
        ...us('蟑螂', gold ? 2 : 1),
        ...us('刺蛇', gold ? 2 : 1),
      ])
    }),
  ],
  孵化所: [
    (card, gold, text) => {
      let cleaner = () => {}
      const ret = {
        text,
        gold,
        disabled: false,
        unique: '孵化所',

        unbind() {
          cleaner()
        },
      }
      card.bus.begin()
      card.bus.on('obtain-unit-post', async ({ units, way }) => {
        if (ret.disabled || way !== 'incubate') {
          return
        }
        await card.obtain_unit(
          us(units[units.length - 1], gold ? 3 : 2)
          // 'incubate'
        )
      })
      cleaner = card.bus.end()
      return ret
    },
  ],
  地底伏击: [
    autoBind('post-enter', async (card, gold) => {
      await card.player.incubate(card, us('潜伏者', gold ? 2 : 1))
    }),
  ],
  孵化刺蛇: [
    autoBind('round-end', async (card, gold) => {
      await card.player.incubate(card, us('刺蛇(精英)', gold ? 2 : 1))
    }),
  ],
  感染深渊: [
    autoBind('round-end', async (card, gold) => {
      let n = 0
      for (const c of card.player.present.filter(isCardInstance)) {
        const idx = c.find('陆战队员', gold ? 4 : 2)
        await c.remove_unit(idx)
        n += idx.length
      }
      await card.player.inject(us('被感染的陆战队员', n))
    }),
    autoBind('round-start', async (card, gold) => {
      for (const c of card.player.present.filter(isCardInstance)) {
        await c.replace_unit(c.find('被感染的陆战队员', gold ? 2 : 1), '畸变体')
      }
    }),
  ],

  腐化大龙: [
    autoBind('round-start', async (card, gold) => {
      await card.replace_unit(card.find('腐化者', gold ? 4 : 2), '巢虫领主')
    }),
    autoBind('post-sell', async (card, gold) => {
      await card.player.inject(us('巢虫领主', gold ? 4 : 2))
    }),
  ],
  空中管制: [
    autoBind('post-enter', async (card, gold) => {
      await card.player.incubate(card, us('爆蚊', gold ? 6 : 3))
    }),
    autoBind('round-end', async (card, gold) => {
      await card.player.incubate(card, us('异龙(精英)', gold ? 2 : 1))
    }),
  ],
  虫群大军: [
    autoBind('round-end', async (card, gold) => {
      if (card.player.count_present().Z >= 4) {
        await card.player.inject(us('雷兽', gold ? 2 : 1))
      }
    }),
  ],
  终极进化: [
    autoBind('post-enter', async (card, gold) => {
      for (const c of card.around()) {
        await c.replace_unit(
          [...c.find('蟑螂', 2), ...c.find('蟑螂(精英)', 2)]
            .sort()
            .slice(0, gold ? 2 : 1),
          '莽兽'
        )
      }
    }),
  ],
  凶猛巨兽: [
    autoBind('post-enter', async (card, gold) => {
      for (const c of card.player.all_of('Z')) {
        await c.obtain_unit(us('腐化者', gold ? 4 : 2))
      }
    }),
    autoBind('round-end', async (card, gold) => {
      for (const c of [card.left(), card.right()]
        .filter(isCardInstance)
        .filter(c => c.data.race === 'Z')) {
        await c.obtain_unit(us('守卫', gold ? 4 : 2))
      }
    }),
  ],
  扎加拉: [
    (card, gold, text) => {
      let cleaner = () => {}
      const ret = {
        text,
        gold,
        disabled: false,
        unique: '扎加拉',

        unbind() {
          cleaner()
        },
      }
      card.bus.begin()
      card.bus.on('incubate', async ({ units }) => {
        if (ret.disabled) {
          return
        }
        await card.obtain_unit(units, 'incubate')
        if (gold) {
          await card.obtain_unit(['巢虫领主'])
        }
      })
      cleaner = card.bus.end()
      return ret
    },
  ],
  斯托科夫: [
    (card, gold, text) => {
      card.player.persisAttrib.config(
        '斯托科夫',
        card.player.persisAttrib.get('斯托科夫')
      )
      let cleaner = () => {}
      const ret = {
        text,
        gold,
        disabled: false,
        unique: '斯托科夫',

        unbind() {
          cleaner()
        },
      }
      card.attrib.setView('斯托科夫', () => {
        if (ret.disabled) {
          return '禁用'
        } else if (gold || card.player.persisAttrib.get('斯托科夫')) {
          return '注卵'
        } else {
          return '非注卵'
        }
      })
      card.bus.begin()
      card.bus.on('card-entered', async ({ target }) => {
        if (ret.disabled) {
          return
        }
        if (target.data.race === 'Z' || target.data.level >= 6) {
          return
        }
        const v = card.player.persisAttrib.get('斯托科夫')
        await card.player.persisAttrib.set('斯托科夫', gold ? 0 : 1 - v)
        if (gold || v === 1) {
          await card.player.inject(
            target.data.units.filter(isNormal).filter(u => !isHero(u))
          )
        }
      })
      cleaner = card.bus.end()
      return ret
    },
  ],
  守卫巢穴: [
    autoBind('round-end', async (card, gold) => {
      await card.player.inject(us('守卫', gold ? 2 : 1))
    }),
    autoBind('round-end', async (card, gold) => {
      for (const c of card.player.present.filter(isCardInstance)) {
        await c.replace_unit(
          c.find(u => ['异龙', '异龙(精英)'].includes(u), gold ? 2 : 1),
          '守卫'
        )
      }
    }),
  ],
  生化危机: [
    科挂X(2, async (card, gold) => {
      await card.player.inject([
        ...us('牛头人陆战队员', gold ? 2 : 1),
        ...us('科技实验室', gold ? 4 : 2),
      ])
    }),
  ],
  雷兽窟: [
    autoBind('inject', async (card, gold) => {
      await card.replace_unit(card.find('幼雷兽', gold ? 2 : 1), '雷兽')
    }),
    autoBind('round-end', async (card, gold) => {
      await card.player.incubate(card, us('幼雷兽', gold ? 2 : 1))
    }),
  ],
  优质基因: [
    autoBind('round-end', async (card, gold) => {
      const es = card.player.find_name('虫卵')
      if (es.length === 0) {
        return
      }
      const us = es
        .map(c => c.data.units)
        .reduce((a, b) => a.concat(b), [])
        .filter(u => gold || !isHero(u))
        .map((u, i) => [getUnit(u), i] as [Unit, number])
        .sort(([ua, ia], [ub, ib]) => {
          if (ua.value === ub.value) {
            return ia - ib
          } else {
            return ub.value - ua.value
          }
        })
        .slice(0, 1)
      for (const e of es) {
        card.player.destroy(e)
      }
      if (us.length === 0) {
        return
      }
      for (const c of card.player.all_of('Z')) {
        await c.obtain_unit([us[0][0].name])
      }
    }),
  ],
  基因突变: [
    (card, gold, text) => {
      async function proc() {
        for (const c of card
          .around()
          .filter(c => c.data.race === 'Z')
          .filter(c => c.data.units.length > 0)) {
          const us = c.data.units
            .map((u, i) => [getUnit(u), i] as [Unit, number])
            .sort(([ua, ia], [ub, ib]) => {
              if (ua.value === ub.value) {
                return ia - ib
              } else {
                return ub.value - ua.value
              }
            })
          const tos = us.filter(([u]) => !isHero(u.name))
          if (tos.length === 0) {
            return
          }
          await c.replace_unit(
            us
              .slice(us.length - (gold ? 2 : 1))
              .filter(([u]) => u.value < tos[0][0].value)
              .map(([u, i]) => i),
            tos[0][0].name
          )
        }
      }

      card.bus.begin()
      card.bus.on('post-enter', proc)
      card.bus.on('post-sell', proc)
      const cleaner = card.bus.end()
      return {
        text,
        gold,

        unbind() {
          cleaner()
        },
      }
    },
  ],
  机械感染: [
    autoBind('round-end', async (card, gold) => {
      await card.player.incubate(card, us('被感染的女妖', gold ? 2 : 1))
    }),
    (card, gold, text) => {
      let cleaner = () => {}
      const ret = {
        text,
        gold,
        disabled: false,
        unique: '机械感染',

        unbind() {
          cleaner()
        },
      }
      card.bus.begin()
      card.bus.on('card-selled', async ({ target }) => {
        if (ret.disabled) {
          return
        }
        if (
          target.data.value >= 4000 &&
          target.data.name !== '虫卵' &&
          target.data.race === 'Z'
        ) {
          await card.obtain_unit(us('末日巨兽', 1))
        }
      })
      cleaner = card.bus.end()
      return ret
    },
  ],
}

export { data }
