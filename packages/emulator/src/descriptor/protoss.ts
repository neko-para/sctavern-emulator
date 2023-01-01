import { computed, reactive } from '@vue/reactivity'
import {
  canElite,
  elited,
  isBiological,
  isHeavy,
  isHero,
  isMachine,
  isNormal,
  UnitKey,
} from '@sctavern-emulator/data'
import { CardInstance } from '../card'
import { CardDescriptorTable, DescriptorGenerator } from '../types'
import { autoBind, autoBindX, isCardInstance, us } from '../utils'

function 集结X(
  power: number,
  func: (card: CardInstance, gold: boolean) => Promise<void>,
  id = 0
): DescriptorGenerator {
  return autoBindX((card, gold) => ({
    'round-end': async () => {
      const n = Math.min(2, Math.floor(card.data.power / power))
      for (let i = 0; i < n; i++) {
        await card.regroup(id)
      }
    },
    'req-regroup': async ({ id: rid }) => {
      if (rid === id || rid === -1) {
        await func(card, gold)
      }
    },
  }))
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
      if (way === 'normal') {
        await card.obtain_unit(us(unit, gold ? gc : nc))
      } else {
        await card.player.wrap(us(unit, gold ? gc : nc))
      }
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
    autoBindX(
      (card, gold, desc) => ({
        wrap: async param => {
          if (desc.disabled) {
            return
          }
          if (!param.into) {
            param.into = card
          } else {
            // ???
          }
        },
      }),
      {
        unique: '折跃信标',
        uniqueNoGold: true,
        init: (card, gold, desc) => {
          card.view.set('折跃信标', () => (desc.disabled ? '停用' : '启用'))
        },
      }
    ),
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
      if (card.data.power >= 6) {
        await card.obtain_unit(['黑暗圣堂武士'])
      }
    }),
  ],
  重回战场: [
    autoBind('post-enter', async (card, gold) => {
      for (const c of card.player.all_of('P')) {
        c.replace_unit(c.find(isBiological, gold ? 2 : 1), u =>
          isHero(u) ? '英雄不朽者' : '不朽者'
        )
      }
    }),
    autoBind('post-sell', async (card, gold) => {
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
        unit.push(...c.remove_unit(ts).map(elited))
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
      if (card.data.power >= 15) {
        await card.player.wrap(['执政官(精英)'])
      }
    }),
  ],
  黄金舰队: [集结(5, '侦察机', 1, 2), 集结(7, '风暴战舰', 1, 2, 'normal', 1)],
  尤尔兰: [
    autoBindX(() => ({}), {
      init: (card, gold) => ({
        供能: gold ? 8 : 5,
      }),
    }),
    autoBind('obtain-unit', async (card, gold, { time, units }) => {
      if (
        time === 'post' &&
        (units.includes('水晶塔') || units.includes('虚空水晶塔'))
      ) {
        await card.obtain_unit(us('莫汗达尔', gold ? 2 : 1))
      }
    }),
    autoBind('obtain-unit', async (card, gold, param) => {
      if (param.time !== 'prev' || param.way !== 'wrap') {
        return
      }
      param.units = param.units.map(u => (isMachine(u) ? '尤尔兰' : u))
    }),
  ],
  光复艾尔: [
    autoBind('obtain-upgrade', async card => {
      card.replace_unit(card.find('泰坦棱镜<已收起>'), '泰坦棱镜')
      card.player.resort_unique('光复艾尔')
    }),
    autoBindX(
      (card, gold, desc) => ({
        'card-selled': async param => {
          if (desc.disabled) {
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
          card.replace_unit(card.find('泰坦棱镜'), '泰坦棱镜<已收起>')
          await card.obtain_unit(
            target.data.units
              .filter(u => isNormal(u) || u === '水晶塔')
              .filter(u => desc.gold || !isHero(u))
          )
          card.player.resort_unique('光复艾尔')
        },
      }),
      {
        unique: '光复艾尔',
        uniqueNoGold: true,
        init: (card, gold, desc) => {
          desc.manualDisable = computed<boolean>(() => {
            return card.data.units.indexOf('泰坦棱镜') === -1
          }) as unknown as boolean
          card.view.set('光复艾尔', () =>
            card.find('泰坦棱镜').length > 0
              ? desc.disabled
                ? '停用'
                : '启用'
              : '禁用'
          )
        },
      }
    ),
  ],
  菲尼克斯: [
    autoBind('post-enter', async card => {
      for (const c of card.around()) {
        c.replace_unit([...c.find('狂热者'), ...c.find('使徒')], '旋风狂热者')
        c.replace_unit(
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
        await c.post({
          msg: 'req-regroup',
          id: -1,
        })
        await c.post({
          msg: 'req-regroup',
          id: -1,
        })
      }
    }),
  ],
  净化一切: [
    集结(4, '狂热者(精英)', 1, 2, 'wrap'),
    autoBind('round-end', async (card, gold) => {
      await card.player.wrap(
        us(
          '巨像(精英)',
          (gold ? 2 : 1) * Math.min(2, Math.floor(card.data.power / 7))
        )
      )
    }),
  ],
  阿尔达瑞斯: [
    autoBindX(
      (card, gold, desc) => ({
        'round-end': async () => {
          if (desc.disabled) {
            return
          }
          if (card.player.count_present().P >= 5) {
            await card.obtain_unit(us('英雄不朽者', desc.gold ? 2 : 1))
          }
        },
      }),
      {
        unique: '阿尔达瑞斯',
      }
    ),
  ],
  阿塔尼斯: [
    autoBind('round-end', async (card, gold) => {
      await card.obtain_unit([
        ...us('旋风狂热者(精英)', 2),
        ...us('阿塔尼斯', gold ? 2 : 0),
      ])
    }),
    autoBindX(
      (card, gold, desc) => ({
        'round-end': async () => {
          if (desc.disabled) {
            return
          }
          for (const c of card.player.present.filter(isCardInstance)) {
            await c.post({
              msg: 'req-regroup',
              id: -1,
            })
          }
        },
      }),
      {
        unique: '阿塔尼斯',
      }
    ),
  ],
  净化之光: [
    autoBind('round-end', async (card, gold) => {
      card.obtain_unit(us('虚空辉光舰', gold ? 2 : 1))
    }),
    集结X(4, async (card, gold) => {
      for (const c of card.player.present.filter(isCardInstance)) {
        c.replace_unit(c.find('虚空辉光舰', gold ? 2 : 1), elited)
      }
    }),
  ],
  生物质发电: [
    autoBind('card-selled', async (card, gold, { target }) => {
      if (target.data.race === 'Z' && target.data.level >= 3) {
        await card.obtain_unit(us('水晶塔', gold ? 2 : 1))
      }
    }),
  ],
  黑暗教长: [
    autoBind('post-enter', async card => {
      await card.obtain_upgrade('暗影战士')
    }),
    集结(5, '黑暗圣堂武士(精英)', 1, 2),
  ],
  六脉神剑: [
    autoBind('card-entered', async (card, gold) => {
      if (card.find('先知').length < card.data.power) {
        card.player.wrap(us('先知', gold ? 2 : 1))
      }
    }),
  ],
  晋升仪式: [
    集结X(4, async (card, gold) => {
      card.replace_unit(card.find('不朽者', gold ? 2 : 1), '英雄不朽者')
      card.replace_unit(
        card.find(u => isBiological(u) && u !== '高阶圣堂武士', gold ? 2 : 1),
        '高阶圣堂武士'
      )
    }),
  ],
  英雄叉: [
    autoBind('obtain-unit', async (card, gold, param) => {
      if (param.time === 'prev') {
        param.units = param.units.map(u =>
          u === '狂热者(精英)' ? '卡尔达利斯' : u
        )
      }
    }),
  ],
}

export { data }
