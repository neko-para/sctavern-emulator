import { reactive } from '@vue/reactivity'
import {
  elited,
  getCard,
  isBiological,
  isHero,
  isNormal,
  UnitKey,
} from '@sctavern-emulator/data'
import { CardInstance } from '../card'
import { CardDescriptorTable, DescriptorGenerator, LogicBus } from '../types'
import { autoBind, autoBindUnique, isCardInstance, refP, us } from '../utils'

export enum RenewPolicy {
  never,
  roundend,
  instant,
}

export function 任务<T extends keyof LogicBus>(
  msg: T,
  count: number,
  reward: (card: CardInstance, gold: boolean) => Promise<void>,
  pred: (p: LogicBus[T]) => boolean = () => true,
  policy: RenewPolicy = RenewPolicy.never
): DescriptorGenerator {
  return (card, gold) => {
    card.attrib.set('task', 0)
    card.view.set(
      '任务',
      () => `任务进度: ${card.attrib.get('task')} / ${count}`
    )
    let n = 0
    const bus = card.bus
    bus.begin()
    bus.on(msg, async p => {
      if (n < count && pred(p)) {
        n += 1
        card.attrib.set('task', n)
        if (n === count) {
          await reward(card, gold)
          await card.post('task-done', {
            ...refP(card.player),
            target: card,
          })
          if (policy === RenewPolicy.instant) {
            n = 0
            card.attrib.set('task', 0)
          }
        }
      }
    })
    switch (policy) {
      case RenewPolicy.roundend:
        bus.on('round-end', async () => {
          n = 0
          card.attrib.set('task', 0)
        })
        break
    }
    return reactive({
      gold,

      unbind: bus.end(),
    })
  }
}

function 快速生产(unit: UnitKey, nc: number, gc: number): DescriptorGenerator {
  return autoBind('fast-prod', async (card, gold) => {
    await card.obtain_unit(us(unit, gold ? gc : nc))
  })
}

export function 科挂X(
  count: number,
  func: (card: CardInstance, gold: boolean) => Promise<void>
): DescriptorGenerator {
  return autoBind('round-end', async (card, gold) => {
    let n = 0
    card.player.present.filter(isCardInstance).forEach(c => {
      n += c.find('科技实验室').length + c.find('高级科技实验室').length
    })
    if (n >= count) {
      await func(card, gold)
    }
  })
}

function 科挂(
  count: number,
  unit: UnitKey,
  nc: number,
  gc: number
): DescriptorGenerator {
  return 科挂X(count, async (card, gold) => {
    await card.obtain_unit(us(unit, gold ? gc : nc))
  })
}

export function 反应堆(unit: UnitKey): DescriptorGenerator {
  return autoBind('round-end', async (card, gold) => {
    if (card.data.infr[0] === 'reactor') {
      await card.obtain_unit(us(unit, gold ? 2 : 1))
    }
  })
}

function 进场切换挂件(): DescriptorGenerator {
  return autoBind('post-enter', async card => {
    for (const c of [card.left(), card.right()]) {
      await c?.switch_infr()
    }
  })
}

