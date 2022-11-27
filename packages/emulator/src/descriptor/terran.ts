import { elited, getCard, isBiological, isHero, isNormal, UnitKey } from 'data'
import { CardInstance } from '../card'
import {
  CardDescriptorTable,
  Descriptor,
  DescriptorGenerator,
  LogicBus,
} from '../types'
import {
  autoBind,
  autoBindPlayer,
  isCardInstance,
  refC,
  refP,
  us,
} from '../utils'

enum RenewPolicy {
  never,
  roundend,
  instant,
}

function 任务<T extends string & keyof LogicBus>(
  msg: T,
  count: number,
  reward: (card: CardInstance, gold: boolean) => Promise<void>,
  pred: (p: LogicBus[T]) => boolean = () => true,
  policy: RenewPolicy = RenewPolicy.never
): DescriptorGenerator {
  return (card, gold, text) => {
    card.data.attrib.config('task', 0, 'discard')
    card.data.attrib.setView('任务', n => `任务进度: ${n} / ${count}`, 'task')
    let n = 0
    const bus = card.bus
    bus.begin()
    bus.on(msg, async p => {
      if (n < count && pred(p)) {
        n += 1
        await card.data.attrib.set('task', n)
        if (n === count) {
          await reward(card, gold)
          await card.player.game.post('task-done', refC(card))
          if (policy === RenewPolicy.instant) {
            n = 0
            await card.data.attrib.set('task', 0)
          }
        }
      }
    })
    switch (policy) {
      case RenewPolicy.roundend:
        bus.on('round-end', async () => {
          n = 0
          await card.data.attrib.set('task', 0)
        })
        break
    }
    const cleaner = bus.end()
    return {
      text,
      gold,

      unbind() {
        cleaner()
      },
    }
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

function 反应堆(unit: UnitKey): DescriptorGenerator {
  return autoBind('round-end', async (card, gold) => {
    if (card.infr()[0] === 'reactor') {
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
      await card.player.obtain_resource({
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
          await card.obtain_unit(
            await c.filter((u, i) => i % 3 !== 0 && isNormal(u))
          )
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
  陆军学院: [科挂(3, '战狼', 1, 2), 快速生产('维京战机', 3, 5)],
  空军学院: [
    快速生产('维京战机', 3, 5),
    autoBindPlayer('task-done', async (card, gold) => {
      await card.obtain_unit(us('解放者', gold ? 2 : 1))
    }),
  ],
  交叉火力: [科挂(4, '攻城坦克', 1, 2), 快速生产('歌利亚', 3, 5)],
  枪兵坦克: [
    autoBind('round-end', async (card, gold) => {
      for (const c of card.player.all_of('T')) {
        if (c.infr()[0] === 'reactor') {
          await c.obtain_unit(us('陆战队员', gold ? 4 : 2))
        }
      }
    }),
  ],
  斯台特曼: [
    autoBind('fast-prod', async (card, gold) => {
      for (const c of card.around()) {
        await c.replace_unit(c.find('歌利亚', gold ? 2 : 1), elited)
        await c.replace_unit(c.find('维京战机', gold ? 2 : 1), elited)
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
        await c.replace_unit(c.find('陆战队员', gold ? 5 : 3), elited)
        await c.replace_unit(c.find('劫掠者', gold ? 5 : 3), elited)
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
        await c.remove_unit([
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
        await c.replace_unit(c.find('攻城坦克', gold ? 2 : 1), elited)
        await c.replace_unit(c.find('战狼', gold ? 2 : 1), elited)
      }
    }),
  ],
  游骑兵: [
    autoBindPlayer('infr-changed', async (card, gold, { card: cp }) => {
      const c = card.player.present[cp as number] as CardInstance
      await c.obtain_unit(us('雷诺(狙击手)', gold ? 2 : 1))
    }),
    反应堆('雷诺(狙击手)'),
  ],
  沃菲尔德: [
    autoBind('round-end', async (card, gold) => {
      for (const c of card.player.present.filter(isCardInstance)) {
        if (c.data.race === 'T') {
          await c.replace_unit(
            c.find('陆战队员(精英)', gold ? 2 : 1),
            '帝盾卫兵'
          )
        }
      }
    }),
    (card, gold, text) => {
      let cleaner = () => {}
      const ret: Descriptor = {
        text,
        gold,
        disabled: false,
        unique: '沃菲尔德',

        unbind() {
          cleaner()
        },
      }
      card.data.attrib.setView('沃菲尔德', () => {
        if (ret.disabled) {
          return '禁用'
        }
        const v = card.player.data.attrib.get('沃菲尔德')
        if (v === null || v < (gold ? 2 : 1)) {
          return `启用 ${v || 0}`
        } else {
          return `停用 ${v}`
        }
      })
      card.bus.on('card-selled', async ({ target }) => {
        if (ret.disabled) {
          return
        }
        if (target.data.race !== 'T') {
          return
        }
        card.player.data.attrib.config('沃菲尔德', 0)
        card.player.data.attrib.setView(
          '沃菲尔德',
          v => `本回合沃菲尔德已回收的卡牌数: ${v}`,
          '沃菲尔德'
        )
        const v = card.player.data.attrib.get('沃菲尔德')
        if (v >= (gold ? 2 : 1)) {
          return
        }
        await card.player.data.attrib.set('沃菲尔德', v + 1)
        await card.obtain_unit(target.data.units.filter(isNormal))
      })
      cleaner = card.bus.end()
      return ret
    },
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
    autoBindPlayer('task-done', async (card, gold) => {
      await card.obtain_unit(us('诺娃', gold ? 2 : 1))
    }),
  ],
  以火治火: [
    autoBind('round-end', async (card, gold) => {
      for (const c of card.player.all_of('T')) {
        if (c.infr()[0] === 'reactor') {
          await c.obtain_unit(us('火蝠', gold ? 2 : 1))
        }
      }
    }),
    autoBind('fast-prod', async (card, gold) => {
      for (const c of card.player.all_of('T')) {
        await c.replace_unit(c.find('火蝠', gold ? 3 : 2), elited)
      }
    }),
  ],
  复制中心: [
    autoBind('fast-prod', async (card, gold) => {
      for (const c of card.player.hand) {
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
          '劫掠者(皇家卫队)',
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
