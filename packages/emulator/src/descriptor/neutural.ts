import {
  AllUpgrade,
  canElite,
  CardKey,
  elited,
  getCard,
  getUnit,
  isBiological,
  isHero,
  isNormal,
  Race,
  Unit,
  UnitKey,
} from '@sctavern-emulator/data'
import { CardInstance } from '../card'
import { CardDescriptorTable, DescriptorGenerator } from '../types'
import { autoBind, autoBindPlayer, isCardInstance, us } from '../utils'

function 供养(n: number, unit: UnitKey): DescriptorGenerator {
  return autoBind('post-sell', async card => {
    const right = card.right()
    if (!isCardInstance(right)) {
      return
    }
    const cnt = card.find('精华').length
    await right.obtain_unit(us(unit, Math.floor(cnt / n)))
    if (right.data.belong === 'origin') {
      await right.obtain_unit(us('精华', cnt))
    }
  })
}

function 黑暗容器_获得(
  unit: UnitKey,
  nc: number,
  gc: number
): DescriptorGenerator {
  return autoBind('gain-darkness', async (card, gold) => {
    await card.obtain_unit(us(unit, gold ? gc : nc))
  })
}

function fake(): DescriptorGenerator {
  return (card, gold, text) => {
    return {
      text,
      gold,

      unbind() {},
    }
  }
}
function 黑暗容器_复活(n: number): DescriptorGenerator {
  return fake()
}

