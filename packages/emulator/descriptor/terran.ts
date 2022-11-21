import { getCard, isNormal, UnitKey } from 'data'
import { CardInstance } from '../card'
import { Emitter } from '../emitter'
import { Player } from '../player'
import { CardDescriptorTable, DescriptorGenerator, LogicBus } from '../types'
import { isCardInstance, refC, refP } from '../utils'

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
    card.data.attrib.registerAttribute(
      'task',
      n => `任务进度: ${n} / ${count}`,
      0
    )
    let n = 0
    const bus = card.bus
    bus.begin()
    bus.on(msg, async p => {
      if (n < count && pred(p)) {
        n += 1
        await card.data.attrib.setAttribute('task', n)
        if (n === count) {
          await reward(card, gold)
          await card.player.game.post('task-done', refC(card))
          if (policy === RenewPolicy.instant) {
            n = 0
            await card.data.attrib.setAttribute('task', 0)
          }
        }
      }
    })
    switch (policy) {
      case RenewPolicy.roundend:
        bus.on('round-end', async () => {
          n = 0
          await card.data.attrib.setAttribute('task', 0)
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
  return (card, gold, text) => {
    card.bus.begin()
    card.bus.on('fast-prod', async () => {
      await card.obtain_unit(Array(gold ? gc : nc).fill(unit))
    })
    const cleaner = card.bus.end()
    return {
      text,
      gold,

      unbind() {
        cleaner()
      },
    }
  }
}

function 科挂(
  count: number,
  unit: UnitKey,
  nc: number,
  gc: number
): DescriptorGenerator {
  return (card, gold, text) => {
    card.bus.begin()
    card.bus.on('round-end', async () => {
      let n = 0
      card.player.present.filter(isCardInstance).forEach(c => {
        n += c.find('科技实验室').length + c.find('高级科技实验室').length
      })
      if (n >= count) {
        await card.obtain_unit(Array(gold ? gc : nc).fill(unit))
      }
    })
    const cleaner = card.bus.end()
    return {
      text,
      gold,

      unbind() {
        cleaner()
      },
    }
  }
}

function 反应堆(unit: UnitKey): DescriptorGenerator {
  return (card, gold, text) => {
    card.bus.begin()
    card.bus.on('round-end', async () => {
      if (card.infr()[0] === 'reactor') {
        await card.obtain_unit(Array(gold ? 2 : 1).fill(unit))
      }
    })
    const cleaner = card.bus.end()
    return {
      text,
      gold,

      unbind() {
        cleaner()
      },
    }
  }
}

function 进场切换挂件(): DescriptorGenerator {
  return (card, gold, text) => {
    card.bus.begin()
    card.bus.on('post-enter', async () => {
      for (const c of [card.left(), card.right()]) {
        await c?.switch_infr()
      }
    })
    const cleaner = card.bus.end()
    return {
      text,
      gold,

      unbind() {
        cleaner()
      },
    }
  }
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
        await card.player.discover([])
      },
      () => true
    ),
  ],
  实验室安保: [反应堆('陆战队员'), 进场切换挂件()],
  征兵令: [
    (card, gold, text) => {
      card.bus.begin()
      card.bus.on('post-enter', async () => {
        for (const c of [card.left(), card.right()]) {
          if (c?.data.race === 'T') {
            await card.obtain_unit(
              await c.filter((u, i) => i % 3 === 0 && isNormal(u))
            )
          }
        }
      })
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
  恶火小队: [
    反应堆('恶火'),
    科挂(2, '歌利亚', 1, 2),
    快速生产('攻城坦克', 1, 1),
  ],
  空投地雷: [
    (card, gold, text) => {
      card.bus.begin()
      card.bus.on('card-entered', async () => {
        await card.obtain_unit(Array(gold ? 2 : 1).fill('寡妇雷'))
      })
      const cleaner = card.bus.end()
      return {
        text,
        gold,

        unbind() {
          cleaner()
        },
      }
    },
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
        await card.obtain_unit(Array(gold ? 2 : 1).fill('歌利亚'))
      },
      () => true,
      RenewPolicy.roundend
    ),
  ],
  陆军学院: [科挂(3, '战狼', 1, 2), 快速生产('维京战机', 3, 5)],
  空军学院: [
    快速生产('维京战机', 3, 5),
    (card, gold, text) => {
      card.bus.begin()
      card.bus.on('task-done', async () => {
        await card.obtain_unit(Array(gold ? 2 : 1).fill('解放者'))
      })
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
}

export { data }
