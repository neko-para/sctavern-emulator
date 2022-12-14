import {
  elited,
  getUnit,
  isBiological,
  isHero,
  isNormal,
  Unit,
  UnitKey,
} from '@sctavern-emulator/data'
import { CardDescriptorTable, DescriptorGenerator } from '../types'
import {
  autoBind,
  autoBindX,
  isCardInstance,
  mostValueUnit,
  us,
} from '../utils'
import { 科挂X } from './terran'
import { CardInstance } from '../card'
import { InnerMsg } from '../events'
import { GetMsg, MsgKeyOf } from '../dispatcher'

function 孵化X<T extends MsgKeyOf<InnerMsg>>(
  time: T,
  getu: (card: CardInstance, gold: boolean) => UnitKey[],
  test: (
    card: CardInstance,
    gold: boolean,
    param: GetMsg<InnerMsg, T>
  ) => boolean = () => true,
  post: (card: CardInstance, gold: boolean) => Promise<void> = async () => {
    //
  },
  id = 0
): DescriptorGenerator {
  return autoBindX((card, gold) => ({
    [time]: async (param: GetMsg<InnerMsg, T>) => {
      if (test(card, gold, param)) {
        await card.incubate(id)
      }
    },
    'req-incubate': async ({ id: rid }) => {
      if (rid === id || rid === -1) {
        await card.player.incubate(card, getu(card, gold))
        await post(card, gold)
      }
    },
  }))
}

function 孵化(
  time: MsgKeyOf<InnerMsg>,
  unit: UnitKey,
  nc: number,
  gc: number,
  id = 0
): DescriptorGenerator {
  return 孵化X(
    time,
    (card, gold) => us(unit, gold ? gc : nc),
    () => true,
    async () => {
      //
    },
    id
  )
}