const data: CardDescriptorTable = {
  原始蟑螂: [供养(1, '原始蟑螂')],
  不死队: [黑暗容器_获得('不死队', 1, 2), 黑暗容器_复活(8)],
  紧急部署: [],
  原始刺蛇: [
    供养(1, '原始刺蛇'),
    autoBind('round-end', async (card, gold) => {
      await card.obtain_unit([
        ...us('原始刺蛇', gold ? 2 : 1),
        ...us('精华', gold ? 4 : 2),
      ])
    }),
  ],
  原始异龙: [
    autoBind('card-entered', async (card, gold) => {
      await card.right()?.obtain_unit(us('精华', gold ? 2 : 1))
    }),
    autoBind('round-end', async card => {
      if (card.player.data.mineral < 1) {
        return
      }
      let n = 0
      for (const c of card.player.present.filter(isCardInstance)) {
        n += (await c.filter(u => u === '精华')).length
      }
      await card.obtain_unit(us('原始异龙', Math.floor(n / 2)))
    }),
  ],
  虚空大军: [
    autoBind('round-end', async (card, gold) => {
      const item: {
        [key in 'T' | 'P' | 'Z']: UnitKey
      } = {
        T: '歌利亚',
        Z: '刺蛇',
        P: '龙骑士',
      }
      const cp = card.player.count_present()
      const unit: UnitKey[] = []
      for (const r in item) {
        if (cp[r as 'T' | 'P' | 'Z'] > 0) {
          unit.push(...us(item[r as 'T' | 'P' | 'Z'], gold ? 2 : 1))
        }
      }
      await card.obtain_unit(unit)
    }),
  ],
  鲜血猎手: [黑暗容器_获得('鲜血猎手', 1, 2), 黑暗容器_复活(5)],
  暴掠龙: [
    供养(2, '暴掠龙'),
    autoBind('round-end', async (card, gold) => {
      await card.obtain_unit([
        ...us('暴掠龙', gold ? 2 : 1),
        ...us('精华', gold ? 4 : 2),
      ])
    }),
  ],
  适者生存: [
    autoBind('round-end', async (card, gold) => {
      const choice: [CardInstance, number][] = []
      for (const c of card.player.present.filter(isCardInstance)) {
        choice.push(
          ...c.data.units
            .map((u, i) => [u, i] as [UnitKey, number])
            .filter(([u]) => isNormal(u) && isBiological(u) && canElite(u))
            .map(([u, i]) => [c, i] as [CardInstance, number])
        )
      }
      for (const [c, i] of card.player.game.gen
        .shuffle(choice)
        .slice(0, gold ? 8 : 5)) {
        await c.replace_unit([i], elited)
      }
    }),
  ],
  毁灭者: [
    autoBind('post-sell', async (card, gold) => {
      await card
        .left()
        ?.obtain_unit(
          us('毁灭者', Math.min(card.data.attrib.get('dark'), gold ? 30 : 10))
        )
    }),
  ],
  原始点火虫: [
    autoBind('round-end', async card => {
      await card.obtain_unit(
        us(
          '原始点火虫',
          Math.max(
            0,
            Math.min(10, card.find('精华').length) * 2 -
              card.find('原始点火虫').length
          )
        )
      )
    }),
  ],
  原始雷兽: [
    供养(4, '原始暴龙兽'),
    autoBind('round-end', async (card, gold) => {
      await card.obtain_unit([
        ...us('原始雷兽', gold ? 2 : 1),
        ...us('精华', card.player.count_present().N),
      ])
    }),
  ],
  马拉什: [
    autoBind('round-end', async card => {
      for (const c of card.around()) {
        c.set_void()
      }
      await card.player.refresh()
    }),
  ],
  黑暗预兆: [
    autoBind('round-end', async (card, gold) => {
      const pc = card.player.count_present()
      if (pc.T && pc.Z && pc.P && pc.N) {
        await card.obtain_unit(us('混合体毁灭者', gold ? 4 : 2))
      }
    }),
  ],
  阿拉纳克: [
    autoBind('post-enter', async card => {
      const cs = card.player.present
        .filter(isCardInstance)
        .filter(c => c !== card)
      if (cs.length === 0) {
        return
      } else if (cs.length > 2) {
        card.player.game.gen.shuffle(cs)
      }
      for (const c of cs.slice(0, 2)) {
        await card.seize(c, {
          unreal: true,
          upgrade: true,
        })
      }
    }),
  ],
  天罚行者: [
    autoBind('post-enter', async card => {
      let d = 0
      for (const c of card.player.present
        .filter(isCardInstance)
        .filter(c => c.data.level <= 4)
        .filter(c => 'dark' in c.data.attrib.attrib)) {
        const cd = c.data.attrib.get('dark')
        d += cd
        await c.gain_darkness(-cd)
      }
      await card.obtain_unit(us('天罚行者', Math.floor(d / 5)))
      await card.gain_darkness(d)
    }),
    autoBind('round-end', async (card, gold) => {
      await card.obtain_unit(
        us(
          '天罚行者',
          2 * Math.min(2, Math.floor(card.data.attrib.get('dark') / 10))
        )
      )
    }),
  ],
  德哈卡: [
    autoBind('card-selled', async (card, gold, { target }) => {
      if (target.find('精华').length >= 3) {
        await card.obtain_unit(us('德哈卡分身', gold ? 4 : 2))
      }
    }),
    (card, gold, text) => {
      let cleaner = () => {}
      const ret = {
        text,
        gold,
        disabled: false,
        unique: '德哈卡',

        unbind() {
          cleaner()
        },
      }
      card.bus.begin()
      card.bus.on('round-end', async () => {
        if (ret.disabled) {
          return
        }
        if (card.player.data.mineral >= 1) {
          card.player.data.persisAttrib.config('德哈卡', 1)
        }
      })
      card.bus.on('round-start', async () => {
        if (ret.disabled) {
          return
        }
        if (card.player.data.persisAttrib.get('德哈卡')) {
          await card.player.discover(
            card.player.game.pool.discover(
              c => !!c.attr.origin && c.level < 5,
              3
            )
          )
          await card.player.data.persisAttrib.set('德哈卡', 0)
        }
      })
      cleaner = card.bus.end()
      return ret
    },
  ],
  我叫小明: [
    autoBind('post-enter', async card => {
      const left = card.left()
      if (left) {
        if (
          left.data.level >= 1 &&
          left.data.level <= 6 &&
          left.occupy.length > 0
        ) {
          await card.player.obtain_card(getCard(left.occupy[0]))
        }
        await left.seize(card)
        await left.obtain_upgrade('星空加速')
      }
    }),
  ],
  豆浆油条KT1: [
    autoBind('post-enter', async card => {
      for (const c of [card, card.left(), card.right()].filter(
        isCardInstance
      )) {
        await c.obtain_upgrade(
          card.player.game.gen.shuffle(
            AllUpgrade.filter(u => !c.data.upgrades.includes(u))
          )[0]
        )
      }
    }),
  ],
  豆浆油条: [
    autoBind('round-end', async card => {
      for (const c of card.player.present
        .filter(isCardInstance)
        .filter(c => c.pos > card.pos)) {
        c.set_void()
      }
    }),
  ],
  战斗号角: [
    autoBind('card-selled', async (card, gold, { target }) => {
      await card.obtain_unit(
        target.data.units
          .filter(isNormal)
          .map(getUnit)
          .map((u, i) => [u, i] as [Unit, number])
          .sort(([ua, ia], [ub, ib]) => {
            if (ua.value === ub.value) {
              return ia - ib
            } else {
              return ub.value - ua.value
            }
          })
          .slice(0, 1)
          .map(([u]) => u.name)
      )
    }),
  ],
  凯瑞甘: [
    autoBind('post-enter', async card => {
      if (
        [card.left(), card.right()]
          .filter(isCardInstance)
          .filter(c => c.data.name === '凯瑞甘').length > 0
      ) {
        return
      }
      const l = card.left()
      if (l) {
        await card.seize(l, {
          unreal: true,
        })
      }
    }),
    autoBind('post-enter', async card => {
      const around = [card.left(), card.right()]
        .filter(isCardInstance)
        .filter(c => c.data.name === '凯瑞甘')
      console.log(around)
      if (around.length > 0) {
        await around[0].clear_desc()
        around[0].data.name = '刀锋女王'
        const descs = data.刀锋女王
        if (descs) {
          for (let i = 0; i < descs.length; i++) {
            await around[0].add_desc(descs[i], getCard('刀锋女王').desc[i])
          }
        } else {
          console.log('WARN: Card Not Implement Yet')
        }
        await around[0].replace_unit(
          around[0].find('莎拉·凯瑞甘', 1),
          '刀锋女王'
        )
        await card.player.destroy(card)
      } else {
        await card.obtain_upgrade('献祭')
      }
    }),
  ],
  刀锋女王: [fake()],
  虚空构造体: [fake()], // TODO: show void attribute
  黄金矿工: [
    autoBind('round-start', async card => {
      await card.player.obtain_resource({
        mineral: 1,
      })
    }),
    autoBind('post-sell', async card => {
      await card.player.obtain_resource({
        mineral: 2,
      })
    }),
  ],
  死亡舰队: [黑暗容器_获得('毁灭者', 1, 2), 黑暗容器_复活(10)],
  虚空裂痕: [
    黑暗容器_获得('百夫长', 1, 2),
    黑暗容器_复活(5),
    autoBind('round-end', async (card, gold) => {
      if (card.player.data.mineral >= 1) {
        await card.obtain_unit(us('百夫长', gold ? 4 : 2))
      }
    }),
  ],
  死亡之翼: [
    autoBindPlayer('seize', async (card, gold, { target }) => {
      if (target === card) {
        await card.obtain_unit(us('天霸', gold ? 2 : 1))
      }
    }),
    autoBind('card-combined', async (card, gold, { target }) => {
      if (target !== card) {
        await target.seize(card)
      }
    }),
  ],
  虚空援军: [
    autoBind('post-enter', async card => {
      if (card.player.data.gas < 1) {
        return
      }
      await card.obtain_upgrade(
        card.player.game.gen.shuffle(AllUpgrade.map(u => u))[0]
      )
    }),
    autoBind('round-end', async card => {
      let maxi = 0
      let exp: CardInstance | null = null
      for (const c of card.player.present.filter(isCardInstance)) {
        if (c.value() > maxi) {
          maxi = c.value()
          exp = c
        }
      }
      if (card === exp || !exp) {
        return
      }
      await exp.seize(card, {
        upgrade: true,
      })
    }),
  ],
  深渊行者: [
    autoBindPlayer('seize', async (card, gold) => {
      await card.obtain_unit(us('先锋', gold ? 2 : 1))
    }),
  ],
  黑暗祭坛: [
    黑暗容器_获得('凤凰', 1, 2),
    autoBind('round-end', async (card, gold) => {
      let mini = 9999999
      let exp: CardInstance | null = null
      for (const c of card.player.present.filter(isCardInstance)) {
        if (c.value() < mini) {
          mini = c.value()
          exp = c
        }
      }
      if (card === exp || !exp) {
        return
      }
      await card.seize(exp)
    }),
  ],
  混合体巨兽: [
    autoBind('round-end', async (card, gold) => {
      const pc = card.player.count_present()
      if (pc.T && pc.Z && pc.P && pc.N) {
        await card.obtain_unit(us('混合体巨兽', gold ? 2 : 1))
      }
    }),
  ],
  埃蒙仆从: [
    autoBind('round-end', async (card, gold) => {
      const zs = card.player.all_of('Z').filter(c => c !== card)
      const ps = card.player.all_of('P').filter(c => c !== card)
      if (zs.length > 0 && ps.length > 0) {
        await card.player.destroy(zs[0])
        await card.player.destroy(ps[0])
        for (const c of card.player.present
          .filter(isCardInstance)
          .filter(c => c.data.attrib.get('void'))) {
          await c.obtain_unit(us('混合体毁灭者', gold ? 3 : 2))
        }
      }
    }),
  ],
  风暴英雄: [
    autoBind('obtain-upgrade', async card => {
      await card.obtain_unit([
        card.player.game.gen.shuffle([
          '马拉什',
          '阿拉纳克',
          '利维坦',
          '虚空构造体',
          '科罗拉里昂',
        ] as UnitKey[])[0],
      ])
    }),
  ],
  死亡之握: [
    (card, gold, text) => {
      let cleaner = () => {}
      const ret = {
        text,
        gold,
        disabled: false,
        unique: '死亡之握-结束',

        unbind() {
          cleaner()
        },
      }
      card.bus.begin()
      card.bus.on('round-end', async () => {
        if (ret.disabled) {
          return
        }
        for (const c of card.player.store.filter(
          c => c !== null
        ) as CardKey[]) {
          const units = getCard(c).unit
          const r: UnitKey[] = []
          for (const k in units) {
            const unit = k as UnitKey
            if (!isNormal(unit) || isHero(unit)) {
              continue
            }
            r.push(unit)
          }
          await card.obtain_unit(
            card.player.game.gen.shuffle(r).slice(0, gold ? 2 : 1)
          )
        }
      })
      cleaner = card.bus.end()
      return ret
    },
    (card, gold, text) => {
      let cleaner = () => {}
      const ret = {
        text,
        gold,
        disabled: false,
        unique: '死亡之握-刷新',

        unbind() {
          cleaner()
        },
      }
      card.bus.begin()
      card.bus.on('refreshed', async () => {
        if (ret.disabled) {
          return
        }
        await card.obtain_unit(
          card.player.game.gen
            .shuffle(card.data.units.filter(u => !isHero(u)))
            .slice(0, gold ? 2 : 1) // TODO: 可能要修改随机策略
        )
      })
      cleaner = card.bus.end()
      return ret
    },
  ],
}

export { data }
