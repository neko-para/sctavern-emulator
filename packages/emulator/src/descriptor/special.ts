import {
  AllCard,
  getCard,
  isBiological,
  isBuilding,
  isHero,
  isNormal,
  UnitKey,
} from '@sctavern-emulator/data'
import { CardInstance } from '../card'
import { CardDescriptorTable } from '../types'
import { autoBind, autoBindPlayer, autoBindUnique, fake, us } from '../utils'
import { RenewPolicy, 任务 } from './terran'

function 制造X(
  count: number,
  result: (card: CardInstance, gold: boolean) => Promise<void>
) {
  return autoBind('round-end', async (card, gold) => {
    const cnt = card.find('零件').length
    const n = Math.floor(cnt / count)
    if (n > 0) {
      await card.remove_unit(card.find('零件', count))
      await result(card, gold)
    }
  })
}

function 制造(count: number, unit: UnitKey, num = 1) {
  return 制造X(count, async card => {
    await card.obtain_unit(us(unit, num))
  })
}

const data: CardDescriptorTable = {
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
  母舰核心: [fake(), fake()],
  观察样本: [],
  毒气炮塔: [
    autoBind('round-end', async (card, gold) => {
      const cnt = card.find('自动机炮').length
      const r = gold ? 2 : 3
      const n = Math.floor(cnt / r)
      await card.remove_unit(card.find('自动机炮', n * r))
      await card.obtain_unit(us('毒气炮塔', n))
    }),
    autoBind('post-sell', async (card, gold) => {
      await card.player.obtain_resource({
        mineral: gold ? 2 : 1,
      })
    }),
  ],
  凯达琳巨石: [
    autoBind('round-end', async (card, gold) => {
      const cnt = card.find('自动机炮').length
      const r = gold ? 4 : 5
      const n = Math.floor(cnt / r)
      await card.remove_unit(card.find('自动机炮', n * r))
      await card.obtain_unit(us('凯达琳巨石', n))
    }),
    autoBind('round-end', async card => {
      await card.obtain_unit(us('自动机炮', card.player.count_present().P))
    }),
  ],
  岗哨机枪: [
    autoBind('round-end', async card => {
      const cnt = card.find('自动机炮').length
      await card.remove_unit(card.find('自动机炮'))
      await card.obtain_unit(us('岗哨机枪', cnt * 2))
    }),
    autoBind('card-entered', async (card, gold) => {
      await card.obtain_unit(us('岗哨机枪', gold ? 3 : 2))
    }),
  ],
  行星要塞: [
    autoBind('round-end', async (card, gold) => {
      const cnt = card.find('自动机炮').length
      const r = gold ? 4 : 5
      const n = Math.floor(cnt / r)
      await card.remove_unit(card.find('自动机炮', n * r))
      await card.obtain_unit(us('行星要塞', n))
    }),
    autoBindUnique(async (card, desc) => {
      card.attrib.setView('行星要塞', () => (desc.disabled ? '停用' : '启用'))
      card.bus.on('card-selled', async ({ target }) => {
        if (desc.disabled) {
          return
        }
        if (target.data.race !== 'N') {
          return
        }
        await card.obtain_unit(await target.filter(isBuilding))
      })
    }, '行星要塞'),
  ],
  星门: [
    autoBind('round-end', async (card, gold) => {
      await card.obtain_unit(us('零件', gold ? 2 : 1))
      await card.replace_unit(card.find('自动机炮'), '零件')
    }),
    制造(6, '星门'),
  ],
  自动机炮: [
    autoBind('round-end', async (card, gold) => {
      await card.obtain_unit(us('自动机炮', gold ? 2 : 1))
    }),
    autoBind('post-sell', async card => {
      const ar = card.around()
      if (ar.length === 0) {
        return
      }
      await ar[0].obtain_unit(us('自动机炮', card.find('自动机炮').length))
    }),
  ],
  作战中心: [
    制造(6, '作战指挥中心'),
    任务(
      'card-entered',
      2,
      async (card, gold) => {
        await card.obtain_unit(us('零件', gold ? 2 : 1))
      },
      () => true,
      RenewPolicy.roundend
    ),
  ],
  导弹基地: [
    autoBind('round-end', async card => {
      const cnt = card.find('自动机炮').length
      await card.remove_unit(card.find('自动机炮'))
      await card.obtain_unit(us('风暴对地导弹塔', cnt * 2))
    }),
    autoBindPlayer('task-done', async (card, gold) => {
      await card.obtain_unit(us('风暴对地导弹塔', gold ? 3 : 2))
    }),
  ],
  粒子光炮: [
    autoBind('round-end', async (card, gold) => {
      for (const c of card.around()) {
        const idxs = c.find('自动机炮', gold ? 2 : 1)
        await c.remove_unit(idxs)
        await card.obtain_unit(us('自动机炮', idxs.length))
      }
      await card.replace_unit(card.find('自动机炮'), '零件')
    }),
    制造(9, '粒子光炮'),
  ],
  再生钢: [
    autoBind('round-end', async card => {
      const cnt = card.find('自动机炮').length
      const n = Math.floor(cnt / 2)
      await card.remove_unit(card.find('自动机炮', n * 2))
      await card.obtain_unit(us('热辣贝蒂', n))
    }),
    autoBind('obtain-upgrade', async (card, gold) => {
      await card.player.discover(
        card.player.game
          .shuffle(AllCard.map(getCard).filter(c => c.attr.type === 'building'))
          .slice(0, 3),
        {
          nodrop: true,
        }
      )
      await card.obtain_unit(us('热辣贝蒂', gold ? 2 : 1))
    }),
  ],
  不法之徒: [],
  生化实验室: [
    autoBind('post-deploy', async (card, gold, { target }) => {
      const idx = (await target.filter(isBiological)).filter(
        u => u !== '被感染的陆战队员'
      )
      await target.player.inject(us('被感染的陆战队员', idx.length))
    }),
  ],
  紧急回收: [
    autoBind('post-deploy', async (card, gold, { target }) => {
      const into = target.around().filter(c => c.data.name !== '虫卵')[0]
      if (into) {
        await into.obtain_unit(
          target.data.units.filter(isNormal).filter(u => !isHero(u))
        )
      }
      await target.player.destroy(target)
    }),
  ],
  星灵科技: [
    autoBind('post-deploy', async (card, gold, { target }) => {
      await target.add_desc(
        autoBind('round-end', async (card, gold) => {
          await card.player.wrap(us('陆战队员', gold ? 2 : 1))
        }),
        ['每回合结束时, 折跃1陆战队员', '每回合结束时, 折跃2陆战队员']
      )
    }),
  ],
  尖端科技: [
    autoBind('post-deploy', async (card, gold, { target }) => {
      await target.obtain_upgrade('轨道空降')
    }),
  ],
  超负荷: [
    autoBind('post-deploy', async (card, gold, { target }) => {
      await target.player.destroy(target, true)
    }),
  ],
  机械工厂: [
    制造(70, '休伯利安号'),
    制造(45, '战列巡航舰', 9),
    制造(30, '雷神', 6),
    制造(16, '攻城坦克', 6),
  ],
}

export { data }
