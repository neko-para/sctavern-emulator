import {
  canElite,
  elited,
  isBiological,
  isHeavy,
  isHero,
  isNormal,
  UnitKey,
} from 'data'
import { CardInstance } from '../card'
import { CardDescriptorTable, DescriptorGenerator } from '../types'
import { autoBind, isCardInstance, refC, Shuffler, us } from '../utils'

function 集结X(
  power: number,
  func: (card: CardInstance, gold: boolean) => Promise<void>,
  id = 0
): DescriptorGenerator {
  return (card, gold, text) => {
    card.bus.begin()
    card.bus.on('round-end', async () => {
      const n = Math.min(2, Math.floor(card.power() / power))
      for (let i = 0; i < n; i++) {
        await card.post('regroup', {
          ...refC(card),
          id,
        })
      }
    })
    card.bus.on('regroup', async ({ id: rid }) => {
      if (rid === id || rid === -1) {
        await func(card, gold)
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
function 集结(
  power: number,
  unit: UnitKey,
  nc: number,
  gc: number,
  way: 'normal' | 'wrap' = 'normal',
  id = 0
): DescriptorGenerator {
  return 集结X(
    power,
    async (card, gold) => {
      await card.obtain_unit(us(unit, gold ? gc : nc), way)
    },
    id
  )
}

const data: CardDescriptorTable = {
  折跃援军: [
    autoBind('post-sell', async (card, gold) => {
      await card.player.wrap([
        ...us('狂热者', gold ? 2 : 1),
        ...us('追猎者', gold ? 4 : 2),
      ])
    }),
  ],
  发电站: [],
  供能中心: [
    autoBind('tavern-upgraded', async (card, gold) => {
      await card.obtain_unit(us('水晶塔', gold ? 2 : 1))
    }),
  ],
  龙骑兵团: [
    autoBind('round-end', async (card, gold) => {
      await card.obtain_unit(us('零件', gold ? 4 : 2))
    }),
    autoBind('post-sell', async card => {
      await card.player.wrap(us('龙骑士', card.find('零件').length))
    }),
  ],
  万叉奔腾: [集结(2, '狂热者', 1, 2)],
  折跃信标: [
    (card, gold, text) => {
      let cleaner = () => {}
      const ret = {
        text,
        gold,
        disabled: false,
        unique: '折跃信标',
        uniqueNoGold: true,

        unbind() {
          cleaner()
        },
      }
      card.data.attrib.registerAttribute(
        '折跃信标',
        v => (v ? (ret.disabled ? '停用' : '启用') : '禁用'),
        1
      )
      card.bus.begin()
      card.bus.on('wrap', async param => {
        if (ret.disabled) {
          return
        }
        if (!param.into) {
          param.into = card
        } else {
          // ???
        }
      })
      cleaner = card.bus.end()
      return ret
    },
  ],
  艾尔之刃: [
    autoBind('post-enter', async (card, gold) => {
      for (const c of [card.left(), card.right()]
        .filter(isCardInstance)
        .filter(c => c.data.race === 'P')) {
        c.obtain_unit(us('水晶塔', gold ? 2 : 1))
      }
    }),
  ],
  折跃部署: [
    autoBind('round-end', async (card, gold) => {
      await card.player.wrap(us('追猎者', gold ? 3 : 2))
    }),
    autoBind('round-start', async (card, gold) => {
      await card.player.wrap(us('狂热者', gold ? 2 : 1))
    }),
  ],
  暗影卫队: [
    autoBind('post-enter', async card => {
      await card.obtain_upgrade('暗影战士')
    }),
    集结(3, '黑暗圣堂武士', 1, 2),
    autoBind('round-end', async card => {
      if (card.power() >= 6) {
        await card.obtain_unit(['黑暗圣堂武士'])
      }
    }),
  ],
  重回战场: [
    autoBind('post-enter', async (card, gold) => {
      for (const c of card.player.all_of('P')) {
        await c.replace_unit(c.find(isBiological, gold ? 2 : 1), u =>
          isHero(u) ? '英雄不朽者' : '不朽者'
        )
      }
    }),
    autoBind('post-enter', async (card, gold) => {
      await card.player.wrap(us('不朽者', gold ? 2 : 1))
    }),
  ],
  折跃攻势: [
    autoBind('wrap', async (card, gold) => {
      await card.obtain_unit(us('追猎者', gold ? 2 : 1))
    }),
  ],
  净化者军团: [
    集结X(5, async (card, gold) => {
      const unit: UnitKey[] = []
      for (const c of card.player.all_of('P')) {
        const us = c.find(u => canElite(u) && !isHeavy(u))
        card.player.game.gen.shuffle(us)
        const ts = us.slice(0, gold ? 2 : 1)
        unit.push(...(await c.remove_unit(ts)).map(elited))
      }
      await card.player.wrap(unit)
    }),
  ],
  凯拉克斯: [
    autoBind('round-end', async (card, gold) => {
      await card.player.wrap(
        us(
          card.player.game.gen.shuffle([
            '不朽者',
            '巨像',
            '掠夺者',
          ] as UnitKey[])[0],
          gold ? 2 : 1
        )
      )
    }),
  ],
  虚空舰队: [集结(5, '虚空辉光舰', 1, 2, 'wrap')],
  势不可挡: [
    autoBind('post-enter', async card => {
      await card.player.wrap(['执政官(精英)'])
    }),
    集结(5, '执政官', 1, 2, 'wrap'),
    autoBind('round-end', async card => {
      if (card.power() >= 15) {
        await card.player.wrap(['执政官(精英)'])
      }
    }),
  ],
  黄金舰队: [集结(5, '侦察机', 1, 2), 集结(7, '风暴战舰', 1, 2, 'normal', 1)],
  莫汗达尔: [
    (card, gold, text) => {
      let cleaner = () => {}
      const ret = {
        text,
        gold,
        disabled: false,
        unique: '莫汗达尔',

        unbind() {
          cleaner()
        },
      }
      card.bus.begin()
      card.bus.on('wrap', async ({ units }) => {
        if (ret.disabled) {
          return
        }
        await card.obtain_unit(units.slice(units.length - (gold ? 2 : 1)))
      })
      cleaner = card.bus.end()
      return ret
    },
  ],
  光复艾尔: [
    (card, gold, text) => {
      let cleaner = () => {}
      const ret = {
        text,
        gold,
        disabled: false,
        manualDisable: false,
        unique: '光复艾尔',
        uniqueNoGold: true,

        unbind() {
          cleaner()
        },
      }
      card.data.attrib.registerAttribute(
        '光复艾尔',
        v => (v ? (ret.disabled ? '停用' : '启用') : '禁用'),
        1
      )
      card.bus.begin()
      card.bus.on('card-selled', async param => {
        if (ret.disabled) {
          return
        }
        if (param.flag) {
          return
        }
        const { target } = param
        if (target.data.race !== 'P') {
          return
        }
        param.flag = true
        await card.obtain_unit(
          target.data.units
            .filter(u => isNormal(u) || u === '水晶塔')
            .filter(u => gold || !isHero(u))
        )
        card.data.attrib.setAttribute('光复艾尔', 0)
        ret.manualDisable = true
        await card.player.resort_unique('光复艾尔')
      })
      card.bus.on('obtain-upgrade', async () => {
        card.data.attrib.setAttribute('光复艾尔', 1)
        ret.manualDisable = false
        await card.player.resort_unique('光复艾尔')
      })
      cleaner = card.bus.end()
      return ret
    },
  ],
  菲尼克斯: [
    autoBind('post-enter', async card => {
      for (const c of [card.left(), card.right()].filter(isCardInstance)) {
        await c.replace_unit(
          [...c.find('狂热者'), ...c.find('使徒')],
          '旋风狂热者'
        )
        await c.replace_unit(
          [...c.find('狂热者(精英)'), ...c.find('使徒(精英)')],
          '旋风狂热者(精英)'
        )
      }
    }),
    集结(5, '掠夺者', 1, 2),
  ],
  酒馆后勤处: [
    autoBind('post-enter', async card => {
      for (const c of card.player.present.filter(isCardInstance)) {
        await card.post('regroup', {
          ...refC(c),
          id: -1,
        })
        await card.post('regroup', {
          ...refC(c),
          id: -1,
        })
      }
    }),
  ],
  净化一切: [
    集结(4, '狂热者(精英)', 1, 2, 'wrap'),
    autoBind('round-end', async (card, gold) => {
      if (card.power() >= 7) {
        await card.player.wrap(us('巨像(精英)', gold ? 2 : 1))
      }
    }),
  ],
  阿尔达瑞斯: [
    (card, gold, text) => {
      let cleaner = () => {}
      const ret = {
        text,
        gold,
        disabled: false,
        unique: '阿尔达瑞斯',

        unbind() {
          cleaner()
        },
      }
      card.bus.begin()
      card.bus.on('round-end', async () => {
        if (ret.disabled) {
          return
        }
        if (card.player.count_present().P >= 5) {
          await card.obtain_unit(us('英雄不朽者', gold ? 2 : 1))
        }
      })
      cleaner = card.bus.end()
      return ret
    },
  ],
  阿塔尼斯: [
    autoBind('round-end', async (card, gold) => {
      await card.obtain_unit([
        ...us('旋风狂热者(精英)', 2),
        ...us('阿塔尼斯', gold ? 2 : 0),
      ])
    }),
    autoBind('round-end', async card => {
      for (const c of card.player.present.filter(isCardInstance)) {
        await card.post('regroup', {
          ...refC(c),
          id: -1,
        })
      }
    }),
  ],
}

export { data }