const data: CardDescriptorTable = {
  死神火车: [
    任务('card-entered', 2, async (card, gold) => {
      card.player.obtain_resource({
        mineral: gold ? 2 : 1,
      })
    }),
  ],
  好兄弟: [快速生产('陆战队员', 4, 6), 反应堆('陆战队员')],
  挖宝奇兵: [
    任务(
      'refreshed',
      5,
      async card => {
        await card.player.discover(
          card.player.game.pool.discover(
            c => c.level === card.player.data.level,
            3
          )
        )
      },
      () => true
    ),
  ],
  实验室安保: [反应堆('陆战队员'), 进场切换挂件()],
  征兵令: [
    autoBind('post-enter', async card => {
      for (const c of [card.left(), card.right()]) {
        if (c?.data.race === 'T') {
          await card.obtain_unit(c.filter((u, i) => i % 3 !== 0 && isNormal(u)))
        }
      }
    }),
  ],
  恶火小队: [
    反应堆('恶火'),
    科挂(2, '歌利亚', 1, 2),
    快速生产('攻城坦克', 1, 1),
  ],
  空投地雷: [
    autoBind('card-entered', async (card, gold) => {
      await card.obtain_unit(us('寡妇雷', gold ? 2 : 1))
    }),
    快速生产('寡妇雷', 2, 3),
  ],
  步兵连队: [快速生产('劫掠者', 3, 5), 反应堆('劫掠者')],
  飙车流: [
    快速生产('秃鹫', 3, 5),
    任务(
      'card-entered',
      3,
      async card => {
        await card.left()?.upgrade_infr()
      },
      ({ target }) => target.data.race === 'T'
    ),
  ],
  科考小队: [
    进场切换挂件(),
    任务(
      'refreshed',
      2,
      async (card, gold) => {
        await card.obtain_unit(us('歌利亚', gold ? 2 : 1))
      },
      () => true,
      RenewPolicy.roundend
    ),
  ],
  陆军学院: [科挂(3, '战狼', 1, 2), 快速生产('维京战机<机甲>', 3, 5)],
  空军学院: [
    快速生产('维京战机', 3, 5),
    autoBind('task-done', async (card, gold) => {
      await card.obtain_unit(us('解放者', gold ? 2 : 1))
    }),
  ],
  交叉火力: [科挂(4, '攻城坦克', 1, 2), 快速生产('歌利亚', 3, 5)],
  枪兵坦克: [
    autoBind('round-end', async (card, gold) => {
      for (const c of card.player.all_of('T')) {
        if (c.data.infr[0] === 'reactor') {
          await c.obtain_unit(us('陆战队员', gold ? 4 : 2))
        }
      }
    }),
  ],
  斯台特曼: [
    autoBind('fast-prod', async (card, gold) => {
      for (const c of card.around()) {
        c.replace_unit(c.find('歌利亚', gold ? 2 : 1), elited)
        c.replace_unit(
          c.find(u => u === '维京战机' || u === '维京战机<机甲>', gold ? 2 : 1),
          elited
        )
      }
    }),
    autoBind('post-enter', async card => {
      const c = card.left()
      if (c && c.data.race === 'T') {
        await c.upgrade_infr()
      }
    }),
  ],
  护航中队: [
    快速生产('黄昏之翼', 1, 2),
    autoBind('card-entered', async (card, gold) => {
      await card.obtain_unit(us('怨灵战机', gold ? 2 : 1))
    }),
  ],
  泰凯斯: [
    反应堆('陆战队员(精英)'),
    autoBind('round-end', async (card, gold) => {
      for (const c of card.player.all_of('T')) {
        c.replace_unit(c.find('陆战队员', gold ? 5 : 3), elited)
        c.replace_unit(c.find('劫掠者', gold ? 5 : 3), elited)
      }
    }),
    autoBind('round-end', async (card, gold) => {
      card.obtain_unit(us('医疗运输机', gold ? 2 : 1))
    }),
  ],
  外籍军团: [
    反应堆('牛头人陆战队员'),
    autoBind('post-enter', async card => {
      for (const c of card.around()) {
        let nPro = 0,
          nNor = 0
        c.data.units.forEach(u => {
          if (u === '陆战队员') {
            nNor++
          } else if (u === '陆战队员(精英)') {
            nPro++
          }
        })
        const nProRest = nPro % 3
        let nProTran = nPro - nProRest,
          nNorTran = 0
        let cnt = nProTran / 3
        if (6 - nProRest * 2 <= nNor) {
          nNorTran += 6 - nProRest * 2
          nNor -= 6 - nProRest * 2
          nProTran += nProRest
          cnt++
        }
        const nNorRest = nNor % 6
        cnt += (nNor - nNorRest) / 6
        nNorTran += nNor - nNorRest
        c.remove_unit([
          ...c.find('陆战队员(精英)', nProTran),
          ...c.find('陆战队员', nNorTran),
        ])
        await c.obtain_unit(us('牛头人陆战队员', cnt))
      }
    }),
  ],
  钢铁洪流: [
    快速生产('雷神', 1, 2),
    科挂X(5, async (card, gold) => {
      for (const c of card.player.all_of('T')) {
        c.replace_unit(c.find('攻城坦克', gold ? 2 : 1), elited)
        c.replace_unit(c.find('战狼', gold ? 2 : 1), elited)
      }
    }),
  ],
  游骑兵: [
    autoBind('infr-changed', async (card, gold, { target }) => {
      await target.obtain_unit(us('雷诺(狙击手)', gold ? 2 : 1))
    }),
    反应堆('雷诺(狙击手)'),
  ],
  沃菲尔德: [
    autoBind('round-end', async (card, gold) => {
      for (const c of card.player.present.filter(isCardInstance)) {
        c.replace_unit(c.find('陆战队员(精英)', gold ? 2 : 1), '帝盾卫兵')
      }
    }),
    autoBindUnique((card, desc) => {
      card.player.attrib.alter('沃菲尔德', 0)
      card.view.set('沃菲尔德', () => {
        if (desc.disabled) {
          return '禁用'
        }
        const v = card.player.attrib.get('沃菲尔德')
        if (v === null || v < (desc.gold ? 2 : 1)) {
          return `启用 ${v || 0}`
        } else {
          return `停用 ${v}`
        }
      })
      card.bus.on('card-selled', async ({ target }) => {
        if (desc.disabled) {
          return
        }
        if (target.data.race !== 'T') {
          return
        }
        if (card.player.attrib.get('沃菲尔德') >= (desc.gold ? 2 : 1)) {
          return
        }
        card.player.attrib.alter('沃菲尔德', 1)
        await card.obtain_unit(target.data.units.filter(isNormal))
      })
    }, '沃菲尔德'),
  ],
  帝国舰队: [
    任务(
      'card-selled',
      3,
      async (card, gold) => {
        await card.obtain_unit(us('战列巡航舰', gold ? 2 : 1))
      },
      () => true,
      RenewPolicy.instant
    ),
    科挂X(4, async (card, gold) => {
      await card.obtain_unit(us('黄昏之翼', gold ? 4 : 2))
    }),
  ],
  黄昏之翼: [快速生产('黄昏之翼', 1, 2), 反应堆('女妖')],
  艾尔游骑兵: [
    autoBind('fast-prod', async (card, gold) => {
      await card.left()?.obtain_unit(us('水晶塔', gold ? 2 : 1))
    }),
    autoBind('round-end', async (card, gold) => {
      let n = 0
      for (const c of card.around()) {
        const idx = c.find('水晶塔', 1)
        if (idx.length > 0) {
          c.remove_unit(idx)
          n += 1
        }
      }
      await card.obtain_unit(us('陆战队员', n * (gold ? 8 : 4)))
    }),
  ],
  帝国敢死队: [
    快速生产('诺娃', 2, 2),
    反应堆('诺娃'),
    autoBind('task-done', async (card, gold) => {
      await card.obtain_unit(us('诺娃', gold ? 2 : 1))
    }),
  ],
  以火治火: [
    autoBind('round-end', async (card, gold) => {
      for (const c of card.player.all_of('T')) {
        if (c.data.infr[0] === 'reactor') {
          await c.obtain_unit(us('火蝠', gold ? 2 : 1))
        }
      }
    }),
    autoBind('fast-prod', async (card, gold) => {
      for (const c of card.player.all_of('T')) {
        c.replace_unit(c.find('火蝠', gold ? 3 : 2), elited)
      }
    }),
  ],
  复制中心: [
    autoBind('fast-prod', async (card, gold) => {
      for (const c of card.player.data.hand) {
        if (!c) {
          continue
        }
        const units = getCard(c).unit
        const r: UnitKey[] = []
        for (const k in units) {
          const unit = k as UnitKey
          if (!isNormal(unit) || isHero(unit) || !isBiological(unit)) {
            continue
          }
          r.push(...us(unit, units[unit] || 0))
        }
        await card.obtain_unit(
          card.player.game.gen.shuffle(r).slice(0, gold ? 2 : 1)
        )
      }
    }),
  ],
  帝国精锐: [
    快速生产('恶蝠游骑兵', 1, 2),
    autoBind('round-end', async (card, gold) => {
      await card.obtain_unit(
        us(
          '恶蝠游骑兵',
          Math.floor(
            card.player.present
              .filter(isCardInstance)
              .map(c => c.find('反应堆').length)
              .reduce((a, b) => a + b, 0) / (gold ? 2 : 3)
          )
        )
      )
    }),
  ],
}

export { data }