const data: CardDescriptorTable = {
  虫卵: [
    孵化X(
      'round-start',
      card => card.data.units.filter(isNormal).filter(isBiological),
      card =>
        card.around().filter(c => c.data.race === 'Z').length === 2 ||
        card.player.data.ability.data.name === '分裂池',
      async card => {
        card.player.obtain_resource({
          mineral: 1,
        })
        await card.player.destroy(card)
      }
    ),
  ],
  虫群先锋: [
    autoBind('round-end', async (card, gold) => {
      await card.obtain_unit(us('跳虫', gold ? 4 : 2))
    }),
  ],
  蟑螂小队: [
    autoBind('round-start', async (card, gold) => {
      card.replace_unit(card.find('蟑螂', gold ? 2 : 1), '破坏者')
    }),
    autoBind('post-sell', async (card, gold) => {
      await card.player.inject(us('蟑螂', gold ? 4 : 2))
    }),
  ],
  屠猎者: [
    autoBind('round-end', async card => {
      card.replace_unit(card.find('刺蛇'), elited)
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
  孵化蟑螂: [孵化('round-end', '蟑螂', 1, 2)],
  爆虫滚滚: [
    孵化X('round-end', (card, gold) =>
      us(
        '爆虫',
        Math.floor(
          (card.find('爆虫').length + card.find('爆虫(精英)').length) /
            (gold ? 15 : 20)
        )
      )
    ),
    autoBindX(
      (card, gold, desc) => ({
        'card-selled': async ({ target }) => {
          if (desc.disabled) {
            return
          }
          await card.obtain_unit([
            ...us('爆虫', target.find('跳虫').length),
            ...us('爆虫(精英)', target.find('跳虫(精英)').length),
          ])
        },
      }),
      {
        unique: '爆虫滚滚',
      }
    ),
  ],
  飞龙骑脸: [孵化('post-sell', '异龙', 2, 4)],
  凶残巨兽: [
    autoBind('post-sell', async (card, gold) => {
      await card.player.inject(us('雷兽', gold ? 2 : 1))
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
    autoBindX(
      (card, gold, desc) => ({
        'obtain-unit': async ({ time, units, way }) => {
          if (time !== 'post' || desc.disabled || way !== 'incubate') {
            return
          }
          await card.obtain_unit(us(units[units.length - 1], desc.gold ? 3 : 2))
        },
      }),
      {
        unique: '孵化所',
      }
    ),
  ],
  地底伏击: [孵化('post-enter', '潜伏者', 1, 2)],
  孵化刺蛇: [孵化('round-end', '刺蛇(精英)', 1, 2)],
  感染深渊: [
    autoBind('round-end', async (card, gold) => {
      let n = 0
      for (const c of card.player.present.filter(isCardInstance)) {
        const idx = c.find('陆战队员', gold ? 4 : 2)
        c.remove_unit(idx)
        n += idx.length
      }
      await card.player.inject(us('被感染的陆战队员', n))
    }),
    autoBind('round-start', async (card, gold) => {
      for (const c of card.player.present.filter(isCardInstance)) {
        c.replace_unit(c.find('被感染的陆战队员', gold ? 2 : 1), '畸变体')
      }
    }),
  ],
  腐化大龙: [
    autoBind('round-start', async (card, gold) => {
      card.replace_unit(card.find('腐化者', gold ? 4 : 2), '巢虫领主')
    }),
    autoBind('post-sell', async (card, gold) => {
      await card.player.inject(us('巢虫领主', gold ? 4 : 2))
    }),
  ],
  空中管制: [
    孵化('post-enter', '爆蚊', 3, 6, 0),
    孵化('round-end', '异龙(精英)', 1, 2, 1),
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
        c.replace_unit(
          c.find(u => u === '蟑螂' || u === '蟑螂(精英)', gold ? 2 : 1),
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
    autoBindX(
      (card, gold, desc) => ({
        incubate: async ({ units }) => {
          if (desc.disabled) {
            return
          }
          await card.obtain_unit(units, 'incubate')
          if (desc.gold) {
            await card.obtain_unit(['巢虫领主'])
          }
        },
      }),
      {
        unique: '扎加拉',
      }
    ),
  ],
  斯托科夫: [
    autoBindX(
      (card, gold, desc) => ({
        'card-entered': async ({ target }) => {
          if (desc.disabled) {
            return
          }
          if (target.data.race === 'Z' || target.data.level >= 6) {
            return
          }
          const v = card.player.persisAttrib.get('斯托科夫')
          card.player.persisAttrib.set('斯托科夫', desc.gold ? 0 : 1 - v)
          if (desc.gold || v === 1) {
            await card.player.inject(
              target.data.units.filter(isNormal).filter(u => !isHero(u)),
              true
            )
          }
        },
      }),
      {
        unique: '斯托科夫',
        init: (card, gold, desc) => {
          card.view.set('斯托科夫', () => {
            if (desc.disabled) {
              return '禁用'
            } else if (desc.gold || card.player.persisAttrib.get('斯托科夫')) {
              return '注卵'
            } else {
              return '非注卵'
            }
          })
        },
      }
    ),
  ],
  守卫巢穴: [
    autoBind('round-end', async (card, gold) => {
      await card.player.inject(us('守卫', gold ? 2 : 1))
      for (const c of card.player.present.filter(isCardInstance)) {
        c.replace_unit(
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
      card.replace_unit(card.find('幼雷兽', gold ? 2 : 1), '雷兽')
    }),
    孵化('round-end', '幼雷兽', 1, 2),
  ],
  优质基因: [
    autoBind('round-end', async (card, gold) => {
      const es = card.player.find_name('虫卵')
      if (es.length === 0) {
        return
      }
      const units = mostValueUnit(
        es
          .map(c => c.data.units)
          .reduce((a, b) => a.concat(b), [])
          .filter(u => gold || !isHero(u))
      )
      for (const e of es) {
        card.player.destroy(e)
      }
      if (!units[0]) {
        return
      }
      for (const c of card.player.all_of('Z')) {
        await c.obtain_unit([units[0]])
      }
    }),
  ],
  基因突变: [
    autoBindX((card, gold) => {
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
          c.replace_unit(
            us
              .slice(us.length - (gold ? 2 : 1))
              .filter(([u]) => u.value < tos[0][0].value)
              .map(([u, i]) => i),
            tos[0][0].name
          )
        }
      }
      return {
        'post-enter': proc,
        'post-sell': proc,
      }
    }),
  ],
  机械感染: [
    孵化('round-end', '被感染的女妖', 1, 2),
    autoBindX(
      (card, gold, desc) => ({
        'card-selled': async ({ target }) => {
          if (desc.disabled) {
            return
          }
          if (
            target.data.value >= 3600 &&
            target.data.name !== '虫卵' &&
            target.data.race === 'Z'
          ) {
            await card.obtain_unit(us('末日巨兽', 1))
          }
        },
      }),
      {
        unique: '机械感染',
      }
    ),
  ],
}

export { data }
